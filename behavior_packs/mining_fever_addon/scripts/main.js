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
globalThis.__sqlite_sync_complete_v2__.delete("mining_fever_addon");
globalThis.__sqlite_request_sync_v3__("mining_fever_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("mining_fever_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("mining_fever_addon", 1);
  } catch (e) {}
}, 120);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
const COMMAND_NAMESPACE = "s";
const ADMIN_PERMISSION =
  CommandPermissionLevel.GameDirectors ??
  CommandPermissionLevel.Admin ??
  CommandPermissionLevel.Host ??
  CommandPermissionLevel.Owner ??
  CommandPermissionLevel.Any;

function commandOk(message) { return { status: CustomCommandStatus.Success, message }; }
function commandError(message) { return { status: CustomCommandStatus.Failure, message }; }

console.warn("Mining Fever Addon iniciado.");

const CHECK_INTERVAL_SECS = 2 * 60 * 60; // 2 horas
const INITIAL_CHECK_DELAY_SECS = CHECK_INTERVAL_SECS + (17 * 60); // Desfase inicial de 17 minutos
let autoCheckRunId;

const FIEBRE_DURATION_SECS = 15 * 60; // 15 minutos
const MINING_HOURLY_LIMIT = 5000;
const MINING_WINDOW_MS = 60 * 60 * 1000;
const MINING_INCOME_OBJECTIVE = "mining_income";
const MINING_WINDOW_OBJECTIVE = "mining_window";
const MAX_OPERATIONAL_BALANCE = 100000000;
const ECONOMY_DAILY_EMISSION_LIMIT = 50000;
const PLACED_ORE_BUCKET_PREFIX = "mining_placed_ore_v2";
const MAX_TRACKED_ORES_PER_BUCKET = 2048;
const BLOOD_MOON_STATE_PROPERTY = "is_blood_moon";
const BLOOD_MOON_REWARD_MULTIPLIER = 2;
const placedOreCache = new Map();
let placedOreTrackingHealthy = true;

let activeFiebre = {
  active: false
};

const ORE_REWARDS = {
  "minecraft:coal_ore": 2,
  "minecraft:deepslate_coal_ore": 2,
  "minecraft:iron_ore": 5,
  "minecraft:deepslate_iron_ore": 5,
  "minecraft:copper_ore": 3,
  "minecraft:deepslate_copper_ore": 3,
  "minecraft:gold_ore": 10,
  "minecraft:deepslate_gold_ore": 10,
  "minecraft:redstone_ore": 3,
  "minecraft:deepslate_redstone_ore": 3,
  "minecraft:lapis_ore": 4,
  "minecraft:deepslate_lapis_ore": 4,
  "minecraft:diamond_ore": 20,
  "minecraft:deepslate_diamond_ore": 20,
  "minecraft:emerald_ore": 15,
  "minecraft:deepslate_emerald_ore": 15,
  "minecraft:nether_gold_ore": 3,
  "minecraft:quartz_ore": 2,
  "minecraft:ancient_debris": 50
};

const MOB_REWARDS = {
  "minecraft:zombie": 10,
  "minecraft:skeleton": 10,
  "minecraft:creeper": 10,
  "minecraft:spider": 10,
  "minecraft:cave_spider": 10,
  "minecraft:husk": 10,
  "minecraft:stray": 10,
  "minecraft:drowned": 10,
  "minecraft:zombie_villager": 10,
  "minecraft:slime": 5,
  "minecraft:magma_cube": 5,
  "minecraft:phantom": 25,
  "minecraft:witch": 25,
  "minecraft:enderman": 25,
  "minecraft:piglin": 15,
  "minecraft:piglin_brute": 40,
  "minecraft:hoglin": 20,
  "minecraft:zoglin": 20,
  "minecraft:ghast": 35,
  "minecraft:blaze": 25,
  "minecraft:wither_skeleton": 20,
  "minecraft:guardian": 30,
  "minecraft:shulker": 40,
  "minecraft:ravager": 150,
  "minecraft:evoker": 150,
  "minecraft:elder_guardian": 300,
  "minecraft:warden": 1500,
  "minecraft:wither": 2500,
  "minecraft:ender_dragon": 3000
};

// Debe coincidir con los mobs que Blood Moon fortalece en el Overworld. El
// multiplicador se aplica en el único flujo que paga caza para evitar dobles
// depósitos desde dos addons distintos.
const BLOOD_MOON_REWARD_MOBS = new Set([
  "minecraft:zombie",
  "minecraft:skeleton",
  "minecraft:creeper",
  "minecraft:spider",
  "minecraft:drowned",
  "minecraft:husk",
  "minecraft:stray",
  "minecraft:enderman",
  "minecraft:witch",
  "minecraft:phantom"
]);

