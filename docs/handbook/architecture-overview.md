# Crucix — обзор архитектуры

**Назначение:** единая картина всей прогностической системы Crucix — модули,
фазы, потоки данных, метрики. **Актуальная версия:** 7.0.0.

- - -
## Что такое Crucix

Crucix — открытая прогностическая система геополитических и экономических
событий. Каждые 15 минут система делает sweep (сбор данных из 40+ источников),
прогоняет 16-фазный конвейер и публикует прогноз.

**Ключевая идея:** ни одна модель не имеет монополии на истину. Ансамбль
устойчивее любой отдельной модели. Система не пытается предсказать точное число
— она даёт распределение вероятностей, объяснение и метрики уверенности.

- - -
## Верхнеуровневая схема

    ┌──────────────────┐
    │  Источники       │  GDELT, FRED, satellite, prediction_markets,
    │  (sweep ~40 шт.) │  multilang, sanctions, radiation, energy, gold
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │  Корзина         │  data/basket/latest.json + history.json
    │  (basket)        │  Единый источник для движка (RULES.txt)
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────────────────────────────┐
    │  Engine — 16 фаз (A→U)                    │
    │                                            │
    │  A: загрузка                               │
    │  B–R: базовый конвейер (v5.0)              │
    │  S: v6.0 научный синтез (5 модулей)        │
    │  T: каталог (6 модулей)                    │
    │  U: v7.0 Simulation Engine (4 подмодуля)   │
    │  Z: публикация                             │
    └────────┬───────────────────────────────────┘
             │
             ▼
    ┌──────────────────┐
    │  Snapshot        │  runs/predictions/latest_forecast.json
    │  (prediction)    │  events + v6/v7/catalog_extensions + answers
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │  Публикация      │  WebSocket → dashboard + notifier → Slack/email
    │                  │  Brier Score обновляется по разрешённым прогнозам
    └──────────────────┘

- - -
## Три карты (замысел)

Пользователь планирует три настраиваемые карты — разные представления одного
snapshot:

1.  **Global map** — геопространственное представление. Каждая страна/регион —
    точка с цветом по tension/conflicts.
2.  **Causal map** — DAG причинности. Узлы = переменные, рёбра = discovered
    causal links.
3.  **Cascade map** — цепочки эскалации. От первичного события к вторичным
    последствиям через лаги.

Каждая карта — отдельный фронтенд-компонент, питается одним snapshot.

- - -
## Модульная структура

    apis/
    ├── predict/
    │   ├── engine.mjs                    главный оркестратор (1219 строк)
    │   ├── engine_v6_patch.mjs           фазы S+T (771 строка)
    │   ├── engine_v7_patch.mjs           фаза U (268 строк)
    │   ├── bayesian.mjs                  байесовское обновление
    │   ├── naivebayes.mjs                наивный Байес
    │   ├── markov.mjs                    цепи Маркова
    │   ├── montecarlo.mjs                Монте-Карло
    │   ├── timeseries.mjs                ETS/AR
    │   ├── cascade.mjs                   каскадные цепочки
    │   ├── calibration.mjs               Brier Score + Platt
    │   ├── swarm.mjs                     500 агентов
    │   ├── reflexive.mjs                 рефлексивная коррекция
    │   ├── causal.mjs                    do-calculus
    │   ├── gametheory.mjs                Nash/Stackelberg
    │   ├── narrative.mjs                 SIR-модель нарративов
    │   ├── regime_shift.mjs              смена режима
    │   ├── active_learning.mjs           выбор источника
    │   ├── explainability.mjs            permutation + counterfactual
    │   ├── temporal_causal.mjs           распределения задержек
    │   ├── multilayer_causal.mjs         4-слойный DAG
    │   ├── narrative_warfare.mjs         координация кампаний
    │   ├── resource_exhaustion.mjs       истощение
    │   ├── meta_ensemble.mjs             нейросеть для весов
    │   ├── scenario_generator.mjs        LLM-сценарии
    │   ├── hypergraph_contagion.mjs      N-арные связи
    │   ├── attention_dynamics.mjs        коллективное внимание
    │   ├── adversarial_coevolution.mjs   адаптация противника
    │   ├── hypergraph_discovery.mjs      авто-поиск связей
    │   ├── multiscale_attention.mjs      три масштаба
    │   ├── opponent_ppo.mjs              PPO-противник
    │   ├── federated_hypergraph.mjs      FedAvg
    │   ├── bayesian_causal.mjs           MCMC по DAG
    │   ├──
    │   ├── v6/                           5 модулей научного синтеза
    │   │   ├── neural_causal_discovery.mjs
    │   │   ├── continual_learning.mjs
    │   │   ├── causal_rl.mjs
    │   │   ├── quantum_hypergraph.mjs
    │   │   └── zk_federated.mjs
    │   ├──
    │   ├── v7/                           5 модулей непрерывного мира
    │   │   ├── world_model.mjs
    │   │   ├── neural_ode.mjs
    │   │   ├── dreamer.mjs
    │   │   ├── continuous_causal.mjs
    │   │   └── simulation_engine.mjs
    │   ├──
    │   ├── models/                       базовые модели
    │   │   ├── hawkes.mjs, hmm.mjs, kalman.mjs, ising.mjs
    │   │   ├── transferentropy.mjs, contagion.mjs, evt.mjs
    │   │   ├── ornstein.mjs, copula.mjs, bocpd.mjs, particle.mjs
    │   │   ├── neural.mjs, graph_neural.mjs, reinforcement.mjs
    │   │   ├── transformer.mjs, vae.mjs, diffusion.mjs
    │   │   ├── mcmc.mjs, physics_inspired.mjs
    │   │   ├── graph_sage.mjs, actor_critic.mjs
    │   │   └── ...
    │   ├──
    │   ├── automl.mjs                    AutoML
    │   ├── anomaly_detection.mjs         anomaly ensemble
    │   ├── core/                         linear_algebra, stats, optim
    │   ├── exotic/                       quantum_sa, chaos, ...
    │   ├── wasm/                         linear_algebra.wat + loader
    │   ├── webgl/                        gpu.mjs + shaders
    │   ├── workers/                      pool + montecarlo_worker
    │   ├── federated/                    fl_node, fl_protocol
    │   └── ...
    │
    ├── sources/                          satellite, prediction_markets,
    multilang
    ├── knowledge/graph.mjs                граф знаний, Сущностная структура
               

