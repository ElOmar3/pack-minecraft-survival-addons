import { Capability, MUTATING_CAPABILITIES } from "../authorization/Capability.js";
import { isKnownRole, Role } from "../authorization/RoleDefinition.js";

const LEGACY_MODES = new Set(["ENABLED", "SHADOWED", "DISABLED"]);
const KNOWN_CAPABILITIES = new Set(Object.values(Capability));
const REQUIRED_ROLES = Object.values(Role);
const FORBIDDEN_BY_ROLE = Object.freeze({
  [Role.SECURITY_ADMIN]: new Set([Capability.ADMIN_ROLES_ASSIGN, Capability.ADMIN_ROLES_REVOKE, Capability.LOCKDOWN_MANAGE]),
  [Role.MODERATOR]: new Set([Capability.PLAYER_PERMABAN, Capability.ADMIN_ROLES_ASSIGN, Capability.ADMIN_ROLES_REVOKE, Capability.LOCKDOWN_MANAGE, Capability.AUDIT_VIEW]),
  [Role.SHERIFF]: new Set(Object.values(Capability).filter((capability) => capability !== Capability.PLAYER_TEMPBAN && capability !== Capability.PLAYER_FREEZE)),
  [Role.SUPPORT]: new Set([...MUTATING_CAPABILITIES, Capability.ADMIN_ROLES_ASSIGN, Capability.ADMIN_ROLES_REVOKE, Capability.LOCKDOWN_MANAGE, Capability.AUDIT_VIEW]),
  [Role.ESTELAR]: new Set([...MUTATING_CAPABILITIES, Capability.ADMIN_ROLES_ASSIGN, Capability.ADMIN_ROLES_REVOKE, Capability.LOCKDOWN_MANAGE, Capability.AUDIT_VIEW]),
  [Role.AUDITOR]: new Set([...MUTATING_CAPABILITIES, Capability.ADMIN_ROLES_ASSIGN, Capability.ADMIN_ROLES_REVOKE, Capability.LOCKDOWN_MANAGE])
});

export function validateAdminConfig(config) {
  const errors = [];
  if (!config || typeof config !== "object") return { ok: false, errors: ["config_missing"] };
  for (const key of ["enabled","auditOnlyMode","enforcementEnabled","commandAuthorityEnabled","adminSystemLocked","allowPermanentBans","requireAuditPersistence","discordAlertsEnabled","anomalyDetectionEnabled","automaticAdminSuspensionEnabled","auditorReadDuringLockdown"]) {
    if (typeof config[key] !== "boolean") errors.push(`${key}_must_be_boolean`);
  }
  if (!LEGACY_MODES.has(config.legacyModerationMode)) errors.push("invalid_legacy_moderation_mode");
  if (!Array.isArray(config.administrators) || config.administrators.length !== 0) errors.push("initial_administrators_must_be_empty");
  if (typeof config.ownerConfigured !== "boolean") errors.push("ownerConfigured_must_be_boolean");
  if (!config.roleDefinitions || typeof config.roleDefinitions !== "object") errors.push("role_definitions_missing");
  else {
    for (const role of REQUIRED_ROLES) if (!Array.isArray(config.roleDefinitions[role])) errors.push(`role_definition_missing:${role}`);
    for (const [role, capabilities] of Object.entries(config.roleDefinitions)) {
      if (!isKnownRole(role)) errors.push(`unknown_role:${role}`);
      if (!Array.isArray(capabilities) || capabilities.some((value) => typeof value !== "string" || value.includes("*") || !KNOWN_CAPABILITIES.has(value))) {
        errors.push(`invalid_capabilities:${role}`);
        continue;
      }
      const forbidden = FORBIDDEN_BY_ROLE[role];
      if (forbidden && capabilities.some((capability) => forbidden.has(capability))) errors.push(`forbidden_role_capability:${role}`);
    }
    const auditor = new Set(config.roleDefinitions[Role.AUDITOR] ?? []);
    if ([...auditor].some((capability) => MUTATING_CAPABILITIES.has(capability))) errors.push("auditor_has_mutation_capability");
  }
  const journal = config.journal;
  if (!journal || !Number.isInteger(journal.maxSerializedSegmentBytes) || journal.maxSerializedSegmentBytes > 24 * 1024 || journal.maxSerializedSegmentBytes < 4096) errors.push("invalid_journal_segment_limit");
  if (!Number.isInteger(journal?.maxSegments) || journal.maxSegments < 2 || journal.maxSegments > 256) errors.push("invalid_journal_retention");
  if (!Number.isInteger(journal?.maxEventBytes) || journal.maxEventBytes < 512 || journal.maxEventBytes >= journal?.maxSerializedSegmentBytes) errors.push("invalid_journal_event_limit");
  for (const [action, limit] of Object.entries(config.rateLimits ?? {})) {
    if (!limit || !Number.isSafeInteger(limit.limit) || limit.limit < 1 || !Number.isSafeInteger(limit.critical) || limit.critical <= limit.limit || !Number.isSafeInteger(limit.windowMs) || limit.windowMs < 1000) errors.push(`invalid_rate_limit:${action}`);
  }
  for (const action of ["warn","mute","kick","tempban","permaban","unban","freeze","teleport","roleChange"]) if (!config.rateLimits?.[action]) errors.push(`rate_limit_missing:${action}`);
  if (config.commandAuthorityEnabled && config.legacyModerationMode === "ENABLED") errors.push("dual_moderation_authority_denied");
  if (!config.adminSystemLocked && !config.ownerConfigured) errors.push("unconfigured_owner_requires_lockdown");
  return { ok: errors.length === 0, errors };
}
