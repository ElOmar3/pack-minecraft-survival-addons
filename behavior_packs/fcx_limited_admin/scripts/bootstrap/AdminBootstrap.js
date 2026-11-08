import { world, system } from "@minecraft/server";
import { ADMIN_CONFIG } from "../config/AdminConfig.js";
import { validateAdminConfig } from "../config/AdminConfigValidator.js";
import { OWNER_PROVISIONING } from "../config/OwnerProvisioning.js";
import { DynamicPropertyStore } from "../persistence/DynamicPropertyStore.js";
import { AdminRegistry } from "../roles/AdminRegistry.js";
import { AdminIdentityResolver } from "../identity/AdminIdentityResolver.js";
import { TargetProtectionPolicy } from "../authorization/TargetProtectionPolicy.js";
import { AuthorizationService } from "../authorization/AuthorizationService.js";
import { SegmentedAuditJournal } from "../audit/SegmentedAuditJournal.js";
import { AdminAuditService } from "../audit/AdminAuditService.js";
import { AdminRateLimiter } from "../security/AdminRateLimiter.js";
import { AdminAnomalyDetector } from "../security/AdminAnomalyDetector.js";
import { AdminSessionInvalidator } from "../security/AdminSessionInvalidator.js";
import { AdminActionExecutor } from "../moderation/AdminActionExecutor.js";
import { ModerationService } from "../moderation/ModerationService.js";
import { AdminQueryService } from "../moderation/AdminQueryService.js";
import { ObservationService } from "../moderation/ObservationService.js";
import { RoleService } from "../roles/RoleService.js";
import { AdminLockdownService } from "../security/AdminLockdownService.js";
import { OwnerEnrollmentService } from "./OwnerEnrollmentService.js";
import { AdminPanelController } from "../ui/AdminPanelController.js";
import { AdminCommandRouter } from "../commands/AdminCommandRouter.js";
import { AdminRoleBadgeService } from "../presentation/AdminRoleBadgeService.js";

function provisioningValid(provisioning, ownerConfigured) {
  const keyValid = /^[0-9a-f]{64}$/.test(String(provisioning?.tokenDerivationKeyHex ?? ""));
  if (!keyValid) return false;
  if (ownerConfigured) return true;
  return provisioning?.enabled === true && /^[0-9a-f]{64}$/.test(String(provisioning?.nonceHash ?? "")) && Number(provisioning.expiresAt) > Date.now();
}

export class AdminBootstrap {
  constructor() {
    this.configResult = validateAdminConfig(ADMIN_CONFIG);
    this.store = new DynamicPropertyStore(world);
    this.registry = new AdminRegistry(this.store, ADMIN_CONFIG);
    this.journal = new SegmentedAuditJournal(this.store, ADMIN_CONFIG.journal);
    this.identity = new AdminIdentityResolver(this.registry, OWNER_PROVISIONING);
    this.audit = new AdminAuditService(this.journal, ADMIN_CONFIG);
    this.authorization = new AuthorizationService(ADMIN_CONFIG, this.registry, new TargetProtectionPolicy());
    this.rateLimiter = new AdminRateLimiter(this.store, ADMIN_CONFIG, this.registry, this.audit);
    this.anomaly = new AdminAnomalyDetector(this.store, ADMIN_CONFIG, this.registry, this.audit);
    this.sessions = new AdminSessionInvalidator(this.registry, ADMIN_CONFIG.confirmationTtlMs);
    this.executor = new AdminActionExecutor(ADMIN_CONFIG, this.identity, this.authorization, this.audit, this.rateLimiter, this.anomaly);
    this.moderation = new ModerationService(world, system, ADMIN_CONFIG, this.identity, this.executor);
    this.query = new AdminQueryService(this.executor, this.journal, this.registry, this.moderation);
    this.observation = new ObservationService(ADMIN_CONFIG, this.identity, this.moderation, this.executor);
    this.badges = new AdminRoleBadgeService(world, system, this.identity, this.audit);
    this.roles = new RoleService(this.identity, this.registry, this.authorization, this.executor, this.sessions, this.badges);
    this.lockdown = new AdminLockdownService(this.registry, this.executor, this.sessions, this.audit);
    this.ownerEnrollment = new OwnerEnrollmentService(this.store, OWNER_PROVISIONING, this.registry, this.identity, this.audit);
    this.panel = new AdminPanelController(this.identity, this.authorization, this.executor, this.sessions, this.query, this.registry);
    this.router = new AdminCommandRouter(system, {
      identity: this.identity, moderation: this.moderation, query: this.query,
      observation: this.observation, roles: this.roles, lockdown: this.lockdown,
      ownerEnrollment: this.ownerEnrollment, panel: this.panel
    });
    this.ready = false;
  }

