# Crucix Pipeline — фазы A–U

**Назначение:** описание полного 16-фазного конвейера прогностического движка Crucix.
**Актуальная версия:** 7.0.0 (16 фаз).

---

## Общая картина

Конвейер запускается после каждого sweep (15 минут). Каждая фаза — независимый блок с graceful degradation. Падение одной фазы не убивает весь конвейер.

Фазы A–R — базовый конвейер (v5.0). Фазы S, T, U добавлены в v6.0/v7.0 как независимые расширения.

---

## Базовый конвейер A–R (v5.0)

| Фаза | Название | Модули |
|------|----------|--------|
| A | Загрузка данных | sweep → features |
| B | Базовые модели | bayesian, naivebayes, markov, montecarlo |
| C | Научный синтез | timeseries, cascade, calibration |
| D | Нейросетевой слой | neural, graph_neural, reinforcement |
| E | Продвинутые модели | hawkes, hmm, kalman, ising, evt, copula, bocpd, particle |
| F | Источники | prediction_markets, multilang, satellite |
| G | Граф знаний | knowledge graph build |
| H | Калибровка | Brier Score, Platt scaling |
| I | Ансамблирование | weighted ensemble |
| J | Рефлексивная коррекция | applyReflexiveCorrection |
| K | Объяснимость | permutation importance, counterfactuals |
| L | Active Learning | выбор следующих источников |
| M–Q | v2.0/v3.0/v5.0 | temporal_causal, multilayer_causal, narrative_warfare, hypergraph_contagion, attention_dynamics, adversarial_coevolution, multiscale_attention, opponent_ppo, bayesian_causal |
| R | v5.0 финал | hypergraph_discovery, federated_hypergraph |
| Z | Публикация | WebSocket, notifier, save snapshot |

---

## Фаза S — v6.0 научный синтез

**Файл:** apis/predict/engine_v6_patch.mjs → runV6Phase

**Модули:** 5
- neural_causal_discovery.mjs
- continual_learning.mjs
- causal_rl.mjs
- quantum_hypergraph.mjs
- zk_federated.mjs

### Как работает

    const v6Result = await runV6Phase(history, { disabled: [] });

1. Проверка circuit breaker для каждого модуля.
2. Проверка history.length >= minHistory (20-30).
3. Параллельный запуск через Promise.allSettled.
4. Каждый модуль с timeout 60-120 секунд.
5. При падении — запись в failures.

### Время

