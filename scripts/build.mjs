#!/usr/bin/env node
/**
 * Elif Erol Beauty — statik site üreticisi.
 * Bağımlılık yok; `node scripts/build.mjs` çalıştırıldığında dist/ klasörünü baştan üretir:
 * sayfalar, sitemap.xml, robots.txt, rss.xml, webmanifest ve varlıklar.
 */
import { readFile, writeFile, mkdir, readdir, rm, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { esc, attr, markdown, frontmatter, slugify, readCss, createHelpers } from "./lib/render.mjs";
import { createLayout } from "./lib/layout.mjs";
import { services } from "../content/services.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const assetDir = path.join(root, "src/assets/img");

const site = JSON.parse(await readFile(path.join(root, "content/site.json"), "utf8"));
const media = JSON.parse(await readFile(path.join(root, "content/media.json"), "utf8"));
const css = await readCss(path.join(root, "src/theme.css"));
const helpers = createHelpers({ site, media, localAssetDir: assetDir });
const { picture, imgAbs, url, waLink } = helpers;
const layout = createLayout({ site, css, helpers, services });

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const tel = `tel:${site.phone}`;
const pages = []; // sitemap için toplanır

/** Sayfayı diske yazar ve sitemap kaydını tutar. */
async function emit(page, { priority = 0.7, changefreq = "monthly", lastmod = new Date().toISOString().slice(0, 10) } = {}) {
  const file = page.path === "/" ? "index.html" : path.join(page.path.replace(/^\/|\/$/g, ""), "index.html");
  const dest = path.join(dist, file);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, layout(page));
  if (!page.noindex) pages.push({ path: page.path, priority, changefreq, lastmod, image: imgAbs(page.image || "salon"), title: page.h1 });
}

/* ---------- Yeniden kullanılan bloklar ---------- */

const ctaBand = (heading = "Randevunuzu bugün ayırtın", text = "Uygun saatleri öğrenmek ve size en uygun uygulamayı birlikte belirlemek için bir telefon yeterli.") => `
<section class="section"><div class="wrap"><div class="cta">
  <h2>${esc(heading)}</h2>
  <p>${esc(text)}</p>
  <div class="btn-row">
    <a class="btn btn--primary" href="${tel}">${esc(site.phoneDisplay)}</a>
    <a class="btn btn--wa" href="${waLink()}" target="_blank" rel="noopener">WhatsApp'tan yazın</a>
  </div>
</div></div></section>`;

const faqBlock = (faq) => faq.length ? `
<section class="section section--alt"><div class="wrap">
  <p class="eyebrow">Sık sorulan sorular</p>
  <h2>Merak edilenler</h2>
  <div style="max-width:78ch;margin-top:2rem">
  ${faq.map((f) => `<details class="faq"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("\n  ")}
  </div>
</div></section>` : "";

const faqSchema = (faq) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({
    "@type": "Question", name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

const pageHead = (crumbs, h1, lead) => `
<section class="page-head"><div class="wrap">
  <ol class="crumbs">${crumbs.map((c, i) =>
    i === crumbs.length - 1 ? `<li>${esc(c.label)}</li>` : `<li><a href="${c.href}">${esc(c.label)}</a></li>`).join("")}</ol>
  <h1>${esc(h1)}</h1>
  ${lead ? `<p class="lead">${esc(lead)}</p>` : ""}
</div></section>`;

const serviceCard = (s) => `
<article class="card">
  <a href="/hizmetler/${s.slug}/" aria-label="${attr(s.h1)} sayfasına git">${picture(s.image, { alt: s.imageAlt, sizes: "(max-width:900px) 100vw, 360px" })}</a>
  <div class="card__body">
    <h3><a href="/hizmetler/${s.slug}/" style="color:inherit;text-decoration:none">${esc(s.nav)}</a></h3>
    <p>${esc(s.excerpt)}</p>
    <p class="card__more"><a href="/hizmetler/${s.slug}/">Detayları görün →</a></p>
  </div>
