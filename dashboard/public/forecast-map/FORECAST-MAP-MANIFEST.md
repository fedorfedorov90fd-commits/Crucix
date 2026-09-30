# FORECAST MAP — МАНИФЕСТ СОСТОЯНИЯ

**Дата:** 2026-09-30
**Версия карты:** 1.1
**Расположение:** `/dashboard/public/forecast-map/`
**Сервер:** `http://localhost:3117/forecast-map/`
**Режим автономии:** FULL ISOLATION (Nygard 2007, Bulkhead Pattern)
**Failure domain:** 1 (сбой этой карты не влияет на 4 остальные)

---

## 1. НАЗНАЧЕНИЕ И МЕСТО В ЭКОСИСТЕМЕ CRUCIX

### 1.1. Что такое Crucix — экосистема из 5 карт

Crucix — геополитическая OSINT-платформа. Она состоит из **5 автономных карт**, каждая визуализирует свой класс данных:

1. **Event Map** (`/event-map/`) — точечные события на карте (митинги, атаки, инциденты). 84 слоя, маркеры.
2. **Metrics Map** (`/metrics-map/`) — количественные индикаторы по странам (экономика, финансы, ESG, кибер, энергетика). 75 слоёв, choropleth.
3. **Semantic Map** (`/semantic-map/`) — семантический анализ текстов (тональность, нарративы, дезинформация). 35 слоёв.
4. **Forecast Map** (`/forecast-map/`) — вероятностные прогнозы (рецессия, конфликты, риски). **16 слоёв**. **ЭТА КАРТА.**
5. **Network Map** (`/network-map/`) — графы связей (кибер-сети, торговля, финансы, миграция). 12 слоёв, SVG-граф.

### 1.2. Зачем именно 5 карт, а не одна

Пять карт — это реализация принципа **Separation of Concerns** (Dijkstra 1974). Каждый класс данных требует собственной модели визуализации:

- **События** → позиция + цвет (точечные маркеры). Канал: Position.
- **Количественные индикаторы** → позиция (страна) + интенсивность цвета (choropleth). Канал: Position + Color intensity.
- **Семантика** → позиция + категориальный цвет + форма. Канал: Position + Hue + Shape.
- **Вероятности** → позиция + цвет + прозрачность (opacity). Канал: Position + Color intensity + Transparency. **ЭТО КАНАЛ FORECAST MAP.**
- **Связи** → топология графа (force-directed). Канал: Position (force) + Shape.

Попытка объединить всё в одну карту нарушила бы **принцип сепарабельности каналов** (Munzner 2014). Разделение на 5 карт — научно обоснованное решение, а не организационное удобство.

### 1.3. Что делает Forecast Map

Forecast Map визуализирует **вероятностные прогнозы по 90 странам мира**. Каждый слой — это прогноз определённого риска:

- Макроэкономика: вероятность рецессии, вероятность экономического коллапса
- Финансы: вероятность банковского кризиса, вероятность валютного кризиса
- Конфликты: вероятность вооружённого конфликта, вероятность эскалации
- Политика: вероятность смены режима, вероятность политического кризиса
- Энергетика: вероятность энергетического кризиса
- Кибер: вероятность крупной кибератаки
- Здоровье: вероятность пандемии
- Миграция: вероятность миграционного всплеска
- Торговля: вероятность торговой войны
- Дипломатия: вероятность дипломатического кризиса
- Дефолт: вероятность суверенного дефолта
- Инфраструктура: вероятность нарушения цепочек поставок

Итого: **16 слоёв в 12 категориях**.

### 1.4. Уникальная особенность: Probability-заливка (Cressie 1993)

Forecast Map — единственная карта в экосистеме, использующая **двойное кодирование**:

1. **Цвет (Color intensity)** — класс вероятности (5 классов, manual breaks [20, 40, 60, 80]).
2. **Прозрачность (Opacity)** — уровень уверенности модели: `opacity = 0.4 + 0.5 × confidence`.

Где `confidence` — уверенность прогноза от 0.0 до 1.0:
- `confidence = 0.0` → `opacity = 0.4` (минимальная видимость, низкая уверенность).
- `confidence = 1.0` → `opacity = 0.9` (максимальная видимость, высокая уверенность).

