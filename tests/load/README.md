# Crucix · Нагрузочное тестирование

## k6

### Установка

macOS: brew install k6
Ubuntu: apt install k6
Docker: docker pull grafana/k6

### WebSocket тест

k6 run tests/load/k6/websocket.js
k6 run --vus 500 --duration 10m tests/load/k6/websocket.js
WS_URL=ws://crucix.example.com:3118 k6 run tests/load/k6/websocket.js

### API тест

k6 run tests/load/k6/api.js
API_URL=http://crucix.example.com k6 run tests/load/k6/api.js

### Ожидаемые результаты

| Метрика | Target | Acceptable | Critical |
|---------|--------|------------|----------|
| WS connections | 500+ | 200+ | <100 |
| Message latency p95 | <100ms | <300ms | >500ms |
| Message latency p99 | <300ms | <500ms | >1000ms |
| Error rate | <0.1% | <1% | >1% |
| HTTP p95 | <100ms | <300ms | >500ms |
| HTTP p99 | <300ms | <1000ms | >2000ms |

## Artillery

### Установка

npm install -g artillery

### WebSocket тест

artillery run tests/load/artillery/ws-load.yml
artillery run --output report.json tests/load/artillery/ws-load.yml
artillery report report.json --output report.html

### Интерпретация метрик

k6:
- ws_connections_total — общее число соединений
- ws_messages_received — получено сообщений
- ws_message_latency_ms — задержка (p50, p95, p99)
- ws_connection_errors — rate ошибок соединения

Artillery:
- vusers.created — создано виртуальных пользователей
- vusers.completed — успешно завершено
- vusers.failed — провалено
- ws.connection_duration_ms — длительность сессии
- ws.pong_latency_ms — latency ping/pong

## Профили нагрузки

Development: k6 run --vus 10 --duration 30s tests/load/k6/websocket.js
Staging: k6 run --vus 200 --duration 5m tests/load/k6/websocket.js
Production readiness: k6 run tests/load/k6/websocket.js

## Известные лимиты

При текущей архитектуре:

- Максимум WS соединений на под: ~2000
- Messages/sec per pod: ~5000
- Память на 1000 соединений: ~500 MB

Для больших нагрузок — горизонтальное масштабирование через HPA.
