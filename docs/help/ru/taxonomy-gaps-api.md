Файл: taxonomy-gaps-api.md
markdown

# API тематических разрывов: taxonomy-gaps-api.mjs

## Простое объяснение (для новичков)

Этот файл — «витрина» для данных о тематических разрывах. Он отдаёт результаты работы детектора, который ищет темы, освещаемые одной группой источников и игнорируемые другой.

**Что он делает:**

1. **Читает** файл `taxonomy-gaps.json` из «корзины».
2. **Фильтрует** по параметрам запроса: `severity`, `gap_type`, `topic_type`, `min_count`.
3. **Сортирует** по разным полям: `ratio` (соотношение), `total_events`, `russian`, `western`.
4. **Отдаёт** в формате JSON: массив тем с полями `topic`, `name`, `topic_type`, `russian_count`, `western_count`, `neutral_count`, `total_events`, `gap_type`, `severity`, `ratio`.

**Зачем это нужно:**

Дашборд `dashboard-signals.html` показывает тематические разрывы. Виджет `ticker.js` и другие запрашивают данные у этого API. Без него они не смогли бы получить данные.

**Аналогия:**

Это как витрина в магазине. За стеклом — товары (данные), отсортированные и разложенные по полочкам (фильтры, сортировка). Вы приходите и говорите: «Покажите мне самое важное». Витрина отдаёт то, что нужно.

---

## Научная база (для специалистов)

Модуль реализует паттерн **API Gateway** для данных о тематических разрывах, сгенерированных `taxonomy-multilayer.mjs`.

**Архитектура:**

- **Источник данных:** `data/basket/taxonomy-gaps.json` — файл, записанный анализатором.
- **Формат:** JSON с полями `schema`, `meta`, `topics`.
- **Fallback:** если файла нет — возвращает пустой массив с `error: 'not_found'`.
- **Кеширование:** результат кешируется на 5 минут (`CACHE_TTL_MS = 5 * 60 * 1000`).
- **Обогащение:** каждый topic дополняется вычисляемыми полями:
  - `ratio` — соотношение между группами.
  - `severityColor` — цвет для UI (`#ef4444` для `high`, `#22c55e` для `normal`).
  - `gapTypeLabel` — человекочитаемый ярлык (`western_silence` → «Западное молчание»).

**Контракт v2:**

Модуль экспортирует `route`, `method`, `meta`, `handler`. Это позволяет роутеру автоматически подхватить модуль при пересборке реестра.

**Подпути:**

- `GET /` — корень (список тем).
- `GET /stats` — агрегаты (сколько тем, распределение по severity, gap_type, topic_type).
- `GET /status` — health-check.
- `GET /topics` — все темы с фильтрами.
- `GET /topics/:topic` — конкретная тема.
- `GET /silence` — только `western_silence` / `russian_silence`.
- `GET /undercovered` — только `undercovered`.
- `GET /high` — только `severity=high`.
- `GET /top?n=N` — топ-N по `total_events`.
- `GET /categories` — группировка по `topic_type`.
- `GET /gap-types` — группировка по `gap_type`.

**Фильтры:**

- `?severity=high` — только `high`.
- `?gap_type=western_silence` — только `western_silence`.
- `?topic_type=country` — только страны.
- `?min_count=20` — только темы с `total_events >= 20`.
- `?q=россия` — поиск по названию темы.
- `?limit=50` — максимум тем.
- `?sort=ratio` — сортировка по `ratio`.

**Ограничения:**

- Работает только с файлом `taxonomy-gaps.json`. Если его нет — возвращает пустой массив.
- Не поддерживает пагинацию. Для больших корпусов — используйте `limit`.
- Не поддерживает запись. Только чтение.

---

## Как работает (пошагово)

1. `handler(req, res)` принимает HTTP-запрос.
2. Парсит `url.pathname` и `query`.
3. Проверяет кеш: если данные есть и не устарели (5 минут) — возвращает их сразу.
4. Если кеша нет — читает `data/basket/taxonomy-gaps.json`.
5. Парсит JSON, извлекает `topics`.
6. Обогащает каждый topic вычисляемыми полями.
7. Применяет фильтры: `severity`, `gap_type`, `topic_type`, `min_count`, `q`.
8. Применяет сортировку: `ratio`, `russian`, `western`, `total_events`.
9. Ограничивает `limit` (по умолчанию 100).
10. Возвращает JSON: `{ count, total, topics, _meta }`.