Это позволяет пользователю одновременно видеть **что** прогнозируется (цвет) и **насколько можно доверять** прогнозу (прозрачность). Темные, насыщенные области — высоковероятные риски с высокой уверенностью. Бледные области — неопределённость.

Методологическая основа: Cressie 1993, «Statistics for Spatial Data» — использование opacity для визуализации неопределённости в пространственных данных.

### 1.5. Отличия от Metrics Map

- **Forecast Map:** каждая страна — вероятность события (0–100%) + уровень уверенности (opacity). 16 слоёв. Канал: Position + Color intensity + Transparency.
- **Metrics Map:** каждая страна — числовой индикатор. 75 слоёв. Канал: Position + Color intensity.

Forecast Map оперирует вероятностями будущих событий, Metrics Map — текущими количественными показателями. Это принципиально разные типы данных.

---

## 2. СТРУКТУРА ПАПКИ (20 обязательных файлов)

```
forecast-map/
├── index.html                          ← точка входа, 16 локальных скриптов
├── manifest.json                       ← паспорт (mapType=forecasts, layers=16, cross_map=0)
├── FORECAST-MAP-MANIFEST.md            ← ЭТОТ ФАЙЛ (полное описание состояния)
├── ARCHITECTURE.md                     ← техническая спецификация DAG загрузки
├── AUTONOMY-CHARTER.md                 ← устав R1–R6 автономии
├── css/
│   └── forecast-map.css                ← ЕДИНСТВЕННЫЙ CSS (тёмная тема + probability легенда с opacity)
├── js/                                  ← 15 файлов, порядок загрузки критичен
│   ├── core.js                         ← язык, уведомления, глобальные переменные
│   ├── countries.js                    ← массив 90 стран с координатами и статусами
│   ├── layers.js                       ← 16 слоёв + панель + toggle-логика
│   ├── maps-config.js                  ← конфигурация: manual breaks, probability палитры
│   ├── forecast-adapter.js             ← probability → choropleth (с opacity = confidence)
│   ├── map-controls.js                ← Leaflet init, Jenks DP, ColorBrewer, GVF, legend
│   ├── markers.js                      ← маркеры (для слоёв с точечными прогнозами)
│   ├── forecast-map.js                ← ForecastMap.init() — оркестратор
│   ├── copy-data.js                    ← снапшот состояния (~200–400 КБ)
│   ├── heat-timeline.js               ← тепловая карта, временная шкала
│   ├── ssi.js                          ← Strategic Stress Index
│   ├── refresh.js                      ← автообновление данных
│   ├── cii.js                          ← Country Instability Index (fallback)
│   ├── logger.js                       ← логирование с панелью
│   └── init.js                         ← запуск карты
├── data/
│   └── world.geojson                  ← ЛОКАЛЬНАЯ копия границ (252 КБ)
└── presets/
    └── presets.json                   ← 5 пресетов с уникальными ключами
```

---

## 3. DAG ЗАГРУЗКИ (15 шагов, порядок критичен)

| # | Файл | Что делает | Зависит от |
|---|------|------------|------------|
| S01 | inline `<script>` | `window.CrucixMap = {mapType:'forecasts'}` | — |
| S02 | `js/core.js` | `LANG_DATA`, `showNotification`, `setLanguage` | CrucixMap |
| S03 | `js/countries.js` | `ALL_COUNTRIES[90]` | — |
| S04 | `js/layers.js` | `allLayers[16]` + панель слоёв | — |
| S05 | `js/maps-config.js` | `MAP_TYPES`, `COLOR_SCHEMES`, `PROBABILITY_BREAKS` | allLayers |
| S06 | `js/forecast-adapter.js` | `ForecastAdapter.convert()` — probability → choropleth с opacity | maps-config |
| S07 | `js/map-controls.js` | `loadCountryBoundaries`, `applyChoropleth`, `applyProbabilityFill` | Leaflet, countries |
| S08 | `js/markers.js` | `generateAllMarkers`, `updateMarkers`, `renderLayerPanel` | allLayers, map |
| S09 | `js/forecast-map.js` | `ForecastMap.init()` — оборачивает `loadLayer()` | forecast-adapter, map-controls |
| S10 | `js/copy-data.js` | `copyAllData` — снапшот (~200–400 КБ) | — |
| S11 | `js/heat-timeline.js` | `toggleHeat`, `toggleTimeline` | map |
| S12 | `js/ssi.js` | `calculateSSI`, `updateLegend` | countries |
| S13 | `js/refresh.js` | `startAutoRefresh`, `refreshMapData` | — |
| S14 | `js/cii.js` | `updateCII` с fallback | countries, map-controls |
| S15 | `js/logger.js` + `js/init.js` | `CrucixLogger` + `loadData` → `loadCountryBoundaries` → `ForecastMap.init()` | все выше |

