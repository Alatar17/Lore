# Lore - Kişisel Yorum / İnceleme Sistemi Tasarım & Uygulama Rehberi

---

## 🎯 1. Sistemin Amacı ve Vizyonu
Kullanıcının bitirdiği veya deneyimlediği yapımlara (oyun, film, dizi, anime, kitap vb.) kendi öznel, sansürsüz ve kişisel eleştirilerini kaydedebilmesini sağlamak. 
* **Örnek Senaryo:** *"Dün Crysis 1'i oynadım; oyunun yapay zekası zayıftı, NPC davranışları belirli bir noktadan sonra çok tekrar ediyordu, ama nano giysi mekanikleri ve çevre fiziği dönemine göre harikaydı."*
* **Hedef:** 5-10 yıl sonra kart açıldığında, o anki duygu, düşünce ve teknik değerlendirmeleri ilk günkü tazeliğiyle görebilmek.

---

## 💾 2. Veri Modeli (Schema & Storage)

### `ArchiveItem` Arayüzüne Eklenecek Alanlar (`src/types.ts`):
```typescript
export interface ArchiveItem {
  // ... mevcut alanlar ...

  // Kişisel Yorum / İnceleme Alanı
  review?: string;        // Kullanıcının yazdığı kişisel eleştiri/yorum metni
  reviewDate?: string;    // Yorumun yazıldığı/güncellendiği tarih (Opsiyonel: YYYY-MM-DD)
}
```

* **Geriye Dönük Uyumluluk:** Eski kartlarda `review` alanı tanımsız (`undefined`) olacaktır, hiçbir veri bozulması yaşanmaz.
* **Yedekleme & Senkronizasyon:** 
  * **"Tam Sistem Yedeği Oluştur"** (klasöre alınan ana ZIP yedeği)
  * Tekil ZIP indirme
  * JSON dışa aktarma / içe aktarma
  * GitHub senkronizasyonu
  Yukarıdaki tüm yedekleme kanalları `review` (yorum) alanını eksiksiz olarak arşivler ve geri yükler.

---

## 🖥️ 3. Form & Düzenleme Ekranı Davranışı (`AddItemModal` & `ItemDetailModal`)

### 3.1. "KONUSU" ve "YORUMUM" Minimal Segment Başlıkları (Sıfır İrilik / Mevcut UI Bütünlüğü)
Mevcut arayüzün zarif ve kompakt düzenini kesinlikle bozmamak için kaba, hantal butonlar **kesinlikle eklenmeyecektir.**

Mevcut `text-[10px] uppercase tracking-wider text-slate-400 font-semibold` tipografik stili korunarak, başlık alanına yan yana iki minimalist ve şık metin sekmesi konulacaktır:

```text
[ KONUSU ]   [ YORUMUM ]                      (AI Butonları Sağda)
+----------------------------------------------------------------+
| Textarea Alanı (Tek kutu, seçili sekmeye göre içeriği değişir) |
|                                                                |
+----------------------------------------------------------------+
```

* **Stil & His:** 
  * Aktif olan sekme parlak beyaz/mavi alt çizgi veya zarif bir aydınlatma alır.
  * Pasif olan sekme loş durur (`text-slate-400 hover:text-slate-200`).
  * Boyutlar formdaki diğer başlıklarla milimetrik olarak aynı kalır; hiçbir yer kaplamaz veya tasarımı bozmaz.
* **Durum Hafızası:**
  * `[ KONUSU ]` seçiliyken metin kutusu `desc` değerini gösterir ve düzenler.
  * `[ YORUMUM ]` seçiliyken metin kutusu `review` değerini gösterir ve düzenler.
  * Form ilk açıldığında varsayılan olarak `[ KONUSU ]` aktif gelir.
  * Eğer bir yapıma daha önceden yorum girilmişse, `[ YORUMUM ]` başlığının hemen yanında gözü yormayan minik bir nokta indikatörü belirir (böylece yapımda yorum olduğunu anlarsın).

---

### 3.2. 🔓 Yorum Alanı Kuralı: Her Zaman Tıklanabilir ve Özgür Erişim
* **Kural:** Yorum alanı **puan veya durumdan bağımsız olarak HER ZAMAN tıklanabilir ve erişilebilirdir.**
* **Gerekçe & Senaryo (Örn. One Punch Man):** 
  * Kullanıcı daha önce 10 puan verdiği bir serinin yeni sezonunu izlerken kararsız kalabilir, puanı sezon bitene kadar "Puansız"a çekebilir fakat o esnada hissettiği eleştirileri (*"yeni sezonun çizimleri zayıflamış, stüdyo değişimi hissediliyor"*) yazmak veya eski yorumunu okumak isteyebilir.
  * Bu nedenle puan sıfır (`rating === 0`) olsa dahi yorum sekmesine serbestçe girilebilir, düzenlenebilir ve okunabilir.
  * Kullanıcı yorum yazdıysa kart detayında görünür, yazmadıysa görünmez.

---

