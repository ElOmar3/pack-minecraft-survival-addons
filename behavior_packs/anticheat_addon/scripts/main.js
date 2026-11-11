import { ErrorReporter } from "./ErrorReporter.js";
import { world, system, CommandPermissionLevel, CustomCommandStatus, CustomCommandParamType, PlayerPermissionLevel } from "@minecraft/server";
import { Core } from "./Core.js";
import { Config } from "./Config.js";
import { ExemptionManager } from "./ExemptionManager.js";
import { CombatAnalyzer } from "./CombatAnalyzer.js";
import { InventoryAnalyzer } from "./InventoryAnalyzer.js";
import { ViolationManager } from "./ViolationManager.js";
import { BlockBreakEventProvider } from "./features/nuker/BlockBreakEventProvider.js";
import { NukerSessionWindow } from "./features/nuker/NukerSessionWindow.js";
import { BulkBreakAuthorizationRegistry } from "./features/nuker/BulkBreakAuthorizationRegistry.js";
import { ScaffoldPlacementEventProvider } from "./features/scaffold/ScaffoldPlacementEventProvider.js";
import { InventoryExploitFeatureExtractor } from "./features/inventory_exploits/InventoryExploitFeatureExtractor.js";
import { XRaySessionWindow } from "./features/xray/XRaySessionWindow.js";
import { CentralPipeline } from "./pipeline/CentralPipeline.js";
import { EconomyIntegrityDetector } from "./features/economy/EconomyIntegrityDetector.js";
import { InventorySnapshotProvider } from "./features/economy/InventorySnapshotProvider.js";
import { emitEvidence, evidenceRateLimiter } from "./EvidenceRateLimiter.js";
import { playerKey, rememberPlayer } from "./Identity.js";






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
globalThis.__sqlite_sync_complete_v2__.delete("anticheat_addon");
globalThis.__sqlite_request_sync_v3__("anticheat_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("anticheat_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("anticheat_addon", 1);
  } catch (e) {}
}, 120);
system.runTimeout(() => {
  // Sin demonio (mundo importado sin bridge) se opera en modo degradado tras ~10s: RAM es la fuente de verdad.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("anticheat_addon");
    if (state && !state.complete) {
      state.degraded = true;
      globalThis.__sqlite_sync_complete_v2__.set("anticheat_addon", Date.now());
      globalThis.__sqlite_flush_pending_v3__("anticheat_addon");
    }
  } catch (e) {}
}, 200);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
CentralPipeline.init();

const economyDetector = new EconomyIntegrityDetector({
    dispatch(packet) {
        emitEvidence({
            type: "ECONOMY_INTEGRITY_CANDIDATE",
            player: packet?.data?.playerName || packet?.data?.playerId || "unknown",
            features: [packet?.subtype || "unknown", packet?.data?.assetId || "unknown", String(packet?.data?.delta || 0)]
        });
    }
}, true);
const snapshotProvider = new InventorySnapshotProvider(economyDetector);
if (Config.enabled) {
    snapshotProvider.startPolling(100);
}

const nukerEventProvider = new BlockBreakEventProvider();
const nukerAuthRegistry = new BulkBreakAuthorizationRegistry();
const nukerSessionWindow = new NukerSessionWindow(nukerAuthRegistry);
const scaffoldProvider = new ScaffoldPlacementEventProvider();
const inventoryExploitExtractor = new InventoryExploitFeatureExtractor();
const xraySessions = new Map();
let inventoryExploitAuditTicks = 0;

system.runInterval(() => {
    if (!Config.enabled) return;
    const packets = scaffoldProvider.evaluateClosedSessions(Date.now());
    for (const packet of packets) {
        const threatModel = packet.scaffold?.threatModel;
        if (threatModel && threatModel !== "NONE" && threatModel !== "LEGITIMATE_FAST_BUILDING" && threatModel !== "LEGITIMATE_BUILDING") {
            const player = world.getAllPlayers().find(p => p.id === packet.playerId);
            const playerName = player ? player.name : `ID_${packet.playerId}`;
            emitEvidence({
                type: "SCAFFOLD_CANDIDATE_DETECTED",
                player: playerName,
                features: [threatModel]
            });
        }
    }

    inventoryExploitAuditTicks += 20;
    if (inventoryExploitAuditTicks < 100) return;
    inventoryExploitAuditTicks = 0;

    // Inventory Exploits check
    for (const player of world.getAllPlayers()) {
        try {
            const inventory = player.getComponent("minecraft:inventory");
            if (inventory && inventory.container) {
                const features = inventoryExploitExtractor.extractFeatures(player.id, inventory.container, Date.now());
                const reason = features.evidence?.inventoryExploits?.reason;
                if (!features.valid && reason && reason !== "ANALYSIS_BUDGET_EXCEEDED" && reason !== "INTERNAL_ERROR") {
                    emitEvidence({
                        type: "INVENTORY_EXPLOIT_CANDIDATE_DETECTED",
                        player: player.name,
                        features: [reason]
                    });
                }
            }
        } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
            console.warn("Error running inventory exploits check: " + e);
        }
    }
}, 20); // check every second