---

## 4. ФУНКЦИОНАЛЬНАЯ МАТРИЦА

| Файл | Ответственность | НЕ делает |
|------|-----------------|-----------|
| `core.js` | Язык, уведомления, глобальные переменные | Логику карты |
| `countries.js` | Массив 90 стран с координатами и статусами | UI |
| `layers.js` | 16 слоёв + панель + toggle-логика | Загрузку данных |
| `maps-config.js` | Конфигурация: manual breaks [20,40,60,80], probability палитры | Рендеринг |
| `forecast-adapter.js` | probability → choropleth с opacity = confidence | Классификацию чисел |
| `map-controls.js` | Leaflet init, `applyProbabilityFill`, Jenks, GVF, legend | Бизнес-логику |
| `markers.js` | Маркеры для точечных прогнозов | Choropleth |
| `forecast-map.js` | Decision tree: probability / marker | Рендеринг |
| `copy-data.js` | Снапшот (~200–400 КБ) | — |
| `heat-timeline.js` | Тепловая карта, временная шкала | — |
| `ssi.js` | Strategic Stress Index | — |
| `refresh.js` | Автообновление данных | — |
| `cii.js` | Country Instability Index (fallback) | — |
| `logger.js` | Логирование с панелью | — |
| `init.js` | Запуск карты | — |

---

## 5. 16 СЛОЁВ — РАСПРЕДЕЛЕНИЕ

| Категория | Слоёв | Тип | Палитра |
|-----------|-------|------|---------|
| macroeconomics | 2 | probability | YlOrRd5 |
| finance | 2 | probability | YlOrRd5 |
| conflicts | 2 | probability | YlOrRd5 |
| political | 2 | probability | YlOrRd5 |
| energy | 1 | probability | YlOrRd5 |
| cyber | 1 | probability | YlOrRd5 |
| health | 1 | probability | YlOrRd5 |
| migration | 1 | probability | YlOrRd5 |
| trade | 1 | probability | YlOrRd5 |
| diplomatic | 1 | probability | YlOrRd5 |
| sovereign | 1 | probability | YlOrRd5 |
| supply-chain | 1 | probability | YlOrRd5 |
| **ИТОГО** | **16** | **16 probability** | **YlOrRd5** |

Все 16 слоёв — типа `probability`. Все используют manual breaks [20, 40, 60, 80] и палитру YlOrRd5 (sequential, от жёлтого к красному).

---

## 6. КАК РАБОТАЕТ PROBABILITY-ЗАЛИВКА

### 6.1. Алгоритм (Cressie 1993)

При клике на слой:
1. `loadLayer(layerId)` → `ForecastMap.interceptLoad(layerId)`.
2. `vizType === 'probability'` → `loadProbabilityLayer(layer)`.
3. `fetch('/api/layers/<id>/featurecollection')`.
4. Если 404 → `renderProbabilityFallback(layer)`:
   - Детерминированный seed по `layer.id`.
   - Для каждой из 90 стран:
     - `probability` = base(status) + noise(seed), домен 0–100.
     - `confidence` = base_confidence(status) + noise(seed), домен 0.0–1.0.
   - Классификация: 5 классов, manual breaks [20, 40, 60, 80].
   - `applyProbabilityFill()`:
     - Цвет = класс вероятности (YlOrRd5).
     - Прозрачность = `0.4 + 0.5 × confidence`.
   - `applyChoropleth()` закрашивает страны с учётом opacity.
   - Логирует: `[Probability] layer=recession, country=Украина, prob=84.02, conf=0.72, opacity=0.76`.
5. Если API работает — данные применяются напрямую.

