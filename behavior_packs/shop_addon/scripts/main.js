import { ErrorReporter } from "./ErrorReporter.js";
import { CommandPermissionLevel, CustomCommandStatus, world, system, ItemStack, EnchantmentTypes } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";






// === PERSISTENCIA SQLITE PUENTE V3 (SEGURO PARA /reload) ===
if (!globalThis.__sqlite_store_v2__) globalThis.__sqlite_store_v2__ = new Map();
if (!globalThis.__sqlite_owner_key_v2__) {
  globalThis.__sqlite_owner_key_v2__ = function(owner) {
    if (typeof owner === "string") return owner;
    if (!owner) return "world";
    if (owner.name) return String(owner.name).toLowerCase();
    if (owner.id !== undefined) return String(owner.id);
    return "world";
  };
}
if (!globalThis.__sqlite_get_prop_v2__) {
  globalThis.__sqlite_get_prop_v2__ = function(addon, owner, key) {
    if (!addon || owner === undefined || owner === null || key === undefined) return undefined;
    const addonStore = globalThis.__sqlite_store_v2__.get(String(addon));
    const ownerStore = addonStore ? addonStore.get(globalThis.__sqlite_owner_key_v2__(owner)) : undefined;
    return ownerStore ? ownerStore[key] : undefined;
  };
}
if (!globalThis.__sqlite_set_prop_v2__) {
  globalThis.__sqlite_set_prop_v2__ = function(addon, owner, key, value) {
    if (!addon || owner === undefined || owner === null || key === undefined) return;
    const addonKey = String(addon);
    const ownerKey = globalThis.__sqlite_owner_key_v2__(owner);
    let addonStore = globalThis.__sqlite_store_v2__.get(addonKey);
    if (!addonStore) { addonStore = new Map(); globalThis.__sqlite_store_v2__.set(addonKey, addonStore); }
    let ownerStore = addonStore.get(ownerKey);
    if (!ownerStore) { ownerStore = {}; addonStore.set(ownerKey, ownerStore); }
    const payload = { addon: addonKey, owner: ownerKey, key };
    if (value === undefined) { delete ownerStore[key]; payload.deleted = true; }
    else { ownerStore[key] = value; payload.deleted = false; payload.value = value; }
    try { console.warn("[SQLITE_SAVE_V1] " + JSON.stringify(payload)); } catch (e) {}
  };
}
if (!globalThis.__sqlite_rehydrate_v2__) {
  globalThis.__sqlite_rehydrate_v2__ = function(addon, owner, key, value, deleted) {
    if (!addon || owner === undefined || owner === null || key === undefined) return;
    const addonKey = String(addon);
    const ownerKey = globalThis.__sqlite_owner_key_v2__(owner);
    let addonStore = globalThis.__sqlite_store_v2__.get(addonKey);
    if (!addonStore) { addonStore = new Map(); globalThis.__sqlite_store_v2__.set(addonKey, addonStore); }
    let ownerStore = addonStore.get(ownerKey);
    if (!ownerStore) { ownerStore = {}; addonStore.set(ownerKey, ownerStore); }
    if (deleted === true) delete ownerStore[key];
    else ownerStore[key] = value;
  };
}
if (!globalThis.__sqlite_sync_complete_v2__) globalThis.__sqlite_sync_complete_v2__ = new Map();
if (!globalThis.__sqlite_sync_status_v3__) globalThis.__sqlite_sync_status_v3__ = new Map();
if (!globalThis.__sqlite_request_sync_v3__) {
  globalThis.__sqlite_request_sync_v3__ = function(addon, attempt) {
    const addonKey = String(addon || "");
    if (!addonKey) return;
    const previous = globalThis.__sqlite_sync_status_v3__.get(addonKey) || {};
    globalThis.__sqlite_sync_status_v3__.set(addonKey, {
      ...previous,
      requestedAt: Date.now(),
      attempt: Number(attempt || 0),
      complete: false,
      protocol: 0,
    });
    try { console.warn("[SQLITE_REQUEST_SYNC] " + JSON.stringify({ addon: addonKey, protocol: 3, attempt: Number(attempt || 0) })); } catch (e) {}
  };
}
try {
  const signal = system.afterEvents && system.afterEvents.scriptEventReceive;
  if (!globalThis.__sqlite_chunk_store_v2__) globalThis.__sqlite_chunk_store_v2__ = new Map();
  if (!globalThis.__sqlite_listener_callback_v3__) {
    const callback = function(event) {
    if (!event || (event.id !== "sqlite:load" && event.id !== "sqlite:sync" && event.id !== "sqlite:load_chunk" && event.id !== "sqlite:sync_complete")) return;
    try {
      const payload = JSON.parse(event.message || "{}");
      if (event.id === "sqlite:sync_complete") {
        if (payload.addon) {
          const addonKey = String(payload.addon);
          globalThis.__sqlite_sync_complete_v2__.set(addonKey, Date.now());
          const previous = globalThis.__sqlite_sync_status_v3__.get(addonKey) || {};
          globalThis.__sqlite_sync_status_v3__.set(addonKey, {
            ...previous,
            complete: true,
            completedAt: Date.now(),
            protocol: Number(payload.protocol || 0),
            entryCount: Number(payload.entryCount || 0),
          });
        }
        return;
      }
      if (event.id === "sqlite:load_chunk") {
        const count = Number(payload.chunkCount);
        const index = Number(payload.chunkIndex);
        if (!payload.addon || payload.key === undefined || !payload.chunkId || !Number.isInteger(count) || count < 1 || count > 128 || !Number.isInteger(index) || index < 0 || index >= count) return;
        const chunkKey = String(payload.chunkId);
        let state = globalThis.__sqlite_chunk_store_v2__.get(chunkKey);
        if (!state || state.count !== count) {
          state = { count: count, chunks: new Array(count) };
          globalThis.__sqlite_chunk_store_v2__.set(chunkKey, state);
        }
        state.chunks[index] = String(payload.valueChunk || "");
        for (let partIndex = 0; partIndex < state.count; partIndex++) {
          if (typeof state.chunks[partIndex] !== "string") return;
        }
        const value = JSON.parse(state.chunks.join(""));
        globalThis.__sqlite_rehydrate_v2__(payload.addon, payload.owner || "world", payload.key, value, false);
        globalThis.__sqlite_chunk_store_v2__.delete(chunkKey);
        return;
      }
      if (payload.addon && payload.key !== undefined) {
        globalThis.__sqlite_rehydrate_v2__(payload.addon, payload.owner || "world", payload.key, payload.value, payload.deleted === true);
      }
    } catch (e) {}
    };
    globalThis.__sqlite_listener_callback_v3__ = callback;
    if (signal && typeof signal.subscribe === "function") signal.subscribe(callback);
  }
} catch (e) {}
globalThis.__sqlite_sync_complete_v2__.delete("shop_addon");
globalThis.__sqlite_request_sync_v3__("shop_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("shop_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("shop_addon", 1);
  } catch (e) {}
}, 120);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
const patchShow = (prototype, originalShow) => {
  if (!prototype || !originalShow || originalShow.__isPatched) return;
  const patched = function(player, retryCount = 0) {
    return originalShow.call(this, player).then((response) => {
      if (response.canceled && response.cancelationReason === "UserBusy" && retryCount < 5) {
        return new Promise((resolve) => {
          system.runTimeout(() => {
            resolve(patched.call(this, player, retryCount + 1));
          }, 5);
        });
      }
      return response;
    });
  };
  patched.__isPatched = true;
  prototype.show = patched;
};

try {
  patchShow(ActionFormData.prototype, ActionFormData.prototype.show);
  patchShow(ModalFormData.prototype, ModalFormData.prototype.show);
  patchShow(MessageFormData.prototype, MessageFormData.prototype.show);
} catch (e) {}

console.warn("Shop UI Addon iniciado.");
const COMMAND_NAMESPACE = "s";

function commandOk(message) {
  return { status: CustomCommandStatus.Success, message };
}

function commandError(message) {
  return { status: CustomCommandStatus.Failure, message };
}

const MAX_SCOREBOARD_BALANCE = 2147483647;
const MAX_PURCHASE_QUANTITY = 9999;
const MAX_OPERATIONAL_BALANCE = 100000000;
const SELL_HOURLY_PAYOUT_LIMIT = 20000;
// Todas las ventas comparten un único tope monetario por hora. La propiedad
// nueva descarta el estado previo que podía contener cuotas incompatibles.
const SELL_QUOTA_PROPERTY = "shop_sell_quota_v5_hourly_global";
const SELL_QUOTA_NOTICE_PROPERTY = "shop_sell_quota_last_notice_v1";
const ECONOMY_DAILY_EMISSION_LIMIT = 50000;
const activeEconomyOperations = new Set();

const SELL_RULES = new Map();

// En Bedrock las camas son un único ítem (`minecraft:bed`) y el color se
// define con su valor auxiliar. Los IDs white_bed/orange_bed no se pueden
// entregar con /give en esta versión de BDS.
const BED_VARIANTS = [
  ["Blanca", 0], ["Naranja", 1], ["Magenta", 2], ["Azul Claro", 3],
  ["Amarilla", 4], ["Verde Lima", 5], ["Rosa", 6], ["Gris", 7],
  ["Gris Claro", 8], ["Cian", 9], ["Morada", 10], ["Azul", 11],
  ["Marrón", 12], ["Verde", 13], ["Roja", 14], ["Negra", 15]
].map(([color, dataValue]) => ({
  name: `Cama ${color}`,
  id: "minecraft:bed",
  dataValue,
  buyPrice: 90,
  sellPrice: 18,
  searchAliases: `cama ${color}`
}));

