import { ErrorReporter } from "./ErrorReporter.js";
import { CommandPermissionLevel, CustomCommandStatus, PlayerPermissionLevel, world, system, ItemStack, EquipmentSlot, EnchantmentTypes } from "@minecraft/server";
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
globalThis.__sqlite_sync_complete_v2__.delete("horde_event_addon");
globalThis.__sqlite_request_sync_v3__("horde_event_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("horde_event_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("horde_event_addon", 1);
  } catch (e) {}
}, 120);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
const COMMAND_NAMESPACE = "s";
const PREFIX = "§b§l[§3Horda§b§l]§r";
const ADMIN_PERMISSION =
  CommandPermissionLevel.GameDirectors ??
  CommandPermissionLevel.Admin ??
  CommandPermissionLevel.Host ??
  CommandPermissionLevel.Owner ??
  CommandPermissionLevel.Any;

function commandOk(message) { return { status: CustomCommandStatus.Success, message }; }
function commandError(message) { return { status: CustomCommandStatus.Failure, message }; }

console.warn("Horde Event Addon iniciado.");

const CHECK_INTERVAL_SECS = 3 * 60 * 60; // 3 horas
const INITIAL_CHECK_DELAY_SECS = CHECK_INTERVAL_SECS + (33 * 60); // Desfase inicial de 33 minutos
const ADDON_CONTEXT = { addonId: "horde_event_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" };
const MIN_WORLD_Y = -64;
const MAX_WORLD_Y = 319;
const HORDE_SPAWN_KEYS = {
  x: "horde_spawn_x",
  y: "horde_spawn_y",
  z: "horde_spawn_z",
  dimension: "horde_spawn_dimension"
};
const HORDE_REWARDS_KEY = "horde_rewards";
// Estado persistente de expediciones: exclusivamente a través del puente SQLite.
// No se usan propiedades dinámicas, scoreboards ni tags como almacenamiento.
const EXPEDITION_ARENA_KEY = "expedition_arena_v1";
const EXPEDITION_START_BUTTON_KEY = "expedition_start_button_v1";
const EXPEDITION_STATE_KEY = "expedition_state_v1";
const EXPEDITION_PENDING_REWARDS_KEY = "expedition_pending_rewards_v1";
const EXPEDITION_LEADERBOARD_KEY = "expedition_hall_of_fame_v1";
const EXPEDITION_PLAYER_STATS_KEY = "expedition_stats_v1";
const EXPEDITION_RADIUS = 32;
const EXPEDITION_DURATION_MS = 30 * 60 * 1000;
const EXPEDITION_AUTO_CHECK_TICKS = 10 * 60 * 20;
const EXPEDITION_AUTO_MIN_PLAYERS = 2;
const EXPEDITION_BUTTON_BIND_TIMEOUT_MS = 60 * 1000;
const EXPEDITION_STATUS_INTERVAL_TICKS = 20;
// Sin Wither: puede alterar la arena o sus alrededores. La Dragona se permite
// sólo en el End, donde pertenece. Estos perfiles hacen que cada raid se juegue
// de forma distinta. La resistencia vuelve significativa la vida extra.
const EXPEDITION_BOSS_PROFILES = Object.freeze([
  {
    id: "end_dragon",
    entityType: "minecraft:ender_dragon",
    name: "§d§lDragona del Fin",
    label: "§dDragona del Fin",
    difficulty: "§4§l★★★★★★",
    healthBoost: 8,
    resistance: 1,
    strength: 0,
    speed: 0,
    scanRadius: 192,
    allowedDimensions: ["minecraft:the_end"],
    cooldownMs: 24 * 60 * 60 * 1000,
    phases: [
      { threshold: 0.66, name: "Aliento del Fin", effects: [["minecraft:regeneration", 1], ["minecraft:resistance", 2]], summons: [{ typeId: "minecraft:shulker", count: 3, healthBoost: 2, resistance: 1 }] },
      { threshold: 0.33, name: "Furia dracónica", effects: [["minecraft:regeneration", 2], ["minecraft:resistance", 3]], summons: [{ typeId: "minecraft:shulker", count: 5, healthBoost: 3, resistance: 1 }] }
    ],
    rewards: [
      { itemId: "minecraft:nether_star", amount: 1 },
      { itemId: "minecraft:dragon_breath", amount: 16 },
      { itemId: "minecraft:enchanted_golden_apple", amount: 1 }
    ],
    equipment: []
  },
  {
    id: "void_warden",
    entityType: "minecraft:warden",
    name: "§5§lGuardián del Vacío",
    label: "§5Guardián del Vacío",
    difficulty: "§c★★★★★",
    healthBoost: 8,
    resistance: 1,
    strength: 0,
    speed: 0,
    scanRadius: 48,
    cooldownMs: 8 * 60 * 60 * 1000,
    phases: [
      { threshold: 0.65, name: "Eco ensordecedor", effects: [["minecraft:speed", 1], ["minecraft:resistance", 2]], summons: [{ typeId: "minecraft:husk", count: 5, healthBoost: 4, resistance: 1, strength: 1 }] },
      { threshold: 0.30, name: "Furia del abismo", effects: [["minecraft:strength", 2], ["minecraft:speed", 2], ["minecraft:resistance", 3]], summons: [{ typeId: "minecraft:husk", count: 8, healthBoost: 5, resistance: 1, strength: 2 }] }
    ],
    rewards: [
      { itemId: "minecraft:echo_shard", amount: 8 },
      { itemId: "minecraft:diamond", amount: 8 },
      { itemId: "minecraft:enchanted_golden_apple", amount: 1 }
    ],
    equipment: []
  },
  {
    id: "iron_colossus",
    entityType: "minecraft:hoglin",
    name: "§6§lColoso de Ceniza",
    label: "§6Coloso de Ceniza",
    difficulty: "§c★★★★★",
    healthBoost: 28,
    resistance: 2,
    strength: 2,
    speed: 1,
    scanRadius: 48,
    cooldownMs: 4 * 60 * 60 * 1000,
    phases: [
      { threshold: 0.65, name: "Embestida de ceniza", effects: [["minecraft:speed", 2], ["minecraft:strength", 3]], summons: [{ typeId: "minecraft:piglin", count: 4, healthBoost: 3, resistance: 1, strength: 1 }] },
      { threshold: 0.30, name: "Piel impenetrable", effects: [["minecraft:resistance", 3], ["minecraft:strength", 4]], summons: [{ typeId: "minecraft:piglin", count: 6, healthBoost: 4, resistance: 1, strength: 2 }] }
    ],
    rewards: [
      { itemId: "minecraft:ancient_debris", amount: 3 },
      { itemId: "minecraft:golden_apple", amount: 8 },
      { itemId: "minecraft:diamond", amount: 6 }
    ],
    equipment: []
  },
  {
    id: "storm_archmage",
    entityType: "minecraft:evocation_illager",
    name: "§b§lArchimago de la Tormenta",
    label: "§bArchimago de la Tormenta",
    difficulty: "§c★★★★☆",
    healthBoost: 30,
    resistance: 2,
    strength: 1,
    speed: 1,
    scanRadius: 48,
    cooldownMs: 4 * 60 * 60 * 1000,
    phases: [
      { threshold: 0.65, name: "Tormenta de colmillos", effects: [["minecraft:regeneration", 1], ["minecraft:speed", 2]], summons: [{ typeId: "minecraft:vex", count: 4, healthBoost: 2, resistance: 1 }] },
      { threshold: 0.30, name: "Ritual final", effects: [["minecraft:regeneration", 2], ["minecraft:resistance", 3]], summons: [{ typeId: "minecraft:vex", count: 6, healthBoost: 3, resistance: 1, strength: 1 }] }
    ],
    rewards: [
      { itemId: "minecraft:totem_of_undying", amount: 1 },
      { itemId: "minecraft:enchanted_book", amount: 2 },
      { itemId: "minecraft:emerald", amount: 24 }
    ],
    equipment: []
  },
  {
    id: "nether_executioner",
    entityType: "minecraft:piglin_brute",
    name: "§4§lVerdugo del Nether",
    label: "§4Verdugo del Nether",
    difficulty: "§c★★★★★",
    healthBoost: 24,
    resistance: 2,
    strength: 3,
    speed: 1,
    scanRadius: 48,
    cooldownMs: 6 * 60 * 60 * 1000,
    phases: [
      { threshold: 0.65, name: "Marcha de guerra", effects: [["minecraft:speed", 2], ["minecraft:strength", 4]], summons: [{ typeId: "minecraft:wither_skeleton", count: 4, healthBoost: 3, resistance: 1, strength: 1 }] },
      { threshold: 0.30, name: "Último veredicto", effects: [["minecraft:resistance", 3], ["minecraft:strength", 5], ["minecraft:regeneration", 1]], summons: [{ typeId: "minecraft:wither_skeleton", count: 6, healthBoost: 4, resistance: 1, strength: 2 }] }
    ],
    rewards: [
      { itemId: "minecraft:netherite_ingot", amount: 2 },
      { itemId: "minecraft:diamond", amount: 12 },
      { itemId: "minecraft:enchanted_golden_apple", amount: 1 }
    ],
    equipment: [
      { slot: "head", itemId: "minecraft:netherite_helmet", enchantments: [["protection", 4], ["unbreaking", 3], ["vanishing", 1]] },
      { slot: "chest", itemId: "minecraft:netherite_chestplate", enchantments: [["protection", 4], ["unbreaking", 3], ["vanishing", 1]] },
      { slot: "legs", itemId: "minecraft:netherite_leggings", enchantments: [["protection", 4], ["unbreaking", 3], ["vanishing", 1]] },
      { slot: "feet", itemId: "minecraft:netherite_boots", enchantments: [["protection", 4], ["unbreaking", 3], ["vanishing", 1]] },
      { slot: "mainhand", itemId: "minecraft:netherite_axe", enchantments: [["sharpness", 5], ["unbreaking", 3], ["vanishing", 1]] }
    ]
  }
]);
const EXPEDITION_AFFIXES = Object.freeze([
  { id: "ironclad", label: "§7Coraza de hierro", resistanceBonus: 1, helperBonus: 0, rewards: [{ itemId: "minecraft:iron_block", amount: 4 }] },
  { id: "berserk", label: "§cFuria", strengthBonus: 1, speedBonus: 1, helperBonus: 0, rewards: [{ itemId: "minecraft:golden_apple", amount: 3 }] },
  { id: "vampiric", label: "§5Vampírico", regenerationBonus: 1, helperBonus: 0, rewards: [{ itemId: "minecraft:experience_bottle", amount: 12 }] },
  { id: "swarm", label: "§2Enjambre", helperBonus: 2, rewards: [{ itemId: "minecraft:emerald", amount: 12 }] }
]);
const APOCALYPSE_MOB_TAG = "zombie_apocalypse_mob";
const APOCALYPSE_WAVE_SIZES = [16, 24, 32, 40, 48];
const APOCALYPSE_KILL_REWARD = 100;
const MONEY_OBJECTIVE = "money";
const DEFAULT_REWARDS = [
  { itemId: "minecraft:diamond", amount: 8 },
  { itemId: "minecraft:golden_apple", amount: 3 },
  { itemId: "minecraft:enchanted_book", amount: 1 },
  { itemId: "minecraft:iron_ingot", amount: 16 },
  { itemId: "minecraft:emerald", amount: 12 }
];

