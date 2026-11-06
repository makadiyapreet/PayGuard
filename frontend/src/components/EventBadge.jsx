import React from "react";

export function EventBadge({ event = "" }) {
  const ev = String(event || "");
  let color = "bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";

  if (ev === "Deposited" || ev === "DepositChecked" || ev === "Unpaused") {
    color = "bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/60";
  } else if (ev === "Executed" || ev === "Transfer") {
    color = "bg-blue-50 text-blue-900 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700/60";
  } else if (ev === "Blessed" || ev === "ApprovalUsed") {
    color = "bg-indigo-50 text-indigo-900 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-700/60";
  } else if (ev === "Verified") {
    color = "bg-cyan-50 text-cyan-900 border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-700/60";
  } else if (ev === "CurseVoted" || ev === "Paused" || ev === "AlertRaised" || ev === "Challenged") {
    color = "bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700/60";
  } else if (ev === "Refunded") {
    color = "bg-purple-50 text-purple-900 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-700/60";
  } else if (ev === "BotRegistered" || ev === "RewardPoolFunded") {
    color = "bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
  }

  return (
    <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-mono font-bold border shadow-sm ${color}`}>
      {ev}
    </span>
  );
}

