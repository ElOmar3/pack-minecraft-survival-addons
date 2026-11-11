import { ErrorReporter } from "./ErrorReporter.js";
import { ItemLockMode, world, system } from "@minecraft/server";






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
globalThis.__sqlite_sync_complete_v2__.delete("antidupe_addon");
globalThis.__sqlite_request_sync_v3__("antidupe_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("antidupe_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("antidupe_addon", 1);
  } catch (e) {}
}, 120);
system.runTimeout(() => {
  // Sin demonio (mundo importado sin bridge) se opera en modo degradado tras ~10s: RAM es la fuente de verdad.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("antidupe_addon");
    if (state && !state.complete) {
      state.degraded = true;
      globalThis.__sqlite_sync_complete_v2__.set("antidupe_addon", Date.now());
      globalThis.__sqlite_flush_pending_v3__("antidupe_addon");
    }
  } catch (e) {}
}, 200);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
const PISTON_TYPES = new Set(["minecraft:piston", "minecraft:sticky_piston"]);
const SHULKER_SUFFIX = "_shulker_box";
const MAX_NEUTRALIZE_ATTEMPTS = 2;
const INCIDENT_COOLDOWN_TICKS = 100;
const EMERGENCY_BLOCK_PLAYER_PISTON_PLACEMENT = false;
const BUNDLE_TYPES = new Set([
  "minecraft:bundle",
  "minecraft:black_bundle",
  "minecraft:blue_bundle",
  "minecraft:brown_bundle",
  "minecraft:cyan_bundle",
  "minecraft:gray_bundle",
  "minecraft:green_bundle",
  "minecraft:light_blue_bundle",
  "minecraft:light_gray_bundle",
  "minecraft:lime_bundle",
  "minecraft:magenta_bundle",
  "minecraft:orange_bundle",
  "minecraft:pink_bundle",
  "minecraft:purple_bundle",
  "minecraft:red_bundle",
  "minecraft:white_bundle",
  "minecraft:yellow_bundle",
]);
const ADJACENT_OFFSETS = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
];

const pendingMitigations = new Set();
const recentIncidents = new Map();
const recentBundleNotices = new Map();

function report(error, operation) {
  ErrorReporter.report(error, {
    addonId: "antidupe_addon",
    moduleId: "main.js",
    operation,
    category: "runtime",
  });
}

function getLocation(block) {
  const location = block?.location || block;
  if (![location?.x, location?.y, location?.z].every(Number.isFinite)) return undefined;
  return {
    x: Math.floor(location.x),
    y: Math.floor(location.y),
    z: Math.floor(location.z),
  };
}

function snapshotPiston(block) {
  const location = getLocation(block);
  const dimension = block?.dimension;
  if (!location || !dimension) return undefined;
  return {
    block,
    dimension,
    dimensionId: String(dimension.id || "unknown"),
    location,
    key: `${String(dimension.id || "unknown")}:${location.x},${location.y},${location.z}`,
  };
}

function readTypeId(block) {
  try {
    return String(block?.typeId || "");
  } catch (error) {
    report(error, "readBlockType");
    return "";
  }
}

function isBundleTypeId(typeId) {
  const normalized = String(typeId || "").toLowerCase();
  return BUNDLE_TYPES.has(normalized) || /^minecraft:[a-z0-9_]+_bundle$/.test(normalized);
}

function notifyBundleDisabled(player) {
  if (!player) return;
  const key = String(player.id || player.name || "unknown");
  const tick = Number(system.currentTick) || 0;
  const previous = recentBundleNotices.get(key);
  if (Number.isFinite(previous) && tick - previous < INCIDENT_COOLDOWN_TICKS) return;
  recentBundleNotices.set(key, tick);
  if (recentBundleNotices.size > 256) recentBundleNotices.delete(recentBundleNotices.keys().next().value);
  try {
    player.sendMessage("§c[Anti-Dupe] El uso de bundles esta deshabilitado temporalmente. Puedes moverlos, soltarlos o eliminarlos con normalidad.");
  } catch (error) {
    report(error, "notifyBundleDisabled");
  }
}

