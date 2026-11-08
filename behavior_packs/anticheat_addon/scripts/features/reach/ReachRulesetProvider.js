export class ReachRulesetProvider {
  static getRuleset(gameMode, serverVersion, weapon, isShadowMode = true) {
    return {
      reach: {
        enabled: true,
        shadowMode: isShadowMode,
        envelopes: {
          baseReachByGameMode: {
            survival: 3.0,
            creative: 5.0,
            adventure: 3.0
          },
          maxGeometryAllowance: 0.20,
          maxMotionAllowance: 0.25,
          maxTimingAllowance: 0.15
        },
        detection: {
          minimumHitsPerWindow: 5,
          windowTicks: 200,
          minimumIndependentTargets: 2
        }
      }
    };
  }
}
