export class LookRotationFeatureExtractor {
    static extract(attackSequenceData, dataQuality) {
        if (!attackSequenceData || !attackSequenceData.snapshots) {
            return null;
        }

        const {
            snapshots,
            combatSessionId,
            attackSequence,
            targetId,
            inputContextEpoch
        } = attackSequenceData;

        // Requirement 1: Shadow Mode only
        const shadowMode = true;
        const actionTaken = "NONE";

        let classification = "NORMAL_ROTATION_SUPPORTED";
        let evidences = [];
        let score = 0;

        // Requirement 5: Eval pre-hit and post-hit windows (5-10 pre, 2-5 post)
        const hitSnapshotIndex = snapshots.findIndex(s => s.isHitTick);
        if (hitSnapshotIndex === -1) {
            return {
                shadowMode,
                actionTaken,
                classification: "NO_HIT_TICK",
                evidences,
                features: {}
            };
        }

        const hitSnapshot = snapshots[hitSnapshotIndex];
        const preHitSnapshots = snapshots.slice(Math.max(0, hitSnapshotIndex - 10), hitSnapshotIndex);
        const postHitSnapshots = snapshots.slice(hitSnapshotIndex + 1, hitSnapshotIndex + 6); // Up to 5 post

        // Requirement 4: Calculate rotationViewDirectionResidual
        const maxResidual = Math.max(...snapshots.map(s => s.rotationViewDirectionResidual || 0));

        // Requirement 3: Calculate features by snapshot
        const calcError = (s) => {
            if (!s) return null;
            let yawErrorToCenter = Math.abs(s.yaw - s.targetCenterYaw);
            let yawErrorToVolume = 0;
            if (s.yaw < s.targetVolumeMinYaw) yawErrorToVolume = s.targetVolumeMinYaw - s.yaw;
            else if (s.yaw > s.targetVolumeMaxYaw) yawErrorToVolume = s.yaw - s.targetVolumeMaxYaw;

            let minimumAngularErrorToVolume = yawErrorToVolume;
            return { yawErrorToCenter, minimumAngularErrorToVolume };
        };

        const hitError = calcError(hitSnapshot);
        if (hitError.minimumAngularErrorToVolume > 0) {
            evidences.push("LOOK_HIT_OUTSIDE_VOLUME");
        }

        // Requirement 6: Detect One-tick rotation injection
        let preToHitAngularDelta = 0;
        let snapBackRatio = 0;
        
        if (preHitSnapshots.length > 0) {
            const preHit = preHitSnapshots[preHitSnapshots.length - 1];
            preToHitAngularDelta = Math.abs(hitSnapshot.yaw - preHit.yaw);

            if (postHitSnapshots.length > 0) {
                const postHit = postHitSnapshots[0];
                const postToHitDelta = Math.abs(postHit.yaw - hitSnapshot.yaw);
                if (preToHitAngularDelta > 5) { // Minimum delta to consider it a snap
                    snapBackRatio = postToHitDelta / preToHitAngularDelta;
                }
            }
        }

        // Requirement 7: Detect Frozen rotation or stale look
        let isStaleLook = false;
        let abnormalTargetSwitch = false; // Just a placeholder for context, can be passed in attackSequenceData
        if (snapshots.length >= 3) {
            isStaleLook = snapshots.every(s => s.yaw === snapshots[0].yaw && s.pitch === snapshots[0].pitch);
            if (isStaleLook) {
                if (attackSequenceData.switchedTarget) {
                    abnormalTargetSwitch = true;
                }
            }
        }

        // Threat Models and Classifications
        if (preToHitAngularDelta > 15 && snapBackRatio > 0.8) {
            classification = "ONE_TICK_ROTATION_INJECTION"; // wait, requirement says threat models: ONE_TICK_ROTATION_INJECTION
            // req 8 says "Classifications allowed: SILENT_ROTATION_CANDIDATE, etc". Let's use ONE_TICK_ROTATION_INJECTION_CANDIDATE
            classification = "ONE_TICK_ROTATION_INJECTION_CANDIDATE";
            evidences.push("LOOK_ONE_TICK_INJECTION_REPEATED");
            score = 1.0;
        } else if (preToHitAngularDelta > 10 && hitError.minimumAngularErrorToVolume === 0 && maxResidual > 0) {
            classification = "SILENT_ROTATION_CANDIDATE";
            score = 0.8;
        } else if (isStaleLook && preToHitAngularDelta === 0) {
            classification = "ROTATION_SPOOF_OR_STALE_LOOK_CANDIDATE";
            if (abnormalTargetSwitch) {
                evidences.push("ABNORMAL_TARGET_SWITCH");
            }
            score = 0.7;
        } else if (preToHitAngularDelta > 15 && snapBackRatio < 0.2) {
            classification = "SNAP_AND_RETURN_CANDIDATE"; // SNAP_AND_RETURN threat model
            score = 0.6;
        }

        // Requirement 13: Data quality considerations
        if (dataQuality) {
            if (dataQuality.latency > 150 || dataQuality.interpolations > 2) {
                // Reduces confidence but doesn't ban (already shadowMode)
                score *= 0.5;
            }
            // approximated AABB
            if (dataQuality.approximateAABB) {
                score *= 0.8;
            }
        }

        // Requirement 10: deduplicate with correlationGroup
        const correlationGroup = `look:${combatSessionId}:${attackSequence}:${targetId}`;

        // Ensure we don't output SILENT_ROTATION_CONFIRMED
        if (classification === "SILENT_ROTATION_CONFIRMED") {
            classification = "SILENT_ROTATION_CANDIDATE";
        }

        return {
            shadowMode,
            actionTaken,
            classification,
            evidences,
            correlationGroup,
            inputContextEpoch,
            score,
            features: {
                yawErrorToTargetCenter: hitError.yawErrorToCenter,
                minimumAngularErrorToVolume: hitError.minimumAngularErrorToVolume,
                preToHitAngularDelta,
                snapBackRatio,
                rotationViewDirectionResidual: maxResidual
            }
        };
    }
}
