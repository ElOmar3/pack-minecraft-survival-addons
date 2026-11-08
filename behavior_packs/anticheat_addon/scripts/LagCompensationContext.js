import { TelemetryManager } from "./TelemetryManager.js";
import { LatencyProvider, BoundingVolumeProvider } from "./Adapters.js";
import { Vector3 } from "./math/Vector3.js";
import { BoundingVolumes } from "./math/BoundingVolumes.js";
import { Interpolation } from "./math/Interpolation.js";

const CONFIG_ALLOWED_REWIND_TICKS = 0; // Authoritative rewind ticks for UNKNOWN_LATENCY
const CONFIG_DIAGNOSTIC_HISTORY_TICKS = 5; // 250ms

export class LagCompensationContext {
  static evaluate(attackTick, attacker, victim, baseReachLimit) {
    const aHistory = TelemetryManager.getHistory(attacker.id);
    const vHistory = TelemetryManager.getHistory(victim.id);

    if (!aHistory || !vHistory || aHistory.length === 0 || vHistory.length === 0) {
      return this._buildResult(attackTick, "NO_HISTORY", null, []);
    }

    const latency = LatencyProvider.sample(attacker);
    const aCurrent = aHistory[aHistory.length - 1];
    const vCurrent = vHistory[vHistory.length - 1];

    if (aCurrent.discontinuity || vCurrent.discontinuity || aCurrent.dimensionId !== vCurrent.dimensionId || aCurrent.generation !== vCurrent.generation) {
      return this._buildResult(attackTick, "DISCONTINUITY", null, []);
    }

    const currentEval = this._evaluateGeometry(aCurrent, vCurrent, victim, baseReachLimit);
    if (currentEval.valid) {
      return this._buildResult(attackTick, "CURRENT_STATE_VALID", currentEval, [], latency);
    }

    // Historical diagnostic candidates
    const candidates = [];
    let foundValidDiagnostic = false;

    for (let age = 1; age <= CONFIG_DIAGNOSTIC_HISTORY_TICKS; age++) {
      const aSnap = this._getSnapshot(aHistory, attackTick - age);
      const vSnap = this._getSnapshot(vHistory, attackTick - age);

      if (aSnap && vSnap) {
        if (aSnap.generation !== aCurrent.generation || vSnap.generation !== vCurrent.generation) continue;
        
        const evalHist = this._evaluateGeometry(aSnap, vSnap, victim, baseReachLimit);
        candidates.push({
          tick: attackTick - age,
          ageTicks: age,
          distance: evalHist.distance,
          valid: evalHist.valid,
          attackerSnapshotId: aSnap.tick,
          victimSnapshotId: vSnap.tick
        });

        if (evalHist.valid) {
          foundValidDiagnostic = true;
        }
      }
    }

    if (latency.mode === "UNKNOWN") {
      if (foundValidDiagnostic) {
        return this._buildResult(attackTick, "UNCERTAIN_NETWORK", currentEval, candidates, latency);
      } else {
        return this._buildResult(attackTick, "GEOMETRICALLY_INVALID", currentEval, candidates, latency);
      }
    }

    return this._buildResult(attackTick, "GEOMETRICALLY_INVALID", currentEval, candidates, latency);
  }

  static _evaluateGeometry(aSnap, vSnap, victim, baseReachLimit) {
    const vol = BoundingVolumeProvider.getVolume(victim, vSnap);
    if (!vol.supported && !vol.approximate) return { valid: false, distance: 999 };

    const aabb = {
      min: { x: vSnap.position.x - vol.width/2, y: vSnap.position.y, z: vSnap.position.z - vol.width/2 },
      max: { x: vSnap.position.x + vol.width/2, y: vSnap.position.y + vol.height, z: vSnap.position.z + vol.width/2 }
    };

    const dist = BoundingVolumes.distanceToAABB(aSnap.headPosition, aabb);
    return {
      distance: dist,
      valid: dist <= baseReachLimit
    };
  }

  static _getSnapshot(history, targetTick) {
    let closest = null;
    let minDiff = Infinity;
    for (const snap of history) {
      const diff = Math.abs(snap.tick - targetTick);
      if (diff < minDiff) {
        minDiff = diff;
        closest = snap;
      }
    }
    return closest; // Basic interpolation fallback could go here
  }

  static _buildResult(tick, resultString, currentEval, candidates, latency = {mode: "UNKNOWN", confidence: 0}) {
    return {
      attackTick: tick,
      currentEvaluation: currentEval,
      historicalCandidates: candidates,
      selectedCandidate: null,
      latencyMode: latency.mode,
      result: resultString,
      confidence: latency.mode === "UNKNOWN" ? 0.25 : latency.confidence
    };
  }
}
