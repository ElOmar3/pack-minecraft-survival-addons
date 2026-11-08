const fs = require('fs');

const filePath = 'behavior_packs/jobs_addon/scripts/main.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add ItemStack import if not already there
if (!content.includes('ItemStack')) {
  content = content.replace('import { CommandPermissionLevel,', 'import { ItemStack, CommandPermissionLevel,');
}

// 2. Add Passive Skills code
const passiveSkillsCode = `
// ============================================================================
// HABILIDADES PASIVAS EN EL MUNDO Y CUOTAS DIARIAS (FASE 2)
// ============================================================================
const LOG_BLOCK_IDS = new Set([
  "minecraft:oak_log", "minecraft:spruce_log", "minecraft:birch_log", "minecraft:jungle_log",
  "minecraft:acacia_log", "minecraft:dark_oak_log", "minecraft:mangrove_log", "minecraft:cherry_log",
  "minecraft:crimson_stem", "minecraft:warped_stem"
]);

const ORE_BLOCK_IDS = new Set([
  "minecraft:coal_ore", "minecraft:deepslate_coal_ore",
  "minecraft:iron_ore", "minecraft:deepslate_iron_ore",
  "minecraft:copper_ore", "minecraft:deepslate_copper_ore",
  "minecraft:gold_ore", "minecraft:deepslate_gold_ore",
  "minecraft:redstone_ore", "minecraft:deepslate_redstone_ore",
  "minecraft:lapis_ore", "minecraft:deepslate_lapis_ore",
  "minecraft:diamond_ore", "minecraft:deepslate_diamond_ore",
  "minecraft:emerald_ore", "minecraft:deepslate_emerald_ore",
  "minecraft:nether_quartz_ore", "minecraft:nether_gold_ore"
]);

const CROP_TYPE_MAP = new Map([
  ["minecraft:wheat", { crop: "minecraft:wheat" }],
  ["minecraft:carrots", { crop: "minecraft:carrots" }],
  ["minecraft:potatoes", { crop: "minecraft:potatoes" }],
  ["minecraft:beetroot", { crop: "minecraft:beetroot" }]
]);

try {
  world.beforeEvents.playerBreakBlock.subscribe((event) => {
    const player = event.player;
    if (!player || !player.isValid) return;

    const block = event.block;
    const typeId = block.typeId;
    const activeJob = getActiveJob(player);
    if (!activeJob) return;

    // A) HABILIDAD DE MINERO: 25% de probabilidad de mineral extra
    if (activeJob.id === "miner" && ORE_BLOCK_IDS.has(typeId)) {
      if (Math.random() < 0.25) {
        system.run(() => {
          try {
            if (!player.isValid) return;
            const dropLoc = { x: block.x + 0.5, y: block.y + 0.5, z: block.z + 0.5 };
            let rawItem = "minecraft:raw_iron";
            if (typeId.includes("coal")) rawItem = "minecraft:coal";
            else if (typeId.includes("iron")) rawItem = "minecraft:raw_iron";
            else if (typeId.includes("copper")) rawItem = "minecraft:raw_copper";
            else if (typeId.includes("gold")) rawItem = "minecraft:raw_gold";
            else if (typeId.includes("diamond")) rawItem = "minecraft:diamond";
            else if (typeId.includes("emerald")) rawItem = "minecraft:emerald";
            else if (typeId.includes("lapis")) rawItem = "minecraft:lapis_lazuli";
            else if (typeId.includes("redstone")) rawItem = "minecraft:redstone";
            else if (typeId.includes("quartz")) rawItem = "minecraft:quartz";

            player.dimension.spawnItem(new ItemStack(rawItem, 1), dropLoc);
            player.onScreenDisplay?.setActionBar("§6⛏ [Minero] ¡Veta abundante! (+1 mineral extra)");
            try { player.playSound("random.orb", { pitch: 1.6, volume: 0.8 }); } catch (e) {}
          } catch (e) {}
        });
      }
    }

    // B) HABILIDAD DE LEÑADOR: Treecapitator (talar tronco derriba los troncos superiores)
    if (activeJob.id === "lumberjack" && LOG_BLOCK_IDS.has(typeId)) {
      const equippable = player.getComponent("minecraft:equippable");
      const mainHand = equippable?.getEquipment("Mainhand");
      const isAxe = String(mainHand?.typeId || "").includes("axe");

      if (isAxe) {
        const dim = player.dimension;
        const startX = block.x;
        const startY = block.y;
        const startZ = block.z;

        system.run(() => {
          try {
            let chopped = 0;
            for (let dy = 1; dy <= 16; dy++) {
              const upperBlock = dim.getBlock({ x: startX, y: startY + dy, z: startZ });
              if (upperBlock && LOG_BLOCK_IDS.has(upperBlock.typeId)) {
                const logType = upperBlock.typeId;
                upperBlock.setType("minecraft:air");
                dim.spawnItem(new ItemStack(logType, 1), { x: startX + 0.5, y: startY + 0.5, z: startZ + 0.5 });
                chopped++;
              } else {
                break;
              }
            }
            if (chopped > 0) {
              player.onScreenDisplay?.setActionBar(\`§a🪓 [Leñador] ¡Tala rápida! (\${chopped + 1} troncos talados)\`);
              try { player.playSound("dig.wood", { pitch: 0.9, volume: 1.0 }); } catch (e) {}
            }
          } catch (e) {}
        });
      }
    }

    // C) HABILIDAD DE GRANJERO: Auto-replantado de cultivos
    if (activeJob.id === "farmer" && CROP_TYPE_MAP.has(typeId)) {
      const cropInfo = CROP_TYPE_MAP.get(typeId);
      const dim = player.dimension;
      const cropLoc = { x: block.x, y: block.y, z: block.z };

      system.runTimeout(() => {
        try {
          const floorBlock = dim.getBlock({ x: cropLoc.x, y: cropLoc.y - 1, z: cropLoc.z });
          const currentBlock = dim.getBlock(cropLoc);
          if (floorBlock?.typeId === "minecraft:farmland" && currentBlock?.isAir) {
            currentBlock.setType(cropInfo.crop);
            player.onScreenDisplay?.setActionBar("§a🌱 [Granjero] ¡Cultivo auto-replantado!");
            try { player.playSound("item.crop.plant", { pitch: 1.2, volume: 0.8 }); } catch (e) {}
          }
        } catch (e) {}
      }, 2);
    }
  });
} catch (e) {
  ErrorReporter.report(e, { addonId: "jobs_addon", moduleId: "main.js", operation: "passiveSkills", category: "runtime" });
}
`;

