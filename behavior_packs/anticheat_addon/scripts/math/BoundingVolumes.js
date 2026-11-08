import { Vector3 } from "./Vector3.js";

export class BoundingVolumes {
  static getClosestPoint(point, aabb) {
    if (!point || !aabb) return { x: 0, y: 0, z: 0 };
    return {
      x: Math.max(aabb.min.x, Math.min(point.x, aabb.max.x)),
      y: Math.max(aabb.min.y, Math.min(point.y, aabb.max.y)),
      z: Math.max(aabb.min.z, Math.min(point.z, aabb.max.z))
    };
  }

  static distanceToAABB(point, aabb) {
    const closest = this.getClosestPoint(point, aabb);
    const dx = point.x - closest.x;
    const dy = point.y - closest.y;
    const dz = point.z - closest.z;
    return Math.hypot(dx, dy, dz);
  }

  // Fallback para crear una AABB estática aproximada basada en la posición
  static createApproximateAABB(location, isSneaking = false, typeId = "minecraft:player") {
    let width = 0.6;
    let height = 1.8;
    if (typeId === "minecraft:player" && isSneaking) height = 1.5;
    
    return {
      min: { x: location.x - width/2, y: location.y, z: location.z - width/2 },
      max: { x: location.x + width/2, y: location.y + height, z: location.z + width/2 },
      approximate: true
    };
  }

  static intersectRayAabb(origin, direction, aabb, options = { maxDistance: 10, epsilon: 1e-6 }) {
    if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y) || !Number.isFinite(origin.z) || 
        !Number.isFinite(direction.x) || !Number.isFinite(direction.y) || !Number.isFinite(direction.z)) {
      return { validInput: false, intersects: false, insideVolume: false, tEnter: null, tExit: null, entryPoint: null, exitPoint: null, distance: null, reason: "INVALID_INPUT" };
    }

    const maxDist = options.maxDistance || 10;
    const eps = options.epsilon || 1e-6;

    // 1. Normalizar la dirección
    const dir = Vector3.normalize(direction);
    if (Math.abs(dir.x) < eps && Math.abs(dir.y) < eps && Math.abs(dir.z) < eps) {
      return { validInput: false, intersects: false, insideVolume: false, tEnter: null, tExit: null, entryPoint: null, exitPoint: null, distance: null, reason: "ZERO_DIRECTION" };
    }

    let tEnter = -Infinity;
    let tExit = Infinity;

    // Helper para cada eje
    const checkAxis = (originComponent, dirComponent, minC, maxC) => {
      if (Math.abs(dirComponent) < eps) {
        if (originComponent < minC || originComponent > maxC) return false;
        return true;
      }
      let t0 = (minC - originComponent) / dirComponent;
      let t1 = (maxC - originComponent) / dirComponent;
      if (t0 > t1) {
        const temp = t0; t0 = t1; t1 = temp;
      }
      if (t0 > tEnter) tEnter = t0;
      if (t1 < tExit) tExit = t1;
      return tEnter <= tExit;
    };

    // 2. Para cada eje, calcula el intervalo
    if (!checkAxis(origin.x, dir.x, aabb.min.x, aabb.max.x)) return { validInput: true, intersects: false, insideVolume: false, tEnter, tExit, entryPoint: null, exitPoint: null, distance: null, reason: "MISS_X" };
    if (!checkAxis(origin.y, dir.y, aabb.min.y, aabb.max.y)) return { validInput: true, intersects: false, insideVolume: false, tEnter, tExit, entryPoint: null, exitPoint: null, distance: null, reason: "MISS_Y" };
    if (!checkAxis(origin.z, dir.z, aabb.min.z, aabb.max.z)) return { validInput: true, intersects: false, insideVolume: false, tEnter, tExit, entryPoint: null, exitPoint: null, distance: null, reason: "MISS_Z" };

    // 5. Rechaza si tEnter > tExit (implícito arriba, pero por si acaso)
    if (tEnter > tExit) return { validInput: true, intersects: false, insideVolume: false, tEnter, tExit, entryPoint: null, exitPoint: null, distance: null, reason: "ENTER_GT_EXIT" };
    
    // 6. Rechaza si tExit < 0 (la AABB está detrás del rayo)
    if (tExit < 0) return { validInput: true, intersects: false, insideVolume: false, tEnter, tExit, entryPoint: null, exitPoint: null, distance: null, reason: "BEHIND_RAY" };

    // 7. Usa max(0, tEnter) cuando el origen esté dentro
    const insideVolume = tEnter < 0;
    const distance = insideVolume ? 0 : tEnter;

    // 8. Rechaza si la entrada supera maxDistance
    if (distance > maxDist) return { validInput: true, intersects: false, insideVolume, tEnter, tExit, entryPoint: null, exitPoint: null, distance, reason: "BEYOND_MAX_DISTANCE" };

    const entryPoint = { x: origin.x + dir.x * distance, y: origin.y + dir.y * distance, z: origin.z + dir.z * distance };
    const exitPoint = { x: origin.x + dir.x * tExit, y: origin.y + dir.y * tExit, z: origin.z + dir.z * tExit };

    return {
      validInput: true,
      intersects: true,
      insideVolume,
      tEnter,
      tExit,
      entryPoint,
      exitPoint,
      distance,
      reason: "INTERSECT"
    };
  }
}
