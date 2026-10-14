# LORE AI ASİSTAN - ÖNERİ TEKRARI VE KÜTÜPHANE ÇAKIŞMASI
## Kapsamlı Teşhis, Alternatiflerin Analizi ve Nihai Çözüm Rehberi

> **Doküman Notu:** Bu rehber, kullanıcının kütüphanesinde zaten var olan bir yapımın (Örn: *Balatro*) yapay zeka tarafından komik bir gerekçeyle (*"Balatro'yu sevdiğin için Balatro'yu önerdim"*) tekrar öneri kartı olarak sunulması vakasını, arka plandaki yazılım açıklarını, farklı çözüm önerilerini ve sistemi yormayan en temiz tamir yolunu açıklar.  
> **Kural:** Bu dokümanda hiçbir kod çalıştırılmamıştır; yalnızca mimari analiz ve strateji belirlenmiştir.

---

## 1. NE OLDU? (OLAYIN ÖZETİ)

Kullanıcı, kütüphanesinde zaten kayıtlı olan, oynayıp bitirdiği ve yüksek puan verdiği **Balatro** oyununu Lore AI Asistan'dan yeni bir öneri kartı olarak aldı. Üstelik asistan kartın açıklamasında *"Balatro'yu çok sevdiğin için bunu önerdim"* diyerek kütüphaneyi gördüğünü itiraf etti ama yeni bir oyun bulmak yerine kullanıcının elindeki oyunu tekrar kullanıcıya önerdi.

---

## 2. KODLARIN RÖNTGENİ: SORUN NEREDE ÇIKTI?

Kodlar satır satır incelendiğinde bu sorunun tek bir nedenden değil, **birbirini tetikleyen 3 farklı boşluktan** kaynaklandığı görülmüştür:

### 🔍 1. Boşluk: "Kişisel Kütüphane" ile "Öneri Hafızası" Aynı Şey Değil!
* Sistemde **Öneri Hafızası (`recommendationMemory.ts`)** adında çok güçlü bir 500'lük arşiv, radar ve kara liste mekanizması var.
* **Fakat:** Bu hafıza **yalnızca yapay zekanın sohbet esnasında ürettiği kartları** kaydeder.
* Kullanıcı Balatro'yu veya başka bir filmi kütüphanesine **kendi eliyle** eklediğinde, o yapım hiçbir zaman "Öneri Hafızası"na girmez.
* Yapay zekaya her mesajda giden *"Daha önce önerilen ve asla tekrar edilmeyecekler"* listesinin içinde kullanıcının kendi kütüphanesindeki yapımlar **yoktur**. Dolayısıyla yapay zeka Balatro'yu yasaklı listede görememiştir.

### 🔍 2. Boşluk: Bekleme Listesi Korunmuş, Zirve Yapımlar Savunmasız Kalmış!
* Sistem yönergelerinde (`aiTasteProfile.ts` & `geminiAi.ts`):
  * **Bekleme Listesi (Oynanacaklar/İzlenecekler)** için devasa alarmlar ve sert kurallar vardır:  
    *`⚠️ TEKRAR ÖNERİ YASAĞI: Bu yapımlar zaten kütüphanede kayıtlıdır. Asla yeni öneri olarak sunma!`*
  * Ancak **"En Çok Beğenilen Zirve Yapımlar (9-10 Puan)"** başlığının altına Balatro yazılmış, fakat altına *"Bu yapımlar kullanıcının elindedir, bunları asla yeni kart olarak üretme"* uyarısı konulmamıştır.
* Yapay zeka Balatro ismini görünce bir anlık odak kayması yaşamış; zevk pusulası alması gereken yapımı doğrudan öneri kartının başlığına yapıştırmıştır.

### 🔍 3. Boşluk: Kod Seviyesinde Son Kontrol (Bekçi) Yok!
* Yapay zeka yanıtı üretip kartları döndürdüğünde, sistem kartın adını alır ve doğrudan ekrana basar.
* Karttaki ismin kullanıcının mevcut kütüphanesinde kayıtlı olup olmadığını denetleyen bir kod filtresi bulunmamaktadır.

