# Архитектура RSS-pipelines Crucix

**Документ:** docs/architecture/rss-pipelines.md
**Назначение:** зафиксировать два независимых pipeline обработки новостей в Crucix, их зоны ответственности, состав файлов и точки соприкосновения.
**Статус:** действующий архитектурный принцип.

---

## Принцип разделения

В Crucix работают два независимых pipeline обработки новостей. Каждый решает свою задачу. Каждый имеет собственные сборщики, нормализаторы, basket-файлы и API.

**Дублирование данных на уровне исходных URL допустимо.** Пересечение файлов по функции — запрещено.

**Правило:** ни один файл SmartScroll не читает данные Contract-v3 pipeline, и наоборот.

---

## Pipeline 1. SmartScroll — сложная обработка новостей

### Цель

Превратить поток разрозненных новостей в связные сюжеты с временной динамикой, с дедупликацией, кластеризацией, суммаризацией, bias-aware весом достоверности и ингестией в граф знаний.

### Что делает только SmartScroll

- Дедупликация 4 уровня: content hash → entity signature (Jaccard) → shingles Jaccard → cosine TF-IDF
- Кластеризация событий в stories через инвертированный индекс по сущностям (O(1) на событие)
- Суммаризация: extractive (TF-IDF + MMR) и abstractive (через Ollama)
- Таймлайн эволюции сюжета
- Определение геополитической полярности источника (russian / western / non_aligned)
- Bias-aware вес достоверности сюжета (bias_rank_weight)
- Ингестия в граф знаний через story-layer
- Хранение в story-store с поддержкой эволюции сюжетов
- Экспорт в граф знаний (узлы Story, TimelineEvent, Entity; рёбра contains, mentions, related_to, evolves_into)

### Состав файлов

Сборщики:
scripts/collectors/lib/base-collector.mjs — базовый класс
scripts/collectors/lib/rss-collector.mjs — RSS 2.0 + Atom
scripts/collectors/lib/telegram-collector.mjs — публичные Telegram-каналы
scripts/collectors/collect-smartscroll.mjs — сборщик SmartScroll

Обработка:
apis/sources/smartscroll-local/engine.mjs — ядро цикла
apis/sources/smartscroll-local/index.mjs — фабрика (external / local / auto)
apis/sources/smartscroll-local/processing/normalizer.mjs — нормализация + pole
apis/sources/smartscroll-local/processing/dedup.mjs — 4-уровневая дедупликация
apis/sources/smartscroll-local/processing/story-builder.mjs — кластеризация + bias_rank
apis/sources/smartscroll-local/processing/summarizer.mjs — суммаризация
apis/sources/smartscroll-local/processing/timeline.mjs — таймлайн
apis/sources/smartscroll-local/storage/story-store.mjs — хранилище сюжетов

Интерфейсы:
apis/sources/smartscroll-interface.mjs — общий интерфейс (Story, StoryEvent)
apis/sources/smartscroll.mjs — внешний адаптер с rate limiter и circuit breaker
apis/ingest/event-ingestion-api.mjs — HTTP-сервер (порт 3157)
apis/entity-model/story-layer.mjs — маппинг в граф знаний

Конфигурация:
config/smartscroll.json — конфигурация pipeline

text

### Выход

`data/basket/smartscroll-stories.json` — объекты Story:
- `id` — идентификатор сюжета (story_N)
- `title` — заголовок первого события
- `summary` — сводка
- `status` — статус (active)
- `start_time`, `end_time` — временные границы
- `entities[]` — уникальные сущности
- `events[]` — массив событий
- `related_stories[]` — id связанных сюжетов
- `bias_rank_weight` — эвристический вес достоверности (0-1)

### Потребители

- Граф знаний (узлы и рёбра)
- narrative-arena.html (сверка нарративов)
- story-timeline UI (если создан)
- Анализ эволюции нарративов

### Правило полярности

С каждого нормализованного события вычисляется `pole` через `apis/sources/source-camps.json`. Поле используется при кластеризации для cross-pole boost (+0.05) и при расчёте `bias_rank_weight`.

---

## Pipeline 2. Contract-v3 — плоский новостной поток

### Цель

Обеспечить быстрый доступ к каждой отдельной новости через API без тяжёлой обработки. Питание дашборда, convergence-анализаторов, narrative-drift, silence-patterns.

### Что делает только Contract-v3