let activeHorde = {
  active: false,
  wave: 0,
  waitingForLoadedSpawn: false
};

let activeApocalypse = {
  active: false,
  wave: 0,
  waitingForLoadedSpawn: false
};
const expeditionButtonBindRequests = new Map();
const expeditionDamageBuffer = new Map();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function toBlockLocation(location) {
  return {
    x: Math.floor(location.x),
    y: clamp(Math.floor(location.y), MIN_WORLD_Y, MAX_WORLD_Y),
    z: Math.floor(location.z)
  };
}

function isLocationLoaded(dimension, location) {
  if (!dimension || !location) return false;
  try {
    const blockLocation = toBlockLocation(location);
    if (typeof dimension.isChunkLoaded === "function") {
      return dimension.isChunkLoaded(blockLocation);
    }
    return !!dimension.getBlock(blockLocation);
  } catch {
    return false;
  }
}

function reportRuntimeError(error) {
  ErrorReporter.report(error, ADDON_CONTEXT);
}

function isAdminPlayer(player) {
  if (!player) return false;
  try {
    if (player.playerPermissionLevel === PlayerPermissionLevel.Operator) return true;
  } catch (e) {}
  try {
    return player.hasTag("op") || player.hasTag("admin");
  } catch (e) {
    return false;
  }
}

function normalizeItemId(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return undefined;
  return raw.includes(":") ? raw : `minecraft:${raw}`;
}

function normalizeReward(reward) {
  const itemId = normalizeItemId(reward?.itemId);
  const amount = clamp(Math.floor(Number(reward?.amount) || 1), 1, 64);
  if (!itemId) return undefined;
  return { itemId, amount };
}

function getConfiguredRewards() {
  const raw = globalThis.__sqlite_get_prop_v2__("horde_event_addon", "world", HORDE_REWARDS_KEY);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const rewards = parsed.map(normalizeReward).filter(Boolean).slice(0, 20);
        if (rewards.length > 0) return rewards;
      }
    } catch (e) {
      reportRuntimeError(e);
    }
  }
  return DEFAULT_REWARDS.map(reward => ({ ...reward }));
}

function setConfiguredRewards(rewards) {
  const normalized = rewards.map(normalizeReward).filter(Boolean).slice(0, 20);
  globalThis.__sqlite_set_prop_v2__("horde_event_addon", "world", HORDE_REWARDS_KEY, JSON.stringify(normalized.length > 0 ? normalized : DEFAULT_REWARDS));
}

function formatRewardLines(rewards = getConfiguredRewards()) {
  return rewards.map(reward => `${reward.itemId} ${reward.amount}`).join("; ");
}

function parseRewardsInput(input) {
  return String(input || "")
    .split(/[;\n]/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const match = part.match(/^([a-z0-9_:-]+)\s*(?:x|\s)?\s*(\d+)?$/i);
      if (!match) return undefined;
      return normalizeReward({ itemId: match[1], amount: match[2] || 1 });
    })
    .filter(Boolean);
}

function getConfiguredHordeSpawn() {
  const x = toNumber(globalThis.__sqlite_get_prop_v2__("horde_event_addon", "world", HORDE_SPAWN_KEYS.x));
  const y = toNumber(globalThis.__sqlite_get_prop_v2__("horde_event_addon", "world", HORDE_SPAWN_KEYS.y));
  const z = toNumber(globalThis.__sqlite_get_prop_v2__("horde_event_addon", "world", HORDE_SPAWN_KEYS.z));
  const dimId = globalThis.__sqlite_get_prop_v2__("horde_event_addon", "world", HORDE_SPAWN_KEYS.dimension);
  if (x === undefined || y === undefined || z === undefined || !dimId) return undefined;
  return { location: { x, y: clamp(y, MIN_WORLD_Y, MAX_WORLD_Y), z }, dimension: world.getDimension(String(dimId)) };
}

function saveHordeLocation(player) {
  const loc = toBlockLocation(player.location);
  globalThis.__sqlite_set_prop_v2__("horde_event_addon", "world", HORDE_SPAWN_KEYS.x, loc.x);
  globalThis.__sqlite_set_prop_v2__("horde_event_addon", "world", HORDE_SPAWN_KEYS.y, loc.y);
  globalThis.__sqlite_set_prop_v2__("horde_event_addon", "world", HORDE_SPAWN_KEYS.z, loc.z);
  globalThis.__sqlite_set_prop_v2__("horde_event_addon", "world", HORDE_SPAWN_KEYS.dimension, player.dimension.id);
  player.sendMessage(`${PREFIX} §aLugar de la horda guardado en §f${loc.x}, ${loc.y}, ${loc.z} §7(${player.dimension.id})§a.`);
}

// 1. Obtener ubicación de spawn activa
function getSpawnLocation(requireLoaded = false) {
  const configured = getConfiguredHordeSpawn();
  if (configured) {
    if (requireLoaded && !isLocationLoaded(configured.dimension, configured.location)) return undefined;
    return configured;
  }

  const x = toNumber(globalThis.__sqlite_get_prop_v2__("horde_event_addon", "world", "spawn_x"));
  const y = toNumber(globalThis.__sqlite_get_prop_v2__("horde_event_addon", "world", "spawn_y"));
  const z = toNumber(globalThis.__sqlite_get_prop_v2__("horde_event_addon", "world", "spawn_z"));
  const dimId = globalThis.__sqlite_get_prop_v2__("horde_event_addon", "world", "spawn_dimension") ?? "minecraft:overworld";
  
  if (x !== undefined && y !== undefined && z !== undefined) {
    const dimension = world.getDimension(dimId);
    const location = { x, y: clamp(y, MIN_WORLD_Y, MAX_WORLD_Y), z };
    if (requireLoaded && !isLocationLoaded(dimension, location)) return undefined;
    return { location, dimension };
  }
  const defaultSpawn = world.getDefaultSpawnLocation();
  const dimension = world.getDimension("minecraft:overworld");
  
  let validY = defaultSpawn.y;
  if (validY > MAX_WORLD_Y) {
    validY = 70;
    if (isLocationLoaded(dimension, { x: defaultSpawn.x, y: 70, z: defaultSpawn.z })) {
      for (let tempY = MAX_WORLD_Y; tempY > MIN_WORLD_Y; tempY--) {
        try {
          const block = dimension.getBlock({ x: defaultSpawn.x, y: tempY, z: defaultSpawn.z });
          if (block && !block.isAir) {
            validY = tempY;
            break;
          }
        } catch (e) {
          reportRuntimeError(e);
        }
      }
    }
  }
  
  const location = { x: defaultSpawn.x, y: clamp(validY, MIN_WORLD_Y, MAX_WORLD_Y), z: defaultSpawn.z };
  if (requireLoaded && !isLocationLoaded(dimension, location)) return undefined;
  return { location, dimension };
}

function getLoadedSpawnLocation() {
  return getSpawnLocation(true);
}

function getSpawnCandidate(dimension, candidate, fallback) {
  if (isLocationLoaded(dimension, candidate)) return candidate;
  if (isLocationLoaded(dimension, fallback)) return fallback;
  return undefined;
}

function addRewardsToContainer(container) {
  for (const reward of getConfiguredRewards()) {
    try {
      container.addItem(new ItemStack(reward.itemId, reward.amount));
    } catch (e) {
      reportRuntimeError(e);
      console.warn(`[Horda] Recompensa inválida omitida: ${reward.itemId} ${reward.amount}`);
    }
  }
}

function getEnchantmentType(id) {
  try {
    return EnchantmentTypes.get(id) || EnchantmentTypes.get(`minecraft:${id}`);
  } catch {
    return undefined;
  }
}

function createEnchantedItem(typeId, enchantments) {
  const item = new ItemStack(typeId);
  const enchantable = item.getComponent("minecraft:enchantable");
  if (!enchantable) return item;
  for (const [id, level] of enchantments) {
    try {
      const type = getEnchantmentType(id);
      if (type) enchantable.addEnchantment({ type, level });
    } catch (error) {
      reportRuntimeError(error);
    }
  }
  return item;
}

function equipApocalypseZombie(entity) {
  const equippable = entity.getComponent("minecraft:equippable");
  if (!equippable) return;
  // Maldición de desaparición evita que el evento inunde la economía con netherita.
  const armor = [["protection", 4], ["unbreaking", 3], ["vanishing", 1]];
  equippable.setEquipment(EquipmentSlot.Head, createEnchantedItem("minecraft:netherite_helmet", [...armor, ["respiration", 3]]));
  equippable.setEquipment(EquipmentSlot.Chest, createEnchantedItem("minecraft:netherite_chestplate", armor));
  equippable.setEquipment(EquipmentSlot.Legs, createEnchantedItem("minecraft:netherite_leggings", armor));
  equippable.setEquipment(EquipmentSlot.Feet, createEnchantedItem("minecraft:netherite_boots", [...armor, ["feather_falling", 4]]));
  equippable.setEquipment(EquipmentSlot.Mainhand, createEnchantedItem("minecraft:netherite_sword", [["sharpness", 5], ["unbreaking", 3], ["knockback", 1], ["vanishing", 1]]));
}

function payApocalypseKillReward(player) {
  try {
    const objective = world.scoreboard.getObjective(MONEY_OBJECTIVE);
    if (!objective) return false;
    const current = Number(objective.getScore(player)) || 0;
    objective.setScore(player, Math.min(2147483647, current + APOCALYPSE_KILL_REWARD));
    player.onScreenDisplay.setActionBar(`§a+$${APOCALYPSE_KILL_REWARD} §7por zombi del apocalipsis`);
    return true;
  } catch (error) {
    reportRuntimeError(error);
    return false;
  }
}

