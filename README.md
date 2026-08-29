# Elif Erol Beauty — web sitesi + SEO otomasyonu

Bahçeşehir'deki **Elif Erol Güzellik Salonu** için hazırlanmış, bağımlılıksız statik web sitesi ve
Google/Bing için çalışan SEO otomasyon hattı. Görseller Higgsfield AI (`nano_banana_pro`) ile üretildi.

> Depodaki kök `index.html`, bu projeyle ilgisi olmayan ayrı bir demo dosyasıdır; siteye dâhil değildir.

## Hızlı başlangıç

```bash
npm run assets   # Higgsfield görsellerini src/assets/img/ altına indirir
npm run build    # dist/ klasörünü üretir
npm run audit    # teknik SEO denetimi çalıştırır
npm run dev      # üretip http://localhost:4173 adresinde önizler
```

Node 20+ yeterlidir; hiçbir npm paketi kurulmaz.

## Klasör yapısı

```
content/
  site.json          İşletme bilgileri (NAP, saatler, sosyal medya, marka renkleri) — tek doğruluk kaynağı
  services.mjs       Hizmet sayfalarının içeriği; diziye ekleme yapmak yeni sayfa üretmeye yeter
  media.json         Higgsfield görsel manifesti (yerel dosya + CDN yedeği + alt metni)
  blog/*.md          Güzellik Rehberi yazıları (front-matter + sade markdown)
src/
  theme.css          Tema; build sırasında küçültülüp HTML içine gömülür (tek istek, hızlı LCP)
  assets/img/        İndirilen görseller
scripts/
  build.mjs          Statik site üreticisi
  lib/render.mjs     Markdown, front-matter ve yardımcılar
  lib/layout.mjs     Ortak HTML iskeleti, meta etiketler, JSON-LD
  fetch-assets.mjs   Görselleri CDN'den indirir, gerçek boyutları manifeste yazar
  seo-audit.mjs      Teknik SEO denetimi (title/desc, H1, alt, canonical, JSON-LD, kırık bağlantı)
  indexnow.mjs       IndexNow ile Bing/Yandex bildirimi
  new-post.mjs       SEO alanları hazır yeni blog taslağı
  serve.mjs          Yerel önizleme sunucusu
dist/                Üretilen site (git'e dâhil değil)
```

## Üretilen sayfalar (17)

Ana sayfa · Hakkımızda · Hizmetler · 7 hizmet detay sayfası · Güzellik Rehberi + 4 yazı ·
Bize Ulaşın · Gizlilik & KVKK · 404. Ayrıca `sitemap.xml`, `robots.txt`, `rss.xml`,
`site.webmanifest` ve `CNAME`.

## SEO'da neler var

**Sayfa içi**
- Her sayfaya özgün `title`, `meta description`, `canonical`, `hreflang` (tr + x-default)
- Open Graph + Twitter Card, `og:image` olarak ilgili hizmet görseli
- Tek H1, anlamlı başlık hiyerarşisi, breadcrumb navigasyonu
- Yerel arama sinyalleri: `geo.region`, `geo.position`, ICBM, semt bazlı içerik
- Görsellerde alt metni + `width`/`height` (CLS yok), `loading="lazy"`, hero'da `fetchpriority="high"`
- CSS gömülü, JavaScript ~1 KB; harici yalnızca Google Fonts (gecikmeli yükleme)

**Yapısal veri (JSON-LD)**
- `BeautySalon`: adres, koordinat, çalışma saatleri, hizmet bölgeleri, `hasOfferCatalog`, `sameAs`
- Hizmet sayfalarında `Service`, blog yazılarında `BlogPosting`, listelerde `ItemList`/`Blog`
- Sık sorulan sorularda `FAQPage`, tüm alt sayfalarda `BreadcrumbList`
- `WebSite` + `AboutPage` + `ContactPage`

**Otomasyon**
- `scripts/seo-audit.mjs` her build'de 10'dan fazla kontrolü çalıştırır; hata bulursa CI'yı durdurur
- `.github/workflows/site-deploy.yml`: push → görselleri indir → üret → denet → GitHub Pages'e yayınla → IndexNow'a bildir
- `.github/workflows/seo-automation.yml`: her pazartesi denetim raporu üretir, arama motorlarına yeniden bildirim yapar, hata bulursa otomatik issue açar