</article>`;

/* ---------- Ana sayfa ---------- */

const reviews = [
  { author: "Ezgi Su T.", text: "Elif Hanım ve çalışanlarına güler yüzleri için çok teşekkür ederim. Lazer epilasyonda ve tırnakta çok özenli, harika bir iş çıkarıyorlar.", source: "Google" },
  { author: "Elmas A. D.", text: "Elif Hanım ve tüm çalışanlar güler yüzlü; onların sayesinde artık tırnaklarımı çok seviyorum. Herkese tavsiye ederim.", source: "Google" },
  { author: "Elif S.", text: "İşlerini özenle yapan, güler yüzlü bir ekip. Her gittiğimde mutlu çıkıyorum.", source: "Google" },
];

const homeFaq = [
  { q: "Elif Erol Beauty nerede?", a: `Bahçeşehir 1. Kısım Mahallesi, Sakarya Caddesi No:36/I adresindeyiz (File Market üstü), Başakşehir/İstanbul. Bahçeşehir 2. Kısım, Ispartakule ve Hoşdere'den birkaç dakika uzaklıktayız.` },
  { q: "Randevu nasıl alınır?", a: "0538 795 08 23 numaralı telefondan arayabilir ya da aynı numaraya WhatsApp'tan yazabilirsiniz. Instagram DM üzerinden de randevu oluşturuyoruz." },
  { q: "Hangi hizmetleri sunuyorsunuz?", a: "Protez tırnak, manikür-pedikür, kalıcı oje ve nail art, lazer epilasyon, cilt bakımı (Hydrafacial ve Kore cilt bakımı), kirpik & kaş uygulamaları, saç bakımı ve EMS vücut şekillendirme." },
  { q: "Çalışma saatleriniz nedir?", a: "Pazartesi–Cumartesi 09:30–20:00, Pazar 11:00–18:00 saatleri arasında hizmet veriyoruz." },
  { q: "Erkek danışan kabul ediyor musunuz?", a: "Evet. Lazer epilasyon başta olmak üzere erkek uygulamaları için ayrı seans saatlerimiz bulunuyor." },
];

const homeBody = `
<section class="hero">
  ${picture("salon", { alt: media.images.salon.alt, loading: "eager", fetchpriority: "high", sizes: "100vw" })}
  <div class="wrap">
    <p class="eyebrow">Bahçeşehir · Başakşehir · İstanbul</p>
    <h1>Bahçeşehir'de bakımın adresi: Elif Erol Beauty</h1>
    <p class="lead">Protez tırnaktan lazer epilasyona, cilt bakımından kirpik &amp; kaş uygulamalarına kadar
    ihtiyacınız olan her şey tek çatı altında. Deneyimli ekip, steril ortam ve size özel planlanan uygulamalar.</p>
    <div class="btn-row">
      <a class="btn btn--primary" href="${tel}">Hemen randevu alın</a>
      <a class="btn btn--wa" href="${waLink()}" target="_blank" rel="noopener">WhatsApp</a>
    </div>
    <ul class="badges">
      <li>★ ${esc(site.rating.value)} / 5 · ${esc(site.rating.count)}+ Google yorumu</li>
      <li>Tek kullanımlık &amp; steril ekipman</li>
      <li>7 gün açık</li>
    </ul>
  </div>
</section>

<section class="section"><div class="wrap center">
  <p class="eyebrow">Hizmetlerimiz</p>
  <h2>Size en çok yakışanı birlikte seçelim</h2>
  <p class="lead">Her uygulama kısa bir analizle başlar. Cilt tipiniz, tırnak yapınız ve beklentiniz doğrultusunda
  yönlendirme yapar, gerekmeyen hiçbir işlemi önermeyiz.</p>
</div>
<div class="wrap" style="margin-top:2.6rem"><div class="grid grid--3">
  ${services.map(serviceCard).join("\n")}
</div></div></section>

<section class="section section--alt"><div class="wrap">
  <div class="split">
    <div>
      <p class="eyebrow">Neden Elif Erol Beauty?</p>
      <h2>Bir salondan fazlası</h2>
      <ul class="checklist">
        <li><strong>Hijyen tavizsiz.</strong> Her danışan için tek kullanımlık törpü, zımpara ve steril edilmiş metal ekipman.</li>
        <li><strong>Analizle başlayan uygulama.</strong> Cilt ve tırnak analizi yapılmadan işleme başlanmaz.</li>
        <li><strong>Güncel teknoloji.</strong> Buz başlıklı diode lazer, Hydrafacial ve G10-EMS cihazları.</li>
        <li><strong>Şeffaf bilgilendirme.</strong> Uygulama süresi, kalıcılık ve bakım önerileri işlem öncesi net anlatılır.</li>
        <li><strong>Randevu esnekliği.</strong> Hafta içi akşam ve pazar günü randevu imkânı.</li>
      </ul>
      <div class="btn-row"><a class="btn btn--ghost" href="/hakkimizda/">Ekibimizi tanıyın</a></div>
    </div>
    ${picture("cilt-bakimi", { alt: "Elif Erol Beauty'de cilt bakımı uygulaması" })}
  </div>
</div></section>

<section class="section"><div class="wrap">
  <div class="center">
    <p class="eyebrow">Danışan yorumları</p>
    <h2>Google'da ${esc(site.rating.value)} puan</h2>
    <p><span class="rating-badge"><strong>★ ${esc(site.rating.value)}</strong> ${esc(site.rating.count)}+ değerlendirme</span></p>
  </div>
  <div class="grid grid--3" style="margin-top:2.4rem">
    ${reviews.map((r) => `<figure class="review" style="margin:0">
      <div class="stars" aria-label="5 üzerinden 5">★★★★★</div>
      <blockquote>“${esc(r.text)}”</blockquote>
      <figcaption><cite>${esc(r.author)}</cite> · ${esc(r.source)}</figcaption>
    </figure>`).join("\n    ")}
  </div>
</div></section>

<section class="section section--alt"><div class="wrap">
  <div class="split">
    <div>
      <p class="eyebrow">Bize ulaşın</p>
      <h2>Bahçeşehir 1. Kısım'dayız</h2>
      <p class="lead">Sakarya Caddesi üzerinde, File Market'in üst katındayız. Bahçeşehir 2. Kısım, Ispartakule,
      Hoşdere ve Kayaşehir'den kolay ulaşım.</p>
      <ul class="info-list">
        <li><span aria-hidden="true">📍</span><span><strong>Adres</strong>${esc(site.address.street)}, ${esc(site.address.postalCode)} ${esc(site.address.district)}/${esc(site.address.city)}</span></li>
        <li><span aria-hidden="true">📞</span><span><strong>Telefon</strong><a href="${tel}">${esc(site.phoneDisplay)}</a> · <a href="tel:${site.phoneAlt}">${esc(site.phoneAltDisplay)}</a></span></li>
        <li><span aria-hidden="true">🕘</span><span><strong>Çalışma saatleri</strong>${site.hours.map((h) => `${esc(h.label)}: ${esc(h.time)}`).join("<br>")}</span></li>
      </ul>
      <div class="btn-row"><a class="btn btn--primary" href="/bize-ulasin/">Yol tarifi ve iletişim</a></div>
    </div>
    <iframe class="map" src="${site.mapsEmbed}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Elif Erol Beauty konumu — Google Haritalar"></iframe>
  </div>
</div></section>

${faqBlock(homeFaq)}
${ctaBand()}
`;

