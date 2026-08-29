#!/usr/bin/env node
/**
 * dist/ altındaki üretilmiş sayfaları teknik SEO açısından denetler.
 * Kontroller: title/description uzunlukları, tek H1, canonical, alt metinleri,
 * geçerli JSON-LD, kırık iç bağlantılar, sitemap eşleşmesi ve içerik uzunluğu.
 *
 * Kullanım: node scripts/seo-audit.mjs [--report seo-report.md] [--strict]
 * Çıkış kodu: hata varsa 1 (uyarılar --strict verilmedikçe kodu etkilemez).
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const site = JSON.parse(await readFile(path.join(root, "content/site.json"), "utf8"));

const LIMITS = { titleMin: 30, titleMax: 65, descMin: 70, descMax: 165, wordsMin: 250 };

const errors = [];
const warnings = [];
const rows = [];
const err = (page, msg) => errors.push({ page, msg });
const warn = (page, msg) => warnings.push({ page, msg });

/** dist içindeki tüm html dosyalarını bulur. */
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

const files = await walk(dist);
const routeOf = (file) => {
  const rel = path.relative(dist, file).replace(/\\/g, "/");
  if (rel === "index.html") return "/";
  if (rel === "404.html") return "/404.html";
  return "/" + rel.replace(/index\.html$/, "");
};

const routes = new Set(files.map(routeOf));
const textOf = (html) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();

for (const file of files.sort()) {
  const route = routeOf(file);
  const html = await readFile(file, "utf8");
  const noindex = /<meta name="robots" content="noindex/.test(html);

  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? "";
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? "";
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => textOf(m[1]));
  const words = textOf(html).split(/\s+/).length;

  if (!title) err(route, "title etiketi yok");
  else if (title.length < LIMITS.titleMin) warn(route, `title kısa (${title.length} karakter, hedef ≥${LIMITS.titleMin})`);
  else if (title.length > LIMITS.titleMax) warn(route, `title uzun (${title.length} karakter, hedef ≤${LIMITS.titleMax}) — SERP'te kesilebilir`);

  if (!desc) err(route, "meta description yok");
  else if (desc.length < LIMITS.descMin) warn(route, `description kısa (${desc.length} karakter)`);
  else if (desc.length > LIMITS.descMax) warn(route, `description uzun (${desc.length} karakter)`);

  if (!noindex) {
    if (!canonical) err(route, "canonical yok");
    else if (!canonical.startsWith(site.domain)) err(route, `canonical yanlış alan adına işaret ediyor: ${canonical}`);
  }

  if (h1s.length === 0) err(route, "H1 yok");
  else if (h1s.length > 1) err(route, `${h1s.length} adet H1 var — sayfada tek H1 olmalı`);

  if (!noindex && words < LIMITS.wordsMin) warn(route, `içerik kısa (${words} kelime, hedef ≥${LIMITS.wordsMin})`);

  // Görsel alt metinleri ve boyutları
  for (const m of html.matchAll(/<img\b([^>]*)>/g)) {
    const tag = m[1];
    const alt = tag.match(/\salt="([^"]*)"/)?.[1];
    const src = tag.match(/\ssrc="([^"]*)"/)?.[1] ?? "(src yok)";
    if (alt === undefined) err(route, `alt niteliği eksik: ${src}`);
    else if (!alt.trim()) warn(route, `alt metni boş: ${src}`);
    if (!/\swidth="\d+"/.test(tag) || !/\sheight="\d+"/.test(tag)) warn(route, `width/height yok (CLS riski): ${src}`);
  }

  // Open Graph
  for (const prop of ["og:title", "og:description", "og:image", "og:url"]) {
    if (!html.includes(`property="${prop}"`)) warn(route, `${prop} eksik`);
  }

  // JSON-LD geçerliliği
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!noindex && blocks.length === 0) warn(route, "yapısal veri (JSON-LD) yok");
  for (const [i, b] of blocks.entries()) {
    try {
      const data = JSON.parse(b[1].replace(/\\u003c/g, "<"));
      if (!data["@type"]) warn(route, `JSON-LD #${i + 1} içinde @type yok`);
    } catch (e) {
      err(route, `JSON-LD #${i + 1} ayrıştırılamadı: ${e.message}`);
    }
  }

  // İç bağlantılar
  for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    const href = m[1];
    if (/\.(png|jpe?g|svg|webp|xml|txt|ico|webmanifest)$/.test(href)) continue;
    const normalized = href.endsWith("/") || href.endsWith(".html") ? href : href + "/";
    if (!routes.has(normalized)) err(route, `kırık iç bağlantı: ${href}`);
  }

  rows.push({ route, title: title.length, desc: desc.length, words, schema: blocks.length, noindex });
}

// Sitemap ile karşılaştırma
const sitemap = await readFile(path.join(dist, "sitemap.xml"), "utf8");
const mapped = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1].replace(site.domain, "") || "/"));
for (const r of routes) {
  if (r === "/404.html") continue;
  if (!mapped.has(r)) warn(r, "sitemap.xml içinde yok");
}
for (const m of mapped) {
  if (!routes.has(m)) err(m, "sitemap'te var ama sayfa üretilmemiş");
}

/* ---------- Rapor ---------- */

const lines = [];
lines.push(`# SEO Denetim Raporu — ${site.name}`, "");
lines.push(`Tarih: ${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}  `);
lines.push(`Sayfa sayısı: **${rows.length}** · Hata: **${errors.length}** · Uyarı: **${warnings.length}**`, "");
lines.push("| Sayfa | Title | Desc | Kelime | Şema |", "|---|---:|---:|---:|---:|");
for (const r of rows) lines.push(`| \`${r.route}\` | ${r.title} | ${r.desc} | ${r.words} | ${r.schema} |`);
lines.push("");
if (errors.length) {
  lines.push("## ❌ Hatalar", "");
  for (const e of errors) lines.push(`- \`${e.page}\` — ${e.msg}`);
  lines.push("");
}
if (warnings.length) {
  lines.push("## ⚠️ Uyarılar", "");
  for (const w of warnings) lines.push(`- \`${w.page}\` — ${w.msg}`);
  lines.push("");
}
if (!errors.length && !warnings.length) lines.push("✅ Tüm kontroller temiz.", "");

const report = lines.join("\n");
const reportFlag = process.argv.indexOf("--report");
if (reportFlag !== -1 && process.argv[reportFlag + 1]) {
  await writeFile(path.join(root, process.argv[reportFlag + 1]), report);
}
console.log(report);

const strict = process.argv.includes("--strict");
if (errors.length || (strict && warnings.length)) process.exit(1);
