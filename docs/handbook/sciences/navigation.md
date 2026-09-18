# Глава 7. Навигация

Фильтры Калмана пришли из навигации: как, имея шумные GPS-измерения, оценить точную позицию и скорость? Тот же вопрос в Crucix: как, имея шумные метрики, оценить истинное состояние системы?

Crucix использует три фильтра:

1. Kalman Filter — линейный
2. Extended Kalman Filter — для нелинейных систем
3. Particle Filter — для сильно нелинейных

## 7.1 Kalman Filter

### Теория

Kalman (1960). Оптимальный линейный фильтр.

Модель:

x_t = F * x_{t-1} + B * u_t + w_t   (w ~ N(0, Q))
z_t = H * x_t + v_t                  (v ~ N(0, R))

Predict:

x_hat_minus = F * x_hat
P_minus = F * P * F^T + Q

Update:

K = P_minus * H^T * (H * P_minus * H^T + R)^-1
x_hat = x_hat_minus + K * (z - H * x_hat_minus)
P = (I - K * H) * P_minus

где K — Kalman gain.

### Применение в Crucix

Модель постоянная скорость для VIX:

state = [vix, velocity]
F = [[1, 1], [0, 1]]
H = [1, 0]   # наблюдаем только VIX

### Что это даёт

Сглаженный VIX (без шума) плюс скорость изменения плюс прогноз с доверительным интервалом.

Правило: velocity > 0.5 — VIX растёт быстрее нормы. Velocity > 1.0 — резкий рост, готовьтесь.

## 7.2 Extended Kalman Filter (EKF)

### Теория

Для нелинейных систем линеаризуем через матрицу Якоби:

x_t = f(x_{t-1}) + w
z_t = h(x_t) + v

Predict:

x_hat_minus = f(x_hat)
F_k = df/dx в точке x_hat
P_minus = F_k * P * F_k^T + Q

Update аналогично линейному, но с H_k = dh/dx.

### Применение в Crucix

Нелинейная модель VIX:

dx/dt = theta * (mu - x) + gamma * (x - mu)^3 + noise

Кубический член даёт резкие движения при больших отклонениях.

## 7.3 Particle Filter

### Теория

Sequential Monte Carlo для сильно нелинейных систем. Представляем распределение набором частиц:

{ (x_t^(i), w_t^(i)) }_{i=1}^N

где w — веса. Обновление:

Predict: x_t^(i) ~ p(x_t | x_{t-1}^(i))
Update:  w_t^(i) пропорционально w_{t-1}^(i) * p(z_t | x_t^(i))
Resample: если вес эффективно низкий — пересэмплировать

### Применение в Crucix

VIX как процесс с mean reversion и джампами. Распределение будущего VIX с тяжёлыми хвостами:

Forecast VIX (5 steps):
  mean = 24.3
  p5 = 18.2, p50 = 23.8, p95 = 35.4
  P(VIX > 30) = 0.18

Правило: если p95 > 35 — высокая вероятность паники.

## 7.4 Итог

| Модель | Что показывает | Когда критично |
|--------|----------------|----------------|
| Kalman | Сглаженный плюс velocity | velocity > 1.0 |
| EKF | Нелинейная динамика | nonlinear signal |
| Particle | Распределение будущего | p95 > 35 |

Композитная логика: три фильтра дают разные аспекты сглаживания. Kalman — быстрый тренд. EKF — нелинейные ускорения. Particle — хвостовые риски.

Историческое правило: если все три показывают рост (velocity > 1, nonlinear signal = buy_vol, p95 > 35) — паника на подходе.

## 7.5 Литература

- Kalman, R. E. (1960). A new approach to linear filtering and prediction problems. Journal of Basic Engineering.
- Julier, S. J., & Uhlmann, J. K. (2004). Unscented filtering and nonlinear estimation. Proceedings of the IEEE.
- Gordon, N. J., Salmond, D. J., & Smith, A. F. (1993). Novel approach to nonlinear/non-Gaussian Bayesian state estimation. IEE Proceedings F.
