// Hata Kaydı: beklenmeyen hatalar tarayıcı deposunda tutulur.
// PC'de bağlı kütüphane klasörüne hatalar.log olarak da yazılır (GitHub'a gitmez);
// telefonda Ayarlar ➔ Gelişmiş Seçenekler'den dışa aktarılır.

declare const __BUILD_TIME__: string;

// Derleme zamanı (Türkiye saati, ör. "03.11-21:40"), vite.config.ts'te üretilir
export const BUILD_TIME: string = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';

const STORAGE_KEY = 'lore_hata_kaydi';
const MAX_CHARS = 300_000; // ~300 KB; dolunca eski yarısı atılır
const LOG_FILE_NAME = 'hatalar.log';

let folderHandle: FileSystemDirectoryHandle | null = null;

// Kütüphane klasörü bağlıysa (PC) kayıt dosyaya gider; bağlı değilse (telefon) dışa aktar düğmesi gösterilir
export const hasLogFolder = (): boolean => folderHandle !== null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let lastKey = '';
let lastTime = 0;

const pad = (n: number) => String(n).padStart(2, '0');

function stamp(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function readLog(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function writeLog(text: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, text);
  } catch {
    // Depo doluysa kayıt tutulamaz; burada hata üretmek döngüye sokar
  }
}

function describe(err: unknown): string {
  if (err instanceof Error) {
    const stack = err.stack
      ? err.stack.split('\n').slice(1, 4).map((s) => s.trim()).join(' | ')
      : '';
    return stack ? `${err.name}: ${err.message} @ ${stack}` : `${err.name}: ${err.message}`;
  }
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function logError(where: string, err: unknown): void {
  const message = describe(err).replace(/\s+/g, ' ').slice(0, 1000);

  // Aynı hata art arda yağıyorsa (döngü) kaydı doldurmasın
  const key = where + message;
  const now = Date.now();
  if (key === lastKey && now - lastTime < 5000) return;
  lastKey = key;
  lastTime = now;

  let text = readLog() + `${stamp()} · ${BUILD_TIME || 'dev'} · ${where} · ${message}\n`;
  if (text.length > MAX_CHARS) {
    text = text.slice(text.length - Math.floor(MAX_CHARS / 2));
    text = text.slice(text.indexOf('\n') + 1);
  }
  writeLog(text);
  scheduleFlush();
}

function scheduleFlush(): void {
  if (!folderHandle) return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void flushToFolder();
  }, 2000);
}

async function flushToFolder(): Promise<void> {
  flushTimer = null;
  const handle = folderHandle;
  if (!handle) return;
  try {
    const fileHandle = await handle.getFileHandle(LOG_FILE_NAME, { create: true });
    const writable = await (fileHandle as any).createWritable();
    await writable.write(readLog());
    await writable.close();
  } catch {
    // Dosyaya yazılamazsa kayıt depoda kalır; burada hata üretmek döngüye sokar
  }
}

// PC'de klasör bağlanınca çağrılır; kayıt dosyası o an yazılır (boşsa boş dosya)
export function setErrorLogFolder(handle: FileSystemDirectoryHandle | null): void {
  folderHandle = handle;
  scheduleFlush();
}

export function installGlobalErrorHandlers(): void {
  window.addEventListener('error', (e) => logError('genel', e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => logError('promise', e.reason));
}

export async function exportErrorLog(): Promise<void> {
  const d = new Date();
  const header = `Lore hata kaydı · derleme ${BUILD_TIME || 'dev'} · dışa aktarma ${stamp(d)} · ${navigator.userAgent}\n\n`;
  const name = `lore-hatalar-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.txt`;
  const file = new File([header + (readLog() || '(kayıt boş)\n')], name, { type: 'text/plain' });

  // Telefonda paylaş menüsü (LocalSend vb.); olmazsa dosya olarak indir
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Lore hata kaydı' });
      return;
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
