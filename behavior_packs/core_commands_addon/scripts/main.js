import {
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
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
    if (event.sourceEntity && event.sourceEntity.typeId === "minecraft:player") return;
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
globalThis.__sqlite_sync_complete_v2__.delete("core_commands_addon");
globalThis.__sqlite_request_sync_v3__("core_commands_addon", 0);
system.runTimeout(() => {
  // Los relays V2 no entregaban una confirmación ordenada durante /reload.
  // Se solicita una sola reconciliación; con el relay V3 no hay segunda carga.
  try {
    const state = globalThis.__sqlite_sync_status_v3__.get("core_commands_addon");
    if (!state || Number(state.protocol || 0) < 3) globalThis.__sqlite_request_sync_v3__("core_commands_addon", 1);
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

console.warn("[Core Commands] Addon cargado.");

const COMMAND_NAMESPACE = "s";

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

function reply(sender, text) {
  system.run(() => {
    try {
      sender.sendMessage(text);
    } catch (e) {
      console.warn("[Core Commands] Error enviando mensaje: " + e);
    }
  });
}

function isPlayerOp(player) {
  if (!player) return false;
  try {
    if (player.playerPermissionLevel === PlayerPermissionLevel.Operator) return true;
  } catch (e) {}
  try {
    if (typeof player.hasTag === "function") {
      if (player.hasTag("op") || player.hasTag("admin")) return true;
    }
    if (typeof player.isOp === "function") return !!player.isOp();
    return player.isOp === true;
  } catch (e) {
    return false;
  }
}

function sendHelp(sender) {
  reply(sender, "§e====== §bPacífico Comunitario - Guía de Comandos §e======");
  reply(sender, "§7Construye, comercia y progresa en comunidad. Lee §e/s:reglas§7.");
  reply(sender, "§7Usa §e/s:ayuda§7 o abre el panel visual con §e/s:menu§7.");
  reply(sender, "§a1. Viajes y Regreso");
  reply(sender, "§e/s:guardarcasa [1-5] §7- Guarda tu base actual (/s:sethome).");
  reply(sender, "§e/s:casa [1-5] §7- Te lleva a tu base guardada (/s:home).");
  reply(sender, "§e/s:aparicion §7- Te teletransporta al spawn global (/s:spawn).");
  reply(sender, "§e/s:destinos §7- Abre el menú de warps públicos (/s:warps).");
  reply(sender, "§e/s:pedirtp <jugador> §7- Solicita teletransporte (/s:tpa).");
  reply(sender, "§e/s:tpaaceptar / /s:tparechazar §7- Acepta o rechaza solicitud de TPA.");
  reply(sender, "§e/s:rtp §7- Teletransporte aleatorio a una zona salvaje segura (10m cooldown).");
  reply(sender, "§a2. Dinero, Tienda y Progreso");
  reply(sender, "§e/s:dinero / /s:saldo §7- Consulta tu saldo de monedas.");
  reply(sender, "§e/s:pagar <jugador> <monto> §7- Transfiere dinero a otro jugador.");
  reply(sender, "§e/s:tienda §7- Tienda oficial con precios dinámicos flotantes anti-granjas AFK.");
  reply(sender, "§e/s:banco §7- Banco General, intereses de ahorro y préstamos.");
  reply(sender, "§e/s:recompensas §7- Racha de 30 días con premios acumulativos.");
  reply(sender, "§e/s:kitinicial §7- Kit de inicio de bienvenida (una sola vez).");
  reply(sender, "§e/s:trabajos §7- Gremio de oficios con pasivas (Treecapitator, auto-replant, doble mena).");
  reply(sender, "§e/s:misiones §7- Misiones personales y meta comunitaria con Booster Global.");
  reply(sender, "§e/s:rankup / /s:ascender §7- Asciende de rango de supervivencia (Recluta a Leyenda).");
  reply(sender, "§e/s:titulos §7- Tienda y gestor de títulos cosméticos.");
  reply(sender, "§e/s:cajas §7- Abre cajas de botín con llaves especiales (/s:crates).");
  reply(sender, "§a3. Comercio y Mercado");
  reply(sender, "§e/s:comerciar <jugador> §7- Intercambio directo seguro de ítems y dinero.");
  reply(sender, "§e/s:aceptartrato / /s:rechazartrato §7- Confirma trade con cuenta regresiva de 3s.");
  reply(sender, "§e/s:subastas §7- Casa de subastas global con anti-sniper (+60s).");
  reply(sender, "§e/s:vender <precio> §7- Publica el ítem de tu mano en subasta.");
  reply(sender, "§a4. Terrenos y Protecciones");
  reply(sender, "§e/s:pos1 / /s:pos2 §7- Marca las esquinas de tu terreno.");
  reply(sender, "§e/s:proteger <nombre> §7- Registra tu terreno ($2,000 + $4 por bloque).");
  reply(sender, "§e/s:desproteger §7- Elimina la protección de tu terreno.");
  reply(sender, "§e/s:zona bordes §7- Visualiza los límites de tu terreno con partículas de esmeralda.");
  reply(sender, "§e/s:zona banderas §7- Configura permisos (PvP, monstruos, explosiones, puertas).");
  reply(sender, "§e/s:zona confiar <jugador> §7- Otorga permisos en tu zona a un amigo.");
  reply(sender, "§e/s:zona desconfiar <jugador> §7- Revoca permisos a un amigo.");
  reply(sender, "§e/s:zonas §7- Gestor visual de todos tus terrenos.");
  reply(sender, "§a5. Clanes y Duelos");
  reply(sender, "§e/s:clan ayuda §7- Lista completa de comandos de clan.");
  reply(sender, "§e/s:clan crear <nombre> §7- Crea tu clan comunitario (fuego amigo bloqueado).");
  reply(sender, "§e/s:clan nivel / /s:clan mejorar §7- Mejora el nivel y capacidad de tu clan (Nivel 1-5).");
  reply(sender, "§e/s:c <mensaje> §7- Chat privado con los miembros de tu clan.");
  reply(sender, "§e/s:duelo <jugador> §7- Desafío PvP voluntario en coliseo con salas seguras.");
  reply(sender, "§e/s:dueloaceptar / /s:duelorechazar §7- Acepta o rechaza un duelo.");
  reply(sender, "§a6. Utilidades, Minijuegos y Seguridad");
  reply(sender, "§e/s:pvp [activar] §7- Inmunidad de 30m de novato: consulta o renuncia.");
  reply(sender, "§e/s:casino §7- Minijuegos: Cara o Cruz, Blackjack 21, Ruleta y Tragamonedas.");
  reply(sender, "§e/s:tumba / /s:tumbatp §7- Localiza y viaja a tu tumba activa.");
  reply(sender, "§e/s:camara §7- Alterna la cámara de espectador automática.");
  reply(sender, "§e/s:guias §7- Guías visuales interactivas.");
  reply(sender, "§e/s:reglas §7- Normas comunitarias del servidor.");
  if (isPlayerOp(sender)) {
    reply(sender, "§a7. Administración");
    reply(sender, "§e/s:fijaraparicion §7- Define el spawn principal del servidor.");
    reply(sender, "§e/s:vetar / /s:desvetar / /s:silenciar / /s:congelar §7- Moderación estricta.");
    reply(sender, "§e/s:limpiar §7- Limpia ítems del suelo y entidades.");
    reply(sender, "§e/s:iniciarhorda / /s:iniciarfiebre §7- Fuerza eventos automáticos.");
    reply(sender, "§e/s:fijarcaja / /s:borrarcaja / /s:darllave §7- Administra crates.");
    reply(sender, "§e/s:maquinatrabajo / /s:trabajosnpc §7- Estaciones de trabajo.");
    reply(sender, "§e/s:fijardestino / /s:borrardestino §7- Warps públicos.");
    reply(sender, "§e/s:adminproteger / /s:admineliminar / /s:admincoliseo §7- Zonas y coliseos.");
  }
  reply(sender, "§e=================================================");
}

function handleCommand(sender, rawMessage) {
  const message = String(rawMessage || "").trim().toLowerCase();

  if (message === "ping") {
    reply(sender, "§aPong");
    return commandOk("Pong");
  }

  if (message === "help" || message === "ayuda") {
    sendHelp(sender);
    return commandOk("Comandos enviados.");
  }

  return commandError("Comando no reconocido.");
}

function registerCustomCommands() {
  const startupSignal = system?.beforeEvents?.startup;
  if (!startupSignal || typeof startupSignal.subscribe !== "function") {
    console.warn("[Core Commands] startup event no disponible para custom commands.");
    return;
  }

  startupSignal.subscribe((event) => {
    const registry = event?.customCommandRegistry;
    if (!registry) {
      console.warn("[Core Commands] customCommandRegistry no disponible en startup.");
      return;
    }

    console.warn("[Core Commands] Intentando registrar comandos slash.");

    const register = typeof registry.registerCommand === "function"
      ? registry.registerCommand.bind(registry)
      : typeof registry.register === "function"
        ? registry.register.bind(registry)
        : undefined;

    if (!register) {
      console.warn("[Core Commands] El registry no expone registerCommand/register.");
      return;
    }

    try {
      register(
        {
          name: `${COMMAND_NAMESPACE}:menu`,
          description: "Abre el menú interactivo principal",
          permissionLevel: CommandPermissionLevel.Any,
        },
        (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Este comando solo puede usarse por jugador.");
          system.run(() => openMainMenu(sender));
          return commandOk("Abriendo menú principal.");
        }
      );
      console.warn(`[Core Commands] Registrado /${COMMAND_NAMESPACE}:menu`);
    } catch (e) {
      console.warn(`[Core Commands] Error registrando /${COMMAND_NAMESPACE}:menu: ` + e);
    }

    try {
      register(
        {
          name: `${COMMAND_NAMESPACE}:ping`,
          description: "Responde Pong",
          permissionLevel: CommandPermissionLevel.Any,
        },
        (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Este comando solo puede usarse por jugador.");
          return handleCommand(sender, "ping");
        }
      );
      console.warn(`[Core Commands] Registrado /${COMMAND_NAMESPACE}:ping`);
    } catch (e) {
      console.warn(`[Core Commands] Error registrando /${COMMAND_NAMESPACE}:ping: ` + e);
    }

    try {
      register(
        {
          name: `${COMMAND_NAMESPACE}:help`,
          description: "Muestra ayuda base",
          permissionLevel: CommandPermissionLevel.Any,
        },
        (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Este comando solo puede usarse por jugador.");
          return handleCommand(sender, "help");
        }
      );
      console.warn(`[Core Commands] Registrado /${COMMAND_NAMESPACE}:help`);
    } catch (e) {
      console.warn(`[Core Commands] Error registrando /${COMMAND_NAMESPACE}:help: ` + e);
    }

    try {
      register(
        {
          name: `${COMMAND_NAMESPACE}:ayuda`,
          description: "Muestra ayuda base",
          permissionLevel: CommandPermissionLevel.Any,
        },
        (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Este comando solo puede usarse por jugador.");
          return handleCommand(sender, "ayuda");
        }
      );
      console.warn(`[Core Commands] Registrado /${COMMAND_NAMESPACE}:ayuda`);
    } catch (e) {
      console.warn(`[Core Commands] Error registrando /${COMMAND_NAMESPACE}:ayuda: ` + e);
    }

    try {
      register(
        {
          name: `${COMMAND_NAMESPACE}:cmd`,
          description: "Puente para comandos internos",
          permissionLevel: CommandPermissionLevel.Any,
          mandatoryParameters: [
            {
              name: "texto",
              type: CustomCommandParamType.String,
            },
          ],
        },
        (origin, texto) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Este comando solo puede usarse por jugador.");
          return handleCommand(sender, String(texto || ""));
        }
      );
      console.warn(`[Core Commands] Registrado /${COMMAND_NAMESPACE}:cmd`);
    } catch (e) {
      console.warn(`[Core Commands] Error registrando /${COMMAND_NAMESPACE}:cmd: ` + e);
    }
  });
}

registerCustomCommands();

try {
  if (system?.afterEvents?.scriptEventReceive && typeof system.afterEvents.scriptEventReceive.subscribe === "function") {
    system.afterEvents.scriptEventReceive.subscribe((event) => {
      if (event.id !== "cmd") return;
      const sender = event.sourceEntity;
      if (!sender || sender.typeId !== "minecraft:player") return;

      const message = String(event.message || "").trim().toLowerCase();
      if (!message) return;

      console.warn("[Core Commands] scriptevent recibido: " + message);
      if (message === "menu" || message === "mainmenu") {
        system.run(() => openMainMenu(sender));
        return;
      }
      handleCommand(sender, message);
    });
  } else {
    console.warn("[Core Commands] scriptEventReceive no disponible.");
  }
} catch (e) {
  console.warn("[Core Commands] Error registrando scriptEventReceive: " + e);
}

// =========================================================================
// SISTEMA DE MENÚ VISUAL CON LA BRÚJULA
// =========================================================================

// Ejecuta comandos de forma segura en el jugador usando el método síncrono disponible en esta versión
function runCommandSafe(player, cmd) {
  const cleanedCmd = cmd.startsWith("/") ? cmd : "/" + cmd;
  try {
    player.runCommand(cleanedCmd);
  } catch (e) {
    try {
      player.runCommand(cmd);
    } catch (e2) {
      // Fallback secundario a través de la dimensión del overworld
      try {
        const cleanedCmd = cmd.startsWith("/") ? cmd : "/" + cmd;
        world.getDimension("overworld").runCommand(`execute as "${player.name}" run ${cleanedCmd}`);
      } catch (e3) {
        console.warn(`[Core UI] Fallaron todos los métodos para ejecutar comando "${cmd}": ${e3}`);
      }
    }
  }
}

// Auxiliar para abrir formularios de manera segura y gestionar la pantalla del jugador (UserBusy)
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
        system.run(() => { onCancel(response); });
      }
      return;
    }
    system.run(() => { onSelect(response); });
  }).catch((err) => {
    console.warn(`[Core UI] Error en safeOpenForm: ${err}`);
  });
}

