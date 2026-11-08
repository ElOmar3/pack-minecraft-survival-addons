const fs = require('fs');

// 1. Patch anticheat_addon/scripts/Logger.js
const loggerPath = 'behavior_packs/anticheat_addon/scripts/Logger.js';
let loggerContent = fs.readFileSync(loggerPath, 'utf8');

const oldAlertLogic = `    // Alerta in-game a OPs si pasa el umbral de alerta
    if (score >= Config.violations.alertThreshold) {
      this.sendAlertToOps(\`§e\${player.name} §7sospechoso de: §f\${detector} §7(Conf: \${(score/100).toFixed(2)}) [\${action.toUpperCase()}]\`);
    }`;

const newAlertLogic = `    // Alerta in-game mejorada a staff con sonido y actionbar (Fase 1)
    if (score >= 80 || score >= Config.violations.alertThreshold) {
      this.sendEnhancedAlertToStaff(player, detector, score, action);
    }`;

loggerContent = loggerContent.replace(oldAlertLogic, newAlertLogic);

const oldSendAlert = `  static sendAlertToOps(message) {
    const formatted = \`§c§l[Server Integrity]§r \${message}\`;
    for (const player of world.getAllPlayers()) {
      const isOp = player.isOp === true || (typeof player.isOp === "function" && player.isOp()) || player.hasTag("op") || player.hasTag("admin");
      if (isOp) {
        player.sendMessage(formatted);
      }
    }
  }`;

const newSendAlert = `  static sendEnhancedAlertToStaff(suspectPlayer, detector, score, action) {
    const chatMsg = \`§4§l[ANTI-CHEAT ALERTA] §c\${suspectPlayer.name} §eha alcanzado §c\${score}% §ede sospecha en §f\${detector} §e[\${action.toUpperCase()}]. Escribe §f/s:congelar \${suspectPlayer.name} §epara inspeccionar.\`;
    const actionBarMsg = \`§4§l[ALERTA] §c\${suspectPlayer.name} §e- \${detector} (\${score}%)\`;

    for (const staff of world.getAllPlayers()) {
      const isStaff = staff.isOp === true ||
        (typeof staff.isOp === "function" && staff.isOp()) ||
        staff.hasTag("op") || staff.hasTag("admin") ||
        staff.hasTag("fcx.admin") || staff.hasTag("fcx.mod") || staff.hasTag("staff");

      if (isStaff) {
        staff.sendMessage(chatMsg);
        try { staff.onScreenDisplay?.setActionBar(actionBarMsg); } catch (e) {}
        try { staff.playSound("note.pling", { pitch: 1.8, volume: 1.0 }); } catch (e) {}
      }
    }
  }

  static sendAlertToOps(message) {
    const formatted = \`§c§l[Server Integrity]§r \${message}\`;
    for (const player of world.getAllPlayers()) {
      const isOp = player.isOp === true || (typeof player.isOp === "function" && player.isOp()) || player.hasTag("op") || player.hasTag("admin");
      if (isOp) {
        player.sendMessage(formatted);
      }
    }
  }`;

loggerContent = loggerContent.replace(oldSendAlert, newSendAlert);
fs.writeFileSync(loggerPath, loggerContent, 'utf8');
console.log('✓ Successfully patched anticheat_addon Logger.js');

// 2. Patch fcx_limited_admin/scripts/moderation/ModerationService.js
const fcxModPath = 'behavior_packs/fcx_limited_admin/scripts/moderation/ModerationService.js';
let fcxContent = fs.readFileSync(fcxModPath, 'utf8');

// Enhance startFreeze
const oldStartFreeze = `  startFreeze(player, record) {
    const id = entityId(player);
    const existing = this.freezeTimers.get(id);
    if (existing !== undefined) this.system.clearRun(existing);
    const timer = this.system.runInterval(() => {
      try {
        if (!player.isValid || Date.now() >= record.expiresAt) {
          if (player.isValid) globalThis.__sqlite_set_prop_v2__("fcx_limited_admin", player, FREEZE_PROPERTY, undefined);
          this.system.clearRun(timer); this.freezeTimers.delete(id); return;
        }
        player.teleport(record.anchor, { dimension: player.dimension });
      } catch {
        this.system.clearRun(timer); this.freezeTimers.delete(id);
      }
    }, 2);
    this.freezeTimers.set(id, timer);
  }`;

