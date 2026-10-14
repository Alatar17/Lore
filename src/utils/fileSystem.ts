import { AppData, ArchiveItem, Category, MainTabType, TierListCategoryExportData, CustomBadge } from '../types';
import { INITIAL_DATA } from '../data/initialData';
import JSZip from 'jszip';
import { renderTierListToPngBlob } from './tierImageExport';
import { ensureAnkiCardDates } from './ankiUtils';
import { loadRecommendationMemory, saveRecommendationMemory } from './recommendationMemory';

// Helper to get formatted date string for export files (e.g., 2026-08-24_11-50 or 2026-08-24)
export function getFormattedDateForFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}_${hours}-${mins}`;
}

// Format sanitized category name for filenames
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]+/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

const LOCAL_STORAGE_KEY = 'yapim_arsivim_app_data_v4';
const DB_NAME = 'YapimArsivimDB';
const DB_STORE = 'fs_handles';
const APP_DATA_STORE = 'app_data_store';
const HANDLE_KEY = 'root_dir_handle';
const APP_DATA_KEY = 'current_app_data';
const DATA_FILE_NAME = 'yapim-arsivim-data.json';
const IMAGE_CACHE_STORE = 'image_cache';

// --- IndexedDB Helper ---
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3);
    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
      if (!db.objectStoreNames.contains(APP_DATA_STORE)) {
        db.createObjectStore(APP_DATA_STORE);
      }
      if (!db.objectStoreNames.contains(IMAGE_CACHE_STORE)) {
        db.createObjectStore(IMAGE_CACHE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedImageBlob(fileName: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IMAGE_CACHE_STORE, 'readonly');
      const store = tx.objectStore(IMAGE_CACHE_STORE);
      const req = store.get(fileName);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setCachedImageBlob(fileName: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(IMAGE_CACHE_STORE, 'readwrite');
    const store = tx.objectStore(IMAGE_CACHE_STORE);
    store.put(blob, fileName);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch (err) {
    console.warn('Failed to cache image in IndexedDB:', err);
  }
}

export async function deleteCachedImageBlob(fileName: string): Promise<void> {
  try {
    const cleanName = fileName.replace(/^images\//, '');
    const db = await openDB();
    const tx = db.transaction(IMAGE_CACHE_STORE, 'readwrite');
    const store = tx.objectStore(IMAGE_CACHE_STORE);
    store.delete(cleanName);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch (err) {
    console.warn('Failed to delete cached image from IndexedDB:', err);
  }
}

/**
 * Hydrates items with missing thumbnail Data URLs directly from local IndexedDB image cache.
 * Ensures instant, offline poster restoration on app startup without network or user interaction.
 */
export async function hydrateThumbnailsFromCache(items: ArchiveItem[]): Promise<ArchiveItem[]> {
  if (!Array.isArray(items) || items.length === 0) return items;

  const itemsNeedingCache = items.filter(
    (it) => (!it.thumbnail || it.thumbnail.trim() === '' || it.thumbnail.startsWith('blob:')) && it.thumbnailFileName
  );

  if (itemsNeedingCache.length === 0) return items;

  const resolvedMap = new Map<string, string>();
  await Promise.all(
    itemsNeedingCache.map(async (item) => {
      if (!item.thumbnailFileName) return;
      const cleanName = item.thumbnailFileName.replace(/^images\//, '');
      try {
        let cachedBlob = await getCachedImageBlob(cleanName);
        if (!cachedBlob && cleanName.includes('/')) {
          cachedBlob = await getCachedImageBlob(cleanName.split('/').pop()!);
        }
        if (cachedBlob) {
          const dataUrl = await readFileAsBase64(new File([cachedBlob], cleanName, { type: cachedBlob.type || 'image/jpeg' }));
          if (dataUrl) {
            resolvedMap.set(item.id, dataUrl);
          }
        }
      } catch (err) {
        // Ignore individual cache lookup errors
      }
    })
  );

  if (resolvedMap.size === 0) return items;

  return items.map((it) => {
    const cachedUrl = resolvedMap.get(it.id);
    return cachedUrl ? { ...it, thumbnail: cachedUrl } : it;
  });
}

export async function getStoredDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const store = tx.objectStore(DB_STORE);
      const req = store.get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('Could not read stored directory handle:', err);
    return null;
  }
}

export async function storeDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    store.put(handle, HANDLE_KEY);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch (err) {
    console.warn('Could not store directory handle:', err);
  }
}

export async function clearStoredDirectoryHandle(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    store.delete(HANDLE_KEY);
  } catch (err) {
    console.warn('Could not clear directory handle:', err);
  }
}

// --- IndexedDB Full App Data Storage (Gigabytes Capacity) ---
export async function loadDataFromIndexedDB(): Promise<AppData | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(APP_DATA_STORE, 'readonly');
      const store = tx.objectStore(APP_DATA_STORE);
      const req = store.get(APP_DATA_KEY);
      req.onsuccess = () => {
        if (req.result && req.result.categories && req.result.items) {
          const res = req.result as AppData;
          if (!Array.isArray(res.categories.book)) res.categories.book = [];
          if (!Array.isArray(res.categories.media)) res.categories.media = [];
          if (!Array.isArray(res.categories.game)) res.categories.game = [];
          if (Array.isArray(res.items)) {
            res.items = res.items.map((it) => ({
              ...it,
              ankiCard: it.ankiCard ? ensureAnkiCardDates(it.ankiCard) : undefined,
            }));
          }
          resolve(res);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('IndexedDB read error:', err);
    return null;
  }
}

export async function saveDataToIndexedDB(data: AppData): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(APP_DATA_STORE, 'readwrite');
    const store = tx.objectStore(APP_DATA_STORE);
    store.put(data, APP_DATA_KEY);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch (err) {
    console.warn('IndexedDB write error:', err);
  }
}

// Check permission
export async function verifyPermission(
  fileHandle: FileSystemDirectoryHandle,
  readWrite: boolean = true
): Promise<boolean> {
  const handle = fileHandle as any;
  const options = {
    mode: readWrite ? 'readwrite' : 'read',
  };
  try {
    if (typeof handle.queryPermission === 'function') {
      if ((await handle.queryPermission(options)) === 'granted') {
        return true;
      }
    }
    if (typeof handle.requestPermission === 'function') {
      if ((await handle.requestPermission(options)) === 'granted') {
        return true;
      }
    }
  } catch (err) {
    console.warn('Permission query/request error:', err);
  }
  return false;
}

/**
 * Checks if the directory handle is still valid, accessible, and exists on disk.
 * Returns true if valid, false if folder was renamed, moved, deleted, or permission revoked.
 */
export async function checkDirectoryHandleAccessibility(
  handle: FileSystemDirectoryHandle | null
): Promise<boolean> {
  if (!handle) return false;
  try {
    // 1. Check permission
    const hasPerm = await verifyPermission(handle, false);
    if (!hasPerm) return false;

    // 2. Test lightweight directory operation to verify folder actually exists on disk
    if (typeof (handle as any).values === 'function') {
      const iterator = (handle as any).values();
      await iterator.next();
    } else if (typeof (handle as any).keys === 'function') {
      const iterator = (handle as any).keys();
      await iterator.next();
    } else {
      try {
        await handle.getFileHandle(DATA_FILE_NAME, { create: false });
      } catch (err: any) {
        if (err.name === 'NotFoundError') {
          return true;
        }
        throw err;
      }
    }
    return true;
  } catch (err: any) {
    console.warn('Directory handle is no longer valid/accessible:', err);
    return false;
  }
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// --- Load / Save Data from File System with Categorized Images ---

/**
 * Safely resolves or creates a subpath file handle inside a directory handle.
 * Works with paths containing slashes, e.g. "posters/item_123.jpg" or "item_123.jpg".
 */
export async function getFileHandleFromRelativePath(
  baseDir: FileSystemDirectoryHandle,
  relPath: string,
  create = false
): Promise<FileSystemFileHandle> {
  const cleanPath = relPath.replace(/^images\//i, '').trim();
  const parts = cleanPath.split('/').filter(Boolean);
  if (parts.length === 0) {
    throw new Error('Geçersiz dosya yolu');
  }
  let currentDir = baseDir;
  for (let i = 0; i < parts.length - 1; i++) {
    currentDir = await currentDir.getDirectoryHandle(parts[i], { create });
  }
  return await currentDir.getFileHandle(parts[parts.length - 1], { create });
}

/**
 * Robustly reads an image file from the images/ directory.
 * Searches:
 * 1. Exact relative path (e.g. posters/item_1.jpg or item_1.jpg)
 * 2. Inside the category subfolder if path was just a plain filename (e.g. posters/item_1.jpg)
 * 3. In the root images/ folder if path had a subcategory prefix but is stored in root (legacy backup)
 */
export async function readFileFromImagesDir(
  imagesDir: FileSystemDirectoryHandle,
  relPath: string,
  fallbackCategory?: 'posters' | 'characters' | 'anki' | 'badges'
): Promise<File | null> {
  if (!relPath) return null;
  const clean = relPath.replace(/^images\//i, '').trim();
  if (!clean) return null;

  // 1. Try exact relative path
  try {
    const handle = await getFileHandleFromRelativePath(imagesDir, clean, false);
    return await handle.getFile();
  } catch {}

  // 2. If it was a plain filename without slashes (e.g. item_123.jpg), check in fallbackCategory
  if (!clean.includes('/') && fallbackCategory) {
    try {
      const subDir = await imagesDir.getDirectoryHandle(fallbackCategory, { create: false });
      const handle = await subDir.getFileHandle(clean, { create: false });
      return await handle.getFile();
    } catch {}
  }

  // 3. If clean had a subcategory prefix (e.g. posters/item_123.jpg), also try root imagesDir (legacy)
  if (clean.includes('/')) {
    const baseName = clean.split('/').pop();
    if (baseName) {
      try {
        const handle = await imagesDir.getFileHandle(baseName, { create: false });
        return await handle.getFile();
      } catch {}
    }
  }

  return null;
}

export async function readDataFromFolder(dirHandle: FileSystemDirectoryHandle): Promise<AppData | null> {
  try {
    const fileHandle = await dirHandle.getFileHandle(DATA_FILE_NAME, { create: false });
    const file = await fileHandle.getFile();
    const text = await file.text();
    const json = JSON.parse(text) as AppData;

    let imagesDir: FileSystemDirectoryHandle | null = null;
    try {
      imagesDir = await dirHandle.getDirectoryHandle('images', { create: false });
    } catch {
      imagesDir = null;
    }

    if (imagesDir && json.items) {
      for (const item of json.items) {
        // 1. Restore Poster (Thumbnail)
        if (!item.thumbnail && item.thumbnailFileName) {
          try {
            const imgFile = await readFileFromImagesDir(imagesDir, item.thumbnailFileName, 'posters');
            if (imgFile) {
              const base64 = await readFileAsBase64(imgFile);
              item.thumbnail = base64;
              const cleanCacheKey = item.thumbnailFileName.replace(/^images\//, '');
              setCachedImageBlob(cleanCacheKey, imgFile);
            }
          } catch {
            // Ignore missing images
          }
        }

        // 2. Restore Characters from images/characters/ (or legacy base64)
        if (item.characters && Array.isArray(item.characters)) {
          for (const char of item.characters) {
            const targetPath = char.fileName || (char.image && char.image.startsWith('images/') ? char.image : null);
            if (targetPath && (!char.image || char.image.startsWith('images/'))) {
              try {
                const charFile = await readFileFromImagesDir(imagesDir, targetPath, 'characters');
                if (charFile) {
                  const base64 = await readFileAsBase64(charFile);
                  char.image = base64;
                  char.fileName = targetPath;
                }
              } catch {}
            }
          }
        }

        // 3. Restore ankiExtraImages from images/anki/ (or legacy images/)
        if (item.ankiExtraImages && Array.isArray(item.ankiExtraImages)) {
          for (let idx = 0; idx < item.ankiExtraImages.length; idx++) {
            const extra = item.ankiExtraImages[idx];
            const targetFileName = extra.fileName
              ? extra.fileName
              : extra.url && extra.url.startsWith('images/')
              ? extra.url
              : null;
            if (targetFileName && (!extra.url || extra.url.startsWith('images/'))) {
              try {
                const imgFile = await readFileFromImagesDir(imagesDir, targetFileName, 'anki');
                if (imgFile) {
                  const base64 = await readFileAsBase64(imgFile);
                  extra.url = base64;
                }
              } catch {
                // Ignore missing extra image
              }
            }
          }
        }
      }
    }

    // 4. Restore Custom Badges from images/badges/ (with automatic migration for embedded data: URLs)
    if (json.customBadges && Array.isArray(json.customBadges)) {
      for (const badge of json.customBadges) {
        let targetPath = badge.fileName || (badge.iconData && !badge.iconData.startsWith('data:') ? badge.iconData : null);
        if (!targetPath) {
          targetPath = `images/badges/badge_${badge.id}.webp`;
          badge.fileName = targetPath;
        }

        if (imagesDir) {
          // If badge still has bulky data: URL embedded in JSON, extract it to disk once
          if (badge.iconData && badge.iconData.startsWith('data:')) {
            try {
              let existingFile = await readFileFromImagesDir(imagesDir, targetPath, 'badges');
              if (!existingFile) {
                const badgesDir = await imagesDir.getDirectoryHandle('badges', { create: true });
                const imgName = targetPath.split('/').pop() || `badge_${badge.id}.webp`;
                const blob = dataURLtoBlob(badge.iconData);
                const handle = await badgesDir.getFileHandle(imgName, { create: true });
                const writable = await (handle as any).createWritable();
                await writable.write(blob);
                await writable.close();
                existingFile = await handle.getFile();
              }
              if (existingFile) {
                badge.iconData = await readFileAsBase64(existingFile);
                badge.fileName = targetPath;
              }
            } catch (migErr) {
              console.warn('Badge data URL migration warning:', migErr);
            }
          } else if (targetPath && (!badge.iconData || badge.iconData.startsWith('images/') || badge.iconData.startsWith('badges/'))) {
            try {
              const badgeFile = await readFileFromImagesDir(imagesDir, targetPath, 'badges');
              if (badgeFile) {
                const base64 = await readFileAsBase64(badgeFile);
                badge.iconData = base64;
                badge.fileName = targetPath;
              }
            } catch {}
          }
        }
      }
      safeLocalStorageSet('lore_custom_badges', JSON.stringify(json.customBadges));
    }

    if (json && json.categories) {
      if (!Array.isArray(json.categories.book)) json.categories.book = [];
      if (!Array.isArray(json.categories.media)) json.categories.media = [];
      if (!Array.isArray(json.categories.game)) json.categories.game = [];
    }

    if (json && Array.isArray(json.items)) {
      json.items = json.items.map((it) => ({
        ...it,
        ankiCard: it.ankiCard ? ensureAnkiCardDates(it.ankiCard) : undefined,
      }));
    }

    // Restore recommendation memory if stored in folder
    if (json && Array.isArray(json.recommendationMemory) && json.recommendationMemory.length > 0) {
      saveRecommendationMemory(json.recommendationMemory);
    }

    return json;
  } catch (err: any) {
    if (err.name === 'NotFoundError') {
      return null;
    }
    console.error('Error reading data from folder:', err);
    throw err;
  }
}

export async function writeDataToFolder(dirHandle: FileSystemDirectoryHandle, data: AppData): Promise<void> {
  try {
    // 1. Ensure images folder and its 4 subdirectories exist
    let imagesDir: FileSystemDirectoryHandle | null = null;
    let postersDir: FileSystemDirectoryHandle | null = null;
    let charactersDir: FileSystemDirectoryHandle | null = null;
    let ankiDir: FileSystemDirectoryHandle | null = null;
    let badgesDir: FileSystemDirectoryHandle | null = null;

    try {
      imagesDir = await dirHandle.getDirectoryHandle('images', { create: true });
      postersDir = await imagesDir.getDirectoryHandle('posters', { create: true });
      charactersDir = await imagesDir.getDirectoryHandle('characters', { create: true });
      ankiDir = await imagesDir.getDirectoryHandle('anki', { create: true });
      badgesDir = await imagesDir.getDirectoryHandle('badges', { create: true });
    } catch (e) {
      console.warn('Could not create images subdirectories:', e);
    }

    const cleanItems: ArchiveItem[] = [];

    for (const item of data.items) {
      const itemCopy = { ...item };

      // 1. Posters (Thumbnail) -> images/posters/
      if (item.thumbnail && item.thumbnail.startsWith('data:') && postersDir) {
        try {
          const mimeMatch = item.thumbnail.match(/data:(?:image\/)?([a-zA-Z0-9]+);/);
          let ext = mimeMatch ? (mimeMatch[1] === 'jpeg' ? 'jpg' : mimeMatch[1]) : 'jpg';
          if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) ext = 'jpg';

          const existingCleanName = item.thumbnailFileName
            ? item.thumbnailFileName.split('/').pop()!
            : '';
          const imgName = existingCleanName || `${item.id}_${Date.now()}.${ext}`;
          const blob = dataURLtoBlob(item.thumbnail);

          const imgHandle = await postersDir.getFileHandle(imgName, { create: true });
          const imgWritable = await (imgHandle as any).createWritable();
          await imgWritable.write(blob);
          await imgWritable.close();

          itemCopy.thumbnailFileName = `images/posters/${imgName}`;
        } catch (imgErr) {
          console.warn(`Could not write poster for ${item.id}:`, imgErr);
        }
      } else if (item.thumbnailFileName && !item.thumbnailFileName.includes('/posters/')) {
        const cleanOld = item.thumbnailFileName.replace(/^images\//i, '');
        if (imagesDir && postersDir) {
          try {
            const oldHandle = await imagesDir.getFileHandle(cleanOld, { create: false });
            const oldFile = await oldHandle.getFile();
            const newHandle = await postersDir.getFileHandle(cleanOld, { create: true });
            const writable = await newHandle.createWritable();
            await writable.write(await oldFile.arrayBuffer());
            await writable.close();
            try {
              await (imagesDir as any).removeEntry(cleanOld);
            } catch {}
          } catch {}
        }
        itemCopy.thumbnailFileName = `images/posters/${cleanOld}`;
      }

      // Strip bulky base64 thumbnail from written JSON so disk JSON file is only ~150 KB!
      if (itemCopy.thumbnailFileName || (itemCopy.thumbnail && itemCopy.thumbnail.startsWith('data:'))) {
        delete itemCopy.thumbnail;
      }

      // 2. Characters -> images/characters/ (Extract from Base64 so JSON stays lightweight)
      if (item.characters && Array.isArray(item.characters) && item.characters.length > 0) {
        const cleanChars = [];
        for (let idx = 0; idx < item.characters.length; idx++) {
          const char = item.characters[idx];
          const charCopy = { ...char };
          const existingCleanName = char.fileName ? char.fileName.split('/').pop()! : '';

          if (char.image && char.image.startsWith('data:') && charactersDir) {
            try {
              const mimeMatch = char.image.match(/data:(?:image\/)?([a-zA-Z0-9]+);/);
              let ext = mimeMatch ? (mimeMatch[1] === 'jpeg' ? 'jpg' : mimeMatch[1]) : 'jpg';
              if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) ext = 'jpg';
              const charImgName = existingCleanName || `${item.id}_char_${idx}.${ext}`;
              const blob = dataURLtoBlob(char.image);

              const imgHandle = await charactersDir.getFileHandle(charImgName, { create: true });
              const imgWritable = await (imgHandle as any).createWritable();
              await imgWritable.write(blob);
              await imgWritable.close();

              charCopy.fileName = `images/characters/${charImgName}`;
              charCopy.image = `images/characters/${charImgName}`;
            } catch (charErr) {
              console.warn(`Could not write character image for ${item.id}:`, charErr);
            }
          }
          // GUARANTEE: In the saved JSON, image MUST NOT remain a bulky data URL
          if (charCopy.image && charCopy.image.startsWith('data:')) {
            charCopy.image = charCopy.fileName || `images/characters/${item.id}_char_${idx}.jpg`;
          }
          cleanChars.push(charCopy);
        }
        itemCopy.characters = cleanChars;
      }

      // 3. Anki extra images -> images/anki/
      const cleanExtras = [];
      const activeItemAnkiFiles = new Set<string>();

      if (item.ankiExtraImages && Array.isArray(item.ankiExtraImages) && item.ankiExtraImages.length > 0) {
        for (let idx = 0; idx < item.ankiExtraImages.length; idx++) {
          const extra = item.ankiExtraImages[idx];
          const extraCopy = { ...extra };

          // Determine existing clean file name if already saved before
          let existingCleanName = '';
          if (extra.fileName) {
            existingCleanName = extra.fileName.split('/').pop()!;
          } else if (extra.url && extra.url.startsWith('images/')) {
            existingCleanName = extra.url.split('/').pop()!;
          }

          if (extra.url && extra.url.startsWith('data:') && ankiDir) {
            try {
              const mimeMatch = extra.url.match(/data:(?:image\/)?([a-zA-Z0-9]+);/);
              let ext = mimeMatch ? (mimeMatch[1] === 'jpeg' ? 'jpg' : mimeMatch[1]) : 'jpg';
              if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) ext = 'jpg';
              // Use unique extra.id for persistent naming instead of volatile array index
              const safeExtraId = extra.id ? sanitizeFilename(extra.id.replace(/^img_/, '')) : `${Date.now()}_${idx}`;
              const extraImgName = existingCleanName || `${item.id}_extra_${safeExtraId}.${ext}`;
              const blob = dataURLtoBlob(extra.url);

              const imgHandle = await ankiDir.getFileHandle(extraImgName, { create: true });
              const imgWritable = await (imgHandle as any).createWritable();
              await imgWritable.write(blob);
              await imgWritable.close();

              extraCopy.fileName = `images/anki/${extraImgName}`;
              extraCopy.url = `images/anki/${extraImgName}`;
              activeItemAnkiFiles.add(extraImgName);
            } catch (extraErr) {
              console.warn(`Could not write extra image ${idx} for ${item.id}:`, extraErr);
            }
          } else if (existingCleanName) {
            activeItemAnkiFiles.add(existingCleanName);
          }

          // GUARANTEE: In the saved JSON, url MUST NOT remain a bulky data URL
          if (extraCopy.url && extraCopy.url.startsWith('data:')) {
            extraCopy.url = extraCopy.fileName || `images/anki/${item.id}_extra_${idx}.jpg`;
          }

          cleanExtras.push(extraCopy);
        }
        itemCopy.ankiExtraImages = cleanExtras;
      } else {
        itemCopy.ankiExtraImages = [];
      }

      // Safe Auto-Cleanup for this item's removed Anki extra scenes:
      // If user removed any extra image and clicked Save, delete only those orphaned files for THIS item
      if (ankiDir && (ankiDir as any).values) {
        try {
          for await (const entry of (ankiDir as any).values()) {
            if (entry.kind === 'file' && entry.name.startsWith(`${item.id}_`)) {
              if (!activeItemAnkiFiles.has(entry.name)) {
                try {
                  await (ankiDir as any).removeEntry(entry.name);
                  deleteCachedImageBlob(entry.name).catch(() => {});
                } catch {}
              }
            }
          }
        } catch {}
      }

      cleanItems.push(itemCopy);
    }

    // 4. Custom Badges -> images/badges/
    let cleanBadges = data.customBadges;
    if (!cleanBadges) {
      try {
        const raw = safeLocalStorageGet('lore_custom_badges');
        if (raw) cleanBadges = JSON.parse(raw);
      } catch {}
    }

    if (cleanBadges && Array.isArray(cleanBadges) && cleanBadges.length > 0) {
      const updatedBadges = [];
      for (const badge of cleanBadges) {
        const badgeCopy = { ...badge };
        let existingCleanName = badgeCopy.fileName ? badgeCopy.fileName.split('/').pop()! : '';
        let badgeImgName = existingCleanName || `badge_${badge.id}.webp`;

        if (badge.iconData && badge.iconData.startsWith('data:')) {
          try {
            const mimeMatch = badge.iconData.match(/data:(?:image\/)?([a-zA-Z0-9]+);/);
            let ext = mimeMatch ? (mimeMatch[1] === 'jpeg' ? 'jpg' : mimeMatch[1]) : 'webp';
            if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
              ext = existingCleanName ? existingCleanName.split('.').pop() || 'webp' : 'webp';
            }
            if (!existingCleanName) {
              badgeImgName = `badge_${badge.id}.${ext}`;
            }

            if (badgesDir) {
              const blob = dataURLtoBlob(badge.iconData);
              const imgHandle = await badgesDir.getFileHandle(badgeImgName, { create: true });
              const imgWritable = await (imgHandle as any).createWritable();
              await imgWritable.write(blob);
              await imgWritable.close();
            }
          } catch (bErr) {
            console.warn(`Could not write badge icon for ${badge.id}:`, bErr);
          }
        }

        // ABSOLUTE PROTECTION: In the saved JSON, iconData MUST ALWAYS be a path reference, NEVER a data URL!
        badgeCopy.fileName = `images/badges/${badgeImgName}`;
        badgeCopy.iconData = `images/badges/${badgeImgName}`;
        updatedBadges.push(badgeCopy);
      }
      cleanBadges = updatedBadges;
    }

    // 5. Write the JSON file
    const fileHandle = await dirHandle.getFileHandle(DATA_FILE_NAME, { create: true });
    const writable = await (fileHandle as any).createWritable();
    const dataToWrite: AppData = {
      ...data,
      items: cleanItems,
      customBadges: cleanBadges,
      recommendationMemory: data.recommendationMemory || loadRecommendationMemory(),
    };
    await writable.write(JSON.stringify(dataToWrite, null, 2));
    await writable.close();
  } catch (err) {
    console.error('Error writing data to folder:', err);
    throw err;
  }
}

export async function saveImageToFolder(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  blob: Blob
): Promise<string> {
  try {
    const imagesDir = await dirHandle.getDirectoryHandle('images', { create: true });
    const fileHandle = await getFileHandleFromRelativePath(imagesDir, fileName, true);
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return fileName.startsWith('images/') ? fileName : `images/${fileName}`;
  } catch (err) {
    console.error('Error saving image to folder:', err);
    throw err;
  }
}

/**
 * Scans the local `images/` directory and its 4 subdirectories (posters, characters, anki, badges)
 * in the connected folder and deletes any image file that does not belong to any active item or badge.
 * Returns the count and names of cleaned files.
 */
export async function cleanOrphanImagesInFolder(
  dirHandle: FileSystemDirectoryHandle,
  items: ArchiveItem[],
  customBadges?: CustomBadge[]
): Promise<{ cleanedCount: number; deletedFiles: string[] }> {
  try {
    let imagesDir: FileSystemDirectoryHandle | null = null;
    try {
      imagesDir = await dirHandle.getDirectoryHandle('images', { create: false });
    } catch {
      return { cleanedCount: 0, deletedFiles: [] };
    }

    if (!imagesDir) return { cleanedCount: 0, deletedFiles: [] };

    // Active file name sets for each subfolder
    const activePosters = new Set<string>();
    const activeCharacters = new Set<string>();
    const activeAnki = new Set<string>();
    const activeBadges = new Set<string>();
    const allActiveBaseNames = new Set<string>();

    for (const item of items) {
      if (item.thumbnailFileName) {
        const name = item.thumbnailFileName.split('/').pop()!;
        activePosters.add(name);
        allActiveBaseNames.add(name);
      }
      allActiveBaseNames.add(`${item.id}.jpg`);
      allActiveBaseNames.add(`${item.id}.jpeg`);
      allActiveBaseNames.add(`${item.id}.png`);
      allActiveBaseNames.add(`${item.id}.webp`);

      if (item.characters && Array.isArray(item.characters)) {
        for (let idx = 0; idx < item.characters.length; idx++) {
          const char = item.characters[idx];
          if (char.fileName) {
            const name = char.fileName.split('/').pop()!;
            activeCharacters.add(name);
            allActiveBaseNames.add(name);
          }
          activeCharacters.add(`${item.id}_char_${idx}.jpg`);
          activeCharacters.add(`${item.id}_char_${idx}.png`);
          activeCharacters.add(`${item.id}_char_${idx}.webp`);
          allActiveBaseNames.add(`${item.id}_char_${idx}.jpg`);
        }
      }

      if (item.ankiExtraImages && Array.isArray(item.ankiExtraImages)) {
        for (let idx = 0; idx < item.ankiExtraImages.length; idx++) {
          const extra = item.ankiExtraImages[idx];
          if (extra.fileName) {
            const name = extra.fileName.split('/').pop()!;
            activeAnki.add(name);
            activeAnki.add(name.toLowerCase());
            allActiveBaseNames.add(name);
            allActiveBaseNames.add(name.toLowerCase());
          }
          if (extra.url && !extra.url.startsWith('data:')) {
            const name = extra.url.split('/').pop()!;
            activeAnki.add(name);
            activeAnki.add(name.toLowerCase());
            allActiveBaseNames.add(name);
            allActiveBaseNames.add(name.toLowerCase());
          }
          const exts = ['jpg', 'jpeg', 'png', 'webp'];
          if (extra.id) {
            const safeExtraId = sanitizeFilename(extra.id.replace(/^img_/, ''));
            const safeRawId = sanitizeFilename(extra.id);
            for (const ext of exts) {
              const nameClean = `${item.id}_extra_${safeExtraId}.${ext}`;
              const nameRaw = `${item.id}_extra_${safeRawId}.${ext}`;
              activeAnki.add(nameClean);
              activeAnki.add(nameClean.toLowerCase());
              activeAnki.add(nameRaw);
              activeAnki.add(nameRaw.toLowerCase());
              allActiveBaseNames.add(nameClean);
              allActiveBaseNames.add(nameClean.toLowerCase());
              allActiveBaseNames.add(nameRaw);
              allActiveBaseNames.add(nameRaw.toLowerCase());
            }
          }
          // Backward compatibility check
          for (const ext of exts) {
            const nameIdx = `${item.id}_extra_${idx}.${ext}`;
            activeAnki.add(nameIdx);
            activeAnki.add(nameIdx.toLowerCase());
            allActiveBaseNames.add(nameIdx);
            allActiveBaseNames.add(nameIdx.toLowerCase());
          }
        }
      }
    }

    // Badges
    const badgesToCheck = customBadges || [];
    for (const badge of badgesToCheck) {
      if (badge.fileName) {
        const name = badge.fileName.split('/').pop()!;
        activeBadges.add(name);
        activeBadges.add(name.toLowerCase());
        allActiveBaseNames.add(name);
        allActiveBaseNames.add(name.toLowerCase());
      }
      activeBadges.add(`badge_${badge.id}.webp`);
      activeBadges.add(`badge_${badge.id}.png`);
      allActiveBaseNames.add(`badge_${badge.id}.webp`);
      allActiveBaseNames.add(`badge_${badge.id}.png`);
    }

    const deletedFiles: string[] = [];

    // Helper to clean a specific subfolder
    async function cleanSubFolder(subName: string, activeSet: Set<string>) {
      try {
        const subDir = await imagesDir!.getDirectoryHandle(subName, { create: false });
        if ((subDir as any).values) {
          for await (const entry of (subDir as any).values()) {
            if (entry.kind === 'file') {
              const nameLower = entry.name.toLowerCase();
              if (!activeSet.has(entry.name) && !activeSet.has(nameLower)) {
                try {
                  await (subDir as any).removeEntry(entry.name);
                  deletedFiles.push(`${subName}/${entry.name}`);
                } catch (delErr) {
                  console.warn(`Could not remove orphan image ${subName}/${entry.name}:`, delErr);
                }
              }
            }
          }
        }
      } catch {}
    }

    await cleanSubFolder('posters', activePosters);
    await cleanSubFolder('characters', activeCharacters);
    await cleanSubFolder('anki', activeAnki);
    await cleanSubFolder('badges', activeBadges);

    // Also check root images/ directory for obsolete legacy files (skip directories)
    if ((imagesDir as any).values) {
      for await (const entry of (imagesDir as any).values()) {
        if (entry.kind === 'file') {
          // If this file already exists in posters, characters, anki, or badges, OR is not an active item at all:
          // it is an obsolete root duplicate that should be safely removed!
          const existsInSub =
            activePosters.has(entry.name) ||
            activeCharacters.has(entry.name) ||
            activeAnki.has(entry.name) ||
            activeBadges.has(entry.name);

          if (existsInSub || !allActiveBaseNames.has(entry.name)) {
            try {
              await (imagesDir as any).removeEntry(entry.name);
              deletedFiles.push(entry.name);
            } catch (delErr) {
              console.warn(`Could not remove root orphan image ${entry.name}:`, delErr);
            }
          }
        }
      }
    }

    return { cleanedCount: deletedFiles.length, deletedFiles };
  } catch (err) {
    console.error('Error cleaning orphan images:', err);
    throw err;
  }
}

/**
 * Deletes the specific image file(s) for a deleted item from the local images/ folder and subfolders.
 */
export async function deleteImageFromFolder(
  dirHandle: FileSystemDirectoryHandle,
  thumbnailFileName?: string,
  itemId?: string
): Promise<void> {
  try {
    let imagesDir: FileSystemDirectoryHandle | null = null;
    try {
      imagesDir = await dirHandle.getDirectoryHandle('images', { create: false });
    } catch {
      return;
    }
    if (!imagesDir) return;

    if (thumbnailFileName) {
      const clean = thumbnailFileName.replace(/^images\//, '');
      try {
        if (clean.includes('/')) {
          const parts = clean.split('/');
          const sub = await imagesDir.getDirectoryHandle(parts[0], { create: false });
          await (sub as any).removeEntry(parts[parts.length - 1]);
        } else {
          await (imagesDir as any).removeEntry(clean);
        }
      } catch {}
    }

    if (itemId) {
      const subDirs = ['posters', 'characters', 'anki'];
      for (const subName of subDirs) {
        try {
          const sub = await imagesDir.getDirectoryHandle(subName, { create: false });
          if ((sub as any).values) {
            for await (const entry of (sub as any).values()) {
              if (entry.kind === 'file' && entry.name.startsWith(itemId)) {
                try {
                  await (sub as any).removeEntry(entry.name);
                } catch {}
              }
            }
          }
        } catch {}
      }

      // Check root directory for legacy files starting with itemId
      if ((imagesDir as any).values) {
        try {
          for await (const entry of (imagesDir as any).values()) {
            if (entry.kind === 'file' && entry.name.startsWith(itemId)) {
              try {
                await (imagesDir as any).removeEntry(entry.name);
              } catch {}
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn('Error deleting image file from folder:', err);
  }
}

/**
 * Deletes the specific badge image file(s) for a deleted badge from the local images/badges/ folder.
 */
export async function deleteBadgeImageFromFolder(
  dirHandle: FileSystemDirectoryHandle,
  badgeId: string,
  fileName?: string
): Promise<void> {
  try {
    let imagesDir: FileSystemDirectoryHandle | null = null;
    try {
      imagesDir = await dirHandle.getDirectoryHandle('images', { create: false });
    } catch {
      return;
    }
    if (!imagesDir) return;

    let badgesDir: FileSystemDirectoryHandle | null = null;
    try {
      badgesDir = await imagesDir.getDirectoryHandle('badges', { create: false });
    } catch {
      badgesDir = null;
    }

    // 1. If explicit fileName specified, remove it from badges subfolder and root imagesDir
    if (fileName) {
      const clean = fileName.replace(/^images\//, '');
      const baseName = clean.split('/').pop()!;
      if (badgesDir) {
        try {
          await (badgesDir as any).removeEntry(baseName);
        } catch {}
      }
      try {
        await (imagesDir as any).removeEntry(baseName);
      } catch {}
    }

    // 2. Remove standard badge_<id>.* files from badgesDir and imagesDir
    if (badgeId) {
      const exts = ['webp', 'png', 'jpg', 'jpeg'];
      for (const ext of exts) {
        const target = `badge_${badgeId}.${ext}`;
        if (badgesDir) {
          try {
            await (badgesDir as any).removeEntry(target);
          } catch {}
        }
        try {
          await (imagesDir as any).removeEntry(target);
        } catch {}
      }
    }
  } catch (err) {
    console.warn('Error deleting badge image from folder:', err);
  }
}

// --- Local Storage Fallback & Migration ---

export function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`SafeLocalStorage: failed to set "${key}":`, e);
    // If quota was exceeded, clear obsolete legacy cache keys and retry once
    try {
      localStorage.removeItem('yapim_arsivim_app_data_v3');
      localStorage.removeItem('yapim_arsivim_app_data_v4');
      localStorage.setItem(key, value);
    } catch {}
  }
}

export function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeLocalStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function loadDataFromLocalStorage(): AppData {
  try {
    const raw = safeLocalStorageGet(LOCAL_STORAGE_KEY) || safeLocalStorageGet('yapim_arsivim_app_data_v3');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const mediaCats = Array.isArray(parsed.categories?.media) ? parsed.categories.media : [];
        const gameCats = Array.isArray(parsed.categories?.game) ? parsed.categories.game : [];
        const bookCats = Array.isArray(parsed.categories?.book) ? parsed.categories.book : [];
        const items = Array.isArray(parsed.items)
          ? parsed.items.filter(Boolean).map((it: ArchiveItem) => ({
              ...it,
              ankiCard: it.ankiCard ? ensureAnkiCardDates(it.ankiCard) : undefined,
            }))
          : [];
        let customBadges: CustomBadge[] = [];
        if (Array.isArray(parsed.customBadges)) {
          customBadges = parsed.customBadges;
        } else {
          try {
            const rawBadges = safeLocalStorageGet('lore_custom_badges');
            if (rawBadges) {
              const parsedBadges = JSON.parse(rawBadges);
              if (Array.isArray(parsedBadges)) customBadges = parsedBadges;
            }
          } catch {}
        }

        return {
          version: parsed.version || 1,
          lastUpdated: parsed.lastUpdated || new Date().toISOString(),
          categories: {
            media: mediaCats,
            game: gameCats,
            book: bookCats,
          },
          items,
          customBadges,
          badgeGlowEnabled: typeof parsed.badgeGlowEnabled === 'boolean' ? parsed.badgeGlowEnabled : true,
        };
      }
    }
  } catch (err) {
    console.error('Failed to load from localStorage:', err);
  }
  return INITIAL_DATA;
}

export function saveDataToLocalStorage(data: AppData): void {
  // 1. Always persist full data with custom images in IndexedDB (Gigabytes quota)
  saveDataToIndexedDB(data);

  // 2. Save a lightweight version in LocalStorage (without large base64 strings to never exceed 5MB quota)
  try {
    const lightweightItems = (data.items || []).map((it) => {
      if (it.thumbnail && it.thumbnail.startsWith('data:') && it.thumbnail.length > 5000) {
        // Exclude large base64 thumbnails from localStorage since IndexedDB holds them intact
        const { thumbnail, ...rest } = it;
        return rest;
      }
      return it;
    });

    const lightweightData: AppData = {
      ...data,
      items: lightweightItems,
    };

    safeLocalStorageSet(LOCAL_STORAGE_KEY, JSON.stringify(lightweightData));
    if (data.customBadges) {
      safeLocalStorageSet('lore_custom_badges', JSON.stringify(data.customBadges));
    }
    // Clean old bulky legacy key if present
    localStorage.removeItem('yapim_arsivim_app_data_v3');
  } catch (err) {
    console.warn('LocalStorage save failed; safely handled by IndexedDB.');
  }
}

// --- Export / Import JSON File ---

export function downloadJsonFile(data: AppData, filename = 'yapim-arsivim-data.json'): void {
  const fullData: AppData = {
    ...data,
    recommendationMemory: data.recommendationMemory || loadRecommendationMemory(),
  };
  const jsonStr = JSON.stringify(fullData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ParsedJsonResult {
  appData: AppData;
  isItemListOnly: boolean;
  importedItems: ArchiveItem[];
}

export function parseUploadedJson(file: File, existingAppData?: AppData): Promise<ParsedJsonResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text);

        // Case 1: Direct array of items (e.g. oyunlar.json)
        if (Array.isArray(json)) {
          const sanitizedItems: ArchiveItem[] = json.map((it: any, index: number) => ({
            ...it,
            id: it.id || `item_${Date.now()}_${index}`,
            mainTab: it.mainTab === 'game' ? 'game' : it.mainTab === 'book' ? 'book' : 'media',
            cat: it.cat || '',
            sub: it.sub || null,
            title: it.title || 'İsimsiz Yapım',
            rating: typeof it.rating === 'number' ? it.rating : 0,
            date: it.date || it.watchDate || '',
            releaseYear: it.releaseYear || undefined,
            desc: it.desc || it.notes || '',
            thumbnail: it.thumbnail || '',
            thumbnailFileName: it.thumbnailFileName || undefined,
            tier: it.tier || null,
            following: it.following ?? false,
            watching: it.watching ?? false,
            dropped: it.dropped ?? false,
            toWatch: it.toWatch ?? (it.mediaStatus === 'İzlenecek'),
            mediaStatus: it.mediaStatus || undefined,
            expectedDate: it.expectedDate || undefined,
            followNotes: it.followNotes || undefined,
            status: it.status || undefined,
            achPercent: it.achPercent !== undefined ? it.achPercent : null,
            achMax: it.achMax || undefined,
            hours: it.hours || undefined,
            reading: it.reading ?? false,
            toRead: it.toRead ?? (it.bookStatus === 'Okunacak'),
            bookStatus: it.bookStatus || undefined,
            pageCount: typeof it.pageCount === 'number' ? it.pageCount : undefined,
            format: it.format || undefined,
            author: Array.isArray(it.author) ? it.author : undefined,
            publisher: Array.isArray(it.publisher) ? it.publisher : undefined,
            translator: Array.isArray(it.translator) ? it.translator : undefined,
            quotes: Array.isArray(it.quotes) ? it.quotes : undefined,
            firm: Array.isArray(it.firm) ? it.firm : undefined,
            director: Array.isArray(it.director) ? it.director : undefined,
            actors: Array.isArray(it.actors) ? it.actors : undefined,
            developer: Array.isArray(it.developer) ? it.developer : undefined,
            genre: Array.isArray(it.genre) ? it.genre : undefined,
            characters: Array.isArray(it.characters) ? it.characters : undefined,
            badges: Array.isArray(it.badges) ? it.badges : undefined,
            anki: it.anki ?? false,
            ankiCard: it.ankiCard ? ensureAnkiCardDates(it.ankiCard) : undefined,
            createdAt: typeof it.createdAt === 'number' ? it.createdAt : (it.createdAt ? Number(it.createdAt) : Date.now()),
            updatedAt: typeof it.updatedAt === 'number' ? it.updatedAt : (it.updatedAt ? Number(it.updatedAt) : Date.now()),
          }));

          const baseCategories = existingAppData?.categories || INITIAL_DATA.categories;
          return resolve({
            appData: {
              version: existingAppData?.version || 1,
              lastUpdated: new Date().toISOString(),
              categories: baseCategories,
              items: sanitizedItems,
            },
            isItemListOnly: true,
            importedItems: sanitizedItems,
          });
        }

        // Case 2: Object with items array (and optional categories)
        if (json && typeof json === 'object' && Array.isArray(json.items)) {
          const sanitizedItems: ArchiveItem[] = json.items.map((it: any, index: number) => ({
            ...it,
            id: it.id || `item_${Date.now()}_${index}`,
            mainTab: it.mainTab === 'game' ? 'game' : it.mainTab === 'book' ? 'book' : 'media',
            cat: it.cat || '',
            sub: it.sub || null,
            title: it.title || 'İsimsiz Yapım',
            rating: typeof it.rating === 'number' ? it.rating : 0,
            date: it.date || it.watchDate || '',
            releaseYear: it.releaseYear || undefined,
            desc: it.desc || it.notes || '',
            thumbnail: it.thumbnail || '',
            thumbnailFileName: it.thumbnailFileName || undefined,
            tier: it.tier || null,
            following: it.following ?? false,
            watching: it.watching ?? false,
            dropped: it.dropped ?? false,
            toWatch: it.toWatch ?? (it.mediaStatus === 'İzlenecek'),
            mediaStatus: it.mediaStatus || undefined,
            expectedDate: it.expectedDate || undefined,
            followNotes: it.followNotes || undefined,
            status: it.status || undefined,
            achPercent: it.achPercent !== undefined ? it.achPercent : null,
            achMax: it.achMax || undefined,
            hours: it.hours || undefined,
            reading: it.reading ?? false,
            toRead: it.toRead ?? (it.bookStatus === 'Okunacak'),
            bookStatus: it.bookStatus || undefined,
            pageCount: typeof it.pageCount === 'number' ? it.pageCount : undefined,
            format: it.format || undefined,
            author: Array.isArray(it.author) ? it.author : undefined,
            publisher: Array.isArray(it.publisher) ? it.publisher : undefined,
            translator: Array.isArray(it.translator) ? it.translator : undefined,
            quotes: Array.isArray(it.quotes) ? it.quotes : undefined,
            firm: Array.isArray(it.firm) ? it.firm : undefined,
            director: Array.isArray(it.director) ? it.director : undefined,
            actors: Array.isArray(it.actors) ? it.actors : undefined,
            developer: Array.isArray(it.developer) ? it.developer : undefined,
            genre: Array.isArray(it.genre) ? it.genre : undefined,
            characters: Array.isArray(it.characters) ? it.characters : undefined,
            badges: Array.isArray(it.badges) ? it.badges : undefined,
            anki: it.anki ?? false,
            ankiCard: it.ankiCard ? ensureAnkiCardDates(it.ankiCard) : undefined,
            createdAt: typeof it.createdAt === 'number' ? it.createdAt : (it.createdAt ? Number(it.createdAt) : Date.now()),
            updatedAt: typeof it.updatedAt === 'number' ? it.updatedAt : (it.updatedAt ? Number(it.updatedAt) : Date.now()),
          }));

          const hasCategories = json.categories && typeof json.categories === 'object';
          const categories = hasCategories
            ? {
                media: json.categories.media || [],
                game: json.categories.game || [],
                book: json.categories.book || [],
              }
            : existingAppData?.categories || INITIAL_DATA.categories;

          // Restore recommendation memory if present in JSON
          if (Array.isArray(json.recommendationMemory) && json.recommendationMemory.length > 0) {
            saveRecommendationMemory(json.recommendationMemory);
          }

          const parsedCustomBadges = Array.isArray(json.customBadges)
            ? json.customBadges
            : (existingAppData?.customBadges || []);

          if (parsedCustomBadges.length > 0) {
            safeLocalStorageSet('lore_custom_badges', JSON.stringify(parsedCustomBadges));
          }

          return resolve({
            appData: {
              version: json.version || existingAppData?.version || 1,
              lastUpdated: new Date().toISOString(),
              categories,
              items: sanitizedItems,
              customBadges: parsedCustomBadges,
              badgeGlowEnabled: typeof json.badgeGlowEnabled === 'boolean' ? json.badgeGlowEnabled : (existingAppData?.badgeGlowEnabled ?? true),
              recommendationMemory: json.recommendationMemory,
            },
            isItemListOnly: !hasCategories,
            importedItems: sanitizedItems,
          });
        }

        throw new Error('Geçersiz Yapım Arşivim veri dosyası.');
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsText(file);
  });
}

// Helper to convert base64/dataURL to Blob
function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  let mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  if (!mime.startsWith('image/')) {
    mime = 'image/png';
  }
  const bstr = atob(arr[1] || '');
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Builds the Master Unified ZIP archive containing:
 * - Lore_AnaKutuphane.zip (Database json + images/ cover folder)
 * - TierList_Yedekleri/ (Individual Category Tier List JSON files and High-Res PNG posters)
 */
export async function buildUnifiedZipBlob(data: AppData): Promise<Blob> {
  const masterZip = new JSZip();

  // 1. Build Inner Library ZIP (Lore_AnaKutuphane.zip)
  const libZip = new JSZip();
  const imgFolder = libZip.folder('images');
  const postersFolder = imgFolder?.folder('posters');
  const charactersFolder = imgFolder?.folder('characters');
  const ankiFolder = imgFolder?.folder('anki');
  const badgesFolder = imgFolder?.folder('badges');

  const cleanItems: ArchiveItem[] = [];
  const seenIds = new Set<string>();

  for (const item of data.items) {
    if (!item.id || seenIds.has(item.id)) continue;
    seenIds.add(item.id);

    const itemCopy = { ...item };

    // 1. Posters -> images/posters/
    if (item.thumbnail && item.thumbnail.startsWith('data:')) {
      try {
        const mimeMatch = item.thumbnail.match(/data:(?:image\/)?([a-zA-Z0-9]+);/);
        let ext = mimeMatch ? (mimeMatch[1] === 'jpeg' ? 'jpg' : mimeMatch[1]) : 'jpg';
        if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) ext = 'jpg';
        const existingCleanName = item.thumbnailFileName
          ? item.thumbnailFileName.split('/').pop()!
          : '';
        const imgName = existingCleanName || `${item.id}.${ext}`;
        const blob = dataURLtoBlob(item.thumbnail);
        if (postersFolder) {
          postersFolder.file(imgName, blob);
        }
        itemCopy.thumbnailFileName = `images/posters/${imgName}`;
      } catch (e) {
        console.warn('Image zip export error:', e);
      }
    } else if (item.thumbnailFileName && !item.thumbnailFileName.includes('/posters/')) {
      const cleanOld = item.thumbnailFileName.replace(/^images\//i, '');
      itemCopy.thumbnailFileName = `images/posters/${cleanOld}`;
    }

    // Strip bulky base64 thumbnail from itemCopy so JSON inside ZIP is only ~150 KB!
    if (itemCopy.thumbnailFileName || (itemCopy.thumbnail && itemCopy.thumbnail.startsWith('data:'))) {
      delete itemCopy.thumbnail;
    }

    // 2. Characters -> images/characters/ (Extract to zip so JSON is lightweight)
    if (item.characters && Array.isArray(item.characters) && item.characters.length > 0) {
      const cleanChars = [];
      for (let idx = 0; idx < item.characters.length; idx++) {
        const char = item.characters[idx];
        const charCopy = { ...char };
        const existingCleanName = char.fileName ? char.fileName.split('/').pop()! : '';

        if (char.image && char.image.startsWith('data:')) {
          try {
            const mimeMatch = char.image.match(/data:(?:image\/)?([a-zA-Z0-9]+);/);
            let ext = mimeMatch ? (mimeMatch[1] === 'jpeg' ? 'jpg' : mimeMatch[1]) : 'jpg';
            if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) ext = 'jpg';
            const charImgName = existingCleanName || `${item.id}_char_${idx}.${ext}`;
            const blob = dataURLtoBlob(char.image);
            if (charactersFolder) {
              charactersFolder.file(charImgName, blob);
            }
            charCopy.fileName = `images/characters/${charImgName}`;
            charCopy.image = `images/characters/${charImgName}`;
          } catch (e) {
            console.warn('Character image zip export error:', e);
          }
        }
        if (charCopy.image && charCopy.image.startsWith('data:')) {
          charCopy.image = charCopy.fileName || `images/characters/${item.id}_char_${idx}.jpg`;
        }
        cleanChars.push(charCopy);
      }
      itemCopy.characters = cleanChars;
    }

    // 3. Anki extra images -> images/anki/
    if (item.ankiExtraImages && item.ankiExtraImages.length > 0) {
      const cleanExtras = [];
      for (let idx = 0; idx < item.ankiExtraImages.length; idx++) {
        const extra = item.ankiExtraImages[idx];
        const extraCopy = { ...extra };
        const existingCleanName = extra.fileName
          ? extra.fileName.split('/').pop()!
          : (extra.url && extra.url.startsWith('images/'))
          ? extra.url.split('/').pop()!
          : '';

        if (extra.url && extra.url.startsWith('data:')) {
          try {
            const mimeMatch = extra.url.match(/data:(?:image\/)?([a-zA-Z0-9]+);/);
            let ext = mimeMatch ? (mimeMatch[1] === 'jpeg' ? 'jpg' : mimeMatch[1]) : 'jpg';
            if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) ext = 'jpg';
            const safeExtraId = extra.id ? sanitizeFilename(extra.id.replace(/^img_/, '')) : `${Date.now()}_${idx}`;
            const extraImgName = existingCleanName || `${item.id}_extra_${safeExtraId}.${ext}`;
            const blob = dataURLtoBlob(extra.url);
            if (ankiFolder) {
              ankiFolder.file(extraImgName, blob);
            }
            extraCopy.fileName = `images/anki/${extraImgName}`;
            extraCopy.url = `images/anki/${extraImgName}`;
          } catch (e) {
            console.warn('Extra image zip export error:', e);
          }
        }
        if (extraCopy.url && extraCopy.url.startsWith('data:')) {
          extraCopy.url = extraCopy.fileName || `images/anki/${item.id}_extra_${idx}.jpg`;
        }
        cleanExtras.push(extraCopy);
      }
      itemCopy.ankiExtraImages = cleanExtras;
    }

    cleanItems.push(itemCopy);
  }

  // 4. Custom Badges -> images/badges/
  let cleanBadges = data.customBadges;
  if (!cleanBadges) {
    try {
      const raw = safeLocalStorageGet('lore_custom_badges');
      if (raw) cleanBadges = JSON.parse(raw);
    } catch {}
  }

  if (cleanBadges && Array.isArray(cleanBadges) && cleanBadges.length > 0) {
    const updatedBadges = [];
    for (const badge of cleanBadges) {
      const badgeCopy = { ...badge };
      let existingCleanName = badgeCopy.fileName ? badgeCopy.fileName.split('/').pop()! : '';
      let badgeImgName = existingCleanName || `badge_${badge.id}.webp`;

      if (badge.iconData && badge.iconData.startsWith('data:')) {
        try {
          const mimeMatch = badge.iconData.match(/data:(?:image\/)?([a-zA-Z0-9]+);/);
          let ext = mimeMatch ? (mimeMatch[1] === 'jpeg' ? 'jpg' : mimeMatch[1]) : 'webp';
          if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
            ext = existingCleanName ? existingCleanName.split('.').pop() || 'webp' : 'webp';
          }
          if (!existingCleanName) {
            badgeImgName = `badge_${badge.id}.${ext}`;
          }

          const blob = dataURLtoBlob(badge.iconData);
          if (badgesFolder) {
            badgesFolder.file(badgeImgName, blob);
          }
          badgeCopy.fileName = `images/badges/${badgeImgName}`;
          badgeCopy.iconData = `images/badges/${badgeImgName}`;
        } catch (e) {
          console.warn('Badge zip export error:', e);
        }
      }

      badgeCopy.fileName = `images/badges/${badgeImgName}`;
      badgeCopy.iconData = `images/badges/${badgeImgName}`;
      updatedBadges.push(badgeCopy);
    }
    cleanBadges = updatedBadges;
  }

  const recMemory = data.recommendationMemory || loadRecommendationMemory();
  const exportData: AppData = {
    ...data,
    items: cleanItems,
    customBadges: cleanBadges,
    recommendationMemory: recMemory,
  };
  libZip.file(DATA_FILE_NAME, JSON.stringify(exportData, null, 2));

  // Standalone modular copy of recommendation memory
  if (recMemory && recMemory.length > 0) {
    libZip.file('lore_recommendation_memory.json', JSON.stringify(recMemory, null, 2));
  }

  const libZipBlob = await libZip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  // Put Lore_AnaKutuphane.zip into the Master ZIP
  masterZip.file('Lore_AnaKutuphane.zip', libZipBlob);

  // 2. Generate TierList_Yedekleri folder in the Master ZIP
  const tierFolder = masterZip.folder('TierList_Yedekleri');
  const allTabs: MainTabType[] = ['media', 'game', 'book'];
  const now = new Date();

  for (const tab of allTabs) {
    const cats = data.categories[tab] || [];
    for (const cat of cats) {
      if (cat.tierEnabled) {
        const catItems = data.items.filter(
          (it) => it.mainTab === tab && it.cat === cat.id
        );
        const tierBackup: TierListCategoryExportData = {
          type: 'LORE_TIER_LIST_BACKUP',
          version: 1,
          exportedAt: now.toISOString(),
          category: cat,
          mainTab: tab,
          items: catItems,
        };
        const safeName = sanitizeFilename(cat.name);
        const tabPrefix = tab === 'game' ? 'Oyun' : tab === 'book' ? 'Kitap' : 'Medya';
        const jsonFileName = `${tabPrefix}_${safeName}_TierList.json`;
        const pngFileName = `${tabPrefix}_${safeName}_TierList.png`;

        if (tierFolder) {
          tierFolder.file(jsonFileName, JSON.stringify(tierBackup, null, 2));
          try {
            const pngBlob = await renderTierListToPngBlob(cat, catItems, tab);
            tierFolder.file(pngFileName, pngBlob);
          } catch (pngErr) {
            console.warn(`Could not render PNG snapshot for ${cat.name}:`, pngErr);
          }
        }
      }
    }
  }

  return await masterZip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

// --- ZIP Backup / Restore (Unified Single-ZIP Format) ---

export async function exportAppDataToZip(data: AppData, filename?: string): Promise<void> {
  const actualFilename = filename || `Lore_TumArsiv_${getFormattedDateForFilename()}.zip`;
  const zipBlob = await buildUnifiedZipBlob(data);

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = actualFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importAppDataFromZip(
  fileOrBlob: File | Blob,
  rootDirHandle?: FileSystemDirectoryHandle | null
): Promise<AppData> {
  let zip = await JSZip.loadAsync(fileOrBlob);

  // Check if this is a Master Zip containing an inner 'Lore_AnaKutuphane.zip' or similar archive
  const innerLibZipFile = zip.file(/^(?:Lore_AnaKutuphane|Lore_KutuphanePaketi.*)\.zip$/i)[0];
  let innerZip: JSZip | null = null;
  if (innerLibZipFile) {
    try {
      const innerBlob = await innerLibZipFile.async('blob');
      innerZip = await JSZip.loadAsync(innerBlob);
    } catch (e) {
      console.warn('Could not unpack inner library zip, reading directly:', e);
    }
  }

  // 1. Find database json file (look in innerZip first, then master zip)
  let jsonFile = innerZip ? innerZip.file(DATA_FILE_NAME) : null;
  if (!jsonFile) {
    jsonFile = zip.file(DATA_FILE_NAME);
  }
  if (!jsonFile) {
    const searchTarget = innerZip || zip;
    const jsonFiles = searchTarget.file(/\.json$/i);
    const rootOrMainJsons = jsonFiles.filter(
      (f) => !f.name.startsWith('tier_lists/') && !f.name.startsWith('TierList_Yedekleri/')
    );
    if (rootOrMainJsons.length > 0) {
      jsonFile = rootOrMainJsons[0];
    } else if (jsonFiles.length > 0) {
      jsonFile = jsonFiles[0];
    }
  }

  if (!jsonFile) {
    throw new Error('ZIP dosyası içinde geçerli bir veritabanı JSON dosyası bulunamadı.');
  }

  const jsonText = await jsonFile.async('text');
  const rawAppData = JSON.parse(jsonText) as AppData;

  if (!rawAppData.categories || !rawAppData.items) {
    throw new Error('Geçersiz Yapım Arşivim verisi.');
  }

  // Restore recommendation memory from backup if present
  if (Array.isArray(rawAppData.recommendationMemory) && rawAppData.recommendationMemory.length > 0) {
    saveRecommendationMemory(rawAppData.recommendationMemory);
  } else {
    const recFile = (innerZip || zip).file(/(?:lore_)?recommendation_memory\.json|oneri_hafizasi\.json/i)[0];
    if (recFile) {
      try {
        const text = await recFile.async('text');
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          saveRecommendationMemory(parsed);
        }
      } catch {}
    }
  }

  // 2. Read images in zip (check innerZip first, then master zip)
  const imageSource = innerZip || zip;
  const imageFiles = imageSource.file(/^images\/.+/i);
  const imageMap = new Map<string, string>();

  let localImagesDirHandle: any = null;
  let localPostersDir: any = null;
  let localCharactersDir: any = null;
  let localAnkiDir: any = null;
  let localBadgesDir: any = null;

  if (rootDirHandle) {
    try {
      localImagesDirHandle = await rootDirHandle.getDirectoryHandle('images', { create: true });
      localPostersDir = await localImagesDirHandle.getDirectoryHandle('posters', { create: true });
      localCharactersDir = await localImagesDirHandle.getDirectoryHandle('characters', { create: true });
      localAnkiDir = await localImagesDirHandle.getDirectoryHandle('anki', { create: true });
      localBadgesDir = await localImagesDirHandle.getDirectoryHandle('badges', { create: true });
    } catch (e) {
      console.warn('Could not access images directories for disk extraction:', e);
    }
  }

  for (const imgZip of imageFiles) {
    if (imgZip.dir) continue;
    try {
      const fullPath = imgZip.name.replace(/^images\//i, '');
      const baseFilename = fullPath.split('/').pop() || fullPath;
      const ext = baseFilename.split('.').pop()?.toLowerCase() || 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const blob = await imgZip.async('blob');
      const base64 = await imgZip.async('base64');
      const dataUrl = `data:${mime};base64,${base64}`;

      // Register multiple lookup keys for ultra-safe fallback
      imageMap.set(imgZip.name.toLowerCase(), dataUrl);
      imageMap.set(fullPath.toLowerCase(), dataUrl);
      imageMap.set(baseFilename.toLowerCase(), dataUrl);

      // Save directly to disk in appropriate subfolder if connected
      if (localImagesDirHandle) {
        try {
          let targetDir = localImagesDirHandle;
          if (fullPath.startsWith('posters/') && localPostersDir) {
            targetDir = localPostersDir;
          } else if (fullPath.startsWith('characters/') && localCharactersDir) {
            targetDir = localCharactersDir;
          } else if (fullPath.startsWith('anki/') && localAnkiDir) {
            targetDir = localAnkiDir;
          } else if (fullPath.startsWith('badges/') && localBadgesDir) {
            targetDir = localBadgesDir;
          } else {
            // Legacy files directly in images/: route to correct subfolder by filename pattern
            if (baseFilename.includes('_char_') && localCharactersDir) {
              targetDir = localCharactersDir;
            } else if (baseFilename.includes('_extra_') && localAnkiDir) {
              targetDir = localAnkiDir;
            } else if (baseFilename.startsWith('badge_') && localBadgesDir) {
              targetDir = localBadgesDir;
            } else if (localPostersDir) {
              targetDir = localPostersDir;
            }
          }

          const fh = await targetDir.getFileHandle(baseFilename, { create: true });
          const writable = await fh.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (we) {
          console.warn('Failed to extract image to disk:', baseFilename, we);
        }
      }
    } catch (e) {
      console.warn('Error reading image from zip:', imgZip.name, e);
    }
  }

  // Check any root images
  const rootImages = imageSource.file(/\.(jpe?g|png|webp)$/i);
  for (const imgZip of rootImages) {
    if (
      !imgZip.name.startsWith('images/') &&
      !imgZip.name.startsWith('tier_lists/') &&
      !imgZip.name.startsWith('TierList_Yedekleri/')
    ) {
      try {
        const baseFilename = imgZip.name.split('/').pop() || imgZip.name;
        const ext = baseFilename.split('.').pop()?.toLowerCase() || 'jpg';
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        const base64 = await imgZip.async('base64');
        const dataUrl = `data:${mime};base64,${base64}`;
        imageMap.set(imgZip.name.toLowerCase(), dataUrl);
        imageMap.set(baseFilename.toLowerCase(), dataUrl);
      } catch (e) {
        console.warn('Error reading root image from zip:', imgZip.name, e);
      }
    }
  }

  // 3. Deduplicate items & attach thumbnails, characters, and anki images back to items
  const uniqueItemsMap = new Map<string, ArchiveItem>();

  for (const rawItem of rawAppData.items) {
    if (!rawItem.id) continue;
    const item: ArchiveItem = {
      ...rawItem,
      ankiCard: rawItem.ankiCard ? ensureAnkiCardDates(rawItem.ankiCard) : undefined,
    };

    // 1. Restore Poster (Thumbnail)
    if (!item.thumbnail || !item.thumbnail.startsWith('data:image/')) {
      if (item.thumbnailFileName) {
        const baseName = item.thumbnailFileName.split('/').pop()?.toLowerCase() || '';
        const match =
          imageMap.get(item.thumbnailFileName.toLowerCase()) ||
          imageMap.get(item.thumbnailFileName.replace(/^images\//i, '').toLowerCase()) ||
          imageMap.get(baseName);
        if (match) {
          item.thumbnail = match;
        }
      }
      if (!item.thumbnail || !item.thumbnail.startsWith('data:image/')) {
        const idKeyJpg = `${item.id}.jpg`.toLowerCase();
        const idKeyWebp = `${item.id}.webp`.toLowerCase();
        const idKeyPng = `${item.id}.png`.toLowerCase();
        if (imageMap.has(idKeyJpg)) {
          item.thumbnail = imageMap.get(idKeyJpg)!;
        } else if (imageMap.has(idKeyWebp)) {
          item.thumbnail = imageMap.get(idKeyWebp)!;
        } else if (imageMap.has(idKeyPng)) {
          item.thumbnail = imageMap.get(idKeyPng)!;
        }
      }
    }

    // 2. Restore Characters from zip
    if (item.characters && Array.isArray(item.characters)) {
      item.characters = item.characters.map((char, idx) => {
        if (!char.image || !char.image.startsWith('data:image/')) {
          const targetName = char.fileName
            ? char.fileName.toLowerCase()
            : char.image && char.image.startsWith('images/')
            ? char.image.toLowerCase()
            : null;
          if (targetName) {
            const rawBase = targetName.split('/').pop() || targetName;
            const match =
              imageMap.get(targetName) ||
              imageMap.get(targetName.replace(/^images\//i, '')) ||
              imageMap.get(rawBase);
            if (match) return { ...char, image: match, fileName: targetName };
          }
          const idKeyJpg = `${item.id}_char_${idx}.jpg`.toLowerCase();
          const idKeyWebp = `${item.id}_char_${idx}.webp`.toLowerCase();
          const idKeyPng = `${item.id}_char_${idx}.png`.toLowerCase();
          if (imageMap.has(idKeyJpg)) return { ...char, image: imageMap.get(idKeyJpg)!, fileName: `images/characters/${item.id}_char_${idx}.jpg` };
          if (imageMap.has(idKeyWebp)) return { ...char, image: imageMap.get(idKeyWebp)!, fileName: `images/characters/${item.id}_char_${idx}.webp` };
          if (imageMap.has(idKeyPng)) return { ...char, image: imageMap.get(idKeyPng)!, fileName: `images/characters/${item.id}_char_${idx}.png` };
        }
        return char;
      });
    }

    // 3. Restore Anki extra images from ZIP
    if (item.ankiExtraImages && Array.isArray(item.ankiExtraImages)) {
      item.ankiExtraImages = item.ankiExtraImages.map((extra, idx) => {
        if (!extra.url || !extra.url.startsWith('data:image/')) {
          const targetName = extra.fileName
            ? extra.fileName.toLowerCase()
            : extra.url && extra.url.startsWith('images/')
            ? extra.url.toLowerCase()
            : null;
          if (targetName) {
            const rawBase = targetName.split('/').pop() || targetName;
            const match =
              imageMap.get(targetName) ||
              imageMap.get(targetName.replace(/^images\//i, '')) ||
              imageMap.get(rawBase);
            if (match) return { ...extra, url: match };
          }
          if (extra.id) {
            const safeExtraId = sanitizeFilename(extra.id.replace(/^img_/, '')).toLowerCase();
            const idKeyJpgSafe = `${item.id}_extra_${safeExtraId}.jpg`.toLowerCase();
            const idKeyWebpSafe = `${item.id}_extra_${safeExtraId}.webp`.toLowerCase();
            const idKeyPngSafe = `${item.id}_extra_${safeExtraId}.png`.toLowerCase();
            if (imageMap.has(idKeyJpgSafe)) return { ...extra, url: imageMap.get(idKeyJpgSafe)! };
            if (imageMap.has(idKeyWebpSafe)) return { ...extra, url: imageMap.get(idKeyWebpSafe)! };
            if (imageMap.has(idKeyPngSafe)) return { ...extra, url: imageMap.get(idKeyPngSafe)! };
          }
          const idKeyJpg = `${item.id}_extra_${idx}.jpg`.toLowerCase();
          const idKeyWebp = `${item.id}_extra_${idx}.webp`.toLowerCase();
          const idKeyPng = `${item.id}_extra_${idx}.png`.toLowerCase();
          if (imageMap.has(idKeyJpg)) return { ...extra, url: imageMap.get(idKeyJpg)! };
          if (imageMap.has(idKeyWebp)) return { ...extra, url: imageMap.get(idKeyWebp)! };
          if (imageMap.has(idKeyPng)) return { ...extra, url: imageMap.get(idKeyPng)! };
        }
        return extra;
      });
    }

    uniqueItemsMap.set(item.id, item);
  }

  // 4. Restore CustomBadges from zip
  let restoredBadges = rawAppData.customBadges;
  if (!restoredBadges) {
    try {
      const raw = safeLocalStorageGet('lore_custom_badges');
      if (raw) restoredBadges = JSON.parse(raw);
    } catch {}
  }
  if (restoredBadges && Array.isArray(restoredBadges)) {
    restoredBadges = restoredBadges.map((badge) => {
      if (!badge.iconData || !badge.iconData.startsWith('data:image/')) {
        const targetName = badge.fileName
          ? badge.fileName.toLowerCase()
          : badge.iconData && badge.iconData.startsWith('images/')
          ? badge.iconData.toLowerCase()
          : null;
        if (targetName) {
          const rawBase = targetName.split('/').pop() || targetName;
          const match =
            imageMap.get(targetName) ||
            imageMap.get(targetName.replace(/^images\//i, '')) ||
            imageMap.get(rawBase);
          if (match) return { ...badge, iconData: match, fileName: targetName };
        }
        const bKeyWebp = `badge_${badge.id}.webp`.toLowerCase();
        const bKeyPng = `badge_${badge.id}.png`.toLowerCase();
        if (imageMap.has(bKeyWebp)) return { ...badge, iconData: imageMap.get(bKeyWebp)!, fileName: `images/badges/${bKeyWebp}` };
        if (imageMap.has(bKeyPng)) return { ...badge, iconData: imageMap.get(bKeyPng)!, fileName: `images/badges/${bKeyPng}` };
      }
      return badge;
    });
    safeLocalStorageSet('lore_custom_badges', JSON.stringify(restoredBadges));
  }

  const appData: AppData = {
    ...rawAppData,
    items: Array.from(uniqueItemsMap.values()),
    customBadges: restoredBadges,
    lastUpdated: new Date().toISOString(),
  };

  return appData;
}

// --- Standalone HTML Export for Mobile/Phone ("Telefon için Dışa Aktar") ---
export function generatePhoneStandaloneHtml(data: AppData): string {
  const embeddedJson = JSON.stringify(data);

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Lore">
<meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#141416">
<meta name="application-name" content="Lore">
<meta name="msapplication-navbutton-color" content="#141416">
<title>Lore</title>
<style>
  :root {
    --bg: #141416;
    --surface: #1e1f23;
    --surface-2: #282a30;
    --border: #33363e;
    --text-primary: #f3f4f6;
    --text-secondary: #9ca3af;
    --text-muted: #6b7280;
    --accent-blue: #3b82f6;
    --accent-amber: #f59e0b;
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body {
    background: var(--bg);
    color: var(--text-primary);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    margin: 0;
    padding: env(safe-area-inset-top, 12px) env(safe-area-inset-right, 12px) env(safe-area-inset-bottom, 40px) env(safe-area-inset-left, 12px);
    padding-top: max(12px, env(safe-area-inset-top));
    padding-bottom: max(40px, env(safe-area-inset-bottom));
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }
  .app-title { font-size: 17px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 6px; }
  .badge-offline { font-size: 11px; background: rgba(59,130,246,0.2); color: #60a5fa; padding: 2px 8px; border-radius: 12px; }
  .fs-btn {
    background: #282a30; border: 1px solid var(--border); color: #9ca3af; font-size: 11px;
    padding: 3px 8px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 4px;
  }
  .main-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
  .main-tab {
    flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border);
    background: var(--surface); color: var(--text-secondary); font-size: 14px; font-weight: 600; text-align: center;
    cursor: pointer;
  }
  .main-tab.active { background: #2b303c; border-color: var(--text-primary); color: #fff; }
  .controls-row { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
  .cats-scroll { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
  .cats-scroll::-webkit-scrollbar { display: none; }
  .cat-chip {
    padding: 6px 14px; border-radius: 20px; border: 1px solid var(--border);
    font-size: 13px; white-space: nowrap; background: var(--surface); color: var(--text-secondary); cursor: pointer;
  }
  .cat-chip.active { background: #3b4252; color: #fff; border-color: #60a5fa; font-weight: 600; }
  .cat-chip.pinned { border-color: rgba(245, 158, 11, 0.4); color: #f59e0b; }
  .cat-chip.pinned.active { background: rgba(245, 158, 11, 0.2); }
  .search-box {
    width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border);
    background: var(--surface); color: #fff; font-size: 14px; outline: none;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
    gap: 10px;
  }
  @media (min-width: 480px) {
    .grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; }
  }
  .card { cursor: pointer; position: relative; }
  .poster {
    aspect-ratio: 2/3; border-radius: 8px; display: flex; align-items: center; justify-content: center;
    position: relative; text-align: center; overflow: hidden; background: #24272f; border: 1px solid var(--border);
  }
  .poster img { width: 100%; height: 100%; object-fit: cover; }
  .rating-badge {
    position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.75);
    border-radius: 4px; padding: 2px 5px; font-size: 10px; font-weight: 700; color: #facc15;
  }
  .pin-icons { position: absolute; bottom: 4px; left: 4px; display: flex; gap: 3px; }
  .pin-icon { font-size: 10px; background: rgba(0,0,0,0.75); border-radius: 4px; padding: 1px 4px; }
  .pin-watching { color: #38bdf8; }
  .pin-following { color: #fbbf24; }
  .hours-badge {
    position: absolute; bottom: 4px; left: 4px; background: rgba(0,0,0,0.75);
    border-radius: 4px; padding: 1px 5px; font-size: 10px; color: #38bdf8; font-weight: 600;
  }
  .ach-badge {
    position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.75);
    border-radius: 4px; padding: 1px 5px; font-size: 10px; color: #4ade80; font-weight: 600;
  }
  .caption {
    font-size: 11px; margin: 4px 0 0; color: var(--text-secondary);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;
  }
  .empty { text-align: center; color: var(--text-muted); font-size: 13px; grid-column: 1 / -1; padding: 40px 0; }
  /* Modal */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 100;
    display: none; align-items: flex-end; justify-content: center;
  }
  .modal-box {
    background: #1c1d22; border-top: 1px solid var(--border); border-radius: 16px 16px 0 0;
    width: 100%; max-height: 85vh; overflow-y: auto; padding: 20px; box-shadow: 0 -10px 30px rgba(0,0,0,0.5);
    padding-bottom: max(24px, env(safe-area-inset-bottom));
  }
  .modal-close {
    float: right; background: transparent; border: none; color: var(--text-secondary);
    font-size: 20px; padding: 4px; cursor: pointer;
  }
</style>
</head>
<body>
<header>
  <div class="app-title">🎬 Lore <span class="badge-offline">Mobil</span></div>
  <button class="fs-btn" onclick="toggleFullscreen()" title="Tam Ekran">⛶ Tam Ekran</button>
</header>
<div class="main-tabs">
  <div class="main-tab active" id="tab-media" onclick="switchMainTab('media')">🎬 Medya</div>
  <div class="main-tab" id="tab-game" onclick="switchMainTab('game')">🎮 Oyun</div>
</div>
<div class="controls-row">
  <input type="text" class="search-box" id="search-input" placeholder="Yapım veya oyun ara..." oninput="onSearch(this.value)">
  <div class="cats-scroll" id="cat-chips"></div>
</div>
<div class="grid" id="items-grid"></div>

<div class="modal-overlay" id="modal-overlay" onclick="closeModal(event)">
  <div class="modal-box" id="modal-box" onclick="event.stopPropagation()">
    <button class="modal-close" onclick="closeDetail()">&times;</button>
    <div id="modal-content"></div>
  </div>
</div>

<script>
var DATA = ${embeddedJson};
var state = { mainTab: 'media', cat: null, search: '' };

function toggleFullscreen() {
  var doc = document.documentElement;
  var isFs = document.fullscreenElement || document['webkitFullscreenElement'] || document['mozFullScreenElement'];
  if (!isFs) {
    if (doc.requestFullscreen) {
      doc.requestFullscreen().catch(function(){});
    } else if (doc['webkitRequestFullscreen']) {
      doc['webkitRequestFullscreen']();
    } else if (doc['mozRequestFullScreen']) {
      doc['mozRequestFullScreen']();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(function(){});
    } else if (document['webkitExitFullscreen']) {
      document['webkitExitFullscreen']();
    } else if (document['mozCancelFullScreen']) {
      document['mozCancelFullScreen']();
    }
  }
}

function switchMainTab(tab) {
  state.mainTab = tab;
  state.cat = null;
  document.getElementById('tab-media').className = 'main-tab ' + (tab === 'media' ? 'active' : '');
  document.getElementById('tab-game').className = 'main-tab ' + (tab === 'game' ? 'active' : '');
  render();
}

function onSearch(val) {
  state.search = val;
  renderGrid();
}

function selectCat(catId) {
  state.cat = state.cat === catId ? null : catId;
  render();
}

function render() {
  renderCatChips();
  renderGrid();
}

function renderCatChips() {
  var container = document.getElementById('cat-chips');
  var cats = DATA.categories[state.mainTab] || [];
  var html = '<div class="cat-chip ' + (state.cat === null ? 'active' : '') + '" onclick="selectCat(null)">Tümü</div>';
  if (state.mainTab === 'media') {
    html += '<div class="cat-chip pinned ' + (state.cat === '__tracked__' ? 'active' : '') + '" onclick="selectCat(\\'__tracked__\\')">★ İzlenen / Takip</div>';
  }
  cats.forEach(function(c) {
    html += '<div class="cat-chip ' + (state.cat === c.id ? 'active' : '') + '" onclick="selectCat(\\'' + c.id + '\\')">' + c.name + '</div>';
  });
  container.innerHTML = html;
}

function renderGrid() {
  var container = document.getElementById('items-grid');
  var items = (DATA.items || []).filter(function(it) {
    if (it.mainTab !== state.mainTab) return false;
    if (state.cat === '__tracked__') {
      if (!it.watching && !it.following) return false;
    } else if (state.cat && it.cat !== state.cat) {
      return false;
    }
    if (state.search && it.title.toLowerCase().indexOf(state.search.toLowerCase()) === -1) {
      return false;
    }
    return true;
  });

  if (items.length === 0) {
    container.innerHTML = '<div class="empty">Yapım bulunamadı.</div>';
    return;
  }

  var html = items.map(function(it, idx) {
    var badges = '<span class="rating-badge">★ ' + it.rating + '</span>';
    if (it.mainTab === 'game') {
      badges += '<span class="hours-badge">' + (it.hours || 0) + 's</span>';
      if (it.achPercent !== null && it.achPercent !== undefined) {
        badges += '<span class="ach-badge">%' + it.achPercent + '</span>';
      }
    } else {
      var pins = '';
      if (it.watching) pins += '<span class="pin-icon pin-watching">▶</span>';
      if (it.following) pins += '<span class="pin-icon pin-following">★</span>';
      if (pins) badges += '<span class="pin-icons">' + pins + '</span>';
    }
    var posterContent = it.thumbnail ? '<img src="' + it.thumbnail + '" alt="' + it.title + '" />' : '<span style="font-size:12px;font-weight:600;padding:8px;">' + it.title + '</span>';
    return '<div class="card" onclick="openDetail(\\'' + it.id + '\\')">' +
      '<div class="poster">' + posterContent + badges + '</div>' +
      '<p class="caption">' + it.title + '</p>' +
    '</div>';
  }).join('');

  container.innerHTML = html;
}

function openDetail(id) {
  var it = DATA.items.find(function(i) { return i.id === id; });
  if (!it) return;
  var catObj = (DATA.categories[it.mainTab] || []).find(function(c) { return c.id === it.cat; });
  var catName = catObj ? catObj.name : it.cat;

  var extraInfo = '';
  if (it.mainTab === 'game') {
    extraInfo = '<div style="margin:8px 0;font-size:13px;color:#9ca3af;">' +
      '<div><strong>Durum:</strong> ' + (it.status || 'Belirtilmemiş') + '</div>' +
      '<div><strong>Oynanma:</strong> ' + (it.hours || 0) + ' saat</div>' +
      '<div><strong>Başarım:</strong> %' + (it.achPercent !== null && it.achPercent !== undefined ? it.achPercent : '-') + ' / ' + (it.achMax || 100) + '</div>' +
      '<div><strong>Anki:</strong> ' + (it.anki ? '✅ İşlendi' : '❌ İşlenmedi') + '</div>' +
    '</div>';
  } else {
    extraInfo = '<div style="margin:8px 0;font-size:13px;color:#9ca3af;">' +
      '<div><strong>İzleme Durumu:</strong> ' + (it.watching ? '▶ Şu an izleniyor' : 'İzlenmiyor') + '</div>' +
      '<div><strong>Takip Durumu:</strong> ' + (it.following ? '★ Takip listesinde (Yeni sezon bekleniyor)' : 'Takipte değil') + '</div>' +
      '<div><strong>Anki:</strong> ' + (it.anki ? '✅ İşlendi' : '❌ İşlenmedi') + '</div>' +
    '</div>';
  }

  var content = '<h2 style="margin:0 0 4px;font-size:18px;">' + it.title + '</h2>' +
    '<div style="font-size:12px;color:#6b7280;margin-bottom:10px;">' + (it.mainTab === 'game' ? '🎮 Oyun' : '🎬 Medya') + ' / ' + catName + (it.sub ? ' / ' + it.sub : '') + ' • ' + it.date + ' • ★ ' + it.rating + '/10</div>' +
    extraInfo +
    '<div style="margin-top:12px;padding-top:10px;border-top:1px solid #33363e;font-size:13px;line-height:1.6;color:#d1d5db;">' + (it.desc || 'Not girilmemiş.') + '</div>';

  if (it.review && it.review.trim()) {
    var formattedRevDate = it.reviewDate || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(formattedRevDate)) {
      var dParts = formattedRevDate.split('-');
      formattedRevDate = dParts[2] + '.' + dParts[1] + '.' + dParts[0];
    }
    content += '<div style="margin-top:12px;padding:12px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.25);border-left:3px solid #f59e0b;border-radius:10px;">' +
      '<div style="font-size:11px;font-weight:700;color:#fcd34d;text-transform:uppercase;margin-bottom:6px;">✍️ Kişisel İnceleme & Yorum' + (formattedRevDate ? ' <span style="color:#9ca3af;font-size:10px;font-weight:normal;float:right;">' + formattedRevDate + '</span>' : '') + '</div>' +
      '<div style="font-size:13px;line-height:1.6;color:#e2e8f0;font-style:italic;">' + it.review.trim() + '</div>' +
    '</div>';
  }

  document.getElementById('modal-content').innerHTML = content;
  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeDetail() {
  document.getElementById('modal-overlay').style.display = 'none';
}

function closeModal(e) {
  if (e.target.id === 'modal-overlay') closeDetail();
}

render();
</script>
</body>
</html>`;
}

