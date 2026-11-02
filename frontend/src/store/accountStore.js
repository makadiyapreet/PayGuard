import { create } from "zustand";
import { initWallets, getAccounts } from "../lib/wallets.js";
import { getProvider, getContractInstance } from "../lib/chain.js";
import { formatEther } from "ethers";

export const useAccountStore = create((set, get) => ({
  accounts: [],
  activeAccountIndex: 13, // Default #13 User
  balances: {},
  liveRoles: {}, // addr -> { isGuardian, isNode, isBot, isOwner, isBlacklisted }
  loading: false,

  initAccounts: async () => {
    set({ loading: true });
    try {
      const { wallets } = await initWallets();
      set({ accounts: wallets, loading: false });
      await get().refreshBalances();
      await get().refreshLiveRoles();
    } catch (err) {
      console.error("Failed to init accounts:", err);
      set({ loading: false });
    }
  },

  setActiveAccountIndex: (idx) => {
    set({ activeAccountIndex: idx });
  },

  refreshBalances: async () => {
    const provider = getProvider();
    const accounts = get().accounts;
    const balances = {};

    await Promise.all(
      accounts.map(async (acc) => {
        try {
          const bal = await provider.getBalance(acc.address);
          balances[acc.address.toLowerCase()] = formatEther(bal);
        } catch {
          balances[acc.address.toLowerCase()] = "0.0";
        }
      })
    );

    set({ balances });
  },

  refreshLiveRoles: async () => {
    const accounts = get().accounts;
    if (!accounts.length) return;

    try {
      const registry = await getContractInstance("GuardianRegistry");
      const rmn = await getContractInstance("RiskManagement");
      const detection = await getContractInstance("DetectionNetwork");
      const monitor = await getContractInstance("DefenderMonitor");

      const liveRoles = {};

      await Promise.all(
        accounts.map(async (acc) => {
          const addr = acc.address;
          const [isG, isN, isB, isO, isBl] = await Promise.all([
            registry.isGuardian(addr).catch(() => false),
            rmn.isNode(addr).catch(() => false),
            detection.isBot(addr).catch(() => false),
            monitor.isOwner(addr).catch(() => false),
            monitor.isBlacklisted(addr).catch(() => false),
          ]);

          liveRoles[addr.toLowerCase()] = {
            isGuardian: isG,
            isNode: isN,
            isBot: isB,
            isOwner: isO,
            isBlacklisted: isBl,
          };
        })
      );

      set({ liveRoles });
    } catch (err) {
      console.warn("Could not query live roles:", err.message);
    }
  },
}));

