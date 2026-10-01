# Crucix — Система 5 карт: архитектура, текущее состояние и план работ

Файл: AI_MEMORY/НАДО/5карт/help/README-5-MAPS_ru.md
English: AI_MEMORY/НАДО/5карт/help/README-5-MAPS_en.md
Версия: 2.0
Дата: 27 сентября 2026 г.
Статус: внутренний архитектурный документ

---

## Оглавление

1. Краткое резюме
2. Проблема монолита
3. Решение: 5 карт
4. Названия карт и научное обоснование
5. Текущее состояние (что реально сделано)
6. Распределение 48 новых модулей по картам
7. Реальная файловая архитектура
8. Фильтрация слоёв: maps-config.js
9. Пресеты (presets.json)
10. Specialist-модули без карты (17 шт)
11. План работ на следующие сессии
12. Верификация
13. README карт
14. Библиография

---

## 1. Краткое резюме

Crucix использует 5 независимых карт вместо монолитного дашборда. Каждая карта обрабатывает только свой тип данных и использует только попарно сепарабельные визуальные каналы. Архитектура обоснована шестью независимыми научными теориями.

На 27 сентября 2026 года: каркас 5 карт создан, 195 базовых слоёв распределены, 48 ранее исключённых модулей добавлены в layers.js соответствующих карт. Event Map — основная рабочая карта (84 слоя). Остальные карты требуют настройки инфраструктуры и UI.

---

## 2. Проблема монолита

- Перегрузка канала — мозг 120 бит/сек, монолит 400+ бит/сек (Shannon 1948; Miller 1956; Cowan 2001)
- Split-attention effect — ментальная интеграция снижает результативность на 30-50% (Ayres & Sweller 2005)
- Channel interference — минимум одна пара каналов integral (Munzner 2014)
- Эмпирика — 70% отказываются от решения из-за перегрузки (Oracle 2023)

---

## 3. Решение: 5 карт

| # | Карта | Измерение | Тип визуализации | Каналы | mapType |
|---|-------|-----------|-----------------|--------|---------|
| 1 | Event Map | Пространство+Время+Количество | Точечные события | Position + Color hue | events |
| 2 | Metrics Map | Количество+Время | Choropleth | Position + Color intensity | metrics |
| 3 | Semantic Map | Семантика+Время | Кластеры, тональность | Position + Color categorical | meanings |
| 4 | Network Map | Реляционное+Время | Force-directed graph | Position (force) + Shape | relations |
| 5 | Forecast Map | Прогностическое+Время | Вероятностная заливка | Position + Color divergent | forecasts |

Время — не отдельная карта, а сквозная ось (time slider, фильтр, анимация).

---

## 4. Названия карт и научное обоснование

- Event Map — Peuquet 1994, event-based spatio-temporal model
- Metrics Map — Slocum et al. 2009, cartometric mapping
- Semantic Map — Kucher & Skans 2015, text mining visualization
- Network Map — Barabasi 2016, network science
- Forecast Map — Cressie 1993, probabilistic spatial forecasting

Шесть теорий: Cognitive Load Theory (Sweller 1988), Channel Separability (Munzner 2014), Separation of Concerns (Dijkstra 1974), Information Foraging (Pirolli & Card 1999), Channel Capacity (Shannon 1948), Empirical Dashboard Studies (Koch et al. 2013).

---

## 5. Текущее состояние (что реально сделано)

### 5.1. Созданы все 5 карт

| Карта | Каталог | mapType | Слоёв | Статус |
|-------|---------|---------|-------|--------|
| Event Map | dashboard/public/event-map/ | events | 84 | Рабочая, основная |
| Metrics Map | dashboard/public/metrics-map/ | metrics | 75 | Каркас готов, нужна настройка |
| Semantic Map | dashboard/public/semantic-map/ | meanings | 22 | Каркас готов, нужна настройка |
| Forecast Map | dashboard/public/forecast-map/ | forecasts | 16 | Каркас готов, нужна настройка |
| Network Map | dashboard/public/network-map/ | relations | 3 | Каркас готов, без Leaflet |

### 5.2. Base Map (шаблон)

Каталог dashboard/public/base-map/ — 25 файлов, 540 КБ.

