import React, { useState } from "react";
import { shortAddress } from "../lib/format.js";
import { Copy, Check } from "lucide-react";

export function AddressChip({ address, label, roleChip }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!address) return <span className="text-slate-500 font-mono text-xs">--</span>;

  return (
    <div className="inline-flex items-center gap-1.5 bg-slate-900/60 border border-slate-700/60 px-2.5 py-1 rounded-md text-xs font-mono">
      {label && <span className="text-slate-400 font-semibold">{label}:</span>}
      <span className="text-blue-400 select-all">{shortAddress(address)}</span>
      {roleChip && (
        <span className="bg-slate-800 text-[10px] px-1.5 py-0.2 rounded text-slate-300 font-sans">
          {roleChip}
        </span>
      )}
      <button
        onClick={handleCopy}
        className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
        title="Copy address"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}

