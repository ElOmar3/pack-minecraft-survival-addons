import { world, system, CommandPermissionLevel } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";






// === PERSISTENCIA SQLITE PUENTE V3 (SEGURO PARA /reload) ===
if (!globalThis.__sqlite_store_v2__) globalThis.__sqlite_store_v2__ = new Map();
if (!globalThis.__sqlite_write_ts_v3__) globalThis.__sqlite_write_ts_v3__ = new Map();
if (!globalThis.__sqlite_pending_v3__) globalThis.__sqlite_pending_v3__ = new Map();
if (!globalThis.__sqlite_unflushed_v3__) globalThis.__sqlite_unflushed_v3__ = new Map();
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
// Lector tolerante: el demonio rehidrata objetos ya parseados; los datos legacy son strings JSON.
if (!globalThis.__sqlite_read_json_v3__) {
  globalThis.__sqlite_read_json_v3__ = function(raw, fallback) {
    const fb = fallback === undefined ? null : fallback;
    if (raw === undefined || raw === null) return fb;
    if (typeof raw === "object") return raw;
    if (typeof raw !== "string") return raw;
    const text = raw.trim();
    if (!text) return fb;
    try { return JSON.parse(text); } catch (e) { return fb; }
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
    const compositeKey = addonKey + "\u0000" + ownerKey + "\u0000" + String(key);
    globalThis.__sqlite_write_ts_v3__.set(compositeKey, Date.now());
    try {
      const line = "[SQLITE_SAVE_V1] " + JSON.stringify(payload);
      // Gating: las escrituras previas a sync_complete se encolan y se emiten al confirmar el snapshot.
      if (globalThis.__sqlite_is_ready_v3__(addonKey)) console.warn(line);
      else {
        let queue = globalThis.__sqlite_pending_v3__.get(addonKey);
        if (!queue) { queue = []; globalThis.__sqlite_pending_v3__.set(addonKey, queue); }
        queue.push(line);
        let marks = globalThis.__sqlite_unflushed_v3__.get(addonKey);
        if (!marks) { marks = new Set(); globalThis.__sqlite_unflushed_v3__.set(addonKey, marks); }
        marks.add(compositeKey);
      }
    } catch (e) {}
  };
}
if (!globalThis.__sqlite_rehydrate_v2__) {
  globalThis.__sqlite_rehydrate_v2__ = function(addon, owner, key, value, deleted) {
    if (!addon || owner === undefined || owner === null || key === undefined) return;
    const addonKey = String(addon);
    const ownerKey = globalThis.__sqlite_owner_key_v2__(owner);
    // Versionado: una escritura local posterior a la solicitud de sync (o aún no drenada al demonio) gana sobre el snapshot.
    const status = globalThis.__sqlite_sync_status_v3__.get(addonKey);
    const compositeKey = addonKey + "\u0000" + ownerKey + "\u0000" + String(key);
    const writeTs = globalThis.__sqlite_write_ts_v3__.get(compositeKey);
    const unflushed = globalThis.__sqlite_unflushed_v3__.get(addonKey);
    if (unflushed && unflushed.has(compositeKey)) return;
    if (status && status.requestedAt !== undefined && writeTs !== undefined && writeTs >= status.requestedAt) return;
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
if (!globalThis.__sqlite_is_ready_v3__) {
  globalThis.__sqlite_is_ready_v3__ = function(addon) {
    const status = globalThis.__sqlite_sync_status_v3__.get(String(addon));
    return Boolean(status && (status.complete || status.degraded));
  };
}
if (!globalThis.__sqlite_flush_pending_v3__) {
  globalThis.__sqlite_flush_pending_v3__ = function(addon) {
    const addonKey = String(addon);
    const queue = globalThis.__sqlite_pending_v3__.get(addonKey);
    if (!queue || queue.length === 0) return;
    globalThis.__sqlite_pending_v3__.delete(addonKey);
    globalThis.__sqlite_unflushed_v3__.delete(addonKey);
    for (const line of queue) { try { console.warn(line); } catch (e) {} }
  };
}
if (!globalThis.__sqlite_request_sync_v3__) {
  globalThis.__sqlite_request_sync_v3__ = function(addon, attempt) {
    const addonKey = String(addon || "");
    if (!addonKey) return;
    const previous = globalThis.__sqlite_sync_status_v3__.get(addonKey) || {};
    // Conservar la ventana original en reintentos para que el guard de versión no se relaje.
    const keepWindow = previous.requestedAt && !previous.complete && !previous.degraded;
    globalThis.__sqlite_sync_status_v3__.set(addonKey, {
      ...previous,
      requestedAt: keepWindow ? previous.requestedAt : Date.now(),
      attempt: Number(attempt || 0),
      complete: false,
      degraded: false,
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
    // Solo el demonio (consola del servidor) puede rehidratar; un jugador jamás debe inyectar estado.
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
          globalThis.__sqlite_flush_pending_v3__(addonKey);
        }
        return;
      }
      if (event.id === "sqlite:load_chunk") {
        const count = Number(payload.chunkCount);
        const index = Number(payload.chunkIndex);
        if (!payload.addon || payload.key === undefined || !payload.chunkId || !Number.isInteger(count) || count < 1 || count > 4096 || !Number.isInteger(index) || index < 0 || index >= count) return;
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
globalThis.__sqlite_sync_complete_v2__.delete("server_boosters_addon");
globalThis.__sqlite_request_sync_v3__("server_boosters_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("server_boosters_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("server_boosters_addon", 1);
  } catch (e) {}
}, 120);
system.runTimeout(() => {
  // Sin demonio (mundo importado sin bridge) se opera en modo degradado tras ~10s: RAM es la fuente de verdad.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("server_boosters_addon");
    if (state && !state.complete) {
      state.degraded = true;
      globalThis.__sqlite_sync_complete_v2__.set("server_boosters_addon", Date.now());
      globalThis.__sqlite_flush_pending_v3__("server_boosters_addon");
    }
  } catch (e) {}
}, 200);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
const COMMAND_NAMESPACE = "s";
const EXTRA_ZONES_REGISTRY_KEY = "extra_zones_registry_v1";
const EXTRA_ZONES_SHARED_OBJECTIVE = "extra_zones_shared";
const EXTRA_HOMES_SHARED_OBJECTIVE = "extra_homes_shared";
const MAX_GLOBAL_BOOSTER_DURATION_MS = 24 * 60 * 60 * 1000;
const GLOBAL_BOOSTER_DURATION_MS = MAX_GLOBAL_BOOSTER_DURATION_MS;
// La Fiebre de Trabajo conserva sus pagos por actividad, pero nunca puede
// convertirse en una fuente ilimitada mediante granjas de mobs o bloques.
const JOB_BOOSTER_PLAYER_CAP = 10_000;
const JOB_BOOSTER_NOTICE_INTERVAL_MS = 4_000;
const BOOSTER_STATE_OBJECTIVE = "global_boosters_v1";
const BOOSTER_STATE_PARTICIPANT = "server";
const BOOSTER_TIMESTAMP_DIVISOR = 1000000000;
const GLOBAL_BOOSTER_KEYS = ["xp", "jobs", "regen", "speed", "haste", "resistance", "nightvision"];
const BOOSTER_PREFERENCE_PREFIX = "boosters:global_preference:";
const BOOSTER_ADMIN_MODE_PREFIX = "boosters:global_admin_mode:";
const BOOSTER_ADMIN_ROLES = new Set(["OWNER", "SECURITY_ADMIN"]);
// Recuperaciones verificadas de compras antiguas afectadas antes de que existiera
// el registro persistente. Se aplican como mínimo, nunca reducen una compra nueva.
const LEGACY_EXTRA_ZONE_RECOVERIES = Object.freeze({
  "adz866": 1
});

function getExtraZoneRegistry() {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("server_boosters_addon", "world", EXTRA_ZONES_REGISTRY_KEY);
    const parsed = globalThis.__sqlite_read_json_v3__(raw, {});
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (e) {
    return {};
  }
}

function getRegisteredExtraZones(player) {
  const key = String(player?.name ?? "").toLowerCase();
  const value = Math.floor(Number(getExtraZoneRegistry()[key] ?? 0));
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function getSharedExtraZones(player) {
  try {
    const objective = world.scoreboard.getObjective(EXTRA_ZONES_SHARED_OBJECTIVE)
      || world.scoreboard.addObjective(EXTRA_ZONES_SHARED_OBJECTIVE, "Terrenos extra");
    return Math.max(0, Math.floor(Number(objective.getScore(player)) || 0));
  } catch (e) {
    return 0;
  }
}

function setSharedExtraZones(player, value) {
  try {
    const objective = world.scoreboard.getObjective(EXTRA_ZONES_SHARED_OBJECTIVE)
      || world.scoreboard.addObjective(EXTRA_ZONES_SHARED_OBJECTIVE, "Terrenos extra");
    objective.setScore(player, Math.max(0, Math.min(3, Math.floor(Number(value) || 0))));
    return true;
  } catch (e) {
    console.warn(`[Potenciadores] No se pudo sincronizar terrenos extra de ${player?.name}: ${e}`);
    return false;
  }
}

function getSharedExtraHomes(player) {
  try {
    const objective = world.scoreboard.getObjective(EXTRA_HOMES_SHARED_OBJECTIVE)
      || world.scoreboard.addObjective(EXTRA_HOMES_SHARED_OBJECTIVE, "Casas extra");
    return Math.max(0, Math.floor(Number(objective.getScore(player)) || 0));
  } catch (e) { return 0; }
}

function setSharedExtraHomes(player, value) {
  try {
    const objective = world.scoreboard.getObjective(EXTRA_HOMES_SHARED_OBJECTIVE)
      || world.scoreboard.addObjective(EXTRA_HOMES_SHARED_OBJECTIVE, "Casas extra");
    objective.setScore(player, Math.max(0, Math.min(5, Math.floor(Number(value) || 0))));
    return true;
  } catch (e) { return false; }
}

function setSharedExtraHomeLocation(player, slot, location, dimensionId) {
  const dimensionCode = dimensionId === "minecraft:nether" ? 1 : dimensionId === "minecraft:the_end" ? 2 : 0;
  try {
    for (const [field, value] of Object.entries({ x: Math.floor(location.x), y: Math.floor(location.y), z: Math.floor(location.z), d: dimensionCode, s: 1 })) {
      const name = `xhome_${slot}_${field}`;
      const objective = world.scoreboard.getObjective(name) || world.scoreboard.addObjective(name, name);
      objective.setScore(player, value);
    }
    return true;
  } catch (e) { return false; }
}

function persistExtraZones(player, value) {
  const normalized = Math.max(0, Math.min(3, Math.floor(Number(value) || 0)));
  const registry = getExtraZoneRegistry();
  const key = String(player.name).toLowerCase();
  registry[key] = normalized;
  try {
    globalThis.__sqlite_set_prop_v2__("server_boosters_addon", player, "extra_zones", normalized);
    globalThis.__sqlite_set_prop_v2__("server_boosters_addon", player, "extra_zones_v1", normalized);
    globalThis.__sqlite_set_prop_v2__("server_boosters_addon", "world", EXTRA_ZONES_REGISTRY_KEY, JSON.stringify(registry));
    if (!setSharedExtraZones(player, normalized)) throw new Error("extra_zones_shared_score_write_failed");
    const verified = Math.floor(Number(globalThis.__sqlite_get_prop_v2__("server_boosters_addon", player, "extra_zones") ?? 0)) === normalized
      && Math.floor(Number(getExtraZoneRegistry()[key] ?? 0)) === normalized;
    if (!verified) throw new Error("extra_zones_persistence_verification_failed");
    return true;
  } catch (e) {
    console.warn(`[Potenciadores] No se pudo guardar terreno extra para ${player.name}: ${e}`);
    return false;
  }
}

function reconcileLegacyExtraZoneRecovery(player) {
  const recovery = LEGACY_EXTRA_ZONE_RECOVERIES[String(player?.name ?? "").toLowerCase()];
  if (!recovery) return;
  const current = Math.max(
    Math.floor(Number(globalThis.__sqlite_get_prop_v2__("server_boosters_addon", player, "extra_zones") ?? 0) || 0),
    getRegisteredExtraZones(player),
    getSharedExtraZones(player)
  );
  if (current < recovery && persistExtraZones(player, recovery)) {
    player.sendMessage(`§b§l[§3Mejoras§b§l]§r §aSe restauró tu terreno extra adquirido. Ahora puedes proteger hasta ${1 + recovery} bases.`);
    console.warn(`[Potenciadores] Recuperación de terreno extra aplicada a ${player.name}: ${recovery}`);
  }
}

// Estado de los potenciadores globales en memoria
let globalBoosters = {
  xp: { active: false, endTime: 0, buyer: "" },
  jobs: { active: false, endTime: 0, buyer: "" },
  regen: { active: false, endTime: 0, buyer: "" },
  speed: { active: false, endTime: 0, buyer: "" },
  haste: { active: false, endTime: 0, buyer: "" },
  resistance: { active: false, endTime: 0, buyer: "" },
  nightvision: { active: false, endTime: 0, buyer: "" }
};
const jobBoosterNoticeAt = new Map();

function preferenceKey(key) { return `${BOOSTER_PREFERENCE_PREFIX}${key}`; }
function adminModeKey(key) { return `${BOOSTER_ADMIN_MODE_PREFIX}${key}`; }
function ownPreference(player, key) { return globalThis.__sqlite_get_prop_v2__("server_boosters_addon", player, preferenceKey(key)) !== false; }
function adminMode(player, key) {
  const mode = String(globalThis.__sqlite_get_prop_v2__("server_boosters_addon", player, adminModeKey(key)) ?? "SELF");
  return ["SELF", "DISABLED", "ENABLED"].includes(mode) ? mode : "SELF";
}
function receivesBooster(player, key) {
  const mode = adminMode(player, key);
  return mode === "ENABLED" || (mode !== "DISABLED" && ownPreference(player, key));
}
function isBoosterAdmin(player) {
  try { return BOOSTER_ADMIN_ROLES.has(String(globalThis.__sqlite_get_prop_v2__("fcx_limited_admin", player, "fcx_admin:visual_role_v1") ?? "")); } catch { return false; }
}
function setPlayerBoosterValue(player, key, value, property) {
  try {
    globalThis.__sqlite_set_prop_v2__("server_boosters_addon", player, property(key), value);
    return globalThis.__sqlite_get_prop_v2__("server_boosters_addon", player, property(key)) === value;
  } catch { return false; }
}

function getCappedBoosterEndTime(value, now = Date.now()) {
  const endTime = Math.floor(Number(value) || 0);
  if (!Number.isSafeInteger(endTime) || endTime <= now) return 0;
  return Math.min(endTime, now + MAX_GLOBAL_BOOSTER_DURATION_MS);
}

function getBoosterStateObjective() {
  try {
    return world.scoreboard.getObjective(BOOSTER_STATE_OBJECTIVE)
      || world.scoreboard.addObjective(BOOSTER_STATE_OBJECTIVE, "Estado de potenciadores globales");
  } catch (error) {
    console.warn(`[Potenciadores] No se pudo abrir el respaldo persistente: ${error}`);
    return undefined;
  }
}

function getBoosterBackupScore(objective, key, fallback = 0) {
  try {
    return Number(objective.getScore(`${BOOSTER_STATE_PARTICIPANT}_${key}`)) || fallback;
  } catch {
    return fallback;
  }
}

function saveBoosterBackup(key, booster) {
  const objective = getBoosterStateObjective();
  if (!objective) return false;
  try {
    const endTime = booster.active ? booster.endTime : 0;
    objective.setScore(`${BOOSTER_STATE_PARTICIPANT}_${key}_active`, booster.active ? 1 : 0);
    objective.setScore(`${BOOSTER_STATE_PARTICIPANT}_${key}_high`, Math.floor(endTime / BOOSTER_TIMESTAMP_DIVISOR));
    objective.setScore(`${BOOSTER_STATE_PARTICIPANT}_${key}_low`, endTime % BOOSTER_TIMESTAMP_DIVISOR);
    return true;
  } catch (error) {
    console.warn(`[Potenciadores] No se pudo guardar respaldo de ${key}: ${error}`);
    return false;
  }
}

function getBoosterBackup(key) {
  const objective = getBoosterStateObjective();
  if (!objective || getBoosterBackupScore(objective, `${key}_active`) !== 1) return undefined;
  const high = getBoosterBackupScore(objective, `${key}_high`);
  const low = getBoosterBackupScore(objective, `${key}_low`);
  const endTime = getCappedBoosterEndTime(high * BOOSTER_TIMESTAMP_DIVISOR + low);
  return endTime ? { active: true, endTime, buyer: "" } : undefined;
}

function announceGlobalBoosterPurchase(buyerName, key, durationMs) {
  const boosterName = getBoosterName(key);
  const minutes = Math.max(1, Math.ceil(durationMs / 60000));
  world.sendMessage(`§b§l[§3Potenciadores§b§l]§r §a¡El jugador §e${buyerName}§a activó §e${boosterName}§a para todo el servidor durante §e${minutes} minutos§a!`);
  for (const target of world.getAllPlayers()) {
    try {
      target.onScreenDisplay.setTitle("§6⚡ POTENCIADOR GLOBAL ⚡", {
        subtitle: `§e${boosterName}\n§aActivado por ${buyerName} · ${minutes} min`,
        fadeInDuration: 5,
        stayDuration: 60,
        fadeOutDuration: 15,
      });
      target.onScreenDisplay.setActionBar(`§6⚡ ${boosterName} §aactivo durante ${minutes} min`);
      target.playSound("random.levelup", { pitch: 1.15, volume: 0.9 });
    } catch (e) {
      console.warn(`[Potenciadores] No se pudo anunciar el potenciador a ${target?.name || "unknown"}: ${e}`);
    }
  }
}

// Cargar el estado inicial de los potenciadores desde SQLite si es necesario.
function initBoosters() {
  for (const key of GLOBAL_BOOSTER_KEYS) {
    try {
      const active = globalThis.__sqlite_get_prop_v2__("server_boosters_addon", "world", `booster_${key}_active`);
      const savedEndTime = globalThis.__sqlite_get_prop_v2__("server_boosters_addon", "world", `booster_${key}_endTime`);
      const buyer = globalThis.__sqlite_get_prop_v2__("server_boosters_addon", "world", `booster_${key}_buyer`);
      const endTime = getCappedBoosterEndTime(savedEndTime);
      if (active && endTime && endTime > Date.now()) {
        globalBoosters[key] = { active: true, endTime, buyer: String(buyer) };
      } else {
        const backup = getBoosterBackup(key);
        globalBoosters[key] = backup || { active: false, endTime: 0, buyer: "" };
      }
      saveBooster(key);
    } catch (error) {
      console.warn(`[Potenciadores] No se pudo restaurar ${key}: ${error}`);
    }
  }
}

function saveBooster(key) {
  const booster = globalBoosters[key];
  if (!booster) return;
  const cappedEndTime = booster.active ? getCappedBoosterEndTime(booster.endTime) : 0;
  booster.active = cappedEndTime > 0;
  booster.endTime = cappedEndTime;
  if (!booster.active) booster.buyer = "";
  try {
    globalThis.__sqlite_set_prop_v2__("server_boosters_addon", "world", `booster_${key}_active`, booster.active);
    globalThis.__sqlite_set_prop_v2__("server_boosters_addon", "world", `booster_${key}_endTime`, booster.endTime);
    globalThis.__sqlite_set_prop_v2__("server_boosters_addon", "world", `booster_${key}_buyer`, booster.buyer);
  } catch (error) {
    console.warn(`[Potenciadores] No se pudo guardar ${key} en SQLite: ${error}`);
  }
  saveBoosterBackup(key, booster);
}

// En una recarga, el mundo termina de exponer datos persistentes al siguiente tick.
system.run(initBoosters);

// Utilidades de economía
function getPlayerMoney(player) {
  try {
    const objective = world.scoreboard.getObjective("money");
    if (!objective) return 0;
    try {
      return objective.getScore(player) ?? 0;
    } catch (e) {
      try {
        return objective.getScore(player.name) ?? 0;
      } catch (e2) {
        return 0;
      }
    }
  } catch (e) {
    return 0;
  }
}

function addPlayerMoney(player, amount) {
  try {
    const objective = world.scoreboard.getObjective("money");
    if (!objective) return false;
    const current = getPlayerMoney(player);
    const next = current + amount;
    try {
      objective.setScore(player, next);
    } catch (e) {
      try {
        objective.setScore(player.name, next);
      } catch (e2) {
        return false;
      }
    }
    return true;
  } catch (e) {
    return false;
  }
}

function getJobBoosterEarningsKey(endTime) {
  return `jobs_booster_earnings_v1:${Math.floor(Number(endTime) || 0)}`;
}

function getJobBoosterEarnings(player, endTime) {
  try {
    return Math.max(0, Math.floor(Number(globalThis.__sqlite_get_prop_v2__(
      "server_boosters_addon", player, getJobBoosterEarningsKey(endTime)
    )) || 0));
  } catch (e) {
    return JOB_BOOSTER_PLAYER_CAP;
  }
}

function saveJobBoosterEarnings(player, endTime, value) {
  try {
    const key = getJobBoosterEarningsKey(endTime);
    const normalized = Math.max(0, Math.min(JOB_BOOSTER_PLAYER_CAP, Math.floor(Number(value) || 0)));
    globalThis.__sqlite_set_prop_v2__("server_boosters_addon", player, key, normalized);
    const persisted = Number(globalThis.__sqlite_get_prop_v2__("server_boosters_addon", player, key));
    return Number.isFinite(persisted) && Math.floor(persisted) === normalized;
  } catch (e) {
    return false;
  }
}

function showJobBoosterNotice(player, message) {
  const now = Date.now();
  const key = String(player?.name || "").toLowerCase();
  if (!key || now - (jobBoosterNoticeAt.get(key) || 0) < JOB_BOOSTER_NOTICE_INTERVAL_MS) return;
  jobBoosterNoticeAt.set(key, now);
  try { player.onScreenDisplay.setActionBar(message); } catch (e) {}
}

function awardJobBoosterMoney(player, requestedAmount) {
  const booster = globalBoosters.jobs;
  if (!booster?.active || !receivesBooster(player, "jobs")) return 0;
  const requested = Math.max(0, Math.floor(Number(requestedAmount) || 0));
  if (!requested) return 0;
  const earned = getJobBoosterEarnings(player, booster.endTime);
  const paid = Math.min(requested, Math.max(0, JOB_BOOSTER_PLAYER_CAP - earned));
  if (!paid) {
    showJobBoosterNotice(player, `§e[Potenciadores] §7Tope de Fiebre de Trabajo alcanzado: §e$${JOB_BOOSTER_PLAYER_CAP}`);
    return 0;
  }
  if (!addPlayerMoney(player, paid)) return 0;
  if (!saveJobBoosterEarnings(player, booster.endTime, earned + paid)) {
    addPlayerMoney(player, -paid);
    return 0;
  }
  showJobBoosterNotice(player, `§b[Potenciadores] §a+$${paid} §7Fiebre de Trabajo · §e$${earned + paid}/$${JOB_BOOSTER_PLAYER_CAP}`);
  return paid;
}

// Acceso compartido a las mejoras personales persistidas en SQLite.
// Debe vivir en el ámbito del módulo porque lo usan los formularios de UI.
function getBoosterProp(player, key) {
  if (!player) return undefined;
  return globalThis.__sqlite_get_prop_v2__("server_boosters_addon", player, key);
}

function setBoosterProp(player, key, value) {
  if (!player) return false;
  try {
    globalThis.__sqlite_set_prop_v2__("server_boosters_addon", player, key, value);
    return globalThis.__sqlite_get_prop_v2__("server_boosters_addon", player, key) === value;
  } catch (e) {
    console.warn(`[Mejoras] No se pudo persistir ${key}: ${e}`);
    return false;
  }
}

// Bucle principal para aplicar potenciadores y mejoras permanentes
system.runInterval(() => {
  const now = Date.now();
  
  // Procesar expiración de potenciadores
  for (const key of ["xp", "jobs", "regen", "speed", "haste", "resistance", "nightvision"]) {
    if (globalBoosters[key].active && now >= globalBoosters[key].endTime) {
      globalBoosters[key].active = false;
      saveBooster(key);
      world.sendMessage(`§b§l[§3Potenciadores§b§l]§r §eEl potenciador global de §a${getBoosterName(key)}§e ha terminado.`);
    }
  }

  // Aplicar efectos a los jugadores
  for (const player of world.getAllPlayers()) {
    reconcileLegacyExtraZoneRecovery(player);
    const ownedExtraZones = Math.max(Math.floor(Number(globalThis.__sqlite_get_prop_v2__("server_boosters_addon", player, "extra_zones") ?? 0) || 0), getRegisteredExtraZones(player), getSharedExtraZones(player));
    if (ownedExtraZones > getSharedExtraZones(player)) setSharedExtraZones(player, ownedExtraZones);
    const ownedExtraHomes = Math.max(Math.floor(Number(globalThis.__sqlite_get_prop_v2__("server_boosters_addon", player, "extra_homes") ?? 0) || 0), getSharedExtraHomes(player));
    if (ownedExtraHomes > getSharedExtraHomes(player)) setSharedExtraHomes(player, ownedExtraHomes);
    for (let slot = 1; slot <= ownedExtraHomes; slot++) {
      const x = getBoosterProp(player, `home_x_${slot}`);
      const y = getBoosterProp(player, `home_y_${slot}`);
      const z = getBoosterProp(player, `home_z_${slot}`);
      const dimension = getBoosterProp(player, `home_dim_${slot}`);
      if (x !== undefined && y !== undefined && z !== undefined && dimension !== undefined) {
        setSharedExtraHomeLocation(player, slot, { x: Number(x), y: Number(y), z: Number(z) }, String(dimension));
      }
    }
    // 1. Efecto global de velocidad
    if (globalBoosters.speed.active && receivesBooster(player, "speed")) {
      try { player.runCommand("effect @s speed 5 0 true"); } catch (e) {}
    }
    // 2. Efecto global de regeneración
    if (globalBoosters.regen.active && receivesBooster(player, "regen")) {
      try { player.runCommand("effect @s regeneration 5 0 true"); } catch (e) {}
    }
    // 3. Prisa Minera global
    if (globalBoosters.haste.active && receivesBooster(player, "haste")) {
      try { player.runCommand("effect @s haste 5 0 true"); } catch (e) {}
    }
    // 4. Resistencia global
    if (globalBoosters.resistance.active && receivesBooster(player, "resistance")) {
      try { player.runCommand("effect @s resistance 5 0 true"); } catch (e) {}
    }
    // 5. Visión nocturna global
    if (globalBoosters.nightvision.active && receivesBooster(player, "nightvision")) {
      try { player.runCommand("effect @s night_vision 15 0 true"); } catch (e) {}
    }

    // 6. Mejoras personales permanentes
    if (getBoosterProp(player, "perm_speed") === true) {
      try { player.runCommand("effect @s speed 5 0 true"); } catch (e) {}
    }
    if (getBoosterProp(player, "perm_haste") === true) {
      try { player.runCommand("effect @s haste 5 0 true"); } catch (e) {}
    }
    if (getBoosterProp(player, "perm_nightvision") === true) {
      try { player.runCommand("effect @s night_vision 15 0 true"); } catch (e) {}
    }
  }
}, 40); // Cada 2 segundos (40 ticks)

function getBoosterName(key) {
  switch (key) {
    case "xp": return "Doble Experiencia";
    case "jobs": return "Fiebre de Trabajo (tope $10.000)";
    case "regen": return "Regeneración Colectiva";
    case "speed": return "Súper Velocidad Grupal";
    case "haste": return "Prisa Minera Global";
    case "resistance": return "Resistencia Colectiva";
    case "nightvision": return "Visión Nocturna Global";
    default: return "";
  }
}

// Escuchar rupturas de bloques para Doble XP y Fiebre de Trabajo.
// Los pagos de Fiebre tienen un tope persistente por jugador y activación.
world.afterEvents.playerBreakBlock.subscribe((event) => {
  const player = event.player;
  const blockType =
    event.brokenBlockPermutation?.type?.id ||
    event.brokenBlockPermutation?.typeId ||
    event.block?.typeId ||
    "";

  if (globalBoosters.xp.active && receivesBooster(player, "xp")) {
    if (blockType.includes("ore")) {
      player.addExperience(5);
    }
  }

  if (globalBoosters.jobs.active && receivesBooster(player, "jobs")) {
    if (blockType.includes("ore")) {
      awardJobBoosterMoney(player, 5);
    } else if (blockType.includes("stone") || blockType.includes("deepslate")) {
      awardJobBoosterMoney(player, 1);
    }
  }
});

// Escuchar muertes de entidades para XP y Trabajo
world.afterEvents.entityDie.subscribe((event) => {
  const damageSource = event.damageSource;
  if (!damageSource) return;
  const attacker = damageSource.damagingEntity;
  if (!attacker || attacker.typeId !== "minecraft:player") return;
  
  const player = attacker;

  if (globalBoosters.xp.active && receivesBooster(player, "xp")) {
    player.addExperience(10);
  }

  if (globalBoosters.jobs.active && receivesBooster(player, "jobs")) {
    awardJobBoosterMoney(player, 10);
  }
});

// Registrar comando /s:potenciadores y /s:mejoras
const beforeChat = world.beforeEvents ? (world.beforeEvents.chatSend || world.beforeEvents.chat) : undefined;
if (beforeChat && typeof beforeChat.subscribe === "function") {
  beforeChat.subscribe((event) => {
    const rawMessage = event.message.trim();
    const message = rawMessage.toLowerCase();
    const sender = event.sender;

    if (message.startsWith("s:gestionboosters ")) {
      if (event.cancel !== undefined) event.cancel = true;
      const target = rawMessage.slice("s:gestionboosters".length).trim().replace(/^"|"$/g, "");
      system.run(() => openAdminBoosterMenu(sender, target));
      return;
    }

    if (message === "s:potenciadores" || message === "s:mejoras" || message === "s:boosters" ||
        message.startsWith("/s:potenciadores") || message.startsWith("/s:mejoras") || message.startsWith("/s:boosters")) {
      if (event.cancel !== undefined) event.cancel = true;
      system.run(() => {
        openBoostersMenu(sender);
      });
    }
  });
}

// Escuchar scriptevents
try {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id === "s:boosters" || ev.id === "s:potenciadores" || ev.id === "s:mejoras" || ev.id === "cmd:boosters") {
      const player = ev.sourceEntity;
      if (player && player.isValid) {
        system.run(() => openBoostersMenu(player));
      }
    }
  });
} catch (e) {}

