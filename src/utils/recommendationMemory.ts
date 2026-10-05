import { AiRecommendationCard } from '../types';

export type RecommendationPoolType = 'radar' | 'blacklist' | 'archive';
export type RecommendationFilterTab = 'all' | 'radar' | 'archive' | 'blacklist';
export type RecommendationCategoryFilter = 'all' | 'media' | 'game' | 'book';
export type RecommendationCategory = 'movie' | 'series' | 'anime' | 'animation' | 'game' | 'book';

export interface RecommendationMemoryItem {
  id: string; // Benzersiz kayıt id'si (uuid / timestamp)
  title: string; // Yapım adı (Örn: 'Arrival', 'The Witcher 3')
  releaseYear?: number | string; // Yapım yılı (Örn: 2016)
  mainTab: 'media' | 'game' | 'book'; // 'media', 'game' veya 'book'
  subType?: RecommendationCategory; // 'movie' | 'series' | 'anime' | 'animation' | 'game' | 'book'
  genres?: string[]; // Türler (Örn: ['Bilim Kurgu', 'Gizem'])
  thumbnailUrl?: string; // Küçük afiş linki (Sadece web URL'i, hafif)
  pool: RecommendationPoolType; // 'radar' | 'blacklist' | 'archive'
  recommendedAt: number; // İlk önerilme zaman damgası (Date.now())
  updatedAt?: number; // Havuz değiştirilme tarihi
}

export const RECOMMENDATION_MEMORY_STORAGE_KEY = 'lore_recommendation_memory';
export const MAX_ARCHIVE_LIMIT = 500;

/**
 * Loads the recommendation memory items from LocalStorage safely.
 */
export function loadRecommendationMemory(): RecommendationMemoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECOMMENDATION_MEMORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn('Could not load recommendation memory from localStorage:', err);
  }
  return [];
}

/**
 * Saves the recommendation memory items to LocalStorage safely.
 */
export function saveRecommendationMemory(items: RecommendationMemoryItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RECOMMENDATION_MEMORY_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Could not save recommendation memory to localStorage:', err);
  }
}

/**
 * 500 Kapasite Dolduğunda SADECE Arşivden Silme Yapan FIFO Fonksiyonu:
 * Radar ve Kara Liste kayıtlarına ASLA dokunmaz!
 */
export function pruneArchiveIfExceeded(
  items: RecommendationMemoryItem[],
  maxArchiveLimit: number = MAX_ARCHIVE_LIMIT
): RecommendationMemoryItem[] {
  const archiveItems = items.filter((it) => it.pool === 'archive');
  const nonArchiveItems = items.filter((it) => it.pool !== 'archive');

  if (archiveItems.length <= maxArchiveLimit) {
    return items;
  }

  // En yeni önerilenler kalsın, en eskiler silinsin
  const sortedArchive = [...archiveItems].sort((a, b) => b.recommendedAt - a.recommendedAt);
  const prunedArchive = sortedArchive.slice(0, maxArchiveLimit);

  return [...nonArchiveItems, ...prunedArchive];
}

/**
 * Normalizes title for loose comparison (case and punctuation insensitive).
 */
