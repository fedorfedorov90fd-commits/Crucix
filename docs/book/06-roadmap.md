# Глава 6. План работ (roadmap)

**Создана:** 2026-09-17
**Актуально на:** 2026-09-17
**Версия проекта:** 8.0.0

---

## Назначение

Очередь работ по проблемам из главы 5 (diagnostics). Каждая задача — из PROBLEMS.md. Порядок — по приоритету.

---

## Правила выполнения

1. Одна задача = один цикл правки + проверка.
2. Перед правкой — прочитать файл.
3. После правки — node --check + тест.
4. При сомнении — в backups, не удалять.
5. Журнал — в PROBLEMS.md.

---

## Очередь P1 (важное)

### 1. P1-001. Синхронизация версий к 8.0.0

**Файлы:**
- `package.json` (4.0.0 → 8.0.0).
- `README_CRUCIX_v4.md` (5.0.0 → 8.0.0).
- `docs/handbook/00-intro.md` (3.0.0 → 8.0.0).
- `k8s/*.yaml` (3.0.0 → 8.0.0).

**Проверка:** grep -rn "4.0.0\|5.0.0\|3.0.0" на ключевых файлах.

**Ожидаемое время:** 30 минут.

### 2. P1-002. build.sh — дополнить FILES

**Файл:** `docs/handbook/build.sh`.

**Добавить в FILES:**
- 08-testing.md
- 16-advanced-contagion.md
- v6.0.md
- v7.0.md
- v8.0-agent.md
- catalog.md
- pipeline-S-T-U.md
- architecture-overview.md

**Проверка:** запустить build.sh dry-run.

**Ожидаемое время:** 15 минут.

### 3. P1-003. human_feedback — интеграция

**Файлы:**
- `features/human-feedback/human_feedback.mjs` — существует.
- `features/human-feedback/human_feedback.dashboard.html` — существует.
- `apis/predict/engine.mjs` — добавить вызов после фазы F.

**Действие:**
1. Прочитать `features/human-feedback/engine_integration.md`.
2. В engine.mjs добавить import + вызов `humanFeedback.apply(...)` после фазы F.
3. Создать `runs/predictions/human_feedback.json` при первом обращении.

**Ожидаемое время:** 1-2 часа.

### 4. P1-008. rename-titan.mjs — статус

**Факт:** файл отсутствует. Пользователь почистил упоминания.
**Действие:** закрыть как выполненное (пометка «удалён намеренно»).

**Ожидаемое время:** 5 минут.

---

## Очередь P2 (среднее)

### 5. P2-001. benchmarks/ — пустая папка

**Действие:** удалить или перенести benchmark/ → benchmarks/.

**Ожидаемое время:** 5 минут.

### 6. P2-002. ci.yml — проверка на дубли

**Файл:** `.github/workflows/ci.yml` (47489 B, 1192 строки).

**Действие:** проверить jobs на дублирование. Возможно разбить на ci-lint.yml, ci-tests.yml, ci-release.yml.

**Ожидаемое время:** 30-60 минут.

### 7. P2-003. rename-crucix.mjs — комментарий

**Файл:** `scripts/rename-crucix.mjs`.

**Действие:** исправить шапку (путь `/home/ta8/Документы` → актуальный).

**Ожидаемое время:** 5 минут.

### 8. P2-004. VAE — синтез единого

**Файлы:**
- `apis/predict/models/vae.mjs`.
- `apis/predict/v7/world_model.mjs` (VAE внутри).

**Действие:**
1. Сравнить две реализации.
2. Синтезировать единый `models/vae.mjs`.
3. В world_model импортировать из models/vae.mjs.
4. Проверить.

**Ожидаемое время:** 2-3 часа.

### 9. P2-005. AlertPolicyEnv — синтез единого

**Файлы:**
- `apis/predict/models/reinforcement.mjs`.
- `apis/predict/models/actor_critic.mjs`.

**Действие:**
1. Сравнить две реализации.
2. Синтезировать единый.
3. Создать `apis/predict/models/envs.mjs`.
4. Оба файла импортируют из envs.mjs.

**Ожидаемое время:** 1-2 часа.

### 10. P2-006. MultiHeadAttention — синтез единого

**Файлы:**
- `apis/predict/models/transformer.mjs`.
- `apis/predict/v6/neural_causal_discovery.mjs`.

**Действие:**
1. Сравнить.
2. Синтезировать единый.
3. Создать `apis/predict/models/attention.mjs`.
4. Оба файла импортируют из attention.mjs.

**Ожидаемое время:** 1-2 часа.

### 11. P2-007. RL — общий модуль

**Файлы:**
- `apis/predict/models/reinforcement.mjs`.
- `apis/predict/models/actor_critic.mjs`.
- `apis/predict/v6/causal_rl.mjs`.
- `apis/predict/opponent_ppo.mjs`.
- `apis/predict/v7/dreamer.mjs`.

**Действие:**
1. Найти общие компоненты (MLP, ReplayBuffer).
2. Создать `apis/predict/models/rl_core.mjs`.
3. 5 файлов импортируют из rl_core.mjs.

**Ожидаемое время:** 4-6 часов.

---

## Очередь P3 (низкое)

### 12. P3-002. backups/ — проверка актуальности

**Факт:** 30+ файлов .bak в backups/.

**Действие:** проверить, нужны ли все. Устаревшие — пометить или удалить по согласованию.

**Ожидаемое время:** 30 минут.

---

## Дополнительные задачи (не P1/P2/P3)

### 13. Замер времени профилей balanced и full

**Действие:**
1. Запустить `runForecastPipeline(latest, { profile: 'balanced' })`.
2. Замерить elapsedMs.
3. То же для 'full'.

**Ожидаемое время:** 15 минут.

### 14. Тесты для фазы D (MLP/GCN/DQN)

**Факт:** нет тестов.

**Действие:**
1. Создать `tests/predict/mlp.test.mjs`.
2. Создать `tests/predict/gcn.test.mjs`.
3. Создать `tests/predict/dqn.test.mjs`.

**Ожидаемое время:** 2-3 часа.

### 15. Унификация форматов

**Действие:**
1. Формат ошибок: `{ error, module, timestamp }` во всех модулях.
2. Формат логов: только `console.log('[engine] ...')`.
3. Формат путей: только `runs/` (без `apis/runs/`, `data/runs/`).

**Ожидаемое время:** 4-8 часов.

---

## Связи

- **PROBLEMS.md:** детальные записи по каждому ID.
- **Глава 5 (diagnostics):** исходный список проблем.
- **Глава 7 (improvements):** что нарастить.

---

**Конец файла 06-roadmap.md**
