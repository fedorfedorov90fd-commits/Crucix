Файл: CRUCIX_RSS_INTEGRATION.md
markdown

# Интеграция RSS-системы: полное руководство

## Простое объяснение (для новичков)

Этот документ — «карта» того, как RSS-система Crucix устроена изнутри. Он объясняет, какие модули за что отвечают, как они связаны и как всё это запустить.

**Что такое RSS-система:**

RSS-система — это «пищеварительный тракт» платформы. Она забирает новости из интернета, очищает их от мусора, раскладывает по полочкам и передаёт аналитическим модулям. Без неё все остальные компоненты (графы, карты, индексы) работают «вхолостую» — им нечего анализировать.

**Из чего состоит:**

1. **Сборщики** — забирают новости из RSS-лент.
2. **Нормализаторы** — приводят даты и заголовки к единому виду.
3. **Дедупликаторы** — убирают повторы.
4. **Кластеризаторы** — объединяют новости в события.
5. **API-модули** — отдают данные дашбордам.
6. **Виджеты** — показывают данные на экране.

**Зачем это нужно:**

Если вы открыли дашборд и видите пустые графики — скорее всего, сломалась RSS-система. Если видите 10 000 точек в одном месте — не сработала дедупликация. Этот документ помогает понять, где искать проблему.

---

## Научная база (для специалистов)

RSS-система Crucix реализует конвейер **ETL (Extract, Transform, Load)** с элементами **NLP (Natural Language Processing)** и **кластеризации коротких текстов**.

**Архитектурные принципы:**

1. **Слабая связанность (loose coupling).** Каждый модуль выполняет одну задачу и не знает о внутреннем устройстве других. Сборщик не знает, как устроен дедупликатор; дедупликатор не знает, как устроен кластеризатор.
2. **Идемпотентность.** Повторный запуск модуля не создаёт дубликатов (через `ON CONFLICT DO NOTHING` или `DELETE` перед `INSERT`).
3. **Fallback-цепочки.** Если один источник данных недоступен — используется другой (`rsshub.json → rss-latest.json → rss-universal.json → rss.json`).
4. **Контракт v2.** Все API-модули экспортируют `route`, `method`, `meta`, `handler`. Это позволяет роутеру автоматически подхватывать модули.

**Поток данных:**

RSS-ленты → Сборщик → Нормализатор → Дедупликатор → Кластеризатор → БД → API → Виджеты
text


**Ключевые форматы:**

- **Сырой RSS** — XML с полями `title`, `link`, `pubDate`, `description`.
- **Нормализованный item** — JSON с полями `title`, `link`, `published_at`, `category`, `source`, `content`, `content_hash`.
- **Кластер (событие)** — JSON с полями `title`, `weight`, `severity`, `article_ids`.
- **API-ответ** — JSON с полями `count`, `items`, `_meta`.

---

## Как работает (пошагово)

### Шаг 1: Сбор

`collect-rss-unified.mjs` читает `config/feeds.json`, для каждого фида вызывает `fetchWithRetry()`, парсит XML через `rss-parser`. Результат — массив сырых items.

### Шаг 2: Нормализация

Каждый item проходит через:
- `parseFlexibleDate()` — 7 форматов дат.
- `normalizeUrl()` — убирает `utm_*`, `#`, trailing slash, http→https.
- `contentHash()` — SHA-256 от заголовка и тела.
- `titleSimilarity()` — Jaccard по шинглам.

### Шаг 3: Дедупликация

Внутрифидовый дедуп: `guid → normalized_link → content_hash → titleSimilarity (порог 0.9)`. Межфидовый дедуп: порог 0.92.

### Шаг 4: Кластеризация

`cluster-events.mjs` объединяет новости в события. Порог сходства — 0.45 (из `config/clustering.json`). Гибридная функция сходства: NE 0.55 + токены 0.35 + шинглы 0.10.

### Шаг 5: Запись в БД

`rss-to-db.mjs` записывает items в таблицу `articles` через `INSERT ... ON CONFLICT DO NOTHING`. Кластеры — в таблицу `events`.

### Шаг 6: API

`apis/sources/articles-api.mjs` отдаёт статьи. `apis/sources/sources-api.mjs` — источники. `apis/sources/rss-stats-api.mjs` — агрегаты. Все читают из «корзины» (файлов `rss-*.json`) с fallback-цепочкой.

### Шаг 7: Виджеты

`dashboard/public/widgets/articles.js` показывает список статей. `coordination-heatmap.js` — матрицу синхронности. `narrative-scatter.js` — поляризацию.

---

## Пример использования

**Запуск сбора:**

