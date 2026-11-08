import { ErrorReporter } from "./ErrorReporter.js";
import { EquipmentSlot } from "@minecraft/server";
import { Config } from "./Config.js";
import { ExemptionManager } from "./ExemptionManager.js";
import { ViolationManager } from "./ViolationManager.js";

const kickCounts = new Map();
function kickPlayer(player, reason) {
  const count = (kickCounts.get(player.name) || 0) + 1;
  kickCounts.set(player.name, count);
  // SHADOW MODE: Kicks are disabled. Gemma will analyze and report instead.
  if (count % 10 === 1) {
    console.warn(`[Shadow Mode] Se detectó comportamiento kickeable para ${player.name}: ${reason} (Alerta ${count}/10)`);
  }
}

// Ítems prohibidos
const FORBIDDEN_ITEMS = [
  "minecraft:command_block",
  "minecraft:chain_command_block",
  "minecraft:repeating_command_block",
  "minecraft:command_block_minecart",
  "minecraft:barrier",
  "minecraft:structure_block",
  "minecraft:structure_void",
  "minecraft:bedrock",
  "minecraft:allow",
  "minecraft:deny",
  "minecraft:border_block"
];

// Niveles máximos de encantamiento
const MAX_ENCHANTS = {
  "sharpness": 5,
  "efficiency": 5,
  "protection": 4,
  "unbreaking": 3,
  "fortune": 3,
  "looting": 3,
  "mending": 1,
  "knockback": 2,
  "fire_aspect": 2,
  "power": 5,
  "punch": 2,
  "flame": 1,
  "infinity": 1,
  "feather_falling": 4,
  "thorns": 3,
  "respiration": 3,
  "aqua_affinity": 1,
  "depth_strider": 3,
  "fire_protection": 4,
  "blast_protection": 4,
  "projectile_protection": 4,
  "soul_speed": 3,
  "swift_sneak": 3,
  "frost_walker": 2,
  "silk_touch": 1,
  "smite": 5,
  "bane_of_arthropods": 5,
  "lure": 3,
  "luck_of_the_sea": 3,
  "channeling": 1,
  "loyalty": 3,
  "riptide": 3,
  "impaling": 5,
  "multishot": 1,
  "piercing": 4,
  "quick_charge": 3,
  "density": 5,
  "breach": 4,
  "wind_burst": 3
};

export class InventoryAnalyzer {
  static breakRecords = new Map();
  static placeRecords = new Map();
  static inventorySnapshots = new Map();
  static containerOpenRecords = new Map();

  static HARD_BLOCKS = new Set([
    "minecraft:obsidian",
    "minecraft:crying_obsidian",
    "minecraft:ancient_debris",
    "minecraft:diamond_ore",
    "minecraft:deepslate_diamond_ore",
    "minecraft:emerald_ore",
    "minecraft:deepslate_emerald_ore",
    "minecraft:gold_ore",
    "minecraft:deepslate_gold_ore",
    "minecraft:iron_ore",
    "minecraft:deepslate_iron_ore",
    "minecraft:redstone_ore",
    "minecraft:deepslate_redstone_ore"
  ]);

  static CONTAINER_BLOCK_FRAGMENTS = [
    "chest",
    "barrel",
    "shulker_box",
    "hopper",
    "dispenser",
    "dropper"
  ];

  static getInventorySummary(player) {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return { occupiedSlots: 0, totalItems: 0, distinctTypes: 0 };

    let occupiedSlots = 0;
    let totalItems = 0;
    const distinct = new Set();

    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (!item) continue;
      occupiedSlots++;
      totalItems += Number(item.amount || 0);
      distinct.add(item.typeId);
    }

