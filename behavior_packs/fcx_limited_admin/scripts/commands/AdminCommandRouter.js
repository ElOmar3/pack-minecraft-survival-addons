import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus } from "@minecraft/server";
import { Capability } from "../authorization/Capability.js";
import { AdminErrorCode } from "../shared/AdminErrors.js";
import { fail, ok } from "../shared/AdminResult.js";
import { parseDuration, sanitizeReason } from "../shared/Validation.js";

const NS = "s";
export const FCX_COMMAND_NAMES = Object.freeze([
  "s:admin", "s:warn", "s:mute", "s:kick", "s:tempban", "s:ban", "s:desban",
  "s:freeze", "s:reports", "s:audit", "s:roles", "s:lockdown"
]);

function success(message) { return { status: CustomCommandStatus.Success, message }; }
function failure(message) { return { status: CustomCommandStatus.Failure, message }; }
const stringParam = (name) => ({ name, type: CustomCommandParamType.String });

export class AdminCommandRouter {
  constructor(systemRef, services) {
    this.system = systemRef;
    this.services = services;
    this.registered = [];
    this.errors = [];
  }

  register(registry, definition, callback) {
    try {
      registry.registerCommand(definition, callback);
      this.registered.push(definition.name);
    } catch (error) {
      this.errors.push({ command: definition.name, error: String(error) });
      console.warn(`[FCX_ADMIN_COMMAND_COLLISION] ${JSON.stringify({ command: definition.name, error: String(error).slice(0, 160) })}`);
    }
  }

  source(origin) {
    const player = origin?.sourceEntity;
    return player ? { ok: true, player } : { ok: false };
  }

  target(query) { return this.services.moderation.findPlayer(query); }

  registerAll(event, config) {
    const registry = event?.customCommandRegistry;
    if (!registry || typeof registry.registerCommand !== "function") {
      this.errors.push({ command: "*", error: "custom_command_registry_unavailable" });
      return;
    }
    this.registerAdmin(registry);
    if (!config.commandAuthorityEnabled) return;
    this.registerModeration(registry);
    this.registerQueries(registry);
  }

  registerAdmin(registry) {
    this.register(registry, {
      name: `${NS}:admin`, description: "Panel FCX Limited Admin", permissionLevel: CommandPermissionLevel.Any,
      optionalParameters: [stringParam("action"), stringParam("arg1"), stringParam("arg2"), stringParam("arg3")]
    }, (origin, action, arg1, arg2, arg3) => {
      const source = this.source(origin); if (!source.ok) return failure("Solo para jugadores.");
      this.system.run(() => this.handleAdmin(source.player, String(action ?? "panel"), [arg1,arg2,arg3].map((value) => String(value ?? ""))));
      return success("Solicitud FCX recibida.");
    });
  }

  registerModeration(registry) {
    const definitions = [
      ["warn", Capability.PLAYER_WARN, false], ["mute", Capability.PLAYER_MUTE, true],
      ["kick", Capability.PLAYER_KICK, false], ["tempban", Capability.PLAYER_TEMPBAN, true],
      ["ban", Capability.PLAYER_PERMABAN, false], ["desban", Capability.PLAYER_UNBAN, false], ["freeze", Capability.PLAYER_FREEZE, true]
    ];
    for (const [name, capability, hasDuration] of definitions) {
      const mandatoryParameters = [stringParam("jugador")];
      if (hasDuration) mandatoryParameters.push(stringParam("duracion"));
      if (name !== "desban") mandatoryParameters.push(stringParam("motivo"));
      this.register(registry, { name: `${NS}:${name}`, description: `FCX ${name}`, permissionLevel: CommandPermissionLevel.Any, mandatoryParameters }, (origin, ...args) => {
        const source = this.source(origin); if (!source.ok) return failure("Solo para jugadores.");
        this.system.run(() => this.prepareModeration(source.player, name, capability, args.map(String), hasDuration));
        return success("Confirmación FCX preparada.");
      });
    }
  }

  registerQueries(registry) {
    for (const name of ["reports","audit"]) {
      this.register(registry, { name: `${NS}:${name}`, description: `FCX ${name}`, permissionLevel: CommandPermissionLevel.Any }, (origin) => {
        const source = this.source(origin); if (!source.ok) return failure("Solo para jugadores.");
        this.system.run(() => name === "reports" ? this.services.panel.showReports(source.player) : this.services.panel.showAudit(source.player));
        return success("Consulta FCX recibida.");
      });
    }
    this.register(registry, {
      name: `${NS}:roles`, description: "Gestión limitada de roles FCX", permissionLevel: CommandPermissionLevel.Any,
      optionalParameters: [stringParam("action"), stringParam("jugador"), stringParam("rol")]
    }, (origin, action, jugador, rol) => {
      const source = this.source(origin); if (!source.ok) return failure("Solo para jugadores.");
      this.system.run(() => this.handleRoles(source.player, String(action ?? "view"), String(jugador ?? ""), String(rol ?? "")));
      return success("Solicitud de roles recibida.");
    });
    this.register(registry, {
      name: `${NS}:lockdown`, description: "Lockdown FCX", permissionLevel: CommandPermissionLevel.Any,
      mandatoryParameters: [stringParam("estado")]
    }, (origin, estado) => {
      const source = this.source(origin); if (!source.ok) return failure("Solo para jugadores.");
      this.system.run(() => this.handleLockdown(source.player, String(estado)));
      return success("Solicitud de lockdown recibida.");
    });
  }

