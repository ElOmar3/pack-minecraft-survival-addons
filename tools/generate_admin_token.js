#!/usr/bin/env node
/**
 * ==============================================================================
 * GENERADOR DE TOKEN DE ENROLAMIENTO DE DUEÑO (OWNER) - FCX LIMITED ADMIN
 * ==============================================================================
 * Este script genera un token criptográfico único para vincular de forma
 * segura al Dueño (OWNER) del servidor sin depender de permisos OP inseguros.
 *
 * Uso:
 *   node tools/generate_admin_token.js
 * ==============================================================================
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const configPath = path.join(
  __dirname,
  '..',
  'behavior_packs',
  'fcx_limited_admin',
  'scripts',
  'config',
  'OwnerProvisioning.js'
);

// 1. Generar un nonce (token) seguro de 32 caracteres alfanuméricos
const rawToken = 'fcx_' + crypto.randomBytes(16).toString('hex');

// 2. Calcular el hash SHA-256 del token
const nonceHash = crypto.createHash('sha256').update(rawToken).digest('hex');

// 3. Generar la clave de derivación de tokens (64 caracteres hexadecimales)
const tokenDerivationKeyHex = crypto.randomBytes(32).toString('hex');

// 4. Configurar expiración a 48 horas a partir de ahora
const now = Date.now();
const expiresAt = now + (48 * 60 * 60 * 1000); // 48 horas de vigencia

// 5. Escribir el archivo OwnerProvisioning.js
const fileContent = `// Archivo generado automáticamente por tools/generate_admin_token.js
export const OWNER_PROVISIONING = Object.freeze({
  enabled: true,
  nonceHash: "${nonceHash}",
  expiresAt: ${expiresAt},
  tokenDerivationKeyHex: "${tokenDerivationKeyHex}",
  generatedAt: ${now}
});
`;

fs.writeFileSync(configPath, fileContent, 'utf8');

console.log("=================================================================");
console.log("   🔑 TOKEN DE ENROLAMIENTO DE OWNER GENERADO CON ÉXITO        ");
console.log("=================================================================");
console.log("");
console.log("Tu token único de seguridad es:");
console.log(`\x1b[32m\x1b[1m${rawToken}\x1b[0m`);
console.log("");
console.log("Vigencia: 48 horas (expira: " + new Date(expiresAt).toLocaleString() + ")");
console.log("Archivo actualizado: behavior_packs/fcx_limited_admin/scripts/config/OwnerProvisioning.js");
console.log("");
console.log("PASOS PARA ENROLARTE COMO DUEÑO EN TU SERVIDOR:");
console.log("-----------------------------------------------------------------");
console.log("1. Si tu servidor BDS está apagado, inícialo con start-server.");
console.log("   Si ya está encendido, escribe en la consola BDS: reload");
console.log("2. En la consola del servidor BDS, date permiso de operador inicial:");
console.log("   op TuNombreEnMinecraft");
console.log("3. Entra a tu mundo de Minecraft y escribe en el chat:");
console.log(`   \x1b[33m/s:admin enroll-owner ${rawToken}\x1b[0m`);
console.log("4. ¡Listo! Quedarás registrado como OWNER con máxima jerarquía.");
console.log("5. Abre el panel de administración escribiendo: /s:admin");
console.log("6. Desactiva el bloqueo de seguridad escribiendo: /s:lockdown off");
console.log("=================================================================");
