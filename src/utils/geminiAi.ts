import { GoogleGenAI, Type } from '@google/genai';
import { AiRecommendationCard } from '../types';

export const GEMINI_API_KEY_STORAGE_KEY = 'lore_gemini_api_key';

export function getGeminiApiKey(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) ||
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    ''
  );
}

export function setGeminiApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  if (!trimmed) {
    localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
  } else {
    localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, trimmed);
  }
}

export const GEMINI_CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

// Helper to prevent getting stuck indefinitely when a model queue is congested
async function callWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  modelName: string
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `"${modelName}" Google sunucularında ${ms / 1000} saniye içinde yanıt vermedi (Yüksek yoğunluk / zaman aşımı).`
        )
      );
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

export async function testGeminiApiKey(apiKey: string): Promise<{ success: boolean; message: string; usedModel?: string }> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { success: false, message: 'Lütfen geçerli bir API anahtarı girin.' };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: trimmed });
    let lastError: unknown = null;

    for (const model of GEMINI_CANDIDATE_MODELS) {
      try {
        const response = await callWithTimeout(
          ai.models.generateContent({
            model,
            contents: 'Ping: Yanıt olarak yalnızca "PONG" yaz.',
          }),
          7000,
          model
        );
        if (response && response.text) {
          return {
            success: true,
            message: `Bağlantı Başarılı! Model aktif: ${model}`,
            usedModel: model,
          };
        }
      } catch (err: unknown) {
        lastError = err;
      }
    }

    if (lastError) {
      const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
      if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid') || errMsg.includes('400')) {
        return { success: false, message: 'Geçersiz API Anahtarı! Lütfen Google AI Studio anahtarınızı kontrol edin.' };
      }
      if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
        return { success: false, message: 'API kotası aşıldı (Rate limit). Lütfen biraz bekleyip tekrar deneyin.' };
      }
      if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('zaman aşımı')) {
        return { success: false, message: 'Google sunucularında aşırı yoğunluk var (503). Lütfen birkaç saniye sonra tekrar deneyin.' };
      }
      return { success: false, message: `Bağlantı hatası: ${errMsg.slice(0, 120)}` };
    }
    return { success: false, message: 'Modelden yanıt alınamadı. Anahtarınızı kontrol edin.' };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Bağlantı hatası: ${errMsg.slice(0, 120)}` };
  }
}

export interface AiLogEntry {
  id: string;
  time: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: string;
}

export interface AiItemMetadata {
  releaseYear?: string | number;
  genres?: string[];
  firms?: string[];
  directors?: string[];
  developers?: string[];
  actors?: string[];
  authors?: string[];
  publishers?: string[];
  translators?: string[];
  characters?: Array<{ name: string; actor?: string }>;
  description?: string;
}

export interface FetchAiMetadataParams {
  title: string;
  categoryName?: string;
  isGame?: boolean;
  isBook?: boolean;
  posterBase64?: string;
  existingGenres?: string[];
  existingFirms?: string[];
  existingDirectors?: string[];
  existingActors?: string[];
  existingDevelopers?: string[];
  existingAuthors?: string[];
  existingPublishers?: string[];
  existingTranslators?: string[];
  onProgress?: (statusText: string, logEntry: AiLogEntry) => void;
}

export interface FetchAiMetadataResult {
  success: boolean;
  data?: AiItemMetadata;
  error?: string;
  usedModel?: string;
  logs: AiLogEntry[];
}

function parseBase64Image(dataUrl: string): { mimeType: string; data: string } | null {
  if (!dataUrl) return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;
  return {
    mimeType: match[1],
    data: match[2],
  };
}

// --- Etiket havuzuyla hizalama ---
// Yapay zekânın yazdığı adı, havuzdaki yazılışa çevirir ("Bilimkurgu" → "Bilim Kurgu").
// Boşluk, tire, nokta, virgül, büyük/küçük harf ve Türkçe harf işaretleri farkı yok sayılır.
const NEW_TAG_LIMIT = 3;

function tagKey(value: string): string {
  return value
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[\s\-_.,'’`·:;/]+/g, '');
}

// Kişi adlarında sıra farkı da yok sayılır ("Kamiya Hiroshi" = "Hiroshi Kamiya").
function personKey(value: string): string {
  return value
    .split(/[\s\-_.,]+/)
    .map(tagKey)
    .filter(Boolean)
    .sort()
    .join('|');
}

function toCleanStringList(value: unknown): string[] {
  const raw: unknown[] = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  return raw
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim().replace(/^[,;.\s]+|[,;.\s]+$/g, ''))
    .filter((v) => v.length > 0);
}

function buildPoolMatcher(pool: string[], isPerson: boolean): (value: string) => string | undefined {
  const byKey = new Map<string, string>();
  const byPersonKey = new Map<string, string>();
  for (const entry of pool) {
    const clean = entry.trim();
    if (!clean) continue;
    const k = tagKey(clean);
    if (k && !byKey.has(k)) byKey.set(k, clean);
    if (isPerson) {
      const pk = personKey(clean);
      if (pk && !byPersonKey.has(pk)) byPersonKey.set(pk, clean);
    }
  }
  return (value: string) =>
    byKey.get(tagKey(value)) || (isPerson ? byPersonKey.get(personKey(value)) : undefined);
}

// Havuz listelerini tekrarsız birleştirir (kütüphane havuzu + formdaki mevcut değerler).
export function mergeTagPools(...lists: Array<Array<string | undefined> | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const list of lists) {
    for (const entry of list || []) {
      const clean = typeof entry === 'string' ? entry.trim() : '';
      if (!clean || seen.has(clean)) continue;
      seen.add(clean);
      result.push(clean);
    }
  }
  return result;
}

// Medya ve oyunlardaki oyuncu/seslendirme adları (kitap rolleri hariç).
export function collectActorPool(
  items: Array<{ mainTab?: string; actors?: string[]; characters?: Array<{ actor?: string }> }>
): string[] {
  const names: string[] = [];
  for (const it of items) {
    if (it.mainTab === 'book') continue;
    it.actors?.forEach((a) => names.push(a));
    it.characters?.forEach((c) => c.actor && names.push(c.actor));
  }
  return mergeTagPools(names);
}

