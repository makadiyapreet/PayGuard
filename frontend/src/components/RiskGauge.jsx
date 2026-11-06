import React from "react";

const BANDS = [
  { name: "LOW", min: 80, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500", mult: "100%" },
  { name: "MEDIUM", min: 50, color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500", mult: "50%" },
  { name: "HIGH", min: 20, color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-500", mult: "10%" },
  { name: "CRITICAL", min: 0, color: "text-rose-700 dark:text-rose-500", bg: "bg-rose-600", mult: "0%" },
];

export function RiskGauge({ score = 100 }) {
  const currentBand =
    score >= 80 ? BANDS[0] : score >= 50 ? BANDS[1] : score >= 20 ? BANDS[2] : BANDS[3];

  return (
    <div className="flex flex-col gap-3 p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex justify-between items-center">
        <span className="text-xs uppercase font-extrabold tracking-wider text-slate-800 dark:text-slate-300">
          CertiK Skynet Risk Score
        </span>
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border border-current shadow-sm ${currentBand.color}`}>
          {currentBand.name} ({currentBand.mult} Limit)
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-white">{score}</span>
        <span className="text-slate-600 dark:text-slate-400 text-sm font-mono font-bold">/ 100</span>
      </div>

      {/* Segmented bar */}
      <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden flex border border-slate-200 dark:border-slate-700">
        <div
          className={`h-full transition-all duration-500 ${currentBand.bg}`}
          style={{ width: `${Math.max(2, score)}%` }}
        />
      </div>

      <div className="flex justify-between text-[11px] text-slate-700 dark:text-slate-400 font-mono font-bold mt-1">
        <span>0 (Critical)</span>
        <span>20 (High)</span>
        <span>50 (Medium)</span>
        <span>80 (Low)</span>
        <span>100</span>
      </div>
    </div>
  );
}
