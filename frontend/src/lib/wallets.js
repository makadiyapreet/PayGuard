import { HDNodeWallet, Mnemonic, recoverAddress } from "ethers";
import { getProvider } from "./chain.js";
import { getRoleMeta } from "./roles.js";

const DEFAULT_MNEMONIC =
  import.meta.env.VITE_MNEMONIC ||
  "myth like bonus scare over problem client lizard pioneer submit female collect";

let derivedWallets = [];
let walletMode = "dev"; // "dev" | "unlocked"

export async function initWallets() {
  const provider = getProvider();
  derivedWallets = [];

  try {
    const rpcAccounts = await provider.send("eth_accounts", []);
    const mnemonic = Mnemonic.fromPhrase(DEFAULT_MNEMONIC);

    // Derive 15 accounts
    const wallets = [];
    for (let i = 0; i < 15; i++) {
      const path = `m/44'/60'/0'/0/${i}`;
      const wallet = HDNodeWallet.fromMnemonic(mnemonic, path).connect(provider);
      wallets.push({
        index: i,
        address: wallet.address,
        wallet,
        meta: getRoleMeta(i),
      });
    }

    // Verify account 0 matches Ganache's primary account
    if (rpcAccounts.length > 0 && wallets[0].address.toLowerCase() !== rpcAccounts[0].toLowerCase()) {
      console.warn(
        `Mnemonic mismatch: derived ${wallets[0].address} vs RPC ${rpcAccounts[0]}. Falling back to unlocked mode.`
      );
      walletMode = "unlocked";
      derivedWallets = rpcAccounts.slice(0, 15).map((addr, idx) => ({
        index: idx,
        address: addr,
        wallet: null, // Will use provider.getSigner(addr)
        meta: getRoleMeta(idx),
      }));
    } else {
      walletMode = "dev";
      derivedWallets = wallets;
    }
  } catch (err) {
    console.error("Wallet initialization error:", err);
    walletMode = "unlocked";
  }

  return { wallets: derivedWallets, mode: walletMode };
}

export function getAccounts() {
  return derivedWallets;
}

export async function getSignerForAccount(indexOrAddress) {
  const provider = getProvider();
  const acc = typeof indexOrAddress === "number"
    ? derivedWallets[indexOrAddress]
    : derivedWallets.find((w) => w.address.toLowerCase() === indexOrAddress.toLowerCase());

  if (!acc) throw new Error(`Account not found: ${indexOrAddress}`);

  if (acc.wallet) {
    return acc.wallet;
  }
  return await provider.getSigner(acc.address);
}

export function getWalletMode() {
  return walletMode;
}

