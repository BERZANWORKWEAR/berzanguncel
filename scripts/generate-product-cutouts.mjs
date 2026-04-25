import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { deflateSync, inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATHS = [
  path.join(ROOT, "api/data/erp-db.json"),
  path.join(ROOT, "src/data/erp-db.json"),
];
const OUT_DIR = path.join(ROOT, "public/img/catalog-cutouts");
const PROCESS_PREFIXES = ["prd_mekap_", "prd_yds_", "prd_3m_", "prd_tee_"];
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const crcTable = new Uint32Array(256).map((_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function readChunks(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("PNG imzasi okunamadi");
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
    if (type === "IEND") break;
  }
  return chunks;
}

function paeth(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  return pb <= pc ? up : upLeft;
}

function decodePng(buffer) {
  const chunks = readChunks(buffer);
  const ihdr = chunks.find((chunk) => chunk.type === "IHDR")?.data;
  if (!ihdr) throw new Error("IHDR yok");
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  if (bitDepth !== 8 || ![2, 6].includes(colorType)) throw new Error(`Desteklenmeyen PNG tipi: ${bitDepth}/${colorType}`);
  const channels = colorType === 6 ? 4 : 3;
  const rowBytes = width * channels;
  const raw = inflateSync(Buffer.concat(chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data)));
  const rgba = Buffer.alloc(width * height * 4);
  let inputOffset = 0;
  let previous = Buffer.alloc(rowBytes);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[inputOffset];
    inputOffset += 1;
    const current = Buffer.from(raw.subarray(inputOffset, inputOffset + rowBytes));
    inputOffset += rowBytes;

    for (let x = 0; x < rowBytes; x += 1) {
      const left = x >= channels ? current[x - channels] : 0;
      const up = previous[x] || 0;
      const upLeft = x >= channels ? previous[x - channels] || 0 : 0;
      if (filter === 1) current[x] = (current[x] + left) & 0xff;
      else if (filter === 2) current[x] = (current[x] + up) & 0xff;
      else if (filter === 3) current[x] = (current[x] + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) current[x] = (current[x] + paeth(left, up, upLeft)) & 0xff;
      else if (filter !== 0) throw new Error(`Desteklenmeyen PNG filtresi: ${filter}`);
    }

    for (let x = 0; x < width; x += 1) {
      const src = x * channels;
      const dst = (y * width + x) * 4;
      rgba[dst] = current[src];
      rgba[dst + 1] = current[src + 1];
      rgba[dst + 2] = current[src + 2];
      rgba[dst + 3] = channels === 4 ? current[src + 3] : 255;
    }
    previous = current;
  }
  return { width, height, rgba };
}

function isEdgeWhite(rgba, pixelOffset, options) {
  const red = rgba[pixelOffset];
  const green = rgba[pixelOffset + 1];
  const blue = rgba[pixelOffset + 2];
  const alpha = rgba[pixelOffset + 3];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  return alpha > 0
    && red >= options.threshold
    && green >= options.threshold
    && blue >= options.threshold
    && max - min <= options.maxChannelDiff;
}

function removeConnectedWhite({ width, height, rgba }, options) {
  const queue = [];
  const seen = new Uint8Array(width * height);
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (seen[index]) return;
    seen[index] = 1;
    if (isEdgeWhite(rgba, index * 4, options)) queue.push(index);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    const offset = index * 4;
    rgba[offset + 3] = 0;
    const x = index % width;
    const y = Math.floor(index / width);
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return { width, height, rgba };
}

function cropTransparent({ width, height, rgba }, padding = 28) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rgba[(y * width + x) * 4 + 3] > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX || maxY < minY) return { width, height, rgba };
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);
  const nextWidth = maxX - minX + 1;
  const nextHeight = maxY - minY + 1;
  const next = Buffer.alloc(nextWidth * nextHeight * 4);
  for (let y = 0; y < nextHeight; y += 1) {
    const srcStart = ((minY + y) * width + minX) * 4;
    const srcEnd = srcStart + nextWidth * 4;
    rgba.copy(next, y * nextWidth * 4, srcStart, srcEnd);
  }
  return { width: nextWidth, height: nextHeight, rgba: next };
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng({ width, height, rgba }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND"),
  ]);
}

function shouldProcess(product) {
  const id = String(product?.id || "");
  const image = String(product?.cover_image_url || "");
  return PROCESS_PREFIXES.some((prefix) => id.startsWith(prefix)) && /^https?:\/\//i.test(image);
}

function cutoutOptions(product) {
  const id = String(product?.id || "");
  if (id.startsWith("prd_yds_")) return { threshold: 232, maxChannelDiff: 30 };
  if (id.startsWith("prd_3m_") || id.startsWith("prd_tee_")) return { threshold: 242, maxChannelDiff: 18 };
  return { threshold: 248, maxChannelDiff: 7 };
}

function localPathFor(product) {
  const hash = crypto.createHash("sha1").update(String(product.cover_image_url || "")).digest("hex").slice(0, 10);
  return `/img/catalog-cutouts/${String(product.id).replace(/[^a-z0-9_-]/gi, "-")}-${hash}.png`;
}

async function convertToPng(sourceUrl, tempDir) {
  const inputPath = path.join(tempDir, "input");
  const outputPath = path.join(tempDir, "decoded.png");
  const response = await fetch(sourceUrl, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  await fs.writeFile(inputPath, Buffer.from(await response.arrayBuffer()));
  await execFileAsync("/usr/bin/sips", ["-s", "format", "png", inputPath, "--out", outputPath]);
  return fs.readFile(outputPath);
}

async function processImage(product) {
  const publicPath = localPathFor(product);
  const absoluteOut = path.join(ROOT, "public", publicPath.replace(/^\//, ""));
  try {
    if (process.env.CUTOUT_FORCE === "1") throw new Error("force");
    await fs.access(absoluteOut);
    return publicPath;
  } catch {}

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "berzan-cutout-"));
  try {
    const pngBuffer = await convertToPng(product.cover_image_url, tempDir);
    const decoded = decodePng(pngBuffer);
    const cutout = cropTransparent(removeConnectedWhite(decoded, cutoutOptions(product)));
    await fs.mkdir(path.dirname(absoluteOut), { recursive: true });
    await fs.writeFile(absoluteOut, encodePng(cutout));
    return publicPath;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

const sourceDb = JSON.parse(await fs.readFile(DB_PATHS[0], "utf8"));
const replacements = new Map();
const targets = (sourceDb.products || []).filter(shouldProcess);

let done = 0;
for (const product of targets) {
  try {
    const localPath = await processImage(product);
    replacements.set(product.cover_image_url, localPath);
    done += 1;
    console.log(`[cutout] ${done}/${targets.length} ${product.name}`);
  } catch (error) {
    console.warn(`[cutout] atlandi: ${product.name} -> ${error.message}`);
  }
}

for (const dbPath of DB_PATHS) {
  const db = JSON.parse(await fs.readFile(dbPath, "utf8"));
  for (const product of db.products || []) {
    const next = replacements.get(product.cover_image_url);
    if (next) product.cover_image_url = next;
  }
  db.meta = db.meta || {};
  db.meta.updated_at = new Date().toISOString();
  await fs.writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

console.log(`[cutout] ${replacements.size} gorsel lokal seffaf PNG olarak hazirlandi.`);
