Файл: sources-api.md
markdown

# API источников: sources-api.mjs

## Простое объяснение (для новичков)

Этот файл — «справочная» по источникам. Он отвечает на вопросы: «Какие источники у нас есть? Сколько статей у каждого? Какая у них группа? Когда была последняя публикация?»

**Что он делает:**

1. **Читает данные** из «корзины» (`rss-latest.json`, `rsshub.json` и т.д.).
2. **Группирует по источникам** — для каждого источника считает количество статей и время последней публикации.
3. **Присваивает группу** — `russian`, `western`, `neutral` — по имени источника.
4. **Отдаёт в формате JSON** — массив источников с полями `source`, `group`, `count`, `first_seen`, `last_seen`.

**Зачем это нужно:**

Дашборд `dashboard-signals.html` показывает таблицу источников. Виджет `sources-table.js` запрашивает данные у этого API. Без него не было бы видно, откуда приходят новости.

**Аналогия:**

Это как телефонный справочник. Вы открываете и видите: вот все источники, вот их группы, вот сколько статей. Не нужно искать по всем новостям — всё уже сгруппировано.

---

## Научная база (для специалистов)

Модуль реализует паттерн **API Gateway** для данных об источниках, с fallback-цепочкой.

**Архитектура:**

- **Источник данных:** fallback-цепочка файлов (`rsshub.json → rss-latest.json → rss-universal.json → rss.json`).
- **Кеширование:** 2 минуты (`CACHE_TTL_MS = 2 * 60 * 1000`). Источники меняются реже, чем статьи, но достаточно часто.
- **Группировка:** `Map` по имени источника. Для каждого источника — счётчик, `first_seen`, `last_seen`.
- **Классификация:** паттерны из `RUSSIAN_PATTERNS` и `WESTERN_PATTERNS`. Если источник содержит паттерн — присваивается группа. Иначе — `neutral`.
- **Контракт v2:** экспортирует `route`, `method`, `meta`, `handler`.

**Подпути:**

- `GET /` — корень (список источников).
- `GET /stats` — агрегаты (сколько источников, сколько статей, распределение по группам).
- `GET /status` — health-check.
- `GET /feed-status` — статусы фидов (ok/error, last_seen).
- `GET /by-group` — группировка по группам.
- `GET /top?n=N` — топ-N по количеству статей.

**Формально:**

Для каждого item извлекается `source`. Если источника ещё нет в `Map` — создаётся запись с `count = 0`, `first_seen = null`, `last_seen = null`.

Для каждого item:
- `count++`.
- `first_seen = min(first_seen, published_at)`.
- `last_seen = max(last_seen, published_at)`.

**Классификация источников:**

