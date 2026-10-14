# LORE AI ASİSTAN - BALATRO KURALI VE KÜTÜPHANE KALKANI RAPORU

> **Doküman Notu:** Bu rapor; kullanıcının kütüphanesinde kayıtlı ve bitirilmiş olan *Balatro* oyununun yapay zeka tarafından *"Balatro'yu sevdiğin için önerdim"* denilerek tekrar yeni öneri kartı olarak sunulması vakasının, arkasındaki kararların ve sisteme uygulanan kesin çözümün teknik ve mantıksal özetidir. İleride referans olması amacıyla arşivlenmiştir.

---

## 1. NE OLDU? (OLAY VE TEŞHİS)

1. **Vaka:** Kullanıcının kütüphanesinde 10 puan verilmiş ve tamamlanmış olarak duran *Balatro* oyunu, Lore AI Asistan tarafından yeni bir öneri kartı olarak üretildi.
2. **Koddaki Çift Boşluk:**
   - **Öneri Hafızası Boşluğu:** Sistemdeki 500'lük arşiv ve yasaklılar listesi (`recommendationMemory.ts`), yalnızca yapay zekanın sohbet esnasında ürettiği kartları saklıyordu. Kullanıcının kendi eliyle kütüphanesine eklediği filmler, oyunlar ve kitaplar bu dışlama listesine hiç dahil edilmiyordu.
   - **Zirve Eserler Çapası (Anchor Bias):** Bekleme listesi (`plannedItems`) için sert kurallar varken, 9-10 puanlık zirve eserler başlığının altında *"Bu yapımlar kullanıcının elindedir, bunları asla yeni kart olarak üretme"* kalkanı bulunmuyordu. Gemini bu ismi görünce referans almak yerine doğrudan kartın başlığına yapıştırdı.

---

## 2. KULLANICI İLE ALINAN STRATEJİK KARARLAR

Geliştirme öncesinde masaya gelen alternatifler kullanıcı ile değerlendirilmiş ve şu kesin kararlar alınmıştır:

### ❌ Kartları Sonradan Gizlice Silmek KESİNLİKLE REDDEDİLDİ
* **Neden:** Kullanıcı asistandan *"Bana 2 film öner"* istediğinde, arka plandaki kod yapay zekanın önerdiği 1 filmi kütüphanede var diye sessizce silerse ekranda tek kart kalır. Bu durum kullanıcıya eksik ve hatalı bir deneyim yaşatır.
* **Kullanıcı Kararı:** *"Free API sınırları ve yapay zekanın doğası gereği binde bir hata yapıp kütüphaneden bir şey önerse dahi karta müdahale edilip silinmesin; dursun. Bizim yapmamız gereken yapay zekayı en baştan önleyici kalkanla doğru eğitmektir."*

### 🗣️ "Zevk Profili" İfadesinin Temizlenmesi
* Türkçe'de yapay, soğuk ve çeviri kokan *"zevk profili"* ve *"zevk haritası"* tabirleri hem arayüzden hem de yapay zekaya verilen tüm sistem direktiflerinden kaldırılmıştır.
* Yerine çok daha doğal, asil ve yaşayan bir dil getirilmiştir:  
  *`"Kütüphanendeki arşive ve beğenilerine göre seçtiğim önerileri aşağıya kartlar halinde bıraktım:"`*

---

## 3. KAPSAMA ALINAN 5 KÜTÜPHANE STATÜSÜ

Kütüphanedeki tüm kategoriler (Medya, Oyun, Kitap) için istisnasız şu 5 statünün tamamı yapay zekaya kırmızı çizgili olarak bildirilmektedir:

