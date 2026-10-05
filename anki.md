# Lore Anki / Flashcard Sistemi Tasarım & Yol Haritası

## 1. Kesinleşen ve Karar Verilen Esaslar

### A. Giriş & Ana Deste Ekranı (Anki Hub)
- **Tetikleyici Buton:** Sol alttaki yüzen menüde (FAB) **"Son Aktiviteler"** ile **"Lore AI Asistan"** butonlarının arasına üçüncü bir yüzen buton olarak Anki ikonu (Ekle/Düzenle formundaki `Layers` ikonu, metinsiz/yalnızca ikon) konumlanacak. Üst bara kesinlikle ikon/buton eklenmeyecektir.
- **Hiyerarşik Deste Tablosu (Otomatik Türetilen Ağaç Yapısı):**
  - **Ayrı Deste Sistemi YOKTUR:** Deste hiyerarşisi kullanıcıdan yeni bir "deste adı" girmesini istemez. Eserlerin mevcut `mainTab` (`media`, `game`, `book`) ve `cat` / `sub` alanlarından **tamamen otomatik** çıkarılır.
  - Orijinal Anki masaüstü arayüzündeki gibi `+` / `-` ile açılıp daraltılabilen minimalist ağaç yapısı.
  - **Sade Tasarım (Kesin Kural):** Deste isimlerinin başında **KESİNLİKLE EMOJİ / İKON OLMAYACAK**. Tamamen sade ve minimalist Anki tipografisi:
    ```text
    Deste                         Yeni    Öğreniliyor    Tekrar
    [-] Medya                        0              3        46
          Anime                      0              0         7
          Film                       0              2         3
          Dizi                       0              1         2
    [+] Oyun                        15              0         4
    [+] Kitap                        0              0         0
    ```
- **Üst Deste Toplam Kuralı:** 
  - Ana kategori satırlarındaki (örn: Medya) sayılar, altındaki alt kategorilerin (Anime + Film + Dizi) matematiksel toplamıdır.
- **Sayı Sayaçları & Vade Mantığı (Orijinal Anki Renkleri & Gün Sonu Kuralı):**
  - **Yeni (Mavi):** Henüz hiç çalışılmamış kartlar (`card.state === State.New`).
  - **Öğreniliyor (Kırmızı):** Öğrenme veya yeniden öğrenme aşamasında olan kartlar (`card.state === State.Learning || card.state === State.Relearning`). Dakika bazlı vadesi dolmuş olanlar (`card.due <= now`).
  - **Tekrar (Yeşil - Gün Sonu Kuralı):** Daha önce öğrenilmiş kartlar (`card.state === State.Review`). Orijinal Anki mantığı gereği gün bazlı hesaplanır: Vadesi **bugünün sonuna (23:59:59)** kadar olan tüm kartlar sabahtan itibaren yeşil sayaca dahil edilir. Böylece gece çalışılan kart için ertesi gün aynı saate kadar beklenmez.
  - **Sıfır Değerleri:** Sayı `0` olduğunda orijinal Anki'deki gibi **sönük gri** görünür; sıfırdan büyük olduğunda kendi canlı rengini (Mavi / Kırmızı / Yeşil) alır.
- **"Bugün X Kart Çalışıldı" Sayacı:**
  - Ekstra bir veritabanı alanı veya sayaç dizisi eklenmez.
  - `ankiCard.last_review` tarihi bugünün yerel tarihiyle (`YYYY-MM-DD`) eşleşen benzersiz kartların anlık toplamı olarak hesaplanır.
- **Kategori Kartlarına Erişim (Gelecek Notu):**
  - Deste Hub ağaç görünümündeki kategori isimlerinin ("Anime", "Film" vb.) sıkışmaması ve tablonun temiz kalması amacıyla satır içi `[Kartlar]` butonu ve alt detay listesi kaldırıldı. Kullanıcının aklındaki alternatif kart listeleme/erişim fikri en son aşamada ele alınacaktır.
- **Genel Çalışma:** En altta tek tıkla **"Tümünü Çalış (Karışık)"** butonu.
- **İlerleme Özeti:** Tablonun altında *"Bugün X kart çalışıldı"* özet bilgisi.
- **Limit Politikası:** Kesinlikle hiçbir yapay günlük limit YOK. Kullanıcı dilediği kadar kartı tek nefeste çalışabilir.
- **Klavye Kısayolları:** İptal edildi. Sade fare/dokunmatik kontroller.
- **Undo (Geri Al):** İptal edildi. Sade ve hızlı akış.

