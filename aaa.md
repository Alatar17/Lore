# Mobil & Anki Geliştirme Şartnamesi (aaa.md)

Bu belge, son kullanıcı geri bildirimleri ve paylaşılan ekran görüntüleri doğrultusunda kararlaştırılan mobil kullanıcı deneyimi (UX), Anki Deste Hub'ı ve Anki Çalışma Modu geliştirmelerini içerir.

---

## 1. Mobilde Arama İkonuna Basınca Otomatik Klavye Açılması
- **Mevcut Durum & Teşhis:** 
  - Kullanıcı cihazında bir sorun yoktur. Modern mobil tarayıcılar (Android Chrome ve iOS Safari), güvenlik ve istenmeyen klavye fırlamalarını engellemek için sanal klavyeyi **yalnızca kullanıcı dokunma/tıklama (user gesture) anında DOM'da ZATEN var olan bir input elemanına SENKRON (`sync`) olarak `.focus()` çağrıldığında** açar.
  - Mevcut kodda butona basılınca `setIsSearchOpen(true)` React state kuyruğuna girmekte ve arama input'u DOM'a henüz monte edilmediği için `setTimeout` ile asenkron aranmaktadır. Tarayıcı bu asenkron gecikmeyi "kullanıcı dokunuşu bitti" olarak değerlendirip sanal klavyeyi açmamaktadır.
- **Kararlaştırılan Çözüm:**
  - Mobil arama input'u DOM'da her zaman hazır (hazırda bekleyen veya anında senkron odaklanan) bir yapıya kavuşturulacak.
  - Kullanıcı mobil alt bardaki arama ikonuna bastığı milisaniyede (touch/click anında doğrudan senkron olarak) input odaklanacak, böylece sanal klavye ekrana ikinci bir dokunuşa gerek kalmadan tek seferde fırlayacaktır.

---

## 2. Mobil Alt Bar Boyutlandırması (-%5 Dikey Küçültme)
- **Mevcut Durum:** Önceki adımda yapılan %10'luk büyütme kullanıcı deneyiminde bir miktar kaba/büyük hissedildi.
- **Kararlaştırılan Çözüm:**
  - Dikey yükseklik %5 oranında tatlı bir seviyeye küçültülecek.
  - Buton yükseklikleri `h-9` (36px) yerine `h-[34px]` veya `h-8.5` dengesine çekilecek.
  - Bar iç dikey boşluğu `py-0.5 px-1` olarak optimize edilecek.
  - İkon boyutları `w-4 h-4` dengesinde korunarak kompakt, estetik ve başparmakla rahat dokunulan altın oran sağlanacak.

---

## 3. Lore AI Asistan - Mobil Başlık, Alt Bilgi ve Modal Yerleşimi
- **Mevcut Sorun:** 
  - Mobilde üst barda "Lore AI Asistan" başlığı 2 satıra kırılıyor ("Lore AI" üstte, "Asistan" altta kalıyor).
  - Yanındaki `• 108 yapım hafızada` rozeti sığmayarak taşma veya kırılma yaratıyor.
- **Kararlaştırılan Çözüm:**
  - Başlık mobilde kesinlikle tek satır kalacak (`whitespace-nowrap`).
  - Kullanıcı tercihine uygun olarak; mobilde `108 yapım` bilgisi başlığın hemen altına şık, sade bir alt bilgi/rozet olarak yerleştirilecek (başında yeşil nokta olmadan, doğrudan `108 yapım` şeklinde).
  - Masaüstünde ise mevcut yapı korunacak: yan yana ve `• 108 yapım hafızada` şeklinde gösterilmeye devam edecek.
- **Modal Boyut ve Kenar Düzeni (Mobil Değerlendirmesi):**
  - Mobilde pencerenin yanlara ve alta sıfır olması (Bottom-Sheet / Alt Çekmece mimarisi) modern mobil işletim sistemleri (iOS & Android) için en ergonomik ve standart yaklaşımdır. Başparmak erişimini kolaylaştırır ve ekran alanını maksimum verimle kullanır. Bu düzen korunacak, üst köşelerin ovalliği (`rounded-t-2xl`) ve iç boşluklar korunacaktır.

---

## 4. Anki Deste Hub'ı - Mobil Başlık İkonunun Kaldırılması
- **Mevcut Sorun:** Mobilde üst barda sol taraftaki `[Layers]` (katman) kutucuk ikonu gereksiz yer kaplayarak sağdaki "Kartlar", "Sıfırla" ve "Kapat" butonlarının sıkışmasına yol açıyor.
- **Kararlaştırılan Çözüm:**
  - Başlıktaki sol katman ikonu sadece mobilde gizlenecek (`hidden sm:flex`).
  - Masaüstü görünümünde ikon aynen kalacak.
  - Böylece mobilde başlık alanı ferahlayacak ve aksiyon butonları rahatça sığacaktır.