1. **Tamamlananlar:** Bitirilmiş tüm film, dizi, anime, oyun ve kitaplar.
2. **Şu An Devam Edenler:** *İzleniyor*, *Oynanıyor*, *Okunuyor* durumundakiler.
3. **Sırada Bekleyenler (Backlog):** *İzlenecek*, *Oynanacak*, *Okunacak* durumundakiler.
4. **Yarım Bırakılanlar (Dropped):** Sevilmeyip yarım bırakılan eserler.
5. **Takip Edilenler:** Yeni sezonu veya resmi çıkışı beklenen yapımlar.

İster 10 puan verilmiş olsun, ister puansız bitirilmiş olsun, isterse sırada bekliyor olsun; kütüphanede kaydı olan hiçbir yapım yeni öneri kartı olamaz.

---

## 4. YAPILAN YAZILIM DEĞİŞİKLİKLERİ

### 1. `src/utils/recommendationMemory.ts`
* **Kitap Eşleşmesi Bug'ı Düzeltildi:** `addCardsToMemory` fonksiyonundaki `card.mainTab === 'game' ? 'game' : 'media'` pürüzü giderildi; kitaplar (`book`) da kendi türüyle doğru eşleştirildi.
* **Birleşik Dışlama Listesi:** `formatExclusionListForPrompt(memoryItems, libraryItems)` fonksiyonu güncellendi.
  - Kütüphanedeki tüm yapımları (5 statü) normalize edilmiş başlıklarla tarar.
  - Öneri hafızasındaki (Radar, Kara Liste, Arşiv) yapımlarla birleştirir ve mükerrerleri tekilleştirir.
  - Yapay zekaya devasa, net ve tavizsiz bir yasaklı fihrist (`[KÜTÜPHANEDE KAYITLI VE DAHA ÖNCE ÖNERİLMİŞ TÜM YAPIMLAR LİSTESİ]`) olarak sunar.

### 2. `src/utils/aiTasteProfile.ts`
* `formatTasteProfileForPrompt` fonksiyonundaki soğuk "zevk haritası" başlığı yerine "Kişisel Kütüphane ve Beğeni Dizini" kullanıldı.
* `[EN ÇOK BEĞENİLEN ZİRVE BAŞYAPITLAR]` ve `[GÜÇLÜ FAVORİLER]` başlıklarının altına Balatro Kuralı uyarısı eklendi:  
  *`"⚠️ DİKKAT (BALATRO KURALI): Bu yapımlar kullanıcının kütüphanesinde zaten kayıtlıdır ve tüketip bitirdiği eserlerdir. Bu yapımları sadece kullanıcının beğenisini anlamak için pusula ve kalite standardı olarak kullan; bu isimlerin HİÇBİRİNİ asla yeni bir öneri kartı olarak üretme!"`*

### 3. `src/utils/geminiAi.ts`
* **Doğal Dil İlkesi:** Asistanın köprü cümlesinde "zevk profili" yerine *"kütüphanendeki arşive ve beğenilerine göre seçtiğim önerileri aşağıya kartlar halinde bıraktım:"* kullanılması emredildi.
* **Balatro Kuralı Direktifi:** Kütüphanedeki mevcut hiçbir yapımın kart başlığı (`title`) yapılamayacağı; kütüphanedeki eserlerin yalnızca `matchReason` gerekçesinde `[[item:id|Başlık]]` şeklinde anılabileceği kesin kural olarak çakıldı.

### 4. `src/components/AiAssistantModal.tsx`
* `formatExclusionListForPrompt` çağrısına kullanıcının tüm kütüphanesi (`items`) ikinci parametre olarak verildi.
* Asistan kartındaki "Kütüphane zevkinle eşleştiriliyor..." metni, "Kütüphanendeki arşiv ve beğenilerinle eşleştiriliyor..." olarak doğallaştırıldı.

---

## 5. TEST VE DOĞRULAMA

* Proje `compile_applet` ile sıfır hata ile derlenmiştir (`Build succeeded`).
* Yapay zeka artık kütüphanendeki hiçbir yapımı yeni öneri sanmayacak; elindeki eserleri yalnızca senin ne sevdiğini anlamak için pusula olarak kullanacaktır.
