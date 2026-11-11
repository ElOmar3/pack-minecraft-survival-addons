// Test funcional Fase 3 de newbie_addon:
// El import omitía CustomCommandParamType, provocando un ReferenceError al
// registrar /s:pvp que abortaba también /s:rtp (mismo try/catch). Ahora ambos
// comandos quedan registrados en BDS, la inmunidad PvP se consulta/renuncia y
// el RTP respeta cooldown y aterriza en suelo seguro.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
let passed = 0;

function runNewbieSuite() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "newbie-p3-"));
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
  getDimension() { return { id: "minecraft:overworld", runCommand() { return { successCount: 1 }; }, getBlock() { return undefined; }, getEntities() { return []; } }; },
  sendMessage(m) { this._messages.push(m); },
  scoreboard: { getObjective: () => null, getObjectives: () => [] },
  gameRules: {}, afterEvents: signals(), beforeEvents: signals()
};
let nextRunId = 1;
export const system = {
  currentTick: 0,
  _intervals: new Map(),
  run(fn) { try { fn(); } catch (e) {} return 0; },
  runTimeout() { return 0; },
  runInterval(fn) { const id = nextRunId++; this._intervals.set(id, fn); return id; },
  clearRun(id) { this._intervals.delete(id); },
  afterEvents: { scriptEventReceive: makeSignal() },
  beforeEvents: signals()
};
export const CommandPermissionLevel = { Any: 0, GameDirectors: 1, Admin: 2, Host: 3, Owner: 4 };
export const CustomCommandStatus = { Success: 0, Failure: 1 };
export const CustomCommandParamType = { String: 0, Integer: 1, Float: 2, Boolean: 3, Entity: 4, Player: 5, Block: 6, Item: 7, Location: 8, Enum: 9 };
`);
    fs.cpSync(path.join(repoRoot, "behavior_packs", "newbie_addon", "scripts"), path.join(sandbox, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(sandbox, "test.mjs"), `
import assert from "node:assert";
import { world, system, CustomCommandStatus, CustomCommandParamType } from "@minecraft/server";

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
const defs = {};
system.beforeEvents.startup.emit({ customCommandRegistry: { registerCommand: (def, cb) => { commands[def.name] = cb; defs[def.name] = def; } } });

const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);
let n = 0;
const okAsync = async (name, fn) => { await fn(); n++; console.log("  OK " + name); };
const flush = () => new Promise((r) => setTimeout(r, 0));
const prop = (p, key) => store.get(k("newbie_addon", p, key));
function mockPlayer(name) {
  const tags = new Set();
  return {
    isValid: true, name, typeId: "minecraft:player",
    location: { x: 100, y: 64, z: 200 }, dimension: world.getDimension(),
    _messages: [], _commands: [], _teleports: [],
    sendMessage(m) { this._messages.push(String(m)); },
    runCommand(cmd) { this._commands.push(String(cmd)); return { successCount: 1 }; },
    teleport(loc, opts) { this._teleports.push({ loc, opts }); },
    hasTag(t) { return tags.has(t); },
    addTag(t) { tags.add(t); },
    removeTag(t) { tags.delete(t); },
    playSound() {}, onScreenDisplay: { setActionBar() {} }
  };
}

console.log("Newbie Fase 3 - registro de comandos e inmunidad PvP:");

await okAsync("s:pvp y s:rtp quedan registrados con su tipo de parámetro", async () => {
  assert.ok(typeof commands["s:pvp"] === "function", "s:pvp registrado");
  assert.ok(typeof commands["s:rtp"] === "function", "s:rtp registrado");
  eq(defs["s:pvp"].optionalParameters[0].type, CustomCommandParamType.String, "parámetro accion es String");
  const res = commands["s:pvp"]({ sourceEntity: undefined });
  eq(res.status, CustomCommandStatus.Failure, "origen sin jugador rechazado");
});

await okAsync("el primer spawn otorga 30 minutos de inmunidad una sola vez", async () => {
  const p = mockPlayer("Novato"); world._players = [p];
  const before = Date.now();
  world.afterEvents.playerSpawn.emit({ player: p, initialSpawn: true });
  await flush();
  const until = Number(prop(p, "pvp_immune_until"));
  assert.ok(until >= before + 30 * 60 * 1000 - 5000, "inmunidad de ~30 minutos otorgada");
  assert.ok(p.hasTag("newbie_pvp_immune"), "tag de inmunidad presente");
  eq(prop(p, "npe_welcome_seen"), true, "bienvenida marcada como vista");
  world.afterEvents.playerSpawn.emit({ player: p, initialSpawn: true });
  await flush();
  eq(Number(prop(p, "pvp_immune_until")), until, "el segundo spawn no reinicia la inmunidad");
});

