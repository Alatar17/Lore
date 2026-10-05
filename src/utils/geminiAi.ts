import { GoogleGenAI } from '@google/genai';
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
${existingGenres.length > 0 ? `- Kullanıcının Mevcut Tür/Etiket Havuzu: [${existingGenres.slice(0, 40).join(', ')}]` : ''}
${existingAuthors.length > 0 ? `- Kullanıcının Mevcut Yazar Havuzu: [${existingAuthors.slice(0, 30).join(', ')}]` : ''}
${existingPublishers.length > 0 ? `- Kullanıcının Mevcut Yayınevi Havuzu: [${existingPublishers.slice(0, 30).join(', ')}]` : ''}
${existingTranslators.length > 0 ? `- Kullanıcının Mevcut Çevirmen Havuzu: [${existingTranslators.slice(0, 20).join(', ')}]` : ''}

Kurallar:
1. "releaseYear": Kitabın ilk orijinal basım/yayın yılı (örn: 1866 veya 1949). Tek bir yıl ise sayı (örn: 1866). Seri ise "YYYY-YYYY" string.
2. "genres": En fazla 2-4 adet en uygun kitap türü veya edebi teması (örn: ["Dünya Klasikleri", "Psikolojik Roman", "Felsefe"]). KRİTİK KURAL: Kullanıcının mevcut tür/etiket havuzunda uyanlar varsa ÖNCELİKLE onları kullan.
3. "authors": Kitabın yazar(lar)ı (dizi olarak, örn: ["Fyodor Dostoyevski"]). Mevcut yazar havuzundaki isimler önceliklidir.
4. "publishers": Türkiye'de bu kitabın en bilinen/yaygın yayınevi veya orijinal yayıncısı (dizi olarak, örn: ["İş Bankası Kültür Yayınları", "Can Yayınları", "İthaki Yayınları"]). Mevcut yayınevi havuzundaki isimler önceliklidir.
5. "translators": Varsa en popüler Türkçe çevirmen(ler)i (örn: ["Mazlum Beyhan"]). Türk edebiyatı ise veya çevirmeni yoksa boş dizi [] bırak. Mevcut çevirmen havuzu önceliklidir.
6. "characters": Kitaptaki en önemli ana karakterler (en fazla 8 adet). Her karakter için: "name" (Karakterin adı) ve "actor" alanına karakterin romandaki öz rolü/kimliği (EN FAZLA 2-4 KELİME, kısa ve öz; örn: "Yoksul Hukuk Öğrencisi", "Özel Dedektif", "Müfettiş", "Bakanlık Memuru", "Köy Muhtarı", "Ağabeyi"). Asla uzun cümle veya paragraf yazma, sadece kısa unvan/rol yaz.
7. "description": LORE ANLATI KÜRATÖRÜ SİNOPSİS ALGORİTMASI:
   - Sen bir pazarlamacı veya arka kapak yazarı değilsin. "Harika", "başyapıt", "sarsıcı", "okuyucuyu büyülüyor" gibi boş ve yapay övgüler KESİNLİKLE YASAKTIR. Sadece HİKAYE, DÜNYA ve KARAKTER anlatılır.
   - SPOILER SINIRI: Kitabın ilk 1/3'lük diliminin ötesindeki sürpriz gelişmeler veya final asla ifşa edilemez.
   - Paragraf Mimarisi (Aralarında çift satır sonu \n\n olan 2 ya da 3 ayrı paragraf, toplam 120-220 kelime):
     * 1. Paragraf (Dünya Düzeni & Kırılma): Karakter kimdir, hangi dönemde/evrende yaşar ve hayatının olağan akışı hangi kritik kararla, fikirle veya olayla rayından çıkar?
     * 2. Paragraf (Ana Çatışma & Karakterin Bedeli): Karakter neyle yüzleşmek zorundadır, karşısındaki varoluşsal/ahlaki kriz nedir, neyi kaybetme tehlikesiyle karşı karşıyadır?
     * 3. Paragraf (Atmosfer, Ton & Bırakılan İz): Eserin edebi temposunu, psikolojik/felsefi ağırlığını ve okuyucuda bıraktığı derin duygusal tonu özetleyen güçlü kapanış.
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
${existingGenres.length > 0 ? `- Kullanıcının Mevcut Tür/Etiket Havuzu: [${existingGenres.slice(0, 40).join(', ')}]` : ''}
${existingFirms.length > 0 ? `- Kullanıcının Mevcut Stüdyo/Şirket Havuzu: [${existingFirms.slice(0, 30).join(', ')}]` : ''}
${existingDirectors.length > 0 ? `- Kullanıcının Mevcut Yönetmen Havuzu: [${existingDirectors.slice(0, 20).join(', ')}]` : ''}
${existingDevelopers.length > 0 ? `- Kullanıcının Mevcut Geliştirici Havuzu: [${existingDevelopers.slice(0, 30).join(', ')}]` : ''}

