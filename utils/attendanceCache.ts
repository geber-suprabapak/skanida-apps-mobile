import AsyncStorage from "@react-native-async-storage/async-storage";

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: "present" | "absent" | "leave" | "sick";
  checkInTime?: string;
  checkOutTime?: string;
  leaveType?: string;
  description?: string;
  photo_url?: string;
  approval_status?: "pending" | "approved" | "rejected";
}

export class AttendanceCache {
  private static instance: AttendanceCache;
  private readonly CACHE_PREFIX = 'attendance_cache_';
  private readonly CACHE_DURATION = 2 * 60 * 1000; // 2 minutes for faster refresh
  private readonly MAX_CACHE_SIZE = 30; // Reduced cache size for better performance
  private readonly MEMORY_CACHE = new Map<string, CacheItem<Record<string, AttendanceRecord>>>();
  private readonly MEMORY_CACHE_DURATION = 30 * 1000; // 30 seconds in memory

  public static getInstance(): AttendanceCache {
    if (!AttendanceCache.instance) {
      AttendanceCache.instance = new AttendanceCache();
      // Setup memory cleanup interval
      setInterval(() => {
        AttendanceCache.instance.cleanupMemoryCache();
      }, 60000); // Clean every minute
    }
    return AttendanceCache.instance;
  }

  private getKey(userId: string, year: number, month: number): string {
    return `${this.CACHE_PREFIX}${userId}_${year}_${month}`;
  }

  private getMetadataKey(): string {
    return `${this.CACHE_PREFIX}metadata`;
  }

