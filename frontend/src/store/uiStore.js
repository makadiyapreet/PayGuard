import { create } from "zustand";

export const useUiStore = create((set) => ({
  vivaMode: false,
  presentationMode: false,
  theme: typeof window !== "undefined" ? localStorage.getItem("payguard-theme") || "dark" : "dark",

  toggleVivaMode: () => set((state) => ({ vivaMode: !state.vivaMode })),
  togglePresentationMode: () => set((state) => ({ presentationMode: !state.presentationMode })),
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") {
        localStorage.setItem("payguard-theme", next);
      }
      return { theme: next };
    }),
  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("payguard-theme", theme);
    }
    set({ theme });
  },
}));
