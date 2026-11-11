#!/usr/bin/env node
/**
 * ==============================================================================
 * BUILD .mcpack — EMPAQUETADO POSIX SIN DEPENDENCIAS (Pacífico Comunitario)
 * ==============================================================================
 * Genera un .mcpack por behavior pack usando un escritor ZIP propio:
 *   - Rutas internas SIEMPRE con separadores POSIX ("/"), conforme a la spec ZIP.
 *   - DEFLATE (zlib nativo) con fallback a STORE si no reduce tamaño.
 *   - Exclusión de secretos y artefactos de runtime: OwnerProvisioning.js (claves
 *     HMAC/nonce en vivo), .env, node_modules, *.db, logs, etc. La plantilla
 *     OwnerProvisioning.example.js SÍ se distribuye.
 *   - Verificación integrada: relee el ZIP generado, comprueba separadores,
 *     exclusiones y CRC32 de cada entrada antes de dar el build por bueno.
 *
 * Uso: node tools/build-mcpacks.js
 * ==============================================================================
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..");
const BP_DIR = path.join(ROOT, "behavior_packs");
const OUT_DIR = path.join(ROOT, "mcpacks");

// === Reglas de exclusión (secretos y artefactos que no deben distribuirse) ===
const EXCLUDED_DIRS = new Set(["node_modules", ".git", "test_sandbox"]);
const EXCLUDED_BASENAMES = new Set(["OwnerProvisioning.js", ".DS_Store", "Thumbs.db"]);
const EXCLUDED_SUFFIXES = [".db", ".db-wal", ".db-shm", ".log", ".tmp", ".bak"];

function isExcluded(relPosix) {
  const parts = relPosix.split("/");
  if (parts.some(p => EXCLUDED_DIRS.has(p))) return true;
  const base = parts[parts.length - 1];
  if (EXCLUDED_BASENAMES.has(base)) return true;
  if (base === ".env" || base.startsWith(".env.")) return true;
  if (EXCLUDED_SUFFIXES.some(s => base.endsWith(s))) return true;
  return false;
}

// === CRC32 (IEEE 802.3) ===
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2));
  const day = (((date.getFullYear() - 1980) & 0x7F) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

// === Recolección de archivos (rutas relativas POSIX, orden estable) ===
function collectEntries(packPath) {
  const entries = [];
  function walk(absDir, relDir) {
    const names = fs.readdirSync(absDir).sort();
    for (const name of names) {
      const rel = relDir ? `${relDir}/${name}` : name;
      if (isExcluded(rel)) continue;
      const abs = path.join(absDir, name);
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        entries.push({ rel: rel + "/", abs, isDir: true, mtime: stat.mtime });
        walk(abs, rel);
      } else if (stat.isFile()) {
        entries.push({ rel, abs, isDir: false, mtime: stat.mtime });
      }
    }
  }
  walk(packPath, "");
  return entries;
}

// === Escritor ZIP (local headers + central directory + EOCD) ===
function buildZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.rel, "utf8");
    const { time, day } = dosDateTime(entry.mtime);
    const raw = entry.isDir ? Buffer.alloc(0) : fs.readFileSync(entry.abs);
    const crc = crc32(raw);
    let method = 8;
    let data = entry.isDir ? raw : zlib.deflateRawSync(raw, { level: 9 });
    if (entry.isDir || data.length >= raw.length) { method = 0; data = raw; }

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // version needed
    local.writeUInt16LE(0x0800, 6);      // UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);          // extra len
    locals.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);        // version made by
    central.writeUInt16LE(20, 6);        // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    // extra/comment/disk/internal attrs = 0
    central.writeUInt32LE(entry.isDir ? ((0o40755 << 16) | 0x10) >>> 0 : (0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + data.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralBuf, eocd]);
}

// === Verificación: relee el ZIP y valida separadores, exclusiones y CRC ===
function verifyZip(buf, expectedCount) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65536); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error("EOCD no encontrado");
  const count = buf.readUInt16LE(eocd + 10);
  if (count !== expectedCount) throw new Error(`conteo de entradas ${count} != ${expectedCount}`);
  let off = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error("central header corrupto");
    const method = buf.readUInt16LE(off + 10);
    const crc = buf.readUInt32LE(off + 16);
    const compSize = buf.readUInt32LE(off + 20);
    const rawSize = buf.readUInt32LE(off + 24);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.slice(off + 46, off + 46 + nameLen).toString("utf8");
    if (name.includes("\\")) throw new Error(`separador no POSIX: ${name}`);
    if (isExcluded(name.replace(/\/$/, ""))) throw new Error(`archivo excluido presente: ${name}`);
    const localNameLen = buf.readUInt16LE(localOff + 26);
    const localExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + localNameLen + localExtraLen;
    const data = buf.slice(dataStart, dataStart + compSize);
    const raw = method === 8 ? zlib.inflateRawSync(data) : data;
    if (raw.length !== rawSize) throw new Error(`tamaño incorrecto: ${name}`);
    if (crc32(raw) !== crc) throw new Error(`CRC incorrecto: ${name}`);
    off += 46 + nameLen + extraLen + commentLen;
  }
  return count;
}

// === Build principal ===
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const packs = fs.readdirSync(BP_DIR).filter(f => fs.statSync(path.join(BP_DIR, f)).isDirectory());
console.log(`Empaquetando ${packs.length} behavior packs (ZIP POSIX, sin secretos)...`);

let failures = 0;
let excludedTotal = 0;
for (const pack of packs) {
  const packPath = path.join(BP_DIR, pack);
  const target = path.join(OUT_DIR, `${pack}.mcpack`);
  try {
    if (!fs.existsSync(path.join(packPath, "manifest.json"))) {
      console.warn(`! ${pack}: sin manifest.json (se empaqueta igual)`);
    }
    const entries = collectEntries(packPath);
    const all = [];
    (function countAll(absDir, relDir) {
      for (const name of fs.readdirSync(absDir)) {
        const rel = relDir ? `${relDir}/${name}` : name;
        const abs = path.join(absDir, name);
        const stat = fs.statSync(abs);
        if (stat.isDirectory()) { all.push(rel); countAll(abs, rel); }
        else all.push(rel);
      }
    })(packPath, "");
    const excluded = all.filter(isExcluded);
    excludedTotal += excluded.length;

    const zip = buildZip(entries);
    const verified = verifyZip(zip, entries.length);
    fs.writeFileSync(target, zip);
    const note = excluded.length > 0 ? ` [excluidos: ${excluded.join(", ")}]` : "";
    console.log(`✓ ${pack}.mcpack (${verified} entradas, ${(zip.length / 1024).toFixed(1)} KB)${note}`);
  } catch (err) {
    failures++;
    console.error(`✗ ${pack}.mcpack: ${err.message}`);
  }
}

console.log(`\nBuild completo: ${packs.length - failures}/${packs.length} packs, ${excludedTotal} archivos sensibles/runtime excluidos.`);
process.exit(failures > 0 ? 1 : 0);