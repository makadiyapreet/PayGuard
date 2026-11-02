import { create } from "zustand";
import { getProvider, fetchContractsRegistry, getContractInstance } from "../lib/chain.js";
import { updateChainTime, getChainNow } from "../lib/time.js";
import { formatEther } from "ethers";

export const useChainStore = create((set, get) => ({
  connected: false,
  error: null,
  blockNumber: 0,
  networkId: 5777,
  chainId: 1337,
  chainTime: 0,
  contracts: {},
  
  // Live Protocol State
  paused: false,
  cursed: false,
  riskScore: 100,
  riskBand: 0, // 0: LOW, 1: MED, 2: HIGH, 3: CRIT
  perTxLimitEff: "10",
  bridgeBalance: "0",
  tokenSupply: "0",
  rewardPool: "0",

  initChain: async () => {
    try {
      const provider = getProvider();
      const network = await provider.getNetwork();
      const block = await provider.getBlock("latest");
      const reg = await fetchContractsRegistry();

      if (block) {
        updateChainTime(block.timestamp);
      }

      set({
        connected: true,
        blockNumber: block ? block.number : 0,
        chainId: Number(network.chainId),
        chainTime: block ? block.timestamp : Math.floor(Date.now() / 1000),
        contracts: reg ? reg.contracts : {},
        error: null,
      });

      // Poll state
      await get().refreshLiveState();
    } catch (err) {
      console.error("Chain initialization error:", err);
      set({ connected: false, error: err.message });
    }
  },

  refreshLiveState: async () => {
    try {
      const provider = getProvider();
      const reg = await fetchContractsRegistry();
      if (!reg || !reg.contracts.PaymentBridge) return;

      const block = await provider.getBlock("latest");
      if (block) {
        updateChainTime(block.timestamp);
        set({ blockNumber: block.number, chainTime: getChainNow() });
      }

      const bridgeAddr = reg.contracts.PaymentBridge.address;
      const bridgeContract = await getContractInstance("PaymentBridge");
      const rmnContract = await getContractInstance("RiskManagement");
      const riskContract = await getContractInstance("RiskScore");
      const guardContract = await getContractInstance("InvariantGuard");
      const tokenContract = await getContractInstance("WrappedToken");
      const detectContract = await getContractInstance("DetectionNetwork");

      // Parallel view calls
      const [
        bridgeEthWei,
        tokenSupplyWei,
        isPaused,
        isCursed,
        score,
        band,
        effLimitWei,
        rewardPoolWei,
      ] = await Promise.all([
        provider.getBalance(bridgeAddr),
        tokenContract.totalSupply(),
        bridgeContract.paused(),
        rmnContract.isCursed(),
        riskContract.getScore(),
        riskContract.getBand(),
        guardContract.effectivePerTxLimit(),
        detectContract.rewardPool(),
      ]);

      set({
        bridgeBalance: formatEther(bridgeEthWei),
        tokenSupply: formatEther(tokenSupplyWei),
        paused: isPaused,
        cursed: isCursed,
        riskScore: Number(score),
        riskBand: Number(band),
        perTxLimitEff: formatEther(effLimitWei),
        rewardPool: formatEther(rewardPoolWei),
      });
    } catch (err) {
      console.warn("Could not refresh live state:", err.message);
    }
  },
}));
