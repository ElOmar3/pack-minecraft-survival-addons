// Test funcional Fase 2 de fcx_limited_admin:
// 1. La autoridad administrativa depende solo del token (sin fallback de tags/op).
// 2. AuthorizationService y AdminSessionInvalidator ya no permiten el bypass OWNER.
// 3. El demonio reenvía [FCX_RELAY_BAN_REQUEST_V1] como scriptevent server:moderation
//    (conversión de duración, validación y rechazo de inyección por prefijo).
// 4. home_spawn aplica ban/unban sobre bans_db y expulsa al jugador conectado.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawn } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
let passed = 0;
function report(name) { passed++; console.log("  OK " + name); }

// ---------------------------------------------------------------------------
// PARTE 1: identidad / autorización / invalidador (módulos fcx, JS puro)
// ---------------------------------------------------------------------------
function runIdentitySuite() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "fcx-id-"));
  try {
    fs.cpSync(path.join(repoRoot, "behavior_packs", "fcx_limited_admin", "scripts"), path.join(sandbox, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(sandbox, "test.mjs"), `
import assert from "node:assert";
import { AdminIdentityResolver, TOKEN_PROPERTY, BINDING_PROPERTY } from "./scripts/identity/AdminIdentityResolver.js";
import { AuthorizationService } from "./scripts/authorization/AuthorizationService.js";
import { AdminSessionInvalidator } from "./scripts/security/AdminSessionInvalidator.js";
import { Capability } from "./scripts/authorization/Capability.js";
import { Role } from "./scripts/authorization/RoleDefinition.js";
import { AdminErrorCode } from "./scripts/shared/AdminErrors.js";
import { sha256 } from "./scripts/shared/Crypto.js";

const store = new Map();
const ownerKey = (o) => typeof o === "string" ? o : (!o ? "world" : (o.name ? String(o.name).toLowerCase() : (o.id !== undefined ? String(o.id) : "world")));
const k = (a, o, key) => a + "\\u0000" + ownerKey(o) + "\\u0000" + key;
globalThis.__sqlite_get_prop_v2__ = (a, o, key) => store.get(k(a, o, key));
globalThis.__sqlite_set_prop_v2__ = (a, o, key, value) => { if (value === undefined) store.delete(k(a, o, key)); else store.set(k(a, o, key), value); };

const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("  OK " + name); };

function mockRegistry(records = new Map(), opts = {}) {
  return {
    findActiveByPrincipalId: (id) => records.get(id) || null,
    isRevoked: (id) => Boolean(opts.revoked && opts.revoked.has(id)),
    isSuspended: (id) => Boolean(opts.suspended && opts.suspended.has(id)),
    isLocked: () => Boolean(opts.locked),
    policyVersion: () => 1
  };
}
const opPlayer = { id: "e1", name: "Owner", xuid: "XO", playerPermissionLevel: 2, hasTag: (t) => ["op", "admin", "owner"].includes(String(t).toLowerCase()) };
const TOKEN = "a".repeat(64);
const BINDING = "b".repeat(64);
const PRINCIPAL = sha256(TOKEN);

console.log("FCX Fase 2 - identidad sin fallback:");

ok("op con tags vanilla pero sin token es rechazado", () => {
  const resolver = new AdminIdentityResolver(mockRegistry(), {});
  const result = resolver.resolve(opPlayer);
  assert.strictEqual(result.ok, false);
  eq(result.code, AdminErrorCode.IDENTITY_UNAVAILABLE);
});

ok("op con token no registrado es rechazado (sin rol OWNER regalado)", () => {
  globalThis.__sqlite_set_prop_v2__("fcx_limited_admin", opPlayer, TOKEN_PROPERTY, TOKEN);
  const resolver = new AdminIdentityResolver(mockRegistry(), {});
  const result = resolver.resolve(opPlayer);
  assert.strictEqual(result.ok, false);
  eq(result.code, AdminErrorCode.ACTOR_NOT_REGISTERED);
});

ok("token válido + binding correcto resuelve identidad aprovisionada", () => {
  globalThis.__sqlite_set_prop_v2__("fcx_limited_admin", opPlayer, BINDING_PROPERTY, BINDING);
  const records = new Map([[PRINCIPAL, { role: Role.OWNER, principalId: PRINCIPAL, bindingHash: sha256(BINDING) }]]);
  const resolver = new AdminIdentityResolver(mockRegistry(records), {});
  const result = resolver.resolve(opPlayer);
  assert.strictEqual(result.ok, true);
  eq(result.value.identitySource, "PROVISIONED_PLAYER_TOKEN");
  eq(result.value.role, Role.OWNER);
  eq(result.value.principalId, PRINCIPAL);
});

ok("token válido con binding incorrecto es rechazado aunque sea op", () => {
  globalThis.__sqlite_set_prop_v2__("fcx_limited_admin", opPlayer, BINDING_PROPERTY, "c".repeat(64));
  const records = new Map([[PRINCIPAL, { role: Role.OWNER, principalId: PRINCIPAL, bindingHash: sha256(BINDING) }]]);
  const resolver = new AdminIdentityResolver(mockRegistry(records), {});
  const result = resolver.resolve(opPlayer);
  assert.strictEqual(result.ok, false);
  eq(result.code, AdminErrorCode.IDENTITY_UNAVAILABLE);
});

ok("token revocado devuelve TOKEN_REVOKED", () => {
  globalThis.__sqlite_set_prop_v2__("fcx_limited_admin", opPlayer, BINDING_PROPERTY, BINDING);
  const resolver = new AdminIdentityResolver(mockRegistry(new Map(), { revoked: new Set([PRINCIPAL]) }), {});
  const result = resolver.resolve(opPlayer);
  assert.strictEqual(result.ok, false);
  eq(result.code, AdminErrorCode.TOKEN_REVOKED);
});

console.log("FCX Fase 2 - autorización sin bypass:");

const config = { enabled: true, roleDefinitions: { OWNER: [Capability.PLAYER_TEMPBAN, Capability.PLAYER_PERMABAN], MODERATOR: [Capability.PLAYER_TEMPBAN] }, allowPermanentBans: true };

ok("actor sin registro activo es revocado aunque se declare OWNER fallback", () => {
  const auth = new AuthorizationService(config, mockRegistry(), { isProtectedTarget: () => ({ ok: true }) });
  const fakeFallback = { principalId: "op_fallback_owner", role: Role.OWNER, identitySource: "OPERATOR_FALLBACK" };
  const result = auth.authorize(fakeFallback, Capability.PLAYER_TEMPBAN);
  assert.strictEqual(result.ok, false);
  eq(result.code, AdminErrorCode.ADMIN_SESSION_REVOKED);
});

ok("actor registrado con rol coincidente es autorizado", () => {
  const records = new Map([[PRINCIPAL, { role: Role.OWNER, principalId: PRINCIPAL }]]);
  const auth = new AuthorizationService(config, mockRegistry(records), { isProtectedTarget: () => ({ ok: true }) });
  const actor = { principalId: PRINCIPAL, role: Role.OWNER, identitySource: "PROVISIONED_PLAYER_TOKEN" };
  const result = auth.authorize(actor, Capability.PLAYER_TEMPBAN);
  assert.strictEqual(result.ok, true);
});

ok("actor cuyo rol cambió en el registry es revocado", () => {
  const records = new Map([[PRINCIPAL, { role: Role.MODERATOR, principalId: PRINCIPAL }]]);
  const auth = new AuthorizationService(config, mockRegistry(records), { isProtectedTarget: () => ({ ok: true }) });
  const actor = { principalId: PRINCIPAL, role: Role.OWNER, identitySource: "PROVISIONED_PLAYER_TOKEN" };
  const result = auth.authorize(actor, Capability.PLAYER_TEMPBAN);
  assert.strictEqual(result.ok, false);
  eq(result.code, AdminErrorCode.ADMIN_SESSION_REVOKED);
});

console.log("FCX Fase 2 - invalidador de confirmaciones:");

ok("confirmación con principal distinto es revocada (sin bypass fallback)", () => {
  const records = new Map([[PRINCIPAL, { role: Role.OWNER }]]);
  const inv = new AdminSessionInvalidator(mockRegistry(records), 60000);
  const actor = { principalId: PRINCIPAL, role: Role.OWNER, entityIdSnapshot: "e1" };
  const id = inv.create(actor, "player.tempban", "target1", {});
  const impostor = { principalId: "otro", role: Role.OWNER, identitySource: "OPERATOR_FALLBACK" };
  const result = inv.consume(id, impostor, "target1");
  assert.strictEqual(result.ok, false);
  eq(result.code, AdminErrorCode.ADMIN_SESSION_REVOKED);
});

ok("confirmación con principal correcto pero sin registro activo es revocada", () => {
  const inv = new AdminSessionInvalidator(mockRegistry(), 60000);
  const actor = { principalId: PRINCIPAL, role: Role.OWNER, entityIdSnapshot: "e1" };
  const id = inv.create(actor, "player.tempban", "target1", {});
  const result = inv.consume(id, actor, "target1");
  assert.strictEqual(result.ok, false);
  eq(result.code, AdminErrorCode.ADMIN_SESSION_REVOKED);
});

ok("confirmación con principal correcto y registro activo se consume", () => {
  const records = new Map([[PRINCIPAL, { role: Role.OWNER }]]);
  const inv = new AdminSessionInvalidator(mockRegistry(records), 60000);
  const actor = { principalId: PRINCIPAL, role: Role.OWNER, entityIdSnapshot: "e1" };
  const id = inv.create(actor, "player.tempban", "target1", {});
  const result = inv.consume(id, actor, "target1");
  assert.strictEqual(result.ok, true);
});

console.log("\\n" + n + "/" + n + " escenarios de identidad en verde.");
`);
    const output = execFileSync(process.execPath, ["test.mjs"], { cwd: sandbox, encoding: "utf8", stdio: "pipe" });
    process.stdout.write(output);
    const match = output.match(/(\d+)\/(\d+) escenarios de identidad/);
    if (match) passed += Number(match[1]);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// PARTE 2: relay de bans del demonio (modo pipe, proceso real)
// ---------------------------------------------------------------------------
function runDaemonRelaySuite() {
  return new Promise((resolve, reject) => {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "fcx-daemon-"));
    const dbPath = path.join(sandbox, "data", "test.db");
    const daemonPath = path.join(repoRoot, "bridge", "sqlite-daemon.js");
    const child = spawn(process.execPath, [daemonPath, "--pipe", "--db-path", dbPath], {
      env: { ...process.env, BDS_PIPE_MODE: "1" },
      stdio: ["pipe", "pipe", "pipe"]
    });
    let out = "";
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.stderr.on("data", () => {});
    child.on("error", reject);

    const req = (action, targetName, duration, reason, actorName) =>
      `[FCX_RELAY_BAN_REQUEST_V1] ${JSON.stringify({ schemaVersion: 1, correlationId: "corr123", action, targetName, duration, reason, actorName })}`;

    const lines = [
      req("permaban", "Malo", "permanent", "griefing", "Admin"),
      req("tempban", "Temporal", "2h", "spam", "Admin"),
      req("tempban", "Dias", "7d", "hack", "Admin"),
      req("unban", "Malo", "none", "manual_unban", "Admin"),
      // Inyección por chat: prefijo no autorizado, debe descartarse.
      `Malo: ${req("permaban", "Inyectado", "permanent", "x", "Admin")}`,
      // Nombre inválido (comillas), debe descartarse.
      req("permaban", 'Mal"o', "permanent", "x", "Admin"),
      // Duración fuera de rango (>90 días), debe descartarse.
      req("tempban", "Eterno", "999d", "x", "Admin"),
      // Duración con formato inválido, debe descartarse.
      req("tempban", "Raro", "abc", "x", "Admin")
    ];

    setTimeout(() => {
      for (const line of lines) child.stdin.write(line + "\n");
      setTimeout(() => {
        child.kill("SIGTERM");
        setTimeout(() => {
          try {
            const events = out.split("\n")
              .filter((l) => l.startsWith("scriptevent server:moderation "))
              .map((l) => JSON.parse(l.slice("scriptevent server:moderation ".length)));
            console.log("FCX Fase 2 - relay de bans del demonio:");
            const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(m + " => " + JSON.stringify(a)); };

            eq(events.length, 4, "solo 4 solicitudes legítimas deben reenviarse");
            eq(events[0], { action: "permanent", playerName: "Malo", reason: "griefing", actorName: "Admin", correlationId: "corr123" }, "permaban");
            report("permaban -> permanent");
            eq(events[1], { action: "temporary", playerName: "Temporal", durationMinutes: 120, reason: "spam", actorName: "Admin", correlationId: "corr123" }, "tempban 2h");
            report("tempban 2h -> 120 minutos");
            eq(events[2].durationMinutes, 10080, "tempban 7d");
            report("tempban 7d -> 10080 minutos");
            eq(events[3].action, "unban", "unban");
            report("unban -> unban");
            assertNo(events, "Inyectado", "la inyección por chat no debe reenviarse");
            report("inyección por prefijo de chat descartada");
            assertNo(events, 'Mal"o', "nombre inválido descartado");
            report("nombre inválido descartado");
            assertNo(events, "Eterno", "duración >90d descartada");
            report("duración fuera de rango descartada");
            assertNo(events, "Raro", "duración inválida descartada");
            report("duración con formato inválido descartada");
            resolve();
          } catch (err) {
            reject(err);
          } finally {
            fs.rmSync(sandbox, { recursive: true, force: true });
          }
        }, 250);
      }, 700);
    }, 700);

    function assertNo(events, name, msg) {
      if (events.some((e) => e.playerName === name)) throw new Error(msg);
    }
  });
}