### 6.2. Формула opacity

```
opacity = 0.4 + 0.5 × confidence
```

| confidence | opacity | Визуально |
|------------|---------|-----------|
| 0.0 | 0.40 | Бледный, едва виден |
| 0.2 | 0.50 | Тусклый |
| 0.4 | 0.60 | Средний |
| 0.6 | 0.70 | Заметный |
| 0.8 | 0.80 | Яркий |
| 1.0 | 0.90 | Насыщенный |

### 6.3. Классы вероятности

| Класс | Диапазон | Цвет | Интерпретация |
|-------|----------|------|---------------|
| 1 | 0–20% | Жёлтый | Низкая вероятность |
| 2 | 20–40% | Оранжевый | Умеренная вероятность |
| 3 | 40–60% | Тёмно-оранжевый | Высокая вероятность |
| 4 | 60–80% | Красный | Очень высокая вероятность |
| 5 | 80–100% | Тёмно-красный | Критическая вероятность |

### 6.4. Popup для Forecast Map

```
┌─────────────────────────────────┐
│  Страна: Украина                │
│  Слой: Рецессия                 │
│  Вероятность: 84%               │
│  Класс: 5 (Критическая)         │
│  Уверенность модели: 72%        │
│  Opacity: 0.76                  │
│  Горизонт прогноза: 12 мес      │
│  Источник: AI-Forecast Model    │
│  Метод: Bayesian + Monte Carlo  │
└─────────────────────────────────┘
```

### 6.5. Легенда

Легенда Forecast Map уникальна — показывает **два измерения**:

1. **Цветовая шкала** — 5 классов вероятности (0–20 / 20–40 / 40–60 / 60–80 / 80–100).
2. **Шкала opacity** — от 0.4 (низкая уверенность) до 0.9 (высокая уверенность).

Легенда рисуется в два ряда:
- Верхний ряд: 5 цветовых классов с порогами.
- Нижний ряд: градиент opacity от бледного к насыщенному.

---

## 7. АВТОНОМНОСТЬ (R1–R6)

**R1:** Ни один `<script>`/`<link>`/`<fetch>` не ходит в `../*`.

**R2:** `world.geojson` лежит в `data/`, `fetch('data/world.geojson')`.

**R3:** `layers.js` содержит ровно 16 слоёв Forecast Map. Чужих слоёв — 0.

**R4:** `maps-config.js`, `presets.json` — только для Forecast Map.

**R5:** `manifest.json` → `local_cross_map: 0`, `failure_domain: 1`.

**R6:** Сбой в Forecast Map не влияет на Event/Metrics/Semantic/Network.

---

## 8. ЧЕК-ЛИСТ ВЕРИФИКАЦИИ

```bash
cd "/dashboard/public/forecast-map"

# R1: 0 cross-map зависимостей
grep -rn '\.\./' index.html js/*.js | grep -v 'AUTONOMY\|manifest'

# R3: 16 слоёв
grep -c 'id:' js/layers.js

# R3: 0 дубликатов
grep -o 'id: "[^"]*"' js/layers.js | sort | uniq -d

# R2: локальный geojson
grep -n "data/world.geojson" js/map-controls.js
ls -la data/world.geojson

# Probability: формула opacity
grep -n "opacity" js/forecast-adapter.js
grep -n "0.4 + 0.5" js/forecast-adapter.js

# Manual breaks
grep -n "20, 40, 60, 80" js/maps-config.js

# Порядок скриптов
grep -o 'src="[^"]*"' index.html | grep -v "http" | sort
```

---

## 9. FORECAST-ADAPTER — ДЕТАЛЬНО

### 9.1. Назначение

`forecast-adapter.js` конвертирует probability-данные (вероятность + уверенность) в choropleth-формат с двойным кодированием (цвет + opacity).

### 9.2. Параметры

```javascript
ForecastAdapter.convert(layerId, forecastData, countries)
```

### 9.3. Spatial Proxies

| Proxy | Страны | Применение |
|-------|--------|------------|
| developed_markets | развитые экономики | рецессия, банковский кризис |
| emerging_markets | развивающиеся рынки | валютный кризис, дефолт |
| conflict_zones | зоны конфликтов | вооружённый конфликт, эскалация |
| all_countries | все 90 стран | общий прогноз |
| energy_producers | производители энергии | энергетический кризис |
| trade_partners | ключевые торговые партнёры | торговая война |

