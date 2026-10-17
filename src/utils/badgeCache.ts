import { useEffect, useSyncExternalStore } from 'react';
import { optimizeBadgeIcon } from './imageOptimizer';

/**
 * Cache key incorporating ID, length, and edge slices.
 * If the badge's iconData changes, the key changes immediately, invalidating old cache.
 */
export function getBadgeThumbnailCacheKey(badge: { id: string; iconData?: string }): string {
  if (!badge.iconData) return badge.id;
  const len = badge.iconData.length;
  const head = badge.iconData.slice(0, 24);
  const tail = badge.iconData.slice(-24);
  return `${badge.id}_${len}_${head}_${tail}`;
}

// In-memory module cache: cacheKey -> 128px PNG data URL
const thumbnailCache = new Map<string, string>();

// Subscribed listeners: cacheKey -> Set of callbacks
const listeners = new Map<string, Set<() => void>>();

// Keys currently in flight or waiting in queue
const inFlightKeys = new Set<string>();

interface QueueItem {
  key: string;
  iconData: string;
}

const queue: QueueItem[] = [];
let isProcessing = false;

function notifyListeners(key: string) {
  const cbs = listeners.get(key);
  if (cbs) {
    cbs.forEach((cb) => {
      try {
        cb();
      } catch {
        // Safe callback execution
      }
    });
  }
}

function processNext() {
  if (queue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;

  const scheduleRunner =
    typeof window !== 'undefined' && 'requestIdleCallback' in window
      ? (window as unknown as { requestIdleCallback: (fn: () => void) => number }).requestIdleCallback
      : (fn: () => void) => setTimeout(fn, 16);

  scheduleRunner(async () => {
    const item = queue.shift();
    if (!item) {
      isProcessing = false;
      return;
    }

    try {
      // Generate 128px PNG preserving full alpha channel and aspect ratio
      const smallDataUrl = await optimizeBadgeIcon(item.iconData, 128);
      if (smallDataUrl) {
        thumbnailCache.set(item.key, smallDataUrl);
        notifyListeners(item.key);
      }
    } catch (err) {
      console.warn('Rozet 128px kopyası üretilemedi:', err);
    } finally {
      inFlightKeys.delete(item.key);
    }

    // Yield to the browser before doing the next badge so scroll / animations stay smooth
    setTimeout(() => {
      processNext();
    }, 25);
  });
}

/**
 * Requests generation of 128px thumbnail for a custom badge if not already cached.
 */
export function requestBadgeThumbnail(badge: { id: string; iconData?: string }) {
  if (
    !badge.iconData ||
    badge.iconData.startsWith('images/') ||
    badge.iconData.startsWith('badges/')
  ) {
    return;
  }

  const key = getBadgeThumbnailCacheKey(badge);

  if (thumbnailCache.has(key) || inFlightKeys.has(key)) {
    return;
  }

  inFlightKeys.add(key);
  queue.push({ key, iconData: badge.iconData });

  if (!isProcessing) {
    processNext();
  }
}

/**
 * Proactively warm up 128px thumbnails for a list of badges in idle time.
 */
export function warmBadgeThumbnails(badges?: Array<{ id: string; iconData?: string }>) {
  if (!badges || !Array.isArray(badges)) return;
  for (const b of badges) {
    requestBadgeThumbnail(b);
  }
}

/**
 * React hook to get 128px thumbnail data URL for a badge.
 * Returns undefined until thumbnail is generated, allowing immediate fallback to original badge.iconData.
 * Only re-renders the component when this specific badge's thumbnail becomes ready.
 */
export function useBadgeCardIcon(badge: { id: string; iconData?: string }): string | undefined {
  const key = getBadgeThumbnailCacheKey(badge);

  useEffect(() => {
    requestBadgeThumbnail(badge);
  }, [key, badge.iconData]);

  return useSyncExternalStore(
    (onStoreChange) => {
      let set = listeners.get(key);
      if (!set) {
        set = new Set();
        listeners.set(key, set);
      }
      set.add(onStoreChange);

      return () => {
        const currentSet = listeners.get(key);
        if (currentSet) {
          currentSet.delete(onStoreChange);
          if (currentSet.size === 0) {
            listeners.delete(key);
          }
        }
      };
    },
    () => thumbnailCache.get(key),
    () => thumbnailCache.get(key)
  );
}
