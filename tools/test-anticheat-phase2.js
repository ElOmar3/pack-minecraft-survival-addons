// Test funcional Fase 2 del anticheat: identidad unificada XUID, orden del
// combat-log (evaluar antes de limpiar), lector tolerante de bans_db y
// enforcement real (kick al entrar + barrido).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "ac-phase2-"));

try {
  const serverDir = path.join(sandbox, "node_modules", "@minecraft", "server");
  fs.mkdirSync(serverDir, { recursive: true });
  fs.writeFileSync(path.join(serverDir, "package.json"), JSON.stringify({
    name: "@minecraft/server", version: "2.11.0", type: "module", main: "index.js"
  }));
  fs.writeFileSync(path.join(serverDir, "index.js"), `
function makeSignal() {
  return {
    _fns: [],
    subscribe(fn) { this._fns.push(fn); },
    emit(event) { for (const fn of this._fns) fn(event); }
  };
}
export const world = {
  _players: [],
  _commands: [],
  _messages: [],
  getAllPlayers() { return this._players; },
  getDimension() {
    return {
      id: "minecraft:overworld",
      runCommand(cmd) { world._commands.push(cmd); return { successCount: 1 }; },
      getBlock() { return undefined; },
      getEntities() { return []; }
    };
  },
  sendMessage(msg) { this._messages.push(msg); },
  afterEvents: {
    playerLeave: makeSignal(), playerSpawn: makeSignal(), entityHurt: makeSignal(),
    entityHitEntity: makeSignal(), scriptEventReceive: makeSignal(), entityDie: makeSignal()
  },
  beforeEvents: {
    playerLeave: makeSignal(), playerBreakBlock: makeSignal(), playerPlaceBlock: makeSignal(),
    startup: makeSignal(), entityHurt: makeSignal()
  }
};
export const system = {
  currentTick: 0,
  _scheduled: [],
  run(fn) { fn(); return 0; },
  runTimeout(fn) { this._scheduled.push(fn); return this._scheduled.length; },
  runInterval(fn) { this._scheduled.push(fn); return this._scheduled.length; },
  clearRun() {}
};
export const EquipmentSlot = { Head: "Head", Chest: "Chest", Legs: "Legs", Feet: "Feet", Offhand: "Offhand", Mainhand: "Mainhand" };
export const PlayerPermissionLevel = { Visitor: 0, Member: 1, Operator: 2 };
export const CommandPermissionLevel = { Any: 0, GameDirectors: 1, Admin: 2, Host: 3, Owner: 4 };
export const CustomCommandStatus = { Success: 0, Failure: 1 };
export const CustomCommandParamType = { String: 0, Integer: 1, Float: 2, Boolean: 3, Entity: 4, Player: 5, Block: 6, Item: 7, Location: 8, Enum: 9 };
`);

  fs.cpSync(path.join(repoRoot, "behavior_packs", "anticheat_addon", "scripts"), path.join(sandbox, "scripts"), { recursive: true });

  fs.writeFileSync(path.join(sandbox, "test.mjs"), `
import assert from "node:assert";
import fs from "node:fs";
import { world, system } from "@minecraft/server";
import { playerKey, rememberPlayer, sessionForPlayerId, keyForPlayerName, forgetPlayer } from "./scripts/Identity.js";
import { Config } from "./scripts/Config.js";
import { ViolationManager } from "./scripts/ViolationManager.js";
import { CombatAnalyzer } from "./scripts/CombatAnalyzer.js";
import { Core } from "./scripts/Core.js";

// Puente SQLite mínimo en RAM con el lector tolerante canónico.
const store = new Map();
const k = (a, o, key) => a + "\\u0000" + o + "\\u0000" + key;
globalThis.__sqlite_get_prop_v2__ = (a, o, key) => store.get(k(a, o, key));
globalThis.__sqlite_set_prop_v2__ = (a, o, key, value) => {
  if (value === undefined) store.delete(k(a, o, key));
  else store.set(k(a, o, key), value);
};
globalThis.__sqlite_read_json_v3__ = (raw, fallback) => {
  const fb = fallback === undefined ? null : fallback;
  if (raw === undefined || raw === null) return fb;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return raw;
  const text = raw.trim();
  if (!text) return fb;
  try { return JSON.parse(text); } catch (e) { return fb; }
};

const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);
let passed = 0;
function ok(name, fn) { fn(); passed++; console.log("  OK " + name); }

console.log("Anticheat Fase 2:");

ok("config operativa", () => {
  assert.strictEqual(Config.enabled, true);
  assert.strictEqual(Config.movement.enabled, true);
  assert.strictEqual(Config.combat.enabled, true);
  assert.strictEqual(Config.inventory.enabled, true);
});

ok("identidad unificada XUID/nombre", () => {
  eq(playerKey({ xuid: "123", name: "Foo" }), "x:123");
  eq(playerKey({ name: "Foo" }), "n:foo");
  eq(playerKey({ xuid: "  ", name: " Foo " }), "n:foo");
  const key = rememberPlayer({ id: "p1", name: "Alice", xuid: "X1" });
  eq(key, "x:X1");
  eq(sessionForPlayerId("p1").xuid, "X1");
  eq(keyForPlayerName("alice"), "x:X1");
});

ok("violaciones sobreviven al renombrado (XUID)", () => {
  const alice = { id: "p1", name: "Alice", xuid: "X1" };
  ViolationManager.addViolation(alice, "test.detector", 1, 0, 30);
  const renamed = { id: "p1", name: "AliceRenombrada", xuid: "X1" };
  assert.ok(ViolationManager.getScore(playerKey(renamed)) > 0, "el score debe seguir al XUID");
  const recents = ViolationManager.getRecentDetections(playerKey(renamed), "X1");
  assert.ok(recents.length >= 1, "detecciones recientes consultables por XUID");
});

// Core.init registra el handler de playerLeave y el enforcement de bans.
Core.init();

ok("combat-log: evalúa antes de limpiar y banea con XUID", () => {
  rememberPlayer({ id: "p1", name: "Alice", xuid: "X1" });
  CombatAnalyzer.combatTags.set("x:X1", Date.now() + 10000);
  world.afterEvents.playerLeave.emit({ playerName: "Alice", playerId: "p1" });
  const bans = store.get(k("anticheat_addon", "world", "bans_db"));
  assert.ok(Array.isArray(bans) && bans.length === 1, "ban escrito en bans_db");
  eq(bans[0].xuid, "X1");
  eq(bans[0].nameLower, "alice");
  assert.ok(bans[0].expiresAt > Date.now(), "ban temporal vigente");
  assert.strictEqual(CombatAnalyzer.combatTags.has("x:X1"), false, "estado limpiado DESPUÉS de evaluar");
  assert.ok(world._messages.some(m => m.includes("baneado por 10 minutos")), "anuncio global");
});

ok("combat-log: sin marca de combate no hay ban", () => {
  rememberPlayer({ id: "p2", name: "Bob", xuid: "X2" });
  world.afterEvents.playerLeave.emit({ playerName: "Bob", playerId: "p2" });
  const bans = store.get(k("anticheat_addon", "world", "bans_db"));
  eq(bans.length, 1, "no se crean bans sin combate");
});

ok("main.js ya no limpia CombatAnalyzer en beforeEvents.playerLeave", () => {
  const source = fs.readFileSync(new URL("./scripts/main.js", import.meta.url), "utf8");
  const block = source.split("world.beforeEvents.playerLeave.subscribe")[1] || "";
  const handler = block.split("});")[0];
  assert.ok(!handler.includes("CombatAnalyzer.clearPlayer"), "el clear prematuro debe desaparecer");
});

function mockPlayer(name, xuid) {
  return { isValid: true, name, xuid, id: "id-" + name, dimension: world.getDimension(), typeId: "minecraft:player" };
}

ok("bans_db legacy (string JSON) se lee y enforcement expulsa", () => {
  const legacy = JSON.stringify([{ name: "Mallory", nameLower: "mallory", xuid: "X9", reason: "prueba", by: "test", createdAt: Date.now(), expiresAt: 0, date: "" }]);
  store.set(k("anticheat_addon", "world", "bans_db"), legacy);
  world._commands.length = 0;
  world.afterEvents.playerSpawn.emit({ player: mockPlayer("Mallory", "X9"), initialSpawn: true });
  assert.ok(world._commands.some(c => c.startsWith('kick "Mallory"')), "kick emitido al entrar");
});

ok("ban expirado no expulsa; ban por XUID sobrevive al renombrado", () => {
  store.set(k("anticheat_addon", "world", "bans_db"), [
    { name: "Viejo", nameLower: "viejo", xuid: "XEXP", reason: "x", by: "t", createdAt: 1, expiresAt: Date.now() - 1000, date: "" },
    { name: "Original", nameLower: "original", xuid: "XREN", reason: "x", by: "t", createdAt: 1, expiresAt: 0, date: "" }
  ]);
  world._commands.length = 0;
  world.afterEvents.playerSpawn.emit({ player: mockPlayer("Viejo", "XEXP"), initialSpawn: true });
  eq(world._commands.length, 0, "ban expirado no expulsa");
  world.afterEvents.playerSpawn.emit({ player: mockPlayer("NombreNuevo", "XREN"), initialSpawn: true });
  assert.ok(world._commands.some(c => c.startsWith('kick "NombreNuevo"')), "el ban por XUID alcanza al renombrado");
});

ok("XUID distinto con mismo nombre no hereda el ban", () => {
  store.set(k("anticheat_addon", "world", "bans_db"), [
    { name: "Gemelo", nameLower: "gemelo", xuid: "XA", reason: "x", by: "t", createdAt: 1, expiresAt: 0, date: "" }
  ]);
  world._commands.length = 0;
  world.afterEvents.playerSpawn.emit({ player: mockPlayer("Gemelo", "XB"), initialSpawn: true });
  eq(world._commands.length, 0, "otro XUID no es la misma identidad");
});

ok("ban legacy solo-nombre sigue aplicando por nombre", () => {
  store.set(k("anticheat_addon", "world", "bans_db"), [
    { name: "Legacy", nameLower: "legacy", xuid: "", reason: "x", by: "t", createdAt: 1, expiresAt: 0, date: "" }
  ]);
  world._commands.length = 0;
  world.afterEvents.playerSpawn.emit({ player: mockPlayer("Legacy", "XNEW"), initialSpawn: true });
  assert.ok(world._commands.some(c => c.startsWith('kick "Legacy"')), "fallback por nombre para registros legacy");
});

ok("bans_db corrupto no rompe el enforcement", () => {
  store.set(k("anticheat_addon", "world", "bans_db"), "{corrupto");
  world._commands.length = 0;
  world.afterEvents.playerSpawn.emit({ player: mockPlayer("Nadie", "XN"), initialSpawn: true });
  eq(world._commands.length, 0);
});

console.log("\\n" + passed + "/" + passed + " escenarios en verde.");
`);

  const output = execFileSync(process.execPath, ["test.mjs"], { cwd: sandbox, encoding: "utf8", stdio: "pipe" });
  process.stdout.write(output);
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}