// Registrar comandos en el cargador nativo
system.beforeEvents.startup.subscribe((event) => {
  const registry = event?.customCommandRegistry;
  const register = typeof registry?.registerCommand === "function"
    ? registry.registerCommand.bind(registry)
    : typeof registry?.register === "function"
      ? registry.register.bind(registry)
      : undefined;
  if (!register) return;

  try {
    for (const name of ["potenciadores", "mejoras", "boosters"]) {
      register({
        name: `${COMMAND_NAMESPACE}:${name}`,
        description: "Abre el menú de potenciadores y mejoras anti-inflación",
        permissionLevel: CommandPermissionLevel.Any
      }, (origin) => {
        const sender = origin?.sourceEntity;
        if (!sender) return;
        system.run(() => {
          openBoostersMenu(sender);
        });
      });
    }
  } catch (e) {
    console.warn("[Boosters] Error registrando custom commands: " + e);
  }
});

// Menú principal de potenciadores y mejoras
export function openBoostersMenu(player) {
  try { globalThis.openBoostersMenu = openBoostersMenu; } catch (e) {}
  const form = new ActionFormData()
    .title("⚡ Potenciadores y Mejoras")
    .body("§7Gasta tus monedas para activar potenciadores para todo el servidor o comprar ventajas personales permanentes:")
    .button("🚀 Potenciadores Globales (Servidor)")
    .button("💎 Mejoras Personales (Permanentes)")
    .button("⚙️ Mis preferencias globales")
    .button("🏠 Casas Adicionales Compradas")
    .button("❌ Cerrar Menú");

  form.show(player).then((response) => {
    if (response.canceled) return;
    switch (response.selection) {
      case 0:
        openGlobalBoostersMenu(player);
        break;
      case 1:
        openPersonalPerksMenu(player);
        break;
      case 2:
        openPlayerBoosterPreferences(player);
        break;
      case 3:
        openExtraHomesMenu(player);
        break;
      case 4:
        // Cerrar menú limpiamente
        break;
    }
  }).catch((error) => {
    try {
      console.warn(`[Potenciadores] No se pudo abrir el menú principal: ${error}`);
      player.sendMessage("§c[Potenciadores] No se pudo abrir el menú. Revisa el registro del servidor.");
    } catch (e) {}
  });
}

