const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'behavior_packs', 'home_spawn_addon', 'scripts', 'main.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update sendHelp inside home_spawn_addon
const oldHelpStart = 'if (command === "help" || command === "ayuda") {';
const oldHelpEnd = 'if (command === "guias") {';

const helpIdx = content.indexOf(oldHelpStart);
const guiasIdx = content.indexOf(oldHelpEnd, helpIdx);

if (helpIdx !== -1 && guiasIdx !== -1) {
  const newHelpBlock = `if (command === "help" || command === "ayuda") {
    player.sendMessage("§e====== §bPacífico Comunitario - Guía de Comandos §e======");
    player.sendMessage("§7Construye, comercia y progresa en comunidad. Consulta §e/s:reglas§7.");
    player.sendMessage("§7Usa §e/s:ayuda§7 o abre el Hub visual con §e/s:menu§7.");
    player.sendMessage("§a1. Viajes y Regreso");
    player.sendMessage("§e/s:guardarcasa [1-5] §7- Guarda tu base actual (/s:sethome).");
    player.sendMessage("§e/s:casa [1-5] §7- Te lleva a tu base guardada (/s:home).");
    player.sendMessage("§e/s:borrarcasa [1-5] §7- Elimina una casa guardada.");
    player.sendMessage("§e/s:aparicion §7- Te teletransporta al spawn central (/s:spawn).");
    player.sendMessage("§e/s:destinos §7- Menú de warps y portales públicos (/s:warps).");
    player.sendMessage("§e/s:pedirtp <jugador> §7- Pide teletransporte a un jugador (/s:tpa).");
    player.sendMessage("§e/s:tpaaceptar / /s:tparechazar §7- Acepta o rechaza solicitudes.");
    player.sendMessage("§e/s:rtp §7- Teletransporte aleatorio a zona salvaje segura (10m cooldown).");
    player.sendMessage("§a2. Economía y Comercio");
    player.sendMessage("§e/s:dinero / /s:saldo §7- Consulta tu saldo de monedas.");
    player.sendMessage("§e/s:pagar <jugador> <monto> §7- Transfiere dinero a otro jugador.");
    player.sendMessage("§e/s:tienda §7- Tienda oficial con precios dinámicos flotantes.");
    player.sendMessage("§e/s:banco §7- Banco General, depósitos, ahorros y préstamos.");
    player.sendMessage("§e/s:subastas §7- Mercado de subastas global con anti-sniper.");
    player.sendMessage("§e/s:vender <precio> §7- Publica el ítem de tu mano en subasta.");
    player.sendMessage("§e/s:comerciar <jugador> §7- Intercambio cara a cara seguro de ítems y dinero.");
    player.sendMessage("§e/s:aceptartrato / /s:rechazartrato §7- Confirma intercambio (cuenta regresiva 3s).");
    player.sendMessage("§a3. Protecciones de Terreno");
    player.sendMessage("§e/s:pos1 / /s:pos2 §7- Marca las esquinas de tu terreno.");
    player.sendMessage("§e/s:proteger <nombre> §7- Registra y protege tu parcela.");
    player.sendMessage("§e/s:desproteger §7- Elimina la protección del terreno actual.");
    player.sendMessage("§e/s:zona bordes §7- Muestra los límites de tu terreno con partículas de esmeralda.");
    player.sendMessage("§e/s:zona banderas §7- Menú para configurar PvP, monstruos, explosiones y puertas.");
    player.sendMessage("§e/s:zona confiar <jugador> §7- Da permisos a un amigo en tu zona.");
    player.sendMessage("§e/s:zona desconfiar <jugador> §7- Retira permisos a un amigo.");
    player.sendMessage("§e/s:zonas §7- Gestor gráfico de todos tus terrenos.");
    player.sendMessage("§a4. Progresión, Trabajos y Rangos");
    player.sendMessage("§e/s:trabajos §7- Elige profesión: pasivas de Leñador, Granjero y Minero + cuotas.");
    player.sendMessage("§e/s:misiones §7- Misiones personales y meta comunitaria con Booster Global.");
    player.sendMessage("§e/s:recompensas §7- Racha de 30 días de login continuo con premios especiales.");
    player.sendMessage("§e/s:rankup / /s:ascender §7- Asciende de rango (Recluta a Leyenda) con tiempo y dinero.");
    player.sendMessage("§e/s:kitinicial §7- Reclama tu kit de bienvenida (una sola vez).");
    player.sendMessage("§e/s:cajas §7- Abre cofres de recompensas con llaves (/s:crates).");
    player.sendMessage("§a5. Clanes y Combate");
    player.sendMessage("§e/s:clan ayuda §7- Lista completa de comandos de clan.");
    player.sendMessage("§e/s:clan crear <nombre> §7- Crea tu clan comunitario (fuego amigo bloqueado).");
    player.sendMessage("§e/s:clan nivel / /s:clan mejorar §7- Mejora el nivel de tu clan (Niveles 1-5).");
    player.sendMessage("§e/s:c <mensaje> §7- Chat privado con los miembros de tu clan.");
    player.sendMessage("§e/s:duelo <jugador> §7- Desafía a un duelo 1v1 voluntario en coliseo.");
    player.sendMessage("§e/s:dueloaceptar / /s:duelorechazar §7- Acepta o rechaza el duelo.");
    player.sendMessage("§e/s:pvp [activar] §7- Consulta o cancela tu inmunidad de 30m de novato.");
    player.sendMessage("§a6. Utilidades y Minijuegos");
    player.sendMessage("§e/s:casino §7- Minijuegos: Cara o Cruz, Blackjack 21, Ruleta y Tragamonedas.");
    player.sendMessage("§e/s:tumba / /s:tumbatp §7- Ubicación y teletransporte a tu tumba.");
    player.sendMessage("§e/s:guias §7- Guías visuales detalladas de todos los sistemas.");
    player.sendMessage("§e/s:reglas §7- Reglamento y normas comunitarias.");
    
    const isOp = isPlayerOp(player);
    if (isOp) {
      player.sendMessage("§a7. Administración");
      player.sendMessage("§e/s:fijaraparicion §7- Define el spawn principal del servidor.");
      player.sendMessage("§e/s:vetar / /s:desvetar / /s:silenciar / /s:congelar §7- Moderación estricta.");
      player.sendMessage("§e/s:limpiar §7- Limpieza manual de suelo y entidades.");
      player.sendMessage("§e/s:iniciarhorda / /s:iniciarfiebre §7- Fuerza eventos automáticos.");
      player.sendMessage("§e/s:fijarcaja / /s:borrarcaja / /s:darllave §7- Administra crates.");
      player.sendMessage("§e/s:maquinatrabajo / /s:trabajosnpc §7- Estaciones de trabajo.");
      player.sendMessage("§e/s:fijardestino <nombre> / /s:borrardestino <nombre> §7- Warps públicos.");
      player.sendMessage("§e/s:adminproteger / /s:admineliminar / /s:admincoliseo §7- Zonas y coliseos.");
    }
    player.sendMessage("§e=================================================");
    return;
  }

  `;

  content = content.substring(0, helpIdx) + newHelpBlock + content.substring(guiasIdx);
  console.log("Updated sendHelp in home_spawn_addon");
}

