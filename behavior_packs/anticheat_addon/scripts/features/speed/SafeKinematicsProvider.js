import { ErrorReporter } from "../../ErrorReporter.js";
export class SafeKinematicsProvider {
    static getVelocity(oldPos, newPos, deltaTime) {
        try {
            if (!oldPos || !newPos || oldPos.x == null || oldPos.y == null || oldPos.z == null || newPos.x == null || newPos.y == null || newPos.z == null || !deltaTime) {
                return { x: 0, y: 0, z: 0, horizontalSpeed: 0, verticalSpeed: 0 };
            }
            const dx = newPos.x - oldPos.x;
            const dy = newPos.y - oldPos.y;
            const dz = newPos.z - oldPos.z;
            return {
                x: dx,
                y: dy,
                z: dz,
                horizontalSpeed: Math.sqrt(dx * dx + dz * dz) / deltaTime,
                verticalSpeed: dy / deltaTime
            };
        } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "SafeKinematicsProvider.js", operation: "try-catch", category: "runtime" });
            return { x: 0, y: 0, z: 0, horizontalSpeed: 0, verticalSpeed: 0 };
        }
    }
}
