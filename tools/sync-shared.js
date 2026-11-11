#!/usr/bin/env node
/**
 * ==============================================================================
 * SYNC-SHARED — PARIDAD DEL PUENTE SQLITE V3 EN LOS 26 BEHAVIOR PACKS
 * ==============================================================================
 * Reemplaza el bloque compartido entre los marcadores:
 *   // === PERSISTENCIA SQLITE PUENTE V3 (SEGURO PARA /reload) ===
 *   // === FIN PERSISTENCIA SQLITE PUENTE V3 ===
 * por la versión canónica (guard de sourceEntity, lector tolerante, versionado
 * de escrituras, gating de sync_complete con modo degradado) y aplica el codemod
 * JSON.parse(String(EXPR)) -> globalThis.__sqlite_read_json_v3__(EXPR).
 *
 * También centraliza ErrorReporter.js: todos los packs que lo incluyen reciben
 * el reportero canónico ligero (sin telemetría [SOFTFIX_COLLECTOR_V1]).
 *
 * Uso:
 *   node tools/sync-shared.js           # aplica cambios
 *   node tools/sync-shared.js --check   # solo reporta divergencias (CI)
 * ==============================================================================
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PACKS_DIR = path.join(ROOT, "behavior_packs");
const START = "// === PERSISTENCIA SQLITE PUENTE V3 (SEGURO PARA /reload) ===";
const END = "// === FIN PERSISTENCIA SQLITE PUENTE V3 ===";
const CHECK_ONLY = process.argv.includes("--check");

const TEMPLATE = `// === PERSISTENCIA SQLITE PUENTE V3 (SEGURO PARA /reload) ===
if (!globalThis.__sqlite_store_v2__) globalThis.__sqlite_store_v2__ = new Map();
if (!globalThis.__sqlite_write_ts_v3__) globalThis.__sqlite_write_ts_v3__ = new Map();
if (!globalThis.__sqlite_pending_v3__) globalThis.__sqlite_pending_v3__ = new Map();
if (!globalThis.__sqlite_unflushed_v3__) globalThis.__sqlite_unflushed_v3__ = new Map();
if (!globalThis.__sqlite_owner_key_v2__) {
  globalThis.__sqlite_owner_key_v2__ = function(owner) {
    if (typeof owner === "string") return owner;
    if (!owner) return "world";
    if (owner.name) return String(owner.name).toLowerCase();
    if (owner.id !== undefined) return String(owner.id);
    return "world";
  };
}
if (!globalThis.__sqlite_get_prop_v2__) {
  globalThis.__sqlite_get_prop_v2__ = function(addon, owner, key) {
    if (!addon || owner === undefined || owner === null || key === undefined) return undefined;
    const addonStore = globalThis.__sqlite_store_v2__.get(String(addon));
    const ownerStore = addonStore ? addonStore.get(globalThis.__sqlite_owner_key_v2__(owner)) : undefined;
    return ownerStore ? ownerStore[key] : undefined;
  };
}
// Lector tolerante: el demonio rehidrata objetos ya parseados; los datos legacy son strings JSON.
if (!globalThis.__sqlite_read_json_v3__) {
  globalThis.__sqlite_read_json_v3__ = function(raw, fallback) {
    const fb = fallback === undefined ? null : fallback;
    if (raw === undefined || raw === null) return fb;
    if (typeof raw === "object") return raw;
    if (typeof raw !== "string") return raw;
    const text = raw.trim();
    if (!text) return fb;
    try { return JSON.parse(text); } catch (e) { return fb; }
  };
}
if (!globalThis.__sqlite_set_prop_v2__) {
  globalThis.__sqlite_set_prop_v2__ = function(addon, owner, key, value) {
    if (!addon || owner === undefined || owner === null || key === undefined) return;
    const addonKey = String(addon);
    const ownerKey = globalThis.__sqlite_owner_key_v2__(owner);
    let addonStore = globalThis.__sqlite_store_v2__.get(addonKey);
    if (!addonStore) { addonStore = new Map(); globalThis.__sqlite_store_v2__.set(addonKey, addonStore); }
    let ownerStore = addonStore.get(ownerKey);
    if (!ownerStore) { ownerStore = {}; addonStore.set(ownerKey, ownerStore); }
    const payload = { addon: addonKey, owner: ownerKey, key };
    if (value === undefined) { delete ownerStore[key]; payload.deleted = true; }
    else { ownerStore[key] = value; payload.deleted = false; payload.value = value; }
    const compositeKey = addonKey + "\\u0000" + ownerKey + "\\u0000" + String(key);
    globalThis.__sqlite_write_ts_v3__.set(compositeKey, Date.now());
    try {
      const line = "[SQLITE_SAVE_V1] " + JSON.stringify(payload);
      // Gating: las escrituras previas a sync_complete se encolan y se emiten al confirmar el snapshot.
      if (globalThis.__sqlite_is_ready_v3__(addonKey)) console.warn(line);
      else {
        let queue = globalThis.__sqlite_pending_v3__.get(addonKey);
        if (!queue) { queue = []; globalThis.__sqlite_pending_v3__.set(addonKey, queue); }
        queue.push(line);
        let marks = globalThis.__sqlite_unflushed_v3__.get(addonKey);
        if (!marks) { marks = new Set(); globalThis.__sqlite_unflushed_v3__.set(addonKey, marks); }
        marks.add(compositeKey);
      }
    } catch (e) {}
  };
}
if (!globalThis.__sqlite_rehydrate_v2__) {
  globalThis.__sqlite_rehydrate_v2__ = function(addon, owner, key, value, deleted) {
    if (!addon || owner === undefined || owner === null || key === undefined) return;
    const addonKey = String(addon);
    const ownerKey = globalThis.__sqlite_owner_key_v2__(owner);
    // Versionado: una escritura local posterior a la solicitud de sync (o aún no drenada al demonio) gana sobre el snapshot.
    const status = globalThis.__sqlite_sync_status_v3__.get(addonKey);
    const compositeKey = addonKey + "\\u0000" + ownerKey + "\\u0000" + String(key);
    const writeTs = globalThis.__sqlite_write_ts_v3__.get(compositeKey);
    const unflushed = globalThis.__sqlite_unflushed_v3__.get(addonKey);
    if (unflushed && unflushed.has(compositeKey)) return;
    if (status && status.requestedAt !== undefined && writeTs !== undefined && writeTs >= status.requestedAt) return;
    let addonStore = globalThis.__sqlite_store_v2__.get(addonKey);
    if (!addonStore) { addonStore = new Map(); globalThis.__sqlite_store_v2__.set(addonKey, addonStore); }
    let ownerStore = addonStore.get(ownerKey);
    if (!ownerStore) { ownerStore = {}; addonStore.set(ownerKey, ownerStore); }
    if (deleted === true) delete ownerStore[key];
    else ownerStore[key] = value;
  };
}
if (!globalThis.__sqlite_sync_complete_v2__) globalThis.__sqlite_sync_complete_v2__ = new Map();
if (!globalThis.__sqlite_sync_status_v3__) globalThis.__sqlite_sync_status_v3__ = new Map();
if (!globalThis.__sqlite_is_ready_v3__) {
  globalThis.__sqlite_is_ready_v3__ = function(addon) {
    const status = globalThis.__sqlite_sync_status_v3__.get(String(addon));
    return Boolean(status && (status.complete || status.degraded));
  };
}
if (!globalThis.__sqlite_flush_pending_v3__) {
  globalThis.__sqlite_flush_pending_v3__ = function(addon) {
    const addonKey = String(addon);
    const queue = globalThis.__sqlite_pending_v3__.get(addonKey);
    if (!queue || queue.length === 0) return;
    globalThis.__sqlite_pending_v3__.delete(addonKey);
    globalThis.__sqlite_unflushed_v3__.delete(addonKey);
    for (const line of queue) { try { console.warn(line); } catch (e) {} }
  };
}
if (!globalThis.__sqlite_request_sync_v3__) {
  globalThis.__sqlite_request_sync_v3__ = function(addon, attempt) {
    const addonKey = String(addon || "");
    if (!addonKey) return;
    const previous = globalThis.__sqlite_sync_status_v3__.get(addonKey) || {};
    // Conservar la ventana original en reintentos para que el guard de versión no se relaje.
    const keepWindow = previous.requestedAt && !previous.complete && !previous.degraded;
    globalThis.__sqlite_sync_status_v3__.set(addonKey, {
      ...previous,
      requestedAt: keepWindow ? previous.requestedAt : Date.now(),
      attempt: Number(attempt || 0),
      complete: false,
      degraded: false,
      protocol: 0,
    });
    try { console.warn("[SQLITE_REQUEST_SYNC] " + JSON.stringify({ addon: addonKey, protocol: 3, attempt: Number(attempt || 0) })); } catch (e) {}
  };
}
try {
  const signal = system.afterEvents && system.afterEvents.scriptEventReceive;
  if (!globalThis.__sqlite_chunk_store_v2__) globalThis.__sqlite_chunk_store_v2__ = new Map();
  if (!globalThis.__sqlite_listener_callback_v3__) {
    const callback = function(event) {
    if (!event || (event.id !== "sqlite:load" && event.id !== "sqlite:sync" && event.id !== "sqlite:load_chunk" && event.id !== "sqlite:sync_complete")) return;
    // Solo el demonio (consola del servidor) puede rehidratar; un jugador jamás debe inyectar estado.
    if (event.sourceEntity && event.sourceEntity.typeId === "minecraft:player") return;
    try {
      const payload = JSON.parse(event.message || "{}");
      if (event.id === "sqlite:sync_complete") {
        if (payload.addon) {
          const addonKey = String(payload.addon);
          globalThis.__sqlite_sync_complete_v2__.set(addonKey, Date.now());
          const previous = globalThis.__sqlite_sync_status_v3__.get(addonKey) || {};
          globalThis.__sqlite_sync_status_v3__.set(addonKey, {
            ...previous,
            complete: true,
            completedAt: Date.now(),
            protocol: Number(payload.protocol || 0),
            entryCount: Number(payload.entryCount || 0),
          });
          globalThis.__sqlite_flush_pending_v3__(addonKey);
        }
        return;
      }
      if (event.id === "sqlite:load_chunk") {
        const count = Number(payload.chunkCount);
        const index = Number(payload.chunkIndex);
        if (!payload.addon || payload.key === undefined || !payload.chunkId || !Number.isInteger(count) || count < 1 || count > 4096 || !Number.isInteger(index) || index < 0 || index >= count) return;
        const chunkKey = String(payload.chunkId);
        let state = globalThis.__sqlite_chunk_store_v2__.get(chunkKey);
        if (!state || state.count !== count) {
          state = { count: count, chunks: new Array(count) };
          globalThis.__sqlite_chunk_store_v2__.set(chunkKey, state);
        }
        state.chunks[index] = String(payload.valueChunk || "");
        for (let partIndex = 0; partIndex < state.count; partIndex++) {
          if (typeof state.chunks[partIndex] !== "string") return;
        }
        const value = JSON.parse(state.chunks.join(""));
        globalThis.__sqlite_rehydrate_v2__(payload.addon, payload.owner || "world", payload.key, value, false);
        globalThis.__sqlite_chunk_store_v2__.delete(chunkKey);
        return;
      }
      if (payload.addon && payload.key !== undefined) {
        globalThis.__sqlite_rehydrate_v2__(payload.addon, payload.owner || "world", payload.key, payload.value, payload.deleted === true);
      }
    } catch (e) {}
    };
    globalThis.__sqlite_listener_callback_v3__ = callback;
    if (signal && typeof signal.subscribe === "function") signal.subscribe(callback);
  }
} catch (e) {}
globalThis.__sqlite_sync_complete_v2__.delete("__ADDON__");
globalThis.__sqlite_request_sync_v3__("__ADDON__", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("__ADDON__");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("__ADDON__", 1);
  } catch (e) {}
}, 120);
system.runTimeout(() => {
  // Sin demonio (mundo importado sin bridge) se opera en modo degradado tras ~10s: RAM es la fuente de verdad.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("__ADDON__");
    if (state && !state.complete) {
      state.degraded = true;
      globalThis.__sqlite_sync_complete_v2__.set("__ADDON__", Date.now());
      globalThis.__sqlite_flush_pending_v3__("__ADDON__");
    }
  } catch (e) {}
}, 200);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===`;

function renderBlock(addon) {
  return TEMPLATE.split("__ADDON__").join(addon);
}

// Reportero canónico: registro local en consola con deduplicación acotada.
// Sin outbox HTTP, sin UUID/HMAC y sin dependencia de @minecraft/server.
const ERROR_REPORTER_TEMPLATE = `// ErrorReporter.js — reportero local ligero, sin colector externo.
// La telemetría [SOFTFIX_COLLECTOR_V1] (outbox HTTP, UUID, HMAC) fue retirada:
// el colector no existe en este despliegue y sólo acumulaba memoria y trabajo.
// Los errores se registran en consola con deduplicación por fingerprint.

const DEDUP_WINDOW_MS = 60000;
const MAX_FINGERPRINTS = 200;
const recentFingerprints = new Map();

export class ErrorReporter {
    static report(error, context, severity = "error") {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        return this.reportMessage(severity, message, context, stack);
    }

    static reportMessage(severity, message, context, stack = undefined) {
        try {
            const safeContext = context && typeof context === "object" ? context : {};
            const text = String(message ?? "");
            const fingerprint = (safeContext.addonId || "?") + ":" + (safeContext.moduleId || "?") + ":" + (safeContext.operation || "?") + ":" + severity + ":" + text.slice(0, 100);
            const now = Date.now();
            const previous = recentFingerprints.get(fingerprint);
            if (previous !== undefined && now - previous < DEDUP_WINDOW_MS) return "suppressed";
            recentFingerprints.set(fingerprint, now);
            while (recentFingerprints.size > MAX_FINGERPRINTS) {
                recentFingerprints.delete(recentFingerprints.keys().next().value);
            }
            console.warn("[ERROR_REPORT_V1] " + JSON.stringify({
                severity,
                addonId: safeContext.addonId,
                moduleId: safeContext.moduleId,
                operation: safeContext.operation,
                category: safeContext.category,
                message: text.slice(0, 300),
                stack: stack ? String(stack).slice(0, 500) : undefined,
                timestamp: new Date(now).toISOString()
            }));
            return fingerprint;
        } catch (e) {
            return "report_failed";
        }
    }
}

export function safeEventHandler(context, handler) {
    return (event) => {
        try {
            const result = handler(event);
            if (result && typeof result.catch === "function") {
                result.catch((error) => {
                    ErrorReporter.report(error, context, "error");
                });
            }
        } catch (error) {
            ErrorReporter.report(error, context, "error");
        }
    };
}
`;

/**
 * Codemod: JSON.parse(String(EXPR)) -> globalThis.__sqlite_read_json_v3__(EXPR)
 * Escanea con profundidad de paréntesis y estado de comillas para hallar el
 * cierre exacto de String(...). No toca otros JSON.parse.
 */
