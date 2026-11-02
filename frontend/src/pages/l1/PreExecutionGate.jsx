import React, { useState, useEffect } from "react";
import { useChainStore } from "../../store/chainStore.js";
import { useAccountStore } from "../../store/accountStore.js";
import { getContractInstance } from "../../lib/chain.js";
import { LayerBadge } from "../../components/LayerBadge.jsx";
import { formatEth } from "../../lib/format.js";
import { Sliders, CheckCircle2, ShieldCheck } from "lucide-react";

export function PreExecutionGate() {
  const { bridgeBalance, tokenSupply, perTxLimitEff, riskBand } = useChainStore();
  const { accounts, activeAccountIndex } = useAccountStore();
  const currentAccount = accounts[activeAccountIndex];

  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    async function loadSnapshot() {
      if (!currentAccount) return;
      try {
        const guard = await getContractInstance("InvariantGuard");
        const snap = await guard.limitsSnapshot(currentAccount.address);
        setSnapshot(snap);
      } catch (err) {
        console.warn("Could not load limits snapshot:", err);
      }
    }
    loadSnapshot();
  }, [currentAccount, perTxLimitEff, riskBand]);

  const solvent = parseFloat(bridgeBalance) >= parseFloat(tokenSupply);

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Pre-Execution Gate & Limits Simulator</span>
            <LayerBadge layer="L1" />
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Certora Prover formal invariant validation. Solvency condition & dynamically throttled deposit limits.
          </p>
        </div>
      </div>

      {/* Solvency Meter */}
      <div className="bg-[#121826] border border-blue-500/30 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Bridge Solvency Invariant: Locked ETH &ge; pgETH Supply</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${solvent ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
            {solvent ? "PASSED (1:1 BACKED)" : "VIOLATED"}
          </span>
        </h3>

        <div className="grid grid-cols-2 gap-4 mt-4 text-xs font-mono">
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <span className="text-slate-400 block mb-1">Bridge Native ETH Vault:</span>
            <span className="text-2xl font-bold text-white">{bridgeBalance} ETH</span>
          </div>

          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <span className="text-slate-400 block mb-1">Wrapped pgETH Total Supply:</span>
            <span className="text-2xl font-bold text-blue-400">{tokenSupply} pgETH</span>
          </div>
        </div>
      </div>

      {/* Limits Snapshot */}
      {snapshot && (
        <div className="bg-[#121826] border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
            Live Limits Snapshot for Acting Account #{activeAccountIndex}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">Per-Tx Limit (Base &rarr; Effective):</span>
              <span className="text-lg font-bold text-white">
                {formatEth(snapshot.perTxBase)} ETH &rarr;{" "}
                <span className="text-blue-400">{formatEth(snapshot.perTxEff)} ETH</span>
              </span>
            </div>

            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">User Daily Limit (Used / Effective):</span>
              <span className="text-lg font-bold text-white">
                {formatEth(snapshot.userSpent)} / {formatEth(snapshot.userEff)} ETH
              </span>
            </div>

            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">Risk Band Multiplier:</span>
              <span className="text-lg font-bold text-emerald-400">
                {snapshot.multiplierPct.toString()}% of Base
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

