import { ErrorReporter } from "./ErrorReporter.js";
import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, PlayerPermissionLevel, world, system, ItemStack, EnchantmentTypes, EquipmentSlot } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { LEGACY_MODERATION_MODE } from "./FcxLegacyModerationConfig.js";






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
globalThis.__sqlite_sync_complete_v2__.delete("home_spawn_addon");
globalThis.__sqlite_request_sync_v3__("home_spawn_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("home_spawn_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("home_spawn_addon", 1);
  } catch (e) {}
}, 120);
system.runTimeout(() => {
  // Sin demonio (mundo importado sin bridge) se opera en modo degradado tras ~10s: RAM es la fuente de verdad.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("home_spawn_addon");
    if (state && !state.complete) {
      state.degraded = true;
      globalThis.__sqlite_sync_complete_v2__.set("home_spawn_addon", Date.now());
      globalThis.__sqlite_flush_pending_v3__("home_spawn_addon");
    }
  } catch (e) {}
}, 200);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
console.warn("Home, Spawn y TPA Addon iniciado.");
system.runTimeout(() => { try { const entries = [].map((id) => { const value = globalThis.__sqlite_get_prop_v2__("home_spawn_addon", "world", id); return { id, size: typeof value === "string" ? value.length : value === undefined ? 0 : String(value).length }; }).sort((a, b) => b.size - a.size); console.warn(`[DP_AUDIT_HOME_V1] total_chars=${entries.reduce((sum, entry) => sum + entry.size, 0)} largest=${JSON.stringify(entries.slice(0, 12))}`); } catch (e) { console.warn(`[DP_AUDIT_HOME_V1] failed=${String(e?.message || e)}`); } }, 100);
const COMMAND_NAMESPACE = "s";
const EXTRA_HOMES_SHARED_OBJECTIVE = "extra_homes_shared";

function getSharedExtraHomes(player) {
  try {
    const objective = world.scoreboard.getObjective(EXTRA_HOMES_SHARED_OBJECTIVE);
    return Math.max(0, Math.min(5, Math.floor(Number(objective?.getScore(player) ?? 0))));
  } catch (e) { return 0; }
}

function getSharedExtraHomeLocation(player, slot) {
  try {
    const get = (field) => world.scoreboard.getObjective(`xhome_${slot}_${field}`)?.getScore(player);
    if (Number(get("s")) !== 1) return undefined;
    const x = get("x"), y = get("y"), z = get("z"), dimensionCode = Number(get("d"));
    if (![x, y, z].every(Number.isFinite)) return undefined;
    const dimension = dimensionCode === 1 ? "minecraft:nether" : dimensionCode === 2 ? "minecraft:the_end" : "minecraft:overworld";
    return { x, y, z, dimension };
  } catch (e) { return undefined; }
}

function setSharedExtraHomeLocation(player, slot, location, dimensionId) {
  const dimensionCode = dimensionId === "minecraft:nether" ? 1 : dimensionId === "minecraft:the_end" ? 2 : 0;
  try {
    for (const [field, value] of Object.entries({
      x: Math.floor(location.x),
      y: Math.floor(location.y),
      z: Math.floor(location.z),
      d: dimensionCode,
      s: 1,
    })) {
      const objectiveName = `xhome_${slot}_${field}`;
      const objective = world.scoreboard.getObjective(objectiveName)
        || world.scoreboard.addObjective(objectiveName, objectiveName);
      objective.setScore(player, value);
    }
    return true;
  } catch (e) {
    console.warn(`[Home] No se pudo guardar la casa extra #${slot} de ${player?.name}: ${e}`);
    return false;
  }
}
const ADMIN_PERMISSION =
  CommandPermissionLevel.GameDirectors ??
  CommandPermissionLevel.Admin ??
  CommandPermissionLevel.Host ??
  CommandPermissionLevel.Owner ??
  CommandPermissionLevel.Any;
const GRAVE_LIFETIME_TICKS = 10 * 60 * 20;
const GRAVE_SWEEP_INTERVAL_TICKS = 40;
const GRAVE_TRANSFER_SYSTEM_ENABLED = true;
const HOUR_MS = 60 * 60 * 1000;
const TELEPORT_EXEMPT_TAG = "event_mode";
const TELEPORT_EXEMPT_TICKS = 60;
const DUPE_COST_PER_ITEM = 250;
const DUPE_MACHINE_ENABLED = false;
const DUPE_DAILY_COPY_LIMIT = 64;
const DUPE_QUOTA_PROPERTY = "decorative_dupe_quota_v2";
const DUPE_REPLICA_MARKER = "§8Replica decorativa - sin valor economico";
const activeDupeSessions = new Set();
const DUPE_ALLOWED_DECORATIVE_ITEMS = new Set([
  "minecraft:painting",
  "minecraft:item_frame",
  "minecraft:glow_item_frame",
  "minecraft:flower_pot",
  "minecraft:armor_stand",
  "minecraft:white_banner",
  "minecraft:black_banner",
  "minecraft:red_banner",
  "minecraft:blue_banner",
  "minecraft:green_banner",
  "minecraft:yellow_banner",
  "minecraft:purple_banner"
]);

function commandOk(message) {
  return { status: CustomCommandStatus.Success, message };
}

function commandError(message) {
  return { status: CustomCommandStatus.Failure, message };
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

function runMenuCommand(player, primaryCommand, fallbackScriptEvent = undefined) {
  const cmd = primaryCommand.startsWith("/") ? primaryCommand : "/" + primaryCommand;
  try {
    player.runCommand(cmd);
    return true;
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    if (fallbackScriptEvent) {
      try {
        player.runCommand(fallbackScriptEvent);
        return true;
      } catch (fallbackError) { ErrorReporter.report(fallbackError, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
    }
  }
  return false;
}

function openBoostersFromMenu(player) {
  try {
    if (typeof globalThis.openBoostersMenu === "function") {
      globalThis.openBoostersMenu(player);
      return true;
    }
  } catch (error) {
    ErrorReporter.report(error, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "openBoostersFromMenu", category: "runtime" });
  }
  try {
    player.runCommand("scriptevent cmd:boosters");
    return true;
  } catch (error) {
    ErrorReporter.report(error, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "openBoostersFromMenuFallback", category: "runtime" });
  }
  return runMenuCommand(player, "s:boosters");
}

function grantTemporaryTeleportExemption(player, durationTicks = TELEPORT_EXEMPT_TICKS) {
  if (!player) return;
  try {
    player.addTag(TELEPORT_EXEMPT_TAG);
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  system.runTimeout(() => {
    if (!player || !player.isValid) return;
    try {
      player.removeTag(TELEPORT_EXEMPT_TAG);
    } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }, durationTicks);
}

// === WARMUP DE TELETRANSPORTE (anti escape en combate) ===
const TELEPORT_WARMUP_TICKS = 60; // 3 segundos
const PVP_COMBAT_WINDOW_MS = 10 * 1000;
const pendingTeleportWarmups = new Map(); // player.id -> { runId }
const pvpCombatUntil = new Map(); // player.id -> timestamp fin de combate

function isInPvpCombat(player) {
  return Date.now() < Number(pvpCombatUntil.get(player?.id) || 0);
}

function cancelTeleportWarmup(player, reason) {
  const entry = pendingTeleportWarmups.get(player?.id);
  if (!entry) return false;
  pendingTeleportWarmups.delete(player.id);
  try { system.clearRun(entry.runId); } catch (e) {}
  try {
    if (player.isValid) {
      player.sendMessage(reason === "combat"
        ? "§b§l[§3TP§b§l]§r §cTeletransporte cancelado: entraste en combate PvP."
        : "§b§l[§3TP§b§l]§r §cTeletransporte cancelado: recibiste daño.");
    }
  } catch (e) {}
  return true;
}

function startTeleportWarmup(player, label, executeTeleport) {
  if (!player || !player.isValid) return false;
  if (isInPvpCombat(player)) {
    try { player.sendMessage("§b§l[§3TP§b§l]§r §cEstás en combate PvP. Espera unos segundos antes de teletransportarte."); } catch (e) {}
    return false;
  }
  if (pendingTeleportWarmups.has(player.id)) {
    try { player.sendMessage("§b§l[§3TP§b§l]§r §eYa tienes un teletransporte en curso."); } catch (e) {}
    return false;
  }
  try {
    player.sendMessage(`§b§l[§3TP§b§l]§r §7Teletransporte a §e${label}§7 en §e3 segundos§7. Si recibes daño o entras en combate PvP se cancelará.`);
  } catch (e) {}
  const runId = system.runTimeout(() => {
    pendingTeleportWarmups.delete(player.id);
    try {
      if (!player.isValid) return;
      if (isInPvpCombat(player)) {
        player.sendMessage("§b§l[§3TP§b§l]§r §cTeletransporte cancelado: estás en combate PvP.");
        return;
      }
      executeTeleport();
    } catch (error) {
      ErrorReporter.report(error, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "teleportWarmup", category: "runtime" });
      try { player.sendMessage("§b§l[§3TP§b§l]§r §cError al teletransportarse."); } catch (e) {}
    }
  }, TELEPORT_WARMUP_TICKS);
  pendingTeleportWarmups.set(player.id, { runId });
  return true;
}

try {
  world.afterEvents.entityHurt.subscribe((event) => {
    try {
      const victim = event.hurtEntity;
      if (!victim || victim.typeId !== "minecraft:player") return;
      // Cualquier daño recibido cancela el warmup activo.
      cancelTeleportWarmup(victim, "damage");
      const attacker = event.damageSource?.damagingEntity;
      if (!attacker || attacker.typeId !== "minecraft:player" || attacker.id === victim.id) return;
      const until = Date.now() + PVP_COMBAT_WINDOW_MS;
      pvpCombatUntil.set(victim.id, until);
      pvpCombatUntil.set(attacker.id, until);
      cancelTeleportWarmup(attacker, "combat");
    } catch (e) {}
  });
} catch (e) {
  ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "pvpWarmupTracker", category: "runtime" });
}
// === FIN WARMUP DE TELETRANSPORTE ===

function getDupeItemFingerprint(item, includeAmount = true) {
  if (!item) return "";
  try {
    const enchantments = (item.getComponent?.("minecraft:enchantable")?.getEnchantments?.() ?? [])
      .map((entry) => `${entry.type?.id ?? entry.type}:${entry.level}`)
      .sort();
    // Los metadatos dinámicos de los ítems ya no forman parte del contrato de
    // persistencia. El fingerprint conserva únicamente datos serializables.
    const dynamicProperties = [];
    const durability = item.getComponent?.("minecraft:durability");
    return JSON.stringify({
      typeId: item.typeId,
      amount: includeAmount ? item.amount : undefined,
      nameTag: item.nameTag ?? "",
      lore: item.getLore?.() ?? [],
      enchantments,
      damage: durability ? Number(durability.damage || 0) : undefined,
      canDestroy: item.getCanDestroy?.() ?? [],
      canPlaceOn: item.getCanPlaceOn?.() ?? [],
      dynamicProperties
    });
  } catch (e) {
    ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "getDupeItemFingerprint", category: "runtime" });
    return "";
  }
}

function hasForbiddenDupeMetadata(item) {
  if (!item) return true;
  try {
    if (String(item.nameTag || "").trim()) return true;
    if ((item.getLore?.() ?? []).length > 0) return true;
    if ((item.getCanDestroy?.() ?? []).length > 0) return true;
    if ((item.getCanPlaceOn?.() ?? []).length > 0) return true;
    if ((item.getComponent?.("minecraft:enchantable")?.getEnchantments?.() ?? []).length > 0) return true;
    const durability = item.getComponent?.("minecraft:durability");
    if (durability && Number(durability.damage || 0) !== 0) return true;
    return false;
  } catch (e) {
    return true;
  }
}

function isForbiddenDupeItem(item) {
  const typeId = String(item?.typeId || "").toLowerCase();
  return !DUPE_ALLOWED_DECORATIVE_ITEMS.has(typeId) || hasForbiddenDupeMetadata(item);
}

function dupeQuotaDayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function getDupeQuota(player) {
  const empty = { day: dupeQuotaDayUtc(), used: 0 };
  try {
    const parsed = globalThis.__sqlite_read_json_v3__(globalThis.__sqlite_get_prop_v2__("home_spawn_addon", player, DUPE_QUOTA_PROPERTY) || "{}");
    if (parsed?.day !== empty.day) return empty;
    return { day: empty.day, used: Math.max(0, Math.min(DUPE_DAILY_COPY_LIMIT, Math.floor(Number(parsed.used) || 0))) };
  } catch (e) {
    return empty;
  }
}

function saveDupeQuota(player, state) {
  try {
    const serialized = JSON.stringify(state);
    globalThis.__sqlite_set_prop_v2__("home_spawn_addon", player, DUPE_QUOTA_PROPERTY, serialized);
    return String(globalThis.__sqlite_get_prop_v2__("home_spawn_addon", player, DUPE_QUOTA_PROPERTY) || "") === serialized;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "saveDupeQuota", category: "runtime" });
    return false;
  }
}

function readMoneyBalance(player) {
  const objective = world.scoreboard.getObjective("money");
  if (!objective) return 0;
  try {
    return Math.max(0, Math.floor((function(o, p){ try{return o.getScore(p) ?? 0;}catch(e){try{return o.getScore(p.name) ?? 0;}catch(e2){return 0;}} })(objective, player) || 0));
  } catch (e) {
    return 0;
  }
}

function changeMoneyBalance(player, delta) {
  const objective = world.scoreboard.getObjective("money");
  if (!objective) return false;
  const current = readMoneyBalance(player);
  const next = current + Math.trunc(Number(delta) || 0);
  if (next < 0 || next > 2147483647) return false;
  try {
    try { objective.setScore(player, next); } catch (identityError) { objective.setScore(player.name, next); }
    return readMoneyBalance(player) === next;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "changeMoneyBalance", category: "runtime" });
    return false;
  }
}

function createDecorativeReplica(item, amount = 1) {
  const replica = item.clone();
  replica.amount = amount;
  replica.setLore([DUPE_REPLICA_MARKER]);
  return replica;
}

function estimateInsertCapacity(container, templateItem) {
  if (!container || !templateItem) return 0;

  const typeId = templateItem.typeId;
  const maxStack = Math.max(1, templateItem.maxAmount || 1);
  let capacity = 0;

  for (let i = 0; i < container.size; i++) {
    const slotItem = container.getItem(i);
    if (!slotItem) {
      capacity += maxStack;
      continue;
    }

    if (slotItem.typeId !== typeId) continue;
    if (getDupeItemFingerprint(slotItem, false) !== getDupeItemFingerprint(templateItem, false)) continue;

    const freeSpace = Math.max(0, maxStack - (slotItem.amount || 0));
    capacity += freeSpace;
  }

  return capacity;
}

system.run(() => {
  try {
    world.getDimension("minecraft:overworld").runCommand("gamerule keepinventory true");
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn("[Tumba] No se pudo activar keepinventory automáticamente: " + e);
  }
});

// Registro de solicitudes de TPA en memoria: Destino (minúsculas) -> { senderName: string, timestamp: number }
const tpaRequests = new Map();
const TPA_TIMEOUT_MS = 60000; // 60 segundos

const targetCommands = [];

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
      for (const name of [
        "home", "casa",
        "sethome", "guardarcasa", "fijarcasa", "establecercasa",
        "delhome", "borrarcasa", "eliminarcasa",
        "spawn", "aparicion", "origen", "reaparicion",
        "setspawn", "fijaraparicion", "estableceraparicion", "fijarorigen",
        "tpaccept", "tpaaceptar", "aceptartp",
        "tpdeny", "tparechazar", "rechazartp",
        "guias", "reglas", "tumba", "tumbatp"
      ]) {
        register({
          name: `${COMMAND_NAMESPACE}:${name}`,
          description: `Comando ${name}`,
          permissionLevel: (name === "setspawn" || name === "estableceraparicion" || name === "fijaraparicion" || name === "fijarorigen") ? ADMIN_PERMISSION : CommandPermissionLevel.Any,
          ...(name === "home" || name === "casa" || name === "sethome" || name === "guardarcasa" || name === "fijarcasa" || name === "establecercasa" || name === "delhome" || name === "borrarcasa" || name === "eliminarcasa"
            ? { optionalParameters: [{ name: "numero", type: CustomCommandParamType.Integer }] }
            : {}),
        }, (origin, numero) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          if ((name === "setspawn" || name === "estableceraparicion" || name === "fijaraparicion" || name === "fijarorigen") && !isPlayerOp(sender)) {
            return commandError("Solo para operadores.");
          }
          let internalName = name;
          if (["casa"].includes(name)) internalName = "home";
          if (["guardarcasa", "fijarcasa", "establecercasa"].includes(name)) internalName = "sethome";
          if (["borrarcasa", "eliminarcasa"].includes(name)) internalName = "delhome";
          if (["aparicion", "origen", "reaparicion"].includes(name)) internalName = "spawn";
          if (["fijaraparicion", "fijarorigen", "estableceraparicion"].includes(name)) internalName = "setspawn";
          if (["tpaaceptar", "aceptartp"].includes(name)) internalName = "tpaccept";
          if (["tparechazar", "rechazartp"].includes(name)) internalName = "tpdeny";
          system.run(async () => {
            const args = [internalName];
            if (numero !== undefined && numero !== null) args.push(String(numero));
            await handleCommand(sender, internalName, args);
          });
          return commandOk(`Procesando ${name}.`);
        });
      }

      for (const name of ["tpa", "pedirtp"]) {
        register({
          name: `${COMMAND_NAMESPACE}:${name}`,
          description: "Solicita teletransporte a un jugador",
          permissionLevel: CommandPermissionLevel.Any,
          mandatoryParameters: [{ name: "jugador", type: CustomCommandParamType.String }],
        }, (origin, jugador) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          system.run(async () => {
            await handleCommand(sender, "tpa", ["tpa", String(jugador)]);
          });
          return commandOk(`Procesando ${name}.`);
        });
      }

      if (LEGACY_MODERATION_MODE === "ENABLED") {
        for (const name of ["vetar", "ban"]) {
          register({
            name: `${COMMAND_NAMESPACE}:${name}`,
            description: "Veta permanentemente a un jugador",
            permissionLevel: ADMIN_PERMISSION,
            mandatoryParameters: [{ name: "jugador", type: CustomCommandParamType.String }],
            optionalParameters: [{ name: "motivo", type: CustomCommandParamType.String }],
          }, (origin, jugador, motivo) => {
            const sender = origin?.sourceEntity;
            if (!sender) return commandError("Solo para jugadores.");
            if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
            const args = ["ban", String(jugador)];
            if (motivo !== undefined && motivo !== null && String(motivo).trim()) args.push(String(motivo));
            system.run(async () => {
              await handleCommand(sender, "ban", args);
            });
            return commandOk(`Procesando ${name}.`);
          });
        }

        for (const name of ["vetartemporal", "tempban"]) {
          register({
            name: `${COMMAND_NAMESPACE}:${name}`,
            description: "Veta temporalmente a un jugador",
            permissionLevel: ADMIN_PERMISSION,
            mandatoryParameters: [
              { name: "jugador", type: CustomCommandParamType.String },
              { name: "minutos", type: CustomCommandParamType.Integer },
            ],
            optionalParameters: [{ name: "motivo", type: CustomCommandParamType.String }],
          }, (origin, jugador, minutos, motivo) => {
            const sender = origin?.sourceEntity;
            if (!sender) return commandError("Solo para jugadores.");
            if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
            const args = ["tempban", String(jugador), String(minutos)];
            if (motivo !== undefined && motivo !== null && String(motivo).trim()) args.push(String(motivo));
            system.run(async () => {
              await handleCommand(sender, "tempban", args);
            });
            return commandOk(`Procesando ${name}.`);
          });
        }

        for (const name of ["desvetar", "unban"]) {
          register({
            name: `${COMMAND_NAMESPACE}:${name}`,
            description: "Retira el veto a un jugador",
            permissionLevel: ADMIN_PERMISSION,
            mandatoryParameters: [{ name: "jugador", type: CustomCommandParamType.String }],
          }, (origin, jugador) => {
            const sender = origin?.sourceEntity;
            if (!sender) return commandError("Solo para jugadores.");
            if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
            system.run(async () => {
              await handleCommand(sender, "unban", ["unban", String(jugador)]);
            });
            return commandOk(`Procesando ${name}.`);
          });
        }

        for (const name of ["silenciar", "mute"]) {
          register({
            name: `${COMMAND_NAMESPACE}:${name}`,
            description: "Silencia temporalmente a un jugador",
            permissionLevel: ADMIN_PERMISSION,
            mandatoryParameters: [
              { name: "jugador", type: CustomCommandParamType.String },
              { name: "minutos", type: CustomCommandParamType.Integer },
            ],
            optionalParameters: [{ name: "motivo", type: CustomCommandParamType.String }],
          }, (origin, jugador, minutos, motivo) => {
            const sender = origin?.sourceEntity;
            if (!sender) return commandError("Solo para jugadores.");
            if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
            const args = ["mute", String(jugador), String(minutos)];
            if (motivo !== undefined && motivo !== null && String(motivo).trim()) args.push(String(motivo));
            system.run(async () => {
              await handleCommand(sender, "mute", args);
            });
            return commandOk(`Procesando ${name}.`);
          });
        }

        for (const name of ["dessilenciar", "unmute"]) {
          register({
            name: `${COMMAND_NAMESPACE}:${name}`,
            description: "Retira el silencio a un jugador",
            permissionLevel: ADMIN_PERMISSION,
            mandatoryParameters: [{ name: "jugador", type: CustomCommandParamType.String }],
          }, (origin, jugador) => {
            const sender = origin?.sourceEntity;
            if (!sender) return commandError("Solo para jugadores.");
            if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
            system.run(async () => {
              await handleCommand(sender, "unmute", ["unmute", String(jugador)]);
            });
            return commandOk(`Procesando ${name}.`);
          });
        }
      } else if (LEGACY_MODERATION_MODE === "SHADOWED") {
        for (const name of ["desvetar", "unban", "dessilenciar", "unmute"]) {
          register({
            name: `${COMMAND_NAMESPACE}:${name}`,
            description: `Redirección FCX para ${name}`,
            permissionLevel: CommandPermissionLevel.Any,
            optionalParameters: [{ name: "jugador", type: CustomCommandParamType.String }],
          }, (origin) => {
            const sender = origin?.sourceEntity;
            if (sender) system.run(() => sender.sendMessage("§e[FCX Admin] La moderación heredada está desactivada. Usa §f/s:admin§e."));
            return commandError("Usa /s:admin.");
          });
        }
      }

      for (const name of ["borrarnpcs", "removernpcs"]) {
        register({
          name: `${COMMAND_NAMESPACE}:${name}`,
          description: "Remueve NPCs cercanos de soporte",
          permissionLevel: ADMIN_PERMISSION,
          optionalParameters: [{ name: "radio", type: CustomCommandParamType.Integer }],
        }, (origin, radio) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
          const args = ["removernpcs"];
          if (radio !== undefined && radio !== null) args.push(String(radio));
          system.run(async () => {
            await handleCommand(sender, "removernpcs", args);
          });
          return commandOk(`Procesando ${name}.`);
        });
      }

      for (const name of ["listastaff", "adminlist"]) {
        register({
          name: `${COMMAND_NAMESPACE}:${name}`,
          description: "Lista histórica de jugadores y XUID",
          permissionLevel: ADMIN_PERMISSION,
          optionalParameters: [{ name: "filtro", type: CustomCommandParamType.String }],
        }, (origin, filtro) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          const args = ["adminlist"];
          if (filtro !== undefined && filtro !== null && String(filtro).trim()) args.push(String(filtro));
          system.run(async () => {
            await handleCommand(sender, "adminlist", args);
          });
          return commandOk(`Procesando ${name}.`);
        });
      }
    } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Home and Spawn Addon] Error registrando custom commands: " + e);
    }
  });
}

