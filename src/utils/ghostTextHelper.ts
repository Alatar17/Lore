import { ArchiveItem, MainTabType } from '../types';

export interface GhostSuggestion {
  /** Temiz ve eksiksiz isim (Arama kutusuna veya etikete eklenecek saf metin) */
  fullText: string;
  /** Kullanıcının yazdığı harflerden sonra gelen silik tamamlayıcı kısım */
  completionText: string;
  /** Bilgi/Rol etiketi (Örn: "Yazar", "Stüdyo", "Yönetmen", "Tür", "Oyuncu"). Kutuya yazılmaz! */
  roleLabel?: string;
  /** Öncelik seviyesi veya puanı */
  priority: number;
}

/**
 * Türkçe büyük/küçük harf duyarlı harf eşitleme fonksiyonu (i/İ, ı/I).
 */
export function normalizeTurkish(text: string): string {
  if (!text) return '';
  return text
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLocaleLowerCase('tr-TR');
}

interface CandidateEntry {
  text: string;
  roleLabel?: string;
  priorityGroup: number; // 4: En yüksek, 1: En düşük
  maxRating: number;      // 0 - 10
  newestTimestamp: number; // Çakışma eşitliğinde son eklenen
}

/**
 * karar.md kurallarına göre aktif sekmeye ve arama moduna özel tekil en iyi öneriyi bulur.
 */