try { globalThis.openBoostersMenu = openBoostersMenu; } catch (e) {}

function preferenceLabel(player, key) {
  const mode = adminMode(player, key);
  if (mode === "DISABLED") return "§cBloqueado por administración";
  if (mode === "ENABLED") return "§aForzado por administración";
  return ownPreference(player, key) ? "§aActivo para mí" : "§cDesactivado para mí";
}

function openPlayerBoosterPreferences(player) {
  const form = new ActionFormData().title("⚙️ Mis potenciadores globales")
    .body("§7Elige qué bonos globales recibes. Las decisiones administrativas tienen prioridad.");
  for (const key of GLOBAL_BOOSTER_KEYS) form.button(`${getBoosterName(key)}\n${preferenceLabel(player, key)}`);
  form.button("🔙 Volver");
  form.show(player).then((response) => {
    if (response.canceled) return;
    if (response.selection === GLOBAL_BOOSTER_KEYS.length) return openBoostersMenu(player);
    const key = GLOBAL_BOOSTER_KEYS[response.selection];
    if (adminMode(player, key) !== "SELF") {
      player.sendMessage("§e[Potenciadores] Esta opción la controla la administración.");
      return openPlayerBoosterPreferences(player);
    }
    if (!setPlayerBoosterValue(player, key, !ownPreference(player, key), preferenceKey)) {
      player.sendMessage("§c[Potenciadores] No se pudo guardar tu preferencia.");
    }
    openPlayerBoosterPreferences(player);
  }).catch(() => {});
}