registerCustomCommands();

function isPlayerOp(player) {
  if (!player) return false;
  try {
    if (player.playerPermissionLevel === PlayerPermissionLevel.Operator) return true;
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  try {
    if (typeof player.hasTag === "function") {
      if (
        player.hasTag("op") ||
        player.hasTag("OP") ||
        player.hasTag("admin") ||
        player.hasTag("Admin") ||
        player.hasTag("staff") ||
        player.hasTag("Staff") ||
        player.hasTag("mod") ||
        player.hasTag("Mod") ||
        player.hasTag("owner") ||
        player.hasTag("Owner") ||
        player.hasTag("clan_admin_bypass") ||
        player.hasTag("zone_admin_bypass") ||
        player.hasTag("protection_bypass")
      ) {
        return true;
      }
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  try {
    const permission = String(player.permission ?? player.commandPermissionLevel ?? "").toLowerCase();
    if (permission.includes("operator") || permission.includes("admin") || permission.includes("host") || permission.includes("owner") || permission.includes("director")) {
      return true;
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  try {
    if (typeof player.isOp === "function") {
      return player.isOp() === true;
    }
    if (player.isOp === true) {
      return true;
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  return false;
}

function normalizePlayerName(value) {
  return String(value || "").trim().toLowerCase();
}

const RELAY_MODERATION_EVENT_ID = "server:moderation";
const RELAY_MODERATION_MAX_MESSAGE_LENGTH = 512;
const RELAY_MODERATION_MAX_REASON_LENGTH = 240;
// Tope de cordura para baneos temporales recibidos por relay (90 días, el máximo
// documentado para OWNER en FCX). El demonio ya acota la duración por rol.
const RELAY_MODERATION_MAX_BAN_MINUTES = 129600;
const RELAY_PLAYER_NAME_PATTERN = /^[A-Za-z0-9_ .-]{1,32}$/;

function normalizeRelayPlayerName(value) {
  if (typeof value !== "string") return "";
  const playerName = value.trim();
  return RELAY_PLAYER_NAME_PATTERN.test(playerName) ? playerName : "";
}

function normalizeRelayReason(value) {
  if (typeof value !== "string") return "";
  const reason = value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return reason.length > 0 && reason.length <= RELAY_MODERATION_MAX_REASON_LENGTH ? reason : "";
}

function hasExactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function announceConfirmedModeration(action, playerName, durationMinutes, reason) {
  const name = normalizeRelayPlayerName(String(playerName || "").trim()) || "Jugador";
  const safeReason = normalizeRelayReason(reason) || "No especificado";
  const duration = Math.max(1, Math.floor(Number(durationMinutes) || 0));
  const text = action === "mute"
    ? `§8[§cModeración§8] §f${name} §7ha sido silenciado durante §e${duration} min§7. §8Motivo: §f${safeReason}`
    : action === "temporary"
      ? `§8[§cModeración§8] §f${name} §7ha sido baneado temporalmente durante §e${duration} min§7. §8Motivo: §f${safeReason}`
      : `§8[§cModeración§8] §f${name} §7ha sido baneado permanentemente. §8Motivo: §f${safeReason}`;
  try {
    world.sendMessage(text);
    console.warn(`[MODERATION_APPLIED] ${JSON.stringify({ action, name, durationMinutes: action === "permanent" ? 0 : duration, reason: safeReason })}`);
  } catch (error) {
    ErrorReporter.report(error, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "moderation_announcement", category: "moderation" });
  }
}

function handleRelayModerationEvent(event) {
  // Events issued by a player/entity are never trusted. The relay writes the
  // command to the dedicated server console, which has no source entity.
  if (event?.sourceEntity) {
    console.warn("[MUTE_SYNC] rejected source=entity");
    return;
  }
  const raw = typeof event?.message === "string" ? event.message : "";
  if (!raw || raw.length > RELAY_MODERATION_MAX_MESSAGE_LENGTH) {
    console.warn("[MUTE_SYNC] rejected reason=payload_size");
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    console.warn("[MUTE_SYNC] rejected reason=invalid_json");
    return;
  }

  const action = payload?.action;
  const playerName = normalizeRelayPlayerName(payload?.playerName);
  const reason = normalizeRelayReason(payload?.reason);
  if (!playerName || !reason) {
    console.warn("[MUTE_SYNC] rejected reason=invalid_fields");
    return;
  }
  const normalizedName = normalizePlayerName(playerName);

  if (action === "mute") {
    if (!hasExactKeys(payload, ["action", "playerName", "durationMinutes", "reason"]) || !Number.isInteger(payload.durationMinutes) || payload.durationMinutes < 1 || payload.durationMinutes > 1440) {
      console.warn("[MUTE_SYNC] rejected reason=invalid_mute");
      return;
    }
    const expiresAt = Date.now() + (payload.durationMinutes * 60000);
    try {
      globalThis.__sqlite_set_prop_v2__("home_spawn_addon", "world", "mute_" + normalizedName, expiresAt);
      globalThis.__sqlite_set_prop_v2__("home_spawn_addon", "world", "mute_reason_" + normalizedName, reason);
      if (globalThis.__sqlite_get_prop_v2__("home_spawn_addon", "world", "mute_" + normalizedName) !== expiresAt || globalThis.__sqlite_get_prop_v2__("home_spawn_addon", "world", "mute_reason_" + normalizedName) !== reason) {
        globalThis.__sqlite_set_prop_v2__("home_spawn_addon", "world", "mute_" + normalizedName, undefined);
        globalThis.__sqlite_set_prop_v2__("home_spawn_addon", "world", "mute_reason_" + normalizedName, undefined);
        throw new Error("mute_write_verification_failed");
      }
      const target = world.getAllPlayers().find((player) => normalizePlayerName(player.name) === normalizedName);
      if (target) target.sendMessage(`§b§l[§3Servidor§b§l]§r §cHas sido silenciado por §e${payload.durationMinutes} minutos§c. Motivo: §e${reason}`);
      console.warn(`[MUTE_SYNC] ${JSON.stringify({ name: playerName, reason, expiresAt })}`);
      void announceConfirmedModeration("mute", playerName, payload.durationMinutes, reason);
    } catch (error) {
      ErrorReporter.report(error, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "relay_mute", category: "moderation" });
      console.warn("[MUTE_SYNC] rejected reason=write_failed");
    }
    return;
  }

  if (action === "unmute") {
    if (!hasExactKeys(payload, ["action", "playerName", "reason"])) {
      console.warn("[MUTE_SYNC] rejected reason=invalid_unmute");
      return;
    }
    try {
      globalThis.__sqlite_set_prop_v2__("home_spawn_addon", "world", "mute_" + normalizedName, undefined);
      globalThis.__sqlite_set_prop_v2__("home_spawn_addon", "world", "mute_reason_" + normalizedName, undefined);
      if (globalThis.__sqlite_get_prop_v2__("home_spawn_addon", "world", "mute_" + normalizedName) !== undefined || globalThis.__sqlite_get_prop_v2__("home_spawn_addon", "world", "mute_reason_" + normalizedName) !== undefined) throw new Error("unmute_write_verification_failed");
      const target = world.getAllPlayers().find((player) => normalizePlayerName(player.name) === normalizedName);
      if (target) target.sendMessage("§b§l[§3Servidor§b§l]§r §aHas sido desmuteado. Ya puedes hablar en el chat.");
      console.warn(`[UNMUTE_SYNC] ${JSON.stringify({ name: playerName, reason, expiresAt: 0 })}`);
    } catch (error) {
      ErrorReporter.report(error, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "relay_unmute", category: "moderation" });
      console.warn("[MUTE_SYNC] rejected reason=unmute_write_failed");
    }
    return;
  }
  if (action === "temporary" || action === "permanent") {
    const isPermanent = action === "permanent";
    const expectedKeys = isPermanent
      ? ["action", "playerName", "reason", "actorName", "correlationId"]
      : ["action", "playerName", "durationMinutes", "reason", "actorName", "correlationId"];
    if (!hasExactKeys(payload, expectedKeys)) {
      console.warn("[BAN_SYNC] rejected reason=invalid_ban_keys");
      return;
    }
    let durationMinutes = 0;
    if (!isPermanent) {
      if (!Number.isInteger(payload.durationMinutes) || payload.durationMinutes < 1 || payload.durationMinutes > RELAY_MODERATION_MAX_BAN_MINUTES) {
        console.warn("[BAN_SYNC] rejected reason=invalid_ban_duration");
        return;
      }
      durationMinutes = payload.durationMinutes;
    }
    const actorName = normalizeRelayPlayerName(payload.actorName) || "Consola";
    const correlationId = String(payload.correlationId || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
    try {
      const expiresAt = isPermanent ? 0 : Date.now() + durationMinutes * 60000;
      const target = world.getAllPlayers().find((player) => normalizePlayerName(player.name) === normalizedName);
      const targetXuid = String(target?.xuid || "").trim();
      const entry = buildBanEntry(playerName, target, reason, actorName, expiresAt);
      const sameIdentity = (item) =>
        normalizePlayerName(item?.nameLower || item?.name) === normalizedName ||
        (targetXuid && String(item?.xuid || "").trim() === targetXuid);
      const { active } = pruneExpiredBans(loadBans());
      const updatedBans = active.filter((item) => !sameIdentity(item));
      updatedBans.push(entry);
      saveBans(updatedBans);
      if (globalThis.__sqlite_get_prop_v2__("home_spawn_addon", "world", "bans_db") !== JSON.stringify(updatedBans)) {
        throw new Error("ban_write_verification_failed");
      }
      if (target) kickBannedPlayer(target, entry);
      console.warn(`[BAN_SYNC] ${JSON.stringify({ name: playerName, permanent: isPermanent, expiresAt, correlationId })}`);
      void announceConfirmedModeration(isPermanent ? "permanent" : "temporary", playerName, durationMinutes, reason);
    } catch (error) {
      ErrorReporter.report(error, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "relay_ban", category: "moderation" });
      console.warn("[BAN_SYNC] rejected reason=write_failed");
    }
    return;
  }

  if (action === "unban") {
    if (!hasExactKeys(payload, ["action", "playerName", "reason", "actorName", "correlationId"])) {
      console.warn("[BAN_SYNC] rejected reason=invalid_unban_keys");
      return;
    }
    const correlationId = String(payload.correlationId || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
    try {
      const target = world.getAllPlayers().find((player) => normalizePlayerName(player.name) === normalizedName);
      const targetXuid = String(target?.xuid || "").trim();
      const sameIdentity = (item) =>
        normalizePlayerName(item?.nameLower || item?.name) === normalizedName ||
        (targetXuid && String(item?.xuid || "").trim() === targetXuid);
      const { active } = pruneExpiredBans(loadBans());
      const updatedBans = active.filter((item) => !sameIdentity(item));
      saveBans(updatedBans);
      if (globalThis.__sqlite_get_prop_v2__("home_spawn_addon", "world", "bans_db") !== JSON.stringify(updatedBans)) {
        throw new Error("unban_write_verification_failed");
      }
      if (target) target.sendMessage("§b§l[§3Servidor§b§l]§r §aTu veto ha sido retirado. Ya puedes volver al servidor.");
      console.warn(`[UNBAN_SYNC] ${JSON.stringify({ name: playerName, correlationId })}`);
    } catch (error) {
      ErrorReporter.report(error, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "relay_unban", category: "moderation" });
      console.warn("[BAN_SYNC] rejected reason=unban_write_failed");
    }
    return;
  }
  console.warn("[MUTE_SYNC] rejected reason=unsupported_action");
}

function sanitizeModerationReason(value, fallback = "No especificado") {
  const cleaned = String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

function escapeCommandArg(value) {
  return String(value || "").replace(/"/g, '\\"');
}

// --- REGISTRO DE JUGADORES RECIBIDOS ---
const welcomedPlayers = new Set();
const PLAYER_HISTORY_DB_KEY = "players_history_db";

function loadPlayerHistory() {
  try {
    const data = globalThis.__sqlite_get_prop_v2__("home_spawn_addon", "world", PLAYER_HISTORY_DB_KEY);
    const parsed = data ? globalThis.__sqlite_read_json_v3__(data) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn("Error al cargar historial de jugadores: " + e);
    return [];
  }
}

function savePlayerHistory(entries) {
  try {
    globalThis.__sqlite_set_prop_v2__("home_spawn_addon", "world", PLAYER_HISTORY_DB_KEY, JSON.stringify(entries));
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn("Error al guardar historial de jugadores: " + e);
  }
}

function recordPlayerHistory(player) {
  if (!player) return;

  try {
    const now = Date.now();
    const name = String(player.name || "").trim();
    const nameLower = normalizePlayerName(name);
    const xuid = String(player.xuid || "").trim();
    if (!nameLower && !xuid) return;

    const entries = loadPlayerHistory();
    let entry = entries.find((item) => String(item?.xuid || "").trim() === xuid && xuid);

    if (!entry) {
      entry = entries.find((item) => normalizePlayerName(item?.nameLower || item?.name) === nameLower);
    }

    if (entry) {
      entry.name = name || entry.name || "Desconocido";
      entry.nameLower = nameLower || entry.nameLower || "";
      if (xuid) entry.xuid = xuid;
      entry.lastSeenAt = now;
      if (!entry.firstSeenAt) entry.firstSeenAt = now;
      if (!Array.isArray(entry.names)) entry.names = [];
      if (name && !entry.names.some((value) => normalizePlayerName(value) === nameLower)) {
        entry.names.push(name);
      }
    } else {
      entries.push({
        name,
        nameLower,
        xuid,
        names: name ? [name] : [],
        firstSeenAt: now,
        lastSeenAt: now,
      });
    }

    entries.sort((a, b) => Number(b?.lastSeenAt || 0) - Number(a?.lastSeenAt || 0));
    savePlayerHistory(entries.slice(0, 2000));
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn("Error registrando historial de jugador: " + e);
  }
}

function sendAdminPlayerHistory(player, filter = "") {
  const normalizedFilter = normalizePlayerName(filter);
  const entries = loadPlayerHistory();

  let filtered = entries;
  if (normalizedFilter) {
    filtered = entries.filter((entry) => {
      const xuid = String(entry?.xuid || "").toLowerCase();
      const primaryName = normalizePlayerName(entry?.nameLower || entry?.name);
      const aliases = Array.isArray(entry?.names) ? entry.names.map((value) => normalizePlayerName(value)) : [];
      return primaryName.includes(normalizedFilter) || xuid.includes(normalizedFilter) || aliases.some((alias) => alias.includes(normalizedFilter));
    });
  }

  if (filtered.length === 0) {
    player.sendMessage(`§b§l[§3AdminList§b§l]§r §cNo hay registros para el filtro: §e${filter || "sin filtro"}§c.`);
    return;
  }

  player.sendMessage(`§b§l[§3AdminList§b§l]§r §7Mostrando §e${Math.min(filtered.length, 25)}§7 de §e${filtered.length} §7registros${normalizedFilter ? ` para §e${filter}` : ""}.`);
  player.sendMessage("§7Formato: §bNombre actual §7| §dXUID §7| §aÚltimo visto");

  for (const entry of filtered.slice(0, 25)) {
    const seenAt = entry?.lastSeenAt ? new Date(entry.lastSeenAt).toLocaleString("es-ES") : "Sin fecha";
    const aliases = Array.isArray(entry?.names) && entry.names.length > 1 ? ` §8(Alias: ${entry.names.join(", ")})` : "";
    player.sendMessage(`§f${entry.name || "Desconocido"} §7| §d${entry.xuid || "sin-xuid"} §7| §a${seenAt}${aliases}`);
  }

  if (filtered.length > 25) {
    player.sendMessage("§7Usa §e/s:adminlist <nombre_o_xuid> §7para filtrar mejor.");
  }
}

// --- SISTEMA DE BAN POR XUID ---
let bansCacheRaw;
let bansCache = [];

function loadBans() {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("home_spawn_addon", "world", "bans_db");
    if (raw === bansCacheRaw) return bansCache;
    bansCacheRaw = raw;
    bansCache = globalThis.__sqlite_read_json_v3__(raw, []);
    return bansCache;
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn("Error al cargar bans: " + e);
    return [];
  }
}

function saveBans(bans) {
  try {
    const raw = JSON.stringify(bans);
    globalThis.__sqlite_set_prop_v2__("home_spawn_addon", "world", "bans_db", raw);
    bansCacheRaw = raw;
    bansCache = bans;
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn("Error al guardar bans: " + e);
  }
}

function pruneExpiredBans(bans) {
  const now = Date.now();
  let changed = false;
  const active = (Array.isArray(bans) ? bans : []).filter((entry) => {
    const expiresAt = Number(entry?.expiresAt || 0);
    if (expiresAt > 0 && expiresAt <= now) {
      changed = true;
      return false;
    }
    return true;
  });
  return { active, changed };
}

function buildBanEntry(targetName, targetPlayer, reason, by, expiresAt = 0) {
  const resolvedName = targetPlayer ? targetPlayer.name : targetName;
  return {
    name: resolvedName,
    nameLower: normalizePlayerName(resolvedName),
    xuid: String(targetPlayer?.xuid || "").trim(),
    reason,
    by,
    createdAt: Date.now(),
    expiresAt: Number(expiresAt || 0),
    date: new Date().toLocaleString("es-ES"),
  };
}

function formatBanDuration(minutes) {
  const totalMinutes = Math.max(1, Math.floor(Number(minutes) || 0));
  if (totalMinutes % 60 === 0) {
    const hours = totalMinutes / 60;
    return `${hours} hora${hours === 1 ? "" : "s"}`;
  }
  return `${totalMinutes} minuto${totalMinutes === 1 ? "" : "s"}`;
}

function findActiveBanEntry(playerName, playerXuid = "") {
  const normalizedName = normalizePlayerName(playerName);
  const normalizedXuid = String(playerXuid || "").trim();
  const storedBans = loadBans();
  const { active, changed } = pruneExpiredBans(storedBans);
  if (changed) {
    saveBans(active);
  }
  const match = active.find((entry) =>
    normalizePlayerName(entry?.nameLower || entry?.name) === normalizedName ||
    (normalizedXuid && String(entry?.xuid || "").trim() === normalizedXuid)
  );
  return { bans: active, match };
}

function kickBannedPlayer(player, banEntry) {
  if (!player || !banEntry) return false;
  const reason = sanitizeModerationReason(banEntry.reason, "Baneado por un administrador.");
  const expiresAt = Number(banEntry.expiresAt || 0);
  const temporaryLabel = expiresAt > Date.now()
    ? `temporalmente hasta ${new Date(expiresAt).toLocaleString("es-ES")}`
    : "permanentemente";
  const escapedName = escapeCommandArg(player.name);
  const escapedReason = escapeCommandArg(reason);

  try {
    world.getDimension("minecraft:overworld").runCommand(`kick "${escapedName}" §cHas sido baneado ${temporaryLabel} del servidor.\n§eMotivo: ${escapedReason}`);
    return true;
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    try {
      world.getDimension(player.dimension?.id || "minecraft:overworld")
        .runCommand(`kick "${escapedName}" §cHas sido baneado ${temporaryLabel} del servidor.\n§eMotivo: ${escapedReason}`);
      return true;
    } catch (err) { ErrorReporter.report(err, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Ban] Error expulsando jugador baneado: " + err);
      return false;
    }
  }
}

function getMuteState(playerName) {
  const normalizedName = normalizePlayerName(playerName);
  try {
    const muteExpiry = globalThis.__sqlite_get_prop_v2__("home_spawn_addon", "world", "mute_" + normalizedName);
    if (typeof muteExpiry !== "number") return null;

    if (Date.now() >= muteExpiry) {
      globalThis.__sqlite_set_prop_v2__("home_spawn_addon", "world", "mute_" + normalizedName, undefined);
      globalThis.__sqlite_set_prop_v2__("home_spawn_addon", "world", "mute_reason_" + normalizedName, undefined);
      return null;
    }

    return {
      expiresAt: muteExpiry,
      reason: String(globalThis.__sqlite_get_prop_v2__("home_spawn_addon", "world", "mute_reason_" + normalizedName) || "No especificado"),
    };
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return null;
  }
}

// Escuchador para expulsar jugadores baneados al entrar
try {
  const playerSpawnEvent = world.afterEvents.playerSpawn;
  if (playerSpawnEvent) {
    playerSpawnEvent.subscribe((event) => {
      const player = event.player;
      if (!player) return;

      system.runTimeout(() => {
        try {
          if (!player || !player.isValid) return;
          
          if (event.initialSpawn) {
            try {
              if (player.hasTag("bounty_target")) player.removeTag("bounty_target");
              if (player.hasTag("bounty_hunter")) player.removeTag("bounty_hunter");
            } catch (e) { /* ignore */ }
          }
          
          const playerNameLower = normalizePlayerName(player.name);
          const playerXuid = String(player.xuid || "").trim();
          const { bans, match } = findActiveBanEntry(player.name, playerXuid);

          if (match && playerXuid && !match.xuid) {
            match.xuid = playerXuid;
            saveBans(bans);
          }

          if (match) {
            kickBannedPlayer(player, match);
            return;
          }

          recordPlayerHistory(player);

          const name = player.name;
          if (!welcomedPlayers.has(name)) {
            welcomedPlayers.add(name);

            try {
              player.runCommand("playsound random.levelup @s");
              player.runCommand("title @s title §b§l¡Bienvenido!");
              player.runCommand("title @s subtitle §7a Pacífico Comunitario");
            } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

            const obj = world.scoreboard.getObjective("money");
            let bal = 0;
            if (obj) {
              try {
                bal = (function(o, p){ try{return o.getScore(p) ?? 0;}catch(e){try{return o.getScore(p.name) ?? 0;}catch(e2){return 0;}} })(obj, player) ?? 0;
              } catch (e) {
                try {
                  bal = obj.getScore(player.name) ?? 0;
                } catch (e2) {
                  bal = 0;
                }
              }
            }

            player.sendMessage("§e==================================");
            player.sendMessage(`§b§l¡Bienvenido a Pacífico Comunitario, §e${name}§b!`);
            player.sendMessage(`§7Tu Dinero actual: §a$${bal}`);
            player.sendMessage("§7Escribe §b/s:guias §7para abrir el tutorial visual interactivo.");
            player.sendMessage("§7Lee y acepta las normas de convivencia con §b/s:reglas§7.");
            player.sendMessage("§e==================================");
          }

          checkServerMenuBook(player);
        } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
      }, 40);
    });
  }
} catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("Error registrando spawn checker de bans: " + e);
}

system.runInterval(() => {
  try {
    for (const player of world.getAllPlayers()) {
      const { bans, match } = findActiveBanEntry(player.name, player.xuid);
      if (!match) continue;

      const playerXuid = String(player.xuid || "").trim();
      if (match && playerXuid && !match.xuid) {
        match.xuid = playerXuid;
        saveBans(bans);
      }

      kickBannedPlayer(player, match);
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn("[Ban] Error en verificación periódica: " + e);
  }
}, 100);

// Limpiar el registro de bienvenida al salir el jugador
try {
  world.afterEvents.playerLeave.subscribe((event) => {
    welcomedPlayers.delete(event.playerName);
  });
} catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

// Interceptación del chat para aplicar mute sin parsear comandos legacy
try {
  const beforeChat = world.beforeEvents ? (world.beforeEvents.chatSend || world.beforeEvents.chat) : undefined;
  const afterChat = world.afterEvents ? (world.afterEvents.chatSend || world.afterEvents.chat) : undefined;
  const chatEvent = beforeChat || afterChat;
  
  if (chatEvent && typeof chatEvent.subscribe === "function") {
    chatEvent.subscribe((event) => {
      const message = String(event.message || "").trim();
      const sender = event.sender;

      // El registro nativo de /s:home no puede cambiar sus parámetros durante
      // un reload de BDS. Esta ruta permite seleccionar las casas extra sin
      // reiniciar: /s:home 1 hasta /s:home 5.
      const extraHomeMatch = message.match(/^\/?s:(home|casa|sethome|guardarcasa|fijarcasa|establecercasa)\s+([1-5])$/i);
      if (extraHomeMatch && sender) {
        if (event.cancel !== undefined) event.cancel = true;
        const isSet = /set|guardar|fijar|establecer/i.test(extraHomeMatch[1]);
        const cmdKey = isSet ? "sethome" : "home";
        const slot = extraHomeMatch[2];
        system.run(async () => {
          await handleCommand(sender, cmdKey, [cmdKey, slot]);
        });
        return;
      }
      
      // --- VERIFICACIÓN DE SILENCIO (MUTE) ---
      try {
        const muteState = getMuteState(sender.name);
        if (muteState) {
          if (event.cancel !== undefined) {
            event.cancel = true;
          }
          const remainingMin = Math.ceil((muteState.expiresAt - Date.now()) / 60000);
          sender.sendMessage(`§b§l[§3Servidor§b§l]§r §cEstás silenciado. Tiempo restante: §e${remainingMin} min§c. Motivo: §e${muteState.reason}`);
          return;
        }
      } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
      
      return;
    });
  }
} catch (error) { ErrorReporter.report(error, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn(`[Home and Spawn Addon] Error registrando chatEvent: ${error}`);
}

// Manejador alternativo de comandos por /scriptevent (siempre disponible, no requiere Beta APIs)
try {
  if (system && system.afterEvents && system.afterEvents.scriptEventReceive && typeof system.afterEvents.scriptEventReceive.subscribe === "function") {
    system.afterEvents.scriptEventReceive.subscribe((event) => {
      if (event.id === RELAY_MODERATION_EVENT_ID) {
        handleRelayModerationEvent(event);
        return;
      }
      if (event.id === "cmd") {
        const message = String(event.message || "").trim().toLowerCase();
        if (message === "menu" || message === "servermenu" || message === "mainmenu") {
          const sender = event.sourceEntity;
          if (sender && sender.typeId === "minecraft:player") {
            system.run(() => openServerMainMenu(sender));
          }
        }
      }
    });
  }
} catch (error) { ErrorReporter.report(error, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn(`[Home and Spawn Addon] Error registrando scriptEvent: ${error}`);
}

async function handleCommand(player, command, args) {
  const isActiveBountyTargetInColiseum = player.hasTag("bounty_target") || player.hasTag("bounty_hunter");

  if (isActiveBountyTargetInColiseum && (command === "home" || command === "spawn" || command === "tpa" || command === "tpaccept" || command === "tumbatp")) {
    player.sendMessage("§b§l[§3Caza§b§l]§r §cNo puedes usar comandos de teletransporte mientras estés activo dentro del coliseo.");
    return;
  }

  // --- COMANDOS DE HOME ---
  if (command === "sethome") {
    const requestedSlot = args?.[1] === undefined ? 1 : Number(args[1]);
    if (!Number.isInteger(requestedSlot) || requestedSlot < 1 || requestedSlot > 5) {
      player.sendMessage("§b§l[§3Base§b§l]§r §cUsa §e/s:sethome 1§c para la principal o §e/s:sethome 2§c hasta §e/s:sethome 5§c para una casa extra.");
      return;
    }

    const loc = player.location;
    const dim = player.dimension.id;

    if (typeof globalThis.isLocationProtectedFromPlayer === "function") {
      if (globalThis.isLocationProtectedFromPlayer(player, loc, dim)) {
        player.sendMessage("§b§l[§3Base§b§l]§r §cNo puedes establecer tu punto de Home dentro del terreno protegido de otro jugador o en el coliseo.");
        return;
      }
    }

    if (requestedSlot === 1) {
      globalThis.__sqlite_set_prop_v2__("home_spawn_addon", player, "home_x", loc.x);
      globalThis.__sqlite_set_prop_v2__("home_spawn_addon", player, "home_y", loc.y);
      globalThis.__sqlite_set_prop_v2__("home_spawn_addon", player, "home_z", loc.z);
      globalThis.__sqlite_set_prop_v2__("home_spawn_addon", player, "home_dimension", dim);
      player.sendMessage("§b§l[§3Base§b§l]§r §a¡Ubicación de Home principal guardada correctamente!");
      return;
    }

    const extraSlot = requestedSlot - 1;
    if (extraSlot > getSharedExtraHomes(player)) {
      player.sendMessage(`§b§l[§3Base§b§l]§r §cNo tienes desbloqueada la Casa Extra #${requestedSlot}.`);
      return;
    }
    if (!setSharedExtraHomeLocation(player, extraSlot, loc, dim)) {
      player.sendMessage("§b§l[§3Base§b§l]§r §cNo se pudo guardar la casa extra. Inténtalo de nuevo.");
      return;
    }
    // Mantiene el menú de mejoras y el almacenamiento compartido sincronizados.
    globalThis.__sqlite_set_prop_v2__("home_spawn_addon", player, `home_x_${extraSlot}`, loc.x);
    globalThis.__sqlite_set_prop_v2__("home_spawn_addon", player, `home_y_${extraSlot}`, loc.y);
    globalThis.__sqlite_set_prop_v2__("home_spawn_addon", player, `home_z_${extraSlot}`, loc.z);
    globalThis.__sqlite_set_prop_v2__("home_spawn_addon", player, `home_dim_${extraSlot}`, dim);
    player.sendMessage(`§b§l[§3Base§b§l]§r §a¡Ubicación para Casa Extra #${requestedSlot} guardada correctamente!`);
    return;
  }
  
  if (command === "home") {
    const requestedSlot = args?.[1] === undefined ? null : Number(args[1]);
    if (requestedSlot !== null) {
      if (!Number.isInteger(requestedSlot) || requestedSlot < 2 || requestedSlot > 5) {
        player.sendMessage("§b§l[§3Base§b§l]§r §cUsa §e/s:home§c para la principal o §e/s:home 2§c hasta §e/s:home 5§c para una casa extra.");
        return;
      }

      const extraSlot = requestedSlot - 1;
      const purchasedSlots = getSharedExtraHomes(player);
      if (extraSlot > purchasedSlots) {
        player.sendMessage(`§b§l[§3Base§b§l]§r §cNo tienes desbloqueada la Casa Extra #${requestedSlot}.`);
        return;
      }

      for (let slot = 1; slot <= extraSlot; slot++) {
        if (!getSharedExtraHomeLocation(player, slot)) {
          player.sendMessage(`§b§l[§3Base§b§l]§r §cGuarda primero las casas extra en orden. Falta la Casa Extra #${slot + 1}.`);
          return;
        }
      }

      const extraHome = getSharedExtraHomeLocation(player, extraSlot);
      startTeleportWarmup(player, `Casa Extra #${requestedSlot}`, () => {
        grantTemporaryTeleportExemption(player);
        player.teleport({ x: extraHome.x, y: extraHome.y, z: extraHome.z }, { dimension: getDimensionSafe(extraHome.dimension) });
        player.sendMessage(`§b§l[§3Base§b§l]§r §aTeletransportado a Casa Extra #${requestedSlot}.`);
      });
      return;
    }

    const x = globalThis.__sqlite_get_prop_v2__("home_spawn_addon", player, "home_x");
    const y = globalThis.__sqlite_get_prop_v2__("home_spawn_addon", player, "home_y");
    const z = globalThis.__sqlite_get_prop_v2__("home_spawn_addon", player, "home_z");
    const dimId = globalThis.__sqlite_get_prop_v2__("home_spawn_addon", player, "home_dimension");
    
    if (x === undefined || y === undefined || z === undefined || dimId === undefined) {
      player.sendMessage("§b§l[§3Base§b§l]§r §cNo tienes un Home configurado. Usa §e/s:sethome §cen la ubicación que desees guardar.");
      return;
    }
    
    startTeleportWarmup(player, "tu Home", () => {
      const dim = getDimensionSafe(dimId);
      grantTemporaryTeleportExemption(player);
      player.teleport({ x, y, z }, { dimension: dim });
      player.sendMessage("§b§l[§3Base§b§l]§r §aTeletransportado a tu Home.");
    });
    return;
  }

  if (command === "delhome") {
    const requestedSlot = args?.[1] === undefined ? 1 : Number(args[1]);
    if (!Number.isInteger(requestedSlot) || requestedSlot < 1 || requestedSlot > 5) {
      player.sendMessage("§b§l[§3Base§b§l]§r §cUsa §e/s:delhome 1§c para la principal o §e/s:delhome 2§c hasta §e/s:delhome 5§c para una casa extra.");
      return;
    }

    if (requestedSlot === 1) {
      const hadHome = globalThis.__sqlite_get_prop_v2__("home_spawn_addon", player, "home_x") !== undefined;
      if (!hadHome) {
        player.sendMessage("§b§l[§3Base§b§l]§r §cNo tienes un Home principal configurado. Usa §e/s:sethome§c para guardar uno.");
        return;
      }
      globalThis.__sqlite_set_prop_v2__("home_spawn_addon", player, "home_x", undefined);
      globalThis.__sqlite_set_prop_v2__("home_spawn_addon", player, "home_y", undefined);
      globalThis.__sqlite_set_prop_v2__("home_spawn_addon", player, "home_z", undefined);
      globalThis.__sqlite_set_prop_v2__("home_spawn_addon", player, "home_dimension", undefined);
      player.sendMessage("§b§l[§3Base§b§l]§r §aTu Home principal fue eliminado correctamente.");
      return;
    }

    const extraSlot = requestedSlot - 1;
    const sharedLocation = getSharedExtraHomeLocation(player, extraSlot);
    const hadBridgeRecord = globalThis.__sqlite_get_prop_v2__("home_spawn_addon", player, `home_x_${extraSlot}`) !== undefined;
    if (!sharedLocation && !hadBridgeRecord) {
      player.sendMessage(`§b§l[§3Base§b§l]§r §cNo tienes guardada la Casa Extra #${requestedSlot}.`);
      return;
    }
    // El almacenamiento compartido usa s=1 como marcador de casa activa; se apaga
    // para que getSharedExtraHomeLocation deje de resolver la casa eliminada.
    try {
      const marker = world.scoreboard.getObjective(`xhome_${extraSlot}_s`);
      if (marker) marker.setScore(player, 0);
    } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "delhome_shared", category: "runtime" }); }
    globalThis.__sqlite_set_prop_v2__("home_spawn_addon", player, `home_x_${extraSlot}`, undefined);
    globalThis.__sqlite_set_prop_v2__("home_spawn_addon", player, `home_y_${extraSlot}`, undefined);
    globalThis.__sqlite_set_prop_v2__("home_spawn_addon", player, `home_z_${extraSlot}`, undefined);
    globalThis.__sqlite_set_prop_v2__("home_spawn_addon", player, `home_dim_${extraSlot}`, undefined);
    player.sendMessage(`§b§l[§3Base§b§l]§r §aLa Casa Extra #${requestedSlot} fue eliminada correctamente.`);
    return;
  }

  // --- COMANDOS DE SPAWN ---
  if (command === "setspawn") {
    const isOp = isPlayerOp(player);
    
    if (!isOp) {
      player.sendMessage("§b§l[§3Spawn§b§l]§r §cSolo los administradores/operadores pueden cambiar el punto de spawn principal.");
      return;
    }
    
    const loc = player.location;
    const dim = player.dimension.id;
    
    globalThis.__sqlite_set_prop_v2__("home_spawn_addon", "world", "spawn_x", loc.x);
    globalThis.__sqlite_set_prop_v2__("home_spawn_addon", "world", "spawn_y", loc.y);
    globalThis.__sqlite_set_prop_v2__("home_spawn_addon", "world", "spawn_z", loc.z);
    globalThis.__sqlite_set_prop_v2__("home_spawn_addon", "world", "spawn_dimension", dim);
    
    player.sendMessage("§b§l[§3Spawn§b§l]§r §a¡Punto de Spawn principal del servidor actualizado!");
    return;
  }
  
  if (command === "spawn") {
    let x = globalThis.__sqlite_get_prop_v2__("home_spawn_addon", "world", "spawn_x");
    let y = globalThis.__sqlite_get_prop_v2__("home_spawn_addon", "world", "spawn_y");
    let z = globalThis.__sqlite_get_prop_v2__("home_spawn_addon", "world", "spawn_z");
    let dimId = globalThis.__sqlite_get_prop_v2__("home_spawn_addon", "world", "spawn_dimension");
    
    // Si no se ha guardado un spawn personalizado, usamos 2 69 1 en el overworld
    if (x === undefined || y === undefined || z === undefined || dimId === undefined) {
      x = 2.0;
      y = 69.0;
      z = 1.0;
      dimId = "minecraft:overworld";
    }
    
    startTeleportWarmup(player, "el Spawn", () => {
      const dim = getDimensionSafe(dimId);
      grantTemporaryTeleportExemption(player);
      player.teleport({ x: x, y: y, z: z }, { dimension: dim });
      player.sendMessage("§b§l[§3Spawn§b§l]§r §aTeletransportado al Spawn principal.");
    });
    return;
  }

  // --- COMANDOS DE TPA ---
  if (command === "tpa") {
    const targetName = args.slice(1).join(" ").trim();
    if (!targetName) {
      player.sendMessage("§b§l[§3TPA§b§l]§r §cUso: /s:tpa <nombre_del_jugador>");
      return;
    }
    
    const players = world.getAllPlayers();
    let target = players.find(p => p.name.toLowerCase() === targetName.toLowerCase());
    
    // Si no encuentra coincidencia exacta, intentamos coincidencia parcial
    if (!target) {
      const matches = players.filter(p => p.name.toLowerCase().includes(targetName.toLowerCase()));
      if (matches.length === 1) {
        target = matches[0];
      } else if (matches.length > 1) {
        player.sendMessage("§b§l[§3TPA§b§l]§r §cSe encontraron múltiples jugadores con nombres similares. Sé más específico.");
        return;
      }
    }
    
    if (!target) {
      player.sendMessage("§b§l[§3TPA§b§l]§r §cJugador no encontrado.");
      return;
    }
    
    if (target.name === player.name) {
      player.sendMessage("§b§l[§3TPA§b§l]§r §cNo puedes enviarte una solicitud de teletransporte a ti mismo.");
      return;
    }
    
    // Guardamos la solicitud
    tpaRequests.set(target.name.toLowerCase(), {
      senderName: player.name,
      timestamp: Date.now()
    });
    
    // Enviamos los mensajes correspondientes
    target.sendMessage(`§b§l[§3TPA§b§l]§r §b${player.name} §7quiere teletransportarse a tu ubicación.\n§7Escribe §a/s:tpaaceptar §7para aceptar o §c/s:tparechazar §7para rechazar. Expira en 60 segundos.`);
    player.sendMessage(`§b§l[§3TPA§b§l]§r §7Solicitud enviada a §b${target.name}§7. Expira en 60 segundos.`);
    return;
  }
  
  if (command === "tpaccept") {
    const playerKey = player.name.toLowerCase();
    const request = tpaRequests.get(playerKey);
    
    if (!request || (Date.now() - request.timestamp > TPA_TIMEOUT_MS)) {
      if (request) {
        tpaRequests.delete(playerKey);
      }
      player.sendMessage("§b§l[§3TPA§b§l]§r §cNo tienes ninguna solicitud de teletransporte pendiente o ya ha expirado.");
      return;
    }
    
    const requester = world.getAllPlayers().find(p => p.name.toLowerCase() === request.senderName.toLowerCase());
    if (!requester) {
      player.sendMessage("§b§l[§3TPA§b§l]§r §cEl jugador que solicitó el teletransporte se ha desconectado.");
      tpaRequests.delete(playerKey);
      return;
    }
    
    startTeleportWarmup(requester, player.name, () => {
      grantTemporaryTeleportExemption(requester);
      requester.teleport(player.location, { dimension: player.dimension });
      requester.sendMessage(`§b§l[§3TPA§b§l]§r §a${player.name} aceptó tu solicitud. Teletransportado.`);
    });
    player.sendMessage(`§b§l[§3TPA§b§l]§r §aHas aceptado la solicitud de ${requester.name}.`);

    tpaRequests.delete(playerKey);
    return;
  }
  
  if (command === "tpdeny") {
    const playerKey = player.name.toLowerCase();
    const request = tpaRequests.get(playerKey);
    
    if (!request || (Date.now() - request.timestamp > TPA_TIMEOUT_MS)) {
      if (request) {
        tpaRequests.delete(playerKey);
      }
      player.sendMessage("§b§l[§3TPA§b§l]§r §cNo tienes ninguna solicitud de teletransporte pendiente o ya ha expirado.");
      return;
    }
    
    const requester = world.getAllPlayers().find(p => p.name.toLowerCase() === request.senderName.toLowerCase());
    if (requester) {
      requester.sendMessage(`§b§l[§3TPA§b§l]§r §c${player.name} rechazó tu solicitud de teletransporte.`);
    }
    
    player.sendMessage("§b§l[§3TPA§b§l]§r §cHas rechazado la solicitud.");
    tpaRequests.delete(playerKey);
    return;
  }

  if (command === "help" || command === "ayuda") {
    player.sendMessage("§e====== §bPacífico Comunitario - Guía de Comandos §e======");
    player.sendMessage("§7Construye, comercia y progresa en comunidad. Consulta §e/s:reglas§7.");
    player.sendMessage("§7Usa §e/s:ayuda§7 o abre el Hub visual con §e/s:menu§7.");
    player.sendMessage("§a1. Viajes y Regreso");
    player.sendMessage("§e/s:guardarcasa [1-5] §7- Guarda tu base actual (/s:sethome).");
    player.sendMessage("§e/s:casa [1-5] §7- Te lleva a tu base guardada (/s:home).");
    player.sendMessage("§e/s:borrarcasa [1-5] §7- Elimina una casa guardada.");
    player.sendMessage("§e/s:aparicion §7- Te teletransporta al spawn central (/s:spawn).");
    player.sendMessage("§e/s:destinos §7- Menú de warps y portales públicos (/s:warps).");
    player.sendMessage("§e/s:pedirtp <jugador> §7- Pide teletransporte a un jugador (/s:tpa).");
    player.sendMessage("§e/s:tpaaceptar / /s:tparechazar §7- Acepta o rechaza solicitudes.");
    player.sendMessage("§e/s:rtp §7- Teletransporte aleatorio a zona salvaje segura (10m cooldown).");
    player.sendMessage("§a2. Economía y Comercio");
    player.sendMessage("§e/s:dinero / /s:saldo §7- Consulta tu saldo de monedas.");
    player.sendMessage("§e/s:pagar <jugador> <monto> §7- Transfiere dinero a otro jugador.");
    player.sendMessage("§e/s:tienda §7- Tienda oficial con precios dinámicos flotantes.");
    player.sendMessage("§e/s:banco §7- Banco General, depósitos, ahorros y préstamos.");
    player.sendMessage("§e/s:subastas §7- Mercado de subastas global con anti-sniper.");
    player.sendMessage("§e/s:vender <precio> §7- Publica el ítem de tu mano en subasta.");
    player.sendMessage("§e/s:comerciar <jugador> §7- Intercambio cara a cara seguro de ítems y dinero.");
    player.sendMessage("§e/s:aceptartrato / /s:rechazartrato §7- Confirma intercambio (cuenta regresiva 3s).");
    player.sendMessage("§a3. Protecciones de Terreno");
    player.sendMessage("§e/s:pos1 / /s:pos2 §7- Marca las esquinas de tu terreno.");
    player.sendMessage("§e/s:proteger <nombre> §7- Registra y protege tu parcela.");
    player.sendMessage("§e/s:desproteger §7- Elimina la protección del terreno actual.");
    player.sendMessage("§e/s:zona bordes §7- Muestra los límites de tu terreno con partículas de esmeralda.");
    player.sendMessage("§e/s:zona banderas §7- Menú para configurar PvP, monstruos, explosiones y puertas.");
    player.sendMessage("§e/s:zona confiar <jugador> §7- Da permisos a un amigo en tu zona.");
    player.sendMessage("§e/s:zona desconfiar <jugador> §7- Retira permisos a un amigo.");
    player.sendMessage("§e/s:zonas §7- Gestor gráfico de todos tus terrenos.");
    player.sendMessage("§a4. Progresión, Trabajos y Rangos");
    player.sendMessage("§e/s:trabajos §7- Elige profesión: pasivas de Leñador, Granjero y Minero + cuotas.");
    player.sendMessage("§e/s:misiones §7- Misiones personales y meta comunitaria con Booster Global.");
    player.sendMessage("§e/s:recompensas §7- Racha de 30 días de login continuo con premios especiales.");
    player.sendMessage("§e/s:rankup / /s:ascender §7- Asciende de rango (Recluta a Leyenda) con tiempo y dinero.");
    player.sendMessage("§e/s:kitinicial §7- Reclama tu kit de bienvenida (una sola vez).");
    player.sendMessage("§e/s:cajas §7- Abre cofres de recompensas con llaves (/s:crates).");
    player.sendMessage("§a5. Clanes y Combate");
    player.sendMessage("§e/s:clan ayuda §7- Lista completa de comandos de clan.");
    player.sendMessage("§e/s:clan crear <nombre> §7- Crea tu clan comunitario (fuego amigo bloqueado).");
    player.sendMessage("§e/s:clan nivel / /s:clan mejorar §7- Mejora el nivel de tu clan (Niveles 1-5).");
    player.sendMessage("§e/s:c <mensaje> §7- Chat privado con los miembros de tu clan.");
    player.sendMessage("§e/s:duelo <jugador> §7- Desafía a un duelo 1v1 voluntario en coliseo.");
    player.sendMessage("§e/s:dueloaceptar / /s:duelorechazar §7- Acepta o rechaza el duelo.");
    player.sendMessage("§e/s:pvp [activar] §7- Consulta o cancela tu inmunidad de 30m de novato.");
    player.sendMessage("§a6. Utilidades y Minijuegos");
    player.sendMessage("§e/s:casino §7- Minijuegos: Cara o Cruz, Blackjack 21, Ruleta y Tragamonedas.");
    player.sendMessage("§e/s:tumba / /s:tumbatp §7- Ubicación y teletransporte a tu tumba.");
    player.sendMessage("§e/s:guias §7- Guías visuales detalladas de todos los sistemas.");
    player.sendMessage("§e/s:reglas §7- Reglamento y normas comunitarias.");
    
    const isOp = isPlayerOp(player);
    if (isOp) {
      player.sendMessage("§a7. Administración");
      player.sendMessage("§e/s:fijaraparicion §7- Define el spawn principal del servidor.");
      player.sendMessage("§e/s:vetar / /s:desvetar / /s:silenciar / /s:congelar §7- Moderación estricta.");
      player.sendMessage("§e/s:limpiar §7- Limpieza manual de suelo y entidades.");
      player.sendMessage("§e/s:iniciarhorda / /s:iniciarfiebre §7- Fuerza eventos automáticos.");
      player.sendMessage("§e/s:fijarcaja / /s:borrarcaja / /s:darllave §7- Administra crates.");
      player.sendMessage("§e/s:maquinatrabajo / /s:trabajosnpc §7- Estaciones de trabajo.");
      player.sendMessage("§e/s:fijardestino <nombre> / /s:borrardestino <nombre> §7- Warps públicos.");
      player.sendMessage("§e/s:adminproteger / /s:admineliminar / /s:admincoliseo §7- Zonas y coliseos.");
    }
    player.sendMessage("§e=================================================");
    return;
  }

  if (command === "guias") {
    // Abre el menú gráfico de guías usando system.runTimeout para evitar bugs de transiciones de chat a UI
    system.runTimeout(() => {
      openGuidesMenu(player);
    }, 5);
    return;
  }

  if (command === "npc") {
    if (args.length < 2) {
      player.sendMessage("§b§l[§3Servidor§b§l]§r §cUso interno: npc <tienda|casino|misiones|warps|guias>");
      return;
    }

    const type = args[1].toLowerCase();
    let nameTag = "";
    switch (type) {
      case "tienda":
        nameTag = "§b§lTienda";
        break;
      case "casino":
        nameTag = "§e§lCasino";
        break;
      case "misiones":
        nameTag = "§a§lMisiones";
        break;
      case "warps":
        nameTag = "§d§lTeletransportador";
        break;
      case "guias":
        nameTag = "§g§lGuías y Ayuda";
        break;
      default:
        player.sendMessage("§b§l[§3Servidor§b§l]§r §cTipo de NPC inválido. Usa: tienda, casino, misiones, warps o guias.");
        return;
    }

    try {
      const loc = player.location;
      // Spawnear un aldeano (villager) silencioso
      const entity = player.dimension.spawnEntity("minecraft:villager", { x: loc.x, y: loc.y, z: loc.z });
      entity.nameTag = nameTag;
      entity.addTag("npc_interactivo");
      player.sendMessage(`§b§l[§3Servidor§b§l]§r §a¡NPC §e${nameTag}§a spawneado con éxito en tu ubicación!`);
    } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      player.sendMessage("§b§l[§3Servidor§b§l]§r §cError al spawnear NPC: " + e.message);
    }
    return;
  }

  if (command === "maquinadupe") {
    if (!DUPE_MACHINE_ENABLED) {
      player.sendMessage("§b§l[§3Servidor§b§l]§r §cEl replicador está deshabilitado por seguridad económica.");
      return;
    }
    try {
      const loc = player.location;
      const entity = player.dimension.spawnEntity("minecraft:npc", { x: loc.x, y: loc.y, z: loc.z });
      entity.nameTag = "§d§lReplicador Decorativo";
      entity.addTag("npc_interactivo");
      entity.addTag("maquina_duplicadora");
      player.sendMessage(`§b§l[§3Servidor§b§l]§r §a¡Replicador Decorativo (NPC) spawneado con éxito!`);
    } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      player.sendMessage("§b§l[§3Servidor§b§l]§r §cError al spawnear la máquina: " + e.message);
    }
    return;
  }

  if (command === "reglas") {
    system.run(() => {
      openRulesMenu(player);
    });
    return;
  }

  if (command === "tumba") {
    try {
      const deathRaw = globalThis.__sqlite_get_prop_v2__("home_spawn_addon", "world", "death_" + player.name.toLowerCase());
      if (!deathRaw) {
        player.sendMessage("§b§l[§3Tumba§b§l]§r §cNo tienes ningún registro de muerte reciente.");
        return;
      }
      
      const deathInfo = globalThis.__sqlite_read_json_v3__(deathRaw);
      const dimNames = {
        "minecraft:overworld": "Overworld (Mundo Normal)",
        "minecraft:nether": "Nether (Inframundo)",
        "minecraft:the_end": "The End"
      };
      const dimName = dimNames[deathInfo.dimension] || deathInfo.dimension;
      
      player.sendMessage("§e====== §3📍 Tu Última Tumba §e======");
      player.sendMessage(`§7Coordenadas: §aX: ${deathInfo.x}§7, §aY: ${deathInfo.y}§7, §aZ: ${deathInfo.z}`);
      player.sendMessage(`§7Dimensión: §e${dimName}`);
      player.sendMessage(`§7Fecha/Hora: §d${new Date(deathInfo.timestamp).toLocaleString("es-ES")}`);
      player.sendMessage("§e==================================");
    } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      player.sendMessage("§b§l[§3Tumba§b§l]§r §cError al consultar tu tumba: " + e.message);
    }
    return;
  }

  if (command === "tumbatp") {
    const result = findOwnedActiveGrave(player);
    if (result.state === "unavailable") {
      player.sendMessage("§b§l[§3Tumba§b§l]§r §eTu tumba está en un chunk no cargado. Acércate a la zona o espera un momento.");
      return;
    }
    if (result.state === "unsafe") {
      player.sendMessage("§b§l[§3Tumba§b§l]§r §eLa tumba existe, pero no tiene un espacio seguro para teletransportarte. Usa /s:tumba para ver sus coordenadas.");
      return;
    }
    if (result.state !== "ready") {
      player.sendMessage("§b§l[§3Tumba§b§l]§r §cNo tienes una tumba activa a la que puedas ir.");
      return;
    }
    startTeleportWarmup(player, "tu tumba", () => {
      // Revalidar al completar el warmup: la tumba pudo expirar o ser reclamada durante la espera.
      const fresh = findOwnedActiveGrave(player);
      if (fresh.state !== "ready") {
        player.sendMessage("§b§l[§3Tumba§b§l]§r §cTu tumba ya no está disponible para teletransporte.");
        return;
      }
      grantTemporaryTeleportExemption(player);
      player.teleport(fresh.destination, { dimension: fresh.dimension });
      player.sendMessage("§b§l[§3Tumba§b§l]§r §aTeletransportado a tu tumba activa.");
    });
    return;
  }

  if (command === "removernpcs") {
    // Leer radio opcional, por defecto 10 bloques
    let radius = 10;
    if (args && args.length > 1) {
      const parsed = parseInt(args[1]);
      if (!isNaN(parsed) && parsed > 0) {
        radius = parsed;
      }
    }

    const loc = player.location;
    let count = 0;
    
    for (const entity of player.dimension.getEntities()) {
      try {
        if (!entity.isValid) continue;
        if (entity.hasTag("npc_interactivo")) {
          const entLoc = entity.location;
          const dx = entLoc.x - loc.x;
          const dy = entLoc.y - loc.y;
          const dz = entLoc.z - loc.z;
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
          
          if (dist <= radius) {
            entity.remove();
            count++;
          }
        }
      } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
    }
    
    player.sendMessage(`§b§l[§3Servidor§b§l]§r §a¡Se han removido ${count} NPCs en un radio de ${radius} bloques!`);
    return;
  }

  if (command === "adminlist") {
    if (!isPlayerOp(player)) {
      player.sendMessage("§b§l[§3AdminList§b§l]§r §cNo tienes permisos para usar /s:adminlist.");
      return;
    }

    const filter = args.length > 1 ? args.slice(1).join(" ").trim() : "";
    sendAdminPlayerHistory(player, filter);
    return;
  }
}

// Auxiliar robusto para abrir formularios evitando conflictos de pantallas (ej. Chat cerrándose)
function safeShowForm(player, form, onSelect, onCancel = undefined, retryCount = 0) {
  form.show(player).then((response) => {
    if (response.canceled) {
      if (response.cancelationReason === "UserBusy" && retryCount < 5) {
        system.runTimeout(() => {
          safeShowForm(player, form, onSelect, onCancel, retryCount + 1);
        }, 5);
      } else if (onCancel) {
        onCancel(response);
      }
      return;
    }
    onSelect(response);
  }).catch((err) => {
    if (retryCount < 5) {
      system.runTimeout(() => {
        safeShowForm(player, form, onSelect, onCancel, retryCount + 1);
      }, 5);
    } else {
      console.warn("Error persistente al abrir formulario: " + err);
    }
  });
}

function openGuidesMenu(player) {
  const form = new ActionFormData()
    .title("📚 Guías de Pacífico Comunitario")
    .body("Selecciona un tema para conocer todas las funciones y comandos esenciales:")
    .button("🏠 Casas y Spawn")
    .button("💰 Economía, Tienda y Precios")
    .button("🛡️ Terrenos, Bordes y Banderas")
    .button("🤝 Comunidad, Clanes y Niveles")
    .button("🎒 Intercambios y Subastas")
    .button("✨ Replicador Decorativo")
    .button("💼 Trabajos, Pasivas y Misiones")
    .button("🏦 Banco, Ahorros y Préstamos")
    .button("🌾 Granjas Comunitarias")
    .button("🧭 Viajes, TPA y Tumbas")
    .button("🏷️ Rangos, Hordas y Casino")
    .button("📜 Seguridad, Inmunidad y Reglas")
    .button("❌ Salir");

  safeShowForm(player, form, (response) => {
    switch (response.selection) {
      case 0:
        openGuideDetail(player, "Casas y Spawn", 
          "§e¿Cómo guardar tu casa?\n" +
          "§7Párate en el lugar donde quieras guardar tu base y escribe:\n" +
          "§a👉 /s:guardarcasa 1 §7(o /s:guardarcasa base)\n" +
          "§7Puedes tener hasta 5 casas guardadas usando §a/s:guardarcasa 2§7 al §a5§7.\n\n" +
          "§e¿Cómo regresar a tu casa?\n" +
          "§7Casa principal: §a/s:casa§7. Otras casas: §a/s:casa 2§7 al §a5§7.\n\n" +
          "§e¿Cómo ir con un compañero?\n" +
          "§71. Pide ir con él escribiendo:\n" +
          "§a👉 /s:pedirtp <Jugador> §7(o /s:tpa)\n" +
          "§72. Tu compañero acepta con §a/s:tpaaceptar§7 o rechaza con §a/s:tparechazar§7.\n\n" +
          "§e¿Cómo regresar al spawn?\n" +
          "§7Para volver al centro seguro del servidor escribe:\n" +
          "§a👉 /s:aparicion §7(o /s:spawn)\n\n" +
          "§e¿Cómo recuperar tus cosas al morir?\n" +
          "§7Al morir se genera una tumba protegida. Escribe:\n" +
          "§a👉 /s:tumbatp\n" +
          "§7Te teletransportará a un bloque seguro junto a tu tumba activa. Consulta coordenadas con §a/s:tumba§7."
        );
        break;
      case 1:
        openGuideDetail(player, "Economía, Tienda y Precios", 
          "§e💸 Dinero y Progreso Económico\n" +
          "§71. Consulta tu saldo actual en cualquier momento con §a/s:dinero§7 o §a/s:saldo§7.\n" +
          "§72. Envía monedas a otro jugador con §a/s:pagar <jugador> <monto>§7.\n\n" +
          "§e🛒 Tienda Oficial (/s:tienda)\n" +
          "§7- Compra bloques, semillas, comida y herramientas directo en el menú.\n" +
          "§7- Vende tus excedentes en el botón §e💰 Vender Materiales§7.\n\n" +
          "§e📈 Sistema de Precios Dinámicos Flotantes\n" +
          "§7¡La economía se autorregula! La venta masiva continua de un producto (granjas AFK excesivas) " +
          "reduce gradualmente el precio de compra del servidor hasta un piso del 60%. " +
          "Con el tiempo y la demanda, el precio se recupera automáticamente. ¡Diversifica tus ingresos!\n\n" +
          "§e⛏️ Menas Naturales\n" +
          "§7Minar menas naturales en el mundo paga monedas directamente a tu bolsillo. Menas colocadas o movidas con pistones no pagan."
        );
        break;
      case 2:
        openGuideDetail(player, "Terrenos, Bordes y Banderas", 
          "§e¿Cómo proteger tu parcela de robos y destrucción?\n" +
          "§71. Párate en una esquina de tu terreno y escribe: §a/s:pos1§7.\n" +
          "§72. Ve a la esquina diagonal opuesta y escribe: §a/s:pos2§7.\n" +
          "§73. Reclama tu zona escribiendo:\n" +
          "§a👉 /s:proteger <NombreDeTuZona>\n" +
          "§7Costo exacto: §a$2,000 + $4 por bloque horizontal§7 (hasta 100x100).\n\n" +
          "§e✨ Bordes de Partículas (/s:zona bordes)\n" +
          "§7Activa o desactiva un perímetro visible de partículas esmeralda durante 60s para inspeccionar tus límites exactos.\n\n" +
          "§e🚩 Banderas de Zona (/s:zona banderas)\n" +
          "§7Configura reglas especiales para tu reclamo:\n" +
          "§7- §aSpawneo de Monstruos§7: Permite o bloquea hostiles.\n" +
          "§7- §aPvP§7: Activa o desactiva combate dentro de tu base.\n" +
          "§7- §aExplosiones§7: Protege contra TNT y creepers.\n" +
          "§7- §aPuertas Visitantes§7: Permite o bloquea el uso de puertas a desconocidos.\n\n" +
          "§e👥 Permisos a Amigos\n" +
          "§7Usa §a/s:zona confiar <amigo>§7 para darle acceso o §a/s:zona desconfiar <amigo>§7 para quitarlo."
        );
        break;
      case 3:
        openGuideDetail(player, "Comunidad, Clanes y Niveles", 
          "§e¿Cómo crear un clan?\n" +
          "§7Crear tu clan es 100% gratuito: escribe §a/s:clan crear <Nombre>§7.\n" +
          "§7Invita compañeros con §a/s:clan invitar <jugador>§7 y ellos se unen con §a/s:clan unirse <clan>§7.\n\n" +
          "§e🏰 Niveles de Clan (/s:clan nivel y /s:clan mejorar)\n" +
          "§7¡Sube el nivel de tu clan del 1 al 5 usando fondos del banco del clan!\n" +
          "§7- Nivel 1: Capacidad base (8 miembros)\n" +
          "§7- Nivel 2: $10,000 banco -> 12 miembros\n" +
          "§7- Nivel 3: $25,000 banco -> 16 miembros\n" +
          "§7- Nivel 4: $50,000 banco -> 20 miembros\n" +
          "§7- Nivel 5: $100,000 banco -> 24 miembros\n\n" +
          "§e🛡️ Fuego Amigo Bloqueado\n" +
          "§7Los clanes son estrictamente cooperativos: es imposible dañarse entre miembros de clan.\n\n" +
          "§e💬 Chat de Clan y Banco\n" +
          "§7- Escribe §a/s:c <mensaje>§7 para hablar en secreto con tu clan.\n" +
          "§7- Deposita dinero con §a/s:clan depositar <monto>§7 para financiar mejoras comunitarias."
        );
        break;
      case 4:
        openGuideDetail(player, "Intercambios y Subastas", 
          "§e🤝 Comercio Seguro Mixto Cara a Cara\n" +
          "§71. Acércate al jugador y escribe:\n" +
          "§a👉 /s:comerciar <Jugador> §7(o /s:trade)\n" +
          "§72. El otro jugador acepta con §a/s:aceptartrato§7.\n" +
          "§73. Se abrirá la interfaz segura donde pueden ofertar **Ítems + Monedas al mismo tiempo**.\n" +
          "§74. Al aceptar ambos, se ejecuta una §ecuenta regresiva de 3 segundos§7 con sonidos para evitar cambios tramposos a último segundo.\n\n" +
          "§e🎒 Mercado Global de Subastas (/s:subastas)\n" +
          "§7- Sostén un ítem en tu mano y escribe §a/s:vender <precio>§7 para publicarlo.\n" +
          "§7- Consulta y compra artículos de otros jugadores con §a/s:subastas§7.\n" +
          "§7- §aAnti-Sniper§7: Cualquier interacción con una subasta a menos de 60s agrega 1 minuto adicional."
        );
        break;
      case 5:
        openGuideDetail(player, "Replicador Decorativo",
          "§e✨ ¿Qué es el Replicador Decorativo?\n" +
          "§7Una máquina comunitaria para duplicar decoraciones (cuadros, macetas, soportes de armaduras y estandartes simples) para constructores.\n\n" +
          "§e¿Cómo usarlo?\n" +
          "§71. Sostén en tu mano principal la decoración permitida.\n" +
          "§72. Haz clic derecho sobre el bloque/NPC Replicador.\n" +
          "§73. Selecciona la cantidad (máximo 64 por día).\n" +
          "§74. Paga §a$250 monedas§7 por unidad replicada.\n\n" +
          "§8Los ítems replicados tienen marca estética y no son monetizables."
        );
        break;
      case 6:
        openGuideDetail(player, "Trabajos, Pasivas y Misiones",
          "§e💼 Trabajos y Habilidades Pasivas (/s:trabajos)\n" +
          "§7Elige una profesión y recibe dinero mientras juegas más ventajas únicas en el mundo:\n" +
          "§7- 🪓 §aLeñador§7: Pasiva Treecapitator (tala árboles de un solo golpe hasta 16 bloques verticales).\n" +
          "§7- 🌾 §aGranjero§7: Auto-replantado automático al cosechar cultivos maduros si tienes semillas en el inventario.\n" +
          "§7- ⛏️ §aMinero§7: 25% de probabilidad de duplicar menas naturales valiosas al picar.\n" +
          "§7- 📦 §aCuotas Diarias§7: Completa 3 entregas de trabajo al día para recibir un bono de **$1,000 extra**.\n\n" +
          "§e📜 Misiones y Meta Comunitaria (/s:misiones)\n" +
          "§7Completa desafíos individuales para obtener recompensas monetarias. ¡Entre todos los jugadores, alcanzar 30 misiones globales activa un **Booster Global de Trabajos** (+50% de ganancia) para todo el servidor durante 30 minutos!\n\n" +
          "§e🎁 Racha de 30 Días (/s:recompensas)\n" +
          "§7Conéctate a diario para reclamar recompensas progresivas. Si no entras en 48h, la racha se reinicia. ¡Premios especiales en días 7, 14, 21 y el Jackpot de $50,000 + Netherite + llaves en el día 30!"
        );
        break;
      case 7:
        openGuideDetail(player, "Banco, Ahorros y Préstamos",
          "§e🏦 Banco General (/s:banco)\n" +
          "§7Tu cuenta bancaria segura:\n" +
          "§7- Deposita y retira dinero para mantenerlo a salvo.\n" +
          "§7- Genera intereses pasivos sobre tu saldo de ahorro.\n" +
          "§7- Realiza transferencias rápidas mediante CBU/Alias.\n\n" +
          "§e💳 Préstamos Bancarios\n" +
          "§7Solicita créditos según tu nivel económico. El banco deduce automáticamente un porcentaje de tus cobros futuros hasta saldar la deuda."
        );
        break;
      case 8:
        openGuideDetail(player, "Granjas Comunitarias",
          "§e🌾 ¿Cómo funcionan?\n" +
          "§7Instalaciones públicas para recolectar cultivos, madera y recursos rápidamente para vender en §a/s:tienda§7.\n\n" +
          "§e🎟️ Accesos de Pago\n" +
          "§7Algunas granjas tienen un botón de entrada pagada por tiempo. Presionas, pagas la sesión y accedes a recolectar durante el lapso indicado.\n\n" +
          "§e🔒 Seguridad\n" +
          "§7Cofres técnicos, tolvas y dispensadores están sellados contra saqueo. Solo recolecta el producto terminado y respeta las máquinas."
        );
        break;
      case 9:
        openGuideDetail(player, "Viajes, TPA y Tumbas",
          "§e🧭 Moverse por el Mundo\n" +
          "§7- §a/s:aparicion§7: Regresa al spawn del servidor.\n" +
          "§7- §a/s:destinos§7: Abre la lista de portales y puntos de interés públicos.\n" +
          "§7- §a/s:rtp§7: Teletransporte aleatorio a una zona salvaje segura (cooldown de 10 minutos).\n\n" +
          "§e👤 Teletransporte con Amigos\n" +
          "§7- Enviar solicitud: §a/s:pedirtp <jugador>§7 (o /s:tpa).\n" +
          "§7- Aceptar solicitud: §a/s:tpaaceptar§7.\n" +
          "§7- Rechazar solicitud: §a/s:tparechazar§7.\n\n" +
          "§e⚰️ Sistema de Tumbas\n" +
          "§7- Consulta la ubicación de tu muerte con §a/s:tumba§7.\n" +
          "§7- Viaja de regreso directamente a tu tumba activa con §a/s:tumbatp§7."
        );
        break;
      case 10:
        openGuideDetail(player, "Rangos, Hordas y Casino",
          "§e👑 Rangos de Supervivencia (/s:rankup o /s:rango)\n" +
          "§7Asciende en el escalafón de supervivencia con tiempo de juego y saldo acumulado:\n" +
          "§7- 🔰 §aRecluta§7: Rango inicial gratuito.\n" +
          "§7- 🏹 §aExplorador§7: $5,000 + 2h jugadas.\n" +
          "§7- 🛡️ §aVeterano§7: $25,000 + 10h jugadas.\n" +
          "§7- ⚔️ §aHéroe§7: $75,000 + 24h jugadas.\n" +
          "§7- 👑 §aLeyenda§7: $200,000 + 50h jugadas.\n" +
          "§7¡Muestra tu prefijo exclusivo en el chat de juego!\n\n" +
          "§e🧟 Evento de Horda Adaptativa (/s:iniciarhorda)\n" +
          "§7Oleadas de monstruos cuya dificultad escala (+12%) con la cantidad de jugadores conectados. Incluye mini-jefes: Titán Zombi (Ola 3) y Señor del Apocalipsis (Ola 5). Los 3 mejores cazadores reciben premios monetarios y botín especial.\n\n" +
          "§e🎰 Casino (/s:casino)\n" +
          "§7Minijuegos de apuestas con economía integrada:\n" +
          "§7- 🪙 §aCara o Cruz§7: Probabilidades justas del 50% con duplicación de apuesta (2x).\n" +
          "§7- 🃏 §aBlackjack 21§7: Juega contra la casa. Blackjack natural paga 2.5x.\n" +
          "§7- 🎡 §aRuleta y Tragamonedas§7: Juegos clásicos de multiplicadores."
        );
        break;
      case 11:
        openGuideDetail(player, "Seguridad, Inmunidad y Reglas",
          "§e🛡️ Inmunidad para Nuevos Jugadores (/s:pvp)\n" +
          "§7Al unirte al servidor recibes 30 minutos de inmunidad PvP para construir tu base sin riesgo. Usa §a/s:pvp§7 para ver tu tiempo o §a/s:pvp activar§7 si deseas entrar al combate antes.\n\n" +
          "§e📜 Normas de Convivencia (/s:reglas)\n" +
          "§7- Prohibido el robo en zonas protegidas o el aprovechamiento de errores.\n" +
          "§7- Prohibido el uso de clientes modificados, hacks o trampas de duplicación.\n" +
          "§7- Respeta a los miembros de la comunidad en el chat.\n\n" +
          "§e⚖️ Anticheat y Moderación\n" +
          "§7El servidor cuenta con detección automática de trampas. Sospechas mayores al 80% alertan al Staff y activan congelamiento estricto (/s:congelar)."
        );
        break;
      default:
        break;
    }
  });
}
function openGuideDetail(player, title, content) {
  const form = new ActionFormData()
    .title(`§d§lGuía: ${title}`)
    .body(content)
    .button("🔙 Volver al Menú Principal")
    .button("❌ Cerrar");

  safeShowForm(player, form, (response) => {
    if (response.selection === 0) {
      openGuidesMenu(player);
    }
  });
}

// Bucle periódico para recordar el comando /s:help (Inicia con 5 minutos de desfase para no chocar)
system.runTimeout(() => {
  system.runInterval(() => {
    try {
      world.sendMessage("§b§l[§3Comunidad§b§l]§r §eUsa §b/s:help §epara consultar los servicios y §b/s:reglas §epara recordar las normas de convivencia.");
    } catch (err) { ErrorReporter.report(err, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      // Silenciar
    }
  }, 36000);
}, 6000);

// --- SISTEMA DE NPCs INTERACTIVOS PARA MENÚS ---

// 1. Intercepción del clic derecho sobre el NPC
try {
  world.afterEvents.playerInteractWithEntity.subscribe((event) => {
    const player = event.player;
    const target = event.target;
    if (!player || !target) return;

    if (target.hasTag("npc_interactivo")) {
      const nameTag = target.nameTag || "";
      
      system.run(() => {
        try {
          if (nameTag.includes("Tienda")) {
            player.runCommand("scriptevent ! shop");
          } else if (nameTag.includes("Casino")) {
            player.runCommand("scriptevent ! casino");
          } else if (nameTag.includes("Misiones")) {
            player.runCommand("scriptevent ! misiones");
          } else if (nameTag.includes("Teletransportador")) {
            player.runCommand("scriptevent ! warps");
          } else if (nameTag.includes("Guías")) {
            openGuidesMenu(player);
          } else if (nameTag.includes("Máquina Duplicadora") || nameTag.includes("Replicador Decorativo")) {
            openDupeMachineGUI(player, target);
          }
        } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
          console.warn(`[NPCs] Error ejecutando acción para ${nameTag}: ${e}\n${e.stack || ""}`);
        }
      });
    }
  });
} catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[NPCs] Error al registrar interact event: " + e);
}

