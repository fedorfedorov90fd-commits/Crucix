# Глава 9. Финансы

Финансовая математика дала Crucix четыре ключевых инструмента:

1. Copula — зависимость хвостов
2. Vine Copula — многомерные зависимости
3. Extreme Value Theory (EVT) — оценка хвостов
4. Ornstein-Uhlenbeck — возврат к среднему

## 9.1 Copula

### Теория

Sklar (1959). Copula — это функция, связывающая маргинальные распределения в совместное:

F(x1, x2, ..., xn) = C(F1(x1), F2(x2), ..., Fn(xn))

Ключевое: маргиналы — отдельно, зависимость — отдельно.

Для двух переменных популярны:

Clayton — нижний хвост:
C_theta(u, v) = (u^(-theta) + v^(-theta) - 1)^(-1/theta)

Gumbel — верхний хвост:
C_theta(u, v) = exp(-((-ln u)^theta + (-ln v)^theta)^(1/theta))

### Применение в Crucix

Корреляция Пирсона не ловит хвостовые зависимости. Copula моделирует падение вместе именно в кризис.

### Что это даёт

Joint tail dependencies:

VIX и HY-спред:
  Pearson: 0.45
  Kendall tau: 0.32
  Clayton lower tail: 0.042
  Gumbel upper tail: 0.018

Ключевое: даже если корреляция Пирсона = 0.45 (умеренная), joint tail = 0.042 означает, что в 4.2% времени оба падают вместе. Это критично для портфельного риска.

Правило: lowerTailDep > 0.03 — кризис может разразиться одновременно по нескольким фронтам.

## 9.2 Vine Copula

### Теория

Aas et al. (2009). Для N переменных используем N(N-1)/2 бинарных копулы, организованных в дерево.

Vine: C-vine, D-vine, R-vine. Каждая — способ организации дерева.

### Применение в Crucix

Для 6+ метрик (VIX, спред, нефть, золото, DXY, конфликты) — модель совместного хвоста.

### Что это даёт

P(все падают вместе) — оценка системного риска:

Joint tail probability: 0.018
Интерпретация: 1.8% времени — глобальный кризис

Это НЕ 0.5^6 = 1.6%. В 100 раз выше случайного.

Правило: jointTail > 0.015 — высокая системная связанность.

## 9.3 Extreme Value Theory

### Теория

Pickands-Balkema-de Haan (1974). Хвост распределения сходится к Generalized Pareto Distribution (GPD):

P(X - u > y | X > u) = (1 + xi*y/sigma)^(-1/xi)

где u — порог, xi — shape, sigma — scale.

- xi > 0 — тяжёлый хвост (степенной)
- xi = 0 — экспоненциальный
- xi < 0 — ограниченный

### Применение в Crucix

Оценка вероятности экстремальных событий, которых не было в истории.

### Что это даёт

Оценка хвостовых рисков:

VIX historical max: 82 (2008)
Current threshold: 25
Fitted GPD: xi = 0.18 (heavy tail)

P(VIX > 30) = 3.2%, return period = 31 months
P(VIX > 40) = 1.1%, return period = 91 months
P(VIX > 50) = 0.4%, return period = 250 months
P(VIX > 60) = 0.18%, return period = 555 months

Правило: returnPeriod < 100 months — готовьтесь к событию в течение 5-8 лет.

## 9.4 Ornstein-Uhlenbeck

### Теория

Uhlenbeck & Ornstein (1930). Процесс возврата к среднему:

dX = theta * (mu - X) * dt + sigma * dW

где:
- theta — скорость возврата
- mu — долгосрочное среднее
- sigma — волатильность

Half-life: ln(2) / theta — время возврата к середине.

### Применение в Crucix

Спреды и VIX возвращаются к среднему.

### Что это даёт

Half-life показывает, сколько времени система возвращается к норме:

VIX half-life: 5.2 steps (около 78 минут)
HY-спред half-life: 12.4 steps (около 3 часов)
Oil half-life: 30.1 steps (около 7.5 часов)

Правило:
- halfLife < 10 — паника рассосётся быстро
- halfLife > 50 — структурный сдвиг, не шум

## 9.5 Итог

| Модель | Что показывает | Когда критично |
|--------|----------------|----------------|
| Copula | Хвостовые зависимости | lowerTail > 0.03 |
| Vine | Многомерные хвосты | jointTail > 0.015 |
| EVT | Экстремальные риски | returnPeriod < 100 |
| OU | Возврат к среднему | halfLife > 50 |

Композитная логика: Copula и Vine показывают системную связанность, EVT — вероятности катастроф, OU — восстановление.

## 9.6 Литература

- Sklar, A. (1959). Fonctions de repartition a n dimensions et leurs marges. Publ. Inst. Statist. Univ. Paris.
- Aas, K. et al. (2009). Pair-copula constructions of multiple dependence. Insurance: Mathematics and Economics.
- Pickands, J. (1975). Statistical inference using extreme order statistics. Annals of Statistics.
- Uhlenbeck, G. E., & Ornstein, L. S. (1930). On the theory of the Brownian motion. Physical Review.
