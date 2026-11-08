import { ErrorReporter } from "./ErrorReporter.js";
import { CommandPermissionLevel, CustomCommandStatus, world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";






// === PERSISTENCIA SQLITE PUENTE V3 (SEGURO PARA /reload) ===
if (!globalThis.__sqlite_store_v2__) globalThis.__sqlite_store_v2__ = new Map();
if (!globalThis.__sqlite_owner_key_v2__) {
  globalThis.__sqlite_owner_key_v2__ = function(owner) {
    if (typeof owner === "string") return owner;
    if (!owner) return "world";
    if (owner.name) return String(owner.name).toLowerCase();
    if (owner.id !== undefined) return String(owner.id);
    return "world";
  };
}
if (!globalThis.__sqlite_get_prop_v2__) {
  globalThis.__sqlite_get_prop_v2__ = function(addon, owner, key) {
    if (!addon || owner === undefined || owner === null || key === undefined) return undefined;
    const addonStore = globalThis.__sqlite_store_v2__.get(String(addon));
    const ownerStore = addonStore ? addonStore.get(globalThis.__sqlite_owner_key_v2__(owner)) : undefined;
    return ownerStore ? ownerStore[key] : undefined;
  };
}
if (!globalThis.__sqlite_set_prop_v2__) {
  globalThis.__sqlite_set_prop_v2__ = function(addon, owner, key, value) {
    if (!addon || owner === undefined || owner === null || key === undefined) return;
    const addonKey = String(addon);
    const ownerKey = globalThis.__sqlite_owner_key_v2__(owner);
    let addonStore = globalThis.__sqlite_store_v2__.get(addonKey);
    if (!addonStore) { addonStore = new Map(); globalThis.__sqlite_store_v2__.set(addonKey, addonStore); }
    let ownerStore = addonStore.get(ownerKey);
    if (!ownerStore) { ownerStore = {}; addonStore.set(ownerKey, ownerStore); }
    const payload = { addon: addonKey, owner: ownerKey, key };
    if (value === undefined) { delete ownerStore[key]; payload.deleted = true; }
    else { ownerStore[key] = value; payload.deleted = false; payload.value = value; }
    try { console.warn("[SQLITE_SAVE_V1] " + JSON.stringify(payload)); } catch (e) {}
  };
}
if (!globalThis.__sqlite_rehydrate_v2__) {
  globalThis.__sqlite_rehydrate_v2__ = function(addon, owner, key, value, deleted) {
    if (!addon || owner === undefined || owner === null || key === undefined) return;
    const addonKey = String(addon);
    const ownerKey = globalThis.__sqlite_owner_key_v2__(owner);
    let addonStore = globalThis.__sqlite_store_v2__.get(addonKey);
    if (!addonStore) { addonStore = new Map(); globalThis.__sqlite_store_v2__.set(addonKey, addonStore); }
    let ownerStore = addonStore.get(ownerKey);
    if (!ownerStore) { ownerStore = {}; addonStore.set(ownerKey, ownerStore); }
    if (deleted === true) delete ownerStore[key];
    else ownerStore[key] = value;
  };
}
if (!globalThis.__sqlite_sync_complete_v2__) globalThis.__sqlite_sync_complete_v2__ = new Map();
if (!globalThis.__sqlite_sync_status_v3__) globalThis.__sqlite_sync_status_v3__ = new Map();
if (!globalThis.__sqlite_request_sync_v3__) {
  globalThis.__sqlite_request_sync_v3__ = function(addon, attempt) {
    const addonKey = String(addon || "");
    if (!addonKey) return;
    const previous = globalThis.__sqlite_sync_status_v3__.get(addonKey) || {};
    globalThis.__sqlite_sync_status_v3__.set(addonKey, {
      ...previous,
      requestedAt: Date.now(),
      attempt: Number(attempt || 0),
      complete: false,
      protocol: 0,
    });
    try { console.warn("[SQLITE_REQUEST_SYNC] " + JSON.stringify({ addon: addonKey, protocol: 3, attempt: Number(attempt || 0) })); } catch (e) {}
  };
}
try {
  const signal = system.afterEvents && system.afterEvents.scriptEventReceive;
  if (!globalThis.__sqlite_chunk_store_v2__) globalThis.__sqlite_chunk_store_v2__ = new Map();
  if (!globalThis.__sqlite_listener_callback_v3__) {
    const callback = function(event) {
    if (!event || (event.id !== "sqlite:load" && event.id !== "sqlite:sync" && event.id !== "sqlite:load_chunk" && event.id !== "sqlite:sync_complete")) return;
    try {
      const payload = JSON.parse(event.message || "{}");
      if (event.id === "sqlite:sync_complete") {
        if (payload.addon) {
          const addonKey = String(payload.addon);
          globalThis.__sqlite_sync_complete_v2__.set(addonKey, Date.now());
          const previous = globalThis.__sqlite_sync_status_v3__.get(addonKey) || {};
          globalThis.__sqlite_sync_status_v3__.set(addonKey, {
            ...previous,
            complete: true,
            completedAt: Date.now(),
            protocol: Number(payload.protocol || 0),
            entryCount: Number(payload.entryCount || 0),
          });
        }
        return;
      }
      if (event.id === "sqlite:load_chunk") {
        const count = Number(payload.chunkCount);
        const index = Number(payload.chunkIndex);
        if (!payload.addon || payload.key === undefined || !payload.chunkId || !Number.isInteger(count) || count < 1 || count > 128 || !Number.isInteger(index) || index < 0 || index >= count) return;
        const chunkKey = String(payload.chunkId);
        let state = globalThis.__sqlite_chunk_store_v2__.get(chunkKey);
        if (!state || state.count !== count) {
          state = { count: count, chunks: new Array(count) };
          globalThis.__sqlite_chunk_store_v2__.set(chunkKey, state);
        }
        state.chunks[index] = String(payload.valueChunk || "");
        for (let partIndex = 0; partIndex < state.count; partIndex++) {
          if (typeof state.chunks[partIndex] !== "string") return;
        }
        const value = JSON.parse(state.chunks.join(""));
        globalThis.__sqlite_rehydrate_v2__(payload.addon, payload.owner || "world", payload.key, value, false);
        globalThis.__sqlite_chunk_store_v2__.delete(chunkKey);
        return;
      }
      if (payload.addon && payload.key !== undefined) {
        globalThis.__sqlite_rehydrate_v2__(payload.addon, payload.owner || "world", payload.key, payload.value, payload.deleted === true);
      }
    } catch (e) {}
    };
    globalThis.__sqlite_listener_callback_v3__ = callback;
    if (signal && typeof signal.subscribe === "function") signal.subscribe(callback);
  }
} catch (e) {}
globalThis.__sqlite_sync_complete_v2__.delete("casino_addon");
globalThis.__sqlite_request_sync_v3__("casino_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("casino_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("casino_addon", 1);
  } catch (e) {}
}, 120);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
console.warn("Casino Addon iniciado.");
const COMMAND_NAMESPACE = "s";
const MAX_CASINO_BET = 25000;
const MAX_CASINO_BALANCE_PERCENT = 0.05;
const DAILY_CASINO_WAGER_LIMIT = 100000;
const CASINO_LIMIT_PROPERTY = "casino_wager_limit_v1";
const MAX_OPERATIONAL_BALANCE = 100000000;
const ECONOMY_DAILY_EMISSION_LIMIT = 50000;
const activeCasinoSessions = new Set();

