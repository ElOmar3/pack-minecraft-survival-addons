const fs = require('fs');
const path = require('path');
const vm = require('vm');

const filePath = 'behavior_packs/protection_addon/scripts/main.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add activeBorderPreviews and helper functions
const borderSystemCode = `
// ============================================================================
// SISTEMA DE BORDES DE PARTÍCULAS Y BANDERAS (FASE 1)
// ============================================================================
const activeBorderPreviews = new Map(); // playerNameLower -> { zoneId, dimensionId, expiresAt }

function toggleZoneBorders(player, specificZone = null) {
  const nameKey = normalizeZonePlayerName(player.name);
  if (activeBorderPreviews.has(nameKey)) {
    activeBorderPreviews.delete(nameKey);
    player.sendMessage("§b§l[§3Protección§b§l]§r §7Visualización de bordes §cdesactivada§7.");
    return;
  }

  let zone = specificZone;
  if (!zone) {
    const zones = getZonesAt(player.location, player.dimension.id);
    zone = zones.find(z => !z.disabled && (normalizeZonePlayerName(z.owner) === nameKey || isPlayerOp(player)));
    if (!zone) zone = zones.find(z => !z.disabled);
  }

  if (!zone) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cDebes estar dentro de un terreno protegido para ver sus bordes.");
    return;
  }

  activeBorderPreviews.set(nameKey, {
    zoneId: zone.id,
    dimensionId: player.dimension.id,
    expiresAt: Date.now() + 60000
  });

  player.sendMessage(\`§b§l[§3Protección§b§l]§r §aLímites de §e"\${zone.name}" §aactivados con partículas esmeralda (60s). Usa §b/s:zona bordes §apara ocultarlos.\`);
}

system.runInterval(() => {
  if (activeBorderPreviews.size === 0) return;
  const now = Date.now();
  const zones = loadZones();

  for (const [nameKey, preview] of activeBorderPreviews.entries()) {
    if (now > preview.expiresAt) {
      activeBorderPreviews.delete(nameKey);
      const player = world.getAllPlayers().find(p => normalizeZonePlayerName(p.name) === nameKey);
      if (player) player.sendMessage("§b§l[§3Protección§b§l]§r §7La visualización de bordes ha finalizado.");
      continue;
    }

    const player = world.getAllPlayers().find(p => normalizeZonePlayerName(p.name) === nameKey);
    if (!player || player.dimension.id !== preview.dimensionId) continue;

    const zone = zones.find(z => String(z.id) === String(preview.zoneId));
    if (!zone) continue;

    const minX = Math.floor(Number(zone.min.x));
    const maxX = Math.floor(Number(zone.max.x));
    const minZ = Math.floor(Number(zone.min.z));
    const maxZ = Math.floor(Number(zone.max.z));
    const playerY = Math.floor(player.location.y);
    const dim = player.dimension;

    try {
      for (let x = minX; x <= maxX; x += 2) {
        if (Math.abs(x - player.location.x) <= 40) {
          dim.spawnParticle("minecraft:villager_happy", { x: x + 0.5, y: playerY + 0.3, z: minZ + 0.5 });
          dim.spawnParticle("minecraft:villager_happy", { x: x + 0.5, y: playerY + 0.3, z: maxZ + 0.5 });
        }
      }
      for (let z = minZ; z <= maxZ; z += 2) {
        if (Math.abs(z - player.location.z) <= 40) {
          dim.spawnParticle("minecraft:villager_happy", { x: minX + 0.5, y: playerY + 0.3, z: z + 0.5 });
          dim.spawnParticle("minecraft:villager_happy", { x: maxX + 0.5, y: playerY + 0.3, z: z + 0.5 });
        }
      }
    } catch (e) {}
  }
}, 10);

function isDoorOrGateBlock(block) {
  const id = String(block?.typeId || "").toLowerCase();
  return id.includes("door") || id.includes("trapdoor") || id.includes("fence_gate") || id.includes("gate");
}

function openZoneFlagsGUI(player, zone) {
  const isOwner = normalizeZonePlayerName(zone.owner) === normalizeZonePlayerName(player.name) || isPlayerOp(player);
  if (!isOwner) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cSolo el dueño del terreno puede cambiar sus banderas.");
    return;
  }

  const flags = zone.flags || {};
  const form = new ModalFormData()
    .title(\`§eBanderas: \${zone.name}\`)
    .toggle("§fPermitir monstruos hostiles (Mob Spawn)", flags.mob_spawn ?? false)
    .toggle("§fPermitir combate entre jugadores (PvP)", flags.pvp ?? false)
    .toggle("§fPermitir daño de explosiones a bloques", flags.explosions ?? false)
    .toggle("§fPermitir que visitantes usen puertas/portones", flags.visitor_doors ?? false);

  safeOpenForm(player, form, (response) => {
    if (response.canceled || !response.formValues) {
      openZoneDetail(player, zone);
      return;
    }

    const db = loadZonesForUpdate();
    const matchIdx = db.findIndex(z => String(z.id) === String(zone.id));
    if (matchIdx === -1) {
      player.sendMessage("§b§l[§3Protección§b§l]§r §cNo se encontró el terreno para actualizar.");
      return;
    }

    db[matchIdx].flags = {
      mob_spawn: Boolean(response.formValues[0]),
      pvp: Boolean(response.formValues[1]),
      explosions: Boolean(response.formValues[2]),
      visitor_doors: Boolean(response.formValues[3])
    };

    saveZones(db);
    player.sendMessage(\`§b§l[§3Protección§b§l]§r §a¡Banderas del terreno §e"\${zone.name}" §aactualizadas con éxito!\`);
    openZoneDetail(player, db[matchIdx]);
  });
}
`;

