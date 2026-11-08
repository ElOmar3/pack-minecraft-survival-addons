import { ErrorReporter } from "./ErrorReporter.js";
import { world, system, ItemStack, EquipmentSlot } from "@minecraft/server";
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
globalThis.__sqlite_sync_complete_v2__.delete("blood_moon_addon");
globalThis.__sqlite_request_sync_v3__("blood_moon_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("blood_moon_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("blood_moon_addon", 1);
  } catch (e) {}
}, 120);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
console.warn("Blood Moon Addon auditado e iniciado.");

// El estado se conserva en SQLite para que sobreviva a reinicios del servidor.
let bloodMoonActiveCache = false;

function isBloodMoonActive() {
  if (bloodMoonActiveCache) return true;
  return globalThis.__sqlite_get_prop_v2__("blood_moon_addon", "world", "is_blood_moon") === true;
}

function setBloodMoonActive(active) {
  bloodMoonActiveCache = active;
  try {
    globalThis.__sqlite_set_prop_v2__("blood_moon_addon", "world", "is_blood_moon", active);
  } catch (e) {}
}

let nightChecked = false;

const HOSTILE_MOBS = [
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
];

function equipZombie(entity, isElite) {
  try {
    const equippable = entity.getComponent("minecraft:equippable");
    if (!equippable) return;

    // Validación y mapeo de slots compatible con cualquier versión de la API de Bedrock
    const Head = EquipmentSlot?.Head ?? "Head";
    const Chest = EquipmentSlot?.Chest ?? "Chest";
    const Legs = EquipmentSlot?.Legs ?? "Legs";
    const Feet = EquipmentSlot?.Feet ?? "Feet";
    const Mainhand = EquipmentSlot?.Mainhand ?? "Mainhand";

    if (isElite) {
      equippable.setEquipment(Head, new ItemStack("minecraft:diamond_helmet", 1));
      equippable.setEquipment(Chest, new ItemStack("minecraft:diamond_chestplate", 1));
      equippable.setEquipment(Legs, new ItemStack("minecraft:diamond_leggings", 1));
      equippable.setEquipment(Feet, new ItemStack("minecraft:diamond_boots", 1));
      equippable.setEquipment(Mainhand, new ItemStack("minecraft:diamond_sword", 1));
    } else {
      const rand = Math.random();
      if (rand < 0.5) {
        equippable.setEquipment(Head, new ItemStack("minecraft:iron_helmet", 1));
        equippable.setEquipment(Chest, new ItemStack("minecraft:iron_chestplate", 1));
        equippable.setEquipment(Mainhand, new ItemStack("minecraft:iron_sword", 1));
      } else {
        equippable.setEquipment(Head, new ItemStack("minecraft:chainmail_helmet", 1));
        equippable.setEquipment(Chest, new ItemStack("minecraft:chainmail_chestplate", 1));
        equippable.setEquipment(Mainhand, new ItemStack("minecraft:stone_sword", 1));
      }
    }
  } catch (e) {
    console.warn("[Blood Moon] Error equipando zombi (esquema de versión incompatible): " + e);
  }
}

