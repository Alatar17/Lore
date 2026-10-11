# Lore - Özel Rozet & Nişan Sistemi (Tasarım ve Uygulama Rehberi)

Bu doküman; kütüphanendeki oyun, film, dizi, anime ve kitaplara özel şeref nişanları ve unvanlar verebilmeni sağlayan rozet sisteminin kesinleşmiş tasarım kararlarını, ekran yerleşimlerini ve işleyişini içerir.

---

## 🎯 1. Sistemin Mantığı ve Temel Kurallar
Kullanıcının kütüphanesindeki yapımlara kendi belirlediği özel unvan ve şeref nişanlarını takabilmesidir.
* **Örnekler:**
  * *Hollow Knight* ➔ 🏆 **En İyi Metroidvania** ve ❤️ **Benim Favori Oyunum**
  * *Interstellar* ➔ 🌌 **Görsel Başyapıt**
  * *Elden Ring* ➔ ⚔️ **Aheste Başyapıt**

### Altın Kurallar:
1. **Kart Afişinde Sadece İkon:** Kartın üzerinde asla yazı kalabalığı olmaz; yalnızca nişan ikonu yer alır.
2. **PC'de Hover:** Fareyle ikonun üzerine gelindiğinde rozet hafifçe nefes alır (scale-110), parıltısı canlanır ve rozetin renginde parlayan zarif bir baloncuk (Tooltip) açılarak unvan metni görünür (örn: *"🏆 En İyi Metroidvania"*).
3. **Mobilde Dokunma:** İkona dokunulduğunda anlık minik unvan bildirimi gösterilir.

---

## 🖼️ 2. Rozetlerin Ekranda Konumu

### A. Ana Sayfa Grid Kartı (`ItemCard`)
* **Konum: Sağ Üst Puanın Altı (Dikey Asılı Nişanlar):**
  * Afişin sağ üst köşesinde yer alan Puan kutusunun (⭐ `8.5`) hemen altına alt alta dikey olarak madalya gibi sıralanır.
  * **Çakışmasız Temiz Alan:** Sol üstteki Yıl rozeti, sol alttaki Durum ikonları (Tv, Okunuyor, Yarım Bırakıldı) ve sağ alttaki Anki / Başarım Yüzdesi (%100) / Sayfa Sayısı rozetleriyle **kesinlikle çakışmaz**.
  * **Prestij ve Denge (Maksimum 4 Rozet):** Dikey sırada en fazla 4 rozet yer alabilir. Bu sayede afişin görseli kaybolmaz, sağ kenar boydan boya dolmaz ve şeref nişanı hissi değerini korur.
  * **Hover / Dokunma:** Masaüstünde fareyle ikonun üzerine gelindiğinde unvan balonu (tooltip) açılır; mobilde dokunulduğunda gösterilir.

### B. Kart Detay Ekranı (`ImagePreviewModal`)
* Hem masaüstü hem de mobil görünümde, afiş üzerinde ana kartla birebir aynı tutarlılıkta: **Puan kutusunun hemen altına dikey olarak asılmış nişan ikonları (en fazla 4 adet)** olarak gösterilir.

---

## 🎨 3. Kart Düzenleme Penceresinde Rozet Takma (`AddItemModal` & `ItemDetailModal`)

Afişin altında kalan dikey boşluk rozet yönetim masası olarak kullanılır:

