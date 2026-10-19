/**
 * LORE — TMDB (The Movie Database) API & Image Engine
 * Resimler.md Şartnamesi - 1. Aşama: Bağlantı Motoru ve Kimlik Doğrulama
 */

export const TMDB_API_KEY_STORAGE_KEY = 'lore_tmdb_api_key';
export const ASSISTANT_IMAGES_ENABLED_STORAGE_KEY = 'lore_assistant_images_enabled';

export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
export const TMDB_POSTER_SIZE = 'w342';
export const TMDB_BACKDROP_SIZE = 'w780';
export const TMDB_LIGHTBOX_SIZE = 'w1280';

/**
 * Tarayıcı hafızasından (localStorage) TMDB API anahtarını veya jetonunu okur.
 * AppData veya git sync içerisine ASLA dahil edilmez.
 */
export function getTmdbApiKey(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem(TMDB_API_KEY_STORAGE_KEY) ||
    (import.meta as any).env?.VITE_TMDB_API_KEY ||
    ''
  );
}

/**
 * TMDB API anahtarını güvenli şekilde tarayıcı hafızasına yazar veya temizler.
 */
export function setTmdbApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  if (!trimmed) {
    localStorage.removeItem(TMDB_API_KEY_STORAGE_KEY);
  } else {
    localStorage.setItem(TMDB_API_KEY_STORAGE_KEY, trimmed);
  }
}

/**
 * Asistan görsellerinin etkin olup olmadığını kontrol eder.
 * Varsayılan: true (Açık). Kullanıcı 'false' yaparsa sıfır görsel çekilir.
 */
export function getAssistantImagesEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem(ASSISTANT_IMAGES_ENABLED_STORAGE_KEY);
  if (val === null) return true; // Varsayılan açık
  return val !== 'false';
}

/**
 * Asistan görsellerini açma/kapama durumunu kaydeder.
 */
export function setAssistantImagesEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ASSISTANT_IMAGES_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
}

/**
 * Girilen anahtarın TMDB v4 Read Access Token (uzun JWT 'eyJ...') mı yoksa
 * standart v3 API Key (~32 hex karakter) mi olduğunu otomatik algılar.
 */
export function isTmdbReadAccessToken(key: string): boolean {
  const trimmed = key.trim();
  return trimmed.startsWith('eyJ') || trimmed.length > 50;
}

/**
 * TMDB API bağlantısını canlı olarak doğrular.
 * Çift format desteği: v3 API key veya v4 Bearer Token'ı otomatik tanır.
 */
export async function testTmdbConnection(
  apiKey: string
): Promise<{ success: boolean; message: string; keyType?: 'v3_key' | 'v4_token' }> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return {
      success: false,
      message: 'Lütfen test etmeden önce bir TMDB API anahtarı veya jetonu girin.',
    };
  }

  const isToken = isTmdbReadAccessToken(trimmed);
  const keyType: 'v3_key' | 'v4_token' = isToken ? 'v4_token' : 'v3_key';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7500);

  try {
    const url = isToken
      ? 'https://api.themoviedb.org/3/configuration'
      : `https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(trimmed)}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (isToken) {
      headers['Authorization'] = `Bearer ${trimmed}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const typeLabel = isToken ? 'v4 Okuma Jetonu (Bearer)' : 'v3 API Anahtarı';
      return {
        success: true,
        message: `Bağlantı Başarılı! TMDB sunucuları doğrulandı (${typeLabel}).`,
        keyType,
      };
    }

    if (response.status === 401) {
      return {
        success: false,
        message:
          'Geçersiz TMDB Anahtarı! (401 Yetkisiz). Lütfen themoviedb.org hesabınızdaki anahtarı kontrol edin.',
        keyType,
      };
    }

    if (response.status === 404) {
      return {
        success: false,
        message: 'TMDB servisine ulaşılamadı (404 Not Found).',
        keyType,
      };
    }

    return {
      success: false,
      message: `TMDB sunucu yanıtı: HTTP ${response.status} ${response.statusText}`,
      keyType,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return {
        success: false,
        message:
          'TMDB sunucularına bağlanırken zaman aşımı oluştu (7.5 sn). Lütfen internet bağlantınızı kontrol edin.',
        keyType,
      };
    }
    return {
      success: false,
      message: `Bağlantı hatası: ${err.message || String(err)}`,
      keyType,
    };
  }
}

