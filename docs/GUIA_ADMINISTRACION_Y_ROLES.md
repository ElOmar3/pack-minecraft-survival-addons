# 🛡️ Guía de Administración Segura y Sistema de Roles - FCX Limited Admin

En la mayoría de los servidores de Minecraft Bedrock, la administración se basa únicamente en el comando `/op`. Sin embargo, **el sistema `/op` nativo es sumamente peligroso para servidores públicos**: cualquier moderador con OP puede destruir construcciones con `/fill`, duplicar ítems con `/give`, banear a todos los jugadores en segundos si su cuenta es comprometida, o robar inventarios.

Para solucionar esto de raíz, el addon **`fcx_limited_admin`** implementa una arquitectura de seguridad basada en **roles con privilegios limitados, límites de castigo automáticos, detección de anomalías y enrolamiento mediante token criptográfico único**.

---

## 🔐 1. ¿Por qué se requiere un Token Único para Enrolar al Dueño (OWNER)?

A diferencia de los comandos tradicionales donde cualquiera que tenga acceso momentáneo a la consola puede darse rango, `fcx_limited_admin` requiere que el Dueño (Owner) demuestre posesión de un **token secreto generado fuera de Minecraft BDS**:

1. **Prevención de Suplantación de Identidad:** Aunque alguien consiguiese ingresar con el nombre del dueño o ganar permisos de operador accidentalmente, no podrá acceder a las funciones críticas de administración sin el token.
2. **Cierre de Brechas:** Solo puede existir **un único OWNER** en el sistema. Una vez enrolado, el registro se sella criptográficamente.
3. **Expiración de Seguridad:** Cada token tiene una vigencia temporal (por defecto 48 horas). Una vez utilizado para vincular tu jugador, el token queda invalidado de por vida y no puede reutilizarse.

---

## 🚀 2. Paso a Paso: Cómo Enrolarte como Dueño (OWNER)

Sigue estos pasos sencillos para tomar el control administrativo de tu servidor:

### Paso 1: Generar tu Token Único en la Terminal
En la carpeta de tu servidor o proyecto (en tu PC o VPS), ejecuta el siguiente comando:

```bash
node tools/generate_admin_token.js
```

La consola generará una clave única alfanumérica y te mostrará un mensaje similar a este:
```text
=================================================================
   🔑 TOKEN DE ENROLAMIENTO DE OWNER GENERADO CON ÉXITO        
=================================================================
Tu token único de seguridad es:
fcx_204430601782222709c817ab8dacdf8e

Vigencia: 48 horas
Archivo actualizado: behavior_packs/fcx_limited_admin/scripts/config/OwnerProvisioning.js
```

### Paso 2: Darse Operador Inicial en la Consola BDS
1. Inicia tu servidor con `./start-server.sh` (o `start-server.bat`). Si ya está encendido, escribe `reload` en la consola.
2. En la consola de BDS, escribe:
   ```text
   op TuNombreEnMinecraft
   ```

### Paso 3: Enrolarte dentro del Juego
Entra a tu servidor de Minecraft con tu cuenta y escribe en el chat:

```text
/s:admin enroll-owner fcx_tu_token_aqui
```
*(Reemplaza `fcx_tu_token_aqui` por el token que te dio el script en el Paso 1)*.

Recibirás un mensaje de confirmación:
> `§a[FCX Admin] OWNER registrado con éxito; tu identidad ha sido vinculada.`

### Paso 4: Desactivar el Bloqueo de Seguridad Inicial (Lockdown)
Por seguridad, el sistema inicia en modo de bloqueo preventivo (*Lockdown*). Para habilitar las operaciones de juego y administración normalmente, escribe en el chat:

```text
/s:lockdown off
```
*(O también: `/s:bloqueototal off`)*.

### Paso 5: Abrir el Panel Gráfico de Control
Escribe:
```text
/s:admin
```
*(O también `/s:admin panel`)*. Se abrirá la interfaz interactiva para moderar, auditar y supervisar a los jugadores.

---

## 👥 3. Jerarquía de Roles y Límites de Castigo

Una vez registrado como **OWNER**, puedes nombrar a miembros de tu equipo con roles específicos. Cada rol tiene límites máximos estrictos programados que **impiden abusos de poder**:

| Rol | Función Principal | Silenciamiento Máximo (Mute) | Baneo Temporal Máximo | Congelamiento (/s:congelar) |
|---|---|---|---|---|
| **`OWNER`** | Dueño absoluto del servidor | Hasta 90 días | Hasta 90 días | Hasta 2 horas |
| **`SECURITY_ADMIN`** | Jefe de seguridad / Administrador | Hasta 30 días | Hasta 30 días | Hasta 1 hora |
| **`MODERATOR`** | Moderador regular de la comunidad | Hasta 24 horas | Hasta 7 días | Hasta 30 minutos |
| **`SHERIFF`** | Vigilante / Policía comunitario | Sin permiso de mute | Hasta 3 días | Hasta 30 minutos |
| **`SUPPORT`** | Asistente de soporte al jugador | 0 (Solo consultas y ayuda) | 0 | 0 |
| **`AUDITOR`** | Auditor de registros e inspección | 0 (Solo lectura de logs) | 0 | 0 |

---

## 🛡️ 4. Gestión de Roles: Asignar y Revocar Staff

### Asignar un rol a un miembro del equipo:
```text
/s:roles add <Jugador> <ROL>
```
*Ejemplos:*
* `/s:roles add Juanito MODERATOR`
* `/s:roles add Pedro SECURITY_ADMIN`
* `/s:roles add Maria SHERIFF`

### Quitar un rol a un miembro del staff:
```text
/s:roles remove <Jugador> <ROL>
```

### Consultar los roles de un jugador:
```text
/s:roles view <Jugador>
```

---

## ⚠️ 5. Mecanismos de Seguridad Automáticos

1. **Detección de Anomalías (Anti-Rogue Staff):**
   * Si una cuenta de moderador sanciona a más de **8 jugadores distintos en menos de 10 minutos**, el sistema asume que la cuenta fue hackeada o el staff perdió el control.
   * **Acción automática:** El sistema suspende inmediatamente al moderador durante 30 minutos, revoca sus permisos y envía una alerta en la consola y al chat del Owner.
2. **Límites de Tasa (Rate Limits):**
   * Impide el spam de comandos administrativos (máximo 5 mutes o 3 tempbans por ventana de 10 minutos por moderador).
3. **Congelamiento Estricto (`/s:congelar <jugador>`):**
   * Inmoviliza de inmediato a un sospechoso mientras es investigado: bloquea su movimiento, rotura de bloques, apertura de cofres, uso de ítems y chat, aplicando ceguera temporal.
4. **Diario de Auditoría Inmutable:**
   * Toda acción administrativa (quién sancionó, a quién, motivo, fecha y coordenadas) se registra en un diario protegido que ni los administradores pueden borrar desde el juego.
