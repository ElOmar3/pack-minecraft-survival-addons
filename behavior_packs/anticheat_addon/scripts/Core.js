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
import { playerKey, rememberPlayer, sessionForPlayerId, keyForPlayerName, forgetPlayer } from "./Identity.js";
const COMBAT_LOG_TEMP_BAN_MS = 10 * 60 * 1000;
const BAN_SWEEP_INTERVAL_TICKS = 100;

function normalizePlayerName(name) {
  return String(name || "").trim().toLowerCase();
}

// Lectura fresca y tolerante: el demonio rehidrata objetos ya parseados y los
// datos legacy son strings JSON. Sin caché permanente para no ocultar bans
// escritos por otros addons o por el relay durante la sesión.
function loadBans() {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("anticheat_addon", "world", "bans_db");
    const bans = globalThis.__sqlite_read_json_v3__(raw, []);
    if (!Array.isArray(bans)) return [];
    const now = Date.now();
    return bans.filter((entry) => {
      const expiresAt = Number(entry?.expiresAt || 0);
      return expiresAt <= 0 || expiresAt > now;
    });
  } catch (e) {
    return [];
  }
}

function saveBans(bans) {
  try {
    globalThis.__sqlite_set_prop_v2__("anticheat_addon", "world", "bans_db", bans);
  } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "Core.js", operation: "try-catch", category: "runtime" });
    console.warn("[Server Integrity] Error guardando bans: " + e);
  }
}

function applyCombatLogTempBan(playerName, reason, playerXuid = "") {
  const normalizedName = normalizePlayerName(playerName);
  const normalizedXuid = String(playerXuid || "").trim();
  if (!normalizedName && !normalizedXuid) return;

  const bans = loadBans();
  const expiresAt = Date.now() + COMBAT_LOG_TEMP_BAN_MS;
  const existing = bans.find((entry) => {
    const entryXuid = String(entry?.xuid || "").trim();
    if (normalizedXuid && entryXuid) return entryXuid === normalizedXuid;
    return normalizePlayerName(entry?.nameLower || entry?.name) === normalizedName;
  });

  if (existing) {
    existing.name = existing.name || playerName;
    existing.nameLower = normalizedName;
    if (normalizedXuid) existing.xuid = normalizedXuid;
    existing.reason = reason;
    existing.by = "Server Integrity";
    existing.createdAt = Date.now();
    existing.expiresAt = expiresAt;
    existing.date = new Date().toLocaleString("es-ES");
  } else {
    bans.push({
      name: playerName,
      nameLower: normalizedName,
      xuid: normalizedXuid,
      reason,
      by: "Server Integrity",
      createdAt: Date.now(),
      expiresAt,
      date: new Date().toLocaleString("es-ES"),
    });
  }

  saveBans(bans);
}

function findActiveBanForPlayer(player) {
  if (!player) return undefined;
  const xuid = String(player.xuid || "").trim();
  const nameLower = normalizePlayerName(player.name);
  return loadBans().find((entry) => {
    const entryXuid = String(entry?.xuid || "").trim();
    if (xuid && entryXuid) return entryXuid === xuid;
    return normalizePlayerName(entry?.nameLower || entry?.name) === nameLower;
  });
}

function escapeKickArg(value) {
  return String(value || "").replace(/["\\]/g, "").replace(/[\r\n]+/g, " ");
}

function kickBannedPlayer(player, banEntry) {
  if (!player || !banEntry) return false;
  const expiresAt = Number(banEntry.expiresAt || 0);
  const temporaryLabel = expiresAt > Date.now()
    ? `temporalmente hasta ${new Date(expiresAt).toLocaleString("es-ES")}`
    : "permanentemente";
  const escapedName = escapeKickArg(player.name);
  const escapedReason = escapeKickArg(banEntry.reason || "Baneado por Server Integrity.");
  try {
    player.dimension.runCommand(`kick "${escapedName}" §cHas sido baneado ${temporaryLabel} del servidor. §eMotivo: ${escapedReason}`);
    return true;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "Core.js", operation: "kickBannedPlayer", category: "runtime" });
    return false;
  }
}

function enforceBans() {
  for (const player of world.getAllPlayers()) {
    try {
      if (!player.isValid) continue;
      const banEntry = findActiveBanForPlayer(player);
      if (banEntry) kickBannedPlayer(player, banEntry);
    } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "Core.js", operation: "enforceBans", category: "runtime" });}
  }
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

          const key = rememberPlayer(player);

          // Siempre actualizar estado del jugador, incluso con TPS bajo
          PlayerStateManager.updateState(player);

          // Detección de teletransporte basada en distancia (playerTeleport no existe en esta API)
          const prevLoc = PlayerStateManager.getPreviousLoc(key);
          if (prevLoc) {
            const dx = player.location.x - prevLoc.x;
            const dz = player.location.z - prevLoc.z;
            const dy = player.location.y - prevLoc.y;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (dist > 10) {
              ExemptionManager.addExemption(key, "teleport", 2000);
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

    // Enforcement de bans_db: Bedrock no tiene ban nativo, se expulsa al entrar
    // y un barrido periódico cubre bans aplicados con el jugador ya conectado.
    try {
      world.afterEvents.playerSpawn.subscribe((event) => {
        try {
          const player = event.player;
          if (!player || !player.isValid) return;
          rememberPlayer(player);
          const banEntry = findActiveBanForPlayer(player);
          if (!banEntry) return;
          system.run(() => {
            if (player.isValid) kickBannedPlayer(player, banEntry);
          });
        } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "Core.js", operation: "banSpawnEnforcement", category: "runtime" });}
      });
      system.runInterval(enforceBans, BAN_SWEEP_INTERVAL_TICKS);
    } catch (err) { ErrorReporter.report(err, { addonId: "anticheat_addon", moduleId: "Core.js", operation: "banEnforcementSetup", category: "runtime" });}

    // Limpieza de datos al desconectarse un jugador (previene memory leaks)
    try {
      world.afterEvents.playerLeave.subscribe((event) => {
        const name = event.playerName;
        const session = sessionForPlayerId(event.playerId);
        const key = session?.key || keyForPlayerName(name) || ("n:" + normalizePlayerName(name));
        const xuid = session?.xuid || (key.startsWith("x:") ? key.slice(2) : "");
        // Anti-Combat Log: evaluar ANTES de limpiar el estado; si se desconecta
        // estando marcado en combate, se aplica el ban temporal.
        if (CombatAnalyzer.isInCombat(key)) {
          applyCombatLogTempBan(name, "Combat Log detectado por Server Integrity. Ban temporal de 10 minutos.", xuid);
          world.sendMessage(`§c§l[Server Integrity]§r §e${name} §cfue baneado por 10 minutos por desconectarse en combate.`);
        }

        PlayerStateManager.clearPlayer(key);
        ExemptionManager.clearPlayer(key);
        ViolationManager.clearPlayer(key);
        CombatAnalyzer.clearPlayer(key);
        InventoryAnalyzer.clearPlayer(key);
        forgetPlayer(event.playerId, name);
      });
    } catch (err) { ErrorReporter.report(err, { addonId: "anticheat_addon", moduleId: "Core.js", operation: "try-catch", category: "runtime" });
      console.warn("Error al registrar playerLeave: " + err);
    }
  }
}
