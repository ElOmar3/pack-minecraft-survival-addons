const fs = require('fs');

const filePath = 'behavior_packs/quests_addon/scripts/main.js';
let content = fs.readFileSync(filePath, 'utf8');

const communityLogic = `
// ============================================================================
// METAS COMUNITARIAS DEL SERVIDOR (FASE 2)
// ============================================================================
const COMMUNITY_QUEST_TARGET = 30;

function advanceCommunityQuests() {
  let current = Number(globalThis.__sqlite_get_prop_v2__("quests_addon", "world", "community_quest_count") || 0) + 1;
  
  if (current >= COMMUNITY_QUEST_TARGET) {
    globalThis.__sqlite_set_prop_v2__("quests_addon", "world", "community_quest_count", 0);
    const endTime = Date.now() + 30 * 60 * 1000;
    globalThis.__sqlite_set_prop_v2__("server_boosters_addon", "world", "booster_jobs_active", 1);
    globalThis.__sqlite_set_prop_v2__("server_boosters_addon", "world", "booster_jobs_endTime", endTime);
    globalThis.__sqlite_set_prop_v2__("server_boosters_addon", "world", "booster_jobs_buyer", "Comunidad");
    
    world.sendMessage("§6§l========================================");
    world.sendMessage("§6  ¡META COMUNITARIA DEL SERVIDOR ALCANZADA!");
    world.sendMessage(\`§e  ¡Los jugadores completaron \${COMMUNITY_QUEST_TARGET} misiones secundarias!\`);
    world.sendMessage("§a  ⚡ ¡POTENCIADOR GLOBAL DE EMPLEOS ACTIVADO (30 MIN)!");
    world.sendMessage("§6§l========================================");
    for (const p of world.getAllPlayers()) {
      try { p.playSound("random.levelup", { pitch: 1.0 }); } catch (e) {}
      try {
        p.onScreenDisplay?.setTitle("§6§l¡META COMUNITARIA!");
        p.onScreenDisplay?.setSubtitle("§aPotenciador Global de Empleos Activado (30m)");
      } catch (e) {}
    }
  } else {
    globalThis.__sqlite_set_prop_v2__("quests_addon", "world", "community_quest_count", current);
  }
}
`;

content = content.replace('// === FIN PERSISTENCIA SQLITE PUENTE V3 ===', '// === FIN PERSISTENCIA SQLITE PUENTE V3 ===\n' + communityLogic);

// Call advanceCommunityQuests when a quest is completed
content = content.replace(
  'for (const quest of newlyCompleted) {',
  `for (const quest of newlyCompleted) {
      advanceCommunityQuests();`
);

// Show community progress in menu
content = content.replace(
  '.body(`Progreso General: §e${completedCount} / ${QUESTS.length} completadas§r\\n\\n${categoriesText}`)',
  `const comProgress = Number(globalThis.__sqlite_get_prop_v2__("quests_addon", "world", "community_quest_count") || 0);
    form.body(\`Progreso Personal: §e\${completedCount} / \${QUESTS.length} completadas§r\\n§6Meta Comunitaria: §e\${comProgress}/\${COMMUNITY_QUEST_TARGET} misiones §7(Desbloquea Potenciador Global)\\n\\n\${categoriesText}\`)`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Successfully patched quests_addon');
