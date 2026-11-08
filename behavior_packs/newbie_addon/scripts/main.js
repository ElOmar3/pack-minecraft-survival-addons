import { ErrorReporter } from "./ErrorReporter.js";
import {
  CommandPermissionLevel,
  CustomCommandStatus,
  world,
  system,
} from "@minecraft/server";







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
globalThis.__sqlite_sync_complete_v2__.delete("newbie_addon");
globalThis.__sqlite_request_sync_v3__("newbie_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("newbie_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("newbie_addon", 1);
  } catch (e) {}
}, 120);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===

// ============================================================================
// NOVEDADES ONBOARDING Y PROTECCIÓN PVP DE NOVATOS (FASE 1)
// ============================================================================
const PVP_IMMUNITY_DURATION_MS = 30 * 60 * 1000; // 30 minutos

function getPlayerPvpImmunity(player) {
  if (!player || !player.isValid) return 0;
  const until = Number(globalThis.__sqlite_get_prop_v2__("newbie_addon", player, "pvp_immune_until") || 0);
  return until > Date.now() ? until : 0;
}

function handlePvpToggle(player, action) {
  const immuneUntil = getPlayerPvpImmunity(player);
  const act = String(action || "").toLowerCase();

  if (act === "on" || act === "activar" || act === "desactivar_inmunidad") {
    if (!immuneUntil) {
      player.sendMessage("§b§l[PVP] §7Ya tienes el combate PvP habilitado.");
      return;
    }
    globalThis.__sqlite_set_prop_v2__("newbie_addon", player, "pvp_immune_until", 0);
    try { player.removeTag("newbie_pvp_immune"); } catch (e) {}
    player.sendMessage("§c§l[PVP] §eHas renunciado a tu inmunidad de novato. ¡El combate ahora está habilitado en zonas salvajes!");
    try { player.playSound("random.anvil_use", { pitch: 1.2 }); } catch (e) {}
    return;
  }

  if (immuneUntil > 0) {
    const remainingMinutes = Math.ceil((immuneUntil - Date.now()) / 60000);
    player.sendMessage(`§b§l[Novato] §7Te quedan §a${remainingMinutes} minutos §7de protección PvP de novato.`);
    player.sendMessage("§7Escribe §e/s:pvp activar §7si deseas renunciar a tu protección para poder combatir.");
  } else {
    player.sendMessage("§b§l[PVP] §7Tu combate PvP está activo. El daño dependerá de si te encuentras en un terreno protegido.");
  }
}

// Interceptación de daño PvP de novatos
const newbieDamageEvent = world.beforeEvents.entityDamage || world.beforeEvents.entityHurt;
if (newbieDamageEvent) {
  try {
    newbieDamageEvent.subscribe((event) => {
      const victim = event.hurtEntity || event.entity;
      if (!victim || victim.typeId !== "minecraft:player") return;

      const damageSource = event.damageSource;
      let attacker = damageSource?.damagingEntity;
      if (attacker && attacker.typeId !== "minecraft:player") {
        const owner = damageSource?.damagingProjectile?.getComponent?.("minecraft:projectile")?.owner;
        if (owner && owner.typeId === "minecraft:player") attacker = owner;
      }

      if (!attacker || attacker.typeId !== "minecraft:player") return;

      const now = Date.now();
      const victimImmuneUntil = Number(globalThis.__sqlite_get_prop_v2__("newbie_addon", victim, "pvp_immune_until") || 0);
      if (victimImmuneUntil > now) {
        event.cancel = true;
        system.run(() => {
          try {
            attacker.sendMessage(`§b§l[Novato] §7${victim.name} tiene protección PvP de novato activa.`);
          } catch (e) {}
        });
        return;
      }

      const attackerImmuneUntil = Number(globalThis.__sqlite_get_prop_v2__("newbie_addon", attacker, "pvp_immune_until") || 0);
      if (attackerImmuneUntil > now) {
        event.cancel = true;
        system.run(() => {
          try {
            attacker.sendMessage("§b§l[Novato] §cNo puedes atacar mientras tengas inmunidad de novato activa. Usa §e/s:pvp activar §cpara renunciar a ella.");
          } catch (e) {}
        });
        return;
      }
    });
  } catch (err) {
    ErrorReporter.report(err, { addonId: "newbie_addon", moduleId: "main.js", operation: "newbieDamageEvent", category: "runtime" });
  }
}

