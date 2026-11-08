import { Config } from "./Config.js";

export class CombatSuspicion {
  static HALF_LIFE_TICKS = 200; // 10 segundos
  static players = new Map();

  static _getPlayerData(playerId) {
    if (!this.players.has(playerId)) {
      this.players.set(playerId, {
        score: 0,
        lastUpdateTick: 0,
        state: "CLEAN", // CLEAN, OBSERVING, SUSPICIOUS, REVIEW_REQUIRED
        categoryScores: new Map(),
        recentEvidenceIds: new Set(),
        combatSessionId: null
      });
    }
    return this.players.get(playerId);
  }

  static _applyLazyDecay(data, currentTick) {
    if (data.score === 0 || currentTick <= data.lastUpdateTick) return;
    const elapsed = currentTick - data.lastUpdateTick;
    const decayFactor = Math.pow(0.5, elapsed / this.HALF_LIFE_TICKS);
    
    data.score = data.score * decayFactor;
    for (const [cat, val] of data.categoryScores.entries()) {
      data.categoryScores.set(cat, val * decayFactor);
    }
    data.lastUpdateTick = currentTick;

    // Actualizar estado hacia abajo si aplica
    if (data.score < 20) data.state = "CLEAN";
  }

  static addEvidence(evidence) {
    const data = this._getPlayerData(evidence.playerId);
    this._applyLazyDecay(data, evidence.tick);

    // Evitar duplicados por grupo de correlación temporal
    if (evidence.correlationGroup && data.recentEvidenceIds.has(evidence.correlationGroup)) {
      return; // Deduplicado
    }
    if (evidence.correlationGroup) {
      data.recentEvidenceIds.add(evidence.correlationGroup);
    }

    const effectiveStrength = evidence.strength * evidence.confidence * evidence.reliability * (evidence.context?.dataQuality || 1);
    
    // Gating / Saturación por categoría
    const currentCatScore = data.categoryScores.get(evidence.category) || 0;
    const MAX_CAT_SCORE = Config.scoring.categoryCaps[evidence.category] || 50; 
    let addedScore = effectiveStrength;
    
    if (currentCatScore + addedScore > MAX_CAT_SCORE) {
      addedScore = MAX_CAT_SCORE - currentCatScore;
    }

    data.categoryScores.set(evidence.category, currentCatScore + addedScore);
    data.score += addedScore;

    // Bonificación por categorías independientes
    if (Config.scoring.synergy.enabled) {
      const activeCategories = Array.from(data.categoryScores.values()).filter(v => v > 10).length;
      if (activeCategories >= 2) {
        data.score *= Config.scoring.synergy.multiplier; 
      }
    }

    // Actualizar Estado
    if (data.score > Config.scoring.stateThresholds.reviewRequired) data.state = "REVIEW_REQUIRED";
    else if (data.score > Config.scoring.stateThresholds.suspicious) data.state = "SUSPICIOUS";
    else if (data.score > Config.scoring.stateThresholds.observing) data.state = "OBSERVING";

    // SHADOW MODE: No expulsamos ni cancelamos daño.
    if (data.state === "REVIEW_REQUIRED") {
      console.warn(`[SHADOW_MODE_ALERT] Jugador ${evidence.playerId} requiere revisión. Score: ${data.score}`);
    }
  }

  static getScore(playerId, currentTick) {
    const data = this._getPlayerData(playerId);
    this._applyLazyDecay(data, currentTick);
    return data.score;
  }
}
