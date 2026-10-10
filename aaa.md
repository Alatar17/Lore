# Lore Geliştirme Rehberi & Yol Haritası

---

## 1. BÖLÜM: "İzlenecek / Okunacak / Oynanacak" (Sıradakiler / Backlog) Sistemi

### 🎯 Amaç
Ana ekran tasarımını, kategori akışını ve grid yapısını hiç bozmadan; tek bir buton ve klavye kısayolu (Space) ile yalnızca sıradaki yapımların listeleneceği, kart ekleme ve düzenleme pencerelerinde ise tek tip durum yönetiminin sağlanacağı bir altyapı kurmak.

---

### ⚠️ Önemli Düzeltme Notu: W Kısayolu Engeli
* **Sorun:** Kart Detay penceresi (`ItemDetailModal`) veya başka bir modal açıkken klavyeden `W` tuşuna basıldığında, arka planda yanlışlıkla yeni kart ekleme penceresi (`AddItemModal`) açılıyor.
* **Çözüm:** `App.tsx` içindeki `W` kısayolu dinleyicisine modal kontrolü eklenecek. Kart detay penceresi veya herhangi bir modal açıkken `W` tuşu kesinlikle işlem yapmayacak.

---

### 📋 A. Form Düzenleme & Ekleme Pencereleri (Durum Alanı Standardı)
Mevcut açılır menü (`<select>`) tasarımı (Oyun sekmesindeki koyu arayüzlü şık menü yapısı) tüm sekmelerde tek tip olacak.

#### Seçeneklerin Standart Sıralaması (Her 3 sekmede de aynı sıra):
1. **✅ Tamamlandı** *(En yukarıda - 1. sıra / Varsayılan)*
2. **🎬 / ⏳ / 📖 İzlenecek / Oynanacak / Okunacak** *(2. sıra)*
3. **📺 / 🎮 / 📚 İzleniyor / Oynanıyor / Okunuyor** *(3. sıra)*
4. **⏸ Yarım Bırakıldı** *(En sonda - 4. sıra)*

---

### 📐 B. Sekmelere Göre DURUM Satırının Yatay Yerleşim Planı

1. **🎬 Medya Sekmesi:**
   * **[1. Kutu - En Sol]:** **İzleme Durumu** açılır menüsü (`Tamamlandı`, `İzlenecek`, `İzleniyor`, `Yarım Bırakıldı`)
   * **[2. Kutu - Orta]:** 🔖 **Takip** rozeti (ve megafon detay butonu)
   * **[3. Kutu - Sağ]:** 🗂️ **Anki** kutucuğu (ve Anki editör butonu)

2. **🎮 Oyun Sekmesi:**
   * **[1. Kutu - En Sol]:** **Oyun Durumu** açılır menüsü (Mevcut kutuya sadece `⏳ Oynanacak` seçeneği eklenecek ve yukarıdaki sıralama uygulanacak)
   * **[2. Kutu]:** 🏆 **Başarım (%)**
   * **[3. Kutu]:** ⏱️ **Oynanma (Saat)**
   * **[4. Kutu - En Sağ]:** 🗂️ **Anki** kutucuğu

3. **📚 Kitap Sekmesi:**
   * **[1. Kutu - En Sol]:** **Okuma Durumu** açılır menüsü (`Tamamlandı`, `Okunacak`, `Okunuyor`, `Yarım Bırakıldı`)
   * **[2. Kutu - Orta]:** 📖 **Format** açılır menüsü (`Ciltsiz`, `Ciltli`, `E-Kitap`, `Sesli Kitap`)
   * **[3. Kutu - Sağ]:** 🗂️ **Anki** kutucuğu

---

### 🔘 C. Ana Ekran Butonu & Konumu
* **Konum:** Sol altta yer alan **Lore AI Asistan ikonunun hemen sağına** şık bir ikon/buton olarak yerleştirilecek.
* **Çalışma Prensibi:**
  * **Varsayılan (OFF):** Buton pasif. Kullanıcı şu anki gibi tüm arşivini ve tamamlananları görür.
  * **Aktif (ON):** Butona basıldığında UI hiç değişmez, sadece o an seçili sekme/kategoride durumu "İzlenecek / Oynanacak / Okunacak" olan kartlar filtrelenerek listelenir.
  * Tekrar tıklandığında (OFF) normal görünüme döner.

---

### 🚀 E. 2 Aşamalı Uygulama Planı & Test Rehberleri

