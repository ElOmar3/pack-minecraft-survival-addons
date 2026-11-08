const fs = require('fs');

const filePath = 'behavior_packs/rewards_addon/scripts/main.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add addPlayerMoney helper if not there
const addMoneyCode = `
function addPlayerMoney(player, amount) {
  const obj = getMoneyObjective();
  if (!obj) return false;
  const current = getBalance(player);
  return setBalanceExact(obj, player, Math.min(2147483647, current + amount));
}
`;

content = content.replace('function setBalanceExact(obj, player, value) {', addMoneyCode + '\nfunction setBalanceExact(obj, player, value) {');

// 2. Display streak in openRewardsMenu
content = content.replace(
  '.body(`§7Tus Estadísticas:\\n§7- Tiempo jugado: §e${tHours} horas, ${tMins} minutos§r\\n\\n§7Selecciona un regalo para reclamar:`)',
  `const streakDays = Number(globalThis.__sqlite_get_prop_v2__("rewards_addon", player, "daily_streak") || 0);
    form.body(\`§7Tus Estadísticas:\\n§7- Tiempo jugado: §e\${tHours} horas, \${tMins} minutos§r\\n§6🔥 Racha de conexión: §e\${streakDays}/30 días consecutivos§r\\n§8(Bonos especiales en días 7, 14, 21 y 30)\\n\\n§7Selecciona un regalo para reclamar:\`)`
);

// 3. Update claim logic with 30-day streak calculation and milestone rewards
const oldClaimSuccess = `        // Dar objetos del kit diario
        giveItemSafely(player, "minecraft:golden_apple", 2);
        giveItemSafely(player, "minecraft:bread", 16);
        giveItemSafely(player, "minecraft:cooked_beef", 8);
        giveItemSafely(player, "minecraft:iron_pickaxe", 1);
        giveItemSafely(player, "minecraft:iron_axe", 1);

        giveCrateKey(player);

        player.sendMessage("§b§l[§3Recompensas§b§l]§r §a¡Has reclamado tu Kit Diario! Revisa tu inventario.");`;

const newClaimSuccess = `        // Racha de conexión de 30 días
        let streak = Number(globalThis.__sqlite_get_prop_v2__("rewards_addon", player, "daily_streak") || 0);
        if (currentDiff <= 48 * 60 * 60 * 1000) {
          streak = (streak % 30) + 1;
        } else {
          streak = 1;
        }
        globalThis.__sqlite_set_prop_v2__("rewards_addon", player, "daily_streak", streak);

        // Dar objetos del kit diario base
        giveItemSafely(player, "minecraft:golden_apple", 2);
        giveItemSafely(player, "minecraft:bread", 16);
        giveItemSafely(player, "minecraft:cooked_beef", 8);
        giveItemSafely(player, "minecraft:iron_pickaxe", 1);
        giveItemSafely(player, "minecraft:iron_axe", 1);
        giveCrateKey(player);

        let streakMsg = "";
        if (streak === 7) {
          addPlayerMoney(player, 5000);
          giveCrateKey(player);
          giveCrateKey(player);
          streakMsg = "\\n§6★ ¡BONO RACHA DÍA 7! §e+$5,000 y 2 Llaves de Cofre extra.";
        } else if (streak === 14) {
          addPlayerMoney(player, 10000);
          giveItemSafely(player, "minecraft:enchanted_golden_apple", 1);
          streakMsg = "\\n§6★ ¡BONO RACHA DÍA 14! §e+$10,000 y 1 Manzana de Notch.";
        } else if (streak === 21) {
          addPlayerMoney(player, 20000);
          giveCrateKey(player);
          giveCrateKey(player);
          giveCrateKey(player);
          streakMsg = "\\n§6★ ¡BONO RACHA DÍA 21! §e+$20,000 y 3 Llaves de Cofre extra.";
        } else if (streak === 30) {
          addPlayerMoney(player, 50000);
          giveItemSafely(player, "minecraft:netherite_ingot", 1);
          for (let k = 0; k < 5; k++) giveCrateKey(player);
          streakMsg = "\\n§6★ ¡CICLO DE RACHA DÍA 30 COMPLETADO! §e+$50,000, 1 Lingote de Netherite y 5 Llaves.";
          world.sendMessage(\`§6§l[RECOMPENSAS] §e¡\${player.name} ha completado el ciclo completo de 30 días de racha diaria!\`);
        }

        player.sendMessage(\`§b§l[§3Recompensas§b§l]§r §a¡Kit Diario reclamado! §6(Racha: \${streak}/30 días)\${streakMsg}\`);
        try { player.playSound("random.levelup", { pitch: 1.0 }); } catch (e) {}`;

content = content.replace(oldClaimSuccess, newClaimSuccess);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Successfully patched rewards_addon');
