// Test funcional Fase 3 de ranks_addon + rewards_addon (SSOT de tiempo de juego):
// 1. rewards persiste playtime_state_v1 (totalSeconds/rewardSeconds) como fuente única.
// 2. Las claves legacy (playtime_seconds/playtime_total_seconds) se migran al SSOT.
// 3. ranks lee las horas desde playtime_state_v1 y habilita el ascenso desde Recluta.
// 4. El ascenso consume saldo y asigna el rango; sin horas queda bloqueado.
// Ambos addons se cargan en el mismo sandbox compartiendo el puente SQLite (como en producción).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
let passed = 0;

function runRanksRewardsSuite() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "ranks-rewards-p3-"));
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
  return { id: id || "minecraft:overworld", runCommand(cmd) { world._commands.push(cmd); return { successCount: 1 }; }, getBlock() { return undefined; }, getEntities() { return []; }, spawnParticle() {} };
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
    fs.cpSync(path.join(repoRoot, "behavior_packs", "rewards_addon", "scripts"), path.join(sandbox, "rewards"), { recursive: true });
    fs.cpSync(path.join(repoRoot, "behavior_packs", "ranks_addon", "scripts"), path.join(sandbox, "ranks"), { recursive: true });
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
globalThis.__intervals = [];

function mockPlayer(name) {
  return { isValid: true, name, xuid: "X" + name, id: "id-" + name, typeId: "minecraft:player", playerPermissionLevel: 1, location: { x: 0, y: 64, z: 0 }, dimension: world.getDimension("minecraft:overworld"), _messages: [], sendMessage(m) { this._messages.push(String(m)); }, hasTag() { return false; }, getTags() { return []; }, addTag() {}, removeTag() {}, playSound() {}, teleport() {}, getComponent(id) { return id === "minecraft:health" ? { currentValue: 20, defaultValue: 20 } : undefined; } };
}
const Hero = mockPlayer("Hero");
const Legacy = mockPlayer("Legacy");
const Newbie = mockPlayer("Newbie");
world._players = [Hero, Legacy];
// Datos legacy previos a la unificación: solo playtime_total_seconds (1 hora).
store.set(k("rewards_addon", Legacy, "playtime_total_seconds"), 3600);
store.set(k("rewards_addon", Legacy, "playtime_seconds"), 0);

await import("./rewards/main.js");

const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);
let n = 0;
const okAsync = async (name, fn) => { await fn(); n++; console.log("  OK " + name); };
const flush = () => new Promise((r) => setTimeout(r, 0));
function runIntervals() { for (const fn of globalThis.__intervals) { try { fn(); } catch (e) {} } }
function readState(p) { const raw = store.get(k("rewards_addon", p, "playtime_state_v1")); return raw ? JSON.parse(raw) : null; }
function setMoney(p, v) { world.scoreboard.addObjective("money", "Dinero").setScore(p, v); }
function getMoney(p) { const o = world.scoreboard.getObjective("money"); return o ? (o.getScore(p) ?? 0) : 0; }

// Acumular 2 horas de juego (144000 ticks) y persistir con el intervalo de flush.
system.currentTick = 144000;
runIntervals();

console.log("Ranks+Rewards Fase 3 - SSOT playtime_state_v1:");

await okAsync("rewards persiste playtime_state_v1 con las horas acumuladas", async () => {
  const state = readState(Hero);
  assert.ok(state, "SSOT escrito para Hero");
  eq(state.totalSeconds, 7200, "2 horas acumuladas en el SSOT");
});

await okAsync("las claves legacy se migran al SSOT", async () => {
  const state = readState(Legacy);
  assert.ok(state, "SSOT escrito para Legacy");
  eq(state.totalSeconds, 10800, "1 hora legacy + 2 horas acumuladas");
});

// Cargar ranks compartiendo el mismo puente: debe leer el SSOT que escribió rewards.
await import("./ranks/main.js");
const commands = {};
system.beforeEvents.startup.emit({ customCommandRegistry: { registerCommand: (def, cb) => { commands[def.name] = cb; } } });
function rankup(p) { commands["s:rankup"]({ sourceEntity: p }); }
const rankupForm = () => globalThis.__shownForms.find((f) => f.title.includes("Ascenso de Rango"));

console.log("Ranks+Rewards Fase 3 - ascenso desde Recluta:");

await okAsync("ranks lee las horas del SSOT y habilita el ascenso", async () => {
  setMoney(Hero, 5000);
  globalThis.__shownForms = [];
  globalThis.__formDriver = () => ({ canceled: true });
  rankup(Hero); await flush();
  const form = rankupForm();
  assert.ok(form, "menú de ascenso mostrado");
  assert.ok(form.body.includes("2/2 horas"), "horas leídas del SSOT (2/2)");
  assert.ok(form.buttons.some((b) => b.includes("Ascender de Rango ahora")), "ascenso habilitado");
});

await okAsync("el ascenso consume saldo y asigna el rango Explorador", async () => {
  globalThis.__shownForms = [];
  globalThis.__formDriver = (d) => d.title.includes("Ascenso de Rango") ? { canceled: false, selection: 0 } : { canceled: true };
  rankup(Hero); await flush();
  eq(store.get(k("ranks_addon", Hero, "player_survival_rank")), "explorador", "rango asignado");
  eq(getMoney(Hero), 0, "costo de 5000 descontado");
});

await okAsync("regresión: sin horas jugadas el ascenso queda bloqueado", async () => {
  setMoney(Newbie, 5000);
  globalThis.__shownForms = [];
  globalThis.__formDriver = () => ({ canceled: true });
  rankup(Newbie); await flush();
  const form = rankupForm();
  assert.ok(form, "menú de ascenso mostrado");
  assert.ok(form.body.includes("0/2 horas"), "sin horas acumuladas (0/2)");
  assert.ok(form.buttons.some((b) => b.includes("Requisitos pendientes")), "ascenso bloqueado");
});

console.log("\\n" + n + "/" + n + " escenarios de ranks+rewards en verde.");
`);
    const output = execFileSync(process.execPath, ["test.mjs"], { cwd: sandbox, encoding: "utf8", stdio: "pipe" });
    process.stdout.write(output);
    const match = output.match(/(\d+)\/(\d+) escenarios de ranks\+rewards/);
    if (match) passed += Number(match[1]);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

try {
  runRanksRewardsSuite();
  console.log("\nRanks+Rewards Fase 3: " + passed + " escenarios en verde.");
} catch (err) {
  console.error("\n❌ FALLO EN TEST RANKS+REWARDS FASE 3:", err && err.stack ? err.stack : err);
  process.exit(1);
}