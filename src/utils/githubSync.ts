import { AppData, ArchiveItem, CustomBadge } from '../types';
import { getCachedImageBlob, setCachedImageBlob, getFileHandleFromRelativePath, getCardThumbnailKey } from './fileSystem';
import { optimizeImageFile } from './imageOptimizer';

export interface GitHubSyncConfig {
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  token: string;
  lastSyncedAt?: string;
  lastSyncedCommitSha?: string;
}

const GITHUB_CONFIG_STORAGE_KEY = 'lore_github_sync_config_v1';
const GITHUB_DIRTY_STORAGE_KEY = 'lore_github_has_unpushed_changes';

export const DEFAULT_GITHUB_CONFIG: GitHubSyncConfig = {
  owner: '',
  repo: '',
  branch: 'main',
  filePath: 'yapim-arsivim-data.json',
  token: '',
};

export function getGitHubSyncConfig(): GitHubSyncConfig {
  try {
    const raw = localStorage.getItem(GITHUB_CONFIG_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GITHUB_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      owner: (parsed.owner || '').trim(),
      repo: (parsed.repo || '').trim(),
      branch: (parsed.branch || 'main').trim(),
      filePath: (parsed.filePath || 'yapim-arsivim-data.json').trim(),
      token: (parsed.token || '').trim(),
      lastSyncedAt: parsed.lastSyncedAt,
      lastSyncedCommitSha: parsed.lastSyncedCommitSha,
    };
  } catch {
    return { ...DEFAULT_GITHUB_CONFIG };
  }
}

