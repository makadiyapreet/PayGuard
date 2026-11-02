import { create } from "zustand";

export const useUiStore = create((set) => ({
  auditMode: false,
  presentationMode: false,
  theme: typeof window !== "undefined" ? localStorage.getItem("payguard-theme") || "dark" : "dark",

  toggleAuditMode: () => set((state) => ({ auditMode: !state.auditMode })),
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