    return { occupiedSlots, totalItems, distinctTypes: distinct.size };
  }

  static markContainerInteraction(player, block) {
    if (!player || !block) return;
    const typeId = String(block.typeId || "").toLowerCase();
    if (!this.CONTAINER_BLOCK_FRAGMENTS.some((fragment) => typeId.includes(fragment))) return;

    this.containerOpenRecords.set(player.name, {
      ts: Date.now(),
      block: typeId,
      snapshot: this.getInventorySummary(player)
    });
  }

  static isLikelyMiningTool(itemTypeId) {
    const typeId = String(itemTypeId || "").toLowerCase();
    return typeId.includes("pickaxe") || typeId.includes("netherite_pickaxe") || typeId.includes("diamond_pickaxe") || typeId.includes("iron_pickaxe") || typeId.includes("stone_pickaxe") || typeId.includes("wooden_pickaxe") || typeId.includes("golden_pickaxe");
  }

  static analyzeContainerLooting(player) {
    const record = this.containerOpenRecords.get(player.name);
    if (!record) return;

    const age = Date.now() - record.ts;
    if (age > Config.inventory.chestStealerWindowMs) {
      this.containerOpenRecords.delete(player.name);
      return;
    }

    const current = this.getInventorySummary(player);
    const occupiedDelta = current.occupiedSlots - record.snapshot.occupiedSlots;
    const distinctDelta = current.distinctTypes - record.snapshot.distinctTypes;

    if (occupiedDelta >= Config.inventory.chestStealerBurstThreshold || distinctDelta >= Math.max(4, Math.floor(Config.inventory.chestStealerBurstThreshold / 2))) {
      ViolationManager.addViolation(
        player,
        "inventory.chest_stealer",
        Math.max(occupiedDelta, distinctDelta),
        Config.inventory.chestStealerBurstThreshold,
        18,
        { block: record.block, occupiedDelta, distinctDelta, windowMs: age }
      );
      this.containerOpenRecords.delete(player.name);
      return;
    }

    this.containerOpenRecords.set(player.name, { ...record, snapshot: current });
  }

  static analyzeInventory(player) {
    if (!Config.inventory.enabled) return;

    const gameMode = player.getGameMode ? player.getGameMode() : "survival";
    if (gameMode === "creative") return;
    if (ExemptionManager.isPlayerSoftExempt(player)) return;

    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container) return;

    this.analyzeContainerLooting(player);

    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (!item) continue;

      // 1. Detección de Ítems Prohibidos
      if (Config.inventory.cleanForbidden && FORBIDDEN_ITEMS.includes(item.typeId)) {
        container.setItem(i, undefined);
        ViolationManager.addViolation(
          player,
          "inventory.forbidden_item",
          1,
          0,
          30,
          { item: item.typeId }
        );
        continue;
      }

      // 1.5. Validación de stacks imposibles / corruptos
      if (Config.inventory.sanitizeInvalidStacks) {
        const maxAmount = Math.max(1, item.maxAmount || 64);
        if (item.amount <= 0 || item.amount > maxAmount) {
          ViolationManager.addViolation(
            player,
            "inventory.invalid_stack",
            item.amount,
            maxAmount,
            20,
            { item: item.typeId }
          );

          if (item.amount <= 0) {
            container.setItem(i, undefined);
          } else {
            const repaired = item.clone ? item.clone() : item;
            repaired.amount = maxAmount;
            container.setItem(i, repaired);
          }
          continue;
        }
      }

      // 2. Control de Encantamientos (32k / Hacked)
      if (Config.inventory.correctEnchants) {
        const enchantable = item.getComponent("minecraft:enchantable");
        if (enchantable) {
          const activeEnchants = enchantable.getEnchantments();
          let modified = false;

          for (const enchant of activeEnchants) {
            const encId = enchant.type.id;
            const maxAllowed = MAX_ENCHANTS[encId];

            if (maxAllowed !== undefined && enchant.level > maxAllowed) {
              ViolationManager.addViolation(
                player,
                "inventory.illegal_enchant",
                enchant.level,
                maxAllowed,
                25,
                { item: item.typeId, enchant: encId }
              );
              enchantable.removeEnchantment(enchant.type);
              enchantable.addEnchantment({ type: enchant.type, level: maxAllowed });
              modified = true;
            }
          }

          if (modified) {
            container.setItem(i, item);
          }
        }
      }
    }
  }

  static analyzeBlockBreak(event) {
    if (!Config.inventory.enabled) return;

    const player = event.player;
    const block = event.block;
    if (!player) return;

    const gameMode = player.getGameMode ? player.getGameMode() : "survival";
    if (gameMode === "creative") return;
    if (ExemptionManager.isPlayerSoftExempt(player)) return;

    // Bloquear de inmediato la ruptura de Bedrock / Barreras
    if (block.typeId === "minecraft:bedrock" || block.typeId === "minecraft:barrier") {
      event.cancel = true;
      ViolationManager.addViolation(
        player,
        "world.bedrock_break",
        1,
        0,
        100,
        { block: block.typeId }
      );
      kickPlayer(player, `§c[Server Integrity] Expulsado por romper bloque indestructible`);
      return;
    }

    const name = player.name;
    const now = Date.now();
    const heldItem = (() => {
      try {
        const eq = player.getComponent("minecraft:equippable");
        if (!eq) return null;
        return eq.getEquipment(EquipmentSlot?.Mainhand ?? "Mainhand") || null;
      } catch (e) {
        ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "InventoryAnalyzer.js", operation: "getEquipment", category: "runtime" });
        return null;
      }
    })();
    const heldItemTypeId = heldItem?.typeId || "";

    let breaks = this.breakRecords.get(name) || [];
    breaks = breaks.filter(entry => now - entry.ts < 1000);
    breaks.push({ ts: now, blockId: block.typeId, tool: heldItemTypeId });
    this.breakRecords.set(name, breaks);

    const sameTick = breaks.filter(entry => now - entry.ts < 50);
    if (sameTick.length > Config.inventory.maxBreaksPerTick) {
      event.cancel = true;
      ViolationManager.addViolation(
        player,
        "world.fast_break",
        sameTick.length,
        Config.inventory.maxBreaksPerTick,
        15
      );
    }

    if (breaks.length > Config.inventory.maxBreaksPerSecond) {
      event.cancel = true;
      const action = ViolationManager.addViolation(
        player,
        "world.nuker",
        breaks.length,
        Config.inventory.maxBreaksPerSecond,
        35
      );
      if (action === "punish") {
        kickPlayer(player, "§c[Server Integrity] Expulsado por Auto-Mine / Nuker Hack");
      }
    }

    if (this.HARD_BLOCKS.has(block.typeId)) {
      const hardBreaks = breaks.filter((entry) => now - entry.ts < 1000 && this.HARD_BLOCKS.has(entry.blockId));
      if (!this.isLikelyMiningTool(heldItemTypeId) && hardBreaks.length >= Config.inventory.autoToolHardBreakThreshold) {
        event.cancel = true;
        const action = ViolationManager.addViolation(
          player,
          "world.autotool_or_instantbreak",
          hardBreaks.length,
          Config.inventory.autoToolHardBreakThreshold,
          22,
          { block: block.typeId, tool: heldItemTypeId || "empty_hand" }
        );
        if (action === "punish") {
          kickPlayer(player, "§c[Server Integrity] Expulsado por ruptura imposible de bloques duros");
        }
      }
    }
  }

  static analyzeBlockPlace(event) {
    if (!Config.inventory.enabled) return;

    const player = event.player;
    const block = event.block;
    if (!player || !block) return;

    const gameMode = player.getGameMode ? player.getGameMode() : "survival";
    if (gameMode === "creative") return;
    if (ExemptionManager.isPlayerSoftExempt(player)) return;

    const name = player.name;
    const now = Date.now();
    const loc = player.location;
    const blockLoc = block.location;

    let places = this.placeRecords.get(name) || [];
    places = places.filter((entry) => now - entry.ts < 1000);
    places.push({ ts: now, x: blockLoc.x, y: blockLoc.y, z: blockLoc.z });
    this.placeRecords.set(name, places);

    const dx = Math.abs((blockLoc.x + 0.5) - loc.x);
    const dy = blockLoc.y - loc.y;
    const dz = Math.abs((blockLoc.z + 0.5) - loc.z);
    const horizontalDist = Math.hypot(dx, dz);

    let suspicious = false;
    let reason = "";

    if (!player.isOnGround && dy <= -1 && horizontalDist > 5.5) {
      suspicious = true;
      reason = "air_bridge";
    }

    if (horizontalDist > 7.0) {
      suspicious = true;
      reason = "far_place";
    }

    const sameTickPlaces = places.filter((entry) => now - entry.ts < 100);
    if (sameTickPlaces.length > 6) {
      suspicious = true;
      reason = "fast_place";
    }

    if (!suspicious) return;

    const action = ViolationManager.addViolation(
      player,
      "world.scaffold",
      horizontalDist,
      5.2,
      reason === "far_place" ? 20 : 12,
      { reason, horizontalDist, dy, sameTickPlaces: sameTickPlaces.length }
    );

    if (action === "rollback" || action === "punish") {
      try {
        block.setType("minecraft:air");
      } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "InventoryAnalyzer.js", operation: "try-catch", category: "runtime" });}
    }
  }

  static clearPlayer(playerName) {
    this.breakRecords.delete(playerName);
    this.placeRecords.delete(playerName);
    this.inventorySnapshots.delete(playerName);
    this.containerOpenRecords.delete(playerName);
  }
}
