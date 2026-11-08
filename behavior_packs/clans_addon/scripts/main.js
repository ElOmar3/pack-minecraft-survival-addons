import { ErrorReporter } from "./ErrorReporter.js";
import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, PlayerPermissionLevel, world, system } from "@minecraft/server";






// === PERSISTENCIA SQLITE PUENTE V3 (SEGURO PARA /reload) ===
if (!globalThis.__sqlite_store_v2__) globalThis.__sqlite_store_v2__ = new Map();
if (!globalThis.__sqlite_owner_key_v2__) {
  globalThis.__sqlite_owner_key_v2__ = function(owner) {
    if (typeof owner === "string") return owner;
    if (!owner) return "world";
    if (owner.name) return String(owner.name).toLowerCase();
    if (owner.id !== undefined) return String(owner.id);
    return "world";
  };
}
if (!globalThis.__sqlite_get_prop_v2__) {
  globalThis.__sqlite_get_prop_v2__ = function(addon, owner, key) {
    if (!addon || owner === undefined || owner === null || key === undefined) return undefined;
    const addonStore = globalThis.__sqlite_store_v2__.get(String(addon));
    const ownerStore = addonStore ? addonStore.get(globalThis.__sqlite_owner_key_v2__(owner)) : undefined;
    return ownerStore ? ownerStore[key] : undefined;
  };
}
if (!globalThis.__sqlite_set_prop_v2__) {
  globalThis.__sqlite_set_prop_v2__ = function(addon, owner, key, value) {
    if (!addon || owner === undefined || owner === null || key === undefined) return;
    const addonKey = String(addon);
    const ownerKey = globalThis.__sqlite_owner_key_v2__(owner);
    let addonStore = globalThis.__sqlite_store_v2__.get(addonKey);
    if (!addonStore) { addonStore = new Map(); globalThis.__sqlite_store_v2__.set(addonKey, addonStore); }
    let ownerStore = addonStore.get(ownerKey);
    if (!ownerStore) { ownerStore = {}; addonStore.set(ownerKey, ownerStore); }
    const payload = { addon: addonKey, owner: ownerKey, key };
    if (value === undefined) { delete ownerStore[key]; payload.deleted = true; }
    else { ownerStore[key] = value; payload.deleted = false; payload.value = value; }
    try { console.warn("[SQLITE_SAVE_V1] " + JSON.stringify(payload)); } catch (e) {}
  };
}
if (!globalThis.__sqlite_rehydrate_v2__) {
  globalThis.__sqlite_rehydrate_v2__ = function(addon, owner, key, value, deleted) {
    if (!addon || owner === undefined || owner === null || key === undefined) return;
    const addonKey = String(addon);
    const ownerKey = globalThis.__sqlite_owner_key_v2__(owner);
    let addonStore = globalThis.__sqlite_store_v2__.get(addonKey);
    if (!addonStore) { addonStore = new Map(); globalThis.__sqlite_store_v2__.set(addonKey, addonStore); }
    let ownerStore = addonStore.get(ownerKey);
    if (!ownerStore) { ownerStore = {}; addonStore.set(ownerKey, ownerStore); }
    if (deleted === true) delete ownerStore[key];
    else ownerStore[key] = value;
  };
}
if (!globalThis.__sqlite_sync_complete_v2__) globalThis.__sqlite_sync_complete_v2__ = new Map();
if (!globalThis.__sqlite_sync_status_v3__) globalThis.__sqlite_sync_status_v3__ = new Map();
if (!globalThis.__sqlite_request_sync_v3__) {
  globalThis.__sqlite_request_sync_v3__ = function(addon, attempt) {
    const addonKey = String(addon || "");
    if (!addonKey) return;
    const previous = globalThis.__sqlite_sync_status_v3__.get(addonKey) || {};
    globalThis.__sqlite_sync_status_v3__.set(addonKey, {
      ...previous,
      requestedAt: Date.now(),
      attempt: Number(attempt || 0),
      complete: false,
      protocol: 0,
    });
    try { console.warn("[SQLITE_REQUEST_SYNC] " + JSON.stringify({ addon: addonKey, protocol: 3, attempt: Number(attempt || 0) })); } catch (e) {}
  };
}
try {
  const signal = system.afterEvents && system.afterEvents.scriptEventReceive;
  if (!globalThis.__sqlite_chunk_store_v2__) globalThis.__sqlite_chunk_store_v2__ = new Map();
  if (!globalThis.__sqlite_listener_callback_v3__) {
    const callback = function(event) {
    if (!event || (event.id !== "sqlite:load" && event.id !== "sqlite:sync" && event.id !== "sqlite:load_chunk" && event.id !== "sqlite:sync_complete")) return;
    if (event.sourceEntity && event.sourceEntity.typeId === "minecraft:player") return;
    try {
      const payload = JSON.parse(event.message || "{}");
      if (event.id === "sqlite:sync_complete") {
        if (payload.addon) {
          const addonKey = String(payload.addon);
          globalThis.__sqlite_sync_complete_v2__.set(addonKey, Date.now());
          const previous = globalThis.__sqlite_sync_status_v3__.get(addonKey) || {};
          globalThis.__sqlite_sync_status_v3__.set(addonKey, {
            ...previous,
            complete: true,
            completedAt: Date.now(),
            protocol: Number(payload.protocol || 0),
            entryCount: Number(payload.entryCount || 0),
          });
        }
        return;
      }
      if (event.id === "sqlite:load_chunk") {
        const count = Number(payload.chunkCount);
        const index = Number(payload.chunkIndex);
        if (!payload.addon || payload.key === undefined || !payload.chunkId || !Number.isInteger(count) || count < 1 || count > 128 || !Number.isInteger(index) || index < 0 || index >= count) return;
        const chunkKey = String(payload.chunkId);
        let state = globalThis.__sqlite_chunk_store_v2__.get(chunkKey);
        if (!state || state.count !== count) {
          state = { count: count, chunks: new Array(count) };
          globalThis.__sqlite_chunk_store_v2__.set(chunkKey, state);
        }
        state.chunks[index] = String(payload.valueChunk || "");
        for (let partIndex = 0; partIndex < state.count; partIndex++) {
          if (typeof state.chunks[partIndex] !== "string") return;
        }
        const value = JSON.parse(state.chunks.join(""));
        globalThis.__sqlite_rehydrate_v2__(payload.addon, payload.owner || "world", payload.key, value, false);
        globalThis.__sqlite_chunk_store_v2__.delete(chunkKey);
        return;
      }
      if (payload.addon && payload.key !== undefined) {
        globalThis.__sqlite_rehydrate_v2__(payload.addon, payload.owner || "world", payload.key, payload.value, payload.deleted === true);
      }
    } catch (e) {}
    };
    globalThis.__sqlite_listener_callback_v3__ = callback;
    if (signal && typeof signal.subscribe === "function") signal.subscribe(callback);
  }
} catch (e) {}
globalThis.__sqlite_sync_complete_v2__.delete("clans_addon");
globalThis.__sqlite_request_sync_v3__("clans_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("clans_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("clans_addon", 1);
  } catch (e) {}
}, 120);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
console.warn("Clans Addon en JS iniciado.");
system.runTimeout(() => { try { const entries = [].map((id) => { const value = globalThis.__sqlite_get_prop_v2__("clans_addon", "world", id); return { id, size: typeof value === "string" ? value.length : value === undefined ? 0 : String(value).length }; }).sort((a, b) => b.size - a.size); console.warn(`[DP_AUDIT_CLANS_V1] total_chars=${entries.reduce((sum, entry) => sum + entry.size, 0)} largest=${JSON.stringify(entries.slice(0, 12))}`); } catch (e) { console.warn(`[DP_AUDIT_CLANS_V1] failed=${String(e?.message || e)}`); } }, 100);
const COMMAND_NAMESPACE = "s";

function commandOk(message) {
  return { status: CustomCommandStatus.Success, message };
}

function commandError(message) {
  return { status: CustomCommandStatus.Failure, message };
}

const CLAN_COLORS = ["red", "gold", "yellow", "green", "aqua", "blue", "light_purple"];
const BOUNTY_ENABLED = false; // Desactivación temporal; no elimina datos de clanes.
const CLAN_FRIENDLY_FIRE_ALLOWED = false; // Política comunitaria: nunca se habilita desde clanes.
const BOUNTY_STATE_KEY = "bounty_state";
const BOUNTY_COLISEUM_SESSION_KEY = "bounty_coliseum_session";
const BOUNTY_DISABLED_RECOVERY_KEY = "bounty_disabled_recovery_v1";
const ACTIVE_COLISEUM_KEY = "active_coliseum_id";
const BOUNTY_AUTO_INTERVAL_TICKS = 30 * 60 * 20;
const BOUNTY_MAINTENANCE_INTERVAL_TICKS = 100;
const BOUNTY_DEFAULT_REWARD = 5000;
const BOUNTY_MAX_REWARD = 10000;
const BOUNTY_DAILY_EARNINGS_LIMIT = 10000;
const BOUNTY_EARNINGS_PROPERTY = "bounty_earnings_v1";
const MAX_OPERATIONAL_BALANCE = 100000000;
const ECONOMY_DAILY_EMISSION_LIMIT = 50000;
const BOUNTY_DURATION_MS = 5 * 60 * 1000;
const BOUNTY_TARGET_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const BOUNTY_COLISEUM_ENFORCE_INTERVAL_TICKS = 40;
const BOUNTY_COLISEUM_START_DELAY_MS = 10 * 1000;
const BOUNTY_COLISEUM_TELEPORT_RETRY_TICKS = 10;
const BOUNTY_COLISEUM_TELEPORT_MAX_ATTEMPTS = 6;
const BOUNTY_TELEPORT_EXEMPT_TAG = "event_mode";
const BOUNTY_TELEPORT_EXEMPT_TICKS = 60;
const BEDROCK_COLOR_CODES = {
  "red": "§c",
  "gold": "§6",
  "yellow": "§e",
  "green": "§a",
  "aqua": "§b",
  "blue": "§9",
  "light_purple": "§d"
};
let activeBountyColiseumSession = null;
const bountyCombatWarmups = new Map();
const dynamicJsonCache = new Map();
const pendingAdminClanDissolutions = new Map();

function loadCachedJson(key, fallbackValue) {
  const raw = String(globalThis.__sqlite_get_prop_v2__("clans_addon", "world", key) || "");
  const cached = dynamicJsonCache.get(key);
  if (cached?.raw === raw) return cached.value;

  const value = raw ? JSON.parse(raw) : fallbackValue;
  dynamicJsonCache.set(key, { raw, value });
  return value;
}

function saveCachedJson(key, value, emptyValue = "") {
  const raw = value === null ? emptyValue : JSON.stringify(value);
  globalThis.__sqlite_set_prop_v2__("clans_addon", "world", key, raw);
  dynamicJsonCache.set(key, { raw, value });
}

const RESERVED_CLAN_WORDS = [
  "admin", "administrador", "administrator", "staff", "mod", "moderador", 
  "soporte", "support", "owner", "creador", "developer", "dev", "root", "system",
  "vip", "mvp", "elite", "oficial", "official", "servidor", "server", "fcx",
  "sheriff", "guardia", "policia", "police", "seguridad", "security", "helper",
  "minecraft", "mojang", "microsoft", "discord", "tebex"
];

const PROFANITY_CLAN_WORDS = [
  "puta", "puto", "mierda", "joder", "culiao", "culiado", "marico", "maricon", 
  "pendejo", "gonorrea", "chingar", "chingon", "cabron", "ass", "fuck", "shit", 
  "bitch", "bastard"
];