// 2. Proteger NPCs contra cualquier daño (Invulnerabilidad)
try {
  world.beforeEvents.entityHurt.subscribe((event) => {
    const entity = event.hurtEntity;
    if (entity && entity.hasTag("npc_interactivo")) {
      event.cancel = true;
    }
  });
} catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[NPCs] Error al registrar hurt event: " + e);
}

// 3. Congelar y Anclar NPCs (Evitar que caminen, salten o sean empujados)
const npcAnchorCache = new Map();
system.runInterval(() => {
  if (world.getAllPlayers().length === 0) return;
  const dimensions = ["overworld", "nether", "the_end"];
  for (const dimId of dimensions) {
    try {
      const dim = world.getDimension(dimId);
      for (const entity of dim.getEntities({ tags: ["npc_interactivo"] })) {
        try {
          if (!entity.isValid) continue;

          const cacheKey = entity.id;
          let cachedSpawn = npcAnchorCache.get(cacheKey);
          const now = Date.now();

          if (!cachedSpawn || (now - (cachedSpawn.lastEffectAt || 0)) >= 4000) {
            entity.addEffect("slowness", 120, { amplifier: 255, showParticles: false });
            entity.addEffect("weakness", 120, { amplifier: 255, showParticles: false });
            cachedSpawn = { ...(cachedSpawn || {}), lastEffectAt: now };
          }

          // Anclar a su posición de origen para evitar empujones físicos
          let spawnLoc = cachedSpawn?.spawnLoc;
          if (!spawnLoc) {
            const spawnLocRaw = globalThis.__sqlite_get_prop_v2__("home_spawn_addon", entity, "spawn_loc");
            if (spawnLocRaw) {
              spawnLoc = globalThis.__sqlite_read_json_v3__(spawnLocRaw);
            }
          }

          if (spawnLoc) {
            const currentLoc = entity.location;
            const dist = Math.hypot(currentLoc.x - spawnLoc.x, currentLoc.y - spawnLoc.y, currentLoc.z - spawnLoc.z);
            if (dist > 0.02) {
              entity.teleport({ x: spawnLoc.x, y: spawnLoc.y, z: spawnLoc.z }, { dimension: dim });
            }
          } else {
            const currentLoc = entity.location;
            spawnLoc = { x: currentLoc.x, y: currentLoc.y, z: currentLoc.z };
            globalThis.__sqlite_set_prop_v2__("home_spawn_addon", entity, "spawn_loc", JSON.stringify(spawnLoc));
          }

          npcAnchorCache.set(cacheKey, {
            spawnLoc,
            lastEffectAt: cachedSpawn?.lastEffectAt || now
          });
        } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
      }
    } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }
}, 100); // Los efectos duran 6 segundos; un barrido cada 5 segundos es suficiente.

