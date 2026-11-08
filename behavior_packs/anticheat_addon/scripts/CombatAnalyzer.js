import { ErrorReporter } from "./ErrorReporter.js";
import { EquipmentSlot, system } from "@minecraft/server";
import { Config } from "./Config.js";
import { ExemptionManager } from "./ExemptionManager.js";
import { ViolationManager } from "./ViolationManager.js";
import { TelemetryManager } from "./TelemetryManager.js";
import { ReachDetector } from "./features/reach/ReachDetector.js";
import { AimFeatureExtractor } from "./features/AimFeatureExtractor.js";
import { LookRotationFeatureExtractor } from "./features/LookRotationFeatureExtractor.js";
import { extractFeatures as extractTriggerFeatures } from "./features/TriggerFeatureExtractor.js";
import { extractFeatures as extractAutoWeaponFeatures } from "./features/autoweapon/AutoWeaponFeatureExtractor.js";
import { EvidencePacketBuilder } from "./EvidencePacketBuilder.js";
import { VelocityDetector } from "./features/velocity/VelocityDetector.js";
import { CriticalFeatureExtractor } from "./features/criticals/CriticalFeatureExtractor.js";
import { CriticalCombatWindow } from "./features/criticals/CriticalCombatWindow.js";
import { CriticalDamageRulesetProvider } from "./features/criticals/CriticalDamageRulesetProvider.js";
import { AutoTotemFeatureExtractor } from "./features/equipment/AutoTotemFeatureExtractor.js";
import { AutoArmorFeatureExtractor } from "./features/equipment/AutoArmorFeatureExtractor.js";
import { InventoryRevisionTracker } from "./features/equipment/InventoryRevisionTracker.js";

const kickCounts = new Map();
function kickPlayer(player, reason) {
  const count = (kickCounts.get(player.name) || 0) + 1;
  kickCounts.set(player.name, count);
  // SHADOW MODE: Kicks are disabled. Gemma will analyze and report instead.
  if (count % 10 === 1) {
    console.warn(`[Shadow Mode] Se detectó comportamiento kickeable para ${player.name}: ${reason} (Alerta ${count}/10)`);
  }
}

export class CombatAnalyzer {
  static hitRecords = new Map();
  static combatTags = new Map();
  static reachDetector = new ReachDetector("survival", "1.26", "sword");
  static velocityDetector = new VelocityDetector();
  static criticalsWindow = new CriticalCombatWindow();
  static criticalsRuleset = new CriticalDamageRulesetProvider();
  
  static autoTotemExtractor = new AutoTotemFeatureExtractor();
  static autoArmorExtractor = new AutoArmorFeatureExtractor();
  static inventoryTracker = new InventoryRevisionTracker();

