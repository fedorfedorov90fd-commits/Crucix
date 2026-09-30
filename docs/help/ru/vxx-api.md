# vxx-api

## Описание
API-модуль vxx-api предоставляет данные о VXX (iPath Series B S&P 500 VIX Short-Term Futures ETN). Отслеживает краткосрочные фьючерсы на VIX. Растёт при росте волатильности, теряет в цене на контанго (decay ~5-10% в месяц).

Версия 3.0.0 (19.09.2026). Контракт CRUCIX v2 (Layer). Basket-loader v2.0.0.

## Эндпоинт
GET /api/layers/vxx

## Источники данных
- data/basket/vxx.json — v1 (series + meta) или legacy (массив)
- data/basket/vix.json — v1 (points) или legacy (массив)

Сборщик: scripts/collectors/collect-vxx.mjs.

## Режимы волатильности
- calm — менее 20 — Спокойствие — #22c55e
- normal — 20 до 30 — Норма — #84cc16
- elevated — 30 до 45 — Повышенная — #eab308
- stress — 45 до 60 — Стресс — #f97316
- panic — более 60 — Паника — #dc2626

## Форматы ответа
- json (по умолчанию) — FeatureCollection + series + stats + trends + volatility + decay + vix_comparison + current_regime
- csv — таблица
- series — только временной ряд
- stats — агрегированная статистика
- raw — сырые точки
- report — текстовый отчёт

## Фильтры
- ?regime=calm|normal|elevated|stress|panic
- ?since=YYYY-MM-DD и ?until=YYYY-MM-DD
- ?min_value=N и ?max_value=N
- ?limit=N и ?top=N
- ?sort=date-asc|date-desc|value-asc|value-desc

## Служебные подпути
- GET / — сводка
- GET /health — health-check (online/degraded)
- GET /status — состояние и последнее значение
- GET /stats — агрегированная статистика
- GET /count — только числа
- GET /series — временной ряд
- GET /latest — последнее значение
- GET /recent?since= — свежие точки
- GET /top?n=N — топ по value
- GET /bottom?n=N — антитоп
- GET /regimes — группировка по режимам
- GET /current-regime — текущий режим
- GET /calm — точки calm
- GET /stress — точки stress + panic
- GET /volatility — волатильность VXX
- GET /decay — decay (roll cost)
- GET /contango — индикатор контанго (VXX vs VIX)
- GET /backwardation — индикатор бэквордации
- GET /vix-comparison — сравнение VXX и VIX
- GET /distribution — распределение по бакетам
- GET /timeline — динамика по дням
- GET /trends — тренды (7 vs 7)
- GET /anomalies — аномалии (z-score > 2)
- GET /signals — торговые сигналы
- GET /compare?dates=a,b,c — сравнение точек
- GET /filter-presets — готовые фильтры
- GET /config — конфигурация
- GET /export — текстовый отчёт
- GET /reset-cache — сброс кэша
- GET /featurecollection — GeoJSON (VIX-точки)
- GET /render — рендер-конфиг
- GET /builtin — встроенный fallback (25 точек)

## Пример ответа
Ответ содержит поля: type (FeatureCollection), series (массив точек date+value+regime), stats (count, last_value, last_regime), current_regime (regime, value, date).

## Связанные модули
- Сборщик: scripts/collectors/collect-vxx.mjs
- Слой карты: dashboard/public/geo-map/js/layers.js (id: vxx, категория: finance)
- Basket-loader: apis/sources/lib/basket-loader.mjs

## Местоположение
- API: apis/sources/vxx-api.mjs
- Help: docs/help/ru/vxx-api.md
- Сборщик: scripts/collectors/collect-vxx.mjs
- Basket: data/basket/vxx.json

## Статус
Версия: 3.0.0
Обновлено: 2026-09-19