// --- REPLICADOR DECORATIVO ---

function openDupeMachineGUI(player, target) {
  if (!DUPE_MACHINE_ENABLED) {
    player.sendMessage("§b§l[§3Replicador§b§l]§r §cEl replicador fue deshabilitado para proteger la economía.");
    return;
  }
  const playerEquip = player.getComponent("minecraft:equippable");
  const equippedItem = playerEquip?.getEquipment(EquipmentSlot.Mainhand);

  if (!equippedItem) {
    const form = new ActionFormData()
      .title("§d§lReplicador Decorativo")
      .body("§cNo tienes ningún objeto en tu mano principal.\n\n§7Sostén una decoración permitida antes de usar la máquina.")
      .button("❌ Cerrar");
    form.show(player).catch(() => {});
    return;
  }

  if (isForbiddenDupeItem(equippedItem)) {
    const form = new ActionFormData()
      .title("§d§lReplicador Decorativo")
      .body("§cEste objeto no se puede replicar.\n\n§7Solo se admiten decoraciones simples sin nombre, lore, encantamientos, propiedades, contenido ni metadata personalizada.")
      .button("❌ Cerrar");
    form.show(player).catch(() => {});
    return;
  }

  const sessionKey = String(player.id || player.name).toLowerCase();
  if (activeDupeSessions.has(sessionKey)) {
    player.sendMessage("§b§l[§3Replicador§b§l]§r §cYa tienes una sesión de replicación abierta.");
    return;
  }
  activeDupeSessions.add(sessionKey);

  const openingFingerprint = getDupeItemFingerprint(equippedItem, true);
  const openingQuota = getDupeQuota(player);
  const openingRemaining = Math.max(0, DUPE_DAILY_COPY_LIMIT - openingQuota.used);
  if (!openingFingerprint || openingRemaining <= 0) {
    activeDupeSessions.delete(sessionKey);
    player.sendMessage("§b§l[§3Replicador§b§l]§r §cHas agotado el límite diario de réplicas.");
    return;
  }

  const form = new ModalFormData()
    .title("§d§lReplicador Decorativo")
    .slider(
      `§7Tu Saldo: §6$${readMoneyBalance(player)} monedas§r\n` +
      `§7Objeto: §e${equippedItem.typeId.split(":")[1] || equippedItem.typeId}§r\n` +
      `§7Tarifa: §a$${DUPE_COST_PER_ITEM} monedas por unidad§r\n` +
      `§7Disponibles hoy: §e${openingRemaining}§r\n\n` +
      `§8Las réplicas quedan marcadas y no tienen valor económico.\n\n` +
      `§7Selecciona la cantidad:`,
      1, openingRemaining
    );

  form.show(player).then((response) => {
    if (response.canceled) {
      activeDupeSessions.delete(sessionKey);
      return;
    }
    let quotaBeforeTransaction;
    let chargedAmount = 0;
    let deliveredCopies = 0;
    let economicCommitted = false;
    try {
      const requestedCopies = Math.floor(Number(response.formValues[0]));
      const quotaBefore = getDupeQuota(player);
      quotaBeforeTransaction = quotaBefore;
      const dailyRemaining = Math.max(0, DUPE_DAILY_COPY_LIMIT - quotaBefore.used);
      if (!Number.isInteger(requestedCopies) || requestedCopies < 1 || requestedCopies > dailyRemaining) {
        player.sendMessage("§b§l[§3Replicador§b§l]§r §cCantidad inválida o cuota diaria agotada.");
        return;
      }

      const currentItem = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
      if (isForbiddenDupeItem(currentItem) || getDupeItemFingerprint(currentItem, true) !== openingFingerprint) {
        player.sendMessage("§b§l[§3Replicador§b§l]§r §cEl objeto o su metadata cambió. Operación cancelada.");
        return;
      }

      const inventory = player.getComponent("minecraft:inventory")?.container;
      if (!inventory) return;
      const replicaTemplate = createDecorativeReplica(currentItem, 1);
      const availableCapacity = estimateInsertCapacity(inventory, replicaTemplate);
      if (availableCapacity < requestedCopies) {
        player.sendMessage(`§b§l[§3Replicador§b§l]§r §cNo tienes espacio para §e${requestedCopies}§c réplicas. §7Capacidad disponible: §e${availableCapacity}§7.`);
        return;
      }

      const totalCost = requestedCopies * DUPE_COST_PER_ITEM;
      if (readMoneyBalance(player) < totalCost) {
        player.sendMessage(`§b§l[§3Replicador§b§l]§r §cSaldo insuficiente. Se necesitan $${totalCost} monedas.`);
        return;
      }

      const quotaReserved = { day: quotaBefore.day, used: quotaBefore.used + requestedCopies };
      if (!saveDupeQuota(player, quotaReserved)) {
        player.sendMessage("§b§l[§3Replicador§b§l]§r §cNo se pudo reservar la cuota. Operación cancelada.");
        return;
      }
      if (!changeMoneyBalance(player, -totalCost)) {
        saveDupeQuota(player, quotaBefore);
        player.sendMessage("§b§l[§3Replicador§b§l]§r §cNo se pudo confirmar el débito. Operación cancelada.");
        return;
      }
      chargedAmount = totalCost;

      const maxStack = Math.max(1, replicaTemplate.maxAmount || 1);
      let remaining = requestedCopies;
      while (remaining > 0) {
        const batchSize = maxStack === 1 ? 1 : Math.min(remaining, maxStack);
        const replica = createDecorativeReplica(currentItem, batchSize);
        const leftover = inventory.addItem(replica);
        const inserted = leftover ? Math.max(0, batchSize - (leftover.amount || 0)) : batchSize;
        if (inserted <= 0) break;
        deliveredCopies += inserted;
        remaining -= inserted;
        if (leftover && (leftover.amount || 0) > 0) break;
      }

      if (deliveredCopies < requestedCopies) {
        const missingCopies = requestedCopies - deliveredCopies;
        const refund = missingCopies * DUPE_COST_PER_ITEM;
        saveDupeQuota(player, { day: quotaBefore.day, used: quotaBefore.used + deliveredCopies });
        if (!changeMoneyBalance(player, refund)) {
          console.warn(`[ECONOMY_CRITICAL] No se pudo reembolsar $${refund} a ${player.name} por réplicas no entregadas.`);
        } else {
          chargedAmount -= refund;
        }
      }

      if (deliveredCopies <= 0) {
        player.sendMessage("§b§l[§3Replicador§b§l]§r §cNo se entregaron réplicas. El importe fue revertido.");
        return;
      }

      economicCommitted = true;
      player.sendMessage(`§b§l[§3Replicador§b§l]§r §aSe entregaron §e${deliveredCopies}§a réplicas decorativas por §e$${deliveredCopies * DUPE_COST_PER_ITEM}§a.`);
      console.warn(`[ECONOMY_LOG] [DECORATIVE_REPLICA] Player ${player.name} created ${deliveredCopies}x ${currentItem.typeId} for $${deliveredCopies * DUPE_COST_PER_ITEM}`);
      try {
        player.runCommand("playsound block.respawn_anchor.charge @s");
        player.dimension.spawnParticle("minecraft:colored_flame_particle", player.location);
        player.dimension.spawnParticle("minecraft:conduit_particle", { x: player.location.x, y: player.location.y + 1, z: player.location.z });
      } catch (effectError) { /* efectos visuales no afectan la transaccion */ }
    } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      if (!economicCommitted && quotaBeforeTransaction) {
        const payableAmount = deliveredCopies * DUPE_COST_PER_ITEM;
        const refund = Math.max(0, chargedAmount - payableAmount);
        saveDupeQuota(player, { day: quotaBeforeTransaction.day, used: quotaBeforeTransaction.used + deliveredCopies });
        if (refund > 0 && !changeMoneyBalance(player, refund)) {
          console.warn(`[ECONOMY_CRITICAL] No se pudo reembolsar $${refund} a ${player.name} tras fallo del replicador.`);
        }
      }
      player.sendMessage("§b§l[§3Replicador§b§l]§r §cLa operación falló y fue registrada para revisión.");
    } finally {
      activeDupeSessions.delete(sessionKey);
    }
  }).catch((e) => {
    activeDupeSessions.delete(sessionKey);
    try {
      player.sendMessage("§b§l[§3Replicador§b§l]§r §cNo se pudo abrir la interfaz.");
    } catch (dbgErr) { ErrorReporter.report(dbgErr, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  });
}

try {
  world.afterEvents.entityRemove.subscribe((event) => {
    try {
      npcAnchorCache.delete(event.removedEntityId);
    } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  });
} catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

// 4. Bucle recurrente para animar la órbita de partículas de la máquina duplicadora
system.runInterval(() => {
  try {
    if (world.getAllPlayers().length === 0) return;
    for (const entity of world.getDimension("overworld").getEntities({ tags: ["maquina_duplicadora"] })) {
      try {
        const playersNearby = entity.dimension.getPlayers({
          location: entity.location,
          maxDistance: 24
        });
        if (!playersNearby.length) continue;

        const loc = entity.location;
        const time = Date.now();
        // Trayectoria espiral ascendente en coordenadas tridimensionales
        const angle = time / 250;
        const xOffset = Math.sin(angle) * 0.7;
        const zOffset = Math.cos(angle) * 0.7;
        const yOffset = 1.0 + Math.sin(time / 500) * 0.4;
        
        entity.dimension.spawnParticle("minecraft:basic_portal_particle", { 
          x: loc.x + xOffset, 
          y: loc.y + yOffset, 
          z: loc.z + zOffset 
        });
      } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
}, 20);

// --- BRÚJULA DEL MENÚ COMUNITARIO ---

const MENU_COMPASS_NAME = "§6§l🧭 Menú Comunitario §r§7(Clic Derecho)";
const MENU_COMPASS_LORE = [
  "§7Servicios, guías y reglas",
  "§7de Pacífico Comunitario.",
  "",
  "§cNo se pierde al morir"
];

function checkServerMenuBook(player) {
  const inventory = player.getComponent("minecraft:inventory")?.container;
  if (!inventory) return;

  let hasBook = false;
  for (let i = 0; i < inventory.size; i++) {
    const item = inventory.getItem(i);
    if (item && item.nameTag && (item.nameTag.includes("Menú del Servidor") || item.nameTag.includes("Menú Comunitario"))) {
      if (item.typeId !== "minecraft:compass") {
        // Eliminar versiones antiguas (libros) para migrar a la brújula
        inventory.setItem(i, undefined);
      } else {
        // Dirty-flag: sólo reescribir el ítem si su nombre o lore difieren del
        // canon. Reescribirlo en cada ciclo enviaba paquetes visuales sin cambios.
        const lore = item.getLore?.() ?? [];
        const upToDate = item.nameTag === MENU_COMPASS_NAME &&
          lore.length === MENU_COMPASS_LORE.length &&
          lore.every((line, index) => line === MENU_COMPASS_LORE[index]);
        if (!upToDate) {
          item.nameTag = MENU_COMPASS_NAME;
          item.setLore([...MENU_COMPASS_LORE]);
          inventory.setItem(i, item);
        }
        hasBook = true;
      }
    }
  }

  if (!hasBook) {
    try {
      const book = new ItemStack("minecraft:compass", 1);
      book.nameTag = MENU_COMPASS_NAME;
      book.setLore([...MENU_COMPASS_LORE]);
      
      const enchantable = book.getComponent("minecraft:enchantable");
      if (enchantable) {
        const enchantType = EnchantmentTypes.get("unbreaking");
        if (enchantType) {
          try {
            enchantable.addEnchantment({ type: enchantType, level: 1 });
          } catch (e) {} // API 2.8.0 lanza error si el item (brújula) no admite Unbreaking
        }
      }

      inventory.addItem(book);
    } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("Error al entregar libro del menú: " + e);
    }
  }
}

// Bucle periódico para asegurar que todos los jugadores tengan el libro del menú
system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      if (player.isValid) {
        checkServerMenuBook(player);
      }
    } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }
}, 100); // Se verifica cada 5 segundos (100 ticks) en lugar de cada 30 segundos (600 ticks) para mayor rapidez