export function downloadPhoneHtml(data: AppData): void {
  const htmlContent = generatePhoneStandaloneHtml(data);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'yapim-arsivim-telefon.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface FolderBackupItem {
  folderName: string;
  zipFileName: string;
  dateFormatted: string;
  dateTimestamp: number;
  dirHandle: FileSystemDirectoryHandle;
  fileHandle: FileSystemFileHandle;
}

export async function generateFullBackupInFolder(
  dirHandle: FileSystemDirectoryHandle,
  data: AppData
): Promise<string> {
  // 1. Ensure 'Backup' parent folder exists in the selected directory
  const backupParentDir = await dirHandle.getDirectoryHandle('Backup', { create: true });

  // 2. Direct single ZIP named Lore_TumArsiv_YYYY-MM-DD_HH-mm.zip inside Backup/
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;

  // 3. Build unified single Master ZIP
  const zipBlob = await buildUnifiedZipBlob(data);

  // 4. Save the single ZIP inside Backup/Lore_TumArsiv_<Date>.zip
  const zipFileName = `Lore_TumArsiv_${dateStr}.zip`;
  const zipHandle = await backupParentDir.getFileHandle(zipFileName, { create: true });
  const zipWritable = await (zipHandle as any).createWritable();
  await zipWritable.write(zipBlob);
  await zipWritable.close();

  return `Backup/${zipFileName}`;
}