```bash
cd "/home/ta8_/Рабочий стол/Crucix"
node --env-file=.env scripts/collectors/collect-rss-unified.mjs

Запуск кластеризации:
bash

node --env-file=.env scripts/analyzers/cluster-events.mjs

Проверка API:
bash

curl "http://127.0.0.1:3117/api/layers/articles?limit=20"
curl "http://127.0.0.1:3117/api/layers/sources"
curl "http://127.0.0.1:3117/api/layers/rss-stats"

Открыть дашборд:
text

http://127.0.0.1:3117/dashboard-signals

Практические рекомендации

    Порядок запуска: сначала сбор, потом кластеризация, потом API, потом виджеты. Если запустить кластеризацию без сбора — она обработает старые данные.

    config/feeds.json — основной список фидов. Добавляйте новые фиды туда, а не в код.

    config/clustering.json — порог 0.45. Калибруйте под свой поток (см. справку clustering.md).

    Fallback-цепочка — не удаляйте старые файлы (rss.json, rss-universal.json). Они нужны, если новые пусты.

    Кеш 2 минуты — API кеширует результаты. Если данные не обновляются — подождите 2 минуты или перезапустите сервер.

    DELETE FROM information_gaps перед пересборкой — метрика пересчитываемая.

    max_spread_minutes: 360 для RSS, не 60. RSS публикует с задержкой в часы.

    DD.MM.YYYY проверяется до нативного парсера — иначе V8 парсит как MM.DD.

    rss-parser.parseString(xml) — не response.json(). RSS — это XML.

    Проверка /api/layers/articles/status — health-check. Если API недоступен — виджеты показывают «нет данных».

    Логи — [rss] feed_id: N raw → M unique. Помогают понять, сколько items собрано с каждого фида.

    feed_status — таблица со статусами фидов. Показывает, какие фиды работают, а какие падают.

    errors — массив ошибок. Если фид упал — он попадёт сюда, а не в items.

Связанные модули
Сборщики

    scripts/collectors/collect-rss-unified.mjs — RSS-сборщик.

    scripts/collectors/collect-yield-curve.mjs — Treasury OData XML.

Нормализаторы

    scripts/utils/date-parser.mjs — 7 форматов дат.

    scripts/utils/string-similarity.js — Jaccard, шинглы, стоп-слова.

Анализаторы

    scripts/analyzers/cluster-events.mjs — кластеризация.

    scripts/analyzers/taxonomy-multilayer.mjs — тематические gaps.

    scripts/analyzers/source-coordination.mjs — пары фидов.

    scripts/analyzers/contrast-engine.mjs — поляризация.

    scripts/analyzers/source-profiler.mjs — профили источников.

    scripts/analyzers/geospatial-analyst.mjs — гео-плотность.

    scripts/analyzers/alert-engine.mjs — алерты.

API-модули

    apis/sources/articles-api.mjs — статьи.

    apis/sources/sources-api.mjs — источники.

    apis/sources/rss-stats-api.mjs — агрегаты.

    apis/sources/silence-api.mjs — разрывы.

    apis/sources/taxonomy-gaps-api.mjs — тематические gaps.

    apis/sources/narrative-framing-api.mjs — поляризация.

    apis/sources/alert-dispatcher-api.mjs — алерты.

Виджеты

    dashboard/public/widgets/articles.js — список статей.

    dashboard/public/widgets/sources-table.js — таблица источников.

    dashboard/public/widgets/coordination-heatmap.js — heatmap.

    dashboard/public/widgets/narrative-scatter.js — scatter.

    dashboard/public/widgets/rss-graph.js — граф.

    dashboard/public/widgets/rss-map.js — карта.

    dashboard/public/widgets/ticker.js — бегущая строка.

    dashboard/public/widgets/wordcloud.js — облако слов.

    dashboard/public/widgets/pie.js — круговая диаграмма.

    dashboard/public/widgets/source-matrix.js — матрица источников.

    dashboard/public/widgets/real-chart.js — график.

Конфиги

    config/feeds.json — список фидов.

    config/clustering.json — порог кластеризации.

    config/taxonomy.json — словарь понятий.

    config/silence.json — пороги для разрывов.

    config/coordination.json — пороги для координации.

    config/contrast.json — пороги для поляризации.

    config/alert.json — пороги для алертов.

БД

    db/migrations/002_alternative_optics.sql — базовые таблицы.

    db/migrations/003_rss_dedup.sql — поля для дедупа.

    db/migrations/004_seed_sources.sql — начальные источники.

    db/migrations/005_events_and_yield.sql — события и yield.

    db/migrations/006_articles_date_format_fallback.sql — fallback дат.

    db/migrations/007_sources_feed_id.sql — feed_id в источниках.

    db/migrations/008_information_gaps_extend.sql — расширение gaps.

    db/migrations/009_topic_gaps.sql — тематические gaps.

    db/migrations/010_coordinated_actions_extend.sql — расширение координации.

    db/migrations/011_framing_gaps.sql — поляризация.

    db/migrations/012_alerts.sql — алерты.

Дашборды

    dashboard/public/dashboard-signals.html — 9 виджетов.

    dashboard/public/dashboard-narrative.html — scatter + matrix.

    dashboard/public/dashboard-coordination.html — heatmap + sources.

    dashboard/public/dashboard-network.html — граф.

    dashboard/public/widgets-preview.html — тест виджетов.
