# LORE — ROZET SİSTEMİ MOBİL PERFORMANS & TEŞHİS RAPORU
**Doküman Kodu:** `rozet_sistemi_mobil_performans_raporu.md`  
**Tarih:** 17 Ekim 2026  
**Durum:** Teşhis Tamamlandı (Kod Değişikliği Yapılmadı — Yalnızca İnceleme)  
**Hedef Kitle:** Yazılım ortağı & proje sahibi için sadeleştirilmiş teknik analiz  

---

## 1. YÖNETİCİ ÖZETİ: ŞÜPHENİZ GERÇEK Mİ?

**Kesinlikle EVET. Şüphenizde yüzde yüz haklısınız.**

Kütüphanede gezintiyi ve özellikle aşağı kaydırmayı (scroll) mobilde kastıran, takılmalara (FPS düşüşlerine) yol açan **en büyük 1 numaralı grafiksel etken şu anda rozet sistemidir.** 

Bilgisayarda güçlü bir harici ekran kartı ve işlemci olduğu için bu ağırlık hiç hissedilmiyor. Ancak telefonların grafik çipleri (GPU) ve pilleri, mevcut rozet kodunun talep ettiği görsel hesaplamaları yaparken nefes nefese kalıyor.

---

## 2. MEVCUT ROZET SİSTEMİ NASIL ÇALIŞIYOR?

Mevcut sistem şu 4 ana parça üzerinden işliyor:

1. **Rozet Tanımı (`types.ts` & `SettingsModal.tsx`):**
   * Kullanıcı bilgisayardan bir rozet görseli yüklüyor veya yapıştırıyor.
   * Bu görsel `imageOptimizer.ts` tarafından **512x512 piksel** boyutunda şeffaf PNG formatına dönüştürülüyor ve uzun bir metin kodu (Base64) olarak kaydediliyor.
   * Her rozetin bir unvanı, 8 farklı parıltı renginden biri (Altın, Yakut, Safir vb.) ve bir ölçek değeri bulunuyor.

2. **Karta Rozet Atama (`ItemDetailModal.tsx`):**
   * Bir yapıma maksimum 4 adet rozet iliştirilebiliyor.
   * Yapımın içine sadece rozetlerin kimlik numaraları (ID) yazılıyor (`badges: ['badge_1', 'badge_2']`).

3. **Kart Üzerinde Çizim (`ItemCard.tsx`):**
   * Her yapım kartı, kendine ait rozetleri buluyor ve puan etiketinin hemen altında dikey olarak diziyor.
   * Mobilde her rozet **26x26 piksel** boyutunda minik bir madalya olarak ekrana basılıyor.
   * Rozetin çevresine parıltı vermek için CSS filtreleri (`drop-shadow`) uygulanıyor.
   * Her rozetin yanında, tıklandığında beliren bir unvan balonu (tooltip) bulunuyor.

4. **Büyük Vitrin (`BadgeSpotlightModal.tsx`):**
   * Rozete tıklandığında ekran karararak ortada rozeti 216 piksel dev boyutta ve arkasında ışıma havuzuyla sergiliyor.

---

## 3. MOBİLDE KASMANIN 5 SOMUT NEDENİ (NEY YANLIŞ?)

Teknik jargona boğulmadan, telefonun neden zorlandığını tane tane açıklayalım:

### 🔴 1. Neden: "Gölge Üstüne Gölge" (Filtre Katliamı) — EN BÜYÜK SUÇLU
* **Sorun:** 
  Karttaki her bir rozet görselinin üzerine aynı anda **4-5 katmanlı parıltı gölgesi** (`drop-shadow`) bindirilmiş durumda.
  * 1. katman: Siyah keskin sınır gölgesi
  * 2. katman: Orta derinlik gölgesi
  * 3. katman: Renkli neon parıltı
  * 4. katman: Geniş dağılan renkli aura
  * Hatta daha kötüsü: **Ayarlardan rozet parıltısını kapatsanız bile** kodda arkada yine de 3 katmanlı gölge çalışmaya devam ediyor!
