const AimFeatureExtractor = {
    extract: function(state, dataQuality) {
        if (!state) return null;
        
        let aimError = 0;
        let volumeSource = 0;
        let trackingGain = 0;
        let aimErrorVariance = 0;
        let visibilityToAcquisitionTicks = 0;
        let overshootRate = 0;
        let microCorrectionFrequency = 0;

        if (state.targetBearingYaw) {
            aimError = Math.abs(state.targetBearingYaw - state.currentYaw);
        }

        if (dataQuality.latency > 150 || dataQuality.interpolations > 2) {
            aimError += 0.5; // less confidence
        }

        return {
            aimError,
            volumeSource,
            trackingGain,
            aimErrorVariance,
            visibilityToAcquisitionTicks,
            overshootRate,
            microCorrectionFrequency
        };
    },
    
    detectSnapAim: function(features) {
        if (features.aimError < 0.1 && features.visibilityToAcquisitionTicks < 5) {
            return { type: "AIM_SNAP_REPEATED", score: 1.0 };
        }
        return null;
    },

    detectSmoothAim: function(features) {
        if (features.trackingGain > 0.9 && features.aimErrorVariance < 0.05) {
            return { type: "AIM_TRACKING_LOW_PHASE_LAG", score: 1.0 };
        }
        return null;
    }
};

export { AimFeatureExtractor };
