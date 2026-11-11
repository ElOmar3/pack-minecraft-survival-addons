export const Config = {
  enabled: true,
  movement: {
    enabled: true,
    speedBaseMax: 0.8,
    speedAmplifierMultiplier: 0.15,
    speedBufferThreshold: 5,
    airTicksThreshold: 20,
    jumpAmplifierMultiplier: 0.5,
    phaseChecks: false,
    phaseCheckIntervalTicks: 5,
    phaseBufferThreshold: 5
  },
  combat: {
    enabled: true,
    maxCpsLimit: 15,
    criticalCpsLimit: 20,
    baseReachLimit: 5.2,
    criticalReachLimit: 6.5
  },
  inventory: {
    enabled: true,
    checkInterval: 100,
    chestStealerWindowMs: 500,
    chestStealerBurstThreshold: 5,
    cleanForbidden: false,
    sanitizeInvalidStacks: false,
    correctEnchants: false,
    maxBreaksPerTick: 3,
    maxBreaksPerSecond: 15,
    autoToolHardBreakThreshold: 3
  },
  scoring: {
    categoryCaps: {
      ROTATION: 50,
      GEOMETRY: 50,
      TARGET_SWITCH: 50,
      ATTACK_TIMING: 50
    },
    stateThresholds: {
      observing: 20,
      suspicious: 50,
      reviewRequired: 80
    },
    synergy: {
      enabled: false,
      multiplier: 1.0
    }
  },
  performance: {
    disableOnLowTps: true,
    tpsThreshold: 15.0,
    maxCpuUsageMs: 12,
    // El análisis completo de movimiento es costoso en un VPS de 2 vCPU. A 2
    // ticks sigue respondiendo en 100 ms, pero reduce a la mitad ese trabajo.
    movementCheckIntervalTicks: 2,
    tpsSampleIntervalTicks: 10,
    evidenceFlushIntervalTicks: 10,
    observationCooldownMs: 60000
  },
  experimental: {
    shadowExtractors: false
  },
  violations: {
    decayRate: 0.1,
    maxViolationScore: 100,
    punishThreshold: 80,
    rollbackThreshold: 50,
    alertThreshold: 40
  }
};
