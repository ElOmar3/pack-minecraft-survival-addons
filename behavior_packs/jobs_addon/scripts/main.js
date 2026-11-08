import { ErrorReporter } from "./ErrorReporter.js";
import { CommandPermissionLevel, CustomCommandStatus, PlayerPermissionLevel, world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";






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
globalThis.__sqlite_sync_complete_v2__.delete("jobs_addon");
globalThis.__sqlite_request_sync_v3__("jobs_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("jobs_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("jobs_addon", 1);
  } catch (e) {}
}, 120);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
console.warn("Jobs Addon iniciado.");

const COMMAND_NAMESPACE = "s";
const ADMIN_PERMISSION =
  CommandPermissionLevel.GameDirectors ??
  CommandPermissionLevel.Admin ??
  CommandPermissionLevel.Host ??
  CommandPermissionLevel.Owner ??
  CommandPermissionLevel.Any;

const JOB_PROPERTY_KEY = "active_job";
const JOB_TASK_PROPERTY_KEY = "active_job_task";
const JOB_STATS_PROPERTY_KEY = "job_stats";
const JOB_STATIONS_KEY = "job_stations";
const JOB_NPC_TAG = "job_master_npc";
const JOB_NPC_NAME = "§6§lOficina de Trabajo";
const JOB_CHANGE_COOLDOWN_MS = 30 * 60 * 1000;
const JOB_REROLL_COST = 500;
const JOB_REROLL_COOLDOWN_MS = 15 * 60 * 1000;
const JOB_DELIVERY_COOLDOWN_MS = 60 * 1000;
const JOB_DAILY_EARNINGS_LIMIT = 25000;
const JOB_MAX_TASK_REWARD = 2500;
const MAX_OPERATIONAL_BALANCE = 100000000;
const ECONOMY_DAILY_EMISSION_LIMIT = 50000;
const JOB_STATION_USE_RADIUS = 6;
const activeJobTransactions = new Set();

// Cap at 80% of the current NPC purchase cost so buying a delivery can never
// produce an immediate profit. Unlisted tasks are still capped globally.
const PURCHASED_TASK_REWARD_CAPS = new Map([
  ["minecraft:coal:64", 512],
  ["minecraft:iron_ingot:32", 512],
  ["minecraft:redstone:64", 409],
  ["minecraft:lapis_lazuli:48", 576],
  ["minecraft:diamond:12", 960],
  ["minecraft:emerald:10", 640],
  ["minecraft:netherite_scrap:4", 1440],
  ["minecraft:oak_log:64", 409],
  ["minecraft:spruce_log:64", 409],
  ["minecraft:birch_log:64", 409],
  ["minecraft:dark_oak_log:64", 460],
  ["minecraft:oak_planks:64", 153],
  ["minecraft:mangrove_log:64", 512],
  ["minecraft:cherry_log:64", 512],
  ["minecraft:wheat:64", 153],
  ["minecraft:carrot:64", 102],
  ["minecraft:potato:64", 102],
  ["minecraft:sugar_cane:64", 256],
  ["minecraft:pumpkin:32", 256],
  ["minecraft:melon_block:32", 256],
  ["minecraft:nether_wart:64", 1024],
  ["minecraft:bone:32", 204],
  ["minecraft:string:32", 153],
  ["minecraft:gunpowder:24", 288],
  ["minecraft:ender_pearl:12", 288],
  ["minecraft:blaze_rod:12", 480],
  ["minecraft:ghast_tear:6", 960],
  ["minecraft:nautilus_shell:8", 1500],
  ["minecraft:stone:64", 102],
  ["minecraft:cobblestone:64", 51],
  ["minecraft:glass:64", 256],
  ["minecraft:stonebrick:64", 256],
  ["minecraft:quartz_block:32", 768],
  ["minecraft:obsidian:32", 1280],
  ["minecraft:nether_wart:48", 768],
  ["minecraft:magma_cream:16", 256],
  ["minecraft:ghast_tear:8", 1280]
]);

