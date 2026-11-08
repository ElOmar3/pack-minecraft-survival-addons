import { ErrorReporter } from "./ErrorReporter.js";
import {
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
  DisplaySlotId,
  ObjectiveSortOrder,
  PlayerPermissionLevel,
  system,
  world,
} from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";






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
globalThis.__sqlite_sync_complete_v2__.delete("currency_addon");
globalThis.__sqlite_request_sync_v3__("currency_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("currency_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("currency_addon", 1);
  } catch (e) {}
}, 120);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
const patchShow = (prototype, originalShow) => {
  if (!prototype || !originalShow || originalShow.__isPatched) return;
  const patched = function(player, retryCount = 0) {
    return originalShow.call(this, player).then((response) => {
      if (response.canceled && response.cancelationReason === "UserBusy" && retryCount < 5) {
        return new Promise((resolve) => {
          system.runTimeout(() => {
            resolve(patched.call(this, player, retryCount + 1));
          }, 5);
        });
      }
      return response;
    });
  };
  patched.__isPatched = true;
  prototype.show = patched;
};

try {
  patchShow(ActionFormData.prototype, ActionFormData.prototype.show);
  patchShow(ModalFormData.prototype, ModalFormData.prototype.show);
  patchShow(MessageFormData.prototype, MessageFormData.prototype.show);
} catch (e) {}

console.warn("Virtual Currency Addon iniciado.");

// Diagnóstico temporal y de solo lectura para localizar propiedades mundiales
// que disparan el guardado periódico de dynamic properties.
system.runTimeout(() => {
  try {
    const entries = [].map((id) => {
      const value = globalThis.__sqlite_get_prop_v2__("currency_addon", "world", id);
      const size = typeof value === "string" ? value.length : value === undefined ? 0 : String(value).length;
      return { id, size };
    }).sort((a, b) => b.size - a.size);
    const total = entries.reduce((sum, entry) => sum + entry.size, 0);
    console.warn(`[DP_AUDIT_WORLD_V1] total_chars=${total} entries=${entries.length} largest=${JSON.stringify(entries.slice(0, 20))}`);
  } catch (e) {
    console.warn(`[DP_AUDIT_WORLD_V1] failed=${String(e?.message || e)}`);
  }
}, 100);

const COMMAND_NAMESPACE = "s";
const MAX_OPERATIONAL_BALANCE = 100000000;
const MAX_SCOREBOARD_BALANCE = 2147483647;
const MAX_TRANSACTION_AMOUNT = 1000000;
const BALANCE_SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
// Exportación limpia: las remediaciones históricas pertenecen al servidor
// original y nunca deben aplicarse sobre un mundo nuevo.
const ECONOMY_REMEDIATION_KEY = "economy_remediation_clean_export";
const ECONOMY_REMEDIATION_DEDUCTIONS = new Map();
const activeMoneyTransfers = new Set();
let lastRemediationStatusLog = "";
const ADMIN_PERMISSION =
  CommandPermissionLevel.GameDirectors ??
  CommandPermissionLevel.Admin ??
  CommandPermissionLevel.Host ??
  CommandPermissionLevel.Owner ??
  CommandPermissionLevel.Any;

function normalizePlayerName(name) {
  try {
    return String(name ?? "").normalize("NFKC").trim().toLowerCase();
  } catch {
    return String(name ?? "").trim().toLowerCase();
  }
}

function commandOk(message) {
  return {
    status: CustomCommandStatus.Success,
    message,
  };
}

function commandError(message) {
  return {
    status: CustomCommandStatus.Failure,
    message,
  };
}

function isPlayerOp(player) {
  if (!player) return false;
  // La economía queda fuera de los roles FCX. Tags, nombre, scoreboard y
  // Creative nunca conceden autoridad para crear o retirar moneda.
  try {
    return player.playerPermissionLevel === PlayerPermissionLevel.Operator;
  } catch (e) { ErrorReporter.report(e, { addonId: "currency_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

  return false;
}

// Inicialización de Scoreboard
function getObjective() {
  const objectiveId = "money";
  let objective = world.scoreboard.getObjective(objectiveId);
  if (!objective) {
    try {
      objective = world.scoreboard.addObjective(objectiveId, "§e$ Dinero");
      console.warn("Creado Scoreboard Objective 'money' ('Dinero').");
    } catch (error) { ErrorReporter.report(error, { addonId: "currency_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      // Puede fallar si se llama antes de que cargue el mundo por completo
    }
  }
  
  if (objective) {
    try {
      // Configurar visualización en la lista de jugadores (Pausa) para ver el balance de todos
      world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.List, {
        objective: objective,
        sortOrder: ObjectiveSortOrder.Descending
      });
    } catch (e) { ErrorReporter.report(e, { addonId: "currency_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      // Ignorar fallas si ocurre en la carga inicial de carga de mundo
    }
  }
  return objective;
}

function ensureMoneyObjective() {
  return Boolean(getObjective());
}

// === NUEVAS FUNCIONALIDADES Y MEJORAS DE LA BANCA ===

// Helper de audio y notificaciones en pantalla (Feature 5)
function playBankSound(player, soundType = "income", message = "") {
  try {
    if (message) {
      try {
        player.onScreenDisplay.setActionBar(message);
      } catch (e) {
        player.sendMessage(message);
      }
    }
    const soundMap = {
      income: "random.orb",
      deposit: "random.pop",
      withdraw: "random.pop",
      error: "note.bass",
      tax: "random.break",
      upgrade: "ui.toast.challenge_complete"
    };
    const sound = soundMap[soundType] || "random.orb";
    player.playSound(sound, { pitch: 1.2, volume: 0.8 });
  } catch (e) {}
}

// Rangos y Membresías Bancarias (Feature 4)
function getAccountTier(player) {
  const savings = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_SAVINGS_PROPERTY) ?? 0);
  if (savings >= 200000) {
    return { name: "Empresarial / VIP", color: "§d", maxLoan: 500000, interestBonus: 1.0, itfDiscount: 0.5 };
  } else if (savings >= 50000) {
    return { name: "Preferencial", color: "§b", maxLoan: 150000, interestBonus: 0.5, itfDiscount: 0.75 };
  } else {
    return { name: "Estándar", color: "§7", maxLoan: 50000, interestBonus: 0.0, itfDiscount: 1.0 };
  }
}

// Depósitos a Plazo Fijo / Certificados de Depósito (Feature 1)
function getFixedDeposit(player) {
  const raw = globalThis.__sqlite_get_prop_v2__("currency_addon", player, "bank_cd_data_v1");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function setFixedDeposit(player, data) {
  if (!data) {
    globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_cd_data_v1", undefined);
  } else {
    globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_cd_data_v1", JSON.stringify(data));
  }
}

// Tarjeta de Débito Bancaria (Feature 2)
function isDebitCardEnabled(player) {
  return Boolean(globalThis.__sqlite_get_prop_v2__("currency_addon", player, "bank_debit_card_enabled_v1") ?? true);
}

function toggleDebitCard(player) {
  const current = isDebitCardEnabled(player);
  globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_debit_card_enabled_v1", !current);
  playBankSound(player, !current ? "upgrade" : "error", !current ? "§a💳 Tarjeta de Débito ACTIVADA" : "§c💳 Tarjeta de Débito DESACTIVADA");
}

// Banca de Clan (Feature 3)
function getClanAccountRegistry() {
  const raw = globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "bank_clan_accounts_v1");
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (e) { return {}; }
}

function setClanAccountRegistry(registry) {
  try {
    globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "bank_clan_accounts_v1", JSON.stringify(registry));
  } catch (e) {}
}

// Bolsa de Valores (Feature 1)
// Los precios se guardan en una propiedad mundial: una recarga no los reinicia.
const STOCK_MARKET_UPDATE_INTERVAL_MS = 5 * 60 * 1000;
const STOCK_MARKET_CHECK_TICKS = 60 * 20;
const STOCK_MARKET_SECTORS = {
  mining: { name: "Minería y Gemas", basePrice: 105, minPrice: 60, maxPrice: 180 },
  farming: { name: "Agricultura y Granja", basePrice: 98, minPrice: 55, maxPrice: 165 },
  building: { name: "Construcción y Bienes", basePrice: 112, minPrice: 65, maxPrice: 195 },
  trade: { name: "Comercio y Logística", basePrice: 102, minPrice: 60, maxPrice: 175 }
};

function createDefaultStockMarket() {
  const market = { lastUpdate: Date.now() };
  for (const [key, config] of Object.entries(STOCK_MARKET_SECTORS)) {
    market[key] = { name: config.name, price: config.basePrice, change: 0 };
  }
  return market;
}

function getStockMarketData() {
  const raw = globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "bank_stocks_market_v1");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const market = { lastUpdate: Number(parsed.lastUpdate) || Date.now() };
        for (const [key, config] of Object.entries(STOCK_MARKET_SECTORS)) {
          const stored = parsed[key] || {};
          const price = Math.floor(Number(stored.price));
          market[key] = {
            name: config.name,
            price: Number.isSafeInteger(price) && price >= config.minPrice && price <= config.maxPrice ? price : config.basePrice,
            change: Number.isFinite(Number(stored.change)) ? Number(stored.change) : 0
          };
        }
        return market;
      }
    } catch (e) {
      ErrorReporter.report(e, { addonId: "currency_addon", moduleId: "main.js", operation: "read_stock_market", category: "runtime" });
    }
  }
  return createDefaultStockMarket();
}

function setStockMarketData(data) {
  try {
    globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "bank_stocks_market_v1", JSON.stringify(data));
    return true;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "currency_addon", moduleId: "main.js", operation: "write_stock_market", category: "runtime" });
    return false;
  }
}

function updateStockMarketIfDue(source = "interval") {
  const market = getStockMarketData();
  const now = Date.now();
  if (now - market.lastUpdate < STOCK_MARKET_UPDATE_INTERVAL_MS) return false;

  for (const [key, config] of Object.entries(STOCK_MARKET_SECTORS)) {
    const sector = market[key];
    const previousPrice = sector.price;
    // Oscilación moderada (±3%) y regreso suave al precio base para evitar burbujas.
    const randomPercent = (Math.random() * 6) - 3;
    const meanReversionPercent = ((config.basePrice - previousPrice) / config.basePrice) * 1.25;
    const requestedPercent = Math.max(-4, Math.min(4, randomPercent + meanReversionPercent));
    const nextPrice = Math.max(
      config.minPrice,
      Math.min(config.maxPrice, Math.round(previousPrice * (1 + requestedPercent / 100)))
    );
    sector.price = nextPrice;
    sector.change = Number((((nextPrice - previousPrice) / previousPrice) * 100).toFixed(2));
  }

  market.lastUpdate = now;
  if (!setStockMarketData(market)) return false;
  console.warn(`[STOCK_MARKET] update source=${source} mining=${market.mining.price} farming=${market.farming.price} building=${market.building.price} trade=${market.trade.price}`);
  return true;
}

// Inicializa solo si aún no hay mercado persistido. Después, actualiza cada cinco minutos.
system.run(() => {
  if (!globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "bank_stocks_market_v1")) setStockMarketData(createDefaultStockMarket());
  updateStockMarketIfDue("startup");
});
system.runInterval(() => updateStockMarketIfDue("interval"), STOCK_MARKET_CHECK_TICKS);

function getPlayerPortfolio(player) {
  const raw = globalThis.__sqlite_get_prop_v2__("currency_addon", player, "bank_player_stocks_v1");
  if (raw) {
    try { return JSON.parse(raw); } catch (e) {}
  }
  return { mining: 0, farming: 0, building: 0, trade: 0 };
}

function setPlayerPortfolio(player, portfolio) {
  try {
    globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_player_stocks_v1", JSON.stringify(portfolio));
  } catch (e) {}
}

// Cheques al Portador (Feature 3)
function redeemCheckFromInventory(player) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return false;
  
  for (let i = 0; i < inv.size; i++) {
    const item = inv.getItem(i);
    if (item && item.typeId === "minecraft:paper" && item.nameTag && item.nameTag.includes("Cheque al Portador")) {
      const match = item.nameTag.match(/\$(\d[\d,]*)/);
      if (match) {
        const val = parseInt(match[1].replace(/,/g, ""), 10);
        if (val > 0) {
          if (item.amount > 1) {
            item.amount -= 1;
            inv.setItem(i, item);
          } else {
            inv.setItem(i, undefined);
          }
          const handBal = getScore(player);
          setScore(player, handBal + val, "check_redeem");
          playBankSound(player, "income", `§a¡Cheque cobrado con éxito! Recibes $${val}.`);
          logPlayerTransaction(player.name, "Cheque", val, "Cobro de cheque al portador");
          return true;
        }
      }
    }
  }
  return false;
}

// Nómina y Pagos Programados (Feature 4)
function getPayrollsRegistry() {
  const raw = globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "bank_payrolls_v1");
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (e) { return []; }
}

function setPayrollsRegistry(payrolls) {
  try {
    globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "bank_payrolls_v1", JSON.stringify(payrolls));
  } catch (e) {}
}

// Clasificación y Privacidad (Feature 5)
function isPlayerHiddenFromLeaderboard(player) {
  if (!player) return false;
  const name = typeof player === "string" ? player : player.name;
  if (typeof player !== "string") {
    const prop = globalThis.__sqlite_get_prop_v2__("currency_addon", player, "bank_hide_from_leaderboard_v1");
    if (prop !== undefined && prop !== null) return Boolean(prop);
  }
  const registry = getGlobalAccountRegistry();
  if (registry[name] && registry[name].hidden !== undefined) {
    return Boolean(registry[name].hidden);
  }
  return false;
}

function toggleLeaderboardPrivacy(player) {
  const current = isPlayerHiddenFromLeaderboard(player);
  const next = !current;
  globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_hide_from_leaderboard_v1", next);
  
  try {
    const registry = getGlobalAccountRegistry();
    if (!registry[player.name]) {
      registry[player.name] = { savings: 0, loan: 0, lastUpdate: Date.now(), history: [] };
    }
    registry[player.name].hidden = next;
    globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "bank_accounts_registry_v2", JSON.stringify(registry));
  } catch (e) {}

  playBankSound(player, next ? "upgrade" : "error", next ? "§a👁️ Ahora estás OCULTO del Ranking" : "§a👁️ Ahora estás VISIBLE en el Ranking");
}

let lastTopSidebarTitle = "";
let lastTopSidebarSignature = "";
let estimatedServerTickMs = 50;
let lastTickSampleAt = Date.now();
let lastTelemetrySentAt = 0;
let lastBalanceSnapshotAt = 0;
let lastEconomyMaintenanceError = "";

// Intentar crear el scoreboard desde el arranque y reintentar durante la carga del mundo.
function runEconomyMaintenance(source) {
  try {
    if (ensureMoneyObjective()) {
      applyHistoricalEconomyRemediation();
      refreshTopMoneySidebar();
      processScheduledContractorPayments();
    }
    lastEconomyMaintenanceError = "";
  } catch (error) {
    const message = String(error?.message || error || "unknown").slice(0, 240);
    // Un error repetido no debe inundar el log ni impedir que otros addons sigan.
    if (message !== lastEconomyMaintenanceError) {
      lastEconomyMaintenanceError = message;
      console.warn(`[ECONOMY_MAINTENANCE] source=${source} status=failed error=${message}`);
    }
    ErrorReporter.report(error, {
      addonId: "currency_addon",
      moduleId: "main.js",
      operation: `economyMaintenance:${source}`,
      category: "runtime",
    });
  }
}

system.run(() => runEconomyMaintenance("startup"));

system.runInterval(() => {
  const now = Date.now();
  const elapsed = now - lastTickSampleAt;
  lastTickSampleAt = now;
  estimatedServerTickMs = Math.max(1, Math.round(elapsed / 20));
}, 20);

// Shared Bank & Tax Data Helpers (using global scoreboard to bypass behavior pack namespace isolation)
function getSharedValue(key, defaultValue) {
  try {
    const obj = world.scoreboard.getObjective("bank_vault") || world.scoreboard.addObjective("bank_vault", "Bank Vault");
    if (obj) {
      const val = obj.getScore(key);
      if (val !== undefined) return val;
    }
  } catch (e) {}
  try {
    const dp = globalThis.__sqlite_get_prop_v2__("currency_addon", "world", key);
    if (dp !== undefined) return Number(dp);
  } catch (e) {}
  return defaultValue;
}

function setSharedValue(key, value) {
  try {
    const obj = world.scoreboard.getObjective("bank_vault") || world.scoreboard.addObjective("bank_vault", "Bank Vault");
    if (obj) {
      obj.setScore(key, Math.floor(value));
    }
  } catch (e) {}
  try {
    globalThis.__sqlite_set_prop_v2__("currency_addon", "world", key, value);
  } catch (e) {}
}

function getVaultFunds() {
  return getSharedValue("bank_vault_funds", 0);
}
function setVaultFunds(val) {
  setSharedValue("bank_vault_funds", val);
}

function getShopBuyTaxRate() {
  return getSharedValue("tax_shop_buy_rate_v1", 5);
}
function getShopSellTaxRate() {
  return getSharedValue("tax_shop_sell_rate_v1", 5);
}
function getTransferTaxRate() {
  return getSharedValue("tax_transfer_rate_v1", 2);
}
function getWealthTaxThreshold() {
  return getSharedValue("tax_wealth_threshold_v1", 100000);
}
function getWealthTaxRate() {
  return getSharedValue("tax_wealth_rate_v1_scaled", 100) / 1000;
}
function setWealthTaxRate(val) {
  setSharedValue("tax_wealth_rate_v1_scaled", Math.round(val * 1000));
  try { globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "tax_wealth_rate_v1", val); } catch (e) {}
}
function getPredialTaxRate() {
  return getSharedValue("tax_predial_rate_v1_scaled", 50) / 1000;
}
function setPredialTaxRate(val) {
  setSharedValue("tax_predial_rate_v1_scaled", Math.round(val * 1000));
  try { globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "tax_predial_rate_v1", val); } catch (e) {}
}

// Shared Designated Funds Helpers
const DESIGNATED_FUNDS = {
  construction: { key: "bank_fund_construction", name: "🏗️ Obras y Construcción", desc: "Financiamiento de obras públicas, infraestructura y caminos" },
  events: { key: "bank_fund_events", name: "🎉 Eventos y Recompensas", desc: "Premios para torneos, competencias y festividades de la comunidad" },
  reserve: { key: "bank_fund_reserve", name: "🛡️ Reserva Económica", desc: "Respaldo y estabilidad económica para emergencias del servidor" },
  social: { key: "bank_fund_social", name: "🏛️ Servicios y Bienestar", desc: "Subsidios públicos, proyectos comunitarios y ayuda al jugador" }
};

function getDesignatedFundAmount(fundKey) {
  const fund = DESIGNATED_FUNDS[fundKey];
  if (!fund) return 0;
  return getSharedValue(fund.key, 0);
}

function setDesignatedFundAmount(fundKey, val) {
  const fund = DESIGNATED_FUNDS[fundKey];
  if (!fund) return;
  setSharedValue(fund.key, Math.max(0, Math.floor(val)));
}

function getTotalDesignatedFunds() {
  let total = 0;
  for (const k of Object.keys(DESIGNATED_FUNDS)) {
    total += getDesignatedFundAmount(k);
  }
  return total;
}

// Portal de Transparencia y Rendición de Cuentas Públicas
function getPublicStateLedger() {
  const raw = globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "bank_public_hacienda_ledger_v1");
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (e) { return []; }
}

function logPublicStateTransaction(type, amount, actor, details) {
  try {
    const ledger = getPublicStateLedger();
    ledger.unshift({
      timestamp: Date.now(),
      type: type,
      amount: Number(amount),
      actor: actor || "Gobierno",
      details: details
    });
    const trimmed = ledger.slice(0, 30);
    globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "bank_public_hacienda_ledger_v1", JSON.stringify(trimmed));
  } catch (e) {}
}

function broadcastPublicFinancialEvent(title, message) {
  try {
    const formatted = `§b§l[🏛️ HACIENDA PÚBLICA]§r §e${title}: §7${message}`;
    for (const p of world.getAllPlayers()) {
      p.sendMessage(formatted);
    }
  } catch (e) {}
}

function depositTaxRevenue(taxAmount) {
  if (taxAmount <= 0) return;
  const vaultPortion = Math.floor(taxAmount * 0.40);
  const constrPortion = Math.floor(taxAmount * 0.25);
  const eventsPortion = Math.floor(taxAmount * 0.15);
  const reservePortion = Math.floor(taxAmount * 0.10);
  const socialPortion = taxAmount - (vaultPortion + constrPortion + eventsPortion + reservePortion);

  setVaultFunds(getVaultFunds() + vaultPortion);
  setDesignatedFundAmount("construction", getDesignatedFundAmount("construction") + constrPortion);
  setDesignatedFundAmount("events", getDesignatedFundAmount("events") + eventsPortion);
  setDesignatedFundAmount("reserve", getDesignatedFundAmount("reserve") + reservePortion);
  setDesignatedFundAmount("social", getDesignatedFundAmount("social") + socialPortion);

  logPublicStateTransaction("Recaudación Fiscal", taxAmount, "Sistema", "Distribución de recaudación impositiva a fondos públicos");
}


function refreshTopMoneySidebar() {
  try {
    const moneyObj = world.scoreboard.getObjective("money");
    if (!moneyObj) return;
    const allPlayers = world.getAllPlayers();
    const onlineCount = allPlayers.length;

    const registry = getGlobalAccountRegistry();
    const playerMap = new Map();

    const participants = moneyObj.getParticipants();
    for (const p of participants) {
      const name = String(p?.displayName || p?.id || "").trim();
      if (!name || name === "commands.scoreboard.players.offlinePlayerName") continue;
      const cash = moneyObj.getScore(p) ?? 0;
      playerMap.set(name, { name, cash, savings: 0, participant: p });
    }

    for (const name of Object.keys(registry)) {
      if (name === "commands.scoreboard.players.offlinePlayerName") continue;
      const acc = registry[name];
      const savings = acc.savings ?? 0;
      const cash = acc.cash ?? 0;
      if (playerMap.has(name)) {
        playerMap.get(name).savings = savings;
      } else {
        playerMap.set(name, { name, cash, savings, participant: null });
      }
    }

    for (const p of allPlayers) {
      if (!p || !p.name) continue;
      const name = p.name;
      const cash = getScore(p);
      const savings = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", p, BANK_SAVINGS_PROPERTY) ?? 0);
      playerMap.set(name, { name, cash, savings, participant: p });
    }

    // La sidebar representa a quienes están conectados. Las identidades
    // persistidas de jugadores desconectados no tienen una entidad fiable y
    // pueden mostrarse como "Anónimo"; por eso nunca entran al top.
    const sortedList = [];
    for (const player of allPlayers) {
      const name = player.name;
      const data = playerMap.get(name) || { cash: getScore(player), savings: 0 };
      const totalAssets = Math.max(0, Math.floor((data.cash ?? 0) + (data.savings ?? 0)));

      const isHidden = isPlayerHiddenFromLeaderboard(player);

      sortedList.push({
        name,
        totalAssets,
        isHidden,
        participant: player
      });
    }

    sortedList.sort((a, b) => b.totalAssets - a.totalAssets);
    const top3 = sortedList.slice(0, 3);

    const vaultFunds = getVaultFunds();
    const sidebarTitle = `§g§l♛ RIQUEZA Y BANCA §r§8│ §3● ${onlineCount} ON`;
    const sidebarSignature = `${vaultFunds}|` + top3
      .map((entry) => `${entry.name}:${entry.totalAssets}:${entry.isHidden}`)
      .join("|");

    const now = Date.now();
    if (lastTopSidebarTitle === sidebarTitle && lastTopSidebarSignature === sidebarSignature) {
      return;
    }

    let topObj = world.scoreboard.getObjective("money_top");
    if (!topObj || lastTopSidebarTitle !== sidebarTitle) {
      try {
        if (topObj) {
          world.scoreboard.removeObjective("money_top");
        }
      } catch (e) {}

      topObj = world.scoreboard.addObjective("money_top", sidebarTitle);
      lastTopSidebarTitle = sidebarTitle;
    }

    const topParticipants = topObj.getParticipants();
    for (const tp of topParticipants) {
      try {
        topObj.removeParticipant(tp);
      } catch (e) {}
    }

    for (let i = 0; i < top3.length; i++) {
      const entry = top3[i];
      if (entry.isHidden) {
        const anonTag = `§7[Anónimo]` + " ".repeat(i);
        topObj.setScore(anonTag, entry.totalAssets);
      } else if (entry.participant) {
        topObj.setScore(entry.participant, entry.totalAssets);
      } else {
        topObj.setScore(`§e${entry.name}`, entry.totalAssets);
      }
    }

    const currentVault = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "bank_vault_funds") ?? 0);
    topObj.setScore("§b🏛 Bóveda General", currentVault);

    world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, {
      objective: topObj,
      sortOrder: ObjectiveSortOrder.Descending
    });
    lastTopSidebarSignature = sidebarSignature;

  } catch (err) {
    ErrorReporter.report(err, { addonId: "currency_addon", moduleId: "main.js", operation: "refreshTopMoneySidebar", category: "runtime" });
  }
}

