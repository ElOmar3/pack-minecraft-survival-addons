/**
 * ==============================================================================
 * PACÍFICO BDS - DEMONIO HOST PUENTE SQLITE V3 (SERVIDOR / VPS)
 * ==============================================================================
 * Este proceso envuelve y supervisa el ejecutable Bedrock Dedicated Server (BDS),
 * intercepta las solicitudes de persistencia de los 26 addons en tiempo real y
 * mantiene una base de datos física SQLite en modo WAL totalmente a salvo de caídas.
 *
 * Uso:
 *   node bridge/sqlite-daemon.js
 *   node bridge/sqlite-daemon.js --bds-path /ruta/a/bedrock_server
 * ==============================================================================
 */

const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');
const { AddonDatabase } = require('./database.js');

// === CONFIGURACIÓN Y PARÁMETROS ===
const ARGS = process.argv.slice(2);

function getArg(name, defaultValue) {
  const index = ARGS.indexOf(name);
  if (index !== -1 && ARGS[index + 1]) return ARGS[index + 1];
  return defaultValue;
}

const isPipeMode = ARGS.includes('--pipe') || process.env.BDS_PIPE_MODE === '1';
const autoRestart = ARGS.includes('--auto-restart') || process.env.BDS_AUTO_RESTART === '1';
const customBdsPath = getArg('--bds-path', process.env.BDS_PATH || process.cwd());
const customDbPath = getArg('--db-path', process.env.SQLITE_DB_PATH || path.join(customBdsPath, 'data', 'pacifico_server.db'));
const backupDir = path.join(path.dirname(customDbPath), '..', 'backups', 'sqlite');

console.log("=================================================================");
console.log("   PACÍFICO BDS - SERVICIO PUENTE SQLITE HOST V3               ");
console.log("   Protección activa contra corrupción de mundos y reinicios    ");
console.log("=================================================================");

// Lista blanca de namespaces válidos: bloquea escrituras/inyecciones hacia addons inexistentes.
const KNOWN_ADDONS = new Set([
  'anticheat_addon', 'antidupe_addon', 'auction_house_addon', 'block_audit_addon',
  'blood_moon_addon', 'camera_follower_addon', 'casino_addon', 'clans_addon',
  'core_commands_addon', 'crates_addon', 'currency_addon', 'fcx_limited_admin',
  'home_spawn_addon', 'horde_event_addon', 'jobs_addon', 'lag_cleaner_addon',
  'mining_fever_addon', 'newbie_addon', 'protection_addon', 'quests_addon',
  'ranks_addon', 'rewards_addon', 'server_boosters_addon', 'shop_addon',
  'trade_addon', 'warps_addon'
]);

// El slice debe dejar margen para el escapado JSON y la cabecera del comando:
// un slice de 800 caracteres puede superar los 2000 del buffer scriptevent.
const CHUNK_SIZE = 600;
const DIRECT_SEND_LIMIT = 600;

// La instancia se recrea en cada arranque de BDS: con --auto-restart reutilizar
// una BD cerrada (closed=true) descartaba todas las escrituras en silencio.
let db = null;
function openDatabase() {
  if (db) { try { db.close(); } catch (e) {} }
  db = new AddonDatabase({ dbPath: customDbPath });
}

// Estadísticas en vivo
const stats = {
  savesProcessed: 0,
  syncsHandled: 0,
  chunksSent: 0,
  startTime: Date.now()
};

/**
 * Responde a la solicitud [SQLITE_REQUEST_SYNC] enviando los datos a BDS
 */
// Evita que dos REQUEST_SYNC concurrentes del mismo addon intercalen chunks.
const syncingAddons = new Set();