Ключевые файлы:
- js/layers.js — 195 базовых слоёв + getLayersForMap()
- js/layers-dynamic.js — динамический адаптер из /api/registry/layers
- js/init.js — запуск карты, loadData()
- js/markers.js — generateAllMarkers с generateOnly
- js/map-controls.js — loadCountryBoundaries, applyChoropleth
- js/ssi.js — Strategic Stress Index
- js/cii.js — Country Instability Index
- js/heat-timeline.js — тепловая карта и хронология

### 5.3. Новые файлы в event-map/js/

Созданы модули, которых нет в base-map:

- config.js (2.3 КБ) — конфигурация Event Map
- maps-config.js (7.2 КБ) — фильтр слоёв по mapType
- layer-health.js (4.8 КБ) — проверка здоровья слоёв
- markers-count.js (2.8 КБ) — счётчик маркеров
- copy-button.js (23.6 КБ) — расширенное копирование
- copy-data.js (11.7 КБ) — копирование (свой)
- preset.js (5.5 КБ) — система пресетов
- renderer.js (7.8 КБ) — рендеринг
- refresh.js (4.5 КБ) — автообновление (свой)
- cii.js (4.0 КБ) — CII (свой)
- formats-registry.js (7.7 КБ) — реестр форматов
- formats-categorical.js (2.1 КБ) — категориальные
- formats-dispatch.js (2.4 КБ) — диспетчер
- formats-relational.js (1.7 КБ) — реляционные
- formats-spatial.js (2.7 КБ) — пространственные
- formats-textual.js (1.7 КБ) — текстовые
- formats-timeseries.js (2.5 КБ) — временные ряды
- country-boundaries.js (9.3 КБ) — границы (свой)
- geo-map-core.js (685 байт) — ядро
- logger.js (3.6 КБ) — логирование (свой)
- markers.js (6.4 КБ) — маркеры (свой)
- layers-panel.js (4.6 КБ) — панель слоёв
- core.js (2.6 КБ) — ядро (свой)
- countries.js (60.8 КБ) — страны (свой)
- init.js (5.4 КБ) — инициализация (свой)
- heat-timeline.js (6.3 КБ) — тепло/хронология (свой)
- relations.js (16.1 КБ) — связи (свой)
- graph-view.js (13.4 КБ) — граф (свой)
- graph-panel.js (8.6 КБ) — панель графа (свой)
- ssi.js (4.0 КБ) — SSI (свой)

### 5.4. Устаревшие файлы (под очистку)

В event-map/js/:
- layers60.js (18.0 КБ) — устаревший
- layers60 СЛОЁВ, 12 КАТЕГОРИЙ.js (14.0 КБ) — устаревший
- LAYERSCrucix.JS (57.2 КБ) — устаревший
- layers-dynamic.js.bak-20260927-040742 — бэкап
- maps-config.js.bak-20260927-090105 — бэкап
- copy-button (копия).js (23.1 КБ) — копия
- _legacy/, modules/, popup/ — папки

В metrics-map/js/ и других картах — аналогичные дубли (layers60.js, LAYERSCrucix.JS и т.д.)

### 5.5. Особенность event-map

Event Map использует собственные копии скриптов вместо base-map: core.js, countries.js, init.js, markers.js, refresh.js, cii.js, ssi.js, heat-timeline.js — все свои. Остальные карты подключают из ../base-map/js/.

---

## 6. Распределение 48 новых модулей по картам

### 6.1. Metrics Map (+14)

| ID | Категория | Описание |
|----|-----------|----------|
| business-optimism-api | economics | Индекс делового оптимизма |
| consumer-expectations-api | economics | Индекс потребительских ожиданий |
| pmi-api | economics | PMI — индекс менеджеров |
| recession-api | economics | Вероятность рецессии |
| copper-gold-ratio-api | finance | Медь/золото |
| hy-spread-api | finance | HY OAS спред |
| ovx-api | finance | OVX — волатильность нефти |
| rublev-dubai-api | finance | Рубль в Дубае |
| sp500-vix-api | finance | S&P 500 / VIX |
| vxx-api | finance | VXX — волатильность |
| yield-curve-api | finance | Кривая доходности |
| crypto-fear-api | finance | Крипто-страх |
| cyber-threat-index-api | cyber | Индекс киберугроз |
| wti-brent-spread-api | energy | Спред WTI/Brent |

### 6.2. Semantic Map (+13)

