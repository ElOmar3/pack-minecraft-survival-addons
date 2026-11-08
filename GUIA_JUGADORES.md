# 🧭 Guía Maestra de Jugadores y Comandos - Pacífico Comunitario (BDS 1.26.x)

Bienvenido a la guía oficial de **Pacífico Comunitario**, un paquete completo de 26 addons diseñado para ofrecer una experiencia de supervivencia multijugador, económica, justa y cooperativa en **Minecraft Bedrock Dedicated Server**.

Todos los comandos, menús y mensajes del servidor se encuentran normalizados al **español neutro / mexicano**, manteniendo compatibilidad transparente con comandos en inglés para jugadores acostumbrados a ellos.

---

## 📑 Índice Rápido
1. [Primeros Pasos (Guía para Nuevos Jugadores)](#-primeros-pasos-guía-para-nuevos-jugadores)
2. [Los 26 Addons y sus Funciones Esenciales](#-los-26-addons-y-sus-funciones-esenciales)
3. [Tabla Completa de Comandos en Español](#-tabla-completa-de-comandos-en-español)
4. [Mecánicas Esenciales y Novedades](#-mecánicas-esenciales-y-novedades)
   - [Protección de Terrenos, Bordes y Banderas](#1-protección-de-terrenos-bordes-y-banderas)
   - [Economía, Tienda y Precios Flotantes](#2-economía-tienda-y-precios-dinámicos-flotantes)
   - [Trabajos, Pasivas en el Mundo y Cuotas Diarias](#3-trabajos-pasivas-en-el-mundo-y-cuotas-diarias)
   - [Misiones Comunitarias y Potenciadores Globales](#4-misiones-comunitarias-y-potenciadores-globales)
   - [Racha de Inicio de Sesión de 30 Días](#5-racha-de-inicio-de-sesión-de-30-días)
   - [Escalafón de Rangos de Supervivencia (/s:rankup)](#6-escalafón-de-rangos-de-supervivencia-srankup)
   - [Clanes y Niveles de Expansión](#7-clanes-y-niveles-de-expansión)
   - [Comercio Seguro Mixto & Subastas Anti-Sniper](#8-comercio-seguro-mixto--subastas-anti-sniper)
   - [Apocalipsis Dinámico, Mini-Jefes y Caza](#9-apocalipsis-dinámico-mini-jefes-y-caza)
   - [Casino Comunitario: Cara o Cruz y Blackjack 21](#10-casino-comunitario-cara-o-cruz-y-blackjack-21)
5. [Comandos de Moderación y Administración](#-comandos-de-moderación-y-administración)

---

## 🔰 Primeros Pasos (Guía para Nuevos Jugadores)

Al ingresar por primera vez a Pacífico Comunitario, contarás con ventajas especiales para comenzar tu aventura sin riesgos:

1. **Inmunidad PvP de Novato (30 Minutos):**
   - Durante tus primeros 30 minutos ningún jugador podrá atacarte ni hacerte daño mientras exploras o construyes tu refugio.
   - Puedes consultar cuántos minutos te restan escribiendo `/s:pvp`.
   - Si deseas habilitar el PvP antes de tiempo para entrar en combate, escribe `/s:pvp activar`.

2. **Kit de Arranque:**
   - Escribe `/s:kitinicial` para reclamar tu kit básico gratuito de herramientas y provisiones (disponible una sola vez por jugador).

3. **Exploración Segura con RTP:**
   - Escribe `/s:rtp` para ser teletransportado aleatoriamente a una zona salvaje segura, lejos del spawn, con verificación automática de bloques peligrosos (lava, vacíos o caídas). Cuenta con un enfriamiento de 10 minutos.

4. **Establecer tu Base:**
   - Marca tu base con `/s:guardarcasa` para poder volver en cualquier momento usando `/s:casa`.
   - Puedes tener hasta 5 casas guardadas (`/s:guardarcasa 1` hasta `/s:guardarcasa 5`).

5. **Menú Central y Guías Visuales:**
   - En cualquier momento escribe `/s:menu` para abrir la interfaz gráfica principal con acceso a todos los servicios del servidor, o `/s:guias` para repasar los tutoriales visuales.

---

## 🧩 Los 26 Addons y sus Funciones Esenciales

Cada addon cumple un rol específico en el ecosistema del servidor:

| # | Addon | Función Esencial para el Jugador |
|---|---|---|
| 1 | **`core_commands_addon`** | Hub interactivo principal (`/s:menu`), buscador de comandos, guías y utilidades base. |
| 2 | **`currency_addon`** | Economía monetaria virtual, transferencias (`/s:pagar`), banco (`/s:banco`) y pagos por minar menas naturales. |
| 3 | **`home_spawn_addon`** | Sistema de hasta 5 casas (`/s:casa`), spawn central (`/s:aparicion`), TPA y tumbas seguras al morir (`/s:tumbatp`). |
| 4 | **`protection_addon`** | Reclamo de parcelas contra robos y grifeo, partículas perimetrales (`/s:zona bordes`) y banderas configurables (`/s:zona banderas`). |
| 5 | **`trade_addon`** | Intercambio seguro cara a cara con soporte mixto (objetos + dinero) y cuenta regresiva anti-estafas de 3 segundos. |
| 6 | **`auction_house_addon`** | Mercado global de compra/venta entre jugadores (`/s:subastas`, `/s:vender`) con catálogo en español y anti-sniper (+60s). |
| 7 | **`shop_addon`** | Tienda oficial (`/s:tienda`) con precios dinámicos flotantes que evitan la devaluación por granjas masivas AFK. |
| 8 | **`jobs_addon`** | Gremio de profesiones (`/s:trabajos`) con pasivas reales en el mundo (Treecapitator, auto-replant, doble mena) y cuotas diarias. |
| 9 | **`quests_addon`** | Misiones secundarias (`/s:misiones`) y meta comunitaria global que activa un Booster Global de Trabajos para todos. |
| 10 | **`ranks_addon`** | Escalafón de supervivencia (`/s:rankup`): 5 rangos progresivos (Recluta a Leyenda) según tiempo jugado y dinero, con prefijo en chat. |
| 11 | **`rewards_addon`** | Racha de 30 días de inicio de sesión (`/s:recompensas`) con jackpot de dinero, Netherite y llaves en días clave. |
| 12 | **`clans_addon`** | Clanes cooperativos (`/s:clan crear`), niveles de clan (1 al 5) para ampliar miembros, banco de clan y fuego amigo desactivado. |
| 13 | **`newbie_addon`** | Experiencia del recién llegado: 30 minutos de inmunidad PvP (`/s:pvp`), tutorial de bienvenida y RTP seguro. |
| 14 | **`horde_event_addon`** | Evento de invasión adaptativo (`/s:iniciarhorda`): escala con los jugadores en línea, mini-jefes y premios para los 3 mejores cazadores. |
| 15 | **`casino_addon`** | Minijuegos de apuestas (`/s:casino`): Cara o Cruz (probabilidades 50/50, pago 2x), Blackjack 21 (pago 2.5x), Ruleta y Tragamonedas. |
| 16 | **`crates_addon`** | Cajas de botín con llaves especiales (`/s:cajas`) para conseguir objetos y equipamiento legendario. |
| 17 | **`warps_addon`** | Red de puntos de teletransporte públicos (`/s:destinos`) a ciudades, coliseos y zonas comunitarias. |
| 18 | **`server_boosters_addon`** | Potenciadores globales comunitarios (`/s:potenciadores`) para aumentar temporalmente la paga de trabajos o minería. |
| 19 | **`mining_fever_addon`** | Evento temporal de fiebre minera que multiplica los ingresos al picar minerales en cavernas. |
| 20 | **`blood_moon_addon`** | Evento nocturno de Luna de Sangre con mayor agresividad de monstruos y recompensas exclusivas al sobrevivir. |
| 21 | **`camera_follower_addon`** | Herramienta de cámara espectadora cinemática (`/s:camara`) para eventos y supervisión. |
| 22 | **`anticheat_addon`** | Vigilancia en segundo plano: detecta combate irregular, velocidad y vuelo; alerta al Staff ante sospechas $\ge 80\%$. |
| 23 | **`antidupe_addon`** | Detección y bloqueo contra duplicación de objetos, desincronización y glitching de paquetes. |
| 24 | **`fcx_limited_admin`** | Sistema de roles de moderación segura con congelamiento estricto (`/s:congelar`), silenciamiento y veto. |
| 25 | **`block_audit_addon`** | Registro y auditoría de colocación y rotura de bloques (`/s:varaauditoria`) para investigar robos o grifeos pasados. |
| 26 | **`lag_cleaner_addon`** | Mantenimiento automático y manual (`/s:limpiar`) para remover ítems flotantes y optimizar el rendimiento del servidor. |

---

## 📜 Tabla Completa de Comandos en Español

Todos los comandos se ejecutan con el prefijo `/s:`.

### 🧭 1. Viajes, Hogares y Spawn
| Comando Principal | Alias en Segundo Plano | Descripción |
|---|---|---|
| `/s:casa [1-5]` | `/s:home [1-5]` | Te teletransporta a tu base guardada. |
| `/s:guardarcasa [1-5]` | `/s:sethome [1-5]` | Guarda tu posición actual como base (hasta 5 hogares). |
| `/s:borrarcasa [1-5]` | `/s:delhome [1-5]` | Elimina una de tus casas guardadas. |
| `/s:aparicion` | `/s:spawn` | Teletransporte al spawn central del servidor. |
| `/s:destinos` | `/s:warps`, `/s:teletransportes` | Abre el menú de destinos y warps públicos. |
| `/s:pedirtp <jugador>` | `/s:tpa <jugador>` | Solicita teletransportarte a la posición de otro jugador. |
| `/s:tpaaceptar` | `/s:tpaccept`, `/s:aceptartp` | Acepta la solicitud de teletransporte pendiente. |
| `/s:tparechazar` | `/s:tpdeny`, `/s:rechazartp` | Rechaza la solicitud de teletransporte pendiente. |
| `/s:rtp` | `/s:wild` | Teletransporte aleatorio a una zona salvaje segura (10m cooldown). |
| `/s:tumba` | `/s:muerte` | Muestra las coordenadas de tu última muerte. |
| `/s:tumbatp` | `/s:gravetp` | Te teletransporta de manera segura a tu tumba activa. |

---

### 💰 2. Dinero, Comercio y Tienda
| Comando Principal | Alias en Segundo Plano | Descripción |
|---|---|---|
| `/s:dinero` / `/s:saldo` | `/s:money`, `/s:bal` | Consulta tu saldo de monedas actual. |
| `/s:pagar <jugador> <monto>` | `/s:pay` | Transfiere dinero a otro jugador conectado. |
| `/s:tienda` | `/s:shop` | Abre la tienda oficial con precios dinámicos flotantes. |
| `/s:banco` | `/s:bank` | Abre el Banco General (depósitos, retiros, préstamos y CBU). |
| `/s:subastas` | `/s:ah` | Abre la casa de subastas de la comunidad con anti-sniper. |
| `/s:vender <precio>` | `/s:sellhand`, `/s:subastar` | Publica en el mercado global el ítem que sostienes en tu mano. |
| `/s:comerciar <jugador>` | `/s:trade` | Solicita un intercambio cara a cara de ítems y dinero. |
| `/s:aceptartrato` | `/s:tradeaccept` | Acepta la solicitud de intercambio (cuenta de 3s). |
| `/s:rechazartrato` | `/s:tradedeny` | Rechaza la solicitud de intercambio. |

---

### 🛡️ 3. Terrenos y Protecciones
| Comando Principal | Alias en Segundo Plano | Descripción |
|---|---|---|
| `/s:pos1` | `/s:esquina1` | Marca la primera esquina de tu terreno. |
| `/s:pos2` | `/s:esquina2` | Marca la segunda esquina opuesta de tu terreno. |
| `/s:proteger <nombre>` | `/s:claim` | Reclama y protege el área seleccionada ($2,000 + $4 por bloque). |
| `/s:desproteger` | `/s:unclaim` | Elimina la protección del terreno donde estás parado. |
| `/s:zona bordes` | `/s:claim borders` | Muestra u oculta los límites del terreno con partículas esmeralda. |
| `/s:zona banderas` | `/s:claim flags` | Abre el panel para configurar monstruos, PvP, explosiones y puertas. |
| `/s:zona confiar <jugador>` | `/s:claim trust` | Otorga permisos de construcción y cofres a un amigo en tu zona. |
| `/s:zona desconfiar <jugador>`| `/s:claim untrust` | Quita los permisos a un amigo en tu terreno. |
| `/s:zonas` | `/s:miszonas` | Menú gráfico para administrar todos tus reclamos. |

---

### 💼 4. Progresión, Trabajos y Rangos
| Comando Principal | Alias en Segundo Plano | Descripción |
|---|---|---|
| `/s:trabajos` | `/s:jobs` | Abre el gremio de oficios: Leñador, Granjero, Minero y cuotas diarias. |
| `/s:misiones` | `/s:quests` | Panel de misiones individuales y meta comunitaria de Booster. |
| `/s:rankup` / `/s:ascender` | `/s:rango` | Asciende en el escalafón de supervivencia (Recluta a Leyenda). |
| `/s:recompensas` | `/s:rewards` | Reclama tu recompensa de la racha de inicio de sesión de 30 días. |
| `/s:kitinicial` | `/s:kitstarter` | Reclama tu kit de arranque gratuito (una vez por jugador). |
| `/s:cajas` | `/s:crates` | Abre cofres misteriosos con llaves especiales de recompensa. |
| `/s:titulos` | `/s:titles` | Tienda y gestor de títulos cosméticos en el chat. |
| `/s:potenciadores` | `/s:boosters` | Consulta los multiplicadores globales activos del servidor. |

---

### 🤝 5. Clanes y Duelos
| Comando Principal | Alias en Segundo Plano | Descripción |
|---|---|---|
| `/s:clan ayuda` | `/s:clan help` | Muestra la guía de todos los subcomandos de clan. |
| `/s:clan crear <nombre>` | `/s:clan create` | Funda un nuevo clan comunitario de forma gratuita. |
| `/s:clan invitar <jugador>` | `/s:clan invite` | Invita a un jugador a unirse a tu clan. |
| `/s:clan unirse <clan>` | `/s:clan join` | Acepta una invitación y entra a un clan. |
| `/s:clan nivel` | `/s:clan level` | Consulta el nivel actual de tu clan y su capacidad de miembros. |
| `/s:clan mejorar` | `/s:clan upgrade` | Sube el nivel del clan (1 al 5) usando fondos del banco de clan. |
| `/s:clan depositar <monto>` | `/s:clan deposit` | Deposita dinero al banco del clan para financiar mejoras. |
| `/s:clan retirar <monto>` | `/s:clan withdraw` | Retira fondos del banco del clan (exclusivo para líderes). |
| `/s:clan salir` | `/s:clan leave` | Abandona tu clan actual. |
| `/s:clan expulsar <jugador>` | `/s:clan kick` | Expulsa a un miembro del clan (líderes). |
| `/s:clan lista` | `/s:clan list` | Muestra todos los clanes registrados en el servidor. |
| `/s:c <mensaje>` | `/s:clanchat` | Envía un mensaje privado únicamente a los miembros de tu clan. |
| `/s:duelo <jugador>` | `/s:duel`, `/s:coliseopvp` | Desafía a otro jugador a un combate PvP 1v1 en el coliseo. |
| `/s:dueloaceptar` | `/s:duelaccept` | Acepta un desafío de duelo pendiente. |
| `/s:duelorechazar` | `/s:dueldeny` | Rechaza un desafío de duelo pendiente. |

---

### 🎲 6. Utilidades, Minijuegos y Ayuda
| Comando Principal | Alias en Segundo Plano | Descripción |
|---|---|---|
| `/s:menu` | `/s:hub` | Abre el menú interactivo principal del servidor con todas las funciones. |
| `/s:ayuda` | `/s:help` | Muestra el resumen de comandos categorizado en el chat. |
| `/s:guias` | `/s:guides` | Abre el menú de guías visuales interactivas. |
| `/s:reglas` | `/s:rules` | Abre las normas y reglamento de convivencia comunitaria. |
| `/s:pvp [activar]` | `/s:pvp on` | Consulta tus minutos restantes de inmunidad de novato o actívalo. |
| `/s:casino` | `/s:gamble` | Accede a los juegos de azar: Cara o Cruz, Blackjack 21, Ruleta y Slots. |
| `/s:camara` | `/s:camera` | Alterna el modo de cámara cinemática en modo espectador. |
| `/s:ping` | `/s:latencia` | Mide tu latencia y tiempo de respuesta con el servidor. |

---

## 🌟 Mecánicas Esenciales y Novedades

### 1. Protección de Terrenos, Bordes y Banderas
- **¿Cómo proteger?**
  1. Marca la primera esquina en el suelo con `/s:pos1`.
  2. Camina a la esquina opuesta en diagonal y escribe `/s:pos2`.
  3. Reclama tu terreno escribiendo `/s:proteger <nombre>`. El costo se calcula a razón de $\$2,000 + \$4$ por bloque horizontal.
- **✨ Bordes con Partículas:** Escribe `/s:zona bordes` para ver un contorno de partículas verdes esmeralda (`minecraft:villager_happy`) durante 60 segundos. Útil para saber exactamente dónde termina tu parcela.
- **🚩 Banderas de Zona:** Escribe `/s:zona banderas` para abrir el panel de control de tu parcela y configurar:
  - `Spawneo de Monstruos`: Evita que aparezcan zombies, esqueletos o creepers en tu casa.
  - `PvP`: Impide el combate entre jugadores dentro de tu terreno.
  - `Explosiones`: Bloquea roturas provocadas por creepers o TNT.
  - `Puertas de Visitantes`: Permite que viajeros puedan abrir o cerrar tus puertas y portones sin necesidad de darles permisos de construcción.

---

### 2. Economía, Tienda y Precios Dinámicos Flotantes
- **Minar Menas Paga Monedas:** Picar carbón, hierro, oro, redstone, lapislázuli, diamante o netherite generado naturalmente en el mundo añade dinero directo a tu balance. Menas colocadas artificialmente no pagan.
- **Precios Flotantes en `/s:tienda`:**
  - Para evitar que granjas automáticas masivas AFK rompan la economía, la venta excesiva y concentrada de un mismo objeto disminuye ligeramente su precio de compra hasta un **piso de protección del 60%**.
  - Con el paso de las horas y la diversificación de ventas, el precio se normaliza automáticamente al 100%.

---

### 3. Trabajos, Pasivas en el Mundo y Cuotas Diarias
Al unirte a un oficio en `/s:trabajos` obtienes bonificaciones pasivas automáticas:
- **🪓 Leñador (Treecapitator):** Romper el bloque base de un árbol tala en cadena hasta 16 bloques de madera verticales de golpe.
- **🌾 Granjero (Auto-Replant):** Al cosechar trigo, zanahorias, papas o remolachas maduras, el cultivo se replanta automáticamente si llevas semillas en el inventario.
- **⛏️ Minero (Doble Mineral):** 25% de probabilidad de duplicar las menas naturales valiosas que piques.
- **📦 Cuota Diaria:** Completa 3 entregas de trabajo al día para recibir un bono de **$1,000 monedas extra**.

---

### 4. Misiones Comunitarias y Potenciadores Globales
- Al realizar objetivos en `/s:misiones` ganas dinero personal y aportas al medidor colectivo.
- Al alcanzar **30 misiones completadas entre todos los jugadores del servidor**, se activa automáticamente un **Booster Global de Trabajos** que otorga **+50% de ganancia en todos los empleos durante 30 minutos**.

---

### 5. Racha de Inicio de Sesión de 30 Días
- Entra cada día y escribe `/s:recompensas` para avanzar en tu racha diaria.
- Si dejas pasar más de 48 horas sin conectarte, la racha se reinicia.
- **Hitos destacados:**
  - **Día 7:** $5,000 + 1 Llave de Caja Común.
  - **Día 14:** $15,000 + 2 Llaves de Caja Rara.
  - **Día 21:** $30,000 + 3 Llaves de Caja Épica.
  - **Día 30:** **$50,000 + 1 Lingote de Netherite + 5 Llaves de Caja Legendaria**.

---

### 6. Escalafón de Rangos de Supervivencia (/s:rankup)
Asciende de rango escribiendo `/s:rankup` o `/s:ascender`:
1. 🔰 **Recluta:** Rango inicial para todo nuevo jugador.
2. 🏹 **Explorador:** Requiere **$5,000** y **2 horas de juego**.
3. 🛡️ **Veterano:** Requiere **$25,000** y **10 horas de juego**.
4. ⚔️ **Héroe:** Requiere **$75,000** y **24 horas de juego**.
5. 👑 **Leyenda:** Requiere **$200,000** y **50 horas de juego**.

El rango activo se muestra como un prefijo exclusivo de color antes de tu nombre en el chat del servidor.

---

### 7. Clanes y Niveles de Expansión
- Los clanes son 100% colaborativos: **el fuego amigo está permanentemente desactivado** para evitar incidentes.
- Puedes mejorar tu clan del Nivel 1 al Nivel 5 con `/s:clan mejorar`, pagando con fondos acumulados en el banco del clan:
  - **Nivel 1:** Capacidad de 8 miembros.
  - **Nivel 2 ($10,000 banco):** Capacidad de 12 miembros.
  - **Nivel 3 ($25,000 banco):** Capacidad de 16 miembros.
  - **Nivel 4 ($50,000 banco):** Capacidad de 20 miembros.
  - **Nivel 5 ($100,000 banco):** Capacidad de 24 miembros.

---

### 8. Comercio Seguro Mixto & Subastas Anti-Sniper
- **Comercio Cara a Cara (`/s:comerciar <jugador>`):**
  - Permite ofertar objetos de tu inventario e incluir dinero en la misma oferta.
  - Al aceptar ambos jugadores, se activa una **cuenta regresiva visual de 3 segundos** con sonido de aviso para garantizar que nadie cambie la oferta al último instante.
- **Casa de Subastas (`/s:subastas`):**
  - Si un jugador puja o interactúa con una subasta a la que le quedan menos de 60 segundos, el tiempo se extiende automáticamente **+60 segundos** para permitir contraofertas justas.

---

### 9. Apocalipsis Dinámico, Mini-Jefes y Caza
- El evento de invasión escala su vida y cantidad de engendros según el número de jugadores conectados (+12% por cada jugador).
- **Mini-Jefes especiales:**
  - Ola 3: **Titán Zombi** (fuerza y armadura aumentadas).
  - Ola 5: **Señor del Apocalipsis** (jefe final con ataques de velocidad).
- Al concluir el evento se proyecta la **Tabla de Cazadores**, premiando a los 3 mejores jugadores con más bajas registradas.

---

### 10. Casino Comunitario: Cara o Cruz y Blackjack 21
Accede con `/s:casino`:
- 🪙 **Cara o Cruz:** Selecciona Cara o Cruz, ingresa tu apuesta y prueba tu suerte. Probabilidades matemáticas del 50% con retorno del **2x (100% de ganancia)**.
- 🃏 **Blackjack 21:** Juega tus cartas contra el crupier de la casa:
  - Pide cartas (*Hit*) o plántate (*Stand*) buscando acercarte a 21 sin pasarte.
  - El crupier pide obligatoriamente hasta alcanzar 17.
  - El **Blackjack natural** (As + carta de valor 10) paga **2.5x**.

---

## 🛠️ Comandos de Moderación y Administración

Exclusivos para operadores y personal de Staff con permisos:

| Comando | Alias en Segundo Plano | Acción |
|---|---|---|
| `/s:congelar <jugador>` | `/s:freeze` | Inmoviliza totalmente al sospechoso (bloquea movimiento, minado, cofres e ítems) y le aplica ceguera. |
| `/s:vetar <jugador> [motivo]` | `/s:ban` | Prohíbe el acceso permanentemente al servidor. |
| `/s:desvetar <jugador>` | `/s:unban` | Levanta el veto de un jugador. |
| `/s:expulsar <jugador> [motivo]` | `/s:kick` | Desconecta al jugador de la partida. |
| `/s:silenciar <jugador> <duración> [motivo]` | `/s:mute` | Silencia a un jugador temporalmente en el chat. |
| `/s:dessilenciar <jugador>` | `/s:unmute` | Devuelve el permiso de hablar en el chat. |
| `/s:limpiar` | `/s:clearlag` | Limpia entidades e ítems en el suelo manualmente. |
| `/s:fijaraparicion` | `/s:setspawn` | Establece el punto de spawn general del servidor en tu posición actual. |
| `/s:fijardestino <nombre>` | `/s:setwarp` | Crea un destino público para jugadores. |
| `/s:borrardestino <nombre>` | `/s:delwarp` | Elimina un destino público existente. |
| `/s:adminproteger <nombre>` | `/s:adminclaim` | Crea una safezone administrativa indestructible. |
| `/s:admineliminar <nombre>` | `/s:admindelclaim` | Elimina una safezone administrativa. |
| `/s:iniciarhorda` | `/s:starthorde`, `/s:hordastart` | Fuerza el inicio del evento de invasión de monstruos. |
| `/s:iniciarfiebre` | `/s:fiebrestart` | Fuerza el inicio del evento de fiebre minera. |
| `/s:darllave <jugador> <tipo> [cant]` | `/s:givekey` | Entrega llaves de cajas de recompensas a un jugador. |
| `/s:varaauditoria` | `/s:auditstick` | Entrega la vara de inspección de colocación y rotura de bloques. |
