# LORE — GÖRSEL & AFİŞ MİMARİSİ (TMDB & ASİSTAN ŞARTNAMESİ)
**Doküman Kodu:** `Resimler.md`  
**Kapsam:** Lore AI Asistan Öneri Kartları & Medya Kategorisi (Film, Dizi, Anime, Animasyon, Belgesel, Diğer)  
**Vizyon:** 1 yıl sonra açıldığında sistemin neden ve nasıl kurulduğunu, kod sınırlarını ve geleceğini eksiksiz anlatan kusursuz anayasa dokümanı.

---

## 1. TEMEL SORUN VE KESİN İŞ BÖLÜMÜ
* **Sorun:** Yapay zeka dil modelleri (Gemini) canlı internetteki gerçek resim dosyası adreslerini bilmez. Görsel istendiğinde halüsinasyonla kırık, sahte ya da alakasız linkler uydurur. Bu yüzden `AiAssistantModal.tsx` içindeki 3'lü sahne galerisi mecburen geçici olarak kapatılmıştır (`false && ...`).
* **İş Bölümü:**
  1. **Gemini (Yalnızca Metin & Anlatı):** 3 paragraflık derin sinopsis, vurucu kanca, kütüphane zevk gerekçesi (`matchReason`), Balatro kuralı, rozetler ve damga sistemini üretir. Gemini promptlarından `"thumbnailUrl"` ve `"galleryImages"` çıktısı **TÜM KATEGORİLER İÇİN TAMAMEN KALDIRILIR**. Gemini'den asla resim linki istenmez.
  2. **TMDB (Resmi Medya Görsel Sağlayıcı):** Medya kategorisi için gerçek dikey afişleri ve yüksek çözünürlüklü sahne karelerini (`backdrops`) sağlayan tek resmi API olur.

---

## 2. KATEGORİ AYRIMI: MEDYA vs OYUN vs KİTAP
Asistan kartlarında görseller şu kesin kurallara göre çalışır:

* **Ortak Kural (Tüm Kategoriler):**
  - Asistan bir öneri sunduğunda; **Medya, Oyun ve Kitap** kartlarının tamamında sol tarafta 1 adet dikey kapak/afiş alanı görünür.
  - **Medya:** TMDB üzerinden resmi dikey afiş anında çekilir.
  - **Oyun ve Kitap:** Gemini'ye resim aratılmayacağı ve henüz RAWG / Open Library entegre edilmediği için; Oyun ve Kitap kartlarında sol tarafta LORE'un mevcut şık degrade yer tutucusu (placeholder: koyu degrade, parlama ikonu ve yapım başlığı) zarifçe gösterilir.
* **Galeri Kuralı (Kategori Bazlı Davranış):**
  - **Medya (Aktif):** Karta tıklanıp genişletildiğinde konunun altında TMDB'den gelen **3'lü Sahne & Atmosfer Galerisi** açılır.
  - **Oyun (Gelecek):** RAWG API entegrasyonu tamamlanana kadar Oyun kartlarında galeri alanı gizli kalır; gereksiz boş kutu açılmaz.
  - **Kitap (Kesin İstisna):** Kitaplarda sahne galerisi **KESİNLİKLE OLMAZ**. Kitap kartı genişletildiğinde galeri kutusu asla görünmez; yalnızca dikey kitap kapağı alanı yer alır.

---

## 3. GALERİ VE 10-15 KARELİK GEZİNTİ AKIŞI
1. **Kompakt Görünüm (Kapalı Kart):** Asistan mesajında kart kapalıyken sol taraftaki resmi dikey afiş yüklenir (hızlı ve hafif).
2. **Genişletilmiş Görünüm (Açık Kart):** Kullanıcı kartı okumak için tıkladığında (`isExpanded`), gizlenen galeri kutusu canlanır ve yapımın ilk 3 sahne karesi konunun altında gösterilir.
3. **Vitrin (İlk 3 Kare):** Konu metninin hemen altında yan yana 3 kare görünür. 
   - Eğer toplam sahne karesi 3'ten fazlaysa, 3. karenin köşesinde dinamik olarak `+X Görsel` (Örn: `+12 Görsel`) şeklinde şık bir rozet yer alır. Toplam görsel 3 veya daha az ise bu rozet görünmez.
