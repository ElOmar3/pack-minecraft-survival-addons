import { ErrorReporter } from "./ErrorReporter.js";
import { CommandPermissionLevel, CustomCommandStatus, world, system } from "@minecraft/server";






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
globalThis.__sqlite_sync_complete_v2__.delete("lag_cleaner_addon");
globalThis.__sqlite_request_sync_v3__("lag_cleaner_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("lag_cleaner_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("lag_cleaner_addon", 1);
  } catch (e) {}
}, 120);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
console.warn("Lag Cleaner Addon iniciado.");
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

const CLEAN_INTERVAL_SECS = 20 * 60; // 20 minutos
const INITIAL_CLEAN_DELAY_SECS = CLEAN_INTERVAL_SECS + (7 * 60); // Desfase inicial de 7 minutos
const ENTITY_LIMIT_INTERVAL_SECS = 60;
const ENTITY_CELL_SIZE = 32;
const MAX_HOSTILE_MOBS_PER_CELL = 40;
const MAX_PASSIVE_MOBS_PER_CELL = 25;
const MAX_XP_ORBS_PER_CELL = 50;
const MAX_GROUND_ITEMS_PER_CELL = 100;

const HOSTILE_MOBS = new Set([
  "minecraft:blaze", "minecraft:bogged", "minecraft:breeze", "minecraft:cave_spider",
  "minecraft:creaking", "minecraft:creeper", "minecraft:drowned", "minecraft:elder_guardian", "minecraft:endermite",
  "minecraft:enderman", "minecraft:evoker", "minecraft:ghast", "minecraft:guardian",
  "minecraft:hoglin", "minecraft:husk", "minecraft:magma_cube", "minecraft:phantom",
  "minecraft:piglin", "minecraft:piglin_brute", "minecraft:pillager", "minecraft:ravager",
  "minecraft:shulker", "minecraft:silverfish", "minecraft:skeleton", "minecraft:slime",
  "minecraft:spider", "minecraft:stray", "minecraft:vex", "minecraft:vindicator",
  "minecraft:warden", "minecraft:witch", "minecraft:wither_skeleton", "minecraft:zoglin",
  "minecraft:zombie", "minecraft:zombie_villager"
]);
const PASSIVE_MOBS = new Set([
  "minecraft:allay", "minecraft:armadillo", "minecraft:axolotl", "minecraft:bee",
  "minecraft:camel", "minecraft:cat", "minecraft:chicken", "minecraft:cow",
  "minecraft:donkey", "minecraft:fox", "minecraft:frog", "minecraft:goat",
  "minecraft:horse", "minecraft:llama", "minecraft:mooshroom", "minecraft:mule",
  "minecraft:ocelot", "minecraft:panda", "minecraft:parrot", "minecraft:pig",
  "minecraft:polar_bear", "minecraft:rabbit", "minecraft:sheep", "minecraft:sniffer",
  "minecraft:snow_golem", "minecraft:turtle", "minecraft:wolf"
]);

function isShulkerBoxItemEntity(entity) {
  try {
    const itemComp = entity?.getComponent?.("minecraft:item") || entity?.getComponent?.("item");
    const typeId = String(itemComp?.itemStack?.typeId || "").toLowerCase();
    return typeId === "minecraft:shulker_box" || /^minecraft:[a-z_]+_shulker_box$/.test(typeId);
  } catch (error) {
    ErrorReporter.report(error, { addonId: "lag_cleaner_addon", moduleId: "main.js", operation: "inspectGroundItem", category: "runtime" });
    return false;
  }
}

function isProtectedEntity(entity) {
  try {
    if (String(entity?.nameTag || "").trim()) return true;
    const tameable = entity?.getComponent?.("minecraft:tameable");
    if (tameable?.isTamed === true) return true;
    const leashable = entity?.getComponent?.("minecraft:leashable");
    if (leashable?.isLeashed === true) return true;
    return false;
  } catch (error) {
    ErrorReporter.report(error, { addonId: "lag_cleaner_addon", moduleId: "main.js", operation: "inspectProtectedEntity", category: "runtime" });
    return true;
  }
}

function entityLimitCategory(entity) {
  const typeId = String(entity?.typeId || "");
  if (typeId === "minecraft:xp_orb") return "xp";
  if (typeId === "minecraft:item") return isShulkerBoxItemEntity(entity) ? "protected" : "item";
  if (isProtectedEntity(entity) || typeId === "minecraft:villager" || typeId === "minecraft:wandering_trader") return "protected";
  if (HOSTILE_MOBS.has(typeId)) return "hostile";
  if (PASSIVE_MOBS.has(typeId)) return "passive";
  return "protected";
}

function entityCellKey(entity) {
  const location = entity?.location;
  if (!location) return "";
  return `${Math.floor(location.x / ENTITY_CELL_SIZE)}:${Math.floor(location.z / ENTITY_CELL_SIZE)}`;
}

