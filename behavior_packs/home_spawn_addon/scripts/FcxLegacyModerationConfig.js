// This value is changed only by the host-side FCX handoff tool while BDS is stopped.
// ENABLED: legacy moderation registers normally (test canary only).
// SHADOWED: FCX owns sanctions; legacy unban/unmute only redirect to /s:admin.
// DISABLED: no legacy moderation commands are registered.
export const LEGACY_MODERATION_MODE = "SHADOWED";