// Insert borderSystemCode right before handleSetPos
content = content.replace('// Guardar esquinas de selección\nfunction handleSetPos', borderSystemCode + '\n// Guardar esquinas de selección\nfunction handleSetPos');

// 2. Replace handleTrustCommand with generalized handleZoneCommand
const oldTrustRegex = /function\s+handleTrustCommand\s*\(player,\s*sub,\s*targetName\)\s*\{[\s\S]*?\n\}\s*\n\/\/ Eliminar protección admin/m;

const newZoneCommandCode = `function handleZoneCommand(player, sub, param) {
  const action = String(sub || "").toLowerCase();
  
  if (action === "bordes" || action === "borders" || action === "limites" || action === "particulas") {
    toggleZoneBorders(player);
    return;
  }

  if (action === "banderas" || action === "flags" || action === "config") {
    const zones = getZonesAt(player.location, player.dimension.id);
    const myZone = zones.find(z => !z.disabled && (normalizeZonePlayerName(z.owner) === normalizeZonePlayerName(player.name) || isPlayerOp(player)));
    if (!myZone) {
      player.sendMessage("§b§l[§3Protección§b§l]§r §cDebes estar dentro de tu terreno para configurar sus banderas.");
      return;
    }
    openZoneFlagsGUI(player, myZone);
    return;
  }

  if (action === "ayuda" || action === "help") {
    player.sendMessage("§a§l=== COMANDOS DE TERRENOS (/s:zona) ===");
    player.sendMessage("§b/s:zona bordes §7- Muestra/oculta los límites de tu terreno con partículas.");
    player.sendMessage("§b/s:zona banderas §7- Configura permisos especiales (PvP, explosiones, puertas).");
    player.sendMessage("§b/s:zona confiar <jugador> §7- Agrega a un amigo con permisos en tu terreno.");
    player.sendMessage("§b/s:zona desconfiar <jugador> §7- Quita los permisos a un amigo.");
    player.sendMessage("§b/s:zonas §7- Abre el menú visual de gestión de terrenos.");
    return;
  }

  let trustAction = action;
  if (trustAction === "confiar" || trustAction === "invitar" || trustAction === "amigo" || trustAction === "agregar") trustAction = "trust";
  if (trustAction === "desconfiar" || trustAction === "revocar" || trustAction === "quitar" || trustAction === "expulsar") trustAction = "untrust";

  if (!param || (trustAction !== "trust" && trustAction !== "untrust")) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cUso: /s:zona confiar <jugador>, /s:zona desconfiar <jugador>, /s:zona bordes o /s:zona banderas");
    return;
  }

  const loc = player.location;
  const dimId = player.dimension.id;
  const db = loadZonesForUpdate();

  const matchIdx = db.findIndex(z => isInside(loc, dimId, z));
  if (matchIdx === -1) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cDebes estar dentro de tu zona protegida.");
    return;
  }

  const zone = db[matchIdx];
  if (normalizeZonePlayerName(zone.owner) !== normalizeZonePlayerName(player.name) && !isPlayerOp(player)) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cNo eres el dueño de esta zona.");
    return;
  }

  if (trustAction === "trust") {
    if (!Array.isArray(zone.trusted)) zone.trusted = [];
    const canonicalTarget = canonicalPlayerName(param);
    if (zone.trusted.some((entry) => normalizeZonePlayerName(entry) === normalizeZonePlayerName(canonicalTarget))) {
      player.sendMessage(\`§b§l[§3Protección§b§l]§r §cEl jugador §e\${param} §cya tiene permisos.\`);
      return;
    }
    zone.trusted.push(canonicalTarget);
    player.sendMessage(\`§b§l[§3Protección§b§l]§r §a¡Le has otorgado permisos a §e\${canonicalTarget} §aen tu zona!\`);
  } else {
    if (!Array.isArray(zone.trusted)) zone.trusted = [];
    const idx = zone.trusted.findIndex((entry) => normalizeZonePlayerName(entry) === normalizeZonePlayerName(param));
    if (idx === -1) {
      player.sendMessage(\`§b§l[§3Protección§b§l]§r §cEl jugador §e\${param} §cno tiene permisos en tu zona.\`);
      return;
    }
    zone.trusted.splice(idx, 1);
    player.sendMessage(\`§b§l[§3Protección§b§l]§r §aLe has retirado los permisos a §e\${param} §aen tu zona.\`);
  }

  saveZones(db);
}

function handleTrustCommand(player, sub, targetName) {
  return handleZoneCommand(player, sub, targetName);
}

// Eliminar protección admin`;

