const fs = require('fs');

const filePath = 'behavior_packs/horde_event_addon/scripts/main.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add liveHordeKills tracking
const killTrackingCode = `
// ============================================================================
// ESCALADO DINÁMICO, MINI-JEFES Y TABLA DE POSICIONES (FASE 2)
// ============================================================================
const liveHordeKills = new Map(); // playerName -> killCount
`;

content = content.replace('const APOCALYPSE_WAVE_SIZES = Object.freeze([12, 18, 24, 30, 40]);', killTrackingCode + '\nconst APOCALYPSE_WAVE_SIZES = Object.freeze([12, 18, 24, 30, 40]);');

// 2. Track kills in payApocalypseKillReward
content = content.replace(
  'player.onScreenDisplay.setActionBar(`§a+$${APOCALYPSE_KILL_REWARD} §7por zombi del apocalipsis`);',
  `liveHordeKills.set(player.name, (liveHordeKills.get(player.name) || 0) + 1);
    const kCount = liveHordeKills.get(player.name);
    player.onScreenDisplay.setActionBar(\`§a+$\${APOCALYPSE_KILL_REWARD} §7por zombi §8| §c⚔ \${kCount} bajas\`);`
);

// 3. Clear kills when starting apocalypse
content = content.replace(
  'function startZombieApocalypse() {',
  `function startZombieApocalypse() {
  liveHordeKills.clear();`
);

// 4. Dynamic scaling and mini-bosses in spawnApocalypseWave
const oldWaveSpawn = `  activeApocalypse.waitingForLoadedSpawn = false;
  const count = APOCALYPSE_WAVE_SIZES[waveNum - 1];
  world.sendMessage(\`\${PREFIX} §2§lAPOCALIPSIS ZOMBIE§r §7— Ola §e\${waveNum}/\${APOCALYPSE_WAVE_SIZES.length} §7: §c\${count} zombis de netherita se acercan.\`);
  let spawned = 0;`;

const newWaveSpawn = `  activeApocalypse.waitingForLoadedSpawn = false;
  const onlineCount = world.getAllPlayers().length;
  const scaleMultiplier = Math.max(1, Math.min(2.5, 1 + (onlineCount - 1) * 0.12));
  const baseCount = APOCALYPSE_WAVE_SIZES[waveNum - 1];
  const count = Math.floor(baseCount * scaleMultiplier);

  world.sendMessage(\`\${PREFIX} §2§lAPOCALIPSIS ZOMBIE§r §7— Ola §e\${waveNum}/\${APOCALYPSE_WAVE_SIZES.length} §7: §c\${count} zombis se acercan (Escalado x\${scaleMultiplier.toFixed(2)} por \${onlineCount} jugadores).\`);
  let spawned = 0;

  // Mini-jefe en Ola 3 y Ola 5
  if (waveNum === 3 || waveNum === 5) {
    try {
      const bossPos = getSpawnCandidate(info.dimension, { x: info.location.x + 5, y: info.location.y, z: info.location.z + 5 }, info.location);
      if (bossPos) {
        const boss = info.dimension.spawnEntity("minecraft:zombie", bossPos);
        boss.addTag(APOCALYPSE_MOB_TAG);
        if (waveNum === 3) {
          boss.nameTag = "§6§lTitán Zombi §c[Mini-Jefe]";
          boss.addEffect("health_boost", 20 * 60 * 30, { amplifier: 8 });
          boss.addEffect("strength", 20 * 60 * 30, { amplifier: 1 });
          boss.addEffect("resistance", 20 * 60 * 30, { amplifier: 2 });
        } else {
          boss.nameTag = "§4§lSeñor del Apocalipsis §c[JEFE FINAL]";
          boss.addEffect("health_boost", 20 * 60 * 30, { amplifier: 14 });
          boss.addEffect("strength", 20 * 60 * 30, { amplifier: 2 });
          boss.addEffect("speed", 20 * 60 * 30, { amplifier: 1 });
          boss.addEffect("resistance", 20 * 60 * 30, { amplifier: 2 });
        }
        equipApocalypseZombie(boss);
        world.sendMessage(\`\${PREFIX} §c§l¡ALERTA! Ha aparecido: \${boss.nameTag}§c!\`);
      }
    } catch (e) {}
  }`;

content = content.replace(oldWaveSpawn, newWaveSpawn);

// 5. Broadcast kill leaderboard on endZombieApocalypse
const oldEndApocalypse = `function endZombieApocalypse() {
  activeApocalypse.active = false;
  activeApocalypse.wave = 0;
  activeApocalypse.waitingForLoadedSpawn = false;
  world.sendMessage(\`\${PREFIX} §a§l¡Apocalipsis zombie superado!§r §7Los supervivientes han detenido las cinco oleadas.\`);
}`;

const newEndApocalypse = `function endZombieApocalypse() {
  activeApocalypse.active = false;
  activeApocalypse.wave = 0;
  activeApocalypse.waitingForLoadedSpawn = false;
  world.sendMessage(\`\${PREFIX} §a§l¡Apocalipsis zombie superado!§r §7Los supervivientes han detenido todas las oleadas.\`);

  if (liveHordeKills.size > 0) {
    const sorted = Array.from(liveHordeKills.entries()).sort((a, b) => b[1] - a[1]);
    const bonuses = [1500, 800, 400];
    const medals = ["🥇", "🥈", "🥉"];

    world.sendMessage("§6§l========================================");
    world.sendMessage("§6  🏆 TABLA DE DEFENSORAS DEL APOCALIPSIS 🏆");
    sorted.slice(0, 3).forEach(([name, kills], idx) => {
      const bonus = bonuses[idx] || 200;
      const p = world.getAllPlayers().find(player => player.name === name);
      if (p) {
        try {
          const obj = world.scoreboard.getObjective(MONEY_OBJECTIVE);
          if (obj) obj.setScore(p, (obj.getScore(p) || 0) + bonus);
        } catch (e) {}
      }
      world.sendMessage(\`§e  \${medals[idx]} \${name} §7— §c\${kills} bajas §7(+§a$\${bonus}§7)\`);
    });
    world.sendMessage("§6§l========================================");
  }
}`;

content = content.replace(oldEndApocalypse, newEndApocalypse);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Successfully patched horde_event_addon');
