// Test funcional Fase 3 de blood_moon / mining_fever / server_boosters:
// 1) mining_fever leía is_blood_moon en su propio namespace, así que el x2 de
//    caza durante la Luna de Sangre nunca se aplicaba. Ahora consulta el
//    namespace real del escritor (blood_moon_addon).
// 2) server_boosters leía el rol visual de admin en su propio namespace, así
//    que el menú administrativo siempre denegaba a OWNER/SECURITY_ADMIN. Ahora
//    consulta fcx_limited_admin, donde AdminRoleBadgeService escribe el rol.
// 3) Los potenciadores globales restaurados desde SQLite siguen pagando en el
//    flujo real de ruptura de bloques.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
let passed = 0;

function runBoostersSuite() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "boosters-p3-"));
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
  _players: [], _messages: [],
  getAllPlayers() { return this._players; },
  getDimension() { return { id: "minecraft:overworld", runCommand() { return { successCount: 1 }; }, getBlock() { return undefined; }, getEntities() { return []; }, getPlayers() { return []; }, playSound() {} }; },
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
export const CommandPermissionLevel = { Any: 0, GameDirectors: 1, Admin: 2, Host: 3, Owner: 4 };
export const CustomCommandStatus = { Success: 0, Failure: 1 };
export const CustomCommandParamType = { String: 0, Integer: 1, Float: 2, Boolean: 3, Entity: 4, Player: 5, Block: 6, Item: 7, Location: 8, Enum: 9 };
`);
    fs.writeFileSync(path.join(uiDir, "index.js"), `