function buffMob(entity) {
  if (!entity || !entity.isValid) return;
  try {
    const isElite = Math.random() < 0.15;
    if (isElite) {
      entity.addEffect("minecraft:speed", 20000, { amplifier: 2, showParticles: true });
      entity.addEffect("minecraft:strength", 20000, { amplifier: 1, showParticles: true });
      entity.addEffect("minecraft:resistance", 20000, { amplifier: 1, showParticles: true });
      
      try {
        let name = "Enemigo de Sangre";
        if (entity.typeId === "minecraft:zombie") name = "§cZombi Sangriento";
        else if (entity.typeId === "minecraft:skeleton") name = "§cEsqueleto del Caos";
        else if (entity.typeId === "minecraft:creeper") name = "§c⚡ Creeper Inestable ⚡";
        else if (entity.typeId === "minecraft:spider") name = "§cViuda Roja";
        
        entity.nameTag = name;
      } catch (e) {}
    } else {
      entity.addEffect("minecraft:speed", 20000, { amplifier: 1, showParticles: true });
      entity.addEffect("minecraft:strength", 20000, { amplifier: 0, showParticles: true });
      entity.addEffect("minecraft:resistance", 20000, { amplifier: 0, showParticles: false });
    }

    // Equipar al zombi con mejor armadura y espadas deferido al siguiente tick
    if (entity.typeId === "minecraft:zombie") {
      system.run(() => {
        try {
          if (entity && entity.isValid) {
            equipZombie(entity, isElite);
          }
        } catch (e) {}
      });
    }
  } catch (e) { ErrorReporter.report(e, { addonId: "blood_moon_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
}

function startBloodMoon() {
  if (isBloodMoonActive()) return;
  setBloodMoonActive(true);
  
  world.sendMessage("§c§l=================================");
  world.sendMessage("§c§l    ¡LA LUNA DE SANGRE HA SALIDO!");
  world.sendMessage("§4Los monstruos son más rápidos y fuertes.");
  world.sendMessage("§6Derrotar a los monstruos afectados otorga §e§lX2 DINERO§r§6 y buffs de combate. (se respetan los límites de economía)" );
  world.sendMessage("§4¡Las camas no funcionan! ¡Sobrevive a la noche!");
  world.sendMessage("§c§l=================================");
  
  // Ambientación de terror y ceguera/oscuridad temporal
  const overworld = world.getDimension("overworld");
  for (const player of world.getAllPlayers()) {
    try {
      player.playSound("mob.wither.spawn");
      player.addEffect("minecraft:darkness", 100, { amplifier: 0, showParticles: false });
    } catch (e) {}
  }
  
  // Forzar tormenta para el ambiente de la Luna de Sangre
  try {
    overworld.runCommand("weather thunder");
  } catch (e) {}
  
  // Buffear a los monstruos que YA están vivos en el mundo
  for (const mobType of HOSTILE_MOBS) {
    const entities = overworld.getEntities({ type: mobType });
    for (const entity of entities) {
      buffMob(entity);
    }
  }
}

function endBloodMoon() {
  if (!isBloodMoonActive()) return;
  setBloodMoonActive(false);
  
  world.sendMessage("§a§l=================================");
  world.sendMessage("§a§l    La Luna de Sangre ha terminado.");
  world.sendMessage("§eLos monstruos vuelven a la normalidad.");
  world.sendMessage("§a§l=================================");
  
  const overworld = world.getDimension("overworld");
  // Limpiar el clima de tormenta
  try {
    overworld.runCommand("weather clear");
  } catch (e) {}
  
  // Quitar los bufos a los monstruos vivos
  for (const mobType of HOSTILE_MOBS) {
    const entities = overworld.getEntities({ type: mobType });
    for (const entity of entities) {
      try {
        entity.removeEffect("minecraft:speed");
        entity.removeEffect("minecraft:strength");
        entity.removeEffect("minecraft:resistance");
      } catch (e) { ErrorReporter.report(e, { addonId: "blood_moon_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
    }
  }
}

// 1. BUFFEO EFICIENTE: Solo aplica cuando spawnean nuevos mobs (sin lag)
world.afterEvents.entitySpawn.subscribe((event) => {
  if (isBloodMoonActive() && HOSTILE_MOBS.includes(event.entity.typeId)) {
    buffMob(event.entity);
  }
});

// 2. CONTROL DEL TIEMPO (Cada 5 segundos)
system.runInterval(() => {
  const time = world.getTimeOfDay();
  
  // Atardecer (13000 a 14000)
  if (time >= 13000 && time < 14000) {
    if (!nightChecked) {
      nightChecked = true;
      if (Math.random() < 0.15) { // 15% de probabilidad
        startBloodMoon();
      }
    }
  }
  
  // Amanecer o día (0 a 12000 o más de 23500)
  if ((time >= 0 && time < 12000) || time >= 23500) {
    if (nightChecked) {
      nightChecked = false;
    }
    if (isBloodMoonActive()) {
      endBloodMoon();
    }
  }
}, 100);

// 3. BLOQUEO DE CAMAS
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  if (!isBloodMoonActive()) return;
  
  const block = event.block;
  // Identifica cualquier tipo de cama sin importar el color (ej: minecraft:red_bed)
  if (block.typeId.includes("bed")) {
    event.cancel = true; // Impide dormir
    system.run(() => {
      event.player.sendMessage("§c¡No puedes dormir! Hay demasiados monstruos cerca por la Luna de Sangre.");
    });
  }
});

// 4. LOOT EXTRA Y EFECTO DE COMBATE (SED DE SANGRE)
world.afterEvents.entityDie.subscribe((event) => {
  if (!isBloodMoonActive()) return;
  
  const deadEntity = event.deadEntity;
  const killer = event.damageSource?.damagingEntity;
  
  if (!killer || killer.typeId !== "minecraft:player") return;
  
  if (HOSTILE_MOBS.includes(deadEntity.typeId)) {
    const rand = Math.random();
    
    let dim, loc;
    try {
      dim = deadEntity.dimension;
      loc = deadEntity.location;
    } catch (err) {
      // Fallback seguro: Si el mob ya no es válido en el mundo, usamos la posición del asesino
      try {
        dim = killer.dimension;
        loc = killer.location;
      } catch (killerErr) {
        return; // Si ambos fallan, salimos pacíficamente
      }
    }
    
    if (!dim || !loc) return;
    
    // Sed de Sangre (Bloodlust): regeneración y prisa al matar un monstruo
    try {
      killer.addEffect("minecraft:regeneration", 100, { amplifier: 0, showParticles: true });
      killer.addEffect("minecraft:haste", 200, { amplifier: 0, showParticles: true });
    } catch (e) {}
    
    try {
      if (deadEntity.typeId === "minecraft:creeper") {
        dim.createExplosion(loc, 3, { causesFire: false, breaksBlocks: false });
      }
    } catch (e) {}

    try {
      if (rand < 0.05) {
        dim.spawnItem(new ItemStack("minecraft:enchanted_golden_apple", 1), loc);
      } else if (rand < 0.15) {
        dim.spawnItem(new ItemStack("minecraft:diamond", 1), loc);
      } else if (rand < 0.45) {
        dim.spawnItem(new ItemStack("minecraft:emerald", 1), loc);
      }
    } catch (e) { ErrorReporter.report(e, { addonId: "blood_moon_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }
});

// 5. COMANDO DE ADMINISTRADOR
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "cmd:bloodmoon") return;
  const sender = event.sourceEntity;
  if (!sender || sender.typeId !== "minecraft:player") return;
  
  system.run(() => {
    const isOp = sender.hasTag("op") || sender.hasTag("admin") || sender.isOp;
    if (!isOp) {
      sender.sendMessage("§cSolo los operadores pueden iniciar este evento.");
      return;
    }
    
    if (isBloodMoonActive()) {
      sender.sendMessage("§cYa hay una Luna de Sangre activa.");
      return;
    }
    
    world.getDimension("overworld").runCommand("time set 13500");
    startBloodMoon();
    sender.sendMessage("§a¡Luna de Sangre iniciada manualmente!");
  });
});

// 6. INTELIGENCIA DE COMBATE: SALTO AGRESIVO (LEAP AI) PARA ZOMBIS
system.runInterval(() => {
  if (!isBloodMoonActive()) return;
  
  try {
    const overworld = world.getDimension("overworld");
    const zombies = overworld.getEntities({ type: "minecraft:zombie" });
    
    for (const zombie of zombies) {
      if (!zombie.isValid) continue;
      
      try {
        // Encontrar al jugador más cercano dentro de 8 bloques
        const players = overworld.getPlayers({
          location: zombie.location,
          maxDistance: 8
        });
        
        if (players.length > 0) {
          const target = players[0];
          const distSq = Math.pow(target.location.x - zombie.location.x, 2) +
                         Math.pow(target.location.z - zombie.location.z, 2);
          const dist = Math.sqrt(distSq);
          
          // Si el jugador está entre 3 y 7 bloques (rango de salto/acercamiento)
          if (dist >= 3 && dist <= 7) {
            const dx = target.location.x - zombie.location.x;
            const dz = target.location.z - zombie.location.z;
            const length = Math.sqrt(dx*dx + dz*dz);
            
            if (length > 0) {
              const vx = (dx / length) * 0.45;
              const vz = (dz / length) * 0.45;
              
              // Aplicar impulso hacia adelante y un poco hacia arriba para saltar obstáculos/huecos
              zombie.applyImpulse({ x: vx, y: 0.35, z: vz });
              
              // Sonido de ataque/gruñido rápido
              try {
                overworld.playSound("mob.zombie.say", zombie.location, { pitch: 1.15, volume: 0.4 });
              } catch (soundErr) {}
            }
          }
        }
      } catch (innerErr) {}
    }
  } catch (e) {
    // Evitar que errores generales del motor rompan el bucle
  }
}, 20);

// 7. ATAQUE IGNEO CARMESÍ: Mobs prenden fuego a jugadores al golpear
try {
  world.afterEvents.entityHitEntity.subscribe((event) => {
    if (!isBloodMoonActive()) return;
    const attacker = event.damagingEntity;
    const victim = event.hitEntity;
    if (!attacker || !victim || victim.typeId !== "minecraft:player") return;
    
    if (HOSTILE_MOBS.includes(attacker.typeId)) {
      // 25% de probabilidad de prender fuego al jugador por 3 segundos
      if (Math.random() < 0.25) {
        try {
          victim.setOnFire(3, true);
          victim.sendMessage("§c¡El ataque del monstruo carmesí te ha prendido fuego!");
        } catch (err) {}
      }
    }
  });
  console.warn("[Blood Moon] Ataques ígneos carmesí vinculados.");
} catch (e) {
  console.warn("[Blood Moon] Error al registrar entityHitEntity: " + e);
}

// =========================================================================
// NUEVOS EVENTOS DINÁMICOS DEL SERVIDOR
// =========================================================================

// Auxiliares de Economía
function getPlayerMoney(player) {
  try {
    const objective = world.scoreboard.getObjective("money");
    if (!objective) return 0;
    return objective.getScore(player) || 0;
  } catch (e) {
    return 0;
  }
}

function addPlayerMoney(player, amount) {
  try {
    const objective = world.scoreboard.getObjective("money") || world.scoreboard.addObjective("money", "§e$ Dinero");
    if (objective) {
      const current = objective.getScore(player) || 0;
      objective.setScore(player, current + amount);
      return true;
    }
  } catch (e) {}
  return false;
}

// Auxiliar para abrir formularios de manera segura y gestionar la pantalla del jugador (UserBusy)
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
        system.run(() => { onCancel(response); });
      }
      return;
    }
    system.run(() => { onSelect(response); });
  }).catch((err) => {
    console.warn(`[Blood Moon UI] Error en safeOpenForm: ${err}`);
  });
}

