# Crucix Catalog — шесть модулей расширенной прогностической аналитики

**Расположение:** apis/predict/ (верхний уровень) + apis/predict/models/
**Назначение:** шесть модулей из «каталога 29 прогностических слоёв», закрывающих пробелы, которые не покрыты базовым конвейером A–R и v6.0.

---

## Общая картина

| Модуль | Наука | Расположение |
|--------|-------|--------------|
| mcmc.mjs | Байесовский вывод | apis/predict/models/ |
| physics_inspired.mjs | Физика сложных систем | apis/predict/models/ |
| automl.mjs | AutoML + Bayesian Optimization | apis/predict/ |
| anomaly_detection.mjs | Обнаружение аномалий | apis/predict/ |
| graph_sage.mjs | Индуктивный GNN | apis/predict/models/ |
| actor_critic.mjs | Reinforcement Learning (A2C) | apis/predict/models/ |

Все шесть подключаются через фазу T в engine_v6_patch.mjs.

---

## 1. MCMC — Markov Chain Monte Carlo

**Файл:** apis/predict/models/mcmc.mjs
**Строк:** ~1396
**Экспорт:** MetropolisHastings, AdaptiveMetropolisHastings, GibbsSampler, HamiltonianMC, HierarchicalBetaBinomial, DiagnosticSuite, PoissonRegressionMCMC, LogisticRegressionMCMC, ChangePointMCMC, crucixMCMC

### Задача

Полноценный байесовский вывод: не точечные оценки, а распределения параметров. Для случаев, когда нужно не «вероятность 0.7», а «распределение вероятности с 95% интервалом».

### Четыре метода сэмплирования

1. **MetropolisHastings** — базовый MCMC с адаптивным шагом.
2. **AdaptiveMetropolisHastings** — Robbins-Monro адаптация, ковариация накапливается.
3. **GibbsSampler** — поочерёдное сэмплирование из условных распределений.
4. **HamiltonianMC** — HMC с leapfrog интегратором.

### Диагностика

- **Gelman-Rubin R-hat** — сходимость мультицепных запусков.
- **Effective Sample Size (ESS)** — через автокорреляцию.
- **Trace analysis** — визуальная проверка сходимости.

### Прикладные модели

- **HierarchicalBetaBinomial** — иерархическая модель для стран с малыми данными (shrink к глобальному среднему).
- **PoissonRegressionMCMC** — интенсивность конфликтов.
- **LogisticRegressionMCMC** — вероятность эскалации.
- **ChangePointMCMC** — точка смены режима в VIX.

### Выход

crucixMCMC(history) возвращает: hierarchicalBetaBinomial (топ-риск регионов), poissonRegression (интерпретация VIX→конфликты), logisticRegression (вероятность эскалации > 50%), changePoint (точка смены режима с P).

---

## 2. Physics-Inspired Models

**Файл:** apis/predict/models/physics_inspired.mjs
**Строк:** ~1164
**Экспорт:** Sandpile, Percolation, FoldCatastrophe, CuspCatastrophe, SwallowtailCatastrophe, ButterflyCatastrophe, takensEmbedding, largestLyapunov, correlationDimension, recurrencePlot, crucixPhysicsInspired

### Задача

Применить модели из физики сложных систем к социально-политическим данным. Четыре независимых раздела.

### 1. SOC — Self-Organized Criticality (Bak-Tang-Wiesenfeld)

Модель песочной горки: система самоорганизуется к критическому состоянию, где лавины подчиняются степенному закону P(s) ~ s^(-tau). Из истории sweep'ов извлекается показатель tau и индикатор критичности.

### 2. Percolation Theory (Broadbent-Hammersley)

Site percolation на 2D-решётке. Каждый узел активен с вероятностью p. Порог pc ≈ 0.5927 для квадратной решётки. Оценка близости системы к порогу: subcritical → near_critical → supercritical.

### 3. Catastrophe Theory (Thom)

