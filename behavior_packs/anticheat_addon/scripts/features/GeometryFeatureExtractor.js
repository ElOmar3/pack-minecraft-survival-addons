import { BoundingVolumes } from "../math/BoundingVolumes.js";
import { Angles } from "../math/Angles.js";

export class GeometryFeatureExtractor {
  static extract(attackerSnap, victimSnap, victimEntity) {
    // 1. Identificar Origen y Volumen
    const viewOrigin = attackerSnap.headPosition;
    const viewDir = attackerSnap.viewDirection;
    const volResult = BoundingVolumes.createApproximateAABB(victimSnap.position, victimSnap.isSneaking, "minecraft:player"); // Adapter proxy

    // 2. Punto más cercano y distancias
    const closest = BoundingVolumes.getClosestPoint(viewOrigin, volResult);
    const dx = closest.x - viewOrigin.x;
    const dy = closest.y - viewOrigin.y;
    const dz = closest.z - viewOrigin.z;
    
    // Distancia al borde exacto
    const exactDist = Math.hypot(dx, dy, dz);
    const insideVolume = exactDist <= 0.05; // Margen de error flotante
    
    // 3. Error Angular (Yaw)
    const targetYaw = Math.atan2(dz, dx) * (180 / Math.PI) - 90;
    let centerAngularError = Angles.deltaYaw(attackerSnap.rotation.yaw, targetYaw);
    if (insideVolume) centerAngularError = 0;

    return {
      schemaVersion: 1,
      valid: true,
      features: {
        centerAngularError: Math.abs(centerAngularError),
        minimumVolumeAngularError: insideVolume ? 0 : Math.abs(centerAngularError),
        horizontalAngularMargin: insideVolume ? 180 : 15,
        verticalAngularMargin: insideVolume ? 180 : 25,
        rayIntersectsVolume: insideVolume || Math.abs(centerAngularError) < 15,
        lineOfSightChecked: false,
        blockOcclusionChecked: false,
        historicalBlockStateAvailable: false,
        volumeSource: volResult.approximate ? "APPROXIMATION" : "NATIVE_COLLISION_AABB"
      },
      quality: { geometryConfidence: volResult.approximate ? 0.8 : 1.0 },
      missing: [],
      warnings: []
    };
  }
}
