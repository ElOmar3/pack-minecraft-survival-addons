export class ReachCombatWindow {
  constructor(rulesetContext) {
    this.rules = rulesetContext.reach;
    this.hits = [];
    this.currentInputContextEpoch = 0;
    this.baselines = [];
  }

  addHit(attackTick, featureExtract, inputContextEpoch) {
    if (this.currentInputContextEpoch !== inputContextEpoch) {
      // Close baselines but don't reset evidence
      this.closeBaselines();
      this.currentInputContextEpoch = inputContextEpoch;
    }

    this.hits.push({ attackTick, ...featureExtract });
    // Keep only hits within windowTicks
    this.hits = this.hits.filter(h => attackTick - h.attackTick <= this.rules.detection.windowTicks);
  }

  closeBaselines() {
    this.baselines.push([...this.hits]);
  }

  evaluateWindow() {
    const hitCount = this.hits.length;
    let validHitCount = 0;
    let excessHitCount = 0;
    let targets = new Set();
    
    let patterns = new Set();

    for (const h of this.hits) {
      if (h.valid) validHitCount++;
      if (h.reachExcess > 0) excessHitCount++;
      if (h.targetId) targets.add(h.targetId);
      
      if (h.result !== "VALID") {
        patterns.add(h.result);
      }
    }

    const independentTargets = targets.size;

    let hasViolation = false;
    let evidenceRecords = [];

    if (hitCount >= this.rules.detection.minimumHitsPerWindow && independentTargets >= this.rules.detection.minimumIndependentTargets) {
       // Need at least minimum hits and targets
       if (excessHitCount > 0) {
          hasViolation = true;
          for (const pattern of patterns) {
            evidenceRecords.push({
               pattern: pattern,
               hitCount,
               validHitCount,
               excessHitCount,
               independentTargets
            });
          }
       }
    }

    return {
      hitCount,
      validHitCount,
      excessHitCount,
      independentTargets,
      hasViolation,
      evidenceRecords
    };
  }
}
