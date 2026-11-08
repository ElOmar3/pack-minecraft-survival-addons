import { ErrorReporter } from "./ErrorReporter.js";
import { CommandPermissionLevel, CustomCommandStatus, world, system, ItemStack } from "@minecraft/server";
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
globalThis.__sqlite_sync_complete_v2__.delete("rewards_addon");
globalThis.__sqlite_request_sync_v3__("rewards_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("rewards_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("rewards_addon", 1);
  } catch (e) {}
}, 120);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
console.warn("Rewards Addon iniciado.");
const COMMAND_NAMESPACE = "s";
const playtimeCache = new Map();
const PLAYTIME_REWARD_SECONDS = 1800;
const PLAYTIME_REWARD_AMOUNT = 250;
const PLAYTIME_RETRY_SECONDS = 60;
const PLAYTIME_FLUSH_INTERVAL_SECONDS = 60;
const MAX_OPERATIONAL_BALANCE = 100000000;
const ECONOMY_DAILY_EMISSION_LIMIT = 50000;
const STARTER_KIT_CLAIM_KEY = "starter_kit_claimed";
const PENDING_PLAYTIME_KEY = "rewards_pending_playtime";
const MAX_PENDING_PLAYTIME_ENTRIES = 500;
const SERVICE_ACCOUNT_NAMES = new Set();
const CRATE_KEY_NAME = "§e§lLlave de Crate Imperial";
const CRATE_KEY_LORE = ["§7Úsala en el cofre del Spawn", "§7para obtener recompensas legendarias."];
const CRATE_KEY_ID_LORE_PREFIX = "§8ID:";
const rewardClaimLocks = new Set();
let pendingPlaytimeRaw;
let pendingPlaytimeCache = {};

function isRewardEligiblePlayer(player) {
  return Boolean(player?.name) && !SERVICE_ACCOUNT_NAMES.has(player.name.trim().toLowerCase());
}

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
    console.warn(`[Recompensas] Error en safeOpenForm: ${err}`);
  });
}