* **Konum:** Sol sütunda, afişin ve "Değiştir / Yapıştır" butonlarının hemen altı.
* **Etkileşim Adımları:**
  1. "Değiştir / Yapıştır" butonlarının hemen altına tam genişlikte bir **`[ Rozet Ekle ]`** butonu yerleştirilir.
  2. Bu butona basıldığında butonun hemen altına doğru açılan şık bir mini menü (popover) açılır.
  3. **Kapsam Filtresi:** Menüde yalnızca o yapımın ait olduğu alandaki rozetler listelenir (Oyun için Oyun rozetleri, Medya için Medya rozetleri, Kitap için Kitap rozetleri).
  4. **Açık İsim ve İkon:** Sistemde kayıtlı olan rozetler **hem ikonu hem de adı açıkça yazılarak** listelenir (örn: *🏆 En İyi Metroidvania*, *❤️ Favori Oyunum*).
  5. **Hızlı Seçim (Toggle):** Menüdeki bir rozete tıklandığında anında yapıma atanır (sağında yeşil ✓ belirir); tekrar tıklandığında çıkarılır. Menü kapanmadan birden fazla rozet seri şekilde seçilebilir.
  6. **Kapasite ve Sınır (Maksimum 4 Rozet):**
     * Bir yapıma **en fazla 4 adet rozet** atanabilir.
     * Butonun hemen altında eklenen rozetler tek satırda **yan yana 4 adet kutucuk** halinde önizlenir.
     * 4 rozete ulaşıldığında `[ Rozet Ekle ]` butonu pasifleşir (veya tıklandığında "Maksimum 4 rozet sınırına ulaşıldı" uyarısı verir).
     * Atanmış her rozet kutucuğunun sağ üstündeki minik `(×)` butonuna basılarak rozet anında geri çıkarılabilir.
  7. **Boş Durum (Empty State):** Kullanıcı Ayarlar'dan henüz o kategoriye ait hiç rozet tanımlamamışsa, popover içinde *"Henüz bir rozet tanımlamadınız"* uyarısı ve Ayarlar'a yönlendiren mini kısayol gösterilir.

### UI Tasarım Şeması (Sol Sütun & Popover Görsel Taslağı)

#### 1. Form Üzerindeki Yerleşim (Normal Durum)
```
┌─────────────────────────────────┐
│          [ AFİŞ / POSTER ]      │
│            (aspect 2/3)         │
│                                 │
└─────────────────────────────────┘
┌────────────────┬────────────────┐
│  📁 Değiştir   │  📋 Yapıştır   │
└────────────────┴────────────────┘
┌─────────────────────────────────┐
│  🏅 Rozet Ekle            (2/4) │  <── Tam genişlikte buton
└─────────────────────────────────┘
┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
│ 🏆✕ │  │ ❤️✕ │  │  +  │  │  +  │   <── Atanmış rozetler (Max 4 yuva)
└─────┘  └─────┘  └─────┘  └─────┘
```

#### 2. `[ Rozet Ekle ]` Butonuna Basıldığında Açılan Popover Menüsü
```
┌─────────────────────────────────┐
│  🏅 Rozet Ekle            (2/4) │
└─────────────────────────────────┘
 ┌── Rozet Seç ─────────────── (2/4 Seçili) ──┐
 │                                            │
 │  ┌──────────────────────────────────────┐  │
 │  │ [🏆] En İyi Metroidvania          ✓  │  │ <── Zaten seçili (tıkla: çıkar)
 │  ├──────────────────────────────────────┤  │
 │  │ [❤️] Benim Favori Oyunum          ✓  │  │ <── Zaten seçili (tıkla: çıkar)
 │  ├──────────────────────────────────────┤  │
 │  │ [⚔️] Aheste Başyapıt              +  │  │ <── Seçilebilir (tıkla: ekle)
 │  ├──────────────────────────────────────┤  │
 │  │ [🌌] Görsel Şölen                 +  │  │ <── Seçilebilir (tıkla: ekle)
 │  └──────────────────────────────────────┘  │
 │                                            │
 │  [⚙️ Ayarlar'da Rozetleri Yönet]           │ <── Yeni rozet tanımlama kısayolu
 └────────────────────────────────────────────┘
```

---

## ⚙️ 4. Ayarlar Menüsü: "Görünüm & Rozet" Sekmesi (`SettingsModal`)

Ayarlar panelindeki "Görünüm" sekmesinde yer alır:

### A. Konum ve Mobil Görünürlük
* **Yerleşim:** "Ekran Altı Hızlı Görünüm Çubuğu" bloğunun altına bir ayırıcı çizgi çekilir ve altına rozet yönetim masası gelir.
* **Mobilde Gizleme:** Mobilde yapımlar salt okunur olduğu için, rozet yönetim masası **mobilde gizlenir** (`hidden md:block`), yalnızca masaüstünde görünür.
* **Ferah Arayüz (Akordiyon / Açılır Form Yapısı):** Sayfa kalabalığını önlemek amacıyla "Yeni Rozet Oluştur" formu varsayılan olarak kapalıdır. Kullanıcı `[ + Yeni Rozet Oluştur ]` butonuna bastığında form aşağıya doğru açılır, rozet kaydedildiğinde veya iptal edildiğinde form otomatik kapanır.

