# LORE — MOBİL PERFORMANS & AKICILIK OPTİMİZASYON REHBERİ
**Doküman Kodu:** `mobiloptimizasyon.md`  
**Oluşturulma Tarihi:** 14 Ekim 2026  
**Kapsam:** Mobil Cihazlarda (Telefon/Tablet) Yağ Gibi Akıcı Deneyim (60+ FPS) Stratejisi & Teşhis Raporu  

---

## 1. DURUM TESPİTİ: MOBİLDE NEDEN TAKILMA YAŞANIYOR?

Kullanıcı deneyimi: PC'de çok rahat ve akıcı çalışan Lore, mobil cihazlarda aşağı kaydırırken ve kütüphanede gezinirken hantallaşmakta, kare atlamaları yaşanmaktadır. Diğer bazı Android native uygulamalarda ise yüzlerce afiş olmasına rağmen kaydırma "yağ gibi" akmaktadır.

Yapılan detaylı kod incelemesi sonucunda bu takılmanın temel sebebinin **"web uygulaması olmak" değil**, telefonun üzerine bindirilen **3 büyük gereksiz yük** olduğu tespit edilmiştir:

---

## 2. TESPİT EDİLEN 3 TEMEL DARBOĞAZ (FREN)

### 📌 1. Fren: Ekrana Tüm Kartların Aynı Anda Çizilmesi (Virtualization Yokluğu)
* **Mevcut Kod Durumu (`App.tsx` Satır ~2274):**
  Kütüphanede veya seçili kategoride kaç yapım varsa (örneğin 150-300 adet); Lore bunların tamamını (`ItemCard`) tek bir seferde ekrana basmaktadır.
* **Telefona Etkisi:**
  Kullanıcı ekranda sadece en üstteki 3-4 kartı görürken; telefon arkada henüz kaydırılmamış 146 kartı, afişlerini, rozetlerini, vinyet gölgelerini ve metinlerini canlı olarak belleğinde taşımaktadır. Aşağı kaydırdıkça telefon işlemcisi ve grafik çipi aşırı ısınır, kare sayısı (FPS) düşer.
* **Native Uygulamalar Ne Yapıyor?**
  Native Android uygulamalar (veya iyi optimize edilmiş web siteleri) **"Sanal Liste (Virtualization / Windowing)"** mantığıyla çalışır. Ekranda kaç kart görünüyorsa (örn. 6 adet) sadece onları çizer. Aşağı kaydırdıkça yeni gelen 3 kartı çizer, yukarıda kalanları bellekten düşürür.

---

### 📌 2. Fren: Resimlerin Hafızada "Devasa Metin Yığını" Olarak Taşınması (Base64)
* **Kullanıcı Algısı:** *"Ben internet linki yapıştırmıyorum, PC'den doğrudan dosya seçip yüklüyorum."*
* **Mevcut Kod Durumu (`fileSystem.ts` & `App.tsx`):**
  Kullanıcı bilgisayardan `.jpg` veya `.png` dosyası yüklediğinde, bilgisayarda bu dosya fiziksel olarak klasöre kaydedilir. Ancak bu resim telefonun tarayıcı belleğine aktarılırken `data:image/jpeg;base64,...` formatına, yani **yüzbinlerce harften oluşan devasa şifreli metin bloklarına** dönüştürülmektedir.
* **Telefona Etkisi:**
  Her bir afiş için telefonun RAM'inde 300-500 sayfalık kalın bir kitap ağırlığında metin tutulmaktadır. 100 afiş, telefonun minik tarayıcısının sırtına onlarca megabaytlık metin yükler.
* **Çözüm (Blob / Emanet Fişi Mantığı):**
  Resimler o devasa harf çorbasına çevrilmez; telefonun IndexedDB deposunda ikili dosya (Blob) olarak saklanır. Ekrana ise yüzbinlerce harf yerine sadece 30 karakterlik bir geçici emanet fişi (`blob:xxx-yyy`) verilir. Telefon bu sayede resmi sadece ekrandayken doğrudan grafik belleğinden çeker, RAM tüketimi %80-90 oranında azalır.

---

### 📌 3. Fren: Buzlu Cam (Backdrop-Blur) ve Sinematik Vinyet Yükü
* **Mevcut Durum:**
  Lore'un masaüstünde harika görünen koyu cam efektleri (`backdrop-blur-xl`), kart altı parlamaları ve sinematik vinyet gölgeleri bulunmaktadır.
* **Telefona Etkisi:**
  Bilgisayarın harici ekran kartı bu bulanıklık hesaplarını hissetmez. Ancak mobil grafik işlemcileri (GPU) kaydırma esnasında arkadaki pikselleri saniyede 60 kez yeniden bulanıklaştırmaya çalışırken kilitlenir.

---

## 3. GELECEK UYGULAMA PLANI (YAPILACAKLAR LİSTESİ)

Tekrar çalışmaya başlandığında adım adım uygulanacak optimizasyon reçetesi:

1. **Aşama 1: Resimleri Blob URL (Emanet Fişi) Mimarisine Taşımak**
   * IndexedDB'deki afişleri Base64 metin olarak `item.thumbnail` içinde taşımak yerine, bileşen ekrana girdiğinde hafızayı yormayan `URL.createObjectURL(blob)` referansıyla çağırmak.
   * Ekrandan çıkan veya bileşeni kapanan görsellerin `URL.revokeObjectURL()` ile belleğini anında tahliye etmek.

2. **Aşama 2: Sanal Kaydırma (Virtualization / Chunked Lazy Render)**
   * `items-grid` alanında tek seferde 200 kart basmak yerine; ekranda görünen ve bir sonraki ekranda belirecek kartları (örneğin ilk 12-18 kart) basıp, kullanıcı aşağı kaydırdıkça yeni blokları akıcı biçimde ekrana eklemek (veya `content-visibility: auto` gibi modern CSS donanım hızlandırma özelliklerini devreye almak).

3. **Aşama 3: Mobil Donanım Hızlandırma & CSS Diyeti**
   * Mobilde (`window.innerWidth < 768`) kartlar üzerindeki aşırı işlemci tüketen `backdrop-blur` filtrelerini GPU dostu düz koyu arka planlara (`bg-neutral-900`) dönüştürmek.
   * Kart geçiş animasyonlarına donanım hızlandırma (`transform: translateZ(0)` / `will-change: transform`) eklemek.

---

## 4. ANDROID NATIVE KARARI HAKKINDA DANIŞMAN NOTU
* Android Native yazmak teknik olarak mümkündür ve dosya klasörüne doğrudan erişim sağlar.
* Ancak tek kişilik geliştirme ortamında aynı uygulamayı iki ayrı dilde (hem Web hem Android) sıfırdan geliştirmek ve sürekli senkron tutmak çok ağır bir bakım yüküdür.
* Web mimarisinde yapılacak yukarıdaki 3 optimizasyon, mobil deneyimi native uygulamalardan farksız akıcılığa kavuşturacak güçtedir; bu sebeple mevcut PWA yapısını koruyup performansını uçurmak en akılcı ve sürdürülebilir yoldur.
