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
globalThis.__sqlite_sync_complete_v2__.delete("camera_follower_addon");
globalThis.__sqlite_request_sync_v3__("camera_follower_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("camera_follower_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("camera_follower_addon", 1);
  } catch (e) {}
}, 120);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
console.warn("Camera Follower Addon iniciado.");
const COMMAND_NAMESPACE = "s";

function commandOk(message) {
  return { status: CustomCommandStatus.Success, message };
}

function commandError(message) {
  return { status: CustomCommandStatus.Failure, message };
}

// Mapa de jugadores en modo cámara: { playerName: { originalPosition, originalDimension, originalGamemode, timerId } }
const activeSpectators = new Map();
const CYCLE_TIME_SECS = 15; // Rotación cada 15 segundos

// Obtener un jugador aleatorio elegible (que no sea el espectador mismo)
function getRandomTarget(spectatorName) {
  const allPlayers = world.getAllPlayers();
  const eligible = allPlayers.filter(p => p.name !== spectatorName);
  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

// Ejecutar la rotación de cámara
function cycleSpectator(spectator) {
  const target = getRandomTarget(spectator.name);
  if (!target) {
    spectator.sendMessage("§b§l[§3Cámara§b§l]§r §cNo hay otros jugadores online para seguir.");
    return;
  }

  // Efecto visual de transición (Fade)
  try {
    spectator.runCommand("camera @s fade time 0.3 0.4 0.3");
  } catch (e) { ErrorReporter.report(e, { addonId: "camera_follower_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  // Teletransportar al espectador después de que comience el fade
  system.runTimeout(() => {
    try {
      spectator.teleport(target.location, {
        dimension: target.dimension,
        rotation: target.rotation || target.getRotation?.()
      });
      spectator.sendMessage(`§b§l[§3Cámara§b§l]§r §7Siguiendo a: §e${target.name}`);
    } catch (err) { ErrorReporter.report(err, { addonId: "camera_follower_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn(`Error al teletransportar cámara: ${err}`);
    }
  }, 6); // 6 ticks = 0.3s (duración del fade in)
}

function startSpectating(player) {
  if (activeSpectators.has(player.name)) return;

  // Guardamos su estado original (por defecto lo devolvemos a survival)
  const state = {
    originalPosition: { x: player.location.x, y: player.location.y, z: player.location.z },
    originalDimension: player.dimension
  };

  activeSpectators.set(player.name, state);

  // Cambiar a modo espectador
  try {
    player.runCommand("gamemode spectator");
    player.sendMessage("§b§l[§3Cámara§b§l]§r §aModo cámara automática activado. Usa §e/s:camara§a para salir.");
  } catch (e) { ErrorReporter.report(e, { addonId: "camera_follower_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    player.sendMessage("§b§l[§3Cámara§b§l]§r §cError al cambiar a modo espectador.");
  }

  // Iniciar ciclo periódico
  cycleSpectator(player); // primer ciclo inmediato
  
  const timerId = system.runInterval(() => {
    const activePlayer = world.getAllPlayers().find(p => p.name === player.name);
    if (!activePlayer) {
      // Si se desconecta, limpiamos su estado
      activeSpectators.delete(player.name);
      system.clearRun(timerId);
      return;
    }
    cycleSpectator(activePlayer);
  }, CYCLE_TIME_SECS * 20);

  state.timerId = timerId;
}

function stopSpectating(player) {
  const state = activeSpectators.get(player.name);
  if (!state) return;

  // Limpiar temporizador
  if (state.timerId) {
    system.clearRun(state.timerId);
  }

  activeSpectators.delete(player.name);

  // Restaurar gamemode a survival por defecto
  try {
    player.runCommand("gamemode survival");
  } catch (e) { ErrorReporter.report(e, { addonId: "camera_follower_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  // Restaurar posición
  try {
    player.teleport(state.originalPosition, {
      dimension: state.originalDimension
    });
    player.sendMessage("§b§l[§3Cámara§b§l]§r §cModo cámara desactivado. Has vuelto a tu posición original.");
  } catch (e) { ErrorReporter.report(e, { addonId: "camera_follower_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    player.sendMessage("§b§l[§3Cámara§b§l]§r §cModo cámara desactivado.");
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
      for (const name of ["camara", "spectate"]) {
        register({ name: `${COMMAND_NAMESPACE}:${name}`, description: "Activa o desactiva la camara", permissionLevel: CommandPermissionLevel.Admin }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          if (!sender.isOp()) return commandError("Solo para administradores.");
          system.run(() => {
            if (activeSpectators.has(sender.name)) stopSpectating(sender);
            else startSpectating(sender);
          });
          return commandOk("Alternando camara.");
        });
      }
    } catch (e) { ErrorReporter.report(e, { addonId: "camera_follower_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Camera Follower] Error registrando custom commands: " + e);
    }
  });
}

registerCustomCommands();

// Limpiar estados si un jugador se sale del juego
try {
  if (world.afterEvents && world.afterEvents.playerLeave && typeof world.afterEvents.playerLeave.subscribe === "function") {
    world.afterEvents.playerLeave.subscribe((event) => {
      const name = event.playerName;
      const state = activeSpectators.get(name);
      if (state && state.timerId) {
        system.clearRun(state.timerId);
        activeSpectators.delete(name);
      }
    });
  }
} catch (e) { ErrorReporter.report(e, { addonId: "camera_follower_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Camera Follower] Error al registrar playerLeave: " + e);
}