#### 📌 AŞAMA 1: Form Düzenlemeleri (DURUM Standardı) & W Tuşu Düzeltmesi
1. **W Kısayolu Engeli:** Kart detay penceresi veya başka bir modal açıkken `W` tuşuna basıldığında arkada yeni kart ekleme penceresinin açılması engellenecek.
2. **Form Durum Alanları:** Hem `AddItemModal` hem de `ItemDetailModal` içinde Medya, Oyun ve Kitap için standart açılır menü (`<select>`) uygulanacak:
   * **Sıralama:** 1. Tamamlandı | 2. İzlenecek / Oynanacak / Okunacak | 3. İzleniyor / Oynanıyor / Okunuyor | 4. Yarım Bırakıldı
   * **Medya:** [İzleme Durumu] [Takip] [Anki]
   * **Oyun:** [Oyun Durumu - Oynanacak eklenmiş] [Başarım] [Saat] [Anki]
   * **Kitap:** [Okuma Durumu] [Format (2. sıra)] [Anki]
3. **Geriye Dönük Uyumluluk:** Mevcut kayıtlı kartların verisi (eski `watching`, `dropped`, `reading` değerleri) otomatik ve eksiksiz olarak bu yeni sisteme eşleşecek, veri kaybı yaşanmayacak.
4. **🔔 Aşama 1 Sonu Zorunlu Görev:** Aşama 1 tamamlandığında kullanıcıya yapılan değişiklikleri adım adım test edebileceği **detaylı ve maddeli bir Test Rehberi** sunulacak.

---

#### 📌 AŞAMA 2: Ana Ekran Butonu, Space Kısayolu & Filtreleme
1. **Alt Bar Butonu:** Sol alttaki **Lore AI Asistan** ikonunun hemen sağına şık bir ikon/buton yerleştirilecek.
2. **Filtre Mantığı:** Buton aktifken (ON) UI hiç değişmeden o anki sekme/kategoride sadece "İzlenecek / Oynanacak / Okunacak" olan kartlar gösterilecek. Kapalıyken (OFF) normal arşiv görünecek.
3. **Space Kısayolu:** Ana ekranda hiçbir modal açık değilken klavyeden `Space` tuşuna basıldığında bu mod Aç/Kapa (toggle) yapılacak.
4. **Kısayol Bilgisi (K Menüsü):** `K` tuşu ile açılan Kısayollar penceresinde (`QuickShortcutsModal`) mevcut 2 adet Space kısayolunun hemen yanına/altına eklenecek; böylece **tüm Space kısayolları K menüsünde alt alta düzenli bir blok halinde** duracak:
   * `Sıradakiler Modu (Aç / Kapa)` -> `Space`
   * `Yapımı Düzenle` -> `Space`
   * `Blur Önizle / Şeffaf Yap (Anki Editörü)` -> `Space`
5. **🔔 Aşama 2 Sonu Zorunlu Görev:** Aşama 2 tamamlandığında tüm sistemin entegre çalıştığını doğrulamak için kullanıcıya **kapsamlı bir Final Test Rehberi** sunulacak.

---

## 2. BÖLÜM: Orbit Entegrasyon Planı (Lore -> Orbit Köprüsü)

> **NOT:** Öncelikli olarak 1. Bölüm ("İzlenecek / Okunacak / Oynanacak" sistemi) tamamlandıktan sonra bu aşamaya geçilecektir.

### 🎯 Amaç & UI Prensibi (Sıfır Kalabalık / Gizli Tetikleyici)
* **Yalnızca Medya Sekmesi:** Bu özellik **sadece Medya (Film, Dizi, Anime vb.) sekmesindeki kartlarda** geçerlidir. **Oyun ve Kitap sekmelerinde kesinlikle çalışmaz.**
* **Duruma Göre Ayrım (Flip vs Orbit):**
  * **Sadece "İzlenecek" ve "İzleniyor" Kartlarında:** Başlığa tıklanınca flip engellenir (`e.stopPropagation()`) ve 3 hızlı tıklama ile Orbit tetiklenir.
  * **"Tamamlandı" ve "Yarım Bırakıldı" Kartlarında:** Başlığa tıklanınca hiçbir şey engellenmez; kullanıcı dokunduğu anda kart eskisi gibi doğal olarak arka yüzüne döner (flip olur).
* **Arayüzde Sıfır Kalabalık:** Ekranlara yeni butonlar, simgeler veya ekstra menüler **kesinlikle eklenmez**.
* **Sıfır Bildirim:** Lore tarafında hiçbir toast, alert, banner veya bildirim çıkmaz; işlem tamamen sessizce gerçekleşir.

---

### 📡 Onaylanan Deep Link Şeması & Parametre Standartları

**URL Formatı:**
```text
orbit://library/add?title={title}&category=MAIN&media_type={media_type}&overview={overview}
```