---

### B. Algoritma (`ts-fsrs`), Veri Bütünlüğü & Anlık Kayıt
- **Resmi Standart:** Kendi formüllerimizi uydurmak kesinlikle YOK. Doğrudan resmi **`ts-fsrs`** kütüphanesi varsayılan parametreleriyle (`generatorParameters()`) kullanılacak. Kütüphane sürümünün sağladığı resmi `Card` tipine tam riayet edilecek.
- **İlk Başlatma (Güvenli Başlangıç):**
  - Eserde `anki: true` yapıldığında `ankiCard` alanı henüz yoksa anında `createEmptyCard(new Date())` ile başlatılır. Kodda asla `undefined` kart hatası oluşmaz.
- **Tarih Güvenliği & Serileştirme (Kritik Teknik Kural):**
  - Eserler JSON (GitHub Sync / ZIP Dışa Aktarma) olarak kaydedilirken `Date` nesneleri ISO string metne dönüşür.
  - Veri uygulamaya yüklenirken / bellekten okunurken `due` ve `last_review` alanları mutlaka yardımcı bir fonksiyonla gerçek JavaScript **`new Date(...)`** nesnesine dönüştürülmelidir. Aksi takdirde `f.repeat()` ve tarih karşılaştırmaları hata verir.
- **Önemli Davranış Notu (Yeni Karta "İyi" Dendiğinde):**
  - FSRS'in varsayılan öğrenme adımları (`learning steps`) gereği, yeni bir karta ilk kez "İyi" dendiğinde kart doğrudan günlere fırlamaz; ~10 dakikalık öğrenme adımına girer ve **Öğreniliyor (Kırmızı)** sayacına geçer. Bu bir hata değil, FSRS'in resmi davranışıdır.
- **Dinamik Buton Süreleri & Türkçe İsimler (Orijinal Anki):**
  - Butonların altındaki süreler (`10 dk`, `1 gün`, `3 gün`, `12 gün` vb.) **kesinlikle sabit yazılmaz**.
  - Kütüphanenin `f.repeat(card, now)` fonksiyonu her 4 butonun sonucunu o kartın özel geçmişine göre anında hesaplar ve dinamik gösterilir.
  - **4 Değerlendirme Butonu:**
    - 🔴 **Yeniden** *(Unutulduğunda)*
    - 🟠 **Zor** *(Zorlanarak hatırlandığında)*
    - 🟢 **İyi** *(Normal hatırlandığında)*
    - 🔵 **Kolay** *(Zahmetsizce bilindiğinde)*
- **Anlık Kayıt Prensibi (Atomic Persistence):**
  - Kullanıcı 4 butondan birine bastığı **o saniye**, kütüphanenin ürettiği yeni `Card` hali doğrudan eserin verisine kalıcı olarak yazılır. Oturumdan çıkılsa dahi o kartın sonucu asla kaybolmaz.
