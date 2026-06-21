// utils/timeSync.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import { ensureSupabaseInitialized } from "./supabase";
import { getServerTime } from "~/utils/bffMobileApi";
import useTimeSyncStore from "~/store/timeSyncStore";

interface ServerTimeResponse {
  now: string;
  timezone: string;
  source: "bff";
  epoch_ms: number;
}

interface NTPResponse {
  datetime: string;
  unixtime: number;
}

interface PersistedSyncData {
  offset: number;
  timestamp: number;
  source: "server" | "ntp" | "local";
}

/**
 * TimeSync - Centralized time synchronization system
 *
 * This singleton class manages time synchronization between the device and server,
 * ensuring consistent and accurate time across the application.
 *
 * **Synchronization Strategy:**
 * 1. Primary: Mobile BFF time endpoint - Most reliable, uses app's own backend
 * 2. Fallback: WorldTimeAPI (NTP alternative) - Public API when backend is unavailable
 * 3. Last Resort: Local device time - Used when all network sync methods fail
 *
 * **Features:**
 * - Persistent offset caching (1-hour expiry) for fast cold starts
 * - Background sync every 15 minutes when app is active
 * - Automatic sync on app resume
 * - Drift detection (5-second threshold) for clock changes
 * - Network delay compensation using round-trip time
 *
 * **Usage Pattern:**
 * ```typescript
 * // Initialize on app startup (in _layout.tsx)
 * await timeSync.initialize();
 *
 * // Get current server-synced time
 * const now = timeSync.getSyncedTime(); // Returns Date object
 *
 * // Display time (auto-converts to device timezone)
 * const displayTime = format(now, "HH:mm:ss");
 *
 * // Get date for database queries
 * const dateString = formatDateWIB(now); // "YYYY-MM-DD"
 *
 * // Cleanup on unmount
 * timeSync.cleanup();
 * ```
 *
 * **Important Notes:**
 * - getSyncedTime() returns UTC Date object that auto-displays in device timezone
 * - DO NOT manually add timezone offset for display - it's automatic!
 * - Offset is time difference between server and device, NOT timezone offset
 */
class TimeSync {
  private timeOffset: number = 0;
  private lastSyncTime: number = 0;
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly BACKGROUND_SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes
  private readonly DRIFT_THRESHOLD = 5000; // 5 seconds
  private readonly STORAGE_KEY = "time_sync_data";
  private syncPromise: Promise<void> | null = null;
  private backgroundSyncTimer: NodeJS.Timeout | null = null;
  private appStateSubscription: any = null;
  private isInitialized: boolean = false;

  // PERF-C03: Background timers are started in initialize(), not at import time.

  /**
   * Initialize time sync with persisted data
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Ensure Supabase is initialized first
      await ensureSupabaseInitialized();

      // Load persisted offset
      await this.loadPersistedOffset();

      // Perform initial sync
      await this.syncWithServer();

      // PERF-C03: Only start background sync AFTER initialization
      this.setupBackgroundSync();

      this.isInitialized = true;
      if (__DEV__) console.log("TimeSync initialized");
    } catch (error) {
      if (__DEV__) console.error("TimeSync initialization failed:", error);
      useTimeSyncStore.getState().setStatus("failed");
    }
  }

  /**
   * Load persisted offset from AsyncStorage
   */
  private async loadPersistedOffset(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);