function makeBundleRemovable(item) {
  if (!item || !isBundleTypeId(item.typeId)) return undefined;
  const removable = typeof item.clone === "function" ? item.clone() : item;
  try {
    removable.lockMode = ItemLockMode?.none ?? "none";
  } catch (error) {
    report(error, "setBundleLockMode");
  }
  return removable;
}

function normalizePlayerBundles(player, reason = "inventory_scan", onlySlot = undefined) {
  try {
    const container = player?.getComponent?.("minecraft:inventory")?.container;
    if (!container) return 0;
    const first = Number.isInteger(onlySlot) ? onlySlot : 0;
    const last = Number.isInteger(onlySlot) ? onlySlot + 1 : container.size;
    let normalized = 0;
    for (let slot = first; slot < last; slot++) {
      const item = container.getItem(slot);
      if (!item || !isBundleTypeId(item.typeId)) continue;
      if (item.lockMode === ItemLockMode.none || String(item.lockMode || "none") === "none") continue;
      const removable = makeBundleRemovable(item);
      if (!removable) continue;
      container.setItem(slot, removable);
      normalized += 1;
    }
    if (normalized > 0) {
      notifyBundleDisabled(player);
      console.warn(`[ANTIDUPE_BUNDLE_UNLOCK] player=${player.name || "unknown"} count=${normalized} reason=${reason}`);
    }
    return normalized;
  } catch (error) {
    report(error, "normalizePlayerBundles");
    return 0;
  }
}

function normalizePlayerBundleStorage(player, reason = "player_storage") {
  let normalized = normalizePlayerBundles(player, reason);
  try {
    const ender = player?.getComponent?.("minecraft:ender_inventory")?.container;
    if (ender) {
      for (let slot = 0; slot < ender.size; slot++) {
        const item = ender.getItem(slot);
        if (!item || !isBundleTypeId(item.typeId)) continue;
        if (item.lockMode === ItemLockMode.none || String(item.lockMode || "none") === "none") continue;
        const removable = makeBundleRemovable(item);
        if (!removable) continue;
        ender.setItem(slot, removable);
        normalized += 1;
      }
    }
  } catch (error) {
    report(error, "normalizePlayerBundleStorage");
  }
  if (normalized > 0) notifyBundleDisabled(player);
  return normalized;
}

function discardBundle(item, ownerType, reason) {
  console.warn(`[ANTIDUPE_BUNDLE_BLOCK] action=discarded type=${item?.typeId || "unknown"} owner=${ownerType || "unknown"} reason=${reason}`);
}

function deliverRemovableBundle(player, item, reason) {
  try {
    const removable = makeBundleRemovable(item);
    const inventory = player?.getComponent?.("minecraft:inventory")?.container;
    if (removable && inventory) {
      const leftover = inventory.addItem(removable);
      notifyBundleDisabled(player);
      if (!leftover) return true;
      discardBundle(leftover, "player_inventory_full", reason);
      return false;
    }
  } catch (error) {
    report(error, "deliverRemovableBundle");
  }
  discardBundle(item, "no_recipient", reason);
  return false;
}

function sanitizeBlockContainer(block, recipient, reason = "container_access") {
  if (!block) return { failed: true, hasInventory: false, removed: 0 };
  try {
    const container = block.getComponent?.("minecraft:inventory")?.container;
    if (!container) return { failed: false, hasInventory: false, removed: 0 };
    let removed = 0;
    for (let slot = 0; slot < container.size; slot++) {
      const item = container.getItem(slot);
      if (!item || !isBundleTypeId(item.typeId)) continue;
      const preserved = item.clone ? item.clone() : item;
      container.setItem(slot, undefined);
      if (container.getItem(slot)) {
        const error = new Error(`No se pudo retirar bundle de ${readTypeId(block) || "unknown"} slot=${slot}`);
        report(error, "verifyBundleRemoval");
        console.warn(`[ANTIDUPE_CRITICAL] ${error.message}`);
        return { failed: true, hasInventory: true, removed };
      }
      deliverRemovableBundle(recipient, preserved, reason);
      removed += 1;
    }
    if (removed > 0) {
      console.warn(`[ANTIDUPE_BUNDLE_BLOCK] container=${readTypeId(block) || "unknown"} count=${removed} reason=${reason}`);
    }
    return { failed: false, hasInventory: true, removed };
  } catch (error) {
    report(error, "sanitizeBlockContainer");
    return { failed: true, hasInventory: true, removed: 0 };
  }
}

