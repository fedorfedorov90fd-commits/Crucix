Файл: alerts-api.md

/Crucix/apis/sources/alerts-api.mjs

Справка
markdown

# API алертов: alerts-api.mjs

## Простое объяснение (для новичков)

Этот файл — «витрина» для алертов. Он отдаёт список всех тревог, которые создал движок алертов: какие события критичны, какие важны, какие — просто фон.

**Что он делает:**

1. **Читает** алерты из БД (таблица `alerts`) или из корзины.
2. **Фильтрует** по параметрам запроса: `severity`, `alert_type`, `hours`, `topic`.
3. **Сортирует** по времени (свежие первыми) или по серьёзности.
4. **Отдаёт** в формате JSON: массив алертов с полями `alert_type`, `severity`, `title`, `message`, `topic`, `created_at`.

**Зачем это нужно:**

Дашборд `dashboard-signals.html` показывает алерты. Виджет `ticker.js` запрашивает критические алерты. Виджет `real-chart.js` запрашивает распределение по типам. Без этого API они не смогли бы получить данные.

**Аналогия:**

Это как доска объявлений в офисе. На ней висят все важные сообщения: «Пожарная тревога», «Собрание в 15:00», «Кофе закончился». Вы подходите и читаете то, что важно. API алертов — такая доска, только для информационного поля.

---

## Научная база (для специалистов)

Модуль реализует паттерн **API Gateway** для данных алертов, сгенерированных `alert-engine.mjs` и сохранённых в `alert-dispatcher-api.mjs`.

**Архитектура:**

- **Источник данных:** таблица `alerts` в PostgreSQL (или корзина `alerts.json`).
- **Формат:** JSON с полями `alert_type`, `severity`, `title`, `message`, `topic`, `source_table`, `source_id`, `created_at`.
- **Кеширование:** результат кешируется на 1 минуту (`CACHE_TTL_MS = 60 * 1000`). Алерты меняются часто — кеш короткий.
- **Контракт v2:** экспортирует `route`, `method`, `meta`, `handler`.

**Подпути:**

- `GET /` — корень (список алертов).
- `GET /stats` — агрегаты (сколько алертов, распределение по severity, alert_type, topic).
- `GET /status` — health-check.
- `GET /alerts` — все алерты с фильтрами.
- `GET /alerts/:id` — конкретный алерт.
- `GET /high` — только `severity=high`.
- `GET /critical` — только `severity=critical`.
- `GET /recent?hours=N` — за последние N часов.
- `GET /top?n=N` — топ-N по времени.

**Фильтры:**

- `?severity=high` — только `high`.
- `?alert_type=silence_gap` — только `silence_gap`.
- `?topic=energy` — только по теме `energy`.
- `?hours=6` — за последние 6 часов.
- `?limit=50` — максимум алертов.

**Формально:**

Для каждого алерта `a` вычисляются:
- `severity(a)` — уровень: `critical`, `high`, `medium`, `low`.
- `alert_type(a)` — тип: `silence_gap`, `topic_gap`, `coordinated_event`, `framing_gap`, `feed_failure`.
- `topic(a)` — тема (если есть).

**Фильтрация:**

- `severity` — точное совпадение.
- `alert_type` — точное совпадение.
- `topic` — точное совпадение.
- `hours` — `created_at >= NOW() - INTERVAL 'N hours'`.

**Ограничения:**

- При большом количестве алертов (> 10 000) запрос к БД может быть медленным. Для больших корпусов — пагинация.
- Не поддерживает запись. Только чтение.
- Не поддерживает массовые операции (удаление, обновление статуса).

---

## Как работает (пошагово)

1. `handler(req, res)` принимает HTTP-запрос.
2. Парсит `url.pathname` и `query`.
3. Проверяет кеш: если данные есть и не устарели (1 минута) — возвращает их.
4. Если кеша нет — читает таблицу `alerts` из БД (или корзину).
5. Применяет фильтры: `severity`, `alert_type`, `topic`, `hours`.
6. Применяет сортировку: по `created_at` (свежие первыми).
7. Ограничивает `limit` (по умолчанию 100).
8. Возвращает JSON: `{ count, total, alerts, _meta }`.