await emit({
  path: "/",
  title: `Bahçeşehir Güzellik Merkezi | ${site.name}`,
  description: site.description,
  keywords: ["bahçeşehir güzellik merkezi", "bahçeşehir güzellik salonu", "başakşehir güzellik merkezi", "elif erol beauty", "bahçeşehir protez tırnak", "bahçeşehir lazer epilasyon"],
  h1: "Bahçeşehir'de bakımın adresi: Elif Erol Beauty",
  image: "salon",
  crumbs: [{ href: "/", label: "Ana Sayfa" }],
  schemas: [
    faqSchema(homeFaq),
    {
      "@context": "https://schema.org", "@type": "WebSite",
      "@id": url("/#website"), name: site.name, url: url("/"), inLanguage: "tr-TR",
      publisher: { "@id": url("/#business") },
    },
  ],
  body: homeBody,
}, { priority: 1.0, changefreq: "weekly" });

/* ---------- Hizmetler listesi ---------- */

await emit({
  path: "/hizmetler/",
  title: `Hizmetlerimiz | Bahçeşehir Güzellik Merkezi — ${site.name}`,
  description: "Protez tırnak, manikür-pedikür, lazer epilasyon, cilt bakımı, kirpik & kaş, saç bakımı ve EMS. Bahçeşehir'deki tüm güzellik hizmetlerimiz tek sayfada.",
  keywords: ["bahçeşehir güzellik hizmetleri", "bahçeşehir güzellik merkezi hizmetleri"],
  h1: "Hizmetlerimiz",
  image: "salon",
  crumbs: [{ href: "/", label: "Ana Sayfa" }, { href: "/hizmetler/", label: "Hizmetlerimiz" }],
  schemas: [{
    "@context": "https://schema.org", "@type": "ItemList",
    itemListElement: services.map((s, i) => ({
      "@type": "ListItem", position: i + 1, name: s.h1, url: url(`/hizmetler/${s.slug}/`),
    })),
  }],
  body: `
${pageHead(
  [{ href: "/", label: "Ana Sayfa" }, { href: "/hizmetler/", label: "Hizmetlerimiz" }],
  "Hizmetlerimiz",
  "El ve ayak bakımından cilt bakımına, lazer epilasyondan vücut şekillendirmeye kadar tüm uygulamalarımız. Her hizmetin detay sayfasında süre, kalıcılık ve bakım bilgilerini bulabilirsiniz."
)}
<section class="section"><div class="wrap"><div class="grid grid--3">
  ${services.map(serviceCard).join("\n")}
</div></div></section>
${ctaBand("Hangi uygulamanın size uygun olduğundan emin değil misiniz?", "Kısa bir görüşmeyle ihtiyacınızı birlikte belirleyelim; gerekmeyen hiçbir işlemi önermiyoruz.")}
`,
}, { priority: 0.9, changefreq: "monthly" });