      if (stored) {
        const data: PersistedSyncData = JSON.parse(stored);
        const age = Date.now() - data.timestamp;

        // Use persisted offset if less than 1 hour old
        if (age < 60 * 60 * 1000) {
          this.timeOffset = data.offset;
          this.lastSyncTime = data.timestamp;

          // PERF-H03: Batch store update (was 3 separate calls = 3 re-renders)
          useTimeSyncStore.setState({
            offset: data.offset,
            syncSource: data.source,
            lastSyncTime: data.timestamp,
          });

          if (__DEV__)
            console.log("Loaded persisted offset:", {
              offset: data.offset,
              age: `${Math.round(age / 1000)}s`,
              source: data.source,
            });
        } else {
          if (__DEV__) console.log("Persisted offset too old, will sync fresh");
        }
      }
    } catch (error) {
      if (__DEV__) console.error("Failed to load persisted offset:", error);
    }
  }

  /**
   * Persist offset to AsyncStorage
   */
  private async persistOffset(
    offset: number,
    source: "server" | "ntp" | "local",
  ): Promise<void> {
    try {
      const data: PersistedSyncData = {
        offset,
        timestamp: Date.now(),
        source,
      };

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      if (__DEV__) console.log("Persisted offset to storage");
    } catch (error) {
      if (__DEV__) console.error("Failed to persist offset:", error);
    }
  }

  /**
   * Setup background sync when app is in foreground
   */
  private setupBackgroundSync(): void {
    // Background sync timer
    this.backgroundSyncTimer = setInterval(() => {
      this.syncWithServer().catch((error) => {
        if (__DEV__) console.error("Background sync failed:", error);
      });
    }, this.BACKGROUND_SYNC_INTERVAL);

    // App state listener for sync on resume
    this.appStateSubscription = AppState.addEventListener(
      "change",
      this.handleAppStateChange.bind(this),
    );

    if (__DEV__) console.log("Background sync enabled");
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === "active") {
      if (__DEV__) console.log("App became active, syncing time...");
      this.syncWithServer().catch((error) => {
        if (__DEV__) console.error("App resume sync failed:", error);
      });
    }
  }

  /**
   * Get synchronized time based on server offset
   */
  getSyncedTime(): Date {
    return new Date(Date.now() + this.timeOffset);
  }

  /**
   * Get the current time offset in milliseconds
   */
  getTimeOffset(): number {
    return this.timeOffset;
  }

  /**
   * Check if a sync is needed based on last sync time
   */
  private shouldSync(): boolean {
    return Date.now() - this.lastSyncTime > this.SYNC_INTERVAL;
  }

  /**
   * Detect time drift by comparing old and new offset
   */
  private detectDrift(newOffset: number): boolean {
    if (this.timeOffset === 0) return false; // First sync

    const drift = Math.abs(newOffset - this.timeOffset);
    const hasDrift = drift > this.DRIFT_THRESHOLD;

    if (hasDrift) {
      if (__DEV__)
        console.warn("Time drift detected:", {
          oldOffset: this.timeOffset,
          newOffset,
          drift: `${drift}ms`,
        });

      useTimeSyncStore.getState().setDriftDetected(true);
    } else {
      // Reset drift flag when within acceptable limits
      useTimeSyncStore.getState().setDriftDetected(false);
    }

    return hasDrift;
  }

  /**
   * Sync time with server
   * Returns true if sync was successful, false otherwise
   */
  async syncWithServer(): Promise<boolean> {
    // If there's an ongoing sync, wait for it
    if (this.syncPromise) {
      try {
        await this.syncPromise;
        return true;
      } catch (error) {
        // If waiting sync failed, allow retry
        if (__DEV__) console.error("Previous time sync attempt failed:", error);
        this.syncPromise = null;
      }
    }

    // If recently synced, no need to sync again
    if (!this.shouldSync()) {
      return true;
    }

    this.syncPromise = this._performSync();
    try {
      await this.syncPromise;
      return true;
    } catch (error) {
      if (__DEV__) console.error("Time sync failed:", error);
      useTimeSyncStore.getState().setStatus("failed");
      useTimeSyncStore
        .getState()
        .setError(error instanceof Error ? error.message : "Unknown error");
      return false;
    } finally {
      this.syncPromise = null;
    }
  }

  private async _performSync(): Promise<void> {
    try {
      useTimeSyncStore.getState().setStatus("syncing");

      // Try server sync first
      try {
        await this._syncWithServerEdgeFunction();
        return;
      } catch (serverError) {
        if (__DEV__)
          console.warn(
            "Server sync failed, trying NTP fallback...",
            serverError,
          );
      }

      // Fallback to NTP
      try {
        await this._syncWithNTP();
        return;
      } catch (ntpError) {
        if (__DEV__) console.warn("NTP sync failed", ntpError);
      }

      // If both fail, use local time (offset = 0)
      if (__DEV__) console.warn("All sync methods failed, using local time");
      this.timeOffset = 0;
      this.lastSyncTime = Date.now();

      // PERF-H03: Batch store update (was 3 separate calls)
      useTimeSyncStore.setState({
        offset: 0,
        syncSource: "local",
        status: "failed",
      });

      await this.persistOffset(0, "local");
    } catch (error) {
      if (__DEV__) console.error("Sync process failed:", error);
      throw error;
    }
  }

  /**
   * Sync with the BFF time endpoint.
   */
  private async _syncWithServerEdgeFunction(): Promise<void> {
    const requestTime = Date.now();

    const data: ServerTimeResponse = await getServerTime();

    const responseTime = Date.now();
    const roundTripTime = responseTime - requestTime;

    if (!data?.now) {
      throw new Error("Invalid server time response");
    }

    const serverTime = new Date(data.now).getTime();

    // Estimate server time accounting for network delay (assume symmetric)
    const estimatedServerTime = serverTime + roundTripTime / 2;

    // Calculate offset (difference between server UTC and local time)
    const newOffset = estimatedServerTime - responseTime;

    // Detect drift
    this.detectDrift(newOffset);

    // Update offset
    this.timeOffset = newOffset;
    this.lastSyncTime = Date.now();

    // Update store
    // PERF-H03: Batch store update (was 5 separate calls = 5 re-renders)
    useTimeSyncStore.setState({
      offset: newOffset,
      syncSource: "server",
      status: "synced",
      lastSyncTime: Date.now(),
      error: null,
    });

    // Persist
    await this.persistOffset(newOffset, "server");

    if (__DEV__)
      console.log("Server sync successful", {
        offset: newOffset,
        roundTripTime,
        serverTime: data.now,
        timezone: data.timezone,
        localTime: new Date(responseTime).toISOString(),
      });
  }

  /**
   * Sync with NTP server (fallback)
   */
  private async _syncWithNTP(): Promise<void> {
    const requestTime = Date.now();

    // Using WorldTimeAPI as NTP alternative
    const response = await fetch(
      "https://worldtimeapi.org/api/timezone/Asia/Jakarta",
    );

    const responseTime = Date.now();
    const roundTripTime = responseTime - requestTime;

    if (!response.ok) {
      throw new Error(`NTP request failed: ${response.status}`);
    }

    const data: NTPResponse = await response.json();

    if (!data.datetime) {
      throw new Error("Invalid NTP response");
    }

    // Parse NTP time
    const ntpTime = new Date(data.datetime).getTime();

    // Estimate NTP time accounting for network delay
    const estimatedNtpTime = ntpTime + roundTripTime / 2;

    // Calculate new offset
    const newOffset = estimatedNtpTime - responseTime;

    // Detect drift
    this.detectDrift(newOffset);

    // Update offset
    this.timeOffset = newOffset;
    this.lastSyncTime = Date.now();

    // Update store
    // PERF-H03: Batch store update (was 5 separate calls = 5 re-renders)
    useTimeSyncStore.setState({
      offset: newOffset,
      syncSource: "ntp",
      status: "synced",
      lastSyncTime: Date.now(),
      error: null,
    });

    // Persist
    await this.persistOffset(newOffset, "ntp");

    if (__DEV__)
      console.log("NTP sync successful", {
        offset: newOffset,
        roundTripTime,
        ntpTime: data.datetime,
      });
  }

  /**
   * Force an immediate sync regardless of last sync time
   */
  async forceSyncWithServer(): Promise<boolean> {
    this.lastSyncTime = 0; // Reset last sync time to force sync
    return this.syncWithServer();
  }

  /**
   * Cleanup timers and subscriptions
   */
  cleanup(): void {
    if (this.backgroundSyncTimer) {
      clearInterval(this.backgroundSyncTimer);
      this.backgroundSyncTimer = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    if (__DEV__) console.log("TimeSync cleanup complete");
  }
}

// Export singleton instance
export const timeSync = new TimeSync();