function normalizeClanName(name) {
  return name.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function containsForbiddenWord(name, forbiddenWords) {
  const normalized = normalizeClanName(name);
  for (const word of forbiddenWords) {
    if (normalized.includes(word)) {
      return true;
    }
  }
  return false;
}

function isPlayerOp(player) {
  if (!player) return false;
  try {
    if (player.playerPermissionLevel === PlayerPermissionLevel.Operator) return true;
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  try {
    if (typeof player.isOp === "function") {
      return player.isOp() === true;
    }
    if (player.isOp === true) {
      return true;
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  return false;
}

function isForbiddenClanName(name) {
  if (containsForbiddenWord(name, PROFANITY_CLAN_WORDS)) {
    return true;
  }

  if (containsForbiddenWord(name, RESERVED_CLAN_WORDS)) {
    return true;
  }

  return false;
}

// Auxiliares de persistencia
function loadClansData() {
  try {
    return loadCachedJson("clans_db", {});
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn("Error al cargar la base de datos de clanes: " + e);
    return {};
  }
}

function saveClansData(data) {
  try {
    saveCachedJson("clans_db", data);
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn("Error al guardar la base de datos de clanes: " + e);
  }
}

// Sanea clanes creados antes de la política actual sin editar LevelDB fuera de BDS.
function dissolveForbiddenClans() {
  const db = loadClansData();
  const removed = [];
  for (const [key, clan] of Object.entries(db)) {
    const name = String(clan?.name ?? key);
    if (!isForbiddenClanName(name)) continue;
    for (const player of world.getAllPlayers()) {
      if (getPlayerClan(player) === key) {
        setPlayerClan(player, "");
        player.sendMessage(`§c[Clanes] Tu clan §e${name}§c fue disuelto por usar un nombre reservado.`);
      }
    }
    delete db[key];
    removed.push(name);
  }
  if (removed.length) {
    saveClansData(db);
    console.warn(`[CLAN_POLICY_ENFORCEMENT] ${JSON.stringify({ action: "dissolve_reserved_clans", removed })}`);
    world.sendMessage(`§e[Clanes] Se disolvieron ${removed.length} clan(es) con nombres reservados.`);
  }
}

system.run(() => dissolveForbiddenClans());

function adminDissolveClan(admin, key) {
  if (!isPlayerOp(admin)) return admin.sendMessage("§c[Clanes] No tienes permisos administrativos.");
  const db = loadClansData();
  const clan = db[key];
  if (!clan) return admin.sendMessage("§c[Clanes] Ese clan ya no existe.");
  for (const player of world.getAllPlayers()) {
    if (getPlayerClan(player) === key) {
      setPlayerClan(player, "");
      player.sendMessage(`§c[Clanes] Tu clan §e${clan.name}§c fue disuelto por la administración.`);
    }
  }
  delete db[key];
  saveClansData(db);
  console.warn(`[CLAN_ADMIN_AUDIT] ${JSON.stringify({ action: "dissolve", actor: admin.name, clan: clan.name, key, timestamp: Date.now() })}`);
  world.sendMessage(`§c[Clanes] El clan §e${clan.name}§c fue disuelto por la administración.`);
}

function openAdminClanConfirm(admin, key) {
  if (!isPlayerOp(admin)) return admin.sendMessage("§c[Clanes] No tienes permisos administrativos.");
  const clan = loadClansData()[key];
  if (!clan) return admin.sendMessage("§c[Clanes] Ese clan ya no existe.");
  pendingAdminClanDissolutions.set(String(admin.id), { key, expiresAt: Date.now() + 30_000 });
  admin.sendMessage(`§c[Clanes] Confirmación requerida: §e${clan.name}§c (líder: ${clan.owner}, miembros: ${clan.members?.length ?? 0}, banco: $${clan.balance ?? 0}).`);
  admin.sendMessage("§eEscribe §f s:adminclanconfirmar §een los próximos 30 segundos para disolverlo.");
}

function openAdminClansMenu(admin) {
  if (!isPlayerOp(admin)) return admin.sendMessage("§c[Clanes] No tienes permisos administrativos.");
  const entries = Object.entries(loadClansData()).sort(([, a], [, b]) => String(a?.name ?? "").localeCompare(String(b?.name ?? "")));
  if (!entries.length) return admin.sendMessage("§e[Clanes] No hay clanes registrados.");
  admin.sendMessage(`§b[Clanes] §fLista administrativa (${entries.length}):`);
  for (const [, clan] of entries.slice(0, 100)) admin.sendMessage(`§7• §e${clan.name} §7— líder: §f${clan.owner} §7| miembros: §f${clan.members?.length ?? 0}`);
  admin.sendMessage("§eUsa: §f s:adminclandisolver \"nombre\" §epara seleccionar uno.");
}

function getMoneyObjective() {
  let obj = world.scoreboard.getObjective("money");
  if (!obj) {
    try {
      obj = world.scoreboard.addObjective("money", "§e$ Dinero");
    } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }
  return obj;
}

function addBalance(playerOrName, amount) {
  const obj = getMoneyObjective();
  if (!obj) return false;
  try {
    const current = obj.getScore(playerOrName) ?? 0;
    const delta = Math.floor(Number(amount) || 0);
    const next = current + delta;
    if (!Number.isSafeInteger(delta) || next < 0 || (delta > 0 && next > MAX_OPERATIONAL_BALANCE)) return false;
    obj.setScore(playerOrName, next);
    return (obj.getScore(playerOrName) ?? -1) === next;
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return false;
  }
}

function getBountyEarnings(player) {
  const day = Math.floor(Date.now() / 86400000);
  try {
    const parsed = JSON.parse(String(globalThis.__sqlite_get_prop_v2__("clans_addon", player, BOUNTY_EARNINGS_PROPERTY) || "{}"));
    if (Number(parsed.day) !== day) return { day, earned: 0 };
    return { day, earned: Math.max(0, Math.floor(Number(parsed.earned) || 0)) };
  } catch (e) {
    return { day, earned: BOUNTY_DAILY_EARNINGS_LIMIT };
  }
}

function getEmissionBudget(player) {
  const day = Math.floor(Date.now() / 86400000);
  try {
    const dayObjective = world.scoreboard.getObjective("emission_day") || world.scoreboard.addObjective("emission_day", "Emission Day");
    const earnedObjective = world.scoreboard.getObjective("emission_earned") || world.scoreboard.addObjective("emission_earned", "Emission Earned");
    const storedDay = Number(dayObjective.getScore(player) ?? -1);
    if (storedDay !== day) {
      if (storedDay !== -1) return { day, earned: 0 };
      const raw = globalThis.__sqlite_get_prop_v2__("clans_addon", player, "economy_emission_budget_v1");
      if (!raw) return { day, earned: 0 };
      const legacy = JSON.parse(String(raw));
      const legacyEarned = Number(legacy?.earned);
      if (Number(legacy?.day) !== day || !Number.isSafeInteger(legacyEarned) || legacyEarned < 0 || legacyEarned > ECONOMY_DAILY_EMISSION_LIMIT) return null;
      dayObjective.setScore(player, day);
      earnedObjective.setScore(player, legacyEarned);
      return { day, earned: legacyEarned };
    }
    const earned = Number(earnedObjective.getScore(player) ?? 0);
    if (!Number.isSafeInteger(earned) || earned < 0 || earned > ECONOMY_DAILY_EMISSION_LIMIT) return null;
    return { day, earned };
  } catch (e) {
    ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "getEmissionBudget", category: "runtime" });
    return null;
  }
}

function saveEmissionBudget(player, state) {
  try {
    const dayObjective = world.scoreboard.getObjective("emission_day") || world.scoreboard.addObjective("emission_day", "Emission Day");
    const earnedObjective = world.scoreboard.getObjective("emission_earned") || world.scoreboard.addObjective("emission_earned", "Emission Earned");
    dayObjective.setScore(player, Math.floor(Number(state.day) || 0));
    earnedObjective.setScore(player, Math.max(0, Math.floor(Number(state.earned) || 0)));
    return true;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "saveEmissionBudget", category: "runtime" });
    return false;
  }
}

function reserveEmission(player, amount, reason) {
  const delta = Math.floor(Number(amount) || 0);
  const previous = getEmissionBudget(player);
  if (!previous || delta <= 0 || previous.earned + delta > ECONOMY_DAILY_EMISSION_LIMIT) {
    console.warn(`[ECONOMY_TX] REJECT player=${player?.name || "unknown"} delta=${delta} reason=${reason} cause=emission_budget`);
    return null;
  }
  const reserved = { day: previous.day, earned: previous.earned + delta };
  if (!saveEmissionBudget(player, reserved)) {
    saveEmissionBudget(player, previous);
    console.warn(`[ECONOMY_TX] REJECT player=${player?.name || "unknown"} delta=${delta} reason=${reason} cause=emission_persistence`);
    return null;
  }
  return { previous, reserved, delta, reason };
}

function rollbackEmission(player, reservation) {
  const current = getEmissionBudget(player);
  if (!current || current.day !== reservation.reserved.day || current.earned !== reservation.reserved.earned || !saveEmissionBudget(player, reservation.previous)) {
    console.warn(`[ECONOMY_CRITICAL] emission_rollback_failed player=${player?.name || "unknown"} delta=${reservation.delta} reason=${reservation.reason}`);
    return false;
  }
  return true;
}

function commitEmission(player, reservation) {
  console.warn(`[ECONOMY_TX] COMMIT player=${player?.name || "unknown"} delta=${reservation.delta} reason=${reservation.reason} emission_today=${reservation.reserved.earned} emission_limit=${ECONOMY_DAILY_EMISSION_LIMIT}`);
}

function payBountyReward(player, requestedReward) {
  if (!BOUNTY_ENABLED) return false;
  const reward = Math.max(1, Math.min(BOUNTY_MAX_REWARD, Math.floor(Number(requestedReward) || BOUNTY_DEFAULT_REWARD)));
  const earnings = getBountyEarnings(player);
  if (earnings.earned + reward > BOUNTY_DAILY_EARNINGS_LIMIT) return false;
  const reserved = { day: earnings.day, earned: earnings.earned + reward };
  try {
    globalThis.__sqlite_set_prop_v2__("clans_addon", player, BOUNTY_EARNINGS_PROPERTY, JSON.stringify(reserved));
  } catch (e) {
    return false;
  }
  const emissionReservation = reserveEmission(player, reward, "clan_bounty");
  if (!emissionReservation) {
    try { globalThis.__sqlite_set_prop_v2__("clans_addon", player, BOUNTY_EARNINGS_PROPERTY, JSON.stringify(earnings)); } catch (e) {}
    return false;
  }
  if (addBalance(player, reward)) {
    commitEmission(player, emissionReservation);
    return true;
  }
  rollbackEmission(player, emissionReservation);
  try { globalThis.__sqlite_set_prop_v2__("clans_addon", player, BOUNTY_EARNINGS_PROPERTY, JSON.stringify(earnings)); } catch (e) {}
  return false;
}

function loadBountyState() {
  try {
    return loadCachedJson(BOUNTY_STATE_KEY, {});
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return {};
  }
}

function saveBountyState(state) {
  try {
    saveCachedJson(BOUNTY_STATE_KEY, state || {});
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
}

function saveBountyColiseumSession(session) {
  try {
    saveCachedJson(BOUNTY_COLISEUM_SESSION_KEY, session, "");
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
}

function loadBountyColiseumSession() {
  try {
    return loadCachedJson(BOUNTY_COLISEUM_SESSION_KEY, null);
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return null;
  }
}

function loadDisabledBountyRecovery() {
  try {
    return loadCachedJson(BOUNTY_DISABLED_RECOVERY_KEY, null);
  } catch (e) {
    ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "loadDisabledBountyRecovery", category: "runtime" });
    return null;
  }
}

function saveDisabledBountyRecovery(session) {
  try {
    saveCachedJson(BOUNTY_DISABLED_RECOVERY_KEY, session, "");
  } catch (e) {
    ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "saveDisabledBountyRecovery", category: "runtime" });
  }
}

function loadProtectionZones() {
  try {
    return loadCachedJson("protecciones_db", []);
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return [];
  }
}

function isValidColiseumZone(zone) {
  return Boolean(
    zone &&
    zone.zoneType === "coliseum" &&
    zone.dimension &&
    zone.min &&
    zone.max &&
    Number.isFinite(Number(zone.min.x)) &&
    Number.isFinite(Number(zone.min.y)) &&
    Number.isFinite(Number(zone.min.z)) &&
    Number.isFinite(Number(zone.max.x)) &&
    Number.isFinite(Number(zone.max.y)) &&
    Number.isFinite(Number(zone.max.z))
  );
}

