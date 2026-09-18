# Глава 5. Диагностика слаженности

**Создана:** 2026-09-17
**Актуально на:** 2026-09-17
**Версия проекта:** 8.0.0

---

## Назначение

Сводка состояния проекта: что работает, что не дотягивает, где рассинхрон, где дубли. Основа для главы 6 (roadmap).

---

## Что работает (проверено)

### Оркестратор

- `apis/predict/engine.mjs` — IMPORT OK, 25 экспортов, pipeline (minimal) = 200 мс.
- Результат: 6 events, compositeRisk 0.0449 (low), failures 0.
- Фазы: B → C → G → I → J → H → K → v3 (J3/K3/L3) → ExtendedTracker → Z.
- Профиль minimal. Профили balanced/full — синтаксически готовы, но на полных данных не тестировались.

### Реестр модулей

- `apis/predict/register_coordinat_all.mjs` — 57 модулей, healthcheck 57/57 OK.

### Ключевые точки входа

| Файл | Экспортов | Статус |
|------|-----------|--------|
| engine.mjs | 25 | OK |
| bayesnet.mjs | 8 | OK |
| crucix_engine_v4.mjs | 3 | OK |
| knowledge/graph.mjs | 4 | OK |
| extended_tracker.mjs | 13 | OK |
| composite_risk.mjs | 5 | OK |
| crucix_engine_v3.mjs | 6 | OK |

### Синтез дубликатов (закрыто 2026-09-17)

- 6 оркестраторов → единый engine.mjs (2000 строк).
- 2 графа знаний → единый knowledge/graph.mjs (383 строки).
- 2 fix-duplicates → единый scripts/fix-duplicates.mjs (252 строки).
- корневой hawkes.mjs → backups, оставлен apis/predict/models/hawkes.mjs.
- Пути в 6 файлах models/ исправлены (писали в apis/runs/ — было удалено).

### Чистка

- Все .bak/.tmp/.pyc перенесены в backups/.
- Файлы 0 байт устранены.
- Папка apis/ontology/ отсутствует.
- Папка models/ (корень) удалена.
- apis/runs/ (дубликат) удалён.

---

## Что не дотягивает

### P1-001. Рассинхрон версий

**Факт:** package.json 4.0.0 | README 5.0.0 | handbook 3.0.0 | k8s 3.0.0 | engine 8.0.0.
**Влияние:** невозможно указать «текущую версию проекта». При установке через npm — пользователь получит метку 4.0.0, хотя ядро 8.0.0.
**Решение:** синхронизировать к 8.0.0.

### P1-002. build.sh не включает новые главы

**Факт:** docs/handbook/build.sh собирает только 4 файла + sciences/*.md. Пропускает: 08-testing, 16-advanced-contagion, v6.0, v7.0, v8.0-agent, catalog, pipeline-S-T-U, architecture-overview.
**Влияние:** при сборке PDF/HTML/EPUB — книга получится неполной.
**Решение:** дополнить FILES.

### P1-003. human_feedback не вызывается

**Факт:** features/human-feedback/ содержит класс HumanFeedbackLearner, но engine.mjs его не вызывает.
**Влияние:** оператор не может корректировать веса модулей.
**Решение:** интегрировать после фазы F.

### P2-001. benchmarks/ — 0 файлов

**Факт:** папка benchmarks/ пуста, дублирует benchmark/ (2 файла).
**Решение:** удалить или перенести.

### P2-002. ci.yml — 47489 байт

**Факт:** 1192 строки. Возможно есть дублирование.
**Решение:** проверить.

### P2-004. VAE — 2 реализации

**Факт:** models/vae.mjs + внутри v7/world_model.mjs.
**Решение:** синтез единого.

### P2-005. AlertPolicyEnv — 2 реализации

**Факт:** models/reinforcement.mjs + models/actor_critic.mjs.
**Решение:** вынести в общий модуль.

### P2-006. MultiHeadAttention — 2 реализации

**Факт:** models/transformer.mjs + v6/neural_causal_discovery.mjs.
**Решение:** вынести в общий модуль.

### P2-007. RL — 5 реализаций

**Факт:** reinforcement.mjs, actor_critic.mjs, causal_rl.mjs, opponent_ppo.mjs, dreamer.mjs.
**Влияние:** общие компоненты (MLP, ReplayBuffer) дублируются.
**Решение:** вынести общие компоненты.

---

## Дубликаты — сводка

| Компонент | Файлы | Статус |
|-----------|-------|--------|
| Оркестраторы | 6 → 1 | closed |
| Графы знаний | 2 → 1 | closed |
| fix-duplicates | 2 → 1 | closed |
| hawkes.mjs | 2 → 1 | closed |
| VAE | 2 | open (P2-004) |
| AlertPolicyEnv | 2 | open (P2-005) |
| MultiHeadAttention | 2 | open (P2-006) |
| RL-компоненты | 5 | open (P2-007) |

---

## Слаженность конвейера

### Что согласовано

- Все модули возвращают данные в единый snapshot.
- Формат лога: `[engine] Phase X: ...`.
- Все модули с timeout и fallback.
- Circuit breaker глобальный.
- Публикация в runs/predictions/latest_forecast.json.

### Что не согласовано

- **Версии:** разные модули декларируют разные версии (3.0.0 — calibration, 6.0.0 — bayesnet, 8.0.0 — engine).
- **Формат ошибок:** где-то `{ error: 'string' }`, где-то throw, где-то return null.
- **Формат путей:** смешение путей к runs/ (некоторые писатели).
- **Формат логов:** три варианта — console.log, console.warn, console.error.

### Рекомендации по согласованию

1. Ввести единый формат ошибок: `{ error: string, module: string, timestamp: ISO }`.
2. Ввести единый путь: все модули пишут только в `runs/` (не `apis/runs/`, не `data/`).
3. Ввести единый формат логов: только `console.log('[engine] ...')`.
4. Ввести единый номер версии: `ENGINE_VERSION` из engine.mjs.

---

## Уровень покрытия тестами

| Фаза | Модулей | Тестов | Покрытие |
|------|---------|--------|----------|
| B | 7 | есть в tests/predict/ | частичное |
| C | 11 | есть в tests/predict/ | частичное |
| D | 3 | нет | нет |
| E | 5 | есть в tests/predict/ | частичное |
| S | 5 | tests/v6/ (2) | есть |
| T | 6 | tests/catalog/ (2) | есть |
| U | 1 | tests/v7/ (1) | есть |
| J3/K3/L3 | 9 | tests/predict/ | частичное |

**Влияние:** без тестов на D (MLP/GCN/DQN) — изменения в них не проверяются.

---

## Производительность

| Профиль | Время | Модулей |
|---------|-------|---------|
| minimal | 200 мс | ~26 |
| balanced | ~не измерено | ~44 |
| full | ~не измерено | ~57 |

**Рекомендация:** замерить balanced и full, чтобы понять реальное время цикла (обещано 15 мин между sweep, значит полный цикл должен укладываться в <2 мин).

---

## Связи

- **Глава 6 (roadmap):** план работ по проблемам из этой главы.
- **Глава 7 (improvements):** что нарастить.
- **PROBLEMS.md:** детальные записи по каждому ID.

---

**Конец файла 05-diagnostics.md**