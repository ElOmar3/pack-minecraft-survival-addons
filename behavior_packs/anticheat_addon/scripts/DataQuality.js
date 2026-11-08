export class DataQuality {
  static computeDataQuality(components, requiredFeatureGroups) {
    let overallScore = 0;
    let totalWeight = 0;
    
    // Normalize weights
    for (const group of requiredFeatureGroups) {
      if (components[group]) {
        totalWeight += components[group].weight || 0;
      }
    }
    
    if (totalWeight === 0) return { score: 0, formulaVersion: "quality-weighted-v1" };

    const normalizationFactor = 1.0 / totalWeight;

    let hasApproximation = false;
    let hasMissing = false;

    for (const group of requiredFeatureGroups) {
      const comp = components[group];
      if (!comp || !comp.applicable) {
        hasMissing = true;
        continue;
      }
      
      const normalizedWeight = comp.weight * normalizationFactor;
      overallScore += (comp.score !== null ? comp.score : 0) * normalizedWeight;

      if (comp.reasons && (comp.reasons.includes("APPROXIMATE_VOLUME") || comp.reasons.includes("UNKNOWN_LATENCY"))) {
        hasApproximation = true;
      }
    }

    if ((hasApproximation || hasMissing) && overallScore === 1.0) {
      overallScore = 0.99; // Cap for approximated data
    }

    return {
      score: overallScore,
      formulaVersion: "quality-weighted-v1"
    };
  }
}