function commandOk(message) {
  return { status: CustomCommandStatus.Success, message };
}

function commandError(message) {
  return { status: CustomCommandStatus.Failure, message };
}

// Constantes de diseño
const PREFIX = "§b§l[§3Casino§b§l]§r";

// Helper para abrir formularios de forma segura contra UserBusy (ej. chat cerrándose)
function safeOpenForm(player, form, onSelect, onCancel = undefined, retryCount = 0) {
  if (!player || (typeof player.isValid === "function" ? !player.isValid() : player.isValid === false)) {
    if (onCancel) {
      try { onCancel({ canceled: true, cancelationReason: "UserClosed" }); } catch (e) {}
    }
    return;
  }
  form.show(player).then((response) => {
    if (!response || response.canceled) {
      if (response && response.cancelationReason === "UserBusy" && retryCount < 5) {
        system.runTimeout(() => {
          if (!player || (typeof player.isValid === "function" ? !player.isValid() : player.isValid === false)) return;
          safeOpenForm(player, form, onSelect, onCancel, retryCount + 1);
        }, 10);
        return;
      }
      if (onCancel) {
        system.run(() => {
          try { onCancel(response || { canceled: true, cancelationReason: "UserClosed" }); } catch (e) {}
        });
      }
      return;
    }
    system.run(() => {
      try { onSelect(response); } catch (e) {
        ErrorReporter.report(e, { addonId: "casino_addon", moduleId: "main.js", operation: "safeOpenForm:onSelect", category: "runtime" });
      }
    });
  }).catch((err) => {
    const message = String(err ?? "");
    if (message.includes("Player quit before responding") || message.includes("FormRejectError")) return;
    console.warn(`[Casino Addon] Error en safeOpenForm: ${err}`);
  });
}