const CATEGORIES = [
  {
    name: "Materiales",
    items: [
      { name: "Diamante", id: "minecraft:diamond", buyPrice: 100, sellPrice: 25 },
      { name: "Lingote de Hierro", id: "minecraft:iron_ingot", buyPrice: 20, sellPrice: 5 },
      { name: "Lingote de Oro", id: "minecraft:gold_ingot", buyPrice: 40, sellPrice: 10 },
      { name: "Carbón", id: "minecraft:coal", buyPrice: 10, sellPrice: 2 },
      { name: "Netherite Scrap", id: "minecraft:netherite_scrap", buyPrice: 450, sellPrice: 100 },
      { name: "Lingote de Cobre", id: "minecraft:copper_ingot", buyPrice: 10, sellPrice: 2 },
      { name: "Lingote de Netherita", id: "minecraft:netherite_ingot", buyPrice: 2800, sellPrice: 700 },
      { name: "Esmeralda", id: "minecraft:emerald", buyPrice: 80, sellPrice: 20 },
      { name: "Lapislázuli", id: "minecraft:lapis_lazuli", buyPrice: 15, sellPrice: 3 },
      { name: "Fragmento de Amatista", id: "minecraft:amethyst_shard", buyPrice: 25, sellPrice: 4 },
      { name: "Cuarzo del Nether", id: "minecraft:quartz", buyPrice: 10, sellPrice: 2 },
      { name: "Bola de Slime", id: "minecraft:slime_ball", buyPrice: 15, sellPrice: 3 },
      { name: "Crema de Magma", id: "minecraft:magma_cream", buyPrice: 20, sellPrice: 6 },
      { name: "Lágrima de Ghast", id: "minecraft:ghast_tear", buyPrice: 200, sellPrice: 60 },
      { name: "Vara de Blaze", id: "minecraft:blaze_rod", buyPrice: 50, sellPrice: 8 },
      { name: "Pedernal", id: "minecraft:flint", buyPrice: 8, sellPrice: 2 },
      { name: "Prismarina Oscura", id: "minecraft:dark_prismarine", buyPrice: 20, sellPrice: 4 },
      { name: "Bola de Arcilla", id: "minecraft:clay_ball", buyPrice: 4, sellPrice: 1 },
      { name: "Ladrillo de Arcilla", id: "minecraft:brick", buyPrice: 6, sellPrice: 1 },
      { name: "Ladrillo del Nether", id: "minecraft:netherbrick", buyPrice: 5, sellPrice: 1 },
      { name: "Fragmento de Prismarina", id: "minecraft:prismarine_shard", buyPrice: 12, sellPrice: 2 },
      { name: "Cristal de Prismarina", id: "minecraft:prismarine_crystals", buyPrice: 18, sellPrice: 3 },
      { name: "Fragmento de Eco (Echo Shard)", id: "minecraft:echo_shard", buyPrice: 450, sellPrice: 100 },
      { name: "Carbón Vegetal", id: "minecraft:charcoal", buyPrice: 10, sellPrice: 2 },
      { name: "Hierro Bruto", id: "minecraft:raw_iron", buyPrice: 15, sellPrice: 4 },
      { name: "Oro Bruto", id: "minecraft:raw_gold", buyPrice: 30, sellPrice: 8 },
      { name: "Cobre Bruto", id: "minecraft:raw_copper", buyPrice: 8, sellPrice: 1 }
    ]
  },
  {
    name: "Bloques Especiales",
    items: [
      { name: "Obsidiana", id: "minecraft:obsidian", buyPrice: 50, sellPrice: 15 },
      { name: "Piedra Luminosa (Glowstone)", id: "minecraft:glowstone", buyPrice: 30, sellPrice: 10 },
      { name: "Faro (Beacon)", id: "minecraft:beacon", buyPrice: 11500, sellPrice: 3000 },
      { name: "Hielo Azul", id: "minecraft:blue_ice", buyPrice: 80, sellPrice: 20 },
      { name: "Hielo Compacto", id: "minecraft:packed_ice", buyPrice: 20, sellPrice: 5 },
      { name: "Esponja", id: "minecraft:sponge", buyPrice: 250, sellPrice: 60 },
      { name: "Linterna de Mar", id: "minecraft:sea_lantern", buyPrice: 100, sellPrice: 25 },
      { name: "Cristal Tintado", id: "minecraft:tinted_glass", buyPrice: 80, sellPrice: 20 },
      { name: "Arena de Almas", id: "minecraft:soul_sand", buyPrice: 20, sellPrice: 5 },
      { name: "Bloque de Hueso", id: "minecraft:bone_block", buyPrice: 30, sellPrice: 8 },
      { name: "Terracota", id: "minecraft:terracotta", buyPrice: 10, sellPrice: 2 },
      { name: "Calcita", id: "minecraft:calcite", buyPrice: 12, sellPrice: 2 },
      { name: "Toba", id: "minecraft:tuff", buyPrice: 8, sellPrice: 1 },
      { name: "Basalto", id: "minecraft:basalt", buyPrice: 7, sellPrice: 1 },
      { name: "Piedra de Musgo", id: "minecraft:mossy_cobblestone", buyPrice: 10, sellPrice: 2 },
      { name: "Ladrillos de Piedra", id: "minecraft:stonebrick", buyPrice: 5, sellPrice: 1 },
      { name: "Piedra Lisa", id: "minecraft:smooth_stone", buyPrice: 6, sellPrice: 1 },
      { name: "Cadena", id: "minecraft:chain", buyPrice: 22, sellPrice: 5 },
      { name: "Bloque de Magma", id: "minecraft:magma", buyPrice: 25, sellPrice: 6 },
      { name: "Bloque de Netherite", id: "minecraft:netherite_block", buyPrice: 28000, sellPrice: 7000 },
      { name: "Bloque de Diamante", id: "minecraft:diamond_block", buyPrice: 1150, sellPrice: 290 },
      { name: "Bloque de Esmeralda", id: "minecraft:emerald_block", buyPrice: 900, sellPrice: 220 },
      { name: "Bloque de Oro", id: "minecraft:gold_block", buyPrice: 400, sellPrice: 100 },
      { name: "Bloque de Hierro", id: "minecraft:iron_block", buyPrice: 200, sellPrice: 50 },
      { name: "Bloque de Redstone", id: "minecraft:redstone_block", buyPrice: 80, sellPrice: 20 },
      { name: "Obsidiana Llorosa", id: "minecraft:crying_obsidian", buyPrice: 150, sellPrice: 40 },
      { name: "Piedra de Goteo (Dripstone)", id: "minecraft:dripstone_block", buyPrice: 10, sellPrice: 2 },
      { name: "Piedra de Goteo Puntiaguda", id: "minecraft:pointed_dripstone", buyPrice: 12, sellPrice: 2 },
      { name: "Bloque de Musgo", id: "minecraft:moss_block", buyPrice: 15, sellPrice: 3 },
      { name: "Bloque de Lodo", id: "minecraft:mud", buyPrice: 8, sellPrice: 1 },
      { name: "Ladrillos de Lodo", id: "minecraft:mud_bricks", buyPrice: 12, sellPrice: 2 },
      { name: "RanaLuz Ocre (Froglight)", id: "minecraft:ochre_froglight", buyPrice: 160, sellPrice: 35 },
      { name: "RanaLuz Verdosa (Froglight)", id: "minecraft:verdant_froglight", buyPrice: 160, sellPrice: 35 },
      { name: "RanaLuz Perlada (Froglight)", id: "minecraft:pearlescent_froglight", buyPrice: 160, sellPrice: 35 },
      { name: "Hongo Brillante (Shroomlight)", id: "minecraft:shroomlight", buyPrice: 80, sellPrice: 15 },
      { name: "Liquen Luminoso (Glow Lichen)", id: "minecraft:glow_lichen", buyPrice: 15, sellPrice: 3 },
      { name: "Alfombra de Musgo", id: "minecraft:moss_carpet", buyPrice: 6, sellPrice: 1 },
      { name: "Flor de Esporas", id: "minecraft:spore_blossom", buyPrice: 180, sellPrice: 40 },
      { name: "Bloque de Sculk", id: "minecraft:sculk", buyPrice: 15, sellPrice: 3 },
      { name: "Catalizador de Sculk", id: "minecraft:sculk_catalyst", buyPrice: 250, sellPrice: 50 },
      { name: "Sensor de Sculk", id: "minecraft:sculk_sensor", buyPrice: 350, sellPrice: 70 },
      { name: "Chillador de Sculk (Shrieker)", id: "minecraft:sculk_shrieker", buyPrice: 600, sellPrice: 120 },
      { name: "Bloque de Verrugas del Nether", id: "minecraft:nether_wart_block", buyPrice: 15, sellPrice: 3 },
      { name: "Bloque de Verrugas Distorsionadas", id: "minecraft:warped_wart_block", buyPrice: 15, sellPrice: 3 }
    ]
  },
  {
    name: "Cajas de Shulker",
    items: [
      { name: "Caparazón de Shulker", id: "minecraft:shulker_shell", buyPrice: 700, sellPrice: 180 },
      { name: "Caja de Shulker (Normal)", id: "minecraft:shulker_box", buyPrice: 1750, sellPrice: 430 },
      { name: "Caja de Shulker Blanca", id: "minecraft:white_shulker_box", buyPrice: 1800, sellPrice: 440 },
      { name: "Caja de Shulker Gris Claro", id: "minecraft:light_gray_shulker_box", buyPrice: 1800, sellPrice: 440 },
      { name: "Caja de Shulker Gris", id: "minecraft:gray_shulker_box", buyPrice: 1800, sellPrice: 440 },
      { name: "Caja de Shulker Negra", id: "minecraft:black_shulker_box", buyPrice: 1800, sellPrice: 440 },
      { name: "Caja de Shulker Café", id: "minecraft:brown_shulker_box", buyPrice: 1800, sellPrice: 440 },
      { name: "Caja de Shulker Roja", id: "minecraft:red_shulker_box", buyPrice: 1800, sellPrice: 440 },
      { name: "Caja de Shulker Naranja", id: "minecraft:orange_shulker_box", buyPrice: 1800, sellPrice: 440 },
      { name: "Caja de Shulker Amarilla", id: "minecraft:yellow_shulker_box", buyPrice: 1800, sellPrice: 440 },
      { name: "Caja de Shulker Lima", id: "minecraft:lime_shulker_box", buyPrice: 1800, sellPrice: 440 },
      { name: "Caja de Shulker Verde", id: "minecraft:green_shulker_box", buyPrice: 1800, sellPrice: 440 },
      { name: "Caja de Shulker Cian", id: "minecraft:cyan_shulker_box", buyPrice: 1800, sellPrice: 440 },
      { name: "Caja de Shulker Azul Claro", id: "minecraft:light_blue_shulker_box", buyPrice: 1800, sellPrice: 440 },
      { name: "Caja de Shulker Azul", id: "minecraft:blue_shulker_box", buyPrice: 1800, sellPrice: 440 },
      { name: "Caja de Shulker Morada", id: "minecraft:purple_shulker_box", buyPrice: 1800, sellPrice: 440 },
      { name: "Caja de Shulker Magenta", id: "minecraft:magenta_shulker_box", buyPrice: 1800, sellPrice: 440 },
      { name: "Caja de Shulker Rosa", id: "minecraft:pink_shulker_box", buyPrice: 1800, sellPrice: 440 }
    ]
  },
  {
    name: "Comida",
    items: [
      { name: "Filete Cocinado", id: "minecraft:cooked_beef", buyPrice: 5, sellPrice: 2 },
      { name: "Zanahoria Dorada", id: "minecraft:golden_carrot", buyPrice: 15, sellPrice: 5 },
      { name: "Manzana", id: "minecraft:apple", buyPrice: 3, sellPrice: 1 },
      { name: "Pan", id: "minecraft:bread", buyPrice: 5, sellPrice: 1 },
      { name: "Tarta", id: "minecraft:cake", buyPrice: 30, sellPrice: 5 },
      { name: "Galleta", id: "minecraft:cookie", buyPrice: 2, sellPrice: 1 },
      { name: "Zanahoria", id: "minecraft:carrot", buyPrice: 2, sellPrice: 1 },
      { name: "Patata", id: "minecraft:potato", buyPrice: 2, sellPrice: 1 },
      { name: "Patata Cocinada", id: "minecraft:baked_potato", buyPrice: 4, sellPrice: 1 },
      { name: "Sandía (Rodaja)", id: "minecraft:melon_slice", buyPrice: 1, sellPrice: 1 },
      { name: "Bloque de Sandía", id: "minecraft:melon_block", buyPrice: 10, sellPrice: 2 },
      { name: "Calabaza", id: "minecraft:pumpkin", buyPrice: 10, sellPrice: 2 },
      { name: "Chuleta de Cerdo Cocinada", id: "minecraft:cooked_porkchop", buyPrice: 5, sellPrice: 2 },
      { name: "Pollo Cocinado", id: "minecraft:cooked_chicken", buyPrice: 5, sellPrice: 2 },
      { name: "Bacalao Cocinado", id: "minecraft:cooked_cod", buyPrice: 5, sellPrice: 2 },
      { name: "Salmón Cocinado", id: "minecraft:cooked_salmon", buyPrice: 5, sellPrice: 2 },
      { name: "Trigo", id: "minecraft:wheat", buyPrice: 3, sellPrice: 1 },
      { name: "Caña de Azúcar", id: "minecraft:sugar_cane", buyPrice: 5, sellPrice: 1 },
      { name: "Bayas Dulces", id: "minecraft:sweet_berries", buyPrice: 3, sellPrice: 1 },
      { name: "Bayas Luminosas", id: "minecraft:glow_berries", buyPrice: 6, sellPrice: 1 },
      { name: "Remolacha", id: "minecraft:beetroot", buyPrice: 2, sellPrice: 1 },
      { name: "Sopa de Champiñones", id: "minecraft:mushroom_stew", buyPrice: 12, sellPrice: 2 },
      { name: "Estofado de Conejo", id: "minecraft:rabbit_stew", buyPrice: 25, sellPrice: 5 },
      { name: "Tarta de Calabaza", id: "minecraft:pumpkin_pie", buyPrice: 15, sellPrice: 3 },
      { name: "Alga Seca", id: "minecraft:dried_kelp", buyPrice: 2, sellPrice: 1 },
      { name: "Botella de Miel", id: "minecraft:honey_bottle", buyPrice: 20, sellPrice: 4 },
      { name: "Fruta Coral (Chorus)", id: "minecraft:chorus_fruit", buyPrice: 45, sellPrice: 10 }
    ]
  },
  {
    name: "Utilidades",
    items: [
      { name: "Perla de Ender", id: "minecraft:ender_pearl", buyPrice: 30, sellPrice: 10 },
      { name: "Pólvora", id: "minecraft:gunpowder", buyPrice: 15, sellPrice: 3 },
      { name: "Cohete de Fuegos Artificiales", id: "minecraft:firework_rocket", buyPrice: 10, sellPrice: 3 },
      { name: "Frasco con Experiencia", id: "minecraft:experience_bottle", buyPrice: 15, sellPrice: 5 },
      { name: "Cuero", id: "minecraft:leather", buyPrice: 12, sellPrice: 2 },
      { name: "Hueso", id: "minecraft:bone", buyPrice: 8, sellPrice: 1 },
      { name: "Hilo", id: "minecraft:string", buyPrice: 6, sellPrice: 1 },
      { name: "Pluma", id: "minecraft:feather", buyPrice: 4, sellPrice: 1 },
      { name: "Cofre de Ender", id: "minecraft:ender_chest", buyPrice: 950, sellPrice: 190 },
      { name: "Montura", id: "minecraft:saddle", buyPrice: 500, sellPrice: 80 },
      { name: "Etiqueta (Name Tag)", id: "minecraft:name_tag", buyPrice: 150, sellPrice: 30 },
      { name: "Rienda (Lead)", id: "minecraft:lead", buyPrice: 50, sellPrice: 10 },
      { name: "Manzana Dorada", id: "minecraft:golden_apple", buyPrice: 250, sellPrice: 50 },
      { name: "Verruga del Nether", id: "minecraft:nether_wart", buyPrice: 20, sellPrice: 5 },
      { name: "Mejora de Inframundita", id: "minecraft:netherite_upgrade_smithing_template", buyPrice: 34000, sellPrice: 7500 },
      { name: "Atril", id: "minecraft:lectern", buyPrice: 55, sellPrice: 10 },
      { name: "Yunque", id: "minecraft:anvil", buyPrice: 320, sellPrice: 70 },
      { name: "Mesa de Encantamientos", id: "minecraft:enchanting_table", buyPrice: 900, sellPrice: 180 },
      { name: "Membrana de Phantom", id: "minecraft:phantom_membrane", buyPrice: 100, sellPrice: 30 },
      { name: "Piel de Conejo", id: "minecraft:rabbit_hide", buyPrice: 8, sellPrice: 1 },
      { name: "Pata de Conejo", id: "minecraft:rabbit_foot", buyPrice: 120, sellPrice: 30 },
      { name: "Saco de Tinta", id: "minecraft:ink_sac", buyPrice: 8, sellPrice: 1 },
      { name: "Saco de Tinta Brillante", id: "minecraft:glow_ink_sac", buyPrice: 20, sellPrice: 4 },
      { name: "Carne Podrida (Rotten Flesh)", id: "minecraft:rotten_flesh", buyPrice: 3, sellPrice: 1 }
    ]
  },
  {
    name: "Redstone y Automatización",
    items: [
      { name: "Polvo de Redstone", id: "minecraft:redstone", buyPrice: 8, sellPrice: 2 },
      { name: "Pistón Pegajoso", id: "minecraft:sticky_piston", buyPrice: 50, sellPrice: 15 },
      { name: "Observador", id: "minecraft:observer", buyPrice: 60, sellPrice: 20 },
      { name: "Repetidor de Redstone", id: "minecraft:repeater", buyPrice: 25, sellPrice: 6 },
      { name: "Comparador de Redstone", id: "minecraft:comparator", buyPrice: 40, sellPrice: 10 },
      { name: "Dispensador", id: "minecraft:dispenser", buyPrice: 50, sellPrice: 12 },
      { name: "Soltador", id: "minecraft:dropper", buyPrice: 30, sellPrice: 8 },
      { name: "TNT", id: "minecraft:tnt", buyPrice: 80, sellPrice: 16 },
      { name: "Encendedor (Sílex y Acero)", id: "minecraft:flint_and_steel", buyPrice: 45, sellPrice: 8, searchAliases: "mechero encendedor flint steel" },
      { name: "Tolva", id: "minecraft:hopper", buyPrice: 120, sellPrice: 35 },
      { name: "Lámpara de Redstone", id: "minecraft:redstone_lamp", buyPrice: 80, sellPrice: 20 },
      { name: "Gancho de Hilo", id: "minecraft:tripwire_hook", buyPrice: 15, sellPrice: 3 },
      { name: "Palanca", id: "minecraft:lever", buyPrice: 6, sellPrice: 1 },
      { name: "Botón de Piedra", id: "minecraft:stone_button", buyPrice: 4, sellPrice: 1 },
      { name: "Placa de Presión de Piedra", id: "minecraft:stone_pressure_plate", buyPrice: 8, sellPrice: 1 },
      { name: "Pistón", id: "minecraft:piston", buyPrice: 35, sellPrice: 10 },
      { name: "Bloque de Slime", id: "minecraft:slime", buyPrice: 140, sellPrice: 35 },
      { name: "Escama de Tortuga", id: "minecraft:scute", buyPrice: 150, sellPrice: 45 },
      { name: "Caparazón de Nautilus", id: "minecraft:nautilus_shell", buyPrice: 250, sellPrice: 50 }
    ]
  },
  {
    name: "Pociones y Alquimia",
    items: [
      { name: "Soporte para Pociones", id: "minecraft:brewing_stand", buyPrice: 150, sellPrice: 30 },
      { name: "Caldero", id: "minecraft:cauldron", buyPrice: 80, sellPrice: 15 },
      { name: "Frasco de Vidrio", id: "minecraft:glass_bottle", buyPrice: 10, sellPrice: 2 },
      { name: "Polvo de Blaze", id: "minecraft:blaze_powder", buyPrice: 25, sellPrice: 4 },
      { name: "Ojo de Araña", id: "minecraft:spider_eye", buyPrice: 15, sellPrice: 3 },
      { name: "Ojo de Araña Fermentado", id: "minecraft:fermented_spider_eye", buyPrice: 30, sellPrice: 6 },
      { name: "Rodaja de Sandía Reluciente", id: "minecraft:glistering_melon_slice", buyPrice: 35, sellPrice: 8 },
      { name: "Azúcar", id: "minecraft:sugar", buyPrice: 8, sellPrice: 1 },
      { name: "Aliento de Dragón", id: "minecraft:dragons_breath", buyPrice: 450, sellPrice: 90 },
      { name: "Pez Globo", id: "minecraft:pufferfish", buyPrice: 50, sellPrice: 10 },
      { name: "Poción Arrojadiza de Vida II", id: "minecraft:splash_potion", buyPrice: 200, sellPrice: 30 },
      { name: "Poción de Fuerza II", id: "minecraft:potion", buyPrice: 300, sellPrice: 50 }
    ]
  },
  {
    name: "Tesoros de Supervivencia",
    items: [
      { name: "Élitros (Elytra)", id: "minecraft:elytra", buyPrice: 42000, sellPrice: 0 },
      { name: "Tótem de Inmortalidad", id: "minecraft:totem_of_undying", buyPrice: 14500, sellPrice: 0 },
      { name: "Manzana Dorada Encantada", id: "minecraft:enchanted_golden_apple", buyPrice: 18000, sellPrice: 0 },
      { name: "Estrella del Nether", id: "minecraft:nether_star", buyPrice: 23500, sellPrice: 0 },
      { name: "Huevo de Dragón", id: "minecraft:dragon_egg", buyPrice: 145000, sellPrice: 0 },
      { name: "Corazón del Mar", id: "minecraft:heart_of_the_sea", buyPrice: 6500, sellPrice: 1350 },
      { name: "Cráneo de Esqueleto Wither", id: "minecraft:wither_skeleton_skull", buyPrice: 2200, sellPrice: 400 },
      { name: "Cabeza de Creeper", id: "minecraft:creeper_head", buyPrice: 1500, sellPrice: 300 },
      { name: "Cabeza de Zombie", id: "minecraft:zombie_head", buyPrice: 1500, sellPrice: 300 }
    ]
  },
  {
    name: "Movilidad y Exploración",
    items: [
      { name: "Brújula", id: "minecraft:compass", buyPrice: 120, sellPrice: 25 },
      { name: "Reloj", id: "minecraft:clock", buyPrice: 140, sellPrice: 30 },
      { name: "Mapa Vacío", id: "minecraft:empty_map", buyPrice: 80, sellPrice: 15 },
      { name: "Mesa de Cartografía", id: "minecraft:cartography_table", buyPrice: 120, sellPrice: 25 },
      { name: "Bote de Roble", id: "minecraft:oak_boat", buyPrice: 60, sellPrice: 12 },
      { name: "Vagoneta", id: "minecraft:minecart", buyPrice: 90, sellPrice: 18 },
      { name: "Riel Propulsor", id: "minecraft:golden_rail", buyPrice: 18, sellPrice: 4 },
      { name: "Riel", id: "minecraft:rail", buyPrice: 6, sellPrice: 1 },
      { name: "Riel Detector", id: "minecraft:detector_rail", buyPrice: 20, sellPrice: 4 },
      { name: "Riel Activador", id: "minecraft:activator_rail", buyPrice: 20, sellPrice: 4 },
      { name: "Cuerda de Respuesta (Wind Charge)", id: "minecraft:wind_charge", buyPrice: 180, sellPrice: 35 },
      { name: "Cuerno de Cabra", id: "minecraft:goat_horn", buyPrice: 1150, sellPrice: 230 },
      { name: "Bote con Cofre", id: "minecraft:oak_chest_boat", buyPrice: 120, sellPrice: 24 },
      { name: "Vagoneta con Cofre", id: "minecraft:chest_minecart", buyPrice: 150, sellPrice: 30 },
      { name: "Catalejo (Spyglass)", id: "minecraft:spyglass", buyPrice: 150, sellPrice: 30 },
      { name: "Caña de Pescar", id: "minecraft:fishing_rod", buyPrice: 50, sellPrice: 10 }
    ]
  },
  {
    name: "Materiales de Construcción",
    items: [
      { name: "Piedra", id: "minecraft:stone", buyPrice: 2, sellPrice: 1 },
      { name: "Adoquín (Cobblestone)", id: "minecraft:cobblestone", buyPrice: 1, sellPrice: 1 },
      { name: "Tierra", id: "minecraft:dirt", buyPrice: 1, sellPrice: 1 },
      { name: "Arena", id: "minecraft:sand", buyPrice: 2, sellPrice: 1 },
      { name: "Grava", id: "minecraft:gravel", buyPrice: 2, sellPrice: 1 },
      { name: "Cristal (Vidrio)", id: "minecraft:glass", buyPrice: 5, sellPrice: 1 },
      { name: "Ladrillos de Arcilla", id: "minecraft:brick_block", buyPrice: 15, sellPrice: 3 },
      { name: "Netherrack", id: "minecraft:netherrack", buyPrice: 3, sellPrice: 1 },
      { name: "Piedra del Fin (End Stone)", id: "minecraft:end_stone", buyPrice: 10, sellPrice: 2 },
      { name: "Bloque de Cuarzo", id: "minecraft:quartz_block", buyPrice: 30, sellPrice: 8 },
      { name: "Pizarra Profunda", id: "minecraft:deepslate", buyPrice: 3, sellPrice: 1 },
      { name: "Pizarra Pulida", id: "minecraft:polished_deepslate", buyPrice: 5, sellPrice: 1 },
      { name: "Piedra Negra", id: "minecraft:blackstone", buyPrice: 4, sellPrice: 1 },
      { name: "Piedra Negra Pulida", id: "minecraft:polished_blackstone", buyPrice: 6, sellPrice: 1 },
      { name: "Prismarina", id: "minecraft:prismarine", buyPrice: 15, sellPrice: 3 },
      { name: "Bloque de Púrpura", id: "minecraft:purpur_block", buyPrice: 20, sellPrice: 4 },
      { name: "Ladrillos de Piedra Negra Pulida", id: "minecraft:polished_blackstone_bricks", buyPrice: 8, sellPrice: 1 },
      { name: "Ladrillos de Pizarra Profunda", id: "minecraft:deepslate_bricks", buyPrice: 7, sellPrice: 1 },
      { name: "Concreto Blanco", id: "minecraft:white_concrete", buyPrice: 12, sellPrice: 2 },
      { name: "Concreto Naranja", id: "minecraft:orange_concrete", buyPrice: 12, sellPrice: 2 },
      { name: "Concreto Magenta", id: "minecraft:magenta_concrete", buyPrice: 12, sellPrice: 2 },
      { name: "Concreto Azul Claro", id: "minecraft:light_blue_concrete", buyPrice: 12, sellPrice: 2 },
      { name: "Concreto Amarillo", id: "minecraft:yellow_concrete", buyPrice: 12, sellPrice: 2 },
      { name: "Concreto Lima", id: "minecraft:lime_concrete", buyPrice: 12, sellPrice: 2 },
      { name: "Concreto Rosa", id: "minecraft:pink_concrete", buyPrice: 12, sellPrice: 2 },
      { name: "Concreto Gris", id: "minecraft:gray_concrete", buyPrice: 12, sellPrice: 2 },
      { name: "Concreto Gris Claro", id: "minecraft:light_gray_concrete", buyPrice: 12, sellPrice: 2 },
      { name: "Concreto Cian", id: "minecraft:cyan_concrete", buyPrice: 12, sellPrice: 2 },
      { name: "Concreto Morado", id: "minecraft:purple_concrete", buyPrice: 12, sellPrice: 2 },
      { name: "Concreto Azul", id: "minecraft:blue_concrete", buyPrice: 12, sellPrice: 2 },
      { name: "Concreto Café", id: "minecraft:brown_concrete", buyPrice: 12, sellPrice: 2 },
      { name: "Concreto Verde", id: "minecraft:green_concrete", buyPrice: 12, sellPrice: 2 },
      { name: "Concreto Rojo", id: "minecraft:red_concrete", buyPrice: 12, sellPrice: 2 },
      { name: "Concreto Negro", id: "minecraft:black_concrete", buyPrice: 12, sellPrice: 2 },
      { name: "Terracota Blanca", id: "minecraft:white_terracotta", buyPrice: 10, sellPrice: 2 },
      { name: "Terracota Naranja", id: "minecraft:orange_terracotta", buyPrice: 10, sellPrice: 2 },
      { name: "Terracota Magenta", id: "minecraft:magenta_terracotta", buyPrice: 10, sellPrice: 2 },
      { name: "Terracota Azul Claro", id: "minecraft:light_blue_terracotta", buyPrice: 10, sellPrice: 2 },
      { name: "Terracota Amarilla", id: "minecraft:yellow_terracotta", buyPrice: 10, sellPrice: 2 },
      { name: "Terracota Lima", id: "minecraft:lime_terracotta", buyPrice: 10, sellPrice: 2 },
      { name: "Terracota Rosa", id: "minecraft:pink_terracotta", buyPrice: 10, sellPrice: 2 },
      { name: "Terracota Gris", id: "minecraft:gray_terracotta", buyPrice: 10, sellPrice: 2 },
      { name: "Terracota Gris Claro", id: "minecraft:light_gray_terracotta", buyPrice: 10, sellPrice: 2 },
      { name: "Terracota Cian", id: "minecraft:cyan_terracotta", buyPrice: 10, sellPrice: 2 },
      { name: "Terracota Morada", id: "minecraft:purple_terracotta", buyPrice: 10, sellPrice: 2 },
      { name: "Terracota Azul", id: "minecraft:blue_terracotta", buyPrice: 10, sellPrice: 2 },
      { name: "Terracota Café", id: "minecraft:brown_terracotta", buyPrice: 10, sellPrice: 2 },
      { name: "Terracota Verde", id: "minecraft:green_terracotta", buyPrice: 10, sellPrice: 2 },
      { name: "Terracota Roja", id: "minecraft:red_terracotta", buyPrice: 10, sellPrice: 2 },
      { name: "Terracota Negra", id: "minecraft:black_terracotta", buyPrice: 10, sellPrice: 2 },
      { name: "Cristal Blanco", id: "minecraft:white_stained_glass", buyPrice: 8, sellPrice: 1 },
      { name: "Cristal Naranja", id: "minecraft:orange_stained_glass", buyPrice: 8, sellPrice: 1 },
      { name: "Cristal Magenta", id: "minecraft:magenta_stained_glass", buyPrice: 8, sellPrice: 1 },
      { name: "Cristal Azul Claro", id: "minecraft:light_blue_stained_glass", buyPrice: 8, sellPrice: 1 },
      { name: "Cristal Amarillo", id: "minecraft:yellow_stained_glass", buyPrice: 8, sellPrice: 1 },
      { name: "Cristal Lima", id: "minecraft:lime_stained_glass", buyPrice: 8, sellPrice: 1 },
      { name: "Cristal Rosa", id: "minecraft:pink_stained_glass", buyPrice: 8, sellPrice: 1 },
      { name: "Cristal Gris", id: "minecraft:gray_stained_glass", buyPrice: 8, sellPrice: 1 },
      { name: "Cristal Gris Claro", id: "minecraft:light_gray_stained_glass", buyPrice: 8, sellPrice: 1 },
      { name: "Cristal Cian", id: "minecraft:cyan_stained_glass", buyPrice: 8, sellPrice: 1 },
      { name: "Cristal Morado", id: "minecraft:purple_stained_glass", buyPrice: 8, sellPrice: 1 },
      { name: "Cristal Azul", id: "minecraft:blue_stained_glass", buyPrice: 8, sellPrice: 1 },
      { name: "Cristal Café", id: "minecraft:brown_stained_glass", buyPrice: 8, sellPrice: 1 },
      { name: "Cristal Verde", id: "minecraft:green_stained_glass", buyPrice: 8, sellPrice: 1 },
      { name: "Cristal Rojo", id: "minecraft:red_stained_glass", buyPrice: 8, sellPrice: 1 },
      { name: "Cristal Negro", id: "minecraft:black_stained_glass", buyPrice: 8, sellPrice: 1 },
      { name: "Panel Cristal Blanco", id: "minecraft:white_stained_glass_pane", buyPrice: 3, sellPrice: 1 },
      { name: "Panel Cristal Naranja", id: "minecraft:orange_stained_glass_pane", buyPrice: 3, sellPrice: 1 },
      { name: "Panel Cristal Magenta", id: "minecraft:magenta_stained_glass_pane", buyPrice: 3, sellPrice: 1 },
      { name: "Panel Cristal Azul Claro", id: "minecraft:light_blue_stained_glass_pane", buyPrice: 3, sellPrice: 1 },
      { name: "Panel Cristal Amarillo", id: "minecraft:yellow_stained_glass_pane", buyPrice: 3, sellPrice: 1 },
      { name: "Panel Cristal Lima", id: "minecraft:lime_stained_glass_pane", buyPrice: 3, sellPrice: 1 },
      { name: "Panel Cristal Rosa", id: "minecraft:pink_stained_glass_pane", buyPrice: 3, sellPrice: 1 },
      { name: "Panel Cristal Gris", id: "minecraft:gray_stained_glass_pane", buyPrice: 3, sellPrice: 1 },
      { name: "Panel Cristal Gris Claro", id: "minecraft:light_gray_stained_glass_pane", buyPrice: 3, sellPrice: 1 },
      { name: "Panel Cristal Cian", id: "minecraft:cyan_stained_glass_pane", buyPrice: 3, sellPrice: 1 },
      { name: "Panel Cristal Morado", id: "minecraft:purple_stained_glass_pane", buyPrice: 3, sellPrice: 1 },
      { name: "Panel Cristal Azul", id: "minecraft:blue_stained_glass_pane", buyPrice: 3, sellPrice: 1 },
      { name: "Panel Cristal Café", id: "minecraft:brown_stained_glass_pane", buyPrice: 3, sellPrice: 1 },
      { name: "Panel Cristal Verde", id: "minecraft:green_stained_glass_pane", buyPrice: 3, sellPrice: 1 },
      { name: "Panel Cristal Rojo", id: "minecraft:red_stained_glass_pane", buyPrice: 3, sellPrice: 1 },
      { name: "Panel Cristal Negro", id: "minecraft:black_stained_glass_pane", buyPrice: 3, sellPrice: 1 },
      { name: "Hojas de Roble", id: "minecraft:oak_leaves", buyPrice: 3, sellPrice: 1 },
      { name: "Hojas de Abedul", id: "minecraft:birch_leaves", buyPrice: 3, sellPrice: 1 },
      { name: "Hojas de Abeto", id: "minecraft:spruce_leaves", buyPrice: 3, sellPrice: 1 },
      { name: "Hojas de Jungla", id: "minecraft:jungle_leaves", buyPrice: 3, sellPrice: 1 },
      { name: "Hojas de Acacia", id: "minecraft:acacia_leaves", buyPrice: 3, sellPrice: 1 },
      { name: "Hojas de Roble Oscuro", id: "minecraft:dark_oak_leaves", buyPrice: 3, sellPrice: 1 },
      { name: "Hojas de Manglar", id: "minecraft:mangrove_leaves", buyPrice: 4, sellPrice: 1 },
      { name: "Hojas de Cerezo", id: "minecraft:cherry_leaves", buyPrice: 4, sellPrice: 1 },
      { name: "Losa de Adoquín", id: "minecraft:cobblestone_slab", buyPrice: 1, sellPrice: 1 },
      { name: "Lana Blanca", id: "minecraft:white_wool", buyPrice: 5, sellPrice: 1 },
      { name: "Lana Naranja", id: "minecraft:orange_wool", buyPrice: 5, sellPrice: 1 },
      { name: "Lana Magenta", id: "minecraft:magenta_wool", buyPrice: 5, sellPrice: 1 },
      { name: "Lana Azul Claro", id: "minecraft:light_blue_wool", buyPrice: 5, sellPrice: 1 },
      { name: "Lana Amarillo", id: "minecraft:yellow_wool", buyPrice: 5, sellPrice: 1 },
      { name: "Lana Lima", id: "minecraft:lime_wool", buyPrice: 5, sellPrice: 1 },
      { name: "Lana Rosa", id: "minecraft:pink_wool", buyPrice: 5, sellPrice: 1 },
      { name: "Lana Gris", id: "minecraft:gray_wool", buyPrice: 5, sellPrice: 1 },
      { name: "Lana Gris Claro", id: "minecraft:light_gray_wool", buyPrice: 5, sellPrice: 1 },
      { name: "Lana Cian", id: "minecraft:cyan_wool", buyPrice: 5, sellPrice: 1 },
      { name: "Lana Morada", id: "minecraft:purple_wool", buyPrice: 5, sellPrice: 1 },
      { name: "Lana Azul", id: "minecraft:blue_wool", buyPrice: 5, sellPrice: 1 },
      { name: "Lana Café", id: "minecraft:brown_wool", buyPrice: 5, sellPrice: 1 },
      { name: "Lana Verde", id: "minecraft:green_wool", buyPrice: 5, sellPrice: 1 },
      { name: "Lana Roja", id: "minecraft:red_wool", buyPrice: 5, sellPrice: 1 },
      { name: "Lana Negra", id: "minecraft:black_wool", buyPrice: 5, sellPrice: 1 },
      { name: "Granito", id: "minecraft:granite", buyPrice: 3, sellPrice: 1 },
      { name: "Granito Pulido", id: "minecraft:polished_granite", buyPrice: 5, sellPrice: 1 },
      { name: "Diorita", id: "minecraft:diorite", buyPrice: 3, sellPrice: 1 },
      { name: "Diorita Pulida", id: "minecraft:polished_diorite", buyPrice: 5, sellPrice: 1 },
      { name: "Andesita", id: "minecraft:andesite", buyPrice: 3, sellPrice: 1 },
      { name: "Andesita Pulido", id: "minecraft:polished_andesite", buyPrice: 5, sellPrice: 1 },
      { name: "Arenisca", id: "minecraft:sandstone", buyPrice: 4, sellPrice: 1 },
      { name: "Bloque de Coral de Tubo", id: "minecraft:tube_coral_block", buyPrice: 40, sellPrice: 8 },
      { name: "Bloque de Coral de Cerebro", id: "minecraft:brain_coral_block", buyPrice: 40, sellPrice: 8 },
      { name: "Bloque de Coral de Burbuja", id: "minecraft:bubble_coral_block", buyPrice: 40, sellPrice: 8 },
      { name: "Ladrillos del Fin", id: "minecraft:end_stone_bricks", buyPrice: 15, sellPrice: 3 },
      { name: "Escalera de Adoquín", id: "minecraft:cobblestone_stairs", buyPrice: 2, sellPrice: 1 },
      { name: "Escalera de Ladrillos de Piedra", id: "minecraft:stone_brick_stairs", buyPrice: 7, sellPrice: 1 },
      { name: "Losa de Ladrillos de Piedra", id: "minecraft:stone_brick_slab", buyPrice: 3, sellPrice: 1 },
      { name: "Escalera de Ladrillos de Pizarra Profunda", id: "minecraft:deepslate_brick_stairs", buyPrice: 9, sellPrice: 1 },
      { name: "Losa de Ladrillos de Pizarra Profunda", id: "minecraft:deepslate_brick_slab", buyPrice: 4, sellPrice: 1 },
      { name: "Escalera de Cuarzo", id: "minecraft:quartz_stairs", buyPrice: 40, sellPrice: 10 },
      { name: "Losa de Cuarzo", id: "minecraft:quartz_slab", buyPrice: 15, sellPrice: 4 },
      { name: "Escalera de Piedra Negra", id: "minecraft:blackstone_stairs", buyPrice: 6, sellPrice: 1 },
      { name: "Losa de Piedra Negra", id: "minecraft:blackstone_slab", buyPrice: 3, sellPrice: 1 },
      { name: "Escalera de Ladrillos del Nether", id: "minecraft:nether_brick_stairs", buyPrice: 12, sellPrice: 2 },
      { name: "Losa de Ladrillos del Nether", id: "minecraft:nether_brick_slab", buyPrice: 6, sellPrice: 1 },
      { name: "Valla de Ladrillos del Nether", id: "minecraft:nether_brick_fence", buyPrice: 8, sellPrice: 1 },
      { name: "Escalera de Ladrillos del Fin", id: "minecraft:end_stone_brick_stairs", buyPrice: 20, sellPrice: 4 },
      { name: "Losa de Ladrillos del Fin", id: "minecraft:end_stone_brick_slab", buyPrice: 10, sellPrice: 2 },
      { name: "Escalera de Púrpura", id: "minecraft:purpur_stairs", buyPrice: 25, sellPrice: 5 },
      { name: "Losa de Púrpura", id: "minecraft:purpur_slab", buyPrice: 12, sellPrice: 2 },
      { name: "Cobre Cortado", id: "minecraft:cut_copper", buyPrice: 20, sellPrice: 4 },
      { name: "Escalera de Cobre Cortado", id: "minecraft:cut_copper_stairs", buyPrice: 25, sellPrice: 5 },
      { name: "Losa de Cobre Cortado", id: "minecraft:cut_copper_slab", buyPrice: 10, sellPrice: 2 },
      { name: "Cobre Cortado Oxidado", id: "minecraft:oxidized_cut_copper", buyPrice: 25, sellPrice: 5 },
      { name: "Escalera de Cobre Cortado Oxidado", id: "minecraft:oxidized_cut_copper_stairs", buyPrice: 30, sellPrice: 6 },
      { name: "Losa de Cobre Cortado Oxidado", id: "minecraft:oxidized_cut_copper_slab", buyPrice: 12, sellPrice: 2 },
      { name: "Escalera de Prismarina", id: "minecraft:prismarine_stairs", buyPrice: 20, sellPrice: 4 },
      { name: "Losa de Prismarina", id: "minecraft:prismarine_slab", buyPrice: 10, sellPrice: 2 },
      { name: "Escalera de Ladrillos de Prismarina", id: "minecraft:prismarine_brick_stairs", buyPrice: 25, sellPrice: 5 },
      { name: "Losa de Ladrillos de Prismarina", id: "minecraft:prismarine_brick_slab", buyPrice: 12, sellPrice: 2 },
      { name: "Escalera de Prismarina Oscura", id: "minecraft:dark_prismarine_stairs", buyPrice: 30, sellPrice: 6 },
      { name: "Losa de Prismarina Oscura", id: "minecraft:dark_prismarine_slab", buyPrice: 15, sellPrice: 3 },
      { name: "Terracota Glaseada Blanca", id: "minecraft:white_glazed_terracotta", buyPrice: 15, sellPrice: 3 },
      { name: "Terracota Glaseada Naranja", id: "minecraft:orange_glazed_terracotta", buyPrice: 15, sellPrice: 3 },
      { name: "Terracota Glaseada Magenta", id: "minecraft:magenta_glazed_terracotta", buyPrice: 15, sellPrice: 3 },
      { name: "Terracota Glaseada Azul Claro", id: "minecraft:light_blue_glazed_terracotta", buyPrice: 15, sellPrice: 3 },
      { name: "Terracota Glaseada Amarilla", id: "minecraft:yellow_glazed_terracotta", buyPrice: 15, sellPrice: 3 },
      { name: "Terracota Glaseada Lima", id: "minecraft:lime_glazed_terracotta", buyPrice: 15, sellPrice: 3 },
      { name: "Terracota Glaseada Rosa", id: "minecraft:pink_glazed_terracotta", buyPrice: 15, sellPrice: 3 },
      { name: "Terracota Glaseada Gris", id: "minecraft:gray_glazed_terracotta", buyPrice: 15, sellPrice: 3 },
      { name: "Terracota Glaseada Gris Claro", id: "minecraft:light_gray_glazed_terracotta", buyPrice: 15, sellPrice: 3 },
      { name: "Terracota Glaseada Cian", id: "minecraft:cyan_glazed_terracotta", buyPrice: 15, sellPrice: 3 },
      { name: "Terracota Glaseada Morada", id: "minecraft:purple_glazed_terracotta", buyPrice: 15, sellPrice: 3 },
      { name: "Terracota Glaseada Azul", id: "minecraft:blue_glazed_terracotta", buyPrice: 15, sellPrice: 3 },
      { name: "Terracota Glaseada Café", id: "minecraft:brown_glazed_terracotta", buyPrice: 15, sellPrice: 3 },
      { name: "Terracota Glaseada Verde", id: "minecraft:green_glazed_terracotta", buyPrice: 15, sellPrice: 3 },
      { name: "Terracota Glaseada Roja", id: "minecraft:red_glazed_terracotta", buyPrice: 15, sellPrice: 3 },
      { name: "Terracota Glaseada Negra", id: "minecraft:black_glazed_terracotta", buyPrice: 15, sellPrice: 3 },
      { name: "Cemento Blanco (Polvo)", id: "minecraft:white_concrete_powder", buyPrice: 6, sellPrice: 1 },
      { name: "Cemento Naranja (Polvo)", id: "minecraft:orange_concrete_powder", buyPrice: 6, sellPrice: 1 },
      { name: "Cemento Magenta (Polvo)", id: "minecraft:magenta_concrete_powder", buyPrice: 6, sellPrice: 1 },
      { name: "Cemento Azul Claro (Polvo)", id: "minecraft:light_blue_concrete_powder", buyPrice: 6, sellPrice: 1 },
      { name: "Cemento Amarillo (Polvo)", id: "minecraft:yellow_concrete_powder", buyPrice: 6, sellPrice: 1 },
      { name: "Cemento Lima (Polvo)", id: "minecraft:lime_concrete_powder", buyPrice: 6, sellPrice: 1 },
      { name: "Cemento Rosa (Polvo)", id: "minecraft:pink_concrete_powder", buyPrice: 6, sellPrice: 1 },
      { name: "Cemento Gris (Polvo)", id: "minecraft:gray_concrete_powder", buyPrice: 6, sellPrice: 1 },
      { name: "Cemento Gris Claro (Polvo)", id: "minecraft:light_gray_concrete_powder", buyPrice: 6, sellPrice: 1 },
      { name: "Cemento Cian (Polvo)", id: "minecraft:cyan_concrete_powder", buyPrice: 6, sellPrice: 1 },
      { name: "Cemento Morado (Polvo)", id: "minecraft:purple_concrete_powder", buyPrice: 6, sellPrice: 1 },
      { name: "Cemento Azul (Polvo)", id: "minecraft:blue_concrete_powder", buyPrice: 6, sellPrice: 1 },
      { name: "Cemento Café (Polvo)", id: "minecraft:brown_concrete_powder", buyPrice: 6, sellPrice: 1 },
      { name: "Cemento Verde (Polvo)", id: "minecraft:green_concrete_powder", buyPrice: 6, sellPrice: 1 },
      { name: "Cemento Rojo (Polvo)", id: "minecraft:red_concrete_powder", buyPrice: 6, sellPrice: 1 },
      { name: "Cemento Negro (Polvo)", id: "minecraft:black_concrete_powder", buyPrice: 6, sellPrice: 1 },
      { name: "Ladrillos de Arcilla Escalera", id: "minecraft:brick_stairs", buyPrice: 10, sellPrice: 2 },
      { name: "Ladrillos de Arcilla Losa", id: "minecraft:brick_slab", buyPrice: 5, sellPrice: 1 },
      { name: "Arenisca Escalera", id: "minecraft:sandstone_stairs", buyPrice: 5, sellPrice: 1 },
      { name: "Arenisca Losa", id: "minecraft:sandstone_slab", buyPrice: 2, sellPrice: 1 },
      { name: "Arenisca Roja", id: "minecraft:red_sandstone", buyPrice: 4, sellPrice: 1 },
      { name: "Arenisca Roja Escalera", id: "minecraft:red_sandstone_stairs", buyPrice: 5, sellPrice: 1 },
      { name: "Arenisca Roja Losa", id: "minecraft:red_sandstone_slab", buyPrice: 2, sellPrice: 1 },
      { name: "Ladrillos de Lodo Escalera", id: "minecraft:mud_brick_stairs", buyPrice: 12, sellPrice: 2 },
      { name: "Ladrillos de Lodo Losa", id: "minecraft:mud_brick_slab", buyPrice: 6, sellPrice: 1 },
      { name: "Ladrillos de Nether Rojos", id: "minecraft:red_nether_brick", buyPrice: 15, sellPrice: 3 },
      { name: "Escalera de Ladrillos del Nether Rojos", id: "minecraft:red_nether_brick_stairs", buyPrice: 20, sellPrice: 4 },
      { name: "Losa de Ladrillos del Nether Rojos", id: "minecraft:red_nether_brick_slab", buyPrice: 10, sellPrice: 2 },
      { name: "Bloque de Cuarzo Cincelado", id: "minecraft:chiseled_quartz_block", buyPrice: 35, sellPrice: 8 },
      { name: "Pilar de Cuarzo", id: "minecraft:quartz_pillar", buyPrice: 35, sellPrice: 8 },
      { name: "Piedra Cincelada (Chiseled Bricks)", id: "minecraft:chiseled_stone_bricks", buyPrice: 8, sellPrice: 1 },
      { name: "Piedra Agrietada (Cracked Bricks)", id: "minecraft:cracked_stone_bricks", buyPrice: 8, sellPrice: 1 }
    ]
  },
  {
    name: "Madera y Derivados",
    items: [
      { name: "Tronco de Roble", id: "minecraft:oak_log", buyPrice: 8, sellPrice: 1 },
      { name: "Tronco de Abedul", id: "minecraft:birch_log", buyPrice: 8, sellPrice: 1 },
      { name: "Tronco de Abeto", id: "minecraft:spruce_log", buyPrice: 8, sellPrice: 1 },
      { name: "Tronco de Jungla", id: "minecraft:jungle_log", buyPrice: 8, sellPrice: 1 },
      { name: "Tronco de Acacia", id: "minecraft:acacia_log", buyPrice: 8, sellPrice: 1 },
      { name: "Tronco de Roble Oscuro", id: "minecraft:dark_oak_log", buyPrice: 9, sellPrice: 1 },
      { name: "Tronco de Manglar", id: "minecraft:mangrove_log", buyPrice: 10, sellPrice: 2 },
      { name: "Tronco de Cerezo", id: "minecraft:cherry_log", buyPrice: 10, sellPrice: 2 },
      { name: "Tallo Distorsionado", id: "minecraft:warped_stem", buyPrice: 15, sellPrice: 3 },
      { name: "Tallo Carmesí", id: "minecraft:crimson_stem", buyPrice: 15, sellPrice: 3 },
      { name: "Tronco Roble Pelado", id: "minecraft:stripped_oak_log", buyPrice: 9, sellPrice: 1 },
      { name: "Tronco Abedul Pelado", id: "minecraft:stripped_birch_log", buyPrice: 9, sellPrice: 1 },
      { name: "Tronco Abeto Pelado", id: "minecraft:stripped_spruce_log", buyPrice: 9, sellPrice: 1 },
      { name: "Tronco Jungla Pelado", id: "minecraft:stripped_jungle_log", buyPrice: 9, sellPrice: 1 },
      { name: "Tronco Acacia Pelado", id: "minecraft:stripped_acacia_log", buyPrice: 9, sellPrice: 1 },
      { name: "Tronco Roble Oscuro Pelado", id: "minecraft:stripped_dark_oak_log", buyPrice: 10, sellPrice: 1 },
      { name: "Tronco Manglar Pelado", id: "minecraft:stripped_mangrove_log", buyPrice: 11, sellPrice: 2 },
      { name: "Tronco Cerezo Pelado", id: "minecraft:stripped_cherry_log", buyPrice: 11, sellPrice: 2 },
      { name: "Tallo Distorsionado Pelado", id: "minecraft:stripped_warped_stem", buyPrice: 16, sellPrice: 3 },
      { name: "Tallo Carmesí Pelado", id: "minecraft:stripped_crimson_stem", buyPrice: 16, sellPrice: 3 },
      { name: "Tablas de Roble", id: "minecraft:oak_planks", buyPrice: 3, sellPrice: 1 },
      { name: "Tablas de Abedul", id: "minecraft:birch_planks", buyPrice: 3, sellPrice: 1 },
      { name: "Tablas de Abeto", id: "minecraft:spruce_planks", buyPrice: 3, sellPrice: 1 },
      { name: "Tablas de Acacia", id: "minecraft:acacia_planks", buyPrice: 3, sellPrice: 1 },
      { name: "Tablas de Roble Oscuro", id: "minecraft:dark_oak_planks", buyPrice: 4, sellPrice: 1 },
      { name: "Tablas de Manglar", id: "minecraft:mangrove_planks", buyPrice: 4, sellPrice: 1 },
      { name: "Tablas de Cerezo", id: "minecraft:cherry_planks", buyPrice: 4, sellPrice: 1 },
      { name: "Tablas Distorsionadas", id: "minecraft:warped_planks", buyPrice: 6, sellPrice: 1 },
      { name: "Tablas Carmesíes", id: "minecraft:crimson_planks", buyPrice: 6, sellPrice: 1 },
      { name: "Bloque de Bambú", id: "minecraft:bamboo_block", buyPrice: 12, sellPrice: 2 },
      { name: "Escalera de Roble", id: "minecraft:oak_stairs", buyPrice: 5, sellPrice: 1 },
      { name: "Losa de Roble", id: "minecraft:oak_slab", buyPrice: 2, sellPrice: 1 },
      { name: "Escalera de Abeto", id: "minecraft:spruce_stairs", buyPrice: 5, sellPrice: 1 },
      { name: "Losa de Abeto", id: "minecraft:spruce_slab", buyPrice: 2, sellPrice: 1 },
      { name: "Escalera de Abedul", id: "minecraft:birch_stairs", buyPrice: 5, sellPrice: 1 },
      { name: "Losa de Abedul", id: "minecraft:birch_slab", buyPrice: 2, sellPrice: 1 },
      { name: "Escalera de Roble Oscuro", id: "minecraft:dark_oak_stairs", buyPrice: 6, sellPrice: 1 },
      { name: "Losa de Roble Oscuro", id: "minecraft:dark_oak_slab", buyPrice: 3, sellPrice: 1 },
      { name: "Escalera de Cerezo", id: "minecraft:cherry_stairs", buyPrice: 6, sellPrice: 1 },
      { name: "Losa de Cerezo", id: "minecraft:cherry_slab", buyPrice: 3, sellPrice: 1 },
      { name: "Escalera de Jungla", id: "minecraft:jungle_stairs", buyPrice: 5, sellPrice: 1 },
      { name: "Losa de Jungla", id: "minecraft:jungle_slab", buyPrice: 2, sellPrice: 1 },
      { name: "Escalera de Acacia", id: "minecraft:acacia_stairs", buyPrice: 5, sellPrice: 1 },
      { name: "Losa de Acacia", id: "minecraft:acacia_slab", buyPrice: 2, sellPrice: 1 },
      { name: "Escalera de Manglar", id: "minecraft:mangrove_stairs", buyPrice: 6, sellPrice: 1 },
      { name: "Losa de Manglar", id: "minecraft:mangrove_slab", buyPrice: 3, sellPrice: 1 },
      { name: "Escalera de Bambú", id: "minecraft:bamboo_stairs", buyPrice: 6, sellPrice: 1 },
      { name: "Losa de Bambú", id: "minecraft:bamboo_slab", buyPrice: 3, sellPrice: 1 },
      { name: "Valla de Roble", id: "minecraft:oak_fence", buyPrice: 4, sellPrice: 1 },
      { name: "Valla de Abedul", id: "minecraft:birch_fence", buyPrice: 4, sellPrice: 1 },
      { name: "Valla de Abeto", id: "minecraft:spruce_fence", buyPrice: 4, sellPrice: 1 },
      { name: "Valla de Roble Oscuro", id: "minecraft:dark_oak_fence", buyPrice: 5, sellPrice: 1 },
      { name: "Valla de Cerezo", id: "minecraft:cherry_fence", buyPrice: 5, sellPrice: 1 },
      { name: "Valla de Jungla", id: "minecraft:jungle_fence", buyPrice: 4, sellPrice: 1 },
      { name: "Valla de Acacia", id: "minecraft:acacia_fence", buyPrice: 4, sellPrice: 1 },
      { name: "Valla de Manglar", id: "minecraft:mangrove_fence", buyPrice: 5, sellPrice: 1 },
      { name: "Puerta de Roble", id: "minecraft:oak_door", buyPrice: 6, sellPrice: 1 },
      { name: "Puerta de Abeto", id: "minecraft:spruce_door", buyPrice: 6, sellPrice: 1 },
      { name: "Puerta de Abedul", id: "minecraft:birch_door", buyPrice: 6, sellPrice: 1 },
      { name: "Puerta de Roble Oscuro", id: "minecraft:dark_oak_door", buyPrice: 7, sellPrice: 1 },
      { name: "Puerta de Cerezo", id: "minecraft:cherry_door", buyPrice: 7, sellPrice: 1 },
      { name: "Trampilla de Roble", id: "minecraft:oak_trapdoor", buyPrice: 6, sellPrice: 1 },
      { name: "Trampilla de Abeto", id: "minecraft:spruce_trapdoor", buyPrice: 6, sellPrice: 1 },
      { name: "Trampilla de Abedul", id: "minecraft:birch_trapdoor", buyPrice: 6, sellPrice: 1 },
      { name: "Trampilla de Roble Oscuro", id: "minecraft:dark_oak_trapdoor", buyPrice: 7, sellPrice: 1 },
      { name: "Trampilla de Cerezo", id: "minecraft:cherry_trapdoor", buyPrice: 7, sellPrice: 1 },
      { name: "Escalera Carmesí", id: "minecraft:crimson_stairs", buyPrice: 8, sellPrice: 1 },
      { name: "Losa Carmesí", id: "minecraft:crimson_slab", buyPrice: 4, sellPrice: 1 },
      { name: "Puerta Carmesí", id: "minecraft:crimson_door", buyPrice: 10, sellPrice: 1 },
      { name: "Trampilla Carmesí", id: "minecraft:crimson_trapdoor", buyPrice: 10, sellPrice: 1 },
      { name: "Escalera Distorsionada", id: "minecraft:warped_stairs", buyPrice: 8, sellPrice: 1 },
      { name: "Losa Distorsionada", id: "minecraft:warped_slab", buyPrice: 4, sellPrice: 1 },
      { name: "Puerta Distorsionada", id: "minecraft:warped_door", buyPrice: 10, sellPrice: 1 },
      { name: "Trampilla Distorsionada", id: "minecraft:warped_trapdoor", buyPrice: 10, sellPrice: 1 }
    ]
  },
  {
    name: "Granja y Supervivencia",
    items: [
      { name: "Cubo", id: "minecraft:bucket", buyPrice: 80, sellPrice: 15 },
      { name: "Cubo de Agua", id: "minecraft:water_bucket", buyPrice: 120, sellPrice: 20 },
      { name: "Cubo de Lava", id: "minecraft:lava_bucket", buyPrice: 180, sellPrice: 30 },
      { name: "Tijeras", id: "minecraft:shears", buyPrice: 50, sellPrice: 10 },
      { name: "Sílex y Acero", id: "minecraft:flint_and_steel", buyPrice: 45, sellPrice: 8 },
      ...BED_VARIANTS,
      { name: "Antorcha", id: "minecraft:torch", buyPrice: 2, sellPrice: 1 },
      { name: "Linterna", id: "minecraft:lantern", buyPrice: 25, sellPrice: 5 },
      { name: "Fogata", id: "minecraft:campfire", buyPrice: 35, sellPrice: 7 },
      { name: "Bloque de Miel", id: "minecraft:honey_block", buyPrice: 70, sellPrice: 14 },
      { name: "Panal de Miel", id: "minecraft:honeycomb", buyPrice: 25, sellPrice: 5 },
      { name: "Harina de Hueso", id: "minecraft:bone_meal", buyPrice: 6, sellPrice: 1 },
      { name: "Tridente", id: "minecraft:trident", buyPrice: 21000, sellPrice: 0 },
      { name: "Escudo", id: "minecraft:shield", buyPrice: 120, sellPrice: 25 },
      { name: "Semillas de Trigo", id: "minecraft:wheat_seeds", buyPrice: 3, sellPrice: 1 },
      { name: "Semillas de Sandía", id: "minecraft:melon_seeds", buyPrice: 4, sellPrice: 1 },
      { name: "Semillas de Calabaza", id: "minecraft:pumpkin_seeds", buyPrice: 4, sellPrice: 1 },
      { name: "Semillas de Remolacha", id: "minecraft:beetroot_seeds", buyPrice: 3, sellPrice: 1 },
      { name: "Brote de Bambú", id: "minecraft:bamboo", buyPrice: 5, sellPrice: 1 },
      { name: "Cactus", id: "minecraft:cactus", buyPrice: 5, sellPrice: 1 },
      { name: "Alga Marina", id: "minecraft:kelp", buyPrice: 3, sellPrice: 1 },
      { name: "Huevo", id: "minecraft:egg", buyPrice: 5, sellPrice: 1 },
      { name: "Leche", id: "minecraft:milk_bucket", buyPrice: 180, sellPrice: 35 },
      { name: "Semillas de Flor de Antorcha", id: "minecraft:torchflower_seeds", buyPrice: 200, sellPrice: 40 },
      { name: "Lirio de los Valles (Lily Pad)", id: "minecraft:waterlily", buyPrice: 15, sellPrice: 3 },
      { name: "Enredaderas", id: "minecraft:vine", buyPrice: 8, sellPrice: 1 },
      { name: "Pepinillo de Mar (Sea Pickle)", id: "minecraft:sea_pickle", buyPrice: 15, sellPrice: 3 },
      { name: "Hierba Marina (Seagrass)", id: "minecraft:seagrass", buyPrice: 5, sellPrice: 1 }
    ]
  },
  {
    name: "Armas y Herramientas",
    items: [
      { name: "Espada de Hierro", id: "minecraft:iron_sword", buyPrice: 60, sellPrice: 10 },
      { name: "Pico de Hierro", id: "minecraft:iron_pickaxe", buyPrice: 80, sellPrice: 15 },
      { name: "Hacha de Hierro", id: "minecraft:iron_axe", buyPrice: 80, sellPrice: 15 },
      { name: "Pala de Hierro", id: "minecraft:iron_shovel", buyPrice: 40, sellPrice: 8 },
      { name: "Espada de Diamante", id: "minecraft:diamond_sword", buyPrice: 450, sellPrice: 90 },
      { name: "Pico de Diamante", id: "minecraft:diamond_pickaxe", buyPrice: 600, sellPrice: 120 },
      { name: "Hacha de Diamante", id: "minecraft:diamond_axe", buyPrice: 600, sellPrice: 120 },
      { name: "Pala de Diamante", id: "minecraft:diamond_shovel", buyPrice: 300, sellPrice: 60 },
      { name: "Espada de Netherita", id: "minecraft:netherite_sword", buyPrice: 3800, sellPrice: 800 },
      { name: "Pico de Netherita", id: "minecraft:netherite_pickaxe", buyPrice: 4200, sellPrice: 900 },
      { name: "Arco", id: "minecraft:bow", buyPrice: 80, sellPrice: 15 },
      { name: "Ballesta", id: "minecraft:crossbow", buyPrice: 120, sellPrice: 20 },
      { name: "Flecha", id: "minecraft:arrow", buyPrice: 2, sellPrice: 1 }
    ]
  },
  {
    name: "Armaduras",
    items: [
      { name: "Casco de Hierro", id: "minecraft:iron_helmet", buyPrice: 120, sellPrice: 20 },
      { name: "Pechera de Hierro", id: "minecraft:iron_chestplate", buyPrice: 180, sellPrice: 30 },
      { name: "Grebas de Hierro", id: "minecraft:iron_leggings", buyPrice: 160, sellPrice: 25 },
      { name: "Botas de Hierro", id: "minecraft:iron_boots", buyPrice: 100, sellPrice: 15 },
      { name: "Casco de Diamante", id: "minecraft:diamond_helmet", buyPrice: 900, sellPrice: 180 },
      { name: "Pechera de Diamante", id: "minecraft:diamond_chestplate", buyPrice: 1400, sellPrice: 280 },
      { name: "Grebas de Diamante", id: "minecraft:diamond_leggings", buyPrice: 1200, sellPrice: 240 },
      { name: "Botas de Diamante", id: "minecraft:diamond_boots", buyPrice: 800, sellPrice: 160 },
      { name: "Casco de Netherita", id: "minecraft:netherite_helmet", buyPrice: 4500, sellPrice: 900 },
      { name: "Pechera de Netherita", id: "minecraft:netherite_chestplate", buyPrice: 6500, sellPrice: 1300 },
      { name: "Grebas de Netherita", id: "minecraft:netherite_leggings", buyPrice: 5500, sellPrice: 1100 },
      { name: "Botas de Netherita", id: "minecraft:netherite_boots", buyPrice: 4000, sellPrice: 800 },
      { name: "Casco de Cota de Malla", id: "minecraft:chainmail_helmet", buyPrice: 250, sellPrice: 50 },
      { name: "Pechera de Cota de Malla", id: "minecraft:chainmail_chestplate", buyPrice: 400, sellPrice: 80 },
      { name: "Grebas de Cota de Malla", id: "minecraft:chainmail_leggings", buyPrice: 350, sellPrice: 70 },
      { name: "Botas de Cota de Malla", id: "minecraft:chainmail_boots", buyPrice: 200, sellPrice: 40 }
    ]
  },
  {
    name: "Menas y Minerales",
    items: [
      { name: "Mena de Hierro", id: "minecraft:iron_ore", buyPrice: 30, sellPrice: 6 },
      { name: "Mena de Hierro Profunda", id: "minecraft:deepslate_iron_ore", buyPrice: 35, sellPrice: 7 },
      { name: "Mena de Oro", id: "minecraft:gold_ore", buyPrice: 50, sellPrice: 10 },
      { name: "Mena de Oro Profunda", id: "minecraft:deepslate_gold_ore", buyPrice: 55, sellPrice: 11 },
      { name: "Mena de Diamante", id: "minecraft:diamond_ore", buyPrice: 200, sellPrice: 40 },
      { name: "Mena de Diamante Profunda", id: "minecraft:deepslate_diamond_ore", buyPrice: 220, sellPrice: 45 },
      { name: "Mena de Esmeralda", id: "minecraft:emerald_ore", buyPrice: 150, sellPrice: 30 },
      { name: "Mena de Esmeralda Profunda", id: "minecraft:deepslate_emerald_ore", buyPrice: 160, sellPrice: 35 },
      { name: "Mena de Carbón", id: "minecraft:coal_ore", buyPrice: 15, sellPrice: 3 },
      { name: "Mena de Cobre", id: "minecraft:copper_ore", buyPrice: 15, sellPrice: 3 },
      { name: "Mena de Redstone", id: "minecraft:redstone_ore", buyPrice: 20, sellPrice: 4 },
      { name: "Mena de Lapislázuli", id: "minecraft:lapis_ore", buyPrice: 25, sellPrice: 5 }
    ]
  },
  {
    name: "Tintes y Flores",
    items: [
      { name: "Tinte Rojo", id: "minecraft:red_dye", buyPrice: 4, sellPrice: 1 },
      { name: "Tinte Verde", id: "minecraft:green_dye", buyPrice: 4, sellPrice: 1 },
      { name: "Tinte Blanco (Polvo de Hueso)", id: "minecraft:white_dye", buyPrice: 4, sellPrice: 1 },
      { name: "Tinte Negro", id: "minecraft:black_dye", buyPrice: 4, sellPrice: 1 },
      { name: "Tinte Azul", id: "minecraft:blue_dye", buyPrice: 4, sellPrice: 1 },
      { name: "Tinte Amarillo", id: "minecraft:yellow_dye", buyPrice: 4, sellPrice: 1 },
      { name: "Tinte Naranja", id: "minecraft:orange_dye", buyPrice: 4, sellPrice: 1 },
      { name: "Tinte Lima", id: "minecraft:lime_dye", buyPrice: 4, sellPrice: 1 },
      { name: "Tinte Gris", id: "minecraft:gray_dye", buyPrice: 4, sellPrice: 1 },
      { name: "Tinte Gris Claro", id: "minecraft:light_gray_dye", buyPrice: 4, sellPrice: 1 },
      { name: "Tinte Cian", id: "minecraft:cyan_dye", buyPrice: 4, sellPrice: 1 },
      { name: "Tinte Morado", id: "minecraft:purple_dye", buyPrice: 4, sellPrice: 1 },
      { name: "Tinte Magenta", id: "minecraft:magenta_dye", buyPrice: 4, sellPrice: 1 },
      { name: "Tinte Rosa", id: "minecraft:pink_dye", buyPrice: 4, sellPrice: 1 },
      { name: "Girasol", id: "minecraft:sunflower", buyPrice: 12, sellPrice: 2 },
      { name: "Rosal", id: "minecraft:rose_bush", buyPrice: 12, sellPrice: 2 },
      { name: "Rosa del Wither", id: "minecraft:wither_rose", buyPrice: 150, sellPrice: 35 },
      { name: "Lila", id: "minecraft:lilac", buyPrice: 12, sellPrice: 2 },
      { name: "Peonía", id: "minecraft:peony", buyPrice: 12, sellPrice: 2 }
    ]
  },
  {
    name: "Discos de Música",
    items: [
      { name: "Disco de Música - 13", id: "minecraft:music_disc_13", buyPrice: 1500, sellPrice: 300 },
      { name: "Disco de Música - Cat", id: "minecraft:music_disc_cat", buyPrice: 1500, sellPrice: 300 },
      { name: "Disco de Música - Blocks", id: "minecraft:music_disc_blocks", buyPrice: 1500, sellPrice: 300 },
      { name: "Disco de Música - Chirp", id: "minecraft:music_disc_chirp", buyPrice: 1500, sellPrice: 300 },
      { name: "Disco de Música - Far", id: "minecraft:music_disc_far", buyPrice: 1500, sellPrice: 300 },
      { name: "Disco de Música - Mall", id: "minecraft:music_disc_mall", buyPrice: 1500, sellPrice: 300 },
      { name: "Disco de Música - Mellohi", id: "minecraft:music_disc_mellohi", buyPrice: 1500, sellPrice: 300 },
      { name: "Disco de Música - Stal", id: "minecraft:music_disc_stal", buyPrice: 1500, sellPrice: 300 },
      { name: "Disco de Música - Strad", id: "minecraft:music_disc_strad", buyPrice: 1500, sellPrice: 300 },
      { name: "Disco de Música - Ward", id: "minecraft:music_disc_ward", buyPrice: 1500, sellPrice: 300 },
      { name: "Disco de Música - 11", id: "minecraft:music_disc_11", buyPrice: 1500, sellPrice: 300 },
      { name: "Disco de Música - Wait", id: "minecraft:music_disc_wait", buyPrice: 1500, sellPrice: 300 },
      { name: "Disco de Música - Pigstep", id: "minecraft:music_disc_pigstep", buyPrice: 6000, sellPrice: 1500 },
      { name: "Disco de Música - Otherside", id: "minecraft:music_disc_otherside", buyPrice: 4500, sellPrice: 1000 },
      { name: "Disco de Música - 5", id: "minecraft:music_disc_5", buyPrice: 4500, sellPrice: 1000 }
    ]
  },
  {
    name: "Diseños de Armadura (Trims)",
    items: [
      { name: "Plantilla Trim - Centinela", id: "minecraft:sentry_armor_trim_smithing_template", buyPrice: 5000, sellPrice: 1000 },
      { name: "Plantilla Trim - Vex", id: "minecraft:vex_armor_trim_smithing_template", buyPrice: 6000, sellPrice: 1200 },
      { name: "Plantilla Trim - Salvaje", id: "minecraft:wild_armor_trim_smithing_template", buyPrice: 6000, sellPrice: 1200 },
      { name: "Plantilla Trim - Costa", id: "minecraft:coast_armor_trim_smithing_template", buyPrice: 5000, sellPrice: 1000 },
      { name: "Plantilla Trim - Duna", id: "minecraft:dune_armor_trim_smithing_template", buyPrice: 5000, sellPrice: 1000 },
      { name: "Plantilla Trim - Guardián", id: "minecraft:ward_armor_trim_smithing_template", buyPrice: 9500, sellPrice: 2000 },
      { name: "Plantilla Trim - Silencio (Ultra Raro)", id: "minecraft:silence_armor_trim_smithing_template", buyPrice: 38000, sellPrice: 8000 },
      { name: "Plantilla Trim - Marea", id: "minecraft:tide_armor_trim_smithing_template", buyPrice: 7000, sellPrice: 1500 },
      { name: "Plantilla Trim - Hocico", id: "minecraft:snout_armor_trim_smithing_template", buyPrice: 6500, sellPrice: 1400 },
      { name: "Plantilla Trim - Costilla", id: "minecraft:rib_armor_trim_smithing_template", buyPrice: 8000, sellPrice: 1600 },
      { name: "Plantilla Trim - Ojo", id: "minecraft:eye_armor_trim_smithing_template", buyPrice: 8000, sellPrice: 1600 },
      { name: "Plantilla Trim - Aguja", id: "minecraft:spire_armor_trim_smithing_template", buyPrice: 9500, sellPrice: 2000 }
    ]
  },
  {
    name: "Libros Encantados",
    enchantments: [
      { name: "Remiendo (Mending) I", id: "mending", level: 1, buyPrice: 12000 },
      { name: "Afilado (Sharpness) V", id: "sharpness", level: 5, buyPrice: 9500 },
      { name: "Afilado (Sharpness) III", id: "sharpness", level: 3, buyPrice: 2500 },
      { name: "Protección (Protection) IV", id: "protection", level: 4, buyPrice: 8500 },
      { name: "Protección (Protection) II", id: "protection", level: 2, buyPrice: 2000 },
      { name: "Irrompibilidad (Unbreaking) III", id: "unbreaking", level: 3, buyPrice: 5000 },
      { name: "Eficiencia (Efficiency) V", id: "efficiency", level: 5, buyPrice: 7500 },
      { name: "Eficiencia (Efficiency) III", id: "efficiency", level: 3, buyPrice: 2000 },
      { name: "Fortuna (Fortune) III", id: "fortune", level: 3, buyPrice: 6500 },
      { name: "Saqueo (Looting) III", id: "looting", level: 3, buyPrice: 7000 },
      { name: "Toque de Seda (Silk Touch) I", id: "silk_touch", level: 1, buyPrice: 5500 },
      { name: "Poder (Power) V", id: "power", level: 5, buyPrice: 8000 },
      { name: "Infinito (Infinity) I", id: "infinity", level: 1, buyPrice: 9000 },
      { name: "Caída de Pluma (Feather Falling) IV", id: "feather_falling", level: 4, buyPrice: 6000 },
      { name: "Aspecto Ígneo (Fire Aspect) II", id: "fire_aspect", level: 2, buyPrice: 5000 },
      { name: "Llama (Flame) I", id: "flame", level: 1, buyPrice: 4500 },
      { name: "Conductividad (Channeling) I", id: "channeling", level: 1, buyPrice: 4500 },
      { name: "Lealtad (Loyalty) III", id: "loyalty", level: 3, buyPrice: 5000 },
      { name: "Propulsión Acuática (Riptide) III", id: "riptide", level: 3, buyPrice: 6500 },
      { name: "Disparo Múltiple (Multishot) I", id: "multishot", level: 1, buyPrice: 5000 },
      { name: "Perforación (Piercing) IV", id: "piercing", level: 4, buyPrice: 4000 },
      { name: "Paso Helado (Frost Walker) II", id: "frost_walker", level: 2, buyPrice: 4500 },
      { name: "Respiración (Respiration) III", id: "respiration", level: 3, buyPrice: 4000 },
      { name: "Agilidad Acuática (Aqua Affinity) I", id: "aqua_affinity", level: 1, buyPrice: 3500 },
      { name: "Velocidad de Alma (Soul Speed) III", id: "soul_speed", level: 3, buyPrice: 6000 },
      { name: "Sigilo Rápido (Swift Sneak) III", id: "swift_sneak", level: 3, buyPrice: 7500 },
      { name: "Atracción (Lure) III", id: "lure", level: 3, buyPrice: 3500 },
      { name: "Suerte del Mar III", id: "luck_of_the_sea", level: 3, buyPrice: 4000 }
    ]
  }
];

