import { system } from "@minecraft/server";
import { Config } from "./Config.js";

export class PerformanceMonitor {
  // Intervalo de muestreo de TPS; debe coincidir con Config.performance.
  static TICK_INTERVAL = Config.performance.tpsSampleIntervalTicks;
  static startTime = 0;
  static currentTps = 20.0;
  static lastTickTime = Date.now();
  static tpsHistory = [];
  
  static updateTps() {
    const now = Date.now();
    const delta = now - this.lastTickTime;
    this.lastTickTime = now;
    
    // Multiplicar por TICK_INTERVAL para normalizar: el callback corre cada N ticks, no cada tick
    const instantTps = delta > 0 ? (1000 / delta) * this.TICK_INTERVAL : 20.0;
    this.tpsHistory.push(instantTps);
    if (this.tpsHistory.length > 20) {
      this.tpsHistory.shift();
    }
    
    const sum = this.tpsHistory.reduce((a, b) => a + b, 0);
    this.currentTps = Math.min(20.0, sum / this.tpsHistory.length);
  }
  
  static startMeasure() {
    this.startTime = Date.now();
  }
  
  static shouldSkipSecondaryChecks() {
    // Si la configuración de desactivación por TPS bajo está activa
    if (Config.performance.disableOnLowTps && this.currentTps < Config.performance.tpsThreshold) {
      return true;
    }
    
    // Si el tiempo de ejecución en el tick actual excede el presupuesto de CPU (ms)
    const elapsed = Date.now() - this.startTime;
    if (elapsed > Config.performance.maxCpuUsageMs) {
      return true;
    }
    
    return false;
  }
}
