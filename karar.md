# Proje Karar Defteri (karar.md)

## Karar 1: Arama Çubuğunda Dahili "Ghost Text" Otomatik Tamamlama
- **Tarih:** 2026-10-13
- **Konum:** `HeaderTabs.tsx` içerisindeki arama giriş kutuları (`#search-header-input` ve `#mobile-search-header-input`).
- **Dokunulmazlık & Güvenlik İlkesi (Arama Motoru Koruma):**
  - Mevcut arama ve filtreleme motoruna (`App.tsx` içerisindeki açıklama/konu, yıl, karakter ve künye tarama mantığına) **kesinlikle dokunulmayacak**.
  - Örneğin konuda geçen `"kaptan trips"` ifadesinin *"Mahşer"* kitabını bulması gibi derin aramalar aynen korunacak. Ghost text yalnızca yapılandırılmış künye bilgilerine rehberlik edecek, açıklama metinleri ghost text havuzuna dahil edilmeyecek.
- **Tasarım & UI Felsefesi:**
  - Harici açılır pencere (dropdown) KULLANILMAYACAK.
  - Arama kutusunun kendi içine, imlecin hemen ardına yerleşen **yarı saydam / gri (Ghost Text)** satır içi tamamlama uygulanacak.
- **Tetiklenme Eşiği & Eşleşme Mantığı:**
  - **Minimum Karakter:** Tek harfte öneri çıkmayacak; en az **2 harf** yazıldığında devreye girecek (`query.length >= 2`).
  - **Eşleşme Kuralı:** Baştan eşleşme (Prefix match). Türkçe karakter ve büyük/küçük harf duyarsızlığı (`i/İ/ı/I`) tam desteklenecek.
  - **Çakışma Kuralı (Tie-Breaker):** Aynı harfle başlayan birden fazla terim varsa, öncelik **en yüksek puanlı yapıma** (10'dan 1'e), eşitlik halinde ise **en son eklenen yapıma** verilecek.
- **İki Mod Ayrımı ve Aktif Sekme Odaklı Kapsam:**
  - Havuz yalnızca kullanıcının o an bulunduğu sekmeye (`Kitap`, `Medya`, `Oyun`) ait verilerden beslenecek; sekmeler arası çakışma yaşanmayacak.

  ### 1. Normal Arama Modu (🔍):
  - **Amaç:** Yapımı, kişiyi veya stüdyoyu doğrudan aramak.
  - **Kapsam & Öncelik Sıralaması:**
    1. **Yapım Başlıkları (#1 Öncelik):** (Örn: `bat` ➔ `man: The Dark Knight`)
    2. **Yönetmenler / Yazarlar (Ana Üreticiler):** (Örn: `ste` ➔ `phen King`)
    3. **Stüdyolar / Geliştiriciler / Yayınevleri:** (Örn: `map` ➔ `pa`, `alt` ➔ `ın Kitaplar`)
    4. **Oyuncular / Seslendirmenler / Çevirmenler:** (Örn: `kan` ➔ `a Hanazawa`)
    - *Özel Kural:* **"Tür (Genre)"** normal arama modunda **KAPSAM DIŞIDIR** (Normal aramada türler önerilip başlıkların önünü tıkamaz).

  ### 2. Etiket Arama Modu (🏷️):
  - **Amaç:** Koleksiyonu künye ve tür etiketleriyle filtrelemek (Çip mantığı).
  - **Kapsam & Öncelik Sıralaması (BAŞLIKLAR KESİNLİKLE HARİÇ):**
    1. **Türler (Genres - #1 Öncelik):** (Örn: `kor` ➔ `ku`, `sci` ➔ `-fi`)
    2. **Yönetmenler / Yazarlar:** (Örn: `ste` ➔ `phen King`)
    3. **Stüdyolar / Geliştiriciler / Yayınevleri:** (Örn: `fro` ➔ `mSoftware`)
    4. **Oyuncular / Seslendirmenler / Çevirmenler:** (Örn: `kan` ➔ `a Hanazawa`)

- **Etkileşim, Kabul Mekanizması & Güvenlik:**
  - **Kabul Tuşları:** **Tab**, **Sağ Ok (→)** veya **Aşağı Ok (↓)** tuşları.
  - **Saf İsim Kuralı (Kritik):** Silik önizleme sırasında görsel ayrım için gösterilebilecek bilgi etiketleri (örn: `· Yazar`, `· Stüdyo`) **asla arama kutusuna yazılmayacak**. Kutuya yalnızca temiz metin (örn: `"Stephen King"`) aktarılacak; böylece arama motorunun bozulması engellenecek.
  - **Etiket Modunda Davranış:** Kabul edildiğinde önerilen terim anında mavi bir **Çip (Chip)** haline dönüşecek ve kutu bir sonraki etiketi bekleyecek.
  - **Mobil Uyumluluk:** Sanal klavyelerde Tab/Ok tuşları olmadığından, arama kutusundaki silik öneri alanına dokunulduğunda da tamamlama kabul edilecek.
- **Durum:** Onaylandı, tasarım ve mimari kuralları netleştirildi.
