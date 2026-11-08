import { ErrorReporter } from "./ErrorReporter.js";
import { CommandPermissionLevel, CustomCommandStatus, world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";






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
globalThis.__sqlite_sync_complete_v2__.delete("quests_addon");
globalThis.__sqlite_request_sync_v3__("quests_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("quests_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("quests_addon", 1);
  } catch (e) {}
}, 120);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
console.warn("Side Quests Addon iniciado.");
const COMMAND_NAMESPACE = "s";
const QUEST_REWARDS_PAID_KEY = "quests_rewards_paid_v1";
const MAX_OPERATIONAL_BALANCE = 100000000;
const ECONOMY_DAILY_EMISSION_LIMIT = 50000;
const PLACED_BLOCK_BUCKET_PREFIX = "quests_placed_block_v1";
const MAX_TRACKED_BLOCKS_PER_BUCKET = 2048;
let placedBlockTrackingHealthy = true;

function commandOk(message) {
  return { status: CustomCommandStatus.Success, message };
}

function commandError(message) {
  return { status: CustomCommandStatus.Failure, message };
}

// Misiones secundarias acumulativas. Los IDs son permanentes porque también
// identifican el progreso y el pago único persistidos de cada jugador.
const QUESTS = [
  // === MINERÍA ===
  // Carbón
  { id: "mine_coal_1", title: "Minero de Carbón I", description: "Pica mineral de carbón.", type: "break", target: ["minecraft:coal_ore", "minecraft:deepslate_coal_ore"], required: 16, reward: 80 },
  { id: "mine_coal_2", title: "Minero de Carbón II", description: "Pica mineral de carbón.", type: "break", target: ["minecraft:coal_ore", "minecraft:deepslate_coal_ore"], required: 64, reward: 250 },
  { id: "mine_coal_3", title: "Minero de Carbón III", description: "Pica mineral de carbón.", type: "break", target: ["minecraft:coal_ore", "minecraft:deepslate_coal_ore"], required: 256, reward: 800 },
  { id: "mine_coal_4", title: "Minero de Carbón IV", description: "Pica mineral de carbón.", type: "break", target: ["minecraft:coal_ore", "minecraft:deepslate_coal_ore"], required: 1024, reward: 3000 },
  // Hierro
  { id: "mine_iron_1", title: "Edad de Hierro I", description: "Pica mineral de hierro.", type: "break", target: ["minecraft:iron_ore", "minecraft:deepslate_iron_ore"], required: 10, reward: 120 },
  { id: "mine_iron_2", title: "Edad de Hierro II", description: "Pica mineral de hierro.", type: "break", target: ["minecraft:iron_ore", "minecraft:deepslate_iron_ore"], required: 32, reward: 350 },
  { id: "mine_iron_3", title: "Edad de Hierro III", description: "Pica mineral de hierro.", type: "break", target: ["minecraft:iron_ore", "minecraft:deepslate_iron_ore"], required: 128, reward: 1200 },
  { id: "mine_iron_4", title: "Edad de Hierro IV", description: "Pica mineral de hierro.", type: "break", target: ["minecraft:iron_ore", "minecraft:deepslate_iron_ore"], required: 512, reward: 6000 },
  // Oro
  { id: "mine_gold_1", title: "Fiebre del Oro I", description: "Pica mineral de oro.", type: "break", target: ["minecraft:gold_ore", "minecraft:deepslate_gold_ore"], required: 8, reward: 180 },
  { id: "mine_gold_2", title: "Fiebre del Oro II", description: "Pica mineral de oro.", type: "break", target: ["minecraft:gold_ore", "minecraft:deepslate_gold_ore"], required: 20, reward: 450 },
  { id: "mine_gold_3", title: "Fiebre del Oro III", description: "Pica mineral de oro.", type: "break", target: ["minecraft:gold_ore", "minecraft:deepslate_gold_ore"], required: 64, reward: 1500 },
  { id: "mine_gold_4", title: "Fiebre del Oro IV", description: "Pica mineral de oro.", type: "break", target: ["minecraft:gold_ore", "minecraft:deepslate_gold_ore"], required: 256, reward: 7500 },
  // Oro del Nether
  { id: "mine_nether_gold_1", title: "Prospector Carmesí I", description: "Pica mineral de oro del Nether.", type: "break", target: ["minecraft:nether_gold_ore"], required: 32, reward: 200 },
  { id: "mine_nether_gold_2", title: "Prospector Carmesí II", description: "Pica mineral de oro del Nether.", type: "break", target: ["minecraft:nether_gold_ore"], required: 128, reward: 700 },
  { id: "mine_nether_gold_3", title: "Prospector Carmesí III", description: "Pica mineral de oro del Nether.", type: "break", target: ["minecraft:nether_gold_ore"], required: 512, reward: 2500 },
  // Redstone
  { id: "mine_redstone_1", title: "Energía Roja I", description: "Pica mineral de redstone.", type: "break", target: ["minecraft:redstone_ore", "minecraft:deepslate_redstone_ore"], required: 10, reward: 100 },
  { id: "mine_redstone_2", title: "Energía Roja II", description: "Pica mineral de redstone.", type: "break", target: ["minecraft:redstone_ore", "minecraft:deepslate_redstone_ore"], required: 32, reward: 320 },
  { id: "mine_redstone_3", title: "Energía Roja III", description: "Pica mineral de redstone.", type: "break", target: ["minecraft:redstone_ore", "minecraft:deepslate_redstone_ore"], required: 128, reward: 1100 },
  { id: "mine_redstone_4", title: "Energía Roja IV", description: "Pica mineral de redstone.", type: "break", target: ["minecraft:redstone_ore", "minecraft:deepslate_redstone_ore"], required: 512, reward: 5000 },
  // Lapislázuli
  { id: "mine_lapis_1", title: "Cazador de Lapis I", description: "Pica mineral de lapislázuli.", type: "break", target: ["minecraft:lapis_ore", "minecraft:deepslate_lapis_ore"], required: 8, reward: 100 },
  { id: "mine_lapis_2", title: "Cazador de Lapis II", description: "Pica mineral de lapislázuli.", type: "break", target: ["minecraft:lapis_ore", "minecraft:deepslate_lapis_ore"], required: 25, reward: 300 },
  { id: "mine_lapis_3", title: "Cazador de Lapis III", description: "Pica mineral de lapislázuli.", type: "break", target: ["minecraft:lapis_ore", "minecraft:deepslate_lapis_ore"], required: 100, reward: 1100 },
  { id: "mine_lapis_4", title: "Cazador de Lapis IV", description: "Pica mineral de lapislázuli.", type: "break", target: ["minecraft:lapis_ore", "minecraft:deepslate_lapis_ore"], required: 400, reward: 4500 },
  // Cobre
  { id: "mine_copper_1", title: "Extractor de Cobre I", description: "Pica mineral de cobre.", type: "break", target: ["minecraft:copper_ore", "minecraft:deepslate_copper_ore"], required: 16, reward: 80 },
  { id: "mine_copper_2", title: "Extractor de Cobre II", description: "Pica mineral de cobre.", type: "break", target: ["minecraft:copper_ore", "minecraft:deepslate_copper_ore"], required: 64, reward: 250 },
  { id: "mine_copper_3", title: "Extractor de Cobre III", description: "Pica mineral de cobre.", type: "break", target: ["minecraft:copper_ore", "minecraft:deepslate_copper_ore"], required: 256, reward: 800 },
  { id: "mine_copper_4", title: "Extractor de Cobre IV", description: "Pica mineral de cobre.", type: "break", target: ["minecraft:copper_ore", "minecraft:deepslate_copper_ore"], required: 1024, reward: 3000 },
  // Diamante
  { id: "mine_diamond_1", title: "Riqueza Azul I", description: "Pica mineral de diamante.", type: "break", target: ["minecraft:diamond_ore", "minecraft:deepslate_diamond_ore"], required: 3, reward: 400 },
  { id: "mine_diamond_2", title: "Riqueza Azul II", description: "Pica mineral de diamante.", type: "break", target: ["minecraft:diamond_ore", "minecraft:deepslate_diamond_ore"], required: 12, reward: 1500 },
  { id: "mine_diamond_3", title: "Riqueza Azul III", description: "Pica mineral de diamante.", type: "break", target: ["minecraft:diamond_ore", "minecraft:deepslate_diamond_ore"], required: 48, reward: 6000 },
  { id: "mine_diamond_4", title: "Riqueza Azul IV", description: "Pica mineral de diamante.", type: "break", target: ["minecraft:diamond_ore", "minecraft:deepslate_diamond_ore"], required: 96, reward: 12000 },
  // Esmeralda
  { id: "mine_emerald_1", title: "Comerciante Nato I", description: "Pica mineral de esmeralda.", type: "break", target: ["minecraft:emerald_ore", "minecraft:deepslate_emerald_ore"], required: 2, reward: 300 },
  { id: "mine_emerald_2", title: "Comerciante Nato II", description: "Pica mineral de esmeralda.", type: "break", target: ["minecraft:emerald_ore", "minecraft:deepslate_emerald_ore"], required: 6, reward: 900 },
  { id: "mine_emerald_3", title: "Comerciante Nato III", description: "Pica mineral de esmeralda.", type: "break", target: ["minecraft:emerald_ore", "minecraft:deepslate_emerald_ore"], required: 24, reward: 4000 },
  { id: "mine_emerald_4", title: "Comerciante Nato IV", description: "Pica mineral de esmeralda.", type: "break", target: ["minecraft:emerald_ore", "minecraft:deepslate_emerald_ore"], required: 48, reward: 8000 },
  // Cuarzo del Nether
  { id: "mine_quartz_1", title: "Brillo del Nether I", description: "Pica bloques de mineral de cuarzo.", type: "break", target: ["minecraft:quartz_ore"], required: 15, reward: 150 },
  { id: "mine_quartz_2", title: "Brillo del Nether II", description: "Pica bloques de mineral de cuarzo.", type: "break", target: ["minecraft:quartz_ore"], required: 60, reward: 550 },
  { id: "mine_quartz_3", title: "Brillo del Nether III", description: "Pica bloques de mineral de cuarzo.", type: "break", target: ["minecraft:quartz_ore"], required: 240, reward: 2000 },
  { id: "mine_quartz_4", title: "Brillo del Nether IV", description: "Pica bloques de mineral de cuarzo.", type: "break", target: ["minecraft:quartz_ore"], required: 960, reward: 7000 },
  // Debris Ancestral
  { id: "mine_debris_1", title: "Buscador Ancestral I", description: "Pica escombro ancestral.", type: "break", target: ["minecraft:ancient_debris"], required: 1, reward: 700 },
  { id: "mine_debris_2", title: "Buscador Ancestral II", description: "Pica escombro ancestral.", type: "break", target: ["minecraft:ancient_debris"], required: 4, reward: 2500 },
  { id: "mine_debris_3", title: "Buscador Ancestral III", description: "Pica escombro ancestral.", type: "break", target: ["minecraft:ancient_debris"], required: 16, reward: 10000 },
  { id: "mine_debris_4", title: "Buscador Ancestral IV", description: "Pica escombro ancestral.", type: "break", target: ["minecraft:ancient_debris"], required: 32, reward: 18000 },
  // Obsidiana (Picar)
  { id: "mine_obsidian_1", title: "Forjador de Escudos I", description: "Pica bloques de obsidiana.", type: "break", target: ["minecraft:obsidian"], required: 10, reward: 200 },
  { id: "mine_obsidian_2", title: "Forjador de Escudos II", description: "Pica bloques de obsidiana.", type: "break", target: ["minecraft:obsidian"], required: 50, reward: 900 },
  // Piedra / Cobblestone (Picar)
  { id: "mine_stone_1", title: "Cantero Común I", description: "Pica bloques de piedra o piedra labrada.", type: "break", target: ["minecraft:stone", "minecraft:cobblestone", "minecraft:deepslate"], required: 100, reward: 100 },
  { id: "mine_stone_2", title: "Cantero Común II", description: "Pica bloques de piedra o piedra labrada.", type: "break", target: ["minecraft:stone", "minecraft:cobblestone", "minecraft:deepslate"], required: 500, reward: 400 },
  { id: "mine_stone_3", title: "Cantero Común III", description: "Pica bloques de piedra o piedra labrada.", type: "break", target: ["minecraft:stone", "minecraft:cobblestone", "minecraft:deepslate"], required: 2000, reward: 1500 },
  // Basalto
  { id: "mine_basalt_1", title: "Tierras Volcánicas I", description: "Pica bloques de basalto.", type: "break", target: ["minecraft:basalt", "minecraft:polished_basalt"], required: 30, reward: 100 },
  { id: "mine_basalt_2", title: "Tierras Volcánicas II", description: "Pica bloques de basalto.", type: "break", target: ["minecraft:basalt", "minecraft:polished_basalt"], required: 150, reward: 450 },
  // Netherrack
  { id: "mine_netherrack_1", title: "Infierno Rojo I", description: "Pica bloques de netherrack.", type: "break", target: ["minecraft:netherrack"], required: 100, reward: 80 },
  { id: "mine_netherrack_2", title: "Infierno Rojo II", description: "Pica bloques de netherrack.", type: "break", target: ["minecraft:netherrack"], required: 1000, reward: 600 },

  // === COMBATE ===
  // Zombis
  { id: "kill_zombie_1", title: "Exterminador de Zombis I", description: "Elimina zombis o husks.", type: "kill", target: ["minecraft:zombie", "minecraft:husk"], required: 10, reward: 120 },
  { id: "kill_zombie_2", title: "Exterminador de Zombis II", description: "Elimina zombis o husks.", type: "kill", target: ["minecraft:zombie", "minecraft:husk"], required: 30, reward: 350 },
  { id: "kill_zombie_3", title: "Exterminador de Zombis III", description: "Elimina zombis o husks.", type: "kill", target: ["minecraft:zombie", "minecraft:husk"], required: 120, reward: 1300 },
  { id: "kill_zombie_4", title: "Exterminador de Zombis IV", description: "Elimina zombis o husks.", type: "kill", target: ["minecraft:zombie", "minecraft:husk"], required: 400, reward: 5000 },
  // Esqueletos
  { id: "kill_skeleton_1", title: "Cazador de Huesos I", description: "Elimina esqueletos o strays.", type: "kill", target: ["minecraft:skeleton", "minecraft:stray"], required: 10, reward: 120 },
  { id: "kill_skeleton_2", title: "Cazador de Huesos II", description: "Elimina esqueletos o strays.", type: "kill", target: ["minecraft:skeleton", "minecraft:stray"], required: 30, reward: 350 },
  { id: "kill_skeleton_3", title: "Cazador de Huesos III", description: "Elimina esqueletos o strays.", type: "kill", target: ["minecraft:skeleton", "minecraft:stray"], required: 120, reward: 1300 },
  { id: "kill_skeleton_4", title: "Cazador de Huesos IV", description: "Elimina esqueletos o strays.", type: "kill", target: ["minecraft:skeleton", "minecraft:stray"], required: 400, reward: 5000 },
  // Creepers
  { id: "kill_creeper_1", title: "Desarmador I", description: "Elimina creepers hostiles.", type: "kill", target: ["minecraft:creeper"], required: 5, reward: 200 },
  { id: "kill_creeper_2", title: "Desarmador II", description: "Elimina creepers hostiles.", type: "kill", target: ["minecraft:creeper"], required: 15, reward: 550 },
  { id: "kill_creeper_3", title: "Desarmador III", description: "Elimina creepers hostiles.", type: "kill", target: ["minecraft:creeper"], required: 60, reward: 2200 },
  { id: "kill_creeper_4", title: "Desarmador IV", description: "Elimina creepers hostiles.", type: "kill", target: ["minecraft:creeper"], required: 200, reward: 7000 },
  // Arañas
  { id: "kill_spider_1", title: "Aracnofobia I", description: "Elimina arañas de cueva o normales.", type: "kill", target: ["minecraft:spider", "minecraft:cave_spider"], required: 8, reward: 100 },
  { id: "kill_spider_2", title: "Aracnofobia II", description: "Elimina arañas de cueva o normales.", type: "kill", target: ["minecraft:spider", "minecraft:cave_spider"], required: 30, reward: 350 },
  { id: "kill_spider_3", title: "Aracnofobia III", description: "Elimina arañas de cueva o normales.", type: "kill", target: ["minecraft:spider", "minecraft:cave_spider"], required: 100, reward: 1100 },
  { id: "kill_spider_4", title: "Aracnofobia IV", description: "Elimina arañas de cueva o normales.", type: "kill", target: ["minecraft:spider", "minecraft:cave_spider"], required: 350, reward: 4000 },
  // Endermans
  { id: "kill_enderman_1", title: "Mirada Fija I", description: "Elimina endermans.", type: "kill", target: ["minecraft:enderman"], required: 3, reward: 220 },
  { id: "kill_enderman_2", title: "Mirada Fija II", description: "Elimina endermans.", type: "kill", target: ["minecraft:enderman"], required: 10, reward: 700 },
  { id: "kill_enderman_3", title: "Mirada Fija III", description: "Elimina endermans.", type: "kill", target: ["minecraft:enderman"], required: 40, reward: 2600 },
  { id: "kill_enderman_4", title: "Mirada Fija IV", description: "Elimina endermans.", type: "kill", target: ["minecraft:enderman"], required: 120, reward: 7500 },
  // Blazes
  { id: "kill_blaze_1", title: "Fuego Cruzado I", description: "Elimina blazes.", type: "kill", target: ["minecraft:blaze"], required: 5, reward: 250 },
  { id: "kill_blaze_2", title: "Fuego Cruzado II", description: "Elimina blazes.", type: "kill", target: ["minecraft:blaze"], required: 15, reward: 750 },
  { id: "kill_blaze_3", title: "Fuego Cruzado III", description: "Elimina blazes.", type: "kill", target: ["minecraft:blaze"], required: 50, reward: 2400 },
  { id: "kill_blaze_4", title: "Fuego Cruzado IV", description: "Elimina blazes.", type: "kill", target: ["minecraft:blaze"], required: 150, reward: 7500 },
  // Wither Skeletons
  { id: "kill_witherskel_1", title: "Cazador Wither I", description: "Elimina esqueletos wither.", type: "kill", target: ["minecraft:wither_skeleton"], required: 3, reward: 400 },
  { id: "kill_witherskel_2", title: "Cazador Wither II", description: "Elimina esqueletos wither.", type: "kill", target: ["minecraft:wither_skeleton"], required: 10, reward: 1200 },
  { id: "kill_witherskel_3", title: "Cazador Wither III", description: "Elimina esqueletos wither.", type: "kill", target: ["minecraft:wither_skeleton"], required: 40, reward: 4500 },
  // Brujas
  { id: "kill_witch_1", title: "Antídoto I", description: "Elimina brujas.", type: "kill", target: ["minecraft:witch"], required: 2, reward: 150 },
  { id: "kill_witch_2", title: "Antídoto II", description: "Elimina brujas.", type: "kill", target: ["minecraft:witch"], required: 8, reward: 600 },
  // Ghasts
  { id: "kill_ghast_1", title: "Lágrimas Caídas I", description: "Elimina ghasts.", type: "kill", target: ["minecraft:ghast"], required: 2, reward: 300 },
  { id: "kill_ghast_2", title: "Lágrimas Caídas II", description: "Elimina ghasts.", type: "kill", target: ["minecraft:ghast"], required: 8, reward: 1200 },
  // Piglins y Hoglins
  { id: "kill_piglin_1", title: "Bestias del Nether I", description: "Elimina piglins o hoglins.", type: "kill", target: ["minecraft:piglin", "minecraft:hoglin", "minecraft:zoglin"], required: 10, reward: 150 },
  { id: "kill_piglin_2", title: "Bestias del Nether II", description: "Elimina piglins o hoglins.", type: "kill", target: ["minecraft:piglin", "minecraft:hoglin", "minecraft:zoglin"], required: 40, reward: 600 },
  // Piglin Brute
  { id: "kill_piglinbrute_1", title: "Fuerza Bruta I", description: "Elimina piglins brutales.", type: "kill", target: ["minecraft:piglin_brute"], required: 2, reward: 600 },
  { id: "kill_piglinbrute_2", title: "Fuerza Bruta II", description: "Elimina piglins brutales.", type: "kill", target: ["minecraft:piglin_brute"], required: 6, reward: 2000 },
  // Guardianes
  { id: "kill_guardian_1", title: "Defensor del Mar I", description: "Elimina guardianes oceánicos.", type: "kill", target: ["minecraft:guardian"], required: 5, reward: 300 },
  { id: "kill_guardian_2", title: "Defensor del Mar II", description: "Elimina guardianes oceánicos.", type: "kill", target: ["minecraft:guardian"], required: 20, reward: 1100 },
  // Invasores (Pillager/Vindicator/Ravager)
  { id: "kill_raiders_1", title: "Defensor de la Aldea I", description: "Elimina saqueadores o vindicadores.", type: "kill", target: ["minecraft:pillager", "minecraft:vindicator", "minecraft:evoker"], required: 5, reward: 200 },
  { id: "kill_raiders_2", title: "Defensor de la Aldea II", description: "Elimina saqueadores o vindicadores.", type: "kill", target: ["minecraft:pillager", "minecraft:vindicator", "minecraft:evoker", "minecraft:ravager"], required: 25, reward: 1000 },
  // Slimes / Magma Cubes
  { id: "kill_slime_1", title: "Pegajoso I", description: "Elimina slimes o cubos de magma.", type: "kill", target: ["minecraft:slime", "minecraft:magma_cube"], required: 15, reward: 100 },
  { id: "kill_slime_2", title: "Pegajoso II", description: "Elimina slimes o cubos de magma.", type: "kill", target: ["minecraft:slime", "minecraft:magma_cube"], required: 50, reward: 350 },
  // Jefes (Bosses)
  { id: "kill_warden_1", title: "El Silencio Sagrado", description: "Derrota al Warden.", type: "kill", target: ["minecraft:warden"], required: 1, reward: 15000 },
  { id: "kill_wither_1", title: "Destructor del Nether", description: "Derrota al Wither.", type: "kill", target: ["minecraft:wither"], required: 1, reward: 25000 },
  { id: "kill_dragon_1", title: "Liberador Cósmico", description: "Derrota al Dragón del End.", type: "kill", target: ["minecraft:ender_dragon"], required: 1, reward: 30000 },

  // === AGRICULTURA ===
  // Trigo
  { id: "harvest_wheat_1", title: "Granjero Experto I", description: "Cosecha trigo.", type: "break", target: ["minecraft:wheat"], required: 30, reward: 120 },
  { id: "harvest_wheat_2", title: "Granjero Experto II", description: "Cosecha trigo.", type: "break", target: ["minecraft:wheat"], required: 100, reward: 400 },
  { id: "harvest_wheat_3", title: "Granjero Experto III", description: "Cosecha trigo.", type: "break", target: ["minecraft:wheat"], required: 400, reward: 1800 },
  // Zanahorias
  { id: "harvest_carrot_1", title: "Huerto Dorado I", description: "Cosecha zanahorias.", type: "break", target: ["minecraft:carrots"], required: 30, reward: 120 },
  { id: "harvest_carrot_2", title: "Huerto Dorado II", description: "Cosecha zanahorias.", type: "break", target: ["minecraft:carrots"], required: 100, reward: 400 },
  { id: "harvest_carrot_3", title: "Huerto Dorado III", description: "Cosecha zanahorias.", type: "break", target: ["minecraft:carrots"], required: 400, reward: 1800 },
  // Patatas
  { id: "harvest_potato_1", title: "Cultivador I", description: "Cosecha patatas.", type: "break", target: ["minecraft:potatoes"], required: 30, reward: 120 },
  { id: "harvest_potato_2", title: "Cultivador II", description: "Cosecha patatas.", type: "break", target: ["minecraft:potatoes"], required: 100, reward: 400 },
  { id: "harvest_potato_3", title: "Cultivador III", description: "Cosecha patatas.", type: "break", target: ["minecraft:potatoes"], required: 400, reward: 1800 },
  // Caña de Azúcar
  { id: "harvest_cane_1", title: "Dulzura Pura I", description: "Cosecha caña de azúcar.", type: "break", target: ["minecraft:reeds"], required: 20, reward: 150 },
  { id: "harvest_cane_2", title: "Dulzura Pura II", description: "Cosecha caña de azúcar.", type: "break", target: ["minecraft:reeds"], required: 80, reward: 600 },
  { id: "harvest_cane_3", title: "Dulzura Pura III", description: "Cosecha caña de azúcar.", type: "break", target: ["minecraft:reeds"], required: 320, reward: 2400 },
  // Verrugas del Nether
  { id: "harvest_wart_1", title: "Alquimista I", description: "Cosecha verrugas del nether.", type: "break", target: ["minecraft:nether_wart"], required: 15, reward: 180 },
  { id: "harvest_wart_2", title: "Alquimista II", description: "Cosecha verrugas del nether.", type: "break", target: ["minecraft:nether_wart"], required: 60, reward: 700 },
  { id: "harvest_wart_3", title: "Alquimista III", description: "Cosecha verrugas del nether.", type: "break", target: ["minecraft:nether_wart"], required: 240, reward: 2800 },
  // Sandía / Calabaza
  { id: "harvest_melon_1", title: "Cosecha Gigante I", description: "Cosecha calabazas o sandías.", type: "break", target: ["minecraft:melon_block", "minecraft:pumpkin"], required: 30, reward: 200 },
  { id: "harvest_melon_2", title: "Cosecha Gigante II", description: "Cosecha calabazas o sandías.", type: "break", target: ["minecraft:melon_block", "minecraft:pumpkin"], required: 120, reward: 900 },

  // === CONSTRUCCIÓN Y AVENTURA (7 Misiones) ===
  // Colocar Obsidiana
  { id: "place_obsidian_1", title: "Muro Fuerte I", description: "Coloca bloques de obsidiana.", type: "place", target: ["minecraft:obsidian"], required: 10, reward: 150 },
  { id: "place_obsidian_2", title: "Muro Fuerte II", description: "Coloca bloques de obsidiana.", type: "place", target: ["minecraft:obsidian"], required: 50, reward: 800 },
  // Colocar Faro
  { id: "place_beacon_1", title: "Guía de la Luz", description: "Coloca un faro (Beacon).", type: "place", target: ["minecraft:beacon"], required: 1, reward: 5000 },
  // Colocar Shulker
  { id: "place_shulker_1", title: "Archivero Móvil", description: "Coloca una caja de shulker.", type: "place", target: [
    "minecraft:shulker_box", "minecraft:white_shulker_box", "minecraft:orange_shulker_box",
    "minecraft:magenta_shulker_box", "minecraft:light_blue_shulker_box", "minecraft:yellow_shulker_box",
    "minecraft:lime_shulker_box", "minecraft:pink_shulker_box", "minecraft:gray_shulker_box",
    "minecraft:light_gray_shulker_box", "minecraft:cyan_shulker_box", "minecraft:purple_shulker_box",
    "minecraft:blue_shulker_box", "minecraft:brown_shulker_box", "minecraft:green_shulker_box",
    "minecraft:red_shulker_box", "minecraft:black_shulker_box"
  ], required: 1, reward: 1000 },
  // Usar Perla de Ender
  { id: "use_enderpearl_1", title: "Viajero Dimensional", description: "Lanza perlas de ender.", type: "consume", target: ["minecraft:ender_pearl"], required: 10, reward: 400 },
  // Consumir Manzanas Doradas
  { id: "eat_goldenapple_1", title: "Manzana de Dioses I", description: "Consume manzanas doradas.", type: "consume", target: ["minecraft:golden_apple", "minecraft:enchanted_golden_apple"], required: 5, reward: 300 },
  { id: "eat_goldenapple_2", title: "Manzana de Dioses II", description: "Consume manzanas doradas.", type: "consume", target: ["minecraft:golden_apple", "minecraft:enchanted_golden_apple"], required: 20, reward: 1200 },
  // Amatista
  { id: "mine_amethyst_1", title: "Gemas Moradas I", description: "Pica racimos de amatista.", type: "break", target: ["minecraft:amethyst_cluster"], required: 8, reward: 250 },
  { id: "mine_amethyst_2", title: "Gemas Moradas II", description: "Pica racimos de amatista.", type: "break", target: ["minecraft:amethyst_cluster"], required: 32, reward: 1100 },
  // Madera / Troncos
  { id: "place_log_1", title: "Carpintero Nato I", description: "Coloca troncos de madera.", type: "place", target: ["minecraft:oak_log", "minecraft:spruce_log", "minecraft:birch_log", "minecraft:jungle_log", "minecraft:acacia_log", "minecraft:dark_oak_log", "minecraft:mangrove_log", "minecraft:cherry_log", "minecraft:stripped_oak_log", "minecraft:stripped_spruce_log"], required: 64, reward: 150 },
  // Tartas
  { id: "eat_cake_1", title: "Amante del Dulce I", description: "Consume porciones de tarta.", type: "consume", target: ["minecraft:cake"], required: 5, reward: 200 },
  // Phantoms
  { id: "kill_phantom_1", title: "Terror del Cielo I", description: "Elimina phantoms (fantasmas del cielo).", type: "kill", target: ["minecraft:phantom"], required: 5, reward: 300 },
  { id: "kill_phantom_2", title: "Terror del Cielo II", description: "Elimina phantoms (fantasmas del cielo).", type: "kill", target: ["minecraft:phantom"], required: 20, reward: 1400 },

  // === EXPANSION: EXPLORACION, CONSTRUCCION Y SUPERVIVENCIA ===
  { id: "mine_sand_1", title: "Vidriero Rústico I", description: "Pica arena para futuros hornos.", type: "break", target: ["minecraft:sand", "minecraft:red_sand"], required: 128, reward: 180 },
  { id: "mine_sand_2", title: "Vidriero Rústico II", description: "Pica arena para futuros hornos.", type: "break", target: ["minecraft:sand", "minecraft:red_sand"], required: 512, reward: 900 },
  { id: "mine_gravel_1", title: "Camino de Pedernal I", description: "Pica grava en grandes cantidades.", type: "break", target: ["minecraft:gravel"], required: 128, reward: 200 },
  { id: "mine_clay_1", title: "Ceramista del Río I", description: "Extrae bloques de arcilla.", type: "break", target: ["minecraft:clay"], required: 64, reward: 260 },
  { id: "mine_ice_1", title: "Pulso Glacial I", description: "Pica hielo o hielo compacto.", type: "break", target: ["minecraft:ice", "minecraft:packed_ice", "minecraft:blue_ice"], required: 64, reward: 500 },
  { id: "break_log_1", title: "Leñador del Alba I", description: "Rompe troncos naturales.", type: "break", target: ["minecraft:oak_log", "minecraft:spruce_log", "minecraft:birch_log", "minecraft:jungle_log", "minecraft:acacia_log", "minecraft:dark_oak_log", "minecraft:mangrove_log", "minecraft:cherry_log"], required: 128, reward: 220 },
  { id: "break_log_2", title: "Leñador del Alba II", description: "Rompe troncos naturales.", type: "break", target: ["minecraft:oak_log", "minecraft:spruce_log", "minecraft:birch_log", "minecraft:jungle_log", "minecraft:acacia_log", "minecraft:dark_oak_log", "minecraft:mangrove_log", "minecraft:cherry_log"], required: 512, reward: 1200 },
  { id: "break_leaves_1", title: "Podador del Bosque I", description: "Limpia hojas de los árboles.", type: "break", target: ["minecraft:oak_leaves", "minecraft:spruce_leaves", "minecraft:birch_leaves", "minecraft:jungle_leaves", "minecraft:acacia_leaves", "minecraft:dark_oak_leaves", "minecraft:mangrove_leaves", "minecraft:cherry_leaves", "minecraft:azalea_leaves", "minecraft:flowering_azalea_leaves"], required: 128, reward: 180 },
  { id: "harvest_cactus_1", title: "Espinas del Desierto I", description: "Cosecha cactus.", type: "break", target: ["minecraft:cactus"], required: 64, reward: 260 },
  { id: "harvest_bamboo_1", title: "Bosque Flexible I", description: "Cosecha bambú.", type: "break", target: ["minecraft:bamboo"], required: 128, reward: 260 },
  { id: "place_glass_1", title: "Arquitecto Transparente I", description: "Coloca vidrio para tus construcciones.", type: "place", target: ["minecraft:glass", "minecraft:tinted_glass"], required: 128, reward: 450 },
  { id: "place_stonebrick_1", title: "Mampostero Imperial I", description: "Coloca piedra labrada o variantes.", type: "place", target: ["minecraft:stonebrick", "minecraft:cracked_stone_bricks", "minecraft:mossy_stone_bricks", "minecraft:chiseled_stone_bricks"], required: 128, reward: 420 },
  { id: "place_deepslate_1", title: "Fortaleza Negra I", description: "Coloca bloques de pizarra profunda.", type: "place", target: ["minecraft:cobbled_deepslate", "minecraft:polished_deepslate", "minecraft:deepslate_tiles", "minecraft:deepslate_bricks"], required: 128, reward: 520 },
  { id: "place_lantern_1", title: "Ciudad Iluminada I", description: "Coloca linternas o faroles.", type: "place", target: ["minecraft:lantern", "minecraft:soul_lantern"], required: 32, reward: 350 },
  { id: "consume_honey_1", title: "Dulce Remedio I", description: "Consume botellas de miel.", type: "consume", target: ["minecraft:honey_bottle"], required: 16, reward: 350 },
  { id: "consume_milk_1", title: "Purga Total I", description: "Bebe cubetas de leche.", type: "consume", target: ["minecraft:milk_bucket"], required: 8, reward: 240 },
  { id: "consume_kelp_1", title: "Snack Marino I", description: "Come alga seca.", type: "consume", target: ["minecraft:dried_kelp"], required: 32, reward: 180 },
  { id: "consume_beef_1", title: "Banquete del Guerrero I", description: "Come bistec cocido.", type: "consume", target: ["minecraft:cooked_beef"], required: 32, reward: 260 },
  { id: "kill_drowned_1", title: "Náufrago Vengador I", description: "Elimina drowned del océano.", type: "kill", target: ["minecraft:drowned"], required: 20, reward: 700 },
  { id: "kill_drowned_2", title: "Náufrago Vengador II", description: "Elimina drowned del océano.", type: "kill", target: ["minecraft:drowned"], required: 80, reward: 2800 },
  { id: "kill_pig_1", title: "Carnicero de Granja I", description: "Elimina cerdos.", type: "kill", target: ["minecraft:pig"], required: 30, reward: 250 },
  { id: "kill_cow_1", title: "Ganadero Letal I", description: "Elimina vacas.", type: "kill", target: ["minecraft:cow"], required: 30, reward: 320 },
  { id: "kill_sheep_1", title: "Pastor Implacable I", description: "Elimina ovejas.", type: "kill", target: ["minecraft:sheep"], required: 30, reward: 300 },
  { id: "kill_goat_1", title: "Eco de la Montaña I", description: "Elimina cabras.", type: "kill", target: ["minecraft:goat"], required: 12, reward: 480 },
  { id: "kill_iron_golem_1", title: "Coloso Caído I", description: "Derrota gólems de hierro.", type: "kill", target: ["minecraft:iron_golem"], required: 3, reward: 1500 }
];

