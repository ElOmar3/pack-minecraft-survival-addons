// Test funcional Fase 2 de currency_addon:
// 1. /s:pay bloquea la transferencia del capital de préstamos activos (loan_funds_locked)
//    y permite transferir solo el saldo disponible (saldo - bloqueo de préstamo).
// 2. Los diálogos async (depósito, retiro, préstamo) revalidan el saldo atómicamente:
//    si el estado cambia mientras el modal está abierto, la transacción se rechaza
//    en lugar de confirmar con una lectura obsoleta (condición de carrera).
// Se carga el main.js completo con mocks permisivos y se conduce por el punto de
// entrada público `scriptevent cmd` (pay / banco), sin acceso a funciones internas.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
let passed = 0;

function runCurrencySuite() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "currency-p2-"));
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
  return {
    id,
    getScore(p) { const k = keyOf(p); return scores.has(k) ? scores.get(k) : undefined; },
    setScore(p, v) { scores.set(keyOf(p), Math.floor(v)); },
    getParticipants() { return []; },
    getScores() { return []; },
    remove() {}
  };
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
    setObjectiveAtDisplaySlot() {},
    removeObjective() {}
  },
  gameRules: {},
  afterEvents: signals(),
  beforeEvents: signals()
};
export const system = {
  currentTick: 0,
  run(fn) { try { fn(); } catch (e) {} return 0; },
  runTimeout() { return 0; },
  runInterval() { return 0; },
  clearRun() {},
  afterEvents: { scriptEventReceive: makeSignal() },
  beforeEvents: signals()
};
export class ItemStack { constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; } }
export const EnchantmentTypes = {};
export const EquipmentSlot = { Mainhand: "Mainhand", Offhand: "Offhand", Head: "Head", Chest: "Chest", Legs: "Legs", Feet: "Feet" };
export const DisplaySlotId = { List: "list", Sidebar: "sidebar", BelowName: "belowname" };
export const ObjectiveSortOrder = { Ascending: 0, Descending: 1 };
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
    textField(label, ph, def) { d.fields.push({ label, ph, def }); return api; },
    dropdown() { return api; },
    toggle() { return api; },
    slider() { return api; },
    show(player) {
      const driver = globalThis.__formDriver;
      const res = driver ? driver(d, player) : { canceled: true };
      return Promise.resolve(res);
    }
  };
  return api;
}
export class ActionFormData { constructor() { return makeForm("action"); } }
export class ModalFormData { constructor() { return makeForm("modal"); } }
export class MessageFormData { constructor() { return makeForm("message"); } }
`);
    fs.cpSync(path.join(repoRoot, "behavior_packs", "currency_addon", "scripts"), path.join(sandbox, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(sandbox, "test.mjs"), `
import assert from "node:assert";
import { world, system } from "@minecraft/server";

// Puente SQLite en RAM con el lector tolerante canónico.
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

// Cargar el main.js completo: registra el consumidor de scriptevent "cmd".
await import("./scripts/main.js");

const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("  OK " + name); };
const okAsync = async (name, fn) => { await fn(); n++; console.log("  OK " + name); };
const flush = () => new Promise((r) => setTimeout(r, 0));

function mockPlayer(name, xuid) {
  return {
    isValid: true, name, xuid, id: "id-" + name, typeId: "minecraft:player",
    playerPermissionLevel: 1, dimension: world.getDimension(), _messages: [],
    sendMessage(m) { this._messages.push(String(m)); },
    onScreenDisplay: { setActionBar() {} },
    playSound() {}, hasTag() { return false; }, getComponent() { return undefined; }
  };
}
function setMoney(player, val) { world.scoreboard.addObjective("money", "Dinero").setScore(player, val); }
function getMoney(player) { const o = world.scoreboard.getObjective("money"); return o ? (o.getScore(player) ?? 0) : 0; }
function setProp(player, key, val) { globalThis.__sqlite_set_prop_v2__("currency_addon", player, key, val); }
function setWorld(key, val) { globalThis.__sqlite_set_prop_v2__("currency_addon", "world", key, val); }
function emitCmd(player, message) { system.afterEvents.scriptEventReceive.emit({ id: "cmd", message, sourceEntity: player }); }
function lastMsg(player) { return player._messages[player._messages.length - 1] || ""; }