// Prevenir que los jugadores tiren la brújula del Menú Comunitario
try {
  const itemDropEvent = world.beforeEvents.itemDrop;
  if (itemDropEvent && typeof itemDropEvent.subscribe === "function") {
    itemDropEvent.subscribe((event) => {
      const item = event.itemStack;
      if (item && item.nameTag && (item.nameTag.includes("Menú del Servidor") || item.nameTag.includes("Menú Comunitario"))) {
        event.cancel = true;
        system.run(() => {
          if (event.source && event.source.isValid) {
            event.source.sendMessage("§cNo puedes tirar la brújula del Menú Comunitario. ¡La necesitas para jugar!");
          }
        });
      }
    });
  }
} catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Menu] Error al registrar itemDrop prevention: " + e);
}

// Escuchar uso del item (Clic Derecho con el Libro)
try {
  world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    if (player && item && item.nameTag && (item.nameTag.includes("Menú del Servidor") || item.nameTag.includes("Menú Comunitario"))) {
      system.run(() => {
        if (player.isValid) {
          openServerMainMenu(player);
        }
      });
    }
  });
} catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Menu] Error al registrar itemUse: " + e);
}

// Ventanas del Menú Comunitario
function openServerMainMenu(player) {
  try { globalThis.openServerMainMenu = openServerMainMenu; } catch (e) {}
  const form = new ActionFormData()
    .title("§6§l🧭 Menú Comunitario")
    .body("§7Pacífico es una comunidad para construir, comerciar, competir y cooperar con respeto. Selecciona un servicio:")
    .button("🏠 Spawn y Casas")
    .button("💰 Tienda del Juego")
    .button("🎒 Subastas (AH)")
    .button("🛡️ Mis Terrenos")
    .button("🏦 Banco General")
    .button("⚔️ Clanes")
    .button("🤝 Intercambios")
    .button("💼 Trabajos")
    .button("📜 Misiones")
    .button("🎁 Recompensas")
    .button("🏷️ Rangos y Títulos")
    .button("⚡ Potenciadores y Mejoras")
    .button("🎰 Casino del Juego")
    .button("📖 Guías de Ayuda")
    .button("📋 Reglas Comunitarias")
    .button("⌨️ Menú de Comandos")
    .button("❌ Cerrar");

  form.show(player).then((response) => {
    if (response.canceled) return;
    switch (response.selection) {
      case 0: // Casas y Spawn
        openSpawnSubMenu(player);
        break;
      case 1: // Tienda
        if (typeof globalThis.openShopMainMenu === "function") {
          globalThis.openShopMainMenu(player);
        } else {
          runMenuCommand(player, "s:shop", "scriptevent ! shop");
        }
        break;
      case 2: // Subastas
        if (typeof globalThis.openSubastasMenu === "function") {
          globalThis.openSubastasMenu(player);
        } else {
          runMenuCommand(player, "s:subastas", "scriptevent cmd:subastas");
        }
        break;
      case 3: // Terrenos
        runMenuCommand(player, "s:zonas");
        break;
      case 4: // Banco General
        runMenuCommand(player, "s:banco", "scriptevent cmd banco");
        break;
      case 5: // Clanes
        openCommandsClansMenu(player);
        break;
      case 6: // Trade
        openTradeSelectPlayerMenu(player);
        break;
      case 7: // Trabajos
        runMenuCommand(player, "s:trabajos");
        break;
      case 8: // Misiones
        runMenuCommand(player, "s:misiones");
        break;
      case 9: // Recompensas
        runMenuCommand(player, "s:recompensas");
        break;
      case 10: // Rangos y títulos
        runMenuCommand(player, "s:titulos");
        break;
      case 11: // Potenciadores y Mejoras
        openBoostersFromMenu(player);
        break;
      case 12: // Casino con moneda del juego
        runMenuCommand(player, "s:casino");
        break;
      case 13: // Guías
        openGuidesMenu(player);
        break;
      case 14: // Reglas
        openRulesMenu(player);
        break;
      case 15: // Menú de Comandos
        openCommandsMenu(player);
        break;
      default:
        break;
    }
  }).catch(() => {});
}

function openCommandsMenu(player) {
  const form = new ActionFormData()
    .title("⌨️ Menú de Comandos")
    .body("§7Panel de comandos interactivo. Selecciona una categoría para realizar acciones sin necesidad de escribir comandos en el chat:")
    .button("🏠 Casas y Teletransporte")
    .button("💰 Dinero y Economía")
    .button("🛡️ Protecciones de Terreno")
    .button("⚔️ Clanes Comunitarios")
    .button("🤝 Comercio e Intercambio")
    .button("💼 Trabajos y Misiones")
    .button("⚔️ Duelos de Coliseo")
    .button("🎁 Recompensas y Kits")
    .button("⚡ Potenciadores y Mejoras")
    .button("🔍 Utilidades y Auditoría");

  const showAdmin = isPlayerOp(player);
  if (showAdmin) {
    form.button("🛠️ Administración");
  }
  form.button("🔙 Volver al Menú Principal");

  form.show(player).then((response) => {
    if (response.canceled) return;
    const selection = response.selection;
    if (showAdmin) {
      switch (selection) {
        case 0: openCommandsHomeMenu(player); break;
        case 1: openCommandsMoneyMenu(player); break;
        case 2: openCommandsProtectionMenu(player); break;
        case 3: openCommandsClansMenu(player); break;
        case 4: openCommandsTradeMenu(player); break;
        case 5: openCommandsJobsQuestsMenu(player); break;
        case 6: openCommandsColiseumMenu(player); break;
        case 7: openCommandsRewardsMenu(player); break;
        case 8: openBoostersFromMenu(player); break;
        case 9: openCommandsUtilsMenu(player); break;
        case 10: openCommandsAdminMenu(player); break;
        case 11: openServerMainMenu(player); break;
      }
    } else {
      switch (selection) {
        case 0: openCommandsHomeMenu(player); break;
        case 1: openCommandsMoneyMenu(player); break;
        case 2: openCommandsProtectionMenu(player); break;
        case 3: openCommandsClansMenu(player); break;
        case 4: openCommandsTradeMenu(player); break;
        case 5: openCommandsJobsQuestsMenu(player); break;
        case 6: openCommandsColiseumMenu(player); break;
        case 7: openCommandsRewardsMenu(player); break;
        case 8: openBoostersFromMenu(player); break;
        case 9: openCommandsUtilsMenu(player); break;
        case 10: openServerMainMenu(player); break;
      }
    }
  }).catch(() => {});
}

function openCommandsColiseumMenu(player) {
  const form = new ActionFormData()
    .title("⚔️ Duelos de Coliseo")
    .body("§7Organiza batallas PvP de 1 contra 1 dentro del Coliseo oficial del servidor con teletransporte y salas seguras:")
    .button("⚔️ Desafiar a un Jugador (/s:coliseopvp)")
    .button("✅ Aceptar Duelo (/s:coliseoaccept)")
    .button("❌ Rechazar Duelo (/s:coliseodeny)")
    .button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    switch (response.selection) {
      case 0: {
        const players = world.getAllPlayers().filter(p => p.name !== player.name);
        if (players.length === 0) {
          player.sendMessage("§b§l[§3Coliseo§b§l]§r §cNo hay otros jugadores en línea.");
          return;
        }
        const modal = new ModalFormData()
          .title("⚔️ Desafiar a Jugador")
          .dropdown("Selecciona al oponente:", players.map(p => p.name));
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const target = players[mRes.formValues[0]];
          if (target) {
            runMenuCommand(player, `s:coliseopvp "${target.name}"`);
          }
        }).catch(() => {});
        break;
      }
      case 1:
        runMenuCommand(player, "s:coliseoaccept");
        break;
      case 2:
        runMenuCommand(player, "s:coliseodeny");
        break;
      case 3:
        openCommandsMenu(player);
        break;
    }
  }).catch(() => {});
}

