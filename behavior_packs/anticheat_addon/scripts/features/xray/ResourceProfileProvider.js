export const RESOURCE_PROFILES = {
    "minecraft:diamond_ore": { type: "ORE_VALUABLE" },
    "minecraft:deepslate_diamond_ore": { type: "ORE_VALUABLE" },
    "minecraft:emerald_ore": { type: "ORE_VALUABLE" },
    "minecraft:deepslate_emerald_ore": { type: "ORE_VALUABLE" },
    "minecraft:gold_ore": { type: "ORE_VALUABLE" },
    "minecraft:deepslate_gold_ore": { type: "ORE_VALUABLE" },
    "minecraft:ancient_debris": { type: "ORE_VALUABLE" }
};

export class ResourceProfileProvider {
    static getProfile(blockId) {
        return RESOURCE_PROFILES[blockId] || { type: "NORMAL" };
    }
    static isValuableOre(blockId) {
        return this.getProfile(blockId).type === "ORE_VALUABLE";
    }
}
