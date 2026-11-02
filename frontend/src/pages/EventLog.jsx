import React, { useState } from "react";
import { useIndexerStore } from "../store/indexerStore.js";
import { LayerBadge } from "../components/LayerBadge.jsx";
import { shortAddress } from "../lib/format.js";
import { ListOrdered, Filter, Search, Download } from "lucide-react";

export function EventLog() {
  const events = useIndexerStore((s) => s.events);
  const [search, setSearch] = useState("");
  const [filterContract, setFilterContract] = useState("ALL");

  const filtered = events.filter((ev) => {
    if (filterContract !== "ALL" && ev.contractName !== filterContract) return false;
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      ev.event?.toLowerCase().includes(query) ||
      ev.contractName?.toLowerCase().includes(query) ||
      ev.transactionHash?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Unified Cross-Contract Event Log</span>
            <LayerBadge layer="CORE" />
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time chronological feed of indexed on-chain events across all 8 PayGuard contracts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events, hash, or contract..."
            className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-1.5 text-xs text-white font-mono outline-none focus:border-blue-500 w-64"
          />
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-[#121826] border border-slate-800 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Indexed Logs ({filtered.length} matching)
          </span>

          <select
            value={filterContract}
            onChange={(e) => setFilterContract(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1 text-xs text-white font-mono outline-none cursor-pointer"
          >
            <option value="ALL">All Contracts</option>
            <option value="PaymentBridge">PaymentBridge</option>
            <option value="GuardianRegistry">GuardianRegistry</option>
            <option value="RiskManagement">RiskManagement</option>
            <option value="InvariantGuard">InvariantGuard</option>
            <option value="DefenderMonitor">DefenderMonitor</option>
            <option value="DetectionNetwork">DetectionNetwork</option>
            <option value="RiskScore">RiskScore</option>
            <option value="WrappedToken">WrappedToken</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-500 font-mono">
            No events match your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <th className="py-2.5 px-3">Block</th>
                  <th className="py-2.5 px-3">Contract</th>
                  <th className="py-2.5 px-3">Event Name</th>
                  <th className="py-2.5 px-3">Tx Hash</th>
                  <th className="py-2.5 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((ev, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="py-3 px-3 text-slate-400">#{ev.blockNumber}</td>
                    <td className="py-3 px-3 text-blue-400 font-bold">{ev.contractName}</td>
                    <td className="py-3 px-3 text-white font-bold">
                      <span className="bg-slate-800/80 px-2 py-0.5 rounded text-[11px] border border-slate-700">
                        {ev.event}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500">{shortAddress(ev.transactionHash)}</td>
                    <td className="py-3 px-3 text-slate-400 text-[11px] truncate max-w-xs">
                      {ev.args ? JSON.stringify(ev.args, (k, v) => (typeof v === "bigint" ? v.toString() : v)) : "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
