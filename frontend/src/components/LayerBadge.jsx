import React from "react";
import { LAYERS } from "../lib/layers.js";

export function LayerBadge({ layer = "CORE", size = "sm" }) {
  const meta = LAYERS[layer] || LAYERS.CORE;

  const sizeClasses = size === "lg" 
    ? "px-2.5 py-1 text-xs font-bold tracking-wider" 
    : "px-2 py-0.5 text-[10px] font-bold";

  const colorStyles = {
    L1: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-500/30",
    L2: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-500/30",
    L3: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30",
    CORE: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/60",
  };

  const dotColors = {
    L1: "bg-blue-600 dark:bg-blue-400",
    L2: "bg-purple-600 dark:bg-purple-400",
    L3: "bg-emerald-600 dark:bg-emerald-400",
    CORE: "bg-slate-600 dark:bg-slate-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full uppercase border font-mono ${sizeClasses} ${colorStyles[layer] || colorStyles.CORE}`}
      title={`${meta.name} — ${meta.solution}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColors[layer] || dotColors.CORE}`} />
      {meta.id}
    </span>
  );
}
