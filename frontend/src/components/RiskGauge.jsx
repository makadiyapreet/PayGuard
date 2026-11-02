import React from "react";

const BANDS = [
  { name: "LOW", min: 80, color: "text-emerald-400", bg: "bg-emerald-500", mult: "100%" },
  { name: "MEDIUM", min: 50, color: "text-amber-400", bg: "bg-amber-500", mult: "50%" },
  { name: "HIGH", min: 20, color: "text-orange-400", bg: "bg-orange-500", mult: "10%" },
  { name: "CRITICAL", min: 0, color: "text-rose-500", bg: "bg-rose-600", mult: "0%" },
];

export function RiskGauge({ score = 100 }) {
  const currentBand =
    score >= 80 ? BANDS[0] : score >= 50 ? BANDS[1] : score >= 20 ? BANDS[2] : BANDS[3];

  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl bg-slate-900/40 border border-slate-800">
      <div className="flex justify-between items-center">
        <span className="text-xs uppercase font-semibold tracking-wider text-slate-400">
          CertiK Skynet Risk Score
        </span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded border border-current ${currentBand.color}`}>
          {currentBand.name} ({currentBand.mult} Limit)
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold font-mono tracking-tight text-white">{score}</span>
        <span className="text-slate-500 text-sm font-mono">/ 100</span>
      </div>

      {/* Segmented bar */}
      <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
        <div
          className={`h-full transition-all duration-500 ${currentBand.bg}`}
          style={{ width: `${Math.max(2, score)}%` }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
        <span>0 (Critical)</span>
        <span>20 (High)</span>
        <span>50 (Medium)</span>
        <span>80 (Low)</span>
        <span>100</span>
      </div>
    </div>
  );
}