  static analyzeHit(event) {
    if (!Config.combat.enabled) return;

    try {
      const attacker = event.damagingEntity;
      const victim = event.hitEntity;

      if (!attacker || attacker.typeId !== "minecraft:player" || !victim) return;
      if (ExemptionManager.isPlayerSoftExempt(attacker)) return;

      const gameMode = attacker.getGameMode ? attacker.getGameMode() : "survival";
      if (gameMode === "creative" || gameMode === "spectator") return;

      const name = attacker.name;
      const now = Date.now();
      
      const locA = attacker.location;
      const locV = victim.location;

      // 1. Detección de CPS y Multi-Aura (Killaura)
      let attacks = this.hitRecords.get(name) || [];
      attacks = attacks.filter(hit => now - hit.ts < 1000);
      attacks.push({ ts: now, target: victim.id, isPlayer: victim.typeId === "minecraft:player" });
      this.hitRecords.set(name, attacks);

      const cps = attacks.length;
      if (cps > Config.combat.maxCpsLimit) {
        let weight = 15;
        let severity = "warn";
        if (cps > Config.combat.criticalCpsLimit) {
          weight = 40;
          severity = "kick";
        }
        
        const action = ViolationManager.addViolation(
          attacker,
          "combat.cps",
          cps,
          Config.combat.maxCpsLimit,
          weight,
          { cps: cps }
        );
        if (action === "punish" || severity === "kick") {
          kickPlayer(attacker, `§c[Server Integrity] Expulsado por CPS alto: ${cps}`);
        }
      }

      // 1.5. Detección de Multi-Aura (Atacar a múltiples entidades casi a la vez)
      const recentHits = attacks.filter(hit => now - hit.ts < 400); // Ventana de 400ms
      const distinctPlayerTargets = new Set(recentHits.filter(h => h.isPlayer).map(h => h.target)).size;
      if (distinctPlayerTargets >= 3) {
        // Atacar a 3 jugadores diferentes en 0.4 segundos es inhumano
        const action = ViolationManager.addViolation(
          attacker,
          "combat.multiaura",
          distinctPlayerTargets,
          2,
          40,
          { targets: distinctPlayerTargets }
        );
        if (action === "punish") {
          kickPlayer(attacker, `§c[Server Integrity] Expulsado por Multi-Aura Hack`);
        }
      }

      // 2. Detección Avanzada de Reach (ReachDetector v2)
      let dist = 0;
      try {
        const aHistory = TelemetryManager.getHistory(attacker.name) || [];
        const vHistory = TelemetryManager.getHistory(victim.name) || [];
        
        let aVel = { x: 0, y: 0, z: 0 };
        let vVel = { x: 0, y: 0, z: 0 };
        try { aVel = attacker.getVelocity(); } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "CombatAnalyzer.js", operation: "try-catch", category: "runtime" });}
        try { vVel = victim.getVelocity(); } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "CombatAnalyzer.js", operation: "try-catch", category: "runtime" });}

        const hitEvent = {
          attacker: { id: attacker.id },
          target: { id: victim.id },
          attackTick: Date.now(),
          attackerSnapshots: aHistory,
          targetSnapshots: vHistory,
          attackerContext: {
            isSneaking: attacker.isSneaking,
            gameMode: gameMode,
            velocity: aVel
          },
          targetContext: {
            isSneaking: victim.typeId === "minecraft:player" ? victim.isSneaking : false,
            velocity: vVel
          },
          boundingVolume: { hasAABB: false },
          latencyContext: { latencyMode: "UNKNOWN", authoritativeRewindTicks: 0 },
          inputContext: { epoch: 1 }
        };

        const { evidencePacket, extraction } = CombatAnalyzer.reachDetector.processHit(hitEvent);
        // Usamos extraction.observedReach para mantener compatibilidad con otras funciones
        dist = extraction.observedReach || 0;

        if (evidencePacket && evidencePacket.records && evidencePacket.records.length > 0) {
          const formattedPacket = EvidencePacketBuilder.build({
            player: attacker,
            evidenceList: evidencePacket.records,
            geometryFeatures: evidencePacket.dataQuality
          });
          console.warn("[AC_EVIDENCE_V1]" + JSON.stringify(formattedPacket));
        }
      } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "CombatAnalyzer.js", operation: "try-catch", category: "runtime" });
        console.warn("ReachDetector Integration Error: " + e);
      }

      // 2.2. Detección de Aim y Look Rotations (Shadow Mode Extractor)
      try {
        const aHistory = TelemetryManager.getHistory(attacker.name) || [];
        // Calculate Target Bearing Yaw
        const dx = victim.location.x - attacker.location.x;
        const dz = victim.location.z - attacker.location.z;
        let tYaw = (Math.atan2(dz, dx) * 180 / Math.PI) - 90;
        
        const stateData = {
          targetBearingYaw: tYaw, 
          currentYaw: attacker.getRotation ? attacker.getRotation().y : 0
        };
        const dataQuality = { latency: 50, interpolations: 0, approximateAABB: true };
        
        // 1. Aim Feature Extractor
        const aimFeatures = AimFeatureExtractor.extract(stateData, dataQuality);
        if (aimFeatures) {
          const snapCandidate = AimFeatureExtractor.detectSnapAim(aimFeatures);
          const smoothCandidate = AimFeatureExtractor.detectSmoothAim(aimFeatures);
          
          if (snapCandidate || smoothCandidate) {
            const formattedPacket = EvidencePacketBuilder.build({
              player: attacker,
              evidenceList: [snapCandidate || smoothCandidate]
            });
            console.warn("[AC_EVIDENCE_V1]" + JSON.stringify(formattedPacket));
          }
        }
        
        // 2. Look Rotation Feature Extractor
        const lookSequenceData = {
          snapshots: aHistory.map(h => ({ 
            yaw: h.yaw, 
            pitch: h.pitch, 
            targetCenterYaw: tYaw, 
            targetVolumeMinYaw: tYaw - 15, 
            targetVolumeMaxYaw: tYaw + 15, 
            isHitTick: h === aHistory[aHistory.length - 1] 
          })),
          combatSessionId: CombatAnalyzer.combatTags.get(attacker.name) || "session_1",
          attackSequence: Date.now().toString(),
          targetId: victim.id,
          inputContextEpoch: 1
        };
        
        const lookResult = LookRotationFeatureExtractor.extract(lookSequenceData, dataQuality);
        if (lookResult && lookResult.evidences && lookResult.evidences.length > 0) {
          const formattedPacket = EvidencePacketBuilder.build({
            player: attacker,
            evidenceList: lookResult.evidences.map(e => ({ type: e, score: lookResult.score }))
          });
          console.warn("[AC_EVIDENCE_V1]" + JSON.stringify(formattedPacket));
        }

        // 3. TriggerBot Feature Extractor
        const currentTick = Date.now();
        const triggerInput = {
          attackTick: currentTick,
          targetVolumeHistory: aHistory.map(h => ({ tick: h.timestamp || currentTick, intersects: true, distance: dist })),
          combatContext: { events: CombatAnalyzer.hitRecords.get(attacker.name) || [] }
        };
        const triggerFeatures = extractTriggerFeatures(triggerInput.combatContext.events, {
          combatSessionId: CombatAnalyzer.combatTags.get(attacker.name) || "session_1",
          targetId: "target",
          timeBucket: 0,
          targetInLineOfSight: true
        });
        if (triggerFeatures && triggerFeatures.evidences && triggerFeatures.evidences.length > 0) {
          const formattedPacket = EvidencePacketBuilder.build({
            player: attacker,
            evidenceList: triggerFeatures.evidences.map(e => ({ type: e, score: 1.0 }))
          });
          console.warn("[AC_EVIDENCE_V1]" + JSON.stringify(formattedPacket));
        }

        // 4. Auto-Weapon Feature Extractor
        let currentSlot = 0;
        let currentItem = { typeId: "minecraft:air", combatScore: 0 };
        try {
          const invComp = attacker.getComponent('minecraft:inventory');
          if (invComp && invComp.container) {
            currentSlot = attacker.selectedSlotIndex || 0;
            const itemStack = invComp.container.getItem(currentSlot);
            if (itemStack) {
              currentItem.typeId = itemStack.typeId;
              // Simple combat score proxy (could be expanded by WeaponRulesetProvider)
              if (itemStack.typeId.includes("sword")) currentItem.combatScore = 10;
              else if (itemStack.typeId.includes("axe")) currentItem.combatScore = 8;
            }
          }
        } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "CombatAnalyzer.js", operation: "try-catch", category: "runtime" });
          // Ignore container read errors in combat hotpath
        }

        const autoWeaponInput = {
          attackTick: currentTick,
          snapshots: aHistory.map(h => ({ 
            tick: h.timestamp || currentTick, 
            selectedSlotIndex: currentSlot, 
            item: currentItem 
          })),
          context: { isMultiTarget: false, falsePositiveRisk: 0.0, inputEpochTicks: 100 }
        };
        autoWeaponInput.context.combatSessionId = CombatAnalyzer.combatTags.get(attacker.name) || "session_1";
        const autoWeaponFeatures = extractAutoWeaponFeatures(autoWeaponInput.snapshots, autoWeaponInput.context);
        if (autoWeaponFeatures && autoWeaponFeatures.evidences && autoWeaponFeatures.evidences.length > 0) {
          const formattedPacket = EvidencePacketBuilder.build({
            player: attacker,
            evidenceList: autoWeaponFeatures.evidences.map(e => ({ type: e, score: 1.0 })),
            autoWeaponFeatures: autoWeaponFeatures.evidences
          });
          console.warn("[AC_EVIDENCE_V1]" + JSON.stringify(formattedPacket));
        }

      } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "CombatAnalyzer.js", operation: "try-catch", category: "runtime" });
        console.warn("Aim/Look/Trigger/AutoWeapon Integration Error: " + e);
      }

      // 2.5. Detección de Aim Assist / Kill Aura (Golpes fuera del campo de visión)
      try {
        const viewDir = attacker.getViewDirection?.();
        if (viewDir && dist > 1.5) { // Aplicar a golpes de más de 1.5 bloques
          const vx = locV.x - locA.x;
          // Compensar altura (el centro de la hitbox de la víctima suele estar más arriba que los pies del atacante)
          const vy = (locV.y + 0.8) - (locA.y + 1.6);
          const vz = locV.z - locA.z;
          const mag = Math.hypot(vx, vy, vz) || 1;
          const dot = ((viewDir.x * vx) + (viewDir.y * vy) + (viewDir.z * vz)) / mag;

          // dot 0.5 = 60 grados. dot 0 = 90 grados. dot -1 = 180 grados (espalda)
          if (dot < 0.5) { // Menos de 60 grados
            let weight = 10;
            if (dot < 0.0) weight = 30; // Golpear hacia atrás o 90 grados exactos es descarado

            ViolationManager.addViolation(
              attacker,
              "combat.aim",
              dot,
              0.5,
              weight,
              { dot: dot.toFixed(3), distance: dist.toFixed(2) }
            );
          }

          // Fase 4: Extracción de Features (Dinámica de rotación - Snap Aim)
          const history = TelemetryManager.getHistory(name);
          if (history.length >= 5) {
            const recent = history.slice(-5);
            let maxDeltaYaw = 0;
            for (let i = 1; i < recent.length; i++) {
              let dyaw = Math.abs(recent[i].yaw - recent[i-1].yaw);
              if (dyaw > 180) dyaw = 360 - dyaw; // Normalización circular
              if (dyaw > maxDeltaYaw) maxDeltaYaw = dyaw;
            }
            
            // --- VELOCITY / ANTI-KB FEATURE EXTRACTOR (Shadow Mode) ---
            try {
              const constraints = { touchingWall: false, touchingCeiling: false }; // simplified constraints
              const episode = {
                impactEvent: { type: "melee", knockbackAmount: 1.0, timestamp: Date.now() },
                preState: { x: victim.location.x, y: victim.location.y, z: victim.location.z },
                postStates: [{ x: victim.location.x, y: victim.location.y, z: victim.location.z, timestamp: Date.now() }]
              };
              
              const velocityResult = CombatAnalyzer.velocityDetector.analyze(episode, { knockbackResistance: 0 }, constraints);
              if (velocityResult && velocityResult.evidence && velocityResult.evidence.antiKnockback) {
                 const formattedPacket = EvidencePacketBuilder.build({
                   player: attacker,
                   evidenceList: [{ type: "VELOCITY_CANDIDATE_DETECTED", score: 1.0 }],
                   velocityFeatures: [velocityResult.evidence.antiKnockback]
                 });
                 console.warn("[AC_EVIDENCE_V1]" + JSON.stringify(formattedPacket));
              }
            } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "CombatAnalyzer.js", operation: "try-catch", category: "runtime" });
              console.warn("VelocityDetector Integration Error: " + e);
            }
            // --- CRITICALS FEATURE EXTRACTOR (Shadow Mode) ---
            try {
              CombatAnalyzer.criticalsWindow.addEvent({
                type: "attack",
                tick: system.currentTick || Date.now(),
                attackerId: name,
                targetId: victim.name,
                hasGroundSupport: attacker.isOnGround,
                velocity: { x: 0, y: attacker.getVelocity ? attacker.getVelocity().y : 0, z: 0 }
              });
              CombatAnalyzer.criticalsWindow.addEvent({
                type: "damage",
                tick: system.currentTick || Date.now(),
                sourceId: name,
                targetId: victim.name,
                damage: 10 // Simplified mock for hitting
              });
              
              const criticalsFeatures = CriticalFeatureExtractor.extract(CombatAnalyzer.criticalsWindow, CombatAnalyzer.criticalsRuleset);
              if (criticalsFeatures && criticalsFeatures.threatType !== "NONE") {
                 const formattedPacket = EvidencePacketBuilder.build({
                   player: attacker,
                   evidenceList: [{ type: "CRITICALS_CANDIDATE_DETECTED", score: 1.0 }],
                   criticalsFeatures: criticalsFeatures
                 });
                 console.warn("[AC_EVIDENCE_V1]" + JSON.stringify(formattedPacket));
              }
            } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "CombatAnalyzer.js", operation: "try-catch", category: "runtime" });
              console.warn("CriticalFeatureExtractor Integration Error: " + e);
            }
            
            // --- EQUIPMENT EXTRACTOR (Shadow Mode) ---
            try {
              const health = attacker.getComponent('minecraft:health')?.currentValue || 20;
              CombatAnalyzer.autoTotemExtractor.updateCombatState(name, system.currentTick || Date.now(), health);
              CombatAnalyzer.autoArmorExtractor.updateCombatState(name, system.currentTick || Date.now());
              
              const equippable = attacker.getComponent('minecraft:equippable');
              const realInv = equippable ? {
                'head': equippable.getEquipment(EquipmentSlot.Head)?.typeId || '',
                'chest': equippable.getEquipment(EquipmentSlot.Chest)?.typeId || '',
                'legs': equippable.getEquipment(EquipmentSlot.Legs)?.typeId || '',
                'feet': equippable.getEquipment(EquipmentSlot.Feet)?.typeId || '',
                'offhand': equippable.getEquipment(EquipmentSlot.Offhand)?.typeId || ''
              } : {};
              
              const revision = CombatAnalyzer.inventoryTracker.updateSnapshot(name, system.currentTick || Date.now(), realInv);
              const totemFeatures = CombatAnalyzer.autoTotemExtractor.extractFeatures(name, revision);
              const armorFeatures = CombatAnalyzer.autoArmorExtractor.extractFeatures(name, revision);
              
              const evidenceList = [];
              if (totemFeatures && totemFeatures.autoTotem.features.length > 0) evidenceList.push({ type: "AUTOTOTEM_CANDIDATE_DETECTED", score: 1.0 });
              if (armorFeatures && armorFeatures.autoArmor.features.length > 0) evidenceList.push({ type: "AUTOARMOR_CANDIDATE_DETECTED", score: 1.0 });
              
              if (evidenceList.length > 0) {
                 const formattedPacket = EvidencePacketBuilder.build({
                   player: attacker,
                   evidenceList: evidenceList,
                   equipmentFeatures: {
                     autoTotem: totemFeatures ? totemFeatures.autoTotem.features : [],
                     autoArmor: armorFeatures ? armorFeatures.autoArmor.features : []
                   }
                 });
                 console.warn("[AC_EVIDENCE_V1]" + JSON.stringify(formattedPacket));
              }
            } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "CombatAnalyzer.js", operation: "try-catch", category: "runtime" });
              console.warn("EquipmentFeatureExtractor Integration Error: " + e);
            }
            // ----------------------------------------------------------

            // Si hace un giro de más de 90 grados en un solo tick y golpea a alguien al borde de su visión
            if (maxDeltaYaw > 90 && dot < 0.8) {
              const action = ViolationManager.addViolation(attacker, "combat.snap_aim", maxDeltaYaw, 90, 40, { dot });
              if (action === "punish") {
                kickPlayer(attacker, `§c[Server Integrity] Expulsado por Aimbot (Snap Aim)`);
              }
            }
          }
        }
      } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "CombatAnalyzer.js", operation: "try-catch", category: "runtime" });}

      // 2.8. Detección de Hit through Wall (Golpear a través de bloques sólidos)
      try {
        if (dist > 1.5) {
          const midX = (locA.x + locV.x) / 2;
          const midY = (locA.y + locV.y) / 2 + 1.2; // Altura aproximada de la cabeza
          const midZ = (locA.z + locV.z) / 2;
          
          const midBlock = attacker.dimension.getBlock({ x: Math.floor(midX), y: Math.floor(midY), z: Math.floor(midZ) });
          
          if (midBlock && midBlock.isSolid) {
            const bId = midBlock.typeId;
            const isLegit = bId.includes("door") || bId.includes("gate") || bId.includes("slab") || bId.includes("stair") || bId.includes("scaffolding") || bId.includes("leaves") || bId.includes("snow") || bId.includes("trapdoor") || bId.includes("fence") || bId.includes("wall") || bId.includes("chest") || bId.includes("bed") || bId.includes("lantern") || bId.includes("web") || bId.includes("sign") || bId.includes("tallgrass") || bId.includes("flower");

            if (!isLegit) {
              ViolationManager.addViolation(
                attacker,
                "combat.wallhack",
                1,
                0,
                30,
                { block: bId, distance: dist }
              );
            }
          }
        }
      } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "CombatAnalyzer.js", operation: "try-catch", category: "runtime" });}

      // 3. Combat Tag (Anti-Combat Log)
      if (victim.typeId === "minecraft:player") {
        const combatTime = now + 10000; // 10 segundos
        this.combatTags.set(attacker.name, combatTime);
        this.combatTags.set(victim.name, combatTime);

        // Mensaje discreto en actionbar para recordarles que están en combate
        try {
          attacker.runCommand("title @s actionbar §c§l¡EN COMBATE! §7No te desconectes (10s)");
          victim.runCommand("title @s actionbar §c§l¡EN COMBATE! §7No te desconectes (10s)");
        } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "CombatAnalyzer.js", operation: "try-catch", category: "runtime" });}
      }
    } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "CombatAnalyzer.js", operation: "try-catch", category: "runtime" });}
  }

  static isInCombat(playerName) {
    const expires = this.combatTags.get(playerName);
    if (!expires) return false;
    if (Date.now() > expires) {
      this.combatTags.delete(playerName);
      return false;
    }
    return true;
  }

  static clearPlayer(playerName) {
    this.hitRecords.delete(playerName);
    this.combatTags.delete(playerName);
  }
}
