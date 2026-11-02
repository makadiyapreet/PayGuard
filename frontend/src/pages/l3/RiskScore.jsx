import React, { useState, useEffect } from "react";
import { useChainStore } from "../../store/chainStore.js";
import { useAccountStore } from "../../store/accountStore.js";
import { getContractInstance } from "../../lib/chain.js";
import { sendTx } from "../../lib/tx.js";
import { LayerBadge } from "../../components/LayerBadge.jsx";
import { RiskGauge } from "../../components/RiskGauge.jsx";
import { shortAddress, formatDateTime } from "../../lib/format.js";
import { Gauge, TrendingUp, ShieldAlert, RotateCcw } from "lucide-react";

export function RiskScore() {
  const { riskScore, riskBand, refreshLiveState } = useChainStore();
  const { activeAccountIndex } = useAccountStore();

  const [history, setHistory] = useState([]);

  useEffect(() => {
    async function loadHistory() {
      try {
        const risk = await getContractInstance("RiskScore");
        const count = Number(await risk.getHistoryLength());
        const entries = [];
        for (let i = 0; i < count; i++) {
          const item = await risk.getHistoryAt(i);
          entries.push({
            timestamp: Number(item.timestamp),
            oldScore: Number(item.oldScore),
            newScore: Number(item.newScore),
            reason: item.reason,
            by: item.by,
          });
        }
        setHistory(entries.reverse());
      } catch (err) {
        console.warn("Could not load score history:", err);
      }
    }
    loadHistory();
  }, [riskScore]);

  const handleRecover = async () => {
    await sendTx({
      contractName: "RiskScore",
      method: "recover",
      args: [],
      actorIndex: activeAccountIndex,
      label: "Trigger Score Recovery Step",
    });
    await refreshLiveState();
  };

  const BANDS = [
    { band: "LOW", range: "80 – 100", mult: "100%", active: riskBand === 0, color: "text-emerald-400" },
    { band: "MEDIUM", range: "50 – 79", mult: "50%", active: riskBand === 1, color: "text-amber-400" },
    { band: "HIGH", range: "20 – 49", mult: "10%", active: riskBand === 2, color: "text-orange-400" },
    { band: "CRITICAL", range: "0 – 19", mult: "0%", active: riskBand === 3, color: "text-rose-400" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>CertiK Skynet Public Risk Score</span>
            <LayerBadge layer="L3" />
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic on-chain risk score (0–100). Drops automatically shrink InvariantGuard limits. Recovers linearly (+5 pts/hour) without incidents.
          </p>
        </div>

        <button
          onClick={handleRecover}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Trigger recover() (+5 pts)</span>
        </button>
      </div>

      {/* Score & Multiplier Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <RiskGauge score={riskScore} />
        </div>

        <div className="lg:col-span-2 bg-[#121826] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
            Dynamic Limit Multiplier by Risk Band
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            PayGuard novel contribution: L3 threats feed directly back into L1 limits in a closed security loop.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {BANDS.map((b) => (
              <div
                key={b.band}
                className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                  b.active
                    ? "bg-slate-800/90 border-blue-500 ring-2 ring-blue-500/20"
                    : "bg-slate-900/40 border-slate-800 text-slate-400"
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-xs font-bold ${b.color}`}>{b.band}</span>
                    {b.active && (
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-mono font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">Score: {b.range}</div>
                </div>
                <div className="text-lg font-bold font-mono text-white mt-3">
                  {b.mult} <span className="text-xs font-normal text-slate-400">Limit</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-[#121826] border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>Risk Score Mutation History</span>
          <span className="text-xs bg-slate-800 text-slate-400 font-mono px-2 py-0.5 rounded">
            {history.length} records
          </span>
        </h3>

        {history.length === 0 ? (
          <div className="text-xs text-slate-500 font-mono py-6 text-center">
            No score mutations recorded. Score is nominal at 100/100.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Transition</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Triggered By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {history.map((h, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="py-3 px-3 text-slate-400">{formatDateTime(h.timestamp)}</td>
                    <td className="py-3 px-3 font-bold">
                      <span className="text-slate-400">{h.oldScore}</span> &rarr;{" "}
                      <span className={h.newScore < h.oldScore ? "text-rose-400" : "text-emerald-400"}>
                        {h.newScore}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-amber-300">{h.reason}</td>
                    <td className="py-3 px-3 text-blue-400">{shortAddress(h.by)}</td>
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
