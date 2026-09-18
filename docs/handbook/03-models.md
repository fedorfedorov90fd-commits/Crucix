# Глава 3. Модели

## 3.1 Обзор

Crucix включает 45+ моделей из 30 наук. Все модели реализованы на чистом JavaScript, без внешних зависимостей. Каждая модель — 300-500 строк читаемого кода.

## 3.2 Классификация моделей

### По типу обучения

| Тип | Примеры | Применение |
|-----|---------|------------|
| Supervised | MLP, GBM, RF, GNN | Прогноз VIX/конфликтов |
| Unsupervised | VAE, Isolation Forest, K-means | Anomaly detection, кластеризация |
| Generative | Diffusion, VAE | Генерация сценариев |
| Reinforcement | DQN, Actor-Critic, REINFORCE | Политики алертинга |
| Probabilistic | HMM, HSMM, MRF, BOCPD | Скрытые режимы, change points |
| Sequential | LSTM, Transformer, ARIMA | Временные ряды |
| Graph | GCN, GraphSAGE | Сетевые данные |

### По сложности

- Простые (100-200 строк): Ising, SOC, Kalman, Grey
- Средние (300-500 строк): MLP, HMM, Copula, Hawkes
- Сложные (500-800 строк): Transformer, GNN, VAE, Diffusion

## 3.3 Основные классы моделей

### Neural Networks

- MLP — многослойный перцептрон, 3-5 слоёв
- LSTM — рекуррентная сеть с гейтами
- Transformer — attention + positional encoding
- GNN (GCN, GraphSAGE) — свёртки на графах

### Tree-based

- Gradient Boosting — XGBoost-подобный, бинарные деревья
- Random Forest — бэггинг + OOB-оценка
- Stacking Ensemble — мета-обучение

### Meta-модели

- AutoML — поиск архитектуры
- Bayesian Optimization — оптимизация гиперпараметров
- Stacking — объединение моделей

### Unsupervised

- VAE — вариационный автоэнкодер
- Diffusion (DDPM) — генеративная модель
- Isolation Forest — anomaly detection
- K-means, DBSCAN — кластеризация

### Sequential

- HMM / HSMM — скрытые марковские модели
- Kalman / EKF / Particle — фильтры Калмана
- BOCPD — Bayesian Online Change Point Detection

## 3.4 Архитектура MLP

Простой трёхслойный перцептрон:

Вход (10) -> Скрытый1 (32) -> Скрытый2 (16) -> Выход (1)

Обучение:
- Активация: ReLU скрытые, linear выход
- Оптимизатор: Adam, lr = 0.01
- Loss: MSE
- Batch size: 16
- Эпох: 50

Результат: RMSE ~1.5 на VIX (при базовой ~3.1 у Naive).

## 3.5 Архитектура Transformer

Input (seq_len=10, features=10)
    -> Linear Projection -> dModel=32
    -> + Positional Encoding
    -> TransformerBlock x 2:
        - Multi-Head Self-Attention (4 heads)
        - LayerNorm + Residual
        - Feed-Forward (32 -> 64 -> 32)
        - LayerNorm + Residual
    -> Global Mean Pooling
    -> Linear (32 -> 1)
    -> Output (VIX prediction)

Особенности:
- Полный backprop через attention
- Residual connections
- LayerNorm для стабильности

Результат: RMSE ~1.4 на VIX. Лучше MLP, но требует больше данных.

## 3.6 Архитектура VAE

Input (10) -> Encoder:
    Linear (10 -> 32) -> ReLU
    Linear (32 -> 16) -> ReLU
    Linear (16 -> 8) -> [mu, logvar] (по 4)
    -> Reparameterization:
        z = mu + sigma * epsilon, epsilon ~ N(0, I)
    -> Decoder:
        Linear (4 -> 16) -> ReLU
        Linear (16 -> 32) -> ReLU
        Linear (32 -> 10) -> Reconstruction

Loss: reconstruction_MSE + KL_divergence

Применение:
- Латентное представление системы (10 -> 4)
- Кластеризация режимов
- Anomaly detection (высокая reconstruction error = нетипичное состояние)

## 3.7 Архитектура Diffusion (DDPM)

Forward process (обучение):
x_0 -> x_1 -> ... -> x_T
x_t = sqrt(alpha_t) * x_0 + sqrt(1 - alpha_t) * epsilon

Reverse process (генерация):
x_T -> x_{T-1} -> ... -> x_0
x_{t-1} = (1/sqrt(alpha_t)) * (x_t - (beta_t/sqrt(1-alpha_t)) * eps_theta(x_t, t)) + sigma_t * z

DenoiseNet: 3-слойный MLP с time embedding.

Применение:
- Генерация 100 сценариев будущего
- Tail risk: P(VIX > 40) по сценариям
- Не предполагает распределение — учит его

## 3.8 Архитектура GNN

Graph Convolutional Network:
H^(l+1) = activation(A_hat * H^(l) * W^(l))

где A_hat — нормализованная adjacency матрица с self-loops.

Слой 1: 10 features -> 32 hidden
Слой 2: 32 hidden -> 16 hidden
Слой 3: 16 hidden -> 1 output

Применение: риск каждой страны с учётом соседей.

## 3.9 Reinforcement Learning

DQN (Deep Q-Network):
- State: 10 features текущего sweep
- Actions: hold, buy_vol, sell_vol
- Reward: sharpe-like ratio

Actor-Critic:
- Policy network (Actor): state -> action probabilities
- Value network (Critic): state -> value estimate
- Advantage = reward - value

Применение: оптимальная политика алертинга.

## 3.10 Обучение и валидация

Train/test split: 80/20 по времени (не случайно!).
Cross-validation: 5-fold walk-forward.

Метрики:
- RMSE (regression)
- MAE (robustness)
- Brier Score (probabilistic)
- Hit Rate (direction)
- Sharpe-like ratio (risk-adjusted)

Калибровка: все сигналы через Brier Score трекер. Динамические веса.

## 3.11 Оптимизация

Оптимизаторы:
- SGD (baseline)
- Adam (default)
- L-BFGS (для маленьких моделей)
- Nelder-Mead (без градиента)
- Differential Evolution (глобальный поиск)

Регуляризация:
- L1/L2 на весах
- Early stopping
- Dropout (в нейросетях)

## 3.12 Композитный ансамбль

Финальный прогноз — взвешенная сумма всех сигналов:

composite = sum(w_i * signal_i) / sum(w_i)

где веса w_i обновляются автоматически из Brier Score каждого сигнала.

Преимущество: ансамбль никогда не хуже худшей модели. Обычно — лучше средней.

## 3.13 Итог

45+ моделей из 30 наук. Каждая — открытая, читаемая, модифицируемая.

Ключевые принципы:
1. Zero dependencies
2. Каждая модель — до 800 строк
3. Полный backprop где нужно
4. Brier Score для всех
5. Динамические веса

Не бывает "лучшей модели". Бывает лучший ансамбль.
