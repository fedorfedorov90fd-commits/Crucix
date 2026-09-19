#!/usr/bin/env bash
# Обёртка для запуска сборщика с audit-логом и timeout.
# Использование: bash scripts/run-collector.sh collect-xxx [timeout_сек]

COLLECTOR="$1"
TIMEOUT="${2:-120}"
ROOT="/home/ta8_/Рабочий стол/Crucix"
LOG="$ROOT/logs/collectors/${COLLECTOR}.log"
AUDIT="$ROOT/logs/collectors/_audit.log"

START_TS=$(date '+%Y-%m-%d %H:%M:%S')
echo "$START_TS | $COLLECTOR | START | timeout=${TIMEOUT}s" >> "$AUDIT"

cd "$ROOT"
timeout "$TIMEOUT" node "scripts/collectors/${COLLECTOR}.mjs" 2>&1 | tee -a "$LOG"
EXIT_CODE=$?

END_TS=$(date '+%Y-%m-%d %H:%M:%S')
echo "$END_TS | $COLLECTOR | END | exit=${EXIT_CODE}" >> "$AUDIT"
