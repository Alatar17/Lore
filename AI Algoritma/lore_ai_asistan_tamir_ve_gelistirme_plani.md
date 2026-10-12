# LORE AI ASİSTAN - KAPSAMLI TEŞHİS, TAMİR VE GELİŞTİRME PLANI

> **Doküman Amacı:** Bu doküman; Lore AI Asistan'ın zevk motoru, kütüphane veri filtreleri, bekleme listesi koruma kalkanı, puansız yapımlar, prompt yönergeleri ve arayüz etkileşiminde tespit edilen tüm açıkların nihai çözüm planıdır. Kodlama aşamasına geçildiğinde doğrudan bu plana göre hareket edilecektir.

---

## 1. BAŞLIK VE ARAYÜZ METNİ DÜZENLEMESİ

### 🔍 Teşhis
* `src/components/AiAssistantModal.tsx` modal başlığının altındaki mevcut metin:
  * *Eski:* `"Zevk profili ve kütüphane hafızası aktif"` (soğuk ve yapay duruyor).

### 🛠️ Çözüm
* Kullanıcının onayladığı asil ve net ifadeyle değiştirilecek:
  * **Yeni Metin:** `"Kişisel arşiv ve öneri hafızası aktif"`

---

## 2. TÜKETİLMEMİŞ İÇERİKLER: ÇİFT TARAFLI KORUMA KALKANI (LUCY VE SHAPEZ 2 KURALI)

### 🔍 Teşhis ve Kod Analizi
1. **Durum:** Kullanıcı bir filmi izlemediyse (*İzlenecek*), bir oyunu oynamadıysa (*Oynanacak*) veya bir kitabı okumadıysa (*Okunacak*), bu yapımlar sadece kullanıcının bekleme listesindedir (backlog).
2. **Koddaki Çift Yönlü Açık (`src/utils/aiTasteProfile.ts`):**
   * Kodda `isPlannedItem()` kontrolü olmasına rağmen, yapay zekaya veri hazırlayan `aiTasteProfile.ts` bunu **hiç çağırmamaktadır**.
   * Henüz izlenmemiş veya oynanmamış bir yapıma kütüphanede bir puan, Tier satırı veya tür atanmışsa; kod bunu bitmiş başyapıt sanıp `topMasterpieces` listesine eklemekte ve türlerini/yönetmenlerini en sevilenler arasına katmaktadır.
   * **Kitap Açığı:** Kitap sekmesi sonradan eklendiği için, `aiTasteProfile.ts` içinde `Okunacak` / `toRead` durumu hiç taranmamaktadır (`getBookStatus()` çağrılmamaktadır).
3. **Kritik Mantık Kuralı (Lucy Örneği):**
   * *Tehlike 1:* Yapay zeka henüz izlenmemiş Lucy filmine bakarak *"Sen Lucy'yi çok sevmişsin, şunu izle"* diyemez (zevk analizi kirlenmemeli).
   * *Tehlike 2:* Yapay zeka kullanıcıya yeni film ararken dönüp *"Sana Lucy filmini öneriyorum"* da diyemez (çünkü zaten kütüphanede var, sırada bekliyor).

### 🛠️ Çözüm: 2 Ayrı Liste Mimarisi
Yapay zekaya kütüphane verisi giderken kesin bir çizgiyle ikiye ayrılacak:

1. **A. Gerçek Zevk Arşivi (Tüketilenler / Bitirilenler):**
   * Sadece gerçekten izlenen, oynanan ve okunan yapımlar yer alacak.
   * Favori türler, favori yönetmenler ve S-Tier başyapıtlar **yalnızca bu listeye bakılarak** hesaplanacak.
   * Bekleme listesindeki hiçbir yapım bu hesaplamaya ve "Son Bitirilenler" (kronolojik tarih) listesine 1 gram bile karışmayacak (kartta önceden kalma eski bir tarih olsa dahi `!isPlannedItem` şartıyla kesinlikle elenecek).

