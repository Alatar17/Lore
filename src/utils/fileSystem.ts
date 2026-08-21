import { AppData, ArchiveItem } from '../types';
import { INITIAL_DATA } from '../data/initialData';

const LOCAL_STORAGE_KEY = 'yapim_arsivim_app_data_v2';
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

// --- Load / Save Data from File System ---

export async function readDataFromFolder(dirHandle: FileSystemDirectoryHandle): Promise<AppData | null> {
  try {
    const fileHandle = await dirHandle.getFileHandle(DATA_FILE_NAME, { create: false });
    const file = await fileHandle.getFile();
    const text = await file.text();
    const json = JSON.parse(text) as AppData;
    return json;
  } catch (err: any) {
    if (err.name === 'NotFoundError') {
      // File doesn't exist yet in the selected folder
      return null;
    }
    console.error('Error reading data from folder:', err);
    throw err;
  }
}

export async function writeDataToFolder(dirHandle: FileSystemDirectoryHandle, data: AppData): Promise<void> {
  try {
    const fileHandle = await dirHandle.getFileHandle(DATA_FILE_NAME, { create: true });
    const writable = await fileHandle.createWritable();
    const content = JSON.stringify(data, null, 2);
    await writable.write(content);
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

export function parseUploadedJson(file: File): Promise<AppData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text);
        if (!json.categories || !json.items) {
          throw new Error('Geçersiz Yapım Arşivim veri dosyası.');
        }
        resolve(json as AppData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsText(file);
  });
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