// Barrido periódico para retirar tag al expirar la inmunidad
system.runInterval(() => {
  const now = Date.now();
  for (const player of world.getAllPlayers()) {
    if (player.hasTag("newbie_pvp_immune")) {
      const immuneUntil = Number(globalThis.__sqlite_get_prop_v2__("newbie_addon", player, "pvp_immune_until") || 0);
      if (now >= immuneUntil) {
        try { player.removeTag("newbie_pvp_immune"); } catch (e) {}
        player.sendMessage("§e§l[Protección Novato] §7Tu protección de 30 minutos ha finalizado. ¡El PvP ahora está habilitado en zonas salvajes!");
      }
    }
  }
}, 200);

console.warn("New Player Experience (NPE) Addon iniciado.");

const WELCOME_SEEN_KEY = "npe_welcome_seen";
const LEGACY_FIRST_JOIN_KEY = "first_join_date";

// Mostrar la bienvenida una sola vez. La propiedad anterior se reconoce para no
// repetir el mensaje a jugadores que ya entraron antes de esta versión.
world.afterEvents.playerSpawn.subscribe((event) => {
  const player = event.player;
  if (!player || !event.initialSpawn) return;

  const alreadyWelcomed = globalThis.__sqlite_get_prop_v2__("newbie_addon", player, WELCOME_SEEN_KEY) === true ||
    globalThis.__sqlite_get_prop_v2__("newbie_addon", player, LEGACY_FIRST_JOIN_KEY) !== undefined;
  if (alreadyWelcomed) return;

  globalThis.__sqlite_set_prop_v2__("newbie_addon", player, WELCOME_SEEN_KEY, true);
  
  // Otorgar 30 minutos de inmunidad PvP
  const immunityEnd = Date.now() + PVP_IMMUNITY_DURATION_MS;
  globalThis.__sqlite_set_prop_v2__("newbie_addon", player, "pvp_immune_until", immunityEnd);
  try { player.addTag("newbie_pvp_immune"); } catch (e) {}

  // Mensaje de bienvenida inicial
  system.runTimeout(() => {
    if (!player || !player.isValid) return;
    player.sendMessage("§a§l=================================");
    player.sendMessage("§a  ¡Bienvenido a Pacífico Comunitario!");
    player.sendMessage("§e  🛡 Tienes §a30 minutos §ede inmunidad contra PvP.");
    player.sendMessage("§7  Usa §b/s:rtp §7para encontrar una zona salvaje segura.");
    player.sendMessage("§7  Abre el menú principal escribiendo §b/s:menu§7.");
    player.sendMessage("§a§l=================================");
    try { player.playSound("random.levelup", { pitch: 1.0 }); } catch (e) {}
  }, 40);

  // Tutorial guiado secuencial de 5 pasos
  const steps = [
    { delay: 140, msg: "§e💡 Guía (1/5): Escribe §b/s:rtp §epara explorar una zona salvaje segura." },
    { delay: 260, msg: "§e💡 Guía (2/5): Marca esquinas con §b/s:pos1 §ey §b/s:pos2 §epara tu terreno." },
    { delay: 380, msg: "§e💡 Guía (3/5): Protege tu base escribiendo §b/s:proteger <nombre>§e." },
    { delay: 500, msg: "§e💡 Guía (4/5): Guarda la ubicación de tu casa con §b/s:guardarcasa§e." },
    { delay: 620, msg: "§e💡 Guía (5/5): Abre el Hub general con §b/s:menu §eo guías con §b/s:guias§e." }
  ];

  for (const step of steps) {
    system.runTimeout(() => {
      if (!player || !player.isValid) return;
      player.onScreenDisplay?.setActionBar(step.msg);
      player.sendMessage(step.msg);
      try { player.playSound("random.orb", { pitch: 1.2 }); } catch (e) {}
    }, step.delay);
  }
});

