Файл: README-SANDBOX.md
markdown

# Crucix Sandbox — карта проекта

## Простое объяснение (для новичков)

Этот файл — «путеводитель» по проекту. Он объясняет, что где лежит, зачем нужен каждый компонент и как всё это запустить. Если вы открыли проект впервые и не знаете, с чего начать — начните отсюда.

**Что внутри:**

- **Карта проекта** — какие папки и файлы есть, что они делают.
- **Стек и порты** — какие технологии используются, на каких портах работают сервисы.
- **Категории** — три слоя системы: сбор данных, аналитика, визуализация.
- **Схема БД** — какие таблицы есть, какие миграции применены.
- **Что работает, что нет** — честный статус каждого компонента.
- **Как запустить** — проверенные команды для старта.

**Зачем это нужно:**

Проект большой: сотни файлов, десятки модулей, несколько баз данных. Без карты легко заблудиться. Этот файл — как схема метро: показывает, где вы находитесь и как добраться до нужной станции.

**Аналогия:**

Это как инструкция к конструктору Лего. Вы открываете коробку, видите сотни деталей и не знаете, с чего начать. Инструкция показывает: вот эти детали — для дома, эти — для машины, эти — для дерева. Соберите дом, потом машину, потом дерево.

---

## Научная база (для специалистов)

`README-SANDBOX.md` — это **архитектурный манифест** проекта, описывающий его структуру, стек, ключевые решения и текущий статус.

**Разделы:**

**1. Архитектура: две песочницы**

Проект разделён на две изолированные среды:

- **Открытая песочница** (`/home/ta8_/4/Crucix-песочница`) — три категории (сбор, аналитика, визуализация). Идёт в основной проект.
- **Закрытая песочница** (`/home/ta8_/4/Crucix-песочница_отдельная`) — четвёртая категория (академика) + копия первых трёх. Не идёт в основной проект.

**Ключевой принцип изоляции:** в открытой песочнице **физически нет** файлов категории 4. При переносе в основной проект не нужно `--exclude` — нечего исключать.

**2. Стек и порты**

| Компонент | Открытая | Отдельная |
|---|---|---|
| API (Fastify) | 3000 | 3010 |
| Dashboard | 3000 | 3010 |
| PostgreSQL | `crucix` (общая) | `crucix` (общая) |
| Node.js | 22.23.2 | 22.23.2 |
| Fastify | 4.29.1 | 4.29.1 |
| @fastify/static | **7.0.4** (не 8) | 7.0.4 |

**3. Категория 1 — Становление (RSS-базис)**

Цель: превратить сломанный RSS-ридер в работающую систему сбора, нормализации и кластеризации.

**Файлы:**

- `scripts/collectors/collect-rss.mjs` — RSS-сборщик (7 фидов).
- `scripts/collectors/rss-to-db.mjs` — запись items в `articles`.
- `scripts/utils/date-parser.mjs` — 7 форматов дат.
- `scripts/utils/string-similarity.js` — Jaccard + shingles.
- `scripts/analyzers/cluster-events.mjs` v3 — кластеризация статей в `events`.
- `scripts/collectors/collect-yield-curve.mjs` — Treasury OData XML.
- `api/server.mjs` — Fastify + static.
- `config/feeds.json` — 6 фидов.
- `config/clustering.json` — порог 0.45.
- `db/migrations/003-007` — схема articles/events/feed_status.

**Результат:**

- `articles`: 371 (7 фидов, 10 дней).
- `events`: 323 (компрессия 1.15x, 7.7% multi-source).
- `yield_curve`: 209 (2026-01-02 → 2026-10-30).
- `feed_status`: 7 (6 работают, aljazeera-all падает).

**4. Категория 2 — Паритет (OSINT-аналитика)**

Цель: догнать конкурентов — индексы, heatmap, scatter, граф.

**Виджеты:**

- `coordination.html` — матрица 50 событий × 3 группы.
- `narrative.html` — scatter «запад vs РФ», 4 квадранта.
- `dashboard-5in1.html` — глобальный индекс (43/100) + yield + feed health.
- `network.html` — D3-force, 100 нод, 50 рёбер.

**Модули:**

- `lib/api.mjs` — единый fetch с timeout+retry.
- `lib/d3.min.js` — d3 v7.9.0 (274 KB, локально).
- `widgets/_template.html` — обёртка виджета.
- `widgets/coordination.mjs` — heatmap.
- `widgets/narrative.mjs` — scatter + интерпретация.
- `widgets/dashboard-5in1.mjs` — 4 компонента.
- `widgets/network.mjs` — NE-связи через `extractNE`.

**Результат:**

- Глобальный индекс: 43/100 (🟡 СРЕДНИЙ).
- `russian×western = 0` — два информационных мира.
- Network: 100 нод, 50 рёбер, 60 изолированных.

**5. Категория 3 — Превосходство (альтернативная оптика)**

Цель: вскрыть паттерны, которые другие игнорируют — молчание, координация, фрейминг.

**C1 — Silence detector:**

