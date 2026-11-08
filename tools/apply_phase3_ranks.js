const fs = require('fs');

const filePath = 'behavior_packs/ranks_addon/scripts/main.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add survival ranks ladder and openRankupMenu
const rankupCode = `
// ============================================================================
// ESCALAFÓN DE RANGOS DE SUPERVIVENCIA (/s:rankup) (FASE 3)
// ============================================================================
const SURVIVAL_RANKS = Object.freeze([
  { id: "recluta", name: "Recluta", prefix: "§7[Recluta]", cost: 0, hoursRequired: 0 },
  { id: "explorador", name: "Explorador", prefix: "§a[Explorador]", cost: 5000, hoursRequired: 2 },
  { id: "veterano", name: "Veterano", prefix: "§b[Veterano]", cost: 25000, hoursRequired: 10 },
  { id: "heroe", name: "Héroe", prefix: "§d[Héroe]", cost: 75000, hoursRequired: 24 },
  { id: "leyenda", name: "Leyenda", prefix: "§6§l[Leyenda]", cost: 200000, hoursRequired: 50 }
]);

function getPlayerSurvivalRank(player) {
  return String(globalThis.__sqlite_get_prop_v2__("ranks_addon", player, "player_survival_rank") || "recluta");
}

function getPlayerPlaytimeHours(player) {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("rewards_addon", player, "playtime_state_v1");
    if (raw) {
      const parsed = JSON.parse(String(raw));
      return Math.floor((Number(parsed.totalSeconds) || 0) / 3600);
    }
  } catch {}
  return 0;
}

function openRankupMenu(player) {
  const currentRankId = getPlayerSurvivalRank(player);
  const currentIdx = SURVIVAL_RANKS.findIndex(r => r.id === currentRankId);
  const currentRank = SURVIVAL_RANKS[currentIdx >= 0 ? currentIdx : 0];
  const nextRank = SURVIVAL_RANKS[(currentIdx >= 0 ? currentIdx : 0) + 1];

  const balance = getBalance(player);
  const hoursPlayed = getPlayerPlaytimeHours(player);

  if (!nextRank) {
    const formMax = new ActionFormData()
      .title("§6§lRango Máximo Alcanzado")
      .body(\`§fTu rango actual: \${currentRank.prefix}\\n\\n§a¡Felicidades! Has alcanzado el rango más alto de supervivencia del servidor.\`)
      .button("Entendido");
    safeOpenForm(player, formMax, () => {});
    return;
  }

  const canAfford = balance >= nextRank.cost;
  const hasHours = hoursPlayed >= nextRank.hoursRequired;
  const canRankup = canAfford && hasHours;

  const form = new ActionFormData()
    .title("§e§lAscenso de Rango (/s:rankup)")
    .body(\`§7Rango actual: \${currentRank.prefix}\\n\` +
          \`§7Siguiente rango: \${nextRank.prefix}\\n\\n\` +
          \`§eRequisitos para ascender:\\n\` +
          \`§7- Dinero requerido: \${canAfford ? "§a" : "§c"}$\${nextRank.cost} §7(Tu saldo: $\${balance})\\n\` +
          \`§7- Horas jugadas: \${hasHours ? "§a" : "§c"}\${hoursPlayed}/\${nextRank.hoursRequired} horas\\n\\n\` +
          \`\${canRankup ? "§a¡Cumples todos los requisitos para ascender!" : "§cTe faltan requisitos para este ascenso."}\`)
    .button(canRankup ? "⭐ ¡Ascender de Rango ahora!" : "🔒 Requisitos pendientes")
    .button("🔙 Volver");

  safeOpenForm(player, form, (response) => {
    if (response.selection === 0 && canRankup) {
      if (rankPurchaseLocks.has(player.name.toLowerCase())) return;
      rankPurchaseLocks.add(player.name.toLowerCase());
      try {
        const curBal = getBalance(player);
        if (curBal < nextRank.cost) {
          player.sendMessage("§b§l[§3Rangos§b§l]§r §cSaldo insuficiente al momento del ascenso.");
          return;
        }
        if (!setBalance(player, curBal - nextRank.cost, \`rankup_\${nextRank.id}\`)) {
          player.sendMessage("§b§l[§3Rangos§b§l]§r §cNo se pudo descontar el costo del rango.");
          return;
        }
        globalThis.__sqlite_set_prop_v2__("ranks_addon", player, "player_survival_rank", nextRank.id);
        world.sendMessage(\`§6§l[RANGOS] §a¡El jugador §e\${player.name} §aha ascendido al rango \${nextRank.prefix}§a!\`);
        try { player.playSound("random.levelup", { pitch: 1.0 }); } catch (e) {}
        try { player.playSound("random.toast", { pitch: 1.2 }); } catch (e) {}
      } finally {
        rankPurchaseLocks.delete(player.name.toLowerCase());
      }
    }
  });
}
`;

content = content.replace('// === FIN PERSISTENCIA SQLITE PUENTE V3 ===', '// === FIN PERSISTENCIA SQLITE PUENTE V3 ===\n' + rankupCode);

// 2. Register commands /s:rankup, /s:rango, /s:ascender
const registerCommands = `      for (const name of ["rankup", "rango", "ascender"]) {
        register({ name: \`\${COMMAND_NAMESPACE}:\${name}\`, description: "Abre el menú de ascenso de rango", permissionLevel: CommandPermissionLevel.Any }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          system.run(() => openRankupMenu(sender));
          return commandOk(\`Abriendo \${name}.\`);
        });
      }
`;

content = content.replace('for (const name of ["titulos", "titles"]) {', registerCommands + '      for (const name of ["titulos", "titles"]) {');

// 3. Include survivalRankPrefix in chat formatting
const oldChatPrefixes = `          const specialLabelPrefix = getSpecialLabelPrefix(sender);
          let titlePrefix = "";`;

const newChatPrefixes = `          const specialLabelPrefix = getSpecialLabelPrefix(sender);
          const survRankId = getPlayerSurvivalRank(sender);
          const survRank = SURVIVAL_RANKS.find(r => r.id === survRankId) || SURVIVAL_RANKS[0];
          const survRankPrefix = survRank.prefix ? \`\${survRank.prefix} \` : "";
          let titlePrefix = "";`;

content = content.replace(oldChatPrefixes, newChatPrefixes);

content = content.replace(
  'const formattedMessage = `${rolePrefix}${specialLabelPrefix}${badgePrefix}${titlePrefix}${clanPrefix}§7${sender.name}§r: ${message}`;',
  'const formattedMessage = `${rolePrefix}${specialLabelPrefix}${survRankPrefix}${badgePrefix}${titlePrefix}${clanPrefix}§7${sender.name}§r: ${message}`;'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Successfully patched ranks_addon');
