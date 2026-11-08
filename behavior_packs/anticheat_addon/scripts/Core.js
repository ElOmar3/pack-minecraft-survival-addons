import { ErrorReporter } from "./ErrorReporter.js";
import { world, system, PlayerPermissionLevel } from "@minecraft/server";
import { Config } from "./Config.js";
import { PlayerStateManager } from "./PlayerStateManager.js";
import { ExemptionManager } from "./ExemptionManager.js";
import { ViolationManager } from "./ViolationManager.js";
import { MovementAnalyzer } from "./MovementAnalyzer.js";
import { CombatAnalyzer } from "./CombatAnalyzer.js";
import { InventoryAnalyzer } from "./InventoryAnalyzer.js";
import { PerformanceMonitor } from "./PerformanceMonitor.js";
import { TelemetryManager } from "./TelemetryManager.js";
import { CombatSuspicion } from "./CombatSuspicion.js";
import { Logger } from "./Logger.js";
const COMBAT_LOG_TEMP_BAN_MS = 10 * 60 * 1000;

function normalizePlayerName(name) {
  return String(name || "").trim().toLowerCase();
}

let bansMemoryCache = null;

function loadBans() {
  if (bansMemoryCache !== null) return bansMemoryCache;
  try {
    const persisted = globalThis.__sqlite_get_prop_v2__("anticheat_addon", "world", "bans_db");
    if (Array.isArray(persisted)) {
      bansMemoryCache = persisted;
      return bansMemoryCache;
    }
    if (typeof persisted === "string") {
      const parsed = JSON.parse(persisted);
      if (Array.isArray(parsed)) {
        bansMemoryCache = parsed;
        return bansMemoryCache;
      }
    }
  } catch (e) {}
  bansMemoryCache = [];
  return bansMemoryCache;
}

function saveBans(bans) {
  bansMemoryCache = bans;
  try {
    globalThis.__sqlite_set_prop_v2__("anticheat_addon", "world", "bans_db", bans);
  } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "Core.js", operation: "try-catch", category: "runtime" });
    console.warn("[Server Integrity] Error guardando bans: " + e);
  }
}

function applyCombatLogTempBan(playerName, reason) {
  const normalizedName = normalizePlayerName(playerName);
  if (!normalizedName) return;

  const bans = loadBans();
  const expiresAt = Date.now() + COMBAT_LOG_TEMP_BAN_MS;
  const existing = bans.find((entry) => normalizePlayerName(entry?.nameLower || entry?.name) === normalizedName);

  if (existing) {
    existing.name = existing.name || playerName;
    existing.nameLower = normalizedName;
    existing.reason = reason;
    existing.by = "Server Integrity";
    existing.createdAt = Date.now();
    existing.expiresAt = expiresAt;
    existing.date = new Date().toLocaleString("es-ES");
  } else {
    bans.push({
      name: playerName,
      nameLower: normalizedName,
      xuid: "",
      reason,
      by: "Server Integrity",
      createdAt: Date.now(),
      expiresAt,
      date: new Date().toLocaleString("es-ES"),
    });
  }

  saveBans(bans);
}

function isPlayerOp(player) {
  try {
    if (player?.playerPermissionLevel === PlayerPermissionLevel.Operator) return true;
  } catch (e) {}
  try {
    return !!(player && (
      player.isOp === true ||
      (typeof player.isOp === "function" && player.isOp()) ||
      player.hasTag?.("op") ||
      player.hasTag?.("admin")
    ));
  } catch (e) {
    return false;
  }
}

export class Core {
  static init() {
    if (!Config.enabled) return;

    TelemetryManager.initialize({ schedule: false });

      // Bucle de movimiento. La cadencia se configura para mantener el coste
      // acotado en hosts pequeños sin desactivar las detecciones.
    system.runInterval(() => {
      if (system.currentTick % PerformanceMonitor.TICK_INTERVAL === 0) {
        PerformanceMonitor.updateTps();
      }
      PerformanceMonitor.startMeasure();
      const players = world.getAllPlayers();
      TelemetryManager.tick(players);
      if (players.length === 0) {
        return;
      }
      
      for (const player of players) {
        try {
          if (isPlayerOp(player)) continue;

          // Siempre actualizar estado del jugador, incluso con TPS bajo
          PlayerStateManager.updateState(player);

          // Detección de teletransporte basada en distancia (playerTeleport no existe en esta API)
          const prevLoc = PlayerStateManager.getPreviousLoc(player.name);
          if (prevLoc) {
            const dx = player.location.x - prevLoc.x;
            const dz = player.location.z - prevLoc.z;
            const dy = player.location.y - prevLoc.y;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (dist > 10) {
              ExemptionManager.addExemption(player.name, "teleport", 2000);
            }
          }

          // Si el rendimiento del servidor está muy degradado, saltear chequeos pesados
          if (PerformanceMonitor.shouldSkipSecondaryChecks()) {
            continue;
          }

          MovementAnalyzer.analyze(player);
        } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "Core.js", operation: "try-catch", category: "runtime" });}
      }
      // Vaciar la telemetría en lotes, no en cada tick del servidor.
      if (system.currentTick % Config.performance.evidenceFlushIntervalTicks === 0) {
        try {
          Logger.sink.tryFlush(Logger.outbox);
        } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "Core.js", operation: "try-catch", category: "runtime" });}
      }
    }, Config.performance.movementCheckIntervalTicks);

    // Bucle de Inventarios (Cada 5 segundos)
    system.runInterval(() => {
      const players = world.getAllPlayers();
      if (players.length === 0) {
        return;
      }
      for (const player of players) {
        try {
          if (isPlayerOp(player)) continue;
          InventoryAnalyzer.analyzeInventory(player);
        } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "Core.js", operation: "try-catch", category: "runtime" });}
      }
    }, Config.inventory.checkInterval);

    // Limpieza de datos al desconectarse un jugador (previene memory leaks)
    try {
      world.afterEvents.playerLeave.subscribe((event) => {
        const name = event.playerName;
        // Anti-Combat Log: Castigar si se desconecta estando marcado en combate
        if (CombatAnalyzer.isInCombat(name)) {
          applyCombatLogTempBan(name, "Combat Log detectado por Server Integrity. Ban temporal de 10 minutos.");
          world.sendMessage(`§c§l[Server Integrity]§r §e${name} §cfue baneado por 10 minutos por desconectarse en combate.`);
        }

        PlayerStateManager.clearPlayer(name);
        ExemptionManager.clearPlayer(name);
        ViolationManager.clearPlayer(name);
        CombatAnalyzer.clearPlayer(name);
        InventoryAnalyzer.clearPlayer(name);
      });
    } catch (err) { ErrorReporter.report(err, { addonId: "anticheat_addon", moduleId: "Core.js", operation: "try-catch", category: "runtime" });
      console.warn("Error al registrar playerLeave: " + err);
    }
  }
}
