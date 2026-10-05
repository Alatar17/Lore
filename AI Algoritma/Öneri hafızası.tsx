/**
 * ============================================================================
 * LORE AI - ÖNERİ HAFIZASI VE DİNAMİK HAVUZ SİSTEMİ (Öneri hafızası.tsx)
 * ============================================================================
 * 
 * Bu döküman, Lore AI Küratörünün kullanıcıya daha önce önerdiği yapımları
 * hatırlaması, tekrar eden önerilerin önüne geçmesi ve kullanıcının önerileri
 * kategorize ederek yönetmesini sağlayan hafıza mimarisini tanımlar.
 */

// ============================================================================
// 1. SİSTEMİN TEMEL AMACI VE FELSEFESİ
// ============================================================================
/**
 * 1. SIFIR TEKRAR GARANTİSİ (DEDUPING & COOLDOWN):
 *    - Kullanıcı yapay zekadan öneri istediğinde, sistemin daha önce sunduğu
 *      yapımları tekrar tekrar listelemesini %100 engellemek.
 *
 * 2. ZEVK METASI ÇIKARMAMA KURALI (ÖNEMLİ):
 *    - Yapay zeka bu havuzlardaki yapımlardan "Kullanıcı bunu beğenmemiş, o zaman
 *      bu türü önermeyeyim" gibi soyut çıkarımlar YAPMAZ.
 *    - Kullanıcının zevk pusulası zaten doğrudan kendi kütüphanesindeki 9-10 puanlar,
 *      S/A Tier yapımlar, oynama saatleri ve Dropped (yarım bırakılanlar) listesidir.
 *    - YAPAY ZEKA GÖZÜNDE BU 3 HAVUZUN ORTAK ANLAMI:
 *      👉 "Bu yapım kullanıcının havuzunda (Radar, Kara Liste veya Arşiv) zaten var.
 *         Bu sebeple bu yapımın adını bir daha ASLA YENİ BİR ÖNERİ OLARAK SUNMA!"
 *      (İster beğenilip Radara alınsın, ister sevilmeyip Kara Listeye atılsın,
 *       isterse de Arşivde beklesin; AI gözünde hepsi 'Zaten sunuldu, tekrar etme' filtresidir.)
 *
 * 3. KULLANICI KONTROLÜ:
 *    - Kullanıcı önerilen yapımları kendi istek listesine alabilir,
 *      istemediğini kara listeye atabilir, arşivde bırakabilir veya dilediğini silebilir.
 */

// ============================================================================
// 2. HAVUZ İSİMLENDİRMESİ VE SİLİNME / KALICILIK KURALLARI
// ============================================================================
/**
 * 1. HAVUZ: 🎯 RADAR (İzleme / Oynama Listesi)
 *    - Anlamı: "AI bunu önerdi, aklıma yattı; radarıma aldım, daha sonra izleyeceğim/oynayacağım."
 *    - Ömrü: KESİNLİKLE KALICI (Kullanıcı kendi isteğiyle silene kadar 10 yıl da geçse ASLA silinmez).
 *    - Kullanıcı Gözünde: Kişisel istek / merak listesi.
 *    - AI Gözünde: Zaten önerildi, tekrar önerme.
 *
 * 2. HAVUZ: 🚫 KARA LİSTE (Pas Geçilenler)
 *    - Anlamı: "Bu yapımı bir daha kesinlikle hiçbir öneride görmek istemiyorum."
 *    - Ömrü: KESİNLİKLE KALICI (Kullanıcı listeden çıkartana kadar sistem ASLA silemez).
 *    - Kullanıcı Gözünde: İlgilenmediği / elediği yapımlar.
 *    - AI Gözünde: Kesin yasaklı, asla önerilmeyecek yapım.
 *
 * 3. HAVUZ: 📦 ÖNERİ ARŞİVİ (Beklemedekiler / Nötr)
 *    - Anlamı: "AI'ın bana bugüne kadar sunduğu tüm önerilerin kayıt defteri."
 *    - Otomatik Kayıt: AI her yeni kart önerdiğinde, kullanıcı hiçbir butona basmasa
 *      dahi yapım otomatik olarak bu havuza sessizce kaydedilir.
 *    - Kapasite: 500 Yapım (En ideal altın denge).
 *    - FIFO Silme Kuralı (SADECE BU HAVUZ İÇİN):
 *      * 500 kapasitesi dolduğunda, SADECE bu 'Öneri Arşivi' havuzundaki en eski
 *        tarihli kayıtlar arkadan sırayla silinir.
 *      * Radar ve Kara Liste'ye bu temizlik döngüsü ASLA DOKUNAMAZ.
 *    - Kullanıcı Gözünde: Geçmiş öneri günlüğü.
 *    - AI Gözünde: Zaten önerildi, tekrar etme.
 */