function getFirstColiseumZone() {
  const coliseums = loadProtectionZones()
    .filter(isValidColiseumZone)
    .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));
  if (coliseums.length === 0) return null;
  try {
    const activeColiseumId = String(globalThis.__sqlite_get_prop_v2__("clans_addon", "world", ACTIVE_COLISEUM_KEY) || "").trim();
    if (activeColiseumId) {
      const activeZone = coliseums.find((zone) => String(zone.id) === activeColiseumId);
      if (activeZone && hasConfiguredColiseumSpawns(activeZone)) return activeZone;
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  return coliseums.find(hasConfiguredColiseumSpawns) || coliseums[0];
}

function isInsideZone(pos, dimId, zone, margin = 2.0) {
  if (!zone || dimId !== zone.dimension) return false;
  return (
    pos.x >= (zone.min.x - margin) && pos.x <= (zone.max.x + margin) &&
    pos.y >= (zone.min.y - margin) && pos.y <= (zone.max.y + margin) &&
    pos.z >= (zone.min.z - margin) && pos.z <= (zone.max.z + margin)
  );
}

function getColiseumSpawnPositions(zone) {
  if (zone?.spawn1 && zone?.spawn2) {
    return {
      target: { x: zone.spawn1.x, y: zone.spawn1.y, z: zone.spawn1.z },
      hunter: { x: zone.spawn2.x, y: zone.spawn2.y, z: zone.spawn2.z }
    };
  }

  const centerX = Math.floor((zone.min.x + zone.max.x) / 2);
  const centerY = Math.min(zone.max.y, zone.min.y + 1);
  const centerZ = Math.floor((zone.min.z + zone.max.z) / 2);
  const offset = Math.max(2, Math.floor((zone.max.x - zone.min.x) / 4));
  return {
    target: { x: centerX - offset, y: centerY, z: centerZ },
    hunter: { x: centerX + offset, y: centerY, z: centerZ }
  };
}

function hasConfiguredColiseumSpawns(zone) {
  return Boolean(
    zone?.spawn1 &&
    zone?.spawn2 &&
    Number.isFinite(Number(zone.spawn1.x)) &&
    Number.isFinite(Number(zone.spawn1.y)) &&
    Number.isFinite(Number(zone.spawn1.z)) &&
    Number.isFinite(Number(zone.spawn2.x)) &&
    Number.isFinite(Number(zone.spawn2.y)) &&
    Number.isFinite(Number(zone.spawn2.z))
  );
}

function startBountyCombatWarmup(playerName) {
  if (!BOUNTY_ENABLED) return;
  if (!playerName) return;
  bountyCombatWarmups.set(String(playerName).toLowerCase(), Date.now() + BOUNTY_COLISEUM_START_DELAY_MS);
  const player = world.getAllPlayers().find((candidate) => candidate.name === playerName);
  if (player) {
    try {
      player.sendMessage("§b§l[§3Caza§b§l]§r §eTienes 10 segundos de preparación antes de que el combate quede habilitado.");
    } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }
}

function isBountyWarmupActive(playerName) {
  if (!BOUNTY_ENABLED) return false;
  const key = String(playerName || "").toLowerCase();
  if (!key) return false;
  const expiresAt = Number(bountyCombatWarmups.get(key) || 0);
  if (expiresAt <= 0) return false;
  if (Date.now() >= expiresAt) {
    bountyCombatWarmups.delete(key);
    return false;
  }
  return true;
}

function grantTemporaryTeleportExemption(player, durationTicks = BOUNTY_TELEPORT_EXEMPT_TICKS) {
  if (!player) return;
  try {
    player.addTag(BOUNTY_TELEPORT_EXEMPT_TAG);
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  system.runTimeout(() => {
    try {
      player.removeTag(BOUNTY_TELEPORT_EXEMPT_TAG);
    } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }, durationTicks);
}

function escapeCommandArg(value) {
  return String(value || "").replace(/"/g, '\\"');
}

function getDamageSourcePlayer(damageSource) {
  const direct = damageSource?.damagingEntity;
  if (direct?.typeId === "minecraft:player") return direct;
  try {
    const projectile = damageSource?.damagingProjectile || direct;
    const owner = projectile?.getComponent?.("minecraft:projectile")?.owner;
    return owner?.typeId === "minecraft:player" ? owner : undefined;
  } catch (error) {
    return undefined;
  }
}

function getDimensionSafe(dimensionId) {
  if (!dimensionId) return world.getDimension("overworld");
  if (typeof dimensionId !== "string") {
    if (dimensionId.id) return dimensionId;
    dimensionId = String(dimensionId);
  }
  const cleanId = dimensionId.replace(/^minecraft:/, "");
  try {
    return world.getDimension(dimensionId);
  } catch (e1) {
    try {
      return world.getDimension(cleanId);
    } catch (e2) {
      try {
        return world.getDimension("minecraft:" + cleanId);
      } catch (e3) {
        return world.getDimension("overworld");
      }
    }
  }
}

function isSameDimension(dim1, dim2) {
  if (!dim1 || !dim2) return false;
  return String(dim1).replace(/^minecraft:/, "") === String(dim2).replace(/^minecraft:/, "");
}

function runTeleportFallback(player, destination, dimensionId) {
  if (!player || !destination || !dimensionId) return;
  const escapedName = escapeCommandArg(player.name);
  const x = Number(destination.x) || 0;
  const y = Number(destination.y) || 0;
  const z = Number(destination.z) || 0;
  const dimName = String(dimensionId).replace("minecraft:", "");

  try {
    player.runCommand(`execute as @s in ${dimName} run tp @s ${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`);
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
}

function getSafeTeleportPosition(dimension, destination) {
  const baseX = Math.floor(Number(destination?.x) || 0);
  const baseY = Math.floor(Number(destination?.y) || 0);
  const baseZ = Math.floor(Number(destination?.z) || 0);

  const candidates = [
    { x: baseX, y: baseY, z: baseZ },
    { x: baseX, y: baseY + 1, z: baseZ },
    { x: baseX, y: baseY + 2, z: baseZ },
    { x: baseX + 1, y: baseY, z: baseZ },
    { x: baseX - 1, y: baseY, z: baseZ },
    { x: baseX, y: baseY, z: baseZ + 1 },
    { x: baseX, y: baseY, z: baseZ - 1 },
  ];

  for (const candidate of candidates) {
    try {
      const feetBlock = dimension.getBlock(candidate);
      const headBlock = dimension.getBlock({ x: candidate.x, y: candidate.y + 1, z: candidate.z });
      const floorBlock = dimension.getBlock({ x: candidate.x, y: candidate.y - 1, z: candidate.z });
      const hasSpace = (!feetBlock || feetBlock.isAir) && (!headBlock || headBlock.isAir);
      const hasFloor = floorBlock && !floorBlock.isAir;
      if (hasSpace && hasFloor) {
        return { x: candidate.x + 0.5, y: candidate.y, z: candidate.z + 0.5 };
      }
    } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }

  return {
    x: (Number(destination?.x) || 0) + 0.5,
    y: Number(destination?.y) || 0,
    z: (Number(destination?.z) || 0) + 0.5,
  };
}

function queueBountyTargetTeleport(session, attempt = 0) {
  if (!BOUNTY_ENABLED) return;
  if (!session?.targetName || !session?.zone || !session?.targetSpawn) return;

  system.runTimeout(() => {
    try {
      if (!BOUNTY_ENABLED) return;
      if (!activeBountyColiseumSession || activeBountyColiseumSession.targetName !== session.targetName) return;

      const targetPlayer = world.getAllPlayers().find((candidate) => candidate.name === session.targetName);
      if (!targetPlayer) return;

      if (isInsideZone(targetPlayer.location, targetPlayer.dimension.id, session.zone)) {
        startBountyCombatWarmup(targetPlayer.name);
        targetPlayer.sendMessage(`§b§l[§3Caza§b§l]§r §eHas sido trasladado (o ya estabas) al coliseo §c${session.zoneName}§e para la caza recompensas. No puedes salir hasta que termine.`);
        return;
      }

      const targetDimensionId = session?.zone?.spawn1?.dimension || session.zone.dimension;
      const dimension = world.getDimension(targetDimensionId);
      const safeTargetSpawn = getSafeTeleportPosition(dimension, session.targetSpawn);
      grantTemporaryTeleportExemption(targetPlayer);
      try { targetPlayer.teleport(safeTargetSpawn, { dimension }); } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

      let safeHunterSpawn = null;
      const hunterPlayer = session.hunterName ? world.getAllPlayers().find(c => c.name === session.hunterName) : null;
      if (hunterPlayer && session.hunterSpawn) {
        safeHunterSpawn = getSafeTeleportPosition(dimension, session.hunterSpawn);
        grantTemporaryTeleportExemption(hunterPlayer);
        try { hunterPlayer.teleport(safeHunterSpawn, { dimension }); } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
      }

      system.runTimeout(() => {
        try {
          const refreshedTarget = world.getAllPlayers().find((candidate) => candidate.name === session.targetName);
          if (refreshedTarget && !isInsideZone(refreshedTarget.location, refreshedTarget.dimension.id, session.zone)) {
            grantTemporaryTeleportExemption(refreshedTarget);
            runTeleportFallback(refreshedTarget, safeTargetSpawn, targetDimensionId);
          }

          if (hunterPlayer && safeHunterSpawn) {
            const refreshedHunter = world.getAllPlayers().find(c => c.name === session.hunterName);
            if (refreshedHunter && !isInsideZone(refreshedHunter.location, refreshedHunter.dimension.id, session.zone)) {
              grantTemporaryTeleportExemption(refreshedHunter);
              runTeleportFallback(refreshedHunter, safeHunterSpawn, targetDimensionId);
            }
          }

          const confirmedTarget = world.getAllPlayers().find((candidate) => candidate.name === session.targetName);
          if (!confirmedTarget) return;

          if (isInsideZone(confirmedTarget.location, confirmedTarget.dimension.id, session.zone)) {
            startBountyCombatWarmup(confirmedTarget.name);
            confirmedTarget.sendMessage(`§b§l[§3Caza§b§l]§r §eHas sido trasladado al coliseo §c${session.zoneName}§e para la caza recompensas. No puedes salir hasta que termine.`);
            return;
          }

          if (attempt + 1 < BOUNTY_COLISEUM_TELEPORT_MAX_ATTEMPTS) {
            queueBountyTargetTeleport(session, attempt + 1);
            return;
          }

          console.warn(`[Clans Addon] Fallo persistente enviando al objetivo ${session.targetName} al coliseo ${session.zoneName}.`);
          try {
            confirmedTarget.sendMessage("§b§l[§3Caza§b§l]§r §cNo se pudo completar tu traslado al coliseo. Un administrador debe revisar la configuracion del coliseo.");
          } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
        } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
      }, 2);
    } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      if (attempt + 1 < BOUNTY_COLISEUM_TELEPORT_MAX_ATTEMPTS) {
        queueBountyTargetTeleport(session, attempt + 1);
      }
    }
  }, attempt === 0 ? 1 : BOUNTY_COLISEUM_TELEPORT_RETRY_TICKS);
}

function saveBountyTargetReturnLocation(player) {
  return {
    x: player.location.x,
    y: player.location.y,
    z: player.location.z,
    dimension: player.dimension.id
  };
}

function teleportPlayerToSavedLocation(player, savedLocation) {
  if (!player || !savedLocation) return;
  try {
    const dimension = getDimensionSafe(savedLocation.dimension);
    grantTemporaryTeleportExemption(player);
    player.teleport({ x: savedLocation.x, y: savedLocation.y, z: savedLocation.z }, { dimension });
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    runTeleportFallback(player, savedLocation, savedLocation.dimension);
  }
  system.runTimeout(() => {
    try {
      if (!isSameDimension(player.dimension?.id, savedLocation.dimension) || Math.abs(player.location.x - savedLocation.x) > 10) {
        runTeleportFallback(player, savedLocation, savedLocation.dimension);
      }
    } catch (err) { ErrorReporter.report(err, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }, 2);
}

function sendBountyTargetToColiseum(targetPlayer, hunterName) {
  if (!BOUNTY_ENABLED) return false;
  const zone = getFirstColiseumZone();
  if (!zone || !targetPlayer) {
    console.warn(`[Clans Addon] No se pudo enviar al objetivo ${targetPlayer?.name || "desconocido"} al coliseo: no existe un coliseo valido.`);
    return false;
  }
  if (!hasConfiguredColiseumSpawns(zone)) {
    console.warn(`[Clans Addon] No se pudo enviar al objetivo ${targetPlayer.name} al coliseo ${zone.name}: faltan s:adminc1 y s:adminc2.`);
    return false;
  }

  const spawn = getColiseumSpawnPositions(zone);
  activeBountyColiseumSession = {
    targetName: targetPlayer.name,
    hunterName: hunterName || null,
    zoneName: zone.name,
    zone,
    returnLocation: saveBountyTargetReturnLocation(targetPlayer),
    targetSpawn: spawn.target,
    hunterSpawn: spawn.hunter
  };
  saveBountyColiseumSession(activeBountyColiseumSession);

  try {
    queueBountyTargetTeleport(activeBountyColiseumSession, 0);
    return true;
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    activeBountyColiseumSession = null;
    saveBountyColiseumSession(null);
    return false;
  }
}

function releaseBountyTargetFromColiseum() {
  const session = activeBountyColiseumSession;
  activeBountyColiseumSession = null;
  saveBountyColiseumSession(null);
  if (session?.targetName) {
    bountyCombatWarmups.delete(String(session.targetName).toLowerCase());
  }
  if (!session) return;

  const target = world.getAllPlayers().find((player) => player.name === session.targetName);
  if (target) {
    teleportPlayerToSavedLocation(target, session.returnLocation);
    try {
      target.sendMessage("§b§l[§3Caza§b§l]§r §aLa caza terminó y has sido devuelto a tu ubicación anterior.");
    } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }
}

function pruneExpiredBountyCooldowns(state) {
  const now = Date.now();
  const cooldowns = typeof state?.cooldowns === "object" && state.cooldowns ? state.cooldowns : {};
  const cleaned = {};

  for (const [playerName, expiresAt] of Object.entries(cooldowns)) {
    const validUntil = Number(expiresAt || 0);
    if (validUntil > now) {
      cleaned[String(playerName).toLowerCase()] = validUntil;
    }
  }

  return cleaned;
}

function clearCurrentBountyTarget() {
  for (const player of world.getAllPlayers()) {
    try {
      if (player.hasTag("bounty_target")) player.removeTag("bounty_target");
      if (player.hasTag("bounty_hunter")) player.removeTag("bounty_hunter");
    } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }
}

function getCurrentBountyTarget() {
  const state = loadBountyState();
  const targetName = String(state.targetName || "");
  if (!targetName) return null;
  return world.getAllPlayers().find((player) => player.name === targetName) || null;
}

function pickRandomBountyTarget(excludedNames = []) {
  if (!BOUNTY_ENABLED) return null;
  const state = loadBountyState();
  const now = Date.now();
  const excluded = new Set(excludedNames.map((name) => String(name).toLowerCase()));
  const cooldowns = pruneExpiredBountyCooldowns(state);
  const candidates = world.getAllPlayers().filter((player) => {
    const lowerName = player.name.toLowerCase();
    if (excluded.has(lowerName)) return false;
    if (isPlayerOp(player)) return false;
    if (state.active && String(state.targetName || "").toLowerCase() === lowerName) return false;
    const cooldownUntil = Number(cooldowns[lowerName] || 0);
    return cooldownUntil <= now;
  });
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function areSameClan(playerA, playerB) {
  if (!playerA || !playerB) return false;
  const clanA = String(getPlayerClan(playerA) || "");
  const clanB = String(getPlayerClan(playerB) || "");
  return Boolean(clanA && clanB && clanA === clanB);
}

function startBounty(targetPlayer, reward = BOUNTY_DEFAULT_REWARD, startedBy = "Sistema") {
  if (!BOUNTY_ENABLED) return false;
  
  const previousState = loadBountyState();
  clearCurrentBountyTarget();
  try {
    targetPlayer.addTag("bounty_target");
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  const cooldowns = pruneExpiredBountyCooldowns(previousState);
  const prevTarget = String(previousState.targetName || "").toLowerCase();
  if (prevTarget && previousState.active) {
    cooldowns[prevTarget] = Date.now() + BOUNTY_TARGET_COOLDOWN_MS;
  }

  const state = {
    active: true,
    targetName: targetPlayer.name,
    reward: Math.max(1, Math.min(BOUNTY_MAX_REWARD, Math.floor(Number(reward) || BOUNTY_DEFAULT_REWARD))),
    startedBy,
    startedAt: Date.now(),
    expiresAt: Date.now() + BOUNTY_DURATION_MS,
    cooldowns
  };
  saveBountyState(state);
  const sentToColiseum = sendBountyTargetToColiseum(targetPlayer, startedBy);
  world.sendMessage(
    sentToColiseum
      ? `§b§l[§3Caza§b§l]§r §eNueva caza recompensas: §c${targetPlayer.name}§r §7vale §a$${state.reward}§7. §8Expira en 5 minutos. §7¡El primero en usar §a/s:caza§7 entrará al coliseo a cazarlo!`
      : `§b§l[§3Caza§b§l]§r §eNueva caza recompensas: §c${targetPlayer.name}§r §7vale §a$${state.reward}§7. §8Expira en 5 minutos. §cNo hay un coliseo activo.`
  );
  return true;
}

function endBounty(reasonMessage = "") {
  const state = loadBountyState();
  const nextState = {
    cooldowns: pruneExpiredBountyCooldowns(state)
  };
  const targetName = String(state.targetName || "").toLowerCase();
  if (targetName) {
    nextState.cooldowns[targetName] = Date.now() + BOUNTY_TARGET_COOLDOWN_MS;
  }
  clearCurrentBountyTarget();
  saveBountyState(nextState);
  releaseBountyTargetFromColiseum();
  if (reasonMessage) {
    world.sendMessage(`§b§l[§3Caza§b§l]§r ${reasonMessage}`);
  }
  return state;
}

function getPlayerClan(player) {
  return globalThis.__sqlite_get_prop_v2__("clans_addon", player, "clan_key") || "";
}

function updateClanTags(player, clanName, clanColor) {
  try {
    for (const tag of player.getTags()) {
      if (tag.startsWith("clan:") || tag.startsWith("clan_color:")) {
        player.removeTag(tag);
      }
    }
    if (clanName) {
      player.addTag("clan:" + clanName);
    }
    if (clanColor) {
      player.addTag("clan_color:" + clanColor);
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn(`Error al actualizar tags de clan para ${player.name}: ${e}`);
  }
}

function setPlayerClan(player, clanKey) {
  globalThis.__sqlite_set_prop_v2__("clans_addon", player, "clan_key", clanKey || "");
  if (clanKey) {
    const db = loadClansData();
    const clan = db[clanKey];
    if (clan) {
      updateClanTags(player, clan.name, clan.color);
    } else {
      updateClanTags(player, "", "");
    }
  } else {
    updateClanTags(player, "", "");
  }
  applyClanNametag(player);
}

const FCX_ADMIN_VISUAL_ROLE_PROPERTY = "fcx_admin:visual_role_v1";
const FCX_ADMIN_VISUAL_LEASE_PROPERTY = "fcx_admin:visual_role_lease_v1";
const FCX_ADMIN_VISUAL_ROLE_TAG_PREFIX = "fcx_admin:badge_role:";
const FCX_ADMIN_VISUAL_LEASE_MAX_AGE_MS = 10000;
const FCX_ADMIN_ROLE_PREFIXES = Object.freeze({
  OWNER: "§4§l[OWNER] §r",
  SECURITY_ADMIN: "§c§l[SECURITY ADMIN] §r",
  MODERATOR: "§2§l[MODERATOR] §r",
  SHERIFF: "§6§l[SHERIFF] §r",
  SUPPORT: "§3§l[SUPPORT] §r",
  ESTELAR: "§b§l[ESTELAR] §r",
  AUDITOR: "§7§l[AUDITOR] §r"
});
const SPECIAL_LABEL_PROPERTY = "ranks:special_label_v1";
const SPECIAL_LABELS = Object.freeze({
  APOYADOR: "§6§l[APOYADOR] §r",
  VIP: "§d§l[VIP] §r",
  DONADOR: "§6§l[DONADOR] §r",
  DONADOR_PLUS: "§g§l[DONADOR+] §r",
  MVP: "§b§l[MVP] §r",
  ELITE: "§5§l[ÉLITE] §r",
  LEYENDA: "§c§l[LEYENDA] §r",
  VETERANO: "§8§l[VETERANO] §r",
  FUNDADOR: "§4§l[FUNDADOR] §r",
  PIONERO: "§3§l[PIONERO] §r",
  CAMPEON: "§e§l[CAMPEÓN] §r",
  CREADOR: "§d§l[CREADOR] §r",
  STREAMER: "§5§l[STREAMER] §r",
  YOUTUBER: "§c§l[YOUTUBER] §r",
  BUILDER: "§2§l[BUILDER] §r",
  COLECCIONISTA: "§6§l[COLECCIONISTA] §r"
});

function getFcxAdminRolePrefix(player) {
  try {
    const lease = Number(globalThis.__sqlite_get_prop_v2__("clans_addon", "world", FCX_ADMIN_VISUAL_LEASE_PROPERTY));
    const age = Date.now() - lease;
    const leaseFresh = Number.isFinite(lease) && age >= 0 && age <= FCX_ADMIN_VISUAL_LEASE_MAX_AGE_MS;
    const taggedRole = player.getTags().find((tag) => tag.startsWith(FCX_ADMIN_VISUAL_ROLE_TAG_PREFIX))?.slice(FCX_ADMIN_VISUAL_ROLE_TAG_PREFIX.length) ?? "";
    const role = leaseFresh ? String(globalThis.__sqlite_get_prop_v2__("clans_addon", player, FCX_ADMIN_VISUAL_ROLE_PROPERTY) ?? "") : taggedRole;
    return FCX_ADMIN_ROLE_PREFIXES[role] ?? "";
  } catch {
    return "";
  }
}

function getSpecialLabelPrefix(player) {
  try {
    const label = String(globalThis.__sqlite_get_prop_v2__("clans_addon", player, SPECIAL_LABEL_PROPERTY) ?? "");
    const equippedTitle = String(globalThis.__sqlite_get_prop_v2__("clans_addon", player, "equipped_title") ?? "").toUpperCase();
    if (label === "VIP" && equippedTitle === "VIP") return "";
    return SPECIAL_LABELS[label] ?? "";
  } catch {
    return "";
  }
}

function applyClanNametag(player) {
  try {
    const clanKey = globalThis.__sqlite_get_prop_v2__("clans_addon", player, "clan_key");
    const healthComp = player.getComponent("minecraft:health");
    let heartBar = "";
    if (healthComp) {
      const current = healthComp.currentValue;
      const max = healthComp.effectiveMax;
      let heartColor = "§c";
      if (current / max > 0.6) heartColor = "§a";
      else if (current / max > 0.25) heartColor = "§e";
      heartBar = `\n${heartColor}❤ §7${Math.round(current)}/${Math.round(max)}`;
    }

    let rolePrefix = getFcxAdminRolePrefix(player);
    const specialLabelPrefix = getSpecialLabelPrefix(player);
    let badgePrefix = "";
    for (const tag of player.getTags()) {
      if (tag.startsWith("badge:")) {
        const bName = tag.substring(6);
        let bColor = "§e";
        for (const t of player.getTags()) {
          if (t.startsWith("badge_color:")) {
             const c = t.substring(12);
             const colors = { "white": "§f", "red": "§c", "blue": "§b", "green": "§a", "yellow": "§e", "purple": "§d", "orange": "§6", "gray": "§7", "black": "§0", "gold": "§g", "aqua": "§b", "light_purple": "§d" };
             bColor = colors[c] || "§e";
          }
        }
        badgePrefix = `${bColor}[${bName}] §r`;
      }
    }

    if (!clanKey) {
      player.nameTag = `${rolePrefix}${specialLabelPrefix}${badgePrefix}${player.name}${heartBar}`;
      updateClanTags(player, "", "");
      return;
    }
    const db = loadClansData();
    const clan = db[clanKey];
    if (!clan) {
      player.nameTag = `${rolePrefix}${specialLabelPrefix}${badgePrefix}${player.name}${heartBar}`;
      globalThis.__sqlite_set_prop_v2__("clans_addon", player, "clan_key", "");
      updateClanTags(player, "", "");
      return;
    }
    const colorCode = BEDROCK_COLOR_CODES[clan.color] || "§6";
    player.nameTag = `${rolePrefix}${specialLabelPrefix}${badgePrefix}${colorCode}[${clan.name}] §r${player.name}${heartBar}`;
    updateClanTags(player, clan.name, clan.color);
  } catch (error) { ErrorReporter.report(error, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn(`Error aplicando nametag a ${player.name}: ${error}`);
  }
}

// Reconciliación al unirse/aparecer (resuelve expulsión/disolución offline)
function reconcilePlayer(player) {
  const clanKey = globalThis.__sqlite_get_prop_v2__("clans_addon", player, "clan_key");
  if (clanKey) {
    const db = loadClansData();
    const clan = db[clanKey];
    if (!clan || !clan.members.includes(player.name)) {
      // Fuimos expulsados o el clan se disolvió mientras estábamos desconectados
      globalThis.__sqlite_set_prop_v2__("clans_addon", player, "clan_key", "");
      applyClanNametag(player);
      updateClanTags(player, "", "");
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cYa no perteneces a tu clan anterior (fuiste expulsado o el clan se disolvió).");
    } else {
      applyClanNametag(player);
      updateClanTags(player, clan.name, clan.color);
    }
  } else {
    applyClanNametag(player);
    updateClanTags(player, "", "");
  }
}

world.afterEvents.playerSpawn.subscribe((event) => {
  const player = event.player;
  if (player) {
    try {
      reconcilePlayer(player);
    } catch (e) {
      ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "reconcilePlayerOnSpawn", category: "runtime" });
    }
  }
  if (!BOUNTY_ENABLED) {
    try {
      if (player?.hasTag("bounty_target")) player.removeTag("bounty_target");
      if (player?.hasTag("bounty_hunter")) player.removeTag("bounty_hunter");
    } catch (e) {
      ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "clearDisabledBountyTagsOnSpawn", category: "runtime" });
    }

    const recovery = loadDisabledBountyRecovery();
    if (player && recovery?.targetName === player.name && recovery?.returnLocation) {
      teleportPlayerToSavedLocation(player, recovery.returnLocation);
      saveDisabledBountyRecovery(null);
      player.sendMessage("§b§l[§3Caza§b§l]§r §aEl sistema está desactivado y fuiste devuelto a tu ubicación anterior.");
    }
    return;
  }
  // Aislamiento temporal del flujo de spawn mientras se diagnostica la carga infinita.
  return;
});

function registerCustomCommands() {
  const startupSignal = system?.beforeEvents?.startup;
  if (!startupSignal || typeof startupSignal.subscribe !== "function") return;

  startupSignal.subscribe((event) => {
    const registry = event?.customCommandRegistry;
    const register = typeof registry?.registerCommand === "function"
      ? registry.registerCommand.bind(registry)
      : typeof registry?.register === "function"
        ? registry.register.bind(registry)
        : undefined;
    if (!register) return;

    try {
      register({
        name: `${COMMAND_NAMESPACE}:c`,
        description: "Envia mensaje al chat del clan",
        permissionLevel: CommandPermissionLevel.Any,
        mandatoryParameters: [{ name: "mensaje", type: CustomCommandParamType.String }],
      }, (origin, mensaje) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        system.run(async () => {
          await handleClanCommand(sender, "c", ["c", String(mensaje)]);
        });
        return commandOk("Procesando chat de clan.");
      });

      register({
        name: `${COMMAND_NAMESPACE}:clan`,
        description: "Gestiona clanes",
        permissionLevel: CommandPermissionLevel.Any,
        optionalParameters: [
          { name: "subcomando", type: CustomCommandParamType.String },
          { name: "arg1", type: CustomCommandParamType.String },
          { name: "arg2", type: CustomCommandParamType.String },
          { name: "arg3", type: CustomCommandParamType.String },
        ],
      }, (origin, subcomando, arg1, arg2, arg3) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        const args = ["clan"];
        for (const value of [subcomando, arg1, arg2, arg3]) {
          if (value !== undefined && value !== null && String(value).trim()) {
            args.push(String(value));
          }
        }
        system.run(async () => {
          await handleClanCommand(sender, "clan", args);
        });
        return commandOk("Procesando comando de clan.");
      });

      if (BOUNTY_ENABLED) {
        register({
          name: `${COMMAND_NAMESPACE}:caza`,
          description: "Entra al coliseo para cazar al objetivo",
          permissionLevel: CommandPermissionLevel.Any,
        }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          system.run(() => {
            handleCazaCommand(sender);
          });
          return commandOk("Procesando comando de caza.");
        });
      }
    } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Clans Addon] Error registrando custom commands: " + e);
    }
  });
}