/**
 * TMDB dikey afiş URL'i oluşturucu (w342)
 */
export function buildTmdbPosterUrl(posterPath: string | null | undefined): string | null {
  if (!posterPath) return null;
  const clean = posterPath.startsWith('/') ? posterPath : `/${posterPath}`;
  return `${TMDB_IMAGE_BASE_URL}/${TMDB_POSTER_SIZE}${clean}`;
}

/**
 * TMDB sahne ve atmosfer karesi URL'i oluşturucu (vitrin için w780, lightbox için w1280)
 */
export function buildTmdbBackdropUrl(
  backdropPath: string | null | undefined,
  size: 'preview' | 'full' = 'preview'
): string | null {
  if (!backdropPath) return null;
  const clean = backdropPath.startsWith('/') ? backdropPath : `/${backdropPath}`;
  const sizeSegment = size === 'full' ? TMDB_LIGHTBOX_SIZE : TMDB_BACKDROP_SIZE;
  return `${TMDB_IMAGE_BASE_URL}/${sizeSegment}${clean}`;
}

export interface TmdbMediaMatch {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  originalTitle?: string;
  posterPath: string | null;
  posterUrl: string | null;
  backdropPath: string | null;
  releaseYear?: number;
}

/**
 * Başlıkları karşılaştırma için normalize eder (Türkçe karakterler, küçük harf, noktalama temizliği).
 */
