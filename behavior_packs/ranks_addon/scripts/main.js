import { ErrorReporter } from "./ErrorReporter.js";
import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";






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
globalThis.__sqlite_sync_complete_v2__.delete("ranks_addon");
globalThis.__sqlite_request_sync_v3__("ranks_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("ranks_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("ranks_addon", 1);
  } catch (e) {}
}, 120);
// === FIN PERSISTENCIA SQLITE PUENTE V3 ===

// ============================================================================
// ESCALAFÓN DE RANGOS DE SUPERVIVENCIA (/s:rankup) (FASE 3)
// ============================================================================
const SURVIVAL_RANKS = Object.freeze([
  { id: "recluta", name: "Recluta", prefix: "§7[Recluta]", cost: 0, hoursRequired: 0 },
  { id: "explorador", name: "Explorador", prefix: "§a[Explorador]", cost: 5000, hoursRequired: 2 },
  { id: "veterano", name: "Veterano", prefix: "§b[Veterano]", cost: 25000, hoursRequired: 10 },
  { id: "heroe", name: "Héroe", prefix: "§d[Héroe]", cost: 75000, hoursRequired: 24 },
  { id: "leyenda", name: "Leyenda", prefix: "§6§l[Leyenda]", cost: 200000, hoursRequired: 50 }
]);

function getPlayerSurvivalRank(player) {
  return String(globalThis.__sqlite_get_prop_v2__("ranks_addon", player, "player_survival_rank") || "recluta");
}

function getPlayerPlaytimeHours(player) {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("rewards_addon", player, "playtime_state_v1");
    if (raw) {
      const parsed = JSON.parse(String(raw));
      return Math.floor((Number(parsed.totalSeconds) || 0) / 3600);
    }
  } catch {}
  return 0;
}

function openRankupMenu(player) {
  const currentRankId = getPlayerSurvivalRank(player);
  const currentIdx = SURVIVAL_RANKS.findIndex(r => r.id === currentRankId);
  const currentRank = SURVIVAL_RANKS[currentIdx >= 0 ? currentIdx : 0];
  const nextRank = SURVIVAL_RANKS[(currentIdx >= 0 ? currentIdx : 0) + 1];

  const balance = getBalance(player);
  const hoursPlayed = getPlayerPlaytimeHours(player);

  if (!nextRank) {
    const formMax = new ActionFormData()
      .title("§6§lRango Máximo Alcanzado")
      .body(`§fTu rango actual: ${currentRank.prefix}\n\n§a¡Felicidades! Has alcanzado el rango más alto de supervivencia del servidor.`)
      .button("Entendido");
    safeOpenForm(player, formMax, () => {});
    return;
  }

  const canAfford = balance >= nextRank.cost;
  const hasHours = hoursPlayed >= nextRank.hoursRequired;
  const canRankup = canAfford && hasHours;

  const form = new ActionFormData()
    .title("§e§lAscenso de Rango (/s:rankup)")
    .body(`§7Rango actual: ${currentRank.prefix}\n` +
          `§7Siguiente rango: ${nextRank.prefix}\n\n` +
          `§eRequisitos para ascender:\n` +
          `§7- Dinero requerido: ${canAfford ? "§a" : "§c"}${nextRank.cost} §7(Tu saldo: ${balance})\n` +
          `§7- Horas jugadas: ${hasHours ? "§a" : "§c"}${hoursPlayed}/${nextRank.hoursRequired} horas\n\n` +
          `${canRankup ? "§a¡Cumples todos los requisitos para ascender!" : "§cTe faltan requisitos para este ascenso."}`)
    .button(canRankup ? "⭐ ¡Ascender de Rango ahora!" : "🔒 Requisitos pendientes")
    .button("🔙 Volver");

  safeOpenForm(player, form, (response) => {
    if (response.selection === 0 && canRankup) {
      if (rankPurchaseLocks.has(player.name.toLowerCase())) return;
      rankPurchaseLocks.add(player.name.toLowerCase());
      try {
        const curBal = getBalance(player);
        if (curBal < nextRank.cost) {
          player.sendMessage("§b§l[§3Rangos§b§l]§r §cSaldo insuficiente al momento del ascenso.");
          return;
        }
        if (!setBalance(player, curBal - nextRank.cost, `rankup_${nextRank.id}`)) {
          player.sendMessage("§b§l[§3Rangos§b§l]§r §cNo se pudo descontar el costo del rango.");
          return;
        }
        globalThis.__sqlite_set_prop_v2__("ranks_addon", player, "player_survival_rank", nextRank.id);
        world.sendMessage(`§6§l[RANGOS] §a¡El jugador §e${player.name} §aha ascendido al rango ${nextRank.prefix}§a!`);
        try { player.playSound("random.levelup", { pitch: 1.0 }); } catch (e) {}
        try { player.playSound("random.toast", { pitch: 1.2 }); } catch (e) {}
      } finally {
        rankPurchaseLocks.delete(player.name.toLowerCase());
      }
    }
  });
}

