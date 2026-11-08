export const NoFallFeatureExtractor = {
  extractFeatures(episodeState, expectedDamage, actualDamage, environmentContext) {
    return {
      episodeState,
      expectedDamage,
      actualDamage,
      shadowMode: true,
      actionTaken: "NONE",
      missingDamage: expectedDamage > 0 && actualDamage === 0,
      midAirReset: episodeState === 'MIDAIR_RESET' && !environmentContext.legitimateReset,
      groundSpoofCandidate: episodeState === 'IMPACT' && expectedDamage > 0 && actualDamage === 0,
      fallResetCandidate: episodeState === 'MIDAIR_RESET'
    };
  }
};