function codemodReadJson(src) {
  const needle = "JSON.parse(String(";
  let out = "";
  let i = 0;
  let count = 0;
  for (;;) {
    const idx = src.indexOf(needle, i);
    if (idx === -1) { out += src.slice(i); break; }
    let j = idx + needle.length;
    let depth = 1;
    let quote = null;
    while (j < src.length && depth > 0) {
      const ch = src[j];
      if (quote) {
        if (ch === "\\") { j += 2; continue; }
        if (ch === quote) quote = null;
        j++;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") { quote = ch; j++; continue; }
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      j++;
    }
    if (depth === 0 && src[j] === ")") {
      const expr = src.slice(idx + needle.length, j - 1);
      out += src.slice(i, idx) + "globalThis.__sqlite_read_json_v3__(" + expr + ")";
      i = j + 1;
      count++;
    } else {
      out += src.slice(i, idx + needle.length);
      i = idx + needle.length;
    }
  }
  return { code: out, count };
}

function walkJs(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJs(p, out);
    else if (entry.name.endsWith(".js")) out.push(p);
  }
  return out;
}

function main() {
  const packs = fs.readdirSync(PACKS_DIR).filter(d =>
    fs.existsSync(path.join(PACKS_DIR, d, "scripts", "main.js"))
  );
  let changedPacks = 0;
  let totalCodemods = 0;
  let reporterDrift = 0;
  let reporterTotal = 0;
  const errors = [];

  for (const pack of packs) {
    const mainPath = path.join(PACKS_DIR, pack, "scripts", "main.js");
    const src = fs.readFileSync(mainPath, "utf8");
    const s = src.indexOf(START);
    const e = src.indexOf(END);
    if (s === -1 || e === -1 || e < s) {
      errors.push(`${pack}: marcadores del puente no encontrados`);
      continue;
    }
    const block = src.slice(s, e + END.length);
    const nameMatch = block.match(/__sqlite_request_sync_v3__\("([^"]+)", 0\)/);
    if (!nameMatch) {
      errors.push(`${pack}: no se pudo derivar el nombre del addon`);
      continue;
    }
    if (nameMatch[1] !== pack) {
      errors.push(`${pack}: clave '${nameMatch[1]}' no coincide con el directorio`);
      continue;
    }
    const replaced = src.slice(0, s) + renderBlock(pack) + src.slice(e + END.length);
    const { code, count } = codemodReadJson(replaced);
    totalCodemods += count;
    if (code !== src) {
      changedPacks++;
      if (CHECK_ONLY) {
        console.log(`[DRIFT] ${pack} (bloque + ${count} lecturas)`);
      } else {
        fs.writeFileSync(mainPath, code);
        console.log(`[SYNC]  ${pack} (bloque canónico + ${count} lecturas tolerantes)`);
      }
    } else if (!CHECK_ONLY) {
      console.log(`[OK]    ${pack}`);
    }

    // Paridad del reportero de errores: sólo en packs que ya lo incluyen.
    const reporterPath = path.join(PACKS_DIR, pack, "scripts", "ErrorReporter.js");
    if (fs.existsSync(reporterPath)) {
      reporterTotal++;
      const current = fs.readFileSync(reporterPath, "utf8");
      if (current !== ERROR_REPORTER_TEMPLATE) {
        reporterDrift++;
        if (CHECK_ONLY) {
          console.log(`[DRIFT] ${pack}/ErrorReporter.js (reportero no canónico)`);
        } else {
          fs.writeFileSync(reporterPath, ERROR_REPORTER_TEMPLATE);
          console.log(`[SYNC]  ${pack}/ErrorReporter.js (reportero canónico)`);
        }
      }
    }
  }

  // Codemod en módulos auxiliares (p. ej. fcx_limited_admin) que leen del store.
  for (const file of walkJs(PACKS_DIR)) {
    if (path.basename(file) === "main.js") continue;
    const src = fs.readFileSync(file, "utf8");
    if (src.includes(START)) {
      errors.push(`${path.relative(ROOT, file)}: bloque puente fuera de main.js (revisar manualmente)`);
      continue;
    }
    const { code, count } = codemodReadJson(src);
    if (count === 0) continue;
    totalCodemods += count;
    const rel = path.relative(ROOT, file);
    if (CHECK_ONLY) {
      if (code !== src) { console.log(`[DRIFT] ${rel} (${count} lecturas)`); changedPacks++; }
    } else {
      fs.writeFileSync(file, code);
      console.log(`[SYNC]  ${rel} (${count} lecturas tolerantes)`);
    }
  }

  if (CHECK_ONLY) {
    const drift = changedPacks > 0 || reporterDrift > 0;
    console.log(drift
      ? `\nParidad rota: ${changedPacks} packs y ${reporterDrift} reporteros divergen. Ejecuta: node tools/sync-shared.js`
      : `\nParidad OK: ${packs.length} packs alineados (${totalCodemods} lecturas ya tolerantes, ${reporterTotal} reporteros canónicos).`);
    process.exit(drift ? 1 : 0);
  }

  if (errors.length > 0) {
    console.error("\nERRORES:");
    for (const err of errors) console.error("  - " + err);
    process.exit(1);
  }
  console.log(`\nListo: ${packs.length} packs, ${changedPacks} actualizados, ${totalCodemods} lecturas convertidas al helper tolerante, ${reporterDrift}/${reporterTotal} reporteros sincronizados.`);
}

main();