**Формат ответа для `/`:**

```json
{
  "_meta": {
    "count": 14,
    "source": "rsshub.json + taxonomy.json",
    "collected_at": "2026-11-02T08:35:00.000Z"
  },
  "count": 14,
  "total": 14,
  "topics": [
    {
      "topic": "россия",
      "name": "Россия",
      "topic_type": "country",
      "russian_count": 202,
      "western_count": 2,
      "neutral_count": 7,
      "total_events": 211,
      "gap_type": "western_undercovered",
      "severity": "high",
      "ratio": 101.0,
      "severityColor": "#ef4444",
      "gapTypeLabel": "Запад недопокрывает"
    }
  ]
}

Формат ответа для /stats:
json

{
  "stats": {
    "count": 14,
    "by_severity": { "high": 9, "normal": 5 },
    "by_gap_type": { "western_undercovered": 5, "western_silence": 4, "russian_silence": 1, "russian_undercovered": 4 },
    "by_topic_type": { "country": 5, "person": 4, "city": 2, "organization": 2, "region": 1 },
    "totals": {
      "russian_count": 577,
      "western_count": 30,
      "neutral_count": 45,
      "ratio": 19.2
    }
  },
  "source": "basket/taxonomy-gaps.json"
}

Пример использования

Базовый запрос:
bash

curl "http://127.0.0.1:3117/api/layers/taxonomy-gaps"

С фильтром по severity:
bash

curl "http://127.0.0.1:3117/api/layers/taxonomy-gaps?severity=high"

С фильтром по типу:
bash

curl "http://127.0.0.1:3117/api/layers/taxonomy-gaps?topic_type=country"

Только высокие с count > 20:
bash

curl "http://127.0.0.1:3117/api/layers/taxonomy-gaps?severity=high&min_count=20"

Топ-5 по total_events:
bash

curl "http://127.0.0.1:3117/api/layers/taxonomy-gaps/top?n=5"

Конкретная тема:
bash

curl "http://127.0.0.1:3117/api/layers/taxonomy-gaps/topics/россия"

Health-check:
bash

curl "http://127.0.0.1:3117/api/layers/taxonomy-gaps/status"

Практические рекомендации

    CACHE_TTL_MS = 5 * 60 * 1000 — 5 минут. Не увеличивайте без необходимости: данные в корзине могут обновляться.

    Fallback на ошибки — если файла нет, возвращает пустой массив с error: 'not_found'. Это защита от падения.

    Обогащение полями — ratio, severityColor, gapTypeLabel. Это упрощает работу виджетов: не нужно вычислять на клиенте.

    /stats — агрегаты. Полезно для дашбордов, которые показывают «сводку».

    /topics/:topic — конкретная тема. Если тема не найдена — возвращает 404 с error: 'topic not found'.

    /top?n=5 — топ-N по total_events. Полезно для «горячих» тем.

    /severity — группировка. Полезно для круговых диаграмм.

    /gap-types — группировка по типу. Полезно для фильтров.

    /categories — группировка по topic_type. Полезно для матриц.

    Сортировка по total_events — по умолчанию. Для других сортировок — ?sort=ratio.

    Не поддерживает запись. Только чтение. Все изменения — через taxonomy-multilayer.mjs.

    Для больших корпусов — используйте limit. По умолчанию 100. Больше — тормозит.

    limit=0 — вернёт пустой массив. Полезно для тестирования.

    ratio — соотношение между группами. 101.0 означает, что российских статей в 101 раз больше, чем западных. Это western_undercovered с high severity.

    gapTypeLabel — человекочитаемый ярлык. Полезно для UI. Не меняйте без необходимости.

Связанные модули

    scripts/analyzers/taxonomy-multilayer.mjs — анализатор, пишет taxonomy-gaps.json.

    dashboard/public/widgets/ticker.js — виджет, читает API.

    dashboard/public/dashboard-signals.html — страница с виджетами.

    data/basket/taxonomy-gaps.json — данные для чтения.

    config/taxonomy.json — словарь понятий.

    db/migrations/009_topic_gaps.sql — таблица topic_gaps.

    apis/sources/narrative-framing-api.mjs — API для поляризации (рядом).