function getOtherPlayers(player) {
  return world.getAllPlayers()
    .filter(p => p.id !== player.id)
    .map(p => p.name);
}

// -------------------------------------------------------------------------
// 1. SÚPER TORMENTA ELÉCTRICA (Charged Tempest)
// -------------------------------------------------------------------------
let superTempestActive = false;
let superTempestTicks = 0;

function isSuperTempestActive() {
  if (superTempestActive) return true;
  return globalThis.__sqlite_get_prop_v2__("blood_moon_addon", "world", "is_super_tempest") === true;
}

function setSuperTempestActive(active) {
  superTempestActive = active;
  try {
    globalThis.__sqlite_set_prop_v2__("blood_moon_addon", "world", "is_super_tempest", active);
  } catch (e) {}
}

// Intentar activar la súper tormenta de forma aleatoria (3% de probabilidad cada 3 minutos)
system.runInterval(() => {
  if (isBloodMoonActive() || isSuperTempestActive()) return;
  
  if (Math.random() < 0.03) {
    setSuperTempestActive(true);
    superTempestTicks = 6000; // 5 minutos (6000 ticks)
    
    world.sendMessage("§e§l=================================");
    world.sendMessage("§e§l⚡ ¡SÚPER TORMENTA ELÉCTRICA DETECTADA! ⚡");
    world.sendMessage("§7El clima se altera. Los Creepers se cargarán de energía.");
    world.sendMessage("§6¡Cuidado! Los rayos sobrecargarán a quienes golpeen.");
    world.sendMessage("§e§l=================================");
    
    try {
      const overworld = world.getDimension("overworld");
      // Lluvia sin truenos naturales: la tormenta conserva su ambiente, pero
      // evita que el clima del juego genere rayos que puedan iniciar incendios.
      overworld.runCommand("weather rain");
      for (const player of world.getAllPlayers()) {
        player.playSound("ambient.weather.thunder");
      }
    } catch(e) {}
  }
}, 3600);

