// Test funcional Fase 3 de protection_addon:
// 1. toggleZoneBorders (/s:zona bordes) muestra/oculta el perímetro con partículas
//    reutilizando el gestor de partículas existente (antes: ReferenceError).
// 2. openZoneFlagsGUI (/s:zona banderas) inicializa, edita y persiste zone.flags
//    en el bridge, reautorizando al dueño/operador (antes: ReferenceError).
// 3. La bandera pvp tiene efecto real sobre el daño entre jugadores en el claim.
// 4. Cualquier ruta de guardado (loadZonesForUpdate) serializa flags inicializadas.
// Se carga main.js con mocks permisivos y se conduce por el custom command s:zona.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
let passed = 0;

function runProtectionSuite() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "prot-p3-"));
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
    getBlock() { return undefined; },
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

await import("./scripts/main.js");

const commands = {};
system.beforeEvents.startup.emit({ customCommandRegistry: { registerCommand: (def, cb) => { commands[def.name] = cb; } } });

const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);
let n = 0;
const okAsync = async (name, fn) => { await fn(); n++; console.log("  OK " + name); };
const flush = () => new Promise((r) => setTimeout(r, 0));
const ZONES_KEY = k("protection_addon", "world", "protecciones_db");
function seedZones(zones) { store.set(ZONES_KEY, JSON.stringify(zones)); }
function readZones() { return JSON.parse(store.get(ZONES_KEY) || "[]"); }
function claimZone(owner, flags) {
  const z = { id: "z1", name: "Base de " + owner, owner, isAdmin: false, isCommunity: false, zoneType: "claim", dimension: "minecraft:overworld", min: { x: 0, y: -64, z: 0 }, max: { x: 20, y: 320, z: 20 }, createdAt: Date.now(), trusted: [] };
  if (flags !== undefined) z.flags = flags;
  return z;
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
function hurt(victim, attacker, damage) {
  const event = { hurtEntity: victim, damageSource: { damagingEntity: attacker }, damage: damage === undefined ? 5 : damage, cancel: false };
  world.beforeEvents.entityDamage.emit(event);
  return event;
}

console.log("Protection Fase 3 - toggleZoneBorders:");

await okAsync("muestra el perímetro con partículas y se puede ocultar", async () => {
  seedZones([claimZone("Owner")]);
  const p = mockPlayer("Owner"); world._players = [p];
  globalThis.__shownForms = []; globalThis.__particles = [];
  zona(p, "bordes"); await flush();
  assert.ok(p._messages.some((m) => m.includes("visibles")), "mensaje de límites visibles");
  runIntervals();
  assert.ok(globalThis.__particles.length > 0, "se generaron partículas del perímetro");
  assert.ok(globalThis.__particles.every((pt) => pt.name === "minecraft:colored_flame_particle"), "partícula de límites canónica");
  globalThis.__particles = [];
  zona(p, "bordes"); await flush();
  assert.ok(p._messages.some((m) => m.includes("ocultos")), "mensaje de límites ocultos");
  runIntervals();
  eq(globalThis.__particles.length, 0, "sin partículas tras ocultar");
});

await okAsync("rechaza mostrar límites fuera de un terreno propio", async () => {
  seedZones([claimZone("Owner")]);
  const p = mockPlayer("Wanderer", { x: 500, y: 64, z: 500 }); world._players = [p];
  zona(p, "bordes"); await flush();
  assert.ok(p._messages.some((m) => m.includes("Debes estar dentro de tu terreno")), "aviso de terreno requerido");
});

console.log("Protection Fase 3 - openZoneFlagsGUI:");

await okAsync("inicializa banderas por defecto y persiste los cambios", async () => {
  seedZones([claimZone("Owner")]); // sin flags: deben inicializarse
  const p = mockPlayer("Owner"); world._players = [p];
  globalThis.__shownForms = [];
  globalThis.__formDriver = (d) => d.kind === "modal" ? { canceled: false, formValues: [false, true, true] } : { canceled: true };
  zona(p, "banderas"); await flush();
  const modal = globalThis.__shownForms.find((f) => f.kind === "modal" && f.title.includes("Banderas"));
  assert.ok(modal, "GUI de banderas mostrada");
  eq(modal.fields.map((f) => f.def), [true, false, false], "defaults: pvp ON, explosiones OFF, puertas OFF");
  const saved = readZones().find((z) => z.id === "z1");
  eq(saved.flags, { pvp: false, explosions: true, visitor_doors: true }, "flags persistidas en el bridge");
  assert.ok(p._messages.some((m) => m.includes("actualizadas")), "confirmación enviada");
});

await okAsync("rechaza configurar banderas a un no-dueño sin op", async () => {
  seedZones([claimZone("Owner")]);
  const p = mockPlayer("Intruder"); world._players = [p];
  globalThis.__shownForms = [];
  globalThis.__formDriver = (d) => d.kind === "modal" ? { canceled: false, formValues: [false, false, false] } : { canceled: true };
  zona(p, "banderas"); await flush();
  assert.ok(!globalThis.__shownForms.some((f) => f.kind === "modal"), "no se abre la GUI para un intruso");
  assert.ok(p._messages.some((m) => m.includes("Debes estar dentro de tu terreno")), "aviso de terreno propio requerido");
  const saved = readZones().find((z) => z.id === "z1");
  assert.ok(saved.flags === undefined, "las flags del dueño no fueron alteradas");
});

console.log("Protection Fase 3 - efecto de la bandera pvp:");

await okAsync("pvp=false bloquea el daño entre jugadores dentro del claim", async () => {
  seedZones([claimZone("Owner", { pvp: false, explosions: false, visitor_doors: false })]);
  const victim = mockPlayer("Owner"); const attacker = mockPlayer("Visitor");
  world._players = [victim, attacker];
  const event = hurt(victim, attacker, 5);
  assert.strictEqual(event.cancel, true, "daño PvP cancelado");
});

await okAsync("regresión: pvp por defecto permite el daño en claim privado", async () => {
  seedZones([claimZone("Owner")]); // sin flags => pvp permitido (comportamiento histórico)
  const victim = mockPlayer("Owner"); const attacker = mockPlayer("Visitor");
  world._players = [victim, attacker];
  const event = hurt(victim, attacker, 5);
  assert.ok(!event.cancel, "daño PvP no cancelado por defecto");
});

console.log("Protection Fase 3 - serialización de flags en cualquier guardado:");

await okAsync("loadZonesForUpdate inicializa flags al guardar (ruta trust)", async () => {
  seedZones([claimZone("Owner")]); // sin flags
  const p = mockPlayer("Owner"); world._players = [p];
  zona(p, "confiar", "Amigo"); await flush();
  const saved = readZones().find((z) => z.id === "z1");
  eq(saved.flags, { pvp: true, explosions: false, visitor_doors: false }, "flags inicializadas y serializadas");
  assert.ok(saved.trusted.includes("Amigo"), "trust aplicado");
});

console.log("\\n" + n + "/" + n + " escenarios de protection en verde.");
`);
    const output = execFileSync(process.execPath, ["test.mjs"], { cwd: sandbox, encoding: "utf8", stdio: "pipe" });
    process.stdout.write(output);
    const match = output.match(/(\d+)\/(\d+) escenarios de protection/);
    if (match) passed += Number(match[1]);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

try {
  runProtectionSuite();
  console.log("\nProtection Fase 3: " + passed + " escenarios en verde.");
} catch (err) {
  console.error("\n❌ FALLO EN TEST PROTECTION FASE 3:", err && err.stack ? err.stack : err);
  process.exit(1);
}