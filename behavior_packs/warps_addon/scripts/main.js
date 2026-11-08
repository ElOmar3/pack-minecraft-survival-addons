import { ErrorReporter } from "./ErrorReporter.js";
import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, PlayerPermissionLevel, world, system } from "@minecraft/server";
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
globalThis.__sqlite_sync_complete_v2__.delete("warps_addon");
globalThis.__sqlite_request_sync_v3__("warps_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("warps_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("warps_addon", 1);
  } catch (e) {}
}, 120);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
console.warn("Warps Addon iniciado.");
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
    console.warn(`[Warps] Error en safeOpenForm: ${err}`);
  });
}

// Cargar y guardar base de datos de warps (SQLite persistence bridge)
function loadWarps() {
  const val = globalThis.__sqlite_get_prop_v2__("warps_addon", "world", "warps_db");
  if (!val) return {};
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    return {};
  }
}

function saveWarps(data) {
  globalThis.__sqlite_set_prop_v2__("warps_addon", "world", "warps_db", data);
}

function getDimensionSafe(dimensionId) {
  if (!dimensionId) return world.getDimension("overworld");
  if (typeof dimensionId !== "string") {
    if (dimensionId.id) return dimensionId;
    dimensionId = String(dimensionId);
  }
  const cleanId = dimensionId.replace(/^minecraft:/, "");
  try {
    return world.getDimension(dimensionId);
  } catch (e1) {
    try {
      return world.getDimension(cleanId);
    } catch (e2) {
      try {
        return world.getDimension("minecraft:" + cleanId);
      } catch (e3) {
        return world.getDimension("overworld");
      }
    }
  }
}

// Comprobación de operador
function isPlayerOp(player) {
  if (!player) return false;
  try {
    if (player.playerPermissionLevel === PlayerPermissionLevel.Operator) return true;
  } catch (e) { ErrorReporter.report(e, { addonId: "warps_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
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
        player.hasTag("Owner") ||
        player.hasTag("clan_admin_bypass") ||
        player.hasTag("zone_admin_bypass") ||
        player.hasTag("protection_bypass")
      ) {
        return true;
      }
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "warps_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  try {
    const permission = String(player.permission ?? player.commandPermissionLevel ?? "").toLowerCase();
    if (permission.includes("operator") || permission.includes("admin") || permission.includes("host") || permission.includes("owner") || permission.includes("director")) {
      return true;
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "warps_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  try {
    const gameMode = String(player.getGameMode?.() || "").toLowerCase();
    if (gameMode === "creative") {
      return true;
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "warps_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  try {
    if (typeof player.isOp === "function") {
      return player.isOp() === true;
    }
    if (player.isOp === true) {
      return true;
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "warps_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  return false;
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
      for (const name of ["destinos", "puntos", "teletransportes", "warps", "destino", "punto", "teletransporte", "warp"]) {
        register({ name: `${COMMAND_NAMESPACE}:${name}`, description: "Abre el menú de destinos y puntos públicos", permissionLevel: CommandPermissionLevel.Any }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          system.run(() => openWarpsMenu(sender));
          return commandOk("Abriendo destinos.");
        });
      }

      for (const name of ["fijardestino", "creardestino", "establecerpunto", "setwarp"]) {
        register({
          name: `${COMMAND_NAMESPACE}:${name}`,
          description: "Define un nuevo destino o punto público",
          permissionLevel: ADMIN_PERMISSION,
          mandatoryParameters: [{ name: "nombre", type: CustomCommandParamType.String }],
        }, (origin, nombre) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
          system.run(() => handleSetWarp(sender, String(nombre || "")));
          return commandOk(`Procesando ${name}.`);
        });
      }

      for (const name of ["borrardestino", "eliminardestino", "eliminarpunto", "delwarp"]) {
        register({
          name: `${COMMAND_NAMESPACE}:${name}`,
          description: "Elimina un destino o punto público",
          permissionLevel: ADMIN_PERMISSION,
          mandatoryParameters: [{ name: "nombre", type: CustomCommandParamType.String }],
        }, (origin, nombre) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
          system.run(() => handleDelWarp(sender, String(nombre || "")));
          return commandOk(`Procesando ${name}.`);
        });
      }
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        if (!isPlayerOp(sender)) return commandError("Solo para operadores.");
        system.run(() => handleDelWarp(sender, String(nombre || "")));
        return commandOk("Procesando delwarp.");
      });
    } catch (e) { ErrorReporter.report(e, { addonId: "warps_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Warps] Error registrando custom commands: " + e);
    }
  });
}

registerCustomCommands();