export function alignTagsToPool(
  value: unknown,
  pool: string[],
  options: { isPerson?: boolean; limitNew?: number } = {}
): string[] {
  const match = buildPoolMatcher(pool, Boolean(options.isPerson));
  const result: string[] = [];
  const seen = new Set<string>();
  let newCount = 0;
  for (const item of toCleanStringList(value)) {
    const fromPool = match(item);
    const finalValue = fromPool || item;
    const k = tagKey(finalValue);
    if (!k || seen.has(k)) continue;
    if (!fromPool && options.limitNew !== undefined) {
      if (newCount >= options.limitNew) continue;
      newCount++;
    }
    seen.add(k);
    result.push(finalValue);
  }
  return result;
}

function alignCharacters(
  value: unknown,
  actorPool: string[]
): Array<{ name: string; actor?: string }> {
  if (!Array.isArray(value)) return [];
  const matchActor = buildPoolMatcher(actorPool, true);
  const result: Array<{ name: string; actor?: string }> = [];
  const seen = new Set<string>();
  for (const c of value) {
    if (!c || typeof c !== 'object') continue;
    const name = typeof (c as any).name === 'string' ? (c as any).name.trim() : '';
    if (!name || seen.has(tagKey(name))) continue;
    seen.add(tagKey(name));
    const rawActor = typeof (c as any).actor === 'string' ? (c as any).actor.trim() : '';
    const actor = rawActor ? matchActor(rawActor) || rawActor : '';
    result.push(actor ? { name, actor } : { name });
  }
  return result;
}

function getCurrentTimeStr(): string {
  const now = new Date();
  return now.toTimeString().split(' ')[0] || now.toLocaleTimeString();
}

