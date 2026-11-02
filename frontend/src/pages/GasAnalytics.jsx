import React, { useState } from "react";
import { useTxStore } from "../store/txStore.js";
import { LayerBadge } from "../components/LayerBadge.jsx";
import { shortAddress, formatDateTime } from "../lib/format.js";
import { BarChart3, Download, Zap, Fuel } from "lucide-react";

export function GasAnalytics() {
  const records = useTxStore((s) => s.records);
  const [filterLayer, setFilterLayer] = useState("ALL");

  const filtered = filterLayer === "ALL" 
    ? records 
    : records.filter((r) => r.layer === filterLayer);

  const totalGas = records.reduce((acc, r) => acc + BigInt(r.gasUsed || 0), 0n);
  const totalCostEth = records.reduce((acc, r) => acc + parseFloat(r.costEth || 0), 0);

  const exportCSV = () => {
    const headers = ["Time", "Hash", "Contract", "Method", "Layer", "Status", "GasUsed", "CostETH"];
    const rows = records.map((r) => [
      formatDateTime(r.timestamp),
      r.hash,
      r.contract,
      r.method,
      r.layer,
      r.status,
      r.gasUsed,
      r.costEth,
    ]);
    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `payguard-gas-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Gas Analytics & Security Overhead</span>
            <LayerBadge layer="CORE" />
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real on-chain gas consumption measured from transaction receipts.
          </p>
        </div>

        <button
          onClick={exportCSV}
          disabled={records.length === 0}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 transition-colors border border-slate-700"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Gas CSV</span>
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#121826] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Gas Tracked
          </span>
          <div className="text-2xl font-bold font-mono text-white mt-2">
            {Number(totalGas).toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 font-mono mt-1">
            Across {records.length} transactions
          </div>
        </div>

        <div className="bg-[#121826] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Cost Incurred
          </span>
          <div className="text-2xl font-bold font-mono text-blue-400 mt-2">
            {totalCostEth.toFixed(6)} ETH
          </div>
          <div className="text-xs text-slate-500 font-mono mt-1">
            @ 2.5 Gwei Ganache rate
          </div>
        </div>

        <div className="bg-[#121826] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Avg Gas per Transaction
          </span>
          <div className="text-2xl font-bold font-mono text-purple-400 mt-2">
            {records.length > 0
              ? Math.round(Number(totalGas) / records.length).toLocaleString()
              : "--"}
          </div>
          <div className="text-xs text-slate-500 font-mono mt-1">
            Includes multi-sig & verification
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-[#121826] border border-slate-800 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Transaction Gas Log
          </h3>

          <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            {["ALL", "L1", "L2", "L3", "CORE"].map((l) => (
              <button
                key={l}
                onClick={() => setFilterLayer(l)}
                className={`px-3 py-1 rounded-lg font-mono text-xs font-semibold transition-all ${
                  filterLayer === l
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-500 font-mono">
            No transactions recorded for selected filter. Execute transactions in the dashboard to populate live gas metrics.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Tx Hash</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Layer</th>
                  <th className="py-2.5 px-3">Gas Used</th>
                  <th className="py-2.5 px-3">Cost (ETH)</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="py-3 px-3 text-slate-400">{formatDateTime(r.timestamp)}</td>
                    <td className="py-3 px-3 text-blue-400">{shortAddress(r.hash)}</td>
                    <td className="py-3 px-3 text-white font-bold">{r.label}</td>
                    <td className="py-3 px-3">
                      <LayerBadge layer={r.layer} />
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-purple-300">
                      {Number(r.gasUsed).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">{r.costEth} ETH</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          r.status === "success"
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {r.status}
                      </span>
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

