#!/usr/bin/env node
/** dist/ klasörünü yerelde yayınlayan küçük önizleme sunucusu. node scripts/serve.mjs [port] */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const port = Number(process.argv[2] || process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  let file = path.join(root, url);
  if (!file.startsWith(root)) { res.writeHead(403).end("403"); return; }
  const info = await stat(file).catch(() => null);
  if (!info || info.isDirectory()) file = path.join(file, "index.html");
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" }).end(body);
  } catch {
    const notFound = await readFile(path.join(root, "404.html")).catch(() => "404");
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" }).end(notFound);
  }
}).listen(port, () => console.log(`→ http://localhost:${port}`));