Четыре модели:
- **Fold** — один параметр, нет бистабильности.
- **Cusp** — два параметра, бистабильность при 4a^3 + 27b^2 < 0.
- **Swallowtail** — три параметра, tristable.
- **Butterfly** — четыре параметра, самая сложная.

Для Crucix используется **Cusp** — определение близости системы к точке катастрофы (bistable = возможен скачок).

### 4. Chaos Theory

- **Takens embedding** — delay-coordinate для восстановления фазового пространства.
- **Largest Lyapunov (Rosenstein)** — lambda > 0 → хаос, горизонт прогноза.
- **Correlation dimension (Grassberger-Procaccia)** — размерность аттрактора.
- **Recurrence plot** — матрица повторяющихся состояний, determinism.

### Выход

crucixPhysicsInspired(history) возвращает 4 блока: soc (tau, criticality regime), percolation (p, pc, spanning), catastrophe (a, b, discriminant, regime), chaos (lambda, dimension, recurrence).

---

## 3. AutoML — Bayesian Optimization

**Файл:** apis/predict/automl.mjs
**Строк:** ~1219
**Экспорт:** GaussianProcess, BayesianOptimizer, AutoML, LinearRegressor, SimpleMLP, crucixAutoML

### Задача

Автоматический выбор лучшей модели и её гиперпараметров. Оператор не должен вручную подбирать lambda, hiddenSize, learningRate — система делает это сама.

### Метод

1. **Gaussian Process** — суррогатная модель для чёрного ящика. RBF / Matern 3/2 / Matern 5/2 ядра.
2. **Bayesian Optimizer** — Sequential Model-Based Optimization.
3. **Acquisition functions** — Expected Improvement, Upper Confidence Bound, Probability of Improvement.
4. **AutoML** — K-fold cross-validation + BO по гиперпараметрам.

### Baselines

- GridSearch — перебор всех комбинаций.
- RandomSearch — N случайных точек.
- Hyperband — successive halving отбрасывает плохие конфигурации.
- SuccessiveHalving — упрощённый Hyperband.

### Выход

crucixAutoML(history) возвращает: models (по каждой модели её bestParams/bestScore), bestModel (linear/mlp), leaderboard (топ-10), randomBaseline (сравнение).

---

## 4. Anomaly Detection

**Файл:** apis/predict/anomaly_detection.mjs
**Строк:** ~787
**Экспорт:** IsolationForest, LocalOutlierFactor, MahalanobisDetector, OneClassSVM, DBSCANOutlier, AnomalyEnsemble, crucixAnomalyDetection

### Задача

Обнаружение аномальных sweep'ов. Что-то не так с данными? Какой-то индикатор ушёл в аномалию?

### Пять методов + ансамбль

1. **Isolation Forest** (Liu et al., 2008) — аномалии изолируются за меньшее число split'ов.
2. **LOF** (Breunig et al., 2000) — сравнение локальной плотности.
3. **Mahalanobis** — расстояние с учётом ковариационной структуры.
4. **One-Class SVM** — через RBF-ядро, граница вокруг нормы.
5. **DBSCAN** — точки не в кластере = шум.

**Ансамбль** — голосование (majority >= 2), взвешенный скор.

### Объяснение

z-score по признакам для топ-отклонений. Если последний sweep аномален, выводится, какие признаки отклонились.

### Выход

crucixAnomalyDetection(history) возвращает: summary (nAnomalies, anomalyRate, detectors), lastSweep (isAnomaly, votes, score), topAnomalies, explanation (topDeviations), interpretation.

---

## 5. GraphSAGE

**Файл:** apis/predict/models/graph_sage.mjs
**Строк:** ~876
**Экспорт:** GraphSAGE и вспомогательные классы, crucixGraphSAGE

### Задача

Индуктивное обучение на графах сущностей. В отличие от GCN (трансдуктивного), GraphSAGE может работать с новыми узлами без переобучения.

