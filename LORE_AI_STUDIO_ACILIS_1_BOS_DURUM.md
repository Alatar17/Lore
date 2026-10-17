# LORE — Açılış İyileştirmesi 1: "Yapım bulunamadı" Yazısı

**Tarih:** 17 Ekim 2026
**Muhatap:** AI Studio'da kodu yazan AI
**Bağlam:** Kaydırma ve rozet optimizasyonları tamamlandı, kullanıcı memnun. Telefonda (Redmi Note 13, Chrome PWA) ekran kaydıyla ölçülen açılış: ~2,5 sn klaket/açılış ekranı → ~0,8 sn "Bu filtreye veya kategoriye uyan yapım bulunamadı" yazısı → ~0,3 sn siyah kartlar → afişler.

Bu talimatta **tek iş** var. Service Worker bu turun konusu değil, ona dokunma (`main.tsx` ve `public/sw.js` aynen kalsın).

## Genel kırmızı çizgiler
1. Veri, yedek, ZIP, GitHub senkronizasyonu, afiş/rozet küçük kopya sistemi değişmez.
2. UI tasarımı değişmez, yeni metin/buton/ayar eklenmez.

---

## Yapılacak iş: Yükleme sırasında "yapım bulunamadı" yazısını gösterme

**Sorun:** `isDataLoaded` false iken `appData.items` henüz boş olduğu için ana grid (`App.tsx` ~2495, `id="empty-items-state"`) "Bu filtreye veya kategoriye uyan yapım bulunamadı" kutusunu ve "+ Yeni Yapım Ekle" butonunu gösteriyor. Veri gelince kayboluyor. Kullanıcıya hata gibi görünüyor.

**Yapılacak:**
- `isDataLoaded` false iken boş durum kutusunu **render etme**; aynı alanı boş bırak (aynı yükseklikte boş bir `div` yeterli, spinner/yeni metin ekleme).
- `TrackedView` ve kütüphane grid'inin olduğu diğer görünümlerde (tier list vb.) aynı "boş liste" metni yükleme sırasında görünüyorsa aynı kuralı uygula.
- `isDataLoaded` true olduktan sonra liste gerçekten boşsa kutu **eskisi gibi** görünür. Bu davranış değişmemeli.

**Doğrulama:** Açılışta yazı hiç görünmüyor; filtre sonucu gerçekten boşken yazı görünüyor.

## Teslimde raporla
Değişen dosyalar, her değişikliğin tek satırlık özeti, UI'a hiçbir şey eklenmediğinin teyidi.
