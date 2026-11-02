import { create } from "zustand";

export const useUiStore = create((set) => ({
  vivaMode: false,
  presentationMode: false,
  theme: "dark",

  toggleVivaMode: () => set((state) => ({ vivaMode: !state.vivaMode })),
  togglePresentationMode: () => set((state) => ({ presentationMode: !state.presentationMode })),
  setTheme: (theme) => set({ theme }),
}));
