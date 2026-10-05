import { ArchiveItem } from '../types';

export type SortOption =
  | 'date-desc'       // İzleme / Bitirme Tarihi (Yeniden Eskiye) -> DEFAULT
  | 'date-asc'        // İzleme / Bitirme Tarihi (Eskiden Yeniye)
  | 'release-desc'     // Yapım Yılı (Yeniden Eskiye)
  | 'release-asc'      // Yapım Yılı (Eskiden Yeniye)
  | 'rating-desc'      // Puan (Yüksekten Düşüğe)
  | 'rating-asc'       // Puan (Düşükten Yükseğe)
  | 'title-asc'        // İsim (A-Z)
  | 'title-desc'       // İsim (Z-A)
  | 'page-desc'        // Sayfa Sayısı: Çoktan Aza
  | 'page-asc';        // Sayfa Sayısı: Azdan Çoka

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

export interface ParsedReleaseYear {
  start: number | null;
  end: number | null;
}

/**
 * Parses release year for single films/games (e.g. 2024) or series ranges (e.g. '2008–2013', '2022–').
 * In ongoing series (e.g. '2022–'), end is treated as 9999 for sorting purposes.
 */
export function parseReleaseYear(releaseYear?: number | string | null): ParsedReleaseYear {
  if (releaseYear === undefined || releaseYear === null) {
    return { start: null, end: null };
  }

  if (typeof releaseYear === 'number') {
    if (isNaN(releaseYear) || releaseYear <= 0) return { start: null, end: null };
    return { start: releaseYear, end: releaseYear };
  }

  const str = String(releaseYear).trim();
  if (!str || str.includes('?')) {
    return { start: null, end: null };
  }

  // Check for range separators: '-', '–' (en-dash), '—' (em-dash)
  const rangeMatch = str.match(/^(\d{4})\s*[-–—]\s*(\d{4})?$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    // If end is present (e.g. 2008–2013), use it. If not (e.g. 2022–), treat as ongoing (9999)
    const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 9999;
    return {
      start: isNaN(start) ? null : start,
      end: isNaN(end) ? null : end,
    };
  }

  // Also handle any string with 4-digit numbers: e.g. "2021 - 2026" or similar
  const fourDigitNumbers = str.match(/\b\d{4}\b/g);
  if (fourDigitNumbers && fourDigitNumbers.length > 0) {
    const start = parseInt(fourDigitNumbers[0], 10);
    let end = start;
    if (fourDigitNumbers.length > 1) {
      end = parseInt(fourDigitNumbers[1], 10);
    } else if (/[-–—]\s*$/.test(str)) {
      // Ongoing series: e.g. "2022 -"
      end = 9999;
    }
    return {
      start: isNaN(start) ? null : start,
      end: isNaN(end) ? null : end,
    };
  }

  // Fallback single number parse
  const parsedNum = parseInt(str, 10);
  if (!isNaN(parsedNum) && parsedNum > 1800 && parsedNum < 3000) {
    return { start: parsedNum, end: parsedNum };
  }

  return { start: null, end: null };
}

/**
 * Checks if an item is currently active (Watching, Playing, or Reading).
 */
export function isItemActive(item: ArchiveItem): boolean {
  if (item.mainTab === 'game') {
    return item.status === 'Oynanıyor';
  }
  if (item.mainTab === 'book') {
    return !!item.reading;
  }
  return !!item.watching;
}

/**
 * Sorts archive items strictly according to selected SortOption.
 */
export function sortArchiveItems(items: ArchiveItem[], sortOption: SortOption = 'date-desc'): ArchiveItem[] {
  return [...items].sort((a, b) => {
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

      case 'release-desc': {
        const yearA = parseReleaseYear(a.releaseYear);
        const yearB = parseReleaseYear(b.releaseYear);

        // Unknown release years go to the bottom
        if (yearA.start === null && yearB.start === null) {
          return a.title.localeCompare(b.title, 'tr', { sensitivity: 'base' });
        }
        if (yearA.start === null) return 1;
        if (yearB.start === null) return -1;

        // Yaklaşım A: Başlangıç/Prömiyer yılına göre sıralama (Yeniden Eskiye)
        if (yearA.start !== yearB.start) {
          return yearB.start - yearA.start;
        }

        // Eşitlik durumunda bitiş yılına göre (Devam edenler veya daha geç bitenler önce)
        if (yearA.end !== null && yearB.end !== null && yearA.end !== yearB.end) {
          return yearB.end - yearA.end;
        }

        // İkincil sıralama: İsim alfabetik (A-Z)
        return a.title.localeCompare(b.title, 'tr', { sensitivity: 'base' });
      }

      case 'release-asc': {
        const yearA = parseReleaseYear(a.releaseYear);
        const yearB = parseReleaseYear(b.releaseYear);

        // Unknown release years go to the bottom
        if (yearA.start === null && yearB.start === null) {
          return a.title.localeCompare(b.title, 'tr', { sensitivity: 'base' });
        }
        if (yearA.start === null) return 1;
        if (yearB.start === null) return -1;

        // Yaklaşım A: Başlangıç/Prömiyer yılına göre sıralama (Eskiden Yeniye)
        if (yearA.start !== yearB.start) {
          return yearA.start - yearB.start;
        }

        // Eşitlik durumunda bitiş yılına göre (Daha erken bitenler önce)
        if (yearA.end !== null && yearB.end !== null && yearA.end !== yearB.end) {
          return yearA.end - yearB.end;
        }

        // İkincil sıralama: İsim alfabetik (A-Z)
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

      case 'page-desc': {
        const pageA = a.pageCount || 0;
        const pageB = b.pageCount || 0;
        if (pageA === 0 && pageB === 0) {
          return a.title.localeCompare(b.title, 'tr', { sensitivity: 'base' });
        }
        if (pageA === 0) return 1;
        if (pageB === 0) return -1;
        if (pageB !== pageA) return pageB - pageA;
        return a.title.localeCompare(b.title, 'tr', { sensitivity: 'base' });
      }

      case 'page-asc': {
        const pageA = a.pageCount || 0;
        const pageB = b.pageCount || 0;
        if (pageA === 0 && pageB === 0) {
          return a.title.localeCompare(b.title, 'tr', { sensitivity: 'base' });
        }
        if (pageA === 0) return 1;
        if (pageB === 0) return -1;
        if (pageA !== pageB) return pageA - pageB;
        return a.title.localeCompare(b.title, 'tr', { sensitivity: 'base' });
      }

      default:
        return 0;
    }
  });
}

