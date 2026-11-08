export class TargetSwitchFeatureExtractor {
  static extract(combatWindow) {
    const hits = combatWindow.hits || [];
    if (hits.length < 2) return { valid: false };

    let switches = 0;
    let ticksBetweenSwitches = [];
    let angularTravels = [];
    let attacksBetween = 0;
    
    for (let i = 1; i < hits.length; i++) {
      const prev = hits[i-1];
      const curr = hits[i];
      if (prev.targetId !== curr.targetId) {
        switches++;
        ticksBetweenSwitches.push(curr.tick - prev.tick);
        // angularTravel calculation skipped for brevity in proxy mock
      } else {
        attacksBetween++;
      }
    }

    return {
      schemaVersion: 1,
      valid: switches > 0,
      features: {
        switchesTotal: switches,
        attacksBetweenSwitches: attacksBetween,
        minTicksBetweenSwitches: ticksBetweenSwitches.length > 0 ? Math.min(...ticksBetweenSwitches) : 0,
        uniqueTargets: new Set(hits.map(h => h.targetId)).size
      }
    };
  }
}