- `scripts/analyzers/silence-detector.mjs` (210 строк) — NE-gaps.
- `config/silence.json` — `{hours:24, min_count:3, max_ratio:5}`.
- Результат: 17 gaps (2 high: `россии=18w0`, `путин=9w0`), 0 мусора.

**C2 — Taxonomy multilayer:**

- `scripts/analyzers/taxonomy-multilayer.mjs` (253 строки) — тематические gaps.
- `config/taxonomy.json` (25 сущностей, 97 aliases, 8 контекстов).
- Результат: 10 topic_gaps (`россия` r=40, `украина` r=12, `путин` r=13).
- Ключевое: персоны НЕ группируются в parent, города — группируются.

**C3 — Source coordination:**

- `scripts/analyzers/source-coordination.mjs` (198 строк) — пары фидов + sync events.
- `config/coordination.json` — `{min_sources:3, max_spread_minutes:360, min_co_occurrences:3}`.
- Результат: 3 source_pair + 2 sync_event (ria↔tass: 17, interfax↔tass: 4).

**C4 — Contrast engine:**

- `scripts/analyzers/contrast-engine.mjs` (310 строк) — polarity + latency.
- `config/contrast.json` — `{hours:24, min_events_per_topic:1}`.
- Результат: 2 framing_gaps (`китай` Δ=1.00 high, `франция` Δ=0.33 normal).

**C5 — Alert engine:**

- `scripts/analyzers/alert-engine.mjs` (250 строк) — проактивные уведомления (dry-run).
- `config/alert.json` — `{topic_gap_threshold:20, sync_threshold:5, framing_threshold:0.7}`.
- Результат: 5 alerts (topic_gap: россия high, silence_gap: путин high, framing_gap: китай high).

**6. Категория 4 — Академика (закрытая, в отдельной песочнице)**

14 Python-модулей из основного проекта:

1. `chaos_theory_engine.py` — экспонента Ляпунова.
2. `formal_verifier.py` — Z3 solver.
3. `info_geometry.py` — информационная геометрия.
4. `latent_intent_decoder.py` — VAE.
5. `predictive_engine.py` — Prophet.
6. `nlp_semantic_core.py` — sentence-transformers.
7. `counter_intel_engine.py` — information voids.
8. `agentic_engine.py` — Auto-Analyst.
9. `tensor_graph_engine.py` — GNN.
10. `tqft_invariants.py` — полином Джонса.
11. `spectral_geometry.py` — спектральная щель.
12. `kolmogorov_complexity.py` — коэффициент сжатия.
13. `stochastic_geometry.py` — перколяция.
14. `category_theory_core.py` — теория категорий.

**План (D.10):**

- `private/services/` — копия 14 модулей.
- `private/requirements.txt` — sentence-transformers, torch, prophet, z3-solver, networkx.
- `private/run.sh` — запуск batch.
- `private/api/server.mjs` — порт 3011, обёртка.
- `private/dashboard/` — UI для академики.
- **НЕ синхронизировать в открытую** — изоляция.

**7. Схема БД (миграции 003–011)**

articles (371) ← RSS-сбор + date_format_fallback
events (323, 25 multi) ← кластеризация
yield_curve (209) ← Treasury
feed_status (7) ← health
sources (7) ← feed_id, group_name, enabled

information_gaps (17) ← C1: NE-gaps (russian_count, western_count, sample_event_ids)
topic_gaps (10) ← C2: тематические (topic_type, parent_topic, context)
coordinated_actions (5) ← C3: source_pair + synchronous_event
framing_gaps (2) ← C4: polarity + latency
text


**Порядок миграций:**

003_rss_dedup.sql → feed_id, guid, content_hash, date_format_fallback
004_seed_sources.sql → 6 фидов
005_events_and_yield.sql → events, yield_curve
006_articles_date_format_fallback.sql
007_sources_feed_id.sql → france24-en, enabled
008_information_gaps_extend.sql → C1: counts
009_topic_gaps.sql → C2: темы
010_coordinated_actions_extend.sql → C3: action_type, source, target, strength
011_framing_gaps.sql → C4: polarity_russian/western/delta, latency
text


**8. Что переносить в основной проект**

**ПЕРЕНОСИТЬ:**

- `scripts/collectors/collect-rss.mjs` → заменить старый.
- `scripts/collectors/rss-to-db.mjs`.
- `scripts/utils/date-parser.mjs`.
- `scripts/utils/string-similarity.js`.
- `scripts/analyzers/cluster-events.mjs` v3 → заменить старый.
- `scripts/analyzers/silence-detector.mjs` → новый.
- `scripts/analyzers/taxonomy-multilayer.mjs` → новый.
- `scripts/analyzers/source-coordination.mjs` → новый.
- `scripts/analyzers/contrast-engine.mjs` → новый.
- `scripts/analyzers/alert-engine.mjs` → новый.
- `config/feeds.json` → заменить.
- `config/clustering.json` → заменить.
- `config/taxonomy.json` → новый.
- `config/silence.json` → новый.
- `config/coordination.json` → новый.
- `config/contrast.json` → новый.
- `db/migrations/006-012` (все новые).
- `dashboard/public/widgets/*.mjs` → 4 виджета.
- `dashboard/public/lib/api.mjs`.
- `dashboard/public/lib/d3.min.js`.
- `dashboard/public/*.html` (4 страницы).
- `api/server.mjs` + `@fastify/static@7` → заменить.

