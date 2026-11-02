import React from "react";
import { useTxStore } from "../store/txStore.js";
import { LayerBadge } from "./LayerBadge.jsx";
import { CheckCircle2, XCircle, Loader2, X } from "lucide-react";
import { shortAddress } from "../lib/format.js";

export function TxToastContainer() {
  const toasts = useTxStore((s) => s.toasts);
  const removeToast = useTxStore((s) => s.removeToast);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-slate-900 border border-slate-700/80 rounded-xl p-3.5 shadow-xl flex items-start gap-3 animate-in slide-in-from-bottom-2 duration-150"
        >
          {t.status === "pending" && (
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0 mt-0.5" />
          )}
          {t.status === "success" && (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          )}
          {t.status === "failed" && (
            <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-xs font-semibold text-white truncate">{t.title}</span>
              {t.layer && <LayerBadge layer={t.layer} />}
            </div>

            {t.hash && (
              <div className="text-[10px] font-mono text-slate-400 truncate">
                Tx: {shortAddress(t.hash)}
              </div>
            )}
            {t.gasUsed && (
              <div className="text-[10px] font-mono text-slate-400">
                Gas: {Number(t.gasUsed).toLocaleString()} ({t.costEth} ETH)
              </div>
            )}
            {t.error && (
              <div className="text-[10px] font-mono text-rose-400 mt-0.5 truncate">
                {t.error}
              </div>
            )}
          </div>

          <button
            onClick={() => removeToast(t.id)}
            className="text-slate-500 hover:text-white p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

