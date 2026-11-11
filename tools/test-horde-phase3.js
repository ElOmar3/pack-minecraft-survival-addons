// Test funcional Fase 3 de horde_event_addon (expediciones):
// El botín del jefe sólo se entrega cuando la muerte letal la causa un jugador.
// 1) entityDie sin killer de jugador (zombificación de hoglin/piglin brute en el
//    Overworld o muerte ambiental) cierra la raid como "lost", sin recompensas.
// 2) El watchdog ya no regala "defeated" cuando el jefe desaparece (despawn):
//    sólo reintenta "defeated" si quedó registrado un kill de jugador para ese
//    eventId (p. ej. cuando SQLite no confirmó el cierre en el primer intento).
// 3) El flujo real de inicio, daño, kill, reclamo y expiración sigue intacto.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
let passed = 0;

function runHordeSuite() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "horde-p3-"));
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
    id, _entities: [],
    isChunkLoaded() { return globalThis.__chunkLoaded !== false; },
    getBlock() { return { typeId: "minecraft:stone" }; },
    runCommand() { return { successCount: 1 }; },
    playSound() {},
    getEntities(opts = {}) {
      let list = this._entities.filter((e) => !e._removed);
      if (opts.type) list = list.filter((e) => e.typeId === opts.type);
      if (opts.tags) list = list.filter((e) => opts.tags.every((t) => e.hasTag(t)));
      if (opts.location && opts.maxDistance !== undefined) {
        list = list.filter((e) => {
          const dx = e.location.x - opts.location.x, dy = e.location.y - opts.location.y, dz = e.location.z - opts.location.z;
          return dx * dx + dy * dy + dz * dz <= opts.maxDistance * opts.maxDistance;
        });
      }
      return list;
    },
    spawnEntity(typeId, location) {
      const entity = {
        typeId, nameTag: "", location: { x: location.x, y: location.y, z: location.z },
        dimension: this, isValid: true, _removed: false, _effects: [],
        addEffect(id, ticks, opts) { this._effects.push({ id, ticks, opts }); },
        remove() { this._removed = true; const i = this.dimension._entities.indexOf(this); if (i >= 0) this.dimension._entities.splice(i, 1); },
        getComponent(cid) { return cid === "minecraft:health" ? { currentValue: 100, effectiveMax: 100 } : undefined; },
        hasTag() { return false; }
      };
      this._entities.push(entity);
      return entity;
    }
  };
}
const dimensions = new Map();
export const world = {
  _players: [], _messages: [],
  getAllPlayers() { return this._players; },
  getDimension(id) { const key = String(id); if (!dimensions.has(key)) dimensions.set(key, makeDimension(key)); return dimensions.get(key); },
  getDefaultSpawnLocation() { return { x: 0, y: 64, z: 0 }; },
  sendMessage(m) { this._messages.push(String(m)); },
  scoreboard: {
    getObjective(id) { return objectives.get(id) || null; },
    addObjective(id) { if (!objectives.has(id)) objectives.set(id, makeObjective(id)); return objectives.get(id); },
    getObjectives() { return Array.from(objectives.values()); },
    setObjectiveAtDisplaySlot() {}, removeObjective() {}
  },
  gameRules: {}, afterEvents: signals(), beforeEvents: signals()
};
export const system = {
  currentTick: 0, _intervals: [],
  run(fn) { try { fn(); } catch (e) {} return 0; },
  runTimeout(fn, ticks) { if ((ticks || 0) < 100) { try { fn(); } catch (e) {} } return 0; },
  runInterval(fn, ticks) { this._intervals.push({ fn, ticks }); return this._intervals.length; },
  clearRun() {},
  afterEvents: { scriptEventReceive: makeSignal() },
  beforeEvents: signals()
};
export class ItemStack {
  constructor(itemId, amount = 1) { this.typeId = itemId; this.amount = amount; }
  getComponent() { return undefined; }
}
export const EquipmentSlot = { Head: "head", Chest: "chest", Legs: "legs", Feet: "feet", Mainhand: "mainhand" };
export const EnchantmentTypes = { get() { return undefined; } };
export const CommandPermissionLevel = { Any: 0, GameDirectors: 1, Admin: 2, Host: 3, Owner: 4 };
export const CustomCommandStatus = { Success: 0, Failure: 1 };
export const PlayerPermissionLevel = { Visitor: 0, Member: 1, Operator: 2 };
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
    const response = globalThis.__formResponder ? globalThis.__formResponder(this, player) : { canceled: true };
    return Promise.resolve(response);
  }
}
export class ActionFormData extends FormBase { constructor() { super("action"); } }
export class ModalFormData extends FormBase { constructor() { super("modal"); } }
export class MessageFormData extends FormBase { constructor() { super("message"); } }
`);
    fs.cpSync(path.join(repoRoot, "behavior_packs", "horde_event_addon", "scripts"), path.join(sandbox, "horde"), { recursive: true });
    fs.writeFileSync(path.join(sandbox, "test.mjs"), `
