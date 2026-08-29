#!/usr/bin/env node
/**
 * Güzellik Rehberi için yeni bir blog taslağı oluşturur (SEO alanları hazır).
 *
 * Kullanım:
 *   node scripts/new-post.mjs "Kalıcı Oje Nasıl Uzun Ömürlü Olur" \
 *     --keywords "kalıcı oje bakımı, kalıcı oje ne kadar dayanır" \
 *     --image kalici-oje --category "El & Ayak Bakımı"
 */
import { writeFile, readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { slugify } from "./lib/render.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const title = args.find((a) => !a.startsWith("--"));

if (!title) {
  console.error('Kullanım: node scripts/new-post.mjs "Yazı başlığı" [--keywords "a, b"] [--image anahtar] [--category "Kategori"]');
  process.exit(1);
}

const flag = (name, fallback = "") => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const media = JSON.parse(await readFile(path.join(root, "content/media.json"), "utf8"));
const image = flag("image", "salon");
if (!media.images[image]) {
  console.error(`"${image}" görseli media.json içinde yok. Seçenekler: ${Object.keys(media.images).join(", ")}`);
  process.exit(1);
}

const slug = flag("slug", slugify(title));
const dest = path.join(root, "content/blog", `${slug}.md`);
if (await access(dest).then(() => true, () => false)) {
  console.error(`Zaten var: content/blog/${slug}.md`);
  process.exit(1);
}

const keywords = flag("keywords").split(",").map((k) => k.trim()).filter(Boolean);
const today = new Date().toISOString().slice(0, 10);

const body = `---
title: "${title}"
description: "TODO: 70-160 karakter arası, arama sonucunda görünecek özet. Ana anahtar kelimeyi doğal biçimde içersin."
date: "${today}"
category: "${flag("category", "Güzellik Rehberi")}"
image: "${image}"
imageAlt: "${media.images[image].alt}"
keywords: [${keywords.map((k) => `"${k}"`).join(", ")}]
---

Giriş paragrafı: okuyucunun sorusunu ilk iki cümlede yanıtlayın. Ana anahtar kelime ilk 100 kelime içinde geçsin.

## İlk alt başlık

Metin.

- Madde
- Madde

## İkinci alt başlık

Metin.

> Öne çıkarmak istediğiniz bilgi.

## Sık sorulanlar

### Soru?

Yanıt.

## Randevu

Bahçeşehir 1. Kısım'daki salonumuzdan randevu almak için bizi arayabilir ya da WhatsApp'tan yazabilirsiniz.
`;

await writeFile(dest, body);
console.log(`✓ content/blog/${slug}.md oluşturuldu.
  Sonraki adımlar:
    1. description ve içeriği doldurun (hedef: 600+ kelime)
    2. npm run build && npm run audit
    3. commit + push → GitHub Actions yayına alır ve IndexNow'a bildirir`);