### 🔍 4. Yan Tespit: Kitap Eşleştirmesindeki Kod Pürüzü (`recommendationMemory.ts:122`)
* Yapılan kod taramasında diğer yapay zekanın da doğru yakaladığı bir detay doğrulanmıştır: Yeni kartlar hafızaya kaydedilirken `it.mainTab === (card.mainTab === 'game' ? 'game' : 'media')` yazılmıştır. 
* Yani kitaplar (`book`), karşılaştırılırken `media` sayılmaktadır. Bu da ileride kitap önerilerinde mükerrer kayıtlara yol açabilecek küçük bir kod pürüzüdür; tamir sırasında düzeltilmelidir.

---

## 3. TARTIŞILAN ÇÖZÜMLER VE DEĞERLENDİRMELER

Masaya gelen çözüm yolları ve kullanıcının haklı refleksleri:

### ❌ 1. Yol: Kartı Sessizce Çöpe Atmak (Sonradan Filtreleme)
* **Fikir:** Yapay zeka Balatro kartı üretirse, kod bunu fark edip kartı arayüzden sessizce silsin.
* **Kullanıcının Haklı İtirazı ve Kesin Kararı:** *"Kullanıcı 2 film öner derse ve 1 tanesi kodla silinirse ekranda 1 kart kalır, eksik öneri olur ve kafa karışıklığı yaratır. Yapay zekaya derdimizi en baştan doğru anlatalım; binde bir hata yapıp yine kütüphaneden bir şey önerirse de kart sessizce silinmesin, olduğu gibi dursun. Önemli olan yapay zekayı en başta doğru yönlendirmektir."*
* **Karar:** **KESİNLİKLE REDDEDİLDİ.** Kartlara arayüzde silme müdahalesi yapılmayacaktır.

### ❌ 2. Yol (Diğer AI'ın Önerisi): Arkadan Gizlice İkinci İstek Atmak
* **Fikir:** Eğer yapay zeka kütüphanedeki bir oyunu önerirse ekrana basma; hemen arkadan yapay zekaya ikinci bir istek yolla: *"Balatro zaten var, onun yerine bana 1 tane temiz kart ver"* desin.
* **Kullanıcının Haklı İtirazı:** *"Olmaz, sistem takılır, sürekli API'ye istek atar!"*
* **Neden Kesinlikle Yanlış?**
  1. **Gecikme (Latency):** Gemini bir cevabı 4-7 saniyede verir. İkinci istek atılırsa kullanıcı ekranda 15 saniye bekler.
  2. **Kota ve Takılma Riski:** Arka arkaya istek atmak mobilde bağlantıyı koparabilir, Google'ın istek kotasına (429 Rate Limit) takılabilir.
  3. **Yine Hata Yapabilir:** İkinci istekte yapay zekanın yine kütüphaneden bir şey önermeyeceğinin garantisi yoktur (üçüncü istek mi atılacak?).
* **Karar:** **Reddedildi.** Sistemi hantallaştıran ve kullanıcı deneyimini bozan verimsiz bir yöntemdir.

---

## 4. EN SAĞLIKLI VE TEMİZ ÇÖZÜM: "ÖNLEYİCİ KALKAN" MİMARİSİ

Yangın çıktıktan sonra arkasından koşmak veya kart silmek yerine, yapay zekayı en baştan doğru eğiten 4 adımlı formül:

### 🛡️ Adım 1: Kütüphanedeki Tüm Yapımları da "Yasaklılar Listesi"ne Katmak (Önleyici Tıp)
* Yapay zekaya soru gönderilirken hazırlanan dışlama listesine sadece eski AI kartları değil; **kullanıcının kendi kütüphanesindeki tüm yapımların başlıkları** da eklenir.
* **Kapsanan Tüm Statüler (Medya, Oyun, Kitap):**
  1. **Tamamlananlar** (Bitirilmiş tüm film, dizi, anime, oyun ve kitaplar)
  2. **Şu An Devam Edenler** (*İzleniyor*, *Oynanıyor*, *Okunuyor*)
  3. **Sırada Bekleyenler / Backlog** (*İzlenecek*, *Oynanacak*, *Okunacak*)
  4. **Yarım Bırakılanlar** (*Yarım Bırakıldı / Dropped*)
  5. **Takip Edilenler** (*Takipte / Gelecek sezonu beklenenler*)
* **Sonuç:** Yapay zeka daha ilk saniyede Balatro'nun kırmızı çizgili olduğunu bilir. Ne sohbet metninde Balatro'yu yeni bir öneri gibi anlatır, ne de Balatro kartı üretir.
* **Avantajı:** İkinci istek atılmaz, bekleme süresi uzamaz, kota harcanmaz, arayüzden kart silinmez. İlk seferde doğrudan temiz ve yeni yapımlar gelir.