console.warn("Ranks Addon iniciado.");
const COMMAND_NAMESPACE = "s";
const MAX_MONEY = 2147483647;
const rankPurchaseLocks = new Set();
const FCX_ADMIN_VISUAL_ROLE_PROPERTY = "fcx_admin:visual_role_v1";
const FCX_ADMIN_VISUAL_LEASE_PROPERTY = "fcx_admin:visual_role_lease_v1";
const FCX_ADMIN_VISUAL_ROLE_TAG_PREFIX = "fcx_admin:badge_role:";
const FCX_ADMIN_VISUAL_LEASE_MAX_AGE_MS = 10000;
const FCX_ADMIN_ROLE_PREFIXES = Object.freeze({
  OWNER: "§4§l[OWNER] §r",
  SECURITY_ADMIN: "§c§l[SECURITY ADMIN] §r",
  MODERATOR: "§2§l[MODERATOR] §r",
  SHERIFF: "§6§l[SHERIFF] §r",
  SUPPORT: "§3§l[SUPPORT] §r",
  ESTELAR: "§b§l[ESTELAR] §r",
  AUDITOR: "§7§l[AUDITOR] §r"
});
const SPECIAL_LABEL_PROPERTY = "ranks:special_label_v1";
const TEBEX_TOKEN_PROPERTY = "ranks:tebex_player_token_v1";
const TEBEX_PRINCIPAL_HASH_PROPERTY = "ranks:tebex_principal_hash_v1";
const TEBEX_COSMETIC_STATE_PROPERTY = "ranks:tebex_cosmetic_state_v1";
const TEBEX_LINK_REQUEST_MARKER = "[FCX_TEBEX_LINK_REQUEST_V1] ";
const TEBEX_PLAYER_READY_MARKER = "[FCX_TEBEX_PLAYER_READY_V1] ";
const TEBEX_DELIVERY_RESULT_MARKER = "[FCX_TEBEX_DELIVERY_RESULT_V1] ";
const TEBEX_COMMANDS_READY_MARKER = "[FCX_TEBEX_COMMANDS_READY_V1] ";
const TEBEX_SESSION_READY_MARKER = "[FCX_TEBEX_SESSION_READY_V1] ";
const TEBEX_LINK_REQUEST_TTL_MS = 2 * 60 * 1000;
const TEBEX_LINK_REQUEST_COOLDOWN_MS = 30 * 1000;
const pendingTebexLinkRequests = new Map();
const tebexLinkCooldowns = new Map();
let tebexSessionId = "";
const SPECIAL_LABELS = Object.freeze({
  APOYADOR: "§6§l[APOYADOR] §r",
  VIP: "§d§l[VIP] §r",
  DONADOR: "§6§l[DONADOR] §r",
  DONADOR_PLUS: "§g§l[DONADOR+] §r",
  MVP: "§b§l[MVP] §r",
  ELITE: "§5§l[ÉLITE] §r",
  LEYENDA: "§c§l[LEYENDA] §r",
  VETERANO: "§8§l[VETERANO] §r",
  FUNDADOR: "§4§l[FUNDADOR] §r",
  PIONERO: "§3§l[PIONERO] §r",
  CAMPEON: "§e§l[CAMPEÓN] §r",
  CREADOR: "§d§l[CREADOR] §r",
  STREAMER: "§5§l[STREAMER] §r",
  YOUTUBER: "§c§l[YOUTUBER] §r",
  BUILDER: "§2§l[BUILDER] §r",
  COLECCIONISTA: "§6§l[COLECCIONISTA] §r"
});
const TEBEX_ENTITLEMENT_LABELS = Object.freeze({
  "label.apoyador": "APOYADOR",
  "label.vip": "VIP",
  "label.donador": "DONADOR",
  "label.donador_plus": "DONADOR_PLUS",
  "label.mvp": "MVP",
  "label.elite": "ELITE",
  "label.leyenda": "LEYENDA",
  "label.coleccionista": "COLECCIONISTA"
});
const TEBEX_LABEL_PRIORITY = Object.freeze([
  "label.leyenda", "label.elite", "label.mvp", "label.donador_plus",
  "label.vip", "label.donador", "label.apoyador", "label.coleccionista"
]);

function isHex64(value) {
  return /^[0-9a-f]{64}$/.test(String(value ?? ""));
}

function emitTebexMarker(marker, payload) {
  console.warn(`${marker}${JSON.stringify(payload)}`);
}

function getTebexPrincipal(player) {
  try {
    const token = String(globalThis.__sqlite_get_prop_v2__("ranks_addon", player, TEBEX_TOKEN_PROPERTY) ?? "");
    const principalHash = String(globalThis.__sqlite_get_prop_v2__("ranks_addon", player, TEBEX_PRINCIPAL_HASH_PROPERTY) ?? "");
    if (!/^[0-9a-f]{64}$/.test(token) || !isHex64(principalHash)) return undefined;
    return { token, principalHash };
  } catch {
    return undefined;
  }
}

function emitTebexPlayerReady(player) {
  if (!/^[0-9a-f]{32}$/.test(tebexSessionId)) return;
  const principal = getTebexPrincipal(player);
  if (!principal) return;
  emitTebexMarker(TEBEX_PLAYER_READY_MARKER, {
    schemaVersion: 1,
    sessionId: tebexSessionId,
    playerName: String(player.name),
    entityId: String(player.id),
    principalHash: principal.principalHash
  });
}

function loadTebexCosmeticState(player) {
  try {
    const raw = String(globalThis.__sqlite_get_prop_v2__("ranks_addon", player, TEBEX_COSMETIC_STATE_PROPERTY) ?? "");
    if (!raw) return { schemaVersion: 1, entitlements: [], receipts: [] };
    const parsed = JSON.parse(raw);
    if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.entitlements) || !Array.isArray(parsed.receipts)) throw new Error("invalid_cosmetic_state");
    const entitlements = [...new Set(parsed.entitlements.filter((value) => TEBEX_ENTITLEMENT_LABELS[value]))].slice(0, 32);
    const receipts = [...new Set(parsed.receipts.filter((value) => /^(GRANT|REVOKE):[0-9a-f]{32}$/.test(value)))].slice(-64);
    return { schemaVersion: 1, entitlements, receipts };
  } catch (error) {
    console.warn(`[FCX_TEBEX] Estado cosmético inválido para ${player.name}: ${String(error).slice(0, 80)}`);
    return undefined;
  }
}

function hasTebexCosmeticState(player) {
  try {
    return Boolean(String(globalThis.__sqlite_get_prop_v2__("ranks_addon", player, TEBEX_COSMETIC_STATE_PROPERTY) ?? ""));
  } catch {
    return false;
  }
}

function saveTebexCosmeticState(player, state) {
  const serialized = JSON.stringify(state);
  if (serialized.length > 4096) return false;
  try {
    globalThis.__sqlite_set_prop_v2__("ranks_addon", player, TEBEX_COSMETIC_STATE_PROPERTY, serialized);
    return String(globalThis.__sqlite_get_prop_v2__("ranks_addon", player, TEBEX_COSMETIC_STATE_PROPERTY) ?? "") === serialized;
  } catch {
    return false;
  }
}