// Controlar duración de la súper tormenta y descargas aleatorias
system.runInterval(() => {
  if (!isSuperTempestActive()) return;
  
  superTempestTicks -= 100;
  if (superTempestTicks <= 0) {
    setSuperTempestActive(false);
    world.sendMessage("§e§l[Súper Tormenta] §aLa tormenta se disipa y los cielos se aclaran.");
    try {
      world.getDimension("overworld").runCommand("weather clear");
    } catch(e) {}
    return;
  }
  
  // Rayos aleatorios cerca de los jugadores
  try {
    const overworld = world.getDimension("overworld");
    for (const player of world.getAllPlayers()) {
      if (Math.random() < 0.08) { // 8% de probabilidad cada 5 segundos
        const loc = player.location;
        const rx = loc.x + (Math.random() * 20 - 10);
        const rz = loc.z + (Math.random() * 20 - 10);
        const ry = loc.y;
        
        const strikeLoc = { x: rx, y: ry, z: rz };
        // Rayo audiovisual del evento. No se crea una entidad lightning_bolt,
        // porque esa entidad puede prender bloques. Los beneficios cercanos se
        // conservan en el bloque siguiente.
        overworld.playSound("ambient.weather.thunder", strikeLoc, { volume: 0.8, pitch: 1 });
        
        // Si cae muy cerca del jugador, darle bufo
        const dist = Math.sqrt(Math.pow(loc.x - rx, 2) + Math.pow(loc.z - rz, 2));
        if (dist < 4) {
          player.addEffect("minecraft:speed", 600, { amplifier: 2 });
          player.addEffect("minecraft:strength", 600, { amplifier: 2 });
          player.sendMessage("§e§l⚡ ¡Has sido bendecido por el rayo! Sobrecarga de poder activada.");
        }
      }
    }
  } catch(e) {}
}, 100);

