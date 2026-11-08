#!/usr/bin/env bash
# ==============================================================================
# Lanzador Seguro de Servidor BDS con Demonio SQLite V3 para Linux / VPS
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_BDS="${1:-}"

echo "================================================================="
echo "   INICIADOR SEGURO DE SERVIDOR BDS - PACÍFICO COMUNITARIO      "
echo "   Con Demonio SQLite V3 (Cero corrupción de mundos)            "
echo "================================================================="

if ! command -v node >/dev/null 2>&1; then
    echo "ERROR: Node.js no está instalado en el sistema." >&2
    echo "Por favor instala Node.js (versión 22 o superior):" >&2
    echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -" >&2
    echo "  sudo apt-get install -y nodejs" >&2
    exit 1
fi

if [[ -z "$TARGET_BDS" ]]; then
    if [[ -f "$SCRIPT_DIR/bedrock_server" ]]; then
        TARGET_BDS="$SCRIPT_DIR"
    elif [[ -f "$(pwd)/bedrock_server" ]]; then
        TARGET_BDS="$(pwd)"
    elif [[ -f "$SCRIPT_DIR/../bedrock_server" ]]; then
        TARGET_BDS="$(cd "$SCRIPT_DIR/.." && pwd)"
    else
        read -r -p "Introduce la ruta de tu servidor BDS (donde está bedrock_server): " TARGET_BDS
    fi
fi

TARGET_BDS="$(cd "$TARGET_BDS" 2>/dev/null && pwd || echo "$TARGET_BDS")"

if [[ ! -f "$TARGET_BDS/bedrock_server" ]]; then
    echo "ERROR: No se encontró 'bedrock_server' en '$TARGET_BDS'." >&2
    exit 1
fi

chmod +x "$TARGET_BDS/bedrock_server" 2>/dev/null || true

echo "-> Directorio BDS: $TARGET_BDS"
echo "-> Iniciando supervisor SQLite V3..."
echo ""

exec node "$SCRIPT_DIR/bridge/sqlite-daemon.js" --bds-path "$TARGET_BDS" --auto-restart