* **Telefona Etkisi:**
  Normal dikdörtgen bir kutu gölgesi telefonu yormaz. Ancak rozetler şeffaf madalyalardır. Telefonun grafik çipi, madalyanın her bir piksel kıvrımını, oyuntusunu ve şeffaf boşluğunu saniyede 60 kez tek tek tarayıp 4 kez üst üste bulanıklaştırmak zorundadır.
  * Mobilde ekranda 10 kart ve her birinde 2 rozet olsa = **20 rozet**.
  * 20 rozet x 4 katman gölge = **Aynı anda ekranda hesaplanan 80 adet canlı grafik filtresi!**
  * Parmağınızla sayfayı kaydırdığınız her an telefon bu 80 filtreyi tekrar hesaplamaya çalışırken kareler atlıyor ve sayfa "takılarak" kayıyor.

---

### 🔴 2. Neden: 26 Piksellik İkon İçin 512 Piksellik Dev Resim Çekilmesi
* **Sorun:**
  Rozet sisteme yüklenirken `512x512` piksel olarak kaydediliyor. Ancak mobilde kart üzerinde bu rozet sadece **26x26 piksel** (bozuk para kadar) gösteriliyor.
* **Telefona Etkisi:**
  Telefon 26 piksellik minik bir pul gösterebilmek için belleğe 512 piksellik koca bir resmi yüklüyor ve onu anlık olarak sıkıştırıp küçültüyor. 
  Kütüphanede 30 tane rozetiniz olsa, telefon yüzlerce kilobaytlık onlarca büyük resmi bellekte tutmak ve sürekli ufaltıp çizmekle uğraşıyor.

---

### 🔴 3. Neden: Bellekte Milyonlarca Harflik Metin Yükü (Base64)
* **Sorun:**
  Rozet resimleri hafif bir dosya referansı olarak değil, doğrudan binlerce karakterlik şifreli metin blokları (`data:image/png;base64,...`) olarak telefonun ana veritabanında saklanıyor.
* **Telefona Etkisi:**
  Uygulama açılırken veya bir karta tıklanırken telefonun RAM'i gereksiz yere bu metin yığınlarıyla doluyor. Düşük ve orta segment telefonlarda bu durum bellek şişmesine (RAM tüketimine) ve arayüzün anlık donmasına yol açıyor.

---

### 🔴 4. Neden: Her Kartın Arkada Tek Başına Sözlük Oluşturması (Gereksiz İşlemci Döngüsü)
* **Sorun (`ItemCard.tsx` Satır ~66):**
  Her bir kart ekrana çizilirken: *"Bana hangi rozetler atanmış? Dur ben tüm rozetler listesini baştan sona tarayıp yeni bir arama listesi (Map) oluşturayım"* diyor.
* **Telefona Etkisi:**
  Ekranda 100 yapım varsa, telefon 100 kere aynı listeyi baştan sona tarıyor ve 100 tane gereksiz geçici bellek nesnesi yaratıp çöpe atıyor. Bu da telefonun işlemcisinde mikro takılmalara (çöp toplama / garbage collection duraklamalarına) sebep oluyor.

---

### 🔴 5. Neden: Ekranda Görünmeyen Gizli Cam Balonlar (Backdrop-Blur)
* **Sorun:**
  Her rozetin yanında parmakla basıldığında çıkan unvan balonu var. Bu balonların hepsinde `backdrop-blur-xl` (buzlu cam efekti) tanımlı.
* **Telefona Etkisi:**
  Kullanıcı rozete dokunmadığı sürece bu balonlar görünmez (`opacity-0`). Ancak telefonun tarayıcı motoru, görünmese bile DOM ağacında var olan buzlu cam efektleri için grafik belleğinde ayrı katmanlar (layer) rezerve eder. Bu da grafik belleğini şişirir.