function openAdminBoosterMenu(admin, targetQuery) {
  if (!isBoosterAdmin(admin)) return admin.sendMessage("§c[Potenciadores] Solo OWNER y SECURITY_ADMIN pueden gestionar preferencias.");
  const query = targetQuery.trim().toLowerCase();
  const matches = world.getAllPlayers().filter((player) => String(player.name).toLowerCase() === query);
  if (matches.length !== 1) return admin.sendMessage("§c[Potenciadores] Jugador no encontrado o ambiguo. Debe estar conectado y usar el nombre exacto.");
  const target = matches[0];
  const form = new ActionFormData().title(`⚙️ Potenciadores: ${target.name}`)
    .body("§7Cada pulsación cambia: decisión del jugador → bloqueado → forzado.");
  for (const key of GLOBAL_BOOSTER_KEYS) form.button(`${getBoosterName(key)}\n${preferenceLabel(target, key)}`);
  form.button("❌ Cerrar");
  form.show(admin).then((response) => {
    if (response.canceled || response.selection === GLOBAL_BOOSTER_KEYS.length) return;
    const key = GLOBAL_BOOSTER_KEYS[response.selection];
    const next = adminMode(target, key) === "SELF" ? "DISABLED" : adminMode(target, key) === "DISABLED" ? "ENABLED" : "SELF";
    if (setPlayerBoosterValue(target, key, next, adminModeKey)) {
      target.sendMessage(`§e[Potenciadores] Administración: ${getBoosterName(key)} → ${preferenceLabel(target, key)}§r.`);
      admin.sendMessage(`§a[Potenciadores] ${target.name}: ${getBoosterName(key)} actualizado.`);
    }
    openAdminBoosterMenu(admin, target.name);
  }).catch(() => {});
}