// Un único respaldo periódico mantiene el objetivo y sincroniza la sidebar.
system.runInterval(() => runEconomyMaintenance("interval"), 200);

try {
  world.afterEvents.playerLeave.subscribe(() => {
    system.run(() => refreshTopMoneySidebar());
  });
} catch (e) {
  ErrorReporter.report(e, { addonId: "currency_addon", moduleId: "main.js", operation: "refreshTopPlayerLeave", category: "runtime" });
}

// Obtener balance de un jugador
function getScore(player) {
  const obj = getObjective();
  if (!obj) return 0;
  try {
    return (function(o, p){ try{return o.getScore(p) ?? 0;}catch(e){try{return o.getScore(p.name) ?? 0;}catch(e2){return 0;}} })(obj, player) ?? 0;
  } catch (e) { ErrorReporter.report(e, { addonId: "currency_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return 0;
  }
}

// Establecer balance de un jugador
function setScore(player, amount, reason = "unspecified") {
  const obj = getObjective();
  if (!obj) return false;
  const numericAmount = Number(amount);
  if (!Number.isSafeInteger(numericAmount) || numericAmount < 0 || numericAmount > MAX_SCOREBOARD_BALANCE) {
    console.warn(`[ECONOMY_TX] REJECT invalid_balance player=${player?.name || player} amount=${amount} reason=${reason}`);
    return false;
  }
  const normalizedAmount = Math.floor(numericAmount);
  try {
    try {
      obj.setScore(player, normalizedAmount);
    } catch (primaryError) {
      if (!player?.name) throw primaryError;
      obj.setScore(player.name, normalizedAmount);
    }
    const persisted = getScore(player);
    if (persisted !== normalizedAmount) {
      console.warn(`[ECONOMY_TX] REJECT write_mismatch player=${player?.name || player} expected=${normalizedAmount} actual=${persisted} reason=${reason}`);
      return false;
    }
    system.run(() => refreshTopMoneySidebar());
    return true;
  } catch (e) { ErrorReporter.report(e, { addonId: "currency_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn(`[ECONOMY_TX] REJECT write_failed player=${player?.name || player} amount=${normalizedAmount} reason=${reason} error=${e}`);
    return false;
  }
}

function saveEconomyRemediationState(state) {
  try {
    const serialized = JSON.stringify(state);
    globalThis.__sqlite_set_prop_v2__("currency_addon", "world", ECONOMY_REMEDIATION_KEY, serialized);
    return String(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", ECONOMY_REMEDIATION_KEY) || "") === serialized;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "currency_addon", moduleId: "main.js", operation: "saveEconomyRemediationState", category: "runtime" });
    return false;
  }
}

function applyHistoricalEconomyRemediation() {
  if (ECONOMY_REMEDIATION_DEDUCTIONS.size === 0) return true;
  const obj = getObjective();
  if (!obj) return false;

  let state;
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("currency_addon", "world", ECONOMY_REMEDIATION_KEY);
    state = raw ? JSON.parse(String(raw)) : null;
  } catch (e) {
    console.warn(`[ECONOMY_CRITICAL] remediation_state_invalid key=${ECONOMY_REMEDIATION_KEY}`);
    return false;
  }
  if (state?.done === true && Object.values(state.targets || {}).every((target) => target.status === "applied")) return true;

  const participants = obj.getParticipants();
  const participantByName = new Map(participants.map((participant) => [
    String(participant?.displayName || participant?.id || "").trim().toLowerCase(),
    participant,
  ]));
  // La API puede exponer participantes desconectados con el mismo nombre
  // genérico. Un jugador conectado es una identidad inequívoca y debe tener
  // prioridad al aplicar su objetivo persistido de remediación.
  for (const player of world.getAllPlayers()) {
    const normalizedName = normalizePlayerName(player?.name);
    if (normalizedName) participantByName.set(normalizedName, player);
  }

  if (!state?.targets) {
    state = { version: 1, plannedAt: new Date().toISOString(), done: false, targets: {} };
    for (const [normalizedName, remediation] of ECONOMY_REMEDIATION_DEDUCTIONS) {
      const participant = participantByName.get(normalizedName);
      if (!participant) {
        state.targets[normalizedName] = { ...remediation, status: "missing", before: null, target: null };
        continue;
      }
      const before = Math.max(0, Math.floor(obj.getScore(participant) ?? 0));
      state.targets[normalizedName] = {
        ...remediation,
        status: "planned",
        before,
        target: Number.isSafeInteger(remediation.targetBalance)
          ? remediation.targetBalance
          : Math.max(0, before - remediation.amount),
      };
    }
    // El plan absoluto se persiste primero; repetirlo tras una caída no duplica el descuento.
    if (!saveEconomyRemediationState(state)) {
      console.warn(`[ECONOMY_CRITICAL] remediation_plan_persist_failed key=${ECONOMY_REMEDIATION_KEY}`);
      return false;
    }
  }

  let stateExtended = false;
  for (const [normalizedName, remediation] of ECONOMY_REMEDIATION_DEDUCTIONS) {
    if (state.targets[normalizedName]) continue;
    state.targets[normalizedName] = { ...remediation, status: "missing", before: null, target: null };
    stateExtended = true;
  }
  if (stateExtended && !saveEconomyRemediationState(state)) return false;

  let completed = true;
  for (const [normalizedName, targetState] of Object.entries(state.targets)) {
    if (targetState.status === "applied") continue;
    const participant = participantByName.get(normalizedName);
    if (!participant) {
      targetState.status = "missing";
      saveEconomyRemediationState(state);
      completed = false;
      continue;
    }
    if (targetState.status === "missing" || !Number.isSafeInteger(targetState.target)) {
      const before = Math.max(0, Math.floor(obj.getScore(participant) ?? 0));
      const configuredTarget = ECONOMY_REMEDIATION_DEDUCTIONS.get(normalizedName)?.targetBalance;
      targetState.before = before;
      targetState.target = Number.isSafeInteger(configuredTarget)
        ? configuredTarget
        : Math.max(0, before - targetState.amount);
      targetState.status = "planned";
      // Persistir el objetivo absoluto antes de modificar el scoreboard.
      if (!saveEconomyRemediationState(state)) {
        completed = false;
        continue;
      }
    }
    if (!setScore(participant, targetState.target, "historical_fraud_remediation_v1")) {
      completed = false;
      continue;
    }
    targetState.status = "applied";
    targetState.appliedAt = new Date().toISOString();
    if (!saveEconomyRemediationState(state)) {
      completed = false;
      continue;
    }
    console.warn(`[ECONOMY_REMEDIATION] player=${targetState.player} before=${targetState.before} deduction=${targetState.amount} after=${targetState.target}`);
  }

  state.done = completed && Object.values(state.targets).every((target) => target.status === "applied");
  state.completedAt = state.done ? new Date().toISOString() : undefined;
  if (!saveEconomyRemediationState(state)) return false;
  const status = state.done ? "complete" : "pending";
  if (status !== lastRemediationStatusLog) {
    lastRemediationStatusLog = status;
    console.warn(`[ECONOMY_REMEDIATION] status=${status} key=${ECONOMY_REMEDIATION_KEY}`);
  }
  return state.done;
}

try {
  world.afterEvents.playerSpawn.subscribe(() => {
    system.run(() => applyHistoricalEconomyRemediation());
  });
} catch (e) {
  ErrorReporter.report(e, { addonId: "currency_addon", moduleId: "main.js", operation: "remediationPlayerSpawn", category: "runtime" });
}

// Añadir dinero a un jugador
function addScore(player, amount, reason = "unspecified") {
  const normalizedAmount = Number(amount);
  if (!Number.isSafeInteger(normalizedAmount) || Math.abs(normalizedAmount) > MAX_TRANSACTION_AMOUNT) {
    console.warn(`[ECONOMY_TX] REJECT invalid_delta player=${player?.name || player} amount=${amount} reason=${reason}`);
    return false;
  }
  const current = getScore(player);
  const next = current + normalizedAmount;
  if (normalizedAmount > 0 && next > MAX_OPERATIONAL_BALANCE) {
    console.warn(`[ECONOMY_TX] REJECT operational_limit player=${player?.name || player} before=${current} delta=${normalizedAmount} reason=${reason}`);
    return false;
  }
  if (!setScore(player, next, reason)) return false;
  console.warn(`[ECONOMY_TX] COMMIT player=${player?.name || player} delta=${normalizedAmount} before=${current} after=${next} reason=${reason}`);
  return true;
}

function transferScore(source, target, amount, reason = "transfer") {
  const normalizedAmount = Number(amount);
  if (!Number.isSafeInteger(normalizedAmount) || normalizedAmount <= 0 || normalizedAmount > MAX_TRANSACTION_AMOUNT) {
    return { ok: false, reason: "invalid_amount" };
  }

  const sourceKey = String(source?.id || source?.name || "");
  const targetKey = String(target?.id || target?.name || "");
  if (!sourceKey || !targetKey || sourceKey === targetKey) return { ok: false, reason: "invalid_participant" };
  if (activeMoneyTransfers.has(sourceKey) || activeMoneyTransfers.has(targetKey)) {
    return { ok: false, reason: "transaction_in_progress" };
  }

  activeMoneyTransfers.add(sourceKey);
  activeMoneyTransfers.add(targetKey);
  try {
    const sourceBefore = getScore(source);
    const targetBefore = getScore(target);
    if (sourceBefore < normalizedAmount) return { ok: false, reason: "insufficient_funds" };
    if (targetBefore + normalizedAmount > MAX_OPERATIONAL_BALANCE) return { ok: false, reason: "target_limit" };

    const transferTaxRate = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "tax_transfer_rate_v1") ?? 2);
    const taxAmount = Math.floor(normalizedAmount * (transferTaxRate / 100));
    const recipientAmount = normalizedAmount - taxAmount;

    if (!setScore(source, sourceBefore - normalizedAmount, `${reason}:debit`)) {
      return { ok: false, reason: "debit_failed" };
    }
    if (!setScore(target, targetBefore + recipientAmount, `${reason}:credit`)) {
      const rolledBack = setScore(source, sourceBefore, `${reason}:rollback`);
      return { ok: false, reason: rolledBack ? "credit_failed" : "rollback_failed" };
    }

    if (taxAmount > 0) {
      try {
        depositTaxRevenue(taxAmount);
        logPlayerTransaction(source.name, "Impuesto Transf.", taxAmount, `Impuesto de ${transferTaxRate}% al transferir a ${target.name}`);
        logPlayerTransaction(target.name, "Recibo Transf.", recipientAmount, `Recibido de ${source.name} (tras impuestos)`);
      } catch (e) {}
    } else {
      logPlayerTransaction(source.name, "Transferencia", normalizedAmount, `Enviado a ${target.name}`);
      logPlayerTransaction(target.name, "Transferencia", normalizedAmount, `Recibido de ${source.name}`);
    }

    console.warn(`[ECONOMY_TX] TRANSFER source=${source.name} target=${target.name} amount=${normalizedAmount} reason=${reason}`);
    return { ok: true };
  } finally {
    activeMoneyTransfers.delete(sourceKey);
    activeMoneyTransfers.delete(targetKey);
  }
}

function findOnlinePlayerByName(targetName) {
  const players = world.getAllPlayers();
  let target = players.find(p => p.name.toLowerCase() === targetName.toLowerCase());

  if (!target) {
    const matches = players.filter(p => p.name.toLowerCase().includes(targetName.toLowerCase()));
    if (matches.length === 1) {
      target = matches[0];
    }
  }

  return target;
}

function parseWholeAmount(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return NaN;

  // Acepta enteros simples o grupos de miles consistentes. Rechaza valores
  // ambiguos como 1.5, que antes se convertía silenciosamente en 15.
  let normalized = raw;
  if (!/^\d+$/.test(raw)) {
    const grouped = /^\d{1,3}([,. ])\d{3}(?:\1\d{3})*$/.exec(raw);
    if (!grouped) return NaN;
    normalized = raw.split(grouped[1]).join("");
  }

  const amount = Number(normalized);
  if (!Number.isSafeInteger(amount)) return NaN;
  return amount;
}

function processMoneyAdd(sender, targetName, amountStr) {
  if (!targetName || !amountStr) {
    sender.sendMessage("§b§l[§3Economía§b§l]§r §cUso: /s:moneyadd <jugador> <cantidad>");
    return;
  }

  const amount = parseWholeAmount(amountStr);
  if (isNaN(amount) || amount <= 0 || amount > MAX_TRANSACTION_AMOUNT) {
    sender.sendMessage(`§b§l[§3Economía§b§l]§r §cLa cantidad debe ser un entero entre 1 y ${MAX_TRANSACTION_AMOUNT}.`);
    return;
  }

  const target = findOnlinePlayerByName(targetName);
  if (!target) {
    sender.sendMessage("§b§l[§3Economía§b§l]§r §cJugador no encontrado online.");
    return;
  }

  if (!addScore(target, amount, `admin_add:${sender.name}`)) {
    sender.sendMessage("§b§l[§3Economía§b§l]§r §cNo se pudo confirmar la operación. No se modificó el saldo.");
    return;
  }
  sender.sendMessage(`§b§l[§3Economía§b§l]§r §7Añadidos §a$${amount} §7al saldo de §b${target.name}§7.`);
  target.sendMessage(`§b§l[§3Economía§b§l]§r §7Un administrador te ha añadido §a$${amount} §7a tu saldo.`);
}

function processMoneyRemove(sender, targetName, amountStr) {
  if (!targetName || !amountStr) {
    sender.sendMessage("§b§l[§3Economía§b§l]§r §cUso: /s:moneyremove <jugador> <cantidad>");
    return;
  }

  const amount = parseWholeAmount(amountStr);
  if (isNaN(amount) || amount <= 0 || amount > MAX_TRANSACTION_AMOUNT) {
    sender.sendMessage(`§b§l[§3Economía§b§l]§r §cLa cantidad debe ser un entero entre 1 y ${MAX_TRANSACTION_AMOUNT}.`);
    return;
  }

  const target = findOnlinePlayerByName(targetName);
  if (!target) {
    sender.sendMessage("§b§l[§3Economía§b§l]§r §cJugador no encontrado online.");
    return;
  }

  const current = getScore(target);
  const toRemove = Math.min(current, amount);

  if (toRemove <= 0) {
    sender.sendMessage(`§b§l[§3Economía§b§l]§r §7El saldo de §b${target.name} §7ya es §a$0§7.`);
    return;
  }

  if (!addScore(target, -toRemove, `admin_remove:${sender.name}`)) {
    sender.sendMessage("§b§l[§3Economía§b§l]§r §cNo se pudo confirmar la operación. No se modificó el saldo.");
    return;
  }
  sender.sendMessage(`§b§l[§3Economía§b§l]§r §7Retirados §a$${toRemove} §7del saldo de §b${target.name}§7.`);
  target.sendMessage(`§b§l[§3Economía§b§l]§r §7Un administrador te ha retirado §a$${toRemove} §7de tu saldo.`);
}

const targetCommands = ["dinero", "bal", "money", "pay", "moneyadd", "moneyremove", "banco", "bank"];

function registerCustomCommands() {
  const startupSignal = system?.beforeEvents?.startup;
  if (!startupSignal || typeof startupSignal.subscribe !== "function") {
    console.warn("[Virtual Currency Addon] startup event no disponible para custom commands.");
    return;
  }

  startupSignal.subscribe((event) => {
    const registry = event?.customCommandRegistry;
    if (!registry) {
      console.warn("[Virtual Currency Addon] customCommandRegistry no disponible en startup.");
      return;
    }

    const register = typeof registry.registerCommand === "function"
      ? registry.registerCommand.bind(registry)
      : typeof registry.register === "function"
        ? registry.register.bind(registry)
        : undefined;

    if (!register) {
      console.warn("[Virtual Currency Addon] El registry no expone registerCommand/register.");
      return;
    }

    try {
      register(
        {
          name: `${COMMAND_NAMESPACE}:money`,
          description: "Muestra tu saldo",
          permissionLevel: CommandPermissionLevel.Any,
        },
        (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Este comando solo puede usarse por jugador.");
          system.run(() => {
            handleCommand(sender, "money", ["money"]);
          });
          return commandOk("Saldo enviado.");
        }
      );
      register(
        {
          name: `${COMMAND_NAMESPACE}:bal`,
          description: "Muestra tu saldo",
          permissionLevel: CommandPermissionLevel.Any,
        },
        (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Este comando solo puede usarse por jugador.");
          system.run(() => {
            handleCommand(sender, "bal", ["bal"]);
          });
          return commandOk("Saldo enviado.");
        }
      );
      console.warn(`[Virtual Currency Addon] Registrado /${COMMAND_NAMESPACE}:bal`);
    } catch (e) { ErrorReporter.report(e, { addonId: "currency_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn(`[Virtual Currency Addon] Error registrando /${COMMAND_NAMESPACE}:bal: ` + e);
    }

    try {
      register(
        {
          name: `${COMMAND_NAMESPACE}:dinero`,
          description: "Muestra tu saldo",
          permissionLevel: CommandPermissionLevel.Any,
        },
        (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Este comando solo puede usarse por jugador.");
          system.run(() => {
            handleCommand(sender, "dinero", ["dinero"]);
          });
          return commandOk("Saldo enviado.");
        }
      );
      console.warn(`[Virtual Currency Addon] Registrado /${COMMAND_NAMESPACE}:dinero`);
    } catch (e) { ErrorReporter.report(e, { addonId: "currency_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn(`[Virtual Currency Addon] Error registrando /${COMMAND_NAMESPACE}:dinero: ` + e);
    }

    try {
      register(
        {
          name: `${COMMAND_NAMESPACE}:pay`,
          description: "Transfiere dinero",
          permissionLevel: CommandPermissionLevel.Any,
          mandatoryParameters: [
            { name: "jugador", type: CustomCommandParamType.String },
            { name: "cantidad", type: CustomCommandParamType.Integer },
          ],
        },
        (origin, jugador, cantidad) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Este comando solo puede usarse por jugador.");
          system.run(() => {
            handleCommand(sender, "pay", ["pay", String(jugador), String(cantidad)]);
          });
          return commandOk("Transferencia procesada.");
        }
      );
      register(
        {
          name: `${COMMAND_NAMESPACE}:pagar`,
          description: "Transfiere dinero",
          permissionLevel: CommandPermissionLevel.Any,
          mandatoryParameters: [
            { name: "jugador", type: CustomCommandParamType.String },
            { name: "cantidad", type: CustomCommandParamType.Integer },
          ],
        },
        (origin, jugador, cantidad) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Este comando solo puede usarse por jugador.");
          system.run(() => {
            handleCommand(sender, "pay", ["pay", String(jugador), String(cantidad)]);
          });
          return commandOk("Transferencia procesada.");
        }
      );
      console.warn(`[Virtual Currency Addon] Registrado /${COMMAND_NAMESPACE}:pay`);
    } catch (e) { ErrorReporter.report(e, { addonId: "currency_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn(`[Virtual Currency Addon] Error registrando /${COMMAND_NAMESPACE}:pay: ` + e);
    }
 
    try {
      register(
        {
          name: `${COMMAND_NAMESPACE}:moneyadd`,
          description: "Agrega dinero a un jugador",
          permissionLevel: ADMIN_PERMISSION,
          mandatoryParameters: [
            { name: "jugador", type: CustomCommandParamType.String },
            { name: "cantidad", type: CustomCommandParamType.Integer },
          ],
        },
        (origin, jugador, cantidad) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Este comando solo puede usarse por jugador.");
          system.run(() => {
            processMoneyAdd(sender, String(jugador), String(cantidad));
          });
          return commandOk("Operación procesada.");
        }
      );
      register(
        {
          name: `${COMMAND_NAMESPACE}:dineroagregar`,
          description: "Agrega dinero a un jugador",
          permissionLevel: ADMIN_PERMISSION,
          mandatoryParameters: [
            { name: "jugador", type: CustomCommandParamType.String },
            { name: "cantidad", type: CustomCommandParamType.Integer },
          ],
        },
        (origin, jugador, cantidad) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Este comando solo puede usarse por jugador.");
          system.run(() => {
            processMoneyAdd(sender, String(jugador), String(cantidad));
          });
          return commandOk("Operación procesada.");
        }
      );
      console.warn(`[Virtual Currency Addon] Registrado /${COMMAND_NAMESPACE}:moneyadd`);
    } catch (e) { ErrorReporter.report(e, { addonId: "currency_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn(`[Virtual Currency Addon] Error registrando /${COMMAND_NAMESPACE}:moneyadd: ` + e);
    }
 
    try {
      register(
        {
          name: `${COMMAND_NAMESPACE}:moneyremove`,
          description: "Retira dinero a un jugador",
          permissionLevel: ADMIN_PERMISSION,
          mandatoryParameters: [
            { name: "jugador", type: CustomCommandParamType.String },
            { name: "cantidad", type: CustomCommandParamType.Integer },
          ],
        },
        (origin, jugador, cantidad) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Este comando solo puede usarse por jugador.");
          system.run(() => {
            processMoneyRemove(sender, String(jugador), String(cantidad));
          });
          return commandOk("Operación procesada.");
        }
      );
      register(
        {
          name: `${COMMAND_NAMESPACE}:dineroremover`,
          description: "Retira dinero a un jugador",
          permissionLevel: ADMIN_PERMISSION,
          mandatoryParameters: [
            { name: "jugador", type: CustomCommandParamType.String },
            { name: "cantidad", type: CustomCommandParamType.Integer },
          ],
        },
        (origin, jugador, cantidad) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Este comando solo puede usarse por jugador.");
          system.run(() => {
            processMoneyRemove(sender, String(jugador), String(cantidad));
          });
          return commandOk("Operación procesada.");
        }
      );
      console.warn(`[Virtual Currency Addon] Registrado /${COMMAND_NAMESPACE}:moneyremove / dineroremover`);
    } catch (e) { ErrorReporter.report(e, { addonId: "currency_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn(`[Virtual Currency Addon] Error registrando /${COMMAND_NAMESPACE}:moneyremove: ` + e);
    }

    try {
      for (const name of ["banco", "bank"]) {
        register(
          {
            name: `${COMMAND_NAMESPACE}:${name}`,
            description: "Abre el menú del Banco General",
            permissionLevel: CommandPermissionLevel.Any,
          },
          (origin) => {
            const sender = origin?.sourceEntity;
            if (!sender) return commandError("Este comando solo puede usarse por jugador.");
            system.run(() => {
              handleCommand(sender, "banco", ["banco"]);
            });
            return commandOk("Banco abierto.");
          }
        );
      }
    } catch (e) { ErrorReporter.report(e, { addonId: "currency_addon", moduleId: "main.js", operation: "register-bank-command", category: "runtime" }); }
  });
}

registerCustomCommands();

// Manejador de comandos por /scriptevent
try {
  if (system && system.afterEvents && system.afterEvents.scriptEventReceive && typeof system.afterEvents.scriptEventReceive.subscribe === "function") {
    system.afterEvents.scriptEventReceive.subscribe((event) => {
      if (event.id !== "cmd") return;
      const message = String(event.message || "").trim();
      if (!message) return;
      const args = message.split(/\s+/);
      const command = args[0].toLowerCase();
      
      if (targetCommands.includes(command)) {
        const sender = event.sourceEntity;
        if (!sender || sender.typeId !== "minecraft:player") return;
        
        system.run(async () => {
          try {
            await handleCommand(sender, command, [command, ...args.slice(1)]);
          } catch (error) { ErrorReporter.report(error, { addonId: "currency_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
            console.warn(`Error ejecutando scriptevent de economía ${command}: ${error}`);
          }
        });
      }
    });
  }
} catch (e) { ErrorReporter.report(e, { addonId: "currency_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Virtual Currency Addon] ScriptEvent listener error: " + e);
}

async function handleCommand(player, command, args) {
  // Inicializamos el scoreboard si aún no existe en el primer comando
  getObjective();

  if (["dinero", "bal", "money"].includes(command)) {
    const bal = getScore(player);
    player.sendMessage(`§b§l[§3Economía§b§l]§r §7Tu saldo actual es: §a$${bal}`);
    return;
  }
  
  if (command === "pay") {
    const targetName = args[1];
    const amountStr = args[2];
    
    if (!targetName || !amountStr) {
      player.sendMessage("§b§l[§3Economía§b§l]§r §cUso: /s:pay <jugador> <cantidad>");
      return;
    }
    
    const amount = parseWholeAmount(amountStr);
    if (isNaN(amount) || amount <= 0 || amount > MAX_TRANSACTION_AMOUNT) {
      player.sendMessage(`§b§l[§3Economía§b§l]§r §cLa cantidad debe ser un entero entre 1 y ${MAX_TRANSACTION_AMOUNT}.`);
      return;
    }
    
    const senderBal = getScore(player);
    if (senderBal < amount) {
      player.sendMessage(`§b§l[§3Economía§b§l]§r §cSaldo insuficiente. Tienes §a$${senderBal} §cy deseas transferir §a$${amount}§c.`);
      return;
    }
    
    const players = world.getAllPlayers();
    let target = players.find(p => p.name.toLowerCase() === targetName.toLowerCase());
    
    if (!target) {
      const matches = players.filter(p => p.name.toLowerCase().includes(targetName.toLowerCase()));
      if (matches.length === 1) {
        target = matches[0];
      } else if (matches.length > 1) {
        player.sendMessage("§b§l[§3Economía§b§l]§r §cSe encontraron múltiples jugadores similares. Sé más específico.");
        return;
      }
    }
    
    if (!target) {
      player.sendMessage("§b§l[§3Economía§b§l]§r §cJugador no encontrado online.");
      return;
    }
    
    if (target.name === player.name) {
      player.sendMessage("§b§l[§3Economía§b§l]§r §cNo puedes transferir dinero a ti mismo.");
      return;
    }
    
    const transfer = transferScore(player, target, amount, "player_pay");
    if (!transfer.ok) {
      const messages = {
        insufficient_funds: "Saldo insuficiente.",
        loan_funds_locked: `No puedes transferir dinero prestado. Disponible para transferir: $${transfer.available ?? 0}. Amortiza tu préstamo para liberar ese saldo.`,
        target_limit: "El destinatario alcanzó el límite operativo de saldo.",
        transaction_in_progress: "Alguno de los jugadores ya tiene una transacción en curso.",
        rollback_failed: "La transferencia falló y requiere revisión administrativa inmediata.",
      };
      player.sendMessage(`§b§l[§3Economía§b§l]§r §c${messages[transfer.reason] || "No se pudo confirmar la transferencia."}`);
      return;
    }
    
    player.sendMessage(`§b§l[§3Economía§b§l]§r §7Has transferido §a$${amount} §7a §b${target.name}§7.`);
    target.sendMessage(`§b§l[§3Economía§b§l]§r §7Has recibido §a$${amount} §7de §b${player.name}§7.`);
    return;
  }
  
  if (["banco", "bank"].includes(command)) {
    openGeneralBankMenu(player);
    return;
  }
  
  if (command === "moneyadd") {
    if (!isPlayerOp(player)) {
      player.sendMessage("§b§l[§3Economía§b§l]§r §cSolo los operadores/administradores pueden añadir dinero.");
      return;
    }
    processMoneyAdd(player, args[1], args[2]);
    return;
  }
  
  if (command === "moneyremove") {
    if (!isPlayerOp(player)) {
      player.sendMessage("§b§l[§3Economía§b§l]§r §cSolo los operadores/administradores pueden remover dinero.");
      return;
    }
    processMoneyRemove(player, args[1], args[2]);
    return;
  }
}

// ==========================================
// SISTEMA DE BANCO GENERAL (Pacífico Comunitario)
// Propietario/Gobernador: ElOmar3
// ==========================================

const BANK_SAVINGS_PROPERTY = "bank_savings_v1";
const BANK_LOAN_PROPERTY = "bank_loan_v1";
// El capital entregado por un préstamo no puede convertirse en una transferencia
// entre jugadores. Se libera únicamente al amortizar la deuda correspondiente.
const BANK_LOAN_TRANSFER_LOCK_PROPERTY = "bank_loan_transfer_lock_v1";
const BANK_INTEREST_COOLDOWN_PROPERTY = "bank_interest_cooldown_v1";
const GLOBAL_INTEREST_RATE_PROPERTY = "global_bank_interest_rate_v1";
const MAX_LOAN_AMOUNT = 50000;
const LOAN_INTEREST_RATE = 1.05; // 5% de tarifa administrativa al solicitar

function getLoanTransferLock(player) {
  const loan = Math.max(0, Math.floor(Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_LOAN_PROPERTY) ?? 0)));
  if (loan <= 0) return 0;

  const stored = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_LOAN_TRANSFER_LOCK_PROPERTY));
  if (Number.isFinite(stored) && stored > 0) return Math.min(Math.floor(stored), loan);

  // Migración segura para préstamos anteriores: si aún tienen deuda, su efectivo
  // actual queda reservado hasta que amortice el préstamo.
  const migratedLock = Math.min(loan, Math.max(0, getScore(player)));
  globalThis.__sqlite_set_prop_v2__("currency_addon", player, BANK_LOAN_TRANSFER_LOCK_PROPERTY, migratedLock);
  return migratedLock;
}

function getAvailableTransferBalance(player) {
  return Math.max(0, getScore(player) - getLoanTransferLock(player));
}

function releaseLoanTransferLock(player, payment, nextLoan) {
  if (nextLoan <= 0) {
    globalThis.__sqlite_set_prop_v2__("currency_addon", player, BANK_LOAN_TRANSFER_LOCK_PROPERTY, undefined);
    return;
  }
  const lock = getLoanTransferLock(player);
  globalThis.__sqlite_set_prop_v2__("currency_addon", player, BANK_LOAN_TRANSFER_LOCK_PROPERTY, Math.max(0, lock - Math.max(0, payment)));
}

// El efectivo ya vive de forma autoritativa en el scoreboard `money`. Nunca
// se replica en la libreta JSON: cada cambio de saldo reserializaba el
// registro mundial completo y generaba una tormenta de dynamic properties.

function updateGlobalAccountRegistry(playerName, savings, loan, cash = null) {
  try {
    let registry = {};
    const raw = globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "bank_accounts_registry_v2");
    if (raw) registry = JSON.parse(raw);

    const previous = registry[playerName];
    const nextSavings = Number(savings);
    const nextLoan = Number(loan);
    let nextCbu = previous?.cbu;
    let nextAlias = previous?.alias;

    try {
      const p = world.getAllPlayers().find(pl => pl.name.toLowerCase() === playerName.toLowerCase());
      if (p) {
        nextCbu = getPlayerCBU(p);
        nextAlias = getPlayerAlias(p);
      }
    } catch (err) {}

    const accountChanged = !previous
      || Number(previous.savings) !== nextSavings
      || Number(previous.loan) !== nextLoan
      || previous.cbu !== nextCbu
      || previous.alias !== nextAlias;
    if (!accountChanged) return;

    const now = Date.now();

    const account = previous || { savings: 0, loan: 0, lastUpdate: now, history: [] };
    account.savings = nextSavings;
    account.loan = nextLoan;
    account.cbu = nextCbu;
    account.alias = nextAlias;
    account.lastUpdate = now;
    registry[playerName] = account;
    globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "bank_accounts_registry_v2", JSON.stringify(registry));
  } catch (e) {
    console.error("Error actualizando registro global de cuentas: " + e);
  }
}

function logPlayerTransaction(playerName, type, amount, details) {
  try {
    let registry = {};
    const raw = globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "bank_accounts_registry_v2");
    if (raw) registry = JSON.parse(raw);
    
    if (!registry[playerName]) {
      registry[playerName] = { savings: 0, loan: 0, lastUpdate: Date.now(), history: [] };
    }
    
    if (!registry[playerName].history) {
      registry[playerName].history = [];
    }
    
    registry[playerName].history.unshift({
      timestamp: Date.now(),
      type: type,
      amount: Number(amount),
      details: details
    });
    
    if (registry[playerName].history.length > 5) {
      registry[playerName].history = registry[playerName].history.slice(0, 5);
    }
    
    globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "bank_accounts_registry_v2", JSON.stringify(registry));
  } catch (e) {
    console.error("Error al registrar transacción: " + e);
  }
}

function getGlobalAccountRegistry() {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "bank_accounts_registry_v2");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {};
}