### Метод

1. **SAGEConv слои** — агрегация признаков соседей (mean/max/LSTM).
2. **Neighbor sampling** — фиксированное число соседей на узел (для масштабируемости).
3. **Inductive inference** — эмбеддинги новых узлов вычисляются из их окружения.

### Применение в Crucix

- Граф сущностей: страны, организации, события.
- Эмбеддинги узлов → кластеризация режимов.
- Предсказание связей в графе.

### Выход

Поля: nNodes, nEdges, embeddingDim, embeddings (или их агрегаты), training metrics.

---

## 6. Actor-Critic (A2C)

**Файл:** apis/predict/models/actor_critic.mjs
**Строк:** ~1120
**Экспорт:** Actor, Critic, A2C и вспомогательные, crucixActorCritic

### Задача

Обучение оптимальной политики алертов. Система решает, когда и на что отправлять alert, чтобы минимизировать false positives и false negatives.

### Метод

1. **Actor** — политика pi(a|s), выбирает действие.
2. **Critic** — value V(s), оценивает состояние.
3. **Advantage Actor-Critic** — Actor loss = -log(pi)·A + beta·entropy, Critic loss = MSE(V, returns).
4. **GAE (Generalized Advantage Estimation)** — lambda-returns.

### Применение в Crucix

- State: текущие индикаторы (vix, tension, ...).
- Actions: alert / no-alert / escalate.
- Reward: правильные alert +1, ложные -1, пропущенные -2.

### Выход

Поля: training (avgReward, episodes), policy (best action для текущего состояния), improvement.

---

## Интеграция в engine

Все 6 модулей подключаются через фазу T в engine_v6_patch.mjs.

### API

    import { runCatalogPhase } from './engine_v6_patch.mjs';
    const catalogResult = await runCatalogPhase(history, { disabled: [] });

Поля: modules (объект с результатами), okCount, totalModules, elapsedMs.

### Отличия от фазы S (v6.0)

- Фаза S — пять научных методов (нейро + RL + crypto).
- Фаза T — шесть прикладных модулей (статистика + GNN + аномалии).
- Обе фазы работают параллельно: S и T запускаются одновременно.

---

## Диагностика и тесты

Тесты: tests/catalog/catalog_pack_a.test.mjs (23) + tests/catalog/catalog_pack_b.test.mjs (8). Итого 31 тест, все PASS.

Типичные проблемы:

| Симптом | Причина | Решение |
|---------|---------|---------|
| automl падает с upperConfirmationBound | Опечатка в ACQUISITION реестре | Использовать upperConfidenceBound |
| graph_sage не возвращает результат | Нет crucix*-экспорта | Проверить Object.keys модуля |
| actor_critic градиенты NaN | LearningRate слишком большой | Уменьшить до 1e-4 |

---

## Математические ссылки

- Liu, F. T., Ting, K. M., & Zhou, Z. H. (2008). Isolation Forest. ICDM.
- Breunig, M. M., et al. (2000). LOF: Identifying Density-Based Local Outliers. SIGMOD.
- Mahalanobis, P. C. (1936). On the generalised distance in statistics.
- Ester, M., et al. (1996). A density-based algorithm for discovering clusters. KDD.
- Bak, P., Tang, C., & Wiesenfeld, K. (1987). Self-organized criticality. Phys. Rev. Lett.
- Broadbent, S. R., & Hammersley, J. M. (1957). Percolation processes. Cambridge Phil. Soc.
- Thom, R. (1972). Stabilité structurelle et morphogénèse.
- Hamilton, W. L. (1994). Graph representation learning. Synthesis Lectures.
- Mnih, V., et al. (2016). Asynchronous Methods for Deep Reinforcement Learning. ICML.
- Snoek, J., Larochelle, H., & Adams, R. P. (2012). Practical Bayesian Optimization. NeurIPS.

---

**Конец документа catalog.md**