import assert from "node:assert";
import { world, system } from "@minecraft/server";

const store = new Map();
const ownerKey = (o) => typeof o === "string" ? o : (!o ? "world" : (o.name ? String(o.name).toLowerCase() : (o.id !== undefined ? String(o.id) : "world")));
const k = (a, o, key) => a + "\\u0000" + ownerKey(o) + "\\u0000" + key;
const kA = (o, key) => k("horde_event_addon", o, key);
globalThis.__failStateWrites = 0;
globalThis.__sqlite_get_prop_v2__ = (a, o, key) => store.get(k(a, o, key));
globalThis.__sqlite_set_prop_v2__ = (a, o, key, value) => {
  if (key === "expedition_state_v1" && globalThis.__failStateWrites > 0) {
    globalThis.__failStateWrites--;
    throw new Error("SQLite simulado: escritura rechazada");
  }
  if (value === undefined) store.delete(k(a, o, key)); else store.set(k(a, o, key), value);
};
globalThis.__sqlite_read_json_v3__ = (raw, fallback) => {
  const fb = fallback === undefined ? null : fallback;
  if (raw === undefined || raw === null) return fb;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return raw;
  const text = raw.trim(); if (!text) return fb;
  try { return JSON.parse(text); } catch (e) { return fb; }
};

await import("./horde/main.js");

const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);
let n = 0;
const okAsync = async (name, fn) => { await fn(); n++; console.log("  OK " + name); };
const flush = () => new Promise((r) => setTimeout(r, 0));
const tick = () => { for (const { fn } of system._intervals) fn(); };
function withClockOffset(ms, fn) {
  const real = Date.now;
  Date.now = () => real() + ms;
  try { fn(); } finally { Date.now = real; }
}

const overworld = world.getDimension("minecraft:overworld");
const readState = () => JSON.parse(store.get(kA("world", "expedition_state_v1")) ?? "null");
const pendingOf = (name) => JSON.parse(store.get(kA(String(name).toLowerCase(), "expedition_pending_rewards_v1")) ?? "[]");
const fame = () => JSON.parse(store.get(kA("world", "expedition_hall_of_fame_v1")) ?? "[]");

function mockPlayer(name) {
  return {
    isValid: true, name, id: "id-" + name, typeId: "minecraft:player",
    location: { x: 0.5, y: 64, z: 0.5 }, dimension: overworld,
    _messages: [], _items: [], _tags: new Set(),
    sendMessage(m) { this._messages.push(String(m)); },
    runCommand() { return { successCount: 1 }; },
    playSound() {}, addEffect() {}, teleport() {},
    onScreenDisplay: { setActionBar() {}, setTitle() {} },
    hasTag(t) { return this._tags.has(t); }, addTag(t) { this._tags.add(t); }, removeTag(t) { this._tags.delete(t); },
    getComponent(cid) {
      if (cid !== "minecraft:inventory") return undefined;
      const self = this;
      return { container: { size: 36, getItem() { return undefined; }, addItem(stack) { self._items.push(stack); return undefined; } } };
    }
  };
}