registerCustomCommands();

// Comandos administrativos por chat: se usan sin '/' para que puedan activarse con reload.
const adminClanChat = world.beforeEvents?.chatSend || world.beforeEvents?.chat;
if (adminClanChat?.subscribe) adminClanChat.subscribe((event) => {
  const raw = String(event.message ?? "").trim();
  const normalized = raw.toLowerCase();
  if (normalized === "s:adminclanes" || normalized.startsWith("s:adminclandisolver ") || normalized === "s:adminclanconfirmar") {
    if (event.cancel !== undefined) event.cancel = true;
    if (!isPlayerOp(event.sender)) {
      system.run(() => event.sender.sendMessage("§c[Clanes] No tienes permisos administrativos."));
      return;
    }
    if (normalized === "s:adminclanes") {
      system.run(() => openAdminClansMenu(event.sender));
      return;
    }
    if (normalized.startsWith("s:adminclandisolver ")) {
      const wanted = raw.slice("s:adminclandisolver".length).trim().replace(/^"|"$/g, "").toLowerCase();
      system.run(() => {
        const entry = Object.entries(loadClansData()).find(([key, clan]) => key.toLowerCase() === wanted || String(clan?.name ?? "").toLowerCase() === wanted);
        if (!entry) return event.sender.sendMessage("§c[Clanes] Clan no encontrado.");
        openAdminClanConfirm(event.sender, entry[0]);
      });
      return;
    }
    if (normalized === "s:adminclanconfirmar") {
      system.run(() => {
        const pending = pendingAdminClanDissolutions.get(String(event.sender.id));
        pendingAdminClanDissolutions.delete(String(event.sender.id));
        if (!pending || pending.expiresAt < Date.now()) return event.sender.sendMessage("§c[Clanes] No hay una disolución pendiente o la confirmación expiró.");
        adminDissolveClan(event.sender, pending.key);
      });
      return;
    }
  }
});

