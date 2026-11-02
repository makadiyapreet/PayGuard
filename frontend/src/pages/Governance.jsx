import React, { useState, useEffect } from "react";
import { useChainStore } from "../store/chainStore.js";
import { useAccountStore } from "../store/accountStore.js";
import { getContractInstance } from "../lib/chain.js";
import { sendTx } from "../lib/tx.js";
import { advanceTimeAndMine } from "../lib/time.js";
import { LayerBadge } from "../components/LayerBadge.jsx";
import { shortAddress } from "../lib/format.js";
import { Vote, CheckCircle2, Clock, Check, FastForward } from "lucide-react";

export function Governance() {
  const { contracts, refreshLiveState } = useChainStore();
  const { accounts, activeAccountIndex } = useAccountStore();

  const [proposals, setProposals] = useState([]);
  const [targetContract, setTargetContract] = useState("PaymentBridge");
  const [template, setTemplate] = useState("unpause");

  useEffect(() => {
    async function loadProposals() {
      try {
        const monitor = await getContractInstance("DefenderMonitor");
        const count = Number(await monitor.proposalCount());
        const list = [];
        for (let i = 0; i < count; i++) {
          const p = await monitor.getProposal(i);
          list.push({
            id: i,
            target: p.target,
            confirmations: Number(p.confirmations),
            eta: Number(p.eta),
            executed: p.executed,
            cancelled: p.cancelled,
            proposer: p.proposer,
          });
        }
        setProposals(list.reverse());
      } catch (err) {
        console.warn("Could not load proposals:", err);
      }
    }
    loadProposals();
  }, []);

  const handleCreateProposal = async () => {
    const bridge = contracts.PaymentBridge.address;
    const bridgeContract = await getContractInstance("PaymentBridge");
    const callData = bridgeContract.interface.encodeFunctionData("unpause", []);

    await sendTx({
      contractName: "DefenderMonitor",
      method: "submitProposal",
      args: [bridge, callData],
      actorIndex: activeAccountIndex,
      label: "Submit Unpause Proposal",
    });
    await refreshLiveState();
  };

  const handleConfirm = async (propId) => {
    await sendTx({
      contractName: "DefenderMonitor",
      method: "confirmProposal",
      args: [propId],
      actorIndex: activeAccountIndex,
      label: `Confirm Proposal #${propId}`,
    });
    await refreshLiveState();
  };

  const handleExecute = async (propId) => {
    await sendTx({
      contractName: "DefenderMonitor",
      method: "executeProposal",
      args: [propId],
      actorIndex: activeAccountIndex,
      label: `Execute Proposal #${propId}`,
    });
    await refreshLiveState();
  };

  const handleFastForwardTimelock = async () => {
    await advanceTimeAndMine(65);
    await refreshLiveState();
    alert("Chain time advanced +65 seconds! Timelock ready.");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Defender Multi-Sig & Timelock Governance</span>
            <LayerBadge layer="L3" />
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            2-of-3 Owner confirmations + 60s timelock required for all parameter changes, unpausing, and rule toggling.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleFastForwardTimelock}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors border border-amber-500/30"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>Fast-Forward Timelock (+65s)</span>
          </button>
        </div>
      </div>

      {/* Quick Action: Unpause Bridge */}
      <div className="bg-[#121826] border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">
          Create Governance Proposal (Acting as Owner O1–O3)
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          All administrative functions (unpause, uncurse, setLimits, addGuardian, resolveAlert) require an executed proposal.
        </p>

        <button
          onClick={handleCreateProposal}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors shadow-lg shadow-blue-500/20"
        >
          Submit "Unpause PaymentBridge" Proposal
        </button>
      </div>

      {/* Proposals List */}
      <div className="bg-[#121826] border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center justify-between">
          <span>Governance Proposal Board</span>
          <span className="text-xs bg-slate-800 text-slate-400 font-mono px-2 py-0.5 rounded">
            {proposals.length} proposals
          </span>
        </h3>

        {proposals.length === 0 ? (
          <div className="text-xs text-slate-500 font-mono py-8 text-center">
            No proposals found. Submit an unpause proposal above.
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((p) => (
              <div
                key={p.id}
                className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs font-mono"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-white">Proposal #{p.id}</span>
                    <span
                      className={`px-2 py-0.2 rounded text-[10px] font-bold uppercase ${
                        p.executed
                          ? "bg-emerald-500/15 text-emerald-300"
                          : p.cancelled
                          ? "bg-rose-500/15 text-rose-300"
                          : "bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      {p.executed ? "EXECUTED ✔" : p.cancelled ? "CANCELLED" : "QUEUED"}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Target: {shortAddress(p.target)} &bull; Confirmations: {p.confirmations}/2
                  </div>
                </div>

                {!p.executed && !p.cancelled && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleConfirm(p.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
                    >
                      Confirm (as Owner)
                    </button>
                    <button
                      onClick={() => handleExecute(p.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                    >
                      Execute Proposal
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