// ---------------------------------------------------------------------------
// PARTE 3: consumidor de bans en home_spawn (carga del main.js con mocks)
// ---------------------------------------------------------------------------
function runHomeSpawnSuite() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "fcx-home-"));
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
export const world = {
  _players: [], _commands: [], _messages: [],
  getAllPlayers() { return this._players; },
  getDimension() { return { id: "minecraft:overworld", runCommand(cmd) { world._commands.push(cmd); return { successCount: 1 }; }, getBlock() { return undefined; }, getEntities() { return []; } }; },
  sendMessage(m) { this._messages.push(m); },
  scoreboard: { getObjective: () => null, getObjectives: () => [] },
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
  afterEvents: { scriptEventReceive: makeSignal() }
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
function formProxy() {
  const proxy = new Proxy({}, { get: (t, p) => { if (p === "show") return () => Promise.resolve({ canceled: true, formValues: [] }); return () => proxy; } });
  return proxy;
}
export class ActionFormData { constructor() { return formProxy(); } }
export class ModalFormData { constructor() { return formProxy(); } }
export class MessageFormData { constructor() { return formProxy(); } }
`);
    fs.cpSync(path.join(repoRoot, "behavior_packs", "home_spawn_addon", "scripts"), path.join(sandbox, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(sandbox, "test.mjs"), `
import assert from "node:assert";
import { world, system } from "@minecraft/server";

// Puente SQLite en RAM con el lector tolerante canónico.
const store = new Map();
const ownerKey = (o) => typeof o === "string" ? o : (!o ? "world" : (o.name ? String(o.name).toLowerCase() : "world"));
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

// Cargar el main.js completo: registra el consumidor de server:moderation.
await import("./scripts/main.js");

const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("  OK " + name); };
const emit = (payload) => system.afterEvents.scriptEventReceive.emit({ id: "server:moderation", message: JSON.stringify(payload), sourceEntity: undefined });
const bans = () => globalThis.__sqlite_read_json_v3__(store.get(k("home_spawn_addon", "world", "bans_db")), []);
const mockPlayer = (name, xuid) => ({ isValid: true, name, xuid, id: "id-" + name, dimension: world.getDimension(), typeId: "minecraft:player", sendMessage() {} });