- Единый OPML-каталог с атрибутами (pole, category, origin)
- Circuit breaker по фидам (2 ошибки → cooldown 5 минут)
- Классификация URL (direct / tor / dead)
- Быстрая нормализация без кластеризации
- Flat basket по схеме `crucix.basket.v1`
- Прямой API для плоского потока
- Питание convergence-анализаторов
- Накопление истории RSS для co-occurrence анализа
- Работа с Tor для западных источников

### Состав файлов
Сборщики:
scripts/collectors/collect-rss-unified.mjs — единый flat-сборщик (целевой)
scripts/collectors/collect-feeds.mjs — референс (3298 записей)
scripts/collectors/collect-rsshub.mjs — исторический (с backwardCompat)
scripts/collectors/collect-rss-universal.mjs — работающий (500 записей)

Кладовщик:
scripts/warehouse/managerbasket.mjs — нормализация raw → basket
scripts/warehouse/adapters/events.mjs — адаптер событий
scripts/warehouse/validate.mjs — валидация
scripts/warehouse/lineage.mjs — происхождение
scripts/warehouse/quality.mjs — метрики качества
scripts/warehouse/region-mapper.mjs — маппинг регионов

Классификация и обслуживание:
scripts/maintenance/check-urls.mjs — direct / tor / dead
scripts/snapshot-rsshub.mjs — накопление истории

API:
apis/sources/rss-feeds-api.mjs — flat API
apis/sources/news-api.mjs — API отдельных новостей
apis/sources/rss-manager-api.mjs — сервис управления

Анализаторы (потребители flat потока):
scripts/analyzers/rss-convergence.mjs — сходимость по источникам
scripts/analyzers/narrative-drift.mjs — дрейф нарратива
scripts/analyzers/silence-patterns.mjs — детектор замалчивания
scripts/analyzers/multi-source-corroboration.mjs — bias-aware corroboration

Конфигурация:
data/feeds/feeds-unified.opml — единый OPML (210 лент)
data/feeds/feeds-status.json — circuit breaker
data/feeds/urls-classified.json — классификация URL

text

### Выход

`data/basket/rss.json` — плоский массив новостей:
- `id` — хеш от URL + pubDate
- `title` — заголовок
- `url` — ссылка
- `pubDate` — ISO-дата
- `source` — имя источника
- `pole` — полярность источника (если определена)
- `description` — описание
- `category` — категория

Схема: `crucix.basket.v1`.

### Потребители

- Дашборд (rss-feeds.html, rss-dashboard.html)
- Convergence-анализаторы
- narrative-drift, silence-patterns
- multi-source-corroboration
- Flat API для внешних потребителей

### Правило Tor

Западные источники (BBC, DW, Reuters) берутся только через Tor SOCKS5 (порт 9050). Нестабильность — норма, не оптимизируется со стороны кода.

---

## Точки соприкосновения

Оба pipeline могут использовать **одни и те же исходные URL** (OPML-ленты) параллельно. Это не дублирование — это независимая обработка одного источника разными системами для разных целей.

**Запрещено:**
- SmartScroll читает данные из `data/basket/rss.json` (это flat-поток, не story)
- Contract-v3 pipeline читает `smartscroll-stories.json`
- Сборщик SmartScroll вызывает функции из `rss-collector.mjs` Contract-v3 (и наоборот)
- Нормализаторы обоих pipeline вызывают друг друга

**Разрешено:**
- Использование одних и тех же OPML-URL
- Использование `source-camps.json` для маппинга полярности (общий справочник)
- Использование `data/reference/countries.json` (общий справочник)
- Параллельные записи в basket (разные файлы)

---

## Принципы

1. **Разделение ответственности (SRP).** Каждый pipeline — эксперт в своей задаче.
2. **Независимое масштабирование.** Падение одного не останавливает другой.
3. **Тестируемость.** У каждого pipeline свои тесты, метрики, performance budget.
4. **Замена без переписывания.** Можно заменить один pipeline, не трогая другой.
5. **Никаких дублей по функции.** Дубли по данным — допустимы.
6. **Правило #1070 соблюдено.** Разные функции — разные файлы.
7. **Профессионализм, не компромисс.** Слои разные, файлы разные, цели разные.

---

## Связанные документы

- docs/help/ru/modules/smartscroll/INDEX.md — детальная документация SmartScroll
- data/schemas/basket.v1.json — схема basket Contract-v3
- ai-memory-sync/basket-architecture.md — архитектура basket
- RULES.txt — правило №14 (контракт v3), №4 (архитектура данных)