// Manejador alternativo por /scriptevent
try {
  if (system && system.afterEvents && system.afterEvents.scriptEventReceive && typeof system.afterEvents.scriptEventReceive.subscribe === "function") {
    system.afterEvents.scriptEventReceive.subscribe((event) => {
      if (event.id !== "cmd") return;
      const message = String(event.message || "").trim();
      if (!message) return;
      const args = message.split(/\s+/);
      const command = args[0].toLowerCase();
      
      if (command !== "clan" && command !== "c" && command !== "caza") return;
      if (command === "caza" && !BOUNTY_ENABLED) return;
      const sender = event.sourceEntity;
      if (!sender || sender.typeId !== "minecraft:player") return;
      
      system.run(async () => {
        try {
          if (command === "caza") {
            handleCazaCommand(sender);
          } else {
            await handleClanCommand(sender, command, [command, ...args.slice(1)]);
          }
        } catch (err) { ErrorReporter.report(err, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
          console.warn(`Error ejecutando scriptevent de clan: ${err}`);
        }
      });
    });
  }
} catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Clans Addon] ScriptEvent listener error: " + e);
}

function handleCazaCommand(player) {
  if (!BOUNTY_ENABLED) {
    player.sendMessage("§b§l[§3Clanes§b§l]§r §eEl cazarecompensas no forma parte del modo comunitario actual.");
    return;
  }
  
  const state = loadBountyState();
  if (!state.active) {
    player.sendMessage("§b§l[§3Caza§b§l]§r §cNo hay ninguna caza recompensas activa.");
    return;
  }
  
  if (player.name === state.targetName) {
    player.sendMessage("§b§l[§3Caza§b§l]§r §cEres el objetivo, no puedes ser cazador.");
    return;
  }

  if (state.hunterName && state.hunterName !== player.name) {
    player.sendMessage(`§b§l[§3Caza§b§l]§r §cAlguien más rápido ya aceptó esta caza: §e${state.hunterName}§c.`);
    return;
  }

  const session = loadBountyColiseumSession();

  if (!session || !session.zone || !session.hunterSpawn) {
    player.sendMessage("§b§l[§3Caza§b§l]§r §cEl objetivo no está en un coliseo válido.");
    return;
  }

  // Asegurar que el estado y la sesión tengan el cazador registrado
  let updatedSession = false;
  if (!state.hunterName) {
    state.hunterName = player.name;
    saveBountyState(state);
    world.sendMessage(`§b§l[§3Caza§b§l]§r §e¡El jugador §c${player.name}§e ha entrado al coliseo a cazar a §c${state.targetName}§e!`);
  }
  
  if (session.hunterName !== player.name) {
    session.hunterName = player.name;
    saveBountyColiseumSession(session);
    updatedSession = true;
  }
  
  if (updatedSession) {
    activeBountyColiseumSession = session;
  }
  try { player.addTag("bounty_hunter"); } catch (e) {}

  try {
    const dimension = world.getDimension(session.zone.spawn1?.dimension || session.zone.dimension);
    const hSpawn = session.hunterSpawn;
    grantTemporaryTeleportExemption(player);
    player.teleport({ x: hSpawn.x, y: hSpawn.y, z: hSpawn.z }, { dimension });
    player.sendMessage(`§b§l[§3Caza§b§l]§r §a¡Has entrado al coliseo! Tu objetivo es §c${state.targetName}§a.`);
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    player.sendMessage(`§b§l[§3Caza§b§l]§r §cError al teletransportarte: ${e.message}`);
  }
}

const QUEST_TEMPLATES = [
  { id: "mine_iron", description: "Minar 200 menas de Hierro", target: 200, reward: 5000 },
  { id: "mine_coal", description: "Minar 500 menas de Carbón", target: 500, reward: 3000 },
  { id: "mine_diamond", description: "Minar 30 menas de Diamante", target: 30, reward: 8000 },
  { id: "mine_gold", description: "Minar 100 menas de Oro", target: 100, reward: 4500 },
  { id: "mine_redstone", description: "Minar 150 menas de Redstone", target: 150, reward: 3500 },
  { id: "mine_copper", description: "Minar 300 menas de Cobre", target: 300, reward: 3500 },
  { id: "mine_lapis", description: "Minar 150 menas de Lapislázuli", target: 150, reward: 4000 },
  { id: "mine_quartz", description: "Minar 400 menas de Cuarzo del Nether", target: 400, reward: 4500 },
  { id: "mine_debris", description: "Minar 10 escombros ancestrales (Ancient Debris)", target: 10, reward: 12000 },
  { id: "mine_emerald", description: "Minar 25 menas de Esmeralda", target: 25, reward: 7000 },
  { id: "chop_wood", description: "Talar 400 troncos de Madera", target: 400, reward: 3000 },
  { id: "mine_obsidian", description: "Picar 80 bloques de Obsidiana", target: 80, reward: 5000 },
  { id: "mine_glowstone", description: "Picar 100 bloques de Piedra Luminosa", target: 100, reward: 3500 },
  { id: "kill_zombies", description: "Eliminar 150 Zombis", target: 150, reward: 4000 },
  { id: "kill_skeletons", description: "Eliminar 150 Esqueletos", target: 150, reward: 4000 },
  { id: "kill_creepers", description: "Eliminar 80 Creepers", target: 80, reward: 5000 },
  { id: "kill_endermen", description: "Eliminar 30 Endermans", target: 30, reward: 6000 },
  { id: "kill_spiders", description: "Eliminar 120 Arañas", target: 120, reward: 3500 },
  { id: "kill_witches", description: "Eliminar 20 Brujas", target: 20, reward: 6000 },
  { id: "kill_blazes", description: "Eliminar 50 Blazes", target: 50, reward: 5500 },
  { id: "kill_ghasts", description: "Eliminar 10 Ghasts", target: 10, reward: 7000 },
  { id: "kill_slimes", description: "Eliminar 60 Slimes", target: 60, reward: 4500 },
  { id: "kill_phantoms", description: "Eliminar 30 Phantoms", target: 30, reward: 5500 },
  { id: "kill_piglins", description: "Eliminar 100 Piglins o variantes", target: 100, reward: 5000 },
  { id: "kill_magmacubes", description: "Eliminar 50 Cubos de Magma", target: 50, reward: 4000 }
];

function assignRandomClanQuest(clan) {
  const template = QUEST_TEMPLATES[Math.floor(Math.random() * QUEST_TEMPLATES.length)];
  clan.quest = {
    id: template.id,
    description: template.description,
    progress: 0,
    target: template.target,
    reward: template.reward,
    active: true
  };
}

function announceClanQuestProgress(clan, progress, target) {
  const percent = Math.floor((progress / target) * 100);
  const oldPercent = Math.floor(((progress - 1) / target) * 100);
  
  // Anunciar en hitos de 25%, 50%, 75%, 90% o en los últimos 5 bloques/enemigos
  const isMilestone = (percent !== oldPercent && (percent === 25 || percent === 50 || percent === 75 || percent === 90)) || (target - progress <= 5);
  
  if (isMilestone) {
    const msg = `§b§l[§3Clanes§b§l]§r §a¡Progreso cooperativo! Misión: §e"${clan.quest.description}"§a progresando §e${progress}/${target} §7(${percent}%)§a.`;
    const membersLower = clan.members.map(m => m.toLowerCase());
    world.getAllPlayers().forEach(p => {
      if (p.isValid && membersLower.includes(p.name.toLowerCase())) {
        p.sendMessage(msg);
      }
    });
  }
}

function completeClanQuest(clanKey, clan) {
  const reward = clan.quest.reward;
  clan.balance = (clan.balance ?? 0) + reward;
  
  const msg = `§b§l[§3Clanes§b§l]§r §a¡Misión cooperativa completada! §e"${clan.quest.description}"§a finalizada. Se han depositado §e$${reward}§a en el banco del clan.`;
  
  // Asignar nueva misión inmediatamente
  assignRandomClanQuest(clan);
  
  const db = loadClansData();
  db[clanKey] = clan;
  saveClansData(db);

  // Enviar mensaje a todos los miembros online
  const membersLower = clan.members.map(m => m.toLowerCase());
  world.getAllPlayers().forEach(p => {
    if (p.isValid && membersLower.includes(p.name.toLowerCase())) {
      p.sendMessage(msg);
    }
  });
}

