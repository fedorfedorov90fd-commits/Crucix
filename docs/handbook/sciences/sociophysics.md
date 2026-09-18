# Глава 17. Социофизика

Социофизика — применение физических моделей к социальным явлениям. В Crucix используется для анализа социальной динамики и протестов.

Три модели:

1. Ising model for opinions — поляризация мнений
2. Sznajd model — распространение мнений через соседей
3. Hegselmann-Krause — bounded confidence

## 17.1 Ising Model for Opinions

### Теория

Каждый агент имеет мнение s_i in {-1, +1}. Взаимодействие:

H = -J * sum_{<i,j>} s_i * s_j

Если J > 0 — ферромагнетик (агенты стремятся согласиться).
Если J < 0 — антиферромагнетик (агенты стремятся быть противоположными).

Фазовый переход: при низкой температуре — consensus. При высокой — disorder.

### Применение в Crucix

Каждая страна — узел со мнением (позиция по конфликту). Magnetization = поляризация.

### Что это даёт

Уровень поляризации:

Magnetization = 0.62
Regime = bipolar

Правило: рост magnetization — сигнал о поляризации. Растёт риск глобального конфликта.

## 17.2 Sznajd Model

### Теория

Sznajd-Weron & Sznajd (2000). Модель распространения мнений через соседей.

Правило:
- Если два соседа имеют одинаковое мнение, они убеждают всех своих соседей
- Иначе — никто не убеждает

Ключевое: мнение распространяется кластерами.

### Применение в Crucix

Распространение социальной напряжённости через граф стран.

### Что это даёт

Уровень консенсуса:

Consensus: 0.78
Regime: polarized

Консенсус 78% — но есть 22% противоположных.

Правило: если consensus < 0.6 — сильная поляризация, риск раскола.

## 17.3 Hegselmann-Krause

### Теория

Hegselmann & Krause (2002). Bounded confidence:

- Агент i имеет мнение x_i in [0, 1]
- Агент i слушает только агентов с |x_i - x_j| < epsilon
- Обновление: x_i(t+1) = average({x_j : |x_i - x_j| < epsilon})

Ключевое: при epsilon < 0.2 — кластеры. При epsilon > 0.3 — консенсус.

### Применение в Crucix

Моделирование социальной поляризации.

### Что это даёт

Число кластеров мнений:

nAgents: 100
epsilon: 0.15

Final:
  3 clusters:
    Cluster 1: 42 agents, mean = 0.15
    Cluster 2: 35 agents, mean = 0.52
    Cluster 3: 23 agents, mean = 0.88

Regime: polarized

Правило: 3+ кластеров — фрагментация. 2 кластера — поляризация. 1 — консенсус.

## 17.4 Итог

| Модель | Что показывает | Когда критично |
|--------|----------------|----------------|
| Ising | Поляризация | magnetization растёт |
| Sznajd | Консенсус | consensus < 0.6 |
| Hegselmann-Krause | Кластеры мнений | nClusters > 2 |

Композитная логика: три модели дают три аспекта. Ising — статическая поляризация. Sznajd — динамика распространения. HK — структура мнений.

Правило: если Ising magnetization > 0.6 и Sznajd consensus < 0.7 и HK nClusters = 2-3 — сильная поляризация, риск социального взрыва.

## 17.5 Литература

- Galam, S. (2008). Sociophysics: A review of Galam models. International Journal of Modern Physics C.
- Sznajd-Weron, K., & Sznajd, J. (2000). Opinion evolution in closed community. International Journal of Modern Physics C.
- Hegselmann, R., & Krause, U. (2002). Opinion dynamics and bounded confidence models, analysis, and simulation. Journal of Artificial Societies and Social Simulation.
- Castellano, C., Fortunato, S., & Loreto, V. (2009). Statistical physics of social dynamics. Reviews of Modern Physics.