| ID | Категория | Описание |
|----|-----------|----------|
| adaptive-news-clustering-api | semantic | Кластеризация новостей |
| ai-news-synthesis-api | semantic | AI-синтез новостей |
| entity-extraction-api | semantic | Извлечение сущностей |
| multi-source-corroboration-api | semantic | Кросс-подтверждение |
| social-sentiment-analyzer-api | semantic | Тональность соцмедиа |
| source-credibility-api | semantic | Достоверность источников |
| narrative-splitter-api | semantic | Сверка нарративов |
| narrative-drift-api | specialist | Расхождение слов и действий |
| deception-index-api | specialist | Индекс достоверности |
| indirect-indicators-api | intelligence | Косвенные индикаторы |
| analysis-events-api | other | analysis-events |
| historical-analysis-api | other | historical-analysis |
| reports-api | other | reports |

### 6.3. Forecast Map (+4)

| ID | Категория | Описание |
|----|-----------|----------|
| ai-forecasts-api | forecast | AI-прогнозы (Ollama) |
| central-bank-predictor-api | forecast | Прогноз решений ЦБ |
| social-briefing-api | forecast | Социальный брифинг |
| social-briefing-engine-api | forecast | Брифинг-движок |

### 6.4. Network Map

Без изменений — 3 слоя. Среди исключённых нет flow-слоёв.

---

## 7. Реальная файловая архитектура

```
dashboard/public/
  geo-map/           ОРИГИНАЛ (не трогать)
  world.geojson      252 КБ, общий
  base-map/          ШАБЛОН, 25 файлов, 540 КБ
    css/             6 файлов
    js/              16 файлов
    data/            world.geojson
  event-map/         84 слоя, РАБОЧАЯ
    js/              30+ файлов (свои + base-map)
    css/             event-map.css
  metrics-map/       75 слоёв
    js/              layers.js + базовые
    css/             metrics-map.css
  semantic-map/      22 слоя
    js/              layers.js + базовые
    css/             semantic-map.css
  forecast-map/      16 слоёв
    js/              layers.js + базовые
    css/             forecast-map.css
  network-map/       3 слоя, без Leaflet
    js/              network-map.js, graph-view, graph-panel, relations
    css/             network-map.css
```

### Порядок загрузки скриптов

1. window.CrucixMap = { mapType: '...' }
2. ../base-map/js/core.js
3. ../base-map/js/countries.js
4. ../base-map/js/layers.js (или свой)
5. js/layers-[mapType].js (или свой layers.js)
6. ../base-map/js/layers-dynamic.js
7. ../base-map/js/markers.js
8. ../base-map/js/map-controls.js
9. ../base-map/js/copy-data.js
10. ../base-map/js/heat-timeline.js (кроме network-map)
11. ../base-map/js/ssi.js
12. ../base-map/js/refresh.js
13. ../base-map/js/logger.mjs
14. ../base-map/js/cii.js (кроме network-map)
15. js/[mapType]-map.js
16. ../base-map/js/init.js (ЗАПУСК, последний)

Порядок менять нельзя — CrucixMap должен быть установлен до layers.js.

---

## 8. Фильтрация слоёв: maps-config.js

### 8.1. Текущее состояние

В event-map/js/maps-config.js (7.2 КБ) — фильтр по mapType. Загружается ПОСЛЕ layers.js, ПЕРЕД init.js.

```js
const MAP_TYPES = {
  events: ['military', 'geopolitical', 'cyber', 'space', 'health',
           'energy', 'transport', 'ecological', 'news', 'threats'],
  metrics: ['economics', 'finance', 'esg'],
  meanings: ['semantic', 'ai', 'intelligence'],
  relations: ['flow', 'social'],
  forecasts: ['forecast', 'detector', 'threats']
};
```

### 8.2. Что нужно сделать

maps-config.js существует ТОЛЬКО в event-map. Нужно:
- Создать maps-config.js в metrics-map, semantic-map, forecast-map
- Или вынести общий в base-map
- Подключить в index.html после layers.js, перед init.js

### 8.3. Дублирование фильтрации

Фильтрация сейчас в двух местах:
1. getLayersForMap() в base-map/js/layers.js
2. MAP_TYPES в event-map/js/maps-config.js

Нужно решить: оставить оба или использовать один.

---

## 9. Пресеты (presets.json)

Файл: dashboard/public/event-map/пресеты/presets.json

3 пресета с ключом "crucix" (дублирование — баг, JSON оставляет последний):

