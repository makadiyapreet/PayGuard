import React, { useState, useEffect } from "react";
import { useChainStore } from "../../store/chainStore.js";
import { useAccountStore } from "../../store/accountStore.js";
import { getContractInstance } from "../../lib/chain.js";
import { sendTx } from "../../lib/tx.js";
import { LayerBadge } from "../../components/LayerBadge.jsx";
import { shortAddress, formatEth } from "../../lib/format.js";
import { Radio, AlertTriangle, ShieldCheck, UserX, Shield, Play } from "lucide-react";
import { Link } from "react-router-dom";

export function DefenderMonitor() {
  const { paused, refreshLiveState } = useChainStore();
  const { accounts, activeAccountIndex } = useAccountStore();

  const [rules, setRules] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [userQuery, setUserQuery] = useState("");
  const [userStats, setUserStats] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const monitor = await getContractInstance("DefenderMonitor");
        const rList = await monitor.getRules();
        setRules(rList);

        const incList = await monitor.getIncidents(0, 20);
        setIncidents(incList);
      } catch (err) {
        console.warn("Could not load DefenderMonitor data:", err);
      }
    }
    loadData();
  }, [paused]);

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

  const handleLookupUser = async () => {
    if (!userQuery) return;
    try {
      const monitor = await getContractInstance("DefenderMonitor");
      const st = await monitor.getUserStats(userQuery);
      setUserStats(st);
    } catch (err) {
      alert(`User lookup failed: ${err.message}`);
    }
  };

  const RULE_NAMES = ["LARGE_AMOUNT", "VELOCITY", "RAPID_REDEEM", "NEW_ADDRESS_LARGE"];
  const ACTION_NAMES = ["ALERT", "PAUSE", "BLACKLIST"];

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>OpenZeppelin Defender Monitor</span>
            <LayerBadge layer="L3" />
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Automated reactive security rules, velocity monitoring, emergency pausing, and multi-sig timelock governance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!paused ? (
            <button
              onClick={handleEmergencyPause}
              className="px-4 py-2 rounded-xl bg-rose-600/20 border border-rose-500/40 hover:bg-rose-600/30 text-rose-300 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Trigger Emergency Pause</span>
            </button>
          ) : (
            <Link
              to="/governance"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors"
            >
              Unpause Bridge via Multi-Sig Proposal &rarr;
            </Link>
          )}
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-[#121826] border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>Active Automated Defender Rules</span>
          <span className="text-xs bg-slate-800 text-slate-400 font-mono px-2 py-0.5 rounded">
            {rules.length} rules
          </span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <th className="py-2.5 px-3">Rule ID</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Threshold</th>
                <th className="py-2.5 px-3">Window</th>
                <th className="py-2.5 px-3">Automated Action</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rules.map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30">
                  <td className="py-3 px-3 text-slate-400 font-bold">#{idx}</td>
                  <td className="py-3 px-3 text-blue-400 font-bold">
                    {RULE_NAMES[Number(r.ruleType)] || "CUSTOM"}
                  </td>
                  <td className="py-3 px-3 text-white">
                    {Number(r.ruleType) === 1 ? `${r.threshold} txs` : `${formatEth(r.threshold)} ETH`}
                  </td>
                  <td className="py-3 px-3 text-slate-300">
                    {Number(r.window) > 0 ? `${r.window}s` : "Per-Tx"}
                  </td>
                  <td className="py-3 px-3 font-bold text-amber-400">
                    {ACTION_NAMES[Number(r.action)] || "ALERT"}
                  </td>
                  <td className="py-3 px-3">
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                      ACTIVE
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Incidents Feed */}
      <div className="bg-[#121826] border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>Logged Security Incidents</span>
          <span className="text-xs bg-slate-800 text-slate-400 font-mono px-2 py-0.5 rounded">
            {incidents.length} events
          </span>
        </h3>

        {incidents.length === 0 ? (
          <div className="text-xs text-slate-500 font-mono py-4 text-center">
            No incidents logged yet. Try depositing &ge; 8 ETH or rapid redeem to trigger a rule.
          </div>
        ) : (
          <div className="space-y-2">
            {incidents.map((inc, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs font-mono"
              >
                <div>
                  <span className="font-bold text-amber-400">
                    Rule #{inc.ruleId} ({RULE_NAMES[Number(inc.ruleId)] || "RULE"}):
                  </span>{" "}
                  <span className="text-white">User {shortAddress(inc.user)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">{formatEth(inc.amount)} ETH</span>
                  <span className="bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-bold text-[10px]">
                    {ACTION_NAMES[Number(inc.action)] || "ALERT"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