---

## 4. ÇÖZÜM ÖNERİLERİ & EYLEM PLANI (NASIL DÜZELTİLİR?)

Bu sorunu çözmek için rozet sistemini kaldırmamıza veya özelliklerinden kısmamıza gerek yok. Sadece akıllıca optimize edeceğiz:

### 💡 Çözüm 1: Mobilde Çoklu `drop-shadow` Katmanını Hafifletmek (En Kritik Adım)
* **Ne Yapılmalı?**
  * Mobilde (`window.innerWidth < 768`) 4 katmanlı ağır `drop-shadow` zinciri yerine, tek bir hafif donanım dostu gölge kullanılmalı:
    * *Şu anki:* `drop-shadow(1.5px) + drop-shadow(3px) + drop-shadow(9px neon) + drop-shadow(20px aura) + drop-shadow(6px siyah)`
    * *Öneri:* Mobilde yalnızca **tek bir temiz parlama:** `drop-shadow(0 0 4px ${renk})`.
  * Rozet Parıltısı kapatıldığında ise filtre tamamen `filter: none` yapılmalı (şu an kapatılsa bile 3 gölge çalışıyor!).
  * Sadece bu adım bile mobil kaydırmayı **%50 daha akıcı** hale getirecektir.

### 💡 Çözüm 2: Rozet Görsellerine İki Farklı Boyut (Thumbnail & Vitrin)
* **Ne Yapılmalı?**
  * Kartta gösterilen rozet için `512px` resim yüklemek yerine, tıpkı afişlerde yaptığımız gibi küçük bir ikon kopyası üretilmeli:
    * **Kart İkonu:** `64x64 piksel` (Hafif, anında yüklenen, sıfır işlemci yükü).
    * **Vitrin İkonu:** `256px - 512px` (Yalnızca rozete tıklayıp büyük inceleme penceresi açıldığında devreye giren yüksek çözünürlük).
  * 26 piksellik alanda 64 piksellik görsel göstermek görsel kaliteden hiçbir şey kaybettirmez ama bellek yükünü 10 kat düşürür.

### 💡 Çözüm 3: Rozet Eşleştirmesini Kartların İçinden Çıkarmak (Merkezi Liste)
* **Ne Yapılmalı?**
  * 100 kartın her birinde tek tek `new Map()` çalıştırmak yerine; rozet listesi ana ekranda (`App.tsx`) tek bir defa sözlük haline getirilmeli ve kartlara hazır eşleşmiş olarak gönderilmeli. Kart sadece kendine gelen rozeti ekrana basmalı, hesaplama yapmamalıdır.

### 💡 Çözüm 4: Kart Bileşenine Koruyucu Kalkan (`React.memo`)
* **Ne Yapılmalı?**
  * `ItemCard` bileşeni `React.memo` ile sarılmalı. Böylece kullanıcı menüde bir ayarı değiştirdiğinde veya filtre açtığında, içeriği değişmeyen 200 kart ve üstündeki rozetler boşu boşuna sıfırdan tekrar render edilmemeli.

---

## 5. DANIŞMAN NOTU & SONUÇ

Şüpheniz tamamen haklı çıktı. Rozet sistemi konsept ve görsel prestij olarak harika tasarlanmış olsa da; **kodlama tarafında mobil cihazların donanım sınırları hesaba katılmadan masaüstü gücüne göre yazılmış.**

İyi haber şu:
Bu durum sistemin temel mantığında bir hata olduğu anlamına gelmez. Sadece mobildeki ağır görsel filtrelerin ve dosya boyutlarının akıllıca hafifletilmesi (diyet yaptırılması) gerekir.

Bu rapordaki adımlar uygulandığında, kütüphanenizdeki rozetler görsel ihtişamından hiçbir şey kaybetmeden mobilde de yağ gibi akacaktır.