1. Crucix (по умолчанию) — 16 категорий, enabledLayers: [], [55.75, 37.61], zoom 5
2. Crucix — геополитика/конфликты, 24 слоя, [20, 0], zoom 3
3. Crucix — разведка/угрозы, 32 слоя, [50, 10]

Баги:
- Все три пресета имеют одинаковый ключ "crucix" — survives только последний
- enabledLayers содержат категории, не ID слоёв
- Нужно: crucix-default, crucix-conflicts, crucix-intel

---

## 10. Specialist-модули без карты (17 шт)

17 модулей с category='specialist' не попали ни в одну карту — это системная инфраструктура:

| ID | Назначение |
|----|-----------|
| alert-dispatcher-api | Диспетчер оповещений |
| cache-manager-api | Кэш |
| cli-analytics-api | CLI-аналитика |
| config-validator-api | Валидация |
| convergence-engine-api | Схождение сигналов |
| crucix-doctor-api | Диагностика |
| dashboard-indicators-api | Индикаторы дашборда |
| data-discrepancy-api | Расхождения |
| event-deduplicator-api | Дедупликация |
| langgraph-orchestrator-api | LangGraph |
| mcp-server-api | MCP-сервер |
| module-registration-controller-api | Регистрация |
| scenario-simulation-engine-api | Симуляция |
| silence-patterns-api | Паттерны тишины |
| source-coordination-api | Координация |
| strategic-risk-composite-api | Стратегический риск |
| watchdog-api | Наблюдатель |

Доступны через API, но не в панели слоёв.

---

## 11. План работ на следующие сессии

### Этап 1. Выравнивание инфраструктуры (высокий)

1.1. Очистка устаревших файлов — layers60.js, LAYERSCrucix.JS, *.bak-*, копии — во всех картах

1.2. Создание maps-config.js для metrics, semantic, forecast — или вынос общего в base-map

1.3. Исправление presets.json — уникальные ключи, реальные ID в enabledLayers, пресеты для других карт

1.4. Решить дублирование фильтрации — layers.js vs maps-config.js

### Этап 2. Настройка UI (высокий)

2.1. Metrics Map — проверить 75 слоёв, настроить choropleth для новых (vizType='series' vs 'choropleth'), создать maps-config.js

2.2. Semantic Map — проверить 22 слоя, настроить раскраску, добавить типы сигналов (cluster, synthesis, extraction, corroboration, credibility, drift, deception)

2.3. Forecast Map — проверить 16 слоёв, настроить хуки для ai-forecasts, central-bank-predictor, social-briefing

2.4. Network Map — добавить flow-модули, проверить API entity-graph

### Этап 3. Кастомизация данных (средний)

3.1. Проверка API-эндпоинтов — /api/layers/<route> для новых модулей, формат GeoJSON

3.2. Перенос formats-*.js (7 файлов) в base-map или копирование в каждую карту

3.3. Обработка series → choropleth/marker для финансовых модулей

### Этап 4. Кросс-карты (низкий)

4.1. Связанные представления — клик по узлу Network → подсветка Event, клик по стране Metrics → Event

4.2. Общий time slider — синхронизация между картами

### Этап 5. Регенерация (низкий)

5.1. Обновление registry.generated.json — убрать excluded_from_layers

5.2. Обновить английские версии README, синхронизировать RU/EN

---

## 12. Верификация

- NASA-TLX — когнитивная нагрузка, 20% ниже
- Time-to-decision + accuracy — 20% быстрее, 15% точнее
- Eye-tracking — больше фиксаций на релевантных
- Error rate — ниже на 5 картах

---

## 13. README карт

| Карта | RU | EN |
|-------|----|----|
| Base Map | README-BASE-MAP_ru.md | README-BASE-MAP_en.md |
| Event Map | README-EVENT-MAP_ru.md | README-EVENT-MAP_en.md |
| Metrics Map | README-METRICS-MAP_ru.md | README-METRICS-MAP_en.md |
| Semantic Map | README-SEMANTIC-MAP_ru.md | README-SEMANTIC-MAP_en.md |
| Network Map | README-NETWORK-MAP_ru.md | README-NETWORK-MAP_en.md |
| Forecast Map | README-FORECAST-MAP_ru.md | README-FORECAST-MAP_en.md |
| Архитектура | Crucix_5_Maps_Architecture_Justification.md | — |

---

## 14. Библиография

