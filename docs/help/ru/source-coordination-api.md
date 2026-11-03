Файл: source-coordination-api.md
markdown

# API координации источников: source-coordination-api.mjs

## Простое объяснение (для новичков)

Этот файл — «витрина» для данных о координации. Он отдаёт результаты работы детектора, который ищет источники, публикующие новости синхронно.

**Что он делает:**

1. **Читает** данные из таблицы `coordinated_actions` или из файла корзины.
2. **Фильтрует** по параметрам запроса: `action_type`, `min_strength`.
3. **Сортирует** по силе координации.
4. **Отдаёт** в формате JSON: массив пар источников и синхронных событий.

**Зачем это нужно:**

Дашборд `dashboard-coordination.html` показывает heatmap. Виджет `coordination-heatmap.js` запрашивает данные у этого API. Без него виджет не смог бы получить данные.

**Аналогия:**

Это как витрина в магазине. За стеклом — товары (данные), отсортированные и разложенные по полочкам (фильтры, сортировка). Вы приходите и говорите: «Покажите мне самое синхронное». Витрина отдаёт то, что нужно.

---

## Научная база (для специалистов)

Модуль реализует паттерн **API Gateway** для данных о координации источников, сгенерированных `source-coordination.mjs`.

**Архитектура:**

- **Источник данных:** таблица `coordinated_actions` в БД или файл корзины.
- **Формат:** JSON с полями `schema`, `meta`, `source_pairs`, `sync_events`.
- **Кеширование:** результат кешируется на 5 минут (`CACHE_TTL_MS = 5 * 60 * 1000`).
- **Обогащение:** каждая пара дополняется вычисляемыми полями:
  - `strength` — число co-occurrences.
  - `severityColor` — цвет для UI (`#ef4444` для `high`, `#22c55e` для `normal`).
  - `pairLabel` — человекочитаемый ярлык (`ria-world ↔ tass-world`).

**Контракт v2:**

Модуль экспортирует `route`, `method`, `meta`, `handler`. Это позволяет роутеру автоматически подхватить модуль при пересборке реестра.

**Подпути:**

- `GET /` — корень (список пар + синхронных событий).
- `GET /stats` — агрегаты (сколько пар, сколько событий).
- `GET /status` — health-check.
- `GET /pairs` — только пары источников.
- `GET /events` — только синхронные события.
- `GET /pairs/:feedA/:feedB` — конкретная пара.
- `GET /high` — только `severity=high`.
- `GET /top?n=N` — топ-N по `strength`.

**Фильтры:**

- `?min_strength=5` — только пары с `strength >= 5`.
- `?action_type=source_pair` — только пары.
- `?action_type=synchronous_event` — только события.
- `?limit=50` — максимум записей.

**Ограничения:**

- Работает с таблицей `coordinated_actions` или файлом корзины. Если их нет — возвращает пустой массив.
- Не поддерживает пагинацию. Для больших корпусов — используйте `limit`.
- Не поддерживает запись. Только чтение.

---

## Как работает (пошагово)

1. `handler(req, res)` принимает HTTP-запрос.
2. Парсит `url.pathname` и `query`.
3. Проверяет кеш: если данные есть и не устарели (5 минут) — возвращает их сразу.
4. Если кеша нет — читает таблицу `coordinated_actions` или файл корзины.
5. Парсит JSON, извлекает `source_pairs` и `sync_events`.
6. Обогащает каждый элемент вычисляемыми полями.
7. Применяет фильтры: `min_strength`, `action_type`.
8. Применяет сортировку: `strength`, `co_occurrences`.
9. Ограничивает `limit` (по умолчанию 100).
10. Возвращает JSON: `{ count, total, source_pairs, sync_events, _meta }`.

**Формат ответа для `/`:**

```json
{
  "_meta": {
    "count": 5,
    "source": "coordinated_actions",
    "collected_at": "2026-11-02T08:35:00.000Z"
  },
  "count": 5,
  "total": 5,
  "source_pairs": [
    {
      "feed_a": "ria-world",
      "feed_b": "tass-world",
      "co_occurrences": 17,
      "strength": 17,
      "pairLabel": "ria-world ↔ tass-world",
      "severityColor": "#ef4444"
    }
  ],
  "sync_events": [
    {
      "event_id": 71,
      "title": "Нижегородская БПЛА",
      "sources_count": 9,
      "spread_minutes": 292,
      "feeds": ["ria-world", "tass-world", "interfax-world"],
      "severity": "high"
    }
  ]
}

Формат ответа для /stats:
json

{
  "stats": {
    "count": 5,
    "by_type": { "source_pair": 3, "synchronous_event": 2 },
    "by_severity": { "high": 2, "normal": 3 },
    "totals": {
      "source_pairs": 3,
      "sync_events": 2,
      "max_strength": 17
    }
  },
  "source": "coordinated_actions"
}

Пример использования

Базовый запрос:
bash

curl "http://127.0.0.1:3117/api/layers/source-coordination"

С фильтром по силе:
bash

curl "http://127.0.0.1:3117/api/layers/source-coordination?min_strength=5"

Только пары:
bash

curl "http://127.0.0.1:3117/api/layers/source-coordination/pairs"

Только события:
bash

curl "http://127.0.0.1:3117/api/layers/source-coordination/events"

Конкретная пара:
bash

curl "http://127.0.0.1:3117/api/layers/source-coordination/pairs/ria-world/tass-world"

Топ-5 по strength:
bash

curl "http://127.0.0.1:3117/api/layers/source-coordination/top?n=5"

Health-check:
bash

curl "http://127.0.0.1:3117/api/layers/source-coordination/status"

Практические рекомендации

    CACHE_TTL_MS = 5 * 60 * 1000 — 5 минут. Не увеличивайте без необходимости: данные в БД могут обновляться.

    Fallback на ошибки — если таблицы нет, возвращает пустой массив с error: 'not_found'. Это защита от падения.

    Обогащение полями — strength, severityColor, pairLabel. Это упрощает работу виджетов: не нужно вычислять на клиенте.

    /stats — агрегаты. Полезно для дашбордов, которые показывают «сводку».

    /pairs — только пары. Полезно для виджета, который показывает только пары.

    /events — только события. Полезно для виджета, который показывает только события.

    /pairs/:feedA/:feedB — конкретная пара. Если пара не найдена — возвращает 404 с error: 'pair not found'.

    /top?n=5 — топ-N по strength. Полезно для «горячих» пар.

    /high — только severity=high. Полезно для виджета, который показывает только сильные сигналы.

    Сортировка по strength — по умолчанию. Для других сортировок — ?sort=co_occurrences.

    Не поддерживает запись. Только чтение. Все изменения — через source-coordination.mjs.

    Для больших корпусов — используйте limit. По умолчанию 100. Больше — тормозит.

    limit=0 — вернёт пустой массив. Полезно для тестирования.

Связанные модули

    scripts/analyzers/source-coordination.mjs — анализатор, пишет в coordinated_actions.

    dashboard/public/widgets/coordination-heatmap.js — виджет, читает API.

    dashboard/public/dashboard-coordination.html — страница с heatmap.

    db/migrations/010_coordinated_actions_extend.sql — таблица coordinated_actions.

    config/coordination.json — конфиг с порогами.

    apis/sources/sources-api.mjs — API для источников (рядом).
