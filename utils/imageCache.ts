/**
 * Image Cache Management Utility
 * Provides memory-safe image preloading and cache management
 */

import { Image } from "expo-image";

// Configuration
const IMAGE_CACHE_CONFIG = {
  // Maximum number of images to preload at once
  MAX_PRELOAD_BATCH: 3,
  // Maximum total images to keep in active preload queue
  MAX_PRELOAD_QUEUE: 10,
  // Delay between preload batches (ms)
  PRELOAD_BATCH_DELAY: 500,
} as const;

/**
 * Preload a single image URL with error handling
 */
const preloadImageSafe = async (uri: string): Promise<boolean> => {
  try {
    await Image.prefetch(uri, {
      cachePolicy: "memory-disk",
    });
    return true;
  } catch (error) {
    console.warn(`Failed to preload image: ${uri}`, error);
    return false;
  }
};

/**
 * Preload multiple images in controlled batches to prevent memory spike
 * @param uris Array of image URIs to preload
 * @param maxBatch Maximum images to load simultaneously (default: 3)
 */
export const preloadImagesInBatches = async (
  uris: string[],
  maxBatch: number = IMAGE_CACHE_CONFIG.MAX_PRELOAD_BATCH,
): Promise<void> => {
  // Filter out empty/invalid URIs
  const validUris = uris.filter((uri) => uri && typeof uri === "string");

  // Limit total preload queue size
  const limitedUris = validUris.slice(0, IMAGE_CACHE_CONFIG.MAX_PRELOAD_QUEUE);

  // Process in batches
  for (let i = 0; i < limitedUris.length; i += maxBatch) {
    const batch = limitedUris.slice(i, i + maxBatch);

    // Preload batch in parallel
    await Promise.allSettled(batch.map(preloadImageSafe));

    // Small delay between batches to allow GC
    if (i + maxBatch < limitedUris.length) {
      await new Promise((resolve) =>
        setTimeout(resolve, IMAGE_CACHE_CONFIG.PRELOAD_BATCH_DELAY),
      );
    }
  }
};

/**
 * Clear all cached images from memory and disk
 */
export const clearImageCache = async (): Promise<void> => {
  try {
    await Image.clearMemoryCache();
    await Image.clearDiskCache();
    console.log("Image cache cleared successfully");
  } catch (error) {
    console.error("Failed to clear image cache:", error);
  }
};

/**
 * Get cache disk size (if available)
 */
export const getCacheDiskSize = async (): Promise<number | null> => {
  try {
    const size = await Image.getCachePathAsync();
    return size ? 0 : null; // expo-image doesn't provide size directly
  } catch (error) {
    console.warn("Could not get cache disk size:", error);
    return null;
  }
};

/**
 * Preload images for visible attendance records
 * Only preloads images that are likely to be viewed soon
 */
export const preloadAttendanceImages = async (
  photoUrls: (string | null | undefined)[],
): Promise<void> => {
  const validUrls = photoUrls.filter(
    (url): url is string => url !== null && url !== undefined && url.length > 0,
  );

  if (validUrls.length === 0) {
    return;
  }

  // Preload in small batches to avoid memory spike
  await preloadImagesInBatches(validUrls);
};