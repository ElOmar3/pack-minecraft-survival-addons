const fs = require('fs');

const filePath = 'behavior_packs/newbie_addon/scripts/main.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add PvP immunity and tutorial logic to newbie_addon
const newbieFeaturesCode = `
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
    player.sendMessage(\`§b§l[Novato] §7Te quedan §a\${remainingMinutes} minutos §7de protección PvP de novato.\`);
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
            attacker.sendMessage(\`§b§l[Novato] §7\${victim.name} tiene protección PvP de novato activa.\`);
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
`;

content = content.replace('// === FIN PERSISTENCIA SQLITE PUENTE V3 ===', '// === FIN PERSISTENCIA SQLITE PUENTE V3 ===\n' + newbieFeaturesCode);

// 2. Enhance world.afterEvents.playerSpawn tutorial and grant immunity
const oldPlayerSpawn = `world.afterEvents.playerSpawn.subscribe((event) => {
  const player = event.player;
  if (!player || !event.initialSpawn) return;

  const alreadyWelcomed = globalThis.__sqlite_get_prop_v2__("newbie_addon", player, WELCOME_SEEN_KEY) === true ||
    globalThis.__sqlite_get_prop_v2__("newbie_addon", player, LEGACY_FIRST_JOIN_KEY) !== undefined;
  if (alreadyWelcomed) return;

  globalThis.__sqlite_set_prop_v2__("newbie_addon", player, WELCOME_SEEN_KEY, true);
  system.runTimeout(() => {
    player.sendMessage("§a§l=================================");
    player.sendMessage("§a  ¡Bienvenido a Pacífico Comunitario!");
    player.sendMessage("§e  Usa §b/s:rtp §epara encontrar una zona segura donde comenzar.");
    player.sendMessage("§7  Protege tu base con §b/s:pos1§7, §b/s:pos2 §7y §b/s:proteger <nombre>§7.");
    player.sendMessage("§7  Consulta precios y servicios con §b/s:guias§7.");
    player.sendMessage("§7  Lee las normas con §b/s:reglas§7 y respeta a la comunidad.");
    player.sendMessage("§a§l=================================");
  }, 40);
});`;

const newPlayerSpawn = `world.afterEvents.playerSpawn.subscribe((event) => {
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
});`;

content = content.replace(oldPlayerSpawn, newPlayerSpawn);

// 3. Register /s:pvp command in startup
const registerPvpCode = `
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
`;

content = content.replace('try {\n    register({\n      name: "s:rtp",', 'try {\n' + registerPvpCode + '    register({\n      name: "s:rtp",');

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Successfully patched newbie_addon');
