export class NoFallSessionWindow {
  constructor() {
    this.history = [];
    this.inputContextEpoch = null;
  }
  
  updateInputContext(newContext) {
    // InputContextEpoch respeta cambios PC/Touch sin blanquear evidencia de nofall.
    this.inputContextEpoch = newContext;
  }

  addEvidence(evidence) {
    this.history.push(evidence);
  }

  evaluate() {
    let missingDamageCount = this.history.filter(e => e.missingDamage).length;
    let midAirResetCount = this.history.filter(e => e.midAirReset).length;
    
    let findings = [];
    if (missingDamageCount > 2) findings.push('NOFALL_MISSING_DAMAGE_REPEATED');
    if (midAirResetCount > 2) findings.push('NOFALL_MID_AIR_RESET_REPEATED');
    
    if (this.history.some(e => e.missingDamage)) findings.push('NOFALL_DAMAGE_SUPPRESSION');
    if (this.history.some(e => e.expectedDamage > 0 && e.actualDamage === 0)) findings.push('NOFALL_ZERO_DAMAGE');
    if (this.history.some(e => e.groundSpoofCandidate)) findings.push('NOFALL_GROUND_SPOOF_CANDIDATE');
    if (this.history.some(e => e.fallResetCandidate)) findings.push('NOFALL_FALL_RESET_CANDIDATE');
    
    return {
      noFall: {
        shadowMode: true,
        actionTaken: "NONE",
        findings,
        missingDamageCount,
        midAirResetCount
      }
    };
  }
}