// 2. Colocar e inicializar el cofre de botín
function spawnLootChest(info) {
  if (!info?.dimension || !info?.location) return false;
  const loc = { 
    x: Math.floor(info.location.x), 
    y: clamp(Math.floor(info.location.y) + 1, MIN_WORLD_Y, MAX_WORLD_Y), 
    z: Math.floor(info.location.z) 
  };
  const dim = info.dimension;

  if (!isLocationLoaded(dim, loc)) {
    console.warn(`[Horda] Cofre omitido porque el chunk no está cargado: ${loc.x}, ${loc.y}, ${loc.z}`);
    return false;
  }
  
  try {
    const chestBlock = dim.getBlock(loc);
    if (!chestBlock) return false;
    chestBlock.setType("minecraft:chest");
    
    system.runTimeout(() => {
      try {
        if (!isLocationLoaded(dim, loc)) return;
        const container = dim.getBlock(loc)?.getComponent("minecraft:inventory")?.container;
        if (container) {
          addRewardsToContainer(container);
        }
      } catch (e) {
        reportRuntimeError(e);
        console.warn("Error rellenando cofre: " + e);
      }
    }, 5);
    return true;
  } catch (error) {
    reportRuntimeError(error);
    console.warn("Error colocando cofre: " + error);
    return false;
  }
}

// 3. Invocar Olas de la Horda
function spawnWave(waveNum, info = getLoadedSpawnLocation()) {
  if (!info) {
    if (!activeHorde.waitingForLoadedSpawn) {
      console.warn("[Horda] Spawn no cargado; no se invocan mobs hasta que el chunk esté cargado.");
    }
    activeHorde.waitingForLoadedSpawn = true;
    return false;
  }
  activeHorde.waitingForLoadedSpawn = false;
  world.sendMessage(`§b§l[§3Horda§b§l]§r §7¡Ola §e${waveNum}/3 §7de la invasión apareciendo!`);
  
  const count = waveNum === 1 ? 8 : (waveNum === 2 ? 10 : 5);
  const types = waveNum === 1 ? ["minecraft:zombie"] : (waveNum === 2 ? ["minecraft:skeleton", "minecraft:zombie"] : ["minecraft:zombie", "minecraft:zombified_piglin"]);
  let spawned = 0;
  
  for (let i = 0; i < count; i++) {
    const angle = (i * 2 * Math.PI) / count;
    const radius = 6;
    const spawnX = info.location.x + Math.cos(angle) * radius;
    const spawnZ = info.location.z + Math.sin(angle) * radius;
    const spawnY = info.location.y;
    
    const type = types[i % types.length];
    
    try {
      const spawnLocation = getSpawnCandidate(info.dimension, { x: spawnX, y: spawnY, z: spawnZ }, info.location);
      if (!spawnLocation) continue;
      const entity = info.dimension.spawnEntity(type, spawnLocation);
      entity.addTag("horde_mob");
      spawned++;
      
      const equippable = entity.getComponent("minecraft:equippable");
      if (equippable) {
        if (waveNum === 1) {
          equippable.setEquipment(EquipmentSlot.Head, new ItemStack("minecraft:iron_helmet"));
          equippable.setEquipment(EquipmentSlot.Mainhand, new ItemStack("minecraft:iron_sword"));
        } else if (waveNum === 2) {
          equippable.setEquipment(EquipmentSlot.Head, new ItemStack("minecraft:chainmail_helmet"));
          equippable.setEquipment(EquipmentSlot.Chest, new ItemStack("minecraft:chainmail_chestplate"));
        } else if (waveNum === 3) {
          equippable.setEquipment(EquipmentSlot.Head, new ItemStack("minecraft:diamond_helmet"));
          equippable.setEquipment(EquipmentSlot.Chest, new ItemStack("minecraft:diamond_chestplate"));
          equippable.setEquipment(EquipmentSlot.Mainhand, new ItemStack("minecraft:diamond_sword"));
        }
      }
      
      if (waveNum === 3) {
        entity.addEffect("health_boost", 99999, { amplifier: 4 });
        entity.addEffect("instant_health", 20, { amplifier: 10 });
        entity.addEffect("strength", 99999, { amplifier: 1 });
      }
    } catch (err) {
      reportRuntimeError(err);
      console.warn(`Error al invocar mob de horda: ${err}`);
    }
  }

  if (spawned === 0) {
    if (!activeHorde.waitingForLoadedSpawn) {
      console.warn("[Horda] No se pudo invocar ningún mob porque no había posiciones cargadas.");
    }
    activeHorde.waitingForLoadedSpawn = true;
    return false;
  }
  return true;
}

function spawnApocalypseWave(waveNum, info = getLoadedSpawnLocation()) {
  if (!info) {
    if (!activeApocalypse.waitingForLoadedSpawn) console.warn("[Apocalipsis] Spawn no cargado; no se invocan zombis hasta que el chunk esté cargado.");
    activeApocalypse.waitingForLoadedSpawn = true;
    return false;
  }

  activeApocalypse.waitingForLoadedSpawn = false;
  const count = APOCALYPSE_WAVE_SIZES[waveNum - 1];
  world.sendMessage(`${PREFIX} §2§lAPOCALIPSIS ZOMBIE§r §7— Ola §e${waveNum}/${APOCALYPSE_WAVE_SIZES.length} §7: §c${count} zombis de netherita se acercan.`);
  let spawned = 0;
  for (let i = 0; i < count; i++) {
    const angle = (i * 2 * Math.PI) / count;
    const radius = 10 + Math.floor(i / 12) * 3;
    const candidate = { x: info.location.x + Math.cos(angle) * radius, y: info.location.y, z: info.location.z + Math.sin(angle) * radius };
    try {
      const spawnLocation = getSpawnCandidate(info.dimension, candidate, info.location);
      if (!spawnLocation) continue;
      const zombie = info.dimension.spawnEntity("minecraft:zombie", spawnLocation);
      zombie.addTag(APOCALYPSE_MOB_TAG);
      zombie.nameTag = `§2§lZombi del Apocalipsis §7[Ola ${waveNum}]`;
      equipApocalypseZombie(zombie);
      zombie.addEffect("health_boost", 20 * 60 * 30, { amplifier: Math.min(3, waveNum - 1) });
      zombie.addEffect("speed", 20 * 60 * 30, { amplifier: waveNum >= 4 ? 1 : 0 });
      if (waveNum >= 3) zombie.addEffect("strength", 20 * 60 * 30, { amplifier: waveNum >= 5 ? 2 : 1 });
      spawned++;
    } catch (error) {
      reportRuntimeError(error);
      console.warn(`[Apocalipsis] Error al invocar zombi: ${error}`);
    }
  }
  if (spawned === 0) {
    activeApocalypse.waitingForLoadedSpawn = true;
    return false;
  }
  return true;
}

function startZombieApocalypse() {
  if (activeHorde.active || activeApocalypse.active) return false;
  const info = getLoadedSpawnLocation();
  if (!info) {
    console.warn("[Apocalipsis] Evento no iniciado: el lugar configurado no está cargado/tickeando.");
    return false;
  }
  activeApocalypse.active = true;
  activeApocalypse.wave = 1;
  activeApocalypse.waitingForLoadedSpawn = false;
  world.sendMessage(`${PREFIX} §4§l¡EL APOCALIPSIS ZOMBIE HA COMENZADO!§r §cCada zombi derrotado entrega §a$${APOCALYPSE_KILL_REWARD}§c. Defiendan la zona.`);
  const started = spawnApocalypseWave(1, info);
  if (!started) {
    activeApocalypse.active = false;
    activeApocalypse.wave = 0;
  }
  return started;
}

function endZombieApocalypse() {
  activeApocalypse.active = false;
  activeApocalypse.wave = 0;
  activeApocalypse.waitingForLoadedSpawn = false;
  world.sendMessage(`${PREFIX} §a§l¡Apocalipsis zombie superado!§r §7Los supervivientes han detenido las cinco oleadas.`);
}

// 4. Iniciar y finalizar el evento
function startHordeEvent() {
  if (activeHorde.active) return false;
  const info = getLoadedSpawnLocation();
  if (!info) {
    console.warn("[Horda] Evento no iniciado: el chunk del spawn no está cargado/tickeando.");
    return false;
  }
  activeHorde.active = true;
  activeHorde.wave = 1;
  activeHorde.waitingForLoadedSpawn = false;
  world.sendMessage("§b§l[§3Horda§b§l]§r §c¡CUIDADO! Una Horda de Monstruos está invadiendo el Spawn del servidor.");
  const started = spawnWave(1, info);
  if (!started) {
    activeHorde.active = false;
    activeHorde.wave = 0;
  }
  return started;
}

function endHorde() {
  activeHorde.active = false;
  activeHorde.wave = 0;
  activeHorde.waitingForLoadedSpawn = false;
  const info = getLoadedSpawnLocation();
  world.sendMessage(`${PREFIX} §a¡Invasión completada con éxito! Ha aparecido un cofre con botín en el lugar de la horda.`);
  if (!spawnLootChest(info)) {
    console.warn("[Horda] No se pudo colocar el cofre porque el spawn no está cargado.");
  }
}

function getHordeConfigSummary() {
  const configured = getConfiguredHordeSpawn();
  const locText = configured
    ? `§7Lugar: §f${configured.location.x}, ${configured.location.y}, ${configured.location.z} §7(${configured.dimension.id})`
    : "§7Lugar: §fSpawn por defecto";
  return `${locText}\n§7Recompensa: §f${formatRewardLines()}`;
}

function showAdminHordeMenu(player, bypassPermission = false) {
  if (!bypassPermission && !isAdminPlayer(player)) {
    player.sendMessage(`${PREFIX} §cSolo operadores/administradores pueden configurar la horda.`);
    return;
  }

  const form = new ActionFormData()
    .title("Admin Horda")
    .body(getHordeConfigSummary())
    .button("Guardar lugar actual")
    .button("Editar recompensa")
    .button("Ver configuración")
    .button("§4Iniciar Apocalipsis Zombie");

  form.show(player).then(response => {
    if (response.canceled || response.selection === undefined) return;
    if (response.selection === 0) {
      saveHordeLocation(player);
      return;
    }
    if (response.selection === 1) {
      system.runTimeout(() => showHordeRewardForm(player), 1);
      return;
    }
    if (response.selection === 3) {
      if (startZombieApocalypse()) player.sendMessage(`${PREFIX} §aApocalipsis zombie iniciado.`);
      else player.sendMessage(`${PREFIX} §cYa hay un evento activo o el lugar no está cargado.`);
      return;
    }
    player.sendMessage(`${PREFIX}\n${getHordeConfigSummary()}`);
  }).catch(reportRuntimeError);
}