function setPlayerBankDetails(player, savings, loan) {
  globalThis.__sqlite_set_prop_v2__("currency_addon", player, BANK_SAVINGS_PROPERTY, savings);
  globalThis.__sqlite_set_prop_v2__("currency_addon", player, BANK_LOAN_PROPERTY, loan);
  updateGlobalAccountRegistry(player.name, savings, loan, getScore(player));
}

// Sincronización al entrar al juego
world.afterEvents.playerSpawn.subscribe((event) => {
  const player = event.player;
  if (!player || !player.isValid) return;
  
  const registry = getGlobalAccountRegistry();
  const name = player.name;
  
  if (registry[name]) {
    // Si los datos globales difieren, resolver manteniendo el valor válido de ahorros
    const targetSavings = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_SAVINGS_PROPERTY) ?? 0);
    const targetLoan = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_LOAN_PROPERTY) ?? 0);
    const registrySavings = Number(registry[name].savings ?? 0);
    const resolvedSavings = Math.max(targetSavings, registrySavings);
    const resolvedLoan = registry[name].loan !== undefined ? Number(registry[name].loan) : targetLoan;
    
    if (resolvedSavings !== targetSavings || resolvedLoan !== targetLoan) {
      globalThis.__sqlite_set_prop_v2__("currency_addon", player, BANK_SAVINGS_PROPERTY, resolvedSavings);
      globalThis.__sqlite_set_prop_v2__("currency_addon", player, BANK_LOAN_PROPERTY, resolvedLoan);
    }
    updateGlobalAccountRegistry(name, resolvedSavings, resolvedLoan, getScore(player));
  } else {
    // Si es nuevo, inicializar en el registro
    const savings = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_SAVINGS_PROPERTY) ?? 0);
    const loan = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_LOAN_PROPERTY) ?? 0);
    updateGlobalAccountRegistry(name, savings, loan);
  }
});

// Mapa para rastrear el dinero en mano y deducir préstamos automáticamente
const playerLastMoneyMap = new Map();

// Bucle periódico: Deducir préstamos e interés diario
system.runInterval(() => {
  const interestRate = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", GLOBAL_INTEREST_RATE_PROPERTY) ?? 1.5);
  const now = Date.now();
  
  for (const player of world.getAllPlayers()) {
    try {
      if (!player.isValid) continue;
      
      const nameLower = player.name.toLowerCase();
      const handBal = getScore(player);
      
      // Sincronizar saldo en el registro global
      const tempSavings = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_SAVINGS_PROPERTY) ?? 0);
      const tempLoan = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_LOAN_PROPERTY) ?? 0);
      updateGlobalAccountRegistry(player.name, tempSavings, tempLoan, handBal);
      
      // 1. Detección automática de ingresos y deducción de préstamos (20% de ganancia)
      const lastBal = playerLastMoneyMap.get(nameLower) ?? handBal;
      playerLastMoneyMap.set(nameLower, handBal);
      
      const skipUntil = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, "bank_skip_repay_until") ?? 0);
      const loan = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_LOAN_PROPERTY) ?? 0);
      
      if (loan > 0 && handBal > lastBal) {
        if (now >= skipUntil) {
          const gain = handBal - lastBal;
          const payment = Math.min(loan, Math.floor(gain * 0.20));
          if (payment > 0) {
            // Amortizar
            const nextHandBal = handBal - payment;
            setScore(player, nextHandBal, "bank_loan_repayment_auto");
            playerLastMoneyMap.set(nameLower, nextHandBal); // Actualizar para evitar bucles
            
            const nextLoan = loan - payment;
            setPlayerBankDetails(player, Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_SAVINGS_PROPERTY) ?? 0), nextLoan);
            releaseLoanTransferLock(player, payment, nextLoan);
            logPlayerTransaction(player.name, "Deducción Préstamo (Auto)", payment, "Deducción automática de 20% de ganancias");
            
            // Depositar el cobro de la deuda en la bóveda del banco
            try {
              const currentVault = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "bank_vault_funds") ?? 0);
              globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "bank_vault_funds", currentVault + payment);
            } catch (e) {}
            
            player.sendMessage(`§b§l[§6Banco§b§l]§r §eSe ha descontado §c$${payment}§e (20% de tus ingresos) para abonar a tu préstamo. Deuda restante: §c$${nextLoan}§e.`);
          }
        } else {
          // Grace period check (eg: after withdrawal) -> skip collection and update base balance
          playerLastMoneyMap.set(nameLower, handBal);
        }
      }
      
      // 2. Interés Diario sobre Ahorros (cada 24 horas = 86400000 ms) basado en el saldo mínimo
      const savings = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_SAVINGS_PROPERTY) ?? 0);
      if (savings > 0) {
        let minSavings = globalThis.__sqlite_get_prop_v2__("currency_addon", player, "bank_min_savings_v1");
        if (minSavings === undefined || minSavings === null) {
          minSavings = savings;
          globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_min_savings_v1", minSavings);
        } else {
          minSavings = Number(minSavings);
          if (savings < minSavings) {
            minSavings = savings;
            globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_min_savings_v1", minSavings);
          }
        }

        const lastInterest = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_INTEREST_COOLDOWN_PROPERTY) ?? 0);
        if (now - lastInterest >= 24 * 60 * 60 * 1000) {
          const vaultFunds = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "bank_vault_funds") ?? 0);
          const maxInterestAllowed = Math.min(vaultFunds, Math.min(5000, Math.floor(minSavings * (interestRate / 100))));
          
          if (maxInterestAllowed > 0) {
            setPlayerBankDetails(player, savings + maxInterestAllowed, Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_LOAN_PROPERTY) ?? 0));
            logPlayerTransaction(player.name, "Interés", maxInterestAllowed, "Interés diario ganado en ahorros");
            try {
              globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "bank_vault_funds", Math.max(0, vaultFunds - maxInterestAllowed));
            } catch (e) {}
            player.sendMessage(`§b§l[§6Banco§b§l]§r §a¡Has recibido §e$${maxInterestAllowed}§a de interés diario (${interestRate}%) basado en tu saldo mínimo de $${minSavings} de las últimas 24 horas!`);
          } else if (minSavings > 0 && vaultFunds <= 0) {
            player.sendMessage("§b§l[§6Banco§b§l]§r §cEl Banco General no pudo pagarte tus intereses hoy por falta de liquidez en sus fondos de reserva.");
          }
          globalThis.__sqlite_set_prop_v2__("currency_addon", player, BANK_INTEREST_COOLDOWN_PROPERTY, now);
          globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_min_savings_v1", savings + maxInterestAllowed); // Reset minimum savings for the next period
        }
      } else {
        globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_min_savings_v1", 0);
      }

      // 3. Impuesto a la Riqueza (cada 24 horas)
      const wealthThreshold = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "tax_wealth_threshold_v1") ?? 100000);
      const wealthTaxRate = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "tax_wealth_rate_v1") ?? 0.1);
      const totalAssets = handBal + savings;
      
      const rawLastWealth = globalThis.__sqlite_get_prop_v2__("currency_addon", player, "bank_wealth_tax_cooldown_v1");
      if (rawLastWealth === undefined) {
        globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_wealth_tax_cooldown_v1", now);
      } else {
        const lastWealthTax = Number(rawLastWealth);
        if (lastWealthTax > 0 && (now - lastWealthTax >= 24 * 60 * 60 * 1000)) {
          if (totalAssets > wealthThreshold && wealthTaxRate > 0) {
            const taxCharged = Math.floor(totalAssets * (wealthTaxRate / 100));
            if (taxCharged > 0) {
              if (handBal >= taxCharged) {
                setScore(player, handBal - taxCharged, "tax_wealth");
              } else {
                setScore(player, 0, "tax_wealth");
                const remainingTax = taxCharged - handBal;
                const nextSavings = Math.max(0, savings - remainingTax);
                setPlayerBankDetails(player, nextSavings, Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_LOAN_PROPERTY) ?? 0));
              }
              
              try {
                depositTaxRevenue(taxCharged);
              } catch (e) {}
              
              logPlayerTransaction(player.name, "Impuesto Riqueza", taxCharged, `Cobro de ${wealthTaxRate}% por patrimonio mayor a $${wealthThreshold}`);
              player.sendMessage(`§b§l[§6Banco§b§l]§r §cSe te ha cobrado un Impuesto a la Riqueza de §e$${taxCharged}§c (patrimonio total: $${totalAssets}).`);
            }
          }
          globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_wealth_tax_cooldown_v1", now);
        }
      }

      // 4. Impuesto Predial (cada 24 horas)
      const rawLastPredial = globalThis.__sqlite_get_prop_v2__("currency_addon", player, "bank_predial_tax_cooldown_v1");
      if (rawLastPredial === undefined) {
        globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_predial_tax_cooldown_v1", now);
      } else {
        const lastPredialTax = Number(rawLastPredial);
        if (lastPredialTax > 0 && (now - lastPredialTax >= 24 * 60 * 60 * 1000)) {
          let totalArea = 0;
          try {
            const rawZones = globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "protecciones_db");
            if (rawZones) {
              const zones = JSON.parse(rawZones);
              if (Array.isArray(zones)) {
                for (const z of zones) {
                  if (!z.isAdmin && z.owner && z.owner.toLowerCase() === player.name.toLowerCase()) {
                    const dx = Math.abs(z.max.x - z.min.x) + 1;
                    const dz = Math.abs(z.max.z - z.min.z) + 1;
                    totalArea += (dx * dz);
                  }
                }
              }
            }
          } catch (err) {}
          
          const predialRate = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "tax_predial_rate_v1") ?? 0.05);
          if (totalArea > 0 && predialRate > 0) {
            const taxCharged = Math.floor(totalArea * predialRate);
            if (taxCharged > 0) {
              if (handBal >= taxCharged) {
                setScore(player, handBal - taxCharged, "tax_predial");
              } else {
                setScore(player, 0, "tax_predial");
                const remainingTax = taxCharged - handBal;
                const nextSavings = Math.max(0, savings - remainingTax);
                setPlayerBankDetails(player, nextSavings, Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_LOAN_PROPERTY) ?? 0));
              }
              
              try {
                depositTaxRevenue(taxCharged);
              } catch (e) {}
              
              logPlayerTransaction(player.name, "Impuesto Predial", taxCharged, `Cobro predial por ${totalArea} bloques protegidos`);
              player.sendMessage(`§b§l[§6Banco§b§l]§r §cSe te ha cobrado un Impuesto Predial (Territorial) de §e$${taxCharged}§c por poseer §e${totalArea}§c bloques de terreno protegido.`);
            }
          }
          globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_predial_tax_cooldown_v1", now);
        }
      }
    } catch (e) {
      ErrorReporter.report(e, { addonId: "currency_addon", moduleId: "main.js", operation: "bank_player_loop", category: "runtime" });
    }
  }
}, 100); // Corre cada 5 segundos (100 ticks)

// Diálogo: Inversión a Plazo Fijo (Certificado de Depósito)
function openBankFixedDepositDialog(player) {
  const cd = getFixedDeposit(player);
  const handBal = getScore(player);
  const now = Date.now();

  if (cd) {
    const isMatured = now >= cd.unlockAt;
    const remainingDays = Math.max(0, Math.ceil((cd.unlockAt - now) / (24 * 60 * 60 * 1000)));
    const totalEarnings = Math.floor(cd.amount * (cd.rate / 100) * cd.days);
    const totalPayout = cd.amount + totalEarnings;

    const form = new ActionFormData()
      .title("🔒 Inversión a Plazo Fijo")
      .body(`§7Detalles de tu Inversión Activa:\n\n` +
            `§7- Monto Invertido: §a$${cd.amount}\n` +
            `§7- Duración Elegida: §e${cd.days} Días\n` +
            `§7- Rendimiento Diario: §b${cd.rate}%\n` +
            `§7- Ganancia Estimada: §a+$${totalEarnings}\n` +
            `§7- Retorno Total al Vencimiento: §g$${totalPayout}\n` +
            `§7- Estado: ${isMatured ? "§a¡VENCIDO Y LISTO!" : `§cBloqueado (${remainingDays} días restantes)`}`);

    if (isMatured) {
      form.button("🔓 Cobrar Inversión ($" + totalPayout + ")");
    } else {
      form.button("⚠️ Cancelar Anticipadamente (Pierdes Intereses)");
    }
    form.button("🔙 Volver");

    form.show(player).then((res) => {
      if (res.canceled) return;
      if (res.selection === 0) {
        if (isMatured) {
          setScore(player, handBal + totalPayout, "bank_cd_claim");
          setFixedDeposit(player, null);
          playBankSound(player, "upgrade", `§a¡Inversión cobrada! Recibes $${totalPayout}`);
          logPlayerTransaction(player.name, "Plazo Fijo", totalPayout, `Cobro de inversión a ${cd.days} días`);
        } else {
          setScore(player, handBal + cd.amount, "bank_cd_cancel");
          setFixedDeposit(player, null);
          playBankSound(player, "error", `§cInversión cancelada. Se devolvió tu capital de $${cd.amount}.`);
          logPlayerTransaction(player.name, "Plazo Fijo", cd.amount, "Cancelación anticipada");
        }
      } else {
        openGeneralBankMenu(player);
      }
    }).catch(() => {});
  } else {
    const modal = new ModalFormData()
      .title("➕ Crear Plazo Fijo")
      .textField(`Monto a invertir (Disponible: $${handBal}):`, "Monto")
      .dropdown("Selecciona el Plazo de Inversión:", [
        "3 Días (3.0% diario)",
        "7 Días (4.0% diario)",
        "14 Días (5.0% diario)"
      ]);

    modal.show(player).then((res) => {
      if (res.canceled) return;
      const amount = Math.floor(Number(res.formValues[0]) || 0);
      const planIdx = Number(res.formValues[1]) || 0;

      if (amount <= 0 || isNaN(amount) || amount > handBal) {
        playBankSound(player, "error", "§cMonto de inversión inválido o saldo insuficiente.");
        return;
      }

      const plans = [
        { days: 3, rate: 3.0 },
        { days: 7, rate: 4.0 },
        { days: 14, rate: 5.0 }
      ];
      const plan = plans[planIdx] || plans[0];
      const unlockAt = Date.now() + (plan.days * 24 * 60 * 60 * 1000);

      if (setScore(player, handBal - amount, "bank_cd_create")) {
        setFixedDeposit(player, {
          amount,
          days: plan.days,
          rate: plan.rate,
          lockedAt: Date.now(),
          unlockAt
        });
        playBankSound(player, "upgrade", `§aInversión iniciada: $${amount} a ${plan.days} días (${plan.rate}% diario).`);
        logPlayerTransaction(player.name, "Plazo Fijo", amount, `Nueva inversión a ${plan.days} días`);
      }
    }).catch(() => {});
  }
}

// Diálogo: Banca de Clan
function openBankClanMenu(player) {
  const tags = player.getTags();
  const clanTag = tags.find(t => t.startsWith("clan:")) || tags.find(t => t.startsWith("clan_"));
  const clanName = clanTag ? clanTag.replace(/^clan[:_]/, "").trim() : "General";

  const registry = getClanAccountRegistry();
  if (!registry[clanName]) {
    registry[clanName] = { balance: 0, history: [] };
  }
  const clanData = registry[clanName];
  const handBal = getScore(player);
  const isLeader = tags.includes("clan_leader") || tags.includes("clan_lider") || player.name.toLowerCase() === "elomar3";

  const form = new ActionFormData()
    .title(`🛡️ Fondo del Clan (${clanName})`)
    .body(`§7Tesorería comunitaria del clan §e${clanName}§7.\n\n` +
          `§7- Fondo del Clan: §a$${clanData.balance}\n` +
          `§7- Tu Saldo en Mano: §b$${handBal}\n` +
          `§7- Tu Rango en Clan: ${isLeader ? "§aLíder" : "§7Miembro"}\n\n` +
          `§8Cualquier miembro puede aportar fondos; los líderes pueden realizar retiros.`)
    .button("📥 Depositar al Clan")
    .button("📤 Retirar del Clan (Líder)")
    .button("🔙 Volver");

  form.show(player).then((res) => {
    if (res.canceled) return;
    if (res.selection === 0) {
      const modal = new ModalFormData()
        .title("📥 Depositar al Clan")
        .textField(`Monto a aportar (Disponible: $${handBal}):`, "Monto");

      modal.show(player).then((r) => {
        if (r.canceled) return;
        const val = Math.floor(Number(r.formValues[0]) || 0);
        if (val <= 0 || isNaN(val) || val > handBal) {
          playBankSound(player, "error", "§cMonto inválido.");
          return;
        }
        if (setScore(player, handBal - val, "clan_deposit")) {
          clanData.balance += val;
          clanData.history.unshift({ timestamp: Date.now(), player: player.name, amount: val, type: "deposit" });
          if (clanData.history.length > 5) clanData.history = clanData.history.slice(0, 5);
          registry[clanName] = clanData;
          setClanAccountRegistry(registry);
          playBankSound(player, "deposit", `§aAportaste $${val} al fondo del clan ${clanName}.`);
        }
      }).catch(() => {});
    } else if (res.selection === 1) {
      if (!isLeader) {
        playBankSound(player, "error", "§cSolo los líderes del clan pueden retirar fondos.");
        return;
      }
      const modal = new ModalFormData()
        .title("📤 Retirar del Clan")
        .textField(`Monto a retirar (Fondo disponible: $${clanData.balance}):`, "Monto");

      modal.show(player).then((r) => {
        if (r.canceled) return;
        const val = Math.floor(Number(r.formValues[0]) || 0);
        if (val <= 0 || isNaN(val) || val > clanData.balance) {
          playBankSound(player, "error", "§cMonto inválido o fondos insuficientes.");
          return;
        }
        if (setScore(player, handBal + val, "clan_withdraw")) {
          clanData.balance -= val;
          clanData.history.unshift({ timestamp: Date.now(), player: player.name, amount: val, type: "withdraw" });
          if (clanData.history.length > 5) clanData.history = clanData.history.slice(0, 5);
          registry[clanName] = clanData;
          setClanAccountRegistry(registry);
          playBankSound(player, "withdraw", `§aRetiraste $${val} del fondo del clan ${clanName}.`);
        }
      }).catch(() => {});
    } else {
      openGeneralBankMenu(player);
    }
  }).catch(() => {});
}

