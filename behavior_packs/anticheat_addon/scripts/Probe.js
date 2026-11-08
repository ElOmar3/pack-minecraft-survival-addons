import { ErrorReporter } from "./ErrorReporter.js";
import { system, world } from "@minecraft/server";
import { Config } from "./Config.js";

export const BUILD_INFO = Object.freeze({
  buildId: "anticheat-api-probe-2.8.0-001",
  requestedServerApi: "2.8.0",
  generatedAt: new Date().toISOString(),
  sourceCommit: "8dfd7355e9ce6a57bcb09bd2cea696b7b76b6cff"
});

export class ApiProbe {
  static hasRun = false;

  static initialize() {
    if (!Config.apiProbe?.enabled) return;
    
    console.warn(`[AntiCheatProbe] buildId=${BUILD_INFO.buildId}`);
    console.warn(`[AntiCheatProbe] requestedServerApi=${BUILD_INFO.requestedServerApi}`);
    console.warn(`[AntiCheatProbe] packHeaderUuid=b78e1215-fb8b-4a57-b248-cb580ee4f1ab`); // hardcoded from manifest
    console.warn(`[AntiCheatProbe] scriptModuleUuid=c88e1215-fb8b-4a57-b248-cb580ee4f1ab`); // assumed script module

    world.afterEvents.playerSpawn.subscribe((event) => {
      if (!event.initialSpawn || this.hasRun || !Config.apiProbe?.enabled) return;
      this.executeProbe(event.player);
    });

    system.afterEvents.scriptEventReceive.subscribe((event) => {
      if (event.id === "anticheat:probe_api" && event.sourceEntity?.typeId === "minecraft:player") {
        this.executeProbe(event.sourceEntity);
      }
    });
  }

  static executeProbe(player) {
    if (this.hasRun) return;
    this.hasRun = true;
    Config.apiProbe.enabled = false; // Disable after one run

    system.run(() => {
      const probe = {
        buildInfo: BUILD_INFO,
        entityId: player.id,
        typeId: player.typeId,
        getAABBType: typeof player.getAABB,
        getControlSchemeType: typeof player.getControlScheme,
        
        nativeAabb: null,
        derivedMinMaxAabb: null,
        aabbError: null,
        
        controlSchemeResult: null,
        controlSchemeError: null,
        
        inputInfoAvailable: false,
        inputMode: null,
        inputInfoError: null
      };

      try {
        if (typeof player.getAABB === "function") {
          const nativeAabb = player.getAABB();
          probe.nativeAabb = {
            center: { x: nativeAabb.center.x, y: nativeAabb.center.y, z: nativeAabb.center.z },
            extent: { x: nativeAabb.extent.x, y: nativeAabb.extent.y, z: nativeAabb.extent.z }
          };
          probe.derivedMinMaxAabb = {
            min: { x: nativeAabb.center.x - nativeAabb.extent.x, y: nativeAabb.center.y - nativeAabb.extent.y, z: nativeAabb.center.z - nativeAabb.extent.z },
            max: { x: nativeAabb.center.x + nativeAabb.extent.x, y: nativeAabb.center.y + nativeAabb.extent.y, z: nativeAabb.center.z + nativeAabb.extent.z }
          };
        }
      } catch (error) { ErrorReporter.report(error, { addonId: "anticheat_addon", moduleId: "Probe.js", operation: "try-catch", category: "runtime" });
        probe.aabbError = { name: error?.name ?? "UnknownError", message: String(error?.message ?? error) };
      }

      try {
        if (typeof player.getControlScheme === "function") {
          probe.controlSchemeResult = player.getControlScheme();
        }
      } catch (error) { ErrorReporter.report(error, { addonId: "anticheat_addon", moduleId: "Probe.js", operation: "try-catch", category: "runtime" });
        probe.controlSchemeError = { name: error?.name ?? "UnknownError", message: String(error?.message ?? error) };
      }

      try {
        probe.inputInfoAvailable = player.inputInfo !== undefined;
        probe.inputMode = player.inputInfo?.lastInputModeUsed ?? null;
      } catch (error) { ErrorReporter.report(error, { addonId: "anticheat_addon", moduleId: "Probe.js", operation: "try-catch", category: "runtime" });
        probe.inputInfoError = { name: error?.name ?? "UnknownError", message: String(error?.message ?? error) };
      }

      console.warn(`[AntiCheatProbeResult] ${JSON.stringify(probe)}`);
    });
  }
}
