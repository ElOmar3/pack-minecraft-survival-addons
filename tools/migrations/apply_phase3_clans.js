const fs = require('fs');

const filePath = 'behavior_packs/clans_addon/scripts/main.js';
let content = fs.readFileSync(filePath, 'utf8');

const clanLevelsCode = `
// ============================================================================
// SISTEMA DE NIVELES Y MEJORAS DE CLAN (FASE 3)
// ============================================================================
const CLAN_LEVEL_CONFIG = Object.freeze({
  1: { cost: 0, maxMembers: 8, label: "§7Nivel 1 (Incipiente)", perk: "Capacidad máxima: 8 miembros" },
  2: { cost: 25000, maxMembers: 12, label: "§aNivel 2 (Establecido)", perk: "Capacidad máxima: 12 miembros" },
  3: { cost: 75000, maxMembers: 16, label: "§bNivel 3 (Poderoso)", perk: "Capacidad: 16 miembros + Aura de velocidad entre aliados" },
  4: { cost: 150000, maxMembers: 20, label: "§dNivel 4 (Legendario)", perk: "Capacidad: 20 miembros + Bono de experiencia" },
  5: { cost: 300000, maxMembers: 25, label: "§6§l★ Nivel 5 (IMPERIAL) ★", perk: "Capacidad: 25 miembros + Distintivo dorado imperial" }
});

function getClanLevel(clan) {
  return Math.max(1, Math.min(5, Number(clan?.level || 1)));
}

function handleClanUpgrade(player, clan, clanKey) {
  if (clan.leader.toLowerCase() !== player.name.toLowerCase()) {
    player.sendMessage("§b§l[§3Clanes§b§l]§r §cSolo el líder del clan puede mejorar el nivel del clan.");
    return;
  }

  const currentLevel = getClanLevel(clan);
  if (currentLevel >= 5) {
    player.sendMessage("§b§l[§3Clanes§b§l]§r §6¡Tu clan ya ha alcanzado el nivel máximo (Nivel 5 Imperial)!");
    return;
  }

  const nextLevel = currentLevel + 1;
  const config = CLAN_LEVEL_CONFIG[nextLevel];

  if ((clan.balance || 0) < config.cost) {
    player.sendMessage(\`§b§l[§3Clanes§b§l]§r §cEl banco del clan no tiene fondos suficientes para subir a \${config.label}§c. Requiere: §a$\${config.cost} §c(Fondos actuales: §e$\${clan.balance || 0}§c).\`);
    return;
  }

  const db = loadClansData();
  if (!db[clanKey]) return;

  db[clanKey].balance -= config.cost;
  db[clanKey].level = nextLevel;
  saveClansData(db);

  world.sendMessage(\`§b§l[§3Clanes§b§l]§r §6¡El clan §e\${clan.name} §6ha ascendido a \${config.label}§6! Ventaja: §a\${config.perk}\`);
  try { player.playSound("random.levelup", { pitch: 1.1 }); } catch (e) {}
}

function showClanLevelInfo(player, clan) {
  const currentLevel = getClanLevel(clan);
  const currentConfig = CLAN_LEVEL_CONFIG[currentLevel];
  const nextConfig = CLAN_LEVEL_CONFIG[currentLevel + 1];

  player.sendMessage("§6§l=== PROGRESIÓN DEL CLAN ===");
  player.sendMessage(\`§7Nivel actual: \${currentConfig.label}\`);
  player.sendMessage(\`§7Ventaja activa: §a\${currentConfig.perk}\`);
  player.sendMessage(\`§7Fondos en el banco: §e$\${clan.balance || 0}\`);
  if (nextConfig) {
    player.sendMessage(\`§7Siguiente nivel: \${nextConfig.label}\`);
    player.sendMessage(\`§7Costo de mejora: §a$\${nextConfig.cost} §7(del banco del clan)\`);
    player.sendMessage("§eUsa §b/s:clan mejorar §epara subir de nivel cuando tengas los fondos.");
  } else {
    player.sendMessage("§6¡Tu clan ha alcanzado el máximo nivel posible!");
  }
}
`;

content = content.replace('// === FIN PERSISTENCIA SQLITE PUENTE V3 ===', '// === FIN PERSISTENCIA SQLITE PUENTE V3 ===\n' + clanLevelsCode);

// Add subcommands "nivel" / "level" and "mejorar" / "upgrade" to handleClanCommand
const oldSubcommands = `  if (sub === 'withdraw') sub = "retirar";
  if (sub === 'quest') sub = "mision";
  if (sub === 'bounty') sub = "caza";`;

const newSubcommands = `  if (sub === 'withdraw') sub = "retirar";
  if (sub === 'quest') sub = "mision";
  if (sub === 'bounty') sub = "caza";
  if (sub === 'level') sub = "nivel";
  if (sub === 'upgrade') sub = "mejorar";`;

content = content.replace(oldSubcommands, newSubcommands);

// Add sub handler in handleClanCommand
const subHandlerCode = `
  if (sub === "nivel") {
    if (!playerClanKey || !db[playerClanKey]) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cNo perteneces a ningún clan.");
      return;
    }
    showClanLevelInfo(player, db[playerClanKey]);
    return;
  }

  if (sub === "mejorar") {
    if (!playerClanKey || !db[playerClanKey]) {
      player.sendMessage("§b§l[§3Clanes§b§l]§r §cNo perteneces a ningún clan.");
      return;
    }
    handleClanUpgrade(player, db[playerClanKey], playerClanKey);
    return;
  }
`;

content = content.replace('if (sub === "ayuda") {', subHandlerCode + '\n  if (sub === "ayuda") {');

// Update ayuda text with /s:clan nivel y /s:clan mejorar
content = content.replace(
  'player.sendMessage("§7/s:clan mision §8- Muestra la misión cooperativa activa.");',
  `player.sendMessage("§7/s:clan mision §8- Muestra la misión cooperativa activa.");
    player.sendMessage("§7/s:clan nivel §8- Consulta el nivel y ventajas de tu clan.");
    player.sendMessage("§7/s:clan mejorar §8- Sube de nivel tu clan con dinero del banco.");`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Successfully patched clans_addon');