function showHordeRewardForm(player) {
  const form = new ModalFormData()
    .title("Recompensa de Horda")
    .textField(
      "Items del cofre",
      "minecraft:diamond 8; minecraft:golden_apple 3",
      {
        defaultValue: formatRewardLines(),
        tooltip: "Separa recompensas con punto y coma. Formato: item cantidad"
      }
    )
    .submitButton("Guardar");

  form.show(player).then(response => {
    if (response.canceled) return;
    const rewards = parseRewardsInput(response.formValues?.[0]);
    if (rewards.length === 0) {
      player.sendMessage(`${PREFIX} §cNo se guardó nada. Usa formato: §fminecraft:diamond 8; minecraft:golden_apple 3`);
      return;
    }
    setConfiguredRewards(rewards);
    player.sendMessage(`${PREFIX} §aRecompensa guardada: §f${formatRewardLines(rewards)}`);
  }).catch(reportRuntimeError);
}

// =========================================================================
// EXPEDICIONES: JEFE COOPERATIVO EN ARENA FIJA
// =========================================================================
// El diseño no coloca, clona ni elimina bloques. El único estado persistente
// viaja por el puente SQLite del servidor; la entidad es estado efímero del
// evento y se redescubre por tipo, nombre y proximidad a la arena.
function readJsonFromSqlite(owner, key, fallbackValue) {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("horde_event_addon", owner, key);
    if (typeof raw !== "string" || !raw.trim()) return fallbackValue;
    return JSON.parse(raw);
  } catch (error) {
    reportRuntimeError(error);
    return fallbackValue;
  }
}

function writeJsonToSqlite(owner, key, value) {
  try {
    globalThis.__sqlite_set_prop_v2__("horde_event_addon", owner, key, JSON.stringify(value));
    return true;
  } catch (error) {
    reportRuntimeError(error);
    return false;
  }
}

function getExpeditionArena() {
  const saved = readJsonFromSqlite("world", EXPEDITION_ARENA_KEY, undefined);
  if (!saved || !Number.isFinite(Number(saved.x)) || !Number.isFinite(Number(saved.y)) || !Number.isFinite(Number(saved.z)) || !saved.dimension) return undefined;
  try {
    return {
      location: {
        x: Math.floor(Number(saved.x)),
        y: clamp(Math.floor(Number(saved.y)), MIN_WORLD_Y, MAX_WORLD_Y),
        z: Math.floor(Number(saved.z))
      },
      dimension: world.getDimension(String(saved.dimension))
    };
  } catch (error) {
    reportRuntimeError(error);
    return undefined;
  }
}

function saveExpeditionArena(player) {
  const location = toBlockLocation(player.location);
  const saved = { ...location, dimension: player.dimension.id };
  if (!writeJsonToSqlite("world", EXPEDITION_ARENA_KEY, saved)) {
    player.sendMessage("§5[Expedición] §cNo se pudo guardar la arena en SQLite.");
    return false;
  }
  player.sendMessage(`§5[Expedición] §aArena guardada en §f${location.x}, ${location.y}, ${location.z} §7(${player.dimension.id})§a.`);
  return true;
}

function getExpeditionStartButton() {
  const saved = readJsonFromSqlite("world", EXPEDITION_START_BUTTON_KEY, undefined);
  if (!saved || !Number.isFinite(Number(saved.x)) || !Number.isFinite(Number(saved.y)) || !Number.isFinite(Number(saved.z)) || !saved.dimension) return undefined;
  return {
    x: Math.floor(Number(saved.x)),
    y: clamp(Math.floor(Number(saved.y)), MIN_WORLD_Y, MAX_WORLD_Y),
    z: Math.floor(Number(saved.z)),
    dimension: String(saved.dimension)
  };
}

function isExpeditionButtonBlock(block) {
  return String(block?.typeId || "").toLowerCase().includes("button");
}

function isButtonInsideExpeditionArena(block) {
  const arena = getExpeditionArena();
  if (!arena || !block || block.dimension.id !== arena.dimension.id) return false;
  const dx = block.x - arena.location.x;
  const dy = block.y - arena.location.y;
  const dz = block.z - arena.location.z;
  return (dx * dx) + (dy * dy) + (dz * dz) <= EXPEDITION_RADIUS * EXPEDITION_RADIUS;
}

function requestExpeditionButtonBinding(player) {
  if (!getExpeditionArena()) {
    player.sendMessage("§5[Expedición] §cGuarda primero la arena antes de vincular un botón.");
    return;
  }
  const owner = getPlayerSqliteOwner(player);
  if (!owner) return;
  expeditionButtonBindRequests.set(owner, Date.now() + EXPEDITION_BUTTON_BIND_TIMEOUT_MS);
  player.sendMessage("§5[Expedición] §eAhora presiona el botón de la arena en menos de 60 segundos para vincularlo.");
}

function saveExpeditionStartButton(player, block) {
  if (!isExpeditionButtonBlock(block) || !isButtonInsideExpeditionArena(block)) {
    player.sendMessage("§5[Expedición] §cEl botón debe estar dentro de la arena configurada.");
    return false;
  }
  const button = { x: block.x, y: block.y, z: block.z, dimension: block.dimension.id };
  if (!writeJsonToSqlite("world", EXPEDITION_START_BUTTON_KEY, button)) {
    player.sendMessage("§5[Expedición] §cNo se pudo guardar el botón en SQLite.");
    return false;
  }
  player.sendMessage(`§5[Expedición] §aBotón de inicio vinculado en §f${button.x}, ${button.y}, ${button.z}§a.`);
  return true;
}

function matchesExpeditionStartButton(block) {
  const button = getExpeditionStartButton();
  return !!button && !!block && block.dimension.id === button.dimension &&
    block.x === button.x && block.y === button.y && block.z === button.z;
}

function getDefaultExpeditionState() {
  return { active: false, eventId: "", bossId: "", affixId: "", rewardItems: [], cooldownMs: 0, phase: 0, playerCount: 0, scaleLevel: 0, scheduledAt: 0, scheduledMode: "", scheduledOneMinute: false, startedAt: 0, nextStartAt: 0, participants: [] };
}

function getExpeditionBossProfile(bossId) {
  return EXPEDITION_BOSS_PROFILES.find(profile => profile.id === bossId) || undefined;
}

function chooseExpeditionBossProfile(arena) {
  const available = EXPEDITION_BOSS_PROFILES.filter(profile =>
    !Array.isArray(profile.allowedDimensions) || profile.allowedDimensions.includes(arena?.dimension?.id)
  );
  return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : undefined;
}

function getExpeditionAffix(affixId) {
  return EXPEDITION_AFFIXES.find(affix => affix.id === affixId) || undefined;
}

function chooseExpeditionAffix() {
  return EXPEDITION_AFFIXES[Math.floor(Math.random() * EXPEDITION_AFFIXES.length)];
}

function normalizeExpeditionRewards(rewards) {
  return Array.isArray(rewards)
    ? rewards.map(normalizeReward).filter(Boolean).slice(0, 8)
    : [];
}

function isExpeditionBoss(entity, state = getExpeditionState()) {
  if (!entity) return false;
  const selected = getExpeditionBossProfile(state.bossId);
  if (selected) return entity.typeId === selected.entityType && entity.nameTag === selected.name;
  return EXPEDITION_BOSS_PROFILES.some(profile => entity.typeId === profile.entityType && entity.nameTag === profile.name);
}

function getExpeditionState() {
  const raw = readJsonFromSqlite("world", EXPEDITION_STATE_KEY, getDefaultExpeditionState());
  const fallback = getDefaultExpeditionState();
  if (!raw || typeof raw !== "object") return fallback;
  return {
    active: raw.active === true,
    eventId: typeof raw.eventId === "string" ? raw.eventId.slice(0, 96) : "",
    bossId: typeof raw.bossId === "string" && getExpeditionBossProfile(raw.bossId) ? raw.bossId : "",
    affixId: typeof raw.affixId === "string" && getExpeditionAffix(raw.affixId) ? raw.affixId : "",
    rewardItems: normalizeExpeditionRewards(raw.rewardItems),
    cooldownMs: clamp(Math.floor(Number(raw.cooldownMs) || 0), 0, 7 * 24 * 60 * 60 * 1000),
    phase: clamp(Math.floor(Number(raw.phase) || 0), 0, 8),
    playerCount: clamp(Math.floor(Number(raw.playerCount) || 0), 0, 100),
    scaleLevel: clamp(Math.floor(Number(raw.scaleLevel) || 0), 0, 4),
    scheduledAt: Math.max(0, Math.floor(Number(raw.scheduledAt) || 0)),
    scheduledMode: raw.scheduledMode === "auto" || raw.scheduledMode === "button" || raw.scheduledMode === "admin" ? raw.scheduledMode : "",
    scheduledOneMinute: raw.scheduledOneMinute === true,
    startedAt: Number.isFinite(Number(raw.startedAt)) ? Number(raw.startedAt) : 0,
    nextStartAt: Number.isFinite(Number(raw.nextStartAt)) ? Number(raw.nextStartAt) : 0,
    participants: Array.isArray(raw.participants)
      ? raw.participants
        .filter(entry => entry && typeof entry.owner === "string" && typeof entry.name === "string")
        .map(entry => ({
          owner: entry.owner.slice(0, 96),
          name: entry.name.slice(0, 64),
          joinedAt: Math.max(0, Math.floor(Number(entry.joinedAt) || 0)),
          damage: Math.max(0, Number(entry.damage) || 0),
          deaths: clamp(Math.floor(Number(entry.deaths) || 0), 0, 100),
          reentries: clamp(Math.floor(Number(entry.reentries) || 0), 0, 1),
          pendingReentry: entry.pendingReentry === true
        }))
        .slice(0, 100)
      : []
  };
}

function saveExpeditionState(state) {
  return writeJsonToSqlite("world", EXPEDITION_STATE_KEY, {
    active: state.active === true,
    eventId: String(state.eventId || "").slice(0, 96),
    bossId: getExpeditionBossProfile(state.bossId) ? state.bossId : "",
    affixId: getExpeditionAffix(state.affixId) ? state.affixId : "",
    rewardItems: normalizeExpeditionRewards(state.rewardItems),
    cooldownMs: clamp(Math.floor(Number(state.cooldownMs) || 0), 0, 7 * 24 * 60 * 60 * 1000),
    phase: clamp(Math.floor(Number(state.phase) || 0), 0, 8),
    playerCount: clamp(Math.floor(Number(state.playerCount) || 0), 0, 100),
    scaleLevel: clamp(Math.floor(Number(state.scaleLevel) || 0), 0, 4),
    scheduledAt: Math.max(0, Math.floor(Number(state.scheduledAt) || 0)),
    scheduledMode: state.scheduledMode === "auto" || state.scheduledMode === "button" || state.scheduledMode === "admin" ? state.scheduledMode : "",
    scheduledOneMinute: state.scheduledOneMinute === true,
    startedAt: Math.max(0, Math.floor(Number(state.startedAt) || 0)),
    nextStartAt: Math.max(0, Math.floor(Number(state.nextStartAt) || 0)),
    participants: Array.isArray(state.participants) ? state.participants.slice(0, 100) : []
  });
}

