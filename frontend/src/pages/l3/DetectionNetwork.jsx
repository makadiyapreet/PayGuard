import React, { useState, useEffect } from "react";
import { useChainStore } from "../../store/chainStore.js";
import { useAccountStore } from "../../store/accountStore.js";
import { getContractInstance } from "../../lib/chain.js";
import { sendTx } from "../../lib/tx.js";
import { LayerBadge } from "../../components/LayerBadge.jsx";
import { shortAddress, formatEth } from "../../lib/format.js";
import { Bot, ShieldAlert, Award, AlertTriangle } from "lucide-react";

export function DetectionNetwork() {
  const { rewardPool, refreshLiveState } = useChainStore();
  const { accounts, activeAccountIndex } = useAccountStore();

  const [bots, setBots] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [transferId, setTransferId] = useState("");
  const [severity, setSeverity] = useState(2);
  const [evidence, setEvidence] = useState("COLLUSION_SUSPECTED");

  useEffect(() => {
    async function loadData() {
      try {
        const detection = await getContractInstance("DetectionNetwork");
        const bList = await detection.getBots();
        setBots(bList);

        const aList = await detection.getAlerts(0, 20);
        setAlerts(aList);
      } catch (err) {
        console.warn("Could not load detection data:", err);
      }
    }
    loadData();
  }, [rewardPool]);

  const handleRegisterBot = async () => {
    await sendTx({
      contractName: "DetectionNetwork",
      method: "registerBot",
      args: [],
      value: "1.0",
      actorIndex: activeAccountIndex,
      label: "Stake 1 ETH to Register Bot",
    });
    await refreshLiveState();
  };

  const handleRaiseAlert = async () => {
    if (!transferId) return;
    await sendTx({
      contractName: "DetectionNetwork",
      method: "raiseAlert",
      args: [transferId, severity, evidence],
      actorIndex: activeAccountIndex,
      label: `Raise Forta Alert (Severity ${severity})`,
    });
    await refreshLiveState();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Forta Decentralized Detection Network</span>
            <LayerBadge layer="L3" />
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Staked security bots monitor transactions off-chain, raise alerts, earn protocol rewards (10%), or get slashed (50%) for false reports.
          </p>
        </div>

        <button
          onClick={handleRegisterBot}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition-colors shadow-lg shadow-emerald-500/20"
        >
          <Bot className="w-4 h-4" />
          <span>Register Bot (Stake 1.0 ETH)</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#121826] border border-slate-800 rounded-2xl p-5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Available Reward Pool
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">
            {rewardPool} ETH
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Funded by 0.10% bridge fees + slashed stakes
          </div>
        </div>

        <div className="bg-[#121826] border border-slate-800 rounded-2xl p-5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Registered Bots
          </span>
          <div className="text-2xl font-bold font-mono text-white mt-2">
            {bots.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Minimum Stake: 1.0 ETH &bull; 24h unbond delay
          </div>
        </div>

        <div className="bg-[#121826] border border-slate-800 rounded-2xl p-5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Incentive Alignment
          </span>
          <div className="text-2xl font-bold font-mono text-purple-400 mt-2">
            +10% / -50%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Valid reward: 10% pool &bull; False slash: 50% stake
          </div>
        </div>
      </div>

      {/* Raise Alert Card */}
      <div className="bg-[#121826] border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-emerald-400" />
          <span>Raise Security Alert (Acting Bot)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Target Transfer ID (32 bytes)
            </label>
            <input
              type="text"
              value={transferId}
              onChange={(e) => setTransferId(e.target.value)}
              placeholder="0x..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Severity Level
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
            >
              <option value={1}>Severity 1: Low (-10 Risk pts)</option>
              <option value={2}>Severity 2: Medium (-20 Risk pts)</option>
              <option value={3}>Severity 3: High (-30 Risk pts)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Evidence String
            </label>
            <input
              type="text"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <button
          onClick={handleRaiseAlert}
          className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors"
        >
          Submit Alert to Network
        </button>
      </div>
    </div>
  );
}
