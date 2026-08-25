import { ArchiveItem } from '../types';

export type SortOption =
  | 'date-desc'       // İzleme / Bitirme Tarihi (Yeniden Eskiye) -> DEFAULT
  | 'date-asc'        // İzleme / Bitirme Tarihi (Eskiden Yeniye)
  | 'rating-desc'      // Puan (Yüksekten Düşüğe)
  | 'rating-asc'       // Puan (Düşükten Yükseğe)
  | 'title-asc'        // İsim (A-Z)
  | 'title-desc';      // İsim (Z-A)

/**
 * Checks if date string represents an unknown / indeterminate date.
 * Handles '??', '??.??', '?.?.????', empty string, or undefined.
 */
export function isUnknownDate(dateStr?: string | null): boolean {
  if (!dateStr) return true;
  const trimmed = dateStr.trim();
  if (!trimmed) return true;
  if (trimmed === '??' || trimmed === '??.??' || trimmed.includes('?')) return true;
  return false;
}

/**
 * Normalizes date string for robust comparison.
 * If valid YYYY-MM-DD or YYYY, returns numerical timestamp or formatted string.
 * Unknown dates return null.
 */
export function parseDateValue(dateStr?: string | null): number | null {
  if (isUnknownDate(dateStr)) return null;
  const trimmed = dateStr!.trim();

  // If YYYY format
  if (/^\d{4}$/.test(trimmed)) {
    const d = new Date(`${trimmed}-01-01T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  // If YYYY-MM format
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}-01T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  // If YYYY-MM-DD format
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * Checks if an item is currently active (Watching or Playing).
 * These items should always appear at the very top (highest priority).
 */
export function isItemActive(item: ArchiveItem): boolean {
  if (item.mainTab === 'game') {
    return item.status === 'Oynanıyor';
  }
  return !!item.watching;
}

/**
 * Sorts archive items according to selected SortOption.
 * Priority rules:
 * 1. Currently Active items (Watching / Playing) ALWAYS appear at the very top.
 * 2. In 'date-desc' (Default):
 *    - Finished/watched items with known dates are sorted newest to oldest.
 *    - Unknown dates ('??', '??.??') are placed at the end safely.
 */
export function sortArchiveItems(items: ArchiveItem[], sortOption: SortOption = 'date-desc'): ArchiveItem[] {
  return [...items].sort((a, b) => {
    // Top Priority: Active watching / playing items ALWAYS go first
    const activeA = isItemActive(a);
    const activeB = isItemActive(b);

    if (activeA && !activeB) return -1;
    if (!activeA && activeB) return 1;

    // If both are active, sort by latest update / title
    if (activeA && activeB) {
      const fallbackA = a.updatedAt || a.createdAt || 0;
      const fallbackB = b.updatedAt || b.createdAt || 0;
      if (fallbackA !== fallbackB) return fallbackB - fallbackA;
      return a.title.localeCompare(b.title, 'tr', { sensitivity: 'base' });
    }

    switch (sortOption) {
      case 'date-desc': {
        const timeA = parseDateValue(a.date);
        const timeB = parseDateValue(b.date);

        // If both are unknown ('??' or '??.??'), sort by fallback (updatedAt or createdAt or title)
        if (timeA === null && timeB === null) {
          const fallbackA = a.updatedAt || a.createdAt || 0;
          const fallbackB = b.updatedAt || b.createdAt || 0;
          if (fallbackA !== fallbackB) return fallbackB - fallbackA;
          return a.title.localeCompare(b.title, 'tr', { sensitivity: 'base' });
        }
        // Unknown dates always go to the end
        if (timeA === null) return 1;
        if (timeB === null) return -1;

        if (timeA !== timeB) {
          return timeB - timeA; // Newest first
        }

        // Secondary sort if dates are exact same
        const fallbackA = a.updatedAt || a.createdAt || 0;
        const fallbackB = b.updatedAt || b.createdAt || 0;
        if (fallbackA !== fallbackB) return fallbackB - fallbackA;
        return a.title.localeCompare(b.title, 'tr', { sensitivity: 'base' });
      }

      case 'date-asc': {
        const timeA = parseDateValue(a.date);
        const timeB = parseDateValue(b.date);

        if (timeA === null && timeB === null) {
          return a.title.localeCompare(b.title, 'tr', { sensitivity: 'base' });
        }
        if (timeA === null) return 1;
        if (timeB === null) return -1;

        if (timeA !== timeB) {
          return timeA - timeB; // Oldest first
        }
        return a.title.localeCompare(b.title, 'tr', { sensitivity: 'base' });
      }

      case 'rating-desc': {
        if (b.rating !== a.rating) return b.rating - a.rating;
        // Secondary sort: date desc
        const timeA = parseDateValue(a.date);
        const timeB = parseDateValue(b.date);
        if (timeA !== null && timeB !== null && timeA !== timeB) return timeB - timeA;
        return a.title.localeCompare(b.title, 'tr', { sensitivity: 'base' });
      }

      case 'rating-asc': {
        if (a.rating !== b.rating) return a.rating - b.rating;
        return a.title.localeCompare(b.title, 'tr', { sensitivity: 'base' });
      }

      case 'title-asc': {
        return a.title.localeCompare(b.title, 'tr', { sensitivity: 'base' });
      }

      case 'title-desc': {
        return b.title.localeCompare(a.title, 'tr', { sensitivity: 'base' });
      }

      default:
        return 0;
    }
  });
}

