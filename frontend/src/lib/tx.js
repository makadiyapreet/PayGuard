import { Contract, formatEther, parseEther } from "ethers";
import { getContractInstance } from "./chain.js";
import { getSignerForAccount } from "./wallets.js";
import { decodeRevertReason } from "./errors.js";
import { getLayerForMethod } from "./layers.js";
import { useTxStore } from "../store/txStore.js";

/**
 * Robust transaction pipeline with gas capture, revert decoding, and force-send support.
 */
export async function sendTx({
  contractName,
  method,
  args = [],
  value = 0n,
  label = "",
  layer = null,
  actorIndex = 13,
  force = false,
}) {
  const txStore = useTxStore.getState();
  const signer = await getSignerForAccount(actorIndex);
  const actorAddress = await signer.getAddress();
  const targetLayer = layer || getLayerForMethod(method);

  const contract = await getContractInstance(contractName, signer);
  if (!contract[method]) {
    throw new Error(`Method ${method} not found on contract ${contractName}`);
  }

  // Value formatting
  const valWei = typeof value === "string" ? parseEther(value) : BigInt(value || 0);

  // 1. Dry run / Gas estimation
  let estimatedGas = 500000n;
  let revertInfo = null;

  try {
    estimatedGas = await contract[method].estimateGas(...args, { value: valWei });
  } catch (err) {
    let detailedError = err;
    try {
      // staticCall forces eth_call on Ganache which returns the exact revert reason string (e.g. PG:BAD_SIGS)
      await contract[method].staticCall(...args, { value: valWei });
    } catch (staticErr) {
      detailedError = staticErr;
    }

    // Inspect preview functions on PaymentBridge for accurate revert explanations
    if (contractName === "PaymentBridge") {
      try {
        if (method === "execute" && args.length >= 2) {
          const preview = await contract.previewExecute(args[0], args[1]);
          if (!preview[0] && preview[2]) {
            detailedError = preview[2];
          }
        } else if (method === "deposit" && args.length >= 1) {
          const preview = await contract.previewDeposit(actorAddress, args[0], valWei);
          if (!preview[0] && preview[2]) {
            detailedError = preview[2];
          }
        } else if (method === "refund" && args.length >= 1) {
          const preview = await contract.previewRefund(args[0]);
          if (!preview[0] && preview[2]) {
            detailedError = preview[2];
          }
        }
      } catch (_) {}
    }

    revertInfo = decodeRevertReason(detailedError);
    console.warn(`[tx-dryrun] ${contractName}.${method} reverted:`, revertInfo);

    if (!force) {
      // Revert Explainer trigger
      txStore.setPendingRevert({
        contractName,
        method,
        args,
        value: valWei.toString(),
        actorIndex,
        actorAddress,
        revertInfo,
        originalError: err,
      });
      return { success: false, reverted: true, revertInfo };
    }
  }

  // 2. Execute Transaction
  const txOptions = { value: valWei };
  if (force) {
    txOptions.gasLimit = 800000n;
  } else {
    txOptions.gasLimit = (estimatedGas * 130n) / 100n; // 30% buffer
  }

  const txHashPlaceholder = `pending-${Date.now()}`;
  txStore.addToast({
    id: txHashPlaceholder,
    title: label || `${contractName}.${method}`,
    status: "pending",
    layer: targetLayer,
    actor: actorAddress,
  });

  try {
    const tx = await contract[method](...args, txOptions);
    txStore.updateToast(txHashPlaceholder, { id: tx.hash, hash: tx.hash });

    const receipt = await tx.wait();

    const gasUsed = receipt.gasUsed;
    const gasPrice = receipt.gasPrice || 2500000007n;
    const costWei = gasUsed * gasPrice;

    const record = {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      timestamp: Math.floor(Date.now() / 1000),
      actor: actorAddress,
      actorIndex,
      contract: contractName,
      method,
      args: args.map((a) => (typeof a === "bigint" ? a.toString() : a)),
      layer: targetLayer,
      status: receipt.status === 1 ? "success" : "reverted",
      gasUsed: gasUsed.toString(),
      gasPrice: gasPrice.toString(),
      costWei: costWei.toString(),
      costEth: formatEther(costWei),
      label: label || `${contractName}.${method}`,
      error: receipt.status === 0 ? "Execution Reverted" : null,
    };

    txStore.addTxRecord(record);
    txStore.updateToast(tx.hash, {
      status: receipt.status === 1 ? "success" : "failed",
      gasUsed: gasUsed.toString(),
      costEth: formatEther(costWei),
    });

    return { success: receipt.status === 1, receipt, record };
  } catch (err) {
    const dec = decodeRevertReason(err);
    txStore.updateToast(txHashPlaceholder, {
      status: "failed",
      error: dec?.code || err.message,
    });
    return { success: false, error: dec || err };
  }
}

