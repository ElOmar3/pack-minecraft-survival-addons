import { ErrorReporter } from "./ErrorReporter.js";
import { BlockPermutation, CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, ItemStack, PlayerPermissionLevel, world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";






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
globalThis.__sqlite_sync_complete_v2__.delete("protection_addon");
globalThis.__sqlite_request_sync_v3__("protection_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("protection_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("protection_addon", 1);
  } catch (e) {}
}, 120);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
console.warn("Zone Protection Addon iniciado.");
system.runTimeout(() => { try { const entries = [].map((id) => { const value = globalThis.__sqlite_get_prop_v2__("protection_addon", "world", id); return { id, size: typeof value === "string" ? value.length : value === undefined ? 0 : String(value).length }; }).sort((a, b) => b.size - a.size); console.warn(`[DP_AUDIT_PROTECTION_V1] total_chars=${entries.reduce((sum, entry) => sum + entry.size, 0)} largest=${JSON.stringify(entries.slice(0, 12))}`); } catch (e) { console.warn(`[DP_AUDIT_PROTECTION_V1] failed=${String(e?.message || e)}`); } }, 100);
const COMMAND_NAMESPACE = "s";
const ADMIN_PERMISSION =
  CommandPermissionLevel.GameDirectors ??
  CommandPermissionLevel.Admin ??
  CommandPermissionLevel.Host ??
  CommandPermissionLevel.Owner ??
  CommandPermissionLevel.Any;

function commandOk(message) {
  return { status: CustomCommandStatus.Success, message };
}

function commandError(message) {
  return { status: CustomCommandStatus.Failure, message };
}

// Auxiliar robusto para abrir formularios evitando conflictos de pantallas
function safeOpenForm(player, form, onSelect, onCancel = undefined, retryCount = 0) {
  form.show(player).then((response) => {
    if (response.canceled) {
      if (response.cancelationReason === "UserBusy" && retryCount < 5) {
        system.runTimeout(() => {
          safeOpenForm(player, form, onSelect, onCancel, retryCount + 1);
        }, 10);
        return;
      }
      if (onCancel) {
        system.run(() => {
          onCancel(response);
        });
      }
      return;
    }
    system.run(() => {
      onSelect(response);
    });
  }).catch((err) => {
    console.warn(`[Protección] Error en safeOpenForm: ${err}`);
  });
}

// Estructura en memoria para selecciones temporales
const playerSelections = new Map();

// Cargar y guardar base de datos
const ZONES_DB_KEY = "protecciones_db";
let zonesCacheRaw;
let zonesCache = [];
// Después de /reload la memoria del script empieza vacía. Hasta que SQLite
// rehidrate las zonas, se bloquea construcción para no dejar una ventana sin
// protección ni permitir guardar una lista vacía sobre los datos persistidos.
let zonesDataAvailable = true;
const privateEjectionDiagnostics = new Map();

function loadZones() {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("protection_addon", "world", ZONES_DB_KEY);
    if (raw === undefined || raw === null) {
      zonesDataAvailable = true;
      return [];
    }
    if (Array.isArray(raw)) {
      zonesDataAvailable = true;
      return raw;
    }
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        zonesDataAvailable = true;
        return parsed;
      }
    }
    zonesDataAvailable = false;
    return [];
  } catch (e) {
    zonesDataAvailable = false;
    ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "loadZones", category: "runtime" });
    return [];
  }
}

function loadZonesForUpdate() {
  loadZones();
  return loadZones().map((zone) => ({
    ...zone,
    min: zone?.min ? { ...zone.min } : zone?.min,
    max: zone?.max ? { ...zone.max } : zone?.max,
    trusted: Array.isArray(zone?.trusted) ? [...zone.trusted] : zone?.trusted,
    automationAreas: Array.isArray(zone?.automationAreas)
      ? zone.automationAreas.map((area) => ({
          ...area,
          min: area?.min ? { ...area.min } : area?.min,
          max: area?.max ? { ...area.max } : area?.max,
        }))
      : zone?.automationAreas,
    supplyChests: Array.isArray(zone?.supplyChests)
      ? zone.supplyChests.map((supply) => ({ ...supply }))
      : zone?.supplyChests,
    paidFarmAreas: Array.isArray(zone?.paidFarmAreas)
      ? zone.paidFarmAreas.map((area) => ({ ...area, min: area?.min ? { ...area.min } : area?.min, max: area?.max ? { ...area.max } : area?.max, lobby: area?.lobby ? { ...area.lobby } : area?.lobby, entry: area?.entry ? { ...area.entry } : area?.entry, button: area?.button ? { ...area.button } : area?.button }))
      : zone?.paidFarmAreas,
    spawn1: zone?.spawn1 ? { ...zone.spawn1 } : zone?.spawn1,
    spawn2: zone?.spawn2 ? { ...zone.spawn2 } : zone?.spawn2,
  }));
}

function saveZones(zones) {
  if (!Array.isArray(zones)) {
    console.warn("[Protección] Escritura rechazada: la base de zonas no está disponible o no es válida.");
    return false;
  }
  try {
    const raw = JSON.stringify(zones);
    globalThis.__sqlite_set_prop_v2__("protection_addon", "world", ZONES_DB_KEY, raw);
    zonesCacheRaw = raw;
    zonesCache = zones;
    return String(globalThis.__sqlite_get_prop_v2__("protection_addon", "world", ZONES_DB_KEY) || "") === raw;
  } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn("Error al guardar zonas: " + e);
    return false;
  }
}

function setActiveColiseumId(coliseumId) {
  try {
    globalThis.__sqlite_set_prop_v2__("protection_addon", "world", ACTIVE_COLISEUM_KEY, String(coliseumId || ""));
  } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
}

function getActiveColiseumId() {
  try {
    return String(globalThis.__sqlite_get_prop_v2__("protection_addon", "world", ACTIVE_COLISEUM_KEY) || "").trim();
  } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return "";
  }
}

function loadBountyColiseumSession() {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("protection_addon", "world", "bounty_coliseum_session");
    return raw ? JSON.parse(String(raw)) : null;
  } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return null;
  }
}

const CLAIM_BASE_PRICE = 2000;
const CLAIM_PRICE_PER_BLOCK = 4;
const CLAIM_MAX_SIZE = 100;
const MAX_OPERATIONAL_BALANCE = 100000000;
const END_DIMENSION_ID = "minecraft:the_end";
const EXTRA_ZONES_REGISTRY_KEY = "extra_zones_registry_v1";
const EXTRA_ZONES_SHARED_OBJECTIVE = "extra_zones_shared";
const COLISEUM_ENTRY_FEE = 3000;
const COLISEUM_PVP_REWARD = 4800;
const COLISEUM_PAIR_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const COLISEUM_PLAYER_COOLDOWN_MS = 10 * 60 * 1000;
const COLISEUM_ECONOMY_KEY = "coliseum_economy_v1";
const COLISEUM_START_DELAY_MS = 10 * 1000;
const COMBAT_LOG_TEMP_BAN_MS = 10 * 60 * 1000;
const ACTIVE_COLISEUM_KEY = "active_coliseum_id";
const TELEPORT_EXEMPT_TAG = "event_mode";
const TELEPORT_EXEMPT_TICKS = 60;
const PROTECTION_WARNING_COOLDOWN_MS = 1500;
const lastProtectionWarnings = new Map();
const COLISEUM_REQUEST_TIMEOUT_MS = 60 * 1000;
const coliseumRequests = new Map();
const activeColiseumMatches = new Map();
const activeColiseumZoneMatches = new Map();
const quarantinedColiseumZones = new Set();
const playerActiveColiseumMatch = new Map();
const coliseumCombatWarmups = new Map();
const activeColiseumClears = new Map();
const COLISEUM_CLEAR_BLOCKS_PER_TICK = 400;
let nextColiseumClearId = 1;

function getExtraZoneAllowance(player) {
  // extra_zones es la propiedad actual. Las demás claves y etiquetas cubren
  // compras antiguas o entregas externas sin reducir nunca un beneficio válido.
  const propertyKeys = [
    "extra_zones",
    "extra_zones_v1",
    "extra_protections",
    "extra_claims",
    "purchased_extra_zones"
  ];
  let allowance = 0;
  for (const key of propertyKeys) {
    try {
      const value = Math.floor(Number(globalThis.__sqlite_get_prop_v2__("protection_addon", player, key) ?? 0));
      if (Number.isFinite(value)) allowance = Math.max(allowance, value);
    } catch (e) {}
  }
  try {
    const objective = world.scoreboard.getObjective(EXTRA_ZONES_SHARED_OBJECTIVE);
    const shared = Math.floor(Number(objective?.getScore(player) ?? 0));
    if (Number.isFinite(shared)) allowance = Math.max(allowance, shared);
  } catch (e) {}
  try {
    const raw = String(globalThis.__sqlite_get_prop_v2__("protection_addon", "world", EXTRA_ZONES_REGISTRY_KEY) ?? "");
    const registry = raw ? JSON.parse(raw) : {};
    const registered = Math.floor(Number(registry?.[String(player.name).toLowerCase()] ?? 0));
    if (Number.isFinite(registered)) allowance = Math.max(allowance, registered);
  } catch (e) {}
  try {
    for (const tag of player.getTags()) {
      const match = String(tag).toLowerCase().match(/^(?:extra[_-]?(?:zones?|terrenos?|protecciones?|claims?)|(?:zones?|terrenos?|protecciones?|claims?)[_-]?extra)[_-]?(\d+)$/);
      if (match) allowance = Math.max(allowance, Number(match[1]));
    }
  } catch (e) {}
  return Math.max(0, Math.min(100, allowance));
}

function calculateClaimPrice(sizeX, sizeZ) {
  const width = Number(sizeX);
  const depth = Number(sizeZ);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(depth) || width < 1 || depth < 1) return undefined;
  if (width > CLAIM_MAX_SIZE || depth > CLAIM_MAX_SIZE) return undefined;
  return CLAIM_BASE_PRICE + (width * depth * CLAIM_PRICE_PER_BLOCK);
}

