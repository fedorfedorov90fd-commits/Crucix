# Глава 4. Оркестратор — engine.mjs

**Создана:** 2026-09-17
**Актуально на:** 2026-09-17
**Файл:** `apis/predict/engine.mjs`
**Размер:** 78452 B, 2001 строка
**Версия:** 8.0.0
**Экспортов:** 25

---

## Что делает engine.mjs

Единый оркестратор 16-фазного конвейера. Запускается после каждого sweep (15 минут).

**Вход:** `runs/latest.json` (текущий sweep) + `runs/history.json` (200 последних).
**Выход:** `runs/predictions/latest_forecast.json` (snapshot).

**Синтез из 6 оркестраторов:**

1. engine.mjs — фазы B-L, Z, TRACKED_EVENTS, runForecastPipeline.
2. engine_coordinat.mjs — PROFILES, BASE_WEIGHTS, CircuitBreaker, coverage penalty.
3. engine_integration_patch.mjs — расширения фаз C/D/K/Z.
4. engine_v6_patch.mjs — фазы S+T.
5. engine_v7_patch.mjs — фаза U.
6. crucix_engine_v4.mjs — HookManager, plugins, integrations, PWA, REST.

---

## Профили запуска

| Профиль | Фазы | Время |
|---------|------|-------|
| minimal | B, C, G, I, J, H, K | ~30s |
| balanced | + D, E, F, L, S, T | ~2min |
| full | + U | ~10min |

Управление: runForecastPipeline(latest, { profile: 'minimal' }).

---

## TRACKED_EVENTS (6)

| ID | Категория | Base rate | Horizon |
|----|-----------|-----------|---------|
| market_crash | economic | 0.02 | 72ч |
| conflict_escalation | geopolitical | 0.05 | 168ч |
| nuclear_incident | nuclear | 0.001 | 24ч |
| sanctions_expansion | geopolitical | 0.08 | 120ч |
| naval_incident | military | 0.03 | 48ч |
| regime_change | structural | 0.01 | 336ч |

---

## Порядок фаз в runForecastPipeline

1. Профиль (minimal/balanced/full).
2. HookManager.emit('beforePrediction').
3. Фаза F: sources (parallel).
4. Фаза B: base models.
5. Фаза C: scientific synthesis.
6. Фаза D: neural layer.
7. Фаза E: advanced models (parallel).
8. Фаза G: knowledge graph.
9. Фаза I: ensemble.
10. Фаза J: reflexive correction.
11. Фаза H: calibration.
12. Фаза K: explainability.
13. Фаза L: active learning.
14. v3 extended (J3/K3/L3).
15. Фаза S+T (v6 + каталог) — параллельно.
16. Фаза U (v7 Simulation Engine).
17. ExtendedTracker + CompositeRisk.
18. HookManager.emit('afterPrediction').
19. emit('onSignal'), emit('onSignalHigh'), emit('onRegimeChange'), emit('onAlert').
20. Integrations dispatch (Slack/Notion/Obsidian/Email/Webhook).
21. PWA push (VAPID).
22. Фаза Z: dissemination.

---

## Базовая защита: safeCall

Все вызовы через safeCall(label, fn, fallback, timeoutMs):
- Promise.race с timeout.
- При timeout — возврат fallback.
- При ошибке — логирование, возврат fallback.

**Graceful degradation:** падение одной фазы не блокирует остальные.

---

## CircuitBreaker

- threshold = 3 падения подряд.
- cooldown = 5 пропусков.
- Глобальный на процесс.

Класс CircuitBreaker (структурно как в engine_coordinat/v6_patch/v7_patch).

---

## Snapshot — структура forecast

Основные поля:

- timestamp — ISO-дата.
- elapsedMs — время выполнения в мс.
- version — 8.0.0.
- profile — minimal / balanced / full.

**events** — 6 отслеживаемых событий. У каждого: name, category, horizonHours, baseRate, ensemble, finalProbability, shift, disagreement, sourceBreakdown, reflexive, calibratedProbability.