4. **Tam Ekran Galeri Gezintisi (Lightbox):** 
   - Vitrindeki bu 3 kareden veya sol taraftaki dikey afişten **herhangi birine tıklandığında**, asistanın kendi yerleşik hafif tam ekran Lightbox penceresi (`AiAssistantModal` içindeki `lightboxGallery`) açılır.
   - Kullanıcı klavyedeki sağ/sol ok tuşlarıyla veya ekrandaki ok butonlarıyla yapımın 10-15 sahne karesini yüksek çözünürlükte tek tek inceler.

---

## 4. GÖRSEL BOYUTLARI VE CDN PERFORMANSI (TMDB)
Veri tasarrufu ve akıcı performans için TMDB CDN boyutları optimize edilir:
* **Sol Dikey Afiş:** `https://image.tmdb.org/t/p/w342{poster_path}`
* **Açılan 3'lü Vitrin:** `https://image.tmdb.org/t/p/w780{backdrop_path}`
* **Tam Ekran Lightbox:** `https://image.tmdb.org/t/p/w1280{backdrop_path}`

---

## 5. KÜTÜPHANEYE EKLE BUTONU (KIRMIZI ÇİZGİ)
* **Temel İlke:** Kullanıcı kendi LORE kütüphanesine yapım eklerken afişleri kendi zevkine göre özene bezene, manuel olarak seçer. Asistandaki afişin kütüphaneye otomatik dayatılması KESİNLİKLE YASAKTIR.
* **Kod Dokunulmazlığı:** `AiAssistantModal.tsx` içindeki `onOpenAddItem(card.title, card.mainTab)` çağrısına asla dokunulmaz.
* **Akış:** "Kütüphaneye Ekle" butonuna basıldığında ekleme penceresi (`AddItemModal`) açılır; **yalnızca başlık ve sekme aktarılır, afiş kutusu bomboş kalır.** Kullanıcı afişini her zamanki gibi kendi seçer.
* **Asistan Görsellerinin Amacı:** TMDB afişleri ve sahne kareleri **sadece ve sadece Asistan sohbeti içindeyken** yapımın atmosferini ve dünyasını hissetmek içindir.

---

## 6. AYARLAR MENÜSÜ, API ANAHTARI VE GÜVENLİK
* **Konum:** `SettingsModal.tsx` içinde "Google Gemini AI Entegrasyonu" kartının bittiği satırın (satır 3856) hemen altına, GitHub Senkronizasyonu öncesine yerleştirilir.
* **Tasarım:** Gemini kartıyla aynı görsel dilde tek bir **"Görsel & Afiş Sağlayıcıları"** kutusu açılır:
  - İçinde **Medya (Film / Dizi / Anime) — TMDB API Anahtarı** input alanı, durum rozeti ve "Bağlantıyı Test Et" butonu yer alır.
  - İleride Oyun (RAWG) ve Kitap (Open Library) geldiğinde aynı kutunun içine birer satır olarak eklenecek, yeni kutu açılmayacaktır.
* **Çift Formatlı Esnek Anahtar Desteği:**
  - Kullanıcı ister kısa **API Key (v3)** (~32 karakter), ister uzun **API Read Access Token (v4)** (`eyJ...` ile başlayan jeton) yapıştırsın, sistem formatı otomatik algılayıp isteği doğru yetkilendirmeyle (URL parametresi veya Bearer Header) atacaktır. Kullanıcı "hangisini yapıştıracaktım?" karmaşası yaşamaz.
* **Görselleri Kapatma Seçeneği (Açma/Kapama Anahtarı):**
  - Bu ayar kutusunun içine bir anahtar eklenir: **"Asistan Görsellerini Etkinleştir"** (Varsayılan: Açık).
  - Kullanıcı bunu kapattığında, TMDB anahtarı girilmiş olsa bile hiçbir görsel çekilmez. Kartlar sol tarafta şık yer tutucuyla açılır, galeri gizli kalır. İsteyen kullanıcı sıfır internet harcayan salt metin modunda kalabilir.
