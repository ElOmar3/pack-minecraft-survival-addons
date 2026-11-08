import { ErrorReporter } from "../../ErrorReporter.js";
export class GroundSupportProvider {
    static hasGroundSupport(player, location, dimension) {
        try {
            const width = 0.6; 
            const halfWidth = width / 2;
            const minX = location.x - halfWidth;
            const maxX = location.x + halfWidth;
            const minZ = location.z - halfWidth;
            const maxZ = location.z + halfWidth;
            const y = location.y - 0.1;

            const testPoints = [
                {x: minX, y, z: minZ},
                {x: maxX, y, z: minZ},
                {x: minX, y, z: maxZ},
                {x: maxX, y, z: maxZ},
                {x: location.x, y, z: location.z}
            ];

            for (const pt of testPoints) {
                try {
                    const block = dimension.getBlock(pt);
                    if (block && !block.isAir && !block.isLiquid) {
                        return true;
                    }
                } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "GroundSupportProvider.js", operation: "try-catch", category: "runtime" });
                    // Ignora chunks descargados, asumimos soporte
                    return true;
                }
            }
            return false;
        } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "GroundSupportProvider.js", operation: "try-catch", category: "runtime" });
            return true; 
        }
    }
}