// Catálogo adicional: únicamente objetos vanilla obtenibles en supervivencia.
// Estas entradas son de compra; no se añaden a la recompra para no alterar la economía.
const SURVIVAL_CATALOG_EXPANSION = [
  {
    name: "Construcción ampliada",
    price: 8,
    items: [
      "bamboo_mosaic,bamboo_mosaic_slab,bamboo_mosaic_stairs,bamboo_door,bamboo_trapdoor,bamboo_fence,bamboo_fence_gate",
      "pale_oak_log,pale_oak_wood,stripped_pale_oak_log,stripped_pale_oak_wood,pale_oak_planks,pale_oak_stairs,pale_oak_slab,pale_oak_door,pale_oak_trapdoor,pale_oak_fence,pale_oak_fence_gate,pale_oak_button,pale_oak_pressure_plate,pale_oak_sign,pale_oak_hanging_sign,pale_oak_leaves,pale_oak_sapling",
      "mangrove_wood,stripped_mangrove_log,stripped_mangrove_wood,mangrove_planks,mangrove_door,mangrove_trapdoor,mangrove_fence,mangrove_fence_gate,mangrove_button,mangrove_pressure_plate,mangrove_sign,mangrove_hanging_sign,mangrove_roots,muddy_mangrove_roots,mangrove_propagule",
      "cherry_wood,stripped_cherry_log,stripped_cherry_wood,cherry_planks,cherry_door,cherry_trapdoor,cherry_fence,cherry_fence_gate,cherry_button,cherry_pressure_plate,cherry_sign,cherry_hanging_sign,cherry_sapling",
      "crimson_planks,crimson_fence,crimson_fence_gate,crimson_button,crimson_pressure_plate,crimson_sign,crimson_hanging_sign,warped_planks,warped_fence,warped_fence_gate,warped_button,warped_pressure_plate,warped_sign,warped_hanging_sign",
      "cobblestone_wall,mossy_cobblestone_wall,granite_wall,diorite_wall,andesite_wall,sandstone_wall,red_sandstone_wall,stone_brick_wall,mossy_stone_brick_wall,brick_wall,nether_brick_wall,red_nether_brick_wall,end_stone_brick_wall,prismarine_wall,blackstone_wall,polished_blackstone_wall,polished_blackstone_brick_wall,cobbled_deepslate_wall,deepslate_tile_wall,polished_deepslate_wall,deepslate_brick_wall,tuff_wall,tuff_brick_wall,polished_tuff_wall,mud_brick_wall,resin_brick_wall",
      "smooth_sandstone,smooth_red_sandstone,cut_sandstone,cut_red_sandstone,chiseled_sandstone,chiseled_red_sandstone,smooth_quartz,quartz_bricks,chiseled_deepslate,cracked_deepslate_bricks,cracked_deepslate_tiles,polished_blackstone_brick_stairs,polished_blackstone_brick_slab,polished_blackstone_button,polished_blackstone_pressure_plate",
      "exposed_copper,weathered_copper,oxidized_copper,waxed_copper_block,waxed_exposed_copper,waxed_weathered_copper,waxed_oxidized_copper,exposed_cut_copper,weathered_cut_copper,waxed_cut_copper,waxed_exposed_cut_copper,waxed_weathered_cut_copper,waxed_oxidized_cut_copper,exposed_cut_copper_stairs,weathered_cut_copper_stairs,waxed_cut_copper_stairs,waxed_exposed_cut_copper_stairs,waxed_weathered_cut_copper_stairs,waxed_oxidized_cut_copper_stairs,exposed_cut_copper_slab,weathered_cut_copper_slab,waxed_cut_copper_slab,waxed_exposed_cut_copper_slab,waxed_weathered_cut_copper_slab,waxed_oxidized_cut_copper_slab",
      "resin_block,resin_bricks,resin_brick_stairs,resin_brick_slab,resin_brick_wall,chiseled_resin_bricks,creaking_heart"
    ].join(",")
  },
  {
    name: "Decoración y naturaleza",
    price: 12,
    items: [
      "dandelion,poppy,blue_orchid,allium,azure_bluet,red_tulip,orange_tulip,white_tulip,pink_tulip,oxeye_daisy,cornflower,lily_of_the_valley,torchflower,closed_eyeblossom,open_eyeblossom,wildflowers,leaf_litter,short_grass,tall_grass,fern,large_fern,dead_bush,azalea,flowering_azalea,azalea_leaves,flowering_azalea_leaves,small_dripleaf,big_dripleaf,small_amethyst_bud,medium_amethyst_bud,large_amethyst_bud,amethyst_cluster",
      "tube_coral,brain_coral,bubble_coral,fire_coral,horn_coral,tube_coral_fan,brain_coral_fan,bubble_coral_fan,fire_coral_fan,horn_coral_fan,dead_tube_coral,dead_brain_coral,dead_bubble_coral,dead_fire_coral,dead_horn_coral,dead_tube_coral_fan,dead_brain_coral_fan,dead_bubble_coral_fan,dead_fire_coral_fan,dead_horn_coral_fan",
      "painting,item_frame,glow_item_frame,armor_stand,flower_pot,decorated_pot,torch,soul_torch,redstone_torch,soul_lantern,end_rod,candle,white_candle,orange_candle,magenta_candle,light_blue_candle,yellow_candle,lime_candle,pink_candle,gray_candle,light_gray_candle,cyan_candle,purple_candle,blue_candle,brown_candle,green_candle,red_candle,black_candle",
      "white_carpet,orange_carpet,magenta_carpet,light_blue_carpet,yellow_carpet,lime_carpet,pink_carpet,gray_carpet,light_gray_carpet,cyan_carpet,purple_carpet,blue_carpet,brown_carpet,green_carpet,red_carpet,black_carpet,white_bed,orange_bed,magenta_bed,light_blue_bed,yellow_bed,lime_bed,pink_bed,gray_bed,light_gray_bed,cyan_bed,purple_bed,blue_bed,brown_bed,green_bed,red_bed,black_bed"
    ].join(",")
  },
  {
    name: "Equipo de Supervivencia",
    price: 45,
    items: [
      "wooden_sword,wooden_pickaxe,wooden_axe,wooden_shovel,wooden_hoe,stone_sword,stone_pickaxe,stone_axe,stone_shovel,stone_hoe,golden_sword,golden_pickaxe,golden_axe,golden_shovel,golden_hoe,iron_hoe,diamond_hoe,netherite_axe,netherite_shovel,netherite_hoe",
      "leather_helmet,leather_chestplate,leather_leggings,leather_boots,golden_helmet,golden_chestplate,golden_leggings,golden_boots,turtle_helmet,chainmail_helmet,chainmail_chestplate,chainmail_leggings,chainmail_boots",
      "mace,brush,carrot_on_a_stick,warped_fungus_on_a_stick,lead,name_tag,saddle,horse_armor_leather,iron_horse_armor,golden_horse_armor,diamond_horse_armor,elytra,totem_of_undying,shield,snowball,egg,fire_charge,shield"
    ].join(",")
  },
  {
    name: "Granja, fauna y botín",
    price: 15,
    items: [
      "beef,porkchop,chicken,rabbit,mutton,cod,salmon,tropical_fish,pufferfish,rotten_flesh,spider_eye,rabbit_hide,rabbit_foot,scute,armadillo_scute,nautilus_shell,ink_sac,glow_ink_sac,phantom_membrane,shulker_shell,blaze_rod,ghast_tear,ender_pearl,prismarine_shard,prismarine_crystals",
      "cocoa_beans,nether_wart,chorus_flower,chorus_fruit,beetroot_seeds,pitcher_pod,pitcher_plant,sniffer_egg,torchflower_seeds,glow_berries,sweet_berries,brown_mushroom,red_mushroom,crimson_fungus,warped_fungus,crimson_roots,warped_roots,nether_sprouts,weeping_vines,twisting_vines",
      "honeycomb,honey_bottle,slime_ball,magma_cream,feather,leather,string,bone,gunpowder,flint,clay_ball,heart_of_the_sea,echo_shard,disc_fragment_5,trial_key,ominous_trial_key,heavy_core,wind_charge,breeze_rod"
    ].join(",")
  },
  {
    name: "Redstone ampliada",
    price: 25,
    items: [
      "lever,stone_button,oak_button,spruce_button,birch_button,jungle_button,acacia_button,dark_oak_button,mangrove_button,cherry_button,bamboo_button,crimson_button,warped_button,polished_blackstone_button,stone_pressure_plate,light_weighted_pressure_plate,heavy_weighted_pressure_plate,oak_pressure_plate,spruce_pressure_plate,birch_pressure_plate,jungle_pressure_plate,acacia_pressure_plate,dark_oak_pressure_plate,mangrove_pressure_plate,cherry_pressure_plate,bamboo_pressure_plate,crimson_pressure_plate,warped_pressure_plate,polished_blackstone_pressure_plate",
      "dropper,dispenser,observer,piston,sticky_piston,hopper,comparator,repeater,daylight_detector,target,tripwire_hook,redstone_lamp,note_block,jukebox,lightning_rod,sculk_sensor,calibrated_sculk_sensor,crafter,iron_door,iron_trapdoor"
    ].join(",")
  }
];