* **Veri Güvenliği ve İzolasyon (localStorage):**
  - TMDB Anahtarı: `localStorage.getItem('lore_tmdb_api_key')`
  - Görsel Aç/Kapa: `localStorage.getItem('lore_assistant_images_enabled')` (varsayılan: `'true'`)
  - **KIRILMAZ GÜVENLİK KURALI:** Bu anahtar yalnızca tarayıcı hafızasında (`localStorage`) yaşar. `AppData` yapısına KESİNLİKLE dahil edilmez; bu sayede **GitHub senkronizasyonuna, dışa aktarılan `.json` yedek dosyasına veya yerel klasör yedeğine ASLA yazılmaz ve dışarı sızamaz.**
* **Anahtar Yoksa (Yer Tutucu Koruması):**
  - Kullanıcı anahtar girmemişse sistem patlamaz, ekranda kırmızı hata çıkmaz.
  - Kodda (`AiAssistantModal.tsx`) zaten hazır bulunan zarif yer tutucu devreye girer.

---

## 7. TMDB ARAMA, EŞLEŞTİRME VE SAHNE FİLTRELEME MİMARİSİ

### Neden İki Aşamalı İstek Gereklidir?
TMDB API mimarisi gereği:
1. `/search/multi` (arama motoru) yalnızca bir özet liste döner. Bu özetin içinde sadece 1 adet afiş (`poster_path`) ve 1 adet sahne (`backdrop_path`) vardır. **10-15 adet sahne karesi arama sonucunun içinde yer almaz.**
2. Bir esere ait 10-15 sahne karesini (`backdrops` listesini) alabilmek için yapımın TMDB ID'si (`movie_id` veya `tv_id`) ile `/images` servisine gitmek teknik olarak zorunludur.

### Kesin Çalışma Akışı ve Filtreleme Kuralları:
* **1. Aşama (Arama, Eşleştirme ve Afiş):**
  - Asistan bir medya kartı önerdiğinde TMDB `/search/multi?query=...` servisine istek atılır.
  - **Yıl ve Başlık Doğrulama Koruması:** TMDB `/search/multi` endpoint'i URL parametresi olarak `year` kabul etmez. Arama `query` (başlık) ile yapılır; dönen sonuçlar arasından `media_type === 'movie' || media_type === 'tv'` olanlar taranır:
    - Yapımın yayın yılı (±1 yıl esneklikle) ve normalize edilmiş başlık benzerliği JavaScript tarafında kontrol edilir.
    - Eğer dönen sonuç aranan yapımla uyuşmuyorsa, **yanlış bir filmin afişini göstermektense LORE'un şık degrade yer tutucusu korunur** (Yanlış görsel, görselsizlikten kötüdür ilkesi).
  - Eşleşme sağlandığında dikey afiş (`poster_path`) ve yapımın `tmdbId` + `mediaType` bilgisi alınır. Sol afiş anında ekrana basılır.
* **2. Aşama (Yazısız/Dilsiz Sahne Galerisi - Performanslı Lazy Load & Kalite Filtresi):**
  - Kart açık duruma getirildiğinde (`isExpanded`), 1. aşamada hafızaya alınan `tmdbId` kullanılarak `/{media_type}/{tmdbId}/images` endpoint'inden sahne kareleri (`backdrops`) çekilir.
  - **En-Boy Oranı Filtresi:** Kareye yakın veya basık dikey kaçmış görseller (en/boy oranı < 1.35) elenir; ferah yatay sinematik kareler içeri alınır (Nadir/eski eserler için sıfır resim kalırsa toleranslı fallback devrededir).
  - **Dilsiz (Textless) ve Kalite Sıralaması:** Üzerinde yazı/logo olanlar arkaya itilir; TMDB'nin `iso_639_1 === null` (yazısız/dilsiz) sahneleri önceliklendirilir. Sıralamada hem oy veren sayısı hem ortalama beğeni puanı harmanlanır.
  - **Zirvedeki 4 Kareyi Koruma & Çeşitlilik Dağıtımı:**
    - Topluluğun en çok beğendiği ilk 4 ikonik kare doğrudan alınır.
    - Kalan 11 görsel için havuzdan aralıklı (adım atlamalı) seçim yapılır; böylece aynı oyuncunun peş peşe 7 yakın plan fotoğrafı yerine eserin farklı an ve mekanlarından dengeli bir atmosfer galerisi toplanır (Maksimum tavan: 15 görsel).
  - İlk 3 kare vitrinde gösterilir, tamamı tam ekran Lightbox için hazır tutulur.
  - Bir kere çekilen görseller hafızada önbelleğe (cache) alınır, kart kapatılıp tekrar açıldığında yeniden API isteği atılmaz.

