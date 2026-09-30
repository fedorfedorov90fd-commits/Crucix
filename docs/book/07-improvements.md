# Глава 7. Что нарастить

**Создана:** 2026-09-17
**Актуально на:** 2026-09-17
**Версия проекта:** 8.0.0

---

## Назначение

Список улучшений существующих модулей: что добавить, чтобы поднять уровень функционала. Не новые модули, а расширение имеющихся.

Правило проекта: новый модуль не должен быть урезанным относительно того, что он заменяет. Только наращивать.

---

## Расширения по фазам

### Фаза B — Базовые модели

**bayesian.mjs:**
- Добавить иерархический Байес (multi-level priors).
- Добавить байесовский model averaging.

**markov.mjs:**
- Добавить HSMM (скрытые полумарковские модели).
- Добавить continuous-time Markov chains.

**montecarlo.mjs:**
- Добавить variance reduction (importance sampling, antithetic variates).
- Добавить Quasi-Monte Carlo (Sobol sequences).

**timeseries.mjs:**
- Добавить ARIMA(p,d,q).
- Добавить GARCH для волатильности.
- Добавить Prophet-подобный decomposition (trend + seasonality + holiday).

**calibration.mjs:**
- Добавить isotonic regression как альтернативу Platt.
- Добавить Beta calibration.

---

### Фаза C — Научный синтез

**hawkes.mjs:**
- Добавить рекурсивную форму для больших N (O(1) вместо O(N)).
- Добавить multivariate Hawkes (взаимное возбуждение).

**hmm.mjs:**
- Добавить Hierarchical HMM.
- Добавить Input-Output HMM.

**kalman.mjs:**
- Добавить Unscented Kalman Filter (UKF) для сильно нелинейных систем.

**ising.mjs:**
- Добавить динамический Ising (time-varying coupling).

**transferentropy.mjs:**
- Добавить conditional TE (учёт confounding).

**contagion.mjs:**
- Добавить NetworkContagion с реальной топологией (вместо SIR на полном графе).

**evt.mjs:**
- Добавить multivariate EVT (для совместных хвостов).

**copula.mjs:**
- Добавить Vine Copula (для 6+ переменных).

**bocpd.mjs:**
- Добавить Student-t model (устойчивость к выбросам).

**particle.mjs:**
- Добавить Rao-Blackwellized PF (для смешанных состояний).

---

### Фаза D — Нейросетевой слой

**mlp.mjs:**
- Добавить dropout.
- Добавить batch normalization.
- Добавить learning rate scheduling.

**graph_neural.mjs:**
- Добавить Graph Attention Network (GAT) — веса на рёбрах.

**reinforcement.mjs:**
- Добавить Double DQN (снижение overestimation).
- Добавить Dueling DQN (разделение value и advantage).
- Добавить Prioritized Experience Replay.

---

### Фаза E — Продвинутые модели

**swarm.mjs:**
- Добавить разные типы агентов (голуби, ястребы, наблюдатели).
- Добавить пространственную структуру (соседи vs все).

**causal.mjs:**
- Добавить instrumental variables.
- Добавить regression discontinuity.

**gametheory.mjs:**
- Добавить Bayesian games (неполная информация).
- Добавить evolutionary games.

**narrative.mjs:**
- Добавить многоязычную поддержку (интеграция с multilang).
- Добавить сетевой анализ распространения (кто на кого влияет).

**regime_shift.mjs:**
- Добавить Markov-Switching models.

---

### Фаза F — Источники

**prediction_markets.mjs:**
- Добавить arbitrage detection между платформами.
- Добавить volume-weighted probabilities.

**multilang.mjs:**
- Добавить языков: +5 (арабский, фарси, корейский).

**satellite.mjs:**
- Добавить SAR change detection.
- Добавить runway/radar detection (Python YOLOv8).

---

### Фаза I — Ансамблирование

**ensemble.mjs:**
- Добавить stacking (meta-learner на выходах модулей).
- Добавить dynamic weighting по режиму (режим → разные веса).

---

### Фаза J — Рефлексивная коррекция

**reflexive.mjs:**
- Добавить Soros reflexivity с обратной связью (прогноз → действие → новый прогноз).

---

### Фаза K — Объяснимость

**explainability.mjs:**
- Добавить SHAP-like (вместо permutation importance).
- Добавить Anchors (минимальные правила, объясняющие прогноз).

