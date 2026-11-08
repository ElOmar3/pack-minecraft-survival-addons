import { Role } from "../authorization/RoleDefinition.js";

export const ADMIN_VISUAL_ROLE_PROPERTY = "fcx_admin:visual_role_v1";
export const ADMIN_VISUAL_LEASE_PROPERTY = "fcx_admin:visual_role_lease_v1";
export const ADMIN_VISUAL_ROLE_TAG_PREFIX = "fcx_admin:badge_role:";

export const ADMIN_ROLE_BADGES = Object.freeze({
  [Role.OWNER]: "§4§l[OWNER] §r",
  [Role.SECURITY_ADMIN]: "§c§l[SECURITY ADMIN] §r",
  [Role.MODERATOR]: "§2§l[MODERATOR] §r",
  [Role.SHERIFF]: "§6§l[SHERIFF] §r",
  [Role.SUPPORT]: "§3§l[SUPPORT] §r",
  [Role.ESTELAR]: "§b§l[ESTELAR] §r",
  [Role.AUDITOR]: "§7§l[AUDITOR] §r"
});

export function adminRoleBadge(role) {
  return ADMIN_ROLE_BADGES[String(role ?? "")] ?? "";
}

function visualRoleTag(role) {
  return `${ADMIN_VISUAL_ROLE_TAG_PREFIX}${String(role ?? "")}`;
}

export class AdminRoleBadgeService {
  constructor(worldRef, systemRef, identity, audit) {
    this.world = worldRef;
    this.system = systemRef;
    this.identity = identity;
    this.audit = audit;
    this.intervalId = undefined;
    this.lastErrors = new Map();
  }

  expectedRole(player) {
    const resolved = this.identity.resolve(player);
    return resolved.ok && adminRoleBadge(resolved.value.role) ? resolved.value.role : "";
  }

  syncPlayer(player) {
    if (!player || !player.isValid) return { ok: false, error: "invalid_player_entity" };
    const expected = this.expectedRole(player);
    try {
      const current = String(globalThis.__sqlite_get_prop_v2__("fcx_limited_admin", player, ADMIN_VISUAL_ROLE_PROPERTY) ?? "");
      const expectedTag = expected ? visualRoleTag(expected) : "";
      const hasExpectedTag = expectedTag ? player.hasTag(expectedTag) : false;
      if (current === expected && hasExpectedTag === Boolean(expected)) return { ok: true, changed: false, role: expected };
      for (const role of Object.keys(ADMIN_ROLE_BADGES)) player.removeTag(visualRoleTag(role));
      if (expected) player.addTag(expectedTag);
      globalThis.__sqlite_set_prop_v2__("fcx_limited_admin", player, ADMIN_VISUAL_ROLE_PROPERTY, expected || undefined);
      const readBack = String(globalThis.__sqlite_get_prop_v2__("fcx_limited_admin", player, ADMIN_VISUAL_ROLE_PROPERTY) ?? "");
      if (readBack !== expected) throw new Error("admin_visual_role_write_verification_failed");
      if (expected && !player.hasTag(expectedTag)) throw new Error("admin_visual_role_tag_write_verification_failed");
      this.lastErrors.delete(String(player?.id ?? ""));
      return { ok: true, changed: true, role: expected };
    } catch (error) {
      const entityId = String(player?.id ?? "");
      const message = String(error).slice(0, 120);
      if (this.lastErrors.get(entityId) !== message) {
        this.lastErrors.set(entityId, message);
        this.audit?.alert("ADMIN_ROLE_BADGE_SYNC_FAILED", "WARNING", { entityIdHashOnly: entityId ? "present" : "missing", error: message });
      }
      return { ok: false, error: message };
    }
  }

  syncAll() {
    try {
      const lease = Date.now();
      globalThis.__sqlite_set_prop_v2__("fcx_limited_admin", "world", ADMIN_VISUAL_LEASE_PROPERTY, lease);
      if (Number(globalThis.__sqlite_get_prop_v2__("fcx_limited_admin", "world", ADMIN_VISUAL_LEASE_PROPERTY)) !== lease) throw new Error("admin_visual_role_lease_write_verification_failed");
      for (const player of this.world.getAllPlayers()) this.syncPlayer(player);
    } catch (error) {
      this.audit?.alert("ADMIN_ROLE_BADGE_SYNC_FAILED", "WARNING", { scope: "all_players", error: String(error).slice(0, 120) });
    }
  }

  register() {
    this.world.afterEvents.playerSpawn.subscribe((event) => {
      if (event.initialSpawn) this.system.runTimeout(() => this.syncPlayer(event.player), 1);
    });
    this.intervalId = this.system.runInterval(() => this.syncAll(), 20);
    this.system.run(() => this.syncAll());
  }
}
