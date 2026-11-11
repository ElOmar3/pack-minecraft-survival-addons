// Test funcional Fase 3 de shop_addon:
// recordMarketSupply estaba definida pero nunca se invocaba, así que la curva
// de precios dinámicos (market_supply_hourly_v1) jamás se movía. Ahora las
// ventas suman oferta (bajan el precio de reventa hasta el piso del 60%) y las
// compras restan oferta (recuperan el precio hasta el techo del 100%).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
let passed = 0;

function runShopSuite() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "shop-p3-"));
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
  getDimension() { return { id: "minecraft:overworld", runCommand() { return { successCount: 1 }; }, getBlock() { return undefined; }, getEntities() { return []; }, spawnItem() {} }; },
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
export class ItemStack { constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; } }
export const EnchantmentTypes = { get: () => undefined };
export const CommandPermissionLevel = { Any: 0, GameDirectors: 1, Admin: 2, Host: 3, Owner: 4 };
export const CustomCommandStatus = { Success: 0, Failure: 1 };
export const CustomCommandParamType = { String: 0, Integer: 1, Float: 2, Boolean: 3, Entity: 4, Player: 5, Block: 6, Item: 7, Location: 8, Enum: 9 };
`);
    fs.writeFileSync(path.join(uiDir, "index.js"), `
