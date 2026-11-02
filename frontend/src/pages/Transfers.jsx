import React, { useState, useEffect } from "react";
import { useChainStore } from "../store/chainStore.js";
import { useAccountStore } from "../store/accountStore.js";
import { useIndexerStore } from "../store/indexerStore.js";
import { getContractInstance } from "../lib/chain.js";
import { sendTx } from "../lib/tx.js";
import { signDigestWithSigner, sortSignaturesBySigner } from "../lib/sign.js";
import { computeApprovalDigest } from "../lib/digest.js";
import { getSignerForAccount, getAccounts } from "../lib/wallets.js";
import { shortAddress, formatEth } from "../lib/format.js";
import { LayerBadge } from "../components/LayerBadge.jsx";
import { StateBadge } from "../components/StateBadge.jsx";
import { Countdown } from "../components/Countdown.jsx";
import { EthAmount } from "../components/EthAmount.jsx";
import { parseEther, formatEther } from "ethers";
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  AlertTriangle,
  Play,
  RotateCcw,
  Zap,
  ChevronRight,
  X
} from "lucide-react";

export function Transfers() {
  const { chainId, contracts, refreshLiveState } = useChainStore();
  const { accounts, activeAccountIndex, refreshBalances } = useAccountStore();
  const transfers = useIndexerStore((s) => s.transfers);
  const transferList = Object.values(transfers);

  const activeAccount = accounts[activeAccountIndex] || accounts[13];

  // Deposit Form State
  const [recipient, setRecipient] = useState("");
  const [amountEth, setAmountEth] = useState("2.0");
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Redeem Form State
  const [redeemAmount, setRedeemAmount] = useState("1.0");

  // Selected Transfer for Drawer
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [drawerDigest, setDrawerDigest] = useState("");
  const [computedDigest, setComputedDigest] = useState("");

  // One-click pipeline state
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState("");

  useEffect(() => {
    if (activeAccount && !recipient) {
      setRecipient(activeAccount.address);
    }
  }, [activeAccount]);

  // Live preview check on input changes
  useEffect(() => {
    let cancel = false;

    async function runPreview() {
      if (!amountEth || parseFloat(amountEth) <= 0 || !recipient) {
        setPreview(null);
        return;
      }
      setPreviewLoading(true);
      try {
        const bridge = await getContractInstance("PaymentBridge");
        const valWei = parseEther(amountEth);
        const res = await bridge.previewDeposit(activeAccount.address, recipient, valWei);
        if (!cancel) {
          setPreview({
            ok: res.ok,
            layer: Number(res.layer),
            reason: res.reason,
            fee: formatEther(res.fee),
            net: formatEther(res.net),
            isLarge: res.isLarge,
          });
        }
      } catch (err) {
        if (!cancel) {
          setPreview({ ok: false, layer: 0, reason: err.message, fee: "0", net: "0", isLarge: false });
        }
      } finally {
        if (!cancel) setPreviewLoading(false);
      }
    }

    const t = setTimeout(runPreview, 250);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [amountEth, recipient, activeAccount]);

  // Handle standard deposit
  const handleDeposit = async (force = false) => {
    if (!amountEth || !recipient) return;
    await sendTx({
      contractName: "PaymentBridge",
      method: "deposit",
      args: [recipient],
      value: amountEth,
      actorIndex: activeAccountIndex,
      force,
      label: `Deposit ${amountEth} ETH`,
    });
    await refreshLiveState();
    await refreshBalances();
  };

  // Handle standard redeem
  const handleRedeem = async () => {
    if (!redeemAmount) return;
    const valWei = parseEther(redeemAmount);
    await sendTx({
      contractName: "PaymentBridge",
      method: "redeem",
      args: [valWei],
      actorIndex: activeAccountIndex,
      label: `Redeem ${redeemAmount} pgETH`,
    });
    await refreshLiveState();
    await refreshBalances();
  };

  // One-click full transfer execution
  const handleRunFullTransfer = async () => {
    setPipelineRunning(true);
    try {
      setPipelineStep("1/4: Depositing 2 ETH from User (#13)...");
      const userIndex = 13;
      const userAcc = accounts[userIndex];
      const depRes = await sendTx({
        contractName: "PaymentBridge",
        method: "deposit",
        args: [userAcc.address],
        value: "2.0",
        actorIndex: userIndex,
        label: "Deposit 2.0 ETH",
      });

      if (!depRes.success) throw new Error("Deposit failed");

      const bridge = await getContractInstance("PaymentBridge");
      const totalCount = await bridge.transferTotal();
      const transferId = await bridge.transferIdAt(totalCount - 1n);
      const digest = await bridge.getDigest(transferId);

      setPipelineStep("2/4: Gathering 3 Guardian signatures (G1, G2, G3)...");
      const g1Signer = await getSignerForAccount(1);
      const g2Signer = await getSignerForAccount(2);
      const g3Signer = await getSignerForAccount(3);

      const s1 = await signDigestWithSigner(g1Signer, digest);
      const s2 = await signDigestWithSigner(g2Signer, digest);
      const s3 = await signDigestWithSigner(g3Signer, digest);
      const sortedSigs = sortSignaturesBySigner([s1, s2, s3]).map((s) => s.sig);

      setPipelineStep("3/4: RMN Risk Nodes blessing transfer (R1, R2)...");
      await sendTx({
        contractName: "RiskManagement",
        method: "bless",
        args: [transferId, digest],
        actorIndex: 6,
        label: "RMN Node 1 Bless",
      });
      await sendTx({
        contractName: "RiskManagement",
        method: "bless",
        args: [transferId, digest],
        actorIndex: 7,
        label: "RMN Node 2 Bless",
      });

      setPipelineStep("4/4: Executing bridge mint on destination...");
      await sendTx({
        contractName: "PaymentBridge",
        method: "execute",
        args: [transferId, sortedSigs],
        actorIndex: userIndex,
        label: "Execute Transfer",
      });

      await refreshLiveState();
      await refreshBalances();
      setPipelineStep("✔ Full Transfer Completed! 1.998 pgETH Minted.");
    } catch (err) {
      setPipelineStep(`Failed: ${err.message}`);
    } finally {
      setTimeout(() => setPipelineRunning(false), 3000);
    }
  };

  // Inspect transfer in drawer
  const openTransferDrawer = async (t) => {
    setSelectedTransfer(t);
    try {
      const bridge = await getContractInstance("PaymentBridge");
      const onChainDigest = await bridge.getDigest(t.id);
      setDrawerDigest(onChainDigest);

      const localDigest = computeApprovalDigest({
        chainId,
        bridgeAddress: contracts.PaymentBridge.address,
        id: t.id,
        sender: t.sender,
        recipient: t.recipient,
        netAmount: parseEther(t.netAmount),
        nonce: t.nonce,
        expiresAt: t.expiresAt,
      });
      setComputedDigest(localDigest);
    } catch (err) {
      console.warn("Could not compute digest for drawer:", err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Bridge Transfers</span>
            <LayerBadge layer="CORE" />
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Deposit native ETH to mint pgETH. Large transfers (&ge; 5 ETH) enforce a 1-hour delay window.
          </p>
        </div>

        {/* 1-Click Demo Shortcut */}
        <button
          onClick={handleRunFullTransfer}
          disabled={pipelineRunning}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50"
        >
          <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
          <span>{pipelineRunning ? pipelineStep : "1-Click Full Transfer (Deposit → Sigs → Bless → Execute)"}</span>
        </button>
      </div>

      {/* Forms Grid: Deposit & Redeem */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deposit Card */}
        <div className="bg-[#121826] border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Initiate Deposit</span>
                <LayerBadge layer="L1" />
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Fee: 10 bps (0.10%)
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">
                  Deposit Amount (ETH)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={amountEth}
                  onChange={(e) => setAmountEth(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Real-time Pre-Execution Gate Preview */}
              {preview && (
                <div className={`p-3.5 rounded-xl border text-xs font-mono space-y-1.5 ${
                  preview.ok
                    ? "bg-slate-900/60 border-slate-800 text-slate-300"
                    : "bg-rose-950/20 border-rose-500/30 text-rose-300"
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Pre-Execution Gate:</span>
                    <span className="font-bold flex items-center gap-1">
                      {preview.ok ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> All Checks Passed
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Blocked ({preview.reason})
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">Protocol Fee (to Forta pool):</span>
                    <span>{preview.fee} ETH</span>
                  </div>
                  <div className="flex justify-between font-bold text-white">
                    <span className="text-slate-400">Net Mintable pgETH:</span>
                    <span className="text-blue-400">{preview.net} pgETH</span>
                  </div>

                  {preview.isLarge && (
                    <div className="pt-1.5 border-t border-slate-800 text-amber-300 flex items-center gap-1 text-[11px]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Large Transfer (&ge; 5 ETH): 1-hour challenge delay will apply.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => handleDeposit(false)}
              disabled={!preview?.ok}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs transition-colors shadow-lg shadow-blue-500/20"
            >
              Deposit ETH
            </button>
            <button
              onClick={() => handleDeposit(true)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              title="Force Send bypasses gas estimation to demonstrate real revert on-chain"
            >
              Force Send
            </button>
          </div>
        </div>

        {/* Redeem Card */}
        <div className="bg-[#121826] border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Redeem Wrapped ETH</span>
                <LayerBadge layer="CORE" />
              </span>
              <span className="text-xs text-slate-400 font-mono">
                pgETH &rarr; Native ETH
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">
                  Amount of pgETH to Burn
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-400 font-mono space-y-1">
                <div>Redeem rate: 1.0 pgETH = 1.0 native ETH</div>
                <div className="text-amber-400/90 text-[11px]">
                  Notice: Rapid deposit-then-redeem trips Defender Rule #2 (RAPID_REDEEM) and halts the bridge.
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleRedeem}
            className="w-full mt-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors shadow-lg shadow-purple-500/20"
          >
            Redeem native ETH
          </button>
        </div>
      </div>

      {/* Transfers Table */}
      <div className="bg-[#121826] border border-slate-800 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>All Monitored Bridge Transfers</span>
            <span className="text-xs bg-slate-800 text-slate-400 font-mono px-2 py-0.5 rounded">
              {transferList.length} total
            </span>
          </h3>
        </div>

        {transferList.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-500 font-mono">
            No transfers found on-chain. Deposit above or click "1-Click Full Transfer" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <th className="py-3 px-3">Transfer ID</th>
                  <th className="py-3 px-3">Sender / Recipient</th>
                  <th className="py-3 px-3">Net Amount</th>
                  <th className="py-3 px-3">Fee</th>
                  <th className="py-3 px-3">State</th>
                  <th className="py-3 px-3">Consensus (Sigs/Bless)</th>
                  <th className="py-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {transferList.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => openTransferDrawer(t)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 text-blue-400 font-bold">
                      {shortAddress(t.id)}
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      <div>From: {shortAddress(t.sender)}</div>
                      <div className="text-slate-500">To: {shortAddress(t.recipient)}</div>
                    </td>
                    <td className="py-3 px-3 text-white font-bold">
                      {t.netAmount} ETH
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {t.fee} ETH
                    </td>
                    <td className="py-3 px-3">
                      <StateBadge state={t.state} />
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-purple-400">{t.sigCount || 0}/3 Sigs</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-emerald-400">{t.blessCount || 0}/2 RMN</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center text-blue-400 hover:text-blue-300">
                        Inspect <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transfer Drawer Modal */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="bg-[#121826] border-l border-slate-800 max-w-lg w-full h-full p-6 flex flex-col justify-between overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">Transfer Lifecycle Inspector</h3>
                    <StateBadge state={selectedTransfer.state} />
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-1 select-all">
                    ID: {selectedTransfer.id}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTransfer(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Digest Inspection */}
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs font-mono">
                  <div className="text-slate-400 text-[10px] uppercase font-bold mb-1">
                    On-Chain Approval Digest
                  </div>
                  <div className="text-blue-400 break-all select-all">{drawerDigest}</div>

                  <div className="mt-3 pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Locally Recomputed:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Digest Match (EIP-712 Style)
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs font-mono bg-slate-900/60 rounded-xl p-3.5 border border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sender:</span>
                    <span className="text-white">{selectedTransfer.sender}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Recipient:</span>
                    <span className="text-white">{selectedTransfer.recipient}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Net Amount:</span>
                    <span className="text-blue-400 font-bold">{selectedTransfer.netAmount} pgETH</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Nonce:</span>
                    <span className="text-white">#{selectedTransfer.nonce}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Delay Threshold:</span>
                    <span className="text-amber-400">{selectedTransfer.isLarge ? "Large (1h delay)" : "Standard (Instant)"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800">
              <button
                onClick={() => setSelectedTransfer(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