const RTP_MIN_Y = -63;
const RTP_MAX_SAFE_FLOOR_Y = 200;
const RTP_CHUNK_LOAD_ATTEMPTS = 150; // 15 segundos (el sondeo se ejecuta cada 2 ticks)
const RTP_HAZARDOUS_BLOCKS = new Set([
  "minecraft:lava", "minecraft:flowing_lava", "minecraft:magma", "minecraft:fire",
  "minecraft:soul_fire", "minecraft:cactus", "minecraft:campfire", "minecraft:soul_campfire",
  "minecraft:powder_snow", "minecraft:sweet_berry_bush", "minecraft:pointed_dripstone"
]);

function isRtpEmptySpace(block) {
  const typeId = String(block?.typeId || "").toLowerCase();
  return block?.isAir === true || [
    "minecraft:air", "minecraft:cave_air", "minecraft:void_air", "minecraft:tallgrass",
    "minecraft:short_grass", "minecraft:fern", "minecraft:large_fern", "minecraft:deadbush",
    "minecraft:vine", "minecraft:snow_layer"
  ].includes(typeId);
}

function findSafeRtpPosition(dimension, x, z) {
  const blockX = Math.floor(x);
  const blockZ = Math.floor(z);
  for (let y = RTP_MAX_SAFE_FLOOR_Y; y >= RTP_MIN_Y; y--) {
    const floor = dimension.getBlock({ x: blockX, y, z: blockZ });
    const feet = dimension.getBlock({ x: blockX, y: y + 1, z: blockZ });
    const head = dimension.getBlock({ x: blockX, y: y + 2, z: blockZ });
    const floorId = String(floor?.typeId || "").toLowerCase();

    if (!floor || RTP_HAZARDOUS_BLOCKS.has(floorId) || floor.isLiquid || floor.isAir || floor.isSolid === false) continue;
    if (!isRtpEmptySpace(feet) || !isRtpEmptySpace(head)) continue;
    return { x: blockX + 0.5, y: y + 1, z: blockZ + 0.5 };
  }
  return undefined;
}

