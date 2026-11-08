import { ErrorReporter } from "./ErrorReporter.js";
import { system, EquipmentSlot } from "@minecraft/server";
import { Config } from "./Config.js";
import { ExemptionManager } from "./ExemptionManager.js";
import { PlayerStateManager } from "./PlayerStateManager.js";
import { FlyFeatureExtractor } from "./features/fly/FlyFeatureExtractor.js";
import { SpeedFeatureExtractor } from "./features/speed/SpeedFeatureExtractor.js";
import { BunnyHopFeatureExtractor } from "./features/speed/BunnyHopFeatureExtractor.js";
import { MovementAuthorizationRegistry } from "./features/speed/MovementAuthorizationRegistry.js";
import { MovementSessionWindow } from "./features/speed/MovementSessionWindow.js";
import { PhaseStateMachine } from "./features/phase/PhaseStateMachine.js";
import { SafeWorldCollisionProvider } from "./features/phase/SafeWorldCollisionProvider.js";
import { PhaseAuthorizationRegistry } from "./features/phase/PhaseAuthorizationRegistry.js";
import { WorldChangeRegistry } from "./features/phase/WorldChangeRegistry.js";
import { EvidencePacketBuilder } from "./EvidencePacketBuilder.js";
import { FallEpisodeStateMachine } from "./features/nofall/FallEpisodeStateMachine.js";
import { NoFallFeatureExtractor } from "./features/nofall/NoFallFeatureExtractor.js";
import { ExpectedFallDamageProvider } from "./features/nofall/ExpectedFallDamageProvider.js";
import { ViolationManager } from "./ViolationManager.js";
function safeGetBlock(dim, loc) {
  try {
    return dim.getBlock(loc);
  } catch (e) {
    return null;
  }
}

export class MovementAnalyzer {
  static speedAuthRegistry = new MovementAuthorizationRegistry();
  static speedWindowManager = new MovementSessionWindow();
  static speedExtractor = new SpeedFeatureExtractor(MovementAnalyzer.speedAuthRegistry, MovementAnalyzer.speedWindowManager);
  static bhopExtractor = new BunnyHopFeatureExtractor(MovementAnalyzer.speedWindowManager);
  
  static phaseWorldProvider = new SafeWorldCollisionProvider();
  static phaseAuthRegistry = new PhaseAuthorizationRegistry();
  static phaseWorldChanges = new WorldChangeRegistry();
  static phaseStateMachine = new PhaseStateMachine(MovementAnalyzer.phaseWorldProvider, MovementAnalyzer.phaseAuthRegistry, MovementAnalyzer.phaseWorldChanges);
  
  static fallStateMachine = new FallEpisodeStateMachine();
  static expectedDamageProvider = new ExpectedFallDamageProvider();

