# LORE — Kart Küçük Resimleri: Nihai Uygulama Talimatı

**Tarih:** 15 Ekim 2026
**Muhatap:** AI Studio'da kodu yazan AI
**Referanslar:** `LORE_MOBIL_AKICILIK_ANA_PLAN.md`, `LORE_AI_STUDIO_DOGRULANMIS_DATA.md`, `LORE_AI_STUDIO_MUTABAKAT_VE_UYGULAMA_REHBERI.md`

Bu belge, o üç belgede varılan mutabakatın **son hali**dir. Çelişki olursa bu belge geçerlidir.

---

## 1. Amaç

Redmi Note 13'te kütüphane kaydırması akıcı olsun ve sekme geçişinde / açılışta siyah kartlar kısalsın diye, **yalnızca grid kartları** afişin küçük (400 px) bir kopyasını göstersin. Başka hiçbir şeyi iyileştirmeye çalışma.

## 2. Kırmızı çizgiler (ihlal edilirse iş başarısız sayılır)

1. Mevcut afişler, veri, JSON dosyası ve kullanıcının 114 yapımı olduğu gibi kalır. Kullanıcı hiçbir afişi yeniden import etmeyecek.
2. **UI görsel olarak birebir aynı kalır.** Renk, yerleşim, animasyon, boşluk değişmez. **Yeni metin, sayaç, ilerleme göstergesi, diyalog veya buton eklenmez.**
3. **Büyük görünüm aynı kalır:** `ImagePreviewModal` (flip kart), `ItemDetailModal`, tier list, dışa aktarma orijinal `item.thumbnail`'i kullanmaya devam eder. Bu bileşenlere dokunma.
4. Küçük kopya yoksa veya inmediyse kart bugünkü gibi orijinali gösterir. Kırık resim veya başlık/degrade yer tutucusu çıkmaz.
5. Yerel disk klasörüne (`dirHandle`) yeni klasör/dosya **yazma**.
6. `loading="lazy"` ve diğer kart stillerini değiştirme.
7. Bu turda yapma: rozet efekti, dock blur, memo, sanallaştırma, on-demand orijinal indirme, karakter resimleri, Service Worker.

## 3. Temel kurallar

