import { ActionFormData } from "@minecraft/server-ui";
import { Capability } from "../authorization/Capability.js";
import { maskIdentifier, sanitizeText } from "../shared/Validation.js";

export class AdminPanelController {
  constructor(identity, authorization, executor, sessions, query, registry) {
    this.identity = identity;
    this.authorization = authorization;
    this.executor = executor;
    this.sessions = sessions;
    this.query = query;
    this.registry = registry;
  }

  message(player, result, success = "Acción completada.") {
    try {
      if (result?.ok) player.sendMessage(`§a[FCX Admin] ${success}${result.correlationId ? ` §8(${result.correlationId.slice(0, 8)})` : ""}`);
      else player.sendMessage(`§c[FCX Admin] Solicitud rechazada. Código: §e${sanitizeText(result?.code ?? "ACTION_FAILED", 64)}`);
    } catch {}
  }

  async open(player) {
    const result = this.query.panel(player, "UI");
    if (!result.ok) { this.message(player, result); return; }
    const actorResult = this.identity.resolve(player);
    if (!actorResult.ok) { this.message(player, actorResult); return; }
    const actor = actorResult.value;
    const capabilities = this.authorization.capabilitiesFor(actor.role);
    const entries = [];
    const form = new ActionFormData()
      .title("FCX Limited Admin")
      .body(`Rol: ${actor.role}\nLockdown: ${this.registry.isLocked() ? "ACTIVO" : "INACTIVO"}\nPrincipal: ${maskIdentifier(actor.principalId)}`);
    if (capabilities.has(Capability.REPORTS_VIEW)) { entries.push("reports"); form.button("Reportes"); }
    if (capabilities.has(Capability.AUDIT_VIEW)) { entries.push("audit"); form.button("Auditoría"); }
    if (capabilities.has(Capability.ADMIN_ROLES_VIEW)) { entries.push("roles"); form.button("Roles"); }
    if (capabilities.has(Capability.LOCKDOWN_MANAGE)) { entries.push("lockdown"); form.button("Estado de emergencia"); }
    entries.push("help"); form.button("Comandos permitidos");
    try {
      const response = await form.show(player);
      if (response.canceled || response.selection === undefined) return;
      const choice = entries[response.selection];
      if (choice === "reports") this.showReports(player);
      else if (choice === "audit") this.showAudit(player);
      else if (choice === "roles") this.showRoles(player);
      else if (choice === "lockdown") player.sendMessage("§7Usa §e/s:lockdown on§7 o §e/s:lockdown off§7. Se solicitará confirmación.");
      else player.sendMessage("§7Usa /s:warn, /s:mute, /s:kick, /s:tempban, /s:ban, /s:freeze o /s:admin player <nombre>. Cada mutación se revalida.");
    } catch (error) {
      player.sendMessage(`§c[FCX Admin] No se pudo abrir el panel: ${sanitizeText(error, 100)}`);
    }
  }

  showReports(player) {
    const result = this.query.reports(player, "UI");
    if (!result.ok) return this.message(player, result);
    player.sendMessage(result.value.length ? `§e[FCX Admin] ${result.value.length} reportes.` : "§7[FCX Admin] No hay reportes registrados.");
  }

  showAudit(player) {
    const result = this.query.audit(player, "UI");
    if (!result.ok) return this.message(player, result);
    player.sendMessage(`§e[FCX Admin] Últimos ${result.value.length} eventos:`);
    for (const event of result.value.slice(0, 10)) player.sendMessage(`§8#${event.sequence} §7${sanitizeText(event.action, 48)} §f${sanitizeText(event.result, 16)} §8${String(event.correlationId ?? "").slice(0, 8)}`);
  }

  showRoles(player) {
    const result = this.query.roles(player, "UI");
    if (!result.ok) return this.message(player, result);
    player.sendMessage(`§e[FCX Admin] Registros administrativos: ${result.value.length}`);
    for (const record of result.value.slice(0, 20)) player.sendMessage(`§7${record.nameSnapshot} §8${record.principalIdPartial} §f${record.role} §8${record.status}`);
  }

  async confirm(player, target, request, summary, execute) {
    const prepared = this.executor.prepare({ ...request, actorPlayer: player, target, source: "UI" });
    if (!prepared.ok) { this.message(player, prepared); return; }
    const confirmationId = this.sessions.create(prepared.value, request.action, target?.entityIdSnapshot ?? "", request.parameters ?? {});
    const targetLabel = target ? `${target.playerNameSnapshot}\nID: ${maskIdentifier(target.principalId)}\nEntidad: ${maskIdentifier(target.entityIdSnapshot)}` : "Sin objetivo de jugador";
    const form = new ActionFormData()
      .title("Confirmación FCX")
      .body(`${targetLabel}\n\n${sanitizeText(summary, 300)}\n\nLa autorización se verificará nuevamente.`)
      .button("CONFIRMAR")
      .button("Cancelar");
    try {
      const response = await form.show(player);
      if (response.canceled || response.selection !== 0) return;
      const current = this.identity.resolve(player);
      if (!current.ok) return this.message(player, current);
      const consumed = this.sessions.consume(confirmationId, current.value, target?.entityIdSnapshot ?? "");
      if (!consumed.ok) return this.message(player, consumed);
      this.message(player, execute(), "Acción aplicada.");
    } catch (error) {
      player.sendMessage(`§c[FCX Admin] Confirmación fallida: ${sanitizeText(error, 100)}`);
    }
  }
}
