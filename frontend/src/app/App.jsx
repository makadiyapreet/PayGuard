import React, { useEffect } from "react";
import { AppRoutes } from "./routes.jsx";
import { GlobalBanner } from "./shell/GlobalBanner.jsx";
import { TopBar } from "./shell/TopBar.jsx";
import { Sidebar } from "./shell/Sidebar.jsx";
import { TxToastContainer } from "../components/TxToast.jsx";
import { RevertExplainer } from "../components/RevertExplainer.jsx";

import { useChainStore } from "../store/chainStore.js";
import { useAccountStore } from "../store/accountStore.js";
import { useUiStore } from "../store/uiStore.js";
import { startIndexer, stopIndexer } from "../lib/indexer.js";

export function App() {
  const initChain = useChainStore((s) => s.initChain);
  const refreshLiveState = useChainStore((s) => s.refreshLiveState);
  const initAccounts = useAccountStore((s) => s.initAccounts);
  const refreshBalances = useAccountStore((s) => s.refreshBalances);
  const refreshLiveRoles = useAccountStore((s) => s.refreshLiveRoles);
  const theme = useUiStore((s) => s.theme);

  // Sync theme with html element
  useEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    }
  }, [theme]);

  useEffect(() => {
    let timer = null;

    async function setup() {
      await initChain();
      await initAccounts();
      await startIndexer();

      // Periodic state & balances refresh
      timer = setInterval(async () => {
        try {
          await refreshLiveState();
          await refreshBalances();
          await refreshLiveRoles();
        } catch (e) {
          console.warn("Poll refresh warning:", e);
        }
      }, 2500);
    }

    setup();

    return () => {
      if (timer) clearInterval(timer);
      stopIndexer();
    };
  }, [initChain, initAccounts, refreshLiveState, refreshBalances, refreshLiveRoles]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0b0f19] text-[#f1f5f9]">
      <GlobalBanner />
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 bg-[#0b0f19]">
          <AppRoutes />
        </main>
      </div>

      <TxToastContainer />
      <RevertExplainer />
    </div>
  );
}

export default App;
