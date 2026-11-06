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
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  PlusCircle,
  ShieldCheck
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
  const [showGuide, setShowGuide] = useState(false);

  // Loading states
  const [creatingSample, setCreatingSample] = useState(false);

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

        // Check RMN status in background
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

  // Quick create a sample transfer if none exist
  const handleCreateSampleTransfer = async () => {
    setCreatingSample(true);
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
      setCreatingSample(false);
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

  // Execute on-chain (submits guardian signatures purely without auto-blessing RMN)
  const handleExecute = async (force = false) => {
    let sigList = Object.values(signatures);

    if (!force && sigList.length < 3) {
      alert("Missing Signatures: You need at least 3 guardian signatures to execute. Click 'Sign with 3 Guardians (Quorum)' above first.");
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

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <span>Wormhole Guardian Approval Studio</span>
            <LayerBadge layer="L2" />
          </h2>
          <p className="text-xs text-slate-700 dark:text-slate-400 mt-1 font-medium">
            Layer 2 Consensus: Collect at least 3-of-5 Guardian ECDSA signatures to unlock destination minting.
          </p>
        </div>

        {/* Action Shortcuts */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Info className="w-4 h-4 text-blue-600" />
            <span>How it works</span>
            {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleSignWithThree}
            disabled={!selectedId}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
          >
            <Zap className="w-4 h-4 fill-white text-white" />
            <span>Sign with 3 Guardians (Quorum)</span>
          </button>

          <button
            onClick={handleSignWithAll}
            disabled={!selectedId}
            className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
          >
            Sign All 5
          </button>

          {sigCount > 0 && (
            <button
              onClick={handleClearSigs}
              className="px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xs font-bold underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Educational Guide Box (collapsible) */}
      {showGuide && (
        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-500/30 text-xs text-slate-800 dark:text-slate-300 flex flex-col gap-2 shadow-sm animate-in fade-in duration-150">
          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>How Wormhole Guardian Consensus Works</span>
          </div>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
            5 independent Guardians observe the cross-chain deposit event. Each guardian signs an EIP-191 digest using their private key. At least <strong>3 out of 5 valid signatures</strong> must be submitted in strictly ascending address order to prevent signature malleability.
          </p>
        </div>
      )}

      {/* Select Pending Transfer */}
      <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <label className="text-xs font-bold text-slate-900 dark:text-slate-400 uppercase tracking-wider block">
            Select Pending Transfer to Approve:
          </label>
          <span className="text-xs text-slate-700 dark:text-slate-400 font-mono font-bold">
            {pendingTransfers.length} pending transfer(s)
          </span>
        </div>

        {pendingTransfers.length === 0 ? (
          <div className="text-xs text-slate-700 dark:text-slate-400 py-6 text-center flex flex-col items-center gap-3">
            <p className="font-medium">No pending transfers awaiting consensus. Initiate a deposit first or generate a sample transfer below.</p>
            <button
              onClick={handleCreateSampleTransfer}
              disabled={creatingSample}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{creatingSample ? "Creating Sample..." : "⚡ Create Sample Pending Transfer (2.0 ETH)"}</span>
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
                      ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-600 dark:border-blue-500 text-slate-900 dark:text-white ring-2 ring-blue-500/20 shadow-sm"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 dark:text-white text-xs">{shortAddress(t.id)}</span>
                    {isSelected && (
                      <span className="text-[10px] font-sans font-bold bg-blue-600 text-white px-2 py-0.5 rounded shadow-sm">
                        Selected
                      </span>
                    )}
                  </div>
                  <div className="text-slate-700 dark:text-slate-400 text-[11px] font-medium">
                    {t.netAmount} ETH &bull; Sender: {shortAddress(t.sender)}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {digest && (
          <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-xs">
            <span className="text-slate-600 dark:text-slate-400 text-[10px] uppercase font-bold block mb-1">
              Approval Digest (EIP-191 Signed Keccak256 Hash):
            </span>
            <span className="text-blue-700 dark:text-blue-400 select-all break-all font-bold">{digest}</span>
          </div>
        )}
      </div>

      {/* Wormhole Guardian Quorum Section (Full Width, Simple, High Contrast) */}
      {selectedId && (
        <div
          className={`p-5 rounded-2xl border transition-all shadow-sm ${
            isQuorumMet
              ? "bg-emerald-50/80 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-500/30"
              : "bg-amber-50/80 border-amber-300 dark:bg-amber-950/20 dark:border-amber-500/30"
          }`}
        >
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>Wormhole Guardian Quorum (3 of 5 Signatures Required)</span>
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full font-mono shadow-sm ${
                  isQuorumMet
                    ? "bg-emerald-600 text-white"
                    : "bg-amber-600 text-white"
                }`}
              >
                {sigCount} / 3 Signatures {isQuorumMet ? "✓ Quorum Ready" : "(Needs 3)"}
              </span>
              {isRmnBlessed ? (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700">
                  ✓ CCIP RMN Blessed (2/2)
                </span>
              ) : (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700">
                  ⚠️ CCIP RMN Pending
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-800 dark:text-slate-300 mb-4 font-medium leading-relaxed">
            At least 3 distinct guardian signatures are required to reach consensus. Click below to sign with the first 3 guardians at once, or sign individually.
          </p>

          <div className="flex gap-2.5 flex-wrap">
            <button
              onClick={handleSignWithThree}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Sign Quorum (3 Guardians)</span>
            </button>
            <button
              onClick={handleSignWithAll}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs transition-colors shadow-sm"
            >
              Sign All 5
            </button>
            {sigCount > 0 && (
              <button
                onClick={handleClearSigs}
                className="px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 dark:hover:text-white text-xs font-bold underline"
              >
                Clear Signatures
              </button>
            )}
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
                  ? "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-500/40 shadow-sm"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm"
              }`}
            >
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {acc?.meta.label || `Guardian #${idx}`}
                  </span>
                  {isSigned ? (
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                      {idx}
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 mb-3 truncate font-medium">
                  {acc ? shortAddress(acc.address) : "--"}
                </div>
              </div>

              <button
                onClick={() => handleSign(idx)}
                disabled={isSigned || !digest}
                className={`w-full py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${
                  isSigned
                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300 cursor-default font-extrabold"
                    : "bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
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
          <span className="text-xs font-bold text-slate-900 dark:text-slate-300 uppercase tracking-wider">
            Consensus Verification & Security Tamper Audit
          </span>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-slate-600 font-bold">Status:</span>
            <span className={`font-bold ${isQuorumMet ? "text-emerald-700 dark:text-emerald-400" : "text-amber-800 dark:text-amber-400"}`}>
              {isQuorumMet ? "🟢 Quorum Ready (3/5)" : "⚠️ Awaiting Signatures"}
            </span>
          </div>
        </div>

        {/* Readiness Banner (High Contrast Dark Text) */}
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2.5 shadow-sm ${
            isQuorumMet
              ? "bg-emerald-50 text-emerald-950 border-emerald-300 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-500/40"
              : "bg-amber-50 text-amber-950 border-amber-300 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-500/40"
          }`}
        >
          {isQuorumMet ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          )}
          <span>
            {isQuorumMet
              ? isRmnBlessed
                ? "Quorum & RMN Verified: 3-of-5 Guardian signatures and CCIP RMN blessing are confirmed! Click 'Execute Transfer On-Chain' to finalize and mint pgETH."
                : "Guardian Quorum Ready (3/5): Signatures gathered. Note: Transfer requires CCIP RMN blessing — click Execute to trigger the PG:NOT_BLESSED defense intercept, or bless on the Risk Network page."
              : "Action Required: Click 'Sign with 3 Guardians (Quorum)' above to satisfy the Wormhole 3-of-5 threshold."}
          </span>
        </div>

        {/* CCIP RMN Secondary Consensus Status Card */}
        {!isRmnBlessed && selectedId && (
          <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/50 text-xs text-amber-950 dark:text-amber-200 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
              <span>
                <strong>CCIP RMN Notice:</strong> Awaiting independent blessing from Risk Nodes R1 & R2. You can bless on the Risk Network page, or execute on-chain to demonstrate the defense intercept.
              </span>
            </div>
            <Link
              to="/l2/risk-network"
              className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-bold text-xs shrink-0 flex items-center gap-1 shadow-sm transition-colors"
            >
              <span>Go to Risk Network (RMN) →</span>
            </Link>
          </div>
        )}
        {isRmnBlessed && selectedId && (
          <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700/50 text-xs text-emerald-950 dark:text-emerald-200 flex items-center gap-2 font-medium shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <strong>CCIP RMN Verified:</strong> Both independent risk nodes (2 of 2) have blessed this transfer! Ready for on-chain destination execution.
            </span>
          </div>
        )}

        {/* Tamper Toggles */}
        <div className="flex gap-4 flex-wrap text-xs font-medium text-slate-900 dark:text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 transition-colors">
            <input
              type="checkbox"
              checked={tamperUnsorted}
              onChange={(e) => setTamperUnsorted(e.target.checked)}
              className="rounded bg-white dark:bg-slate-800 border-slate-300 text-blue-600 w-4 h-4"
            />
            <span className="font-semibold text-slate-800 dark:text-white">Tamper: Unsorted Signatures (Simulate Non-Ascending Order Attack)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 transition-colors">
            <input
              type="checkbox"
              checked={tamperNonGuardian}
              onChange={(e) => setTamperNonGuardian(e.target.checked)}
              className="rounded bg-white dark:bg-slate-800 border-slate-300 text-blue-600 w-4 h-4"
            />
            <span className="font-semibold text-slate-800 dark:text-white">Tamper: Non-Guardian Signature (Attacker #14 Attack)</span>
          </label>
        </div>

        {/* Preview Call Result */}
        {previewResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-mono flex items-center justify-between ${
              previewResult.ok
                ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-300"
                : "bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {previewResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-bold">
                {previewResult.ok
                  ? "Consensus Preview Passed — All signatures valid and quorum satisfied!"
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
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-slate-900 dark:text-white transition-colors shadow-sm"
          >
            Check previewExecute()
          </button>

          <button
            onClick={() => handleExecute(false)}
            className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs transition-all shadow-md ${
              isQuorumMet
                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 cursor-pointer"
                : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
            }`}
          >
            {isQuorumMet ? "✓ Execute Transfer On-Chain" : "Execute Transfer On-Chain"}
          </button>

          <button
            onClick={() => handleExecute(true)}
            className="px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-600/20 border border-rose-300 dark:border-rose-500/40 hover:bg-rose-100 dark:hover:bg-rose-600/30 text-rose-800 dark:text-rose-300 text-xs font-bold transition-colors shadow-sm"
          >
            Force Execute (Demo Revert)
          </button>
        </div>
      </div>
    </div>
  );
}
