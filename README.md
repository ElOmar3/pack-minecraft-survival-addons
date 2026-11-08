# 🎮 Paquete Completo de Addons para Minecraft Bedrock Dedicated Server (BDS 1.26.x)

Este repositorio contiene la suite completa de **26 Behavior Packs** actualizada, optimizada y normalizada al **español neutro / mexicano** para servidores dedicados de Minecraft Bedrock (**BDS 1.26.x**).

Incluye sistemas avanzados de economía, protección con partículas y banderas, comercio mixto anti-estafas, trabajos con habilidades pasivas, misiones cooperativas, clanes con niveles, tienda con precios dinámicos flotantes, racha de 30 días de recompensas, escalafón de supervivencia con rangos y un anticheat con congelamiento estricto.

---

## 📚 Documentación y Guías Disponibles

- 📖 **[Guía Maestra de Jugadores y Comandos (GUIA_JUGADORES.md)](GUIA_JUGADORES.md):** Manual completo para jugadores y moderadores con la descripción de cada addon, guía de onboarding para nuevos usuarios, mecánicas avanzadas y tabla detallada de comandos en español.
- 🛡️ **[Sistema de Persistencia SQLite V3 (docs/SISTEMA_PERSISTENCIA_SQLITE.md)](docs/SISTEMA_PERSISTENCIA_SQLITE.md):** Arquitectura técnica del puente SQLite en modo WAL, prevención de corrupción de LevelDB, respaldos automáticos y guía de restauración.

---

## 📦 Estructura del Proyecto

| Carpeta / Archivo | Descripción |
|---|---|
| `behavior_packs/` | Código fuente modular de los 26 addons en JavaScript moderno (ES Modules). |
| `mcpacks/` | Los 26 addons listos para producción compilados individualmente en formato `.mcpack`. |
| `bridge/` | Demonio supervisor en Node.js y motor de persistencia SQLite V3 con modo WAL. |
| `world_config/` | Archivos `world_behavior_packs.json` y `world_resource_packs.json` con el orden exacto de carga. |
| `tools/` | Utilidades y scripts de empaquetado y validación de sintaxis (`build-mcpacks.js`). |
| `sources/` | Traducción y localización `es_MX.lang`. |
| `manifest_addons.json` | Registro de UUIDs, versiones y dependencias de la suite. |
| `install.sh` | Script instalador automatizado para servidores Linux / VPS. |
| `start-server.sh` | Lanzador supervisado para Linux / VPS con protección SQLite activa. |
| `start-server.bat` | Lanzador supervisado para Windows con protección SQLite activa. |
| `GUIA_JUGADORES.md` | Guía detallada para la comunidad y jugadores del servidor. |

---

## 🧩 Los 26 Addons Incluidos y Novedades