  registerCommands() {
    const startup = system.beforeEvents?.startup;
    if (!startup?.subscribe) {
      this.router.errors.push({ command: "*", error: "startup_event_unavailable" });
      return;
    }
    startup.subscribe((event) => this.router.registerAll(event, ADMIN_CONFIG));
  }

  initialize() {
    const journalResult = this.configResult.ok ? this.journal.initialize() : { ok: false, error: "config_invalid" };
    const registryResult = this.configResult.ok ? this.registry.load() : { ok: false, error: "config_invalid" };
    const ownerConfigured = registryResult.ok && this.registry.ownerConfigured();
    const identityProviderReady = registryResult.ok && provisioningValid(OWNER_PROVISIONING, ownerConfigured);
    const authorizationReady = registryResult.ok && this.configResult.ok;
    const auditReady = journalResult.ok;
    if (this.configResult.ok && registryResult.ok) {
      this.moderation.registerEnforcement();
      this.badges.register();
    }
    this.registerIdentityDiagnostics();
    this.ready = Boolean(this.configResult.ok && identityProviderReady && auditReady && authorizationReady && ownerConfigured && this.router.errors.length === 0);
    const status = {
      schemaVersion: 1,
      configValid: this.configResult.ok,
      identityProviderReady,
      auditReady,
      authorizationReady,
      ownerConfigured,
      commandAuthorityEnabled: ADMIN_CONFIG.commandAuthorityEnabled,
      legacyModerationMode: ADMIN_CONFIG.legacyModerationMode,
      adminSystemLocked: registryResult.ok ? this.registry.isLocked() : true,
      commandsRegistered: this.router.registered,
      commandErrors: this.router.errors.map((entry) => entry.command)
    };
    console.warn(`[FCX_ADMIN_READINESS] ${JSON.stringify(status)}`);
    if (this.ready) console.warn(`[FCX_ADMIN_READY] ${JSON.stringify(status)}`);
    else console.warn(`[FCX_ADMIN_LOCKDOWN] ${JSON.stringify({ reason: "bootstrap_not_ready", configErrors: this.configResult.errors ?? [], journalError: journalResult.error ?? "", registryError: registryResult.error ?? "" })}`);
    if (auditReady) this.auditSystemStartup(status);
    return status;
  }

  auditSystemStartup(status) {
    const actor = { principalId: "SYSTEM", playerNameSnapshot: "BDS", role: "SYSTEM" };
    const context = this.audit.createContext(actor, "admin.system.startup", "SYSTEM");
    const event = this.audit.buildEvent(context, actor, undefined, "admin.system.startup", status, "", status.configValid ? "ALLOWED" : "DENIED", this.ready ? "ready" : "lockdown", this.ready ? "SUCCESS" : "REJECTED", this.ready ? undefined : "BOOTSTRAP_NOT_READY");
    this.audit.persistIntent(context, event, `startup:${context.correlationId}`);
    this.audit.persistResult(event);
  }

  registerIdentityDiagnostics() {
    world.afterEvents.playerSpawn.subscribe((event) => {
      if (!event.initialSpawn) return;
      system.runTimeout(() => {
        const diagnostic = this.identity.diagnostic(event.player);
        console.warn(`[FCX_ADMIN_IDENTITY_DIAGNOSTIC] ${JSON.stringify(diagnostic)}`);
      }, 20);
    });
    world.afterEvents.playerLeave.subscribe((event) => this.identity.releaseEntity(event.playerId));
  }
}