// Impuesto de transferencia en 0 para aserciones de saldo exactas.
setWorld("tax_transfer_rate_v1", 0);

console.log("Currency Fase 2 - bloqueo de préstamos en /s:pay:");

ok("sin préstamo: la transferencia se confirma y mueve el saldo", () => {
  const alice = mockPlayer("AlicePay", "XA"); const bob = mockPlayer("BobPay", "XB");
  world._players = [alice, bob];
  setMoney(alice, 1000); setMoney(bob, 0);
  setProp(alice, "bank_loan_v1", 0); setProp(alice, "bank_loan_transfer_lock_v1", undefined);
  emitCmd(alice, "pay BobPay 300");
  eq(getMoney(alice), 700, "origen debitado");
  eq(getMoney(bob), 300, "destino acreditado");
  assert.ok(lastMsg(alice).includes("Has transferido"), "mensaje de éxito");
});

ok("préstamo activo con todo el capital bloqueado rechaza la transferencia", () => {
  const alice = mockPlayer("AliceLock", "XA"); const bob = mockPlayer("BobLock", "XB");
  world._players = [alice, bob];
  setMoney(alice, 1000); setMoney(bob, 0);
  setProp(alice, "bank_loan_v1", 5000); setProp(alice, "bank_loan_transfer_lock_v1", 1000);
  emitCmd(alice, "pay BobLock 300");
  eq(getMoney(alice), 1000, "origen intacto");
  eq(getMoney(bob), 0, "destino intacto");
  assert.ok(lastMsg(alice).includes("dinero prestado"), "mensaje de bloqueo de préstamo");
});

ok("préstamo activo permite transferir solo el excedente no bloqueado", () => {
  const alice = mockPlayer("AliceSurplus", "XA"); const bob = mockPlayer("BobSurplus", "XB");
  world._players = [alice, bob];
  setMoney(alice, 1000); setMoney(bob, 0);
  setProp(alice, "bank_loan_v1", 5000); setProp(alice, "bank_loan_transfer_lock_v1", 400);
  emitCmd(alice, "pay BobSurplus 500");
  eq(getMoney(alice), 500, "origen debitado solo el excedente");
  eq(getMoney(bob), 500, "destino acreditado");
});

ok("transferencia que excede el disponible (pero cabe en el saldo) es bloqueada", () => {
  const alice = mockPlayer("AliceOver", "XA"); const bob = mockPlayer("BobOver", "XB");
  world._players = [alice, bob];
  setMoney(alice, 1000); setMoney(bob, 0);
  setProp(alice, "bank_loan_v1", 5000); setProp(alice, "bank_loan_transfer_lock_v1", 400);
  emitCmd(alice, "pay BobOver 700");
  eq(getMoney(alice), 1000, "origen intacto");
  eq(getMoney(bob), 0, "destino intacto");
  assert.ok(lastMsg(alice).includes("dinero prestado"), "mensaje de bloqueo");
});

ok("saldo insuficiente sigue rechazándose", () => {
  const alice = mockPlayer("AlicePoor", "XA"); const bob = mockPlayer("BobPoor", "XB");
  world._players = [alice, bob];
  setMoney(alice, 100); setMoney(bob, 0);
  setProp(alice, "bank_loan_v1", 0); setProp(alice, "bank_loan_transfer_lock_v1", undefined);
  emitCmd(alice, "pay BobPoor 500");
  eq(getMoney(alice), 100, "origen intacto");
  eq(getMoney(bob), 0, "destino intacto");
});

console.log("Currency Fase 2 - revalidación atómica de diálogos async:");

await okAsync("depósito exitoso cuando el saldo es consistente (camino feliz)", async () => {
  const p = mockPlayer("DepositOk", "XD"); world._players = [p];
  setMoney(p, 1000); setProp(p, "bank_savings_v1", 0); setWorld("bank_vault_funds", 0);
  globalThis.__formDriver = (d) => {
    if (d.kind === "action" && d.title.includes("Banco General")) return { canceled: false, selection: 0 };
    if (d.kind === "modal" && d.title.includes("Depositar")) return { canceled: false, formValues: ["300"] };
    return { canceled: true };
  };
  emitCmd(p, "banco");
  await flush();
  eq(getMoney(p), 700, "mano debitada");
  eq(Number(globalThis.__sqlite_get_prop_v2__("currency_addon", p, "bank_savings_v1")), 300, "ahorros acreditados");
});