- **Adlandırma:** küçük kopyanın yolu = `images/posters-small/` + (orijinal dosya adının uzantısız hali) + `.webp`. Orijinal `.jpg`/`.png` olsa bile küçük kopya her zaman `.webp` uzantılıdır. JSON'a yeni alan eklenmez, yol her zaman `thumbnailFileName`'den türetilir.
- **Boyut:** en fazla 400×600, WebP, kalite 0.85, mevcut `optimizeImageFile` ile. Bu fonksiyon Blob değil **data URL metni** döndürür. GitHub'a yüklemek için ham base64 kısmı yeterli; IndexedDB'ye yazmak için Blob'a çevir.
- **`cardThumbnail`:** `ArchiveItem`'a eklenen, **yalnızca çalışma zamanında** state'te duran isteğe bağlı alan (küçük afişin data URL'i). Hiçbir kalıcı veriye veya dışarı giden veriye girmez (Bölüm 4.2).
- **Kalıcılık:** küçük kopyalar IndexedDB `image_cache`'te Blob olarak, **tam yol anahtarıyla** (`posters-small/<ad>.webp`) saklanır.
- **Küçük kopya aranırken** `bareName` yedeği, kök `images/` klasörü yedeği ve `raw.githubusercontent.com` URL yedeği **kullanılmaz**. Bulunamazsa sonuç boş kalır ve `cardThumbnail` ayarlanmaz. `resolveGitHubImage`'in mevcut davranışı diğer görseller için aynen kalmalı (ayrı bir küçük-resim fonksiyonu yazmak en güvenlisi).

## 4. Yapılacaklar (bu sırayla)

### 4.1 `src/types.ts`
`ArchiveItem` içine `cardThumbnail?: string` ekle.

### 4.2 `cardThumbnail`'i tüm dışarı giden ve kalıcı veriden ayıkla
`thumbnail`'in ayıklandığı veya taşındığı **her yerde** `cardThumbnail`'i de ayıkla. En az şunlar:
- `githubSync.ts` `pushDataToGitHub` içindeki `cleanItems` (`delete copy.thumbnail` yanına). GitHub'daki JSON büyümemeli.
- `fileSystem.ts` `saveDataToLocalStorage` içindeki hafif kopya.
- `saveDataToIndexedDB` ile yazılan öğe kaydı (küçükler zaten `image_cache`'te durur, öğe kaydına gerek yok).
- `downloadJsonFile` (yedek JSON) ve `writeDataToFolder`.
- `fileSystem.ts` ~758: `JSON.stringify(dataToWrite, ...)` ile dosyaya yazılan veri.
- `fileSystem.ts` ~1964: `JSON.stringify(data)` ile HTML dışa aktarımına gömülen veri. Burada ayıklanmazsa dışa aktarılan HTML megabaytlar şişer.
- Not: `saveDataToIndexedDB(data)` bugün tüm `data` nesnesini olduğu gibi yazıyor; `cardThumbnail` orada da ayıklanmalı (açılışta küçükler zaten `image_cache`'ten doldurulur, Bölüm 4.5).
- `fileSystem.ts` içinde `.thumbnail` geçen diğer yerleri (~23) tara; dışarı yazan veya serialize eden her yere uygula.

### 4.3 PC: küçük kopyaları üret ve GitHub'a yükle (`pushDataToGitHub`)
- `checkDirs` listesine `'posters-small'` ekle (yoksa her push'ta yeniden yüklemeye çalışır).
- Orijinal afişlerin mevcut yükleme akışına **dokunma**. Onun ardından: `thumbnailFileName`'i olan her yapım için türetilmiş küçük yol GitHub listesinde yoksa:
  1. Orijinali mevcut kaynak sırasıyla bul: bellekteki base64 haritası → `imagesDir` dosyası → `image_cache` Blob'u. Hiçbiri yoksa o yapımı sessizce atla.
  2. 400×600 WebP üret ve `images/posters-small/<ad>.webp` yoluna PUT et.
- **Güvenlik:** PUT'lar arasında en az ~100 ms bekle; 403 veya 409'da birkaç denemelik geri çekilmeli yeniden deneme yap; başarı ve başarısız sayısını tut.
- **UI'a HİÇBİR ŞEY EKLEME.** İlerleme metni, sayaç, çubuk, yeni mesaj, yeni diyalog yok. PC'deki mevcut `pcSyncStatus` göstergesi zaten işlem boyunca `syncing` durumunda kalıyor (`App.tsx` ~315-320); ilk senkronizasyon uzun süreceği için yeni bir şey göstermeye gerek yok. İlerleme ve hata bilgisi yalnızca `console` çıktısına yazılır.
- **Başarısız küçükler sessizce tolere edilir:** yüklenemeyen küçük kopya ana senkronizasyonu bozmamalı, hata diyaloğu açmamalı ve JSON commit'ini engellememeli. Bir sonraki senkronizasyonda eksik olanlar zaten otomatik tamamlanır (GitHub listesinde yoksa yeniden denenir). Bu arada o yapımın kartı orijinali gösterir.
- İlk push'ta ~114 dosya yüklenecek (her biri ayrı commit), ikinci push'ta hiçbiri yüklenmemeli.

### 4.4 Mobil: küçük kopyaları indir
- Yeni bir arka plan adımı ekle (`syncImagesForItems`'a benzer): küçük kopyası olmayan her yapım için önce `image_cache`'te tam yol anahtarıyla ara; yoksa GitHub'dan tam yolla indir (404 ise atla, hata sayma).
- İndirileni `image_cache`'e Blob olarak kaydet.
- **State güncellemesini toplu yap:** sonuçları bir yerde biriktirip tek (en fazla 2-3) `setAppData` ile uygula, tek `debouncedSaveData`. Her resim için ayrı `setAppData` yapma.
- Çağrı sırası: küçükler **önce**, orijinallerin arka plan indirmesi (`syncImagesForItems`) onlardan sonra. Orijinallerin indirme ve state akışı bugünkü gibi kalır. İki çağrı yeri de güncellenmeli (`App.tsx` ~416 ve ~503).

### 4.5 Açılış hydrate sırası (`App.tsx` ~721 ve ~730)
Şu an ilk çizim, tüm orijinallerin okunup base64'e çevrilmesini bekliyor. Yeni sıra:
1. `image_cache`'ten küçükleri okuyup `cardThumbnail`'e doldur (hızlı), bununla `setAppData` yap (ilk çizim).
2. Sonra orijinalleri bugünkü gibi hydrate et ve state'e ekle. Bu adım `cardThumbnail`'i **ezmemeli**, mevcut alanları korumalı.
Hem IndexedDB yolunda hem localStorage yedek yolunda uygula.

### 4.6 Pull birleştirmesi (`App.tsx` ~357-405)
- Birleştirme `...remoteItem` ile yeni öğe kuruyor. `thumbnailFileName` yerel ile aynıysa yereldeki `cardThumbnail`'i koru.
- Dosya adı değiştiyse veya silindiyse: eski küçük kopyanın `image_cache` kaydını ve bellek önbelleğini, orijinalde yapılan mantıkla birlikte temizle (`deleteCachedImageBlob` yalnızca `images/` önekini kırpar; küçük anahtar `posters-small/...` biçiminde verilmeli).
- Uygulamada bir afiş değiştirilir/silinirse mevcut orijinal temizleme kodunun yanına küçüğün temizliğini de ekle.

### 4.7 `ItemCard.tsx` (yalnızca 3 yer)
Kartta `item.thumbnail`'in kontrol olarak kullanıldığı **üç yer** var: zemin rengi koşulu, "resim mi başlık mı" koşulu ve `<img src>`. Üçünde de `item.cardThumbnail || item.thumbnail` kullan. Başka hiçbir JSX, sınıf veya stile dokunma. (Yalnızca `src` değiştirilirse, açılışta `thumbnail` henüz boşken kart başlık/degrade gösterir ve plan çalışmaz.)

Grid benzeri başka bileşenler `item.thumbnail` gösteriyorsa (örn. son aktiviteler, tier list), **bu turda değiştirme**; yalnızca `ItemCard`.

## 5. Teslim ve doğrulama

Kodlamadan önce: bu belgedeki bir varsayım kodla çelişiyorsa **dur ve bildir**, tahminle devam etme.
Kodlamadan sonra şunu raporla (UI'da hiçbir görsel/metin değişikliği yapılmadığını da açıkça teyit et): değişen dosyalar, her değişikliğin tek satırlık özeti, bu belgede yapılmayan/uyarlanan madde (varsa nedeniyle).

Başarı ölçütleri:
1. PC'de ilk senkronizasyonda GitHub'da `images/posters-small/` altında 114 dosya oluşur; ikinci basışta yeni yükleme yok.
2. `yapim-arsivim-data.json` boyutu eskisinden büyümez.
3. Telefonda senkronizasyondan sonra kartlar küçük kopyayı gösterir; uygulamayı kapat-aç ve tekrar senkronizasyon yapınca da (pull birleştirmesi küçükleri silmez).
4. Açılışta kartlar orijinaller yüklenmeden görünür.
5. Kartı açınca büyük afiş ve flip eskisi kadar net; karakter, detay, tier list, dışa aktarma değişmemiş.
6. Küçük kopyası GitHub'da olmayan yapımda kart orijinali gösterir, kırık resim yok.
7. Yedek JSON ve `localStorage` boyutu makul.

## 6. Bilinen ve kabul edilen sınır
Açılışta orijinaller henüz hydrate edilmeden bir karta tıklanırsa önizlemede afiş birkaç saniye eksik olabilir. Bu turda modallara dokunulmadığı için kabul edilmiştir.

## 7. Kullanıcının test sırası (bilgi için)
1. AI Studio'da değişiklikten önce mevcut sürümü Versions'ta kaydet.
2. Kodlama biter → GitHub'a push → telefondaki PWA'yı yeni sürümle güncelle.
3. **Önce PC'de** senkronizasyon (ilk seferde birkaç dakika sürebilir, ekranda yeni bir şey görünmez, mevcut gönderiliyor göstergesi döner; işlem bitene kadar sekmeyi kapatma), GitHub'da `posters-small` klasörünü kontrol et.
4. Sonra telefonda senkronizasyon; ekran kaydıyla Medya ↔ Oyun geçişini ve kaydırmayı eski kayıtla karşılaştır.
5. Rozet parlaması testi ayrıca (ayarlardan kapat/aç).