console.log("FCX Fase 2 - consumidor de bans en home_spawn:");

ok("ban temporal escribe bans_db y expulsa al jugador conectado", () => {
  world._players = [mockPlayer("Temporal", "XT")];
  world._commands.length = 0;
  emit({ action: "temporary", playerName: "Temporal", durationMinutes: 60, reason: "spam", actorName: "Admin", correlationId: "c1" });
  const db = bans();
  eq(db.length, 1, "un ban registrado");
  eq(db[0].nameLower, "temporal");
  eq(db[0].xuid, "XT", "captura el XUID del jugador conectado");
  eq(db[0].by, "Admin");
  assert.ok(db[0].expiresAt > Date.now(), "ban temporal vigente");
  assert.ok(world._commands.some((c) => c.startsWith('kick "Temporal"')), "kick emitido");
});

ok("ban permanente usa expiresAt=0", () => {
  world._players = [];
  emit({ action: "permanent", playerName: "Malo", reason: "griefing", actorName: "Admin", correlationId: "c2" });
  const entry = bans().find((b) => b.nameLower === "malo");
  assert.ok(entry, "ban permanente registrado");
  eq(entry.expiresAt, 0);
});

ok("re-banear reemplaza la entrada en lugar de duplicar", () => {
  world._players = [];
  emit({ action: "permanent", playerName: "Malo", reason: "otra vez", actorName: "Admin", correlationId: "c3" });
  const entries = bans().filter((b) => b.nameLower === "malo");
  eq(entries.length, 1, "no se duplica");
  eq(entries[0].reason, "otra vez");
});