function getOtherPlayers(player) {
  return world.getAllPlayers()
    .filter(p => p.id !== player.id)
    .map(p => p.name);
}

// Listado de todos los comandos para el buscador integrado
const ALL_COMMANDS = [
  { name: "/s:casa", desc: "Teletranspórtate a tu casa principal", cmd: "s:casa", cat: "Viajes" },
  { name: "/s:guardarcasa", desc: "Establece tu ubicación de casa actual", cmd: "s:guardarcasa", cat: "Viajes" },
  { name: "/s:aparicion", desc: "Ve a la zona de aparición global del servidor", cmd: "s:aparicion", cat: "Viajes" },
  { name: "/s:rtp", desc: "Teletransporte aleatorio a una zona segura", cmd: "s:rtp", cat: "Viajes" },
  { name: "/s:destinos", desc: "Abre el menú de destinos y puntos públicos", cmd: "s:destinos", cat: "Viajes" },
  { name: "/s:pedirtp <jugador>", desc: "Solicita teletransporte a un jugador", form: openTpaForm, cat: "Viajes" },
  { name: "/s:tpaaceptar", desc: "Acepta una solicitud de teletransporte", cmd: "s:tpaaceptar", cat: "Viajes" },
  { name: "/s:tparechazar", desc: "Rechaza una solicitud de teletransporte", cmd: "s:tparechazar", cat: "Viajes" },
  
  { name: "/s:dinero", desc: "Consulta tu saldo actual", cmd: "s:dinero", cat: "Economía" },
  { name: "/s:pagar <jugador>", desc: "Paga dinero a otro jugador", form: openPayForm, cat: "Economía" },
  { name: "/s:tienda", desc: "Abre la tienda oficial del servidor con precios flotantes", cmd: "s:tienda", cat: "Economía" },
  { name: "/s:banco", desc: "Accede al Banco General y tus ahorros", cmd: "s:banco", cat: "Economía" },
  { name: "/s:potenciadores", desc: "Consulta o activa mejoras globales del servidor", cmd: "s:potenciadores", cat: "Economía" },
  { name: "/s:recompensas", desc: "Racha de 30 días de recompensas de inicio de sesión", cmd: "s:recompensas", cat: "Economía" },
  { name: "/s:kitinicial", desc: "Reclama el kit inicial de bienvenida", cmd: "s:kitinicial", cat: "Economía" },
  { name: "/s:trabajos", desc: "Oficios con pasivas (Treecapitator, auto-replant, doble mena) y cuotas", cmd: "s:trabajos", cat: "Economía" },
  { name: "/s:misiones", desc: "Misiones personales y meta comunitaria con Booster Global", cmd: "s:misiones", cat: "Economía" },
  { name: "/s:expedicion", desc: "Consulta el Guardián y reclama recompensas", cmd: "s:expedicion", cat: "Eventos" },
  { name: "/s:titulos", desc: "Tienda y gestor de títulos cosméticos", cmd: "s:titulos", cat: "Economía" },
  { name: "/s:rankup", desc: "Asciende en el escalafón de supervivencia con tiempo y dinero", cmd: "s:rankup", cat: "Economía" },
  { name: "/s:casino", desc: "Minijuegos: Cara o Cruz, Blackjack 21, Ruleta y Slots", cmd: "s:casino", cat: "Economía" },
  { name: "/s:cajas", desc: "Abre cofres de botín con llaves especiales", cmd: "s:cajas", cat: "Economía" },
  
  { name: "/s:subastas", desc: "Casa de subastas de la comunidad con anti-sniper", cmd: "s:subastas", cat: "Comercio" },
  { name: "/s:vender <precio>", desc: "Sube el ítem en tu mano a subasta", form: openVenderForm, cat: "Comercio" },
  { name: "/s:comerciar <jugador>", desc: "Intercambio mixto cara a cara (ítems + dinero)", form: openTradeForm, cat: "Comercio" },
  { name: "/s:aceptartrato", desc: "Acepta intercambio con cuenta regresiva de 3s", cmd: "s:aceptartrato", cat: "Comercio" },
  { name: "/s:rechazartrato", desc: "Rechaza solicitud de intercambio", cmd: "s:rechazartrato", cat: "Comercio" },
  
  { name: "/s:zonas", desc: "Gestor visual de tus terrenos protegidos", cmd: "s:zonas", cat: "Protecciones" },
  { name: "/s:proteger <nombre>", desc: "Crea una nueva zona protegida", form: openProtegerForm, cat: "Protecciones" },
  { name: "/s:desproteger", desc: "Elimina la protección del terreno actual", cmd: "s:desproteger", cat: "Protecciones" },
  { name: "/s:zona bordes", desc: "Muestra/oculta los límites de tu terreno con partículas esmeralda", cmd: "s:zona bordes", cat: "Protecciones" },
  { name: "/s:zona banderas", desc: "Configura permisos de PvP, monstruos, explosiones y puertas", cmd: "s:zona banderas", cat: "Protecciones" },
  { name: "/s:zona confiar <jugador>", desc: "Añade a un amigo a tu terreno", form: (p) => openTrustForm(p, true), cat: "Protecciones" },
  { name: "/s:zona desconfiar <jugador>", desc: "Quita el acceso de un amigo a tu terreno", form: (p) => openTrustForm(p, false), cat: "Protecciones" },
  { name: "/s:pos1", desc: "Marca la primera esquina del terreno", cmd: "s:pos1", cat: "Protecciones" },
  { name: "/s:pos2", desc: "Marca la segunda esquina del terreno", cmd: "s:pos2", cat: "Protecciones" },
  
  { name: "/s:clan ayuda", desc: "Comandos de gestión de clan", cmd: "s:clan ayuda", cat: "Clanes" },
  { name: "/s:clan crear <nombre>", desc: "Crea un clan comunitario gratuito", form: (p) => runCommandSafe(p, "s:clan ayuda"), cat: "Clanes" },
  { name: "/s:clan nivel", desc: "Consulta el nivel y ventajas de tu clan", cmd: "s:clan nivel", cat: "Clanes" },
  { name: "/s:clan mejorar", desc: "Mejora el nivel y capacidad de miembros de tu clan", cmd: "s:clan mejorar", cat: "Clanes" },
  { name: "/s:c <mensaje>", desc: "Chat privado con los miembros de tu clan", form: openClanChatForm, cat: "Clanes" },
  { name: "/s:duelo <jugador>", desc: "Desafía a un duelo formal en el coliseo", form: openDuelForm, cat: "Clanes" },
  { name: "/s:dueloaceptar", desc: "Acepta un duelo en el coliseo", cmd: "s:dueloaceptar", cat: "Clanes" },
  { name: "/s:duelorechazar", desc: "Rechaza un duelo en el coliseo", cmd: "s:duelorechazar", cat: "Clanes" },
  
  { name: "/s:pvp", desc: "Consulta tu tiempo de inmunidad novato o actívalo", cmd: "s:pvp", cat: "Utilidades" },
  { name: "/s:tumba", desc: "Muestra coordenadas de tu última muerte", cmd: "s:tumba", cat: "Utilidades" },
  { name: "/s:tumbatp", desc: "Teletranspórtate a tu tumba activa", cmd: "s:tumbatp", cat: "Utilidades" },
  { name: "/s:camara", desc: "Activa o desactiva la cámara automática", cmd: "s:camara", cat: "Utilidades" },
  { name: "/s:reglas", desc: "Muestra las normas de convivencia", cmd: "s:reglas", cat: "Utilidades" },
  { name: "/s:guias", desc: "Guías visuales del servidor", cmd: "s:guias", cat: "Utilidades" },
  { name: "/s:tebex", desc: "Genera tu código de la tienda web", cmd: "s:tebex", cat: "Utilidades" }
];

