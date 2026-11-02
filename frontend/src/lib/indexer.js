import { getProvider, getContractInstance, fetchContractsRegistry } from "./chain.js";
import { useIndexerStore } from "../store/indexerStore.js";
import { useTxStore } from "../store/txStore.js";
import { formatEther } from "ethers";

let indexerRunning = false;
let pollingTimer = null;

export async function startIndexer() {
  if (indexerRunning) return;
  indexerRunning = true;
  await syncLogs();
  pollingTimer = setInterval(syncLogs, 2000);
}

export function stopIndexer() {
  if (pollingTimer) clearInterval(pollingTimer);
  indexerRunning = false;
}

export async function syncLogs() {
  const store = useIndexerStore.getState();
  const provider = getProvider();
  const reg = await fetchContractsRegistry();
  if (!reg) return;

  try {
    const latestBlock = await provider.getBlock("latest");
    if (!latestBlock) return;

    // Chain Reset / Revert Detection
    if (latestBlock.number < store.lastIndexedBlock) {
      console.warn("Chain reset detected! Re-indexing from block 0...");
      store.resetIndexer();
      useTxStore.getState().addToast({
        id: `reset-${Date.now()}`,
        title: "Chain Reset Detected",
        status: "success",
        layer: "CORE",
      });
    }

    const fromBlock = store.lastIndexedBlock === 0 ? 0 : store.lastIndexedBlock + 1;
    const toBlock = latestBlock.number;
    if (fromBlock > toBlock) return;

    store.setSyncing(true);

    const contractNames = [
      "PaymentBridge",
      "GuardianRegistry",
      "RiskManagement",
      "InvariantGuard",
      "DefenderMonitor",
      "DetectionNetwork",
      "RiskScore",
      "WrappedToken",
    ];

    const allNewLogs = [];

    await Promise.all(
      contractNames.map(async (name) => {
        try {
          const contract = await getContractInstance(name);
          const logs = await contract.queryFilter("*", fromBlock, toBlock);
          logs.forEach((log) => {
            allNewLogs.push({
              contractName: name,
              event: log.eventName || log.fragment?.name,
              args: log.args,
              blockNumber: log.blockNumber,
              transactionHash: log.transactionHash,
              logIndex: log.index,
            });
          });
        } catch (e) {
          // Skip if contract filter not available
        }
      })
    );

    // Sort by blockNumber then logIndex descending (newest first)
    allNewLogs.sort((a, b) => {
      if (b.blockNumber !== a.blockNumber) return b.blockNumber - a.blockNumber;
      return b.logIndex - a.logIndex;
    });

    if (allNewLogs.length > 0) {
      // Rebuild / update derived state
      const existingEvents = store.events;
      const combinedEvents = [...allNewLogs, ...existingEvents];

      // Rebuild transfer records
      const updatedTransfers = { ...store.transfers };
      for (const item of allNewLogs) {
        const { event, args } = item;
        if (!args) continue;

        if (event === "Deposited") {
          const id = args.id;
          updatedTransfers[id] = {
            id,
            sender: args.sender,
            recipient: args.recipient,
            netAmount: formatEther(args.netAmount),
            fee: formatEther(args.fee),
            nonce: Number(args.nonce),
            isLarge: args.isLarge,
            expiresAt: Number(args.expiresAt),
            state: 1, // Pending
            digest: args.digest,
            sigCount: 0,
            blessCount: 0,
            events: [item],
          };
        } else if (event === "Verified") {
          const id = args.id;
          if (updatedTransfers[id]) {
            updatedTransfers[id].state = 2; // Verified
            updatedTransfers[id].executableAt = Number(args.executableAt);
            updatedTransfers[id].events.push(item);
          }
        } else if (event === "Executed") {
          const id = args.id;
          if (updatedTransfers[id]) {
            updatedTransfers[id].state = 3; // Executed
            updatedTransfers[id].events.push(item);
          }
        } else if (event === "Challenged") {
          const id = args.id;
          if (updatedTransfers[id]) {
            updatedTransfers[id].state = 4; // Challenged
            updatedTransfers[id].events.push(item);
          }
        } else if (event === "Refunded") {
          const id = args.id;
          if (updatedTransfers[id]) {
            updatedTransfers[id].state = 5; // Refunded
            updatedTransfers[id].events.push(item);
          }
        } else if (event === "Blessed") {
          const id = args.id;
          if (updatedTransfers[id]) {
            updatedTransfers[id].blessCount = (updatedTransfers[id].blessCount || 0) + 1;
            updatedTransfers[id].events.push(item);
          }
        }
      }

      store.setIndexedState({
        events: combinedEvents,
        transfers: updatedTransfers,
        lastIndexedBlock: toBlock,
        syncing: false,
      });
    } else {
      store.setIndexedState({
        lastIndexedBlock: toBlock,
        syncing: false,
      });
    }
  } catch (err) {
    console.warn("Indexer sync error:", err);
    store.setSyncing(false);
  }
}

