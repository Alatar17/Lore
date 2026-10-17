# LORE — Rozet Gölgesini Resme Pişirme: Uygulama Talimatı (2. Tur)

**Tarih:** 17 Ekim 2026
**Muhatap:** AI Studio'da kodu yazan AI
**Bağlam:** 1. tur (128 px bellek içi rozet kopyası + telefonda gizli balon) tamamlandı ve çalışıyor. Kullanıcı testi: "Özel rozetli yapımları göster" kapalıyken uygulama çok akıcı, açıkken gayet akıcı ama hafif bir yük hissediliyor. Kalan yükün en olası kaynağı, kart üzerindeki her rozete CSS ile **canlı** uygulanan 3-5 katlı `drop-shadow` zinciri.

## 1. Amaç (tek cümle)
Telefonda kart üzerindeki rozetlerin gölgesini/parıltısını CSS ile her çizimde hesaplamak yerine, 128 px kopya üretilirken **bir kereye mahsus resmin içine çiz** ve kartta CSS `filter` kullanma.

## 2. Kırmızı çizgiler
1. Kullanıcının import ettiği **512 px orijinal rozet (`iconData`) değişmez**, yeniden kaydedilmez. Rozet import akışı ve `optimizeBadgeIcon(..., 512)` çağrıları aynen kalır.
2. **Vitrin (`BadgeSpotlightModal`), detay sayfası, `ItemDetailModal`, `ImagePreviewModal`, ayarlar ekranı** değişmez, orijinali ve mevcut CSS'i kullanır.
3. **PC (640 px ve üzeri, `sm` ve üstü) birebir aynı kalır:** mevcut CSS `filter` zinciri orada aynen çalışır. Pişirme yalnızca telefon genişliğinde (640 px altı) uygulanır.
4. Rozetin kart üzerindeki **boyutu, konumu, ölçeği (`badge.scale`), hover/aktif animasyonları** değişmez. Rozet ikonunun kendisi bir piksel bile büyümemeli veya kaymamalı.
5. Pişirilmiş resim **hiçbir kalıcı veriye** (appData, customBadges, localStorage, IndexedDB, GitHub, JSON, ZIP, HTML dışa aktarım) yazılmaz. 1. turdaki gibi yalnızca bellekte (`badgeCache.ts`) yaşar.
6. Yeni UI öğesi, metin, buton, ayar yok.
7. Pişirme yapılamazsa (destek yok, hata, henüz hazır değil) kart **bugünkü davranışa** döner: 128 px kopya veya orijinal + mevcut CSS `filter`. Kırık veya gölgesiz rozet görünmemeli.

## 3. Mevcut durum (kodda doğrulandı)
`ItemCard.tsx` içindeki `ItemCardBadge`, rozet `<img>`'ine şu `filter`'ı uyguluyor (renk = `colorOpt.hex`):
- Parıltı açık, normal: `drop-shadow(0 0 1.5px rgba(0,0,0,0.98)) drop-shadow(0 0 3px rgba(0,0,0,0.85)) drop-shadow(0 0 6px HEX) drop-shadow(0 2px 5px rgba(0,0,0,0.85))`
- Parıltı açık, aktif (`isMobileActive`): 5 katlı zincir (9px ve 20px renkli parlama dahil)
- Parıltı kapalı: `drop-shadow(0 0 1.5px rgba(0,0,0,0.98)) drop-shadow(0 0 3px rgba(0,0,0,0.85)) drop-shadow(0 2px 5px rgba(0,0,0,0.85))`

Bu değerler **CSS pikseli** cinsinden ve telefonda 26×26 px'lik kutu için tasarlanmış.

## 4. Yapılacaklar

### 4.1 `badgeCache.ts`: pişirilmiş varyant üretimi
- Yeni fonksiyon: belirli bir rozet + `glowEnabled` (true/false) + renk (`hex`) için pişirilmiş PNG data URL üretir.
- Yöntem: canvas 2D `ctx.filter` ile **birebir aynı `drop-shadow` zincirini** uygulayarak rozeti çiz.
  - Ölçek faktörü: `k = çizimBoyutu / 26`. Rozet canvas'a `26 * k` boyutunda çizilir (128 px kopya kullanılabilir, k ≈ 4.92). Zincirdeki **tüm px değerleri (bulanıklık yarıçapı ve kaydırmalar) `k` ile çarpılır.**
  - **Taşma payı:** gölgeler rozet kutusunun dışına taşıyor. Canvas her kenardan `pad = 12 * k` piksel geniş olsun (canvas boyutu `(26 + 24) * k`), rozet ortaya çizilsin. Taşan gölge kesilmemeli.