const JOBS = [
  {
    id: "miner",
    name: "Minero",
    description: "Acepta encargos de minerales y materiales de mina.",
    tasks: [
      { itemId: "minecraft:coal", amount: 64, reward: 760, label: "Carbón" },
      { itemId: "minecraft:iron_ingot", amount: 32, reward: 980, label: "Lingote de Hierro" },
      { itemId: "minecraft:redstone", amount: 64, reward: 720, label: "Redstone" },
      { itemId: "minecraft:lapis_lazuli", amount: 48, reward: 920, label: "Lapislázuli" },
      { itemId: "minecraft:diamond", amount: 12, reward: 2600, label: "Diamante" },
      { itemId: "minecraft:emerald", amount: 10, reward: 2500, label: "Esmeralda" },
      { itemId: "minecraft:netherite_scrap", amount: 4, reward: 1500, label: "Netherite Scrap" }
    ]
  },
  {
    id: "lumberjack",
    name: "Leñador",
    description: "Entrega troncos y madera procesada al aserradero.",
    tasks: [
      { itemId: "minecraft:oak_log", amount: 64, reward: 420, label: "Tronco de Roble" },
      { itemId: "minecraft:spruce_log", amount: 64, reward: 420, label: "Tronco de Abeto" },
      { itemId: "minecraft:birch_log", amount: 64, reward: 420, label: "Tronco de Abedul" },
      { itemId: "minecraft:dark_oak_log", amount: 64, reward: 480, label: "Tronco de Roble Oscuro" },
      { itemId: "minecraft:oak_planks", amount: 64, reward: 260, label: "Tablas de Roble" },
      { itemId: "minecraft:mangrove_log", amount: 64, reward: 560, label: "Tronco de Manglar" },
      { itemId: "minecraft:cherry_log", amount: 64, reward: 560, label: "Tronco de Cerezo" }
    ]
  },
  {
    id: "farmer",
    name: "Granjero",
    description: "Surtido de cosechas para el mercado del servidor.",
    tasks: [
      { itemId: "minecraft:wheat", amount: 64, reward: 420, label: "Trigo" },
      { itemId: "minecraft:carrot", amount: 64, reward: 360, label: "Zanahoria" },
      { itemId: "minecraft:potato", amount: 64, reward: 360, label: "Patata" },
      { itemId: "minecraft:sugar_cane", amount: 64, reward: 520, label: "Caña de Azúcar" },
      { itemId: "minecraft:pumpkin", amount: 32, reward: 340, label: "Calabaza" },
      { itemId: "minecraft:melon_block", amount: 32, reward: 360, label: "Bloque de Sandía" },
      { itemId: "minecraft:nether_wart", amount: 64, reward: 520, label: "Verruga del Nether" }
    ]
  },
  {
    id: "hunter",
    name: "Cazador",
    description: "Entrega trofeos y botín de criaturas peligrosas.",
    tasks: [
      { itemId: "minecraft:bone", amount: 32, reward: 420, label: "Hueso" },
      { itemId: "minecraft:string", amount: 32, reward: 420, label: "Hilo" },
      { itemId: "minecraft:gunpowder", amount: 24, reward: 520, label: "Pólvora" },
      { itemId: "minecraft:ender_pearl", amount: 12, reward: 900, label: "Perla de Ender" },
      { itemId: "minecraft:blaze_rod", amount: 12, reward: 1100, label: "Vara de Blaze" },
      { itemId: "minecraft:ghast_tear", amount: 6, reward: 650, label: "Lágrima de Ghast" },
      { itemId: "minecraft:spider_eye", amount: 24, reward: 380, label: "Ojo de Araña" }
    ]
  },
  {
    id: "fisherman",
    name: "Pescador",
    description: "Entrega pescado y tesoros marinos al muelle.",
    tasks: [
      { itemId: "minecraft:cod", amount: 32, reward: 260, label: "Bacalao" },
      { itemId: "minecraft:salmon", amount: 32, reward: 300, label: "Salmón" },
      { itemId: "minecraft:tropical_fish", amount: 24, reward: 340, label: "Pez Tropical" },
      { itemId: "minecraft:pufferfish", amount: 16, reward: 320, label: "Pez Globo" },
      { itemId: "minecraft:nautilus_shell", amount: 8, reward: 700, label: "Caparazón de Nautilus" },
      { itemId: "minecraft:prismarine_shard", amount: 32, reward: 420, label: "Fragmento de Prismarina" }
    ]
  },
  {
    id: "builder",
    name: "Constructor",
    description: "Suministra materiales de obra para proyectos del servidor.",
    tasks: [
      { itemId: "minecraft:stone", amount: 64, reward: 160, label: "Piedra" },
      { itemId: "minecraft:cobblestone", amount: 64, reward: 140, label: "Adoquín" },
      { itemId: "minecraft:glass", amount: 64, reward: 260, label: "Vidrio" },
      { itemId: "minecraft:stonebrick", amount: 64, reward: 240, label: "Ladrillos de Piedra" },
      { itemId: "minecraft:quartz_block", amount: 32, reward: 420, label: "Bloque de Cuarzo" },
      { itemId: "minecraft:obsidian", amount: 32, reward: 620, label: "Obsidiana" }
    ]
  },
  {
    id: "alchemist",
    name: "Alquimista",
    description: "Entrega ingredientes raros y materiales para pociones.",
    tasks: [
      { itemId: "minecraft:nether_wart", amount: 48, reward: 420, label: "Verruga del Nether" },
      { itemId: "minecraft:magma_cream", amount: 16, reward: 280, label: "Crema de Magma" },
      { itemId: "minecraft:glowstone_dust", amount: 24, reward: 260, label: "Polvo de Glowstone" },
      { itemId: "minecraft:fermented_spider_eye", amount: 16, reward: 340, label: "Ojo de Araña Fermentado" },
      { itemId: "minecraft:ghast_tear", amount: 8, reward: 850, label: "Lágrima de Ghast" },
      { itemId: "minecraft:blaze_powder", amount: 24, reward: 520, label: "Polvo de Blaze" }
    ]
  }
];