2. **B. Sırada Bekleyenler (İzlenecek / Oynanacak / Okunacak):**
   * Yapay zekaya ayrı bir blok olarak iletilecek:  
     `[KÜTÜPHANEDE SIRADA BEKLEYENLER (İzlenecek / Oynanacak / Okunacak)]`
   * Ve bu bloğun başına yapay zeka için **2 Kırılmaz Kural** çakılacak:
     * **Kural 1 (Zevk Yasağı):** *"Bu yapımlar kullanıcının bekleme listesindedir; henüz izlenmedi, oynanmadı veya okunmadı. Kullanıcının zevkini bunlara bakarak analiz etme ve 'bunu çok sevdiğin için' gibi referanslar verme!"*
     * **Kural 2 (Tekrar Öneri Yasağı):** *"Bu yapımlar zaten kütüphanede kayıtlıdır. Bu yapımların hiçbirini kullanıcıya YENİ BİR ÖNERİ olarak ASLA sunma!"*

---

## 3. PUANSIZ YAPIMLAR (UNRATED) VE DURUM YÖNETİMİ

### 🔍 Teşhis ve Kod Analizi
1. **Kullanıcının Puan Vermeme Özelliği:**
   * Kullanıcı kütüphanede bir yapımı bitirdiğinde, sağdaki butona basarak o yapıma puan vermemeyi (puansız bırakmayı) seçebilmektedir.
2. **Koddaki Büyük Kör Nokta (`src/utils/aiTasteProfile.ts`):**
   * Mevcut kodda tür, yönetmen ve geliştirici ağırlıkları hesaplanırken `if (it.rating >= 6)` şartı aranmaktadır!
   * **Bunun Anlamı:** Kullanıcı bir animeyi, oyunu veya kitabı bayılarak bitirmiş olsa bile, eğer puan vermemeyi seçtiyse (`rating === 0`), kod onun türünü, yönetmenini ve yazarını **HİÇ SAYMAMAKTA (Sıfır kabul etmekte)**!
3. **Şu An Devam Edenler (`İzleniyor`, `Oynanıyor`, `Okunuyor`):**
   * Kullanıcının güncel odak noktasıdır.
   * Kütüphanede kayıtlı oldukları için yeni öneri olarak tekrar önerilemezler.
4. **Yarım Bırakılanlar (`Yarım Bırakıldı` - Dropped):**
   * Kullanıcının negatif pusulasıdır. Neden yarıda bırakıldığı (tempo düşüklüğü, sıkıcılık vb.) yeni önerilerde negatif filtre olarak kullanılır; asla tekrar önerilmez.

### 🛠️ Çözüm
1. Tamamlanan ama puan verilmemiş yapımlar:
   * **KESİNLİKLE ESERE 1 PUAN VERİLMEYECEK!** Eser yine senin bıraktığın gibi **"Puansız"** kalacaktır.
   * Bahsedilen şey eserin puanı DEĞİL, **arka plandaki izlenme/deneyim çetelesidir**: 
     Örneğin bir Guy Ritchie filmini puansız bitirdiysen, sistem Guy Ritchie'nin çetelesine *"bu yönetmenden 1 film tüketildi"* diyerek +1 sayaç ekler. Böylece o yönetmen sanki hiç izlenmemiş gibi sıfırlanmaz. Çok sevip 9-10 puan verdiğin yönetmenlere ise çetede +2 sayaç verilir. Eserin kendi puanına asla dokunulmaz.
   * Asla "beğenilmedi / düşük puan" kategorisine sokulmayacak (nötr/pozitif kabul edilecek).
2. Prompt'a net kılavuz eklenecek:
   > *"Kullanıcı bazı tamamladığı yapımlara puan vermeyebilir (Puan: Belirtilmedi). Puanın olmaması eserin sevilmediği anlamına gelmez; eserin türü ve dünyası kullanıcının ilgi alanına dahildir."*

---

## 4. HAM KOD SIZINTISININ ÇİFT TARAFLI ÖNLENMESİ (`[[item:id|Başlık]]`)

### 🔍 Teşhis
* İkinci ekran görüntüsünde açık kartın "Konu & Atmosfer" metninde `[[item:game_shapez_2|Shapez 2]]` şeklinde ham etiket görünmüştür.
* **Yapay Zeka Tarafı:** Kütüphane bağlama damgasını Konu metnine sızdırmıştır.
* **Arayüz Tarafı:** `AiAssistantModal.tsx` içindeki `<p>{card.detailedDesc}</p>` alanı düz metin bastığı için kodu olduğu gibi ekrana yansıtmıştır.

