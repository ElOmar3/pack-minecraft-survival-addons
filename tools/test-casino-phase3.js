// Test funcional Fase 3 de casino_addon:
// 1. "Cara o Cruz" y "Blackjack" quedan cableados en el menú selector y son alcanzables.
// 2. El cierre abrupto del GUI de Blackjack reembolsa la apuesta de forma atómica
//    (la reserva debita upfront; sin reembolso el jugador perdía fondos sin jugar).
// 3. Regresión: plantarse (Stand) sigue liquidando la mano con normalidad.
// Se carga main.js con mocks permisivos y se conduce por el custom command s:casino.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
let passed = 0;

function runCasinoSuite() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "casino-p3-"));
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
  runTimeout(fn) { try { fn(); } catch (e) {} return 0; },
  runInterval() { return 0; }, clearRun() {},
  afterEvents: { scriptEventReceive: makeSignal() },
  beforeEvents: signals()
};
export const CommandPermissionLevel = { Any: 0, GameDirectors: 1, Admin: 2, Host: 3, Owner: 4 };
export const CustomCommandStatus = { Success: 0, Failure: 1 };
`);
    fs.writeFileSync(path.join(uiDir, "index.js"), `
function makeForm(kind) {
  const d = { kind, title: "", body: "", buttons: [], fields: [] };
  const api = {
    title(t) { d.title = String(t); return api; },
    body(b) { d.body = String(b); return api; },
    button(b) { d.buttons.push(String(b)); return api; },
    textField(label, ph, def) { d.fields.push({ label, ph, def }); return api; },
    dropdown() { return api; }, toggle() { return api; }, slider() { return api; },
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
    fs.cpSync(path.join(repoRoot, "behavior_packs", "casino_addon", "scripts"), path.join(sandbox, "scripts"), { recursive: true });
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

await import("./scripts/main.js");

const commands = {};
system.beforeEvents.startup.emit({ customCommandRegistry: { registerCommand: (def, cb) => { commands[def.name] = cb; } } });

const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);
let n = 0;
const okAsync = async (name, fn) => { await fn(); n++; console.log("  OK " + name); };
const flush = () => new Promise((r) => setTimeout(r, 0));
function mockPlayer(name) {
  return { isValid: true, name, xuid: "X" + name, id: "id-" + name, typeId: "minecraft:player", playerPermissionLevel: 1, dimension: world.getDimension(), _messages: [], sendMessage(m) { this._messages.push(String(m)); }, onScreenDisplay: { setActionBar() {} }, playSound() {}, hasTag() { return false; } };
}
function setMoney(p, v) { world.scoreboard.addObjective("money", "Dinero").setScore(p, v); }
function getMoney(p) { const o = world.scoreboard.getObjective("money"); return o ? (o.getScore(p) ?? 0) : 0; }
function openCasino(p) { commands["s:casino"]({ sourceEntity: p }); }
const isBetMenu = (d) => d.title.includes("Blackjack") && d.buttons.some((b) => b.includes("Apostar"));
const isTurnForm = (d) => d.title.includes("Blackjack") && d.buttons.some((b) => b.includes("Pedir Carta"));

console.log("Casino Fase 3 - cableado del menú:");

await okAsync("el menú principal incluye Cara o Cruz y Blackjack", async () => {
  const p = mockPlayer("MenuUser"); world._players = [p]; setMoney(p, 10000);
  globalThis.__shownForms = [];
  globalThis.__formDriver = () => ({ canceled: true });
  openCasino(p);
  await flush();
  const menu = globalThis.__shownForms.find((f) => f.title.includes("CASINO IMPERIAL"));
  assert.ok(menu, "menú principal mostrado");
  assert.ok(menu.buttons.some((b) => b.includes("Cara o Cruz")), "botón Cara o Cruz presente");
  assert.ok(menu.buttons.some((b) => b.includes("Blackjack")), "botón Blackjack presente");
});

await okAsync("Cara o Cruz es alcanzable y jugable (paga al acertar)", async () => {
  const p = mockPlayer("CoinUser"); world._players = [p]; setMoney(p, 10000);
  const realRandom = Math.random; Math.random = () => 0.5; // resultado: Cruz
  globalThis.__shownForms = [];
  globalThis.__formDriver = (d) => {
    if (d.title.includes("CASINO IMPERIAL")) return { canceled: false, selection: 2 };
    if (d.title.includes("Cara o Cruz") && d.buttons.some((b) => b.includes("Apostar"))) return { canceled: false, selection: 0 };
    if (d.title.includes("Elige tu lado")) return { canceled: false, selection: 1 }; // Cruz
    return { canceled: true };
  };
  openCasino(p);
  await flush();
  Math.random = realRandom;
  assert.ok(globalThis.__shownForms.some((f) => f.title.includes("Cara o Cruz")), "menú Cara o Cruz alcanzado");
  eq(getMoney(p), 10100, "acierto paga 2x (10000 - 100 + 200)");
});

await okAsync("Blackjack es alcanzable desde el menú (cancelar no debita)", async () => {
  const p = mockPlayer("BJReach"); world._players = [p]; setMoney(p, 10000);
  globalThis.__shownForms = [];
  globalThis.__formDriver = (d) => {
    if (d.title.includes("CASINO IMPERIAL")) return { canceled: false, selection: 3 };
    return { canceled: true };
  };
  openCasino(p);
  await flush();
  assert.ok(globalThis.__shownForms.some(isBetMenu), "menú de apuesta Blackjack alcanzado");
  eq(getMoney(p), 10000, "saldo intacto al cancelar");
});

console.log("Casino Fase 3 - reembolso atómico en Blackjack:");

await okAsync("cierre abrupto del GUI reembolsa la apuesta (sin robo de fondos)", async () => {
  const p = mockPlayer("BJRefund"); world._players = [p]; setMoney(p, 10000);
  const realRandom = Math.random; Math.random = () => 0.5; // mano inicial 16 (no natural ni bust)
  globalThis.__shownForms = [];
  globalThis.__formDriver = (d) => {
    if (d.title.includes("CASINO IMPERIAL")) return { canceled: false, selection: 3 };
    if (isBetMenu(d)) return { canceled: false, selection: 0 }; // apuesta 100
    if (isTurnForm(d)) return { canceled: true, cancelationReason: "UserClosed" }; // cierre abrupto
    return { canceled: true };
  };
  openCasino(p);
  await flush();
  Math.random = realRandom;
  assert.ok(globalThis.__shownForms.some(isTurnForm), "la mesa llegó a mostrarse");
  eq(getMoney(p), 10000, "apuesta reembolsada tras el cierre");
  assert.ok(p._messages.some((m) => m.includes("reembolsó")), "mensaje de reembolso enviado");
});

await okAsync("regresión: plantarse (Stand) sigue liquidando la mano", async () => {
  const p = mockPlayer("BJStand"); world._players = [p]; setMoney(p, 10000);
  const realRandom = Math.random; Math.random = () => 0.5; // jugador 16, crupier 16 -> 24 (bust)
  globalThis.__shownForms = [];
  globalThis.__formDriver = (d) => {
    if (d.title.includes("CASINO IMPERIAL")) return { canceled: false, selection: 3 };
    if (isBetMenu(d)) return { canceled: false, selection: 0 };
    if (isTurnForm(d)) return { canceled: false, selection: 1 }; // Stand
    return { canceled: true };
  };
  openCasino(p);
  await flush();
  Math.random = realRandom;
  eq(getMoney(p), 10100, "crupier se pasa: victoria paga 2x");
});

console.log("\\n" + n + "/" + n + " escenarios de casino en verde.");
`);
    const output = execFileSync(process.execPath, ["test.mjs"], { cwd: sandbox, encoding: "utf8", stdio: "pipe" });
    process.stdout.write(output);
    const match = output.match(/(\d+)\/(\d+) escenarios de casino/);
    if (match) passed += Number(match[1]);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

try {
  runCasinoSuite();
  console.log("\nCasino Fase 3: " + passed + " escenarios en verde.");
} catch (err) {
  console.error("\n❌ FALLO EN TEST CASINO FASE 3:", err && err.stack ? err.stack : err);
  process.exit(1);
}