/* ---------- Hizmet detay sayfaları ---------- */

for (const s of services) {
  const crumbs = [
    { href: "/", label: "Ana Sayfa" },
    { href: "/hizmetler/", label: "Hizmetlerimiz" },
    { href: `/hizmetler/${s.slug}/`, label: s.nav },
  ];
  const others = services.filter((x) => x.slug !== s.slug).slice(0, 3);

  await emit({
    path: `/hizmetler/${s.slug}/`,
    title: s.title,
    description: s.description,
    keywords: s.keywords,
    h1: s.h1,
    image: s.image,
    crumbs,
    schemas: [
      {
        "@context": "https://schema.org", "@type": "Service",
        name: s.h1, description: s.description, serviceType: s.nav,
        url: url(`/hizmetler/${s.slug}/`), image: imgAbs(s.image),
        provider: { "@id": url("/#business") },
        areaServed: site.areaServed.map((a) => ({ "@type": "Place", name: a })),
        audience: { "@type": "Audience", audienceType: "Kadın ve erkek danışanlar" },
      },
      faqSchema(s.faq),
    ],
    body: `
${pageHead(crumbs, s.h1, s.excerpt)}
<section class="section"><div class="wrap"><div class="split">
  <div class="prose">
    <p class="lead">${esc(s.intro)}</p>
    <ul class="checklist">${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
    <div class="btn-row">
      <a class="btn btn--primary" href="${tel}">Randevu alın</a>
      <a class="btn btn--wa" href="${waLink()}" target="_blank" rel="noopener">WhatsApp'tan sorun</a>
    </div>
  </div>
  ${picture(s.image, { alt: s.imageAlt })}
</div></div></section>

<section class="section section--alt"><div class="wrap prose">
  ${s.sections.map((sec) => `<h2 id="${slugify(sec.h2)}">${esc(sec.h2)}</h2><p>${esc(sec.body)}</p>`).join("\n  ")}
</div></section>

${faqBlock(s.faq)}

<section class="section"><div class="wrap">
  <p class="eyebrow">Diğer hizmetler</p>
  <h2>Bunlar da ilginizi çekebilir</h2>
  <div class="grid grid--3" style="margin-top:2rem">${others.map(serviceCard).join("\n")}</div>
</div></section>
${ctaBand()}
`,
  }, { priority: 0.9, changefreq: "monthly" });
}

/* ---------- Hakkımızda ---------- */

