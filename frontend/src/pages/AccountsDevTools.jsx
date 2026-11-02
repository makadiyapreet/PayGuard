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
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleTimeTravel(60)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 border border-slate-700"
          >
            +1 Min
          </button>
          <button
            onClick={() => handleTimeTravel(3600)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 border border-slate-700"
          >
            +1 Hour (Delay Window)
          </button>
          <button
            onClick={() => handleTimeTravel(86400)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 border border-slate-700"
          >
            +24 Hours (Daily Limit)
          </button>
          <button
            onClick={handleMine}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-lg shadow-blue-500/20"
          >
            Mine Block
          </button>
        </div>
      </div>

      {/* 15 Accounts Table */}
      <div className="bg-[#121826] border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
          Deterministic Ganache Accounts (15 Roles)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <th className="py-2.5 px-3">Idx</th>
                <th className="py-2.5 px-3">Role Label</th>
                <th className="py-2.5 px-3">Address</th>
                <th className="py-2.5 px-3">Balance (ETH)</th>
                <th className="py-2.5 px-3">Live Permissions</th>
                <th className="py-2.5 px-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {accounts.map((acc) => {
                const isSelected = activeAccountIndex === acc.index;
                const r = liveRoles[acc.address.toLowerCase()];

                return (
                  <tr
                    key={acc.index}
                    className={`hover:bg-slate-800/30 ${isSelected ? "bg-blue-600/10" : ""}`}
                  >
                    <td className="py-3 px-3 text-slate-400 font-bold">#{acc.index}</td>
                    <td className="py-3 px-3 text-white font-bold">{acc.meta.label}</td>
                    <td className="py-3 px-3 text-blue-400 select-all">{acc.address}</td>
                    <td className="py-3 px-3 font-bold text-slate-200">
                      {parseFloat(balances[acc.address.toLowerCase()] || "0").toFixed(2)} ETH
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex gap-1 flex-wrap text-[10px]">
                        {r?.isGuardian && <span className="text-purple-400 font-bold">[Guardian]</span>}
                        {r?.isNode && <span className="text-purple-400 font-bold">[RMN Node]</span>}
                        {r?.isBot && <span className="text-emerald-400 font-bold">[Bot]</span>}
                        {r?.isOwner && <span className="text-amber-400 font-bold">[Owner]</span>}
                        {r?.isBlacklisted && <span className="text-rose-400 font-bold">[Blacklisted]</span>}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => setActiveAccountIndex(acc.index)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
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
