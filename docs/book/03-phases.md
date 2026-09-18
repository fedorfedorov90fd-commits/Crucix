# Глава 3. Фазы и модули

**Создана:** 2026-09-17
**Актуально на:** 2026-09-17
**Версия проекта:** 8.0.0
**Всего модулей:** 57
**Всего фаз:** 17

---

## Порядок выполнения

Базовые фазы A-R → S+T (параллельно) → U → Z.

Профиль `minimal` пропускает D, E, F, L, S, T, U.
Профиль `balanced` включает всё кроме U.
Профиль `full` включает всё.

---

## Фаза B — Базовые модели (7 модулей)

**Назначение:** первичные модели по sweep и истории.

| Модуль | Тип | Timeout | Описание |
|--------|-----|---------|----------|
| bayesian | predictive | 5s | Байесовское обновление |
| naivebayes | predictive | 5s | Наивный Байес |
| markov | predictive | 5s | Цепь Маркова |
| montecarlo | predictive | 30s | Монте-Карло |
| timeseries | predictive | 10s | SES/Holt/AR |
| cascade | predictive | 5s | Каскадные цепочки |
| calibration | meta | 10s | Brier Score |

---

## Фаза C — Научный синтез (11 модулей)

**Назначение:** модели из смежных наук.

| Модуль | Наука | Описание |
|--------|-------|----------|
| hawkes | Сейсмология | Само-возбуждающийся процесс |
| hmm | Распознавание речи | Скрытые марковские модели |
| kalman | Навигация | Фильтр Калмана |
| ising | Физика | Модель Изинга |
| transferentropy | Теория информации | Transfer Entropy |
| contagion | Эпидемиология | SIR/SEIR |
| evt | Финансы | Extreme Value Theory |
| ornstein | Финансы | Ornstein-Uhlenbeck |
| copula | Финансы | Copula |
| bocpd | Байес | Change Point Detection |
| particle | Навигация | Particle Filter |

---

## Фаза D — Нейросетевой слой (3 модуля)

| Модуль | Описание |
|--------|----------|
| mlp | MLP (классификация режима) |
| gcn | Graph Convolutional Network |
| dqn | Deep Q-Network |

---

## Фаза E — Продвинутые модели (5 модулей)

| Модуль | Описание |
|--------|----------|
| swarm | Агентная симуляция (300 агентов) |
| causal | Causal inference (do-calculus) |
| gametheory | Nash/Stackelberg |
| narrative | SIR-модель инфовойны |
| regime_shift | Детектор смены режима |

---

## Фаза F — Источники (3 модуля)

| Модуль | Описание |
|--------|----------|
| prediction_markets | Polymarket/Metaculus/Kalshi |
| multilang | Многоязычный NLP (11 языков) |
| satellite | Sentinel/Landsat, YOLOv8 |

---

## Фаза G — Граф знаний (1 модуль)

| Модуль | Описание |
|--------|----------|
| knowledge_graph | Синтез графа знаний (единый) |

---

## Фаза I — Ансамблирование (1 модуль)

| Модуль | Описание |
|--------|----------|
| ensemble | 4 метода: weighted/logpool/median/trimmed |

Auto-выбор метода по disagreement:
- >0.25 → trimmed
- >0.15 → median
- иначе → logpool

---

## Фаза J — Рефлексивная коррекция (1 модуль)

| Модуль | Описание |
|--------|----------|
| reflexive | Учёт реакции на публикацию прогноза |

---

## Фаза K — Объяснимость (1 модуль)

| Модуль | Описание |
|--------|----------|
| explainability | permutation importance + counterfactual + uncertainty + reasoning chain |

---

## Фаза L — Активное обучение (1 модуль)

| Модуль | Описание |
|--------|----------|
| active_learning | Выбор источников (UCB) |

---

## Фаза S — v6.0 научный синтез (5 модулей)

| Модуль | Метод | Описание |
|--------|-------|----------|
| neural_causal_discovery | NO TEARS + Attention | Поиск DAG причинности |
| continual_learning | EWC + SI | Не забывать старое |
| causal_rl | Q-learning + causal mask | Действия через причинность |
| quantum_hypergraph | QUBO + Path-Integral | N-арные связи |
| zk_federated | Schnorr + DP | Распределённое обучение |

---

## Фаза T — Каталог (6 модулей)

| Модуль | Метод | Описание |
|--------|-------|----------|
| mcmc | MH/Gibbs/HMC | Байесовский вывод |
| physics_inspired | SOC/Percolation/Catastrophe/Chaos | Физика сложных систем |
| automl | GP + BO | AutoML |
| anomaly_detection | IF/LOF/Mahal/SVM/DBSCAN | Ансамбль детекторов |
| graph_sage | Inductive GNN | Графовые эмбеддинги |
| actor_critic | A2C + GAE | RL политика |

---

## Фаза U — v7.0 Simulation Engine (1 модуль)

| Модуль | Описание |
|--------|----------|
| simulation_engine | World Model + Neural ODE + Dreamer + Continuous Causal |

Timeout: 180 секунд.

---

## Фаза J3 — v3 Meta layers (5 модулей)

| Модуль | Описание |
|--------|----------|
| temporal_causal | Распределения задержек |
| multilayer_causal | 4-слойный DAG |
| narrative_warfare | Координация кампаний |
| resource_exhaustion | Истощение ресурсов |
| meta_ensemble | Online model selection |

---

## Фаза K3 — v3 Scenarios (1 модуль)

| Модуль | Описание |
|--------|----------|
| scenario_generator | LLM-генерация 7 сценариев |

---

## Фаза L3 — v3 Advanced layers (3 модуля)

| Модуль | Описание |
|--------|----------|
| hypergraph_contagion | AND/OR/MAJORITY гиперрёбра |
| attention_dynamics | Explosiveness внимания |
| adversarial_coevolution | KL-адаптация противника |

---

## Фаза Z — Трекинг и Composite Risk (2 модуля)

| Модуль | Описание |
|--------|----------|
| extended_tracker | Brier декомпозиция, drift, bootstrap CI |
| composite_risk | Единый композитный индикатор |

---

## Сводка: 57 модулей

| Фаза | Модулей |
|------|---------|
| B | 7 |
| C | 11 |
| D | 3 |
| E | 5 |
| F | 3 |
| G | 1 |
| I | 1 |
| J | 1 |
| K | 1 |
| L | 1 |
| S | 5 |
| T | 6 |
| U | 1 |
| J3 | 5 |
| K3 | 1 |
| L3 | 3 |
| Z | 2 |
| **Всего** | **57** |

---

## Связи

- **Паспорта фаз:** `docs/modules/phase-*.md` (17 файлов).
- **Реестр:** `apis/predict/register_coordinat_all.mjs`.

---

**Конец файла 03-phases.md**
