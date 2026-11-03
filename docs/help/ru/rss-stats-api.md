Файл: rss-stats-api.md
markdown

# API агрегатов RSS: rss-stats-api.mjs

## Простое объяснение (для новичков)

Этот файл — «счётчик» системы. Он отвечает на вопросы: «Сколько всего статей? Сколько за последний час? Сколько от каждой группы источников? Какие источники самые активные?»

**Что он делает:**

1. **Читает данные** из «корзины» (`rss-latest.json`, `rsshub.json` и т.д.).
2. **Считает агрегаты** — общее число статей, распределение по группам, по часам, по дням.
3. **Отдаёт в формате JSON** — массив или объект с числами.

**Зачем это нужно:**

Дашборд `dashboard-signals.html` показывает графики и цифры. Виджет `real-chart.js` запрашивает данные у этого API. Без него не было бы видно, сколько статей и как они распределены.

**Аналогия:**

Это как счётчик в магазине. Он не продаёт товары, не хранит их, не доставляет. Он просто считает: «сколько продано», «сколько осталось», «что популярно». API делает то же самое с новостями.

---

## Научная база (для специалистов)

Модуль реализует паттерн **aggregation API** — вычисление агрегатов над набором данных без их модификации.

**Архитектура:**

- **Источник данных:** fallback-цепочка файлов (`rsshub.json → rss-latest.json → rss-universal.json → rss.json`).
- **Кеширование:** 60 секунд (`CACHE_TTL_MS = 60 * 1000`). Быстрое обновление: агрегаты меняются при каждой новой статье.
- **Группировка:** по группам (`russian`, `western`, `neutral`), по часам, по дням, по источникам.
- **Нормализация:** каждый item приводится к единому формату (`source`, `pubDate`).
- **Контракт v2:** экспортирует `route`, `method`, `meta`, `handler`.

**Подпути:**

- `GET /` — полные агрегаты.
- `GET /stats` — то же (алиас).
- `GET /status` — health-check.
- `GET /by-hour` — распределение по часам (`[{hour, count}]`).
- `GET /by-day` — распределение по дням (`[{day, count}]`).
- `GET /by-group` — распределение по группам (`[{name, count}]`).

**Формально:**

Для каждого item извлекается:
- `group = classifySource(item.source)` — `russian`, `western`, `neutral`.
- `hour = extractHour(item.pubDate)` — `YYYY-MM-DDTHH`.
- `day = extractDay(item.pubDate)` — `YYYY-MM-DD`.

Агрегаты:
- `by_group[g] = count(items where group == g)`.
- `by_hour[h] = count(items where hour == h)`.
- `by_day[d] = count(items where day == d)`.

**Классификация источников:**

Используются паттерны из `RUSSIAN_PATTERNS` и `WESTERN_PATTERNS`:

```javascript
const RUSSIAN_PATTERNS = ['РИА', 'ТАСС', 'Интерфакс', 'RT', 'Известия', ...];
const WESTERN_PATTERNS = ['Guardian', 'BBC', 'NYT', 'Reuters', ...];

Если источник содержит паттерн — присваивается группа. Иначе — neutral.

Ограничения:

    Агрегаты вычисляются на лету. При большом объёме данных (> 10 000 items) — медленно.

    Кеш 60 секунд. Если данные обновились, но кеш не истёк — API отдаёт старые агрегаты.

    Не поддерживает фильтры по времени. Для фильтрации — используйте articles-api.mjs.

Как работает (пошагово)

    handler(req, res) принимает HTTP-запрос.

    Парсит url.pathname.

    Проверяет кеш: если данные есть и не устарели (60 секунд) — возвращает их сразу.

    Если кеша нет — читает файлы из fallback-цепочки.

    Парсит JSON, извлекает items.

    Для каждого item извлекает group, hour, day.

    Считает агрегаты: by_group, by_hour, by_day, with_date.

    Возвращает JSON в зависимости от подпути.

Формат ответа для /:
json

{
  "stats": {
    "total": 500,
    "with_date": 480,
    "by_group": {
      "russian": 385,
      "western": 115,
      "neutral": 0
    },
    "by_hour": [
      { "hour": "2026-11-02T08", "count": 15 },
      { "hour": "2026-11-02T09", "count": 22 }
    ],
    "by_day": [
      { "day": "2026-11-01", "count": 120 },
      { "day": "2026-11-02", "count": 380 }
    ]
  },
  "generated_at": "2026-11-02T08:35:00.000Z"
}

Формат ответа для /by-group:
json

{
  "groups": [
    { "name": "russian", "count": 385 },
    { "name": "western", "count": 115 },
    { "name": "neutral", "count": 0 }
  ]
}

Пример использования

Базовый запрос:
bash

curl "http://127.0.0.1:3117/api/layers/rss-stats"

Только по группам:
bash

curl "http://127.0.0.1:3117/api/layers/rss-stats/by-group"

Только по часам:
bash

curl "http://127.0.0.1:3117/api/layers/rss-stats/by-hour"

Только по дням:
bash

curl "http://127.0.0.1:3117/api/layers/rss-stats/by-day"

Health-check:
bash

curl "http://127.0.0.1:3117/api/layers/rss-stats/status"

Что вернёт /status:
json

{
  "status": "online",
  "count": 500,
  "generated_at": "2026-11-02T08:35:00.000Z"
}

Практические рекомендации

    CACHE_TTL_MS = 60 — 60 секунд. Быстрое обновление: агрегаты меняются при каждой новой статье. Не увеличивайте без необходимости.

    Fallback-цепочка — не удаляйте старые файлы (rss.json, rss-universal.json). Они нужны, если новые пусты.

    classifySource — паттерны из RUSSIAN_PATTERNS и WESTERN_PATTERNS. Если источник не подходит ни под один паттерн — neutral. Добавьте новые паттерны, если нужно.

    extractHour / extractDay — извлекают час/день из pubDate. Если дата некорректна — возвращают null, item не попадает в агрегаты по времени.

    with_date — число items с валидной датой. Если with_date < total — есть битые даты.

    by_hour — сортируется по времени. Это важно для графиков.

    by_day — сортируется по дате. Это важно для графиков.

    /by-group — для круговых диаграмм. Простой формат [{name, count}].

    /status — health-check. Если API недоступен — виджеты показывают «нет данных».

    Не используйте для фильтрации. Этот API отдаёт агрегаты, а не items. Для фильтрации — articles-api.mjs.

    Не используйте для больших корпусов. При > 10 000 items — медленно. Для больших корпусов — предварительная агрегация в БД.

Связанные модули

    apis/sources/articles-api.mjs — API для статей (с фильтрами).

    apis/sources/sources-api.mjs — API для источников.

    dashboard/public/widgets/pie.js — круговая диаграмма (использует /by-group).

    dashboard/public/widgets/real-chart.js — график (использует /stats).

    dashboard/public/dashboard-signals.html — страница с виджетами.

    config/feeds.json — список фидов (рядом).