export async function fetchAiMetadata(
  params: FetchAiMetadataParams
): Promise<FetchAiMetadataResult> {
  const logs: AiLogEntry[] = [];

  const addLog = (
    level: 'info' | 'warn' | 'error' | 'success',
    message: string,
    details?: string,
    statusText?: string
  ): AiLogEntry => {
    const entry: AiLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      time: getCurrentTimeStr(),
      level,
      message,
      details,
    };
    logs.push(entry);
    if (params.onProgress) {
      params.onProgress(statusText || message, entry);
    }
    return entry;
  };

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    const errorMsg = 'Gemini API anahtarı bulunamadı. Lütfen Ayarlar > Veri & Dosya Sistemi > Gelişmiş Seçenekler altından API anahtarınızı kaydedin.';
    addLog('error', 'API anahtarı eksik.', errorMsg);
    return {
      success: false,
      error: errorMsg,
      logs,
    };
  }

  const {
    title,
    categoryName = '',
    isGame = false,
    isBook = false,
    posterBase64,
    existingGenres = [],
    existingFirms = [],
    existingDirectors = [],
    existingActors = [],
    existingDevelopers = [],
    existingAuthors = [],
    existingPublishers = [],
    existingTranslators = [],
  } = params;

  if (!title.trim() && !posterBase64) {
    const errorMsg = 'Lütfen en azından bir yapım/kitap başlığı girin veya bir afiş/kapak resmi yükleyin.';
    addLog('error', 'Başlık veya görsel girilmedi.', errorMsg);
    return {
      success: false,
      error: errorMsg,
      logs,
    };
  }

  const itemKindLabel = isBook ? 'Kitap' : isGame ? 'Oyun' : categoryName || 'Medya';

  addLog(
    'info',
    `İşlem başlatıldı: "${title.trim() || 'Afişten/Kapak resminden analiz edilecek'}" (${itemKindLabel})`,
    undefined,
    'İşlem başlatılıyor...'
  );

  try {
    const ai = new GoogleGenAI({ apiKey });

    let promptText = '';

    if (isBook) {
      promptText = `
Sen dünya ve Türk edebiyatı, romanlar, kurgu ve kurgu dışı kitaplar konusunda derinlemesine bilgiye sahip uzman bir kitap editörü ve edebiyat eleştirmenisin.
Görevin: Verilen kitap hakkında en güncel, doğrulanmış ve tutarlı bilgileri eksiksiz bir JSON nesnesi olarak döndürmektir.

Kullanıcı Bilgileri:
- Başlık: "${title.trim() || 'Kapak resminden tespit et'}"
- Kategori Türü: "Kitap / Edebiyat (${categoryName || 'Kitap'})"
${existingGenres.length > 0 ? `- Kullanıcının Mevcut Tür/Etiket Havuzu: [${existingGenres.join(', ')}]` : ''}
${existingAuthors.length > 0 ? `- Kullanıcının Mevcut Yazar Havuzu: [${existingAuthors.join(', ')}]` : ''}
${existingPublishers.length > 0 ? `- Kullanıcının Mevcut Yayınevi Havuzu: [${existingPublishers.join(', ')}]` : ''}
${existingTranslators.length > 0 ? `- Kullanıcının Mevcut Çevirmen Havuzu: [${existingTranslators.join(', ')}]` : ''}

HAVUZ KURALI (tüm etiket alanları için): Önce kullanıcının mevcut havuzundan seç ve havuzdaki yazılışı harfi harfine aynen kullan (boşluk, tire, büyük/küçük harf, isim sırası dahil). Havuzdaki bir etiketin eş anlamlısını veya farklı yazılışını yeni etiket olarak üretme. Yeni değer sadece havuzda karşılığı gerçekten yoksa eklenir.

Kurallar:
1. "releaseYear": Kitabın ilk orijinal basım/yayın yılı (örn: 1866 veya 1949). Tek bir yıl ise sayı (örn: 1866). Seri ise "YYYY-YYYY" string.
2. "genres": En fazla 2-4 adet en uygun kitap türü veya edebi teması (örn: ["Dünya Klasikleri", "Psikolojik Roman", "Felsefe"]). Havuzda olmayan yeni tür en fazla ${NEW_TAG_LIMIT} adet olabilir.
3. "authors": Kitabın yazar(lar)ı (dizi olarak, örn: ["Fyodor Dostoyevski"]). Yazar havuzdaysa havuzdaki yazılışı kullan.
4. "publishers": Türkiye'de bu kitabın en bilinen/yaygın yayınevi veya orijinal yayıncısı (dizi olarak, örn: ["İş Bankası Kültür Yayınları", "Can Yayınları", "İthaki Yayınları"]). Havuzda olmayan yeni yayınevi en fazla ${NEW_TAG_LIMIT} adet olabilir.
5. "translators": Varsa en popüler Türkçe çevirmen(ler)i (örn: ["Mazlum Beyhan"]). Türk edebiyatı ise veya çevirmeni yoksa boş dizi [] bırak. Çevirmen havuzdaysa havuzdaki yazılışı kullan.
6. "characters": Kitaptaki en önemli ana ve olay örgüsünü taşıyan kilit yan karakterler (en fazla 12 adet, eserin derinliğine ve kapsamına göre; zorla 12'ye tamamlama veya önemsiz figüranları ekleme). Her karakter için: "name" (Karakterin adı) ve "actor" alanına karakterin romandaki öz rolü/kimliği (EN FAZLA 2-4 KELİME, kısa ve öz; örn: "Eski Hukuk Öğrencisi", "Özel Dedektif", "Müfettiş", "Bakanlık Memuru", "Köy Muhtarı", "Ağabeyi"). Asla uzun cümle veya paragraf yazma, sadece kısa unvan/rol yaz.
7. "description": KİTAP EDEBİ VE FELSEFİ HAFIZA ÖZETİ:
   - Kitabın edebi derinliğini, karakterin iç dünyasını ve eserin felsefi/tematik özünü detaylıca aktaran kapsamlı bir kütüphane özeti yaz (Aralarında çift satır sonu \n\n olan 2 ya da 3 ayrı paragraf, toplam 120-180 kelime).
   - 1. Paragraf (Karakter & Dünya): Karakter kimdir, hangi toplumda/dönemde yaşar ve hayatını değiştiren ilk karar/olay nedir?
   - 2. Paragraf (Çatışma & Olay Örgüsü): Karşılaştığı ana ahlaki, felsefi veya toplumsal çatışma nedir, olaylar nasıl gelişir?
   - 3. Paragraf (Ana Fikir & İz): Eserin vardığı nihai nokta, işlediği ana fikir ve okuyucuda bıraktığı düşünsel/edebi miras.
   - SPOILER KURALI: Bu kitap kullanıcının kütüphanesindedir; dolayısıyla yapay bir spoiler kısıtlaması uygulama. Eserin düşünsel sonucunu, ana düğümünü ve gidişatını açıkça aktar.
   - BOŞ ÖVGÜ YASAĞI: "Büyüleyici bir başyapıt", "muhteşem bir klasik" gibi eleştirmen övgüleri yasaktır; sadece fikirler, olay örgüsü ve karakter konuşur.
8. KESİNLİKLE DOLDURULMAYACAK ALANLAR: Sayfa sayısı, alıntılar/sözler, seri adı veya okuma durumunu KESİNLİKLE JSON'a ekleme.

Çıktıyı YALNIZCA aşağıdaki JSON şemasına uygun olarak üret:
{
  "releaseYear": 1866,
  "genres": ["Dünya Klasikleri", "Psikolojik Roman"],
  "authors": ["Fyodor Dostoyevski"],
  "publishers": ["İş Bankası Kültür Yayınları"],
  "translators": ["Mazlum Beyhan"],
  "characters": [
    { "name": "Rodion Romanoviç Raskolnikov", "actor": "Eski Hukuk Öğrencisi" },
    { "name": "Sonya Marmeladova", "actor": "Marmeladov'un Kızı" }
  ],
  "description": "1. Paragraf: Karakter ve dünya düzeni...\\n\\n2. Paragraf: Ana çatışma ve ahlaki bedel...\\n\\n3. Paragraf: Felsefi atmosfer ve bırakılan iz..."
}
`;
    } else {
      promptText = `
Sen bir medya, sinema, dizi, anime, animasyon ve video oyunu uzmanısın.
Görevin: Verilen yapım hakkında en güncel, doğrulanmış ve tutarlı bilgileri eksiksiz bir JSON nesnesi olarak döndürmektir.

Kullanıcı Bilgileri:
- Başlık: "${title.trim() || 'Afişten tespit et'}"
- Kategori Türü: "${isGame ? 'Video Oyunu (Game)' : `Medya (${categoryName || 'Film/Dizi/Anime'})`}"
${existingGenres.length > 0 ? `- Kullanıcının Mevcut Tür/Etiket Havuzu: [${existingGenres.join(', ')}]` : ''}
${!isGame && existingFirms.length > 0 ? `- Kullanıcının Mevcut Stüdyo/Şirket Havuzu: [${existingFirms.join(', ')}]` : ''}
${!isGame && existingDirectors.length > 0 ? `- Kullanıcının Mevcut Yönetmen Havuzu: [${existingDirectors.join(', ')}]` : ''}
${existingActors.length > 0 ? `- Kullanıcının Mevcut Oyuncu/Seslendirme Havuzu: [${existingActors.join(', ')}]` : ''}
${isGame && existingDevelopers.length > 0 ? `- Kullanıcının Mevcut Geliştirici Havuzu: [${existingDevelopers.join(', ')}]` : ''}

HAVUZ KURALI (tüm etiket alanları ve karakterlerin "actor" alanı için): Önce kullanıcının mevcut havuzundan seç ve havuzdaki yazılışı harfi harfine aynen kullan (boşluk, tire, büyük/küçük harf, isim sırası dahil). Havuzdaki bir etiketin eş anlamlısını veya farklı yazılışını yeni etiket olarak üretme. Yeni değer sadece havuzda karşılığı gerçekten yoksa eklenir.

Kurallar:
1. "releaseYear": Tek bir yıl ise sayı (örn: 2022), dizi veya seri gibi yıllara yayılıyorsa "YYYY-YYYY" veya "YYYY-" aralık formatında string (örn: "2008-2013").
2. "genres": En fazla 3-5 adet en uygun tür. Havuzda olmayan yeni tür en fazla ${NEW_TAG_LIMIT} adet olabilir; yeni tür gerekiyorsa popüler Türkçe tür adı ver.
3. ${
  isGame
    ? `"developers": Oyunu geliştiren ve/veya yayınlayan ana stüdyolar (dizi olarak, örn: ["FromSoftware", "Bandai Namco"]). Havuzda olmayan yeni stüdyo en fazla ${NEW_TAG_LIMIT} adet olabilir.`
    : `"firms": Yapımcı şirketler veya stüdyolar (örn: ["HBO", "Warner Bros."]). Havuzda olmayan yeni şirket en fazla ${NEW_TAG_LIMIT} adet olabilir.\n"directors": Yönetmen(ler) (Dizilerde ve filmlerde ana yönetmenleri/yaratıcıları en az 1-3 kişi eksiksiz listele, tek kişiyle geçiştirme). Kişi havuzdaysa havuzdaki yazılışı kullan.\n"actors": Başrol oyuncuları veya seslendirme sanatçıları (dizi olarak, örn: ["Bryan Cranston", "Aaron Paul"]). Kişi havuzdaysa havuzdaki yazılışı kullan.`
}
4. "characters": Öne çıkan en popüler ana karakterler (en fazla 8 adet). Karakterin adı ("name") ve canlandıran/seslendiren ("actor"). "actor" kişisi oyuncu havuzundaysa havuzdaki yazılışı kullan.
5. "description": ${
  isGame
    ? `OYUN KONUSU (STEAM / MAĞAZA TARZI DOĞAL ÖZET):
   - Uzunluk: 1 veya 3 akıcı cümle (ortalama 30 - 80 kelime arası; minimalist oyunlarda tek net cümle yeterlidir, hikayeli büyük yapımlarda gerekirse 100 kelimeye kadar esneyebilir). Tek parça kompakt metin.
   - Üslup: Tıpkı Steam veya konsol mağazası vitrini gibi; oyunun dünyasını, temel amacını ve oynanış ruhunu doğal ve akıcı bir dille özetle.
   - KESİN YASAKLAR:
     * "Bu oyun oyuncunun X yapmasını sağlar...", "Oyunda amaç..." gibi robotik cümle başlangıçları YASAKTIR.
     * Boş reklam övgüleri ("kusursuz grafikler", "harika bir deneyim") yasaktır.`
    : `MEDYA KONUSU (NETFLIX / LETTERBOXD TARZI DOĞAL SİNOPSİS):
   - Uzunluk: 2 veya 4 akıcı cümle (ortalama 40 - 100 kelime arası; yapımın kapsamına göre gerekirse 100 kelimeyi biraz aşabilir). Tek parça kompakt metin.
   - Üslup: Tıpkı Netflix veya Letterboxd sinopsisleri gibi; yapımın konusunu merak uyandıran, akıcı ve doğal bir dille özetle.
   - KESİN YASAKLAR & SPOILER SINIRI:
     * Finali, büyük son savaşı veya senaryonun sonunu ASLA dökme.
     * "Hikayenin ana çatışması...", "Olaylar şöyle doruk noktasına ulaşır..." gibi yapay ödev kalıpları ve Wikipedia özet dili KESİNLİKLE YASAKTIR.
     * Kuru ansiklopedi dili veya resmi kurum adları sayma.
     * Boş reklam övgüleri ("ödüllü yapım", "harika oyunculuklar") yasaktır. Sadece hikaye ve karakter konuşur.`
}
6. Kişisel görüş, puan veya durum (izlendi/oynandı) EKLEME.

Çıktıyı YALNIZCA aşağıdaki JSON şemasına uygun olarak üret:
{
  "releaseYear": 2022 veya "2008-2013",
  "genres": ["Aksiyon", "Macera"],
  ${isGame ? '"developers": ["Stüdyo Adı"]' : '"firms": ["Yapımcı Şirket"],\n  "directors": ["Yönetmen Adı"],\n  "actors": ["Oyuncu 1", "Oyuncu 2"]'},
  "characters": [
    { "name": "Karakter Adı", "actor": "Oyuncu Adı" }
  ],
  "description": ${isGame ? '"Steam vitrini gibi oyunun dünyasını ve oynanış ruhunu anlatan 1-3 net cümle (30-80 kelime)."' : '"Netflix/Letterboxd gibi merak uyandıran, akıcı ve doğal 2-4 cümlelik sinopsis (40-100 kelime)."'}
}
`;
    }

    // Multimodal contents: poster (if provided) + prompt
    const contents: any[] = [];
    const parsedImg = posterBase64 ? parseBase64Image(posterBase64) : null;
    if (parsedImg) {
      addLog(
        'info',
        `Afiş görseli tespit edildi (${parsedImg.mimeType}). Multimodal girdi olarak pakete eklendi.`,
        undefined,
        'Afiş görseli taranıyor...'
      );
      contents.push({
        inlineData: {
          mimeType: parsedImg.mimeType,
          data: parsedImg.data,
        },
      });
    }
    contents.push(promptText);

    let lastError: unknown = null;
    let response: any = null;
    let successfulModel = '';

    // Loop through fallback candidate models
    for (let i = 0; i < GEMINI_CANDIDATE_MODELS.length; i++) {
      const model = GEMINI_CANDIDATE_MODELS[i];
      addLog(
        'info',
        `"${model}" modeline istek gönderiliyor... (Deneme ${i + 1}/${GEMINI_CANDIDATE_MODELS.length})`,
        undefined,
        `${model} ile sorgulanıyor...`
      );

      try {
        response = await callWithTimeout(
          ai.models.generateContent({
            model,
            contents,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
          10000,
          model
        );

        if (response && response.text) {
          successfulModel = model;
          addLog(
            'success',
            `"${model}" modelinden başarılı yanıt alındı. Veri çözümleniyor...`,
            undefined,
            'Bilgiler işleniyor...'
          );
          break;
        }
      } catch (err: unknown) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const hasNextModel = i < GEMINI_CANDIDATE_MODELS.length - 1;
        const nextModel = hasNextModel ? GEMINI_CANDIDATE_MODELS[i + 1] : null;

        if (msg.includes('zaman aşımı') || msg.includes('yanıt vermedi')) {
          addLog(
            'warn',
            `"${model}" 10 saniyede yanıt vermedi (Google sunucu yoğunluğu).${hasNextModel ? ` Hızlıca "${nextModel}" modeline geçiliyor...` : ''}`,
            msg,
            hasNextModel ? `Zaman aşımı, ${nextModel} deneniyor...` : 'Zaman aşımı'
          );
        } else if (msg.includes('503') || msg.includes('high demand')) {
          addLog(
            'warn',
            `"${model}" sunucusunda aşırı yoğunluk var (503).${hasNextModel ? ` Otomatik olarak "${nextModel}" modeline geçiliyor...` : ''}`,
            msg,
            hasNextModel ? `Yoğunluk (503), ${nextModel} deneniyor...` : 'Sunucu meşgul (503)'
          );
        } else if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
          addLog(
            'warn',
            `"${model}" istek kotası dolu (429).${hasNextModel ? ` Otomatik olarak "${nextModel}" modeline geçiliyor...` : ''}`,
            msg,
            hasNextModel ? `Kota uyarısı, ${nextModel} deneniyor...` : 'Kota aşıldı (429)'
          );
        } else if (msg.includes('404') || msg.includes('not found') || msg.includes('no longer available')) {
          addLog(
            'warn',
            `"${model}" modeli artık kullanılmıyor (404).${hasNextModel ? ` "${nextModel}" deneniyor...` : ''}`,
            msg
          );
        } else {
          addLog(
            'warn',
            `"${model}" hata döndürdü.${hasNextModel ? ` "${nextModel}" deneniyor...` : ''}`,
            msg.slice(0, 200)
          );
        }

        if (hasNextModel) {
          // Brief pause before trying next candidate
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
    }

    if (!response || !response.text) {
      const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
      let userFriendlyError = 'Tüm modeller denendi ancak Google sunucularından yanıt alınamadı.';

      if (errMsg.includes('503') || errMsg.includes('high demand')) {
        userFriendlyError = 'Google sunucularında genel bir yoğunluk var (503). Lütfen birkaç saniye sonra tekrar deneyin.';
      } else if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
        userFriendlyError = 'Gemini istek kotası aşıldı (Rate limit). Lütfen 1 dakika bekleyip tekrar deneyin.';
      } else if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid')) {
        userFriendlyError = 'Geçersiz API Anahtarı! Lütfen Ayarlar > Gelişmiş menüsünden anahtarınızı kontrol edin.';
      }

      addLog('error', userFriendlyError, errMsg, userFriendlyError);
      return {
        success: false,
        error: userFriendlyError,
        logs,
      };
    }

    const rawText = response.text || '';
    let parsedData: AiItemMetadata;

    try {
      parsedData = JSON.parse(rawText);
    } catch {
      const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    }
    if (!parsedData || typeof parsedData !== 'object' || Array.isArray(parsedData)) {
      throw new Error('Yapay zekâ beklenen biçimde (JSON nesnesi) yanıt vermedi.');
    }

    // Cevabı temizle ve havuzdaki yazılışlara hizala.
    // Tür, firma, geliştirici ve yayınevinde havuzda olmayan en fazla 3 yeni değer kalır.
    const limited = { limitNew: NEW_TAG_LIMIT };
    const person = { isPerson: true };
    parsedData.genres = alignTagsToPool(parsedData.genres, existingGenres, limited);
    if (isBook) {
      parsedData.authors = alignTagsToPool(parsedData.authors, existingAuthors, person);
      parsedData.publishers = alignTagsToPool(parsedData.publishers, existingPublishers, limited);
      parsedData.translators = alignTagsToPool(parsedData.translators, existingTranslators, person);
      // Kitapta karakterin ikinci alanı rol olduğu için oyuncu havuzuna hizalanmaz.
      parsedData.characters = alignCharacters(parsedData.characters, []);
    } else if (isGame) {
      parsedData.developers = alignTagsToPool(parsedData.developers, existingDevelopers, limited);
      parsedData.characters = alignCharacters(parsedData.characters, existingActors);
    } else {
      parsedData.firms = alignTagsToPool(parsedData.firms, existingFirms, limited);
      parsedData.directors = alignTagsToPool(parsedData.directors, existingDirectors, person);
      parsedData.characters = alignCharacters(parsedData.characters, existingActors);
      parsedData.actors = alignTagsToPool(parsedData.actors, existingActors, person);
      // Oyuncu listesi boş geldiyse karakterlerin oyuncularından doldur
      if (parsedData.actors.length === 0) {
        parsedData.actors = alignTagsToPool(
          parsedData.characters.map((c) => c.actor || ''),
          existingActors,
          person
        );
      }
    }
    if (typeof parsedData.description !== 'string') {
      parsedData.description = parsedData.description ? String(parsedData.description) : '';
    }

    // Tally found details for log
    const foundParts: string[] = [];
    if (parsedData.releaseYear) foundParts.push(`Yıl: ${parsedData.releaseYear}`);
    if (parsedData.genres?.length) foundParts.push(`${parsedData.genres.length} Tür`);
    if (parsedData.authors?.length) foundParts.push(`${parsedData.authors.length} Yazar`);
    if (parsedData.publishers?.length) foundParts.push(`${parsedData.publishers.length} Yayınevi`);
    if (parsedData.translators?.length) foundParts.push(`${parsedData.translators.length} Çevirmen`);
    if (parsedData.firms?.length) foundParts.push(`${parsedData.firms.length} Stüdyo/Firma`);
    if (parsedData.directors?.length) foundParts.push(`${parsedData.directors.length} Yönetmen`);
    if (parsedData.actors?.length) foundParts.push(`${parsedData.actors.length} Oyuncu`);
    if (parsedData.developers?.length) foundParts.push(`${parsedData.developers.length} Geliştirici`);
    if (parsedData.characters?.length) foundParts.push(`${parsedData.characters.length} Karakter`);
    if (parsedData.description?.trim()) foundParts.push('Konu Özeti');

    const summaryText = foundParts.join(', ') || 'Temel bilgiler';

    addLog(
      'success',
      `İşlem tamamlandı! (${summaryText}) [Model: ${successfulModel}]`,
      JSON.stringify(parsedData, null, 2),
      `Tamamlandı (${summaryText})`
    );

    return {
      success: true,
      data: parsedData,
      usedModel: successfulModel,
      logs,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    addLog('error', `Beklenmeyen AI sorgu hatası: ${errMsg.slice(0, 150)}`, errMsg);
    return {
      success: false,
      error: `AI sorgulama hatası: ${errMsg.slice(0, 150)}`,
      logs,
    };
  }
}