---

## 8. YASAL BİLDİRİM VE TEMİZLİK
LORE şahsi, çevrimdışı ve elit bir kişisel arşiv aracıdır; ticari bir platform değildir. Arayüzün altına gereksiz TMDB kaynak/telif yazıları konulmayacak, ekran tertemiz kalacaktır.

---

## 9. 3 AŞAMALI UYGULAMA PLANI VE KULLANICI TEST REHBERİ

### 📌 1. AŞAMA: TMDB İletişim Motoru & Ayarlar Menüsü Entegrasyonu
* **Kapsam ve Hedef:** TMDB API bağlantı motorunu kurmak ve kullanıcının `SettingsModal.tsx` üzerinden anahtarını girip test edebilmesini sağlamak.
* **Yapılacak İşlemler:**
  1. `src/utils/tmdbApi.ts` dosyasını oluşturmak:
     - `getTmdbApiKey()`, `setTmdbApiKey()`, `getAssistantImagesEnabled()`, `setAssistantImagesEnabled()`.
     - Çift format algılayıcı: Kısa API Key (v3) ve uzun Jeton (v4) otomatik tanıma.
     - `testTmdbConnection(key)`: Gerçek bir test sorgusu ile canlı TMDB doğrulama.
  2. `src/components/SettingsModal.tsx` içine (Gemini kartının hemen altına, satır 3856):
     - **"Görsel & Afiş Sağlayıcıları"** kutusu, "Asistan Görsellerini Etkinleştir" aç/kapa anahtarı.
     - Anahtar giriş alanı, "Bağlantıyı Test Et", "Kaydet" ve "Anahtarı Kaldır" butonları, durum rozetleri.
* **📋 Kullanıcı Test Rehberi (1. Aşama Sonu):**
  1. Ayarlar (⚙️) menüsünü aç ve en alttaki *Gelişmiş Seçenekleri Göster* kutusunu işaretle.
  2. Gemini kartının hemen altındaki **Görsel & Afiş Sağlayıcıları (TMDB)** kutusunu gör.
  3. TMDB'den aldığın anahtarı yapıştırıp **"Bağlantıyı Test Et"**e bas.
  4. Yeşil renkli **"Bağlantı Başarılı!"** rozetini gör ve **"Kaydet"** butonuna basarak 1. aşamayı tamamla.

---

### 📌 2. AŞAMA: Gemini Prompt Temizliği & Sol Dikey Afiş Entegrasyonu
* **Kapsam ve Hedef:** Gemini'den sahte görsel isteklerini kaldırmak, önerilen medya kartlarına gerçek dikey TMDB afişini bağlamak, Oyun ve Kitaplarda degrade yer tutucuyu korumak.
* **Yapılacak İşlemler:**
  1. `src/utils/geminiAi.ts`: System prompttaki `thumbnailUrl` ve `galleryImages` çıktı talebini tamamen kaldırmak.
  2. `src/utils/tmdbApi.ts`: `/search/multi` ile başlık arama, yıl ve başlık eşleştirme, CDN (`w342`) dikey afiş URL'i üretme.
  3. `src/components/AiAssistantModal.tsx`:
     - Öneri kartı geldiğinde sol tarafa TMDB dikey afişini dinamik yüklemek.
     - Oyun/Kitap için veya görseller kapalıyken degrade yer tutucuyu devreye sokmak.
     - "Kütüphaneye Ekle" butonunda afişsiz aktarma kuralını korumak (`onOpenAddItem(card.title, card.mainTab)`).
* **📋 Kullanıcı Test Rehberi (2. Aşama Sonu):**
  1. Asistanı aç ve bir film veya dizi önerisi iste (Örn: *"Bana gizemli bir bilimkurgu filmi öner"*).
  2. Gelen kartın solunda kırık veya uydurma link yerine TMDB'nin gerçek dikey afişini gör.
  3. "Kütüphaneye Ekle" butonuna bas; açılan pencerede başlığın geldiğini ancak afiş kutusunun bomboş olduğunu teyit et.

