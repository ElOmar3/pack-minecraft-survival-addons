import { Capability } from "../authorization/Capability.js";
import { AdminErrorCode } from "../shared/AdminErrors.js";
import { fail, ok } from "../shared/AdminResult.js";
import { parseDuration, sanitizeReason, sanitizeText } from "../shared/Validation.js";
import { sha256 } from "../shared/Crypto.js";

const MUTE_PROPERTY = "fcx_admin:mute_v1";
const BAN_PROPERTY = "fcx_admin:ban_v1";
const FREEZE_PROPERTY = "fcx_admin:freeze_v1";

function entityId(player) {
  try { return String(player?.id ?? ""); } catch { return ""; }
}

function playerName(player) {
  try { return String(player?.name ?? "Unknown"); } catch { return "Unknown"; }
}

function targetName(target) {
  if (target?.offline === true) return String(target.playerNameSnapshot ?? "Unknown");
  return playerName(target);
}

function writeVerified(player, key, value) {
  const serialized = JSON.stringify(value);
  globalThis.__sqlite_set_prop_v2__("fcx_limited_admin", player, key, serialized);
  if (String(globalThis.__sqlite_get_prop_v2__("fcx_limited_admin", player, key) ?? "") !== serialized) throw new Error(`dynamic_property_write_failed:${key}`);
}