### B. UI Tasarım Şeması (Görsel Taslak)

#### 1. Varsayılan Görünüm (Form Kapalı - Tertemiz & Ferah)
```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Ekran Altı Hızlı Görünüm Çubuğu                                   [ ON/OFF ]│
│  Ana ekranın altındaki yüzen hızlı özelleştirme çubuğunu açar veya gizler.   │
└──────────────────────────────────────────────────────────────────────────────┘
────────────────────────────────────────────────────────────────────────────────
┌──────────────────────────────────────────────────────────────────────────────┐
│  ÖZEL ROZETLER & NİŞAN YÖNETİMİ                                              │
│                                                                              │
│  Rozet Parıltısı (Glow) Efekti                                     [ ON/OFF ]│
│  Kart afişindeki rozetlere renkli neon/madalya ışıma efekti verir.           │
│                                                                              │
│  [ + Yeni Rozet Oluştur ]                                                    │
│                                                                              │
│  ┌─ Tanımlı Rozetler Masası ──────────────────────────────────────────────┐  │
│  │  Filtre: [ Hepsi ]  [ 🎬 Medya (2) ]  [ 🎮 Oyun (3) ]  [ 📚 Kitap (1) ]│  │
│  │                                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │ 🏆  En İyi Metroidvania   [ 🎮 Oyun ]      (3 yapım)   [✎]  [🗑️] │  │  │
│  │  ├──────────────────────────────────────────────────────────────────┤  │  │
│  │  │ ❤️  Benim Favori Oyunum   [ 🎮 Oyun ]      (1 yapım)   [✎]  [🗑️] │  │  │
│  │  ├──────────────────────────────────────────────────────────────────┤  │  │
│  │  │ 🌌  Görsel Başyapıt       [ 🎬 Medya ]     (2 yapım)   [✎]  [🗑️] │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### 2. Form Açık Görünüm (`[ + Yeni Rozet Oluştur ]` Butonuna Basıldığında)
```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ┌─ Yeni Rozet Oluştur ─────────────────────────────── [✕ Formu Kapat] ────┐  │
│  │                                                                        │  │
│  │  Rozet Adı:                                                            │  │
│  │  [ Örn: En İyi Metroidvania, Favori Oyunum...                        ] │  │
│  │                                                                        │  │
│  │  Kapsam:                                                               │  │
│  │  [ 🎬 Medya ]   [ 🎮 Oyun ]*   [ 📚 Kitap ]                            │  │
│  │                                                                        │  │
│  │  Rozet İkonu:                                  Canlı Önizleme:         │  │
│  │  ┌─────────────────────────────┐ ┌───┐         ┌────────────────────┐  │  │
│  │  │ [ 📁 Galeriden / Dosya Seç ]│ │ ? │ ───┐    │     ┌────────┐     │  │  │
│  │  │ [ 📋 Panodan Yapıştır (V)  ]│ └───┘    │    │     │   🏆   │     │  │  │
│  │  └─────────────────────────────┘          │    │     └────────┘     │  │  │
│  │                                           │    │ [Altın Sarısı Glow]│  │  │
│  │                                           │    └────────────────────┘  │  │
│  │  (?) Bilgi Kutusu:                        │                            │  │
│  │  ┌────────────────────────────────────────┴──────────────────────────┐ │  │
│  │  │ 💡 AI Üretim İpucu:                                               │ │  │
│  │  │ Görselinizi 1:1 (kare) oranında, yazısız (no text) ve şeffaf      │ │  │
│  │  │ arka planlı (PNG) olarak üretin.                     [📋 Kopyala] │ │  │
│  │  └───────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                        │  │
│  │  Parıltı (Glow) Rengi:                                                 │  │
│  │  [🟡 Altın]*  [🔴 Yakut]  [🟢 Zümrüt]  [🔵 Safir]  [🟣 Ametist]  [🟠 Turuncu]│
│  │                                                                        │  │
│  │  [ + Rozeti Kaydet ]   [ Vazgeç ]                                      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### C. İkon Belirleme ve AI Rehberi (Dosya, Pano ve Prompt Kopyalama)
1. **Galeriden / Dosyadan Seç:** Cihazdan herhangi bir PNG, SVG veya WebP görseli yükleme.
2. **Panodan Yapıştır (Yapıştır Butonu / Ctrl+V):** İnternette veya AI aracında üretilen görsele sağ tıklayıp "Resmi Kopyala" dedikten sonra doğrudan kutuya yapıştırma.
3. **AI Üretim Uyarısı & [📋 Kopyala] Butonu:**
   * Bilgi kutusundaki metin: *"Görselinizi 1:1 (kare) oranında, yazısız (no text) ve şeffaf arka planlı (PNG) olarak üretin."*
   * Yanındaki **`[📋 Kopyala]`** butonuna tıklandığında yapay zeka araçlarına (ChatGPT, Midjourney vb.) doğrudan eklenebilecek hazır prompt parçacığı (`"1:1 square, isolated on transparent background, no text"`) panoya tek tıkla kopyalanır ve yeşil *"Kopyalandı!"* geri bildirimi verilir.