### 3.3. 🛡️ Katı Kural: AI Koruması & Sekme Atlama (AI Safety Shield)
* **Mevcut Durum:** `AddItemModal` ve `ItemDetailModal` içinde `Sparkles` ("AI ile Doldur") butonu bulunmaktadır. Bu buton yapımın konusunu (`desc`) internet/Gemini üzerinden çekip doldurmaktadır.
* **Güvenlik Mekanizması:**
  1. **AI Yorum Alanına Asla Dokunamaz:** AI istek gövdesinde ve promptunda `review` alanına yer verilmez.
  2. **Otomatik Sekme Geçişi:** Kullanıcı `[ YORUMUM ]` sekmesindeyken "AI ile Doldur" veya "Konu Önerisini Kabul Et" butonuna basarsa:
     * Form **anında ve sessizce `[ KONUSU ]` sekmesine geçer.**
     * AI'ın bulduğu özet `desc` kutusuna yazılır.
     * Kullanıcının yazdığı kişisel `review` metni arka planda **%100 korunur**, hiçbir şekilde ezilmez, silinmez veya değiştirilmez.

---

## 🔍 4. Kart Detay Ekranında Gösterim Standardı (`ImagePreviewModal`)

Kullanıcının onayı ile **Karakterler Altında Bağımsız Kutu** modeli kesinleştirilmiştir:

### 📌 Yerleşim ve Akış Sıralaması:
* **Masaüstü (PC Kart Detayı):**
  1. `KONUSU` kutusu
  2. (Varsa) Kitap Alıntıları
  3. `Karakterler & Kadro`
  4. **✍️ KİŞİSEL İNCELEME & YORUM** (Karakterlerin hemen altında, özel çerçeveli ve tırnak işaretli şık blok)
* **Mobil (3D Flip Kart Arkası):**
  1. Başlık & Künye
  2. `KONUSU`
  3. (Varsa) Kitap Alıntıları
  4. `Karakterler & Kadro`
  5. **✍️ KİŞİSEL İNCELEME & YORUM** (Karakterlerin altı, Türler'in üstü)
  6. `Türler`

### 💡 Kritik UI Kuralı (Sıfır Kalabalık):
* Eğer bir yapıma yorum yazılmamışsa (`review` boş veya tanımsızsa), bu kutu arayüzde **HİÇ RENDER EDİLMEZ (tamamen gizlenir).**
* Yorum yazılmayan kartlarda fazladan boşluk, buton veya gereksiz kalabalık oluşmaz. Sadece yorum yazılmış yapımlarda parıldayarak açılır.

---

## 🚀 5. Aşamalar (Uygulama & Test Planı)

Yorum sistemi, uygulamanın kararlılığını korumak ve her adımı kontrollü şekilde doğrulamak adına **2 Aşama** halinde hayata geçirilecektir:

### 📌 1. AŞAMA: Veri Modeli, Form Düzenlemeleri & AI Koruması
1. **Veri Modeli:** `src/types.ts` içine `review` alanının geriye dönük uyumlu şekilde eklenmesi.
2. **Form Başlıkları:** `AddItemModal` ve `ItemDetailModal` pencerelerinde mevcut UI düzenini milimetrik olarak koruyan minimalist `[ KONUSU ]` | `[ YORUMUM ]` metin sekmelerinin kurulması.
3. **Özgür Erişim:** Yorum alanının puan ve durumdan bağımsız olarak her zaman tıklanabilir ve düzenlenebilir olması.
4. **AI Güvenlik Kalkanı:** Kullanıcı yorum sekmesindeyken AI ile Doldur butonuna basıldığında otomatik ve sessizce `KONUSU` sekmesine sıçranması; AI'ın yalnızca konuyu doldurup kullanıcının yorumuna asla dokunmaması.
5. **Yedekleme Güvencesi:** "Tam Sistem Yedeği Oluştur", ZIP, JSON ve GitHub yedeklerinde `review` alanının eksiksiz dahil edilmesi.
6. **🔔 Aşama 1 Sonu Zorunlu Görev:** 1. Aşama tamamlandığında kullanıcıya yapılan değişiklikleri adım adım test edebileceği **detaylı ve maddeli bir Test Rehberi** sunulacaktır.

---

### 📌 2. AŞAMA: Kart Detay Ekranında Gösterim (PC & Mobil)
1. **Masaüstü Gösterimi (PC):** `ImagePreviewModal` içinde Karakterler & Kadro bölümünün hemen altında şık, tırnak işaretli kişisel inceleme bloğunun oluşturulması.
2. **Mobil Gösterimi (Back Face):** Kartın arka yüzünde Karakterler'in altında, Türler'in hemen üstünde akıcı inceleme kartının yerleştirilmesi.
3. **Sıfır Kalabalık Mantığı:** Yorum yazılmamış yapımlarda bu kutunun tamamen gizlenerek arayüzde sıfır fazlalık oluşturmasının sağlanması.
4. **🔔 Aşama 2 Sonu Zorunlu Görev:** 2. Aşama tamamlandığında tüm yorum sisteminin (Ekleme -> Düzenleme -> AI Koruması -> PC ve Mobil Gösterim -> Yedekleme) entegre çalıştığını doğrulayan **kapsamlı bir Final Test Rehberi** sunulacaktır.