function getPlayerSqliteOwner(player) {
  // El puente actual normaliza Player a nombre; se replica el mismo owner
  // para que una recompensa pendiente sea recuperable tras reconectar.
  return String(player?.name || "").trim().toLowerCase();
}

function getExpeditionPendingRewards(player) {
  const owner = getPlayerSqliteOwner(player);
  if (!owner) return [];
  const rewards = readJsonFromSqlite(owner, EXPEDITION_PENDING_REWARDS_KEY, []);
  return Array.isArray(rewards) ? rewards.filter(entry => entry && Array.isArray(entry.items)).slice(0, 20) : [];
}

function saveExpeditionPendingRewards(owner, rewards) {
  return writeJsonToSqlite(owner, EXPEDITION_PENDING_REWARDS_KEY, Array.isArray(rewards) ? rewards.slice(0, 20) : []);
}

function queueExpeditionReward(participant, eventId, rewardItems, tier = "combatiente") {
  const owner = String(participant?.owner || "").trim().toLowerCase();
  if (!owner) return false;
  const pending = readJsonFromSqlite(owner, EXPEDITION_PENDING_REWARDS_KEY, []);
  const safePending = Array.isArray(pending) ? pending.filter(entry => entry && Array.isArray(entry.items)).slice(0, 20) : [];
  if (safePending.some(entry => entry.eventId === eventId)) return true;
  safePending.push({
    eventId: String(eventId || "").slice(0, 96),
    createdAt: Date.now(),
    tier,
    items: normalizeExpeditionRewards(rewardItems).map(item => ({ ...item }))
  });
  return saveExpeditionPendingRewards(owner, safePending);
}

function getContributionReward(participant, participants, baseItems) {
  const ordered = [...participants].sort((a, b) => (Number(b.damage) || 0) - (Number(a.damage) || 0));
  const rank = ordered.findIndex(entry => entry.owner === participant.owner);
  const damage = Math.max(0, Number(participant.damage) || 0);
  const totalDamage = ordered.reduce((sum, entry) => sum + Math.max(0, Number(entry.damage) || 0), 0);
  const share = totalDamage > 0 ? damage / totalDamage : 0;
  const items = normalizeExpeditionRewards(baseItems).map(item => ({ ...item }));
  if (rank === 0 && damage > 0) {
    items.push({ itemId: "minecraft:netherite_scrap", amount: 2 });
    return { tier: "campeón", items };
  }
  if (share >= 0.20) {
    items.push({ itemId: "minecraft:diamond", amount: 4 });
    return { tier: "élite", items };
  }
  items.push({ itemId: "minecraft:emerald", amount: 8 });
  return { tier: "combatiente", items };
}

function updateExpeditionHallOfFame(state, profile) {
  const durationSeconds = Math.max(1, Math.floor((Date.now() - state.startedAt) / 1000));
  const top = [...state.participants].sort((a, b) => (Number(b.damage) || 0) - (Number(a.damage) || 0))[0];
  const entry = {
    eventId: state.eventId,
    bossId: profile?.id || state.bossId,
    bossName: profile?.label || state.bossId,
    completedAt: Date.now(),
    durationSeconds,
    players: state.participants.length,
    champion: top?.name || "Sin datos",
    championDamage: Math.max(0, Number(top?.damage) || 0)
  };
  const current = readJsonFromSqlite("world", EXPEDITION_LEADERBOARD_KEY, []);
  const records = Array.isArray(current) ? current.filter(record => record && Number.isFinite(Number(record.durationSeconds))).slice(0, 40) : [];
  records.push(entry);
  records.sort((a, b) => Number(a.durationSeconds) - Number(b.durationSeconds));
  writeJsonToSqlite("world", EXPEDITION_LEADERBOARD_KEY, records.slice(0, 10));
  for (const participant of state.participants) {
    const stats = readJsonFromSqlite(participant.owner, EXPEDITION_PLAYER_STATS_KEY, { raids: 0, damage: 0, championships: 0 });
    const nextStats = {
      raids: Math.max(0, Number(stats?.raids) || 0) + 1,
      damage: Math.max(0, Number(stats?.damage) || 0) + Math.max(0, Number(participant.damage) || 0),
      championships: Math.max(0, Number(stats?.championships) || 0) + (participant.owner === top?.owner ? 1 : 0)
    };
    writeJsonToSqlite(participant.owner, EXPEDITION_PLAYER_STATS_KEY, nextStats);
  }
}

function getExpeditionHallOfFameText() {
  const records = readJsonFromSqlite("world", EXPEDITION_LEADERBOARD_KEY, []);
  if (!Array.isArray(records) || records.length === 0) return "§7Aún no hay raids completadas.";
  return records.slice(0, 10).map((record, index) =>
    `§e${index + 1}. §f${String(record.bossName || record.bossId || "Boss")} §7— §a${Math.max(1, Number(record.durationSeconds) || 0)} s §7| Campeón: §f${String(record.champion || "Sin datos")}`
  ).join("\n");
}

function showExpeditionHallOfFame(player) {
  const form = new ActionFormData()
    .title("§6SALÓN DE FAMA")
    .body(getExpeditionHallOfFameText())
    .button("Cerrar");
  form.show(player).catch(reportRuntimeError);
}

function givePendingExpeditionRewards(player) {
  const owner = getPlayerSqliteOwner(player);
  const pending = getExpeditionPendingRewards(player);
  if (!owner || pending.length === 0) {
    player.sendMessage("§5[Expedición] §7No tienes recompensas pendientes.");
    return;
  }
  let container;
  try {
    container = player.getComponent("minecraft:inventory")?.container;
  } catch (error) {
    reportRuntimeError(error);
  }
  if (!container) {
    player.sendMessage("§5[Expedición] §cNo se pudo acceder a tu inventario. Inténtalo de nuevo.");
    return;
  }
  // Falla cerrada: primero se confirma el consumo de una sola recompensa en
  // SQLite y después se entregan los items. Así una caída no permite reclamar
  // el mismo paquete repetidamente. Se exigen slots vacíos para no perder ítems.
  let emptySlots = 0;
  try {
    for (let slot = 0; slot < container.size; slot++) {
      if (!container.getItem(slot)) emptySlots++;
    }
  } catch (error) {
    reportRuntimeError(error);
  }
  const reward = pending[0];
  if (emptySlots < reward.items.length) {
    player.sendMessage(`§5[Expedición] §eNecesitas al menos ${reward.items.length} espacios vacíos para reclamar una recompensa.`);
    return;
  }
  if (!saveExpeditionPendingRewards(owner, pending.slice(1))) {
    player.sendMessage("§5[Expedición] §cSQLite no confirmó la entrega; no se otorgaron ítems.");
    return;
  }
  for (const item of reward.items) {
    try {
      const overflow = container.addItem(new ItemStack(item.itemId, item.amount));
      if (overflow) throw new Error("Inventario cambió durante la entrega");
    } catch (error) {
      reportRuntimeError(error);
      player.sendMessage("§5[Expedición] §cLa entrega no terminó. Contacta a un OP con la hora aproximada para revisión en SQLite.");
      return;
    }
  }
  player.sendMessage(`§5[Expedición] §aReclamaste una recompensa. Restantes: ${pending.length - 1}.`);
}

function findExpeditionBoss(arena = getExpeditionArena(), state = getExpeditionState()) {
  if (!arena || !isLocationLoaded(arena.dimension, arena.location)) return undefined;
  try {
    const selected = getExpeditionBossProfile(state.bossId);
    const profiles = selected ? [selected] : EXPEDITION_BOSS_PROFILES;
    for (const profile of profiles) {
      const nearby = arena.dimension.getEntities({
        type: profile.entityType,
        location: arena.location,
        maxDistance: profile.scanRadius || EXPEDITION_RADIUS
      });
      const boss = nearby.find(entity => entity.nameTag === profile.name);
      if (boss) return boss;
    }
    return undefined;
  } catch (error) {
    reportRuntimeError(error);
    return undefined;
  }
}

function addExpeditionParticipant(player, damage = 0) {
  const owner = getPlayerSqliteOwner(player);
  if (!owner) return;
  const state = getExpeditionState();
  if (!state.active) return;
  const participant = state.participants.find(entry => entry.owner === owner);
  if (!participant) {
    state.participants.push({ owner, name: String(player.name).slice(0, 64), joinedAt: Date.now(), damage: 0, deaths: 0, reentries: 0, pendingReentry: false });
    saveExpeditionState(state);
    player.sendMessage("§5[Expedición] §dTu participación quedó registrada. Aporta daño para mejorar tu recompensa.");
  }
  const safeDamage = Math.max(0, Number(damage) || 0);
  if (safeDamage > 0) expeditionDamageBuffer.set(owner, (expeditionDamageBuffer.get(owner) || 0) + safeDamage);
}

function flushExpeditionContributionBuffer() {
  if (expeditionDamageBuffer.size === 0) return;
  const state = getExpeditionState();
  if (!state.active) {
    expeditionDamageBuffer.clear();
    return;
  }
  let changed = false;
  for (const participant of state.participants) {
    const damage = expeditionDamageBuffer.get(participant.owner);
    if (!damage) continue;
    participant.damage = Math.max(0, Number(participant.damage) || 0) + damage;
    expeditionDamageBuffer.delete(participant.owner);
    changed = true;
  }
  if (changed) saveExpeditionState(state);
}

function registerExpeditionParticipantDeath(player) {
  const arena = getExpeditionArena();
  const state = getExpeditionState();
  if (!state.active || !arena || !isPlayerAtExpeditionArena(player, arena)) return;
  const owner = getPlayerSqliteOwner(player);
  const participant = state.participants.find(entry => entry.owner === owner);
  if (!participant) return;
  participant.deaths = clamp((Number(participant.deaths) || 0) + 1, 0, 100);
  participant.pendingReentry = (Number(participant.reentries) || 0) < 1;
  if (!saveExpeditionState(state)) return;
  if (participant.pendingReentry) {
    player.sendMessage("§5[Expedición] §eTienes un reingreso seguro. Volverás a la arena al reaparecer.");
  } else {
    player.sendMessage("§5[Expedición] §cYa utilizaste tu único reingreso de esta expedición.");
  }
}