function openCommandsTradeMenu(player) {
  const form = new ActionFormData()
    .title("🤝 Comercio e Intercambio")
    .body("§7Publica ítems en la subasta pública, inspecciona las ventas de otros jugadores o comercia de forma segura cara a cara:")
    .button("🎒 Publicar en Subasta (/s:vender)")
    .button("🎒 Ver Subastas Activas (/s:subastas)")
    .button("🤝 Solicitar Intercambio (/s:trade)")
    .button("✅ Aceptar Intercambio (/s:tradeaccept)")
    .button("❌ Rechazar Intercambio (/s:tradedeny)")
    .button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    switch (response.selection) {
      case 0: {
        const modal = new ModalFormData()
          .title("🎒 Publicar Item en Subasta")
          .textField("Ingresa el precio de venta:", "Monto entero positivo");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const price = mRes.formValues[0];
          if (price) {
            runMenuCommand(player, `s:vender ${price}`);
          }
        }).catch(() => {});
        break;
      }
      case 1:
        if (typeof globalThis.openSubastasMenu === "function") {
          globalThis.openSubastasMenu(player);
        } else {
          runMenuCommand(player, "s:subastas", "scriptevent cmd:subastas");
        }
        break;
      case 2: {
        const players = world.getAllPlayers().filter(p => p.name !== player.name);
        if (players.length === 0) {
          player.sendMessage("§b§l[§3Intercambio§b§l]§r §cNo hay otros jugadores en línea.");
          return;
        }
        const modal = new ModalFormData()
          .title("🤝 Solicitar Intercambio Seguro")
          .dropdown("Selecciona al jugador:", players.map(p => p.name));
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const target = players[mRes.formValues[0]];
          if (target) {
            runMenuCommand(player, `s:trade "${target.name}"`);
          }
        }).catch(() => {});
        break;
      }
      case 3:
        runMenuCommand(player, "s:tradeaccept");
        break;
      case 4:
        runMenuCommand(player, "s:tradedeny");
        break;
      case 5:
        openCommandsMenu(player);
        break;
    }
  }).catch(() => {});
}

function openCommandsJobsQuestsMenu(player) {
  const form = new ActionFormData()
    .title("💼 Trabajos y Misiones")
    .body("§7Únete a profesiones para ganar dinero con tus actividades y abre el panel de misiones para obtener recompensas extra:")
    .button("💼 Oficina de Trabajos (/s:trabajos)")
    .button("📜 Misiones Diarias (/s:misiones)")
    .button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    switch (response.selection) {
      case 0:
        runMenuCommand(player, "s:trabajos");
        break;
      case 1:
        runMenuCommand(player, "s:misiones");
        break;
      case 2:
        openCommandsMenu(player);
        break;
    }
  }).catch(() => {});
}

function openCommandsAdminMenu(player) {
  if (!isPlayerOp(player)) return;
  const form = new ActionFormData()
    .title("🛠️ Panel de Administración")
    .body("§7Consola interactiva de control exclusivo para operadores. Administra economía, warps, protecciones y configuración general:")
    .button("⚙️ Panel Admin Principal (/s:admin)")
    .button("⚖️ Moderación de Jugadores")
    .button("💰 Economía Admin")
    .button("🛡️ Protecciones Admin")
    .button("📍 Warps Admin")
    .button("⚠️ Ver Reportes (/s:reports)")
    .button("📋 Auditoría Moderación (/s:audit)")
    .button("🛡️ Gestión de Roles (/s:roles)")
    .button("🛡️ Depurar Anticheat (/s:acdebug)")
    .button("🔒 Servidor en Lockdown (/s:lockdown)")
    .button("🧹 Limpieza de Suelo (/s:limpiar)")
    .button("🌀 Establecer Spawn del Servidor (/s:estableceraparicion)")
    .button("🧟 Iniciar Horda (/s:hordastart)")
    .button("⛏️ Iniciar Fiebre de Minería (/s:fiebrestart)")
    .button("📦 Gestión de Cofres (Crates)")
    .button("🎥 Modo Cámara (/s:camara)")
    .button("👥 Historial XUID (/s:adminlist)")
    .button("💼 Spawn NPC Trabajos (/s:trabajosnpc)")
    .button("⚙️ Spawn Máquina Trabajos (/s:maquinatrabajo)")
    .button("🧹 Limpiar NPCs Cercanos (/s:removernpcs)")
    .button("🧟 Configurar Horda (/s:adminhorda)")
    .button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    switch (response.selection) {
      case 0:
        runMenuCommand(player, "s:admin");
        break;
      case 1:
        openCommandsModerationAdminMenu(player);
        break;
      case 2:
        openCommandsMoneyAdminMenu(player);
        break;
      case 3:
        openCommandsProtectionAdminMenu(player);
        break;
      case 4:
        openCommandsWarpsAdminMenu(player);
        break;
      case 5:
        runMenuCommand(player, "s:reports");
        break;
      case 6:
        runMenuCommand(player, "s:audit");
        break;
      case 7: {
        const modal = new ModalFormData()
          .title("🛡️ Gestión de Roles")
          .textField("Acción (view/add/remove):", "Ej: add")
          .textField("Nombre del jugador:", "Ej: Juanito")
          .textField("Nombre del rol:", "Ej: moderador");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const action = mRes.formValues[0] || "view";
          const target = mRes.formValues[1] || "";
          const role = mRes.formValues[2] || "";
          runMenuCommand(player, `s:roles "${action}" "${target}" "${role}"`);
        }).catch(() => {});
        break;
      }
      case 8: {
        const players = world.getAllPlayers();
        const modal = new ModalFormData()
          .title("🛡️ Depurar Anticheat")
          .dropdown("Selecciona al jugador:", players.map(p => p.name));
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const target = players[mRes.formValues[0]];
          if (target) {
            runMenuCommand(player, `s:acdebug "${target.name}"`);
          }
        }).catch(() => {});
        break;
      }
      case 9: {
        const modal = new ModalFormData()
          .title("🔒 Servidor en Lockdown")
          .dropdown("Estado del Lockdown:", ["Activar (on)", "Desactivar (off)"]);
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const status = mRes.formValues[0] === 0 ? "on" : "off";
          runMenuCommand(player, `s:lockdown ${status}`);
        }).catch(() => {});
        break;
      }
      case 10:
        runMenuCommand(player, "s:limpiar");
        break;
      case 11:
        runMenuCommand(player, "s:estableceraparicion");
        break;
      case 12:
        runMenuCommand(player, "s:hordastart");
        break;
      case 13:
        runMenuCommand(player, "s:fiebrestart");
        break;
      case 14:
        openCommandsCratesAdminMenu(player);
        break;
      case 15:
        runMenuCommand(player, "s:camara");
        break;
      case 16: {
        const modal = new ModalFormData()
          .title("👥 Historial XUID")
          .textField("Filtro opcional (nombre):", "Dejar vacío para ver todos");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const filter = mRes.formValues[0] || "";
          runMenuCommand(player, `s:adminlist "${filter}"`);
        }).catch(() => {});
        break;
      }
      case 17:
        runMenuCommand(player, "s:trabajosnpc");
        break;
      case 18:
        runMenuCommand(player, "s:maquinatrabajo");
        break;
      case 19: {
        const modal = new ModalFormData()
          .title("🧹 Limpiar NPCs Cercanos")
          .textField("Radio opcional (bloques):", "Dejar vacío para radio por defecto");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const radius = mRes.formValues[0] || "";
          runMenuCommand(player, `s:removernpcs ${radius}`);
        }).catch(() => {});
        break;
      }
      case 20: {
        const modal = new ModalFormData()
          .title("🧟 Configurar Horda")
          .textField("Recompensa en dinero:", "Ej: 5000")
          .textField("Mensaje de anuncio:", "Ej: ¡Horda salvaje detectada!");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const reward = mRes.formValues[0] || "";
          const msg = mRes.formValues[1] || "";
          runMenuCommand(player, `s:adminhorda ${reward} "${msg}"`);
        }).catch(() => {});
        break;
      }
      case 21:
        openCommandsMenu(player);
        break;
    }
  }).catch(() => {});
}

function openCommandsMoneyAdminMenu(player) {
  if (!isPlayerOp(player)) return;
  const form = new ActionFormData()
    .title("💰 Economía Admin")
    .body("§7Gestión del saldo de los jugadores:")
    .button("➕ Agregar Dinero (/s:dineroagregar)")
    .button("➖ Remover Dinero (/s:dineroremover)")
    .button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    switch (response.selection) {
      case 0: {
        const modal = new ModalFormData()
          .title("➕ Agregar Dinero")
          .textField("Nombre del jugador:", "Nombre exacto")
          .textField("Cantidad a agregar:", "Ej: 1000");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const target = mRes.formValues[0];
          const amount = mRes.formValues[1];
          if (target && amount) {
            runMenuCommand(player, `s:dineroagregar "${target}" ${amount}`);
          }
        }).catch(() => {});
        break;
      }
      case 1: {
        const modal = new ModalFormData()
          .title("➖ Remover Dinero")
          .textField("Nombre del jugador:", "Nombre exacto")
          .textField("Cantidad a remover:", "Ej: 1000");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const target = mRes.formValues[0];
          const amount = mRes.formValues[1];
          if (target && amount) {
            runMenuCommand(player, `s:dineroremover "${target}" ${amount}`);
          }
        }).catch(() => {});
        break;
      }
      case 2:
        openCommandsAdminMenu(player);
        break;
    }
  }).catch(() => {});
}

function openCommandsProtectionAdminMenu(player) {
  if (!isPlayerOp(player)) return;
  const form = new ActionFormData()
    .title("🛡️ Protecciones Admin")
    .body("§7Gestión administrativa de zonas protegidas:")
    .button("📍 Marcar Esquina Admin 1 (/s:adminpos1)")
    .button("📍 Marcar Esquina Admin 2 (/s:adminpos2)")
    .button("🛡️ Proteger Área Admin (/s:adminproteger)")
    .button("❌ Eliminar Zona Admin (/s:admineliminar)")
    .button("⚔️ Configurar Coliseo (/s:admincoliseo)")
    .button("🧹 Limpiar Coliseo (/s:admincoliseolimpiar)")
    .button("🐛 Depurar Coliseo (/s:coliseodebug)")
    .button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    switch (response.selection) {
      case 0:
        runMenuCommand(player, "s:adminpos1");
        break;
      case 1:
        runMenuCommand(player, "s:adminpos2");
        break;
      case 2: {
        const modal = new ModalFormData()
          .title("🛡️ Proteger Área Admin")
          .textField("Nombre de la protección:", "Ej: ZonaSpawn");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const name = mRes.formValues[0];
          if (name) {
            runMenuCommand(player, `s:adminproteger ${name}`);
          }
        }).catch(() => {});
        break;
      }
      case 3: {
        const modal = new ModalFormData()
          .title("❌ Eliminar Zona Admin")
          .textField("Nombre de la zona a eliminar:", "Nombre de la protección");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const name = mRes.formValues[0];
          if (name) {
            runMenuCommand(player, `s:admineliminar ${name}`);
          }
        }).catch(() => {});
        break;
      }
      case 4:
        runMenuCommand(player, "s:admincoliseo");
        break;
      case 5:
        runMenuCommand(player, "s:admincoliseolimpiar");
        break;
      case 6:
        runMenuCommand(player, "s:coliseodebug");
        break;
      case 7:
        openCommandsAdminMenu(player);
        break;
    }
  }).catch(() => {});
}

function openCommandsWarpsAdminMenu(player) {
  if (!isPlayerOp(player)) return;
  const form = new ActionFormData()
    .title("📍 Warps Admin")
    .body("§7Gestión de puntos de teletransporte públicos:")
    .button("📍 Establecer Warp Público (/s:establecerpunto)")
    .button("❌ Eliminar Warp Público (/s:eliminarpunto)")
    .button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    switch (response.selection) {
      case 0: {
        const modal = new ModalFormData()
          .title("📍 Establecer Warp Público")
          .textField("Nombre del Warp:", "Ej: Arena");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const name = mRes.formValues[0];
          if (name) {
            runMenuCommand(player, `s:establecerpunto ${name}`);
          }
        }).catch(() => {});
        break;
      }
      case 1: {
        const modal = new ModalFormData()
          .title("❌ Eliminar Warp Público")
          .textField("Nombre del Warp a eliminar:", "Ej: Arena");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const name = mRes.formValues[0];
          if (name) {
            runMenuCommand(player, `s:eliminarpunto ${name}`);
          }
        }).catch(() => {});
        break;
      }
      case 2:
        openCommandsAdminMenu(player);
        break;
    }
  }).catch(() => {});
}

function openCommandsModerationAdminMenu(player) {
  if (!isPlayerOp(player)) return;
  const form = new ActionFormData()
    .title("⚖️ Moderación de Jugadores")
    .body("§7Acciones de moderación interactiva:")
    .button("⚠️ Advertir Jugador (/s:warn)")
    .button("🔇 Silenciar Jugador (/s:mute)")
    .button("🔊 Quitar Silencio (/s:unmute)")
    .button("🚪 Expulsar Jugador (/s:kick)")
    .button("⏳ Banear Temporal (/s:tempban)")
    .button("🚫 Banear Permanente (/s:ban)")
    .button("🔓 Desbanear Jugador (/s:unban)")
    .button("❄️ Congelar Jugador (/s:freeze)")
    .button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    const players = world.getAllPlayers().filter(p => p.name !== player.name);
    
    switch (response.selection) {
      case 0: {
        if (players.length === 0) { player.sendMessage("§cNo hay otros jugadores en línea."); return; }
        const modal = new ModalFormData()
          .title("⚠️ Advertir Jugador")
          .dropdown("Selecciona al jugador:", players.map(p => p.name))
          .textField("Motivo de la advertencia:", "Ingresa la razón");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const target = players[mRes.formValues[0]];
          const reason = mRes.formValues[1];
          if (target && reason) {
            runMenuCommand(player, `s:warn "${target.name}" "${reason}"`);
          }
        }).catch(() => {});
        break;
      }
      case 1: {
        if (players.length === 0) { player.sendMessage("§cNo hay otros jugadores en línea."); return; }
        const modal = new ModalFormData()
          .title("🔇 Silenciar Jugador")
          .dropdown("Selecciona al jugador:", players.map(p => p.name))
          .textField("Duración (ej. 30m, 1h, 1d):", "Tiempo de silencio")
          .textField("Motivo:", "Ingresa la razón");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const target = players[mRes.formValues[0]];
          const duration = mRes.formValues[1];
          const reason = mRes.formValues[2];
          if (target && duration && reason) {
            runMenuCommand(player, `s:mute "${target.name}" "${duration}" "${reason}"`);
          }
        }).catch(() => {});
        break;
      }
      case 2: {
        const modal = new ModalFormData()
          .title("🔊 Quitar Silencio")
          .textField("Nombre del jugador a quitar silencio:", "Nombre exacto del jugador");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const targetName = mRes.formValues[0];
          if (targetName) {
            runMenuCommand(player, `s:unmute "${targetName}"`);
          }
        }).catch(() => {});
        break;
      }
      case 3: {
        if (players.length === 0) { player.sendMessage("§cNo hay otros jugadores en línea."); return; }
        const modal = new ModalFormData()
          .title("🚪 Expulsar Jugador")
          .dropdown("Selecciona al jugador:", players.map(p => p.name))
          .textField("Motivo de la expulsión:", "Ingresa la razón");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const target = players[mRes.formValues[0]];
          const reason = mRes.formValues[1];
          if (target && reason) {
            runMenuCommand(player, `s:kick "${target.name}" "${reason}"`);
          }
        }).catch(() => {});
        break;
      }
      case 4: {
        if (players.length === 0) { player.sendMessage("§cNo hay otros jugadores en línea."); return; }
        const modal = new ModalFormData()
          .title("⏳ Banear Temporal")
          .dropdown("Selecciona al jugador:", players.map(p => p.name))
          .textField("Duración (ej. 1d, 7d):", "Tiempo del ban")
          .textField("Motivo:", "Ingresa la razón");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const target = players[mRes.formValues[0]];
          const duration = mRes.formValues[1];
          const reason = mRes.formValues[2];
          if (target && duration && reason) {
            runMenuCommand(player, `s:tempban "${target.name}" "${duration}" "${reason}"`);
          }
        }).catch(() => {});
        break;
      }
      case 5: {
        if (players.length === 0) { player.sendMessage("§cNo hay otros jugadores en línea."); return; }
        const modal = new ModalFormData()
          .title("🚫 Banear Permanente")
          .dropdown("Selecciona al jugador:", players.map(p => p.name))
          .textField("Motivo del ban permanente:", "Ingresa la razón");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const target = players[mRes.formValues[0]];
          const reason = mRes.formValues[1];
          if (target && reason) {
            runMenuCommand(player, `s:ban "${target.name}" "${reason}"`);
          }
        }).catch(() => {});
        break;
      }
      case 6: {
        const modal = new ModalFormData()
          .title("🔓 Desbanear Jugador")
          .textField("Nombre del jugador a desbanear:", "Nombre exacto del jugador");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const targetName = mRes.formValues[0];
          if (targetName) {
            runMenuCommand(player, `s:unban "${targetName}"`);
          }
        }).catch(() => {});
        break;
      }
      case 7: {
        if (players.length === 0) { player.sendMessage("§cNo hay otros jugadores en línea."); return; }
        const modal = new ModalFormData()
          .title("❄️ Congelar Jugador")
          .dropdown("Selecciona al jugador:", players.map(p => p.name))
          .textField("Motivo (o tiempo de congelado):", "Ingresa la razón");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const target = players[mRes.formValues[0]];
          const reason = mRes.formValues[1];
          if (target && reason) {
            runMenuCommand(player, `s:freeze "${target.name}" "${reason}"`);
          }
        }).catch(() => {});
        break;
      }
      case 8:
        openCommandsAdminMenu(player);
        break;
    }
  }).catch(() => {});
}

function openCommandsCratesAdminMenu(player) {
  if (!isPlayerOp(player)) return;
  const form = new ActionFormData()
    .title("📦 Gestión de Cofres (Crates)")
    .body("§7Acciones de administración de cofres:")
    .button("📦 Registrar Cofre (/s:establecercofre)")
    .button("❌ Eliminar Cofre (/s:eliminarcofre)")
    .button("🔑 Entregar Llave (/s:darllave)")
    .button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    switch (response.selection) {
      case 0:
        runMenuCommand(player, "s:establecercofre");
        break;
      case 1:
        runMenuCommand(player, "s:eliminarcofre");
        break;
      case 2: {
        const players = world.getAllPlayers();
        const modal = new ModalFormData()
          .title("🔑 Entregar Llave")
          .dropdown("Selecciona al jugador:", players.map(p => p.name))
          .textField("Cantidad de llaves:", "Monto entero positivo", "1");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const target = players[mRes.formValues[0]];
          const amount = mRes.formValues[1] || "1";
          if (target) {
            runMenuCommand(player, `s:darllave "${target.name}" ${amount}`);
          }
        }).catch(() => {});
        break;
      }
      case 3:
        openCommandsAdminMenu(player);
        break;
    }
  }).catch(() => {});
}

function openCommandsHomeMenu(player) {
  const form = new ActionFormData()
    .title("🏠 Comandos de Teletransporte")
    .body("§7Gestión de hogares privados, puntos de aparición comunes, teletransporte a otros jugadores y localización de tu última tumba:")
    .button("🏠 Gestionar mis Casas")
    .button("🌀 Ir al Spawn (/s:aparicion)")
    .button("🗺️ Warps Públicos (/s:teletransportes)")
    .button("🌍 Explorar con RTP (/s:rtp)")
    .button("📍 Mi Última Tumba (/s:tumba)")
    .button("👤 Teletransporte a Jugador (TPA)")
    .button("✅ Aceptar Teletransporte (TPA Accept)")
    .button("❌ Rechazar Teletransporte (TPA Deny)")
    .button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    switch (response.selection) {
      case 0:
        openHomesMenu(player);
        break;
      case 1:
        runMenuCommand(player, "s:aparicion");
        break;
      case 2:
        runMenuCommand(player, "s:teletransportes");
        break;
      case 3:
        runMenuCommand(player, "s:rtp");
        break;
      case 4:
        runMenuCommand(player, "s:tumba");
        break;
      case 5: {
        const players = world.getAllPlayers().filter(p => p.name !== player.name);
        if (players.length === 0) {
          player.sendMessage("§b§l[§3Teletransporte§b§l]§r §cNo hay otros jugadores en línea.");
          return;
        }
        const modal = new ModalFormData()
          .title("👤 Solicitar Teletransporte (TPA)")
          .dropdown("Selecciona al jugador:", players.map(p => p.name));
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const target = players[mRes.formValues[0]];
          if (target) {
            runMenuCommand(player, `s:tpa ${target.name}`);
          }
        }).catch(() => {});
        break;
      }
      case 6:
        runMenuCommand(player, "s:tpaaceptar");
        break;
      case 7:
        runMenuCommand(player, "s:tparechazar");
        break;
      case 8:
        openCommandsMenu(player);
        break;
    }
  }).catch(() => {});
}

function openCommandsRewardsMenu(player) {
  const form = new ActionFormData()
    .title("🎁 Recompensas y Kits")
    .body("§7Reclama tu kit de inicio de juego, reclama recompensas diarias gratuitas y equipa títulos visuales en tu nombre:")
    .button("📦 Kit Inicial (/s:kitinicial)")
    .button("⭐ Recompensas Diarias (/s:recompensas)")
    .button("🏷️ Menú de Títulos (/s:titulos)")
    .button("🛍️ Vincular Tienda Web (/s:tebex)")
    .button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    switch (response.selection) {
      case 0:
        runMenuCommand(player, "s:kitinicial");
        break;
      case 1:
        runMenuCommand(player, "s:recompensas");
        break;
      case 2:
        runMenuCommand(player, "s:titulos");
        break;
      case 3:
        runMenuCommand(player, "s:tebex");
        break;
      case 4:
        openCommandsMenu(player);
        break;
    }
  }).catch(() => {});
}

function openCommandsUtilsMenu(player) {
  const form = new ActionFormData()
    .title("🔍 Utilidades y Auditoría")
    .body("§7Mide la latencia de tu conexión, juega en el casino comunitario o inspecciona quién modificó bloques en el mundo:")
    .button("🔍 Vara de Inspección (/s:varaauditoria)")
    .button("📋 Auditar Coordenadas (/s:blockaudit)")
    .button("📝 Historial de Jugador (/s:blockhistory)")
    .button("🎰 Casino del Juego (/s:casino)")
    .button("🏓 Medir Latencia (/s:ping)")
    .button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    switch (response.selection) {
      case 0:
        runMenuCommand(player, "s:varaauditoria");
        break;
      case 1: {
        const modal = new ModalFormData()
          .title("📋 Auditar Coordenadas")
          .textField("X:", "Coordenada X")
          .textField("Y:", "Coordenada Y")
          .textField("Z:", "Coordenada Z");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const x = mRes.formValues[0];
          const y = mRes.formValues[1];
          const z = mRes.formValues[2];
          if (x !== "" && y !== "" && z !== "") {
            runMenuCommand(player, `s:blockaudit ${x} ${y} ${z}`);
          }
        }).catch(() => {});
        break;
      }
      case 2: {
        const modal = new ModalFormData()
          .title("📝 Historial de Jugador")
          .textField("Nombre del jugador:", "Nombre del jugador a auditar");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const target = mRes.formValues[0];
          if (target) {
            runMenuCommand(player, `s:blockhistory ${target}`);
          }
        }).catch(() => {});
        break;
      }
      case 3:
        runMenuCommand(player, "s:casino");
        break;
      case 4:
        runMenuCommand(player, "s:ping");
        break;
      case 5:
        openCommandsMenu(player);
        break;
    }
  }).catch(() => {});
}