### 9.4. Источники прогнозов

| Источник | Тип | Применение |
|----------|------|------------|
| ai-forecasts | ML-модель (Bayesian + Monte Carlo) | рецессия, конфликты, дефолт |
| central-bank | Прогнозы центральных банков | инфляция, процентные ставки |
| social-briefing | Социальные брифинги | миграция, протесты |
| social-briefing-engine | Расширенный движок брифингов | политические кризисы |

### 9.5. Трансформации

| Трансформация | Что делает |
|---------------|------------|
| probability_score | прямое значение вероятности (0–100) |
| confidence_weighted | вероятность × уверенность |
| horizon_adjusted | корректировка по горизонту прогноза |

---

## 10. ПАЛИТРЫ И ВИЗУАЛИЗАЦИЯ

### 10.1. Палитра YlOrRd5

Sequential, от жёлтого к тёмно-красному. 5 цветов:
1. `#ffffb2` — жёлтый (0–20%)
2. `#fecc5c` — светло-оранжевый (20–40%)
3. `#fd8d3c` — оранжевый (40–60%)
4. `#f03b20` — красный (60–80%)
5. `#bd0026` — тёмно-красный (80–100%)

### 10.2. Manual breaks

Все 16 слоёв используют manual breaks `[20, 40, 60, 80]`:
- Класс 1: 0–20% — низкая вероятность.
- Класс 2: 20–40% — умеренная.
- Класс 3: 40–60% — высокая.
- Класс 4: 60–80% — очень высокая.
- Класс 5: 80–100% — критическая.

Обоснование: пороги 20/40/60/80 — экспертные пороги уверенности для вероятностных прогнозов. Равномерные интервалы по 20% обеспечивают чёткую интерпретацию.

### 10.3. Двойное кодирование

```
┌──────────────────────────────────────────┐
│  Цвет → класс вероятности (5 классов)    │
│  Opacity → уверенность модели (0.4–0.9)  │
│                                          │
│  Жёлтый + бледный = низкий риск,         │
│  но модель не уверена                    │
│                                          │
│  Тёмно-красный + насыщенный =            │
│  критический риск, модель уверена       │
│                                          │
│  Тёмно-красный + бледный =               │
│  критический риск, но модель            │
│  не уверена (требует внимания)          │
└──────────────────────────────────────────┘
```

---

## 11. ТЕКУЩЕЕ СОСТОЯНИЕ (30.09.2026)

| Компонент | Статус |
|-----------|--------|
| 16 слоёв загружены | ✅ |
| Панель слоёв (12 категорий, 17 кнопок) | ✅ |
| Границы data/world.geojson локально | ✅ |
| ForecastMap оркестратор | ✅ |
| Forecast-adapter (probability → choropleth) | ✅ |
| Автономный fallback (без API) | ✅ |
| Manual breaks [20, 40, 60, 80] | ✅ |
| YlOrRd5 палитра | ✅ |
| Probability-легенда (цвет + opacity) | ⚠️ Требует проверки |
| CII fallback | ✅ |
| SSI | ✅ |
| Кнопка КОПИРОВАТЬ (~200–400 КБ) | ✅ |
| Кнопка «Включить все» | ⚠️ Требует проверки |
| Spatial proxy для 4 источников | ⚠️ Требует настройки |

---

## 12. ЧТО НУЖНО ДОДЕЛАТЬ

### 12.1. Формула opacity
Проверить, что `applyProbabilityFill` корректно вычисляет:
```javascript
opacity = 0.4 + 0.5 * confidence
```

Если формула не реализована — все страны будут с одинаковой прозрачностью, что лишает Forecast Map её уникального преимущества.

### 12.2. Легенда с opacity
Легенда должна показывать два измерения:
- Цветовая шкала (5 классов).
- Шкала opacity (градиент от 0.4 до 0.9).

### 12.3. Spatial proxies
Настроить spatial proxy для 4 источников прогнозов:
- `ai-forecasts` → developed_markets + emerging_markets.
- `central-bank` → developed_markets.
- `social-briefing` → all_countries.
- `social-briefing-engine` → all_countries.