function escapeCommandString(value) {
  return sanitizeText(value, 180).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export class ModerationService {
  constructor(worldRef, systemRef, config, identity, executor) {
    this.world = worldRef;
    this.system = systemRef;
    this.config = config;
    this.identity = identity;
    this.executor = executor;
    this.freezeTimers = new Map();
  }

  findPlayer(query, options = {}) {
    const requestedName = sanitizeText(query, 64);
    const normalized = requestedName.toLowerCase();
    if (!normalized) return fail(AdminErrorCode.PLAYER_NOT_FOUND);
    const players = this.world.getAllPlayers();
    const exact = players.filter((player) => playerName(player).toLowerCase() === normalized);
    if (exact.length === 1) return ok(exact[0]);
    const partial = players.filter((player) => playerName(player).toLowerCase().includes(normalized));
    if (partial.length === 0) return options.allowOffline ? ok(this.offlineTarget(requestedName)) : fail(AdminErrorCode.PLAYER_NOT_FOUND);
    if (partial.length > 1) return fail(AdminErrorCode.AMBIGUOUS_PLAYER);
    return ok(partial[0]);
  }

  offlineTarget(name) {
    const playerNameSnapshot = sanitizeText(name, 64);
    const normalized = playerNameSnapshot.toLowerCase();
    // Conserva la protección de cuentas de staff aunque estén desconectadas.
    const records = this.identity?.registry?.snapshot?.().administrators ?? [];
    const registered = records.find((record) => record?.status === "ACTIVE" && String(record?.nameSnapshot ?? "").toLowerCase() === normalized);
    return {
      offline: true,
      principalId: registered?.principalId ?? `OFFLINE_NAME:${sha256(normalized).slice(0, 32)}`,
      entityIdSnapshot: "",
      playerNameSnapshot,
      name: playerNameSnapshot,
      role: registered?.role
    };
  }

  describeTarget(player, actor = undefined) {
    if (player?.offline === true) return { ...player, player, name: targetName(player) };
    const admin = this.identity.resolve(player);
    if (admin.ok) return { ...admin.value, player, name: playerName(player) };
    const id = entityId(player);
    if (actor && id && id === actor.entityIdSnapshot) return { ...actor, player, name: playerName(player) };
    return {
      principalId: `SESSION_TARGET:${sha256(id).slice(0, 16)}`,
      entityIdSnapshot: id,
      playerNameSnapshot: playerName(player),
      name: playerName(player),
      role: undefined,
      player
    };
  }

  targetStillValid(target) {
    if (target?.offline === true) return () => true;
    return () => this.world.getAllPlayers().some((player) => entityId(player) === target.entityIdSnapshot && playerName(player) === target.playerNameSnapshot);
  }

  maximumDuration(actorRole, action) {
    return Number(this.config.punishmentLimitsMs[actorRole]?.[action] ?? 0);
  }

  warn(actorPlayer, targetPlayer, reason, source = "COMMAND") {
    const target = this.describeTarget(targetPlayer);
    const safeReason = sanitizeReason(reason, this.config.maximumReasonLength);
    return this.executor.execute({
      actorPlayer, target, capability: Capability.PLAYER_WARN, action: "player.warn", source,
      reason: safeReason, parameters: {}, rateAction: "warn", targetStillValid: this.targetStillValid(target),
      validate: () => safeReason ? ok(true) : fail(AdminErrorCode.ACTION_FAILED),
      mutate: (actor) => targetPlayer.sendMessage(`§6[FCX Moderación] §fAdvertencia de §e${actor.playerNameSnapshot}§f: ${safeReason}`)
    });
  }

  mute(actorPlayer, targetPlayer, durationText, reason, source = "COMMAND") {
    const actorResult = this.identity.resolve(actorPlayer);
    const max = actorResult.ok ? this.maximumDuration(actorResult.value.role, "mute") : 0;
    const duration = parseDuration(durationText, max);
    const target = this.describeTarget(targetPlayer, actorResult.ok ? actorResult.value : undefined);
    const safeReason = sanitizeReason(reason, this.config.maximumReasonLength);
    return this.executor.execute({
      actorPlayer, target, capability: Capability.PLAYER_MUTE, action: "player.mute", source,
      reason: safeReason, parameters: { duration: duration.ok ? duration.normalized : String(durationText) }, rateAction: "mute",
      targetStillValid: this.targetStillValid(target),
      validate: () => !duration.ok ? fail(duration.code) : !safeReason ? fail(AdminErrorCode.ACTION_FAILED) : ok(true),
      mutate: (actor) => {
        const record = { schemaVersion: 1, expiresAt: Date.now() + duration.durationMs, reason: safeReason, actorId: actor.principalId, createdAt: Date.now() };
        writeVerified(targetPlayer, MUTE_PROPERTY, record);
        targetPlayer.sendMessage(`§c[FCX Moderación] Silenciado hasta ${new Date(record.expiresAt).toLocaleString("es-ES")}. Motivo: ${safeReason}`);
        return record;
      }
    });
  }

  kick(actorPlayer, targetPlayer, reason, source = "COMMAND") {
    const target = this.describeTarget(targetPlayer);
    const safeReason = sanitizeReason(reason, this.config.maximumReasonLength);
    return this.executor.execute({
      actorPlayer, target, capability: Capability.PLAYER_KICK, action: "player.kick", source,
      reason: safeReason, parameters: {}, rateAction: "kick", targetStillValid: this.targetStillValid(target),
      validate: () => safeReason ? ok(true) : fail(AdminErrorCode.ACTION_FAILED),
      mutate: () => targetPlayer.dimension.runCommand(`kick "${escapeCommandString(playerName(targetPlayer))}" "${escapeCommandString(safeReason)}"`)
    });
  }

  ban(actorPlayer, targetPlayer, durationText, reason, permanent = false, source = "COMMAND") {
    const actorResult = this.identity.resolve(actorPlayer);
    const duration = permanent ? { ok: true, durationMs: 0, normalized: "permanent" } : parseDuration(durationText, actorResult.ok ? this.maximumDuration(actorResult.value.role, "tempban") : 0);
    const target = this.describeTarget(targetPlayer, actorResult.ok ? actorResult.value : undefined);
    const safeReason = sanitizeReason(reason, this.config.maximumReasonLength);
    return this.executor.execute({
      actorPlayer, target,
      capability: permanent ? Capability.PLAYER_PERMABAN : Capability.PLAYER_TEMPBAN,
      action: permanent ? "player.permaban" : "player.tempban", source,
      reason: safeReason, parameters: { duration: duration.ok ? duration.normalized : String(durationText) },
      rateAction: permanent ? "permaban" : "tempban", targetStillValid: this.targetStillValid(target),
      validate: () => !duration.ok ? fail(duration.code) : !safeReason ? fail(AdminErrorCode.ACTION_FAILED) : ok(true),
      mutate: (actor, ignoredTarget, audit) => {
        // The relay is the persistent enforcement authority for bans.  This is
        // intentionally a request only: no local FCX ban is reported as applied.
        console.warn(`[FCX_RELAY_BAN_REQUEST_V1] ${JSON.stringify({ schemaVersion: 1, correlationId: audit.correlationId, action: permanent ? "permaban" : "tempban", targetName: targetName(targetPlayer), duration: permanent ? "permanent" : duration.normalized, reason: safeReason, actorName: actor.playerNameSnapshot })}`);
        return { relayRequested: true, correlationId: audit.correlationId };
      }
    });
  }

  unban(actorPlayer, targetPlayer, source = "COMMAND") {
    const target = this.describeTarget(targetPlayer);
    return this.executor.execute({
      actorPlayer, target, capability: Capability.PLAYER_UNBAN, action: "player.unban", source,
      reason: "manual_unban", parameters: {}, rateAction: "unban", targetStillValid: this.targetStillValid(target),
      validate: () => ok(true),
      mutate: (actor, ignoredTarget, audit) => {
        // Igual que los baneos, el relay es el único dueño persistente del estado.
        console.warn(`[FCX_RELAY_BAN_REQUEST_V1] ${JSON.stringify({ schemaVersion: 1, correlationId: audit.correlationId, action: "unban", targetName: targetName(targetPlayer), duration: "none", reason: "manual_unban", actorName: actor.playerNameSnapshot })}`);
        return { relayRequested: true, correlationId: audit.correlationId };
      }
    });
  }

  freeze(actorPlayer, targetPlayer, durationText, reason, source = "COMMAND") {
    const actorResult = this.identity.resolve(actorPlayer);
    const duration = parseDuration(durationText, actorResult.ok ? this.maximumDuration(actorResult.value.role, "freeze") : 0);
    const target = this.describeTarget(targetPlayer, actorResult.ok ? actorResult.value : undefined);
    const safeReason = sanitizeReason(reason, this.config.maximumReasonLength);
    return this.executor.execute({
      actorPlayer, target, capability: Capability.PLAYER_FREEZE, action: "player.freeze", source,
      reason: safeReason, parameters: { duration: duration.ok ? duration.normalized : String(durationText) }, rateAction: "freeze",
      targetStillValid: this.targetStillValid(target),
      validate: () => !duration.ok ? fail(duration.code) : !safeReason ? fail(AdminErrorCode.ACTION_FAILED) : ok(true),
      mutate: (actor) => {
        const anchor = { x: targetPlayer.location.x, y: targetPlayer.location.y, z: targetPlayer.location.z };
        const record = { schemaVersion: 1, expiresAt: Date.now() + duration.durationMs, reason: safeReason, actorId: actor.principalId, anchor, dimension: targetPlayer.dimension.id };
        writeVerified(targetPlayer, FREEZE_PROPERTY, record);
        this.startFreeze(targetPlayer, record);
        targetPlayer.sendMessage(`§c[FCX Moderación] Congelado temporalmente. Motivo: ${safeReason}`);
        return record;
      }
    });
  }

  startFreeze(player, record) {
    const id = entityId(player);
    const existing = this.freezeTimers.get(id);
    if (existing !== undefined) this.system.clearRun(existing);

    try {
      player.addTag("fcx_frozen");
      player.addEffect("slowness", 12000, { amplifier: 255, showParticles: false });
      player.addEffect("weakness", 12000, { amplifier: 255, showParticles: false });
      player.onScreenDisplay?.setTitle("§c§l¡CONGELADO!");
      player.onScreenDisplay?.setSubtitle("§eInspección del staff - No te desconectes");
      player.sendMessage("§c§l[STAFF] ¡Has sido congelado para una revisión! No te desconectes o serás vetado permanentemente.");
    } catch {}

    const timer = this.system.runInterval(() => {
      try {
        if (!player.isValid || Date.now() >= record.expiresAt) {
          if (player.isValid) {
            globalThis.__sqlite_set_prop_v2__("fcx_limited_admin", player, FREEZE_PROPERTY, undefined);
            try {
              player.removeTag("fcx_frozen");
              player.runCommand("effect @s clear");
              player.sendMessage("§a§l[STAFF] §eHas sido descongelado. Gracias por tu cooperación.");
            } catch {}
          }
          this.system.clearRun(timer); this.freezeTimers.delete(id); return;
        }
        player.teleport(record.anchor, { dimension: player.dimension });
      } catch {
        this.system.clearRun(timer); this.freezeTimers.delete(id);
      }
    }, 2);
    this.freezeTimers.set(id, timer);
  }

  readRecord(player, key) {
    try { const raw = globalThis.__sqlite_get_prop_v2__("fcx_limited_admin", player, key); return raw ? JSON.parse(String(raw)) : null; } catch { return null; }
  }

  registerEnforcement() {
    // Bloquear interacciones y rotura de bloques mientras esté congelado
    const blockBreak = this.world.beforeEvents?.playerBreakBlock;
    if (blockBreak?.subscribe) {
      blockBreak.subscribe((event) => {
        const record = this.readRecord(event.player, FREEZE_PROPERTY);
        if (record && Number(record.expiresAt) > Date.now()) {
          event.cancel = true;
          this.system.run(() => {
            try { event.player.sendMessage("§c[FCX Moderación] No puedes romper bloques mientras estás congelado."); } catch {}
          });
        }
      });
    }

    const blockInteract = this.world.beforeEvents?.playerInteractWithBlock;
    if (blockInteract?.subscribe) {
      blockInteract.subscribe((event) => {
        const record = this.readRecord(event.player, FREEZE_PROPERTY);
        if (record && Number(record.expiresAt) > Date.now()) {
          event.cancel = true;
          this.system.run(() => {
            try { event.player.sendMessage("§c[FCX Moderación] No puedes interactuar con contenedores o bloques mientras estás congelado."); } catch {}
          });
        }
      });
    }

    const itemUse = this.world.beforeEvents?.itemUse;
    if (itemUse?.subscribe) {
      itemUse.subscribe((event) => {
        const record = this.readRecord(event.source, FREEZE_PROPERTY);
        if (record && Number(record.expiresAt) > Date.now()) {
          event.cancel = true;
        }
      });
    }

    const chat = this.world.beforeEvents?.chatSend;
    if (chat?.subscribe) chat.subscribe((event) => {
      const record = this.readRecord(event.sender, MUTE_PROPERTY);
      if (!record) return;
      if (Number(record.expiresAt) <= Date.now()) {
        globalThis.__sqlite_set_prop_v2__("fcx_limited_admin", event.sender, MUTE_PROPERTY, undefined);
        return;
      }
      event.cancel = true;
      this.system.run(() => {
        try {
          event.sender.sendMessage(`§c[FCX Moderación] Silenciado. Motivo: ${sanitizeText(record.reason, 180)}`);
        } catch {}
      });
    });
    this.world.afterEvents.playerSpawn.subscribe((event) => {
      if (!event.initialSpawn) return;
      this.system.runTimeout(() => {
        const player = event.player;
        const ban = this.readRecord(player, BAN_PROPERTY);
        if (ban && (Number(ban.expiresAt) === 0 || Number(ban.expiresAt) > Date.now())) {
          try { player.dimension.runCommand(`kick "${escapeCommandString(playerName(player))}" "${escapeCommandString(`FCX ban: ${ban.reason}`)}"`); } catch {}
          return;
        }
        if (ban) globalThis.__sqlite_set_prop_v2__("fcx_limited_admin", player, BAN_PROPERTY, undefined);
        const freeze = this.readRecord(player, FREEZE_PROPERTY);
        if (freeze && Number(freeze.expiresAt) > Date.now()) this.startFreeze(player, freeze);
        else if (freeze) globalThis.__sqlite_set_prop_v2__("fcx_limited_admin", player, FREEZE_PROPERTY, undefined);
      }, 20);
    });
    this.world.afterEvents.playerLeave.subscribe((event) => {
      for (const [id, timer] of this.freezeTimers) {
        if (id === String(event.playerId ?? "")) { this.system.clearRun(timer); this.freezeTimers.delete(id); }
      }
    });
  }
}
