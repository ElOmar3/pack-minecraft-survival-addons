export class SurfaceProfileProvider {
    static getSurfaceMultiplier(blockId) {
        if (!blockId) return 1.0;
        switch (blockId) {
            case 'minecraft:ice':
            case 'minecraft:packed_ice':
            case 'minecraft:blue_ice':
            case 'minecraft:frosted_ice':
                return 1.4;
            case 'minecraft:soul_sand':
                return 0.4;
            case 'minecraft:slime':
                return 0.8;
            case 'minecraft:honey_block':
                return 0.4;
            default:
                return 1.0;
        }
    }
}
