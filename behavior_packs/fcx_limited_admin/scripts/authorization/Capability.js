export const Capability = Object.freeze({
  ADMIN_PANEL_VIEW: "admin.panel.view",
  PLAYER_WARN: "player.warn",
  PLAYER_MUTE: "player.mute",
  PLAYER_KICK: "player.kick",
  PLAYER_TEMPBAN: "player.tempban",
  PLAYER_PERMABAN: "player.permaban",
  PLAYER_UNBAN: "player.unban",
  PLAYER_FREEZE: "player.freeze",
  PLAYER_INSPECT: "player.inspect",
  PLAYER_SPECTATE: "player.spectate",
  PLAYER_TELEPORT_SELF: "player.teleport.self_to_player",
  REPORTS_VIEW: "reports.view",
  REPORTS_RESOLVE: "reports.resolve",
  AUDIT_VIEW: "audit.view",
  ADMIN_ROLES_VIEW: "admin.roles.view",
  ADMIN_ROLES_ASSIGN: "admin.roles.assign",
  ADMIN_ROLES_REVOKE: "admin.roles.revoke",
  LOCKDOWN_MANAGE: "admin.lockdown.manage"
});

export const MUTATING_CAPABILITIES = Object.freeze(new Set([
  Capability.PLAYER_MUTE, Capability.PLAYER_KICK, Capability.PLAYER_TEMPBAN,
  Capability.PLAYER_PERMABAN, Capability.PLAYER_UNBAN, Capability.PLAYER_FREEZE,
  Capability.PLAYER_SPECTATE, Capability.PLAYER_TELEPORT_SELF,
  Capability.REPORTS_RESOLVE, Capability.ADMIN_ROLES_ASSIGN,
  Capability.ADMIN_ROLES_REVOKE, Capability.LOCKDOWN_MANAGE
]));