function preferredPaidLabel(entitlements) {
  for (const entitlement of TEBEX_LABEL_PRIORITY) {
    if (entitlements.includes(entitlement)) return TEBEX_ENTITLEMENT_LABELS[entitlement];
  }
  return "";
}

function reconcilePaidLabel(player, state) {
  const paidLabels = new Set(Object.values(TEBEX_ENTITLEMENT_LABELS));
  const current = String(globalThis.__sqlite_get_prop_v2__("ranks_addon", player, SPECIAL_LABEL_PROPERTY) ?? "");
  const preferred = preferredPaidLabel(state.entitlements);
  if (!paidLabels.has(current) && current) return true;
  globalThis.__sqlite_set_prop_v2__("ranks_addon", player, SPECIAL_LABEL_PROPERTY, preferred || undefined);
  return String(globalThis.__sqlite_get_prop_v2__("ranks_addon", player, SPECIAL_LABEL_PROPERTY) ?? "") === preferred;
}

function findExactOnlinePlayer(playerName, entityId) {
  const normalized = String(playerName ?? "").trim().toLowerCase();
  const matches = world.getAllPlayers().filter((player) => String(player.name).trim().toLowerCase() === normalized && String(player.id) === String(entityId));
  return matches.length === 1 ? matches[0] : undefined;
}

function consumeTebexLinkRequest(playerName, entityId, requestId) {
  const pending = pendingTebexLinkRequests.get(String(requestId));
  pendingTebexLinkRequests.delete(String(requestId));
  if (!pending || pending.expiresAt < Date.now()) return undefined;
  if (pending.playerName !== String(playerName) || pending.entityId !== String(entityId)) return undefined;
  return findExactOnlinePlayer(playerName, entityId);
}

function requestTebexLink(player) {
  if (!/^[0-9a-f]{32}$/.test(tebexSessionId)) {
    player.sendMessage("§c[Tienda web] La tienda todavía no está disponible.");
    return;
  }
  const now = Date.now();
  const cooldownKey = String(player.id);
  if ((tebexLinkCooldowns.get(cooldownKey) ?? 0) > now) {
    player.sendMessage("§e[Tienda web] Espera unos segundos antes de solicitar otro código.");
    return;
  }
  tebexLinkCooldowns.set(cooldownKey, now + TEBEX_LINK_REQUEST_COOLDOWN_MS);
  const requestId = `${now.toString(16)}-${Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, "0")}`;
  const principal = getTebexPrincipal(player);
  pendingTebexLinkRequests.set(requestId, {
    playerName: String(player.name),
    entityId: String(player.id),
    expiresAt: now + TEBEX_LINK_REQUEST_TTL_MS
  });
  emitTebexMarker(TEBEX_LINK_REQUEST_MARKER, {
    schemaVersion: 1,
    sessionId: tebexSessionId,
    requestId,
    playerName: String(player.name),
    entityId: String(player.id),
    principalHash: principal?.principalHash ?? ""
  });
  player.sendMessage("§a[Tienda web] Solicitud enviada. Tu código privado aparecerá en unos segundos.");
}

function showTebexLink(player, linkCode, storeUrl) {
  player.sendMessage("§6§l[Tienda web]§r §fAbre la tienda y escribe este código de vinculación:");
  player.sendMessage(`§e§l${linkCode}§r`);
  player.sendMessage(`§b${storeUrl}§r`);
  player.sendMessage("§7El código caduca pronto, funciona una sola vez y no debes compartirlo.");
}