  async set(
    userId: string,
    year: number,
    month: number,
    data: Record<string, AttendanceRecord>,
  ): Promise<void> {
    try {
      const key = this.getKey(userId, year, month);
      const cacheItem: CacheItem<Record<string, AttendanceRecord>> = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + this.CACHE_DURATION,
      };

      // Store in memory cache for ultra-fast access
      this.MEMORY_CACHE.set(key, {
        ...cacheItem,
        expiry: Date.now() + this.MEMORY_CACHE_DURATION
      });

      // Store in AsyncStorage for persistence
      await AsyncStorage.setItem(key, JSON.stringify(cacheItem));
      await this.updateMetadata(key);
      await this.cleanupOldCache();
      
      console.log(`✅ Cached attendance data for ${year}-${month + 1} (memory + storage)`);
    } catch (error) {
      console.error("Error setting cache:", error);
    }
  }

  async get(
    userId: string,
    year: number,
    month: number,
  ): Promise<Record<string, AttendanceRecord> | null> {
    try {
      const key = this.getKey(userId, year, month);
      
      // Check memory cache first (ultra-fast)
      const memoryCache = this.MEMORY_CACHE.get(key);
      if (memoryCache && Date.now() < memoryCache.expiry) {
        console.log(`🚀 Memory cache hit for ${year}-${month + 1}`);
        return memoryCache.data;
      }

      // Remove expired memory cache
      if (memoryCache) {
        this.MEMORY_CACHE.delete(key);
      }

      // Check AsyncStorage cache
      const cached = await AsyncStorage.getItem(key);

      if (!cached) {
        console.log(`❌ No cache found for ${year}-${month + 1}`);
        return null;
      }

      const cacheItem: CacheItem<Record<string, AttendanceRecord>> =
        JSON.parse(cached);

      // Check if cache has expired
      if (Date.now() > cacheItem.expiry) {
        console.log(`⏰ Cache expired for ${year}-${month + 1}`);
        await AsyncStorage.removeItem(key);
        await this.removeFromMetadata(key);
        return null;
      }

      // Store in memory for next access
      this.MEMORY_CACHE.set(key, {
        ...cacheItem,
        expiry: Date.now() + this.MEMORY_CACHE_DURATION
      });

      console.log(`✅ Storage cache hit for ${year}-${month + 1}`);
      return cacheItem.data;
    } catch (error) {
      console.error("Error getting cache:", error);
      return null;
    }
  }

  async invalidate(userId: string, year: number, month: number): Promise<void> {
    try {
      const key = this.getKey(userId, year, month);
      
      // Remove from memory cache
      this.MEMORY_CACHE.delete(key);
      
      // Remove from AsyncStorage
      await AsyncStorage.removeItem(key);
      await this.removeFromMetadata(key);
      console.log(`🗑️ Invalidated cache for ${year}-${month + 1}`);
    } catch (error) {
      console.error("Error invalidating cache:", error);
    }
  }

  async invalidateUser(userId: string): Promise<void> {
    try {
      // Clear memory cache for user
      const memoryKeysToDelete = Array.from(this.MEMORY_CACHE.keys()).filter(key => 
        key.includes(`${this.CACHE_PREFIX}${userId}_`)
      );
      memoryKeysToDelete.forEach(key => this.MEMORY_CACHE.delete(key));

      // Clear AsyncStorage cache for user
      const metadata = await this.getMetadata();
      const userKeys = metadata.filter((key) =>
        key.includes(`${this.CACHE_PREFIX}${userId}_`),
      );

      await Promise.all([
        ...userKeys.map((key) => AsyncStorage.removeItem(key)),
        this.setMetadata(metadata.filter((key) => !userKeys.includes(key))),
      ]);
      
      console.log(`🗑️ Invalidated all cache for user ${userId} (memory + storage)`);
    } catch (error) {
      console.error("Error invalidating user cache:", error);
    }
  }

  async clear(): Promise<void> {
    try {
      // Clear memory cache
      this.MEMORY_CACHE.clear();
      
      // Clear AsyncStorage cache
      const metadata = await this.getMetadata();
      await Promise.all([
        ...metadata.map((key) => AsyncStorage.removeItem(key)),
        AsyncStorage.removeItem(this.getMetadataKey()),
      ]);
      console.log('🗑️ Cleared all attendance cache (memory + storage)');
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  }

  // Add method to force refresh current month
  async forceRefreshCurrentMonth(userId: string): Promise<void> {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      await this.invalidate(userId, currentYear, currentMonth);
      console.log(`🔄 Force refreshed current month cache for user ${userId}`);
    } catch (error) {
      console.error('Error force refreshing current month:', error);
    }
  }

  // Clean up expired memory cache periodically
  cleanupMemoryCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    this.MEMORY_CACHE.forEach((value, key) => {
      if (now > value.expiry) {
        expiredKeys.push(key);
      }
    });
    
    expiredKeys.forEach(key => this.MEMORY_CACHE.delete(key));
    
    if (expiredKeys.length > 0) {
      console.log(`🧹 Cleaned ${expiredKeys.length} expired memory cache items`);
    }
  }

  private async updateMetadata(key: string): Promise<void> {
    try {
      const metadata = await this.getMetadata();
      if (!metadata.includes(key)) {
        metadata.push(key);
        await this.setMetadata(metadata);
      }
    } catch (error) {
      console.error("Error updating metadata:", error);
    }
  }

  private async removeFromMetadata(key: string): Promise<void> {
    try {
      const metadata = await this.getMetadata();
      const updatedMetadata = metadata.filter((item) => item !== key);
      await this.setMetadata(updatedMetadata);
    } catch (error) {
      console.error("Error removing from metadata:", error);
    }
  }

  private async getMetadata(): Promise<string[]> {
    try {
      const metadata = await AsyncStorage.getItem(this.getMetadataKey());
      return metadata ? JSON.parse(metadata) : [];
    } catch (error) {
      console.error("Error getting metadata:", error);
      return [];
    }
  }

  private async setMetadata(metadata: string[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.getMetadataKey(),
        JSON.stringify(metadata),
      );
    } catch (error) {
      console.error("Error setting metadata:", error);
    }
  }

  private async cleanupOldCache(): Promise<void> {
    try {
      const metadata = await this.getMetadata();

      if (metadata.length <= this.MAX_CACHE_SIZE) {
        return;
      }

      // Get cache items with their timestamps
      const cacheItems = await Promise.all(
        metadata.map(async (key) => {
          try {
            const cached = await AsyncStorage.getItem(key);
            if (cached) {
              const cacheItem = JSON.parse(cached);
              return { key, timestamp: cacheItem.timestamp };
            }
          } catch (error) {
            console.error(`Error reading cache item ${key}:`, error);
          }
          return { key, timestamp: 0 };
        }),
      );

      // Sort by timestamp (oldest first)
      cacheItems.sort((a, b) => a.timestamp - b.timestamp);

      // Remove oldest items
      const itemsToRemove = cacheItems.slice(
        0,
        metadata.length - this.MAX_CACHE_SIZE,
      );
      await Promise.all(
        itemsToRemove.map((item) => AsyncStorage.removeItem(item.key)),
      );

      // Update metadata
      const updatedMetadata = metadata.filter(
        (key) => !itemsToRemove.some((item) => item.key === key),
      );
      await this.setMetadata(updatedMetadata);

      console.log(`🧹 Cleaned up ${itemsToRemove.length} old cache items`);
    } catch (error) {
      console.error("Error cleaning up cache:", error);
    }
  }

  async getCacheStats(): Promise<{
    totalItems: number;
    totalSize: string;
    oldestEntry: string | null;
    newestEntry: string | null;
  }> {
    try {
      const metadata = await this.getMetadata();
      let totalSize = 0;
      let oldestTimestamp = Infinity;
      let newestTimestamp = 0;

      for (const key of metadata) {
        try {
          const cached = await AsyncStorage.getItem(key);
          if (cached) {
            totalSize += cached.length;
            const cacheItem = JSON.parse(cached);
            oldestTimestamp = Math.min(oldestTimestamp, cacheItem.timestamp);
            newestTimestamp = Math.max(newestTimestamp, cacheItem.timestamp);
          }
        } catch (error) {
          console.error(`Error reading cache stats for ${key}:`, error);
        }
      }

      return {
        totalItems: metadata.length,
        totalSize: `${(totalSize / 1024).toFixed(2)} KB`,
        oldestEntry:
          oldestTimestamp !== Infinity
            ? new Date(oldestTimestamp).toLocaleString()
            : null,
        newestEntry:
          newestTimestamp > 0
            ? new Date(newestTimestamp).toLocaleString()
            : null,
      };
    } catch (error) {
      console.error("Error getting cache stats:", error);
      return {
        totalItems: 0,
        totalSize: "0 KB",
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }
}

export const attendanceCache = AttendanceCache.getInstance();
