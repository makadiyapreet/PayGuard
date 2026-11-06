import React from "react";
import { useChainStore } from "../../store/chainStore.js";
import { useAccountStore } from "../../store/accountStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { StatusLight } from "../../components/StatusLight.jsx";
import { shortAddress, formatDateTime } from "../../lib/format.js";
import { Shield, Users, Radio, HelpCircle, Monitor, Sun, Moon } from "lucide-react";

export function TopBar() {
  const { connected, blockNumber, chainId, chainTime, paused, cursed, riskScore, riskBand, perTxLimitEff } =
    useChainStore();
  const { accounts, activeAccountIndex, setActiveAccountIndex, balances, liveRoles } =
    useAccountStore();
  const { auditMode, toggleAuditMode, presentationMode, togglePresentationMode, theme, toggleTheme } = useUiStore();

  const currentAccount = accounts[activeAccountIndex];
  const activeRoles = currentAccount ? liveRoles[currentAccount.address.toLowerCase()] : null;

  return (
    <header className="bg-white dark:bg-[#101524] border-b border-slate-200 dark:border-slate-800 px-5 py-2.5 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-sm">
      {/* Brand */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-extrabold text-lg">
          🛡️
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-base tracking-tight text-slate-900 dark:bg-gradient-to-r dark:from-blue-400 dark:to-purple-400 dark:bg-clip-text dark:text-transparent">
              PayGuard Control Center
            </h1>
            <span className="text-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 font-bold px-1.5 py-0.2 rounded uppercase">
              V1.0
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">Layered Payment-Integrity Bridge</p>
        </div>
      </div>

      {/* Center status chips */}
      <div className="hidden lg:flex items-center gap-3">
        {/* Network & Block */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono shadow-sm">
          <StatusLight status={connected ? "ok" : "err"} />
          <span className="text-slate-700 dark:text-slate-400 font-bold">Ganache:{chainId}</span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span className="text-slate-900 dark:text-slate-300 font-bold">#{blockNumber}</span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span className="text-slate-600 dark:text-slate-400 font-semibold">{formatDateTime(chainTime)}</span>
        </div>

        {/* Global Security Flags */}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border shadow-sm ${
              paused
                ? "bg-rose-100 text-rose-950 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40 animate-pulse"
                : "bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
            }`}
          >
            {paused ? "HALTED (PAUSED)" : "BRIDGE ACTIVE"}
          </span>

          {cursed && (
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg border bg-purple-100 text-purple-950 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40 animate-pulse shadow-sm">
              RMN CURSED
            </span>
          )}

          {/* Risk Band & Score */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono shadow-sm">
            <span className="text-slate-700 dark:text-slate-400 font-bold">Risk:</span>
            <span
              className={`font-black ${
                riskScore >= 80 ? "text-emerald-700 dark:text-emerald-400" : riskScore >= 50 ? "text-amber-800 dark:text-amber-400" : "text-rose-700 dark:text-rose-400"
              }`}
            >
              {riskScore}/100
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="text-slate-700 dark:text-slate-400 font-bold">Limit:</span>
            <span className="text-blue-700 dark:text-blue-400 font-black">{perTxLimitEff} ETH</span>
          </div>
        </div>
      </div>

      {/* Right controls: Acting-As Switcher + Toggles */}
      <div className="flex items-center gap-2.5">
        {/* Light / Dark Theme toggle */}
        <button
          onClick={toggleTheme}
          className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm ${
            theme === "light"
              ? "bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200"
              : "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
          }`}
          title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
        >
          {theme === "light" ? <Sun className="w-4 h-4 text-amber-600" /> : <Moon className="w-4 h-4 text-blue-400" />}
          <span className="hidden md:inline capitalize">{theme}</span>
        </button>

        {/* Audit Mode & Presentation toggles */}
        <button
          onClick={toggleAuditMode}
          className={`p-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-colors shadow-sm ${
            auditMode
              ? "bg-purple-100 border-purple-300 text-purple-950 dark:bg-purple-600/20 dark:border-purple-500 dark:text-purple-300"
              : "bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-white"
          }`}
          title="Audit Mode: highlights which IA1 research weakness each component solves"
        >
          <HelpCircle className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="hidden xl:inline">Audit Mode</span>
        </button>

        <button
          onClick={togglePresentationMode}
          className={`p-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-colors shadow-sm ${
            presentationMode
              ? "bg-blue-100 border-blue-300 text-blue-950 dark:bg-blue-600/20 dark:border-blue-500 dark:text-blue-300"
              : "bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-white"
          }`}
          title="Presentation Mode: projector-friendly high-contrast views"
        >
          <Monitor className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </button>

        {/* Acting As Account Selector */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-1.5 shadow-sm">
          <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                Acting As:
              </span>
              <select
                value={activeAccountIndex}
                onChange={(e) => setActiveAccountIndex(Number(e.target.value))}
                className="bg-transparent text-slate-900 dark:text-white font-bold text-xs outline-none cursor-pointer border-none p-0 pr-2 font-mono"
              >
                {accounts.map((acc) => (
                  <option key={acc.index} value={acc.index} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono">
                    #{acc.index} {acc.meta.label} ({shortAddress(acc.address)})
                  </option>
                ))}
              </select>
            </div>

            {currentAccount && (
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-700 dark:text-slate-400 font-semibold mt-0.5">
                <span>Bal: {parseFloat(balances[currentAccount.address.toLowerCase()] || "0").toFixed(2)} ETH</span>
                {activeRoles?.isGuardian && <span className="text-purple-400 font-bold">[Guardian]</span>}
                {activeRoles?.isNode && <span className="text-purple-400 font-bold">[RMN Node]</span>}
                {activeRoles?.isBot && <span className="text-emerald-400 font-bold">[Bot]</span>}
                {activeRoles?.isOwner && <span className="text-amber-400 font-bold">[Gov Owner]</span>}
                {activeRoles?.isBlacklisted && <span className="text-rose-400 font-bold">[Blacklisted]</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