const aboutCrumbs = [{ href: "/", label: "Ana Sayfa" }, { href: "/hakkimizda/", label: "Hakkımızda" }];
await emit({
  path: "/hakkimizda/",
  title: `Hakkımızda | ${site.name} Bahçeşehir Güzellik Merkezi`,
  description: "Bahçeşehir'de güzellik trendlerini yakından takip eden deneyimli bir ekip. Elif Erol Beauty'nin hikâyesi, çalışma prensipleri ve hijyen yaklaşımı.",
  keywords: ["elif erol beauty hakkında", "bahçeşehir güzellik merkezi ekibi"],
  h1: "Hakkımızda",
  image: "salon",
  crumbs: aboutCrumbs,
  schemas: [{
    "@context": "https://schema.org", "@type": "AboutPage",
    name: "Hakkımızda", url: url("/hakkimizda/"), mainEntity: { "@id": url("/#business") },
  }],
  body: `
${pageHead(aboutCrumbs, "Hakkımızda", "Güzellik trendlerini yakından takip eden, işini özenle yapan bir ekip.")}
<section class="section"><div class="wrap"><div class="split">
  <div class="prose">
    <h2>Bahçeşehir'de bakımın buluşma noktası</h2>
    <p>Elif Erol Beauty, Bahçeşehir 1. Kısım'da güzellik ve bakımın tüm ihtiyaçlarını tek çatı altında topluyor.
    Kurucumuz Elif Erol'un yönetiminde, alanında eğitim almış bir ekiple çalışıyoruz. Amacımız, danışanlarımızın
    salonumuzdan yalnızca bakımlı değil, kendini iyi hissederek ayrılması.</p>
    <p>Uygulamalarımızda kullandığımız ürün ve cihazları özenle seçiyor, ekibimizin eğitimini düzenli olarak
    güncelliyoruz. Trendleri takip ediyoruz; ancak her trendi herkese önermiyoruz. Size ne yakışacağını,
    tırnak ve cilt yapınızın neyi kaldırabileceğini birlikte konuşuyoruz.</p>
    <h2>Çalışma prensiplerimiz</h2>
    <ul class="checklist">
      <li><strong>Hijyen pazarlık konusu değildir.</strong> Metal ekipman her kullanımdan sonra sterilize edilir, törpü ve zımpara tek kullanımlıktır.</li>
      <li><strong>Gereksiz işlem önermeyiz.</strong> Analiz sonucunda ihtiyacınız olmayan bir uygulamayı satmayı doğru bulmuyoruz.</li>
      <li><strong>Süreyi doğru söyleriz.</strong> Randevunuzun ne kadar süreceğini önceden bilirsiniz.</li>
      <li><strong>Bakım önerimizi yazılı veririz.</strong> Uygulama sonrası ne yapmanız gerektiğini net anlatırız.</li>
    </ul>
  </div>
  ${picture("kirpik-kas", { alt: "Elif Erol Beauty'de kirpik uygulaması detayı" })}
</div></div></section>

<section class="section section--alt"><div class="wrap">
  <div class="center"><p class="eyebrow">Rakamlarla</p><h2>Bugüne kadar</h2></div>
  <div class="grid grid--4" style="margin-top:2.4rem">
    <div class="tile"><span class="ico">★</span><h3>${esc(site.rating.value)} puan</h3><p>Google'da ${esc(site.rating.count)}+ değerlendirme ortalaması.</p></div>
    <div class="tile"><span class="ico">👥</span><h3>${esc(site.instagramHandle)}</h3><p>Instagram'da 6.900+ takipçiyle işlerimizi paylaşıyoruz.</p></div>
    <div class="tile"><span class="ico">💼</span><h3>${services.length} hizmet grubu</h3><p>El-ayak, cilt, kirpik-kaş, saç, epilasyon ve vücut.</p></div>
    <div class="tile"><span class="ico">🗓️</span><h3>7 gün</h3><p>Pazar dâhil her gün randevu imkânı.</p></div>
  </div>
</div></section>
${ctaBand("Tanışmaya ne dersiniz?", "İlk randevunuzda kısa bir analizle başlıyoruz; ihtiyacınızı birlikte belirleyip planı çıkarıyoruz.")}
`,
}, { priority: 0.7 });

/* ---------- Bize ulaşın ---------- */

const contactCrumbs = [{ href: "/", label: "Ana Sayfa" }, { href: "/bize-ulasin/", label: "Bize Ulaşın" }];
await emit({
  path: "/bize-ulasin/",
  title: `Bize Ulaşın | ${site.name} — Bahçeşehir Sakarya Caddesi`,
  description: `${site.name} adres, telefon ve çalışma saatleri. Bahçeşehir 1. Kısım Sakarya Caddesi No:36/I, Başakşehir/İstanbul. Randevu: ${site.phoneDisplay}.`,
  keywords: ["elif erol beauty iletişim", "bahçeşehir güzellik salonu adres", "bahçeşehir güzellik merkezi telefon"],
  h1: "Bize Ulaşın",
  image: "salon",
  crumbs: contactCrumbs,
  schemas: [{
    "@context": "https://schema.org", "@type": "ContactPage",
    name: "Bize Ulaşın", url: url("/bize-ulasin/"), mainEntity: { "@id": url("/#business") },
  }],
  body: `
${pageHead(contactCrumbs, "Bize Ulaşın", "Randevu ve bilgi için telefon, WhatsApp veya Instagram üzerinden bize yazabilirsiniz.")}
<section class="section"><div class="wrap"><div class="split">
  <div>
    <h2>İletişim bilgileri</h2>
    <ul class="info-list">
      <li><span aria-hidden="true">📍</span><span><strong>Adres</strong>${esc(site.address.street)}<br>${esc(site.address.postalCode)} ${esc(site.address.district)}/${esc(site.address.city)}</span></li>
      <li><span aria-hidden="true">📞</span><span><strong>Telefon</strong><a href="${tel}">${esc(site.phoneDisplay)}</a></span></li>
      <li><span aria-hidden="true">💬</span><span><strong>WhatsApp</strong><a href="${waLink()}" target="_blank" rel="noopener">${esc(site.phoneDisplay)}</a></span></li>
      <li><span aria-hidden="true">📱</span><span><strong>İkinci hat</strong><a href="tel:${site.phoneAlt}">${esc(site.phoneAltDisplay)}</a></span></li>
      <li><span aria-hidden="true">✉️</span><span><strong>E-posta</strong><a href="mailto:${site.email}">${esc(site.email)}</a></span></li>
      <li><span aria-hidden="true">📸</span><span><strong>Instagram</strong><a href="${site.social.instagram}" rel="noopener">@${esc(site.instagramHandle)}</a></span></li>
    </ul>
    <h2 style="margin-top:2.4rem">Çalışma saatleri</h2>
    <table class="hours"><tbody>
      ${site.hours.map((h) => `<tr><th scope="row">${esc(h.label)}</th><td>${esc(h.time)}</td></tr>`).join("")}
    </tbody></table>
    <div class="btn-row">
      <a class="btn btn--primary" href="${tel}">Hemen arayın</a>
      <a class="btn btn--ghost" href="${site.mapsUrl}" target="_blank" rel="noopener">Yol tarifi alın</a>
    </div>
  </div>
  <div>
    <iframe class="map" style="height:520px" src="${site.mapsEmbed}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Elif Erol Beauty konumu — Google Haritalar"></iframe>
  </div>
</div></div></section>

<section class="section section--alt"><div class="wrap">
  <p class="eyebrow">Ulaşım</p>
  <h2>Nasıl gelinir?</h2>
  <div class="grid grid--3" style="margin-top:2rem">
    <div class="tile"><span class="ico">🚗</span><h3>Özel araçla</h3><p>Sakarya Caddesi üzerinde File Market'in üst katındayız. Cadde üzerinde ve yan sokaklarda park imkânı bulunur.</p></div>
    <div class="tile"><span class="ico">🚌</span><h3>Toplu taşıma</h3><p>Bahçeşehir 1. Kısım duraklarına yürüme mesafesindeyiz; Ispartakule ve Hoşdere yönünden minibüslerle kolay ulaşım.</p></div>
    <div class="tile"><span class="ico">📍</span><h3>Çevre semtler</h3><p>${esc(site.areaServed.join(", "))} bölgelerinden danışanlarımıza hizmet veriyoruz.</p></div>
  </div>
</div></section>
`,
}, { priority: 0.8 });

