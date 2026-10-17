# LORE — Rozet Performansı: Uygulama Talimatı (1. Tur)

**Tarih:** 17 Ekim 2026
**Muhatap:** AI Studio'da kodu yazan AI
**Bağlam:** Afiş küçük kopyaları tamamlandı. Mobil akıcılık için sıradaki iş rozetler. Bu belge yalnızca **1. turu** kapsar: görsel hiçbir şeyi değiştirmeyen iki düzeltme.

---

## 1. Rozetler kullanıcı için neden özel (okumadan başlama)

Rozetler kullanıcının özenle tasarladığı sanat eserleridir. Bir yapıma rozet takılır (örn. "En iyi anime"), kartın sağ üstünde görünür, detay sayfasında görünür, tıklayınca vitrinde 512 px olarak incelenir. Kullanıcı bunlara bakmaktan keyif alıyor, bu yüzden 512 px import ediliyor. **Rozetlerin görünüşü, kalitesi ve vitrini bozulmamalı.**

## 2. Kırmızı çizgiler

1. **512 px orijinal rozet verisi (`iconData`) hiçbir şekilde değişmez, küçültülmez, üzerine yazılmaz.** İçe aktarmadaki `optimizeBadgeIcon(..., 512)` çağrıları olduğu gibi kalır.
2. **Rozet vitrini (`BadgeSpotlightModal`), kart detay sayfası, `ItemDetailModal`, `ImagePreviewModal` ve rozet ayar ekranı orijinal `iconData`'yı kullanmaya devam eder.** Bu bileşenlere dokunma.
3. **Rozetlerin kart üzerindeki görünüşü birebir aynı kalır:** gölge zinciri (`drop-shadow`), renkli parıltı, boyut (26/37 px), konum, ölçek (`badge.scale`), hover/aktif animasyonları değişmez. **Bu turda `filter` değerlerine dokunma.**
4. **Yeni UI öğesi, metin, buton, ayar, diyalog yok.**
5. **Küçük rozet kopyası hiçbir kalıcı veriye veya dışarı giden veriye girmez:** `appData`, `customBadges` nesneleri, localStorage, IndexedDB öğe kaydı, GitHub JSON, yedek JSON, ZIP, HTML dışa aktarım, `writeDataToFolder`. Yalnızca çalışma zamanında bellekte yaşar. (Önceki turda `cardThumbnail` için aynı sızıntı riski vardı, bu sefer baştan engelle.)
6. Küçük kopya üretilemezse veya henüz hazır değilse kart bugünkü gibi orijinal `iconData`'yı gösterir. Kırık resim olmaz.
7. Afiş küçük kopya sistemine ve GitHub senkronizasyonuna dokunma.

## 3. Doğrulanmış bulgular (kodla kontrol edildi)

