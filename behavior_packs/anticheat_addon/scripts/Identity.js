// Identidad unificada del anticheat: XUID cuando existe, nombre normalizado como
// respaldo. Todas las tablas de estado se indexan con esta clave para que los
// renombrados no vacíen las consultas ni dupliquen el estado.
const sessionsById = new Map();
const keyByName = new Map();

export function playerKey(player) {
  const xuid = String(player?.xuid || "").trim();
  if (xuid) return "x:" + xuid;
  const name = String(player?.name || "").trim().toLowerCase();
  return name ? "n:" + name : "";
}

export function rememberPlayer(player) {
  if (!player) return "";
  const key = playerKey(player);
  if (!key) return "";
  const name = String(player.name || "").trim().toLowerCase();
  const xuid = String(player.xuid || "").trim();
  if (player.id !== undefined) sessionsById.set(player.id, { key, name, xuid });
  if (name) keyByName.set(name, key);
  return key;
}

export function sessionForPlayerId(playerId) {
  return sessionsById.get(playerId);
}

export function keyForPlayerName(playerName) {
  return keyByName.get(String(playerName || "").trim().toLowerCase()) || "";
}

export function forgetPlayer(playerId, playerName) {
  sessionsById.delete(playerId);
  const name = String(playerName || "").trim().toLowerCase();
  if (name) keyByName.delete(name);
}