import { ErrorReporter } from "./ErrorReporter.js";
import { system } from "@minecraft/server";
import { playerKey } from "./Identity.js";

export class PlayerStateManager {
  static states = new Map();

  static updateState(player) {
    const key = playerKey(player);
    const currentLoc = player.location;
    const now = Date.now();
    
    let state = this.states.get(key);
    if (!state) {
      state = {
        history: [],
        lastUpdate: now,
        speedFlags: 0,
        airTicks: 0,
        phaseFlags: 0,
        lastYaw: 0,
        lastPitch: 0
      };
    }

    let rotation = { x: 0, y: 0 };
    try {
      rotation = player.getRotation ? player.getRotation() : rotation;
    } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "PlayerStateManager.js", operation: "try-catch", category: "runtime" });}

    // Usar un ring buffer con tamaño máximo de 10 entradas para históricos
    state.history.push({
      x: currentLoc.x,
      y: currentLoc.y,
      z: currentLoc.z,
      timestamp: now,
      tick: system.currentTick,
      onGround: player.isOnGround,
      yaw: rotation.y,
      pitch: rotation.x
    });

    if (state.history.length > 10) {
      state.history.shift();
    }

    state.lastUpdate = now;
    state.lastYaw = rotation.y;
    state.lastPitch = rotation.x;
    this.states.set(key, state);
  }

  static getState(key) {
    return this.states.get(key);
  }

  static getPreviousLoc(key) {
    const state = this.states.get(key);
    if (!state || state.history.length < 2) return null;
    return state.history[state.history.length - 2];
  }

  static clearPlayer(key) {
    this.states.delete(key);
  }
}