  static analyze(player) {
    if (!Config.movement.enabled) return;

    const gameMode = player.getGameMode ? player.getGameMode() : "survival";
    if (gameMode === "creative" || gameMode === "spectator") return;

    const name = player.name;
    const currentLoc = player.location;
    const onGround = player.isOnGround;
    // Estas propiedades pueden no existir en @minecraft/server 2.0.0; usar fallback seguro
    let isGliding = player.isGliding ?? false;
    if (!isGliding) {
      try {
        const eq = player.getComponent("minecraft:equippable");
        if (eq) {
          const chest = eq.getEquipment(EquipmentSlot?.Chest ?? "Chest");
          if (chest && chest.typeId === "minecraft:elytra" && !player.isOnGround) {
            isGliding = true;
          }
        }
      } catch(e) {}
    }
    const isSwimming = player.isSwimming ?? false;
    const isClimbing = player.isClimbing ?? false;
    const isRiding = !!(player.getComponent?.("minecraft:riding")?.entityRidingOn) || false;

    if (ExemptionManager.isPlayerSoftExempt(player)) return;

    // Verificar exenciones activas (tp, kb, portals)
    if (ExemptionManager.isExempt(name, "knockback") || ExemptionManager.isExempt(name, "teleport")) {
      return;
    }
    if (isGliding || isSwimming || isClimbing || isRiding) return;

    if (player.getEffect?.("levitation") || player.getEffect?.("minecraft:levitation") || player.getEffect?.("slow_falling") || player.getEffect?.("minecraft:slow_falling")) return;

    const prevLoc = PlayerStateManager.getPreviousLoc(name);
    if (!prevLoc) return;

    if (Config.experimental.shadowExtractors) {
      // --- FLY / AIRWALK FEATURE EXTRACTOR (Shadow Mode) ---
      try {
      const pState = PlayerStateManager.getState(name);
      if (pState && pState.history && pState.history.length > 2) {
        const flySnapshots = pState.history.map(h => ({
          tick: h.tick || h.timestamp, 
          position: { x: h.x, y: h.y, z: h.z }, 
          isOnGround: h.onGround, 
          isGliding, 
          isSwimming, 
          isClimbing 
        }));
        
        const flyFeatures = FlyFeatureExtractor.extractFeatures({
          movementSnapshots: flySnapshots,
          worldContext: { dimension: player.dimension.id }
        });
        
        if (flyFeatures && flyFeatures.evidences && flyFeatures.evidences.length > 0) {
          const formattedPacket = EvidencePacketBuilder.build({
            player: player,
            evidenceList: flyFeatures.evidences.map(e => ({ type: e, score: 1.0 })),
            movementFeatures: flyFeatures.evidences
          });
          console.warn("[AC_EVIDENCE_V1]" + JSON.stringify(formattedPacket));
        }
      }
      } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "MovementAnalyzer.js", operation: "try-catch", category: "runtime" });
        console.warn("FlyFeatureExtractor Integration Error: " + e);
      }
      // --- SPEED / BUNNYHOP FEATURE EXTRACTOR (Shadow Mode) ---
      try {
      const dt = 50; // ms approximation for a tick
      let blockUnderneath = null;
      try {
        blockUnderneath = safeGetBlock(player.dimension, { 
          x: Math.floor(currentLoc.x), 
          y: Math.floor(currentLoc.y - 1), 
          z: Math.floor(currentLoc.z) 
        });
      } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "MovementAnalyzer.js", operation: "try-catch", category: "runtime" });
        // Block might not be loaded
      }

      const speedResult = MovementAnalyzer.speedExtractor.analyze(
        name,
        { x: prevLoc.x, y: prevLoc.y, z: prevLoc.z },
        { x: currentLoc.x, y: currentLoc.y, z: currentLoc.z },
        dt,
        player,
        blockUnderneath,
        { epoch: 1 } // input context simplified for now
      );
      
      const bhopResult = MovementAnalyzer.bhopExtractor.analyze(name, player);
      
      let evidences = [];
      if (speedResult && speedResult.speed && speedResult.speed.evidence) {
        evidences = evidences.concat(speedResult.speed.evidence);
      }
      if (bhopResult && bhopResult.bunnyHop && bhopResult.bunnyHop.evidence) {
        evidences = evidences.concat(bhopResult.bunnyHop.evidence);
      }
      
      if (evidences.length > 0) {
        const formattedPacket = EvidencePacketBuilder.build({
          player: player,
          evidenceList: evidences.map(e => ({ type: e, score: 1.0 })),
          speedFeatures: evidences
        });
        console.warn("[AC_EVIDENCE_V1]" + JSON.stringify(formattedPacket));
      }
      } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "MovementAnalyzer.js", operation: "try-catch", category: "runtime" });
        console.warn("Speed/Bhop FeatureExtractor Integration Error: " + e);
      }
    }
    
    // --- EXPERIMENTAL EXTRACTORS DISABLED FOR PERFORMANCE ---
    // The shared FallStateMachine was mixing player states causing endless NOFALL logs
    // The Phase extractor's getBlock calls are too heavy for runInterval(1)

    // 1. Detección de Speed
    const dx = currentLoc.x - prevLoc.x;
    const dz = currentLoc.z - prevLoc.z;
    const distH = Math.sqrt(dx * dx + dz * dz);

    // tickDelta siempre es 1 (el bucle corre cada tick)
    const tickDelta = 1;
    let maxSpeed = Config.movement.speedBaseMax * tickDelta;
    const speedEffect = player.getEffect?.("speed") || player.getEffect?.("minecraft:speed");
    if (speedEffect) {
      maxSpeed += Config.movement.speedAmplifierMultiplier * (speedEffect.amplifier + 1);
    }

    if (distH > maxSpeed && distH < 50.0) {
      const state = PlayerStateManager.getState(name);
      if (state) {
        state.speedFlags = (state.speedFlags || 0) + 1;
      }

      if ((state?.speedFlags || 0) >= Config.movement.speedBufferThreshold) {
        const action = ViolationManager.addViolation(
          player,
          "movement.speed",
          distH,
          maxSpeed,
          15,
          { deltaX: dx, deltaZ: dz }
        );
        if (action === "rollback" || action === "punish") {
          player.teleport({ x: prevLoc.x, y: prevLoc.y, z: prevLoc.z }, { dimension: player.dimension });
        }
        if (state) {
          state.speedFlags = 0;
        }
      }
    } else {
      const state = PlayerStateManager.getState(name);
      if (state) {
        state.speedFlags = Math.max(0, (state.speedFlags || 0) - 1);
      }
    }

    // 2. Detección de Fly / AirJump
    const dy = currentLoc.y - prevLoc.y;
    const state = PlayerStateManager.getState(name);
    if (state) {
      let verticalGrace = -0.05;
      const jumpBoost = player.getEffect?.("jump_boost") || player.getEffect?.("minecraft:jump_boost");
      if (jumpBoost) {
        verticalGrace += Config.movement.jumpAmplifierMultiplier * (jumpBoost.amplifier + 1);
      }

      if (!onGround && dy >= verticalGrace) {
        state.airTicks = (state.airTicks || 0) + 1;
        if (state.airTicks > Config.movement.airTicksThreshold) {
          // Chequear si hay un bloque directamente abajo para evitar lag
          let hasBlockBelow = false;
          try {
            for (const yOffset of [1, 2]) {
              const blockBelow = safeGetBlock(player.dimension, {
                x: Math.floor(currentLoc.x),
                y: Math.floor(currentLoc.y) - yOffset,
                z: Math.floor(currentLoc.z)
              });
              if (blockBelow && !blockBelow.isAir) {
                hasBlockBelow = true;
                break;
              }
            }
          } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "MovementAnalyzer.js", operation: "try-catch", category: "runtime" });}

          if (!hasBlockBelow) {
            const action = ViolationManager.addViolation(
              player,
              "movement.fly",
              state.airTicks,
              Config.movement.airTicksThreshold,
              20
            );
            if (action === "rollback" || action === "punish") {
              player.teleport({ x: prevLoc.x, y: prevLoc.y - 1, z: prevLoc.z }, { dimension: player.dimension });
              state.airTicks = 0;
            }
          }
        }
      } else {
        state.airTicks = 0;
      }
    }

    // 3. Detección de Phase / NoClip (Estar dentro de bloques sólidos)
    if (Config.movement.phaseChecks && system.currentTick % Config.movement.phaseCheckIntervalTicks === 0) {
      try {
        const blocksToCheck = [
          safeGetBlock(player.dimension, { x: Math.floor(currentLoc.x), y: Math.floor(currentLoc.y + 1.5), z: Math.floor(currentLoc.z) }), // Head
          safeGetBlock(player.dimension, { x: Math.floor(currentLoc.x), y: Math.floor(currentLoc.y + 0.8), z: Math.floor(currentLoc.z) }), // Body
          safeGetBlock(player.dimension, { x: Math.floor(currentLoc.x), y: Math.floor(currentLoc.y), z: Math.floor(currentLoc.z) }) // Feet
        ];

        let phaseDetected = false;
        let phasedBlockId = "";
        
        for (const block of blocksToCheck) {
          if (block && block.isSolid) {
            const bId = block.typeId;
            const isLegit = bId.includes("door") || bId.includes("gate") || bId.includes("slab") || bId.includes("stair") || bId.includes("scaffolding") || bId.includes("piston") || bId.includes("leaves") || bId.includes("snow") || bId.includes("trapdoor") || bId.includes("fence") || bId.includes("wall") || bId.includes("chest") || bId.includes("bed") || bId.includes("lantern") || bId.includes("web") || bId.includes("sign");
            
            if (!isLegit) {
              phaseDetected = true;
              phasedBlockId = bId;
              break;
            }
          }
        }

        if (phaseDetected) {
          const pState = PlayerStateManager.getState(name);
          pState.phaseFlags = (pState.phaseFlags || 0) + 1;

          if (pState.phaseFlags >= Config.movement.phaseBufferThreshold) {
            const action = ViolationManager.addViolation(
              player,
              "movement.phase",
              1,
              0,
              25,
              { block: phasedBlockId }
            );
            if (action === "rollback" || action === "punish") {
              player.teleport({ x: prevLoc.x, y: prevLoc.y, z: prevLoc.z }, { dimension: player.dimension });
            }
            pState.phaseFlags = 0;
          }
        } else {
          const pState = PlayerStateManager.getState(name);
          if (pState) {
            pState.phaseFlags = Math.max(0, (pState.phaseFlags || 0) - 0.2);
          }
        }
      } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "MovementAnalyzer.js", operation: "try-catch", category: "runtime" });}
    }

    // 4. Detección de Step / HighJump
    if (dy > 0.6) {
      const jumpBoost = player.getEffect?.("jump_boost") || player.getEffect?.("minecraft:jump_boost");
      const expectedJump = 0.42 + (jumpBoost ? (jumpBoost.amplifier + 1) * 0.15 : 0);
      
      if (dy > expectedJump + 0.1) {
        const pState = PlayerStateManager.getState(name);
        if (pState) {
          pState.stepFlags = (pState.stepFlags || 0) + 1;
          
          if (pState.stepFlags >= 3) {
            const action = ViolationManager.addViolation(
              player, 
              "movement.step_or_highjump", 
              dy, 
              expectedJump, 
              20, 
              { expected: expectedJump }
            );
            if (action === "rollback" || action === "punish") {
              player.teleport({ x: prevLoc.x, y: prevLoc.y, z: prevLoc.z }, { dimension: player.dimension });
            }
            pState.stepFlags = 0;
          }
        }
      }
    } else {
      const pState = PlayerStateManager.getState(name);
      if (pState) {
        pState.stepFlags = Math.max(0, (pState.stepFlags || 0) - 1);
      }
    }

    // 5. Detección de Jesus (Caminar sobre líquidos)
    /*
    try {
      const blockBelow = safeGetBlock(player.dimension, { x: Math.floor(currentLoc.x), y: Math.floor(currentLoc.y - 0.2), z: Math.floor(currentLoc.z) });
      if (blockBelow && (blockBelow.typeId === "minecraft:water" || blockBelow.typeId === "minecraft:flowing_water" || blockBelow.typeId === "minecraft:lava" || blockBelow.typeId === "minecraft:flowing_lava")) {
        const blockAtFeet = safeGetBlock(player.dimension, { x: Math.floor(currentLoc.x), y: Math.floor(currentLoc.y), z: Math.floor(currentLoc.z) });
        if (!blockAtFeet || blockAtFeet.isAir || blockAtFeet.typeId === "minecraft:air") {
          if (!isSwimming && !isRiding && !player.hasTag("frost_walker")) {
            const pState = PlayerStateManager.getState(name);
            if (pState) {
              pState.jesusFlags = (pState.jesusFlags || 0) + 1;
              if (pState.jesusFlags >= 8) {
                const action = ViolationManager.addViolation(player, "movement.jesus", 1, 0, 15, { liquid: blockBelow.typeId });
                if (action === "rollback" || action === "punish") {
                  player.teleport({ x: prevLoc.x, y: prevLoc.y, z: prevLoc.z }, { dimension: player.dimension });
                }
                pState.jesusFlags = 0;
              }
            }
          }
        }
      } else {
        const pState = PlayerStateManager.getState(name);
        if (pState) {
          pState.jesusFlags = Math.max(0, (pState.jesusFlags || 0) - 1);
        }
      }
    } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "MovementAnalyzer.js", operation: "try-catch", category: "runtime" });}
    */
  }
}