const QUEST_INDEX = new Map();
for (const quest of QUESTS) {
  const targets = quest.target.length > 0 ? quest.target : ["*"];
  for (const target of targets) {
    const key = `${quest.type}:${target}`;
    const indexed = QUEST_INDEX.get(key) || [];
    indexed.push(quest);
    QUEST_INDEX.set(key, indexed);
  }
}

const placedBlockBucketCache = new Map();
const NON_PLAYER_PLACED_BREAK_TARGETS = new Set([
  "minecraft:coal_ore",
  "minecraft:deepslate_coal_ore",
  "minecraft:iron_ore",
  "minecraft:deepslate_iron_ore",
  "minecraft:gold_ore",
  "minecraft:deepslate_gold_ore",
  "minecraft:redstone_ore",
  "minecraft:deepslate_redstone_ore",
  "minecraft:lapis_ore",
  "minecraft:deepslate_lapis_ore",
  "minecraft:copper_ore",
  "minecraft:deepslate_copper_ore",
  "minecraft:diamond_ore",
  "minecraft:deepslate_diamond_ore",
  "minecraft:emerald_ore",
  "minecraft:deepslate_emerald_ore",
  "minecraft:nether_gold_ore",
  "minecraft:quartz_ore",
  "minecraft:ancient_debris",
  "minecraft:obsidian",
  "minecraft:amethyst_cluster",
  "minecraft:stone",
  "minecraft:cobblestone",
  "minecraft:deepslate",
  "minecraft:basalt",
  "minecraft:polished_basalt",
  "minecraft:netherrack",
  "minecraft:sand",
  "minecraft:red_sand",
  "minecraft:gravel",
  "minecraft:clay",
  "minecraft:ice",
  "minecraft:packed_ice",
  "minecraft:blue_ice",
  "minecraft:oak_log",
  "minecraft:spruce_log",
  "minecraft:birch_log",
  "minecraft:jungle_log",
  "minecraft:acacia_log",
  "minecraft:dark_oak_log",
  "minecraft:mangrove_log",
  "minecraft:cherry_log"
]);