// -------------------------------------------------------------------------
// 2. FIEBRE DE LA COSECHA (Harvest Fever)
// -------------------------------------------------------------------------
let harvestFeverActive = false;
let harvestFeverTicks = 0;

function isHarvestFeverActive() {
  if (harvestFeverActive) return true;
  return globalThis.__sqlite_get_prop_v2__("blood_moon_addon", "world", "is_harvest_fever") === true;
}

function setHarvestFeverActive(active) {
  harvestFeverActive = active;
  try {
    globalThis.__sqlite_set_prop_v2__("blood_moon_addon", "world", "is_harvest_fever", active);
  } catch (e) {}
}

// Probabilidad del 4% cada 4 minutos de iniciar Fiebre de la Cosecha
system.runInterval(() => {
  if (isHarvestFeverActive()) return;
  if (Math.random() < 0.04) {
    setHarvestFeverActive(true);
    harvestFeverTicks = 6000; // 5 minutos
    world.sendMessage("§e§l=================================");
    world.sendMessage("§a§l🌾 ¡FIEBRE DE LA COSECHA INICIADA! 🌾");
    world.sendMessage("§7Durante 5 minutos, recolectar cultivos otorga dinero.");
    world.sendMessage("§6¡Tienes probabilidad de encontrar Semillas Sagradas!");
    world.sendMessage("§e§l=================================");
    for (const player of world.getAllPlayers()) {
      try { player.playSound("ui.toast.challenge_complete"); } catch(e) {}
    }
  }
}, 4800);

// Decrementar contador
system.runInterval(() => {
  if (!isHarvestFeverActive()) return;
  harvestFeverTicks -= 200;
  if (harvestFeverTicks <= 0) {
    setHarvestFeverActive(false);
    world.sendMessage("§a§l[Cosecha] §eLa Fiebre de la Cosecha ha terminado.");
  }
}, 200);

