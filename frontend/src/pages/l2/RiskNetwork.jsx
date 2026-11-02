import React, { useState, useEffect } from "react";
import { useChainStore } from "../../store/chainStore.js";
import { useAccountStore } from "../../store/accountStore.js";
import { useIndexerStore } from "../../store/indexerStore.js";
import { getContractInstance } from "../../lib/chain.js";
import { sendTx } from "../../lib/tx.js";
import { LayerBadge } from "../../components/LayerBadge.jsx";
import { shortAddress } from "../../lib/format.js";
import { ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Activity, Lock, Unlock } from "lucide-react";
import { Link } from "react-router-dom";

export function RiskNetwork() {
  const { cursed, refreshLiveState } = useChainStore();
  const { accounts, activeAccountIndex } = useAccountStore();
  const transfers = useIndexerStore((s) => s.transfers);
  const pendingTransfers = Object.values(transfers).filter((t) => t.state === 1);

  const [selectedId, setSelectedId] = useState("");
  const [digest, setDigest] = useState("");
  const [blessStatus, setBlessStatus] = useState({ r1: false, r2: false, count: 0 });
  const [curseVotes, setCurseVotes] = useState(0);
  const [curseReason, setCurseReason] = useState("COLLUSION_SUSPECTED");

  const r1Acc = accounts[6];
  const r2Acc = accounts[7];

  useEffect(() => {
    if (pendingTransfers.length > 0 && !selectedId) {
      setSelectedId(pendingTransfers[0].id);
    }
  }, [pendingTransfers]);

  useEffect(() => {
    async function loadData() {
      if (!selectedId) return;
      try {
        const bridge = await getContractInstance("PaymentBridge");
        const rmn = await getContractInstance("RiskManagement");
        const d = await bridge.getDigest(selectedId);
        setDigest(d);

        const [r1B, r2B, count, votes] = await Promise.all([
          r1Acc ? rmn.hasBlessed(selectedId, d, r1Acc.address) : false,
          r2Acc ? rmn.hasBlessed(selectedId, d, r2Acc.address) : false,
          rmn.blessCountOf(selectedId, d),
          rmn.curseVotesNow(),
        ]);

        setBlessStatus({ r1: r1B, r2: r2B, count: Number(count) });
        setCurseVotes(Number(votes));
      } catch (err) {
        console.warn("Could not query RMN states:", err);
      }
    }
    loadData();
  }, [selectedId, r1Acc, r2Acc]);

  const handleBless = async (nodeIndex) => {
    if (!selectedId || !digest) return;
    await sendTx({
      contractName: "RiskManagement",
      method: "bless",
      args: [selectedId, digest],
      actorIndex: nodeIndex,
      label: `RMN Node #${nodeIndex === 6 ? "1" : "2"} Bless Digest`,
    });
    await refreshLiveState();
  };

  const handleCurseVote = async (nodeIndex) => {
    await sendTx({
      contractName: "RiskManagement",
      method: "curse",
      args: [curseReason],
      actorIndex: nodeIndex,
      label: `RMN Node #${nodeIndex === 6 ? "1" : "2"} Cast Curse Vote`,
    });
    await refreshLiveState();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Chainlink CCIP Risk Management Network (RMN)</span>
            <LayerBadge layer="L2" />
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Independent secondary verification layer. Blesses valid transfers and can autonomously curse (halt) the bridge.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-lg text-xs font-bold font-mono border ${
              cursed
                ? "bg-purple-500/20 text-purple-300 border-purple-500/40 animate-pulse"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            }`}
          >
            {cursed ? "BRIDGE CURSED (HALTED)" : "RMN VERIFIER ACTIVE"}
          </span>
        </div>
      </div>

      {/* Select Transfer to Bless */}
      <div className="bg-[#121826] border border-slate-800 rounded-2xl p-5">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
          Select Pending Transfer to Bless:
        </label>
        {pendingTransfers.length === 0 ? (
          <div className="text-xs text-slate-500 font-mono py-2">
            No pending transfers awaiting blessing.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {pendingTransfers.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`p-3 rounded-xl border text-left font-mono text-xs transition-all ${
                  selectedId === t.id
                    ? "bg-purple-950/40 border-purple-500 text-white shadow-lg shadow-purple-500/10"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="font-bold text-white mb-1">{shortAddress(t.id)}</div>
                <div className="text-slate-400 text-[11px]">
                  {t.netAmount} ETH &bull; Recipient: {shortAddress(t.recipient)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2 RMN Nodes Verification Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Node 1 */}
        <div className="bg-[#121826] border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <span>RMN Node 1 (R1)</span>
                <span className="text-xs font-mono text-slate-500">Account #6</span>
              </span>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  blessStatus.r1
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {blessStatus.r1 ? "BLESSED ✔" : "AWAITING"}
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Independently re-computes transfer approval digest from raw event parameters before casting vote.
            </p>
          </div>

          <button
            onClick={() => handleBless(6)}
            disabled={blessStatus.r1 || !selectedId}
            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs transition-colors shadow-lg shadow-purple-500/20"
          >
            {blessStatus.r1 ? "Node 1 Already Blessed" : "Verify & Bless as Node 1"}
          </button>
        </div>

        {/* Node 2 */}
        <div className="bg-[#121826] border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <span>RMN Node 2 (R2)</span>
                <span className="text-xs font-mono text-slate-500">Account #7</span>
              </span>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  blessStatus.r2
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {blessStatus.r2 ? "BLESSED ✔" : "AWAITING"}
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Dual consensus requirement: Even if all 5 guardians sign, execution reverts without both RMN blessings.
            </p>
          </div>

          <button
            onClick={() => handleBless(7)}
            disabled={blessStatus.r2 || !selectedId}
            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs transition-colors shadow-lg shadow-purple-500/20"
          >
            {blessStatus.r2 ? "Node 2 Already Blessed" : "Verify & Bless as Node 2"}
          </button>
        </div>
      </div>

      {/* Emergency Cursing Panel */}
      <div className="bg-[#121826] border border-purple-500/30 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Emergency Curse Control (Autonomous Bridge Halt)
            </h3>
          </div>
          <span className="text-xs font-mono text-purple-300">
            Current Curse Votes: <strong>{curseVotes} / 2 Quorum</strong>
          </span>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          When RMN detects guardian key compromise or anomalous validator behavior, quorum curse halts all minting and refunds pending transfers.
        </p>

        <div className="flex gap-4 items-center flex-wrap">
          <input
            type="text"
            value={curseReason}
            onChange={(e) => setCurseReason(e.target.value)}
            placeholder="Curse reason..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono outline-none focus:border-purple-500"
          />

          <button
            onClick={() => handleCurseVote(6)}
            disabled={cursed}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs transition-colors"
          >
            Vote Curse (as R1)
          </button>

          <button
            onClick={() => handleCurseVote(7)}
            disabled={cursed}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs transition-colors"
          >
            Vote Curse (as R2)
          </button>

          {cursed && (
            <Link
              to="/governance"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors"
            >
              Uncurse via Governance &rarr;
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

