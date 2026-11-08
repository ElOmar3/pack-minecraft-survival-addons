const fs = require('fs');

const filePath = 'behavior_packs/core_commands_addon/scripts/main.js';
let content = fs.readFileSync(filePath, 'utf8');

// Fix accidental /s:vetarco to /s:banco
content = content.replace('/s:vetarco', '/s:banco');

// Add rankup to ALL_COMMANDS
if (!content.includes('s:rankup')) {
  content = content.replace(
    '{ name: "/s:titulos", desc: "Tienda y gestor de títulos cosméticos", cmd: "s:titulos", cat: "Economía" },',
    `{ name: "/s:titulos", desc: "Tienda y gestor de títulos cosméticos", cmd: "s:titulos", cat: "Economía" },
  { name: "/s:rankup", desc: "Asciende en el escalafón de supervivencia con tiempo y dinero", cmd: "s:rankup", cat: "Economía" },`
  );
}

// Add rankup button to openEconomiaMenu
const oldEconButtons = `    .button("🏷️ §aTítulos Cosméticos (/s:titulos)")
    .button("🎰 §cCasino / Apuestas (/s:casino)")
    .button("❌ §8Cerrar Menú");`;

const newEconButtons = `    .button("🏷️ §aTítulos Cosméticos (/s:titulos)")
    .button("⭐ §6Ascenso de Rango (/s:rankup)")
    .button("🎰 §cCasino / Apuestas (/s:casino)")
    .button("❌ §8Cerrar Menú");`;

content = content.replace(oldEconButtons, newEconButtons);

const oldEconLogic = `    else if (idx === 9) runCommandSafe(player, "s:titulos");
    else if (idx === 10) runCommandSafe(player, "s:casino");`;

const newEconLogic = `    else if (idx === 9) runCommandSafe(player, "s:titulos");
    else if (idx === 10) runCommandSafe(player, "s:rankup");
    else if (idx === 11) runCommandSafe(player, "s:casino");`;

content = content.replace(oldEconLogic, newEconLogic);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Successfully updated core_commands_addon');
