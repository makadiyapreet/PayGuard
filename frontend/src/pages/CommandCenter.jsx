import React from "react";
import { useChainStore } from "../store/chainStore.js";
import { useIndexerStore } from "../store/indexerStore.js";
import { useAccountStore } from "../store/accountStore.js";
import { LayerBadge } from "../components/LayerBadge.jsx";
import { StatusLight } from "../components/StatusLight.jsx";
import { RiskGauge } from "../components/RiskGauge.jsx";
import { EthAmount } from "../components/EthAmount.jsx";
import { sendTx } from "../lib/tx.js";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Shield,
  Activity,
  Layers,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Camera
} from "lucide-react";

export function CommandCenter() {
  const {
    bridgeBalance,
    tokenSupply,
    paused,
    cursed,
    riskScore,
    riskBand,
    perTxLimitEff,
    rewardPool,
    refreshLiveState
  } = useChainStore();

  const { activeAccountIndex } = useAccountStore();
  const events = useIndexerStore((s) => s.events);
  const transfers = useIndexerStore((s) => s.transfers);
  const transferList = Object.values(transfers);

  const pendingCount = transferList.filter((t) => t.state === 1).length;
  const verifiedCount = transferList.filter((t) => t.state === 2).length;
  const executedCount = transferList.filter((t) => t.state === 3).length;

  const handleEmergencyPause = async () => {
    await sendTx({
      contractName: "DefenderMonitor",
      method: "emergencyPause",
      args: [],
      actorIndex: activeAccountIndex,
      label: "Emergency Pause Bridge",
    });
    await refreshLiveState();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Page Title & Status */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>PayGuard Command Center</span>
            <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-mono">
              Live Layer Telemetry
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time security lifecycle: Before Execution (L1) → At Consensus (L2) → After Deployment (L3).
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <Link
            to="/transfers"
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
          >
            <span>Initiate Transfer</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          {!paused ? (
            <button
              onClick={handleEmergencyPause}
              className="px-3 py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/40 hover:bg-rose-600/30 text-rose-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Emergency Pause</span>
            </button>
          ) : (
            <Link
              to="/governance"
              className="px-3 py-1.5 rounded-lg bg-amber-600/20 border border-amber-500/40 hover:bg-amber-600/30 text-amber-300 text-xs font-semibold transition-colors"
            >
              Unpause Proposal
            </Link>
          )}
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
            <span>Bridge Vault ETH</span>
            <LayerBadge layer="CORE" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-2">
            <EthAmount value={bridgeBalance} decimals={3} />
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Wrapped Supply: <EthAmount value={tokenSupply} symbol="pgETH" decimals={3} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
            <span>Dynamic Per-Tx Limit</span>
            <LayerBadge layer="L1" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-2">
            {perTxLimitEff} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">ETH</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Base Limit: 10 ETH &bull; Throttled by Risk Band
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
            <span>Consensus Quorum</span>
            <LayerBadge layer="L2" />
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-purple-400 mt-2">
            3-of-5 <span className="text-xs font-normal text-slate-500 dark:text-slate-400">& 2-of-2 RMN</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {cursed ? (
              <span className="text-rose-600 dark:text-rose-400 font-bold">Cursed by RMN</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">Consensus Nominal</span>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
            <span>Forta Reward Pool</span>
            <LayerBadge layer="L3" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-2">
            <EthAmount value={rewardPool} decimals={4} />
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Funded by 0.10% bridge fee & slashing
          </div>
        </div>
      </div>

      {/* Layer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Layer 1 Card */}
        <div className="bg-white dark:bg-[#121826] border border-blue-200 dark:border-blue-500/20 rounded-2xl p-5 flex flex-col justify-between hover:border-blue-400 dark:hover:border-blue-500/40 transition-all shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Layer 1: Pre-Execution Gate
              </span>
              <StatusLight status="ok" label="SOLVENT" />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              Formal invariant enforcement: Bridge locked ETH &ge; pgETH supply. Multi-tier limits shrink dynamically as risk score drops.
            </p>
            <div className="space-y-2 text-xs font-mono bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Solvency Status:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {parseFloat(bridgeBalance) >= parseFloat(tokenSupply) ? "✔ Backed 1:1" : "✘ Breached"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Effective Per-Tx:</span>
                <span className="text-slate-900 dark:text-white font-semibold">{perTxLimitEff} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">User Daily Limit:</span>
                <span className="text-slate-900 dark:text-white font-semibold">{riskBand === 0 ? "20" : riskBand === 1 ? "10" : "2"} ETH</span>
              </div>
            </div>
          </div>
          <Link
            to="/l1/gate"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors"
          >
            <span>Explore Pre-Execution Invariants</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Layer 2 Card */}
        <div className="bg-white dark:bg-[#121826] border border-indigo-200 dark:border-purple-500/20 rounded-2xl p-5 flex flex-col justify-between hover:border-indigo-400 dark:hover:border-purple-500/40 transition-all shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-purple-400">
                Layer 2: At Consensus
              </span>
              <StatusLight status={cursed ? "err" : "ok"} label={cursed ? "CURSED" : "ACTIVE"} />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              Dual consensus validation: Wormhole t-of-n guardian multi-sig (sorted signers) + Chainlink CCIP independent RMN blessing.
            </p>
            <div className="space-y-2 text-xs font-mono bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Guardian Quorum:</span>
                <span className="text-slate-900 dark:text-white font-semibold">3 of 5 (Wormhole)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">RMN Blessing:</span>
                <span className="text-slate-900 dark:text-white font-semibold">2 of 2 (CCIP)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Awaiting Sigs:</span>
                <span className="text-amber-600 dark:text-amber-400 font-bold">{pendingCount} transfers</span>
              </div>
            </div>
          </div>
          <Link
            to="/l2/guardians"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-purple-400 hover:text-indigo-500 transition-colors"
          >
            <span>Open L2 Approval Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Layer 3 Card */}
        <div className="bg-white dark:bg-[#121826] border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-5 flex flex-col justify-between hover:border-emerald-400 dark:hover:border-emerald-500/40 transition-all shadow-sm">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Layer 3: Defending & Response
              </span>
              <StatusLight status={paused ? "warn" : "ok"} label={paused ? "PAUSED" : "MONITORING"} />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              Post-deployment threat detection: OZ Defender automated rules (Velocity, Rapid Redeem), Forta bot alert slashing, and CertiK risk score.
            </p>
            <div className="space-y-2 text-xs font-mono bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Defender Pause:</span>
                <span className={paused ? "text-rose-600 dark:text-rose-400 font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
                  {paused ? "HALTED" : "RUNNING"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Forta Staked Bots:</span>
                <span className="text-slate-900 dark:text-white font-semibold">2 Active Bots</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Governance Timelock:</span>
                <span className="text-slate-900 dark:text-white font-semibold">60s (2-of-3 multi-sig)</span>
              </div>
            </div>
          </div>
          <Link
            to="/l3/defender"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors"
          >
            <span>Open Defender & Detection</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Middle Grid: Risk Gauge & Interactive Architecture Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <RiskGauge score={riskScore} />
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400">
              Cross-Chain Verification Pipeline
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Total Transfers: {transferList.length}
            </span>
          </div>

          {/* Interactive Flow Visual */}
          <div className="grid grid-cols-5 gap-2 my-4 text-center">
            <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col items-center shadow-sm">
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">1. DEPOSIT</span>
              <span className="text-xs font-mono text-slate-900 dark:text-white mt-1 font-bold">L1 Gate Check</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Limits & Blacklist</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col items-center shadow-sm">
              <span className="text-[10px] text-indigo-600 dark:text-purple-400 font-bold">2. GUARDIANS</span>
              <span className="text-xs font-mono text-slate-900 dark:text-white mt-1 font-bold">3/5 Wormhole</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Sorted ECDSA</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col items-center shadow-sm">
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">3. RMN BLESS</span>
              <span className="text-xs font-mono text-slate-900 dark:text-white mt-1 font-bold">2/2 CCIP Quorum</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Independent 2nd</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col items-center shadow-sm">
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">4. EXECUTE</span>
              <span className="text-xs font-mono text-slate-900 dark:text-white mt-1 font-bold">Mint pgETH</span>
              <span className="text-[10px] text-slate-500 mt-0.5">1h delay if &ge;5 ETH</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col items-center shadow-sm">
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">5. DEFEND</span>
              <span className="text-xs font-mono text-slate-900 dark:text-white mt-1 font-bold">Forta & Rules</span>
              <span className="text-[10px] text-slate-500 mt-0.5">Challenge & Pause</span>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-200 dark:border-slate-800 font-mono">
            <span>Pending: <strong className="text-amber-600 dark:text-amber-400">{pendingCount}</strong></span>
            <span>Delayed (Verified): <strong className="text-blue-600 dark:text-blue-400">{verifiedCount}</strong></span>
            <span>Executed: <strong className="text-emerald-600 dark:text-emerald-400">{executedCount}</strong></span>
          </div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Recent Unified Cross-Layer Events
            </h3>
          </div>
          <Link to="/event-log" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
            View All Events &rarr;
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 font-mono">
            No events indexed yet. Deposit or run a demo scenario to see live chain activity.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800/60 max-h-60 overflow-y-auto">
            {events.slice(0, 8).map((ev, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-500 text-[11px]">#{ev.blockNumber}</span>
                  <span className="font-mono text-blue-700 dark:text-blue-300 font-semibold">{ev.contractName}</span>
                  <span className="font-semibold text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                    {ev.event}
                  </span>
                </div>
                <span className="font-mono text-slate-500 text-[11px]">
                  Tx: {ev.transactionHash?.slice(0, 8)}...
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