- - -
## Данные

### Вход

- **Sweep** — каждые 15 минут. Собирает 40+ источников.
- **Корзина** (basket) — единый источник для движка: data/basket/latest.json, 
  data/basket/history.json.

**Философия корзины (RULES.txt):** движок не ходит в сеть самостоятельно. Все
источники пишут в корзину. Движок читает только из корзины. Это делает систему
тестируемой и воспроизводимой.

### Выход

- runs/predictions/latest_forecast.json — актуальный snapshot (100+ КБ).
- runs/predictions/ensemble_<timestamp>.json — снапшоты по времени.
- runs/predictions/<module>.json — результаты отдельных модулей.
- WebSocket-канал — real-time публикация.

- - -
## Snapshot — структура

    {
      // Идентификация
      id, timestamp, version, elapsedMs,
      preset_id, map_id,
      source_sweep: { type, version, count },
    
      // Базовые события
      events: {
        <event_id>: {
          name, category, horizonHours,
          finalProbability, calibratedProbability,
          ensemble, disagreement,
          sourceBreakdown: [...],
        }
      },
      explanations: {...},
      topRisks: [...],
    
      // Базовые результаты фаз B–R
      stateClassification, markov, monteCarlo, timeseries, cascade,
      scientific, neural, advanced, sources, knowledgeGraph,
      calibration, activeLearning, pythonBridge,
    
      // Расширения v6.0+
      v6_extensions: {
        version, phase, elapsedMs,
        totalModules, okCount, errorCount, skippedCount,
        signals: [...], moduleResults: {...}, failures: [...],
      },
      catalog_extensions: { ... },
      v7_extensions: {
        version, ok, elapsedMs,
        moduleStatus, activeModules, totalModules,
        synthesis: { consensus, confidence, confidenceLevel, reasoningSteps },
        answers: [...],
        interpretation,
      },
    
      new_module_signals: [...],
      failures: [...],
    
      summary: { topRisk, regimeShift, signalsProcessed },
    }

- - -
## Ансамблирование

### Базовое (фаза I)

Все сигналы от базовых моделей (B–R) усредняются с весами:

- Brier-веса обновляются автоматически по разрешённым прогнозам.
- Платт-калибровка (минимум 20 разрешённых).

### Расширенное (фазы S+T+U)

v6.0, каталог, v7.0 добавляют новые сигналы:

- Каждый модуль даёт свой signal (high/medium/low) и value (0..1).
- Сигналы попадают в snapshot.explanation.reasoning_steps.
- Веса в BASE_WEIGHTS — эвристика, может быть оптимизирована через AutoML в
  будущем.

### Confidence (v7.0)

Confidence = 0.7·agreement + 0.3·coverage:

- agreement — доля модулей с одним направлением
  (escalation/deescalation/stable).