function getDimensionCode(dimensionId) {
  if (dimensionId === "minecraft:overworld" || dimensionId === "overworld") return "o";
  if (dimensionId === "minecraft:nether" || dimensionId === "nether") return "n";
  if (dimensionId === "minecraft:the_end" || dimensionId === "the_end") return "e";
  return String(dimensionId || "unknown").replace(/[^a-z0-9_]/gi, "_").slice(0, 16);
}

function encodeSigned(value) {
  const integer = Math.trunc(Number(value) || 0);
  return integer < 0 ? `n${Math.abs(integer).toString(36)}` : `p${integer.toString(36)}`;
}

function getPlacedBlockBucketInfo(dimensionId, location) {
  const x = Math.floor(location.x);
  const y = Math.floor(location.y);
  const z = Math.floor(location.z);
  const chunkX = Math.floor(x / 16);
  const chunkZ = Math.floor(z / 16);
  const sectionY = Math.floor(y / 8);
  const localX = ((x % 16) + 16) % 16;
  const localZ = ((z % 16) + 16) % 16;
  const localY = ((y % 8) + 8) % 8;
  return {
    key: `${PLACED_BLOCK_BUCKET_PREFIX}_${getDimensionCode(dimensionId)}_${encodeSigned(chunkX)}_${encodeSigned(sectionY)}_${encodeSigned(chunkZ)}`,
    position: `${localX.toString(36)}.${localY.toString(36)}.${localZ.toString(36)}`
  };
}