const CATALOG_SPANISH_TERMS = {
  acacia: "Acacia", allium: "Allium", amethyst: "Amatista", andesite: "Andesita",
  anvil: "Yunque", armor: "Armadura", arrow: "Flecha", azalea: "Azalea",
  bamboo: "Bambú", banner: "Estandarte", barrel: "Barril", basalt: "Basalto",
  bee: "Abeja", beef: "Carne de Vaca", bell: "Campana", birch: "Abedul",
  black: "Negro", blackstone: "Piedra Negra", blast: "Alto Horno", blue: "Azul",
  boat: "Bote", bone: "Hueso", book: "Libro", bookshelf: "Librería", brick: "Ladrillo",
  brown: "Marrón", brush: "Cepillo", bundle: "Fardo", button: "Botón",
  candle: "Vela", carpet: "Alfombra", carrot: "Zanahoria", chain: "Cadena", chest: "Cofre",
  chiseled: "Cincelado", cherry: "Cerezo", chicken: "Pollo", chiseled: "Cincelado",
  clay: "Arcilla", coal: "Carbón", coast: "Costa", cobbled: "Empedrada", cobblestone: "Adoquín",
  cod: "Bacalao", comparator: "Comparador", composter: "Compostador", conduit: "Conducto",
  concrete: "Concreto", copper: "Cobre", coral: "Coral", crimson: "Carmesí", cut: "Cortado",
  cyan: "Cian", dark: "Oscuro", daylight: "Luz Solar", dead: "Muerto", deepslate: "Pizarra Profunda",
  detector: "Detector", diamond: "Diamante", diorite: "Diorita", dirt: "Tierra", disc: "Disco",
  dispenser: "Dispensador", door: "Puerta", double: "Doble", dragon: "Dragón", dripstone: "Goteo",
  dye: "Tinte", echo: "Eco", egg: "Huevo", emerald: "Esmeralda", end: "Fin", ender: "Ender",
  exposed: "Expuesto", fence: "Valla", fern: "Helecho", fire: "Fuego", fishing: "Pesca",
  flint: "Pedernal", flower: "Flor", frame: "Marco", furnace: "Horno", gate: "Portón",
  glass: "Cristal", glazed: "Esmaltada", glow: "Brillante", gold: "Oro", golden: "Dorado",
  granite: "Granito", grass: "Hierba", gray: "Gris", green: "Verde", hanging: "Colgante",
  harness: "Arnés", helmet: "Casco", hoe: "Azada", honey: "Miel", horn: "Cuerno", horse: "Caballo",
  ice: "Hielo", ingot: "Lingote", iron: "Hierro", item: "Objeto", jungle: "Jungla", kelp: "Alga",
  lantern: "Linterna", lapis: "Lapislázuli", lava: "Lava", lead: "Correa", leaves: "Hojas",
  leggings: "Grebas", light: "Ligero", lime: "Lima", log: "Tronco", magenta: "Magenta",
  mangrove: "Manglar", map: "Mapa", masonry: "Mampostería", minecart: "Vagoneta", moss: "Musgo",
  mud: "Lodo", mushroom: "Champiñón", music: "Música", nautilus: "Nautilo", nether: "Nether",
  netherite: "Netherita", oak: "Roble", obsidian: "Obsidiana", ochre: "Ocre", ominous: "Ominoso",
  orange: "Naranja", oxidized: "Oxidado", packed: "Compacto", pale: "Pálido", pane: "Panel",
  paper: "Papel", pearl: "Perla", pickaxe: "Pico", pink: "Rosa", plank: "Tablón", planks: "Tablones",
  polished: "Pulido", potion: "Poción", powder: "Polvo", pressure: "Presión", prismarine: "Prismarina",
  pufferfish: "Pez Globo", purple: "Morado", quartz: "Cuarzo", rail: "Riel", red: "Rojo",
  redstone: "Redstone", repeater: "Repetidor", resin: "Resina", rotten: "Podrida", saddle: "Silla",
  salmon: "Salmón", sandstone: "Arenisca", sapling: "Brote", sculk: "Sculk", sea: "Mar",
  shears: "Tijeras", shelf: "Estante", sherd: "Fragmento de Cerámica", shield: "Escudo",
  shovel: "Pala", shulker: "Shulker", sign: "Cartel", slab: "Losa", slime: "Slime",
  smooth: "Lisa", soul: "Alma", spear: "Lanza", spider: "Araña", stairs: "Escaleras",
  stone: "Piedra", stripped: "Pelado", sugar: "Azúcar", sword: "Espada", terracotta: "Terracota",
  tile: "Baldosa", torch: "Antorcha", trapdoor: "Trampilla", trial: "Prueba", trim: "Adorno",
  tuff: "Toba", turtle: "Tortuga", underwater: "Submarino", vine: "Enredadera", wall: "Muro",
  warped: "Distorsionado", water: "Agua", waxed: "Encerado", weathered: "Envejecido", wheat: "Trigo",
  white: "Blanco", wild: "Salvaje", wind: "Viento", wood: "Madera", wool: "Lana", yellow: "Amarillo"
};

