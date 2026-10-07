import { ArchiveItem, Category, MainTabType } from '../types';

export interface CompactItemBrief {
  id: string;
  title: string;
  category: string;
  sub?: string;
  rating?: number;
  year?: string | number;
  status?: string;
  date?: string;
  lastCompletedDate?: string;
  directors?: string[];
  developers?: string[];
  actors?: string[];
  authors?: string[];
  publishers?: string[];
  translators?: string[];
  characters?: { name: string; actor?: string }[];
  firms?: string[];
  genres?: string[];
  tierName?: string;
  notes?: string;
}

export interface TasteProfile {
  totalCount: number;
  topMasterpieces: CompactItemBrief[]; // 9-10 puan veya S/A tier
  strongFavorites: CompactItemBrief[]; // 8 puan alan yapımlar (kullanıcının güçlü çekirdek beğeni havuzu)
  dislikedItems: CompactItemBrief[]; // 2-5 puan (1 puan devam eden yapımlar için hariç tutulur)
  currentlyActive: CompactItemBrief[]; // İzleniyor / Oynanıyor / Okunuyor
  droppedItems: CompactItemBrief[]; // Yarım bırakılanlar
  followingItems: CompactItemBrief[]; // Takip edilenler
  recentCompleted: CompactItemBrief[]; // En son tamamlanan/izlenenler
  topGenres: { name: string; count: number }[];
  topDirectors: { name: string; count: number }[];
  topDevelopers: { name: string; count: number }[];
  topAuthors: { name: string; count: number }[];
  topFirms: { name: string; count: number }[];
  actorToWorks: { actor: string; works: string[] }[]; // Aktör/Seiyuu -> Yapım ve Karakter eşleştirmesi
  libraryCatalog: CompactItemBrief[]; // Kütüphanedeki tüm güvenli yapımların kompakt fihristi
}

/**
 * Filter items to strictly prevent hidden items or sensitive fields from ever leaking to AI.
 */
export function getAiSafeItems(items: ArchiveItem[]): ArchiveItem[] {
  return items.filter((item) => !item.isHidden);
}

/**
 * Resolves the tier row name for an item from the category tierRows definition.
 */
function resolveTierName(
  item: ArchiveItem,
  categories: { media: Category[]; game: Category[]; book?: Category[] }
): string | undefined {
  if (!item.tier) return undefined;
  const catList = item.mainTab === 'media' ? categories.media : item.mainTab === 'game' ? categories.game : (categories.book || []);
  const cat = catList.find((c) => c.id === item.cat);
  if (!cat || !cat.tierRows) return item.tier;
  const row = cat.tierRows.find((r) => r.id === item.tier);
  return row ? row.name : item.tier;
}

/**
 * Builds a structured taste profile and privacy-safe library context for Lore AI Assistant.
 */