export function normalizeTitleForCompare(title: string): string {
  return (title || '')
    .trim()
    .toLowerCase()
    .replace(/[:\-–—.,!?'"]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Finds an item in the memory by matching title and mainTab.
 */
export function findMemoryItem(
  items: RecommendationMemoryItem[],
  title: string,
  mainTab?: 'media' | 'game' | 'book'
): RecommendationMemoryItem | undefined {
  const norm = normalizeTitleForCompare(title);
  if (!norm) return undefined;

  return items.find((it) => {
    const matchTitle = normalizeTitleForCompare(it.title) === norm;
    if (!matchTitle) return false;
    if (mainTab && it.mainTab !== mainTab) return false;
    return true;
  });
}

/**
 * Automatically registers newly received AI recommendation cards into memory.
 * - If item already exists in Radar or Blacklist, KEEP its pool!
 * - If item already exists in Archive, update recommendedAt.
 * - If new, add to Archive pool.
 * - Applies FIFO pruning to Archive if > 500.
 */
export function addCardsToMemory(
  cards: AiRecommendationCard[],
  currentMemory: RecommendationMemoryItem[]
): RecommendationMemoryItem[] {
  if (!cards || cards.length === 0) return currentMemory;

  const now = Date.now();
  let updatedList = [...currentMemory];

  cards.forEach((card) => {
    if (!card.title || !card.title.trim()) return;

    const existingIdx = updatedList.findIndex(
      (it) =>
        normalizeTitleForCompare(it.title) === normalizeTitleForCompare(card.title) &&
        it.mainTab === (card.mainTab === 'game' ? 'game' : 'media')
    );

    if (existingIdx !== -1) {
      const existing = updatedList[existingIdx];
      // Keep existing pool (never demote Radar or Blacklist)
      updatedList[existingIdx] = {
        ...existing,
        thumbnailUrl: existing.thumbnailUrl || (card.thumbnailUrl ? String(card.thumbnailUrl).trim() : undefined),
        releaseYear: existing.releaseYear || card.releaseYear,
        genres: (existing.genres && existing.genres.length > 0) ? existing.genres : card.genres,
        recommendedAt: now,
      };
    } else {
      // New item -> default to archive pool
      const newItem: RecommendationMemoryItem = {
        id: `rec_${now}_${Math.random().toString(36).substring(2, 7)}`,
        title: card.title.trim(),
        releaseYear: card.releaseYear,
        mainTab: card.mainTab === 'game' ? 'game' : card.mainTab === 'book' ? 'book' : 'media',
        genres: card.genres,
        thumbnailUrl: card.thumbnailUrl ? String(card.thumbnailUrl).trim() : undefined,
        pool: 'archive',
        recommendedAt: now,
      };
      updatedList.unshift(newItem);
    }
  });

  const pruned = pruneArchiveIfExceeded(updatedList, MAX_ARCHIVE_LIMIT);
  saveRecommendationMemory(pruned);
  return pruned;
}

/**
 * Moves a single item to a target pool ('radar' | 'blacklist' | 'archive').
 */
export function moveMemoryItemPool(
  currentMemory: RecommendationMemoryItem[],
  itemId: string,
  targetPool: RecommendationPoolType
): RecommendationMemoryItem[] {
  const updated = currentMemory.map((it) => {
    if (it.id === itemId) {
      return {
        ...it,
        pool: targetPool,
        updatedAt: Date.now(),
      };
    }
    return it;
  });

  const pruned = targetPool === 'archive' ? pruneArchiveIfExceeded(updated) : updated;
  saveRecommendationMemory(pruned);
  return pruned;
}

/**
 * Batch updates or adds items by title to a specific pool (for the 👍 / 👎 popover).
 */
export function batchMoveItemsToPool(
  currentMemory: RecommendationMemoryItem[],
  titles: string[],
  targetPool: RecommendationPoolType,
  availableCards?: AiRecommendationCard[]
): RecommendationMemoryItem[] {
  if (!titles || titles.length === 0) return currentMemory;

  const now = Date.now();
  const normalizedTargets = new Set(titles.map((t) => normalizeTitleForCompare(t)));
  let updated = [...currentMemory];

  // Update existing items
  updated = updated.map((it) => {
    if (normalizedTargets.has(normalizeTitleForCompare(it.title))) {
      return {
        ...it,
        pool: targetPool,
        updatedAt: now,
      };
    }
    return it;
  });

  // If some titles weren't in memory yet (unlikely, but safe), create them from cards
  if (availableCards && availableCards.length > 0) {
    availableCards.forEach((card) => {
      const norm = normalizeTitleForCompare(card.title);
      if (normalizedTargets.has(norm)) {
        const alreadyInUpdated = updated.some(
          (it) => normalizeTitleForCompare(it.title) === norm
        );
        if (!alreadyInUpdated) {
          updated.unshift({
            id: `rec_${now}_${Math.random().toString(36).substring(2, 7)}`,
            title: card.title.trim(),
            releaseYear: card.releaseYear,
            mainTab: card.mainTab === 'game' ? 'game' : card.mainTab === 'book' ? 'book' : 'media',
            genres: card.genres,
            thumbnailUrl: card.thumbnailUrl ? String(card.thumbnailUrl).trim() : undefined,
            pool: targetPool,
            recommendedAt: now,
            updatedAt: now,
          });
        }
      }
    });
  }

  const pruned = targetPool === 'archive' ? pruneArchiveIfExceeded(updated) : updated;
  saveRecommendationMemory(pruned);
  return pruned;
}

/**
 * Removes an item completely from memory (forgetting it).
 */
export function removeMemoryItem(
  currentMemory: RecommendationMemoryItem[],
  itemId: string
): RecommendationMemoryItem[] {
  const updated = currentMemory.filter((it) => it.id !== itemId);
  saveRecommendationMemory(updated);
  return updated;
}

/**
 * Clears only the 'archive' pool, preserving Radar and Blacklist completely.
 */
export function clearArchivePool(
  currentMemory: RecommendationMemoryItem[]
): RecommendationMemoryItem[] {
  const updated = currentMemory.filter((it) => it.pool !== 'archive');
  saveRecommendationMemory(updated);
  return updated;
}

/**
 * AI Prompt'una eklenecek negatif kısıt / hariç tutma dizesini oluşturan yardımcı:
 * [Tür] Başlık (Yıl)
 * Medya sekmesindeyken Oyun havuzu AI'a gönderilmez.
 * Oyun sekmesindeyken Medya havuzu AI'a gönderilmez.
 */
export function formatExclusionListForPrompt(
  items: RecommendationMemoryItem[],
  activeTab?: 'media' | 'game' | 'book'
): string {
  // Aktif sekmeye göre filtreleme
  const filtered = activeTab ? items.filter((it) => it.mainTab === activeTab) : items;

  if (filtered.length === 0) return '';

  const lines = filtered.map((it) => {
    const typeLabel = it.subType
      ? it.subType.toUpperCase()
      : it.mainTab === 'game'
      ? 'OYUN'
      : it.mainTab === 'book'
      ? 'KİTAP'
      : 'MEDYA';
    const yearStr = it.releaseYear ? ` (${it.releaseYear})` : '';
    return `- [${typeLabel}] ${it.title}${yearStr}`;
  });

  return `[DAHA ÖNCE ÖNERİLEN VE ASLA TEKRAR EDİLMEYECEK YAPIMLAR LİSTESİ]:\n${lines.join('\n')}`;
}
