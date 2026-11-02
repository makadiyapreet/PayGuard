import React from "react";
import { useTxStore } from "../store/txStore.js";
import { LayerBadge } from "./LayerBadge.jsx";
import { sendTx } from "../lib/tx.js";
import { AlertTriangle, X, ShieldAlert, ArrowRight } from "lucide-react";

export function RevertExplainer() {
  const pendingRevert = useTxStore((s) => s.pendingRevert);
  const clearPendingRevert = useTxStore((s) => s.clearPendingRevert);

  if (!pendingRevert) return null;

  const { contractName, method, args, value, actorIndex, revertInfo } = pendingRevert;

  const handleForceSend = async () => {
    clearPendingRevert();
    await sendTx({
      contractName,
      method,
      args,
      value,
      actorIndex,
      force: true,
      label: `[FORCED FAILURE] ${contractName}.${method}`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121826] border border-rose-500/40 rounded-2xl max-w-xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Execution Intercepted</h3>
                <LayerBadge layer={revertInfo?.layer || "CORE"} />
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {contractName}.{method}()
              </p>
            </div>
          </div>
          <button
            onClick={clearPendingRevert}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reason card */}
        <div className="bg-rose-950/30 border border-rose-500/20 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 text-rose-400 font-mono text-sm font-bold mb-1">
            <AlertTriangle className="w-4 h-4" />
            {revertInfo?.code || "REVERT"} — {revertInfo?.title || "Transaction Reverted"}
          </div>
          <p className="text-xs text-rose-200/90 leading-relaxed mb-3">
            {revertInfo?.meaning}
          </p>
          <div className="text-xs bg-black/40 border border-rose-900/40 rounded-lg p-2.5 text-slate-300">
            <span className="font-semibold text-rose-300">Defense Mechanism:</span>{" "}
            {revertInfo?.hint}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-between items-center pt-2 border-t border-slate-800">
          <button
            onClick={clearPendingRevert}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
          >
            Cancel Transaction
          </button>

          <button
            onClick={handleForceSend}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow-lg shadow-rose-900/40 transition-all"
            title="Sends on-chain with fixed gasLimit to demonstrate actual revert and capture gas metrics"
          >
            <span>Force Send (Demo Revert On-Chain)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

