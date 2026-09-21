# narrative-drift

## Описание
Анализатор расхождения слов и действий. Сопоставляет официальные заявления стран с фактическими физическими данными. Расхождение — признак подготовки операции или сокрытия.

## Источники (10)
- news.json, gdelt_news.json — новостной поток
- interfax.json, ria.json, tass.json — российские источники
- bbc.json — западный источник
- acled.json — конфликты
- military-exercises.json — учения
- notam.json — закрытие воздушного пространства
- gps-jamming.json — РЭБ

## Класс
Файл: apis/sources/narrative-drift.mjs

Метод computeDrift():
1. Токенизация заявлений (стоп-слова удаляются).
2. Сопоставление тем заявлений с типами действий (THEME_ACTIONS).
3. Коэффициент расхождения: imbalance * themeFactor.
4. imbalance = actions / max(statements, 1).
5. themeFactor = 1 + themeConflict * 0.5.

## Анализатор
Файл: scripts/analyzers/narrative-drift.mjs
Запуск: node scripts/analyzers/narrative-drift.mjs
Результат: data/analytics/specialist/narrative-drift.json

## Эндпоинты
- GET /api/layers/narrative-drift
- GET /api/layers/narrative-drift/stats
- GET /api/layers/narrative-drift/drifts
- GET /api/layers/narrative-drift/by-country
- GET /api/layers/narrative-drift/top
- GET /api/layers/narrative-drift/featurecollection

## Параметры
- ?n=10 — количество
- ?minScore=1.5 — минимальный балл
- ?level=critical — уровень
- ?country=USA — страна

## Уровни
critical >= 3, high >= 1.5, medium >= 0.7, low < 0.7.

## Цвета
critical #7f1d1d, high #dc2626, medium #f97316, low #eab308.

## Стратегическое назначение
Объективный анализ расхождений для ЛЮБОЙ стороны. Западные платформы не могут иметь этот модуль, потому что он вскроет их собственные расхождения.
