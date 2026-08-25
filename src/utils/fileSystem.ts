import { AppData, ArchiveItem, Category, MainTabType, TierListCategoryExportData } from '../types';
import { INITIAL_DATA } from '../data/initialData';
import JSZip from 'jszip';
import { renderTierListToPngBlob } from './tierImageExport';

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

// --- IndexedDB Helper ---
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
      if (!db.objectStoreNames.contains(APP_DATA_STORE)) {
        db.createObjectStore(APP_DATA_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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
          resolve(req.result as AppData);
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

// --- Load / Save Data from File System ---

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
        if (!item.thumbnail && item.thumbnailFileName) {
          try {
            const fileName = item.thumbnailFileName.replace(/^images\//, '');
            const imgHandle = await imagesDir.getFileHandle(fileName);
            const imgFile = await imgHandle.getFile();
            const base64 = await readFileAsBase64(imgFile);
            item.thumbnail = base64;
          } catch {
            // Ignore missing images
          }
        }
      }
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
    // 1. Ensure images folder exists and save each base64 image as a physical file
    let imagesDir: FileSystemDirectoryHandle | null = null;
    try {
      imagesDir = await dirHandle.getDirectoryHandle('images', { create: true });
    } catch (e) {
      console.warn('Could not create images directory:', e);
    }

    const cleanItems: ArchiveItem[] = [];

    for (const item of data.items) {
      const itemCopy = { ...item };
      if (item.thumbnail && item.thumbnail.startsWith('data:image/') && imagesDir) {
        try {
          const mimeMatch = item.thumbnail.match(/data:image\/([a-zA-Z0-9]+);/);
          const ext = mimeMatch ? (mimeMatch[1] === 'jpeg' ? 'jpg' : mimeMatch[1]) : 'jpg';
          const imgName = `${item.id}.${ext}`;
          const blob = dataURLtoBlob(item.thumbnail);

          const imgHandle = await imagesDir.getFileHandle(imgName, { create: true });
          const imgWritable = await (imgHandle as any).createWritable();
          await imgWritable.write(blob);
          await imgWritable.close();

          itemCopy.thumbnailFileName = `images/${imgName}`;
        } catch (imgErr) {
          console.warn(`Could not write image for ${item.id}:`, imgErr);
        }
      }
      cleanItems.push(itemCopy);
    }

    // 2. Write the JSON file
    const fileHandle = await dirHandle.getFileHandle(DATA_FILE_NAME, { create: true });
    const writable = await (fileHandle as any).createWritable();
    const dataToWrite: AppData = {
      ...data,
      items: cleanItems,
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
    const fileHandle = await imagesDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return `images/${fileName}`;
  } catch (err) {
    console.error('Error saving image to folder:', err);
    throw err;
  }
}

/**
 * Scans the local `images/` directory in the connected folder and deletes any image
 * file that does not belong to any active item in `items`.
 * Returns the count and names of cleaned files.
 */
export async function cleanOrphanImagesInFolder(
  dirHandle: FileSystemDirectoryHandle,
  items: ArchiveItem[]
): Promise<{ cleanedCount: number; deletedFiles: string[] }> {
  try {
    let imagesDir: FileSystemDirectoryHandle | null = null;
    try {
      imagesDir = await dirHandle.getDirectoryHandle('images', { create: false });
    } catch {
      return { cleanedCount: 0, deletedFiles: [] };
    }

    if (!imagesDir) return { cleanedCount: 0, deletedFiles: [] };

    // Build set of all active referenced file names
    const activeFileNames = new Set<string>();
    for (const item of items) {
      if (item.thumbnailFileName) {
        activeFileNames.add(item.thumbnailFileName.replace(/^images\//, ''));
      }
      activeFileNames.add(`${item.id}.jpg`);
      activeFileNames.add(`${item.id}.jpeg`);
      activeFileNames.add(`${item.id}.png`);
      activeFileNames.add(`${item.id}.webp`);
    }

    const deletedFiles: string[] = [];

    // Safely iterate directory entries
    if ((imagesDir as any).values) {
      for await (const entry of (imagesDir as any).values()) {
        if (entry.kind === 'file') {
          const name = entry.name;
          if (!activeFileNames.has(name)) {
            try {
              await (imagesDir as any).removeEntry(name);
              deletedFiles.push(name);
            } catch (delErr) {
              console.warn(`Could not remove orphan image ${name}:`, delErr);
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
 * Deletes the specific image file(s) for a deleted item from the local images/ folder.
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
      const fileName = thumbnailFileName.replace(/^images\//, '');
      try {
        await (imagesDir as any).removeEntry(fileName);
      } catch {}
    }

    if (itemId) {
      const extensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'];
      for (const ext of extensions) {
        try {
          await (imagesDir as any).removeEntry(`${itemId}.${ext}`);
        } catch {}
      }

      // Check directory entries starting with itemId (e.g. media_1787582297875_4ioms.webp)
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

// --- Local Storage Fallback & Migration ---

export function loadDataFromLocalStorage(): AppData {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.categories && parsed.items) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load from localStorage:', err);
  }
  return INITIAL_DATA;
}

export function saveDataToLocalStorage(data: AppData): void {
  try {
    // Attempt local storage save (small data)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    // Quota exceeded, safe to ignore because IndexedDB holds full data
    console.info('LocalStorage quota exceeded; safely handled by IndexedDB.');
  }
  // Always persist in IndexedDB for unlimited custom images
  saveDataToIndexedDB(data);
}

// --- Export / Import JSON File ---

export function downloadJsonFile(data: AppData, filename = 'yapim-arsivim-data.json'): void {
  const jsonStr = JSON.stringify(data, null, 2);
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
            id: it.id || `item_${Date.now()}_${index}`,
            mainTab: it.mainTab === 'game' ? 'game' : 'media',
            cat: it.cat || '',
            sub: it.sub || null,
            title: it.title || 'İsimsiz Yapım',
            rating: typeof it.rating === 'number' ? it.rating : 0,
            date: it.date || it.watchDate || '',
            desc: it.desc || it.notes || '',
            thumbnail: it.thumbnail || '',
            thumbnailFileName: it.thumbnailFileName || undefined,
            tier: it.tier || null,
            following: it.following ?? false,
            watching: it.watching ?? false,
            dropped: it.dropped ?? false,
            status: it.status || undefined,
            achPercent: it.achPercent !== undefined ? it.achPercent : null,
            achMax: it.achMax || undefined,
            hours: it.hours || undefined,
            firm: Array.isArray(it.firm) ? it.firm : undefined,
            director: Array.isArray(it.director) ? it.director : undefined,
            actors: Array.isArray(it.actors) ? it.actors : undefined,
            developer: Array.isArray(it.developer) ? it.developer : undefined,
            genre: Array.isArray(it.genre) ? it.genre : undefined,
            anki: it.anki ?? false,
            createdAt: it.createdAt || Date.now(),
            updatedAt: it.updatedAt || Date.now(),
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
            id: it.id || `item_${Date.now()}_${index}`,
            mainTab: it.mainTab === 'game' ? 'game' : 'media',
            cat: it.cat || '',
            sub: it.sub || null,
            title: it.title || 'İsimsiz Yapım',
            rating: typeof it.rating === 'number' ? it.rating : 0,
            date: it.date || it.watchDate || '',
            desc: it.desc || it.notes || '',
            thumbnail: it.thumbnail || '',
            thumbnailFileName: it.thumbnailFileName || undefined,
            tier: it.tier || null,
            following: it.following ?? false,
            watching: it.watching ?? false,
            dropped: it.dropped ?? false,
            status: it.status || undefined,
            achPercent: it.achPercent !== undefined ? it.achPercent : null,
            achMax: it.achMax || undefined,
            hours: it.hours || undefined,
            firm: Array.isArray(it.firm) ? it.firm : undefined,
            director: Array.isArray(it.director) ? it.director : undefined,
            actors: Array.isArray(it.actors) ? it.actors : undefined,
            developer: Array.isArray(it.developer) ? it.developer : undefined,
            genre: Array.isArray(it.genre) ? it.genre : undefined,
            anki: it.anki ?? false,
            createdAt: it.createdAt || Date.now(),
            updatedAt: it.updatedAt || Date.now(),
          }));

          const hasCategories = json.categories && typeof json.categories === 'object';
          const categories = hasCategories
            ? json.categories
            : existingAppData?.categories || INITIAL_DATA.categories;

          return resolve({
            appData: {
              version: json.version || existingAppData?.version || 1,
              lastUpdated: new Date().toISOString(),
              categories,
              items: sanitizedItems,
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
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Builds a single, self-contained ZIP archive containing:
 * - yapim-arsivim-data.json (Database, categories, items)
 * - images/ (All cover posters)
 * - tier_lists/ (Tier List JSON and high-res PNG posters for all categories)
 */
export async function buildUnifiedZipBlob(data: AppData): Promise<Blob> {
  const zip = new JSZip();
  const imgFolder = zip.folder('images');
  const tierFolder = zip.folder('tier_lists');

  // 1. Process items and pack image files
  const cleanItems: ArchiveItem[] = [];
  const seenIds = new Set<string>();

  for (const item of data.items) {
    if (!item.id || seenIds.has(item.id)) continue;
    seenIds.add(item.id);

    const itemCopy = { ...item };
    if (item.thumbnail && item.thumbnail.startsWith('data:image/')) {
      try {
        const mimeMatch = item.thumbnail.match(/data:image\/([a-zA-Z0-9]+);/);
        const ext = mimeMatch ? (mimeMatch[1] === 'jpeg' ? 'jpg' : mimeMatch[1]) : 'jpg';
        const imgName = `${item.id}.${ext}`;
        const blob = dataURLtoBlob(item.thumbnail);
        if (imgFolder) {
          imgFolder.file(imgName, blob);
        }
        itemCopy.thumbnailFileName = `images/${imgName}`;
      } catch (e) {
        console.warn('Image zip export error:', e);
      }
    }
    cleanItems.push(itemCopy);
  }

  const exportData: AppData = {
    ...data,
    items: cleanItems,
  };
  zip.file(DATA_FILE_NAME, JSON.stringify(exportData, null, 2));

  // 2. Generate Tier Lists JSON & PNGs for all categories
  const allTabs: MainTabType[] = ['media', 'game'];
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
        const jsonFileName = `${tab}_${safeName}_TierList.json`;
        const pngFileName = `${tab}_${safeName}_TierList.png`;

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

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

// --- ZIP Backup / Restore (Unified Single-ZIP Format) ---

export async function exportAppDataToZip(data: AppData, filename?: string): Promise<void> {
  const actualFilename = filename || `Lore_Yedek_${getFormattedDateForFilename()}.zip`;
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
  const zip = await JSZip.loadAsync(fileOrBlob);

  // 1. Find database json file
  let jsonFile = zip.file(DATA_FILE_NAME);
  if (!jsonFile) {
    const jsonFiles = zip.file(/\.json$/i);
    // Find json that is not inside tier_lists/
    const rootOrMainJsons = jsonFiles.filter((f) => !f.name.startsWith('tier_lists/'));
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

  // 2. Read images in zip and optionally write to rootDirHandle
  const imageFiles = zip.file(/^images\/.+/i);
  const imageMap = new Map<string, string>();

  let localImagesDirHandle: any = null;
  if (rootDirHandle) {
    try {
      localImagesDirHandle = await getOrCreateImagesDirectory(rootDirHandle);
    } catch (e) {
      console.warn('Could not access images directory for disk extraction:', e);
    }
  }

  for (const imgZip of imageFiles) {
    if (imgZip.dir) continue;
    try {
      const baseFilename = imgZip.name.replace(/^images\//i, '');
      const ext = baseFilename.split('.').pop()?.toLowerCase() || 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const blob = await imgZip.async('blob');
      const base64 = await imgZip.async('base64');
      const dataUrl = `data:${mime};base64,${base64}`;

      imageMap.set(imgZip.name.toLowerCase(), dataUrl);
      imageMap.set(baseFilename.toLowerCase(), dataUrl);

      // Save directly to disk if connected
      if (localImagesDirHandle) {
        try {
          const fh = await localImagesDirHandle.getFileHandle(baseFilename, { create: true });
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
  const rootImages = zip.file(/\.(jpe?g|png|webp)$/i);
  for (const imgZip of rootImages) {
    if (!imgZip.name.startsWith('images/') && !imgZip.name.startsWith('tier_lists/')) {
      try {
        const ext = imgZip.name.split('.').pop()?.toLowerCase() || 'jpg';
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        const base64 = await imgZip.async('base64');
        const dataUrl = `data:${mime};base64,${base64}`;
        imageMap.set(imgZip.name.toLowerCase(), dataUrl);
      } catch (e) {}
    }
  }

  // 3. Deduplicate items & attach thumbnails back to items
  const uniqueItemsMap = new Map<string, ArchiveItem>();

  for (const rawItem of rawAppData.items) {
    if (!rawItem.id) continue;
    const item: ArchiveItem = { ...rawItem };

    if (!item.thumbnail || !item.thumbnail.startsWith('data:image/')) {
      if (item.thumbnailFileName) {
        const match =
          imageMap.get(item.thumbnailFileName.toLowerCase()) ||
          imageMap.get(item.thumbnailFileName.replace(/^images\//i, '').toLowerCase());
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

    uniqueItemsMap.set(item.id, item);
  }

  const appData: AppData = {
    ...rawAppData,
    items: Array.from(uniqueItemsMap.values()),
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
<meta name="apple-mobile-web-app-title" content="Yapım Arşivim">
<meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#141416">
<meta name="application-name" content="Yapım Arşivim">
<meta name="msapplication-navbutton-color" content="#141416">
<title>Yapım Arşivim</title>
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
  <div class="app-title">🎬 Yapım Arşivim <span class="badge-offline">Mobil</span></div>
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

  // 2. Create date-named subfolder: YYYY-MM-DD_HH-mm (e.g. 2026-08-25_16-45)
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const backupFolderName = dateStr;
  const targetBackupDir = await backupParentDir.getDirectoryHandle(backupFolderName, { create: true });

  // 3. Build unified single ZIP (Database + Images + Tier Lists JSON & PNGs)
  const zipBlob = await buildUnifiedZipBlob(data);

  // 4. Save the single ZIP inside Backup/<Date_Folder>/Lore_Yedek_<Date>.zip
  const zipFileName = `Lore_Yedek_${dateStr}.zip`;
  const zipHandle = await targetBackupDir.getFileHandle(zipFileName, { create: true });
  const zipWritable = await (zipHandle as any).createWritable();
  await zipWritable.write(zipBlob);
  await zipWritable.close();

  return `Backup/${backupFolderName}/${zipFileName}`;
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