function openSearchForm(player) {
  const form = new ModalFormData()
    .title("§e🔍 BUSCAR COMANDO §r")
    .textField("Escribe una palabra clave (ej: home, dinero, pvp):", "Ej: home");

  safeOpenForm(player, form, (response) => {
    const query = String(response.formValues[0] || "").trim().toLowerCase();
    if (!query) return;

    const matches = ALL_COMMANDS.filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.desc.toLowerCase().includes(query) || 
      c.cat.toLowerCase().includes(query)
    );

    if (matches.length === 0) {
      reply(player, `§cNo se encontraron comandos para la búsqueda: "${query}".`);
      return;
    }

    showSearchResults(player, query, matches);
  }, undefined);
}

function showSearchResults(player, query, matches) {
  const form = new ActionFormData()
    .title("§e🔍 RESULTADOS §r")
    .body(`§7Comandos que coinciden con "§f${query}§7":\n§8Selecciona uno para ejecutarlo.`);

  for (const match of matches) {
    form.button(`${match.name}\n§8${match.desc} [${match.cat}]`);
  }
  form.button("❌ §8Cerrar");

  safeOpenForm(player, form, (response) => {
    const idx = response.selection;
    if (idx === undefined || idx === matches.length) return;

    const selected = matches[idx];
    if (selected) {
      if (selected.cmd) {
        runCommandSafe(player, selected.cmd);
      } else if (selected.form) {
        selected.form(player);
      }
    }
  }, undefined);
}