function sanitizeEntityContainer(entity, recipient, reason = "entity_container") {
  if (!entity || entity.typeId === "minecraft:player") return { failed: false, hasInventory: false, removed: 0 };
  try {
    const container = entity.getComponent?.("minecraft:inventory")?.container;
    if (!container) return { failed: false, hasInventory: false, removed: 0 };
    let removed = 0;
    for (let slot = 0; slot < container.size; slot++) {
      const item = container.getItem(slot);
      if (!item || !isBundleTypeId(item.typeId)) continue;
      const preserved = item.clone ? item.clone() : item;
      container.setItem(slot, undefined);
      if (container.getItem(slot)) {
        const error = new Error(`No se pudo retirar bundle de entidad ${entity.typeId || "unknown"} slot=${slot}`);
        report(error, "verifyEntityBundleRemoval");
        console.warn(`[ANTIDUPE_CRITICAL] ${error.message}`);
        return { failed: true, hasInventory: true, removed };
      }
      deliverRemovableBundle(recipient, preserved, reason);
      removed += 1;
    }
    if (removed > 0) {
      console.warn(`[ANTIDUPE_BUNDLE_BLOCK] entity=${entity.typeId || "unknown"} count=${removed} reason=${reason}`);
    }
    return { failed: false, hasInventory: true, removed };
  } catch (error) {
    report(error, "sanitizeEntityContainer");
    return { failed: true, hasInventory: true, removed: 0 };
  }
}

function sanitizeLooseBundleEntity(entity, reason = "loose_item") {
  try {
    if (!entity || !entity.isValid || entity.typeId !== "minecraft:item") return false;
    const item = entity.getComponent?.("minecraft:item")?.itemStack;
    if (!item || !isBundleTypeId(item.typeId)) return false;
    entity.remove();
    discardBundle(item, "loose_item", reason);
    return true;
  } catch (error) {
    report(error, "sanitizeLooseBundleEntity");
    return false;
  }
}

function isPiston(block) {
  return PISTON_TYPES.has(readTypeId(block));
}

function classifyBlock(block) {
  if (!block) return { blocked: true, hasInventory: false, reason: "missing_block" };
  try {
    const typeId = String(block.typeId || "");
    const isShulker = typeId === "minecraft:shulker_box" || typeId.endsWith(SHULKER_SUFFIX);
    const hasInventory = isShulker || Boolean(block.getComponent?.("minecraft:inventory"));
    return { blocked: false, hasInventory, reason: hasInventory ? "clean_inventory" : "ordinary_block", typeId: typeId || "unknown" };
  } catch (error) {
    report(error, "inspectAttachedBlock");
    return { blocked: true, hasInventory: false, reason: "inspection_error", typeId: "unavailable" };
  }
}

function resolveCandidate(candidate, dimension) {
  if (!candidate) return undefined;
  try {
    if (candidate.typeId || typeof candidate.getComponent === "function") return candidate;
    return dimension.getBlock(candidate);
  } catch (error) {
    report(error, "resolveAttachedBlock");
    return undefined;
  }
}

function collectAttachedBlocks(piston, snapshot) {
  let attachmentApiFailed = false;

  for (const method of ["getAttachedBlocksLocations", "getAttachedBlocks"]) {
    if (typeof piston?.[method] !== "function") continue;
    try {
      const values = piston[method]();
      if (Array.isArray(values) && values.length > 0) {
        return {
          blocks: values.map((value) => resolveCandidate(value, snapshot.dimension)),
          uncertain: false,
          source: method,
        };
      }
    } catch (error) {
      attachmentApiFailed = true;
      report(error, method);
    }
  }

  const blocks = [];
  let unresolved = 0;
  for (const offset of ADJACENT_OFFSETS) {
    try {
      const block = snapshot.dimension.getBlock({
        x: snapshot.location.x + offset.x,
        y: snapshot.location.y + offset.y,
        z: snapshot.location.z + offset.z,
      });
      if (block) blocks.push(block);
      else unresolved += 1;
    } catch (error) {
      unresolved += 1;
      report(error, "adjacentFallback");
    }
  }

  return {
    blocks,
    uncertain: attachmentApiFailed || blocks.length === 0 || unresolved === ADJACENT_OFFSETS.length,
    source: "adjacent_fallback",
  };
}

