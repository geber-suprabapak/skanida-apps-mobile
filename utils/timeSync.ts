// utils/timeSync.ts
import { supabase } from "./supabase";

interface ServerTimeResponse {
  serverTime: string;
  serverTimeUTC7: string;
  formattedUTC7: string;
}

class TimeSync {
  private timeOffset: number = 0;
  private lastSyncTime: number = 0;
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private syncPromise: Promise<void> | null = null;

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
   * Sync time with server
   * Returns true if sync was successful, false otherwise
   */
  async syncWithServer(): Promise<boolean> {
    // If there's an ongoing sync, wait for it
    if (this.syncPromise) {
      await this.syncPromise;
      return true;
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
      console.error("Time sync failed:", error);
      return false;
    } finally {
      this.syncPromise = null;
    }
  }

  private async _performSync(): Promise<void> {
    try {
      const requestTime = Date.now();

      const { data, error } =
        await supabase.functions.invoke<ServerTimeResponse>("timesync", {
          method: "GET",
        });

      const responseTime = Date.now();
      const roundTripTime = responseTime - requestTime;

      if (error) {
        throw new Error(`Time sync error: ${error.message}`);
      }

      if (!data || !data.serverTimeUTC7) {
        throw new Error("Invalid server time response");
      }

      // Parse server time (UTC+7)
      const serverTime = new Date(data.serverTimeUTC7).getTime();

      // Estimate server time accounting for network delay (assume symmetric)
      const estimatedServerTime = serverTime + roundTripTime / 2;

      // Calculate offset
      this.timeOffset = estimatedServerTime - responseTime;
      this.lastSyncTime = Date.now();

      console.log("Time sync successful", {
        offset: this.timeOffset,
        roundTripTime,
        serverTime: data.serverTimeUTC7,
      });
    } catch (error) {
      console.error("Failed to sync time with server:", error);
      throw error;
    }
  }

  /**
   * Force an immediate sync regardless of last sync time
   */
  async forceSyncWithServer(): Promise<boolean> {
    this.lastSyncTime = 0; // Reset last sync time to force sync
    return this.syncWithServer();
  }
}

// Export singleton instance
export const timeSync = new TimeSync();
