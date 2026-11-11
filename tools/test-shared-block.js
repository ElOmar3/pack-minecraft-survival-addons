#!/usr/bin/env node
/**
 * ==============================================================================
 * TEST DEL BLOQUE PUENTE COMPARTIDO V3 (sin BDS, sandbox vm)
 * ==============================================================================
 * Extrae el bloque canónico de un behavior pack y valida en un entorno simulado:
 *   1. Lector tolerante __sqlite_read_json_v3__ (string/objeto/número/boolean).
 *   2. Gating de escrituras hasta sync_complete (RAM inmediata, emisión encolada).
 *   3. Guard de sourceEntity (un jugador no puede inyectar estado).
 *   4. Versionado: escrituras locales ganan al snapshot (incluye mismo milisegundo).
 *   5. Chunking: reensamblaje de valores grandes y cap de 4096 fragmentos.
 *   6. sync_complete drena pendientes y habilita emisión directa.
 *   7. /reload: gate reiniciado, listener único, versionado por ciclo.
 *   8. Modo degradado sin demonio (retry 120 ticks, ready 200 ticks, flush).
 *
 * Uso: node tools/test-shared-block.js
 * ==============================================================================
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..");
const START = "// === PERSISTENCIA SQLITE PUENTE V3 (SEGURO PARA /reload) ===";
const END = "// === FIN PERSISTENCIA SQLITE PUENTE V3 ===";
const PACK = "warps_addon";

const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);

const src = fs.readFileSync(path.join(ROOT, "behavior_packs", PACK, "scripts", "main.js"), "utf8");
const s = src.indexOf(START);
const e = src.indexOf(END);
assert.ok(s !== -1 && e !== -1, "marcadores del puente presentes");
const block = src.slice(s, e + END.length);

function makeEnv() {
  const emitted = [];
  const timers = [];
  const listeners = [];
  const sandbox = {
    console: { warn: l => emitted.push(l), log: () => {}, error: () => {} },
    system: {
      afterEvents: { scriptEventReceive: { subscribe: cb => listeners.push(cb) } },
      runTimeout: (fn, ticks) => timers.push({ fn, ticks }),
    },
  };
  vm.createContext(sandbox);
  const fire = (id, payload, sourceEntity) => {
    const msg = typeof payload === "string" ? payload : JSON.stringify(payload);
    for (const cb of listeners) cb({ id, message: msg, sourceEntity });
  };
  const tick = (n) => {
    const due = timers.filter(t => t.ticks <= n).sort((a, b) => a.ticks - b.ticks);
    for (const t of due) { timers.splice(timers.indexOf(t), 1); t.fn(); }
  };
  const load = () => vm.runInContext(block, sandbox);
  return { g: sandbox, emitted, timers, listeners, fire, tick, load };
}

// === Escenario 1-6: demonio presente ===
const env = makeEnv();
env.load();
const g = env.g;
assert.ok(env.emitted.some(l => l.includes("[SQLITE_REQUEST_SYNC]") && l.includes(PACK)), "request_sync emitido");
assert.strictEqual(env.listeners.length, 1, "un solo listener");

const h = g.__sqlite_read_json_v3__;
eq(h('{"a":1}'), { a: 1 }, "string JSON");
const obj = { a: 1 };
assert.strictEqual(h(obj), obj, "objeto pasa intacto");
assert.strictEqual(h(5), 5, "numero");
assert.strictEqual(h(true), true, "boolean");
eq(h(undefined, []), [], "fallback undefined");
eq(h("basura", {}), {}, "fallback corrupto");
assert.strictEqual(h(""), null, "vacio -> null");
console.log("OK 1: helper tolerante (string/objeto/numero/boolean/corrupto)");

g.__sqlite_set_prop_v2__(PACK, "world", "k", { x: 1 });
eq(g.__sqlite_get_prop_v2__(PACK, "world", "k"), { x: 1 }, "RAM inmediata");
assert.ok(!env.emitted.some(l => l.includes("[SQLITE_SAVE_V1]")), "SAVE encolado");
assert.strictEqual(g.__sqlite_pending_v3__.get(PACK).length, 1, "pending=1");
console.log("OK 2: gating de escrituras (RAM inmediata, emision encolada)");

env.fire("sqlite:sync", { addon: PACK, owner: "world", key: "k", value: { x: 99 } }, { typeId: "minecraft:player" });
eq(g.__sqlite_get_prop_v2__(PACK, "world", "k"), { x: 1 }, "jugador no inyecta");
console.log("OK 3: guard sourceEntity rechaza jugador");

env.fire("sqlite:sync", { addon: PACK, owner: "world", key: "k", value: { x: 99 } });
eq(g.__sqlite_get_prop_v2__(PACK, "world", "k"), { x: 1 }, "version guard protege k (mismo ms)");
env.fire("sqlite:sync", { addon: PACK, owner: "world", key: "k3", value: { deep: true } });
eq(g.__sqlite_get_prop_v2__(PACK, "world", "k3"), { deep: true }, "snapshot aplicado a k3");
console.log("OK 4: versionado (>= mismo milisegundo) + rehidratacion normal");

const big = { data: "x".repeat(3000) };
const serialized = JSON.stringify(big);
const CH = 600;
const count = Math.ceil(serialized.length / CH);
for (let c = 0; c < count; c++) {
  env.fire("sqlite:load_chunk", { chunkId: "c_test", addon: PACK, owner: "world", key: "big", chunkIndex: c, chunkCount: count, valueChunk: serialized.slice(c * CH, (c + 1) * CH) });
}
eq(g.__sqlite_get_prop_v2__(PACK, "world", "big"), big, "chunk reensamblado");
env.fire("sqlite:load_chunk", { chunkId: "c_bad", addon: PACK, owner: "world", key: "big", chunkIndex: 0, chunkCount: 5000, valueChunk: "x" });
eq(g.__sqlite_get_prop_v2__(PACK, "world", "big"), big, "chunkCount>4096 rechazado");
console.log("OK 5: chunking (reensamblaje + cap 4096)");

env.fire("sqlite:sync_complete", { addon: PACK, protocol: 3, entryCount: 2 });
assert.ok(g.__sqlite_sync_complete_v2__.has(PACK), "sync_complete registrado");
assert.ok(g.__sqlite_is_ready_v3__(PACK), "ready=true");
assert.ok(env.emitted.some(l => l.includes("[SQLITE_SAVE_V1]") && l.includes('"k"')), "pending drenado");
g.__sqlite_set_prop_v2__(PACK, "world", "k4", 42);
assert.ok(env.emitted.some(l => l.includes("[SQLITE_SAVE_V1]") && l.includes('"k4"')), "post-sync inmediato");
console.log("OK 6: sync_complete drena pendientes");

// === Escenario 7: /reload ===
env.load();
assert.strictEqual(env.listeners.length, 1, "listener unico tras reload");
assert.ok(!g.__sqlite_sync_complete_v2__.has(PACK), "gate reiniciado");
env.fire("sqlite:sync", { addon: PACK, owner: "world", key: "k3", value: { deep: false } });
eq(g.__sqlite_get_prop_v2__(PACK, "world", "k3"), { deep: false }, "snapshot aceptado clave vieja");
g.__sqlite_set_prop_v2__(PACK, "world", "k5", "nuevo");
env.fire("sqlite:sync", { addon: PACK, owner: "world", key: "k5", value: "viejo" });
assert.strictEqual(g.__sqlite_get_prop_v2__(PACK, "world", "k5"), "nuevo", "ciclo 2 protegido");
console.log("OK 7: /reload (gate reiniciado, versionado por ciclo)");

// === Escenario 8: sin demonio (degradado) ===
const env2 = makeEnv();
env2.load();
const g2 = env2.g;
g2.__sqlite_set_prop_v2__(PACK, "world", "solo", { a: 1 });
assert.ok(!g2.__sqlite_is_ready_v3__(PACK), "no ready sin demonio");
env2.tick(120);
assert.ok(env2.emitted.filter(l => l.includes("[SQLITE_REQUEST_SYNC]")).length >= 2, "retry 120");
env2.tick(200);
assert.ok(g2.__sqlite_is_ready_v3__(PACK), "degraded ready");
assert.ok(g2.__sqlite_sync_complete_v2__.has(PACK), "gate resuelto degradado");
assert.ok(env2.emitted.some(l => l.includes("[SQLITE_SAVE_V1]") && l.includes("solo")), "flush degradado");
g2.__sqlite_set_prop_v2__(PACK, "world", "solo2", 7);
assert.ok(env2.emitted.some(l => l.includes("solo2")), "directo tras degradado");
console.log("OK 8: modo degradado sin demonio");

console.log("\n=== 8/8 ESCENARIOS DEL PUENTE COMPARTIDO PASARON ===");