// Inicio real: arena + jugadores + cuenta regresiva vencida; el tick ejecuta
// processExpeditionCountdown -> startExpedition. Math.random fijado elige
// iron_colossus (hoglin "Coloso de Ceniza"), el perfil propenso a zombificación.
function beginRaid(names) {
  store.set(kA("world", "expedition_arena_v1"), JSON.stringify({ x: 0, y: 64, z: 0, dimension: "minecraft:overworld" }));
  overworld._entities.length = 0;
  world._messages.length = 0;
  const players = names.map(mockPlayer);
  world._players = players;
  store.set(kA("world", "expedition_state_v1"), JSON.stringify({
    active: false, eventId: "", bossId: "", affixId: "", rewardItems: [], cooldownMs: 0,
    phase: 0, playerCount: 0, scaleLevel: 0, scheduledAt: Date.now() - 1,
    scheduledMode: "admin", scheduledOneMinute: true, startedAt: 0, nextStartAt: 0, participants: []
  }));
  const realRandom = Math.random;
  Math.random = () => 0.3;
  try { tick(); } finally { Math.random = realRandom; }
  const state = readState();
  assert.ok(state && state.active, "la expedición debió iniciar");
  assert.strictEqual(state.bossId, "iron_colossus", "perfil forzado: Coloso de Ceniza (hoglin)");
  const boss = overworld._entities.find((e) => e.typeId === "minecraft:hoglin" && e.nameTag === "§6§lColoso de Ceniza");
  assert.ok(boss, "jefe invocado en la arena con su nombre");
  return { players, boss, state };
}
function hitBoss(player, boss, damage) {
  world.afterEvents.entityHurt.emit({ hurtEntity: boss, damageSource: { damagingEntity: player }, damage });
}
function killBoss(killer, boss) {
  boss.remove();
  world.afterEvents.entityDie.emit({ deadEntity: boss, damageSource: killer ? { damagingEntity: killer } : {} });
}

// Comandos nativos registrados en startup (para reclamar vía /s:expedicion).
const registered = new Map();
system.beforeEvents.startup.emit({ customCommandRegistry: { registerCommand(def, cb) { registered.set(def.name, { def, cb }); } } });
assert.ok(registered.has("s:expedicion"), "comando s:expedicion registrado");

console.log("Horde Fase 3 - recompensas de jefe condicionadas a kill de jugador:");

await okAsync("inicio real + kill de jugador entrega botín por contribución", async () => {
  const { players, boss } = beginRaid(["Heroe", "Support"]);
  hitBoss(players[0], boss, 120);
  hitBoss(players[1], boss, 30);
  killBoss(players[0], boss);
  await flush();
  const state = readState();
  eq(state.active, false, "la raid cerró");
  assert.ok(state.nextStartAt > Date.now(), "enfriamiento aplicado");
  const hero = pendingOf("Heroe");
  eq(hero.length, 1, "una recompensa pendiente para el campeón");
  eq(hero[0].tier, "campeón", "mayor daño = campeón");
  assert.ok(hero[0].items.some((i) => i.itemId === "minecraft:netherite_scrap" && i.amount === 2), "bonus de campeón");
  const support = pendingOf("Support");
  eq(support.length, 1, "recompensa para el segundo participante");
  eq(support[0].tier, "élite", "20% del daño = élite");
  assert.ok(support[0].items.some((i) => i.itemId === "minecraft:diamond" && i.amount === 4), "bonus de élite");
  assert.ok(world._messages.some((m) => m.includes("¡Guardián derrotado!")), "anuncio de victoria");
  eq(fame().length, 1, "salón de fama actualizado");
  eq(fame()[0].champion, "Heroe", "campeón registrado");
});

await okAsync("/s:expedicion reclama el botín pendiente una sola vez", async () => {
  const heroe = world._players.find((p) => p.name === "Heroe");
  globalThis.__formResponder = (form) => form._title.includes("EXPEDICIÓN") ? { canceled: false, selection: 0 } : { canceled: true };
  registered.get("s:expedicion").cb({ sourceEntity: heroe });
  await flush();
  globalThis.__formResponder = undefined;
  assert.ok(heroe._items.length >= 5, "ítems entregados al inventario");
  assert.ok(heroe._items.some((i) => i.typeId === "minecraft:netherite_scrap"), "netherite_scrap reclamado");
  eq(pendingOf("Heroe").length, 0, "la recompensa se consumió");
  assert.ok(heroe._messages.some((m) => m.includes("Reclamaste una recompensa")), "confirmación de reclamo");
});

await okAsync("zombificación del hoglin (entityDie sin jugador) no entrega botín", async () => {
  const { players, boss } = beginRaid(["Zombificado"]);
  hitBoss(players[0], boss, 200);
  const fameBefore = fame().length;
  boss.remove();
  overworld.spawnEntity("minecraft:zoglin", { x: 0.5, y: 65, z: 0.5 });
  world.afterEvents.entityDie.emit({ deadEntity: boss, damageSource: {} });
  await flush();
  eq(readState().active, false, "la raid se cerró");
  eq(pendingOf("Zombificado").length, 0, "sin recompensas por zombificación");
  eq(fame().length, fameBefore, "salón de fama intacto");
  assert.ok(world._messages.some((m) => m.includes("se perdió sin ser derrotado por jugadores")), "anuncio de pérdida");
  assert.ok(!world._messages.some((m) => m.includes("¡Guardián derrotado!")), "sin anuncio de victoria");
});