// -------------------------------------------------------------------------
// 3. INFESTACIÓN SUBTERRÁNEA Y COSECHA AGRÍCOLA
// -------------------------------------------------------------------------
world.afterEvents.playerBreakBlock.subscribe((event) => {
  const player = event.player;
  const block = event.brokenBlockPermutation;
  if (!player || player.typeId !== "minecraft:player" || !block) return;
  
  const loc = event.block.location;
  let dim;
  try {
    dim = event.dimension;
  } catch (e) {
    dim = player.dimension;
  }
  
  // A. Fiebre de la Cosecha
  const cropList = [
    "minecraft:wheat",
    "minecraft:carrots",
    "minecraft:potatoes",
    "minecraft:beetroot",
    "minecraft:cocoa",
    "minecraft:nether_wart"
  ];
  if (isHarvestFeverActive() && cropList.includes(block.type.id)) {
    const pay = Math.floor(Math.random() * 8) + 8; // $8 a $15
    const success = addPlayerMoney(player, pay);
    if (success) {
      player.onScreenDisplay.setActionBar(`§e+ $${pay} §7(Cosecha)`);
    }
    
    // Semilla Sagrada
    if (Math.random() < 0.05) {
      try {
        const item = new ItemStack("minecraft:wheat_seeds", 1);
        item.nameTag = "§6§lSemilla Sagrada";
        item.setLore(["§7Una semilla imbuida con magia de la tierra.", "§7Véndela en la tienda por un precio alto."]);
        dim.spawnItem(item, loc);
        player.sendMessage("§a¡Has encontrado una §6§lSemilla Sagrada§a!");
      } catch(e) {}
    }
  }
  
  // B. Infestación Subterránea
  if (loc.y < 0 && Math.random() < 0.015) { // 1.5% de probabilidad bajo Y=0
    // Evitar spam de eventos
    try {
      const tagCheck = player.hasTag("in_infestation");
      if (tagCheck) return;
      player.addTag("in_infestation");
    } catch(e) { return; }
    
    player.sendMessage("§c§l¡Has perturbado un nido subterráneo! ¡Repele la plaga!");
    try { player.playSound("mob.silverfish.say"); } catch(e) {}
    
    const spawnedMobs = [];
    const mobTypes = ["minecraft:silverfish", "minecraft:cave_spider", "minecraft:husk"];
    
    for (let i = 0; i < 4; i++) {
      try {
        const rtype = mobTypes[Math.floor(Math.random() * mobTypes.length)];
        const spawnLoc = { x: loc.x + (Math.random() * 4 - 2), y: loc.y, z: loc.z + (Math.random() * 4 - 2) };
        const mob = dim.spawnEntity(rtype, spawnLoc);
        mob.nameTag = "§cPlaga del Abismo";
        spawnedMobs.push(mob);
      } catch(e) {}
    }
    
    // Monitorear finalización de la plaga
    let checkCount = 0;
    const intervalId = system.runInterval(() => {
      checkCount++;
      const alive = spawnedMobs.filter(m => m.isValid);
      
      if (alive.length === 0) {
        system.clearRun(intervalId);
        if (player && player.isValid) {
          try { player.removeTag("in_infestation"); } catch(e) {}
          player.sendMessage("§a§l¡Infestación superada! Has limpiado la plaga.");
          try {
            player.playSound("random.levelup");
            // Generar cofre de recompensa
            const spawnLoc = { x: player.location.x, y: player.location.y, z: player.location.z };
            const blockAt = dim.getBlock(spawnLoc);
            if (blockAt && (blockAt.typeId === "minecraft:air" || blockAt.typeId === "minecraft:tallgrass" || blockAt.typeId === "minecraft:water")) {
              blockAt.setType("minecraft:chest");
              
              // Llenar cofre
              const container = blockAt.getComponent("minecraft:inventory")?.container;
              if (container) {
                container.setItem(0, new ItemStack("minecraft:raw_iron", Math.floor(Math.random() * 8) + 4));
                container.setItem(1, new ItemStack("minecraft:raw_gold", Math.floor(Math.random() * 4) + 2));
                if (Math.random() < 0.3) {
                  container.setItem(2, new ItemStack("minecraft:diamond", 1));
                }
              }
            }
          } catch(e) {}
        }
      }
      
      // Cancelar después de 2 minutos (por si se escapan)
      if (checkCount > 60) {
        system.clearRun(intervalId);
        if (player && player.isValid) {
          try { player.removeTag("in_infestation"); } catch(e) {}
        }
        for (const m of alive) {
          try { m.triggerEvent("minecraft:despawn"); } catch(e) { try { m.teleport({x:0, y:-100, z:0}); } catch(e2) {} }
        }
      }
    }, 40);
  }
});