/* ---------- Blog ---------- */

const blogDir = path.join(root, "content/blog");
const postFiles = existsSync(blogDir) ? (await readdir(blogDir)).filter((f) => f.endsWith(".md")) : [];
const posts = [];

for (const file of postFiles) {
  const raw = await readFile(path.join(blogDir, file), "utf8");
  const { data, body } = frontmatter(raw);
  const slug = data.slug || file.replace(/\.md$/, "");
  posts.push({
    slug, ...data,
    keywords: Array.isArray(data.keywords) ? data.keywords : (data.keywords ? [data.keywords] : []),
    html: markdown(body),
    words: body.split(/\s+/).length,
  });
}
posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));

const trFmt = (d) => new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

for (const post of posts) {
  const crumbs = [
    { href: "/", label: "Ana Sayfa" },
    { href: "/blog/", label: "Güzellik Rehberi" },
    { href: `/blog/${post.slug}/`, label: post.title },
  ];
  const related = posts.filter((p) => p.slug !== post.slug).slice(0, 3);

  await emit({
    path: `/blog/${post.slug}/`,
    title: post.metaTitle || post.title,
    ogTitle: post.title,
    description: post.description,
    keywords: post.keywords,
    h1: post.title,
    image: post.image || "salon",
    ogType: "article",
    crumbs,
    schemas: [{
      "@context": "https://schema.org", "@type": "BlogPosting",
      headline: post.title, description: post.description,
      image: imgAbs(post.image || "salon"),
      datePublished: post.date, dateModified: post.updated || post.date,
      inLanguage: "tr-TR",
      mainEntityOfPage: { "@type": "WebPage", "@id": url(`/blog/${post.slug}/`) },
      author: { "@type": "Organization", name: site.legalName, url: url("/") },
      publisher: { "@id": url("/#business") },
      wordCount: post.words,
    }],
    body: `
${pageHead(crumbs, post.title, post.description)}
<section class="section"><div class="wrap">
  <article class="prose post-body">
    <p class="post-meta">${esc(trFmt(post.date))}${post.updated ? ` · Güncelleme: ${esc(trFmt(post.updated))}` : ""} · ${esc(post.category || "Güzellik Rehberi")}</p>
    ${picture(post.image || "salon", { alt: post.imageAlt || post.title, sizes: "(max-width:900px) 100vw, 720px" })}
    ${post.html}
    <div class="btn-row">
      <a class="btn btn--primary" href="${tel}">Randevu alın</a>
      <a class="btn btn--ghost" href="/hizmetler/">Hizmetlerimize göz atın</a>
    </div>
  </article>
</div></section>
${related.length ? `<section class="section section--alt"><div class="wrap">
  <h2>Diğer yazılar</h2>
  <div class="grid grid--3" style="margin-top:2rem">${related.map((p) => `
    <article class="card"><a href="/blog/${p.slug}/">${picture(p.image || "salon", { alt: p.imageAlt || p.title, sizes: "360px" })}</a>
      <div class="card__body"><h3><a href="/blog/${p.slug}/" style="color:inherit;text-decoration:none">${esc(p.title)}</a></h3>
      <p>${esc(p.description)}</p></div></article>`).join("")}</div>
</div></section>` : ""}
${ctaBand()}
`,
  }, { priority: 0.6, changefreq: "yearly", lastmod: String(post.updated || post.date).slice(0, 10) });
}