  handleAdmin(player, action, args) {
    const normalized = action.trim().toLowerCase();
    if (normalized === "enroll-owner") return this.services.panel.message(player, this.services.ownerEnrollment.enroll(player, args[0]), "OWNER registrado; lockdown permanece activo.");
    if (normalized === "panel" || normalized === "") return this.services.panel.open(player);
    if (normalized === "player" || normalized === "inspect") {
      const target = this.target(args[0]);
      if (!target.ok) return this.services.panel.message(player, target);
      const result = this.services.query.inspect(player, target.value);
      if (!result.ok) return this.services.panel.message(player, result);
      player.sendMessage(`§e[FCX Admin] ${result.value.name} §8${result.value.principalIdPartial} §7${result.value.role} ${result.value.dimension} ${result.value.location.x},${result.value.location.y},${result.value.location.z}`);
      return;
    }
    if (["teleport","spectate"].includes(normalized)) {
      const targetResult = this.target(args[0]); if (!targetResult.ok) return this.services.panel.message(player, targetResult);
      const target = this.services.moderation.describeTarget(targetResult.value);
      const reason = sanitizeReason(args.slice(1).join(" "));
      const capability = normalized === "teleport" ? Capability.PLAYER_TELEPORT_SELF : Capability.PLAYER_SPECTATE;
      const execute = () => normalized === "teleport" ? this.services.observation.teleportTo(player,targetResult.value,reason,"UI") : this.services.observation.spectate(player,targetResult.value,reason,"UI");
      return this.services.panel.confirm(player,target,{ capability, action:`player.${normalized}`,reason,parameters:{} },`${normalized} por moderación. Motivo: ${reason}`,execute);
    }
    if (normalized === "stopspectate") return this.services.panel.message(player, this.services.observation.stop(player));
    player.sendMessage("§c[FCX Admin] Subcomando desconocido.");
  }

  prepareModeration(player, action, capability, args, hasDuration) {
    const supportsOfflineTarget = action === "tempban" || action === "ban" || action === "desban";
    const targetResult = this.services.moderation.findPlayer(args[0], { allowOffline: supportsOfflineTarget });
    if (!targetResult.ok) return this.services.panel.message(player, targetResult);
    const targetPlayer = targetResult.value;
    const target = this.services.moderation.describeTarget(targetPlayer);
    const duration = hasDuration ? args[1] : "";
    const reason = sanitizeReason(hasDuration ? args.slice(2).join(" ") : args.slice(1).join(" "));
    const execute = () => {
      if (action === "warn") return this.services.moderation.warn(player,targetPlayer,reason,"UI");
      if (action === "mute") return this.services.moderation.mute(player,targetPlayer,duration,reason,"UI");
      if (action === "kick") return this.services.moderation.kick(player,targetPlayer,reason,"UI");
      if (action === "tempban") return this.services.moderation.ban(player,targetPlayer,duration,reason,false,"UI");
      if (action === "ban") return this.services.moderation.ban(player,targetPlayer,"",reason,true,"UI");
      if (action === "desban") return this.services.moderation.unban(player,targetPlayer,"UI");
      return this.services.moderation.freeze(player,targetPlayer,duration,reason,"UI");
    };
    const validate = (actor) => {
      if (action !== "desban" && !reason) return fail(AdminErrorCode.ACTION_FAILED);
      if (hasDuration) return parseDuration(duration, this.services.moderation.maximumDuration(actor.role, action === "tempban" ? "tempban" : action));
      return ok(true);
    };
    this.services.panel.confirm(player,target,{ capability,action:`player.${action}`,reason,parameters:{duration},validate },`${action}${duration ? ` ${duration}` : ""}. Motivo: ${reason}`,execute);
  }

  handleRoles(player, action, playerQuery, role) {
    const normalized = action.toLowerCase();
    if (normalized === "view") return this.services.panel.showRoles(player);
    const targetResult = this.target(playerQuery); if (!targetResult.ok) return this.services.panel.message(player,targetResult);
    const target = this.services.roles.targetDescriptor(targetResult.value);
    const assign = normalized === "assign";
    const capability = assign ? Capability.ADMIN_ROLES_ASSIGN : Capability.ADMIN_ROLES_REVOKE;
    const execute = () => assign ? this.services.roles.assign(player,targetResult.value,role,"UI") : this.services.roles.revoke(player,targetResult.value,"UI");
    this.services.panel.confirm(player,target,{ capability,action:assign?"admin.roles.assign":"admin.roles.revoke",reason:"role_change",parameters:{role} },assign?`Asignar rol ${role}`:"Revocar acceso inmediatamente",execute);
  }

  handleLockdown(player, state) {
    const normalized = state.toLowerCase();
    if (!new Set(["on","off"]).has(normalized)) return this.services.panel.message(player, fail(AdminErrorCode.ACTION_FAILED));
    const actor = this.services.identity.resolve(player);
    if (!actor.ok) return this.services.panel.message(player, actor);
    const virtualTarget = { principalId:"FCX_SYSTEM",entityIdSnapshot:"",playerNameSnapshot:"FCX Admin System" };
    this.services.panel.confirm(player,virtualTarget,{ capability:Capability.LOCKDOWN_MANAGE,action:`admin.lockdown.${normalized}`,reason:"emergency_control",parameters:{state:normalized} },`${normalized === "on" ? "ACTIVAR" : "DESACTIVAR"} lockdown`,() => this.services.lockdown.set(player,normalized === "on","UI"));
  }
}