// Obtener balance del jugador (sincronizado con scoreboard money)
function getBalance(player) {
  try {
    const obj = world.scoreboard.getObjective("money");
    if (!obj) return 0;
    return (function(o, p){ try{return o.getScore(p) ?? 0;}catch(e){try{return o.getScore(p.name) ?? 0;}catch(e2){return 0;}} })(obj, player) ?? 0;
  } catch (e) { ErrorReporter.report(e, { addonId: "casino_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return 0;
  }
}

function parseStrictPositiveInteger(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) return NaN;
  const amount = Number(raw);
  if (!Number.isSafeInteger(amount) || amount <= 0) return NaN;
  return amount;
}

function isCasinoBusy(player) {
  return activeCasinoSessions.has(player?.id);
}

function startCasinoSession(player) {
  if (!player?.id) return false;
  if (activeCasinoSessions.has(player.id)) return false;
  activeCasinoSessions.add(player.id);
  return true;
}

function endCasinoSession(player) {
  if (!player?.id) return;
  activeCasinoSessions.delete(player.id);
}

try {
  world.afterEvents.playerLeave.subscribe((event) => {
    if (event?.playerId) activeCasinoSessions.delete(event.playerId);
  });
} catch (e) {}

function getUtcDay() {
  return Math.floor(Date.now() / 86400000);
}

function loadWagerLimit(player) {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("casino_addon", player, CASINO_LIMIT_PROPERTY);
    const parsed = raw ? JSON.parse(String(raw)) : {};
    const today = getUtcDay();
    if (Number(parsed.day) !== today) return { day: today, wagered: 0 };
    return { day: today, wagered: Math.max(0, Math.floor(Number(parsed.wagered) || 0)) };
  } catch (e) {
    ErrorReporter.report(e, { addonId: "casino_addon", moduleId: "main.js", operation: "loadWagerLimit", category: "runtime" });
    return { day: getUtcDay(), wagered: DAILY_CASINO_WAGER_LIMIT };
  }
}

function getMaximumBet(balance) {
  return Math.max(0, Math.min(MAX_CASINO_BET, Math.floor(Math.max(0, balance) * MAX_CASINO_BALANCE_PERCENT)));
}

function getEmissionBudget(player) {
  const day = getUtcDay();
  try {
    const dayObjective = world.scoreboard.getObjective("emission_day") || world.scoreboard.addObjective("emission_day", "Emission Day");
    const earnedObjective = world.scoreboard.getObjective("emission_earned") || world.scoreboard.addObjective("emission_earned", "Emission Earned");
    const storedDay = Number(dayObjective.getScore(player) ?? -1);
    if (storedDay !== day) {
      if (storedDay !== -1) return { day, earned: 0 };
      const raw = globalThis.__sqlite_get_prop_v2__("casino_addon", player, "economy_emission_budget_v1");
      if (!raw) return { day, earned: 0 };
      const legacy = JSON.parse(String(raw));
      const legacyEarned = Number(legacy?.earned);
      if (Number(legacy?.day) !== day || !Number.isSafeInteger(legacyEarned) || legacyEarned < 0 || legacyEarned > ECONOMY_DAILY_EMISSION_LIMIT) return null;
      dayObjective.setScore(player, day);
      earnedObjective.setScore(player, legacyEarned);
      return { day, earned: legacyEarned };
    }
    const earned = Number(earnedObjective.getScore(player) ?? 0);
    if (!Number.isSafeInteger(earned) || earned < 0 || earned > ECONOMY_DAILY_EMISSION_LIMIT) return null;
    return { day, earned };
  } catch (e) {
    ErrorReporter.report(e, { addonId: "casino_addon", moduleId: "main.js", operation: "getEmissionBudget", category: "runtime" });
    return null;
  }
}

function saveEmissionBudget(player, state) {
  try {
    const dayObjective = world.scoreboard.getObjective("emission_day") || world.scoreboard.addObjective("emission_day", "Emission Day");
    const earnedObjective = world.scoreboard.getObjective("emission_earned") || world.scoreboard.addObjective("emission_earned", "Emission Earned");
    dayObjective.setScore(player, Math.floor(Number(state.day) || 0));
    earnedObjective.setScore(player, Math.max(0, Math.floor(Number(state.earned) || 0)));
    return true;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "casino_addon", moduleId: "main.js", operation: "saveEmissionBudget", category: "runtime" });
    return false;
  }
}

function reserveEmission(player, amount, reason) {
  const delta = Math.floor(Number(amount) || 0);
  const previous = getEmissionBudget(player);
  if (!previous || delta <= 0 || previous.earned + delta > ECONOMY_DAILY_EMISSION_LIMIT) {
    console.warn(`[ECONOMY_TX] REJECT player=${player?.name || "unknown"} delta=${delta} reason=${reason} cause=emission_budget`);
    return null;
  }
  const reserved = { day: previous.day, earned: previous.earned + delta };
  if (!saveEmissionBudget(player, reserved)) {
    saveEmissionBudget(player, previous);
    console.warn(`[ECONOMY_TX] REJECT player=${player?.name || "unknown"} delta=${delta} reason=${reason} cause=emission_persistence`);
    return null;
  }
  return { previous, reserved, delta, reason };
}

