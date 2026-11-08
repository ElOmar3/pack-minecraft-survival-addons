export class ReachFeatureExtractor {
  static extract(input) {
    const {
      attackTick,
      attackerSnapshots,
      targetSnapshots,
      attackerContext,
      targetContext,
      boundingVolume,
      latencyContext,
      rulesetContext,
      inputContext
    } = input;
    
    let warnings = [];
    let geometryConfidence = 1.0;
    let timingConfidence = 1.0;

    if (!attackerSnapshots || attackerSnapshots.length === 0 || !targetSnapshots || targetSnapshots.length === 0) {
      return { valid: false, warnings: ["Missing snapshots"] };
    }

    const rules = rulesetContext.reach;

    // Head location or history equivalent
    const attackerEyeHeight = attackerContext.isSneaking ? 1.54 : 1.62;
    const attackerPos = attackerSnapshots[0]; 
    const originPosition = { x: attackerPos.x, y: attackerPos.y + attackerEyeHeight, z: attackerPos.z };
    const originSource = "head_location";

    let vMinX, vMaxX, vMinY, vMaxY, vMinZ, vMaxZ;
    let volumeSource = "";

    const targetPos = targetSnapshots[0];

    if (boundingVolume && boundingVolume.hasAABB) {
      vMinX = boundingVolume.min.x;
      vMaxX = boundingVolume.max.x;
      vMinY = boundingVolume.min.y;
      vMaxY = boundingVolume.max.y;
      vMinZ = boundingVolume.min.z;
      vMaxZ = boundingVolume.max.z;
      volumeSource = "NATIVE_COLLISION_AABB";
    } else {
      // ApproximatePlayerVolumeProvider
      const targetHeight = targetContext.isSneaking ? 1.5 : 1.8;
      const targetWidth = 0.3; // radius
      vMinX = targetPos.x - targetWidth;
      vMaxX = targetPos.x + targetWidth;
      vMinY = targetPos.y;
      vMaxY = targetPos.y + targetHeight;
      vMinZ = targetPos.z - targetWidth;
      vMaxZ = targetPos.z + targetWidth;
      volumeSource = "ApproximatePlayerVolumeProvider";
      geometryConfidence *= 0.8; 
    }

    // Measure distance to closest point on AABB
    const closestPoint = {
      x: Math.max(vMinX, Math.min(originPosition.x, vMaxX)),
      y: Math.max(vMinY, Math.min(originPosition.y, vMaxY)),
      z: Math.max(vMinZ, Math.min(originPosition.z, vMaxZ))
    };

    const observedReach = Math.hypot(
      originPosition.x - closestPoint.x,
      originPosition.y - closestPoint.y,
      originPosition.z - closestPoint.z
    );

    const horizontalReach = Math.hypot(
      originPosition.x - closestPoint.x,
      originPosition.z - closestPoint.z
    );
    const verticalDifference = originPosition.y - closestPoint.y;

    // Allowances
    const baseAllowedReach = rules.envelopes.baseReachByGameMode[attackerContext.gameMode] || 3.0;
    
    let geometryAllowance = rules.envelopes.maxGeometryAllowance * geometryConfidence;
    
    // Relative velocity for temporal uncertainty
    const attackerVel = attackerContext.velocity || { x: 0, y: 0, z: 0 };
    const targetVel = targetContext.velocity || { x: 0, y: 0, z: 0 };
    const relativeVelocity = {
      x: attackerVel.x - targetVel.x,
      y: attackerVel.y - targetVel.y,
      z: attackerVel.z - targetVel.z
    };
    const separatingVelocity = Math.hypot(relativeVelocity.x, relativeVelocity.y, relativeVelocity.z);
    
    let motionAllowance = Math.min(separatingVelocity * 0.5, rules.envelopes.maxMotionAllowance);
    
    // Latency
    let timingAllowance = 0;
    if (latencyContext.latencyMode === "UNKNOWN" || latencyContext.authoritativeRewindTicks === 0) {
       timingAllowance = 0; // No blind ping compensation
       timingConfidence *= 0.5;
    } else {
       timingAllowance = rules.envelopes.maxTimingAllowance * timingConfidence;
    }

    const totalAllowedEnvelope = baseAllowedReach + geometryAllowance + motionAllowance + timingAllowance;
    const reachExcess = observedReach - totalAllowedEnvelope;
    const normalizedReachExcess = reachExcess > 0 ? reachExcess / totalAllowedEnvelope : 0;

    let result = "VALID";
    if (reachExcess > 0) {
      if (reachExcess > 1.0) {
        result = "GEOMETRICALLY_IMPOSSIBLE_REACH";
      } else {
        result = "REACH_SOFT_EXCESS";
      }
    }

    return {
      valid: true,
      observedReach,
      horizontalReach,
      verticalDifference,
      closestPoint,
      originPosition,
      originSource,
      volumeSource,
      baseAllowedReach,
      geometryAllowance,
      motionAllowance,
      timingAllowance,
      totalAllowedEnvelope,
      reachExcess,
      normalizedReachExcess,
      relativeVelocity,
      separatingVelocity,
      geometryConfidence,
      timingConfidence,
      result,
      warnings
    };
  }
}
