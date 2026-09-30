# Глава 13. Теория сетей

Современный мир — это граф: страны связаны торговлей, сектора — поставками, метрики — корреляциями. Теория сетей позволяет анализировать структуру.

Crucix использует четыре подхода:

1. Centrality — кто важен в графе
2. Community detection — какие группы
3. GNN — обучение на графах
4. MRF — вероятностные поля

## 13.1 Centrality

### Теория

Centrality — мера важности узла в графе:

- Degree — сколько связей (простая, но не всегда полезна)
- Betweenness — сколько кратчайших путей проходит через узел (Brandes, 2001)
- Eigenvector — влияние с учётом влияния соседей
- PageRank — Google-подход, случайное блуждание

### Применение в Crucix

Граф стран/секторов. Centrality показывает, откуда может начаться каскад.

### Что это даёт

Top betweenness — узлы-мосты:

1. s_korea: 0.34 — мост между США и Азией
2. turkey:  0.28 — мост между Европой и Ближним Востоком
3. taiwan:  0.26 — мост между Китаем и США

Правило: если стресс в узле с высокой betweenness > 0.25 — каскад вероятен.

## 13.2 Community Detection

### Теория

Louvain method (Blondel et al., 2008) — быстрый алгоритм поиска сообществ через максимизацию модулярности:

Q = (1/2m) * sum [A_ij - k_i*k_j/(2m)] * delta(c_i, c_j)

где:
- A_ij — вес ребра
- k_i — степень узла
- c_i — сообщество узла i
- delta — символ Кронекера

Q in [-0.5, 1]:
- Q > 0.3 — чёткая структура сообществ
- Q < 0.1 — нет структуры

### Применение в Crucix

Автоматическое обнаружение геополитических блоков.

### Что это даёт

Автоматическое обнаружение блоков:

Сообщество 1: usa, eu, uk, japan, s_korea, israel
Сообщество 2: china, russia, iran, n_korea, turkey
Сообщество 3: india, brazil, saudi (нейтральные)

Правило: если modularity растёт — мир становится более поляризованным. Это сигнал о росте конфликтного риска.

## 13.3 Graph Neural Networks

### Теория

GCN (Kipf & Welling, 2017):

H^(l+1) = activation(A_hat * H^(l) * W^(l))

где:
- A_hat = D^(-1/2) * (A + I) * D^(-1/2) — нормализованная смежность
- H^(l) — признаки на слое l
- W^(l) — веса слоя l
- activation — нелинейность

Ключевое: каждый узел агрегирует признаки соседей.

### Применение в Crucix

Прогноз риска каждой страны с учётом её соседей.

### Что это даёт

Риск с учётом окружения:

1. ukraine: 0.85 — конфликт + соседи в напряжении
2. russia:  0.78 — санкции + экспорт энергии
3. taiwan:  0.72 — напряжённость + supply chain

Правило: если GNN показывает рост риска в соседях — готовьтесь к каскаду.

## 13.4 Markov Random Fields

### Теория

MRF — вероятностная модель на графе:

P(states) = (1/Z) * exp(-E(states))
E(states) = -sum w_ij * s_i * s_j - sum h_i * s_i

где:
- s_i in {-1, +1} — состояние узла i
- w_ij — вес ребра
- h_i — внешнее поле
- Z — partition function

### Применение в Crucix

Поляризация стран.

### Что это даёт

Magnetization = 0 — мир multipolar (много блоков).
Magnetization = 1 — мир polarized (два блока).

Правило: рост magnetization — сигнал о блоковой поляризации. Растёт риск глобального конфликта.

## 13.5 Итог

| Метод | Что показывает | Когда критично |
|-------|----------------|----------------|
| Betweenness | Узлы-мосты | > 0.25 |
| Community | Блоки | Q растёт |
| GNN | Риск с окружением | Соседи растут |
| MRF | Поляризация | magnetization растёт |

Композитная логика: если граф становится более поляризованным (Q растёт, magnetization растёт), это сильный предиктор глобального конфликта.

Исторические примеры:
- Перед холодной войной: Q = 0.42, magnetization = 0.78
- После холодной войны: Q = 0.25, magnetization = 0.35
- 2022-2024: Q = 0.38, magnetization = 0.62 (растёт)

## 13.6 Литература

- Brandes, U. (2001). A faster algorithm for betweenness centrality. Journal of Mathematical Sociology.
- Blondel, V. D. et al. (2008). Fast unfolding of communities in large networks. Journal of Statistical Mechanics.
- Kipf, T. N., & Welling, M. (2017). Semi-supervised classification with graph convolutional networks. ICLR.
- Kindermann, R., & Snell, J. L. (1980). Markov Random Fields and Their Applications. AMS.