const blogCrumbs = [{ href: "/", label: "Ana Sayfa" }, { href: "/blog/", label: "Güzellik Rehberi" }];
await emit({
  path: "/blog/",
  title: `Güzellik Rehberi | ${site.name} Blog`,
  description: "Protez tırnak bakımı, lazer epilasyon süreci, cilt bakımı rutinleri ve daha fazlası. Elif Erol Beauty uzmanlarından pratik güzellik rehberi.",
  keywords: ["güzellik blogu", "protez tırnak bakımı", "lazer epilasyon rehberi", "cilt bakımı önerileri"],
  h1: "Güzellik Rehberi",
  image: "salon",
  crumbs: blogCrumbs,
  schemas: [{
    "@context": "https://schema.org", "@type": "Blog",
    name: `${site.name} — Güzellik Rehberi`, url: url("/blog/"), inLanguage: "tr-TR",
    publisher: { "@id": url("/#business") },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting", headline: p.title, url: url(`/blog/${p.slug}/`), datePublished: p.date,
    })),
  }],
  body: `
${pageHead(blogCrumbs, "Güzellik Rehberi", "Uygulamalarımızla ilgili merak ettikleriniz, bakım önerileri ve salondan pratik bilgiler.")}
<section class="section"><div class="wrap"><div class="grid grid--3">
  ${posts.map((p) => `<article class="card">
    <a href="/blog/${p.slug}/">${picture(p.image || "salon", { alt: p.imageAlt || p.title, sizes: "360px" })}</a>
    <div class="card__body">
      <p class="post-meta" style="margin:0 0 .4rem">${esc(trFmt(p.date))}</p>
      <h3><a href="/blog/${p.slug}/" style="color:inherit;text-decoration:none">${esc(p.title)}</a></h3>
      <p>${esc(p.description)}</p>
      <p class="card__more"><a href="/blog/${p.slug}/">Yazıyı okuyun →</a></p>
    </div></article>`).join("\n  ")}
</div></div></section>
${ctaBand()}
`,
}, { priority: 0.8, changefreq: "weekly" });

/* ---------- Gizlilik & KVKK ---------- */

const privCrumbs = [{ href: "/", label: "Ana Sayfa" }, { href: "/gizlilik-politikasi/", label: "Gizlilik & KVKK" }];
await emit({
  path: "/gizlilik-politikasi/",
  title: `Gizlilik Politikası ve KVKK Aydınlatma Metni | ${site.name}`,
  description: "Elif Erol Beauty kişisel verilerin korunması, çerez kullanımı ve gizlilik politikası hakkında bilgilendirme metni.",
  h1: "Gizlilik Politikası ve KVKK Aydınlatma Metni",
  image: "salon",
  crumbs: privCrumbs,
  body: `
${pageHead(privCrumbs, "Gizlilik Politikası ve KVKK Aydınlatma Metni")}
<section class="section"><div class="wrap prose">
  <h2>Veri sorumlusu</h2>
  <p>${esc(site.legalName)} (“${esc(site.name)}”), ${esc(site.address.street)}, ${esc(site.address.district)}/${esc(site.address.city)} adresinde faaliyet göstermektedir. 6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) kapsamında veri sorumlusu sıfatını taşır.</p>
  <h2>İşlenen veriler ve amaçları</h2>
  <ul class="checklist">
    <li>Ad, soyad ve telefon numarası — randevu oluşturmak ve hatırlatmak amacıyla.</li>
    <li>Uygulama geçmişi ve cilt/tırnak analiz notları — hizmet kalitesini sürdürmek amacıyla.</li>
    <li>İzin verdiğiniz takdirde uygulama öncesi/sonrası fotoğraflar — süreç takibi ve (ayrıca onay alınırsa) tanıtım amacıyla.</li>
  </ul>
  <h2>Verilerin aktarımı</h2>
  <p>Kişisel verileriniz, yasal yükümlülükler dışında üçüncü kişilerle paylaşılmaz; pazarlama amacıyla satılmaz veya devredilmez.</p>
  <h2>Çerezler</h2>
  <p>Bu web sitesi, ziyaret istatistiklerini ölçmek amacıyla çerez kullanabilir. Tarayıcı ayarlarınızdan çerezleri dilediğiniz zaman engelleyebilirsiniz. Sitede yer alan harita alanı Google tarafından sağlanmaktadır ve kendi çerez politikasına tabidir.</p>
  <h2>Haklarınız</h2>
  <p>KVKK'nın 11. maddesi uyarınca verilerinize erişme, düzeltilmesini veya silinmesini isteme haklarına sahipsiniz. Taleplerinizi <a href="mailto:${site.email}">${esc(site.email)}</a> adresine iletebilirsiniz.</p>
  <p><em>Bu metin genel bilgilendirme amaçlıdır; yayına almadan önce hukuk danışmanınızla gözden geçirmeniz önerilir.</em></p>
</div></section>
`,
}, { priority: 0.3, changefreq: "yearly" });

