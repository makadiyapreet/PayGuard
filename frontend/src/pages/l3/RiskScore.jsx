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
    {
      band: "LOW",
      range: "80 – 100",
      mult: "100%",
      active: riskBand === 0,
      activeStyle: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-950 dark:text-emerald-300 ring-2 ring-emerald-500/20",
      badgeColor: "bg-emerald-600 text-white",
      nameColor: "text-emerald-700 dark:text-emerald-400",
    },
    {
      band: "MEDIUM",
      range: "50 – 79",
      mult: "50%",
      active: riskBand === 1,
      activeStyle: "bg-amber-50 dark:bg-amber-950/30 border-amber-500 text-amber-950 dark:text-amber-300 ring-2 ring-amber-500/20",
      badgeColor: "bg-amber-600 text-white",
      nameColor: "text-amber-700 dark:text-amber-400",
    },
    {
      band: "HIGH",
      range: "20 – 49",
      mult: "10%",
      active: riskBand === 2,
      activeStyle: "bg-orange-50 dark:bg-orange-950/30 border-orange-500 text-orange-950 dark:text-orange-300 ring-2 ring-orange-500/20",
      badgeColor: "bg-orange-600 text-white",
      nameColor: "text-orange-700 dark:text-orange-400",
    },
    {
      band: "CRITICAL",
      range: "0 – 19",
      mult: "0%",
      active: riskBand === 3,
      activeStyle: "bg-rose-50 dark:bg-rose-950/30 border-rose-500 text-rose-950 dark:text-rose-300 ring-2 ring-rose-500/20",
      badgeColor: "bg-rose-600 text-white",
      nameColor: "text-rose-700 dark:text-rose-400",
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <span>CertiK Skynet Public Risk Score</span>
            <LayerBadge layer="L3" />
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
            Dynamic on-chain risk score (0–100). Drops automatically shrink InvariantGuard limits. Recovers linearly (+5 pts/hour) without incidents.
          </p>
        </div>

        <button
          onClick={handleRecover}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 transition-colors shadow-md shadow-blue-500/20"
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

        <div className="lg:col-span-2 bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
            Dynamic Limit Multiplier by Risk Band
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 font-medium">
            PayGuard novel contribution: L3 threats feed directly back into L1 limits in a closed security loop.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {BANDS.map((b) => (
              <div
                key={b.band}
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                  b.active
                    ? `${b.activeStyle} shadow-sm`
                    : "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 opacity-75 hover:opacity-100"
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-xs font-extrabold ${b.nameColor}`}>{b.band}</span>
                    {b.active && (
                      <span className={`text-[10px] ${b.badgeColor} px-2 py-0.5 rounded font-mono font-bold shadow-sm`}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 font-semibold mt-1">
                    Score: {b.range}
                  </div>
                </div>
                <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-4">
                  {b.mult} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Limit</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>Risk Score Mutation History</span>
          <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold px-2.5 py-0.5 rounded">
            {history.length} records
          </span>
        </h3>

        {history.length === 0 ? (
          <div className="text-xs text-slate-500 font-mono py-8 text-center font-medium">
            No score mutations recorded. Score is nominal at 100/100.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <tr className="text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider font-bold">
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Transition</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Triggered By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-transparent">
                {history.map((h, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                      {formatDateTime(h.timestamp)}
                    </td>
                    <td className="py-3.5 px-4 font-bold">
                      <span className="text-slate-600 dark:text-slate-400">{h.oldScore}</span>{" "}
                      <span className="text-slate-400">&rarr;</span>{" "}
                      <span className={h.newScore < h.oldScore ? "text-rose-700 dark:text-rose-400 font-black" : "text-emerald-700 dark:text-emerald-400 font-black"}>
                        {h.newScore}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800/40 px-2.5 py-1 rounded-md font-bold text-[11px] inline-block shadow-sm">
                        {h.reason}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-blue-700 dark:text-blue-400 font-bold">
                      {shortAddress(h.by)}
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

