файл ядра — events-api.mjs


# API событий: events-api.mjs

## Простое объяснение (для новичков)

Этот файл — «витрина» для событий. Он отдаёт данные о кластерах новостей: когда несколько источников написали об одном и том же, система объединяет их в одно событие с весом и уровнем серьёзности.

**Что он делает:**
1. **Читает данные** из таблицы `events` в PostgreSQL или из корзины.
2. **Отдаёт список событий** — с полями `title`, `weight`, `severity`, `article_ids`, `first_published`, `last_published`, `sources_per_group`.
3. **Поддерживает фильтры** — по `severity`, `group`, `hours`, `min_weight`.
4. **Сортирует** — по весу (убывание) или по времени (свежие первыми).
5. **Кэширует** результат на 2 минуты.

**Зачем это нужно:**
Дашборд `dashboard-signals.html` показывает события. Виджет `events-list.js` запрашивает данные у этого API. Без него виджеты не смогли бы получить данные о кластерах.

**Аналогия:**
Это как витрина в магазине, где выставлены не отдельные товары (статьи), а наборы (события). Вы приходите и говорите: «Покажите мне самые важные наборы». Витрина отдаёт то, что нужно.

---

## Научная база
Модуль реализует паттерн **API Gateway** для данных о событиях (кластерах новостей), сгенерированных `cluster-events.mjs`.

**Архитектура:**
- **Источник данных:** таблица `events` в PostgreSQL (или корзина `events.json`).
- **Формат:** JSON с полями `id`, `title`, `weight`, `severity`, `article_ids`, `first_published`, `last_published`, `sources_per_group`.
- **Кеширование:** результат кешируется на 2 минуты (`CACHE_TTL_MS = 2 * 60 * 1000`).
- **Контракт v2:** экспортирует `route`, `method`, `meta`, `handler`.

**Подпути:**
- `GET /` — корень (список событий).
- `GET /stats` — агрегаты (сколько событий, распределение по severity, группам).
- `GET /status` — health-check.
- `GET /events` — все события с фильтрами.
- `GET /events/:id` — конкретное событие.
- `GET /high` — только `severity=high`.
- `GET /critical` — только `severity=critical`.
- `GET /top?n=N` — топ-N по `weight`.
- `GET /by-group` — группировка по группам источников.

**Фильтры:**
- `?severity=high` — только `high`.
- `?group=russian` — только события с российскими источниками.
- `?hours=6` — за последние 6 часов.
- `?min_weight=3` — только события с весом ≥ 3.
- `?limit=50` — максимум событий.

**Формально:**
Для каждого события `e` вычисляются:
- `weight(e)` — число источников, осветивших событие.
- `severity(e)` — уровень серьёзности: `normal`, `high`, `critical` (по порогам `weight`).
- `sources_per_group(e)` — распределение по группам (`russian`, `western`, `neutral`).

**Фильтрация:**
- `severity` — точное совпадение.
- `group` — наличие хотя бы одного источника этой группы.
- `hours` — `first_published >= NOW() - INTERVAL 'N hours'`.
- `min_weight` — `weight >= N`.

**Ограничения:**
- При большом количестве событий (> 10 000) запрос к БД может быть медленным. Для больших корпусов — пагинация.
- `article_ids` — массив ID статей. При больших событиях (> 100 статей) — большой JSON.
- Не поддерживает запись. Только чтение.

---

## Как работает (пошагово)

1. `handler(req, res)` принимает HTTP-запрос.
2. Парсит `url.pathname` и `query`.
3. Проверяет кеш: если данные есть и не устарели (2 минуты) — возвращает их сразу.
4. Если кеша нет — читает таблицу `events` из БД (или корзину).
5. Применяет фильтры: `severity`, `group`, `hours`, `min_weight`.
6. Применяет сортировку: по `weight` или `first_published`.
7. Ограничивает `limit` (по умолчанию 100).
8. Возвращает JSON: `{ count, total, events, _meta }`.

**Формат ответа для `/`:**