function parseQuantityHelper(inputStr) {
  if (!inputStr) return NaN;
  let str = String(inputStr).trim().toLowerCase().replace(/,/g, "");
  let multiplier = 1;
  if (str.endsWith("k")) {
    multiplier = 1000;
    str = str.slice(0, -1).trim();
  } else if (str.endsWith("m")) {
    multiplier = 1000000;
    str = str.slice(0, -1).trim();
  } else if (str.endsWith("b")) {
    multiplier = 1000000000;
    str = str.slice(0, -1).trim();
  }
  const val = Number(str);
  if (isNaN(val) || val <= 0) return NaN;
  return Math.floor(val * multiplier);
}

// Diálogo: Bolsa de Valores (Stock Market)
function openBankStockMarketDialog(player) {
  const market = getStockMarketData();
  const portfolio = getPlayerPortfolio(player);
  const handBal = getScore(player);

  let body = `§l§6MERCADO DE ACCIONES\n\n` +
             `§7• Costo = §eCantidad × Precio de Acción\n` +
             `§7• Pagas con: §aEfectivo + Ahorros\n\n` +
             `§6COTIZACIÓN Y TU PORTAFOLIO:\n`;
  for (const key of Object.keys(market)) {
    if (key === "lastUpdate") continue;
    const sec = market[key];
    const userShares = portfolio[key] || 0;
    const changeColor = sec.change >= 0 ? "§a+" : "§c";
    body += `§f${sec.name}: §e$${sec.price} §8(${changeColor}${sec.change}%§8) | §b${userShares.toLocaleString()} acc.\n`;
  }

  const form = new ActionFormData()
    .title("📈 Bolsa de Valores")
    .body(body)
    .button("🛒 Comprar Acciones")
    .button("💰 Vender Acciones")
    .button("❓ ¿Cómo funcionan las acciones?")
    .button("🔙 Volver");

  form.show(player).then((res) => {
    if (res.canceled) return;
    if (res.selection === 0) {
      system.run(() => {
        if (!player || !player.isValid) return;
        const handCash = getScore(player);
        const bankSavings = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_SAVINGS_PROPERTY) ?? 0);
        const totalAvailable = handCash + bankSavings;
        const modal = new ModalFormData()
          .title("🛒 Comprar Acciones")
          .dropdown("Selecciona el Sector:", ["Minería ($" + market.mining.price + ")", "Agricultura ($" + market.farming.price + ")", "Construcción ($" + market.building.price + ")", "Comercio ($" + market.trade.price + ")"])
          .textField(`Cantidad de acciones (Disponible total: $${totalAvailable.toLocaleString()}):`, "Ej: 1000, 100k, 1m");

        modal.show(player).then((r) => {
          if (r.canceled) return;
          const sectorKeys = ["mining", "farming", "building", "trade"];
          const sectorKey = sectorKeys[r.formValues[0]] || "mining";
          const qty = parseQuantityHelper(r.formValues[1]);
          const unitPrice = market[sectorKey].price;
          const totalCost = qty * unitPrice;

          if (isNaN(qty) || qty <= 0) {
            playBankSound(player, "error", "§cIngresa una cantidad válida (Ej: 100, 100k, 1m).");
            return;
          }

          const handCash = getScore(player);
          const bankSavings = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_SAVINGS_PROPERTY) ?? 0);
          const totalAvailable = handCash + bankSavings;

          if (totalCost > totalAvailable) {
            playBankSound(player, "error", `§cDinero insuficiente. Se requieren $${totalCost.toLocaleString()} para ${qty.toLocaleString()} acciones (Disponible total: $${totalAvailable.toLocaleString()}).`);
            return;
          }

          // Deducir primero de mano, y el remanente de ahorros bancarios si es necesario
          let paidFromHand = Math.min(handCash, totalCost);
          let paidFromSavings = totalCost - paidFromHand;

          let success = true;
          if (paidFromHand > 0) {
            success = setScore(player, handCash - paidFromHand, "buy_stocks");
          }
          if (success && paidFromSavings > 0) {
            const nextSavings = bankSavings - paidFromSavings;
            setPlayerBankDetails(player, nextSavings, Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_LOAN_PROPERTY) ?? 0));
          }

          if (success) {
            portfolio[sectorKey] = (portfolio[sectorKey] || 0) + qty;
            setPlayerPortfolio(player, portfolio);
            playBankSound(player, "upgrade", `§aCompraste ${qty.toLocaleString()} acciones de ${market[sectorKey].name} por $${totalCost.toLocaleString()}.`);
            logPlayerTransaction(player.name, "Bolsa", totalCost, `Compra de ${qty} acc. (${sectorKey})`);
          } else {
            playBankSound(player, "error", "§cError al procesar el pago de acciones.");
          }
        }).catch(() => {});
      });
    } else if (res.selection === 1) {
      system.run(() => {
        if (!player || !player.isValid) return;
        const currentHandBal = getScore(player);
        const modal = new ModalFormData()
          .title("💰 Vender Acciones")
          .dropdown("Selecciona el Sector:", [
            `Minería (Tienes: ${(portfolio.mining || 0).toLocaleString()})`,
            `Agricultura (Tienes: ${(portfolio.farming || 0).toLocaleString()})`,
            `Construcción (Tienes: ${(portfolio.building || 0).toLocaleString()})`,
            `Comercio (Tienes: ${(portfolio.trade || 0).toLocaleString()})`
          ])
          .textField("Cantidad a vender:", "Ej: 1000, 100k, 1m");

        modal.show(player).then((r) => {
          if (r.canceled) return;
          const sectorKeys = ["mining", "farming", "building", "trade"];
          const sectorKey = sectorKeys[r.formValues[0]] || "mining";
          const qty = parseQuantityHelper(r.formValues[1]);
          const currentOwned = portfolio[sectorKey] || 0;
          const unitPrice = market[sectorKey].price;
          const totalEarnings = qty * unitPrice;

          if (isNaN(qty) || qty <= 0) {
            playBankSound(player, "error", "§cIngresa una cantidad válida (Ej: 100, 100k, 1m).");
            return;
          }

          if (qty > currentOwned) {
            playBankSound(player, "error", `§cNo posees suficientes acciones. Tienes ${currentOwned.toLocaleString()} acciones en este sector.`);
            return;
          }

          if (setScore(player, currentHandBal + totalEarnings, "sell_stocks")) {
            portfolio[sectorKey] = currentOwned - qty;
            setPlayerPortfolio(player, portfolio);
            playBankSound(player, "income", `§aVendiste ${qty.toLocaleString()} acciones de ${market[sectorKey].name} por $${totalEarnings.toLocaleString()}.`);
            logPlayerTransaction(player.name, "Bolsa", totalEarnings, `Venta de ${qty} acc. (${sectorKey})`);
          } else {
            playBankSound(player, "error", "§cError al acreditación de venta de acciones.");
          }
        }).catch(() => {});
      });
    } else if (res.selection === 2) {
      system.run(() => {
        if (!player || !player.isValid) return;
        const formInfo = new ActionFormData()
          .title("❓ ¿Cómo funcionan las Acciones?")
          .body(`§l§eGUÍA DEL MERCADO DE ACCIONES\n\n` +
                `§61. ¿Qué es una acción?§r\n` +
                `Es una pequeña parte de propiedad de un sector comercial del servidor (Minería, Agricultura, Construcción o Comercio).\n\n` +
                `§62. ¿Cómo se calcula el precio de compra?§r\n` +
                `Si la acción de Minería vale §e$105/acc§7 y compras §e100,000 acciones§7 (100k), el costo total es:\n` +
                `§a100,000 × $105 = $10,500,000§7.\n\n` +
                `§63. ¿De dónde se cobra el dinero?§r\n` +
                `El sistema busca primero dinero en tu mano (efectivo). Si no alcanza, toma la diferencia de tu Cuenta de Ahorro bancaria automáticamente.\n\n` +
                `§64. ¿Cómo gano dinero?§r\n` +
                `Los precios cambian según la actividad económica del servidor. Compras barato (ej: $98) y vendes cuando el precio suba (ej: $120) para obtener ganancias.\n\n` +
                `§65. Abreviaciones de cantidad:§r\n` +
                `Puedes escribir sufijos para facilitar la compra:\n` +
                `• §e1k§7 = 1,000 acciones\n` +
                `• §e100k§7 = 100,000 acciones\n` +
                `• §e1m§7 = 1,000,000 acciones`)
          .button("🔙 Volver al Mercado de Acciones");

        formInfo.show(player).then(() => {
          system.run(() => openBankStockMarketDialog(player));
        }).catch(() => {});
      });
    } else {
      system.run(() => openGeneralBankMenu(player));
    }
  }).catch(() => {});
}

// Diálogo: Cheques de Pago al Portador
function openBankCheckDialog(player) {
  const handBal = getScore(player);

  const form = new ActionFormData()
    .title("🧾 Cheques de Pago al Portador")
    .body(`§7Los cheques de pago son documentos físicos que puedes guardar, regalar o comerciar.\n\n` +
          `§7- Tu Saldo en Mano: §a$${handBal}\n\n` +
          `§8Cualquier jugador que lleve el cheque en su inventario puede cobrarlo en el banco.`)
    .button("📜 Emitir Nuevo Cheque")
    .button("💵 Cobrar Cheque de Inventario")
    .button("🔙 Volver");

  form.show(player).then((res) => {
    if (res.canceled) return;
    if (res.selection === 0) {
      const modal = new ModalFormData()
        .title("📜 Emitir Cheque")
        .textField(`Monto del cheque (Disponible: $${handBal}):`, "Monto");

      modal.show(player).then((r) => {
        if (r.canceled) return;
        const val = Math.floor(Number(r.formValues[0]) || 0);
        const currentHandBal = getScore(player);
        if (val <= 0 || isNaN(val) || val > currentHandBal) {
          playBankSound(player, "error", "§cMonto inválido o dinero insuficiente.");
          return;
        }
        const transferable = getAvailableTransferBalance(player);
        if (val > transferable) {
          playBankSound(player, "error", `§cNo puedes emitir un cheque con dinero prestado. Disponible: $${transferable}.`);
          return;
        }
        const inv = player.getComponent("minecraft:inventory")?.container;
        if (!inv || inv.emptySlotsCount === 0) {
          playBankSound(player, "error", "§cTu inventario está lleno. Necesitas al menos 1 espacio libre.");
          return;
        }
        if (setScore(player, currentHandBal - val, "check_issue")) {
          try {
            const checkItem = new ItemStack("minecraft:paper", 1);
            checkItem.nameTag = `§f§lCheque al Portador (§a$${val}§f)`;
            checkItem.setLore([`§7Emitido por: §e${player.name}`, `§7Válido para cobro en el Banco General.`]);
            inv.addItem(checkItem);
            playBankSound(player, "upgrade", `§a¡Cheque emitido por $${val}! Añadido a tu inventario.`);
            logPlayerTransaction(player.name, "Cheque", val, "Emisión de cheque al portador");
          } catch (e) {
            setScore(player, currentHandBal, "check_error_rollback");
            playBankSound(player, "error", "§cError generando el cheque físico.");
          }
        }
      }).catch(() => {});
    } else if (res.selection === 1) {
      if (!redeemCheckFromInventory(player)) {
        playBankSound(player, "error", "§cNo tienes ningún cheque válido en tu inventario.");
      }
    } else {
      openGeneralBankMenu(player);
    }
  }).catch(() => {});
}

// Diálogo: Nómina y Pagos Programados
function openBankPayrollDialog(player) {
  const payrolls = getPayrollsRegistry();
  const handBal = getScore(player);
  const myPayrolls = payrolls.filter(p => p.employer === player.name || p.employee === player.name);

  let body = `§l§6NÓMINA Y SUELDOS AUTOMÁTICOS\n\n`;
  if (myPayrolls.length === 0) {
    body += `§7No tienes contratos de nómina o sueldos activos.\n`;
  } else {
    for (const p of myPayrolls) {
      const isEmployer = p.employer === player.name;
      body += `§7- ${isEmployer ? "§cPagando a" : "§aRecibiendo de"} §e${isEmployer ? p.employee : p.employer}§7: §b$${p.amount} diarios\n`;
    }
  }
  body += `\n§8Los sueldos se procesan automáticamente cada 24 horas.`;

  const form = new ActionFormData()
    .title("💸 Nómina de Sueldos")
    .body(body)
    .button("➕ Registrar Nuevo Sueldo")
    .button("❌ Cancelar Contrato de Nómina")
    .button("🔙 Volver");

  form.show(player).then((res) => {
    if (res.canceled) return;
    if (res.selection === 0) {
      const players = world.getAllPlayers().filter(p => p.name !== player.name);
      if (players.length === 0) {
        playBankSound(player, "error", "§cNo hay otros jugadores en línea para contratar.");
        return;
      }
      const playerNames = players.map(p => p.name);
      const modal = new ModalFormData()
        .title("➕ Registrar Sueldo")
        .dropdown("Selecciona al Empleado:", playerNames)
        .textField("Sueldo diario a pagar ($):", "Monto");

      modal.show(player).then((r) => {
        if (r.canceled) return;
        const targetName = playerNames[r.formValues[0]];
        const amount = Math.floor(Number(r.formValues[1]) || 0);

        if (amount <= 0 || isNaN(amount)) {
          playBankSound(player, "error", "§cMonto de sueldo inválido.");
          return;
        }
        payrolls.push({
          id: Date.now().toString(),
          employer: player.name,
          employee: targetName,
          amount,
          lastPaid: Date.now()
        });
        setPayrollsRegistry(payrolls);
        playBankSound(player, "upgrade", `§aContrato creado: Pagarás $${amount} diarios a ${targetName}.`);
      }).catch(() => {});
    } else if (res.selection === 1) {
      const employerPayrolls = payrolls.filter(p => p.employer === player.name);
      if (employerPayrolls.length === 0) {
        playBankSound(player, "error", "§cNo tienes contratos activos como empleador.");
        return;
      }
      const names = employerPayrolls.map(p => `${p.employee} ($${p.amount}/día)`);
      const modal = new ModalFormData()
        .title("❌ Cancelar Sueldo")
        .dropdown("Selecciona el contrato a cancelar:", names);

      modal.show(player).then((r) => {
        if (r.canceled) return;
        const targetContract = employerPayrolls[r.formValues[0]];
        const updated = payrolls.filter(p => p.id !== targetContract.id);
        setPayrollsRegistry(updated);
        playBankSound(player, "withdraw", `§cContrato de nómina con ${targetContract.employee} cancelado.`);
      }).catch(() => {});
    } else {
      openGeneralBankMenu(player);
    }
  }).catch(() => {});
}

// Diálogo: Clasificación Financiera y Privacidad (Leaderboard)
function openBankLeaderboardDialog(player) {
  const registry = getGlobalAccountRegistry();
  const isHidden = isPlayerHiddenFromLeaderboard(player);

  const list = [];
  for (const name of Object.keys(registry)) {
    if (name === "commands.scoreboard.players.offlinePlayerName") continue;
    const acc = registry[name];
    const totalAssets = (acc.savings ?? 0) + (acc.cash ?? 0);
    
    let hidden = isPlayerHiddenFromLeaderboard(world.getAllPlayers().find(pl => pl.name === name) || name);

    list.push({ name, totalAssets, hidden });
  }

  list.sort((a, b) => b.totalAssets - a.totalAssets);
  const top5 = list.slice(0, 5);

  let body = `§l§6TOP 5 MAGNATES DEL SERVIDOR\n\n`;
  let rank = 1;
  for (const item of top5) {
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "👤";
    const isSelf = item.name === player.name;
    const displayName = item.hidden ? (isSelf ? "§7[Anónimo] (Tú)" : "§7[Anónimo]") : `§e${item.name}`;
    body += `${medal} §7#${rank} ${displayName}§7: §a$${item.totalAssets}\n`;
    rank++;
  }
  body += `\n§7Tu Privacidad: ${isHidden ? "§cANÓNIMO" : "§aVISIBLE"}\n` +
          `§8En modo Anónimo, tu posición y saldo permanecen en el ranking pero tu nombre se oculta.`;

  const form = new ActionFormData()
    .title("🏆 Ranking de Riqueza")
    .body(body)
    .button(`👁️ Privacidad: ${isHidden ? "§aMostrar mi Nombre" : "§cOcultar como Anónimo"}`)
    .button("🔙 Volver");

  form.show(player).then((res) => {
    if (res.canceled) return;
    if (res.selection === 0) {
      toggleLeaderboardPrivacy(player);
      openBankLeaderboardDialog(player);
    } else {
      openGeneralBankMenu(player);
    }
  }).catch(() => {});
}

// Menú del Banco General
const activeBankMenuPlayers = new Set();

function openGeneralBankMenu(player) {
  if (!player || !player.isValid) return;
  const playerKey = player.name.toLowerCase();
  if (activeBankMenuPlayers.has(playerKey)) return;
  activeBankMenuPlayers.add(playerKey);
  system.runTimeout(() => {
    activeBankMenuPlayers.delete(playerKey);
  }, 10);

  try {
    const interestRate = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", GLOBAL_INTEREST_RATE_PROPERTY) ?? 1.5);
    const vaultFunds = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "bank_vault_funds") ?? 0);
    const handBal = getScore(player);
    const savings = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_SAVINGS_PROPERTY) ?? 0);
    const loan = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_LOAN_PROPERTY) ?? 0);
    const tier = getAccountTier(player);
    const isDebitOn = isDebitCardEnabled(player);
    const cd = getFixedDeposit(player);
    const isOwner = player.name.toLowerCase() === "elomar3" || isPlayerOp(player);

    const form = new ActionFormData()
      .title("§e§l🏦 Banco General")
      .body(`§7Bienvenido al Banco General de Pacífico.\n\n` +
            `§7- Nivel de Cuenta: ${tier.color}${tier.name}\n` +
            `§7- Saldo en Mano: §a$${handBal}\n` +
            `§7- Cuenta de Ahorro: §b$${savings} §8(Tasa: §e${interestRate + tier.interestBonus}% diario§8)\n` +
            `§7- Préstamo Activo: §c$${loan} §8(Límite: §e$${tier.maxLoan}§8)\n` +
            `§7- Plazo Fijo: ${cd ? `§e$${cd.amount} (${cd.days}d)` : "§7Sin inversión"}\n` +
            `§7- Fondos en Bóveda: §d$${vaultFunds}\n` +
            `§7- Tarjeta de Débito: ${isDebitOn ? "§aACTIVADA" : "§cDESACTIVADA"}\n\n` +
            `§8Amortización: 20% de tus ingresos diarios se destina al pago automático de préstamos.`)

    const buttons = [
      "📥 Depositar Ahorros",
      "📤 Retirar Ahorros",
      "🔒 Depósitos a Plazo Fijo (Inversiones)",
      "📈 Bolsa de Valores (Acciones)",
      "🧾 Cheques al Portador",
      "💸 Nómina de Sueldos",
      "🏆 Ranking de Riqueza",
      `💳 Tarjeta de Débito: ${isDebitOn ? "§a[ON]" : "§c[OFF]"}`,
      "🛡️ Banco de Clan",
      "🏛️ Fondos Destinados (Presupuesto)",
      "📩 Facturación y Cobros",
      "📲 Alias y CBU Bancario",
      "🎁 Tarjetas de Regalo (Vouchers)",
      "📊 Salud Económica e Inflación",
      `💰 Pedir Préstamo (Máx: $${tier.maxLoan})`,
      "💸 Pagar Préstamo Manual",
      "📊 Estadísticas de la Economía",
      "⚖️ Leyes de Impuestos",
      "📜 Mis Transacciones",
      "🏛️ Transparencia de Hacienda",
      "🏅 Rangos y Beneficios de Cuenta",
      "❌ Cerrar"
    ];

    if (isOwner) {
      buttons.push("🛠️ Panel del Propietario (ElOmar3)");
    }

    for (const btn of buttons) {
      form.button(btn);
    }

    form.show(player).then((response) => {
      if (response.canceled) return;
      const sel = response.selection;
      if (sel === 0) openBankDepositDialog(player);
      else if (sel === 1) openBankWithdrawDialog(player);
      else if (sel === 2) openBankFixedDepositDialog(player);
      else if (sel === 3) openBankStockMarketDialog(player);
      else if (sel === 4) openBankCheckDialog(player);
      else if (sel === 5) openBankPayrollDialog(player);
      else if (sel === 6) openBankLeaderboardDialog(player);
      else if (sel === 7) { toggleDebitCard(player); openGeneralBankMenu(player); }
      else if (sel === 8) openBankClanMenu(player);
      else if (sel === 9) openDesignatedFundsDialog(player);
      else if (sel === 10) openInvoicesMenuDialog(player);
      else if (sel === 11) openManageAliasAndCBUDialog(player);
      else if (sel === 12) openGiftCardsMenuDialog(player);
      else if (sel === 13) openEconomicHealthDialog(player);
      else if (sel === 14) openBankLoanRequestDialog(player);
      else if (sel === 15) openBankLoanPaybackDialog(player);
      else if (sel === 16) openBankStatsDialog(player);
      else if (sel === 17) openPlayerTaxesInfoDialog(player);
      else if (sel === 18) openPlayerTransactionHistoryDialog(player);
      else if (sel === 19) openPublicTransparencyPortalDialog(player);
      else if (sel === 20) openBankTierInfoDialog(player);
      else if (sel === 21) { /* Cerrar */ }
      else if (sel === 22 && isOwner) openBankOwnerPanel(player);
    }).catch(e => {});
  } catch (e) {
    ErrorReporter.report(e, { addonId: "currency_addon", moduleId: "main.js", operation: "openGeneralBankMenu", category: "runtime" });
  }
}

// Diálogo: Información detallada sobre la Cuenta de Ahorro
function openPlayerSavingsInfoDialog(player) {
  const interestRate = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", GLOBAL_INTEREST_RATE_PROPERTY) ?? 1.5);
  
  const body = `§l§bSOBRE LA CUENTA DE AHORRO\n\n` +
               `§7La Cuenta de Ahorro te permite guardar tu dinero de forma segura y hacer que crezca con el tiempo.\n\n` +
               `§61. Intereses Diarios:\n` +
               `§7El banco te paga un rendimiento diario de §e${interestRate}%§7 en base a tus ahorros.\n\n` +
               `§62. Regla del Saldo Mínimo:\n` +
               `§7Para evitar fraudes de depósitos de último minuto, el interés diario se calcula basándose en el §eSaldo Mínimo§7 que mantuviste en la cuenta durante las últimas 24 horas. ¡Es mejor mantener el dinero guardado constantemente!\n\n` +
               `§63. Liquidez Bancaria:\n` +
               `§7Los intereses se pagan usando las reservas físicas de la bóveda del banco. Si la bóveda no tiene fondos (por falta de recaudación de impuestos o compras), los intereses de ese día no se podrán pagar. ¡Apoya el comercio local!`;
               
  const form = new ActionFormData()
    .title("ℹ️ Cuenta de Ahorro")
    .body(body)
    .button("🔙 Volver");
    
  form.show(player).then(() => openGeneralBankMenu(player)).catch(() => {});
}