function formatClaimMoney(amount) {
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  return `$${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function getSelectionQuote(pos1, pos2) {
  if (!pos1 || !pos2 || pos1.dimension !== pos2.dimension) return undefined;
  const sizeX = Math.abs(Number(pos2.x) - Number(pos1.x)) + 1;
  const sizeZ = Math.abs(Number(pos2.z) - Number(pos1.z)) + 1;
  return { sizeX, sizeZ, price: calculateClaimPrice(sizeX, sizeZ) };
}

const CLAIM_PRICE_GUIDE =
  "§7Fórmula: §a$2,000 + $4 por bloque horizontal§7. Máximo: §e100x100§7.\n" +
  "§7Ejemplos cuadrados: §f10x10 §a$2,400§7 | §f20x20 §a$3,600§7 | §f30x30 §a$5,600§7 | §f40x40 §a$8,400§7 | §f50x50 §a$12,000§7\n" +
  "§f60x60 §a$16,400§7 | §f70x70 §a$21,600§7 | §f80x80 §a$27,600§7 | §f90x90 §a$34,400§7 | §f100x100 §a$42,000§7.";

const PROTECTED_CONTAINER_FRAGMENTS = [
  "chest", "shulker", "hopper", "dispenser", "dropper", "furnace", "barrel", "anvil",
  "blast_furnace", "smoker", "campfire", "soul_campfire"
];

const PROTECTED_MECHANISM_FRAGMENTS = [
  "door", "gate", "button", "lever", "trapdoor", "fence_gate"
];

const PROTECTED_FUNCTIONAL_FRAGMENTS = [
  "lectern", "smithing_table", "cartography_table", "grindstone", "loom", "stonecutter",
  "crafter", "enchanting_table", "beacon", "brewing_stand", "crafting_table",
  "ender_chest", "jukebox", "noteblock", "note_block", "respawn_anchor", "bed",
  "chiseled_bookshelf", "bookshelf"
];

const PROTECTED_ENTITY_TYPES = new Set([
  "minecraft:armor_stand",
  "minecraft:chest_boat",
  "minecraft:chest_minecart",
  "minecraft:hopper_minecart",
  "minecraft:boat",
  "minecraft:minecart",
  "minecraft:item_frame",
  "minecraft:glow_item_frame",
  "minecraft:villager",
  "minecraft:wandering_trader",
  "minecraft:horse",
  "minecraft:donkey",
  "minecraft:mule",
  "minecraft:llama",
  "minecraft:trader_llama",
  "minecraft:camel",
  "minecraft:wolf",
  "minecraft:cat",
  "minecraft:parrot",
  "minecraft:allay",
  "minecraft:bee",
  "minecraft:sniffer",
  "minecraft:goat",
  "minecraft:fox",
  "minecraft:axolotl"
]);

function getMoneyObjective() {
  let obj = world.scoreboard.getObjective("money");
  if (!obj) {
    try {
      obj = world.scoreboard.addObjective("money", "§e$ Dinero");
    } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }
  return obj;
}

function getBalance(player) {
  const obj = getMoneyObjective();
  if (!obj) return 0;
  try {
    return (function(o, p){ try{return o.getScore(p) ?? 0;}catch(e){try{return o.getScore(p.name) ?? 0;}catch(e2){return 0;}} })(obj, player) ?? 0;
  } catch (e) {
    try {
      return obj.getScore(player.name) ?? 0;
    } catch (e2) {
      return 0;
    }
  }
}

function addBalance(player, amount, { allowOverOperationalLimit = false } = {}) {
  const obj = getMoneyObjective();
  if (!obj) return false;
  try {
    const current = Math.max(0, Math.floor(getBalance(player)));
    const delta = Math.floor(Number(amount || 0));
    if (!Number.isSafeInteger(delta) || (delta < 0 && current < Math.abs(delta))) return false;
    const next = current + delta;
    if (delta > 0 && !allowOverOperationalLimit && next > MAX_OPERATIONAL_BALANCE) return false;
    try {
      obj.setScore(player, next);
    } catch (participantError) {
      obj.setScore(player.name, next);
    }
    return getBalance(player) === next;
  } catch (e) {
    console.warn(`Error al modificar saldo para ${player.name}: ${e}`);
    return false;
  }
}

function getColiseumPairKey(firstName, secondName) {
  return [normalizePlayerName(firstName), normalizePlayerName(secondName)].sort().join("|");
}

function loadColiseumEconomy() {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("protection_addon", "world", COLISEUM_ECONOMY_KEY);
    const parsed = raw ? JSON.parse(String(raw)) : {};
    return {
      unavailable: false,
      pairs: typeof parsed.pairs === "object" && parsed.pairs ? parsed.pairs : {},
      players: typeof parsed.players === "object" && parsed.players ? parsed.players : {}
    };
  } catch (e) {
    ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "loadColiseumEconomy", category: "runtime" });
    return { unavailable: true, pairs: {}, players: {} };
  }
}

function saveColiseumEconomy(state) {
  try {
    const serialized = JSON.stringify(state);
    globalThis.__sqlite_set_prop_v2__("protection_addon", "world", COLISEUM_ECONOMY_KEY, serialized);
    return String(globalThis.__sqlite_get_prop_v2__("protection_addon", "world", COLISEUM_ECONOMY_KEY) || "") === serialized;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "saveColiseumEconomy", category: "runtime" });
    return false;
  }
}

function getColiseumCooldown(firstName, secondName) {
  const state = loadColiseumEconomy();
  if (state.unavailable) return COLISEUM_PAIR_COOLDOWN_MS;
  const now = Date.now();
  const pairAt = Math.max(0, Number(state.pairs[getColiseumPairKey(firstName, secondName)]) || 0);
  const firstAt = Math.max(0, Number(state.players[normalizePlayerName(firstName)]) || 0);
  const secondAt = Math.max(0, Number(state.players[normalizePlayerName(secondName)]) || 0);
  return Math.max(
    0,
    COLISEUM_PAIR_COOLDOWN_MS - (now - pairAt),
    COLISEUM_PLAYER_COOLDOWN_MS - (now - firstAt),
    COLISEUM_PLAYER_COOLDOWN_MS - (now - secondAt)
  );
}

function recordColiseumCompletion(match) {
  if (!match?.entryFeesPaid) return true;
  const state = loadColiseumEconomy();
  if (state.unavailable) {
    console.warn(`[ECONOMY_CRITICAL] coliseum_cooldown_unavailable match=${match.id || "unknown"} players=${match.playerAName},${match.playerBName}`);
    return false;
  }
  const now = Date.now();
  state.pairs[getColiseumPairKey(match.playerAName, match.playerBName)] = now;
  state.players[normalizePlayerName(match.playerAName)] = now;
  state.players[normalizePlayerName(match.playerBName)] = now;

  const pairCutoff = now - (7 * 24 * 60 * 60 * 1000);
  for (const [key, timestamp] of Object.entries(state.pairs)) {
    if (Number(timestamp) < pairCutoff) delete state.pairs[key];
  }
  const playerCutoff = now - (24 * 60 * 60 * 1000);
  for (const [key, timestamp] of Object.entries(state.players)) {
    if (Number(timestamp) < playerCutoff) delete state.players[key];
  }
  const persisted = saveColiseumEconomy(state);
  if (!persisted) {
    console.warn(`[ECONOMY_CRITICAL] coliseum_cooldown_persist_failed match=${match.id || "unknown"} players=${match.playerAName},${match.playerBName}`);
  }
  return persisted;
}

function grantTemporaryTeleportExemption(player, durationTicks = TELEPORT_EXEMPT_TICKS) {
  if (!player) return;
  try {
    player.addTag(TELEPORT_EXEMPT_TAG);
  } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  system.runTimeout(() => {
    try {
      player.removeTag(TELEPORT_EXEMPT_TAG);
    } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }, durationTicks);
}

function escapeCommandArg(value) {
  return String(value || "").replace(/"/g, '\\"');
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
  } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
}

function getSafeTeleportPosition(dimension, destination) {
  const baseX = Math.floor(Number(destination?.x) || 0);
  const baseY = Math.floor(Number(destination?.y) || 0);
  const baseZ = Math.floor(Number(destination?.z) || 0);

  const candidates = [
    { x: baseX, y: baseY, z: baseZ },
    { x: baseX + 1, y: baseY, z: baseZ },
    { x: baseX - 1, y: baseY, z: baseZ },
    { x: baseX, y: baseY, z: baseZ + 1 },
    { x: baseX, y: baseY, z: baseZ - 1 },
  ];

  // Check upwards up to 5 blocks to prevent suffocation
  for (let dy = 0; dy <= 5; dy++) {
    for (const candidate of candidates) {
      try {
        const checkPos = { x: candidate.x, y: candidate.y + dy, z: candidate.z };
        const feetBlock = dimension.getBlock(checkPos);
        const headBlock = dimension.getBlock({ x: checkPos.x, y: checkPos.y + 1, z: checkPos.z });
        const floorBlock = dimension.getBlock({ x: checkPos.x, y: checkPos.y - 1, z: checkPos.z });
        
        const hasSpace = (!feetBlock || feetBlock.isAir) && (!headBlock || headBlock.isAir);
        const hasFloor = floorBlock && !floorBlock.isAir && !floorBlock.isLiquid;
        
        if (hasSpace && hasFloor) {
          return { x: checkPos.x + 0.5, y: checkPos.y, z: checkPos.z + 0.5 };
        }
      } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
    }
  }

  return {
    x: (Number(destination?.x) || 0) + 0.5,
    y: Number(destination?.y) || 0,
    z: (Number(destination?.z) || 0) + 0.5,
  };
}

function loadModerationBans() {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("protection_addon", "world", "bans_db");
    return raw ? JSON.parse(raw) : [];
  } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return [];
  }
}

function saveModerationBans(bans) {
  try {
    globalThis.__sqlite_set_prop_v2__("protection_addon", "world", "bans_db", JSON.stringify(bans));
  } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn(`[Protección] Error guardando bans: ${e}`);
  }
}

function normalizePlayerName(name) {
  return String(name || "").trim().toLowerCase();
}

function applyCombatLogoutTempBan(playerName, reason, source = "Sistema") {
  const normalizedName = normalizePlayerName(playerName);
  if (!normalizedName) return;

  const bans = loadModerationBans();
  const expiresAt = Date.now() + COMBAT_LOG_TEMP_BAN_MS;
  const existing = bans.find((entry) => normalizePlayerName(entry?.nameLower || entry?.name) === normalizedName);

  if (existing) {
    existing.name = existing.name || playerName;
    existing.nameLower = normalizedName;
    existing.reason = reason;
    existing.by = source;
    existing.createdAt = Date.now();
    existing.expiresAt = expiresAt;
    existing.date = new Date().toLocaleString("es-ES");
  } else {
    bans.push({
      name: playerName,
      nameLower: normalizedName,
      xuid: "",
      reason,
      by: source,
      createdAt: Date.now(),
      expiresAt,
      date: new Date().toLocaleString("es-ES"),
    });
  }

  saveModerationBans(bans);
  
  try {
    console.warn(`[BAN_SYNC] {"name":"${normalizedName}","reason":"${reason}","expiresAt":${expiresAt}}`);
  } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
}

function maybeWarnProtection(player, message) {
  if (!player?.id) return;
  const now = Date.now();
  const last = lastProtectionWarnings.get(player.id) ?? 0;
  if (now - last < PROTECTION_WARNING_COOLDOWN_MS) return;
  lastProtectionWarnings.set(player.id, now);
  system.run(() => {
    try {
      player.sendMessage(message);
    } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  });
}

function matchesAnyFragment(typeId, fragments) {
  const lower = String(typeId || "").toLowerCase();
  return fragments.some((fragment) => lower.includes(fragment));
}

function isProtectedBlockInteraction(block) {
  const blockLower = String(block?.typeId || "").toLowerCase();
  if (!blockLower) return false;
  if (blockLower.includes("sign") || blockLower.includes("frame") || blockLower.includes("painting")) return true;
  return (
    matchesAnyFragment(blockLower, PROTECTED_CONTAINER_FRAGMENTS) ||
    matchesAnyFragment(blockLower, PROTECTED_MECHANISM_FRAGMENTS) ||
    matchesAnyFragment(blockLower, PROTECTED_FUNCTIONAL_FRAGMENTS)
  );
}

function isLockedSignAt(pos, dimId) {
  const zones = getZonesAt(pos, dimId);
  return zones.length > 0 && zones.some((zone) => zone.isAdmin || zone.isCommunity === true || zone.zoneType === "community");
}

function isPublicAdminButton(block, pos, dimId) {
  if (!String(block?.typeId || "").toLowerCase().includes("button")) return false;
  const zones = getZonesAt(pos, dimId);
  return zones.length > 0 && zones.some((zone) => zone.isAdmin) &&
    zones.every((zone) => zone.isAdmin || zone.isCommunity === true || zone.zoneType === "community");
}

function isColiseumContainerBlock(block) {
  try {
    const typeId = String(block?.typeId || "").toLowerCase();
    return matchesAnyFragment(typeId, PROTECTED_CONTAINER_FRAGMENTS) || Boolean(block?.getComponent?.("minecraft:inventory"));
  } catch (e) {
    ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "isColiseumContainerBlock", category: "runtime" });
    return true;
  }
}

function isColiseumContainerItem(typeId) {
  return matchesAnyFragment(String(typeId || "").toLowerCase(), PROTECTED_CONTAINER_FRAGMENTS);
}

// Las zonas comunitarias permiten dejar cajas de shulker para facilitar el
// intercambio. Es una excepción deliberadamente exacta: no habilita ningún
// otro contenedor ni bloques con "shulker" en otro contexto.
function isShulkerBoxType(typeId) {
  const normalized = String(typeId || "").toLowerCase();
  return normalized === "minecraft:shulker_box" ||
    /^minecraft:[a-z_]+_shulker_box$/.test(normalized);
}

function canPlaceShulkerInCommunityZone(pos, dimId, blockTypeId) {
  if (!isShulkerBoxType(blockTypeId)) return false;
  const zones = getZonesAt(pos, dimId);
  // No se permite eludir una zona privada/admin cuando se solapa con una comunitaria.
  return zones.length > 0 && zones.every((zone) => zone.isCommunity === true || zone.zoneType === "community");
}

function isProtectedEntityInteraction(entity) {
  const typeId = String(entity?.typeId || "").toLowerCase();
  if (!typeId) return false;
  if (PROTECTED_ENTITY_TYPES.has(typeId)) return true;
  return typeId.includes("minecart") || typeId.includes("boat") || typeId.includes("item_frame") || typeId.includes("armor_stand") || typeId.includes("painting");
}

// Comprobar operador
function isPlayerOp(player) {
  if (!player) return false;
  try {
    if (player.playerPermissionLevel === PlayerPermissionLevel.Operator) return true;
  } catch (e) {}
  try {
    return !!(
      player.isOp === true ||
      (typeof player.isOp === "function" && player.isOp()) ||
      (typeof player.hasTag === "function" && (player.hasTag("op") || player.hasTag("admin")))
    );
  } catch (e) {
    return false;
  }
}

// Los nombres introducidos desde formularios, comandos y los que devuelve
// Bedrock no siempre conservan exactamente las mismas mayúsculas o formato.
// Esta es la única comparación de identidad usada por las protecciones.
function normalizeZonePlayerName(value) {
  const raw = typeof value === "object" && value !== null
    ? (value.name ?? value.playerName ?? value.gamertag ?? "")
    : value;
  return String(raw || "")
    .replace(/§[0-9A-FK-OR]/gi, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function canonicalPlayerName(value) {
  const entered = String(value || "").replace(/§[0-9A-FK-OR]/gi, "").trim().replace(/\s+/g, " ");
  if (!entered) return "";
  const normalized = normalizeZonePlayerName(entered);
  try {
    const online = world.getAllPlayers().find((candidate) => normalizeZonePlayerName(candidate?.name) === normalized);
    if (online?.name) return online.name;
  } catch (e) {}
  return entered;
}

function hasZoneAccess(player, zone) {
  if (!player || !zone) return false;
  if (isPlayerOp(player)) return true;
  const playerName = normalizeZonePlayerName(player.name);
  if (!playerName) return false;
  if (normalizeZonePlayerName(zone.owner) === playerName) return true;
  return Array.isArray(zone.trusted) && zone.trusted.some((entry) => normalizeZonePlayerName(entry) === playerName);
}

function matchDimension(dim1, dim2) {
  if (!dim1 || !dim2) return false;
  return String(dim1).replace(/^minecraft:/, "") === String(dim2).replace(/^minecraft:/, "");
}

// Comprobar si un punto está dentro de un cuboide
function isInside(pos, dimId, zone) {
  if (zone?.disabled === true) return false;
  if (!matchDimension(dimId, zone.dimension)) return false;
  const px = Math.floor(pos.x);
  const py = Math.floor(pos.y);
  const pz = Math.floor(pos.z);

  const coversFullHeight = zone.zoneType !== "coliseum" && (
    zone.isAdmin === true || zone.isCommunity === true || zone.zoneType === "claim" || !zone.zoneType
  );
  if (coversFullHeight) {
    // Safezones, comunidades y terrenos privados cubren todo el rango vertical.
    // Esto también normaliza las protecciones antiguas creadas antes de que el
    // sistema guardara -64..320 explícitamente.
    return (
      px >= zone.min.x && px <= zone.max.x &&
      pz >= zone.min.z && pz <= zone.max.z
    );
  }
  return (
    px >= zone.min.x && px <= zone.max.x &&
    py >= zone.min.y && py <= zone.max.y &&
    pz >= zone.min.z && pz <= zone.max.z
  );
}

// Buscar zonas en una ubicación
function getZonesAt(pos, dimId) {
  const zones = loadZones();
  return zones.filter(z => isInside(pos, dimId, z));
}

globalThis.isLocationProtectedFromPlayer = function(player, loc, dimId) {
  if (!player || !loc || !dimId) return false;
  if (isPlayerOp(player)) return false;
  const zones = getZonesAt(loc, dimId);
  for (const zone of zones) {
    if (isColiseumZone(zone)) return true;
    if (isPrivateClaimZone(zone) && !hasPrivateZoneAccess(player, zone)) return true;
  }
  return false;
}

// Herramienta visual: un bloque de redstone renombrado a "limites" dibuja el
// perímetro de una zona a la que el jugador ya tiene acceso. No cambia zonas,
// permisos ni bloques: sólo muestra partículas durante unos segundos.
const BOUNDARY_MARKER_BLOCK = "minecraft:redstone_block";
const BOUNDARY_MARKER_NAME = "limites";
const BOUNDARY_PREVIEW_MAX_EDGE_POINTS = 128;
const BOUNDARY_MARKERS_DB_KEY = "boundary_markers_v1";
const BOUNDARY_MARKER_LIMIT = 64;
const BOUNDARY_RENDER_INTERVAL_TICKS = 20;
const BOUNDARY_RENDER_DISTANCE = 192;

function normalizeBoundaryMarkerName(value) {
  return String(value || "")
    .replace(/§[0-9A-FK-OR]/gi, "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u");
}

function isBoundaryMarkerItem(itemStack) {
  return String(itemStack?.typeId || "").toLowerCase() === BOUNDARY_MARKER_BLOCK &&
    normalizeBoundaryMarkerName(itemStack?.nameTag) === BOUNDARY_MARKER_NAME;
}

function boundaryPreviewZone(player, pos, dimId) {
  const accessible = getZonesAt(pos, dimId).filter((zone) => hasZoneAccess(player, zone));
  if (!accessible.length) return undefined;
  const playerName = normalizeZonePlayerName(player?.name);
  return accessible.sort((first, second) => {
    const firstOwner = normalizeZonePlayerName(first.owner) === playerName ? 1 : 0;
    const secondOwner = normalizeZonePlayerName(second.owner) === playerName ? 1 : 0;
    if (firstOwner !== secondOwner) return secondOwner - firstOwner;
    const firstArea = (Number(first.max?.x) - Number(first.min?.x) + 1) * (Number(first.max?.z) - Number(first.min?.z) + 1);
    const secondArea = (Number(second.max?.x) - Number(second.min?.x) + 1) * (Number(second.max?.z) - Number(second.min?.z) + 1);
    return firstArea - secondArea;
  })[0];
}

function boundaryPreviewPoints(zone, y) {
  const minX = Math.floor(Number(zone.min?.x));
  const maxX = Math.floor(Number(zone.max?.x));
  const minZ = Math.floor(Number(zone.min?.z));
  const maxZ = Math.floor(Number(zone.max?.z));
  if (![minX, maxX, minZ, maxZ].every(Number.isFinite) || minX > maxX || minZ > maxZ) return [];
  const perimeter = Math.max(1, 2 * ((maxX - minX + 1) + (maxZ - minZ + 1)));
  const step = Math.max(1, Math.ceil(perimeter / BOUNDARY_PREVIEW_MAX_EDGE_POINTS));
  const points = [];
  const add = (x, z) => points.push({ x: x + 0.5, y: y + 0.15, z: z + 0.5 });
  for (let x = minX; x <= maxX; x += step) { add(x, minZ); add(x, maxZ); }
  for (let z = minZ; z <= maxZ; z += step) { add(minX, z); add(maxX, z); }
  add(maxX, maxZ);
  return points;
}

function boundaryMarkerId(dimension, location) {
  return `${dimension}:${Math.floor(location.x)}:${Math.floor(location.y)}:${Math.floor(location.z)}`;
}

function loadBoundaryMarkers() {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("protection_addon", "world", BOUNDARY_MARKERS_DB_KEY);
    const parsed = Array.isArray(raw) ? raw : (typeof raw === "string" && raw ? JSON.parse(raw) : []);
    return Array.isArray(parsed) ? parsed.filter((marker) => marker && typeof marker.id === "string") : [];
  } catch (error) {
    ErrorReporter.report(error, { addonId: "protection_addon", moduleId: "main.js", operation: "loadBoundaryMarkers", category: "runtime" });
    return [];
  }
}

function saveBoundaryMarkers(markers) {
  try {
    globalThis.__sqlite_set_prop_v2__("protection_addon", "world", BOUNDARY_MARKERS_DB_KEY, JSON.stringify(markers));
    return true;
  } catch (error) {
    ErrorReporter.report(error, { addonId: "protection_addon", moduleId: "main.js", operation: "saveBoundaryMarkers", category: "runtime" });
    return false;
  }
}

function markerMatchesZone(marker, zone) {
  return marker.dimension === zone.dimension &&
    marker.minX === Math.floor(Number(zone.min?.x)) && marker.maxX === Math.floor(Number(zone.max?.x)) &&
    marker.minZ === Math.floor(Number(zone.min?.z)) && marker.maxZ === Math.floor(Number(zone.max?.z));
}

function activateBoundaryMarker(player, markerLocation, dimId) {
  if (!player || player.dimension?.id !== dimId) return;
  const zone = boundaryPreviewZone(player, markerLocation, dimId);
  if (!zone) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §eEl bloque §fLímites§e debe colocarse dentro de una protección a la que tengas acceso.");
    return;
  }
  const id = boundaryMarkerId(dimId, markerLocation);
  const markers = loadBoundaryMarkers().filter((marker) => marker.id !== id);
  if (markers.length >= BOUNDARY_MARKER_LIMIT) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cYa hay demasiados marcadores de límites activos. Retira uno antes de colocar otro.");
    return;
  }
  markers.push({
    id, dimension: dimId,
    x: Math.floor(markerLocation.x), y: Math.floor(markerLocation.y), z: Math.floor(markerLocation.z),
    minX: Math.floor(Number(zone.min.x)), maxX: Math.floor(Number(zone.max.x)),
    minZ: Math.floor(Number(zone.min.z)), maxZ: Math.floor(Number(zone.max.z)),
    createdBy: normalizeZonePlayerName(player.name),
  });
  if (!saveBoundaryMarkers(markers)) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cNo se pudo activar el marcador de límites.");
    return;
  }
  const width = Math.floor(Number(zone.max.x) - Number(zone.min.x) + 1);
  const depth = Math.floor(Number(zone.max.z) - Number(zone.min.z) + 1);
  player.sendMessage(`§b§l[§3Protección§b§l]§r §aLímites de §e${zone.name || "protección"}§a activados: §f${width}x${depth}§a. Permanecerán visibles hasta retirar el bloque.`);
}

function scheduleBoundaryMarkerPreview(player, block) {
  const location = { x: block.x, y: block.y, z: block.z };
  const dimensionId = block.dimension.id;
  system.run(() => {
    try {
      const placed = player.dimension?.id === dimensionId ? player.dimension.getBlock(location) : undefined;
      if (placed?.typeId !== BOUNDARY_MARKER_BLOCK) return;
      activateBoundaryMarker(player, location, dimensionId);
    } catch (error) {
      ErrorReporter.report(error, { addonId: "protection_addon", moduleId: "main.js", operation: "scheduleBoundaryMarkerPreview", category: "runtime" });
    }
  });
}

function removeBoundaryMarkerAt(dimensionId, location) {
  const id = boundaryMarkerId(dimensionId, location);
  const markers = loadBoundaryMarkers();
  const retained = markers.filter((marker) => marker.id !== id);
  if (retained.length !== markers.length) saveBoundaryMarkers(retained);
}

function renderBoundaryMarkers() {
  const markers = loadBoundaryMarkers();
  if (!markers.length) return;
  const zones = loadZones();
  const retained = [];
  let changed = false;
  for (const marker of markers) {
    try {
      const dimension = world.getDimension(marker.dimension);
      const block = dimension?.getBlock({ x: marker.x, y: marker.y, z: marker.z });
      const zone = zones.find((candidate) => markerMatchesZone(marker, candidate));
      if (block?.typeId !== BOUNDARY_MARKER_BLOCK || !zone) {
        changed = true;
        continue;
      }
      retained.push(marker);
      const nearby = world.getAllPlayers().some((player) => {
        if (player.dimension?.id !== marker.dimension) return false;
        const dx = player.location.x - marker.x;
        const dy = player.location.y - marker.y;
        const dz = player.location.z - marker.z;
        return dx * dx + dy * dy + dz * dz <= BOUNDARY_RENDER_DISTANCE * BOUNDARY_RENDER_DISTANCE;
      });
      if (!nearby) continue;
      const minY = zoneCoversFullHeight(zone) ? -64 : Math.floor(Number(zone.min?.y));
      const maxY = zoneCoversFullHeight(zone) ? 320 : Math.floor(Number(zone.max?.y));
      const displayY = Math.max(minY, Math.min(maxY, marker.y + 1));
      for (const point of boundaryPreviewPoints(zone, displayY)) {
        dimension.spawnParticle("minecraft:colored_flame_particle", point);
      }
    } catch (error) {
      ErrorReporter.report(error, { addonId: "protection_addon", moduleId: "main.js", operation: "renderBoundaryMarkers", category: "runtime" });
    }
  }
  if (changed) saveBoundaryMarkers(retained);
}

system.runInterval(renderBoundaryMarkers, BOUNDARY_RENDER_INTERVAL_TICKS);

function isInsideAutomationArea(pos, dimId, parentZone, area) {
  if (!pos || !parentZone || !area || !matchDimension(parentZone.dimension, dimId)) return false;
  const x = Math.floor(Number(pos.x));
  const z = Math.floor(Number(pos.z));
  // La comunidad ya protege toda la altura. La subárea comparte ese modelo:
  // restringe horizontalmente (X/Z), evitando que la TNT o los troncos queden
  // fuera por diferencias de altura entre dispensador, cámara y cultivo.
  return [x, z].every(Number.isFinite) &&
    x >= area.min.x && x <= area.max.x &&
    z >= area.min.z && z <= area.max.z;
}

// Las subáreas no son zonas independientes: pertenecen a una única zona
// comunitaria y son la única excepción de explosiones de automatización.
function getAutomationAreaAt(pos, dimId, zones = loadZones()) {
  for (const zone of zones) {
    if (zone?.disabled || !(zone.isCommunity === true || zone.zoneType === "community")) continue;
    if (!isInside(pos, dimId, zone) || !Array.isArray(zone.automationAreas)) continue;
    const area = zone.automationAreas.find((candidate) => isInsideAutomationArea(pos, dimId, zone, candidate));
    if (area) return { zone, area };
  }
  return undefined;
}

function isAutomationSupplyMachine(block, pos, dimId, zones = loadZones()) {
  const typeId = String(block?.typeId || "").toLowerCase();
  if (typeId !== "minecraft:dispenser" && typeId !== "minecraft:dropper") return false;
  if (isAdjacentToCommunitySupply(pos, dimId, zones)) return true;
  try {
    const dimension = world.getDimension(dimId);
    for (const offset of [
      { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
    ]) {
      const hopperPos = { x: pos.x + offset.x, y: pos.y + offset.y, z: pos.z + offset.z };
      const neighbour = dimension.getBlock(hopperPos);
      if (neighbour?.typeId === "minecraft:hopper" && isAdjacentToCommunitySupply(hopperPos, dimId, zones)) return true;
    }
  } catch (e) {}
  return false;
}

function getUniqueAutomationAreaFromBlocks(blocks, dimId, zones) {
  let match;
  for (const block of blocks || []) {
    const areaMatch = getAutomationAreaAt({ x: block.x, y: block.y, z: block.z }, dimId, zones);
    if (!areaMatch) continue;
    if (!match) {
      match = areaMatch;
      continue;
    }
    if (match.zone.id !== areaMatch.zone.id || match.area.id !== areaMatch.area.id) return undefined;
  }
  return match;
}

const COMMUNITY_SUPPLY_TYPES = Object.freeze({
  tnt: "minecraft:tnt",
  hueso: "minecraft:bone_meal",
});
const COMMUNITY_SUPPLY_REFILL_TICKS = 100; // 5 segundos
const PAID_FARM_SESSION_PROPERTY = "community_paid_farm_session_v1";
const PAID_FARM_DURATION_MS = 20 * 60 * 1000;

function getCommunitySupplyAt(pos, dimId, zones = loadZones()) {
  if (!pos || !dimId) return undefined;
  const x = Math.floor(Number(pos.x));
  const y = Math.floor(Number(pos.y));
  const z = Math.floor(Number(pos.z));
  if (![x, y, z].every(Number.isFinite)) return undefined;

  for (const zone of zones) {
    if (zone?.disabled || !(zone.isCommunity === true || zone.zoneType === "community") || zone.dimension !== dimId) continue;
    const supply = Array.isArray(zone.supplyChests) && zone.supplyChests.find((candidate) =>
      candidate && candidate.x === x && candidate.y === y && candidate.z === z &&
      COMMUNITY_SUPPLY_TYPES[candidate.type]
    );
    if (supply) return { zone, supply };
  }
  return undefined;
}

function isAdjacentToCommunitySupply(pos, dimId, zones = loadZones()) {
  for (const offset of [
    { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
  ]) {
    if (getCommunitySupplyAt({ x: pos.x + offset.x, y: pos.y + offset.y, z: pos.z + offset.z }, dimId, zones)) return true;
  }
  return false;
}

function isInsidePaidFarmArea(pos, dimId, parentZone, area) {
  if (!pos || !area?.min || !area?.max || !matchDimension(parentZone?.dimension, dimId)) return false;
  const x = Math.floor(Number(pos.x));
  const z = Math.floor(Number(pos.z));

  // Las zonas comunitarias cubren toda la altura del mundo. Mantener el
  // mismo criterio aquí evita expulsar al jugador justo después del TP cuando
  // su punto de entrada (o una plataforma segura) queda un bloque por encima
  // o por debajo de las dos esquinas usadas para crear la subzona.
  return [x, z].every(Number.isFinite) &&
    x >= area.min.x && x <= area.max.x && z >= area.min.z && z <= area.max.z;
}

function getPaidFarmAreaAt(pos, dimId, zones = loadZones()) {
  for (const zone of zones) {
    if (zone?.disabled || !(zone.isCommunity === true || zone.zoneType === "community") || !Array.isArray(zone.paidFarmAreas)) continue;
    const area = zone.paidFarmAreas.find((candidate) => isInsidePaidFarmArea(pos, dimId, zone, candidate));
    if (area) return { zone, area };
  }
  return undefined;
}

function findPaidFarmArea(areaId, zones = loadZones()) {
  for (const zone of zones) {
    const area = Array.isArray(zone?.paidFarmAreas) && zone.paidFarmAreas.find((candidate) => candidate?.id === areaId);
    if (area) return { zone, area };
  }
  return undefined;
}

function getPaidFarmButtonAt(pos, dimId, zones = loadZones()) {
  const x = Math.floor(Number(pos?.x)), y = Math.floor(Number(pos?.y)), z = Math.floor(Number(pos?.z));
  for (const zone of zones) {
    if (zone?.disabled || zone.dimension !== dimId || !Array.isArray(zone.paidFarmAreas)) continue;
    const area = zone.paidFarmAreas.find((candidate) => candidate?.button && candidate.button.x === x && candidate.button.y === y && candidate.button.z === z);
    if (area) return { zone, area };
  }
  return undefined;
}

function getPaidFarmSession(player) {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("protection_addon", player, PAID_FARM_SESSION_PROPERTY);
    return raw ? JSON.parse(String(raw)) : undefined;
  } catch { return undefined; }
}

function setPaidFarmSession(player, session) {
  try { globalThis.__sqlite_set_prop_v2__("protection_addon", player, PAID_FARM_SESSION_PROPERTY, session ? JSON.stringify(session) : undefined); } catch (e) {
    ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "setPaidFarmSession", category: "runtime" });
  }
}

function depositPaidFarmRevenue(amount) {
  try {
    const objective = world.scoreboard.getObjective("bank_vault") || world.scoreboard.addObjective("bank_vault", "Bank Vault");
    const key = "bank_vault_funds";
    const current = Number(objective.getScore(key) ?? 0);
    objective.setScore(key, Math.max(0, current) + amount);
  } catch (e) {
    console.warn(`[PAID_FARM] No se pudo acreditar ingreso al banco: ${e}`);
  }
}

function teleportToPaidFarmPoint(player, point, dimensionId) {
  try {
    const dimension = world.getDimension(dimensionId);
    player.teleport({ x: point.x, y: point.y, z: point.z }, { dimension });
    return true;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "teleportToPaidFarmPoint", category: "runtime" });
    return false;
  }
}

function handlePaidFarmButton(player, paidFarm) {
  const { zone, area } = paidFarm;
  const existingSession = getPaidFarmSession(player);
  if (existingSession && Number(existingSession.expiresAt || 0) > Date.now()) {
    player.sendMessage("§b§l[§dGranja§b§l]§r §eYa tienes un acceso temporal activo. No se realizó ningún cobro adicional.");
    return;
  }
  if (!area?.entry || !area?.lobby || !Number.isSafeInteger(Number(area.price)) || Number(area.price) <= 0) {
    player.sendMessage("§b§l[§dGranja§b§l]§r §cEsta granja de pago no está configurada correctamente.");
    return;
  }
  const price = Number(area.price);
  if (getBalance(player) < price) {
    player.sendMessage(`§b§l[§dGranja§b§l]§r §cNecesitas §e$${price}§c para usar esta granja.`);
    return;
  }
  if (!addBalance(player, -price)) {
    player.sendMessage("§b§l[§dGranja§b§l]§r §cNo se pudo confirmar el cobro.");
    return;
  }
  depositPaidFarmRevenue(price);
  const expiresAt = Date.now() + PAID_FARM_DURATION_MS;
  setPaidFarmSession(player, { areaId: area.id, expiresAt });
  if (!teleportToPaidFarmPoint(player, area.entry, zone.dimension)) {
    addBalance(player, price, { allowOverOperationalLimit: true });
    setPaidFarmSession(player, undefined);
    player.sendMessage("§b§l[§dGranja§b§l]§r §cNo se pudo teletransportar; el pago fue devuelto.");
    return;
  }
  console.warn(`[PAID_FARM] access player=${player.name} area=${area.id} price=${price} expires=${expiresAt}`);
  player.sendMessage(`§b§l[§dGranja§b§l]§r §aAcceso concedido por §e20 minutos§a. Se cobraron §e$${price}§a.`);
}

function refillCommunitySupplyChest(zone, supply) {
  try {
    const itemTypeId = COMMUNITY_SUPPLY_TYPES[supply?.type];
    if (!itemTypeId || zone?.disabled || !(zone.isCommunity === true || zone.zoneType === "community")) return;
    const dimension = world.getDimension(zone.dimension);
    const block = dimension?.getBlock({ x: supply.x, y: supply.y, z: supply.z });
    if (!block || (block.typeId !== "minecraft:chest" && block.typeId !== "minecraft:trapped_chest")) return;
    const container = block.getComponent("minecraft:inventory")?.container;
    if (!container) return;

    // El cofre es una fuente técnica: no conserva ni mezcla otros objetos.
    // Los embudos pueden extraerlo, mientras que los jugadores no pueden abrirlo.
    for (let slot = 0; slot < container.size; slot++) {
      const current = container.getItem(slot);
      if (current?.typeId === itemTypeId && current.amount === 64) continue;
      container.setItem(slot, new ItemStack(itemTypeId, 64));
    }
  } catch (e) {
    ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "refillCommunitySupplyChest", category: "runtime" });
  }
}

try {
  system.runInterval(() => {
    const zones = loadZones();
    for (const zone of zones) {
      if (!Array.isArray(zone?.supplyChests)) continue;
      for (const supply of zone.supplyChests) refillCommunitySupplyChest(zone, supply);
    }
  }, COMMUNITY_SUPPLY_REFILL_TICKS);
} catch (e) {
  ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "communitySupplyRefill", category: "runtime" });
}

try {
  system.runInterval(() => {
    const zones = loadZones();
    for (const player of world.getAllPlayers()) {
      if (isPlayerOp(player)) continue;
      const currentArea = getPaidFarmAreaAt(player.location, player.dimension.id, zones);
      const session = getPaidFarmSession(player);
      if (session) {
        const configured = findPaidFarmArea(session.areaId, zones);
        if (!configured || Date.now() >= Number(session.expiresAt || 0)) {
          if (configured?.area?.lobby) teleportToPaidFarmPoint(player, configured.area.lobby, configured.zone.dimension);
          setPaidFarmSession(player, undefined);
          player.sendMessage("§b§l[§dGranja§b§l]§r §eTu acceso de 20 minutos terminó. Regresaste a la sala.");
        } else if (!currentArea || currentArea.area.id !== session.areaId) {
          setPaidFarmSession(player, undefined);
          player.sendMessage("§b§l[§dGranja§b§l]§r §7Saliste de la granja; tu acceso temporal fue cancelado sin reembolso.");
        }
      } else if (currentArea?.area?.lobby) {
        teleportToPaidFarmPoint(player, currentArea.area.lobby, currentArea.zone.dimension);
        player.sendMessage("§b§l[§dGranja§b§l]§r §cDebes pagar en la sala para acceder a esta granja.");
      }
    }
  }, 20);
} catch (e) {
  ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "paidFarmAccessEnforcement", category: "runtime" });
}

// Las subáreas actuales se destinan a granjas de madera. Incluso una TNT
// autorizada solo puede talar los bloques de cultivo y nunca la maquinaria,
// cofres, redstone o la estructura de contención de la granja.
function isAutomationHarvestBlock(block) {
  const typeId = String(block?.typeId || "").toLowerCase();
  return typeId.endsWith("_log") ||
    typeId.endsWith("_wood") ||
    typeId.endsWith("_leaves") ||
    typeId.endsWith("_stem") ||
    typeId.endsWith("_hyphae") ||
    typeId === "minecraft:mangrove_roots" ||
    typeId === "minecraft:muddy_mangrove_roots" ||
    typeId === "minecraft:crimson_nylium" ||
    typeId === "minecraft:warped_nylium" ||
    typeId === "minecraft:mushroom_stem" ||
    typeId.endsWith("_mushroom_block");
}

function isCommunityLeafBlock(block) {
  return String(block?.typeId || block || "").toLowerCase().endsWith("_leaves");
}

function isCommunityTreePlant(typeId) {
  const normalized = String(typeId || "").toLowerCase();
  return normalized.endsWith("_sapling") ||
    normalized === "minecraft:mangrove_propagule" ||
    normalized === "minecraft:azalea" ||
    normalized === "minecraft:flowering_azalea";
}

function canPlantTreeInCommunityZone(pos, dimId, typeId) {
  if (!isCommunityTreePlant(typeId)) return false;
  const zones = getZonesAt(pos, dimId);
  // Nunca permite eludir una zona privada o administrativa que se solape.
  return zones.length > 0 && zones.every((zone) => zone.isCommunity === true || zone.zoneType === "community");
}

// Los troncos se procesan fuera del daño directo de la explosión para que la
// TNT no borre el recurso. Las hojas no se fuerzan: conservan su caída natural.
function isAutomationGuaranteedYieldBlock(block) {
  const typeId = String(block?.typeId || "").toLowerCase();
  return typeId.endsWith("_log") ||
    typeId.endsWith("_wood") ||
    typeId.endsWith("_stem") ||
    typeId.endsWith("_hyphae") ||
    typeId === "minecraft:mangrove_roots" ||
    typeId === "minecraft:muddy_mangrove_roots" ||
    typeId === "minecraft:mushroom_stem";
}

function harvestAutomationExplosionBlocks(dimension, snapshots) {
  system.run(() => {
    for (const snapshot of snapshots) {
      try {
        const block = dimension.getBlock(snapshot.location);
        if (!block || block.typeId !== snapshot.typeId || !isAutomationGuaranteedYieldBlock(block)) continue;
        block.setType("minecraft:air");
        dimension.spawnItem(new ItemStack(snapshot.typeId, 1), {
          x: snapshot.location.x + 0.5,
          y: snapshot.location.y + 0.5,
          z: snapshot.location.z + 0.5,
        });
      } catch (e) {
        ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "harvestAutomationExplosionBlocks", category: "runtime" });
      }
    }
  });
}

function canBreakCommunityHarvestWood(player, block, pos, dimId) {
  if (!isAutomationHarvestBlock(block)) return false;
  // Los troncos son el recurso de las granjas comunitarias; las hojas forman
  // parte de su estructura y no se pueden talar ni usar como botín.
  if (isCommunityLeafBlock(block)) return false;
  const zones = getZonesAt(pos, dimId);
  if (zones.length === 0 || !zones.every((zone) => zone.isCommunity === true || zone.zoneType === "community")) return false;
  const paidFarm = getPaidFarmAreaAt(pos, dimId, zones);
  if (!paidFarm) return true;
  const session = getPaidFarmSession(player);
  return session?.areaId === paidFarm.area.id && Number(session.expiresAt || 0) > Date.now();
}

function isProtectedZoneAt(pos, dimId) {
  if (!pos || !dimId) return false;
  try {
    return getZonesAt(pos, dimId).length > 0;
  } catch (error) {
    ErrorReporter.report(error, { addonId: "protection_addon", moduleId: "main.js", operation: "isProtectedZoneAt", category: "runtime" });
    return true;
  }
}

function isCommunityOrAdminZone(zone) {
  return Boolean(zone) && zone.disabled !== true && (
    zone.isAdmin === true || zone.isCommunity === true || zone.zoneType === "community"
  );
}

function isRestrictedLiquidBucket(itemId) {
  const normalized = String(itemId || "").toLowerCase();
  return normalized === "minecraft:water_bucket" || normalized === "minecraft:lava_bucket";
}

function isRestrictedLiquidBlock(typeId) {
  const normalized = String(typeId || "").toLowerCase();
  return normalized === "minecraft:water" || normalized === "minecraft:flowing_water" ||
    normalized === "minecraft:lava" || normalized === "minecraft:flowing_lava";
}

function isRestrictedLiquidZoneAt(pos, dimId) {
  try {
    return getZonesAt(pos, dimId).some(isCommunityOrAdminZone);
  } catch (error) {
    ErrorReporter.report(error, { addonId: "protection_addon", moduleId: "main.js", operation: "isRestrictedLiquidZoneAt", category: "runtime" });
    return true;
  }
}

function removeWitherInProtectedZone(entity, source) {
  try {
    if (!entity || entity.typeId !== "minecraft:wither" || entity.isValid === false) return false;
    const location = entity.location;
    const dimensionId = entity.dimension?.id;
    if (!isProtectedZoneAt(location, dimensionId)) return false;
    entity.remove();
    console.warn(`[WITHER_GUARD] removed source=${source} dimension=${dimensionId} x=${Math.floor(location.x)} y=${Math.floor(location.y)} z=${Math.floor(location.z)}`);
    return true;
  } catch (error) {
    ErrorReporter.report(error, { addonId: "protection_addon", moduleId: "main.js", operation: `witherGuard:${source}`, category: "runtime" });
    return false;
  }
}

function isColiseumZone(zone) {
  return zone?.zoneType === "coliseum";
}

function findOnlinePlayerByName(targetName) {
  const normalized = String(targetName || "").trim().toLowerCase();
  if (!normalized) return null;

  const players = world.getAllPlayers();
  let target = players.find((player) => player.name.toLowerCase() === normalized);
  if (target) return target;

  const partial = players.filter((player) => player.name.toLowerCase().includes(normalized));
  if (partial.length === 1) return partial[0];
  return partial.length > 1 ? "multiple" : null;
}

function getColiseumZoneByName(name = "") {
  const zones = loadZones().filter(isColiseumZone);
  if (zones.length === 0) return null;
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) {
    const activeColiseumId = getActiveColiseumId();
    if (activeColiseumId) {
      const activeZone = zones.find((zone) => String(zone.id) === activeColiseumId);
      if (activeZone && hasConfiguredColiseumSpawns(activeZone)) return activeZone;
    }
    return zones.sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0)).find(hasConfiguredColiseumSpawns) || zones[0];
  }
  return zones.find((zone) => zone.name.toLowerCase() === normalized) || null;
}

function getColiseumSpawnPositions(zone) {
  if (zone?.spawn1 && zone?.spawn2) {
    return {
      a: { x: zone.spawn1.x, y: zone.spawn1.y, z: zone.spawn1.z },
      b: { x: zone.spawn2.x, y: zone.spawn2.y, z: zone.spawn2.z },
    };
  }

  const centerX = Math.floor((zone.min.x + zone.max.x) / 2);
  const centerY = Math.min(zone.max.y, zone.min.y + 1);
  const centerZ = Math.floor((zone.min.z + zone.max.z) / 2);
  const offset = Math.max(2, Math.floor((zone.max.x - zone.min.x) / 4));

  return {
    a: { x: centerX - offset, y: centerY, z: centerZ },
    b: { x: centerX + offset, y: centerY, z: centerZ },
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

function formatDebugLocation(location) {
  if (!location) return "sin definir";
  const x = Number(location.x);
  const y = Number(location.y);
  const z = Number(location.z);
  const dim = String(location.dimension || "").trim() || "sin-dimension";
  return `${Number.isFinite(x) ? x : "?"}, ${Number.isFinite(y) ? y : "?"}, ${Number.isFinite(z) ? z : "?"} | ${dim}`;
}

function handleColiseumDebug(player) {
  if (!isPlayerOp(player)) {
    player.sendMessage("§b§l[§4ColiseoDebug§b§l]§r §cSolo operadores pueden usar este comando.");
    return;
  }

  const zones = loadZones().filter(isColiseumZone).sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));
  const activeColiseumId = getActiveColiseumId();
  const activeZone = zones.find((zone) => String(zone.id) === activeColiseumId) || null;
  const bountySession = loadBountyColiseumSession();

  player.sendMessage("§8========== §4Coliseo Debug §8==========");
  player.sendMessage(`§7Coliseos registrados: §e${zones.length}`);
  player.sendMessage(`§7Coliseo activo ID: §e${activeColiseumId || "sin definir"}`);

  if (activeZone) {
    player.sendMessage(`§7Activo: §e${activeZone.name} §7(ID: ${activeZone.id})`);
    player.sendMessage(`§7Dimensión: §f${activeZone.dimension}`);
    player.sendMessage(`§7Spawn c1: §f${formatDebugLocation(activeZone.spawn1)}`);
    player.sendMessage(`§7Spawn c2: §f${formatDebugLocation(activeZone.spawn2)}`);
    player.sendMessage(`§7Tiene c1/c2: ${hasConfiguredColiseumSpawns(activeZone) ? "§aSI" : "§cNO"}`);
  } else {
    player.sendMessage("§7Activo: §cNo se encontró un coliseo activo válido.");
  }

  if (bountySession) {
    player.sendMessage(`§7Bounty session: §aACTIVA`);
    player.sendMessage(`§7Objetivo: §c${bountySession.targetName || "desconocido"}`);
    player.sendMessage(`§7Coliseo bounty: §e${bountySession.zoneName || "sin nombre"} §7(ID: ${bountySession.zone?.id || "sin id"})`);
    player.sendMessage(`§7Spawn bounty: §f${formatDebugLocation(bountySession.targetSpawn)}`);
  } else {
    player.sendMessage("§7Bounty session: §8sin sesión activa");
  }

  const standingZone = getColiseumAtPlayer(player);
  if (standingZone) {
    player.sendMessage(`§7Estás dentro de: §e${standingZone.name} §7(ID: ${standingZone.id})`);
  } else {
    player.sendMessage("§7No estás parado dentro de un coliseo.");
  }
  player.sendMessage("§8====================================");
}

function getColiseumWarmupState(player) {
  const key = String(player?.name || "").toLowerCase();
  if (!key) return null;
  const state = coliseumCombatWarmups.get(key);
  if (!state) return null;
  if (Date.now() >= Number(state.expiresAt || 0)) {
    coliseumCombatWarmups.delete(key);
    return null;
  }
  return state;
}

function startColiseumCombatWarmup(match) {
  const expiresAt = Date.now() + COLISEUM_START_DELAY_MS;
  for (const playerName of [match.playerAName, match.playerBName]) {
    const key = playerName.toLowerCase();
    coliseumCombatWarmups.set(key, {
      matchId: match.id,
      expiresAt,
    });
  }

  const announceTick = (secondsLeft) => {
    for (const playerName of [match.playerAName, match.playerBName]) {
      const player = world.getAllPlayers().find((candidate) => candidate.name === playerName);
      if (!player) continue;
      try {
        if (secondsLeft > 0) {
          player.sendMessage(`§b§l[§4Coliseo§b§l]§r §eEl combate comienza en §c${secondsLeft}§e segundos. No pueden golpearse todavía.`);
        } else {
          player.sendMessage("§b§l[§4Coliseo§b§l]§r §aCombate habilitado. ¡Luchen!");
        }
      } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
    }
  };

  for (let second = 10; second >= 1; second--) {
    system.runTimeout(() => {
      if (!activeColiseumMatches.has(match.id)) return;
      announceTick(second);
    }, (10 - second) * 20);
  }

  system.runTimeout(() => {
    if (!activeColiseumMatches.has(match.id)) return;
    coliseumCombatWarmups.delete(match.playerAName.toLowerCase());
    coliseumCombatWarmups.delete(match.playerBName.toLowerCase());
    announceTick(0);
  }, 10 * 20);
}

function getColiseumAtPlayer(player) {
  const zones = loadZones().filter((zone) =>
    isColiseumZone(zone) &&
    player.dimension.id === zone.dimension &&
    player.location.x >= zone.min.x &&
    player.location.x <= zone.max.x &&
    player.location.z >= zone.min.z &&
    player.location.z <= zone.max.z
  );
  return zones.sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0))[0] || null;
}

function serializeLocation(location, dimensionId) {
  return {
    x: location.x,
    y: location.y,
    z: location.z,
    dimension: dimensionId,
  };
}

function snapshotBlock(block) {
  if (!block) return { typeId: "minecraft:air", states: {} };
  try {
    return {
      typeId: block.typeId,
      states: block.permutation?.getAllStates?.() || {},
    };
  } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return {
      typeId: block.typeId || "minecraft:air",
      states: {},
    };
  }
}

function snapshotColiseumZone(zone, snapshotId) {
  const dimension = world.getDimension(zone.dimension);
  if (!dimension || !snapshotId) return null;
  
  try {
    const result = dimension.runCommand(`structure save "${snapshotId}" ${zone.min.x} ${zone.min.y} ${zone.min.z} ${zone.max.x} ${zone.max.y} ${zone.max.z}`);
    if (result?.successCount === 0) throw new Error("structure save no modifico ninguna estructura");
    return snapshotId;
  } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn(`[Coliseo] Error guardando estructura: ${e}`);
    return null;
  }
}

function restoreColiseumSnapshot(zone, snapshotId, onComplete = undefined) {
  if (!zone || !zone.dimension) {
    if (onComplete) onComplete(false);
    return;
  }
  const dimension = world.getDimension(zone.dimension);
  if (!dimension || !snapshotId) {
    if (onComplete) onComplete(false);
    return;
  }

  let restored = false;
  try {
    // block_by_block es para cargar con cuidado si es muy grande, pero load lo hace instantáneamente.
    const result = dimension.runCommand(`structure load "${snapshotId}" ${zone.min.x} ${zone.min.y} ${zone.min.z}`);
    if (result?.successCount === 0) throw new Error("structure load no restauro bloques");
    restored = true;
  } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn(`[Coliseo] Error cargando estructura: ${e}`);
  }

  if (restored) {
    try {
      dimension.runCommand(`structure delete "${snapshotId}"`);
    } catch (e) {
      ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "deleteColiseumSnapshot", category: "runtime" });
    }
  }
  if (onComplete) onComplete(restored);
}

function getActiveColiseumMatchForPlayer(player) {
  return playerActiveColiseumMatch.get(player?.name?.toLowerCase?.() || "") || null;
}

function getDamageSourcePlayer(damageSource) {
  const direct = damageSource?.damagingEntity;
  if (direct?.typeId === "minecraft:player") return direct;
  try {
    const projectile = damageSource?.damagingProjectile || direct;
    const owner = projectile?.getComponent?.("minecraft:projectile")?.owner;
    return owner?.typeId === "minecraft:player" ? owner : undefined;
  } catch (error) {
    ErrorReporter.report(error, { addonId: "protection_addon", moduleId: "main.js", operation: "getDamageSourcePlayer", category: "runtime" });
    return undefined;
  }
}

function isAuthorizedColiseumDuelPair(attacker, victim) {
  const attackerMatchId = getActiveColiseumMatchForPlayer(attacker);
  const victimMatchId = getActiveColiseumMatchForPlayer(victim);
  if (!attackerMatchId || attackerMatchId !== victimMatchId) return false;
  const match = activeColiseumMatches.get(attackerMatchId);
  if (!match || match.ending) return false;
  const names = new Set([String(match.playerAName).toLowerCase(), String(match.playerBName).toLowerCase()]);
  if (!names.has(String(attacker.name).toLowerCase()) || !names.has(String(victim.name).toLowerCase())) return false;
  try {
    return isInside(attacker.location, attacker.dimension.id, match.zone) &&
      isInside(victim.location, victim.dimension.id, match.zone);
  } catch (error) {
    ErrorReporter.report(error, { addonId: "protection_addon", moduleId: "main.js", operation: "isAuthorizedColiseumDuelPair", category: "runtime" });
    return false;
  }
}

function isColiseumDuelContext(attacker, victim) {
  if (getActiveColiseumMatchForPlayer(attacker) || getActiveColiseumMatchForPlayer(victim)) return true;
  try {
    return Boolean(getColiseumAtPlayer(attacker) || getColiseumAtPlayer(victim));
  } catch (error) {
    ErrorReporter.report(error, { addonId: "protection_addon", moduleId: "main.js", operation: "isColiseumDuelContext", category: "runtime" });
    return true;
  }
}

function getActiveColiseumMatchAt(pos, dimId) {
  for (const match of activeColiseumMatches.values()) {
    if (isInside(pos, dimId, match.zone)) return match;
  }
  return null;
}

function teleportPlayerToSavedLocation(playerName, savedLocation) {
  if (!savedLocation) return;
  const player = world.getAllPlayers().find((candidate) => candidate.name.toLowerCase() === String(playerName).toLowerCase());
  if (!player) return;
  try {
    const dimension = world.getDimension(savedLocation.dimension);
    grantTemporaryTeleportExemption(player);
    player.teleport(getSafeTeleportPosition(dimension, savedLocation), { dimension });
  } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    runTeleportFallback(player, savedLocation, savedLocation.dimension);
  }
  system.runTimeout(() => {
    try {
      if (player.dimension.id !== savedLocation.dimension || Math.abs(player.location.x - savedLocation.x) > 10) {
        runTeleportFallback(player, savedLocation, savedLocation.dimension);
      }
    } catch (err) { ErrorReporter.report(err, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }, 2);
}

function finalizeColiseumMatch(matchId, message, loserName = "", winnerName = "") {
  const match = activeColiseumMatches.get(matchId);
  if (!match || match.ending) return;
  match.ending = true;

  coliseumCombatWarmups.delete(match.playerAName.toLowerCase());
  coliseumCombatWarmups.delete(match.playerBName.toLowerCase());
  playerActiveColiseumMatch.delete(match.playerAName.toLowerCase());
  playerActiveColiseumMatch.delete(match.playerBName.toLowerCase());
  const cooldownRecorded = recordColiseumCompletion(match);

  restoreColiseumSnapshot(match.zone, match.zoneSnapshot, (restored) => {
    activeColiseumMatches.delete(matchId);
    const zoneKey = String(match.zone.id);
    if (restored) {
      if (activeColiseumZoneMatches.get(zoneKey) === matchId) activeColiseumZoneMatches.delete(zoneKey);
    } else {
      quarantinedColiseumZones.add(zoneKey);
      console.warn(`[ANTIDUPE_CRITICAL] coliseum_restore_failed zone=${zoneKey} match=${matchId}; zone quarantined`);
    }
    if (winnerName && match.entryFeesPaid && cooldownRecorded) {
      const winner = world.getAllPlayers().find((player) => player.name === winnerName);
      if (winner) {
        const paid = addBalance(winner, COLISEUM_PVP_REWARD);
        try {
          winner.sendMessage(paid
            ? `§b§l[§4Coliseo§b§l]§r §aHas recibido §6$${COLISEUM_PVP_REWARD} §adel fondo de entradas.`
            : "§b§l[§4Coliseo§b§l]§r §cNo se pudo acreditar el premio. Contacta a un administrador.");
        } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
      }
    }

    teleportPlayerToSavedLocation(match.playerAName, match.returnLocations[match.playerAName.toLowerCase()]);
    teleportPlayerToSavedLocation(match.playerBName, match.returnLocations[match.playerBName.toLowerCase()]);

    const players = world.getAllPlayers();
    for (const player of players) {
      if (player.name === match.playerAName || player.name === match.playerBName || player.name === loserName) {
        try {
          player.sendMessage(message);
        } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
      }
    }
  });
}

function startColiseumMatch(requester, target, zone, requesterOrigin, targetOrigin, entryFeesPaid = false) {
  const matchId = `${zone.name.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const zoneKey = String(zone.id);
  if (activeColiseumZoneMatches.has(zoneKey) || quarantinedColiseumZones.has(zoneKey)) return null;
  activeColiseumZoneMatches.set(zoneKey, matchId);
  const safeSnapshotId = `coliseum_${zoneKey.replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const zoneSnapshot = snapshotColiseumZone(zone, safeSnapshotId);
  if (!zoneSnapshot) {
    activeColiseumZoneMatches.delete(zoneKey);
    return null;
  }
  const match = {
    id: matchId,
    zone,
    zoneSnapshot,
    playerAName: requester.name,
    playerBName: target.name,
    returnLocations: {
      [requester.name.toLowerCase()]: requesterOrigin,
      [target.name.toLowerCase()]: targetOrigin,
    },
    entryFeesPaid: entryFeesPaid === true,
    ending: false,
  };

  activeColiseumMatches.set(matchId, match);
  playerActiveColiseumMatch.set(requester.name.toLowerCase(), matchId);
  playerActiveColiseumMatch.set(target.name.toLowerCase(), matchId);
  return match;
}

// Validar permisos de construcción/interacción
function checkPermission(player, pos, dimId, actionType = "build") {
  if (isPlayerOp(player)) return true;

  const zones = getZonesAt(pos, dimId);
  if (!zones || zones.length === 0) return true;

  if (zones.some(isColiseumZone)) {
    if (getActiveColiseumMatchForPlayer(player)) return true;
    return false;
  }

  // Si hay alguna zona, el jugador debe tener permiso en ella
  for (const zone of zones) {
    if (zone.isCommunity && actionType === "interact") continue;
    if (zone.isAdmin) return false; // Zonas admin son intocables por no-ops
    
    if (hasZoneAccess(player, zone)) continue;

    return false; // Sin permisos
  }
  return true;
}

function isPrivateClaimZone(zone) {
  return Boolean(zone) && !zone.disabled && !zone.isAdmin && !zone.isCommunity && !isColiseumZone(zone);
}

function hasPrivateZoneAccess(player, zone) {
  return hasZoneAccess(player, zone);
}

function ejectFromPrivateZone(player, zone) {
  const diagnosticKey = `${normalizeZonePlayerName(player?.name)}|${String(zone?.id)}`;
  const now = Date.now();
  if ((privateEjectionDiagnostics.get(diagnosticKey) || 0) + 30000 <= now) {
    privateEjectionDiagnostics.set(diagnosticKey, now);
    console.warn(`[Protección] Expulsión privada player=${player?.name} zone=${zone?.name || "sin_nombre"} id=${zone?.id} owner=${zone?.owner} trusted=${JSON.stringify(zone?.trusted || [])}`);
  }
  const x = player.location.x;
  const z = player.location.z;
  const distances = [
    { distance: Math.abs(x - zone.min.x), x: zone.min.x - 2, z },
    { distance: Math.abs(x - zone.max.x), x: zone.max.x + 2, z },
    { distance: Math.abs(z - zone.min.z), x, z: zone.min.z - 2 },
    { distance: Math.abs(z - zone.max.z), x, z: zone.max.z + 2 }
  ];
  const destination = distances.reduce((nearest, candidate) => candidate.distance < nearest.distance ? candidate : nearest);
  const safePosition = getSafeTeleportPosition(player.dimension, { x: destination.x, y: player.location.y, z: destination.z });
  grantTemporaryTeleportExemption(player);
  player.teleport(safePosition, { dimension: player.dimension });
  player.sendMessage(`§b§l[§3Protección§b§l]§r §cNo tienes permiso para entrar al terreno §e${zone.name || "privado"}§c.`);
}

// --- INTERCEPTACIÓN DE EVENTOS (BEFOREEVENTS) ---

// 1. Bloquear ruptura de bloques
try {
  world.beforeEvents.playerBreakBlock.subscribe((event) => {
    try {
      const player = event.player;
      const block = event.block;
      const loc = { x: block.x, y: block.y, z: block.z };
      const paidFarmButton = getPaidFarmButtonAt(loc, block.dimension.id);
      if (paidFarmButton) {
        event.cancel = true;
        maybeWarnProtection(player, "§b§l[§dGranja§b§l]§r §cNo puedes romper un botón de pago.");
        return;
      }
      if (getCommunitySupplyAt(loc, block.dimension.id)) {
        event.cancel = true;
        maybeWarnProtection(player, "§b§l[§3Suministros§b§l]§r §cNo puedes romper un cofre de suministro comunitario.");
        return;
      }
      if (isAutomationSupplyMachine(block, loc, block.dimension.id)) {
        event.cancel = true;
        maybeWarnProtection(player, "§b§l[§3Suministros§b§l]§r §cNo puedes romper dispensadores ni soltadores de la automatización.");
        return;
      }
      if (block.typeId === "minecraft:hopper" && isAdjacentToCommunitySupply(loc, block.dimension.id)) {
        event.cancel = true;
        maybeWarnProtection(player, "§b§l[§3Suministros§b§l]§r §cNo puedes retirar el embudo conectado a un cofre de suministro.");
        return;
      }
      if (getActiveColiseumMatchAt(loc, block.dimension.id) && isColiseumContainerBlock(block)) {
        event.cancel = true;
        maybeWarnProtection(player, "§b§l[§4Coliseo§b§l]§r §cLos contenedores no pueden romperse durante un duelo.");
        return;
      }
      const zonesAtBlock = getZonesAt(loc, block.dimension.id);
      if (isCommunityLeafBlock(block) && zonesAtBlock.length > 0 && zonesAtBlock.every((zone) => zone.isCommunity === true || zone.zoneType === "community")) {
        event.cancel = true;
        maybeWarnProtection(player, "§b§l[§3Protección§b§l]§r §cNo puedes destruir las hojas de los árboles comunitarios.");
        return;
      }
      if (canBreakCommunityHarvestWood(player, block, loc, block.dimension.id)) return;
      if (canPlaceShulkerInCommunityZone(loc, block.dimension.id, block.typeId)) return;
      if (!checkPermission(player, loc, block.dimension.id, "break")) {
        event.cancel = true;
        maybeWarnProtection(player, "§b§l[§3Protección§b§l]§r §cEste terreno está protegido.");
      }
    } catch (innerErr) {
      ErrorReporter.report(innerErr, { addonId: "protection_addon", moduleId: "main.js", operation: "playerBreakBlock", category: "runtime" });
    }
  });
} catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("Error suscribiendo BreakBlock: " + e);
}

try {
  const boundaryMarkerBreakEvent = world.afterEvents?.playerBreakBlock;
  if (boundaryMarkerBreakEvent && typeof boundaryMarkerBreakEvent.subscribe === "function") {
    boundaryMarkerBreakEvent.subscribe((event) => {
      const block = event.block;
      if (block?.dimension?.id) removeBoundaryMarkerAt(block.dimension.id, block);
    });
  }
} catch (e) {
  ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "boundaryMarkerBreak", category: "runtime" });
}

// 2. Bloquear colocación de bloques
try {
  const placeBlockBeforeEvent = world.beforeEvents?.playerPlaceBlock || world.beforeEvents?.playerPlaceBlockBefore;
  if (placeBlockBeforeEvent && typeof placeBlockBeforeEvent.subscribe === "function") {
    placeBlockBeforeEvent.subscribe((event) => {
      try {
        const player = event.player;
        const block = event.block;
        const loc = { x: block.x, y: block.y, z: block.z };
        const matchId = getActiveColiseumMatchForPlayer(player);
        if (matchId && isColiseumContainerBlock(block)) {
          event.cancel = true;
          maybeWarnProtection(player, "§b§l[§4Coliseo§b§l]§r §cNo puedes colocar contenedores durante un duelo.");
          return;
        }
        if (matchId) return;
        const placedTypeId = String(
          event.permutationBeingPlaced?.type?.id ||
          event.permutationToPlace?.type?.id ||
          event.itemStack?.typeId ||
          event.item?.typeId ||
          event.permutation?.type?.id ||
          block.typeId || ""
        ).toLowerCase();
        const isBoundaryMarker = isBoundaryMarkerItem(event.itemStack || event.item);

        if (isRestrictedLiquidBlock(placedTypeId) && isRestrictedLiquidZoneAt(loc, block.dimension.id)) {
          event.cancel = true;
          maybeWarnProtection(player, "§b§l[§3Protección§b§l]§r §cEl agua y la lava están prohibidas en zonas comunitarias y admin.");
          return;
        }

        if (placedTypeId === "minecraft:hopper" && isAdjacentToCommunitySupply(loc, block.dimension.id)) {
          event.cancel = true;
          maybeWarnProtection(player, "§b§l[§3Suministros§b§l]§r §cNo puedes conectar un embudo nuevo a un cofre de suministro bloqueado.");
          return;
        }
        if (canPlantTreeInCommunityZone(loc, block.dimension.id, placedTypeId)) return;
        if (canPlaceShulkerInCommunityZone(loc, block.dimension.id, placedTypeId)) return;
        if (!checkPermission(player, loc, block.dimension.id, "place")) {
          event.cancel = true;
          maybeWarnProtection(player, "§b§l[§3Protección§b§l]§r §cEste terreno está protegido.");
          return;
        }
        if (isBoundaryMarker) scheduleBoundaryMarkerPreview(player, block);
      } catch (innerErr) {
        ErrorReporter.report(innerErr, { addonId: "protection_addon", moduleId: "main.js", operation: "playerPlaceBlock", category: "runtime" });
      }
    });
  } else {
    const placeBlockAfterEvent = world.afterEvents?.playerPlaceBlock || world.afterEvents?.playerPlaceBlockAfter;
    if (!placeBlockAfterEvent || typeof placeBlockAfterEvent.subscribe !== "function") {
      throw new Error("No hay evento compatible para playerPlaceBlock en esta build.");
    }
    console.warn("[Protección] Usando fallback afterEvents para colocación de bloques.");
    placeBlockAfterEvent.subscribe((event) => {
      const player = event.player;
      const block = event.block;
      if (block?.typeId === "minecraft:hopper" && isAdjacentToCommunitySupply({ x: block.x, y: block.y, z: block.z }, block.dimension.id)) {
        try {
          block.setType("minecraft:air");
        } catch (err) {
          ErrorReporter.report(err, { addonId: "protection_addon", moduleId: "main.js", operation: "removeSupplyAdjacentHopper", category: "runtime" });
        }
        maybeWarnProtection(player, "§b§l[§3Suministros§b§l]§r §cNo puedes conectar un embudo nuevo a un cofre de suministro bloqueado.");
        return;
      }
      const matchId = getActiveColiseumMatchForPlayer(player);
      if (matchId && isColiseumContainerBlock(block)) {
        try {
          block.setType("minecraft:air");
        } catch (err) {
          ErrorReporter.report(err, { addonId: "protection_addon", moduleId: "main.js", operation: "removeColiseumContainer", category: "runtime" });
        }
        maybeWarnProtection(player, "§b§l[§4Coliseo§b§l]§r §cNo puedes colocar contenedores durante un duelo.");
        return;
      }
      if (matchId) return;
      if (canPlantTreeInCommunityZone(block.location, block.dimension.id, block.typeId)) return;
      if (canPlaceShulkerInCommunityZone(block.location, block.dimension.id, block.typeId)) return;
      if (!checkPermission(player, block.location, block.dimension.id, "place")) {
        system.run(() => {
          try {
            block.setType("minecraft:air");
          } catch (err) { ErrorReporter.report(err, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
            console.warn(`[Protección] Error revirtiendo bloque colocado: ${err}`);
          }
          maybeWarnProtection(player, "§b§l[§3Protección§b§l]§r §cEste terreno está protegido.");
        });
      }
    });
  }
} catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("Error suscribiendo PlaceBlock: " + e);
}

// 3. Bloquear interacciones (Cofres, puertas, palancas, etc.)
try {
  world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    try {
      const player = event.player;
      const block = event.block;
      const loc = { x: block.x, y: block.y, z: block.z };
      if (String(block.typeId || "").toLowerCase().includes("sign") && !isPlayerOp(player) && isLockedSignAt(loc, block.dimension.id)) {
        event.cancel = true;
        maybeWarnProtection(player, "§b§l[§3Protección§b§l]§r §cLos carteles protegidos no pueden modificarse.");
        return;
      }
      if (isPublicAdminButton(block, loc, block.dimension.id)) return;
      if (getCommunitySupplyAt(loc, block.dimension.id)) {
        event.cancel = true;
        maybeWarnProtection(player, "§b§l[§3Suministros§b§l]§r §eEste cofre técnico está bloqueado y abastece la automatización comunitaria.");
        return;
      }
      if (isAutomationSupplyMachine(block, loc, block.dimension.id)) {
        event.cancel = true;
        maybeWarnProtection(player, "§b§l[§3Suministros§b§l]§r §eLos dispensadores y soltadores de automatización están bloqueados.");
        return;
      }
      if (block.typeId === "minecraft:hopper" && isAdjacentToCommunitySupply(loc, block.dimension.id)) {
        event.cancel = true;
        maybeWarnProtection(player, "§b§l[§3Suministros§b§l]§r §eEl embudo conectado a este suministro está bloqueado.");
        return;
      }
      const activeMatch = getActiveColiseumMatchAt(loc, block.dimension.id);
      if (activeMatch && (isColiseumContainerBlock(block) || isColiseumContainerItem(event.itemStack?.typeId))) {
        event.cancel = true;
        maybeWarnProtection(player, "§b§l[§4Coliseo§b§l]§r §cLos contenedores estan bloqueados mientras el coliseo se restaura por snapshot.");
        return;
      }
      const currentZones = getZonesAt(loc, block.dimension.id);
      const allowDoor = isDoorOrGateBlock(block) && currentZones.some(z => z.flags?.visitor_doors === true);
      if (isProtectedBlockInteraction(block) && !allowDoor && !checkPermission(player, loc, block.dimension.id, "interact")) {
        event.cancel = true;
        maybeWarnProtection(player, "§b§l[§3Protección§b§l]§r §cNo puedes interactuar con esto aquí.");
      }
    } catch (innerErr) {
      ErrorReporter.report(innerErr, { addonId: "protection_addon", moduleId: "main.js", operation: "playerInteractWithBlock", category: "runtime" });
    }
  });
} catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("Error suscribiendo InteractWithBlock: " + e);
}

// Algunas variantes de botón no llegan a playerInteractWithBlock en BDS.
// Este evento específico garantiza que el cobro/teletransporte se procese.
try {
  const buttonPushEvent = world.afterEvents?.buttonPush;
  if (buttonPushEvent && typeof buttonPushEvent.subscribe === "function") {
    buttonPushEvent.subscribe((event) => {
      const player = event.source || event.player;
      const block = event.block || event.buttonBlock;
      if (!player || !block) return;
      const paidFarmButton = getPaidFarmButtonAt({ x: block.x, y: block.y, z: block.z }, block.dimension.id);
      if (!paidFarmButton) return;
      console.warn(`[PAID_FARM] button_push player=${player.name} area=${paidFarmButton.area.id} at=${block.x},${block.y},${block.z}`);
      system.run(() => handlePaidFarmButton(player, paidFarmButton));
    });
  }
} catch (e) {
  ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "paidFarmButtonPush", category: "runtime" });
}

const faceOffsets = {
  North: { x: 0, y: 0, z: -1 },
  South: { x: 0, y: 0, z: 1 },
  East: { x: 1, y: 0, z: 0 },
  West: { x: -1, y: 0, z: 0 },
  Up: { x: 0, y: 1, z: 0 },
  Down: { x: 0, y: -1, z: 0 }
};

// 3.1. Bloquear uso de cubetas y colocación de agua/lava en zonas protegidas
try {
  const interactItemEvent =
    world.beforeEvents?.itemUseOn ||
    world.beforeEvents?.playerInteractWithBlock;

  if (interactItemEvent && typeof interactItemEvent.subscribe === "function") {
    interactItemEvent.subscribe((event) => {
      const player = event.source || event.player;
      const block = event.block;
      const itemStack = event.itemStack || event.item;

      if (!player || !block || !itemStack) return;

      const itemId = String(itemStack.typeId || "").toLowerCase();
      const isLiquidBucket =
        itemId === "minecraft:water_bucket" ||
        itemId === "minecraft:lava_bucket" ||
        itemId === "minecraft:powder_snow_bucket" ||
        itemId === "minecraft:cod_bucket" ||
        itemId === "minecraft:salmon_bucket" ||
        itemId === "minecraft:tropical_fish_bucket" ||
        itemId === "minecraft:pufferfish_bucket" ||
        itemId === "minecraft:axolotl_bucket" ||
        itemId === "minecraft:tadpole_bucket";

      const dimId = block.dimension.id;
      const loc = { x: block.x, y: block.y, z: block.z };
      const offset = faceOffsets[event.blockFace] || { x: 0, y: 0, z: 0 };
      const targetLoc = { x: block.x + offset.x, y: block.y + offset.y, z: block.z + offset.z };

      if (isRestrictedLiquidBucket(itemId) && (
        isRestrictedLiquidZoneAt(loc, dimId) || isRestrictedLiquidZoneAt(targetLoc, dimId)
      )) {
        event.cancel = true;
        maybeWarnProtection(player, "§b§l[§3Protección§b§l]§r §cEl agua y la lava están prohibidas en zonas comunitarias y admin.");
        return;
      }

      const isFireStarter = 
        itemId === "minecraft:flint_and_steel" ||
        itemId === "minecraft:fire_charge";

      if (!isLiquidBucket && !isFireStarter) return;
      if (getActiveColiseumMatchForPlayer(player)) return;

      if (isFireStarter && getZonesAt(block.location, dimId).every((zone) => zone.isCommunity === true || zone.zoneType === "community")) {
        event.cancel = true;
        maybeWarnProtection(player, "§b§l[§3Protección§b§l]§r §cNo puedes iniciar incendios en una zona comunitaria.");
        return;
      }

      const hasSourcePerm = checkPermission(player, loc, dimId, "use");
      const hasTargetPerm = checkPermission(player, targetLoc, dimId, "use");

      if (!hasSourcePerm || !hasTargetPerm) {
        event.cancel = true;
        maybeWarnProtection(player, "§b§l[§3Protección§b§l]§r §cNo puedes usar cubetas ni iniciar incendios en esta zona protegida.");
      }
    });
  }
} catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("Error suscribiendo ItemUseOn para cubetas: " + e);
}

try {
  const itemUseEvent = world.beforeEvents?.itemUse;
  if (itemUseEvent && typeof itemUseEvent.subscribe === "function") {
    itemUseEvent.subscribe((event) => {
      const player = event.source || event.player;
      const itemStack = event.itemStack || event.item;
      if (!player || !itemStack) return;

      const itemId = String(itemStack.typeId || "").toLowerCase();
      if (!itemId.includes("bucket")) return;
      if (getActiveColiseumMatchForPlayer(player)) return;

      const loc = { x: player.location.x, y: player.location.y, z: player.location.z };
      const dimId = player.dimension.id;

      if (isRestrictedLiquidBucket(itemId) && isRestrictedLiquidZoneAt(loc, dimId)) {
        event.cancel = true;
        maybeWarnProtection(player, "§b§l[§3Protección§b§l]§r §cEl agua y la lava están prohibidas en zonas comunitarias y admin.");
        return;
      }

      if (!checkPermission(player, loc, dimId, "use")) {
        event.cancel = true;
        maybeWarnProtection(player, "§b§l[§3Protección§b§l]§r §cNo puedes usar cubetas en esta zona protegida.");
      }
    });
  }
} catch (e) {
  ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "itemUseBucket", category: "runtime" });
}

// 3.2. Bloquear interacción con entidades útiles dentro de zonas protegidas
try {
  const interactEntityEvent =
    world.beforeEvents?.playerInteractWithEntity ||
    world.beforeEvents?.playerInteractEntity;

  if (interactEntityEvent && typeof interactEntityEvent.subscribe === "function") {
    interactEntityEvent.subscribe((event) => {
      const player = event.player;
      const target = event.target;
      if (!player || !target) return;
      if (!isProtectedEntityInteraction(target)) return;
      if (checkPermission(player, target.location, target.dimension.id, "interact")) return;

      event.cancel = true;
      maybeWarnProtection(player, "§b§l[§3Protección§b§l]§r §cNo puedes interactuar con entidades protegidas dentro de este terreno.");
    });
  }
} catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("Error suscribiendo InteractWithEntity: " + e);
}

// 3.3. Bloquear daño o manipulación de marcos, armor stands, aldeanos y vehículos
try {
  const attackEntityEvent =
    world.beforeEvents?.playerHitEntity ||
    world.beforeEvents?.entityHitEntity;

  if (attackEntityEvent && typeof attackEntityEvent.subscribe === "function") {
    attackEntityEvent.subscribe((event) => {
      const player = event.damagingEntity || event.player;
      const target = event.hitEntity || event.entityHit || event.target;
      if (!player || player.typeId !== "minecraft:player" || !target) return;
      if (!isProtectedEntityInteraction(target)) return;
      if (checkPermission(player, target.location, target.dimension.id, "attack")) return;

      event.cancel = true;
      maybeWarnProtection(player, "§b§l[§3Protección§b§l]§r §cNo puedes dañar ni mover entidades protegidas en este terreno.");
    });
  }
} catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("Error suscribiendo HitEntity: " + e);
}

// 4. Bloquear daño a entidades (Invulnerabilidad y bloqueo de PvP en Safezones)
try {
  const damageEvent = world.beforeEvents.entityDamage || world.beforeEvents.entityHurt;
  if (damageEvent) {
    damageEvent.subscribe((event) => {
    const victim = event.hurtEntity || event.entity;
    if (!victim) return;

    if (victim.typeId === "minecraft:player") {
      const attacker = getDamageSourcePlayer(event.damageSource);
      if (attacker?.typeId === "minecraft:player" && isColiseumDuelContext(attacker, victim) && !isAuthorizedColiseumDuelPair(attacker, victim)) {
        event.cancel = true;
        maybeWarnProtection(attacker, "§b§l[§4Coliseo§b§l]§r §cEl PvP solo está habilitado para los dos combatientes que aceptaron este duelo.");
        return;
      }
      const victimWarmup = getColiseumWarmupState(victim);
      const attackerWarmup = attacker?.typeId === "minecraft:player" ? getColiseumWarmupState(attacker) : null;
      if (victimWarmup || attackerWarmup) {
        event.cancel = true;
        if (attacker?.typeId === "minecraft:player") {
          system.run(() => {
            try {
              attacker.sendMessage("§b§l[§4Coliseo§b§l]§r §cEl combate aún no comienza. Espera la cuenta regresiva.");
            } catch (err) { ErrorReporter.report(err, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
          });
        }
        return;
      }
    }

    const loc = victim.location;
    const dimId = victim.dimension.id;
    const zones = getZonesAt(loc, dimId);
    const inAdminZoneVictim = zones.some(z => z.isAdmin && !isColiseumZone(z) && !z.isCommunity && z.zoneType !== "community") && !zones.some(isColiseumZone);

    let inAdminZoneAttacker = false;
    const damageSource = event.damageSource;
    const attacker = getDamageSourcePlayer(damageSource) || damageSource?.damagingEntity;

    if (attacker) {
      const attackerZones = getZonesAt(attacker.location, attacker.dimension.id);
      inAdminZoneAttacker = attackerZones.some(z => z.isAdmin && !isColiseumZone(z) && !z.isCommunity && z.zoneType !== "community") && !attackerZones.some(isColiseumZone);
    }

    const inAdminZone = inAdminZoneVictim || inAdminZoneAttacker;

    if (inAdminZone) {
      // Si la víctima es un jugador o criatura aliada en zona admin, cancelamos TODO tipo de daño
      // Esto previene daño por fuego indirecto (Fire Aspect), venenos, caída, lava, vacío, etc.
      if (victim.typeId === "minecraft:player" || victim.typeId.startsWith("minecraft:")) {
        event.cancel = true;

      // Enviar aviso de PvP solo si el atacante fue un jugador y la víctima es otro jugador
        if (attacker && attacker.typeId === "minecraft:player" && victim.typeId === "minecraft:player") {
          system.run(() => {
            try {
              attacker.sendMessage("§b§l[§3Safezone§b§l]§r §cEl PvP está desactivado en esta zona protegida.");
            } catch (err) { ErrorReporter.report(err, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
          });
        }
      }
    } else {
      if (victim.typeId === "minecraft:player") {
        const health = victim.getComponent("minecraft:health");
        if (health && event.damage >= health.currentValue) {
          const matchId = getActiveColiseumMatchForPlayer(victim);
          const isBountyTarget = victim.hasTag("bounty_target");
          const isBountyHunter = victim.hasTag("bounty_hunter");

          if (matchId || isBountyTarget || isBountyHunter) {
             event.cancel = true; // Prevents death and item drop
             system.run(() => {
                try {
                  health.setCurrentValue(health.defaultValue || 20);
                  // Apply resistance to prevent immediate re-death from fire/poison
                  victim.addEffect("resistance", 100, { amplifier: 255, showParticles: false });
                } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
                
                if (matchId) {
                  const match = activeColiseumMatches.get(matchId);
                  if (match) {
                     const winnerName = match.playerAName.toLowerCase() === victim.name.toLowerCase() ? match.playerBName : match.playerAName;
                     finalizeColiseumMatch(matchId, `§b§l[§4Coliseo§b§l]§r §c${victim.name}§e ha sido derrotado. Ganador: §a${winnerName}§e.`, victim.name, winnerName);
                  }
                } else if (isBountyTarget || isBountyHunter) {
                  const bountySession = loadBountyColiseumSession() || {};
                  const winnerName = isBountyTarget ? bountySession.hunterName : bountySession.targetName;
                  world.getDimension("overworld").runCommand(`scriptevent clans:bounty_death ${victim.name}`);
                }
             });
             return;
          }
        }
      }
    }
  });
}
} catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });

  console.warn("Error suscribiendo EntityDamage/EntityHurt: " + e);
}

try {
  if (world.afterEvents?.entityDie && typeof world.afterEvents.entityDie.subscribe === "function") {
    world.afterEvents.entityDie.subscribe((event) => {
      try {
        const victim = event.deadEntity;
        if (!victim || victim.typeId !== "minecraft:player") return;
        const matchId = getActiveColiseumMatchForPlayer(victim);
        if (!matchId) return;

        const match = activeColiseumMatches.get(matchId);
        if (!match) return;
        const winnerName = match.playerAName.toLowerCase() === victim.name.toLowerCase() ? match.playerBName : match.playerAName;
        finalizeColiseumMatch(matchId, `§b§l[§4Coliseo§b§l]§r §aEl combate terminó. Ganador: §e${winnerName}§a. Premio: §6$${COLISEUM_PVP_REWARD}§a. Restaurando coliseo y regresando jugadores.`, victim.name, winnerName);
      } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
    });
  }
} catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("Error suscribiendo EntityDie para coliseo: " + e);
}

try {
  if (world.afterEvents?.playerLeave && typeof world.afterEvents.playerLeave.subscribe === "function") {
    world.afterEvents.playerLeave.subscribe((event) => {
      const name = String(event.playerName || "").toLowerCase();
      if (!name) return;
      const matchId = playerActiveColiseumMatch.get(name);
      if (!matchId) return;

      const match = activeColiseumMatches.get(matchId);
      if (!match) return;
      const winnerName = match.playerAName.toLowerCase() === name ? match.playerBName : match.playerAName;
      applyCombatLogoutTempBan(event.playerName || name, "Abandono de combate en coliseo. Ban temporal de 10 minutos.", "Coliseo");
      world.sendMessage(`§b§l[§4Coliseo§b§l]§r §c${event.playerName || name} §7recibió un ban temporal de §e10 minutos §7por abandonar el combate.`);
      finalizeColiseumMatch(matchId, `§b§l[§4Coliseo§b§l]§r §eEl duelo terminó porque un jugador salió del servidor. Ganador por abandono: §a${winnerName}§e. Premio: §6$${COLISEUM_PVP_REWARD}§e.`, event.playerName || "", winnerName);
    });
  }
} catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("Error suscribiendo PlayerLeave para coliseo: " + e);
}

// 5. Bloquear destrucción de bloques por explosiones. La única excepción es TNT
// de una subárea comunitaria de automatización, y nunca puede salir de ella.
try {
  world.beforeEvents.explosion.subscribe((event) => {
    const dimension = event.dimension;
    let blocks;
    try {
      blocks = event.getImpactedBlocks();
    } catch (error) {
      const source = event.source || event.explodingEntity;
      if (source?.location && source?.dimension?.id && isProtectedZoneAt(source.location, source.dimension.id)) {
        event.cancel = true;
      }
      ErrorReporter.report(error, { addonId: "protection_addon", moduleId: "main.js", operation: "explosionImpactedBlocks", category: "runtime" });
      return;
    }
    const zones = loadZones();

    // Si no hay zonas registradas, no hay nada que filtrar
    if (zones.length === 0) return;

    const source = event.source || event.explodingEntity;
    const sourceType = String(source?.typeId || "").toLowerCase();
    const isTntSource = sourceType === "minecraft:tnt" || sourceType === "minecraft:tnt_minecart";
    let automation = isTntSource && source?.location
      ? getAutomationAreaAt(source.location, dimension.id, zones)
      : undefined;
    // Algunas explosiones de TNT automatizada llegan sin entidad fuente en la
    // Script API. Solo en ese caso se infiere la subárea por los bloques que
    // BDS calculó como afectados; si toca dos áreas distintas, se bloquea.
    if (!automation && !sourceType) {
      automation = getUniqueAutomationAreaFromBlocks(blocks, dimension.id, zones);
    }
    const impactedBlocks = Array.from(blocks || []);
    const guaranteedYields = automation ? impactedBlocks
      .filter((block) => isInsideAutomationArea({ x: block.x, y: block.y, z: block.z }, dimension.id, automation.zone, automation.area) && isAutomationGuaranteedYieldBlock(block))
      .map((block) => ({ typeId: block.typeId, location: { x: block.x, y: block.y, z: block.z } }))
      : [];
    const remainingBlocks = impactedBlocks.filter((block) => {
      try {
        const loc = { x: block.x, y: block.y, z: block.z };
        // Una TNT autorizada solo puede afectar su propia subárea. Esto bloquea
        // también bloques sin protección fuera del borde de la comunidad.
        if (automation) {
          return isInsideAutomationArea(loc, dimension.id, automation.zone, automation.area) &&
            isAutomationHarvestBlock(block) && !isCommunityLeafBlock(block);
        }
        const isProt = zones.some(z => isInside(loc, dimension.id, z) && (z.isAdmin || z.flags?.explosions !== true));
        return !isProt;
      } catch (err) { ErrorReporter.report(err, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
        return false;
      }
    });

    // Para la automatización no dejamos que BDS destruya los bloques de cultivo:
    // se retiran y entregan un tick después, fuera del radio de la TNT.
    if (automation) {
      event.setImpactedBlocks([]);
      if (guaranteedYields.length) harvestAutomationExplosionBlocks(dimension, guaranteedYields);
    } else {
      event.setImpactedBlocks(remainingBlocks);
    }
  });
} catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("Error suscribiendo Explosion: " + e);
}

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
      for (const name of ["pos1", "pos2", "desproteger", "adminpos1", "adminpos2", "adminc1", "adminc2", "zonas", "coliseodebug", "admincomunidad"]) {
        register({
          name: `${COMMAND_NAMESPACE}:${name}`,
          description: `Comando ${name}`,
          permissionLevel: name === "adminpos1" || name === "adminpos2" || name === "adminc1" || name === "adminc2" || name === "coliseodebug" || name === "admincomunidad" ? ADMIN_PERMISSION : CommandPermissionLevel.Any,
        }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          const isAdminCmd = name === "adminpos1" || name === "adminpos2" || name === "adminc1" || name === "adminc2" || name === "coliseodebug" || name === "admincomunidad";
          if (isAdminCmd && !isPlayerOp(sender)) return commandError("Solo para operadores.");
          system.run(() => {
            if (name === "pos1") handleSetPos(sender, 1);
            else if (name === "pos2") handleSetPos(sender, 2);
            else if (name === "desproteger") handleUnclaim(sender);
            else if (name === "adminpos1") handleSetPos(sender, 1, true);
            else if (name === "adminpos2") handleSetPos(sender, 2, true);
            else if (name === "adminc1") handleSetColiseumSpawn(sender, 1);
            else if (name === "adminc2") handleSetColiseumSpawn(sender, 2);
            else if (name === "coliseodebug") handleColiseumDebug(sender);
            else if (name === "zonas") openZonesGUI(sender);
            else if (name === "admincomunidad") handleAdminCommunityCommand(sender);
          });
          return commandOk(`Procesando ${name}.`);
        });
      }

      register({
        name: `${COMMAND_NAMESPACE}:proteger`,
        description: "Protege un terreno",
        permissionLevel: CommandPermissionLevel.Any,
        optionalParameters: [{ name: "nombre", type: CustomCommandParamType.String }],
      }, (origin, nombre) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        system.run(() => handleClaim(sender, nombre === undefined ? "" : String(nombre), false));
        return commandOk("Procesando proteger.");
      });

      register({
        name: `${COMMAND_NAMESPACE}:adminproteger`,
        description: "Crea zona admin",
        permissionLevel: ADMIN_PERMISSION,
        optionalParameters: [{ name: "nombre", type: CustomCommandParamType.String }],
      }, (origin, nombre) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
        system.run(() => handleClaim(sender, nombre === undefined ? "" : String(nombre), true));
        return commandOk("Procesando adminproteger.");
      });

      register({
        name: `${COMMAND_NAMESPACE}:admincoliseo`,
        description: "Crea zona de coliseo PvP",
        permissionLevel: ADMIN_PERMISSION,
        optionalParameters: [{ name: "nombre", type: CustomCommandParamType.String }],
      }, (origin, nombre) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
        system.run(() => handleColiseumClaim(sender, nombre === undefined ? "" : String(nombre)));
        return commandOk("Procesando admincoliseo.");
      });

      register({
        name: `${COMMAND_NAMESPACE}:admineliminar`,
        description: "Elimina zona admin",
        permissionLevel: ADMIN_PERMISSION,
        optionalParameters: [{ name: "nombre", type: CustomCommandParamType.String }],
      }, (origin, nombre) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
        system.run(() => handleAdminDelete(sender, nombre === undefined ? "" : String(nombre)));
        return commandOk("Procesando admineliminar.");
      });

      register({
        name: `${COMMAND_NAMESPACE}:admincomauto`,
        description: "Crea subárea comunitaria para TNT automatizada",
        permissionLevel: ADMIN_PERMISSION,
        mandatoryParameters: [{ name: "nombre", type: CustomCommandParamType.String }],
      }, (origin, nombre) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
        system.run(() => handleCreateAutomationArea(sender, String(nombre)));
        return commandOk("Procesando subárea comunitaria automatizada.");
      });

      register({
        name: `${COMMAND_NAMESPACE}:admincoliseolimpiar`,
        description: "Limpia coliseo con air",
        permissionLevel: ADMIN_PERMISSION,
        optionalParameters: [{ name: "nombre", type: CustomCommandParamType.String }],
      }, (origin, nombre) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
        system.run(() => handleColiseumClear(sender, nombre === undefined ? "" : String(nombre)));
        return commandOk("Procesando admincoliseolimpiar.");
      });

      for (const name of ["coliseopvp", "duelo"]) {
        register({
          name: `${COMMAND_NAMESPACE}:${name}`,
          description: "Solicita un duelo formal en el coliseo",
          permissionLevel: CommandPermissionLevel.Any,
          mandatoryParameters: [{ name: "jugador", type: CustomCommandParamType.String }],
          optionalParameters: [{ name: "coliseo", type: CustomCommandParamType.String }],
        }, (origin, jugador, coliseo) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          system.run(() => handleColiseumRequest(sender, String(jugador), coliseo === undefined ? "" : String(coliseo)));
          return commandOk(`Procesando ${name}.`);
        });
      }

      for (const name of ["coliseoaccept", "dueloaceptar", "aceptarduelo", "coliseoaceptar"]) {
        register({
          name: `${COMMAND_NAMESPACE}:${name}`,
          description: "Acepta un duelo de coliseo",
          permissionLevel: CommandPermissionLevel.Any,
        }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          system.run(() => handleColiseumAccept(sender));
          return commandOk(`Procesando ${name}.`);
        });
      }

      for (const name of ["coliseodeny", "duelorechazar", "rechazarduelo", "coliseorechazar"]) {
        register({
          name: `${COMMAND_NAMESPACE}:${name}`,
          description: "Rechaza un duelo de coliseo",
          permissionLevel: CommandPermissionLevel.Any,
        }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          system.run(() => handleColiseumDeny(sender));
          return commandOk(`Procesando ${name}.`);
        });
      }

      register({
        name: `${COMMAND_NAMESPACE}:zona`,
        description: "Trust o untrust en zona",
        permissionLevel: CommandPermissionLevel.Any,
        mandatoryParameters: [
          { name: "subcomando", type: CustomCommandParamType.String },
          { name: "jugador", type: CustomCommandParamType.String },
        ],
      }, (origin, subcomando, jugador) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        system.run(() => handleTrustCommand(sender, String(subcomando).toLowerCase(), String(jugador)));
        return commandOk("Procesando zona.");
      });
    } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Protección] Error registrando custom commands: " + e);
    }
  });
}

registerCustomCommands();

// Guardar esquinas de selección
function handleSetPos(player, num, isAdminSelection = false) {
  if (isAdminSelection && !isPlayerOp(player)) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cSolo los operadores pueden usar selecciones administrativas.");
    return;
  }

  const loc = player.location;
  const pName = player.name;
  
  if (!playerSelections.has(pName)) {
    playerSelections.set(pName, {});
  }
  
  const sel = playerSelections.get(pName);
  const pos = {
    x: Math.floor(loc.x),
    y: Math.floor(loc.y),
    z: Math.floor(loc.z),
    dimension: player.dimension.id
  };

  if (num === 1) {
    sel.pos1 = pos;
    player.sendMessage(`§b§l[§3Protección§b§l]§r §aEsquina 1 establecida en: §fX: ${pos.x}, Y: ${pos.y}, Z: ${pos.z}`);
  } else {
    sel.pos2 = pos;
    player.sendMessage(`§b§l[§3Protección§b§l]§r §aEsquina 2 establecida en: §fX: ${pos.x}, Y: ${pos.y}, Z: ${pos.z}`);
  }

  if (!isAdminSelection) {
    const quote = getSelectionQuote(sel.pos1, sel.pos2);
    if (quote?.price !== undefined) {
      player.sendMessage(`§7Selección: §e${quote.sizeX}x${quote.sizeZ} §7(${quote.sizeX * quote.sizeZ} bloques) | Costo exacto: §a${formatClaimMoney(quote.price)}§7.`);
    } else if (sel.pos1 && sel.pos2 && sel.pos1.dimension === sel.pos2.dimension) {
      const sizeX = Math.abs(sel.pos2.x - sel.pos1.x) + 1;
      const sizeZ = Math.abs(sel.pos2.z - sel.pos1.z) + 1;
      player.sendMessage(`§b§l[§3Protección§b§l]§r §cLa selección mide ${sizeX}x${sizeZ}. El máximo permitido es ${CLAIM_MAX_SIZE}x${CLAIM_MAX_SIZE}.`);
    }
  }
}

function handleSetColiseumSpawn(player, spawnNumber) {
  if (!isPlayerOp(player)) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cSolo los operadores pueden definir spawns del coliseo.");
    return;
  }

  const zone = getColiseumAtPlayer(player);
  if (!zone) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cDebes estar parado dentro de un coliseo para definir sus puntos de spawn.");
    return;
  }

  const db = loadZonesForUpdate();
  const index = db.findIndex((candidate) => candidate.id === zone.id);
  if (index === -1) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cNo se pudo encontrar el coliseo en la base de datos.");
    return;
  }

  const spawnLocation = {
    x: Math.floor(player.location.x),
    y: Math.floor(player.location.y),
    z: Math.floor(player.location.z),
    dimension: player.dimension.id,
  };

  if (spawnNumber === 1) {
    db[index].spawn1 = spawnLocation;
  } else {
    db[index].spawn2 = spawnLocation;
  }

  saveZones(db);
  setActiveColiseumId(zone.id);
  player.sendMessage(`§b§l[§3Protección§b§l]§r §aSpawn ${spawnNumber} del coliseo §e${zone.name} §aguardado en §f${spawnLocation.x}, ${spawnLocation.y}, ${spawnLocation.z}§a.`);
  player.sendMessage("§7Este coliseo quedó marcado como coliseo activo para duelos.");
}

function zoneCoversFullHeight(zone) {
  // Los claims privados se crean con -64..320. Las safezones y comunitarias
  // son verticales por definición, aunque sus esquinas se hayan tomado a una
  // altura concreta. Los registros antiguos sin tipo también son claims.
  // Los coliseos son la única excepción volumétrica.
  return zone?.zoneType !== "coliseum" && (
    zone?.isAdmin === true ||
    zone?.isCommunity === true ||
    zone?.zoneType === "claim" ||
    !zone?.zoneType ||
    (Number(zone?.min?.y) <= -64 && Number(zone?.max?.y) >= 320)
  );
}

function zonesOverlap(first, second) {
  if (!first || !second || first.dimension !== second.dimension) return false;
  const overlapX = first.min.x <= second.max.x && first.max.x >= second.min.x;
  const overlapZ = first.min.z <= second.max.z && first.max.z >= second.min.z;
  if (!overlapX || !overlapZ) return false;
  if (zoneCoversFullHeight(first) || zoneCoversFullHeight(second)) return true;
  return first.min.y <= second.max.y && first.max.y >= second.min.y;
}

// Comprobar si una nueva selección colisiona con zonas existentes.
function checkOverlap(min, max, dimension, coversFullHeight = false) {
  const db = loadZones();
  const candidate = { dimension, min, max, isAdmin: coversFullHeight, zoneType: coversFullHeight ? "claim" : "coliseum" };
  for (const z of db) {
    if (z?.disabled === true) continue;
    if (zonesOverlap(candidate, z)) return z;
  }
  return null;
}

// Conserva la zona principal y desactiva (sin borrar) la más nueva cuando
// encuentra registros históricos que ya se solapaban. Así un troll no puede
// invalidar una protección existente, y el administrador conserva la evidencia.
function reconcileOverlappingZones(db) {
  const ordered = [...db]
    .filter((zone) => zone && zone.disabled !== true)
    .sort((a, b) => {
      const aAdmin = a.isAdmin === true ? 1 : 0;
      const bAdmin = b.isAdmin === true ? 1 : 0;
      if (aAdmin !== bAdmin) return bAdmin - aAdmin;
      return Number(a.createdAt || a.id || 0) - Number(b.createdAt || b.id || 0);
    });
  const retained = [];
  let quarantined = 0;
  for (const zone of ordered) {
    const primary = retained.find((candidate) => zonesOverlap(candidate, zone));
    if (!primary) {
      retained.push(zone);
      continue;
    }
    zone.disabled = true;
    zone.disabledReason = "overlap";
    zone.disabledByZoneId = primary.id;
    zone.disabledAt = Date.now();
    quarantined++;
  }
  return quarantined;
}

// Crear protección
function handleClaim(player, name, isAdminClaim = false, isCommunityClaim = false) {
  if ((isAdminClaim || isCommunityClaim) && !isPlayerOp(player)) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cSolo los operadores pueden crear zonas administrativas o comunitarias.");
    return;
  }

  if (!name) {
    player.sendMessage(`§b§l[§3Protección§b§l]§r §cUso: ${isCommunityClaim ? "/s:admincomunidad" : isAdminClaim ? "/s:adminproteger" : "/s:proteger"} <nombre>`);
    return;
  }

  const sel = playerSelections.get(player.name);
  if (!sel || !sel.pos1 || !sel.pos2) {
    player.sendMessage(`§b§l[§3Protección§b§l]§r §cDebes establecer ambas esquinas con §e/s:${isAdminClaim || isCommunityClaim ? "adminpos1" : "pos1"} §cy §e/s:${isAdminClaim || isCommunityClaim ? "adminpos2" : "pos2"} §cprimero.`);
    return;
  }

  if (sel.pos1.dimension !== sel.pos2.dimension) {
    player.sendMessage(`§b§l[§3Protección§b§l]§r §cLas esquinas deben estar en la misma dimensión.`);
    return;
  }

  // El End, incluidos el dragón, los portales de salida y los gateways, es
  // infraestructura pública. Las protecciones privadas allí permitirían que
  // un jugador bloquee contenido esencial para todo el servidor. El staff
  // conserva los comandos administrativos para crear una zona pública si la
  // necesita.
  if (!isAdminClaim && !isCommunityClaim && sel.pos1.dimension === END_DIMENSION_ID) {
    playerSelections.delete(player.name);
    player.sendMessage("§b§l[§3Protección§b§l]§r §cNo puedes proteger terrenos en el End: la isla de la dragona y sus portales son públicos.");
    return;
  }

  const minX = Math.min(sel.pos1.x, sel.pos2.x);
  const maxX = Math.max(sel.pos1.x, sel.pos2.x);
  const minZ = Math.min(sel.pos1.z, sel.pos2.z);
  const maxZ = Math.max(sel.pos1.z, sel.pos2.z);

  // Ancho y largo horizontales
  const sizeX = maxX - minX + 1;
  const sizeZ = maxZ - minZ + 1;
  const claimPrice = (isAdminClaim || isCommunityClaim) ? 0 : calculateClaimPrice(sizeX, sizeZ);

  if (!isAdminClaim && !isCommunityClaim) {
    // Validaciones para jugadores normales
    if (claimPrice === undefined) {
      player.sendMessage(`§b§l[§3Protección§b§l]§r §cEl tamaño máximo de protección permitido es de ${CLAIM_MAX_SIZE}x${CLAIM_MAX_SIZE} bloques.`);
      return;
    }

    const bal = getBalance(player);
    if (bal < claimPrice) {
      player.sendMessage(`§b§l[§3Protección§b§l]§r §cNo tienes suficiente dinero para esta protección de ${sizeX}x${sizeZ}. Requiere: §a${formatClaimMoney(claimPrice)}§c (Tu saldo: §a${formatClaimMoney(bal)}§c).`);
      return;
    }

    const zones = loadZones();
    const playerZones = zones.filter((zone) =>
      isPrivateClaimZone(zone) && String(zone.owner || "").toLowerCase() === player.name.toLowerCase()
    );
    const extraZones = getExtraZoneAllowance(player);
    const maxAllowed = 1 + extraZones;
    if (playerZones.length >= maxAllowed) {
      player.sendMessage(`§b§l[§3Protección§b§l]§r §cYa tienes el límite máximo de zonas protegidas (${maxAllowed} bases; extras detectados: ${extraZones}).`);
      return;
    }
  }

  // Las protecciones abarcan desde la altura mínima hasta la altura máxima del juego para evitar griefing vertical
  const minY = -64;
  const maxY = 320;

  // Evitar solapamiento de zonas
  const overlapping = checkOverlap(
    { x: minX, y: minY, z: minZ },
    { x: maxX, y: maxY, z: maxZ },
    sel.pos1.dimension,
    true
  );

  if (overlapping) {
    player.sendMessage(`§b§l[§3Protección§b§l]§r §cEsta selección se cruza con otra zona protegida existente: §e"${overlapping.name}"§c.`);
    return;
  }

  const db = loadZonesForUpdate();
  if (!zonesDataAvailable) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cLa base de protecciones no está disponible. No se realizó ningún cobro.");
    return;
  }
  const newZone = {
    id: `${Date.now()}`,
    name: name.trim(),
    owner: (isAdminClaim || isCommunityClaim) ? "Administración" : player.name,
    isAdmin: isAdminClaim || isCommunityClaim,
    isCommunity: isCommunityClaim,
    zoneType: isCommunityClaim ? "community" : isAdminClaim ? "safezone" : "claim",
    dimension: sel.pos1.dimension,
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    createdAt: Date.now(),
    pricePaid: claimPrice,
    pricingVersion: (isAdminClaim || isCommunityClaim) ? "admin_no_charge" : "area_v1",
    trusted: []
  };

  // Cobrar dinero si no es zona administrativa o comunitaria
  let claimCharged = false;
  if (!isAdminClaim && !isCommunityClaim) {
    claimCharged = addBalance(player, -claimPrice);
    if (!claimCharged) {
      player.sendMessage("§b§l[§3Protección§b§l]§r §cNo se pudo confirmar el cobro. La protección no fue creada.");
      return;
    }
  }

  db.push(newZone);
  if (!saveZones(db)) {
    const refunded = !claimCharged || addBalance(player, claimPrice, { allowOverOperationalLimit: true });
    if (!refunded) {
      console.warn(`[ECONOMY_CRITICAL] No se pudo reembolsar el claim fallido de ${player.name}.`);
    }
    player.sendMessage(refunded
      ? "§b§l[§3Protección§b§l]§r §cNo se pudo guardar la protección. El cobro fue revertido."
      : "§b§l[§3Protección§b§l]§r §cNo se pudo guardar la protección ni confirmar el reembolso. Contacta a un administrador.");
    return;
  }

  // Limpiar selección temporal
  playerSelections.delete(player.name);

  if (isCommunityClaim) {
    player.sendMessage(`§b§l[§3Protección§b§l]§r §a¡Zona Comunitaria §e"${newZone.name}" §aprotegida correctamente! (Interacciones y uso de cofres/granjas habilitados para todos los jugadores).`);
  } else if (isAdminClaim) {
    player.sendMessage(`§b§l[§3Protección§b§l]§r §a¡Safezone Administrativa §e"${newZone.name}" §aprotegida correctamente!`);
  } else {
    player.sendMessage(`§b§l[§3Protección§b§l]§r §a¡Zona §e"${newZone.name}" §aprotegida correctamente por §6${formatClaimMoney(claimPrice)}§a!`);
  }
  player.sendMessage(`§7Dimension: ${String(newZone.dimension || "").replace(/^minecraft:/, "")} | Tamaño: ${sizeX}x${sizeZ} bloques.`);
}

function handleColiseumClaim(player, name) {
  if (!isPlayerOp(player)) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cSolo los operadores pueden crear coliseos administrativos.");
    return;
  }

  if (!name) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cUso: /s:admincoliseo <nombre>");
    return;
  }

  const sel = playerSelections.get(player.name);
  if (!sel || !sel.pos1 || !sel.pos2) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cDebes establecer ambas esquinas con §e/s:adminpos1 §cy §e/s:adminpos2§c.");
    return;
  }

  if (sel.pos1.dimension !== sel.pos2.dimension) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cLas esquinas deben estar en la misma dimensión.");
    return;
  }

  const min = {
    x: Math.min(sel.pos1.x, sel.pos2.x),
    z: Math.min(sel.pos1.z, sel.pos2.z),
  };
  const max = {
    x: Math.max(sel.pos1.x, sel.pos2.x),
    z: Math.max(sel.pos1.z, sel.pos2.z),
  };

  const centerY = Math.floor(player.location.y);
  min.y = Math.max(-64, centerY - 50);
  max.y = Math.min(320, centerY + 50);

  const overlapping = checkOverlap(min, max, sel.pos1.dimension, false);
  if (overlapping) {
    player.sendMessage(`§b§l[§3Protección§b§l]§r §cEsta selección se cruza con otra zona protegida existente: §e"${overlapping.name}"§c.`);
    return;
  }

  const db = loadZonesForUpdate();
  const newZone = {
    id: `${Date.now()}`,
    name: name.trim(),
    owner: "Administración",
    isAdmin: true,
    zoneType: "coliseum",
    dimension: sel.pos1.dimension,
    min,
    max,
    createdAt: Date.now(),
    trusted: [],
  };

  db.push(newZone);
  saveZones(db);
  setActiveColiseumId(newZone.id);
  playerSelections.delete(player.name);
  player.sendMessage(`§b§l[§3Protección§b§l]§r §aColiseo PvP §e"${newZone.name}" §acreado correctamente.`);
  player.sendMessage(`§7Dentro del coliseo se permite PvP, colocar/romper bloques y usar cubetas.`);
  player.sendMessage("§7Este coliseo quedó marcado como coliseo activo. Configura ahora §e/s:adminc1 §7y §e/s:adminc2§7.");
}

// Eliminar protección propia
function handleUnclaim(player) {
  const loc = player.location;
  const dimId = player.dimension.id;
  const db = loadZonesForUpdate();

  const matchIdx = db.findIndex(z => isInside(loc, dimId, z));
  if (matchIdx === -1) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cNo estás parado sobre ninguna zona protegida.");
    return;
  }

  const zone = db[matchIdx];
  if (zone.isAdmin) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cEsta es una zona administrativa. No puedes borrarla.");
    return;
  }

  if (zone.owner.toLowerCase() !== player.name.toLowerCase() && !isPlayerOp(player)) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cNo eres el dueño de esta protección.");
    return;
  }

  db.splice(matchIdx, 1);
  saveZones(db);

  player.sendMessage(`§b§l[§3Protección§b§l]§r §aLa zona protegida §e"${zone.name}" §afue eliminada.`);
}

// Dar/quitar permisos a amigos (Trust / Untrust)
function handleZoneCommand(player, sub, param) {
  const action = String(sub || "").toLowerCase();
  
  if (action === "bordes" || action === "borders" || action === "limites" || action === "particulas") {
    toggleZoneBorders(player);
    return;
  }

  if (action === "banderas" || action === "flags" || action === "config") {
    const zones = getZonesAt(player.location, player.dimension.id);
    const myZone = zones.find(z => !z.disabled && (normalizeZonePlayerName(z.owner) === normalizeZonePlayerName(player.name) || isPlayerOp(player)));
    if (!myZone) {
      player.sendMessage("§b§l[§3Protección§b§l]§r §cDebes estar dentro de tu terreno para configurar sus banderas.");
      return;
    }
    openZoneFlagsGUI(player, myZone);
    return;
  }

  if (action === "ayuda" || action === "help") {
    player.sendMessage("§a§l=== COMANDOS DE TERRENOS (/s:zona) ===");
    player.sendMessage("§b/s:zona bordes §7- Muestra/oculta los límites de tu terreno con partículas.");
    player.sendMessage("§b/s:zona banderas §7- Configura permisos especiales (PvP, explosiones, puertas).");
    player.sendMessage("§b/s:zona confiar <jugador> §7- Agrega a un amigo con permisos en tu terreno.");
    player.sendMessage("§b/s:zona desconfiar <jugador> §7- Quita los permisos a un amigo.");
    player.sendMessage("§b/s:zonas §7- Abre el menú visual de gestión de terrenos.");
    return;
  }

  let trustAction = action;
  if (trustAction === "confiar" || trustAction === "invitar" || trustAction === "amigo" || trustAction === "agregar") trustAction = "trust";
  if (trustAction === "desconfiar" || trustAction === "revocar" || trustAction === "quitar" || trustAction === "expulsar") trustAction = "untrust";

  if (!param || (trustAction !== "trust" && trustAction !== "untrust")) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cUso: /s:zona confiar <jugador>, /s:zona desconfiar <jugador>, /s:zona bordes o /s:zona banderas");
    return;
  }

  const loc = player.location;
  const dimId = player.dimension.id;
  const db = loadZonesForUpdate();

  const matchIdx = db.findIndex(z => isInside(loc, dimId, z));
  if (matchIdx === -1) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cDebes estar dentro de tu zona protegida.");
    return;
  }

  const zone = db[matchIdx];
  if (normalizeZonePlayerName(zone.owner) !== normalizeZonePlayerName(player.name) && !isPlayerOp(player)) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cNo eres el dueño de esta zona.");
    return;
  }

  if (trustAction === "trust") {
    if (!Array.isArray(zone.trusted)) zone.trusted = [];
    const canonicalTarget = canonicalPlayerName(param);
    if (zone.trusted.some((entry) => normalizeZonePlayerName(entry) === normalizeZonePlayerName(canonicalTarget))) {
      player.sendMessage(`§b§l[§3Protección§b§l]§r §cEl jugador §e${param} §cya tiene permisos.`);
      return;
    }
    zone.trusted.push(canonicalTarget);
    player.sendMessage(`§b§l[§3Protección§b§l]§r §a¡Le has otorgado permisos a §e${canonicalTarget} §aen tu zona!`);
  } else {
    if (!Array.isArray(zone.trusted)) zone.trusted = [];
    const idx = zone.trusted.findIndex((entry) => normalizeZonePlayerName(entry) === normalizeZonePlayerName(param));
    if (idx === -1) {
      player.sendMessage(`§b§l[§3Protección§b§l]§r §cEl jugador §e${param} §cno tiene permisos en tu zona.`);
      return;
    }
    zone.trusted.splice(idx, 1);
    player.sendMessage(`§b§l[§3Protección§b§l]§r §aLe has retirado los permisos a §e${param} §aen tu zona.`);
  }

  saveZones(db);
}

function handleTrustCommand(player, sub, targetName) {
  return handleZoneCommand(player, sub, targetName);
}

// Eliminar protección admin (Solo OP)
function handleAdminDelete(player, name) {
  if (!isPlayerOp(player)) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cSolo los operadores pueden eliminar zonas administrativas.");
    return;
  }

  if (!name) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cUso: /s:admineliminar <nombre>");
    return;
  }

  const db = loadZonesForUpdate();
  const matchIdx = db.findIndex(z => z.name.toLowerCase() === name.trim().toLowerCase());

  if (matchIdx === -1) {
    player.sendMessage(`§b§l[§3Protección§b§l]§r §cNo se encontró ninguna zona con el nombre §e"${name}"§c.`);
    return;
  }

  const zone = db[matchIdx];
  db.splice(matchIdx, 1);
  saveZones(db);

  player.sendMessage(`§b§l[§3Protección§b§l]§r §aLa zona protegida §e"${zone.name}" §afue eliminada administrativamente.`);
}

function runColiseumAirClear(player, zone) {
  const dimension = world.getDimension(zone.dimension);
  if (!dimension) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cNo se pudo acceder a la dimensión del coliseo.");
    return;
  }

  const bounds = {
    dimension: zone.dimension,
    min: { ...zone.min },
    max: { ...zone.max },
  };
  let overlapsActiveClear = false;
  for (const activeBounds of activeColiseumClears.values()) {
    if (
      bounds.dimension === activeBounds.dimension &&
      bounds.min.x <= activeBounds.max.x && bounds.max.x >= activeBounds.min.x &&
      bounds.min.y <= activeBounds.max.y && bounds.max.y >= activeBounds.min.y &&
      bounds.min.z <= activeBounds.max.z && bounds.max.z >= activeBounds.min.z
    ) {
      overlapsActiveClear = true;
      break;
    }
  }
  if (overlapsActiveClear) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cYa hay una limpieza en curso que se solapa con este coliseo.");
    return;
  }

  let x = bounds.min.x;
  let y = bounds.min.y;
  let z = bounds.min.z;
  let processedTotal = 0;
  const total =
    (bounds.max.x - bounds.min.x + 1) *
    (bounds.max.y - bounds.min.y + 1) *
    (bounds.max.z - bounds.min.z + 1);
  const clearId = nextColiseumClearId++;
  player.sendMessage(`§b§l[§3Protección§b§l]§r §eIniciando limpieza del coliseo §f${zone.name}§e (${total} bloques).`);

  const runId = system.runInterval(() => {
    let processed = 0;
    while (processedTotal < total && processed < COLISEUM_CLEAR_BLOCKS_PER_TICK) {
      const pos = { x, y, z };
      processedTotal++;
      processed++;

      z++;
      if (z > bounds.max.z) {
        z = bounds.min.z;
        y++;
        if (y > bounds.max.y) {
          y = bounds.min.y;
          x++;
        }
      }

      try {
        const block = dimension.getBlock(pos);
        if (block && block.typeId !== "minecraft:air" && block.typeId !== "minecraft:bedrock") {
          block.setType("minecraft:air");
        }
      } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
    }

    if (processedTotal >= total) {
      system.clearRun(runId);
      activeColiseumClears.delete(clearId);
      player.sendMessage(`§b§l[§3Protección§b§l]§r §aLimpieza del coliseo §e"${zone.name}" §acompletada.`);
    }
  }, 1);
  activeColiseumClears.set(clearId, bounds);
}

function handleColiseumClear(player, name) {
  if (!isPlayerOp(player)) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cSolo los operadores pueden limpiar coliseos.");
    return;
  }

  if (!name) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cUso: /s:admincoliseolimpiar <nombre>");
    return;
  }

  const zone = loadZones().find((candidate) => candidate.name.toLowerCase() === name.trim().toLowerCase() && isColiseumZone(candidate));
  if (!zone) {
    player.sendMessage(`§b§l[§3Protección§b§l]§r §cNo se encontró ningún coliseo con el nombre §e"${name}"§c.`);
    return;
  }

  runColiseumAirClear(player, zone);
}

function handleColiseumRequest(player, targetName, coliseumName = "") {
  if (!targetName) {
    player.sendMessage("§b§l[§4Coliseo§b§l]§r §cUso: /s:coliseopvp <jugador> [coliseo]");
    return;
  }

  const target = findOnlinePlayerByName(targetName);
  if (target === "multiple") {
    player.sendMessage("§b§l[§4Coliseo§b§l]§r §cHay varios jugadores con nombres similares. Sé más específico.");
    return;
  }
  if (!target) {
    player.sendMessage("§b§l[§4Coliseo§b§l]§r §cJugador no encontrado.");
    return;
  }
  if (target.name === player.name) {
    player.sendMessage("§b§l[§4Coliseo§b§l]§r §cNo puedes retarte a ti mismo.");
    return;
  }

  const cooldown = getColiseumCooldown(player.name, target.name);
  if (cooldown > 0) {
    const minutes = Math.ceil(cooldown / 60000);
    player.sendMessage(`§b§l[§4Coliseo§b§l]§r §cEsta pareja debe esperar §e${minutes} min§c antes de otro duelo con premio.`);
    return;
  }

  const zone = getColiseumZoneByName(coliseumName);
  if (!zone) {
    player.sendMessage(coliseumName
      ? `§b§l[§4Coliseo§b§l]§r §cNo existe un coliseo llamado §e"${coliseumName}"§c.`
      : "§b§l[§4Coliseo§b§l]§r §cNo hay ningún coliseo registrado.");
    return;
  }

  const targetKey = target.name.toLowerCase();
  if (getActiveColiseumMatchForPlayer(player) || getActiveColiseumMatchForPlayer(target)) {
    player.sendMessage("§b§l[§4Coliseo§b§l]§r §cUno de los jugadores ya está en un duelo activo.");
    return;
  }
  coliseumRequests.set(targetKey, {
    senderName: player.name,
    zoneName: zone.name,
    timestamp: Date.now(),
    senderOrigin: serializeLocation(player.location, player.dimension.id),
  });

  target.sendMessage(`§b§l[§4Coliseo§b§l]§r §c${player.name} §7te desafió a un PvP en el coliseo §e${zone.name}§7.\n§7Entrada: §e$${COLISEUM_ENTRY_FEE} por jugador§7. Premio financiado: §a$${COLISEUM_PVP_REWARD}§7.\n§7Usa §a/s:dueloaceptar §7(o /s:coliseoaccept) §7o §c/s:duelorechazar§7. Expira en 60 segundos.`);
  player.sendMessage(`§b§l[§4Coliseo§b§l]§r §7Solicitud enviada a §c${target.name}§7. La entrada de §e$${COLISEUM_ENTRY_FEE} §7se cobra al aceptar.`);
}

function handleColiseumAccept(player) {
  const key = player.name.toLowerCase();
  const request = coliseumRequests.get(key);
  if (!request || (Date.now() - request.timestamp > COLISEUM_REQUEST_TIMEOUT_MS)) {
    if (request) coliseumRequests.delete(key);
    player.sendMessage("§b§l[§4Coliseo§b§l]§r §cNo tienes ninguna solicitud de PvP pendiente o ya expiró.");
    return;
  }
  coliseumRequests.delete(key);

  const requester = world.getAllPlayers().find((candidate) => candidate.name.toLowerCase() === request.senderName.toLowerCase());
  if (!requester) {
    coliseumRequests.delete(key);
    player.sendMessage("§b§l[§4Coliseo§b§l]§r §cEl jugador que te desafió ya no está conectado.");
    return;
  }
  if (getActiveColiseumMatchForPlayer(requester) || getActiveColiseumMatchForPlayer(player)) {
    player.sendMessage("§b§l[§4Coliseo§b§l]§r §cUno de los jugadores ya está en un duelo activo.");
    requester.sendMessage("§b§l[§4Coliseo§b§l]§r §cLa solicitud expiró porque uno de los jugadores ya está combatiendo.");
    return;
  }

  const zone = getColiseumZoneByName(request.zoneName);
  if (!zone) {
    coliseumRequests.delete(key);
    player.sendMessage("§b§l[§4Coliseo§b§l]§r §cEl coliseo de este duelo ya no existe.");
    return;
  }
  if (!hasConfiguredColiseumSpawns(zone)) {
    coliseumRequests.delete(key);
    player.sendMessage("§b§l[§4Coliseo§b§l]§r §cEse coliseo no tiene configurados §es:adminc1 §cy §es:adminc2§c.");
    requester.sendMessage(`§b§l[§4Coliseo§b§l]§r §cEl coliseo §e${zone.name} §cno tiene configurados §es:adminc1 §cy §es:adminc2§c.`);
    return;
  }
  const zoneKey = String(zone.id);
  if (activeColiseumZoneMatches.has(zoneKey) || quarantinedColiseumZones.has(zoneKey)) {
    player.sendMessage("§b§l[§4Coliseo§b§l]§r §cEse coliseo esta ocupado o en cuarentena de integridad.");
    requester.sendMessage("§b§l[§4Coliseo§b§l]§r §cEl duelo no comenzo porque el coliseo no esta disponible.");
    return;
  }

  const cooldown = getColiseumCooldown(requester.name, player.name);
  if (cooldown > 0) {
    const minutes = Math.ceil(cooldown / 60000);
    player.sendMessage(`§b§l[§4Coliseo§b§l]§r §cEsta pareja debe esperar §e${minutes} min§c antes de otro duelo con premio.`);
    requester.sendMessage(`§b§l[§4Coliseo§b§l]§r §cEl duelo no puede comenzar por el cooldown económico de la pareja.`);
    return;
  }
  if (getBalance(requester) < COLISEUM_ENTRY_FEE || getBalance(player) < COLISEUM_ENTRY_FEE) {
    player.sendMessage(`§b§l[§4Coliseo§b§l]§r §cAmbos jugadores necesitan §e$${COLISEUM_ENTRY_FEE} §cpara pagar la entrada.`);
    requester.sendMessage(`§b§l[§4Coliseo§b§l]§r §cEl duelo no comenzó porque uno de los jugadores no puede pagar la entrada.`);
    return;
  }

  let requesterCharged = false;
  let targetCharged = false;
  try {
    requesterCharged = addBalance(requester, -COLISEUM_ENTRY_FEE);
    if (!requesterCharged) throw new Error("No se pudo cobrar la entrada del retador.");
    targetCharged = addBalance(player, -COLISEUM_ENTRY_FEE);
    if (!targetCharged) throw new Error("No se pudo cobrar la entrada del jugador retado.");

    const dimension = world.getDimension(zone.dimension);
    const spawn = getColiseumSpawnPositions(zone);
    const safeSpawnA = getSafeTeleportPosition(dimension, spawn.a);
    const safeSpawnB = getSafeTeleportPosition(dimension, spawn.b);
    const targetOrigin = serializeLocation(player.location, player.dimension.id);
    const match = startColiseumMatch(requester, player, zone, request.senderOrigin, targetOrigin, true);
    if (!match) {
      throw new Error("El coliseo esta ocupado o no se pudo guardar un snapshot unico.");
    }
    grantTemporaryTeleportExemption(requester);
    grantTemporaryTeleportExemption(player);
    try { requester.teleport(safeSpawnA, { dimension }); } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
    try { player.teleport(safeSpawnB, { dimension }); } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
    system.runTimeout(() => {
      try {
        if (!isInside(requester.location, requester.dimension.id, zone)) {
          grantTemporaryTeleportExemption(requester);
          runTeleportFallback(requester, safeSpawnA, zone.dimension);
        }
        if (!isInside(player.location, player.dimension.id, zone)) {
          grantTemporaryTeleportExemption(player);
          runTeleportFallback(player, safeSpawnB, zone.dimension);
        }
      } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
    }, 2);
    startColiseumCombatWarmup(match);
    requester.sendMessage(`§b§l[§4Coliseo§b§l]§r §a${player.name} aceptó el duelo. Teletransportando al coliseo §e${zone.name}§a.`);
    player.sendMessage(`§b§l[§4Coliseo§b§l]§r §aHas aceptado el duelo de §c${requester.name}§a. Teletransportando al coliseo §e${zone.name}§a.`);
    requester.sendMessage(`§7Entradas cobradas: §e$${COLISEUM_ENTRY_FEE} por jugador§7. Premio: §6$${COLISEUM_PVP_REWARD}§7; §c$${(COLISEUM_ENTRY_FEE * 2) - COLISEUM_PVP_REWARD} §7se retiran de circulación. El PvP se habilita en 10 segundos.`);
    player.sendMessage(`§7Entradas cobradas: §e$${COLISEUM_ENTRY_FEE} por jugador§7. Premio: §6$${COLISEUM_PVP_REWARD}§7; §c$${(COLISEUM_ENTRY_FEE * 2) - COLISEUM_PVP_REWARD} §7se retiran de circulación. El PvP se habilita en 10 segundos.`);
  } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    const activeMatchId = playerActiveColiseumMatch.get(requester.name.toLowerCase()) || playerActiveColiseumMatch.get(player.name.toLowerCase());
    if (activeMatchId) {
      const activeMatch = activeColiseumMatches.get(activeMatchId);
      if (activeMatch) {
        restoreColiseumSnapshot(activeMatch.zone, activeMatch.zoneSnapshot, (restored) => {
          const activeZoneKey = String(activeMatch.zone.id);
          if (restored && activeColiseumZoneMatches.get(activeZoneKey) === activeMatchId) activeColiseumZoneMatches.delete(activeZoneKey);
          if (!restored) quarantinedColiseumZones.add(activeZoneKey);
        });
      }
      activeColiseumMatches.delete(activeMatchId);
      playerActiveColiseumMatch.delete(requester.name.toLowerCase());
      playerActiveColiseumMatch.delete(player.name.toLowerCase());
    }
    if (requesterCharged) addBalance(requester, COLISEUM_ENTRY_FEE, { allowOverOperationalLimit: true });
    if (targetCharged) addBalance(player, COLISEUM_ENTRY_FEE, { allowOverOperationalLimit: true });
    player.sendMessage("§b§l[§4Coliseo§b§l]§r §cError al teletransportar a los jugadores: " + e.message);
  }

  coliseumRequests.delete(key);
}

function handleColiseumDeny(player) {
  const key = player.name.toLowerCase();
  const request = coliseumRequests.get(key);
  if (!request || (Date.now() - request.timestamp > COLISEUM_REQUEST_TIMEOUT_MS)) {
    if (request) coliseumRequests.delete(key);
    player.sendMessage("§b§l[§4Coliseo§b§l]§r §cNo tienes ninguna solicitud de PvP pendiente o ya expiró.");
    return;
  }

  const requester = world.getAllPlayers().find((candidate) => candidate.name.toLowerCase() === request.senderName.toLowerCase());
  if (requester) {
    requester.sendMessage(`§b§l[§4Coliseo§b§l]§r §c${player.name} rechazó tu solicitud de duelo.`);
  }

  player.sendMessage("§b§l[§4Coliseo§b§l]§r §cHas rechazado la solicitud de duelo.");
  coliseumRequests.delete(key);
}

// Interfaz GUI de Zonas
function openZonesGUI(player) {
  const db = loadZones();
  const isOp = isPlayerOp(player);

  // Filtrar zonas del jugador o todas si es Admin
  // Las zonas históricas en cuarentena por solapamiento no están activas y no
  // deben poder recibir permisos desde el menú: de lo contrario el nombre se
  // ve en la lista pero nunca concede acceso al terreno principal.
  const activeZones = db.filter((zone) => zone?.disabled !== true);
  const visibleZones = isOp ? activeZones : activeZones.filter(z => normalizeZonePlayerName(z.owner) === normalizeZonePlayerName(player.name));
  const selection = playerSelections.get(player.name);
  const quote = getSelectionQuote(selection?.pos1, selection?.pos2);
  const quoteText = quote?.price !== undefined
    ? `\n§7Tu selección actual: §e${quote.sizeX}x${quote.sizeZ} §7| Precio: §a${formatClaimMoney(quote.price)}§r\n`
    : "\n";
  const listText = visibleZones.length === 0
    ? "§7No tienes terrenos protegidos a tu nombre."
    : "§7Lista de protecciones de tu propiedad:";

  const form = new ActionFormData()
    .title("§e§lTus Terrenos Protegidos")
    .body(`Tu saldo actual: §a${formatClaimMoney(getBalance(player))}§r\n\n${CLAIM_PRICE_GUIDE}${quoteText}${listText}`);

  form.button("❔ ¿Cómo funciona? / Guía");

  if (visibleZones.length === 0) {
    form.button("❌ Cerrar");
    safeOpenForm(player, form, (response) => {
      if (response.selection === 0) {
        openProtectionTutorial(player);
      }
    });
    return;
  }

  visibleZones.forEach((z) => {
    const type = isColiseumZone(z) ? "§4[Coliseo]" : z.isAdmin ? "§c[Admin]" : "§a[Propia]";
    const dim = z.dimension.split(":")[1];
    form.button(`${type} ${z.name}\nDim: ${dim} | Trusted: ${z.trusted?.length || 0}`);
  });

  safeOpenForm(player, form, (response) => {
    const idx = response.selection;
    if (idx === undefined) return;

    if (idx === 0) {
      openProtectionTutorial(player);
      return;
    }

    const zoneIdx = idx - 1;
    if (zoneIdx >= 0 && zoneIdx < visibleZones.length) {
      openZoneDetail(player, visibleZones[zoneIdx]);
    }
  });
}

function openZoneDetail(player, zone) {
  const isOwner = normalizeZonePlayerName(zone.owner) === normalizeZonePlayerName(player.name) || isPlayerOp(player);
  const trustedList = zone.trusted && zone.trusted.length > 0 ? zone.trusted.join(", ") : "Ninguno";
  const zoneSizeX = Math.abs(Number(zone.max.x) - Number(zone.min.x)) + 1;
  const zoneSizeZ = Math.abs(Number(zone.max.z) - Number(zone.min.z)) + 1;
  const recordedPrice = Number.isSafeInteger(zone.pricePaid) ? formatClaimMoney(zone.pricePaid) : "Histórico/no registrado";

  const form = new ActionFormData()
    .title(`§dZona: ${zone.name}`)
    .body(`§7Detalles del terreno:\n` +
          `§7- Propietario: §e${zone.owner}\n` +
          `§7- Dimensión: §f${zone.dimension.split(":")[1]}\n` +
          `§7- Coordenadas Min: §bX: ${zone.min.x}, Z: ${zone.min.z}\n` +
          `§7- Coordenadas Max: §bX: ${zone.max.x}, Z: ${zone.max.z}\n` +
          `§7- Tamaño: §e${zoneSizeX}x${zoneSizeZ} bloques\n` +
          `§7- Precio pagado: §a${recordedPrice}\n` +
          `§7- Amigos agregados: §a${trustedList}\n\n` +
          `§7Estado: ${isColiseumZone(zone) ? "§4Coliseo PvP" : zone.isAdmin ? "§cSafezone Administrativa" : "§aProtección Privada"}`);

  if (isOwner && !zone.isAdmin) {
    form.button("➕ Agregar amigo (Trust)");
    form.button("➖ Quitar amigo (Untrust)");
    form.button("❌ Eliminar Protección");
  }
  
  form.button("🔙 Volver");

  safeOpenForm(player, form, (response) => {
    const idx = response.selection;
    if (idx === undefined) return;

    if (isOwner && !zone.isAdmin) {
      if (idx === 0) {
        // Agregar amigo
        openAddFriendForm(player, zone);
      } else if (idx === 1) {
        // Quitar amigo
        openRemoveFriendForm(player, zone);
      } else if (idx === 2) {
        // Eliminar
        const db = loadZones();
        const cleanDb = db.filter(z => z.id !== zone.id);
        saveZones(cleanDb);
        player.sendMessage(`§b§l[§3Protección§b§l]§r §aZona protegida §e"${zone.name}" §aeliminada.`);
      } else {
        openZonesGUI(player);
      }
    } else {
      openZonesGUI(player);
    }
  });
}

function openAddFriendForm(player, zone) {
  const form = new ModalFormData()
    .title("Agregar Amigo")
    .textField("Nombre del jugador (no importa mayúsculas):", "Nombre del amigo");

  // Ejecutar la escritura desde un tick del servidor. El callback directo de
  // ModalFormData puede terminar fuera de una ventana de escritura en BDS y
  // mostraba el nombre en la interfaz sin dejar el permiso operativo.
  safeOpenForm(player, form, (response) => {
    const targetName = response.formValues[0]?.trim();
    if (!targetName) return;

    const db = loadZonesForUpdate();
    const matchIdx = db.findIndex((candidate) => String(candidate.id) === String(zone.id));
    if (matchIdx === -1) {
      player.sendMessage("§b§l[§3Protección§b§l]§r §cNo se encontró esa protección. Vuelve a abrir el menú.");
      system.run(() => openZonesGUI(player));
      return;
    }

    // La ficha puede haber cambiado mientras el menú estaba abierto: se vuelve
    // a autorizar aquí tanto al dueño como al operador antes de escribir.
    const currentZone = db[matchIdx];
    if (currentZone.disabled === true) {
      player.sendMessage("§b§l[§3Protección§b§l]§r §cEsta protección está inactiva por solapamiento; administra el terreno principal activo.");
      system.run(() => openZonesGUI(player));
      return;
    }
    if (normalizeZonePlayerName(currentZone.owner) !== normalizeZonePlayerName(player.name) && !isPlayerOp(player)) {
      player.sendMessage("§b§l[§3Protección§b§l]§r §cNo tienes permiso para administrar esta protección.");
      system.run(() => openZonesGUI(player));
      return;
    }

    if (!Array.isArray(currentZone.trusted)) currentZone.trusted = [];
    const canonicalTarget = canonicalPlayerName(targetName);
    if (currentZone.trusted.some((entry) => normalizeZonePlayerName(entry) === normalizeZonePlayerName(canonicalTarget))) {
      player.sendMessage(`§b§l[§3Protección§b§l]§r §cEl jugador §e${canonicalTarget} §cya tiene permisos.`);
      system.run(() => openZonesGUI(player));
      return;
    }

    currentZone.trusted.push(canonicalTarget);
    if (saveZones(db)) {
      player.sendMessage(`§b§l[§3Protección§b§l]§r §aPermiso activado para §e${canonicalTarget}§a en §e${currentZone.name}§a.`);
    } else {
      player.sendMessage("§b§l[§3Protección§b§l]§r §cNo se pudieron guardar los permisos. Inténtalo de nuevo.");
    }
    system.run(() => openZonesGUI(player));
  });
}

function openRemoveFriendForm(player, zone) {
  const trusted = zone.trusted || [];
  if (trusted.length === 0) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cNo tienes ningún amigo agregado.");
    openZonesGUI(player);
    return;
  }

  const form = new ActionFormData()
    .title("Quitar Amigo")
    .body("Selecciona el amigo al que quieres quitarle los permisos:");

  trusted.forEach((t) => {
    form.button(t);
  });
  form.button("🔙 Volver");

  safeOpenForm(player, form, (response) => {
    const idx = response.selection;
    if (idx === undefined || idx === trusted.length) {
      openZonesGUI(player);
      return;
    }

    const targetName = trusted[idx];
    const db = loadZonesForUpdate();
    const matchIdx = db.findIndex(z => z.id === zone.id);
    if (matchIdx !== -1) {
      db[matchIdx].trusted = (db[matchIdx].trusted || []).filter((entry) => normalizeZonePlayerName(entry) !== normalizeZonePlayerName(targetName));
      saveZones(db);
      player.sendMessage(`§b§l[§3Protección§b§l]§r §aHas retirado los permisos de §e${targetName}§a.`);
    }
    openZonesGUI(player);
  });
}

function openProtectionTutorial(player) {
  const form = new ActionFormData()
    .title("❔ Guía de Protección")
    .body("§e¿Cómo proteger tus construcciones?\n\n" +
          "§a1. Definir los límites:\n" +
          "§7- Ve a una esquina de tu base y usa: §e/s:pos1\n" +
          "§7- Ve a la esquina opuesta diagonalmente y usa: §e/s:pos2\n\n" +
          "§a2. Guardar la protección:\n" +
          "§7- Usa: §e/s:proteger <nombre> §7(ej: §e/s:proteger MiBase§7).\n" +
          "§7- Tu base se protegerá desde el suelo hasta el cielo (bloquea colocar, romper, abrir cofres o puertas a extraños).\n\n" +
          "§a3. Compartir permisos:\n" +
          "§7- Si quieres que un amigo construya contigo, párate en tu base y usa: §e/s:zona trust <amigo>\n" +
          "§7- Para quitárselo usa: §e/s:zona untrust <amigo>\n\n" +
          "§a4. Qué queda bloqueado:\n" +
          "§7- Extraños no podrán romper, colocar, abrir cofres, barriles, hornos, shulkers, tolvas, puertas, camas, mesas funcionales,\n" +
          "§7  usar cubetas, ni interactuar con armor stands, item frames, aldeanos o vehículos con cofre dentro de tu terreno.\n\n" +
          "§a5. Costo y límite:\n" +
          `§7- ${CLAIM_PRICE_GUIDE}\n` +
          "§7- El precio se calcula exactamente con el ancho por el largo; los rectángulos también están permitidos.\n" +
          `§7- Cada jugador puede tener un máximo de §e1 terreno §7de hasta §e${CLAIM_MAX_SIZE}x${CLAIM_MAX_SIZE} bloques§7.`)
    .button("🔙 Volver");

  safeOpenForm(player, form, () => {
    openZonesGUI(player);
  });
}

// 6. Evitar que aparezcan monstruos, criaturas pasivas, ítems tirados y esferas de XP en zonas administrativas (Safezones)
const BLOCKED_MOBS = [
  // Hostiles
  "minecraft:zombie", "minecraft:skeleton", "minecraft:creeper", "minecraft:spider",
  "minecraft:cave_spider", "minecraft:enderman", "minecraft:witch", "minecraft:slime",
  "minecraft:zombie_villager", "minecraft:drowned", "minecraft:husk", "minecraft:stray",
  "minecraft:phantom", "minecraft:piglin", "minecraft:hoglin", "minecraft:zoglin",
  "minecraft:wither_skeleton", "minecraft:ghast", "minecraft:blaze", "minecraft:magma_cube",
  "minecraft:endermite", "minecraft:shulker", "minecraft:ravager", "minecraft:pillager",
  "minecraft:evoker", "minecraft:vex", "minecraft:warden", "minecraft:silverfish",
  "minecraft:guardian", "minecraft:elder_guardian", "minecraft:wither",
  // Pasivos / Aliados
  "minecraft:cow", "minecraft:sheep", "minecraft:pig", "minecraft:chicken",
  "minecraft:horse", "minecraft:donkey", "minecraft:mule", "minecraft:llama",
  "minecraft:trader_llama", "minecraft:wolf", "minecraft:cat", "minecraft:ocelot",
  "minecraft:parrot", "minecraft:rabbit", "minecraft:bat", "minecraft:villager",
  "minecraft:wandering_trader", "minecraft:iron_golem", "minecraft:snow_golem",
  "minecraft:squid", "minecraft:glow_squid", "minecraft:axolotl", "minecraft:bee",
  "minecraft:fox", "minecraft:goat", "minecraft:frog", "minecraft:tadpole",
  "minecraft:sniffer", "minecraft:camel", "minecraft:armadillo", "minecraft:allay",
  // Objetos y Entidades del Suelo (Previene lag y basura)
  "minecraft:item", "minecraft:xp_orb"
];

const entitySpawnEvent = world.afterEvents.entitySpawn || world.afterEvents.entityCreate;
if (entitySpawnEvent) {
  try {
    entitySpawnEvent.subscribe((event) => {
      const entity = event.entity;
      if (!entity) return;

      // Un rayo es una entidad temporal: hay que retirarlo en el mismo evento
      // de aparición, antes de que pueda encender bloques o causar daño. Esto
      // protege tanto las safezones como los terrenos privados de eventos como
      // la Súper Tormenta; los rayos continúan funcionando fuera de las zonas.
      if (entity.typeId === "minecraft:lightning_bolt") {
        try {
          const zones = getZonesAt(entity.location, entity.dimension.id);
          if (zones.length > 0 && zones.some((zone) => !zone.disabled && !isColiseumZone(zone))) {
            entity.remove();
            console.warn(`[PROTECTED_LIGHTNING_GUARD] blocked dimension=${entity.dimension.id} x=${Math.floor(entity.location.x)} y=${Math.floor(entity.location.y)} z=${Math.floor(entity.location.z)}`);
          }
        } catch (err) {
          ErrorReporter.report(err, { addonId: "protection_addon", moduleId: "main.js", operation: "protectedLightningGuard", category: "runtime" });
        }
        return;
      }

      system.run(() => {
        try {
          if (!entity.isValid) return;
          const typeId = entity.typeId;
          if (typeId === "minecraft:wither" && removeWitherInProtectedZone(entity, "spawn")) return;
          
          if (BLOCKED_MOBS.includes(typeId)) {
            const loc = entity.location;
            const dimId = entity.dimension.id;
            const zones = getZonesAt(loc, dimId);
            
            // Si la criatura spawnea dentro de una zona admin (que no sea coliseo ni comunitaria), la eliminamos al instante
            if (zones.some(z => z.isAdmin && !isColiseumZone(z) && !z.isCommunity && z.zoneType !== "community")) {
              entity.remove();
            }
          }
        } catch (err) { ErrorReporter.report(err, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
      });
    });
  } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn("Error al registrar entitySpawn: " + e);
  }
}

// El Wither puede destruir bloques sin pasar por eventos de jugador. El barrido
// cubre Withers que crucen hacia una protección después de haber aparecido.
system.runInterval(() => {
  for (const dimensionId of ["overworld", "nether", "the_end"]) {
    try {
      const dimension = world.getDimension(dimensionId);
      for (const wither of dimension.getEntities({ type: "minecraft:wither" })) {
        removeWitherInProtectedZone(wither, "sweep");
      }
    } catch (error) {
      ErrorReporter.report(error, { addonId: "protection_addon", moduleId: "main.js", operation: "witherGuardSweep", category: "runtime" });
    }
  }
}, 20);

// 7. Evitar efectos de pociones dañinas en zonas administrativas (Safezones)
const HARMFUL_EFFECTS = [
  "poison", "instant_damage", "slowness", "weakness", "wither", 
  "nausea", "blindness", "hunger", "fatal_poison", "darkness", "bad_omen"
];

try {
  world.afterEvents.effectAdd.subscribe((event) => {
    const entity = event.entity;
    if (!entity || entity.typeId !== "minecraft:player") return;

    const effect = event.effect;
    if (!effect) return;

    const effectId = effect.typeId;
    if (HARMFUL_EFFECTS.includes(effectId)) {
      const loc = entity.location;
      const dimId = entity.dimension.id;
      const zones = getZonesAt(loc, dimId);
      
      // Si el jugador está dentro de una zona administrativa protegida, le removemos el efecto dañino
      if (zones.some(z => z.isAdmin && !isColiseumZone(z))) {
        system.run(() => {
          try {
            if (entity.isValid) {
              entity.removeEffect(effectId);
            }
          } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
        });
      }
    }
  });
} catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("Error al registrar effectAdd: " + e);
}

// ============================================================================
// PUENTE DE COLISEO PARA CLANS ADDON
// ============================================================================
system.runInterval(() => {
  try {
    const coliseums = loadZones().filter(isColiseumZone);
    const activeId = getActiveColiseumId();
    const payload = { activeId: activeId, zones: coliseums };
    const message = JSON.stringify(payload);
    world.getDimension("overworld").runCommand(`scriptevent clans:sync_coliseums ${message}`);
  } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn("[ColiseumSync] Error en el intervalo: " + e + "\\n" + e.stack);
  }
}, 200);

system.runInterval(() => {
  try {
    const players = world.getAllPlayers();
    for (const player of players) {
      if (player.hasTag(TELEPORT_EXEMPT_TAG) || isPlayerOp(player)) continue;

      // 1. Expulsión de Coliseo
      const coliseumZone = getColiseumAtPlayer(player);
      if (coliseumZone) {
        const matchId = getActiveColiseumMatchForPlayer(player);
        const isBounty = player.hasTag("bounty_target") || player.hasTag("bounty_hunter");
        if (!matchId && !isBounty) {
          const minX = coliseumZone.min.x;
          const maxX = coliseumZone.max.x;
          const minZ = coliseumZone.min.z;
          const maxZ = coliseumZone.max.z;
          const x = player.location.x;
          const z = player.location.z;

          const distMinX = Math.abs(x - minX);
          const distMaxX = Math.abs(x - maxX);
          const distMinZ = Math.abs(z - minZ);
          const distMaxZ = Math.abs(z - maxZ);
          const minDist = Math.min(distMinX, distMaxX, distMinZ, distMaxZ);

          let targetX = x;
          let targetZ = z;

          if (minDist === distMinX) targetX = minX - 2;
          else if (minDist === distMaxX) targetX = maxX + 2;
          else if (minDist === distMinZ) targetZ = minZ - 2;
          else if (minDist === distMaxZ) targetZ = maxZ + 2;

          const dest = { x: targetX, y: player.location.y, z: targetZ };
          const safePos = getSafeTeleportPosition(player.dimension, dest);
          
          grantTemporaryTeleportExemption(player);
          player.teleport(safePos, { dimension: player.dimension });
          player.sendMessage("§b§l[§4Coliseo§b§l]§r §cNo puedes estar en el coliseo si no estás en un duelo activo. Has sido expulsado para evitar campeo.");
          continue;
        }
      }

      // 2. Terrenos privados: solo entra el dueño o alguien en /trust.
      // Las safezones y zonas comunitarias no se expulsan con esta regla.
      const privateZone = getZonesAt(player.location, player.dimension.id)
        .find((zone) => isPrivateClaimZone(zone) && !hasPrivateZoneAccess(player, zone));
      if (privateZone) {
        ejectFromPrivateZone(player, privateZone);
      }
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
}, 20);

// --- SISTEMA DE ADMINISTRACIÓN DE ZONAS COMUNITARIAS ---
function handleAdminCommunityCommand(player, nombre = "") {
  if (!isPlayerOp(player)) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cSolo los operadores pueden usar comandos de comunidad.");
    return;
  }

  const sel = playerSelections.get(player.name);
  const cleanName = String(nombre || "").trim();

  // Si especificó un nombre o si tiene esquinas seleccionadas: intentamos crear la zona comunitaria
  if (cleanName || (sel && sel.pos1 && sel.pos2)) {
    if (!sel || !sel.pos1 || !sel.pos2) {
      player.sendMessage("§b§l[§3Protección§b§l]§r §cDebes establecer ambas esquinas con §e/s:adminpos1 §cy §e/s:adminpos2 §cprimero.");
      return;
    }
    const min = {
      x: Math.min(sel.pos1.x, sel.pos2.x), y: Math.min(sel.pos1.y, sel.pos2.y), z: Math.min(sel.pos1.z, sel.pos2.z),
    };
    const max = {
      x: Math.max(sel.pos1.x, sel.pos2.x), y: Math.max(sel.pos1.y, sel.pos2.y), z: Math.max(sel.pos1.z, sel.pos2.z),
    };
    const corners = [
      { x: min.x, y: min.y, z: min.z }, { x: min.x, y: min.y, z: max.z },
      { x: max.x, y: max.y, z: min.z }, { x: max.x, y: max.y, z: max.z },
    ];
    const isInsideExistingCommunity = loadZones().some((zone) =>
      !zone?.disabled && (zone.isCommunity === true || zone.zoneType === "community") &&
      corners.every((corner) => isInside(corner, sel.pos1.dimension, zone))
    );
    if (isInsideExistingCommunity) {
      // Las mismas esquinas también se usan para crear áreas de acceso pagado.
      // La TNT sigue usando /s:admincomauto; el menú conserva la selección.
      openAdminCommunityGUI(player);
      return;
    }
    const finalName = cleanName || `Comunitaria_${Date.now().toString().slice(-4)}`;
    handleClaim(player, finalName, true, true);
    return;
  }

  // Si no hay selección de esquinas ni nombre, abrir GUI de gestión comunitaria
  openAdminCommunityGUI(player);
}

function handleCreateAutomationArea(player, name) {
  if (!isPlayerOp(player)) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cSolo los operadores pueden crear subáreas de automatización.");
    return;
  }

  const cleanName = String(name || "").trim();
  if (!cleanName || cleanName.length > 32) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cUso: §e/s:adminautomatizacion <nombre>§c (máximo 32 caracteres).");
    return;
  }

  const selection = playerSelections.get(player.name);
  if (!selection?.pos1 || !selection?.pos2 || selection.pos1.dimension !== selection.pos2.dimension) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cDefine las dos esquinas con §e/s:adminpos1 §cy §e/s:adminpos2§c en la misma dimensión.");
    return;
  }

  const min = {
    x: Math.min(selection.pos1.x, selection.pos2.x),
    y: Math.min(selection.pos1.y, selection.pos2.y),
    z: Math.min(selection.pos1.z, selection.pos2.z),
  };
  const max = {
    x: Math.max(selection.pos1.x, selection.pos2.x),
    y: Math.max(selection.pos1.y, selection.pos2.y),
    z: Math.max(selection.pos1.z, selection.pos2.z),
  };
  const dimension = selection.pos1.dimension;
  const corners = [
    { x: min.x, y: min.y, z: min.z }, { x: min.x, y: min.y, z: max.z },
    { x: max.x, y: max.y, z: min.z }, { x: max.x, y: max.y, z: max.z },
  ];
  const db = loadZonesForUpdate();
  const parent = db.find((zone) =>
    !zone?.disabled && (zone.isCommunity === true || zone.zoneType === "community") &&
    corners.every((corner) => isInside(corner, dimension, zone))
  );
  if (!parent) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cLa subárea debe quedar completamente dentro de una única zona comunitaria.");
    return;
  }

  const areas = Array.isArray(parent.automationAreas) ? parent.automationAreas : [];
  const duplicate = areas.some((area) => String(area?.name || "").toLowerCase() === cleanName.toLowerCase());
  const overlap = areas.some((area) =>
    area?.min && area?.max &&
    min.x <= area.max.x && max.x >= area.min.x &&
    min.z <= area.max.z && max.z >= area.min.z
  );
  if (duplicate || overlap) {
    player.sendMessage(`§b§l[§3Protección§b§l]§r §c${duplicate ? "Ya existe una subárea con ese nombre." : "La selección se cruza con otra subárea de automatización."}`);
    return;
  }

  areas.push({
    id: `automation_${Date.now()}`,
    name: cleanName,
    min: { x: min.x, y: -64, z: min.z },
    max: { x: max.x, y: 320, z: max.z },
    createdAt: Date.now(),
  });
  parent.automationAreas = areas;
  if (!saveZones(db)) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cNo se pudo guardar la subárea. No se modificó la protección.");
    return;
  }
  playerSelections.delete(player.name);
  player.sendMessage(`§b§l[§3Protección§b§l]§r §aSubárea §e${cleanName}§a creada en §e${parent.name}§a. Solo TNT dentro de sus límites podrá romper bloques.`);
}

function handleCommunitySupplyChest(player, requestedType) {
  if (!isPlayerOp(player)) {
    player.sendMessage("§b§l[§3Suministros§b§l]§r §cSolo los operadores pueden registrar cofres de suministro.");
    return;
  }

  const normalized = String(requestedType || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  const type = normalized === "tnt" ? "tnt" :
    (normalized === "hueso" || normalized === "polvodehueso" || normalized === "bonemeal" ? "hueso" : undefined);
  if (!type && normalized !== "eliminar" && normalized !== "remove") {
    player.sendMessage("§b§l[§3Suministros§b§l]§r §cTipo de suministro inválido.");
    return;
  }

  let block;
  try {
    block = player.getBlockFromViewDirection?.({ maxDistance: 8 })?.block;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "protection_addon", moduleId: "main.js", operation: "communitySupplyTarget", category: "runtime" });
  }
  if (!block || (block.typeId !== "minecraft:chest" && block.typeId !== "minecraft:trapped_chest")) {
    player.sendMessage("§b§l[§3Suministros§b§l]§r §cMira directamente a un cofre simple, a menos de 8 bloques.");
    return;
  }

  const pos = { x: block.x, y: block.y, z: block.z };
  const dimId = block.dimension.id;
  const zonesAtChest = getZonesAt(pos, dimId);
  const isExclusiveCommunity = zonesAtChest.length > 0 && zonesAtChest.every((zone) => zone.isCommunity === true || zone.zoneType === "community");
  if (!isExclusiveCommunity) {
    player.sendMessage("§b§l[§3Suministros§b§l]§r §cEl cofre debe estar dentro de una zona comunitaria sin solaparse con otra protección.");
    return;
  }

  const db = loadZonesForUpdate();
  const zone = db.find((candidate) =>
    !candidate?.disabled && (candidate.isCommunity === true || candidate.zoneType === "community") &&
    isInside(pos, dimId, candidate)
  );
  if (!zone) {
    player.sendMessage("§b§l[§3Suministros§b§l]§r §cNo se pudo identificar la zona comunitaria de este cofre.");
    return;
  }

  const supplies = Array.isArray(zone.supplyChests) ? zone.supplyChests : [];
  const index = supplies.findIndex((supply) => supply?.x === pos.x && supply?.y === pos.y && supply?.z === pos.z);
  if (normalized === "eliminar" || normalized === "remove") {
    if (index < 0) {
      player.sendMessage("§b§l[§3Suministros§b§l]§r §eEse cofre no estaba registrado como suministro.");
      return;
    }
    supplies.splice(index, 1);
    zone.supplyChests = supplies;
    if (!saveZones(db)) {
      player.sendMessage("§b§l[§3Suministros§b§l]§r §cNo se pudo retirar el registro del cofre.");
      return;
    }
    player.sendMessage("§b§l[§3Suministros§b§l]§r §aCofre de suministro retirado. Vuelve a comportarse como un cofre comunitario normal.");
    return;
  }

  const record = { id: `supply_${Date.now()}`, type, x: pos.x, y: pos.y, z: pos.z, createdAt: Date.now() };
  if (index >= 0) supplies[index] = { ...supplies[index], ...record };
  else supplies.push(record);
  zone.supplyChests = supplies;
  if (!saveZones(db)) {
    player.sendMessage("§b§l[§3Suministros§b§l]§r §cNo se pudo guardar el cofre de suministro.");
    return;
  }
  refillCommunitySupplyChest(zone, record);
  const label = type === "tnt" ? "TNT" : "polvo de hueso";
  player.sendMessage(`§b§l[§3Suministros§b§l]§r §aCofre de §e${label}§a registrado en §e${zone.name}§a. Se rellena cada 5 segundos y queda bloqueado para jugadores.`);
}

function openCreatePaidFarmDialog(player) {
  const form = new ModalFormData()
    .title("💳 Crear área de granja pagada")
    .textField("Nombre de la granja:", "Ej: Madera TNT")
    .textField("Precio por acceso de 20 minutos:", "Ej: 500");
  safeOpenForm(player, form, (res) => {
    const name = String(res.formValues?.[0] || "").trim();
    const price = Math.floor(Number(res.formValues?.[1]) || 0);
    handleCreatePaidFarmArea(player, name, price);
  });
}

function handleCreatePaidFarmArea(player, name, price) {
  const selection = playerSelections.get(player.name);
  if (!selection?.pos1 || !selection?.pos2 || selection.pos1.dimension !== selection.pos2.dimension) {
    player.sendMessage("§b§l[§dGranja§b§l]§r §cDefine el área con §e/s:adminpos1 §cy §e/s:adminpos2§c.");
    return;
  }
  if (!name || name.length > 32 || !Number.isSafeInteger(price) || price <= 0 || price > 1000000) {
    player.sendMessage("§b§l[§dGranja§b§l]§r §cNombre o precio inválido. El precio debe ser entre $1 y $1,000,000.");
    return;
  }
  const min = { x: Math.min(selection.pos1.x, selection.pos2.x), y: Math.min(selection.pos1.y, selection.pos2.y), z: Math.min(selection.pos1.z, selection.pos2.z) };
  const max = { x: Math.max(selection.pos1.x, selection.pos2.x), y: Math.max(selection.pos1.y, selection.pos2.y), z: Math.max(selection.pos1.z, selection.pos2.z) };
  const dimension = selection.pos1.dimension;
  const corners = [{ x:min.x,y:min.y,z:min.z }, { x:min.x,y:min.y,z:max.z }, { x:max.x,y:max.y,z:min.z }, { x:max.x,y:max.y,z:max.z }];
  const db = loadZonesForUpdate();
  const parent = db.find((zone) => !zone?.disabled && (zone.isCommunity === true || zone.zoneType === "community") && corners.every((corner) => isInside(corner, dimension, zone)));
  if (!parent) {
    player.sendMessage("§b§l[§dGranja§b§l]§r §cEl área debe quedar completamente dentro de una zona comunitaria.");
    return;
  }
  const areas = Array.isArray(parent.paidFarmAreas) ? parent.paidFarmAreas : [];
  const duplicate = areas.some((area) => String(area?.name || "").toLowerCase() === name.toLowerCase());
  const overlap = areas.some((area) => area?.min && area?.max && min.x <= area.max.x && max.x >= area.min.x && min.y <= area.max.y && max.y >= area.min.y && min.z <= area.max.z && max.z >= area.min.z);
  if (duplicate || overlap) {
    player.sendMessage(`§b§l[§dGranja§b§l]§r §c${duplicate ? "Ya existe una granja con ese nombre." : "La selección se cruza con otra área pagada."}`);
    return;
  }
  const lobby = { x: player.location.x, y: player.location.y, z: player.location.z };
  const entry = { x: Math.floor((min.x + max.x) / 2) + 0.5, y: min.y + 1, z: Math.floor((min.z + max.z) / 2) + 0.5 };
  areas.push({ id: `paid_farm_${Date.now()}`, name, price, min, max, lobby, entry, createdAt: Date.now() });
  parent.paidFarmAreas = areas;
  if (!saveZones(db)) {
    player.sendMessage("§b§l[§dGranja§b§l]§r §cNo se pudo guardar el área pagada.");
    return;
  }
  playerSelections.delete(player.name);
  player.sendMessage(`§b§l[§dGranja§b§l]§r §aÁrea §e${name}§a creada. Sala: tu posición actual. Precio: §e$${price}§a por 20 min. Entra a la granja y usa el menú para fijar el TP exacto.`);
}

function handleSetPaidFarmEntry(player) {
  const found = getPaidFarmAreaAt(player.location, player.dimension.id);
  if (!found) {
    player.sendMessage("§b§l[§dGranja§b§l]§r §cDebes estar dentro del área pagada para fijar su punto de entrada.");
    return;
  }
  const db = loadZonesForUpdate();
  const zone = db.find((candidate) => candidate.id === found.zone.id);
  const area = zone?.paidFarmAreas?.find((candidate) => candidate.id === found.area.id);
  if (!area) return;
  area.entry = { x: player.location.x, y: player.location.y, z: player.location.z };
  if (saveZones(db)) player.sendMessage("§b§l[§dGranja§b§l]§r §aPunto de teletransporte de entrada actualizado.");
}

function openSetPaidFarmLobbyDialog(player) {
  const candidates = loadZones().flatMap((zone) => (matchDimension(zone?.dimension, player.dimension.id) ? (zone.paidFarmAreas || []).map((area) => ({ zone, area })) : []));
  if (!candidates.length) {
    player.sendMessage("§b§l[§dGranja§b§l]§r §cNo hay áreas pagadas en esta dimensión.");
    return;
  }
  const form = new ActionFormData().title("📍 Fijar salida / retorno").body("Tu posición actual será la recepción exterior a la que se envía al jugador al terminar sus 20 minutos.");
  for (const candidate of candidates) form.button(candidate.area.name);
  safeOpenForm(player, form, (res) => {
    const selected = candidates[res.selection];
    if (!selected) return;
    const db = loadZonesForUpdate();
    const zone = db.find((candidate) => candidate.id === selected.zone.id);
    const area = zone?.paidFarmAreas?.find((candidate) => candidate.id === selected.area.id);
    if (!area) return;
    area.lobby = { x: player.location.x, y: player.location.y, z: player.location.z };
    if (saveZones(db)) player.sendMessage(`§b§l[§dGranja§b§l]§r §aSalida de §e${area.name}§a configurada en tu posición actual.`);
  });
}

function openRegisterPaidFarmButtonDialog(player) {
  let block;
  try { block = player.getBlockFromViewDirection?.({ maxDistance: 8 })?.block; } catch (e) {}
  if (!block || !String(block.typeId || "").includes("button")) {
    player.sendMessage("§b§l[§dGranja§b§l]§r §cMira a un botón, a menos de 8 bloques.");
    return;
  }
  const candidates = loadZones().flatMap((zone) => (matchDimension(zone?.dimension, block.dimension.id) ? (zone.paidFarmAreas || []).map((area) => ({ zone, area })) : []));
  if (!candidates.length) {
    player.sendMessage("§b§l[§dGranja§b§l]§r §cNo hay áreas pagadas en esta dimensión.");
    return;
  }
  const form = new ActionFormData().title("💳 Vincular botón de pago").body("Selecciona qué granja activará este botón.");
  for (const candidate of candidates) form.button(`${candidate.area.name}\n$${candidate.area.price} / 20 min`);
  safeOpenForm(player, form, (res) => {
    const selected = candidates[res.selection];
    if (!selected) return;
    const db = loadZonesForUpdate();
    const zone = db.find((candidate) => candidate.id === selected.zone.id);
    const area = zone?.paidFarmAreas?.find((candidate) => candidate.id === selected.area.id);
    if (!area) return;
    area.button = { x: block.x, y: block.y, z: block.z };
    if (saveZones(db)) {
      console.warn(`[PAID_FARM] button_linked area=${area.id} at=${block.x},${block.y},${block.z} dimension=${zone.dimension}`);
      player.sendMessage(`§b§l[§dGranja§b§l]§r §aBotón vinculado a §e${area.name}§a.`);
    }
  });
}

function openDeletePaidFarmDialog(player, zoneId) {
  if (!isPlayerOp(player)) {
    player.sendMessage("§b§l[§dGranja§b§l]§r §cSolo los operadores pueden eliminar áreas pagadas.");
    return;
  }
  const zone = loadZones().find((candidate) => candidate?.id === zoneId && (candidate.isCommunity === true || candidate.zoneType === "community"));
  if (!zone || !isInside(player.location, player.dimension.id, zone)) {
    player.sendMessage("§b§l[§dGranja§b§l]§r §cDebes estar dentro de la zona comunitaria para administrar sus áreas pagadas.");
    return;
  }
  const areas = Array.isArray(zone.paidFarmAreas) ? zone.paidFarmAreas.filter((area) => area?.id) : [];
  if (!areas.length) {
    player.sendMessage("§b§l[§dGranja§b§l]§r §eNo hay áreas pagadas para eliminar en esta zona.");
    return;
  }
  const form = new ActionFormData()
    .title("🗑 Eliminar área pagada")
    .body("Selecciona el área que quieres eliminar. Después se pedirá confirmación.");
  for (const area of areas) form.button(`${area.name || "Sin nombre"}\n§c$${area.price || 0} / 20 min`);
  form.button("🔙 Volver");
  safeOpenForm(player, form, (res) => {
    const selected = areas[res.selection];
    if (!selected) {
      openAdminCommunityGUI(player);
      return;
    }
    openConfirmDeletePaidFarmDialog(player, zoneId, selected.id);
  }, () => openAdminCommunityGUI(player));
}

function openConfirmDeletePaidFarmDialog(player, zoneId, areaId) {
  const zone = loadZones().find((candidate) => candidate?.id === zoneId && (candidate.isCommunity === true || candidate.zoneType === "community"));
  const area = zone?.paidFarmAreas?.find((candidate) => candidate?.id === areaId);
  if (!zone || !area) {
    player.sendMessage("§b§l[§dGranja§b§l]§r §cEl área pagada ya no existe.");
    return;
  }
  const form = new ModalFormData()
    .title("⚠ Confirmar eliminación")
    .toggle(`Eliminar permanentemente \"${area.name || "Sin nombre"}\". Los jugadores con acceso activo serán devueltos a la recepción.`, { defaultValue: false });
  safeOpenForm(player, form, (res) => {
    if (!res.formValues?.[0]) {
      openDeletePaidFarmDialog(player, zoneId);
      return;
    }
    deletePaidFarmArea(player, zoneId, areaId);
  }, () => openDeletePaidFarmDialog(player, zoneId));
}

function deletePaidFarmArea(player, zoneId, areaId) {
  if (!isPlayerOp(player)) return;
  const db = loadZonesForUpdate();
  const zone = db.find((candidate) => candidate?.id === zoneId && (candidate.isCommunity === true || candidate.zoneType === "community"));
  if (!zone || !isInside(player.location, player.dimension.id, zone)) {
    player.sendMessage("§b§l[§dGranja§b§l]§r §cDebes estar dentro de la zona comunitaria para eliminar esa área.");
    return;
  }
  const area = zone.paidFarmAreas?.find((candidate) => candidate?.id === areaId);
  if (!area) {
    player.sendMessage("§b§l[§dGranja§b§l]§r §cEl área pagada ya no existe.");
    return;
  }
  zone.paidFarmAreas = zone.paidFarmAreas.filter((candidate) => candidate?.id !== areaId);
  if (!saveZones(db)) {
    player.sendMessage("§b§l[§dGranja§b§l]§r §cNo se pudo eliminar el área pagada; no se aplicaron cambios.");
    return;
  }

  for (const target of world.getAllPlayers()) {
    const session = getPaidFarmSession(target);
    if (session?.areaId !== areaId) continue;
    if (area.lobby) teleportToPaidFarmPoint(target, area.lobby, zone.dimension);
    setPaidFarmSession(target, undefined);
    target.sendMessage("§b§l[§dGranja§b§l]§r §eEl área pagada fue retirada por administración; tu acceso fue cancelado.");
  }
  console.warn(`[PAID_FARM] deleted admin=${player.name} area=${areaId} zone=${zoneId}`);
  player.sendMessage(`§b§l[§dGranja§b§l]§r §aÁrea pagada §e${area.name || "Sin nombre"}§a eliminada.`);
  system.run(() => openAdminCommunityGUI(player));
}

function handleDeleteAutomationArea(player, name) {
  if (!isPlayerOp(player)) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cSolo los operadores pueden eliminar subáreas de automatización.");
    return;
  }
  const cleanName = String(name || "").trim().toLowerCase();
  if (!cleanName) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cUso: §e/s:adminautomatizacioneliminar <nombre>§c.");
    return;
  }
  const db = loadZonesForUpdate();
  const zone = db.find((candidate) =>
    (candidate.isCommunity === true || candidate.zoneType === "community") &&
    isInside(player.location, player.dimension.id, candidate) &&
    Array.isArray(candidate.automationAreas) &&
    candidate.automationAreas.some((area) => String(area?.name || "").toLowerCase() === cleanName)
  );
  if (!zone) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cNo se encontró esa subárea en la zona comunitaria donde estás.");
    return;
  }
  zone.automationAreas = zone.automationAreas.filter((area) => String(area?.name || "").toLowerCase() !== cleanName);
  if (!saveZones(db)) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cNo se pudo eliminar la subárea.");
    return;
  }
  player.sendMessage("§b§l[§3Protección§b§l]§r §aSubárea de automatización eliminada. La TNT vuelve a estar bloqueada ahí.");
}