---

## 5. Anki Deste Hub'ı - "Medya" Deste İsminin Görünmesi & "Çalış" Butonu Erişilebilirliği
- **Mevcut Sorunlar (Ekran Görüntüsü Analizi):**
  - Ekran görüntüsünde görüldüğü üzere `[+] (13)` görünüyor fakat "Medya" metni flex daralması ve sayaç sütunlarının genişliği yüzünden ezilerek ekrandan kayboluyor.
  - "Çalış" butonu `opacity-0 group-hover:opacity-100` sınıfına sahip olduğu için mobilde dokunmatik ekranda hover (üzerine gelme) mekanizması bulunmadığından kullanıcı bu butonu mobilde asla göremiyor ve desteyi başlatamıyor.
- **Kararlaştırılan Çözüm:**
  - **Sütun Oranları:** Mobilde 3 sayaç sütunu (Yeni, Öğreniliyor, Tekrar) daha kompakt ve orantılı hale getirilecek; böylece deste adı alanına (`Medya`, `Oyun`, vb.) yeterli genişlik açılacak ve isim asla ezilmeyecek.
  - **Çalış Butonu:** Mobilde hover şartı kaldırılacak (`opacity-100 sm:opacity-0 sm:group-hover:opacity-100`). Ayrıca mobilde doğrudan deste satırına dokunarak da deste başlatılabilecek.
  - Masaüstü davranışı ve tasarımı kesinlikle bozulmayacak.

---

## 6. Anki Çalışma Modu - En-Boy Oranı & Ekran Ergonomisi
- **Mevcut Durum:** Çalışma penceresi mobilde masaüstü kutusu gibi davrandığı için posterin altında/üstünde siyah ölü boşluklar oluşuyor ve butonlar ortada havada asılı duruyor.
- **Kararlaştırılan Çözüm:**
  - **Masaüstü Korunacak (`sm:`):** PC/Masaüstü görünümünün mevcut kutu boyutu, oranları ve düzeni kesinlikle bozulmayacak.
  - **Mobil Tam Ekran Ergonomisi:** Mobilde pencere dikey ekranı maksimum verimle dolduracak; üst bar, poster/kart gövdesi ve alttaki kontrol barı dikey eksende kusursuz bir orantıyla dağıtılacak. Boş siyah alanlar minimize edilecek.

---

## 7. Anki Çalışma Modu - Orijinal Anki Mobil Alt Bar Mimarisi
- **Renk & Stil İlkesi:** 
  - PC'deki mevcut renk paleti aynen korunacak ve mobilde de kullanılacak (görseldeki rastgele renkler değil; PC'deki açık kırmızı, amber/turuncu, zümrüt yeşili ve açık mavi kullanılacak).
  - PC'deki masaüstü alt bar düzeni kesinlikle bozulmayacak (`sm:` kuralları korunacak).
- **Mobil Orijinal Anki Tasarımı (Ekranın En Altına Sabitlenmiş Dokunma Alanı):**
  - **1. Aşama (Soru Hali - Cevap Gösterilmeden Önce):**
    - Ekranın en altına sıfır yapışık, tam genişlikte (100% width), başparmakla zahmetsizce dokunulabilen büyük **"Cevabı Göster"** alt butonu.
    - Üzerinde mevcut Anki sayaçları (`0 + 3 + 49`) zarifçe yer alacak.
  - **2. Aşama (Cevap Hali - Cevap Gösterildikten Sonra):**
    - Ekranın en altındaki bar, orijinal AnkiMobile / AnkiDroid gibi 4 eşit sütuna/bloğa bölünecek:
      1. **Yeniden (Again):** Üstte süre (örn. `<1dk`), altta `Yeniden` (PC'deki açık kırmızı tonu: `text-red-400 bg-red-500/15 border-red-500/30`).
      2. **Zor (Hard):** Üstte süre (örn. `<6dk`), altta `Zor` (PC'deki amber tonu: `text-amber-400 bg-amber-500/15 border-amber-500/30`).
      3. **İyi (Good):** Üstte süre (örn. `<10dk`), altta `İyi` (PC'deki zümrüt yeşili: `text-emerald-400 bg-emerald-500/15 border-emerald-500/30`).
      4. **Kolay (Easy):** Üstte süre (örn. `3g`), altta `Kolay` (PC'deki açık mavi tonu: `text-blue-400 bg-blue-500/15 border-blue-500/30`).
    - Her buton dikeyde iki satırlı (üstte süre, altta isim), geniş temas yüzeyine sahip ve tek elle telefon tutarken bile başparmakla kolayca basılabilecek ergonomide olacak.