function handleRtp(player) {
  // Cooldown de RTP de 10 minutos
  const lastRtp = globalThis.__sqlite_get_prop_v2__("newbie_addon", player, "last_rtp") || 0;
  if (Date.now() - Number(lastRtp) < 10 * 60 * 1000) {
    const remaining = Math.ceil((10 * 60 * 1000 - (Date.now() - Number(lastRtp))) / 60000);
    player.sendMessage(`§cDebes esperar ${remaining} minutos para usar RTP de nuevo.`);
    return false;
  }
  
  system.run(() => {
    player.sendMessage("§aBuscando una zona segura aleatoria... Por favor espera.");
    const origin = {
      location: { x: player.location.x, y: player.location.y, z: player.location.z },
      dimension: player.dimension,
    };
    let finished = false;

    const returnToOrigin = (message) => {
      if (finished) return;
      finished = true;
      if (!player || !player.isValid) return;
      try {
        player.teleport(origin.location, { dimension: origin.dimension });
      } catch (error) {
        ErrorReporter.report(error, { addonId: "newbie_addon", moduleId: "main.js", operation: "rtp-return-origin", category: "runtime" });
      }
      try {
        player.runCommand("effect @s resistance 0");
        player.runCommand("effect @s slow_falling 0");
        player.runCommand("effect @s fire_resistance 0");
        player.sendMessage(message);
      } catch (e) {}
    };
    
    try {
      // Protección mientras se genera y valida el destino; nunca dejamos al jugador caer.
      player.runCommand("effect @s resistance 60 255 true");
      player.runCommand("effect @s slow_falling 60 1 true");
      player.runCommand("effect @s fire_resistance 60 1 true");
      // maxHeight evita que el propio comando deje al jugador en Y=300 mientras carga terreno.
      player.runCommand("spreadplayers 0 0 1000 5000 @s 200");
      
      let attempts = 0;
      const checkInterval = system.runInterval(() => {
        attempts++;
        if (!player || !player.isValid) {
          system.clearRun(checkInterval);
          return;
        }
        try {
          const pos = player.location;
          const dimension = player.dimension;
          
          // Provocará un error si el chunk no se ha cargado todavía
          dimension.getBlock({ x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) });
          
          const safePosition = findSafeRtpPosition(dimension, pos.x, pos.z);
          if (!safePosition) {
            system.clearRun(checkInterval);
            console.warn(`[RTP] destino rechazado player=${player.name} x=${Math.floor(pos.x)} y=${Math.floor(pos.y)} z=${Math.floor(pos.z)} reason=no_safe_ground`);
            returnToOrigin("§cNo se encontró suelo seguro para RTP. Permaneces en tu ubicación anterior.");
            return;
          }

          system.clearRun(checkInterval);
          player.teleport(safePosition, { dimension });
          globalThis.__sqlite_set_prop_v2__("newbie_addon", player, "last_rtp", Date.now());
          finished = true;
          player.runCommand("effect @s resistance 0");
          player.runCommand("effect @s slow_falling 0");
          player.runCommand("effect @s fire_resistance 0");
          player.sendMessage("§a¡Has sido teletransportado aleatoriamente de forma segura!");
        } catch (e) {
          // Si el chunk no carga en tres segundos, se revierte el teletransporte.
          if (attempts >= RTP_CHUNK_LOAD_ATTEMPTS) {
            system.clearRun(checkInterval);
            console.warn(`[RTP] destino no cargó player=${player.name} attempts=${attempts}`);
            returnToOrigin("§cEl destino RTP no pudo validarse. Permaneces en tu ubicación anterior.");
          }
        }
      }, 2);
      
    } catch (e) {
      player.sendMessage("§cError al ejecutar RTP. Puede que el mundo no esté generado ahí.");
      returnToOrigin("§cNo se pudo encontrar un destino RTP seguro. Permaneces en tu ubicación anterior.");
    }
  });
  return true;
}

// Comando público seguro. El scriptevent se conserva solo por compatibilidad interna.
system.beforeEvents.startup.subscribe((event) => {
  const registry = event?.customCommandRegistry;
  const register = typeof registry?.registerCommand === "function"
    ? registry.registerCommand.bind(registry)
    : typeof registry?.register === "function"
      ? registry.register.bind(registry)
      : undefined;
  if (!register) return;

  try {

    register({
      name: "s:pvp",
      description: "Consulta o renuncia a tu protección PvP de novato",
      permissionLevel: CommandPermissionLevel.Any,
      optionalParameters: [{ name: "accion", type: CustomCommandParamType.String }],
    }, (origin, accion) => {
      const player = origin?.sourceEntity;
      if (!player || player.typeId !== "minecraft:player") {
        return { status: CustomCommandStatus.Failure, message: "Solo para jugadores." };
      }
      system.run(() => handlePvpToggle(player, accion !== undefined ? String(accion) : ""));
      return { status: CustomCommandStatus.Success, message: "Procesando pvp." };
    });
    register({
      name: "s:rtp",
      description: "Teletransporte aleatorio seguro",
      permissionLevel: CommandPermissionLevel.Any,
    }, (origin) => {
      const player = origin?.sourceEntity;
      if (!player || player.typeId !== "minecraft:player") {
        return { status: CustomCommandStatus.Failure, message: "Solo para jugadores." };
      }
      system.run(() => handleRtp(player));
      return { status: CustomCommandStatus.Success, message: "Buscando zona segura." };
    });
  } catch (error) {
    ErrorReporter.report(error, { addonId: "newbie_addon", moduleId: "main.js", operation: "register-rtp", category: "bootstrap" });
    console.warn("[NPE] No se pudo registrar /s:rtp: " + error);
  }
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "cmd:rtp") return;
  const player = event.sourceEntity;
  if (!player || player.typeId !== "minecraft:player") return;
  handleRtp(player);
});
