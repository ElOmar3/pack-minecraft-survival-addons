# Paquete Completo de Addons para Minecraft Bedrock Dedicated Server (BDS)

Este paquete contiene todos los **26 addons (Behavior Packs)** listados y probados en el servidor, junto con sus archivos de activación, configuración y un instalador automatizado para desplegarlos fácilmente en otra VPS.

---

## 📦 Contenido del Paquete

| Directorio / Archivo | Descripción |
|---|---|
| `behavior_packs/` | Las 26 carpetas con el código fuente y manifiestos de cada addon. |
| `world_config/` | `world_behavior_packs.json` con el orden exacto de carga y `world_resource_packs.json`. |
| `mcpacks/` | Todos los addons empaquetados individualmente en formato `.mcpack`. |
| `tools/` | Scripts de utilidad (ej. generador de catálogo español para subastas). |
| `sources/` | Archivo de traducción `es_MX.lang`. |
| `install.sh` | Script instalador automatizado para la nueva VPS. |
| `manifest_addons.json` | Metadatos completos de UUIDs, versiones y orden de carga. |

---

## 🧩 Lista de los 26 Addons Incluidos

1. **`core_commands_addon`**: Comandos esenciales del servidor (/spawn, /tpa, utilidades).
2. **`currency_addon`**: Sistema de economía y balance virtual.
3. **`warps_addon`**: Teletransporte y puntos de interés públicos.
4. **`shop_addon`**: Tienda con interfaz gráfica (UI).
5. **`ranks_addon`**: Rangos, títulos y prefijos de jugadores.
6. **`quests_addon`**: Sistema de misiones secundarias y tareas.
7. **`rewards_addon`**: Recompensas diarias y kits periódicos.
8. **`camera_follower_addon`**: Herramienta de cinemáticas y cámara para moderación/eventos.
9. **`casino_addon`**: Minijuegos de apuestas con economía integrada.
10. **`auction_house_addon`**: Casa de subastas entre jugadores con soporte para nombres en español.
11. **`crates_addon`**: Cajas de recompensa / llaves de botín.
12. **`horde_event_addon`**: Eventos automáticos de invasión y oleadas de monstruos.
13. **`lag_cleaner_addon`**: Limpieza de entidades e items en el suelo para optimizar rendimiento.
14. **`mining_fever_addon`**: Evento de fiebre minera con multiplicadores y buffs temporales.
15. **`trade_addon`**: Intercambio seguro de objetos entre jugadores vía interfaz UI.
16. **`home_spawn_addon`**: Sistema de hogares personales (`/sethome`, `/home`) y spawn.
17. **`clans_addon`**: Sistema de clanes/facciones, miembros y alianzas.
18. **`protection_addon`**: Protección de parcelas, zonas y reclamos contra griefing.
19. **`jobs_addon`**: Trabajos y profesiones con recompensas por actividad.
20. **`blood_moon_addon`**: Evento nocturno de Luna de Sangre con dificultad aumentada y recompensas.
21. **`newbie_addon`**: Guía y kit de bienvenida para nuevos jugadores.
22. **`anticheat_addon`**: Sistema de detección anticheat de movimiento, combate e inventario.
23. **`antidupe_addon`**: Protección contra duplicación de items y desincronización de paquetes.
24. **`fcx_limited_admin`**: Sistema de roles administrativos y auditoría de comandos segura.
25. **`block_audit_addon`**: Registro y auditoría de colocación y rotura de bloques.
26. **`server_boosters_addon`**: Mejoras, boosters globales y perks del servidor.

---

## 🚀 Guía de Despliegue en la Nueva VPS

### Paso 1: Subir el archivo a la nueva VPS
Desde tu terminal o cliente SFTP/FileZilla:

```bash
# Ejemplo con SCP:
scp addons_bds_pacifico_completo.tar.gz usuario@IP_NUEVA_VPS:/home/usuario/
```

### Paso 2: Extraer el paquete en la nueva VPS
Conéctate por SSH a la nueva VPS y ejecuta:

```bash
cd /home/usuario/
mkdir -p addons_export
tar -xzf addons_bds_pacifico_completo.tar.gz -C addons_export/
cd addons_export/
```
*(Si usas el archivo `.zip`, descomprímelo con `unzip addons_bds_pacifico_completo.zip -d addons_export/`)*

### Paso 3: Ejecutar el instalador automático
Ejecuta:

```bash
./install.sh /ruta/a/tu/minecraft-server
```
*Si no especificas la ruta, el instalador te la solicitará interactivamente.*

### Paso 4: Ajustes recomendados en `server.properties`
Asegúrate de que en el archivo `server.properties` de tu servidor BDS tengas:

```properties
allow-cheats=true
content-log-file-enabled=true
content-log-console-output-enabled=true
```

### Paso 5: Iniciar / Recargar el servidor
- Si el servidor ya está ejecutándose, escribe en la consola:
  ```text
  reload
  ```
- Si está apagado, inícialo normalmente:
  ```bash
  LD_LIBRARY_PATH=. ./bedrock_server
  ```

¡Listo! Todos los addons se cargarán en el orden preconfigurado.
