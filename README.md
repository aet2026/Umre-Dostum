# 🚪 Kapı Rehberi (Kaybolmaya Karşı Yönlendirme Uygulaması)

Bu uygulama, özellikle **dijital okuryazarlığı olmayan yaşlılar, Alzheimer/demans hastaları veya kalabalık otellerde/stadyumlarda yönünü kaybeden kişiler** için tasarlanmış, tarayıcı tabanlı bir web uygulamasıdır.

Kişi otelden veya evinden çıkarken giriş kapısının konumunu kaydeder. Dönüşte kaybolursa, tek bir mavi düğmeye basarak kendi konumundan giriş kapısına olan mesafeyi ve yönü sesli olarak dinleyebilir. Konum verileri sunucuya gönderilmez; yalnızca telefonun kendi hafızasında (localStorage) saklanır.

## ✨ Özellikler

- **Tek Dokunuşla Kayıt:** Giriş kapısının GPS konumunu tek düğmeyle hızlıca kaydeder.
- **Sesli ve Görsel Yönlendirme:** "Düz yürüyün", "Hafifçe sağa dönün", "Arkanıza dönün" gibi Türkçe sesli komutlar verir.
- **Harita Görünümü:** OpenStreetMap tabanlı Leaflet haritası üzerinde yürünen yolu ve kapıya olan mesafeyi gösterir.
- **Yanlışlıkla Silme Koruması:** Kayıtlı kapıyı silmek için 3 saniye boyunca basılı tutmak gerekir.
- **Gizlilik Odaklı:** Konum verileri sunucuya gönderilmez, yalnızca tarayıcının localStorage'ında saklanır.
- **Erişilebilirlik:** Devasa düğmeler, yüksek kontrastlı renkler ve ekran okuyucu desteği (aria-live) içerir.
- **Ekranı Açık Tutma (Wake Lock):** Rehber kullanılırken telefon ekranının kapanmasını engeller.
- **Harem Dışı Uyarısı:** Kullanıcı Mescid-i Haram bölgesinden 2 km'den fazla uzaklaşırsa sesli olarak uyarır.

## ⚠️ Çevrimdışı Kullanım Hakkında

- **Sesli yönlendirme tamamen çevrimdışı çalışır** — GPS ve cihazın kendi özellikleri yeterlidir.
- **Harita görünümü internet gerektirir** — OpenStreetMap tile'ları çevrimiçi yüklenir.
- Konum izni, GPS sinyali ve harita tile'ları için internet bağlantısı önerilir.
- Kapalı alanlarda (bodrum, tünel vb.) GPS sinyali zayıflayabilir.

## 🚀 GitHub Pages ile Yayınlama

Uygulamayı yaşlı birinin telefonuna kurmak için internete yüklemeniz gerekir (Chrome yerel dosyalarda konum iznini engelleyebilir).

1. GitHub'da yeni ve **Public** bir depo oluşturun.
2. Bu kodu depoya yükleyin.
3. Depo ayarlarından **Settings > Pages** bölümüne gidin.
4. "Build and deployment" altında **Source: GitHub Actions** seçin.
5. `main` branch'ine push yaptığınızda GitHub Actions otomatik olarak testleri çalıştırır ve başarılı olursa deploy eder.
6. 1-2 dakika sonra `https://kullaniciadiniz.github.io/Umre-Dostum/` linkinden uygulamanıza erişebilirsiniz.

## 📱 Kurulum ve Kullanım (Yaşlılar İçin)

1. **İlk Kurulum (Yakını Tarafından Yapılmalı):**
   - Yaşlı kişinin telefonunda Chrome/Safari ile uygulama linkini açın.
   - Çıkan "Konumunuza erişmek istiyor" uyarısına **"İZİN VER"** deyin.
   - Tarayıcı menüsünden **"Ana ekrana ekle"** (Add to Home Screen) seçeneğine dokunun.
   - Artık ana ekranda normal bir uygulama simgesi gibi görünecektir.
2. **Kullanım:**
   - Dışarı çıkarken kapının önünde **Yeşil** düğmeye basıp kapıyı kaydedin.
   - Kaybolduğunuzda ana ekrandaki **Mavi** düğmeye basın, sesli komutları dinleyerek yürüyün.
   - **Kırmızı** düğme (YARDIM), kapı bilgilerini tam ekran göstererek çevredeki bir görevliye yardım için gösterilebilir.

## ⚠️ Önemli Notlar
- Uygulamanın doğru çalışması için telefonun **GPS (Konum)** ayarlarının açık olması şarttır.
- Kapalı alanlarda (bodrum, tünel vb.) GPS sinyali zayıflayabilir.
- Yön (bearing) hesaplaması kuzey referanslıdır; telefonunuzun pusulası yoksa "kuzeydoğu" gibi yön tarifleri kullanılır.

## 🛠️ Teknik Detaylar

- **Frontend:** TypeScript, Vite, saf HTML/CSS.
- **Harita:** Leaflet + OpenStreetMap (yalnızca harita görünümü için).
- **Test:** Vitest + jsdom + `@testing-library/dom`. %90+ satır kapsamı.
- **CI/CD:** GitHub Actions — test geçmeden deploy yok.
- **Bağımlılık:** Yalnızca `leaflet` (runtime), geri kalanı `devDependencies`.

## 🧪 Geliştirme

```bash
npm install
npm run dev          # geliştirme sunucusu
npm test             # testleri çalıştır
npm run test:coverage # kapsam raporu
npm run typecheck    # TS tip kontrolü
npm run build        # production build