// Crear Warp (Solo OP)
function handleSetWarp(player, warpName) {
  if (!isPlayerOp(player)) {
    player.sendMessage("§b§l[§3Warps§b§l]§r §cSolo los administradores pueden definir puntos de warp.");
    return;
  }
  if (!warpName) {
    player.sendMessage("§b§l[§3Warps§b§l]§r §cUso: /s:setwarp <nombre>");
    return;
  }

  const nameClean = warpName.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!nameClean || nameClean.length > 15) {
    player.sendMessage("§b§l[§3Warps§b§l]§r §cNombre de warp inválido (máx 15 letras/números).");
    return;
  }

  const loc = player.location;
  const dimId = player.dimension.id;
  const rot = player.getRotation();

  const db = loadWarps();
  db[nameClean] = {
    x: Math.round(loc.x * 10) / 10,
    y: Math.round(loc.y * 10) / 10,
    z: Math.round(loc.z * 10) / 10,
    dimension: dimId,
    rotation: { x: Math.round(rot.x), y: Math.round(rot.y) }
  };

  saveWarps(db);
  player.sendMessage(`§b§l[§3Warps§b§l]§r §a¡Warp §e${nameClean} §adefinido con éxito en X: ${Math.round(loc.x)}, Y: ${Math.round(loc.y)}, Z: ${Math.round(loc.z)}!`);
}

// Eliminar Warp (Solo OP)
function handleDelWarp(player, warpName) {
  if (!isPlayerOp(player)) {
    player.sendMessage("§b§l[§3Warps§b§l]§r §cSolo los administradores pueden eliminar puntos de warp.");
    return;
  }
  if (!warpName) {
    player.sendMessage("§b§l[§3Warps§b§l]§r §cUso: /s:delwarp <nombre>");
    return;
  }

  const nameClean = warpName.toLowerCase();
  const db = loadWarps();

  if (!db[nameClean]) {
    player.sendMessage(`§b§l[§3Warps§b§l]§r §cEl warp §e${nameClean} §cno existe.`);
    return;
  }

  delete db[nameClean];
  saveWarps(db);
  player.sendMessage(`§b§l[§3Warps§b§l]§r §a¡Warp §e${nameClean} §aeliminado correctamente!`);
}

// Menú visual de Warps
function openWarpsMenu(player) {
  const db = loadWarps();
  const warpNames = Object.keys(db);

  const form = new ActionFormData()
    .title("§e§lPuntos de Warp")
    .body("§7Selecciona un destino público al que viajar:");

  // Botón de guía al inicio
  form.button("❔ ¿Cómo funciona? / Guía");

  warpNames.forEach((w) => {
    form.button(`🌟 ${w.toUpperCase()}\n§7Haz clic para viajar`);
  });

  safeOpenForm(player, form, (response) => {
    const idx = response.selection;
    if (idx === undefined) return;

    if (idx === 0) {
      openWarpsTutorial(player);
      return;
    }

    const warpIdx = idx - 1;
    if (warpIdx >= 0 && warpIdx < warpNames.length) {
      const name = warpNames[warpIdx];
      const warp = db[name];

      try {
        // Animación suave de fade
        player.runCommand("camera @s fade time 0.2 0.3 0.2");
        
        system.runTimeout(() => {
          try {
            if (!player || !player.isValid) return;
            const targetDim = getDimensionSafe(warp.dimension);
            player.teleport({ x: warp.x, y: warp.y, z: warp.z }, {
              dimension: targetDim,
              rotation: warp.rotation
            });
            player.sendMessage(`§b§l[§3Warps§b§l]§r §aTeletransportado con éxito a §e${name.toUpperCase()}§a.`);
          } catch (e) { ErrorReporter.report(e, { addonId: "warps_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
            player.sendMessage("§b§l[§3Warps§b§l]§r §cError al teletransportar a la dimensión destino.");
          }
        }, 4); // 4 ticks delay = 0.2s ( fade in start )
      } catch (err) { ErrorReporter.report(err, { addonId: "warps_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
        // Teletransporte directo sin fade si falla la cámara
        try {
          if (!player || !player.isValid) return;
          const targetDim = getDimensionSafe(warp.dimension);
          player.teleport({ x: warp.x, y: warp.y, z: warp.z }, {
            dimension: targetDim,
            rotation: warp.rotation
          });
          player.sendMessage(`§b§l[§3Warps§b§l]§r §aTeletransportado a §e${name.toUpperCase()}§a.`);
        } catch (e) { ErrorReporter.report(e, { addonId: "warps_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
          player.sendMessage("§b§l[§3Warps§b§l]§r §cError de teletransporte.");
        }
      }
    }
  });
}

function openWarpsTutorial(player) {
  const form = new ActionFormData()
    .title("❔ Guía de Warps")
    .body("§e¿Cómo funciona el Sistema de Warps?\n\n" +
          "§a1. ¿Qué son los Warps?\n" +
          "§7- Son puntos de teletransporte públicos definidos por la administración para viajar rápido.\n" +
          "§7- Escribe §e/s:warps §7en el chat para abrir este menú de viaje.\n\n" +
          "§a2. ¿Cómo viajar?\n" +
          "§7- Haz clic en cualquier destino de la lista principal.\n" +
          "§7- Tu pantalla hará un suave fundido a negro y aparecerás en la ubicación de destino.\n\n" +
          "§a3. Administración (Solo Operadores/Admins):\n" +
          "§7- Para crear un punto: Ve al sitio exacto y escribe §e/s:setwarp <nombre> §7en el chat.\n" +
          "§7- Para borrar un punto: Escribe §e/s:delwarp <nombre>§7.")
    .button("🔙 Volver");

  safeOpenForm(player, form, () => {
    openWarpsMenu(player);
  });
}