// -------------------------------------------------------------------------
// 4. BÚSQUEDA DEL TESORO PERDIDO
// -------------------------------------------------------------------------
system.runInterval(() => {
  // Cada 30 minutos
  try {
    const players = world.getAllPlayers();
    if (players.length === 0) return;
    
    // Elegir un jugador aleatorio como ancla para el tesoro
    const anchor = players[Math.floor(Math.random() * players.length)];
    const dim = anchor.dimension;
    const rx = anchor.location.x + (Math.random() * 400 - 200);
    const rz = anchor.location.z + (Math.random() * 400 - 200);
    
    // Encontrar bloque sólido superior
    let ry = 80;
    try {
      const topBlock = dim.getBlockFromRay({ x: rx, y: 150, z: rz }, { x: 0, y: -1, z: 0 });
      if (topBlock) ry = topBlock.block.location.y + 1;
    } catch(e) {}
    
    const chestLoc = { x: Math.round(rx), y: Math.round(ry), z: Math.round(rz) };
    const chestBlock = dim.getBlock(chestLoc);
    if (!chestBlock) return;
    
    chestBlock.setType("minecraft:chest");
    const container = chestBlock.getComponent("minecraft:inventory")?.container;
    if (!container) return;
    
    // Llenar cofre
    container.setItem(0, new ItemStack("minecraft:diamond", Math.floor(Math.random() * 4) + 2));
    container.setItem(4, new ItemStack("minecraft:emerald", Math.floor(Math.random() * 12) + 6));
    if (Math.random() < 0.4) {
      container.setItem(8, new ItemStack("minecraft:enchanted_golden_apple", 1));
    }
    
    // Invocar guardias
    for (let i = 0; i < 3; i++) {
      try {
        const guardLoc = { x: chestLoc.x + (Math.random() * 4 - 2), y: chestLoc.y, z: chestLoc.z + (Math.random() * 4 - 2) };
        const guard = dim.spawnEntity("minecraft:zombie", guardLoc);
        guard.nameTag = "§cGuardia del Tesoro";
        const eq = guard.getComponent("minecraft:equippable");
        if (eq) {
          eq.setEquipment(EquipmentSlot?.Head ?? "Head", new ItemStack("minecraft:iron_helmet", 1));
          eq.setEquipment(EquipmentSlot?.Chest ?? "Chest", new ItemStack("minecraft:iron_chestplate", 1));
          eq.setEquipment(EquipmentSlot?.Mainhand ?? "Mainhand", new ItemStack("minecraft:iron_sword", 1));
        }
      } catch(e) {}
    }
    
    world.sendMessage("§e§l=================================");
    world.sendMessage("§e§l🏴‍☠️ ¡UN COFRE DEL TESORO HA CAÍDO! 🏴‍☠️");
    world.sendMessage(`§7Ubicación aproximada: §aX: ${chestLoc.x}§7, §aZ: ${chestLoc.z}`);
    world.sendMessage("§6El cofre está custodiado por Guardias del Tesoro.");
    world.sendMessage("§e§l=================================");
    
    for (const p of world.getAllPlayers()) {
      try { p.playSound("random.screenshot"); } catch(e) {}
    }
  } catch(e) {}
}, 36000); // Cada 30 minutos

// -------------------------------------------------------------------------
// 5. COMERCIANTE AMBULANTE LEGENDARIO (Legendary Wandering Trader)
// -------------------------------------------------------------------------