function disablePlacedBlockTracking(operation, error) {
  if (placedBlockTrackingHealthy) {
    console.warn(`[ECONOMY_CRITICAL] quest_block_tracking_disabled operation=${operation} cause=persistence_or_integrity_failure`);
  }
  placedBlockTrackingHealthy = false;
  if (error) {
    ErrorReporter.report(error, { addonId: "quests_addon", moduleId: "main.js", operation, category: "runtime" });
  }
}

function loadPlacedBlockBucket(key) {
  if (placedBlockBucketCache.has(key)) return placedBlockBucketCache.get(key);
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("quests_addon", "world", key);
    const parsed = raw ? JSON.parse(String(raw)) : {};
    if (raw && (typeof parsed !== "object" || parsed === null ||
        (parsed.positions !== undefined && !Array.isArray(parsed.positions)) ||
        (Array.isArray(parsed.positions) && parsed.positions.length > MAX_TRACKED_BLOCKS_PER_BUCKET))) {
      throw new Error("Formato de bucket de bloques inválido.");
    }
    const bucket = {
      overflow: parsed.overflow === true,
      positions: new Set(Array.isArray(parsed.positions) ? parsed.positions.map(String) : [])
    };
    placedBlockBucketCache.set(key, bucket);
    return bucket;
  } catch (e) {
    disablePlacedBlockTracking("loadPlacedBlockBucket", e);
    const bucket = { overflow: true, positions: new Set() };
    placedBlockBucketCache.set(key, bucket);
    return bucket;
  }
}