---

### 📌 3. AŞAMA: Yazısız 3'lü Sahne Vitrini, Dinamik Sayaç & Tam Ekran Lightbox
* **Kapsam ve Hedef:** Karta tıklandığında konunun altına dilsiz/yazısız film sahnelerinden oluşan 3'lü vitrini açmak, dinamik rozeti göstermek ve tam ekran Lightbox gezintisini bağlamak.
* **Yapılacak İşlemler:**
  1. `src/utils/tmdbApi.ts`:
     - `/{media_type}/{id}/images` çağrısıyla `backdrops` listesini çekmek.
     - `iso_639_1 === null` (yazısız/dilsiz) sinematik sahneleri önceliklendirmek.
     - CDN boyutları: Vitrin için `w780`, tam ekran Lightbox için `w1280`. Bellek içi önbellekleme (cache).
  2. `src/components/AiAssistantModal.tsx`:
     - Kart tıklandığında (`isExpanded`) galeri kutusunu canlandırmak.
     - 3. sahne karesinin köşesine dinamik `+X Görsel` sayacını yerleştirmek.
     - Vitrindeki sahnelere veya sol afişe tıklandığında asistanın yerleşik `lightboxGallery` bileşenini tam ekran açıp klavye/ekran oklarıyla gezdirmek.
* **📋 Kullanıcı Test Rehberi (3. Aşama Sonu):**
  1. Asistan kartına tıkla ve kartı genişlet.
  2. Konu metninin hemen altında eserin atmosferini yansıtan 3 adet yazısız sahne karesini gör.
  3. 3. karenin köşesindeki dinamik görsel sayacını kontrol et.
  4. Resimlerden birine tıkla; tam ekran Lightbox açılsın ve sağ/sol oklarla yapımın 10-15 sahne karesini yüksek çözünürlükte gez.

---

### 📌 4. AŞAMA: Resmi YouTube Fragman Entegrasyonu (Videos)
* **Kapsam ve Hedef:** Asistan öneri kartında "Sahne & Atmosfer Kareleri" satırının sağına şık bir "Fragmanı Oynat" butonu eklemek, tıklandığında dahili sinema penceresinde resmi YouTube fragmanını oynatmak.
* **Tasarım & Yerleşim Kuralı:**
  - Buton, `Sahne & Atmosfer Kareleri` başlığı ile aynı hizada (`justify-between`) konumlandırılır.
  - Alttaki 3'lü sahne görsellerini asla aşağıya ittirmez.
* **Oynatıcı (Sinema Modu):**
  - Tıklandığında sayfa dışına çıkılmaz; arka plan kararır, ortada 16:9 YouTube oynatıcısı açılır.
  - Sağ üstteki çarpı (`✕`) veya `ESC` tuşuyla kapatıldığında video ve ses anında kesilir.
  - Butona tıklanana kadar sıfır veri harcanır (önceden gizli video yükleme yapılmaz).
* **Akıllı Seçim:**
  - TMDB `/videos` listesinden resmi `"Trailer"` etiketli video seçilir (röportaj/kamera arkası elenir). Dil ayrımı yapılmaz, resmi ana fragman alınır.
  - Resmi fragman yoksa buton gizlenir.
* **Ayarlar Koruması:**
  - Ayarlardan "Asistan Görsellerini Etkinleştir" kapatıldığında bu buton da tamamen kaybolur (salt metin modunu korur).
* **📋 Kullanıcı Test Rehberi (4. Aşama Sonu):**
  1. Asistan kartını genişlet ve "Sahne & Atmosfer Kareleri" başlığının sağında `▶ Fragmanı Oynat` butonunu gör.
  2. Butona bas; ortada sinema penceresi açılsın ve YouTube fragmanı başlasın.
  3. `✕` veya `ESC` tuşuna basıp kapat; sesin ve videonun anında kesildiğini doğrula.
  4. Ayarlardan "Asistan Görsellerini Etkinleştir"i kapat; fragman butonunun da kaybolduğunu doğrula.