content = content.replace(oldTrustRegex, newZoneCommandCode);

// 3. Update command registration for /s:zona
content = content.replace(
  /register\(\{\s*name:\s*`\$\{COMMAND_NAMESPACE\}:zona`[\s\S]*?mandatoryParameters:\s*\[[\s\S]*?\{ name: "jugador"[\s\S]*?\],[\s\S]*?\}, \(origin, subcomando, jugador\) => \{[\s\S]*?handleTrustCommand\(sender, String\(subcomando\)\.toLowerCase\(\), String\(jugador\)\);[\s\S]*?\}\);/m,
  `register({
        name: \`\${COMMAND_NAMESPACE}:zona\`,
        description: "Comandos de terreno: confiar, desconfiar, bordes, banderas",
        permissionLevel: CommandPermissionLevel.Any,
        mandatoryParameters: [
          { name: "subcomando", type: CustomCommandParamType.String },
        ],
        optionalParameters: [
          { name: "parametro", type: CustomCommandParamType.String },
        ],
      }, (origin, subcomando, parametro) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        system.run(() => handleZoneCommand(sender, String(subcomando).toLowerCase(), parametro !== undefined ? String(parametro) : ""));
        return commandOk("Procesando zona.");
      });`
);

// 4. Update openZoneDetail with Bordes and Banderas buttons
const oldDetailButtons = `  if (isOwner && !zone.isAdmin) {
    form.button("➕ Agregar amigo (Trust)");
    form.button("➖ Quitar amigo (Untrust)");
    form.button("❌ Eliminar Protección");
  }`;

const newDetailButtons = `  if (isOwner && !zone.isAdmin) {
    form.button("➕ Agregar amigo (Trust)");
    form.button("➖ Quitar amigo (Untrust)");
    form.button("✨ Ver / Ocultar Bordes");
    form.button("⚙️ Configurar Banderas (Flags)");
    form.button("❌ Eliminar Protección");
  }`;

const oldDetailHandler = `    if (isOwner && !zone.isAdmin) {
      if (idx === 0) {
        // Agregar amigo
        openAddFriendForm(player, zone);
      } else if (idx === 1) {
        // Quitar amigo
        openRemoveFriendForm(player, zone);
      } else if (idx === 2) {
        // Eliminar
        const db = loadZones();
        const cleanDb = db.filter(z => z.id !== zone.id);
        saveZones(cleanDb);
        player.sendMessage(\`§b§l[§3Protección§b§l]§r §aZona protegida §e"\${zone.name}" §aeliminada.\`);
      } else {
        openZonesGUI(player);
      }
    }`;

const newDetailHandler = `    if (isOwner && !zone.isAdmin) {
      if (idx === 0) {
        openAddFriendForm(player, zone);
      } else if (idx === 1) {
        openRemoveFriendForm(player, zone);
      } else if (idx === 2) {
        toggleZoneBorders(player, zone);
      } else if (idx === 3) {
        openZoneFlagsGUI(player, zone);
      } else if (idx === 4) {
        const db = loadZones();
        const cleanDb = db.filter(z => z.id !== zone.id);
        saveZones(cleanDb);
        player.sendMessage(\`§b§l[§3Protección§b§l]§r §aZona protegida §e"\${zone.name}" §aeliminada.\`);
      } else {
        openZonesGUI(player);
      }
    }`;

content = content.replace(oldDetailButtons, newDetailButtons);
content = content.replace(oldDetailHandler, newDetailHandler);

// 5. Update playerInteractWithBlock for visitor_doors flag
content = content.replace(
  'if (isProtectedBlockInteraction(block) && !checkPermission(player, loc, block.dimension.id, "interact")) {',
  `const currentZones = getZonesAt(loc, block.dimension.id);
      const allowDoor = isDoorOrGateBlock(block) && currentZones.some(z => z.flags?.visitor_doors === true);
      if (isProtectedBlockInteraction(block) && !allowDoor && !checkPermission(player, loc, block.dimension.id, "interact")) {`
);

// 6. Update explosion handler for explosions flag
content = content.replace(
  'const isProt = zones.some(z => isInside(loc, dimension.id, z));',
  'const isProt = zones.some(z => isInside(loc, dimension.id, z) && (z.isAdmin || z.flags?.explosions !== true));'
);

// 7. Update mob spawn for mob_spawn flag
content = content.replace(
  `            // Si la criatura spawnea dentro de una zona admin (que no sea coliseo ni comunitaria), la eliminamos al instante
            if (zones.some(z => z.isAdmin && !isColiseumZone(z) && !z.isCommunity && z.zoneType !== "community")) {
              entity.remove();
            }`,
  `            // Si la criatura spawnea dentro de una zona admin, o en una privada con mob_spawn false, la eliminamos
            if (zones.some(z => z.isAdmin && !isColiseumZone(z) && !z.isCommunity && z.zoneType !== "community")) {
              entity.remove();
            } else if (zones.some(z => !z.isAdmin && !isColiseumZone(z) && z.flags?.mob_spawn === false)) {
              entity.remove();
            }`
);

// 8. Update PvP damageEvent in claims
content = content.replace(
  `    if (inAdminZone) {
      // Si la víctima es un jugador o criatura aliada en zona admin, cancelamos TODO tipo de daño`,
  `    // Verificación de PvP en terrenos privados protegidos
    if (victim.typeId === "minecraft:player" && attacker && attacker.typeId === "minecraft:player") {
      const victimZones = getZonesAt(victim.location, victim.dimension.id);
      const claimZone = victimZones.find(z => !z.isAdmin && !isColiseumZone(z));
      if (claimZone && claimZone.flags?.pvp !== true) {
        event.cancel = true;
        maybeWarnProtection(attacker, "§b§l[§3Protección§b§l]§r §cEl PvP está desactivado en este terreno protegido.");
        return;
      }
    }

    if (inAdminZone) {
      // Si la víctima es un jugador o criatura aliada en zona admin, cancelamos TODO tipo de daño`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Successfully patched protection_addon');
