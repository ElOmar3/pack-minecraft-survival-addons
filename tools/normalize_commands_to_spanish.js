const fs = require('fs');
const path = require('path');

// 1. PROTECTION ADDON
const protPath = 'behavior_packs/protection_addon/scripts/main.js';
let protContent = fs.readFileSync(protPath, 'utf8');

// Replace coliseopvp registration
protContent = protContent.replace(
  /register\(\{\s*name:\s*`\$\{COMMAND_NAMESPACE\}:coliseopvp`[\s\S]*?for\s*\(\s*const\s+name\s+of\s+\["coliseoaccept",\s*"coliseodeny"\]\)\s*\{[\s\S]*?return\s+commandOk\(`Procesando \$\{name\}\.`\);\s*\}\);/m,
  `for (const name of ["coliseopvp", "duelo"]) {
        register({
          name: \`\${COMMAND_NAMESPACE}:\${name}\`,
          description: "Solicita un duelo formal en el coliseo",
          permissionLevel: CommandPermissionLevel.Any,
          mandatoryParameters: [{ name: "jugador", type: CustomCommandParamType.String }],
          optionalParameters: [{ name: "coliseo", type: CustomCommandParamType.String }],
        }, (origin, jugador, coliseo) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          system.run(() => handleColiseumRequest(sender, String(jugador), coliseo === undefined ? "" : String(coliseo)));
          return commandOk(\`Procesando \${name}.\`);
        });
      }

      for (const name of ["coliseoaccept", "dueloaceptar", "aceptarduelo", "coliseoaceptar"]) {
        register({
          name: \`\${COMMAND_NAMESPACE}:\${name}\`,
          description: "Acepta un duelo de coliseo",
          permissionLevel: CommandPermissionLevel.Any,
        }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          system.run(() => handleColiseumAccept(sender));
          return commandOk(\`Procesando \${name}.\`);
        });
      }

      for (const name of ["coliseodeny", "duelorechazar", "rechazarduelo", "coliseorechazar"]) {
        register({
          name: \`\${COMMAND_NAMESPACE}:\${name}\`,
          description: "Rechaza un duelo de coliseo",
          permissionLevel: CommandPermissionLevel.Any,
        }, (origin) => {
          const sender = origin?.sourceEntity;
          if (!sender) return commandError("Solo para jugadores.");
          system.run(() => handleColiseumDeny(sender));
          return commandOk(\`Procesando \${name}.\`);
        });
      }`
);

// Replace handleTrustCommand
protContent = protContent.replace(
  /function\s+handleTrustCommand\(player,\s*sub,\s*targetName\)\s*\{[\s\S]*?if\s*\(!sub\s*\|\|\s*\(sub\s*!==\s*"trust"\s*&&\s*sub\s*!==\s*"untrust"\)\s*\|\|\s*!targetName\)\s*\{[\s\S]*?player\.sendMessage\("§b§l\[§3Protección§b§l\]§r §cUso: \/s:zona trust <jugador> o \/s:zona untrust <jugador>"\);[\s\S]*?return;\s*\}/m,
  `function handleTrustCommand(player, sub, targetName) {
  let action = String(sub || "").toLowerCase();
  if (action === "confiar" || action === "invitar" || action === "amigo" || action === "agregar") action = "trust";
  if (action === "desconfiar" || action === "revocar" || action === "quitar" || action === "expulsar") action = "untrust";

  if (!action || (action !== "trust" && action !== "untrust") || !targetName) {
    player.sendMessage("§b§l[§3Protección§b§l]§r §cUso: /s:zona confiar <jugador> o /s:zona desconfiar <jugador>");
    return;
  }`
);

// Replace coliseum invite text
protContent = protContent.replace(
  /\/s:coliseoaccept §7o §c\/s:coliseodeny/g,
  '/s:dueloaceptar §7(o /s:coliseoaccept) §7o §c/s:duelorechazar'
);

fs.writeFileSync(protPath, protContent, 'utf8');
console.log('✓ Updated protection_addon');

// 2. CLANS ADDON
const clansPath = 'behavior_packs/clans_addon/scripts/main.js';
let clansContent = fs.readFileSync(clansPath, 'utf8');

// Support /s:clan ayuda
clansContent = clansContent.replace(
  /if\s*\(\s*sub\s*===\s*"help"\s*\)\s*\{/g,
  'if (sub === "help" || sub === "ayuda") {'
);
clansContent = clansContent.replace(
  /\/s:clan help/g,
  '/s:clan ayuda'
);

fs.writeFileSync(clansPath, clansContent, 'utf8');
console.log('✓ Updated clans_addon');

// 3. CORE COMMANDS ADDON
const corePath = 'behavior_packs/core_commands_addon/scripts/main.js';
let coreContent = fs.readFileSync(corePath, 'utf8');

// Update ALL_COMMANDS in core_commands_addon
const spanishCommands = `const ALL_COMMANDS = [
  { name: "/s:casa", desc: "Teletranspórtate a tu casa principal", cmd: "s:casa", cat: "Viajes" },
  { name: "/s:guardarcasa", desc: "Establece tu ubicación de casa actual", cmd: "s:guardarcasa", cat: "Viajes" },
  { name: "/s:aparicion", desc: "Ve a la zona de aparición global del servidor", cmd: "s:aparicion", cat: "Viajes" },
  { name: "/s:rtp", desc: "Teletransporte aleatorio a una zona segura", cmd: "s:rtp", cat: "Viajes" },
  { name: "/s:destinos", desc: "Abre el menú de destinos y puntos públicos", cmd: "s:destinos", cat: "Viajes" },
  { name: "/s:tpa <jugador>", desc: "Solicita teletransporte a un jugador", form: openTpaForm, cat: "Viajes" },
  { name: "/s:tpaaceptar", desc: "Acepta una solicitud de teletransporte", cmd: "s:tpaaceptar", cat: "Viajes" },
  { name: "/s:tparechazar", desc: "Rechaza una solicitud de teletransporte", cmd: "s:tparechazar", cat: "Viajes" },
  
  { name: "/s:dinero", desc: "Consulta tu saldo actual", cmd: "s:dinero", cat: "Economía" },
  { name: "/s:pagar <jugador>", desc: "Paga dinero a otro jugador", form: openPayForm, cat: "Economía" },
  { name: "/s:tienda", desc: "Abre la tienda oficial del servidor", cmd: "s:tienda", cat: "Economía" },
  { name: "/s:banco", desc: "Accede al Banco General y tus ahorros", cmd: "s:banco", cat: "Economía" },
  { name: "/s:potenciadores", desc: "Consulta o activa mejoras globales del servidor", cmd: "s:potenciadores", cat: "Economía" },
  { name: "/s:recompensas", desc: "Reclama recompensas diarias y periódicas", cmd: "s:recompensas", cat: "Economía" },
  { name: "/s:kitinicial", desc: "Reclama el kit inicial de bienvenida", cmd: "s:kitinicial", cat: "Economía" },
  { name: "/s:trabajos", desc: "Abre el gremio de empleos y pedidos", cmd: "s:trabajos", cat: "Economía" },
  { name: "/s:misiones", desc: "Abre el panel de misiones secundarias", cmd: "s:misiones", cat: "Economía" },
  { name: "/s:expedicion", desc: "Consulta el Guardián y reclama recompensas", cmd: "s:expedicion", cat: "Eventos" },
  { name: "/s:adminexpedicion", desc: "OP: configura e inicia el Guardián", cmd: "s:adminexpedicion", cat: "Administración" },
  { name: "/s:titulos", desc: "Tienda y gestor de títulos cosméticos", cmd: "s:titulos", cat: "Economía" },
  { name: "/s:casino", desc: "Zona de juegos, apuestas y entretenimiento", cmd: "s:casino", cat: "Economía" },
  
  { name: "/s:subastas", desc: "Abre la casa de subastas de la comunidad", cmd: "s:subastas", cat: "Comercio" },
  { name: "/s:vender <precio>", desc: "Sube el ítem en tu mano a subasta", form: openVenderForm, cat: "Comercio" },
  { name: "/s:comerciar <jugador>", desc: "Solicita un intercambio directo seguro", form: openTradeForm, cat: "Comercio" },
  { name: "/s:aceptartrato", desc: "Acepta solicitud de intercambio", cmd: "s:aceptartrato", cat: "Comercio" },
  { name: "/s:rechazartrato", desc: "Rechaza solicitud de intercambio", cmd: "s:rechazartrato", cat: "Comercio" },
  
  { name: "/s:zonas", desc: "Gestor visual de tus terrenos protegidos", cmd: "s:zonas", cat: "Protecciones" },
  { name: "/s:proteger <nombre>", desc: "Crea una nueva zona protegida", form: openProtegerForm, cat: "Protecciones" },
  { name: "/s:desproteger", desc: "Elimina la protección del terreno actual", cmd: "s:desproteger", cat: "Protecciones" },
  { name: "/s:zona confiar <jugador>", desc: "Añade a un amigo a tu terreno", form: (p) => openTrustForm(p, true), cat: "Protecciones" },
  { name: "/s:zona desconfiar <jugador>", desc: "Quita el acceso de un amigo a tu terreno", form: (p) => openTrustForm(p, false), cat: "Protecciones" },
  { name: "/s:pos1", desc: "Marca la primera esquina del terreno", cmd: "s:pos1", cat: "Protecciones" },
  { name: "/s:pos2", desc: "Marca la segunda esquina del terreno", cmd: "s:pos2", cat: "Protecciones" },
  
  { name: "/s:clan ayuda", desc: "Comandos de gestión de clan", cmd: "s:clan ayuda", cat: "Clanes" },
  { name: "/s:c <mensaje>", desc: "Chat privado con los miembros de tu clan", form: openClanChatForm, cat: "Clanes" },
  { name: "/s:duelo <jugador>", desc: "Desafía a un duelo formal en el coliseo", form: openDuelForm, cat: "Clanes" },
  { name: "/s:dueloaceptar", desc: "Acepta un duelo en el coliseo", cmd: "s:dueloaceptar", cat: "Clanes" },
  { name: "/s:duelorechazar", desc: "Rechaza un duelo en el coliseo", cmd: "s:duelorechazar", cat: "Clanes" },
  
  { name: "/s:tumba", desc: "Muestra coordenadas de tu última muerte", cmd: "s:tumba", cat: "Utilidades" },
  { name: "/s:tumbatp", desc: "Teletranspórtate a tu tumba activa", cmd: "s:tumbatp", cat: "Utilidades" },
  { name: "/s:camara", desc: "Activa o desactiva la cámara automática", cmd: "s:camara", cat: "Utilidades" },
  { name: "/s:reglas", desc: "Muestra las normas de convivencia", cmd: "s:reglas", cat: "Utilidades" },
  { name: "/s:guias", desc: "Guías visuales del servidor", cmd: "s:guias", cat: "Utilidades" },
  { name: "/s:tebex", desc: "Genera tu código de la tienda web", cmd: "s:tebex", cat: "Utilidades" }
];`;

coreContent = coreContent.replace(/const\s+ALL_COMMANDS\s*=\s*\[[\s\S]*?\];/m, spanishCommands);

// Update /s:ayuda guide in core_commands_addon
coreContent = coreContent.replace(/\/s:sethome§7/g, '/s:guardarcasa§7');
coreContent = coreContent.replace(/\/s:home§7/g, '/s:casa§7');
coreContent = coreContent.replace(/\/s:spawn§7/g, '/s:aparicion§7');
coreContent = coreContent.replace(/\/s:setspawn§7/g, '/s:fijaraparicion§7');
coreContent = coreContent.replace(/\/s:tpaccept§7/g, '/s:tpaaceptar§7');
coreContent = coreContent.replace(/\/s:tpdeny§7/g, '/s:tparechazar§7');
coreContent = coreContent.replace(/\/s:warps§7/g, '/s:destinos§7');
coreContent = coreContent.replace(/\/s:pay\s+/g, '/s:pagar ');
coreContent = coreContent.replace(/\/s:trade\s+/g, '/s:comerciar ');
coreContent = coreContent.replace(/\/s:tradeaccept§7/g, '/s:aceptartrato§7');
coreContent = coreContent.replace(/\/s:tradedeny§7/g, '/s:rechazartrato§7');
coreContent = coreContent.replace(/\/s:zona trust/g, '/s:zona confiar');
coreContent = coreContent.replace(/\/s:zona untrust/g, '/s:zona desconfiar');
coreContent = coreContent.replace(/\/s:coliseoaccept/g, '/s:dueloaceptar');
coreContent = coreContent.replace(/\/s:coliseodeny/g, '/s:duelorechazar');
coreContent = coreContent.replace(/\/s:hordastart/g, '/s:iniciarhorda');
coreContent = coreContent.replace(/\/s:fiebrestart/g, '/s:iniciarfiebre');
coreContent = coreContent.replace(/\/s:setcrate/g, '/s:fijarcaja');
coreContent = coreContent.replace(/\/s:delcrate/g, '/s:borrarcaja');
coreContent = coreContent.replace(/\/s:givekey/g, '/s:darllave');
coreContent = coreContent.replace(/\/s:setwarp/g, '/s:fijardestino');
coreContent = coreContent.replace(/\/s:delwarp/g, '/s:borrardestino');
coreContent = coreContent.replace(/\/s:ban/g, '/s:vetar');
coreContent = coreContent.replace(/\/s:unban/g, '/s:desvetar');
coreContent = coreContent.replace(/\/s:mute/g, '/s:silenciar');
coreContent = coreContent.replace(/\/s:unmute/g, '/s:dessilenciar');

// Update Menu Hub buttons in core_commands_addon
coreContent = coreContent.replace(/\/s:home, \/s:spawn, \/s:rtp/g, '/s:casa, /s:aparicion, /s:rtp');
coreContent = coreContent.replace(/\/s:subastas, \/s:trade/g, '/s:subastas, /s:comerciar');
coreContent = coreContent.replace(/"🏠 §9Ir a mi casa \(\/s:home\)"/g, '"🏠 §9Ir a mi casa (/s:casa)"');
coreContent = coreContent.replace(/"📍 §9Guardar mi ubicación \(\/s:sethome\)"/g, '"📍 §9Guardar mi ubicación (/s:guardarcasa)"');
coreContent = coreContent.replace(/"🌍 §9Ir al Spawn global \(\/s:spawn\)"/g, '"🌍 §9Ir a la Aparición (/s:aparicion)"');
coreContent = coreContent.replace(/"🚩 §9Warps públicos \(\/s:warps\)"/g, '"🚩 §9Destinos públicos (/s:destinos)"');
coreContent = coreContent.replace(/"✅ §2Aceptar TPA \(\/s:tpaccept\)"/g, '"✅ §2Aceptar TPA (/s:tpaaceptar)"');
coreContent = coreContent.replace(/"❌ §cRechazar TPA \(\/s:tpdeny\)"/g, '"❌ §cRechazar TPA (/s:tparechazar)"');
coreContent = coreContent.replace(/"✅ §2Aceptar Intercambio \(\/s:tradeaccept\)"/g, '"✅ §2Aceptar Intercambio (/s:aceptartrato)"');
coreContent = coreContent.replace(/"❌ §cRechazar Intercambio \(\/s:tradedeny\)"/g, '"❌ §cRechazar Intercambio (/s:rechazartrato)"');
coreContent = coreContent.replace(/"✅ §2Aceptar Duelo \(\/s:coliseoaccept\)"/g, '"✅ §2Aceptar Duelo (/s:dueloaceptar)"');
coreContent = coreContent.replace(/"❌ §cRechazar Duelo \(\/s:coliseodeny\)"/g, '"❌ §cRechazar Duelo (/s:duelorechazar)"');
coreContent = coreContent.replace(/"🔥 §dForzar evento de Horda \(\/s:hordastart\)"/g, '"🔥 §dForzar evento de Horda (/s:iniciarhorda)"');
coreContent = coreContent.replace(/"🌾 §dForzar evento de Fiebre \(\/s:fiebrestart\)"/g, '"🌾 §dForzar evento de Fiebre (/s:iniciarfiebre)"');

// Update menu command handlers
coreContent = coreContent.replace(/runCommandSafe\(player, "s:home"\)/g, 'runCommandSafe(player, "s:casa")');
coreContent = coreContent.replace(/runCommandSafe\(player, "s:sethome"\)/g, 'runCommandSafe(player, "s:guardarcasa")');
coreContent = coreContent.replace(/runCommandSafe\(player, "s:spawn"\)/g, 'runCommandSafe(player, "s:aparicion")');
coreContent = coreContent.replace(/runCommandSafe\(player, "s:warps"\)/g, 'runCommandSafe(player, "s:destinos")');
coreContent = coreContent.replace(/runCommandSafe\(player, "s:tpaccept"\)/g, 'runCommandSafe(player, "s:tpaaceptar")');
coreContent = coreContent.replace(/runCommandSafe\(player, "s:tpdeny"\)/g, 'runCommandSafe(player, "s:tparechazar")');
coreContent = coreContent.replace(/runCommandSafe\(player, "s:tradeaccept"\)/g, 'runCommandSafe(player, "s:aceptartrato")');
coreContent = coreContent.replace(/runCommandSafe\(player, "s:tradedeny"\)/g, 'runCommandSafe(player, "s:rechazartrato")');
coreContent = coreContent.replace(/runCommandSafe\(player, "s:coliseoaccept"\)/g, 'runCommandSafe(player, "s:dueloaceptar")');
coreContent = coreContent.replace(/runCommandSafe\(player, "s:coliseodeny"\)/g, 'runCommandSafe(player, "s:duelorechazar")');
coreContent = coreContent.replace(/runCommandSafe\(player, "s:hordastart"\)/g, 'runCommandSafe(player, "s:iniciarhorda")');
coreContent = coreContent.replace(/runCommandSafe\(player, "s:fiebrestart"\)/g, 'runCommandSafe(player, "s:iniciarfiebre")');

fs.writeFileSync(corePath, coreContent, 'utf8');
console.log('✓ Updated core_commands_addon');