function handleSyncRequest(addon, sendCommand) {
  if (syncingAddons.has(addon)) return;
  syncingAddons.add(addon);
  stats.syncsHandled++;

  const finish = (entryCount) => {
    syncingAddons.delete(addon);
    sendCommand(`scriptevent sqlite:sync_complete ${JSON.stringify({ addon, protocol: 3, entryCount })}`);
  };

  const rows = db.getAddonData(addon);
  const total = rows.length;
  console.log(`[SQLite Bridge] 🔄 Sincronizando '${addon}': ${total} registros encontrados.`);

  if (total === 0) {
    finish(0);
    return;
  }

  let index = 0;

  function sendNextBatch() {
    const batchLimit = Math.min(index + 20, total);

    for (; index < batchLimit; index++) {
      const row = rows[index];
      let parsedValue = row.value;

      try {
        parsedValue = JSON.parse(row.value);
      } catch (e) {
        parsedValue = row.value;
      }

      const serializedValue = JSON.stringify(parsedValue);

      if (serializedValue.length <= DIRECT_SEND_LIMIT) {
        const payload = { addon, owner: row.owner, key: row.key, value: parsedValue, deleted: false };
        sendCommand(`scriptevent sqlite:sync ${JSON.stringify(payload)}`);
      } else {
        const chunkId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const totalChunks = Math.ceil(serializedValue.length / CHUNK_SIZE);

        for (let c = 0; c < totalChunks; c++) {
          const slice = serializedValue.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
          const chunkPayload = {
            chunkId, addon, owner: row.owner, key: row.key,
            chunkIndex: c, chunkCount: totalChunks, valueChunk: slice
          };
          sendCommand(`scriptevent sqlite:load_chunk ${JSON.stringify(chunkPayload)}`);
          stats.chunksSent++;
        }
      }
    }

    if (index < total) {
      setTimeout(sendNextBatch, 5);
    } else {
      finish(total);
      console.log(`[SQLite Bridge] ✅ '${addon}' sincronizado exitosamente (${total} registros).`);
    }
  }

  sendNextBatch();
}

// BDS antepone cabeceras de log entre corchetes (timestamp, nivel, [Scripting]).
// Si hay texto libre antes del marcador (chat, /say, comando reflejado) no es una
// emisión legítima del script y se descarta para impedir inyección de escrituras.
function isAuthorizedPrefix(prefix) {
  if (prefix === '') return true;
  return /^(\s*\[[^\]]*\])+\s*$/.test(prefix);
}

function extractPayload(line, marker) {
  const idx = line.indexOf(marker);
  if (idx === -1) return null;
  if (!isAuthorizedPrefix(line.slice(0, idx))) return null;
  const rawJson = line.slice(idx + marker.length).trim();
  try {
    return JSON.parse(rawJson);
  } catch (err) {
    console.warn(`[SQLite Bridge] Error decodificando ${marker}:`, err.message);
    return null;
  }
}

// === RELAY DE MODERACIÓN FCX (BANEOS) ===
// ModerationService emite [FCX_RELAY_BAN_REQUEST_V1] como solicitud; el demonio es
// la autoridad que la reenvía a BDS vía scriptevent server:moderation, donde
// home_spawn la aplica sobre bans_db. Solo se aceptan emisiones con prefijo de
// consola autorizado (mismo modelo de confianza que [SQLITE_SAVE_V1]).
const RELAY_BAN_MARKER = '[FCX_RELAY_BAN_REQUEST_V1]';
const RELAY_PLAYER_NAME_RE = /^[A-Za-z0-9_ .-]{1,32}$/;
const RELAY_MAX_REASON_LENGTH = 240;
const RELAY_MAX_TEMP_BAN_MINUTES = 129600; // 90 días, máximo documentado para OWNER.

function parseRelayDurationMinutes(duration) {
  const match = /^(\d{1,7})(m|h|d)$/.exec(String(duration ?? '').trim().toLowerCase());
  if (!match) return null;
  const amount = Number(match[1]);
  const multiplier = match[2] === 'm' ? 1 : match[2] === 'h' ? 60 : 1440;
  const minutes = amount * multiplier;
  if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > RELAY_MAX_TEMP_BAN_MINUTES) return null;
  return minutes;
}

