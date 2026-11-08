import { LagCompensationContext } from "./LagCompensationContext.js";
import { TelemetryManager } from "./TelemetryManager.js";
import { BoundingVolumes } from "./math/BoundingVolumes.js";
import { Angles } from "./math/Angles.js";

// Mock para simular los tests sin el entorno completo de BDS
export function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) { passed++; }
    else { failed++; console.error("[TEST FAILED]", message); }
  }

  // 1. Math Tests (Wrap de Yaw)
  assert(Angles.normalizeYaw(360) === 0, "Yaw wrap 360 -> 0");
  assert(Angles.normalizeYaw(-190) === 170, "Yaw wrap -190 -> 170");
  assert(Angles.deltaYaw(170, -170) === -20, "Delta yaw 170 to -170 is -20");

  // 2. Ring Buffer Tests
  const data = TelemetryManager.getSessionData({ id: "mock_player", dimension: { id: "overworld" }});
  const buf = data.buffer;
  for (let i = 1; i <= 70; i++) {
    buf.push({ tick: i, position: { x: i, y: 0, z: 0 } });
  }
  const hist = buf.toArray();
  assert(hist.length === 60, "Buffer capacity constant at 60");
  assert(hist[0].tick === 11, "Chronological order start is 11");
  assert(hist[59].tick === 70, "Chronological order end is 70");

  // 3. Lag Compensation Context Tests (Mocking Telemetry)
  TelemetryManager.telemetry.set("a1", { buffer: { toArray: () => [{ tick: 100, position: {x:0, y:0, z:0}, headPosition: {x:0, y:1.62, z:0}, generation: 1, dimensionId: "overworld" }] } });
  TelemetryManager.telemetry.set("v1", { buffer: { toArray: () => [{ tick: 100, position: {x:2.5, y:0, z:0}, headPosition: {x:2.5, y:1.8, z:0}, generation: 1, dimensionId: "overworld" }] } });
  
  const victimMock = { id: "v1", typeId: "minecraft:player" };
  const attackerMock = { id: "a1" };
  
  // Distancia ojo a hitbox: A está en X=0, V está en X=2.5. Hitbox de V va de 2.2 a 2.8. Distancia = 2.2.
  // Base reach 3.0. Debería ser CURRENT_STATE_VALID.
  const res1 = LagCompensationContext.evaluate(100, attackerMock, victimMock, 3.0);
  assert(res1.result === "CURRENT_STATE_VALID", "Lag Comp: Current state valid");

  // Test 4: UNCERTAIN_NETWORK
  // Atacante en X=0. Victima en X=4.0 (inválido, dist=3.7). Histórico de victima en X=2.5 (válido).
  TelemetryManager.telemetry.set("v2", { buffer: { toArray: [
    { tick: 95, position: {x:2.5, y:0, z:0}, headPosition: {x:2.5, y:1.8, z:0}, generation: 1, dimensionId: "overworld" },
    { tick: 100, position: {x:4.0, y:0, z:0}, headPosition: {x:4.0, y:1.8, z:0}, generation: 1, dimensionId: "overworld" }
  ] } });
  TelemetryManager.telemetry.set("a2", { buffer: { toArray: [
    { tick: 95, position: {x:0, y:0, z:0}, headPosition: {x:0, y:1.62, z:0}, generation: 1, dimensionId: "overworld" },
    { tick: 100, position: {x:0, y:0, z:0}, headPosition: {x:0, y:1.62, z:0}, generation: 1, dimensionId: "overworld" }
  ] } });

  const res2 = LagCompensationContext.evaluate(100, { id: "a2" }, { id: "v2", typeId: "minecraft:player" }, 3.0);
  assert(res2.result === "UNCERTAIN_NETWORK", "Lag Comp: Uncertain Network for valid historical candidate");

  console.warn(`[TESTS] Passed: ${passed} | Failed: ${failed}`);
}

export function runBenchmark() {
  const start = Date.now();
  for (let i = 0; i < 10000; i++) {
    Angles.normalizeYaw(Math.random() * 1000);
  }
  const dur = Date.now() - start;
  console.warn(`[BENCHMARK] 10,000 yaw wraps in ${dur}ms`);
}
