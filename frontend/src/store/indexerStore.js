import { create } from "zustand";

export const useIndexerStore = create((set, get) => ({
  events: [],
  transfers: {}, // id -> { id, sender, recipient, netAmount, fee, nonce, createdAt, expiresAt, executableAt, isLarge, state, sigCount, blessCount, gasTotal, events: [] }
  incidents: [],
  alerts: [],
  proposals: [],
  scoreHistory: [],
  lastIndexedBlock: 0,
  syncing: false,

  setSyncing: (syncing) => set({ syncing }),

  resetIndexer: () => {
    set({
      events: [],
      transfers: {},
      incidents: [],
      alerts: [],
      proposals: [],
      scoreHistory: [],
      lastIndexedBlock: 0,
    });
  },

  addEvents: (newEvents, updatedTransfers) => {
    set((state) => ({
      events: [...newEvents, ...state.events],
      transfers: { ...state.transfers, ...updatedTransfers },
    }));
  },

  setIndexedState: (payload) => {
    set(payload);
  },
}));
