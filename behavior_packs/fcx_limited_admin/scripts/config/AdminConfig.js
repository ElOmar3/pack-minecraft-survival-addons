import { DEFAULT_ROLE_CAPABILITIES } from "../authorization/RoleDefinition.js";

export const ADMIN_CONFIG = Object.freeze({
  schemaVersion: 1,
  enabled: true,
  auditOnlyMode: false,
  enforcementEnabled: true,
  commandAuthorityEnabled: true,
  adminSystemLocked: true,
  allowPermanentBans: false,
  requireAuditPersistence: true,
  discordAlertsEnabled: true,
  anomalyDetectionEnabled: true,
  automaticAdminSuspensionEnabled: true,
  auditorReadDuringLockdown: true,
  legacyModerationMode: "SHADOWED",
  administrators: Object.freeze([]),
  ownerConfigured: false,
  roleDefinitions: DEFAULT_ROLE_CAPABILITIES,
  punishmentLimitsMs: Object.freeze({
    SECURITY_ADMIN: Object.freeze({ mute: 30 * 86_400_000, tempban: 30 * 86_400_000, freeze: 60 * 60_000 }),
    MODERATOR: Object.freeze({ mute: 24 * 60 * 60_000, tempban: 7 * 86_400_000, freeze: 30 * 60_000 }),
    SHERIFF: Object.freeze({ mute: 0, tempban: 3 * 86_400_000, freeze: 30 * 60_000 }),
    SUPPORT: Object.freeze({ mute: 0, tempban: 0, freeze: 0 }),
    ESTELAR: Object.freeze({ mute: 0, tempban: 0, freeze: 0 }),
    AUDITOR: Object.freeze({ mute: 0, tempban: 0, freeze: 0 }),
    OWNER: Object.freeze({ mute: 90 * 86_400_000, tempban: 90 * 86_400_000, freeze: 2 * 60 * 60_000 })
  }),
  rateLimits: Object.freeze({
    warn: Object.freeze({ limit: 10, windowMs: 10 * 60_000, critical: 20 }),
    mute: Object.freeze({ limit: 5, windowMs: 10 * 60_000, critical: 10 }),
    kick: Object.freeze({ limit: 5, windowMs: 10 * 60_000, critical: 10 }),
    tempban: Object.freeze({ limit: 3, windowMs: 60 * 60_000, critical: 6 }),
    permaban: Object.freeze({ limit: 5, windowMs: 60 * 60_000, critical: 10 }),
    unban: Object.freeze({ limit: 5, windowMs: 10 * 60_000, critical: 10 }),
    freeze: Object.freeze({ limit: 5, windowMs: 10 * 60_000, critical: 10 }),
    teleport: Object.freeze({ limit: 10, windowMs: 10 * 60_000, critical: 20 }),
    roleChange: Object.freeze({ limit: 2, windowMs: 60 * 60_000, critical: 4 })
  }),
  anomalyDetection: Object.freeze({
    denialLimit: 8,
    distinctTargetLimit: 8,
    windowMs: 10 * 60_000,
    suspensionMs: 30 * 60_000,
    activateGlobalLockdown: false
  }),
  journal: Object.freeze({
    maxSerializedSegmentBytes: 24 * 1024,
    maxSegments: 64,
    maxEventBytes: 6 * 1024,
    recentIdempotencyKeys: 256
  }),
  confirmationTtlMs: 30_000,
  maximumReasonLength: 240
});
