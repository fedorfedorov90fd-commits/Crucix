Файл: silence-api.md
markdown

# API информационного молчания: silence-api.mjs

## Простое объяснение (для новичков)

Этот файл — «витрина» для данных о молчании. Он отдаёт результаты работы детектора, который ищет темы, о которых молчат.

**Что он делает:**

1. **Читает** файл `silence.json` из «корзины».
2. **Фильтрует** по параметрам запроса: `severity`, `gap_type`, `region`.
3. **Сортирует** по разным полям: `drop` (падение), `baseline` (базовый уровень), `current` (текущий уровень).
4. **Отдаёт** в формате JSON: массив тем с полями `topic`, `gap_type`, `severity`, `russian_count`, `western_count`, `total_events`.

**Зачем это нужно:**

Дашборд `dashboard-signals.html` показывает разрывы. Виджет `ticker.js` и другие запрашивают данные у этого API. Без него они не смогли бы получить данные.

**Аналогия:**

Это как витрина в магазине. За стеклом — товары (данные), отсортированные и разложенные по полочкам (фильтры, сортировка). Вы приходите и говорите: «Покажите мне самое важное». Витрина отдаёт то, что нужно.

---

## Научная база (для специалистов)

Модуль реализует паттерн **API Gateway** для данных о «информационном молчании», сгенерированных `silence-detector.mjs`.

**Архитектура:**

- **Источник данных:** `data/basket/silence.json` — файл, записанный анализатором.
- **Формат:** JSON с полями `schema`, `meta`, `regions`.
- **Fallback:** если файла нет — возвращает пустой массив с `error: 'not_found'`.
- **Кеширование:** результат кешируется на 5 минут (`CACHE_TTL_MS = 5 * 60 * 1000`).
- **Обогащение:** каждый регион дополняется вычисляемыми полями:
  - `ratio` — соотношение между группами.
  - `severityColor` — цвет для UI (`#ef4444` для `high`, `#22c55e` для `normal`).
  - `gapTypeLabel` — человекочитаемый ярлык (`western_silence` → «Западное молчание»).

**Контракт v2:**

Модуль экспортирует `route`, `method`, `meta`, `handler`. Это позволяет роутеру автоматически подхватить модуль при пересборке реестра.

**Подпути:**

- `GET /` — корень (список регионов).
- `GET /stats` — агрегаты (сколько регионов, распределение по severity, gap_type).
- `GET /status` — health-check.
- `GET /regions` — все регионы с фильтрами.
- `GET /regions/:region` — конкретный регион.
- `GET /silence` — только `silence`.
- `GET /undercovered` — только `undercovered`.
- `GET /high` — только `severity=high`.
- `GET /top?n=N` — топ-N по `ratio`.
- `GET /categories` — группировка по `gap_type`.

**Фильтры:**

- `?severity=high` — только `high`.
- `?gap_type=western_silence` — только `western_silence`.
- `?region=russian` — только `russian`.
- `?min_drop=0.5` — только регионы с `drop >= 0.5`.
- `?limit=50` — максимум регионов.
- `?sort=drop` — сортировка по `drop`.

**Ограничения:**

- Работает только с файлом `silence.json`. Если его нет — возвращает пустой массив.
- Не поддерживает пагинацию. Для больших корпусов — используйте `limit`.
- Не поддерживает запись. Только чтение.

---

## Как работает (пошагово)

1. `handler(req, res)` принимает HTTP-запрос.
2. Парсит `url.pathname` и `query`.
3. Проверяет кеш: если данные есть и не устарели (5 минут) — возвращает их сразу.
4. Если кеша нет — читает `data/basket/silence.json`.
5. Парсит JSON, извлекает `regions`.
6. Обогащает каждый регион вычисляемыми полями.
7. Применяет фильтры: `severity`, `gap_type`, `region`, `min_drop`.
8. Применяет сортировку: `drop`, `baseline`, `current`.
9. Ограничивает `limit` (по умолчанию 100).
10. Возвращает JSON: `{ count, total, regions, _meta }`.

**Формат ответа для `/`:**

```json
{
  "_meta": {
    "count": 3,
    "source": "basket/silence.json",
    "collected_at": "2026-11-02T08:35:00.000Z"
  },
  "count": 3,
  "total": 3,
  "regions": [
    {
      "id": "russian",
      "name": "Российские СМИ",
      "status": "normal",
      "drop": 0,
      "baseline": 443,
      "current": 443,
      "ratio": 1.0,
      "severityColor": "#22c55e",
      "gapTypeLabel": "Норма"
    }
  ]
}

Формат ответа для /stats:
json

{
  "stats": {
    "count": 3,
    "by_status": { "normal": 3 },
    "by_severity": { "normal": 3 },
    "totals": {
      "baseline": 500,
      "current": 500,
      "drop": 0
    }
  },
  "source": "basket/silence.json"
}

Пример использования

Базовый запрос:
bash

curl "http://127.0.0.1:3117/api/layers/silence"

С фильтром по severity:
bash

curl "http://127.0.0.1:3117/api/layers/silence?severity=high"

С фильтром по типу:
bash

curl "http://127.0.0.1:3117/api/layers/silence?gap_type=western_silence"

Только высокие с drop > 0.5:
bash

curl "http://127.0.0.1:3117/api/layers/silence?severity=high&min_drop=0.5"

Топ-5 по ratio:
bash

curl "http://127.0.0.1:3117/api/layers/silence/top?n=5"

Конкретный регион:
bash

curl "http://127.0.0.1:3117/api/layers/silence/regions/russian"

Health-check:
bash

curl "http://127.0.0.1:3117/api/layers/silence/status"

Практические рекомендации

    CACHE_TTL_MS = 5 * 60 * 1000 — 5 минут. Не увеличивайте без необходимости: данные в корзине могут обновляться.

    Fallback на ошибки — если файла нет, возвращает пустой массив с error: 'not_found'. Это защита от падения.

    Обогащение полями — ratio, severityColor, gapTypeLabel. Это упрощает работу виджетов: не нужно вычислять на клиенте.

    /stats — агрегаты. Полезно для дашбордов, которые показывают «сводку».

    /regions/:region — конкретный регион. Если регион не найден — возвращает 404 с error: 'region not found'.

    /top?n=5 — топ-N по ratio. Полезно для «горячих» регионов.

    /categories — группировка по gap_type. Полезно для фильтров.

    /silence — только silence. Полезно для виджета, который показывает только молчание.

    /undercovered — только undercovered. Полезно для виджета, который показывает только «недопокрытие».

    Сортировка по drop — по умолчанию. Для других сортировок — ?sort=baseline.

    Не поддерживает запись. Только чтение. Все изменения — через silence-detector.mjs.

    Для больших корпусов — используйте limit. По умолчанию 100. Больше — тормозит.

    limit=0 — вернёт пустой массив. Полезно для тестирования.

Связанные модули

    scripts/analyzers/silence-detector.mjs — анализатор, пишет silence.json.

    dashboard/public/widgets/ticker.js — виджет, читает API.

    dashboard/public/dashboard-signals.html — страница с виджетами.

    data/basket/silence.json — данные для чтения.

    config/silence.json — конфиг с порогами.

    db/migrations/008_information_gaps_extend.sql — таблица information_gaps.


