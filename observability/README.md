# Crucix Observability

Production-grade monitoring для Crucix Monitor. Zero external dependencies — работает на чистом Node.js.

## Что внутри

- OpenTelemetry-совместимый трейсинг — spans, context propagation, OTLP export
- Prometheus метрики — counters, gauges, histograms
- Structured logs — JSON-формат для ELK/Loki
- Grafana dashboards — готовые панели
- Prometheus alerts — правила алертинга

## Быстрый старт

import { setupObservability, tracePredictionCycle } from './observability/instrumentation.mjs';

setupObservability({
  serviceName: 'crucix-monitor',
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  samplingRate: 0.1,
});

const result = await tracePredictionCycle(async (span) => {
  span.setAttribute('custom.attr', 'value');
  return prediction;
});

## Метрики

Основные:

| Метрика | Тип | Описание |
|---------|-----|----------|
| crucix_composite_risk | gauge | Текущий риск (0-1) |
| crucix_composite_level | gauge | Уровень (0-4) |
| crucix_prediction_cycles_total | counter | Всего циклов |
| crucix_cycle_duration_seconds | histogram | Длительность цикла |
| crucix_brier_score | gauge | Brier score |
| crucix_ws_connections | gauge | WS соединения |
| crucix_signal_value | gauge | Значения сигналов |

Полный список в otel.mjs — registerCrucixMetrics().

## Endpoints

- /metrics — Prometheus формат
- /health — healthcheck
- /stats — JSON snapshot метрик

## Grafana

Импортировать dashboard: observability/dashboards/grafana/crucix-overview.json

Панели:
1. Composite Risk (gauge)
2. Cycle Duration p50/p95
3. WS Connections
4. Brier Score
5. Signal Values (timeseries)
6. Prediction Cycle Rate
7. Prediction Accuracy

## Alerts

Все алерты в observability/alerts/prometheus.yml:

- Critical: instance down, critical risk
- Warning: high latency, many signals, degraded quality
- Info: low resolution rate

## OTLP Export

Экспорт в Jaeger/Tempo:

export OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318

Или в Honeycomb/Datadog — через OTLPHttpExporter с headers.

## Production-конфигурация

setupObservability({
  serviceName: 'crucix-monitor',
  serviceVersion: '3.0.0',
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  logLevel: 'info',
  samplingRate: parseFloat(process.env.OTEL_SAMPLING_RATE || '0.1'),
});

## Примеры запросов Prometheus

Top-10 самых активных сигналов:
topk(10, crucix_signal_value)

Средний composite risk за час:
avg_over_time(crucix_composite_risk[1h])

Скорость разрешения прогнозов:
rate(crucix_predictions_resolved_total[1h])

p95 latency:
histogram_quantile(0.95, rate(crucix_cycle_duration_seconds_bucket[5m]))

## Интеграция с ELK/Loki

Логи в JSON:
{
  "timestamp": "2026-09-15T07:12:39.000Z",
  "level": "info",
  "service": "crucix-monitor",
  "message": "Prediction cycle completed",
  "durationSeconds": 4.5,
  "compositeRisk": 0.42
}

## Zero-dependency philosophy

Crucix реализует observability без зависимостей:

- Нет @opentelemetry/sdk-node (150+ MB)
- Нет prom-client (тяжёлый)
- Нет winston/pino

Только чистый Node.js + стандартные модули. Всё, что делает observability, читается в otel.mjs (504 строки).
