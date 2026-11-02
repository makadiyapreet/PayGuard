import React, { useState, useEffect } from "react";
import { useChainStore } from "../../store/chainStore.js";
import { useAccountStore } from "../../store/accountStore.js";
import { useIndexerStore } from "../../store/indexerStore.js";
import { getContractInstance } from "../../lib/chain.js";
import { signDigestWithSigner, sortSignaturesBySigner } from "../../lib/sign.js";
import { getSignerForAccount } from "../../lib/wallets.js";
import { sendTx } from "../../lib/tx.js";
import { LayerBadge } from "../../components/LayerBadge.jsx";
import { shortAddress } from "../../lib/format.js";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Check,
  Shield,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  Activity,
  ArrowRight,
  PlusCircle,
  FileCheck,
  ShieldCheck,
  Layers
} from "lucide-react";
import { Link } from "react-router-dom";

export function GuardiansApproval() {
  const { chainId, contracts, refreshLiveState } = useChainStore();
  const { accounts, activeAccountIndex, refreshBalances } = useAccountStore();
  const transfers = useIndexerStore((s) => s.transfers);
  const pendingTransfers = Object.values(transfers).filter((t) => t.state === 1);

  const [selectedId, setSelectedId] = useState("");
  const [digest, setDigest] = useState("");
  const [signatures, setSignatures] = useState({}); // accIndex -> { signer, sig, recovered }
  const [tamperUnsorted, setTamperUnsorted] = useState(false);
  const [tamperNonGuardian, setTamperNonGuardian] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);

  // RMN Status for the selected transfer
  const [isRmnBlessed, setIsRmnBlessed] = useState(false);
  const [rmnBlessCount, setRmnBlessCount] = useState(0);

  // Show guide toggle
  const [showGuide, setShowGuide] = useState(true);

  // 1-Click execution state
  const [runningAuto, setRunningAuto] = useState(false);
  const [autoStatus, setAutoStatus] = useState("");

  // Guardians: indices 1 to 5
  const guardianIndices = [1, 2, 3, 4, 5];

  useEffect(() => {
    if (pendingTransfers.length > 0 && (!selectedId || !pendingTransfers.find((t) => t.id === selectedId))) {
      setSelectedId(pendingTransfers[0].id);
    }
  }, [pendingTransfers, selectedId]);

  useEffect(() => {
    async function loadData() {
      if (!selectedId) {
        setDigest("");
        setIsRmnBlessed(false);
        setRmnBlessCount(0);
        return;
      }
      try {
        const bridge = await getContractInstance("PaymentBridge");
        const rmn = await getContractInstance("RiskManagement");
        const d = await bridge.getDigest(selectedId);
        setDigest(d);
        setSignatures({});
        setPreviewResult(null);

        // Check RMN status
        const blessed = await rmn.isBlessed(selectedId, d);
        const count = await rmn.blessCountOf(selectedId, d);
        setIsRmnBlessed(blessed);
        setRmnBlessCount(Number(count));
      } catch (err) {
        console.warn("Could not fetch digest or RMN status:", err);
      }
    }
    loadData();
  }, [selectedId]);

  // Sign with an individual guardian
  const handleSign = async (accIndex) => {
    if (!digest) return;
    try {
      const signer = await getSignerForAccount(accIndex);
      const res = await signDigestWithSigner(signer, digest);
      setSignatures((prev) => ({ ...prev, [accIndex]: res }));
    } catch (err) {
      alert(`Signing failed: ${err.message}`);
    }
  };

  // Sign with first 3 guardians (Quorum)
  const handleSignWithThree = async () => {
    if (!digest) return;
    for (const idx of [1, 2, 3]) {
      await handleSign(idx);
    }
  };

  // Sign with all 5 guardians
  const handleSignWithAll = async () => {
    if (!digest) return;
    for (const idx of guardianIndices) {
      await handleSign(idx);
    }
  };

  // Clear signatures
  const handleClearSigs = () => {
    setSignatures({});
    setPreviewResult(null);
  };

  // Auto-Bless with RMN (2/2 nodes)
  const handleAutoBlessRmn = async () => {
    if (!selectedId || !digest) return;
    setAutoStatus("Blessing with RMN Node 1 (#6)...");
    await sendTx({
      contractName: "RiskManagement",
      method: "bless",
      args: [selectedId, digest],
      actorIndex: 6,
      label: "RMN Node 1 Bless",
    });

    setAutoStatus("Blessing with RMN Node 2 (#7)...");
    await sendTx({
      contractName: "RiskManagement",
      method: "bless",
      args: [selectedId, digest],
      actorIndex: 7,
      label: "RMN Node 2 Bless",
    });

    setIsRmnBlessed(true);
    setRmnBlessCount(2);
    setAutoStatus("");
  };

  // Quick create a sample transfer if none exist
  const handleCreateSampleTransfer = async () => {
    setAutoStatus("Creating sample deposit of 2.0 ETH...");
    try {
      await sendTx({
        contractName: "PaymentBridge",
        method: "deposit",
        args: [accounts[activeAccountIndex]?.address || accounts[13]?.address],
        value: "2.0",
        actorIndex: activeAccountIndex,
        label: "Sample 2.0 ETH Deposit",
      });
      await refreshLiveState();
      await refreshBalances();
    } catch (err) {
      alert(`Could not create transfer: ${err.message}`);
    } finally {
      setAutoStatus("");
    }
  };

  // 1-Click Sign (3) + Bless (2) + Execute
  const handleOneClickFullApprove = async () => {
    if (!selectedId || !digest) return;
    setRunningAuto(true);
    try {
      setAutoStatus("1/3: Collecting 3 Guardian signatures...");
      const g1 = await getSignerForAccount(1);
      const g2 = await getSignerForAccount(2);
      const g3 = await getSignerForAccount(3);

      const s1 = await signDigestWithSigner(g1, digest);
      const s2 = await signDigestWithSigner(g2, digest);
      const s3 = await signDigestWithSigner(g3, digest);
      const signedMap = { 1: s1, 2: s2, 3: s3 };
      setSignatures(signedMap);

      const sortedSigs = sortSignaturesBySigner([s1, s2, s3]).map((s) => s.sig);

      setAutoStatus("2/3: Blessing with RMN Nodes R1 & R2...");
      await sendTx({
        contractName: "RiskManagement",
        method: "bless",
        args: [selectedId, digest],
        actorIndex: 6,
        label: "RMN Node 1 Bless",
      });
      await sendTx({
        contractName: "RiskManagement",
        method: "bless",
        args: [selectedId, digest],
        actorIndex: 7,
        label: "RMN Node 2 Bless",
      });
      setIsRmnBlessed(true);
      setRmnBlessCount(2);

      setAutoStatus("3/3: Executing transfer on destination bridge...");
      await sendTx({
        contractName: "PaymentBridge",
        method: "execute",
        args: [selectedId, sortedSigs],
        actorIndex: activeAccountIndex,
        label: "Execute Verified Transfer",
      });

      await refreshLiveState();
      await refreshBalances();
      setAutoStatus("✔ Transfer Executed Successfully!");
    } catch (err) {
      setAutoStatus(`Error: ${err.message}`);
    } finally {
      setTimeout(() => {
        setRunningAuto(false);
        setAutoStatus("");
      }, 3500);
    }
  };

  // Run previewExecute introspection
  const handlePreviewExecute = async () => {
    if (!selectedId || !digest) return;
    try {
      let sigList = Object.values(signatures);

      if (!tamperUnsorted) {
        sigList = sortSignaturesBySigner(sigList);
      }

      if (tamperNonGuardian) {
        const attackerSigner = await getSignerForAccount(14);
        const attackerSig = await signDigestWithSigner(attackerSigner, digest);
        sigList.push(attackerSig);
      }

      const sigBytes = sigList.map((s) => s.sig);
      const bridge = await getContractInstance("PaymentBridge");
      const res = await bridge.previewExecute(selectedId, sigBytes);

      setPreviewResult({
        ok: res.ok,
        layer: Number(res.layer),
        reason: res.reason,
      });
    } catch (err) {
      setPreviewResult({ ok: false, layer: 0, reason: err.message });
    }
  };

  // Execute on-chain
  const handleExecute = async (force = false) => {
    let sigList = Object.values(signatures);

    if (!force && sigList.length < 3) {
      alert("Wormhole consensus requires at least 3 guardian signatures. Click 'Sign Quorum (3 Guardians)' first.");
      return;
    }

    if (!force && !isRmnBlessed) {
      alert("Chainlink CCIP RMN requires 2 node blessings before execution. Click 'Bless with RMN (2/2)' above first.");
      return;
    }

    if (!tamperUnsorted) {
      sigList = sortSignaturesBySigner(sigList);
    }

    if (tamperNonGuardian) {
      const attackerSigner = await getSignerForAccount(14);
      const attackerSig = await signDigestWithSigner(attackerSigner, digest);
      sigList.push(attackerSig);
    }

    const sigBytes = sigList.map((s) => s.sig);

    await sendTx({
      contractName: "PaymentBridge",
      method: "execute",
      args: [selectedId, sigBytes],
      actorIndex: activeAccountIndex,
      force,
      label: "Execute Verified Transfer",
    });

    await refreshLiveState();
    await refreshBalances();
  };

  const sigCount = Object.keys(signatures).length;
  const isQuorumMet = sigCount >= 3;
  const isReadyToExecute = isQuorumMet && isRmnBlessed;

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <span>Wormhole Guardian Approval Studio</span>
            <LayerBadge layer="L2" />
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Layer 2 Consensus: Requires 3-of-5 Guardian ECDSA signatures AND 2-of-2 Chainlink CCIP RMN blessings to execute.
          </p>
        </div>

        {/* Action Shortcuts */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Info className="w-4 h-4 text-blue-600" />
            <span>How it works</span>
            {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleOneClickFullApprove}
            disabled={runningAuto || !selectedId}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
          >
            <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
            <span>{runningAuto ? autoStatus : "⚡ 1-Click Sign (3) + Bless (2) + Execute"}</span>
          </button>
        </div>
      </div>

      {/* Educational Guide Box (collapsible) */}
      {showGuide && (
        <div className="p-5 rounded-2xl bg-indigo-50/60 dark:bg-blue-950/20 border border-indigo-200 dark:border-blue-500/30 text-xs text-slate-700 dark:text-slate-300 flex flex-col gap-3 animate-in fade-in duration-150">
          <div className="font-bold text-indigo-950 dark:text-blue-300 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-blue-400" />
              <span>How PayGuard Dual-Consensus Verification Works</span>
            </span>
            <span className="text-[11px] font-mono text-indigo-600 dark:text-blue-400 font-semibold">
              Wormhole (3/5) + Chainlink CCIP (2/2)
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">1</span>
                <span>Wormhole Quorum (3/5)</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                5 Guardians observe the cross-chain deposit. At least 3 must sign the EIP-191 digest using their private keys. Signatures are checked on-chain in ascending address order to prevent malleability.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-1.5">
                <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px]">2</span>
                <span>Chainlink CCIP RMN (2/2)</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                Inspired by the $320M Wormhole hack, PayGuard mandates an independent Risk Management Network (RMN). Both nodes R1 and R2 must bless the digest before execution unlocks.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px]">3</span>
                <span>Destination Mint Execution</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                When dual-consensus is satisfied, <code>PaymentBridge.execute()</code> mints pgETH to the recipient. (Transfers &ge; 5 ETH automatically enter a challenge window).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Select Pending Transfer */}
      <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider block">
            Select Pending Transfer to Approve:
          </label>
          <span className="text-xs text-slate-500 font-mono">
            {pendingTransfers.length} pending transfer(s)
          </span>
        </div>

        {pendingTransfers.length === 0 ? (
          <div className="text-xs text-slate-600 dark:text-slate-400 py-6 text-center flex flex-col items-center gap-3">
            <p>No pending transfers awaiting consensus. Initiate a deposit first or generate a sample transfer below.</p>
            <button
              onClick={handleCreateSampleTransfer}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>⚡ Create Sample Pending Transfer (2.0 ETH)</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {pendingTransfers.map((t) => {
              const isSelected = selectedId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`p-3.5 rounded-xl border text-left font-mono text-xs transition-all ${
                    isSelected
                      ? "bg-indigo-50/70 dark:bg-blue-950/40 border-indigo-500 dark:border-blue-500 text-indigo-950 dark:text-white ring-2 ring-indigo-500/20 shadow-sm"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 dark:text-white">{shortAddress(t.id)}</span>
                    {isSelected && (
                      <span className="text-[10px] font-sans font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded shadow-sm">
                        Selected
                      </span>
                    )}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px]">
                    {t.netAmount} ETH &bull; Sender: {shortAddress(t.sender)}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {digest && (
          <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-xs">
            <span className="text-slate-500 text-[10px] uppercase font-bold block mb-1">
              Approval Digest (EIP-191 Signed Keccak256 Hash):
            </span>
            <span className="text-indigo-700 dark:text-blue-400 select-all break-all font-semibold">{digest}</span>
          </div>
        )}
      </div>

      {/* Dual Consensus Verification Checklist */}
      {selectedId && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Requirement 1: Wormhole Guardians */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isQuorumMet
                ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/30"
                : "bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-500/30"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600 dark:text-blue-400" />
                <span>1. Wormhole Guardian Quorum</span>
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full font-mono ${
                  isQuorumMet
                    ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                    : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
                }`}
              >
                {sigCount} / 3 Signatures {isQuorumMet ? "✓ Ready" : "(Needs 3)"}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
              Requires signatures from at least 3 distinct guardians in ascending address order.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleSignWithThree}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition-colors"
              >
                Sign Quorum (3 Guardians)
              </button>
              <button
                onClick={handleSignWithAll}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors"
              >
                Sign All 5
              </button>
              {sigCount > 0 && (
                <button
                  onClick={handleClearSigs}
                  className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 text-xs font-semibold"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Requirement 2: CCIP RMN */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isRmnBlessed
                ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/30"
                : "bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-500/30"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>2. Chainlink CCIP RMN Quorum</span>
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full font-mono ${
                  isRmnBlessed
                    ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                    : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
                }`}
              >
                {rmnBlessCount} / 2 Blessings {isRmnBlessed ? "✓ Blessed" : "(Needs 2)"}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
              Independent secondary verifier. Both nodes R1 & R2 must bless this digest.
            </p>
            <div className="flex items-center gap-2">
              {!isRmnBlessed ? (
                <button
                  onClick={handleAutoBlessRmn}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-sm transition-colors"
                >
                  ⚡ Bless with RMN (2/2 Nodes)
                </button>
              ) : (
                <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>RMN secondary consensus verified</span>
                </div>
              )}
              <Link
                to="/l2/risk-network"
                className="text-xs text-purple-700 dark:text-purple-400 hover:underline font-semibold ml-auto flex items-center gap-1"
              >
                <span>View Nodes</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 5 Guardian Signers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        {guardianIndices.map((idx) => {
          const acc = accounts[idx];
          const isSigned = !!signatures[idx];

          return (
            <div
              key={idx}
              className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                isSigned
                  ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/40 shadow-sm"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm"
              }`}
            >
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {acc?.meta.label || `Guardian #${idx}`}
                  </span>
                  {isSigned ? (
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center text-[10px] font-bold">
                      {idx}
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-3 truncate">
                  {acc ? shortAddress(acc.address) : "--"}
                </div>
              </div>

              <button
                onClick={() => handleSign(idx)}
                disabled={isSigned || !digest}
                className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                  isSigned
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30 cursor-default"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40"
                }`}
              >
                {isSigned ? "Signed ✓" : "Sign Digest"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Security Tamper Toggles & Pre-flight Inspection */}
      <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 flex-wrap gap-2">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider">
            Consensus Verification & Security Tamper Toggles (Interactive Security Audit)
          </span>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-slate-500">Dual Status:</span>
            <span className={`font-bold ${isReadyToExecute ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
              {isReadyToExecute ? "🟢 Quorums Satisfied" : "⚠️ Awaiting Approvals"}
            </span>
          </div>
        </div>

        {/* Readiness Banner */}
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 ${
            isReadyToExecute
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-500/40"
              : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-500/40"
          }`}
        >
          {isReadyToExecute ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span>
            {isReadyToExecute
              ? "All Layer 2 consensus requirements met! 3/5 Wormhole Guardian signatures collected and 2/2 Chainlink CCIP RMN nodes blessed. Ready to execute."
              : !isQuorumMet && !isRmnBlessed
              ? "Action Required: Click 'Sign Quorum (3 Guardians)' AND 'Bless with RMN (2/2 Nodes)' before executing."
              : !isQuorumMet
              ? "Action Required: Click 'Sign Quorum (3 Guardians)' to satisfy Wormhole 3-of-5 threshold."
              : "Action Required: Click 'Bless with RMN (2/2 Nodes)' to complete secondary CCIP verification."}
          </span>
        </div>

        {/* Tamper Toggles */}
        <div className="flex gap-4 flex-wrap text-xs font-medium text-slate-700 dark:text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <input
              type="checkbox"
              checked={tamperUnsorted}
              onChange={(e) => setTamperUnsorted(e.target.checked)}
              className="rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-indigo-600"
            />
            <span>Tamper: Unsorted Signatures (Simulate Non-Ascending Order Attack)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <input
              type="checkbox"
              checked={tamperNonGuardian}
              onChange={(e) => setTamperNonGuardian(e.target.checked)}
              className="rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-indigo-600"
            />
            <span>Tamper: Non-Guardian Signature (Attacker #14 Attack)</span>
          </label>
        </div>

        {/* Preview Call Result */}
        {previewResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-mono flex items-center justify-between ${
              previewResult.ok
                ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300"
                : "bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {previewResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span>
                {previewResult.ok
                  ? "Consensus Preview Passed — All signatures and RMN quorums valid!"
                  : `Blocked at ${previewResult.layer === 2 ? "L2 Consensus" : "Pre-Flight"}: ${previewResult.reason}`}
              </span>
            </div>
            <LayerBadge layer="L2" />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handlePreviewExecute}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-white transition-colors shadow-sm"
          >
            Check previewExecute()
          </button>

          <button
            onClick={() => handleExecute(false)}
            className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs transition-all shadow-md ${
              isReadyToExecute
                ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20 cursor-pointer"
                : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20"
            }`}
          >
            {isReadyToExecute ? "✓ Execute Transfer On-Chain" : "Execute Transfer On-Chain"}
          </button>

          <button
            onClick={() => handleExecute(true)}
            className="px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-600/20 border border-rose-200 dark:border-rose-500/40 hover:bg-rose-100 dark:hover:bg-rose-600/30 text-rose-700 dark:text-rose-300 text-xs font-bold transition-colors"
          >
            Force Execute (Demo Revert)
          </button>
        </div>
      </div>
    </div>
  );
}