function scheduleRetry(snapshot, reason, attempt) {
  const callback = () => neutralizePiston(snapshot, reason, attempt);
  if (typeof system.runTimeout === "function") system.runTimeout(callback, 1);
  else system.run(callback);
}

function neutralizePiston(snapshot, reason, attempt = 0) {
  if (!snapshot) return false;
  if (attempt === 0) {
    if (pendingMitigations.has(snapshot.key)) return true;
    pendingMitigations.add(snapshot.key);
  }

  let current = snapshot.block;
  try {
    current = snapshot.dimension.getBlock(snapshot.location) || current;
  } catch (error) {
    report(error, "readPistonBeforeNeutralize");
  }

  const currentType = readTypeId(current);
  if (currentType && !PISTON_TYPES.has(currentType)) {
    pendingMitigations.delete(snapshot.key);
    return true;
  }

  let changed = false;
  if (typeof current?.setType === "function") {
    try {
      current.setType("minecraft:air");
      changed = true;
    } catch (error) {
      report(error, "neutralizePistonSetType");
    }
  }
  if (!changed) {
    try {
      const result = snapshot.dimension.runCommand(
        `setblock ${snapshot.location.x} ${snapshot.location.y} ${snapshot.location.z} air`,
      );
      changed = result?.successCount !== 0;
    } catch (error) {
      report(error, "neutralizePistonCommand");
    }
  }

  let verified = changed;
  try {
    const after = snapshot.dimension.getBlock(snapshot.location);
    if (after) verified = !isPiston(after);
  } catch (error) {
    verified = false;
    report(error, "verifyNeutralization");
  }

  if (verified) {
    pendingMitigations.delete(snapshot.key);
    return true;
  }

  if (attempt < MAX_NEUTRALIZE_ATTEMPTS) {
    scheduleRetry(snapshot, reason, attempt + 1);
    return false;
  }

  pendingMitigations.delete(snapshot.key);
  const error = new Error(`No se pudo neutralizar piston ${snapshot.key} reason=${reason}`);
  report(error, "neutralizePistonExhausted");
  console.warn(`[ANTIDUPE_CRITICAL] ${error.message}`);
  return false;
}

function nearbyPlayerNames(snapshot) {
  try {
    return snapshot.dimension
      .getPlayers({ location: snapshot.location, maxDistance: 8 })
      .map((player) => player.name)
      .slice(0, 8);
  } catch (error) {
    report(error, "nearbyPlayers");
    return [];
  }
}

function emitIncident(snapshot, { phase, reason, source, types = [] }) {
  const tick = Number(system.currentTick) || 0;
  const previousTick = recentIncidents.get(snapshot.key);
  if (Number.isFinite(previousTick) && tick - previousTick < INCIDENT_COOLDOWN_TICKS) return;
  recentIncidents.set(snapshot.key, tick);
  if (recentIncidents.size > 512) recentIncidents.delete(recentIncidents.keys().next().value);

  const evidence = {
    dimension: snapshot.dimensionId,
    location: snapshot.location,
    phase,
    reason,
    source,
    attachedTypes: [...new Set(types.filter(Boolean))].slice(0, 16),
    nearbyPlayers: nearbyPlayerNames(snapshot),
    tick,
  };
  console.warn(`[ANTIDUPE_BLOCK] piston=${snapshot.location.x},${snapshot.location.y},${snapshot.location.z} dimension=${snapshot.dimensionId} phase=${phase} reason=${reason}`);
  console.warn(`[ANTIDUPE_EVIDENCE_V1]${JSON.stringify(evidence)}`);
}

