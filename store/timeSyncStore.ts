// store/timeSyncStore.ts
import { create } from "zustand";

export type SyncStatus = "idle" | "syncing" | "synced" | "failed";

interface TimeSyncState {
  status: SyncStatus;
  lastSyncTime: number | null;
  offset: number;
  driftDetected: boolean;
  syncSource: "server" | "ntp" | "local";
  error: string | null;

  // Actions
  setStatus: (status: SyncStatus) => void;
  setLastSyncTime: (time: number) => void;
  setOffset: (offset: number) => void;
  setDriftDetected: (detected: boolean) => void;
  setSyncSource: (source: "server" | "ntp" | "local") => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const useTimeSyncStore = create<TimeSyncState>((set) => ({
  status: "idle",
  lastSyncTime: null,
  offset: 0,
  driftDetected: false,
  syncSource: "local",
  error: null,

  setStatus: (status) => set({ status }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),
  setOffset: (offset) => set({ offset }),
  setDriftDetected: (detected) => set({ driftDetected: detected }),
  setSyncSource: (source) => set({ syncSource: source }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      status: "idle",
      lastSyncTime: null,
      offset: 0,
      driftDetected: false,
      syncSource: "local",
      error: null,
    }),
}));

export default useTimeSyncStore;
