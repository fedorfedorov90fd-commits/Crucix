# Глава 2. Науки. Обзор

## 2.1 Зачем 30 наук

Crucix — не просто набор ML-моделей. Это синтез 30 наук, каждая из которых даёт свой уникальный взгляд на прогнозирование.

**Проблема одной модели:** ARIMA или LSTM учится на исторических данных и делает прогноз. Но она не знает про фазовые переходы, эпидемиологию кризисов, причинность, топологию.

**Решение Crucix:** 30 моделей из разных наук. Каждая — со своей специализацией. Ансамбль видит реальность полнее.

## 2.2 Список наук

| # | Наука | Модели | Что показывает |
|---|-------|--------|----------------|
| 1 | Физика | Ising, SOC, Percolation, Catastrophe, Chaos | Фазовые переходы |
| 2 | Сейсмология | Hawkes, ETAS | Афтершоки конфликтов |
| 3 | Распознавание речи | HMM, HSMM | Скрытые режимы |
| 4 | Навигация | Kalman, EKF, Particle | Сглаживание шума |
| 5 | Эпидемиология | SIR, Renewal | Распространение кризисов |
| 6 | Финансы | Copula, Vine, EVT, OU | Хвостовые зависимости |
| 7 | Байесовская статистика | BOCPD, MCMC, HierBayes | Смена режима |
| 8 | Теория информации | Transfer Entropy, KL, Fisher | Причинность |
| 9 | Теория игр | Nash, ESS, Axelrod | Равновесия |
| 10 | Теория сетей | PageRank, Louvain, GNN, MRF | Структура графа |
| 11 | Топология | TDA, Persistent Homology | Скрытая форма |
| 12 | Причинность | Do-Calculus, Counterfactual | Интервенции |
| 13 | Теория надёжности | Grey, FCM, Bayesian Opt | Отказы систем |
| 14 | Социофизика | Opinion dynamics, Social SOC | Социальные взрывы |
| 15 | Продвинутые ML | MRF, MCMC, GPR, HSMM | Вероятностные модели |
| 16 | Crucix-модули | AutoML, Anomaly, Chaos, Game | Мета-уровень |
| 17 | GNN + RL + Python | GCN, DQN, TensorFlow bridge | Пространство + политики |
| 18 | Transformer + VAE + Diffusion | Attention, latent, DDPM | Глубокие генеративные |

**Итого: 45+ сигналов из 30 наук.**

## 2.3 Как науки дополняют друг друга

**Физика** отвечает на вопрос «где система на грани фазового перехода».

**Сейсмология** — «когда ждать афтершоков».

**Распознавание речи** — «в каком скрытом режиме мы находимся».

**Навигация** — «какой истинный сигнал под шумом».

**Эпидемиология** — «куда распространится кризис».

**Финансы** — «как связаны хвосты распределений».

**Байес** — «когда меняется режим».

**Информация** — «кто на кого влияет».

**Игры** — «какие равновесия устойчивы».

**Сети** — «кто ключевой узел».

**Топология** — «есть ли скрытая структура».

**Причинность** — «что было бы, если...».

Каждая наука видит **один аспект**. Ансамбль видит реальность.

## 2.4 Пример: композитный сигнал из 5 наук

Возьмём конкретный момент: VIX = 32, конфликты = 12, HY spread = 5.2.

- **Ising**: proximityToCritical = 0.85 → фазовый переход близко
- **Hawkes**: branchingRatio = 1.12 → эскалация
- **HMM**: currentState = 2 (crisis)
- **Copula**: lowerTail = 0.045 → совместные просадки
- **Transfer Entropy**: conflict→VIX = 0.22 → причинность

**Композит**: все пять кричат «кризис». Composite risk = 0.87 (critical).

Одна модель бы это пропустила. Пять — нет.

## 2.5 Детальные главы

Полные главы по каждой науке:

1. **sciences/physics.md** — Ising, SOC, Percolation, Catastrophe, Chaos
2. **sciences/seismology.md** — Hawkes, ETAS
3. **sciences/speech.md** — HMM, HSMM
4. **sciences/navigation.md** — Kalman, EKF, Particle
5. **sciences/epidemiology.md** — SIR, Renewal
6. **sciences/finance.md** — Copula, Vine, EVT, OU
7. **sciences/bayesian.md** — BOCPD, MCMC, HierBayes, BayesNet
8. **sciences/infotheory.md** — Transfer Entropy, KL, Fisher, Wasserstein, Renyi
9. **sciences/gametheory.md** — Nash, ESS, Axelrod
10. **sciences/networks.md** — Centrality, Community, GNN, MRF
11. **sciences/topology.md** — TDA, Persistent Homology
12. **sciences/causality.md** — Do-Calculus, Counterfactual
13. **sciences/reliability.md** — Grey, FCM, Bayesian Optimization
14. **sciences/sociophysics.md** — Ising opinions, Sznajd, Hegselmann-Krause

Каждая глава с формулами, кодом, примерами применения.

## 2.6 Принцип

Одна наука видит один аспект.
30 наук видят реальность.
45 сигналов в композитном индикаторе.
Каждый — со своим весом, калиброванным через Brier Score.

**Философия:** ансамбль всегда точнее одной модели. Не бывает «лучшей модели» — бывает лучший ансамбль.
