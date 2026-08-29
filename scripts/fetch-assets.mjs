#!/usr/bin/env node
/**
 * content/media.json içindeki Higgsfield görsellerini src/assets/img/ altına indirir
 * ve PNG başlığından okuduğu gerçek genişlik/yükseklik değerleriyle manifesti günceller.
 * Kullanım: npm run assets   (--force ile mevcut dosyaları da yeniden indirir)
 */
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "src/assets/img");
const manifestPath = path.join(root, "content/media.json");
const force = process.argv.includes("--force");

/** PNG IHDR / JPEG SOF başlığından boyut okur. */
function readSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
await mkdir(outDir, { recursive: true });

let downloaded = 0, skipped = 0, failed = 0;
for (const [key, img] of Object.entries(manifest.images)) {
  const dest = path.join(outDir, img.file);
  if (!force) {
    const existing = await stat(dest).catch(() => null);
    if (existing && existing.size > 0) { skipped++; continue; }
  }
  try {
    const res = await fetch(img.remote);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, buf);
    const size = readSize(buf);
    if (size) { img.width = size.width; img.height = size.height; }
    downloaded++;
    console.log(`✓ ${img.file}  ${(buf.length / 1024).toFixed(0)} KB${size ? `  ${size.width}×${size.height}` : ""}`);
  } catch (err) {
    failed++;
    console.warn(`✗ ${key}: ${err.message} — build CDN adresine düşecek`);
  }
}

if (downloaded) await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`\nİndirilen: ${downloaded} · Atlanan: ${skipped} · Başarısız: ${failed}`);