function handlePistonActivation(event) {
  let snapshot;
  try {
    const piston = event?.piston;
    const block = event?.block || piston?.block;
    snapshot = snapshotPiston(block);
    if (!piston || !snapshot) throw new Error("Evento de piston incompleto");

    const attached = collectAttachedBlocks(piston, snapshot);
    let blocked = attached.uncertain;
    let reason = attached.uncertain ? "uncertain_inspection" : "ordinary_blocks";
    const types = [];

    for (const candidate of attached.blocks) {
      const classification = classifyBlock(candidate);
      types.push(classification.typeId);
      if (classification.blocked) {
        blocked = true;
        reason = classification.reason;
        break;
      }
      if (!classification.hasInventory) continue;
      const sanitation = sanitizeBlockContainer(candidate, undefined, "piston_attachment");
      if (sanitation.failed || !sanitation.hasInventory || sanitation.removed > 0) {
        blocked = true;
        reason = sanitation.failed || !sanitation.hasInventory ? "container_inspection_error" : "bundle_container";
        break;
      }
    }

    if (!blocked) return;
    const phase = event?.isExpanding === false ? "retracting" : "expanding";
    emitIncident(snapshot, { phase, reason, source: attached.source, types });
    neutralizePiston(snapshot, reason);
  } catch (error) {
    report(error, "pistonActivateHandler");
    if (snapshot) {
      emitIncident(snapshot, { phase: "unknown", reason: "handler_error", source: "fail_closed" });
      neutralizePiston(snapshot, "handler_error");
    } else {
      console.warn(`[ANTIDUPE_CRITICAL] No se pudo resolver el piston del evento: ${error}`);
    }
  }
}

const pistonSignal = world.afterEvents?.pistonActivate;
if (pistonSignal && typeof pistonSignal.subscribe === "function") {
  pistonSignal.subscribe(handlePistonActivation);
} else {
  console.warn("[ANTIDUPE_CRITICAL] pistonActivate no esta disponible; la barrera posterior de contencion no esta operativa.");
}

const pistonPlacementSignal = world.beforeEvents?.playerInteractWithBlock;
if (EMERGENCY_BLOCK_PLAYER_PISTON_PLACEMENT && pistonPlacementSignal && typeof pistonPlacementSignal.subscribe === "function") {
  pistonPlacementSignal.subscribe((event) => {
    try {
      const typeId = String(event?.itemStack?.typeId || "");
      if (!PISTON_TYPES.has(typeId)) return;
      event.cancel = true;
      const player = event.player;
      console.warn(`[ANTIDUPE_PREVENT] player=${player?.name || "unknown"} item=${typeId} dimension=${player?.dimension?.id || "unknown"}`);
      system.run(() => {
        try {
          player?.sendMessage("§c[Anti-Dupe] La colocacion de pistones esta deshabilitada por proteccion de integridad.");
        } catch (error) {
          report(error, "notifyPreventedPlacement");
        }
      });
    } catch (error) {
      event.cancel = true;
      report(error, "preventPistonPlacement");
    }
  });
}

const placedBlockSignal = world.afterEvents?.playerPlaceBlock;
if (placedBlockSignal && typeof placedBlockSignal.subscribe === "function") {
  placedBlockSignal.subscribe((event) => {
    try {
      sanitizeBlockContainer(event?.block, event?.player, "player_place_block");
      if (!EMERGENCY_BLOCK_PLAYER_PISTON_PLACEMENT || !isPiston(event?.block)) return;
      const snapshot = snapshotPiston(event.block);
      if (snapshot) neutralizePiston(snapshot, "placement_fallback");
    } catch (error) {
      report(error, "playerPlaceBlockFallback");
    }
  });
}

const itemUseSignal = world.beforeEvents?.itemUse;
if (itemUseSignal && typeof itemUseSignal.subscribe === "function") {
  itemUseSignal.subscribe((event) => {
    try {
      if (!isBundleTypeId(event?.itemStack?.typeId)) return;
      event.cancel = true;
      system.run(() => {
        normalizePlayerBundles(event.source, "item_use");
        notifyBundleDisabled(event.source);
      });
    } catch (error) {
      event.cancel = true;
      report(error, "blockBundleUse");
    }
  });
}

