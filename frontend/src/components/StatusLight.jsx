import React from "react";

export function StatusLight({ status = "ok", label, tooltip }) {
  const colors = {
    ok: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]",
    warn: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]",
    err: "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]",
    muted: "bg-slate-500",
  };

  return (
    <div className="inline-flex items-center gap-2" title={tooltip}>
      <span className={`w-2.5 h-2.5 rounded-full ${colors[status] || colors.muted}`} />
      {label && <span className="text-xs font-mono font-medium text-slate-300">{label}</span>}
    </div>
  );
}