function catalogDisplayName(id) {
  return id.split("_").map(word => CATALOG_SPANISH_TERMS[word] ?? (word.charAt(0).toUpperCase() + word.slice(1))).join(" ");
}

const registeredCatalogIds = new Set();
for (const category of CATEGORIES) {
  for (const item of category.items ?? []) registeredCatalogIds.add(item.id);
}
for (const section of SURVIVAL_CATALOG_EXPANSION) {
  const items = [];
  for (const id of section.items.split(",")) {
    const typeId = `minecraft:${id}`;
    if (!registeredCatalogIds.has(typeId)) {
      items.push({ name: catalogDisplayName(id), id: typeId, buyPrice: section.price, sellPrice: 0 });
      registeredCatalogIds.add(typeId);
    }
  }
  if (items.length) CATEGORIES.push({ name: section.name, items });
}

// Cobertura final del catálogo vanilla. La fuente local también contiene
// entradas creativas/técnicas; esas se excluyen arriba antes de llegar aquí.
// La validación con ItemStack evita mostrar identificadores no presentes en
// esta compilación concreta de BDS.
const SURVIVAL_CATALOG_REMAINDER = "minecraft:acacia_boat,minecraft:acacia_button,minecraft:acacia_chest_boat,minecraft:acacia_door,minecraft:acacia_fence_gate,minecraft:acacia_hanging_sign,minecraft:acacia_pressure_plate,minecraft:acacia_sapling,minecraft:acacia_shelf,minecraft:acacia_sign,minecraft:acacia_trapdoor,minecraft:acacia_wood,minecraft:allium,minecraft:amethyst_block,minecraft:amethyst_cluster,minecraft:ancient_debris,minecraft:andesite_slab,minecraft:andesite_stairs,minecraft:andesite_wall,minecraft:angler_pottery_sherd,minecraft:archer_pottery_sherd,minecraft:armadillo_scute,minecraft:armor_stand,minecraft:arms_up_pottery_sherd,minecraft:axolotl_bucket,minecraft:azalea,minecraft:azalea_leaves,minecraft:azalea_leaves_flowered,minecraft:azure_bluet,minecraft:bamboo_button,minecraft:bamboo_chest_raft,minecraft:bamboo_door,minecraft:bamboo_fence,minecraft:bamboo_fence_gate,minecraft:bamboo_hanging_sign,minecraft:bamboo_mosaic,minecraft:bamboo_mosaic_slab,minecraft:bamboo_mosaic_stairs,minecraft:bamboo_planks,minecraft:bamboo_pressure_plate,minecraft:bamboo_raft,minecraft:bamboo_shelf,minecraft:bamboo_sign,minecraft:bamboo_trapdoor,minecraft:barrel,minecraft:bed,minecraft:bee_nest,minecraft:beef,minecraft:beehive,minecraft:beetroot_soup,minecraft:bell,minecraft:big_dripleaf,minecraft:birch_boat,minecraft:birch_button,minecraft:birch_chest_boat,minecraft:birch_fence_gate,minecraft:birch_hanging_sign,minecraft:birch_pressure_plate,minecraft:birch_sapling,minecraft:birch_shelf,minecraft:birch_sign,minecraft:birch_wood,minecraft:black_bundle,minecraft:black_candle,minecraft:black_carpet,minecraft:black_harness,minecraft:blackstone_wall,minecraft:blade_pottery_sherd,minecraft:blast_furnace,minecraft:blue_bundle,minecraft:blue_candle,minecraft:blue_carpet,minecraft:blue_egg,minecraft:blue_harness,minecraft:blue_orchid,minecraft:bolt_armor_trim_smithing_template,minecraft:book,minecraft:bookshelf,minecraft:bordure_indented_banner_pattern,minecraft:bowl,minecraft:brain_coral,minecraft:brain_coral_fan,minecraft:breeze_rod,minecraft:brewer_pottery_sherd,minecraft:brick_wall,minecraft:brown_bundle,minecraft:brown_candle,minecraft:brown_carpet,minecraft:brown_dye,minecraft:brown_egg,minecraft:brown_harness,minecraft:brown_mushroom,minecraft:brown_mushroom_block,minecraft:brush,minecraft:bubble_coral,minecraft:bubble_coral_fan,minecraft:bundle,minecraft:burn_pottery_sherd,minecraft:bush,minecraft:cactus_flower,minecraft:calibrated_sculk_sensor,minecraft:candle,minecraft:carrot_on_a_stick,minecraft:carved_pumpkin,minecraft:cherry_boat,minecraft:cherry_button,minecraft:cherry_chest_boat,minecraft:cherry_fence_gate,minecraft:cherry_hanging_sign,minecraft:cherry_pressure_plate,minecraft:cherry_sapling,minecraft:cherry_shelf,minecraft:cherry_sign,minecraft:cherry_wood,minecraft:chest,minecraft:chicken,minecraft:chipped_anvil,minecraft:chiseled_bookshelf,minecraft:chiseled_copper,minecraft:chiseled_deepslate,minecraft:chiseled_nether_bricks,minecraft:chiseled_polished_blackstone,minecraft:chiseled_red_sandstone,minecraft:chiseled_resin_bricks,minecraft:chiseled_sandstone,minecraft:chiseled_tuff,minecraft:chiseled_tuff_bricks,minecraft:chorus_flower,minecraft:clay,minecraft:closed_eyeblossom,minecraft:coal_block,minecraft:coarse_dirt,minecraft:cobbled_deepslate,minecraft:cobbled_deepslate_slab,minecraft:cobbled_deepslate_stairs,minecraft:cobbled_deepslate_wall,minecraft:cobblestone_wall,minecraft:cocoa_beans,minecraft:cod,minecraft:cod_bucket,minecraft:composter,minecraft:conduit,minecraft:cooked_mutton,minecraft:cooked_rabbit,minecraft:copper_axe,minecraft:copper_bars,minecraft:copper_block,minecraft:copper_boots,minecraft:copper_bulb,minecraft:copper_chain,minecraft:copper_chest,minecraft:copper_chestplate,minecraft:copper_door,minecraft:copper_golem_statue,minecraft:copper_grate,minecraft:copper_helmet,minecraft:copper_hoe,minecraft:copper_horse_armor,minecraft:copper_lantern,minecraft:copper_leggings,minecraft:copper_nautilus_armor,minecraft:copper_nugget,minecraft:copper_pickaxe,minecraft:copper_shovel,minecraft:copper_spear,minecraft:copper_sword,minecraft:copper_torch,minecraft:copper_trapdoor,minecraft:cornflower,minecraft:cracked_deepslate_bricks,minecraft:cracked_deepslate_tiles,minecraft:cracked_nether_bricks,minecraft:cracked_polished_blackstone_bricks,minecraft:crafter,minecraft:crafting_table,minecraft:creaking_heart,minecraft:creeper_banner_pattern,minecraft:crimson_button,minecraft:crimson_fence,minecraft:crimson_fence_gate,minecraft:crimson_fungus,minecraft:crimson_hanging_sign,minecraft:crimson_hyphae,minecraft:crimson_nylium,minecraft:crimson_pressure_plate,minecraft:crimson_roots,minecraft:crimson_shelf,minecraft:crimson_sign,minecraft:cut_red_sandstone,minecraft:cut_red_sandstone_slab,minecraft:cut_sandstone,minecraft:cut_sandstone_slab,minecraft:cyan_bundle,minecraft:cyan_candle,minecraft:cyan_carpet,minecraft:cyan_harness,minecraft:damaged_anvil,minecraft:dandelion,minecraft:danger_pottery_sherd,minecraft:dark_oak_boat,minecraft:dark_oak_button,minecraft:dark_oak_chest_boat,minecraft:dark_oak_fence_gate,minecraft:dark_oak_hanging_sign,minecraft:dark_oak_pressure_plate,minecraft:dark_oak_sapling,minecraft:dark_oak_shelf,minecraft:dark_oak_sign,minecraft:dark_oak_wood,minecraft:daylight_detector,minecraft:dead_brain_coral,minecraft:dead_brain_coral_block,minecraft:dead_brain_coral_fan,minecraft:dead_bubble_coral,minecraft:dead_bubble_coral_block,minecraft:dead_bubble_coral_fan,minecraft:dead_fire_coral,minecraft:dead_fire_coral_block,minecraft:dead_fire_coral_fan,minecraft:dead_horn_coral,minecraft:dead_horn_coral_block,minecraft:dead_horn_coral_fan,minecraft:dead_tube_coral,minecraft:dead_tube_coral_block,minecraft:dead_tube_coral_fan,minecraft:deadbush,minecraft:decorated_pot,minecraft:deepslate_brick_wall,minecraft:deepslate_coal_ore,minecraft:deepslate_copper_ore,minecraft:deepslate_lapis_ore,minecraft:deepslate_redstone_ore,minecraft:deepslate_tile_slab,minecraft:deepslate_tile_stairs,minecraft:deepslate_tile_wall,minecraft:deepslate_tiles,minecraft:diamond_hoe,minecraft:diamond_horse_armor,minecraft:diamond_nautilus_armor,minecraft:diamond_spear,minecraft:diorite_slab,minecraft:diorite_stairs,minecraft:diorite_wall,minecraft:dirt_with_roots,minecraft:disc_fragment_5,minecraft:dragon_breath,minecraft:dragon_head,minecraft:dried_ghast,minecraft:dried_kelp_block,minecraft:end_brick_stairs,minecraft:end_bricks,minecraft:end_crystal,minecraft:end_rod,minecraft:end_stone_brick_wall,minecraft:ender_eye,minecraft:explorer_pottery_sherd,minecraft:exposed_chiseled_copper,minecraft:exposed_copper,minecraft:exposed_copper_bars,minecraft:exposed_copper_bulb,minecraft:exposed_copper_chain,minecraft:exposed_copper_chest,minecraft:exposed_copper_door,minecraft:exposed_copper_golem_statue,minecraft:exposed_copper_grate,minecraft:exposed_copper_lantern,minecraft:exposed_copper_trapdoor,minecraft:exposed_cut_copper,minecraft:exposed_cut_copper_slab,minecraft:exposed_cut_copper_stairs,minecraft:exposed_lightning_rod,minecraft:fence_gate,minecraft:fern,minecraft:field_masoned_banner_pattern,minecraft:fire_charge,minecraft:fire_coral,minecraft:fire_coral_block,minecraft:fire_coral_fan,minecraft:firefly_bush,minecraft:fletching_table,minecraft:flow_armor_trim_smithing_template,minecraft:flow_banner_pattern,minecraft:flow_pottery_sherd,minecraft:flower_banner_pattern,minecraft:flower_pot,minecraft:flowering_azalea,minecraft:friend_pottery_sherd,minecraft:frog_spawn,minecraft:furnace,minecraft:gilded_blackstone,minecraft:glass_pane,minecraft:globe_banner_pattern,minecraft:glowstone_dust,minecraft:gold_nugget,minecraft:golden_axe,minecraft:golden_boots,minecraft:golden_chestplate,minecraft:golden_dandelion,minecraft:golden_helmet,minecraft:golden_hoe,minecraft:golden_horse_armor,minecraft:golden_leggings,minecraft:golden_nautilus_armor,minecraft:golden_pickaxe,minecraft:golden_shovel,minecraft:golden_spear,minecraft:golden_sword,minecraft:granite_slab,minecraft:granite_stairs,minecraft:granite_wall,minecraft:grass_block,minecraft:gray_bundle,minecraft:gray_candle,minecraft:gray_carpet,minecraft:gray_harness,minecraft:green_bundle,minecraft:green_candle,minecraft:green_carpet,minecraft:green_harness,minecraft:grindstone,minecraft:guster_banner_pattern,minecraft:guster_pottery_sherd,minecraft:hanging_roots,minecraft:hardened_clay,minecraft:hay_block,minecraft:heart_pottery_sherd,minecraft:heartbreak_pottery_sherd,minecraft:heavy_core,minecraft:heavy_weighted_pressure_plate,minecraft:honeycomb_block,minecraft:hopper_minecart,minecraft:horn_coral,minecraft:horn_coral_block,minecraft:horn_coral_fan,minecraft:host_armor_trim_smithing_template,minecraft:howl_pottery_sherd,minecraft:ice,minecraft:iron_bars,minecraft:iron_chain,minecraft:iron_door,minecraft:iron_hoe,minecraft:iron_horse_armor,minecraft:iron_nautilus_armor,minecraft:iron_nugget,minecraft:iron_spear,minecraft:iron_trapdoor,minecraft:item,minecraft:jukebox,minecraft:jungle_boat,minecraft:jungle_button,minecraft:jungle_chest_boat,minecraft:jungle_door,minecraft:jungle_fence_gate,minecraft:jungle_hanging_sign,minecraft:jungle_planks,minecraft:jungle_pressure_plate,minecraft:jungle_sapling,minecraft:jungle_shelf,minecraft:jungle_sign,minecraft:jungle_trapdoor,minecraft:jungle_wood,minecraft:ladder,minecraft:lapis_block,minecraft:large_amethyst_bud,minecraft:large_fern,minecraft:leaf_litter,minecraft:leather_boots,minecraft:leather_chestplate,minecraft:leather_helmet,minecraft:leather_horse_armor,minecraft:leather_leggings,minecraft:light_blue_bundle,minecraft:light_blue_candle,minecraft:light_blue_carpet,minecraft:light_blue_dye,minecraft:light_blue_harness,minecraft:light_gray_bundle,minecraft:light_gray_candle,minecraft:light_gray_carpet,minecraft:light_gray_harness,minecraft:light_weighted_pressure_plate,minecraft:lightning_rod,minecraft:lily_of_the_valley,minecraft:lime_bundle,minecraft:lime_candle,minecraft:lime_carpet,minecraft:lime_harness,minecraft:lingering_potion,minecraft:lit_pumpkin,minecraft:lodestone,minecraft:loom,minecraft:mace,minecraft:magenta_bundle,minecraft:magenta_candle,minecraft:magenta_carpet,minecraft:magenta_harness,minecraft:mangrove_boat,minecraft:mangrove_button,minecraft:mangrove_chest_boat,minecraft:mangrove_door,minecraft:mangrove_fence_gate,minecraft:mangrove_hanging_sign,minecraft:mangrove_pressure_plate,minecraft:mangrove_propagule,minecraft:mangrove_roots,minecraft:mangrove_shelf,minecraft:mangrove_sign,minecraft:mangrove_trapdoor,minecraft:mangrove_wood,minecraft:medium_amethyst_bud,minecraft:miner_pottery_sherd,minecraft:mojang_banner_pattern,minecraft:mossy_cobblestone_slab,minecraft:mossy_cobblestone_stairs,minecraft:mossy_cobblestone_wall,minecraft:mossy_stone_brick_slab,minecraft:mossy_stone_brick_stairs,minecraft:mossy_stone_brick_wall,minecraft:mossy_stone_bricks,minecraft:mourner_pottery_sherd,minecraft:mud_brick_wall,minecraft:muddy_mangrove_roots,minecraft:mushroom_stem,minecraft:music_disc_creator,minecraft:music_disc_creator_music_box,minecraft:music_disc_lava_chicken,minecraft:music_disc_precipice,minecraft:music_disc_relic,minecraft:music_disc_tears,minecraft:mutton,minecraft:mycelium,minecraft:nether_brick,minecraft:nether_brick_wall,minecraft:nether_gold_ore,minecraft:nether_sprouts,minecraft:netherite_axe,minecraft:netherite_hoe,minecraft:netherite_horse_armor,minecraft:netherite_nautilus_armor,minecraft:netherite_shovel,minecraft:netherite_spear,minecraft:normal_stone_slab,minecraft:normal_stone_stairs,minecraft:noteblock,minecraft:oak_hanging_sign,minecraft:oak_sapling,minecraft:oak_shelf,minecraft:oak_sign,minecraft:oak_wood,minecraft:ominous_bottle,minecraft:ominous_trial_key,minecraft:open_eyeblossom,minecraft:orange_bundle,minecraft:orange_candle,minecraft:orange_carpet,minecraft:orange_harness,minecraft:orange_tulip,minecraft:oxeye_daisy,minecraft:oxidized_chiseled_copper,minecraft:oxidized_copper,minecraft:oxidized_copper_bars,minecraft:oxidized_copper_bulb,minecraft:oxidized_copper_chain,minecraft:oxidized_copper_chest,minecraft:oxidized_copper_door,minecraft:oxidized_copper_golem_statue,minecraft:oxidized_copper_grate,minecraft:oxidized_copper_lantern,minecraft:oxidized_copper_trapdoor,minecraft:oxidized_lightning_rod,minecraft:packed_mud,minecraft:painting,minecraft:pale_hanging_moss,minecraft:pale_moss_block,minecraft:pale_moss_carpet,minecraft:pale_oak_boat,minecraft:pale_oak_button,minecraft:pale_oak_chest_boat,minecraft:pale_oak_door,minecraft:pale_oak_fence,minecraft:pale_oak_fence_gate,minecraft:pale_oak_hanging_sign,minecraft:pale_oak_leaves,minecraft:pale_oak_log,minecraft:pale_oak_planks,minecraft:pale_oak_pressure_plate,minecraft:pale_oak_sapling,minecraft:pale_oak_shelf,minecraft:pale_oak_sign,minecraft:pale_oak_slab,minecraft:pale_oak_stairs,minecraft:pale_oak_trapdoor,minecraft:pale_oak_wood,minecraft:paper,minecraft:piglin_banner_pattern,minecraft:piglin_head,minecraft:pink_bundle,minecraft:pink_candle,minecraft:pink_carpet,minecraft:pink_harness,minecraft:pink_petals,minecraft:pink_tulip,minecraft:pitcher_plant,minecraft:pitcher_pod,minecraft:player_head,minecraft:plenty_pottery_sherd,minecraft:podzol,minecraft:poisonous_potato,minecraft:polished_andesite_slab,minecraft:polished_andesite_stairs,minecraft:polished_basalt,minecraft:polished_blackstone_brick_slab,minecraft:polished_blackstone_brick_stairs,minecraft:polished_blackstone_brick_wall,minecraft:polished_blackstone_button,minecraft:polished_blackstone_pressure_plate,minecraft:polished_blackstone_slab,minecraft:polished_blackstone_stairs,minecraft:polished_blackstone_wall,minecraft:polished_deepslate_slab,minecraft:polished_deepslate_stairs,minecraft:polished_deepslate_wall,minecraft:polished_diorite_slab,minecraft:polished_diorite_stairs,minecraft:polished_granite_slab,minecraft:polished_granite_stairs,minecraft:polished_tuff,minecraft:polished_tuff_slab,minecraft:polished_tuff_stairs,minecraft:polished_tuff_wall,minecraft:popped_chorus_fruit,minecraft:poppy,minecraft:porkchop,minecraft:powder_snow_bucket,minecraft:prismarine_bricks,minecraft:prismarine_bricks_stairs,minecraft:prismarine_wall,minecraft:prize_pottery_sherd,minecraft:pufferfish_bucket,minecraft:purple_bundle,minecraft:purple_candle,minecraft:purple_carpet,minecraft:purple_harness,minecraft:purpur_pillar,minecraft:quartz_bricks,minecraft:quartz_ore,minecraft:rabbit,minecraft:raiser_armor_trim_smithing_template,minecraft:raw_copper_block,minecraft:raw_gold_block,minecraft:raw_iron_block,minecraft:recovery_compass,minecraft:red_bundle,minecraft:red_candle,minecraft:red_carpet,minecraft:red_harness,minecraft:red_mushroom,minecraft:red_mushroom_block,minecraft:red_nether_brick_wall,minecraft:red_sand,minecraft:red_sandstone_wall,minecraft:red_tulip,minecraft:redstone_torch,minecraft:resin_block,minecraft:resin_brick,minecraft:resin_brick_slab,minecraft:resin_brick_stairs,minecraft:resin_brick_wall,minecraft:resin_bricks,minecraft:resin_clump,minecraft:respawn_anchor,minecraft:salmon,minecraft:salmon_bucket,minecraft:sandstone_wall,minecraft:scaffolding,minecraft:scrape_pottery_sherd,minecraft:sculk_vein,minecraft:shaper_armor_trim_smithing_template,minecraft:sheaf_pottery_sherd,minecraft:shelter_pottery_sherd,minecraft:short_dry_grass,minecraft:short_grass,minecraft:silver_glazed_terracotta,minecraft:skeleton_skull,minecraft:skull_banner_pattern,minecraft:skull_pottery_sherd,minecraft:small_amethyst_bud,minecraft:small_dripleaf_block,minecraft:smithing_table,minecraft:smoker,minecraft:smooth_basalt,minecraft:smooth_quartz,minecraft:smooth_quartz_slab,minecraft:smooth_quartz_stairs,minecraft:smooth_red_sandstone,minecraft:smooth_red_sandstone_slab,minecraft:smooth_red_sandstone_stairs,minecraft:smooth_sandstone,minecraft:smooth_sandstone_slab,minecraft:smooth_sandstone_stairs,minecraft:smooth_stone_slab,minecraft:sniffer_egg,minecraft:snort_pottery_sherd,minecraft:snow,minecraft:snow_layer,minecraft:snowball,minecraft:soul_lantern,minecraft:soul_soil,minecraft:soul_torch,minecraft:spruce_boat,minecraft:spruce_button,minecraft:spruce_chest_boat,minecraft:spruce_fence_gate,minecraft:spruce_hanging_sign,minecraft:spruce_pressure_plate,minecraft:spruce_sapling,minecraft:spruce_shelf,minecraft:spruce_sign,minecraft:spruce_wood,minecraft:stick,minecraft:stone_axe,minecraft:stone_brick_wall,minecraft:stone_bricks,minecraft:stone_hoe,minecraft:stone_pickaxe,minecraft:stone_shovel,minecraft:stone_spear,minecraft:stone_stairs,minecraft:stone_sword,minecraft:stonecutter_block,minecraft:stripped_acacia_wood,minecraft:stripped_bamboo_block,minecraft:stripped_birch_wood,minecraft:stripped_cherry_wood,minecraft:stripped_crimson_hyphae,minecraft:stripped_dark_oak_wood,minecraft:stripped_jungle_wood,minecraft:stripped_mangrove_wood,minecraft:stripped_oak_wood,minecraft:stripped_pale_oak_log,minecraft:stripped_pale_oak_wood,minecraft:stripped_spruce_wood,minecraft:stripped_warped_hyphae,minecraft:suspicious_gravel,minecraft:suspicious_sand,minecraft:suspicious_stew,minecraft:tadpole_bucket,minecraft:tall_dry_grass,minecraft:tall_grass,minecraft:target,minecraft:tnt,minecraft:tnt_minecart,minecraft:torchflower,minecraft:trapdoor,minecraft:trapped_chest,minecraft:trial_key,minecraft:tropical_fish,minecraft:tropical_fish_bucket,minecraft:tube_coral,minecraft:tube_coral_fan,minecraft:tuff_brick_slab,minecraft:tuff_brick_stairs,minecraft:tuff_brick_wall,minecraft:tuff_bricks,minecraft:tuff_slab,minecraft:tuff_stairs,minecraft:tuff_wall,minecraft:turtle_egg,minecraft:turtle_helmet,minecraft:turtle_scute,minecraft:twisting_vines,minecraft:undyed_shulker_box,minecraft:warped_button,minecraft:warped_fence,minecraft:warped_fence_gate,minecraft:warped_fungus,minecraft:warped_fungus_on_a_stick,minecraft:warped_hanging_sign,minecraft:warped_hyphae,minecraft:warped_nylium,minecraft:warped_pressure_plate,minecraft:warped_roots,minecraft:warped_shelf,minecraft:warped_sign,minecraft:waxed_chiseled_copper,minecraft:waxed_copper,minecraft:waxed_copper_bars,minecraft:waxed_copper_bulb,minecraft:waxed_copper_chain,minecraft:waxed_copper_chest,minecraft:waxed_copper_door,minecraft:waxed_copper_golem_statue,minecraft:waxed_copper_grate,minecraft:waxed_copper_lantern,minecraft:waxed_copper_trapdoor,minecraft:waxed_cut_copper,minecraft:waxed_cut_copper_slab,minecraft:waxed_cut_copper_stairs,minecraft:waxed_exposed_chiseled_copper,minecraft:waxed_exposed_copper,minecraft:waxed_exposed_copper_bars,minecraft:waxed_exposed_copper_bulb,minecraft:waxed_exposed_copper_chain,minecraft:waxed_exposed_copper_chest,minecraft:waxed_exposed_copper_door,minecraft:waxed_exposed_copper_golem_statue,minecraft:waxed_exposed_copper_grate,minecraft:waxed_exposed_copper_lantern,minecraft:waxed_exposed_copper_trapdoor,minecraft:waxed_exposed_cut_copper,minecraft:waxed_exposed_cut_copper_slab,minecraft:waxed_exposed_cut_copper_stairs,minecraft:waxed_exposed_lightning_rod,minecraft:waxed_lightning_rod,minecraft:waxed_oxidized_chiseled_copper,minecraft:waxed_oxidized_copper,minecraft:waxed_oxidized_copper_bars,minecraft:waxed_oxidized_copper_bulb,minecraft:waxed_oxidized_copper_chain,minecraft:waxed_oxidized_copper_chest,minecraft:waxed_oxidized_copper_door,minecraft:waxed_oxidized_copper_golem_statue,minecraft:waxed_oxidized_copper_grate,minecraft:waxed_oxidized_copper_lantern,minecraft:waxed_oxidized_copper_trapdoor,minecraft:waxed_oxidized_cut_copper,minecraft:waxed_oxidized_cut_copper_slab,minecraft:waxed_oxidized_cut_copper_stairs,minecraft:waxed_oxidized_lightning_rod,minecraft:waxed_weathered_chiseled_copper,minecraft:waxed_weathered_copper,minecraft:waxed_weathered_copper_bars,minecraft:waxed_weathered_copper_bulb,minecraft:waxed_weathered_copper_chain,minecraft:waxed_weathered_copper_chest,minecraft:waxed_weathered_copper_door,minecraft:waxed_weathered_copper_golem_statue,minecraft:waxed_weathered_copper_grate,minecraft:waxed_weathered_copper_lantern,minecraft:waxed_weathered_copper_trapdoor,minecraft:waxed_weathered_cut_copper,minecraft:waxed_weathered_cut_copper_slab,minecraft:waxed_weathered_cut_copper_stairs,minecraft:waxed_weathered_lightning_rod,minecraft:wayfinder_armor_trim_smithing_template,minecraft:weathered_chiseled_copper,minecraft:weathered_copper,minecraft:weathered_copper_bars,minecraft:weathered_copper_bulb,minecraft:weathered_copper_chain,minecraft:weathered_copper_chest,minecraft:weathered_copper_door,minecraft:weathered_copper_golem_statue,minecraft:weathered_copper_grate,minecraft:weathered_copper_lantern,minecraft:weathered_copper_trapdoor,minecraft:weathered_cut_copper,minecraft:weathered_cut_copper_slab,minecraft:weathered_cut_copper_stairs,minecraft:weathered_lightning_rod,minecraft:web,minecraft:weeping_vines,minecraft:wet_sponge,minecraft:white_bundle,minecraft:white_candle,minecraft:white_carpet,minecraft:white_harness,minecraft:white_tulip,minecraft:wildflowers,minecraft:wolf_armor,minecraft:wooden_axe,minecraft:wooden_button,minecraft:wooden_door,minecraft:wooden_hoe,minecraft:wooden_pickaxe,minecraft:wooden_pressure_plate,minecraft:wooden_shovel,minecraft:wooden_spear,minecraft:wooden_sword,minecraft:writable_book,minecraft:yellow_bundle,minecraft:yellow_candle,minecraft:yellow_carpet,minecraft:yellow_harness";