#### 1. Parametre Tanımları ve Kesin Kurallar:
* **`title` (Zorunlu):** Yapımın adı (`encodeURIComponent` ile kodlanmış).
* **`category` (Sabit):** 
  * Her zaman sabit olarak **`MAIN`** gönderilecek.
* **`media_type` (Medya Formatı):**
  * Orbit'in sabit listesi: `"Anime"`, `"Film"`, `"Dizi"`, `"Belgesel"`, `"Diğer"` (Title Case, Türkçe uyumlu).
  * **Lore Eşleştirmesi:**
    * Lore kategorisi veya alt grubu "Anime" içeriyorsa -> `"Anime"`
    * "Film" / "Sinema" ise -> `"Film"`
    * "Dizi" / "Series" ise -> `"Dizi"`
    * "Belgesel" / "Doc" ise -> `"Belgesel"`
    * **Eşleşmeyen tüm durumlarda varsayılan fallback:** -> `"Film"`
* **`overview` (Konu / Özet):**
  * Lore'daki açıklama veya notlar metni (`encodeURIComponent` ile kodlanmış). Orbit'te `description` alanını doldurur.
* **`poster` (Afiş Görseli - Pano / Clipboard Köprüsü):**
  * Android Intent / Deep Link URL karakter sınırı (ve Base64 megabayt boyutu) nedeniyle URL query'si içine ham resim verisi konulamaz.
  * **Çözüm:** Lore'da 3. tıklama gerçekleştiğinde, Lore arka planda mevcut afişi (`thumbnail`) sessizce cihazın **Panosuna (Clipboard)** kopyalar. Orbit tarafında `AddContentDialog` açıldığında panodan otomatik okunur veya tek tıkla afiş kutusuna yapıştırılır.

---

### 📋 Orbit Geliştiricisine / AI'ına İletilecek Hazır Görev Kartı (Tek Parça Kopyala-Yapıştır)
> Orbit chat'indeki yapay zekaya doğrudan bu kutuyu kopyalayıp iletebilirsin:

```text
Selam! Orbit uygulamamıza dışarıdan (Lore web uygulamamızdan) bir Deep Link ve Afiş Aktarım köprüsü eklemek istiyoruz.

Lütfen şu 2 dosyada gerekli minimal düzenlemeleri eksiksiz yap:

1. AndroidManifest.xml:
   MainActivity içerisine aşağıdaki intent-filter'ı ekle:
   - action: android.intent.action.VIEW
   - category: DEFAULT ve BROWSABLE
   - scheme: "orbit"
   - host: "library"
   - pathPrefix: "/add"

2. MainActivity.kt (veya ilgili Navigation/AddContentDialog katmanı):
   Uygulama açılışında (onCreate ve onNewIntent) gelen "orbit://library/add" linkini yakala:
   - intent.data üzerinden şu query parametrelerini oku:
     * title: String (Yapım adı)
     * category: String (Varsayılan "MAIN", UI'da "Ana")
     * media_type: String ("Anime" | "Film" | "Dizi" | "Belgesel" | "Diğer")
     * overview: String (Konu / Açıklama -> description alanına)
   - Afiş Görseli Yakalama:
     * Lore, deep link'i tetiklemeden hemen önce afiş görselini cihazın sistem panosuna (Clipboard) kopyalıyor.
     * Uygulama açılıp AddContentDialog başlatıldığında ClipboardManager üzerinden (veya AddContentDialog'daki afiş seçme alanına 'Panodan Yapıştır' desteği vererek) panodaki görseli oku ve formun poster alanına ata.
   - UI Akışı:
     * Uygulama açıldığında Pager'ı Kütüphane sekmesine (page = 1) kaydır.
     * Sağ alttaki FAB butonuna basılmış gibi AddContentDialog penceresini bu değerler (başlık, kategori, medya türü, özet ve panodaki afiş) doldurulmuş olarak ekranda aç.

Orbit'in mevcut veri tabanına ve işleyişine zarar vermeden, sadece bu intent ve pano akışını karşılayacak kodları verir misin?
```

---

### 💻 Lore Tarafında Yapılan Kodlama
1. `ImagePreviewModal.tsx` içinde sadece Medya sekmesindeki `İzlenecek` ve `İzleniyor` durumundaki kartlar için başlık tıklaması ayrıştırıldı (`isOrbitEligible`).
2. `Tamamlandı` ve `Yarım Bırakıldı` kartlarında başlığa dokunulduğunda kart eskisi gibi anında arkaya dönüyor (flip).
3. `İzlenecek` ve `İzleniyor` kartlarında başlığa 3 kez tıklandığında:
   - Varsa afiş görseli cihazın panosuna (`navigator.clipboard.write`) kopyalanıyor.
   - `orbit://library/add?...` linki arka planda sessizce tetikleniyor.