content = content.replace('// === FIN PERSISTENCIA SQLITE PUENTE V3 ===', '// === FIN PERSISTENCIA SQLITE PUENTE V3 ===\n' + passiveSkillsCode);

// 3. Enhance delivery completion for daily quota bonus
const oldDeliveryComplete = `    stats.totalDeliveries = (stats.totalDeliveries || 0) + 1;
    stats.streak = (stats.streak || 0) + 1;
    stats.lastDeliveryAt = now;
    stats.deliveriesByJob = stats.deliveriesByJob || {};
    stats.deliveriesByJob[job.id] = (stats.deliveriesByJob[job.id] || 0) + 1;`;

const newDeliveryComplete = `    const currentDay = Math.floor(now / 86400000);
    const lastDay = Math.floor((stats.lastDeliveryAt || 0) / 86400000);
    if (currentDay !== lastDay) {
      stats.dailyQuota = 0;
    }
    stats.dailyQuota = (stats.dailyQuota || 0) + 1;
    stats.totalDeliveries = (stats.totalDeliveries || 0) + 1;
    stats.streak = (stats.streak || 0) + 1;
    stats.lastDeliveryAt = now;
    stats.deliveriesByJob = stats.deliveriesByJob || {};
    stats.deliveriesByJob[job.id] = (stats.deliveriesByJob[job.id] || 0) + 1;

    // Bono especial de cuota diaria al completar 3 entregas
    if (stats.dailyQuota === 3) {
      const bonusReward = 1000;
      addBalance(player, bonusReward);
      world.sendMessage(\`§6§l[EMPLEOS] §a¡El jugador §e\${player.name} §acompletó su cuota diaria (3 entregas) y recibió un bono de §6$\${bonusReward}§a!\`);
      try { player.playSound("random.levelup", { pitch: 1.2 }); } catch (e) {}
    }`;

content = content.replace(oldDeliveryComplete, newDeliveryComplete);

// 4. Update job details GUI to show daily quota progress
content = content.replace(
  'const bodyLines = [',
  `const currentQuotaDay = Math.floor(Date.now() / 86400000);
    const lastQuotaDay = Math.floor((stats.lastDeliveryAt || 0) / 86400000);
    const todayQuota = currentQuotaDay === lastQuotaDay ? (stats.dailyQuota || 0) : 0;
    const bodyLines = [`
);

content = content.replace(
  '`§7Entregas totales: §f${stats.totalDeliveries || 0}`,',
  '`§7Entregas totales: §f${stats.totalDeliveries || 0}`,\n      `§7Cuota diaria: §e${todayQuota}/3 entregas §7(Bono: §a+$1,000§7)`,'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Successfully patched jobs_addon');