function savePlacedBlockBucket(key, bucket) {
  try {
    const serialized = JSON.stringify({
      overflow: bucket.overflow === true,
      positions: [...bucket.positions]
    });
    globalThis.__sqlite_set_prop_v2__("quests_addon", "world", key, serialized);
    if (String(globalThis.__sqlite_get_prop_v2__("quests_addon", "world", key) ?? "") !== serialized) {
      throw new Error("La verificación del bucket de bloques no coincide.");
    }
    return true;
  } catch (e) {
    bucket.overflow = true;
    disablePlacedBlockTracking("savePlacedBlockBucket", e);
    return false;
  }
}

function rememberPlacedBlock(dimensionId, location) {
  if (!placedBlockTrackingHealthy) return false;
  const info = getPlacedBlockBucketInfo(dimensionId, location);
  const bucket = loadPlacedBlockBucket(info.key);
  if (!placedBlockTrackingHealthy) return false;
  if (bucket.overflow || bucket.positions.has(info.position)) return true;
  if (bucket.positions.size >= MAX_TRACKED_BLOCKS_PER_BUCKET) {
    bucket.overflow = true;
  } else {
    bucket.positions.add(info.position);
  }
  return savePlacedBlockBucket(info.key, bucket);
}

function trackPlacedBlock(player, block) {
  if (!player || !block || !NON_PLAYER_PLACED_BREAK_TARGETS.has(block.typeId)) return;
  rememberPlacedBlock(block.dimension.id, block.location);
}