// Economía Scoreboard
function getMoneyObjective() {
  let obj = world.scoreboard.getObjective("money");
  if (!obj) {
    try {
      obj = world.scoreboard.addObjective("money", "§e$ Dinero");
    } catch (e) { ErrorReporter.report(e, { addonId: "rewards_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }
  return obj;
}

function getBalance(player) {
  const obj = getMoneyObjective();
  if (!obj) return 0;
  try {
    const score = obj.getScore(player);
    if (score !== undefined) return score;
  } catch (e) { ErrorReporter.report(e, { addonId: "rewards_addon", moduleId: "main.js", operation: "read_balance_identity", category: "runtime" }); }
  try {
    return obj.getScore(player.name) ?? 0;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "rewards_addon", moduleId: "main.js", operation: "read_balance_name", category: "runtime" });
    return 0;
  }
}


function addPlayerMoney(player, amount) {
  const obj = getMoneyObjective();
  if (!obj) return false;
  const current = getBalance(player);
  return setBalanceExact(obj, player, Math.min(2147483647, current + amount));
}

function setBalanceExact(obj, player, value) {
  try {
    obj.setScore(player, value);
    return obj.getScore(player) === value;
  } catch (e) {
    try {
      obj.setScore(player.name, value);
      return obj.getScore(player.name) === value;
    } catch (e2) {
      ErrorReporter.report(e2, { addonId: "rewards_addon", moduleId: "main.js", operation: "write_balance", category: "runtime" });
      return false;
    }
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
      const raw = globalThis.__sqlite_get_prop_v2__("rewards_addon", player, "economy_emission_budget_v1");
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
    ErrorReporter.report(e, { addonId: "rewards_addon", moduleId: "main.js", operation: "getEmissionBudget", category: "runtime" });
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
    ErrorReporter.report(e, { addonId: "rewards_addon", moduleId: "main.js", operation: "saveEmissionBudget", category: "runtime" });
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

function commitEmission(player, reservation, before, after) {
  console.warn(`[ECONOMY_TX] COMMIT player=${player?.name || "unknown"} delta=${reservation.delta} before=${before} after=${after} reason=${reservation.reason} emission_today=${reservation.reserved.earned} emission_limit=${ECONOMY_DAILY_EMISSION_LIMIT}`);
}

function addBalance(player, amount, reason = "reward") {
  const obj = getMoneyObjective();
  if (!obj) {
    console.warn(`[ECONOMY_TX] REJECT objective_missing player=${player?.name || "unknown"} delta=${amount} reason=${reason}`);
    return false;
  }
  const delta = amount;
  const current = getBalance(player);
  const next = current + delta;
  if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(current) || !Number.isSafeInteger(next) || next < 0 || next > MAX_OPERATIONAL_BALANCE) {
    console.warn(`[ECONOMY_TX] REJECT invalid_balance player=${player?.name || "unknown"} before=${current} delta=${amount} reason=${reason}`);
    return false;
  }
  const emissionReservation = reserveEmission(player, delta, reason);
  if (!emissionReservation) return false;
  if (!setBalanceExact(obj, player, next)) {
    rollbackEmission(player, emissionReservation);
    console.warn(`[ECONOMY_TX] REJECT write_mismatch player=${player?.name || "unknown"} expected=${next} delta=${delta} reason=${reason}`);
    return false;
  }
  commitEmission(player, emissionReservation, current, next);
  return true;
}

// Dar item de forma segura (respetando maxStackSize)
function giveItemSafely(player, typeId, amount, nameTag, lore) {
  let remaining = amount;
  try {
    const tempItem = new ItemStack(typeId, 1);
    const maxStack = tempItem.maxAmount || 64;
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) throw new Error("Inventario no disponible");

    while (remaining > 0) {
      const currentBatch = Math.min(remaining, maxStack);
      const itemStack = new ItemStack(typeId, currentBatch);
      if (nameTag) itemStack.nameTag = nameTag;
      if (lore) itemStack.setLore(lore);

      const leftover = inventory.addItem(itemStack);
      if (leftover) {
        const leftoverAmount = Number(leftover.amount) || currentBatch;
        remaining = remaining - currentBatch + leftoverAmount;
        player.dimension.spawnItem(leftover, player.location);
        remaining -= leftoverAmount;
      } else {
        remaining -= currentBatch;
      }
    }
    return true;
  } catch (err) { ErrorReporter.report(err, { addonId: "rewards_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn(`Error en giveItemSafely: ${err}`);
    try {
      if (remaining <= 0) return true;
      const result = player.runCommand(`give @s ${typeId} ${remaining}`);
      return Number(result?.successCount || 0) > 0;
    } catch (e) {
      ErrorReporter.report(e, { addonId: "rewards_addon", moduleId: "main.js", operation: "fallback_give_item", category: "runtime" });
      return false;
    }
  }
}

function createCrateKey() {
  const key = new ItemStack("minecraft:tripwire_hook", 1);
  const keyId = `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  key.nameTag = CRATE_KEY_NAME;
  key.setLore([...CRATE_KEY_LORE, `${CRATE_KEY_ID_LORE_PREFIX}${keyId}`]);
  return key;
}

function giveCrateKey(player) {
  const key = createCrateKey();
  const inventory = player.getComponent("minecraft:inventory")?.container;
  if (!inventory) return false;
  const leftover = inventory.addItem(key);
  if (leftover) player.dimension.spawnItem(leftover, player.location);
  return true;
}

function grantStarterKit(player) {
  if (!isRewardEligiblePlayer(player)) return false;

  const playerKey = player.name.toLowerCase();
  let starterMoneyCredited = false;
  if (rewardClaimLocks.has(playerKey)) {
    player.sendMessage("§b§l[§3Recompensas§b§l]§r §cYa se está procesando una recompensa.");
    return false;
  }

  if (globalThis.__sqlite_get_prop_v2__("rewards_addon", player, STARTER_KIT_CLAIM_KEY) === true) {
    player.sendMessage("§b§l[§3Recompensas§b§l]§r §cYa reclamaste tu kit inicial. Solo puede obtenerse una vez por jugador.");
    return false;
  }

  rewardClaimLocks.add(playerKey);
  try {
    if (globalThis.__sqlite_get_prop_v2__("rewards_addon", player, STARTER_KIT_CLAIM_KEY) === true) {
      player.sendMessage("§b§l[§3Recompensas§b§l]§r §cYa reclamaste tu kit inicial.");
      return false;
    }
    // Se reserva antes de entregar para que dos callbacks no puedan cobrar el mismo kit.
    globalThis.__sqlite_set_prop_v2__("rewards_addon", player, STARTER_KIT_CLAIM_KEY, true);
    if (!addBalance(player, 1500, "starter_kit")) {
      globalThis.__sqlite_set_prop_v2__("rewards_addon", player, STARTER_KIT_CLAIM_KEY, false);
      player.sendMessage("§b§l[§3Recompensas§b§l]§r §cNo se pudo acreditar el dinero inicial. El reclamo no fue consumido; inténtalo de nuevo.");
      return false;
    }
    starterMoneyCredited = true;

    const starterItems = [
      ["minecraft:iron_sword", 1],
      ["minecraft:iron_pickaxe", 1],
      ["minecraft:iron_axe", 1],
      ["minecraft:iron_shovel", 1],
      ["minecraft:shield", 1],
      ["minecraft:bread", 24],
      ["minecraft:cooked_beef", 16],
      ["minecraft:torch", 32],
      ["minecraft:oak_log", 32],
      ["minecraft:golden_apple", 2],
    ];
    const deliveredAllItems = starterItems.every(([typeId, itemAmount]) => giveItemSafely(player, typeId, itemAmount));
    if (!deliveredAllItems) {
      console.warn(`[ECONOMY_CRITICAL] starter_kit_partial_delivery player=${player.name} credited=1500`);
      player.sendMessage("§b§l[§3Recompensas§b§l]§r §eSe acreditaron §6$1500§e, pero uno o más objetos no pudieron entregarse. Contacta a un administrador.");
      return false;
    }
    player.sendMessage("§b§l[§3Recompensas§b§l]§r §aHas reclamado tu kit inicial. Recibiste herramientas, comida, materiales básicos, escudo y §6$1500§a.");
    return true;
  } catch (e) { ErrorReporter.report(e, { addonId: "rewards_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn("[Recompensas] Error entregando kit inicial: " + e);
    if (starterMoneyCredited) {
      console.warn(`[ECONOMY_CRITICAL] starter_kit_delivery_error player=${player.name} credited=1500 error=${e}`);
      player.sendMessage("§b§l[§3Recompensas§b§l]§r §eSe acreditaron §6$1500§e, pero el kit no pudo entregarse por completo. Contacta a un administrador.");
    } else {
      try {
        globalThis.__sqlite_set_prop_v2__("rewards_addon", player, STARTER_KIT_CLAIM_KEY, false);
      } catch (resetError) {
        ErrorReporter.report(resetError, { addonId: "rewards_addon", moduleId: "main.js", operation: "reset_starter_claim", category: "runtime" });
      }
      player.sendMessage("§b§l[§3Recompensas§b§l]§r §cNo se pudo entregar el kit inicial ni acreditar su dinero. Inténtalo de nuevo.");
    }
    return false;
  } finally {
    rewardClaimLocks.delete(playerKey);
  }
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
      for (const name of ["recompensas", "recompensa"]) {
        register({ name: `${COMMAND_NAMESPACE}:${name}`, description: "Abre el menu de recompensas", permissionLevel: CommandPermissionLevel.Any }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          system.run(() => openRewardsMenu(sender));
          return commandOk("Abriendo recompensas.");
        });
      }
      register({ name: `${COMMAND_NAMESPACE}:kitinicial`, description: "Entrega el kit inicial una sola vez", permissionLevel: CommandPermissionLevel.Any }, (origin) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        system.run(() => grantStarterKit(sender));
        return commandOk("Procesando kit inicial.");
      });
    } catch (e) { ErrorReporter.report(e, { addonId: "rewards_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Recompensas] Error registrando custom commands: " + e);
    }
  });
}

registerCustomCommands();

function loadPendingPlaytime() {
  try {
    const raw = String(globalThis.__sqlite_get_prop_v2__("rewards_addon", "world", PENDING_PLAYTIME_KEY) || "");
    if (raw === pendingPlaytimeRaw) return pendingPlaytimeCache;
    pendingPlaytimeRaw = raw;
    pendingPlaytimeCache = raw ? JSON.parse(raw) : {};
  } catch (e) {
    ErrorReporter.report(e, { addonId: "rewards_addon", moduleId: "main.js", operation: "load_pending_playtime", category: "runtime" });
    pendingPlaytimeCache = {};
  }
  return pendingPlaytimeCache;
}

function savePendingPlaytime(data) {
  try {
    const raw = JSON.stringify(data);
    globalThis.__sqlite_set_prop_v2__("rewards_addon", "world", PENDING_PLAYTIME_KEY, raw);
    pendingPlaytimeRaw = raw;
    pendingPlaytimeCache = data;
    return true;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "rewards_addon", moduleId: "main.js", operation: "save_pending_playtime", category: "runtime" });
    return false;
  }
}

function takePendingPlaytime(playerName) {
  const key = String(playerName || "").trim().toLowerCase();
  const pending = loadPendingPlaytime();
  const entry = pending[key];
  if (!entry) return null;
  const next = { ...pending };
  delete next[key];
  savePendingPlaytime(next);
  return entry;
}

function storePendingPlaytime(playerName, state) {
  const key = String(playerName || "").trim().toLowerCase();
  if (!key || !state) return;
  const pending = loadPendingPlaytime();
  const next = {
    ...pending,
    [key]: {
      rewardSeconds: state.rewardSeconds,
      totalSeconds: state.totalSeconds,
      updatedAt: Date.now(),
    },
  };
  const keys = Object.keys(next);
  if (keys.length > MAX_PENDING_PLAYTIME_ENTRIES) {
    keys.sort((a, b) => Number(next[a]?.updatedAt || 0) - Number(next[b]?.updatedAt || 0));
    for (const expiredKey of keys.slice(0, keys.length - MAX_PENDING_PLAYTIME_ENTRIES)) {
      delete next[expiredKey];
    }
  }
  savePendingPlaytime(next);
}

function getCachedPlaytimeState(player) {
  let state = playtimeCache.get(player.id);
  if (state) {
    state.player = player;
    return state;
  }

  let rewardSeconds = Number(globalThis.__sqlite_get_prop_v2__("rewards_addon", player, "playtime_seconds") || 0);
  let totalSeconds = Number(globalThis.__sqlite_get_prop_v2__("rewards_addon", player, "playtime_total_seconds") || 0);
  const pending = takePendingPlaytime(player.name);
  if (pending && Number(pending.totalSeconds) >= totalSeconds) {
    rewardSeconds = Number(pending.rewardSeconds) || 0;
    totalSeconds = Number(pending.totalSeconds) || 0;
  }

  state = {
    player,
    rewardSeconds,
    totalSeconds,
    lastUpdateTick: system.currentTick,
    rewardRunId: undefined,
    dirty: false,
  };
  playtimeCache.set(player.id, state);
  schedulePlaytimeReward(state);
  return state;
}

function accruePlaytimeState(state) {
  const elapsedTicks = system.currentTick - state.lastUpdateTick;
  const elapsedSeconds = Math.floor(elapsedTicks / 20);
  if (elapsedSeconds <= 0) return;

  state.rewardSeconds += elapsedSeconds;
  state.totalSeconds += elapsedSeconds;
  state.lastUpdateTick += elapsedSeconds * 20;
  state.dirty = true;
}

function schedulePlaytimeReward(state, retrySeconds = undefined) {
  const secondsRemaining = retrySeconds ?? Math.max(1, PLAYTIME_REWARD_SECONDS - state.rewardSeconds);
  state.rewardRunId = system.runTimeout(() => {
    const player = state.player;
    if (playtimeCache.get(player.id) !== state || !player.isValid) return;

    accruePlaytimeState(state);
    let nextRetrySeconds;
    if (state.rewardSeconds >= PLAYTIME_REWARD_SECONDS) {
      if (addBalance(player, PLAYTIME_REWARD_AMOUNT, "playtime_30m")) {
        state.rewardSeconds -= PLAYTIME_REWARD_SECONDS;
        state.dirty = true;
        try {
          player.sendMessage(`§b§l[§3Recompensas§b§l]§r §a¡Has recibido §6$${PLAYTIME_REWARD_AMOUNT} §apor estar conectado activamente 30 minutos!`);
        } catch (e) {
          ErrorReporter.report(e, { addonId: "rewards_addon", moduleId: "main.js", operation: "notify_playtime_reward", category: "runtime" });
        }
      } else {
        nextRetrySeconds = PLAYTIME_RETRY_SECONDS;
      }
    }
    schedulePlaytimeReward(state, nextRetrySeconds);
  }, secondsRemaining * 20);
}

function flushPlaytimeState(player, state) {
  if (!player?.isValid || !state?.dirty) return;
  try {
    globalThis.__sqlite_set_prop_v2__("rewards_addon", player, "playtime_seconds", state.rewardSeconds);
    globalThis.__sqlite_set_prop_v2__("rewards_addon", player, "playtime_total_seconds", state.totalSeconds);
    state.dirty = false;
  } catch (e) { ErrorReporter.report(e, { addonId: "rewards_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
}

try {
  world.afterEvents.playerSpawn.subscribe((event) => {
    if (!isRewardEligiblePlayer(event.player)) return;
    getCachedPlaytimeState(event.player);
  });
  world.afterEvents.playerLeave.subscribe((event) => {
    const state = playtimeCache.get(event.playerId);
    if (state) {
      accruePlaytimeState(state);
      storePendingPlaytime(event.playerName, state);
    }
    if (state?.rewardRunId !== undefined) {
      system.clearRun(state.rewardRunId);
    }
    playtimeCache.delete(event.playerId);
  });
} catch (e) { ErrorReporter.report(e, { addonId: "rewards_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

system.run(() => {
  for (const player of world.getAllPlayers()) {
    if (!isRewardEligiblePlayer(player)) continue;
    getCachedPlaytimeState(player);
  }
});

// Un solo recorrido por minuto acumula y persiste el tiempo de todos los jugadores.
system.runInterval(() => {
  try {
    for (const player of world.getAllPlayers()) {
      if (!isRewardEligiblePlayer(player)) continue;
      const state = getCachedPlaytimeState(player);
      accruePlaytimeState(state);
      flushPlaytimeState(player, state);
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "rewards_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
}, PLAYTIME_FLUSH_INTERVAL_SECONDS * 20);

// Menú de Recompensas
function openRewardsMenu(player) {
  const lastClaim = globalThis.__sqlite_get_prop_v2__("rewards_addon", player, "last_daily_claim") || 0;
  const now = Date.now();
  const diff = now - Number(lastClaim);
  const cooldown = 24 * 60 * 60 * 1000; // 24 horas

  const secondsLeft = Math.max(0, Math.floor((cooldown - diff) / 1000));
  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);

  const cachedState = getCachedPlaytimeState(player);
  accruePlaytimeState(cachedState);
  const totalSecs = cachedState.totalSeconds;
  const tHours = Math.floor(totalSecs / 3600);
  const tMins = Math.floor((totalSecs % 3600) / 60);

  const form = new ActionFormData()
    .title("§d§lRecompensas y Regalos")
    const streakDays = Number(globalThis.__sqlite_get_prop_v2__("rewards_addon", player, "daily_streak") || 0);
    form.body(`§7Tus Estadísticas:\n§7- Tiempo jugado: §e${tHours} horas, ${tMins} minutos§r\n§6🔥 Racha de conexión: §e${streakDays}/30 días consecutivos§r\n§8(Bonos especiales en días 7, 14, 21 y 30)\n\n§7Selecciona un regalo para reclamar:`);

  const dailyReady = diff >= cooldown;
  const buttonDailyText = dailyReady ? "🎁 Kit Diario\n§a¡Disponible ahora!" : `🎁 Kit Diario\n§cDisponible en ${hours}h ${minutes}m`;
  const starterClaimed = globalThis.__sqlite_get_prop_v2__("rewards_addon", player, STARTER_KIT_CLAIM_KEY) === true;
  const starterButtonText = starterClaimed ? "🧰 Kit Inicial\n§8Ya reclamado" : "🧰 Kit Inicial\n§aUna sola vez";

  form.button(buttonDailyText);
  form.button(starterButtonText);
  form.button("❔ ¿Cómo funciona? / Guía");

  safeOpenForm(player, form, (response) => {
    const idx = response.selection;
    if (idx === 0) {
      // Reclamar Kit Diario
      const playerKey = player.name.toLowerCase();
      if (rewardClaimLocks.has(playerKey)) {
        player.sendMessage("§b§l[§3Recompensas§b§l]§r §cYa se está procesando una recompensa.");
        return;
      }

      rewardClaimLocks.add(playerKey);
      try {
        const claimNow = Date.now();
        const currentLastClaim = Number(globalThis.__sqlite_get_prop_v2__("rewards_addon", player, "last_daily_claim") || 0);
        const currentDiff = claimNow - currentLastClaim;
        if (currentDiff < cooldown) {
          const currentSecondsLeft = Math.max(0, Math.ceil((cooldown - currentDiff) / 1000));
          const currentHours = Math.floor(currentSecondsLeft / 3600);
          const currentMinutes = Math.floor((currentSecondsLeft % 3600) / 60);
          player.sendMessage(`§b§l[§3Recompensas§b§l]§r §cDebes esperar §e${currentHours} horas y ${currentMinutes} minutos §cpara volver a reclamar tu kit.`);
          return;
        }

        // Reservar el reclamo antes de entregar evita replays de formularios antiguos.
        globalThis.__sqlite_set_prop_v2__("rewards_addon", player, "last_daily_claim", claimNow);

        // Racha de conexión de 30 días
        let streak = Number(globalThis.__sqlite_get_prop_v2__("rewards_addon", player, "daily_streak") || 0);
        if (currentDiff <= 48 * 60 * 60 * 1000) {
          streak = (streak % 30) + 1;
        } else {
          streak = 1;
        }
        globalThis.__sqlite_set_prop_v2__("rewards_addon", player, "daily_streak", streak);

        // Dar objetos del kit diario base
        giveItemSafely(player, "minecraft:golden_apple", 2);
        giveItemSafely(player, "minecraft:bread", 16);
        giveItemSafely(player, "minecraft:cooked_beef", 8);
        giveItemSafely(player, "minecraft:iron_pickaxe", 1);
        giveItemSafely(player, "minecraft:iron_axe", 1);
        giveCrateKey(player);

        let streakMsg = "";
        if (streak === 7) {
          addPlayerMoney(player, 5000);
          giveCrateKey(player);
          giveCrateKey(player);
          streakMsg = "\n§6★ ¡BONO RACHA DÍA 7! §e+$5,000 y 2 Llaves de Cofre extra.";
        } else if (streak === 14) {
          addPlayerMoney(player, 10000);
          giveItemSafely(player, "minecraft:enchanted_golden_apple", 1);
          streakMsg = "\n§6★ ¡BONO RACHA DÍA 14! §e+$10,000 y 1 Manzana de Notch.";
        } else if (streak === 21) {
          addPlayerMoney(player, 20000);
          giveCrateKey(player);
          giveCrateKey(player);
          giveCrateKey(player);
          streakMsg = "\n§6★ ¡BONO RACHA DÍA 21! §e+$20,000 y 3 Llaves de Cofre extra.";
        } else if (streak === 30) {
          addPlayerMoney(player, 50000);
          giveItemSafely(player, "minecraft:netherite_ingot", 1);
          for (let k = 0; k < 5; k++) giveCrateKey(player);
          streakMsg = "\n§6★ ¡CICLO DE RACHA DÍA 30 COMPLETADO! §e+$50,000, 1 Lingote de Netherite y 5 Llaves.";
          world.sendMessage(`§6§l[RECOMPENSAS] §e¡${player.name} ha completado el ciclo completo de 30 días de racha diaria!`);
        }

        player.sendMessage(`§b§l[§3Recompensas§b§l]§r §a¡Kit Diario reclamado! §6(Racha: ${streak}/30 días)${streakMsg}`);
        try { player.playSound("random.levelup", { pitch: 1.0 }); } catch (e) {}
      } catch (err) { ErrorReporter.report(err, { addonId: "rewards_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
        player.sendMessage("§b§l[§3Recompensas§b§l]§r §cOcurrió un error al entregar el kit.");
      } finally {
        rewardClaimLocks.delete(playerKey);
      }
    } else if (idx === 1) {
      grantStarterKit(player);
    } else if (idx === 2) {
      // Tabla de pagos y guía
      const infoForm = new ActionFormData()
        .title("❔ Guía de Recompensas")
        .body("§e¿Cómo funciona el Sistema de Recompensas?\n\n" +
              "§a1. Kit Diario:\n" +
              "§7- Puedes reclamar un kit de supervivencia básico de forma gratuita cada 24 horas.\n" +
              "§7- El kit incluye comida, herramientas de hierro y §e1 Llave de Crate Imperial §7para abrir cajas de botín.\n\n" +
              "§a2. Kit Inicial:\n" +
              "§7- Puedes reclamarlo una sola vez con §e/s:kitinicial§7 o desde este menú.\n" +
              "§7- Incluye herramientas, comida, materiales básicos, escudo y dinero inicial.\n\n" +
              "§a3. Recompensa por Tiempo de Juego (Pasiva):\n" +
              "§7- El servidor registra el tiempo que pasas conectado activamente.\n" +
              `§7- Cada §e30 minutos §7recibirás de forma automática §a$${PLAYTIME_REWARD_AMOUNT} §7monedas de recompensa.\n\n` +
              "§a4. Otras Formas de Dinero:\n" +
              "§7- Completa las misiones secundarias con §e/s:misiones§7.\n" +
              "§7- Mina menas naturales: todos los minerales vanilla pagan, incluido cobre y escombro ancestral.\n" +
              "§7- Las menas colocadas o movidas no pagan; la minería y caza tienen un límite conjunto de §a$5,000 por hora§7.\n" +
              "§7- Vende tus recursos sobrantes en la tienda con §e/s:tienda§7.")
        .button("🔙 Volver");
      safeOpenForm(player, infoForm, () => {
        openRewardsMenu(player);
      });
    }
  });
}