1. **`core_commands_addon`**: Menú gráfico interactivo (`/s:menu`), buscador integrado de comandos, guías y utilidades base.
2. **`currency_addon`**: Economía monetaria central, transferencias (`/s:pagar`), banco (`/s:banco`) y pagos directos por picar menas naturales.
3. **`home_spawn_addon`**: Hasta 5 hogares personales (`/s:guardarcasa`, `/s:casa`), spawn central (`/s:aparicion`), TPA y tumbas seguras (`/s:tumbatp`).
4. **`protection_addon`**: Reclamo de parcelas (`/s:proteger`), visualización de límites con partículas esmeralda (`/s:zona bordes`) y banderas configurables de PvP, monstruos, explosiones y puertas (`/s:zona banderas`).
5. **`trade_addon`**: Intercambio seguro cara a cara con soporte mixto (objetos + dinero en una sola oferta) y cuenta regresiva de 3 segundos anti-estafas.
6. **`auction_house_addon`**: Mercado global de subastas (`/s:subastas`, `/s:vender`) con catálogo en español y protección anti-sniper (+60s por interacción al expirar).
7. **`shop_addon`**: Tienda oficial (`/s:tienda`) con precios dinámicos flotantes que protegen la economía contra la venta masiva de granjas AFK.
8. **`jobs_addon`**: Empleos con pasivas en el mundo (Leñador Treecapitator de hasta 16 troncos, Granjero auto-replantado y Minero duplicador de menas) más cuotas diarias de $1,000 extra.
9. **`quests_addon`**: Misiones secundarias (`/s:misiones`) con meta comunitaria: 30 misiones globales activan un Booster Global de Trabajos (+50% ganancia por 30m).
10. **`ranks_addon`**: Escalafón de supervivencia (`/s:rankup`): 5 rangos progresivos (Recluta, Explorador, Veterano, Héroe y Leyenda) por tiempo jugado y dinero, con prefijo visible en el chat.
11. **`rewards_addon`**: Racha de 30 días de conexión continua (`/s:recompensas`) con jackpot acumulado de dinero, lingotes de Netherite y llaves.
12. **`clans_addon`**: Clanes comunitarios (`/s:clan crear`), niveles de clan (1 al 5) para expandir capacidad hasta 24 miembros, banco de clan y fuego amigo permanentemente bloqueado.
13. **`newbie_addon`**: Inmunidad PvP de 30 minutos al ingresar por primera vez (`/s:pvp`), tutorial guiado en actionbar y teletransporte seguro aleatorio (`/s:rtp`).
14. **`horde_event_addon`**: Invasión adaptativa (`/s:iniciarhorda`): escala vida y hostiles según los jugadores conectados (+12%), mini-jefes (Titán Zombi y Señor del Apocalipsis) y tabla de líderes para el Top 3.
15. **`casino_addon`**: Minijuegos de azar (`/s:casino`): Cara o Cruz (probabilidades 50/50, pago 2x), Blackjack 21 (pago 2.5x por 21 natural), Ruleta y Tragamonedas.
16. **`crates_addon`**: Cajas de recompensas misteriosas con llaves (`/s:cajas`).
17. **`warps_addon`**: Puntos de teletransporte públicos (`/s:destinos`).
18. **`server_boosters_addon`**: Potenciadores de economía y minería globales temporales (`/s:potenciadores`).
19. **`mining_fever_addon`**: Evento de fiebre minera con multiplicadores al picar en cavernas.
20. **`blood_moon_addon`**: Evento de Luna de Sangre con dificultad extrema y botines exclusivos.
21. **`camera_follower_addon`**: Cinemáticas y cámara espectadora (`/s:camara`).
22. **`anticheat_addon`**: Detección de combate, velocidad y vuelo en tiempo real; alerta automática al Staff ante sospechas $\ge 80\%$.
23. **`antidupe_addon`**: Protección activa contra bugs de clonación de objetos y desincronización de paquetes.
24. **`fcx_limited_admin`**: Sistema seguro de moderación con congelamiento total (`/s:congelar`), silenciamiento y veto.
25. **`block_audit_addon`**: Registro histórico de colocación y rotura de bloques (`/s:varaauditoria`).
26. **`lag_cleaner_addon`**: Limpieza periódica y manual de ítems en el suelo (`/s:limpiar`).

---

## ⚡ Comandos Rápidos del Servidor