```javascript
function classifySource(source) {
  if (!source) return 'neutral';
  const s = String(source);
  for (const p of RUSSIAN_PATTERNS) if (s.includes(p)) return 'russian';
  for (const p of WESTERN_PATTERNS) if (s.includes(p)) return 'western';
  return 'neutral';
}

Ограничения:

    Классификация по паттернам — грубая. Источник может быть российским, но не содержать паттернов. Тогда он попадает в neutral.

    Не поддерживает фильтрацию по времени. Для фильтрации — используйте articles-api.mjs.

    Не поддерживает пагинацию. Для больших корпусов — используйте limit.

Как работает (пошагово)

    handler(req, res) принимает HTTP-запрос.

    Парсит url.pathname и query.

    Проверяет кеш: если данные есть и не устарели (2 минуты) — возвращает их сразу.

    Если кеша нет — читает файлы из fallback-цепочки.

    Парсит JSON, извлекает items.

    Для каждого item извлекает source, pubDate.

    Обновляет Map источников: счётчик, first_seen, last_seen.

    Классифицирует источник в группу (russian, western, neutral).

    Сортирует по количеству статей (убывание).

    Возвращает JSON: { count, sources, _meta }.

Формат ответа для /:
json

{
  "count": 11,
  "sources": [
    {
      "source": "ТАСС",
      "sourceUrl": "",
      "group": "russian",
      "count": 120,
      "first_seen": "2026-11-01T00:00:00.000Z",
      "last_seen": "2026-11-02T08:32:49.000Z"
    },
    {
      "source": "Reuters",
      "sourceUrl": "",
      "group": "western",
      "count": 45,
      "first_seen": "2026-11-01T00:00:00.000Z",
      "last_seen": "2026-11-02T08:30:00.000Z"
    }
  ],
  "_meta": {
    "total": 11,
    "source": "basket/rss-latest.json",
    "loaded_at": "2026-11-02T08:35:00.000Z"
  }
}

Формат ответа для /stats:
json

{
  "stats": {
    "count": 11,
    "total_articles": 500,
    "by_group": {
      "russian": 7,
      "western": 2,
      "neutral": 2
    }
  },
  "source": "basket/rss-latest.json"
}

Формат ответа для /feed-status:
json

{
  "feeds": [
    {
      "source": "ТАСС",
      "group": "russian",
      "status": "ok",
      "count": 120,
      "last_seen": "2026-11-02T08:32:49.000Z"
    }
  ]
}

Формат ответа для /by-group:
json

{
  "groups": {
    "russian": {
      "count": 7,
      "articles": 385,
      "sources": ["ТАСС", "РИА", "Интерфакс", ...]
    },
    "western": {
      "count": 2,
      "articles": 115,
      "sources": ["Reuters", "Guardian"]
    },
    "neutral": {
      "count": 2,
      "articles": 0,
      "sources": ["France24", "Interfax"]
    }
  }
}

Пример использования

Базовый запрос:
bash

curl "http://127.0.0.1:3117/api/layers/sources"

С фильтром по группе:
bash

curl "http://127.0.0.1:3117/api/layers/sources/by-group"

Только статусы фидов:
bash

curl "http://127.0.0.1:3117/api/layers/sources/feed-status"

Топ-5 по количеству:
bash

curl "http://127.0.0.1:3117/api/layers/sources/top?n=5"

Health-check:
bash

curl "http://127.0.0.1:3117/api/layers/sources/status"

Практические рекомендации

    CACHE_TTL_MS = 2 * 60 * 1000 — 2 минуты. Источники меняются реже, чем статьи. Не увеличивайте без необходимости.

    Fallback-цепочка — не удаляйте старые файлы (rss.json, rss-universal.json). Они нужны, если новые пусты.

    classifySource — паттерны из RUSSIAN_PATTERNS и WESTERN_PATTERNS. Если источник не подходит ни под один паттерн — neutral. Добавьте новые паттерны, если нужно.

    first_seen / last_seen — показывают, когда источник впервые и последний раз появлялся в данных. Полезно для мониторинга «мёртвых» источников.

    /stats — агрегаты. Полезно для дашбордов, которые показывают «сводку».

    /feed-status — статусы фидов. Полезно для health-check.

    /by-group — группировка по группам. Полезно для матриц и диаграмм.

    /top?n=5 — топ-N по количеству. Полезно для «самых активных».

    Не поддерживает запись. Только чтение. Все изменения — через collect-rss-unified.mjs.

    Для больших корпусов — используйте limit. По умолчанию 100. Больше — тормозит.

    limit=0 — вернёт пустой массив. Полезно для тестирования.

    sourceUrl — пустая строка, если источник не указал URL в RSS. Не баг — это нормально.

    count — количество статей. Не путать с total_articles (в /stats).

Связанные модули

    apis/sources/articles-api.mjs — API для статей.

    apis/sources/rss-stats-api.mjs — API для агрегатов.

    dashboard/public/widgets/sources-table.js — виджет таблицы источников.

    dashboard/public/widgets/pie.js — круговая диаграмма (рядом).

    dashboard/public/dashboard-signals.html — страница с виджетами.

    config/feeds.json — список фидов (рядом).

    db/migrations/004_seed_sources.sql — начальные источники в БД.

    db/migrations/007_sources_feed_id.sql — feed_id в таблице sources.


