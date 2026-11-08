import { ReachFeatureExtractor } from './ReachFeatureExtractor.js';
import { ReachRulesetProvider } from './ReachRulesetProvider.js';
import { ReachDetector } from './ReachDetector.js';
import * as fs from 'fs';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
  }
}

const defaultRuleset = ReachRulesetProvider.getRuleset("survival", "1.20", "sword");

function createEvent(distance, attackerVel, targetVel, latencyMode, hasAABB, inputEpoch = 1, targetId = "t1", attackTick = 1, gameMode = "survival") {
  // distance is horizontal
  const origin = { x: 0, y: 1.62, z: 0 };
  
  const targetPos = { x: distance, y: 0, z: 0 };
  
  return {
    attacker: { id: "a1" },
    target: { id: targetId },
    attackTick,
    attackerSnapshots: [{ x: 0, y: 0, z: 0 }],
    targetSnapshots: [targetPos],
    attackerContext: {
      isSneaking: false,
      gameMode,
      velocity: attackerVel
    },
    targetContext: {
      isSneaking: false,
      velocity: targetVel
    },
    boundingVolume: hasAABB ? {
      hasAABB: true,
      min: { x: targetPos.x - 0.3, y: 0, z: targetPos.z - 0.3 },
      max: { x: targetPos.x + 0.3, y: 1.8, z: targetPos.z + 0.3 }
    } : null,
    latencyContext: {
      latencyMode,
      authoritativeRewindTicks: latencyMode === "UNKNOWN" ? 0 : 5
    },
    inputContext: {
      epoch: inputEpoch
    },
    rulesetContext: defaultRuleset
  };
}

// Case 1: Stationay Valid Reach
const c1 = ReachFeatureExtractor.extract(createEvent(2.5, {x:0,y:0,z:0}, {x:0,y:0,z:0}, "GOOD", true));
assert(c1.result === "VALID", "Case 1: Stationary Valid Reach");

// Case 2: Stationary Invalid Reach (Soft)
const c2 = ReachFeatureExtractor.extract(createEvent(3.7, {x:0,y:0,z:0}, {x:0,y:0,z:0}, "GOOD", true));
assert(c2.result === "REACH_SOFT_EXCESS", "Case 2: Stationary Invalid Reach (Soft)");

// Case 3: Geometrically Impossible Reach
const c3 = ReachFeatureExtractor.extract(createEvent(5.0, {x:0,y:0,z:0}, {x:0,y:0,z:0}, "GOOD", true));
assert(c3.result === "GEOMETRICALLY_IMPOSSIBLE_REACH", "Case 3: Geometrically Impossible");

// Case 4: Approximated Volume reduced confidence
const c4 = ReachFeatureExtractor.extract(createEvent(3.2, {x:0,y:0,z:0}, {x:0,y:0,z:0}, "GOOD", false));
assert(c4.geometryConfidence < 1.0, "Case 4: Approx Volume reduces geometry confidence");

// Case 5: Motion Allowance covers excess
const c5 = ReachFeatureExtractor.extract(createEvent(3.4, {x:1,y:0,z:0}, {x:-1,y:0,z:0}, "GOOD", true));
assert(c5.motionAllowance > 0 && c5.result === "VALID", "Case 5: High relative velocity increases motion allowance");

// Case 6: Unknown latency reduces confidence and gives no allowance
const c6 = ReachFeatureExtractor.extract(createEvent(3.6, {x:0,y:0,z:0}, {x:0,y:0,z:0}, "UNKNOWN", true));
assert(c6.timingAllowance === 0 && c6.timingConfidence < 1.0 && c6.result === "REACH_SOFT_EXCESS", "Case 6: Unknown latency reduces timing confidence");

// Case 7: Creative mode has longer base reach
const c7 = ReachFeatureExtractor.extract(createEvent(4.8, {x:0,y:0,z:0}, {x:0,y:0,z:0}, "GOOD", true, 1, "t1", 1, "creative"));
assert(c7.result === "VALID", "Case 7: Creative mode allows longer reach");

// Case 8: Input context change doesn't reset but closes baseline
const detector8 = new ReachDetector("survival", "1.20", "sword");
detector8.processHit(createEvent(2.0, {x:0,y:0,z:0}, {x:0,y:0,z:0}, "GOOD", true, 1));
detector8.processHit(createEvent(2.0, {x:0,y:0,z:0}, {x:0,y:0,z:0}, "GOOD", true, 2));
const w8 = detector8.windows.get("a1");
assert(w8.baselines.length > 0, "Case 8: Input context epoch change closes baselines");

