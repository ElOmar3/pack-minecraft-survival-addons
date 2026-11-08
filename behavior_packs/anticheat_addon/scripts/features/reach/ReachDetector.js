import { ReachRulesetProvider } from './ReachRulesetProvider.js';
import { ReachFeatureExtractor } from './ReachFeatureExtractor.js';
import { ReachCombatWindow } from './ReachCombatWindow.js';

export class ReachDetector {
  constructor(gameMode, serverVersion, weapon) {
    this.ruleset = ReachRulesetProvider.getRuleset(gameMode, serverVersion, weapon, true);
    this.windows = new Map(); // by attacker
  }

  processHit(hitEvent) {
    const { attacker, target, attackTick, attackerSnapshots, targetSnapshots, attackerContext, targetContext, boundingVolume, latencyContext, inputContext } = hitEvent;
    
    if (!this.windows.has(attacker.id)) {
      this.windows.set(attacker.id, new ReachCombatWindow(this.ruleset));
    }
    
    const window = this.windows.get(attacker.id);
    
    const input = {
      attackTick,
      attackerSnapshots,
      targetSnapshots,
      attackerContext,
      targetContext,
      boundingVolume,
      latencyContext,
      rulesetContext: this.ruleset,
      inputContext
    };

    const extraction = ReachFeatureExtractor.extract(input);
    extraction.targetId = target.id;
    
    // Add correlation group
    const correlationGroup = `${attacker.id}-${target.id}`;
    extraction.correlationGroup = correlationGroup;
    
    window.addHit(attackTick, extraction, inputContext.epoch);
    
    const evaluation = window.evaluateWindow();
    
    // Data quality metadata
    const dataQuality = {
      geometryQuality: extraction.geometryConfidence,
      timingQuality: extraction.timingConfidence
    };
    
    let evidencePacket = null;
    if (evaluation.hasViolation) {
      evidencePacket = {
        attackerId: attacker.id,
        correlationGroup,
        records: evaluation.evidenceRecords,
        dataQuality,
        shadowMode: this.ruleset.reach.shadowMode,
        timestamp: Date.now()
      };
    }
    
    return {
      extraction,
      evaluation,
      evidencePacket
    };
  }
}
