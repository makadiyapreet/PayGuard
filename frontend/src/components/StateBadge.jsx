import React from "react";

const STATE_MAP = {
  0: { label: "None", color: "bg-slate-800 text-slate-400 border-slate-700" },
  1: { label: "Pending", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  2: { label: "Verified (Delayed)", color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  3: { label: "Executed", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  4: { label: "Challenged", color: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  5: { label: "Refunded", color: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
};

export function StateBadge({ state = 0 }) {
  const meta = STATE_MAP[state] || STATE_MAP[0];

  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider border ${meta.color}`}
    >
      {meta.label}
    </span>
  );
}