const TR_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

function formatBackupDateLabel(dateFolderName: string): { label: string; timestamp: number } {
  // Try to parse YYYY-MM-DD_HH-mm or similar timestamps from name
  const match = dateFolderName.match(/(\d{4})[-_](\d{2})[-_](\d{2})(?:[-_](\d{2})[-_](\d{2}))?/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const hour = match[4] ? parseInt(match[4], 10) : 0;
    const min = match[5] ? parseInt(match[5], 10) : 0;

    const d = new Date(year, month, day, hour, min);
    const monthName = TR_MONTHS[month] || String(month + 1);
    const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    return {
      label: `${day} ${monthName} ${year} — ${timeStr}`,
      timestamp: d.getTime(),
    };
  }

  return {
    label: dateFolderName.replace(/_/g, ' '),
    timestamp: 0,
  };
}

/**
 * Scans the Backup/ directory in the connected root folder and returns all available backups sorted newest to oldest.
 */
export async function listFolderBackups(dirHandle: FileSystemDirectoryHandle): Promise<FolderBackupItem[]> {
  const backups: FolderBackupItem[] = [];

  try {
    let backupDir: FileSystemDirectoryHandle;
    try {
      backupDir = await dirHandle.getDirectoryHandle('Backup', { create: false });
    } catch {
      // No Backup directory exists yet
      return [];
    }

    if ((backupDir as any).values) {
      for await (const entry of (backupDir as any).values()) {
        if (entry.kind === 'directory') {
          const subDirHandle = entry as FileSystemDirectoryHandle;
          // Look for .zip files inside this subfolder
          if ((subDirHandle as any).values) {
            for await (const fileEntry of (subDirHandle as any).values()) {
              if (fileEntry.kind === 'file' && fileEntry.name.toLowerCase().endsWith('.zip')) {
                const { label, timestamp } = formatBackupDateLabel(entry.name || fileEntry.name);
                backups.push({
                  folderName: entry.name,
                  zipFileName: fileEntry.name,
                  dateFormatted: label,
                  dateTimestamp: timestamp,
                  dirHandle: subDirHandle,
                  fileHandle: fileEntry as FileSystemFileHandle,
                });
              }
            }
          }
        } else if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.zip')) {
          // Direct zip in Backup/ folder
          const { label, timestamp } = formatBackupDateLabel(entry.name);
          backups.push({
            folderName: 'Backup',
            zipFileName: entry.name,
            dateFormatted: label,
            dateTimestamp: timestamp,
            dirHandle: backupDir,
            fileHandle: entry as FileSystemFileHandle,
          });
        }
      }
    }
  } catch (err) {
    console.warn('Error listing folder backups:', err);
  }

  // Sort newest first
  backups.sort((a, b) => b.dateTimestamp - a.dateTimestamp);
  return backups;
}