await okAsync("s:pvp activar renuncia a la inmunidad y retira el tag", async () => {
  const p = mockPlayer("Renuncia"); world._players = [p];
  world.afterEvents.playerSpawn.emit({ player: p, initialSpawn: true });
  await flush();
  const res = commands["s:pvp"]({ sourceEntity: p }, "activar");
  await flush();
  eq(res.status, CustomCommandStatus.Success, "comando aceptado");
  eq(Number(prop(p, "pvp_immune_until")), 0, "inmunidad puesta a cero");
  assert.ok(!p.hasTag("newbie_pvp_immune"), "tag retirado");
  assert.ok(p._messages.some((m) => m.includes("renunciado")), "mensaje de renuncia");
});

await okAsync("s:pvp sin acción informa los minutos restantes", async () => {
  const p = mockPlayer("Consulta"); world._players = [p];
  world.afterEvents.playerSpawn.emit({ player: p, initialSpawn: true });
  await flush();
  commands["s:pvp"]({ sourceEntity: p });
  await flush();
  assert.ok(p._messages.some((m) => m.includes("minutos") && m.includes("protección PvP de novato")), "minutos restantes informados");
});

await okAsync("el daño PvP se cancela contra novatos inmunes y se permite tras renunciar", async () => {
  const victim = mockPlayer("Victima");
  const attacker = mockPlayer("Atacante");
  world._players = [victim, attacker];
  world.afterEvents.playerSpawn.emit({ player: victim, initialSpawn: true });
  await flush();
  const hit = { hurtEntity: victim, damageSource: { damagingEntity: attacker }, cancel: false };
  world.beforeEvents.entityDamage.emit(hit);
  await flush();
  eq(hit.cancel, true, "daño cancelado contra víctima inmune");
  commands["s:pvp"]({ sourceEntity: victim }, "activar");
  await flush();
  const hit2 = { hurtEntity: victim, damageSource: { damagingEntity: attacker }, cancel: false };
  world.beforeEvents.entityDamage.emit(hit2);
  await flush();
  eq(hit2.cancel, false, "daño permitido tras renunciar a la inmunidad");
});

await okAsync("s:rtp respeta el cooldown de 10 minutos", async () => {
  const p = mockPlayer("Cooldown"); world._players = [p];
  store.set(k("newbie_addon", p, "last_rtp"), Date.now());
  const res = commands["s:rtp"]({ sourceEntity: p });
  await flush();
  eq(res.status, CustomCommandStatus.Success, "comando aceptado");
  assert.ok(p._messages.some((m) => m.includes("Debes esperar")), "aviso de cooldown");
  eq(p._commands.length, 0, "no se ejecuta spreadplayers durante el cooldown");
});

await okAsync("s:rtp aterriza en suelo seguro y registra el cooldown", async () => {
  const p = mockPlayer("Viajero"); world._players = [p];
  p.dimension = {
    id: "minecraft:overworld",
    runCommand(cmd) { return { successCount: 1 }; },
    getBlock({ y }) {
      if (y === 64) return { typeId: "minecraft:grass_block", isAir: false, isSolid: true, isLiquid: false };
      return { typeId: "minecraft:air", isAir: true, isSolid: false, isLiquid: false };
    }
  };
  p.location = { x: 100.5, y: 300, z: 200.5 };
  const res = commands["s:rtp"]({ sourceEntity: p });
  await flush();
  eq(res.status, CustomCommandStatus.Success, "comando aceptado");
  assert.ok(p._commands.some((c) => c.startsWith("spreadplayers")), "spreadplayers ejecutado");
  const ids = Array.from(system._intervals.keys());
  const pollId = ids[ids.length - 1];
  assert.ok(pollId !== undefined, "sondeo de chunk registrado");
  system._intervals.get(pollId)();
  await flush();
  assert.ok(!system._intervals.has(pollId), "sondeo detenido tras validar el destino");
  eq(p._teleports.length, 1, "teletransporte único al destino seguro");
  eq(p._teleports[0].loc, { x: 100.5, y: 65, z: 200.5 }, "aterrizaje sobre suelo seguro");
  assert.ok(Number(prop(p, "last_rtp")) > 0, "cooldown registrado");
  assert.ok(p._messages.some((m) => m.includes("teletransportado aleatoriamente")), "confirmación de RTP");
});

console.log("\\n" + n + "/" + n + " escenarios de newbie en verde.");
`);
    const output = execFileSync(process.execPath, ["test.mjs"], { cwd: sandbox, encoding: "utf8", stdio: "pipe" });
    process.stdout.write(output);
    const match = output.match(/(\d+)\/(\d+) escenarios de newbie/);
    if (match) passed += Number(match[1]);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

try {
  runNewbieSuite();
  console.log("\nNewbie Fase 3: " + passed + " escenarios en verde.");
} catch (err) {
  console.error("\n❌ FALLO EN TEST NEWBIE FASE 3:", err && err.stack ? err.stack : err);
  process.exit(1);
}