**НЕ ПЕРЕНОСИТЬ:**

- `private/services/*.py` (14 академических) — только в отдельной.
- `private/dashboard/` — только в отдельной.
- `private/api/` — только в отдельной.

**9. Известные ограничения (честно)**

1. `russian×western = 0` за 10 дней — данные не пересекаются. Причина: 2 западных фида из 7 (Guardian, NPR) пишут о US/UK domestic, RIA/TASS — о Ukraine/Russia. Не баг — факт.
2. `network` — 60 изолированных — следствие того же (мало общих NE).
3. `C4 framing gaps: 2` — следствие того же (мало тем с обеими группами).
4. `polarity` на словаре — грубо (контекст «санкции против врага» = позитив, но словарь ставит негатив). ML в D.10.
5. `reaction_gap: 0` — следствие `russian×western=0`.
6. `geo_point = null` у всех событий — карта невозможна до D.8 (геокодирование).

**Все 6 ограничений упираются в одну причину:** 371 статья за 10 дней = мало. После D.9 (расширение до 43+ фидов) — большинство ограничений снимутся.

**10. Порядок работ (текущий)**

| # | Этап | Статус | Дата |
|---|---|---|---|
| 1 | A — RSS-базис | ✅ | 2026-10-30 |
| 2 | B — Паритет (4 виджета) | ✅ | 2026-11-01 |
| 3 | C1 — silence-detector | ✅ | 2026-11-01 |
| 4 | C2 — taxonomy-multilayer | ✅ | 2026-11-01 |
| 5 | C3 — source-coordination | ✅ | 2026-11-01 |
| 6 | C4 — contrast-engine | ✅ | 2026-11-01 |
| 7 | C5 — alert-engine | 🚧 следующий | — |
| 8 | Виджет signals.mjs | 🚧 | — |
| 9 | Синхронизация C → отдельная | 🚧 | — |
| 10 | D.10 — академика | 🚧 | — |
| 11 | D.9 — расширение фидов | 🚧 | — |
| 12 | D.7 — интеграция в основной | 🚧 | — |

**11. Быстрый запуск**

**Открытая песочница:**

```bash
cd /home/ta8_/4/Crucix-песочница
node --env-file=.env api/server.mjs                     # порт 3000
node --env-file=.env scripts/analyzers/cluster-events.mjs
node --env-file=.env scripts/analyzers/silence-detector.mjs
node --env-file=.env scripts/analyzers/taxonomy-multilayer.mjs
node --env-file=.env scripts/analyzers/source-coordination.mjs
node --env-file=.env scripts/analyzers/contrast-engine.mjs

Отдельная песочница:
bash

cd /home/ta8_/4/Crucix-песочница_отдельная
node --env-file=.env api/server.mjs                     # порт 3010

URL:

    Открытая: http://127.0.0.1:3000/coordination.html, /narrative.html, /dashboard-5in1.html, /network.html.

    Отдельная: http://127.0.0.1:3010/coordination.html, ...

Проверка БД:
bash

psql -d crucix -c "SELECT COUNT(*) FROM articles;"
psql -d crucix -c "SELECT COUNT(*) FROM events;"
psql -d crucix -c "SELECT COUNT(*) FROM information_gaps;"   # C1
psql -d crucix -c "SELECT COUNT(*) FROM topic_gaps;"        # C2
psql -d crucix -c "SELECT COUNT(*) FROM coordinated_actions;" # C3
psql -d crucix -P pager=off -c "SELECT * FROM framing_gaps;"  # C4

Практические рекомендации

    Обновляйте README при каждом новом файле. Если добавляете C5 — добавьте секцию «C5 — alert-engine» в раздел 5. Если добавляете D.10 — обновите раздел 6.

    Карта проекта — не догма. Она отражает текущее состояние. Если что-то изменилось — обновите.

    «Известные ограничения» — честно. Не скрывайте проблемы. Это помогает планировать работу.

    «Что переносить» — для интеграции. Если вы работаете в песочнице — этот раздел говорит, что готово к переносу в основной проект.

    Порты — 3000 (открытая), 3010 (отдельная). Не меняйте без необходимости: другие модули могут ссылаться на них.

    @fastify/static@7 — не 8. Fastify 4.x несовместим с v8 (FST_ERR_PLUGIN_VERSION_MISMATCH).

    russian×western = 0 — не баг, а факт. Мало западных фидов. После расширения — будет больше.

    DELETE FROM information_gaps перед пересборкой — метрика пересчитываемая.

    max_spread_minutes = 360, не 60. RSS публикует с задержкой в часы.
