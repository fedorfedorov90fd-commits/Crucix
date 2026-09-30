#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  CRUCIX VERIFIER
#  Проверка целостности: core/, apis/sources/, все три модуля
#  синтаксически корректны, сервер отвечает на ключевые эндпоинты.
# ═══════════════════════════════════════════════════════════════

set -u
cd "$(dirname "$0")/.."
echo "=== CRUCIX VERIFIER ==="
echo "root: $(pwd)"
echo

echo "=== 1. core/ ==="
for f in entity-graph-engine.mjs entity-model-engine.mjs living-dossier.mjs geotime-timeline.mjs target-workbench.mjs gaia-map-linker.mjs recon-toolkit.mjs recon-sidecar.mjs intel-feed.mjs telegram-osint-layer.mjs crypto-wallet-trace.mjs ai-analyst-context.mjs deep-link-encoder.mjs preset-engine.mjs; do
  if [ -f "core/$f" ]; then
    if node --check "core/$f" 2>/dev/null; then echo "  OK  core/$f"; else echo "  ERR core/$f"; fi
  else
    echo "  --  core/$f (нет)"
  fi
done
echo

echo "=== 2. apis/sources/ ==="
for f in entity-graph-api.mjs preset-api.mjs ofac-sdn-api.mjs country-instability-api.mjs resilience-index-api.mjs; do
  if [ -f "apis/sources/$f" ]; then
    if node --check "apis/sources/$f" 2>/dev/null; then echo "  OK  apis/sources/$f"; else echo "  ERR apis/sources/$f"; fi
  else
    echo "  --  apis/sources/$f (нет)"
  fi
done
echo

echo "=== 3. scripts/ ==="
for f in scripts/collectors/collect-ofac-sdn.mjs scripts/entity-graph-bootstrap.mjs scripts/register-multimap-modules.mjs; do
  if [ -f "$f" ]; then
    if node --check "$f" 2>/dev/null; then echo "  OK  $f"; else echo "  ERR $f"; fi
  else
    echo "  --  $f (нет)"
  fi
done
echo

echo "=== 4. server/router.mjs ==="
if [ -f server/router.mjs ]; then
  if node --check server/router.mjs 2>/dev/null; then echo "  OK  server/router.mjs"; else echo "  ERR server/router.mjs"; fi
fi
echo

echo "=== 5. Сервер на порту 3117 ==="
if pgrep -f "node server.mjs" > /dev/null; then
  echo "  OK  сервер запущен, PID: $(pgrep -f 'node server.mjs' | head -1)"
  for ep in "/api/registry/" "/api/layers/entity-graph" "/api/layers/preset" "/api/layers/ofac-sdn" "/api/layers/country-instability" "/api/layers/resilience-index" "/api/layers/infrastructure-api/stats"; do
    code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3117${ep}" 2>/dev/null)
    echo "  ${code}  ${ep}"
  done
else
  echo "  --  сервер не запущен (запусти: cd '$(pwd)' && node server.mjs)"
fi

echo
echo "=== ГОТОВО ==="
