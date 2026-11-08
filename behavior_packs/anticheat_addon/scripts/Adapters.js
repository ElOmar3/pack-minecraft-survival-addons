export class LatencyProvider {
  static sample(player) {
    // 2.0.0 Fallback: Player.getPing() no estable.
    return {
      mode: "UNKNOWN",
      pingMs: null,
      jitterMs: null,
      confidence: 0
    };
  }
}

export class BoundingVolumeProvider {
  static profiles = new Map([
    ["minecraft:player", { width: 0.6, height: 1.8, confidence: 0.9 }],
    ["minecraft:cow", { width: 0.9, height: 1.4, confidence: 0.8 }]
  ]);

  static getApproximatePlayerVolume(entity, snapshot) {
    const isSneaking = snapshot ? snapshot.isSneaking : false;
    return {
      width: 0.6,
      height: isSneaking ? 1.5 : 1.8,
      source: "APPROXIMATION",
      approximate: true,
      confidence: 0.8
    };
  }

  static getVolume(entity, snapshot) {
    if (entity.typeId === "minecraft:player") {
      return this.getApproximatePlayerVolume(entity, snapshot);
    }

    const profile = this.profiles.get(entity.typeId);
    if (profile) {
      return {
        ...profile,
        source: "TYPE_PROFILE",
        approximate: true,
        confidence: profile.confidence
      };
    }

    return {
      supported: false,
      source: "UNKNOWN",
      approximate: true,
      confidence: 0,
      reason: "UNKNOWN_ENTITY_VOLUME"
    };
  }
}

export class DamageInterceptionProvider {
  static canIntercept() {
    return false; // Shadow mode for 2.0.0
  }

  static register(handler) {
    // Implementación futura para world.beforeEvents.entityHurt
  }
}

export function sampleInputInfo(player) {
  try {
    const inputInfo = player.inputInfo;
    return {
      available: true,
      lastInputModeUsed: inputInfo.lastInputModeUsed ?? null,
      movementVector: inputInfo.getMovementVector?.() ?? null,
      confidence: 1
    };
  } catch {
    return {
      available: false,
      lastInputModeUsed: null,
      movementVector: null,
      confidence: 0
    };
  }
}