function survivalCatalogPrice(id) {
  if (id.includes("armor_trim") || id.includes("music_disc") || id.includes("pottery_sherd")) return 1200;
  if (id.includes("banner_pattern") || id.includes("head") || id.includes("skull")) return 600;
  if (id.includes("horse_armor") || id.includes("nautilus_armor") || id.includes("spear")) return 450;
  if (id.includes("boat") || id.includes("raft") || id.includes("minecart")) return 90;
  if (id.includes("coral") || id.includes("flower") || id.includes("sapling") || id.includes("leaves")) return 12;
  if (id.includes("ore") || id.includes("debris") || id.includes("shard") || id.includes("core")) return 120;
  return 35;
}

const remainingSurvivalItems = [];
for (const typeId of SURVIVAL_CATALOG_REMAINDER.split(",")) {
  if (!typeId || registeredCatalogIds.has(typeId)) continue;
  try {
    new ItemStack(typeId, 1);
    remainingSurvivalItems.push({
      name: catalogDisplayName(typeId.slice("minecraft:".length)),
      id: typeId,
      buyPrice: survivalCatalogPrice(typeId),
      sellPrice: 0
    });
    registeredCatalogIds.add(typeId);
  } catch (e) {
    // El tipo no existe en la versión instalada; no se ofrece en la tienda.
  }
}
if (remainingSurvivalItems.length) {
  CATEGORIES.push({ name: "Catálogo Supervivencia", items: remainingSurvivalItems });
}

// Sección explícita para que todas las herramientas normales estén juntas y
// no queden ocultas dentro del catálogo general.
const COMPLETE_TOOL_CATALOG = [
  ["Madera", "wooden", 18],
  ["Piedra", "stone", 28],
  ["Cobre", "copper", 55],
  ["Hierro", "iron", 70],
  ["Oro", "golden", 90],
  ["Diamante", "diamond", 520],
  ["Netherita", "netherite", 3900]
];
const COMPLETE_TOOL_TYPES = [
  ["Espada", "sword"],
  ["Pico", "pickaxe"],
  ["Hacha", "axe"],
  ["Pala", "shovel"],
  ["Azada", "hoe"]
];
const completeToolItems = [];
for (const [materialName, materialId, basePrice] of COMPLETE_TOOL_CATALOG) {
  for (const [toolName, toolId] of COMPLETE_TOOL_TYPES) {
    const typeId = `minecraft:${materialId}_${toolId}`;
    try {
      new ItemStack(typeId, 1);
      const multiplier = toolId === "pickaxe" || toolId === "axe" ? 1.35 : toolId === "sword" ? 1.15 : 1;
      completeToolItems.push({
        name: `${toolName} de ${materialName}`,
        id: typeId,
        buyPrice: Math.ceil(basePrice * multiplier),
        sellPrice: 0
      });
    } catch (e) {}
  }
}
for (const [name, id, buyPrice] of [
  ["Arco", "minecraft:bow", 80], ["Ballesta", "minecraft:crossbow", 120],
  ["Tridente", "minecraft:trident", 21000], ["Maza", "minecraft:mace", 18000],
  ["Lanza de Cobre", "minecraft:copper_spear", 130], ["Lanza de Hierro", "minecraft:iron_spear", 220],
  ["Lanza de Oro", "minecraft:golden_spear", 280], ["Lanza de Diamante", "minecraft:diamond_spear", 1300],
  ["Lanza de Netherita", "minecraft:netherite_spear", 5200], ["Tijeras", "minecraft:shears", 50],
  ["Sílex y Acero", "minecraft:flint_and_steel", 45], ["Caña de Pescar", "minecraft:fishing_rod", 50],
  ["Cepillo", "minecraft:brush", 70], ["Catalejo", "minecraft:spyglass", 150],
  ["Brújula", "minecraft:compass", 120], ["Brújula de Recuperación", "minecraft:recovery_compass", 1800],
  ["Reloj", "minecraft:clock", 140]
]) {
  try {
    new ItemStack(id, 1);
    completeToolItems.push({ name, id, buyPrice, sellPrice: 0 });
  } catch (e) {}
}
if (completeToolItems.length) CATEGORIES.push({ name: "Herramientas completas", items: completeToolItems });

// Rellenar automáticamente las reglas de venta basándose en los items definidos en CATEGORIES
for (const category of CATEGORIES) {
  if (category.items) {
    for (const item of category.items) {
      const sellPrice = (item.sellPrice !== undefined && item.sellPrice !== null) ? item.sellPrice : 0;
      if (sellPrice > 0) SELL_RULES.set(item.id, { price: sellPrice });
    }
  }
}
SELL_RULES.set("minecraft:book", { price: 3 });
SELL_RULES.set("minecraft:enchanted_book", { price: 500 });

// Auxiliar para conseguir el scoreboard
function getObjective() {
  let obj = world.scoreboard.getObjective("money");
  if (!obj) {
    try {
      obj = world.scoreboard.addObjective("money", "§e$ Dinero");
    } catch (e) { ErrorReporter.report(e, { addonId: "shop_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }
  return obj;
}

function readBalanceScore(player) {
  const obj = getObjective();
  if (!obj) return 0;
  try {
    const value = (function(o, p){ try{return o.getScore(p) ?? 0;}catch(e){try{return o.getScore(p.name) ?? 0;}catch(e2){return 0;}} })(obj, player);
    return Math.max(0, Math.min(MAX_SCOREBOARD_BALANCE, Math.floor(Number(value) || 0)));
  } catch (e) {
    ErrorReporter.report(e, { addonId: "shop_addon", moduleId: "main.js", operation: "readBalanceScore", category: "runtime" });
    return 0;
  }
}

function logShopTransaction(playerName, type, amount, details) {
  try {
    let registry = {};
    const raw = globalThis.__sqlite_get_prop_v2__("shop_addon", "world", "bank_accounts_registry_v2");
    if (raw) registry = JSON.parse(raw);
    
    if (!registry[playerName]) {
      registry[playerName] = { savings: 0, loan: 0, lastUpdate: Date.now(), history: [] };
    }
    
    if (!registry[playerName].history) {
      registry[playerName].history = [];
    }
    
    registry[playerName].history.unshift({
      timestamp: Date.now(),
      type: type,
      amount: Number(amount),
      details: details
    });
    
    if (registry[playerName].history.length > 5) {
      registry[playerName].history = registry[playerName].history.slice(0, 5);
    }
    
    globalThis.__sqlite_set_prop_v2__("shop_addon", "world", "bank_accounts_registry_v2", JSON.stringify(registry));
  } catch (e) {}
}

function writeBalanceScore(player, amount) {
  const obj = getObjective();
  if (!obj) return false;
  const numericAmount = Number(amount);
  if (!Number.isSafeInteger(numericAmount) || numericAmount < 0 || numericAmount > MAX_SCOREBOARD_BALANCE) {
    console.warn(`[ECONOMY_TX] REJECT invalid_balance player=${player?.name || "unknown"} amount=${amount} reason=shop_balance_write`);
    return false;
  }
  const normalized = numericAmount;
  try {
    try {
      obj.setScore(player, normalized);
    } catch (identityError) {
      obj.setScore(player.name, normalized);
    }
    return readBalanceScore(player) === normalized;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "shop_addon", moduleId: "main.js", operation: "writeBalanceScore", category: "runtime" });
    console.warn(`[Shop Addon] No se pudo confirmar el saldo de ${player.name}: ${e}`);
    return false;
  }
}

function formatMoney(amount) {
  return String(Math.max(0, Math.floor(Number(amount) || 0)));
}

function getBalance(player) {
  // Las antiguas decimas privadas de Shop se descartan: money es la unica fuente de verdad.
  try {
    globalThis.__sqlite_set_prop_v2__("shop_addon", "world", `shop_money_tenths_${player.name.toLowerCase()}`, undefined);
  } catch (e) { /* propiedad legacy no critica */ }
  return readBalanceScore(player);
}

function changeBalance(player, delta) {
  const normalizedDelta = Math.trunc(Number(delta) || 0);
  const before = readBalanceScore(player);
  const after = before + normalizedDelta;
  if (after < 0) {
    const isDebitEnabled = Boolean(globalThis.__sqlite_get_prop_v2__("shop_addon", player, "bank_debit_card_enabled_v1") ?? true);
    if (isDebitEnabled && normalizedDelta < 0) {
      const cost = Math.abs(normalizedDelta);
      const savings = Number(globalThis.__sqlite_get_prop_v2__("shop_addon", player, "bank_savings_v1") ?? 0);
      if (savings >= cost) {
        const nextSavings = savings - cost;
        globalThis.__sqlite_set_prop_v2__("shop_addon", player, "bank_savings_v1", nextSavings);
        try {
          player.playSound("random.pop", { pitch: 1.2, volume: 0.8 });
          player.onScreenDisplay.setActionBar(`§a💳 Pagado $${cost} con Tarjeta de Débito (Ahorros: $${nextSavings})`);
        } catch (e) {}
        return { ok: true, before, after: before, paidViaDebit: true };
      }
    }
    return { ok: false, before, after: before };
  }
  if (after > MAX_SCOREBOARD_BALANCE) {
    return { ok: false, before, after: before };
  }
  if (!writeBalanceScore(player, after)) {
    return { ok: false, before, after: readBalanceScore(player) };
  }
  return { ok: true, before, after };
}

function beginEconomyOperation(player) {
  const key = String(player?.id || player?.name || "").toLowerCase();
  if (!key || activeEconomyOperations.has(key)) return undefined;
  activeEconomyOperations.add(key);
  return key;
}

function endEconomyOperation(key) {
  if (key) activeEconomyOperations.delete(key);
}

// Auxiliares de Inventario
function getInventory(player) {
  return player.getComponent("minecraft:inventory")?.container;
}

const BLOCKED_SELL_TYPE_IDS = new Set([
  "minecraft:book",
  "minecraft:written_book",
  "minecraft:writable_book",
  "minecraft:tripwire_hook",
  "minecraft:dragon_egg",
  "minecraft:netherite_block",
  "minecraft:netherite_upgrade_smithing_template",
  "minecraft:elytra",
  "minecraft:trident",
]);

function getItemLore(item) {
  try {
    return typeof item?.getLore === "function" ? item.getLore() ?? [] : [];
  } catch (e) { ErrorReporter.report(e, { addonId: "shop_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return [];
  }
}

function isSemillaSagrada(item) {
  if (!item) return false;
  const name = String(item.nameTag || "").replace(/§[0-9a-fk-or]/gi, "").toLowerCase();
  if (name.includes("semilla sagrada")) return true;
  try {
    const lore = (item.getLore?.() ?? []).join(" ").replace(/§[0-9a-fk-or]/gi, "").toLowerCase();
    if (lore.includes("semilla sagrada")) return true;
  } catch (e) {}
  return false;
}

function isCustomProtectedItem(item) {
  if (!item) return false;
  if (isSemillaSagrada(item)) return false;
  if (item.typeId === "minecraft:enchanted_book") return false;
  if (BLOCKED_SELL_TYPE_IDS.has(item.typeId)) return true;
  if (item.nameTag && String(item.nameTag).trim() !== "") return true;
  if (getItemLore(item).length > 0) return true;
  try {
    if ((item.getCanDestroy?.() ?? []).length > 0) return true;
    if ((item.getCanPlaceOn?.() ?? []).length > 0) return true;
    if (item.typeId !== "minecraft:enchanted_book" && (item.getComponent?.("minecraft:enchantable")?.getEnchantments?.() ?? []).length > 0) return true;
    const durability = item.getComponent?.("minecraft:durability");
    if (durability && Number(durability.damage || 0) !== 0) return true;
  } catch (e) {
    return true;
  }
  return false;
}

function isSellableTypeId(typeId) {
  if (!typeId || BLOCKED_SELL_TYPE_IDS.has(typeId)) return false;
  return SELL_RULES.has(typeId);
}

function isPlainSellableItemStack(item) {
  if (!item) return false;
  if (isSemillaSagrada(item)) return true;
  if (isCustomProtectedItem(item)) return false;
  return isSellableTypeId(item.typeId);
}

function countItem(player, typeId, itemKey = null) {
  const container = getInventory(player);
  if (!container) return 0;
  let count = 0;
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (!item) continue;
    if (itemKey === "semilla_sagrada" || isSemillaSagrada(item)) {
      if (isSemillaSagrada(item)) count += item.amount;
    } else if (item.typeId === typeId && isPlainSellableItemStack(item)) {
      count += item.amount;
    }
  }
  return count;
}

function takeItems(player, typeId, amount, itemKey = null) {
  const container = getInventory(player);
  if (!container) return { quantity: 0, stacks: [] };
  let remaining = amount;
  let removed = 0;
  const stacks = [];
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (!item) continue;
    const isTarget = (itemKey === "semilla_sagrada" || (item.nameTag && item.nameTag.includes("Semilla Sagrada")))
      ? (item.nameTag && item.nameTag.includes("Semilla Sagrada"))
      : (item.typeId === typeId && isPlainSellableItemStack(item));

    if (isTarget) {
      const takeAmount = Math.min(item.amount, remaining);
      const taken = item.clone();
      taken.amount = takeAmount;
      const original = item.clone();
      try {
        if (takeAmount === item.amount) {
          container.setItem(i, undefined);
        } else {
          const remainder = item.clone();
          remainder.amount = item.amount - takeAmount;
          container.setItem(i, remainder);
        }

        // setItem puede fallar silenciosamente en algunos clientes; no se paga
        // una venta hasta confirmar que el slot cambió en el inventario real.
        const readBack = container.getItem(i);
        const removedConfirmed = takeAmount === item.amount
          ? !readBack
          : readBack && readBack.typeId === item.typeId && readBack.amount === item.amount - takeAmount;
        if (!removedConfirmed) {
          container.setItem(i, original);
          break;
        }
      } catch (error) {
        try { container.setItem(i, original); } catch (restoreError) {}
        ErrorReporter.report(error, { addonId: "shop_addon", moduleId: "main.js", operation: "takeItems", category: "runtime" });
        break;
      }

      stacks.push(taken);
      remaining -= takeAmount;
      removed += takeAmount;
      if (remaining === 0) break;
    }
  }
  return { quantity: removed, stacks };
}

function restoreTakenItems(player, stacks) {
  const container = getInventory(player);
  if (!container) return false;
  try {
    for (const stack of stacks) {
      const leftover = container.addItem(stack);
      if (leftover) player.dimension.spawnItem(leftover, player.location);
    }
    return true;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "shop_addon", moduleId: "main.js", operation: "restoreTakenItems", category: "runtime" });
    return false;
  }
}

