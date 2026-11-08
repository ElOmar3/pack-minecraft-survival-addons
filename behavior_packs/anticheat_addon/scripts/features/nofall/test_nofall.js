import { ErrorReporter } from "../../ErrorReporter.js";
import { FallDamageEventProvider } from './FallDamageEventProvider.js';
import { ExpectedFallDamageProvider } from './ExpectedFallDamageProvider.js';
import { FallEpisodeStateMachine } from './FallEpisodeStateMachine.js';
import { NoFallFeatureExtractor } from './NoFallFeatureExtractor.js';
import { NoFallSessionWindow } from './NoFallSessionWindow.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesPath = path.join(__dirname, 'fixtures_nofall.json');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

export function runTests() {
  let passed = 0;
  let failed = 0;

  fixtures.forEach(fixture => {
    try {
      const window = new NoFallSessionWindow();
      const stateMachine = new FallEpisodeStateMachine();
      const expectedProvider = new ExpectedFallDamageProvider();
      
      fixture.events.forEach(event => {
        if (event.type === 'INPUT_CHANGE') {
          window.updateInputContext(event.context);
        } else {
          const state = stateMachine.update(event.safeState);
          if (state === 'IMPACT' || state === 'MIDAIR_RESET') {
            const expected = expectedProvider.calculateExpectedDamage(event.safeState.fallDistance, event.mitigationFactor || 0, event.surfaceMitigation || 0);
            const features = NoFallFeatureExtractor.extractFeatures(state, expected, event.actualDamage || 0, event.environmentContext || {});
            window.addEvidence(features);
          }
        }
      });
      
      const result = window.evaluate();
      
      // Basic assertions
      if (result.noFall.shadowMode !== true) throw new Error("shadowMode is not true");
      if (result.noFall.actionTaken !== "NONE") throw new Error("actionTaken is not NONE");
      
      const expectedFindings = fixture.expectedFindings || [];
      const hasAllExpected = expectedFindings.every(f => result.noFall.findings.includes(f));
      if (!hasAllExpected) {
        throw new Error(`Expected findings ${JSON.stringify(expectedFindings)} but got ${JSON.stringify(result.noFall.findings)}`);
      }
      
      passed++;
      console.log(`Test passed: ${fixture.name}`);
    } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "test_nofall.js", operation: "try-catch", category: "runtime" });
      failed++;
      console.error(`Test failed: ${fixture.name}`, e);
    }
  });
  
  console.log(`Tests complete. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

runTests();