function hasBloodMoonHuntingBonus(entity) {
  if (!entity) return false;
  try {
    if (!BLOOD_MOON_REWARD_MOBS.has(entity.typeId)) {
      return false;
    }
    let inOverworld = true;
    try {
      if (entity.dimension && entity.dimension?.id !== "minecraft:overworld") {
        inOverworld = false;
      }
    } catch (dimErr) {
      // Ignorar InvalidEntityError, asumimos que estaba en el overworld ya que de ahí provienen las alertas
    }
    if (!inOverworld) return false;
    return globalThis.__sqlite_get_prop_v2__("mining_fever_addon", "world", BLOOD_MOON_STATE_PROPERTY) === true;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "mining_fever_addon", moduleId: "main.js", operation: "hasBloodMoonHuntingBonus", category: "runtime" });
    return false;
  }
}

function getObjective() {
  let objective = world.scoreboard.getObjective("money");
  if (!objective) {
    try {
      objective = world.scoreboard.addObjective("money", "§e$ Dinero");
    } catch (e) { ErrorReporter.report(e, { addonId: "mining_fever_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }
  return objective;
}

function getEmissionBudget(player) {
  const day = Math.floor(Date.now() / 86400000);
  try {
    const dayObjective = world.scoreboard.getObjective("emission_day") || world.scoreboard.addObjective("emission_day", "Emission Day");
    const earnedObjective = world.scoreboard.getObjective("emission_earned") || world.scoreboard.addObjective("emission_earned", "Emission Earned");
    const storedDay = Number(dayObjective.getScore(player) ?? -1);
    if (storedDay !== day) {
      if (storedDay !== -1) return { day, earned: 0 };
      const raw = globalThis.__sqlite_get_prop_v2__("mining_fever_addon", player, "economy_emission_budget_v1");
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
    ErrorReporter.report(e, { addonId: "mining_fever_addon", moduleId: "main.js", operation: "getEmissionBudget", category: "runtime" });
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
    ErrorReporter.report(e, { addonId: "mining_fever_addon", moduleId: "main.js", operation: "saveEmissionBudget", category: "runtime" });
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

function addBalance(player, amount) {
  const obj = getObjective();
  if (!obj) return false;
  try {
    const current = (function(o, p){ try{return o.getScore(p) ?? 0;}catch(e){try{return o.getScore(p.name) ?? 0;}catch(e2){return 0;}} })(obj, player) ?? 0;
    const next = Math.max(0, Math.floor(current + amount));
    if (next > MAX_OPERATIONAL_BALANCE) return false;
    try {
      obj.setScore(player, next);
    } catch (participantError) {
      obj.setScore(player.name, next);
    }
    return ((function(o, p){ try{return o.getScore(p) ?? 0;}catch(e){try{return o.getScore(p.name) ?? 0;}catch(e2){return -1;}} })(obj, player) ?? -1) === next;
  } catch (e) { ErrorReporter.report(e, { addonId: "mining_fever_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return false;
  }
}

function getDimensionCode(dimensionId) {
  if (dimensionId === "minecraft:nether") return "n";
  if (dimensionId === "minecraft:the_end") return "e";
  return "o";
}

function encodeSigned(value) {
  const integer = Math.trunc(Number(value) || 0);
  return integer < 0 ? `n${Math.abs(integer).toString(36)}` : `p${integer.toString(36)}`;
}

function getPlacedOreBucketInfo(dimensionId, location) {
  const x = Math.floor(location.x);
  const y = Math.floor(location.y);
  const z = Math.floor(location.z);
  const chunkX = Math.floor(x / 16);
  const chunkZ = Math.floor(z / 16);
  const sectionY = Math.floor(y / 8);
  const localX = ((x % 16) + 16) % 16;
  const localZ = ((z % 16) + 16) % 16;
  const localY = ((y % 8) + 8) % 8;
  return {
    key: `${PLACED_ORE_BUCKET_PREFIX}_${getDimensionCode(dimensionId)}_${encodeSigned(chunkX)}_${encodeSigned(sectionY)}_${encodeSigned(chunkZ)}`,
    position: `${localX.toString(36)}.${localY.toString(36)}.${localZ.toString(36)}`
  };
}

function disablePlacedOreTracking(operation, error) {
  if (placedOreTrackingHealthy) {
    console.warn(`[ECONOMY_CRITICAL] ore_tracking_disabled operation=${operation} cause=persistence_or_integrity_failure`);
  }
  placedOreTrackingHealthy = false;
  if (error) {
    ErrorReporter.report(error, { addonId: "mining_fever_addon", moduleId: "main.js", operation, category: "runtime" });
  }
}

function loadPlacedOreBucket(key) {
  if (placedOreCache.has(key)) return placedOreCache.get(key);
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("mining_fever_addon", "world", key);
    const parsed = raw ? JSON.parse(String(raw)) : {};
    if (raw && (typeof parsed !== "object" || parsed === null ||
        (parsed.positions !== undefined && !Array.isArray(parsed.positions)) ||
        (Array.isArray(parsed.positions) && parsed.positions.length > MAX_TRACKED_ORES_PER_BUCKET))) {
      throw new Error("Formato de bucket de menas inválido.");
    }
    const bucket = {
      overflow: parsed.overflow === true,
      positions: new Set(Array.isArray(parsed.positions) ? parsed.positions.map(String) : [])
    };
    placedOreCache.set(key, bucket);
    return bucket;
  } catch (e) {
    disablePlacedOreTracking("loadPlacedOreBucket", e);
    const bucket = { overflow: true, positions: new Set() };
    placedOreCache.set(key, bucket);
    return bucket;
  }
}

function savePlacedOreBucket(key, bucket) {
  try {
    const serialized = JSON.stringify({
      overflow: bucket.overflow === true,
      positions: [...bucket.positions]
    });
    globalThis.__sqlite_set_prop_v2__("mining_fever_addon", "world", key, serialized);
    if (String(globalThis.__sqlite_get_prop_v2__("mining_fever_addon", "world", key) ?? "") !== serialized) {
      throw new Error("La verificación del bucket de menas no coincide.");
    }
    return true;
  } catch (e) {
    bucket.overflow = true;
    disablePlacedOreTracking("savePlacedOreBucket", e);
    return false;
  }
}

function rememberPlacedOre(dimensionId, location) {
  if (!placedOreTrackingHealthy) return false;
  const info = getPlacedOreBucketInfo(dimensionId, location);
  const bucket = loadPlacedOreBucket(info.key);
  if (!placedOreTrackingHealthy) return false;
  if (bucket.overflow || bucket.positions.has(info.position)) return true;
  if (bucket.positions.size >= MAX_TRACKED_ORES_PER_BUCKET) {
    bucket.overflow = true;
  } else {
    bucket.positions.add(info.position);
  }
  return savePlacedOreBucket(info.key, bucket);
}

function isPlayerPlacedOre(dimensionId, location) {
  if (!placedOreTrackingHealthy) return true;
  const info = getPlacedOreBucketInfo(dimensionId, location);
  const bucket = loadPlacedOreBucket(info.key);
  return !placedOreTrackingHealthy || bucket.overflow || bucket.positions.has(info.position);
}

function forgetPlacedOre(dimensionId, location) {
  if (!placedOreTrackingHealthy) return false;
  const info = getPlacedOreBucketInfo(dimensionId, location);
  const bucket = loadPlacedOreBucket(info.key);
  if (!placedOreTrackingHealthy || bucket.overflow || !bucket.positions.delete(info.position)) return false;
  return savePlacedOreBucket(info.key, bucket);
}

function loadIncomeLimit(player) {
  try {
    const hour = Math.floor(Date.now() / MINING_WINDOW_MS);
    const income = world.scoreboard.getObjective(MINING_INCOME_OBJECTIVE) || world.scoreboard.addObjective(MINING_INCOME_OBJECTIVE, "Mining Income");
    const window = world.scoreboard.getObjective(MINING_WINDOW_OBJECTIVE) || world.scoreboard.addObjective(MINING_WINDOW_OBJECTIVE, "Mining Window");
    const savedHour = Number(window.getScore(player) ?? -1);
    if (savedHour !== hour) {
      window.setScore(player, hour);
      income.setScore(player, 0);
      return { windowStart: hour * MINING_WINDOW_MS, earned: 0 };
    }
    return { windowStart: hour * MINING_WINDOW_MS, earned: Math.max(0, Math.floor(Number(income.getScore(player) ?? 0))) };
  } catch (e) {
    ErrorReporter.report(e, { addonId: "mining_fever_addon", moduleId: "main.js", operation: "loadIncomeLimit", category: "runtime" });
    return { windowStart: now, earned: MINING_HOURLY_LIMIT };
  }
}

function saveIncomeLimit(player, limit) {
  try {
    const income = world.scoreboard.getObjective(MINING_INCOME_OBJECTIVE) || world.scoreboard.addObjective(MINING_INCOME_OBJECTIVE, "Mining Income");
    income.setScore(player, Math.max(0, Math.floor(Number(limit.earned) || 0)));
    return true;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "mining_fever_addon", moduleId: "main.js", operation: "saveIncomeLimit", category: "runtime" });
    return false;
  }
}

function payMiningReward(player, requestedAmount) {
  const limit = loadIncomeLimit(player);
  const remaining = Math.max(0, MINING_HOURLY_LIMIT - limit.earned);
  const amount = Math.min(remaining, Math.max(0, Math.floor(Number(requestedAmount) || 0)));
  if (amount <= 0) return 0;
  const previousEarned = limit.earned;
  limit.earned += amount;
  if (!saveIncomeLimit(player, limit)) return 0;
  const emissionReservation = reserveEmission(player, amount, "mining_reward");
  if (!emissionReservation) {
    limit.earned = previousEarned;
    saveIncomeLimit(player, limit);
    return 0;
  }
  if (!addBalance(player, amount)) {
    rollbackEmission(player, emissionReservation);
    limit.earned = previousEarned;
    saveIncomeLimit(player, limit);
    return 0;
  }
  commitEmission(player, emissionReservation);
  return amount;
}

const placeBlockAfterEvent = world.afterEvents?.playerPlaceBlock;
if (placeBlockAfterEvent && typeof placeBlockAfterEvent.subscribe === "function") {
  placeBlockAfterEvent.subscribe((event) => {
    try {
      const block = event.block;
      if (block && ORE_REWARDS[block.typeId] !== undefined) {
        rememberPlacedOre(block.dimension.id, block.location);
      }
    } catch (e) {
      disablePlacedOreTracking("playerPlaceBlock", e);
    }
  });
} else {
  disablePlacedOreTracking("playerPlaceBlockUnavailable", new Error("playerPlaceBlock no está disponible."));
}

const pistonAfterEvent = world.afterEvents?.pistonActivate;
if (pistonAfterEvent && typeof pistonAfterEvent.subscribe === "function") {
  pistonAfterEvent.subscribe((event) => {
    try {
      const attached = typeof event.piston?.getAttachedBlocks === "function"
        ? event.piston.getAttachedBlocks()
        : typeof event.piston?.getAttachedBlocksLocations === "function"
          ? event.piston.getAttachedBlocksLocations()
          : [];
      for (const entry of attached) {
        const block = entry?.typeId ? entry : event.block?.dimension?.getBlock(entry);
        if (block && ORE_REWARDS[block.typeId] !== undefined) {
          rememberPlacedOre(block.dimension.id, block.location);
        }
      }
    } catch (e) {
      disablePlacedOreTracking("pistonActivate", e);
    }
  });
}

world.afterEvents.playerBreakBlock.subscribe((event) => {
  const player = event.player;
  const blockTypeId =
    event.brokenBlockPermutation?.type?.id ||
    event.brokenBlockPermutation?.typeId ||
    event.block?.typeId;
  
  if (ORE_REWARDS[blockTypeId] !== undefined) {
    const wasPlayerPlaced = isPlayerPlacedOre(player.dimension.id, event.block.location);
    if (!placedOreTrackingHealthy) {
      player.onScreenDisplay.setActionBar("§cPagos de minería pausados por protección anti-exploit.");
      return;
    }
    if (wasPlayerPlaced) {
      forgetPlacedOre(player.dimension.id, event.block.location);
      player.onScreenDisplay.setActionBar("§7Las menas colocadas no generan dinero.");
      return;
    }
    let amount = ORE_REWARDS[blockTypeId];
    
    const isGoldOrIron = [
      "minecraft:iron_ore", 
      "minecraft:deepslate_iron_ore", 
      "minecraft:gold_ore", 
      "minecraft:deepslate_gold_ore"
    ].includes(blockTypeId);
    
    let bonusText = "";
    if (activeFiebre.active && isGoldOrIron) {
      amount *= 2;
      bonusText = " §6§l(¡X2 FIEBRE!)";
    }
    
    const paid = payMiningReward(player, amount);
    if (paid > 0) {
      player.onScreenDisplay.setActionBar(`§e+ $${paid} §7(Minería)${bonusText}`);
    } else {
      player.onScreenDisplay.setActionBar(`§7Límite de minería: §e$${MINING_HOURLY_LIMIT} por hora§7.`);
    }
  }
});

world.afterEvents.entityDie.subscribe((event) => {
  const deadEntity = event.deadEntity;
  const damageSource = event.damageSource;
  if (!deadEntity) return;
  
  const killer = damageSource?.damagingEntity;
  if (!killer || killer.typeId !== "minecraft:player") return;
  
  const typeId = deadEntity.typeId;
  if (MOB_REWARDS[typeId] !== undefined) {
    const bloodMoonBonus = hasBloodMoonHuntingBonus(deadEntity);
    const amount = MOB_REWARDS[typeId] * (bloodMoonBonus ? BLOOD_MOON_REWARD_MULTIPLIER : 1);
    let mobName = typeId.replace("minecraft:", "").replace(/_/g, " ");
    mobName = mobName.charAt(0).toUpperCase() + mobName.slice(1);
    
    const paid = payMiningReward(killer, amount);
    if (paid > 0) {
      const bonusText = bloodMoonBonus ? " §c§l(¡X2 LUNA DE SANGRE!)" : "";
      killer.onScreenDisplay.setActionBar(`§e+ $${paid} §7(Derrotar ${mobName})${bonusText}`);
    } else {
      killer.onScreenDisplay.setActionBar(`§7Límite de minería y caza: §e$${MINING_HOURLY_LIMIT} por hora§7.`);
    }
  }
});

function startFiebreEvent() {
  if (activeFiebre.active) return;
  activeFiebre.active = true;
  world.sendMessage("§b§l[§3Fiebre§b§l]§r §d¡EVENTO INICIADO! Fiebre de Minería activa por 15 minutos.\n§7¡El Hierro y el Oro otorgan el §e§lDOBLE §7de dinero!");

  system.runTimeout(() => {
    if (activeFiebre.active) {
      world.sendMessage("§b§l[§3Fiebre§b§l]§r §7¡Quedan §e10 minutos §7de Fiebre de Minería!");
    }
  }, (FIEBRE_DURATION_SECS - (10 * 60)) * 20);
  system.runTimeout(() => {
    if (activeFiebre.active) {
      world.sendMessage("§b§l[§3Fiebre§b§l]§r §7¡Quedan §e5 minutos §7de Fiebre de Minería! Aprovecha a minar Hierro y Oro.");
    }
  }, (FIEBRE_DURATION_SECS - (5 * 60)) * 20);
  system.runTimeout(() => {
    if (activeFiebre.active) {
      world.sendMessage("§b§l[§3Fiebre§b§l]§r §7¡Último §c1 minuto §7de Fiebre de Minería!");
    }
  }, (FIEBRE_DURATION_SECS - 60) * 20);
  system.runTimeout(() => {
    if (activeFiebre.active) endFiebre();
  }, FIEBRE_DURATION_SECS * 20);
}

function endFiebre() {
  activeFiebre.active = false;
  world.sendMessage("§b§l[§3Fiebre§b§l]§r §cEl evento de Fiebre de Minería ha terminado. Los valores de minería vuelven a la normalidad.");
}

function scheduleAutoCheck(delaySeconds) {
  if (autoCheckRunId !== undefined) {
    system.clearRun(autoCheckRunId);
  }

  autoCheckRunId = system.runTimeout(() => {
    autoCheckRunId = undefined;
    scheduleAutoCheck(CHECK_INTERVAL_SECS);
    if (Math.random() < 0.20 && !activeFiebre.active) {
      startFiebreEvent();
    }
  }, delaySeconds * 20);
}

scheduleAutoCheck(INITIAL_CHECK_DELAY_SECS);

// Manejador por /scriptevent
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "cmd:fiebrestart") return;
  const sender = event.sourceEntity;
  if (!sender || sender.typeId !== "minecraft:player") return;
  
  system.run(() => {
    const isOp = sender.hasTag("op") || sender.hasTag("admin");
    if (!isOp) {
      sender.sendMessage("§b§l[§3Fiebre§b§l]§r §cSolo los operadores pueden iniciar este evento.");
      return;
    }
    if (activeFiebre.active) {
      sender.sendMessage("§b§l[§3Fiebre§b§l]§r §cYa hay un evento de Fiebre de Minería en curso.");
      return;
    }
    startFiebreEvent();
    scheduleAutoCheck(CHECK_INTERVAL_SECS);
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
      for (const name of ["iniciarfiebre", "fiebrestart"]) {
        register({
          name: `${COMMAND_NAMESPACE}:${name}`,
          description: "Inicia el evento de fiebre de minería",
          permissionLevel: ADMIN_PERMISSION
        }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo jugadores");
          system.run(() => {
            if (activeFiebre.active) return sender.sendMessage("§b§l[§3Fiebre§b§l]§r §cYa hay un evento en curso.");
            startFiebreEvent();
            scheduleAutoCheck(CHECK_INTERVAL_SECS);
          });
          return commandOk("Fiebre iniciada.");
        });
      }
    } catch (e) { ErrorReporter.report(e, { addonId: "mining_fever_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  });
}
registerCustomCommands();
