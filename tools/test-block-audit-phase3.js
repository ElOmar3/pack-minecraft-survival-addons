// Test funcional Fase 3 de block_audit_addon:
// La retención global subió de 100 a 1.500 eventos (buffer circular en RAM):
// con 100, /s:historialbloque y el export quedaban inútiles en un servidor
// activo porque el ruido de otros jugadores expulsaba todo en segundos.
// Se verifica: recorte al cargar, retención en vivo, historial por jugador,
// índice por bloque, vara de auditoría, explosiones y eviction acotada.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
let passed = 0;

function runBlockAuditSuite() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "blockaudit-p3-"));
  try {
    const serverDir = path.join(sandbox, "node_modules", "@minecraft", "server");
    fs.mkdirSync(serverDir, { recursive: true });
    fs.writeFileSync(path.join(serverDir, "package.json"), JSON.stringify({ name: "@minecraft/server", version: "2.11.0", type: "module", main: "index.js" }));
    fs.writeFileSync(path.join(serverDir, "index.js"), `
function makeSignal() { return { _fns: [], subscribe(fn) { this._fns.push(fn); }, emit(e) { for (const fn of this._fns) fn(e); } }; }
const signals = () => new Proxy({}, { get: (t, p) => (p in t) ? t[p] : (t[p] = makeSignal()) });
export const world = {
  _players: [], _messages: [],
  getAllPlayers() { return this._players; },
  sendMessage(m) { this._messages.push(String(m)); },
  afterEvents: signals(), beforeEvents: signals()
};
export const system = {
  currentTick: 0, _intervals: [],
  run(fn) { try { fn(); } catch (e) {} return 0; },
  runTimeout() { return 0; },
  runInterval(fn, ticks) { this._intervals.push({ fn, ticks }); return this._intervals.length; },
  clearRun() {},
  afterEvents: { scriptEventReceive: makeSignal() },
  beforeEvents: signals()
};
export class ItemStack {
  constructor(itemId, amount = 1) { this.typeId = itemId; this.amount = amount; }
  setLore() {} getComponent() { return undefined; }
}
export const EquipmentSlot = { Head: "head", Chest: "chest", Legs: "legs", Feet: "feet", Mainhand: "mainhand" };
export const EnchantmentTypes = { get() { return undefined; } };
export const CommandPermissionLevel = { Any: 0, GameDirectors: 1, Admin: 2, Host: 3, Owner: 4 };
export const CustomCommandStatus = { Success: 0, Failure: 1 };
export const CustomCommandParamType = { String: 0, Integer: 1, Float: 2, Boolean: 3, Entity: 4, Player: 5, Block: 6, Item: 7, Location: 8, Enum: 9 };
export const PlayerPermissionLevel = { Visitor: 0, Member: 1, Operator: 2 };
`);
    fs.cpSync(path.join(repoRoot, "behavior_packs", "block_audit_addon", "scripts"), path.join(sandbox, "audit"), { recursive: true });
    fs.writeFileSync(path.join(sandbox, "test.mjs"), `
import assert from "node:assert";
import { world, system } from "@minecraft/server";

const store = new Map();
const ownerKey = (o) => typeof o === "string" ? o : (!o ? "world" : (o.name ? String(o.name).toLowerCase() : (o.id !== undefined ? String(o.id) : "world")));
const k = (a, o, key) => a + "\\u0000" + ownerKey(o) + "\\u0000" + key;
const kA = (o, key) => k("block_audit_addon", o, key);
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

// Historial legacy de 2.000 eventos: al cargar debe recortarse a 1.500.
const legacy = [];
for (let i = 0; i < 2000; i++) {
  legacy.push({ t: 1700000000000 + i, a: "break", p: "Legacy", xuid: "", d: "minecraft:overworld", x: i - 2000, y: 64, z: 0, b: "minecraft:stone" });
}
store.set(kA("world", "block_audit_log_v1"), JSON.stringify(legacy));

const dumpLines = [];
console.warn = (...args) => { const line = args.join(" "); if (line.startsWith("[BLOCK_AUDIT_DUMP] ")) dumpLines.push(line); };

await import("./audit/main.js");

const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);
let n = 0;
const okAsync = async (name, fn) => { await fn(); n++; console.log("  OK " + name); };
const flush = () => new Promise((r) => setTimeout(r, 0));

const registered = new Map();
system.beforeEvents.startup.emit({ customCommandRegistry: { registerCommand(def, cb) { registered.set(def.name, { def, cb }); } } });
assert.ok(registered.has("s:auditarbloques"), "comando auditarbloques registrado");
assert.ok(registered.has("s:historialbloque"), "comando historialbloque registrado");

function mockPlayer(name, op = false) {
  return {
    isValid: true, name, xuid: "xuid-" + name, typeId: "minecraft:player",
    playerPermissionLevel: op ? 2 : 1,
    dimension: { id: "minecraft:overworld" },
    _messages: [],
    sendMessage(m) { this._messages.push(String(m)); },
    hasTag() { return false; },
    getComponent(cid) {
      if (cid === "minecraft:equippable") return { getEquipment: () => globalThis.__wandItem };
      return undefined;
    }
  };
}
const op = mockPlayer("Op", true);
function breakBlock(player, x, y, z, blockId = "minecraft:stone") {
  world.afterEvents.playerBreakBlock.emit({
    player,
    block: { location: { x, y, z }, dimension: { id: "minecraft:overworld" } },
    brokenBlockPermutation: { type: { id: blockId } }
  });
}
function placeBlock(player, x, y, z, blockId = "minecraft:oak_planks") {
  world.afterEvents.playerPlaceBlock.emit({
    player,
    block: { location: { x, y, z }, dimension: { id: "minecraft:overworld" }, permutation: { type: { id: blockId } } }
  });
}
function dump() {
  dumpLines.length = 0;
  system.afterEvents.scriptEventReceive.emit({ id: "blockaudit:export", message: "" });
  const line = dumpLines.find((l) => l.startsWith("[BLOCK_AUDIT_DUMP] "));
  assert.ok(line, "export dump emitido");
  return JSON.parse(line.slice("[BLOCK_AUDIT_DUMP] ".length));
}
function audit(x, y, z) {
  op._messages.length = 0;
  registered.get("s:auditarbloques").cb({ sourceEntity: op }, x, y, z);
  return op._messages.join("\\n");
}
const persisted = () => JSON.parse(store.get(kA("world", "block_audit_log_v1")) ?? "[]");

console.log("BlockAudit Fase 3 - buffer circular de retención:");

await okAsync("la carga inicial recorta el historial persistido a 1.500", async () => {
  const entries = dump();
  eq(entries.length, 1500, "buffer acotado al cargar");
  eq(entries[0].x, -1500, "se conservan los más recientes");
  eq(entries[entries.length - 1].x, -1, "el último legacy sobrevive");
});

await okAsync("el buffer en vivo retiene los 1.500 más recientes y persiste acotado", async () => {
  const minero = mockPlayer("Minero");
  for (let i = 0; i < 1600; i++) breakBlock(minero, i, 64, 0);
  const entries = dump();
  eq(entries.length, 1500, "retención circular en vivo");
  eq(entries[0].x, 100, "los 100 más viejos fueron descartados");
  eq(entries[entries.length - 1].x, 1599, "el evento más reciente presente");
  eq(persisted().length, 1500, "SQLite persiste el mismo buffer acotado");
});

await okAsync("el historial por jugador sobrevive al ruido de otros", async () => {
  const griefer = mockPlayer("Griefer");
  const ruido = mockPlayer("Ruido");
  breakBlock(griefer, 500, 64, 500, "minecraft:diamond_block");
  for (let i = 0; i < 1200; i++) breakBlock(ruido, 2000 + i, 64, 0);
  op._messages.length = 0;
  registered.get("s:historialbloque").cb({ sourceEntity: op }, "Griefer");
  const text = op._messages.join("\\n");
  assert.ok(text.includes("Últimos cambios de Griefer"), "historial encontrado");
  assert.ok(text.includes("en 500,64,500"), "el bloque del jugador sigue en el buffer");
  assert.ok(!text.includes("Sin registros"), "no quedó expulsado por el ruido");
});

await okAsync("auditarbloques consulta el índice por bloque", async () => {
  const constructor = mockPlayer("Constructor");
  placeBlock(constructor, 10, 64, 10, "minecraft:oak_planks");
  breakBlock(constructor, 10, 64, 10, "minecraft:stone");
  const text = audit(10, 64, 10);
  assert.ok(text.includes("Historial en 10, 64, 10"), "encabezado de historial");
  assert.ok(text.includes("colocó oak_planks"), "colocación registrada");
  assert.ok(text.includes("rompió stone"), "ruptura registrada");
  assert.ok(text.includes("Constructor"), "autor registrado");
});

await okAsync("la vara de auditoría responde al golpear un bloque", async () => {
  globalThis.__wandItem = { typeId: "minecraft:stick", nameTag: "§b§lVara de Auditoría" };
  op._messages.length = 0;
  world.afterEvents.entityHitBlock.emit({
    damagingEntity: op,
    hitBlock: { location: { x: 10, y: 64, z: 10 }, dimension: { id: "minecraft:overworld" } }
  });
  globalThis.__wandItem = undefined;
  const text = op._messages.join("\\n");
  assert.ok(text.includes("Historial del Bloque en 10, 64, 10"), "la vara consulta el historial");
  assert.ok(text.includes("Constructor"), "muestra el autor real");
});

await okAsync("las explosiones se registran sin atribución falsa", async () => {
  world.afterEvents.blockExplode.emit({
    block: { location: { x: 20, y: 64, z: 20 }, dimension: { id: "minecraft:overworld" } },
    explodedBlockPermutation: { type: { id: "minecraft:stone" } },
    source: { typeId: "minecraft:tnt" },
    dimension: { id: "minecraft:overworld" }
  });
  const entry = dump().find((e) => e.x === 20 && e.y === 64 && e.z === 20);
  assert.ok(entry, "explosión en el buffer");
  eq(entry.a, "explode", "acción explode");
  eq(entry.p, "unknown", "TNT no se atribuye a un jugador");
  eq(entry.source, "minecraft:tnt", "fuente registrada");
  const text = audit(20, 64, 20);
  assert.ok(text.includes("explotó stone"), "historial de explosión visible");
  assert.ok(text.includes("fuente: tnt"), "fuente visible");
});

await okAsync("el índice por bloque evicta lo viejo sin crecer sin límite", async () => {
  const masivo = mockPlayer("Masivo");
  for (let i = 0; i < 5200; i++) breakBlock(masivo, 1000 + i, 64, 0);
  const viejo = audit(1000, 64, 0);
  assert.ok(viejo.includes("Sin registros"), "el bloque más viejo fue expulsado");
  const reciente = audit(6199, 64, 0);
  assert.ok(reciente.includes("Masivo"), "el bloque reciente conserva historial");
  eq(dump().length, 1500, "el buffer global sigue acotado");
  eq(persisted().length, 1500, "la persistencia sigue acotada");
});

console.log("\\n" + n + "/" + n + " escenarios de block_audit en verde.");
`);
    const output = execFileSync(process.execPath, ["test.mjs"], { cwd: sandbox, encoding: "utf8", stdio: "pipe" });
    process.stdout.write(output);
    const match = output.match(/(\d+)\/(\d+) escenarios de block_audit/);
    if (match) passed += Number(match[1]);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

try {
  runBlockAuditSuite();
  console.log("\nBlockAudit Fase 3: " + passed + " escenarios en verde.");
} catch (err) {
  console.error("\n❌ FALLO EN TEST BLOCK_AUDIT FASE 3:", err && err.stack ? err.stack : err);
  process.exit(1);
}