function limitFarmEntities() {
  const dimensions = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];
  const limits = { hostile: MAX_HOSTILE_MOBS_PER_CELL, passive: MAX_PASSIVE_MOBS_PER_CELL, xp: MAX_XP_ORBS_PER_CELL, item: MAX_GROUND_ITEMS_PER_CELL };
  const counts = new Map();
  const removed = { hostile: 0, passive: 0, xp: 0, item: 0 };
  for (const dimId of dimensions) {
    try {
      const entities = world.getDimension(dimId).getEntities();
      for (const entity of entities) {
        const category = entityLimitCategory(entity);
        if (!(category in limits)) continue;
        const cell = entityCellKey(entity);
        if (!cell) continue;
        const key = `${dimId}:${category}:${cell}`;
        const count = (counts.get(key) || 0) + 1;
        counts.set(key, count);
        if (count <= limits[category]) continue;
        try {
          entity.remove();
          removed[category]++;
        } catch (error) {
          ErrorReporter.report(error, { addonId: "lag_cleaner_addon", moduleId: "main.js", operation: "removeExcessEntity", category: "runtime" });
        }
      }
    } catch (error) {
      ErrorReporter.report(error, { addonId: "lag_cleaner_addon", moduleId: "main.js", operation: "scanEntityLimits", category: "runtime" });
    }
  }
  const total = Object.values(removed).reduce((sum, value) => sum + value, 0);
  if (total) console.warn(`[Lag Cleaner] Límite de granjas: ${total} eliminadas (hostiles=${removed.hostile}, pasivas=${removed.passive}, xp=${removed.xp}, items=${removed.item}).`);
  return removed;
}

// Función de Limpieza de items en el suelo
function cleanGroundItems() {
  const dimensions = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];
  let totalRemoved = 0;
  
  for (const dimId of dimensions) {
    try {
      const dim = world.getDimension(dimId);
      // OBTENEMOS EXCLUSIVAMENTE entidades tipo minecraft:item (items tirados)
      const items = dim.getEntities({ type: "minecraft:item" });
      
      for (const item of items) {
        // Las shulkers pueden contener inventario: nunca se eliminan al caer al suelo.
        if (isShulkerBoxItemEntity(item)) continue;
        item.remove();
        totalRemoved++;
      }
    } catch (error) { ErrorReporter.report(error, { addonId: "lag_cleaner_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn(`Error limpiando la dimensión ${dimId}: ${error}`);
    }
  }
  return totalRemoved;
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
      register({ name: `${COMMAND_NAMESPACE}:limpiar`, description: "Fuerza limpieza de items", permissionLevel: ADMIN_PERMISSION }, (origin) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        system.run(() => {
          const isOp = (typeof sender.isOp === "function" ? sender.isOp() : sender.isOp === true) || sender.hasTag("op") || sender.hasTag("admin");
          if (!isOp) return sender.sendMessage("§b§l[§3Limpieza§b§l]§r §cSolo los operadores pueden usar este comando.");
          const cleared = cleanGroundItems();
          world.sendMessage(`§b§l[§3Limpieza§b§l]§r §7Limpieza forzada. Se eliminaron §e${cleared} §7objetos del suelo.`);
        });
        return commandOk("Procesando limpieza.");
      });
    } catch (e) { ErrorReporter.report(e, { addonId: "lag_cleaner_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Lag Cleaner Addon] Error registrando custom commands: " + e);
    }
  });
}

registerCustomCommands();

function scheduleCleanup(delaySeconds) {
  if (delaySeconds > 60) {
    system.runTimeout(() => {
      world.sendMessage("§b§l[§3Limpieza§b§l]§r §7Limpieza de suelo en §e60 segundos§7.");
    }, (delaySeconds - 60) * 20);
  }

  if (delaySeconds > 10) {
    system.runTimeout(() => {
      world.sendMessage("§b§l[§3Limpieza§b§l]§r §7Limpieza de suelo en §c10 segundos§7.");
    }, (delaySeconds - 10) * 20);
  }

  const cleanDelayTicks = Math.max(20, Math.floor(delaySeconds * 20));
  system.runTimeout(() => {
    const cleared = cleanGroundItems();
    world.sendMessage(`§b§l[§3Limpieza§b§l]§r §7Limpieza completada. Se eliminaron §e${cleared} §7objetos del suelo.`);
    scheduleCleanup(CLEAN_INTERVAL_SECS);
  }, cleanDelayTicks);
}

scheduleCleanup(INITIAL_CLEAN_DELAY_SECS);
system.runInterval(limitFarmEntities, ENTITY_LIMIT_INTERVAL_SECS * 20);

// Manejador alternativo por /scriptevent
try {
  if (system && system.afterEvents && system.afterEvents.scriptEventReceive && typeof system.afterEvents.scriptEventReceive.subscribe === "function") {
    system.afterEvents.scriptEventReceive.subscribe((event) => {
      if (event.id !== "cmd") return;
      const message = String(event.message || "").trim().toLowerCase();
      if (message === "limpiar") {
        const sender = event.sourceEntity;
        if (!sender || sender.typeId !== "minecraft:player") return;
        
        system.run(async () => {
          const isOp = (typeof sender.isOp === "function" ? sender.isOp() : sender.isOp === true) || sender.hasTag("op") || sender.hasTag("admin");
          
          if (!isOp) {
            sender.sendMessage("§b§l[§3Limpieza§b§l]§r §cSolo los operadores pueden usar este comando.");
            return;
          }
          
          const cleared = cleanGroundItems();
          world.sendMessage(`§b§l[§3Limpieza§b§l]§r §7Limpieza forzada. Se eliminaron §e${cleared} §7objetos del suelo.`);
        });
      }
    });
  }
} catch (e) { ErrorReporter.report(e, { addonId: "lag_cleaner_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Lag Cleaner Addon] ScriptEvent listener error: " + e);
}
