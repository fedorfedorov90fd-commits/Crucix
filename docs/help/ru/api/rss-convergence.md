# rss-convergence

## Описание
Обнаружение convergent stories — новостных тем, которые независимо подхватили 5+ источников в окне 6 часов. Мультиисточниковое подтверждение значимости.

## Отличие от смежных модулей
- adaptive-news-clustering — кластеризация по смыслу БЕЗ времени.
- source-coordination — координация (2+ источника в окне 30 минут, sim>0.7). Аномалия.
- rss-convergence — массовость (5+ источников в окне 6 часов, sim>0.5). Норма.

## Источники (4 файла, ~574 записи)
- rss-latest.json — 500 записей (главный RSS-поток)
- rss.json — 34 записи
- newsapi-latest.json — 10 записей
- newsapi-real.json — 30 записей

## Класс
Файл: apis/sources/rss-convergence.mjs
Алгоритм:
1. Токенизация заголовков и описаний (ru+en стоп-слова).
2. TF-IDF вектора по всем статьям.
3. Кластеризация: cosine similarity > 0.5.
4. Окно 6 часов от самой старой статьи кластера.
5. Порог: минимум 5 уникальных источников.
6. Оценка: sqrt(sources) × avgSim × (window / timeSpan).

## Анализатор
Файл: scripts/analyzers/rss-convergence.mjs
Запуск: node scripts/analyzers/rss-convergence.mjs
Результат: data/analytics/semantic/rss-convergence.json

## Эндпоинты
- GET /api/layers/rss-convergence
- GET /api/layers/rss-convergence/stats
- GET /api/layers/rss-convergence/stories
- GET /api/layers/rss-convergence/top
- GET /api/layers/rss-convergence/by-source
- GET /api/layers/rss-convergence/story/:id
- GET /api/layers/rss-convergence/features

## Параметры
- ?n=10 — количество
- ?minScore=3 — минимальный convergenceScore
- ?minSources=10 — минимум источников
- ?level=critical — уровень
- ?source=tass — источник входит в story

## Уровни
critical >= 5, high >= 3, medium >= 1.5, low < 1.5.

## Стратегическое назначение
Mass media convergence — классический сигнал значимости. Если 10 источников подхватили одну тему за 6 часов — она важна. Это то, что есть у World Monitor (RSS convergence), и теперь есть у Crucix — но поверх 574 записей из 15+ источников.