export function generateTasteProfile(
  items: ArchiveItem[],
  categories: { media: Category[]; game: Category[]; book?: Category[] }
): TasteProfile {
  const safeItems = getAiSafeItems(items);

  // Category lookup map for human readable names
  const categoryMap = new Map<string, string>();
  [...categories.media, ...categories.game, ...(categories.book || [])].forEach((c) => {
    categoryMap.set(c.id, c.name);
  });

  const genreCounts: Record<string, number> = {};
  const directorCounts: Record<string, number> = {};
  const developerCounts: Record<string, number> = {};
  const authorCounts: Record<string, number> = {};
  const firmCounts: Record<string, number> = {};
  const actorWorkMap: Record<string, Set<string>> = {};

  const catalog: CompactItemBrief[] = [];
  const topMasterpieces: CompactItemBrief[] = [];
  const strongFavorites: CompactItemBrief[] = [];
  const dislikedItems: CompactItemBrief[] = [];
  const currentlyActive: CompactItemBrief[] = [];
  const droppedItems: CompactItemBrief[] = [];
  const followingItems: CompactItemBrief[] = [];

  for (const it of safeItems) {
    const catName = categoryMap.get(it.cat) || it.cat;
    const tierName = resolveTierName(it, categories);

    // Extract characters and their actors (e.g. Rika Orimoto -> Kana Hanazawa)
    const charList = it.characters && it.characters.length > 0
      ? it.characters.map((c) => ({
          name: c.name,
          actor: c.actor?.trim() || undefined,
        }))
      : undefined;

    // Combine actors from both the `actors` array and `characters` cast
    const combinedActorsSet = new Set<string>();
    it.actors?.forEach((a) => {
      const trimmed = a.trim();
      if (trimmed) combinedActorsSet.add(trimmed);
    });
    it.characters?.forEach((c) => {
      const act = c.actor?.trim();
      if (act) {
        combinedActorsSet.add(act);
        // Map actor to work & character name
        if (!actorWorkMap[act]) actorWorkMap[act] = new Set<string>();
        actorWorkMap[act].add(`${it.title} (${c.name})`);
      }
    });
    // Also map general actors to title
    it.actors?.forEach((a) => {
      const trimmed = a.trim();
      if (trimmed) {
        if (!actorWorkMap[trimmed]) actorWorkMap[trimmed] = new Set<string>();
        actorWorkMap[trimmed].add(it.title);
      }
    });

    const combinedActors = combinedActorsSet.size > 0 ? Array.from(combinedActorsSet) : undefined;

    const brief: CompactItemBrief = {
      id: it.id,
      title: it.title,
      category: catName,
      sub: it.sub || undefined,
      rating: it.rating > 0 ? it.rating : undefined,
      year: it.releaseYear || undefined,
      date: it.date || undefined,
      lastCompletedDate: it.lastCompletedDate || undefined,
      directors: it.director && it.director.length > 0 ? it.director : undefined,
      developers: it.developer && it.developer.length > 0 ? it.developer : undefined,
      actors: combinedActors ? combinedActors.slice(0, 6) : undefined,
      authors: it.author && it.author.length > 0 ? it.author : undefined,
      publishers: it.publisher && it.publisher.length > 0 ? it.publisher : undefined,
      translators: it.translator && it.translator.length > 0 ? it.translator : undefined,
      characters: charList && charList.length > 0 ? charList.slice(0, 6) : undefined,
      firms: it.firm && it.firm.length > 0 ? it.firm : undefined,
      genres: it.genre && it.genre.length > 0 ? it.genre : undefined,
      tierName: tierName || undefined,
    };

    // Determine status text
    if (it.mainTab === 'game') {
      brief.status = it.status;
      if (it.status === 'Oynanıyor') currentlyActive.push(brief);
      if (it.status === 'Yarım Bırakıldı') droppedItems.push(brief);
    } else if (it.mainTab === 'book') {
      if (it.reading) {
        brief.status = 'Okunuyor';
        currentlyActive.push(brief);
      }
      if (it.dropped) {
        brief.status = 'Yarım Bırakıldı';
        droppedItems.push(brief);
      }
    } else {
      if (it.watching) {
        brief.status = 'İzleniyor';
        currentlyActive.push(brief);
      }
      if (it.dropped) {
        brief.status = 'Yarım Bırakıldı';
        droppedItems.push(brief);
      }
      if (it.following) {
        brief.status = `Takipte${it.expectedDate ? ` (${it.expectedDate})` : ''}`;
        if (it.followNotes) brief.notes = it.followNotes;
        followingItems.push(brief);
      }
    }

    // High ratings vs low ratings
    const isHighTier = tierName && ['S', 'S+', 'S-Tier', 'A', 'A-Tier', 'Zirve', 'Efsane'].some((t) =>
      tierName.toUpperCase().includes(t.toUpperCase())
    );

    if (it.rating >= 9 || isHighTier) {
      topMasterpieces.push(brief);
    } else if (it.rating === 8) {
      strongFavorites.push(brief);
    } else if (it.rating > 1 && it.rating <= 5) {
      dislikedItems.push(brief);
    }

    // Weight genres, directors, developers, firms and authors by rating
    const weight = it.rating >= 8 ? 2 : 1;
    if (it.rating >= 6) {
      it.genre?.forEach((g) => {
        genreCounts[g] = (genreCounts[g] || 0) + weight;
      });
      it.director?.forEach((d) => {
        directorCounts[d] = (directorCounts[d] || 0) + weight;
      });
      it.developer?.forEach((dev) => {
        developerCounts[dev] = (developerCounts[dev] || 0) + weight;
      });
      it.firm?.forEach((f) => {
        firmCounts[f] = (firmCounts[f] || 0) + weight;
      });
      it.author?.forEach((a) => {
        authorCounts[a] = (authorCounts[a] || 0) + weight;
      });
    }

    catalog.push(brief);
  }

  // Find recent completed items sorted by lastCompletedDate or date descending
  const recentCompleted = [...safeItems]
    .filter((it) => (it.lastCompletedDate || it.date) && !it.dropped)
    .sort((a, b) => {
      const dateA = a.lastCompletedDate || a.date || '';
      const dateB = b.lastCompletedDate || b.date || '';
      return dateB.localeCompare(dateA);
    })
    .slice(0, 10)
    .map((it) => {
      const catName = categoryMap.get(it.cat) || it.cat;
      return {
        id: it.id,
        title: it.title,
        category: catName,
        sub: it.sub || undefined,
        rating: it.rating > 0 ? it.rating : undefined,
        year: it.releaseYear || undefined,
        date: it.date || undefined,
        lastCompletedDate: it.lastCompletedDate || undefined,
        actors: it.actors && it.actors.length > 0 ? it.actors.slice(0, 5) : undefined,
        authors: it.author,
        directors: it.director,
        developers: it.developer,
        genres: it.genre,
      };
    });

  // Sort top aggregates
  const toSortedArray = (dict: Record<string, number>, limit: number = 8) =>
    Object.entries(dict)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

  // Actor/Seiyuu to works list
  const actorToWorks = Object.entries(actorWorkMap)
    .map(([actor, worksSet]) => ({
      actor,
      works: Array.from(worksSet),
    }))
    .filter((a) => a.works.length > 0)
    .sort((a, b) => b.works.length - a.works.length)
    .slice(0, 25);

  return {
    totalCount: safeItems.length,
    topMasterpieces: topMasterpieces.slice(0, 15),
    strongFavorites: strongFavorites.slice(0, 15),
    dislikedItems: dislikedItems.slice(0, 10),
    currentlyActive: currentlyActive.slice(0, 10),
    droppedItems: droppedItems.slice(0, 10),
    followingItems: followingItems.slice(0, 10),
    recentCompleted,
    topGenres: toSortedArray(genreCounts, 10),
    topDirectors: toSortedArray(directorCounts, 6),
    topDevelopers: toSortedArray(developerCounts, 6),
    topAuthors: toSortedArray(authorCounts, 6),
    topFirms: toSortedArray(firmCounts, 6),
    actorToWorks,
    libraryCatalog: catalog,
  };
}

