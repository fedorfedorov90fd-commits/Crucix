#!/bin/sh
# Crucix Core · Entrypoint
# Управляет запуском сервисов: WebSocket, API, FL, Python-bridge

set -e

WS_PORT="${WS_PORT:-3118}"
API_PORT="${API_PORT:-3117}"
FL_PORT="${FL_PORT:-3120}"
LOG_LEVEL="${LOG_LEVEL:-info}"
CRUCIX_MODE="${CRUCIX_MODE:-crucix}"

if [ -t 1 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
    BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; BLUE=''; BOLD=''; NC=''
fi

log() { echo "${BLUE}[crucix]${NC} $1"; }
ok() { echo "${GREEN}[crucix]${NC} $1"; }
warn() { echo "${YELLOW}[crucix]${NC} $1"; }
err() { echo "${RED}[crucix]${NC} $1" >&2; }

echo ""
echo "${BOLD}════════════════════════════════════════════════${NC}"
echo "${BOLD}  Crucix Core · v3.0.0${NC}"
echo "${BOLD}  Multidisciplinary Predictive Intelligence${NC}"
echo "${BOLD}════════════════════════════════════════════════${NC}"
echo ""

log "Проверка окружения..."
log "  Mode:      $CRUCIX_MODE"
log "  Node.js:   $(node --version)"
log "  WS Port:   $WS_PORT"
log "  API Port:  $API_PORT"
log "  FL Port:   $FL_PORT"
log "  Log level: $LOG_LEVEL"
echo ""

if [ -f "/app/apis/predict/wasm/linear_algebra_simd.wasm" ]; then
    ok "WASM SIMD доступен: $(stat -c%s /app/apis/predict/wasm/linear_algebra_simd.wasm 2>/dev/null || echo '?') bytes"
elif [ -f "/app/apis/predict/wasm/linear_algebra.wasm" ]; then
    warn "WASM SIMD недоступен, используем скалярный WASM"
else
    warn "WASM недоступен — работаем на чистом JS"
fi

if [ ! -w "/app/runs" ]; then
    err "Нет прав на /app/runs"
    exit 1
fi

PIDS=""
SHUTTING_DOWN=0

cleanup() {
    if [ "$SHUTTING_DOWN" = "1" ]; then return; fi
    SHUTTING_DOWN=1

    echo ""
    log "Получен сигнал — graceful shutdown..."
    log "Останавливаю процессы: $PIDS"

    for pid in $PIDS; do
        if kill -0 "$pid" 2>/dev/null; then
            kill -TERM "$pid" 2>/dev/null || true
        fi
    done

    for i in $(seq 1 15); do
        ALL_DEAD=1
        for pid in $PIDS; do
            if kill -0 "$pid" 2>/dev/null; then
                ALL_DEAD=0
                break
            fi
        done
        if [ "$ALL_DEAD" = "1" ]; then
            ok "Все процессы завершены корректно"
            exit 0
        fi
        sleep 1
    done

    warn "Force kill оставшихся процессов..."
    for pid in $PIDS; do
        kill -KILL "$pid" 2>/dev/null || true
    done
    exit 0
}

trap cleanup TERM INT

start_service() {
    local name="$1"
    shift
    log "Запуск $name..."

    "$@" >> "/app/logs/${name}.log" 2>&1 &
    local pid=$!
    PIDS="$PIDS $pid"

    sleep 2
    if ! kill -0 "$pid" 2>/dev/null; then
        err "$name не запустился — смотрите /app/logs/${name}.log"
        tail -20 "/app/logs/${name}.log" >&2 || true
        exit 1
    fi

    ok "$name запущен (PID: $pid)"
}

case "$CRUCIX_MODE" in
    ws)
        start_service "ws" node /app/apis/predict/ws.mjs "$WS_PORT"
        ;;
    api)
        start_service "ws" node /app/apis/predict/ws.mjs "$WS_PORT"
        ;;
    fl)
        start_service "fl" node /app/apis/predict/federated/fl_node.mjs coordinator "$FL_PORT"
        ;;
    worker)
        start_service "fl-worker" node /app/apis/predict/federated/fl_node.mjs worker "$FL_PORT"
        ;;
    full|crucix|*)
        start_service "ws" node /app/apis/predict/ws.mjs "$WS_PORT"

        if [ "${FL_ENABLED:-true}" = "true" ]; then
            start_service "fl" node /app/apis/predict/federated/fl_node.mjs coordinator "$FL_PORT"
        fi

        if [ "${PREDICTION_LOOP_ENABLED:-true}" = "true" ]; then
            log "Запуск prediction loop (интервал: ${PREDICTION_INTERVAL_MINUTES:-15} мин)..."
            (
                while [ "$SHUTTING_DOWN" = "0" ]; do
                    node -e "
                        import('/app/apis/predict/crucix_engine_v3.mjs').then(async m => {
                            try {
                                const result = await m.runFullCrucixV3Cycle();
                                if (result && result.compositeRisk) {
                                    console.log('[loop] cycle:', JSON.stringify({
                                        composite: result.compositeRisk.composite,
                                        level: result.compositeRisk.level,
                                        signals: result.compositeRisk.signals?.length || 0,
                                    }));
                                }
                            } catch (e) {
                                console.error('[loop] error:', e.message);
                            }
                        });
                    " >> /app/logs/predictions.log 2>&1
                    sleep $(( ${PREDICTION_INTERVAL_MINUTES:-15} * 60 ))
                done
            ) &
            PIDS="$PIDS $!"
        fi
        ;;
esac

sleep 2

log "Проверка готовности сервисов..."

for i in $(seq 1 20); do
    if curl -sf "http://localhost:${WS_PORT}/health" > /dev/null 2>&1; then
        ok "WebSocket доступен: http://localhost:${WS_PORT}/health"
        break
    fi
    sleep 1
done

echo ""
echo "${GREEN}════════════════════════════════════════════════${NC}"
echo "${GREEN}  Crucix Core готов${NC}"
echo "${GREEN}════════════════════════════════════════════════${NC}"
echo ""
echo "  WebSocket:  ws://0.0.0.0:${WS_PORT}"
echo "  Health:     http://0.0.0.0:${WS_PORT}/health"
echo "  Stats:      http://0.0.0.0:${WS_PORT}/stats"
echo ""
echo "  Логи: /app/logs/{ws,fl,predictions}.log"
echo ""

wait
