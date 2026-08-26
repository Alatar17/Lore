# Kart Ekleme Kuralları (Medya & Oyun)

Bu dosya, kullanıcı yeni bir medya veya oyun kartı eklenmesini istediğinde uyulması gereken **kesin ve net** kuralları içerir.

---

## 1. MEDYA KARTLARI KURALLARI (Film, Anime, Dizi vb.)

Medya kartları eklenirken **SADECE** şu alanlar doldurulur ve kurallara uyulur:

1. **Başlık (`title`)**: Eserin adı.
2. **Açıklama (`desc`)**: Eserin konusunu doğru ve net anlatan açıklama.
3. **Etiketler (`genre`, `firm`, `director`, `actors`)**:
   - **KESİNLİKLE YAPILMAYACAK:** `Oyuncu Adı (Karakter Adı)` şeklinde parantezli/karakterli etiket YAZILMAZ (Örn: `"Mamoru Miyano (Rintarou Okabe)"` YASAKTIR. Sadece `"Mamoru Miyano"` yazılır).
   - **Gereksiz etiket eklenmez.** Sadece genel kabul görmüş, filtrelenebilir ve tekrar kullanılabilir temiz etiketler eklenir.
4. **Tarih (`date`)**:
   - Kullanıcı özel bir tarih belirtmişse o yazılır.
   - Belirtilmemişse **HER ZAMAN `2026-08-01`** (01.08.2026) olarak girilir.
5. **Puan (`rating`)**:
   - **HER ZAMAN `1`** puan verilir.
6. **Kategori / Alt Kategori (`cat`, `sub`)**:
   - Kategori ve sub kategori YOKTUR (`cat: ""`, `sub: null`).
7. **Durum Bilgileri (`watching`, `following`, `dropped`)**:
   - Durumlara DOKUNULMAZ. Varsayılan olarak hepsi `false` kalır (`watching: false`, `following: false`, `dropped: false`).
8. **Diğer Alanlar**:
   - `id`: `film_<slug>` veya `anime_<slug>`
   - `mainTab`: `"media"`
   - `thumbnail`: `""`
   - `anki`: `false`

### Medya JSON Örneği:
```json
{
  "id": "film_ornek",
  "mainTab": "media",
  "cat": "",
  "sub": null,
  "title": "Eserin Başlığı",
  "rating": 1,
  "date": "2026-08-01",
  "desc": "Eserin konusunu doğru anlatan net Türkçe açıklama.",
  "watching": false,
  "following": false,
  "dropped": false,
  "anki": false,
  "thumbnail": "",
  "firm": ["Stüdyo Adı"],
  "director": ["Yönetmen Adı"],
  "actors": ["Oyuncu 1", "Oyuncu 2"],
  "genre": ["Tür 1", "Tür 2"]
}
```

---

## 2. OYUN KARTLARI KURALLARI

Oyun kartları eklenirken **SADECE** şu alanlar doldurulur ve kurallara uyulur:

1. **Başlık (`title`)**: Oyunun adı.
2. **Açıklama (`desc`)**: Oyunun konusunu ve mekaniğini doğru anlatan açıklama.
3. **Etiketler (`genre`, `developer`)**:
   - Gereksiz etiket yazılmaz, temiz ve tekrar kullanılabilir tür/geliştirici etiketleri eklenir.
4. **Puan (`rating`)**:
   - **HER ZAMAN `1`** puan verilir.
5. **Tarih (`date`)**:
   - Kullanıcı özel bir tarih belirtmişse o yazılır.
   - Belirtilmemişse **HER ZAMAN `2026-08-01`** (01.08.2026) olarak girilir.
6. **Kategori / Alt Kategori (`cat`, `sub`)**:
   - Kategori ve sub kategori YOKTUR (`cat: ""`, `sub: null`).
7. **Oyun Durumu (`status`)**:
   - **HER ZAMAN `"Tamamlandı"`** (Oynandı) olarak ayarlanır.
8. **Diğer Alanlar**:
   - Diğer alanlara dokunulmaz.
   - `id`: `game_<slug>`
   - `mainTab`: `"game"`
   - `thumbnail`: `""`
   - `anki`: `false`

### Oyun JSON Örneği:
```json
{
  "id": "game_ornek",
  "mainTab": "game",
  "cat": "",
  "sub": null,
  "title": "Oyunun Başlığı",
  "rating": 1,
  "date": "2026-08-01",
  "status": "Tamamlandı",
  "desc": "Oyunun atmosferini ve türünü doğru anlatan net Türkçe açıklama.",
  "thumbnail": "",
  "developer": ["Geliştirici Stüdyo"],
  "genre": ["Tür 1", "Tür 2"],
  "anki": false
}
```
