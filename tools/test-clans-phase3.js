// Test funcional Fase 3 de clans_addon:
// 1. /s:clan mejorar normaliza el liderazgo sobre clan.owner (con fallback legacy
//    clan.leader) y ya no lanza TypeError; solo el líder puede subir de nivel.
// 2. Anti-farm de banco: colocar y romper el mismo bloque no progresa la misión
//    cooperativa; solo la minería de recursos naturales deposita recompensas.
// Se carga main.js con mocks permisivos y se conduce por s:clan y los eventos
// playerPlaceBlock / playerBreakBlock.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
let passed = 0;

function runClansSuite() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "clans-p3-"));
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
  runInterval() { return 0; }, clearRun() {},
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
function makeForm() { const api = new Proxy({}, { get: (t, p) => p === "show" ? () => Promise.resolve({ canceled: true }) : () => api }); return api; }
export class ActionFormData { constructor() { return makeForm(); } }
export class ModalFormData { constructor() { return makeForm(); } }
export class MessageFormData { constructor() { return makeForm(); } }
`);
    fs.cpSync(path.join(repoRoot, "behavior_packs", "clans_addon", "scripts"), path.join(sandbox, "scripts"), { recursive: true });
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
const DB_KEY = k("clans_addon", "world", "clans_db");
function mockPlayer(name) {
  return { isValid: true, name, xuid: "X" + name, id: "id-" + name, typeId: "minecraft:player", playerPermissionLevel: 1, location: { x: 0, y: 64, z: 0 }, dimension: world.getDimension("minecraft:overworld"), _messages: [], sendMessage(m) { this._messages.push(String(m)); }, hasTag() { return false; }, getTags() { return []; }, addTag() {}, removeTag() {}, playSound() {}, teleport() {} };
}
function seedClan(clanKey, clan, players) {
  store.set(DB_KEY, JSON.stringify({ [clanKey]: clan }));
  for (const p of players) store.set(k("clans_addon", p, "clan_key"), clanKey);
  world._players = players;
}
function readClan(clanKey) { return JSON.parse(store.get(DB_KEY) || "{}")[clanKey]; }
function clanCmd(p, sub) { commands["s:clan"]({ sourceEntity: p }, sub); }
function placeBlock(p, typeId, pos) { world.afterEvents.playerPlaceBlock.emit({ player: p, block: { ...pos }, dimension: { id: "minecraft:overworld" } }); }
function breakBlock(p, typeId, pos) { world.afterEvents.playerBreakBlock.emit({ player: p, block: { ...pos }, dimension: { id: "minecraft:overworld" }, brokenBlockPermutation: { type: { id: typeId } } }); }
function baseClan(overrides) { return Object.assign({ name: "TestClan", owner: "Leader", members: ["Leader", "Member"], balance: 30000, level: 1, color: "red" }, overrides); }
function ironQuest() { return { id: "mine_iron", description: "Minar hierro", progress: 0, target: 3, reward: 1000, active: true }; }

console.log("Clanes Fase 3 - liderazgo unificado en /s:clan mejorar:");

await okAsync("el líder (clan.owner) sube de nivel sin TypeError", async () => {
  const p = mockPlayer("Leader");
  seedClan("testclan", baseClan(), [p]);
  clanCmd(p, "mejorar"); await flush();
  const clan = readClan("testclan");
  eq(clan.level, 2, "clan asciende a nivel 2");
  eq(clan.balance, 5000, "se descuenta el costo de 25000");
});

await okAsync("un miembro que no es líder es rechazado", async () => {
  const p = mockPlayer("Member");
  seedClan("testclan", baseClan(), [p]);
  clanCmd(p, "mejorar"); await flush();
  const clan = readClan("testclan");
  eq(clan.level, 1, "el nivel no cambia");
  eq(clan.balance, 30000, "el banco no se toca");
  assert.ok(p._messages.some((m) => m.includes("Solo el líder")), "mensaje de solo-líder");
});

await okAsync("fallback legacy clan.leader sigue funcionando", async () => {
  const p = mockPlayer("Legacy");
  const clan = baseClan({ members: ["Legacy"] }); delete clan.owner; clan.leader = "Legacy";
  seedClan("testclan", clan, [p]);
  clanCmd(p, "mejorar"); await flush();
  eq(readClan("testclan").level, 2, "el líder legacy puede mejorar");
});

console.log("Clanes Fase 3 - anti-farm de banco:");

await okAsync("colocar y romper el mismo bloque no progresa la misión", async () => {
  const p = mockPlayer("Miner");
  seedClan("testclan", baseClan({ owner: "Miner", members: ["Miner"], balance: 0, quest: ironQuest() }), [p]);
  placeBlock(p, "minecraft:iron_ore", { x: 5, y: 64, z: 5 });
  breakBlock(p, "minecraft:iron_ore", { x: 5, y: 64, z: 5 });
  const clan = readClan("testclan");
  eq(clan.quest.progress, 0, "sin progreso por bloque colocado");
  eq(clan.balance, 0, "la tesorería no se infla");
});

await okAsync("romper mineral natural sí progresa la misión", async () => {
  const p = mockPlayer("Miner");
  seedClan("testclan", baseClan({ owner: "Miner", members: ["Miner"], balance: 0, quest: ironQuest() }), [p]);
  breakBlock(p, "minecraft:iron_ore", { x: 9, y: 64, z: 9 });
  eq(readClan("testclan").quest.progress, 1, "progreso natural contado");
});

await okAsync("completar la misión con mineral natural deposita la recompensa", async () => {
  const p = mockPlayer("Miner");
  seedClan("testclan", baseClan({ owner: "Miner", members: ["Miner"], balance: 0, quest: ironQuest() }), [p]);
  breakBlock(p, "minecraft:iron_ore", { x: 1, y: 64, z: 1 });
  breakBlock(p, "minecraft:deepslate_iron_ore", { x: 2, y: 64, z: 2 });
  breakBlock(p, "minecraft:iron_ore", { x: 3, y: 64, z: 3 });
  const clan = readClan("testclan");
  eq(clan.balance, 1000, "recompensa depositada al completar");
  eq(clan.quest.progress, 0, "se asigna una nueva misión");
});

await okAsync("farmear con bloques colocados nunca completa la misión", async () => {
  const p = mockPlayer("Miner");
  seedClan("testclan", baseClan({ owner: "Miner", members: ["Miner"], balance: 0, quest: ironQuest() }), [p]);
  for (let i = 0; i < 10; i++) {
    placeBlock(p, "minecraft:iron_ore", { x: 5, y: 64, z: 5 });
    breakBlock(p, "minecraft:iron_ore", { x: 5, y: 64, z: 5 });
  }
  const clan = readClan("testclan");
  eq(clan.quest.progress, 0, "10 ciclos de farmeo no progresan");
  eq(clan.balance, 0, "tesorería intacta tras el farmeo");
});

console.log("\\n" + n + "/" + n + " escenarios de clanes en verde.");
`);
    const output = execFileSync(process.execPath, ["test.mjs"], { cwd: sandbox, encoding: "utf8", stdio: "pipe" });
    process.stdout.write(output);
    const match = output.match(/(\d+)\/(\d+) escenarios de clanes/);
    if (match) passed += Number(match[1]);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

try {
  runClansSuite();
  console.log("\nClanes Fase 3: " + passed + " escenarios en verde.");
} catch (err) {
  console.error("\n❌ FALLO EN TEST CLANES FASE 3:", err && err.stack ? err.stack : err);
  process.exit(1);
}