/**
 * Restores all data from a selected FolderBackupItem.
 */
export async function restoreFromFolderBackup(
  backupItem: FolderBackupItem,
  rootDirHandle?: FileSystemDirectoryHandle | null
): Promise<{ appData: AppData; restoredItemCount: number }> {
  const file = await backupItem.fileHandle.getFile();
  const appData = await importAppDataFromZip(file, rootDirHandle);
  return {
    appData,
    restoredItemCount: appData.items.length,
  };
}


export function exportTierListBackup(
  mainTab: MainTabType,
  category: Category,
  allItems: ArchiveItem[]
): void {
  const catItems = allItems.filter(
    (it) => it.mainTab === mainTab && it.cat === category.id
  );

  const backupData: TierListCategoryExportData = {
    type: 'LORE_TIER_LIST_BACKUP',
    version: 1,
    exportedAt: new Date().toISOString(),
    category,
    mainTab,
    items: catItems,
  };

  const dateStr = getFormattedDateForFilename();
  const safeCatName = sanitizeFilename(category.name);
  const filename = `Lore_${safeCatName}_TierList_${dateStr}.json`;

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseTierListBackupFile(file: File): Promise<TierListCategoryExportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text);

        if (
          json &&
          json.type === 'LORE_TIER_LIST_BACKUP' &&
          json.category &&
          json.category.id &&
          Array.isArray(json.category.tierRows) &&
          Array.isArray(json.items)
        ) {
          resolve(json as TierListCategoryExportData);
          return;
        }

        // Backward/Alternative support: If someone exported category object directly or appData
        if (json && json.tierRows && Array.isArray(json.tierRows) && json.id) {
          resolve({
            type: 'LORE_TIER_LIST_BACKUP',
            version: 1,
            exportedAt: new Date().toISOString(),
            category: json as Category,
            mainTab: json.mainTab || 'media',
            items: json.items || [],
          });
          return;
        }

        throw new Error('Geçersiz Tier List yedek dosyası formatı.');
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsText(file);
  });
}