- Rozetler `optimizeBadgeIcon(..., 512)` ile 512 px PNG (alfa kanallı) olarak data URL halinde saklanıyor ve state'te `badge.iconData` olarak duruyor. Mobilde GitHub'dan gelen `images/badges/...` yolları `hydrateBadgesFromCache` ile data URL'e çevriliyor.
- Kartta rozet **26 px** (PC'de 37 px) gösteriliyor, ama her rozet `<img>` öğesinin `src`'si 512 px'lik yüzbinlerce karakterlik data URL. Her kartın her rozeti bu metni tekrar tekrar taşıyor ve tarayıcı 512 px'lik resmi çözüp küçültüyor.
- `ItemCard.tsx` ~392: her rozetin yanında bir ipucu balonu (tooltip) DOM'da duruyor ve üzerinde `backdrop-blur-xl` var (`sm:` öneki yok, telefonda da aktif). Kartın diğer rozetlerinde blur `sm:` önekli, bu tek istisna.
- Ana ekran ve TrackedView'da `onBadgeClick` veriliyor (`App.tsx` ~2308 ve TrackedView üzerinden). Bu durumda telefonda rozete dokunmak **doğrudan vitrini açıyor**, `handleBadgeClick` tooltip'i hiç etkinleştirmiyor. Yani telefonda balon fiilen hiç görünmüyor, ama DOM'da ve blur'la duruyor.
- Veri (kullanıcı gözlemi, kesin değil): rozetleri tamamen gizlemek kasmayı çok azaltıyor. Parıltı ve gölgeyi kapatmanın etkisi belirsiz (testler tutarsız). Parıltı anahtarına basınca uygulama hafif kasıyor (tüm kartlar yeniden çiziliyor, tüm rozet filtreleri yeniden boyanıyor), bu filtrelerin maliyetli olabileceğini gösteren destekleyici bir ipucu ama kanıt değil. Gölge optimizasyonu bu turun konusu değil, Bölüm 6'ya bak.

## 4. Yapılacaklar

### 4.1 Telefonda gizli ipucu balonunu hafiflet (`ItemCard.tsx`)
- Balonun dış sarmalayıcısını telefon genişliğinde (640 px altı, yani `sm` altında) **gösterme**; ekranda **yalnızca `isMobileActive` iken** göster. Çözüm CSS ile yapılabilir: sarmalayıcının sınıfına koşullu olarak `hidden sm:block` ekle, `isMobileActive` true ise `block` kullan. 640 px ve üzerinde (PC/tablet) davranış **birebir aynı** kalır.
- Balonun içindeki `backdrop-blur-xl`'i `sm:backdrop-blur-xl` yap. Zemin `bg-[#0d111a]/95` olduğu için telefonda görünüm farkı gözle ayırt edilemez.
- Balonun `boxShadow`, `border`, metin ve ok işareti aynen kalır.

### 4.2 Kart için küçük rozet ikonu (128 px, yalnızca bellekte)
- **Boyut: 128 px** (daha önce düşünülen 96 değil). Gerekçe: Redmi Note 13'te 26 px'lik alan yaklaşık 70 fiziksel piksel tutuyor, `badge.scale` > 1 ve aktif durumdaki `scale-115` ile 100+ piksele çıkabilir. 128 px her durumda keskin kalır, yine de orijinalin (512 px) 16'da biri piksel sayısıdır.
- Üretim: mevcut `optimizeBadgeIcon(iconData, 128)` fonksiyonunu kullan. Oran korunur, büyütme yapmaz, alfa kanalını korur (PNG). Üretilen sonucun şeffaflığını doğrula.
- **Depolama:** `appData`'ya, `customBadges` nesnelerine, state'e **yazma**; `setAppData` çağırma. Modül düzeyinde küçük bir önbellek (örn. `Map`) + abonelik mekanizması kullan. Anahtar: `badge.id` + `iconData` uzunluğu + `iconData`'nın başından/sonundan kısa bir parça (ikon değiştirilirse önbellek geçersiz olsun).
- **Hook:** `useBadgeCardIcon(badge)` benzeri bir yapı (`useSyncExternalStore` veya `useState`+`useEffect` aboneliği) küçük ikon hazır olduğunda yalnızca o rozeti gösteren kartları yeniden çizsin. Tüm kartları yeniden çizdiren bir güncelleme olmasın.
- **Üretim zamanlaması:** rozetler hydrate edildikten sonra, **sırayla ve ana iş parçacığını kilitlemeden** (her rozet ayrı, `requestIdleCallback` veya `setTimeout` ile aralıklı) üret. Hazır olana kadar `src` orijinal `iconData`. Hazır olunca `src` küçük kopya.
- `ItemCard`'da yalnızca rozet `<img>`'inin `src`'si küçük ikona geçer: `küçükIkon || badge.iconData`. Rozetin başka hiçbir özelliğine (className, style, transform, filter, onError, loading) dokunma. Mevcut koşul (`iconData` boş değil, `images/`/`badges/` ile başlamıyor) aynen kalır.
- PC'de de kart rozeti (37 px) küçük ikonu kullanabilir, 128 px orada da yeterli. Hata veya üretim başarısızlığında orijinale dön.

## 5. Bu turda yapılmayacaklar
`drop-shadow` zinciri ve parıltı, `transition-all` temizliği, `React.memo`, mobil dock blur, sanallaştırma, vitrin/detay değişiklikleri, rozet içe aktarma boyutu, GitHub'da rozet küçük kopyası, kalıcı küçük rozet depolama.

## 6. Sonraki tur (kullanıcı onayı ve ölçümden sonra, şimdi yapma)
Gölge zincirini hafifletme: **yalnızca ölçümle gerekçelenirse** ve kullanıcı yan yana önce/sonra görsele bakıp onaylarsa. Kullanıcının "belirgin olsun diye eklediği" gölgeler rozetlerin okunaklılığı için önemli, bu tur görünüşü değiştirme riski alınmıyor.

## 7. Doğrulama listesi (teslimde raporla)
1. Telefonda ve PC'de kart üzerindeki rozetler görsel olarak **birebir aynı** (gölge, parıltı, boyut, konum). Karşılaştırmak için önce/sonra ekran görüntüsü al.
2. Telefonda rozete dokununca vitrin açılıyor, **512 px orijinal net** görünüyor.
3. Kart detay sayfasındaki rozetler ve vitrin orijinali kullanıyor.
4. PC'de rozetin üzerine gelince ipucu balonu eskisi gibi çıkıyor.
5. Telefonda balon DOM'da `display:none` (veya yok), tooltip aktifken (`onBadgeClick` olmayan bir bağlam varsa) yine görünüyor.
6. Yedek JSON, **ZIP içindeki JSON**, GitHub'daki `yapim-arsivim-data.json`, localStorage kaydı: küçük rozet verisi **yok**, boyutlar değişmedi.
7. Rozet ikonu değiştirilince kart küçük ikonu da güncelleniyor (eski önbellek kullanılmıyor).
8. Küçük ikon üretilemezse kart orijinali gösteriyor.
9. Konsolda yeni hata yok. UI'a hiçbir görsel/metin/buton eklenmedi (teyit et).

## 8. Kullanıcının test protokolü (bilgi için, objektif ölçüm)
Telefonda ekran kaydı alınıp analiz edilecek (atlanan kareler, geçişte resimlerin tam gelme süresi). Her sürümde **aynı hareket**, her biri ~10 sn:
1. Medya sekmesi, kütüphane en üstte → yavaş yavaş aşağı kaydır (~5 sn) → hızlı fling (1-2 kez).
2. Medya → Oyun → Medya sekme geçişini art arda 3 kez.
Karşılaştırılacak sürümler: önceki sürüm / bu tur sonrası. Rozet ayarı: açık, parıltı açık; ayrıca bir kayıt parıltı kapalı.
