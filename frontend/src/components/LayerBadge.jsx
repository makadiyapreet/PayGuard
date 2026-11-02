import React from "react";
import { LAYERS } from "../lib/layers.js";

export function LayerBadge({ layer = "CORE", size = "sm" }) {
  const meta = LAYERS[layer] || LAYERS.CORE;

  const sizeClasses = size === "lg" 
    ? "px-3 py-1 text-xs font-bold tracking-wider" 
    : "px-2 py-0.5 text-[10px] font-semibold";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full uppercase border ${sizeClasses}`}
      style={{
        backgroundColor: meta.badgeBg,
        borderColor: meta.badgeBorder,
        color: meta.badgeText,
      }}
      title={`${meta.name} — ${meta.solution}`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.id}
    </span>
  );
}
