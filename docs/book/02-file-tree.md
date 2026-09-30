# Глава 2. Карта дерева файлов

**Создана:** 2026-09-17
**Актуально на:** 2026-09-17
**Всего файлов:** 269 (без нарезки и служебных)
**Версия проекта:** 8.0.0

---

## Верхний уровень (корень проекта)

/home/ta8/predict-extensions/
├── apis/ — источники данных и прогностическое ядро
├── dashboard/ — HTML-интерфейсы + PWA
├── data/ — корзина данных (basket)
├── docker/ — Dockerfile, docker-compose
├── docs/ — handbook + book + modules + book-parts
├── features/ — модули по фичам (human-feedback)
├── integrations/ — Slack, Notion, Obsidian, Email, Webhook, RSS
├── k8s/ — Kubernetes манифесты
├── observability/ — OTEL, Prometheus, Grafana
├── plugins/ — система плагинов + примеры
├── runs/ — рабочие данные (snapshots, history)
├── scripts/ — служебные скрипты
├── tests/ — тесты (unit, property, fuzz, mutation, chaos)
├── backups/ — бэкапы (30+ файлов)
├── .github/ — CI/CD workflows
├── package.json — v4.0.0 (рассинхрон)
├── README_CRUCIX_v4.md — README
├── PROBLEMS.md — реестр проблем
├── PROBLEMS.txt — старый реестр
└── PROMPT_FOR_NEW_CHAT.md — промпт для нового чата
---

## apis/ — источники и ядро

### apis/predict/ — оркестратор и модули

**Ядро:**
- `engine.mjs` — единый оркестратор (2000 строк, 25 экспортов).
- `register_coordinat_all.mjs` — реестр 57 модулей.
- `crucix_engine_v3.mjs` — координатор v3-слоёв (9 модулей).
- `crucix_engine_v4.mjs` — обёртка с hooks/plugins/PWA/REST.
- `extended_tracker.mjs` — расширенный трекинг точности.
- `composite_risk.mjs` — композитный индикатор риска.
- `engine_coordinat.mjs` — альтернативный (profiles).
- `engine_integration_patch.mjs` — фазы N/O/P/Q.
- `engine_v6_patch.mjs` — фазы S+T.
- `engine_v7_patch.mjs` — фаза U.

**Модули верхнего уровня (49 файлов):**
- Модели: bayesian.mjs, naivebayes.mjs, markov.mjs, montecarlo.mjs, timeseries.mjs, cascade.mjs, calibration.mjs.
- Науки: hawkes.mjs (в models/), hmm.mjs (в models/), kalman.mjs (в models/) — см. models/.
- Продвинутые: swarm.mjs, causal.mjs, gametheory.mjs, narrative.mjs, narrative_unified.mjs, narrative_warfare.mjs, reflexive.mjs, regime_shift.mjs, active_learning.mjs, explainability.mjs, multilayer_causal.mjs, temporal_causal.mjs, resource_exhaustion.mjs, meta_ensemble.mjs, scenario_generator.mjs, hypergraph_contagion.mjs, hypergraph_discovery.mjs, attention_dynamics.mjs, adversarial_coevolution.mjs, multiscale_attention.mjs, opponent_ppo.mjs, bayesian_causal.mjs, federated_hypergraph.mjs, llm_agents.mjs, automl.mjs, anomaly_detection.mjs, ensemble.mjs.
- Инфраструктура: ws.mjs, ws_v4_patch.mjs, notifier.mjs, python_bridge.mjs, plugins_api.mjs.
- Пустой: register_coordinat_all.mjs (заполнен).

### apis/predict/models/ (23 файла)

- hawkes.mjs, hmm.mjs, kalman.mjs, ising.mjs, transferentropy.mjs, contagion.mjs, evt.mjs, ornstein.mjs, copula.mjs, bocpd.mjs, particle.mjs.
- neural.mjs, graph_neural.mjs, reinforcement.mjs, transformer.mjs, vae.mjs, diffusion.mjs.
- mcmc.mjs, physics_inspired.mjs, graph_sage.mjs, actor_critic.mjs.
- bayesnet.mjs, anomaly_detection.mjs (дубликат?).

### apis/predict/v6/ (5 файлов) — научный синтез v6.0

- neural_causal_discovery.mjs, continual_learning.mjs, causal_rl.mjs, quantum_hypergraph.mjs, zk_federated.mjs.

