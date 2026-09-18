# Глава 1. Архитектура Crucix

## 1.1 Общая картина

Crucix — это многослойная система:
\+-------------------------------------------------+ | Frontend (Dashboard,
WebSocket, Real-time) | +-------------------------------------------------+ |
API Layer (WebSocket, HTTP, Notifications) |
\+-------------------------------------------------+ | Composite Risk (weighted
ensemble) | +-------------------------------------------------+ | Extended
Trackers (Brier, calibration) |
\+-------------------------------------------------+ | 45+ Prediction Modules
(30 sciences) | +-------------------------------------------------+ | ML Models
(Neural, GBM, RF, GNN, RL, VAE) |
\+-------------------------------------------------+ | Math Core (linear
algebra, stats, optim) | +-------------------------------------------------+ |
WASM + Web Workers + WebGL (acceleration) |
\+-------------------------------------------------+ | Data Layer (runs/memory,
predictions, FL) | +-------------------------------------------------+

text

## 1.2 Что делает каждый слой

### Data Layer

Хранит все данные в файловой системе:

- runs/memory/*.json — каждый sweep (сырые данные)
- runs/predictions/latest.json — последний прогноз
- runs/predictions/extended_tracker.json — история для Brier
- runs/federated/ — FL-модели
- runs/benchmark/ — результаты бенчмарков

Принцип: всё — плоские JSON-файлы. Никаких баз данных. Легко бэкапить, легко
читать, легко отлаживать.

### Math Core

Чистая математика без зависимостей:

- linear_algebra.mjs — LU, QR, SVD, Cholesky, eigen
- stats.mjs — 30+ распределений, тесты, KDE
- optim.mjs — SGD, Adam, L-BFGS, Nelder-Mead, Differential Evolution

Принцип: если это можно написать в 200 строк — пишем сами.

### ML Models

Все классические и современные модели:

- Neural: MLP, LSTM, Transformer (с полным backprop)
- Tree-based: Gradient Boosting, Random Forest
- Meta: Stacking, AutoML, Bayesian Optimization
- Unsupervised: VAE, Diffusion, Isolation Forest
- Graph: GCN, GraphSAGE
- Sequential: HMM, HSMM, DQN, Actor-Critic

Принцип: каждая модель — 300-500 строк читаемого кода.

### 45+ Prediction Modules

Модули, сгруппированные по наукам:

- Физика: Ising, SOC, Percolation, Catastrophe Theory, Chaos
- Статистическая механика: MRF, Quantum Annealing
- Теория информации: Transfer Entropy, KL, Fisher, Wasserstein
- Эпидемиология: SIR, Hawkes-ETAS
- Байесовская статистика: BOCPD, MCMC, Hierarchical Bayes
- Сейсмология: Hawkes, ETAS
- Распознавание речи: HMM, HSMM
- Навигация: Kalman, EKF, Particle Filter
- Финансы: Copula, Vine Copula, EVT, Ornstein-Uhlenbeck
- Теория игр: Nash, ESS, Axelrod
- Теория сетей: Centrality, Communities, PageRank
- Топология: TDA, Persistent Homology
- Причинность: Do-Calculus, Counterfactual

Принцип: каждая наука даёт свой уникальный взгляд на данные.

### Composite Risk

Объединяет 45+ сигналов в один индикатор риска:

composite = sum(w_i * signal_i) / sum(w_i)

где w_i — динамические веса из Brier Score.

Принцип: ансамбль всегда точнее одной модели.

### Extended Trackers

Каждый сигнал регистрируется как «прогноз». Когда проходит горизонт — сверяется
с фактом. Обновляется Brier Score. Пересчитываются веса.

Принцип: система, которая не измеряет свою точность — это гадание.

### API Layer

- WebSocket — real-time стриминг
- HTTP — REST API для внешних клиентов
- Notifications — Discord, Telegram, webhook

Принцип: система должна быть доступна из любого места.

### Frontend

- crucix.html — основной дашборд
- realtime.html — события в реальном времени
- nn_live.html — обучение нейросети
- predictions_composite.html — радар сигналов

Принцип: визуализация должна быть мгновенной и информативной.

## 1.3 Поток данных

Каждые 15 минут (по умолчанию):

1.  Sweep собирает данные из 27+ источников
2.  Сохраняет в runs/memory/
3.  Crucix Engine v3 запускается: a. Базовые модели (Bayesian, Markov, MC) b. 17
    sciences (Hawkes, HMM, Ising, ...) c. 11 advanced ML (MRF, MCMC, GPR, ...)
    d. 8 crucix modules (AutoML, Anomaly, ...) e. 3 GNN/RL/Python f. 3
    Transformer/VAE/Diffusion
4.  ExtendedTracker регистрирует 45+ сигналов
5.  AutoResolve проверяет созревшие прогнозы
6.  Пересчёт Brier Score и калибровка
7.  Composite Risk объединяет всё
8.  WebSocket публикует результат
9.  Notifications отправляют алерты (если критично)
10. latest.json обновлён для фронтенда

Время полного цикла: 3-6 секунд (без Python), 4-8 секунд (с Python).

## 1.4 Ускорения

### WASM

Матричные операции в WebAssembly:

- Скалярный WASM: 5-10x над JS
- SIMD WASM: 15-30x над JS

Используется в: neural networks, GBM, GNN, VAE, Transformer.

### Web Workers

Параллельные вычисления через worker_threads:

- Monte Carlo (100K итераций за доли секунды)
- Обучение нескольких моделей параллельно
- Кросс-валидация

### WebGL

GPU-вычисления через WebGL fragment shaders:

- Matmul больших матриц
- Elementwise operations
- Adam updates

Работает в браузере и в Node.js через headless-gl.

## 1.5 Отказоустойчивость

Crucix спроектирован так, что любой модуль может упасть — система продолжит
работать:

try { result.hawkes = hawkesForecast(history); } catch (e) { result.hawkes = {
error: e.message }; // продолжаем без Hawkes }

Принцип: 44 работающих модуля лучше 45 падающих.

## 1.6 Развёртывание

Три способа:

1.  Локально — node apis/predict/ws.mjs
2.  Docker — docker-compose up -d
3.  Kubernetes — kustomize build k8s/ | kubectl apply -f -

Принцип: одинаково просто для dev, staging и production.

## 1.7 Что дальше

Следующая глава — математическое ядро. Мы разберём:

- Линейную алгебру через LU, QR, SVD
- Статистические распределения
- Оптимизацию через Adam, L-BFGS

Каждый алгоритм — с кодом и объяснением.