### D. Kapsam
Her rozet tanımlanırken ait olduğu alan seçilir:
* **Medya:** Film, Dizi, Animasyon
* **Oyun:** Video oyunları
* **Kitap:** Roman, Manga, Çizgi roman vb.

### E. Renk, Parıltı (Glow) ve Nişan Havası
* **Glow Rengi:** Rozet oluşturulurken bir parıltı/vurgu rengi seçilir (Altın, Yakut, Zümrüt, Safir, Mor, Turuncu vb.).
* **Aç/Kapa Ayarı:** Ayarlar ekranında *"Rozet Parıltısı (Glow) Efekti"* aç/kapa seçeneği bulunur; isteyen bu efekti kapatıp sade ikon görüntüsünü tercih edebilir.
* **Cam & Metalik Çerçeve:** İkonun arkasında çok hafif koyu-şeffaf bir cam zemin ve seçilen renkte incecik bir kenarlık olur; afiş görseliyle karışmadan madalya hissi verir.
* **Hover Animasyonu (PC):** Fareyle rozet ikonunun üzerine gelindiğinde ikon hafifçe yukarı nefes alır (scale-110) ve parıltısı güçlenir.

### F. Rozete Bağlı Yapımları İnceleme (Etiketler Mantığı)
* Rozet listesinde o rozetin kaç yapıma takıldığı yazar (örn: `(2 yapım)`).
* Sayaca tıklandığında popover açılır ve bağlı yapımlar listelenir.
* Listeden bir yapıma tıklandığında düzenleme penceresi değil, **Kart Detay Penceresi (`ImagePreviewModal`)** açılır.

---

## 🔍 5. Filtreleme Sistemi (`FilterPanel`)

* **Konum:** Seri / Evren Bağlantılı seçeneğinin hemen altı.
* **Davranış:** Tek bir **"Özel Rozetli Yapımlar"** On/Off anahtarı. Açıldığında rozet atanmış tüm yapımları tek tıkla listeler.

---

## 💾 6. Veri Modeli ve Yedekleme

```typescript
export interface CustomBadge {
  id: string;              // Benzersiz kimlik (örn: 'badge_1789301234')
  name: string;            // Rozet Adı (örn: 'En İyi Metroidvania')
  iconData: string;        // Görselin base64 verisi
  color: string;           // Rozet glow / vurgu rengi
  targetTab: 'media' | 'game' | 'book'; // Medya, Oyun veya Kitap
}

export interface ArchiveItem {
  // ... mevcut alanlar
  badges?: string[];       // Karta atanmış CustomBadge ID listesi (maksimum 4 adet)
}
```

* **Yedekleme:** JSON, ZIP ve GitHub yedeklerinde tüm rozet tanımları ve kart atamaları eksiksiz saklanır.

---

## 🛡️ 7. Kritik Sistem Önlemleri ve Hata Önleyici Kurallar

Sistemin uzun vadede sorunsuz, hafif ve hatasız çalışması için kodlama esnasında kesinlikle uygulanacak kurallar:

### 1. Otomatik İkon Optimizasyonu (Bellek ve Yedek Şişmesini Önleme)
* Kullanıcı yapay zekadan 1024x1024 veya 2-3 MB boyutunda bir PNG görsel yapıştırsa dahi, sistem görseli doğrudan ham base64 olarak kaydetmez.
* İstemci tarafında (HTML Canvas) görsel otomatik olarak şeffaflığı korunarak **`64x64` veya `80x80` piksele** küçültülür ve hafif WebP/PNG formatına dönüştürülür.
* Böylece her rozet ikonu yalnızca **3-5 KB** yer kaplar; yüzlerce rozet tanımlansa dahi `localStorage`, state ve JSON yedek dosyaları asla şişmez.

