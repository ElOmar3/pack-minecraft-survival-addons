const fs = require('fs');

const filePath = 'behavior_packs/auction_house_addon/scripts/main.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add formatRemainingTime helper
const timeHelperCode = `
// ============================================================================
// FORMATO DE TIEMPO Y PROTECCIÓN ANTI-SNIPER (FASE 2)
// ============================================================================
function formatAuctionRemainingTime(expiresAt) {
  const ms = Math.max(0, Number(expiresAt || 0) - Date.now());
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (hours > 0) return \`\${hours}h \${minutes}m\`;
  if (minutes > 0) return \`\${minutes}m \${seconds}s\`;
  return \`\${seconds}s\`;
}
`;

content = content.replace('// Abrir menú visual\nfunction openSubastasMenu', timeHelperCode + '\n// Abrir menú visual\nfunction openSubastasMenu');

// 2. Display remaining time in button
content = content.replace(
  'form.button(`📦 ${list.amount}x ${displayName}\\nPrecio: $${list.price} | Vendedor: ${list.seller}`);',
  'form.button(`📦 ${list.amount}x ${displayName}\\n$${list.price} | ${list.seller} | ⏱ ${formatAuctionRemainingTime(list.expiresAt)}`);'
);

// 3. Display remaining time in confirm body
content = content.replace(
  '.body(`¿Deseas comprar este objeto?\\n\\n§7Objeto: §e${listing.amount}x ${displayName}\\n§7Precio: §a$${listing.price}\\n§7Vendedor: §b${listing.seller}\\n§7Tu saldo: §a$${bal}`)',
  '.body(`¿Deseas comprar este objeto?\\n\\n§7Objeto: §e${listing.amount}x ${displayName}\\n§7Precio: §a$${listing.price}\\n§7Vendedor: §b${listing.seller}\\n§7Tiempo restante: §e${formatAuctionRemainingTime(listing.expiresAt)}\\n§7Tu saldo: §a$${bal}`)'
);

// 4. Anti-sniper extension when listing has less than 60s
content = content.replace(
  'const activeListing = db[matchIdx];',
  `const activeListing = db[matchIdx];
      const remainingMs = Number(activeListing.expiresAt || 0) - Date.now();
      if (remainingMs > 0 && remainingMs < 60000) {
        activeListing.expiresAt = Date.now() + 60000;
        player.sendMessage("§b§l[§3Subastas§b§l]§r §e⏱ ¡Extensión Anti-Sniper activada (+60s) en esta publicación!");
      }`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Successfully patched auction_house_addon');
