import { world } from "@minecraft/server";
import { Config } from "./Config.js";
import { EvidenceOutbox } from "./EvidenceOutbox.js";
import { ConsoleNdjsonSink } from "./ConsoleNdjsonSink.js";
import { EvidencePacketBuilder } from "./EvidencePacketBuilder.js";

export class Logger {
  static outbox = new EvidenceOutbox();
  static sink = new ConsoleNdjsonSink();
  static lastEmittedViolations = new Map();
  static getWorld() {
    return world;
  }

  static logViolation(player, detector, score, observed, expected, action = "none", context = {}) {
    const now = Date.now();
    const key = `${player.name}:${detector}`;
    // Las acciones punitivas conservan su telemetría rápida; las observaciones
    // repetidas se limitan para no llenar la consola durante actividad normal.
    const cooldownMs = action === "punish" || action === "rollback"
      ? 5000
      : Config.performance.observationCooldownMs;
    const lastEmittedAt = this.lastEmittedViolations.get(key) || 0;
    if (now - lastEmittedAt < cooldownMs) return;
    this.lastEmittedViolations.set(key, now);

    let priority = "OBSERVATION";
    if (action === "warn") priority = "SUSPICIOUS";
    if (action === "punish" || action === "rollback") priority = "REVIEW_REQUIRED";

    const packet = EvidencePacketBuilder.build({
      player: player,
      sessionId: "bds-session",
      generation: 1,
      inputMode: "UNKNOWN",
      combatSessionId: context.combatSessionId || "none",
      startTick: 0,
      endTick: 0,
      durationTicks: context.durationTicks || 0,
      targetCount: 1,
      attackCount: 1,
      qualityScore: 1.0,
      missingFields: [],
      discontinuities: 0,
      volumeSources: ["APPROXIMATION"],
      uncertainNetworkCount: 0,
      rotationFeatures: context.rotation || {},
      geometryFeatures: context.geometry || {},
      timingFeatures: context.timing || {},
      targetSwitchFeatures: context.targetSwitch || {},
      evidenceList: [
        {
          detector: detector,
          score: score,
          observed: observed,
          expected: expected,
          context: context
        }
      ],
      scoreBefore: Math.max(0, score - 10),
      scoreAfter: score,
      stateBefore: "CLEAN",
      stateAfter: priority,
      categoryScores: {}
    });

    // Inyectar el nombre del jugador para que Python resuelva el XUID y genere el HMAC
    packet.subject.internalSubjectId = player.name;

    this.outbox.enqueue(packet, priority);

    
    // Alerta in-game mejorada a staff con sonido y actionbar (Fase 1)
    if (score >= 80 || score >= Config.violations.alertThreshold) {
      this.sendEnhancedAlertToStaff(player, detector, score, action);
    }
  }

  static sendEnhancedAlertToStaff(suspectPlayer, detector, score, action) {
    const chatMsg = `§4§l[ANTI-CHEAT ALERTA] §c${suspectPlayer.name} §eha alcanzado §c${score}% §ede sospecha en §f${detector} §e[${action.toUpperCase()}]. Escribe §f/s:congelar ${suspectPlayer.name} §epara inspeccionar.`;
    const actionBarMsg = `§4§l[ALERTA] §c${suspectPlayer.name} §e- ${detector} (${score}%)`;

    for (const staff of world.getAllPlayers()) {
      const isStaff = staff.isOp === true ||
        (typeof staff.isOp === "function" && staff.isOp()) ||
        staff.hasTag("op") || staff.hasTag("admin") ||
        staff.hasTag("fcx.admin") || staff.hasTag("fcx.mod") || staff.hasTag("staff");

      if (isStaff) {
        staff.sendMessage(chatMsg);
        try { staff.onScreenDisplay?.setActionBar(actionBarMsg); } catch (e) {}
        try { staff.playSound("note.pling", { pitch: 1.8, volume: 1.0 }); } catch (e) {}
      }
    }
  }

  static sendAlertToOps(message) {
    const formatted = `§c§l[Server Integrity]§r ${message}`;
    for (const player of world.getAllPlayers()) {
      const isOp = player.isOp === true || (typeof player.isOp === "function" && player.isOp()) || player.hasTag("op") || player.hasTag("admin");
      if (isOp) {
        player.sendMessage(formatted);
      }
    }
  }

  static clearPlayer(playerName) {
    const prefix = `${playerName}:`;
    for (const key of this.lastEmittedViolations.keys()) {
      if (key.startsWith(prefix)) this.lastEmittedViolations.delete(key);
    }
  }
}