// 🧭 MENÚ PRINCIPAL
function openMainMenu(player) {
  const isOp = isPlayerOp(player);
  const form = new ActionFormData()
    .title("§e🧭 MENÚ PRINCIPAL §r")
    .body("§7Selecciona un servicio de la comunidad:")
    .button("🚀 Movimiento y Viajes\n§8/s:casa, /s:aparicion, /s:rtp...")
    .button("💰 Dinero y Economía\n§8/s:dinero, tienda, trabajos...")
    .button("🤝 Comercio y Subastas\n§8/s:subastas, /s:comerciar...")
    .button("🛡️ Terrenos y Protecciones\n§8/s:proteger, /s:zonas...")
    .button("⚔️ Clanes y Coliseo\n§8/s:clan, duelos...")
    .button("⚙️ Utilidades y Reglas\n§8/s:tumba, reglas, guías...")
    .button("🔍 Buscar Comandos\n§8Buscador integrado");

  if (isOp) {
    form.button("👑 Panel de Administración\n§8Herramientas OP");
  }
  form.button("❌ Cerrar");

  safeOpenForm(player, form, (response) => {
    const idx = response.selection;
    if (idx === undefined) return;
    if (idx === 0) openTravelMenu(player);
    else if (idx === 1) openMoneyMenu(player);
    else if (idx === 2) openTradeMenu(player);
    else if (idx === 3) openClaimMenu(player);
    else if (idx === 4) openClansMenu(player);
    else if (idx === 5) openUtilsMenu(player);
    else if (idx === 6) openSearchForm(player);
    else if (isOp && idx === 7) openAdminMenu(player);
  }, undefined);
}