// 2. Update openGuidesMenu in home_spawn_addon
const guidesStart = 'function openGuidesMenu(player) {';
const guidesEnd = 'function openGuideDetail(player, title, content) {';

const gStartIdx = content.indexOf(guidesStart);
const gEndIdx = content.indexOf(guidesEnd, gStartIdx);

if (gStartIdx !== -1 && gEndIdx !== -1) {
  const newGuidesBlock = `function openGuidesMenu(player) {
  const form = new ActionFormData()
    .title("📚 Guías de Pacífico Comunitario")
    .body("Selecciona un tema para conocer todas las funciones y comandos esenciales:")
    .button("🏠 Casas y Spawn")
    .button("💰 Economía, Tienda y Precios")
    .button("🛡️ Terrenos, Bordes y Banderas")
    .button("🤝 Comunidad, Clanes y Niveles")
    .button("🎒 Intercambios y Subastas")
    .button("✨ Replicador Decorativo")
    .button("💼 Trabajos, Pasivas y Misiones")
    .button("🏦 Banco, Ahorros y Préstamos")
    .button("🌾 Granjas Comunitarias")
    .button("🧭 Viajes, TPA y Tumbas")
    .button("🏷️ Rangos, Hordas y Casino")
    .button("📜 Seguridad, Inmunidad y Reglas")
    .button("❌ Salir");

  safeShowForm(player, form, (response) => {
    switch (response.selection) {
      case 0:
        openGuideDetail(player, "Casas y Spawn", 
          "§e¿Cómo guardar tu casa?\\n" +
          "§7Párate en el lugar donde quieras guardar tu base y escribe:\\n" +
          "§a👉 /s:guardarcasa 1 §7(o /s:guardarcasa base)\\n" +
          "§7Puedes tener hasta 5 casas guardadas usando §a/s:guardarcasa 2§7 al §a5§7.\\n\\n" +
          "§e¿Cómo regresar a tu casa?\\n" +
          "§7Casa principal: §a/s:casa§7. Otras casas: §a/s:casa 2§7 al §a5§7.\\n\\n" +
          "§e¿Cómo ir con un compañero?\\n" +
          "§71. Pide ir con él escribiendo:\\n" +
          "§a👉 /s:pedirtp <Jugador> §7(o /s:tpa)\\n" +
          "§72. Tu compañero acepta con §a/s:tpaaceptar§7 o rechaza con §a/s:tparechazar§7.\\n\\n" +
          "§e¿Cómo regresar al spawn?\\n" +
          "§7Para volver al centro seguro del servidor escribe:\\n" +
          "§a👉 /s:aparicion §7(o /s:spawn)\\n\\n" +
          "§e¿Cómo recuperar tus cosas al morir?\\n" +
          "§7Al morir se genera una tumba protegida. Escribe:\\n" +
          "§a👉 /s:tumbatp\\n" +
          "§7Te teletransportará a un bloque seguro junto a tu tumba activa. Consulta coordenadas con §a/s:tumba§7."
        );
        break;
      case 1:
        openGuideDetail(player, "Economía, Tienda y Precios", 
          "§e💸 Dinero y Progreso Económico\\n" +
          "§71. Consulta tu saldo actual en cualquier momento con §a/s:dinero§7 o §a/s:saldo§7.\\n" +
          "§72. Envía monedas a otro jugador con §a/s:pagar <jugador> <monto>§7.\\n\\n" +
          "§e🛒 Tienda Oficial (/s:tienda)\\n" +
          "§7- Compra bloques, semillas, comida y herramientas directo en el menú.\\n" +
          "§7- Vende tus excedentes en el botón §e💰 Vender Materiales§7.\\n\\n" +
          "§e📈 Sistema de Precios Dinámicos Flotantes\\n" +
          "§7¡La economía se autorregula! La venta masiva continua de un producto (granjas AFK excesivas) " +
          "reduce gradualmente el precio de compra del servidor hasta un piso del 60%. " +
          "Con el tiempo y la demanda, el precio se recupera automáticamente. ¡Diversifica tus ingresos!\\n\\n" +
          "§e⛏️ Menas Naturales\\n" +
          "§7Minar menas naturales en el mundo paga monedas directamente a tu bolsillo. Menas colocadas o movidas con pistones no pagan."
        );
        break;
      case 2:
        openGuideDetail(player, "Terrenos, Bordes y Banderas", 
          "§e¿Cómo proteger tu parcela de robos y destrucción?\\n" +
          "§71. Párate en una esquina de tu terreno y escribe: §a/s:pos1§7.\\n" +
          "§72. Ve a la esquina diagonal opuesta y escribe: §a/s:pos2§7.\\n" +
          "§73. Reclama tu zona escribiendo:\\n" +
          "§a👉 /s:proteger <NombreDeTuZona>\\n" +
          "§7Costo exacto: §a$2,000 + $4 por bloque horizontal§7 (hasta 100x100).\\n\\n" +
          "§e✨ Bordes de Partículas (/s:zona bordes)\\n" +
          "§7Activa o desactiva un perímetro visible de partículas esmeralda durante 60s para inspeccionar tus límites exactos.\\n\\n" +
          "§e🚩 Banderas de Zona (/s:zona banderas)\\n" +
          "§7Configura reglas especiales para tu reclamo:\\n" +
          "§7- §aSpawneo de Monstruos§7: Permite o bloquea hostiles.\\n" +
          "§7- §aPvP§7: Activa o desactiva combate dentro de tu base.\\n" +
          "§7- §aExplosiones§7: Protege contra TNT y creepers.\\n" +
          "§7- §aPuertas Visitantes§7: Permite o bloquea el uso de puertas a desconocidos.\\n\\n" +
          "§e👥 Permisos a Amigos\\n" +
          "§7Usa §a/s:zona confiar <amigo>§7 para darle acceso o §a/s:zona desconfiar <amigo>§7 para quitarlo."
        );
        break;
      case 3:
        openGuideDetail(player, "Comunidad, Clanes y Niveles", 
          "§e¿Cómo crear un clan?\\n" +
          "§7Crear tu clan es 100% gratuito: escribe §a/s:clan crear <Nombre>§7.\\n" +
          "§7Invita compañeros con §a/s:clan invitar <jugador>§7 y ellos se unen con §a/s:clan unirse <clan>§7.\\n\\n" +
          "§e🏰 Niveles de Clan (/s:clan nivel y /s:clan mejorar)\\n" +
          "§7¡Sube el nivel de tu clan del 1 al 5 usando fondos del banco del clan!\\n" +
          "§7- Nivel 1: Capacidad base (8 miembros)\\n" +
          "§7- Nivel 2: $10,000 banco -> 12 miembros\\n" +
          "§7- Nivel 3: $25,000 banco -> 16 miembros\\n" +
          "§7- Nivel 4: $50,000 banco -> 20 miembros\\n" +
          "§7- Nivel 5: $100,000 banco -> 24 miembros\\n\\n" +
          "§e🛡️ Fuego Amigo Bloqueado\\n" +
          "§7Los clanes son estrictamente cooperativos: es imposible dañarse entre miembros de clan.\\n\\n" +
          "§e💬 Chat de Clan y Banco\\n" +
          "§7- Escribe §a/s:c <mensaje>§7 para hablar en secreto con tu clan.\\n" +
          "§7- Deposita dinero con §a/s:clan depositar <monto>§7 para financiar mejoras comunitarias."
        );
        break;
      case 4:
        openGuideDetail(player, "Intercambios y Subastas", 
          "§e🤝 Comercio Seguro Mixto Cara a Cara\\n" +
          "§71. Acércate al jugador y escribe:\\n" +
          "§a👉 /s:comerciar <Jugador> §7(o /s:trade)\\n" +
          "§72. El otro jugador acepta con §a/s:aceptartrato§7.\\n" +
          "§73. Se abrirá la interfaz segura donde pueden ofertar **Ítems + Monedas al mismo tiempo**.\\n" +
          "§74. Al aceptar ambos, se ejecuta una §ecuenta regresiva de 3 segundos§7 con sonidos para evitar cambios tramposos a último segundo.\\n\\n" +
          "§e🎒 Mercado Global de Subastas (/s:subastas)\\n" +
          "§7- Sostén un ítem en tu mano y escribe §a/s:vender <precio>§7 para publicarlo.\\n" +
          "§7- Consulta y compra artículos de otros jugadores con §a/s:subastas§7.\\n" +
          "§7- §aAnti-Sniper§7: Cualquier interacción con una subasta a menos de 60s agrega 1 minuto adicional."
        );
        break;
      case 5:
        openGuideDetail(player, "Replicador Decorativo",
          "§e✨ ¿Qué es el Replicador Decorativo?\\n" +
          "§7Una máquina comunitaria para duplicar decoraciones (cuadros, macetas, soportes de armaduras y estandartes simples) para constructores.\\n\\n" +
          "§e¿Cómo usarlo?\\n" +
          "§71. Sostén en tu mano principal la decoración permitida.\\n" +
          "§72. Haz clic derecho sobre el bloque/NPC Replicador.\\n" +
          "§73. Selecciona la cantidad (máximo 64 por día).\\n" +
          "§74. Paga §a$250 monedas§7 por unidad replicada.\\n\\n" +
          "§8Los ítems replicados tienen marca estética y no son monetizables."
        );
        break;
      case 6:
        openGuideDetail(player, "Trabajos, Pasivas y Misiones",
          "§e💼 Trabajos y Habilidades Pasivas (/s:trabajos)\\n" +
          "§7Elige una profesión y recibe dinero mientras juegas más ventajas únicas en el mundo:\\n" +
          "§7- 🪓 §aLeñador§7: Pasiva Treecapitator (tala árboles de un solo golpe hasta 16 bloques verticales).\\n" +
          "§7- 🌾 §aGranjero§7: Auto-replantado automático al cosechar cultivos maduros si tienes semillas en el inventario.\\n" +
          "§7- ⛏️ §aMinero§7: 25% de probabilidad de duplicar menas naturales valiosas al picar.\\n" +
          "§7- 📦 §aCuotas Diarias§7: Completa 3 entregas de trabajo al día para recibir un bono de **$1,000 extra**.\\n\\n" +
          "§e📜 Misiones y Meta Comunitaria (/s:misiones)\\n" +
          "§7Completa desafíos individuales para obtener recompensas monetarias. ¡Entre todos los jugadores, alcanzar 30 misiones globales activa un **Booster Global de Trabajos** (+50% de ganancia) para todo el servidor durante 30 minutos!\\n\\n" +
          "§e🎁 Racha de 30 Días (/s:recompensas)\\n" +
          "§7Conéctate a diario para reclamar recompensas progresivas. Si no entras en 48h, la racha se reinicia. ¡Premios especiales en días 7, 14, 21 y el Jackpot de $50,000 + Netherite + llaves en el día 30!"
        );
        break;
      case 7:
        openGuideDetail(player, "Banco, Ahorros y Préstamos",
          "§e🏦 Banco General (/s:banco)\\n" +
          "§7Tu cuenta bancaria segura:\\n" +
          "§7- Deposita y retira dinero para mantenerlo a salvo.\\n" +
          "§7- Genera intereses pasivos sobre tu saldo de ahorro.\\n" +
          "§7- Realiza transferencias rápidas mediante CBU/Alias.\\n\\n" +
          "§e💳 Préstamos Bancarios\\n" +
          "§7Solicita créditos según tu nivel económico. El banco deduce automáticamente un porcentaje de tus cobros futuros hasta saldar la deuda."
        );
        break;
      case 8:
        openGuideDetail(player, "Granjas Comunitarias",
          "§e🌾 ¿Cómo funcionan?\\n" +
          "§7Instalaciones públicas para recolectar cultivos, madera y recursos rápidamente para vender en §a/s:tienda§7.\\n\\n" +
          "§e🎟️ Accesos de Pago\\n" +
          "§7Algunas granjas tienen un botón de entrada pagada por tiempo. Presionas, pagas la sesión y accedes a recolectar durante el lapso indicado.\\n\\n" +
          "§e🔒 Seguridad\\n" +
          "§7Cofres técnicos, tolvas y dispensadores están sellados contra saqueo. Solo recolecta el producto terminado y respeta las máquinas."
        );
        break;
      case 9:
        openGuideDetail(player, "Viajes, TPA y Tumbas",
          "§e🧭 Moverse por el Mundo\\n" +
          "§7- §a/s:aparicion§7: Regresa al spawn del servidor.\\n" +
          "§7- §a/s:destinos§7: Abre la lista de portales y puntos de interés públicos.\\n" +
          "§7- §a/s:rtp§7: Teletransporte aleatorio a una zona salvaje segura (cooldown de 10 minutos).\\n\\n" +
          "§e👤 Teletransporte con Amigos\\n" +
          "§7- Enviar solicitud: §a/s:pedirtp <jugador>§7 (o /s:tpa).\\n" +
          "§7- Aceptar solicitud: §a/s:tpaaceptar§7.\\n" +
          "§7- Rechazar solicitud: §a/s:tparechazar§7.\\n\\n" +
          "§e⚰️ Sistema de Tumbas\\n" +
          "§7- Consulta la ubicación de tu muerte con §a/s:tumba§7.\\n" +
          "§7- Viaja de regreso directamente a tu tumba activa con §a/s:tumbatp§7."
        );
        break;
      case 10:
        openGuideDetail(player, "Rangos, Hordas y Casino",
          "§e👑 Rangos de Supervivencia (/s:rankup o /s:rango)\\n" +
          "§7Asciende en el escalafón de supervivencia con tiempo de juego y saldo acumulado:\\n" +
          "§7- 🔰 §aRecluta§7: Rango inicial gratuito.\\n" +
          "§7- 🏹 §aExplorador§7: $5,000 + 2h jugadas.\\n" +
          "§7- 🛡️ §aVeterano§7: $25,000 + 10h jugadas.\\n" +
          "§7- ⚔️ §aHéroe§7: $75,000 + 24h jugadas.\\n" +
          "§7- 👑 §aLeyenda§7: $200,000 + 50h jugadas.\\n" +
          "§7¡Muestra tu prefijo exclusivo en el chat de juego!\\n\\n" +
          "§e🧟 Evento de Horda Adaptativa (/s:iniciarhorda)\\n" +
          "§7Oleadas de monstruos cuya dificultad escala (+12%) con la cantidad de jugadores conectados. Incluye mini-jefes: Titán Zombi (Ola 3) y Señor del Apocalipsis (Ola 5). Los 3 mejores cazadores reciben premios monetarios y botín especial.\\n\\n" +
          "§e🎰 Casino (/s:casino)\\n" +
          "§7Minijuegos de apuestas con economía integrada:\\n" +
          "§7- 🪙 §aCara o Cruz§7: Probabilidades justas del 50% con duplicación de apuesta (2x).\\n" +
          "§7- 🃏 §aBlackjack 21§7: Juega contra la casa. Blackjack natural paga 2.5x.\\n" +
          "§7- 🎡 §aRuleta y Tragamonedas§7: Juegos clásicos de multiplicadores."
        );
        break;
      case 11:
        openGuideDetail(player, "Seguridad, Inmunidad y Reglas",
          "§e🛡️ Inmunidad para Nuevos Jugadores (/s:pvp)\\n" +
          "§7Al unirte al servidor recibes 30 minutos de inmunidad PvP para construir tu base sin riesgo. Usa §a/s:pvp§7 para ver tu tiempo o §a/s:pvp activar§7 si deseas entrar al combate antes.\\n\\n" +
          "§e📜 Normas de Convivencia (/s:reglas)\\n" +
          "§7- Prohibido el robo en zonas protegidas o el aprovechamiento de errores.\\n" +
          "§7- Prohibido el uso de clientes modificados, hacks o trampas de duplicación.\\n" +
          "§7- Respeta a los miembros de la comunidad en el chat.\\n\\n" +
          "§e⚖️ Anticheat y Moderación\\n" +
          "§7El servidor cuenta con detección automática de trampas. Sospechas mayores al 80% alertan al Staff y activan congelamiento estricto (/s:congelar)."
        );
        break;
      default:
        break;
    }
  });
}
`;

  content = content.substring(0, gStartIdx) + newGuidesBlock + content.substring(gEndIdx);
  console.log("Updated openGuidesMenu in home_spawn_addon");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("home_spawn_addon/scripts/main.js successfully updated.");