Kurallar:
1. "releaseYear": Tek bir yıl ise sayı (örn: 2022), dizi veya seri gibi yıllara yayılıyorsa "YYYY-YYYY" veya "YYYY-" aralık formatında string (örn: "2008-2013").
2. "genres": En fazla 3-5 adet en uygun tür. KRİTİK KURAL: Eğer mevcut tür/etiket havuzunda uyanlar varsa ÖNCELİKLE onları kullan. Yoksa popüler Türkçe tür adları ver.
3. ${
  isGame
    ? '"developers": Oyunu geliştiren ve/veya yayınlayan ana stüdyolar (dizi olarak, örn: ["FromSoftware", "Bandai Namco"]). Mevcut havuzdaki isimler önceliklidir.'
    : '"firms": Yapımcı şirketler veya stüdyolar (örn: ["HBO", "Warner Bros."]). Mevcut havuz öncelikli.\n"directors": Yönetmen(ler) (Dizilerde ve filmlerde ana yönetmenleri/yaratıcıları en az 1-3 kişi eksiksiz listele, tek kişiyle geçiştirme). Mevcut havuz öncelikli.\n"actors": Başrol oyuncuları veya seslendirme sanatçıları (dizi olarak, örn: ["Bryan Cranston", "Aaron Paul"]). Mevcut havuz öncelikli.'
}
4. "characters": Öne çıkan en popüler ana karakterler (en fazla 8 adet). Karakterin adı ("name") ve canlandıran/seslendiren ("actor").
5. "description": LORE ANLATI KÜRATÖRÜ SİNOPSİS ALGORİTMASI (konu_derinligi.tsx):
   - Sen bir pazarlamacı değilsin. "Harika", "müthiş", "ödüllü", "ekran başına kilitliyor" gibi boş övgüler KESİNLİKLE YASAKTIR. Sadece HİKAYE, DÜNYA ve KARAKTER anlatılır.
   - Video oyunu dahi olsa parkur, mekanik, grafik övgüsü gibi teknik detayları konuya sokma.
   - SPOILER SINIRI: Hikayenin ilk 1/3'lük diliminin ötesindeki sürpriz gelişmeler veya final düğümleri asla ifşa edilemez.
   - Paragraf Mimarisi (Aralarında çift satır sonu \\n\\n olan 2 ya da 3 ayrı paragraf, toplam 120-220 kelime):
     * 1. Paragraf (Dünya Düzeni & Kırılma): Karakter kimdir, hangi evrende yaşar ve hayatının olağan akışı hangi kritik kararla veya olayla rayından çıkar?
     * 2. Paragraf (Ana Çatışma & Karakterin Bedeli): Karakter neyle yüzleşmek zorundadır, karşısındaki varoluşsal kriz nedir, neyi kaybetme tehlikesiyle karşı karşıyadır?
     * 3. Paragraf (Atmosfer, Ton & Bırakılan İz): Eserin temposunu, duygusal ağırlığını ve bıraktığı psikolojik/atmosferik tonu özetleyen güçlü kapanış.
