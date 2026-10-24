# RedirAddon 🦊

**RedirAddon**, Chrome Web Store (`chromewebstore.google.com`) üzerinde bir eklenti incelenirken, aynı eklentinin Firefox Add-ons (`addons.mozilla.org` - AMO) mağazasında olup olmadığını otomatik sorgulayan ve varsa doğrudan yönlendirme butonu sunan modern bir tarayıcı geliştirme projesidir.

---

## 🚀 Özellikler

1. **Akıllı Başlık Temizleme & Eşleştirme Motoru:**
   - Eklenti başlığındaki pazarlama etiketlerini (örn. `Dark Reader - dark mode for every website` -> `Dark Reader`) ayıklar.
   - Levenshtein mesafesi ve token tabanlı Jaccard katsayısını harmanlayarak yüksek doğrulukta benzerlik skoru hesaplar.
2. **Dinamik SPA ve DOM Değişikliklerine Dayanıklılık:**
   - Chrome Web Store'un Lit / Web Components tabanlı asenkron yapısına uygun `MutationObserver` ve URL izleme mimarisine sahiptir.
   - Sayfa geçişlerinde (SPA) bellek sızıntısı olmadan eski durumu temizler ve yeni eklentiyi sorgular.
3. **CORS ve CSP Kısıtlamalarına Karşı Güvenli:**
   - **Eklenti Modunda (MV3):** `background.js` (Service Worker) üzerinden istek atarak sayfa içi CSP engellerini aşar ve 15 dakikalık akıllı önbellek (In-Memory Cache) kullanır.
   - **Userscript Modunda:** `GM_xmlhttpRequest` ve `@connect addons.mozilla.org` ayrıcalıkları ile tam uyumlu çalışır.
4. **Şık ve Uyumlu Arayüz:**
   - Chrome Web Store'un Material 3 tasarım diline entegre pill-button tasarımı.
   - Firefox marka renkleri, mikro animasyonlar (yükleniyor çarkı, hover efektleri) ve Koyu Tema (Dark Mode) desteği.

---

## 📁 Proje Dosya Yapısı (FORMAT B)

```text
RedirAddon/
├── manifest.json         # Manifest V3 yapılandırması
├── background.js        # AMO API isteklerini ve önbelleği yöneten servis çalışanı
├── content.js           # Sayfa DOM'unu inceleyen ve butonu enjekte eden betik
├── styles.css           # Modern buton ve durum stilleri (Dark mode uyumlu)
├── popup.html           # Eklenti araç çubuğu popup arayüzü
├── popup.css            # Popup stilleri
├── RedirAddon.user.js   # FORMAT A: Tampermonkey Userscript versiyonu
├── icons/               # 16x16, 48x48, 128x128 eklenti ikonları
└── README.md            # Kurulum ve dokümantasyon
```

---

## 🛠️ Kurulum Talimatları

### FORMAT A: Tampermonkey / Violentmonkey (Userscript)
1. Tarayıcınızda [Tampermonkey](https://www.tampermonkey.net/) veya [Violentmonkey](https://violentmonkey.github.io/) eklentisinin kurulu olduğundan emin olun.
2. Eklenti simgesine tıklayıp **"Yeni Script Oluştur"** (Create a new script) seçeneğini seçin.
3. `RedirAddon.user.js` dosyasının içeriğini kopyalayıp editöre yapıştırın ve **Kaydet (Ctrl+S)** yapın.
4. Herhangi bir Chrome Web Store detay sayfasına gidin (örn. `https://chromewebstore.google.com/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm`). Buton otomatik olarak görünecektir.

### FORMAT B: Tarayıcı Eklentisi (Manifest V3 - Unpacked)
1. Chrome veya Chromium tabanlı bir tarayıcıda `chrome://extensions/` adresine gidin.
2. Sağ üst köşedeki **"Geliştirici modu"** (Developer mode) anahtarını açın.
3. Sol üstteki **"Paketlenmemiş öğe yükle"** (Load unpacked) butonuna tıklayın.
4. Bu klasörü (`RedirAddon`) seçin.
5. Eklenti başarıyla yüklenecektir!

---

## 🔍 API & Benzerlik Eşleştirme Mantığı

- **AMO Endpoint:** `https://addons.mozilla.org/api/v5/addons/search/?q={QUERY}&page_size=6&type=extension`
- **Benzerlik Eşiği:** `0.65` ve üzeri eşleşmelerde buton doğrudan eklenti sayfasına bağlantı verir.
- **Bulunamadı Durumu:** Doğrudan eşleşme bulunamazsa kullanıcıyı AMO'nun ilgili arama sayfasına yönlendiren akıllı yedek mekanizma çalışır.