function restoreExpeditionReentry(player) {
  const state = getExpeditionState();
  const arena = getExpeditionArena();
  if (!state.active || !arena || !isLocationLoaded(arena.dimension, arena.location)) return;
  const owner = getPlayerSqliteOwner(player);
  const participant = state.participants.find(entry => entry.owner === owner);
  if (!participant || participant.pendingReentry !== true || (Number(participant.reentries) || 0) >= 1) return;

  participant.pendingReentry = false;
  participant.reentries = 1;
  if (!saveExpeditionState(state)) return;
  try {
    player.teleport({ x: arena.location.x + 0.5, y: arena.location.y + 2, z: arena.location.z + 0.5 }, { dimension: arena.dimension });
    player.addEffect("minecraft:resistance", 20 * 10, { amplifier: 4, showParticles: false });
    player.addEffect("minecraft:fire_resistance", 20 * 10, { amplifier: 0, showParticles: false });
    player.sendMessage("§5[Expedición] §aReingreso seguro activado. Tienes 10 segundos de protección.");
  } catch (error) {
    participant.pendingReentry = true;
    participant.reentries = 0;
    saveExpeditionState(state);
    reportRuntimeError(error);
  }
}

function canStartExpedition(state) {
  return !state.active && !state.scheduledAt && Date.now() >= state.nextStartAt && !activeHorde.active && !activeApocalypse.active;
}

function scheduleExpedition(player, mode = "button") {
  const state = getExpeditionState();
  const arena = getExpeditionArena();
  if (!arena || !isLocationLoaded(arena.dimension, arena.location) || !canStartExpedition(state)) return false;
  const automatic = mode === "auto";
  state.scheduledAt = Date.now() + (automatic ? 5 * 60 * 1000 : 60 * 1000);
  state.scheduledMode = automatic ? "auto" : mode === "admin" ? "admin" : "button";
  state.scheduledOneMinute = !automatic;
  if (!saveExpeditionState(state)) return false;
  world.sendMessage(automatic
    ? "§5§l[Expedición]§r §eUna expedición comenzará en 5 minutos. Reúnanse en la arena."
    : "§5§l[Expedición]§r §eLa expedición comenzará en 1 minuto. Prepárense en la arena.");
  return true;
}

function processExpeditionCountdown() {
  const state = getExpeditionState();
  if (state.active || !state.scheduledAt) return;
  const remaining = state.scheduledAt - Date.now();
  if (state.scheduledMode === "auto" && !state.scheduledOneMinute && remaining <= 60 * 1000 && remaining > 0) {
    state.scheduledOneMinute = true;
    saveExpeditionState(state);
    world.sendMessage("§5§l[Expedición]§r §eLa expedición comenzará en 1 minuto.");
    return;
  }
  if (remaining > 0) return;
  const arena = getExpeditionArena();
  const players = getPlayersAtExpeditionArena(arena);
  const minimum = state.scheduledMode === "auto" ? EXPEDITION_AUTO_MIN_PLAYERS : 1;
  const scheduledMode = state.scheduledMode;
  state.scheduledAt = 0;
  state.scheduledMode = "";
  state.scheduledOneMinute = false;
  saveExpeditionState(state);
  if (!arena || !isLocationLoaded(arena.dimension, arena.location) || players.length < minimum) {
    world.sendMessage("§5§l[Expedición]§r §eLa expedición fue pospuesta porque faltan jugadores o la arena no está cargada.");
    return;
  }
  startExpedition(players[0], scheduledMode === "auto");
}

function configureExpeditionBoss(boss, profile, scaleLevel = 0, affix = undefined) {
  const durationTicks = EXPEDITION_DURATION_MS / 50;
  const effects = [
    ["minecraft:health_boost", profile.healthBoost + (scaleLevel * 2)],
    ["minecraft:resistance", profile.resistance + Math.floor(scaleLevel / 2) + (affix?.resistanceBonus || 0)],
    profile.strength > 0 || scaleLevel > 0 || affix?.strengthBonus ? ["minecraft:strength", profile.strength + scaleLevel + (affix?.strengthBonus || 0)] : undefined,
    profile.speed > 0 || affix?.speedBonus ? ["minecraft:speed", profile.speed + (affix?.speedBonus || 0)] : undefined,
    affix?.regenerationBonus ? ["minecraft:regeneration", affix.regenerationBonus] : undefined
  ];
  for (const effect of effects) {
    if (!effect) continue;
    try {
      boss.addEffect(effect[0], durationTicks, { amplifier: effect[1], showParticles: false });
    } catch (error) {
      reportRuntimeError(error);
      console.warn(`[Expedición] No se pudo aplicar ${effect[0]} al perfil ${profile.id}.`);
      return false;
    }
  }
  try {
    const equippable = boss.getComponent("minecraft:equippable");
    if (!equippable && profile.equipment.length > 0) return false;
    if (equippable) {
      const slots = { head: EquipmentSlot.Head, chest: EquipmentSlot.Chest, legs: EquipmentSlot.Legs, feet: EquipmentSlot.Feet, mainhand: EquipmentSlot.Mainhand };
      for (const item of profile.equipment) {
        const slot = slots[item.slot];
        if (slot === undefined) return false;
        equippable.setEquipment(slot, createEnchantedItem(item.itemId, item.enchantments));
      }
    }
  } catch (error) {
    reportRuntimeError(error);
    console.warn(`[Expedición] No se pudo equipar el perfil ${profile.id}.`);
    return false;
  }
  return true;
}

