import { world, system, CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, PlayerPermissionLevel, ItemStack, EnchantmentTypes } from "@minecraft/server";






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
globalThis.__sqlite_sync_complete_v2__.delete("block_audit_addon");
globalThis.__sqlite_request_sync_v3__("block_audit_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("block_audit_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("block_audit_addon", 1);
  } catch (e) {}
}, 120);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
const LIMIT = 100;
const NS = "s";
// Persistir cada bloque y escribirlo en consola hace que construir/minar genere
// E/S síncrona en cada tick. Conservamos el mismo historial, pero agrupamos
// las escrituras sin dejar una ventana de datos grande sin guardar.
const PERSIST_BATCH_SIZE = 80;
const PERSIST_INTERVAL_TICKS = 200;
const EXTERNAL_EVENT_MARKER = "[BLOCK_AUDIT_EXTERNAL_V1] ";
const CONSOLE_EVENT_LOGGING = false;
const PER_BLOCK_LIMIT = 12;
const SESSION_BLOCK_LIMIT = 5000;
const AUDIT_STATE_KEY = "block_audit_log_v1";

const clean = (value, size = 64) => String(value ?? "").replace(/[\u0000-\u001f\u007f§`]/g, " ").replace(/\s+/g, " ").trim().slice(0, size);

function isOp(player) {
  if (!player) return false;
  try {
    if (player.playerPermissionLevel === PlayerPermissionLevel.Operator) return true;
  } catch (e) {}
  try {
    if (typeof player.hasTag === "function") {
      if (player.hasTag("op") || player.hasTag("admin") || player.hasTag("owner")) return true;
    }
  } catch (e) {}
  return false;
}

let cachedAuditEntries = [];
let pendingWrites = 0;
let auditStateLoaded = false;
const pendingBlockRecords = new Map();

function blockRecordKey(dimensionId, x, y, z) {
  return `block_audit:v2:${String(dimensionId || "minecraft:overworld").replace(/[^a-z0-9_:-]/gi, "_")}:${x}:${y}:${z}`;
}

function actionText(entry) {
  if (entry.a === "break") return `rompió ${String(entry.b || "bloque").replace("minecraft:", "")}`;
  if (entry.a === "place") return `colocó ${String(entry.b || "bloque").replace("minecraft:", "")}`;
  if (entry.a === "explode") {
    const source = entry.source ? ` (fuente: ${String(entry.source).replace("minecraft:", "")})` : "";
    return `explotó ${String(entry.b || "bloque").replace("minecraft:", "")} → aire${source}`;
  }
  return clean(entry.a || "cambió", 24);
}

function sourceDetails(source) {
  try {
    const typeId = clean(source?.typeId, 80) || "unknown";
    const isPlayer = typeId === "minecraft:player";
    return {
      source: typeId,
      player: isPlayer ? clean(source?.name, 32) || "unknown" : "unknown",
      xuid: isPlayer ? clean(source?.xuid, 32) : ""
    };
  } catch {
    return { source: "unknown", player: "unknown", xuid: "" };
  }
}

function adjacentLocation(location, blockFace) {
  const target = {
    x: Math.floor(location.x),
    y: Math.floor(location.y),
    z: Math.floor(location.z)
  };
  switch (String(blockFace || "").toLowerCase()) {
    case "up": target.y++; break;
    case "down": target.y--; break;
    case "north": target.z--; break;
    case "south": target.z++; break;
    case "east": target.x++; break;
    case "west": target.x--; break;
  }
  return target;
}

function isSneaking(player) {
  try { return player?.isSneaking === true; } catch { return false; }
}

function readBlockRecords(key) {
  return pendingBlockRecords.get(key) ?? [];
}

function historyAt(dimensionId, x, y, z) {
  const key = blockRecordKey(dimensionId, x, y, z);
  const direct = readBlockRecords(key);
  if (direct.length) return direct;
  // Compatibilidad con los registros existentes anteriores al índice por bloque.
  return read().filter((entry) => entry.x === x && entry.y === y && entry.z === z && (!entry.d || entry.d === dimensionId));
}

function read() {
  return cachedAuditEntries;
}

function loadPersistedAudit() {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("block_audit_addon", "world", AUDIT_STATE_KEY);
    const parsed = raw ? JSON.parse(String(raw)) : [];
    cachedAuditEntries = Array.isArray(parsed) ? parsed.slice(-LIMIT) : [];
    pendingBlockRecords.clear();
    for (const entry of cachedAuditEntries) {
      if (!entry || entry.x === undefined || entry.y === undefined || entry.z === undefined) continue;
      const key = blockRecordKey(entry.d, entry.x, entry.y, entry.z);
      rememberBlockHistory(key, [...readBlockRecords(key), entry]);
    }
  } catch (error) {
    cachedAuditEntries = [];
    console.warn(`[BLOCK_AUDIT] load_failed ${clean(error, 120)}`);
  }
  auditStateLoaded = true;
}

function write(entries) {
  if (!auditStateLoaded) return false;
  const bounded = entries.slice(-LIMIT);
  try {
    globalThis.__sqlite_set_prop_v2__("block_audit_addon", "world", AUDIT_STATE_KEY, JSON.stringify(bounded));
    cachedAuditEntries = bounded;
    pendingWrites = 0;
    return true;
  } catch (error) {
    console.warn(`[BLOCK_AUDIT] save_failed ${clean(error, 120)}`);
    return false;
  }
}

function rememberBlockHistory(key, entries) {
  pendingBlockRecords.set(key, entries.slice(-PER_BLOCK_LIMIT));
  while (pendingBlockRecords.size > SESSION_BLOCK_LIMIT) {
    pendingBlockRecords.delete(pendingBlockRecords.keys().next().value);
  }
}

function flush() {
  if (!pendingWrites && pendingBlockRecords.size === 0) return;
  try {
    if (pendingWrites) write(cachedAuditEntries);
  } catch (error) {
    console.warn(`[BLOCK_AUDIT] flush_failed ${clean(error,120)}`);
  }
}

function record(action, event) {
  try {
    const block = action === "break" ? event.brokenBlockPermutation : event.block?.permutation;
    const location = event.block?.location;
    if (!event.player || !block || !location) return;
    const entry = {
      t: Date.now(),
      a: action,
      p: clean(event.player.name, 32),
      xuid: clean(event.player.xuid, 32),
      d: clean(event.block?.dimension?.id ?? event.dimension?.id ?? event.player.dimension?.id, 48),
      x: Math.floor(location.x),
      y: Math.floor(location.y),
      z: Math.floor(location.z),
      b: clean(block.type?.id ?? block.typeId, 80)
    };
    
    // El registro por evento se puede reactivar para una investigación puntual,
    // pero queda desactivado en producción para no saturar la consola y el disco.
    if (CONSOLE_EVENT_LOGGING) {
      console.warn(`[BLOCK_AUDIT_LOG] ${JSON.stringify(entry)}`);
    }

    const entries = read();
    entries.push(entry);
    cachedAuditEntries = entries.slice(-LIMIT);
    const key = blockRecordKey(entry.d, entry.x, entry.y, entry.z);
    const blockEntries = readBlockRecords(key);
    blockEntries.push(entry);
    rememberBlockHistory(key, blockEntries);
    pendingWrites++;
    console.warn(`${EXTERNAL_EVENT_MARKER}${JSON.stringify(entry)}`);
    if (pendingWrites >= PERSIST_BATCH_SIZE) flush();
  } catch (error) {
    console.warn(`[BLOCK_AUDIT] record_failed ${clean(error,120)}`);
  }
}

// `blockExplode` se dispara únicamente para bloques que realmente fueron
// destruidos. Conservamos su tipo previo y marcamos el estado posterior como
// aire. Si Bedrock no proporciona un jugador como fuente, no se le atribuye a
// nadie: una entidad TNT no expone de forma fiable a quien la activó.
function recordExplosion(event) {
  try {
    const block = event?.block;
    const location = block?.location;
    const destroyed = event?.explodedBlockPermutation;
    if (!block || !location || !destroyed) return;
    const source = sourceDetails(event.source);
    const entry = {
      t: Date.now(),
      a: "explode",
      p: source.player,
      xuid: source.xuid,
      source: source.source,
      d: clean(event.dimension?.id ?? block.dimension?.id, 48),
      x: Math.floor(location.x),
      y: Math.floor(location.y),
      z: Math.floor(location.z),
      b: clean(destroyed.type?.id ?? destroyed.typeId, 80),
      after: "minecraft:air"
    };
    const entries = read();
    entries.push(entry);
    cachedAuditEntries = entries.slice(-LIMIT);
    const key = blockRecordKey(entry.d, entry.x, entry.y, entry.z);
    const blockEntries = readBlockRecords(key);
    blockEntries.push(entry);
    rememberBlockHistory(key, blockEntries);
    pendingWrites++;
    console.warn(`${EXTERNAL_EVENT_MARKER}${JSON.stringify(entry)}`);
    if (pendingWrites >= PERSIST_BATCH_SIZE) flush();
  } catch (error) {
    console.warn(`[BLOCK_AUDIT] explosion_record_failed ${clean(error,120)}`);
  }
}

function reply(player, text) {
  try {
    player.sendMessage(`§8[§bBlockAudit§8] §7${text}`);
  } catch {}
}

function isAuditWand(item) {
  const name = String(item?.nameTag ?? "").replace(/§[0-9a-fk-or]/gi, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return item?.typeId === "minecraft:stick" && name.includes("vara de auditoria");
}

system.beforeEvents.startup.subscribe(({ customCommandRegistry: registry }) => {
  try {
    // Comando 1: Auditar Coordenadas
    registry.registerCommand({
      name: `${NS}:blockaudit`,
      description: "Audita un bloque en coordenadas X Y Z",
      permissionLevel: CommandPermissionLevel.Any,
      mandatoryParameters: [
        { name: "x", type: CustomCommandParamType.Integer },
        { name: "y", type: CustomCommandParamType.Integer },
        { name: "z", type: CustomCommandParamType.Integer }
      ]
    }, (origin, x, y, z) => {
      const player = origin?.sourceEntity;
      if (!player || !isOp(player)) return { status: CustomCommandStatus.Failure, message: "Solo operadores." };
      
      system.run(() => {
        const found = historyAt(player.dimension.id, x, y, z).slice(-8).reverse();
        reply(player, found.length ? 
          `§a§lHistorial en ${x}, ${y}, ${z}:\n` + found.map(e => `§e[${new Date(e.t).toLocaleTimeString("es-MX")}] §b${e.p} §f${actionText(e)}`).join("\n") 
          : "§cSin registros para estas coordenadas.");
      });
      return { status: CustomCommandStatus.Success, message: "Consulta enviada." };
    });

    // Comando 2: Historial de Jugador
    registry.registerCommand({
      name: `${NS}:blockhistory`,
      description: "Historial de bloques por jugador",
      permissionLevel: CommandPermissionLevel.Any,
      mandatoryParameters: [
        { name: "jugador", type: CustomCommandParamType.String }
      ]
    }, (origin, name) => {
      const player = origin?.sourceEntity;
      if (!player || !isOp(player)) return { status: CustomCommandStatus.Failure, message: "Solo operadores." };
      
      system.run(() => {
        const found = read().filter(e => e.p.toLowerCase() === clean(name, 32).toLowerCase()).slice(-12).reverse();
        reply(player, found.length ? 
          `§a§lÚltimos cambios de ${name}:\n` + found.map(e => `§e[${new Date(e.t).toLocaleTimeString("es-MX")}] §f${actionText(e)} §7en ${e.x},${e.y},${e.z}`).join("\n") 
          : "§cSin registros para ese jugador.");
      });
      return { status: CustomCommandStatus.Success, message: "Consulta enviada." };
    });

    // Comando 3: Dar la Vara de Auditoría
    registry.registerCommand({
      name: `${NS}:varaauditoria`,
      description: "Te da la Vara de Auditoría de bloques",
      permissionLevel: CommandPermissionLevel.Any
    }, (origin) => {
      const player = origin?.sourceEntity;
      if (!player || !isOp(player)) return { status: CustomCommandStatus.Failure, message: "Solo operadores." };
      
      system.run(() => {
        try {
          const stick = new ItemStack("minecraft:stick", 1);
          stick.nameTag = "§b§lVara de Auditoría";
          stick.setLore([
            "§7Golpea (clic izq) o interactúa (clic der) con",
            "§7un bloque para ver su historial.",
            "§7Agáchate + clic der sobre una cara para",
            "§7consultar el aire adyacente."
          ]);
          
          const enchantable = stick.getComponent("minecraft:enchantable");
          if (enchantable) {
            const enchantType = EnchantmentTypes.get("unbreaking");
            if (enchantType) {
              try {
                enchantable.addEnchantment({ type: enchantType, level: 1 });
              } catch(e) {}
            }
          }
          
          const container = player.getComponent("minecraft:inventory")?.container;
          if (container) {
            container.addItem(stick);
            reply(player, "§a¡Has recibido la Vara de Auditoría!");
          } else {
            reply(player, "§cNo se pudo acceder a tu inventario.");
          }
        } catch (e) {
          reply(player, "§cError al crear la vara: " + e);
        }
      });
      return { status: CustomCommandStatus.Success, message: "Vara generada." };
    });
  } catch (error) {
    console.warn(`[BLOCK_AUDIT] command_registration_failed ${clean(error, 120)}`);
  }
});

// Registrar eventos de ruptura y colocación nativos
try {
  world.afterEvents.playerBreakBlock.subscribe(event => record("break", event));
  world.afterEvents.playerPlaceBlock.subscribe(event => record("place", event));
  world.afterEvents.blockExplode.subscribe(event => recordExplosion(event));
  system.runInterval(flush, PERSIST_INTERVAL_TICKS);
  console.warn(`[BLOCK_AUDIT] ready retention=${LIMIT} batch=${PERSIST_BATCH_SIZE} intervalTicks=${PERSIST_INTERVAL_TICKS} explosions=enabled`);
} catch (error) {
  console.warn(`[BLOCK_AUDIT] listener_failed ${clean(error, 120)}`);
}

system.run(loadPersistedAudit);

// Interceptador de Clic Derecho (Interactuar) con la Vara de Auditoría
try {
  world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const player = event.player;
    if (!player || !isOp(player)) return;

    const equippable = player.getComponent("minecraft:equippable");
    const item = equippable?.getEquipment("Mainhand");
    if (isAuditWand(item)) {
      event.cancel = true; // Evitar que se abra la interfaz de cofres, hornos, etc.
      const loc = isSneaking(player)
        ? adjacentLocation(event.block.location, event.blockFace)
        : event.block.location;
      const dimensionId = event.block.dimension.id;
      const adjacent = isSneaking(player);
      system.run(() => {
        const found = historyAt(dimensionId, loc.x, loc.y, loc.z).slice(-8).reverse();
        reply(player, found.length ? 
          `§a§lHistorial ${adjacent ? "del aire adyacente" : "del bloque"} en ${loc.x}, ${loc.y}, ${loc.z}:\n` + found.map(e => `§e[${new Date(e.t).toLocaleTimeString("es-MX")}] §b${e.p} §f${actionText(e)}`).join("\n") 
          : "§cSin registros para este bloque.");
      });
    }
  });
} catch (e) {
  console.warn("[BLOCK_AUDIT] Error al registrar interact event de la vara: " + e);
}

// Interceptador de Clic Izquierdo (Golpear) con la Vara de Auditoría
try {
  world.afterEvents.entityHitBlock.subscribe((event) => {
    const player = event.damagingEntity;
    if (!player || player.typeId !== "minecraft:player" || !isOp(player)) return;

    const equippable = player.getComponent("minecraft:equippable");
    const item = equippable?.getEquipment("Mainhand");
    if (isAuditWand(item)) {
      const loc = event.hitBlock.location;
      const found = historyAt(event.hitBlock.dimension.id, loc.x, loc.y, loc.z).slice(-8).reverse();
      reply(player, found.length ? 
        `§a§lHistorial del Bloque en ${loc.x}, ${loc.y}, ${loc.z}:\n` + found.map(e => `§e[${new Date(e.t).toLocaleTimeString("es-MX")}] §b${e.p} §f${actionText(e)}`).join("\n") 
        : "§cSin registros para este bloque.");
    }
  });
} catch (e) {
  console.warn("[BLOCK_AUDIT] Error al registrar hit event de la vara: " + e);
}

// Exportador de Consola VPS
try {
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "blockaudit:export") {
      flush();
      const entries = read();
      console.warn("[BLOCK_AUDIT_DUMP] " + JSON.stringify(entries));
    }
  });
} catch (e) {}
