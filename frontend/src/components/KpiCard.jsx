import React from "react";
import { LayerBadge } from "./LayerBadge.jsx";

export function KpiCard({ title, value, subtext, layer, icon: Icon, badgeText }) {
  return (
    <div className="bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs uppercase font-semibold tracking-wider text-slate-400">
          {title}
        </span>
        <div className="flex items-center gap-1.5">
          {badgeText && (
            <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded">
              {badgeText}
            </span>
          )}
          {layer && <LayerBadge layer={layer} />}
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-bold font-mono tracking-tight text-white">{value}</span>
      </div>

      {subtext && <div className="text-xs text-slate-500 font-sans">{subtext}</div>}
    </div>
  );
}
