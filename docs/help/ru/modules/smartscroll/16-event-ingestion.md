# 16. Интеграция в пайплайн

[← Назад к INDEX](./INDEX.md)

## Расположение

/home/ta8_/Рабочий стол/Crucix/apis/ingest/event-ingestion-api.mjs

## Назначение

Единый слой приёма событий SmartScroll в пайплайн Crucix.
Включает встроенный HTTP-сервер с эндпоинтами для дашборда.

## Функции модуля

- ingestStories(opts) — ингестия сюжетов в граф
- runCollectCycle() — полный цикл сбора из источников
- getTimeline(storyId) — прокси к источнику
- getStoryDetail(storyId) — прокси к источнику
- healthCheck() — состояние пайплайна
- setGraphAdapter(adapter) — подключение графа знаний
- startIngestionLoop(intervalMs) — автономный цикл
- startHttpServer(port) — запуск HTTP-сервера

## HTTP-эндпоинты

- GET /health — состояние источника и графа
- GET /metrics — метрики производительности (только в local или auto)
- GET /stats — сводка: количество сюжетов и событий
- GET /stories?limit=N&since=ISO — список сюжетов
- GET /stories/:id — детали конкретного сюжета
- GET /stories/:id/timeline — таймлайн сюжета
- POST /run?limit=N — ингестия сюжетов в граф
- POST /collect — полный цикл сбора из источников

## Формат результата ingestStories

- imported — количество импортированных сюжетов
- deduped — количество удалённых дубликатов
- skipped — количество пропущенных
- errors — массив ошибок

## Формат результата runCollectCycle

- collected — количество собранных событий
- unique — количество уникальных после дедупликации
- stories — количество сюжетов
- duration_ms — длительность цикла

## Запуск как скрипт

Переменные окружения:
- SMARTSCROLL_HTTP_PORT — порт HTTP-сервера (по умолчанию 3157)

Команда:
node apis/ingest/event-ingestion-api.mjs

## Подключение графа

import { setGraphAdapter } from './apis/ingest/event-ingestion-api.mjs';
setGraphAdapter({
  async addNode(node) { /* граф */ },
  async addEdge(edge) { /* граф */ },
  async resolveEntity(name) { /* резолвер */ },
});

## Связи

- Импортирует: 04-local-index.md, 10-dedup.md, 15-story-layer.md
- Записывает в корзину через: scripts/collectors/collect-smartscroll.mjs
