import { JsonRpcProvider, Contract } from "ethers";

const RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:7545";

let providerInstance = null;
let contractsRegistry = null;

export function getProvider() {
  if (!providerInstance) {
    providerInstance = new JsonRpcProvider(RPC_URL, undefined, {
      pollingInterval: 1000,
    });
  }
  return providerInstance;
}

export async function fetchContractsRegistry() {
  if (contractsRegistry) return contractsRegistry;
  try {
    const res = await fetch("/generated/contracts.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    contractsRegistry = await res.json();
    return contractsRegistry;
  } catch (err) {
    console.warn("Failed to load /generated/contracts.json:", err.message);
    return null;
  }
}

export async function getContractInstance(name, runner) {
  const reg = await fetchContractsRegistry();
  if (!reg || !reg.contracts || !reg.contracts[name]) {
    throw new Error(`Contract metadata not found for ${name}`);
  }
  const { address, abi } = reg.contracts[name];
  return new Contract(address, abi, runner || getProvider());
}

export async function getAuxArtifact(name) {
  const reg = await fetchContractsRegistry();
  if (!reg || !reg.artifacts || !reg.artifacts[name]) {
    throw new Error(`Artifact metadata not found for ${name}`);
  }
  return reg.artifacts[name];
}