### 🛡️ Adım 2: Zirve Yapımlar ve Favoriler Başlığına Sıkı Talimat Eklemek
* `formatTasteProfileForPrompt` içindeki `[EN ÇOK BEĞENİLEN ZİRVE BAŞYAPITLAR]` ve `[GÜÇLÜ FAVORİLER]` başlıklarına şu net kural eklenir:  
  *`"DİKKAT: Bu yapımlar kullanıcının zaten tüketip bitirdiği eserlerdir. Bu yapımları sadece bir pusula ve referans olarak kullan; bu isimlerin hiçbirini asla yeni bir öneri kartı olarak üretme!"`*

### 🛡️ Adım 3: Soğuk "Zevk Profili" İfadelerini Kaldırmak ve Doğal Dille Köprü Kurmak
* "Zevk profili" gibi Türkçe'de yapay ve soğuk duran çeviri kokulu terimler kaldırılır.
* Yapay zekaya sohbet metninde kesin sayılar vermesi (*"Senin için 3 yapım seçtim"* vb.) yerine; doğal ve asil bir köprü kurması talimatı verilir:  
  *`"Kütüphanendeki arşive ve beğenilerine göre seçtiğim önerileri aşağıya kartlar halinde bıraktım:"`*  
* Böylece metin ile kartlar her zaman %100 uyum içinde kalır.

### 🛡️ Adım 4: Kitap Tür Eşleşmesi Düzeltmesi
* `recommendationMemory.ts` içindeki `book` tür ayrımı düzeltilerek hafızanın gelecekte tutarsızlaşması önlenir.

---

## 5. `AI Algoritma/` KLASÖRÜNDEKİ DİĞER DOSYALARIN İNCELEMESİ

Klasörde bulunan mevcut dökümanlar incelenmiş ve durumları değerlendirilmiştir:

| Dosya Adı | Durum | İşimize Yarıyor mu? Ne Yapılmalı? |
| :--- | :--- | :--- |
| **`konu_derinligi.tsx`** | ✅ **Çok Değerli / Aktif** | Yapay zekanın büründüğü "Anlatı Küratörü" rolünü, kapalı karttaki 1-2 cümlelik kancayı ve açık karttaki 3 paragraflık derin atmosfer kurallarını belirler. Şu an `geminiAi.ts` içinde harfiyen uygulanmaktadır. Aynen korunmalıdır. |
| **`öneri.tsx`** | ✅ **Çok Değerli / Aktif** | Kart rozetlerini (*Kütüphane İmzası, Farklı Bir Tat, Sıradışı Keşif*), veri ağırlık piramidini ve en önemlisi **1 Puan Kuralı**nı (1 puanın kötü puan değil, izleniyor/oynanıyor anlamına geldiğini) tanımlar. Sistemde aktiftir, korunmalıdır. |
| **`Öneri hafızası.tsx`** | ✅ **Çok Değerli / Aktif** | Radar, Kara Liste ve 500 kapasiteli Öneri Arşivi'nin (FIFO silme mantığı) temel anayasasıdır. Şu an `recommendationMemory.ts` bu şartnameye göre kusursuz çalışmaktadır. |
| **`lore_ai_asistan_tamir_ve_gelistirme_plani.md`** | 📋 **Tarihi Plan Günlüğü** | Daha önce yapılan tamirlerin (Lucy & Shapez 2 bekleme listesi kalkanı, puansız yapımlar, etiket sızıntısı temizliği) kayıt defteridir. Yeni oluşturduğumuz bu dosya onun kaldığı yerden öneri tekrarı konusunu tamamlamaktadır. |

---

## 6. ÖZET VE SONUÇ

Sorunun kaynağı yapay zekanın kötülüğü değil; yapay zekaya gönderilen **"Asla Önerme" kara listesinde kullanıcının kendi kütüphanesinin bulunmamasıdır.** 

Çözüm yapay zekanın arkasından koşturup 2. isteklerle sistemi kasmak değil; **kütüphaneyi en baştan yapay zekanın eline "yasaklılar" olarak vermektir.** Kodlama aşamasına geçilmek istendiğinde uygulanacak en pürüzsüz ve sağlam rota budur.