// 🚀 1. MOVIMIENTO Y VIAJE
function openTravelMenu(player) {
  const form = new ActionFormData()
    .title("§e🚀 MOVIMIENTO Y VIAJE 🚀")
    .body("§7Teletranspórtate por el mapa de manera segura.")
    .button("🏠 §9Ir a mi casa (/s:casa)")
    .button("📍 §9Guardar mi ubicación (/s:guardarcasa)")
    .button("🌍 §9Ir a la Aparición (/s:aparicion)")
    .button("🎲 §9Teletransporte aleatorio (/s:rtp)")
    .button("🚩 §9Destinos públicos (/s:destinos)")
    .button("👥 §9Pedir TPA a Jugador")
    .button("✅ §2Aceptar TPA (/s:tpaaceptar)")
    .button("❌ §cRechazar TPA (/s:tparechazar)")
    .button("❌ §8Cerrar Menú");

  safeOpenForm(player, form, (response) => {
    const idx = response.selection;
    if (idx === 0) runCommandSafe(player, "s:casa");
    else if (idx === 1) runCommandSafe(player, "s:guardarcasa");
    else if (idx === 2) runCommandSafe(player, "s:aparicion");
    else if (idx === 3) runCommandSafe(player, "s:rtp");
    else if (idx === 4) runCommandSafe(player, "s:destinos");
    else if (idx === 5) openTpaForm(player);
    else if (idx === 6) runCommandSafe(player, "s:tpaaceptar");
    else if (idx === 7) runCommandSafe(player, "s:tparechazar");
  }, undefined);
}