ok("unban elimina la entrada", () => {
  world._players = [];
  emit({ action: "unban", playerName: "Malo", reason: "manual_unban", actorName: "Admin", correlationId: "c4" });
  assert.ok(!bans().some((b) => b.nameLower === "malo"), "ban retirado");
});

ok("evento con sourceEntity (jugador) es rechazado", () => {
  world._players = [];
  const before = bans().length;
  system.afterEvents.scriptEventReceive.emit({ id: "server:moderation", message: JSON.stringify({ action: "permanent", playerName: "Inyectado", reason: "x", actorName: "Admin", correlationId: "c5" }), sourceEntity: { typeId: "minecraft:player" } });
  eq(bans().length, before, "no se aplica ban inyectado por jugador");
});

ok("duración temporal fuera de rango es rechazada", () => {
  world._players = [];
  const before = bans().length;
  emit({ action: "temporary", playerName: "Eterno", durationMinutes: 999999, reason: "x", actorName: "Admin", correlationId: "c6" });
  eq(bans().length, before, "duración absurda rechazada");
});

ok("claves extra en el payload son rechazadas (esquema estricto)", () => {
  world._players = [];
  const before = bans().length;
  emit({ action: "permanent", playerName: "Raro", reason: "x", actorName: "Admin", correlationId: "c7", extra: true });
  eq(bans().length, before, "esquema estricto rechaza claves extra");
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

(async () => {
  try {
    runIdentitySuite();
    await runDaemonRelaySuite();
    runHomeSpawnSuite();
    console.log("\nFCX Fase 2: " + passed + " escenarios en verde.");
  } catch (err) {
    console.error("\n❌ FALLO EN TEST FCX FASE 2:", err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();