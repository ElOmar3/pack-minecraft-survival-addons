import { ErrorReporter } from "./ErrorReporter.js";
import { system, world } from "@minecraft/server";

const BUFFER_CAPACITY = 60; // Configurable (3 segundos max)

class RingBuffer {
  constructor(capacity) {
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(null);
    this.head = 0; // Índice de escritura actual
    this.count = 0; // Cuántos elementos válidos hay
  }

  push(item) {
    this.buffer[this.head] = Object.freeze(item); // Inmutable
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  getSnapshotAtTick(targetTick) {
    // Lectura iterando del más reciente al más antiguo lógicamente
    let closest = null;
    let minDiff = Infinity;
    
    // El elemento más reciente está en (head - 1 + capacity) % capacity
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - 1 - i + this.capacity) % this.capacity;
      const snap = this.buffer[idx];
      if (snap) {
        const diff = Math.abs(snap.tick - targetTick);
        if (diff < minDiff) {
          minDiff = diff;
          closest = snap;
        }
      }
    }
    return closest;
  }

  // Extraer todos en orden cronológico
  toArray() {
    const arr = [];
    if (this.count === 0) return arr;
    const start = this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.capacity;
      arr.push(this.buffer[idx]);
    }
    return arr;
  }
}

export class TelemetryManager {
  // Map<entityId, { buffer, sessionInfo, state, lastCombatTick }>
  static telemetry = new Map();

  // Map<entityId, DeathRecord>
  static deaths = new Map();

  static initialize({ schedule = true } = {}) {
    if (schedule) {
      system.runInterval(() => {
        this.tick();
      }, 3);
    }

    world.afterEvents.playerLeave.subscribe((ev) => {
      this.telemetry.delete(ev.playerId); 
    });
    
    world.afterEvents.entityDie.subscribe((ev) => {
      const deadEntity = ev.deadEntity;
      try {
        if (deadEntity && deadEntity.isValid) {
          this.deaths.set(deadEntity.id, {
            targetId: deadEntity.id,
            deathTick: system.currentTick,
            dimensionId: deadEntity.dimension.id,
            killerId: ev.damageSource?.damagingEntity?.id || null,
            cause: ev.damageSource?.cause || "unknown",
            expiresAtTick: system.currentTick + 200 // Cleanup after 10s
          });
          
          if (deadEntity.typeId === "minecraft:player") {
            this.resetSession(deadEntity);
          }
        }
      } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "TelemetryManager.js", operation: "try-catch", category: "runtime" });}
    });

    world.afterEvents.playerSpawn.subscribe((ev) => {
      if (!ev.initialSpawn) {
         this.resetSession(ev.player);
      }
    });
  }

  static getSessionData(player) {
    const id = player.id;
    let data = this.telemetry.get(id);
    if (!data) {
      data = {
        buffer: new RingBuffer(BUFFER_CAPACITY),
        sessionId: `${id}-${Date.now()}`,
        generation: 0,
        dimensionId: player.dimension.id,
        state: "IDLE", // IDLE, NEAR_COMBAT, COMBAT, SUSPICIOUS
        lastCaptureTick: 0
      };
      this.telemetry.set(id, data);
    }
    return data;
  }

  static resetSession(player) {
    const data = this.telemetry.get(player.id);
    if (data) {
      data.buffer = new RingBuffer(BUFFER_CAPACITY);
      data.generation++;
      data.dimensionId = player.dimension.id;
    }
  }

  static markCombat(player) {
    const data = this.getSessionData(player);
    data.state = "COMBAT";
  }

  static tick(players = undefined) {
    const currentTick = system.currentTick;
    const activePlayers = players || world.getAllPlayers();
    for (const player of activePlayers) {
      try {
        if (!player.isValid) {
          this.telemetry.delete(player.id);
          continue;
        }

        const data = this.getSessionData(player);
        
        // Detección de cambio de dimensión
        if (data.dimensionId !== player.dimension.id) {
          this.resetSession(player);
          continue;
        }

        // Adaptive Sampling
        let captureFrequency = 5; // IDLE
        if (data.state === "COMBAT" || data.state === "SUSPICIOUS") {
          captureFrequency = 1;
        } else if (data.state === "NEAR_COMBAT") {
          captureFrequency = 2;
        }

        if (currentTick - data.lastCaptureTick >= captureFrequency) {
          this.captureSnapshot(player, data, currentTick);
          data.lastCaptureTick = currentTick;
        }

      } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "TelemetryManager.js", operation: "try-catch", category: "runtime" });}
    }

    for (const [id, death] of this.deaths.entries()) {
      if (currentTick > death.expiresAtTick) this.deaths.delete(id);
    }
  }

  static captureSnapshot(player, data, tick) {
    const loc = player.location;
    const headLoc = player.getHeadLocation();
    const rot = player.getRotation();
    const viewDir = player.getViewDirection();
    const vel = player.getVelocity();

    // Extraer variables seguras y manejar fallbacks si no existen
    const snapshot = {
      tick: tick,
      entityId: player.id,
      sessionId: data.sessionId,
      generation: data.generation,
      dimensionId: data.dimensionId,
      position: { x: loc.x, y: loc.y, z: loc.z },
      headPosition: { x: headLoc.x, y: headLoc.y, z: headLoc.z },
      rotation: { yaw: rot.y, pitch: rot.x }, // En Minecraft Script API: y=yaw, x=pitch
      viewDirection: { x: viewDir.x, y: viewDir.y, z: viewDir.z },
      velocity: { x: vel.x, y: vel.y, z: vel.z },
      isSneaking: player.isSneaking,
      isFalling: player.isFalling,
      isOnGround: player.isOnGround,
      isInWater: player.isInWater,
      isClimbing: player.isClimbing,
      isJumping: null, // No soportado directamente
      isFlying: null,
      isGliding: player.isGliding,
      controlScheme: "UNKNOWN", // No soportado en 2.0.0
      recentTeleport: false, // Setear externamente o calcular
      recentRespawn: false,
      discontinuity: false,
      captureConfidence: 1.0,
      capabilityFlags: 0
    };

    data.buffer.push(snapshot);
  }

  static getHistory(entityId) {
    const data = this.telemetry.get(entityId);
    return data ? data.buffer.toArray() : [];
  }
}