### 12.4. Popup
Popup должен показывать: вероятность, уверенность, горизонт прогноза, источник, метод.

### 12.5. Кнопка «Включить все»
Проверить обработку всех 16 слоёв.

---

## 13. ГЛАВНЫЙ ФАЙЛ ДЛЯ ВВОДА В НОВЫЙ ЧАТ

Этот файл — единственный источник контекста для нового экземпляра ИИ. Прочитав его, ИИ сразу понимает:

- Что такое Forecast Map и её место в экосистеме из 5 карт.
- Какая структура папки (20 обязательных файлов).
- Как работает probability-заливка с двойным кодированием.
- Какие слои загружены и как они визуализируются.
- Какие задачи решены и что осталось доделать.
- Какие принципы автономии (R1–R6) и как их проверять.

---

## 14. ПРАВИЛА ПРОЕКТА

- **Правило №19:** не удалять недоделанные модули.
- **Правило №40:** удаление — только с разрешения пользователя.
- **Правило №36:** высокий уровень программирования, никаких упрощений.
- **Правило №10:** полная замена файлов, а не фрагменты.
- **Правило №27:** не урезать функционал. Новое ≥ старое.

---

## 15. ПОЛНЫЙ СПИСОК 16 СЛОЁВ — КАТАЛОГ

### 15.1. MACROECONOMICS — 2 слоя

**1. recession-probability** — «Рецессия»
- vizType: probability, method: manual, palette: YlOrRd5
- Breaks: [20, 40, 60, 80]
- Источник: AI-Forecast (Bayesian + Monte Carlo)
- Что показывает: вероятность рецессии в ближайшие 12 мес, %
- Spatial proxy: developed_markets + emerging_markets
- Горизонт: 12 месяцев

**2. economic-collapse** — «Экономический коллапс»
- vizType: probability, method: manual, palette: YlOrRd5
- Breaks: [20, 40, 60, 80]
- Источник: AI-Forecast
- Что показывает: вероятность системного экономического коллапса
- Spatial proxy: emerging_markets
- Горизонт: 24 месяца

### 15.2. FINANCE — 2 слоя

**3. banking-crisis** — «Банковский кризис»
- vizType: probability, method: manual, palette: YlOrRd5
- Breaks: [20, 40, 60, 80]
- Источник: AI-Forecast + Central Bank
- Что показывает: вероятность системного банковского кризиса
- Spatial proxy: developed_markets
- Горизонт: 6 месяцев

**4. currency-crisis** — «Валютный кризис»
- vizType: probability, method: manual, palette: YlOrRd5
- Breaks: [20, 40, 60, 80]
- Источник: AI-Forecast
- Что показывает: вероятность резкого обвала национальной валюты
- Spatial proxy: emerging_markets
- Горизонт: 3 месяца

### 15.3. CONFLICTS — 2 слоя

**5. armed-conflict-prob** — «Вероятность вооружённого конфликта»
- vizType: probability, method: manual, palette: YlOrRd5
- Breaks: [20, 40, 60, 80]
- Источник: AI-Forecast
- Что показывает: вероятность начала вооружённого конфликта
- Spatial proxy: conflict_zones
- Горизонт: 6 месяцев

**6. conflict-escalation** — «Эскалация конфликта»
- vizType: probability, method: manual, palette: YlOrRd5
- Breaks: [20, 40, 60, 80]
- Источник: AI-Forecast
- Что показывает: вероятность эскалации существующего конфликта
- Spatial proxy: conflict_zones
- Горизонт: 3 месяца

### 15.4. POLITICAL — 2 слоя

**7. regime-change-prob** — «Смена режима»
- vizType: probability, method: manual, palette: YlOrRd5
- Breaks: [20, 40, 60, 80]
- Источник: Social-Briefing-Engine
- Что показывает: вероятность смены политического режима
- Spatial proxy: all_countries
- Горизонт: 12 месяцев

**8. political-crisis-prob** — «Политический кризис»
- vizType: probability, method: manual, palette: YlOrRd5
- Breaks: [20, 40, 60, 80]
- Источник: Social-Briefing-Engine
- Что показывает: вероятность острого политического кризиса
- Spatial proxy: all_countries
- Горизонт: 6 месяцев

