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

> **NOT:** Yukarıdaki "İzlenecek / Okunacak / Oynanacak" sistemi bittikten sonra bu konu üzerine konuşulacak ve başlanacaktır.

### 🎯 Amaç
Lore'daki bir karttan Android native olan Orbit uygulamasına veri (başlık, konu ve afiş) aktarımı.

### 📱 Fikirler & Seçenekler:
1. **Mobilde Tarihe Dokunarak Kopyalama:**  
   * Kart detay sayfasında sol üstteki tarihe tıklandığında; başlık, konu özeti ve afiş linki Orbit formatında panoya (clipboard) kopyalanır.
2. **Orbit Tarafında İçe Aktarma:**  
   * Orbit'te kütüphaneye "Panodan İçe Aktar / Yapıştır" seçeneğiyle tek tıkla ekleme yapılır.
3. **Alternatif (Deep Link):**  
   * Özel bir şema (`orbit://import?...`) ile tek tıkla doğrudan Orbit'in açılması.