async function handleClanCommand(player, command, args) {
  const db = loadClansData();
  const playerClanKey = getPlayerClan(player);
  
  if (playerClanKey && db[playerClanKey]) {
    const clan = db[playerClanKey];
    let updated = false;
    if (clan.balance === undefined) {
      clan.balance = 0;
      updated = true;
    }
    if (!clan.quest) {
      assignRandomClanQuest(clan);
      updated = true;
    }
    if (updated) {
      db[playerClanKey] = clan;
      saveClansData(db);
    }
  }
  
  if (command === "c") {
    const chatMsg = args.slice(1).join(" ").trim();
    if (!playerClanKey || !db[playerClanKey]) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cNo perteneces a ningún clan.");
      return;
    }
    if (!chatMsg) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cUso: /s:c <mensaje>");
      return;
    }
    sendClanMessage(player, db[playerClanKey], chatMsg);
    return;
  }
  
  let sub = args[1] ? args[1].toLowerCase() : "ayuda";
  if (sub === 'help') sub = "ayuda";
  if (sub === 'create') sub = "crear";
  if (sub === 'invite') sub = "invitar";
  if (sub === 'join') sub = "unirse";
  if (sub === 'leave') sub = "salir";
  if (sub === 'kick') sub = "expulsar";
  if (sub === 'list') sub = "lista";
  if (sub === 'promote') sub = "promover";
  if (sub === 'disband') sub = "disolver";
  if (sub === 'deposit') sub = "depositar";
  if (sub === 'withdraw') sub = "retirar";
  if (sub === 'quest') sub = "mision";
  if (sub === 'bounty') sub = "caza";

  if (sub === "ayuda") { // if (sub === "help")
    player.sendMessage("§b§l[§3Clanes§b§l]§r §eClanes comunitarios y cooperativos:");
    player.sendMessage("§7/s:clan crear <nombre> §8- Crea un nuevo clan.");
    player.sendMessage("§7/s:clan invitar <jugador> §8- Invita a un jugador a tu clan.");
    player.sendMessage("§7/s:clan unirse <nombre> §8- Acepta invitación y únete.");
    player.sendMessage("§7/s:clan salir §8- Sal del clan actual.");
    player.sendMessage("§7/s:clan expulsar <jugador> §8- Expulsa a un miembro.");
    player.sendMessage("§7/s:clan info [nombre] §8- Muestra información del clan.");
    player.sendMessage("§7/s:clan lista §8- Muestra los clanes del servidor.");
    player.sendMessage("§7/s:clan promover <jugador> §8- Transfiere el liderazgo.");
    player.sendMessage("§7/s:clan disolver §8- Disuelve tu clan.");
    player.sendMessage("§7/s:clan depositar <cantidad> §8- Deposita dinero al banco del clan.");
    player.sendMessage("§7/s:clan retirar <cantidad> §8- Retira dinero del banco (Líder).");
    player.sendMessage("§7/s:clan mision §8- Muestra la misión cooperativa activa.");
    player.sendMessage("§7/s:clan chat <mensaje> §8- Envía mensaje al chat de clan.");
    if (BOUNTY_ENABLED) {
      player.sendMessage("§7/s:clan caza status §8- Muestra la caza activa."); // /s:clan bounty status
      if (isPlayerOp(player)) {
        player.sendMessage("§7/s:clan caza start [jugador] [recompensa] §8- Inicia caza recompensas.");
        player.sendMessage("§7/s:clan caza stop §8- Cancela la caza recompensas.");
      }
    }
    player.sendMessage("§7/s:c <mensaje> §8- Atajo para chat de clan.");
    player.sendMessage("§aEl fuego amigo está desactivado permanentemente entre compañeros de clan.");
    return;
  }
  
  if (sub === "crear") { // if (sub === "create")
    const name = args.slice(2).join(" ").replace(/^["']|["']$/g, "").trim();
    const key = name.toLowerCase().replace(/\s+/g, "_");
    
    if (!name) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cUso: /s:clan create <nombre>");
      return;
    }
    
    const isValidName = /^[A-Za-z0-9 _.-áéíóúÁÉÍÓÚñÑ]{2,20}$/.test(name);
    if (!isValidName) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cNombre de clan inválido. Usa letras, números, guiones o espacios (2-20 caracteres).");
      return;
    }
    
    if (isForbiddenClanName(name)) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cEl nombre de ese clan está prohibido por contener términos reservados o inapropiados.");
      return;
    }
    
    if (playerClanKey) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cYa perteneces a un clan. Debes salir primero.");
      return;
    }
    
    if (db[key]) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cYa existe un clan con ese nombre.");
      return;
    }
    
    // Crear clan
    db[key] = {
      name: name,
      color: CLAN_COLORS[Math.floor(Math.random() * CLAN_COLORS.length)],
      owner: player.name,
      members: [player.name],
      pvpDisabled: true,
      balance: 0
    };
    assignRandomClanQuest(db[key]);
    
    saveClansData(db);
    setPlayerClan(player, key);
    
    world.sendMessage(`§b§l[§3Clanes§b§l]§r §a¡El jugador §b${player.name} §acreó el clan §e${name}§a!`);
    return;
  }
  
  if (sub === "invitar") { // if (sub === "invite")
    const targetName = args.slice(2).join(" ").replace(/^["']|["']$/g, "").trim();
    if (!playerClanKey || !db[playerClanKey]) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cNo perteneces a ningún clan.");
      return;
    }
    const clan = db[playerClanKey];
    if (clan.owner !== player.name) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cSolo el líder del clan puede invitar jugadores.");
      return;
    }
    if (!targetName) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cUso: /s:clan invite <jugador>");
      return;
    }
    
    const target = world.getAllPlayers().find(p => p.name.toLowerCase() === targetName.toLowerCase());
    if (!target) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cJugador no encontrado online.");
      return;
    }
    if (target.name === player.name) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cNo puedes invitarte a ti mismo.");
      return;
    }
    if (getPlayerClan(target)) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cEse jugador ya pertenece a un clan.");
      return;
    }
    
    // Guardar invitación en el jugador destino
    globalThis.__sqlite_set_prop_v2__("clans_addon", target, "clan_invite", playerClanKey);
    
    player.sendMessage(`§b§l[§3Clanes§b§l]§r §aInvitación enviada correctamente a §b${target.name}§a.`);
    target.sendMessage(`§b§l[§3Clanes§b§l]§r §eHas sido invitado a unirte al clan §6${clan.name}§e.\n§7Escribe §a/s:clan join ${clan.name} §7para aceptar la invitación.`);
    return;
  }
  
  if (sub === "unirse") {
    const inputClanName = args.slice(2).join(" ").replace(/^["']|["']$/g, "").trim();
    if (!inputClanName) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cUso: /s:clan join <nombre_del_clan>");
      return;
    }
    
    const inviteKey = globalThis.__sqlite_get_prop_v2__("clans_addon", player, "clan_invite");
    if (!inviteKey || !db[inviteKey]) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cNo tienes invitaciones pendientes de ningún clan.");
      return;
    }
    
    const clan = db[inviteKey];
    if (normalizeClanName(clan.name) !== normalizeClanName(inputClanName)) {
      player.sendMessage(`§b§l[§3Clanes§b§l]§r §cLa invitación pendiente no corresponde al clan §e${inputClanName}§c.`);
      return;
    }
    
    if (playerClanKey) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cYa perteneces a un clan.");
      return;
    }
    
    // Unirse
    clan.members.push(player.name);
    db[inviteKey] = clan;
    saveClansData(db);
    
    setPlayerClan(player, inviteKey);
    globalThis.__sqlite_set_prop_v2__("clans_addon", player, "clan_invite", "");
    
    world.sendMessage(`§b§l[§3Clanes§b§l]§r §e${player.name} §ase unió al clan §e${clan.name}§a.`);
    return;
  }
  
  if (sub === "salir") {
    if (!playerClanKey || !db[playerClanKey]) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cNo perteneces a ningún clan.");
      return;
    }
    const clan = db[playerClanKey];
    if (clan.owner === player.name) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cEres el líder. Debes promover a otro miembro (/s:clan promote) o disolver el clan (/s:clan disband) primero.");
      return;
    }
    
    clan.members = clan.members.filter(m => m !== player.name);
    db[playerClanKey] = clan;
    saveClansData(db);
    
    setPlayerClan(player, "");
    world.sendMessage(`§b§l[§3Clanes§b§l]§r §e${player.name} §csalió del clan §e${clan.name}§c.`);
    return;
  }
  
  if (sub === "expulsar") {
    const targetName = args.slice(2).join(" ").replace(/^["']|["']$/g, "").trim();
    if (!playerClanKey || !db[playerClanKey]) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cNo perteneces a ningún clan.");
      return;
    }
    const clan = db[playerClanKey];
    if (clan.owner !== player.name) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cSolo el líder puede expulsar miembros.");
      return;
    }
    if (!targetName) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cUso: /s:clan kick <jugador>");
      return;
    }
    
    const isMember = clan.members.some(m => m.toLowerCase() === targetName.toLowerCase());
    if (!isMember) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cEse jugador no pertenece a tu clan.");
      return;
    }
    if (player.name.toLowerCase() === targetName.toLowerCase()) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cNo puedes expulsarte a ti mismo. Usa /s:clan leave o /s:clan disband.");
      return;
    }
    
    // Remover
    const resolvedName = clan.members.find(m => m.toLowerCase() === targetName.toLowerCase());
    clan.members = clan.members.filter(m => m.toLowerCase() !== targetName.toLowerCase());
    db[playerClanKey] = clan;
    saveClansData(db);
    
    // Si está online, le quitamos el tag inmediatamente
    const targetPlayer = world.getAllPlayers().find(p => p.name.toLowerCase() === targetName.toLowerCase());
    if (targetPlayer) {
      setPlayerClan(targetPlayer, "");
      targetPlayer.sendMessage(`§b§l[§3Clanes§b§l]§r §cHas sido expulsado del clan §e${clan.name}§c.`);
    }
    
    world.sendMessage(`§b§l[§3Clanes§b§l]§r §e${resolvedName} §cfue expulsado del clan §e${clan.name}§c.`);
    return;
  }
  
  if (sub === "info") {
    let targetClanKey = playerClanKey;
    const searchClanName = args.slice(2).join(" ").trim();
    
    if (searchClanName) {
      // Buscar key del clan por nombre
      const foundKey = Object.keys(db).find(k => db[k].name.toLowerCase() === searchClanName.toLowerCase());
      if (!foundKey) {
        player.sendMessage("§b§l[§3Clanes§b§l]§r §cClan no encontrado.");
        return;
      }
      targetClanKey = foundKey;
    }
    
    if (!targetClanKey || !db[targetClanKey]) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cNo perteneces a ningún clan o no indicaste un nombre válido.");
      return;
    }
    
    const clan = db[targetClanKey];
    const colorCode = BEDROCK_COLOR_CODES[clan.color] || "§6";
    
    player.sendMessage(`§b§l[§3Clanes§b§l]§r ${colorCode}§l${clan.name}§r`);
    player.sendMessage(`§7Líder: §f${clan.owner}`);
    player.sendMessage(`§7Banco: §a$${clan.balance ?? 0}`);
    player.sendMessage(`§7Miembros: §f${clan.members.join(", ")}`);
    player.sendMessage("§7Convivencia: §aPacífica §7(sin fuego amigo entre compañeros)");
    return;
  }
  
  if (sub === "lista") {
    const list = Object.values(db);
    if (list.length === 0) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §7No hay clanes registrados todavía.");
      return;
    }
    
    player.sendMessage("§b§l[§3Clanes§b§l]§r §eLista de clanes:");
    list.forEach(c => {
      const colorCode = BEDROCK_COLOR_CODES[c.color] || "§6";
      player.sendMessage(`§7- ${colorCode}${c.name} §7(Miembros: ${c.members.length})`);
    });
    return;
  }
  
  if (sub === "promover") {
    const targetName = args.slice(2).join(" ").replace(/^["']|["']$/g, "").trim();
    if (!playerClanKey || !db[playerClanKey]) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cNo perteneces a ningún clan.");
      return;
    }
    const clan = db[playerClanKey];
    if (clan.owner !== player.name) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cSolo el líder del clan puede transferir el liderazgo.");
      return;
    }
    if (!targetName) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cUso: /s:clan promote <miembro>");
      return;
    }
    
    const isMember = clan.members.some(m => m.toLowerCase() === targetName.toLowerCase());
    if (!isMember) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cEl jugador debe pertenecer a tu clan.");
      return;
    }
    if (player.name.toLowerCase() === targetName.toLowerCase()) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cYa eres el líder.");
      return;
    }
    
    const resolvedName = clan.members.find(m => m.toLowerCase() === targetName.toLowerCase());
    clan.owner = resolvedName;
    db[playerClanKey] = clan;
    saveClansData(db);
    
    world.sendMessage(`§b§l[§3Clanes§b§l]§r §a¡§b${resolvedName} §aes el nuevo líder del clan §e${clan.name}§a!`);
    return;
  }
  
  if (sub === "disolver") {
    if (!playerClanKey || !db[playerClanKey]) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cNo perteneces a ningún clan.");
      return;
    }
    const clan = db[playerClanKey];
    if (clan.owner !== player.name) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cSolo el líder del clan puede disolverlo.");
      return;
    }
    
    // Quitar tags a todos los miembros online inmediatamente
    world.getAllPlayers().forEach(p => {
      if (getPlayerClan(p) === playerClanKey) {
        setPlayerClan(p, "");
        p.sendMessage(`§b§l[§3Clanes§b§l]§r §cTu clan §e${clan.name} §cha sido disuelto por el líder.`);
      }
    });
    
    delete db[playerClanKey];
    saveClansData(db);
    
    world.sendMessage(`§b§l[§3Clanes§b§l]§r §cEl clan §e${clan.name} §cha sido disuelto.`);
    return;
  }
  
  if (sub === "chat") {
    const chatMsg = args.slice(2).join(" ").trim();
    if (!playerClanKey || !db[playerClanKey]) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cNo perteneces a ningún clan.");
      return;
    }
    if (!chatMsg) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cUso: /s:clan chat <mensaje>");
      return;
    }
    sendClanMessage(player, db[playerClanKey], chatMsg);
    return;
  }

  if (sub === "depositar") {
    const amountArg = args[2];
    const amount = Math.floor(Number(amountArg) || 0);
    if (!playerClanKey || !db[playerClanKey]) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cNo perteneces a ningún clan.");
      return;
    }
    if (!amountArg || isNaN(amount) || amount <= 0) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cUso: /s:clan depositar <cantidad>");
      return;
    }

    const moneyObj = getMoneyObjective();
    if (!moneyObj) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cEl sistema de economía no está disponible.");
      return;
    }
    const currentScore = moneyObj.getScore(player) ?? 0;
    if (currentScore < amount) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cNo tienes suficiente dinero.");
      return;
    }

    if (addBalance(player, -amount)) {
      const clan = db[playerClanKey];
      clan.balance = (clan.balance ?? 0) + amount;
      db[playerClanKey] = clan;
      saveClansData(db);
      
      player.sendMessage(`§b§l[§3Clanes§b§l]§r §aHas depositado §e$${amount}§a en el banco de tu clan.`);
      const formatted = `§b§l[§3Clanes§b§l]§r §e${player.name} §7depositó §a$${amount} §7en el banco del clan (Saldo total: §e$${clan.balance}§7).`;
      const membersLower = clan.members.map(m => m.toLowerCase());
      world.getAllPlayers().forEach(p => {
        if (p.isValid && membersLower.includes(p.name.toLowerCase())) {
          p.sendMessage(formatted);
        }
      });
    } else {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cError al realizar la transacción.");
    }
    return;
  }

  if (sub === "retirar") {
    const amountArg = args[2];
    const amount = Math.floor(Number(amountArg) || 0);
    if (!playerClanKey || !db[playerClanKey]) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cNo perteneces a ningún clan.");
      return;
    }
    const clan = db[playerClanKey];
    if (clan.owner !== player.name) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cSolo el líder del clan puede retirar dinero.");
      return;
    }
    if (!amountArg || isNaN(amount) || amount <= 0) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cUso: /s:clan retirar <cantidad>");
      return;
    }

    if ((clan.balance ?? 0) < amount) {
      player.sendMessage(`§b§l[§3Clanes§b§l]§r §cEl clan no tiene suficiente dinero. Saldo actual: §e$${clan.balance ?? 0}§c.`);
      return;
    }

    if (addBalance(player, amount)) {
      clan.balance = (clan.balance ?? 0) - amount;
      db[playerClanKey] = clan;
      saveClansData(db);

      player.sendMessage(`§b§l[§3Clanes§b§l]§r §aHas retirado §e$${amount}§a del banco de tu clan.`);
      const formatted = `§b§l[§3Clanes§b§l]§r §e${player.name} §7retiró §c$${amount} §7del banco del clan (Saldo total: §e$${clan.balance}§7).`;
      const membersLower = clan.members.map(m => m.toLowerCase());
      world.getAllPlayers().forEach(p => {
        if (p.isValid && membersLower.includes(p.name.toLowerCase())) {
          p.sendMessage(formatted);
        }
      });
    } else {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cError al realizar la transacción.");
    }
    return;
  }

  if (sub === "mision") {
    if (!playerClanKey || !db[playerClanKey]) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cNo perteneces a ningún clan.");
      return;
    }
    const clan = db[playerClanKey];
    if (!clan.quest) {
      assignRandomClanQuest(clan);
      db[playerClanKey] = clan;
      saveClansData(db);
    }
    player.sendMessage(`§b§l[§3Clanes§b§l]§r §eMisión Cooperativa Activa:`);
    player.sendMessage(`§7Descripción: §f${clan.quest.description}`);
    player.sendMessage(`§7Progreso: §e${clan.quest.progress} / ${clan.quest.target}`);
    player.sendMessage(`§7Recompensa: §a$${clan.quest.reward} (al banco del clan)`);
    return;
  }
  
  if (sub === "disable" || sub === "enable" || sub === "pvp" || sub === "activar" || sub === "desactivar") { // if (sub === "disable" || sub === "enable" || sub === "pvp")
    player.sendMessage("§b§l[§3Clanes§b§l]§r §eEl fuego amigo no puede activarse: los clanes son cooperativos.");
    return;
  }

  if (sub === "caza") { // if (sub === "bounty")
    if (!BOUNTY_ENABLED) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §eEl cazarecompensas no forma parte del modo comunitario actual.");
      return;
    }
    const action = String(args[2] || "estado").toLowerCase();
    const state = loadBountyState();

    if (action === "status" || action === "estado") {
      if (!state.active || !state.targetName) {
        player.sendMessage("§b§l[§3Caza§b§l]§r §7No hay una caza recompensas activa en este momento.");
        return;
      }
      const remainingMs = Math.max(0, Number(state.expiresAt || 0) - Date.now());
      const remainingMin = Math.ceil(remainingMs / 60000);
      player.sendMessage(`§b§l[§3Caza§b§l]§r §7Objetivo actual: §c${state.targetName} §7| Recompensa: §a$${state.reward} §7| Expira en: §e${remainingMin} min`);
      return;
    }

    if (!isPlayerOp(player)) {
      player.sendMessage("§b§l[§3Caza§b§l]§r §cSolo administradores pueden gestionar la caza recompensas.");
      return;
    }

    if (action === "stop" || action === "detener") {
      endBounty("§cLa caza recompensas fue cancelada por administración.");
      return;
    }

    if (action === "start" || action === "iniciar") {
      const requestedTargetName = String(args[3] || "").trim();
      const rewardArg = String(args[4] || args[3] || "").trim();
      let targetPlayer = null;
      let reward = BOUNTY_DEFAULT_REWARD;

      if (requestedTargetName) {
        targetPlayer = world.getAllPlayers().find((candidate) => candidate.name.toLowerCase() === requestedTargetName.toLowerCase());
      }

      if (!targetPlayer) {
        targetPlayer = pickRandomBountyTarget([player.name]);
      }

      const parsedReward = Number(String(rewardArg).replace(/[^\d]/g, ""));
      if (Number.isFinite(parsedReward) && parsedReward > 0) {
        reward = parsedReward;
      }

      if (!targetPlayer) {
        player.sendMessage("§b§l[§3Caza§b§l]§r §cNo hay jugadores válidos para iniciar la caza recompensas.");
        return;
      }

      startBounty(targetPlayer, reward, player.name);
      return;
    }

    player.sendMessage("§b§l[§3Caza§b§l]§r §cUso: /s:clan caza <estado|iniciar|detener> [jugador] [recompensa]");
    return;
  }
}