export function saveGitHubSyncConfig(config: GitHubSyncConfig): void {
  try {
    localStorage.setItem(GITHUB_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('Failed to save GitHub sync config to localStorage:', err);
  }
}

export function getHasUnpushedChanges(): boolean {
  try {
    return localStorage.getItem(GITHUB_DIRTY_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setHasUnpushedChanges(dirty: boolean): void {
  try {
    if (dirty) {
      localStorage.setItem(GITHUB_DIRTY_STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(GITHUB_DIRTY_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('Failed to update dirty flag in localStorage:', err);
  }
}

// Convert UTF-8 string to base64 safely (handles Unicode/Turkish characters)
function toBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 to UTF-8 string
function fromBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// Helper to sanitize owner/repo input (supports entering "owner/repo" or separate values)
export function parseOwnerAndRepo(input: string): { owner: string; repo: string } {
  const clean = input.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
  if (clean.includes('/')) {
    const parts = clean.split('/').filter(Boolean);
    return {
      owner: parts[0] || '',
      repo: parts[1] || '',
    };
  }
  return { owner: clean, repo: '' };
}

/**
 * Tests connection to the GitHub repository using the provided credentials.
 */
export async function testGitHubConnection(config: GitHubSyncConfig): Promise<{
  success: boolean;
  message: string;
  repoFullName?: string;
  hasFile?: boolean;
}> {
  const { owner, repo, branch, filePath, token } = config;

  if (!owner || !repo) {
    return { success: false, message: 'GitHub Kullanıcı Adı ve Repo Adı gereklidir.' };
  }
  if (!token) {
    return { success: false, message: 'GitHub Kişisel Erişim Tokeni (Personal Access Token) gereklidir.' };
  }

  try {
    // 1. Check repo access
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (repoRes.status === 401) {
      return { success: false, message: 'Geçersiz veya süresi dolmuş GitHub Token.' };
    }
    if (repoRes.status === 404) {
      return { success: false, message: `"${owner}/${repo}" deposu bulunamadı veya token'ın bu depoya erişim izni yok.` };
    }
    if (!repoRes.ok) {
      return { success: false, message: `GitHub API Hatası: ${repoRes.status} ${repoRes.statusText}` };
    }

    const repoData = await repoRes.json();

    // 2. Check if the target data file already exists in branch
    let hasFile = false;
    try {
      const fileRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch || 'main'}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );
      if (fileRes.ok) {
        hasFile = true;
      }
    } catch {
      // Ignore file check error
    }

    return {
      success: true,
      message: `Bağlantı başarılı! Depo: ${repoData.full_name} (${repoData.private ? 'Özel/Private' : 'Genel/Public'})`,
      repoFullName: repoData.full_name,
      hasFile,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Ağ hatası: ${err.message || err}`,
    };
  }
}

/**
 * Lightweight check: queries the GitHub Commits API for the single latest commit
 * modifying the data file. Takes milliseconds and transfers <1KB.
 */
export async function checkGitHubUpdateAvailable(
  config: GitHubSyncConfig,
  currentLocalCommitSha?: string,
  currentLocalLastUpdated?: string
): Promise<{
  updateAvailable: boolean;
  latestCommitSha?: string;
  latestCommitDate?: string;
  commitMessage?: string;
}> {
  const { owner, repo, branch, filePath, token } = config;

  if (!owner || !repo || !filePath) {
    return { updateAvailable: false };
  }

  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(
      filePath
    )}&page=1&per_page=1&sha=${encodeURIComponent(branch || 'main')}&_nocache=${Date.now()}`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      return { updateAvailable: false };
    }

    const commits = await res.json();
    if (!Array.isArray(commits) || commits.length === 0) {
      return { updateAvailable: false };
    }

    const latest = commits[0];
    const latestSha = latest.sha;
    const latestDate = latest.commit?.committer?.date || latest.commit?.author?.date;
    const commitMsg = latest.commit?.message || '';

    // If we have a recorded commit SHA and it differs from latest
    if (currentLocalCommitSha) {
      if (currentLocalCommitSha !== latestSha) {
        return {
          updateAvailable: true,
          latestCommitSha: latestSha,
          latestCommitDate: latestDate,
          commitMessage: commitMsg,
        };
      }
      return {
        updateAvailable: false,
        latestCommitSha: latestSha,
        latestCommitDate: latestDate,
      };
    }

    // Fallback: compare dates if commitSha not yet set
    if (latestDate && currentLocalLastUpdated) {
      const remoteTime = new Date(latestDate).getTime();
      const localTime = new Date(currentLocalLastUpdated).getTime();
      if (remoteTime > localTime + 2000) {
        return {
          updateAvailable: true,
          latestCommitSha: latestSha,
          latestCommitDate: latestDate,
          commitMessage: commitMsg,
        };
      }
    }

    return {
      updateAvailable: false,
      latestCommitSha: latestSha,
      latestCommitDate: latestDate,
    };
  } catch (err) {
    console.warn('Lightweight GitHub check failed:', err);
    return { updateAvailable: false };
  }
}

function blobToBase64Raw(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Pushes local AppData to GitHub repository (PC -> GitHub).
 * Writes clean JSON with `images/` references so the payload stays 1-2 MB.
 * If dirHandle is provided, incrementally uploads any missing images in `images/` folder to GitHub.
 */
/**
 * Lists every file under images/ on GitHub in a single request using the git tree API
 * (no 1000-file-per-folder limit). Returns a map of "posters/x.webp" -> blob SHA,
 * or null if the listing failed or was truncated (caller falls back to per-folder listing).
 */
async function listGitHubImagesViaTree(
  owner: string,
  repo: string,
  branch: string,
  token: string
): Promise<Map<string, string> | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1&_nocache=${Date.now()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.tree) || data.truncated) return null;

    const result = new Map<string, string>();
    for (const entry of data.tree) {
      if (entry && entry.type === 'blob' && typeof entry.path === 'string' && entry.sha && entry.path.startsWith('images/')) {
        result.set(entry.path.replace(/^images\//, ''), entry.sha);
      }
    }
    return result;
  } catch (e) {
    console.warn('[GitHub Push] Tree listing failed, falling back to folder listing:', e);
    return null;
  }
}

/**
 * Computes the git blob SHA-1 of raw base64 content, the same value GitHub reports for a file.
 * Returns null if hashing is unavailable.
 */
async function computeGitBlobShaFromBase64(base64: string): Promise<string | null> {
  try {
    if (!crypto?.subtle) return null;
    const bin = atob(base64);
    const header = new TextEncoder().encode(`blob ${bin.length}\0`);
    const bytes = new Uint8Array(header.length + bin.length);
    bytes.set(header, 0);
    for (let i = 0; i < bin.length; i++) {
      bytes[header.length + i] = bin.charCodeAt(i);
    }
    const digest = await crypto.subtle.digest('SHA-1', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

export async function pushDataToGitHub(
  config: GitHubSyncConfig,
  appData: AppData,
  dirHandle?: FileSystemDirectoryHandle | null
): Promise<{
  success: boolean;
  message: string;
  commitSha?: string;
  syncedAt?: string;
  uploadedImagesCount?: number;
}> {
  const { owner, repo, branch, filePath, token } = config;

  if (!owner || !repo) {
    throw new Error('GitHub Kullanıcı Adı ve Repo Adı eksik. Lütfen Ayarlar menüsünden doldurun.');
  }
  if (!token) {
    throw new Error('GitHub Personal Access Token eksik. Lütfen Ayarlar menüsünden girin.');
  }

  const cleanBranch = branch || 'main';
  const cleanPath = filePath || 'yapim-arsivim-data.json';

  // 1. Get existing file SHA if already exists
  let existingSha: string | undefined = undefined;
  try {
    const getRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}?ref=${cleanBranch}&_nocache=${Date.now()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    if (getRes.ok) {
      const data = await getRes.json();
      existingSha = data.sha;
    }
  } catch (e) {
    console.warn('Could not fetch existing file SHA:', e);
  }

  // 2. Prepare clean JSON payload
  // Keep thumbnailFileName, characters.fileName, ankiExtraImages.fileName, badges.fileName; drop inline heavy base64 strings
  // Normalization helper: Ensures every image path goes into its proper subfolder (posters/, characters/, anki/, badges/)
  // and NEVER into the root images/ folder!
  const memoryImageBase64Map = new Map<string, string>();

  const cleanItems: ArchiveItem[] = (appData.items || []).map((item) => {
    const copy = { ...item };

    // 1. Poster normalization -> images/posters/
    let posterRelPath = copy.thumbnailFileName ? copy.thumbnailFileName.replace(/^images\//, '').trim() : '';
    if (posterRelPath) {
      if (!posterRelPath.startsWith('posters/') && !/^(characters|anki|badges)\//.test(posterRelPath)) {
        posterRelPath = `posters/${posterRelPath}`;
      }
    } else if (copy.thumbnail) {
      posterRelPath = `posters/${copy.id}.webp`;
    }

    if (posterRelPath) {
      copy.thumbnailFileName = `images/${posterRelPath}`;
      if (copy.thumbnail && copy.thumbnail.startsWith('data:image/')) {
        const base64Data = copy.thumbnail.split(',')[1] || '';
        if (base64Data) {
          memoryImageBase64Map.set(posterRelPath, base64Data);
        }
      }
    }
    // Always strip bulky inline base64 thumbnail so JSON sent to GitHub stays pure text (~150 KB)
    delete copy.thumbnail;
    delete copy.cardThumbnail;

    // 2. Characters normalization -> images/characters/
    if (copy.characters && Array.isArray(copy.characters) && copy.characters.length > 0) {
      copy.characters = copy.characters.map((char, idx) => {
        const charCopy = { ...char };
        let charRelPath = charCopy.fileName ? charCopy.fileName.replace(/^images\//, '').trim() : '';
        if (charRelPath) {
          if (!charRelPath.startsWith('characters/')) {
            charRelPath = `characters/${charRelPath.split('/').pop() || `${copy.id}_char_${idx}.jpg`}`;
          }
        } else {
          charRelPath = `characters/${copy.id}_char_${idx}.jpg`;
        }
        charCopy.fileName = `images/${charRelPath}`;
        if (charCopy.image && charCopy.image.startsWith('data:image/')) {
          const base64Data = charCopy.image.split(',')[1] || '';
          if (base64Data) {
            memoryImageBase64Map.set(charRelPath, base64Data);
          }
        }
        charCopy.image = `images/${charRelPath}`;
        return charCopy;
      });
    }

    // 3. Anki extra images normalization -> images/anki/
    if (copy.ankiExtraImages && Array.isArray(copy.ankiExtraImages) && copy.ankiExtraImages.length > 0) {
      copy.ankiExtraImages = copy.ankiExtraImages.map((extra, idx) => {
        const extraCopy = { ...extra };
        let ankiRelPath = extraCopy.fileName ? extraCopy.fileName.replace(/^images\//, '').trim() : '';
        if (ankiRelPath) {
          if (!ankiRelPath.startsWith('anki/')) {
            ankiRelPath = `anki/${ankiRelPath.split('/').pop() || `${copy.id}_extra_${idx}.jpg`}`;
          }
        } else {
          ankiRelPath = `anki/${copy.id}_extra_${idx}.jpg`;
        }
        extraCopy.fileName = `images/${ankiRelPath}`;
        if (extraCopy.url && extraCopy.url.startsWith('data:image/')) {
          const base64Data = extraCopy.url.split(',')[1] || '';
          if (base64Data) {
            memoryImageBase64Map.set(ankiRelPath, base64Data);
          }
        }
        extraCopy.url = `images/${ankiRelPath}`;
        return extraCopy;
      });
    }

    return copy;
  });

  // 4. Custom Badges normalization -> images/badges/ (and strip bulky base64 iconData)
  const cleanBadges = (appData.customBadges || []).map((badge) => {
    const badgeCopy = { ...badge };
    let badgeRelPath = badgeCopy.fileName ? badgeCopy.fileName.replace(/^images\//, '').trim() : '';
    if (badgeRelPath) {
      if (!badgeRelPath.startsWith('badges/')) {
        badgeRelPath = `badges/${badgeRelPath.split('/').pop() || `badge_${badgeCopy.id}.webp`}`;
      }
    } else {
      badgeRelPath = `badges/badge_${badgeCopy.id}.webp`;
    }
    badgeCopy.fileName = `images/${badgeRelPath}`;
    if (badgeCopy.iconData && badgeCopy.iconData.startsWith('data:')) {
      const base64Data = badgeCopy.iconData.split(',')[1] || '';
      if (base64Data) {
        memoryImageBase64Map.set(badgeRelPath, base64Data);
      }
    }
    badgeCopy.iconData = `images/${badgeRelPath}`;
    return badgeCopy;
  });

  // 3. Incrementally upload ONLY missing images to GitHub subdirectories
  let uploadedImagesCount = 0;
  try {
    let imagesDir: FileSystemDirectoryHandle | null = null;
    if (dirHandle) {
      try {
        imagesDir = await dirHandle.getDirectoryHandle('images', { create: false });
      } catch {
        imagesDir = null;
      }
    }

    // Collect all image filenames needed (all guaranteed to start with posters/, characters/, anki/, badges/)
    const neededImageNames = new Set<string>();
    for (const item of cleanItems) {
      if (item.thumbnailFileName) {
        neededImageNames.add(item.thumbnailFileName.replace(/^images\//, ''));
      }
      if (item.characters && Array.isArray(item.characters)) {
        for (const char of item.characters) {
          if (char.fileName) {
            neededImageNames.add(char.fileName.replace(/^images\//, ''));
          }
        }
      }
      if (item.ankiExtraImages && Array.isArray(item.ankiExtraImages)) {
        for (const extra of item.ankiExtraImages) {
          if (extra.fileName) {
            neededImageNames.add(extra.fileName.replace(/^images\//, ''));
          }
        }
      }
    }
    for (const badge of cleanBadges) {
      if (badge.fileName) {
        neededImageNames.add(badge.fileName.replace(/^images\//, ''));
      }
    }

    if (neededImageNames.size > 0) {
      // Query existing files on GitHub. First try the git tree API: one request, no 1000-file limit,
      // and it returns each file's blob SHA so changed images with the same name can be detected.
      const existingGhFiles = new Map<string, string>();
      const treeEntries = await listGitHubImagesViaTree(owner, repo, cleanBranch, token);
      if (treeEntries) {
        for (const [relPath, sha] of treeEntries) {
          existingGhFiles.set(relPath, sha);
        }
      }
      // Fallback: old per-folder listing (max 1000 files per folder)
      const checkDirs = treeEntries ? [] : ['posters', 'characters', 'anki', 'badges', 'posters-small'];
      for (const subDir of checkDirs) {
        try {
          const listRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/images/${subDir}?ref=${cleanBranch}&_nocache=${Date.now()}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
              },
            }
          );
          if (listRes.ok) {
            const files = await listRes.json();
            if (Array.isArray(files)) {
              for (const f of files) {
                if (f.type === 'file' && f.path && f.sha) {
                  const relPath = f.path.replace(/^images\//, '');
                  existingGhFiles.set(relPath, f.sha);
                }
              }
            }
          }
        } catch {
          // Ignore individual subfolder listing errors
        }
      }

      // Upload missing or changed images only.
      // With the tree listing we compare blob SHAs, so an image whose content changed but kept
      // the same name (characters, anki, badges) is re-uploaded. Without it, existing names are skipped.
      for (const imgName of neededImageNames) {
        const existingSha = existingGhFiles.get(imgName);

        if (existingSha && !treeEntries) continue;

        try {
          let base64 = memoryImageBase64Map.get(imgName);

          if (!base64 && imagesDir) {
            try {
              const fileHandle = await getFileHandleFromRelativePath(imagesDir, imgName, false);
              const file = await fileHandle.getFile();
              base64 = await blobToBase64Raw(file);
            } catch {
              // Try bare name from root of local imagesDir as fallback
              const bareName = imgName.split('/').pop();
              if (bareName) {
                try {
                  const fileHandle = await imagesDir.getFileHandle(bareName, { create: false });
                  const file = await fileHandle.getFile();
                  base64 = await blobToBase64Raw(file);
                } catch {}
              }
            }
          }

          if (!base64) {
            // Fallback: Check local IndexedDB image cache
            try {
              const cleanKey = imgName.replace(/^(posters|characters|anki|badges)\//, '');
              const cachedBlob = (await getCachedImageBlob(imgName)) || (await getCachedImageBlob(cleanKey));
              if (cachedBlob) {
                base64 = await blobToBase64Raw(cachedBlob);
              }
            } catch {}
          }

          if (existingSha) {
            // Already on GitHub: skip unless the local content differs
            if (!base64) continue;
            const localSha = await computeGitBlobShaFromBase64(base64);
            if (!localSha || localSha === existingSha) continue;
          }

          if (base64) {
            const putPayload: Record<string, any> = {
              message: `Görsel ${existingSha ? 'Güncelle' : 'Yükle'}: ${imgName} [skip ci]`,
              content: base64,
              branch: cleanBranch,
            };
            if (existingSha) {
              putPayload.sha = existingSha;
            }

            const uploadRes = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/contents/images/${imgName}`,
              {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: 'application/vnd.github.v3+json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(putPayload),
              }
            );
            if (uploadRes.ok) {
              uploadedImagesCount++;
              existingGhFiles.set(imgName, 'uploaded');
            }
          }
        } catch (err) {
          console.warn(`Could not upload image ${imgName} to GitHub:`, err);
        }
      }

      // --- Step 4.3: Generate and upload 400px WebP small posters (images/posters-small/<name>.webp) ---
      let smallUploadSuccess = 0;
      let smallUploadFailed = 0;

      for (const item of cleanItems) {
        if (!item.thumbnailFileName) continue;
        const smallKey = getCardThumbnailKey(item.thumbnailFileName); // e.g. "posters-small/item_123.webp"
        const existingSha = existingGhFiles.get(smallKey);
        if (existingSha) continue; // Already on GitHub, fast skip!

        try {
          const origRelPath = item.thumbnailFileName.replace(/^images\//, '');
          let origSource: File | Blob | string | null = null;

          // 1. Check in-memory base64 map
          const memBase64 = memoryImageBase64Map.get(origRelPath);
          if (memBase64) {
            origSource = `data:image/jpeg;base64,${memBase64}`;
          }

          // 2. Check local imagesDir file handle
          if (!origSource && imagesDir) {
            try {
              const fileHandle = await getFileHandleFromRelativePath(imagesDir, origRelPath, false);
              origSource = await fileHandle.getFile();
            } catch {
              const bareName = origRelPath.split('/').pop();
              if (bareName) {
                try {
                  const fileHandle = await imagesDir.getFileHandle(bareName, { create: false });
                  origSource = await fileHandle.getFile();
                } catch {}
              }
            }
          }

          // 3. Check local IndexedDB image cache
          if (!origSource) {
            try {
              const cleanKey = origRelPath.replace(/^(posters|characters|anki|badges)\//, '');
              const cachedBlob = (await getCachedImageBlob(origRelPath)) || (await getCachedImageBlob(cleanKey));
              if (cachedBlob) {
                origSource = cachedBlob;
              }
            } catch {}
          }

          if (!origSource) continue; // Silently skip if original source cannot be found

          // 4. Generate 400x600 WebP (quality 0.85)
          const optimizedDataUrl = await optimizeImageFile(origSource, 400, 600, 0.85);
          if (!optimizedDataUrl || !optimizedDataUrl.startsWith('data:image/')) continue;

          const smallBase64 = optimizedDataUrl.split(',')[1] || '';
          if (!smallBase64) continue;

          // Also save in local IndexedDB image_cache so PC immediately has small posters cached
          try {
            const arr = optimizedDataUrl.split(',');
            const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/webp';
            const bstr = atob(arr[1] || '');
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
              u8arr[n] = bstr.charCodeAt(n);
            }
            await setCachedImageBlob(smallKey, new Blob([u8arr], { type: mime }));
          } catch {}

          // 5. Upload to GitHub with retry on 403 or 409
          const putPayload = {
            message: `Küçük Afiş: ${smallKey} [skip ci]`,
            content: smallBase64,
            branch: cleanBranch,
          };

          let uploaded = false;
          let retries = 0;
          const maxRetries = 3;

          while (!uploaded && retries < maxRetries) {
            // Safety throttle between PUT requests (~110ms)
            await new Promise((r) => setTimeout(r, 110));

            try {
              const uploadRes = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/contents/images/${smallKey}`,
                {
                  method: 'PUT',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(putPayload),
                }
              );

              if (uploadRes.ok) {
                uploaded = true;
                smallUploadSuccess++;
                existingGhFiles.set(smallKey, 'uploaded');
              } else if (uploadRes.status === 403 || uploadRes.status === 409) {
                retries++;
                const delayMs = retries === 1 ? 500 : retries === 2 ? 1500 : 3000;
                console.warn(`[GitHub Push] Retrying small poster ${smallKey} (${uploadRes.status}) in ${delayMs}ms...`);
                await new Promise((r) => setTimeout(r, delayMs));
              } else {
                break; // Non-retryable error, stop trying this small poster
              }
            } catch {
              retries++;
              await new Promise((r) => setTimeout(r, 1000));
            }
          }

          if (!uploaded) {
            smallUploadFailed++;
          }
        } catch (smallErr) {
          console.warn(`Could not produce/upload small poster for ${item.id}:`, smallErr);
          smallUploadFailed++;
        }
      }

      if (smallUploadSuccess > 0 || smallUploadFailed > 0) {
        console.log(`[GitHub Push] Small posters sync complete: ${smallUploadSuccess} uploaded, ${smallUploadFailed} failed/skipped.`);
      }
    }
  } catch (imgSyncErr) {
    console.warn('Image push to GitHub had warnings:', imgSyncErr);
  }

  const nowIso = new Date().toISOString();
  const payloadData: AppData = {
    ...appData,
    lastUpdated: nowIso,
    items: cleanItems,
    customBadges: cleanBadges,
  };

  const jsonString = JSON.stringify(payloadData, null, 2);
  const base64Content = toBase64Utf8(jsonString);

  const commitMessage = `Lore Arşivi Güncellemesi (${cleanItems.length} yapım${
    uploadedImagesCount > 0 ? `, ${uploadedImagesCount} yeni afiş` : ''
  }) - ${new Date().toLocaleDateString('tr-TR')} [skip ci]`;

  // 4. Fetch the freshest SHA of cleanPath right before writing to avoid ANY SHA conflict!
  let freshSha: string | undefined = undefined;
  try {
    const getRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}?ref=${cleanBranch}&_nocache=${Date.now()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    if (getRes.ok) {
      const data = await getRes.json();
      freshSha = data.sha;
    }
  } catch (e) {
    console.warn('Could not fetch freshest file SHA:', e);
  }

  // 5. PUT content to GitHub Contents API
  const putRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: commitMessage,
        content: base64Content,
        branch: cleanBranch,
        sha: freshSha,
      }),
    }
  );

  if (!putRes.ok) {
    let errMsg = `GitHub yükleme hatası (${putRes.status})`;
    try {
      const errJson = await putRes.json();
      if (errJson.message) errMsg = `GitHub: ${errJson.message}`;
    } catch {}
    throw new Error(errMsg);
  }

  const result = await putRes.json();
  const commitSha = result.commit?.sha || result.content?.sha;

  // Update local config
  const updatedConfig: GitHubSyncConfig = {
    ...config,
    lastSyncedAt: nowIso,
    lastSyncedCommitSha: commitSha,
  };
  saveGitHubSyncConfig(updatedConfig);
  setHasUnpushedChanges(false);

  return {
    success: true,
    message:
      uploadedImagesCount > 0
        ? `Veritabanı ve ${uploadedImagesCount} yeni afiş GitHub deposuna başarıyla yüklendi!`
        : 'Veritabanı GitHub deposuna başarıyla yüklendi!',
    commitSha,
    syncedAt: nowIso,
    uploadedImagesCount,
  };
}

/**
 * Pulls latest AppData from GitHub repository (GitHub -> Mobile / PC).
 * Fetches raw content directly for high performance and no base64 size limits.
 */
export async function pullDataFromGitHub(config: GitHubSyncConfig): Promise<{
  success: boolean;
  appData: AppData;
  commitSha?: string;
  syncedAt?: string;
}> {
  const { owner, repo, branch, filePath, token } = config;

  if (!owner || !repo) {
    throw new Error('GitHub Kullanıcı Adı ve Repo Adı eksik.');
  }

  const cleanBranch = branch || 'main';
  const cleanPath = filePath || 'yapim-arsivim-data.json';

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3.raw',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // 1. Fetch raw JSON content
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}?ref=${cleanBranch}&_nocache=${Date.now()}`,
    { headers }
  );

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`GitHub'da "${cleanPath}" dosyası bulunamadı. Lütfen önce PC'den eşitleme yapın.`);
    }
    if (res.status === 401) {
      throw new Error('GitHub token geçersiz veya yetkisiz.');
    }
    throw new Error(`GitHub veri çekme hatası: ${res.status} ${res.statusText}`);
  }

  const rawText = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch (err: any) {
    // If GitHub returned a JSON object containing { content: base64 } instead of raw text
    try {
      const fallbackObj = JSON.parse(rawText);
      if (fallbackObj.content && fallbackObj.encoding === 'base64') {
        const decoded = fromBase64Utf8(fallbackObj.content);
        parsed = JSON.parse(decoded);
      } else {
        throw err;
      }
    } catch {
      throw new Error('GitHub verisi geçerli bir JSON dosyası değil: ' + err.message);
    }
  }

  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error('GitHub dosyasında geçerli bir Lore arşivi bulunamadı (items eksik).');
  }

  // 2. Fetch latest commit SHA for tracking
  let commitSha: string | undefined = undefined;
  try {
    const commitCheck = await checkGitHubUpdateAvailable(config);
    commitSha = commitCheck.latestCommitSha;
  } catch {}

  const nowIso = new Date().toISOString();

  // Update local config
  const updatedConfig: GitHubSyncConfig = {
    ...config,
    lastSyncedAt: nowIso,
    lastSyncedCommitSha: commitSha || config.lastSyncedCommitSha,
  };
  saveGitHubSyncConfig(updatedConfig);
  setHasUnpushedChanges(false);

  return {
    success: true,
    appData: parsed as AppData,
    commitSha,
    syncedAt: nowIso,
  };
}

// Helper to convert Blob to Base64 Data URL (permanent, offline-safe)
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// In-memory cache for permanent Data URLs to prevent repeated conversions
const memoryDataUrlCache = new Map<string, string>();

export function clearMemoryDataUrlCache(fileName?: string): void {
  if (fileName) {
    const clean = fileName.replace(/^images\//, '');
    memoryDataUrlCache.delete(clean);
  } else {
    memoryDataUrlCache.clear();
  }
}

/**
 * Resolves an image filename from GitHub or IndexedDB cache.
 * Returns a permanent base64 Data URL (data:image/...) identical to ZIP import.
 */
export async function resolveGitHubImage(
  fileName: string,
  config: GitHubSyncConfig
): Promise<string | null> {
  if (!fileName || fileName.trim() === '') return null;
  // If already a Data URL, Blob URL, or external HTTP URL, return as-is
  if (fileName.startsWith('data:') || fileName.startsWith('blob:') || fileName.startsWith('http://') || fileName.startsWith('https://')) {
    return fileName;
  }

  let cleanName = fileName.replace(/^images\//, '').trim();
  if (!cleanName) return null;
  // If cleanName lacks a subfolder prefix, detect based on convention or fallback
  if (!cleanName.includes('/')) {
    if (cleanName.includes('_char_')) {
      cleanName = `characters/${cleanName}`;
    } else if (cleanName.includes('_extra_')) {
      cleanName = `anki/${cleanName}`;
    } else if (cleanName.startsWith('badge_')) {
      cleanName = `badges/${cleanName}`;
    } else {
      cleanName = `posters/${cleanName}`;
    }
  }
  const bareName = cleanName.split('/').pop() || cleanName;

  // 1. Check in-memory Data URL cache
  if (memoryDataUrlCache.has(cleanName)) {
    return memoryDataUrlCache.get(cleanName)!;
  }
  if (memoryDataUrlCache.has(bareName)) {
    return memoryDataUrlCache.get(bareName)!;
  }

  // 2. Check local IndexedDB cache
  try {
    const cachedBlob = (await getCachedImageBlob(cleanName)) || (await getCachedImageBlob(bareName));
    if (cachedBlob) {
      const dataUrl = await blobToDataUrl(cachedBlob);
      memoryDataUrlCache.set(cleanName, dataUrl);
      memoryDataUrlCache.set(bareName, dataUrl);
      return dataUrl;
    }
  } catch (e) {
    console.warn('Error reading from IndexedDB image cache:', e);
  }

  // 3. Fetch from GitHub repository if owner & repo configured
  const { owner, repo, branch, token } = config;
  if (!owner || !repo) return null;
  const cleanBranch = branch || 'main';

  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3.raw',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/images/${cleanName}?ref=${cleanBranch}&_nocache=${Date.now()}`,
      { headers }
    );

    // If not found in subfolder, fallback to legacy root images/
    if (!res.ok && bareName !== cleanName) {
      res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/images/${bareName}?ref=${cleanBranch}&_nocache=${Date.now()}`,
        { headers }
      );
    }

    if (res.ok) {
      let blob: Blob | null = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          const json = await res.json();
          if (json.content && json.encoding === 'base64') {
            const rawBase64 = json.content.replace(/\s/g, '');
            const byteChars = atob(rawBase64);
            const byteNums = new Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
              byteNums[i] = byteChars.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNums);
            const ext = cleanName.split('.').pop()?.toLowerCase() || 'jpeg';
            const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
            blob = new Blob([byteArray], { type: mime });
          }
        } catch {}
      }

      if (!blob) {
        const rawBlob = await res.blob();
        const ext = cleanName.split('.').pop()?.toLowerCase() || 'png';
        const mime =
          ext === 'png'
            ? 'image/png'
            : ext === 'webp'
            ? 'image/webp'
            : ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : rawBlob.type && rawBlob.type.startsWith('image/')
            ? rawBlob.type
            : 'image/png';
        blob = new Blob([await rawBlob.arrayBuffer()], { type: mime });
      }

      // Store in IndexedDB for permanent offline access
      await setCachedImageBlob(cleanName, blob);
      if (bareName !== cleanName) {
        await setCachedImageBlob(bareName, blob).catch(() => {});
      }
      const dataUrl = await blobToDataUrl(blob);
      memoryDataUrlCache.set(cleanName, dataUrl);
      memoryDataUrlCache.set(bareName, dataUrl);
      return dataUrl;
    }
  } catch (err) {
    console.warn(`Failed to fetch image ${cleanName} from GitHub API:`, err);
  }

  // 4. Fallback: try raw.githubusercontent directly and convert to permanent cached blob
  try {
    const rawRes = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/${cleanBranch}/images/${cleanName}`
    );
    if (rawRes.ok) {
      const rawBlob = await rawRes.blob();
      const ext = cleanName.split('.').pop()?.toLowerCase() || 'jpeg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const blob = new Blob([await rawBlob.arrayBuffer()], { type: mime });
      await setCachedImageBlob(cleanName, blob);
      if (bareName !== cleanName) {
        await setCachedImageBlob(bareName, blob).catch(() => {});
      }
      const dataUrl = await blobToDataUrl(blob);
      memoryDataUrlCache.set(cleanName, dataUrl);
      memoryDataUrlCache.set(bareName, dataUrl);
      return dataUrl;
    }
  } catch {}

  // 5. Final fallback to raw.githubusercontent URL
  return `https://raw.githubusercontent.com/${owner}/${repo}/${cleanBranch}/images/${cleanName}`;
}

/**
 * Background worker to fetch missing images (posters, characters, anki extra scenes)
 * for items pulled from GitHub.
 * Resolves images in concurrent batches and informs caller via onImageLoaded.
 */
export async function syncImagesForItems(
  items: ArchiveItem[],
  config: GitHubSyncConfig,
  onImageLoaded: (itemId: string, dataUrl: string, partialItem?: Partial<ArchiveItem>) => void
): Promise<void> {
  if (!config.owner || !config.repo) return;

  const itemsNeedingImages = items.filter((it) => {
    const needsPoster =
      (!it.thumbnail || it.thumbnail.trim() === '' || it.thumbnail.startsWith('blob:') || it.thumbnail.startsWith('images/')) &&
      Boolean(it.thumbnailFileName);
    const needsCharacters =
      Array.isArray(it.characters) &&
      it.characters.some(
        (c) => Boolean(c.image || c.fileName) && (!c.image || c.image.startsWith('images/') || c.image.startsWith('characters/'))
      );
    const needsAnki =
      Array.isArray(it.ankiExtraImages) &&
      it.ankiExtraImages.some(
        (e) => Boolean(e.url || e.fileName) && (!e.url || e.url.startsWith('images/') || e.url.startsWith('anki/'))
      );
    return needsPoster || needsCharacters || needsAnki;
  });

  if (itemsNeedingImages.length === 0) return;

  const CONCURRENCY = 6;
  let index = 0;

  async function worker() {
    while (index < itemsNeedingImages.length) {
      const currentItem = itemsNeedingImages[index++];
      if (!currentItem) continue;

      let changed = false;
      let resolvedPosterUrl = currentItem.thumbnail;

      // 1. Poster / Thumbnail
      if (
        (!currentItem.thumbnail || currentItem.thumbnail.trim() === '' || currentItem.thumbnail.startsWith('blob:') || currentItem.thumbnail.startsWith('images/')) &&
        currentItem.thumbnailFileName
      ) {
        try {
          const url = await resolveGitHubImage(currentItem.thumbnailFileName, config);
          if (url) {
            resolvedPosterUrl = url;
            changed = true;
          }
        } catch (err) {
          console.warn(`Error resolving poster for item ${currentItem.id}:`, err);
        }
      }

      // 2. Characters
      let updatedCharacters = currentItem.characters;
      if (Array.isArray(currentItem.characters) && currentItem.characters.length > 0) {
        const hasUnresolvedChar = currentItem.characters.some(
          (c) => Boolean(c.image || c.fileName) && (!c.image || c.image.startsWith('images/') || c.image.startsWith('characters/'))
        );
        if (hasUnresolvedChar) {
          const resolvedChars = await Promise.all(
            currentItem.characters.map(async (char) => {
              const targetPath = char.fileName || char.image;
              if (targetPath && (!char.image || char.image.startsWith('images/') || char.image.startsWith('characters/'))) {
                try {
                  const url = await resolveGitHubImage(targetPath, config);
                  if (url) {
                    changed = true;
                    return { ...char, image: url };
                  }
                } catch (err) {
                  console.warn(`Error resolving character image for ${char.name}:`, err);
                }
              }
              return char;
            })
          );
          updatedCharacters = resolvedChars;
        }
      }

      // 3. Anki Extra Scene Images
      let updatedAnkiExtra = currentItem.ankiExtraImages;
      if (Array.isArray(currentItem.ankiExtraImages) && currentItem.ankiExtraImages.length > 0) {
        const hasUnresolvedAnki = currentItem.ankiExtraImages.some(
          (e) => Boolean(e.url || e.fileName) && (!e.url || e.url.startsWith('images/') || e.url.startsWith('anki/'))
        );
        if (hasUnresolvedAnki) {
          const resolvedExtras = await Promise.all(
            currentItem.ankiExtraImages.map(async (extra) => {
              const targetPath = extra.fileName || extra.url;
              if (targetPath && (!extra.url || extra.url.startsWith('images/') || extra.url.startsWith('anki/'))) {
                try {
                  const url = await resolveGitHubImage(targetPath, config);
                  if (url) {
                    changed = true;
                    return { ...extra, url };
                  }
                } catch (err) {
                  console.warn(`Error resolving anki extra image:`, err);
                }
              }
              return extra;
            })
          );
          updatedAnkiExtra = resolvedExtras;
        }
      }

      if (changed) {
        onImageLoaded(currentItem.id, resolvedPosterUrl || '', {
          thumbnail: resolvedPosterUrl,
          characters: updatedCharacters,
          ankiExtraImages: updatedAnkiExtra,
        });
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, itemsNeedingImages.length) },
    () => worker()
  );
  await Promise.all(workers);
}

/**
 * Resolves a 400px small poster from IndexedDB image_cache or GitHub.
 * Strict rules per LORE instruction:
 * - Checks exact key 'posters-small/<name>.webp'.
 * - NO bareName fallback.
 * - NO root images/ fallback.
 * - NO raw.githubusercontent fallback.
 * - Returns null on miss/404 without error.
 */
export async function resolveSmallPoster(
  thumbnailFileName: string,
  config: GitHubSyncConfig
): Promise<string | null> {
  if (!thumbnailFileName || thumbnailFileName.trim() === '') return null;
  const smallKey = getCardThumbnailKey(thumbnailFileName);

  // 1. Check in-memory Data URL cache
  if (memoryDataUrlCache.has(smallKey)) {
    return memoryDataUrlCache.get(smallKey)!;
  }

  // 2. Check local IndexedDB cache with exact path key
  try {
    const cachedBlob = await getCachedImageBlob(smallKey);
    if (cachedBlob) {
      let blobToUse = cachedBlob;
      if (!cachedBlob.type || !cachedBlob.type.startsWith('image/')) {
        blobToUse = new Blob([await cachedBlob.arrayBuffer()], { type: 'image/webp' });
      }
      const dataUrl = await blobToDataUrl(blobToUse);
      memoryDataUrlCache.set(smallKey, dataUrl);
      return dataUrl;
    }
  } catch (e) {
    console.warn('Error reading small poster from IndexedDB cache:', e);
  }

  // 3. Fetch from GitHub with exact path
  const { owner, repo, branch, token } = config;
  if (!owner || !repo) return null;
  const cleanBranch = branch || 'main';

  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3.raw',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/images/${smallKey}?ref=${cleanBranch}&_nocache=${Date.now()}`,
      { headers }
    );

    if (res.ok) {
      let blob: Blob | null = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          const json = await res.json();
          if (json.content && json.encoding === 'base64') {
            const rawBase64 = json.content.replace(/\s/g, '');
            const byteChars = atob(rawBase64);
            const byteNums = new Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
              byteNums[i] = byteChars.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNums);
            blob = new Blob([byteArray], { type: 'image/webp' });
          }
        } catch {}
      } else {
        blob = await res.blob();
      }

      if (blob) {
        let finalBlob = blob;
        if (!blob.type || !blob.type.startsWith('image/')) {
          finalBlob = new Blob([await blob.arrayBuffer()], { type: 'image/webp' });
        }
        const dataUrl = await blobToDataUrl(finalBlob);
        await setCachedImageBlob(smallKey, finalBlob);
        memoryDataUrlCache.set(smallKey, dataUrl);
        return dataUrl;
      }
    }
  } catch {
    // 404 or network error silently tolerated
  }

  return null;
}

/**
 * Background worker to download missing small posters for mobile grid cards.
 * Fetches small copies concurrently and batches updates into a Map to minimize setAppData calls (at most 2-3 re-renders).
 */
export async function syncCardThumbnailsForItems(
  items: ArchiveItem[],
  config: GitHubSyncConfig,
  onBatchLoaded: (updates: Map<string, string>) => void
): Promise<void> {
  if (!config.owner || !config.repo) return;

  const itemsNeedingSmall = items.filter(
    (it) => (!it.cardThumbnail || it.cardThumbnail.trim() === '') && Boolean(it.thumbnailFileName)
  );

  if (itemsNeedingSmall.length === 0) return;

  const CONCURRENCY = 6;
  let index = 0;
  const pendingUpdates = new Map<string, string>();
  const FLUSH_INTERVAL = 35;

  async function worker() {
    while (index < itemsNeedingSmall.length) {
      const currentItem = itemsNeedingSmall[index++];
      if (!currentItem || !currentItem.thumbnailFileName) continue;

      try {
        const url = await resolveSmallPoster(currentItem.thumbnailFileName, config);
        if (url) {
          pendingUpdates.set(currentItem.id, url);
          if (pendingUpdates.size >= FLUSH_INTERVAL) {
            const batch = new Map(pendingUpdates);
            pendingUpdates.clear();
            onBatchLoaded(batch);
          }
        }
      } catch {
        // Silently tolerate
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, itemsNeedingSmall.length) },
    () => worker()
  );
  await Promise.all(workers);

  if (pendingUpdates.size > 0) {
    const finalBatch = new Map(pendingUpdates);
    pendingUpdates.clear();
    onBatchLoaded(finalBatch);
  }
}

/**
 * Hydrates badges directly from local IndexedDB image cache for offline and instant startup rendering.
 */
export async function hydrateBadgesFromCache(badges: CustomBadge[]): Promise<CustomBadge[]> {
  if (!Array.isArray(badges) || badges.length === 0) return badges;
  return Promise.all(
    badges.map(async (badge) => {
      if (badge.iconData && (badge.iconData.startsWith('images/') || badge.iconData.startsWith('badges/'))) {
        const cleanName = badge.iconData.replace(/^images\//, '');
        const bareName = cleanName.split('/').pop() || cleanName;
        try {
          const cachedBlob = (await getCachedImageBlob(cleanName)) || (await getCachedImageBlob(bareName));
          if (cachedBlob) {
            let blobToUse = cachedBlob;
            if (!cachedBlob.type || !cachedBlob.type.startsWith('image/')) {
              const ext = cleanName.split('.').pop()?.toLowerCase() || 'webp';
              const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
              blobToUse = new Blob([await cachedBlob.arrayBuffer()], { type: mime });
            }
            const dataUrl = await blobToDataUrl(blobToUse);
            return { ...badge, iconData: dataUrl };
          }
        } catch {}
      }
      return badge;
    })
  );
}

/**
 * Background worker to fetch missing badge images from GitHub and cache them in IndexedDB.
 */
export async function syncBadgesFromGitHub(
  badges: CustomBadge[],
  config: GitHubSyncConfig,
  onBadgeLoaded: (badgeId: string, dataUrl: string) => void
): Promise<void> {
  if (!config.owner || !config.repo || !Array.isArray(badges) || badges.length === 0) return;

  for (const badge of badges) {
    if (badge.iconData && (badge.iconData.startsWith('data:image/') || badge.iconData.startsWith('blob:'))) {
      continue;
    }

    const targetPath =
      badge.fileName ||
      (badge.iconData && (badge.iconData.startsWith('images/') || badge.iconData.startsWith('badges/'))
        ? badge.iconData
        : null);
    if (targetPath) {
      try {
        const url = await resolveGitHubImage(targetPath, config);
        if (url) {
          onBadgeLoaded(badge.id, url);
        }
      } catch (err) {
        console.warn(`Error resolving badge image for ${badge.id}:`, err);
      }
    }
  }
}