### 🛠️ Çözüm
1. **Prompt Kuralı Sertleştirmesi (`src/utils/geminiAi.ts`):**
   > *"detailedDesc (Konu & Atmosfer) alanında kütüphanedeki diğer yapımlardan bahsetmek ve `[[item:...]]` damgası kullanmak KESİNLİKLE YASAKTIR. Bu damga YALNIZCA matchReason (Tavsiye Gerekçesi) alanına aittir. Konu metni yalnızca eserin kendi dünyasını ve karakterini anlatır."*
2. **Arayüz Emniyet Kemeri (`src/components/AiAssistantModal.tsx`):**
   * Kartın detaylı konusu (`card.detailedDesc`) ekrana basılırken olası bir AI sızıntısına karşı etiket temizleyici filtreden (`stripLibraryItemTags`) geçirilecek; kullanıcı ekranda asla ham kod görmeyecek.

---

## 5. ROBOTİK GEREKÇE DİLİ VE KONU METNİNDEKİ BOŞ ÖVGÜLER

### 🔍 Teşhis
* Tavsiye gerekçelerinde sürekli: *"Looper'a verdiğin yüksek puana dayanarak..."* şablonu tekrarlanmaktadır.
* Konu metninde hikaye yerine: *"tıkır tıkır çalışan bir saat mekanizması gibi"* diyerek eleştirmen övgüleri yapılmaktadır.

### 🛠️ Çözüm
1. **Gerekçe Kılavuzu:** Prompt'a doğrudan karşılaştırmalı **❌ Kötü Örnek** ve **✅ İyi Örnek** yerleştirilecek.
2. **Konu 3. Paragraf Kuralı:** Eleştirmen yorumu ve övgü kesin olarak yasaklanacak; yalnızca eserin izleyicide/oyuncuda bıraktığı atmosferik ve psikolojik iz anlatılacak.

---

## 6. BEKLEMEDEKİ YAPIMLARIN TIER LIST'TEN GİZLENMESİ ✅ [TAMAMLANDI]

### 🔍 Teşhis
* `src/components/TierListView.tsx` içinde kategorideki tüm yapımlar listelenmekteydi.
* Henüz izlenmemiş, oynanmamış veya okunmamış bir yapımın sıralama/derecelendirme tablosunda (Tier List) yer alması eşyanın tabiatına aykırıdır.

### 🛠️ Çözüm (Uygulandı)
* `TierListView.tsx` içindeki `catItems` filtresine `isPlannedItem(it)` şartı eklendi.
* Artık `İzlenecek`, `Oynanacak` ve `Okunacak` durumundaki hiçbir yapım ne Tier List satırlarında ne de alttaki yerleştirilmemiş havuzda görünmeyecek; kullanıcı eseri tamamlayıp tükettiğinde otomatik olarak Tier List'e dahil olacaktır.

---

## 7. ÖNERİ HAFIZASI SEKME FİLTRESİNİN KALDIRILMASI (FREE GUY TEKRAR ENGELİ) ✅ [TAMAMLANDI]

### 🔍 Teşhis
* `formatExclusionListForPrompt` fonksiyonu `activeTab` ile filtreleniyordu.
* Kullanıcı "Oyun" veya "Kitap" sekmesindeyken asistanı açıp film önerisi istediğinde, hafızadaki tüm filmler (örn. Free Guy) yapay zekaya giden listeden eleniyor ve Gemini filmleri hiç önerilmemiş sanarak tekrar öneriyordu.

### 🛠️ Çözüm (Uygulandı)
* `src/utils/recommendationMemory.ts` içindeki `formatExclusionListForPrompt` fonksiyonundan `activeTab` kısıtı tamamen kaldırıldı.
* Kullanıcı hangi sekmede olursa olsun, hafızadaki tüm yapımlar (filmler, oyunlar, animeler, kitaplar) eksiksiz olarak Gemini'ye hariç tutma listesi olarak gönderilir.

---

## 8. ÇALIŞMA YOL HARİTASI VE DURUM ÖZETİ

* 🚀 **1. Aşama:** Asistan Motoru, Bekleme Listesi Koruma Kalkanı ve Zevk Profili Tamiri -> **TAMAMLANDI**
* 🎯 **2. Aşama:** Öneri Hafızası Sekme Filtresinin Kaldırılması (Global Hafıza Kalkanı) -> **TAMAMLANDI**
* 📊 **3. Aşama:** Beklemedeki Yapımların Tier List'ten Gizlenmesi (`TierListView.tsx`) -> **TAMAMLANDI**
* 🧪 **4. Aşama:** Canlı Test ve Doğrulama aşamasına geçilmiştir.