function sanitizeRelayReason(value) {
  const reason = String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return reason.length > 0 && reason.length <= RELAY_MAX_REASON_LENGTH ? reason : '';
}

function handleBanRelay(request, sendCommand) {
  if (!request || request.schemaVersion !== 1) return;
  const action = request.action;
  const targetName = String(request.targetName ?? '').trim();
  if (!RELAY_PLAYER_NAME_RE.test(targetName)) {
    console.warn('[SQLite Bridge] Ban relay descartado: nombre de jugador inválido.');
    return;
  }
  const actorRaw = String(request.actorName ?? '').trim();
  const actorName = RELAY_PLAYER_NAME_RE.test(actorRaw) ? actorRaw : 'Consola';
  const correlationId = String(request.correlationId ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  const reason = sanitizeRelayReason(request.reason);

  let payload;
  if (action === 'permaban') {
    if (request.duration !== 'permanent' || !reason) return;
    payload = { action: 'permanent', playerName: targetName, reason, actorName, correlationId };
  } else if (action === 'tempban') {
    const minutes = parseRelayDurationMinutes(request.duration);
    if (minutes === null || !reason) return;
    payload = { action: 'temporary', playerName: targetName, durationMinutes: minutes, reason, actorName, correlationId };
  } else if (action === 'unban') {
    payload = { action: 'unban', playerName: targetName, reason: reason || 'manual_unban', actorName, correlationId };
  } else {
    return;
  }

  sendCommand(`scriptevent server:moderation ${JSON.stringify(payload)}`);
  console.log(`[SQLite Bridge] 🛡️ Ban relay reenviado a BDS: ${action} -> ${targetName}`);
}

/**
 * Procesa cada línea emitida por Bedrock (stdout o stderr).
 */
function processLine(line, sendCommand) {
  const save = extractPayload(line, '[SQLITE_SAVE_V1]');
  if (save) {
    if (KNOWN_ADDONS.has(save.addon) && save.key !== undefined) {
      db.queueWrite(save.addon, save.owner, save.key, save.value, save.deleted === true);
      stats.savesProcessed++;
    }
    return;
  }

  const sync = extractPayload(line, '[SQLITE_REQUEST_SYNC]');
  if (sync) {
    if (KNOWN_ADDONS.has(sync.addon)) handleSyncRequest(sync.addon, sendCommand);
    return;
  }

  const banRequest = extractPayload(line, RELAY_BAN_MARKER);
  if (banRequest) {
    handleBanRelay(banRequest, sendCommand);
    return;
  }
}

// === MODO ENVOLTORIO (SUPERVISOR DE BDS) ===
function runBdsSupervisor() {
  openDatabase();

  const isWindows = process.platform === 'win32';
  const executableName = isWindows ? 'bedrock_server.exe' : 'bedrock_server';

  let bdsExecPath = path.isAbsolute(customBdsPath)
    ? customBdsPath
    : path.resolve(process.cwd(), customBdsPath);

  if (fs.existsSync(bdsExecPath) && fs.statSync(bdsExecPath).isDirectory()) {
    bdsExecPath = path.join(bdsExecPath, executableName);
  }

  if (!fs.existsSync(bdsExecPath)) {
    console.error(`\n❌ ERROR: No se encontró el ejecutable de Bedrock en: ${bdsExecPath}`);
    console.error("Asegúrate de pasar la ruta correcta con: --bds-path <directorio_bds>\n");
    process.exit(1);
  }

  const bdsCwd = path.dirname(bdsExecPath);
  console.log(`[SQLite Bridge] Iniciando BDS desde: ${bdsCwd}`);

  const env = { ...process.env };
  if (!isWindows) {
    env.LD_LIBRARY_PATH = `.:${env.LD_LIBRARY_PATH || ''}`;
  }

  const bdsProcess = spawn(bdsExecPath, [], {
    cwd: bdsCwd,
    env,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const sendCommand = (cmd) => {
    if (!bdsProcess.stdin.destroyed) {
      bdsProcess.stdin.write(cmd + '\n');
    }
  };

  // Canalizar entrada estándar de la consola al servidor
  const stdinRl = readline.createInterface({ input: process.stdin });
  stdinRl.on('line', (input) => {
    sendCommand(input);
  });

  // Escuchar salida de BDS
  const stdoutRl = readline.createInterface({ input: bdsProcess.stdout });
  stdoutRl.on('line', (line) => {
    process.stdout.write(line + '\n');
    processLine(line, sendCommand);
  });

  // BDS puede volcar console.warn del Script API por stderr; se parsea igual.
  const stderrRl = readline.createInterface({ input: bdsProcess.stderr });
  stderrRl.on('line', (line) => {
    process.stderr.write(line + '\n');
    processLine(line, sendCommand);
  });

  // Tarea de respaldo automático cada hora (3600s)
  const backupInterval = setInterval(() => {
    db.createBackup(backupDir);
  }, 3600 * 1000);

  let isShuttingDown = false;
  let forceTimeout = null;

  const shutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[SQLite Bridge] Recibida señal ${signal}. Cerrando ordenadamente...`);
    clearInterval(backupInterval);
    stdinRl.close();
    try { sendCommand('stop'); } catch (e) {}
    forceTimeout = setTimeout(() => {
      console.warn("[SQLite Bridge] BDS tardó demasiado en salir. Forzando cierre.");
      try { bdsProcess.kill('SIGTERM'); } catch (e) {}
    }, 8000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  bdsProcess.on('error', (err) => {
    console.error("[SQLite Bridge] Error del proceso BDS:", err.message);
    clearInterval(backupInterval);
    try { db.close(); } catch (e) {}
    process.exit(1);
  });

  bdsProcess.stdin.on('error', () => {});

  // 'close' (no 'exit') garantiza que stdout/stderr se drenaron antes de cerrar
  // la BD, evitando perder los últimos [SQLITE_SAVE_V1] del apagado.
  bdsProcess.on('close', (code) => {
    clearInterval(backupInterval);
    if (forceTimeout) clearTimeout(forceTimeout);
    stdoutRl.close();
    stderrRl.close();
    console.log(`[SQLite Bridge] El proceso BDS finalizó con código: ${code}`);
    try { db.close(); } catch (e) {}

    if (autoRestart && !isShuttingDown) {
      console.log("[SQLite Bridge] Reiniciando BDS en 5 segundos (--auto-restart activo)...");
      setTimeout(runBdsSupervisor, 5000);
    } else {
      console.log("[SQLite Bridge] Servidor y base de datos cerrados con éxito.");
      process.exit(code || 0);
    }
  });
}

// === MODO TUBERÍA (PIPE DIRECTO) ===
function runPipeMode() {
  openDatabase();
  const sendCommand = (cmd) => process.stdout.write(cmd + '\n');
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (line) => processLine(line, sendCommand));

  // En modo pipe también deben existir respaldos y checkpoint periódicos.
  const backupInterval = setInterval(() => { db.createBackup(backupDir); }, 3600 * 1000);
  const checkpointInterval = setInterval(() => { db.checkpoint(); }, 300 * 1000);

  const close = () => {
    clearInterval(backupInterval);
    clearInterval(checkpointInterval);
    try { db.close(); } catch (e) {}
    process.exit(0);
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}

process.on('uncaughtException', (err) => {
  console.error("[SQLite Bridge] Excepción no capturada:", err);
  try { if (db) db.close(); } catch (e) {}
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error("[SQLite Bridge] Promesa rechazada no manejada:", err);
});

if (isPipeMode) {
  runPipeMode();
} else {
  runBdsSupervisor();
}