function commandOk(message) {
  return { status: CustomCommandStatus.Success, message };
}

function commandError(message) {
  return { status: CustomCommandStatus.Failure, message };
}

function isPlayerOp(player) {
  if (!player) return false;
  try {
    if (player.playerPermissionLevel === PlayerPermissionLevel.Operator) return true;
  } catch (e) {}
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
        player.hasTag("Owner")
      ) {
        return true;
      }
    }
  } catch (e) {}

  try {
    const permission = String(player.permission ?? player.commandPermissionLevel ?? "").toLowerCase();
    if (permission.includes("operator") || permission.includes("admin") || permission.includes("host") || permission.includes("owner") || permission.includes("director")) {
      return true;
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "jobs_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  try {
    if (typeof player.isOp === "function") {
      return player.isOp() === true;
    }
    if (player.isOp === true) {
      return true;
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "jobs_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  return false;
}

function safeOpenForm(player, form, onSelect, onCancel = undefined, retryCount = 0) {
  form.show(player).then((response) => {
    if (response.canceled) {
      if (response.cancelationReason === "UserBusy" && retryCount < 5) {
        system.runTimeout(() => safeOpenForm(player, form, onSelect, onCancel, retryCount + 1), 10);
        return;
      }
      if (onCancel) system.run(() => onCancel(response));
      return;
    }
    system.run(() => onSelect(response));
  }).catch((err) => {
    const message = String(err ?? "");
    if (message.includes("Player quit before responding") || message.includes("FormRejectError")) return;
    console.warn(`[Jobs Addon] Error en safeOpenForm: ${err}`);
  });
}

function getMoneyObjective() {
  let obj = world.scoreboard.getObjective("money");
  if (!obj) {
    try {
      obj = world.scoreboard.addObjective("money", "§e$ Dinero");
    } catch (e) { ErrorReporter.report(e, { addonId: "jobs_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }
  return obj;
}

function getEmissionBudget(player) {
  const day = Math.floor(Date.now() / 86400000);
  try {
    const dayObjective = world.scoreboard.getObjective("emission_day") || world.scoreboard.addObjective("emission_day", "Emission Day");
    const earnedObjective = world.scoreboard.getObjective("emission_earned") || world.scoreboard.addObjective("emission_earned", "Emission Earned");
    const storedDay = Number(dayObjective.getScore(player) ?? -1);
    if (storedDay !== day) {
      if (storedDay !== -1) return { day, earned: 0 };
      const raw = globalThis.__sqlite_get_prop_v2__("jobs_addon", player, "economy_emission_budget_v1");
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
    ErrorReporter.report(e, { addonId: "jobs_addon", moduleId: "main.js", operation: "getEmissionBudget", category: "runtime" });
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
    ErrorReporter.report(e, { addonId: "jobs_addon", moduleId: "main.js", operation: "saveEmissionBudget", category: "runtime" });
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
  const obj = getMoneyObjective();
  if (!obj) return false;
  try {
    const current = (function(o, p){ try{return o.getScore(p) ?? 0;}catch(e){try{return o.getScore(p.name) ?? 0;}catch(e2){return 0;}} })(obj, player) ?? 0;
    const delta = Number(amount);
    if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(current)) return false;
    const next = current + delta;
    if (next < 0 || (delta > 0 && next > MAX_OPERATIONAL_BALANCE)) return false;
    try {
      obj.setScore(player, next);
    } catch (participantError) {
      obj.setScore(player.name, next);
    }
    return ((function(o, p){ try{return o.getScore(p) ?? 0;}catch(e){try{return o.getScore(p.name) ?? 0;}catch(e2){return -1;}} })(obj, player) ?? -1) === next;
  } catch (e) { ErrorReporter.report(e, { addonId: "jobs_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return false;
  }
}


function getJobById(jobId) {
  return JOBS.find((job) => job.id === jobId) || null;
}

function getActiveJob(player) {
  return getJobById(String(globalThis.__sqlite_get_prop_v2__("jobs_addon", player, JOB_PROPERTY_KEY) || ""));
}

function loadJobStats(player) {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("jobs_addon", player, JOB_STATS_PROPERTY_KEY);
    const parsed = raw ? JSON.parse(String(raw)) : {};
    return {
      totalDeliveries: Math.max(0, Number(parsed.totalDeliveries) || 0),
      streak: Math.max(0, Number(parsed.streak) || 0),
      lastJobChangeAt: Math.max(0, Number(parsed.lastJobChangeAt) || 0),
      lastRerollAt: Math.max(0, Number(parsed.lastRerollAt) || 0),
      lastDeliveryAt: Math.max(0, Number(parsed.lastDeliveryAt) || 0),
      earningsDay: Math.max(0, Number(parsed.earningsDay) || 0),
      earningsToday: Math.max(0, Number(parsed.earningsToday) || 0),
      deliveriesByJob: typeof parsed.deliveriesByJob === "object" && parsed.deliveriesByJob ? parsed.deliveriesByJob : {}
    };
  } catch (e) { ErrorReporter.report(e, { addonId: "jobs_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return { totalDeliveries: 0, streak: 0, lastJobChangeAt: 0, lastRerollAt: 0, lastDeliveryAt: 0, earningsDay: 0, earningsToday: 0, deliveriesByJob: {} };
  }
}

function saveJobStats(player, stats) {
  globalThis.__sqlite_set_prop_v2__("jobs_addon", player, JOB_STATS_PROPERTY_KEY, JSON.stringify(stats));
}

function loadTask(player) {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("jobs_addon", player, JOB_TASK_PROPERTY_KEY);
    return raw ? JSON.parse(String(raw)) : null;
  } catch (e) { ErrorReporter.report(e, { addonId: "jobs_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return null;
  }
}

function saveTask(player, task) {
  globalThis.__sqlite_set_prop_v2__("jobs_addon", player, JOB_TASK_PROPERTY_KEY, task ? JSON.stringify(task) : "");
}

function getItemLore(item) {
  try {
    return typeof item?.getLore === "function" ? item.getLore() ?? [] : [];
  } catch (e) { ErrorReporter.report(e, { addonId: "jobs_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return [];
  }
}

function getEnchantCount(item) {
  try {
    const enchantable = item?.getComponent?.("minecraft:enchantable");
    const enchantments = enchantable?.getEnchantments?.() ?? [];
    return enchantments.length;
  } catch (e) { ErrorReporter.report(e, { addonId: "jobs_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return 0;
  }
}

function isPlainDeliveryItem(item) {
  if (!item) return false;
  if (item.nameTag) return false;
  if (getItemLore(item).length > 0) return false;
  if (getEnchantCount(item) > 0) return false;
  return true;
}

function getUtcDay() {
  return Math.floor(Date.now() / 86400000);
}

function normalizeDailyJobStats(stats) {
  const today = getUtcDay();
  if (stats.earningsDay !== today) {
    stats.earningsDay = today;
    stats.earningsToday = 0;
  }
  return stats;
}

function getEffectiveTaskReward(task) {
  if (!task) return 0;
  const requested = Math.max(0, Math.floor(Number(task.reward) || 0));
  const purchaseCap = PURCHASED_TASK_REWARD_CAPS.get(`${task.itemId}:${task.amount}`);
  return Math.min(requested, JOB_MAX_TASK_REWARD, purchaseCap ?? JOB_MAX_TASK_REWARD);
}

function assignRandomTask(player, job) {
  if (!job || !job.tasks?.length) return null;
  const previousTask = loadTask(player);
  const candidates = job.tasks.filter((task) => !(previousTask && previousTask.itemId === task.itemId && previousTask.amount === task.amount && job.tasks.length > 1));
  const pool = candidates.length > 0 ? candidates : job.tasks;
  const template = pool[Math.floor(Math.random() * pool.length)];
  const stats = loadJobStats(player);
  const deliveriesForJob = Math.max(0, Number(stats.deliveriesByJob?.[job.id]) || 0);
  const level = 1 + Math.floor(deliveriesForJob / 5);
  const streakBonus = Math.min(0.25, (stats.streak || 0) * 0.02);
  const rewardMultiplier = 1 + Math.min(0.35, (level - 1) * 0.03) + streakBonus;
  const task = {
    jobId: job.id,
    itemId: template.itemId,
    amount: template.amount,
    reward: 0,
    baseReward: template.reward,
    label: template.label,
    level,
    streakBonusPct: Math.round(streakBonus * 100),
    createdAt: Date.now()
  };
  task.reward = getEffectiveTaskReward({ ...task, reward: Math.max(template.reward, Math.round(template.reward * rewardMultiplier)) });
  saveTask(player, task);
  return task;
}

function setActiveJob(player, jobId) {
  const stats = loadJobStats(player);
  globalThis.__sqlite_set_prop_v2__("jobs_addon", player, JOB_PROPERTY_KEY, jobId || "");
  stats.lastJobChangeAt = Date.now();
  stats.streak = 0;
  saveJobStats(player, stats);
  if (!jobId) {
    saveTask(player, null);
    return;
  }
  const job = getJobById(jobId);
  assignRandomTask(player, job);
}

function loadStations() {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("jobs_addon", "world", JOB_STATIONS_KEY);
    return raw ? JSON.parse(String(raw)) : [];
  } catch (e) { ErrorReporter.report(e, { addonId: "jobs_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return [];
  }
}

function saveStations(stations) {
  try {
    globalThis.__sqlite_set_prop_v2__("jobs_addon", "world", JOB_STATIONS_KEY, JSON.stringify(stations));
  } catch (e) { ErrorReporter.report(e, { addonId: "jobs_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
}

function normalizeBlockLoc(loc) {
  return { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) };
}

function getNearestStationForNpc(npc) {
  const stations = loadStations();
  const npcLoc = normalizeBlockLoc(npc.location);
  return stations.find((station) =>
    station.dimension === npc.dimension.id &&
    station.npc.x === npcLoc.x &&
    station.npc.y === npcLoc.y &&
    station.npc.z === npcLoc.z
  ) || null;
}

function getStationContainer(station) {
  if (!station) return null;
  try {
    const dim = world.getDimension(station.dimension);
    const block = dim.getBlock(station.delivery);
    return block?.getComponent("minecraft:inventory")?.container || null;
  } catch (e) { ErrorReporter.report(e, { addonId: "jobs_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return null;
  }
}

function isPlayerNearStation(player, station) {
  if (!player || !station || player.dimension.id !== station.dimension) return false;
  const loc = player.location;
  const dx = loc.x - station.npc.x;
  const dy = loc.y - station.npc.y;
  const dz = loc.z - station.npc.z;
  return Math.hypot(dx, dy, dz) <= JOB_STATION_USE_RADIUS;
}

function getFriendlyItemName(itemId, fallback = "") {
  const raw = fallback || itemId.split(":")[1] || itemId;
  return raw.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function describeTask(task) {
  if (!task) return "§cNo tienes tarea asignada.";
  const levelText = task.level ? `§7Nivel encargo: §b${task.level}§r\n` : "";
  const streakText = task.streakBonusPct ? `§7Bonus racha: §a+${task.streakBonusPct}%§r\n` : "";
  return `\n${levelText}§e${task.amount}x ${task.label || getFriendlyItemName(task.itemId)}§r\n${streakText}§7Pago: §a$${getEffectiveTaskReward(task)}\n`;
}

function openJobsMenu(player, station = null) {
  const activeJob = getActiveJob(player);
  const activeTask = loadTask(player);
  const stats = loadJobStats(player);
  const deliveryText = "§7Entrega directamente desde tu inventario.\n";

  const form = new ActionFormData()
    .title("Oficina de Trabajos")
    .body(
      `§7Trabajo actual: ${activeJob ? `§a${activeJob.name}` : "§cNinguno"}§r\n\n` +
      `§7Entregas totales: §e${stats.totalDeliveries}§r | §7Racha: §a${stats.streak}§r\n\n` +
      `${deliveryText}\n` +
      `§7Tarea actual:${describeTask(activeTask)}\n` +
      "§f--------------------------\n" +
      "§7Selecciona una opción:"
    )
    .button("§aElegir / Cambiar trabajo")
    .button("§bVer tarea actual")
    .button("Entregar pedido")
    .button(`§dCambiar encargo §7(-$${JOB_REROLL_COST})`)
    .button("§cDejar trabajo")
    .button("§8Cerrar");

  safeOpenForm(player, form, (response) => {
    const selection = response.selection;
    if (selection === 0) {
      openJobSelectionMenu(player, station);
      return;
    }
    if (selection === 1) {
      player.sendMessage(`§b§l[§3Trabajos§b§l]§r §7Tu tarea actual es entregar: ${describeTask(activeTask)}`);
      return;
    }
    if (selection === 2) {
      submitTaskFromStation(player, station);
      return;
    }
    if (selection === 3) {
      rerollTask(player);
      return;
    }
    if (selection === 4) {
      setActiveJob(player, "");
      player.sendMessage("§b§l[§3Trabajos§b§l]§r §eHas dejado tu trabajo actual.");
    }
  });
}

function openJobSelectionMenu(player, station = null) {
  const activeJob = getActiveJob(player);
  const form = new ActionFormData()
    .title("§6§lSelecciona Trabajo")
    .body("§7Elige el trabajo que quieres realizar.\n§f--------------------------");

  for (const job of JOBS) {
    const status = activeJob?.id === job.id ? "§a(Activo)" : "§7(Disponible)";
    form.button(`§e${job.name} ${status}\n§7${job.description}`);
  }
  form.button("§8Volver");

  safeOpenForm(player, form, (response) => {
    if (response.selection === undefined) return;
    if (response.selection >= JOBS.length) {
      openJobsMenu(player, station);
      return;
    }
    const selectedJob = JOBS[response.selection];
    const currentJob = getActiveJob(player);
    if (currentJob?.id === selectedJob.id) {
      player.sendMessage("§b§l[§3Trabajos§b§l]§r §eEse trabajo ya está activo. Usa el cambio de encargo para recibir otra tarea.");
      return;
    }
    if (currentJob?.id !== selectedJob.id) {
      const stats = loadJobStats(player);
      const remainingCooldown = JOB_CHANGE_COOLDOWN_MS - (Date.now() - stats.lastJobChangeAt);
      if (stats.lastJobChangeAt > 0 && remainingCooldown > 0) {
        const minutes = Math.ceil(remainingCooldown / 60000);
        player.sendMessage(`§b§l[§3Trabajos§b§l]§r §cDebes esperar §e${minutes} min§c para cambiar de trabajo otra vez.`);
        return;
      }
    }
    setActiveJob(player, selectedJob.id);
    const task = loadTask(player);
    player.sendMessage(`§b§l[§3Trabajos§b§l]§r §aAhora trabajas como §e${selectedJob.name}§a.`);
    player.sendMessage(`§b§l[§3Trabajos§b§l]§r §7Nueva tarea: ${describeTask(task)}`);
  }, () => openJobsMenu(player, station));
}

function rerollTask(player) {
  const job = getActiveJob(player);
  if (!job) {
    player.sendMessage("§b§l[§3Trabajos§b§l]§r §cNo tienes un trabajo activo.");
    return;
  }
  const stats = loadJobStats(player);
  const remainingCooldown = JOB_REROLL_COOLDOWN_MS - (Date.now() - stats.lastRerollAt);
  if (stats.lastRerollAt > 0 && remainingCooldown > 0) {
    const minutes = Math.ceil(remainingCooldown / 60000);
    player.sendMessage(`§b§l[§3Trabajos§b§l]§r §cDebes esperar §e${minutes} min§c para cambiar de encargo otra vez.`);
    return;
  }
  const obj = getMoneyObjective();
  if (!obj) {
    player.sendMessage("§b§l[§3Trabajos§b§l]§r §cNo se pudo acceder al sistema de dinero.");
    return;
  }
  const balance = (function(o, p){ try{return o.getScore(p) ?? 0;}catch(e){try{return o.getScore(p.name) ?? 0;}catch(e2){return 0;}} })(obj, player) ?? 0;
  if (balance < JOB_REROLL_COST) {
    player.sendMessage(`§b§l[§3Trabajos§b§l]§r §cNecesitas §e$${JOB_REROLL_COST} §cpara cambiar de encargo.`);
    return;
  }
  if (!addBalance(player, -JOB_REROLL_COST)) {
    player.sendMessage("§b§l[§3Trabajos§b§l]§r §cNo se pudo confirmar el cobro del cambio de encargo.");
    return;
  }
  const previousTask = loadTask(player);
  const previousStats = JSON.parse(JSON.stringify(stats));
  let task;
  try {
    stats.lastRerollAt = Date.now();
    stats.streak = 0;
    saveJobStats(player, stats);
    task = assignRandomTask(player, job);
  } catch (e) {
    addBalance(player, JOB_REROLL_COST);
    try {
      saveJobStats(player, previousStats);
      saveTask(player, previousTask);
    } catch (restoreError) {
      ErrorReporter.report(restoreError, { addonId: "jobs_addon", moduleId: "main.js", operation: "restoreReroll", category: "runtime" });
    }
    ErrorReporter.report(e, { addonId: "jobs_addon", moduleId: "main.js", operation: "rerollTask", category: "runtime" });
    player.sendMessage("§b§l[§3Trabajos§b§l]§r §cNo se pudo guardar el encargo. El cobro fue reembolsado.");
    return;
  }
  player.sendMessage(`§b§l[§3Trabajos§b§l]§r §aEncargo actualizado. Nuevo pedido:\n${describeTask(task)}`);
}

function removeItemsFromContainer(container, slotIndex, amount) {
  const item = container.getItem(slotIndex);
  if (!item) return false;
  if (item.amount < amount) return false;
  if (item.amount === amount) {
    container.setItem(slotIndex, undefined);
    return true;
  }
  
  // En @minecraft/server v2.0.0, item.clone() a veces no existe o es problemático.
  // Es mejor actualizar la propiedad amount directamente y volver a insertarlo.
  try {
    item.amount = item.amount - amount;
    container.setItem(slotIndex, item);
  } catch (e) { ErrorReporter.report(e, { addonId: "jobs_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    // Fallback: usar una propiedad diferente si la API lo exige
    return false;
  }
  return true;
}

function submitTaskFromStation(player, station) {
  const transactionKey = player?.id || player?.name;
  if (!transactionKey || activeJobTransactions.has(transactionKey)) {
    player.sendMessage("§b§l[§3Trabajos§b§l]§r §cYa hay una entrega en proceso.");
    return;
  }
  activeJobTransactions.add(transactionKey);
  try {
  const activeJob = getActiveJob(player);
  const task = loadTask(player);
  if (!activeJob || !task || task.jobId !== activeJob.id) {
    player.sendMessage("§b§l[§3Trabajos§b§l]§r §cNo tienes una tarea válida asignada.");
    return;
  }

  const stats = normalizeDailyJobStats(loadJobStats(player));
  const remainingCooldown = JOB_DELIVERY_COOLDOWN_MS - (Date.now() - stats.lastDeliveryAt);
  if (stats.lastDeliveryAt > 0 && remainingCooldown > 0) {
    const minutes = Math.ceil(remainingCooldown / 60000);
    player.sendMessage(`§b§l[§3Trabajos§b§l]§r §cDebes esperar §e${minutes} min§c antes de otra entrega.`);
    return;
  }

  const reward = getEffectiveTaskReward(task);
  if (reward <= 0 || stats.earningsToday + reward > JOB_DAILY_EARNINGS_LIMIT) {
    const available = Math.max(0, JOB_DAILY_EARNINGS_LIMIT - stats.earningsToday);
    player.sendMessage(`§b§l[§3Trabajos§b§l]§r §cAlcanzaste el límite diario de trabajos. Disponible hoy: §e$${available}§c.`);
    return;
  }

  const container = station ? getStationContainer(station) : player.getComponent("minecraft:inventory")?.container;
  if (!container) {
    player.sendMessage("§b§l[§3Trabajos§b§l]§r §cNo se pudo acceder a tu inventario.");
    return;
  }
  let slotIndex = -1, slotItem;
  for (let i = 0; i < container.size; i++) { const item = container.getItem(i); if (item?.typeId === task.itemId && isPlainDeliveryItem(item) && item.amount >= task.amount) { slotIndex = i; slotItem = item; break; } }
  if (slotIndex < 0 || !slotItem) { player.sendMessage(`§b§l[§3Trabajos§b§l]§r §cNecesitas §e${task.amount}x ${task.label}§c en tu inventario.`); return; }

  if (!isPlainDeliveryItem(slotItem)) {
    player.sendMessage("§b§l[§3Trabajos§b§l]§r §cEl slot contiene un item con metadata especial. Entrega una versión limpia del material solicitado.");
    return;
  }

  if (slotItem.amount < task.amount) {
    player.sendMessage(`§b§l[§3Trabajos§b§l]§r §cFaltan materiales. Necesitas §e${task.amount}x §cpero solo hay §e${slotItem.amount}x§c en el slot.`);
    return;
  }

  const originalSlotAmount = slotItem.amount;
  if (!removeItemsFromContainer(container, slotIndex, task.amount)) {
    player.sendMessage("§b§l[§3Trabajos§b§l]§r §cNo se pudieron retirar los materiales del slot de entrega.");
    return;
  }

  const previousStats = JSON.parse(JSON.stringify(stats));
  let nextTask;
  try {
    stats.totalDeliveries += 1;
    stats.streak += 1;
    stats.lastDeliveryAt = Date.now();
    stats.earningsToday += reward;
    stats.deliveriesByJob[activeJob.id] = Math.max(0, Number(stats.deliveriesByJob[activeJob.id]) || 0) + 1;
    saveJobStats(player, stats);
    nextTask = assignRandomTask(player, activeJob);
  } catch (stateError) {
    try {
      slotItem.amount = originalSlotAmount;
      container.setItem(slotIndex, slotItem);
      saveJobStats(player, previousStats);
      saveTask(player, task);
    } catch (restoreError) {
      ErrorReporter.report(restoreError, { addonId: "jobs_addon", moduleId: "main.js", operation: "restoreDelivery", category: "runtime" });
    }
    ErrorReporter.report(stateError, { addonId: "jobs_addon", moduleId: "main.js", operation: "commitDelivery", category: "runtime" });
    player.sendMessage("§b§l[§3Trabajos§b§l]§r §cNo se pudo guardar la entrega. Los materiales fueron devueltos.");
    return;
  }

  const emissionReservation = reserveEmission(player, reward, "job_reward");
  if (!emissionReservation) {
    try {
      slotItem.amount = originalSlotAmount;
      container.setItem(slotIndex, slotItem);
      saveJobStats(player, previousStats);
      saveTask(player, task);
    } catch (restoreError) {
      ErrorReporter.report(restoreError, { addonId: "jobs_addon", moduleId: "main.js", operation: "restoreDelivery", category: "runtime" });
    }
    player.sendMessage("§b§l[§3Trabajos§b§l]§r §cAlcanzaste el límite compartido de ingresos de hoy. Los materiales fueron devueltos.");
    return;
  }

  if (!addBalance(player, reward)) {
    rollbackEmission(player, emissionReservation);
    try {
      slotItem.amount = originalSlotAmount;
      container.setItem(slotIndex, slotItem);
      saveJobStats(player, previousStats);
      saveTask(player, task);
    } catch (restoreError) {
      ErrorReporter.report(restoreError, { addonId: "jobs_addon", moduleId: "main.js", operation: "restoreDelivery", category: "runtime" });
    }
    player.sendMessage("§b§l[§3Trabajos§b§l]§r §cNo se pudo acreditar el pago. Los materiales fueron devueltos.");
    return;
  }
  commitEmission(player, emissionReservation);
  player.sendMessage(`§b§l[§3Trabajos§b§l]§r §aEntrega completada. Has cobrado §e$${reward}§a por §e${task.amount}x ${task.label}§a.`);

  if (nextTask) {
    player.sendMessage(`§b§l[§3Trabajos§b§l]§r §7Nueva tarea asignada: ${describeTask(nextTask)}`);
  }
  } finally {
    activeJobTransactions.delete(transactionKey);
  }
}

function spawnJobStation(player) {
  const base = normalizeBlockLoc(player.location);
  const npcLoc = { x: base.x + 1, y: base.y, z: base.z + 1 };
  const deliveryLoc = { x: npcLoc.x + 1, y: npcLoc.y, z: npcLoc.z };
  const stations = loadStations();
  const alreadyExists = stations.some((station) =>
    station.dimension === player.dimension.id &&
    station.npc.x === npcLoc.x &&
    station.npc.y === npcLoc.y &&
    station.npc.z === npcLoc.z
  );
  if (alreadyExists) {
    player.sendMessage("§b§l[§3Trabajos§b§l]§r §cYa existe una estación registrada en esta ubicación.");
    return;
  }

  const npc = player.dimension.spawnEntity("minecraft:npc", npcLoc);
  npc.nameTag = JOB_NPC_NAME;
  npc.addTag("npc_interactivo");
  npc.addTag(JOB_NPC_TAG);

  try {
    const deliveryBlock = player.dimension.getBlock(deliveryLoc);
    if (deliveryBlock) deliveryBlock.setType("minecraft:barrel");
  } catch (e) { ErrorReporter.report(e, { addonId: "jobs_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  stations.push({
    dimension: player.dimension.id,
    npc: npcLoc,
    delivery: deliveryLoc,
    createdAt: Date.now()
  });
  saveStations(stations);

  player.sendMessage(`§b§l[§3Trabajos§b§l]§r §aEstación creada. NPC en §e${npcLoc.x}, ${npcLoc.y}, ${npcLoc.z}§a y slot de entrega en §e${deliveryLoc.x}, ${deliveryLoc.y}, ${deliveryLoc.z}§a.`);
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
      register({
        name: `${COMMAND_NAMESPACE}:trabajos`,
        description: "Abre la oficina de trabajos",
        permissionLevel: CommandPermissionLevel.Any
      }, (origin) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        system.run(() => openJobsMenu(sender));
        return commandOk("Abriendo trabajos.");
      });

      for (const commandName of ["trabajosnpc", "maquinatrabajo"]) {
        register({
          name: `${COMMAND_NAMESPACE}:${commandName}`,
          description: "Genera una estación de trabajos",
          permissionLevel: ADMIN_PERMISSION
        }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          system.run(() => spawnJobStation(sender));
          return commandOk("Generando estación de trabajos.");
        });
      }
    } catch (e) { ErrorReporter.report(e, { addonId: "jobs_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Jobs Addon] Error registrando custom commands: " + e);
    }
  });
}

registerCustomCommands();

try {
  if (system?.afterEvents?.scriptEventReceive && typeof system.afterEvents.scriptEventReceive.subscribe === "function") {
    system.afterEvents.scriptEventReceive.subscribe((event) => {
      if (event.id !== "cmd") return;
      const sender = event.sourceEntity;
      if (!sender || sender.typeId !== "minecraft:player") return;

      const message = String(event.message || "").trim().toLowerCase();
      if (!message) return;

      if (message === "trabajos") {
        system.run(() => openJobsMenu(sender));
        return;
      }

      if (message === "trabajosnpc" || message === "maquinatrabajo") {
        system.run(() => {
          if (!isPlayerOp(sender)) {
            sender.sendMessage("§b§l[§3Trabajos§b§l]§r §cSolo los operadores pueden generar estaciones de trabajo.");
            return;
          }
          spawnJobStation(sender);
        });
      }
    });
  }
} catch (e) { ErrorReporter.report(e, { addonId: "jobs_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Jobs Addon] Error registrando scriptEventReceive: " + e);
}

try {
  if (world.afterEvents && world.afterEvents.playerInteractWithEntity && typeof world.afterEvents.playerInteractWithEntity.subscribe === "function") {
    world.afterEvents.playerInteractWithEntity.subscribe((event) => {
      const player = event.player;
      const target = event.target;
      if (!player || !target) return;
      if (target.typeId !== "minecraft:npc" || !target.hasTag(JOB_NPC_TAG)) return;
      const station = getNearestStationForNpc(target);
      system.run(() => openJobsMenu(player, station));
    });
  }
} catch (e) { ErrorReporter.report(e, { addonId: "jobs_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Jobs Addon] Error registrando playerInteractWithEntity: " + e);
}
