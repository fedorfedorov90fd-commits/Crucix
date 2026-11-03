Файл: narrative-framing-api.md
markdown

# API поляризации нарративов: narrative-framing-api.mjs

## Простое объяснение (для новичков)

Этот файл — «витрина» для данных о поляризации нарративов. Он отдаёт результаты сравнения того, как разные группы источников описывают одни и те же темы.

**Что он делает:**

1. **Читает** файл `narrative-framing.json` из «корзины».
2. **Фильтрует** по параметрам запроса: `severity`, `gap_type`, `topic_type`.
3. **Сортирует** по разным полям: `delta` (разница тональностей), `latency` (задержка), `russian`, `western`.
4. **Отдаёт** в формате JSON: массив тем с полями `topic`, `polarity_russian`, `polarity_western`, `polarity_delta`, `latency_hours`, `gap_type`, `severity`.

**Зачем это нужно:**

Дашборд `dashboard-narrative.html` показывает scatter-график. Виджет `narrative-scatter.js` запрашивает данные у этого API. Без него виджет не смог бы получить данные.

**Аналогия:**

Это как витрина в магазине. За стеклом — товары (данные), отсортированные и разложенные по полочкам (фильтры, сортировка). Вы приходите и говорите: «Покажите мне самое полярное». Витрина отдаёт то, что нужно.

---

## Научная база (для специалистов)

Модуль реализует паттерн **API Gateway** для данных о поляризации нарративов, сгенерированных `contrast-engine.mjs` (слитым в `narrative-splitter-api.mjs`).

**Архитектура:**

- **Источник данных:** `data/basket/narrative-framing.json` — файл, записанный анализатором.
- **Формат:** JSON с полями `schema`, `meta`, `topics`.
- **Fallback:** если файла нет — возвращает пустой массив с `error: 'not_found'`.
- **Кеширование:** результат кешируется на 5 минут (`CACHE_TTL_MS = 5 * 60 * 1000`).
- **Обогащение:** каждый topic дополняется вычисляемыми полями:
  - `abs_delta` — абсолютное значение `polarity_delta`.
  - `severityColor` — цвет для UI (`#ef4444` для `high`, `#22c55e` для `normal`).
  - `gapTypeLabel` — человекочитаемый ярлык (`framing_gap` → «Разрыв фрейминга»).

**Контракт v2:**

Модуль экспортирует `route`, `method`, `meta`, `handler`. Это позволяет роутеру автоматически подхватить модуль при пересборке реестра.

**Подпути:**

- `GET /` — корень (список тем).
- `GET /stats` — агрегаты (сколько тем, распределение по severity, gap_type, topic_type).
- `GET /status` — health-check.
- `GET /topics` — все темы с фильтрами.
- `GET /topics/:topic` — конкретная тема.
- `GET /framing` — только `framing_gap`.
- `GET /reaction` — только `reaction_gap`.
- `GET /high` — только `severity=high`.
- `GET /top?n=N` — топ-N по `abs_delta`.
- `GET /categories` — группировка по `topic_type`.
- `GET /severity` — группировка по `severity`.
- `GET /gap-types` — группировка по `gap_type`.

**Фильтры:**

- `?severity=high` — только `high`.
- `?gap_type=framing_gap` — только `framing_gap`.
- `?topic_type=country` — только страны.
- `?min_delta=0.5` — только темы с `abs_delta >= 0.5`.
- `?q=россия` — поиск по названию темы.
- `?limit=50` — максимум тем.
- `?sort=latency` — сортировка по задержке.

**Ограничения:**

- Работает только с файлом `narrative-framing.json`. Если его нет — возвращает пустой массив.
- Не поддерживает пагинацию. Для больших корпусов — используйте `limit`.
- Не поддерживает запись. Только чтение.

---

## Как работает (пошагово)