// Menú de Potenciadores Globales
function openGlobalBoostersMenu(player) {
  const form = new ActionFormData()
    .title("🚀 Potenciadores Globales")
    .body("§7Activa un bono para TODOS los jugadores del servidor. ¡El dinero se eliminará de la economía!\n\n" +
          `⚡ Doble XP: ${globalBoosters.xp.active ? "§aActivo" : "§cInactivo"}\n` +
          `💼 Fiebre Trabajo: ${globalBoosters.jobs.active ? "§aActivo" : "§cInactivo"}\n` +
          `❤️ Regeneración: ${globalBoosters.regen.active ? "§aActivo" : "§cInactivo"}\n` +
          `👟 Velocidad: ${globalBoosters.speed.active ? "§aActivo" : "§cInactivo"}\n` +
          `⛏️ Prisa Minera: ${globalBoosters.haste.active ? "§aActivo" : "§cInactivo"}\n` +
          `🛡️ Resistencia: ${globalBoosters.resistance.active ? "§aActivo" : "§cInactivo"}\n` +
          `👁️ Visión Nocturna: ${globalBoosters.nightvision.active ? "§aActivo" : "§cInactivo"}\n`)
    .button("⚡ Doble XP (50,000 $)")
    .button("💼 Fiebre de Trabajo · tope $10.000/jugador (75,000 $)")
    .button("❤️ Regeneración Grupal (30,000 $)")
    .button("👟 Velocidad Grupal (40,000 $)")
    .button("⛏️ Prisa Minera Global (55,000 $)")
    .button("🛡️ Resistencia Colectiva (60,000 $)")
    .button("👁️ Visión Nocturna Global (25,000 $)")
    .button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    if (response.selection === 7) {
      openBoostersMenu(player);
      return;
    }

    const keys = ["xp", "jobs", "regen", "speed", "haste", "resistance", "nightvision"];
    const prices = [50000, 75000, 30000, 40000, 55000, 60000, 25000];
    const key = keys[response.selection];
    const price = prices[response.selection];

    if (globalBoosters[key].active) {
      player.sendMessage("§b§l[§3Potenciadores§b§l]§r §cEste potenciador ya está activo actualmente.");
      return;
    }

    const bal = getPlayerMoney(player);
    if (bal < price) {
      player.sendMessage(`§b§l[§3Potenciadores§b§l]§r §cNo tienes suficiente dinero. Requiere ${price} $.`);
      return;
    }

    // Comprar
    if (!addPlayerMoney(player, -price)) {
      player.sendMessage("§b§l[§3Potenciadores§b§l]§r §cNo se pudo confirmar el cobro. No se activó ningún potenciador.");
      return;
    }
    globalBoosters[key] = {
      active: true,
      endTime: Date.now() + GLOBAL_BOOSTER_DURATION_MS,
      buyer: player.name
    };
    saveBooster(key);

    announceGlobalBoosterPurchase(player.name, key, GLOBAL_BOOSTER_DURATION_MS);
    openGlobalBoostersMenu(player);
  }).catch(() => {});
}