class FormBase {
  constructor(kind) { this._kind = kind; this._title = ""; this._body = ""; this._buttons = []; this._fields = []; }
  title(t) { this._title = String(t); return this; }
  body(b) { this._body = String(b); return this; }
  button(b) { this._buttons.push(String(b)); return this; }
  textField(label, placeholder, opts) { this._fields.push({ type: "textField", label }); return this; }
  slider(label, min, max, opts) { this._fields.push({ type: "slider", label }); return this; }
  toggle(label, opts) { this._fields.push({ type: "toggle", label }); return this; }
  dropdown(label, options, opts) { this._fields.push({ type: "dropdown", label }); return this; }
  show(player) {
    const responder = globalThis.__formResponder;
    const response = responder ? responder(this) : { canceled: true };
    return Promise.resolve(response);
  }
}
export class ActionFormData extends FormBase { constructor() { super("action"); } }
export class ModalFormData extends FormBase { constructor() { super("modal"); } }
export class MessageFormData extends FormBase { constructor() { super("message"); } }
`);
    fs.cpSync(path.join(repoRoot, "behavior_packs", "shop_addon", "scripts"), path.join(sandbox, "scripts"), { recursive: true });
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
const hourKey = () => new Date().toISOString().slice(0, 13);
const MARKET_KEY = "market_supply_hourly_v1";
const supplyRaw = () => store.get(k("shop_addon", "world", MARKET_KEY));
const supplyCount = (itemKey) => {
  const data = supplyRaw() ? JSON.parse(supplyRaw()) : {};
  return Number(data[hourKey()]?.[itemKey] || 0);
};
const seedSupply = (data) => store.set(k("shop_addon", "world", MARKET_KEY), JSON.stringify(data));

function makeItem(typeId, amount) {
  return {
    typeId, amount, nameTag: undefined,
    getLore: () => [], getCanDestroy: () => [], getCanPlaceOn: () => [],
    getComponent: () => undefined,
    clone() { return Object.assign({}, this); }
  };
}
function mockPlayer(name, balance = 0) {
  const slots = new Array(36).fill(undefined);
  const container = {
    get size() { return slots.length; },
    getItem(i) { return slots[i]; },
    setItem(i, v) { slots[i] = v; },
    addItem(stack) { const idx = slots.findIndex((s) => !s); if (idx >= 0) { slots[idx] = stack; return undefined; } return stack; }
  };
  const p = {
    isValid: true, name, id: "id-" + name, typeId: "minecraft:player",
    location: { x: 0, y: 64, z: 0 },
    dimension: { id: "minecraft:overworld", spawnItem() {}, runCommand() { return { successCount: 1 }; } },
    _messages: [], _commands: [], _slots: slots,
    sendMessage(m) { this._messages.push(String(m)); },
    runCommand(cmd) { this._commands.push(String(cmd)); return { successCount: 1 }; },
    playSound() {}, onScreenDisplay: { setActionBar() {} },
    getComponent(id) { return id === "minecraft:inventory" ? { container } : undefined; }
  };
  if (balance > 0) world.scoreboard.addObjective("money", "dinero").setScore(p, balance);
  return p;
}
const balanceOf = (p) => world.scoreboard.getObjective("money")?.getScore(p) ?? 0;
const countIn = (p, typeId) => p._slots.reduce((acc, s) => acc + (s && s.typeId === typeId ? s.amount : 0), 0);

globalThis.__shopMode = "sell";
globalThis.__sellQty = 0;
globalThis.__buyItem = "Lingote de Hierro";
globalThis.__buyQty = 0;
globalThis.__formResponder = (form) => {
  const t = String(form._title || "");
  const buttons = form._buttons || [];
  if (t.includes("Tienda del Servidor")) {
    if (globalThis.__shopMode === "sell") return { selection: buttons.findIndex((b) => b.includes("Vender Materiales")) };
    return { selection: buttons.findIndex((b) => b.includes("Materiales")) };
  }
  if (t.includes("VENDER MATERIALES")) return { selection: 0 };
  if (t.includes("Vender:")) return { formValues: [String(globalThis.__sellQty), globalThis.__sellQty, false] };
  if (t.includes("Comprar:") && form._kind === "action") {
    const idx = buttons.findIndex((b) => b.startsWith(globalThis.__buyItem));
    return { selection: idx >= 0 ? idx : 0 };
  }
  if (t.includes("Comprar:") && form._kind === "modal") return { formValues: [String(globalThis.__buyQty)] };
  return { canceled: true };
};

async function sell(p, qty) {
  globalThis.__shopMode = "sell"; globalThis.__sellQty = qty;
  commands["s:tienda"]({ sourceEntity: p });
  await flush(); await flush(); await flush(); await flush();
}
async function buy(p, qty) {
  globalThis.__shopMode = "buy"; globalThis.__buyQty = qty;
  commands["s:tienda"]({ sourceEntity: p });
  await flush(); await flush(); await flush(); await flush();
}

console.log("Shop Fase 3 - curva de precios dinámicos (recordMarketSupply):");

await okAsync("la venta registra oferta y abarata la reventa siguiente", async () => {
  const p = mockPlayer("Vendador"); world._players = [p];
  p._slots[0] = makeItem("minecraft:iron_ingot", 5000);
  await sell(p, 2500);
  eq(supplyCount("minecraft:iron_ingot"), 2500, "oferta horaria registrada");
  eq(countIn(p, "minecraft:iron_ingot"), 2500, "inventario descontado");
  eq(balanceOf(p), 11875, "pago neto con arancel del 5%");
  await sell(p, 100);
  eq(supplyCount("minecraft:iron_ingot"), 2600, "oferta acumulada");
  eq(balanceOf(p), 12255, "la segunda venta paga el precio reducido ($4 c/u)");
});

await okAsync("las compras restan oferta y el techo del 100% evita sobreprecio", async () => {
  const p = mockPlayer("Comprador", 200000); world._players = [p];
  await buy(p, 2600);
  eq(supplyCount("minecraft:iron_ingot"), 0, "la compra drena la oferta acumulada");
  eq(balanceOf(p), 145400, "compra con IVA descontada");
  await buy(p, 2500);
  eq(supplyCount("minecraft:iron_ingot"), -2500, "oferta neta negativa tras sobrecompra");
  p._slots[0] = makeItem("minecraft:iron_ingot", 100);
  await sell(p, 100);
  eq(balanceOf(p), 93375, "el precio de reventa nunca supera el base ($5 c/u)");
});

await okAsync("el piso del 60% se respeta ante oferta extrema", async () => {
  seedSupply({ [hourKey()]: { "minecraft:iron_ingot": 100000 } });
  const p = mockPlayer("Rematador"); world._players = [p];
  p._slots[0] = makeItem("minecraft:iron_ingot", 1000);
  await sell(p, 100);
  eq(balanceOf(p), 285, "precio piso $3 c/u (60% de $5) con arancel");
  eq(supplyCount("minecraft:iron_ingot"), 100100, "oferta extrema acumulada");
});

await okAsync("la oferta se particiona por hora UTC y poda horas viejas", async () => {
  seedSupply({ "2020-01-01T00": { "minecraft:iron_ingot": 99999 } });
  const p = mockPlayer("Horario"); world._players = [p];
  p._slots[0] = makeItem("minecraft:iron_ingot", 100);
  await sell(p, 10);
  eq(balanceOf(p), 48, "la hora vieja no afecta el precio actual");
  const data = JSON.parse(supplyRaw());
  eq(Object.keys(data), [hourKey()], "solo la hora actual sobrevive");
  eq(data[hourKey()]["minecraft:iron_ingot"], 10, "oferta de la hora actual");
});

await okAsync("una venta rechazada por límite operativo no registra oferta", async () => {
  const before = supplyRaw();
  const p = mockPlayer("Millonario", 99999990); world._players = [p];
  p._slots[0] = makeItem("minecraft:iron_ingot", 5000);
  await sell(p, 2500);
  eq(supplyRaw(), before, "oferta intacta tras el rechazo");
  eq(countIn(p, "minecraft:iron_ingot"), 5000, "inventario intacto");
  assert.ok(p._messages.some((m) => m.includes("límite operativo")), "aviso de límite operativo");
});

await okAsync("una compra revertida por entrega fallida no registra oferta", async () => {
  const before = supplyRaw();
  const p = mockPlayer("Revertido", 100000); world._players = [p];
  p.runCommand = (cmd) => { p._commands.push(String(cmd)); return { successCount: String(cmd).startsWith("give") ? 0 : 1 }; };
  await buy(p, 10);
  eq(supplyRaw(), before, "oferta intacta tras la reversión");
  eq(balanceOf(p), 100000, "saldo reembolsado");
  assert.ok(p._messages.some((m) => m.includes("revertida")), "aviso de compra revertida");
});

console.log("\\n" + n + "/" + n + " escenarios de shop en verde.");
`);
    const output = execFileSync(process.execPath, ["test.mjs"], { cwd: sandbox, encoding: "utf8", stdio: "pipe" });
    process.stdout.write(output);
    const match = output.match(/(\d+)\/(\d+) escenarios de shop/);
    if (match) passed += Number(match[1]);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

try {
  runShopSuite();
  console.log("\nShop Fase 3: " + passed + " escenarios en verde.");
} catch (err) {
  console.error("\n❌ FALLO EN TEST SHOP FASE 3:", err && err.stack ? err.stack : err);
  process.exit(1);
}