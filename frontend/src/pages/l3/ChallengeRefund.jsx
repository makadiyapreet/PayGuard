import React, { useState } from "react";
import { useIndexerStore } from "../../store/indexerStore.js";
import { useAccountStore } from "../../store/accountStore.js";
import { sendTx } from "../../lib/tx.js";
import { LayerBadge } from "../../components/LayerBadge.jsx";
import { StateBadge } from "../../components/StateBadge.jsx";
import { shortAddress } from "../../lib/format.js";
import { ShieldAlert, RotateCcw, AlertTriangle } from "lucide-react";

export function ChallengeRefund() {
  const transfers = useIndexerStore((s) => s.transfers);
  const { activeAccountIndex } = useAccountStore();
  const transferList = Object.values(transfers);

  const [challengeReason, setChallengeReason] = useState("COLLUSION_OR_MALICIOUS_DELAY");

  // Filter transfers that can be challenged (state 1: Pending or state 2: Verified)
  const challengeable = transferList.filter((t) => t.state === 1 || t.state === 2);
  // Filter transfers that can be refunded (state 4: Challenged, or expired/cursed)
  const refundable = transferList.filter((t) => t.state === 4 || t.state === 1);

  const handleChallenge = async (id) => {
    await sendTx({
      contractName: "PaymentBridge",
      method: "challenge",
      args: [id, challengeReason],
      actorIndex: activeAccountIndex,
      label: `Challenge Transfer ${shortAddress(id)}`,
    });
  };

  const handleRefund = async (id) => {
    await sendTx({
      contractName: "PaymentBridge",
      method: "refund",
      args: [id],
      actorIndex: activeAccountIndex,
      label: `Refund Transfer ${shortAddress(id)}`,
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <span>Challenge & Refund Center</span>
          <LayerBadge layer="L3" />
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Forta bots and guardians can challenge suspicious delayed transfers inside the 1-hour window, enabling sender refunds and blocking attacker finalization.
        </p>
      </div>

      {/* Challengeable transfers */}
      <div className="bg-[#121826] border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center justify-between">
          <span>Active Transfers Eligible for Challenge</span>
          <span className="text-xs bg-slate-800 text-slate-400 font-mono px-2 py-0.5 rounded">
            {challengeable.length} available
          </span>
        </h3>

        {challengeable.length === 0 ? (
          <div className="text-xs text-slate-500 font-mono py-4 text-center">
            No active pending or delayed transfers eligible for challenge.
          </div>
        ) : (
          <div className="space-y-3">
            {challengeable.map((t) => (
              <div
                key={t.id}
                className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs font-mono"
              >
                <div>
                  <span className="font-bold text-blue-400">{shortAddress(t.id)}</span>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    {t.netAmount} ETH &bull; State: <StateBadge state={t.state} />
                  </div>
                </div>

                <button
                  onClick={() => handleChallenge(t.id)}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Challenge as Bot/Guardian</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Refund Center */}
      <div className="bg-[#121826] border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center justify-between">
          <span>Challenged / Expired Transfers Ready for Refund</span>
          <span className="text-xs bg-slate-800 text-slate-400 font-mono px-2 py-0.5 rounded">
            {refundable.length} available
          </span>
        </h3>

        {refundable.length === 0 ? (
          <div className="text-xs text-slate-500 font-mono py-4 text-center">
            No transfers currently in refund state.
          </div>
        ) : (
          <div className="space-y-3">
            {refundable.map((t) => (
              <div
                key={t.id}
                className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs font-mono"
              >
                <div>
                  <span className="font-bold text-white">{shortAddress(t.id)}</span>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Sender: {shortAddress(t.sender)} &bull; Refund: {t.netAmount} ETH (Fee retained)
                  </div>
                </div>

                <button
                  onClick={() => handleRefund(t.id)}
                  className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Claim Refund</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
