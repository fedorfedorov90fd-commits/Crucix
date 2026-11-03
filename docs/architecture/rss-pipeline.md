# Crucix — Паспорт RSS-системы

**Состояние на:** 2026-10-21, 23:30 MSK
**Версия документа:** 1.0.0
**Статус:** действующая архитектура, Этап 1 закрыт
**Автор:** Crucix (AI-ассистент под руководством хозяина)

---

## 1. Назначение

Документ фиксирует полное устройство RSS-подсистемы Crucix: все файлы,
их роли, связи, потоки данных. При загрузке этого файла в новом чате
контекст восстанавливается без повторного аудита.

---

## 2. Схема потоков данных

ВНЕШНИЕ ИСТОЧНИКИ
├── RSS Guard (портативный, database.db SQLite) — транзит 450 лент, в разработке
├── Прямые RSS/Atom (feeds-unified.opml, 210 URL; feeds.opml, 43 ленты)
└── GDELT, NewsAPI (отдельные сборщики)

│
▼

СЛОЙ 1. СБОРЩИКИ (scripts/collectors/) — единственные, кто ходит в интернет
├── collect-rsshub.mjs v2.0.0 (43 ленты feeds.opml → rsshub.json)
├── collect-rss-unified.mjs v3.1.0 (210 URL feeds-unified.opml → rss.json)
├── collect-rss-unified.mjs v3.1.0 (210 URL feeds-unified.opml → rss.json)

├── collect-rss-universal.mjs (500 items → rss-universal.json)
├── collect-rss-universal.mjs (500 элементов → rss-universal.json)

├── collect-rss-extra.mjs (пустой, demo → rss-extra.json)
├── collect-feeds.mjs (feeds.json)
├── collect-feeds.mjs (feeds.json)

└── lib/rss-collector.mjs v2.0.0 (класс RSSCollector, cp1251/koi8-r/utf-8)

│ saveRaw() через scripts/warehouse/managerbasket.mjs
▼

СЛОЙ 2. КОРЗИНА (data/basket/) — единственный источник для API (правило #16.2)
├── rsshub.json 607 КБ, 500 items, БЕЗ паспорта basket.v1
│ читает: rss-feeds-api.mjs
├── rss.json 4.2 МБ, 5340 items, паспорт crucix.basket.v1
│ читают: adaptive-news-clustering.mjs,
│ ai-news-synthesis.mjs
│ ai-news-synthesis.mjs

├── rss-universal.json 551 КБ, 500 items, паспорт crucix.basket.v1 (fallback)
├── rss-extra.json паспорт crucix.basket.v1, count=0 (demo)
├── rss-latest.json 385 КБ, легаси, 18.09.2026 (fallback в rss-feeds-api)
├── rsshub.classified.json 6.9 КБ, результат classify-events.mjs (ИИ-классификация)
│ формат: {id, text, url, timestamp, extra:{source,category},
│ ai_category, ai_confidence, ai_reason}
│ ai_category, ai_confidence, ai_reason}

└── news.json паспорт crucix.basket.v1, demo, 10 items

│
├──────────────────────────────────────────────────────────────┐
▼ ▼
СЛОЙ 3. АНАЛИЗАТОРЫ (scripts/analyzers/) СЛОЙ 4. API (apis/sources/)
├── rss-convergence.mjs v2.0.1 ├── rss-feeds-api.mjs v3.0.0
├── rss-convergence.mjs v2.0.1 ├── rss-feeds-api.mjs v3.0.0

│ convergent stories (5+ источников за 6ч) │ /api/layers/rss-feeds
├── adaptive-news-clustering.mjs ├── rss-convergence-api.mjs
├── adaptive-news-clustering.mjs ├── rss-convergence-api.mjs

│ кластеризация по смыслу │ /api/layers/rss-convergence
├── ai-news-synthesis.mjs ├── rss-manager-api.mjs v2.0.0
├── ai-news-synthesis.mjs ├── rss-manager-api.mjs v2.0.0

│ синтез новостей │ /api/services/rss-manager
└── [в разработке] rss-topic-router.mjs │ methods: GET, POST, DELETE
[в разработке] rss-topic-classifier-llm.mjs ├── news-api.mjs v3.x
│ /api/news/data
└── router-rss-alias.mjs v1.0.0
└── router-rss-alias.mjs v1.0.0