// Case 9-14: Combat Window with Violations (need min 5 hits and 2 targets)
const detector9 = new ReachDetector("survival", "1.20", "sword");
detector9.processHit(createEvent(3.8, {x:0,y:0,z:0}, {x:0,y:0,z:0}, "GOOD", true, 1, "t1", 1));
detector9.processHit(createEvent(3.9, {x:0,y:0,z:0}, {x:0,y:0,z:0}, "GOOD", true, 1, "t1", 2));
detector9.processHit(createEvent(3.8, {x:0,y:0,z:0}, {x:0,y:0,z:0}, "GOOD", true, 1, "t1", 3));
detector9.processHit(createEvent(3.9, {x:0,y:0,z:0}, {x:0,y:0,z:0}, "GOOD", true, 1, "t2", 4));
const eval9 = detector9.processHit(createEvent(3.8, {x:0,y:0,z:0}, {x:0,y:0,z:0}, "GOOD", true, 1, "t2", 5));
assert(eval9.evaluation.hasViolation === true && eval9.evaluation.evidenceRecords.length > 0, "Case 9: Combat Window detects violation across multiple hits and targets");

// Case 10: Combat Window No Violation (min hits not reached)
const detector10 = new ReachDetector("survival", "1.20", "sword");
const eval10 = detector10.processHit(createEvent(3.5, {x:0,y:0,z:0}, {x:0,y:0,z:0}, "GOOD", true, 1, "t1", 1));
assert(eval10.evaluation.hasViolation === false, "Case 10: No violation if minimum hits not reached");

// Case 11: Normalizing reach excess
assert(c2.normalizedReachExcess > 0 && c2.normalizedReachExcess < 1, "Case 11: Reach excess is normalized");

// Case 12: Sneaking reduces eye height
const event12 = createEvent(2.5, {x:0,y:0,z:0}, {x:0,y:0,z:0}, "GOOD", true);
event12.attackerContext.isSneaking = true;
const c12 = ReachFeatureExtractor.extract(event12);
assert(c12.originPosition.y === 1.54, "Case 12: Sneaking attacker has lower origin position");

// Case 13: Target sneaking reduces bounding box height when approximated
const event13 = createEvent(2.5, {x:0,y:0,z:0}, {x:0,y:0,z:0}, "GOOD", false);
event13.targetContext.isSneaking = true;
const c13 = ReachFeatureExtractor.extract(event13);
// Without AABB, it should use ApproximatePlayerVolumeProvider with height 1.5
assert(c13.volumeSource === "ApproximatePlayerVolumeProvider", "Case 13: Volume is approximated");

// Case 14: Reach Excess should be negative or zero if valid
assert(c1.reachExcess <= 0, "Case 14: Reach excess is <= 0 for valid hits");

// Case 15: Shadow mode check
const rulesetShadow = ReachRulesetProvider.getRuleset("survival", "1.20", "sword", true);
assert(rulesetShadow.reach.shadowMode === true, "Case 15: Shadow mode is configurable");

console.log(`\nTests completed: ${passed}/${total} passed.\n`);

// Fixtures
// 1. Normal combat with input device change
const fixture1 = [];
const dF1 = new ReachDetector("survival", "1.20", "sword");
fixture1.push(dF1.processHit(createEvent(2.5, {x:0,y:0,z:0}, {x:0,y:0,z:0}, "GOOD", true, 1, "t1", 1))); // Cell phone
fixture1.push(dF1.processHit(createEvent(2.5, {x:0,y:0,z:0}, {x:0,y:0,z:0}, "GOOD", true, 2, "t1", 5))); // PC (epoch change)
fs.writeFileSync('fixture_input_change.json', JSON.stringify(fixture1, null, 2));

// 2. Uncertain data due to motion
const fixture2 = [];
const dF2 = new ReachDetector("survival", "1.20", "sword");
fixture2.push(dF2.processHit(createEvent(3.2, {x:2,y:0,z:0}, {x:-2,y:0,z:0}, "GOOD", false, 1, "t1", 1)));
fixture2.push(dF2.processHit(createEvent(3.3, {x:2.5,y:0,z:0}, {x:-1.5,y:0,z:0}, "UNKNOWN", false, 1, "t1", 5)));
fs.writeFileSync('fixture_uncertain_motion.json', JSON.stringify(fixture2, null, 2));

// 3. Repetitive Reach pattern
const fixture3 = [];
const dF3 = new ReachDetector("survival", "1.20", "sword");
for (let i = 1; i <= 6; i++) {
  fixture3.push(dF3.processHit(createEvent(3.6, {x:0,y:0,z:0}, {x:0,y:0,z:0}, "GOOD", true, 1, i > 3 ? "t2" : "t1", i * 10)));
}
fs.writeFileSync('fixture_repetitive_reach.json', JSON.stringify(fixture3, null, 2));

console.log("Fixtures generated successfully.");