// Menú de Mejoras Personales
function openPersonalPerksMenu(player) {
  const currentExtraHomes = Math.max(Math.floor(Number(getBoosterProp(player, "extra_homes") ?? 0) || 0), getSharedExtraHomes(player));
  const currentExtraZones = Math.max(
    Math.max(0, Math.floor(Number(getBoosterProp(player, "extra_zones") ?? 0) || 0)),
    getRegisteredExtraZones(player),
    getSharedExtraZones(player)
  );
  const hasSpeed = getBoosterProp(player, "perm_speed") === true;
  const hasHaste = getBoosterProp(player, "perm_haste") === true;
  const hasNV = getBoosterProp(player, "perm_nightvision") === true;

  const form = new ActionFormData()
    .title("💎 Mejoras Personales Permanentes")
    .body("§7Compra mejoras de utilidad permanente para tu personaje:\n\n" +
          `🏠 Ranuras de Casa Extra: §e${currentExtraHomes}/5\n` +
          `🛡️ Terrenos de Protección Extra: §e${currentExtraZones}/3\n` +
          `🏃 Velocidad I Permanente: ${hasSpeed ? "§aAdquirido" : "§cNo Adquirido"}\n` +
          `⛏️ Prisa Minera I Permanente: ${hasHaste ? "§aAdquirido" : "§cNo Adquirido"}\n` +
          `👁️ Visión Nocturna Permanente: ${hasNV ? "§aAdquirido" : "§cNo Adquirido"}\n`)
    .button(`🏠 Ranura Casa Extra (25,000 $)`)
    .button(`🛡️ Terreno Protegible Extra (40,000 $)`)
    .button(`🏃 Velocidad I (150,000 $)`)
    .button(`⛏️ Prisa Minera I (200,000 $)`)
    .button(`👁️ Visión Nocturna (60,000 $)`)
    .button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    if (response.selection === 5) {
      openBoostersMenu(player);
      return;
    }

    const bal = getPlayerMoney(player);

    switch (response.selection) {
      case 0: { // Casa extra
        if (currentExtraHomes >= 5) {
          player.sendMessage("§b§l[§3Mejoras§b§l]§r §cYa tienes el límite máximo de ranuras de casa adicionales.");
          return;
        }
        if (bal < 25000) {
          player.sendMessage("§b§l[§3Mejoras§b§l]§r §cDinero insuficiente. Requiere 25,000 $.");
          return;
        }
        if (!addPlayerMoney(player, -25000)) {
          player.sendMessage("§b§l[§3Mejoras§b§l]§r §cNo se pudo procesar el cobro.");
          return;
        }
        if (!setBoosterProp(player, "extra_homes", currentExtraHomes + 1)) {
          addPlayerMoney(player, 25000);
          player.sendMessage("§b§l[§3Mejoras§b§l]§r §cNo se pudo guardar la ranura de casa. Se devolvió tu dinero.");
          return;
        }
        if (!setSharedExtraHomes(player, currentExtraHomes + 1)) {
          setBoosterProp(player, "extra_homes", currentExtraHomes);
          addPlayerMoney(player, 25000);
          player.sendMessage("§b§l[§3Mejoras§b§l]§r §cNo se pudo registrar la casa extra. Se devolvió tu dinero.");
          return;
        }
        player.sendMessage(`§b§l[§3Mejoras§b§l]§r §aHas comprado una ranura de casa extra. Ahora tienes ${currentExtraHomes + 1} adicionales.`);
        break;
      }
      case 1: { // Zona extra
        if (currentExtraZones >= 3) {
          player.sendMessage("§b§l[§3Mejoras§b§l]§r §cYa tienes el límite máximo de terrenos adicionales.");
          return;
        }
        if (bal < 40000) {
          player.sendMessage("§b§l[§3Mejoras§b§l]§r §cDinero insuficiente. Requiere 40,000 $.");
          return;
        }
        if (!addPlayerMoney(player, -40000)) {
          player.sendMessage("§b§l[§3Mejoras§b§l]§r §cNo se pudo procesar el cobro.");
          return;
        }
        if (!persistExtraZones(player, currentExtraZones + 1)) {
          addPlayerMoney(player, 40000);
          player.sendMessage("§b§l[§3Mejoras§b§l]§r §cNo se pudo registrar el terreno extra. Se devolvió tu dinero.");
          return;
        }
        player.sendMessage(`§b§l[§3Mejoras§b§l]§r §aHas comprado un terreno de protección adicional. Ahora puedes proteger hasta ${1 + currentExtraZones + 1} bases.`);
        break;
      }
      case 2: { // Velocidad
        if (hasSpeed) {
          player.sendMessage("§b§l[§3Mejoras§b§l]§r §cYa tienes esta mejora permanente.");
          return;
        }
        if (bal < 150000) {
          player.sendMessage("§b§l[§3Mejoras§b§l]§r §cDinero insuficiente. Requiere 150,000 $.");
          return;
        }
        if (!addPlayerMoney(player, -150000) || !setBoosterProp(player, "perm_speed", true)) {
          addPlayerMoney(player, 150000);
          player.sendMessage("§b§l[§3Mejoras§b§l]§r §cNo se pudo guardar Velocidad I. Se devolvió tu dinero.");
          return;
        }
        player.sendMessage("§b§l[§3Mejoras§b§l]§r §a¡Has comprado Velocidad I permanente!");
        break;
      }
      case 3: { // Prisa
        if (hasHaste) {
          player.sendMessage("§b§l[§3Mejoras§b§l]§r §cYa tienes esta mejora permanente.");
          return;
        }
        if (bal < 200000) {
          player.sendMessage("§b§l[§3Mejoras§b§l]§r §cDinero insuficiente. Requiere 200,000 $.");
          return;
        }
        if (!addPlayerMoney(player, -200000) || !setBoosterProp(player, "perm_haste", true)) {
          addPlayerMoney(player, 200000);
          player.sendMessage("§b§l[§3Mejoras§b§l]§r §cNo se pudo guardar Prisa Minera I. Se devolvió tu dinero.");
          return;
        }
        player.sendMessage("§b§l[§3Mejoras§b§l]§r §a¡Has comprado Prisa Minera I permanente!");
        break;
      }
      case 4: { // Night vision
        if (hasNV) {
          player.sendMessage("§b§l[§3Mejoras§b§l]§r §cYa tienes esta mejora permanente.");
          return;
        }
        if (bal < 60000) {
          player.sendMessage("§b§l[§3Mejoras§b§l]§r §cDinero insuficiente. Requiere 60,000 $.");
          return;
        }
        if (!addPlayerMoney(player, -60000) || !setBoosterProp(player, "perm_nightvision", true)) {
          addPlayerMoney(player, 60000);
          player.sendMessage("§b§l[§3Mejoras§b§l]§r §cNo se pudo guardar Visión Nocturna. Se devolvió tu dinero.");
          return;
        }
        player.sendMessage("§b§l[§3Mejoras§b§l]§r §a¡Has comprado Visión Nocturna permanente!");
        break;
      }
    }
    openPersonalPerksMenu(player);
  }).catch((error) => {
    try {
      console.warn(`[Mejoras] No se pudo abrir o actualizar mejoras personales: ${error}`);
      player.sendMessage("§c[Mejoras] No se pudo abrir el menú. Inténtalo de nuevo.");
    } catch (e) {}
  });
}