/api/rss/* (АЛИАС)
методы: GET, POST, DELETE

│ │
│ ▼
│ СЛОЙ 5. ПОТРЕБИТЕЛИ
│ (dashboard/public/)
│ ├── rss-feed.html
│ ├── rss-feed.html

│ │ зовёт /api/rss/feeds
│ │ фильтры по регионам,
│ │ автопрокрутка,
│ │ диагностика
│ ├── rss-dashboard.html
│ ├── rss-dashboard.html

│ │ зовёт /api/rss/init,
│ │ /api/rss/feeds POST/DELETE,
│ │ /api/rss/feeds POST/DELETE,

│ │ /api/rss/update,
│ │ /api/rss/export,
│ │ /api/rss/import
│ │ (CRUD 43 лент)
│ ├── news.html
│ ├── news.html

│ │ зовёт /api/news/data
│ ├── dashboard-news.html
│ ├── dashboard-news.html

│ │ реестр 14 источников
│ │ (ждёт /api/rss/)
│ └── news-aggregator.html
│ └── news-aggregator.html

│ зовёт /api/news-aggregator/*
│ (В ОЧЕРЕДИ на восстановление)
▼
СЛОЙ 6. АНАЛИТИКА И ПРОГНОСТИКА
├── data/analytics/semantic/rss-convergence.json
├── данные/аналитика/семантика/rss-convergence.json

│ → semantic-analysis.html
│ → semantic-analysis.html

├── data/analytics/rss-history/ (168 снимков = 7 дней)
│ от snapshot-rsshub.mjs + crucix-rsshub-snapshot.timer
└── apis/predict/engine.mjs v8.0.0
└── apis/predict/engine.mjs v8.0.0

читает runs/latest.json (не подключён к корзине — predict-001)
text


---

## 3. Реестр файлов

### 3.1. Сборщики

| Файл | Версия | Дата | Читает | Пишет | Статус |
|---|---|---|---|---|---|
| scripts/collectors/collect-rsshub.mjs | 2.0.0 | 18.09.2026 | data/feeds/feeds.opml (43 ленты) | data/basket/rsshub.json | рабочий |
| scripts/collectors/collect-rss-unified.mjs | 3.1.0 | 30.09.2026 | data/feeds/feeds-unified.opml (210 URL), data/feeds/urls-classified.json | data/basket/rss.json | рабочий |
| scripts/collectors/collect-rss-universal.mjs | — | 20.09.2026 | OPML | data/basket/rss-universal.json | рабочий |
| scripts/collectors/collect-rss-extra.mjs | — | 20.09.2026 | demo | data/basket/rss-extra.json | demo (count=0) |
| scripts/collectors/collect-feeds.mjs | — | 20.09.2026 | feeds.opml | data/basket/feeds.json | рабочий |
| scripts/collectors/lib/rss-collector.mjs | 2.0.0 | 26.09.2026 | — | — | библиотека (класс RSSCollector) |

### 3.2. API-модули

| Файл | Версия | Маршрут | Методы | Читает | Назначение |
|---|---|---|---|---|---|
| apis/sources/rss-feeds-api.mjs | 3.0.0 | /api/layers/rss-feeds | GET | rsshub.json (осн.), rss-universal.json (fallback), rss-latest.json (легаси) | Новости |
| apis/sources/rss-convergence-api.mjs | — | /api/layers/rss-convergence | GET | data/analytics/semantic/rss-convergence.json | Convergent stories |
| apis/sources/rss-manager-api.mjs | 2.0.0 | /api/services/rss-manager | GET, POST, DELETE | data/feeds/feeds.opml, data/feeds/feeds-status.json | CRUD лент |
| apis/sources/news-api.mjs | 3.x | /api/news/data | GET | data/basket/news.json | Новости (demo) |
| apis/sources/router-rss-alias.mjs | 1.0.0 | /api/rss | GET, POST, DELETE | — | Алиас (см. п.4) |

### 3.3. Анализаторы

| Файл | Версия | Читает | Пишет | Назначение |
|---|---|---|---|---|
| scripts/analyzers/rss-convergence.mjs | 2.0.1 | rsshub.json, rss-universal.json | data/analytics/semantic/rss-convergence.json | Convergent stories (5+ источников за 6ч) |
| scripts/analyzers/adaptive-news-clustering.mjs | — | news.json, gdelt.json, rss.json, newsapi-latest.json | data/analytics/* | Кластеризация по смыслу |
| scripts/analyzers/ai-news-synthesis.mjs | — | news.json, gdelt.json, rss.json | data/analytics/* | Синтез новостей |
| scripts/analyzers/rss-topic-router.mjs | — | — | — | В РАЗРАБОТКЕ (раскладка по темам без ИИ) |
| scripts/analyzers/rss-topic-classifier-llm.mjs | — | — | — | В РАЗРАБОТКЕ (паз ИИ, Ollama qwen2.5:1.5b) |

### 3.4. Страницы-потребители

| Страница | Зовёт | Статус |
|---|---|---|
| dashboard/public/rss-feed.html (234 строки, 34.8 КБ) | GET /api/rss/feeds | восстановлена 21.10.2026 через алиас |
| dashboard/public/rss-dashboard.html (523 строки, 20.8 КБ) | /api/rss/init, /api/rss/feeds POST/DELETE, /api/rss/update, /api/rss/export, /api/rss/import | восстановлена 21.10.2026 через алиас |
| dashboard/public/news.html | GET /api/news/data | рабочий |
| dashboard/public/dashboard-news.html | GET /api/rss/ (в массиве 14 источников) | восстановлена 21.10.2026 через алиас |
| dashboard/public/news-aggregator.html + /js/news-aggregator.js (228 строк) | /api/news-aggregator/update, sources, news, status | В ОЧЕРЕДИ на восстановление |

### 3.5. Управляющие файлы лент

| Файл | Назначение | Статус |
|---|---|---|
| data/feeds/feeds.opml (65 строк = 43 ленты) | Источники для collect-rsshub.mjs | активный |
| data/feeds/feeds-unified.opml (210 URL) | Источники для collect-rss-unified.mjs | активный |
| data/feeds/feeds-status.json (71 КБ) | Статус всех лент (circuit breaker) | активный |
| data/feeds/rss-catalog.json (17 КБ) | Каталог 63 записей (39 ok, 15 dead, 9 blocked) | активный |
| data/feeds/topics.json (497 б) | 17 тем (16 IPTC + unsorted), feed_mapping={} ПУСТОЙ | ЖДЁТ заполнения (Этап 3) |
| data/feeds/urls-classified.json (12.6 КБ) | Классификация URL: direct / tor / dead | активный |
| data/feeds/urls-direct.txt | Список direct URL | активный |
| data/feeds/urls-tor.txt | Список Tor URL | активный |
| data/feeds/urls-dead.txt | Мёртвые URL | активный |
| data/feeds/urls-unavailable.txt (14 КБ) | Недоступные URL | активный |

---

## 4. Алиас /api/rss/* (router-rss-alias.mjs v1.0.0)

**Проблема, которую решает:** страницы `rss-feed.html` и `rss-dashboard.html`
зовут `/api/rss/*`, но такого префикса в проекте не было. Они были сломаны.

**Решение:** модуль `apis/sources/router-rss-alias.mjs`, Service:
- `route: '/api/rss'`
- `methods: ['GET', 'POST', 'DELETE']`
- `meta: { service: true, cache: 0, version: '1.0.0' }`
- `handler(req, res)`: подменяет `req.url` на целевой префикс и вызывает
  `handler` целевого модуля (`rss-feeds-api` или `rss-manager-api`).

**Логика разделения:**

GET /api/rss/ → rss-feeds-api
GET /api/rss/ → rss-feeds-api

GET /api/rss/feeds → rss-feeds-api
GET /api/rss/feeds → rss-feeds-api

GET /api/rss/regions, sources, timeline,
ПОЛУЧИТЕ /api/rss/regions, источники, хронологию,

latest, featurecollection → rss-feeds-api
Latest, featurecollection → RSS-Feeds-API

ВСЁ ОСТАЛЬНОЕ (init, status, stats,
categories, export, export.json,
категории, экспорт, export.json,

render, update, update/:id, import,
рендеринг, обновление, обновление/:id, импорт,

check-url, feeds POST/DELETE,
check-url, подаёт POST/DELETE,

feeds/:id GET/DELETE, feeds/bulk POST) → rss-manager-api
feeds/:id GET/DELETE, feeds/bulk POST) → rss-manager-API
text


**Отладочные заголовки ответа:**
- `X-RSS-Alias-Target: feeds | manager`
- `X-RSS-Alias-Original: <подпуть>`

**Проверено 21.10.2026** — 6 сценариев `curl` HTTP 200, нативные маршруты
не сломаны. Заголовки `X-Module: rss-feeds-api`, `X-Module-Version: 3.0.0`,
`X-Module-Source: basket/rsshub.json`, `Cache-Control: public, max-age=300`
подтверждают корректную маршрутизацию.

**Замечание:** в `registry.generated.json` алиас попал в секцию `routes`
(Layer), а не `services`, из-за того, что парсер `extractMeta()` в
`server/build-registry.mjs` (строка 226, `new Function('return (' + body + ')')`
на строке 246) не распознал `meta` алиаса — `meta: { mapTypes: [] }` без
`service: true`. Функционально это не влияет (маршрут исполняется, заголовки
подтверждают). Причина нераспознания не установлена, требует чтения тела
`extractMeta` строки 226–250.

---

## 5. Что было сделано в этой сессии (21.10.2026)

1. Аудит RSS-системы (блоки 1–7): 5 сборщиков, 6 API, 2 анализатора,
   5 страниц, 26 basket-файлов.
2. Разбор сломанных страниц: `rss-feed.html` (read-only лента с фильтрами,
   автопрокруткой, диагностикой, 8 форматами копирования) и
   `rss-dashboard.html` (CRUD 43 лент, импорт/экспорт OPML).
3. Диагностика роутера: `server/router.mjs` v2.4.0 (1072 строки, контрактный,
   поддерживает `method` и `methods`, wildcard, параметры `:name`).
4. Диагностика `build-registry.mjs` v3.4.0 (866 строк): раскладка по строке 382
   `meta.service === true || route.startsWith('/api/services/')`.
5. Создан `apis/sources/router-rss-alias.mjs` v1.0.0 — алиас /api/rss/*.
6. Пересборка реестра, рестарт сервера, `curl` — 6 сценариев HTTP 200.
7. Этап 1 закрыт: страницы восстановлены, нативные маршруты не сломаны.

---

## 6. Что в очереди (по приоритету)

### Этап 2 — поля склада в collect-rss-unified.mjs

Добавить: `news_id` (стабильный из `md5(link|pubDate|title)`),
`published_at` (ISO из `pubDate`), `guid` (оригинальный ID фида),
`language` (детекция), `tags: []`, `topic` (из маппинга),
`classified_by: 'source'|'unclassified'`, паспорт `crucix.basket.v1`.

**Не трогать** `collect-rsshub.mjs` — рабочий, читается `rss-feeds-api.mjs`.

### Этап 3 — заполнить feed_mapping в topics.json

43 ленты из `feeds.opml` → 16 тем IPTC + unsorted.
Предразмеченные → `topic: <тема>`, `classified_by: 'source'`.
Смешанные → `topic: 'unsorted'`, `classified_by: 'unclassified'`.

### Этап 4 — rss-topic-router.mjs (раскладка по темам без ИИ)

Читает `rss-unified.json` (или `rsshub.json`), раскладывает по
`data/warehouse/rss/topics/<тема>/<news_id>.json`, пишет инвертированный
индекс `index/<тема>.json`.

### Этап 5 — API склада (3 эндпоинта в rss-feeds-api.mjs)

`GET /api/layers/rss/topics` (список тем + count),
`GET /api/layers/rss/topics/:topic?limit=N` (новости темы),
`GET /api/layers/rss/news/:id` (одна новость).

### Этап 6 — rss-topic-classifier-llm.mjs (паз ИИ)

Читает `topics/unsorted/`, вызывает Ollama (`qwen2.5:1.5b`), пишет в формат
`rsshub.classified.json` (`ai_category`, `ai_confidence`, `ai_reason`),
переносит файл в `topics/<тема>/`, ставит `classified_by: 'llm'`.
Интерфейс — как у `rss-topic-router.mjs` (подмена одного скрипта).

### Этап 7 — collect-rssguard.mjs (транзит 450 лент из RSS Guard)

Читает `database.db` RSS Guard read-only, выгружает новые записи по `id`
(идемпотентность через `data/warehouse/rssguard-state.json`), нормализует
в формат склада. Раз в 15–30 минут. RSS Guard работает штатно.

### Этап 8 — потребители

- Тематические дашборды → `topics/<тема>/`.
- Прогностика `engine.mjs` v8.0.0 — подключить к basket (predict-001).
- Crucix OSINT — вариант А (параллельно) или Б (модуль-источник).

### Отдельная задача — восстановление news-aggregator

`news-aggregator.js` зовёт `/api/news-aggregator/update|sources|news|status` —
маршрутов в реестре нет. Восстановить тем же способом (модуль-алиас
`apis/sources/router-news-aggregator-alias.mjs` на `news-api.mjs`
и/или новый `news-aggregator-api.mjs`).

---

## 7. Дубли и легаси

По правилу #1070 — **не удалять, только синтез**.

- `scripts/analysis/` пуста. `rss-convergence.mjs` живёт только в
  `scripts/analyzers/` v2.0.1. Дубли в `archive-Crucix/backups/rss-convergence-v2/`.
- `rss-updater.mjs` v2.1.0 — **рабочий** (переписан 21.09.2026 через
  `http.request`), не переносить в backups.
- `rss-latest.json` (385 КБ, 18.09.2026) — легаси, читается `rss-feeds-api`
  как третий fallback. Не удалять.
- `newsapi-latest.json`, `gdelt_news.json` — легаси, не активны.
- `rss.json` 4.2 МБ — **не сирота**, читается `adaptive-news-clustering.mjs`
  и `ai-news-synthesis.mjs`. Комментарий в `rss-feeds-api.mjs` строка 9
  ошибочно называет его сиротой.

---

## 8. Правила, действующие для RSS

- №16.1–16.4: только сборщики ходят в интернет, API читают корзину.
- №17: логи сборщиков в `logs/collectors/`.
- №18: сборщики только в `scripts/collectors/`.
- №19: недоделанные модули не удалять.
- №36: высокий уровень мастерства, без упрощений.
- #94/15.1: только автономные скрипты.
- #436/15.2: один модуль = один блок = одно сообщение.
- #1070: дубли — только синтез.
- Basket passport: каждый файл `data/basket/*.json` обязан содержать `meta`
  по схеме `crucix.basket.v1`. Ответственный — `scripts/warehouse/managerbasket.mjs`.
  `rsshub.json` — **без паспорта** (нарушение, но читается через `loadWithFallback`).

---

## 9. Терминология

- **Корзина** — `data/basket/`, единственный источник данных для API (#16.2).
- **Сборщик** — `scripts/collectors/collect-*.mjs`, единственный, кто
  ходит в интернет (#16.5).
- **Склад** — `data/warehouse/rss/` (в разработке), производное хранилище
  с ячейками по темам.
- **Ячейка** — папка `topics/<тема>/`, содержит файлы `<news_id>.json`.
- **Инвертированный индекс** — `index/<тема>.json`, список `news_id` по теме.
- **Алиас** — модуль-перенаправление `/api/rss/*` на рабочие API.

---

## 10. Проверка состояния (5 команд)

```bash
cd "/home/ta8_/Рабочий стол/Crucix"
# 1. Алиас работает
curl -s -i "http://localhost:3117/api/rss/feeds" | head -15
# 2. Список лент
curl -s "http://localhost:3117/api/rss/init" | head -c 300
# 3. Нативные маршруты не сломаны
curl -s -o /dev/null -w "layers/feeds: %{http_code}\n" "http://localhost:3117/api/layers/rss-feeds"
curl -s -o /dev/null -w "services/manager/init: %{http_code}\n" "http://localhost:3117/api/services/rss-manager/init"
# 4. Страницы (открыть в браузере)
#    http://localhost:3117/rss-feed
#    http://localhost:3117/rss-dashboard
# 5. Реестр
node -e 'const d=require("./server/registry.generated.json");console.log("routes:",Object.keys(d.routes).length,"services:",Object.keys(d.services).length)'

Конец паспорта. Версия 1.0.0. Дата 2026-10-21.
