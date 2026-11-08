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

// Inicializar la base de datos SQLite
const db = new AddonDatabase({ dbPath: customDbPath });

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
function handleSyncRequest(addon, sendCommand) {
  stats.syncsHandled++;
  const rows = db.getAddonData(addon);
  const total = rows.length;
  console.log(`[SQLite Bridge] 🔄 Sincronizando '${addon}': ${total} registros encontrados.`);

  if (total === 0) {
    // Notificar inmediatamente que la sincronización terminó (0 registros)
    sendCommand(`scriptevent sqlite:sync_complete ${JSON.stringify({ addon, protocol: 3, entryCount: 0 })}`);
    return;
  }

  const CHUNK_SIZE = 800; // Mantener comandos scriptevent por debajo de 1200 caracteres
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

      if (serializedValue.length <= CHUNK_SIZE) {
        // Envío directo normal
        const payload = {
          addon,
          owner: row.owner,
          key: row.key,
          value: parsedValue,
          deleted: false
        };
        sendCommand(`scriptevent sqlite:sync ${JSON.stringify(payload)}`);
      } else {
        // Envío fragmentado (Chunking) para evitar cortes en el buffer de scriptevent
        const chunkId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const totalChunks = Math.ceil(serializedValue.length / CHUNK_SIZE);

        for (let c = 0; c < totalChunks; c++) {
          const slice = serializedValue.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
          const chunkPayload = {
            chunkId,
            addon,
            owner: row.owner,
            key: row.key,
            chunkIndex: c,
            chunkCount: totalChunks,
            valueChunk: slice
          };
          sendCommand(`scriptevent sqlite:load_chunk ${JSON.stringify(chunkPayload)}`);
          stats.chunksSent++;
        }
      }
    }

    if (index < total) {
      setTimeout(sendNextBatch, 5); // Micro-pausa de 5ms entre lotes para no saturar stdin
    } else {
      // Finalización de sincronización
      sendCommand(`scriptevent sqlite:sync_complete ${JSON.stringify({ addon, protocol: 3, entryCount: total })}`);
      console.log(`[SQLite Bridge] ✅ '${addon}' sincronizado exitosamente (${total} registros).`);
    }
  }

  sendNextBatch();
}

/**
 * Procesa cada línea emitida por Bedrock en stdout
 */
function processLine(line, sendCommand) {
  // 1. Detección de Guardado de Addon
  const saveIdx = line.indexOf('[SQLITE_SAVE_V1]');
  if (saveIdx !== -1) {
    const rawJson = line.substring(saveIdx + 16).trim();
    try {
      const payload = JSON.parse(rawJson);
      if (payload.addon && payload.key !== undefined) {
        db.queueWrite(payload.addon, payload.owner, payload.key, payload.value, payload.deleted === true);
        stats.savesProcessed++;
      }
    } catch (err) {
      console.warn("[SQLite Bridge] Error decodificando [SQLITE_SAVE_V1]:", err.message);
    }
    return;
  }

  // 2. Detección de Solicitud de Sincronización
  const syncIdx = line.indexOf('[SQLITE_REQUEST_SYNC]');
  if (syncIdx !== -1) {
    const rawJson = line.substring(syncIdx + 21).trim();
    try {
      const payload = JSON.parse(rawJson);
      if (payload.addon) {
        handleSyncRequest(payload.addon, sendCommand);
      }
    } catch (err) {
      console.warn("[SQLite Bridge] Error decodificando [SQLITE_REQUEST_SYNC]:", err.message);
    }
    return;
  }
}

// === MODO ENVOLTORIO (SUPERVISOR DE BDS) ===
function runBdsSupervisor() {
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

  // Escuchar errores de BDS
  bdsProcess.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  // Tarea de respaldo automático cada hora (3600s)
  const backupInterval = setInterval(() => {
    db.createBackup(backupDir);
  }, 3600 * 1000);

  // Manejo de apagado ordenado de BDS
  let isShuttingDown = false;
  const shutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[SQLite Bridge] Recibida señal ${signal}. Cerrando ordenadamente...`);

    clearInterval(backupInterval);
    stdinRl.close();

    // Intentar apagar BDS suavemente con 'stop'
    try {
      sendCommand('stop');
    } catch (e) {}

    // Esperar a que BDS guarde chunks y cierre
    const timeout = setTimeout(() => {
      console.warn("[SQLite Bridge] BDS tardó demasiado en salir. Forzando cierre.");
      try { bdsProcess.kill('SIGTERM'); } catch (e) {}
      db.close();
      process.exit(0);
    }, 8000);

    bdsProcess.on('exit', () => {
      clearTimeout(timeout);
      db.close();
      console.log("[SQLite Bridge] Servidor y base de datos cerrados con éxito.");
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  bdsProcess.on('exit', (code) => {
    clearInterval(backupInterval);
    console.log(`[SQLite Bridge] El proceso BDS finalizó con código: ${code}`);
    db.close();

    if (autoRestart && !isShuttingDown) {
      console.log("[SQLite Bridge] Reiniciando BDS en 5 segundos (--auto-restart activo)...");
      setTimeout(() => {
        runBdsSupervisor();
      }, 5000);
    } else {
      process.exit(code || 0);
    }
  });
}

// Iniciar según el modo
if (isPipeMode) {
  // Modo Tubería (pipe directo)
  const sendCommand = (cmd) => process.stdout.write(cmd + '\n');
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    processLine(line, sendCommand);
  });
  process.on('SIGINT', () => { db.close(); process.exit(0); });
  process.on('SIGTERM', () => { db.close(); process.exit(0); });
} else {
  runBdsSupervisor();
}
