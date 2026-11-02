import React from "react";
import { useChainStore } from "../../store/chainStore.js";
import { AlertOctagon, ShieldAlert, Info } from "lucide-react";
import { Link } from "react-router-dom";

export function GlobalBanner() {
  const { paused, cursed } = useChainStore();

  return (
    <div className="flex flex-col">
      {/* Test keys permanent reminder */}
      <div className="bg-slate-900/90 border-b border-slate-800 text-slate-400 text-[11px] px-4 py-1 flex items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>LOCAL DEMO MODE — Ganache test keys only. Never use on real mainnet or testnet.</span>
        </div>
        <div className="flex items-center gap-4 text-slate-500">
          <span>Target: Ganache 127.0.0.1:7545</span>
          <span>EVM: Paris (0.8.20)</span>
        </div>
      </div>

      {/* Paused alert banner */}
      {paused && (
        <div className="bg-rose-950/80 border-b border-rose-500/50 px-4 py-2 flex items-center justify-between text-xs text-rose-200">
          <div className="flex items-center gap-2 font-semibold">
            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
            <span>BRIDGE PAUSED: OpenZeppelin Defender or Owner emergency pause active. Deposits and redeems halted.</span>
          </div>
          <Link
            to="/governance"
            className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-3 py-1 rounded text-[11px] transition-colors"
          >
            Create Unpause Proposal →
          </Link>
        </div>
      )}

      {/* Cursed alert banner */}
      {cursed && (
        <div className="bg-purple-950/80 border-b border-purple-500/50 px-4 py-2 flex items-center justify-between text-xs text-purple-200">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0" />
            <span>BRIDGE CURSED: Chainlink CCIP Risk Management Network quorum halt active. Minting blocked.</span>
          </div>
          <Link
            to="/governance"
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1 rounded text-[11px] transition-colors"
          >
            Resolve via Governance →
          </Link>
        </div>
      )}
    </div>
  );
}

