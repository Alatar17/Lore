import { AppData, ArchiveItem } from '../types';
import { getCachedImageBlob, setCachedImageBlob } from './fileSystem';

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
  // Keep thumbnailFileName and ankiExtraImages.fileName; drop inline heavy base64 strings so JSON stays tiny (1-2 MB)
  const cleanItems: ArchiveItem[] = (appData.items || []).map((item) => {
    const copy = { ...item };
    if (copy.thumbnailFileName && copy.thumbnail?.startsWith('data:image/')) {
      delete copy.thumbnail;
    }
    if (copy.ankiExtraImages && copy.ankiExtraImages.length > 0) {
      copy.ankiExtraImages = copy.ankiExtraImages.map((extra, idx) => {
        const extraCopy = { ...extra };
        const fileName = extraCopy.fileName || `images/${copy.id}_extra_${idx}.jpg`;
        extraCopy.fileName = fileName;
        if (extraCopy.url && extraCopy.url.startsWith('data:image/')) {
          extraCopy.url = fileName;
        }
        return extraCopy;
      });
    }
    return copy;
  });

  // 3. Incrementally upload missing local images to GitHub images/ directory
  let uploadedImagesCount = 0;
  if (dirHandle) {
    try {
      let imagesDir: FileSystemDirectoryHandle | null = null;
      try {
        imagesDir = await dirHandle.getDirectoryHandle('images', { create: false });
      } catch {
        imagesDir = null;
      }

      if (imagesDir) {
        // Collect all image filenames referenced by active items (both thumbnails and ankiExtraImages)
        const neededImageNames = new Set<string>();
        for (const item of cleanItems) {
          if (item.thumbnailFileName) {
            neededImageNames.add(item.thumbnailFileName.replace(/^images\//, ''));
          }
          if (item.ankiExtraImages && Array.isArray(item.ankiExtraImages)) {
            for (const extra of item.ankiExtraImages) {
              if (extra.fileName) {
                neededImageNames.add(extra.fileName.replace(/^images\//, ''));
              }
            }
          }
        }

        if (neededImageNames.size > 0) {
          // Check what images already exist on GitHub
          const existingOnGh = new Set<string>();
          try {
            const listRes = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/contents/images?ref=${cleanBranch}&_nocache=${Date.now()}`,
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
                  if (f.name) existingOnGh.add(f.name);
                }
              }
            }
          } catch (e) {
            console.warn('Could not list GitHub images directory:', e);
          }

          // Upload missing images only
          for (const imgName of neededImageNames) {
            if (existingOnGh.has(imgName)) continue;
            try {
              const fileHandle = await imagesDir.getFileHandle(imgName);
              const file = await fileHandle.getFile();
              const base64 = await blobToBase64Raw(file);
              const uploadRes = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/contents/images/${imgName}`,
                {
                  method: 'PUT',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    message: `Afiş Yükle: ${imgName} [skip ci]`,
                    content: base64,
                    branch: cleanBranch,
                  }),
                }
              );
              if (uploadRes.ok) {
                uploadedImagesCount++;
              }
            } catch (err) {
              console.warn(`Could not upload image ${imgName} to GitHub:`, err);
            }
          }
        }
      }
    } catch (imgSyncErr) {
      console.warn('Image push to GitHub had warnings:', imgSyncErr);
    }
  }

  const nowIso = new Date().toISOString();
  const payloadData: AppData = {
    ...appData,
    lastUpdated: nowIso,
    items: cleanItems,
  };

  const jsonString = JSON.stringify(payloadData, null, 2);
  const base64Content = toBase64Utf8(jsonString);

  const commitMessage = `Lore Arşivi Güncellemesi (${cleanItems.length} yapım${
    uploadedImagesCount > 0 ? `, ${uploadedImagesCount} yeni afiş` : ''
  }) - ${new Date().toLocaleDateString('tr-TR')} [skip ci]`;

  // 4. PUT content to GitHub Contents API
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
        sha: existingSha,
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

/**
 * Resolves an image filename from GitHub or IndexedDB cache.
 * Returns a permanent base64 Data URL (data:image/...) identical to ZIP import.
 */
export async function resolveGitHubImage(
  fileName: string,
  config: GitHubSyncConfig
): Promise<string | null> {
  const cleanName = fileName.replace(/^images\//, '');
  if (!cleanName) return null;

  // 1. Check in-memory Data URL cache
  if (memoryDataUrlCache.has(cleanName)) {
    return memoryDataUrlCache.get(cleanName)!;
  }

  // 2. Check local IndexedDB cache
  try {
    const cachedBlob = await getCachedImageBlob(cleanName);
    if (cachedBlob) {
      const dataUrl = await blobToDataUrl(cachedBlob);
      memoryDataUrlCache.set(cleanName, dataUrl);
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

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/images/${cleanName}?ref=${cleanBranch}`,
      { headers }
    );

    if (res.ok) {
      const blob = await res.blob();
      // Store in IndexedDB for permanent offline access
      await setCachedImageBlob(cleanName, blob);
      const dataUrl = await blobToDataUrl(blob);
      memoryDataUrlCache.set(cleanName, dataUrl);
      return dataUrl;
    }
  } catch (err) {
    console.warn(`Failed to fetch image ${cleanName} from GitHub:`, err);
  }

  // 4. Fallback to raw.githubusercontent URL (useful for public repositories)
  return `https://raw.githubusercontent.com/${owner}/${repo}/${cleanBranch}/images/${cleanName}`;
}

/**
 * Background worker to fetch missing images for items pulled from GitHub.
 * Resolves images in concurrent batches and informs caller via onImageLoaded.
 */
export async function syncImagesForItems(
  items: ArchiveItem[],
  config: GitHubSyncConfig,
  onImageLoaded: (itemId: string, dataUrl: string) => void
): Promise<void> {
  if (!config.owner || !config.repo) return;

  const itemsNeedingImages = items.filter(
    (it) => (!it.thumbnail || it.thumbnail.trim() === '' || it.thumbnail.startsWith('blob:')) && it.thumbnailFileName
  );

  if (itemsNeedingImages.length === 0) return;

  const CONCURRENCY = 6;
  let index = 0;

  async function worker() {
    while (index < itemsNeedingImages.length) {
      const currentItem = itemsNeedingImages[index++];
      if (!currentItem || !currentItem.thumbnailFileName) continue;
      try {
        const url = await resolveGitHubImage(currentItem.thumbnailFileName, config);
        if (url) {
          onImageLoaded(currentItem.id, url);
        }
      } catch (err) {
        console.warn(`Error resolving image for item ${currentItem.id}:`, err);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, itemsNeedingImages.length) },
    () => worker()
  );
  await Promise.all(workers);
}