### 15.5. ENERGY — 1 слой

**9. energy-crisis-prob** — «Энергетический кризис»
- vizType: probability, method: manual, palette: YlOrRd5
- Breaks: [20, 40, 60, 80]
- Источник: AI-Forecast
- Что показывает: вероятность энергетического кризиса
- Spatial proxy: energy_producers
- Горизонт: 12 месяцев

### 15.6. CYBER — 1 слой

**10. cyber-attack-prob** — «Крупная кибератака»
- vizType: probability, method: manual, palette: YlOrRd5
- Breaks: [20, 40, 60, 80]
- Источник: AI-Forecast
- Что показывает: вероятность крупной кибератаки на критическую инфраструктуру
- Spatial proxy: all_countries
- Горизонт: 3 месяца

### 15.7. HEALTH — 1 слой

**11. pandemic-prob** — «Пандемия»
- vizType: probability, method: manual, palette: YlOrRd5
- Breaks: [20, 40, 60, 80]
- Источник: AI-Forecast
- Что показывает: вероятность новой пандемии
- Spatial proxy: all_countries
- Горизонт: 24 месяца

### 15.8. MIGRATION — 1 слой

**12. migration-surge-prob** — «Миграционный всплеск»
- vizType: probability, method: manual, palette: YlOrRd5
- Breaks: [20, 40, 60, 80]
- Источник: Social-Briefing
- Что показывает: вероятность массового миграционного всплеска
- Spatial proxy: all_countries
- Горизонт: 6 месяцев

### 15.9. TRADE — 1 слой

**13. trade-war-prob** — «Торговая война»
- vizType: probability, method: manual, palette: YlOrRd5
- Breaks: [20, 40, 60, 80]
- Источник: AI-Forecast
- Что показывает: вероятность эскалации торговой войны
- Spatial proxy: trade_partners
- Горизонт: 12 месяцев

### 15.10. DIPLOMATIC — 1 слой

**14. diplomatic-crisis-prob** — «Дипломатический кризис»
- vizType: probability, method: manual, palette: YlOrRd5
- Breaks: [20, 40, 60, 80]
- Источник: AI-Forecast
- Что показывает: вероятность острого дипломатического кризиса
- Spatial proxy: all_countries
- Горизонт: 3 месяца

### 15.11. SOVEREIGN — 1 слой

**15. sovereign-default-prob** — «Суверенный дефолт»
- vizType: probability, method: manual, palette: YlOrRd5
- Breaks: [20, 40, 60, 80]
- Источник: AI-Forecast + Central Bank
- Что показывает: вероятность дефолта государства
- Spatial proxy: emerging_markets
- Горизонт: 12 месяцев

### 15.12. SUPPLY-CHAIN — 1 слой

**16. supply-chain-disruption** — «Нарушение цепочек поставок»
- vizType: probability, method: manual, palette: YlOrRd5
- Breaks: [20, 40, 60, 80]
- Источник: AI-Forecast
- Что показывает: вероятность серьёзного нарушения цепочек поставок
- Spatial proxy: all_countries
- Горизонт: 6 месяцев

---

## 16. API-ЭНДПОИНТЫ

### 16.1. Probability-слои (16)
```
GET /api/layers/<layerId>/featurecollection
```