function sendClanMessage(sender, clan, message) {
  const colorCode = BEDROCK_COLOR_CODES[clan.color] || "§6";
  const formatted = `${colorCode}[Clan ${clan.name}] §f${sender.name}: ${message}`;
  
  world.getAllPlayers().forEach(p => {
    if (clan.members.includes(p.name)) {
      p.sendMessage(formatted);
    }
  });
}

// Política de clanes: el fuego amigo nunca se habilita desde este addon.
try {
  if (world.beforeEvents && world.beforeEvents.entityHurt && typeof world.beforeEvents.entityHurt.subscribe === "function") {
    world.beforeEvents.entityHurt.subscribe((event) => {
      const victim = event.hurtEntity;
      const attacker = getDamageSourcePlayer(event.damageSource) || event.damageSource.damagingEntity;
      if (BOUNTY_ENABLED && victim?.typeId === "minecraft:player") {
        const victimProtected = isBountyWarmupActive(victim.name);
        const attackerProtected = attacker?.typeId === "minecraft:player" ? isBountyWarmupActive(attacker.name) : false;
        if (victimProtected || attackerProtected) {
          event.cancel = true;
          if (attacker?.typeId === "minecraft:player") {
            try {
              attacker.sendMessage("§b§l[§3Caza§b§l]§r §cEse combate aún no se habilita. Espera 10 segundos.");
            } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
          }
          return;
        }
      }
      if (victim && attacker && victim.typeId === "minecraft:player" && attacker.typeId === "minecraft:player") {
        const clanKeyVictim = globalThis.__sqlite_get_prop_v2__("clans_addon", victim, "clan_key");
        const clanKeyAttacker = globalThis.__sqlite_get_prop_v2__("clans_addon", attacker, "clan_key");
        if (clanKeyVictim && clanKeyVictim === clanKeyAttacker) {
          if (!CLAN_FRIENDLY_FIRE_ALLOWED) {
            event.cancel = true;
          }
        }
      }
    });
  }
} catch (error) { ErrorReporter.report(error, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn(`[Clans Addon] Error registrando entityHurt: ${error}`);
}

const TITLE_COLORS = {
  "Cazador": "§a",
  "Aventurero": "§b",
  "Guerrero": "§e",
  "VIP": "§d",
  "Millonario": "§6",
  "Rey": "§c"
};
const lastRenderedNameTags = new Map();

// Bucle para actualizar la barra de salud sobre la cabeza de los jugadores (respetando clanes)
system.runInterval(() => {
  try {
    const db = loadClansData();
    for (const player of world.getAllPlayers()) {
      const healthComp = player.getComponent("minecraft:health");
      if (!healthComp) continue;

      const current = healthComp.currentValue;
      const max = healthComp.effectiveMax;

      // Color del corazón según la cantidad de vida
      let heartColor = "§c"; // rojo si tiene poca vida
      if (current / max > 0.6) {
        heartColor = "§a"; // verde si tiene buena vida
      } else if (current / max > 0.25) {
        heartColor = "§e"; // amarillo si está herido medio
      }

      const heartBar = `${heartColor}❤ §7${Math.round(current)}/${Math.round(max)}`;
      
      const title = globalThis.__sqlite_get_prop_v2__("clans_addon", player, "equipped_title") || "";
      let titlePrefix = "";
      if (title) {
        const titleColor = TITLE_COLORS[title] || "§7";
        titlePrefix = `${titleColor}[${title}] §r`;
      }
      const specialLabelPrefix = getSpecialLabelPrefix(player);

      const clanKey = globalThis.__sqlite_get_prop_v2__("clans_addon", player, "clan_key");
      let clanPrefix = "";
      if (clanKey && db[clanKey]) {
        const clan = db[clanKey];
        if (clan.members.includes(player.name)) {
          const colorCode = BEDROCK_COLOR_CODES[clan.color] || "§6";
          clanPrefix = `${colorCode}[${clan.name}] §r`;
        } else {
          // Player was kicked
          globalThis.__sqlite_set_prop_v2__("clans_addon", player, "clan_key", "");
          updateClanTags(player, "", "");
        }
      } else if (clanKey) {
        // Clan was disbanded
        globalThis.__sqlite_set_prop_v2__("clans_addon", player, "clan_key", "");
        updateClanTags(player, "", "");
      }

      const rolePrefix = getFcxAdminRolePrefix(player);

      // Actualizar el nametag del jugador
      const nextNameTag = `${titlePrefix}${specialLabelPrefix}${clanPrefix}${rolePrefix}${player.name}\n${heartBar}`;
      if (lastRenderedNameTags.get(player.id) !== nextNameTag) {
        player.nameTag = nextNameTag;
        lastRenderedNameTags.set(player.id, nextNameTag);
      }
    }
  } catch (err) { ErrorReporter.report(err, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    // Silenciar errores en ejecución periódica
  }
}, 20); // Cada 1 segundo; evita reescrituras redundantes


// Bucle periódico para revelar las coordenadas y partículas del objetivo de cazarecompensas
let bountyTicks = 0;
activeBountyColiseumSession = null;
system.run(() => {
  const persistedSession = loadBountyColiseumSession();
  if (BOUNTY_ENABLED) {
    activeBountyColiseumSession = persistedSession;
    return;
  }

  const persistedState = loadBountyState();
  const target = persistedSession?.targetName
    ? world.getAllPlayers().find((player) => player.name === persistedSession.targetName)
    : null;
  if (target && persistedSession?.returnLocation) {
    teleportPlayerToSavedLocation(target, persistedSession.returnLocation);
    saveDisabledBountyRecovery(null);
  } else if (persistedSession?.targetName && persistedSession?.returnLocation) {
    saveDisabledBountyRecovery(persistedSession);
  }

  clearCurrentBountyTarget();
  bountyCombatWarmups.clear();
  saveBountyState({ cooldowns: pruneExpiredBountyCooldowns(persistedState) });
  saveBountyColiseumSession(null);
  activeBountyColiseumSession = null;
  console.warn("[Clans Addon] Cazarecompensas desactivado temporalmente; estado activo y etiquetas limpiados.");
});

system.runInterval(() => {
  if (!BOUNTY_ENABLED) return;
  try {
    bountyTicks += 200; // Corre cada 200 ticks (10 segundos)
    
    const targetPlayer = world.getAllPlayers().find(p => p.hasTag("bounty_target"));
    if (targetPlayer) {
      const loc = targetPlayer.location;
      
      // Spawnear partículas sobre el objetivo para delatar su posición si hay gente cerca
      try {
        targetPlayer.dimension.spawnParticle("minecraft:basic_portal_particle", { x: loc.x, y: loc.y + 1, z: loc.z });
      } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

      // Solo anunciar coordenadas en el chat cada 60 segundos (1200 ticks)
      if (bountyTicks >= 1200) { 
        bountyTicks = 0;
        if (activeBountyColiseumSession?.targetName === targetPlayer.name) {
          world.sendMessage(`§b§l[§3Caza§b§l]§r §c${targetPlayer.name}§7 sigue dentro del coliseo §e${activeBountyColiseumSession.zoneName}§7.`);
        } else {
          let dimName = "Mundo Desconocido";
          const dimId = targetPlayer.dimension.id;
          if (dimId === "minecraft:overworld") dimName = "§aOverworld§r";
          else if (dimId === "minecraft:nether") dimName = "§cNether§r";
          else if (dimId === "minecraft:the_end") dimName = "§dEnd§r";
          
          world.sendMessage(`§b§l[§3Caza§b§l]§r §c${targetPlayer.name}§7 ha sido rastreado en: ${dimName}`);
        }
      }
    } else {
      bountyTicks = 0;
    }
  } catch (err) { ErrorReporter.report(err, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    // Silenciar
  }
}, 200); // Ejecutar cada 10 segundos (200 ticks)

system.runInterval(() => {
  if (!BOUNTY_ENABLED) return;
  try {
    const session = activeBountyColiseumSession;
    if (!session) return;

    const targetPlayer = world.getAllPlayers().find((player) => player.name === session.targetName);
    if (!targetPlayer) return;

    if (!isInsideZone(targetPlayer.location, targetPlayer.dimension.id, session.zone)) {
      const dimension = world.getDimension(session.zone.dimension);
      targetPlayer.teleport(session.targetSpawn, { dimension });
      try {
        targetPlayer.sendMessage("§b§l[§3Caza§b§l]§r §cNo puedes escapar del coliseo mientras seas el objetivo activo.");
      } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
}, BOUNTY_COLISEUM_ENFORCE_INTERVAL_TICKS);

system.runInterval(() => {
  if (!BOUNTY_ENABLED) return;
  try {
    const state = loadBountyState();
    if (state.active && Number(state.expiresAt || 0) > 0 && Date.now() >= Number(state.expiresAt)) {
      endBounty("§7La caza recompensas expiró. El objetivo entra en cooldown por 30 minutos.");
      return;
    }

    const targetPlayer = getCurrentBountyTarget();

    if (state.active && targetPlayer && (!activeBountyColiseumSession || activeBountyColiseumSession.targetName !== targetPlayer.name)) {
      // Avoid recreating session if already inside a valid coliseum session from dynamic property
      const currentSession = loadBountyColiseumSession();
      if (currentSession && currentSession.targetName === targetPlayer.name) {
          activeBountyColiseumSession = currentSession;
      } else {
          sendBountyTargetToColiseum(targetPlayer);
      }
    }

    if (state.active && !targetPlayer) {
      const replacement = pickRandomBountyTarget();
      if (replacement) {
        startBounty(replacement, state.reward || BOUNTY_DEFAULT_REWARD, "Sistema");
      } else {
        endBounty("§7La caza recompensas terminó porque no hay jugadores disponibles.");
      }
      return;
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
}, BOUNTY_MAINTENANCE_INTERVAL_TICKS);

system.runInterval(() => {
  if (!BOUNTY_ENABLED) return;
  try {
    const state = loadBountyState();
    if (!state.active) {
      const autoTarget = pickRandomBountyTarget();
      if (autoTarget) {
        startBounty(autoTarget, BOUNTY_DEFAULT_REWARD, "Sistema");
      }
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
}, BOUNTY_AUTO_INTERVAL_TICKS);

try {
  if (world.afterEvents && world.afterEvents.entityDie && typeof world.afterEvents.entityDie.subscribe === "function") {
    world.afterEvents.entityDie.subscribe((event) => {
      if (!BOUNTY_ENABLED) return;
      try {
        const victim = event.deadEntity;
        const killer = event.damageSource?.damagingEntity;
        if (!victim || !killer) return;
        if (victim.typeId !== "minecraft:player" || killer.typeId !== "minecraft:player") return;

        const state = loadBountyState();
        if (!state.active || state.targetName !== victim.name) return;

        if (areSameClan(killer, victim)) {
          endBounty(`§eLa caza sobre §c${victim.name}§e quedó anulada porque fue eliminado por un miembro de su mismo clan.`);
          try {
            killer.sendMessage("§b§l[§3Caza§b§l]§r §cNo puedes cobrar una caza recompensas matando a alguien de tu mismo clan.");
          } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
          return;
        }

        const reward = Math.max(1, Math.floor(Number(state.reward) || BOUNTY_DEFAULT_REWARD));
        if (payBountyReward(killer, reward)) {
          endBounty(`§a${killer.name} §7ha eliminado al objetivo §c${victim.name}§7 y cobró §a$${reward}§7.`);
        } else {
          killer.sendMessage("§b§l[§3Caza§b§l]§r §cNo se pudo acreditar la recompensa. Contacta a un administrador.");
          console.warn(`[Clans Addon] No se pudo pagar bounty de $${reward} a ${killer.name}.`);
        }
      } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
    });
  }
} catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn(`[Clans Addon] Error registrando entityDie para bounty: ${e}`);
}

try {
  world.afterEvents.playerLeave.subscribe((event) => {
    lastRenderedNameTags.delete(event.playerId);
    if (!BOUNTY_ENABLED) return;
    
    const name = String(event.playerName || "").toLowerCase();
    if (!name) return;
    
    const session = loadBountyColiseumSession();
    if (session && (String(session.targetName || "").toLowerCase() === name || String(session.hunterName || "").toLowerCase() === name)) {
      const reason = "Abandono de caza recompensas en coliseo. Ban temporal de 10 minutos.";
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
      try {
        console.warn(`[BAN_SYNC] {"name":"${event.playerName || name}","reason":"${reason}","expiresAt":${expiresAt}}`);
      } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
      world.sendMessage(`§b§l[§3Caza§b§l]§r §c${event.playerName || name} §7recibió un ban temporal de §e10 minutos §7por abandonar la caza en coliseo.`);
      endBounty(`§cLa caza sobre §e${session.targetName} §cse canceló por abandono de combate.`);
    }
  });
} catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

// ============================================================================
// RECEPCIÓN DE COLISEOS DESDE PROTECTION ADDON
// ============================================================================
try {
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "clans:sync_coliseums") {
      try {
        const payload = JSON.parse(event.message);
        system.run(() => {
          // No sobrescribir protecciones_db: pertenece al addon de protecciones
          // y también contiene todos los terrenos privados. Conservamos este
          // snapshot solo para la integración de clanes/coliseos.
          globalThis.__sqlite_set_prop_v2__("clans_addon", "world", "clans_coliseum_zones_v1", JSON.stringify(payload.zones || []));
          globalThis.__sqlite_set_prop_v2__("clans_addon", "world", "active_coliseum_id", payload.activeId || "");
        });
      } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
        console.warn("[Clans Addon] Error parseando sync de coliseos: " + e);
      }
    }
  });
} catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Clans Addon] Error registrando scriptEventReceive: " + e);
}


system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === "clans:bounty_death") {
    if (!BOUNTY_ENABLED) return;
    try {
      const victimName = event.message.trim();
      const state = loadBountyState();
      const session = loadBountyColiseumSession();
      if (!state.active || !session) return;
      
      const victimLower = victimName.toLowerCase();
      const isTarget = session.targetName?.toLowerCase() === victimLower;
      const isHunter = session.hunterName?.toLowerCase() === victimLower;
      
      if (isTarget || isHunter) {
        const winnerName = isTarget ? session.hunterName : session.targetName;
        const loserName = isTarget ? session.targetName : session.hunterName;
        const winner = world.getAllPlayers().find(p => p.name.toLowerCase() === winnerName?.toLowerCase());
        const loser = world.getAllPlayers().find(p => p.name.toLowerCase() === loserName?.toLowerCase());
        
        if (loser) {
           loser.sendMessage("§b§l[§3Caza§b§l]§r §cHas sido derrotado. Conservas tus objetos.");
        }
        
        if (isTarget && winner) {
           const reward = Math.max(1, Math.floor(Number(state.reward) || BOUNTY_DEFAULT_REWARD));
           if (payBountyReward(winner, reward)) {
             endBounty(`§a${winner.name} §7ha cazado al objetivo §c${loserName}§7 en el coliseo y cobró §a$${reward}§7.`);
           } else {
             winner.sendMessage("§b§l[§3Caza§b§l]§r §cNo se pudo acreditar la recompensa. El evento no se marcó como pagado; contacta a un administrador.");
             console.warn(`[Clans Addon] No se pudo pagar bounty de $${reward} a ${winner.name}.`);
           }
        } else if (isHunter) {
           endBounty(`§eEl cazador §c${loserName} §efue derrotado por el objetivo §c${winnerName}§e.`);
        }
      }
    } catch (e) { ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("Error processing bounty_death: " + e);
    }
  }
});