function openCommandsMoneyMenu(player) {
  const form = new ActionFormData()
    .title("💰 Comandos de Dinero y Economía")
    .body("§7Consulta tu saldo monetario disponible y realiza transferencias de dinero seguras a otros jugadores conectados:")
    .button("💵 Ver Saldo (/s:dinero)")
    .button("💸 Pagar a un Jugador (/s:pagar)")
    .button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    switch (response.selection) {
      case 0:
        runMenuCommand(player, "s:dinero");
        break;
      case 1: {
        const players = world.getAllPlayers().filter(p => p.name !== player.name);
        if (players.length === 0) {
          player.sendMessage("§b§l[§3Economía§b§l]§r §cNo hay otros jugadores en línea.");
          return;
        }
        const modal = new ModalFormData()
          .title("💸 Pagar a Jugador")
          .dropdown("Selecciona al destinatario:", players.map(p => p.name))
          .textField("Cantidad a pagar:", "Ingresa un número entero positivo");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const target = players[mRes.formValues[0]];
          const amount = mRes.formValues[1];
          if (target && amount) {
            runMenuCommand(player, `s:pagar "${target.name}" ${amount}`);
          }
        }).catch(() => {});
        break;
      }
      case 2:
        openCommandsMenu(player);
        break;
    }
  }).catch(() => {});
}

function openCommandsProtectionMenu(player) {
  const form = new ActionFormData()
    .title("🛡️ Comandos de Protección")
    .body("§7Marca las esquinas de tu terreno, crea áreas protegidas contra robos y administra los permisos de acceso de tus compañeros:")
    .button("📍 Marcar Esquina 1 (/s:pos1)")
    .button("📍 Marcar Esquina 2 (/s:pos2)")
    .button("🛡️ Proteger Área (/s:proteger)")
    .button("🔓 Desproteger Área (/s:desproteger)")
    .button("🗺️ Lista de Zonas (/s:zonas)")
    .button("🤝 Dar Permiso en Zona (Trust)")
    .button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    switch (response.selection) {
      case 0:
        runMenuCommand(player, "s:pos1");
        break;
      case 1:
        runMenuCommand(player, "s:pos2");
        break;
      case 2: {
        const modal = new ModalFormData()
          .title("🛡️ Proteger Terreno")
          .textField("Nombre de la protección:", "Ej: MiBase");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const name = mRes.formValues[0];
          if (name) {
            runMenuCommand(player, `s:proteger ${name}`);
          }
        }).catch(() => {});
        break;
      }
      case 3:
        runMenuCommand(player, "s:desproteger");
        break;
      case 4:
        runMenuCommand(player, "s:zonas");
        break;
      case 5: {
        const modal = new ModalFormData()
          .title("🤝 Dar Permiso (Trust)")
          .textField("Nombre de la zona:", "Ej: MiBase")
          .textField("Nombre del jugador:", "Ej: Juanito")
          .dropdown("Acción:", ["Agregar Permiso (trust)", "Quitar Permiso (untrust)"]);
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const zoneName = mRes.formValues[0];
          const targetPlayer = mRes.formValues[1];
          const trustAction = mRes.formValues[2] === 0 ? "trust" : "untrust";
          if (zoneName && targetPlayer) {
            runMenuCommand(player, `s:zona ${trustAction} ${zoneName} ${targetPlayer}`);
          }
        }).catch(() => {});
        break;
      }
      case 6:
        openCommandsMenu(player);
        break;
    }
  }).catch(() => {});
}

function openCommandsClansMenu(player) {
  const form = new ActionFormData()
    .title("⚔️ Comandos de Clanes")
    .body("§7Crea clanes comunitarios, invita a tus amigos, realiza depósitos o retiros del banco del clan y completa misiones cooperativas:")
    .button("⚔️ Ver Información del Clan (/s:clan info)")
    .button("👑 Crear un Clan (/s:clan crear)")
    .button("➕ Invitar Jugador (/s:clan invitar)")
    .button("🤝 Unirse a un Clan (/s:clan unirse)")
    .button("💬 Chat de Clan (/s:clan chat)")
    .button("📥 Depositar en Banco (/s:clan depositar)")
    .button("📤 Retirar del Banco (/s:clan retirar)")
    .button("📜 Misión Cooperativa (/s:clan mision)")
    .button("📋 Lista de Clanes (/s:clan lista)")
    .button("👑 Promover Miembro (/s:clan promover)")
    .button("❌ Expulsar Miembro (/s:clan expulsar)")
    .button("🎯 Caza Recompensas (Estado) (/s:clan caza estado)")
    .button("🎯 Iniciar Caza Recompensas (/s:clan caza iniciar)")
    .button("🛑 Detener Caza Recompensas (/s:clan caza detener)")
    .button("🚪 Salir del Clan (/s:clan salir)")
    .button("⚔️ Disolver Clan (/s:clan disolver)")
    .button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    switch (response.selection) {
      case 0:
        runMenuCommand(player, "s:clan info");
        break;
      case 1: {
        const modal = new ModalFormData()
          .title("👑 Crear Clan")
          .textField("Nombre del clan:", "Ej: LosMineros");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const clanName = mRes.formValues[0];
          if (clanName) {
            runMenuCommand(player, `s:clan crear ${clanName}`);
          }
        }).catch(() => {});
        break;
      }
      case 2: {
        const players = world.getAllPlayers().filter(p => p.name !== player.name);
        if (players.length === 0) {
          player.sendMessage("§b§l[§3Clanes§b§l]§r §cNo hay otros jugadores en línea.");
          return;
        }
        const modal = new ModalFormData()
          .title("➕ Invitar Jugador")
          .dropdown("Selecciona al jugador:", players.map(p => p.name));
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const target = players[mRes.formValues[0]];
          if (target) {
            runMenuCommand(player, `s:clan invitar "${target.name}"`);
          }
        }).catch(() => {});
        break;
      }
      case 3: {
        const modal = new ModalFormData()
          .title("🤝 Unirse a Clan")
          .textField("Nombre del clan a unirse:", "Ingresa el nombre del clan que te invitó");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const clanName = mRes.formValues[0];
          if (clanName) {
            runMenuCommand(player, `s:clan unirse ${clanName}`);
          }
        }).catch(() => {});
        break;
      }
      case 4: {
        const modal = new ModalFormData()
          .title("💬 Mensaje de Clan")
          .textField("Escribe el mensaje para el chat de clan:", "Mensaje...");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const msg = mRes.formValues[0];
          if (msg) {
            runMenuCommand(player, `s:clan chat ${msg}`);
          }
        }).catch(() => {});
        break;
      }
      case 5: {
        const modal = new ModalFormData()
          .title("📥 Depositar al Banco del Clan")
          .textField("Cantidad a depositar:", "Ingresa el monto entero positivo");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const amount = mRes.formValues[0];
          if (amount) {
            runMenuCommand(player, `s:clan depositar ${amount}`);
          }
        }).catch(() => {});
        break;
      }
      case 6: {
        const modal = new ModalFormData()
          .title("📤 Retirar del Banco del Clan (Líder)")
          .textField("Cantidad a retirar:", "Ingresa el monto entero positivo");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const amount = mRes.formValues[0];
          if (amount) {
            runMenuCommand(player, `s:clan retirar ${amount}`);
          }
        }).catch(() => {});
        break;
      }
      case 7:
        runMenuCommand(player, "s:clan mision");
        break;
      case 8:
        runMenuCommand(player, "s:clan lista");
        break;
      case 9: {
        const modal = new ModalFormData()
          .title("👑 Promover Miembro a Líder")
          .textField("Nombre del miembro a promover:", "Nombre exacto del jugador");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const target = mRes.formValues[0];
          if (target) {
            runMenuCommand(player, `s:clan promover "${target}"`);
          }
        }).catch(() => {});
        break;
      }
      case 10: {
        const modal = new ModalFormData()
          .title("❌ Expulsar Miembro")
          .textField("Nombre del miembro a expulsar:", "Nombre exacto del jugador");
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const target = mRes.formValues[0];
          if (target) {
            runMenuCommand(player, `s:clan expulsar "${target}"`);
          }
        }).catch(() => {});
        break;
      }
      case 11:
        runMenuCommand(player, "s:clan caza estado");
        break;
      case 12: {
        const players = world.getAllPlayers().filter(p => p.name !== player.name);
        if (players.length === 0) {
          player.sendMessage("§b§l[§3Clanes§b§l]§r §cNo hay otros jugadores en línea.");
          return;
        }
        const modal = new ModalFormData()
          .title("🎯 Iniciar Caza de Recompensas")
          .dropdown("Selecciona al jugador a cazar:", players.map(p => p.name));
        modal.show(player).then((mRes) => {
          if (mRes.canceled) return;
          const target = players[mRes.formValues[0]];
          if (target) {
            runMenuCommand(player, `s:clan caza iniciar "${target.name}"`);
          }
        }).catch(() => {});
        break;
      }
      case 13:
        runMenuCommand(player, "s:clan caza detener");
        break;
      case 14:
        runMenuCommand(player, "s:clan salir");
        break;
      case 15:
        runMenuCommand(player, "s:clan disolver");
        break;
      case 16:
        openCommandsMenu(player);
        break;
    }
  }).catch(() => {});
}

function openHomesMenu(player) {
  const extraHomes = Math.min(4, getSharedExtraHomes(player));
  const mainIsSet = globalThis.__sqlite_get_prop_v2__("home_spawn_addon", player, "home_x") !== undefined;
  const homes = [{ number: 1, isSet: mainIsSet }];
  for (let number = 2; number <= extraHomes + 1; number++) {
    homes.push({ number, isSet: Boolean(getSharedExtraHomeLocation(player, number - 1)) });
  }

  const form = new ActionFormData()
    .title("🏠 Mis Casas")
    .body("§7Selecciona una casa para guardarla o teletransportarte. §eCasa 1 §7es tu principal.");
  for (const home of homes) {
    const label = home.number === 1 ? "🏠 Casa Principal" : `🏡 Casa Extra #${home.number}`;
    form.button(`${label}\n${home.isSet ? "§aGuardada" : "§cSin guardar"}`);
  }
  form.button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    if (response.selection === homes.length) {
      openSpawnSubMenu(player);
      return;
    }
    const home = homes[response.selection];
    if (home) openManageHomeMenu(player, home.number);
  }).catch(() => {});
}

function openManageHomeMenu(player, number) {
  const isPrimary = number === 1;
  const extraHome = isPrimary ? undefined : getSharedExtraHomeLocation(player, number - 1);
  const isSet = isPrimary ? globalThis.__sqlite_get_prop_v2__("home_spawn_addon", player, "home_x") !== undefined : Boolean(extraHome);
  const label = isPrimary ? "Casa Principal" : `Casa Extra #${number}`;
  const setCommand = `s:sethome ${number}`;
  const homeCommand = isPrimary ? "s:home" : `s:home ${number}`;

  const form = new ActionFormData()
    .title(`🏠 ${label}`)
    .body(`§7Estado: ${isSet ? "§aGuardada" : "§cSin guardar"}\n\n§7Puedes actualizar su ubicación actual o viajar a ella.`)
    .button(`📍 Guardar aquí (${setCommand})`)
    .button(`🌀 Ir a esta casa (${homeCommand})`)
    .button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    if (response.selection === 0) {
      runMenuCommand(player, setCommand);
    } else if (response.selection === 1) {
      runMenuCommand(player, homeCommand);
    } else if (response.selection === 2) {
      openHomesMenu(player);
    }
  }).catch(() => {});
}

function openSpawnSubMenu(player) {
  const form = new ActionFormData()
    .title("🏠 Casas y Teletransporte")
    .body("§7Elige una acción de teletransporte:")
    .button("🏠 Gestionar mis Casas")
    .button("🌀 Ir a Spawn")
    .button("🗺️ Warps Públicos")
    .button("🌍 Explorar con RTP")
    .button("📍 Mi Tumba")
    .button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    switch (response.selection) {
      case 0:
        openHomesMenu(player);
        break;
      case 1:
        runMenuCommand(player, "s:spawn", "scriptevent ! spawn");
        break;
      case 2:
        runMenuCommand(player, "s:warps");
        break;
      case 3:
        runMenuCommand(player, "s:rtp");
        break;
      case 4:
        openTumbaGUI(player);
        break;
      case 5:
        openServerMainMenu(player);
        break;
    }
  }).catch(() => {});
}

function openTradeSelectPlayerMenu(player) {
  const players = world.getAllPlayers().filter(p => p.name !== player.name);
  if (players.length === 0) {
    const form = new ActionFormData()
      .title("🤝 Intercambio Seguro")
      .body("§cNo hay otros jugadores en línea en este momento para intercambiar.")
      .button("🔙 Volver");
    form.show(player).then(() => {
      openServerMainMenu(player);
    }).catch(() => {});
    return;
  }

  const form = new ActionFormData()
    .title("🤝 Selecciona un Jugador")
    .body("§7Elige al jugador con el que deseas iniciar el intercambio seguro:");

  for (const p of players) {
    form.button(p.name);
  }
  form.button("🔙 Volver");

  form.show(player).then((response) => {
    if (response.canceled) return;
    if (response.selection === players.length) {
      openServerMainMenu(player);
      return;
    }

    const targetPlayer = players[response.selection];
    if (targetPlayer) {
      // Los nombres Bedrock pueden contener espacios: el parámetro del comando
      // debe viajar como una sola cadena. El fallback usa el canal que escucha
      // trade_addon ("pacific:trade"), no los antiguos identificadores
      // sin namespace que Bedrock rechaza.
      runMenuCommand(
        player,
        `s:trade "${escapeCommandArg(targetPlayer.name)}"`,
        `scriptevent pacific:trade trade ${targetPlayer.name}`
      );
    }
  }).catch(() => {});
}

// Ventana de reglas y convivencia comunitaria.
function openRulesMenu(player) {
  const form = new ActionFormData()
    .title("📋 Reglamento de Pacífico")
    .body(
      "§a§l¡Bienvenido a Pacífico Comunitario!\n\n" +
      "§7Para mantener una convivencia sana, segura y divertida, hemos establecido las siguientes normas de cumplimiento obligatorio. Selecciona una categoría para ver los detalles:"
    )
    .button("🛡️ 1. Respeto y Seguridad")
    .button("🧱 2. Propiedad y Grifeo")
    .button("⚔️ 3. PvP y Combate")
    .button("🚫 4. Hacks y Trampas")
    .button("💰 5. Bugs y Economía")
    .button("🛒 6. Comercio y Estafas")
    .button("💬 7. Chat y Convivencia")
    .button("⚖️ 8. Sanciones y Reportes")
    .button("🔙 Volver al Menú")
    .button("❌ Cerrar");

  form.show(player).then((response) => {
    if (response.canceled) return;
    const selection = response.selection;
    if (selection === 8) {
      openServerMainMenu(player);
      return;
    }
    if (selection === 9) return;

    showRuleDetail(player, selection);
  }).catch(() => {});
}

function showRuleDetail(player, ruleId) {
  const rules = [
    {
      title: "🛡️ Respeto y Seguridad",
      body: "§eRegla:\n§7Cero tolerancia a conductas de acoso, hostigamiento, amenazas, discriminación de cualquier tipo, toxicidad, suplantación de identidad, difusión de información privada (doxxing) y contenido inapropiado o explícito.\n\n§cSanción:\n§7Baneo inmediato y permanente de todos nuestros servicios (Servidor y Discord)."
    },
    {
      title: "🧱 Propiedad y Grifeo",
      body: "§eRegla:\n§7Queda terminantemente prohibido robar, destruir, modificar o invadir construcciones o proyectos de otros jugadores sin autorización. Que una zona no esté protegida NO te da derecho a tocarla.\n\n§cSanción:\n§7Baneo temporal a permanente y rollback de los daños. Usa siempre §b/s:proteger §7para tus terrenos."
    },
    {
      title: "⚔️ PvP y Combate",
      body: "§eRegla:\n§7El PvP se permite únicamente bajo consentimiento mutuo, o bien en zonas y eventos de combate habilitados. Prohibido el spawn-kill, persecución persistente y la desconexión en combate para evitar morir (Combat Log).\n\n§cSanción:\n§7Pérdida de inventario, baneo temporal y bloqueo de comandos PvP."
    },
    {
      title: "🚫 Hacks y Trampas",
      body: "§eRegla:\n§7Está prohibido el uso de clientes modificados, hacks (Fly, KillAura, Reach, Speed, X-Ray, etc.), autoclickers, macros de combate, texturas que otorguen ventajas visuales ilegítimas o cualquier programa externo.\n\n§cSanción:\n§7Baneo permanente sin derecho a apelación y limpieza total de inventarios/banco."
    },
    {
      title: "💰 Bugs y Economía",
      body: "§eRegla:\n§7Queda prohibida la duplicación de objetos, la explotación de fallos del juego o del servidor, y la manipulación de saldos. Si encuentras un bug, repórtalo inmediatamente al staff.\n\n§cSanción:\n§7Baneo permanente de la cuenta y baneo a quienes se beneficien o encubran la falta."
    },
    {
      title: "🛒 Comercio y Estafas",
      body: "§eRegla:\n§7Todos los intercambios deben ser limpios y justos. Quedan prohibidas las estafas. Usa los sistemas seguros de comercio y subastas. No se permite la compra-venta de ítems del juego por dinero real (RMT).\n\n§cSanción:\n§7Baneo temporal a permanente y confiscación de los bienes involucrados."
    },
    {
      title: "💬 Chat y Convivencia",
      body: "§eRegla:\n§7Mantén un lenguaje adecuado. Prohibido el spam, inundar el chat (flood), la publicidad de otros servidores (spam privado), el uso excesivo de mayúsculas y enlaces maliciosos.\n\n§cSanción:\n§7Silencio (mute) temporal o baneo en caso de reincidencia."
    },
    {
      title: "⚖️ Sanciones y Reportes",
      body: "§eRegla:\n§7Cualquier reporte debe presentarse con evidencia clara (capturas o videos) en el Discord oficial. No reportes falsamente ni intentes evadir sanciones con cuentas secundarias (multicuentas).\n\n§cSanción:\n§7La evasión de sanciones duplicará la penalización original o resultará en baneo permanente de IPs."
    }
  ];

  const rule = rules[ruleId];
  if (!rule) return;

  const form = new ActionFormData()
    .title(rule.title)
    .body(rule.body + "\n\n§8Presiona 'Atrás' para volver al reglamento.")
    .button("🔙 Atrás")
    .button("❌ Cerrar");

  form.show(player).then((response) => {
    if (response.canceled) return;
    if (response.selection === 0) {
      openRulesMenu(player);
    }
  }).catch(() => {});
}

// --- SISTEMA DE TUMBAS (📍 /s:tumba) ---

function openTumbaGUI(player) {
  try {
    const deathRaw = globalThis.__sqlite_get_prop_v2__("home_spawn_addon", "world", "death_" + player.name.toLowerCase());
    if (!deathRaw) {
      const form = new ActionFormData()
        .title("📍 Tu Última Tumba")
        .body("§cNo tienes ningún registro de muerte reciente en el servidor.")
        .button("🔙 Volver");
      form.show(player).then(() => {
        openSpawnSubMenu(player);
      }).catch(() => {});
      return;
    }

    const deathInfo = globalThis.__sqlite_read_json_v3__(deathRaw);
    const dimNames = {
      "minecraft:overworld": "Overworld (Mundo Normal)",
      "minecraft:nether": "Nether (Inframundo)",
      "minecraft:the_end": "The End"
    };
    const dimName = dimNames[deathInfo.dimension] || deathInfo.dimension;

    const form = new ActionFormData()
      .title("📍 Tu Última Tumba")
      .body(
        `§7Aquí tienes los datos de tu última muerte:\n\n` +
        `§7Coordenadas:\n` +
        `§a👉 X: ${deathInfo.x}§7, §aY: ${deathInfo.y}§7, §aZ: ${deathInfo.z}\n\n` +
        `§7Dimensión: §e${dimName}\n` +
        `§7Registro temporal: §d${new Date(deathInfo.timestamp).toLocaleString("es-ES")}\n\n` +
        `§7*Nota: Esta información es completamente privada y solo tú puedes verla.`
      )
      .button("🔙 Volver")
      .button("❌ Cerrar");

    form.show(player).then((response) => {
      if (response.canceled) return;
      if (response.selection === 0) {
        openSpawnSubMenu(player);
      }
    }).catch(() => {});
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    player.sendMessage("§b§l[§3Tumba§b§l]§r §cError: " + e.message);
  }
}

// Memoria para guardar la última ubicación conocida de los jugadores (para evitar InvalidEntityError en entityDie)
const playerLastLocations = new Map();
const activeGraves = new Map();
const pendingGraveRecoveries = new Set();
const ACTIVE_GRAVES_PROPERTY_KEY = "active_graves_registry";