function shouldIgnoreBreakProgress(blockTypeId, block) {
  if (!blockTypeId || !block || !NON_PLAYER_PLACED_BREAK_TARGETS.has(blockTypeId)) return false;
  if (!placedBlockTrackingHealthy) return true;
  const info = getPlacedBlockBucketInfo(block.dimension.id, block.location);
  const bucket = loadPlacedBlockBucket(info.key);
  if (!placedBlockTrackingHealthy || bucket.overflow) return true;
  if (!bucket.positions.delete(info.position)) return false;
  if (!savePlacedBlockBucket(info.key, bucket)) return true;
  return true;
}

const QUEST_CATEGORIES = [
  { id: "mineria", name: "Minería", match: (quest) => quest.id.startsWith("mine_") },
  { id: "combate", name: "Combate", match: (quest) => quest.id.startsWith("kill_") },
  { id: "agricultura", name: "Agricultura", match: (quest) => quest.id.startsWith("harvest_") },
  { id: "construccion", name: "Construcción", match: (quest) => quest.id.startsWith("place_") },
  { id: "consumo", name: "Consumo", match: (quest) => quest.id.startsWith("eat_") || quest.id.startsWith("consume_") || quest.id.startsWith("use_") },
  { id: "otros", name: "Otros", match: () => true }
];

function getQuestCategory(quest) {
  return QUEST_CATEGORIES.find((category) => category.match(quest)) || QUEST_CATEGORIES[QUEST_CATEGORIES.length - 1];
}

// Helper para abrir formularios con reintentos automáticos si el usuario está ocupado (ej. cerrando el chat)
function safeOpenForm(player, form, onSelect, onCancel = undefined, retryCount = 0) {
  form.show(player).then((response) => {
    if (response.canceled) {
      if (response.cancelationReason === "UserBusy" && retryCount < 5) {
        system.runTimeout(() => {
          safeOpenForm(player, form, onSelect, onCancel, retryCount + 1);
        }, 10);
        return;
      }
      if (onCancel) {
        onCancel(response);
      }
      return;
    }
    onSelect(response);
  }).catch((err) => {
    console.warn(`[Quests Addon] Error en safeOpenForm: ${err}`);
  });
}

// Obtener datos de misiones del jugador
const questProgressCache = new Map();

