import React from "react";
import { formatEth } from "../lib/format.js";

export function EthAmount({ value, symbol = "ETH", decimals = 4, className = "" }) {
  const formatted = formatEth(value, decimals);

  return (
    <span className={`font-mono font-semibold ${className}`} title={`${value} raw`}>
      {formatted} <span className="text-slate-400 font-sans text-xs font-normal">{symbol}</span>
    </span>
  );
}