function openTpaForm(player) {
  const players = getOtherPlayers(player);
  if (players.length === 0) {
    reply(player, "§cNo hay otros jugadores en línea.");
    return;
  }
  
  const form = new ModalFormData()
    .title("§👥 SOLICITAR TELETRANSPORTE (TPA)")
    .dropdown("Selecciona al jugador destino:", players);

  safeOpenForm(player, form, (response) => {
    const selectedPlayer = players[response.formValues[0]];
    runCommandSafe(player, `s:tpa "${selectedPlayer}"`);
  }, undefined);
}

// 💰 2. DINERO Y PROGRESO
function openMoneyMenu(player) {
  const form = new ActionFormData()
    .title("§e💰 DINERO Y PROGRESO 💰")
    .body("§7Controla tus finanzas y revisa tus incentivos.")
    .button("💵 §aVer mi saldo (/s:dinero)")
    .button("💸 §aEnviar Dinero a Jugador")
    .button("🏦 §aBanco General (/s:vetarco)")
    .button("⚡ §aPotenciadores y Mejoras (/s:potenciadores)")
    .button("🏪 §aTienda del Servidor (/s:tienda)")
    .button("🎁 §aReclamar Recompensas (/s:recompensas)")
    .button("🎒 §aKit de Inicio (/s:kitinicial)")
    .button("💼 §aTrabajos y Empleos (/s:trabajos)")
    .button("📜 §aMisiones (/s:misiones)")
    .button("🏷️ §aTítulos Cosméticos (/s:titulos)")
    .button("⭐ §6Ascenso de Rango (/s:rankup)")
    .button("🎰 §cCasino / Apuestas (/s:casino)")
    .button("❌ §8Cerrar Menú");

  safeOpenForm(player, form, (response) => {
    const idx = response.selection;
    if (idx === 0) runCommandSafe(player, "s:dinero");
    else if (idx === 1) openPayForm(player);
    else if (idx === 2) runCommandSafe(player, "s:banco");
    else if (idx === 3) runCommandSafe(player, "s:potenciadores");
    else if (idx === 4) runCommandSafe(player, "s:tienda");
    else if (idx === 5) runCommandSafe(player, "s:recompensas");
    else if (idx === 6) runCommandSafe(player, "s:kitinicial");
    else if (idx === 7) runCommandSafe(player, "s:trabajos");
    else if (idx === 8) runCommandSafe(player, "s:misiones");
    else if (idx === 9) runCommandSafe(player, "s:titulos");
    else if (idx === 10) runCommandSafe(player, "s:rankup");
    else if (idx === 11) runCommandSafe(player, "s:casino");
  }, undefined);
}

function openPayForm(player) {
  const players = getOtherPlayers(player);
  if (players.length === 0) {
    reply(player, "§cNo hay otros jugadores en línea para pagar.");
    return;
  }
  
  const form = new ModalFormData()
    .title("§💸 ENVIAR DINERO §a(PAY)")
    .dropdown("Jugador receptor:", players)
    .textField("Monto a enviar:", "Ej: 500");

  safeOpenForm(player, form, (response) => {
    const selectedPlayer = players[response.formValues[0]];
    const amountStr = response.formValues[1];
    const amount = parseInt(amountStr);
    if (isNaN(amount) || amount <= 0) {
      reply(player, "§cMonto inválido.");
      return;
    }
    runCommandSafe(player, `s:pay "${selectedPlayer}" ${amount}`);
  }, undefined);
}

// 🤝 3. COMERCIO Y MERCADO
function openTradeMenu(player) {
  const form = new ActionFormData()
    .title("§e🤝 COMERCIO Y MERCADO 🤝")
    .body("§7Interactúa con la economía del servidor.")
    .button("⚖️ §3Casa de Subastas (/s:subastas)")
    .button("💰 §3Vender objeto de la mano")
    .button("🤝 §3Iniciar Intercambio Directo")
    .button("✅ §2Aceptar Intercambio (/s:aceptartrato)")
    .button("❌ §cRechazar Intercambio (/s:rechazartrato)")
    .button("❌ §8Cerrar Menú");

  safeOpenForm(player, form, (response) => {
    const idx = response.selection;
    if (idx === 0) runCommandSafe(player, "s:subastas");
    else if (idx === 1) openVenderForm(player);
    else if (idx === 2) openTradeForm(player);
    else if (idx === 3) runCommandSafe(player, "s:aceptartrato");
    else if (idx === 4) runCommandSafe(player, "s:rechazartrato");
  }, undefined);
}

