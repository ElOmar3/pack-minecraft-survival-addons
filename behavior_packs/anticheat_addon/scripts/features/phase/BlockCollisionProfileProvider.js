class BlockCollisionProfileProvider {
    static getProfile(block) {
        if (!block) return { isSolid: false };
        
        // No reliance strictly on block.isSolid, we use profiles by state
        const id = block.typeId || block.id;
        
        // Define known non-solid blocks (like tallgrass, signs, open doors)
        if (["minecraft:air", "minecraft:water", "minecraft:lava", "minecraft:tallgrass"].includes(id)) {
            return { isSolid: false, type: "passable" };
        }
        
        if (id.includes("door") && block.states && block.states["open_bit"]) {
            return { isSolid: false, type: "open_door" };
        }
        
        // Known thin walls
        if (id.includes("glass_pane") || id.includes("iron_bars")) {
            return { isSolid: true, type: "thin_wall" };
        }
        
        return { isSolid: true, type: "full_block" };
    }
}
export { BlockCollisionProfileProvider  };