function openAdminCommunityGUI(player) {
  const zones = loadZones();
  const loc = player.location;
  const currentZones = getZonesAt({ x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) }, player.dimension.id);
  
  const form = new ActionFormData()
    .title("§d🏛 §lAdministración Comunitaria")
    .body("§7Alterna el estado comunitario. Las subáreas TNT permiten automatización solo dentro de sus propios límites:");
    
  if (currentZones.length > 0) {
    const cz = currentZones[0];
    const isComm = !!cz.isCommunity;
    form.button(`⚙️ Alternar zona actual:\n${cz.name || "Sin nombre"} (${isComm ? "§aCOMUNITARIA" : "§cPRIVADA"})`);
  } else {
    form.button("❌ No estás sobre ninguna protección");
  }
  
  form.button("📋 Listado de Todas las Protecciones");
  const currentCommunity = currentZones.find((zone) => zone.isCommunity === true || zone.zoneType === "community");
  const actions = new Map();
  if (currentCommunity) {
    let buttonIndex = 2;
    form.button("💳 Crear área de acceso pagado\n§8Requiere /s:adminpos1 y /s:adminpos2"); actions.set(buttonIndex++, () => openCreatePaidFarmDialog(player));
    form.button("🗑 Eliminar área de acceso pagado\n§8Cancela los accesos activos de esa área"); actions.set(buttonIndex++, () => openDeletePaidFarmDialog(player, currentCommunity.id));
    form.button("🔘 Vincular botón de pago\n§8Mira al botón antes de elegirlo"); actions.set(buttonIndex++, () => openRegisterPaidFarmButtonDialog(player));
    form.button("📍 Fijar TP de entrada de granja\n§8Debes estar dentro del área pagada"); actions.set(buttonIndex++, () => handleSetPaidFarmEntry(player));
    form.button("🚪 Fijar salida / retorno\n§8Tu posición actual será la recepción exterior"); actions.set(buttonIndex++, () => openSetPaidFarmLobbyDialog(player));
    form.button("📦 Registrar cofre TNT\n§8Mira al cofre antes de elegirlo"); actions.set(buttonIndex++, () => handleCommunitySupplyChest(player, "tnt"));
    form.button("🦴 Registrar cofre de polvo de hueso\n§8Mira al cofre antes de elegirlo"); actions.set(buttonIndex++, () => handleCommunitySupplyChest(player, "hueso"));
    form.button("🗑 Retirar cofre de suministro\n§8Mira al cofre antes de elegirlo"); actions.set(buttonIndex++, () => handleCommunitySupplyChest(player, "eliminar"));
    form.button("🧨 Gestionar subáreas TNT"); actions.set(buttonIndex++, () => openAutomationAreasGUI(player, currentCommunity.id));
  }
  form.button("❌ Cerrar");
  
  safeOpenForm(player, form, (res) => {
    if (res.selection === 0) {
      if (currentZones.length > 0) {
        toggleZoneCommunityStatus(player, currentZones[0].id);
      } else {
        openAdminCommunityGUI(player);
      }
    } else if (res.selection === 1) {
      openListAllZonesCommunity(player);
    } else {
      actions.get(res.selection)?.();
    }
  });
}