---

### Фаза L — Активное обучение

**active_learning.mjs:**
- Добавить query by committee (несколько моделей голосуют, где брать данные).
- Добавить expected model change.

---

### Фаза S — v6.0

**neural_causal_discovery.mjs:**
- Добавить NOTEARS-MLP (нелинейная версия).

**continual_learning.mjs:**
- Добавить Progressive Neural Networks.

**causal_rl.mjs:**
- Добавить counterfactual policy evaluation.

**quantum_hypergraph.mjs:**
- Добавить D-Wave-совместимый формат.

**zk_federated.mjs:**
- Добавить zk-SNARK (вместо только Schnorr).

---

### Фаза T — Каталог

**mcmc.mjs:**
- Добавить NUTS (No-U-Turn Sampler).

**physics_inspired.mjs:**
- Добавить Renormalization Group.

**automl.mjs:**
- Добавить Neural Architecture Search.

**anomaly_detection.mjs:**
- Добавить autoencoder-based detection.

**graph_sage.mjs:**
- Добавить multi-hop aggregation.

**actor_critic.mjs:**
- Добавить PPO-clip (вместо чистого A2C).

---

### Фаза U — v7.0

**world_model.mjs:**
- Добавить attention-based VAE.

**neural_ode.mjs:**
- Добавить Adjoint method (полный backprop через ODE).

**dreamer.mjs:**
- Добавить multi-agent dreamer.

**continuous_causal.mjs:**
- Добавить continuous treatment effects.

**simulation_engine.mjs:**
- Добавить hierarchical world models.

---

### Фаза v3 — J3/K3/L3

**temporal_causal.mjs:**
- Добавить non-stationary lag distributions.

**multilayer_causal.mjs:**
- Добавить causal discovery (learning structure from data).

**narrative_warfare.mjs:**
- Добавить attribution (кто запустил кампанию).

**resource_exhaustion.mjs:**
- Добавить counterfactual на ресурсы.

**meta_ensemble.mjs:**
- Добавить temporal meta-learner (учится предсказывать regime shifts).

**scenario_generator.mjs:**
- Добавить causal scenarios (генерирует не просто варианты, а причинные цепочки).

**hypergraph_contagion.mjs:**
- Добавить hypergraph neural networks.

**attention_dynamics.mjs:**
- Добавить multi-scale attention.

**adversarial_coevolution.mjs:**
- Добавить opponent modeling with RL.

---

### Фаза Z — Трекинг

**extended_tracker.mjs:**
- Добавить power analysis (сколько прогнозов нужно для значимости).
- Добавить change-point detection на Brier Score.

**composite_risk.mjs:**
- Добавить Shapley values для корректного распределения вклада.

---

## Новые модули (кандидаты)

### Топ-приоритет

1. `explainability/shap.mjs` — SHAP values.
2. `models/nuts.mjs` — NUTS для MCMC.
3. `models/gat.mjs` — Graph Attention Network.
4. `models/arima.mjs` — ARIMA + GARCH.
5. `models/msm.mjs` — Markov-Switching models.

### Средний приоритет

6. `models/renormalization.mjs` — Renormalization Group.
7. `models/progressive_nn.mjs` — Progressive Neural Networks.
8. `models/attention_vae.mjs` — Attention-based VAE.
9. `causal/iv.mjs` — Instrumental variables.
10. `ensemble/stacking.mjs` — Stacking meta-learner.

### Долгосрочные

11. `multi_agent_dreamer.mjs` — Multi-agent Dreamer.
12. `hierarchical_world_models.mjs` — Hierarchical World Models.
13. `temporal_meta_learner.mjs` — Temporal Meta-Learner.
14. `causal_scenarios.mjs` — Causal Scenario Generator.
15. `narrative_attribution.mjs` — Narrative Attribution.

---

## Метрики успеха

После каждого расширения проверять:

1. **Точность:** Brier Score не должен ухудшиться.
2. **Скорость:** elapsedMs не должен вырасти >20%.
3. **Покрытие:** новые модули должны быть зарегистрированы в register_coordinat_all.mjs.
4. **Тесты:** новый функционал покрыт тестами.

---

## Связи

- **Глава 5 (diagnostics):** что не работает.
- **Глава 6 (roadmap):** план работ.
- **PROBLEMS.md:** детальные записи.

---

**Конец файла 07-improvements.md**