## Yayına alma adımları

1. **GitHub Pages'i açın** — Settings → Pages → Source: *GitHub Actions*.
2. **Depo değişkenini ekleyin** — Settings → Secrets and variables → Actions → Variables →
   `ENABLE_PAGES = true`. (Bu değişken tanımlanmadan yayın adımı çalışmaz; depoyu yanlışlıkla
   yayına almamak için böyle kurgulandı.)
3. **Alan adını bağlayın** — `dist/CNAME` dosyası `content/site.json` içindeki `domain` alanından
   üretilir. DNS'te `A` kayıtlarını GitHub Pages IP'lerine, `www` için `CNAME` kaydını
   `<kullanıcı>.github.io` adresine yönlendirin.
4. **IndexNow anahtarı üretin:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
   ```
   Değeri `content/site.json` → `indexNowKey` alanına yazın (veya `INDEXNOW_KEY` secret'ı olarak
   ekleyin). Build, `https://eliferolbeauty.com/<anahtar>.txt` doğrulama dosyasını otomatik üretir.
5. **Google Search Console** — alan adını doğrulayın ve `https://eliferolbeauty.com/sitemap.xml`
   adresini bir kez gönderin. Google IndexNow'ı desteklemez; sitemap eklendikten sonra taramayı
   kendisi yürütür.
6. **Google Business Profile** — sitedeki ad, adres ve telefon (NAP) ile birebir aynı olmalı.
   Yerel SEO'nun en güçlü sinyali budur; `content/site.json` ile işletme profilini eşitleyin.

Statik çıktı olduğu için Netlify, Vercel, Cloudflare Pages veya klasik bir hosting'e de
`dist/` klasörünü yükleyerek yayınlayabilirsiniz.

## Sık yapılan işler

**Yeni blog yazısı**
```bash
npm run new:post -- "Kalıcı Oje Nasıl Uzun Ömürlü Olur" \
  --keywords "kalıcı oje bakımı, kalıcı oje ne kadar dayanır" \
  --image kalici-oje --category "El & Ayak Bakımı"
npm run build && npm run audit
```
Push ettiğinizde site yeniden yayınlanır ve yeni adres IndexNow üzerinden bildirilir.

**Yeni hizmet sayfası** — `content/services.mjs` dizisine yeni bir nesne ekleyin. Sayfa, menü
girişi, sitemap kaydı, `Service` ve `FAQPage` şemaları otomatik üretilir.

**Telefon, adres, saat değişikliği** — yalnızca `content/site.json`. Tüm sayfalar, footer, JSON-LD
ve iletişim sayfası tek kaynaktan beslenir.

**Görselleri yenilemek** — `content/media.json` içindeki `remote` adresini değiştirip
`npm run assets -- --force` çalıştırın.

## Bilinmesi gerekenler

- **Görseller yapay zekâ ile üretildi.** Tanıtım için gerçek salon ve uygulama fotoğraflarınızla
  değiştirmeniz hem güven hem de yerel SEO açısından daha iyi sonuç verir. Dosyaları
  `src/assets/img/` altında aynı adla değiştirmeniz yeterli.
- **`aggregateRating` şeması.** `content/site.json` içindeki Google puanı JSON-LD'ye yazılıyor.
  Google, işletmenin kendi sitesinde yayımladığı puanları zengin sonuç için genellikle
  değerlendirmez; sorun yaşamak istemezseniz `scripts/lib/layout.mjs` içindeki `aggregateRating`
  bloğunu kaldırabilirsiniz. Görünen yorum bölümü etkilenmez.
- **KVKK metni** genel bir taslaktır; yayına almadan önce hukuk danışmanınıza gözden geçirtin.
- **Fiyat bilgisi yok.** Sayfalarda uydurma fiyat bulunmaz; fiyat soruları telefona yönlendirilir.
  Fiyat yayınlamak isterseniz `services.mjs` içindeki `faq` alanlarını güncelleyin.