// Menú de gestión de Casas Extra
function openExtraHomesMenu(player) {
  const maxExtra = getBoosterProp(player, "extra_homes") ?? 0;
  if (maxExtra === 0) {
    const form = new ActionFormData()
      .title("🏠 Casas Adicionales")
      .body("§cNo tienes ranuras de casa adicionales compradas. Adquiérelas en el menú de Mejoras Personales.")
      .button("🔙 Volver");
    form.show(player).then(() => openBoostersMenu(player)).catch(() => {});
    return;
  }

  const form = new ActionFormData()
    .title("🏠 Casas Adicionales")
    .body("§7Gestiona tus puntos de aparición adicionales guardados:");

  for (let i = 1; i <= maxExtra; i++) {
    const isSet = getBoosterProp(player, `home_x_${i}`) !== undefined;
    form.button(`Casa Extra #${i} [${isSet ? "§aGuardado" : "§cNo Establecido"}]`);
  }
  form.button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    if (response.selection === maxExtra) {
      openBoostersMenu(player);
      return;
    }

    const homeIndex = response.selection + 1;
    openManageSingleExtraHome(player, homeIndex);
  }).catch(() => {});
}

function openManageSingleExtraHome(player, index) {
  const x = getBoosterProp(player, `home_x_${index}`);
  const y = getBoosterProp(player, `home_y_${index}`);
  const z = getBoosterProp(player, `home_z_${index}`);
  const dim = getBoosterProp(player, `home_dim_${index}`);

  const isSet = x !== undefined && y !== undefined && z !== undefined && dim !== undefined;
  const dimensionLabel = dim ? String(dim).split(":")[1] || String(dim) : "desconocida";

  const form = new ActionFormData()
    .title(`🏠 Casa Extra #${index}`)
    .body(`§7Detalles de tu casa adicional:\n\n` +
          `Ubicación: ${isSet ? `§e${Math.floor(x)}, ${Math.floor(y)}, ${Math.floor(z)} (§a${dimensionLabel}§e)` : "§cNo Establecido"}\n`)
    .button("📍 Guardar Ubicación Actual Aquí")
    .button("🌀 Teletransportarse Aquí")
    .button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    switch (response.selection) {
      case 0: { // Guardar
        const loc = player.location;
        const dimension = player.dimension.id;
        const saved = setBoosterProp(player, `home_x_${index}`, loc.x)
          && setBoosterProp(player, `home_y_${index}`, loc.y)
          && setBoosterProp(player, `home_z_${index}`, loc.z)
          && setBoosterProp(player, `home_dim_${index}`, dimension);
        if (!saved) {
          player.sendMessage("§b§l[§3Base§b§l]§r §cNo se pudo persistir la ubicación de esta casa extra.");
          return;
        }
        if (!setSharedExtraHomeLocation(player, index, loc, dimension)) {
          player.sendMessage("§b§l[§3Base§b§l]§r §cLa ubicación se guardó, pero no se pudo actualizar el índice de acceso.");
          return;
        }
        player.sendMessage(`§b§l[§3Base§b§l]§r §a¡Ubicación para Casa Extra #${index} guardada con éxito!`);
        openManageSingleExtraHome(player, index);
        break;
      }
      case 1: { // Teletransportarse
        if (!isSet) {
          player.sendMessage("§b§l[§3Base§b§l]§r §cEsta casa no ha sido establecida aún.");
          return;
        }
        player.teleport({ x, y, z }, { dimension: world.getDimension(dim) });
        player.sendMessage(`§b§l[§3Base§b§l]§r §aTeletransportado a Casa Extra #${index}.`);
        break;
      }
      case 2:
        openExtraHomesMenu(player);
        break;
    }
  }).catch(() => {});
}
