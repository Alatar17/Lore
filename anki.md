# Anki Modülü Tasarım, Mimari ve Geliştirme Kararları

Bu belge, Anki modülünün editör ve kart listesi bileşenleri için mutabakata varılan görsel yerleşimleri, iş kurallarını ve teknik mimariyi açıkça tanımlar.

---

## 1. Anki Deste Hub > Kartlar Sekmesi (`AnkiCardsModal`)

### A. Çoklu Görsel Gezgini (`< 1 / 2 >`) Konumu ve "Sabit Konum" Kuralı (Zero-Shift Layout)
- **Kritik UI Kuralı (Afiş Asla Aşağı-Yukarı Zıplamayacak):**
  - Tek resimli bir karttan 2 resimli bir karta geçildiğinde veya tam tersi yapıldığında, `< 1 / 2 >` sayacı belirip kaybolduğu için **sağdaki afiş asla yer değiştirmeyecek / aşağıya doğru kaymayacak.**
  - **Uygulama:** Afişin hemen üzerindeki tepe boşluk alanı sabit bir rezerve yüksekliğe (`min-h-[32px]` / `h-8`) sahip olacak.
    - Eğer seçili yapımda 2 veya 3 görsel varsa (`totalImages > 1`): Bu rezerve alanın içinde `< 1 / 2 >` sayacı görüntülenecek.
    - Eğer seçili yapımda tek görsel varsa: Alan boş kalacak, böylece afiş her iki durumda da ekranda birebir aynı dikey piksel hizasında sabit kalacak.
- **Konum:** Afiş çerçevesinin doğrudan üstünde, ortalanmış, afişe temas etmeyen bağımsız bir alan.
- **Etkileşim:**
  - Sol/Sağ oklara tıklandığında `1. Ana Afiş` ile `2. / 3. Ek Sahne Görselleri` arasında geçiş yapılacak.
  - O anki seçili görsele ait blur kutuları gösterilecek.
  - Sol listeden başka bir karta tıklandığında aktif görsel indeksi otomatik olarak `0`'a (Ana Afiş) sıfırlanacak.

### B. Her Kart İçin "Otomatik Akıl" Etiket Desteği (Tutarlılık Garantisi)
- **Mevcut Durum:**
  - Kartlar sekmesi sadece kullanıcının elle seçtiği `item.ankiFrontTags` alanına bakıyordu; elle etiket seçilmemiş kartların (örn: *Kill la Kill*) altı boş kalıyordu.
  - Çalışma ekranı (`AnkiStudyModal`) ise etiket seçilmemiş olsa bile `getAnkiFrontBadges` fonksiyonuyla yapımın ilk stüdyosunu/yönetmenini otomatik getiriyordu.
- **Kararlaştırılan Çözüm:**
  - `AnkiCardsModal` da Çalışma Ekranı ile aynı `getAnkiFrontBadges` fonksiyonunu kullanacak.
  - Kullanıcı elle özel bir ön yüz etiketi seçtiyse o gösterilecek (*One Punch Man* -> `Madhouse`, `J.C.Staff` / *High School DxD* -> `TNK`, `Passione`).
  - Kullanıcı elle etiket seçmediyse sistem otomatik olarak ilk stüdyoyu (*Kill la Kill* -> `Trigger`), yönetmeni, geliştiriciyi veya yazarı kart başlığının altına etiket olarak basacak.
  - Böylece Kartlar sekmesinde **istisnasız her kartın altında ilgili künye etiketi daima yer alacak.**

---

## 2. Anki Editörü (`AnkiEditorModal`): Görsel Yönetimi ve Buton Yerleşimi

### A. 1. Ana Afişin Dokunulmazlığı
- Ana afiş kütüphanedeki yapımın temel afişidir.
- Sistemde zaten olduğu gibi, Anki Editörü içinden ana afiş **ASLA silinemez ve değiştirilemez.**
- Ana afişin üzerinde **kesinlikle "X" (kaldırma) ikonu olmayacak.**

### B. Ek Sahne Görsellerinde Zarif [X] (Kaldır) Butonu
- Sadece **2. ve 3. Ek Sahne Görselleri** seçiliyken, afiş çerçevesinin sağ üst köşesinde zarif bir **[X]** (silme) butonu yer alır.
- Bu butona tıklandığında ilgili ek sahne silinir ve editör otomatik olarak bir önceki görsele (veya 1. Ana Afişe) geçer.
- Bu doğrudan görsel üzeri silme sayesinde alt araç çubuğundaki (toolbar) eski **`[ Resmi Sil ]` butonu tamamen kaldırılır** ve alt bar sadeleşir.

### C. Butonların Konumu ve Ekleme Mantığı (Değiştir Modu Yok - Sadece Ekleme)
- **Konum:** Editörün sağ alt araç çubuğunda (toolbar), eski butonların bulunduğu alanda yan yana iki buton:
  - `Upload` ikonu ile **[ Yükle ]** (Cihazdan dosya seç)
  - `ClipboardPaste` ikonu ile **[ Yapıştır ]** (Panodaki resmi doğrudan al)
- **Çalışma Mantığı:**
  - Kullanıcı hangi görselde olursa olsun (ister 1. Ana Afişte, ister 2. Ek Sahnede), toplam görsel sayısı 3'ten az olduğu sürece (`extraImages.length < 2`) butonlar aktiftir.
  - `[ Yükle ]` dendiğinde veya `[ Yapıştır ]` yapıldığında (ya da klavyeden `Ctrl+V` basıldığında), yeni görsel sıradaki ek sahne olarak eklenir ve sistem anında o yeni sahneye geçiş yapar.
  - Toplam 3 görsele (1 Ana Afiş + 2 Ek Sahne) ulaşıldığında kota dolar ve butonlar kilitlenir (devre dışı kalır).
  - Kullanıcı bir ek sahneyi yenisiyle değiştirmek istediğinde: Sahnenin sağ üstündeki **`[X]`** butonuna basarak sahneyi siler, ardından **`[ Yükle ]`** veya **`[ Yapıştır ]`** diyerek yeni görseli ekler.
- **Pano Entegrasyonu:**
  - Hem `[ Yapıştır ]` butonu tıklandığında hem de editör açıkken klavyeden doğrudan `Ctrl+V` yapıldığında panodaki resim otomatik optimize edilerek anında yeni sahne olarak eklenir.