export function normalizeTitleForComparison(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .trim()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * İki normalize başlık arasındaki benzerliği hesaplar (0.0 - 1.0).
 */
function computeTitleSimilarity(normTarget: string, normCandidate: string): number {
  if (!normTarget || !normCandidate) return 0;
  if (normTarget === normCandidate) return 1.0;
  // Boşluk farkı: "Dandadan" ↔ "DAN DA DAN"
  if (normTarget.replace(/\s/g, '') === normCandidate.replace(/\s/g, '')) return 1.0;

  // 1. Karakter bazlı içerme (Biri diğerini içeriyorsa)
  let inclScore = 0;
  if (normCandidate.includes(normTarget) || normTarget.includes(normCandidate)) {
    const minLen = Math.min(normTarget.length, normCandidate.length);
    const maxLen = Math.max(normTarget.length, normCandidate.length);
    inclScore = 0.8 * (minLen / maxLen);
  }

  // 2. Kelime kümesi benzerliği (Jaccard)
  const wordsTarget = new Set(normTarget.split(' ').filter(Boolean));
  const wordsCandidate = new Set(normCandidate.split(' ').filter(Boolean));
  let jaccard = 0;
  if (wordsTarget.size > 0 && wordsCandidate.size > 0) {
    let common = 0;
    for (const w of wordsTarget) {
      if (wordsCandidate.has(w)) common++;
    }
    const union = new Set([...wordsTarget, ...wordsCandidate]).size;
    jaccard = union > 0 ? common / union : 0;
  }

  // 3. Alt başlık: "Frieren" ↔ "Frieren: Beyond Journey's End" (bir başlık diğerinin tam kelimeli başı)
  let prefixScore = 0;
  if (normCandidate.startsWith(normTarget + ' ') || normTarget.startsWith(normCandidate + ' ')) {
    prefixScore = 0.75;
  }

  return Math.max(inclScore, jaccard, prefixScore);
}

// Yıl tutsa bile başlık bu orandan az benziyorsa aday elenir (yanlış afiş koruması)
const MIN_TITLE_SIMILARITY = 0.45;

function parseYearNumber(val?: number | string): number | null {
  if (!val) return null;
  if (typeof val === 'number' && !isNaN(val)) return val;
  const match = String(val).match(/\d{4}/);
  if (match) {
    const parsed = parseInt(match[0], 10);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

// In-memory cache for search queries to avoid repeated network hits
const searchCache = new Map<string, Promise<TmdbMediaMatch | null>>();

/**
 * TMDB üzerinden medya (film/dizi) arar ve başlık/yıl doğrulaması yaparak eşleştirir.
 * "Yanlış görsel, görselsizlikten kötüdür" ilkesiyle; uyuşmayan sonuçlar elenir ve null döner.
 */
export async function searchTmdbMedia(
  title: string,
  releaseYear?: number | string
): Promise<TmdbMediaMatch | null> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return null;

  // Görseller kapatılmışsa sıfır veri harcanır
  if (!getAssistantImagesEnabled()) return null;

  const apiKey = getTmdbApiKey();
  if (!apiKey) return null;

  const normTarget = normalizeTitleForComparison(trimmedTitle);
  const targetYear = parseYearNumber(releaseYear);
  const cacheKey = `${normTarget}_${targetYear || 'noyear'}`;

  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey)!;
  }

  const promise = (async (): Promise<TmdbMediaMatch | null> => {
    try {
      // Temiz arama terimi: parantez içindeki yıl veya ekleri kaldır
      const cleanQuery = trimmedTitle
        .replace(/\s*\(\d{4}(?:-\d{4})?\)\s*/g, ' ')
        .replace(/\s*\([^)]*\)\s*/g, ' ')
        .replace(/\[[^\]]*\]/g, ' ')
        .trim() || trimmedTitle;

      const isToken = isTmdbReadAccessToken(apiKey);

      type SearchOutcome = {
        match: { candidate: any; score: number } | null;
        // Başlık hiç tutmadığında TMDB'nin kendi ilk 2 sonucundan yılı birebir tutan aday
        // (romaji/alternatif adlar: "Sen to Chihiro no Kamikakushi" → "Spirited Away")
        trusted: any | null;
      };

      const searchWithLang = async (
        query: string,
        normQuery: string,
        lang: string
      ): Promise<SearchOutcome> => {
        const empty: SearchOutcome = { match: null, trusted: null };
        try {
          const url = new URL('https://api.themoviedb.org/3/search/multi');
          url.searchParams.set('query', query);
          url.searchParams.set('include_adult', 'false');
          url.searchParams.set('language', lang);

          if (!isToken) {
            url.searchParams.set('api_key', apiKey);
          }

          const headers: Record<string, string> = {
            Accept: 'application/json',
          };
          if (isToken) {
            headers['Authorization'] = `Bearer ${apiKey}`;
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6500);

          const response = await fetch(url.toString(), {
            method: 'GET',
            headers,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) return empty;

          const data = await response.json();
          const results: any[] = Array.isArray(data.results) ? data.results : [];

          // Sadece film ve dizileri tara, afişi olmayanları ele
          const candidates = results.filter(
            (item) => (item.media_type === 'movie' || item.media_type === 'tv') && Boolean(item.poster_path)
          );

          if (candidates.length === 0) return empty;

          const trusted = targetYear
            ? candidates
                .slice(0, 2)
                .find((item) => parseYearNumber(item.release_date || item.first_air_date) === targetYear) || null
            : null;

          let best: any = null;
          let highest = -1;

          for (const item of candidates) {
            const candTitle = item.title || item.name || '';
            const candOrigTitle = item.original_title || item.original_name || '';
            const candDateStr = item.release_date || item.first_air_date || '';
            const candYear = parseYearNumber(candDateStr);

            // Başlık benzerliği
            const titleScore1 = computeTitleSimilarity(normQuery, normalizeTitleForComparison(candTitle));
            const titleScore2 = computeTitleSimilarity(normQuery, normalizeTitleForComparison(candOrigTitle));
            const bestTitleScore = Math.max(titleScore1, titleScore2);
            if (bestTitleScore < MIN_TITLE_SIMILARITY) continue;

            // Yıl benzerliği
            let yearScore = 0.7; // Nötr
            // Yıl biliniyor ama adayın tarihi yoksa genelde henüz çıkmamış başka bir yapımdır
            // ("Solo Leveling" dizisi ↔ tarihsiz "Solo Leveling: Beyond the System" filmi)
            if (targetYear && !candYear) continue;
            if (targetYear && candYear) {
              const diff = Math.abs(targetYear - candYear);
              // ±1 yıl esneklik (Resimler.md kuralı); daha fazlası aynı adlı başka yapımdır
              // ("Kimi no Na wa" 2016 filmi ↔ 1991 dizisi)
              if (diff >= 2) continue;
              yearScore = diff === 0 ? 1.0 : 0.85;
            }

            // Genel eşleşme puanı
            const totalScore = targetYear
              ? bestTitleScore * 0.65 + yearScore * 0.35
              : bestTitleScore;

            if (totalScore > highest) {
              highest = totalScore;
              best = item;
            }
          }

          if (best && highest >= 0.55) {
            return { match: { candidate: best, score: highest }, trusted };
          }
          return { match: null, trusted };
        } catch {
          return empty;
        }
      };

      // 1. Aşama: Önce Türkçe başlıklar için 'tr-TR' ile dene
      let outcome = await searchWithLang(cleanQuery, normTarget, 'tr-TR');
      let bestCandidate: any = outcome.match?.candidate || null;

      // 2. Aşama: Eğer eşleşme bulunamadıysa (Örn: Anime veya yabancı yapımlarda Türkçe başlık
      // kaydı olmayınca TMDB'nin orijinal Japonca başlığı dönmesi ve İngilizce adın kaybolması durumu),
      // uluslararası 'en-US' ile dene
      let enOutcome: SearchOutcome | null = null;
      if (!bestCandidate) {
        enOutcome = await searchWithLang(cleanQuery, normTarget, 'en-US');
        bestCandidate = enOutcome.match?.candidate || null;
      }

      // 3. Aşama: Parantez içindeki diğer ad ile dene: "Bir Kedinin Zihninde (Inside the Mind of a Cat)"
      if (!bestCandidate) {
        const altTitles = Array.from(trimmedTitle.matchAll(/\(([^)]*)\)/g))
          .map((m) => m[1].trim())
          .filter((t) => t && !/^\d{4}(?:\s*[-–]\s*\d{0,4})?$/.test(t));
        for (const alt of altTitles) {
          const normAlt = normalizeTitleForComparison(alt);
          for (const lang of ['tr-TR', 'en-US']) {
            const altOutcome = await searchWithLang(alt, normAlt, lang);
            if (altOutcome.match) {
              bestCandidate = altOutcome.match.candidate;
              break;
            }
          }
          if (bestCandidate) break;
        }
      }

      // 4. Aşama: Başlık hiçbir adayla tutmadıysa TMDB'nin kendi ilk sonuçlarına güven,
      // ama sadece yıl birebir tutuyorsa
      if (!bestCandidate) {
        bestCandidate = outcome.trusted || enOutcome?.trusted || null;
      }

      // Güvenilirlik eşiği: Yanlış afiş göstermektense yer tutucu kalmalıdır
      if (!bestCandidate) {
        return null;
      }

      const mediaType: 'movie' | 'tv' = bestCandidate.media_type === 'tv' ? 'tv' : 'movie';
      const posterPath: string = bestCandidate.poster_path;
      const backdropPath: string | null = bestCandidate.backdrop_path || null;
      const matchedYear = parseYearNumber(bestCandidate.release_date || bestCandidate.first_air_date);

      return {
        tmdbId: bestCandidate.id,
        mediaType,
        title: bestCandidate.title || bestCandidate.name || trimmedTitle,
        originalTitle: bestCandidate.original_title || bestCandidate.original_name,
        posterPath,
        posterUrl: buildTmdbPosterUrl(posterPath),
        backdropPath,
        releaseYear: matchedYear || undefined,
      };
    } catch {
      return null;
    }
  })();

  searchCache.set(cacheKey, promise);
  // Sadece bulunan sonuçlar hafızada kalır; bulunamayan (veya anlık ağ hatası) bir sonraki seferde yeniden denenir
  promise.then((result) => {
    if (!result && searchCache.get(cacheKey) === promise) searchCache.delete(cacheKey);
  });
  return promise;
}

