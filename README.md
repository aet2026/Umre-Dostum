# 🚪 Kapı Rehberi (Kaybolmaya Karşı Yönlendirme Uygulaması)

Bu uygulama, özellikle **dijital okuryazarlığı olmayan yaşlılar, Alzheimer/demans hastaları veya kalabalık otellerde/stadyumlarda yönünü kaybeden kişiler** için tasarlanmış, tarayıcı tabanlı bir web uygulamasıdır. 

Kişi otelden veya evinden çıkarken giriş kapısının konumunu kaydeder. Dönüşte kaybolursa, tek bir mavi düğmeye basarak kendi konumundan giriş kapısına olan mesafeyi ve yönü sesli olarak dinleyebilir. **İnternet bağlantısı gerektirmez** (yalnızca GPS ve pusula kullanır), sunucuya hiçbir veri göndermez.

## ✨ Özellikler

- **Tek Dokunuşla Kayıt:** Giriş kapısının GPS konumunu tek düğmeyle hızlıca kaydeder (hatayı önlemek için çoklu GPS örneği kullanır).
- **Sesli ve Görsel Yönlendirme:** "Düz yürüyün", "Hafifçe sağa dönün", "Arkanıza dönün" gibi Türkçe sesli komutlar verir.
- **Kuşbakışı Harita:** İnternet gerektirmeyen, çizim tabanlı bir pusula/harita ekranı sunar. Yürünen yolu ve kapıya olan mesafeyi gösterir.
- **Yanlışlıkla Silme Koruması:** Kayıtlı kapıyı silmek için 3 saniye boyunca basılı tutmak gerekir (kazara silmeleri engeller).
- **Gizlilik Odaklı:** Konum verileri sunucuya gönderilmez, yalnızca telefonun kendi hafızasında (localStorage) saklanır.
- **Erişilebilirlik:** Devasa düğmeler, yüksek kontrastlı renkler ve ekran okuyucu desteği (aria-live) içerir.
- **Ekranı Açık Tutma (Wake Lock):** Rehber kullanılırken telefon ekranının kapanmasını engeller.

## 🚀 GitHub Pages ile Yayınlama

Uygulamayı yaşlı birinin telefonuna kurmak için internete yüklemeniz gerekir (Chrome yerel dosyalarda konum iznini engelleyebilir).

1. GitHub'da yeni ve **Public** bir depo (repository) oluşturun.
2. Bu koddaki `index.html` dosyasını depoya yükleyin.
3. Depo ayarlarından **Settings > Pages** bölümüne gidin.
4. "Build and deployment" altında **Source: Deploy from a branch**, **Branch: main**, **Folder: / (root)** seçip kaydedin.
5. 1-2 dakika sonra `https://kullaniciadiniz.github.io/kapi-rehberi/` linkinden uygulamanıza erişebilirsiniz.

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
- Pusula (yön) özelliği telefon modelinize göre hassasiyet gösterebilir. Telefonu 8 şeklinde sallayarak pusulanızı kalibre edebilirsiniz.

## 🛠️ Teknik Detaylar
- Saf **HTML, CSS ve JavaScript** ile yazılmıştır. Hiçbir harici kütüphane (framework) veya API anahtarı gerektirmez.
- Tek bir `.html` dosyasından oluşur, kolayca barındırılabilir.