### 2. Kaskad Silme & Veri Bütünlüğü (Hayalet Rozetleri Engelleme)
* Ayarlar masasından bir rozet silindiğinde (`[🗑️]`), sistem anında tüm kütüphaneyi tarayarak `item.badges` dizilerinden silinen rozetin kimliğini (`badgeId`) otomatik olarak temizler.
* Bu sayede kart afişlerinde veya detay pencerelerinde görseli bulunamayan kırık/hayalet rozet simgesi asla oluşmaz.

### 3. Tooltip Yönü ve Kırpılma (Overflow-Hidden) Koruması
* `ItemCard` bileşenindeki afiş kapsayıcısı yuvarlatılmış köşeler için `overflow-hidden` kullanır.
* Rozetler afişin sağ üst kenarında dikey sıralandığı için, fareyle üzerine gelindiğinde açılan unvan balonu (tooltip) **sola doğru (`right-full mr-2`)** açılır.
* Böylece unvan balonu afişin dışına taşıp kırpılmaz; daima afiş görselinin üzerinde net ve kusursuz okunur.

### 4. Yedekleme & Geri Yükleme Uyumluluğu
* `CustomBadge[]` listesi yerel depolamada (`localStorage['lore_custom_badges']`) ve ana uygulama durumunda (state) tutulur.
* JSON / ZIP dışa aktarma (export) ve içe aktarma (import) işlemlerinde rozet verileri yedek dosyasına otomatik dahil edilir; böylece cihazlar arası aktarımda veya geri yüklemede hiçbir nişan kaybolmaz.

### 5. Glow (Parıltı) Kapalıyken Estetik Koruma
* Kullanıcı Ayarlar'dan *"Rozet Parıltısı (Glow) Efekti"*ni kapattığında, rozetler simsiyah veya görünmez bir kutu haline gelmez.
* Renkli neon ışıma söner; ancak rozet ikonu ve arkasındaki hafif koyu-şeffaf cam zemin korunarak minimalist, şık bir madalya görünümü devam eder.

### 6. Tier List & Kompakt Görünümlerde Sade Kalma
* Tier Listesi veya çok küçük önizleme kartlarında afiş alanı çok dar olduğundan, afişi boğmamak adına özel rozetler Tier List kartlarında gizlenir (yalnızca ana kütüphane kartında ve detay pencerelerinde gösterilir).

---

## 🚀 8. Uygulama Aşamaları ve Test Rehberi

Sistem, her adımın bağımsız ve sağlam şekilde test edilebilmesi için 4 ardışık aşamada hayata geçirilecektir.

### 🔹 1. Aşama: Rozet Oluşturma & Yönetim Masası (`SettingsModal` + Veri Altyapısı)
* **Kapsam:**
  * Veri modelleri (`CustomBadge`, `ArchiveItem.badges`, `AppData.customBadges`).
  * Canvas tabanlı otomatik `64x64` şeffaf PNG/WebP ikon optimizasyonu.
  * `SettingsModal.tsx` Görünüm sekmesinde "Özel Rozetler & Nişan Yönetimi" paneli.
  * `[ + Yeni Rozet Oluştur ]` açılır akordiyon formu (Ad, Kapsam, İkon yükle/yapıştır, AI Bilgi Kutusu + `[📋 Kopyala]`, 6 renk Glow seçici, Canlı Önizleme).
  * Tanımlı rozetler tablosu (Kapsam filtreleri, düzenleme `[✎]`, silme `[🗑️]`).
  * Rozet silindiğinde kütüphaneden kaskad temizlik mantığı.
  * JSON / ZIP yedekleme ve yerel depolama (`localStorage`) entegrasyonu.
* **Test Odak Noktası:** Ayarlar'da rozet oluşturma, prompt kopyalama, pano yapıştırma, önizleme, düzenleme, silme ve yedek kaydı.

