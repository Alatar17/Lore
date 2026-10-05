import {
  fsrs,
  createEmptyCard,
  State,
  Rating,
  type Card,
  type RecordLog,
} from 'ts-fsrs';
import type { ArchiveItem } from '../types';

/**
 * Singleton FSRS engine instance with standard default parameters.
 */
export const fsrsEngine = fsrs();

/**
 * Initializes a new empty Anki card with safe defaults.
 */
export function initAnkiCard(now: Date = new Date()): Card {
  return createEmptyCard(now);
}

/**
 * Ensures an Anki card read from JSON/localStorage has proper JavaScript Date instances.
 * When data is serialized to JSON (e.g. GitHub Sync or LocalStorage), Date instances
 * become ISO strings or timestamps. FSRS requires real Date objects for calculations.
 */
export function ensureAnkiCardDates(card?: Card | null): Card | undefined {
  if (!card) return undefined;
  return {
    ...card,
    due: card.due ? new Date(card.due) : new Date(),
    last_review: card.last_review ? new Date(card.last_review) : undefined,
  };
}

/**
 * Returns the end of day (23:59:59.999) for a given date in local time.
 * Used for Anki's "Day-end rule" (Gün Sonu Kuralı) for Review cards.
 */
export function getEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Checks if two dates fall on the same calendar day in local time.
 */
export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Formats the time interval between now and the next due date into a human-friendly Turkish string
 * (e.g., '1 dk', '10 dk', '1 gün', '3 gün', '2.5 ay', '1 yıl').
 */
