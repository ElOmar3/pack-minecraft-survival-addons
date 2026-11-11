// Test funcional Fase 4 de protection_addon (rendimiento):
// 1. Caché activa de loadZones: interacciones repetidas de bloque no re-parsean
//    la BD de zonas; solo una mutación real (saveZones o rehidratación del
//    demonio) invalida la caché.
// 2. Un JSON corrupto no envenena la caché (fail-closed de escritura intacto).
// 3. Caché de identidad de loadBoundaryMarkers con el mismo contrato.
// 4. Throttling de partículas: jugador quieto => refresco cada 2 s en lugar de
//    cada tick; movimiento o cambio de zona => repintado inmediato.
// Se carga main.js con mocks permisivos; JSON.parse se instrumenta con
// contadores por contenido centinela y Date.now admite un offset controlado.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
let passed = 0;

function runProtectionPhase4Suite() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "prot-p4-"));
  try {
    const serverDir = path.join(sandbox, "node_modules", "@minecraft", "server");
    const uiDir = path.join(sandbox, "node_modules", "@minecraft", "server-ui");
    fs.mkdirSync(serverDir, { recursive: true });
    fs.mkdirSync(uiDir, { recursive: true });
    fs.writeFileSync(path.join(serverDir, "package.json"), JSON.stringify({ name: "@minecraft/server", version: "2.11.0", type: "module", main: "index.js" }));
    fs.writeFileSync(path.join(uiDir, "package.json"), JSON.stringify({ name: "@minecraft/server-ui", version: "2.0.0", type: "module", main: "index.js" }));
    fs.writeFileSync(path.join(serverDir, "index.js"), `
function makeSignal() { return { _fns: [], subscribe(fn) { this._fns.push(fn); }, emit(e) { for (const fn of this._fns) fn(e); } }; }
const signals = () => new Proxy({}, { get: (t, p) => (p in t) ? t[p] : (t[p] = makeSignal()) });
const objectives = new Map();
function makeObjective(id) {
  const scores = new Map();
  const keyOf = (p) => (p && typeof p === "object" && p.name !== undefined) ? String(p.name).toLowerCase() : String(p);
  return { id, getScore(p) { const k = keyOf(p); return scores.has(k) ? scores.get(k) : undefined; }, setScore(p, v) { scores.set(keyOf(p), Math.floor(v)); }, getParticipants() { return []; }, getScores() { return []; }, remove() {} };
}
function makeDimension(id) {
  return {
    id: id || "minecraft:overworld",
    runCommand(cmd) { world._commands.push(cmd); return { successCount: 1 }; },
    getBlock(loc) {
      if (!loc || !globalThis.__blocks) return undefined;
      return globalThis.__blocks.get(this.id + ":" + Math.floor(loc.x) + ":" + Math.floor(loc.y) + ":" + Math.floor(loc.z));
    },
    getEntities() { return []; },
    spawnParticle(name, point) { if (globalThis.__particles) globalThis.__particles.push({ name, point }); }
  };
}
export const world = {
  _players: [], _commands: [], _messages: [],
  getAllPlayers() { return this._players; },
  getDimension(id) { return makeDimension(id); },
  sendMessage(m) { this._messages.push(m); },
  scoreboard: {
    getObjective(id) { return objectives.get(id) || null; },
    addObjective(id) { if (!objectives.has(id)) objectives.set(id, makeObjective(id)); return objectives.get(id); },
    getObjectives() { return Array.from(objectives.values()); },
    setObjectiveAtDisplaySlot() {}, removeObjective() {}
  },
  gameRules: {}, afterEvents: signals(), beforeEvents: signals()
};
export const system = {
  currentTick: 0,
  run(fn) { try { fn(); } catch (e) {} return 0; },
  runTimeout() { return 0; },
  runInterval(fn) { if (globalThis.__intervals) globalThis.__intervals.push(fn); return 0; },
  clearRun() {},
  afterEvents: { scriptEventReceive: makeSignal() },
  beforeEvents: signals()
};
export class ItemStack { constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; } }
export const BlockPermutation = { resolve(typeId) { return { type: { id: typeId } }; } };
export const PlayerPermissionLevel = { Visitor: 0, Member: 1, Operator: 2 };
export const CommandPermissionLevel = { Any: 0, GameDirectors: 1, Admin: 2, Host: 3, Owner: 4 };
export const CustomCommandStatus = { Success: 0, Failure: 1 };
export const CustomCommandParamType = { String: 0, Integer: 1, Float: 2, Boolean: 3, Entity: 4, Player: 5, Block: 6, Item: 7, Location: 8, Enum: 9 };
`);
    fs.writeFileSync(path.join(uiDir, "index.js"), `
function makeForm(kind) {
  const d = { kind, title: "", body: "", buttons: [], fields: [] };
  const api = {
    title(t) { d.title = String(t); return api; },
    body(b) { d.body = String(b); return api; },
    button(b) { d.buttons.push(String(b)); return api; },
    textField(label, ph, def) { d.fields.push({ type: "text", label, ph, def }); return api; },
    toggle(label, def) { d.fields.push({ type: "toggle", label, def }); return api; },
    dropdown() { return api; }, slider() { return api; },
    show(player) {
      if (globalThis.__shownForms) globalThis.__shownForms.push(d);
      const driver = globalThis.__formDriver;
      return Promise.resolve(driver ? driver(d, player) : { canceled: true });
    }
  };
  return api;
}
export class ActionFormData { constructor() { return makeForm("action"); } }
export class ModalFormData { constructor() { return makeForm("modal"); } }
export class MessageFormData { constructor() { return makeForm("message"); } }
`);
    fs.cpSync(path.join(repoRoot, "behavior_packs", "protection_addon", "scripts"), path.join(sandbox, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(sandbox, "test.mjs"), `
import assert from "node:assert";
import { world, system } from "@minecraft/server";

const store = new Map();
const ownerKey = (o) => typeof o === "string" ? o : (!o ? "world" : (o.name ? String(o.name).toLowerCase() : (o.id !== undefined ? String(o.id) : "world")));
const k = (a, o, key) => a + "\\u0000" + ownerKey(o) + "\\u0000" + key;
globalThis.__sqlite_get_prop_v2__ = (a, o, key) => store.get(k(a, o, key));
globalThis.__sqlite_set_prop_v2__ = (a, o, key, value) => { if (value === undefined) store.delete(k(a, o, key)); else store.set(k(a, o, key), value); };
globalThis.__sqlite_read_json_v3__ = (raw, fallback) => {
  const fb = fallback === undefined ? null : fallback;
  if (raw === undefined || raw === null) return fb;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return raw;
  const text = raw.trim(); if (!text) return fb;
  try { return JSON.parse(text); } catch (e) { return fb; }
};
globalThis.__formDriver = () => ({ canceled: true });
globalThis.__shownForms = [];
globalThis.__particles = [];
globalThis.__intervals = [];
globalThis.__blocks = new Map();

// Instrumentación: cuenta solo los parseos del contenido centinela de zonas y
// marcadores. Las lecturas de otras claves del puente no interfieren.
const realParse = JSON.parse.bind(JSON);
const parseCounts = { zones: 0, markers: 0 };
JSON.parse = function(text, ...rest) {
  if (typeof text === "string") {
    if (text.includes("ZonaCacheSentinel")) parseCounts.zones++;
    if (text.includes("marker-cache-sentinel")) parseCounts.markers++;
  }
  return realParse(text, ...rest);
};
const resetParseCounts = () => { parseCounts.zones = 0; parseCounts.markers = 0; };

// Reloj controlable para el muestreo temporal de partículas.
const realNow = Date.now.bind(Date);
let clockOffset = 0;
Date.now = () => realNow() + clockOffset;

await import("./scripts/main.js");

const commands = {};
system.beforeEvents.startup.emit({ customCommandRegistry: { registerCommand: (def, cb) => { commands[def.name] = cb; } } });

const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);
let n = 0;
const okAsync = async (name, fn) => { await fn(); n++; console.log("  OK " + name); };
const flush = () => new Promise((r) => setTimeout(r, 0));
const ZONES_KEY = k("protection_addon", "world", "protecciones_db");
const MARKERS_KEY = k("protection_addon", "world", "boundary_markers_v1");
function seedZones(zones) { store.set(ZONES_KEY, JSON.stringify(zones)); }
function readZones() { return realParse(store.get(ZONES_KEY) || "[]"); }
function claimZone(owner, overrides) {
  return Object.assign({ id: "z1", name: "ZonaCacheSentinel", owner, isAdmin: false, isCommunity: false, zoneType: "claim", dimension: "minecraft:overworld", min: { x: 0, y: -64, z: 0 }, max: { x: 20, y: 320, z: 20 }, createdAt: Date.now(), trusted: [] }, overrides || {});
}
function mockPlayer(name, loc, op = false) {
  return {
    isValid: true, name, xuid: "X" + name, id: "id-" + name, typeId: "minecraft:player",
    playerPermissionLevel: op ? 2 : 1,
    location: loc || { x: 10, y: 64, z: 10 },
    dimension: world.getDimension("minecraft:overworld"),
    _messages: [], sendMessage(m) { this._messages.push(String(m)); },
    hasTag() { return false; }, playSound() {}, onScreenDisplay: { setActionBar() {} },
    getComponent(id) { return id === "minecraft:health" ? { currentValue: 20, defaultValue: 20, setCurrentValue() {} } : undefined; },
    addEffect() {}, removeEffect() {}
  };
}
function zona(p, sub, param) { commands["s:zona"]({ sourceEntity: p }, sub, param || ""); }
function runIntervals() { for (const fn of globalThis.__intervals) { try { fn(); } catch (e) {} } }
function breakBlock(p, x, y, z) {
  const event = { player: p, block: { x, y, z, typeId: "minecraft:stone", dimension: world.getDimension("minecraft:overworld") }, cancel: false };
  world.beforeEvents.playerBreakBlock.emit(event);
  return event;
}

console.log("Protection Fase 4 - caché activa de loadZones:");

await okAsync("25 rupturas repetidas no re-parsean la BD de zonas", async () => {
  seedZones([claimZone("Owner")]);
  const intruder = mockPlayer("Intruder"); world._players = [intruder];
  const warm = breakBlock(intruder, 10, 64, 10);
  assert.strictEqual(warm.cancel, true, "la primera ruptura consulta las zonas");
  resetParseCounts();
  for (let i = 0; i < 25; i++) {
    const event = breakBlock(intruder, 10, 64, 10);
    assert.strictEqual(event.cancel, true, "ruptura " + i + " sigue protegida");
  }
  eq(parseCounts.zones, 0, "cero re-parseos con la caché caliente");
});

await okAsync("saveZones (ruta trust) actualiza la caché sin re-parseo", async () => {
  const owner = mockPlayer("Owner"); world._players = [owner];
  zona(owner, "confiar", "Amigo"); await flush();
  const saved = readZones().find((z) => z.id === "z1");
  assert.ok(saved.trusted.includes("Amigo"), "trust persistido");
  resetParseCounts();
  const amigo = mockPlayer("Amigo");
  const event = breakBlock(amigo, 10, 64, 10);
  assert.ok(!event.cancel, "el jugador confiado puede romper (caché actualizada)");
  eq(parseCounts.zones, 0, "saveZones cebó la caché: sin re-parseo");
});

await okAsync("rehidratación del demonio invalida la caché (exactamente 1 parseo)", async () => {
  // Reemplazo directo del store como haría sqlite:load del demonio: la zona se
  // encoge y el bloque (10,64,10) queda fuera.
  seedZones([claimZone("Owner", { max: { x: 5, y: 320, z: 20 } })]);
  const intruder = mockPlayer("Intruder"); world._players = [intruder];
  resetParseCounts();
  const first = breakBlock(intruder, 10, 64, 10);
  assert.ok(!first.cancel, "la zona encogida ya no cubre el bloque");
  eq(parseCounts.zones, 1, "un único re-parseo tras el reemplazo");
  resetParseCounts();
  for (let i = 0; i < 10; i++) assert.ok(!breakBlock(intruder, 10, 64, 10).cancel, "lectura posterior coherente");
  eq(parseCounts.zones, 0, "la nueva versión queda cacheada");
});

await okAsync("JSON corrupto no envenena la caché y se recupera al rehidratar", async () => {
  const goodRaw = store.get(ZONES_KEY);
  store.set(ZONES_KEY, "[corrupto");
  const intruder = mockPlayer("Intruder"); world._players = [intruder];
  const corruptEvent = breakBlock(intruder, 2, 64, 2);
  assert.ok(!corruptEvent.cancel, "sin datos válidos el handler no inventa zonas");
  resetParseCounts();
  store.set(ZONES_KEY, goodRaw); // misma cadena: debe acertar la caché previa
  const recovered = breakBlock(intruder, 2, 64, 2);
  assert.strictEqual(recovered.cancel, true, "la protección vuelve tras la rehidratación");
  eq(parseCounts.zones, 0, "el fallo no destruyó la caché (hit de identidad)");
});

console.log("Protection Fase 4 - caché de marcadores de límites:");

await okAsync("loadBoundaryMarkers cachea por identidad e invalida ante reemplazos", async () => {
  seedZones([claimZone("Owner")]);
  const marker = { id: "marker-cache-sentinel", dimension: "minecraft:overworld", x: 10, y: 64, z: 10, minX: 0, maxX: 20, minZ: 0, maxZ: 20, createdBy: "owner" };
  store.set(MARKERS_KEY, JSON.stringify([marker]));
  globalThis.__blocks.set("minecraft:overworld:10:64:10", { typeId: "minecraft:redstone_block" });
  const far = mockPlayer("Far", { x: 500, y: 64, z: 500 }); world._players = [far];
  resetParseCounts();
  runIntervals();
  eq(parseCounts.markers, 1, "primer ciclo: parseo de marcadores");
  assert.ok(store.get(MARKERS_KEY).includes("marker-cache-sentinel"), "el marcador válido no se purga");
  resetParseCounts();
  runIntervals();
  eq(parseCounts.markers, 0, "segundo ciclo: hit de identidad");
  store.set(MARKERS_KEY, JSON.stringify([Object.assign({}, marker, { y: 65 })]));
  globalThis.__blocks.set("minecraft:overworld:10:65:10", { typeId: "minecraft:redstone_block" });
  resetParseCounts();
  runIntervals();
  eq(parseCounts.markers, 1, "reemplazo del demonio: re-parseo");
  resetParseCounts();
  runIntervals();
  eq(parseCounts.markers, 0, "nueva versión cacheada");
});

console.log("Protection Fase 4 - throttling de partículas de bordes:");

await okAsync("jugador quieto: sin repintado en ticks consecutivos; movimiento repinta al instante", async () => {
  store.delete(MARKERS_KEY);
  globalThis.__blocks.clear();
  seedZones([claimZone("Owner")]);
  const owner = mockPlayer("Owner", { x: 10, y: 64, z: 10 }); world._players = [owner];
  zona(owner, "bordes"); await flush();
  assert.ok(owner._messages.some((m) => m.includes("visibles")), "límites activados");
  globalThis.__particles = [];
  runIntervals();
  assert.ok(globalThis.__particles.length > 0, "primer render inmediato");
  globalThis.__particles = [];
  runIntervals();
  eq(globalThis.__particles.length, 0, "tick consecutivo sin cambios: throttled");
  globalThis.__particles = [];
  runIntervals();
  eq(globalThis.__particles.length, 0, "segundo tick consecutivo: throttled");
  owner.location = { x: 18, y: 64, z: 10 }; // nueva celda de 4 bloques
  globalThis.__particles = [];
  runIntervals();
  assert.ok(globalThis.__particles.length > 0, "movimiento: repintado inmediato");
  globalThis.__particles = [];
  runIntervals();
  eq(globalThis.__particles.length, 0, "quieto de nuevo: throttled");
});

await okAsync("refresco temporal a los 2 s y ocultado limpia el render", async () => {
  const owner = world._players[0];
  clockOffset += 2100;
  globalThis.__particles = [];
  runIntervals();
  assert.ok(globalThis.__particles.length > 0, "pasados 2 s se refresca aunque no haya movimiento");
  globalThis.__particles = [];
  runIntervals();
  eq(globalThis.__particles.length, 0, "la ventana de 2 s se reinicia tras el refresco");
  zona(owner, "bordes"); await flush();
  assert.ok(owner._messages.some((m) => m.includes("ocultos")), "límites ocultados");
  globalThis.__particles = [];
  runIntervals();
  eq(globalThis.__particles.length, 0, "sin preview no hay partículas");
});

console.log("\\n" + n + "/" + n + " escenarios de protection fase 4 en verde.");
`);
    const output = execFileSync(process.execPath, ["test.mjs"], { cwd: sandbox, encoding: "utf8", stdio: "pipe" });
    process.stdout.write(output);
    const match = output.match(/(\d+)\/(\d+) escenarios de protection fase 4/);
    if (match) passed += Number(match[1]);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

try {
  runProtectionPhase4Suite();
  console.log("\nProtection Fase 4: " + passed + " escenarios en verde.");
} catch (err) {
  console.error("\n❌ FALLO EN TEST PROTECTION FASE 4:", err && err.stack ? err.stack : err);
  process.exit(1);
}