// Diálogo: Estadísticas Generales de la Economía
function openBankStatsDialog(player) {
  const registry = getGlobalAccountRegistry();
  const playerNames = Object.keys(registry);
  
  let totalSavings = 0;
  let totalLoans = 0;
  let totalCash = 0;
  
  for (const name of playerNames) {
    const acc = registry[name];
    totalSavings += (acc.savings ?? 0);
    totalLoans += (acc.loan ?? 0);
    totalCash += (acc.cash ?? 0);
  }
  
  const vaultFunds = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "bank_vault_funds") ?? 0);
  const interestRate = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", GLOBAL_INTEREST_RATE_PROPERTY) ?? 1.5);
  
  const body = `§l§6ESTADÍSTICAS FINANCIERAS\n\n` +
               `§7- Cuentas: §e${playerNames.length}\n` +
               `§7- En Circulación: §a$${totalCash}\n` +
               `§7- Ahorros Totales: §b$${totalSavings}\n` +
               `§7- Deuda Total: §c$${totalLoans}\n` +
               `§7- Bóveda Banco: §d$${vaultFunds}\n` +
               `§7- Interés Ahorros: §e${interestRate}% diario\n\n` +
               `§8Reservas financiadas con impuestos y tienda.`;
               
  const form = new ActionFormData()
    .title("📊 Estadísticas de la Economía")
    .body(body)
    .button("🔙 Volver");
    
  form.show(player).then(() => openGeneralBankMenu(player)).catch(() => {});
}

// Diálogo: Leyes e Impuestos para Jugadores
function openPlayerTaxesInfoDialog(player) {
  const buyTax = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "tax_shop_buy_rate_v1") ?? 5);
  const sellTax = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "tax_shop_sell_rate_v1") ?? 5);
  const transferTax = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "tax_transfer_rate_v1") ?? 2);
  const wealthThreshold = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "tax_wealth_threshold_v1") ?? 100000);
  const wealthTax = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "tax_wealth_rate_v1") ?? 0.1);
  const predialRate = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "tax_predial_rate_v1") ?? 0.05);
  
  const body = `§l§dIMPUESTOS VIGENTES\n\n` +
               `§7- §bCompras (IVA): §e${buyTax}%\n` +
               `§7- §bVentas (Arancel): §e${sellTax}%\n` +
               `§7- §bTransferencias (ITF): §e${transferTax}%\n` +
               `§7- §bPredial: §e$${predialRate} §7/bloque diario.\n` +
               `§7- §bRiqueza: §e${wealthTax}% §7diario (si total > §a$${wealthThreshold}§7).\n\n` +
               `§8Financia los intereses de ahorro pagados.`;
               
  const form = new ActionFormData()
    .title("⚖️ Leyes de Impuestos")
    .body(body)
    .button("🔙 Volver");
    
  form.show(player).then(() => openGeneralBankMenu(player)).catch(() => {});
}

// Diálogo: Ver Historial de Transacciones Propias
function openPlayerTransactionHistoryDialog(player) {
  const registry = getGlobalAccountRegistry();
  const account = registry[player.name];
  
  const historyList = account && account.history && account.history.length > 0
    ? account.history.map(tx => {
        let timeStr = "";
        try {
          const d = new Date(tx.timestamp);
          timeStr = `[${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}] `;
        } catch (e) {}
        return `§e${timeStr}§b${tx.type} §e$${tx.amount}§7: ${tx.details}`;
      }).join("\n")
    : "§7No tienes movimientos o gastos registrados recientemente.";
    
  const form = new ActionFormData()
    .title("📜 Mis Transacciones Recientes")
    .body(`§7Últimos 5 movimientos económicos en tu cuenta:\n\n${historyList}`)
    .button("🔙 Volver");
    
  form.show(player).then(() => openGeneralBankMenu(player)).catch(() => {});
}

// Diálogo: Portal de Transparencia de la Hacienda Pública (Auditoría Abierta)
function openPublicTransparencyPortalDialog(player) {
  const vaultFunds = getVaultFunds();
  const construction = getDesignatedFundAmount("construction");
  const events = getDesignatedFundAmount("events");
  const reserve = getDesignatedFundAmount("reserve");
  const social = getDesignatedFundAmount("social");
  const totalPublicAssets = vaultFunds + getTotalDesignatedFunds();

  const ledger = getPublicStateLedger();

  let body = `§l§b🏛️ PORTAL DE TRANSPARENCIA Y AUDITORÍA PÚBLICA\n\n` +
             `§7Este portal garantiza la rendición de cuentas pública del Banco General y la Hacienda del Servidor.\n\n` +
             `§6💰 ESTADO DEL PRESUPUESTO PÚBLICO:\n` +
             `§7- Bóveda Central (Reservas de Intereses): §d$${vaultFunds}\n` +
             `§7- Fondo de Obras y Construcción: §a$${construction}\n` +
             `§7- Fondo de Eventos y Recompensas: §e$${events}\n` +
             `§7- Fondo de Reserva Económica: §d$${reserve}\n` +
             `§7- Fondo de Servicios y Bienestar: §b$${social}\n` +
             `§7- Patrimonio Público Total: §6$${totalPublicAssets}\n\n` +
             `§6📜 ÚLTIMOS MOVIMIENTOS PÚBLICOS ESTATALES:\n`;

  if (ledger.length === 0) {
    body += `§7Sin movimientos públicos recientes registrados.\n`;
  } else {
    for (const tx of ledger.slice(0, 10)) {
      let timeStr = "";
      try {
        const d = new Date(tx.timestamp);
        timeStr = `[${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}] `;
      } catch (e) {}
      body += `§e${timeStr}§b${tx.type} §e$${tx.amount} §8(${tx.actor})§7: ${tx.details}\n`;
    }
  }

  body += `\n§8Garantía Anti-Corrupción: Todos los impuestos cobrados regresan a la comunidad en forma de pago de intereses de ahorro o proyectos públicos de construcción y eventos.`;

  const form = new ActionFormData()
    .title("🏛️ Transparencia de Hacienda")
    .body(body)
    .button("⚖️ Leyes de Impuestos y Reglas Fiscales")
    .button("🔙 Volver");

  form.show(player).then((res) => {
    if (res.canceled) return;
    if (res.selection === 0) {
      openPlayerTaxesInfoDialog(player);
    } else {
      openGeneralBankMenu(player);
    }
  }).catch(() => {});
}

// === CBU y ALIAS BANCARIO (Feature 2) ===
function getPlayerCBU(player) {
  let cbu = globalThis.__sqlite_get_prop_v2__("currency_addon", player, "bank_cbu_v1");
  if (!cbu) {
    let hash = 0;
    for (let i = 0; i < player.name.length; i++) {
      hash = (hash * 31 + player.name.charCodeAt(i)) % 900000;
    }
    cbu = String(100000 + Math.abs(hash));
    globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_cbu_v1", cbu);
  }
  return String(cbu);
}

function getPlayerAlias(player) {
  const alias = globalThis.__sqlite_get_prop_v2__("currency_addon", player, "bank_alias_v1");
  return alias ? String(alias) : player.name.toLowerCase();
}

function setPlayerAlias(player, newAlias) {
  const cleaned = String(newAlias ?? "").trim().toLowerCase().replace(/[^a-z0-9._]/g, "");
  if (cleaned.length < 3 || cleaned.length > 16) return { success: false, reason: "El alias debe tener entre 3 y 16 caracteres alfanuméricos." };

  const registry = getGlobalAccountRegistry();
  for (const name of Object.keys(registry)) {
    if (name.toLowerCase() !== player.name.toLowerCase()) {
      if (registry[name].alias === cleaned) {
        return { success: false, reason: "Ese Alias ya pertenece a otro jugador." };
      }
    }
  }

  globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_alias_v1", cleaned);
  updateGlobalAccountRegistry(player.name, Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_SAVINGS_PROPERTY) ?? 0), Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_LOAN_PROPERTY) ?? 0), getScore(player));
  return { success: true, alias: cleaned };
}

function findAccountByCBUOrAlias(query) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return null;

  const registry = getGlobalAccountRegistry();

  for (const name of Object.keys(registry)) {
    const acc = registry[name];
    if (name.toLowerCase() === q || String(acc.cbu) === q || String(acc.alias).toLowerCase() === q) {
      return { name, acc };
    }
  }

  for (const p of world.getAllPlayers()) {
    if (p.name.toLowerCase() === q || getPlayerCBU(p) === q || getPlayerAlias(p) === q) {
      return { name: p.name, acc: { cash: getScore(p), savings: Number(globalThis.__sqlite_get_prop_v2__("currency_addon", p, BANK_SAVINGS_PROPERTY) ?? 0), cbu: getPlayerCBU(p), alias: getPlayerAlias(p) } };
    }
  }

  return null;
}

function openManageAliasAndCBUDialog(player) {
  const cbu = getPlayerCBU(player);
  const alias = getPlayerAlias(player);

  const form = new ActionFormData()
    .title("📲 CBU y Alias Bancario")
    .body(`§l§eDATOS DE TU CUENTA BANCARIA\n\n` +
          `§7- Titular: §b${player.name}\n` +
          `§7- Número de Cuenta (CBU): §e${cbu}\n` +
          `§7- Alias Personalizado: §a${alias}\n\n` +
          `§8Cualquier jugador puede transferirte dinero usando tu CBU de 6 dígitos o tu Alias, incluso si estás desconectado.`)
    .button("✏️ Cambiar Alias Personalizado")
    .button("💸 Transferencia Rápida por CBU / Alias")
    .button("🔙 Volver");

  form.show(player).then((res) => {
    if (res.canceled) return;
    if (res.selection === 0) {
      openEditAliasDialog(player);
    } else if (res.selection === 1) {
      openQuickTransferByCBUDialog(player);
    } else {
      openGeneralBankMenu(player);
    }
  }).catch(() => {});
}

function openEditAliasDialog(player) {
  const currentAlias = getPlayerAlias(player);
  const modal = new ModalFormData()
    .title("✏️ Cambiar Alias Bancario")
    .textField(`Alias actual: ${currentAlias}\nIngresa tu nuevo Alias (3 a 16 caracteres):`, "Ej: pacifico.elomar3");

  modal.show(player).then((res) => {
    if (res.canceled) return;
    const result = setPlayerAlias(player, res.formValues[0]);
    if (result.success) {
      playBankSound(player, "upgrade", `§a¡Alias actualizado a: ${result.alias}!`);
      player.sendMessage(`§b§l[§6Banco§b§l]§r §aTu Alias bancario se ha configurado como §e"${result.alias}"§a.`);
    } else {
      player.sendMessage(`§b§l[§6Banco§b§l]§r §c${result.reason}`);
    }
  }).catch(() => {});
}

function openQuickTransferByCBUDialog(player) {
  const handBal = getScore(player);
  const transferTaxRate = getTransferTaxRate();

  const modal = new ModalFormData()
    .title("💸 Transferencia por CBU / Alias")
    .textField("Ingresa el CBU (6 dígitos) o Alias del destinatario:", "Ej: 482910 o pacifico.elomar3")
    .textField(`Saldo en mano: $${handBal}\nMonto a enviar:`, "Monto entero positivo");

  modal.show(player).then((res) => {
    if (res.canceled) return;
    const query = res.formValues[0];
    const amount = Math.floor(Number(res.formValues[1]) || 0);

    if (amount <= 0 || isNaN(amount)) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cMonto de transferencia inválido.");
      return;
    }
    const currentHandBal = getScore(player);
    if (currentHandBal < amount) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cNo tienes suficiente dinero en mano.");
      return;
    }
    const transferable = getAvailableTransferBalance(player);
    if (amount > transferable) {
      player.sendMessage(`§b§l[§6Banco§b§l]§r §cNo puedes transferir dinero prestado. Disponible para transferir: §e$${transferable}§c. Amortiza tu préstamo para liberar ese saldo.`);
      return;
    }

    const targetAccount = findAccountByCBUOrAlias(query);
    if (!targetAccount) {
      player.sendMessage(`§b§l[§6Banco§b§l]§r §cNo se encontró ninguna cuenta bancaria con CBU o Alias "${query}".`);
      return;
    }

    if (targetAccount.name.toLowerCase() === player.name.toLowerCase()) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cNo puedes transferirte dinero a ti mismo.");
      return;
    }

    const tax = Math.floor(amount * (transferTaxRate / 100));
    const recipientAmount = amount - tax;

    if (setScore(player, currentHandBal - amount, "transfer_cbu")) {
      if (tax > 0) depositTaxRevenue(tax);

      const targetPlayer = world.getAllPlayers().find(p => p.name.toLowerCase() === targetAccount.name.toLowerCase());
      if (targetPlayer) {
        setScore(targetPlayer, getScore(targetPlayer) + recipientAmount, "transfer_cbu_receive");
        playBankSound(targetPlayer, "income", `§a¡Recibiste $${recipientAmount} por CBU/Alias de ${player.name}!`);
      } else {
        const registry = getGlobalAccountRegistry();
        if (!registry[targetAccount.name]) {
          registry[targetAccount.name] = { cash: recipientAmount, savings: 0, loan: 0, history: [] };
        } else {
          registry[targetAccount.name].cash = (registry[targetAccount.name].cash ?? 0) + recipientAmount;
        }
      }

      logPlayerTransaction(player.name, "Transferencia CBU", amount, `Enviado a ${targetAccount.name} (${query})`);
      logPlayerTransaction(targetAccount.name, "Recibo CBU", recipientAmount, `Recibido de ${player.name}`);
      playBankSound(player, "withdraw", `§aTransferidos $${amount} a ${targetAccount.name}`);
      player.sendMessage(`§b§l[§6Banco§b§l]§r §a¡Transferencia exitosa! Enviados §e$${recipientAmount}§a a §b${targetAccount.name}§a (Impuesto ITF: §c$${tax}§a).`);
    } else {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cError al procesar la transferencia.");
    }
  }).catch(() => {});
}

// === FACTURACIÓN Y SOLICITUDES DE COBRO (Feature 1) ===
function getInvoicesRegistry() {
  const raw = globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "bank_invoices_registry_v1");
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (e) { return []; }
}

function setInvoicesRegistry(invoices) {
  try {
    globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "bank_invoices_registry_v1", JSON.stringify(invoices));
  } catch (e) {}
}

function openInvoicesMenuDialog(player) {
  const invoices = getInvoicesRegistry();
  const pendingForPlayer = invoices.filter(inv => inv.receiverName.toLowerCase() === player.name.toLowerCase() && inv.status === "pending");

  const form = new ActionFormData()
    .title("🧾 Facturación y Cobros")
    .body(`§7Gestión de solicitudes de cobro e impuestos de facturación.\n\nFacturas Pendientes de Pago: §e${pendingForPlayer.length}`)
    .button(`📥 Ver Facturas Recibidas (${pendingForPlayer.length})`)
    .button("📤 Emitir Nueva Factura de Cobro")
    .button("📜 Historial de Facturas Emitidas")
    .button("🔙 Volver");

  form.show(player).then((res) => {
    if (res.canceled) return;
    if (res.selection === 0) {
      openPendingInvoicesDialog(player);
    } else if (res.selection === 1) {
      openCreateInvoiceDialog(player);
    } else if (res.selection === 2) {
      openSentInvoicesHistoryDialog(player);
    } else {
      openGeneralBankMenu(player);
    }
  }).catch(() => {});
}

function openCreateInvoiceDialog(player) {
  const players = world.getAllPlayers().filter(p => p.name.toLowerCase() !== player.name.toLowerCase());
  const playerNames = players.map(p => p.name);

  if (playerNames.length === 0) {
    player.sendMessage("§b§l[§6Banco§b§l]§r §cNo hay otros jugadores en línea para facturar.");
    return;
  }

  const modal = new ModalFormData()
    .title("📤 Emitir Factura de Cobro")
    .dropdown("Destinatario (Jugador a cobrar):", playerNames)
    .textField("Monto a facturar ($):", "Ej: 1500")
    .textField("Concepto / Descripción del servicio:", "Ej: Reparación de Construcción / Venta de Materiales");

  modal.show(player).then((res) => {
    if (res.canceled) return;
    const targetName = playerNames[res.formValues[0]];
    const amount = Math.floor(Number(res.formValues[1]) || 0);
    const concept = String(res.formValues[2] || "Servicio comercial").trim();

    if (amount <= 0 || isNaN(amount)) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cMonto de factura inválido.");
      return;
    }

    const newInvoice = {
      id: `inv_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      senderName: player.name,
      receiverName: targetName,
      amount: amount,
      concept: concept,
      timestamp: Date.now(),
      status: "pending"
    };

    const invoices = getInvoicesRegistry();
    invoices.push(newInvoice);
    setInvoicesRegistry(invoices);

    const targetPlayer = players.find(p => p.name === targetName);
    if (targetPlayer) {
      playBankSound(targetPlayer, "income", `§e¡Has recibido una factura de cobro por $${amount} de ${player.name}!`);
      targetPlayer.sendMessage(`§b§l[§6Banco§b§l]§r §e¡Factura recibida! §b${player.name}§e te ha enviado una solicitud de cobro por §a$${amount}§e (Concepto: ${concept}). Abre el banco para pagarla.`);
    }

    player.sendMessage(`§b§l[§6Banco§b§l]§r §aFactura emitida exitosamente a §b${targetName}§a por §e$${amount}§a.`);
  }).catch(() => {});
}

function openPendingInvoicesDialog(player) {
  const invoices = getInvoicesRegistry();
  const pending = invoices.filter(inv => inv.receiverName.toLowerCase() === player.name.toLowerCase() && inv.status === "pending");

  if (pending.length === 0) {
    const form = new ActionFormData()
      .title("📥 Facturas Recibidas")
      .body("§7No tienes facturas pendientes de pago en este momento.")
      .button("🔙 Volver");

    form.show(player).then(() => openInvoicesMenuDialog(player)).catch(() => {});
    return;
  }

  const form = new ActionFormData()
    .title("📥 Facturas Recibidas")
    .body(`§7Tienes §e${pending.length}§7 facturas pendientes. Selecciona una factura para revisarla y pagarla:`);

  for (const inv of pending) {
    form.button(`🧾 De: ${inv.senderName} - $${inv.amount}\n(${inv.concept})`);
  }
  form.button("🔙 Volver");

  form.show(player).then((res) => {
    if (res.canceled) return;
    const sel = res.selection;
    if (sel < pending.length) {
      openInvoiceDetailDialog(player, pending[sel].id);
    } else {
      openInvoicesMenuDialog(player);
    }
  }).catch(() => {});
}

function openInvoiceDetailDialog(player, invoiceId) {
  const invoices = getInvoicesRegistry();
  const invIndex = invoices.findIndex(i => i.id === invoiceId);
  if (invIndex === -1) return;

  const inv = invoices[invIndex];
  const handBal = getScore(player);

  const body = `§l§eDETALLES DE LA FACTURA\n\n` +
               `§7- Emisor / Cobrador: §b${inv.senderName}\n` +
               `§7- Monto Solicitado: §a$${inv.amount}\n` +
               `§7- Concepto: §f${inv.concept}\n` +
               `§7- Tu saldo disponible en mano: §e$${handBal}`;

  const form = new ActionFormData()
    .title("🧾 Revisión de Factura")
    .body(body)
    .button("💳 Pagar Factura Ahora")
    .button("❌ Rechazar Factura")
    .button("🔙 Volver");

  form.show(player).then((res) => {
    if (res.canceled) return;
    if (res.selection === 0) {
      const currentHandBal = getScore(player);
      if (currentHandBal < inv.amount) {
        player.sendMessage("§b§l[§6Banco§b§l]§r §cNo tienes suficiente dinero en mano para pagar esta factura.");
        return;
      }
      const transferable = getAvailableTransferBalance(player);
      if (inv.amount > transferable) {
        player.sendMessage(`§b§l[§6Banco§b§l]§r §cNo puedes pagar a otro jugador con dinero prestado. Disponible para transferir: §e$${transferable}§c.`);
        return;
      }

      if (setScore(player, currentHandBal - inv.amount, "invoice_pay")) {
        inv.status = "paid";
        setInvoicesRegistry(invoices);

        const senderPlayer = world.getAllPlayers().find(p => p.name.toLowerCase() === inv.senderName.toLowerCase());
        if (senderPlayer) {
          setScore(senderPlayer, getScore(senderPlayer) + inv.amount, "invoice_receive");
          playBankSound(senderPlayer, "upgrade", `§a¡Factura pagada por ${player.name}! Recibes $${inv.amount}`);
        } else {
          const registry = getGlobalAccountRegistry();
          if (!registry[inv.senderName]) {
            registry[inv.senderName] = { cash: inv.amount, savings: 0, loan: 0, history: [] };
          } else {
            registry[inv.senderName].cash = (registry[inv.senderName].cash ?? 0) + inv.amount;
          }
        }

        logPlayerTransaction(player.name, "Pago Factura", inv.amount, `Pago a ${inv.senderName}: ${inv.concept}`);
        logPlayerTransaction(inv.senderName, "Cobro Factura", inv.amount, `Cobrado a ${player.name}`);
        playBankSound(player, "income", `§aFactura pagada exitosamente`);
        player.sendMessage(`§b§l[§6Banco§b§l]§r §a¡Factura pagada! Se entregaron §e$${inv.amount}§a a §b${inv.senderName}§a.`);
      }
    } else if (res.selection === 1) {
      inv.status = "rejected";
      setInvoicesRegistry(invoices);

      const senderPlayer = world.getAllPlayers().find(p => p.name.toLowerCase() === inv.senderName.toLowerCase());
      if (senderPlayer) {
        senderPlayer.sendMessage(`§b§l[§6Banco§b§l]§r §c${player.name} ha rechazado tu factura de $${inv.amount} (Concepto: ${inv.concept}).`);
      }
      player.sendMessage("§b§l[§6Banco§b§l]§r §eHas rechazado la factura.");
    } else {
      openPendingInvoicesDialog(player);
    }
  }).catch(() => {});
}

function openSentInvoicesHistoryDialog(player) {
  const invoices = getInvoicesRegistry();
  const sent = invoices.filter(inv => inv.senderName.toLowerCase() === player.name.toLowerCase());

  let body = "§l§eHISTORIAL DE FACTURAS EMITIDAS\n\n";
  if (sent.length === 0) {
    body += "§7No has emitido facturas de cobro recientemente.";
  } else {
    for (const inv of sent.slice(0, 10)) {
      const statusIcon = inv.status === "paid" ? "✅ PAGADA" : inv.status === "rejected" ? "❌ RECHAZADA" : "⏳ PENDIENTE";
      body += `§f🧾 §b${inv.receiverName}§7 - §a$${inv.amount}§7 (${statusIcon})\n§8  ↳ ${inv.concept}\n\n`;
    }
  }

  const form = new ActionFormData()
    .title("📜 Facturas Emitidas")
    .body(body)
    .button("🔙 Volver");

  form.show(player).then(() => openInvoicesMenuDialog(player)).catch(() => {});
}

// === TARJETAS DE REGALO / VOUCHERS (Feature 4) ===
function getGiftCardsRegistry() {
  const raw = globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "bank_gift_cards_registry_v1");
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (e) { return []; }
}

function setGiftCardsRegistry(cards) {
  try {
    globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "bank_gift_cards_registry_v1", JSON.stringify(cards));
  } catch (e) {}
}

function openGiftCardsMenuDialog(player) {
  const form = new ActionFormData()
    .title("🎁 Tarjetas de Regalo / Vouchers")
    .body("§7Canjea un código de regalo o genera una tarjeta de crédito prepagada para regalar a otros usuarios.")
    .button("🎟️ Canjear Código de Regalo")
    .button("🎁 Crear Tarjeta de Regalo (Comprar Voucher)")
    .button("🔙 Volver");

  form.show(player).then((res) => {
    if (res.canceled) return;
    if (res.selection === 0) {
      openRedeemGiftCardDialog(player);
    } else if (res.selection === 1) {
      openCreateGiftCardDialog(player);
    } else {
      openGeneralBankMenu(player);
    }
  }).catch(() => {});
}

function openCreateGiftCardDialog(player) {
  const handBal = getScore(player);
  const modal = new ModalFormData()
    .title("🎁 Crear Tarjeta de Regalo")
    .textField(`Saldo disponible en mano: $${handBal}\nIngresa el valor de la tarjeta ($):`, "Monto entero positivo");

  modal.show(player).then((res) => {
    if (res.canceled) return;
    const amount = Math.floor(Number(res.formValues[0]) || 0);

    if (amount <= 0 || isNaN(amount)) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cMonto de tarjeta inválido.");
      return;
    }
    if (handBal < amount) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cNo tienes suficiente dinero en mano.");
      return;
    }

    if (setScore(player, handBal - amount, "giftcard_create")) {
      const code = `GIFT-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const newCard = {
        code,
        amount,
        createdBy: player.name,
        createdAt: Date.now(),
        redeemedBy: null
      };

      const cards = getGiftCardsRegistry();
      cards.push(newCard);
      setGiftCardsRegistry(cards);

      logPlayerTransaction(player.name, "Crear GiftCard", amount, `Código generado: ${code}`);
      playBankSound(player, "upgrade", `§a¡Tarjeta de Regalo creada! Código: ${code}`);
      player.sendMessage(`§b§l[§6Banco§b§l]§r §a¡Tarjeta de Regalo generada! Código promocional:\n§e§l${code}\n§7Comparte este código con el beneficiario para que lo canjee.`);
    }
  }).catch(() => {});
}