**Формат ответа для `/`:**

```json
{
  "_meta": {
    "count": 11,
    "source": "alerts",
    "collected_at": "2026-11-02T08:35:00.000Z"
  },
  "count": 11,
  "total": 11,
  "alerts": [
    {
      "id": 1,
      "alert_type": "topic_gap",
      "severity": "high",
      "title": "Topic gap: россия",
      "message": "Тема 'россия' — western_undercovered. russian=202, western=2.",
      "topic": "россия",
      "source_table": "topic_gaps",
      "source_id": 1,
      "created_at": "2026-11-02T08:35:00.000Z"
    }
  ]
}

Формат ответа для /stats:
json

{
  "stats": {
    "count": 11,
    "by_severity": { "high": 8, "medium": 3 },
    "by_alert_type": {
      "silence_gap": 2,
      "topic_gap": 3,
      "framing_gap": 1,
      "feed_failure": 1,
      "coordinated_event": 4
    },
    "by_topic": { "россия": 3, "путин": 1, "китай": 1 }
  },
  "source": "alerts"
}

Пример использования

Базовый запрос:
bash

curl "http://127.0.0.1:3117/api/layers/alerts"

С фильтром по severity:
bash

curl "http://127.0.0.1:3117/api/layers/alerts?severity=high"

С фильтром по типу:
bash

curl "http://127.0.0.1:3117/api/layers/alerts?alert_type=silence_gap"

С фильтром по теме:
bash

curl "http://127.0.0.1:3117/api/layers/alerts?topic=energy"

Только критические:
bash

curl "http://127.0.0.1:3117/api/layers/alerts/critical"

За последние 6 часов:
bash

curl "http://127.0.0.1:3117/api/layers/alerts/recent?hours=6"

Конкретный алерт:
bash

curl "http://127.0.0.1:3117/api/layers/alerts/alerts/1"

Health-check:
bash

curl "http://127.0.0.1:3117/api/layers/alerts/status"

Практические рекомендации

    CACHE_TTL_MS = 60 * 1000 — 1 минута. Алерты меняются часто — кеш короткий. Не увеличивайте без необходимости.

    /high и /critical — фильтры по severity. Полезно для виджетов, которые показывают только важное.

    /recent?hours=N — за последние N часов. Полезно для «свежих» алертов.

    /top?n=5 — топ-N по времени. Полезно для «самых новых».

    /stats — агрегаты. Полезно для дашбордов, которые показывают «сводку».

    /alerts/:id — конкретный алерт. Если алерта нет — возвращает 404.

    Fallback — если таблицы нет, возвращает пустой массив с error: 'not_found'.

    Не поддерживает запись. Все изменения — через alert-dispatcher-api.mjs.

    Не поддерживает массовые операции. Для удаления старых алертов — отдельный скрипт или cron.

    Для больших корпусов — используйте limit. По умолчанию 100.

    limit=0 — вернёт пустой массив. Полезно для тестирования.

    by_topic — распределение по темам. Полезно для виджета «самые проблемные темы».

    by_alert_type — распределение по типам. Полезно для круговой диаграммы.

    Проверяйте /status — health-check. Если API недоступен — виджеты показывают «нет данных».

Связанные модули

    apis/sources/alert-dispatcher-api.mjs — создаёт алерты.

    scripts/alerting/alert-engine.mjs — движок правил.

    db/migrations/012_alerts.sql — таблица alerts.

    dashboard/public/widgets/ticker.js — виджет бегущей строки.

    dashboard/public/widgets/real-chart.js — график алертов.

    dashboard/public/dashboard-signals.html — страница с виджетами.

    config/alert.json — пороги для алертов.
