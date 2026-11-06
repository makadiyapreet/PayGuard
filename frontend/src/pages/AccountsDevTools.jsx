import React from "react";
import { useAccountStore } from "../store/accountStore.js";
import { useChainStore } from "../store/chainStore.js";
import { advanceTimeAndMine, mineBlock } from "../lib/time.js";
import { shortAddress } from "../lib/format.js";
import { Wrench, Clock, Users, ArrowUpRight } from "lucide-react";

export function AccountsDevTools() {
  const { accounts, activeAccountIndex, setActiveAccountIndex, balances, liveRoles, refreshBalances } =
    useAccountStore();
  const { refreshLiveState } = useChainStore();

  const handleTimeTravel = async (sec) => {
    await advanceTimeAndMine(sec);
    await refreshLiveState();
    await refreshBalances();
    alert(`Fast-forwarded chain time +${sec}s and mined new block!`);
  };

  const handleMine = async () => {
    await mineBlock();
    await refreshLiveState();
    await refreshBalances();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Accounts & EVM Dev Tools</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Local Ganache state manipulation: 15-account role switchboard and time-travel controls.
          </p>
        </div>

        {/* Time Travel Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleTimeTravel(60)}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-mono text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-bold shadow-sm transition-colors"
          >
            +1 Min
          </button>
          <button
            onClick={() => handleTimeTravel(3600)}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-mono text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-bold shadow-sm transition-colors"
          >
            +1 Hour (Delay Window)
          </button>
          <button
            onClick={() => handleTimeTravel(86400)}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-mono text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-bold shadow-sm transition-colors"
          >
            +24 Hours (Daily Limit)
          </button>
          <button
            onClick={handleMine}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-colors"
          >
            Mine Block
          </button>
        </div>
      </div>

      {/* 15 Accounts Table */}
      <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
          Deterministic Ganache Accounts (15 Roles)
        </h3>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <tr className="text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-3.5">Idx</th>
                <th className="py-3 px-3.5">Role Label</th>
                <th className="py-3 px-3.5">Address</th>
                <th className="py-3 px-3.5">Balance (ETH)</th>
                <th className="py-3 px-3.5">Live Permissions</th>
                <th className="py-3 px-3.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-transparent">
              {accounts.map((acc) => {
                const isSelected = activeAccountIndex === acc.index;
                const r = liveRoles[acc.address.toLowerCase()];

                return (
                  <tr
                    key={acc.index}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${isSelected ? "bg-blue-50/80 dark:bg-blue-600/10" : ""}`}
                  >
                    <td className="py-3 px-3.5 text-slate-700 dark:text-slate-400 font-bold">#{acc.index}</td>
                    <td className="py-3 px-3.5 text-slate-900 dark:text-white font-bold">{acc.meta.label}</td>
                    <td className="py-3 px-3.5 text-blue-700 dark:text-blue-400 select-all font-semibold">{acc.address}</td>
                    <td className="py-3 px-3.5 font-bold text-slate-900 dark:text-slate-200">
                      {parseFloat(balances[acc.address.toLowerCase()] || "0").toFixed(2)} ETH
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="flex gap-1.5 flex-wrap text-[10px]">
                        {r?.isGuardian && <span className="text-purple-700 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-200">[Guardian]</span>}
                        {r?.isNode && <span className="text-purple-700 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-200">[RMN Node]</span>}
                        {r?.isBot && <span className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200">[Bot]</span>}
                        {r?.isOwner && <span className="text-amber-800 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200">[Owner]</span>}
                        {r?.isBlacklisted && <span className="text-rose-700 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200">[Blacklisted]</span>}
                      </div>
                    </td>
                    <td className="py-3 px-3.5">
                      <button
                        onClick={() => setActiveAccountIndex(acc.index)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-bold"
                        }`}
                      >
                        {isSelected ? "Active" : "Select"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

