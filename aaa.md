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
* **Yalnızca Medya Sekmesi:** Bu özellik **sadece Medya (Film, Dizi, Anime vb.) sekmesindeki kartlarda** geçerlidir. **Oyun ve Kitap sekmelerinde kesinlikle çalışmayacaktır.**
* **Arayüzde Sıfır Kalabalık:** Ekranlara yeni butonlar, simgeler veya ekstra menüler **kesinlikle eklenmeyecek**.
* **Tetikleme Noktası (Easter Egg):** Mobildeki kart detay/önizleme ekranında (`ImagePreviewModal`) Medya kartının ön yüzündeki **yapım adına (başlığa) hızlıca 3 kez (triple tap) tıklandığında** tetiklenecek. (İzlenecek yapımlarda henüz izlenme tarihi olmadığı için başlık tetikleyici olarak belirlenmiştir).
* **Flip Engeli:** Başlığa 1, 2 veya 3 kez tıklandığında kart **kesinlikle dönmeyecek (flip olmayacak)** (`e.stopPropagation()`).
* **Sıfır Bildirim:** Lore tarafında hiçbir toast, alert, banner veya bildirim çıkmayacak; işlem tamamen sessizce gerçekleşecek.

---

### 📡 Onaylanan Deep Link Şeması & Parametre Standartları

**URL Formatı:**
```text
orbit://library/add?title={title}&category=MAIN&media_type={media_type}&overview={overview}
```

#### 1. Parametre Tanımları ve Kesin Kurallar:
* **`title` (Zorunlu):** Yapımın adı (`encodeURIComponent` ile kodlanmış).
* **`category` (Sabit):** 
  * Her zaman sabit olarak **`MAIN`** gönderilecek. (Orbit içinde kullanıcı ihtiyaca göre "Ana" veya "Ara" olarak kendisi değiştirebilir).
* **`media_type` (Medya Formatı):**
  * Orbit'in sabit listesi: `"Anime"`, `"Film"`, `"Dizi"`, `"Belgesel"`, `"Diğer"` (Title Case, Türkçe uyumlu).
  * **Lore Eşleştirmesi:**
    * Lore kategorisi veya alt grubu "Anime" içeriyorsa -> `"Anime"`
    * "Film" / "Sinema" ise -> `"Film"`
    * "Dizi" / "Series" ise -> `"Dizi"`
    * "Belgesel" / "Doc" ise -> `"Belgesel"`
    * **Eşleşmeyen tüm durumlarda varsayılan fallback her zaman:** -> `"Film"`
* **`overview` (Konu / Özet):**
  * Lore'daki açıklama veya notlar metni (`encodeURIComponent` ile kodlanmış). Orbit'te `description` alanını doldurur.
* **`poster` (Afiş Görseli):**
  * Kullanıcı resimleri her zaman yerel galeriden yüklediği veya panodan kopyala-yapıştır yaptığı için **link üzerinden afiş gönderilmeyecek (`poster` parametresi eklenmeyecek)**. Orbit formunda afiş kutusu boş gelecek; kullanıcı alıştığı şekilde galeriden veya panodan yapıştırarak afişini ekleyecek.
* **`episodes` (Bölüm Sayısı):**
  * Lore'da bölüm sayısı bilgisi tutulmadığı için **kesinlikle gönderilmeyecek (iptal edildi)**.

---

### 📋 Orbit Geliştiricisine / AI'ına İletilecek Hazır Görev Kartı (Tek Parça Kopyala-Yapıştır)
> Orbit chat'indeki yapay zekaya doğrudan bu kutuyu kopyalayıp iletebilirsin:

```text
Selam! Orbit uygulamamıza dışarıdan (Lore web uygulamamızdan) bir Deep Link köprüsü eklemek istiyoruz. 

Lütfen şu 2 dosyada gerekli minimal düzenlemeleri eksiksiz yap:

1. AndroidManifest.xml:
   MainActivity içerisine aşağıdaki intent-filter'ı ekle:
   - action: android.intent.action.VIEW
   - category: DEFAULT ve BROWSABLE
   - scheme: "orbit"
   - host: "library"
   - pathPrefix: "/add"

2. MainActivity.kt (veya ilgili Navigation/UI katmanı):
   Uygulama açılışında (onCreate ve onNewIntent) gelen "orbit://library/add" linkini yakala:
   - intent.data üzerinden şu query parametrelerini oku:
     * title: String (Yapım adı)
     * category: String (Varsayılan "MAIN", UI'da "Ana")
     * media_type: String ("Anime" | "Film" | "Dizi" | "Belgesel" | "Diğer")
     * overview: String (Konu / Açıklama -> description alanına)
   - Uygulama açıldığında Pager'ı Kütüphane sekmesine (page = 1) kaydır.
   - Sağ alttaki FAB butonuna basılmış gibi AddContentDialog penceresini bu değerler (başlık, kategori, medya türü, özet) doldurulmuş olarak ekranda aç.

Orbit'in mevcut veri tabanına ve işleyişine zarar vermeden, sadece bu intent'i karşılayacak kodları verir misin?
```

---

### 💻 Lore Tarafında Yapılacak Kodlama (Tek Seferde)
1. `ImagePreviewModal.tsx` içinde kartın `item.mainTab === 'media'` (yani Medya sekmesinde) olduğu kontrol edilecek; Oyun veya Kitap ise sayaç çalışmayacak ve normal davranışı korunacak.
2. Medya kartının ön yüzündeki başlığa (`item.title`) tıklandığında `e.stopPropagation()` ile kartın flip hareketi durdurulacak.
3. 3 tık sayacı (örn. 800ms içinde 3 hızlı tıklama) kurulacak.
4. 3. tıklamada link arka planda `window.location.href = "orbit://library/add?..."` ile sessizce tetiklenecek.

