# 📚 Guía Técnica y Detallada de los 26 Addons - Pacífico BDS (1.26.x)

Esta guía explica a fondo y sin rodeos qué es cada addon, para qué sirve, cómo funciona internamente y cómo se usa tanto por jugadores normales como por administradores.

---

## 📑 Índice de Addons

| # | Addon | Área Principal |
|---|---|---|
| 1 | [core_commands_addon](#1-core_commands_addon---centro-de-control-y-menú-principal) | Navegación e Interfaz |
| 2 | [currency_addon](#2-currency_addon---economía-central-bancos-y-menas) | Macroeconomía |
| 3 | [home_spawn_addon](#3-home_spawn_addon---hogares-spawn-tpa-y-tumbas) | Transporte y Muerte |
| 4 | [protection_addon](#4-protection_addon---reclamos-bordes-de-partículas-y-banderas) | Protección de Bases |
| 5 | [trade_addon](#5-trade_addon---comercio-seguro-mixto-cara-a-cara) | Comercio P2P |
| 6 | [auction_house_addon](#6-auction_house_addon---casa-de-subastas-global-con-anti-sniper) | Mercado Global |
| 7 | [shop_addon](#7-shop_addon---tienda-con-precios-dinámicos-flotantes) | Tienda del Servidor |
| 8 | [jobs_addon](#8-jobs_addon---oficios-con-pasivas-en-el-mundo-y-cuotas) | Profesiones y Empleos |
| 9 | [quests_addon](#9-quests_addon---misiones-secundarias-y-meta-comunitaria) | Tareas y Retos |
| 10 | [ranks_addon](#10-ranks_addon---escalafón-de-supervivencia-y-prefijos) | Rangos de Juego |
| 11 | [rewards_addon](#11-rewards_addon---racha-de-30-días-de-inicio-de-sesión) | Premios Diarios |
| 12 | [clans_addon](#12-clans_addon---clanes-cooperativos-niveles-y-banco) | Facciones y Clanes |
| 13 | [newbie_addon](#13-newbie_addon---inmunidad-pvp-tutorial-y-rtp-seguro) | Onboarding de Novatos |
| 14 | [horde_event_addon](#14-horde_event_addon---invasión-adaptativa-y-mini-jefes) | Evento PVE |
| 15 | [casino_addon](#15-casino_addon---juegos-de-azar-blackjack-21-y-cara-o-cruz) | Minijuegos de Apuestas |
| 16 | [crates_addon](#16-crates_addon---cajas-de-recompensas-y-llaves) | Botín Misterioso |
| 17 | [warps_addon](#17-warps_addon---red-de-teletransporte-público) | Puntos de Interés |
| 18 | [server_boosters_addon](#18-server_boosters_addon---potenciadores-globales) | Multiplicadores de Servidor |
| 19 | [mining_fever_addon](#19-mining_fever_addon---evento-de-fiebre-minera) | Multiplicador de Minería |
| 20 | [blood_moon_addon](#20-blood_moon_addon---luna-de-sangre) | PVE Extremo |
| 21 | [camera_follower_addon](#21-camera_follower_addon---cámara-cinemática-espectadora) | Cinemáticas y Supervisión |
| 22 | [anticheat_addon](#22-anticheat_addon---anticheat-de-movimiento-y-combate) | Seguridad Anticheat |
| 23 | [antidupe_addon](#23-antidupe_addon---protección-anti-duplicación-de-ítems) | Integridad de Inventario |
| 24 | [fcx_limited_admin](#24-fcx_limited_admin---administración-segura-por-roles-y-token) | Control de Staff |
| 25 | [block_audit_addon](#25-block_audit_addon---auditoría-histórica-de-bloques) | Rollback e Inspección |
| 26 | [lag_cleaner_addon](#26-lag_cleaner_addon---optimizador-de-entidades-y-limpieza) | Rendimiento del Servidor |

---

### 1. `core_commands_addon` - Centro de Control y Menú Principal
* **¿Qué es?** Es el núcleo de interacción del servidor. Conecta todos los módulos en una interfaz gráfica intuitiva mediante formularios nativos de Bedrock (`server-ui`).
* **¿Para qué sirve?** Evita que los jugadores tengan que memorizar decenas de comandos. Con solo escribir `/s:menu`, tienen acceso a economía, viajes, clanes, protecciones, subastas y soporte con un clic.
* **Funcionamiento interno:** 
  * Expone un buscador predictivo (`ALL_COMMANDS`) que filtra comandos por palabras clave en español.
  * Implementa un sistema de reintento automático para apertura de formularios (`patchShow`) que evita el bug clásico de Bedrock donde la interfaz no abre si el jugador está corriendo o abriendo un cofre.
* **Comandos Principales:**
  * `/s:menu` (alias `/s:hub`): Abre el menú central.
  * `/s:ayuda` (alias `/s:help`): Muestra la lista de comandos ordenada por categoría.
  * `/s:guias`: Abre los tutoriales interactivos.
  * `/s:ping`: Muestra la latencia real entre el cliente y el servidor.

---

### 2. `currency_addon` - Economía Central, Bancos y Menas
* **¿Qué es?** El motor económico del servidor. Maneja el saldo monetario, cuentas de ahorro bancarias, préstamos con amortización automática e impuestos sobre transacciones.
* **¿Para qué sirve?** Crea una economía viva donde los jugadores tienen motivos para trabajar, comerciar y ahorrar, evitando la inflación descontrolada.
* **Funcionamiento interno:**
  * **Minado remunerado:** Escucha `playerBreakBlock`. Si el bloque roto es una mena natural generada por el mundo (carbón, hierro, oro, diamante, netherite), acredita dinero directamente al jugador. Si la mena fue colocada por un jugador o movida con pistones, el sistema lo detecta y **no paga** (anti-trampas de picar el mismo bloque en bucle).
  * **Banco General:** Los jugadores pueden depositar sus ahorros en `/s:banco` para ganar intereses pasivos por hora o solicitar préstamos calculados según su actividad.
* **Comandos Principales:**
  * `/s:dinero` o `/s:saldo` (alias `/s:money`, `/s:bal`): Consulta fondos.
  * `/s:pagar <jugador> <monto>` (alias `/s:pay`): Transfiere monedas a otro jugador.
  * `/s:banco` (alias `/s:bank`): Abre el panel bancario (ahorros, préstamos, alias CBU).

---

### 3. `home_spawn_addon` - Hogares, Spawn, TPA y Tumbas
* **¿Qué es?** El sistema de transporte personal y recuperación tras la muerte.
* **¿Para qué sirve?** Permite que los jugadores establezcan bases personales, viajen con amigos y recuperen sus pertenencias sin frustraciones al morir.
* **Funcionamiento interno:**
  * **Multi-Home:** Permite guardar hasta 5 hogares independientes por jugador (`casa 1` a `casa 5`).
  * **Tumbas protegidas:** Al morir un jugador, en lugar de desparramar sus ítems en el suelo donde pueden despawnearse o ser robados, genera una tumba física protegida con coordenadas guardadas en SQLite. El jugador puede usar `/s:tumbatp` para volver a un bloque seguro junto a su tumba.
* **Comandos Principales:**
  * `/s:guardarcasa [1-5]` (alias `/s:sethome`): Guarda tu posición actual como base.
  * `/s:casa [1-5]` (alias `/s:home`): Te teletransporta a tu base guardada.
  * `/s:aparicion` (alias `/s:spawn`): Viaja al spawn central del servidor.
  * `/s:pedirtp <jugador>` (alias `/s:tpa`): Pide teletransporte a un amigo.
  * `/s:tpaaceptar` / `/s:tparechazar`: Acepta o rechaza solicitudes de teletransporte.
  * `/s:tumba` y `/s:tumbatp`: Localiza y viaja a tu tumba activa.

---

### 4. `protection_addon` - Reclamos, Bordes de Partículas y Banderas
* **¿Qué es?** Sistema de protección de parcelas y reclamos contra robo, griefing y explosiones.
* **¿Para qué sirve?** Garantiza que las casas, cofres, cultivos y animales de los jugadores no puedan ser destruidos ni saqueados por personas no autorizadas.
* **Funcionamiento interno:**
  * **Fórmula de costo:** $\$2,000 + \$4$ por bloque horizontal reclamado (límite configurable hasta 100x100).
  * **Bordes con partículas (`/s:zona bordes`):** Genera un bucle de partículas esmeralda (`minecraft:villager_happy`) a lo largo de todo el perímetro de la parcela durante 60 segundos con expiración automática.
  * **Banderas de zona (`/s:zona banderas`):** Permite al dueño encender o apagar:
    * `mob_spawn`: Impide que aparezcan monstruos hostiles adentro.
    * `pvp`: Activa o desactiva el combate dentro de la casa.
    * `explosions`: Protege contra TNT y creepers.
    * `visitor_doors`: Permite que viajeros abran puertas sin darles permisos de romper bloques.
* **Comandos Principales:**
  * `/s:pos1` y `/s:pos2`: Marcan las dos esquinas opuestas del terreno.
  * `/s:proteger <nombre>` (alias `/s:claim`): Compra y registra la protección.
  * `/s:zona bordes`: Enciende o apaga el contorno de partículas verdes.
  * `/s:zona banderas`: Abre el menú para configurar las reglas de la parcela.
  * `/s:zona confiar <amigo>` / `/s:zona desconfiar <amigo>`: Administra permisos de amigos.
  * `/s:zonas`: Panel gráfico de todos tus terrenos.

---

### 5. `trade_addon` - Comercio Seguro Mixto Cara a Cara
* **¿Qué es?** Interfaz gráfica de intercambio seguro de ítems y dinero entre dos jugadores presentes.
* **¿Para qué sirve?** Elimina por completo las estafas (*scams*) al tirar ítems al suelo para comerciar.
* **Funcionamiento interno:**
  * **Intercambio mixto:** Soporta poner objetos del inventario y **añadir dinero simultáneamente** en la misma oferta.
  * **Cuenta regresiva de seguridad (3 segundos):** Cuando ambos jugadores aceptan el trato, el sistema no ejecuta el intercambio de inmediato: activa una cuenta regresiva de 3 segundos con sonidos de advertencia (`random.orb`). Si cualquiera de los dos jugadores modifica su oferta durante la cuenta, el intercambio se cancela al instante.
* **Comandos Principales:**
  * `/s:comerciar <jugador>` (alias `/s:trade`): Inicia la propuesta de intercambio.
  * `/s:aceptartrato` (alias `/s:tradeaccept`): Acepta el intercambio pendiente.
  * `/s:rechazartrato` (alias `/s:tradedeny`): Rechaza el intercambio.

---

### 6. `auction_house_addon` - Casa de Subastas Global con Anti-Sniper
* **¿Qué es?** Mercado público central donde cualquier jugador puede vender artículos a la comunidad aunque esté desconectado.
* **¿Para qué sirve?** Facilita el comercio asíncrono entre jugadores de distintos horarios.
* **Funcionamiento interno:**
  * Cuenta con un catálogo completo traducido al español con iconos nativos.
  * **Sistema Anti-Sniper:** Si un jugador puja o interactúa con una subasta a la que le quedan menos de 60 segundos de vigencia, el tiempo restante se incrementa automáticamente en **+60 segundos** para permitir una contraoferta justa.
* **Comandos Principales:**
  * `/s:subastas` (alias `/s:ah`): Abre el catálogo de subastas activas.
  * `/s:vender <precio>` (alias `/s:subastar`): Publica en el mercado el ítem sostenido en la mano.

---

### 7. `shop_addon` - Tienda con Precios Dinámicos Flotantes
* **¿Qué es?** La tienda oficial del servidor para compra y venta directa de materiales, bloques y herramientas.
* **¿Para qué sirve?** Ofrece un sumidero y fuente de recursos controlado por el servidor.
* **Funcionamiento interno:**
  * **Precios Flotantes Anti-Granjas AFK:** Si los jugadores venden masivamente miles de unidades del mismo producto (por ejemplo, bambú, caña de azúcar o hierro de granjas automáticas), el precio de compra del servidor disminuye gradualmente hasta un **piso de protección del 60%**.
  * Con el tiempo y la desaceleración de ventas, el mercado se recupera de forma automática al 100%, incentivando a los jugadores a diversificar sus granjas y explorar.
* **Comandos Principales:**
  * `/s:tienda` (alias `/s:shop`): Abre el catálogo interactivo de categorías.

---

### 8. `jobs_addon` - Oficios con Pasivas en el Mundo y Cuotas
* **¿Qué es?** Sistema de empleos y profesiones que remunera a los jugadores por realizar actividades de supervivencia.
* **¿Para qué sirve?** Otorga un incentivo económico continuo a la exploración, agricultura, minería y tala.
* **Funcionamiento interno:**
  * **Pasivas reales en el mundo:**
    * **Leñador (Treecapitator):** Romper el tronco base de un árbol tala en cadena hasta 16 bloques de madera verticales de una sola vez.
    * **Granjero (Auto-Replant):** Cosechar cultivos maduros replanta la semilla automáticamente si se lleva en el inventario.
    * **Minero (Doble Mineral):** 25% de probabilidad de duplicar menas naturales valiosas (hierro, oro, diamante, netherite).
  * **Cuotas Diarias:** Completar 3 entregas de trabajo al día otorga un bono extra de **$1,000 monedas**.
* **Comandos Principales:**
  * `/s:trabajos` (alias `/s:jobs`): Abre el panel para elegir profesión o entregar pedidos.

---

### 9. `quests_addon` - Misiones Secundarias y Meta Comunitaria
* **¿Qué es?** Sistema de tareas y objetivos individuales y globales.
* **¿Para qué sirve?** Da dirección y metas a corto plazo a los jugadores en su aventura.
* **Funcionamiento interno:**
  * Cada jugador tiene retos diarios (cazar monstruos, talar, pescar).
  * **Meta Colectiva:** Al alcanzar **30 misiones completadas entre todos los jugadores del servidor**, se activa de forma automática un **Booster Global de Trabajos** que otorga +50% de ganancia en todos los empleos a toda la comunidad durante 30 minutos.
* **Comandos Principales:**
  * `/s:misiones` (alias `/s:quests`): Consulta tus objetivos activos y el progreso de la meta comunitaria.

---

### 10. `ranks_addon` - Escalafón de Supervivencia y Prefijos
* **¿Qué es?** Sistema de rangos desbloqueables jugando y progresando en la economía del servidor.
* **¿Para qué sirve?** Otorga estatus visible y recompensas a los jugadores más constantes sin necesidad de dinero real (*Pay to Win*).
* **Funcionamiento interno:**
  * 5 rangos estructurados:
    * 🔰 **Recluta:** Rango inicial gratuito.
    * 🏹 **Explorador:** Requiere $5,000 y 2 horas de juego.
    * 🛡️ **Veterano:** Requiere $25,000 y 10 horas de juego.
    * ⚔️ **Héroe:** Requiere $75,000 y 24 horas de juego.
    * 👑 **Leyenda:** Requiere $200,000 y 50 horas de juego.
  * Inyecta el prefijo coloreado del rango directamente en los mensajes de chat de `beforeEvents.chatSend`.
* **Comandos Principales:**
  * `/s:rankup` o `/s:ascender` (alias `/s:rango`): Abre la interfaz para subir de rango.

---

### 11. `rewards_addon` - Racha de 30 Días de Inicio de Sesión
* **¿Qué es?** Sistema de recompensas diarias acumulativas por entrar al servidor.
* **¿Para qué sirve?** Fideliza a los jugadores premiando la constancia diaria.
* **Funcionamiento interno:**
  * Mantiene un contador en SQLite con la fecha del último cobro.
  * Si el jugador deja pasar más de 48 horas sin conectarse, la racha se reinicia al Día 1.
  * **Grandes hitos:**
    * Día 7: $5,000 + 1 Llave Común.
    * Día 14: $15,000 + 2 Llaves Raras.
    * Día 21: $30,000 + 3 Llaves Épicas.
    * Día 30: **$50,000 + 1 Lingote de Netherite + 5 Llaves Legendarias**.
* **Comandos Principales:**
  * `/s:recompensas` (alias `/s:rewards`): Reclama el premio de tu día activo.

---

### 12. `clans_addon` - Clanes Cooperativos, Niveles y Banco
* **¿Qué es?** Sistema de facciones y grupos comunitarios para jugar en equipo.
* **¿Para qué sirve?** Fomenta la construcción cooperativa y la convivencia entre grupos de amigos.
* **Funcionamiento interno:**
  * **Fuego amigo 100% bloqueado:** Los miembros de un clan nunca pueden dañarse entre sí, protegiendo construcciones compartidas.
  * **Niveles de Clan (1 al 5):** Sube de nivel con dinero acumulado en el banco del clan:
    * Nivel 1: 8 miembros.
    * Nivel 2 ($10,000): 12 miembros.
    * Nivel 3 ($25,000): 16 miembros.
    * Nivel 4 ($50,000): 20 miembros.
    * Nivel 5 ($100,000): 24 miembros.
* **Comandos Principales:**
  * `/s:clan crear <nombre>`: Funda un clan gratis.
  * `/s:clan invitar <jugador>` / `/s:clan unirse <nombre>`.
  * `/s:clan nivel` y `/s:clan mejorar`: Administra el nivel y capacidad del clan.
  * `/s:clan depositar <monto>` / `/s:clan retirar <monto>`.
  * `/s:c <mensaje>`: Chat privado exclusivo del clan.

---

### 13. `newbie_addon` - Inmunidad PvP, Tutorial y RTP Seguro
* **¿Qué es?** Módulo de experiencia de bienvenida (*New Player Experience*).
* **¿Para qué sirve?** Protege a los nuevos usuarios de ser cazados (*spawn killing*) y los guía paso a paso en sus primeros minutos.
* **Funcionamiento interno:**
  * **Inmunidad PvP de 30 minutos:** Impide que cualquier jugador ataque o sea atacado por el recién llegado.
  * **Tutorial guiado en actionbar:** 5 pasos secuenciales con sonidos que enseñan a usar `/s:rtp`, marcar con `/s:pos1`, proteger y guardar casa.
  * **RTP seguro:** Algoritmo que busca una posición con suelo sólido, sin lava, fuego ni caídas al vacío.
* **Comandos Principales:**
  * `/s:pvp`: Consulta los minutos restantes de inmunidad.
  * `/s:pvp activar`: Renuncia voluntariamente a la inmunidad para entrar a combatir.
  * `/s:rtp`: Teletransporte aleatorio seguro al mundo salvaje (10m cooldown).

---

### 14. `horde_event_addon` - Invasión Adaptativa y Mini-Jefes
* **¿Qué es?** Evento PVE de apocalipsis donde hordas de monstruos asedian a los jugadores.
* **¿Para qué sirve?** Actividad cooperativa de combate y obtención de botines valiosos.
* **Funcionamiento interno:**
  * **Dificultad adaptativa:** La cantidad y vida de los monstruos escala (+12%) por cada jugador conectado.
  * **Mini-Jefes:** En la Ola 3 aparece el **Titán Zombi** y en la Ola 5 el **Señor del Apocalipsis**.
  * **Tabla de Clasificación:** Al terminar el evento premia a los 3 mejores cazadores con dinero y objetos especiales.
* **Comandos Principales:**
  * `/s:iniciarhorda` (OP): Fuerza el inicio de la invasión.

---

### 15. `casino_addon` - Juegos de Azar (Blackjack 21 y Cara o Cruz)
* **¿Qué es?** Minijuegos de apuestas con probabilidades matemáticas reales integradas a la economía.
* **¿Para qué sirve?** Entretenimiento opcional para jugadores con excedentes de dinero.
* **Funcionamiento interno:**
  * 🪙 **Cara o Cruz:** 50% de probabilidad exacta con duplicación de apuesta (pago 2x).
  * 🃏 **Blackjack 21:** Juega contra la casa. Incluye reglas de crupier (pide carta hasta 17) y pago 2.5x por Blackjack natural.
  * 🎡 **Ruleta y Tragamonedas (Slots):** Multiplicadores clásicos de feria.
* **Comandos Principales:**
  * `/s:casino` (alias `/s:gamble`): Abre el menú interactivo de juegos.

---

### 16. `crates_addon` - Cajas de Recompensas y Llaves
* **¿Qué es?** Sistema de cofres de botín que se abren con llaves especiales obtenidas en misiones, rachas o eventos.
* **¿Para qué sirve?** Entrega equipamiento y recursos cosméticos o avanzados de forma emocionante.
* **Funcionamiento interno:**
  * Los bloques de caja se fijan en el spawn con `/s:fijarcaja`. Al hacer clic con la llave adecuada, genera partículas y entrega un premio aleatorio ponderado.
* **Comandos Principales:**
  * `/s:cajas` (alias `/s:crates`): Abre la interfaz informativa de cajas.
  * `/s:darllave <jugador> <tipo>` (OP): Entrega llaves a un jugador.

---

### 17. `warps_addon` - Red de Teletransporte Público
* **¿Qué es?** Sistema de puntos de interés públicos configurados por la administración.
* **¿Para qué sirve?** Permite que los jugadores viajen a zonas comunes como la Tienda Central, el Coliseo de Duelos, la Mina Pública o las Granjas Comunitarias.
* **Comandos Principales:**
  * `/s:destinos` (alias `/s:warps`): Abre la lista de destinos públicos.
  * `/s:fijardestino <nombre>` / `/s:borrardestino <nombre>` (OP): Administra los destinos.

---

### 18. `server_boosters_addon` - Potenciadores Globales
* **¿Qué es?** Multiplicadores de ganancias globales que benefician a todo el servidor durante un tiempo determinado.
* **¿Para qué sirve?** Recompensa el esfuerzo comunitario cuando se alcanzan metas colectivas.
* **Comandos Principales:**
  * `/s:potenciadores` (alias `/s:boosters`): Consulta qué multiplicadores están activos.

---

### 19. `mining_fever_addon` - Evento de Fiebre Minera
* **¿Qué es?** Evento temporal que se activa periódicamente o por comando.
* **¿Para qué sirve?** Multiplica las ganancias de todas las menas picadas en cavernas durante el tiempo del evento, animando a la comunidad a bajar a minar juntos.
* **Comandos Principales:**
  * `/s:iniciarfiebre` (OP): Activa la Fiebre Minera manualmente.

---

### 20. `blood_moon_addon` - Luna de Sangre
* **¿Qué es?** Fenómeno nocturno donde el cielo se tiñe de rojo y los monstruos aumentan su agresividad, velocidad y probabilidad de llevar armaduras.
* **¿Para qué sirve?** Desafío de supervivencia extremo con mayor tasa de aparición de objetos raros.

---

### 21. `camera_follower_addon` - Cámara Cinemática Espectadora
* **¿Qué es?** Herramienta de visualización cinemática que coloca al usuario en modo espectador con seguimiento suave de objetivos.
* **¿Para qué sirve?** Ideal para creadores de contenido, streamers, eventos del servidor y supervisión sigilosa de sospechosos por parte del staff.
* **Comandos Principales:**
  * `/s:camara` (alias `/s:camera`): Alterna el modo de cámara.

---

### 22. `anticheat_addon` - Anticheat de Movimiento y Combate
* **¿Qué es?** Sistema de vigilancia en segundo plano contra clientes modificados y trampas.
* **¿Para qué sirve?** Protege la justicia del juego detectando vuelo, velocidad anormal, killaura, alcance excesivo y auto-armor.
* **Funcionamiento interno:**
  * Analiza vectores de movimiento y rotación de cámara.
  * Cuando la sospecha supera el **80%**, genera una alerta auditiva (`note.pling`) en tiempo real en la pantalla de todos los moderadores conectados con un botón para congelar al sospechoso.

---

### 23. `antidupe_addon` - Protección Anti-Duplicación de Ítems
* **¿Qué es?** Blindaje contra bugs conocidos de clonación de objetos en Bedrock.
* **¿Para qué sirve?** Evita que jugadores malintencionados dupliquen diamantes, shulkers o netherite forzando cierres de inventario o desincronización de paquetes.
* **Funcionamiento interno:**
  * Rastrea aperturas de inventarios técnicos y bloquea soltadores con timers rápidos que intenten sobrecargar el tick de guardado.

---

### 24. `fcx_limited_admin` - Administración Segura por Roles y Token
* **¿Qué es?** Sistema de seguridad administrativa y control de staff con privilegios estrictamente limitados.
* **¿Para qué sirve?** Elimina los peligros del comando `/op`, obligando a que el Dueño (Owner) se vincule con un **Token Criptográfico Único** y limitando los tiempos máximos de castigo para que ningún moderador pueda abusar.
* **Comandos Principales:**
  * `/s:admin enroll-owner <token>`: Vincula al Dueño único del servidor.
  * `/s:admin`: Abre el panel interactivo de moderación.
  * `/s:roles add <jugador> <ROL>`: Asigna rangos de staff (`MODERATOR`, `SHERIFF`, etc.).
  * `/s:congelar <jugador>` (alias `/s:freeze`): Congela e inmoviliza a un jugador.
  * `/s:lockdown [on/off]`: Activa o desactiva el bloqueo de emergencia del servidor.
  *(Consulta [docs/GUIA_ADMINISTRACION_Y_ROLES.md](docs/GUIA_ADMINISTRACION_Y_ROLES.md) para la guía completa paso a paso).*

---

### 25. `block_audit_addon` - Auditoría Histórica de Bloques
* **¿Qué es?** Registro forense de colocación y rotura de bloques.
* **¿Para qué sirve?** Permite saber quién colocó o rompió un bloque específico en cualquier coordenada del mundo.
* **Funcionamiento interno:**
  * Registra las interacciones en SQLite sin afectar el rendimiento.
  * Con la **Vara de Inspección** (`/s:varaauditoria`), un moderador hace clic en un bloque para ver en el chat quién lo modificó, la fecha exacta y la hora.
* **Comandos Principales:**
  * `/s:varaauditoria`: Entrega la herramienta de inspección forense.

---

### 26. `lag_cleaner_addon` - Optimizador de Entidades y Limpieza
* **¿Qué es?** Gestor automático de recolección de basura del servidor.
* **¿Para qué sirve?** Mantiene el servidor en 20 TPS eliminando ítems flotantes desatendidos, flechas y monstruos acumulados en zonas despobladas.
* **Comandos Principales:**
  * `/s:limpiar`: Ejecuta una limpieza manual inmediata anunciando en el chat los ítems removidos.
