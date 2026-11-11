import { ErrorReporter } from "./ErrorReporter.js";
import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, world, system, ItemStack, EquipmentSlot, EnchantmentTypes } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";






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
globalThis.__sqlite_sync_complete_v2__.delete("crates_addon");
globalThis.__sqlite_request_sync_v3__("crates_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("crates_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("crates_addon", 1);
  } catch (e) {}
}, 120);
system.runTimeout(() => {
  // Sin demonio (mundo importado sin bridge) se opera en modo degradado tras ~10s: RAM es la fuente de verdad.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("crates_addon");
    if (state && !state.complete) {
      state.degraded = true;
      globalThis.__sqlite_sync_complete_v2__.set("crates_addon", Date.now());
      globalThis.__sqlite_flush_pending_v3__("crates_addon");
    }
  } catch (e) {}
}, 200);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
console.warn("Crates Addon iniciado.");
const COMMAND_NAMESPACE = "s";
const ADMIN_PERMISSION =
  CommandPermissionLevel.GameDirectors ??
  CommandPermissionLevel.Admin ??
  CommandPermissionLevel.Host ??
  CommandPermissionLevel.Owner ??
  CommandPermissionLevel.Any;

const PREFIX = "§b§l[§3Crates§b§l]§r";
const KEY_NAME = "§e§lLlave de Crate Imperial";
const KEY_LORE = ["§7Úsala en el cofre del Spawn", "§7para obtener recompensas legendarias."];
const KEY_ID_LORE_PREFIX = "§8ID:";
const USED_KEY_PREFIX = "crates_used_key_";
const CRATE_REWARD_MARKER = "§8Recompensa de crate - no vendible al NPC";
const MAX_OPERATIONAL_BALANCE = 100000000;
const ECONOMY_DAILY_EMISSION_LIMIT = 50000;
const activeCrateOpenings = new Set();