function startExpedition(player, automatic = false) {
  const arena = getExpeditionArena();
  const state = getExpeditionState();
  if (!arena) {
    player.sendMessage("§5[Expedición] §cConfigura primero la arena desde /s:adminexpedicion.");
    return false;
  }
  if (!isLocationLoaded(arena.dimension, arena.location)) {
    player.sendMessage("§5[Expedición] §cLa arena no está cargada. Un operador debe permanecer cerca antes de iniciarla.");
    return false;
  }
  if (!canStartExpedition(state)) {
    const wait = Math.max(0, state.nextStartAt - Date.now());
    const minutes = Math.ceil(wait / 60000);
    player.sendMessage(state.active
      ? "§5[Expedición] §cYa hay una expedición activa."
      : activeHorde.active || activeApocalypse.active
        ? "§5[Expedición] §cHay otro evento de combate activo."
        : `§5[Expedición] §eDisponible de nuevo en ${minutes} min.`);
    return false;
  }
  if (findExpeditionBoss(arena)) {
    player.sendMessage("§5[Expedición] §cYa existe un Guardián en la arena; no se iniciará otro.");
    return false;
  }
  let boss;
  try {
    const profile = chooseExpeditionBossProfile(arena);
    if (!profile) {
      player.sendMessage("§5[Expedición] §cNo hay un perfil de jefe compatible con esta dimensión.");
      return false;
    }
    const playerCount = getPlayersAtExpeditionArena(arena).length;
    const scaleLevel = clamp(Math.floor((playerCount - 2) / 2), 0, 4);
    const affix = chooseExpeditionAffix();
    const spawnLocation = { x: arena.location.x + 0.5, y: arena.location.y + 1, z: arena.location.z + 0.5 };
    boss = arena.dimension.spawnEntity(profile.entityType, spawnLocation);
    boss.nameTag = profile.name;
    if (!configureExpeditionBoss(boss, profile, scaleLevel, affix)) {
      try { boss.remove(); } catch (error) { reportRuntimeError(error); }
      player.sendMessage("§5[Expedición] §cNo se pudieron validar los efectos del jefe; el evento se canceló.");
      return false;
    }
    const eventId = `exp-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const nextState = {
      active: true,
      eventId,
      bossId: profile.id,
      affixId: affix.id,
      rewardItems: normalizeExpeditionRewards([...(profile.rewards || []), ...(affix.rewards || [])]),
      cooldownMs: profile.cooldownMs,
      phase: 0,
      playerCount,
      scaleLevel,
      startedAt: Date.now(),
      nextStartAt: 0,
      participants: []
    };
    if (!saveExpeditionState(nextState)) {
      try { boss.remove(); } catch (error) { reportRuntimeError(error); }
      player.sendMessage("§5[Expedición] §cSQLite no confirmó el evento; se canceló para proteger el servidor.");
      return false;
    }
    world.sendMessage(`§5§l[Expedición]§r §d${profile.label} §7${profile.difficulty} §dha despertado${automatic ? " automáticamente" : ""}. §7Variante: ${affix.label}§7. Escala: §f${playerCount} jugadores. ¡Únanse a la arena!`);
    return true;
  } catch (error) {
    try { if (boss) boss.remove(); } catch (removeError) { reportRuntimeError(removeError); }
    reportRuntimeError(error);
    player.sendMessage("§5[Expedición] §cNo se pudo invocar al Guardián. Revisa que la arena esté despejada.");
    return false;
  }
}

function finishExpedition(reason) {
  const state = getExpeditionState();
  if (!state.active) return;
  const profile = getExpeditionBossProfile(state.bossId);
  cleanupExpeditionHelpers(getExpeditionArena(), profile);
  const rewardItems = state.rewardItems.length > 0 ? state.rewardItems : normalizeExpeditionRewards(profile?.rewards);
  if (reason === "defeated") {
    // Se encolan antes de cerrar el estado. Si SQLite no responde, el monitor
    // reintentará la misma operación; eventId evita duplicar paquetes.
    for (const participant of state.participants) {
      const reward = getContributionReward(participant, state.participants, rewardItems);
      if (!queueExpeditionReward(participant, state.eventId, reward.items, reward.tier)) return;
    }
    updateExpeditionHallOfFame(state, profile);
  }
  state.active = false;
  state.nextStartAt = Date.now() + (state.cooldownMs || profile?.cooldownMs || 4 * 60 * 60 * 1000);
  if (!saveExpeditionState(state)) return;
  if (reason === "defeated") {
    world.sendMessage(`§5§l[Expedición]§r §a¡Guardián derrotado! §d${state.participants.length} participante(s) pueden reclamar su recompensa con /s:expedicion.`);
  } else if (reason === "expired") {
    world.sendMessage("§5§l[Expedición]§r §eLa expedición expiró y el Guardián se retiró. No se entregaron recompensas.");
  } else {
    world.sendMessage("§5§l[Expedición]§r §eLa expedición fue cancelada por un operador. No se entregaron recompensas.");
  }
}

function cancelExpedition(player) {
  const boss = findExpeditionBoss();
  try { if (boss) boss.remove(); } catch (error) { reportRuntimeError(error); }
  const state = getExpeditionState();
  if (!state.active && !boss) {
    player.sendMessage("§5[Expedición] §7No hay una expedición activa.");
    return;
  }
  finishExpedition("cancelled");
  player.sendMessage("§5[Expedición] §aEvento cancelado de forma segura.");
}

function getExpeditionSummary() {
  const arena = getExpeditionArena();
  const startButton = getExpeditionStartButton();
  const state = getExpeditionState();
  const profile = getExpeditionBossProfile(state.bossId);
  const affix = getExpeditionAffix(state.affixId);
  const arenaText = arena
    ? `§7Arena: §f${arena.location.x}, ${arena.location.y}, ${arena.location.z} §7(${arena.dimension.id})`
    : "§7Arena: §cno configurada";
  const status = state.active
    ? `§aACTIVA §7— participantes: §f${state.participants.length}`
    : state.scheduledAt > Date.now()
      ? `§eComienza en: §f${Math.ceil((state.scheduledAt - Date.now()) / 1000)} s`
    : Date.now() < state.nextStartAt
      ? `§eEnfriamiento: §f${Math.ceil((state.nextStartAt - Date.now()) / 60000)} min`
      : "§aDisponible";
  const bossText = profile
    ? `§7Jefe actual: ${profile.label} §7${profile.difficulty}`
    : "§7Próximo jefe: §faleatorio entre cinco perfiles difíciles.";
  const rewards = state.rewardItems.length > 0
    ? state.rewardItems
    : normalizeExpeditionRewards(profile?.rewards);
  const rewardText = rewards.length > 0 ? `§7Botín: §f${formatRewardLines(rewards)}` : "§7Botín: §fse anuncia al iniciar.";
  const buttonText = startButton
    ? `§7Botón: §f${startButton.x}, ${startButton.y}, ${startButton.z}`
    : "§7Botón: §eno vinculado";
  const scaleText = state.active ? `§7Escala: §f${state.playerCount} jugadores (nivel ${state.scaleLevel})` : "§7Escala: §fse calcula al iniciar.";
  const affixText = affix ? `§7Variante: ${affix.label}` : "§7Variante: §fse elige al iniciar.";
  return `${arenaText}\n§7Estado: ${status}\n${bossText}\n${affixText}\n${scaleText}\n${rewardText}\n${buttonText}\n§7Auto: cada 10 min con 2 jugadores. No modifica bloques mediante scripts.`;
}

function showExpeditionMenu(player) {
  const pending = getExpeditionPendingRewards(player).length;
  const form = new ActionFormData()
    .title("§5⚔ EXPEDICIÓN")
    .body(`${getExpeditionSummary()}\n\n§7Recompensas pendientes: §f${pending}`)
    .button("🎁 Reclamar recompensas")
    .button("🏆 Ver salón de fama")
    .button("Cerrar");
  form.show(player).then(response => {
    if (!response.canceled && response.selection === 0) givePendingExpeditionRewards(player);
    else if (!response.canceled && response.selection === 1) showExpeditionHallOfFame(player);
  }).catch(reportRuntimeError);
}

function showAdminExpeditionMenu(player) {
  if (!isAdminPlayer(player)) {
    player.sendMessage("§5[Expedición] §cSolo operadores pueden administrar expediciones.");
    return;
  }
  const form = new ActionFormData()
    .title("§5ADMINISTRAR EXPEDICIÓN")
    .body(getExpeditionSummary())
    .button("Guardar arena en mi posición")
    .button("Vincular botón de inicio")
    .button("Programar jefe (1 min)")
    .button("Cancelar expedición activa")
    .button("Ver estado")
    .button("Cerrar");
  form.show(player).then(response => {
    if (response.canceled) return;
    if (response.selection === 0) saveExpeditionArena(player);
    else if (response.selection === 1) requestExpeditionButtonBinding(player);
    else if (response.selection === 2) scheduleExpedition(player, "admin");
    else if (response.selection === 3) cancelExpedition(player);
    else if (response.selection === 4) player.sendMessage(`§5[Expedición]\n${getExpeditionSummary()}`);
  }).catch(reportRuntimeError);
}

// Botón público: la protección comunitaria permite interactuar con botones.
// El vínculo sólo puede crearlo un OP y queda fuera del mundo en SQLite.
try {
  const expeditionButtonPushEvent = world.afterEvents?.buttonPush;
  if (expeditionButtonPushEvent && typeof expeditionButtonPushEvent.subscribe === "function") {
    expeditionButtonPushEvent.subscribe((event) => {
      const player = event.source || event.player;
      const block = event.block || event.buttonBlock;
      if (!player || player.typeId !== "minecraft:player" || !block || !isExpeditionButtonBlock(block)) return;
      const owner = getPlayerSqliteOwner(player);
      const expiresAt = expeditionButtonBindRequests.get(owner);
      if (expiresAt) {
        expeditionButtonBindRequests.delete(owner);
        if (expiresAt >= Date.now() && isAdminPlayer(player)) saveExpeditionStartButton(player, block);
        return;
      }
      if (!matchesExpeditionStartButton(block)) return;
      system.run(() => {
        if (!scheduleExpedition(player, "button")) {
          player.sendMessage("§5[Expedición] §eEl botón no pudo programar la raid: revisa el enfriamiento, la arena o eventos activos.");
        }
      });
    });
  } else {
    console.warn("[Expedición] buttonPush no está disponible en esta build; se mantiene el comando OP.");
  }
} catch (error) {
  reportRuntimeError(error);
}

function getPlayersAtExpeditionArena(arena) {
  if (!arena) return [];
  return world.getAllPlayers().filter(player => isPlayerAtExpeditionArena(player, arena));
}

function isPlayerAtExpeditionArena(player, arena) {
  if (!player || !arena) return false;
  try {
    if (player.dimension.id !== arena.dimension.id) return false;
    const dx = player.location.x - arena.location.x;
    const dy = player.location.y - arena.location.y;
    const dz = player.location.z - arena.location.z;
    return (dx * dx) + (dy * dy) + (dz * dz) <= EXPEDITION_RADIUS * EXPEDITION_RADIUS;
  } catch (error) {
    return false;
  }
}

function getExpeditionBossHealth(boss) {
  try {
    const health = boss.getComponent("minecraft:health");
    const current = Math.max(0, Number(health?.currentValue) || 0);
    const maximum = Math.max(current, Number(health?.effectiveMax ?? health?.defaultValue) || current || 1);
    return { current, maximum, ratio: Math.max(0, Math.min(1, current / maximum)) };
  } catch (error) {
    reportRuntimeError(error);
    return undefined;
  }
}

function createExpeditionHealthBar(ratio, width = 20) {
  const filled = clamp(Math.round(ratio * width), 0, width);
  return `§8[§c${"█".repeat(filled)}§7${"░".repeat(width - filled)}§8]`;
}

function getExpeditionMinionName(profile) {
  return `§8Esbirro de ${profile.id}`;
}

function spawnExpeditionPhaseHelpers(boss, profile, phase, scaleLevel = 0, affix = undefined) {
  const summons = Array.isArray(phase?.summons) ? phase.summons : [];
  if (summons.length === 0) return true;
  const durationTicks = Math.max(20, Math.ceil((EXPEDITION_DURATION_MS - 1000) / 50));
  let spawned = 0;
  let expected = 0;
  for (const summon of summons) {
    const count = clamp(Math.floor(Number(summon?.count) || 0) + scaleLevel + (affix?.helperBonus || 0), 0, 12);
    expected += count;
    for (let index = 0; index < count; index++) {
      const angle = (index * 2 * Math.PI) / Math.max(1, count);
      const radius = 5 + (index % 3);
      const candidate = {
        x: boss.location.x + Math.cos(angle) * radius,
        y: boss.location.y + 1,
        z: boss.location.z + Math.sin(angle) * radius
      };
      try {
        const location = getSpawnCandidate(boss.dimension, candidate, boss.location);
        if (!location) continue;
        const helper = boss.dimension.spawnEntity(String(summon.typeId || ""), location);
        helper.nameTag = getExpeditionMinionName(profile);
        if (Number(summon.healthBoost) > 0) helper.addEffect("minecraft:health_boost", durationTicks, { amplifier: Math.floor(summon.healthBoost), showParticles: false });
        if (Number(summon.resistance) > 0) helper.addEffect("minecraft:resistance", durationTicks, { amplifier: Math.floor(summon.resistance), showParticles: false });
        if (Number(summon.strength) > 0) helper.addEffect("minecraft:strength", durationTicks, { amplifier: Math.floor(summon.strength), showParticles: false });
        spawned++;
      } catch (error) {
        reportRuntimeError(error);
      }
    }
  }
  if (expected > 0 && spawned === 0) {
    console.warn(`[Expedición] No se pudo invocar ningún ayudante para ${profile.id}.`);
    return false;
  }
  return true;
}

function cleanupExpeditionHelpers(arena, profile) {
  if (!arena || !profile || !isLocationLoaded(arena.dimension, arena.location)) return;
  const types = new Set();
  for (const phase of profile.phases || []) {
    for (const summon of phase.summons || []) {
      if (summon?.typeId) types.add(String(summon.typeId));
    }
  }
  for (const type of types) {
    try {
      const entities = arena.dimension.getEntities({ type, location: arena.location, maxDistance: profile.scanRadius || EXPEDITION_RADIUS });
      for (const entity of entities) {
        if (entity.nameTag === getExpeditionMinionName(profile)) entity.remove();
      }
    } catch (error) {
      reportRuntimeError(error);
    }
  }
}

function applyExpeditionPhase(state, boss, profile, health) {
  const phases = Array.isArray(profile?.phases) ? profile.phases : [];
  const nextPhase = phases[state.phase];
  if (!nextPhase || health.ratio > Number(nextPhase.threshold)) return;
  const remainingTicks = Math.max(20, Math.ceil((state.startedAt + EXPEDITION_DURATION_MS - Date.now()) / 50));
  for (const effect of nextPhase.effects || []) {
    try {
      boss.addEffect(effect[0], remainingTicks, { amplifier: effect[1], showParticles: false });
    } catch (error) {
      reportRuntimeError(error);
      console.warn(`[Expedición] La fase ${state.phase + 1} de ${profile.id} no pudo aplicar ${effect[0]}.`);
      return;
    }
  }
  if (!spawnExpeditionPhaseHelpers(boss, profile, nextPhase, state.scaleLevel, getExpeditionAffix(state.affixId))) return;
  state.phase++;
  if (!saveExpeditionState(state)) return;
  world.sendMessage(`§5§l[Expedición]§r §d${profile.label} §cha entrado en fase ${state.phase}: §f${nextPhase.name}.`);
}

function updateExpeditionHealthDisplay() {
  const state = getExpeditionState();
  if (!state.active) return;
  const arena = getExpeditionArena();
  const profile = getExpeditionBossProfile(state.bossId);
  if (!arena || !profile || !isLocationLoaded(arena.dimension, arena.location)) return;
  const boss = findExpeditionBoss(arena, state);
  if (!boss) return;
  const health = getExpeditionBossHealth(boss);
  if (!health) return;
  applyExpeditionPhase(state, boss, profile, health);
  const percent = Math.round(health.ratio * 100);
  const phaseText = `§7Fase ${state.phase}/${profile.phases.length}`;
  const text = `§5${profile.label} §f${percent}% §7${Math.ceil(health.current)}/${Math.ceil(health.maximum)} ${createExpeditionHealthBar(health.ratio)} ${phaseText}`;
  for (const player of getPlayersAtExpeditionArena(arena)) {
    try { player.onScreenDisplay.setActionBar(text); } catch (error) { reportRuntimeError(error); }
  }
}

function tryStartAutomaticExpedition() {
  const state = getExpeditionState();
  if (!canStartExpedition(state)) return;
  const arena = getExpeditionArena();
  if (!arena || !isLocationLoaded(arena.dimension, arena.location)) return;
  const players = getPlayersAtExpeditionArena(arena);
  if (players.length < EXPEDITION_AUTO_MIN_PLAYERS) return;
  scheduleExpedition(players[0], "auto");
}

// Primera revisión tras dos minutos para que el puente SQLite termine su
// sincronización; después se prueba cada diez minutos. Si falta gente o el
// chunk no está cargado, se pospone sin crear entidades ni modificar estado.
system.runTimeout(() => {
  tryStartAutomaticExpedition();
  system.runInterval(tryStartAutomaticExpedition, EXPEDITION_AUTO_CHECK_TICKS);
}, 2 * 60 * 20);

system.runInterval(updateExpeditionHealthDisplay, EXPEDITION_STATUS_INTERVAL_TICKS);
system.runInterval(flushExpeditionContributionBuffer, 100);
system.runInterval(processExpeditionCountdown, EXPEDITION_STATUS_INTERVAL_TICKS);

system.runInterval(() => {
  const state = getExpeditionState();
  if (!state.active) return;
  const arena = getExpeditionArena();
  if (!arena) {
    finishExpedition("cancelled");
    return;
  }
  const boss = findExpeditionBoss(arena);
  if (!boss) {
    // Durante un chunk descargado no asumimos que el jefe murió; así no se
    // entregan recompensas erróneas ni se altera el mundo.
    if (isLocationLoaded(arena.dimension, arena.location)) finishExpedition("defeated");
    return;
  }
  if (Date.now() - state.startedAt >= EXPEDITION_DURATION_MS) {
    try { boss.remove(); } catch (error) { reportRuntimeError(error); }
    finishExpedition("expired");
  }
}, 100);

world.afterEvents.entityHurt.subscribe((event) => {
  try {
    const entity = event.hurtEntity;
    const attacker = event.damageSource?.damagingEntity;
    if (!isExpeditionBoss(entity)) return;
    if (!attacker || attacker.typeId !== "minecraft:player") return;
    addExpeditionParticipant(attacker, event.damage);
  } catch (error) {
    reportRuntimeError(error);
  }
});

world.afterEvents.entityDie.subscribe((event) => {
  try {
    const entity = event.deadEntity;
    if (entity?.typeId === "minecraft:player") {
      registerExpeditionParticipantDeath(entity);
      return;
    }
    if (!isExpeditionBoss(entity)) return;
    flushExpeditionContributionBuffer();
    finishExpedition("defeated");
  } catch (error) {
    reportRuntimeError(error);
  }
});

world.afterEvents.playerSpawn.subscribe((event) => {
  system.runTimeout(() => {
    try {
      if (event.initialSpawn && getExpeditionPendingRewards(event.player).length > 0) {
        event.player.sendMessage("§5[Expedición] §dTienes recompensas pendientes. Usa /s:expedicion para reclamarlas.");
      }
      if (!event.initialSpawn) restoreExpeditionReentry(event.player);
    } catch (error) {
      reportRuntimeError(error);
    }
  }, event.initialSpawn ? 40 : 20);
});

// 5. Monitorizar los monstruos
system.runInterval(() => {
  if (!activeHorde.active) return;
  const info = getSpawnLocation();
  const mobs = info.dimension.getEntities({ tags: ["horde_mob"] });
  if (mobs.length === 0) {
    if (activeHorde.wave < 3) {
      activeHorde.wave++;
      if (!spawnWave(activeHorde.wave)) {
        activeHorde.wave--;
      }
    } else {
      endHorde();
    }
  }
}, 100);

system.runInterval(() => {
  if (!activeApocalypse.active) return;
  const info = getSpawnLocation();
  const zombies = info.dimension.getEntities({ tags: [APOCALYPSE_MOB_TAG] });
  if (zombies.length !== 0) return;
  if (activeApocalypse.wave < APOCALYPSE_WAVE_SIZES.length) {
    activeApocalypse.wave++;
    if (!spawnApocalypseWave(activeApocalypse.wave)) activeApocalypse.wave--;
  } else {
    endZombieApocalypse();
  }
}, 100);

world.afterEvents.entityDie.subscribe((event) => {
  const zombie = event.deadEntity;
  // Bedrock may invalidate a dead entity before this callback is fully read.
  // Treat it as an ordinary non-horde death instead of throwing every tick.
  try {
    if (!zombie || !zombie.isValid || !zombie.hasTag(APOCALYPSE_MOB_TAG)) return;
  } catch (error) {
    return;
  }
  const killer = event.damageSource?.damagingEntity;
  try {
    if (!killer || !killer.isValid || killer.typeId !== "minecraft:player") return;
  } catch (error) {
    return;
  }
  payApocalypseKillReward(killer);
});

// 6. Inicio automático sin mantener un contador activo cada segundo
function scheduleHordeCheck(delaySeconds) {
  system.runTimeout(() => {
    scheduleHordeCheck(CHECK_INTERVAL_SECS);
    if (Math.random() < 0.33 && !activeHorde.active && !activeApocalypse.active) {
      startHordeEvent();
    }
  }, delaySeconds * 20);
}

scheduleHordeCheck(INITIAL_CHECK_DELAY_SECS);

// Manejador por /scriptevent
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "cmd:hordastart" && event.id !== "cmd:adminhorda" && event.id !== "cmd:apocalipsis") return;
  const sender = event.sourceEntity;
  if (!sender || sender.typeId !== "minecraft:player") return;
  
  system.run(() => {
    if (!isAdminPlayer(sender)) {
      sender.sendMessage(`${PREFIX} §cSolo los operadores pueden usar este evento.`);
      return;
    }
    if (event.id === "cmd:adminhorda") {
      system.runTimeout(() => showAdminHordeMenu(sender), 2);
      return;
    }
    if (event.id === "cmd:apocalipsis") {
      if (startZombieApocalypse()) sender.sendMessage(`${PREFIX} §a¡Apocalipsis zombie iniciado!`);
      else sender.sendMessage(`${PREFIX} §cYa hay un evento en curso o el lugar no está cargado.`);
      return;
    }
    if (activeHorde.active || activeApocalypse.active) {
      sender.sendMessage(`${PREFIX} §cYa hay un evento de horda en curso.`);
      return;
    }
    if (startHordeEvent()) {
      sender.sendMessage(`${PREFIX} §a¡Evento de horda iniciado manualmente!`);
    } else {
      sender.sendMessage(`${PREFIX} §cEl lugar de la horda no está cargado. Acércate o usa un ticking area antes de iniciar la horda.`);
    }
  });
});

function registerCustomCommands() {
  const startupSignal = system?.beforeEvents?.startup;
  if (!startupSignal || typeof startupSignal.subscribe !== "function") return;
  startupSignal.subscribe((event) => {
    const registry = event?.customCommandRegistry;
    const register = typeof registry?.registerCommand === "function" ? registry.registerCommand.bind(registry) : typeof registry?.register === "function" ? registry.register.bind(registry) : undefined;
    if (!register) return;
    try {
      register({
        name: `${COMMAND_NAMESPACE}:hordastart`,
        description: "Inicia el evento de horda",
        permissionLevel: ADMIN_PERMISSION
      }, (origin) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo jugadores");
        system.run(() => {
          if (activeHorde.active) return sender.sendMessage(`${PREFIX} §cYa hay un evento en curso.`);
          if (!startHordeEvent()) {
            sender.sendMessage(`${PREFIX} §cEl lugar de la horda no está cargado. Acércate o usa un ticking area antes de iniciar la horda.`);
          }
        });
        return commandOk("Solicitud de horda recibida.");
      });
      register({
        name: `${COMMAND_NAMESPACE}:apocalipsis`,
        description: "Inicia el apocalipsis zombie de cinco oleadas",
        permissionLevel: ADMIN_PERMISSION
      }, (origin) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo jugadores");
        system.run(() => {
          if (activeHorde.active || activeApocalypse.active) {
            sender.sendMessage(`${PREFIX} §cYa hay un evento en curso.`);
            return;
          }
          if (!startZombieApocalypse()) {
            sender.sendMessage(`${PREFIX} §cEl lugar de la horda no está cargado. Acércate o usa un ticking area antes de iniciar el apocalipsis.`);
          }
        });
        return commandOk("Solicitud de apocalipsis recibida.");
      });
      register({
        name: `${COMMAND_NAMESPACE}:adminhorda`,
        description: "Configura el lugar y la recompensa de la horda",
        permissionLevel: ADMIN_PERMISSION
      }, (origin) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo jugadores");
        system.runTimeout(() => showAdminHordeMenu(sender, true), 2);
        return commandOk("Abriendo admin de horda.");
      });
      register({
        name: `${COMMAND_NAMESPACE}:expedicion`,
        description: "Consulta y reclama recompensas de expediciones",
        permissionLevel: CommandPermissionLevel.Any
      }, (origin) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo jugadores");
        system.runTimeout(() => showExpeditionMenu(sender), 2);
        return commandOk("Abriendo expedición.");
      });
      register({
        name: `${COMMAND_NAMESPACE}:adminexpedicion`,
        description: "Configura e inicia el jefe de expedición",
        permissionLevel: ADMIN_PERMISSION
      }, (origin) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo jugadores");
        if (!isAdminPlayer(sender)) return commandError("Solo operadores");
        system.runTimeout(() => showAdminExpeditionMenu(sender), 2);
        return commandOk("Abriendo administración de expedición.");
      });
    } catch (e) {
      reportRuntimeError(e);
    }
  });
}
registerCustomCommands();
