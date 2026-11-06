import React from "react";
import { LayerBadge } from "./LayerBadge.jsx";

export function KpiCard({ title, value, subtext, layer, icon: Icon, badgeText }) {
  return (
    <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs uppercase font-bold tracking-wider text-slate-700 dark:text-slate-400">
          {title}
        </span>
        <div className="flex items-center gap-1.5">
          {badgeText && (
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 font-mono px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-bold shadow-sm">
              {badgeText}
            </span>
          )}
          {layer && <LayerBadge layer={layer} />}
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white">{value}</span>
      </div>

      {subtext && <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">{subtext}</div>}
    </div>
  );
}

