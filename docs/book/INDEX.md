# Crucix Predict-Extensions — INDEX (уровень 1)

**Версия:** 1.0.0
**Создан:** 2026-09-17
**Актуально на:** 2026-09-17
**Версия проекта:** 8.0.0

---

## Назначение

Единый промпт-файл для заброса в чат. Содержит: где я, что за проект, что требуется, карту файлов с шапками.

Порядок работы:
1. Этот файл — для общего контекста.
2. docs/modules/phase-*.md — паспорта фаз (уровень 2).
3. Сами .mjs файлы — код (уровень 3).
4. data/help/ru/*.md + data/help/en/*.md — справки на файлы (уровень 4).

---

## Что за проект

Crucix — открытая прогностическая система геополитических и экономических событий.
Конкурирует с Palantir, Recorded Future, Seldon Vault.

**Ядро:** 16-фазный конвейер прогноза.
**Фазы:** A-R (базовые) → S (v6) + T (каталог) → U (v7 Simulation) → Z (публикация).
**Модулей:** 57 (44 predictive, 10 meta, 3 source).
**Оркестратор:** apis/predict/engine.mjs (2000 строк, 25 экспортов).
**Реестр:** apis/predict/register_coordinat_all.mjs.

---

## Карта файлов (по папкам)

Всего исходников: 269 файлов.

### (корень) (4)

#### package.json

- **Путь:** package.json
- **Размер:** 1371 B, 36 строк
- **О чём:** { "name": "crucix", "version": "4.0.0",

#### PROBLEMS.md

- **Путь:** PROBLEMS.md
- **Размер:** 6581 B, 163 строк
- **О чём:** # PROBLEMS.md — Реестр проблем проекта Crucix predict-extensions **Создан:** 2026-09-17 **Актуально на:** 2026-09-17

#### PROBLEMS.txt

- **Путь:** PROBLEMS.txt
- **Размер:** 11731 B, 304 строк
- **О чём:** PROBLEMS.md — текущий раздел проблем проекта Crucix predict-extensions Назначение: единый реестр всех проблем, битых файлов, огрызков, недоделок и замыслов. Правило: НИЧЕГО НЕ УДАЛЯТЬ. Всё либо чинится, либо восстанавливается, либо пишется с нуля.

#### README_CRUCIX_v4.md

- **Путь:** README_CRUCIX_v4.md
- **Размер:** 18037 B, 479 строк
- **О чём:** Crucix — Predictive Intelligence Platform Версия: 8.0.0 Ядро: 16-фазный конвейер (A–R, S, T, U, Z) Файлов: 303 Лицензия: MIT Zero dependencies — чистый Node.js 20+ (ESM)


### apis/predict (49)

#### active_learning.mjs

- **Путь:** apis/predict/active_learning.mjs
- **Размер:** 11260 B, 340 строк
- **Экспорты:** export {
- **О чём:** Активное обучение: система сама определяет, какие данные собрать. Теоретическая основа:

#### adversarial_coevolution.mjs

- **Путь:** apis/predict/adversarial_coevolution.mjs
- **Размер:** 12704 B, 311 строк
- **Экспорты:** export const meta = { | export class OpponentModel { | export class AdversarialCoEvolution { | export function crucixAdversarialCoEvolution(latest, history, stateFile = null) {
- **О чём:** Adversarial Co-evolution — противник адаптируется к нашим прогнозам. Модель предполагает, что противник обучается и меняет стратегию.

#### anomaly_detection.mjs

- **Путь:** apis/predict/anomaly_detection.mjs
- **Размер:** 23363 B, 788 строк
- **Экспорты:** export function crucixAnomalyDetection(history, options = {}) { | export {
- **О чём:** Anomaly Detection для прогностического слоя Crucix Пять методов + ансамбль: Isolation Forest, LOF, Mahalanobis, One-Class SVM (RBF), DBSCAN

#### attention_dynamics.mjs

- **Путь:** apis/predict/attention_dynamics.mjs
- **Размер:** 10763 B, 294 строк
- **Экспорты:** export const meta = { | export class AttentionDynamics { | export function crucixAttentionDynamics(latest, history, stateFile = null) { | export { extractTopicsFromSweep };
- **О чём:** Collective Attention Dynamics Анализ того, куда направлено коллективное внимание и как оно перетекает. Внимание — самый ранний сигнал: опережает действия на 24-72 часа.

#### automl.mjs

- **Путь:** apis/predict/automl.mjs
- **Размер:** 38978 B, 1220 строк
- **Экспорты:** export function crucixAutoML(history, options = {}) { | export {
- **О чём:** AutoML + Bayesian Optimization для прогностического слоя Crucix Часть A: шапка, утилиты, Gaussian Process, ядра, acquisition functions Часть B: BayesianOptimizer, AutoML, crucixAutoML, экспорты

#### bayesian_causal.mjs

- **Путь:** apis/predict/bayesian_causal.mjs
- **Размер:** 14236 B, 470 строк
- **Экспорты:** export function crucixBayesianCausalDiscovery(history, opts = {}) { | export {
- **О чём:** Bayesian Causal Discovery Байесовский вывод структуры DAG через MCMC по пространству графов.

#### bayesian.mjs

- **Путь:** apis/predict/bayesian.mjs
- **Размер:** 8780 B, 215 строк
- **Экспорты:** export {
- **О чём:** Байесовское ядро прогностического слоя Crucix Обновление вероятностей событий по теореме Байеса после каждого sweep.

#### calibration.mjs

- **Путь:** apis/predict/calibration.mjs
- **Размер:** 14686 B, 422 строк
- **Экспорты:** export {
- **О чём:** Калибровка вероятностных прогнозов и трекинг точности моделей. Теоретическая основа:

#### cascade.mjs

- **Путь:** apis/predict/cascade.mjs
- **Размер:** 12133 B, 333 строк
- **Экспорты:** export {
- **О чём:** Каскадное распространение вероятностей по графу событий. Теоретическая основа:

#### causal.mjs

- **Путь:** apis/predict/causal.mjs
- **Размер:** 12121 B, 421 строк
- **Экспорты:** export {
- **О чём:** Причинный вывод по Джуде Перлу: do-calculus, counterfactual reasoning. Теоретическая основа:

#### composite_risk.mjs

- **Путь:** apis/predict/composite_risk.mjs
- **Размер:** 12825 B, 379 строк
- **Экспорты:** export {
- **О чём:** Composite Risk Indicator — единый композитный индикатор риска. Назначение:

#### crucix_engine_v3.mjs

- **Путь:** apis/predict/crucix_engine_v3.mjs
- **Размер:** 11610 B, 351 строк
- **Экспорты:** export {
- **О чём:** Crucix Engine v3 — координатор расширенных фаз J, K, L, M. Назначение:

#### crucix_engine_v4.mjs

- **Путь:** apis/predict/crucix_engine_v4.mjs
- **Размер:** 9221 B, 279 строк
- **Экспорты:** export class CrucixEngineV4 { | export async function runFullCrucixV4Cycle(latestPath, opts = {}) { | export { runCrucixExtendedV3 };
- **О чём:** Crucix Engine v4: Ultimate Edition Что нового по сравнению с v3:

#### engine_coordinat.mjs

- **Путь:** apis/predict/engine_coordinat.mjs
- **Размер:** 18221 B, 551 строк
- **Экспорты:** export function createForecastEngine(options) { | export {
- **О чём:** Оркестратор прогностических модулей Crucix Координация: загрузка данных -> параллельный запуск -> ансамблирование -> публикация engine_coordinat не знает о транспорте (WASM/WebGL/WS) — только о модулях и данных.

#### engine_integration_patch.mjs

- **Путь:** apis/predict/engine_integration_patch.mjs
- **Размер:** 29897 B, 871 строк
- **Экспорты:** export async function runNewModules(latest, history, existingPrediction = {}, options = {}) { | export async function runForecastPipelineExtended(latest, history, options = {}) { | export default runForecastPipelineExtended;
- **О чём:** =================================================================== Интеграционный патч для engine.mjs -- подключает 21 новых модулей к существующему прогностическому конвейеру Crucix.

#### engine_v6_patch.mjs

- **Путь:** apis/predict/engine_v6_patch.mjs
- **Размер:** 26040 B, 772 строк
- **Экспорты:** export async function runV6Phase(history, options = {}) { | export async function runCatalogPhase(history, options = {}) { | export function applyV6ToSnapshot(snapshot, v6Phase, catalogPhase) { | export async function runNewPhases(history, options = {}) { | export function healthcheck() {
- **О чём:** Engine v6.0 + каталог Integration Patch Назначение:

#### engine_v7_patch.mjs

- **Путь:** apis/predict/engine_v7_patch.mjs
- **Размер:** 8906 B, 269 строк
- **Экспорты:** export async function runV7Phase(history, options = {}) { | export function applyV7ToSnapshot(snapshot, v7Phase) { | export function healthcheck() { | export { CircuitBreaker, PATCH_VERSION };
- **О чём:** Engine v7.0 Integration Patch Назначение:

#### engine.mjs

- **Путь:** apis/predict/engine.mjs
- **Размер:** 78452 B, 2001 строк
- **Экспорты:** export { | export default runForecastPipeline;
- **О чём:** Единый оркестратор прогностического конвейера Crucix. Синтез из 6 оркестраторов:

#### ensemble.mjs

- **Путь:** apis/predict/ensemble.mjs
- **Размер:** 12949 B, 405 строк
- **Экспорты:** export {
- **О чём:** Ансамблирование прогностических моделей с динамическим взвешиванием. Теоретическая основа:

#### explainability.mjs

- **Путь:** apis/predict/explainability.mjs
- **Размер:** 8832 B, 287 строк
- **Экспорты:** export {
- **О чём:** Объяснимость прогнозов: Permutation Importance, контрфактические сценарии, декомпозиция неопределённости, цепочка рассуждений.

#### extended_tracker.mjs

- **Путь:** apis/predict/extended_tracker.mjs
- **Размер:** 18912 B, 582 строк
- **Экспорты:** export class ExtendedTracker { | export function getExtendedTracker() { | export function _resetExtendedTracker() { | export {
- **О чём:** Расширенный трекер точности прогнозов. Назначение:

#### federated_hypergraph.mjs

- **Путь:** apis/predict/federated_hypergraph.mjs
- **Размер:** 14456 B, 461 строк
- **Экспорты:** export function simulateFederatedHypergraph(history, opts = {}) { | export function crucixFederatedHypergraph(history, opts = {}) { | export {
- **О чём:** Federated Hypergraph Learning Распределённое обучение гиперграфов между несколькими инстансами Crucix

#### gametheory.mjs

- **Путь:** apis/predict/gametheory.mjs
- **Размер:** 11164 B, 329 строк
- **Экспорты:** export {
- **О чём:** Теоретико-игровое моделирование геополитики. Теоретическая основа:

#### hypergraph_contagion.mjs

- **Путь:** apis/predict/hypergraph_contagion.mjs
- **Размер:** 10127 B, 241 строк
- **Экспорты:** export const meta = { | export class Hypergraph { | export function crucixHypergraphContagion(latest, history) { | export { buildCrucixHypergraph };
- **О чём:** Cross-Domain Contagion via Hypergraph Гиперрёбра связывают 3+ узла одновременно. Позволяет моделировать тройные и N-арные причинные связи.

#### hypergraph_discovery.mjs

- **Путь:** apis/predict/hypergraph_discovery.mjs
- **Размер:** 19831 B, 572 строк
- **Экспорты:** export function discoverCausalHypergraph(history, opts = {}) { | export function crucixCausalHypergraphDiscovery(history) { | export {
- **О чём:** Causal Hypergraph Discovery Автоматический поиск N-арных причинных связей из данных

#### llm_agents.mjs

- **Путь:** apis/predict/llm_agents.mjs
- **Размер:** 15271 B, 347 строк
- **Экспорты:** export {
- **О чём:** Мультиагентный LLM-ансамбль для прогностического анализа. Теоретическая основа:

#### markov.mjs

- **Путь:** apis/predict/markov.mjs
- **Размер:** 11112 B, 316 строк
- **Экспорты:** export { MarkovChain, classifyState, buildStateSequence, distributionEntropy };
- **О чём:** Цепи Маркова для прогнозирования переходов режима системы. Теоретическая основа:

#### meta_ensemble.mjs

- **Путь:** apis/predict/meta_ensemble.mjs
- **Размер:** 15513 B, 416 строк
- **Экспорты:** export const meta = { | export class MetaLearner { | export function extractRegimeSignature(latest, history) { | export const DEFAULT_MODELS = [ | export class MetaEnsemble {
- **О чём:** Слой 5: Meta-Learning Ensemble — нейросеть для выбора весов моделей. Идея:

#### montecarlo.mjs

- **Путь:** apis/predict/montecarlo.mjs
- **Размер:** 13026 B, 385 строк
- **Экспорты:** export {
- **О чём:** Метод Монте-Карло для сценарного моделирования исходов. Теоретическая основа:

#### multilayer_causal.mjs

- **Путь:** apis/predict/multilayer_causal.mjs
- **Размер:** 19340 B, 374 строк
- **Экспорты:** export const meta = { | export const LAYERS = { | export const NODE_DEFINITIONS = { | export const CAUSAL_EDGES = [ | export class MultiLayerCausalGraph {
- **О чём:** Слой 2: Multi-Layer Causal DAG — единый причинный граф через четыре слоя реальности. Четыре слоя:

#### multiscale_attention.mjs

- **Путь:** apis/predict/multiscale_attention.mjs
- **Размер:** 15179 B, 431 строк
- **Экспорты:** export class MultiScaleAttention { | export function crucixMultiScaleAttention(history, stateFile = null) { | export { AttentionScale };
- **О чём:** Multi-scale Attention Dynamics Моделирование внимания одновременно на нескольких временных горизонтах.

#### naivebayes.mjs

- **Путь:** apis/predict/naivebayes.mjs
- **Размер:** 10387 B, 301 строк
- **Экспорты:** export { GaussianNaiveBayes, sweepToFeatures };
- **О чём:** Наивный байесовский классификатор (Gaussian Naive Bayes) для определения режима системы по признакам sweep.

#### narrative_unified.mjs

- **Путь:** apis/predict/narrative_unified.mjs
- **Размер:** 11150 B, 260 строк
- **Экспорты:** export const meta = { | export function crucixUnifiedNarrative(latest, history, options = {}) { | export function classifyNarrativeThreat(originType, sirForecast, confidence) { | export default crucixUnifiedNarrative;
- **О чём:** Объединение обычного нарративного анализа (SIR/SEIR) с детекцией информационной войны.

#### narrative_warfare.mjs

- **Путь:** apis/predict/narrative_warfare.mjs
- **Размер:** 16856 B, 427 строк
- **Экспорты:** export const meta = { | export const KNOWN_PROPAGANDA_SOURCES = new Set([ | export function isPropagandaSource(sourceUrl) { | export class NarrativeWarfareDetector { | export function computeNarrativeConfidence(posts) {
- **О чём:** Слой 3: Narrative Warfare Detection — детекция целенаправленных дезинформационных кампаний. Отличие от narrative.mjs:

#### narrative.mjs

- **Путь:** apis/predict/narrative.mjs
- **Размер:** 13401 B, 427 строк
- **Экспорты:** export {
- **О чём:** Нарративная диффузия: SIR/SEIR-модель распространения идей, мутация нарративов, оценка причинного влияния акторов.

#### notifier.mjs

- **Путь:** apis/predict/notifier.mjs
- **Размер:** 13353 B, 404 строк
- **Экспорты:** export {
- **О чём:** Уведомления о прогнозах: Discord, Telegram, custom webhook. Назначение:

#### opponent_ppo.mjs

- **Путь:** apis/predict/opponent_ppo.mjs
- **Размер:** 25128 B, 745 строк
- **Экспорты:** export function trainOpponentPPO(opts = {}) { | export function crucixOpponentPPO(history, opts = {}) { | export { PPOAgent, AdversarialEnv, MLP };
- **О чём:** Opponent Modeling with Deep Reinforcement Learning (PPO) Обучение модели противника через Proximal Policy Optimization.

#### plugins_api.mjs

- **Путь:** apis/predict/plugins_api.mjs
- **Размер:** 10788 B, 368 строк
- **Экспорты:** export async function handlePluginsAPI(req, res, url) { | export { PluginManager, getManager as getPluginManager };
- **О чём:** REST API для управления плагинами Endpoints:

#### python_bridge.mjs

- **Путь:** apis/predict/python_bridge.mjs
- **Размер:** 5249 B, 188 строк
- **Экспорты:** export {
- **О чём:** Мост к Python ML-сервису (sklearn, TensorFlow, PyTorch). Принцип:

#### reflexive.mjs

- **Путь:** apis/predict/reflexive.mjs
- **Размер:** 11721 B, 313 строк
- **Экспорты:** export {
- **О чём:** Рефлексивное прогнозирование: моделирование влияния публикации прогноза на саму систему.

#### regime_shift.mjs

- **Путь:** apis/predict/regime_shift.mjs
- **Размер:** 10661 B, 354 строк
- **Экспорты:** export {
- **О чём:** Детекция смены режима: CUSUM, Page-Hinkley, BOCPD, PELT. Теоретическая основа:

#### register_coordinat_all.mjs

- **Путь:** apis/predict/register_coordinat_all.mjs
- **Размер:** 16441 B, 228 строк
- **Экспорты:** export {
- **О чём:** Реестр прогностических модулей Crucix. Назначение:

#### resource_exhaustion.mjs

- **Путь:** apis/predict/resource_exhaustion.mjs
- **Размер:** 16081 B, 418 строк
- **Экспорты:** export const meta = { | export class MilitaryExhaustionModel { | export class EconomicExhaustionModel { | export function crucixResourceExhaustion(latest, history) {
- **О чём:** Слой 4: Resource Exhaustion Modeling — моделирование исчерпания ресурсов. Две модели:

#### scenario_generator.mjs

- **Путь:** apis/predict/scenario_generator.mjs
- **Размер:** 13155 B, 284 строк
- **Экспорты:** export const meta = { | export class LLMProvider { | export class ScenarioGenerator { | export async function crucixScenarioGeneration(latest, context = {}) {
- **О чём:** Слой 6: LLM Scenario Generator — генерация сценариев развития событий. Компоненты:

#### swarm.mjs

- **Путь:** apis/predict/swarm.mjs
- **Размер:** 15882 B, 443 строк
- **Экспорты:** export {
- **О чём:** Агентное социальное моделирование (MiroFish-подход для Crucix). Теоретическая основа:

#### temporal_causal.mjs

- **Путь:** apis/predict/temporal_causal.mjs
- **Размер:** 14446 B, 343 строк
- **Экспорты:** export const meta = { | export class TemporalLagNetwork { | export class VulnerabilityWindowModel { | export function crucixTemporalCausalAnalysis(history, stateFile = null) {
- **О чём:** Слой 1: Temporal Causal Discovery — моделирование задержек между причиной и следствием. Ключевая идея:

#### timeseries.mjs

- **Путь:** apis/predict/timeseries.mjs
- **Размер:** 13237 B, 386 строк
- **Экспорты:** export {
- **О чём:** Прогнозирование временных рядов: ETS (экспоненциальное сглаживание) + AR(p). Теоретическая основа:

#### ws_v4_patch.mjs

- **Путь:** apis/predict/ws_v4_patch.mjs
- **Размер:** 2187 B, 53 строк
- **Экспорты:** export const WS_V4_PATCH = `
- **О чём:** Патч для ws.mjs — добавление v4 endpoints В ws.mjs добавьте импорт:

#### ws.mjs

- **Путь:** apis/predict/ws.mjs
- **Размер:** 10494 B, 349 строк
- **Экспорты:** export {
- **О чём:** WebSocket-сервер прогностического слоя Crucix. Назначение:


### apis/predict/agent (6)

#### agent_core.mjs

- **Путь:** apis/predict/agent/agent_core.mjs
- **Размер:** 19543 B, 520 строк
- **Экспорты:** export {
- **О чём:** Agent Core — LLM-планировщик над детерминированным ядром Crucix. Архитектурная позиция:

#### executor.mjs

- **Путь:** apis/predict/agent/executor.mjs
- **Размер:** 15111 B, 466 строк
- **Экспорты:** export async function executePlan(plan, registry, options = {}) { | export {
- **О чём:** Executor — безопасное выполнение плана tool-вызовов. Назначение:

#### narrator.mjs

- **Путь:** apis/predict/agent/narrator.mjs
- **Размер:** 19421 B, 473 строк
- **Экспорты:** export {
- **О чём:** Narrator — формирование ответа оператору на естественном языке. Назначение:

#### planner.mjs

- **Путь:** apis/predict/agent/planner.mjs
- **Размер:** 13376 B, 365 строк
- **Экспорты:** export async function planQuery(query, options = {}) { | export async function executeQuery(query, options = {}) { | export async function runAgentPipeline(query, options = {}) { | export { Planner };
- **О чём:** Planner — высокоуровневый API планирования запроса оператора. Назначение:

#### server.mjs

- **Путь:** apis/predict/agent/server.mjs
- **Размер:** 18350 B, 557 строк
- **Экспорты:** export { AgentServer };
- **О чём:** HTTP + WebSocket сервер для AI Agent Crucix. Назначение:

#### tool_registry.mjs

- **Путь:** apis/predict/agent/tool_registry.mjs
- **Размер:** 20937 B, 549 строк
- **Экспорты:** export {
- **О чём:** Tool Registry — единый реестр всех доступных модулей для LLM-агента. Назначение:


### apis/predict/core (3)

#### linear_algebra.mjs

- **Путь:** apis/predict/core/linear_algebra.mjs
- **Размер:** 6432 B, 21 строк
- **Экспорты:** export { zeros, identity, clone, matmul, transpose, lu, solve, inverse, det, cholesky, qr, svd, jacobiEigen, pinv, lstsq, conditionNumber };
- **О чём:** Математическое ядро: линейная алгебра на чистом JS

#### optim.mjs

- **Путь:** apis/predict/core/optim.mjs
- **Размер:** 8390 B, 15 строк
- **Экспорты:** export { gradientDescent, adam, rmsprop, nelderMead, lbfgs, differentialEvolution, simulatedAnnealing, gridSearch, randomSearch, dot };
- **О чём:** Численная оптимизация на чистом JS

#### stats.mjs

- **Путь:** apis/predict/core/stats.mjs
- **Размер:** 10543 B, 46 строк
- **Экспорты:** export { logGamma, gamma, beta, logBeta, gammaP, gammaQ, incompleteBeta, erf, erfc, erfInv, normalCDF, normalPDF, normalQuantile, studentTCDF, student
- **О чём:** Статистические распределения и функции на чистом JS


### apis/predict/exotic (7)

#### chaos.mjs

- **Путь:** apis/predict/exotic/chaos.mjs
- **Размер:** 5250 B, 12 строк
- **Экспорты:** export { takensEmbedding, lyapunovExponent, correlationDimension, recurrencePlot, crucixChaos, euclidean };
- **О чём:** Chaos Theory: Lyapunov, correlation dimension, recurrence plots

#### game_theory.mjs

- **Путь:** apis/predict/exotic/game_theory.mjs
- **Размер:** 4242 B, 10 строк
- **Экспорты:** export { findNashEquilibria, mixedNash2x2, evolutionarilyStableStrategy, prisonersDilemmaTournament, crucixGameTheory };
- **О чём:** Game Theory для геополитики

#### infogeo.mjs

- **Путь:** apis/predict/exotic/infogeo.mjs
- **Размер:** 3713 B, 16 строк
- **Экспорты:** export { klDivergence, jsDivergence, renyiDivergence, hellingerDistance, fisherNormal, cramerRaoBound, mutualInformation, entropy, conditionalEntropy,
- **О чём:** Information Geometry: KL, Fisher, Renyi divergences

#### networks.mjs

- **Путь:** apis/predict/exotic/networks.mjs
- **Размер:** 6727 B, 12 строк
- **Экспорты:** export { degrees, betweennessCentrality, eigenvectorCentrality, pageRank, detectCommunities, crucixNetworks };
- **О чём:** Complex Networks: centrality, communities, small-world

#### quantum_sa.mjs

- **Путь:** apis/predict/exotic/quantum_sa.mjs
- **Размер:** 4888 B, 9 строк
- **Экспорты:** export { quantumAnnealing, pathIntegralQMC, quantumHyperparameterSearch, crucixQuantumSearch };
- **О чём:** Quantum-Inspired Simulated Annealing

#### signal_advanced.mjs

- **Путь:** apis/predict/exotic/signal_advanced.mjs
- **Размер:** 4417 B, 11 строк
- **Экспорты:** export { hilbertTransform, emd, phaseLockingValue, crucixSignalAdvanced };
- **О чём:** Advanced Signal Processing: Hilbert, EMD, PLV

#### wasserstein.mjs

- **Путь:** apis/predict/exotic/wasserstein.mjs
- **Размер:** 3995 B, 12 строк
- **Экспорты:** export { wasserstein1D, wassersteinND, wassersteinBarycenter, crucixWasserstein, quantileFromSorted, euclidean };
- **О чём:** Optimal Transport: Wasserstein distance


### apis/predict/federated (2)

#### fl_node.mjs

- **Путь:** apis/predict/federated/fl_node.mjs
- **Размер:** 6096 B, 30 строк
- **Экспорты:** export { FLNode, readBody };
- **О чём:** Federated Learning Node: HTTP-сервер + клиент

#### fl_protocol.mjs

- **Путь:** apis/predict/federated/fl_protocol.mjs
- **Размер:** 5916 B, 16 строк
- **Экспорты:** export { federatedAveraging, addDifferentialPrivacy, addGaussianPrivacy, generateMaskingPair, FederatedClient, FederatedServer, laplaceSample, gaussia
- **О чём:** Federated Learning Protocol: FedAvg + Differential Privacy


### apis/predict/models (23)

#### actor_critic.mjs

- **Путь:** apis/predict/models/actor_critic.mjs
- **Размер:** 37339 B, 1121 строк
- **Экспорты:** export function crucixActorCritic(history, options = {}) { | export {
- **О чём:** Advantage Actor-Critic (A2C) with Generalized Advantage Estimation (GAE) Теоретическая основа:

#### anomaly_detection.mjs

- **Путь:** apis/predict/models/anomaly_detection.mjs
- **Размер:** 29341 B, 931 строк
- **Экспорты:** export function crucixAnomalyDetection(history, options = {}) { | export {
- **О чём:** Anomaly Detection для прогностического слоя Crucix Пять методов + ансамбль: Isolation Forest, LOF, Mahalanobis, One-Class SVM, DBSCAN

#### bayesnet.mjs

- **Путь:** apis/predict/models/bayesnet.mjs
- **Размер:** 30840 B, 979 строк
- **Экспорты:** export function crucixBayesNet(latest, history = [], options = {}) { | export {
- **О чём:** Bayesian Networks — Pearl (1988) Probabilistic Reasoning in Intelligent Systems Дискретные байесовские сети: DAG + conditional probability tables.

#### bocpd.mjs

- **Путь:** apis/predict/models/bocpd.mjs
- **Размер:** 8237 B, 260 строк
- **Экспорты:** export { GaussianConjugate, BOCPD, crucixBOCPDAnalysis };
- **О чём:** Bayesian Online Changepoint Detection (BOCPD). Теоретическая основа:

#### contagion.mjs

- **Путь:** apis/predict/models/contagion.mjs
- **Размер:** 7587 B, 243 строк
- **Экспорты:** export { SIRModel, SEIRModel, NetworkContagion, crucixContagionAnalysis };
- **О чём:** SIR/SEIR модели распространения — для нарративов, паники, санкций. Теоретическая основа:

#### copula.mjs

- **Путь:** apis/predict/models/copula.mjs
- **Размер:** 8815 B, 281 строк
- **Экспорты:** export {
- **О чём:** Копулы — моделирование зависимости в хвостах распределений. Теоретическая основа:

#### diffusion.mjs

- **Путь:** apis/predict/models/diffusion.mjs
- **Размер:** 9787 B, 29 строк
- **Экспорты:** export { DDPM, DenoiseNet, linearBetaSchedule, cosineBetaSchedule, timeEmbedding, crucixDiffusion };
- **О чём:** Denoising Diffusion Probabilistic Models (Ho et al., 2020)

#### evt.mjs

- **Путь:** apis/predict/models/evt.mjs
- **Размер:** 7846 B, 264 строк
- **Экспорты:** export { GPD, GEV, extremeEventProbability, crucixEVTAnalysis };
- **О чём:** Extreme Value Theory — моделирование хвостов распределений. Теоретическая основа:

#### graph_neural.mjs

- **Путь:** apis/predict/models/graph_neural.mjs
- **Размер:** 7536 B, 253 строк
- **Экспорты:** export { GCN, crucixGCNAnalysis };
- **О чём:** Graph Convolutional Network — нейросеть на графе событий. Теоретическая основа:

#### graph_sage.mjs

- **Путь:** apis/predict/models/graph_sage.mjs
- **Размер:** 29629 B, 877 строк
- **Экспорты:** export function crucixGraphSAGE(history, options = {}) { | export {
- **О чём:** GraphSAGE — Inductive Representation Learning on Large Graphs Hamilton, Ying, Leskovec (NeurIPS 2017)

#### hawkes.mjs

- **Путь:** apis/predict/models/hawkes.mjs
- **Размер:** 6974 B, 210 строк
- **Экспорты:** export { HawkesProcess, sweepToHawkesEvents };
- **О чём:** Процесс Хоукса (Hawkes process) — самовозбуждающийся точечный процесс. Теоретическая основа:

#### hmm.mjs

- **Путь:** apis/predict/models/hmm.mjs
- **Размер:** 11412 B, 364 строк
- **Экспорты:** export { HMM, createCrucixHMM, sweepToObservations };
- **О чём:** Hidden Markov Model — скрытые состояния системы по зашумлённым наблюдениям. Теоретическая основа:

#### ising.mjs

- **Путь:** apis/predict/models/ising.mjs
- **Размер:** 7184 B, 217 строк
- **Экспорты:** export { IsingModel, crucixIsingAnalysis };
- **О чём:** Модель Изинга — фазовые переходы в социальных/политических системах. Теоретическая основа:

#### kalman.mjs

- **Путь:** apis/predict/models/kalman.mjs
- **Размер:** 8160 B, 318 строк
- **Экспорты:** export { KalmanFilter, Kalman1D, crucixVixKalman };
- **О чём:** Фильтр Калмана — оптимальная линейная оценка состояния по зашумлённым измерениям.

#### mcmc.mjs

- **Путь:** apis/predict/models/mcmc.mjs
- **Размер:** 47500 B, 1397 строк
- **Экспорты:** export { | export function crucixMCMC(history, options = {}) {
- **О чём:** Markov Chain Monte Carlo (MCMC) + Hierarchical Bayes Полная реализация для прогностического слоя Crucix

#### neural.mjs

- **Путь:** apis/predict/models/neural.mjs
- **Размер:** 8165 B, 275 строк
- **Экспорты:** export { MLP, crucixMLPAnalysis };
- **О чём:** MLP с обратным распространением ошибки — на чистом JS. Теоретическая основа:

#### ornstein.mjs

- **Путь:** apis/predict/models/ornstein.mjs
- **Размер:** 6296 B, 215 строк
- **Экспорты:** export { OrnsteinUhlenbeck, crucixOUAnalysis, normalCDF, erf };
- **О чём:** Ornstein-Uhlenbeck процесс — mean-reverting диффузия. Теоретическая основа:

#### particle.mjs

- **Путь:** apis/predict/models/particle.mjs
- **Размер:** 8391 B, 276 строк
- **Экспорты:** export { ParticleFilter, crucixParticleAnalysis };
- **О чём:** Particle Filter (Sequential Monte Carlo) — фильтрация нелинейных негауссовских систем.

#### physics_inspired.mjs

- **Путь:** apis/predict/models/physics_inspired.mjs
- **Размер:** 38476 B, 1165 строк
- **Экспорты:** export { | export function crucixPhysicsInspired(history, options = {}) {
- **О чём:** Physics-Inspired Models для прогностического слоя Crucix Четыре раздела: SOC, Percolation, Catastrophe Theory, Chaos

#### reinforcement.mjs

- **Путь:** apis/predict/models/reinforcement.mjs
- **Размер:** 21795 B, 726 строк
- **Экспорты:** export {
- **О чём:** Reinforcement Learning для прогностического слоя Crucix. Теоретическая основа:

#### transferentropy.mjs

- **Путь:** apis/predict/models/transferentropy.mjs
- **Размер:** 7402 B, 237 строк
- **Экспорты:** export {
- **О чём:** Transfer Entropy — направленный поток информации между временными рядами. Теоретическая основа:

#### transformer.mjs

- **Путь:** apis/predict/models/transformer.mjs
- **Размер:** 20392 B, 54 строк
- **Экспорты:** export { Transformer, TransformerBlock, MultiHeadAttention, LayerNorm, FeedForward, positionalEncoding, crucixTransformer };
- **О чём:** Transformer с полным backprop (Vaswani et al., 2017)

#### vae.mjs

- **Путь:** apis/predict/models/vae.mjs
- **Размер:** 13094 B, 34 строк
- **Экспорты:** export { VAE, DenseLayer, crucixVAE, clusterLatentSpace };
- **О чём:** Variational Autoencoder (Kingma & Welling, 2013)


### apis/predict/v6 (5)

#### causal_rl.mjs

- **Путь:** apis/predict/v6/causal_rl.mjs
- **Размер:** 22130 B, 637 строк
- **Экспорты:** export function crucixCausalRL(history, options = {}) { | export { CausalEnvironment, CausalQLearner, CausalPolicyGradient, buildCausalEnvFromHistory };
- **О чём:** Causal Reinforcement Learning RL с причинными constraints: агент уважает DAG причинности

#### continual_learning.mjs

- **Путь:** apis/predict/v6/continual_learning.mjs
- **Размер:** 23392 B, 652 строк
- **Экспорты:** export function crucixContinualLearning(history, options = {}) { | export { EWCLearner, SynapticIntelligence };
- **О чём:** Continual Learning — адаптация моделей без catastrophic forgetting Методы: EWC (Elastic Weight Consolidation), Synaptic Intelligence

#### neural_causal_discovery.mjs

- **Путь:** apis/predict/v6/neural_causal_discovery.mjs
- **Размер:** 11604 B, 345 строк
- **Экспорты:** export function crucixNeuralCausalDiscovery(history, options = {}) { | export { NeuralCausalDiscovery, MultiHeadAttention };
- **О чём:** Neural Causal Discovery — transformer для автоматического discovery DAG NO TEARS acyclicity constraint (Zheng et al., 2018)

#### quantum_hypergraph.mjs

- **Путь:** apis/predict/v6/quantum_hypergraph.mjs
- **Размер:** 17393 B, 493 строк
- **Экспорты:** export function crucixQuantumHypergraph(history, options = {}) { | export { QUBOFormulation, QuantumAnnealer, HypergraphMAP };
- **О чём:** Quantum-Inspired Hypergraph Sampling MAP-оценка структуры гиперграфа через квантовый отжиг (QUBO/Ising)

#### zk_federated.mjs

- **Путь:** apis/predict/v6/zk_federated.mjs
- **Размер:** 23280 B, 599 строк
- **Экспорты:** export function crucixZKFederated(history, options = {}) { | export { ZKSchnorrProver, DPMechanism, FederatedNode, SecureAggregator };
- **О чём:** Zero-Knowledge Federated Learning for Crucix Приватный федеративный обмен прогностическими моделями между узлами без раскрытия локальных данных.


### apis/predict/v7 (5)

#### continuous_causal.mjs

- **Путь:** apis/predict/v7/continuous_causal.mjs
- **Размер:** 25844 B, 804 строк
- **Экспорты:** export function crucixContinuousCausal(history, options = {}) { | export {
- **О чём:** Continuous-Time Causal Model Neural ODE + Structural Causal Model (SCM) с do-operator

#### dreamer.mjs

- **Путь:** apis/predict/v7/dreamer.mjs
- **Размер:** 28183 B, 858 строк
- **Экспорты:** export function crucixDreamer(history, options = {}) { | export { Dreamer, Actor, Critic, computeReward };
- **О чём:** Dreamer — actor-critic обучение в latent space через imagination Теоретическая основа:

#### neural_ode.mjs

- **Путь:** apis/predict/v7/neural_ode.mjs
- **Размер:** 25244 B, 730 строк
- **Экспорты:** export function crucixNeuralODE(history, options = {}) { | export {
- **О чём:** Neural ODE — непрерывная динамика вместо дискретных sweep'ов Теоретическая основа:

#### simulation_engine.mjs

- **Путь:** apis/predict/v7/simulation_engine.mjs
- **Размер:** 21218 B, 524 строк
- **Экспорты:** export async function crucixSimulationEngine(history, options = {}) { | export {
- **О чём:** Simulation Engine v7.0 — оркестратор непрерывного мира Назначение:

#### world_model.mjs

- **Путь:** apis/predict/v7/world_model.mjs
- **Размер:** 36562 B, 1185 строк
- **Экспорты:** export function crucixWorldModel(history, options = {}) { | export { WorldModel, VAE, MDNRNN, Controller };
- **О чём:** World Models (Ha & Schmidhuber, 2018) + DreamerV3 упрощённый Теоретическая основа:


### apis/predict/wasm (1)

#### simd_loader.mjs

- **Путь:** apis/predict/wasm/simd_loader.mjs
- **Размер:** 7668 B, 257 строк
- **Экспорты:** export async function initSIMD() { | export function dotProduct(a, b) { | export function matrixMultiply(A, B) { | export function l2Norm(x) { | export function relu(x) {
- **О чём:** Загрузчик SIMD-WASM с многоуровневым fallback: 1. SIMD WASM (быстрее всего, 3-4x над скалярным) 2. Скалярный WASM (5-10x над JS)


### apis/predict/webgl (3)

#### example_gpu.mjs

- **Путь:** apis/predict/webgl/example_gpu.mjs
- **Размер:** 2136 B, 52 строк
- **Экспорты:** export { main };
- **О чём:** Пример использования GPU-ускорения

#### gpu.mjs

- **Путь:** apis/predict/webgl/gpu.mjs
- **Размер:** 11155 B, 365 строк
- **Экспорты:** export async function initGPU() { | export function gpuMatmul(A, B) { | export function gpuElementwise(A, B, op = 'add') { | export function gpuActivation(X, type = 'relu') { | export function gpuStatus() {
- **О чём:** GPU-вычисления через WebGL / headless-gl

#### shaders.mjs

- **Путь:** apis/predict/webgl/shaders.mjs
- **Размер:** 4827 B, 223 строк
- **Экспорты:** export const VERTEX_SHADER = ` | export const MATMUL_FRAGMENT = ` | export const ELEMENTWISE_FRAGMENT = ` | export const ACTIVATION_FRAGMENT = ` | export const SOFTMAX_FRAGMENT = `
- **О чём:** GLSL шейдеры для GPU-вычислений Работают в браузере (WebGL) и в Node.js (headless-gl)


### apis/predict/workers (4)

#### crucix_worker.mjs

- **Путь:** apis/predict/workers/crucix_worker.mjs
- **Размер:** 3579 B, 112 строк
- **О чём:** Worker для запуска тяжёлых Crucix-модулей параллельно (AutoML, GNN, Diffusion, Transformer training)

#### example_parallel.mjs

- **Путь:** apis/predict/workers/example_parallel.mjs
- **Размер:** 4197 B, 91 строк
- **О чём:** Пример: параллельный Monte Carlo + параллельное обучение моделей

#### montecarlo_worker.mjs

- **Путь:** apis/predict/workers/montecarlo_worker.mjs
- **Размер:** 3311 B, 117 строк
- **О чём:** Web Worker для параллельного Monte Carlo и матричных операций

#### pool.mjs

- **Путь:** apis/predict/workers/pool.mjs
- **Размер:** 6438 B, 228 строк
- **Экспорты:** export function getWorkerPool(options = {}) { | export function resetWorkerPool() { | export { WorkerPool, N_CPUS, DEFAULT_POOL_SIZE }; | export async function parallelMonteCarlo(config, totalIterations = 10000) { | export async function parallelMatrixMultiply(matrices) {
- **О чём:** Пул Web Workers для параллельных вычислений Использует worker_threads из Node.js, чтобы задействовать все ядра.


### apis/sources (3)

#### multilang.mjs

- **Путь:** apis/sources/multilang.mjs
- **Размер:** 17303 B, 399 строк
- **Экспорты:** export {
- **О чём:** Многоязычный NLP-конвейер: перевод, нормализация, культурно-специфический sentiment, детекция языковых аномалий.

#### prediction_markets.mjs

- **Путь:** apis/sources/prediction_markets.mjs
- **Размер:** 12578 B, 372 строк
- **Экспорты:** export async function fetchPolymarket(query = null) { | export async function fetchMetaculus(query = null) { | export async function fetchKalshi(query = null) { | export async function fetchManifold(query = null) { | export function crossPlatformAnalysis(allMarkets) {
- **О чём:** Интеграция рынков предсказаний: Polymarket, Metaculus, Kalshi, Manifold Cross-platform арбитраж-анализ + взвешивание с Crucix-прогнозами

#### satellite.mjs

- **Путь:** apis/sources/satellite.mjs
- **Размер:** 15304 B, 432 строк
- **Экспорты:** export async function fetchSatelliteData() { | export async function fetchCopernicusImage(aoiId, satellite = 'sentinel2', dateRange = {}) { | export async function fetchSentinel1SAR(aoiId, dateRange = {}) { | export {
- **О чём:** Спутниковая аналитика для Crucix: Sentinel-2, Landsat 8/9, Sentinel-1 SAR Change detection + YOLOv8-детекция + Radar Interference Tracker 28-й источник данных Crucix


### apis/knowledge (1)

#### graph.mjs

- **Путь:** apis/knowledge/graph.mjs
- **Размер:** 12921 B, 384 строк
- **Экспорты:** export {
- **О чём:** Граф знаний Crucix (knowledge graph). Синтез из knowledge/graph.mjs и entity_model/graph.mjs. Теоретическая основа:


### dashboard (10)

#### advanced.html

- **Путь:** dashboard/advanced.html
- **Размер:** 8449 B, 172 строк
- **О чём:** <!DOCTYPE html> <html lang="ru"> <head>

#### agent.html

- **Путь:** dashboard/agent.html
- **Размер:** 22205 B, 716 строк
- **О чём:** <!DOCTYPE html> <html lang="ru"> <head>

#### attention.html

- **Путь:** dashboard/attention.html
- **Размер:** 17152 B, 577 строк
- **О чём:** <!DOCTYPE html> <html lang="ru"> <head>

#### cockpit.html

- **Путь:** dashboard/cockpit.html
- **Размер:** 48589 B, 1547 строк
- **О чём:** <!DOCTYPE html> <html lang="ru"> <head>

#### coevolution.html

- **Путь:** dashboard/coevolution.html
- **Размер:** 13954 B, 527 строк
- **О чём:** <!DOCTYPE html> <html lang="ru"> <head>

#### crucix.html

- **Путь:** dashboard/crucix.html
- **Размер:** 22450 B, 456 строк
- **О чём:** <!DOCTYPE html> <html lang="ru"> <head>

#### hypergraph.html

- **Путь:** dashboard/hypergraph.html
- **Размер:** 17092 B, 630 строк
- **О чём:** <!DOCTYPE html> <html lang="ru"> <head>

#### plugins.html

- **Путь:** dashboard/plugins.html
- **Размер:** 18620 B, 618 строк
- **О чём:** <!DOCTYPE html> <html lang="ru"> <head>

#### predictions_composite.html

- **Путь:** dashboard/predictions_composite.html
- **Размер:** 6878 B, 142 строк
- **О чём:** <!DOCTYPE html> <html lang="ru"> <head>

#### realtime.html

- **Путь:** dashboard/realtime.html
- **Размер:** 5724 B, 105 строк
- **О чём:** <!DOCTYPE html> <html lang="ru"> <head>


### dashboard/pwa (6)

#### install.js

- **Путь:** dashboard/pwa/install.js
- **Размер:** 8209 B, 270 строк
- **Экспорты:** export { PWAManager };
- **О чём:** Логика установки PWA + регистрация SW + push subscriptions

#### manifest.json

- **Путь:** dashboard/pwa/manifest.json
- **Размер:** 2076 B, 87 строк
- **О чём:** { "name": "Crucix Dashboard — Predictive Intelligence", "short_name": "Crucix",

#### offline.html

- **Путь:** dashboard/pwa/offline.html
- **Размер:** 5098 B, 204 строк
- **О чём:** <!DOCTYPE html> <html lang="ru"> <head>

#### push.js

- **Путь:** dashboard/pwa/push.js
- **Размер:** 9468 B, 339 строк
- **Экспорты:** export function generateVAPIDKeys() { | export function loadOrCreateVAPIDKeys() { | export class SubscriptionStore { | export async function sendWebPush(subscription, payload, vapidKeys, options = {}) { | export async function broadcastPush(payload, vapidKeys, store, options = {}) {
- **О чём:** Server-side: отправка push-уведомлений через Web Push Protocol Реализовано на чистом Node.js с использованием криптографии

#### README.md

- **Путь:** dashboard/pwa/README.md
- **Размер:** 5284 B, 156 строк
- **О чём:** # Crucix PWA Progressive Web App — установка Crucix на устройство с offline-режимом и push-уведомлениями. ## Возможности

#### service-worker.js

- **Путь:** dashboard/pwa/service-worker.js
- **Размер:** 3382 B, 141 строк
- **О чём:** self.addEventListener('push', (event) => { console.log('[SW] Push received');


### features/human-feedback (4)

#### engine_integration.md

- **Путь:** features/human-feedback/engine_integration.md
- **Размер:** 14405 B, 302 строк
- **О чём:** # План встраивания Human Feedback в engine.mjs **Статус: план. Патч пока не применён.** Этот документ — инструкция для того момента, когда будет решено подключить `human_feedback.mjs` к основному конвейеру Crucix.

#### human_feedback.dashboard.html

- **Путь:** features/human-feedback/human_feedback.dashboard.html
- **Размер:** 23160 B, 533 строк
- **О чём:** <!DOCTYPE html> <html lang="ru"> <head>

#### human_feedback.mjs

- **Путь:** features/human-feedback/human_feedback.mjs
- **Размер:** 21239 B, 521 строк
- **Экспорты:** export class HumanFeedbackLearner { | export function crucixHumanFeedback(latest, predictions, options = {}) { | export default HumanFeedbackLearner;
- **О чём:** Human Feedback Learning для Crucix

#### README.md

- **Путь:** features/human-feedback/README.md
- **Размер:** 13592 B, 168 строк
- **О чём:** # Human Feedback Learning — замысел модуля **Статус: спроектирован, не написан.** Папка-памятник замысла. Здесь всё, что нужно, чтобы через месяц вернуться и продолжить с того же места — без потери контекста, без переизобретения.


### integrations (7)

#### email.mjs

- **Путь:** integrations/email.mjs
- **Размер:** 14798 B, 427 строк
- **Экспорты:** export async function sendEmailAlert(result, config) { | export const EMAIL_INFO = { | export { SMTPClient, buildPredictionEmail };
- **О чём:** Email-интеграция: SMTP на чистом Node.js, без внешних зависимостей. Применение в Crucix:

#### notion.mjs

- **Путь:** integrations/notion.mjs
- **Размер:** 4702 B, 171 строк
- **Экспорты:** export class NotionClient { | export async function savePredictionToNotion(result, config) { | export const NOTION_INFO = {
- **О чём:** Notion API клиент — сохранение прогнозов в базы данных Возможности:

#### obsidian.mjs

- **Путь:** integrations/obsidian.mjs
- **Размер:** 11636 B, 372 строк
- **Экспорты:** export async function saveToObsidian(result, config) { | export const OBSIDIAN_INFO = { | export { ObsidianVault };
- **О чём:** Obsidian интеграция - запись прогнозов в markdown vault.

#### README.md

- **Путь:** integrations/README.md
- **Размер:** 5098 B, 140 строк
- **Экспорты:** export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ | export SMTP_HOST=smtp.gmail.com | export SMTP_PORT=587 | export SMTP_USER=your@email.com | export SMTP_PASSWORD=app-password
- **О чём:** # Crucix Integrations Единая система интеграций с внешними сервисами. Всё — без внешних зависимостей, только fetch и node:net. ## Поддерживаемые сервисы

#### rss.mjs

- **Путь:** integrations/rss.mjs
- **Размер:** 9594 B, 270 строк
- **Экспорты:** export { FeedGenerator, feedHandler, RSS_INFO };
- **О чём:** RSS/Atom feed generator для Crucix. Три формата: Atom 1.0, RSS 2.0, JSON Feed 1.1. Zero dependencies: только node:fs, node:path.

#### slack.mjs

- **Путь:** integrations/slack.mjs
- **Размер:** 6474 B, 227 строк
- **Экспорты:** export class SlackClient { | export async function notifySlack(result, config) { | export const SLACK_INFO = {
- **О чём:** Slack интеграция: webhook + bot API + rich embeds Два режима:

#### webhook_manager.mjs

- **Путь:** integrations/webhook_manager.mjs
- **Размер:** 10238 B, 327 строк
- **Экспорты:** export const INTEGRATION_REGISTRY = { | export function getIntegrationManager(config) { | export async function dispatchToIntegrations(result, config = {}) { | export const INTEGRATION_INFO = { | export { IntegrationManager };
- **О чём:** Менеджер всех интеграций - реестр, retry, приоритеты. Назначение:


### plugins (7)

#### hooks.mjs

- **Путь:** plugins/hooks.mjs
- **Размер:** 7616 B, 266 строк
- **Экспорты:** export const HOOKS = { | export class HookManager { | export function getHookManager(config) { | export function _resetHookManager() { | export const HOOKS_INFO = {
- **О чём:** Lifecycle hooks для плагинов Crucix. Назначение:

#### loader.mjs

- **Путь:** plugins/loader.mjs
- **Размер:** 10128 B, 328 строк
- **Экспорты:** export class PluginLoader { | export function getPluginLoader(options) { | export function _resetPluginLoader() { | export const LOADER_INFO = { | export { CRUCIX_VERSION };
- **О чём:** Динамическая загрузка и управление плагинами Crucix. Назначение:

#### manifest_schema.mjs

- **Путь:** plugins/manifest_schema.mjs
- **Размер:** 12173 B, 367 строк
- **Экспорты:** export function validateManifest(manifest) { | export function checkVersionCompatibility(requiredVersion, actualVersion = '3.0.0') { | export function validateAgainstSchema(data, schema, _seen = new Set()) { | export function getSchema() { | export const SCHEMA_INFO = {
- **О чём:** Схема и валидация manifest.json для плагинов Crucix. Ожидаемая схема манифеста:

#### README.md

- **Путь:** plugins/README.md
- **Размер:** 10553 B, 263 строк
- **Экспорты:** export async function init(config) { | export async function afterPrediction(result) { | export async function onShutdown() {
- **О чём:** # Crucix Plugins Система расширений для Crucix. Плагины могут добавлять: - **Signals** — новые сигналы в композитный индикатор

#### registry.mjs

- **Путь:** plugins/registry.mjs
- **Размер:** 8798 B, 287 строк
- **Экспорты:** export class PluginRegistry { | export const FEATURED_PLUGINS = [ | export function getPluginRegistry(options) { | export function _resetPluginRegistry() { | export const REGISTRY_INFO = {
- **О чём:** Реестр плагинов Crucix: discovery, versioning, dependency resolution. Назначение:

#### sandbox_worker.mjs

- **Путь:** plugins/sandbox_worker.mjs
- **Размер:** 5579 B, 188 строк
- **О чём:** Worker для выполнения кода плагина в изоляции. Назначение:

#### sandbox.mjs

- **Путь:** plugins/sandbox.mjs
- **Размер:** 8735 B, 302 строк
- **Экспорты:** export class PluginSandbox { | export class SandboxManager { | export function getSandboxManager(options) { | export function _resetSandboxManager() { | export const SANDBOX_INFO = {
- **О чём:** Sandbox для плагинов Crucix - изоляция исполнения с resource limits. Назначение:


### observability (3)

#### instrumentation.mjs

- **Путь:** observability/instrumentation.mjs
- **Размер:** 5124 B, 193 строк
- **Экспорты:** export function setupObservability(opts = {}) { | export function getMetrics() { | export function instrumentModule(name, fn) { | export async function tracePredictionCycle(fn) { | export function httpMiddleware() {
- **О чём:** Автоматическая инструментация ключевых модулей Crucix

#### otel.mjs

- **Путь:** observability/otel.mjs
- **Размер:** 13553 B, 505 строк
- **Экспорты:** export function initObservability({ | export function getTracer() { | export function getMeter() { | export function getLogger() { | export function registerCrucixMetrics(meter) {
- **О чём:** OpenTelemetry-совместимый трейсинг и метрики (pure JS, без зависимостей) Реализует:

#### README.md

- **Путь:** observability/README.md
- **Размер:** 3610 B, 124 строк
- **Экспорты:** export OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
- **О чём:** # Crucix Observability Production-grade monitoring для Crucix Monitor. Zero external dependencies — работает на чистом Node.js. ## Что внутри


### observability/alerts (1)

#### prometheus.yml

- **Путь:** observability/alerts/prometheus.yml
- **Размер:** 3742 B, 129 строк
- **О чём:** groups: - name: crucix.availability interval: 30s


### observability/dashboards/grafana (1)

#### crucix-overview.json

- **Путь:** observability/dashboards/grafana/crucix-overview.json
- **Размер:** 5064 B, 196 строк
- **О чём:** { "annotations": { "list": [] }, "editable": true,


### scripts (10)

#### apply_v6_patch.mjs

- **Путь:** scripts/apply_v6_patch.mjs
- **Размер:** 6187 B, 119 строк
- **О чём:** Патч engine.mjs для подключения фаз S (v6.0) и T (каталог). Делает три вещи:

#### apply_v7_patch.mjs

- **Путь:** scripts/apply_v7_patch.mjs
- **Размер:** 5976 B, 118 строк
- **О чём:** Патч engine.mjs для подключения фазы U (v7.0 Simulation Engine). Делает:

#### build-book-parts.mjs

- **Путь:** scripts/build-book-parts.mjs
- **Размер:** 17181 B, 454 строк
- **О чём:** #!/usr/bin/env node Собирает все файлы проекта в 6 текстовых томов для чтения AI. Каждый файл оборачивается в маркер ==== FILE: path ====.

#### compile-wasm-simd.sh

- **Путь:** scripts/compile-wasm-simd.sh
- **Размер:** 2644 B, 63 строк
- **О чём:** #!/usr/bin/env bash # Компиляция SIMD WASM-модуля # Требует wabt с поддержкой SIMD

#### fix-duplicates.mjs

- **Путь:** scripts/fix-duplicates.mjs
- **Размер:** 9153 B, 253 строк
- **Экспорты:** export {
- **О чём:** #!/usr/bin/env node fix-duplicates.mjs — единый скрипт чистки дублей Crucix. Синтез из fix-duplicates.mjs и fix-role-duplication.mjs.

#### neo4j_export.py

- **Путь:** scripts/neo4j_export.py
- **Размер:** 19246 B, 435 строк
- **О чём:** # scripts/neo4j_export.py # Экспорт Multi-Layer Causal Graph в Neo4j для визуализации #

#### neo4j_requirements.txt

- **Путь:** scripts/neo4j_requirements.txt
- **Размер:** 14 B, 2 строк
- **О чём:** neo4j>=5.14.0

#### README_neo4j.md

- **Путь:** scripts/README_neo4j.md
- **Размер:** 3200 B, 131 строк
- **О чём:** # Crucix -> Neo4j Export Экспорт Multi-Layer Causal Graph в Neo4j для визуализации. ## Установка

#### rename-crucix.mjs

- **Путь:** scripts/rename-crucix.mjs
- **Размер:** 7190 B, 208 строк
- **О чём:** #!/usr/bin/env node rename-crucix.mjs Уничтожение слова crucix в песочнице /home/ta8/Документы.

#### split-book-parts.mjs

- **Путь:** scripts/split-book-parts.mjs
- **Размер:** 4433 B, 113 строк
- **О чём:** #!/usr/bin/env node Нарезает каждый том из docs/book-parts/part-N-*.txt на куски по ~40 KB, НЕ разрезая отдельные файлы внутри тома (границы — по маркеру FILE:).


### tests (1)

#### test_all_modules.mjs

- **Путь:** tests/test_all_modules.mjs
- **Размер:** 20826 B, 460 строк
- **О чём:** tests/test_all_modules.mjs Тестовый скрипт: прогоняет 22 модуля на синтетических данных Запуск: node tests/test_all_modules.mjs


### tests/chaos (2)

#### chaos_runner.mjs

- **Путь:** tests/chaos/chaos_runner.mjs
- **Размер:** 8308 B, 299 строк
- **Экспорты:** export { ChaosRunner, runChaosSuite };
- **О чём:** tests/chaos/chaos_runner.mjs Основной runner для chaos-экспериментов Запускает сценарии, измеряет метрики, генерирует отчёт

#### fault_injection.mjs

- **Путь:** tests/chaos/fault_injection.mjs
- **Размер:** 10121 B, 380 строк
- **Экспорты:** export {
- **О чём:** tests/chaos/fault_injection.mjs Инъекция сбоев в Crucix модули


### tests/fuzz (5)

#### adversarial_coevolution.fuzz.mjs

- **Путь:** tests/fuzz/adversarial_coevolution.fuzz.mjs
- **Размер:** 2866 B, 87 строк
- **О чём:** tests/fuzz/adversarial_coevolution.fuzz.mjs

#### attention_dynamics.fuzz.mjs

- **Путь:** tests/fuzz/attention_dynamics.fuzz.mjs
- **Размер:** 2738 B, 77 строк
- **О чём:** tests/fuzz/attention_dynamics.fuzz.mjs

#### hypergraph_contagion.fuzz.mjs

- **Путь:** tests/fuzz/hypergraph_contagion.fuzz.mjs
- **Размер:** 2692 B, 73 строк
- **О чём:** tests/fuzz/hypergraph_contagion.fuzz.mjs

#### scenario_generator.fuzz.mjs

- **Путь:** tests/fuzz/scenario_generator.fuzz.mjs
- **Размер:** 4281 B, 111 строк
- **О чём:** tests/fuzz/scenario_generator.fuzz.mjs Fuzz-тесты для ScenarioGenerator Цель: найти входные данные, которые ломают парсер или логику

#### temporal_causal.fuzz.mjs

- **Путь:** tests/fuzz/temporal_causal.fuzz.mjs
- **Размер:** 2926 B, 78 строк
- **О чём:** tests/fuzz/temporal_causal.fuzz.mjs Fuzz-тесты для TemporalLagNetwork


### tests/integration (2)

#### full_pipeline_v6_v7.test.mjs

- **Путь:** tests/integration/full_pipeline_v6_v7.test.mjs
- **Размер:** 8075 B, 248 строк
- **О чём:** tests/integration/full_pipeline_v6_v7.test.mjs

#### full_pipeline.test.mjs

- **Путь:** tests/integration/full_pipeline.test.mjs
- **Размер:** 22628 B, 622 строк
- **О чём:** tests/integration/full_pipeline.test.mjs Интеграционный тест полного прогностического конвейера Crucix v3.0


### tests/mutation (7)

#### attention.mutate.mjs

- **Путь:** tests/mutation/attention.mutate.mjs
- **Размер:** 12498 B, 333 строк
- **Экспорты:** export { runMutationTests };
- **О чём:** tests/mutation/attention.mutate.mjs Mutation testing для Attention Dynamics.

#### coevolution.mutate.mjs

- **Путь:** tests/mutation/coevolution.mutate.mjs
- **Размер:** 10774 B, 299 строк
- **Экспорты:** export { runMutationTests };
- **О чём:** tests/mutation/coevolution.mutate.mjs Mutation testing для Adversarial Co-evolution.

#### hypergraph.mutate.mjs

- **Путь:** tests/mutation/hypergraph.mutate.mjs
- **Размер:** 15194 B, 410 строк
- **Экспорты:** export { runMutationTests };
- **О чём:** tests/mutation/hypergraph.mutate.mjs Mutation testing для Hypergraph Contagion.

#### meta_learner.mutate.mjs

- **Путь:** tests/mutation/meta_learner.mutate.mjs
- **Размер:** 17384 B, 536 строк
- **Экспорты:** export { runMutationTests, MutationTester, MUTATIONS };
- **О чём:** tests/mutation/meta_learner.mutate.mjs Mutation testing для MetaLearner из apis/predict/meta_ensemble.mjs

#### README.md

- **Путь:** tests/mutation/README.md
- **Размер:** 3704 B, 105 строк
- **О чём:** # Mutation Testing для Crucix Mutation testing проверяет **качество самих тестов**, внося мутации в код и проверяя, что тесты их ловят.

#### run_all.mjs

- **Путь:** tests/mutation/run_all.mjs
- **Размер:** 15084 B, 471 строк
- **Экспорты:** export { runAll, SUITES, THRESHOLD };
- **О чём:** tests/mutation/run_all.mjs Оркестратор мутационного тестирования Crucix.

#### run_all.original.mjs

- **Путь:** tests/mutation/run_all.original.mjs
- **Размер:** 3633 B, 89 строк
- **Экспорты:** export { runAll };
- **О чём:** tests/mutation/run_all.original.mjs ОРИГИНАЛЬНАЯ версия оркестратора мутационных тестов из 6части.txt


### tests/predict (9)

#### adversarial_coevolution.test.mjs

- **Путь:** tests/predict/adversarial_coevolution.test.mjs
- **Размер:** 5151 B, 135 строк
- **О чём:** tests/predict/adversarial_coevolution.test.mjs

#### attention_dynamics.test.mjs

- **Путь:** tests/predict/attention_dynamics.test.mjs
- **Размер:** 5619 B, 148 строк
- **О чём:** tests/predict/attention_dynamics.test.mjs

#### hypergraph_contagion.test.mjs

- **Путь:** tests/predict/hypergraph_contagion.test.mjs
- **Размер:** 6567 B, 179 строк
- **О чём:** tests/predict/hypergraph_contagion.test.mjs

#### meta_ensemble.test.mjs

- **Путь:** tests/predict/meta_ensemble.test.mjs
- **Размер:** 2951 B, 76 строк
- **О чём:** tests/predict/meta_ensemble.test.mjs

#### multilayer_causal.test.mjs

- **Путь:** tests/predict/multilayer_causal.test.mjs
- **Размер:** 2973 B, 79 строк
- **О чём:** tests/predict/multilayer_causal.test.mjs

#### narrative_warfare.test.mjs

- **Путь:** tests/predict/narrative_warfare.test.mjs
- **Размер:** 4247 B, 93 строк
- **О чём:** tests/predict/narrative_warfare.test.mjs

#### resource_exhaustion.test.mjs

- **Путь:** tests/predict/resource_exhaustion.test.mjs
- **Размер:** 3438 B, 81 строк
- **О чём:** tests/predict/resource_exhaustion.test.mjs

#### scenario_generator.test.mjs

- **Путь:** tests/predict/scenario_generator.test.mjs
- **Размер:** 2067 B, 47 строк
- **О чём:** tests/predict/scenario_generator.test.mjs

#### temporal_causal.test.mjs

- **Путь:** tests/predict/temporal_causal.test.mjs
- **Размер:** 4611 B, 127 строк
- **О чём:** tests/predict/temporal_causal.test.mjs


### tests/property (6)

#### adversarial_coevolution.property.mjs

- **Путь:** tests/property/adversarial_coevolution.property.mjs
- **Размер:** 3358 B, 84 строк
- **О чём:** tests/property/adversarial_coevolution.property.mjs

#### attention_dynamics.property.mjs

- **Путь:** tests/property/attention_dynamics.property.mjs
- **Размер:** 3089 B, 79 строк
- **О чём:** tests/property/attention_dynamics.property.mjs

#### hypergraph_contagion.property.mjs

- **Путь:** tests/property/hypergraph_contagion.property.mjs
- **Размер:** 3585 B, 90 строк
- **О чём:** tests/property/hypergraph_contagion.property.mjs

#### meta_ensemble.property.mjs

- **Путь:** tests/property/meta_ensemble.property.mjs
- **Размер:** 6114 B, 165 строк
- **О чём:** tests/property/meta_ensemble.property.mjs Property-based тесты для MetaLearner Проверяем инварианты, которые должны сохраняться при ЛЮБЫХ входных данных

#### reflexive.property.mjs

- **Путь:** tests/property/reflexive.property.mjs
- **Размер:** 2262 B, 60 строк
- **О чём:** tests/property/reflexive.property.mjs Property-based тесты для рефлексивной коррекции

#### regime_signature.property.mjs

- **Путь:** tests/property/regime_signature.property.mjs
- **Размер:** 2636 B, 63 строк
- **О чём:** tests/property/regime_signature.property.mjs Property-based тесты для extractRegimeSignature


### tests/v6 (2)

#### neural_causal_discovery.test.mjs

- **Путь:** tests/v6/neural_causal_discovery.test.mjs
- **Размер:** 10459 B, 272 строк
- **О чём:** tests/v6/neural_causal_discovery.test.mjs Unit-тесты для apis/predict/v6/neural_causal_discovery.mjs

#### v6_pack.test.mjs

- **Путь:** tests/v6/v6_pack.test.mjs
- **Размер:** 7360 B, 208 строк
- **О чём:** tests/v6/v6_pack.test.mjs


### tests/v7 (1)

#### v7_pack.test.mjs

- **Путь:** tests/v7/v7_pack.test.mjs
- **Размер:** 8357 B, 252 строк
- **О чём:** tests/v7/v7_pack.test.mjs


### tests/load (1)

#### README.md

- **Путь:** tests/load/README.md
- **Размер:** 2322 B, 75 строк
- **О чём:** # Crucix · Нагрузочное тестирование ## k6 ### Установка


### tests/catalog (2)

#### catalog_pack_a.test.mjs

- **Путь:** tests/catalog/catalog_pack_a.test.mjs
- **Размер:** 9267 B, 269 строк
- **О чём:** tests/catalog/catalog_pack_a.test.mjs

#### catalog_pack_b.test.mjs

- **Путь:** tests/catalog/catalog_pack_b.test.mjs
- **Размер:** 4094 B, 105 строк
- **О чём:** tests/catalog/catalog_pack_b.test.mjs


### benchmark (2)

#### report.html

- **Путь:** benchmark/report.html
- **Размер:** 10595 B, 316 строк
- **О чём:** <!DOCTYPE html> <html lang="ru"> <head>

#### suite.mjs

- **Путь:** benchmark/suite.mjs
- **Размер:** 15917 B, 440 строк
- **Экспорты:** export { runBenchmark, rmse, mae, hitRate, brierScore };
- **О чём:** benchmark/suite.mjs Бенчмарк-сюита: Crucix против классических baseline


### docker (3)

#### docker-compose.engine.yml

- **Путь:** docker/docker-compose.engine.yml
- **Размер:** 4650 B, 201 строк
- **О чём:** # Crucix Core · Final docker-compose # Полный production-стек version: '3.9'

#### entrypoint.sh

- **Путь:** docker/entrypoint.sh
- **Размер:** 6183 B, 187 строк
- **О чём:** #!/bin/sh # Crucix Core · Entrypoint # Управляет запуском сервисов: WebSocket, API, FL, Python-bridge

#### healthcheck.sh

- **Путь:** docker/healthcheck.sh
- **Размер:** 880 B, 37 строк
- **О чём:** #!/bin/sh # Crucix Core · Healthcheck set -e


### k8s (11)

#### configmap.yaml

- **Путь:** k8s/configmap.yaml
- **Размер:** 1073 B, 42 строк
- **О чём:** apiVersion: v1 kind: ConfigMap metadata:

#### cronjob.yaml

- **Путь:** k8s/cronjob.yaml
- **Размер:** 2791 B, 107 строк
- **О чём:** apiVersion: batch/v1 kind: CronJob metadata:

#### deployment-crucix.yaml

- **Путь:** k8s/deployment-crucix.yaml
- **Размер:** 4987 B, 199 строк
- **О чём:** apiVersion: apps/v1 kind: Deployment metadata:

#### hpa.yaml

- **Путь:** k8s/hpa.yaml
- **Размер:** 1239 B, 61 строк
- **О чём:** apiVersion: autoscaling/v2 kind: HorizontalPodAutoscaler metadata:

#### ingress.yaml

- **Путь:** k8s/ingress.yaml
- **Размер:** 1347 B, 47 строк
- **О чём:** apiVersion: networking.k8s.io/v1 kind: Ingress metadata:

#### kustomization.yaml

- **Путь:** k8s/kustomization.yaml
- **Размер:** 619 B, 31 строк
- **О чём:** apiVersion: kustomize.config.k8s.io/v1beta1 kind: Kustomization namespace: crucix

#### namespace.yaml

- **Путь:** k8s/namespace.yaml
- **Размер:** 863 B, 45 строк
- **О чём:** apiVersion: v1 kind: Namespace metadata:

#### secrets.yaml

- **Путь:** k8s/secrets.yaml
- **Размер:** 532 B, 26 строк
- **О чём:** apiVersion: v1 kind: Secret metadata:

#### service.yaml

- **Путь:** k8s/service.yaml
- **Размер:** 1133 B, 70 строк
- **О чём:** apiVersion: v1 kind: Service metadata:

#### servicemonitor.yaml

- **Путь:** k8s/servicemonitor.yaml
- **Размер:** 1567 B, 64 строк
- **О чём:** # Требует Prometheus Operator (kube-prometheus-stack) apiVersion: monitoring.coreos.com/v1 kind: ServiceMonitor

#### statefulset-python.yaml

- **Путь:** k8s/statefulset-python.yaml
- **Размер:** 1723 B, 73 строк
- **О чём:** apiVersion: apps/v1 kind: StatefulSet metadata:


### .github (2)

#### dependabot.yml

- **Путь:** .github/dependabot.yml
- **Размер:** 914 B, 46 строк
- **О чём:** version: 2 updates: - package-ecosystem: "npm"

#### PULL_REQUEST_TEMPLATE.md

- **Путь:** .github/PULL_REQUEST_TEMPLATE.md
- **Размер:** 1525 B, 59 строк
- **О чём:** # Pull Request ## Что изменилось <!-- Кратко опишите изменения -->


### .github/workflows (8)

#### ci.yml

- **Путь:** .github/workflows/ci.yml
- **Размер:** 47489 B, 1193 строк
- **О чём:** name: CI # ═══════════════════════════════════════════════════════════════════ #  Crucix CI/CD — полный промышленный pipeline

#### docker.yml

- **Путь:** .github/workflows/docker.yml
- **Размер:** 2620 B, 99 строк
- **О чём:** name: Docker Publish on: push:

#### neo4j-export.yml

- **Путь:** .github/workflows/neo4j-export.yml
- **Размер:** 3162 B, 102 строк
- **О чём:** # .github/workflows/neo4j-export.yml # Ночной экспорт Multi-Layer Causal Graph в Neo4j. # Запускается по расписанию или вручную через workflow_dispatch.

#### nightly-neo4j.yml

- **Путь:** .github/workflows/nightly-neo4j.yml
- **Размер:** 4148 B, 118 строк
- **О чём:** name: Nightly Neo4j Export on: schedule:

#### nightly-property.yml

- **Путь:** .github/workflows/nightly-property.yml
- **Размер:** 2493 B, 80 строк
- **О чём:** name: Nightly Property Tests on: schedule:

#### release.yml

- **Путь:** .github/workflows/release.yml
- **Размер:** 3553 B, 111 строк
- **О чём:** name: Release on: push:

#### security.yml

- **Путь:** .github/workflows/security.yml
- **Размер:** 2077 B, 86 строк
- **О чём:** name: Security on: push:

#### weekly-chaos.yml

- **Путь:** .github/workflows/weekly-chaos.yml
- **Размер:** 1519 B, 46 строк
- **О чём:** name: Weekly Chaos Engineering on: schedule:


### docs/handbook (13)

#### 00-intro.md

- **Путь:** docs/handbook/00-intro.md
- **Размер:** 6180 B, 121 строк
- **О чём:** --- title: "Crucix Handbook" subtitle: "Multidisciplinary Predictive Intelligence"

#### 01-architecture.md

- **Путь:** docs/handbook/01-architecture.md
- **Размер:** 7654 B, 194 строк
- **О чём:** # Глава 1. Архитектура Crucix ## 1.1 Общая картина Crucix — это многослойная система:

#### 02-sciences.md

- **Путь:** docs/handbook/02-sciences.md
- **Размер:** 6080 B, 107 строк
- **О чём:** # Глава 2. Науки. Обзор ## 2.1 Зачем 30 наук Crucix — не просто набор ML-моделей. Это синтез 30 наук, каждая из которых даёт свой уникальный взгляд на прогнозирование.

#### 03-models.md

- **Путь:** docs/handbook/03-models.md
- **Размер:** 7190 B, 211 строк
- **О чём:** # Глава 3. Модели ## 3.1 Обзор Crucix включает 45+ моделей из 30 наук. Все модели реализованы на чистом JavaScript, без внешних зависимостей. Каждая модель — 300-500 строк читаемого кода.

#### 08-testing.md

- **Путь:** docs/handbook/08-testing.md
- **Размер:** 17928 B, 506 строк
- **Экспорты:** export { runMutationTests };
- **О чём:** # Глава 8. Тестирование Crucix > «Прогностическая система, которая не проверяет себя — это гадание». Crucix использует **четырёхуровневую стратегию тестирования**:

#### 16-advanced-contagion.md

- **Путь:** docs/handbook/16-advanced-contagion.md
- **Размер:** 11472 B, 274 строк
- **О чём:** # Глава 16. Advanced Contagion, Attention & Co-evolution > «Противник не стоит на месте. Внимание перетекает. Связи тройные.» В Crucix v3.0 добавлены **три новых слоя прогнозирования**, которые расширяют возможности системы за пределы стандартных гра

#### architecture-overview.md

- **Путь:** docs/handbook/architecture-overview.md
- **Размер:** 17933 B, 380 строк
- **О чём:** # Crucix — обзор архитектуры **Назначение:** единая картина всей прогностической системы Crucix — модули, фазы, потоки данных, метрики. **Актуальная версия:** 7.0.0.

#### build.sh

- **Путь:** docs/handbook/build.sh
- **Размер:** 3052 B, 106 строк
- **О чём:** #!/usr/bin/env bash # Сборка Crucix Handbook в PDF/HTML/EPUB # Требует: pandoc, xelatex (для PDF)

#### catalog.md

- **Путь:** docs/handbook/catalog.md
- **Размер:** 13465 B, 266 строк
- **О чём:** # Crucix Catalog — шесть модулей расширенной прогностической аналитики **Расположение:** apis/predict/ (верхний уровень) + apis/predict/models/ **Назначение:** шесть модулей из «каталога 29 прогностических слоёв», закрывающих пробелы, которые не покр

#### pipeline-S-T-U.md

- **Путь:** docs/handbook/pipeline-S-T-U.md
- **Размер:** 9577 B, 294 строк
- **О чём:** # Crucix Pipeline — фазы A–U **Назначение:** описание полного 16-фазного конвейера прогностического движка Crucix. **Актуальная версия:** 7.0.0 (16 фаз).

#### v6.0.md

- **Путь:** docs/handbook/v6.0.md
- **Размер:** 13434 B, 278 строк
- **О чём:** # Crucix v6.0 — пять модулей научного синтеза **Версия:** 6.0.0 **Расположение:** `apis/predict/v6/`

#### v7.0.md

- **Путь:** docs/handbook/v7.0.md
- **Размер:** 12068 B, 281 строк
- **О чём:** # Crucix v7.0 — Simulation Engine и непрерывный мир **Версия:** 7.0.0 **Расположение:** apis/predict/v7/

#### v8.0-agent.md

- **Путь:** docs/handbook/v8.0-agent.md
- **Размер:** 12982 B, 335 строк
- **О чём:** # Crucix v8.0 — AI Agent над детерминированным ядром **Версия:** 8.0.0 **Расположение:** apis/predict/agent/ + dashboard/agent.html


### docs/handbook/sciences (17)

#### _index_complete.md

- **Путь:** docs/handbook/sciences/_index_complete.md
- **Размер:** 3048 B, 70 строк
- **О чём:** # Часть II. Науки. Полный индекс ## Готовые главы (14 из 14) | # | Наука | Файл | Модели |

#### advanced_layers.md

- **Путь:** docs/handbook/sciences/advanced_layers.md
- **Размер:** 21583 B, 516 строк
- **О чём:** # Глава 15. Продвинутые слои прогнозирования (v3.0) В этой главе описаны шесть новых слоёв, добавленных в Crucix v3.0. Они формируют **третий контур** прогностической системы: - **Первый контур** — базовые статистические модели (Bayesian, Markov, Mon

#### bayesian.md

- **Путь:** docs/handbook/sciences/bayesian.md
- **Размер:** 5564 B, 163 строк
- **О чём:** # Глава 10. Байесовская статистика Байесовский подход — фундамент Crucix. Вместо точечных оценок — распределения. Вместо частотных тестов — credible intervals. Crucix использует четыре байесовских метода:

#### causality.md

- **Путь:** docs/handbook/sciences/causality.md
- **Размер:** 3438 B, 97 строк
- **О чём:** # Глава 15. Причинность Корреляция не подразумевает причинность. Это утверждение верно. Но как доказать причинность? Pearl (2000) дал строгий формализм: do-calculus.

#### epidemiology.md

- **Путь:** docs/handbook/sciences/epidemiology.md
- **Размер:** 3416 B, 101 строк
- **О чём:** # Глава 8. Эпидемиология Кризисы распространяются как эпидемии: - Начало: локальный случай

#### finance.md

- **Путь:** docs/handbook/sciences/finance.md
- **Размер:** 5759 B, 150 строк
- **О чём:** # Глава 9. Финансы Финансовая математика дала Crucix четыре ключевых инструмента: 1. Copula — зависимость хвостов

#### gametheory.md

- **Путь:** docs/handbook/sciences/gametheory.md
- **Размер:** 5014 B, 128 строк
- **О чём:** # Глава 12. Теория игр Геополитика — это игра. Страны принимают решения в контексте других игроков. Теория игр даёт язык для описания равновесий и стратегий. Crucix использует три подхода:

#### infotheory.md

- **Путь:** docs/handbook/sciences/infotheory.md
- **Размер:** 6812 B, 172 строк
- **О чём:** # Глава 11. Теория информации Информационная теория (Shannon, 1948) — язык, на котором описываются зависимости между сигналами. Это фундамент для причинного анализа. Crucix использует пять методов:

#### navigation.md

- **Путь:** docs/handbook/sciences/navigation.md
- **Размер:** 4243 B, 116 строк
- **О чём:** # Глава 7. Навигация Фильтры Калмана пришли из навигации: как, имея шумные GPS-измерения, оценить точную позицию и скорость? Тот же вопрос в Crucix: как, имея шумные метрики, оценить истинное состояние системы? Crucix использует три фильтра:

#### networks.md

- **Путь:** docs/handbook/sciences/networks.md
- **Размер:** 5822 B, 147 строк
- **О чём:** # Глава 13. Теория сетей Современный мир — это граф: страны связаны торговлей, сектора — поставками, метрики — корреляциями. Теория сетей позволяет анализировать структуру. Crucix использует четыре подхода:

#### physics.md

- **Путь:** docs/handbook/sciences/physics.md
- **Размер:** 7564 B, 170 строк
- **О чём:** # Глава 4. Физика Физические системы и финансовые/геополитические системы имеют общие черты: - Множество взаимодействующих компонентов

#### README.md

- **Путь:** docs/handbook/sciences/README.md
- **Размер:** 2997 B, 51 строк
- **О чём:** # Часть II. Науки Crucix — не просто набор ML-моделей. Это синтез 30 наук, каждая из которых даёт свой уникальный взгляд на прогнозирование. ## Зачем так много наук

#### reliability.md

- **Путь:** docs/handbook/sciences/reliability.md
- **Размер:** 3994 B, 110 строк
- **О чём:** # Глава 16. Теория надёжности Теория надёжности изучает отказы систем. Crucix использует три её инструмента для прогнозирования: 1. Grey Prediction — прогноз на малых выборках

#### seismology.md

- **Путь:** docs/handbook/sciences/seismology.md
- **Размер:** 5205 B, 110 строк
- **О чём:** # Глава 5. Сейсмология Землетрясения и конфликты имеют глубокую структурную аналогию: - Основное событие — крупный конфликт / землетрясение

#### sociophysics.md

- **Путь:** docs/handbook/sciences/sociophysics.md
- **Размер:** 4594 B, 115 строк
- **О чём:** # Глава 17. Социофизика Социофизика — применение физических моделей к социальным явлениям. В Crucix используется для анализа социальной динамики и протестов. Три модели:

#### speech.md

- **Путь:** docs/handbook/sciences/speech.md
- **Размер:** 4331 B, 93 строк
- **О чём:** # Глава 6. Распознавание речи Распознавание речи и анализ рынков имеют глубокую аналогию: - Звук (спектрограмма) — шумные метрики (VIX, спреды, конфликты)

#### topology.md

- **Путь:** docs/handbook/sciences/topology.md
- **Размер:** 3803 B, 88 строк
- **О чём:** # Глава 14. Топология Топология изучает форму пространств независимо от масштаба. В Crucix — форма многомерного облака состояний системы. Topological Data Analysis (TDA) — набор методов для извлечения топологических признаков из данных.


### plugins/examples/custom-signal (2)

#### index.mjs

- **Путь:** plugins/examples/custom-signal/index.mjs
- **Размер:** 1306 B, 45 строк
- **Экспорты:** export async function init(userConfig) { | export function computeSignal(result, latest) { | export async function afterPrediction(result) { | export function getStatus() {
- **О чём:** Пример плагина, добавляющего кастомный сигнал

#### manifest.json

- **Путь:** plugins/examples/custom-signal/manifest.json
- **Размер:** 649 B, 26 строк
- **О чём:** { "name": "custom-signal", "version": "1.0.0",


### plugins/examples/data-fetcher (2)

#### index.mjs

- **Путь:** plugins/examples/data-fetcher/index.mjs
- **Размер:** 1279 B, 48 строк
- **Экспорты:** export async function init(userConfig) { | export async function onTimer(elapsedMs) { | export function getStatus() {
- **О чём:** Пример плагина-фетчера данных

#### manifest.json

- **Путь:** plugins/examples/data-fetcher/manifest.json
- **Размер:** 681 B, 27 строк
- **О чём:** { "name": "data-fetcher", "version": "1.0.0",


### plugins/examples/hello-world (2)

#### index.mjs

- **Путь:** plugins/examples/hello-world/index.mjs
- **Размер:** 958 B, 39 строк
- **Экспорты:** export async function init(userConfig) { | export async function onShutdown() { | export async function afterPrediction(result) { | export async function onSignalHigh(signal) { | export function getStatus() {
- **О чём:** Минимальный пример плагина Crucix

#### manifest.json

- **Путь:** plugins/examples/hello-world/manifest.json
- **Размер:** 616 B, 26 строк
- **О чём:** { "name": "hello-world", "version": "1.0.0",


### tests/load/artillery (2)

#### processors.mjs

- **Путь:** tests/load/artillery/processors.mjs
- **Размер:** 911 B, 34 строк
- **Экспорты:** export function onConnect(context, events, done) { | export function closeConnection(context, events, done) { | export function validateMessage(context, events, done) {
- **О чём:** tests/load/artillery/processors.mjs Artillery custom processors

#### ws-load.yml

- **Путь:** tests/load/artillery/ws-load.yml
- **Размер:** 1945 B, 83 строк
- **О чём:** # tests/load/artillery/ws-load.yml # Artillery нагрузочный тест WebSocket #


### tests/load/k6 (2)

#### api.js

- **Путь:** tests/load/k6/api.js
- **Размер:** 3457 B, 118 строк
- **Экспорты:** export const options = { | export default function () { | export function handleSummary(data) {
- **О чём:** tests/load/k6/api.js Нагрузочный тест HTTP API Crucix

#### websocket.js

- **Путь:** tests/load/k6/websocket.js
- **Размер:** 4527 B, 165 строк
- **Экспорты:** export const options = { | export default function () { | export function setup() { | export function teardown(data) { | export function handleSummary(data) {
- **О чём:** tests/load/k6/websocket.js k6 нагрузочный тест для WebSocket API Crucix


---

## Связь с уровнями 2-4

- **Уровень 2 (книга):** docs/book/01-overview.md … 07-improvements.md.
- **Уровень 2 (паспорта фаз):** docs/modules/phase-*.md.
- **Уровень 3 (код):** сами файлы.
- **Уровень 4 (справки):** data/help/ru/, data/help/en/.

---

**Конец файла INDEX.md**