export const ASSISTANT_CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

export function formatMetadataModelLabel(modelName?: string): string {
  if (!modelName) return 'Gemini';
  const cleanName = modelName.replace(/^models\//, '');
  const index = GEMINI_CANDIDATE_MODELS.findIndex(
    (m) => m === cleanName || cleanName.includes(m) || m.includes(cleanName)
  );
  if (index !== -1) {
    return `[${index + 1}] ${cleanName}`;
  }
  return cleanName;
}

export function formatAssistantModelLabel(modelName?: string): string {
  if (!modelName) return 'Gemini';
  const index = ASSISTANT_CANDIDATE_MODELS.indexOf(modelName);
  if (index !== -1) {
    return `[${index + 1}] ${modelName}`;
  }
  return modelName;
}

export interface AssistantChatHistoryItem {
  sender: 'user' | 'assistant';
  text: string;
}

export interface AskAssistantOptions {
  userPrompt: string;
  tasteProfileContext: string;
  chatHistory: AssistantChatHistoryItem[];
  apiKey?: string;
  recommendationExclusionContext?: string;
  /** "Durdur" düğmesi: iptal edilince Google'a giden istek de kesilir */
  signal?: AbortSignal;
}

// Asistan için model başına bekleme süresi (25 sn). Ölçümlerde akıllı model normalde 6–24 sn'de cevap verdi;
// yoğun günlerde 40 sn'de bile veremiyordu. 25 sn, isabet ile bekleme arasında denge.
const ASSISTANT_MODEL_TIMEOUT_MS = 25000;

// Asistan cevabının kesin şablonu: sohbet metni (reply) + öneri kartları (cards).
const stringList = { type: Type.ARRAY, items: { type: Type.STRING } };
const ASSISTANT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING },
    cards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          releaseYear: { type: Type.STRING },
          mainTab: { type: Type.STRING, enum: ['media', 'game', 'book'] },
          badge: { type: Type.STRING, enum: ['🎯 KÜTÜPHANE İMZASI', '🌀 FARKLI BİR TAT', '🔮 SIRADIŞI KEŞİF'] },
          shortDesc: { type: Type.STRING },
          detailedDesc: { type: Type.STRING },
          matchReason: { type: Type.STRING },
          directors: stringList,
          firms: stringList,
          developers: stringList,
          authors: stringList,
          publishers: stringList,
          translators: stringList,
          genres: stringList,
        },
        required: ['title', 'mainTab', 'badge', 'shortDesc', 'detailedDesc', 'matchReason'],
        propertyOrdering: [
          'title', 'releaseYear', 'mainTab', 'badge', 'shortDesc', 'detailedDesc', 'matchReason',
          'directors', 'firms', 'developers', 'authors', 'publishers', 'translators', 'genres',
        ],
      },
    },
  },
  required: ['reply', 'cards'],
  propertyOrdering: ['reply', 'cards'],
};