- `ctx.filter` desteğini çalışma anında kontrol et (Android Chrome destekler). Desteklenmiyorsa bu varyantı üretme, mevcut davranışa dön.
- Önbellek anahtarı: mevcut anahtar + `glow` durumu + `hex`. Parıltı açılıp kapanınca veya rozet rengi değişince doğru varyant kullanılmalı; ikisi de tembel üretilsin (gerektiğinde), mevcut sıralı/boşta çalışan kuyruk kullanılsın.
- `useBadgeCardIcon` benzeri bir hook pişirilmiş varyantı da döndürebilsin (örn. `useBakedBadgeIcon(badge, glowEnabled, hex)`), hazır olunca yalnızca ilgili rozeti yeniden çizsin.

### 4.2 `ItemCardBadge`: yalnızca telefonda pişirilmiş resmi göster
- Telefon genişliği (640 px altı) **ve** pişirilmiş varyant hazır **ve** `isMobileActive` false ise:
  - Pişirilmiş resmi göster, **`filter` uygulama** (`filter: none` / undefined).
  - Pişirilmiş resim payla birlikte büyük olduğu için, rozet ikonu aynı yerde ve aynı boyutta kalacak şekilde konumlandır: 26 px kutunun içinde `position:absolute`, her kenardan `-12px` taşan (`inset: -12px`, yani 50×50 CSS px) bir `<img>`. `badge.scale` dönüşümü aynen uygulanır (pişirilmiş resim üzerinde).
  - Tıklama alanı, `id`, `onClick`, sınıflar, aktif/hover animasyonları aynı kalır. Taşan img `pointer-events: none` olsun ki dokunma alanı büyümesin.
- Diğer tüm durumlarda (PC, aktif rozet, varyant hazır değil, destek yok) bugünkü kod aynen çalışır.
- Telefon genişliği kontrolünü her render'da `window.innerWidth` okuyarak değil, tek bir `matchMedia('(max-width: 639px)')` aboneliğiyle yap.

## 5. Bu turda yapılmayacaklar
Vitrin/detay değişikliği, rozet import değişikliği, 512 px orijinale dokunmak, PC görünümü, puan/yıl rozetleri, açılış performansı, sanallaştırma, memo.

## 6. Doğrulama (teslimde raporla)
1. Telefonda aynı kartın önce/sonra ekran görüntüsü: rozet ikonu aynı yerde ve aynı boyutta, gölge ve parıltı **gözle ayırt edilemeyecek kadar** benzer. Parıltı açık ve kapalı için ayrı ayrı.
2. PC'de rozetler birebir aynı (eski CSS filter çalışıyor).
3. Rozete dokununca vitrin açılıyor, 512 px orijinal net.
4. Parıltı anahtarı açılıp kapanınca kartlar doğru varyanta geçiyor.
5. Rozet rengi değiştirilince kart doğru renkte pişirilmiş varyantı gösteriyor.
6. JSON, ZIP, localStorage, IndexedDB, GitHub verisinde pişirilmiş resim yok.
7. Dokunma alanı büyümemiş, yandaki puan rozetine yanlışlıkla dokunulmuyor.
8. TypeScript ve build hatasız. UI'a hiçbir şey eklenmedi.

## 7. Kullanıcının test sırası (bilgi için)
1. Versions'ta mevcut sürümü kaydet.
2. Kodlamadan **önce** telefonda rozetli birkaç kartın ekran görüntüsünü al (parıltı açık ve kapalı).
3. Kodlama → push → telefonda uygulamayı tamamen kapat-aç.
4. Aynı kartların ekran görüntüsünü al, yan yana karşılaştır. Beğenmezsen Versions'tan geri dön.
5. Rozetler açıkken kaydırma ve Medya ↔ Oyun geçişini dene.