await okAsync("muerte ambiental con killer no-jugador no entrega botín", async () => {
  const { players, boss } = beginRaid(["Ambiental"]);
  hitBoss(players[0], boss, 150);
  killBoss({ typeId: "minecraft:skeleton", isValid: true }, boss);
  await flush();
  eq(readState().active, false, "la raid se cerró");
  eq(pendingOf("Ambiental").length, 0, "un esqueleto no genera botín de raid");
  assert.ok(world._messages.some((m) => m.includes("se perdió sin ser derrotado por jugadores")), "anuncio de pérdida");
});

await okAsync("despawn natural: el watchdog cierra sin botín tras el margen", async () => {
  const { players, boss } = beginRaid(["Despawn"]);
  hitBoss(players[0], boss, 180);
  boss.remove();
  tick();
  eq(readState().active, true, "primer tick: margen para que llegue entityDie");
  eq(pendingOf("Despawn").length, 0, "sin recompensas prematuras");
  withClockOffset(3000, tick);
  eq(readState().active, false, "tras el margen la raid se cerró");
  eq(pendingOf("Despawn").length, 0, "el despawn no entrega botín");
  assert.ok(world._messages.some((m) => m.includes("se perdió sin ser derrotado por jugadores")), "anuncio de pérdida");
});

await okAsync("watchdog reintenta defeated sólo si hubo kill de jugador registrado", async () => {
  const { players, boss } = beginRaid(["RetryHero"]);
  hitBoss(players[0], boss, 100);
  globalThis.__failStateWrites = 2;
  killBoss(players[0], boss);
  await flush();
  eq(readState().active, true, "SQLite rechazó el cierre: la raid sigue activa");
  eq(pendingOf("RetryHero").length, 1, "el botín quedó encolado en el primer intento");
  assert.ok(!world._messages.some((m) => m.includes("¡Guardián derrotado!")), "aún sin anuncio de victoria");
  tick();
  eq(readState().active, false, "el watchdog cerró la raid usando el kill registrado");
  eq(pendingOf("RetryHero").length, 1, "eventId evita duplicar el paquete");
  assert.ok(world._messages.some((m) => m.includes("¡Guardián derrotado!")), "anuncio de victoria tras el reintento");
});

await okAsync("expiración retira al jefe sin recompensas", async () => {
  const { players, boss } = beginRaid(["Expirado"]);
  hitBoss(players[0], boss, 90);
  withClockOffset(31 * 60 * 1000, tick);
  eq(boss._removed, true, "el jefe fue retirado");
  eq(readState().active, false, "la raid expiró");
  eq(pendingOf("Expirado").length, 0, "sin botín por expiración");
  assert.ok(world._messages.some((m) => m.includes("expiró")), "anuncio de expiración");
});

await okAsync("muerte de un participante no cierra la raid y registra reingreso", async () => {
  const { players, boss } = beginRaid(["Valiente"]);
  hitBoss(players[0], boss, 60);
  world.afterEvents.entityDie.emit({ deadEntity: players[0], damageSource: {} });
  await flush();
  const state = readState();
  eq(state.active, true, "la raid sigue activa");
  eq(state.participants[0].deaths, 1, "muerte registrada");
  eq(state.participants[0].pendingReentry, true, "reingreso seguro disponible");
  assert.ok(players[0]._messages.some((m) => m.includes("reingreso seguro")), "aviso de reingreso");
});

console.log("\\n" + n + "/" + n + " escenarios de horde en verde.");
`);
    const output = execFileSync(process.execPath, ["test.mjs"], { cwd: sandbox, encoding: "utf8", stdio: "pipe" });
    process.stdout.write(output);
    const match = output.match(/(\d+)\/(\d+) escenarios de horde/);
    if (match) passed += Number(match[1]);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

try {
  runHordeSuite();
  console.log("\nHorde Fase 3: " + passed + " escenarios en verde.");
} catch (err) {
  console.error("\n❌ FALLO EN TEST HORDE FASE 3:", err && err.stack ? err.stack : err);
  process.exit(1);
}