function provisionTebexPrincipal(playerName, entityId, requestId, token, principalHash, linkCode, storeUrl) {
  const player = consumeTebexLinkRequest(playerName, entityId, requestId);
  if (!player || !/^[0-9a-f]{64}$/.test(String(token)) || !isHex64(principalHash) || !/^[A-Za-z0-9_-]{16}$/.test(String(linkCode)) || !/^https:\/\/[^\s"]{1,220}$/.test(String(storeUrl))) return;
  try {
    const existing = getTebexPrincipal(player);
    if (existing && existing.principalHash !== principalHash) throw new Error("principal_rotation_denied");
    globalThis.__sqlite_set_prop_v2__("ranks_addon", player, TEBEX_TOKEN_PROPERTY, String(token));
    globalThis.__sqlite_set_prop_v2__("ranks_addon", player, TEBEX_PRINCIPAL_HASH_PROPERTY, String(principalHash));
    const verified = getTebexPrincipal(player);
    if (!verified || verified.principalHash !== principalHash || verified.token !== token) throw new Error("principal_write_verification_failed");
    showTebexLink(player, linkCode, storeUrl);
    emitTebexPlayerReady(player);
  } catch (error) {
    console.warn(`[FCX_TEBEX] Aprovisionamiento rechazado: ${String(error).slice(0, 80)}`);
  }
}

function showExistingTebexLink(playerName, entityId, requestId, principalHash, linkCode, storeUrl) {
  const player = consumeTebexLinkRequest(playerName, entityId, requestId);
  const principal = player ? getTebexPrincipal(player) : undefined;
  if (!player || !principal || principal.principalHash !== principalHash || !/^[A-Za-z0-9_-]{16}$/.test(String(linkCode)) || !/^https:\/\/[^\s"]{1,220}$/.test(String(storeUrl))) return;
  showTebexLink(player, linkCode, storeUrl);
  emitTebexPlayerReady(player);
}

function applyTebexEntitlement(playerName, entityId, principalHash, action, entitlementId, deliveryId) {
  let result = "FAILED";
  let errorCode = "VALIDATION_FAILED";
  const normalizedAction = String(action);
  try {
    const player = findExactOnlinePlayer(playerName, entityId);
    if (!player) throw new Error("PLAYER_NOT_FOUND");
    const principal = getTebexPrincipal(player);
    if (!principal || principal.principalHash !== String(principalHash)) throw new Error("IDENTITY_MISMATCH");
    if (!TEBEX_ENTITLEMENT_LABELS[String(entitlementId)] || !/^[0-9a-f]{32}$/.test(String(deliveryId)) || !["GRANT", "REVOKE"].includes(normalizedAction)) throw new Error("INVALID_ENTITLEMENT");
    const state = loadTebexCosmeticState(player);
    if (!state) throw new Error("STATE_CORRUPT");
    const receipt = `${normalizedAction}:${deliveryId}`;
    let changed = false;
    if (!state.receipts.includes(receipt)) {
      state.receipts.push(receipt);
      state.receipts = state.receipts.slice(-64);
      changed = true;
    }
    if (normalizedAction === "GRANT" && !state.entitlements.includes(entitlementId)) {
      state.entitlements.push(entitlementId);
      changed = true;
    }
    if (normalizedAction === "REVOKE" && state.entitlements.includes(entitlementId)) {
      state.entitlements = state.entitlements.filter((value) => value !== entitlementId);
      changed = true;
    }
    if (changed) {
      if (!saveTebexCosmeticState(player, state)) throw new Error("STATE_WRITE_FAILED");
    }
    if (!reconcilePaidLabel(player, state)) throw new Error("LABEL_WRITE_FAILED");
    result = "SUCCESS";
    errorCode = "";
    player.sendMessage(normalizedAction === "GRANT"
      ? `§a[Tienda web] Cosmético recibido: §e${SPECIAL_LABELS[TEBEX_ENTITLEMENT_LABELS[entitlementId]]}`
      : "§e[Tienda web] Un cosmético fue retirado por reembolso o contracargo.");
  } catch (error) {
    errorCode = String(error?.message ?? error).replace(/[^A-Z0-9_]/gi, "_").slice(0, 64) || "INTERNAL_ERROR";
  }
  emitTebexMarker(TEBEX_DELIVERY_RESULT_MARKER, {
    schemaVersion: 1,
    sessionId: tebexSessionId,
    deliveryId: String(deliveryId),
    principalHash: String(principalHash),
    action: normalizedAction,
    result,
    errorCode
  });
}

function normalizeSpecialLabel(value) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .trim().toUpperCase().replace(/\+/g, "_PLUS").replace(/[\s-]+/g, "_");
}

function getSpecialLabelPrefix(player) {
  try {
    const label = String(globalThis.__sqlite_get_prop_v2__("ranks_addon", player, SPECIAL_LABEL_PROPERTY) ?? "");
    const equippedTitle = String(globalThis.__sqlite_get_prop_v2__("ranks_addon", player, "equipped_title") ?? "").toUpperCase();
    if (label === "VIP" && equippedTitle === "VIP") return "";
    return SPECIAL_LABELS[label] ?? "";
  } catch {
    return "";
  }
}

function assignSpecialLabelFromConsole(playerQuery, requestedLabel) {
  const query = String(playerQuery ?? "").trim().toLowerCase();
  const matches = world.getAllPlayers().filter((player) => String(player.name).trim().toLowerCase() === query);
  if (matches.length !== 1) {
    console.warn(`[RANK_LABEL_AUDIT_V1] ${JSON.stringify({ timestamp: Date.now(), result: "REJECTED", reason: matches.length ? "ambiguous_player" : "player_not_found" })}`);
    return;
  }
  const player = matches[0];
  const normalized = normalizeSpecialLabel(requestedLabel);
  const clear = new Set(["NINGUNA", "NONE", "QUITAR", "REMOVE"]).has(normalized);
  if (!clear && !SPECIAL_LABELS[normalized]) {
    console.warn(`[RANK_LABEL_AUDIT_V1] ${JSON.stringify({ timestamp: Date.now(), targetName: player.name, result: "REJECTED", reason: "unknown_label", allowed: Object.keys(SPECIAL_LABELS) })}`);
    return;
  }
  try {
    globalThis.__sqlite_set_prop_v2__("ranks_addon", player, SPECIAL_LABEL_PROPERTY, clear ? undefined : normalized);
    const readBack = String(globalThis.__sqlite_get_prop_v2__("ranks_addon", player, SPECIAL_LABEL_PROPERTY) ?? "");
    if (readBack !== (clear ? "" : normalized)) throw new Error("special_label_write_verification_failed");
    console.warn(`[RANK_LABEL_AUDIT_V1] ${JSON.stringify({ timestamp: Date.now(), targetName: player.name, label: clear ? "NONE" : normalized, result: "SUCCESS", source: "SERVER_CONSOLE" })}`);
    player.sendMessage(clear ? "§7[Etiquetas] Se retiró tu etiqueta especial." : `§a[Etiquetas] Recibiste ${SPECIAL_LABELS[normalized]}§a.`);
  } catch (error) {
    console.warn(`[RANK_LABEL_AUDIT_V1] ${JSON.stringify({ timestamp: Date.now(), targetName: player.name, result: "FAILED", reason: String(error).slice(0, 100) })}`);
  }
}

function getFcxAdminRolePrefix(player) {
  try {
    const lease = Number(globalThis.__sqlite_get_prop_v2__("ranks_addon", "world", FCX_ADMIN_VISUAL_LEASE_PROPERTY));
    const age = Date.now() - lease;
    const leaseFresh = Number.isFinite(lease) && age >= 0 && age <= FCX_ADMIN_VISUAL_LEASE_MAX_AGE_MS;
    const taggedRole = player.getTags().find((tag) => tag.startsWith(FCX_ADMIN_VISUAL_ROLE_TAG_PREFIX))?.slice(FCX_ADMIN_VISUAL_ROLE_TAG_PREFIX.length) ?? "";
    const role = leaseFresh ? String(globalThis.__sqlite_get_prop_v2__("ranks_addon", player, FCX_ADMIN_VISUAL_ROLE_PROPERTY) ?? "") : taggedRole;
    return FCX_ADMIN_ROLE_PREFIXES[role] ?? "";
  } catch {
    return "";
  }
}

function commandOk(message) {
  return { status: CustomCommandStatus.Success, message };
}

function commandError(message) {
  return { status: CustomCommandStatus.Failure, message };
}

// Auxiliar robusto para abrir formularios evitando conflictos de pantallas
function safeOpenForm(player, form, onSelect, onCancel = undefined, retryCount = 0) {
  form.show(player).then((response) => {
    if (response.canceled) {
      if (response.cancelationReason === "UserBusy" && retryCount < 5) {
        system.runTimeout(() => {
          safeOpenForm(player, form, onSelect, onCancel, retryCount + 1);
        }, 10);
        return;
      }
      if (onCancel) {
        system.run(() => {
          onCancel(response);
        });
      }
      return;
    }
    system.run(() => {
      onSelect(response);
    });
  }).catch((err) => {
    console.warn(`[Rangos] Error en safeOpenForm: ${err}`);
  });
}

// Configuración de Títulos
const TITLES = [
  { id: "cazador", name: "Cazador", color: "§a", price: 0 }, // Gratis por defecto
  { id: "aventurero", name: "Aventurero", color: "§b", price: 5000 },
  { id: "guerrero", name: "Guerrero", color: "§e", price: 15000 },
  { id: "vip", name: "VIP", color: "§d", price: 50000 },
  { id: "millonario", name: "Millonario", color: "§6", price: 100000 },
  { id: "rey", name: "Rey", color: "§c", price: 250000 }
];

// Obtener títulos del jugador
function getUnlockedTitles(player) {
  try {
    const raw = globalThis.__sqlite_get_prop_v2__("ranks_addon", player, "unlocked_titles");
    if (!raw) return ["cazador"]; // El título gratis siempre desbloqueado
    return String(raw).split(",").filter(x => x);
  } catch (e) { ErrorReporter.report(e, { addonId: "ranks_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return ["cazador"];
  }
}

function unlockTitle(player, titleId) {
  const current = getUnlockedTitles(player);
  if (!current.includes(titleId)) {
    current.push(titleId);
    try {
      globalThis.__sqlite_set_prop_v2__("ranks_addon", player, "unlocked_titles", current.join(","));
      return true;
    } catch (e) { ErrorReporter.report(e, { addonId: "ranks_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("Error al guardar títulos desbloqueados: " + e);
      return false;
    }
  }
  return true;
}

function getEquippedTitle(player) {
  try {
    return globalThis.__sqlite_get_prop_v2__("ranks_addon", player, "equipped_title") || "";
  } catch (e) { ErrorReporter.report(e, { addonId: "ranks_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    return "";
  }
}

function setEquippedTitle(player, title) {
  try {
    globalThis.__sqlite_set_prop_v2__("ranks_addon", player, "equipped_title", title || "");
    return true;
  } catch (e) { ErrorReporter.report(e, { addonId: "ranks_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn("Error al equipar título: " + e);
    return false;
  }
}

// Economía
function getMoneyObjective() {
  let obj = world.scoreboard.getObjective("money");
  if (!obj) {
    try {
      obj = world.scoreboard.addObjective("money", "§e$ Dinero");
    } catch (e) { ErrorReporter.report(e, { addonId: "ranks_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
  }
  return obj;
}

function getBalance(player) {
  const obj = getMoneyObjective();
  if (!obj) return 0;
  try {
    const score = obj.getScore(player);
    if (score !== undefined) return score;
  } catch (e) { ErrorReporter.report(e, { addonId: "ranks_addon", moduleId: "main.js", operation: "read_balance_identity", category: "runtime" }); }
  try {
    return obj.getScore(player.name) ?? 0;
  } catch (e) { ErrorReporter.report(e, { addonId: "ranks_addon", moduleId: "main.js", operation: "read_balance_name", category: "runtime" });
    return 0;
  }
}

function setBalance(player, amount, reason = "rank_transaction") {
  const obj = getMoneyObjective();
  const value = amount;
  const before = getBalance(player);
  if (!obj) {
    console.warn(`[ECONOMY_TX] REJECT objective_missing player=${player?.name || "unknown"} amount=${amount} reason=${reason}`);
    return false;
  }
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MONEY) {
    console.warn(`[ECONOMY_TX] REJECT invalid_balance player=${player?.name || "unknown"} amount=${amount} reason=${reason}`);
    return false;
  }
  try {
    let persisted;
    try {
      obj.setScore(player, value);
      persisted = obj.getScore(player);
    } catch (e) {
      obj.setScore(player.name, value);
      persisted = obj.getScore(player.name);
    }
    if (persisted !== value) {
      console.warn(`[ECONOMY_TX] REJECT write_mismatch player=${player?.name || "unknown"} expected=${value} actual=${persisted} reason=${reason}`);
      return false;
    }
    console.warn(`[ECONOMY_TX] COMMIT player=${player?.name || "unknown"} delta=${value - before} before=${before} after=${value} reason=${reason}`);
    return true;
  } catch (e) { ErrorReporter.report(e, { addonId: "ranks_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
    console.warn(`[ECONOMY_TX] REJECT write_failed player=${player?.name || "unknown"} amount=${value} reason=${reason} error=${e}`);
    console.warn(`Error al modificar saldo para ${player.name}: ${e}`);
    return false;
  }
}

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
            for (const name of ["rankup", "rango", "ascender"]) {
        register({ name: `${COMMAND_NAMESPACE}:${name}`, description: "Abre el menú de ascenso de rango", permissionLevel: CommandPermissionLevel.Any }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          system.run(() => openRankupMenu(sender));
          return commandOk(`Abriendo ${name}.`);
        });
      }
      for (const name of ["titulos", "titles"]) {
        register({ name: `${COMMAND_NAMESPACE}:${name}`, description: "Abre el menu de titulos", permissionLevel: CommandPermissionLevel.Any }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          system.run(() => openTitlesMenu(sender));
          return commandOk("Abriendo titulos.");
        });
      }
      register({
        name: `${COMMAND_NAMESPACE}:tebex`,
        description: "Genera un código privado para la tienda web",
        permissionLevel: CommandPermissionLevel.Any
      }, (origin) => {
        const sender = origin?.sourceEntity;
        if (!sender) return commandError("Solo para jugadores.");
        system.run(() => requestTebexLink(sender));
        return commandOk("Solicitando código de tienda.");
      });
      register({
        name: `${COMMAND_NAMESPACE}:etiqueta`,
        description: "Asigna una etiqueta cosmética desde consola",
        permissionLevel: CommandPermissionLevel.Owner,
        mandatoryParameters: [
          { name: "jugador", type: CustomCommandParamType.String },
          { name: "etiqueta", type: CustomCommandParamType.String }
        ]
      }, (origin, jugador, etiqueta) => {
        if (origin?.sourceEntity) return commandError("Este comando solo puede ejecutarse desde la consola BDS.");
        system.run(() => assignSpecialLabelFromConsole(String(jugador), String(etiqueta)));
        return commandOk("Asignación de etiqueta programada.");
      });
      register({
        name: `${COMMAND_NAMESPACE}:tebex_session`,
        description: "Handshake interno Tebex",
        permissionLevel: CommandPermissionLevel.Owner,
        mandatoryParameters: [{ name: "session_id", type: CustomCommandParamType.String }]
      }, (origin, sessionId) => {
        if (origin?.sourceEntity) return commandError("Canal interno exclusivo de consola.");
        const value = String(sessionId);
        if (!/^[0-9a-f]{32}$/.test(value)) return commandError("Handshake inválido.");
        tebexSessionId = value;
        emitTebexMarker(TEBEX_SESSION_READY_MARKER, { schemaVersion: 1, sessionId: value });
        return commandOk("Handshake Tebex aceptado.");
      });
      register({
        name: `${COMMAND_NAMESPACE}:tebex_provision`,
        description: "Canal interno de vinculación Tebex",
        permissionLevel: CommandPermissionLevel.Owner,
        mandatoryParameters: [
          { name: "jugador", type: CustomCommandParamType.String },
          { name: "entity_id", type: CustomCommandParamType.String },
          { name: "request_id", type: CustomCommandParamType.String },
          { name: "token", type: CustomCommandParamType.String },
          { name: "principal_hash", type: CustomCommandParamType.String },
          { name: "link_code", type: CustomCommandParamType.String },
          { name: "store_url", type: CustomCommandParamType.String }
        ]
      }, (origin, jugador, entityId, requestId, token, principalHash, linkCode, storeUrl) => {
        if (origin?.sourceEntity) return commandError("Canal interno exclusivo de consola.");
        system.run(() => provisionTebexPrincipal(String(jugador), String(entityId), String(requestId), String(token), String(principalHash), String(linkCode), String(storeUrl)));
        return commandOk("Vinculación Tebex programada.");
      });
      register({
        name: `${COMMAND_NAMESPACE}:tebex_link`,
        description: "Canal interno para código Tebex",
        permissionLevel: CommandPermissionLevel.Owner,
        mandatoryParameters: [
          { name: "jugador", type: CustomCommandParamType.String },
          { name: "entity_id", type: CustomCommandParamType.String },
          { name: "request_id", type: CustomCommandParamType.String },
          { name: "principal_hash", type: CustomCommandParamType.String },
          { name: "link_code", type: CustomCommandParamType.String },
          { name: "store_url", type: CustomCommandParamType.String }
        ]
      }, (origin, jugador, entityId, requestId, principalHash, linkCode, storeUrl) => {
        if (origin?.sourceEntity) return commandError("Canal interno exclusivo de consola.");
        system.run(() => showExistingTebexLink(String(jugador), String(entityId), String(requestId), String(principalHash), String(linkCode), String(storeUrl)));
        return commandOk("Código Tebex programado.");
      });
      register({
        name: `${COMMAND_NAMESPACE}:tebex_entitlement`,
        description: "Canal interno de cosméticos Tebex",
        permissionLevel: CommandPermissionLevel.Owner,
        mandatoryParameters: [
          { name: "jugador", type: CustomCommandParamType.String },
          { name: "entity_id", type: CustomCommandParamType.String },
          { name: "principal_hash", type: CustomCommandParamType.String },
          { name: "accion", type: CustomCommandParamType.String },
          { name: "entitlement", type: CustomCommandParamType.String },
          { name: "delivery_id", type: CustomCommandParamType.String }
        ]
      }, (origin, jugador, entityId, principalHash, accion, entitlement, deliveryId) => {
        if (origin?.sourceEntity) return commandError("Canal interno exclusivo de consola.");
        system.run(() => applyTebexEntitlement(String(jugador), String(entityId), String(principalHash), String(accion), String(entitlement), String(deliveryId)));
        return commandOk("Entrega Tebex programada.");
      });
      emitTebexMarker(TEBEX_COMMANDS_READY_MARKER, {
        schemaVersion: 1,
        namespace: COMMAND_NAMESPACE,
        publicCommand: "tebex",
        internalCommands: ["tebex_session", "tebex_provision", "tebex_link", "tebex_entitlement"]
      });
    } catch (e) { ErrorReporter.report(e, { addonId: "ranks_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
      console.warn("[Rangos] Error registrando custom commands: " + e);
    }
  });
}

registerCustomCommands();

try {
  const playerSpawn = world.afterEvents?.playerSpawn;
  if (playerSpawn && typeof playerSpawn.subscribe === "function") {
    playerSpawn.subscribe((event) => {
      if (!event.initialSpawn) return;
      system.runTimeout(() => {
        try {
          if (hasTebexCosmeticState(event.player)) {
            const state = loadTebexCosmeticState(event.player);
            if (state) reconcilePaidLabel(event.player, state);
          }
          emitTebexPlayerReady(event.player);
        } catch (error) {
          console.warn(`[FCX_TEBEX] No se pudo reconciliar al conectar: ${String(error).slice(0, 80)}`);
        }
      }, 20);
    });
  }
} catch (error) {
  console.warn(`[FCX_TEBEX] No se pudo registrar playerSpawn: ${String(error).slice(0, 80)}`);
}

// Escuchar comandos del chat
try {
  const beforeChat = world.beforeEvents ? (world.beforeEvents.chatSend || world.beforeEvents.chat) : undefined;
  const afterChat = world.afterEvents ? (world.afterEvents.chatSend || world.afterEvents.chat) : undefined;
  const chatEvent = beforeChat || afterChat;

  if (chatEvent && typeof chatEvent.subscribe === "function") {
    // 1. Formateador de chat con Rangos y Clanes
    if (beforeChat && typeof beforeChat.subscribe === "function") {
      beforeChat.subscribe((event) => {
        try {
          const message = String(event.message || "").trim();
          const sender = event.sender;
          if (message.startsWith("/s:")) return;

          // Check mute state before broadcasting
          try {
            const normalizedName = sender.name.trim().toLowerCase();
            const muteExpiry = globalThis.__sqlite_get_prop_v2__("ranks_addon", "world", "mute_" + normalizedName);
            if (typeof muteExpiry === "number" && Date.now() < muteExpiry) {
              // Player is muted - cancel message, notify them, don't rebroadcast
              if (event.cancel !== undefined) event.cancel = true;
              const remainingMin = Math.ceil((muteExpiry - Date.now()) / 60000);
              const muteReason = String(globalThis.__sqlite_get_prop_v2__("ranks_addon", "world", "mute_reason_" + normalizedName) || "No especificado");
              system.run(() => {
                try {
                  sender.sendMessage(`§b§l[§3Servidor§b§l]§r §cEstás silenciado. Tiempo restante: §e${remainingMin} min§c. Motivo: §e${muteReason}`);
                } catch (e) { ErrorReporter.report(e, { addonId: "ranks_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}
              });
              return;
            }
          } catch (e) { ErrorReporter.report(e, { addonId: "ranks_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

          if (event.cancel !== undefined) {
            event.cancel = true;
          }

          const title = globalThis.__sqlite_get_prop_v2__("ranks_addon", sender, "equipped_title") || "";
          const specialLabelPrefix = getSpecialLabelPrefix(sender);
          const survRankId = getPlayerSurvivalRank(sender);
          const survRank = SURVIVAL_RANKS.find(r => r.id === survRankId) || SURVIVAL_RANKS[0];
          const survRankPrefix = survRank.prefix ? `${survRank.prefix} ` : "";
          let titlePrefix = "";
          if (title) {
            const titleColors = {
              "Cazador": "§a",
              "Aventurero": "§b",
              "Guerrero": "§e",
              "VIP": "§d",
              "Millonario": "§6",
              "Rey": "§c"
            };
            const titleColor = titleColors[title] || "§7";
            titlePrefix = `${titleColor}[${title}] §r`;
          }

          let clanPrefix = "";
          let rolePrefix = getFcxAdminRolePrefix(sender);
          let badgePrefix = "";
          try {
            let clanName = "";
            let clanColor = "gold";
            let badgeName = "";
            let badgeColorTag = "yellow";
            for (const tag of sender.getTags()) {
              if (tag.startsWith("clan:")) {
                clanName = tag.substring(5);
              } else if (tag.startsWith("clan_color:")) {
                clanColor = tag.substring(11);
              } else if (tag.startsWith("badge:")) {
                badgeName = tag.substring(6);
              } else if (tag.startsWith("badge_color:")) {
                badgeColorTag = tag.substring(12);
              } else if (!rolePrefix && tag.startsWith("rol:")) {
                const rName = tag.substring(4);
                let rColor = "§e";
                const lower = rName.toLowerCase();
                if (lower === "owner" || lower === "dueño" || lower === "admin" || lower === "creador") rColor = "§4§l";
                else if (lower === "mod" || lower === "moderador") rColor = "§2§l";
                else if (lower === "ayudante" || lower === "helper" || lower === "staff") rColor = "§3§l";
                else if (lower === "vip") rColor = "§d§l";
                rolePrefix = `${rColor}[${rName}] §r`;
              }
            }
            
            const colorCodes = {
              "white": "§f", "red": "§c", "blue": "§b", "green": "§a", "yellow": "§e",
              "purple": "§d", "orange": "§6", "gray": "§7", "black": "§0", "gold": "§g",
              "aqua": "§b", "light_purple": "§d"
            };

            if (badgeName) {
              const bColorCode = colorCodes[badgeColorTag] || "§e";
              badgePrefix = `${bColorCode}[${badgeName}] §r`;
            }
            if (clanName) {
              const colorCodes = {
                "white": "§f", "red": "§c", "blue": "§b", "green": "§a", "yellow": "§e",
                "purple": "§d", "orange": "§6", "gray": "§7", "black": "§0", "gold": "§g",
                "aqua": "§b", "light_purple": "§d"
              };
              const colorCode = colorCodes[clanColor] || "§6";
              clanPrefix = `${colorCode}[${clanName}] §r`;
            }
          } catch (e) { ErrorReporter.report(e, { addonId: "ranks_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });}

          const formattedMessage = `${titlePrefix}${specialLabelPrefix}${clanPrefix}${rolePrefix}§7${sender.name}: §f${message}`;
          system.run(() => {
            try {
              world.sendMessage(formattedMessage);
              console.warn(`[CHAT] <${sender.name}> ${message}`);
            } catch (e) {
              ErrorReporter.report(e, { addonId: "ranks_addon", moduleId: "main.js", operation: "broadcastChat", category: "runtime" });
            }
          });
        } catch (err) { ErrorReporter.report(err, { addonId: "ranks_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
          console.warn(`[Rangos] Error en formateador de chat: ${err}`);
        }
      });
    }

  }
} catch (e) { ErrorReporter.report(e, { addonId: "ranks_addon", moduleId: "main.js", operation: "try-catch", category: "runtime" });
  console.warn("[Rangos] Error al registrar chatEvent: " + e);
}

// Menú de Títulos
function openTitlesMenu(player) {
  const bal = getBalance(player);
  const unlocked = getUnlockedTitles(player);
  const equipped = getEquippedTitle(player);

  const form = new ActionFormData()
    .title("§e§lTítulos y Rangos")
    .body(`Tu saldo: §a$${bal}§r\n\n§7Selecciona un título para comprarlo o equiparlo:`);

  // Botón de guía al inicio
  form.button("❔ ¿Cómo funciona? / Guía");

  TITLES.forEach((t) => {
    const isUnlocked = unlocked.includes(t.id);
    const isEquipped = equipped === t.name;

    let statusText = "";
    if (isEquipped) {
      statusText = "§a[Equipado]";
    } else if (isUnlocked) {
      statusText = "§e[Desbloqueado]";
    } else {
      statusText = `§6[Comprar: $${t.price}]`;
    }

    form.button(`${t.color}[${t.name}] §r\n${statusText}`);
  });

  // Botón para desequipar título
  form.button("❌ Desequipar título actual");

  safeOpenForm(player, form, (response) => {
    const idx = response.selection;
    if (idx === undefined) return;

    if (idx === 0) {
      openTitlesTutorial(player);
      return;
    }

    const titleIdx = idx - 1;

    if (titleIdx === TITLES.length) {
      // Desequipar
      setEquippedTitle(player, "");
      player.sendMessage("§b§l[§3Títulos§b§l]§r §aHas desequipado tu título actual.");
      return;
    }

    if (titleIdx >= 0 && titleIdx < TITLES.length) {
      const title = TITLES[titleIdx];
      const currentUnlocked = getUnlockedTitles(player);
      const isUnlocked = currentUnlocked.includes(title.id);

      if (isUnlocked) {
        // Equipar
        setEquippedTitle(player, title.name);
        player.sendMessage(`§b§l[§3Títulos§b§l]§r §a¡Ahora tienes equipado el título ${title.color}[${title.name}]§a!`);
      } else {
        const playerKey = player.name.toLowerCase();
        if (rankPurchaseLocks.has(playerKey)) {
          player.sendMessage("§b§l[§3Títulos§b§l]§r §cYa se está procesando una compra de título.");
          return;
        }
        rankPurchaseLocks.add(playerKey);
        try {
        // Revalidar propiedad y saldo actuales al confirmar el formulario.
        if (getUnlockedTitles(player).includes(title.id)) {
          setEquippedTitle(player, title.name);
          player.sendMessage(`§b§l[§3Títulos§b§l]§r §a¡Ahora tienes equipado el título ${title.color}[${title.name}]§a!`);
          return;
        }
        const currentBalance = getBalance(player);
        if (currentBalance < title.price) {
          player.sendMessage(`§b§l[§3Títulos§b§l]§r §cNo tienes suficiente dinero. Requiere: §a$${title.price}§c.`);
          return;
        }

        if (!Number.isSafeInteger(currentBalance) || currentBalance > MAX_MONEY) {
          console.warn(`[ECONOMY_TX] REJECT invalid_source_balance player=${player.name} balance=${currentBalance} reason=rank_purchase_${title.id}`);
          player.sendMessage("§b§l[§3Títulos§b§l]§r §cTu saldo no es válido para realizar esta compra. Contacta a un administrador.");
          return;
        }
        if (!setBalance(player, currentBalance - title.price, `rank_purchase_${title.id}`)) {
          player.sendMessage("§b§l[§3Títulos§b§l]§r §cNo se pudo aplicar el cobro.");
          return;
        }
        if (!unlockTitle(player, title.id)) {
          if (setBalance(player, currentBalance, `rank_purchase_rollback_${title.id}`)) {
            player.sendMessage("§b§l[§3Títulos§b§l]§r §cNo se pudo guardar el título. El cobro fue revertido.");
          } else {
            console.warn(`[ECONOMY_CRITICAL] rank_purchase_rollback_failed player=${player.name} amount=${title.price} title=${title.id}`);
            player.sendMessage("§b§l[§3Títulos§b§l]§r §cNo se pudo guardar el título ni revertir el cobro. Contacta a un administrador.");
          }
          return;
        }
        const equippedTitle = setEquippedTitle(player, title.name);

        if (equippedTitle) {
          player.sendMessage(`§b§l[§3Títulos§b§l]§r §a¡Has comprado y equipado el título ${title.color}[${title.name}] §apor §6$${title.price}§a!`);
        } else {
          player.sendMessage(`§b§l[§3Títulos§b§l]§r §eCompraste el título ${title.color}[${title.name}] §epor §6$${title.price}§e, pero no pudo equiparse automáticamente.`);
        }
        } finally {
          rankPurchaseLocks.delete(playerKey);
        }
      }
    }
  });
}

function openTitlesTutorial(player) {
  const form = new ActionFormData()
    .title("❔ Guía de Títulos")
    .body("§e¿Cómo funciona el Sistema de Títulos?\n\n" +
          "§a1. ¿Qué son los títulos?\n" +
          "§7- Son prefijos estéticos que se muestran a la izquierda de tu nombre.\n" +
          "§7- Aparecen sobre tu cabeza (nametags) y también reflejan tu rango actual.\n\n" +
          "§a2. ¿Cómo comprar un título?\n" +
          "§7- Si tienes suficiente dinero del scoreboard, selecciona cualquier título bloqueado en la lista para comprarlo.\n" +
          "§7- Al comprarlo, se desbloqueará para siempre y se equipará automáticamente.\n\n" +
          "§a3. ¿Cómo equipar o quitar?\n" +
          "§7- Los títulos que ya compraste aparecerán como §e[Desbloqueado]§7. Haz clic sobre uno para equiparlo.\n" +
          "§7- Si quieres quitarte el título, haz clic en el botón §c❌ Desequipar título actual §7al final del menú principal.")
    .button("🔙 Volver");

  safeOpenForm(player, form, () => {
    openTitlesMenu(player);
  });
}