await okAsync("depósito rechaza si el saldo en mano cayó mientras el modal estaba abierto", async () => {
  const p = mockPlayer("DepositRace", "XD"); world._players = [p];
  setMoney(p, 1000); setProp(p, "bank_savings_v1", 0);
  globalThis.__formDriver = (d, player) => {
    if (d.kind === "action" && d.title.includes("Banco General")) return { canceled: false, selection: 0 };
    if (d.kind === "modal" && d.title.includes("Depositar")) {
      // Gasto concurrente: el saldo real cae a 100 antes de confirmar.
      setMoney(player, 100);
      return { canceled: false, formValues: ["500"] };
    }
    return { canceled: true };
  };
  emitCmd(p, "banco");
  await flush();
  eq(getMoney(p), 100, "no se crea dinero: el saldo permanece en 100");
  eq(Number(globalThis.__sqlite_get_prop_v2__("currency_addon", p, "bank_savings_v1")), 0, "ahorros intactos");
  assert.ok(lastMsg(p).includes("suficiente dinero en mano"), "rechazo por saldo insuficiente revalidado");
});

await okAsync("retiro rechaza si la bóveda se queda sin liquidez concurrentemente", async () => {
  const p = mockPlayer("WithdrawRace", "XW"); world._players = [p];
  setMoney(p, 0); setProp(p, "bank_savings_v1", 1000); setWorld("bank_vault_funds", 1000);
  globalThis.__formDriver = (d) => {
    if (d.kind === "action" && d.title.includes("Banco General")) return { canceled: false, selection: 1 };
    if (d.kind === "modal" && d.title.includes("Retirar")) {
      setWorld("bank_vault_funds", 0);
      return { canceled: false, formValues: ["500"] };
    }
    return { canceled: true };
  };
  emitCmd(p, "banco");
  await flush();
  eq(getMoney(p), 0, "mano intacta");
  eq(Number(globalThis.__sqlite_get_prop_v2__("currency_addon", p, "bank_savings_v1")), 1000, "ahorros intactos");
  assert.ok(lastMsg(p).includes("liquidez"), "rechazo por liquidez revalidado");
});

await okAsync("préstamo rechaza si ya se aprobó otro préstamo con el modal abierto", async () => {
  const p = mockPlayer("LoanRace", "XL"); world._players = [p];
  setMoney(p, 0); setProp(p, "bank_savings_v1", 0); setProp(p, "bank_loan_v1", 0);
  globalThis.__formDriver = (d, player) => {
    if (d.kind === "action" && d.title.includes("Banco General")) return { canceled: false, selection: 14 };
    if (d.kind === "modal" && d.title.includes("Pedir un Préstamo")) {
      setProp(player, "bank_loan_v1", 5000);
      return { canceled: false, formValues: ["1000"] };
    }
    return { canceled: true };
  };
  emitCmd(p, "banco");
  await flush();
  eq(getMoney(p), 0, "no se desembolsa capital");
  eq(Number(globalThis.__sqlite_get_prop_v2__("currency_addon", p, "bank_loan_v1")), 5000, "deuda concurrente preservada");
  assert.ok(lastMsg(p).includes("Ya tienes un préstamo activo"), "rechazo por préstamo activo revalidado");
});

console.log("\\n" + n + "/" + n + " escenarios de currency en verde.");
`);
    const output = execFileSync(process.execPath, ["test.mjs"], { cwd: sandbox, encoding: "utf8", stdio: "pipe" });
    process.stdout.write(output);
    const match = output.match(/(\d+)\/(\d+) escenarios de currency/);
    if (match) passed += Number(match[1]);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

try {
  runCurrencySuite();
  console.log("\nCurrency Fase 2: " + passed + " escenarios en verde.");
} catch (err) {
  console.error("\n❌ FALLO EN TEST CURRENCY FASE 2:", err && err.stack ? err.stack : err);
  process.exit(1);
}