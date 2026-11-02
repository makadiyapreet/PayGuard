import React, { useState, useEffect } from "react";
import { useChainStore } from "../../store/chainStore.js";
import { useAccountStore } from "../../store/accountStore.js";
import { useIndexerStore } from "../../store/indexerStore.js";
import { getContractInstance } from "../../lib/chain.js";
import { signDigestWithSigner, sortSignaturesBySigner } from "../../lib/sign.js";
import { getSignerForAccount } from "../../lib/wallets.js";
import { sendTx } from "../../lib/tx.js";
import { LayerBadge } from "../../components/LayerBadge.jsx";
import { StateBadge } from "../../components/StateBadge.jsx";
import { shortAddress } from "../../lib/format.js";
import { CheckCircle2, XCircle, AlertTriangle, Users, Check, Shield } from "lucide-react";

export function GuardiansApproval() {
  const { chainId, contracts, refreshLiveState } = useChainStore();
  const { accounts, activeAccountIndex } = useAccountStore();
  const transfers = useIndexerStore((s) => s.transfers);
  const pendingTransfers = Object.values(transfers).filter((t) => t.state === 1);

  const [selectedId, setSelectedId] = useState("");
  const [digest, setDigest] = useState("");
  const [signatures, setSignatures] = useState({}); // accIndex -> { signer, sig, recovered }
  const [tamperUnsorted, setTamperUnsorted] = useState(false);
  const [tamperNonGuardian, setTamperNonGuardian] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);

  // Guardians: indices 1 to 5
  const guardianIndices = [1, 2, 3, 4, 5];

  useEffect(() => {
    if (pendingTransfers.length > 0 && !selectedId) {
      setSelectedId(pendingTransfers[0].id);
    }
  }, [pendingTransfers]);

  useEffect(() => {
    async function loadDigest() {
      if (!selectedId) {
        setDigest("");
        return;
      }
      try {
        const bridge = await getContractInstance("PaymentBridge");
        const d = await bridge.getDigest(selectedId);
        setDigest(d);
        setSignatures({});
        setPreviewResult(null);
      } catch (err) {
        console.warn("Could not fetch digest:", err);
      }
    }
    loadDigest();
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

  // Sign with first 3 guardians
  const handleSignWithThree = async () => {
    if (!digest) return;
    for (const idx of [1, 2, 3]) {
      await handleSign(idx);
    }
  };

  // Sign with all 5
  const handleSignWithAll = async () => {
    if (!digest) return;
    for (const idx of guardianIndices) {
      await handleSign(idx);
    }
  };

  // Run previewExecute
  const handlePreviewExecute = async () => {
    if (!selectedId || !digest) return;
    try {
      let sigList = Object.values(signatures);

      if (!tamperUnsorted) {
        sigList = sortSignaturesBySigner(sigList);
      }

      if (tamperNonGuardian) {
        // Add attacker (#14) signature
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
  };

  const sigCount = Object.keys(signatures).length;

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Wormhole Guardian Approval Studio</span>
            <LayerBadge layer="L2" />
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            t-of-n (3-of-5) consensus signatures required. Signers must be sorted in strictly ascending address order.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSignWithThree}
            className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors"
          >
            Sign with 3 Guardians (Quorum)
          </button>
          <button
            onClick={handleSignWithAll}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
          >
            Sign with All 5
          </button>
          <button
            onClick={() => setSignatures({})}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 text-xs"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Select Pending Transfer */}
      <div className="bg-[#121826] border border-slate-800 rounded-2xl p-5">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
          Select Pending Transfer to Approve:
        </label>
        {pendingTransfers.length === 0 ? (
          <div className="text-xs text-slate-500 font-mono py-2">
            No pending transfers awaiting consensus. Deposit on the Transfers page first.
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
                  {t.netAmount} ETH &bull; Sender: {shortAddress(t.sender)}
                </div>
              </button>
            ))}
          </div>
        )}

        {digest && (
          <div className="mt-4 p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs">
            <span className="text-slate-500 text-[10px] uppercase font-bold block mb-1">
              Approval Digest (EIP-191 Signed Hash):
            </span>
            <span className="text-purple-400 select-all break-all">{digest}</span>
          </div>
        )}
      </div>

      {/* 5 Guardian Signers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {guardianIndices.map((idx) => {
          const acc = accounts[idx];
          const isSigned = !!signatures[idx];

          return (
            <div
              key={idx}
              className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                isSigned
                  ? "bg-purple-950/20 border-purple-500/50"
                  : "bg-slate-900/60 border-slate-800"
              }`}
            >
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-white">{acc?.meta.label}</span>
                  {isSigned ? (
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center text-[10px]">
                      {idx}
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono text-slate-400 mb-2 truncate">
                  {acc ? shortAddress(acc.address) : "--"}
                </div>
              </div>

              <button
                onClick={() => handleSign(idx)}
                disabled={isSigned || !digest}
                className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  isSigned
                    ? "bg-purple-900/40 text-purple-300 border border-purple-500/30"
                    : "bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-30"
                }`}
              >
                {isSigned ? "Signed ✔" : "Sign Digest"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Tamper Toggles & Preview Section */}
      <div className="bg-[#121826] border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Consensus Verification & Security Tamper Toggles (Viva Demonstrations)
          </span>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-slate-400">Signatures:</span>
            <span className={`font-bold ${sigCount >= 3 ? "text-emerald-400" : "text-amber-400"}`}>
              {sigCount} / 3 Quorum
            </span>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex gap-4 flex-wrap text-xs font-medium text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 hover:border-slate-700">
            <input
              type="checkbox"
              checked={tamperUnsorted}
              onChange={(e) => setTamperUnsorted(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-purple-600"
            />
            <span>Tamper: Unsorted Signatures (Simulate Non-Ascending Order)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 hover:border-slate-700">
            <input
              type="checkbox"
              checked={tamperNonGuardian}
              onChange={(e) => setTamperNonGuardian(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-purple-600"
            />
            <span>Tamper: Non-Guardian Signature (Attacker #14)</span>
          </label>
        </div>

        {/* Preview Call */}
        {previewResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-mono flex items-center justify-between ${
              previewResult.ok
                ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                : "bg-rose-950/20 border-rose-500/40 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {previewResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>
                {previewResult.ok
                  ? "Consensus Preview Passed — Ready for On-Chain Execution"
                  : `Blocked at ${previewResult.layer === 2 ? "L2 Consensus" : "Layer"}: ${previewResult.reason}`}
              </span>
            </div>
            <LayerBadge layer="L2" />
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handlePreviewExecute}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors"
          >
            Check previewExecute()
          </button>

          <button
            onClick={() => handleExecute(false)}
            className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors shadow-lg shadow-purple-500/20"
          >
            Execute Transfer On-Chain
          </button>

          <button
            onClick={() => handleExecute(true)}
            className="px-4 py-2 rounded-xl bg-rose-600/20 border border-rose-500/40 hover:bg-rose-600/30 text-rose-300 text-xs font-semibold transition-colors"
          >
            Force Execute (Demo Revert)
          </button>
        </div>
      </div>
    </div>
  );
}