class FormBase {
  constructor(kind) { this._kind = kind; this._title = ""; this._body = ""; this._buttons = []; }
  title(t) { this._title = String(t); return this; }
  body(b) { this._body = String(b); return this; }
  button(b) { this._buttons.push(String(b)); return this; }
  textField() { return this; }
  slider() { return this; }
  toggle() { return this; }
  dropdown() { return this; }
  show(player) {
    if (!globalThis.__shownForms) globalThis.__shownForms = [];
    globalThis.__shownForms.push({ kind: this._kind, title: this._title, player: player && player.name });
    return Promise.resolve({ canceled: true });
  }
}
export class ActionFormData extends FormBase { constructor() { super("action"); } }
export class ModalFormData extends FormBase { constructor() { super("modal"); } }
export class MessageFormData extends FormBase { constructor() { super("message"); } }
`);
    fs.cpSync(path.join(repoRoot, "behavior_packs", "mining_fever_addon", "scripts"), path.join(sandbox, "mining"), { recursive: true });
    fs.cpSync(path.join(repoRoot, "behavior_packs", "server_boosters_addon", "scripts"), path.join(sandbox, "boosters"), { recursive: true });
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

// Potenciadores globales comprados: sembrados ANTES del import para que
// initBoosters (system.run sincrónico) los restaure desde SQLite a memoria.
const boosterEnd = Date.now() + 60 * 60 * 1000;
store.set(k("server_boosters_addon", "world", "booster_jobs_active"), true);
store.set(k("server_boosters_addon", "world", "booster_jobs_endTime"), boosterEnd);
store.set(k("server_boosters_addon", "world", "booster_jobs_buyer"), "Banco");
store.set(k("server_boosters_addon", "world", "booster_xp_active"), true);
store.set(k("server_boosters_addon", "world", "booster_xp_endTime"), boosterEnd);
store.set(k("server_boosters_addon", "world", "booster_xp_buyer"), "Banco");

await import("./mining/main.js");
await import("./boosters/main.js");

const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);
let n = 0;
const okAsync = async (name, fn) => { await fn(); n++; console.log("  OK " + name); };
const flush = () => new Promise((r) => setTimeout(r, 0));
function mockPlayer(name) {
  return {
    isValid: true, name, id: "id-" + name, typeId: "minecraft:player",
    location: { x: 0, y: 64, z: 0 }, dimension: { id: "minecraft:overworld" },
    _messages: [], _actionBars: [], _xp: 0, _tags: new Set(),
    sendMessage(m) { this._messages.push(String(m)); },
    runCommand() { return { successCount: 1 }; },
    playSound() {},
    onScreenDisplay: { setActionBar(m) { mockPlayerBars.push({ player: name, msg: String(m) }); }, setTitle() {} },
    addExperience(v) { this._xp += v; },
    hasTag(t) { return this._tags.has(t); }, addTag(t) { this._tags.add(t); }, removeTag(t) { this._tags.delete(t); }, getTags() { return Array.from(this._tags); }
  };
}
const mockPlayerBars = [];
const balanceOf = (p) => world.scoreboard.getObjective("money")?.getScore(p) ?? 0;
const setBloodMoon = (active) => store.set(k("blood_moon_addon", "world", "is_blood_moon"), active);
const disableJobs = (p) => store.set(k("server_boosters_addon", p, "boosters:global_admin_mode:jobs"), "DISABLED");
function killMob(killer, typeId, dimensionId = "minecraft:overworld") {
  world.afterEvents.entityDie.emit({
    deadEntity: { typeId, dimension: { id: dimensionId }, isValid: true },
    damageSource: { damagingEntity: killer }
  });
}

console.log("Boosters Fase 3 - namespaces de estado entre addons:");

await okAsync("el x2 de caza se aplica con la Luna de Sangre real activa", async () => {
  setBloodMoon(true);
  const p = mockPlayer("Cazador"); world._players = [p];
  disableJobs(p);
  killMob(p, "minecraft:zombie");
  await flush();
  eq(balanceOf(p), 20, "zombie paga $10 x2 = $20");
  assert.ok(mockPlayerBars.some((b) => b.player === "Cazador" && b.msg.includes("X2 LUNA DE SANGRE")), "aviso de x2 visible");
});

await okAsync("sin Luna de Sangre la caza paga el monto base", async () => {
  setBloodMoon(false);
  const p = mockPlayer("CazadorBase"); world._players = [p];
  disableJobs(p);
  killMob(p, "minecraft:zombie");
  await flush();
  eq(balanceOf(p), 10, "zombie paga $10 sin evento");
});

await okAsync("el estado en el namespace viejo de mining_fever ya no dispara el bono", async () => {
  setBloodMoon(false);
  store.set(k("mining_fever_addon", "world", "is_blood_moon"), true);
  const p = mockPlayer("CazadorLegacy"); world._players = [p];
  disableJobs(p);
  killMob(p, "minecraft:zombie");
  await flush();
  eq(balanceOf(p), 10, "la clave huérfana no duplica el pago");
  store.delete(k("mining_fever_addon", "world", "is_blood_moon"));
});

await okAsync("el bono x2 solo aplica a mobs del Overworld", async () => {
  setBloodMoon(true);
  const p = mockPlayer("CazadorNether"); world._players = [p];
  disableJobs(p);
  killMob(p, "minecraft:zombie", "minecraft:nether");
  await flush();
  eq(balanceOf(p), 10, "zombie del Nether no recibe el bono");
  setBloodMoon(false);
});

await okAsync("OWNER con rol en fcx_limited_admin abre el menú administrativo", async () => {
  const admin = mockPlayer("Owner");
  const target = mockPlayer("Target");
  world._players = [admin, target];
  store.set(k("fcx_limited_admin", admin, "fcx_admin:visual_role_v1"), "OWNER");
  globalThis.__shownForms = [];
  world.beforeEvents.chatSend.emit({ message: "s:gestionboosters Target", sender: admin, cancel: false });
  await flush();
  assert.ok(globalThis.__shownForms.some((f) => f.title.includes("Potenciadores: Target")), "menú administrativo abierto");
  assert.ok(!admin._messages.some((m) => m.includes("Solo OWNER")), "sin denegación de acceso");
});

await okAsync("un rol escrito en el namespace viejo no concede acceso admin", async () => {
  const admin = mockPlayer("FalsoOwner");
  const target = mockPlayer("Target2");
  world._players = [admin, target];
  store.set(k("server_boosters_addon", admin, "fcx_admin:visual_role_v1"), "OWNER");
  globalThis.__shownForms = [];
  world.beforeEvents.chatSend.emit({ message: "s:gestionboosters Target2", sender: admin, cancel: false });
  await flush();
  assert.ok(admin._messages.some((m) => m.includes("Solo OWNER y SECURITY_ADMIN")), "acceso denegado");
  eq(globalThis.__shownForms.length, 0, "ningún menú abierto");
});

await okAsync("los potenciadores restaurados desde SQLite pagan en el flujo real", async () => {
  const p = mockPlayer("Minero"); world._players = [p];
  world.afterEvents.playerBreakBlock.emit({
    player: p,
    brokenBlockPermutation: { type: { id: "minecraft:diamond_ore" } },
    block: { typeId: "minecraft:diamond_ore", location: { x: 1, y: 64, z: 1 } }
  });
  await flush();
  eq(balanceOf(p), 25, "Minería $20 + Fiebre de Trabajo $5 por mena");
  eq(p._xp, 5, "Doble XP otorga experiencia por mena");
  const earningsKey = "jobs_booster_earnings_v1:" + boosterEnd;
  eq(Number(store.get(k("server_boosters_addon", p, earningsKey))), 5, "tope persistente por activación registrado");
});

console.log("\\n" + n + "/" + n + " escenarios de boosters en verde.");
`);
    const output = execFileSync(process.execPath, ["test.mjs"], { cwd: sandbox, encoding: "utf8", stdio: "pipe" });
    process.stdout.write(output);
    const match = output.match(/(\d+)\/(\d+) escenarios de boosters/);
    if (match) passed += Number(match[1]);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

try {
  runBoostersSuite();
  console.log("\nBoosters Fase 3: " + passed + " escenarios en verde.");
} catch (err) {
  console.error("\n❌ FALLO EN TEST BOOSTERS FASE 3:", err && err.stack ? err.stack : err);
  process.exit(1);
}