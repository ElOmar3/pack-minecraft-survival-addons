class AimCombatWindow {
    constructor() {
        this.evidenceRecords = [];
        this.baseline = { type: 'COMBAT_WINDOW' };
        this.inputEpoch = 'Touch';
    }

    addInput(contextEpoch) {
        if (this.inputEpoch !== contextEpoch) {
            this.inputEpoch = contextEpoch;
            this.baseline.type = 'PLAYER_EPOCH';
        }
    }

    evaluate(features) {
        let shadowMode = true;
        let actionTaken = "NONE";
        let correlationGroup = "AIM_GROUP_1";
        
        let evidence = [];
        if (features.aimError < 0.1 && features.visibilityToAcquisitionTicks < 5) {
            evidence.push({
                type: "AIM_SNAP_REPEATED",
                correlationGroup,
                shadowMode,
                actionTaken
            });
        }

        if (features.trackingGain > 0.9 && features.aimErrorVariance < 0.05) {
            evidence.push({
                type: "AIM_TRACKING_LOW_PHASE_LAG",
                correlationGroup,
                shadowMode,
                actionTaken
            });
        }
        
        this.evidenceRecords.push(...evidence);
        return evidence;
    }
}

module.exports = { AimCombatWindow };