function giveItem(player, itemOrTypeId, amount) {
  let typeId = "";
  let itemName = "";
  if (itemOrTypeId && typeof itemOrTypeId === "object") {
    typeId = itemOrTypeId.id;
    itemName = itemOrTypeId.name;
  } else {
    typeId = itemOrTypeId;
  }
  
  if (!/^minecraft:[a-z0-9_]+$/.test(typeId) || !Number.isInteger(amount) || amount < 1 || amount > MAX_PURCHASE_QUANTITY) return false;
  try {
    const cleanTypeId = typeId.replace("minecraft:", "");
    let command = `give @s ${cleanTypeId} ${amount}`;
    if (Number.isInteger(itemOrTypeId?.dataValue)) {
      command = `give @s ${cleanTypeId} ${amount} ${itemOrTypeId.dataValue}`;
    }
    if (typeId === "minecraft:potion" && itemName.includes("Fuerza")) command = `give @s potion ${amount} 33`;
    if (typeId === "minecraft:splash_potion" && itemName.includes("Vida")) command = `give @s splash_potion ${amount} 22`;
    const result = player.runCommand(command);
    return result?.successCount === undefined || result.successCount > 0;
  } catch (err) { ErrorReporter.report(err, { addonId: "shop_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn(`[Shop Addon] Error en giveItem para ${typeId} (cantidad ${amount}): ${err}`);
  }
  return false;
}

function registerCustomCommands() {
  const startupSignal = system?.beforeEvents?.startup;
  if (!startupSignal || typeof startupSignal.subscribe !== "function") return;
  startupSignal.subscribe((event) => {
    const registry = event?.customCommandRegistry;
    const register = typeof registry?.registerCommand === "function"
      ? registry.registerCommand.bind(registry)
      : typeof registry?.register === "function"
        ? registry.register.bind(registry)
        : undefined;
    if (!register) return;
    try {
      for (const name of ["tienda", "shop"]) {
        register({ name: `${COMMAND_NAMESPACE}:${name}`, description: "Abre la tienda", permissionLevel: CommandPermissionLevel.Any }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          system.runTimeout(() => openShopMainMenu(sender), 5);
          return commandOk("Abriendo tienda.");
        });
      }

      register({ name: `${COMMAND_NAMESPACE}:maquinacomida`, description: "Spawnea la máquina de comida", permissionLevel: CommandPermissionLevel.Admin }, (origin) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        try {
          const loc = sender.location;
          const entity = sender.dimension.spawnEntity("minecraft:npc", { x: loc.x, y: loc.y, z: loc.z });
          entity.nameTag = "§e§lMáquina de Comida";
          entity.addTag("npc_maquinacomida");
          sender.sendMessage("§b§l[§3Servidor§b§l]§r §a¡Máquina de Comida (NPC) spawneada con éxito!");
          return commandOk("Máquina spawneada.");
        } catch (e) { ErrorReporter.report(e, { addonId: "shop_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
          sender.sendMessage("§b§l[§3Servidor§b§l]§r §cError al spawnear la máquina: " + e.message);
          return commandError("Error al spawnear.");
        }
      });

    } catch (e) { ErrorReporter.report(e, { addonId: "shop_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Shop UI Addon] Error registrando custom commands: " + e);
    }
  });
}

registerCustomCommands();

function getEnchantmentTypeSafely(enchantId) {
  if (!enchantId) return undefined;
  let type = EnchantmentTypes.get(enchantId);
  if (!type) type = EnchantmentTypes.get(`minecraft:${enchantId}`);
  if (!type && String(enchantId).startsWith("minecraft:")) type = EnchantmentTypes.get(String(enchantId).replace("minecraft:", ""));
  return type;
}

function tryGiveEnchantedBook(player, enchantId, price, level = 1) {
  const container = getInventory(player);
  if (!container) return;

  const operationKey = beginEconomyOperation(player);
  if (!operationKey) {
    player.sendMessage("§b§l[§3Tienda§b§l]§r §cYa tienes otra operación económica en curso.");
    return;
  }

  const type = getEnchantmentTypeSafely(enchantId);
  if (!type) {
    player.sendMessage("§b§l[§3Tienda§b§l]§r §cTipo de encantamiento no válido en el servidor.");
    endEconomyOperation(operationKey);
    return;
  }

  const buyTaxRate = Number(globalThis.__sqlite_get_prop_v2__("shop_addon", "world", "tax_shop_buy_rate_v1") ?? 5);
  const taxAmount = Math.ceil(price * (buyTaxRate / 100));
  const finalPrice = price + taxAmount;

  const debit = changeBalance(player, -Math.ceil(finalPrice));
  if (!debit.ok) {
    player.sendMessage(`§b§l[§3Tienda§b§l]§r §cSaldo insuficiente para este libro encantado (Costo + IVA: §a$${formatMoney(finalPrice)}§c).`);
    endEconomyOperation(operationKey);
    return;
  }

  try {
    const currentVault = Number(globalThis.__sqlite_get_prop_v2__("shop_addon", "world", "bank_vault_funds") ?? 0);
    globalThis.__sqlite_set_prop_v2__("shop_addon", "world", "bank_vault_funds", currentVault + Math.ceil(finalPrice));
  } catch (e) {
    console.warn("[Shop Addon] Error actualizando bank_vault_funds en compra de libro: " + e);
  }

  try {
    const book = new ItemStack("minecraft:enchanted_book", 1);
    const enchantable = book.getComponent("minecraft:enchantable");
    if (!enchantable) {
      throw new Error("El servidor no soporta libros encantados por script.");
    }
    enchantable.addEnchantment({ type, level });
    const remaining = container.addItem(book);
    if (remaining) {
      player.dimension.spawnItem(remaining, player.location);
    }
    player.sendMessage(`§b§l[§3Tienda§b§l]§r §a¡Libro encantado entregado! Se descontaron §e$${formatMoney(finalPrice)} §7(Impuesto IVA: §a$${formatMoney(taxAmount)}§7)§a.`);
    logShopTransaction(player.name, "Compra", finalPrice, `Libro Encantado: ${enchantId} Lvl ${level}`);
  } catch (error) { ErrorReporter.report(error, { addonId: "shop_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    const refund = changeBalance(player, Math.ceil(finalPrice));
    if (!refund.ok) console.warn(`[ECONOMY_CRITICAL] No se pudo reembolsar el libro encantado a ${player.name}.`);
    else {
      try {
        const currentVault = Number(globalThis.__sqlite_get_prop_v2__("shop_addon", "world", "bank_vault_funds") ?? 0);
        globalThis.__sqlite_set_prop_v2__("shop_addon", "world", "bank_vault_funds", Math.max(0, currentVault - Math.ceil(finalPrice)));
      } catch (e) {
        console.warn("[Shop Addon] Error devolviendo bank_vault_funds en compra de libro: " + e);
      }
    }
    player.sendMessage("§b§l[§3Tienda§b§l]§r §cNo se pudo crear el libro encantado en esta versión del servidor.");
  } finally {
    endEconomyOperation(operationKey);
  }
}

// Escuchar mensajes de chat
try {
  const beforeChat = world.beforeEvents ? (world.beforeEvents.chatSend || world.beforeEvents.chat) : undefined;
  if (beforeChat && typeof beforeChat.subscribe === "function") {
    beforeChat.subscribe((event) => {
      const message = String(event.message || "").trim().toLowerCase();
      const sender = event.sender;

      if (message === "s:tienda" || message === "s:shop" ||
          message === "!tienda" || message === "!shop" ||
          message.startsWith("/s:tienda") || message.startsWith("/s:shop")) {
        if (event.cancel !== undefined) event.cancel = true;
        system.runTimeout(() => {
          openShopMainMenu(sender);
        }, 5);
      }
    });
  }
} catch (e) {}

// Manejador por /scriptevent
try {
  if (system && system.afterEvents && system.afterEvents.scriptEventReceive && typeof system.afterEvents.scriptEventReceive.subscribe === "function") {
    system.afterEvents.scriptEventReceive.subscribe((event) => {
      const id = String(event.id || "").toLowerCase();
      const message = String(event.message || "").trim().toLowerCase();
      const sender = event.sourceEntity;
      if (!sender || sender.typeId !== "minecraft:player") return;

      if (id === "s:shop" || id === "s:tienda" || id === "cmd:shop" || id === "cmd:tienda" ||
          (id === "cmd" && (message === "tienda" || message === "shop")) ||
          (id === "!" && (message === "tienda" || message === "shop"))) {
        system.runTimeout(() => {
          openShopMainMenu(sender);
        }, 5);
      }
    });
  }
} catch (e) { ErrorReporter.report(e, { addonId: "shop_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Shop UI Addon] ScriptEvent listener error: " + e);
}

// Vistas de Formularios UI
// Auxiliar robusto para abrir formularios evitando conflictos de pantallas (ej. Chat cerrándose)
function safeOpenForm(player, form, onSelect, onCancel = undefined, retryCount = 0) {
  form.show(player).then((response) => {
    if (response.canceled) {
      // Si se cancela por estar el usuario ocupado (ej. cerrando chat), reintentamos en unos ticks
      if (response.cancelationReason === "UserBusy" && retryCount < 5) {
        system.runTimeout(() => {
          safeOpenForm(player, form, onSelect, onCancel, retryCount + 1);
        }, 10);
        return;
      }
      if (onCancel) {
        system.run(() => {
          onCancel(response);
        });
      }
      return;
    }
    system.run(() => {
      onSelect(response);
    });
  }).catch((err) => {
    const message = String(err ?? "");
    if (message.includes("Player quit before responding") || message.includes("FormRejectError")) {
      return;
    }
    console.warn(`[Shop UI Addon] Error en safeOpenForm: ${err}`);
  });
}

// Vistas de Formularios UI
const activeShopMenuPlayers = new Set();

const CATEGORY_ICONS = {
  "Materiales": "💎",
  "Bloques Especiales": "🧱",
  "Cajas de Shulker": "📦",
  "Comida": "🍎",
  "Utilidades": "🧰",
  "Redstone y Automatización": "⚡",
  "Pociones y Alquimia": "🧪",
  "Tesoros de Supervivencia": "🏆",
  "Movilidad y Exploración": "🧭",
  "Materiales de Construcción": "🏗️",
  "Madera y Derivados": "🪵",
  "Granja y Supervivencia": "🧺",
  "Armas y Herramientas": "⚔️",
  "Armaduras": "🛡️",
  "Menas y Minerales": "🪨",
  "Tintes y Flores": "🌺",
  "Discos de Música": "🎵",
  "Diseños de Armadura (Trims)": "📜",
  "Libros Encantados": "✨",
  "Tesoros de Supervivencia": "🏆",
  "Construcción ampliada": "🏛️",
  "Decoración y naturaleza": "🌿",
  "Equipo de Supervivencia": "🪓",
  "Herramientas completas": "⛏️",
  "Granja, fauna y botín": "🐾",
  "Redstone ampliada": "🔧",
  "Catálogo Supervivencia": "📚"
};

const SHOP_ITEMS_PER_PAGE = 45;

function normalizeShopSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const SHOP_SEARCH_ALIASES = {
  madera: ["wood", "log", "plank", "tabl", "tronco"],
  tronco: ["log", "wood", "madera"],
  tabla: ["plank", "madera"], tablones: ["plank", "madera"], maderaoscura: ["dark oak"],
  escalera: ["stairs"], escaleras: ["stairs"], losa: ["slab"], muro: ["wall"],
  valla: ["fence"], porton: ["gate"], puerta: ["door"], trampilla: ["trapdoor"],
  cofre: ["chest"], barril: ["barrel"], caja: ["box", "shulker"], cubo: ["bucket"], cubeta: ["bucket"],
  pocion: ["potion"], encantado: ["enchanted", "enchantment"], encantamiento: ["enchantment"],
  armadura: ["armor", "helmet", "chestplate", "leggings", "boots"],
  casco: ["helmet"], pechera: ["chestplate"], grebas: ["leggings"], botas: ["boots"],
  pico: ["pickaxe"], pala: ["shovel"], hacha: ["axe"], azada: ["hoe"], espada: ["sword"],
  bote: ["boat", "raft"], barco: ["boat", "raft"], vagoneta: ["minecart"], riel: ["rail"],
  tinte: ["dye"], flor: ["flower"], hoja: ["leaves"], hojas: ["leaves"],
  ladrillo: ["brick"], piedra: ["stone", "deepslate", "tuff", "granite", "diorite", "andesite"],
  redstone: ["redstone"], red: ["redstone"], disco: ["music disc"], musica: ["music disc"],
  adorno: ["trim"], plantilla: ["template", "trim"], ceramica: ["pottery", "sherd"],
  coral: ["coral"], cobre: ["copper"], netherita: ["netherite"], esmeralda: ["emerald"],
  diamante: ["diamond"], hierro: ["iron"], oro: ["gold", "golden"], carbon: ["coal", "charcoal"],
  cuarzo: ["quartz"], amatista: ["amethyst"], obsidiana: ["obsidian"],
  negro: ["black"], blanco: ["white"], rojo: ["red"], azul: ["blue"], verde: ["green"],
  amarillo: ["yellow"], naranja: ["orange"], morado: ["purple"], rosa: ["pink"], gris: ["gray", "grey"]
};

function shopSearchVariants(token) {
  const variants = new Set([token]);
  if (token.endsWith("es") && token.length > 4) variants.add(token.slice(0, -2));
  if (token.endsWith("s") && token.length > 3) variants.add(token.slice(0, -1));
  for (const alias of SHOP_SEARCH_ALIASES[token] ?? []) variants.add(normalizeShopSearch(alias));
  return [...variants].filter(Boolean);
}

function isShopTypoMatch(query, candidate) {
  if (query.length < 4 || candidate.length < 4) return false;
  const allowedDistance = query.length >= 8 ? 2 : 1;
  if (Math.abs(query.length - candidate.length) > allowedDistance) return false;
  let previous = Array.from({ length: candidate.length + 1 }, (_, index) => index);
  for (let row = 1; row <= query.length; row++) {
    const current = [row];
    let rowMin = row;
    for (let column = 1; column <= candidate.length; column++) {
      const cost = query[row - 1] === candidate[column - 1] ? 0 : 1;
      const value = Math.min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + cost);
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > allowedDistance) return false;
    previous = current;
  }
  return previous[candidate.length] <= allowedDistance;
}

function getShopSearchData(item) {
  const haystack = normalizeShopSearch(`${item.name} ${item.id.replace("minecraft:", "")} ${item.searchAliases ?? ""}`);
  return { haystack, compact: haystack.replace(/ /g, ""), tokens: haystack.split(" ").filter(Boolean) };
}

function matchesShopSearch(item, rawQuery, allowTypos = false) {
  const queryTokens = normalizeShopSearch(rawQuery).split(" ").filter(Boolean);
  if (!queryTokens.length) return true;
  const searchData = getShopSearchData(item);
  return queryTokens.every(token => {
    const variants = shopSearchVariants(token);
    if (variants.some(variant => searchData.haystack.includes(variant) || searchData.compact.includes(variant.replace(/ /g, "")))) return true;
    return allowTypos && variants.some(variant => searchData.tokens.some(candidate => isShopTypoMatch(variant, candidate)));
  });
}

function openShopMainMenu(player) {
  if (!player || !player.isValid) return;
  const playerKey = player.name.toLowerCase();
  if (activeShopMenuPlayers.has(playerKey)) return;
  activeShopMenuPlayers.add(playerKey);
  system.runTimeout(() => {
    activeShopMenuPlayers.delete(playerKey);
  }, 10);

  system.runTimeout(() => {
    try {
      cleanupOldDailyLogs();
    } catch (e) {}
  }, 10);

  const bal = getBalance(player);
  const form = new ActionFormData()
    .title("§1§lTienda del Servidor")
    .body(`Tu saldo actual: §a$${formatMoney(bal)}\n\n§7Selecciona una categoría para explorar los objetos:`)
    .button("❔ ¿Cómo funciona? / Guía")
    .button("🔍 Buscar en la Tienda");

  CATEGORIES.forEach((cat) => {
    const icon = CATEGORY_ICONS[cat.name] || "📦";
    form.button(`${icon} ${cat.name}`);
  });

  form.button("💰 Vender Materiales y Objetos");
  form.button("❌ Salir");
  
  safeOpenForm(player, form, (response) => {
    const sel = response.selection;
    if (sel === 0) {
      openShopTutorial(player);
    } else if (sel === 1) {
      openSearchMenu(player);
    } else if (sel >= 2 && sel < 2 + CATEGORIES.length) {
      const catIdx = sel - 2;
      if (CATEGORIES[catIdx].enchantments) {
        openEnchantments(player);
      } else {
        openBuyCategory(player, catIdx);
      }
    } else if (sel === 2 + CATEGORIES.length) {
      openSellMenu(player);
    }
  });
}

function openSearchMenu(player) {
  const form = new ModalFormData()
    .title("🔍 Buscar en la Tienda")
    .textField("Escribe el nombre del objeto que buscas:", "Ej: diamante, madera, lana...");
  
  safeOpenForm(player, form, (response) => {
    const searchTerm = String(response.formValues[0] || "").trim();
    if (!searchTerm) {
      openShopMainMenu(player);
      return;
    }
    
    const directResults = [];
    for (const category of CATEGORIES) {
      if (!category.items) continue;
      for (const item of category.items) {
        if (matchesShopSearch(item, searchTerm)) {
          directResults.push(item);
        }
      }
    }

    // Las coincidencias aproximadas solo se usan si no hubo resultado directo.
    // Así una búsqueda válida no se contamina con objetos meramente parecidos.
    if (directResults.length) {
      openSearchResults(player, directResults, searchTerm);
      return;
    }
    const fuzzyResults = [];
    for (const category of CATEGORIES) {
      if (!category.items) continue;
      for (const item of category.items) {
        if (matchesShopSearch(item, searchTerm, true)) fuzzyResults.push(item);
      }
    }
    openSearchResults(player, fuzzyResults, searchTerm);
  }, () => {
    openShopMainMenu(player);
  });
}

function openSearchResults(player, results, searchTerm, page = 0) {
  const pageCount = Math.max(1, Math.ceil(results.length / SHOP_ITEMS_PER_PAGE));
  const safePage = Math.max(0, Math.min(page, pageCount - 1));
  const pageItems = results.slice(safePage * SHOP_ITEMS_PER_PAGE, (safePage + 1) * SHOP_ITEMS_PER_PAGE);
  const form = new ActionFormData()
    .title("🔍 Resultados de Búsqueda");
  
  if (results.length === 0) {
    form.body(`No se encontraron objetos que coincidan con "§e${searchTerm}§r".`);
  } else {
    form.body(`Se encontraron §a${results.length}§r resultados para "§e${searchTerm}§r". Página ${safePage + 1}/${pageCount}:`);
    pageItems.forEach(item => {
      form.button(`${item.name}\nPrecio: §a$${item.buyPrice}`);
    });
  }
  if (safePage > 0) form.button("⬅ Página anterior");
  if (safePage + 1 < pageCount) form.button("➡ Página siguiente");
  form.button("⬅ Volver al Menú");
  
  safeOpenForm(player, form, (response) => {
    if (results.length === 0) {
      openShopMainMenu(player);
      return;
    }
    if (response.selection < pageItems.length) {
      openPurchaseQuantity(player, pageItems[response.selection], -1);
      return;
    }
    let navigationIndex = pageItems.length;
    if (safePage > 0 && response.selection === navigationIndex++) {
      openSearchResults(player, results, searchTerm, safePage - 1);
      return;
    }
    if (safePage + 1 < pageCount && response.selection === navigationIndex++) {
      openSearchResults(player, results, searchTerm, safePage + 1);
      return;
    }
    openShopMainMenu(player);
  }, () => {
    openSearchMenu(player);
  });
}

function openBuyCategory(player, catIdx, page = 0) {
  const category = CATEGORIES[catIdx];
  const pageCount = Math.max(1, Math.ceil(category.items.length / SHOP_ITEMS_PER_PAGE));
  const safePage = Math.max(0, Math.min(page, pageCount - 1));
  const pageItems = category.items.slice(safePage * SHOP_ITEMS_PER_PAGE, (safePage + 1) * SHOP_ITEMS_PER_PAGE);
  const form = new ActionFormData()
    .title(`§9§lComprar: ${category.name}`)
    .body(`Selecciona un objeto para comprar. Página ${safePage + 1}/${pageCount}:`);

  pageItems.forEach(item => {
    form.button(`${item.name}\nPrecio: §a$${item.buyPrice}`);
  });
  if (safePage > 0) form.button("⬅ Página anterior");
  if (safePage + 1 < pageCount) form.button("➡ Página siguiente");
  form.button("⬅ Volver");

  safeOpenForm(player, form, (response) => {
    if (response.selection < pageItems.length) {
      openPurchaseQuantity(player, pageItems[response.selection], catIdx);
      return;
    }
    let navigationIndex = pageItems.length;
    if (safePage > 0 && response.selection === navigationIndex++) {
      openBuyCategory(player, catIdx, safePage - 1);
      return;
    }
    if (safePage + 1 < pageCount && response.selection === navigationIndex++) {
      openBuyCategory(player, catIdx, safePage + 1);
      return;
    }
    openShopMainMenu(player);
  });
}

function openShopTutorial(player) {
  const form = new ActionFormData()
    .title("❔ Guía de la Tienda")
    .body("§e¿Cómo funciona la Tienda del Servidor?\n\n" +
          "§a1. Comprar Objetos:\n" +
          "§7- Elige cualquier categoría de compra (Materiales, Bloques, Encantamientos, etc.).\n" +
          "§7- Selecciona el objeto y escribe la cantidad exacta que deseas comprar (hasta 9,999 unidades).\n" +
          "§7- Confirma la compra. El saldo se descontará de tu balance y los ítems aparecerán en tu inventario.\n\n" +
          "§a2. Vender Objetos:\n" +
          "§7- Haz clic en la última categoría: §e💰 Vender Materiales y Objetos§7.\n" +
          "§7- Solo se recompran recursos de la lista autorizada, sin metadata, con precio fijo y cuotas diarias.\n\n" +
          "§a3. Encantamientos Directos:\n" +
          "§7- Puedes encantar tus herramientas sosteniéndolas en la mano principal y entrando en §e✨ Encantamientos§7. Elige el encantamiento y su nivel pagando con dinero del juego.")
    .button("🔙 Volver");

  safeOpenForm(player, form, () => {
    openShopMainMenu(player);
  });
}

function openPurchaseQuantity(player, item, catIdx) {
  const bal = getBalance(player);
  const unitPrice = Math.floor(Number(item?.buyPrice));
  if (!Number.isSafeInteger(unitPrice) || unitPrice <= 0) {
    player.sendMessage("§b§l[§3Tienda§b§l]§r §cEste objeto tiene un precio inválido y no está disponible temporalmente.");
    return;
  }
  
  const form = new ModalFormData()
    .title(`§d§lComprar: ${item.name}`)
    .textField(
      `Precio por unidad: §a$${formatMoney(unitPrice)}§r\nTu saldo: §a$${formatMoney(bal)}§r\n\nEscribe la cantidad exacta a comprar (1-${MAX_PURCHASE_QUANTITY}):`,
      `Cantidad (1-${MAX_PURCHASE_QUANTITY})`,
      { defaultValue: "1" }
    );
  
  safeOpenForm(player, form, (response) => {
    const operationKey = beginEconomyOperation(player);
    if (!operationKey) {
      player.sendMessage("§b§l[§3Tienda§b§l]§r §cYa tienes otra operación económica en curso.");
      return;
    }
    try {
    const qtyText = String(response.formValues[0] ?? "").trim();
    if (!/^[1-9]\d{0,3}$/.test(qtyText)) {
      player.sendMessage(`§b§l[§3Tienda§b§l]§r §cEscribe un número entero entre 1 y ${MAX_PURCHASE_QUANTITY}.`);
      return;
    }
    const qty = Number(qtyText);
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > MAX_PURCHASE_QUANTITY) {
      player.sendMessage(`§b§l[§3Tienda§b§l]§r §cLa cantidad debe estar entre 1 y ${MAX_PURCHASE_QUANTITY}.`);
      return;
    }
    
    const cost = unitPrice * qty;
    const configuredBuyTaxRate = Math.floor(Number(globalThis.__sqlite_get_prop_v2__("shop_addon", "world", "tax_shop_buy_rate_v1") ?? 5));
    const buyTaxRate = Number.isSafeInteger(configuredBuyTaxRate) && configuredBuyTaxRate >= 0 && configuredBuyTaxRate <= 100
      ? configuredBuyTaxRate
      : 5;
    const taxAmount = Math.ceil(cost * (buyTaxRate / 100));
    const finalCost = cost + taxAmount;
    if (!Number.isSafeInteger(cost) || !Number.isSafeInteger(taxAmount) || !Number.isSafeInteger(finalCost) || finalCost <= 0 || finalCost > MAX_SCOREBOARD_BALANCE) {
      player.sendMessage("§b§l[§3Tienda§b§l]§r §cEl costo calculado excede el límite seguro de la economía.");
      return;
    }
    const currentBal = getBalance(player);
    
    if (currentBal < finalCost) {
      player.sendMessage(`§b§l[§3Tienda§b§l]§r §cNo tienes saldo suficiente. Costo + IVA: §a$${formatMoney(finalCost)} §7(Impuesto IVA: §a$${formatMoney(taxAmount)}§7), Tienes: §a$${formatMoney(currentBal)}§c.`);
      return;
    }
    
    const debit = changeBalance(player, -Math.ceil(finalCost));
    if (!debit.ok) {
      player.sendMessage("§b§l[§3Tienda§b§l]§r §cNo se pudo confirmar el débito. Compra cancelada.");
      return;
    }

    try {
      const currentVault = Number(globalThis.__sqlite_get_prop_v2__("shop_addon", "world", "bank_vault_funds") ?? 0);
      globalThis.__sqlite_set_prop_v2__("shop_addon", "world", "bank_vault_funds", currentVault + Math.ceil(finalCost));
      console.warn("[Shop Addon] bank_vault_funds actualizado: " + (currentVault + Math.ceil(finalCost)));
    } catch (e) {
      console.warn("[Shop Addon] Error actualizando bank_vault_funds en compra de item: " + e);
    }

    const delivered = giveItem(player, item, qty);
    if (!delivered) {
      const refund = changeBalance(player, Math.ceil(finalCost));
      if (!refund.ok) console.warn(`[ECONOMY_CRITICAL] No se pudo reembolsar una compra fallida a ${player.name}.`);
      else {
        try {
          const currentVault = Number(globalThis.__sqlite_get_prop_v2__("shop_addon", "world", "bank_vault_funds") ?? 0);
          globalThis.__sqlite_set_prop_v2__("shop_addon", "world", "bank_vault_funds", Math.max(0, currentVault - Math.ceil(finalCost)));
          console.warn("[Shop Addon] bank_vault_funds revertido: " + Math.max(0, currentVault - Math.ceil(finalCost)));
        } catch (e) {
          console.warn("[Shop Addon] Error devolviendo bank_vault_funds en compra de item: " + e);
        }
      }
      player.sendMessage(`§b§l[§3Tienda§b§l]§r §cNo se pudo entregar §e${item.name}§c. La compra fue revertida.`);
      return;
    }

    player.sendMessage(`§b§l[§3Tienda§b§l]§r §aHas comprado §e${qty}x ${item.name} §apor §e$${formatMoney(finalCost)} §7(Impuesto IVA: §a$${formatMoney(taxAmount)}§7)§a.`);
    logShopTransaction(player.name, "Compra", finalCost, `Compró ${qty}x ${item.name}`);
    console.warn(`[ECONOMY_LOG] [BUY] Player ${player.name} bought ${qty}x ${item.name} (${item.id}) for $${formatMoney(cost)}`);
    } finally {
      endEconomyOperation(operationKey);
    }
  }, () => {
    if (catIdx >= 0) {
      openBuyCategory(player, catIdx);
    } else {
      openShopMainMenu(player);
    }
  });
}

function getEnchantmentsCategory() {
  return CATEGORIES.find(c => c.name === "Libros Encantados" || c.enchantments !== undefined);
}

function openEnchantments(player) {
  const category = getEnchantmentsCategory();
  if (!category || !category.enchantments) {
    player.sendMessage("§b§l[§3Tienda§b§l]§r §cLa categoría de encantamientos no está disponible.");
    return;
  }
  const form = new ActionFormData()
    .title("§5§lTienda: Encantamientos")
    .body("Compra libros encantados para aplicarlos luego con yunque.\nSelecciona el encantamiento deseado:");
  
  category.enchantments.forEach(enc => {
    form.button(`${enc.name}\nCosto: §a$${formatMoney(enc.buyPrice)}`);
  });
  form.button("⬅ Volver");
  
  safeOpenForm(player, form, (response) => {
    if (response.selection === category.enchantments.length) {
      openShopMainMenu(player);
      return;
    }
    const enc = category.enchantments[response.selection];
    tryGiveEnchantedBook(player, enc.id, enc.buyPrice, enc.level);
  });
}

function getPlayerInventoryItems(player) {
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return [];
  
  const itemsMap = new Map();
  for (let i = 0; i < container.size; i++) {
    const itemStack = container.getItem(i);
    if (itemStack && isPlainSellableItemStack(itemStack)) {
      const isSemilla = itemStack.nameTag && itemStack.nameTag.includes("Semilla Sagrada");
      const key = isSemilla ? "semilla_sagrada" : itemStack.typeId;
      const amount = itemStack.amount;
      
      let friendlyName = isSemilla ? "§6Semilla Sagrada" : itemStack.typeId.split(":")[1].replace(/_/g, " ");
      if (!isSemilla) {
        friendlyName = friendlyName.charAt(0).toUpperCase() + friendlyName.slice(1);
        for (const cat of CATEGORIES) {
          if (cat.items) {
            const shopItem = cat.items.find(item => item.id === itemStack.typeId);
            if (shopItem) {
              friendlyName = shopItem.name;
              break;
            }
          }
        }
      }
      
      if (itemsMap.has(key)) {
        itemsMap.get(key).qty += amount;
      } else {
        itemsMap.set(key, {
          id: itemStack.typeId,
          key: key,
          name: friendlyName,
          qty: amount,
          isSemillaSagrada: isSemilla
        });
      }
    }
  }
  return Array.from(itemsMap.values());
}

function getItemBasePrice(typeId, itemKey = null) {
  if (itemKey === "semilla_sagrada" || typeId === "semilla_sagrada") return 300;
  if (typeId === "minecraft:enchanted_book") return 500;
  return SELL_RULES.get(typeId)?.price ?? 0;
}

function quotaHourUtc() {
  return new Date().toISOString().slice(0, 13);
}

function formatSaleQuotaTimeRemaining(now = Date.now()) {
  const remainingMs = 60 * 60 * 1000 - (now % (60 * 60 * 1000));
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `§e${minutes}m ${seconds}s`;
}

function getSaleQuotaState(player) {
  const empty = { hour: quotaHourUtc(), payout: 0 };
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("shop_addon", player, SELL_QUOTA_PROPERTY);
    if (!raw) return empty;
    const parsed = JSON.parse(String(raw));
    if (parsed?.hour !== empty.hour) return empty;
    return {
      hour: empty.hour,
      payout: Math.max(0, Math.floor(Number(parsed.payout) || 0))
    };
  } catch (e) {
    ErrorReporter.report(e, { addonId: "shop_addon", moduleId: "main.js", operation: "getSaleQuotaState", category: "runtime" });
    return { hour: empty.hour, payout: SELL_HOURLY_PAYOUT_LIMIT, unavailable: true };
  }
}

function saveSaleQuotaState(player, state) {
  try {
    const serialized = JSON.stringify(state);
    globalThis.__sqlite_set_prop_v2__("shop_addon", player, SELL_QUOTA_PROPERTY, serialized);
    return String(globalThis.__sqlite_get_prop_v2__("shop_addon", player, SELL_QUOTA_PROPERTY) ?? "") === serialized;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "shop_addon", moduleId: "main.js", operation: "saveSaleQuotaState", category: "runtime" });
    return false;
  }
}

function notifyExpiredHourlySaleQuotas() {
  const currentHour = quotaHourUtc();
  for (const player of world.getAllPlayers()) {
    try {
      const raw = globalThis.__sqlite_get_prop_v2__("shop_addon", player, SELL_QUOTA_PROPERTY);
      if (!raw) continue;
      const previous = JSON.parse(String(raw));
      if (previous?.hour === currentHour || Number(previous?.payout) < SELL_HOURLY_PAYOUT_LIMIT) continue;
      if (globalThis.__sqlite_get_prop_v2__("shop_addon", player, SELL_QUOTA_NOTICE_PROPERTY) === previous.hour) continue;
      globalThis.__sqlite_set_prop_v2__("shop_addon", player, SELL_QUOTA_NOTICE_PROPERTY, previous.hour);
      player.sendMessage(`§b§l[§3Tienda§b§l]§r §aTu límite de ventas de §e$${formatMoney(SELL_HOURLY_PAYOUT_LIMIT)} §ase reinició. Ya puedes vender de nuevo.`);
    } catch (e) {
      ErrorReporter.report(e, { addonId: "shop_addon", moduleId: "main.js", operation: "notifyExpiredHourlySaleQuotas", category: "runtime" });
    }
  }
}

system.runInterval(notifyExpiredHourlySaleQuotas, 20 * 20);

function getEmissionBudget(player) {
  const day = Math.floor(Date.now() / 86400000);
  try {
    const dayObjective = world.scoreboard.getObjective("emission_day") || world.scoreboard.addObjective("emission_day", "Emission Day");
    const earnedObjective = world.scoreboard.getObjective("emission_earned") || world.scoreboard.addObjective("emission_earned", "Emission Earned");
    const storedDay = Number(dayObjective.getScore(player) ?? -1);
    if (storedDay !== day) {
      if (storedDay !== -1) return { day, earned: 0 };
      const raw = globalThis.__sqlite_get_prop_v2__("shop_addon", player, "economy_emission_budget_v1");
      if (!raw) return { day, earned: 0 };
      const legacy = JSON.parse(String(raw));
      const legacyEarned = Number(legacy?.earned);
      if (Number(legacy?.day) !== day || !Number.isSafeInteger(legacyEarned) || legacyEarned < 0 || legacyEarned > ECONOMY_DAILY_EMISSION_LIMIT) return null;
      dayObjective.setScore(player, day);
      earnedObjective.setScore(player, legacyEarned);
      return { day, earned: legacyEarned };
    }
    const earned = Number(earnedObjective.getScore(player) ?? 0);
    if (!Number.isSafeInteger(earned) || earned < 0 || earned > ECONOMY_DAILY_EMISSION_LIMIT) return null;
    return { day, earned };
  } catch (e) {
    ErrorReporter.report(e, { addonId: "shop_addon", moduleId: "main.js", operation: "getEmissionBudget", category: "runtime" });
    return null;
  }
}

function saveEmissionBudget(player, state) {
  try {
    const dayObjective = world.scoreboard.getObjective("emission_day") || world.scoreboard.addObjective("emission_day", "Emission Day");
    const earnedObjective = world.scoreboard.getObjective("emission_earned") || world.scoreboard.addObjective("emission_earned", "Emission Earned");
    dayObjective.setScore(player, Math.floor(Number(state.day) || 0));
    earnedObjective.setScore(player, Math.max(0, Math.floor(Number(state.earned) || 0)));
    return true;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "shop_addon", moduleId: "main.js", operation: "saveEmissionBudget", category: "runtime" });
    return false;
  }
}

