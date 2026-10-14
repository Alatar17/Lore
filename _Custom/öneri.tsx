/**
 * LORE KİŞİSEL KÜRATORLÜK & ÖNERİ ALGORİTMASI ŞARTNAMESİ (öneri.tsx)
 * ------------------------------------------------------------------------
 * Bu şartname, yapay zekanın kullanıcıya özel öneri üretirken uygulayacağı
 * ağırlık piramidini, rozet sınıflandırmasını ve puan filtreleme kurallarını
 * belirler.
 */

// ============================================================================
// 1. ÖNERİ DNA'SI & ROZET SINIFLANDIRMASI (BADGES)
// ============================================================================
/**
 * Her öneri kartında yer alan rozet, yapımın hangi stratejiyle seçildiğini
 * kullanıcıya dürüstçe açıklar:
 *
 * 1. 🎯 KÜTÜPHANE İMZASI (Uyum: %85 - %99)
 *    - Kullanıcının 9-10 puan verdiği zirve yapımlarla, S/A-Tier listesiyle,
 *      favori yönetmen, senarist veya stüdyolarıyla doğrudan organik bağı olan
 *      nokta atışı öneriler.
 *
 * 2. 🌀 FARKLI BİR TAT (Uyum: %60 - %85)
 *    - Kullanıcının sevdiği temaların ve türlerin kıyısında duran, fakat
 *      daha önce denemediği bir alt tür, farklı bir coğrafya ya da özgün bir
 *      anlatım üslubu getiren genişletici yapımlar.
 *
 * 3. 🔮 SIRADIŞI KEŞİF (Konfor Alanı Dışı - Cesur Tercih)
 *    - Kullanıcının kütüphanesinde az rastlanan ancak genel kalite ve zeka çıtasına
 *      birebir uyan, popüler ana akımın dışında kalmış kült veya bağımsız yapımlar.
 */

// ============================================================================
// 2. VERİ AĞIRLIK PİRAMİDİ (WEIGHTING PYRAMID)
// ============================================================================
/**
 * Öneri motorunun karar verirken uygulayacağı öncelik sırası:
 *
 * 1. KULLANICININ ANLIK İSTEĞİ (PROMPT INTENT) —— Ağırlık: %40 (EN YÜKSEK ÖNCELİK)
 *    - Kullanıcı o an ne istiyorsa (örneğin: "Bu akşam kısa, kafa yormayan bir şey öner")
 *      tüm kütüphane geçmişinden önce bu istek esas alınır. Kütüphane hafızası kullanıcının
 *      anlık talebini ezemez; onun emrinde çalışır.
 *
 * 2. PUANLAR & TIER LİSTESİ —— Ağırlık: %30 (KALİTE VE BEĞENİ STANDARDI)
 *    - 9 ve 10 Puanlar & S/A Tier: Kullanıcının başyapıt standardıdır.
 *    - 7 ve 8 Puanlar: Güvenli beğeni tabanı.
 *    - 2 ila 5 Puanlar: Negatif pusula (beğenilmeyen dinamikler elenir).
 *    - DİKKAT (1 PUAN İSTİSNASI): 1 PUAN ASLA BİR BEĞENİ YA DA PUAN OLARAK
 *      DİKKATE ALINMAZ! (Aşağıdaki kurala bakınız).
 *
 * 3. OYUNLARDA SAAT + BAŞARIM + PUAN DENGESİ —— Ağırlık: %15
 *    - Yüksek saat + Yüksek başarım + Yüksek puan = Gerçek tutku türü.
 *    - Düşük saat veya yarım bırakma = Sevilmeyen mekanikler.
 *
 * 4. YARIM BIRAKILANLAR (DROPPED LİSTESİ) —— Ağırlık: %15 (NEGATİF ELEME)
 *    - Kullanıcının yarıda bıraktığı yapımların ortak günahları (tempo düşüklüğü,
 *      tekrar eden görevler, zayıf karakter gelişimi vb.) yeni önerilerde bulunamaz.
 */

// ============================================================================
// 3. PUAN ANALİZİ VE KRİTİK 1 PUAN KURALI
// ============================================================================
/**
 * PUANLARIN DEĞERLENDİRİLME YÖNTEMİ:
 *
 * 1. KESİN KURAL: 1 PUAN TAMAMEN GÖRMEZDEN GELİNİR (YOK HÜKMÜNDEDİR)
 *    - Kullanıcı izlemekte veya oynamakta olduğu, henüz bitirmediği yapımlara
 *      geçici işaretçi olarak "1 puan" vermektedir.
 *    - Bu sebeple: 1 PUAN ASLA "KÖTÜ", "DÜŞÜK" VEYA "BEĞENİLMEDİ" ANLAMINA GELMEZ.
 *    - Algoritma 1 puanı puan hesaplamalarından, anti-zevk listesinden ve
 *      öneri filtrelerinden TAMAMEN ÇIKARIR. 1 puanlı yapımlar puanlanmamış
 *      gibi nötr kabul edilir.
 *
 * 2. POZİTİF KUTUP (9 - 10 PUAN):
 *    - Yapımın yönetmeni, kurgu dinamiği, anlatım tonu ve karakter işlenişi
 *      kullanıcının ideal kalite çıtası olarak kabul edilir.
 *
 * 3. NEGATİF KUTUP (2 - 5 PUAN):
 *    - Kullanıcının 2, 3, 4 veya 5 puan verdiği yapımlardaki kusurlar
 *      (klişe diyaloglar, yüzeysel karakterler, ucuz drama) tespit edilir ve
 *      benzer zayıflıklara sahip yapımlar önerilmez.
 *
 * 4. ŞABLON VE ROBOTİK CÜMLE YASAĞI:
 *    - Öneri gerekçesinde ASLA "Kütüphanende X'e 10 puan verdiğin için..." gibi
 *      robotik ve yapay cümleler kurulamaz.
 *    - Bunun yerine eserin ruhu, felsefesi ve tonu doğrudan kullanıcının
 *      beğeni kimliğiyle doğal bir dille eşleştirilir.
 */
