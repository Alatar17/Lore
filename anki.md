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

### B. Butonların Konumu (Sağ Alt Araç Çubuğu - Mevcut UI Düzeni Korunur)
- **Konum:** UI düzeni bozulmadan, doğrudan editörün sağ alt araç çubuğundaki (toolbar) eski `+ Ek Resim Ekle` butonunun bulunduğu alana yerleştirilecek.
- **Yeni Buton Yapısı:**
  - Eski `+ Ek Resim Ekle` butonu kaldırılacak.
  - Yerine yan yana iki modern buton eklenecek:
    - `Upload` ikonu ile **[ Yükle ]** / **[ Değiştir ]**
    - `ClipboardPaste` ikonu ile **[ Yapıştır ]**
- **Çalışma Mantığı:**
  1. **1. Ana Afiş Seçiliyken:**
     - Butonlar yeni ek sahne görseli eklemek için çalışır: `[ Yükle ]` (Dosya seç) ve `[ Yapıştır ]` (Panodaki resmi al).
     - Kullanıcı internetten kopyaladığı bir sahneyi `[ Yapıştır ]` diyerek (veya doğrudan `Ctrl+V` yaparak) indirmeden anında **2. Ek Sahne** olarak ekleyebilir. Eklendiği anda otomatik olarak o yeni ek sahneye geçilir.
     - En fazla 2 ek görsel eklenebildiği için kota dolduğunda butonlar kilitlenir.
  2. **2. veya 3. Ek Görsel Seçiliyken:**
     - Butonlar `[ Değiştir ]` ve `[ Yapıştır ]` moduna geçer; mevcut ek sahneyi yenisiyle değiştirmeye yarar.
     - Mevcut ek görseli silmek için `[ Resmi Sil ]` butonu korunur.
- **Pano Entegrasyonu:**
  - Hem `[ Yapıştır ]` butonu tıklandığında hem de klavyeden `Ctrl+V` yapıldığında panodaki görsel otomatik okunup optimize edilerek eklenecektir.