- **Sıfırlama İşlemleri (Aşama 3'e Öne Çekildi):**
  - **Kart Bazında Sıfırlama:** Deste Ekranında (Hub), Ekle/Düzenle ekranında ve Kart Detayında `[🔄 Anki İlerlemesini Sıfırla]` butonu (kartı anında `createEmptyCard(new Date())` haline döndürür). Testler sonrası kartları temizlemeyi çok kolaylaştırır.
  - **Toplu Sıfırlama:** Anki Ayarlarında `[⚠️ Tüm Anki Geçmişini Sıfırla]` seçeneği. Yanlışlıkla basmayı önlemek için uygulamanın mevcut `CustomDialog` onay penceresiyle iki aşamalı onay zorunludur.

---

### C. Tip A Kart Mekaniği ("Görselden Tanı")
1. **Varsayılan Görsel & Placeholder:**
   - Ön yüzde her zaman eserin afişi gelir. Afiş yoksa mevcut placeholder kutusu gösterilir ve afiş yükleme butonu sunulur.
2. **Çoklu Görsel Deneyimi:**
   - Başlangıçta **Seçenek B (Kart içi galeri okları)** ile başlanacak. İleride istenirse **Seçenek C (Rastgele Sahne)** modu da ayar olarak eklenecek.
3. **ÖN YÜZ - 1. Aşama (Soru Hali):**
   - Üstte görsel ortadadır. Varsa o görsele ait blur kutuları buğuludur.
   - Başlık kesinlikle gizlidir.
   - En altta geniş **"Cevabı Göster"** butonu yer alır.
4. **ÖN YÜZ - 2. Aşama ("Cevabı Göster"e Basıldığı An - HÂLÂ ÖN YÜZDESİN):**
   - **Görsel üzerindeki blur anında kalkar**, orijinal görsel netleşir.
   - Görselin hemen altında yapımın **BAŞLIĞI** belirir.
   - "Cevabı Göster" butonu kaybolur; yerine 4 değerlendirme butonu gelir: **[Yeniden] [Zor] [İyi] [Kolay]**.
   - Kart aynı zamanda **3D Flip edilebilir** (tıklayınca arkası dönebilir) hale gelir.
   - *Not:* Kullanıcı isterse doğrudan butonlardan birine basıp sonraki karta geçer; isterse karta tıklayıp arka yüze bakar.
5. **ARKA YÜZ (Mevcut Zengin Künye / Detay Okuma - 3D Çevrildiğinde):**
   - Lore'un mevcut mobil kart detayındaki temiz ve zengin arka yüzü doğrudan korunarak gelir:
     - Başlık ve Yapım Yılı
     - Firma / Yönetmen (Medya) veya Geliştirici (Oyun)
     - **KONUSU (Özet)**
     - Karakterler & Kadro (fotoğraflı ve seslendirmenli mini kutular)
     - *(Kafaya göre ekstra rozet veya süsleme eklenmeyecek, mevcut temiz şablon korunacak).*

---

### D. Veri Modeli, Görsel Referansı & Blur Yöneticisi
- **Veri Modeli Şeması (`ArchiveItem` Entegrasyonu):**
  ```typescript
  // types.ts içinde ArchiveItem'a eklenecek alanlar:
  export interface AnkiBlurBox {
    id: string;
    x: number;      // % cinsinden (0-100)
    y: number;      // % cinsinden (0-100)
    width: number;  // % cinsinden
    height: number; // % cinsinden
  }

  export interface AnkiExtraImage {
    id: string;
    url: string;             // sadece 2. ve 3. sahne görselleri için base64 / path
    blurs: AnkiBlurBox[];    // bu ek görsele özel bağımsız blur kutuları
  }

  // ArchiveItem içinde:
  anki: boolean;                 // Deste ağacına dahil mi? (varsayılan: false)
  ankiCard?: Card;               // ts-fsrs kütüphanesinin saf Card nesnesi
  ankiMainBlurs?: AnkiBlurBox[]; // 1. RESİM (Ana afiş) İÇİN BLUR KUTULARI (afiş asla tekrar kopyalanmaz, thumbnail kullanılır!)
  ankiExtraImages?: AnkiExtraImage[]; // İsteğe bağlı 2. ve 3. ek sahne resimleri
  ```
- **Afişin Kopyalanmaması Prensibi (Veri Şişmesini Önleme):**
  - 1. resim için asla yeni bir base64 kopyası oluşturulmaz. Eserin mevcut `item.thumbnail` alanı doğrudan kullanılır.
  - Ana afişin blur kutuları `ankiMainBlurs` içinde saklanır. Böylece yedek dosyaları ve GitHub senkronizasyonu 1 bayt bile gereksiz şişmez.
- **Afişi Olmayan Eserler İçin UX Kuralı:**
  - Eserin afişi yoksa editör açıldığında ortada şık bir placeholder ve `[🖼️ Afiş veya Sahne Görseli Yükle]` butonu sunulur. Kullanıcı afiş ekleyip anında blur kutularını çizebilir.
- **Veri Koruma İlkesi (Anki Aç/Kapa Güvenliği):**
  - `anki: boolean` anahtarı kapatıldığında (`false`), eser sadece Anki deste ekranında gizlenir; **mevcut `ankiCard` ilerlemesi ve blur kutuları ASLA silinmez**.
  - Kullanıcı ileride tekrar açtığında tüm ilerleme ve vadeler kaldığı yerden eksiksiz devam eder.
- **Çoklu Resim ve Blur Bağımsızlığı Kuralı:**
  - Bir ek görsel (`ankiExtraImages`) silindiğinde, ona ait blur kutuları da otomatik olarak temizlenir. Ana afişteki kutular bundan asla etkilenmez.
- **Anki Editörü Modalı (Üst Katman Pop-up & Güvenlik Kuralı):**
  - **Dışarı Tıklama Güvenliği:** Arka plandaki karartıya veya dışarıya tıklandığında modal **KESİNLİKLE KAPANMAZ**. Emeğin yanlışlıkla kaybolması önlenir.
  - **Boyut & Konum:** Ekranın tam ortasında geniş, ferah pencere (`max-w-3xl`).
  - **Üst Alan:** Sade başlık ("Anki Görsel & Blur Editörü") ve sağ üstte `[X]` kapatma ikonu.
  - **Orta Alan (Görsel Sahnesi):**
    - Eserin dikey afişi orijinal **2:3 en/boy oranı bozulmadan**, dikey olarak pencerenin ortasına sığdırılır.
    - Blur kutuları görsel üzerinde doğrudan taşınabilir (`drag`), kenar/köşelerinden çekilip yeniden boyutlandırılabilir (`resize`), sağ üstteki `X` ile silinebilir.
    - Koordinatlar kesinlikle **yüzdesel / oransal (`%`)** saklanır (ekran boyutundan bağımsız milimetrik sabitlik).
  - **Alt Çubuk Araçları:**
    - `[+ Blur Kutusu Ekle]`
    - `[👁️ Blur Aç / Kapat]`: Kutuların altındaki başlığı/metni net görmek için buğuyu geçici açıp kapatma önizlemesi.
    - `[🖼️ + Yeni Resim Ekle]`: Çoklu sahne/ipucu görselleri ekleme, `[< 1 / 3 >]` galeri geçişi ve `[🗑️ Bu Görseli Sil]`.
  - **Aksiyon Butonları & Form Entegrasyonu:**
    - **`[✓ Uygula ve Kapat]`**: Çizilen kutuları ve resimleri düzenleme formunun geçici hafızasına aktarır ve editörü kapatır.
    - **`[Vazgeç]`**: Yapılan geçici çizimleri iptal edip editörü kapatır.
    - **Arka Form Durumu:** Editör kapandığında ana düzenleme formu açık kalmaya devam eder. Formdaki Anki kutusunun altına *"✓ Blur kutuları hazırlandı (Kaydetmek için aşağıdaki 'Değişiklikleri Kaydet' butonuna basınız)"* rehber uyarısı düşer. Ana form kaydedilmeden hiçbir şey kalıcı veritabanına yazılmaz.

---

### E. Oturum İçi Çalışma Döngüsü & Saf FSRS Mantığı
- **Kuyruk Sıralaması (Orijinal Anki Kuralı):**
  - Bir oturum başlatıldığında kuyruğa girecek kartlar şu öncelik sırasıyla dizilir:
    1. **Öğreniliyor (Learn):** Önceden unutulmuş veya öğrenme adımında vadesi gelmiş kartlar (En yüksek öncelik).
    2. **Tekrar (Due):** Bugün vadesi dolmuş oturmuş kartlar (Gün sonu kuralı dahilinde).
    3. **Yeni (New):** Henüz hiç çalışılmamış kartlar.
- **Kuyruk Yönetimi (Uygulama İçi RAM Mantığı):**
  - Oturum içi kart döngüsü uygulamanın o anki geçici ekran state'idir. Kullanıcı oturumun ortasında çıksa dahi sorun olmaz; FSRS vadesi o an kaydedilmiş olduğundan sonraki girişte zamanı gelen kartlar normal şekilde listelenir.
- **Saf FSRS Kuralı (Yapay Yasaklar Yoktur):**
  - Kullanıcı kart ekrandayken 4 butondan birine bastığı anda, doğrudan resmi `ts-fsrs` kütüphanesinin **`f.repeat(card, now)[rating].card`** fonksiyonu çağrılır ve kütüphanenin hesapladığı yeni `Card` hali aynen karta kaydedilir.
  - Kartın durumunu (`Learning`, `Review`, `Relearning`) ve vadesini yalnızca kütüphane belirler; araya hiçbir yapay kural eklenmez.
- **Oturum İçi Akış (Orijinal Anki Mezuniyet & Öğrenme Adımları Kuralı):**
  - Butona basıldığında kartın kaderini doğrudan `ts-fsrs` kütüphanesinin ürettiği `updatedCard.state` belirler:
  - **Mezuniyet (`updatedCard.state === State.Review`):** Kart yalnızca resmi olarak mezun olduğunda (örneğin 2. kez `[İyi]` denildiğinde, veya doğrudan `[Kolay]` basıldığında, ya da daha önceden öğrenilmiş bir Review kartı başarıyla hatırlandığında) oturum kuyruğundan düşer (tamamlanır).
  - **Öğrenmeye Devam (`updatedCard.state === State.Learning` veya `State.Relearning`):** Kart henüz mezun olmamışsa (`[Yeniden]`, `[Zor]` veya ilk kez `[İyi]` basıldığında) kart oturumdan **çıkmaz**; kuyruğun en sonuna aktarılır. Kullanıcı diğer kartları çalıştıkça sıra tekrar bu karta gelir ve tam pekiştirilmeden oturum bitmez.
  - **20 Dakika Öğrenme Avansı (Learn-Ahead Limit):** Anki'nin resmi varsayılan 20 dakikalık avans kuralı sayesinde, öğrenme adımlarındaki kartlar (1 dk, 10 dk) oturum içinde veya deste ekranında beklemeye takılmadan kesintisiz eritilir.
- **Oturumun Bitişi:** Kuyruktaki tüm kartlar başarıyla eritilip mezun olduğunda oturum sona erer ve ekranda *"Tebrikler! Bugünkü tüm tekrarlar tamamlandı."* kutlama ekranı belirir.

---

### F. Geliştirici & Test Aracı: Sanal Zaman Simülatörü
- **Sanal Zaman Çalışma Prensibi:**
  - Simülatör sadece hesaplamalarda kullanılan sanal bir `virtualNow` referans tarihini kaydırır.
  - Simülatör aktifken ekranın en tepesinde belirgin bir uyarı çubuğu parlar:  
    *`⚠️ SANAL ZAMAN AKTİF (+X Gün) - Test Modundasınız`*
  - Kontrol Barı:
    - `[⏱️ +10 Dk]` (Öğrenme adımlarındaki kartları anında doldurur)
    - `[📅 +1 Gün]` (Yarına sarar, vadesi gelen tekrarları yeşile düşürür)
    - `[📅 +3 Gün]` (İleri vadeleri test eder)
    - `[🔄 Gerçek Zamana Dön]` (Sanal ofseti sıfırlar)

---

## 2. Adım Adım Geliştirme ve Test Planı

Her aşama bağımsız olarak inşa edilecek, aşama bitiminde detaylı **Test Rehberi** verilecek ve kullanıcı onaylamadan bir sonraki aşamaya geçilmeyecektir.

### 📍 Aşama 1: Veri Modeli, `ts-fsrs` Kurulumu ve Tarih Motoru
- **Yapılacaklar:**
  1. `ts-fsrs` resmi npm paketinin kurulması.
  2. `src/types.ts` içine `AnkiBlurBox`, `AnkiExtraImage` tiplerinin ve `ArchiveItem` anki alanlarının eklenmesi.
  3. `src/utils/ankiUtils.ts` yardımcı motorunun yazılması:
     - Kart başlatma (`createEmptyCard(new Date())`).
     - JSON'dan okurken `due` ve `last_review` alanlarını güvenli `new Date()` nesnesine çevirme.
     - Kart sayaçlarını hesaplama (Yeni, Öğreniliyor, Tekrar - Gün sonu kuralı dahil).
     - Oturum kuyruğu sıralama fonksiyonu (Learn -> Due -> New).
- **Test Rehberi:** Tip kontrolleri, build derlemesi ve temel util fonksiyonlarının doğrulanması.
> 📌 **Kullanıcı Test Notu:** Bu aşama arkaplan veri motoru ve tip altyapısıdır (UI bileşeni içermez). Kod derleme ve tip doğrulaması yapılmıştır; kullanıcı arayüzü üzerinden ilk görsel test Aşama 2 (Editör) tamamlandığında adım adım uygulanacaktır.

### 📍 Aşama 2: Ekle/Düzenle Ekranı ve Anki Görsel & Blur Editörü Modalı
- **Yapılacaklar:**
  1. `AddItemModal.tsx` içindeki "🧠 Anki" kutucuğu yanına `[🖼️ Anki Editörü]` butonunun bağlanması.
  2. `src/components/AnkiEditorModal.tsx` modalının geliştirilmesi:
     - 2:3 en-boy oranlı görsel sahnesi (mevcut `item.thumbnail` ana görseli; afiş yoksa görsel yükleme daveti).
     - Görsel üzerinde sürüklenebilir (`drag`), yeniden boyutlandırılabilir (`resize`), silinebilir yüzdesel (%) blur kutuları.
     - `[+ Blur Kutusu Ekle]`, `[👁️ Blur Aç/Kapat]` önizleme araçları.
     - `[🖼️ + Yeni Resim Ekle]` ve ek görsellerin bağımsız blur yönetimi.
     - `[✓ Uygula ve Kapat]` ve `[Vazgeç]` butonları. Dışarı tıklayınca kapanmama güvenliği.
     - Ana formda bilgilendirme metni ve form kaydedilince verinin kalıcı olması.
- **Test Rehberi:** Bir eseri düzenleyip Anki'yi açma, blur kutuları çizip taşıma/boyutlandırma, ek resim yükleme ve kaydedip verinin korunduğunu görme.
> 📌 **Kullanıcı Test Notu:** Aşama bittiğinde kullanıcıya adım adım butonları, blur kutusu taşımayı/boyutlandırmayı ve form kaydını sınayabileceği detaylı bir "Kullanıcı Test Rehberi" sunulacaktır.

### 📍 Aşama 3: Sol Alt FAB Anki İkonu, Minimalist Deste Ekranı (Hub), Zaman Simülatörü ve Kart Sıfırlama
- **Yapılacaklar:**
  1. Sol alttaki yüzen menüye (FAB) "Son Aktiviteler" ile "Lore AI Asistan" arasına metinsiz, sadece Ekle/Düzenle formundaki `Layers` ikonuna sahip Anki Hub butonunun eklenmesi (Üst bara kesinlikle ikon/buton eklenmeyecektir).
  2. `src/components/AnkiHubModal.tsx` hiyerarşik deste tablosunun yapılması:
     - Eserlerin `mainTab` ve `cat` alanlarından otomatik türeyen minimalist emojisiz ağaç yapısı.
     - Varsayılan olarak kapalı (collapsed `[+]`) gelen ve açıp kapatılan durumları (`yapim_anki_collapsed_nodes`) hatırlayan ağaç yapısı.
     - Sade ve temiz başlık çubuğu (açıklama metinsiz).
     - Deste / Yeni / Öğreniliyor / Tekrar sütunları ve orijinal Anki renkleri (0 ise sönük gri).
     - Medya üst satırında alt kategorilerin toplamının gösterilmesi.
     - "Bugün X kart çalışıldı" sayacı.
     - `[Tümünü Çalış (Karışık)]` butonu ve deste bazında çalışma butonları.
  3. Zaman Simülatörü çubuğunun eklenmesi (`+10 Dk`, `+1 Gün`, `+3 Gün`, `Sıfırla`, belirgin sarı uyarı şeridi).
  4. Test sonrası kolay temizlik için **`[🔄 Kart İlerlemesini Sıfırla]`** butonunun deste listesine ve kart detayına entegre edilmesi.
- **Test Rehberi:** Ağacı açıp kapama, sayaçların doğruluğunu ve simülatörle zamanı ileri sarınca sayaçların değişimini inceleme, sıfırlama butonunu doğrulama.
> 📌 **Kullanıcı Test Notu:** Aşama bittiğinde kullanıcıya deste ağacını açıp kapatma, sayaç renklerini inceleme, sanal zaman simülatörüyle kartları yarına sarma ve sıfırlama butonlarını deneme adımlarını içeren detaylı bir "Kullanıcı Test Rehberi" sunulacaktır.

### 📍 Aşama 4: Kart Çalışma / Flashcard Ekranı (Tip A Mekaniği, FSRS ve Kalıcılık Testi)
- **Yapılacaklar:**
  1. `src/components/AnkiStudyModal.tsx` çalışma oturumu ekranının yapılması:
     - 1. Aşama: Blur'lu afiş, gizli başlık, `[Cevabı Göster]` butonu, varsa çoklu görsel galerisi okları.
     - 2. Aşama: "Cevabı Göster"e basınca blur kalkması, başlığın belirmesi, 3D flip (arka yüze detay bakma).
     - 4 Değerlendirme Butonu: `[Yeniden]`, `[Zor]`, `[İyi]`, `[Kolay]` ve altlarında `ts-fsrs`'in hesapladığı dinamik süreler (`10 dk`, `1 gün` vb.).
     - Butona basıldığında anlık atomik kayıt ve kuyruk yönetimi.
     - Oturum tamamlama tebrik ekranı.
- **Test Rehberi:** Gerçek bir oturum yapma, kartları yanıtlama, FSRS sürelerini görme ve **sayfayı F5 ile yenileyip tarihlerin/sayaçların bozulmadan kaldığını erken doğrulama**.
> 📌 **Kullanıcı Test Notu:** Aşama bittiğinde kullanıcıya oturum başlatma, "Cevabı Göster" ve 3D flip yapma, butonlara basıp F5 sonrası verinin korunduğunu teyit etme adımlarını içeren detaylı bir "Kullanıcı Test Rehberi" sunulacaktır.

### 📍 Aşama 5: Toplu Sıfırlama Araçları, Ayarlar ve Son Entegrasyon [TAMAMLANDI ✓]
- **Yapılanlar:**
  1. Anki Deste Hub penceresindeki `[🔄 Tümünü Sıfırla]` butonuna `CustomDialog` çift onaylı güvenlik penceresi bağlandı.
  2. `SettingsModal.tsx` içindeki Gelişmiş Depolama & Yedekleme bölümüne `[⚠️ Tüm Anki Geçmişini Sıfırla]` butonu (CustomDialog çift onaylı) entegre edildi.
  3. `fileSystem.ts` ve `App.tsx` genelinde ZIP dışa/içe aktarma, JSON okuma, IndexedDB ve GitHub Senkronizasyonu süreçlerine `ensureAnkiCardDates` süzgeci entegre edilerek `Date` nesnelerinin FSRS uyumluluğu mühürlendi.
- **Test Rehberi:** Toplu sıfırlama, iki aşamalı güvenlik onayı ve yedekleme mekanizmasının kusursuz çalıştığını teyit etme.
> 📌 **Kullanıcı Test Notu:** Aşama bittiğinde kullanıcıya toplu sıfırlamayı iki aşamalı dialog ile test etme, yedekleme (ZIP / GitHub) sonrası verinin eksiksiz geri yüklendiğini doğrulama adımlarını içeren son test rehberi sunulacaktır.

---

### 📍 Aşama 6: Yatay Ek Resimlerin Kırpılmadan Sığdırılması & Blur Kutuları Konumlandırması [EN SON BAKILACAK - KULLANICIYA HATIRLATILACAK]
- **Durum:** Kullanıcı talimatı ile beklemeye alındı. Diğer iyileştirmeler bittikten sonra en son bu maddeye dönülecek ve kullanıcı sorduğunda hatırlatılacak.
- **Ele Alınacak Maddeler:**
  1. `AnkiEditorModal`: Yatay ek resimlerin (16:9 vb.) zorla dikey 2:3 en-boy oranına hapsedilip sağdan-soldan kırpılmasını önlemek; kapsayıcının görselin gerçek doğal en-boy oranına dinamik uymasını sağlamak.
  2. Blur kutularının (`AnkiBlurBox`) resmin tam pikselleri üzerine % olarak kusursuz oturmasını temin etmek.
  3. `AnkiStudyModal`: Kart çalışma ekranının ön yüzünde yatay ek sahnelerin kırpılmadan `object-contain` ve sinematik bulanık arka planla şık bir şekilde sunulması ve blur kutularının soru aşamasında tam doğru konumda sansür uygulaması.

