import { Capability } from "../authorization/Capability.js";
import { Role } from "../authorization/RoleDefinition.js";
import { AdminErrorCode } from "../shared/AdminErrors.js";
import { fail, ok } from "../shared/AdminResult.js";

export class AdminLockdownService {
  constructor(registry, executor, sessionInvalidator, audit) {
    this.registry = registry;
    this.executor = executor;
    this.sessionInvalidator = sessionInvalidator;
    this.audit = audit;
  }

  set(actorPlayer, locked, source = "COMMAND") {
    return this.executor.execute({
      actorPlayer, capability: Capability.LOCKDOWN_MANAGE, action: locked ? "admin.lockdown.enable" : "admin.lockdown.disable", source,
      reason: locked ? "emergency_lockdown" : "owner_recovery", parameters: { locked: Boolean(locked) },
      validate: (actor) => actor.role === Role.OWNER ? ok(true) : fail(AdminErrorCode.CAPABILITY_DENIED),
      mutate: () => {
        if (!this.registry.setLockdown(Boolean(locked))) throw new Error("lockdown_persistence_failed");
        this.sessionInvalidator.invalidateAll();
        this.audit.alert(locked ? "LOCKDOWN_ENABLED" : "LOCKDOWN_DISABLED", "CRITICAL", { ownerInitiated: true });
        return { locked: Boolean(locked) };
      }
    });
  }
}
