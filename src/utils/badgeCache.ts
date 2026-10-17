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

/**
 * Cache key for baked badge with drop-shadow.
 * Incorporates thumbnail key + glowEnabled + clean color hex.
 */
export function getBakedBadgeCacheKey(
  badge: { id: string; iconData?: string },
  glowEnabled: boolean,
  colorHex: string
): string {
  const baseKey = getBadgeThumbnailCacheKey(badge);
  const safeHex = (colorHex || '#f59e0b').replace('#', '').toLowerCase();
  return `baked_${baseKey}_glow_${glowEnabled ? '1' : '0'}_hex_${safeHex}`;
}

// In-memory module cache: cacheKey -> 128px PNG data URL
const thumbnailCache = new Map<string, string>();

// In-memory module cache: bakedKey -> 200px PNG data URL with baked shadow
const bakedThumbnailCache = new Map<string, string>();

// Subscribed listeners: cacheKey -> Set of callbacks
const listeners = new Map<string, Set<() => void>>();

// Keys currently in flight or waiting in queue
const inFlightKeys = new Set<string>();

interface QueueItem {
  type: 'thumb' | 'baked';
  key: string;
  badge: { id: string; iconData?: string };
  glowEnabled?: boolean;
  colorHex?: string;
}

const queue: QueueItem[] = [];
let isProcessing = false;

// Cached check for canvas 2D ctx.filter support
let isCtxFilterSupported: boolean | null = null;
export function canBakeWithFilter(): boolean {
  if (isCtxFilterSupported !== null) return isCtxFilterSupported;
  if (typeof document === 'undefined') {
    isCtxFilterSupported = false;
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof (ctx as unknown as { filter?: string }).filter === 'undefined') {
      isCtxFilterSupported = false;
      return false;
    }
    ctx.filter = 'drop-shadow(0 0 2px rgba(0,0,0,0.8))';
    isCtxFilterSupported = typeof (ctx as unknown as { filter?: string }).filter === 'string';
    return isCtxFilterSupported;
  } catch {
    isCtxFilterSupported = false;
    return false;
  }
}

/**
 * Bakes the badge image with its exact multi-layer drop-shadow chain onto a high-DPI canvas.
 * Preserves full transparency and natural aspect ratio inside an equivalent 50px CSS box
 * (26px badge + 12px padding on all sides).
 */
export async function bakeBadgeIconWithShadow(
  sourceImageSrc: string,
  glowEnabled: boolean,
  colorHex: string
): Promise<string | null> {
  if (!canBakeWithFilter()) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        if (!iw || !ih) {
          resolve(null);
          return;
        }

        // k = scale multiplier for crisp high-DPI (200x200 canvas represents 50x50 CSS px)
        const k = 4;
        const totalSize = 50 * k; // 200px
        const pad = 12 * k; // 48px
        const slotSize = 26 * k; // 104px

        // Compute aspect-ratio preserved dimensions inside the 104px inner slot
        const ratio = Math.min(slotSize / iw, slotSize / ih);
        const drawW = Math.max(1, Math.round(iw * ratio));
        const drawH = Math.max(1, Math.round(ih * ratio));
        const drawX = pad + Math.round((slotSize - drawW) / 2);
        const drawY = pad + Math.round((slotSize - drawH) / 2);

        const canvas = document.createElement('canvas');
        canvas.width = totalSize;
        canvas.height = totalSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        // Clear canvas with full alpha transparency
        ctx.clearRect(0, 0, totalSize, totalSize);

        // Normalize colorHex
        const safeHex = colorHex.startsWith('#') ? colorHex : `#${colorHex}`;

        // Exact drop-shadow chain scaled by k = 4:
        // Glow On:
        // CSS:  drop-shadow(0 0 1.5px rgba(0,0,0,0.98)) drop-shadow(0 0 3px rgba(0,0,0,0.85)) drop-shadow(0 0 6px HEX) drop-shadow(0 2px 5px rgba(0,0,0,0.85))
        // k=4:  drop-shadow(0 0 6px rgba(0,0,0,0.98)) drop-shadow(0 0 12px rgba(0,0,0,0.85)) drop-shadow(0 0 24px HEX) drop-shadow(0 8px 20px rgba(0,0,0,0.85))
        //
        // Glow Off:
        // CSS:  drop-shadow(0 0 1.5px rgba(0,0,0,0.98)) drop-shadow(0 0 3px rgba(0,0,0,0.85)) drop-shadow(0 2px 5px rgba(0,0,0,0.85))
        // k=4:  drop-shadow(0 0 6px rgba(0,0,0,0.98)) drop-shadow(0 0 12px rgba(0,0,0,0.85)) drop-shadow(0 8px 20px rgba(0,0,0,0.85))
        const filterChain = glowEnabled
          ? `drop-shadow(0 0 ${1.5 * k}px rgba(0,0,0,0.98)) drop-shadow(0 0 ${3 * k}px rgba(0,0,0,0.85)) drop-shadow(0 0 ${6 * k}px ${safeHex}) drop-shadow(0 ${2 * k}px ${5 * k}px rgba(0,0,0,0.85))`
          : `drop-shadow(0 0 ${1.5 * k}px rgba(0,0,0,0.98)) drop-shadow(0 0 ${3 * k}px rgba(0,0,0,0.85)) drop-shadow(0 ${2 * k}px ${5 * k}px rgba(0,0,0,0.85))`;

        ctx.filter = filterChain;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, drawX, drawY, drawW, drawH);

        const bakedDataUrl = canvas.toDataURL('image/png');
        resolve(bakedDataUrl);
      } catch (err) {
        console.warn('Rozet pişirme hatası:', err);
        resolve(null);
      }
    };

    img.onerror = () => {
      resolve(null);
    };

    img.src = sourceImageSrc;
  });
}

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
      if (item.type === 'thumb') {
        if (item.badge.iconData) {
          const smallDataUrl = await optimizeBadgeIcon(item.badge.iconData, 128);
          if (smallDataUrl) {
            thumbnailCache.set(item.key, smallDataUrl);
            notifyListeners(item.key);
          }
        }
      } else if (item.type === 'baked') {
        const thumbKey = getBadgeThumbnailCacheKey(item.badge);
        const sourceSrc = thumbnailCache.get(thumbKey) || item.badge.iconData;
        if (sourceSrc) {
          const bakedDataUrl = await bakeBadgeIconWithShadow(
            sourceSrc,
            item.glowEnabled !== false,
            item.colorHex || '#f59e0b'
          );
          if (bakedDataUrl) {
            bakedThumbnailCache.set(item.key, bakedDataUrl);
            notifyListeners(item.key);
          }
        }
      }
    } catch (err) {
      console.warn('Rozet önbellek işlemi hatası:', err);
    } finally {
      inFlightKeys.delete(item.key);
    }

    // Yield to the browser before doing the next badge so scroll / animations stay smooth
    setTimeout(() => {
      processNext();
    }, 20);
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
  queue.push({ type: 'thumb', key, badge });

  if (!isProcessing) {
    processNext();
  }
}

