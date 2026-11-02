import { create } from "zustand";

export const useTxStore = create((set, get) => ({
  records: [],
  toasts: [],
  pendingRevert: null,

  addTxRecord: (record) => {
    set((state) => ({
      records: [record, ...state.records],
    }));
  },

  addToast: (toast) => {
    set((state) => ({
      toasts: [toast, ...state.toasts],
    }));

    // Auto dismiss after 6 seconds if resolved
    if (toast.status === "success" || toast.status === "failed") {
      setTimeout(() => {
        get().removeToast(toast.id);
      }, 6000);
    }
  },

  updateToast: (id, updates) => {
    set((state) => ({
      toasts: state.toasts.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));

    if (updates.status === "success" || updates.status === "failed") {
      setTimeout(() => {
        get().removeToast(id);
      }, 6000);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  setPendingRevert: (revertData) => {
    set({ pendingRevert: revertData });
  },

  clearPendingRevert: () => {
    set({ pendingRevert: null });
  },
}));
