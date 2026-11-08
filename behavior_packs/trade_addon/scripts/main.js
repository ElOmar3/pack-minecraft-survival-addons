import { ErrorReporter } from "./ErrorReporter.js";
import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, world, system, ItemStack } from "@minecraft/server";
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
globalThis.__sqlite_sync_complete_v2__.delete("trade_addon");
globalThis.__sqlite_request_sync_v3__("trade_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("trade_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("trade_addon", 1);
  } catch (e) {}
}, 120);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===
console.warn("Trade UI Addon iniciado.");
const COMMAND_NAMESPACE = "s";

function ensureMoneyObjective() {
  let objective = world.scoreboard.getObjective("money");
  if (!objective) {
    try {
      objective = world.scoreboard.addObjective("money", "§e$ Dinero");
    } catch (e) { ErrorReporter.report(e, { addonId: "trade_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }
  return objective;
}

function commandOk(message) {
  return { status: CustomCommandStatus.Success, message };
}

function commandError(message) {
  return { status: CustomCommandStatus.Failure, message };
}

// Estado global de tradeos en memoria
const tradeRequests = new Map(); // Destino (minúsculas) -> { senderName: string, timestamp: number }
const activeTrades = new Map(); // tradeId -> tradeObject
const TRADE_TIMEOUT_MS = 60000;
const MAX_MONEY = 2147483647;
const MAX_OPERATIONAL_BALANCE = 100000000;
const MAX_TRADE_MONEY = 1000000;

// Auxiliares de Scoreboard/Dinero
function getObjective() {
  return ensureMoneyObjective();
}

function getBalance(player) {
  const obj = getObjective();
  if (!obj) return 0;
  try {
    return (function(o, p){ try{return o.getScore(p) ?? 0;}catch(e){try{return o.getScore(p.name) ?? 0;}catch(e2){return 0;}} })(obj, player) ?? 0;
  } catch (e) { ErrorReporter.report(e, { addonId: "trade_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return 0;
  }
}

function setBalance(player, amount) {
  const obj = getObjective();
  if (!obj) return false;
  try {
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MONEY) {
      console.warn(`[ECONOMY_TX] REJECT invalid_balance player=${player?.name || "unknown"} amount=${amount} reason=trade_balance_write`);
      return false;
    }
    try {
      obj.setScore(player, value);
    } catch (e) {
      obj.setScore(player.name, value);
    }
    return getBalance(player) === value;
  } catch (e) { ErrorReporter.report(e, { addonId: "trade_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn(`Error al actualizar saldo en trade: ${e}`);
    return false;
  }
}

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
        ErrorReporter.report(e, { addonId: "trade_addon", moduleId: "main.js", operation: "safeOpenForm:onSelect", category: "runtime" });
      }
    });
  }).catch((err) => {
    const message = String(err ?? "");
    if (message.includes("Player quit before responding") || message.includes("FormRejectError")) {
      return;
    }
    console.warn(`[Trade UI Addon] Error en formulario: ${err}`);
  });
}

// Auxiliares de Inventario
function getInventory(player) {
  return player.getComponent("minecraft:inventory")?.container;
}

function getItemLore(item) {
  try {
    return typeof item?.getLore === "function" ? item.getLore() ?? [] : [];
  } catch (e) { ErrorReporter.report(e, { addonId: "trade_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return [];
  }
}

function getEnchantSignature(item) {
  try {
    const enchantable = item?.getComponent?.("minecraft:enchantable");
    const enchantments = enchantable?.getEnchantments?.() ?? [];
    return enchantments
      .map((entry) => `${entry.type?.id || entry.type}:${entry.level}`)
      .sort()
      .join("|");
  } catch (e) { ErrorReporter.report(e, { addonId: "trade_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return "";
  }
}

function normalizeFingerprintValue(value) {
  if (value === undefined) return null;
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(normalizeFingerprintValue);
  if (typeof value === "object") {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = normalizeFingerprintValue(value[key]);
      return result;
    }, {});
  }
  return String(value);
}

function getItemFingerprint(item, includeAmount = true, depth = 0) {
  if (!item?.typeId) return "";
  let fingerprint = {
    typeId: item.typeId,
    nameTag: item.nameTag || "",
    lore: getItemLore(item),
    enchantments: getEnchantSignature(item),
    keepOnDeath: item.keepOnDeath === true,
    lockMode: String(item.lockMode || "none")
  };
  if (includeAmount) fingerprint.amount = item.amount || 0;
  
  try {
    const durability = item.getComponent("minecraft:durability");
    if (durability) fingerprint.damage = durability.damage;
    
    const inv = item.getComponent("minecraft:inventory");
    if (depth < 3 && inv && inv.container) {
      let invContents = [];
      for (let i = 0; i < inv.container.size; i++) {
        const subItem = inv.container.getItem(i);
        invContents.push(subItem ? getItemFingerprint(subItem, true, depth + 1) : "");
      }
      fingerprint.inv = invContents;
    }
    
    try {
      const lore = item.getLore?.() ?? [];
      if (lore.length > 0) {
        fingerprint.loreProps = lore;
      }
    } catch (e) {}
    fingerprint.canDestroy = [...(item.getCanDestroy?.() ?? [])].sort();
    fingerprint.canPlaceOn = [...(item.getCanPlaceOn?.() ?? [])].sort();
  } catch(e) {}
  
  return JSON.stringify(fingerprint);
}

function cloneItemForTrade(item, amount) {
  const cloned = item.clone();
  cloned.amount = amount;
  return cloned;
}

function itemsMatchForTrade(currentItem, snapshot, expectedFingerprint) {
  if (!currentItem || !snapshot || getItemFingerprint(currentItem) !== expectedFingerprint) return false;
  try {
    if (typeof currentItem.isStackableWith === "function") {
      return currentItem.isStackableWith(snapshot);
    }
  } catch (e) {
    ErrorReporter.report(e, { addonId: "trade_addon", moduleId: "main.js", operation: "native_item_match", category: "runtime" });
    return false;
  }
  return true;
}

function countItemInHand(player, typeId) {
  const container = getInventory(player);
  if (!container) return 0;
  const item = container.getItem(player.selectedSlotIndex);
  if (item && item.typeId === typeId) {
    return item.amount;
  }
  return 0;
}

function removeHandItem(player, typeId, amount, expectedFingerprint = "", expectedSlot = player.selectedSlotIndex, expectedSnapshot = undefined) {
  const container = getInventory(player);
  if (!container) return false;
  const slot = expectedSlot;
  const item = container.getItem(slot);
  if (item && item.typeId === typeId) {
    if (expectedFingerprint && expectedSnapshot && !itemsMatchForTrade(item, expectedSnapshot, expectedFingerprint)) {
      return false;
    }
    if (expectedFingerprint && !expectedSnapshot && getItemFingerprint(item) !== expectedFingerprint) {
      return false;
    }
    if (item.amount <= amount) {
      container.setItem(slot, undefined);
    } else {
      const newItem = item.clone();
      newItem.amount = item.amount - amount;
      container.setItem(slot, newItem);
    }
    return true;
  }
  return false;
}

function canFullyReceiveItem(player, itemStack) {
  const container = getInventory(player);
  if (!container || !itemStack) return false;
  const signature = getItemFingerprint(itemStack, false);
  const maxStack = Math.max(1, itemStack.maxAmount || 64);
  let capacity = 0;
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (!item) {
      capacity += maxStack;
    } else if (getItemFingerprint(item, false) === signature) {
      capacity += Math.max(0, maxStack - item.amount);
    }
  }
  return capacity >= itemStack.amount;
}

function removeExactItemAnywhere(player, itemStack) {
  const container = getInventory(player);
  if (!container || !itemStack) return false;
  const signature = getItemFingerprint(itemStack, false);
  let remaining = itemStack.amount;
  for (let i = 0; i < container.size && remaining > 0; i++) {
    const item = container.getItem(i);
    if (!item || getItemFingerprint(item, false) !== signature) continue;
    const take = Math.min(remaining, item.amount);
    if (take === item.amount) container.setItem(i, undefined);
    else {
      const next = item.clone();
      next.amount -= take;
      container.setItem(i, next);
    }
    remaining -= take;
  }
  return remaining === 0;
}

function giveItem(player, itemStack, dropLeftover = false) {
  const container = getInventory(player);
  if (!container || !itemStack) return false;
  try {
    const remaining = container.addItem(itemStack);
    if (remaining) {
      if (dropLeftover) {
        player.dimension.spawnItem(remaining, player.location);
        return true;
      }
      const inserted = Math.max(0, itemStack.amount - remaining.amount);
      if (inserted > 0) {
        const partial = itemStack.clone();
        partial.amount = inserted;
        removeExactItemAnywhere(player, partial);
      }
      return false;
    }
    return true;
  } catch (e) {
    ErrorReporter.report(e, { addonId: "trade_addon", moduleId: "main.js", operation: "give_item", category: "runtime" });
    return false;
  }
}

// Genera un ID único para la pareja de tradeo
function getTradeId(p1Name, p2Name) {
  const pair = [p1Name.toLowerCase(), p2Name.toLowerCase()].sort().join("_");
  return `${pair}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isPlayerTrading(playerName) {
  const key = String(playerName || "").toLowerCase();
  return [...activeTrades.values()].some((trade) =>
    String(trade.playerAName).toLowerCase() === key || String(trade.playerBName).toLowerCase() === key
  );
}

const targetCommands = ["trade", "tradeaccept", "tradedeny"];

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
      register({
        name: `${COMMAND_NAMESPACE}:trade`,
        description: "Invita a un jugador a intercambiar",
        permissionLevel: CommandPermissionLevel.Any,
        mandatoryParameters: [{ name: "jugador", type: CustomCommandParamType.String }],
      }, (origin, jugador) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        system.run(async () => {
          await handleCommand(sender, "trade", ["trade", String(jugador)]);
        });
        return commandOk("Procesando trade.");
      });

      register({
        name: `${COMMAND_NAMESPACE}:tradeaccept`,
        description: "Acepta un intercambio",
        permissionLevel: CommandPermissionLevel.Any,
      }, (origin) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        system.run(async () => {
          await handleCommand(sender, "tradeaccept", ["tradeaccept"]);
        });
        return commandOk("Procesando tradeaccept.");
      });

      register({
        name: `${COMMAND_NAMESPACE}:tradedeny`,
        description: "Rechaza un intercambio",
        permissionLevel: CommandPermissionLevel.Any,
      }, (origin) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        system.run(async () => {
          if (tradeRequests.has(sender.name.toLowerCase())) {
            tradeRequests.delete(sender.name.toLowerCase());
            sender.sendMessage("§b§l[§3Intercambio§b§l]§r §cHas rechazado la solicitud.");
          } else {
            sender.sendMessage("§b§l[§3Intercambio§b§l]§r §cNo tienes solicitudes pendientes.");
          }
        });
        return commandOk("Procesando tradedeny.");
      });
    } catch (e) { ErrorReporter.report(e, { addonId: "trade_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Trade UI Addon] Error registrando custom commands: " + e);
    }
  });
}

registerCustomCommands();

// Manejador alternativo de comandos por /scriptevent (siempre disponible)
try {
  if (system && system.afterEvents && system.afterEvents.scriptEventReceive && typeof system.afterEvents.scriptEventReceive.subscribe === "function") {
    system.afterEvents.scriptEventReceive.subscribe((event) => {
      if (event.id !== "pacific:trade") return;
      const message = String(event.message || "").trim();
      if (!message) return;
      const args = message.split(/\s+/);
      const command = args[0].toLowerCase();
      
      if (!targetCommands.includes(command)) return;
      const sender = event.sourceEntity;
      if (!sender || sender.typeId !== "minecraft:player") return;
      
      system.run(async () => {
        try {
          await handleCommand(sender, command, [command, ...args.slice(1)]);
        } catch (error) { ErrorReporter.report(error, { addonId: "trade_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
          console.warn(`Error ejecutando scriptevent de tradeo ${command}: ${error}`);
        }
      });
    });
  }
} catch (e) { ErrorReporter.report(e, { addonId: "trade_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Trade UI Addon] ScriptEvent listener error: " + e);
}

async function handleCommand(player, command, args) {
  if (command === "trade") {
    const targetName = args.slice(1).join(" ").trim();
    if (!targetName) {
      player.sendMessage("§b§l[§3Intercambio§b§l]§r §cUso: /s:trade <nombre_del_jugador>");
      return;
    }
    
    const players = world.getAllPlayers();
    let target = players.find(p => p.name.toLowerCase() === targetName.toLowerCase());
    
    if (!target) {
      const matches = players.filter(p => p.name.toLowerCase().includes(targetName.toLowerCase()));
      if (matches.length === 1) target = matches[0];
    }
    
    if (!target) {
      player.sendMessage("§b§l[§3Intercambio§b§l]§r §cJugador no encontrado online.");
      return;
    }
    
    if (target.name === player.name) {
      player.sendMessage("§b§l[§3Intercambio§b§l]§r §cNo puedes tradear contigo mismo.");
      return;
    }
    if (isPlayerTrading(player.name) || isPlayerTrading(target.name)) {
      player.sendMessage("§b§l[§3Intercambio§b§l]§r §cUno de los jugadores ya tiene un intercambio activo.");
      return;
    }
    
    tradeRequests.set(target.name.toLowerCase(), {
      senderName: player.name,
      timestamp: Date.now()
    });
    
    target.sendMessage(`§b§l[§3Intercambio§b§l]§r §b${player.name} §7te invita a un intercambio seguro.\n§7Escribe §a/s:tradeaccept §7para aceptar. Expira en 60 segundos.`);
    player.sendMessage(`§b§l[§3Intercambio§b§l]§r §7Invitación enviada a §b${target.name}§7.`);
    return;
  }
  
  if (command === "tradeaccept") {
    const playerKey = player.name.toLowerCase();
    const req = tradeRequests.get(playerKey);
    
    if (!req || (Date.now() - req.timestamp > TRADE_TIMEOUT_MS)) {
      if (req) tradeRequests.delete(playerKey);
      player.sendMessage("§b§l[§3Intercambio§b§l]§r §cNo tienes solicitudes de intercambio pendientes.");
      return;
    }
    
    const requester = world.getAllPlayers().find(p => p.name.toLowerCase() === req.senderName.toLowerCase());
    if (!requester) {
      player.sendMessage("§b§l[§3Intercambio§b§l]§r §cEl solicitante se ha desconectado.");
      tradeRequests.delete(playerKey);
      return;
    }
    if (isPlayerTrading(player.name) || isPlayerTrading(requester.name)) {
      tradeRequests.delete(playerKey);
      player.sendMessage("§b§l[§3Intercambio§b§l]§r §cUno de los jugadores ya tiene un intercambio activo.");
      return;
    }
    
    tradeRequests.delete(playerKey);
    
    // Iniciar tradeo
    const tradeId = getTradeId(player.name, requester.name);
    activeTrades.set(tradeId, {
      playerAName: requester.name,
      playerBName: player.name,
      offerA: null,
      offerB: null,
      confirmedA: false,
      confirmedB: false,
      status: "offering",
      version: 1,
      createdAt: Date.now()
    });
    
    player.sendMessage("§b§l[§3Intercambio§b§l]§r §aIntercambio iniciado.");
    requester.sendMessage("§b§l[§3Intercambio§b§l]§r §aIntercambio iniciado.");
    
    // Abrir menú de oferta para ambos
    openOfferMenu(requester, tradeId);
    openOfferMenu(player, tradeId);
    return;
  }
}

function openOfferMenu(player, tradeId) {
  const trade = activeTrades.get(tradeId);
  if (!trade) return;
  
  const otherName = player.name === trade.playerAName ? trade.playerBName : trade.playerAName;
  
  const form = new ActionFormData()
    .title("🤝 Intercambio Seguro")
    .body(`Negociando con: §b${otherName}§r\n\n¿Qué deseas ofrecer en este trato?\n(Nota: Si deseas ofrecer un item, sostenlo en tu mano principal antes de continuar)`)
    .button("⚔ Ofrecer objeto en mi mano")
    .button("💰 Ofrecer dinero ($)")
    .button("⚪ No ofrecer nada (Regalo)")
    .button("❌ Cancelar intercambio");
    
  safeOpenForm(player, form, (response) => {
    if (response.canceled || response.selection === 3) {
      cancelTrade(tradeId, `${player.name} canceló el intercambio.`);
      return;
    }
    
    if (response.selection === 0) {
      // Ofrecer objeto en mano
      const container = getInventory(player);
      const offeredSlot = player.selectedSlotIndex;
      const item = container ? container.getItem(offeredSlot) : null;
      if (!item) {
        player.sendMessage("§b§l[§3Intercambio§b§l]§r §cDebes sostener un objeto en tu mano principal para ofrecerlo.");
        // Reabrir menú
        openOfferMenu(player, tradeId);
        return;
      }
      
      const formQty = new ModalFormData()
        .title("Cantidad a ofrecer")
        .slider(`¿Cuántas unidades deseas ofrecer? (Tienes ${item.amount})`, 1, item.amount, 1);
        
      safeOpenForm(player, formQty, (resQty) => {
        if (resQty.canceled) {
          openOfferMenu(player, tradeId);
          return;
        }
        const qty = resQty.formValues ? Math.floor(resQty.formValues[0]) : 1;
        const currentItem = getInventory(player)?.getItem(offeredSlot);
        if (!currentItem || !itemsMatchForTrade(currentItem, item, getItemFingerprint(item)) || qty < 1 || qty > currentItem.amount) {
          cancelTrade(tradeId, `${player.name} cambió el objeto mientras definía su oferta.`);
          return;
        }
        setOffer(player, tradeId, {
          type: "item",
          itemTypeId: item.typeId,
          amount: qty,
          displayName: `${item.nameTag || item.typeId.replace("minecraft:", "")}`,
          itemFingerprint: getItemFingerprint(item),
          itemSnapshot: cloneItemForTrade(item, qty),
          offeredSlot
        });
      });
    } else if (response.selection === 1) {
      // Ofrecer dinero
      const maxBal = Math.min(getBalance(player), MAX_TRADE_MONEY);
      if (maxBal <= 0) {
        player.sendMessage("§b§l[§3Intercambio§b§l]§r §cNo tienes saldo para ofrecer.");
        openOfferMenu(player, tradeId);
        return;
      }
      
      const formMoney = new ModalFormData()
        .title("Dinero a ofrecer")
        .slider(`¿Cuánto dinero deseas ofrecer? (Saldo: $${maxBal})`, 1, maxBal, 1);
        
      safeOpenForm(player, formMoney, (resMoney) => {
        if (resMoney.canceled) {
          openOfferMenu(player, tradeId);
          return;
        }
        const moneyAmt = resMoney.formValues ? Math.floor(resMoney.formValues[0]) : 0;
        if (moneyAmt <= 0 || moneyAmt > MAX_TRADE_MONEY || moneyAmt > getBalance(player)) {
          player.sendMessage("§b§l[§3Intercambio§b§l]§r §cTu saldo cambió. Define nuevamente la oferta.");
          openOfferMenu(player, tradeId);
          return;
        }
        setOffer(player, tradeId, {
          type: "money",
          amount: moneyAmt,
          displayName: `Dinero ($${moneyAmt})`
        });
      });
    } else if (response.selection === 2) {
      // Ofrecer nada
      setOffer(player, tradeId, {
        type: "none",
        amount: 0,
        displayName: "Nada"
      });
    }
  });
}

function setOffer(player, tradeId, offer) {
  const trade = activeTrades.get(tradeId);
  if (!trade || trade.status !== "offering") return;
  if (player.name !== trade.playerAName && player.name !== trade.playerBName) return;
  
  if (player.name === trade.playerAName) {
    trade.offerA = offer;
  } else {
    trade.offerB = offer;
  }
  
  player.sendMessage(`§b§l[§3Intercambio§b§l]§r §7Has ofrecido: §e${offer.displayName} (x${offer.amount || 1})§7. Esperando oferta del otro jugador...`);
  
  // Si ambos ya ofrecieron, abrimos confirmación
  if (trade.offerA !== null && trade.offerB !== null) {
    trade.status = "confirming";
    trade.version += 1;
    trade.confirmedA = false;
    trade.confirmedB = false;
    const pA = world.getAllPlayers().find(p => p.name === trade.playerAName);
    const pB = world.getAllPlayers().find(p => p.name === trade.playerBName);
    
    if (pA && pB) {
      openConfirmationMenu(pA, tradeId, trade.version);
      openConfirmationMenu(pB, tradeId, trade.version);
    } else {
      cancelTrade(tradeId, "Uno de los jugadores se desconectó.");
    }
  }
}

function openConfirmationMenu(player, tradeId, expectedVersion) {
  const trade = activeTrades.get(tradeId);
  if (!trade || trade.status !== "confirming" || trade.version !== expectedVersion) return;
  
  const isPlayerA = player.name === trade.playerAName;
  const myOffer = isPlayerA ? trade.offerA : trade.offerB;
  const theirOffer = isPlayerA ? trade.offerB : trade.offerA;
  const otherName = isPlayerA ? trade.playerBName : trade.playerAName;
  
  const form = new ActionFormData()
    .title("🤝 Confirmar Trato")
    .body(`Por favor revisa detenidamente el trato propuesto:\n\n` +
          `§fTú ofreces: §e${myOffer.displayName} ${myOffer.amount > 0 ? `(x${myOffer.amount})` : ""}\n` +
          `§f§b${otherName} §fofrece: §e${theirOffer.displayName} ${theirOffer.amount > 0 ? `(x${theirOffer.amount})` : ""}\n\n` +
          `¿Estás de acuerdo con realizar este intercambio?`)
    .button("✅ Confirmar e Intercambiar")
    .button("❌ Cancelar Intercambio");
    
  safeOpenForm(player, form, (response) => {
    if (response.canceled || response.selection === 1) {
      cancelTrade(tradeId, `${player.name} rechazó el trato.`);
      return;
    }
    
    confirmPlayer(player, tradeId, expectedVersion);
  });
}

function confirmPlayer(player, tradeId, expectedVersion) {
  const trade = activeTrades.get(tradeId);
  if (!trade || trade.status !== "confirming" || trade.version !== expectedVersion) return;
  if (player.name !== trade.playerAName && player.name !== trade.playerBName) return;
  
  if (player.name === trade.playerAName) {
    if (trade.confirmedA) return;
    trade.confirmedA = true;
  } else {
    if (trade.confirmedB) return;
    trade.confirmedB = true;
  }
  
  player.sendMessage("§b§l[§3Intercambio§b§l]§r §7Has confirmado el trato. Esperando confirmación final del otro jugador...");
  
  if (trade.confirmedA && trade.confirmedB) {
    executeTrade(tradeId);
  }
}

function executeTrade(tradeId) {
  const trade = activeTrades.get(tradeId);
  if (!trade || trade.status !== "confirming" || !trade.confirmedA || !trade.confirmedB) return;
  trade.status = "executing";
  
  const pA = world.getAllPlayers().find(p => p.name === trade.playerAName);
  const pB = world.getAllPlayers().find(p => p.name === trade.playerBName);
  
  if (!pA || !pB) {
    cancelTrade(tradeId, "Intercambio fallido: Uno de los jugadores se desconectó.");
    return;
  }
  
  // 1. Validaciones finales: las ofertas quedan congeladas al entrar en ejecución.
  // Verificar Oferta A
  if (trade.offerA.type === "item") {
    const currentItem = getInventory(pA)?.getItem(trade.offerA.offeredSlot);
    if (!currentItem || currentItem.amount < trade.offerA.amount || !itemsMatchForTrade(currentItem, trade.offerA.itemSnapshot, trade.offerA.itemFingerprint)) {
      cancelTrade(tradeId, `Intercambio fallido: ${pA.name} ya no sostiene el item ofrecido en su mano principal.`);
      return;
    }
  } else if (trade.offerA.type === "money") {
    if (getBalance(pA) < trade.offerA.amount) {
      cancelTrade(tradeId, `Intercambio fallido: ${pA.name} ya no tiene saldo suficiente.`);
      return;
    }
  }
  
  // Verificar Oferta B
  if (trade.offerB.type === "item") {
    const currentItem = getInventory(pB)?.getItem(trade.offerB.offeredSlot);
    if (!currentItem || currentItem.amount < trade.offerB.amount || !itemsMatchForTrade(currentItem, trade.offerB.itemSnapshot, trade.offerB.itemFingerprint)) {
      cancelTrade(tradeId, `Intercambio fallido: ${pB.name} ya no sostiene el item ofrecido en su mano principal.`);
      return;
    }
  } else if (trade.offerB.type === "money") {
    if (getBalance(pB) < trade.offerB.amount) {
      cancelTrade(tradeId, `Intercambio fallido: ${pB.name} ya no tiene saldo suficiente.`);
      return;
    }
  }
  
  if (trade.offerA.type === "item" && !canFullyReceiveItem(pB, trade.offerA.itemSnapshot)) {
    cancelTrade(tradeId, `Intercambio fallido: ${pB.name} no tiene espacio para recibir la oferta.`);
    return;
  }
  if (trade.offerB.type === "item" && !canFullyReceiveItem(pA, trade.offerB.itemSnapshot)) {
    cancelTrade(tradeId, `Intercambio fallido: ${pA.name} no tiene espacio para recibir la oferta.`);
    return;
  }

  const balanceA = getBalance(pA);
  const balanceB = getBalance(pB);
  const finalBalanceA = balanceA - (trade.offerA.type === "money" ? trade.offerA.amount : 0) + (trade.offerB.type === "money" ? trade.offerB.amount : 0);
  const finalBalanceB = balanceB - (trade.offerB.type === "money" ? trade.offerB.amount : 0) + (trade.offerA.type === "money" ? trade.offerA.amount : 0);
  if (finalBalanceA < 0 || finalBalanceB < 0 || finalBalanceA > MAX_MONEY || finalBalanceB > MAX_MONEY ||
      (finalBalanceA > MAX_OPERATIONAL_BALANCE && finalBalanceA > balanceA) ||
      (finalBalanceB > MAX_OPERATIONAL_BALANCE && finalBalanceB > balanceB)) {
    cancelTrade(tradeId, "Intercambio fallido: el resultado excede los límites permitidos de saldo.");
    return;
  }

  let removedA = false;
  let removedB = false;
  let deliveredToA = false;
  let deliveredToB = false;
  const restoreRemovedItems = (restoreA = removedA, restoreB = removedB) => {
    if (restoreA && !giveItem(pA, trade.offerA.itemSnapshot?.clone?.() || trade.offerA.itemSnapshot, true)) {
      console.warn(`[ECONOMY_CRITICAL] trade_item_restore_failed trade=${tradeId} player=${pA.name} side=A`);
    }
    if (restoreB && !giveItem(pB, trade.offerB.itemSnapshot?.clone?.() || trade.offerB.itemSnapshot, true)) {
      console.warn(`[ECONOMY_CRITICAL] trade_item_restore_failed trade=${tradeId} player=${pB.name} side=B`);
    }
  };
  const rollback = () => {
    const receivedByARemoved = !deliveredToA || removeExactItemAnywhere(pA, trade.offerB.itemSnapshot);
    const receivedByBRemoved = !deliveredToB || removeExactItemAnywhere(pB, trade.offerA.itemSnapshot);
    if (!receivedByARemoved) console.warn(`[ECONOMY_CRITICAL] trade_delivery_rollback_failed trade=${tradeId} player=${pA.name} side=A`);
    if (!receivedByBRemoved) console.warn(`[ECONOMY_CRITICAL] trade_delivery_rollback_failed trade=${tradeId} player=${pB.name} side=B`);
    const balanceARestored = setBalance(pA, balanceA);
    const balanceBRestored = setBalance(pB, balanceB);
    if (!balanceARestored || !balanceBRestored) {
      console.warn(`[ECONOMY_CRITICAL] trade_balance_rollback_failed trade=${tradeId} playerA=${pA.name} restoredA=${balanceARestored} playerB=${pB.name} restoredB=${balanceBRestored}`);
    }
    restoreRemovedItems(receivedByBRemoved && removedA, receivedByARemoved && removedB);
  };

  if (trade.offerA.type === "item") {
    removedA = removeHandItem(pA, trade.offerA.itemTypeId, trade.offerA.amount, trade.offerA.itemFingerprint, trade.offerA.offeredSlot, trade.offerA.itemSnapshot);
    if (!removedA) {
      cancelTrade(tradeId, `Intercambio fallido: ${pA.name} cambió el item ofrecido en el último momento.`);
      return;
    }
  }
  if (trade.offerB.type === "item") {
    removedB = removeHandItem(pB, trade.offerB.itemTypeId, trade.offerB.amount, trade.offerB.itemFingerprint, trade.offerB.offeredSlot, trade.offerB.itemSnapshot);
    if (!removedB) {
      restoreRemovedItems();
      cancelTrade(tradeId, `Intercambio fallido: ${pB.name} cambió el item ofrecido en el último momento.`);
      return;
    }
  }

  if (!setBalance(pA, finalBalanceA) || !setBalance(pB, finalBalanceB)) {
    rollback();
    cancelTrade(tradeId, "Intercambio fallido: no se pudieron aplicar los saldos.");
    return;
  }
  if (trade.offerB.type === "item") {
    deliveredToA = giveItem(pA, trade.offerB.itemSnapshot?.clone?.() || trade.offerB.itemSnapshot);
    if (!deliveredToA) {
      rollback();
      cancelTrade(tradeId, "Intercambio fallido: no se pudo entregar una de las ofertas.");
      return;
    }
  }
  if (trade.offerA.type === "item") {
    deliveredToB = giveItem(pB, trade.offerA.itemSnapshot?.clone?.() || trade.offerA.itemSnapshot);
    if (!deliveredToB) {
      rollback();
      cancelTrade(tradeId, "Intercambio fallido: no se pudo entregar una de las ofertas.");
      return;
    }
  }
  
  // Éxito
  pA.sendMessage("§b§l[§3Intercambio§b§l]§r §a¡Intercambio realizado con éxito!");
  pB.sendMessage("§b§l[§3Intercambio§b§l]§r §a¡Intercambio realizado con éxito!");
  
  try {
    const offerALog = trade.offerA.type === "none" ? "Nada" : `${trade.offerA.displayName} (x${trade.offerA.amount})`;
    const offerBLog = trade.offerB.type === "none" ? "Nada" : `${trade.offerB.displayName} (x${trade.offerB.amount})`;
    console.warn(`[TRADE_AUDIT] ${new Date().toISOString()} | SUCCESS | ${pA.name} [${offerALog}] <-> ${pB.name} [${offerBLog}]`);
  } catch(e) {}
  
  activeTrades.delete(tradeId);
}

function cancelTrade(tradeId, reason) {
  const trade = activeTrades.get(tradeId);
  if (!trade) return;
  
  const pA = world.getAllPlayers().find(p => p.name === trade.playerAName);
  const pB = world.getAllPlayers().find(p => p.name === trade.playerBName);
  
  if (pA) pA.sendMessage(`§b§l[§3Intercambio§b§l]§r §cIntercambio cancelado. Motivo: ${reason}`);
  if (pB) pB.sendMessage(`§b§l[§3Intercambio§b§l]§r §cIntercambio cancelado. Motivo: ${reason}`);
  
  activeTrades.delete(tradeId);
}

try {
  world.afterEvents.playerLeave.subscribe((event) => {
    const playerName = String(event.playerName || "").toLowerCase();
    for (const [tradeId, trade] of activeTrades) {
      if (String(trade.playerAName).toLowerCase() === playerName || String(trade.playerBName).toLowerCase() === playerName) {
        cancelTrade(tradeId, `${event.playerName} se desconectó.`);
      }
    }
  });
} catch (e) {
  ErrorReporter.report(e, { addonId: "trade_addon", moduleId: "main.js", operation: "leave_cleanup", category: "runtime" });
}

system.runInterval(() => {
  const now = Date.now();
  for (const [tradeId, trade] of activeTrades) {
    if (now - Number(trade.createdAt || now) > 2 * TRADE_TIMEOUT_MS) {
      cancelTrade(tradeId, "El intercambio expiró por inactividad.");
    }
  }
}, 200);