/**
 * Formats the TasteProfile into a compact, human-readable prompt block for Gemini.
 */
export function formatTasteProfileForPrompt(profile: TasteProfile): string {
  const lines: string[] = [];

  lines.push(`=== KULLANICININ LORE KÜTÜPHANESİ VE ZEVK HARİTASI ===`);
  lines.push(`Toplam Arşivlenen Yapım Sayısı: ${profile.totalCount}`);

  if (profile.topMasterpieces.length > 0) {
    const list = profile.topMasterpieces
      .map((m) => {
        const charInfo = m.characters && m.characters.length > 0
          ? ` [Karakterler: ${m.characters.map((c) => c.actor ? `${c.name} (${c.actor})` : c.name).join(', ')}]`
          : '';
        const authorInfo = m.authors?.length ? ` [Yazar: ${m.authors.join(', ')}]` : '';
        return `• [id: ${m.id}] ${m.title} (${m.category}${m.sub ? ` - ${m.sub}` : ''}, Puan: ${m.rating ?? 'Yok'}${m.tierName ? `, Tier: ${m.tierName}` : ''}${m.year ? `, ${m.year}` : ''})${charInfo}${authorInfo}`;
      })
      .join('\n');
    lines.push(`\n[EN ÇOK BEĞENİLEN ZİRVE BAŞYAPITLAR (9-10 Puan veya S-Tier Zirvesi)]:\n${list}`);
  }

  if (profile.strongFavorites.length > 0) {
    const list = profile.strongFavorites
      .map((m) => {
        const charInfo = m.characters && m.characters.length > 0
          ? ` [Karakterler: ${m.characters.map((c) => c.actor ? `${c.name} (${c.actor})` : c.name).join(', ')}]`
          : '';
        const authorInfo = m.authors?.length ? ` [Yazar: ${m.authors.join(', ')}]` : '';
        return `• [id: ${m.id}] ${m.title} (${m.category}${m.sub ? ` - ${m.sub}` : ''}, Puan: ${m.rating}${m.year ? `, ${m.year}` : ''})${charInfo}${authorInfo}`;
      })
      .join('\n');
    lines.push(`\n[GÜÇLÜ FAVORİLER & YÜKSEK KALİTE STANDARDI (8 Puan - Not: Kullanıcı 10 puanı çok nadir verir, bu 8 puanlık yapımlar kullanıcının çekirdek beğeni havuzudur)]:\n${list}`);
  }

  if (profile.dislikedItems.length > 0) {
    const list = profile.dislikedItems
      .map((m) => `• [id: ${m.id}] ${m.title} (${m.category}, Puan: ${m.rating})`)
      .join('\n');
    lines.push(`\n[DÜŞÜK PUAN VERİLEN / BEĞENİLMEYEN YAPIMLAR (2-5 Puan, Not: 1 puan devam eden yapımlar için hariç tutulmuştur)]:\n${list}`);
  }

  if (profile.currentlyActive.length > 0) {
    const list = profile.currentlyActive
      .map((m) => `• [id: ${m.id}] ${m.title} (${m.category}, Durum: ${m.status})`)
      .join('\n');
    lines.push(`\n[ŞU AN DEVAM EDENLER (İzleniyor / Oynanıyor / Okunuyor)]:\n${list}`);
  }

  if (profile.droppedItems.length > 0) {
    const list = profile.droppedItems
      .map((m) => `• [id: ${m.id}] ${m.title} (${m.category})`)
      .join('\n');
    lines.push(`\n[YARIM BIRAKILANLAR (Dropped)]:\n${list}`);
  }

  if (profile.followingItems.length > 0) {
    const list = profile.followingItems
      .map((m) => `• [id: ${m.id}] ${m.title} (${m.status}${m.notes ? ` - Not: ${m.notes}` : ''})`)
      .join('\n');
    lines.push(`\n[TAKİPTE OLANLAR VE BEKLENENLER]:\n${list}`);
  }

  if (profile.recentCompleted.length > 0) {
    const list = profile.recentCompleted
      .map((m) => `• [id: ${m.id}] ${m.title} (${m.category}, Tarih: ${m.lastCompletedDate || m.date || 'Belirtilmedi'}${m.rating ? `, Puan: ${m.rating}` : ''}${m.directors ? `, Yönetmen: ${m.directors.join(', ')}` : ''}${m.actors ? `, Kadro: ${m.actors.join(', ')}` : ''})`)
      .join('\n');
    lines.push(`\n[SON İZLENEN / BİTİRİLEN YAPIMLAR (Kronolojik)]:\n${list}`);
  }

  if (profile.actorToWorks.length > 0) {
    const actorLines = profile.actorToWorks
      .map((a) => `• ${a.actor}: ${a.works.join(' | ')}`)
      .join('\n');
    lines.push(`\n[SESLENDİRMEN / AKTÖR VE KARAKTER DİZİNİ (Kütüphanedeki Karakterler)]:\n${actorLines}`);
  }

  if (profile.topGenres.length > 0) {
    lines.push(`\n[FAVORİ TÜRLER]: ${profile.topGenres.map((g) => `${g.name} (${g.count})`).join(', ')}`);
  }

  if (profile.topDirectors.length > 0) {
    lines.push(`[FAVORİ YÖNETMENLER]: ${profile.topDirectors.map((d) => `${d.name}`).join(', ')}`);
  }

  if (profile.topDevelopers.length > 0) {
    lines.push(`[FAVORİ GELİŞTİRİCİLER]: ${profile.topDevelopers.map((d) => `${d.name}`).join(', ')}`);
  }

  if (profile.topAuthors.length > 0) {
    lines.push(`[FAVORİ YAZARLAR]: ${profile.topAuthors.map((a) => `${a.name}`).join(', ')}`);
  }

  if (profile.topFirms.length > 0) {
    lines.push(`[FAVORİ STÜDYOLAR]: ${profile.topFirms.map((f) => `${f.name}`).join(', ')}`);
  }

  // Full library index for precise title lookups
  lines.push(`\n[KÜTÜPHANEDEKİ DİĞER TÜM YAPIMLARIN LİSTESİ]:`);
  const catalogEntries = profile.libraryCatalog.map((c) => {
    const chars = c.characters && c.characters.length > 0
      ? ` [${c.characters.map((ch) => ch.actor ? `${ch.name}:${ch.actor}` : ch.name).join(', ')}]`
      : '';
    return `[id: ${c.id}] ${c.title} (${c.category}${c.rating ? `, ${c.rating}/10` : ''}${chars})`;
  });
  lines.push(catalogEntries.join(' | '));

  return lines.join('\n');
}
