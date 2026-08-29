/** Ortak render yardımcıları: HTML kaçışı, görseller, JSON-LD ve sayfa şablonu. */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const attr = (s = "") => esc(s).replace(/'/g, "&#39;");

/** JSON-LD gövdesini </script> kaçışıyla birlikte yazar. */
export const jsonld = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

export function createHelpers({ site, media, assetsBase = "/assets/img", localAssetDir }) {
  /** Yerel dosya varsa onu, yoksa Higgsfield CDN adresini kullanır. */
  const imgSrc = (key) => {
    const img = media.images[key];
    if (!img) throw new Error(`media.json içinde "${key}" görseli yok`);
    const local = path.join(localAssetDir, img.file);
    return existsSync(local) ? `${assetsBase}/${img.file}` : img.remote;
  };

  const imgAbs = (key) => {
    const src = imgSrc(key);
    return src.startsWith("http") ? src : site.domain + src;
  };

  const picture = (key, { alt, className = "", loading = "lazy", sizes = "(max-width:900px) 100vw, 560px", fetchpriority } = {}) => {
    const img = media.images[key];
    return `<img src="${attr(imgSrc(key))}" alt="${attr(alt || img.alt)}" width="${img.width}" height="${img.height}"` +
      `${className ? ` class="${attr(className)}"` : ""} loading="${loading}" decoding="async" sizes="${attr(sizes)}"` +
      `${fetchpriority ? ` fetchpriority="${fetchpriority}"` : ""}>`;
  };

  const url = (p = "/") => site.domain.replace(/\/$/, "") + p;
  const waLink = () =>
    `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(site.whatsappMessage)}`;

  return { imgSrc, imgAbs, picture, url, waLink };
}

/** Çok küçük bir Markdown alt kümesi: başlık, liste, alıntı, kalın/italik, bağlantı. */
export function markdown(src) {
  const inline = (t) =>
    esc(t)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

  const out = [];
  let list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const cells = (line) => line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    let m;
    // Pipe tablosu: başlık satırı + ayraç satırı + gövde
    if (line.startsWith("|") && /^\|[\s:|-]+\|$/.test((lines[i + 1] || "").trim())) {
      closeList();
      const head = cells(line);
      const body = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) body.push(cells(lines[i++].trim()));
      i--;
      out.push('<div style="overflow-x:auto"><table class="hours"><thead><tr>' +
        head.map((c) => `<th scope="col">${inline(c)}</th>`).join("") + "</tr></thead><tbody>" +
        body.map((r) => "<tr>" + r.map((c, ci) => ci === 0 ? `<th scope="row">${inline(c)}</th>` : `<td>${inline(c)}</td>`).join("") + "</tr>").join("") +
        "</tbody></table></div>");
      continue;
    }
    if ((m = line.match(/^(#{2,4})\s+(.*)$/))) {
      closeList();
      const lvl = m[1].length;
      out.push(`<h${lvl} id="${slugify(m[2])}">${inline(m[2])}</h${lvl}>`);
    } else if ((m = line.match(/^[-*]\s+(.*)$/))) {
      if (list !== "ul") { closeList(); out.push('<ul class="checklist">'); list = "ul"; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^\d+\.\s+(.*)$/))) {
      if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      closeList();
      out.push(`<blockquote>${inline(m[1])}</blockquote>`);
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}

export const slugify = (s) =>
  s.toLowerCase()
    .replace(/ı/g, "i").replace(/İ/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** `--- key: value ---` başlıklı markdown dosyasını ayrıştırır. */
export function frontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim().replace(/^["'](.*)["']$/, "$1");
    if (v.startsWith("[") && v.endsWith("]")) {
      v = v.slice(1, -1).split(",").map((x) => x.trim().replace(/^["'](.*)["']$/, "$1")).filter(Boolean);
    }
    data[kv[1]] = v;
  }
  return { data, body: m[2] };
}

export const readCss = (file) => readFile(file, "utf8").then((c) =>
  c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s*([{}:;,>])\s*/g, "$1").replace(/\s+/g, " ").trim()
);
