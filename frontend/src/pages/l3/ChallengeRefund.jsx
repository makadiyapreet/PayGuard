import React, { useState } from "react";
import { useIndexerStore } from "../../store/indexerStore.js";
import { useAccountStore } from "../../store/accountStore.js";
import { sendTx } from "../../lib/tx.js";
import { LayerBadge } from "../../components/LayerBadge.jsx";
import { StateBadge } from "../../components/StateBadge.jsx";
import { shortAddress } from "../../lib/format.js";
import { ShieldAlert, RotateCcw, AlertTriangle, ShieldCheck, UserCheck, Bot, Shield, Info } from "lucide-react";

export function ChallengeRefund() {
  const transfers = useIndexerStore((s) => s.transfers);
  const { activeAccountIndex, accounts } = useAccountStore();
  const transferList = Object.values(transfers);

  const [challengeReason, setChallengeReason] = useState("COLLUSION_OR_MALICIOUS_DELAY");
  const [selectedChallengerIndex, setSelectedChallengerIndex] = useState(8); // Default to Bot 1 (#8)

  // Filter transfers that can be challenged (state 1: Pending or state 2: Verified)
  const challengeable = transferList.filter((t) => t.state === 1 || t.state === 2);
  // Filter transfers that can be refunded (state 4: Challenged, or expired/cursed)
  const refundable = transferList.filter((t) => t.state === 4 || t.state === 1);

  const isCurrentAccountAuthorized = [1, 2, 3, 4, 5, 8, 9].includes(activeAccountIndex);

  const handleChallenge = async (id, forceCurrentAccount = false) => {
    // If forceCurrentAccount is true, use activeAccountIndex (e.g. to demonstrate revert if unauthorized)
    // Otherwise use selectedChallengerIndex (e.g. Bot 1 #8)
    const actor = forceCurrentAccount ? activeAccountIndex : selectedChallengerIndex;

    await sendTx({
      contractName: "PaymentBridge",
      method: "challenge",
      args: [id, challengeReason],
      actorIndex: actor,
      label: `Challenge Transfer ${shortAddress(id)} as #${actor}`,
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
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
          <span>Challenge & Refund Center</span>
          <LayerBadge layer="L3" />
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
          Forta bots and guardians can challenge suspicious transfers inside the 1-hour delay window, enabling sender refunds and blocking attacker mints.
        </p>
      </div>

      {/* Security Rule & Challenger Selector Banner */}
      <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-blue-950/20 border border-indigo-200 dark:border-blue-500/30 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-900 dark:text-white block">
              Access Control Enforcement: <code>PG:NOT_CHALLENGER</code>
            </span>
            <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
              Only registered <strong>Forta Bots (Accounts 8-9)</strong> or <strong>Wormhole Guardians (Accounts 1-5)</strong> can challenge transfers to prevent unauthorized griefing by random users.
            </p>
          </div>
        </div>

        {/* Challenger Identity Switcher */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-slate-800 px-3 py-1.5 rounded-xl shrink-0 shadow-sm">
          <Bot className="w-4 h-4 text-emerald-600" />
          <span className="text-[11px] font-semibold text-slate-500">Submit As:</span>
          <select
            value={selectedChallengerIndex}
            onChange={(e) => setSelectedChallengerIndex(Number(e.target.value))}
            className="bg-transparent text-xs font-bold text-slate-900 dark:text-white font-mono outline-none cursor-pointer"
          >
            <option value={8} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
              #8 Forta Bot 1 (0xACa94e...)
            </option>
            <option value={9} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
              #9 Forta Bot 2 (0x1dF62f...)
            </option>
            <option value={1} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
              #1 Guardian 1 (0xFFcf8F...)
            </option>
            <option value={activeAccountIndex} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
              #{activeAccountIndex} Current TopBar Account
            </option>
          </select>
        </div>
      </div>

      {/* Challengeable transfers */}
      <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <span>Active Transfers Eligible for Challenge</span>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-mono px-2 py-0.5 rounded">
              {challengeable.length} available
            </span>
          </h3>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Reason:</span>
            <input
              type="text"
              value={challengeReason}
              onChange={(e) => setChallengeReason(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white font-mono outline-none focus:border-rose-500"
            />
          </div>
        </div>

        {challengeable.length === 0 ? (
          <div className="text-xs text-slate-500 font-mono py-8 text-center">
            No active pending or delayed transfers eligible for challenge.
          </div>
        ) : (
          <div className="space-y-3">
            {challengeable.map((t) => (
              <div
                key={t.id}
                className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs font-mono flex-wrap gap-3 shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-700 dark:text-blue-400 text-sm">{shortAddress(t.id)}</span>
                    <StateBadge state={t.state} />
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-1">
                    Amount: <strong className="text-slate-900 dark:text-white">{t.netAmount} ETH</strong> &bull; Sender: {shortAddress(t.sender)} &bull; Recipient: {shortAddress(t.recipient)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleChallenge(t.id, false)}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-rose-500/20"
                    title={`Challenges this transfer as authorized actor #${selectedChallengerIndex}`}
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Challenge Transfer</span>
                  </button>

                  <button
                    onClick={() => handleChallenge(t.id, true)}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
                    title="Challenges using your current TopBar account to demonstrate security revert"
                  >
                    Demo Unauthorized Revert
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Refund Center */}
      <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center justify-between">
          <span>Challenged / Expired Transfers Ready for Refund</span>
          <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-mono px-2 py-0.5 rounded">
            {refundable.length} available
          </span>
        </h3>

        {refundable.length === 0 ? (
          <div className="text-xs text-slate-500 font-mono py-8 text-center">
            No transfers currently in refund state. Challenge a transfer above to make it refundable.
          </div>
        ) : (
          <div className="space-y-3">
            {refundable.map((t) => (
              <div
                key={t.id}
                className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs font-mono flex-wrap gap-3 shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">{shortAddress(t.id)}</span>
                    <StateBadge state={t.state} />
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-1">
                    Sender: {shortAddress(t.sender)} &bull; Refundable Amount: <strong className="text-emerald-700 dark:text-emerald-400">{t.netAmount} ETH</strong> (Protocol fee retained)
                  </div>
                </div>

                <button
                  onClick={() => handleRefund(t.id)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-indigo-500/20"
                >
                  <RotateCcw className="w-4 h-4" />
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