- coverage — доля активных модулей от 4.

Высокий confidence → система уверена. Низкий → неопределённость.

- - -
## Метрики качества

### Brier Score

Основная метрика калибровки. Обновляется по разрешённым прогнозам (когда
событие произошло или не произошло).

Формула: BS = (1/N)·Σ(p_i - o_i)², где p — предсказанная вероятность, o — исход
(0/1).

### Reliability curve

Строится по бинам предсказанных вероятностей. Если кривая близка к диагонали —
модель хорошо откалибрована.

### Agreement (v7.0)

Согласие между модулями. Высокий agreement → устойчивый прогноз. Низкий →
разные точки зрения.

### Forgetting delta (continual_learning)

Насколько модель забыла старые паттерны при дообучении. Меньше — лучше.

- - -
## Dashboard

Файлы:

- dashboard/crucix.html — основной интерфейс (22 КБ).
- dashboard/cockpit.html — управление (48 КБ).
- dashboard/hypergraph.html — визуализация гиперграфа.
- dashboard/attention.html — динамика внимания.
- dashboard/coevolution.html — эволюция противника.
- dashboard/pwa/* — PWA-обёртка.

Все дашборды питаются из runs/predictions/latest_forecast.json через fetch +
WebSocket.

- - -
## Плагины

plugins/ — система плагинов:

- loader.mjs — загрузка манифестов.
- sandbox.mjs + sandbox_worker.mjs — изолированное выполнение.
- hooks.mjs — система хуков (on_sweep, on_forecast, ...).
- registry.mjs — реестр плагинов.

Плагины могут добавлять свои источники данных и свои модули анализа.

- - -
## Интеграции

- **Slack** — отправка алертов.
- **Notion** — выгрузка прогнозов.
- **Obsidian** — экспорт в базу знаний.
- **RSS** — публикация feed.
- **Email** — резервный канал алертов.
- **Webhook Manager** — управление подписками.

- - -
## Наблюдаемость

- **OpenTelemetry** (observability/otel.mjs) — трейсы.
- **Prometheus alerts** (observability/alerts/prometheus.yml).
- **Grafana dashboard** (observability/dashboards/grafana/crucix-overview.json).

- - -
## Деплой

- **Docker** (docker/Dockerfile.engine + docker-compose.engine.yml).
- **K8s** (k8s/*.yaml — deployment, service, ingress, hpa, cronjob).
- **CI/CD** (.github/workflows/*.yml).

- - -
## Тесты

    tests/
    ├── v6/                    2 файла, 35 тестов
    ├── catalog/               2 файла, 31 тест
    ├── v7/                    1 файл, 22 теста
    ├── integration/           1 файл, 10 тестов
    ├── predict/               базовые тесты модулей
    ├── property/              property-based tests
    ├── fuzz/                  fuzz-тесты
    ├── mutation/              mutation testing
    ├── chaos/                 chaos engineering
    └── load/                  k6 + artillery

Итого новых: 98 тестов, все PASS.

- - -
## Документация

    docs/handbook/
    ├── 00-intro.md
    ├── 01-architecture.md
    ├── 02-sciences.md
    ├── 03-models.md
    ├── 08-testing.md
    ├── 16-advanced-contagion.md
    ├── v6.0.md                этот релиз
    ├── catalog.md             этот релиз
    ├── v7.0.md                этот релиз
    ├── pipeline-S-T-U.md      этот релиз
    ├── architecture-overview.md  ← вы здесь
    └── sciences/*.md          по наукам

- - -
## Что дальше — v8.0 (замысел)

После v7.0 логичное развитие:

1.  **AI Agent над Crucix** — LLM-планировщик, который сам решает какие модули
    запускать и как отвечать оператору (см. обсуждение в чате).
2.  **World Models v2** — многоуровневые миры (микро/макро).
3.  **Meta-Learning (MAML)** — быстрое дообучение на редких событиях.
4.  **Multi-Agent Dreamer** — несколько акторов с разными политиками.
5.  **Hierarchical World Models** — вложенные миры с иерархией.

- - -
## Принципы

1.  **Graceful degradation** — падение модуля не убивает конвейер.
2.  **Persistent state** — если что-то сохраняется, оно должно быть валидируемо
    при загрузке.
3.  **Time-precedence** — для observational данных причинность определяется через
    время.
4.  **Consensus через синтез** — не одна модель, а ансамбль с agreement-метрикой.
5.  **Объяснимость** — каждый прогноз идёт с reasoning_steps.
6.  **Модульность** — новый модуль добавляется как фаза в engine_v*_patch.mjs.

- - -
**Конец документа architecture-overview.md**