const bundleInteractionSignal = world.beforeEvents?.playerInteractWithBlock;
if (bundleInteractionSignal && typeof bundleInteractionSignal.subscribe === "function") {
  bundleInteractionSignal.subscribe((event) => {
    try {
      if (!isBundleTypeId(event?.itemStack?.typeId)) return;
      event.cancel = true;
      system.run(() => {
        normalizePlayerBundles(event.player, "block_interaction");
        notifyBundleDisabled(event.player);
      });
    } catch (error) {
      event.cancel = true;
      report(error, "blockBundleInteraction");
    }
  });
}

const inventoryChangeSignal = world.afterEvents?.playerInventoryItemChange;
if (inventoryChangeSignal && typeof inventoryChangeSignal.subscribe === "function") {
  inventoryChangeSignal.subscribe((event) => {
    if (!isBundleTypeId(event?.itemStack?.typeId) && !isBundleTypeId(event?.beforeItemStack?.typeId)) return;
    system.run(() => normalizePlayerBundleStorage(event.player, "inventory_change"));
  });
}

const playerSpawnSignal = world.afterEvents?.playerSpawn;
if (playerSpawnSignal && typeof playerSpawnSignal.subscribe === "function") {
  playerSpawnSignal.subscribe((event) => {
    system.run(() => normalizePlayerBundleStorage(event.player, "player_spawn"));
  });
}

for (const [signalName, sourceField] of [["blockContainerOpened", "openSource"], ["blockContainerClosed", "closeSource"]]) {
  const signal = world.afterEvents?.[signalName];
  if (!signal || typeof signal.subscribe !== "function") continue;
  signal.subscribe((event) => {
    const source = event?.[sourceField]?.entity || event?.player;
    const player = source?.typeId === "minecraft:player" ? source : undefined;
    sanitizeBlockContainer(event?.block, player, signalName);
  });
}

for (const [signalName, sourceField] of [["entityContainerOpened", "openSource"], ["entityContainerClosed", "closeSource"]]) {
  const signal = world.afterEvents?.[signalName];
  if (!signal || typeof signal.subscribe !== "function") continue;
  signal.subscribe((event) => {
    const source = event?.[sourceField]?.entity;
    const player = source?.typeId === "minecraft:player" ? source : undefined;
    sanitizeEntityContainer(event?.entity, player, signalName);
  });
}

const entityItemPickupSignal = world.beforeEvents?.entityItemPickup;
if (entityItemPickupSignal && typeof entityItemPickupSignal.subscribe === "function") {
  entityItemPickupSignal.subscribe((event) => {
    try {
      const item = event?.item?.getComponent?.("minecraft:item")?.itemStack;
      if (!item || !isBundleTypeId(item.typeId)) return;
      event.cancel = true;
      system.run(() => sanitizeLooseBundleEntity(event.item, "pickup_prevented"));
    } catch (error) {
      event.cancel = true;
      report(error, "blockBundlePickup");
    }
  });
}

const entitySpawnSignal = world.afterEvents?.entitySpawn;
if (entitySpawnSignal && typeof entitySpawnSignal.subscribe === "function") {
  entitySpawnSignal.subscribe((event) => {
    const entity = event?.entity;
    if (entity?.typeId === "minecraft:item") {
      system.run(() => sanitizeLooseBundleEntity(entity, "entitySpawn"));
    } else if (entity?.typeId === "minecraft:player") {
      system.run(() => normalizePlayerBundleStorage(entity, "entitySpawn"));
    }
  });
}

const entityLoadSignal = world.afterEvents?.entityLoad;
if (entityLoadSignal && typeof entityLoadSignal.subscribe === "function") {
  entityLoadSignal.subscribe((event) => {
    const entity = event?.entity;
    if (entity?.typeId === "minecraft:item") {
      system.run(() => sanitizeLooseBundleEntity(entity, "entityLoad"));
    } else if (entity?.typeId === "minecraft:player") {
      system.run(() => normalizePlayerBundleStorage(entity, "entityLoad"));
    } else {
      try {
        if (entity?.getComponent?.("minecraft:inventory")) {
          system.run(() => sanitizeEntityContainer(entity, undefined, "entityLoad"));
        }
      } catch (error) {
        report(error, "inspectLoadedEntityContainer");
      }
    }
  });
}

system.run(() => {
  const players = world.getAllPlayers?.() || world.getPlayers?.() || [];
  for (const player of players) normalizePlayerBundleStorage(player, "addon_startup");
});