function openRedeemGiftCardDialog(player) {
  const modal = new ModalFormData()
    .title("🎟️ Canjear Código de Regalo")
    .textField("Ingresa el código promocional (Ej: GIFT-XXXX-XXXX):", "GIFT-XXXX-XXXX");

  modal.show(player).then((res) => {
    if (res.canceled) return;
    const inputCode = String(res.formValues[0] || "").trim().toUpperCase();

    const cards = getGiftCardsRegistry();
    const cardIndex = cards.findIndex(c => c.code === inputCode);

    if (cardIndex === -1) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cCódigo de tarjeta inválido o inexistente.");
      return;
    }

    const card = cards[cardIndex];
    if (card.redeemedBy) {
      player.sendMessage(`§b§l[§6Banco§b§l]§r §cEste código ya fue canjeado por §b${card.redeemedBy}§c.`);
      return;
    }

    const handBal = getScore(player);
    if (setScore(player, handBal + card.amount, "giftcard_redeem")) {
      card.redeemedBy = player.name;
      card.redeemedAt = Date.now();
      setGiftCardsRegistry(cards);

      logPlayerTransaction(player.name, "Canje GiftCard", card.amount, `Canjeado código ${card.code}`);
      playBankSound(player, "upgrade", `§a¡Has canjeado $${card.amount}!`);
      player.sendMessage(`§b§l[§6Banco§b§l]§r §a¡Felicidades! Has canjeado el código §e${card.code}§a y recibido §e$${card.amount}§a en mano.`);
    }
  }).catch(() => {});
}

// === SALUD ECONÓMICA E ÍNDICE DE INFLACIÓN (Feature 6) ===
function calculateEconomicHealth() {
  const registry = getGlobalAccountRegistry();
  const playerNames = Object.keys(registry);
  const onlineCount = world.getAllPlayers().length;

  let totalCash = 0;
  let totalSavings = 0;
  let totalLoans = 0;

  for (const name of playerNames) {
    const acc = registry[name];
    totalCash += (acc.cash ?? 0);
    totalSavings += (acc.savings ?? 0);
    totalLoans += (acc.loan ?? 0);
  }

  const vaultFunds = getVaultFunds();
  const designatedFunds = getTotalDesignatedFunds();
  const totalMoneySupply = totalCash + totalSavings + vaultFunds + designatedFunds;
  const accountsCount = Math.max(1, playerNames.length);
  const avgWealthPerCapita = Math.floor(totalMoneySupply / accountsCount);

  const inflationRiskPercent = Math.min(100, Math.floor((avgWealthPerCapita / 200000) * 100));

  let statusText = "§aESTABLE (Saludable)";
  let recommendation = "Las tasas de interés e impuestos actuales mantienen un equilibrio adecuado.";

  if (inflationRiskPercent >= 75) {
    statusText = "§cHIPER-INFLACIÓN (Riesgo Elevado)";
    recommendation = "Se recomienda subir impuestos de tienda e ITF, y reducir la tasa de interés de ahorros para frenar la liquidez excesiva.";
  } else if (inflationRiskPercent >= 40) {
    statusText = "§eINFLACIÓN MODERADA";
    recommendation = "Hay alta liquidez en el servidor. Vigilar la emisión de moneda y fomentar inversiones a largo plazo.";
  }

  return {
    accountsCount,
    onlineCount,
    totalCash,
    totalSavings,
    totalLoans,
    vaultFunds,
    designatedFunds,
    totalMoneySupply,
    avgWealthPerCapita,
    inflationRiskPercent,
    statusText,
    recommendation
  };
}

function openEconomicHealthDialog(player) {
  const health = calculateEconomicHealth();

  const body = `§l§6ANÁLISIS DE SALUD ECONÓMICA E INFLACIÓN\n\n` +
               `§7- Estado Económico: ${health.statusText}\n` +
               `§7- Riesgo de Inflación: §e${health.inflationRiskPercent}%\n` +
               `§7- Masa Monetaria Total: §a$${health.totalMoneySupply}\n` +
               `§7- Riqueza Promedio por Cuentahabiente: §b$${health.avgWealthPerCapita}\n` +
               `§7- Cuentas Registradas: §e${health.accountsCount}\n` +
               `§7- Reservas Bóveda Central: §d$${health.vaultFunds}\n` +
               `§7- Fondos Destinados Públicos: §6$${health.designatedFunds}\n\n` +
               `§6💡 RECOMENDACIÓN DEL BANCO CENTRAL:\n` +
               `§7${health.recommendation}`;

  const form = new ActionFormData()
    .title("📊 Salud Económica e Inflación")
    .body(body)
    .button("🔙 Volver");

  form.show(player).then(() => openGeneralBankMenu(player)).catch(() => {});
}

// Contratos de Contratistas y Pagos Programados por Tiempo
function getContractorContractsRegistry() {
  const raw = globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "bank_contractor_contracts_v1");
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (e) { return []; }
}

function setContractorContractsRegistry(contracts) {
  try {
    globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "bank_contractor_contracts_v1", JSON.stringify(contracts));
  } catch (e) {}
}

function executeContractorSinglePayment(contract, isManual = false) {
  const now = Date.now();
  const currentPaymentIndex = (contract.paymentsMade || 0) + 1;
  const isFinalPayment = currentPaymentIndex >= contract.totalPayments;

  if (isFinalPayment && contract.escrowReleaseOnFinish && !contract.escrowApproved) {
    contract.status = "escrow_pending";
    contract.lastPaidAt = now;
    return { success: true, escrowPending: true };
  }

  const fundKey = contract.fundKey;
  const currentFundBal = getDesignatedFundAmount(fundKey);
  const amount = contract.paymentAmount;

  if (currentFundBal < amount) {
    return { success: false, reason: `Saldo insuficiente en ${DESIGNATED_FUNDS[fundKey]?.name || fundKey} ($${currentFundBal} disponibles vs $${amount} requeridos)` };
  }

  setDesignatedFundAmount(fundKey, currentFundBal - amount);

  const onlinePlayer = world.getAllPlayers().find(p => p.name.toLowerCase() === contract.contractorName.toLowerCase());
  if (onlinePlayer) {
    const currentScore = getScore(onlinePlayer);
    setScore(onlinePlayer, currentScore + amount, "contractor_payment");
    logPlayerTransaction(onlinePlayer.name, "Pago Contrato", amount, `Cuota ${currentPaymentIndex}/${contract.totalPayments}: ${contract.title}`);
    playBankSound(onlinePlayer, "income", `§a¡Cobro de contrato! Recibes $${amount} (${currentPaymentIndex}/${contract.totalPayments})`);
    onlinePlayer.sendMessage(`§b§l[§6Banco§b§l]§r §a¡Pago de contrato recibido! Se acreditan §e$${amount}§a por §e"${contract.title}"§a (${currentPaymentIndex}/${contract.totalPayments}).`);
  } else {
    const registry = getGlobalAccountRegistry();
    const contractorName = contract.contractorName;
    if (!registry[contractorName]) {
      registry[contractorName] = { cash: amount, savings: 0, loan: 0, history: [] };
    } else {
      registry[contractorName].cash = (registry[contractorName].cash ?? 0) + amount;
    }
    globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "bank_accounts_registry_v2", JSON.stringify(registry));
    logPlayerTransaction(contractorName, "Pago Contrato (Offline)", amount, `Cuota ${currentPaymentIndex}/${contract.totalPayments}: ${contract.title}`);
  }

  logPublicStateTransaction("Pago de Contrato", amount, contract.contractorName, `Cuota ${currentPaymentIndex}/${contract.totalPayments} del proyecto: ${contract.title}`);

  contract.paymentsMade = currentPaymentIndex;
  contract.lastPaidAt = now;

  if (contract.paymentsMade >= contract.totalPayments) {
    contract.status = "completed";
  }

  return { success: true, escrowPending: false, paymentIndex: currentPaymentIndex };
}

function processScheduledContractorPayments() {
  const contracts = getContractorContractsRegistry();
  if (!contracts || contracts.length === 0) return;

  const now = Date.now();
  let modified = false;

  for (const contract of contracts) {
    if (contract.status !== "active") continue;

    const intervalMs = (contract.intervalMinutes || 30) * 60 * 1000;
    const lastPaid = contract.lastPaidAt || 0;
    if (now - lastPaid < intervalMs) continue;

    const result = executeContractorSinglePayment(contract, false);
    if (result.success) {
      modified = true;
    }
  }

  if (modified) {
    setContractorContractsRegistry(contracts);
  }
}

// Diálogo: Fondos Destinados (Vista Pública y Transparencia)
function openDesignatedFundsDialog(player) {
  system.run(() => {
    if (!player || !player.isValid) return;
    const construction = getDesignatedFundAmount("construction");
    const events = getDesignatedFundAmount("events");
    const reserve = getDesignatedFundAmount("reserve");
    const social = getDesignatedFundAmount("social");
    const total = getTotalDesignatedFunds();
    const isOwner = player.name.toLowerCase() === "elomar3" || isPlayerOp(player);

    const body = `§l§e🏛️ FONDOS DESTINADOS DEL BANCO GENERAL\n\n` +
                 `§7El Banco General mantiene fondos de presupuesto público para proyectos comunitarios, desarrollo y estabilidad:\n\n` +
                 `§f🏗️ §lObras y Construcción:§r §a$${construction}\n` +
                 `§8  ↳ ${DESIGNATED_FUNDS.construction.desc}\n\n` +
                 `§f🎉 §lEventos y Recompensas:§r §e$${events}\n` +
                 `§8  ↳ ${DESIGNATED_FUNDS.events.desc}\n\n` +
                 `§f🛡️ §lReserva Económica:§r §d$${reserve}\n` +
                 `§8  ↳ ${DESIGNATED_FUNDS.reserve.desc}\n\n` +
                 `§f🏛️ §lServicios y Bienestar:§r §b$${social}\n` +
                 `§8  ↳ ${DESIGNATED_FUNDS.social.desc}\n\n` +
                 `§7Total acumulado en Fondos Destinados: §6$${total}`;

    const form = new ActionFormData()
      .title("🏛️ Fondos Destinados")
      .body(body)
      .button("📥 Aportar a un Fondo Destinado")
      .button("📜 Mis Contratos de Servicio (Pagos Programados)");

    if (isOwner) {
      form.button("⚙️ Administrar Presupuestos / Contratos (Owner)");
    }

    form.button("🔙 Volver");

    form.show(player).then((res) => {
      if (res.canceled) return;
      if (res.selection === 0) {
        system.run(() => openDonateToDesignatedFundDialog(player));
      } else if (res.selection === 1) {
        system.run(() => openContractorContractsViewDialog(player));
      } else if (res.selection === 2 && isOwner) {
        system.run(() => openAdminDesignatedFundsDialog(player));
      } else {
        system.run(() => openGeneralBankMenu(player));
      }
    }).catch(() => {});
  });
}

// Diálogo: Mis Contratos de Servicio (Vista para el Jugador Contratista)
function openContractorContractsViewDialog(player) {
  system.run(() => {
    if (!player || !player.isValid) return;
    const contracts = getContractorContractsRegistry();
    const playerContracts = contracts.filter(c => c.contractorName.toLowerCase() === player.name.toLowerCase());

    if (playerContracts.length === 0) {
      const form = new ActionFormData()
        .title("📜 Mis Contratos de Servicio")
        .body("§7No tienes contratos de servicio activos o programados en este momento.\n\n§8Los contratistas de obras públicas y proyectos del gobierno pueden ser contratados por los administradores del Banco General.")
        .button("🔙 Volver");

      form.show(player).then(() => {
        system.run(() => openDesignatedFundsDialog(player));
      }).catch(() => {});
      return;
    }

    let body = "§l§eMIS CONTRATOS DE SERVICIO Y PAGOS PROGRAMADOS\n\n";
    const now = Date.now();

    for (const c of playerContracts) {
      const statusStr = c.status === "active" ? "§aACTIVO" :
                        c.status === "paused" ? "§ePAUSADO" :
                        c.status === "escrow_pending" ? "§dGARANTÍA PENDIENTE (REVISIÓN)" :
                        c.status === "completed" ? "§bCOMPLETADO" : "§cCANCELADO";

      const fundMeta = DESIGNATED_FUNDS[c.fundKey] || { name: c.fundKey };
      let etaStr = "";
      if (c.status === "active") {
        const intervalMs = (c.intervalMinutes || 30) * 60 * 1000;
        const nextPayAt = (c.lastPaidAt || c.createdAt || now) + intervalMs;
        const remainSec = Math.max(0, Math.ceil((nextPayAt - now) / 1000));
        const remainMin = Math.floor(remainSec / 60);
        etaStr = ` | Próximo pago: ~${remainMin} min`;
      }

      body += `§f📌 §l${c.title}§r (${statusStr})\n` +
              `§7  ↳ Fondo: ${fundMeta.name}\n` +
              `§7  ↳ Monto por cuota: §a$${c.paymentAmount}\n` +
              `§7  ↳ Progreso de pago: §e${c.paymentsMade || 0} / ${c.totalPayments} cuotas§7${etaStr}\n\n`;
    }

    const form = new ActionFormData()
      .title("📜 Mis Contratos de Servicio")
      .body(body)
      .button("🔙 Volver");

    form.show(player).then(() => {
      system.run(() => openDesignatedFundsDialog(player));
    }).catch(() => {});
  });
}

// Diálogo: Aportar Dinero a un Fondo Destinado (Jugador)
function openDonateToDesignatedFundDialog(player) {
  system.run(() => {
    if (!player || !player.isValid) return;
    const handBal = getScore(player);
    const fundKeys = Object.keys(DESIGNATED_FUNDS);
    const fundNames = fundKeys.map(k => DESIGNATED_FUNDS[k].name);

    const modal = new ModalFormData()
      .title("📥 Aportar a Fondo Destinado")
      .dropdown("Selecciona el Fondo al que deseas donar:", fundNames)
      .textField(`Saldo disponible en mano: $${handBal}\nIngresa el monto a aportar:`, "Monto entero positivo");

    modal.show(player).then((res) => {
      if (res.canceled) return;
      const fundIndex = res.formValues[0];
      const fundKey = fundKeys[fundIndex];
      const val = Math.floor(Number(res.formValues[1]) || 0);

      if (val <= 0 || isNaN(val)) {
        player.sendMessage("§b§l[§6Banco§b§l]§r §cMonto de aportación inválido.");
        return;
      }
      if (handBal < val) {
        player.sendMessage("§b§l[§6Banco§b§l]§r §cNo tienes suficiente dinero en mano.");
        return;
      }

      if (setScore(player, handBal - val, "donate_designated_fund")) {
        const current = getDesignatedFundAmount(fundKey);
        const next = current + val;
        setDesignatedFundAmount(fundKey, next);
        logPlayerTransaction(player.name, "Aporte Fondo", val, `Aporte voluntario al ${DESIGNATED_FUNDS[fundKey].name}`);
        playBankSound(player, "upgrade", `§a¡Gracias por tu aporte de $${val} al ${DESIGNATED_FUNDS[fundKey].name}!`);
        player.sendMessage(`§b§l[§6Banco§b§l]§r §a¡Aporte realizado con éxito! El nuevo balance del ${DESIGNATED_FUNDS[fundKey].name} es §e$${next}§a.`);
      } else {
        player.sendMessage("§b§l[§6Banco§b§l]§r §cError al realizar la transacción.");
      }
    }).catch(() => {});
  });
}

// Diálogo: Panel Administrativo de Fondos Destinados (Owner / Admin)
function openAdminDesignatedFundsDialog(player) {
  system.run(() => {
    if (!player || !player.isValid) return;
    const vaultFunds = getVaultFunds();
    const form = new ActionFormData()
      .title("⚙️ Gestión de Fondos y Contratos")
      .body(`§7Administración de presupuestos y contratistas del Banco General.\n\nLiquidez en Bóveda Central: §d$${vaultFunds}`)
      .button("🏛️ Transferir Bóveda -> Fondo Destinado")
      .button("💸 Desembolsar Único -> Jugador / Contratista")
      .button("📝 Crear Contrato de Pago Programado")
      .button("📋 Gestionar / Inspeccionar Contratos Activos")
      .button("✏️ Ajustar Fondo Destinado Manualmente")
      .button("🔙 Volver");

    form.show(player).then((res) => {
      if (res.canceled) return;
      switch (res.selection) {
        case 0:
          system.run(() => openAdminTransferVaultToFundDialog(player));
          break;
        case 1:
          system.run(() => openAdminDisburseFundDialog(player));
          break;
        case 2:
          system.run(() => openAdminCreateContractDialog(player));
          break;
        case 3:
          system.run(() => openAdminManageContractsDialog(player));
          break;
        case 4:
          system.run(() => openAdminAdjustFundDialog(player));
          break;
        case 5:
          system.run(() => openDesignatedFundsDialog(player));
          break;
      }
    }).catch(() => {});
  });
}