function createCrateKey() {
  const key = new ItemStack("minecraft:tripwire_hook", 1);
  const keyId = `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  key.nameTag = KEY_NAME;
  key.setLore([...KEY_LORE, `${KEY_ID_LORE_PREFIX}${keyId}`]);
  return key;
}

function getValidKeyId(item) {
  try {
    if (!item || item.typeId !== "minecraft:tripwire_hook" || item.nameTag !== KEY_NAME) return "";
    const lore = item.getLore?.() ?? [];
    if (lore.length !== KEY_LORE.length + 1 || JSON.stringify(lore.slice(0, KEY_LORE.length)) !== JSON.stringify(KEY_LORE)) return "";
    const keyId = String(lore[KEY_LORE.length] || "").slice(KEY_ID_LORE_PREFIX.length);
    return /^k[a-z0-9]{12,40}$/.test(keyId) ? keyId : "";
  } catch (e) {
    ErrorReporter.report(e, { addonId: "crates_addon", moduleId: "main.js", operation: "key_validation", category: "runtime" });
    return "";
  }
}

// Historial de llaves canjadas con TTL: cada llave consumida dejaba un registro
// permanente en SQLite. Ahora se fecha el canje y un índice acotado permite
// purgar los registros viejos. La llave física se consume al abrir la caja, por
// lo que un horizonte de 90 días no habilita reutilización en el flujo normal.
const USED_KEY_INDEX_KEY = "crates_used_keys_index_v1";
const USED_KEY_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const USED_KEY_INDEX_LIMIT = 20000;
const USED_KEY_PURGE_INTERVAL_TICKS = 12000;

function getUsedKeyIndex() {
  const raw = globalThis.__sqlite_get_prop_v2__("crates_addon", "world", USED_KEY_INDEX_KEY);
  const parsed = globalThis.__sqlite_read_json_v3__(raw, {});
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function isKeyRedeemed(keyId) {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("crates_addon", "world", `${USED_KEY_PREFIX}${keyId}`);
    if (raw === undefined || raw === null || raw === false) return false;
    // Legacy: los registros previos al TTL guardaban `true` sin fecha; se datan
    // al leerlos para que la purga programada pueda alcanzarlos.
    if (raw === true) {
      const now = Date.now();
      globalThis.__sqlite_set_prop_v2__("crates_addon", "world", `${USED_KEY_PREFIX}${keyId}`, now);
      const index = getUsedKeyIndex();
      index[keyId] = now;
      globalThis.__sqlite_set_prop_v2__("crates_addon", "world", USED_KEY_INDEX_KEY, JSON.stringify(index));
    }
    return true;
  } catch (e) {
    return true;
  }
}

function setKeyRedeemed(keyId, redeemed) {
  try {
    const now = Date.now();
    globalThis.__sqlite_set_prop_v2__("crates_addon", "world", `${USED_KEY_PREFIX}${keyId}`, redeemed ? now : undefined);
    const index = getUsedKeyIndex();
    if (redeemed) index[keyId] = now;
    else delete index[keyId];
    globalThis.__sqlite_set_prop_v2__("crates_addon", "world", USED_KEY_INDEX_KEY, JSON.stringify(index));
    return true;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "crates_addon", moduleId: "main.js", operation: "key_redemption", category: "runtime" });
    return false;
  }
}

function purgeRedeemedKeys() {
  try {
    const index = getUsedKeyIndex();
    const now = Date.now();
    let changed = false;
    for (const keyId of Object.keys(index)) {
      if (now - (Number(index[keyId]) || 0) >= USED_KEY_TTL_MS) {
        globalThis.__sqlite_set_prop_v2__("crates_addon", "world", `${USED_KEY_PREFIX}${keyId}`, undefined);
        delete index[keyId];
        changed = true;
      }
    }
    const entries = Object.entries(index);
    if (entries.length > USED_KEY_INDEX_LIMIT) {
      entries.sort((a, b) => (Number(a[1]) || 0) - (Number(b[1]) || 0));
      for (const [keyId] of entries.slice(0, entries.length - USED_KEY_INDEX_LIMIT)) {
        globalThis.__sqlite_set_prop_v2__("crates_addon", "world", `${USED_KEY_PREFIX}${keyId}`, undefined);
        delete index[keyId];
        changed = true;
      }
    }
    if (changed) globalThis.__sqlite_set_prop_v2__("crates_addon", "world", USED_KEY_INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    ErrorReporter.report(e, { addonId: "crates_addon", moduleId: "main.js", operation: "purgeRedeemedKeys", category: "runtime" });
  }
}
system.runInterval(purgeRedeemedKeys, USED_KEY_PURGE_INTERVAL_TICKS);

function commandOk(message) {
  return { status: CustomCommandStatus.Success, message };
}

function commandError(message) {
  return { status: CustomCommandStatus.Failure, message };
}

// Helper para abrir formularios de forma segura
function safeOpenForm(player, form, onSelect, onCancel = undefined, retryCount = 0) {
  form.show(player).then((response) => {
    if (response.canceled) {
      if (response.cancelationReason === "UserBusy" && retryCount < 5) {
        system.runTimeout(() => {
          safeOpenForm(player, form, onSelect, onCancel, retryCount + 1);
        }, 10);
        return;
      }
      if (onCancel) onCancel(response);
      return;
    }
    onSelect(response);
  }).catch((err) => {
    console.warn(`[Crates Addon] Error en safeOpenForm: ${err}`);
  });
}

// Obtener lista de Cajas de Botín registradas.
// Caché de identidad + índice de coordenadas: playerInteractWithBlock se dispara
// con CADA clic en cualquier bloque; mientras el store no cambie, la lista se
// sirve desde RAM sin deserializar. setcrate acepta cualquier tipo de bloque,
// así que el filtro estricto es la pertenencia al índice de coordenadas.
let cratesListRaw;
let cratesListCache = [];
let cratesIndexCache = new Set();

function crateCoordinateKey(dimensionId, x, y, z) {
  return `${dimensionId}:${x}:${y}:${z}`;
}

function rebuildCratesIndex(list) {
  const index = new Set();
  for (const crate of list) {
    if (crate && Number.isFinite(crate.x) && Number.isFinite(crate.y) && Number.isFinite(crate.z) && crate.dimension) {
      index.add(crateCoordinateKey(crate.dimension, crate.x, crate.y, crate.z));
    }
  }
  return index;
}

function getCratesList() {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("crates_addon", "world", "crates_locations");
    if (raw === cratesListRaw) return cratesListCache;
    const parsed = globalThis.__sqlite_read_json_v3__(raw, []);
    cratesListRaw = raw;
    cratesListCache = Array.isArray(parsed) ? parsed : [];
    cratesIndexCache = rebuildCratesIndex(cratesListCache);
    return cratesListCache;
  } catch (e) { ErrorReporter.report(e, { addonId: "crates_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn(`[Crates Addon] Error leyendo lista de crates: ${e}`);
  }
  return [];
}

// Guardar lista de Cajas de Botín
function saveCratesList(list) {
  try {
    const raw = JSON.stringify(list);
    globalThis.__sqlite_set_prop_v2__("crates_addon", "world", "crates_locations", raw);
    cratesListRaw = raw;
    cratesListCache = list;
    cratesIndexCache = rebuildCratesIndex(list);
  } catch (e) { ErrorReporter.report(e, { addonId: "crates_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn(`[Crates Addon] Error guardando lista de crates: ${e}`);
  }
}

function runAdminCrateCommand(player, command, args) {
  system.run(() => {
    if (command === "setcrate") {
      const block = player.getBlockFromViewDirection()?.block;
      if (!block) {
        player.sendMessage(`${PREFIX} §cDebes estar mirando a un bloque.`);
        return;
      }

      const list = getCratesList();
      const alreadyExists = list.some(c => c.x === block.x && c.y === block.y && c.z === block.z && c.dimension === block.dimension.id);
      if (alreadyExists) {
        player.sendMessage(`${PREFIX} §eEste bloque ya está registrado como Crate.`);
        return;
      }

      list.push({ x: block.x, y: block.y, z: block.z, dimension: block.dimension.id });
      saveCratesList(list);
      player.sendMessage(`${PREFIX} §aCaja de Botín registrada con éxito en [${block.x}, ${block.y}, ${block.z}] en ${block.dimension.id}.`);
      try { player.runCommand(`playsound random.orb @s ~ ~ ~ 1.0 1.5`); } catch (e) { ErrorReporter.report(e, { addonId: "crates_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
      return;
    }

    if (command === "delcrate") {
      const block = player.getBlockFromViewDirection()?.block;
      if (!block) {
        player.sendMessage(`${PREFIX} §cDebes estar mirando a un bloque.`);
        return;
      }

      let list = getCratesList();
      const originalLength = list.length;
      list = list.filter(c => !(c.x === block.x && c.y === block.y && c.z === block.z && c.dimension === block.dimension.id));
      if (list.length === originalLength) {
        player.sendMessage(`${PREFIX} §cEste bloque no está registrado como Crate.`);
        return;
      }

      saveCratesList(list);
      player.sendMessage(`${PREFIX} §aCaja de Botín removida correctamente.`);
      try { player.runCommand(`playsound random.break @s ~ ~ ~ 1.0 1.0`); } catch (e) { ErrorReporter.report(e, { addonId: "crates_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
      return;
    }

    if (command === "givekey") {
      const targetArg = args[1];
      const countArg = parseInt(args[2] || "1");

      if (!targetArg) {
        player.sendMessage(`${PREFIX} §cUso: /s:givekey <jugador> [cantidad]`);
        return;
      }

      if (isNaN(countArg) || countArg <= 0) {
        player.sendMessage(`${PREFIX} §cLa cantidad debe ser un número entero mayor que 0.`);
        return;
      }

      const allPlayers = world.getAllPlayers();
      const targetPlayer = targetArg === "@s" ? player : allPlayers.find(p => p.name.toLowerCase() === targetArg.toLowerCase());
      if (!targetPlayer) {
        player.sendMessage(`${PREFIX} §cJugador '${targetArg}' no encontrado.`);
        return;
      }

      const inv = targetPlayer.getComponent("minecraft:inventory")?.container;
      if (inv) {
        try {
          for (let i = 0; i < countArg; i++) {
            const keyStack = createCrateKey();
            const leftover = inv.addItem(keyStack);
            if (leftover) targetPlayer.dimension.spawnItem(leftover, targetPlayer.location);
          }
          player.sendMessage(`${PREFIX} §aSe han entregado §e${countArg}x Llaves§a a §g${targetPlayer.name}§a.`);
          targetPlayer.sendMessage(`${PREFIX} §a¡Has recibido §e${countArg}x Llave de Crate Imperial§a!`);
        } catch (e) { ErrorReporter.report(e, { addonId: "crates_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
          player.sendMessage(`${PREFIX} §cNo se pudieron entregar todas las llaves. Revisa el registro.`);
        }
      }
    }
  });
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
      for (const name of ["fijarcaja", "establecercofre", "setcrate"]) {
        register({ name: `${COMMAND_NAMESPACE}:${name}`, description: "Registra una caja o cofre de recompensas", permissionLevel: ADMIN_PERMISSION }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          runAdminCrateCommand(sender, "setcrate", ["setcrate"]);
          return commandOk(`Procesando ${name}.`);
        });
      }

      for (const name of ["borrarcaja", "eliminarcaja", "eliminarcofre", "delcrate"]) {
        register({ name: `${COMMAND_NAMESPACE}:${name}`, description: "Elimina una caja o cofre de recompensas", permissionLevel: ADMIN_PERMISSION }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          runAdminCrateCommand(sender, "delcrate", ["delcrate"]);
          return commandOk(`Procesando ${name}.`);
        });
      }

      for (const name of ["darllave", "givekey"]) {
        register({
          name: `${COMMAND_NAMESPACE}:${name}`,
          description: "Entrega llaves de caja/cofre a un jugador",
          permissionLevel: ADMIN_PERMISSION,
          mandatoryParameters: [{ name: "jugador", type: CustomCommandParamType.String }],
          optionalParameters: [{ name: "cantidad", type: CustomCommandParamType.Integer }],
        }, (origin, jugador, cantidad) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          runAdminCrateCommand(sender, "givekey", ["givekey", String(jugador), String(cantidad ?? 1)]);
          return commandOk(`Procesando ${name}.`);
        });
      }
    } catch (e) { ErrorReporter.report(e, { addonId: "crates_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Crates Addon] Error registrando custom commands: " + e);
    }
  });
}

registerCustomCommands();

// Verificar si un bloque es una Caja de Botín
function getCrateAt(blockLoc, dimensionId) {
  // Pre-filtro estricto O(1): sin cajas registradas o con una coordenada fuera
  // del índice, el clic en un bloque común sale sin parsear ni recorrer nada.
  const list = getCratesList();
  if (!list.length) return undefined;
  if (!cratesIndexCache.has(crateCoordinateKey(dimensionId, blockLoc.x, blockLoc.y, blockLoc.z))) return undefined;
  return list.find(c => c.x === blockLoc.x && c.y === blockLoc.y && c.z === blockLoc.z && c.dimension === dimensionId);
}

function getEmissionBudget(player) {
  const day = Math.floor(Date.now() / 86400000);
  try {
    const dayObjective = world.scoreboard.getObjective("emission_day") || world.scoreboard.addObjective("emission_day", "Emission Day");
    const earnedObjective = world.scoreboard.getObjective("emission_earned") || world.scoreboard.addObjective("emission_earned", "Emission Earned");
    const storedDay = Number(dayObjective.getScore(player) ?? -1);
    if (storedDay !== day) {
      if (storedDay !== -1) return { day, earned: 0 };
      const raw = globalThis.__sqlite_get_prop_v2__("crates_addon", player, "economy_emission_budget_v1");
      if (!raw) return { day, earned: 0 };
      const legacy = globalThis.__sqlite_read_json_v3__(raw);
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
    ErrorReporter.report(e, { addonId: "crates_addon", moduleId: "main.js", operation: "getEmissionBudget", category: "runtime" });
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
    ErrorReporter.report(e, { addonId: "crates_addon", moduleId: "main.js", operation: "saveEmissionBudget", category: "runtime" });
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

// Agregar dinero al Scoreboard
function addMoney(player, amount) {
  try {
    const obj = world.scoreboard.getObjective("money");
    if (!obj) return false;
    const current = (function(o, p){ try{return o.getScore(p) ?? 0;}catch(e){try{return o.getScore(p.name) ?? 0;}catch(e2){return 0;}} })(obj, player) ?? 0;
    const delta = Math.max(0, Math.floor(Number(amount) || 0));
    const next = current + delta;
    if (next > MAX_OPERATIONAL_BALANCE) return false;
    const emissionReservation = reserveEmission(player, delta, "crate_reward");
    if (!emissionReservation) return false;
    try {
      try { obj.setScore(player, next); } catch (identityError) { obj.setScore(player.name, next); }
    } catch (writeError) {
      rollbackEmission(player, emissionReservation);
      throw writeError;
    }
    const persisted = (function(o, p){ try{return o.getScore(p) ?? -1;}catch(e){try{return o.getScore(p.name) ?? -1;}catch(e2){return -1;}} })(obj, player);
    if (persisted !== next) {
      rollbackEmission(player, emissionReservation);
      return false;
    }
    commitEmission(player, emissionReservation, current, next);
    return true;
  } catch (e) { ErrorReporter.report(e, { addonId: "crates_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn(`[Crates Addon] Error al añadir dinero: ${e}`);
    return false;
  }
}

function addItemEnchantment(item, enchantmentId, level) {
  let enchantmentType = EnchantmentTypes.get(enchantmentId);
  if (!enchantmentType && !enchantmentId.startsWith("minecraft:")) {
    enchantmentType = EnchantmentTypes.get(`minecraft:${enchantmentId}`);
  }
  if (!enchantmentType && enchantmentId.startsWith("minecraft:")) {
    enchantmentType = EnchantmentTypes.get(enchantmentId.replace("minecraft:", ""));
  }
  const enchantable = item.getComponent("minecraft:enchantable");
  if (!enchantmentType || !enchantable) {
    throw new Error(`Encantamiento no disponible: ${enchantmentId}`);
  }
  enchantable.addEnchantment({ type: enchantmentType, level });
}

// Definición de recompensas
const REWARDS = [
  { type: "money", amount: 1000, label: "§a$1,000 en Efectivo", weight: 20 },
  { type: "money", amount: 2500, label: "§a$2,500 en Efectivo", weight: 15 },
  { type: "money", amount: 5000, label: "§a$5,000 en Efectivo", weight: 8 },
  { type: "money", amount: 10000, label: "§6$10,000 en Efectivo", weight: 3 },
  { 
    type: "item", 
    label: "§d1x Lingote de Netherite", 
    weight: 10,
    getItem: () => {
      const item = new ItemStack("minecraft:netherite_ingot", 1);
      return item;
    }
  },
  { 
    type: "item", 
    label: "§d2x Manzana Dorada Encantada", 
    weight: 8,
    getItem: () => {
      return new ItemStack("minecraft:enchanted_golden_apple", 2);
    }
  },
  { 
    type: "item", 
    label: "§e1x Tótem de Inmortalidad", 
    weight: 10,
    getItem: () => {
      return new ItemStack("minecraft:totem_of_undying", 1);
    }
  },
  { 
    type: "item", 
    label: "§b1x Élitros (Elytra)", 
    weight: 3,
    getItem: () => {
      return new ItemStack("minecraft:elytra", 1);
    }
  },
  { 
    type: "item", 
    label: "§61x Pechera de Diamante (Protección IV)", 
    weight: 5,
    getItem: () => {
      const item = new ItemStack("minecraft:diamond_chestplate", 1);
      try {
        addItemEnchantment(item, "protection", 4);
      } catch (err) { ErrorReporter.report(err, { addonId: "crates_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
      return item;
    }
  },
  { 
    type: "item", 
    label: "§61x Espada de Diamante (Afilado V)", 
    weight: 5,
    getItem: () => {
      const item = new ItemStack("minecraft:diamond_sword", 1);
      try {
        addItemEnchantment(item, "sharpness", 5);
      } catch (err) { ErrorReporter.report(err, { addonId: "crates_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
      return item;
    }
  },
  { 
    type: "item", 
    label: "§61x Pico de Diamante (Fortuna III + Eficiencia V)", 
    weight: 5,
    getItem: () => {
      const item = new ItemStack("minecraft:diamond_pickaxe", 1);
      try {
        addItemEnchantment(item, "efficiency", 5);
        addItemEnchantment(item, "fortune", 3);
      } catch (err) { ErrorReporter.report(err, { addonId: "crates_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
      return item;
    }
  },
  { 
    type: "item", 
    label: "§e1x Caja de Shulker", 
    weight: 8,
    getItem: () => {
      return new ItemStack("minecraft:shulker_box", 1);
    }
  }
];

function selectRandomReward() {
  const totalWeight = REWARDS.reduce((sum, r) => sum + r.weight, 0);
  let rand = Math.random() * totalWeight;
  for (let r of REWARDS) {
    if (rand < r.weight) return r;
    rand -= r.weight;
  }
  return REWARDS[0];
}

// Dar premio al jugador
function deliverReward(player, reward) {
  if (reward.type === "money") {
    return addMoney(player, reward.amount);
  } else if (reward.type === "item") {
    const item = reward.getItem();
    const existingLore = item.getLore?.() ?? [];
    item.setLore([...existingLore, CRATE_REWARD_MARKER]);
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (inv) {
      // Intentar añadir al inventario, si falla (lleno), soltarlo al suelo
      try {
        const leftover = inv.addItem(item);
        if (leftover) {
          player.dimension.spawnItem(leftover, player.location);
        }
        return true;
      } catch (e) { ErrorReporter.report(e, { addonId: "crates_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
        player.dimension.spawnItem(item, player.location);
        return true;
      }
    } else {
      player.dimension.spawnItem(item, player.location);
      return true;
    }
  }
  return false;
}

// Animación de Apertura
function triggerCrateOpening(player, blockLoc, dimension, onComplete) {
  let tick = 0;
  const totalTicks = 8;

  function playEffects() {
    if (tick < totalTicks) {
      // Sonidos de ticks rítmicos
      try {
        player.runCommand(`playsound random.click @s ${blockLoc.x} ${blockLoc.y} ${blockLoc.z} 0.8 1.5`);
      } catch (e) { ErrorReporter.report(e, { addonId: "crates_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
      
      // Partículas
      try {
        dimension.spawnParticle("minecraft:basic_portal_particle", {
          x: blockLoc.x + 0.5 + (Math.random() - 0.5) * 1.5,
          y: blockLoc.y + 1 + Math.random(),
          z: blockLoc.z + 0.5 + (Math.random() - 0.5) * 1.5
        });
      } catch (e) { ErrorReporter.report(e, { addonId: "crates_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

      tick++;
      system.runTimeout(playEffects, 4); // cada 4 ticks (0.2 segundos)
    } else {
      try {
        // Revelar premio
        const reward = selectRandomReward();
        if (!deliverReward(player, reward)) throw new Error("No se pudo confirmar la entrega de la recompensa.");

      // Sonido de victoria
      try {
        player.runCommand(`playsound random.levelup @s ${blockLoc.x} ${blockLoc.y} ${blockLoc.z} 1.0 1.0`);
      } catch (e) { ErrorReporter.report(e, { addonId: "crates_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

      // Abrir UI
        const form = new ActionFormData()
        .title("🔑 Caja Imperial Abierta 🔑")
        .body(`¡Felicidades!\n\nHas abierto la Caja de Botín Imperial y has obtenido:\n\n⭐  ${reward.label}  ⭐\n\n§7El premio ha sido entregado en tu cuenta o inventario.`)
        .button("Cerrar");

        safeOpenForm(player, form, () => {});
      } catch (e) {
        ErrorReporter.report(e, { addonId: "crates_addon", moduleId: "main.js", operation: "deliver_reward", category: "runtime" });
        player.sendMessage(`${PREFIX} §cNo se pudo entregar el premio. Contacta a un administrador.`);
      } finally {
        onComplete?.();
      }
    }
  }

  playEffects();
}

// Interceptar interacción con bloques (antes de abrir la interfaz del cofre)
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const block = event.block;
  const player = event.player;
  if (!block || !player) return;

  const crate = getCrateAt(block.location, block.dimension.id);
  if (!crate) return;

  // Es una Caja de Botín, cancelamos para evitar que se abra el inventario normal
  event.cancel = true;

  // Ejecutamos en el hilo seguro (fuera de beforeEvents para poder mutar inventarios y ejecutar comandos)
  system.run(() => {
    const playerKey = String(player.id || player.name).toLowerCase();
    if (activeCrateOpenings.has(playerKey)) {
      player.sendMessage(`${PREFIX} §cYa estás abriendo una caja.`);
      return;
    }
    activeCrateOpenings.add(playerKey);

    const equip = player.getComponent("minecraft:equippable");
    const itemInHand = equip ? equip.getEquipment(EquipmentSlot.Mainhand) : undefined;

    const keyId = getValidKeyId(itemInHand);

    if (!keyId) {
      activeCrateOpenings.delete(playerKey);
      player.sendMessage(`${PREFIX} §cSe requiere una §e§lLlave de Crate Imperial§c para abrir este cofre.`);
      try {
        player.runCommand(`playsound note.bass @s ~ ~ ~ 0.8 0.5`);
      } catch (e) { ErrorReporter.report(e, { addonId: "crates_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
      return;
    }
    if (isKeyRedeemed(keyId)) {
      activeCrateOpenings.delete(playerKey);
      player.sendMessage(`${PREFIX} §cEsta llave ya fue canjeada o es una copia inválida.`);
      return;
    }

    // Consumir 1 llave del inventario del jugador
    const inv = player.getComponent("minecraft:inventory")?.container;
    const keySlot = player.selectedSlotIndex;
    const selectedItem = inv?.getItem(keySlot);
    if (!inv || getValidKeyId(selectedItem) !== keyId || !setKeyRedeemed(keyId, true)) {
      activeCrateOpenings.delete(playerKey);
      player.sendMessage(`${PREFIX} §cNo se pudo validar la llave. No fue consumida.`);
      return;
    }

    try {
      if (selectedItem.amount > 1) {
        selectedItem.amount -= 1;
        inv.setItem(keySlot, selectedItem);
      } else {
        inv.setItem(keySlot, undefined);
      }
    } catch (e) {
      setKeyRedeemed(keyId, false);
      activeCrateOpenings.delete(playerKey);
      player.sendMessage(`${PREFIX} §cNo se pudo consumir la llave.`);
      return;
    }

    triggerCrateOpening(player, block.location, block.dimension, () => activeCrateOpenings.delete(playerKey));
  });
});