### 🔹 2. Aşama: Yapımlara Rozet Takma & Çıkarma (`AddItemModal` & `ItemDetailModal`)
* **Kapsam:**
  * Afiş altında "Değiştir / Yapıştır" butonlarının hemen altına tam genişlikte `[ Rozet Ekle ] (0/4)` butonu.
  * Butona tıklanınca açılan mini popover menüsü:
    * Yapımın kapsamına göre filtre (Oyun ise sadece Oyun rozetleri vb.).
    * Rozet ikonu + Tam adı + Seçim durumu (✓ / +).
    * Tek tıkla toggle (tıkla ekle, tıkla çıkar).
  * Buton altında eklenen rozetlerin 4 kutucuk halinde önizlenmesi ve `(×)` butonu ile tek tıkla çıkarılabilmesi.
  * Maksimum 4 rozet kapasite sınırı denetimi.
  * Form kaydedildiğinde rozetlerin karta kalıcı işlenmesi.
* **Test Odak Noktası:** Hem yeni yapım eklerken hem de mevcut yapımı düzenlerken rozet takma, çıkarma, sınır testi ve kaydetme.

### 🔹 3. Aşama: Vitrin, Afiş Yerleşimi ve Görsel Şölen (`ItemCard` & `ImagePreviewModal`)
* **Kapsam:**
  * `ItemCard.tsx` afişinde sağ üst Puan kutusunun altına dikey sıralanan rozet nişanları (max 4 adet).
  * Puan yoksa sağ üstten başlama davranışı.
  * Seçilen renkte neon/madalya ışıma (Glow) ve yarı saydam cam çerçeve.
  * Ayarlar'dan "Rozet Parıltısı" kapatıldığında minimalist koyu cam görünüme geçiş.
  * Masaüstünde Hover: Rozetin hafif nefes alması (`scale-110`) ve sola doğru açılan zarif unvan balonu (tooltip).
  * Mobilde dokunulduğunda minik unvan bildirimi.
  * `ImagePreviewModal.tsx` detay ekranındaki afişte birebir aynı tutarlı gösterim.
  * Tier List ve mini önizleme kartlarında rozetlerin gizlenmesi.
* **Test Odak Noktası:** Afiş üzerindeki estetik, hizalama, hover baloncukları, glow açık/kapalı görünümü ve detay modalı tutarlılığı.

### 🔹 4. Aşama: Filtreleme Masası (`FilterPanel`)
* **Kapsam:**
  * `FilterPanel.tsx` içine "Özel Rozetli Yapımlar" ON/OFF filtresinin eklenmesi (Seri / Evren Bağlantılı seçeneğinin hemen altına).
  * Açıldığında en az 1 özel rozete sahip tüm yapımları tek tıkla listelemesi.
* **Durum Notu:**
  * Ayarlar masasındaki rozet sayacına (örn: `(3 yapım)`) tıklandığında açılan popover'dan kart detayına (`ImagePreviewModal`) hızlı geçiş özelliği **1. Aşamada zaten eksiksiz yapılmış olup halihazırda çalışmaktadır**.
  * Kullanıcı isteği doğrultusunda ana arama çubuğunda rozet adına göre arama desteği iptal edilmiş ve kaldırılmıştır.
* **Test Odak Noktası:** Filtre panelindeki anahtarın rozetli yapımları doğru süzmesi ve sıfırlama butonlarıyla uyumu.

---

## 💡 Gelecek Geliştirme Notu (Tüm Aşamalar Bitince Konuşulacak):
* **Rozete Tıklayınca Büyümesi (Nişan İnceleme Vitrini):**
  * Rozet çizimleri çok detaylı ve estetik olduğu için kart üzerinde küçük kaldığından detayları rahatça inceleyebilmek amacıyla; rozet tıklandığında (veya detay modalında) rozetin 140x140+ px boyutunda, seçilen neon parıltısıyla ve unvanıyla birlikte büyük boyutta şık bir vitrinde açılması/büyümesi fikri.
  * **Not:** Bu özellik 4. Aşama tamamlandıktan sonra kullanıcıya hatırlatılacak ve birlikte konuşulacaktır.

---

> 📌 **Aşama Sonu Test Kuralı:**  
> Her aşamanın kodlaması tamamlandığında, kullanıcıya o aşamada eklenen tüm özellikleri adım adım deneyebileceği detaylı bir **"Kullanıcı Test Rehberi"** sunulacaktır. Kullanıcı testi gerçekleştirip onay vermeden kesinlikle bir sonraki aşamaya geçilmeyecektir.