**explanations** — по каждому событию: shap (топ-5 признаков), counterfactual (4 сценария), uncertainty (epistemic/aleatoric), reasoning (цепочка шагов).

**topRisks** — топ-5 рисков: id, name, probability, horizonHours, category, disagreement, reflexivityType.

**Базовые результаты фаз B-L:**
- stateClassification: { predicted, naiveBayes }
- markov, monteCarlo, timeseries, cascade
- scientific: { hawkes, hmm, kalman, ising, transferEntropy, contagion, evt, ornsteinUhlenbeck, copula, bocpd, particleFilter }
- neural: { mlp, gcn, dqn }
- advanced: { swarm, causal, gametheory, narrative, regimeShift }
- sources: { predictionMarkets, multilang, satellite }
- knowledgeGraph: { entityCount, relationCount, stats }

**extended (v3):**
- temporalCausal, multiLayerCausal, narrativeWarfare, resourceExhaustion
- metaEnsemble, scenarios, hypergraphContagion, attentionDynamics
- adversarialCoEvolution, combinedSignals

**Расширения новых фаз:**
- v6_extensions: { phase, modules, signals, failures }
- catalog_extensions: { ... }
- v7_extensions: { synthesis, answers, moduleStatus, ... }

**Калибровка и трекинг:**
- calibration: { brierScores, ensembleWeights, trackerStats }
- activeLearning: { action, source, utility, ... }
- pythonBridge: { available, url, models }
- compositeRisk: { composite, level, confidence, signals, topDrivers, breakdown, corrections, trend }
- trackerStats: { total, resolved, pending, brier, decomposition, rolling, horizons, drift, warning, bootstrapCI, perModelBrier, ensembleWeights }

**Служебное:**
- failures: [ { module, error } ]
- summary: { topRisk, regimeShift, signalsProcessed, elapsedMs }

---

## Класс ForecastEngine

Обёртка с init / runCycle / handleHTTP / shutdown.

**init:** инициализация HookManager, PluginLoader, PluginRegistry, IntegrationManager, PWA push. Загрузка плагинов. Регистрация hooks. Обработка SIGTERM/SIGINT.

**runCycle(latest, history):** вызывает runForecastPipeline.

**handleHTTP(req, res):** REST API:
- /api/plugins/* → handlePluginsAPI.
- /api/push/vapid-key, /subscribe, /unsubscribe, /test.
- /api/integrations/status.
- /api/engine/status.

**shutdown:** stopTimers, emit('onShutdown'), unload всех плагинов, process.exit(0).

---

## Hooks (9 событий)

| Hook | Когда |
|------|-------|
| onStartup | при инициализации |
| onShutdown | при завершении |
| beforePrediction | перед каждым sweep |
| afterPrediction | после sweep |
| onSignal | для каждого сигнала |
| onSignalHigh | если signal.value > 0.7 |
| onAlert | если composite level high/critical |
| onRegimeChange | если changePointVix.changeProbability > 0.5 |
| onTimer | каждые 60 секунд |

---

## CLI

При запуске node apis/predict/engine.mjs:
1. Читает runs/latest.json.
2. Запускает runForecastPipeline (профиль balanced).
3. Выводит summary и topRisks.

---

## Экспорты (25)

**Основные:** runForecastPipeline, createForecastEngine, runFullEngineCycle.

**Класс:** ForecastEngine.

**Защита:** CircuitBreaker.

**12 фаз:** phaseB_BaseModels … phaseZ_Dissemination.

**Константы:** TRACKED_EVENTS, PROFILES, BASE_WEIGHTS, TOTAL_ENSEMBLE_MODULES, ENGINE_VERSION.

**Утилиты:** hashData, timing.

**Default:** runForecastPipeline.

---

## Связи

- **Реестр модулей:** apis/predict/register_coordinat_all.mjs.
- **Паспорта фаз:** docs/modules/phase-*.md.
- **Глава 5 (diagnostics):** что работает, что нет.

---

**Конец файла 04-orchestrator.md**
