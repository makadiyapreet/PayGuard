import React from "react";

const STATE_MAP = {
  0: { label: "None", color: "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-400 border-slate-300 dark:border-slate-700" },
  1: { label: "Pending", color: "bg-amber-50 dark:bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-500/30 font-bold" },
  2: { label: "Verified (Delayed)", color: "bg-blue-50 dark:bg-blue-500/15 text-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-500/30 font-bold" },
  3: { label: "Executed", color: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30 font-bold" },
  4: { label: "Challenged", color: "bg-rose-50 dark:bg-rose-500/15 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-500/30 font-bold" },
  5: { label: "Refunded", color: "bg-purple-50 dark:bg-purple-500/15 text-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-500/30 font-bold" },
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