nukerEventProvider.subscribe((data) => {
    if (!Config.enabled) return;
    try {
        const features = nukerSessionWindow.processBreakEvent(data);
        if (features && features.flag !== "NONE" && features.flag !== "LEGITIMATE_BULK_BREAK") {
            emitEvidence({
                type: "NUKER_CANDIDATE_DETECTED",
                player: data.player.name,
                features: [features.flag]
            });
        }
    } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
        console.warn("Error in NukerFeatureExtractor: " + e);
    }
});

nukerEventProvider.subscribe((data) => {
    if (!Config.enabled) return;
    try {
        if (!xraySessions.has(data.player.id)) {
            xraySessions.set(data.player.id, new XRaySessionWindow(data.player.id));
        }
        const xraySession = xraySessions.get(data.player.id);
        const blockPos = data.block.location || { x: data.block.x, y: data.block.y, z: data.block.z };
        const blockId = data.brokenBlockPermutation ? data.brokenBlockPermutation.type.id : "minecraft:air";
        
        const localSnapshot = { isVisible: false }; 
        xraySession.onBlockBroken(blockPos, blockId, localSnapshot);
        
        if (xraySession.pathGraph.nodes.length >= 50) {
            const xrayResult = xraySession.analyzeSession();
            const flags = xrayResult?.xray?.flags || [];
            if (!xrayResult?.xray?.budgetExceeded && flags.length > 0) {
                 emitEvidence({
                    type: "XRAY_CANDIDATE_DETECTED",
                    player: data.player.name,
                    features: flags
                 });
            }
            xraySessions.set(data.player.id, new XRaySessionWindow(data.player.id));
        }
    } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
        console.warn("Error in XRayFeatureExtractor: " + e);
    }
});

// Inicializar el núcleo del Anticheat
Core.init();
const COMMAND_NAMESPACE = "s";

function commandOk(message) {
  return { status: CustomCommandStatus.Success, message };
}

function commandError(message) {
  return { status: CustomCommandStatus.Failure, message };
}

function isPlayerOp(player) {
  try {
    if (player?.playerPermissionLevel === PlayerPermissionLevel.Operator) return true;
  } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" }); }
  try {
    return !!(player && (
      player.isOp === true ||
      (typeof player.isOp === "function" && player.isOp()) ||
      player.hasTag?.("op") ||
      player.hasTag?.("admin")
    ));
  } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return false;
  }
}

function sendDebugReport(requester, targetName) {
  const target = world.getAllPlayers().find((player) => player.name.toLowerCase() === String(targetName || "").trim().toLowerCase());
  if (!target) {
    requester.sendMessage(`§c[Server Integrity] No se encontró al jugador: ${targetName}`);
    return;
  }

  const score = ViolationManager.getScore(playerKey(target)).toFixed(2);
  const recents = ViolationManager.getRecentDetections(playerKey(target), target.xuid);
  requester.sendMessage(`§c§l[Server Integrity]§r §7Jugador: §e${target.name} §7| Score: §c${score} §7| XUID: §d${target.xuid || "sin-xuid"}`);
  try {
    requester.sendMessage(`§7Dim: §e${target.dimension.id} §7| Pos: §a${target.location.x.toFixed(1)}, ${target.location.y.toFixed(1)}, ${target.location.z.toFixed(1)} §7| GM: §b${target.getGameMode?.() || "?"}`);
  } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  try {
    const tags = target.getTags?.() || [];
    if (tags.length) {
      requester.sendMessage(`§7Tags: §8${tags.join(", ")}`);
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  if (recents.length === 0) {
    requester.sendMessage("§7Sin detecciones recientes.");
    return;
  }

  for (const entry of recents.slice(-8).reverse()) {
    requester.sendMessage(
      `§7${new Date(entry.timestamp).toLocaleTimeString("es-ES")} §f${entry.detector} §7obs:§e${entry.observed} §7esp:§e${entry.expected} §7act:§c${entry.action} §8${JSON.stringify(entry.context || {}).slice(0, 80)}`
    );
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
      register({
        name: `${COMMAND_NAMESPACE}:acdebug`,
        description: "Muestra el estado del anticheat para un jugador",
        permissionLevel: CommandPermissionLevel.GameDirectors ?? CommandPermissionLevel.Admin ?? CommandPermissionLevel.Any,
        mandatoryParameters: [{ name: "jugador", type: CustomCommandParamType.String }],
      }, (origin, jugador) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        system.run(() => {
          if (!isPlayerOp(sender)) {
            sender.sendMessage("§c[Server Integrity] No tienes permisos para usar /s:acdebug.");
            return;
          }
          sendDebugReport(sender, String(jugador || ""));
        });
        return commandOk("Procesando acdebug.");
      });
    } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Server Integrity] Error registrando /s:acdebug: " + e);
    }
  });
}