// Detectar spawn de Wandering Trader y convertirlo con 15% de probabilidad
world.afterEvents.entitySpawn.subscribe((event) => {
  const entity = event.entity;
  if (!entity || !entity.isValid) return;
  
  if (entity.typeId === "minecraft:wandering_trader") {
    if (Math.random() < 0.15) {
      try {
        entity.nameTag = "§e§lMercader Legendario";
        const loc = entity.location;
        world.sendMessage("§e§l=================================");
        world.sendMessage("§e§l🧙‍♂️ ¡EL MERCADER LEGENDARIO HA LLEGADO! 🧙‍♂️");
        world.sendMessage(`§7Se encuentra comerciando en: §aX: ${Math.round(loc.x)} §7| §aZ: ${Math.round(loc.z)}`);
        world.sendMessage("§6¡Interactúa con él para ver sus ofertas exclusivas!");
        world.sendMessage("§e§l=================================");
      } catch(e) {}
    }
  }
  
  // Cargar Creepers con rayos durante la súper tormenta
  if (isSuperTempestActive() && entity.typeId === "minecraft:creeper") {
    const loc = entity.location;
    let dim;
    try {
      dim = entity.dimension;
    } catch(e) {
      return;
    }
    system.runTimeout(() => {
      try {
        // La carga de creepers se sustituye por el aviso sonoro del evento para
        // no crear fuego en el terreno.
        dim.playSound("ambient.weather.thunder", loc, { volume: 0.65, pitch: 1.1 });
      } catch(e) {}
    }, 5);
  }
});

// Interceptar interacción con el Mercader Legendario para abrir el menú personalizado
try {
  world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const target = event.target;
    const player = event.player;
    if (!target || !player || target.nameTag !== "§e§lMercader Legendario") return;
    
    // Cancelar la interacción nativa de trade
    event.cancel = true;
    
    // Abrir formulario personalizado
    system.run(() => {
      openLegendaryTraderMenu(player, target);
    });
  });
} catch(e) {
  console.warn("[Mercader] Error al registrar interacción: " + e);
}

function openLegendaryTraderMenu(player, merchant) {
  const money = getPlayerMoney(player);
  
  const form = new ActionFormData()
    .title("§e🧙‍♂️ MERCADER LEGENDARIO §r")
    .body(`§7Bienvenido. Vendo artículos raros a cambio del dinero de tu cuenta.\n\n§7Tu saldo actual: §a$${money}`)
    .button("💎 §1Espada de Netherite\n§aCosto: $15,000", "textures/items/netherite_sword")
    .button("🛡️ §2Pechera de Netherite\n§aCosto: $25,000", "textures/items/netherite_chestplate")
    .button("🍏 §6Manzana Dorada Encantada\n§aCosto: $5,000", "textures/items/apple_golden_enchanted")
    .button("🔱 §3Tridente Místico\n§aCosto: $12,000", "textures/items/trident")
    .button("❌ §4Cerrar");

  safeOpenForm(player, form, (response) => {
    const idx = response.selection;
    if (idx === 4 || idx === undefined) return;
    
    // Validar si el mercader sigue vivo
    if (!merchant || !merchant.isValid) {
      player.sendMessage("§cEl Mercader se ha marchado.");
      return;
    }
    
    const offers = [
      { name: "Espada de Netherite", id: "minecraft:netherite_sword", cost: 15000 },
      { name: "Pechera de Netherite", id: "minecraft:netherite_chestplate", cost: 25000 },
      { name: "Manzana Dorada Encantada", id: "minecraft:enchanted_golden_apple", cost: 5000 },
      { name: "Tridente", id: "minecraft:trident", cost: 12000 }
    ];
    
    const selected = offers[idx];
    if (!selected) return;
    
    if (money < selected.cost) {
      player.sendMessage(`§cNo tienes suficiente dinero. Requieres §a$${selected.cost}§c.`);
      openLegendaryTraderMenu(player, merchant);
      return;
    }
    
    // Cobrar e intentar entregar ítem
    try {
      const objective = world.scoreboard.getObjective("money");
      if (objective) {
        objective.setScore(player, money - selected.cost);
        player.dimension.spawnItem(new ItemStack(selected.id, 1), player.location);
        player.sendMessage(`§a¡Has comprado §e${selected.name}§a por §2$${selected.cost}§a!`);
        player.playSound("random.levelup");
      }
    } catch(e) {
      player.sendMessage("§cOcurrió un error al procesar tu compra.");
    }
  });
}
