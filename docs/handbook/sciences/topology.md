# Глава 14. Топология

Топология изучает форму пространств независимо от масштаба. В Crucix — форма многомерного облака состояний системы.

Topological Data Analysis (TDA) — набор методов для извлечения топологических признаков из данных.

Crucix использует:

1. Vietoris-Rips filtration — построение симплициального комплекса
2. Persistent homology — отслеживание топологических признаков

## 14.1 Vietoris-Rips Filtration

### Теория

Для облака точек X = {x1, ..., xn} и радиуса epsilon строим симплициальный комплекс:

- Вершины: все точки
- Рёбра: пары с d(x_i, x_j) <= epsilon
- Треугольники: тройки, где все рёбра есть
- И так далее

Filtration: последовательность комплексов при росте epsilon.

### Применение в Crucix

Каждый sweep — точка в 5-10 мерном пространстве метрик. Filtration показывает структуру.

### Что это даёт

Число компонент и циклов при разных epsilon:

epsilon = 0.5: components=45, loops=0    (все точки изолированы)
epsilon = 1.5: components=12, loops=3    (несколько кластеров)
epsilon = 3.0: components=3, loops=8     (3 кластера + циклы)
epsilon = 5.0: components=1, loops=2     (всё слилось)

Ключевое: если при некотором epsilon есть циклы — данные имеют нетривиальную структуру (не просто кластеры).

## 14.2 Persistent Homology

### Теория

Для каждого топологического признака (компонента, цикл) отслеживаем:

- Birth: epsilon, при котором признак появился
- Death: epsilon, при котором признак исчез
- Persistence: death - birth

Большая persistence = значимый признак (не шум).

### Применение в Crucix

Определение значимых структур в данных.

### Что это даёт

Значимые топологические структуры:

H0 (components):
  Total: 1 bar (birth=0, death=2.3, persistence=2.3)

H1 (cycles):
  Total: 8 bars
  Significant (persistence > 0.5): 2

  Bar 1: birth=1.5, death=3.2, persistence=1.7 (значимый)
  Bar 2: birth=2.1, death=3.8, persistence=1.7 (значимый)

Has topological structure: TRUE

Правило: если hasTopologicalStructure — данные имеют скрытую структуру, не просто кластеры. Это может означать циклические режимы.

## 14.3 Итог

TDA даёт непараметрическое описание структуры данных. В отличие от кластеризации (k-means), TDA не предполагает число кластеров.

Правило:
- 2+ значимых цикла — циклические режимы
- 0 циклов, 1 компонента — однородные данные
- Много компонент — сильная кластеризация

## 14.4 Литература

- Edelsbrunner, H., & Harer, J. (2010). Computational Topology: An Introduction. AMS.
- Carlsson, G. (2009). Topology and data. Bulletin of the AMS.
- Ghrist, R. (2008). Barcodes: The persistent topology of data. Bulletin of the AMS.
