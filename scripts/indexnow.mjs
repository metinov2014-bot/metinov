#!/usr/bin/env node
/**
 * dist/sitemap.xml içindeki adresleri IndexNow üzerinden Bing, Yandex ve
 * IndexNow'ı destekleyen diğer arama motorlarına bildirir.
 *
 * Anahtar: INDEXNOW_KEY ortam değişkeni ya da content/site.json → indexNowKey.
 * Anahtar dosyası (https://alanadi/<key>.txt) build sırasında otomatik üretilir.
 *
 * Kullanım:
 *   node scripts/indexnow.mjs              # sitemap'teki tüm adresler
 *   node scripts/indexnow.mjs /blog/yeni/  # yalnızca belirtilen yollar
 *   node scripts/indexnow.mjs --changed    # son commit'te değişen sayfalar
 *   node scripts/indexnow.mjs --dry-run
 */
import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = JSON.parse(await readFile(path.join(root, "content/site.json"), "utf8"));
const host = site.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
const key = process.env.INDEXNOW_KEY || site.indexNowKey;
const dryRun = process.argv.includes("--dry-run");

let urls = process.argv.slice(2).filter((a) => a.startsWith("/")).map((p) => site.domain + p);

if (process.argv.includes("--changed")) {
  try {
    const changed = execSync("git diff --name-only HEAD~1 HEAD", { cwd: root, encoding: "utf8" })
      .split("\n").filter((f) => f.startsWith("content/"));
    if (changed.length) console.log(`Değişen içerik dosyaları:\n  ${changed.join("\n  ")}`);
  } catch { /* ilk commit veya sığ klon */ }
}

if (!urls.length) {
  const sitemap = await readFile(path.join(root, "dist/sitemap.xml"), "utf8");
  urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

console.log(`${urls.length} adres bildirilecek (host: ${host})`);

if (!key) {
  console.error(`
⚠ IndexNow anahtarı tanımlı değil.
  1) 8-128 karakterlik rastgele bir anahtar üretin:
     node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
  2) content/site.json → "indexNowKey" alanına yazın (veya INDEXNOW_KEY secret'ı olarak ekleyin).
  Build, https://${host}/<anahtar>.txt dosyasını otomatik oluşturur.`);
  process.exit(dryRun ? 0 : 1);
}

const payload = { host, key, keyLocation: `${site.domain}/${key}.txt`, urlList: urls };

if (dryRun) {
  console.log("--dry-run: gönderilmedi.\n", JSON.stringify(payload, null, 2).slice(0, 800));
  process.exit(0);
}

const endpoints = ["https://api.indexnow.org/indexnow", "https://www.bing.com/indexnow", "https://yandex.com/indexnow"];
let ok = 0;
for (const endpoint of endpoints) {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });
    // 200 = kabul edildi, 202 = doğrulama bekliyor
    if (res.ok || res.status === 202) { ok++; console.log(`✓ ${endpoint} → ${res.status}`); }
    else console.warn(`✗ ${endpoint} → ${res.status} ${await res.text().catch(() => "")}`.trim());
  } catch (e) {
    console.warn(`✗ ${endpoint} → ${e.message}`);
  }
}

console.log(`\n${ok}/${endpoints.length} uç nokta bildirimi kabul etti.`);
console.log("Not: Google IndexNow'ı desteklemiyor. Google tarafında sitemap, Search Console'a bir kez eklendikten sonra otomatik taranır.");
process.exit(ok ? 0 : 1);