// ============================================================================
// 3. TETİKLEYİCİLER VE KULLANICI DENEYİMİ (UI & ETKİLEŞİM)
// ============================================================================
/**
 * A) SOHBET MESAJI ALTI ETKİLEŞİMİ (KOPYALAMA İKONUNUN YANI):
 *    - Her asistan mesajının altında (kopyalama butonunun yanına):
 *      1. 👍 [Radara Ekle] Butonu
 *      2. 👎 [Kara Listeye Al] Butonu
 *    - AI tek seferde kartlar önerdiğinde bu butonlara basıldığında:
 *      * Şık bir mini seçim kutusu (popover) açılır.
 *      * Yapımların adları checkbox ile listelenir:
 *        [✓] 1. Titanfall 2
 *        [✓] 2. Mob Psycho 100
 *        [ ] 3. Arrival
 *      * Kullanıcı dilediklerini işaretleyip tek tıkla "Radara Ekle" veya
 *        "Kara Listeye Taşı" der.
 *      * İşaretlenmeyen yapımlar zaten otomatik olarak "Öneri Arşivi" havuzunda kalır.
 *
 * B) YÖNETİM PANELİ (ASİSTAN SAĞ ÜST KÖŞE BUTONU):
 *    - Asistan modalının sağ üst köşesine özel bir "Öneri Hafızası" (Arşiv/Radar) ikonu yerleştirilir.
 *    - Tıklandığında açılan pencere:
 * 
 *      1. ÜST KATEGORİ SEÇİCİ (Segment Switcher):
 *         [Tümü] | [🎬 Medya (Film/Dizi)] | [🎮 Oyunlar]
 *         (Kullanıcı dilerse sadece oyun radarına veya sadece film arşivine tek tıkla filtre koyabilir).
 * 
 *      2. HAVUZ SEKMELERİ (Counts ile birlikte):
 *         [🌐 Tümü (142)] | [🎯 Radar (14)] | [📦 Öneri Arşivi (120)] | [🚫 Kara Liste (8)]
 * 
 *      3. ARAMA VE FİLTRELEME:
 *         - Entegre anlık arama çubuğu (Örn: "Cyberpunk" yazıldığında daha önce
 *           önerilip önerilmediği ve şu an hangi havuzda olduğu saniyesinde listelenir).
 * 
 *      4. TASARIM VE LİSTE FORMATI:
 *         - Kompakt, hızlı taranabilir satır formatı.
 *         - Satır İçeriği:
 *           * Küçük Afiş / Küçük İkon: Sadece web URL'i olarak saklanır (~40x56px minik afiş).
 *             (Poster linki yoksa şık kategori ikonu 🎬/🎮 gösterilir).
 *           * Tür Rozeti: [Film] / [Dizi] / [Oyun] / [Anime].
 *           * Başlık ve Çıkış Yılı.
 *           * Havuz Durumu Rozeti (Tümü sekmesindeyken yeşil 'Radar', gri 'Arşiv', kırmızı 'Kara Liste').
 * 
 *      5. SATIR İÇİ HIZLI AKSİYONLAR:
 *         - Havuzlar arası hızlı taşıma (Arşivden -> Radara veya Kara Listeye tek tıkla aktarma).
 *         - Silme [Çöp Kutusu] Butonu: Yapımı hafızadan tamamen çıkarıp unutulmasını sağlama.
 */

// ============================================================================
// 4. AFİŞLER (POSTERLER) VE DEPOLAMA GÜVENLİĞİ 🖼️
// ============================================================================
/**
 * AFİŞLERLE İLGİLİ SORUN OLUR MU?
 * - CEVAP: Kesinlikle HAYIR! Nedeni:
 *   1. Hafızada ASLA ağır Base64 / ham görsel saklanmaz.
 *   2. Sadece görselin web bağlantısı (URL dizesi, örn: "https://image.tmdb.org/...") saklanır.
 *   3. Bir URL sadece ~60-90 karakterdir.
 *   4. 500 adet yapımın afiş linkleri toplamda yalnızca ~30-40 Kilobayt (KB) yer tutar.
 *   5. Dolayısıyla tarayıcı hafızasını (LocalStorage) asla şişirmez, sıfır kasmayla anında yüklenir.
 *   6. Afiş linki kırık veya boşsa, şık bir gradient kutu içinde 🎬 veya 🎮 ikonu yedek olarak belirir.
 */