function cloneItemSafe(item) {
  if (!item) return undefined;
  try {
    return item.clone();
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    try {
      const cloned = new ItemStack(item.typeId, item.amount);
      if (item.nameTag) cloned.nameTag = item.nameTag;
      if (typeof item.getLore === "function") {
        const lore = item.getLore();
        if (lore?.length) cloned.setLore(lore);
      }
      const sourceDurability = item.getComponent?.("minecraft:durability");
      const targetDurability = cloned.getComponent?.("minecraft:durability");
      if (sourceDurability && targetDurability && typeof sourceDurability.damage === "number") {
        targetDurability.damage = sourceDurability.damage;
      }

      const sourceEnchantable = item.getComponent?.("minecraft:enchantable");
      const targetEnchantable = cloned.getComponent?.("minecraft:enchantable");
      if (sourceEnchantable && targetEnchantable) {
        for (const enchantment of sourceEnchantable.getEnchantments()) {
          try {
            targetEnchantable.addEnchantment({
              type: enchantment.type,
              level: enchantment.level
            });
          } catch (enchantErr) { ErrorReporter.report(enchantErr, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
        }
      }

      return cloned;
    } catch (err) { ErrorReporter.report(err, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      return undefined;
    }
  }
}

function isReplaceableForGrave(block) {
  if (!block) return false;
  const typeId = String(block.typeId || "").toLowerCase();
  return [
    "minecraft:air",
    "minecraft:cave_air",
    "minecraft:void_air",
    "minecraft:tallgrass",
    "minecraft:short_grass",
    "minecraft:fern",
    "minecraft:deadbush",
    "minecraft:snow_layer",
    "minecraft:vine",
    "minecraft:water",
    "minecraft:flowing_water",
    "minecraft:lava",
    "minecraft:flowing_lava"
  ].includes(typeId);
}

function prepareExactGraveTransfer(player) {
  const records = [];
  const items = [];
  const cleared = [];
  try {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (inventory) {
      for (let slot = 0; slot < inventory.size; slot++) {
        const item = inventory.getItem(slot);
        if (!item) continue;
        const recordItem = cloneItemSafe(item);
        const graveItem = cloneItemSafe(item);
        if (!recordItem || !graveItem) throw new Error(`No se pudo preparar el slot de inventario ${slot} para la tumba.`);
        records.push({ kind: "inventory", slot, item: recordItem });
        items.push(graveItem);
      }
    }

    const equippable = player.getComponent("minecraft:equippable");
    if (equippable) {
      for (const slot of [EquipmentSlot.Offhand, EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet]) {
        const item = equippable.getEquipment(slot);
        if (!item) continue;
        const recordItem = cloneItemSafe(item);
        const graveItem = cloneItemSafe(item);
        if (!recordItem || !graveItem) throw new Error("No se pudo preparar una pieza equipada para la tumba.");
        records.push({ kind: "equipment", slot, item: recordItem });
        items.push(graveItem);
      }
    }

    for (const record of records) {
      if (record.kind === "inventory") {
        const source = player.getComponent("minecraft:inventory")?.container;
        if (!source) throw new Error("El inventario ya no está disponible durante la transferencia de tumba.");
        source.setItem(record.slot, undefined);
        if (source.getItem(record.slot)) throw new Error(`No se pudo retirar el slot de inventario ${record.slot}.`);
      } else {
        const source = player.getComponent("minecraft:equippable");
        if (!source) throw new Error("El equipamiento ya no está disponible durante la transferencia de tumba.");
        source.setEquipment(record.slot, undefined);
        if (source.getEquipment(record.slot)) throw new Error("No se pudo retirar una pieza equipada.");
      }
      cleared.push(record);
    }
    return { items, records };
  } catch (error) {
    restoreExactGraveTransfer(player, { records: cleared });
    reportGraveTransferError(error, "prepareExactGraveTransfer");
    return undefined;
  }
}

function reportGraveTransferError(error, operation) {
  ErrorReporter.report(error, { addonId: "home_spawn_addon", moduleId: "main.js", operation, category: "runtime" });
  console.warn(`[Tumba] Transferencia cancelada de forma segura: ${error}`);
}

function restoreExactGraveTransfer(player, transfer) {
  if (!player || !transfer?.records?.length) return;
  try {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    const equippable = player.getComponent("minecraft:equippable");
    for (const record of transfer.records) {
      const item = cloneItemSafe(record.item);
      if (!item) continue;
      try {
        if (record.kind === "inventory" && inventory && !inventory.getItem(record.slot)) {
          inventory.setItem(record.slot, item);
          continue;
        }
        if (record.kind === "equipment" && equippable && !equippable.getEquipment(record.slot)) {
          equippable.setEquipment(record.slot, item);
          continue;
        }
        const leftover = inventory ? inventory.addItem(item) : item;
        if (leftover && player.dimension) player.dimension.spawnItem(leftover, player.location);
      } catch (recordError) {
        reportGraveTransferError(recordError, "restoreExactGraveTransferRecord");
      }
    }
  } catch (error) {
    reportGraveTransferError(error, "restoreExactGraveTransfer");
  }
}

function findGraveChestPositions(loc, dimension) {
  const baseX = Math.floor(loc.x);
  const baseY = Math.floor(loc.y);
  const baseZ = Math.floor(loc.z);

  const candidateOffsets = [
    { dx: 0, dz: 0, dx2: 1, dz2: 0 },
    { dx: 0, dz: 0, dx2: -1, dz2: 0 },
    { dx: 0, dz: 0, dx2: 0, dz2: 1 },
    { dx: 0, dz: 0, dx2: 0, dz2: -1 }
  ];

  for (let up = 0; up <= 4; up++) {
    for (const candidate of candidateOffsets) {
      const first = { x: baseX + candidate.dx, y: baseY + up, z: baseZ + candidate.dz };
      const second = { x: baseX + candidate.dx2, y: baseY + up, z: baseZ + candidate.dz2 };
      const blockA = dimension.getBlock(first);
      const blockB = dimension.getBlock(second);
      if (isReplaceableForGrave(blockA) && isReplaceableForGrave(blockB)) {
        return [first, second];
      }
    }
  }

  return [
    { x: baseX, y: baseY, z: baseZ },
    { x: baseX + 1, y: baseY, z: baseZ }
  ];
}

function fillGraveChest(dimension, firstPos, secondPos, items, onComplete = undefined) {
  system.runTimeout(() => {
    let completed = false;
    try {
      const firstContainer = dimension.getBlock(firstPos)?.getComponent("minecraft:inventory")?.container;
      const secondContainer = dimension.getBlock(secondPos)?.getComponent("minecraft:inventory")?.container;
      if (!firstContainer || !secondContainer) {
        console.warn("[Tumba] No se pudo abrir el contenedor del cofre doble.");
        return;
      }

      const containers = firstContainer.size > 27 ? [firstContainer] : [firstContainer, secondContainer];
      const capacity = containers.reduce((total, container) => total + container.size, 0);
      const safeItems = items.filter(Boolean);
      if (safeItems.length > capacity) throw new Error("La tumba no tiene capacidad para una transferencia completa.");
      let itemIndex = 0;
      for (const container of containers) {
        for (let slot = 0; slot < container.size && itemIndex < safeItems.length; slot++) {
          const item = safeItems[itemIndex++];
          container.setItem(slot, item);
          const confirmed = container.getItem(slot);
          if (!confirmed || confirmed.typeId !== item.typeId || confirmed.amount !== item.amount) {
            throw new Error(`No se pudo verificar el guardado del slot ${slot} de la tumba.`);
          }
        }
      }
      completed = itemIndex === safeItems.length;
      if (!completed) throw new Error("La tumba no aceptó todos los objetos de la transferencia.");
    } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Tumba] Error llenando cofre de tumba: " + e);
    } finally {
      if (typeof onComplete === "function") {
        try { onComplete(completed); } catch (callbackError) { reportGraveTransferError(callbackError, "fillGraveChestCallback"); }
      }
    }
  }, 5);
}

function gravePosKey(pos) {
  return `${pos.x},${pos.y},${pos.z}`;
}

function isTrackedGraveChest(block) {
  return block?.typeId === "minecraft:chest";
}

function serializeActiveGraves() {
  return JSON.stringify(Array.from(activeGraves.values()));
}

function persistActiveGraves() {
  try {
    if (activeGraves.size === 0) {
      globalThis.__sqlite_set_prop_v2__("home_spawn_addon", "world", ACTIVE_GRAVES_PROPERTY_KEY, undefined);
      return;
    }
    globalThis.__sqlite_set_prop_v2__("home_spawn_addon", "world", ACTIVE_GRAVES_PROPERTY_KEY, serializeActiveGraves());
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn("[Tumba] Error persistiendo tumbas activas: " + e);
  }
}

function loadPersistedActiveGraves() {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("home_spawn_addon", "world", ACTIVE_GRAVES_PROPERTY_KEY);
    if (!raw) return;
    const parsed = globalThis.__sqlite_read_json_v3__(raw);
    if (!Array.isArray(parsed)) return;

    activeGraves.clear();
    for (const grave of parsed) {
      if (!grave?.id || !grave?.dimensionId || !grave?.firstPos || !grave?.secondPos || !grave?.expiresAt) {
        continue;
      }
      activeGraves.set(grave.id, grave);
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn("[Tumba] Error cargando tumbas activas persistidas: " + e);
  }
}

function removeTrackedGrave(graveId, reason = "expired") {
  const grave = activeGraves.get(graveId);
  if (!grave) return;

  try {
    const dimension = getDimensionSafe(grave.dimensionId);
    if (dimension) {
      for (const pos of [grave.firstPos, grave.secondPos]) {
        const block = dimension.getBlock(pos);
        if (isTrackedGraveChest(block)) {
          block.setType("minecraft:air");
        }
      }
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn(`[Tumba] Error eliminando tumba (${reason}): ` + e);
  } finally {
    activeGraves.delete(graveId);
    persistActiveGraves();
  }
}

function isSafeGraveTeleportBlock(block) {
  const typeId = String(block?.typeId || "").toLowerCase();
  return [
    "minecraft:air",
    "minecraft:cave_air",
    "minecraft:void_air",
    "minecraft:tallgrass",
    "minecraft:short_grass",
    "minecraft:fern",
    "minecraft:deadbush",
    "minecraft:snow_layer",
    "minecraft:vine"
  ].includes(typeId);
}

function getSafeGraveTeleportLocation(dimension, grave) {
  for (const base of [grave.firstPos, grave.secondPos]) {
    for (const offsetY of [1, 2, 3]) {
      const feet = { x: base.x, y: base.y + offsetY, z: base.z };
      const head = { x: base.x, y: base.y + offsetY + 1, z: base.z };
      if (isSafeGraveTeleportBlock(dimension.getBlock(feet)) && isSafeGraveTeleportBlock(dimension.getBlock(head))) {
        return { x: feet.x + 0.5, y: feet.y, z: feet.z + 0.5 };
      }
    }
  }
  return undefined;
}

function findOwnedActiveGrave(player) {
  const owner = String(player?.name || "").trim().toLowerCase();
  const playerXuid = String(player?.xuid || "").trim();
  if (!owner && !playerXuid) return { state: "missing" };
  const candidates = Array.from(activeGraves.values())
    .filter(grave => graveOwnedByPlayer(player, grave))
    .sort((left, right) => Number(right?.createdAt || right?.expiresAt || 0) - Number(left?.createdAt || left?.expiresAt || 0));
  for (const grave of candidates) {
    if (Date.now() >= Number(grave.expiresAt || 0)) {
      removeTrackedGrave(grave.id, "expired_before_teleport");
      continue;
    }
    try {
      const dimension = world.getDimension(grave.dimensionId);
      const firstBlock = dimension?.getBlock(grave.firstPos);
      const secondBlock = dimension?.getBlock(grave.secondPos);
      if (firstBlock === undefined || secondBlock === undefined) return { state: "unavailable" };
      if (!isTrackedGraveChest(firstBlock) || !isTrackedGraveChest(secondBlock)) {
        activeGraves.delete(grave.id);
        persistActiveGraves();
        continue;
      }
      const destination = getSafeGraveTeleportLocation(dimension, grave);
      return destination ? { state: "ready", dimension, destination } : { state: "unsafe" };
    } catch (error) {
      ErrorReporter.report(error, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "findOwnedActiveGrave", category: "runtime" });
      return { state: "unavailable" };
    }
  }
  return { state: "missing" };
}

// Identidad del dueño: XUID cuando existe (tumbas nuevas); nombre exacto solo para
// registros legacy persistidos antes de guardar ownerXuid.
function graveOwnedByPlayer(player, grave) {
  if (!player || !grave) return false;
  const graveXuid = String(grave.ownerXuid || "").trim();
  if (graveXuid) {
    const playerXuid = String(player.xuid || "").trim();
    return playerXuid !== "" && playerXuid === graveXuid;
  }
  const owner = String(grave.playerName || "").trim().toLowerCase();
  return owner !== "" && owner === String(player.name || "").trim().toLowerCase();
}

function registerActiveGrave(playerName, loc, firstPos, secondPos, ownerXuid = "") {
  const graveId = `${playerName.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  activeGraves.set(graveId, {
    id: graveId,
    playerName,
    ownerXuid: String(ownerXuid || ""),
    dimensionId: loc.dimension,
    firstPos,
    secondPos,
    firstKey: gravePosKey(firstPos),
    secondKey: gravePosKey(secondPos),
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  persistActiveGraves();
  return graveId;
}

function createPlayerGrave(playerName, loc, items, onComplete = undefined, ownerXuid = "") {
  if (!loc?.dimension || !items?.length) return undefined;
  try {
    const dimension = world.getDimension(loc.dimension);
    if (!dimension) return undefined;

    const [firstPos, secondPos] = findGraveChestPositions(loc, dimension);
    dimension.getBlock(firstPos)?.setType("minecraft:chest");
    dimension.getBlock(secondPos)?.setType("minecraft:chest");
    const graveId = registerActiveGrave(playerName, loc, firstPos, secondPos, ownerXuid);
    fillGraveChest(dimension, firstPos, secondPos, items, success => onComplete?.(success, graveId));
    return { firstPos, secondPos, graveId };
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn("[Tumba] Error creando tumba: " + e);
    return undefined;
  }
}

system.run(() => {
  if (GRAVE_TRANSFER_SYSTEM_ENABLED) {
    loadPersistedActiveGraves();
    return;
  }
  // Los registros antiguos no tienen nonce verificable. Se retiran sin tocar
  // los bloques actuales para no borrar cofres que hayan sido reutilizados.
  activeGraves.clear();
  try {
    globalThis.__sqlite_set_prop_v2__("home_spawn_addon", "world", ACTIVE_GRAVES_PROPERTY_KEY, undefined);
  } catch (e) {
    ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "clearLegacyGraveRegistry", category: "runtime" });
  }
});

system.runInterval(() => {
  if (!GRAVE_TRANSFER_SYSTEM_ENABLED) return;
  const now = Date.now();
  for (const [graveId, grave] of activeGraves) {
    try {
      const dimension = world.getDimension(grave.dimensionId);
      if (!dimension) {
        activeGraves.delete(graveId);
        persistActiveGraves();
        continue;
      }

      const firstBlock = dimension.getBlock(grave.firstPos);
      const secondBlock = dimension.getBlock(grave.secondPos);
      
      // Si el bloque es undefined, el chunk está descargado. No hacemos nada hasta que se cargue.
      if (firstBlock === undefined || secondBlock === undefined) {
        continue;
      }
      
      const bothStillTracked = isTrackedGraveChest(firstBlock) && isTrackedGraveChest(secondBlock);

      // Si la tumba fue rota o alterada, dejamos de rastrearla para no borrar cofres nuevos.
      if (!bothStillTracked) {
        activeGraves.delete(graveId);
        persistActiveGraves();
        continue;
      }

      if (now >= grave.expiresAt) {
        removeTrackedGrave(graveId, "expired");
      }
    } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Tumba] Error auditando tumbas activas: " + e);
    }
  }
}, GRAVE_SWEEP_INTERVAL_TICKS);

// Prevenir exploit de granja de cofres al romper tumbas
try {
  world.beforeEvents.playerBreakBlock.subscribe((event) => {
    const block = event.block;
    if (block.typeId !== "minecraft:chest") return;
    
    const posKey = `${block.location.x},${block.location.y},${block.location.z}`;
    let matchingGraveId = undefined;
    
    for (const [graveId, grave] of activeGraves) {
      if (grave.firstKey === posKey || grave.secondKey === posKey) {
        matchingGraveId = graveId;
        break;
      }
    }
    
    if (matchingGraveId) {
      // Cancelar la rotura nativa para evitar que tire los cofres como items
      event.cancel = true;
      const breaker = event.player;
      const graveRecord = activeGraves.get(matchingGraveId);
      // Solo el dueño (XUID) o un administrador pueden reclamar la tumba.
      if (!graveOwnedByPlayer(breaker, graveRecord) && !isPlayerOp(breaker)) {
        try {
          breaker?.sendMessage("§b§l[§3Tumba§b§l]§r §cEsta tumba pertenece a otro jugador. No puedes romperla ni reclamarla.");
        } catch (e) {}
        return;
      }
      // Las dos mitades del cofre doble pueden disparar eventos casi a la vez.
      // La primera reclamación gana y la segunda no puede volver a entregar el
      // mismo inventario mientras la primera termina de vaciar la tumba.
      if (pendingGraveRecoveries.has(matchingGraveId)) return;
      pendingGraveRecoveries.add(matchingGraveId);

      const player = breaker;
      const dimension = block.dimension || player?.dimension;
      
      system.run(() => {
        try {
          const grave = activeGraves.get(matchingGraveId);
          if (!grave) return;

          // Primero copiamos todos los objetos. Nunca vaciamos un cofre si no
          // conseguimos preparar una copia segura de su contenido.
          const recoveredItems = [];
          const graveChests = [];
          for (const pos of [grave.firstPos, grave.secondPos]) {
            const currentBlock = dimension.getBlock(pos);
            if (!currentBlock || currentBlock.typeId !== "minecraft:chest") continue;
            const container = currentBlock.getComponent("minecraft:inventory")?.container;
            if (!container) continue;
            graveChests.push({ pos, currentBlock, container });
          }

          // En un cofre doble, cada mitad expone el mismo contenedor de 54
          // slots. Leer ambas mitades duplicaba todos los objetos. Cuando el
          // primer contenedor ya abarca más de un cofre, se lee solo una vez.
          const containersToRecover = graveChests[0]?.container?.size > 27
            ? [graveChests[0]]
            : graveChests;
          for (const chest of containersToRecover) {
            const container = chest.container;
            for (let i = 0; i < container.size; i++) {
              const item = container.getItem(i);
              if (!item) continue;
              const copy = cloneItemSafe(item);
              if (!copy) {
                throw new Error(`No se pudo copiar el objeto del cofre de tumba en el slot ${i}`);
              }
              recoveredItems.push(copy);
            }
          }
          
          // Vaciamos solo después de completar la copia. Se intenta devolver
          // cada objeto al inventario y el excedente aparece encima del cofre,
          // nunca dentro del bloque que se va a eliminar.
          for (const chest of graveChests) {
            for (let i = 0; i < chest.container.size; i++) chest.container.setItem(i, undefined);
          }
          const recoveryPoint = { x: grave.firstPos.x + 0.5, y: grave.firstPos.y + 1, z: grave.firstPos.z + 0.5 };
          const inventory = player?.getComponent("minecraft:inventory")?.container;
          for (const item of recoveredItems) {
            let leftover = item;
            if (inventory) {
              try { leftover = inventory.addItem(item); } catch (inventoryError) {
                ErrorReporter.report(inventoryError, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "recoverGraveInventory", category: "runtime" });
              }
            }
            if (leftover) dimension.spawnItem(leftover, recoveryPoint);
          }
          for (const chest of graveChests) {
            // Destruir el cofre reemplazándolo por aire (sin dropear el bloque cofre)
            chest.currentBlock.setType("minecraft:air");
          }
          
          // Eliminar de base de datos
          activeGraves.delete(matchingGraveId);
          persistActiveGraves();
          
          if (player) {
            player.sendMessage("§b§l[§3Tumba§b§l]§r §7Has recuperado los restos de tu tumba.");
            player.playSound("random.break");
          }
        } catch (err) {
          console.warn("[Tumba Exploit] Error en el procesado de rotura de tumba: " + err);
        } finally {
          pendingGraveRecoveries.delete(matchingGraveId);
        }
      });
    }
  });
  console.warn("[Tumba Exploit] Filtro de protección de cofres de tumbas activo.");
} catch (e) {
  console.warn("[Tumba Exploit] Error al registrar playerBreakBlock: " + e);
}

// Guardar la última posición conocida con granularidad alta y el inventario con menor frecuencia.
system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    if (player.isValid) {
      try {
        const health = player.getComponent("minecraft:health");
        // Solo guardamos si el jugador está vivo (vida > 0) para no sobreescribir la posición post-muerte
        if (health && health.currentValue > 0) {
          playerLastLocations.set(player.id, {
            x: player.location.x,
            y: player.location.y,
            z: player.location.z,
            dimension: player.dimension.id
          });
        }
      } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
        // Ignorar posibles errores al acceder a propiedades de un jugador desconectándose o en transición
      }
    }
  }
}, 20);

// Limpiar memoria al desconectarse el jugador
world.afterEvents.playerLeave.subscribe((event) => {
  playerLastLocations.delete(event.playerId);
  const warmup = pendingTeleportWarmups.get(event.playerId);
  if (warmup) {
    pendingTeleportWarmups.delete(event.playerId);
    try { system.clearRun(warmup.runId); } catch (e) {}
  }
  pvpCombatUntil.delete(event.playerId);
});

function isDeathInColiseum(loc) {
  if (!loc || !loc.dimension) return false;
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("home_spawn_addon", "world", "protecciones_db");
    if (!raw) return false;
    const zones = globalThis.__sqlite_read_json_v3__(raw, []);
    for (const zone of zones) {
      if ((zone.zoneType === "coliseum" || zone.isAdmin) && zone.dimension === loc.dimension) {
        if (loc.x >= zone.min.x && loc.x <= zone.max.x &&
            loc.y >= zone.min.y && loc.y <= zone.max.y &&
            loc.z >= zone.min.z && loc.z <= zone.max.z) {
          return true;
        }
      }
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  return false;
}

// Escuchador de muerte para almacenar coordenadas de tumba
try {
  world.afterEvents.entityDie.subscribe((event) => {
    const deadEntity = event.deadEntity;
    if (deadEntity && deadEntity.typeId === "minecraft:player") {
      try {
        // Obtener el nombre del jugador de forma 100% segura
        const matchedPlayer = world.getAllPlayers().find(p => p.id === deadEntity.id);
        const playerName = matchedPlayer ? matchedPlayer.name : undefined;
        if (!playerName) return;

        // Intentar obtener la ubicación desde el caché
        let loc = playerLastLocations.get(deadEntity.id);

        // Fallback en caso de que no esté en caché
        if (!loc) {
          try {
            if (deadEntity.isValid) {
              loc = {
                x: deadEntity.location.x,
                y: deadEntity.location.y,
                z: deadEntity.location.z,
                dimension: deadEntity.dimension.id
              };
            }
          } catch (err) { ErrorReporter.report(err, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
        }

        if (!loc) {
          console.warn("No se pudo obtener la ubicación de muerte para: " + playerName);
          return;
        }

        // Guardar coordenadas redondeadas
        const deathInfo = {
          x: Math.round(loc.x),
          y: Math.round(loc.y),
          z: Math.round(loc.z),
          dimension: loc.dimension,
          timestamp: Date.now(),
          xuid: String(matchedPlayer.xuid || "")
        };

        // Guardar en propiedades del mundo usando el nombre del jugador para persistencia real
        globalThis.__sqlite_set_prop_v2__("home_spawn_addon", "world", "death_" + playerName.toLowerCase(), JSON.stringify(deathInfo));

        if (isDeathInColiseum(loc)) {
          try {
            matchedPlayer.sendMessage("§b§l[§3Coliseo§b§l]§r §7Has muerto en el coliseo. Conservas tus objetos.");
          } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
          return;
        }

        const transfer = GRAVE_TRANSFER_SYSTEM_ENABLED ? prepareExactGraveTransfer(matchedPlayer) : undefined;
        if (transfer?.items?.length > 0) {
          const grave = createPlayerGrave(playerName, loc, transfer.items, (success, graveId) => {
            if (!success) {
              removeTrackedGrave(graveId, "transfer_failed");
              restoreExactGraveTransfer(matchedPlayer, transfer);
              try { matchedPlayer.sendMessage("§b§l[§3Tumba§b§l]§r §cNo se pudo confirmar la tumba; tus objetos fueron devueltos."); } catch (messageError) { ErrorReporter.report(messageError, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" }); }
              return;
            }
            try {
              matchedPlayer.sendMessage(
                `§b§l[§3Tumba§b§l]§r §7Se creó un §ecofer doble§7 con tus objetos en §aX:${grave.firstPos.x} §7Y:§a${grave.firstPos.y} §7Z:§a${grave.firstPos.z}§7. §8Expira en 10 minutos. §7Usa §e/s:tumbatp§7 para ir hacia ella.`
              );
            } catch (messageError) { ErrorReporter.report(messageError, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" }); }
          }, String(matchedPlayer.xuid || ""));
          if (!grave) restoreExactGraveTransfer(matchedPlayer, transfer);
        }
        
        // Notificación de chat silenciosa y privada
        try {
          matchedPlayer.sendMessage("§b§l[§3Tumba§b§l]§r §7Tu ubicación de muerte ha sido guardada. Usa §e/s:tumbatp§7 para ir directo a una tumba activa o §e/s:tumba§7 para ver coordenadas.");
        } catch (msgErr) { ErrorReporter.report(msgErr, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
      } catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
        console.warn("Error al registrar coordenadas de tumba: " + e);
      }
    }
  });
} catch (e) { ErrorReporter.report(e, { addonId: "home_spawn_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("Error al suscribirse a entityDie en home_spawn: " + e);
}
