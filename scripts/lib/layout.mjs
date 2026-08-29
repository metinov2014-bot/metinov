/** Tüm sayfaların ortak HTML iskeleti. */
import { esc, attr, jsonld } from "./render.mjs";

export function createLayout({ site, css, helpers, services }) {
  const { picture, imgSrc, imgAbs, url, waLink } = helpers;
  const tel = `tel:${site.phone}`;

  const nav = [
    { href: "/", label: "Ana Sayfa" },
    { href: "/hakkimizda/", label: "Hakkımızda" },
    {
      href: "/hizmetler/", label: "Hizmetlerimiz",
      children: services.map((s) => ({ href: `/hizmetler/${s.slug}/`, label: s.nav })),
    },
    { href: "/blog/", label: "Güzellik Rehberi" },
    { href: "/bize-ulasin/", label: "Bize Ulaşın" },
  ];

  const navHtml = (current) =>
    nav.map((item) => {
      const active = item.href === current || (item.children && current.startsWith(item.href) && item.href !== "/");
      if (!item.children) {
        return `<li><a href="${item.href}"${active ? ' aria-current="page"' : ""}>${esc(item.label)}</a></li>`;
      }
      return `<li class="has-sub"><button type="button" aria-expanded="false">${esc(item.label)} <span aria-hidden="true">▾</span></button>
        <ul class="submenu"><li><a href="${item.href}">Tüm Hizmetler</a></li>${item.children
          .map((c) => `<li><a href="${c.href}"${c.href === current ? ' aria-current="page"' : ""}>${esc(c.label)}</a></li>`)
          .join("")}</ul></li>`;
    }).join("");

  /** Sayfa bağımsız, her sayfaya eklenen kuruluş şeması. */
  const businessSchema = () => ({
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    "@id": url("/#business"),
    name: site.name,
    legalName: site.legalName,
    description: site.description,
    url: url("/"),
    image: imgAbs("salon"),
    logo: imgAbs("logo"),
    telephone: site.phone,
    email: site.email,
    priceRange: site.priceRange,
    currenciesAccepted: "TRY",
    paymentAccepted: "Nakit, Kredi Kartı",
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.street,
      addressLocality: site.address.district,
      addressRegion: site.address.region,
      postalCode: site.address.postalCode,
      addressCountry: site.address.country,
    },
    geo: { "@type": "GeoCoordinates", latitude: site.geo.lat, longitude: site.geo.lng },
    hasMap: site.mapsUrl,
    openingHoursSpecification: site.hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.days, opens: h.opens, closes: h.closes,
    })),
    areaServed: site.areaServed.map((a) => ({ "@type": "Place", name: a })),
    sameAs: Object.values(site.social).filter(Boolean),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: site.rating.value,
      reviewCount: site.rating.count,
      bestRating: "5",
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Güzellik hizmetleri",
      itemListElement: services.map((s) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: s.h1, url: url(`/hizmetler/${s.slug}/`) },
      })),
    },
  });

  const breadcrumbSchema = (crumbs) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem", position: i + 1, name: c.label, item: url(c.href),
    })),
  });

  const header = (current) => `
<div class="topbar"><div class="wrap">
  <span>📍 ${esc(site.address.street)}, ${esc(site.address.district)}/İstanbul</span>
  <a href="${tel}">📞 ${esc(site.phoneDisplay)}</a>
  <span>🕘 ${esc(site.hours[0].label)} ${esc(site.hours[0].time)}</span>
</div></div>
<header class="site">
  <div class="wrap nav">
    <a class="brand" href="/">
      ${picture("logo", { alt: `${site.name} logosu`, loading: "eager", sizes: "40px" })}
      <span>${esc(site.name)}<small>${esc(site.tagline)}</small></span>
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="ana-menu" aria-label="Menüyü aç">☰</button>
    <ul class="nav-links" id="ana-menu">${navHtml(current)}</ul>
    <a class="btn btn--primary" href="${tel}">Randevu Al</a>
  </div>
</header>`;

  const footer = () => `
<footer class="site">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <h4>${esc(site.name)}</h4>
        <p>${esc(site.tagline)}. ${esc(site.address.district)} ve çevresinde protez tırnak, lazer epilasyon, cilt bakımı ve daha fazlası.</p>
        <p><a href="${site.social.instagram}" rel="me noopener">Instagram @${esc(site.instagramHandle)}</a></p>
      </div>
      <div>
        <h4>Hizmetler</h4>
        <ul>${services.map((s) => `<li><a href="/hizmetler/${s.slug}/">${esc(s.nav)}</a></li>`).join("")}</ul>
      </div>
      <div>
        <h4>Kurumsal</h4>
        <ul>
          <li><a href="/hakkimizda/">Hakkımızda</a></li>
          <li><a href="/blog/">Güzellik Rehberi</a></li>
          <li><a href="/bize-ulasin/">Bize Ulaşın</a></li>
          <li><a href="/gizlilik-politikasi/">Gizlilik &amp; KVKK</a></li>
        </ul>
      </div>
      <div>
        <h4>İletişim</h4>
        <ul>
          <li><a href="${tel}">${esc(site.phoneDisplay)}</a></li>
          <li><a href="tel:${site.phoneAlt}">${esc(site.phoneAltDisplay)}</a></li>
          <li><a href="mailto:${site.email}">${esc(site.email)}</a></li>
          <li>${esc(site.address.street)}<br>${esc(site.address.postalCode)} ${esc(site.address.district)}/${esc(site.address.city)}</li>
        </ul>
      </div>
    </div>
    <div class="foot-bottom">
      <span>© ${new Date().getFullYear()} ${esc(site.legalName)}. Tüm hakları saklıdır.</span>
      <span>Bahçeşehir · Başakşehir · Esenyurt · Beylikdüzü</span>
    </div>
  </div>
</footer>
<a class="wa-float" href="${waLink()}" target="_blank" rel="noopener" aria-label="WhatsApp ile randevu alın">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.2 8.2 0 0 1 8.23 8.24c0 4.54-3.7 8.23-8.23 8.23Zm4.52-6.16c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.84-.2-.48-.4-.42-.55-.43h-.47c-.16 0-.42.06-.64.31-.22.25-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.39 1.37.5.58.19 1.1.16 1.51.1.46-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29Z"/></svg>
</a>
<script>
(function(){
  var t=document.querySelector('.nav-toggle'),m=document.getElementById('ana-menu');
  if(t&&m){t.addEventListener('click',function(){var o=m.classList.toggle('open');t.setAttribute('aria-expanded',o);t.setAttribute('aria-label',o?'Menüyü kapat':'Menüyü aç');});}
  document.querySelectorAll('.has-sub>button').forEach(function(b){
    b.addEventListener('click',function(){var li=b.parentElement,o=li.classList.toggle('open');b.setAttribute('aria-expanded',o);});
  });
})();
</script>`;

  /**
   * @param {object} p sayfa tanımı
   * @returns {string} tam HTML belgesi
   */
  return function layout(p) {
    const canonical = url(p.path);
    const ogImage = imgAbs(p.image || "salon");
    const schemas = [businessSchema(), ...(p.schemas || [])];
    if (p.crumbs?.length > 1) schemas.push(breadcrumbSchema(p.crumbs));

    return `<!doctype html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${attr(p.description)}">
${p.keywords?.length ? `<meta name="keywords" content="${attr(p.keywords.join(", "))}">\n` : ""}<meta name="robots" content="${p.noindex ? "noindex,follow" : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"}">
<meta name="author" content="${attr(site.legalName)}">
<meta name="theme-color" content="${site.brandColors.rose}">
<meta name="geo.region" content="TR-34">
<meta name="geo.placename" content="Bahçeşehir, Başakşehir, İstanbul">
<meta name="geo.position" content="${site.geo.lat};${site.geo.lng}">
<meta name="ICBM" content="${site.geo.lat}, ${site.geo.lng}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="tr" href="${canonical}">
<link rel="alternate" hreflang="x-default" href="${canonical}">
<meta property="og:type" content="${p.ogType || "website"}">
<meta property="og:site_name" content="${attr(site.name)}">
<meta property="og:locale" content="${site.locale}">
<meta property="og:title" content="${attr(p.ogTitle || p.title)}">
<meta property="og:description" content="${attr(p.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:alt" content="${attr(p.h1 || site.name)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(p.ogTitle || p.title)}">
<meta name="twitter:description" content="${attr(p.description)}">
<meta name="twitter:image" content="${ogImage}">
<link rel="icon" href="${imgSrc("logo")}" type="image/png">
<link rel="apple-touch-icon" href="${imgSrc("logo")}">
<link rel="manifest" href="/site.webmanifest">
<link rel="alternate" type="application/rss+xml" title="${attr(site.name)} — Güzellik Rehberi" href="/rss.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Jost:wght@300;400;500;600&display=swap" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Jost:wght@300;400;500;600&display=swap"></noscript>
<style>${css}</style>
${schemas.map(jsonld).join("\n")}
</head>
<body>
<a class="skip" href="#icerik">İçeriğe geç</a>
${header(p.path)}
<main id="icerik">
${p.body}
</main>
${footer()}
</body>
</html>
`;
  };
}
