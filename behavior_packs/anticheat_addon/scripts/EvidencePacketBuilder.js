export class EvidencePacketBuilder {
  static build(context) {
    // Generación de identificadores anónimos en vez de nombres
    const anonPlayerId = "anon_" + Math.abs(context.player.id.hashCode ? context.player.id.hashCode() : 0);

    const packet = {
      schemaVersion: 1,
      packetId: `evt_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
      createdAt: new Date().toISOString(),
      detectorVersion: "2.1.0",
      configurationVersion: "1.0",
      
      server: {
        bdsVersion: "1.26.32.2",
        serverApiRequested: "2.0.0",
        capabilityProbeBuildId: "anticheat-api-probe-2.8.0-001"
      },
      
      subject: {
        anonymousPlayerId: anonPlayerId,
        internalSubjectId: context.player ? context.player.name : "UNKNOWN_ENTITY",
        sessionId: context.sessionId || "unknown",
        generation: context.generation || 0,
        inputMode: context.inputMode || "UNKNOWN"
      },

      combat: {
        combatSessionId: context.combatSessionId || "none",
        startTick: context.startTick || 0,
        endTick: context.endTick || 0,
        durationTicks: context.durationTicks || 0,
        targetCount: context.targetCount || 1,
        attackCount: context.attackCount || 1
      },

      dataQuality: {
        overall: context.qualityScore || 1.0,
        missingFields: context.missingFields || [],
        discontinuities: context.discontinuities || 0,
        volumeSources: context.volumeSources || ["APPROXIMATION"],
        latencyMode: "UNKNOWN", // Fijo por 2.0.0 sin ping
        uncertainNetworkCount: context.uncertainNetworkCount || 0
      },

      features: {
        rotation: context.rotationFeatures || {},
        geometry: context.geometryFeatures || {},
        timing: context.timingFeatures || {},
        targetSwitching: context.targetSwitchFeatures || {},
        autoWeapon: context.autoWeaponFeatures || {},
        fly: context.flyFeatures || {},
        criticals: context.criticalsFeatures || {},
        scaffold: context.scaffoldFeatures || {}
      },

      evidence: context.evidenceList || [],

      suspicion: {
        scoreBefore: context.scoreBefore || 0,
        scoreAfter: context.scoreAfter || 0,
        stateBefore: context.stateBefore || "CLEAN",
        stateAfter: context.stateAfter || "CLEAN",
        categoryScores: context.categoryScores || {}
      },

      enforcement: {
        shadowMode: true,
        actionTaken: "NONE"
      },

      labels: {
        value: "UNKNOWN",
        source: null,
        confidence: null
      }
    };

    return packet;
  }
}