### apis/predict/v7/ (5 файлов) — Simulation Engine v7.0

- world_model.mjs, neural_ode.mjs, dreamer.mjs, continuous_causal.mjs, simulation_engine.mjs.

### apis/predict/agent/ (6 файлов) — v8.0 AI Agent

- agent_core.mjs, tool_registry.mjs, planner.mjs, executor.mjs, narrator.mjs, server.mjs.

### apis/predict/core/ (3 файла)

- linear_algebra.mjs, stats.mjs, optim.mjs.

### apis/predict/exotic/ (7 файлов)

- chaos.mjs, game_theory.mjs, infogeo.mjs, networks.mjs, quantum_sa.mjs, signal_advanced.mjs, wasserstein.mjs.

### apis/predict/federated/ (2 файла)

- fl_node.mjs, fl_protocol.mjs.

### apis/predict/wasm/ (1 файл)

- simd_loader.mjs + .wat.

### apis/predict/webgl/ (3 файла)

- gpu.mjs, shaders.mjs, example_gpu.mjs.

### apis/predict/workers/ (4 файла)

- pool.mjs, montecarlo_worker.mjs, crucix_worker.mjs, example_parallel.mjs.

### apis/sources/ (3 файла)

- prediction_markets.mjs, multilang.mjs, satellite.mjs.

### apis/knowledge/ (1 файл)

- graph.mjs — синтез графа знаний (единственный теперь).

---

## dashboard/ (10 + PWA)

- `crucix.html` — основной прогностический дашборд.
- `cockpit.html` — единая точка управления.
- `agent.html` — UI оператора AI Agent.
- `advanced.html` — продвинутая аналитика.
- `attention.html` — динамика внимания.
- `coevolution.html` — модель противника.
- `hypergraph.html` — N-арные причинные связи.
- `plugins.html` — менеджер плагинов.
- `predictions_composite.html` — композитный риск.
- `realtime.html` — события реального времени.

**PWA:** install.js, push.js, service-worker.js, manifest.json + иконки.

---

## tests/ (40+ файлов)

- `predict/` (9) — unit-тесты модулей.
- `property/` (6) — property-based тесты.
- `fuzz/` (5) — fuzz-тесты.
- `mutation/` (7) — mutation testing.
- `chaos/` (2) — chaos engineering.
- `integration/` (2) — интеграционные.
- `v6/` (2), `v7/` (1), `catalog/` (2) — тесты новых фаз.
- `load/k6/` (2), `load/artillery/` (2) — нагрузочные.

---

## docs/

- `handbook/` (13 + sciences/17) — оригинальная книга v3.0.0.
- `book/` (эта книга) — 7 глав + README + INDEX.
- `modules/` — 17 паспортов фаз.
- `book-parts/` — нарезка 6 томов + 89 кусков.

---

## k8s/ (11 файлов)

namespace, configmap, secrets, deployment-crucix, service, ingress, hpa, cronjob, statefulset-python, servicemonitor, kustomization.

## docker/ (3 файла)

Dockerfile.engine, docker-compose.engine.yml, entrypoint.sh, healthcheck.sh.

## integrations/ (7 файлов)

slack.mjs, notion.mjs, obsidian.mjs, rss.mjs, email.mjs, webhook_manager.mjs, README.md.

## plugins/ (7 + examples)

loader.mjs, sandbox.mjs, sandbox_worker.mjs, hooks.mjs, registry.mjs, manifest_schema.mjs, README.md.
Examples: hello-world, data-fetcher, custom-signal.

## observability/ (3 + alerts + dashboards)

otel.mjs, instrumentation.mjs, README.md.
alerts/prometheus.yml.
dashboards/grafana/crucix-overview.json.

## scripts/ (10 файлов)

apply_v6_patch.mjs, apply_v7_patch.mjs, build-book-parts.mjs, fix-duplicates.mjs, rename-crucix.mjs, split-book-parts.mjs, fix-role-duplication.log, rename-crucix.log, neo4j_export.py, README_neo4j.md.

---

## Связи

- **Глава 3 (phases):** 17 фаз и их модули.
- **Глава 4 (orchestrator):** engine.mjs.
- **docs/modules/:** паспорта фаз с деталями.

---

**Конец файла 02-file-tree.md**