function rollbackEmission(player, reservation) {
  const current = getEmissionBudget(player);
  if (!current || current.day !== reservation.reserved.day || current.earned !== reservation.reserved.earned || !saveEmissionBudget(player, reservation.previous)) {
    console.warn(`[ECONOMY_CRITICAL] emission_rollback_failed player=${player?.name || "unknown"} delta=${reservation.delta} reason=${reservation.reason}`);
    return false;
  }
  return true;
}

function settleCasinoPayout(player, bet, payout, game) {
  const netEmission = Math.max(0, payout - bet);
  const reservation = netEmission > 0 ? reserveEmission(player, netEmission, `casino_${game}`) : null;
  if (netEmission > 0 && !reservation) {
    if (!addBalance(player, bet, { allowOverOperationalLimit: true })) {
      console.warn(`[ECONOMY_CRITICAL] casino_stake_refund_failed player=${player.name} game=${game} amount=${bet}`);
    }
    return { ok: false, credited: 0 };
  }

  if (payout <= 0) return { ok: true, credited: 0 };
  if (!addBalance(player, payout)) {
    if (reservation) rollbackEmission(player, reservation);
    if (!addBalance(player, bet, { allowOverOperationalLimit: true })) {
      console.warn(`[ECONOMY_CRITICAL] casino_stake_refund_failed player=${player.name} game=${game} amount=${bet}`);
    }
    return { ok: false, credited: 0 };
  }
  if (reservation) {
    console.warn(`[ECONOMY_TX] COMMIT player=${player.name} delta=${reservation.delta} reason=${reservation.reason} emission_today=${reservation.reserved.earned} emission_limit=${ECONOMY_DAILY_EMISSION_LIMIT}`);
  }
  return { ok: true, credited: payout };
}