Ответ:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Украина",
        "probability": 84.02,
        "confidence": 0.72,
        "horizon": "12m",
        "source": "ai-forecasts",
        "method": "Bayesian + Monte Carlo"
      },
      "geometry": { ... }
    }
  ]
}
```

### 16.2. CII API
```
GET /api/cii-api
```

---

## 17. КОНТРАКТЫ МЕЖДУ КАРТАМИ

### 17.1. Навигация

```html
<a class="map-switch-btn" data-map="events" href="../event-map/">Events</a>
<a class="map-switch-btn" data-map="metrics" href="../metrics-map/">Metrics</a>
<a class="map-switch-btn" data-map="meanings" href="../semantic-map/">Semantic</a>
<a class="map-switch-btn" data-map="relations" href="../network-map/">Network</a>
<a class="map-switch-btn active" data-map="forecasts" href="./">Forecast</a>
```

### 17.2. Формат mapType

```html
<script>window.CrucixMap = { mapType: 'forecasts', name: 'Crucix — Forecast Map' };</script>
```

### 17.3. manifest.json

```json
{
  "mapType": "forecasts",
  "name": "Crucix — Forecast Map",
  "version": "1.1",
  "layers": 16,
  "categories": 12,
  "local_cross_map": 0,
  "failure_domain": 1
}
```

---

## 18. УРОВНИ ГОТОВНОСТИ

| Уровень | Критерий | Forecast Map |
|---------|----------|--------------|
| L1: Скелет | index.html + manifest.json + структура папок | ✅ |
| L2: Автономия | R1–R6, 0 cross-map, локальный geojson | ✅ |
| L3: Функционал | Probability-заливка, opacity, fallback, легенда | ⚠️ 80% (opacity формула, легенда, spatial proxies) |
| L4: Полировка | Help, диагностика, manifest, clean-archive | 🔄 В работе |

---

## 19. СЦЕНАРИИ ТЕСТИРОВАНИЯ

### 19.1. Сценарий 1. Базовая загрузка
- Открыть `http://localhost:3117/forecast-map/`.
- Ожидание: карта загружается, границы стран видны, панель слоёв с 12 категориями и 16 кнопками.

### 19.2. Сценарий 2. Probability-заливка
- Кликнуть на слой «Рецессия».
- Ожидание: страны закрашены с разной интенсивностью цвета и прозрачности.
- Страны с critical-статусом — более насыщенные (выше probability + confidence).
- Popup показывает: вероятность, уверенность, горизонт, источник.

### 19.3. Сценарий 3. Проверка opacity
- Активировать слой.
- В консоли проверить: `window.currentChoroplethConfig.opacity`.
- Ожидание: значения от 0.4 до 0.9, корреляция с confidence.

### 19.4. Сценарий 4. Автономный режим
- Остановить сервер.
- Открыть карту через file://.
- Ожидание: fallback генерирует probability + confidence для 90 стран.

### 19.5. Сценарий 5. Легенда
- Активировать слой.
- Проверить легенду: два ряда (цвет + opacity).
- Классы: 0–20 / 20–40 / 40–60 / 60–80 / 80–100.

---

## 20. ГЛОССАРИЙ

- **Probability** — вероятность события (0–100%).
- **Confidence** — уверенность модели в прогнозе (0.0–1.0).
- **Opacity** — прозрачность заливки. Формула: `0.4 + 0.5 × confidence`.
- **Horizon** — горизонт прогноза (3, 6, 12, 24 месяца).
- **Probability-заливка** — метод визуализации с двойным кодированием (цвет + прозрачность).
- **Cressie 1993** — методологическая основа: «Statistics for Spatial Data».
- **Manual breaks** — экспертные пороги [20, 40, 60, 80] для классификации вероятностей.
- **ForecastAdapter** — модуль конвертации probability-данных в choropleth с opacity.
- **Spatial proxy** — метод распределения прогнозов по странам.
- **Bayesian + Monte Carlo** — метод прогнозирования: байесовский вывод + симуляция Монте-Карло.

---

## 21. БЫСТРЫЙ СТАРТ

### 21.1. Если вы только начали работать с Forecast Map
1. Раздел 1 — что такое Forecast Map и её место в экосистеме.
2. Раздел 1.4 — уникальная особенность: probability-заливка.
3. Раздел 2 — структура папки.
4. Раздел 6 — как работает probability-заливка.
5. Раздел 9 — forecast-adapter детально.
6. Раздел 11 — текущее состояние.
7. Раздел 12 — что нужно доделать.

### 21.2. Если хотите добавить новый прогнозный слой
1. Откройте `js/layers.js`.
2. Добавьте: `{ id: "new-forecast", name: "Новый прогноз", category: "macroeconomics", vizType: "probability" }`.
3. В `js/maps-config.js` — добавьте manual breaks [20, 40, 60, 80] и палитру YlOrRd5.
4. В `js/forecast-adapter.js` — добавьте spatial proxy.
5. Обновите `FORECAST-MAP-MANIFEST.md` (раздел 15).

---

КОНЕЦ ДОКУМЕНТА