registerCustomCommands();

// Desactivar retroalimentación de comandos para limpiar el chat de spam
try {
  system.run(() => {
    try {
      world.getDimension("overworld").runCommand("gamerule sendcommandfeedback false");
      world.getDimension("overworld").runCommand("gamerule commandblockoutput false");
    } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  });
} catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

// Registro de Eventos y Puentes de Análisis

// 1. Escuchar daño para otorgar exención temporal de knockback
try {
  world.afterEvents.entityHurt.subscribe((event) => {
    if (!Config.enabled) return;
    const hurtEntity = event.hurtEntity;
    if (hurtEntity && hurtEntity.typeId === "minecraft:player") {
      // Exención por 1.5 segundos (1500ms) contra alertas de velocidad debido a empujes
      ExemptionManager.addExemption(playerKey(hurtEntity), "knockback", 1500);
    }
  });
} catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Server Integrity] Error al registrar entityHurt en main.js: " + e);
}

// 2. Detección de teletransporte: world.afterEvents.playerTeleport NO existe en esta versión de la API.
//    La detección se realiza por distancia en Core.js (si un jugador se mueve >10 bloques en un tick,
//    se otorga exención automática de teleport por 2000ms).

// 3. Registrar análisis de combate en eventos de ataque
try {
  world.afterEvents.entityHitEntity.subscribe((event) => {
    if (!Config.enabled) return;
    if (event.damagingEntity && event.damagingEntity.typeId === "minecraft:player" && isPlayerOp(event.damagingEntity)) return;
    CombatAnalyzer.analyzeHit(event);
  });
} catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Server Integrity] Error al registrar entityHitEntity en main.js: " + e);
}

// 4. Registrar análisis de minería/ruinas en eventos antes de romper bloques
try {
  world.beforeEvents.playerBreakBlock.subscribe((event) => {
    if (!Config.enabled) return;
    if (isPlayerOp(event.player)) return;
    InventoryAnalyzer.analyzeBlockBreak(event);
  });
  world.afterEvents.playerBreakBlock.subscribe((event) => {
    if (!Config.enabled) return;
    if (isPlayerOp(event.player)) return;
    nukerEventProvider.onBlockBreak(event);
  });
} catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Server Integrity] Error al registrar playerBreakBlock en main.js: " + e);
}

try {
  const placeEvent = world.afterEvents.playerPlaceBlock;
  if (placeEvent && typeof placeEvent.subscribe === "function") {
    placeEvent.subscribe((event) => {
      if (!Config.enabled) return;
      if (isPlayerOp(event.player)) return;
      InventoryAnalyzer.analyzeBlockPlace(event);
      try {
        scaffoldProvider.onPlayerPlaceBlock(event);
      } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
        console.warn("Error processing scaffold event: " + e);
      }
    });
  }
} catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Server Integrity] Error al registrar playerPlaceBlock en main.js: " + e);
}

try {
  const interactBlockEvent = world.afterEvents?.playerInteractWithBlock;
  if (interactBlockEvent && typeof interactBlockEvent.subscribe === "function") {
    interactBlockEvent.subscribe((event) => {
      if (!Config.enabled) return;
      if (isPlayerOp(event.player)) return;
      InventoryAnalyzer.markContainerInteraction(event.player, event.block);
    });
  }
} catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Server Integrity] Error al registrar playerInteractWithBlock en main.js: " + e);
}

// Limpiar recursos en la desconexión para evitar fugas de memoria
try {
  world.beforeEvents.playerLeave.subscribe((event) => {
    const playerName = event.player.name;
    const playerId = event.player.id;
    const key = rememberPlayer(event.player);

    xraySessions.delete(playerId);
    evidenceRateLimiter.clearPlayer(playerName);
    // CombatAnalyzer NO se limpia aquí: Core.js evalúa el combat-log en
    // afterEvents.playerLeave y limpia después de aplicar el ban si procede.
    snapshotProvider.clear(key);
    if (CentralPipeline.aggregator && CentralPipeline.aggregator.playerWindows) {
      CentralPipeline.aggregator.playerWindows.delete(playerId);
    }
  });
} catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Server Integrity] Error al registrar playerLeave en main.js: " + e);
}