function openVenderForm(player) {
  const form = new ModalFormData()
    .title("§💰 VENDER EN LA SUBASTA")
    .textField("Ingresa el precio de venta:", "Ej: 1000");

  safeOpenForm(player, form, (response) => {
    const priceStr = response.formValues[0];
    const price = parseInt(priceStr);
    if (isNaN(price) || price <= 0) {
      reply(player, "§cPrecio inválido.");
      return;
    }
    runCommandSafe(player, `s:vender ${price}`);
  }, undefined);
}

function openTradeForm(player) {
  const players = getOtherPlayers(player);
  if (players.length === 0) {
    reply(player, "§cNo hay otros jugadores en línea.");
    return;
  }

  const form = new ModalFormData()
    .title("§🤝 INICIAR INTERCAMBIO SEGURO")
    .dropdown("Selecciona al jugador:", players);

  safeOpenForm(player, form, (response) => {
    const selectedPlayer = players[response.formValues[0]];
    runCommandSafe(player, `s:trade "${selectedPlayer}"`);
  }, undefined);
}

// 🛡️ 4. TERRENOS Y PROTECCIONES
function openClaimMenu(player) {
  const form = new ActionFormData()
    .title("§e🛡️ TERRENOS Y PROTECCIONES 🛡️")
    .body("§7Administra tus terrenos para evitar grifeos.")
    .button("🗺️ §2Ver mis terrenos protegidos (/s:zonas)")
    .button("🛡️ §2Proteger nueva zona marcada")
    .button("🔓 §2Remover protección del terreno (/s:desproteger)")
    .button("➕ §2Dar acceso (Trust) a jugador")
    .button("➖ §2Quitar acceso (Untrust) a jugador")
    .button("🚩 §2Marcar Esquina 1 (/s:pos1)")
    .button("🚩 §2Marcar Esquina 2 (/s:pos2)")
    .button("❌ §8Cerrar Menú");

  safeOpenForm(player, form, (response) => {
    const idx = response.selection;
    if (idx === 0) runCommandSafe(player, "s:zonas");
    else if (idx === 1) openProtegerForm(player);
    else if (idx === 2) runCommandSafe(player, "s:desproteger");
    else if (idx === 3) openTrustForm(player, true);
    else if (idx === 4) openTrustForm(player, false);
    else if (idx === 5) runCommandSafe(player, "s:pos1");
    else if (idx === 6) runCommandSafe(player, "s:pos2");
  }, undefined);
}

function openProtegerForm(player) {
  const form = new ModalFormData()
    .title("§🛡️ NUEVA PROTECCIÓN")
    .textField("Ingresa el nombre de la zona:", "Ej: MiCasa");

  safeOpenForm(player, form, (response) => {
    const zoneName = String(response.formValues[0] || "").trim();
    if (!zoneName) {
      reply(player, "§cNombre inválido.");
      return;
    }
    runCommandSafe(player, `s:proteger "${zoneName}"`);
  }, undefined);
}

function openTrustForm(player, isTrust) {
  const players = getOtherPlayers(player);
  if (players.length === 0) {
    reply(player, "§cNo hay otros jugadores en línea.");
    return;
  }

  const action = isTrust ? "trust" : "untrust";
  const titleText = isTrust ? "§➕ DAR ACCESO (TRUST)" : "§➖ REMOVER ACCESO (UNTRUST)";
  
  const form = new ModalFormData()
    .title(titleText)
    .dropdown("Selecciona al jugador:", players);

  safeOpenForm(player, form, (response) => {
    const selectedPlayer = players[response.formValues[0]];
    runCommandSafe(player, `s:zona ${action} "${selectedPlayer}"`);
  }, undefined);
}

// ⚔️ 5. CLANES Y DUELOS
function openClansMenu(player) {
  const form = new ActionFormData()
    .title("§e⚔️ CLANES Y PVP ⚔️")
    .body("§7Únete a tus amigos o desafía a otros de forma segura.")
    .button("🛡️ §6Comandos del Clan (/s:clan help)")
    .button("💬 §6Chat Privado del Clan (/s:c)")
    .button("⚔️ §6Solicitar Duelo en Coliseo")
    .button("✅ §2Aceptar Duelo (/s:dueloaceptar)")
    .button("❌ §cRechazar Duelo (/s:duelorechazar)")
    .button("❌ §8Cerrar Menú");

  safeOpenForm(player, form, (response) => {
    const idx = response.selection;
    if (idx === 0) runCommandSafe(player, "s:clan help");
    else if (idx === 1) openClanChatForm(player);
    else if (idx === 2) openDuelForm(player);
    else if (idx === 3) runCommandSafe(player, "s:dueloaceptar");
    else if (idx === 4) runCommandSafe(player, "s:duelorechazar");
  }, undefined);
}

function openClanChatForm(player) {
  const form = new ModalFormData()
    .title("§💬 CHAT DEL CLAN")
    .textField("Escribe el mensaje para tu clan:", "Ej: Hola clan");

  safeOpenForm(player, form, (response) => {
    const msg = response.formValues[0];
    if (msg) {
      runCommandSafe(player, `s:c ${msg}`);
    }
  }, undefined);
}