1. `handler(req, res)` принимает HTTP-запрос.
2. Парсит `url.pathname` и `query`.
3. Проверяет кеш: если данные есть и не устарели (5 минут) — возвращает их сразу.
4. Если кеша нет — читает `data/basket/narrative-framing.json`.
5. Парсит JSON, извлекает `topics`.
6. Обогащает каждый topic вычисляемыми полями.
7. Применяет фильтры: `severity`, `gap_type`, `topic_type`, `min_delta`, `q`.
8. Применяет сортировку: `delta`, `russian`, `western`, `latency`.
9. Ограничивает `limit` (по умолчанию 100).
10. Возвращает JSON: `{ count, total, topics, _meta }`.

**Формат ответа для `/`:**

```json
{
  "_meta": {
    "count": 7,
    "source": "rsshub.json + taxonomy.json",
    "collected_at": "2026-11-02T08:35:00.000Z"
  },
  "count": 7,
  "total": 7,
  "topics": [
    {
      "topic": "москва",
      "topic_type": "city",
      "polarity_russian": -0.05,
      "polarity_western": -1.00,
      "polarity_delta": 0.95,
      "abs_delta": 0.95,
      "russian_count": 5,
      "western_count": 1,
      "latency_hours": null,
      "gap_type": "framing_gap",
      "severity": "high",
      "severityColor": "#ef4444",
      "gapTypeLabel": "Разрыв фрейминга"
    }
  ]
}

Формат ответа для /stats:
json

{
  "stats": {
    "count": 7,
    "by_severity": { "high": 2, "normal": 5 },
    "by_gap_type": { "framing_gap": 6, "reaction_gap": 1 },
    "by_topic_type": { "city": 2, "country": 3, "person": 1, "region": 1 },
    "totals": {
      "russian_count": 145,
      "western_count": 42,
      "neutral_count": 8
    }
  },
  "source": "basket/narrative-framing.json"
}

Пример использования

Базовый запрос:
bash

curl "http://127.0.0.1:3117/api/layers/narrative-framing"

С фильтром по severity:
bash

curl "http://127.0.0.1:3117/api/layers/narrative-framing?severity=high"

С фильтром по типу:
bash

curl "http://127.0.0.1:3117/api/layers/narrative-framing?gap_type=framing_gap"

Только высокие с delta > 0.5:
bash

curl "http://127.0.0.1:3117/api/layers/narrative-framing?severity=high&min_delta=0.5"

Топ-5 по delta:
bash

curl "http://127.0.0.1:3117/api/layers/narrative-framing/top?n=5"

Конкретная тема:
bash

curl "http://127.0.0.1:3117/api/layers/narrative-framing/topics/москва"

Health-check:
bash

curl "http://127.0.0.1:3117/api/layers/narrative-framing/status"

Практические рекомендации

    CACHE_TTL_MS = 5 * 60 * 1000 — 5 минут. Не увеличивайте без необходимости: данные в корзине могут обновляться.

    Fallback на ошибки — если файла нет, возвращает пустой массив с error: 'not_found'. Это защита от падения.

    Обогащение полями — abs_delta, severityColor, gapTypeLabel. Это упрощает работу виджетов: не нужно вычислять на клиенте.

    /stats — агрегаты. Полезно для дашбордов, которые показывают «сводку».

    /topics/:topic — конкретная тема. Если тема не найдена — возвращает 404 с error: 'topic not found'.

    /top?n=5 — топ-N по abs_delta. Полезно для «горячих» тем.

    /severity — группировка. Полезно для круговых диаграмм.

    /gap-types — группировка по типу. Полезно для фильтров.

    /categories — группировка по topic_type. Полезно для матриц.

    Сортировка по delta — по умолчанию. Для других сортировок — ?sort=latency.

    Не поддерживает запись. Только чтение. Все изменения — через contrast-engine.mjs.

    Для больших корпусов — используйте limit. По умолчанию 100. Больше — тормозит.

    limit=0 — вернёт пустой массив. Полезно для тестирования.

Связанные модули

    scripts/analyzers/contrast-engine.mjs — анализатор, пишет narrative-framing.json.

    dashboard/public/widgets/narrative-scatter.js — виджет, читает API.

    dashboard/public/dashboard-narrative.html — страница с scatter.

    data/basket/narrative-framing.json — данные для чтения.

    config/contrast.json — конфиг с порогами.

    db/migrations/011_framing_gaps.sql — таблица framing_gaps.
