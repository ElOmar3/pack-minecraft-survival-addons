import { ErrorReporter } from "./ErrorReporter.js";
import { Config } from "./Config.js";
import { Logger } from "./Logger.js";
import { system } from "@minecraft/server";

export class ViolationManager {
  static violations = new Map();
  static recentDetections = new Map();
  static persistedHistoryLoaded = false;
  static HISTORY_DB_KEY = "anticheat_history_db";
  static historyDirty = false;
  static historyFlushRunId = undefined;

  static ensureHistoryLoaded() {
    if (this.persistedHistoryLoaded) return;
    this.persistedHistoryLoaded = true;
    // El historial es evidencia, no autoridad de juego: se conserva fuera del
    // mundo mediante el relay y no debe reescribir LevelDB durante combate.
  }

  static persistHistory() {
    try {
      const db = {};
      for (const [key, entries] of this.recentDetections.entries()) {
        if (!key.startsWith("xuid:")) continue;
        db[key.slice(5)] = entries.slice(-20);
      }
      console.warn(`[AC_HISTORY_EXTERNAL_V1]${JSON.stringify(db)}`);
      this.historyDirty = false;
    } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "ViolationManager.js", operation: "try-catch", category: "runtime" });}
  }

  static scheduleHistoryPersist() {
    this.historyDirty = true;
    if (this.historyFlushRunId !== undefined) return;
    this.historyFlushRunId = system.runTimeout(() => {
      this.historyFlushRunId = undefined;
      if (this.historyDirty) this.persistHistory();
    }, 100);
  }

  static addViolation(player, detector, value, expected, weight = 10, context = {}) {
    this.ensureHistoryLoaded();
    const name = player.name;
    const xuid = String(player.xuid || "").trim();
    const current = this.violations.get(name) || { score: 0, lastUpdate: Date.now() };
    
    // Aplicar decaimiento de puntos acumulados basado en el tiempo
    const timeDelta = (Date.now() - current.lastUpdate) / 1000;
    const decay = timeDelta * Config.violations.decayRate * 20; // decay por segundo de inactividad de flags
    let newScore = Math.max(0, current.score - decay) + weight;
    newScore = Math.min(Config.violations.maxViolationScore, newScore);

    this.violations.set(name, {
      score: newScore,
      lastUpdate: Date.now()
    });

    let action = "none";
    if (newScore >= Config.violations.punishThreshold) {
      action = "punish";
    } else if (newScore >= Config.violations.rollbackThreshold) {
      action = "rollback";
    } else if (newScore >= Config.violations.alertThreshold) {
      action = "warn";
    }

    const recent = this.recentDetections.get(name) || [];
    recent.push({
      timestamp: Date.now(),
      detector,
      score: newScore,
      observed: value,
      expected,
      action,
      context
    });
    if (recent.length > 20) {
      recent.shift();
    }
    this.recentDetections.set(name, recent);
    if (xuid) {
      const xuidKey = `xuid:${xuid}`;
      const persisted = this.recentDetections.get(xuidKey) || [];
      persisted.push({
        timestamp: Date.now(),
        detector,
        score: newScore,
        observed: value,
        expected,
        action,
        context,
        player: player.name
      });
      if (persisted.length > 20) {
        persisted.shift();
      }
      this.recentDetections.set(xuidKey, persisted);
      this.scheduleHistoryPersist();
    }

    Logger.logViolation(player, detector, newScore, value, expected, action, context);
    return action;
  }

  static getScore(playerName) {
    const current = this.violations.get(playerName);
    if (!current) return 0;
    
    const timeDelta = (Date.now() - current.lastUpdate) / 1000;
    const decay = timeDelta * Config.violations.decayRate * 20;
    return Math.max(0, current.score - decay);
  }

  static clearPlayer(playerName) {
    this.violations.delete(playerName);
    this.recentDetections.delete(playerName);
    Logger.clearPlayer(playerName);
  }

  static getRecentDetections(playerName, xuid = "") {
    this.ensureHistoryLoaded();
    const live = this.recentDetections.get(playerName) || [];
    const persisted = xuid ? (this.recentDetections.get(`xuid:${xuid}`) || []) : [];
    return live.length >= persisted.length ? live : persisted;
  }
}
