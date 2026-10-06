# Anki "Kartlar" Penceresi Tasarım Dokümanı

## 1. Amaç ve Giriş Noktası
- **Adı:** **Kartlar** (Sade ve doğrudan).
- **Açılış Şekli (Bağımsız Pencere / Modal):**
  - Anki Hub modalının sağ üst araç çubuğunda (`[X]` kapatma ikonu ve `[🔄]` tümünü sıfırla ikonunun hemen solunda) şık bir **`[Kartlar]`** butonu yer alır.
  - Bu butona basıldığında doğrudan **"Kartlar" penceresi (modalı)** açılır.
  - Kullanıcı işini bitirdiğinde sağ üstteki **`[X]`** butonuyla pencereyi kapatır.
  - Pencerede genel bir "Kaydet" butonuna ihtiyaç yoktur; her işlem anında veya kendi modalı içinde kaydedilir.

---

## 2. "Kartlar" Penceresi Arayüzü & Mimarisi

### A. Üst Araç Çubuğu (Header Bar)
- **Sol:** Başlık ve sayaç: **Kartlar** `(48)`
- **Orta/Sağ:** 
  - Canlı Arama Kutusu: `[ 🔍 Kart veya etiket ara... (✕) ]` (Tek tıkla aramayı sıfırlayan `✕` temizleme butonu ile)
  - Kategori Filtresi (Ana Sayfa Mimarisi): Ana sayfadaki gibi `[ Tümü ]`, `[ Medya ▾ ]`, `[ Oyun ▾ ]`, `[ Kitap ▾ ]` menüleri yer alır. Tıklandığında ana sayfadaki gibi o sekmenin tüm kategorilerini ve alt gruplarını listeleyen tanıdık menü açılır; derinlemesine veya genel filtreleme yapılabilir.
- **En Sağ:** `[✕]` Pencereyi Kapat butonu

### B. Ana İçerik: 2 Sütunlu Ferah Düzen (Master-Detail)

```text
+-----------------------------------------------------------------------------------------------------------------+
|  Kartlar (48)      [ 🔍 Kart veya etiket ara... (✕) ]      [ Tümü ] [ Medya ▾ ] [ Oyun ▾ ] [ Kitap ▾ ]     [✕]  |
+-------------------------------------------------------+---------------------------------------------------------+
|  KART LİSTESİ (A'dan Z'ye)                             |  SEÇİLİ KART ÖNİZLEMESİ                                 |
|                                                       |                                                         |
|  [🖼️] Attack on Titan                  Anime          |  +-----------------------------------+                  |
|  [🖼️] Bleach                           Anime          |  | [👁️ Blur'u Göster/Kaldır (Space)]|                  |
|  [🖼️] Cowboy Bebop                     Anime          |  |      [ AFİŞ + BLUR KUTULARI ]     |                  |
| >[🖼️] Death Note                       Anime < (Seçili)|  |                                   |                  |
|  [🖼️] Elden Ring                       RPG            |  +-----------------------------------+                  |
|  [🖼️] Ghost in the Shell               Film           |                                                         |
|  [🖼️] Interstellar                     Film           |  Death Note                                             |
|  [🖼️] Monster                          Anime          |  Kategori: Medya > Anime                                |
|  [🖼️] Steins;Gate                      Anime          |  Etiketler: Gizem, Psikolojik                           |
|  [🖼️] The Witcher 3                    RPG            |                                                         |
|  ...                                                  |  [ ✏️ Kartı Düzenle ] [ 👁️ Yapım Detayı ]                |
|                                                       |  [ 🔄 Başa Sar ]     [ 🗑️ Anki'den Çıkar]                |
+-------------------------------------------------------+---------------------------------------------------------+
```

---

## 3. Bileşen Detayları

### 1. Sol Sütun: Kart Listesi
- **Sıralama:** A'dan Z'ye alfabetik (Türkçe karakter duyarlı).
- **İlk Açılış:** Listenin en başındaki ilk kart otomatik seçili gelir.
- **Satır Tasarımı:**
  - Solda 24×32px minik poster görseli.
  - Eser / Kart Adı.
  - Sağda silik renkte ait olduğu kategori (`Anime`, `Film`, `RPG` vb.).