function openAutomationAreasGUI(player, zoneId) {
  const zone = loadZones().find((candidate) => candidate.id === zoneId && (candidate.isCommunity === true || candidate.zoneType === "community"));
  if (!zone || !isInside(player.location, player.dimension.id, zone)) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cDebes estar dentro de la zona comunitaria para administrar sus subáreas.");
    return;
  }
  const areas = Array.isArray(zone.automationAreas) ? zone.automationAreas : [];
  const form = new ActionFormData()
    .title("🧨 Subáreas de Automatización")
    .body("§7Toca una subárea para eliminarla. Al eliminarla, la TNT vuelve a estar bloqueada inmediatamente.");
  for (const area of areas) {
    form.button(`🗑 ${area.name}\n§8${area.min.x},${area.min.y},${area.min.z} → ${area.max.x},${area.max.y},${area.max.z}`);
  }
  form.button("🔙 Volver");
  safeOpenForm(player, form, (res) => {
    if (res.selection === areas.length) {
      openAdminCommunityGUI(player);
      return;
    }
    const area = areas[res.selection];
    if (!area) return;
    handleDeleteAutomationArea(player, area.name);
    system.run(() => openAdminCommunityGUI(player));
  });
}

function toggleZoneCommunityStatus(player, zoneId) {
  const db = loadZonesForUpdate();
  const zoneIndex = db.findIndex(z => z.id === zoneId);
  if (zoneIndex === -1) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cProtección no encontrada.");
    return;
  }
  
  const zone = db[zoneIndex];
  zone.isCommunity = !zone.isCommunity;
  if (zone.isCommunity) {
    zone.zoneType = "community";
  } else if (zone.isAdmin) {
    zone.zoneType = "safezone";
  }
  
  if (saveZones(db)) {
    player.sendMessage(`§b§l[§3Protección§b§l]§r §aZona §e${zone.name || "Sin nombre"} §aahora es §e${zone.isCommunity ? "COMUNITARIA (Interacciones permitidas)" : "PRIVADA (Interacciones bloqueadas)"}§a.`);
  } else {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cError al guardar la base de datos.");
  }
  openAdminCommunityGUI(player);
}

