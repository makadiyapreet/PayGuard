import React, { useState } from "react";
import { useIndexerStore } from "../../store/indexerStore.js";
import { LayerBadge } from "../../components/LayerBadge.jsx";
import { StateBadge } from "../../components/StateBadge.jsx";
import { shortAddress } from "../../lib/format.js";
import { GitCommit, ArrowRight, CheckCircle2 } from "lucide-react";

export function ConsensusTimeline() {
  const transfers = useIndexerStore((s) => s.transfers);
  const transferList = Object.values(transfers);

  const [selectedId, setSelectedId] = useState(transferList[0]?.id || "");
  const selected = transfers[selectedId] || transferList[0];

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Consensus Verification Timeline</span>
            <LayerBadge layer="L2" />
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            End-to-end consensus progression: Deposit (L1) &rarr; Guardian Off-Chain Sigs &rarr; RMN Blessings &rarr; Destination Execution.
          </p>
        </div>
      </div>

      {transferList.length === 0 ? (
        <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-xs text-slate-600 dark:text-slate-400 font-mono shadow-sm">
          No transfers recorded yet. Deposit funds to view consensus timeline.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transfer list selector */}
          <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-2 shadow-sm">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-400 uppercase tracking-wider mb-2 block">
              Transfers
            </span>
            {transferList.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`p-3 rounded-xl border text-left font-mono text-xs transition-all ${
                  (selected?.id === t.id)
                    ? "bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-slate-900 dark:text-white shadow-sm ring-2 ring-purple-500/20"
                    : "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-slate-300"
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-slate-900 dark:text-white">{shortAddress(t.id)}</span>
                  <StateBadge state={t.state} />
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                  {t.netAmount} ETH &bull; Nonce #{t.nonce}
                </div>
              </button>
            ))}
          </div>

          {/* Stepper details */}
          <div className="lg:col-span-2 bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
            {selected ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-white font-mono">
                      Transfer #{selected.id.slice(0, 10)}...
                    </h3>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      Net: {selected.netAmount} ETH &bull; State: <StateBadge state={selected.state} />
                    </div>
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-300 dark:border-blue-600 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                      1
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Pre-Execution Deposit Checked & Locked</span>
                        <LayerBadge layer="L1" />
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-mono">
                        From: {selected.sender} &bull; Fee charged: {selected.fee} ETH
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-800 dark:bg-purple-500/20 dark:text-purple-400 border border-indigo-300 dark:border-purple-600 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                      2
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Wormhole Guardian Quorum Signatures</span>
                        <LayerBadge layer="L2" />
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-mono">
                        Signatures: 3 of 5 required in ascending order. (0 gas off-chain).
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-800 dark:bg-purple-500/20 dark:text-purple-400 border border-indigo-300 dark:border-purple-600 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                      3
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Chainlink CCIP RMN Quorum Blessings</span>
                        <LayerBadge layer="L2" />
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-mono">
                        Blessings: {selected.blessCount || 0} of 2 required on-chain.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-sm ${
                      selected.state >= 3
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-600"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-500 border border-slate-300 dark:border-slate-700"
                    }`}>
                      4
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Destination Mint (Wrapped pgETH)</span>
                        <LayerBadge layer="CORE" />
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-mono">
                        Recipient: {selected.recipient} &bull; Solvency verified.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

