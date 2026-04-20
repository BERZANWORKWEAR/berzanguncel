import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(ROOT, "api", "data", "erp-db.json");
const SITEMAP_URL = "https://storemekap.com/products.xml";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[şŞ]/g, "s")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function unique(values) {
  return [...new Set((values || []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function inferBadges(name, description) {
  const haystack = `${name} ${description}`.toUpperCase();
  const badges = ["Mekap"];
  if (/\bS1P\b/.test(haystack)) badges.push("S1P");
  else if (/\bS1\b/.test(haystack)) badges.push("S1");
  if (/\bS2\b/.test(haystack)) badges.push("S2");
  if (/\bS3\b/.test(haystack)) badges.push("S3");
  if (/\bS4\b/.test(haystack)) badges.push("S4");
  if (/\bS5\b/.test(haystack)) badges.push("S5");
  if (/\bESD\b/.test(haystack)) badges.push("ESD");
  if (/KOMPOZIT/.test(haystack)) badges.push("Kompozit");
  if (/FIBERGLASS/.test(haystack)) badges.push("Fiberglass");
  if (/CELIK/.test(haystack) || /ÇELIK/.test(haystack)) badges.push("Çelik Burun");
  if (/SUYA DAYANIKLI|SU GECIRMEZ|SU GEÇIRMEZ/.test(haystack)) badges.push("Suya Dayanıklı");
  return unique(badges).slice(0, 5);
}

function inferSeasons(name, description, slug) {
  const haystack = `${name} ${description} ${slug}`.toLowerCase();
  const seasons = ["sezonluk"];
  if (haystack.includes("yaz")) seasons.push("yazlik");
  if (haystack.includes("bot") || haystack.includes("cizme") || haystack.includes("çizme")) seasons.push("kislik");
  return unique(seasons);
}

function inferSectors() {
  return ["insaat", "lojistik", "fabrika"];
}

function stableProductId(slug) {
  return `prd_mekap_${crypto.createHash("sha1").update(slug).digest("hex").slice(0, 12)}`;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!res.ok) {
    throw new Error(`${url} -> HTTP ${res.status}`);
  }
  return res.text();
}

function extractProductJsonLd(html) {
  const scripts = html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || [];
  for (const script of scripts) {
    const raw = script
      .replace(/^<script type="application\/ld\+json">/, "")
      .replace(/<\/script>$/, "")
      .trim();
    try {
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];
      const product = items.find((item) => item && item["@type"] === "Product");
      if (product) return product;
    } catch {}
  }
  return null;
}

function getProductPrice(product) {
  const offers = Array.isArray(product?.offers) ? product.offers : [];
  const prices = offers
    .map((offer) => Number(offer?.price))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!prices.length) return 0;
  return Math.min(...prices);
}

function isInStock(product) {
  const offers = Array.isArray(product?.offers) ? product.offers : [];
  return offers.some((offer) => String(offer?.availability || "").includes("InStock"));
}

function cleanDescription(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function buildImportedProduct({ product, slug, sort, nowIso }) {
  const name = String(product?.name || slug).trim();
  const description = cleanDescription(product?.description || `${name} iş güvenlik ayakkabısı`);
  const price = getProductPrice(product);
  const image = Array.isArray(product?.image) ? product.image[0] : product?.image || "";
  const sku = String(product?.sku || slug.replace(/-/g, "").toUpperCase()).trim();
  const stock = isInStock(product) ? 24 : 0;

  return {
    id: stableProductId(slug),
    sku,
    slug,
    name,
    category_id: "cat_ayakkabi",
    short_desc: description,
    description,
    cover_image_url: image,
    price_try: price,
    quote_price_try: price,
    stock,
    reorder_point: stock > 0 ? 6 : 0,
    badges: inferBadges(name, description),
    sectors: inferSectors(),
    seasons: inferSeasons(name, description, slug),
    sort,
    featured: sort < 200,
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

async function loadProductUrls() {
  const xml = await fetchText(SITEMAP_URL);
  const urls = xml.match(/<loc>(https:\/\/storemekap\.com\/[^<]+)<\/loc>/g) || [];
  return urls
    .map((item) => item.replace("<loc>", "").replace("</loc>", "").trim())
    .filter((url) => !url.endsWith("/dijital-hediye-karti"));
}

async function scrapeProducts(urls) {
  const nowIso = new Date().toISOString();
  const imported = [];
  let sort = 100;

  for (const url of urls) {
    try {
      const html = await fetchText(url);
      const product = extractProductJsonLd(html);
      if (!product) {
        console.warn(`[mekap-sync] Product JSON-LD bulunamadi: ${url}`);
        continue;
      }

      const slug = slugify(new URL(url).pathname.replace(/^\/+/, ""));
      if (!slug) continue;

      imported.push(
        buildImportedProduct({
          product,
          slug,
          sort,
          nowIso,
        })
      );
      sort += 10;
    } catch (error) {
      console.warn(`[mekap-sync] Atlandi: ${url} -> ${error.message}`);
    }
  }

  return imported;
}

async function main() {
  const raw = await fs.readFile(DB_PATH, "utf8");
  const db = JSON.parse(raw);
  const urls = await loadProductUrls();
  const importedProducts = await scrapeProducts(urls);

  const preservedProducts = (db.products || []).filter((product) => !String(product?.id || "").startsWith("prd_mekap_"));
  db.products = [...preservedProducts, ...importedProducts];
  db.meta = db.meta || {};
  db.meta.updated_at = new Date().toISOString();

  await fs.writeFile(DB_PATH, `${JSON.stringify(db, null, 2)}\n`, "utf8");

  console.log(`[mekap-sync] ${importedProducts.length} urun senkronlandi.`);
}

main().catch((error) => {
  console.error("[mekap-sync] Hata:", error.message);
  process.exitCode = 1;
});