export interface AskAssistantResult {
  success: boolean;
  reply?: string;
  recommendation?: AiRecommendationCard;
  recommendations?: AiRecommendationCard[];
  usedModel?: string;
  usedModelLabel?: string;
  error?: string;
}

/**
 * Ask Lore AI Assistant for conversational answers, library questions, or recommendations
 * using the user's taste profile and library archive.
 */
export async function askAiAssistant(options: AskAssistantOptions): Promise<AskAssistantResult> {
  const { userPrompt, tasteProfileContext, chatHistory, apiKey, recommendationExclusionContext, signal } = options;

  const key = (apiKey || getGeminiApiKey()).trim();
  if (!key) {
    return {
      success: false,
      error: 'Gemini API anahtarı bulunamadı. Lütfen Ayarlar (⚙️) menüsünden Google AI Studio API anahtarınızı girin.',
    };
  }

  const systemInstruction = `Sen "Lore Küratör"sün: kullanıcının film, dizi, anime, animasyon, oyun ve kitap
kütüphanesini çok iyi tanıyan, samimi ve zevk sahibi bir öneri arkadaşı.
Türkçe konuşursun. Reklamcı ya da eleştirmen gibi değil, yapımı anlatan biri gibi konuşursun.

## 1. TEMEL KURALLAR (en önemlisi bunlar)
1. ÖNCE O ANKİ İSTEK: Kullanıcı o an ne istiyorsa ("kafa yormayan", "kısa", "korku",
   "idle oyun") önce ona uy. Kütüphane bilgisi bu isteğe hizmet eder, onu ezemez.
2. ASLA KÜTÜPHANEDEKİNİ ÖNERME: [KÜTÜPHANE] listesindeki hiçbir yapım öneri kartı olamaz
   (bitirilen, devam eden, sırada bekleyen, yarım bırakılan, takip edilen; hepsi).
3. ASLA TEKRAR ÖNERME: [DAHA ÖNCE ÖNERİLENLER] listesindeki hiçbir yapım tekrar kart olamaz.
4. KART SAYISI: Kullanıcı sayı söylerse o kadar kart. "Bir film öner" gibi tekil isteklerde 1 kart.
   Sayı belirtilmemiş genel isteklerde ("film öner") 3 kart.
5. SPOILER YOK: Hikâyenin ilk üçte birinden sonrasını anlatma. Sürpriz sonu İMA ETMEK de
   yasak ("finaldeki büyük dönemeç", "kimliği değişmeye başlar" gibi).
6. BOŞ ÖVGÜ YOK: "başyapıt", "harika oyunculuklar", "ödüllü", "sizi ekrana kilitleyecek"
   gibi reklam laflarını kullanma. Yapımın kendisini anlat.

## 2. KULLANICIYI NASIL OKURSUN
- Puanlar: 10 çok nadir, gerçek zirve. 9 zirve. 8 "çok sevdim" (asıl beğeni havuzu).
  7 "beğendim". 6 "fena değil". 1–5 "beğenmedim" (kaçınılacak şeyler).
- Puansız yapım sevilmemiş demek değildir; nötr say.
- Kategori sertliği: [KATEGORİ PUAN ORTALAMALARI]'na bak. Ortalaması düşük kategoride
  7 iyi bir puandır; ortalaması yüksek kategoride 7 ortalamanın altıdır.
- Sırada bekleyenler henüz izlenmedi/oynanmadı/okunmadı: Bunlardan zevk çıkarma,
  "bunu sevdiğin için" deme.
- Yarım bırakılanlar: Kullanıcıyı sarmamış yapımlardır. Benzerlerinde dikkatli ol.
- [DAHA ÖNCE ÖNERİLENLER] sadece "tekrar etme" listesidir; oradan zevk çıkarma.
- Kullanıcının zevki geniştir (komedi, animasyon, aksiyon, bilim kurgu, mekanik oyunlar...).
  Tek bir türe ya da tona (ör. hep karanlık/zihin bükücü) kayma; isteğe ve kütüphaneye bak.

## 3. CEVAP DÜZENİ
- Sohbet metni (reply): Önce kullanıcının sorusunu doğrudan cevapla. Öneri istendiyse
  sonra doğal bir cümleyle kartlara geç (ör. "Kütüphanendeki arşive ve beğenilerine göre
  seçtiğim önerileri aşağıya bıraktım:"). Yapımların künyesini ve konusunu sohbet metnine
  yazma; onlar kartlara.
- "Zevk profili", "zevk haritası", "çekirdek beğeni" gibi yapay ifadeler kullanma.
- Öneri istenmediyse (ör. "en sevdiğim yönetmen kim?") kart üretme.
- Kütüphanedeki bir yapımdan bahsederken [[item:id|Yapım Adı]] yaz; id ve adın İKİSİ de olmalı.
  Bu damgayı yeni önerdiğin yapımlarda ve kartın konu metinlerinde kullanma.
- Oyuncu/yönetmen adlarını düz yaz; yanına id ya da parantez ekleme.

## 4. KART
Her kart iki hâlde görünür: kapalı (kısa) ve açık (detaylı).
- shortDesc (kapalı kart): 1–2 cümle (25–45 kelime). Merak uyandıran bir kanca:
  kim, ne oluyor, neden ilginç. Konu metninin özeti değil, girişi.
- detailedDesc (açık kart): 3 paragraf, toplam 120–200 kelime, paragraflar arasında boş satır.
  shortDesc'i tekrar etme. Paragrafların içeriği yapımın türüne göre:
  * Hikâyeli yapım (dram, gerilim, bilim kurgu, hikâyeli oyun, roman):
    1) Dünya ve karakter, hikâyeyi başlatan kırılma  2) Çatışma ve karakterin bedeli  3) Atmosfer ve ton
  * Komedi: 1) Kim, nerede, nasıl bir durum  2) Mizahın türü ve karakter dinamikleri  3) Tonu, nasıl bir his bırakır
  * Mekanik ağırlıklı oyun (idle, bulmaca, roguelike, strateji, simülasyon):
    1) Oyunda ne yapıyorsun, temel döngü  2) Seni ne bağlar, nasıl ilerlersin  3) Temposu, süresi, hissi
  * Belgesel / kurgu dışı: 1) Konu  2) Bakış açısı  3) Ton
- matchReason (gerekçe): 1–2 cümle. Kütüphanedeki hangi yapım(lar)la neden bağlantılı,
  doğal bir dille. [[item:id|Ad]] damgası sadece burada.
  Kötü: "Looper'a verdiğin yüksek puana dayanarak bu filmi öneriyorum."
  İyi: "[[item:film_looper|Looper]]'daki neden-sonuç düğümlerini sevdiysen, bu filmin
  zaman kırılmaları tam sana göre."
- badge (rozet), birini seç:
  "🎯 KÜTÜPHANE İMZASI" → sevdiği yapımlarla doğrudan bağlı, garanti öneri
  "🌀 FARKLI BİR TAT"   → sevdiği şeylerin kıyısında ama yeni bir tat
  "🔮 SIRADIŞI KEŞİF"   → az bilinen, kült ya da bağımsız, kalite çıtasına uyan
- Künye: Film/dizi/anime için directors ve firms; oyun için developers; kitap için authors,
  publishers ve translators. Bilmediğin bilgiyi uydurma, boş bırak.
- Resim linki üretme; görseller sistem tarafından eklenir.`;

  // Build conversation contents
  const recentHistory = chatHistory.slice(-6);
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  // Add previous turns
  recentHistory.forEach((msg) => {
    contents.push({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    });
  });

  // Current turn with user prompt, taste profile context, and recommendation memory exclusion list
  let currentTurnText = `${tasteProfileContext}`;
  if (recommendationExclusionContext && recommendationExclusionContext.trim()) {
    currentTurnText += `\n\n${recommendationExclusionContext.trim()}`;
  }
  // Zayıf modeller mesajın sonuna yakın olanı daha iyi hatırlar: kısa hatırlatma kullanıcı mesajının hemen üstünde
  currentTurnText += `\n\nHatırlatma: Kart başlıkları [KÜTÜPHANE] ve [DAHA ÖNCE ÖNERİLENLER] listelerinde olmamalı.`;
  currentTurnText += `\n\n[KULLANICI MESAJI]:\n${userPrompt}`;

  contents.push({
    role: 'user',
    parts: [{ text: currentTurnText }],
  });

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    let lastError: unknown = null;

    for (const model of ASSISTANT_CANDIDATE_MODELS) {
      if (signal?.aborted) {
        return { success: false, error: 'İstek durduruldu.' };
      }

      // Her model için ayrı iptal anahtarı: süre dolarsa ya da kullanıcı "Durdur"a basarsa
      // Google'a giden istek gerçekten kesilir (kota boşa harcanmaz).
      const modelController = new AbortController();
      const abortFromUser = () => modelController.abort();
      signal?.addEventListener('abort', abortFromUser);
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        modelController.abort();
      }, ASSISTANT_MODEL_TIMEOUT_MS);

      try {
        let response;
        try {
          response = await ai.models.generateContent({
            model,
            contents: contents as any,
            config: {
              systemInstruction,
              temperature: 0.7,
              abortSignal: modelController.signal,
              // Cevap her zaman bu şablonda gelir; kartlar bozuk JSON yüzünden kaybolmaz
              responseMimeType: 'application/json',
              responseSchema: ASSISTANT_RESPONSE_SCHEMA,
            },
          });
        } catch (err) {
          if (timedOut) {
            throw new Error(
              `"${model}" ${ASSISTANT_MODEL_TIMEOUT_MS / 1000} saniye içinde yanıt vermedi (zaman aşımı).`
            );
          }
          throw err;
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener('abort', abortFromUser);
        }

        if (response && response.text) {
          let replyText = response.text.trim();
          let recommendations: AiRecommendationCard[] = [];

          // Helper to normalize single card
          const normalizeCard = (raw: any): AiRecommendationCard | null => {
            if (!raw || typeof raw !== 'object' || !raw.title) return null;

            const toStringArray = (val: any): string[] | undefined => {
              if (Array.isArray(val)) {
                const arr = val.map((s) => String(s).trim()).filter(Boolean);
                return arr.length > 0 ? arr : undefined;
              }
              if (typeof val === 'string' && val.trim()) {
                return [val.trim()];
              }
              return undefined;
            };

            return {
              title: String(raw.title).trim(),
              releaseYear: raw.releaseYear,
              mainTab: raw.mainTab === 'game' ? 'game' : raw.mainTab === 'book' ? 'book' : 'media',
              badge: raw.badge ? String(raw.badge).trim() : undefined,
              matchScore:
                typeof raw.matchScore === 'number'
                  ? Math.round(raw.matchScore)
                  : typeof raw.matchScore === 'string' && !isNaN(parseInt(raw.matchScore, 10))
                  ? parseInt(raw.matchScore, 10)
                  : undefined,
              shortDesc: String(raw.shortDesc || raw.detailedDesc || '').trim(),
              detailedDesc: String(raw.detailedDesc || raw.shortDesc || '').trim(),
              matchReason: String(raw.matchReason || '').trim(),
              thumbnailUrl: raw.thumbnailUrl ? String(raw.thumbnailUrl).trim() : undefined,
              galleryImages: Array.isArray(raw.galleryImages)
                ? raw.galleryImages
                    .map((u: any) => String(u).trim())
                    .filter((u: string) => u.startsWith('http'))
                : [],
              firms: toStringArray(raw.firms),
              directors: toStringArray(raw.directors),
              developers: toStringArray(raw.developers),
              authors: toStringArray(raw.authors),
              publishers: toStringArray(raw.publishers),
              translators: toStringArray(raw.translators),
              genres: toStringArray(raw.genres),
            };
          };

          // 1) Asıl yol: Yapılandırılmış cevap { reply, cards } (şablon sayesinde her zaman geçerli JSON)
          let structured = false;
          try {
            const parsed = JSON.parse(replyText);
            if (parsed && typeof parsed === 'object' && typeof parsed.reply === 'string') {
              structured = true;
              replyText = parsed.reply.trim();
              if (Array.isArray(parsed.cards)) {
                for (const item of parsed.cards) {
                  const card = normalizeCard(item);
                  if (card) recommendations.push(card);
                }
              }
            }
          } catch {
            // Şablon dışı cevap: aşağıdaki eski yöntemle okunur
          }

          // 2) Yedek yol: Metnin sonundaki ```recommendation-cards bloğu (eski biçim)
          const cardsMatch = structured
            ? null
            : replyText.match(/```(?:recommendation-cards?|json)?\s*([\[\{][\s\S]*?[\]\}])\s*```/i);
          if (cardsMatch) {
            try {
              const rawJson = cardsMatch[1].trim();
              const parsed = JSON.parse(rawJson);

              if (Array.isArray(parsed)) {
                for (const item of parsed) {
                  const card = normalizeCard(item);
                  if (card) recommendations.push(card);
                }
              } else if (parsed && typeof parsed === 'object') {
                if (Array.isArray(parsed.recommendations)) {
                  for (const item of parsed.recommendations) {
                    const card = normalizeCard(item);
                    if (card) recommendations.push(card);
                  }
                } else {
                  const card = normalizeCard(parsed);
                  if (card) recommendations.push(card);
                }
              }

              // Strict rule: Maximum 10 cards
              if (recommendations.length > 10) {
                recommendations = recommendations.slice(0, 10);
              }

              if (recommendations.length > 0) {
                // Remove the raw recommendation block from the displayed chat text
                replyText = replyText.replace(cardsMatch[0], '').trim();
              }
            } catch (e) {
              console.warn('Could not parse recommendation JSON block:', e);
            }
          }

          // Kesin kural: en fazla 10 kart (iki yol için de)
          if (recommendations.length > 10) {
            recommendations = recommendations.slice(0, 10);
          }

          return {
            success: true,
            reply: replyText,
            recommendation: recommendations[0],
            recommendations: recommendations.length > 0 ? recommendations : undefined,
            usedModel: model,
            usedModelLabel: formatAssistantModelLabel(model),
          };
        }
      } catch (err: unknown) {
        if (signal?.aborted) {
          return { success: false, error: 'İstek durduruldu.' };
        }
        lastError = err;
      }
    }

    if (lastError) {
      const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
      if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('400')) {
        return { success: false, error: 'Geçersiz API Anahtarı. Lütfen Ayarlar menüsünden anahtarınızı kontrol edin.' };
      }
      if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
        return { success: false, error: 'API istek kotası doldu (Rate limit). Lütfen birkaç saniye bekleyip tekrar deneyin.' };
      }
      if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('zaman aşımı')) {
        return { success: false, error: 'Google AI sunucularında anlık yoğunluk var. Lütfen birkaç saniye sonra tekrar deneyin.' };
      }
      return { success: false, error: `Bağlantı hatası: ${errMsg.slice(0, 150)}` };
    }

    return {
      success: false,
      error: 'Modelden yanıt alınamadı. Lütfen tekrar deneyin.',
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Asistan sorgu hatası: ${errMsg.slice(0, 150)}`,
    };
  }
}

