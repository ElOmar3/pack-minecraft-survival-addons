// Test funcional Fase 3 de home_spawn_addon:
// La rama faltante /s:delhome (y su alias /s:borrarcasa) elimina efectivamente el
// registro de la BD: el Home principal (props home_*) y las Casas Extra (props
// home_*_N + marcador compartido xhome_N_s). Antes el comando estaba registrado
// y documentado pero el router no tenía rama, así que no borraba nada.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
let passed = 0;

function runHomeSpawnSuite() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "home-p3-"));
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
export const world = {
  _players: [], _commands: [], _messages: [],
  getAllPlayers() { return this._players; },
  getDimension() { return { id: "minecraft:overworld", runCommand(cmd) { world._commands.push(cmd); return { successCount: 1 }; }, getBlock() { return undefined; }, getEntities() { return []; } }; },
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
  runInterval() { return 0; }, clearRun() {},
  afterEvents: { scriptEventReceive: makeSignal() },
  beforeEvents: signals()
};
export class ItemStack { constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; } }
export const EnchantmentTypes = {};
export const EquipmentSlot = { Mainhand: "Mainhand", Offhand: "Offhand", Head: "Head", Chest: "Chest", Legs: "Legs", Feet: "Feet" };
export const PlayerPermissionLevel = { Visitor: 0, Member: 1, Operator: 2 };
export const CommandPermissionLevel = { Any: 0, GameDirectors: 1, Admin: 2, Host: 3, Owner: 4 };
export const CustomCommandStatus = { Success: 0, Failure: 1 };
export const CustomCommandParamType = { String: 0, Integer: 1, Float: 2, Boolean: 3, Entity: 4, Player: 5, Block: 6, Item: 7, Location: 8, Enum: 9 };
`);
    fs.writeFileSync(path.join(uiDir, "index.js"), `
function formProxy() { const proxy = new Proxy({}, { get: (t, p) => p === "show" ? () => Promise.resolve({ canceled: true, formValues: [] }) : () => proxy }); return proxy; }
export class ActionFormData { constructor() { return formProxy(); } }
export class ModalFormData { constructor() { return formProxy(); } }
export class MessageFormData { constructor() { return formProxy(); } }
`);
    fs.cpSync(path.join(repoRoot, "behavior_packs", "home_spawn_addon", "scripts"), path.join(sandbox, "scripts"), { recursive: true });
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

await import("./scripts/main.js");

const commands = {};
system.beforeEvents.startup.emit({ customCommandRegistry: { registerCommand: (def, cb) => { commands[def.name] = cb; } } });

const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);
let n = 0;
const okAsync = async (name, fn) => { await fn(); n++; console.log("  OK " + name); };
const flush = () => new Promise((r) => setTimeout(r, 0));
function mockPlayer(name) {
  return { isValid: true, name, xuid: "X" + name, id: "id-" + name, typeId: "minecraft:player", playerPermissionLevel: 1, location: { x: 100, y: 64, z: 200 }, dimension: world.getDimension(), _messages: [], sendMessage(m) { this._messages.push(String(m)); }, hasTag() { return false; }, getTags() { return []; }, addTag() {}, removeTag() {}, playSound() {}, teleport() {}, onScreenDisplay: { setActionBar() {} } };
}
const prop = (p, key) => store.get(k("home_spawn_addon", p, key));
function cmd(p, name, slot) { commands["s:" + name]({ sourceEntity: p }, slot); }
function unlockExtra(p, count) { world.scoreboard.addObjective("extra_homes_shared", "extra").setScore(p, count); }

console.log("Home Spawn Fase 3 - rama /s:delhome:");

await okAsync("delhome elimina el Home principal de la BD", async () => {
  const p = mockPlayer("Owner"); world._players = [p];
  cmd(p, "sethome", 1); await flush();
  assert.ok(prop(p, "home_x") !== undefined, "home principal guardado");
  cmd(p, "delhome", 1); await flush();
  eq(prop(p, "home_x"), undefined, "home_x eliminado");
  eq(prop(p, "home_y"), undefined, "home_y eliminado");
  eq(prop(p, "home_z"), undefined, "home_z eliminado");
  eq(prop(p, "home_dimension"), undefined, "home_dimension eliminado");
  assert.ok(p._messages.some((m) => m.includes("eliminado correctamente")), "confirmación de borrado");
  cmd(p, "home"); await flush();
  assert.ok(p._messages.some((m) => m.includes("No tienes un Home configurado")), "home ya no resuelve");
});

await okAsync("delhome sin Home principal avisa que no hay nada", async () => {
  const p = mockPlayer("Empty"); world._players = [p];
  cmd(p, "delhome", 1); await flush();
  assert.ok(p._messages.some((m) => m.includes("No tienes un Home principal configurado")), "aviso de home inexistente");
});

await okAsync("delhome elimina una Casa Extra y limpia el almacenamiento compartido", async () => {
  const p = mockPlayer("Extra"); world._players = [p];
  unlockExtra(p, 1);
  cmd(p, "sethome", 2); await flush();
  assert.ok(prop(p, "home_x_1") !== undefined, "casa extra guardada en el bridge");
  eq(world.scoreboard.getObjective("xhome_1_s").getScore(p), 1, "marcador compartido activo");
  cmd(p, "delhome", 2); await flush();
  eq(prop(p, "home_x_1"), undefined, "home_x_1 eliminado");
  eq(prop(p, "home_dim_1"), undefined, "home_dim_1 eliminado");
  eq(world.scoreboard.getObjective("xhome_1_s").getScore(p), 0, "marcador compartido apagado");
  assert.ok(p._messages.some((m) => m.includes("Casa Extra #2 fue eliminada")), "confirmación de borrado");
});

await okAsync("delhome de casa extra inexistente avisa", async () => {
  const p = mockPlayer("NoExtra"); world._players = [p];
  cmd(p, "delhome", 2); await flush();
  assert.ok(p._messages.some((m) => m.includes("No tienes guardada la Casa Extra #2")), "aviso de casa extra inexistente");
});

await okAsync("delhome valida el rango de slot (1-5)", async () => {
  const p = mockPlayer("BadSlot"); world._players = [p];
  cmd(p, "delhome", 9); await flush();
  assert.ok(p._messages.some((m) => m.includes("Usa") && m.includes("/s:delhome 1")), "aviso de uso para slot inválido");
});

await okAsync("borrarcasa es alias funcional de delhome", async () => {
  const p = mockPlayer("Alias"); world._players = [p];
  cmd(p, "sethome", 1); await flush();
  cmd(p, "borrarcasa", 1); await flush();
  eq(prop(p, "home_x"), undefined, "el alias borrarcasa elimina el home");
});

console.log("\\n" + n + "/" + n + " escenarios de home_spawn en verde.");
`);
    const output = execFileSync(process.execPath, ["test.mjs"], { cwd: sandbox, encoding: "utf8", stdio: "pipe" });
    process.stdout.write(output);
    const match = output.match(/(\d+)\/(\d+) escenarios de home_spawn/);
    if (match) passed += Number(match[1]);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

try {
  runHomeSpawnSuite();
  console.log("\nHome Spawn Fase 3: " + passed + " escenarios en verde.");
} catch (err) {
  console.error("\n❌ FALLO EN TEST HOME SPAWN FASE 3:", err && err.stack ? err.stack : err);
  process.exit(1);
}