#!/usr/bin/env bash
# ==============================================================================
# Script de Instalación Automatizada de Addons para Minecraft Bedrock Dedicated Server (BDS)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_BDS="${1:-}"

echo "================================================================="
echo "   INSTALADOR DE ADDONS BDS - MINECRAFT BEDROCK (PACIFICO)      "
echo "================================================================="

# Detectar ruta del servidor BDS
if [[ -z "$TARGET_BDS" ]]; then
    if [[ -f "bedrock_server" && -f "server.properties" ]]; then
        TARGET_BDS="$(pwd)"
    elif [[ -f "../bedrock_server" && -f "../server.properties" ]]; then
        TARGET_BDS="$(cd .. && pwd)"
    else
        read -r -p "Introduce la ruta absoluta de tu servidor BDS (ej: /home/ubuntu/minecraft-server): " TARGET_BDS
    fi
fi

TARGET_BDS="$(cd "$TARGET_BDS" 2>/dev/null && pwd || echo "$TARGET_BDS")"

if [[ ! -d "$TARGET_BDS" ]]; then
    echo "ERROR: El directorio '$TARGET_BDS' no existe." >&2
    exit 1
fi

if [[ ! -f "$TARGET_BDS/server.properties" ]]; then
    echo "ADVERTENCIA: No se encontró 'server.properties' en $TARGET_BDS."
    echo "¿Estás seguro de que esta es la carpeta raíz de BDS?"
    read -r -p "Continuar de todos modos? (s/N): " CONFIRM
    if [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]]; then
        echo "Cancelado."
        exit 1
    fi
fi

# Detectar nombre del mundo activo
LEVEL_NAME="Bedrock level"
if [[ -f "$TARGET_BDS/server.properties" ]]; then
    DETECTED_NAME=$(grep -E "^level-name=" "$TARGET_BDS/server.properties" | cut -d'=' -f2- | tr -d '\r' || true)
    if [[ -n "$DETECTED_NAME" ]]; then
        LEVEL_NAME="$DETECTED_NAME"
    fi
fi

WORLD_DIR="$TARGET_BDS/worlds/$LEVEL_NAME"
BP_TARGET_DIR="$TARGET_BDS/behavior_packs"

echo "-> Directorio BDS: $TARGET_BDS"
echo "-> Mundo activo detectado: $LEVEL_NAME ($WORLD_DIR)"
echo "-> Copiando 26 Behavior Packs a: $BP_TARGET_DIR..."

mkdir -p "$BP_TARGET_DIR"
mkdir -p "$WORLD_DIR"

# Copiar todos los behavior packs
cp -r "$SCRIPT_DIR/behavior_packs/"* "$BP_TARGET_DIR/"

# Copiar configuración del mundo
echo "-> Instalando lista de activación de packs en el mundo..."
cp "$SCRIPT_DIR/world_config/world_behavior_packs.json" "$WORLD_DIR/world_behavior_packs.json"
cp "$SCRIPT_DIR/world_config/world_resource_packs.json" "$WORLD_DIR/world_resource_packs.json"

# Comprobar configuraciones recomendadas en server.properties
if [[ -f "$TARGET_BDS/server.properties" ]]; then
    echo "-> Verificando opciones en server.properties..."
    
    # allow-cheats
    if grep -qE "^allow-cheats=false" "$TARGET_BDS/server.properties"; then
        echo "   [AVISO] 'allow-cheats=false' está desactivado. Algunos scripts y comandos requieren 'allow-cheats=true'."
        read -r -p "   ¿Deseas activar allow-cheats=true automáticamente? (S/n): " FIX_CHEATS
        if [[ "$FIX_CHEATS" != "n" && "$FIX_CHEATS" != "N" ]]; then
            sed -i 's/^allow-cheats=false/allow-cheats=true/' "$TARGET_BDS/server.properties"
            echo "   [OK] allow-cheats=true configurado."
        fi
    fi

    # content-log
    if ! grep -qE "^content-log-file-enabled=true" "$TARGET_BDS/server.properties"; then
        echo "   [INFO] Se recomienda activar logs de contenido para depurar addons."
    fi
fi

# Copiar herramientas si existe carpeta tools
if [[ -d "$SCRIPT_DIR/tools" ]]; then
    mkdir -p "$TARGET_BDS/tools"
    cp -r "$SCRIPT_DIR/tools/"* "$TARGET_BDS/tools/"
fi

# Ajustar permisos
chmod -R 755 "$BP_TARGET_DIR" 2>/dev/null || true

echo ""
echo "================================================================="
echo "   ¡INSTALACIÓN COMPLETADA CON ÉXITO!                            "
echo "================================================================="
echo "Total de addons instalados: 26 behavior packs."
echo ""
echo "Siguientes pasos en tu nuevo VPS:"
echo "1. Si el servidor BDS ya está corriendo, escribe en la consola BDS: reload"
echo "2. Si el servidor está detenido, inícialo con: LD_LIBRARY_PATH=. ./bedrock_server"
echo "3. Revisa la consola o BDS.runtime.log para verificar que los 26 addons inicien correctamente."
echo "================================================================="
