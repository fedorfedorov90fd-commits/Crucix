# logistics-anomalies

## Описание
Анализатор логистических аномалий. Обнаружение накопления транспорта перед событием. Физические перемещения невозможно скрыть на уровне источника.

## Источники данных
- aviation.json — авиация (ADS-B)
- dark-ships.json — тёмные суда (AIS)
- ships.json — обычные суда (AIS)
- military-exercises.json — военные учения
- notam.json — закрытие воздушного пространства
- infrastructure.json — 114 объектов критической инфраструктуры

## Класс-вычислитель
Файл: apis/sources/logistics-anomalies.mjs
Алгоритм:
1. Базовая линия: медиана + MAD по числу событий в ячейках 150 км.
2. Робастный Z-score: (count - median) / (1.4826 * MAD). Порог 1.5.
3. Кластеризация: haversine радиус 200 км.

## Анализатор
Файл: scripts/analyzers/logistics-anomalies.mjs
Запуск: node scripts/analyzers/logistics-anomalies.mjs
Результат: data/analytics/specialist/logistics-anomalies.json

## Эндпоинты
- GET /api/layers/logistics-anomalies
- GET /api/layers/logistics-anomalies/stats
- GET /api/layers/logistics-anomalies/anomalies
- GET /api/layers/logistics-anomalies/clusters
- GET /api/layers/logistics-anomalies/by-type
- GET /api/layers/logistics-anomalies/by-region
- GET /api/layers/logistics-anomalies/top
- GET /api/layers/logistics-anomalies/featurecollection

## Параметры запроса
- ?n=10 — количество
- ?minScore=2.0 — минимальный балл
- ?type=dark-ship — фильтр по типу
- ?region=Europe — фильтр по региону
- ?level=critical — уровень (critical/high/medium/low)

## Уровни
critical >= 5, high >= 3, medium >= 2, low >= 1.5.

## Цвета
critical #7f1d1d, high #dc2626, medium #f97316, low #eab308.

## Стратегическое назначение
Логистика — физический процесс. Даже при зачистке медиа-поля данные ADS-B, AIS, NOTAM остаются. Аномалия логистики — ранний признак подготовки операции.