// ============================================================================
// 5. İSİM ÇAKIŞMASI VE 500 LİMİT TOKEN HESABI ⚡
// ============================================================================
/**
 * FORMAT STRATEJİSİ: [Tür] Başlık (Yıl)
 * 
 * 1. İsim Çakışmalarının Önlenmesi:
 *    - Witcher, Fallout, Dune, Cyberpunk gibi hem oyun hem sinema uyarlaması
 *      olan yapımların birbirine karışmaması için AI'a kesin format iletilir:
 *      👉 [Tür] Başlık (Yıl)
 *      Örnek:
 *        - [Oyun] The Witcher 3 (2015)
 *        - [Dizi] The Witcher (2019)
 * 
 * 2. Kategoriye Göre Dilimleme (Context Slicing):
 *    - Medya sekmesindeyken Oyun havuzu AI'a gönderilmez.
 *    - Oyun sekmesindeyken Medya havuzu AI'a gönderilmez.
 * 
 * 3. 500 Limit Maliyet Hesabı (Altın Denge):
 *    - 500 adet başlık satırı ortalama ~1.500 token harcar.
 *    - Gemini'nin 1.000.000 tokenlik devasa bağlamında bu oran binde 1.5'tir (%0.15).
 *    - Işık hızında çalışır, API kotasını tüketmez ve aylarca sıfır tekrar garantisi verir.
 */

// ============================================================================
// 6. TYPESCRIPT VERİ VE MODEL ŞABLONU
// ============================================================================

export type RecommendationPoolType = 'radar' | 'blacklist' | 'archive';
export type RecommendationFilterTab = 'all' | 'radar' | 'archive' | 'blacklist';
export type RecommendationCategoryFilter = 'all' | 'media' | 'game';

export type RecommendationCategory = 'movie' | 'series' | 'anime' | 'animation' | 'game';

export interface RecommendationMemoryItem {
  id: string; // Benzersiz kayıt id'si (uuid / timestamp)
  title: string; // Yapım adı (Örn: 'Arrival', 'The Witcher 3')
  releaseYear?: number | string; // Yapım yılı (Örn: 2016)
  mainTab: 'media' | 'game'; // 'media' veya 'game'
  subType?: RecommendationCategory; // 'movie' | 'series' | 'anime' | 'animation' | 'game'
  genres?: string[]; // Türler (Örn: ['Bilim Kurgu', 'Gizem'])
  thumbnailUrl?: string; // Küçük afiş linki (Sadece web URL'i, hafif)
  pool: RecommendationPoolType; // 'radar' | 'blacklist' | 'archive'
  recommendedAt: number; // İlk önerilme zaman damgası (Date.now())
  updatedAt?: number; // Havuz değiştirilme tarihi
}

export interface RecommendationMemoryState {
  version: number;
  maxArchiveLimit: number; // Varsayılan 500
  items: RecommendationMemoryItem[];
}

/**
 * 500 Kapasite Dolduğunda SADECE Arşivden Silme Yapan FIFO Fonksiyonu:
 * Radar ve Kara Liste kayıtlarına ASLA dokunmaz!
 */
export function pruneArchiveIfExceeded(
  items: RecommendationMemoryItem[],
  maxArchiveLimit: number = 500
): RecommendationMemoryItem[] {
  const archiveItems = items.filter((it) => it.pool === 'archive');
  const nonArchiveItems = items.filter((it) => it.pool !== 'archive');

  if (archiveItems.length <= maxArchiveLimit) {
    return items;
  }

  // En yeni önerilenler kalsın, en eskiler silinsin
  const sortedArchive = [...archiveItems].sort((a, b) => b.recommendedAt - a.recommendedAt);
  const prunedArchive = sortedArchive.slice(0, maxArchiveLimit);

  return [...nonArchiveItems, ...prunedArchive];
}

/**
 * AI Prompt'una eklenecek negatif kısıt / hariç tutma dizesini oluşturan yardımcı:
 */
export function formatExclusionListForPrompt(
  items: RecommendationMemoryItem[],
  activeTab?: 'media' | 'game'
): string {
  // Aktif sekmeye göre filtreleme (Medya ise oyunları yollamaz, oyunsa medyayı yollamaz)
  const filtered = activeTab ? items.filter((it) => it.mainTab === activeTab) : items;

  if (filtered.length === 0) return '';

  const lines = filtered.map((it) => {
    const typeLabel = it.subType ? it.subType.toUpperCase() : it.mainTab === 'game' ? 'OYUN' : 'MEDYA';
    const yearStr = it.releaseYear ? ` (${it.releaseYear})` : '';
    return `- [${typeLabel}] ${it.title}${yearStr}`;
  });

  return `[DAHA ÖNCE ÖNERİLEN VE ASLA TEKRAR EDİLMEYECEK YAPIMLAR LİSTESİ]:\n${lines.join('\n')}`;
}