function openDuelForm(player) {
  const players = getOtherPlayers(player);
  if (players.length === 0) {
    reply(player, "§cNo hay otros jugadores en línea.");
    return;
  }

  const form = new ModalFormData()
    .title("§⚔️ DESAFIAR A DUELO PVP")
    .dropdown("Elige a tu oponente:", players);

  safeOpenForm(player, form, (response) => {
    const selectedPlayer = players[response.formValues[0]];
    runCommandSafe(player, `s:coliseopvp "${selectedPlayer}"`);
  }, undefined);
}

// ⚙️ 6. UTILIDADES Y REGLAS
function openUtilsMenu(player) {
  const form = new ActionFormData()
    .title("§e⚙️ UTILIDADES Y REGLAS ⚙️")
    .body("§7Información e interfaces útiles.")
    .button("💀 §eUbicación de tumba (/s:tumba)")
    .button("🎥 §eCámara automática (/s:camara)")
    .button("📖 §eReglas del Servidor (/s:reglas)")
    .button("🗺️ §eGuías del Servidor (/s:guias)")
    .button("🎟️ §eTienda Web / Tebex (/s:tebex)")
    .button("❌ §8Cerrar Menú");

  safeOpenForm(player, form, (response) => {
    const idx = response.selection;
    if (idx === 0) runCommandSafe(player, "s:tumba");
    else if (idx === 1) runCommandSafe(player, "s:camara");
    else if (idx === 2) runCommandSafe(player, "s:reglas");
    else if (idx === 3) runCommandSafe(player, "s:guias");
    else if (idx === 4) runCommandSafe(player, "s:tebex");
  }, undefined);
}

// 👑 7. ADMINISTRACIÓN
function openAdminMenu(player) {
  if (!isPlayerOp(player)) {
    reply(player, "§cSolo los operadores tienen acceso al panel de administración.");
    return;
  }
  const form = new ActionFormData()
    .title("§e👑 PANEL DE ADMINISTRACIÓN 👑")
    .body("§7Herramientas rápidas para administradores.")
    .button("🧹 §dLimpiar Suelo (/s:limpiar)")
    .button("👾 §dRemover NPCs en radio 15 (/s:removernpcs)")
    .button("🔥 §dForzar evento de Horda (/s:iniciarhorda)")
    .button("🌾 §dForzar evento de Fiebre (/s:iniciarfiebre)")
    .button("⚔️ §dAdministrar Expedición (/s:adminexpedicion)")
    .button("🚪 §dModeración: Sancionar Jugador (Ban)")
    .button("🔎 §dAuditar Bloque (BlockAudit)")
    .button("📜 §dHistorial de Bloques (BlockHistory)")
    .button("❌ §8Cerrar Menú");

  safeOpenForm(player, form, (response) => {
    const idx = response.selection;
    if (idx === 0) runCommandSafe(player, "s:limpiar");
    else if (idx === 1) runCommandSafe(player, "s:removernpcs 15");
    else if (idx === 2) runCommandSafe(player, "s:iniciarhorda");
    else if (idx === 3) runCommandSafe(player, "s:iniciarfiebre");
    else if (idx === 4) runCommandSafe(player, "s:adminexpedicion");
    else if (idx === 5) openAdminBanForm(player);
    else if (idx === 6) openBlockAuditForm(player);
    else if (idx === 7) openBlockHistoryForm(player);
  }, undefined);
}

function openBlockAuditForm(player) {
  const form = new ModalFormData()
    .title("§🔎 AUDITAR BLOQUE")
    .textField("Coordenada X:", "Ej: 100")
    .textField("Coordenada Y:", "Ej: 64")
    .textField("Coordenada Z:", "Ej: -200");

  safeOpenForm(player, form, (response) => {
    const x = parseInt(response.formValues[0]);
    const y = parseInt(response.formValues[1]);
    const z = parseInt(response.formValues[2]);
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      reply(player, "§cCoordenadas inválidas.");
      openAdminMenu(player);
      return;
    }
    runCommandSafe(player, `s:blockaudit ${x} ${y} ${z}`);
  }, () => openAdminMenu(player));
}

function openBlockHistoryForm(player) {
  const form = new ModalFormData()
    .title("§📜 HISTORIAL DE BLOQUES")
    .textField("Nombre del jugador:", "Ej: Steve");

  safeOpenForm(player, form, (response) => {
    const target = response.formValues[0];
    if (!target) {
      reply(player, "§cNombre de jugador inválido.");
      openAdminMenu(player);
      return;
    }
    runCommandSafe(player, `s:blockhistory "${target}"`);
  }, () => openAdminMenu(player));
}

function openAdminBanForm(player) {
  const players = getOtherPlayers(player);
  if (players.length === 0) {
    reply(player, "§cNo hay otros jugadores en línea.");
    openAdminMenu(player);
    return;
  }

  const form = new ModalFormData()
    .title("§dMODERACIÓN: TEMPBAN")
    .dropdown("Selecciona al jugador:", players)
    .textField("Duración (ej: 30m, 2h, 3d):", "1h")
    .textField("Razón:", "Incumplimiento de normas");

  safeOpenForm(player, form, (response) => {
    const target = players[response.formValues[0]];
    const duration = response.formValues[1] || "1h";
    const reason = response.formValues[2] || "Incumplimiento de normas";
    runCommandSafe(player, `s:ban "${target}" "${duration}" "${reason}"`);
  }, () => openAdminMenu(player));
}

// Fin del archivo core_commands_addon
