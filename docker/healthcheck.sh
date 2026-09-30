#!/bin/sh
# Crucix Core · Healthcheck

set -e

WS_PORT="${WS_PORT:-3118}"
MAX_LATENCY_MS=2000

START=$(date +%s%3N 2>/dev/null || date +%s)
RESPONSE=$(curl -sf --max-time 3 "http://localhost:${WS_PORT}/health" 2>/dev/null || echo "")
END=$(date +%s%3N 2>/dev/null || date +%s)
LATENCY=$((END - START))

if [ -z "$RESPONSE" ]; then
    echo "FAIL: no response from /health (port $WS_PORT)"
    exit 1
fi

if ! echo "$RESPONSE" | grep -q '"status":"ok"'; then
    echo "FAIL: unexpected response: $RESPONSE"
    exit 1
fi

if [ "$LATENCY" -gt "$MAX_LATENCY_MS" ]; then
    echo "WARN: high latency ${LATENCY}ms (threshold: ${MAX_LATENCY_MS}ms)"
fi

if [ -r "/proc/self/status" ]; then
    MEM_KB=$(grep VmRSS /proc/self/status | awk '{print $2}')
    if [ "$MEM_KB" -gt 1800000 ]; then
        echo "WARN: high memory ${MEM_KB}KB"
    fi
fi

echo "OK: latency ${LATENCY}ms"
exit 0