- **Seçim & Gezinme:**
  - Tıklanan satır aktif mavi/gri tonla vurgulanır.
  - **Klavye Yön Tuşları Desteği (↑ / ↓):** Klavyedeki yukarı/aşağı ok tuşlarıyla listede hızla kayılarak önizleme canlı değiştirilebilir. Arama kutusundayken `↓` (Aşağı ok) tuşuna basıldığında odak doğrudan listedeki ilk karta geçer, kullanıcı elini klavyeden kaldırmadan aramadan listeye geçebilir.

### 2. Sağ Sütun: Kart Önizlemesi & Butonlar
- **Görsel Alanı:** 
  - Kartın posteri ve üzerine kayıtlı olan blur kutuları canlı gösterilir.
  - **[👁️] Blur'u Göster/Gizle Butonu:** Afişin köşesindeki bu butona basılarak veya klavyeden **[ Space ] (Boşluk)** tuşuna basılarak editörü açmaya gerek kalmadan blur'un altındaki kapak geçici olarak açılıp kapatılabilir.
  - *(Not: Space kısayolu gizli/doğal olarak çalışır; K menüsüne veya Ayarlar'daki kısayol listelerine eklenmez. Kullanıcı arama kutusuna yazı yazarken kelime boşluğu bırakabilmesi için Space dinleyicisi yalnızca odak bir input/yazı alanında DEĞİLKEN tetiklenir).*
- **Künye Bilgisi:**
  - Başlık, kategori yolu (`Medya > Anime`), varsa ön yüz etiketleri (`ankiFrontTags`).
- **4 Aksiyon Butonu:**
  1. **[ ✏️ Anki Editörü Aç ]:** Doğrudan mevcut `AnkiEditorModal`'ı açar (arkada gereksiz bir yapım detay penceresi açık kalmaz). Kullanıcı blur kutularını veya ek resimleri düzenleyip **[✓ Uygula ve Kapat]** butonuna bastığında, değişiklikler anında o karta doğrudan kaydedilir (normaldeki gibi ayrıca yapım detay penceresine gidip tekrar Kaydet demeye gerek kalmaz). **[Vazgeç]** veya **[✕]** dendiğinde ise hiçbir değişiklik yapılmadan editör kapatılır.
  2. **[ 👁️ Kartı Düzenle ]:** Arşivdeki normal kart detay penceresini (`ItemDetailModal`) açar (Hollow Knight resminde görünen puan, süre, konu, türler ve sağ üstündeki kalemle düzenleme yapılan ana detay penceresi).
  3. **[ 🔄 Kartı Sıfırla ]:**
     - Tıklandığında güvenlik onayı sorar:
       *"Bu kartın çalışma ve tekrar geçmişi sıfırlanacaktır. Görsel ve blur ayarları korunur. Devam etmek istiyor musunuz?"*
     - Onaylandığında sadece o kartın algoritma geçmişi 'Yeni' haline döner; görsel ve blur ayarlarına dokunulmaz.
  4. **[ 🗑️ Anki'den Çıkar ]:**
     - Tıklandığında güvenlik onayı sorar:
       *"Bu kart Anki destesinden çıkarılacaktır. Emin misiniz?"*
     - Onaylandığında eserin `anki: false` yapılır. Eser koleksiyondan/arşivden kesinlikle silinmez; kart düzenleme penceresinde "Anki" tikini kaldırıp Kaydet butonuna basmakla birebir aynı sonucu verir. Kart bu listeden kaldırılır ve sağ panel otomatik olarak bir sonraki karta geçer (eğer listenin son kartıysa bir öncekine geçer; destede kart kalmadıysa 'Deste Boş' ekranı gösterilir).

---

## 4. Ekran Boyutu & Mobil Davranış (Master-Detail)
- **Masaüstü (Desktop >= 768px):** Yukarıdaki şemadaki gibi yan yana 2 sütun.
- **Mobil / Dar Ekran (< 768px):** 
  - İlk başta tam ekran kart listesi görünür.
  - Kullanıcı bir karta tıkladığında sağ panel tam ekran olarak kayar.
  - Sol üstteki `[← Kartlara Dön]` butonuyla tekrar listeye dönülür.

---

## 5. Uygulama ve Entegrasyon Aşamaları (2 Aşamalı Plan)

> **Kritik Kural:** Her aşamanın sonunda geliştirme durdurulur ve kullanıcıya o aşamayı canlıda deneyimleyip doğrulayabilmesi için **Adım Adım Test Rehberi (Checklist)** sunulur. Kullanıcı testi yapıp onay vermeden bir sonraki aşamaya kesinlikle geçilmez.

### Aşama 1: İskelet, Liste, Arama, Kategori Filtresi & Önizleme
- **Kapsam:**
  - `AnkiHubModal` üst araç çubuğuna `[Kartlar]` butonunun eklenmesi.
  - `AnkiCardsModal` bağımsız bileşeninin oluşturulması.
  - **Üst Bar:** Canlı arama kutusu (`[ 🔍 (✕) ]`) ve ana sayfa mimarisinde `[ Tümü ] [ Medya ▾ ] [ Oyun ▾ ] [ Kitap ▾ ]` hiyerarşik filtreleri.
  - **Sol Liste:** A'dan Z'ye alfabetik kart listesi, 24×32 afişler, kategori rozetleri ve **Klavye Yön Tuşları (↑ / ↓)** ile hızlı gezinme.
  - **Sağ Panel Önizlemesi:** Seçilen kartın afişi, blur kutularının canlı gösterimi, künye bilgisi ve **[ Space ] (Boşluk)** tuşu ile blur aç/kapat toggle mekanizması.
- **Aşama 1 Sonu Kullanıcı Test Rehberi:**
  1. Anki Hub'ı açıp sağ üstteki `[Kartlar]` butonuna tıklayarak pencerenin açıldığını doğrulamak.
  2. Sol listede kartların A'dan Z'ye geldiğini ve klavyeden yukarı/aşağı ok tuşlarıyla gezinildiğinde sağ önizlemenin anında değiştiğini görmek.
  3. Klavyeden **Space** tuşuna basarak afiş üzerindeki blur'un geçici olarak açılıp kapandığını test etmek.
  4. Arama kutusuna bir yapım adı yazıp aramanın ve `(✕)` temizleme butonunun çalıştığını kontrol etmek.
  5. `[ Medya ▾ ]`, `[ Oyun ▾ ]`, `[ Kitap ▾ ]` menülerine tıklayıp kategorilere göre listenin doğru süzüldüğünü görmek.

---

### Aşama 2: 4 Aksiyon Butonu, Modal Entegrasyonları & Mobil Cila
- **Kapsam:**
  - **[ ✏️ Kartı Düzenle ] Butonu:** Doğrudan `AnkiEditorModal`'ı açar. "Uygula ve Kapat" dendiğinde değişiklikleri anında karta kaydeder ve veritabanını günceller.
  - **[ 👁️ Yapım Detayı ] Butonu:** Hollow Knight görselinde görülen tam ekran `ItemDetailModal` kartını Kartlar penceresi üzerinde açar.
  - **[ 🔄 Başa Sar ] Butonu:** Güvenlik onayı sorarak kartın tekrar geçmişini/aralığını sıfırlar.
  - **[ 🗑️ Anki'den Çıkar ] Butonu:** Güvenlik onayı sorarak eserin `anki: false` yapılmasını sağlar; kart listeden çıkar ve otomatik bir sonraki karta odaklanır.
  - **Mobil / Dar Ekran Desteği:** Ekran genişliği < 768px olduğunda liste ve detay paneli arasındaki akıcı geçiş ve `[← Kartlara Dön]` butonu.
- **Aşama 2 Sonu Kullanıcı Test Rehberi:**
  1. `[ ✏️ Kartı Düzenle ]` butonuna basıp Anki editörünü açmak, bir blur ekleyip veya değiştirip "Uygula ve Kapat" dedikten sonra önizlemede anında güncellendiğini doğrulamak.
  2. `[ 👁️ Yapım Detayı ]` butonuna basıp yapımın ana künye/puan penceresinin açıldığını doğrulamak.
  3. `[ 🔄 Başa Sar ]` diyerek onay kutusunu ve algoritmanın 'Yeni' karta döndüğünü test etmek.
  4. `[ 🗑️ Anki'den Çıkar ]` butonuna basarak onay verip kartın listeden düştüğünü, yapımın ise arşivde kalmaya devam ettiğini teyit etmek.
  5. Mobil görünümde liste ve önizleme arasındaki geçişi kontrol etmek.