// Actualizar saldo del jugador
function addBalance(player, amount, { allowOverOperationalLimit = false } = {}) {
  try {
    let obj = world.scoreboard.getObjective("money");
    if (!obj) {
      try {
        obj = world.scoreboard.addObjective("money", "§e$ Dinero");
      } catch (createErr) { ErrorReporter.report(createErr, { addonId: "casino_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
    }
    if (!obj) return false;
    const current = (function(o, p){ try{return o.getScore(p) ?? 0;}catch(e){try{return o.getScore(p.name) ?? 0;}catch(e2){return 0;}} })(obj, player) ?? 0;
    const normalizedAmount = Math.floor(Number(amount) || 0);
    if (!Number.isSafeInteger(normalizedAmount) || (normalizedAmount < 0 && current < Math.abs(normalizedAmount))) return false;
    const next = current + normalizedAmount;
    if (normalizedAmount > 0 && !allowOverOperationalLimit && next > MAX_OPERATIONAL_BALANCE) return false;
    try {
      obj.setScore(player, next);
    } catch (participantError) {
      obj.setScore(player.name, next);
    }
    return getBalance(player) === next;
  } catch (e) { ErrorReporter.report(e, { addonId: "casino_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn(`[Casino Addon] Error al actualizar saldo: ${e}`);
    return false;
  }
}

function reserveCasinoWager(player, bet, maximumPayoutMultiplier) {
  const balance = getBalance(player);
  if (balance < bet) {
    return { ok: false, message: `§cNo tienes suficiente dinero. Saldo actual: §e$${balance}` };
  }
  const maximumBet = getMaximumBet(balance);
  if (bet > maximumBet) {
    return { ok: false, message: `§cTu apuesta máxima es §e$${maximumBet}§c (5% del saldo, con tope de $${MAX_CASINO_BET}).` };
  }
  const maximumClosingBalance = balance - bet + (bet * maximumPayoutMultiplier);
  if (!Number.isSafeInteger(maximumPayoutMultiplier) || maximumPayoutMultiplier <= 0 || maximumClosingBalance > MAX_OPERATIONAL_BALANCE) {
    return { ok: false, message: "§cLa apuesta podría superar el límite operativo de saldo. Reduce la apuesta o usa parte de tu saldo primero." };
  }
  const limit = loadWagerLimit(player);
  const remainingToday = Math.max(0, DAILY_CASINO_WAGER_LIMIT - limit.wagered);
  if (bet > remainingToday) {
    return { ok: false, message: `§cSuperas el límite diario. Puedes apostar §e$${remainingToday} §cmás hoy.` };
  }
  if (!addBalance(player, -bet)) {
    return { ok: false, message: "§cNo se pudo confirmar el débito. La apuesta fue cancelada." };
  }
  limit.wagered += bet;
  try {
    const serializedLimit = JSON.stringify(limit);
    globalThis.__sqlite_set_prop_v2__("casino_addon", player, CASINO_LIMIT_PROPERTY, serializedLimit);
    if (String(globalThis.__sqlite_get_prop_v2__("casino_addon", player, CASINO_LIMIT_PROPERTY) ?? "") !== serializedLimit) {
      throw new Error("casino_wager_limit_write_verification_failed");
    }
  } catch (e) {
    addBalance(player, bet, { allowOverOperationalLimit: true });
    ErrorReporter.report(e, { addonId: "casino_addon", moduleId: "main.js", operation: "reserveCasinoWager", category: "runtime" });
    return { ok: false, message: "§cNo se pudo guardar el límite diario. La apuesta fue reembolsada." };
  }
  return { ok: true };
}

// Menú Principal del Casino
function openCasinoMenu(player) {
  const balance = getBalance(player);
  const form = new ActionFormData()
    .title("§d§l🎰 CASINO IMPERIAL 🎰")
    .body(`¡Bienvenido al casino! Pon a prueba tu suerte.\n\n§7Tu saldo actual: §a$${balance}\n\nSelecciona un juego:`)
    .button("🎰 Tragamonedas (Slots)\n§7¡Gana hasta x10 de tu apuesta!", "textures/ui/slot_icon")
    .button("🎡 Ruleta Imperial\n§7Apuesta al Rojo, Negro o Verde", "textures/ui/roulette_icon")
    .button("❔ ¿Cómo funciona? / Guía")
    .button("❌ Salir");

  safeOpenForm(player, form, (response) => {
    const sel = response.selection;
    if (sel === 0) {
      openSlotsMenu(player);
    } else if (sel === 1) {
      openRouletteMenu(player);
    } else if (sel === 2) {
      openCasinoTutorial(player);
    }
  });
}

function openCasinoTutorial(player) {
  const form = new ActionFormData()
    .title("❔ Guía de Juegos de Casino")
    .body("§e¿Cómo jugar en el Casino Imperial?\n\n" +
          "§a1. 🎰 Tragamonedas (Slots):\n" +
          "§7- Elige una apuesta predefinida o ingresa un monto personalizado.\n" +
          "§7- Girarás 3 rodillos con símbolos (Cereza, Limón, Corona, Diamante, Calavera).\n" +
          "§7- Multiplicadores:\n" +
          "  §7• 3 Diamantes: §6x10§7 de tu apuesta.\n" +
          "  §7• 3 Coronas: §6x5§7 de tu apuesta.\n" +
          "  §7• 3 Cerezas o Limones: §ax3§7.\n" +
          "  §7• 2 símbolos normales: §ax1.35§7.\n" +
          "  §7• Calaveras (💀): ¡Si te salen, pierdes tu apuesta!\n\n" +
          "§a2. 🎡 Ruleta Imperial:\n" +
          "§7- Apuesta a un color específico:\n" +
          "  §7• §cRojo §7o §8Negro§7: Duplica tu dinero (gagas §a2x§7, 47% de probabilidad c/u).\n" +
          "  §7• §aVerde (0)§7: Paga un multiplicador masivo de §6x14§7 (6% de probabilidad).")
    .button("🔙 Volver");

  safeOpenForm(player, form, () => {
    openCasinoMenu(player);
  });
}

// ==========================================
// 🎰 JUEGO: TRAGAMONEDAS (SLOTS)
// ==========================================

const SLOT_BET_OPTIONS = [100, 500, 1000, 5000];
const SLOT_SYMBOLS = [
  { char: "🍒", weight: 35, name: "Cereza" },
  { char: "🍋", weight: 30, name: "Limón" },
  { char: "👑", weight: 15, name: "Corona" },
  { char: "💎", weight: 10, name: "Diamante" },
  { char: "💀", weight: 10, name: "Calavera" }
];

function getRandomSymbol() {
  const totalWeight = SLOT_SYMBOLS.reduce((sum, sym) => sum + sym.weight, 0);
  let rand = Math.random() * totalWeight;
  for (let sym of SLOT_SYMBOLS) {
    if (rand < sym.weight) return sym;
    rand -= sym.weight;
  }
  return SLOT_SYMBOLS[0];
}

function openSlotsMenu(player) {
  const balance = getBalance(player);
  const form = new ActionFormData()
    .title("§d🎰 Tragamonedas (Slots) 🎰")
    .body(`§7Tu saldo actual: §a$${balance}\n\nSelecciona el monto de tu apuesta:`)
    .button("💵 Apostar $100")
    .button("💵 Apostar $500")
    .button("💵 Apostar $1,000")
    .button("💵 Apostar $5,000")
    .button("✍️ Apuesta Personalizada")
    .button("⬅ Volver al Menú");

  safeOpenForm(player, form, (response) => {
    if (response.selection === 5) {
      openCasinoMenu(player);
      return;
    }
    
    if (response.selection === 4) {
      openCustomBetSlots(player);
      return;
    }
    
    const bet = SLOT_BET_OPTIONS[response.selection];
    runSlotsSpin(player, bet);
  });
}

function openCustomBetSlots(player) {
  const balance = getBalance(player);
  const maximumBet = getMaximumBet(balance);
  const form = new ModalFormData()
    .title("🎰 Apuesta Personalizada (Slots)")
    .textField(`Introduce la cantidad a apostar (Máx: $${maximumBet}):`, "Monto de la apuesta", { defaultValue: "100" });

  safeOpenForm(player, form, (response) => {
    if (!response.formValues) return;
    const betVal = parseStrictPositiveInteger(response.formValues[0]);
    if (isNaN(betVal) || betVal <= 0) {
      player.sendMessage(`${PREFIX} §cLa apuesta debe ser un número entero mayor que 0.`);
      return;
    }
    runSlotsSpin(player, betVal);
  });
}

function runSlotsSpin(player, bet) {
  if (!Number.isSafeInteger(bet) || bet <= 0) {
    player.sendMessage(`${PREFIX} §cApuesta inválida.`);
    return;
  }
  if (!startCasinoSession(player)) {
    player.sendMessage(`${PREFIX} §cYa tienes una apuesta en curso. Espera a que termine el giro actual.`);
    return;
  }

  const reservation = reserveCasinoWager(player, bet, 10);
  if (!reservation.ok) {
    endCasinoSession(player);
    player.sendMessage(`${PREFIX} ${reservation.message}`);
    return;
  }

  // Simular el giro con sonidos en escala de tiempo (acelerando y luego frenando)
  let count = 0;
  const totalTicks = 8;
  
  function playTickSound() {
    if (!player || (typeof player.isValid === "function" ? !player.isValid() : player.isValid === false)) {
      endCasinoSession(player);
      return;
    }
    if (count < totalTicks) {
      // Tono ascendente
      const pitch = 0.5 + (count * 0.15);
      try {
        player.runCommand(`playsound note.pling @s ~ ~ ~ 0.8 ${pitch}`);
      } catch (e) { ErrorReporter.report(e, { addonId: "casino_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
      
      count++;
      // Programar siguiente click/pling con retraso incremental (simulando fricción)
      const nextDelay = 2 + Math.floor((count * count) * 0.4);
      system.runTimeout(playTickSound, nextDelay);
    } else {
      // Llegamos al final, calculamos resultado
      revealSlotsResult(player, bet);
    }
  }

  playTickSound();
}

function revealSlotsResult(player, bet) {
  const sym1 = getRandomSymbol();
  const sym2 = getRandomSymbol();
  const sym3 = getRandomSymbol();

  let winMultiplier = 0;
  let resultText = "";
  let sound = "";
  
  const matches = (sym1.char === sym2.char ? 1 : 0) + 
                  (sym2.char === sym3.char ? 1 : 0) + 
                  (sym1.char === sym3.char ? 1 : 0);

  if (sym1.char === sym2.char && sym2.char === sym3.char) {
    // 3 Iguales
    if (sym1.char === "💎") {
      winMultiplier = 10;
      resultText = "§a§l¡JACKPOT DE DIAMANTE! (x10)";
      sound = "random.levelup";
    } else if (sym1.char === "👑") {
      winMultiplier = 5;
      resultText = "§e§l¡PREMIO REAL DE CORONA! (x5)";
      sound = "random.levelup";
    } else if (sym1.char === "🍒" || sym1.char === "🍋") {
      winMultiplier = 3;
      resultText = "§b§l¡Línea frutal completada! (x3)";
      sound = "random.orb";
    } else { // Calavera 💀
      winMultiplier = 0;
      resultText = "§c§l¡MALDICIÓN DE CALAVERA! Pierdes todo.";
      sound = "mob.wither.spawn";
    }
  } else if (matches > 0) {
    // 2 Iguales (y que no sean calaveras redundantes para no penalizar si sale calavera aislada)
    // El par de símbolos iguales define el pago de consolación
    const pairChar = (sym1.char === sym2.char) ? sym1.char : sym3.char;
    if (pairChar === "💀") {
      winMultiplier = 0.5; // Si son calaveras amortigua un poco
      resultText = "§6Doble calavera... (Recuperas x0.5)";
      sound = "random.classic_explode";
    } else {
      winMultiplier = 1.35;
      resultText = "§a¡Par coincidente! (x1.35)";
      sound = "random.orb";
    }
  } else {
    // Ninguno igual
    winMultiplier = 0;
    resultText = "§7Sin suerte esta vez. ¡Inténtalo de nuevo!";
    sound = "mob.villager.no";
  }

  const payout = Math.floor(bet * winMultiplier);
  const settlement = settleCasinoPayout(player, bet, payout, "slots");
  const payoutCredited = settlement.ok;
  const creditedPayout = settlement.credited;
  if (!payoutCredited) {
    console.warn(`[ECONOMY_CRITICAL] casino_payout_failed player=${player.name} game=slots amount=${payout}`);
    resultText = "§cNo se pudo acreditar el premio. Contacta a administración.";
  }
  endCasinoSession(player);

  // Reproducir sonido de premio o fracaso
  try {
    player.runCommand(`playsound ${sound} @s ~ ~ ~ 1.0 1.0`);
  } catch (e) { ErrorReporter.report(e, { addonId: "casino_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  const newBalance = getBalance(player);
  
  // Mostrar pantalla de resultado final
  const form = new ActionFormData()
    .title("🎰 Resultado del Slots 🎰")
    .body(`=== GIRO COMPLETADO ===\n\n       [  ${sym1.char}  |  ${sym2.char}  |  ${sym3.char}  ]\n\n${resultText}\n\n§7Apuesta: §e$${bet}\n§7Ganancia acreditada: §a$${creditedPayout}\n§7Tu nuevo saldo: §g$${newBalance}`)
    .button("🎰 Volver a Girar")
    .button("⬅ Volver a Apuestas")
    .button("❌ Salir");

  safeOpenForm(player, form, (response) => {
    if (response.selection === 0) {
      runSlotsSpin(player, bet);
    } else if (response.selection === 1) {
      openSlotsMenu(player);
    }
  });
}

// ==========================================
// 🎡 JUEGO: RULETA IMPERIAL
// ==========================================

function openRouletteMenu(player) {
  const balance = getBalance(player);
  const form = new ActionFormData()
    .title("🎡 Ruleta Imperial 🎡")
    .body(`§7Tu saldo actual: §a$${balance}\n\nSelecciona el monto de tu apuesta:`)
    .button("💵 Apostar $100")
    .button("💵 Apostar $500")
    .button("💵 Apostar $1,000")
    .button("💵 Apostar $5,000")
    .button("✍️ Apuesta Personalizada")
    .button("⬅ Volver al Menú");

  safeOpenForm(player, form, (response) => {
    if (response.selection === 5) {
      openCasinoMenu(player);
      return;
    }
    
    let bet = 100;
    if (response.selection === 4) {
      openCustomBetRoulette(player);
      return;
    } else {
      bet = SLOT_BET_OPTIONS[response.selection];
    }
    openRouletteColorSelect(player, bet);
  });
}

function openCustomBetRoulette(player) {
  const balance = getBalance(player);
  const maximumBet = getMaximumBet(balance);
  const form = new ModalFormData()
    .title("🎡 Apuesta Personalizada (Ruleta)")
    .textField(`Introduce la cantidad a apostar (Máx: $${maximumBet}):`, "Monto de la apuesta", { defaultValue: "100" });

  safeOpenForm(player, form, (response) => {
    if (!response.formValues) return;
    const betVal = parseStrictPositiveInteger(response.formValues[0]);
    if (isNaN(betVal) || betVal <= 0) {
      player.sendMessage(`${PREFIX} §cLa apuesta debe ser un número entero mayor que 0.`);
      return;
    }
    openRouletteColorSelect(player, betVal);
  });
}

function openRouletteColorSelect(player, bet) {
  const form = new ActionFormData()
    .title("🎡 Selecciona tu Opción 🎡")
    .body(`§7Monto de Apuesta: §e$${bet}\n\nElige a qué color deseas apostar:`)
    .button("🔴 Rojo (Multiplica x2)\n§7Números del 1 al 7")
    .button("⚫ Negro (Multiplica x2)\n§7Números del 8 al 14")
    .button("🟢 Verde (Multiplica x14)\n§7Número 0")
    .button("⬅ Volver");

  safeOpenForm(player, form, (response) => {
    if (response.selection === 3) {
      openRouletteMenu(player);
      return;
    }
    // Opciones: 0 = Rojo, 1 = Negro, 2 = Verde
    const colors = ["Rojo", "Negro", "Verde"];
    const chosenColor = colors[response.selection];
    runRouletteSpin(player, bet, chosenColor);
  });
}

function runRouletteSpin(player, bet, chosenColor) {
  if (!Number.isSafeInteger(bet) || bet <= 0) {
    player.sendMessage(`${PREFIX} §cApuesta inválida.`);
    return;
  }
  if (!["Rojo", "Negro", "Verde"].includes(String(chosenColor))) {
    player.sendMessage(`${PREFIX} §cOpción de ruleta inválida.`);
    return;
  }
  if (!startCasinoSession(player)) {
    player.sendMessage(`${PREFIX} §cYa tienes una apuesta en curso. Espera a que termine la ruleta actual.`);
    return;
  }

  const reservation = reserveCasinoWager(player, bet, 14);
  if (!reservation.ok) {
    endCasinoSession(player);
    player.sendMessage(`${PREFIX} ${reservation.message}`);
    return;
  }

  let count = 0;
  const totalTicks = 12;
  
  function playWheelSound() {
    if (!player || (typeof player.isValid === "function" ? !player.isValid() : player.isValid === false)) {
      endCasinoSession(player);
      return;
    }
    if (count < totalTicks) {
      try {
        player.runCommand(`playsound random.click @s ~ ~ ~ 0.7 1.2`);
      } catch (e) { ErrorReporter.report(e, { addonId: "casino_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
      
      count++;
      // Ralentización progresiva de la ruleta
      const delay = 1 + Math.floor((count * count) * 0.25);
      system.runTimeout(playWheelSound, delay);
    } else {
      revealRouletteResult(player, bet, chosenColor);
    }
  }

  playWheelSound();
}

function revealRouletteResult(player, bet, chosenColor) {
  // Los números de la ruleta simplificada: 0 al 14.
  // 0 es Verde
  // 1-7 son Rojo
  // 8-14 son Negro
  const number = Math.floor(Math.random() * 15);
  let color = "Verde";
  let colorSymbol = "🟢";
  
  if (number >= 1 && number <= 7) {
    color = "Rojo";
    colorSymbol = "🔴";
  } else if (number >= 8 && number <= 14) {
    color = "Negro";
    colorSymbol = "⚫";
  }

  const win = (chosenColor === color);
  let multiplier = 0;
  
  if (win) {
    multiplier = (color === "Verde") ? 14 : 2;
  }

  const payout = bet * multiplier;
  const settlement = settleCasinoPayout(player, bet, payout, "roulette");
  const payoutCredited = settlement.ok;
  const creditedPayout = settlement.credited;
  if (!payoutCredited) console.warn(`[ECONOMY_CRITICAL] casino_payout_failed player=${player.name} game=roulette amount=${payout}`);
  endCasinoSession(player);

  // Sonidos de resultado
  const sound = win ? "random.levelup" : "mob.villager.no";
  try {
    player.runCommand(`playsound ${sound} @s ~ ~ ~ 1.0 1.0`);
  } catch (e) { ErrorReporter.report(e, { addonId: "casino_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  const newBalance = getBalance(player);
  const resultText = !payoutCredited
    ? "§cNo se pudo acreditar el premio. Contacta a administración."
    : win ? `§a§l¡GANASTE! Paga x${multiplier}` : "§c§lPERDISTE";

  const form = new ActionFormData()
    .title("🎡 Resultado de la Ruleta 🎡")
    .body(`=== RESULTADO DE LA RULETA ===\n\n              §l${colorSymbol} ${color} (Número ${number})\n\nTu elección: §f${chosenColor}\nResultado: ${resultText}\n\n§7Apuesta: §e$${bet}\n§7Ganancia acreditada: §a$${creditedPayout}\n§7Nuevo saldo: §g$${newBalance}`)
    .button("🎡 Volver a Jugar")
    .button("⬅ Volver a Apuestas")
    .button("❌ Salir");

  safeOpenForm(player, form, (response) => {
    if (response.selection === 0) {
      openRouletteColorSelect(player, bet);
    } else if (response.selection === 1) {
      openRouletteMenu(player);
    }
  });
}

// ==========================================
// INTERCEPTOR DE CHAT Y SCRIPT EVENTS
// ==========================================

function registerCustomCommands() {
  const startupSignal = system?.beforeEvents?.startup;
  if (!startupSignal || typeof startupSignal.subscribe !== "function") return;
  startupSignal.subscribe((event) => {
    const registry = event?.customCommandRegistry;
    const register = typeof registry?.registerCommand === "function"
      ? registry.registerCommand.bind(registry)
      : typeof registry?.register === "function"
        ? registry.register.bind(registry)
        : undefined;
    if (!register) return;
    try {
      for (const name of ["casino", "apostar", "slots"]) {
        register({ name: `${COMMAND_NAMESPACE}:${name}`, description: "Abre el casino", permissionLevel: CommandPermissionLevel.Any }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          system.runTimeout(() => openCasinoMenu(sender), 5);
          return commandOk("Abriendo casino.");
        });
      }
    } catch (e) { ErrorReporter.report(e, { addonId: "casino_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Casino Addon] Error registrando custom commands: " + e);
    }
  });
}

registerCustomCommands();

try {
  world.afterEvents.playerLeave.subscribe((event) => {
    if (!event?.playerId) return;
    activeCasinoSessions.delete(event.playerId);
  });
} catch (e) { ErrorReporter.report(e, { addonId: "casino_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