// Progresar misiones de clan al romper bloques
try {
  world.afterEvents.playerBreakBlock.subscribe((event) => {
    try {
      const player = event.player;
      if (!player) return;
      const clanKey = getPlayerClan(player);
      if (!clanKey) return;

      const db = loadClansData();
      const clan = db[clanKey];
      if (!clan || !clan.quest || !clan.quest.active) return;

      const blockTypeId = event.brokenBlockPermutation.type.id;
      let progressed = false;

      if (clan.quest.id === "mine_iron" && (blockTypeId === "minecraft:iron_ore" || blockTypeId === "minecraft:deepslate_iron_ore")) {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "mine_coal" && (blockTypeId === "minecraft:coal_ore" || blockTypeId === "minecraft:deepslate_coal_ore")) {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "mine_diamond" && (blockTypeId === "minecraft:diamond_ore" || blockTypeId === "minecraft:deepslate_diamond_ore")) {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "mine_gold" && (blockTypeId === "minecraft:gold_ore" || blockTypeId === "minecraft:deepslate_gold_ore" || blockTypeId === "minecraft:nether_gold_ore")) {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "mine_redstone" && (blockTypeId === "minecraft:redstone_ore" || blockTypeId === "minecraft:deepslate_redstone_ore" || blockTypeId === "minecraft:lit_redstone_ore" || blockTypeId === "minecraft:deepslate_lit_redstone_ore")) {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "mine_copper" && (blockTypeId === "minecraft:copper_ore" || blockTypeId === "minecraft:deepslate_copper_ore")) {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "mine_lapis" && (blockTypeId === "minecraft:lapis_ore" || blockTypeId === "minecraft:deepslate_lapis_ore")) {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "mine_quartz" && (blockTypeId === "minecraft:quartz_ore" || blockTypeId === "minecraft:nether_quartz_ore")) {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "mine_debris" && blockTypeId === "minecraft:ancient_debris") {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "mine_emerald" && (blockTypeId === "minecraft:emerald_ore" || blockTypeId === "minecraft:deepslate_emerald_ore")) {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "chop_wood" && (blockTypeId.endsWith("_log") || blockTypeId.endsWith("_wood") || blockTypeId === "minecraft:log" || blockTypeId === "minecraft:log2")) {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "mine_obsidian" && (blockTypeId === "minecraft:obsidian" || blockTypeId === "minecraft:crying_obsidian")) {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "mine_glowstone" && blockTypeId === "minecraft:glowstone") {
        clan.quest.progress++;
        progressed = true;
      }

      if (progressed) {
        if (clan.quest.progress >= clan.quest.target) {
          completeClanQuest(clanKey, clan);
        } else {
          db[clanKey] = clan;
          saveClansData(db);
          announceClanQuestProgress(clan, clan.quest.progress, clan.quest.target);
        }
      }
    } catch (e) {
      ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "quest_break_block", category: "runtime" });
    }
  });
} catch (e) {
  console.warn("[Clans Addon] Error al registrar playerBreakBlock para misiones: " + e);
}

// Progresar misiones de clan al derrotar mobs
try {
  world.afterEvents.entityDie.subscribe((event) => {
    try {
      const deadEntity = event.deadEntity;
      const damageSource = event.damageSource;
      if (!deadEntity || !damageSource) return;
      const killer = damageSource.damagingEntity;
      if (!killer || killer.typeId !== "minecraft:player") return;

      const clanKey = getPlayerClan(killer);
      if (!clanKey) return;

      const db = loadClansData();
      const clan = db[clanKey];
      if (!clan || !clan.quest || !clan.quest.active) return;

      let progressed = false;
      const typeId = deadEntity.typeId;

      if (clan.quest.id === "kill_zombies" && (typeId === "minecraft:zombie" || typeId === "minecraft:husk" || typeId === "minecraft:drowned")) {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "kill_skeletons" && (typeId === "minecraft:skeleton" || typeId === "minecraft:stray")) {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "kill_creepers" && typeId === "minecraft:creeper") {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "kill_endermen" && typeId === "minecraft:enderman") {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "kill_spiders" && (typeId === "minecraft:spider" || typeId === "minecraft:cave_spider")) {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "kill_witches" && typeId === "minecraft:witch") {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "kill_blazes" && typeId === "minecraft:blaze") {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "kill_ghasts" && typeId === "minecraft:ghast") {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "kill_slimes" && typeId === "minecraft:slime") {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "kill_phantoms" && typeId === "minecraft:phantom") {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "kill_piglins" && (typeId === "minecraft:piglin" || typeId === "minecraft:piglin_brute" || typeId === "minecraft:zombified_piglin")) {
        clan.quest.progress++;
        progressed = true;
      } else if (clan.quest.id === "kill_magmacubes" && typeId === "minecraft:magma_cube") {
        clan.quest.progress++;
        progressed = true;
      }

      if (progressed) {
        if (clan.quest.progress >= clan.quest.target) {
          completeClanQuest(clanKey, clan);
        } else {
          db[clanKey] = clan;
          saveClansData(db);
          announceClanQuestProgress(clan, clan.quest.progress, clan.quest.target);
        }
      }
    } catch (e) {
      ErrorReporter.report(e, { addonId: "clans_addon", moduleId: "main.js", operation: "quest_entity_die", category: "runtime" });
    }
  });
} catch (e) {
  console.warn("[Clans Addon] Error al registrar entityDie para misiones: " + e);
}
