import { getProvider } from "./chain.js";

let latestBlockTimestamp = Math.floor(Date.now() / 1000);
let latestBlockFetchedAt = Date.now();

export function updateChainTime(blockTimestamp) {
  latestBlockTimestamp = Number(blockTimestamp);
  latestBlockFetchedAt = Date.now();
}

export function getChainNow() {
  const elapsedSec = (Date.now() - latestBlockFetchedAt) / 1000;
  return Math.floor(latestBlockTimestamp + elapsedSec);
}

export async function advanceTimeAndMine(seconds) {
  const provider = getProvider();
  await provider.send("evm_increaseTime", [Number(seconds)]);
  await provider.send("evm_mine", []);
  const block = await provider.getBlock("latest");
  if (block) {
    updateChainTime(block.timestamp);
  }
  return block;
}

export async function mineBlock() {
  const provider = getProvider();
  await provider.send("evm_mine", []);
  const block = await provider.getBlock("latest");
  if (block) {
    updateChainTime(block.timestamp);
  }
  return block;
}