// Sub-Diálogo: Crear Nuevo Contrato de Servicio (Admin)
function openAdminCreateContractDialog(player) {
  system.run(() => {
    if (!player || !player.isValid) return;
    const registry = getGlobalAccountRegistry();
    const registeredNames = Object.keys(registry);
    const onlinePlayers = world.getAllPlayers().map(p => p.name);

    const allNamesSet = new Set([...onlinePlayers, ...registeredNames]);
    const playerNames = Array.from(allNamesSet);

    if (playerNames.length === 0) {
      playerNames.push(player.name);
    }

    const fundKeys = Object.keys(DESIGNATED_FUNDS);
    const fundNames = fundKeys.map(k => DESIGNATED_FUNDS[k].name);
    const intervals = [
      { name: "Cada 5 minutos", min: 5 },
      { name: "Cada 15 minutos", min: 15 },
      { name: "Cada 30 minutos", min: 30 },
      { name: "Cada 1 hora", min: 60 },
      { name: "Cada 2 horas", min: 120 },
      { name: "Cada 24 horas", min: 1440 }
    ];
    const intervalNames = intervals.map(i => i.name);

    const modal = new ModalFormData()
      .title("📝 Crear Contrato Programado")
      .dropdown("Contratista (Jugador):", playerNames, 0)
      .dropdown("Fondo Destinado de Origen:", fundNames, 0)
      .textField("Monto por cuota ($):", "Ej: 1000")
      .dropdown("Frecuencia de pago:", intervalNames, Math.min(2, intervalNames.length - 1))
      .textField("Total de cuotas a pagar:", "Ej: 10")
      .toggle("Retener cuota final como garantía (Escrow)", true)
      .textField("Título o Proyecto del Contrato:", "Ej: Construcción de Puente Sur");

    modal.show(player).then((res) => {
      if (res.canceled) return;
      const contractorName = playerNames[res.formValues[0]];
      const fundKey = fundKeys[res.formValues[1]];
      const amount = Math.floor(Number(res.formValues[2]) || 0);
      const intervalMinutes = intervals[res.formValues[3]].min;
      const totalPayments = Math.floor(Number(res.formValues[4]) || 0);
      const escrowReleaseOnFinish = Boolean(res.formValues[5]);
      const title = String(res.formValues[6] || "Proyecto de Contratación Pública").trim();

      if (amount <= 0 || isNaN(amount)) {
        player.sendMessage("§b§l[§6Banco§b§l]§r §cMonto por cuota inválido.");
        return;
      }
      if (totalPayments <= 0 || isNaN(totalPayments)) {
        player.sendMessage("§b§l[§6Banco§b§l]§r §cTotal de cuotas inválido.");
        return;
      }

      const newContract = {
        id: `contract_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        title,
        contractorName,
        fundKey,
        paymentAmount: amount,
        intervalMinutes,
        totalPayments,
        paymentsMade: 0,
        lastPaidAt: Date.now(),
        status: "active",
        escrowReleaseOnFinish,
        escrowApproved: false,
        createdAt: Date.now(),
        createdBy: player.name
      };

      const firstPay = executeContractorSinglePayment(newContract, true);

      const contracts = getContractorContractsRegistry();
      contracts.push(newContract);
      setContractorContractsRegistry(contracts);

      logPlayerTransaction(contractorName, "Contrato Creado", amount * totalPayments, `Proyecto: ${title} (${totalPayments} cuotas de $${amount})`);
      logPublicStateTransaction("Nuevo Contrato", amount * totalPayments, player.name, `Contrato "${title}" adjudicado a ${contractorName}`);
      broadcastPublicFinancialEvent("Contrato Adjudicado", `Nuevo proyecto "${title}" asignado a ${contractorName} (${totalPayments} cuotas de $${amount}).`);
      playBankSound(player, "upgrade", `§aContrato creado para ${contractorName}`);

      const contractorPlayer = world.getAllPlayers().find(p => p.name.toLowerCase() === contractorName.toLowerCase());
      if (contractorPlayer) {
        playBankSound(contractorPlayer, "upgrade", `§a¡Se te ha asignado el contrato público "${title}"!`);
        contractorPlayer.sendMessage(`§b§l[§6Banco§b§l]§r §a¡Felicidades! Has sido contratado para el proyecto §e"${title}"§a. Recibirás §e$${amount}§a cada §e${intervalMinutes} min§a (${totalPayments} cuotas).`);
      }

      player.sendMessage(`§b§l[§6Banco§b§l]§r §aContrato registrado exitosamente para §b${contractorName}§a. 1ª cuota abonada inmediatamente.`);
    }).catch(() => {});
  });
}

// Diálogo: Gestionar y Administrar Contratos Activos (Admin)
function openAdminManageContractsDialog(player) {
  system.run(() => {
    if (!player || !player.isValid) return;
    const contracts = getContractorContractsRegistry();

    if (contracts.length === 0) {
      const form = new ActionFormData()
        .title("📋 Gestionar Contratos Programados")
        .body("§7No hay contratos registrados en la base de datos.")
        .button("➕ Crear Nuevo Contrato")
        .button("🔙 Volver");

      form.show(player).then((res) => {
        if (res.canceled) return;
        if (res.selection === 0) system.run(() => openAdminCreateContractDialog(player));
        else system.run(() => openAdminDesignatedFundsDialog(player));
      }).catch(() => {});
      return;
    }

    const form = new ActionFormData()
      .title("📋 Gestionar Contratos Programados")
      .body(`§7Lista de contratos públicos activos y en garantía. Selecciona un contrato para inspeccionar, pausar, cancelar o liberar garantía:`);

    for (const c of contracts) {
      const statusIcon = c.status === "active" ? "🟢" :
                         c.status === "paused" ? "🟡" :
                         c.status === "escrow_pending" ? "🔒 (Garantía)" :
                         c.status === "completed" ? "✅" : "❌";

      form.button(`${statusIcon} ${c.title}\n(${c.contractorName} - ${c.paymentsMade}/${c.totalPayments} cuotas)`);
    }

    form.button("➕ Crear Nuevo Contrato");
    form.button("🔙 Volver");

    form.show(player).then((res) => {
      if (res.canceled) return;
      const index = res.selection;
      if (index < contracts.length) {
        system.run(() => openAdminContractDetailDialog(player, contracts[index].id));
      } else if (index === contracts.length) {
        system.run(() => openAdminCreateContractDialog(player));
      } else {
        system.run(() => openAdminDesignatedFundsDialog(player));
      }
    }).catch(() => {});
  });
}

// Sub-Diálogo: Detalle y Acciones de un Contrato Específico
function openAdminContractDetailDialog(player, contractId) {
  system.run(() => {
    if (!player || !player.isValid) return;
    const contracts = getContractorContractsRegistry();
    const index = contracts.findIndex(c => c.id === contractId);
    if (index === -1) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cContrato no encontrado.");
      return;
    }

    const c = contracts[index];
    const fundMeta = DESIGNATED_FUNDS[c.fundKey] || { name: c.fundKey };

    const body = `§l§eDETALLES DEL CONTRATO PÚBLICO\n\n` +
                 `§7- Título: §f${c.title}\n` +
                 `§7- Contratista: §b${c.contractorName}\n` +
                 `§7- Fondo Origen: ${fundMeta.name}\n` +
                 `§7- Monto por cuota: §a$${c.paymentAmount}\n` +
                 `§7- Intervalo: §eCada ${c.intervalMinutes} minutos\n` +
                 `§7- Progreso: §e${c.paymentsMade} / ${c.totalPayments} cuotas pagadas\n` +
                 `§7- Estado: §f${c.status.toUpperCase()}\n` +
                 `§7- Retención de Garantía (Escrow): ${c.escrowReleaseOnFinish ? "SÍ" : "NO"}\n` +
                 `§7- Creado por: §3${c.createdBy || "Admin"}`;

    const form = new ActionFormData()
      .title(`📌 ${c.title}`)
      .body(body);

    if (c.status === "active") {
      form.button("⚡ Ejecutar Cuota de Pago Ahora (Forzar)");
      form.button("⏸️ Pausar Contrato");
    } else if (c.status === "paused") {
      form.button("▶️ Reanudar Contrato");
    }

    if (c.status === "escrow_pending") {
      form.button("🔓 Inspeccionar y Liberar Garantía (Aprobar Pago Final)");
    }

    if (c.status === "active" || c.status === "paused") {
      form.button("❌ Cancelar Contrato Anticipadamente");
    }

    form.button("🗑️ Eliminar Registro");
    form.button("🔙 Volver");

    form.show(player).then((res) => {
      if (res.canceled) return;
      let buttonIdx = 0;

      if (c.status === "active") {
        if (res.selection === buttonIdx) {
          const result = executeContractorSinglePayment(c, true);
          setContractorContractsRegistry(contracts);
          if (result.success) {
            if (result.escrowPending) {
              player.sendMessage(`§b§l[§6Banco§b§l]§r §eCuotas ordinarias finalizadas. El contrato "${c.title}" pasó a estado de Garantía Pendiente (Escrow).`);
            } else {
              player.sendMessage(`§b§l[§6Banco§b§l]§r §a¡Cuota de pago ejecutada exitosamente! (${c.paymentsMade}/${c.totalPayments}).`);
            }
          } else {
            player.sendMessage(`§b§l[§6Banco§b§l]§r §cError al ejecutar cuota: ${result.reason}`);
          }
          system.run(() => openAdminContractDetailDialog(player, contractId));
          return;
        }
        buttonIdx++;

        if (res.selection === buttonIdx) {
          c.status = "paused";
          setContractorContractsRegistry(contracts);
          player.sendMessage(`§b§l[§6Banco§b§l]§r §eEl contrato "${c.title}" ha sido PAUSADO.`);
          system.run(() => openAdminManageContractsDialog(player));
          return;
        }
        buttonIdx++;
      } else if (c.status === "paused") {
        if (res.selection === buttonIdx) {
          c.status = "active";
          setContractorContractsRegistry(contracts);
          player.sendMessage(`§b§l[§6Banco§b§l]§r §aEl contrato "${c.title}" ha sido REANUDADO.`);
          system.run(() => openAdminManageContractsDialog(player));
          return;
        }
        buttonIdx++;
      }

      if (c.status === "escrow_pending") {
        if (res.selection === buttonIdx) {
          const currentFundBal = getDesignatedFundAmount(c.fundKey);
          const amount = c.paymentAmount;
          if (currentFundBal < amount) {
            player.sendMessage(`§b§l[§6Banco§b§l]§r §cNo hay suficiente saldo en ${fundMeta.name} para desembolsar la cuota de garantía ($${amount}).`);
            return;
          }

          setDesignatedFundAmount(c.fundKey, currentFundBal - amount);
          c.escrowApproved = true;
          c.paymentsMade = c.totalPayments;
          c.status = "completed";
          setContractorContractsRegistry(contracts);

          const onlinePlayer = world.getAllPlayers().find(p => p.name.toLowerCase() === c.contractorName.toLowerCase());
          if (onlinePlayer) {
            setScore(onlinePlayer, getScore(onlinePlayer) + amount, "escrow_release");
            playBankSound(onlinePlayer, "upgrade", `§a¡Garantía aprobada! Recibes la cuota final de $${amount} de: ${c.title}`);
          } else {
            const registry = getGlobalAccountRegistry();
            if (!registry[c.contractorName]) {
              registry[c.contractorName] = { cash: amount, savings: 0, loan: 0, history: [] };
            } else {
              registry[c.contractorName].cash = (registry[c.contractorName].cash ?? 0) + amount;
            }
          }
          logPlayerTransaction(c.contractorName, "Garantía Liberada", amount, `Aprobación final de obra: ${c.title}`);
          logPublicStateTransaction("Garantía Liberada", amount, player.name, `Obra aprobada: ${c.title} para ${c.contractorName}`);
          broadcastPublicFinancialEvent("Garantía de Obra Liberada", `Inspección aprobada y pago final de $${amount} entregado a ${c.contractorName} por: "${c.title}".`);
          player.sendMessage(`§b§l[§6Banco§b§l]§r §a¡Garantía aprobada y desembolsada exitosamente a ${c.contractorName}!`);
          system.run(() => openAdminManageContractsDialog(player));
          return;
        }
        buttonIdx++;
      }

      if (c.status === "active" || c.status === "paused") {
        if (res.selection === buttonIdx) {
          c.status = "cancelled";
          setContractorContractsRegistry(contracts);
          player.sendMessage(`§b§l[§6Banco§b§l]§r §cEl contrato "${c.title}" ha sido CANCELADO.`);
          system.run(() => openAdminManageContractsDialog(player));
          return;
        }
        buttonIdx++;
      }

      if (res.selection === buttonIdx) {
        contracts.splice(index, 1);
        setContractorContractsRegistry(contracts);
        player.sendMessage(`§b§l[§6Banco§b§l]§r §aRegistro del contrato eliminado.`);
        system.run(() => openAdminManageContractsDialog(player));
        return;
      }

      system.run(() => openAdminManageContractsDialog(player));
    }).catch(() => {});
  });
}

// Sub-Diálogo: Transferir de Bóveda Central a Fondo Destinado
function openAdminTransferVaultToFundDialog(player) {
  const vaultFunds = getVaultFunds();
  const fundKeys = Object.keys(DESIGNATED_FUNDS);
  const fundNames = fundKeys.map(k => DESIGNATED_FUNDS[k].name);

  const modal = new ModalFormData()
    .title("🏛️ Bóveda -> Fondo Destinado")
    .dropdown("Selecciona el Fondo de destino:", fundNames)
    .textField(`Bóveda Central Disponible: $${vaultFunds}\nIngresa el monto a transferir:`, "Monto entero positivo");

  modal.show(player).then((res) => {
    if (res.canceled) return;
    const fundIndex = res.formValues[0];
    const fundKey = fundKeys[fundIndex];
    const val = Math.floor(Number(res.formValues[1]) || 0);

    if (val <= 0 || isNaN(val)) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cMonto inválido.");
      return;
    }
    if (vaultFunds < val) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cLa Bóveda Central no tiene suficientes fondos libres.");
      return;
    }

    setVaultFunds(vaultFunds - val);
    const current = getDesignatedFundAmount(fundKey);
    setDesignatedFundAmount(fundKey, current + val);
    logPublicStateTransaction("Asignación Bóveda", val, player.name, `Asignado al ${DESIGNATED_FUNDS[fundKey].name}`);
    broadcastPublicFinancialEvent("Presupuesto Asignado", `Se asignaron $${val} al ${DESIGNATED_FUNDS[fundKey].name}.`);
    playBankSound(player, "income", `§aAsignados $${val} desde la Bóveda al ${DESIGNATED_FUNDS[fundKey].name}`);
    player.sendMessage(`§b§l[§6Banco§b§l]§r §aPresupuesto asignado exitosamente. Saldo en ${DESIGNATED_FUNDS[fundKey].name}: §e$${current + val}§a.`);
  }).catch(() => {});
}

// Sub-Diálogo: Desembolsar dinero de un Fondo Destinado a un Jugador (Pago Único)
function openAdminDisburseFundDialog(player) {
  const fundKeys = Object.keys(DESIGNATED_FUNDS);
  const fundNames = fundKeys.map(k => `${DESIGNATED_FUNDS[k].name} ($${getDesignatedFundAmount(k)})`);
  const players = world.getAllPlayers();
  const playerNames = players.map(p => p.name);

  if (playerNames.length === 0) {
    player.sendMessage("§b§l[§6Banco§b§l]§r §cNo hay jugadores en línea para recibir desembolsos.");
    return;
  }

  const modal = new ModalFormData()
    .title("💸 Desembolso Único de Fondo")
    .dropdown("Fondo de Origen:", fundNames)
    .dropdown("Jugador Destinatario (En línea):", playerNames)
    .textField("Monto a desembolsar:", "Monto entero positivo")
    .textField("Motivo / Concepto del pago:", "Ej: Construcción de Carretera Central / Premio Torneo");

  modal.show(player).then((res) => {
    if (res.canceled) return;
    const fundKey = fundKeys[res.formValues[0]];
    const targetPlayerName = playerNames[res.formValues[1]];
    const val = Math.floor(Number(res.formValues[2]) || 0);
    const reason = String(res.formValues[3] || "Desembolso de fondo público").trim();

    const targetPlayer = players.find(p => p.name === targetPlayerName);
    if (!targetPlayer) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cJugador no encontrado.");
      return;
    }

    const currentFund = getDesignatedFundAmount(fundKey);
    if (val <= 0 || isNaN(val)) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cMonto inválido.");
      return;
    }
    if (currentFund < val) {
      player.sendMessage(`§b§l[§6Banco§b§l]§r §cEl ${DESIGNATED_FUNDS[fundKey].name} no dispone de $${val} (Disponible: $${currentFund}).`);
      return;
    }

    const targetBal = getScore(targetPlayer);
    if (setScore(targetPlayer, targetBal + val, "fund_disbursement")) {
      setDesignatedFundAmount(fundKey, currentFund - val);
      logPlayerTransaction(targetPlayer.name, "Pago de Fondo", val, `Concepto: ${reason} (Origen: ${DESIGNATED_FUNDS[fundKey].name})`);
      logPublicStateTransaction("Desembolso Público", val, player.name, `Pago a ${targetPlayer.name}: ${reason}`);
      broadcastPublicFinancialEvent("Desembolso Público", `Pago de $${val} entregado a ${targetPlayer.name} (Concepto: ${reason}).`);
      playBankSound(targetPlayer, "income", `§a¡Has recibido un pago público de $${val}! Motivo: ${reason}`);
      player.sendMessage(`§b§l[§6Banco§b§l]§r §a¡Desembolso exitoso! Enviados §e$${val}§a a §b${targetPlayer.name}§a. Saldo restante en ${DESIGNATED_FUNDS[fundKey].name}: §e$${currentFund - val}§a.`);
    } else {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cError al acreditar los fondos al jugador.");
    }
  }).catch(() => {});
}

// Sub-Diálogo: Ajuste Manual de Fondo Destinado
function openAdminAdjustFundDialog(player) {
  const fundKeys = Object.keys(DESIGNATED_FUNDS);
  const fundNames = fundKeys.map(k => `${DESIGNATED_FUNDS[k].name} ($${getDesignatedFundAmount(k)})`);

  const modal = new ModalFormData()
    .title("✏️ Ajuste Manual de Fondo")
    .dropdown("Fondo a ajustar:", fundNames)
    .textField("Nuevo Saldo del Fondo ($):", "Monto entero no negativo");

  modal.show(player).then((res) => {
    if (res.canceled) return;
    const fundKey = fundKeys[res.formValues[0]];
    const val = Math.floor(Number(res.formValues[1]) || 0);

    if (val < 0 || isNaN(val)) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cMonto inválido.");
      return;
    }

    setDesignatedFundAmount(fundKey, val);
    player.sendMessage(`§b§l[§6Banco§b§l]§r §aEl saldo del ${DESIGNATED_FUNDS[fundKey].name} se ajustó manualmente a §e$${val}§a.`);
  }).catch(() => {});
}

// Diálogo: Depositar Ahorros
function openBankDepositDialog(player) {
  const handBal = getScore(player);
  const savings = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_SAVINGS_PROPERTY) ?? 0);
  
  const modal = new ModalFormData()
    .title("📥 Depositar Ahorros")
    .textField(`Saldo disponible: $${handBal}\nIngresa el monto a depositar:`, "Monto entero positivo");
    
  modal.show(player).then((res) => {
    if (res.canceled) return;
    const val = Math.floor(Number(res.formValues[0]) || 0);
    if (val <= 0 || isNaN(val)) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cMonto de depósito inválido.");
      return;
    }
    if (handBal < val) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cNo tienes suficiente dinero en mano.");
      return;
    }
    
    // Deducción y depósito
    if (setScore(player, handBal - val, "bank_deposit")) {
      const nextSavings = savings + val;
      setPlayerBankDetails(player, nextSavings, Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_LOAN_PROPERTY) ?? 0));
      logPlayerTransaction(player.name, "Depósito", val, "Depósito manual en ahorros");
      // Iniciar el cooldown de intereses en este momento si era la primera vez
      if (globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_INTEREST_COOLDOWN_PROPERTY) === undefined || globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_INTEREST_COOLDOWN_PROPERTY) === null) {
        globalThis.__sqlite_set_prop_v2__("currency_addon", player, BANK_INTEREST_COOLDOWN_PROPERTY, Date.now());
      }
      
      // Actualizar saldo mínimo del período
      let minSavings = globalThis.__sqlite_get_prop_v2__("currency_addon", player, "bank_min_savings_v1");
      if (minSavings === undefined || minSavings === null) {
        globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_min_savings_v1", nextSavings);
      } else {
        globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_min_savings_v1", Math.min(Number(minSavings), nextSavings));
      }
      
      // Añadir depósito a la bóveda
      try {
        const currentVault = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "bank_vault_funds") ?? 0);
        globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "bank_vault_funds", currentVault + val);
      } catch (e) {}
      
      player.sendMessage(`§b§l[§6Banco§b§l]§r §a¡Depósito exitoso! Has guardado §e$${val}§a. Saldo en ahorros: §b$${nextSavings}§a.`);
    } else {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cError al realizar la transacción.");
    }
  }).catch(() => {});
}

// Diálogo: Retirar Ahorros
function openBankWithdrawDialog(player) {
  const handBal = getScore(player);
  const savings = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_SAVINGS_PROPERTY) ?? 0);
  
  const modal = new ModalFormData()
    .title("📤 Retirar Ahorros")
    .textField(`Ahorros disponibles: $${savings}\nIngresa el monto a retirar:`, "Monto entero positivo");
    
  modal.show(player).then((res) => {
    if (res.canceled) return;
    const val = Math.floor(Number(res.formValues[0]) || 0);
    if (val <= 0 || isNaN(val)) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cMonto de retiro inválido.");
      return;
    }
    const vaultFunds = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "bank_vault_funds") ?? 0);
    if (vaultFunds < val) {
      player.sendMessage(`§b§l[§6Banco§b§l]§r §cEl banco no dispone de suficiente liquidez en sus reservas en este momento para procesar tu retiro. Reservas del banco: §d$${vaultFunds}§c.`);
      return;
    }
    if (savings < val) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cNo tienes suficientes ahorros para retirar ese monto.");
      return;
    }
    
    // Transacción
    if (setScore(player, handBal + val, "bank_withdraw")) {
      const nextSavings = savings - val;
      setPlayerBankDetails(player, nextSavings, Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_LOAN_PROPERTY) ?? 0));
      logPlayerTransaction(player.name, "Retiro", val, "Retiro manual de ahorros");
      globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_skip_repay_until", Date.now() + 3000); // 3 segundos de período de gracia
      
      // Actualizar saldo mínimo del período
      let minSavings = globalThis.__sqlite_get_prop_v2__("currency_addon", player, "bank_min_savings_v1");
      if (minSavings === undefined || minSavings === null) {
        globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_min_savings_v1", nextSavings);
      } else {
        globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_min_savings_v1", Math.min(Number(minSavings), nextSavings));
      }
      
      // Deducir del banco
      try {
        globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "bank_vault_funds", Math.max(0, vaultFunds - val));
      } catch (e) {}
      
      player.sendMessage(`§b§l[§6Banco§b§l]§r §a¡Retiro exitoso! Has retirado §e$${val}§a. Ahorros restantes: §b$${nextSavings}§a.`);
    } else {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cError al realizar la transacción.");
    }
  }).catch(() => {});
}

// === SISTEMA DE PUNTAJE CREDITICIO Y CRÉDITO AVANZADO (5 MEJORAS) ===

function getPlayerCreditData(player) {
  const savings = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_SAVINGS_PROPERTY) ?? 0);
  const repaidCount = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, "bank_loans_repaid_count_v1") ?? 0);
  const dueDate = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, "bank_loan_due_date_v1") ?? 0);
  const loan = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_LOAN_PROPERTY) ?? 0);

  let score = 500; // Base score

  // Bonificación por ahorros (+1 pt por cada $2,000 ahorrados, máx +150)
  score += Math.min(150, Math.floor(savings / 2000));

  // Bonificación por préstamos cancelados (+25 pts por cada uno, máx +150)
  score += Math.min(150, repaidCount * 25);

  // Penalización si la deuda está vencida
  const isOverdue = loan > 0 && dueDate > 0 && Date.now() > dueDate;
  if (isOverdue) {
    score -= 100;
  }

  score = Math.max(300, Math.min(850, score));

  let rating = "§cDEFICIENTE";
  if (score >= 750) rating = "§dEXCELENTE (VIP)";
  else if (score >= 650) rating = "§aBUENO";
  else if (score >= 550) rating = "§eREGULAR";

  const tier = getAccountTier(player);
  const maxLimit = Math.floor(tier.maxLoan * (score / 500));

  return {
    score,
    rating,
    repaidCount,
    dueDate,
    isOverdue,
    maxLimit
  };
}

// Diálogo: Solicitud de Préstamo Avanzado con Score Crediticio y Colateral
function openBankLoanRequestDialog(player) {
  const handBal = getScore(player);
  const loan = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_LOAN_PROPERTY) ?? 0);
  
  if (loan > 0) {
    openBankActiveLoanMenuDialog(player);
    return;
  }
  
  const credit = getPlayerCreditData(player);
  const savings = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_SAVINGS_PROPERTY) ?? 0);

  const modal = new ModalFormData()
    .title("💰 Pedir un Préstamo")
    .textField(`Score Crediticio: ${credit.rating} (${credit.score} pts)\n` +
               `Límite Aprobado: $${credit.maxLimit}\n` +
               `Comisión Administrativa: 5%\n` +
               `Plazo de pago: 7 días\n\n` +
               `Ingresa el monto a solicitar (Máx $${credit.maxLimit}):`, "Monto entero positivo");

  modal.show(player).then((res) => {
    if (res.canceled) return;
    const val = Math.floor(Number(res.formValues[0]) || 0);
    const vaultFunds = getVaultFunds();

    if (val <= 0 || isNaN(val)) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cMonto de préstamo inválido.");
      return;
    }
    if (val > credit.maxLimit) {
      player.sendMessage(`§b§l[§6Banco§b§l]§r §cTu límite de crédito aprobado según tu Score (${credit.score} pts) es de §e$${credit.maxLimit}§c.`);
      return;
    }
    if (vaultFunds < val) {
      player.sendMessage(`§b§l[§6Banco§b§l]§r §cLa Bóveda Central no dispone de suficiente liquidez ($${vaultFunds}) para financiar tu préstamo.`);
      return;
    }

    const debtAmount = Math.floor(val * LOAN_INTEREST_RATE);
    const dueDate = Date.now() + 7 * 24 * 60 * 60 * 1000;

    if (setScore(player, handBal + val, "bank_loan_request")) {
      setPlayerBankDetails(player, savings, debtAmount);
      globalThis.__sqlite_set_prop_v2__("currency_addon", player, BANK_LOAN_TRANSFER_LOCK_PROPERTY, val);
      globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_loan_due_date_v1", dueDate);
      globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_skip_repay_until", Date.now() + 3000);

      setVaultFunds(Math.max(0, vaultFunds - val));

      logPlayerTransaction(player.name, "Préstamo Aprobado", val, `Monto con comisión: $${debtAmount} (Vence en 7 días)`);
      logPublicStateTransaction("Préstamo Concedido", val, player.name, `Préstamo concedido a ${player.name}`);
      playBankSound(player, "upgrade", `§a¡Préstamo de $${val} aprobado!`);
      player.sendMessage(`§b§l[§6Banco§b§l]§r §a¡Préstamo aprobado! Recibes §e$${val}§a en mano.\n§7Deuda a pagar: §c$${debtAmount}§7. Vence en: §e7 días§7.`);
    }
  }).catch(() => {});
}

// Diálogo: Gestión de Préstamo Activo (Amortizar / Refinanciar)
function openBankActiveLoanMenuDialog(player) {
  const loan = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_LOAN_PROPERTY) ?? 0);
  const credit = getPlayerCreditData(player);
  const handBal = getScore(player);
  const transferable = getAvailableTransferBalance(player);

  let dueDateStr = "Sin fecha";
  if (credit.dueDate > 0) {
    const remainSec = Math.max(0, Math.ceil((credit.dueDate - Date.now()) / 1000));
    const days = Math.floor(remainSec / 86400);
    const hours = Math.floor((remainSec % 86400) / 3600);
    dueDateStr = credit.isOverdue ? "§c¡DEUDA VENCIDA!" : `§e${days}d ${hours}h restantes`;
  }

  const form = new ActionFormData()
    .title("💰 Tu Préstamo Activo")
    .body(`§l§eESTADO DE TU CRÉDITO\n\n` +
          `§7- Deuda Pendiente: §c$${loan}\n` +
          `§7- Saldo en Mano: §a$${handBal}\n` +
          `§7- Disponible para transferir: §a$${transferable}\n` +
          `§7- Plazo de Vencimiento: ${dueDateStr}\n` +
          `§7- Score Crediticio: ${credit.rating} (${credit.score} pts)\n\n` +
          `§8Nota: el capital prestado no puede transferirse a otros jugadores. El 20% de tus ganancias se aplica automáticamente al pago del préstamo.`)
    .button("💸 Amortizar / Pagar Manualmente")
    .button("🔄 Refinanciar Deuda (Extender Plazo)")
    .button("🔙 Volver");

  form.show(player).then((res) => {
    if (res.canceled) return;
    if (res.selection === 0) {
      openBankLoanPaybackDialog(player);
    } else if (res.selection === 1) {
      openBankLoanRefinanceDialog(player);
    } else {
      openGeneralBankMenu(player);
    }
  }).catch(() => {});
}

// Diálogo: Refinanciar Deuda (Mejora 4)
function openBankLoanRefinanceDialog(player) {
  const loan = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_LOAN_PROPERTY) ?? 0);
  if (loan <= 0) return;

  const fee = Math.floor(loan * 0.02);
  const newLoan = loan + fee;

  const modal = new ModalFormData()
    .title("🔄 Refinanciar Deuda")
    .textField(`Al refinanciar:\n` +
               `- Se extiende tu plazo de vencimiento por 7 DÍAS más.\n` +
               `- Se aplica un cargo de reestructuración del 2% ($${fee}).\n` +
               `- Nueva deuda total: $${newLoan}.\n\n` +
               `Escribe "ACEPTAR" para confirmar el refinanciamiento:`, "ACEPTAR");

  modal.show(player).then((res) => {
    if (res.canceled) return;
    const confirm = String(res.formValues[0] || "").trim().toUpperCase();
    if (confirm !== "ACEPTAR") {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cDebes escribir ACEPTAR para refinanciar.");
      return;
    }

    const newDueDate = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const savings = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_SAVINGS_PROPERTY) ?? 0);
    setPlayerBankDetails(player, savings, newLoan);
    globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_loan_due_date_v1", newDueDate);

    logPlayerTransaction(player.name, "Refinanciación", fee, `Reestructuración a 7 días. Deuda final: $${newLoan}`);
    playBankSound(player, "upgrade", "§a¡Deuda refinanciada!");
    player.sendMessage(`§b§l[§6Banco§b§l]§r §a¡Refinanciación aprobada! Tu nuevo plazo es de §e7 días§a y la deuda refinanciada es de §c$${newLoan}§a.`);
  }).catch(() => {});
}

// Diálogo: Amortizar / Pagar Préstamo Manualmente
function openBankLoanPaybackDialog(player) {
  const handBal = getScore(player);
  const loan = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_LOAN_PROPERTY) ?? 0);

  if (loan <= 0) {
    player.sendMessage("§b§l[§6Banco§b§l]§r §aNo tienes deudas activas en este momento.");
    return;
  }

  const modal = new ModalFormData()
    .title("💸 Amortizar Préstamo")
    .textField(`Deuda actual: $${loan}\nSaldo en mano: $${handBal}\nIngresa el monto a abonar/pagar:`, "Monto entero positivo");

  modal.show(player).then((res) => {
    if (res.canceled) return;
    const val = Math.floor(Number(res.formValues[0]) || 0);
    if (val <= 0 || isNaN(val)) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cMonto a pagar inválido.");
      return;
    }
    if (handBal < val) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cNo tienes suficiente dinero en mano.");
      return;
    }

    const payment = Math.min(loan, val);
    if (setScore(player, handBal - payment, "bank_loan_payback_manual")) {
      const nextLoan = loan - payment;
      const savings = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, BANK_SAVINGS_PROPERTY) ?? 0);
      setPlayerBankDetails(player, savings, nextLoan);
      releaseLoanTransferLock(player, payment, nextLoan);
      logPlayerTransaction(player.name, "Pago Préstamo", payment, "Abono manual realizado");

      setVaultFunds(getVaultFunds() + payment);

      if (nextLoan <= 0) {
        const repaidCount = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", player, "bank_loans_repaid_count_v1") ?? 0) + 1;
        globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_loans_repaid_count_v1", repaidCount);
        globalThis.__sqlite_set_prop_v2__("currency_addon", player, "bank_loan_due_date_v1", undefined);
        playBankSound(player, "upgrade", "§a¡Préstamo liquidado por completo!");
        player.sendMessage("§b§l[§6Banco§b§l]§r §a¡Felicidades! Has liquidado tu préstamo por completo. ¡Tu Score Crediticio ha mejorado!");
      } else {
        playBankSound(player, "income", `§aAbonados $${payment} al préstamo`);
        player.sendMessage(`§b§l[§6Banco§b§l]§r §aPago exitoso. Has abonado §e$${payment}§a. Deuda restante: §c$${nextLoan}§a.`);
      }
    } else {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cError al procesar la transacción.");
    }
  }).catch(() => {});
}

// Diálogo: Gestor Administrativo de Deudas (Panel de Control de Préstamos - Admin / Owner)
function openAdminLoanManagementDialog(player) {
  const registry = getGlobalAccountRegistry();
  const indebtedPlayers = Object.keys(registry).filter(name => (registry[name].loan ?? 0) > 0);

  if (indebtedPlayers.length === 0) {
    const form = new ActionFormData()
      .title("⚖️ Gestión Administrativa de Deudas")
      .body("§7No hay jugadores con deudas activas registrados en la banca.")
      .button("🔙 Volver");

    form.show(player).then(() => openBankOwnerPanel(player)).catch(() => {});
    return;
  }

  const form = new ActionFormData()
    .title("⚖️ Gestión Administrativa de Deudas")
    .body(`§7Se encontraron §c${indebtedPlayers.length}§7 deudores activos. Selecciona un deudor para condonar, reestructurar o ajustar su préstamo:`);

  for (const name of indebtedPlayers) {
    const loan = registry[name].loan;
    form.button(`👤 ${name} - Deuda: $${loan}`);
  }
  form.button("🔙 Volver");

  form.show(player).then((res) => {
    if (res.canceled) return;
    const sel = res.selection;
    if (sel < indebtedPlayers.length) {
      openAdminPlayerLoanDetailDialog(player, indebtedPlayers[sel]);
    } else {
      openBankOwnerPanel(player);
    }
  }).catch(() => {});
}

function openAdminPlayerLoanDetailDialog(player, targetName) {
  const registry = getGlobalAccountRegistry();
  const acc = registry[targetName];
  if (!acc) return;

  const body = `§l§eDETALLES DE DEUDA DEL JUGADOR\n\n` +
               `§7- Jugador: §b${targetName}\n` +
               `§7- Deuda Registrada: §c$${acc.loan}\n` +
               `§7- Ahorros Guardados: §b$${acc.savings}\n` +
               `§7- Efectivo Estimado: §a$${acc.cash ?? 0}`;

  const form = new ActionFormData()
    .title(`👤 Deuda de ${targetName}`)
    .body(body)
    .button("🕊️ Condonar / Perdonar Deuda Completa")
    .button("✏️ Fijar Monto de Deuda Manualmente")
    .button("🔙 Volver");

  form.show(player).then((res) => {
    if (res.canceled) return;
    if (res.selection === 0) {
      const forgivenLoan = acc.loan;
      const targetPlayer = world.getAllPlayers().find(p => p.name.toLowerCase() === targetName.toLowerCase());
      if (targetPlayer) {
        setPlayerBankDetails(targetPlayer, Number(globalThis.__sqlite_get_prop_v2__("currency_addon", targetPlayer, BANK_SAVINGS_PROPERTY) ?? 0), 0);
        globalThis.__sqlite_set_prop_v2__("currency_addon", targetPlayer, BANK_LOAN_TRANSFER_LOCK_PROPERTY, undefined);
        globalThis.__sqlite_set_prop_v2__("currency_addon", targetPlayer, "bank_loan_due_date_v1", undefined);
        targetPlayer.sendMessage("§b§l[§6Banco§b§l]§r §a¡Tu préstamo ha sido condonado/perdonado oficialmente por la administración!");
      } else {
        registry[targetName].loan = 0;
        globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "bank_accounts_registry_v2", JSON.stringify(registry));
      }

      logPlayerTransaction(targetName, "Condonación Deuda", forgivenLoan, `Deuda condonada por admin ${player.name}`);
      logPublicStateTransaction("Condonación de Deuda", forgivenLoan, player.name, `Condonada la deuda de $${forgivenLoan} a ${targetName}`);
      broadcastPublicFinancialEvent("Condonación de Deuda", `La administración ha condonado la deuda pública de $${forgivenLoan} a ${targetName}.`);
      player.sendMessage(`§b§l[§6Banco§b§l]§r §a¡Deuda de §e$${forgivenLoan}§a condonada a §b${targetName}§a!`);
      openAdminLoanManagementDialog(player);
    } else if (res.selection === 1) {
      openAdminSetPlayerLoanDialog(player, targetName);
    } else {
      openAdminLoanManagementDialog(player);
    }
  }).catch(() => {});
}

function openAdminSetPlayerLoanDialog(player, targetName) {
  const registry = getGlobalAccountRegistry();
  const acc = registry[targetName];
  if (!acc) return;

  const modal = new ModalFormData()
    .title("✏️ Ajustar Deuda Manualmente")
    .textField(`Deuda actual de ${targetName}: $${acc.loan}\nIngresa el nuevo monto de deuda ($):`, "Monto entero no negativo");

  modal.show(player).then((res) => {
    if (res.canceled) return;
    const newLoan = Math.floor(Number(res.formValues[0]) || 0);

    if (newLoan < 0 || isNaN(newLoan)) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cMonto inválido.");
      return;
    }

    const targetPlayer = world.getAllPlayers().find(p => p.name.toLowerCase() === targetName.toLowerCase());
    if (targetPlayer) {
      setPlayerBankDetails(targetPlayer, Number(globalThis.__sqlite_get_prop_v2__("currency_addon", targetPlayer, BANK_SAVINGS_PROPERTY) ?? 0), newLoan);
    } else {
      registry[targetName].loan = newLoan;
      globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "bank_accounts_registry_v2", JSON.stringify(registry));
    }

    logPlayerTransaction(targetName, "Ajuste Deuda Admin", newLoan, `Deuda ajustada por ${player.name}`);
    player.sendMessage(`§b§l[§6Banco§b§l]§r §aDeuda de §b${targetName}§a ajustada a §c$${newLoan}§a.`);
    openAdminLoanManagementDialog(player);
  }).catch(() => {});
}

// Diálogo: Panel del Propietario (ElOmar3 / OPs)
function openBankOwnerPanel(player) {
  const interestRate = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", GLOBAL_INTEREST_RATE_PROPERTY) ?? 1.5);
  const vaultFunds = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "bank_vault_funds") ?? 0);
  const totalDesignated = getTotalDesignatedFunds();
  
  const form = new ActionFormData()
    .title("🛠️ Panel del Propietario (ElOmar3)")
    .body(`§7Control administrativo y auditoría de la banca general.\n\nTasa de Interés: §e${interestRate}% diario\nBóveda Central: §d$${vaultFunds}\nFondos Destinados: §6$${totalDesignated}`)
    .button("📈 Cambiar Tasa de Interés")
    .button("💰 Inyectar / Retirar Capital de Bóveda")
    .button("🔍 Auditar Cuentas de Jugadores")
    .button("🕵️ Detectar Lavado / Anomalías")
    .button("⚖️ Administrar Impuestos")
    .button("🏛️ Presupuestos y Fondos Destinados")
    .button("⚖️ Gestión Administrativa de Deudas")
    .button("🔙 Volver");
    
  form.show(player).then((res) => {
    if (res.canceled) return;
    switch (res.selection) {
      case 0: // Cambiar tasa
        openBankChangeInterestRateDialog(player);
        break;
      case 1: // Inyectar/Retirar capital
        openBankAdjustReservesDialog(player);
        break;
      case 2: // Auditar cuentas
        openBankAuditPlayersDialog(player);
        break;
      case 3: // Detectar lavado/anomalías
        openBankDetectMoneyLaunderingDialog(player);
        break;
      case 4: // Administrar impuestos
        openBankTaxManagementDialog(player);
        break;
      case 5: // Presupuestos y Fondos Destinados
        openAdminDesignatedFundsDialog(player);
        break;
      case 6: // Gestión Administrativa de Deudas
        openAdminLoanManagementDialog(player);
        break;
      case 7: // Volver
        openGeneralBankMenu(player);
        break;
    }
  }).catch(() => {});
}

// Diálogo: Detección automatizada de lavado de dinero, evasión fiscal y riesgos financieros
function openBankDetectMoneyLaunderingDialog(player) {
  const registry = getGlobalAccountRegistry();
  const playerNames = Object.keys(registry);
  
  const alerts = [];
  const wealthThreshold = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "tax_wealth_threshold_v1") ?? 100000);
  
  const evasionMin = wealthThreshold * 0.90;
  const evasionMax = wealthThreshold - 1;
  
  for (const name of playerNames) {
    const data = registry[name];
    const savings = data.savings ?? 0;
    
    // 1. Evasión del impuesto a la riqueza
    if (savings >= evasionMin && savings <= evasionMax) {
      alerts.push(`§e[EVASIÓN DE IMPUESTOS] §b${name}§7 tiene §a$${savings}§7 (aparcado estratégicamente bajo el límite impositivo de $${wealthThreshold})`);
    }
    
    // 2. Alto riesgo por deuda impagada sin ahorros
    if (data.loan > 30000 && savings < 1000) {
      alerts.push(`§c[ALTO RIESGO BANCARIO] §b${name}§7 debe §c$${data.loan}§7 pero tiene ahorrado solo §a$${savings}§7`);
    }
    
    // 3. Posible lavado de dinero o flujos inusuales repetitivos
    if (data.history && Array.isArray(data.history)) {
      const txCount = {};
      for (const tx of data.history) {
        if (tx.type && (tx.type.includes("Transf") || tx.type.includes("pay") || tx.type.includes("Pago"))) {
          const detail = tx.details || "";
          // Buscar nombres de jugadores en la descripción de la transferencia
          const match = detail.match(/a ([a-zA-Z0-9_\s]+)|de ([a-zA-Z0-9_\s]+)/i);
          const partner = match ? (match[1] || match[2] || "").trim() : "";
          if (partner && partner.toLowerCase() !== name.toLowerCase()) {
            txCount[partner] = (txCount[partner] || 0) + 1;
            if (txCount[partner] >= 3) {
              alerts.push(`§d[LAVADO / MOVIMIENTO INUSUAL] §b${name}§7 registra múltiples transferencias consecutivas con §3${partner}§7`);
            }
          }
        }
      }
    }
  }
  
  const bodyText = alerts.length > 0 
    ? `§7Se han detectado las siguientes alertas en la economía del servidor:\n\n` + alerts.join("\n\n")
    : `§a¡No se han detectado alertas de lavado de dinero, evasión fiscal ni riesgos financieros significativos en este momento!`;
    
  const form = new ActionFormData()
    .title("🕵️ Detección de Lavado / Anomalías")
    .body(bodyText)
    .button("🔙 Volver");
    
  form.show(player).then(() => {
    openBankOwnerPanel(player);
  }).catch(() => {});
}

// Diálogo: Administrar Impuestos de la Economía
function openBankTaxManagementDialog(player) {
  const buyTax = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "tax_shop_buy_rate_v1") ?? 5);
  const sellTax = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "tax_shop_sell_rate_v1") ?? 5);
  const transferTax = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "tax_transfer_rate_v1") ?? 2);
  const wealthThreshold = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "tax_wealth_threshold_v1") ?? 100000);
  const wealthTax = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "tax_wealth_rate_v1") ?? 0.1);
  const predialRate = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "tax_predial_rate_v1") ?? 0.05);
  
  const modal = new ModalFormData()
    .title("⚖️ Administrar Impuestos")
    .textField("Impuesto Compra Tienda (IVA - %):", "Ej: 5", String(buyTax))
    .textField("Impuesto Venta Tienda (Retención - %):", "Ej: 5", String(sellTax))
    .textField("Impuesto de Transferencia (ITF - %):", "Ej: 2", String(transferTax))
    .textField("Umbral Impuesto Riqueza ($):", "Ej: 100000", String(wealthThreshold))
    .textField("Tasa Impuesto Riqueza (% diario):", "Ej: 0.1", String(wealthTax))
    .textField("Tasa Impuesto Predial ($ por bloque de área):", "Ej: 0.05", String(predialRate));
    
  modal.show(player).then((res) => {
    if (res.canceled) return;
    const newBuyTax = parseFloat(res.formValues[0]);
    const newSellTax = parseFloat(res.formValues[1]);
    const newTransferTax = parseFloat(res.formValues[2]);
    const newWealthThreshold = Math.floor(Number(res.formValues[3]) || 0);
    const newWealthTax = parseFloat(res.formValues[4]);
    const newPredialRate = parseFloat(res.formValues[5]);
    
    if (isNaN(newBuyTax) || newBuyTax < 0 || newBuyTax > 50 ||
        isNaN(newSellTax) || newSellTax < 0 || newSellTax > 50 ||
        isNaN(newTransferTax) || newTransferTax < 0 || newTransferTax > 50 ||
        isNaN(newWealthThreshold) || newWealthThreshold < 0 ||
        isNaN(newWealthTax) || newWealthTax < 0 || newWealthTax > 5 ||
        isNaN(newPredialRate) || newPredialRate < 0 || newPredialRate > 10) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cValores de impuestos inválidos.");
      return;
    }
    
    globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "tax_shop_buy_rate_v1", newBuyTax);
    globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "tax_shop_sell_rate_v1", newSellTax);
    globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "tax_transfer_rate_v1", newTransferTax);
    globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "tax_wealth_threshold_v1", newWealthThreshold);
    globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "tax_wealth_rate_v1", newWealthTax);
    globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "tax_predial_rate_v1", newPredialRate);
    
    player.sendMessage("§b§l[§6Banco§b§l]§r §a¡Impuestos actualizados con éxito!");
    openBankOwnerPanel(player);
  }).catch(() => {});
}

// Diálogo: Inyectar/Retirar Capital de Bóveda (Exclusivo ElOmar3 / OPs)
function openBankAdjustReservesDialog(player) {
  const handBal = getScore(player);
  const vaultFunds = Number(globalThis.__sqlite_get_prop_v2__("currency_addon", "world", "bank_vault_funds") ?? 0);
  
  const modal = new ModalFormData()
    .title("💰 Capital de Bóveda")
    .dropdown("Selecciona la acción:", ["Inyectar Capital (mano -> banco)", "Retirar Ganancias (banco -> mano)"])
    .textField(`Dinero en mano: $${handBal}\nFondos en bóveda: $${vaultFunds}\n\nIngresa la cantidad:`, "Cantidad entera positiva");
    
  modal.show(player).then((res) => {
    if (res.canceled) return;
    const actionIdx = res.formValues[0]; // 0 = Inyectar, 1 = Retirar
    const val = Math.floor(Number(res.formValues[1]) || 0);
    
    if (val <= 0 || isNaN(val)) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cMonto ingresado inválido.");
      return;
    }
    
    if (actionIdx === 0) {
      // Inyectar
      if (handBal < val) {
        player.sendMessage("§b§l[§6Banco§b§l]§r §cNo tienes suficiente dinero en mano para inyectar.");
        return;
      }
      if (setScore(player, handBal - val, "bank_vault_injection")) {
        const nextVault = vaultFunds + val;
        globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "bank_vault_funds", nextVault);
        player.sendMessage(`§b§l[§6Banco§b§l]§r §a¡Inyección exitosa! Has aportado §e$${val}§a a las reservas del banco. Nuevo saldo de bóveda: §d$${nextVault}§a.`);
      } else {
        player.sendMessage("§b§l[§6Banco§b§l]§r §cError al procesar la inyección.");
      }
    } else {
      // Retirar
      if (vaultFunds < val) {
        player.sendMessage("§b§l[§6Banco§b§l]§r §cLa bóveda no tiene suficientes fondos para ese retiro.");
        return;
      }
      if (setScore(player, handBal + val, "bank_vault_withdrawal")) {
        const nextVault = Math.max(0, vaultFunds - val);
        globalThis.__sqlite_set_prop_v2__("currency_addon", "world", "bank_vault_funds", nextVault);
        player.sendMessage(`§b§l[§6Banco§b§l]§r §a¡Retiro de reservas exitoso! Recibes §e$${val}§a de la bóveda. Reservas restantes: §d$${nextVault}§a.`);
      } else {
        player.sendMessage("§b§l[§6Banco§b§l]§r §cError al procesar el retiro.");
      }
    }
  }).catch(() => {});
}

// Diálogo: Cambiar Tasa de Interés
function openBankChangeInterestRateDialog(player) {
  const currentRate = globalThis.__sqlite_get_prop_v2__("currency_addon", "world", GLOBAL_INTEREST_RATE_PROPERTY) ?? 1.5;
  const modal = new ModalFormData()
    .title("📈 Cambiar Tasa de Interés")
    .textField(`Establece el interés diario para los ahorros de los jugadores.\nActual: ${currentRate}%\n\nNueva tasa de interés (porcentaje, ej: 2.5):`, "Ej: 2.0");
    
  modal.show(player).then((res) => {
    if (res.canceled) return;
    const newRate = parseFloat(res.formValues[0]);
    if (isNaN(newRate) || newRate < 0 || newRate > 10.0) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cTasa de interés inválida. Debe ser un número entre 0% y 10%.");
      return;
    }
    globalThis.__sqlite_set_prop_v2__("currency_addon", "world", GLOBAL_INTEREST_RATE_PROPERTY, newRate);
    player.sendMessage(`§b§l[§6Banco§b§l]§r §a¡Tasa de interés diario actualizada a §e${newRate}%§a!`);
  }).catch(() => {});
}

// Diálogo: Auditar todas las cuentas del banco (online y offline)
function openBankAuditPlayersDialog(player) {
  const registry = getGlobalAccountRegistry();
  const playerNames = Object.keys(registry);
  
  if (playerNames.length === 0) {
    player.sendMessage("§b§l[§6Banco§b§l]§r §cNo hay cuentas registradas en el banco aún.");
    return;
  }
  
  // Ordenar alfabéticamente
  playerNames.sort();
  
  const form = new ActionFormData()
    .title("🔍 Auditar Cuentas de Jugadores")
    .body(`§7Auditoría general de la banca (online y offline).\nTotal de cuentas registradas: §e${playerNames.length}`);
    
  for (const name of playerNames) {
    const data = registry[name];
    form.button(`👤 ${name}\n§7Ahorros: $${data.savings} | Deuda: $${data.loan}`);
  }
  
  form.button("🔙 Volver");
  
  form.show(player).then((res) => {
    if (res.canceled) return;
    if (res.selection === playerNames.length) {
      // Volver
      openBankOwnerPanel(player);
      return;
    }
    
    const selectedName = playerNames[res.selection];
    if (selectedName) {
      openBankAuditTargetPlayerDialog(player, selectedName);
    }
  }).catch(() => {});
}

// Diálogo: Auditar jugador específico (online u offline)
function openBankAuditTargetPlayerDialog(player, targetName) {
  const registry = getGlobalAccountRegistry();
  const account = registry[targetName];
  if (!account) {
    player.sendMessage("§b§l[§6Banco§b§l]§r §cNo se encontró la cuenta de ese jugador.");
    return;
  }
  
  const targetOnline = world.getAllPlayers().find(p => p.name.toLowerCase() === targetName.toLowerCase());
  const statusStr = targetOnline ? "§aEn Línea" : "§cDesconectado";
  
  const cash = account.cash ?? 0;
  const historyList = account.history && account.history.length > 0
    ? account.history.map(tx => {
        let timeStr = "";
        try {
          const d = new Date(tx.timestamp);
          timeStr = `[${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}] `;
        } catch (e) {}
        return `§e${timeStr}§b${tx.type} §e$${tx.amount}§7: ${tx.details}`;
      }).join("\n")
    : "§7Sin transacciones recientes.";
  
  const form = new ActionFormData()
    .title(`🔍 Auditar: ${targetName}`)
    .body(`§7Estado actual de la cuenta de §e${targetName}§7 (${statusStr}):\n\n` +
          `§7- Efectivo (Mano): §a$${cash}\n` +
          `§7- Ahorros (Cuenta): §b$${account.savings}\n` +
          `§7- Préstamo Activo: §c$${account.loan}\n\n` +
          `§l§dHistorial Reciente (Gastos y Movimientos):\n${historyList}`)
    .button("❌ Perdonar Préstamo (Fijar en 0)")
    .button("⚙️ Modificar Valores Manualmente")
    .button("🔙 Volver");
    
  form.show(player).then((res) => {
    if (res.canceled) return;
    switch (res.selection) {
      case 0: // Perdonar préstamo
        updateGlobalAccountRegistry(targetName, account.savings, 0);
        logPlayerTransaction(targetName, "Perdón Préstamo", account.loan, "Préstamo perdonado por administrador");
        if (targetOnline && targetOnline.isValid) {
          globalThis.__sqlite_set_prop_v2__("currency_addon", targetOnline, BANK_LOAN_PROPERTY, 0);
          globalThis.__sqlite_set_prop_v2__("currency_addon", targetOnline, BANK_LOAN_TRANSFER_LOCK_PROPERTY, undefined);
          targetOnline.sendMessage("§b§l[§6Banco§b§l]§r §a¡Un administrador ha perdonado tu deuda de préstamo! Tu deuda actual es $0.");
        }
        player.sendMessage(`§b§l[§6Banco§b§l]§r §aHas perdonado el préstamo de §e${targetName}§a.`);
        openBankAuditTargetPlayerDialog(player, targetName);
        break;
      case 1: // Modificar manual
        openBankModifyTargetValuesDialog(player, targetName);
        break;
      case 2: // Volver
        openBankAuditPlayersDialog(player);
        break;
    }
  }).catch(() => {});
}

// Diálogo: Modificar valores manuales de un jugador (online u offline)
function openBankModifyTargetValuesDialog(player, targetName) {
  const registry = getGlobalAccountRegistry();
  const account = registry[targetName];
  if (!account) return;
  
  const targetOnline = world.getAllPlayers().find(p => p.name.toLowerCase() === targetName.toLowerCase());
  
  const modal = new ModalFormData()
    .title(`⚙️ Modificar: ${targetName}`)
    .textField("Fijar Ahorros en:", "Monto entero positivo", String(account.savings))
    .textField("Fijar Préstamo en:", "Monto entero positivo", String(account.loan));
    
  modal.show(player).then((res) => {
    if (res.canceled) return;
    const newSavings = Math.floor(Number(res.formValues[0]) || 0);
    const newLoan = Math.floor(Number(res.formValues[1]) || 0);
    
    if (isNaN(newSavings) || newSavings < 0 || isNaN(newLoan) || newLoan < 0) {
      player.sendMessage("§b§l[§6Banco§b§l]§r §cValores ingresados inválidos.");
      return;
    }
    
    updateGlobalAccountRegistry(targetName, newSavings, newLoan);
    logPlayerTransaction(targetName, "Ajuste Admin", newSavings - account.savings, `Ahorros fijados a $${newSavings}, Deuda a $${newLoan}`);
    
    if (targetOnline && targetOnline.isValid) {
      globalThis.__sqlite_set_prop_v2__("currency_addon", targetOnline, BANK_SAVINGS_PROPERTY, newSavings);
      globalThis.__sqlite_set_prop_v2__("currency_addon", targetOnline, BANK_LOAN_PROPERTY, newLoan);
      if (newLoan <= 0) globalThis.__sqlite_set_prop_v2__("currency_addon", targetOnline, BANK_LOAN_TRANSFER_LOCK_PROPERTY, undefined);
      else globalThis.__sqlite_set_prop_v2__("currency_addon", targetOnline, BANK_LOAN_TRANSFER_LOCK_PROPERTY, Math.min(getLoanTransferLock(targetOnline), newLoan));
      targetOnline.sendMessage(`§b§l[§6Banco§b§l]§r §eUn administrador ha actualizado tu estado bancario:\n§7- Ahorros: §b$${newSavings}\n§7- Deuda: §c$${newLoan}`);
    }
    player.sendMessage(`§b§l[§6Banco§b§l]§r §aValores de §e${targetName}§a actualizados en la base de datos global: Ahorros = $${newSavings}, Deuda = $${newLoan}.`);
    openBankAuditTargetPlayerDialog(player, targetName);
  }).catch(() => {});
}

// Limpiar el historial de balances de mano al desconectarse para evitar fugas de memoria
try {
  const leaveEvent = world.beforeEvents.playerLeave;
  if (leaveEvent && typeof leaveEvent.subscribe === "function") {
    leaveEvent.subscribe((event) => {
      if (event.player) {
        playerLastMoneyMap.delete(event.player.name.toLowerCase());
      }
    });
  }
} catch (e) {
  ErrorReporter.report(e, { addonId: "currency_addon", moduleId: "main.js", operation: "player_leave_bank_cleanup", category: "runtime" });
}