function reserveEmission(player, amount, reason) {
  const delta = Math.floor(Number(amount) || 0);
  const previous = getEmissionBudget(player);
  if (!previous || delta <= 0 || previous.earned + delta > ECONOMY_DAILY_EMISSION_LIMIT) {
    console.warn(`[ECONOMY_TX] REJECT player=${player?.name || "unknown"} delta=${delta} reason=${reason} cause=emission_budget`);
    return null;
  }
  const reserved = { day: previous.day, earned: previous.earned + delta };
  if (!saveEmissionBudget(player, reserved)) {
    saveEmissionBudget(player, previous);
    console.warn(`[ECONOMY_TX] REJECT player=${player?.name || "unknown"} delta=${delta} reason=${reason} cause=emission_persistence`);
    return null;
  }
  return { previous, reserved, delta, reason };
}

function rollbackEmission(player, reservation) {
  const current = getEmissionBudget(player);
  if (!current || current.day !== reservation.reserved.day || current.earned !== reservation.reserved.earned || !saveEmissionBudget(player, reservation.previous)) {
    console.warn(`[ECONOMY_CRITICAL] emission_rollback_failed player=${player?.name || "unknown"} delta=${reservation.delta} reason=${reservation.reason}`);
    return false;
  }
  return true;
}

function commitEmission(player, reservation) {
  console.warn(`[ECONOMY_TX] COMMIT player=${player?.name || "unknown"} delta=${reservation.delta} reason=${reservation.reason} emission_today=${reservation.reserved.earned} emission_limit=${ECONOMY_DAILY_EMISSION_LIMIT}`);
}

function getSaleAllowance(typeId, available, state) {
  if (!state || state.unavailable === true) return 0;
  let rule = SELL_RULES.get(typeId);
  if (!rule && (typeId === "semilla_sagrada" || typeId === "minecraft:wheat_seeds")) {
    rule = { price: 300 };
  }
  if (!rule && typeId === "minecraft:enchanted_book") {
    rule = { price: 500 };
  }
  if (!rule) return 0;
  const payoutRemaining = Math.max(0, SELL_HOURLY_PAYOUT_LIMIT - state.payout);
  return Math.max(0, Math.min(
    Math.floor(Number(available) || 0),
    Math.floor(payoutRemaining / rule.price)
  ));
}

function openSellMenu(player) {
  const quotaState = getSaleQuotaState(player);
  const payoutRemaining = Math.max(0, SELL_HOURLY_PAYOUT_LIMIT - quotaState.payout);
  const quotaSummary =
    `§6§lCUPO DE VENTAS (1 HORA)§r\n` +
    `§fVendido: §a$${formatMoney(quotaState.payout)} §7/ §e$${formatMoney(SELL_HOURLY_PAYOUT_LIMIT)}\n` +
    `§fDisponible: §a$${formatMoney(payoutRemaining)}\n` +
    `§fSe reinicia en: ${formatSaleQuotaTimeRemaining()}`;
  const form = new ActionFormData()
    .title("§2§l💰 VENDER MATERIALES")
    .body(quotaSummary);
  
  const sellableItems = getPlayerInventoryItems(player);
  
  if (sellableItems.length === 0) {
    form.body(`${quotaSummary}\n\n§7No tienes objetos vendibles en tu inventario.\n§8Los items especiales, libros, llaves y objetos custom no se pueden vender.`);
    form.button("⬅ Volver");
    safeOpenForm(player, form, () => {
      openShopMainMenu(player);
    });
    return;
  }
  
  sellableItems.forEach(item => {
    const itemKey = item.key || item.id;
    const basePrice = getItemBasePrice(item.id, itemKey);
    const allowance = getSaleAllowance(itemKey, item.qty, quotaState);
    form.button(`§0${item.name} (Tienes: ${item.qty})\n§7Precio: §a$${formatMoney(basePrice)} §7| Disponible esta hora: §e${allowance}`);
  });
  form.button("⬅ Volver");
  
  safeOpenForm(player, form, (response) => {
    if (response.selection === sellableItems.length) {
      openShopMainMenu(player);
      return;
    }
    const item = sellableItems[response.selection];
    const itemKey = item.key || item.id;
    const qtyInInventory = countItem(player, item.id, itemKey);
    
    if (qtyInInventory <= 0) {
      player.sendMessage(`§b§l[§3Tienda§b§l]§r §cNo tienes §e${item.name} §cen tu inventario para vender.`);
      return;
    }
    
    openSellQuantity(player, item, qtyInInventory);
  });
}

function openSellQuantity(player, item, qtyInInventory) {
  const itemKey = item.key || item.id;
  const basePrice = getItemBasePrice(item.id, itemKey);
  const allowedNow = getSaleAllowance(itemKey, qtyInInventory, getSaleQuotaState(player));
  if (basePrice <= 0 || allowedNow <= 0) {
    player.sendMessage("§b§l[§3Tienda§b§l]§r §cLa cuota horaria de ese objeto está agotada.");
    return;
  }

  const form = new ModalFormData()
    .title(`§2§lVender: ${item.name}`)
    .textField(
      `Precio fijo: §a$${formatMoney(basePrice)} c/u§r\nPuedes vender esta hora: §e${allowedNow} unidades§r\n\nEscribe la cantidad exacta a vender:`,
      "Cantidad",
      { defaultValue: String(allowedNow) }
    )
    .slider("O arrastra esta barra para seleccionar:", 1, allowedNow)
    .toggle("¿Deseas vender TODO?", { defaultValue: false });
  
  safeOpenForm(player, form, (response) => {
    const operationKey = beginEconomyOperation(player);
    if (!operationKey) {
      player.sendMessage("§b§l[§3Tienda§b§l]§r §cYa tienes otra operación económica en curso.");
      return;
    }
    try {
    const qtyText = response.formValues[0];
    const qtySlider = response.formValues[1];
    const sellAll = response.formValues[2];
    
    let qty = allowedNow;
    const parsedText = parseInt(qtyText);
    const defaultText = String(allowedNow);
    if (sellAll) {
      qty = allowedNow;
    } else if (qtyText !== defaultText && !isNaN(parsedText) && parsedText > 0) {
      qty = parsedText;
    } else {
      qty = qtySlider;
    }
    
    const currentQty = countItem(player, item.id, itemKey);
    const quotaBefore = getSaleQuotaState(player);
    const allowance = getSaleAllowance(itemKey, currentQty, quotaBefore);
    const finalQty = Math.min(allowance, Math.max(0, Math.floor(qty)));
    
    if (finalQty <= 0) {
      player.sendMessage("§b§l[§3Tienda§b§l]§r §cNo tienes suficientes objetos para vender.");
      return;
    }
    
    const totalEarnings = basePrice * finalQty;

    if (totalEarnings <= 0) {
      player.sendMessage("§b§l[§3Tienda§b§l]§r §cEse objeto no tiene valor de reventa en la tienda.");
      return;
    }
    if (getBalance(player) + totalEarnings > MAX_OPERATIONAL_BALANCE) {
      player.sendMessage("§b§l[§3Tienda§b§l]§r §cTu saldo alcanzó el límite operativo. No se retiraron objetos.");
      return;
    }
    
    const taken = takeItems(player, item.id, finalQty, itemKey);
    if (taken.quantity !== finalQty) {
      restoreTakenItems(player, taken.stacks);
      player.sendMessage("§b§l[§3Tienda§b§l]§r §cNo se pudieron retirar los objetos del inventario. Venta cancelada.");
      return;
    }

    const quotaAfter = {
      ...quotaBefore,
      payout: quotaBefore.payout + totalEarnings
    };
    if (!saveSaleQuotaState(player, quotaAfter)) {
      restoreTakenItems(player, taken.stacks);
      player.sendMessage("§b§l[§3Tienda§b§l]§r §cNo se pudo reservar tu cuota de venta. Operación revertida.");
      return;
    }

    const sellTaxRate = Number(globalThis.__sqlite_get_prop_v2__("shop_addon", "world", "tax_shop_sell_rate_v1") ?? 5);
    const taxAmount = Math.floor(totalEarnings * (sellTaxRate / 100));
    const netEarnings = totalEarnings - taxAmount;

    const credit = changeBalance(player, netEarnings);
    if (!credit.ok) {
      saveSaleQuotaState(player, quotaBefore);
      restoreTakenItems(player, taken.stacks);
      player.sendMessage("§b§l[§3Tienda§b§l]§r §cNo se pudo confirmar el pago. Operación revertida.");
      return;
    }

    if (taxAmount > 0) {
      try {
        const currentVault = Number(globalThis.__sqlite_get_prop_v2__("shop_addon", "world", "bank_vault_funds") ?? 0);
        globalThis.__sqlite_set_prop_v2__("shop_addon", "world", "bank_vault_funds", currentVault + taxAmount);
      } catch (e) {
        console.warn("[Shop Addon] Error actualizando bank_vault_funds en retencion de venta: " + e);
      }
    }
    
    player.sendMessage(`§b§l[§3Tienda§b§l]§r §aHas vendido §e${finalQty}x ${item.name} §apor un total neto de §e$${formatMoney(netEarnings)} §7(Retención Arancel: §c$${formatMoney(taxAmount)}§7)§a.`);
    logShopTransaction(player.name, "Venta", netEarnings, `Vendió ${finalQty}x ${item.name} (Retención: $${taxAmount})`);
    console.warn(`[ECONOMY_LOG] [SELL] Player ${player.name} sold ${finalQty}x ${item.name} (${item.id}) for $${formatMoney(totalEarnings)} (Tax: $${taxAmount})`);
    } finally {
      endEconomyOperation(operationKey);
    }
  }, () => {
    openSellMenu(player);
  });
}

// NPC Interacción para Máquina de Comida
try {
  world.afterEvents.playerInteractWithEntity.subscribe((event) => {
    const target = event.target;
    const player = event.player;
    if (target.hasTag("npc_maquinacomida")) {
      system.runTimeout(() => {
        openBuyCategory(player, 3);
      }, 5);
    }
  });
} catch (e) { ErrorReporter.report(e, { addonId: "shop_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Shop UI Addon] Error registrando evento de interaccion con NPC de comida: " + e);
}