/* ---------- 404 ---------- */

await writeFile(path.join(dist, "404.html"), layout({
  path: "/404.html",
  noindex: true,
  title: `Sayfa bulunamadı | ${site.name}`,
  description: "Aradığınız sayfa taşınmış veya kaldırılmış olabilir. Elif Erol Beauty Bahçeşehir'in hizmet sayfalarına ve iletişim bilgilerine buradan ulaşabilirsiniz.",
  h1: "Sayfa bulunamadı",
  image: "salon",
  crumbs: [{ href: "/", label: "Ana Sayfa" }],
  body: `
<section class="section center"><div class="wrap">
  <p class="eyebrow">404</p>
  <h1>Aradığınız sayfayı bulamadık</h1>
  <p class="lead">Bağlantı değişmiş olabilir. Aşağıdan devam edebilir ya da doğrudan bizi arayabilirsiniz.</p>
  <div class="btn-row" style="justify-content:center">
    <a class="btn btn--primary" href="/">Ana sayfaya dön</a>
    <a class="btn btn--ghost" href="/hizmetler/">Hizmetlerimiz</a>
    <a class="btn btn--ghost" href="${tel}">${esc(site.phoneDisplay)}</a>
  </div>
</div></section>`,
}));

/* ---------- sitemap / robots / rss / manifest ---------- */

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${pages.map((p) => `  <url>
    <loc>${url(p.path)}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority.toFixed(1)}</priority>
    <image:image><image:loc>${p.image}</image:loc><image:title>${esc(p.title || site.name)}</image:title></image:image>
  </url>`).join("\n")}
</urlset>
`;
await writeFile(path.join(dist, "sitemap.xml"), sitemap);

await writeFile(path.join(dist, "robots.txt"), `# ${site.name}
User-agent: *
Allow: /

# Yapay zekâ tarayıcıları — dilerseniz Disallow yaparak kapatabilirsiniz
User-agent: GPTBot
Allow: /
User-agent: PerplexityBot
Allow: /

Sitemap: ${url("/sitemap.xml")}
Host: ${site.domain.replace(/^https?:\/\//, "")}
`);

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${esc(site.name)} — Güzellik Rehberi</title>
  <link>${url("/blog/")}</link>
  <description>${esc("Bahçeşehir'den bakım önerileri, uygulama rehberleri ve güzellik ipuçları.")}</description>
  <language>tr-TR</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${url("/rss.xml")}" rel="self" type="application/rss+xml"/>
${posts.map((p) => `  <item>
    <title>${esc(p.title)}</title>
    <link>${url(`/blog/${p.slug}/`)}</link>
    <guid isPermaLink="true">${url(`/blog/${p.slug}/`)}</guid>
    <pubDate>${new Date(p.date).toUTCString()}</pubDate>
    <description>${esc(p.description)}</description>
  </item>`).join("\n")}
</channel>
</rss>
`;
await writeFile(path.join(dist, "rss.xml"), rss);

await writeFile(path.join(dist, "site.webmanifest"), JSON.stringify({
  name: site.name, short_name: "Elif Erol", lang: "tr",
  description: site.description, start_url: "/", display: "standalone",
  background_color: site.brandColors.cream, theme_color: site.brandColors.rose,
  icons: [{ src: "/assets/img/logo.png", sizes: "1024x1024", type: "image/png", purpose: "any maskable" }],
}, null, 2));

await writeFile(path.join(dist, "CNAME"), site.domain.replace(/^https?:\/\//, "") + "\n");

if (site.indexNowKey) {
  await writeFile(path.join(dist, `${site.indexNowKey}.txt`), site.indexNowKey);
}

if (existsSync(assetDir)) {
  await cp(assetDir, path.join(dist, "assets/img"), { recursive: true });
} else {
  console.warn("⚠ src/assets/img boş — görseller Higgsfield CDN'inden yüklenecek. `npm run assets` ile indirebilirsiniz.");
}

console.log(`✓ ${pages.length} sayfa üretildi → dist/`);
console.log(`  sitemap.xml, robots.txt, rss.xml, site.webmanifest, 404.html hazır.`);
