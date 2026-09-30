# Глава 16. Теория надёжности

Теория надёжности изучает отказы систем. Crucix использует три её инструмента для прогнозирования:

1. Grey Prediction — прогноз на малых выборках
2. Fuzzy Cognitive Maps — экспертные графы с нечёткими весами
3. Bayesian Optimization — оптимизация гиперпараметров

## 16.1 Grey Prediction GM(1,1)

### Теория

Deng (1982). Китайская школа системной инженерии. Когда данных мало (5-10 точек), классические модели беспомощны. Grey использует:

1. AGO (Accumulated Generating Operation): x1(k) = sum x0(i)
2. Аппроксимация экспонентой: x1(k+1) = (x0(1) - b/a) * exp(-a*k) + b/a
3. IAGO: обратное преобразование

### Применение в Crucix

Когда модуль только развёрнут — GM(1,1) даёт стартовый прогноз.

### Что это даёт

Прогноз на малой выборке:

Data: 8 точек VIX
a = -0.05 (рост)
b = 22.3

Forecast (3 шага): [24.1, 24.8, 25.5]
MAPE: 3.2% (хорошо)

Правило: GM(1,1) — стартовая модель. Когда данных > 30, заменяется на более точные.

## 16.2 Fuzzy Cognitive Maps

### Теория

Kosko (1986). FCM — граф с нечёткими весами:

A_i(t+1) = f(sum w_ji * A_j(t) + bias_i)

где f — сигмоида, w in [-1, 1].

Применение: экспертные знания о причинных связях.

### Применение в Crucix

Экспертный граф геополитико-экономических концептов.

### Что это даёт

What-if анализ:

Что если конфликт +20%?
-> market_volatility: +18%
-> credit_stress: +25%
-> currency_pressure: +15%
-> central_bank_intervention: +22%

Правило: FCM — экспертный, а не data-driven. Работает, когда данных мало.

## 16.3 Bayesian Optimization

### Теория

Snoek et al. (2012). Оптимальная стратегия для дорогих функций:

1. Обучаем Gaussian Process на текущих точках
2. Выбираем следующую точку через acquisition function (EI, UCB, PI)
3. Повторяем

EI (Expected Improvement):

EI(x) = E[max(0, f_best - f(x))]

### Применение в Crucix

Оптимизация гиперпараметров моделей.

### Что это даёт

Оптимизация за 20 итераций вместо grid search (сотни):

Best params found in 25 trials:
  learning_rate: 0.023
  hidden_dim: 47
  batch_size: 18

Score: 0.0412 RMSE

Правило: BO в 10 раз эффективнее grid search.

## 16.4 Итог

| Метод | Что показывает | Когда использовать |
|-------|----------------|---------------------|
| GM(1,1) | Прогноз малых выборок | < 15 точек |
| FCM | Что-если анализ | Экспертные знания |
| Bayesian Opt | Гиперпараметры | Дорогая функция |

Композитная логика: три метода решают три разные задачи. GM(1,1) — когда данных мало. FCM — когда знания экспертов важнее. BO — когда нужно оптимизировать.

## 16.5 Литература

- Deng, J. (1982). Control problems of grey systems. Systems & Control Letters.
- Kosko, B. (1986). Fuzzy cognitive maps. International Journal of Man-Machine Studies.
- Snoek, J., Larochelle, H., & Adams, R. P. (2012). Practical Bayesian optimization of machine learning algorithms. NeurIPS.