~1.5-2 секунды (все модули параллельно, на 40 sweep'ах).

### Расширение snapshot

applyV6ToSnapshot добавляет snapshot.v6_extensions с результатами по каждому модулю + signals для explanation.

---

## Фаза T — каталог (6 модулей)

**Файл:** apis/predict/engine_v6_patch.mjs → runCatalogPhase

**Модули:** 6
- models/mcmc.mjs
- models/physics_inspired.mjs
- automl.mjs
- anomaly_detection.mjs
- models/graph_sage.mjs
- models/actor_critic.mjs

### Как работает

Идентично фазе S, но с другими модулями. Параллельно с S (можно запускать одновременно).

### Время

~1-1.5 секунды (все модули параллельно).

### Расширение snapshot

applyV6ToSnapshot добавляет snapshot.catalog_extensions.

---

## Фаза U — v7.0 Simulation Engine

**Файл:** apis/predict/engine_v7_patch.mjs → runV7Phase

**Модуль:** 1 (но внутри — 4 подмодуля: world_model + neural_ode + dreamer + continuous_causal)

### Как работает

    const v7Phase = await runV7Phase(history, {
      horizon: 12,
      modules: {...},
    });

1. Circuit breaker для simulation_engine_v7.
2. Проверка history.length >= 30.
3. Импорт apis/predict/v7/simulation_engine.mjs.
4. Запуск crucixSimulationEngine — последовательно 4 подмодуля.
5. Timeout 180 секунд (долго).
6. applyV7ToSnapshot расширяет snapshot.v7_extensions.

### Время

~16-30 секунд (4 подмодуля последовательно).

### Расширение snapshot

- snapshot.v7_extensions.synthesis
- snapshot.v7_extensions.answers
- snapshot.explanation.reasoning_steps — шаги v7
- snapshot.explanation.summary — дополняется

---

## Порядок выполнения в engine.mjs

    // ... фазы A-R выполнены ...
    const forecast = { ... };  // snapshot собран

    // ФАЗЫ S+T (параллельно)
    try {
      const [v6Phase, catalogPhase] = await Promise.all([
        runV6Phase(history, {}),
        runCatalogPhase(history, {}),
      ]);
      applyV6ToSnapshot(forecast, v6Phase, catalogPhase);
    } catch (e) { ... }

    // ФАЗА U (после S+T)
    try {
      const v7Phase = await runV7Phase(history, {...});
      applyV7ToSnapshot(forecast, v7Phase);
    } catch (e) { ... }

    // Публикация
    await phaseZ_Dissemination(forecast);

**Почему такой порядок:**
- S и T параллельны (независимы).
- U зависит от history, но не от результатов S/T.
- Можно было бы все три параллельно, но U требует много ресурсов — запускается отдельно.

---

## Graceful degradation

Каждая фаза изолирована:
- try/catch вокруг всей фазы.
- Failure записывается в forecast.failures.
- Остальные фазы продолжают работать.
- Snapshot сохраняется даже если U упала.

---

## Circuit breaker

Глобальный (на процесс) для каждой фазы:
- threshold = 3 падения подряд
- cooldown = 5 запусков пропуска
- После cooldown счётчик сбрасывается, модуль пробует снова

Это защита от бесконечно падающих модулей в production.

---

## Timeout wrapper

Каждый модуль обёрнут в Promise.race с timeout:
- S/T: 60-120 секунд
- U: 180 секунд

Если модуль не завершился — reject с `timeout after Nms`.

---

## Snapshot после всех фаз

После A–U snapshot содержит:

    {
      // Базовые поля
      timestamp, elapsedMs, version,
      events, explanations, topRisks,
      stateClassification, markov, monteCarlo, timeseries, cascade,
      scientific, neural, advanced, sources, knowledgeGraph,
      calibration, activeLearning, pythonBridge,
      summary,

      // Расширения v6.0+
      v6_extensions: {
        version, phase, elapsedMs, totalModules, okCount, errorCount,
        signals, moduleResults, failures,
      },
      catalog_extensions: { ... },
      v7_extensions: {
        version, ok, elapsedMs, available,
        moduleStatus, activeModules, totalModules,
        synthesis, answers, interpretation,
      },

      new_module_signals: [...],
      failures: [...],
    }

---

## Диагностика

### Healthcheck

    import { healthcheck as hc6 } from './engine_v6_patch.mjs';
    import { healthcheck as hc7 } from './engine_v7_patch.mjs';

    const h6 = hc6();
    // h6.v6Modules (5), h6.catalogModules (6)

    const h7 = hc7();
    // h7.v7Files (5)

### Лог выполнения

Каждая фаза пишет в stdout:
- `[engine_v6_patch] Фаза S: запуск 5 модулей v6.0`
- `[engine_v6_patch] Фаза T: запуск 6 модулей каталога`
- `[simulation_engine] Запуск v7.0 на N sweep'ах`

### Проверка snapshot

После runForecastPipeline смотреть runs/predictions/latest_forecast.json:
- v6_extensions.okCount — сколько модулей S завершились
- catalog_extensions.okCount — сколько модулей T
- v7_extensions.synthesis.confidence — уверенность v7

---

## Параметры запуска

### Отключение отдельных модулей

    await runForecastPipeline(history, {
      disabledV6: ['zk_federated'],       // отключить ZK-FL в фазе S
      disabledCatalog: ['automl'],        // отключить AutoML в фазе T
      disabledV7: [],                     // v7 всё включено
    });

### Параметры v7

    modulesV7: {
      worldModel: { vaeEpochs: 5, latentDim: 16 },
      neuralODE: { epochs: 5 },
      dreamer: { trainSteps: 30 },
      continuousCausal: { epochs: 5 },
    }

### Параметры interventions

    interventionsV7: {
      tension: 0.9,   // do(tension=0.9) для counterfactual
    }

---

## Тесты

- tests/integration/full_pipeline_v6_v7.test.mjs — 10 тестов, покрывают S, T, U, applyV6/V7, полный pipeline.

Все зелёные.

---

## Математические ссылки

См. отдельные доки:
- v6.0.md — научные ссылки для v6.0
- catalog.md — ссылки для каталога
- v7.0.md — ссылки для v7.0

---

**Конец документа pipeline-S-T-U.md**
