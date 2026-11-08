const fs = require('fs');

const filePath = 'behavior_packs/shop_addon/scripts/main.js';
let content = fs.readFileSync(filePath, 'utf8');

const dynamicPricingCode = `
// ============================================================================
// PRECIOS FLOTANTES DINÁMICOS POR OFERTA Y DEMANDA (FASE 3)
// ============================================================================
const MARKET_SUPPLY_KEY = "market_supply_hourly_v1";

function getMarketDemandMultiplier(itemKey) {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("shop_addon", "world", MARKET_SUPPLY_KEY);
    const supplyData = raw ? JSON.parse(String(raw)) : {};
    const hourKey = quotaHourUtc();
    const count = Number(supplyData[hourKey]?.[itemKey] || 0);
    // Cada 2,500 unidades vendidas en la hora reducen 10%, hasta un piso del 60%
    const factor = Math.max(0.60, 1.0 - (count / 2500) * 0.10);
    return factor;
  } catch {
    return 1.0;
  }
}

function recordMarketSupply(itemKey, amount) {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("shop_addon", "world", MARKET_SUPPLY_KEY);
    const supplyData = raw ? JSON.parse(String(raw)) : {};
    const hourKey = quotaHourUtc();
    if (!supplyData[hourKey]) supplyData[hourKey] = {};
    supplyData[hourKey][itemKey] = (supplyData[hourKey][itemKey] || 0) + amount;
    for (const k of Object.keys(supplyData)) {
      if (k !== hourKey) delete supplyData[k];
    }
    globalThis.__sqlite_set_prop_v2__("shop_addon", "world", MARKET_SUPPLY_KEY, JSON.stringify(supplyData));
  } catch {}
}
`;

content = content.replace('// === FIN PERSISTENCIA SQLITE PUENTE V3 ===', '// === FIN PERSISTENCIA SQLITE PUENTE V3 ===\n' + dynamicPricingCode);

// Update getItemBasePrice
const oldBasePrice = `function getItemBasePrice(typeId, itemKey = null) {
  if (itemKey === "semilla_sagrada" || typeId === "semilla_sagrada") return 300;
  if (typeId === "minecraft:enchanted_book") return 500;
  return SELL_RULES.get(typeId)?.price ?? 0;
}`;

const newBasePrice = `function getItemBasePrice(typeId, itemKey = null) {
  let base = 0;
  if (itemKey === "semilla_sagrada" || typeId === "semilla_sagrada") base = 300;
  else if (typeId === "minecraft:enchanted_book") base = 500;
  else base = SELL_RULES.get(typeId)?.price ?? 0;

  if (base <= 0) return 0;
  const key = itemKey || typeId;
  const multiplier = getMarketDemandMultiplier(key);
  return Math.max(1, Math.floor(base * multiplier));
}`;

content = content.replace(oldBasePrice, newBasePrice);

// Record supply on successful sale
content = content.replace(
  'recordSale(player, itemKey, actualQty, totalRevenue, quotaState);',
  `recordSale(player, itemKey, actualQty, totalRevenue, quotaState);
        recordMarketSupply(itemKey, actualQty);`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Successfully patched shop_addon');