export function getGhostSuggestion({
  query,
  items,
  mainTab,
  searchMode,
  existingChips = [],
}: {
  query: string;
  items: ArchiveItem[];
  mainTab: MainTabType;
  searchMode: 'search' | 'tag';
  existingChips?: string[];
}): GhostSuggestion | null {
  const trimmed = query.trim();
  // Kural: En az 2 harf yazıldığında tetiklenir
  if (trimmed.length < 2) {
    return null;
  }

  const normQuery = normalizeTurkish(trimmed);
  const existingNormChips = new Set(existingChips.map((c) => normalizeTurkish(c)));

  // Yalnızca aktif sekmeye ait yapımlar taranır (sekmeler arası çakışma yaşanmaz)
  const tabItems = items.filter((it) => it.mainTab === mainTab);

  // Aday havuzunu topla (Benzersiz metin -> CandidateEntry)
  const candidateMap = new Map<string, CandidateEntry>();

  const registerCandidate = (
    rawText: string | undefined | null,
    roleLabel: string | undefined,
    priorityGroup: number,
    item: ArchiveItem
  ) => {
    if (!rawText) return;
    const cleanText = rawText.trim();
    if (!cleanText) return;

    const normCandidate = normalizeTurkish(cleanText);

    // Kendisiyle birebir aynıysa veya mevcut etiketlerde zaten varsa önermeye gerek yok
    if (normCandidate === normQuery) return;
    if (searchMode === 'tag' && existingNormChips.has(normCandidate)) return;

    // Baştan eşleşme kuralı (Prefix match)
    if (!normCandidate.startsWith(normQuery)) return;

    const rating = typeof item.rating === 'number' ? item.rating : 0;
    const timestamp =
      item.createdAt ||
      (item.date ? new Date(item.date).getTime() : 0) ||
      0;

    const key = normCandidate;
    const existing = candidateMap.get(key);

    if (!existing) {
      candidateMap.set(key, {
        text: cleanText,
        roleLabel,
        priorityGroup,
        maxRating: rating,
        newestTimestamp: timestamp,
      });
    } else {
      // Daha yüksek öncelik grubu varsa güncelle
      if (priorityGroup > existing.priorityGroup) {
        existing.priorityGroup = priorityGroup;
        existing.roleLabel = roleLabel;
      }
      // Daha yüksek puan varsa güncelle
      if (rating > existing.maxRating) {
        existing.maxRating = rating;
      }
      // Daha yeni tarih varsa güncelle
      if (timestamp > existing.newestTimestamp) {
        existing.newestTimestamp = timestamp;
      }
    }
  };

  // Sekmedeki tüm yapıları dolaş ve kurallara göre adayları kaydet
  for (const item of tabItems) {
    if (searchMode === 'search') {
      // ==========================================
      // 1. NORMAL ARAMA MODU (🔍)
      // ==========================================
      // Öncelik 1: Yapım Başlıkları (#1 Öncelik)
      registerCandidate(item.title, undefined, 4, item);

      // Öncelik 2: Yönetmenler / Yazarlar (Ana Üreticiler)
      if (item.director) {
        item.director.forEach((d) => registerCandidate(d, 'Yönetmen', 3, item));
      }
      if (item.author) {
        item.author.forEach((a) => registerCandidate(a, 'Yazar', 3, item));
      }

      // Öncelik 3: Stüdyolar / Geliştiriciler / Yayınevleri
      if (item.firm) {
        item.firm.forEach((f) => registerCandidate(f, 'Stüdyo', 2, item));
      }
      if (item.developer) {
        item.developer.forEach((dev) => registerCandidate(dev, 'Geliştirici', 2, item));
      }
      if (item.publisher) {
        item.publisher.forEach((pub) => registerCandidate(pub, 'Yayınevi', 2, item));
      }

      // Öncelik 4: Kadro & Karakterler (Oyuncular, Seslendirmenler, Karakter Adları, Çevirmenler)
      if (item.actors) {
        item.actors.forEach((act) => registerCandidate(act, 'Oyuncu', 1, item));
      }
      if (item.translator) {
        item.translator.forEach((tr) => registerCandidate(tr, 'Çevirmen', 1, item));
      }
      if (item.characters) {
        item.characters.forEach((c) => {
          // Sol Kutu: Karakter Adı (Medya, Oyun ve Kitap için her zaman dahil edilir)
          if (c.name) registerCandidate(c.name, 'Karakter', 1, item);

          // Sağ Kutu: Yalnızca Medya ve Oyun için geçerli (Oyuncu/Seslendirmen).
          // Kitaplarda sağ kutu "Karanlık Adam", "Fabrika İşçisi" gibi tanımlama/sıfat olduğu için KESİNLİKLE hariç tutulur!
          if (c.actor && (item.mainTab === 'media' || item.mainTab === 'game')) {
            registerCandidate(c.actor, 'Oyuncu', 1, item);
          }
        });
      }
      // ÖZEL KURAL: "Tür (Genre)" normal arama modunda KAPSAM DIŞIDIR!
    } else {
      // ==========================================
      // 2. ETİKET ARAMA MODU (🏷️)
      // Başlıklar KESİNLİKLE HARİÇ!
      // ==========================================
      // Öncelik 1: Türler (Genres - #1 Öncelik)
      if (item.genre) {
        item.genre.forEach((g) => registerCandidate(g, 'Tür', 4, item));
      }

      // Öncelik 2: Yönetmenler / Yazarlar
      if (item.director) {
        item.director.forEach((d) => registerCandidate(d, 'Yönetmen', 3, item));
      }
      if (item.author) {
        item.author.forEach((a) => registerCandidate(a, 'Yazar', 3, item));
      }

      // Öncelik 3: Stüdyolar / Geliştiriciler / Yayınevleri
      if (item.firm) {
        item.firm.forEach((f) => registerCandidate(f, 'Stüdyo', 2, item));
      }
      if (item.developer) {
        item.developer.forEach((dev) => registerCandidate(dev, 'Geliştirici', 2, item));
      }
      if (item.publisher) {
        item.publisher.forEach((pub) => registerCandidate(pub, 'Yayınevi', 2, item));
      }

      // Öncelik 4: Kadro & Karakterler
      if (item.actors) {
        item.actors.forEach((act) => registerCandidate(act, 'Oyuncu', 1, item));
      }
      if (item.translator) {
        item.translator.forEach((tr) => registerCandidate(tr, 'Çevirmen', 1, item));
      }
      if (item.characters) {
        item.characters.forEach((c) => {
          // Sol Kutu: Karakter Adı (Medya, Oyun ve Kitap için her zaman dahil edilir)
          if (c.name) registerCandidate(c.name, 'Karakter', 1, item);

          // Sağ Kutu: Yalnızca Medya ve Oyun için geçerli (Oyuncu/Seslendirmen).
          // Kitaplarda sağ kutu tanımlama/sıfat olduğu için hariç tutulur!
          if (c.actor && (item.mainTab === 'media' || item.mainTab === 'game')) {
            registerCandidate(c.actor, 'Oyuncu', 1, item);
          }
        });
      }
    }
  }

  if (candidateMap.size === 0) {
    return null;
  }

  // Adayları karar.md çakışma kurallarına göre sırala:
  // 1. Öncelik grubu (4 -> 1)
  // 2. En yüksek puanlı yapım (10 -> 0)
  // 3. Eşitlik halinde en son eklenen yapım (newestTimestamp)
  // 4. Eşitlik halinde alfabetik kısa olan
  const candidates = Array.from(candidateMap.values());
  candidates.sort((a, b) => {
    if (b.priorityGroup !== a.priorityGroup) {
      return b.priorityGroup - a.priorityGroup;
    }
    if (b.maxRating !== a.maxRating) {
      return b.maxRating - a.maxRating;
    }
    if (b.newestTimestamp !== a.newestTimestamp) {
      return b.newestTimestamp - a.newestTimestamp;
    }
    return a.text.localeCompare(b.text, 'tr');
  });

  const best = candidates[0];
  if (!best) return null;

  // Silik tamamlayıcı kısmı hesapla:
  // Kullanıcının yazdığı gerçek karakter sayısı kadarını atlayıp devamını alıyoruz
  const completionText = best.text.slice(query.length);
  if (!completionText) {
    return null;
  }

  return {
    fullText: best.text,
    completionText,
    roleLabel: best.roleLabel,
    priority: best.priorityGroup,
  };
}
