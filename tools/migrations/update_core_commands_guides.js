const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'behavior_packs', 'core_commands_addon', 'scripts', 'main.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update sendHelp
const oldHelpStart = 'function sendHelp(sender) {';
const oldHelpEnd = 'function handleCommand(sender, rawMessage) {';

const helpIdx = content.indexOf(oldHelpStart);
const handleCmdIdx = content.indexOf(oldHelpEnd, helpIdx);

if (helpIdx !== -1 && handleCmdIdx !== -1) {
  const newSendHelp = `function sendHelp(sender) {
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

`;

  content = content.substring(0, helpIdx) + newSendHelp + content.substring(handleCmdIdx);
  console.log("Updated sendHelp in core_commands_addon");
}

// 2. Update ALL_COMMANDS
const allCmdsStart = 'const ALL_COMMANDS = [';
const allCmdsEnd = '];\n\nfunction openSearchForm(player) {';

const cStartIdx = content.indexOf(allCmdsStart);
const cEndIdx = content.indexOf(allCmdsEnd, cStartIdx);

if (cStartIdx !== -1 && cEndIdx !== -1) {
  const newAllCommands = `const ALL_COMMANDS = [
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
];`;

  content = content.substring(0, cStartIdx) + newAllCommands + content.substring(cEndIdx + 2);
  console.log("Updated ALL_COMMANDS in core_commands_addon");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("core_commands_addon/scripts/main.js successfully updated.");