6. Kişisel görüş, puan veya durum (izlendi/oynandı) EKLEME.

Çıktıyı YALNIZCA aşağıdaki JSON şemasına uygun olarak üret:
{
  "releaseYear": 2022 veya "2008-2013",
  "genres": ["Aksiyon", "Macera"],
  ${isGame ? '"developers": ["Stüdyo Adı"]' : '"firms": ["Yapımcı Şirket"],\n  "directors": ["Yönetmen Adı"],\n  "actors": ["Oyuncu 1", "Oyuncu 2"]'},
  "characters": [
    { "name": "Karakter Adı", "actor": "Oyuncu Adı" }
  ],
  "description": "1. Paragraf: Karakter ve dünya düzeni...\\n\\n2. Paragraf: Ana çatışma ve bedel...\\n\\n3. Paragraf: Atmosfer ve duygusal iz..."
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

    // Ensure actors list is populated (fallback to characters' actors if needed)
    if ((!parsedData.actors || parsedData.actors.length === 0) && Array.isArray(parsedData.characters)) {
      const extractedActors = Array.from(
        new Set(
          parsedData.characters
            .map((c) => c.actor?.trim())
            .filter((a): a is string => Boolean(a && a.length > 0))
        )
      );
      if (extractedActors.length > 0) {
        parsedData.actors = extractedActors;
      }
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
}

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
  const { userPrompt, tasteProfileContext, chatHistory, apiKey, recommendationExclusionContext } = options;

  const key = (apiKey || getGeminiApiKey()).trim();
  if (!key) {
    return {
      success: false,
      error: 'Gemini API anahtarı bulunamadı. Lütfen Ayarlar (⚙️) menüsünden Google AI Studio API anahtarınızı girin.',
    };
  }

  const systemInstruction = `Sen dünya çapında sinema, dizi, anime ve oyun anlatı sanatını derinlemesine çözümleyen, karakter psikolojisini ve eserin ruhunu gören usta bir ANLATI KÜRATÖRÜSÜN (Lore AI Küratör).
Kullanıcının kütüphanesini, izlediği/oynadığı yapımları, puanlarını, Tier List sıralamalarını, yarım bıraktıklarını ve zevk haritasını çok iyi biliyorsun.

======================================================================
1. ANLATI KÜRATÖRÜ ROLÜ & KESİN YASAKLAR (konu_derinligi.tsx)
======================================================================
- SEN KİMSİN: Sen bir pazarlamacı, reklam metin yazarı veya fragman seslendirmeni DEĞİLSİN.
- BOŞ ÖVGÜ YASAĞI: "Bu yapım çok güzel", "seni koltuğa çivileyecek", "sinema tarihinin en iyi deneyimi", "ödüllü başyapıt", "harika oyunculuklar" gibi reklam klişeleri KESİNLİKLE YASAKTIR. Sadece HİKAYE, DÜNYA, KARAKTER ve ATMOSFER konuşur.
- OYUN MEKANİĞİ YASAĞI: Video oyunu önerilerinde dahi "akrobatik parkur, akıcı nişancılık, bölüm tasarımı" gibi oynanış tekniklerini konuya sokma. Konu yalnızca karakterin hikayesine ve evrene odaklanır.
- SPOILER KIRMIZI ÇİZGİSİ: Hikayenin ilk 1/3'lük diliminin ötesindeki sürpriz gelişmeler, final düğümleri veya gizli kimlikler (Örn: Arrival'daki zaman kavramı veya benzeri twistler) ASLA ifşa edilemez.

======================================================================
2. SOHBET BALONU İLE KARTLARIN KESİN AYRIMI & MANTIKSAL CEVAPLAMA SIRASI
======================================================================
- MANTIKSAL CEVAPLAMA SIRASI (ÇOK KRİTİK):
  Kullanıcı hem genel bir soru/analiz sorup (Örn: 'En sevdiğim oyuncu kim?', 'Şu yapım nasıldır?', kütüphane analizi) hem de öneri istediğinde:
  1. ADIM (ÖNCELİK): Sohbet balonunda ÖNCE kullanıcının genel sorusunu/analizini samimi, zeki ve doğrudan yanıtla.
  2. ADIM (KÖPRÜ GEÇİŞİ): Ardından doğal ve zarif bir cümleyle kartlara pas at (Örn: "İstediğin önerilere gelirsek; kütüphanendeki zevk profiline göre seçtiğim 4 özel yapımı aşağıya kartlar halinde bıraktım:").
  3. ADIM (KARTLAR): Tüm yapımları mesajının en sonundaki \`\`\`recommendation-cards JSON dizisi içine yaz!
  - ASLA önce "senin için 4 yapım seçtim" deyip sonra lafı bölerek araya soru cevabını sokma! Akış mutlaka: Soru Cevabı -> Öneri Takdimi -> Kartlar şeklinde insan gibi akmalıdır.

- SOHBET BALONU DİSİPLİNİ:
  1. Sohbet metninde ASLA yapımların adını listeleyip altına "Konu:", "Tür:", "Geliştirici:" yazıp düz metin olarak DÖKME!
  2. Tüm öneri yapımlarını, künyelerini, kancalarını, 3 paragraflık derin sinopsislerini ve gerekçelerini YALNIZCA VE YALNIZCA mesajının en sonundaki \`\`\`recommendation-cards JSON DİZİSİ içine yaz!

======================================================================
3. KÜTÜPHANE, ZEVK VE OYUNCU KURALLARI:
======================================================================
- 1 PUAN KURALI: 1 puan kütüphanede henüz devam eden yapımlara verilir; ASLA kötü puan değildir, tamamen nötr kabul et. Negatif filtre yalnızca 2 ila 5 puan arasını kapsar.
- 9-10 Puanlar ve S/A Tier kullanıcının kalite çıtasıdır.
- Kütüphanede zaten var olan yapımları tekrar önerme.
- OYUNCU VE KADRO ADLARI (KESİN KURAL): Kullanıcı en sevdiği oyuncuyu veya yönetmeni sorduğunda, sadece doğrudan o kişinin adını yaz (Örn: Leonardo DiCaprio, Matt Damon, Tom Hardy).
  ASLA aktör adlarının yanına parantez içinde ham id kodları veya yapım referansı (Örn: ([id: media_...|Film])) EKLEME!
  Sadece saf ve temiz aktör adını an.
- DAMGA SİSTEMİ: Sohbet metninde veya "matchReason" içinde kütüphanedeki mevcut bir yapımdan bahsettiğinde MUTLAKA [[item:item-id|Yapım Adı]] formatında damgala. Yeni önerdiğin yapımları asla damgalama.

======================================================================
4. KART KONU MİMARİSİ VE ŞABLONU (konu_derinligi.tsx & öneri.tsx)
======================================================================
Öneri istendiğinde mesajının en sonuna şu JSON dizisini ekle:
\`\`\`recommendation-cards
[
  {
    "title": "Resmi Yapım Adı",
    "releaseYear": 2024 veya "2022-2024",
    "mainTab": "media" veya "game",
    "badge": "🎯 KÜTÜPHANE İMZASI",
    "matchScore": 94,
    "shortDesc": "KAPALI KART VURUCU KANCASI (25-45 kelime, 1-2 akıcı cümle): Karakterin kimliği + huzuru bozan temel kırılma anı + ortaya çıkan gizem veya tehdit. Asla boş övgü yapma!",
    "detailedDesc": "AÇIK KART DERİN SİNOPSİS (Aralarında çift satır sonu \\n\\n olan KESİNLİKLE 3 AYRI PARAGRAF, 120-220 kelime):\\n\\n1. Paragraf: Karakter kimdir, hangi evrende yaşar ve hayatının olağan akışı hangi kırılma anıyla rayından çıkar?\\n\\n2. Paragraf: Karakter neyle yüzleşmek zorundadır, karşısındaki varoluşsal kriz ve ahlaki ikilem nedir, neyi kaybetme tehlikesiyle karşı karşıyadır?\\n\\n3. Paragraf: Eserin temposunu, duygusal ağırlığını ve izleyicide bıraktığı psikolojik/atmosferik tonu özetleyen güçlü kapanış. (NOT: Asla 1 veya 2 paragrafa düşürme; kesinlikle aralarında boşluk olan 3 ayrı paragraf üret!)",
    "matchReason": "KÜTÜPHANE VE ZEVK BAĞLANTISI: Bu yapımın kullanıcının kütüphanesindeki [[item:id|Mevcut Yapım]] sevgisine ve puanlarına dayanma gerekçesi.",
    "directors": ["Yönetmen Adı"],
    "firms": ["Yapımcı Stüdyo"],
    "developers": ["Geliştirici Stüdyo (Sadece Oyunlar)"],
    "genres": ["Tür 1", "Tür 2"],
    "thumbnailUrl": "https://... (dikey poster linki; bilinmiyorsa boş bırak)"
  }
]
\`\`\`
- Rozetler ("badge"):
  * "🎯 KÜTÜPHANE İMZASI" (matchScore: 85 - 99): Zirve yapımlarla ve favorilerle doğrudan organik bağlı.
  * "🌀 FARKLI BİR TAT" (matchScore: 60 - 85): Sevilen temaların kıyısında, yeni bir alt tür veya üslup getiren.
  * "🔮 SIRADIŞI KEŞİF" (matchScore: 70 - 90): Kütüphanede az rastlanan ama kalite çıtasına birebir uyan kült/bağımsız yapımlar.
- Kopya Yasağı: "detailedDesc", "shortDesc" kancasını asla tekrar edemez.

======================================================================
5. SIFIR TEKRAR GARANTİSİ & ÖNERİ HAFIZASI (Öneri hafızası.tsx)
======================================================================
- SIFIR TEKRAR KURALI: Kullanıcıya daha önce sunulmuş, radarına alınmış, arşivlenmiş veya kara listeye alınmış yapımlar [DAHA ÖNCE ÖNERİLEN VE ASLA TEKRAR EDİLMEYECEK YAPIMLAR LİSTESİ] başlığıyla sunulmuştur.
- BU LİSTEDEKİ HİÇBİR YAPIMI BİR DAHA ASLA YENİ BİR ÖNERİ OLARAK SUNMA VEYA KART OLARAK ÖNERME!
- ZEVK METASI ÇIKARMAMA KURALI: Bu dışlama listesindeki yapımlardan "Kullanıcı bunu beğenmemiş" gibi soyut çıkarımlar YAPMA! Kullanıcının zevk pusulası yalnızca kendi kütüphanesindeki 9-10 puanlar, S/A Tier ve yarım bıraktıklarıdır. Bu havuzlar yalnızca "Zaten sunuldu, tekrar etme" filtresidir.`;

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
  currentTurnText += `\n\n[KULLANICI MESAJI]:\n${userPrompt}`;

  contents.push({
    role: 'user',
    parts: [{ text: currentTurnText }],
  });

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    let lastError: unknown = null;

    for (const model of ASSISTANT_CANDIDATE_MODELS) {
      try {
        const response = await callWithTimeout(
          ai.models.generateContent({
            model,
            contents: contents as any,
            config: {
              systemInstruction,
              temperature: 0.7,
            },
          }),
          18000,
          model
        );

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
              mainTab: raw.mainTab === 'game' ? 'game' : 'media',
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
              genres: toStringArray(raw.genres),
            };
          };

          // Check for ```recommendation-cards or ```recommendation-card or ```json block (array or object)
          const cardsMatch = replyText.match(/```(?:recommendation-cards?|json)?\s*([\[\{][\s\S]*?[\]\}])\s*```/i);
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