const newStartFreeze = `  startFreeze(player, record) {
    const id = entityId(player);
    const existing = this.freezeTimers.get(id);
    if (existing !== undefined) this.system.clearRun(existing);

    try {
      player.addTag("fcx_frozen");
      player.addEffect("slowness", 12000, { amplifier: 255, showParticles: false });
      player.addEffect("weakness", 12000, { amplifier: 255, showParticles: false });
      player.onScreenDisplay?.setTitle("§c§l¡CONGELADO!");
      player.onScreenDisplay?.setSubtitle("§eInspección del staff - No te desconectes");
      player.sendMessage("§c§l[STAFF] ¡Has sido congelado para una revisión! No te desconectes o serás vetado permanentemente.");
    } catch {}

    const timer = this.system.runInterval(() => {
      try {
        if (!player.isValid || Date.now() >= record.expiresAt) {
          if (player.isValid) {
            globalThis.__sqlite_set_prop_v2__("fcx_limited_admin", player, FREEZE_PROPERTY, undefined);
            try {
              player.removeTag("fcx_frozen");
              player.runCommand("effect @s clear");
              player.sendMessage("§a§l[STAFF] §eHas sido descongelado. Gracias por tu cooperación.");
            } catch {}
          }
          this.system.clearRun(timer); this.freezeTimers.delete(id); return;
        }
        player.teleport(record.anchor, { dimension: player.dimension });
      } catch {
        this.system.clearRun(timer); this.freezeTimers.delete(id);
      }
    }, 2);
    this.freezeTimers.set(id, timer);
  }`;

fcxContent = fcxContent.replace(oldStartFreeze, newStartFreeze);

// Add block/interact/break cancellation in registerEnforcement
const oldRegisterEnforcement = `  registerEnforcement() {
    const chat = this.world.beforeEvents?.chatSend;`;

const newRegisterEnforcement = `  registerEnforcement() {
    // Bloquear interacciones y rotura de bloques mientras esté congelado
    const blockBreak = this.world.beforeEvents?.playerBreakBlock;
    if (blockBreak?.subscribe) {
      blockBreak.subscribe((event) => {
        const record = this.readRecord(event.player, FREEZE_PROPERTY);
        if (record && Number(record.expiresAt) > Date.now()) {
          event.cancel = true;
          this.system.run(() => {
            try { event.player.sendMessage("§c[FCX Moderación] No puedes romper bloques mientras estás congelado."); } catch {}
          });
        }
      });
    }

    const blockInteract = this.world.beforeEvents?.playerInteractWithBlock;
    if (blockInteract?.subscribe) {
      blockInteract.subscribe((event) => {
        const record = this.readRecord(event.player, FREEZE_PROPERTY);
        if (record && Number(record.expiresAt) > Date.now()) {
          event.cancel = true;
          this.system.run(() => {
            try { event.player.sendMessage("§c[FCX Moderación] No puedes interactuar con contenedores o bloques mientras estás congelado."); } catch {}
          });
        }
      });
    }

    const itemUse = this.world.beforeEvents?.itemUse;
    if (itemUse?.subscribe) {
      itemUse.subscribe((event) => {
        const record = this.readRecord(event.source, FREEZE_PROPERTY);
        if (record && Number(record.expiresAt) > Date.now()) {
          event.cancel = true;
        }
      });
    }

    const chat = this.world.beforeEvents?.chatSend;`;

fcxContent = fcxContent.replace(oldRegisterEnforcement, newRegisterEnforcement);

fs.writeFileSync(fcxModPath, fcxContent, 'utf8');
console.log('✓ Successfully patched fcx_limited_admin ModerationService.js');