| Acción | Comando Principal (Español MX) | Alias en Segundo Plano |
|---|---|---|
| **Menú Principal** | `/s:menu` | `/s:hub` |
| **Ayuda General** | `/s:ayuda` | `/s:help` |
| **Guías Visuales** | `/s:guias` | `/s:guides` |
| **Ir a Base** | `/s:casa [1-5]` | `/s:home [1-5]` |
| **Guardar Base** | `/s:guardarcasa [1-5]` | `/s:sethome [1-5]` |
| **Spawn Central** | `/s:aparicion` | `/s:spawn` |
| **Destinos Públicos**| `/s:destinos` | `/s:warps` |
| **Pedir Teletransporte**| `/s:pedirtp <jugador>` | `/s:tpa <jugador>` |
| **Aceptar TP** | `/s:tpaaceptar` | `/s:tpaccept` |
| **Teletransporte Salvaje**| `/s:rtp` | `/s:wild` |
| **Ver Saldo** | `/s:dinero` / `/s:saldo` | `/s:money`, `/s:bal` |
| **Pagar Monedas** | `/s:pagar <jugador> <monto>` | `/s:pay` |
| **Tienda Oficial** | `/s:tienda` | `/s:shop` |
| **Banco General** | `/s:banco` | `/s:bank` |
| **Casa de Subastas**| `/s:subastas` | `/s:ah` |
| **Vender en Mano** | `/s:vender <precio>` | `/s:subastar` |
| **Comerciar Seguro**| `/s:comerciar <jugador>` | `/s:trade` |
| **Proteger Terreno**| `/s:proteger <nombre>` | `/s:claim` |
| **Bordes de Terreno**| `/s:zona bordes` | `/s:claim borders` |
| **Banderas de Terreno**| `/s:zona banderas` | `/s:claim flags` |
| **Trabajos** | `/s:trabajos` | `/s:jobs` |
| **Misiones** | `/s:misiones` | `/s:quests` |
| **Ascender Rango** | `/s:rankup` / `/s:ascender` | `/s:rango` |
| **Racha Diaria** | `/s:recompensas` | `/s:rewards` |
| **Clanes** | `/s:clan crear <nombre>` | `/s:clan create` |
| **Nivel de Clan** | `/s:clan nivel` / `/s:clan mejorar` | `/s:clan upgrade` |
| **Duelo 1v1** | `/s:duelo <jugador>` | `/s:duel` |
| **Inmunidad Novato**| `/s:pvp [activar]` | `/s:pvp on` |
| **Casino** | `/s:casino` | `/s:gamble` |
| **Congelar Sospechoso**| `/s:congelar <jugador>` | `/s:freeze` |

*Para la lista completa de comandos y explicaciones detalladas, consulta [GUIA_JUGADORES.md](GUIA_JUGADORES.md).*

---

## 🚀 Despliegue en Servidor BDS

### Requisitos
- **Minecraft Bedrock Dedicated Server (BDS):** Versión 1.26.x (`1.26.60.0` o superior).
- Módulos de Script API habilitados:
  - `@minecraft/server: "2.11.0"`
  - `@minecraft/server-ui: "2.3.0"`

### Pasos de Instalación
1. **Detén tu servidor BDS.**
2. Copia los paquetes listos para usar desde la carpeta `mcpacks/` o las 26 carpetas de `behavior_packs/` a la carpeta `behavior_packs/` de tu servidor BDS.
3. Asegúrate de incluir la configuración de orden de carga de `world_config/world_behavior_packs.json` en la carpeta de tu mundo (`worlds/<nombre_mundo>/world_behavior_packs.json`).
4. Configura en tu archivo `server.properties`:
   ```properties
   allow-cheats=true
   content-log-file-enabled=true
   content-log-console-output-enabled=true
   ```
5. Inicia el servidor con el supervisor SQLite (recomendado para cero pérdida de datos):
   - **En Linux / VPS:**
     ```bash
     ./start-server.sh
     ```
   - **En Windows:**
     Ejecuta `start-server.bat` haciendo doble clic o desde PowerShell.

6. Si actualizas con el servidor encendido, escribe en la consola de comandos de BDS:
   ```text
   reload
   ```

Toda la base de datos persistente se conservará en `data/pacifico_server.db` en modo WAL y se sincronizará de forma transparente mediante el puente SQLite (`[SQLITE_SAVE_V1]`). Consulta la documentación técnica en [docs/SISTEMA_PERSISTENCIA_SQLITE.md](docs/SISTEMA_PERSISTENCIA_SQLITE.md).
