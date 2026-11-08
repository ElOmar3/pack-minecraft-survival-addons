#!/usr/bin/env bash
set -euo pipefail

# Regenera el bloque de catálogo de Subastas desde el idioma vanilla es_MX.
# Ejecútalo después de actualizar resource_packs/vanilla y después usa reload.
server_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_file="${server_root}/resource_packs/vanilla/texts/es_MX.lang"
target_file="${server_root}/behavior_packs/auction_house_addon/scripts/main.js"
temp_file="$(mktemp "${target_file}.tmp.XXXXXX")"
trap 'rm -f "${temp_file}"' EXIT

awk -F= ' 
FNR == NR {
  if ($0 !~ /^(item|tile)\.[^.]+\.name=/) next
  key = $1
  sub(/^(item|tile)\./, "", key)
  sub(/\.name$/, "", key)
  if (seen[key]++) next
  value = $0
  sub(/^[^=]*=/, "", value)
  gsub(/\\/, "\\\\", value)
  q = sprintf("%c", 34)
  gsub(q, "\\" q, value)
  keys[++count] = key
  values[count] = value
  next
}

/^\/\/ BEGIN GENERATED VANILLA ES_MX CATALOG$/ {
  print
  print "// Generated from resource_packs/vanilla/texts/es_MX.lang."
  print "// Do not edit manually; run tools/generate-auction-es-mx-catalog.sh."
  print "const VANILLA_ITEM_NAMES_ES_MX = Object.freeze({"
  q = sprintf("%c", 34)
  for (i = 1; i <= count; i++) {
    printf "  %s%s%s: %s%s%s,\n", q, keys[i], q, q, values[i], q
  }
  print "});"
  skip = 1
  next
}

/^\/\/ END GENERATED VANILLA ES_MX CATALOG$/ {
  skip = 0
  print
  next
}

!skip { print }
' "${source_file}" "${target_file}" > "${temp_file}"

mv "${temp_file}" "${target_file}"