```json
{
  "_meta": {
    "count": 25,
    "source": "events",
    "collected_at": "2026-11-02T08:35:00.000Z"
  },
  "count": 25,
  "total": 323,
  "events": [
    {
      "id": 71,
      "title": "Нижегородская БПЛА",
      "weight": 9,
      "severity": "high",
      "article_ids": [1, 5, 12, 18, 23, 41, 55, 62, 78],
      "first_published": "2026-11-01T07:37:00.000Z",
      "last_published": "2026-11-01T12:12:00.000Z",
      "sources_per_group": {
        "russian": 8,
        "western": 0,
        "neutral": 1
      }
    }
  ]
}

Формат ответа для /stats:
json

{
  "stats": {
    "count": 323,
    "by_severity": {
      "normal": 300,
      "high": 20,
      "critical": 3
    },
    "by_group": {
      "russian": 250,
      "western": 50,
      "neutral": 23
    },
    "multi_source": 25,
    "compression_ratio": 1.15
  },
  "source": "events"
}

Пример использования

Базовый запрос:
bash

curl "http://127.0.0.1:3117/api/layers/events"

С фильтром по severity:
bash

curl "http://127.0.0.1:3117/api/layers/events?severity=high"

С фильтром по группе:
bash

curl "http://127.0.0.1:3117/api/layers/events?group=russian"

За последние 6 часов:
bash

curl "http://127.0.0.1:3117/api/layers/events?hours=6"

Только вес ≥ 5:
bash

curl "http://127.0.0.1:3117/api/layers/events?min_weight=5"

Топ-5 по весу:
bash

curl "http://127.0.0.1:3117/api/layers/events/top?n=5"

Конкретное событие:
bash

curl "http://127.0.0.1:3117/api/layers/events/71"

Health-check:
bash

curl "http://127.0.0.1:3117/api/layers/events/status"

Практические рекомендации

    CACHE_TTL_MS = 2 * 60 * 1000 — 2 минуты. Не увеличивайте без необходимости: события могут обновляться.

    Fallback на ошибки — если таблицы нет, возвращает пустой массив с error: 'not_found'. Это защита от падения.

    /stats — агрегаты. Полезно для дашбордов, которые показывают «сводку».

    /events/:id — конкретное событие. Если события нет — возвращает 404.

    /top?n=5 — топ-N по weight. Полезно для «самых важных».

    /high и /critical — фильтры по severity. Полезно для виджетов, которые показывают только важное.

    /by-group — группировка по группам. Полезно для матриц и диаграмм.

    Фильтр hours — за последние N часов. Не используйте для больших периодов (> 168 часов): медленно.

    min_weight — минимальный вес. Для показа «значимых» событий — min_weight: 3.

    Не поддерживает запись. Только чтение. Все изменения — через cluster-events.mjs.

    article_ids — массив ID статей. Может быть большим (> 100). Используйте с осторожностью.

    sources_per_group — распределение по группам. Полезно для анализа баланса.

    compression_ratio — во сколько раз сжались статьи в события. 1.15 означает, что 500 статей → 435 событий.

    multi_source — число событий с несколькими источниками. Показывает, сколько событий подтверждены.

    Для больших корпусов — используйте limit. По умолчанию 100. Больше — тормозит.

    limit=0 — вернёт пустой массив. Полезно для тестирования.

    Проверяйте /status — health-check. Если API недоступен — виджеты показывают «нет данных».

Связанные модули
    scripts/analyzers/cluster-events.mjs — создаёт события (пишет в таблицу events).
    db/migrations/005_events_and_yield.sql — таблица events.
    dashboard/public/widgets/events-list.js — виджет списка событий.
    dashboard/public/widgets/articles.js — виджет статей (рядом).
    dashboard/public/dashboard-signals.html — страница с виджетами.
    apis/sources/articles-api.mjs — API для статей (рядом).
    apis/sources/sources-api.mjs — API для источников (рядом).
    config/clustering.json — порог кластеризации.