1. Sweller (1988) Cognitive load. Cognitive Science 12(2):257-285.
2. Ayres & Sweller (2005) Split-attention. Cambridge Handbook:135-146.
3. Cowan (2001) Magical number 4. BBS 24(1):87-114.
4. Miller (1956) Magical number seven. Psych Review 63(2):81-97.
5. Munzner (2014) Visualization Analysis and Design. CRC Press.
6. Cleveland & McGill (1984) Graphical perception. JASA 79:531-554.
7. Dijkstra (1974) Role of scientific thought. Selected Writings:60-66.
8. Pirolli & Card (1999) Information foraging. Psych Review 106(4):643-675.
9. Shannon (1948) Mathematical theory. Bell System Tech J 27(3):379-423.
10. Koch et al. (2013) Clinical dashboard. AMIA:834-841.
11. Slocum et al. (2009) Thematic Cartography. Pearson.
12. Barabasi (2016) Network Science. Cambridge.
13. Cressie (1993) Statistics for Spatial Data. Wiley.
14. Gamma et al. (1994) Design Patterns. Addison-Wesley.

---

Принципиальное различие 5 карт

Разделение на 5 карт сделано потому, что данные, которыми они питаются, несовместимы между собой. Пять карт — это пять разных моделей данных, пять разных единиц измерения, пять разных способов привязки к географии. Их нельзя свести в одну карту без потери смысла.

Из index.html semantic-map видно переключатель карт:
/dashboard/event-map/ — Events
/dashboard/metrics-map/ — Metrics
/dashboard/semantic-map/ — Semantic
/dashboard/forecast-map/ — Forecast
/dashboard/network-map/ — Network

Из manifest.json semantic-map: mapType: "meanings", external_dependencies.local_cross_map: 0. То есть semantic-map объявлена самодостаточной — 0 ссылок на другие карты. Это архитектурный принцип R3 из комментария в layers.js семантики: «только свои слои, 0 ссылок на другие карты».

Конкретно чем semantic-map отличается от metrics-map
Metrics-map — карта измеримых числовых показателей. Единица данных: число (индекс, процент, абсолютная величина). Привязка: страна (полигон) через world.geojson. Тип визуализации: choropleth (заливка стран цветом по значению). Данные: window.layerCache[id] = [{name, value, status}]. Легенда: классы значений через .legend-item/.legend-row с палитрами COLOR_SCHEMES. Конфиг текущего слоя: window.currentChoroplethConfig с полями method, palette, breaks, gvf, stats. Именно эту модель ожидает текущий copy-data.js (v3.0, объединённая версия метрик).

Semantic-map — карта смысловых сущностей. Единица данных: объект (маркер, кластер, тон, достоверность). Привязка: точка (координаты lat/lng) для маркеров, либо абстрактная привязка к теме/нарративу для sentiment/cluster/credibility. Тип визуализации: marker, sentiment, cluster, credibility — не choropleth. Данные: window.layerCache[id] обычно пуст, потому что layer-panel.js::loadLayer не делает fetch и не пишет в кэш. Основной массив — window.markerData, генерируемый в markers.js через Math.random(). Это заглушка, а не реальные данные. Легенда #choropleth-legend присутствует в DOM, но никто её не заполняет. window.currentChoroplethConfig отсутствует. window.COLOR_SCHEMES отсутствует. Палитры хранятся в window.LAYER_OVERRIDES (см. layers.js семантики).

Пять карт — пять моделей
Events — точечные события во времени и пространстве. Единица: событие с датой. Привязка: координаты. Визуализация: маркеры, таймлайн.

Metrics — числовые показатели по странам. Единица: число. Привязка: страна (полигон). Визуализация: choropleth.

Semantic — смысловые сущности (тональность, нарратив, кластеры, достоверность). Единица: объект анализа. Привязка: точка или тема. Визуализация: marker/sentiment/cluster/credibility.

Forecast — прогнозные значения. Единица: прогноз с горизонтом. Привязка: страна или регион. Визуализация: choropleth или маркеры с динамикой.

Network — связи между сущностями. Единица: ребро графа. Привязка: узлы. Визуализация: граф.

Причина разделения: у каждой модели своя единица данных, своя привязка к географии, свой способ визуализации. Свести их в одну карту — значит потерять смысл. Metrics-map нельзя наложить на semantic-map: числа по странам и точки смысловых сущностей не пересекаются по типу.

