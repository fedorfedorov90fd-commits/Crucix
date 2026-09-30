# Глава 10. Байесовская статистика

Байесовский подход — фундамент Crucix. Вместо точечных оценок — распределения. Вместо частотных тестов — credible intervals.

Crucix использует четыре байесовских метода:

1. BOCPD — Bayesian Online Change Point Detection
2. MCMC — Markov Chain Monte Carlo
3. Hierarchical Bayes — иерархические модели
4. Bayesian Networks — вероятностные графы

## 10.1 Bayesian Online Change Point Detection

### Теория

Adams & MacKay (2007). Онлайн определение смены режима:

- Поддерживаем распределение по run length r_t
- r_t = 0 — момент смены
- r_t = k — прошло k точек с последней смены

Predictive distribution: Student-t (устойчива к выбросам).

Рекурсия:

P(r_t, x_{1:t}) = sum P(r_{t-1}, x_{1:t-1}) * P(x_t | r_{t-1}) * P(r_t | r_{t-1})

где:
- P(r_t = 0 | r_{t-1}) = H — hazard rate
- P(r_t = r_{t-1} + 1 | r_{t-1}) = 1 - H

### Применение в Crucix

Определение момента смены режима VIX без порогов.

### Что это даёт

Момент смены режима:

Change points detected:
  t=15: P=0.42
  t=32: P=0.51
  t=58: P=0.38

Current: P(change) = 0.08 (режим стабилен)
Regime age: 12 steps

Правило: P(change) > 0.4 — режим меняется сейчас. Не пытайтесь торговать по старым правилам.

## 10.2 MCMC

### Теория

Markov Chain Monte Carlo. Когда posterior не выводится аналитически, генерируем выборку.

Metropolis-Hastings:

1. Предлагаем theta_new ~ q(.|theta)
2. Принимаем с вероятностью alpha = min(1, p(theta_new|D)/p(theta|D) * q(theta|theta_new)/q(theta_new|theta))

Gibbs sampling: обновляем по одному параметру из conditional posterior.

### Применение в Crucix

Оценка скрытой интенсивности эскалации.

### Что это даёт

Posterior для параметров плюс прогноз:

alpha = 1.24 +- 0.18
beta = 0.42 +- 0.11

Predicted conflicts (current stress):
  mean = 6.2
  p025 = 3.1
  p975 = 11.4

Правило: если p975 > 15 — высокий риск эскалации.

## 10.3 Hierarchical Bayes

### Теория

Gelman et al. (2013). Иерархические модели — параметры на нескольких уровнях:

Уровень 1: y_i ~ N(theta_i, sigma_i)      # наблюдения
Уровень 2: theta_i ~ N(mu, tau)           # параметры групп
Уровень 3: mu, tau ~ Hyperprior           # гиперпараметры

Shrinkage: отдельные оценки подтягиваются к общему среднему.

### Применение в Crucix

Для стран/регионов с малыми данными — borrowing strength от глобального пула.

### Что это даёт

Топ рисковых регионов с учётом глобального контекста:

1. ukraine: posterior 0.72 (raw 0.81, shrinkage -0.09)
2. russia:  posterior 0.58 (raw 0.62)
3. israel:  posterior 0.44 (raw 0.38, shrinkage +0.06)

Для стран с n=3 наблюдениями — сильная усадка к глобальному mean=0.32.
Для стран с n=50 — слабая усадка.

Правило: hierarchical model надёжнее для стран с малыми данными.

## 10.4 Bayesian Networks

### Теория

Pearl (1985). DAG с условными вероятностями:

P(X_1, ..., X_n) = prod P(X_i | parents(X_i))

Inference: P(Y | E) — posterior целевой переменной при evidence.

### Применение в Crucix

Граф причинности:

ConflictLevel -> VIX -> CreditStress -> Crisis
ConflictLevel -> SanctionsPressure -> SupplyChainStress -> Crisis

### Что это даёт

P(crisis | evidence) — точная вероятность с учётом всей структуры:

Evidence:
  ConflictLevel = high
  VIX = elevated
  SanctionsPressure = high
  CreditStress = medium
  SupplyChainStress = medium

Posterior:
  P(Crisis = yes) = 0.42
  P(Crisis = no) = 0.58

Crisis level: elevated

Правило: P(Crisis) > 0.5 — кризис вероятен.

## 10.5 Итог

| Метод | Что показывает | Когда критично |
|-------|----------------|----------------|
| BOCPD | Момент смены | P(change) > 0.4 |
| MCMC | Posterior параметров | p975 > порог |
| HierBayes | Топ регионов | posterior > 0.6 |
| BayesNet | P(crisis) | > 0.5 |

Композитная логика: все четыре метода дополняют друг друга. BOCPD — когда. MCMC — что. HierBayes — где. BayesNet — почему.

## 10.6 Литература

- Adams, R. P., & MacKay, D. J. C. (2007). Bayesian online changepoint detection. arXiv.
- Gelman, A. et al. (2013). Bayesian Data Analysis. Chapman & Hall.
- Pearl, J. (1985). Bayesian networks: A model of self-activated memory for evidential reasoning. UCLA.
- Robert, C. P., & Casella, G. (2004). Monte Carlo Statistical Methods. Springer.