function openListAllZonesCommunity(player) {
  const zones = loadZones();
  if (zones.length === 0) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cNo hay zonas registradas.");
    openAdminCommunityGUI(player);
    return;
  }
  
  const form = new ActionFormData()
    .title("📋 Zonas Registradas")
    .body("Selecciona una zona para cambiar su estado comunitario:");
    
  zones.forEach(z => {
    form.button(`${z.name || "Sin nombre"} (${z.owner})\nEstado: ${z.isCommunity ? "§aComunitaria" : "§cPrivada"}`);
  });
  form.button("🔙 Volver");
  
  safeOpenForm(player, form, (res) => {
    if (res.selection === zones.length) {
      openAdminCommunityGUI(player);
      return;
    }
    const selectedZone = zones[res.selection];
    toggleZoneCommunityStatus(player, selectedZone.id);
  });
}

// Reparar de forma idempotente los solapamientos heredados al cargar/reload.
// Se deshabilitan registros conflictivos, pero nunca se borran ni se cobra nada.
system.run(() => {
  try {
    const db = loadZonesForUpdate();
    const quarantined = reconcileOverlappingZones(db);
    if (quarantined > 0 && saveZones(db)) {
      console.warn(`[Protección] ${quarantined} zona(s) solapada(s) fueron puestas en cuarentena; se conservó la zona principal.`);
    }
  } catch (error) {
    ErrorReporter.report(error, { addonId: "protection_addon", moduleId: "main.js", operation: "reconcileOverlappingZones", category: "runtime" });
    console.warn(`[Protección] No se pudo reconciliar solapamientos: ${error}`);
  }
});
