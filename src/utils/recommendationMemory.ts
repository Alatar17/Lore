import {
  AiRecommendationCard,
  ArchiveItem,
  RecommendationMemoryItem,
  RecommendationPoolType,
  RecommendationCategory,
} from '../types';

export type { RecommendationMemoryItem, RecommendationPoolType, RecommendationCategory };
export type RecommendationFilterTab = 'all' | 'radar' | 'archive' | 'blacklist';
export type RecommendationCategoryFilter = 'all' | 'media' | 'game' | 'book';

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
 * Saves the recommendation memory items to LocalStorage safely and dispatches sync event.
 */
export function saveRecommendationMemory(items: RecommendationMemoryItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RECOMMENDATION_MEMORY_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(
      new CustomEvent('lore-recommendation-memory-updated', { detail: items })
    );
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
 * Kütüphane eşleştirmesi için daha hoşgörülü başlık temizliği:
 * büyük/küçük harf, noktalama (; & / ! vb.) ve fazla boşluk yok sayılır.
 */
function normalizeTitleLoose(title: string): string {
  return (title || '')
    .toLocaleLowerCase('tr')
    .replace(/[:\-–—.,!?'"’`;&/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Bir başlığın karşılaştırılacak hâlleri. "Bruce Almighty (Aman Tanrım 1)" için:
 * tam hâli, parantez dışı ("Bruce Almighty") ve parantez içi ("Aman Tanrım 1").
 */
function titleVariants(title: string): string[] {
  const variants = new Set<string>();
  const full = normalizeTitleLoose(title.replace(/[()]/g, ' '));
  if (full) variants.add(full);
  const outside = normalizeTitleLoose(title.replace(/\([^)]*\)/g, ' '));
  if (outside) variants.add(outside);
  for (const match of title.matchAll(/\(([^)]*)\)/g)) {
    const inside = normalizeTitleLoose(match[1]);
    if (inside) variants.add(inside);
  }
  return Array.from(variants);
}

/**
 * Asistanın önerdiği kart kütüphanede zaten varsa o yapımı döndürür.
 * Aynı sekmede (film/dizi, oyun, kitap) ve başlığın herhangi bir hâli eşleşmeli.
 * Gizli yapımlar yapay zekâya hiç gönderilmediği için burada da aranmaz.
 */
export function findLibraryMatchForCard(
  card: Pick<AiRecommendationCard, 'title' | 'mainTab'>,
  libraryItems: ArchiveItem[]
): ArchiveItem | undefined {
  if (!card.title || !libraryItems || libraryItems.length === 0) return undefined;
  const cardVariants = titleVariants(card.title);
  if (cardVariants.length === 0) return undefined;
  const cardTab = card.mainTab === 'game' ? 'game' : card.mainTab === 'book' ? 'book' : 'media';

  return libraryItems.find((it) => {
    if (it.isHidden) return false;
    if (it.mainTab !== cardTab) return false;
    const itemVariants = titleVariants(it.title || '');
    return itemVariants.some((v) => cardVariants.includes(v));
  });
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
 * Kartta TMDB'den bulunan afiş adresini hafızadaki kayda yazar.
 * Kayıt yoksa veya adres aynıysa hiçbir şey yapmaz. TMDB adresi, yapay zekânın
 * verdiği (çoğu zaman çalışmayan) adresten güvenilir olduğu için onun yerine geçer.
 */
export function setMemoryItemThumbnail(
  title: string,
  mainTab: 'media' | 'game' | 'book',
  thumbnailUrl: string
): void {
  const url = thumbnailUrl ? thumbnailUrl.trim() : '';
  if (!url) return;
  const items = loadRecommendationMemory();
  const target = findMemoryItem(items, title, mainTab);
  if (!target || target.thumbnailUrl === url) return;
  saveRecommendationMemory(
    items.map((it) => (it.id === target.id ? { ...it, thumbnailUrl: url } : it))
  );
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
        it.mainTab === (card.mainTab === 'game' ? 'game' : card.mainTab === 'book' ? 'book' : 'media')
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
 * AI Prompt'una eklenecek "daha önce önerilenler" listesi: sadece Öneri Hafızası (Radar, Kara Liste, Arşiv).
 * Kütüphanedeki yapımlar burada tekrar listelenmez; onlar profildeki [KÜTÜPHANE] listesinde tek seferde gider.
 */
export function formatExclusionListForPrompt(memoryItems: RecommendationMemoryItem[]): string {
  const lines: string[] = [];
  const seenNormTitles = new Set<string>();

  // Öneri Hafızasındaki yapımlar (Radar, Kara Liste, Arşiv)
  if (memoryItems && memoryItems.length > 0) {
    memoryItems.forEach((it) => {
      const title = (it.title || '').trim();
      if (!title) return;
      const norm = normalizeTitleForCompare(title);
      if (seenNormTitles.has(norm)) return;
      seenNormTitles.add(norm);

      const typeLabel = it.subType
        ? it.subType.toUpperCase()
        : it.mainTab === 'game'
        ? 'OYUN'
        : it.mainTab === 'book'
        ? 'KİTAP'
        : 'MEDYA';
      const yearStr = it.releaseYear ? ` (${it.releaseYear})` : '';
      lines.push(`- [${typeLabel}] ${title}${yearStr}`);
    });
  }

  if (lines.length === 0) return '';

  return (
    `[DAHA ÖNCE ÖNERİLENLER] (asistanın daha önce önerdikleri; hiçbiri tekrar kart olamaz):\n` +
    lines.join('\n')
  );
}
