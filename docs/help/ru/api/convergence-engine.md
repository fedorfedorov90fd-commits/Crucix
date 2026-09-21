# convergence-engine

## Описание
Универсальный движок схождения сигналов. Читает все файлы из 8 категорий data/analytics/ (detector, forecast, semantic, flow, market, specialist, index, space) и ищет регионы, где несколько независимых категорий одновременно дают сигнал.

## Уникальное преимущество
World Monitor имеет convergence только по RSS (новости). Crucix — по всем 59 анализаторам из 30 наук. Это даёт более надёжные схождения: одно измерение может ошибаться, четыре независимых — нет.

## Алгоритм
1. Читаем все analytics-файлы (кроме _manifest, _catalog, _lineage, _health, _schema).
2. Для каждого модуля вычисляем сигнал (log-нормализация от числа находок).
3. Группируем по регионам/странам.
4. Для каждого региона считаем уникальные категории.
5. Схождение фиксируется при 3+ категориях.
6. Оценка: sqrt(categories) × weightedSignal × diversityBoost.

## Веса категорий
- detector 1.0, forecast 1.0 — первичные
- semantic 0.8, market 0.8 — подтверждающие
- flow 0.7, specialist 0.7 — поддерживающие
- index 0.6, space 0.5 — фоновые

## Пороги
- minCategories = 3 (минимум для схождения)
- minSignal = 0.05 (минимум сигнала от модуля)
- Уровни: critical >= 2.5, high >= 1.5, medium >= 0.8, low < 0.8

## Файлы
- scripts/analyzers/convergence-engine.mjs — анализатор
- apis/sources/convergence-engine.mjs — класс ConvergenceEngine
- apis/sources/convergence-engine-api.mjs — API-модуль
- data/analytics/specialist/convergence-engine.json — результат

## Эндпоинты
- GET /api/layers/convergence-engine
- GET /api/layers/convergence-engine/stats
- GET /api/layers/convergence-engine/convergences
- GET /api/layers/convergence-engine/top
- GET /api/layers/convergence-engine/by-region/:region
- GET /api/layers/convergence-engine/by-category/:cat
- GET /api/layers/convergence-engine/modules
- GET /api/layers/convergence-engine/featurecollection

## Параметры
- ?n=10 — количество
- ?minScore=1.5 — минимальный convergenceScore
- ?minCategories=4 — минимум категорий
- ?level=critical — уровень
- ?category=detector — фильтр по категории

## Запуск
node scripts/analyzers/convergence-engine.mjs

## Стратегическое назначение
Уникальная фича Crucix. Конкуренты с convergence по RSS не имеют научного ядра. Crucix соединяет 59 анализаторов из 30 наук.