export interface TmdbSceneImage {
  filePath: string;
  previewUrl: string; // Vitrin için w780
  fullUrl: string;    // Lightbox tam ekran için w1280
  width?: number;
  height?: number;
  isTextless: boolean;
}

const imagesCache = new Map<string, Promise<TmdbSceneImage[]>>();

/**
 * Bir yapımın TMDB üzerinden 10-15 adet yüksek çözünürlüklü sahne karelerini çeker.
 * Dilsiz/yazısız (iso_639_1 === null) sinematik atmosfer sahneleri önceliklendirilir.
 */
export async function fetchTmdbMovieOrTvImages(
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  fallbackBackdropPath?: string | null
): Promise<TmdbSceneImage[]> {
  if (!getAssistantImagesEnabled()) return [];
  const apiKey = getTmdbApiKey();
  if (!apiKey || !tmdbId) return [];

  const cacheKey = `${mediaType}_${tmdbId}`;
  if (imagesCache.has(cacheKey)) {
    return imagesCache.get(cacheKey)!;
  }

  const promise = (async (): Promise<TmdbSceneImage[]> => {
    try {
      const isToken = isTmdbReadAccessToken(apiKey);
      const url = new URL(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/images`);
      // en ve null (dilsiz) parametresi garanti sonuç için standart formattadır
      url.searchParams.set('include_image_language', 'en,null,ja,tr');

      if (!isToken) {
        url.searchParams.set('api_key', apiKey);
      }

      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (isToken) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7500);

      let response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      // Eğer 400 veya dil hatası verirse dil filtresi olmadan yalın tekrar dene
      if (!response.ok) {
        url.searchParams.delete('include_image_language');
        response = await fetch(url.toString(), {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (fallbackBackdropPath) {
          return [
            {
              filePath: fallbackBackdropPath,
              previewUrl: buildTmdbBackdropUrl(fallbackBackdropPath, 'preview')!,
              fullUrl: buildTmdbBackdropUrl(fallbackBackdropPath, 'full')!,
              isTextless: true,
            },
          ];
        }
        return [];
      }

      const data = await response.json();
      const backdrops: any[] = Array.isArray(data.backdrops) ? data.backdrops : [];

      if (backdrops.length === 0) {
        if (fallbackBackdropPath) {
          return [
            {
              filePath: fallbackBackdropPath,
              previewUrl: buildTmdbBackdropUrl(fallbackBackdropPath, 'preview')!,
              fullUrl: buildTmdbBackdropUrl(fallbackBackdropPath, 'full')!,
              isTextless: true,
            },
          ];
        }
        return [];
      }

      // 1. En-Boy Oranı Filtresi: Kareye yakın, dikey veya basık görselleri ele (oran >= 1.35)
      // Nadir veya eski yapımlarda hiç görsel kalmama riskine karşı koruma (fallback)
      const validBackdrops = backdrops.filter((b) => {
        if (!b.file_path) return false;
        const ratio =
          typeof b.aspect_ratio === 'number' && b.aspect_ratio > 0
            ? b.aspect_ratio
            : b.width && b.height
            ? b.width / b.height
            : 1.77;
        return ratio >= 1.35;
      });

      // Eğer oran filtresinden hiç resim geçemediyse (nadir/eski eserler), tüm geçerli resimleri koru
      const candidatePool = validBackdrops.length > 0 ? validBackdrops : backdrops.filter((b) => Boolean(b.file_path));

      // 2. Kalite ve Beğeni Sıralaması:
      // - Öncelik 1: Yazısız/dilsiz (iso_639_1 === null) saf sinematik atmosfer kareleri
      // - Öncelik 2: Dengeli kalite skoru (Oy veren kişi sayısı + Ortalama beğeni puanı)
      const sorted = [...candidatePool].sort((a, b) => {
        const aTextless = a.iso_639_1 === null ? 1 : 0;
        const bTextless = b.iso_639_1 === null ? 1 : 0;
        if (aTextless !== bTextless) return bTextless - aTextless;

        // Puan (vote_average) ve Oy Sayısı (vote_count) dengesi:
        // Yalnızca 1 kişinin 10 verdiği vasat resimleri engellemek için oy sayısına ağırlık verilir.
        const scoreA = (a.vote_count || 0) * 2 + (a.vote_average || 0);
        const scoreB = (b.vote_count || 0) * 2 + (b.vote_average || 0);
        return scoreB - scoreA;
      });

      // 3. Zirvedeki 4 Kareyi Koruma & Kalan Havuzdan Çeşitlilik Sağlama:
      // - İlk 4 görsel: Topluluğun en çok beğendiği zirvedeki 4 kare ASLA atlanmadan doğrudan alınır.
      // - Kalan 11 görsel: Aynı sahnenin/karakterin peş peşe 7 karesi gelmesin diye havuzun devamından
      //   dengeli aralıklarla örneklenir.
      let finalSelection: any[] = [];
      if (sorted.length <= 15) {
        finalSelection = sorted;
      } else {
        const guaranteedTop = sorted.slice(0, 4);
        const remainingPool = sorted.slice(4);
        const slotsNeeded = 11;

        if (remainingPool.length <= slotsNeeded) {
          finalSelection = [...guaranteedTop, ...remainingPool];
        } else {
          // Havuz boyunca eşit aralıklı adım atlayarak çeşitlilik sağla
          const step = remainingPool.length / slotsNeeded;
          const sampled: any[] = [];
          for (let i = 0; i < slotsNeeded; i++) {
            const pickIndex = Math.min(Math.floor(i * step), remainingPool.length - 1);
            sampled.push(remainingPool[pickIndex]);
          }
          finalSelection = [...guaranteedTop, ...sampled];
        }
      }

      return finalSelection.map((b) => ({
        filePath: b.file_path,
        previewUrl: buildTmdbBackdropUrl(b.file_path, 'preview')!,
        fullUrl: buildTmdbBackdropUrl(b.file_path, 'full')!,
        width: b.width,
        height: b.height,
        isTextless: b.iso_639_1 === null,
      }));
    } catch {
      if (fallbackBackdropPath) {
        return [
          {
            filePath: fallbackBackdropPath,
            previewUrl: buildTmdbBackdropUrl(fallbackBackdropPath, 'preview')!,
            fullUrl: buildTmdbBackdropUrl(fallbackBackdropPath, 'full')!,
            isTextless: true,
          },
        ];
      }
      return [];
    }
  })();

  imagesCache.set(cacheKey, promise);
  // Boş liste veya yedek tek kare (hata durumu) hafızada tutulmaz, sonraki açılışta yeniden denenir
  promise.then((list) => {
    if (list.length <= 1 && imagesCache.get(cacheKey) === promise) imagesCache.delete(cacheKey);
  });
  return promise;
}

const trailerCache = new Map<string, Promise<string | null>>();

/**
 * Bir yapımın TMDB üzerinden resmi YouTube fragman anahtarını (video key) çeker.
 * Öncelik: site === 'YouTube' && type === 'Trailer' (resmi olanlar önde)
 * Görseller kapalıysa veya anahtar yoksa null döner.
 */
export async function fetchTmdbTrailer(
  tmdbId: number,
  mediaType: 'movie' | 'tv'
): Promise<string | null> {
  if (!getAssistantImagesEnabled()) return null;
  const apiKey = getTmdbApiKey();
  if (!apiKey || !tmdbId) return null;

  const cacheKey = `trailer_${mediaType}_${tmdbId}`;
  if (trailerCache.has(cacheKey)) {
    return trailerCache.get(cacheKey)!;
  }

  const promise = (async (): Promise<string | null> => {
    try {
      const isToken = isTmdbReadAccessToken(apiKey);
      const url = new URL(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/videos`);

      if (!isToken) {
        url.searchParams.set('api_key', apiKey);
      }

      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (isToken) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) return null;

      const data = await response.json();
      const results: any[] = Array.isArray(data.results) ? data.results : [];

      const youtubeVideos = results.filter((v) => v.site === 'YouTube' && Boolean(v.key));
      if (youtubeVideos.length === 0) return null;

      // Sıralama Önceliği:
      // 1. type === 'Trailer' && official === true
      // 2. type === 'Trailer'
      // 3. type === 'Teaser' && official === true
      // 4. Herhangi bir YouTube videosu
      const sorted = [...youtubeVideos].sort((a, b) => {
        const score = (v: any) => {
          let s = 0;
          if (v.type === 'Trailer') s += 10;
          else if (v.type === 'Teaser') s += 5;
          if (v.official) s += 4;
          return s;
        };
        return score(b) - score(a);
      });

      return sorted[0]?.key || null;
    } catch {
      return null;
    }
  })();

  trailerCache.set(cacheKey, promise);
  promise.then((key) => {
    if (!key && trailerCache.get(cacheKey) === promise) trailerCache.delete(cacheKey);
  });
  return promise;
}


