import type { ArchiveItem, MainTabType } from '../types';
import { resolveGitHubImage, getGitHubSyncConfig } from './githubSync';

const normalizeName = (name: string) => name.trim().toLocaleLowerCase('tr');

/** Aynı sekmedeki bütün karakter adları (tekrarsız, alfabetik). Kitapta liste yok. */
export function collectCharacterNames(allItems: ArchiveItem[], mainTab: MainTabType): string[] {
  if (mainTab === 'book') return [];
  const names = new Map<string, string>();
  for (const it of allItems) {
    if (it.mainTab !== mainTab) continue;
    for (const c of it.characters || []) {
      const name = (c.name || '').trim();
      if (name && !names.has(normalizeName(name))) names.set(normalizeName(name), name);
    }
  }
  return Array.from(names.values()).sort((a, b) => a.localeCompare(b, 'tr'));
}

/**
 * Karakter adı başka bir yapımda (aynı sekmede) resimli olarak varsa onun resmini (bağımsız
 * kopya, data URL) ve oyuncu adını döndürür. Kitap sekmesinde çalışmaz. Birden fazla eşleşmede
 * en son güncellenen yapımdaki alınır.
 */
export async function findSameNameCharacter(
  allItems: ArchiveItem[],
  mainTab: MainTabType,
  excludeItemId: string | undefined,
  name: string
): Promise<{ image: string; actor?: string } | null> {
  if (mainTab === 'book') return null;
  const key = normalizeName(name);
  if (!key) return null;

  let best: { ref: string; actor?: string } | null = null;
  let bestTime = -1;
  for (const it of allItems) {
    if (it.id === excludeItemId || it.mainTab !== mainTab) continue;
    for (const c of it.characters || []) {
      if (!c.image || normalizeName(c.name || '') !== key) continue;
      const time = it.updatedAt || it.createdAt || 0;
      if (time >= bestTime) {
        best = { ref: c.fileName || c.image, actor: c.actor };
        bestTime = time;
      }
    }
  }
  if (!best) return null;

  const image = await resolveGitHubImage(best.ref, getGitHubSyncConfig());
  return image ? { image, actor: best.actor } : null;
}