export function formatAnkiInterval(due: Date, now: Date = new Date()): string {
  const diffMs = due.getTime() - now.getTime();
  if (diffMs <= 0) return '1 dk';

  const diffMinutes = Math.round(diffMs / (1000 * 60));
  if (diffMinutes < 60) {
    return `${Math.max(1, diffMinutes)} dk`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} sa`;
  }

  const diffDays = Math.round(diffMinutes / (60 * 24));
  if (diffDays < 30) {
    return `${diffDays} gün`;
  }

  const diffMonths = +(diffDays / 30).toFixed(1);
  if (diffMonths < 12) {
    return `${diffMonths} ay`;
  }

  const diffYears = +(diffDays / 365).toFixed(1);
  return `${diffYears} yıl`;
}

/**
 * Computes the repeat previews for all 4 rating buttons (Again, Hard, Good, Easy)
 * along with their localized Turkish labels and dynamic time intervals.
 */
export interface AnkiRepeatOption {
  rating: Rating;
  label: string;
  badgeColor: string;
  intervalText: string;
  nextCard: Card;
}

export function getRepeatOptions(card: Card, now: Date = new Date()): AnkiRepeatOption[] {
  const safeCard = ensureAnkiCardDates(card) || initAnkiCard(now);
  const repeatLog: RecordLog = fsrsEngine.repeat(safeCard, now);

  const configs: { rating: Rating; label: string; badgeColor: string }[] = [
    { rating: Rating.Again, label: 'Yeniden', badgeColor: 'text-red-400 border-red-500/40 bg-red-500/10' },
    { rating: Rating.Hard, label: 'Zor', badgeColor: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
    { rating: Rating.Good, label: 'İyi', badgeColor: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' },
    { rating: Rating.Easy, label: 'Kolay', badgeColor: 'text-blue-400 border-blue-500/40 bg-blue-500/10' },
  ];

  return configs.map(({ rating, label, badgeColor }) => {
    const recordItem = repeatLog[rating as 1 | 2 | 3 | 4];
    const nextDue = new Date(recordItem.card.due);
    const intervalText = formatAnkiInterval(nextDue, now);
    return {
      rating,
      label,
      badgeColor,
      intervalText,
      nextCard: recordItem.card,
    };
  });
}

/**
 * Anki's default Learn-Ahead Limit in milliseconds (20 minutes).
 * Allows learning and relearning cards due within the next 20 minutes to be studied in the current session.
 */
export const ANKI_LEARN_AHEAD_MS = 20 * 60 * 1000;

/**
 * Deck statistics counters for New, Learning, Review and Today's Reviewed count.
 */
export interface AnkiDeckCounts {
  newCount: number;      // Mavi: Henüz hiç çalışılmamış kartlar (State.New)
  learningCount: number; // Kırmızı: Öğreniliyor / Relearning (öğrenme adımları veya vadesi gelmiş olanlar)
  reviewCount: number;   // Yeşil: Review aşamasında ve bugünün sonuna kadar vadesi dolanlar (Gün sonu kuralı)
  todayReviewed: number; // Bugün çalışılmış benzersiz kartlar (last_review === today)
  totalCards: number;    // Toplam anki özellikli kart sayısı
}

/**
 * Calculates counts for a list of archive items at a given reference time (supports virtual time).
 */
export function calculateAnkiCounts(items: ArchiveItem[], now: Date = new Date()): AnkiDeckCounts {
  let newCount = 0;
  let learningCount = 0;
  let reviewCount = 0;
  let todayReviewed = 0;
  let totalCards = 0;

  const endOfToday = getEndOfDay(now);
  const learnAheadLimit = now.getTime() + ANKI_LEARN_AHEAD_MS;

  for (const item of items) {
    if (!item.anki) continue;
    totalCards++;

    const card = ensureAnkiCardDates(item.ankiCard) || initAnkiCard(now);

    // Today reviewed count (last_review is same calendar day as `now`)
    if (card.last_review && isSameDay(new Date(card.last_review), now)) {
      todayReviewed++;
    }

    // 1. New (Mavi)
    if (card.state === State.New) {
      newCount++;
    }
    // 2. Learning / Relearning (Kırmızı) - vadesi dolmuş veya 20 dk öğrenme avansı / gün sonu dahilinde olanlar
    else if (
      (card.state === State.Learning || card.state === State.Relearning) &&
      (new Date(card.due).getTime() <= learnAheadLimit || new Date(card.due) <= endOfToday)
    ) {
      learningCount++;
    }
    // 3. Review (Yeşil) - Gün sonu kuralı: vadesi bugünün 23:59:59'una kadar olanlar
    else if (
      card.state === State.Review &&
      new Date(card.due) <= endOfToday
    ) {
      reviewCount++;
    }
  }

  return {
    newCount,
    learningCount,
    reviewCount,
    todayReviewed,
    totalCards,
  };
}

/**
 * Determines whether a specific card is currently due for study at `now`.
 */
export function isCardDueForStudy(card: Card, now: Date = new Date()): boolean {
  const safeCard = ensureAnkiCardDates(card) || initAnkiCard(now);

  if (safeCard.state === State.New) {
    return true;
  }
  if (
    (safeCard.state === State.Learning || safeCard.state === State.Relearning) &&
    (new Date(safeCard.due).getTime() <= now.getTime() + ANKI_LEARN_AHEAD_MS ||
     new Date(safeCard.due) <= getEndOfDay(now))
  ) {
    return true;
  }
  if (
    safeCard.state === State.Review &&
    new Date(safeCard.due) <= getEndOfDay(now)
  ) {
    return true;
  }
  return false;
}

/**
 * Builds the study session queue ordered by Anki priority:
 * 1. Learning (Öğreniliyor / Yeniden öğreniliyor) - en yüksek öncelik
 * 2. Due (Tekrar / Review - vadesi bugün dolmuşlar)
 * 3. New (Yeni - hiç çalışılmamışlar)
 */
export function getAnkiStudyQueue(items: ArchiveItem[], now: Date = new Date()): ArchiveItem[] {
  const learningItems: ArchiveItem[] = [];
  const reviewItems: ArchiveItem[] = [];
  const newItems: ArchiveItem[] = [];

  const endOfToday = getEndOfDay(now);
  const learnAheadLimit = now.getTime() + ANKI_LEARN_AHEAD_MS;

  for (const item of items) {
    if (!item.anki) continue;
    const card = ensureAnkiCardDates(item.ankiCard) || initAnkiCard(now);

    if (
      (card.state === State.Learning || card.state === State.Relearning) &&
      (new Date(card.due).getTime() <= learnAheadLimit || new Date(card.due) <= endOfToday)
    ) {
      learningItems.push(item);
    } else if (
      card.state === State.Review &&
      new Date(card.due) <= endOfToday
    ) {
      reviewItems.push(item);
    } else if (card.state === State.New) {
      newItems.push(item);
    }
  }

  // Priority order: Learning -> Review -> New
  return [...learningItems, ...reviewItems, ...newItems];
}
