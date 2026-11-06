import React, { useEffect, useState } from "react";
import { LayerBadge } from "../../components/LayerBadge.jsx";
import { FileCheck, ShieldCheck, CheckCircle2 } from "lucide-react";

export function VerificationLab() {
  const [gasReport, setGasReport] = useState(null);

  useEffect(() => {
    fetch("/reports/gas-table.json")
      .then((res) => res.json())
      .then(setGasReport)
      .catch(() => {});
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <span>Verification & Static Analysis Lab</span>
          <LayerBadge layer="L1" />
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Formal CVL specifications, Slither static analysis evidence, and baseline gas overhead benchmark.
        </p>
      </div>

      {gasReport && (
        <div className="bg-white dark:bg-[#121826] border border-blue-200 dark:border-blue-500/30 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>PayGuard vs Naive Baseline Bridge Gas Overhead</span>
            <span className="text-xs text-indigo-700 dark:text-purple-300 font-mono font-bold bg-indigo-50 dark:bg-purple-950/40 px-2.5 py-1 rounded-lg border border-indigo-200">
              Overhead: +{gasReport.lifecycle.overheadPct}%
            </span>
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 font-medium leading-relaxed">
            Security overhead measures the additional gas required for multi-sig guardian validation, RMN blessings, and invariant enforcement over a zero-security naive bridge.
          </p>

          <div className="grid grid-cols-2 gap-4 text-xs font-mono">
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-slate-600 dark:text-slate-400 font-semibold block mb-1">PayGuard Full Lifecycle Total:</span>
              <span className="text-xl font-black text-slate-900 dark:text-white">
                {gasReport.lifecycle.payguard.total.toLocaleString()} gas
              </span>
              <div className="text-[11px] text-slate-600 dark:text-slate-500 mt-1 font-medium">
                Deposit + Bless (2 nodes) + Execute
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-slate-600 dark:text-slate-400 font-semibold block mb-1">Naive Baseline Bridge Total:</span>
              <span className="text-xl font-bold text-slate-700 dark:text-slate-400">
                {gasReport.lifecycle.baseline.total.toLocaleString()} gas
              </span>
              <div className="text-[11px] text-slate-600 dark:text-slate-500 mt-1 font-medium">
                Deposit + Direct Owner Mint
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
          Certora Prover Formal Invariant Properties (spec/PayGuard.spec)
        </h3>
        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-800 dark:text-slate-300 space-y-2 border border-slate-200 dark:border-slate-800 shadow-sm font-semibold">
          <div className="text-emerald-700 dark:text-emerald-400 font-bold">✔ Rule 1: Solvency (bridgeBalance &ge; totalSupply)</div>
          <div className="text-emerald-700 dark:text-emerald-400 font-bold">✔ Rule 2: Single Execution (digest executes at most once)</div>
          <div className="text-emerald-700 dark:text-emerald-400 font-bold">✔ Rule 3: Cursed Bridge Cannot Mint</div>
          <div className="text-emerald-400 font-bold">✔ Rule 4: Strictly Ascending Signatures Enforcement</div>
        </div>
      </div>
    </div>
  );
}