/**
 * Requests generation of baked drop-shadow variant for mobile display.
 */
export function requestBakedBadge(
  badge: { id: string; iconData?: string },
  glowEnabled: boolean,
  colorHex: string
) {
  if (
    !badge.iconData ||
    badge.iconData.startsWith('images/') ||
    badge.iconData.startsWith('badges/') ||
    !canBakeWithFilter()
  ) {
    return;
  }

  const bakedKey = getBakedBadgeCacheKey(badge, glowEnabled, colorHex);

  if (bakedThumbnailCache.has(bakedKey) || inFlightKeys.has(bakedKey)) {
    return;
  }

  // Also request 128px thumbnail so it can be used as lightweight baking source
  requestBadgeThumbnail(badge);

  inFlightKeys.add(bakedKey);
  queue.push({
    type: 'baked',
    key: bakedKey,
    badge,
    glowEnabled,
    colorHex,
  });

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

/**
 * React hook to get baked drop-shadow PNG data URL for mobile card display.
 * Returns undefined until baked version is ready, cleanly falling back to useBadgeCardIcon + CSS filter.
 */
export function useBakedBadgeIcon(
  badge: { id: string; iconData?: string },
  glowEnabled: boolean,
  colorHex: string
): string | undefined {
  const bakedKey = getBakedBadgeCacheKey(badge, glowEnabled, colorHex);

  useEffect(() => {
    requestBakedBadge(badge, glowEnabled, colorHex);
  }, [bakedKey, badge.iconData, glowEnabled, colorHex]);

  return useSyncExternalStore(
    (onStoreChange) => {
      let set = listeners.get(bakedKey);
      if (!set) {
        set = new Set();
        listeners.set(bakedKey, set);
      }
      set.add(onStoreChange);

      return () => {
        const currentSet = listeners.get(bakedKey);
        if (currentSet) {
          currentSet.delete(onStoreChange);
          if (currentSet.size === 0) {
            listeners.delete(bakedKey);
          }
        }
      };
    },
    () => bakedThumbnailCache.get(bakedKey),
    () => bakedThumbnailCache.get(bakedKey)
  );
}

// Ultra-lightweight media query subscription for mobile breakpoint (< 640px / Tailwind sm)
const mobileMediaQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 639px)')
    : null;

function subscribeMobileQuery(callback: () => void) {
  if (!mobileMediaQuery) return () => {};
  if (mobileMediaQuery.addEventListener) {
    mobileMediaQuery.addEventListener('change', callback);
    return () => mobileMediaQuery.removeEventListener('change', callback);
  } else {
    (mobileMediaQuery as unknown as { addListener: (cb: () => void) => void }).addListener(callback);
    return () =>
      (mobileMediaQuery as unknown as { removeListener: (cb: () => void) => void }).removeListener(callback);
  }
}

function getMobileSnapshot(): boolean {
  return mobileMediaQuery ? mobileMediaQuery.matches : false;
}

function getMobileServerSnapshot(): boolean {
  return false;
}

/**
 * Zero-cost hook to track whether screen width is in mobile range (< 640px).
 * Listens only to media query changes, avoiding window resize event floods.
 */
export function useIsMobileBadgeScreen(): boolean {
  return useSyncExternalStore(subscribeMobileQuery, getMobileSnapshot, getMobileServerSnapshot);
}