function getQuestsProgress(player) {
  try {
    const raw = String(globalThis.__sqlite_get_prop_v2__("quests_addon", player, "quests_progress") || "");
    const cached = questProgressCache.get(player.id);
    if (cached?.raw === raw) return cached.value;
    const value = raw ? JSON.parse(raw) : {};
    questProgressCache.set(player.id, { raw, value });
    return value;
  } catch (e) { ErrorReporter.report(e, { addonId: "quests_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn(`[Quests Addon] Error leyendo progreso de ${player.name}: ${e}`);
  }
  return {};
}

// Guardar datos de misiones del jugador
function saveQuestsProgress(player, data) {
  try {
    const raw = JSON.stringify(data);
    globalThis.__sqlite_set_prop_v2__("quests_addon", player, "quests_progress", raw);
    if (String(globalThis.__sqlite_get_prop_v2__("quests_addon", player, "quests_progress") || "") !== raw) {
      throw new Error("La verificación del progreso de misiones no coincide.");
    }
    questProgressCache.set(player.id, { raw, value: data });
    return true;
  } catch (e) { ErrorReporter.report(e, { addonId: "quests_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn(`[Quests Addon] Error guardando progreso de ${player.name}: ${e}`);
    return false;
  }
}

function getPaidQuestRewards(player) {
  try {
    const raw = String(globalThis.__sqlite_get_prop_v2__("quests_addon", player, QUEST_REWARDS_PAID_KEY) || "");
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch (e) {
    ErrorReporter.report(e, { addonId: "quests_addon", moduleId: "main.js", operation: "get_paid_rewards", category: "runtime" });
    return new Set();
  }
}

function savePaidQuestRewards(player, rewards) {
  try {
    const serialized = JSON.stringify(Array.from(rewards));
    globalThis.__sqlite_set_prop_v2__("quests_addon", player, QUEST_REWARDS_PAID_KEY, serialized);
    return String(globalThis.__sqlite_get_prop_v2__("quests_addon", player, QUEST_REWARDS_PAID_KEY) || "") === serialized;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "quests_addon", moduleId: "main.js", operation: "save_paid_rewards", category: "runtime" });
    return false;
  }
}

function getScoreboardParticipant(player) {
  if (!player) return undefined;
  try {
    if (player.scoreboardIdentity) return player.scoreboardIdentity;
  } catch (e) { ErrorReporter.report(e, { addonId: "quests_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  try {
    if (player.isValid !== false) return player;
  } catch (e) { ErrorReporter.report(e, { addonId: "quests_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  return undefined;
}

function getEmissionBudget(player) {
  const day = Math.floor(Date.now() / 86400000);
  try {
    const dayObjective = world.scoreboard.getObjective("emission_day") || world.scoreboard.addObjective("emission_day", "Emission Day");
    const earnedObjective = world.scoreboard.getObjective("emission_earned") || world.scoreboard.addObjective("emission_earned", "Emission Earned");
    const storedDay = Number(dayObjective.getScore(player) ?? -1);
    if (storedDay !== day) {
      if (storedDay !== -1) return { day, earned: 0 };
      const raw = globalThis.__sqlite_get_prop_v2__("quests_addon", player, "economy_emission_budget_v1");
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
    ErrorReporter.report(e, { addonId: "quests_addon", moduleId: "main.js", operation: "getEmissionBudget", category: "runtime" });
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
    ErrorReporter.report(e, { addonId: "quests_addon", moduleId: "main.js", operation: "saveEmissionBudget", category: "runtime" });
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

function commitEmission(player, reservation, before, after) {
  console.warn(`[ECONOMY_TX] COMMIT player=${player?.name || "unknown"} delta=${reservation.delta} before=${before} after=${after} reason=${reservation.reason} emission_today=${reservation.reserved.earned} emission_limit=${ECONOMY_DAILY_EMISSION_LIMIT}`);
}

// Añadir dinero a la economía del jugador
function addMoney(player, amount) {
  const participant = getScoreboardParticipant(player);
  if (!participant) {
    console.warn(`[Quests Addon] No se pudo resolver la identidad de scoreboard para ${player?.name || "jugador desconocido"}.`);
    return false;
  }

  const normalizedAmount = Math.max(0, Math.floor(Number(amount) || 0));
  try {
    let obj = world.scoreboard.getObjective("money");
    if (!obj) {
      try {
        obj = world.scoreboard.addObjective("money", "§e$ Dinero");
      } catch (createErr) { ErrorReporter.report(createErr, { addonId: "quests_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
    }
    if (!obj) return false;
    const current = obj.getScore(participant) ?? 0;
    const next = current + normalizedAmount;
    if (next > MAX_OPERATIONAL_BALANCE) return false;
    const emissionReservation = reserveEmission(player, normalizedAmount, "quest_reward");
    if (!emissionReservation) return false;
    try {
      obj.setScore(participant, next);
    } catch (writeError) {
      rollbackEmission(player, emissionReservation);
      throw writeError;
    }
    const persisted = obj.getScore(participant) ?? 0;
    if (persisted !== next) {
      rollbackEmission(player, emissionReservation);
      return false;
    }
    commitEmission(player, emissionReservation, current, next);
    return true;
  } catch (e) { ErrorReporter.report(e, { addonId: "quests_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn(`[Quests Addon] Error sumando dinero a ${player.name}: ${e}`);
    return false;
  }
}

function claimQuestReward(player, quest) {
  const paid = getPaidQuestRewards(player);
  if (paid.has(quest.id)) return false;

  // La marca se persiste antes del credito. Ante una caida entre ambos pasos se
  // pierde una recompensa recuperable por administracion, pero nunca se duplica.
  paid.add(quest.id);
  if (!savePaidQuestRewards(player, paid)) return false;
  if (addMoney(player, quest.reward)) return true;

  paid.delete(quest.id);
  savePaidQuestRewards(player, paid);
  return false;
}

// Procesar el avance de una misión
function advanceQuest(player, type, targetId, amount = 1) {
  if (!player || player.typeId !== "minecraft:player") return;
  
  const progress = { ...getQuestsProgress(player) };
  let updated = false;
  const newlyCompleted = [];
  
  const matchingQuests = [
    ...(QUEST_INDEX.get(`${type}:${targetId}`) || []),
    ...(QUEST_INDEX.get(`${type}:*`) || []),
  ];
  matchingQuests.forEach(q => {
    const currentVal = progress[q.id] ?? 0;
    if (currentVal < q.required) {
      const newVal = Math.min(q.required, currentVal + amount);
      progress[q.id] = newVal;
      updated = true;
        
        // Si la misión se completa en este momento
        if (newVal === q.required) {
          newlyCompleted.push(q);
        }
    }
  });
  
  if (updated) {
    if (!saveQuestsProgress(player, progress)) {
      player.sendMessage("§c[Misiones] No se pudo guardar el progreso; no se aplicó ningún pago.");
      return;
    }
    for (const quest of newlyCompleted) {
      system.run(() => {
        try {
          const paid = claimQuestReward(player, quest);
          player.sendMessage(`\n§b§l[§3Misiones§b§l]§r §a¡Misión Completada!`);
          player.sendMessage(`§7Título: §e${quest.title}`);
          player.sendMessage(`§7Detalle: §f${quest.description}`);
          player.sendMessage(paid
            ? `§7Recompensa: §a+$${quest.reward} §7(Añadido a tu cuenta)`
            : "§eLa recompensa quedó pendiente. Podrás reintentar desde el detalle de la misión.");
          try {
            player.runCommand("playsound random.levelup @s ~ ~ ~ 0.8 1.0");
          } catch (err) { ErrorReporter.report(err, { addonId: "quests_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
        } catch (err) {
          ErrorReporter.report(err, { addonId: "quests_addon", moduleId: "main.js", operation: "completeQuest", category: "runtime" });
        }
      });
    }
  }
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
      for (const name of ["misiones", "mision", "quests"]) {
        register({ name: `${COMMAND_NAMESPACE}:${name}`, description: "Abre el menu de misiones", permissionLevel: CommandPermissionLevel.Any }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          system.runTimeout(() => openQuestsMenu(sender), 5);
          return commandOk("Abriendo misiones.");
        });
      }
    } catch (e) { ErrorReporter.report(e, { addonId: "quests_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Quests Addon] Error registrando custom commands: " + e);
    }
  });
}

registerCustomCommands();

world.afterEvents.playerLeave.subscribe((event) => {
  questProgressCache.delete(event.playerId);
});

// --- EVENT LISTENERS NATIVOS ---

// 1. Escuchar cuando un jugador rompe bloques
try {
  const breakEvent = world.afterEvents?.playerBreakBlock;
  if (!breakEvent || typeof breakEvent.subscribe !== "function") {
    throw new Error("No hay evento compatible para playerBreakBlock en esta build.");
  }
  breakEvent.subscribe((event) => {
    try {
      const player = event.player;
      const blockTypeId =
        event.brokenBlockPermutation?.type?.id ||
        event.brokenBlockPermutation?.typeId ||
        event.block?.typeId;
      if (!blockTypeId) return;
      if (event.block && shouldIgnoreBreakProgress(blockTypeId, event.block)) return;
      advanceQuest(player, "break", blockTypeId);
    } catch (err) { ErrorReporter.report(err, { addonId: "quests_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn(`[Quests Addon] Error en playerBreakBlock: ${err}`);
    }
  });
} catch (e) { ErrorReporter.report(e, { addonId: "quests_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Quests Addon] Error suscribiendo BreakBlock: " + e);
}

// 2. Escuchar cuando un jugador coloca bloques
try {
  const placeBlockEvent = world.afterEvents?.playerPlaceBlock || world.afterEvents?.playerPlaceBlockAfter;
  if (!placeBlockEvent || typeof placeBlockEvent.subscribe !== "function") {
    throw new Error("No hay evento compatible para playerPlaceBlock en esta build.");
  }
  placeBlockEvent.subscribe((event) => {
    try {
      const player = event.player;
      const blockTypeId = event.block?.typeId;
      if (!player || !blockTypeId || !event.block) return;
      trackPlacedBlock(player, event.block);
      advanceQuest(player, "place", blockTypeId);
    } catch (err) {
      disablePlacedBlockTracking("playerPlaceBlock", err);
      console.warn(`[Quests Addon] Error en playerPlaceBlock: ${err}`);
    }
  });
} catch (e) {
  disablePlacedBlockTracking("playerPlaceBlockUnavailable", e);
  console.warn("[Quests Addon] Error suscribiendo PlaceBlock: " + e);
}

// Un pistón puede mover una mena colocada fuera de su coordenada registrada.
// El evento es posterior al movimiento, por lo que se marca el destino antes de
// que una rotura posterior pueda avanzar una misión.
const pistonAfterEvent = world.afterEvents?.pistonActivate;
if (pistonAfterEvent && typeof pistonAfterEvent.subscribe === "function") {
  pistonAfterEvent.subscribe((event) => {
    try {
      const attached = typeof event.piston?.getAttachedBlocks === "function"
        ? event.piston.getAttachedBlocks()
        : typeof event.piston?.getAttachedBlocksLocations === "function"
          ? event.piston.getAttachedBlocksLocations()
          : [];
      for (const entry of attached) {
        const block = entry?.typeId ? entry : event.block?.dimension?.getBlock(entry);
        if (block && NON_PLAYER_PLACED_BREAK_TARGETS.has(block.typeId)) {
          rememberPlacedBlock(block.dimension.id, block.location);
        }
      }
    } catch (e) {
      disablePlacedBlockTracking("pistonActivate", e);
    }
  });
}

// 3. Escuchar cuando un jugador consume un objeto (comida/perlas)
try {
  const itemUseCompleteEvent = world.afterEvents?.itemCompleteUse;
  if (!itemUseCompleteEvent || typeof itemUseCompleteEvent.subscribe !== "function") {
    throw new Error("No hay evento compatible para itemCompleteUse en esta build.");
  }
  itemUseCompleteEvent.subscribe((event) => {
    try {
      const player = event.source;
      const itemStack = event.itemStack;
      if (player && itemStack?.typeId) {
        advanceQuest(player, "consume", itemStack.typeId);
      }
    } catch (err) { ErrorReporter.report(err, { addonId: "quests_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn(`[Quests Addon] Error en itemCompleteUse: ${err}`);
    }
  });
} catch (e) { ErrorReporter.report(e, { addonId: "quests_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Quests Addon] Error suscribiendo ItemCompleteUse: " + e);
}

// 4. Escuchar cuando muere una criatura
try {
  const entityDieEvent = world.afterEvents?.entityDie;
  if (!entityDieEvent || typeof entityDieEvent.subscribe !== "function") {
    throw new Error("No hay evento compatible para entityDie en esta build.");
  }
  entityDieEvent.subscribe((event) => {
    try {
      const deadEntity = event.deadEntity;
      const damageSource = event.damageSource;
      if (!deadEntity) return;
      
      // Si el asesino fue un jugador
      const killer = damageSource?.damagingEntity;
      if (killer && killer.typeId === "minecraft:player") {
        advanceQuest(killer, "kill", deadEntity.typeId);
      }
    } catch (err) { ErrorReporter.report(err, { addonId: "quests_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn(`[Quests Addon] Error en entityDie: ${err}`);
    }
  });
} catch (e) { ErrorReporter.report(e, { addonId: "quests_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Quests Addon] Error suscribiendo EntityDie: " + e);
}

// --- MENÚ DE INTERFAZ GRÁFICA ---

function openQuestsMenu(player) {
  const progress = getQuestsProgress(player);
  let completedCount = 0;
  
  QUESTS.forEach(q => {
    if ((progress[q.id] ?? 0) >= q.required) {
      completedCount++;
    }
  });
  
  const categorySummaries = QUEST_CATEGORIES.map((category) => {
    const quests = QUESTS.filter((quest) => getQuestCategory(quest).id === category.id);
    if (quests.length === 0) return null;
    const completed = quests.filter((quest) => (progress[quest.id] ?? 0) >= quest.required).length;
    return `§7${category.name}: §e${completed}§7/§e${quests.length}`;
  }).filter(Boolean).join("\n");

  const form = new ActionFormData()
    .title("§9§lMisiones Secundarias")
    .body(`Progreso General: §e${completedCount} / ${QUESTS.length} completadas§r\n\n${categorySummaries}\n\n§7Haz clic en cualquier misión para ver los detalles y las recompensas:`);
  
  // Botón de ayuda/guía
  form.button("❔ ¿Cómo funciona? / Guía");

  QUESTS.forEach(q => {
    const current = progress[q.id] ?? 0;
    const isCompleted = current >= q.required;
    const prefix = isCompleted ? "§a[✅] " : "§6[⏳] ";
    const bar = isCompleted ? "§aCompletada" : `§7(${current}/${q.required})`;
    form.button(`${prefix}${q.title}\n${bar}`);
  });
  form.button("❌ Salir");
  
  safeOpenForm(player, form, (response) => {
    const idx = response.selection;
    if (idx === undefined) return;

    if (idx === 0) {
      openQuestsTutorial(player);
      return;
    }

    if (idx === QUESTS.length + 1) return; // botón de salir
    
    const selectedQuest = QUESTS[idx - 1];
    openQuestDetail(player, selectedQuest);
  });
}

function openQuestsTutorial(player) {
  const categoryNames = QUEST_CATEGORIES.map((category) => category.name).join(", ");
  const form = new ActionFormData()
    .title("❔ Guía de Misiones")
    .body("§e¿Cómo funciona el Sistema de Misiones?\n\n" +
          "§a1. ¿Qué son las Misiones?\n" +
          `§7- Son desafíos secundarios acumulativos divididos en categorías (${categoryNames}).\n` +
          "§7- No necesitas activar o aceptar una misión individualmente; todas registran tu progreso automáticamente en segundo plano.\n\n" +
          "§a2. Progreso de las misiones:\n" +
          "§7- Al romper bloques de menas, eliminar monstruos o realizar acciones del juego, tu progreso aumentará.\n" +
          "§7- Haz clic sobre cualquier misión en la lista para ver su descripción exacta, barra de progreso actual y recompensa.\n\n" +
          "§a3. Reclamar Recompensa:\n" +
          "§7- Cuando alcances el objetivo (ej: minar 50 diamantes), la misión se marcará con un ✅ en verde y el premio en dinero del Scoreboard se te entregará al instante.\n\n" +
          "§7- Si el límite económico o un error temporal impide el pago, abre el detalle de la misión para cobrarla después; nunca se paga dos veces.\n\n" +
          "§cAnti-exploit:\n" +
          "§7- Romper bloques que fueron colocados o movidos manualmente no cuenta para misiones de minería y recolección natural.")
    .button("🔙 Volver");

  safeOpenForm(player, form, () => {
    openQuestsMenu(player);
  });
}

function openQuestDetail(player, quest) {
  const progress = getQuestsProgress(player);
  const current = progress[quest.id] ?? 0;
  const isCompleted = current >= quest.required;
  const rewardPaid = getPaidQuestRewards(player).has(quest.id);
  const rewardPending = isCompleted && !rewardPaid;
  const statusText = isCompleted ? "§a§lCOMPLETADA" : "§6§lEN PROGRESO";
  const rewardStatus = rewardPaid ? "§aEntregada" : rewardPending ? "§ePendiente de cobro" : "§7Aún no disponible";
  
  // Dibujar una pequeña barra de progreso visual
  const percentage = Math.min(100, Math.floor((current / quest.required) * 100));
  const barLength = 10;
  const filledChars = Math.round((percentage / 100) * barLength);
  const emptyChars = barLength - filledChars;
  const progressBar = "§a" + "■".repeat(filledChars) + "§7" + "□".repeat(emptyChars);
  
  const form = new ActionFormData()
    .title(`§d§lMisión: ${quest.title}`)
    .body(`§7Descripción:\n§f${quest.description}\n\n§7Estado: ${statusText}\n§7Progreso: ${progressBar} §e${percentage}%\n§fCantidades: §e${current} §7/ §f${quest.required}\n\n§7Recompensa: §a$${quest.reward}\n§7Pago: ${rewardStatus}`);

  if (rewardPending) form.button("💰 Cobrar recompensa pendiente");
  form.button("⬅ Volver a Misiones");
  form.button("❌ Salir");
    
  safeOpenForm(player, form, (response) => {
    if (rewardPending && response.selection === 0) {
      const latestProgress = getQuestsProgress(player);
      if ((latestProgress[quest.id] ?? 0) < quest.required || getPaidQuestRewards(player).has(quest.id)) {
        player.sendMessage("§c[Misiones] El estado de la recompensa cambió; vuelve a abrir el menú.");
        return;
      }
      const paid = claimQuestReward(player, quest);
      player.sendMessage(paid
        ? `§a[Misiones] Recompensa entregada: +$${quest.reward}.`
        : "§e[Misiones] No fue posible entregar la recompensa. Sigue pendiente y podrás reintentar después.");
      return;
    }
    const backButton = rewardPending ? 1 : 0;
    if (response.selection === backButton) {
      openQuestsMenu(player);
    }
  });
}
