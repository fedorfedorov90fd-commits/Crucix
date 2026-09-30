# METRICS MAP — МАНИФЕСТ СОСТОЯНИЯ

**Версия карты:** 1.1
**Расположение:** `dashboard/public/metrics-map/`
**Сервер:** `http://localhost:3117/metrics-map/`
**Режим автономии:** FULL ISOLATION (Nygard 2007, Bulkhead Pattern)
**Failure domain:** 1 (сбой этой карты не влияет на 4 остальные)

---

## 1. НАЗНАЧЕНИЕ И МЕСТО В ЭКОСИСТЕМЕ CRUCIX

### 1.1. Что такое Crucix — экосистема из 5 карт

Crucix — геополитическая OSINT-платформа. Она состоит из **5 автономных карт**, каждая визуализирует свой класс данных:

1. **Event Map** (`/event-map/`) — точечные события на карте (митинги, атаки, инциденты). 84 слоя, маркеры.
2. **Metrics Map** (`/metrics-map/`) — количественные индикаторы по странам (экономика, финансы, ESG, кибер, энергетика). **75 слоёв**, choropleth.
3. **Semantic Map** (`/semantic-map/`) — семантический анализ текстов (тональность, нарративы, дезинформация). 35 слоёв.
4. **Forecast Map** (`/forecast-map/`) — вероятностные прогнозы (рецессия, конфликты, риски). 16 слоёв.
5. **Network Map** (`/network-map/`) — графы связей (кибер-сети, торговля, финансы, миграция). 12 слоёв, SVG-граф.

### 1.2. Зачем именно 5 карт, а не одна

Пять карт — это реализация принципа **Separation of Concerns** (Dijkstra 1974). Каждый класс данных требует собственной модели визуализации:

- **События** → позиция + цвет (точечные маркеры). Канал: Position. Ёмкость: высокая для локализации.
- **Количественные индикаторы** → позиция (страна) + интенсивность цвета (choropleth). Канал: Position + Color intensity. Munzner 2014, Table 5.3 — полностью сепарабельны.
- **Семантика** → позиция + категориальный цвет + форма. Канал: Position + Hue + Shape.
- **Вероятности** → позиция + цвет + прозрачность (opacity). Канал: Position + Color intensity + Transparency.
- **Связи** → топология графа (force-directed). Канал: Position (force) + Shape.

Попытка объединить всё в одну карту нарушила бы **принцип сепарабельности каналов** (Munzner 2014). Пользователь не смог бы воспринимать одновременно 5 разных кодировок без когнитивной интерференции. Разделение на 5 карт — научно обоснованное решение, а не организационное удобство.

### 1.3. Что делает Metrics Map

Metrics Map визуализирует **числовые индикаторы по 90 странам мира**. Каждый слой — это один индикатор:

- Экономика: PMI, инфляция, ВВП, безработица, торговый баланс, доверие потребителей, делового оптимизма, потребительских ожиданий, вероятность рецессии, долг/ВВП
- Финансы: индекс доллара, спреды, медь/золото, золото/нефть, золото/серебро, кривая доходности, Big Mac, уран, HY OAS, OVX, S&P/VIX, VXX, крипто-страх, Rouble-in-Dubai, WTI/Brent
- ESG: счастье, плотность населения, беженцы, урбанизация, WHO, COVID-19, HDI
- Кибер: уязвимости CVE, композитный индекс киберугроз
- Энергетика: EIA, атомная, возобновляемая, нефть/газ, спред WTI/Brent
- Здоровье: WHO, COVID-19, медицинская инфраструктура
- Социальные: перемещение населения, беженцы, активность телефонов
- Геополитика: социальная напряжённость, коррупция, демократия, нестабильность, устойчивость, стратегический риск
- Военный: расходы, подготовка к войне
- Угрозы: уязвимости CVE
- Разведка: шаблоны поведения
- Новости: Google Trends
- Другое: интернет, мобильная связь

Итого: **75 слоёв в 13 категориях**.

Каждый слой при активации:
1. Получает данные из API `/api/layers/<layerId>` (или `/api/layers/<layerId>/featurecollection`).
2. Если API недоступен (404) — срабатывает **автономный fallback**: данные генерируются локально из `countries.js` через детерминированный генератор с корреляцией по статусу страны (critical → выше, normal → ниже).
3. Классифицирует значения одним из 5 методов: Jenks DP, Quantile, Equal Interval, Standard Deviation, Manual (доменные пороги).
4. Применяет палитру ColorBrewer (sequential или diverging).
5. Закрашивает 90 стран на карте через `applyChoropleth`.
6. Рисует легенду с порогами классов, методом и качеством классификации (GVF).
7. Логирует результат: `[Choropleth] method=jenks, breaks=[...], GVF=0.9199`.

### 1.4. Отличия от Event Map

Event Map и Metrics Map различаются классом визуализации:

- **Event Map:** каждая точка — отдельное событие (инцидент, митинг). Тысячи маркеров. `vizType='marker'`.
- **Metrics Map:** каждая страна — агрегат числового индикатора. 90 стран. `vizType='choropleth'` или `'series'`.

Event Map генерирует данные из событий, Metrics Map — из индикаторов. Это разные модели данных, и обе не сводятся друг к другу без потери смысла.

---

## 2. СТРУКТУРА ПАПКИ (20 обязательных файлов)
metrics-map/
├── index.html ← точка входа, 18 локальных скриптов
├── manifest.json ← паспорт (mapType=metrics, layers=75, cross_map=0)
├── METRICS-MAP-MANIFEST.md ← ЭТОТ ФАЙЛ (полное описание состояния)
├── ARCHITECTURE.md ← техническая спецификация DAG загрузки
├── AUTONOMY-CHARTER.md ← устав R1–R6 автономии
├── css/
│ └── metrics-map.css ← ЕДИНСТВЕННЫЙ CSS (тёмная тема + choropleth легенда)
├── js/ ← 15 файлов, порядок загрузки критичен
│ ├── core.js
│ ├── countries.js
│ ├── layers.js
│ ├── maps-config.js
│ ├── series-adapter.js
│ ├── map-controls.js
│ ├── markers.js
│ ├── metrics-map.js
│ ├── copy-data.js
│ ├── heat-timeline.js
│ ├── ssi.js
│ ├── refresh.js
│ ├── cii.js
│ ├── logger.js
│ └── init.js
├── data/
│ └── world.geojson ← ЛОКАЛЬНАЯ копия границ (252 КБ)
└── presets/
└── presets.json ← 5 пресетов с уникальными ключами


Плюс каталог `backups/` — автоматически создаваемые бэкапы правок. Плюс каталог `_archive/` — устаревшие файлы после вычистки.

---

## 3. DAG ЗАГРУЗКИ (16 шагов, порядок критичен)

| # | Файл | Что делает | Зависит от |
|---|------|------------|------------|
| S01 | inline `<script>` | `window.CrucixMap = {mapType:'metrics'}` | — |
| S02 | `js/core.js` | `LANG_DATA`, `showNotification`, `setLanguage` | CrucixMap |
| S03 | `js/countries.js` | `ALL_COUNTRIES[90]` | — |
| S04 | `js/layers.js` | `allLayers[75]` + панель слоёв | — |
| S05 | `js/maps-config.js` | `MAP_TYPES`, `COLOR_SCHEMES`, `LAYER_CLASSIFICATION` | allLayers |
| S06 | `js/series-adapter.js` | `SeriesAdapter.convert()` — 14 модулей | maps-config |
| S07 | `js/map-controls.js` | `loadCountryBoundaries`, `applyChoropleth`, `jenksBreaks`, `computeGVF` | Leaflet, countries |
| S08 | `js/markers.js` | `generateAllMarkers`, `updateMarkers`, `renderLayerPanel` | allLayers, map |
| S09 | `js/metrics-map.js` | `MetricsMap.init()` — оборачивает `loadLayer()` | series-adapter, map-controls |
| S10 | `js/copy-data.js` | `copyAllData` — снапшот (~500 КБ) | — |
| S11 | `js/heat-timeline.js` | `toggleHeat`, `toggleTimeline` | map |
| S12 | `js/ssi.js` | `calculateSSI`, `updateLegend` | countries |
| S13 | `js/refresh.js` | `startAutoRefresh`, `refreshMapData` | — |
| S14 | `js/cii.js` | `updateCII` с fallback | countries, map-controls |
| S15 | `js/logger.js` | `CrucixLogger` (панель логов) | — |
| S16 | `js/init.js` | `loadData` → `loadCountryBoundaries` → `MetricsMap.init()` | все выше |

**Нарушение порядка = `window.CrucixMap` undefined = вся карта падает.**

---

## 4. ФУНКЦИОНАЛЬНАЯ МАТРИЦА

| Файл | Ответственность | НЕ делает |
|------|-----------------|-----------|
| `core.js` | Язык, уведомления, глобальные переменные | Логику карты |
| `countries.js` | Массив 90 стран с координатами и статусами | UI |
| `layers.js` | 75 слоёв + панель + toggle-логика | Загрузку данных |
| `maps-config.js` | Конфигурация choropleth: метод, палитра, breaks | Рендеринг |
| `series-adapter.js` | series → choropleth (spatial proxy, 6 трансформаций) | Классификацию |
| `map-controls.js` | Leaflet init, Jenks DP, ColorBrewer, GVF, legend | Бизнес-логику |
| `markers.js` | Маркеры на карте (6 marker-слоёв × 180 = 1080) | Choropleth |
| `metrics-map.js` | Decision tree: choropleth / series / marker | Рендеринг |
| `copy-data.js` | Снапшот состояния (~500 КБ) | — |
| `heat-timeline.js` | Тепловая карта, временная шкала | — |
| `ssi.js` | Strategic Stress Index (42% сейчас) | — |
| `refresh.js` | Автообновление данных | — |
| `cii.js` | Country Instability Index (fallback) | — |
| `logger.js` | Логирование с панелью | — |
| `init.js` | Запуск карты | — |

---

## 5. 75 СЛОЁВ — РАСПРЕДЕЛЕНИЕ

| Категория | Слоёв | choropleth | series | marker |
|-----------|-------|------------|--------|--------|
| finance | 26 | 12 | 8 | 6 |
| economics | 15 | 11 | 4 | — |
| esg | 8 | 8 | — | — |
| geopolitical | 6 | 6 | — | — |
| energy | 5 | 4 | 1 | — |
| health | 3 | 3 | — | — |
| social | 3 | 3 | — | — |
| cyber | 2 | 1 | 1 | — |
| military | 2 | 2 | — | — |
| other | 2 | 2 | — | — |
| threats | 1 | 1 | — | — |
| intelligence | 1 | 1 | — | — |
| news | 1 | 1 | — | — |
| **ИТОГО** | **75** | **56** | **14** | **6** |

---

## 6. КАК РАБОТАЕТ КАЖДЫЙ ТИП СЛОЯ

### 6.1. Choropleth (56 слоёв)

При клике на слой:
1. `loadLayer(layerId)` вызывается из `layers.js`.
2. `MetricsMap.interceptLoad(layerId)` перехватывает.
3. `vizType === 'choropleth'` → `loadChoroplethLayer(layer)`.
4. `fetch('/api/layers/<id>/featurecollection')`.
5. Если 404 → `renderFallback(layer)`:
   - Детерминированный seed по `layer.id`.
   - Для каждой из 90 стран значение = base(status) + noise(seed).
   - Jenks классификация (или manual для PMI/recession).
   - `applyChoropleth()` закрашивает страны.
   - Логирует GVF (обычно 0.90–0.93).
6. Если API работает — данные применяются напрямую.

### 6.2. Series (14 слоёв)

При клике:
1. `interceptLoad` → `loadSeriesLayer(layer)`.
2. `fetch('/api/layers/<route>')`.
3. Если 404 → `renderFallback` (как для choropleth).
4. Если API работает — `SeriesAdapter.convert(layerId, seriesData, countries)`:
   - Выбирает spatial proxy (us_market, oil_producers, financial_centers и т.д.).
   - Применяет трансформацию (weighted_value, stress_indicator, ratio_indicator).
   - Классифицирует (jenks / manual).
   - Возвращает features для choropleth.

### 6.3. Marker (6 слоёв)

При клике:
1. `interceptLoad` → `loadMarkerLayer(layer)`.
2. `fetch('/api/layers/<id>')`.
3. Если 404 → `renderMarkerFallback(layer)`:
   - 2 маркера на каждую из 90 стран = 180 маркеров.
   - Позиция = координаты страны + детерминированный сдвиг.
   - Добавляются в `window.markerData`.
   - Перерисовываются через `updateMarkers`.

Итого при полной активации всех 6 marker-слоёв: 6 × 180 = **1080 маркеров**.

---

## 7. АВТОНОМНОСТЬ (R1–R6)

**R1:** Ни один `<script>`/`<link>`/`fetch` не ходит в `../*`. Проверка: `grep -rn '\.\./' index.html js/*.js | grep -v 'AUTONOMY\|manifest'`.

**R2:** `world.geojson` лежит в `data/`, `fetch('data/world.geojson')`.

**R3:** `layers.js` содержит ровно 75 слоёв Metrics Map. Чужих слоёв (semantic, forecast, network, event) — 0.

**R4:** `maps-config.js`, `presets.json` — только для Metrics Map.

**R5:** `manifest.json` → `local_cross_map: 0`, `failure_domain: 1`.

**R6:** Сбой в Metrics Map не влияет на Event/Semantic/Forecast/Network.

---

## 8. ЧЕК-ЛИСТ ВЕРИФИКАЦИИ

```bash
cd "dashboard/public/metrics-map"

# R1: 0 cross-map зависимостей
grep -rn '\.\./' index.html js/*.js | grep -v 'AUTONOMY\|manifest'

# R3: 75 слоёв
grep -c 'id:' js/layers.js

# R3: 0 дубликатов
grep -o 'id: "[^"]*"' js/layers.js | sort | uniq -d

# R2: локальный geojson
grep -n "data/world.geojson" js/map-controls.js
ls -la data/world.geojson

# Порядок скриптов
grep -o 'src="[^"]*"' index.html | grep -v "http" | sort
## 9. МЕТОДЫ КЛАССИФИКАЦИИ (Jenks 1963, Brewer 2005)
Метод	Формула	Применение
Jenks DP	минимизация SDCM, O(k·n²)	По умолчанию
Quantile	равные группы	При выбросах
Equal Interval	(max−min)/k	Плавные шкалы
Standard Dev	μ ± 0.5σ, ± 1.5σ	Нормальное распределение
Manual	пороги эксперта	ISM 50, recession 20/40/60/80
Контроль качества: GVF = (SDAM − SDCM) / SDAM > 0.7.

## 10. ПАЛИТРЫ COLORBREWER
Sequential (7): Blues, YlOrRd, Greens, Oranges, Purples, BuPu, OrRd
Diverging (4): RdYlGn5, RdBu5, BrBG5, PiYG5

Доменные правила:

PMI → diverging RdYlGn5, manual breaks [42, 47, 53, 58] (ISM 50 = граница)

Recession → sequential YlOrRd5, manual breaks [20, 40, 60, 80]

Copper/Gold → diverging RdBu5, Jenks

Yield Curve → diverging RdBu5, Jenks (инверсия = красный)

## 11. ТЕКУЩЕЕ СОСТОЯНИЕ
Компонент	Статус
75 слоёв загружены	✅
Панель слоёв (13 категорий, 76 кнопок)	✅
Границы data/world.geojson локально	✅
MetricsMap оркестратор	✅
Autonomный fallback (без API)	✅
Jenks DP + GVF	✅ (GVF 0.90–0.93)
Choropleth-легенда	✅
CII fallback	✅ (42%)
SSI	✅ (42%)
Кнопка КОПИРОВАТЬ (~500 КБ)	✅
Marker-fallback (180 маркеров/слой)	✅
Ручной клик по кнопке слоя	⚠️ Требует проверки: работает ли toggle
Кнопка «Включить все»	⚠️ Требует проверки: цикл обрабатывает 10–20 слоёв из 75
Легенда при активном layerCache = 0	⚠️ Очищается
## 12. ИЗВЕСТНЫЕ ОГРАНИЧЕНИЯ
12.1. Кнопка «Включить все» (enableAllLayers в js/layers.js)
Проблема: в предыдущих тестах цикл обработал 10–20 слоёв и прервался без финальной строки [enableAllLayers] Всего: 75....

Гипотезы:

Ручной вызов из консоли работает, кнопка из панели — нет.

Пользователь переключал вкладку → браузер throttled setTimeout(30).

Два параллельных вызова enableAllLayers (панель + консоль) дают race condition.

Требуется:

Проверить, что кнопка «Включить все» в панели слоёв вызывает window.enableAllLayers().

В enableAllLayers добавить логи в каждой итерации: console.log('[enableAllLayers] Слой N/75: ' + layer.id).

После загрузки слоя возвращать класс active кнопке: if (btn) btn.classList.add('active').

12.2. Визуальная активность кнопок слоёв
Проблема: в снапшоте при 76 активных слоях в activeLayerIds все 76 кнопок могут не иметь класс .active.

Требуется: в enableAllLayers после успешной загрузки слоя — вернуть класс active кнопке. Сейчас кнопка снимает класс до загрузки и не возвращает.

12.3. copy-data.js — полный размер
Целевой размер: 300–500 КБ при 75 слоях с данными.

Текущий размер: 40–50 КБ при 1–10 слоях с данными.

Проверка: после того, как все 75 слоёв получат данные (через enableAllLayers), размер должен вырасти до ~350 КБ. Если нет — секция «ДАННЫЕ АКТИВНЫХ СЛОЁВ» не собирает все 90 строк на слой.

12.4. Остальные 4 карты
По аналогии с Metrics Map должны быть приведены в состояние FULL ISOLATION:

Event Map (/event-map/) — 84 слоя, есть базовая автономность, но требует проверки layers.js и map-controls.js.

Semantic Map (/semantic-map/) — 35 слоёв, sentiment-adapter, проверка не выполнена.

Forecast Map (/forecast-map/) — 16 слоёв, forecast-adapter, probability-заливка (Cressie 1993), проверка не выполнена.

Network Map (/network-map/) — 12 слоёв, SVG force-directed graph (Barabasi 2016), без Leaflet, проверка не выполнена.

Каждая карта требует:

Единый MANIFEST.md с полным описанием (по образцу этого).

Очистка папки от устаревших файлов (перенос в _archive/).

Проверка автономности (grep '\.\./' = 0).

Проверка DAG загрузки.

Верификация слоёв.

13. ГЛАВНЫЙ ФАЙЛ ДЛЯ ВВОДА В НОВЫЙ ЧАТ
Этот файл — единственный источник контекста для нового экземпляра ИИ. Прочитав его, ИИ сразу понимает:

Что такое Metrics Map и её место в экосистеме из 5 карт.

Какая структура папки (20 обязательных файлов).

Как работает каждая часть (DAG, функциональная матрица).

Какие слои загружены и как они визуализируются.

Какие задачи решены и что осталось доделать.

Какие принципы автономии (R1–R6) и как их проверять.

Что нужно сделать при следующем обращении:

Проверить пункт 12.1 (кнопка «Включить все»).

Проверить пункт 12.2 (визуальная активность кнопок).

Проверить пункт 12.3 (размер copy-data.js).

Перейти к следующей карте (Event Map, Semantic Map, Forecast Map или Network Map — по приоритету пользователя).

14. ПРАВИЛА ПРОЕКТА, ПРИМЕНИМЫЕ К ЭТОМУ ФАЙЛУ


## 13. ПОЛНЫЙ СПИСОК 75 СЛОЁВ — КАТАЛОГ

Каждый слой: ID, название, категория, vizType, метод классификации, палитра, источник данных, что показывает.

### 15.1. ECONOMICS — 15 слоёв

**1. inflation** — «Инфляция»
- vizType: choropleth, method: jenks, palette: OrRd
- Источник: FRED (CPIAUCSL, серия потребительских цен)
- Что показывает: годовой темп роста цен по странам, %
- Домен: 0–100, больше = хуже

**2. unemployment** — «Безработица»
- vizType: choropleth, jenks, YlOrRd
- Источник: BLS + FRED
- Что показывает: уровень безработицы, % от рабочей силы

**3. gdp** — «ВВП»
- vizType: choropleth, jenks, Greens
- Источник: FRED (GDP), World Bank
- Что показывает: ВВП на душу населения (нормированный)

**4. pmi** — «PMI»
- vizType: choropleth, manual, RdYlGn5
- Breaks: [42, 47, 53, 58]
- Источник: ISM (США) + аналоги по странам
- Что показывает: индекс менеджеров по закупкам. Домен: 50 = граница сжатия/расширения (ISM). Ниже 42 = кризис, выше 58 = бум
- Rationale: доменный порог ISM 50 важнее статистической оптимальности

**5. recession** — «Рецессия»
- vizType: choropleth, manual, YlOrRd
- Breaks: [20, 40, 60, 80]
- Источник: модель вероятности рецессии (кривая доходности + спреды + PMI)
- Что показывает: вероятность рецессии в ближайшие 12 мес, %. Домен: 20/40/60/80 — пороги уверенности

**6. trade-balance** — «Торговый баланс»
- vizType: choropleth, jenks, RdBu5 (diverging)
- Источник: Comtrade, FRED
- Что показывает: экспорт минус импорт, % ВВП. Диверджентная шкала: красный = дефицит, синий = профицит

**7. fred** — «FRED Экономика»
- vizType: choropleth, jenks, Blues
- Источник: FRED (агрегированный индекс)
- Что показывает: композитный экономический индикатор

**8. bls** — «BLS Труд»
- vizType: choropleth, jenks, Blues
- Источник: BLS (Bureau of Labor Statistics)
- Что показывает: агрегат по рынку труда

**9. comtrade** — «Comtrade Торговля»
- vizType: choropleth, jenks, Blues
- Источник: UN Comtrade
- Что показывает: объём международной торговли

**10. debt-gdp** — «Долг/ВВП»
- vizType: choropleth, jenks, OrRd
- Источник: FRED (GFDEGDQ188S)
- Что показывает: государственный долг в % от ВВП. Домен: выше = хуже

**11. consumer-confidence** — «Потребительское доверие»
- vizType: choropleth, jenks, RdYlGn5
- Источник: FRED (UMCSENT)
- Что показывает: индекс доверия потребителей. Диверджентная: пессимизм ↔ оптимизм

**12. business-optimism-api** — «Индекс делового оптимизма (FRED)»
- vizType: series → choropleth, jenks, RdYlGn5
- Spatial proxy: us_market
- Трансформация: weighted_value
- Источник: /api/layers/business-optimism
- Что показывает: оптимизм бизнеса (NFIB Small Business Optimism)

**13. consumer-expectations-api** — «Индекс потребительских ожиданий (FRED)»
- vizType: series, jenks, RdYlGn5
- Spatial proxy: us_market
- Трансформация: weighted_value
- Источник: /api/layers/consumer-expectations
- Что показывает: ожидания потребителей (Conference Board)

**14. pmi-api** — «PMI — менеджеры по закупкам (порог 50)»
- vizType: series, manual, RdYlGn5
- Breaks: [42, 47, 53, 58]
- Spatial proxy: all_countries
- Источник: /api/layers/pmi
- Что показывает: PMI. Домен ISM 50

**15. recession-api** — «Вероятность рецессии (0–100%)»
- vizType: series, manual, YlOrRd
- Breaks: [20, 40, 60, 80]
- Spatial proxy: developed_markets
- Источник: /api/layers/recession
- Что показывает: вероятность рецессии в развитых рынках

### 15.2. FINANCE — 26 слоёв

**16. dxy** — «Индекс доллара DXY»
- vizType: choropleth, jenks, RdBu5
- Источник: FRED (DTWEXBGS)
- Что показывает: сила доллара. Диверджентная: слабость ↔ сила

**17. tips** — «Реальные ставки TIPS»
- vizType: choropleth, jenks, RdBu5
- Источник: FRED (DFII10)
- Что показывает: 10-летние реальные ставки (TIPS)

**18. hy-spread** — «Корпоративные спреды»
- vizType: choropleth, jenks, YlOrRd
- Источник: FRED (BAMLH0A0HYM2)
- Что показывает: спред высокодоходных облигаций. Домен: выше = стресс

**19. copper-gold** — «Медь/Золото»
- vizType: choropleth, jenks, RdBu5
- Источник: FRED (PCOPPUSDM, GOLDPMGBD228NLBM)
- Что показывает: отношение меди к золоту — опережающий индикатор экономики

**20. gold-oil** — «Золото/Нефть»
- vizType: choropleth, jenks, RdBu5
- Источник: FRED (GOLDPMGBD228NLBM, DCOILWTICO)
- Что показывает: отношение золота к нефти

**21. gold-silver** — «Золото/Серебро»
- vizType: choropleth, jenks, RdBu5
- Источник: FRED
- Что показывает: отношение золота к серебру

**22. yield-curve** — «Кривая доходности»
- vizType: choropleth, jenks, RdBu5
- Источник: FRED (T10Y2Y)
- Что показывает: спред 10Y-2Y. Инверсия = красный (сигнал рецессии)

**23. big-mac** — «Индекс Биг-Мак»
- vizType: choropleth, jenks, RdBu5
- Источник: The Economist
- Что показывает: недо/переоценка валюты через Биг-Мак

**24. big-mac-alt** — «Биг-Мак (альт.)»
- vizType: choropleth, jenks, RdBu5
- Источник: альтернативный источник
- Что показывает: Биг-Мак, альтернативная методика

**25. big-mac-main** — «Биг-Мак (осн.)»
- vizType: choropleth, jenks, RdBu5
- Источник: основной источник
- Что показывает: Биг-Мак, основная методика

**26. uranium** — «Цена урана»
- vizType: choropleth, jenks, Purples
- Источник: UxC (Uranium Exchange)
- Что показывает: спотовая цена урана

**27. crucix-banking** — «🏦 Банковская активность»
- vizType: choropleth, jenks, Greens
- Источник: синтетический (банковские транзакции)
- Что показывает: активность банковской системы

**28. copper-gold-ratio-api** — «Отношение меди к золоту (опережающий)»
- vizType: series, jenks, RdBu5
- Spatial proxy: copper_producers (Chile, Peru, China, USA, Australia)
- Трансформация: ratio_indicator
- Источник: /api/layers/copper-gold-ratio

**29. hy-spread-api** — «HY OAS — спред высокодоходных облигаций»
- vizType: series, jenks, YlOrRd
- Spatial proxy: us_market
- Трансформация: stress_indicator
- Источник: /api/layers/hy-spread

**30. ovx-api** — «OVX — волатильность нефти»
- vizType: series, jenks, YlOrRd
- Spatial proxy: oil_producers
- Трансформация: stress_indicator
- Источник: /api/layers/ovx
- Что показывает: CBOE Crude Oil Volatility Index

**31. rublev-dubai-api** — «Рубль в Дубае — реальный курс RUB/USDT»
- vizType: series, jenks, RdYlGn5
- Spatial proxy: all_countries
- Трансформация: weighted_value
- Источник: /api/layers/rublev-dubai
- Что показывает: реальный курс рубля через криптобиржи (Garantex, CommEX)

**32. sp500-vix-api** — «S&P 500 / VIX Ratio (risk-on/risk-off)»
- vizType: series, jenks, RdBu5
- Spatial proxy: financial_centers
- Трансформация: ratio_indicator
- Источник: /api/layers/sp500-vix
- Что показывает: индикатор склонности к риску

**33. vxx-api** — «VXX — VIX Short-Term Futures ETN»
- vizType: series, jenks, YlOrRd
- Spatial proxy: financial_centers
- Трансформация: stress_indicator
- Источник: /api/layers/vxx
- Что показывает: режимы волатильности

**34. yield-curve-api** — «Кривая доходности US Treasury (10Y-2Y)»
- vizType: series, jenks, RdBu5
- Spatial proxy: developed_markets
- Трансформация: yield_curve_signal
- Источник: /api/layers/yield-curve
- Что показывает: инверсия = красный

**35. crypto-fear-api** — «Крипто-страх: BTC, ETH, ratio»
- vizType: series, jenks, RdYlGn5
- Spatial proxy: crypto_adoption
- Трансформация: sentiment_indicator
- Источник: /api/layers/crypto-fear
- Что показывает: индекс страха/жадности крипторынка

**36. vix-futures** — «VIX фьючерсы»
- vizType: marker, jenks, Blues
- Источник: CBOE VIX futures
- Что показывает: контанго/бэквордация фьючерсов. Fallback: 180 маркеров

**37. cftc-cot** — «CFTC COT — позиции фондов»
- vizType: marker, jenks, Blues
- Источник: CFTC Commitments of Traders
- Что показывает: позиции институциональных фондов. Fallback: 180 маркеров

**38. insider-trading** — «Инсайдерская торговля»
- vizType: marker, jenks, Blues
- Источник: SEC Form 4
- Что показывает: сделки инсайдеров. Fallback: 180 маркеров

**39. sec-filings** — «SEC filings»
- vizType: marker, jenks, Blues
- Источник: SEC EDGAR
- Что показывает: отчёты SEC. Fallback: 180 маркеров

**40. short-interest** — «Short interest»
- vizType: marker, jenks, Blues
- Источник: FINRA
- Что показывает: объём коротких позиций. Fallback: 180 маркеров

**41. bankruptcy-filings** — «Банкротства»
- vizType: marker, jenks, Blues
- Источник: судебные реестры
- Что показывает: банкротства компаний. Fallback: 180 маркеров

### 15.3. ESG — 8 слоёв

**42. happiness** — «Индекс счастья»
- vizType: choropleth, jenks, RdYlGn5
- Источник: World Happiness Report
- Что показывает: субъективное благополучие. Домен: 0–10

**43. happiness-alt** — «Индекс счастья (альт.)»
- vizType: choropleth, jenks, RdYlGn5
- Источник: альтернативный (Gallup-Sharecare)

**44. population** — «Плотность населения»
- vizType: choropleth, jenks, Purples
- Источник: World Bank
- Что показывает: чел/км²

**45. refugees** — «Беженцы»
- vizType: choropleth, jenks, OrRd
- Источник: UNHCR
- Что показывает: количество беженцев на 100k населения

**46. urbanization** — «Урбанизация»
- vizType: choropleth, jenks, Blues
- Источник: World Bank
- Что показывает: % городского населения

**47. who** — «WHO Здравоохранение»
- vizType: choropleth, jenks, Greens
- Источник: WHO
- Что показывает: индекс здоровья населения

**48. covid** — «COVID-19»
- vizType: choropleth, jenks, YlOrRd
- Источник: JHU CSSE
- Что показывает: текущая заболеваемость

**49. hdi** — «Индекс человеческого развития»
- vizType: choropleth, jenks, Greens
- Источник: UNDP HDI
- Что показывает: HDI, 0–1

### 15.4. GEOPOLITICAL — 6 слоёв

**50. social-unrest** — «Социальная напряженность»
- vizType: choropleth, jenks, YlOrRd
- Источник: ACLED + GDELT
- Что показывает: композитный индекс протестной активности

**51. corruption** — «Индекс коррупции»
- vizType: choropleth, jenks, YlOrRd
- Источник: Transparency International CPI
- Что показывает: 0–100, выше = меньше коррупции. Инвертируется

**52. democracy** — «Индекс демократии»
- vizType: choropleth, jenks, RdYlGn5
- Источник: EIU Democracy Index
- Что показывает: 0–10. Домен: 4/6/8 = границы режимов

**53. country-instability** — «Индекс нестабильности стран»
- vizType: choropleth, jenks, YlOrRd
- Источник: FFP Fragile States Index
- Что показывает: 0–120 (нормируется)

**54. resilience-index** — «Индекс устойчивости стран»
- vizType: choropleth, jenks, Greens
- Источник: FFP + World Bank
- Что показывает: устойчивость к шокам. Домен: выше = лучше

**55. strategic-risk-composite** — «Стратегический риск (композитный)»
- vizType: choropleth, manual, YlOrRd
- Breaks: [20, 40, 60, 80]
- Источник: композит (инстабильность + дефицит устойчивости + инфраструктура + геополитика)
- Вес: 100 (наивысший приоритет)

### 15.5. ENERGY — 5 слоёв

**56. eia** — «EIA Энергетика»
- vizType: choropleth, jenks, Oranges
- Источник: EIA (US Energy Information Administration)
- Что показывает: потребление энергии

**57. nuclear** — «Атомная энергетика»
- vizType: choropleth, jenks, Purples
- Источник: IAEA
- Что показывает: % атомной генерации

**58. renewable** — «Возобновляемая энергия»
- vizType: choropleth, jenks, Greens
- Источник: IRENA
- Что показывает: % возобновляемой генерации

**59. oil-gas** — «Нефть/Газ»
- vizType: choropleth, jenks, Oranges
- Источник: EIA
- Что показывает: добыча нефти и газа

**60. wti-brent-spread-api** — «Спред WTI/Brent (геополит. напряжение)»
- vizType: series, jenks, RdBu5
- Spatial proxy: oil_producers
- Трансформация: spread_indicator
- Источник: /api/layers/wti-brent-spread
- Что показывает: разница между WTI и Brent — индикатор геополитического напряжения

### 15.6. HEALTH — 3 слоя

**61. who-health** — «WHO Здравоохранение»
- vizType: choropleth, jenks, Greens
- Источник: WHO
- Что показывает: расходы на здравоохранение % ВВП

**62. covid-health** — «COVID-19 статистика»
- vizType: choropleth, jenks, YlOrRd
- Источник: JHU CSSE
- Что показывает: накопленная заболеваемость

**63. healthcare-health** — «Медицинская инфраструктура»
- vizType: choropleth, jenks, Greens
- Источник: WHO
- Что показывает: койко-места на 1000 человек

### 15.7. SOCIAL — 3 слоя

**64. crucix-population-flow** — «👥 Перемещение населения»
- vizType: choropleth, jenks, Oranges
- Источник: синтетический (миграционные паттерны)
- Что показывает: интенсивность перемещения

**65. crucix-refugees** — «🧳 Беженцы (crucix)»
- vizType: choropleth, jenks, OrRd
- Источник: UNHCR
- Что показывает: потоки беженцев

**66. crucix-phone-activity** — «📱 Активность телефонов»
- vizType: choropleth, jenks, Blues
- Источник: синтетический (мобильные сети)
- Что показывает: интенсивность использования мобильных сетей

### 15.8. CYBER — 2 слоя

**67. cve-cyber** — «Уязвимости CVE»
- vizType: choropleth, jenks, YlOrRd
- Источник: NVD (National Vulnerability Database)
- Что показывает: количество критических CVE

**68. cyber-threat-index-api** — «Композитный индекс киберугроз»
- vizType: series, jenks, OrRd
- Spatial proxy: all_countries
- Трансформация: stress_indicator
- Источник: /api/layers/cyber-threat-index (CISA + Darkweb)

### 15.9. MILITARY — 2 слоя

**69. military-spending** — «Военные расходы»
- vizType: choropleth, jenks, OrRd
- Источник: SIPRI
- Что показывает: расходы в % ВВП

**70. war-preparation** — «Индекс подготовки к войне»
- vizType: choropleth, manual, YlOrRd
- Breaks: [20, 40, 60, 80]
- Источник: композит (мобилизация + закупки + учения)
- Что показывает: интенсивность подготовки

### 15.10. THREATS — 1 слой

**71. cve-threat** — «Уязвимости CVE (threat)»
- vizType: choropleth, jenks, OrRd
- Источник: NVD
- Что показывает: уязвимости в контексте угроз

### 15.11. INTELLIGENCE — 1 слой

**72. crucix-pattern-life** — «📊 Шаблоны поведения»
- vizType: choropleth, jenks, BuPu
- Источник: синтетический
- Что показывает: аномальные поведенческие паттерны

### 15.12. NEWS — 1 слой

**73. google-trends** — «Google Trends»
- vizType: choropleth, jenks, OrRd
- Источник: Google Trends API
- Что показывает: индекс поисковой активности

### 15.13. OTHER — 2 слоя

**74. internet** — «Интернет-доступ»
- vizType: choropleth, jenks, Blues
- Источник: ITU
- Что показывает: % пользователей интернета

**75. mobile** — «Мобильная связь»
- vizType: choropleth, jenks, Blues
- Источник: GSMA
- Что показывает: количество SIM на 100 человек

---

## 14. ЧЕТЫРЕ ОСТАЛЬНЫЕ КАРТЫ — ПЛАН ПРОВЕРКИ

### 16.1. Event Map (`/event-map/`)

**Что это:** карта точечных событий (митинги, атаки, инциденты). 84 слоя, маркеры.

**Главные файлы:**
- `event-map/index.html`
- `event-map/js/layers.js` — 84 слоя
- `event-map/js/map-controls.js` — границы + choropleth
- `event-map/js/markers.js` — маркеры событий
- `event-map/js/copy-data.js` — кнопка КОПИРОВАТЬ

**Что проверить:**
1. `grep -c 'id:' js/layers.js` = 84.
2. `grep -rn '\.\./' index.html js/*.js | grep -v 'AUTONOMY\|manifest'` = 0.
3. `fetch('data/world.geojson')` в `map-controls.js` (локально).
4. Кнопка КОПИРОВАТЬ — размер снапшота (у Event Map больше маркеров, снапшот может быть 1–2 МБ).
5. Маркеры событий рисуются (обычно 500–1300 маркеров).

**Что может быть не так:**
- `map-controls.js` использует удалённый GitHub GeoJSON вместо `data/world.geojson`.
- Кнопка REFRESH не работает.
- Тепловая карта (`heat-timeline.js`) не доработана.

**Приоритет:** высший — Event Map основная карта, на неё ссылаются остальные.

### 16.2. Semantic Map (`/semantic-map/`)

**Что это:** карта семантического анализа текстов (тональность, нарративы, дезинформация). 35 слоёв, sentiment-adapter.

**Главные файлы:**
- `semantic-map/index.html`
- `semantic-map/js/layers.js` — 35 слоёв
- `semantic-map/js/sentiment-adapter.js` — sentiment → choropleth
- `semantic-map/js/map-controls.js`
- `semantic-map/js/copy-data.js`

**Что проверить:**
1. `grep -c 'id:' js/layers.js` = 35.
2. `grep -rn '\.\./' index.html js/*.js | grep -v 'AUTONOMY\|manifest'` = 0.
3. `data/world.geojson` — существует.
4. Sentiment-adapter возвращает 5 классов (Cowan 2001: 4±1 чанк).
5. Палитры: RdYlGn5 (diverging для тональности), OrRd5 (для достоверности), Set1 (категориальная для кластеров).

**Что может быть не так:**
- `sentiment-adapter.js` — не все методы классификации реализованы.
- Категориальные кластеры — цвета Set1 (10 цветов) могут не совпадать с легендой.
- Отсутствует fallback для sentiment (аналогично `renderFallback` в Metrics).

**Приоритет:** средний. Проверить после Event Map.

### 16.3. Forecast Map (`/forecast-map/`)

**Что это:** карта вероятностных прогнозов (рецессия, конфликты, риски). 16 слоёв, forecast-adapter, probability-заливка (Cressie 1993).

**Главные файлы:**
- `forecast-map/index.html`
- `forecast-map/js/layers.js` — 16 слоёв
- `forecast-map/js/forecast-adapter.js` — probability → choropleth
- `forecast-map/js/map-controls.js`
- `forecast-map/js/copy-data.js`

**Что проверить:**
1. `grep -c 'id:' js/layers.js` = 16.
2. `grep -rn '\.\./' index.html js/*.js` = 0.
3. `data/world.geojson` — существует.
4. Probability-заливка: цвет = класс вероятности (5 классов, manual breaks [20, 40, 60, 80]), прозрачность = уровень уверенности модели: `opacity = 0.4 + 0.5 × confidence`.
5. Popup показывает: вероятность, уверенность, горизонт прогноза.

**Что может быть не так:**
- Формула opacity не реализована.
- Spatial proxy для 4 источников (ai-forecasts, central-bank, social-briefing, social-briefing-engine) не настроены.
- Probability-классификация не использует manual breaks.

**Приоритет:** средний.

### 16.4. Network Map (`/network-map/`)

**Что это:** карта графов связей (кибер-сети, торговля, финансы, миграция). 12 слоёв, SVG force-directed graph (Barabasi 2016), без Leaflet.

**Главные файлы:**
- `network-map/index.html`
- `network-map/js/layers.js` — 12 слоёв
- `network-map/js/graph-view.js` — SVG force-directed
- `network-map/js/graph-panel.js` — панель досье узлов
- `network-map/js/relations.js` — построение связей
- `network-map/js/network-adapter.js`

**Что проверить:**
1. `grep -c 'id:' js/layers.js` = 12.
2. `grep -rn '\.\./' index.html js/*.js` = 0.
3. **`data/world.geojson` НЕ нужен** — это SVG-граф, не Leaflet.
4. Force-directed simulation: Coulomb repulsion (F = k/r²), Hooke attraction (F = (d−L)×0.1), gravity, Verlet integration.
5. 4 формы узлов: Circle (страна/кибер), Square (организация), Triangle (событие), Diamond (финансовый).
6. O(n²) сложность — приемлемо для n < 500 узлов.

**Что может быть не так:**
- Force simulation нестабильна при большом числе узлов.
- Панель досье (`graph-panel.js`) не открывается.
- 4 формы узлов не различаются визуально.

**Приоритет:** низкий (граф не блокирует остальные карты).

---

## 15. API-ЭНДПОИНТЫ, ОЖИДАЕМЫЕ НА СЕРВЕРЕ

### 17.1. Choropleth-слои (56)

Для каждого choropleth-слоя ожидается эндпоинт:
GET /api/layers/<layerId>/featurecollection


Ответ:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "Украина", "value": 84.02 },
      "geometry": { ... }
    },
    ...
  ]
}
Если эндпоинт не отвечает (404) — сработает renderFallback.

17.2. Series-слои (14)
Для каждого series-слоя ожидается эндпоинт:

text
GET /api/layers/<route>
Где <route> — один из:

/api/layers/business-optimism

/api/layers/consumer-expectations

/api/layers/pmi

/api/layers/recession

/api/layers/copper-gold-ratio

/api/layers/hy-spread

/api/layers/ovx

/api/layers/rublev-dubai

/api/layers/sp500-vix

/api/layers/vxx

/api/layers/yield-curve

/api/layers/crypto-fear

/api/layers/cyber-threat-index

/api/layers/wti-brent-spread

Ответ:

json
{
  "value": 52.4,
  "series": [
    { "date": "2026-09-01", "value": 51.2 },
    { "date": "2026-09-08", "value": 52.4 }
  ]
}
17.3. Marker-слои (6)
Для каждого marker-слоя ожидается эндпоинт:

text
GET /api/layers/<layerId>
Ответ:

json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "label": "Событие", "value": 5, "region": "US" },
      "geometry": { "type": "Point", "coordinates": [lng, lat] }
    }
  ]
}
17.4. CII API
text
GET /api/cii-api
Ответ:

json
{
  "countries": [
    { "country": "Украина", "score": 100, "level": "critical", "color": "#ff3b3b" },
    ...
  ],
  "total": 90,
  "timestamp": "2026-09-28T17:42:21Z"
}
Если 404 — сработает updateCIIFromLocal() (fallback на локальные данные).

17.5. Все прочие API
Стандартные:

/api/geo/markers — маркеры Event Map

/api/geo/status — статусы стран

/api/layers/all — сводный эндпоинт для всех слоёв (оптимизация)

17.6. Принцип корзины (правило №16)
Все API-модули не должны ходить во внешние источники. Источник данных — только корзина data/basket/.

Схема:

text
Внешний API → Сборщик (scripts/collectors/collect-*.mjs)
            → Корзина (data/basket/*.json)
            → API-модуль (apis/sources/*.mjs)
            → Интерфейс (dashboard/public/metrics-map/)
## 16. КОНТРАКТЫ МЕЖДУ КАРТАМИ
18.1. Принцип автономии
Каждая карта полностью автономна. Ноль cross-map зависимостей в скриптах и данных. Единственная разрешённая форма связи — навигационные ссылки в UI (переход между картами).

18.2. Навигация (5 переключателей)
В каждом index.html в блоке .map-switcher размещаются 5 ссылок:

html
<a class="map-switch-btn" data-map="events" href="../event-map/">Events</a>
<a class="map-switch-btn active" data-map="metrics" href="../metrics-map/">Metrics</a>
<a class="map-switch-btn" data-map="meanings" href="../semantic-map/">Semantic</a>
<a class="map-switch-btn" data-map="relations" href="../network-map/">Network</a>
<a class="map-switch-btn" data-map="forecasts" href="../forecast-map/">Forecast</a>
Активная карта имеет класс active.

18.3. Формат mapType
Каждая карта объявляет свой тип в inline-скрипте:

html
<script>window.CrucixMap = { mapType: 'metrics', name: 'Crucix — Metrics Map' };</script>
Типы:

events — Event Map

metrics — Metrics Map

meanings — Semantic Map

relations — Network Map

forecasts — Forecast Map

18.4. Формат manifest.json
Каждая карта имеет manifest.json со схемой:

json
{
  "mapType": "metrics",
  "version": "1.1",
  "autonomous": true,
  "principle": "FULL_ISOLATION",
  "layers": 75,
  "categories": [...],
  "local_cross_map": 0,
  "failure_domain": 1,
  "scripts": { ... },
  "data": { "world_geojson": "data/world.geojson" }
}
Общие поля: mapType, version, autonomous, principle, local_cross_map, failure_domain.

18.5. Что НЕ является контрактом
Не контракт:

Общие JS-файлы (core.js, countries.js, map-controls.js) — каждая карта имеет свою копию.

Общий world.geojson — каждая карта имеет свою копию в data/.

Общие CSS — каждая карта имеет свой metrics-map.css или event-map.css.

Общие API — каждая карта обращается к своим эндпоинтам.

Контракт:

Навигационные ссылки в .map-switcher.

Формат window.CrucixMap.

Схема manifest.json.

Соглашение об именах: event-map, metrics-map, semantic-map, network-map, forecast-map.

18.6. Failure domain = 1
Сбой в одной карте не влияет на остальные 4. Это гарантируется тремя условиями:

Ни один <script> не подгружается из ../other-map/js/.

Ни одна карта не делает fetch('../other-map/data/...').

Навигационные ссылки — обычные <a href>, а не fetch.

Если карта-сосед сломалась — навигация не сработает, но текущая карта продолжит работу.

18.7. Проверка автономии всех 5 карт
bash
cd "dashboard/public"

for map in event-map metrics-map semantic-map network-map forecast-map; do
    if [ -d "$map" ]; then
    else
    fi
done
Ожидание:

Cross-map в index.html — только навигационные <a href>, не <script>.

Cross-map в js/*.js = 0.

Слоёв: 84 / 75 / 35 / 16 / 12.

world.geojson: есть у event-map, metrics-map, semantic-map, forecast-map. Отсутствует у network-map (SVG-граф).

## 17. ПОЛНЫЙ ЧЕК-ЛИСТ ПРОВЕРКИ ALL-5
bash
cd "dashboard/public"

# 1. Структура каждой карты
for map in event-map metrics-map semantic-map network-map forecast-map; do
    ls -la "$map/index.html" "$map/manifest.json" "$map/METRICS-MAP-MANIFEST.md" 2>/dev/null || \
    ls -la "$map/index.html" "$map/manifest.json" 2>/dev/null
done

# 2. Автономность
for map in event-map metrics-map semantic-map network-map forecast-map; do
    echo -n "$map: "
done

# 3. Слои
for map in event-map metrics-map semantic-map network-map forecast-map; do
    echo -n "$map слоёв: "
    grep -c 'id:' "$map/js/layers.js" 2>/dev/null || echo 0
done

# 4. Локальный geojson
for map in event-map metrics-map semantic-map forecast-map; do
    echo -n "$map world.geojson: "
done
Ожидание:

Все 5 карт имеют index.html и manifest.json.

Cross-map в js/*.js = 0 для всех.

Слои: 84 / 75 / 35 / 12 / 16.

world.geojson: есть у 4 карт из 5 (нет у network-map).

## 18. КОНТРОЛЬНЫЕ ТОЧКИ СОСТОЯНИЯ
20.1. Что работает в Metrics Map
75 слоёв загружены.

Панель слоёв: 13 категорий, 76 кнопок.

data/world.geojson — локально.

MetricsMap оркестратор — decision tree choropleth / series / marker.

Autonomный fallback при 404 — 90 стран на слой через Jenks.

GVF: 0.90–0.93 (выше порога 0.7).

Choropleth-легенда с порогами, методом, GVF.

CII fallback: 90 стран, global=41.6.

SSI: 42%.

Кнопка КОПИРОВАТЬ — до 500 КБ.

Marker-fallback — 180 маркеров на слой.

20.2. Что требует доработки
Кнопка «Включить все» — цикл обрабатывает не все 75 слоёв.

Визуальная активность кнопок слоёв — класс active не возвращается после загрузки.

Размер copy-data.js при полной активации — должен быть ~350 КБ.

4 остальные карты — проверки не выполнены.

20.3. Порядок дальнейших работ
Доделать кнопку «Включить все» в Metrics Map.

Визуальная активность кнопок.

Проверить размер снапшота при полной активации.

Перейти к Event Map — основная карта, на неё ссылаются все остальные.

Semantic Map.

Forecast Map.

Network Map.

Проверить автономность всех 5 карт командой из раздела 19.


Файл `METRICS-MAP-MANIFEST.md` содержит теперь 20 разделов:

| Раздел | Содержание |
|--------|------------|
| 1 | Назначение и место в экосистеме (5 карт, почему именно 5) |
| 2 | Структура папки (20 файлов) |
| 3 | DAG загрузки (16 шагов) |
| 4 | Функциональная матрица |
| 5 | 75 слоёв — распределение |
| 6 | Как работает каждый тип слоя |
| 7 | Автономность (R1–R6) |
| 8 | Чек-лист верификации |
| 9 | Методы классификации |
| 10 | Палитры ColorBrewer |
| 11 | Текущее состояние |
| 12 | Что нужно доделать |
| 13 | Главный файл для ввода в новый чат |
| 14 | Правила проекта |
| **15** | **Полный каталог 75 слоёв (ID, метод, палитра, источник, что показывает)** |
| **16** | **4 остальные карты + план проверки каждой** |
| **17** | **API-эндпоинты, ожидаемые на сервере** |
| **18** | **Контракты между картами (навигация, manifest, failure domain)** |
| **19** | **Чек-лист проверки всех 5 карт (скрипт)** |
| **20** | **Контрольные точки состояния + порядок дальнейших работ** |

**Ожидаемый размер:** ~35–45 КБ, ~900–1100 строк.

**Использование:** скопировать весь файл в новый чат — ИИ сразу получает полную картину, знает, что где и что осталось доделать.


1. Размер `METRICS-MAP-MANIFEST.md` (ожидание ~35–45 КБ)
2. Первые 30 строк файла (`head -30`) — проверить корректность заголовка
3. Последние 30 строк (`tail -30`) — проверить корректность раздела 20

- Раздел 21 «История изменений» — список всех правок версии 1.0 → 1.1
- Раздел 22 «Диагностика через консоль» — команды JavaScript для быстрой проверки состояния
- Раздел 23 «Справка HELP для Metrics Map» — текст справки, которая открывается по кнопке HELP


---

## 19. ИСТОРИЯ ИЗМЕНЕНИЙ

### 21.1. Версия 1.0 → 1.1 — 28.09.2026

**Файл `js/layers.js`:**

- **Что было:** `enableAllLayers` добавляла все слои в `activeLayerIds` до цикла. Затем `loadLayer(id)` для каждого слоя. Но `loadLayer` первым действием проверяет `if (activeLayerIds.has(layerId))` → toggle-выключение. Итог: цикл не загружал слои, а выключал их.
- **Что стало:** убран предварительный `activeLayerIds.add()`. Перед `loadLayer(id)` — принудительное `activeLayerIds.delete(layerId)`. `loadLayer` идёт по ветке «включение», вызывает `interceptLoad` → fallback → загрузка данных.
- **Логи:** добавлены в каждую итерацию: `[enableAllLayers] Старт`, подсчёт `ok/empty/fail/skipped`, финальная строка `[enableAllLayers] Всего: 75, с данными: N, пусто: N, ошибок: N, пропущено: N`.
- **Рационале:** дефект toggle-логики (Martin 2003: Single Responsibility нарушен — функция загрузки делала и загрузку, и toggle).

**Файл `js/metrics-map.js`:**

- **Что было:** `interceptLoad` обрабатывал только `vizType='choropleth'` и `vizType='series'`. Для `vizType='marker'` возвращал `false` — управление отдавалось `layers.js`, который делал `fetch('/api/layers/<id>')` и получал 404. Данные не появлялись.
- **Что стало:** добавлен метод `loadMarkerLayer(layer)` + `renderMarkerFallback(layer)`. Теперь 6 marker-слоёв (`vix-futures`, `cftc-cot`, `insider-trading`, `sec-filings`, `short-interest`, `bankruptcy-filings`) получают fallback: 2 маркера на каждую из 90 стран = 180 маркеров на слой.
- **Рационале:** закрыт пробел обработки. Marker-слои теперь работают автономно.

**Файл `js/copy-data.js`:**

- **Что было:** снапшот ~40 КБ. Собирал статистику, слои, маркеры, DOM-структуру.
- **Что стало:** расширенная версия. 15 секций: полная конфигурация 75 слоёв, матрица слоёв, диагностика по vizType и категориям, данные активных слоёв (все 90 стран × N слоёв), choropleth-легенда, страны с координатами, DOM панели слоёв, карта, палитры, панель статуса.
- **Целевой размер:** 300–500 КБ при 75 слоях с данными.

### 21.2. Что предшествовало версии 1.0

**28.09.2026, ранее:**

- Создано 20 файлов автономного пакета.
- `layers.js` с 75 слоями (61 базовый + 14 API-модулей).
- `maps-config.js` — 66 переопределений, 14 API-модулей.
- `series-adapter.js` — 7 spatial proxy, 6 трансформаций.
- `map-controls.js` — Jenks DP O(k·n²), ColorBrewer, GVF.
- `metrics-map.js` — оркестратор decision tree.
- Устранены критические дефекты: BOM в `layers.js`, `logger is not defined`, конфликт `logger.js`/`logger.mjs`.

### 21.3. Что было в старых версиях

**Папка `./1/`** — первая версия Metrics Map. Содержала файлы `index (1).html`, `index (2).html`, `index.html`, `init.js`, `layers.js`, `map-controls.js`, `maps-config.js`, `metrics-map.css`, `metrics-map.js`, `presets.json`, `series-adapter.js`. Многочисленные дубликаты с суффиксами `(1)`, `(2)`.

**Папка `./2/`** — вторая версия (автономный пакет). Содержала 20 файлов с чистой структурой: `AUTONOMY-CHARTER.md`, `manifest.json`, `core.js`, `countries.js`, `layers.js`, `maps-config.js`, `map-controls.js`, `markers.js`, `metrics-map.js`, `series-adapter.js`, `copy-data.js`, `heat-timeline.js`, `ssi.js`, `refresh.js`, `cii.js`, `logger.js`, `init.js`, `presets.json`, `metrics-map.css`, `index.html`.

**Папка `./3/`** — скрипт деплоя.

**Другие устаревшие файлы:**

- `js/layers60.js` — 60 слоёв (неполный набор).
- `js/layers60 СЛОЁВ, 12 КАТЕГОРИЙ.js` — вариант.
- `js/LAYERSCrucix.JS` — устаревшая версия.
- `js/layers-dynamic.js` — загрузка из реестра API.
- `js/country-boundaries.js` — заменён на `map-controls.js`.
- `js/geo-map-core.js` — ESM-модуль.
- `js/graph-view.js`, `js/graph-panel.js`, `js/preset-multi-map.js`, `js/relations.js` — для Network Map.
- `js/map-ui.js` — обёртка MapLibre.
- `js/metrics-map-config.js`, `js/metrics-map-layers.js`, `js/metrics-map-orchestrator.js`, `js/metrics-map-series-adapter.js` — альтернативные дубли.
- `js/logger.mjs`, `js/news-markers.mjs`, `js/popups.mjs` — ESM-версии.
- `js/modules/`, `js/popup/`, `blocks/`, `templates/` — ESM-каталоги.
- `css/cii.css`, `css/core.css`, `css/geo-map.css`, `css/header.css`, `css/layers-panel.css`, `css/map.css`, `css/responsive.css` — старые CSS из geo-map.

Все эти файлы перемещаются в `_archive/` скриптом `clean-archive.sh`. Ничего не удаляется.

---

## 20. ДИАГНОСТИКА ЧЕРЕЗ КОНСОЛЬ БРАУЗЕРА

Команды JavaScript для быстрой проверки состояния Metrics Map. Открыть консоль (F12), вставить по одной.

### 22.1. Базовая проверка

```javascript
// Количество слоёв
console.log('Слоёв:', window.allLayers?.length);

// Количество стран
console.log('Стран:', window.ALL_COUNTRIES?.length);

// Количество активных слоёв
console.log('Активных:', window.activeLayerIds?.size);

// Количество кэшированных слоёв (с данными)
console.log('В кэше:', Object.keys(window.layerCache || {}).length);

// Количество маркеров
console.log('Маркеров:', (window.markerData || []).length);

// Маркеры на карте (должны быть L.layerGroup)
console.log('Слой маркеров:', !!window.markersLayer);

// Карта
console.log('Карта:', !!window.map);
console.log('Центр:', window.map?.getCenter());
console.log('Zoom:', window.map?.getZoom());

// CII
console.log('CII panel:', !!document.getElementById('cii-panel'));

// SSI
console.log('SSI:', document.getElementById('ssi-label')?.textContent);

// MetricsMap
console.log('MetricsMap:', window.MetricsMap?.stats());
22.2. Проверка API-эндпоинтов
javascript
// Проверка, отвечает ли API для конкретного слоя
async function checkApi(layerId) {
    const url = `/api/layers/${layerId}/featurecollection`;
    try {
        const r = await fetch(url);
        console.log(`${layerId}: HTTP ${r.status}`);
    } catch (e) {
        console.log(`${layerId}: ошибка ${e.message}`);
    }
}

// Проверить один слой
await checkApi('inflation');

// Проверить все choropleth
for (const l of window.allLayers.filter(x => x.vizType === 'choropleth')) {
    await checkApi(l.id);
}
22.3. Проверка fallback-генераторов
javascript
// Проверить, что fallback работает
if (window.MetricsMap && typeof window.MetricsMap.renderFallback === 'function') {
    console.log('renderFallback: OK');
} else {
    console.log('renderFallback: ОТСУТСТВУЕТ');
}

if (typeof window.MetricsMap.renderMarkerFallback === 'function') {
    console.log('renderMarkerFallback: OK');
} else {
    console.log('renderMarkerFallback: ОТСУТСТВУЕТ');
}
22.4. Проверка классификации
javascript
// Проверить jenksBreaks
const values = [1, 5, 12, 25, 40, 60, 80, 95];
console.log('Jenks:', window.jenksBreaks?.(values, 5));

// Проверить GVF
const breaks = window.jenksBreaks(values, 5);
console.log('GVF:', window.computeGVF?.(values, breaks));
22.5. Проверка конфигурации слоя
javascript
// Посмотреть конфигурацию конкретного слоя
console.log(window.getLayerConfig?.('pmi'));
// Ожидание: { method: 'manual', palette: 'RdYlGn5', manualBreaks: [42,47,53,58] }

// Посмотреть палитру
console.log(window.getColorPalette?.('OrRd'));
// Ожидание: массив из 5 hex-цветов
22.6. Полная диагностика одной командой
javascript
(() => {
    const stats = window.MetricsMap?.stats() || {};
    console.log('=== METRICS MAP ДИАГНОСТИКА ===');
    console.log('Слоёв:', window.allLayers?.length);
    console.log('Стран:', window.ALL_COUNTRIES?.length);
    console.log('Активных:', window.activeLayerIds?.size);
    console.log('В кэше:', Object.keys(window.layerCache || {}).length);
    console.log('Маркеров:', (window.markerData || []).length);
    console.log('Распределение:', stats);
    console.log('Карта:', !!window.map);
    console.log('CII:', document.getElementById('cii-label')?.textContent || '—');
    console.log('SSI:', document.getElementById('ssi-label')?.textContent || '—');
    console.log('================================');
})();
22.7. Диагностика после Ctrl+F5
javascript
// Через 5 секунд после загрузки
setTimeout(() => {
    console.log('LAYERS.JS:', !!window.allLayers);
    console.log('COUNTRIES.JS:', !!window.ALL_COUNTRIES);
    console.log('METRICS-MAP.JS:', !!window.MetricsMap);
    console.log('MAP-CONTROLS.JS:', typeof window.applyChoropleth === 'function');
    console.log('INIT.JS (loadData):', typeof window.loadData === 'function');
    console.log('Карта:', !!window.map);
    if (window.map) {
        console.log('Границы загружены:', !!window.geoJsonData);
        console.log('Элементов в geoJSON:', window.geoJsonData?.features?.length);
    }
}, 5000);
22.8. Принудительный запуск загрузки
javascript
// Загрузить все слои вручную
window.enableAllLayers();

// Через 20 секунд проверить состояние
setTimeout(() => {
    console.log('После enableAllLayers:');
    console.log('В кэше:', Object.keys(window.layerCache || {}).length);
    console.log('Активных:', window.activeLayerIds?.size);
    console.log('Маркеров:', (window.markerData || []).length);
}, 20000);
22.9. Сброс состояния
javascript
// Полный сброс
window.layerCache = {};
window.activeLayerIds = new Set(['all']);
window.markerData = [];
window.allMarkers = [];
window.currentChoroplethData = null;
console.log('Сброс выполнен');
## 21. СПРАВКА HELP ДЛЯ METRICS MAP
Текст справки, которая открывается по кнопке HELP (/help или локальный файл). Разместить в docs/help/ru/metrics-map.txt и docs/help/en/metrics-map.txt.

23.1. Русская версия
================================================================
CRUCIX — METRICS MAP — СПРАВКА
================================================================

Metrics Map — карта количественных индикаторов по 90 странам
мира. 75 слоёв в 13 категориях. Автономная карта в экосистеме
из 5 карт Crucix.

----------------------------------------------------------------
НАЗНАЧЕНИЕ
----------------------------------------------------------------

Metrics Map визуализирует числовые показатели (экономика,
финансы, ESG, кибербезопасность, энергетика, здоровье,
социальные метрики, геополитика, военные расходы, угрозы,
разведка, новости) через цветовую заливку стран (choropleth).

Каждая страна получает цвет в зависимости от значения
индикатора. Легенда показывает пороги классов и качество
классификации (GVF).

----------------------------------------------------------------
НАВИГАЦИЯ
----------------------------------------------------------------

В верхней панели 5 кнопок переключения между картами:
- Events — карта событий
- Metrics — карта индикаторов (текущая)
- Semantic — карта семантики
- Network — карта связей
- Forecast — карта прогнозов

Кнопки НА ГЛАВНУЮ, КОПИРОВАТЬ, Список страниц, HELP, Тепловая,
Хронология, PDF — общие для всех карт.

----------------------------------------------------------------
ПАНЕЛЬ СЛОЁВ (справа)
----------------------------------------------------------------

75 слоёв в 13 категориях:
- Экономика (15)
- Финансы (26)
- ESG (8)
- Геополитика (6)
- Энергетика (5)
- Здоровье (3)
- Социальные (3)
- Кибер (2)
- Военный (2)
- Угрозы (1)
- Разведка (1)
- Новости (1)
- Другие (2)

Как работать:
1. Кликните на слой — он активируется, страны закрасятся.
2. Повторный клик — слой выключается.
3. «Включить все» — загружает все 75 слоёв последовательно.
4. «Выключить все» — отключает все слои.
5. Поиск — фильтрация по названию или ID.

----------------------------------------------------------------
КНОПКИ
----------------------------------------------------------------

🔍 Поиск слоёв — фильтр по подстроке.

📋 КОПИРОВАТЬ — копирует полный снапшот состояния (~500 КБ):
- статистика (стран, слоёв, активных, маркеров)
- конфигурация всех 75 слоёв
- матрица слоёв (ID × vizType × метод × палитра)
- диагностика по vizType и категориям
- данные всех активных слоёв (90 стран на слой)
- choropleth-легенда с порогами и GVF
- координаты всех стран
- DOM панели слоёв
- панель статуса, SSI, CII

📊 CII — переключение режима CII (Country Instability
Index). Показывает индекс нестабильности стран.

🌡️ Тепловая — тепловая карта по маркерам.

📅 Хронология — временная шкала событий.

📄 PDF — экспорт карты в PNG.

🌐 RU/EN — переключение языка интерфейса.

----------------------------------------------------------------
ВИЗУАЛЬНЫЕ ЭЛЕМЕНТЫ НА КАРТЕ
----------------------------------------------------------------

Легенда (внизу слева): пороги классов, метод классификации,
GVF (Goodness of Variance Fit).

Статистика (вверху справа): количество маркеров, стран.

SSI (внизу справа): индекс напряжённости.

CII-панель (внизу): топ-5 нестабильных стран.

----------------------------------------------------------------
ИСТОЧНИКИ ДАННЫХ
----------------------------------------------------------------

1. Реальные API — если работают на сервере.
2. Автономный fallback — если API недоступен (404):
   данные генерируются из координат стран с корреляцией
   по их статусу (critical → выше, normal → ниже).

----------------------------------------------------------------
АВТОНОМИЯ
----------------------------------------------------------------

Metrics Map полностью автономна. Не зависит от Event Map,
Semantic Map, Network Map, Forecast Map.

Failure domain = 1: сбой в Metrics Map не влияет на 4
остальные карты.

Все данные: локальный world.geojson, локальный countries.js,
локальная конфигурация. Единственная cross-map зависимость —
навигационные ссылки в шапке.

----------------------------------------------------------------
ГОРЯЧИЕ КЛАВИШИ
----------------------------------------------------------------

ESC — закрыть попап.
F5 — перезагрузить.
Ctrl+Shift+R — жёсткая перезагрузка.
Ctrl+F5 — перезагрузка без кеша.

F12 — открыть консоль (для диагностики).

----------------------------------------------------------------
ВЕРСИЯ
----------------------------------------------------------------

Metrics Map, версия 1.1, 2026-09-28.
Полное описание: METRICS-MAP-MANIFEST.md.
Техническая спецификация: ARCHITECTURE.md.
Устав автономии: AUTONOMY-CHARTER.md.

================================================================
23.2. Английская версия
================================================================
CRUCIX — METRICS MAP — HELP
================================================================

Metrics Map is a quantitative indicators map for 90 countries.
75 layers in 13 categories. Autonomous map within the Crucix
ecosystem of 5 maps.

----------------------------------------------------------------
PURPOSE
----------------------------------------------------------------

Metrics Map visualizes numeric indicators (economics, finance,
ESG, cybersecurity, energy, health, social metrics, geopolitics,
military spending, threats, intelligence, news) via choropleth
country fill.

Each country is colored based on indicator value. Legend shows
class breaks and classification quality (GVF).

----------------------------------------------------------------
NAVIGATION
----------------------------------------------------------------

Top bar has 5 map switchers:
- Events — events map
- Metrics — indicators map (current)
- Semantic — semantics map
- Network — relations map
- Forecast — forecasts map

Buttons HOME, COPY, Pages list, HELP, Heat, Timeline, PDF are
common across all maps.

----------------------------------------------------------------
LAYERS PANEL (right)
----------------------------------------------------------------

75 layers in 13 categories:
- Economics (15)
- Finance (26)
- ESG (8)
- Geopolitics (6)
- Energy (5)
- Health (3)
- Social (3)
- Cyber (2)
- Military (2)
- Threats (1)
- Intelligence (1)
- News (1)
- Other (2)

How to use:
1. Click a layer — it activates, countries get colored.
2. Click again — layer deactivates.
3. «Enable all» — loads all 75 layers sequentially.
4. «Disable all» — deactivates all layers.
5. Search — filter by name or ID.

----------------------------------------------------------------
BUTTONS
----------------------------------------------------------------

🔍 Layer search — filter by substring.

📋 COPY — copies full state snapshot (~500 KB).

📊 CII — toggles CII mode (Country Instability Index).

🌡️ Heat — heat map by markers.

📅 Timeline — events timeline.

📄 PDF — exports map to PNG.

🌐 RU/EN — language switcher.

----------------------------------------------------------------
VISUAL ELEMENTS
----------------------------------------------------------------

Legend (bottom left): class breaks, classification method, GVF.

Stats (top right): marker count, country count.

SSI (bottom right): Strategic Stress Index.

CII panel (bottom): top-5 unstable countries.

----------------------------------------------------------------
DATA SOURCES
----------------------------------------------------------------

1. Real APIs — if available on server.
2. Autonomous fallback — if API returns 404: data is generated
   from country coordinates with status-based correlation.

----------------------------------------------------------------
AUTONOMY
----------------------------------------------------------------

Metrics Map is fully autonomous. Does not depend on Event Map,
Semantic Map, Network Map, Forecast Map.

Failure domain = 1: failure in Metrics Map does not affect the
other 4 maps.

----------------------------------------------------------------
VERSION
----------------------------------------------------------------

Metrics Map, version 1.1, 2026-09-28.
Full manifest: METRICS-MAP-MANIFEST.md.
Technical spec: ARCHITECTURE.md.
Autonomy charter: AUTONOMY-CHARTER.md.

================================================================
## 22. ДОРОЖНАЯ КАРТА ДЛЯ 5 КАРТ
24.1. Уровни готовности
Каждая карта проходит 4 уровня готовности:

Уровень	Критерий	Metrics Map
L1: Скелет	index.html + manifest.json + структура папок	✅ Готово
L2: Автономия	R1–R6, 0 cross-map, локальный geojson	✅ Готово
L3: Функционал	Слои работают, fallback, легенда, GVF	⚠️ 90% (кнопка «Включить все»)
L4: Полировка	Help, диагностика, manifest, clean-archive	🔄 В работе
24.2. Состояние 5 карт по уровням
Event Map:

L1: ✅

L2: ⚠️ (требует проверки cross-map)

L3: ⚠️ (map-controls.js использует удалённый GeoJSON)

L4: ⚠️

Metrics Map (эталон):

L1: ✅

L2: ✅

L3: ⚠️ 90%

L4: 🔄

Semantic Map:

L1: ✅

L2: ⚠️ (требует проверки)

L3: ⚠️ (sentiment-adapter не проверен)

L4: ⚠️

Forecast Map:

L1: ✅

L2: ⚠️

L3: ⚠️ (probability-заливка не проверена)

L4: ⚠️

Network Map:

L1: ✅

L2: ⚠️ (не требует world.geojson)

L3: ⚠️ (force-directed не проверен)

L4: ⚠️

24.3. Единый стандарт для всех 5 карт
Каждая карта должна иметь тот же набор файлов, что Metrics Map, только адаптированный под свою специфику:

Корень карты:

index.html — точка входа

manifest.json — паспорт

METRICS-MAP-MANIFEST.md (переименовать по типу: EVENT-MAP-MANIFEST.md, SEMANTIC-MAP-MANIFEST.md, и так далее) — полное описание

ARCHITECTURE.md — DAG загрузки и функциональная матрица

AUTONOMY-CHARTER.md — устав R1–R6

clean-archive.sh — скрипт вычистки

README.md — краткое описание

CSS:

css/<map-name>.css — единый CSS

JS (типовой набор):

js/core.js

js/countries.js

js/layers.js

js/maps-config.js

js/<map-specific-adapter>.js (series-adapter / sentiment-adapter / forecast-adapter / network-adapter)

js/map-controls.js (кроме Network Map — там graph-view.js)

js/markers.js

js/<map-name>-map.js — оркестратор

js/copy-data.js

js/heat-timeline.js

js/ssi.js

js/refresh.js

js/cii.js

js/logger.js

js/init.js

Данные:

data/world.geojson (кроме Network Map)

Пресеты:

presets/presets.json

24.4. План унификации
Шаг 1. Привести Metrics Map к полной готовности (L3 = 100%). Осталось: кнопка «Включить все» и визуальная активность кнопок.

Шаг 2. Перенести архитектуру Metrics Map на Event Map. Event Map — основная карта, на неё ссылаются все остальные. Уже имеет автономность, но map-controls.js использует удалённый GeoJSON.

Шаг 3. Применить ту же архитектуру к Semantic Map. Создать SEMANTIC-MAP-MANIFEST.md, clean-archive.sh, проверить sentiment-adapter.js.

Шаг 4. Применить к Forecast Map. Особенность: probability-заливка (Cressie 1993) с формулой opacity = 0.4 + 0.5 × confidence.

Шаг 5. Применить к Network Map. Особенность: не требует world.geojson, использует SVG force-directed graph (Barabasi 2016).

Шаг 6. Единая проверка всех 5 карт (раздел 19) — финальный чек-лист.

24.5. Порядок по времени
#	Задача	Время	Приоритет
1	Доделать «Включить все» в Metrics Map	30 мин	Высокий
2	Визуальная активность кнопок слоёв	15 мин	Высокий
3	Проверить размер copy-data.js	10 мин	Средний
4	Event Map — проверка автономности	1 час	Высокий
5	Event Map — локальный geojson	30 мин	Высокий
6	Event Map — манифест + clean-archive	45 мин	Средний
7	Semantic Map — проверка автономности	1 час	Средний
8	Semantic Map — sentiment-adapter	1 час	Средний
9	Semantic Map — манифест + clean-archive	45 мин	Средний
10	Forecast Map — проверка автономности	1 час	Средний
11	Forecast Map — probability-заливка	1 час	Средний
12	Forecast Map — манифест + clean-archive	45 мин	Средний
13	Network Map — проверка автономности	1 час	Низкий
14	Network Map — force-directed	1.5 часа	Низкий
15	Network Map — манифест + clean-archive	45 мин	Низкий
16	Финальная проверка всех 5 карт	30 мин	Высокий
Итого		~14 часов
24.6. Универсальный шаблон
Для ускорения работы с остальными 4 картами можно создать универсальный шаблон _template/, в котором лежат все типовые файлы с плейсхолдерами <MAP_NAME>, <MAP_TYPE>, <LAYER_COUNT>. При создании новой карты достаточно подставить значения.

Шаблон содержит:

index.html.template

manifest.json.template

ARCHITECTURE.md.template

AUTONOMY-CHARTER.md.template

clean-archive.sh.template

js/core.js.template

js/map-controls.js.template

js/copy-data.js.template

js/init.js.template

css/map.css.template

Это архитектурное решение соответствует принципу DRY (Hunt & Thomas 1999) — Don't Repeat Yourself. Типовые файлы создаются один раз, адаптируются для каждой карты заменой плейсхолдеров.

24.7. Гарантия совместимости
При унификации обязательно проверяется, что:

Все 5 карт навигационно связаны (раздел 18.2).

Каждая карта имеет свой mapType (раздел 18.3).

Все manifest.json соответствуют схеме (раздел 18.4).

Failure domain = 1 для каждой (раздел 18.6).

Проверка автономии проходит (раздел 19).

## 23. БЫСТРЫЙ СТАРТ ДЛЯ НОВОГО РАЗРАБОТЧИКА
25.1. Если вы только начали работать с Metrics Map
Прочитайте в таком порядке:

Раздел 1 — что такое Metrics Map и её место в экосистеме.

Раздел 2 — структура папки.

Раздел 5 — распределение 75 слоёв.

Раздел 6 — как работает каждый тип слоя.

Раздел 11 — текущее состояние.

Раздел 12 — что нужно доделать.

25.2. Если вы нашли баг
Откройте консоль (F12).

Выполните команду из раздела 22.6 — полная диагностика.

Проверьте API конкретного слоя (раздел 22.2).

Посмотрите, работает ли fallback (раздел 22.3).

Сверьтесь с разделом 21 — история изменений.

25.3. Если хотите добавить новый слой
Откройте js/layers.js.

Добавьте запись в DEMO_LAYERS:

javascript
{ id: "new-layer", name: "Новый слой", color: "#ff0000", icon: "📊", category: "economics", vizType: "choropleth" }
Если vizType: "series" — добавьте в js/maps-config.js в LAYER_CLASSIFICATION с method и palette, а в js/series-adapter.js — в MODULE_CONFIG spatial proxy и трансформацию.

Обновите presets/presets.json, если слой нужен в пресетах.

Обновите METRICS-MAP-MANIFEST.md (раздел 15).

25.4. Если хотите добавить новую категорию
Добавьте в DEMO_LAYERS слои с новым category.

В renderLayerPanel (файл js/layers.js) добавьте иконку и имя категории в categoryIcons и categoryNames.

Обновите MAP_TYPES.metrics в js/maps-config.js.

Обновите manifest и METRICS-MAP-MANIFEST.md (раздел 5).

25.5. Если нужно изменить классификацию слоя
Откройте js/maps-config.js.

Найдите слой в LAYER_CLASSIFICATION.

Измените method, palette или manualBreaks.

Обновите rationale — зачем именно такой выбор.

25.6. Если нужно изменить палитру
Откройте js/maps-config.js.

Найдите COLOR_SCHEMES.

Добавьте новую палитру в sequential или diverging.

Обновите LAYER_CLASSIFICATION для слоёв, использующих палитру.

26. ПРИНЦИПЫ, ПРИМЕНИМЫЕ К ЭТОМУ ДОКУМЕНТУ


grep -c '^## ' METRICS-MAP-MANIFEST.md &&


Дописаны 6 новых разделов:

| Раздел | Содержание |
|--------|------------|
| **21** | История изменений — что было в 1.0, что стало в 1.1, что было в папках `./1/`, `./2/`, `./3/` |
| **22** | Диагностика через консоль браузера — 9 наборов команд JavaScript |
| **23** | Справка HELP — полные тексты для `docs/help/ru/metrics-map.txt` и `docs/help/en/metrics-map.txt` |
| **24** | Дорожная карта для 5 карт — уровни готовности L1–L4, единый стандарт, план унификации на 14 часов |
| **25** | Быстрый старт для нового разработчика — как читать документ, как искать баги, как добавлять слои/категории/палитры |
| **26** | Принципы проекта, применимые к документу |


---

## 24. ТЕСТИРОВАНИЕ

### 27.1. Принципы тестирования

1. **Каждый тип слоя тестируется отдельно.** Choropleth (56), series (14), marker (6) — три разные модели визуализации. Сбой в одной не означает сбой в другой.
2. **Тестирование в двух режимах:** с API (реальные данные) и без API (fallback).
3. **Верификация через снапшот.** Кнопка КОПИРОВАТЬ даёт полное состояние — это документ для проверки.
4. **Верификация через консоль.** Команды из раздела 22 дают контрольные метрики.

### 27.2. Сценарий 1. Базовый запуск

**Цель:** проверить, что карта загружается без ошибок.

**Шаги:**
1. Ctrl+Shift+R в браузере.
2. F12 — открыть консоль.
3. Дождаться строки `INIT.JS готов` (около 3 секунд).

**Ожидание в консоли:**
CORE.JS загружен
COUNTRIES.JS загружен
Загружено стран: 90
LAYERS.JS готов (75 слоёв, версия 1.1)
MAPS-CONFIG.JS готов (66 переопределений, 14 API-модулей)
SERIES-ADAPTER.JS готов (14 модулей)
MAP-CONTROLS.JS готов (Metrics Map, автономный v4.0)
MARKERS.JS загружен
METRICS-MAP.JS готов (автономный, версия 1.1, marker-fallback встроен)
COPY-DATA.JS загружен (Metrics Map, слои-фокус ~500 КБ)
HEAT-TIMELINE.JS загружен
SSI.JS загружен
REFRESH.JS загружен
CII.JS готов (API + fallback)
LOGGER.JS загружен
window.Logger установлен
INIT.JS готов
Границы загружены из data/world.geojson (автономно)
[MetricsMap] Инициализация оркестратора
[MetricsMap] Слоёв: 75
[MetricsMap] Series-модулей: 14


**Проверка:** ни одной строки `Failed to load resource` для критичных файлов. Допустимы только 404 для `/api/cii-api` и `/api/layers/<id>` — они обрабатываются fallback.

**Критерий приёмки:** все 75 слоёв доступны, карта показывает границы, панель слоёв заполнена.

### 27.3. Сценарий 2. Тестирование choropleth-слоя

**Цель:** проверить, что choropleth закрашивает 90 стран.

**Шаги:**
1. Кликнуть на слой `pmi` (кнопка «PMI»).
2. Смотреть в консоль.

**Ожидание в консоли:**
[MetricsMap] pmi: choropleth API недоступен (HTTP 404) → fallback
[Choropleth] method=manual, breaks=[42, 47, 53, 58], GVF=0.9xxx
[Choropleth] Закрашено стран: 90
[MetricsMap] Fallback: pmi → 90 стран, method=manual, palette=RdYlGn5


**Проверка на карте:**
- 90 стран закрашены цветами RdYlGn5.
- Легенда внизу слева: 5 классов с порогами [42, 47, 53, 58].
- Метод в легенде: `manual`.
- GVF в легенде: > 0.7 (зелёный цвет).

**Критерий приёмки:** все 90 стран закрашены, легенда корректна, GVF > 0.7.

### 27.4. Сценарий 3. Тестирование series-слоя

**Цель:** проверить, что series-слой конвертируется через `SeriesAdapter.convert`.

**Шаги:**
1. Кликнуть на слой `pmi-api` (кнопка «PMI — менеджеры по закупкам (порог 50)»).
2. Смотреть в консоль.

**Ожидание в консоли:**
[MetricsMap] pmi-api: series API недоступен (HTTP 404) → fallback
[Choropleth] method=manual, breaks=[42, 47, 53, 58], GVF=0.9xxx
[Choropleth] Закрашено стран: 90
[MetricsMap] Fallback: pmi-api → 90 стран, method=manual, palette=RdYlGn5


**Проверка на карте:**
- Те же 90 стран закрашены.
- Легенда аналогичная choropleth `pmi`.

**Критерий приёмки:** series-слой работает через spatial proxy `all_countries`.

**Дополнительно:** проверить, что spatial proxy выбран правильно — например, для `ovx-api` proxy должен быть `oil_producers` (не `all_countries`). Проверить в `series-adapter.js` секцию `MODULE_CONFIG`.

### 27.5. Сценарий 4. Тестирование marker-слоя

**Цель:** проверить, что marker-слой создаёт 180 маркеров (2 на каждую из 90 стран).

**Шаги:**
1. Кликнуть на слой `insider-trading` (кнопка «Инсайдерская торговля»).
2. Смотреть в консоль.

**Ожидание в консоли:**
[MetricsMap] insider-trading: marker API недоступен (HTTP 404) → marker-fallback
[MetricsMap] Marker Fallback: insider-trading → 180 маркеров
Отображается маркеров: 180 из 180


**Проверка на карте:**
- 180 круглых маркеров на карте.
- Каждый маркер имеет попап с названием.

**Критерий приёмки:** ровно 180 маркеров, попапы работают.

### 27.6. Сценарий 5. Тестирование кнопки «Включить все»

**Цель:** проверить, что цикл `enableAllLayers` проходит по всем 75 слоям без прерывания.

**Шаги:**
1. Ctrl+Shift+R.
2. Дождаться полной загрузки.
3. F12 — консоль.
4. Вставить команду `window.enableAllLayers()` и нажать Enter.
5. **Не переключать вкладки.**
6. Ждать 20–30 секунд.

**Ожидание в консоли:**
[enableAllLayers] Старт
[MetricsMap] inflation: пусто → fallback
[Choropleth] method=jenks, breaks=[...], GVF=0.9199
[MetricsMap] Fallback: inflation → 90 стран
...
[MetricsMap] mobile: пусто → fallback
[Choropleth] method=jenks, breaks=[...], GVF=0.9xxx
[MetricsMap] Fallback: mobile → 90 стран
[enableAllLayers] Всего: 75, с данными: 75, пусто: 0, ошибок: 0, пропущено: 0


**Проверка:**
```javascript
console.log('Кэш:', Object.keys(window.layerCache).length);
console.log('Активных:', window.activeLayerIds.size);
console.log('Маркеров:', (window.markerData || []).length);
Ожидание: 75, 75, 1080 (6 marker-слоёв × 180).

Критерий приёмки: финальная строка Всего: 75, с данными: 75.

Если цикл прервался: прислать последние 5 строк [MetricsMap] — они покажут, на каком слое сбой.

27.7. Сценарий 6. Тестирование кнопки КОПИРОВАТЬ
Цель: проверить, что снапшот содержит все 75 слоёв с данными.

Шаги:

Убедиться, что enableAllLayers завершился с с данными: 75.

Нажать кнопку КОПИРОВАТЬ.

Вставить содержимое буфера в текстовый редактор.

Сохранить как metrics-snapshot.txt.

Проверка:

bash
# Размер
wc -c metrics-snapshot.txt

# Количество слоёв с данными
grep -c "Data (все 90 объектов)" metrics-snapshot.txt
Ожидание: ~350 КБ, 75 совпадений (по одному на слой).

Критерий приёмки: размер 300–500 КБ, 75 слоёв с данными.

27.8. Сценарий 7. Тестирование GVF
Цель: проверить, что классификация каждого слоя даёт GVF > 0.7.

Шаги:

Пройти по 5–10 choropleth-слоям (клик по кнопке, посмотреть в консоль).

Записать GVF для каждого.

Ожидание:

Все GVF в диапазоне 0.90–0.95.

В легенде GVF отображается зелёным (≥ 0.7).

Если GVF < 0.7: слой требует смены метода классификации (например, manual вместо jenks). Проверить LAYER_CLASSIFICATION в maps-config.js.

Критерий приёмки: все проверенные GVF > 0.7.

27.9. Сценарий 8. Тестирование toggle (включение/выключение)
Цель: проверить, что повторный клик по слою выключает его.

Шаги:

Кликнуть на слой pmi — включён.

Кликнуть на слой pmi снова — выключен.

Ожидание:

При включении: [MetricsMap] Fallback: pmi → 90 стран.

При выключении: 🌍 Активных слоёв: 1 (или на 1 меньше).

Проверка: в DOM кнопка pmi не имеет класса active после второго клика.

Критерий приёмки: toggle работает, класс active снимается.

27.10. Сценарий 9. Тестирование легенды
Цель: проверить, что легенда обновляется при смене слоя.

Шаги:

Кликнуть на pmi (manual, RdYlGn5) — проверить легенду.

Кликнуть на inflation (jenks, OrRd) — проверить легенду.

Кликнуть на copper-gold (jenks, RdBu5) — проверить легенду.

Ожидание в легенде:

Для pmi: 5 swatch-ей RdYlGn5, пороги [42, 47, 53, 58], метод manual.

Для inflation: 5 swatch-ей OrRd, пороги Jenks, метод jenks.

Для copper-gold: 5 swatch-ей RdBu5, пороги Jenks.

Критерий приёмки: легенда обновляется корректно для каждого слоя.

27.11. Сценарий 10. Тестирование автономности
Цель: убедиться, что карта работает без сервера.

Шаги:

Отключить сервер (или использовать file:// протокол для index.html).

Открыть карту.

Ожидание:

Карта загружается.

Границы стран отображаются (из data/world.geojson).

При клике на слой — fallback генерирует 90 стран.

Ни одной ошибки Failed to load resource для локальных файлов.

Критерий приёмки: карта работает без API-сервера.

27.12. Сценарий 11. Тестирование cross-map навигации
Цель: проверить, что навигация между 5 картами работает.

Шаги:

В шапке кликнуть на кнопку Events — переход на /event-map/.

Вернуться на /metrics-map/.

Кликнуть на Semantic, Network, Forecast — проверить все переходы.

Ожидание:

Все переходы работают.

Активная карта выделена цветом.

Критерий приёмки: 5 карт навигационно связаны.

27.13. Сценарий 12. Тестирование failure domain
Цель: убедиться, что сбой в одной карте не влияет на другие.

Шаги:

Открыть /metrics-map/.

В консоли вызвать ошибку: throw new Error('test');

Перейти на /event-map/.

Ожидание:

Error зафиксирован в консоли metrics-map.

/event-map/ работает без ошибок.

Критерий приёмки: failure domain = 1.

27.14. Полный чек-лист тестирования
bash
cd "dashboard/public/metrics-map"

# 1. Структура
echo "=== Структура ==="
find . -maxdepth 2 -type f \( -name "*.js" -o -name "*.html" -o -name "*.css" -o -name "*.json" -o -name "*.md" \) | grep -v "_archive\|backups" | sort

# 2. Слои
echo "=== Слои ==="
grep -c 'id:' js/layers.js
grep -o 'id: "[^"]*"' js/layers.js | sort | uniq -d

# 3. Cross-map
echo "=== Cross-map ==="
grep -rn '\.\./' index.html js/*.js | grep -v 'AUTONOMY\|manifest'

# 4. Local geojson
echo "=== Local geojson ==="
grep -n "data/world.geojson" js/map-controls.js
ls -la data/world.geojson

# 5. Методы классификации
echo "=== Методы ==="
grep -c "method:" js/maps-config.js

# 6. Series модули
echo "=== Series ==="
grep -c "SERIES_MODULES" js/maps-config.js
Все критерии должны пройти без ошибок.

## 25. ПРОИЗВОДИТЕЛЬНОСТЬ
28.1. Целевые метрики
Метрика	Целевое значение	Пороговое
Загрузка страницы	< 3 секунд	< 5 секунд
Загрузка одного слоя (fallback)	< 100 мс	< 300 мс
Загрузка 75 слоёв последовательно	< 3 секунд	< 10 секунд
Загрузка одного слоя (API)	< 500 мс	< 2 секунды
Отрисовка choropleth (90 стран)	< 200 мс	< 500 мс
Размер снапшота	300–500 КБ	< 1 МБ
Потребление памяти	< 150 МБ	< 500 МБ
FPS при движении карты	> 30	> 15
28.2. Замеры в браузере
Открытие DevTools → Performance → Record:

javascript
// В консоли — замер времени инициализации
console.time('init');
window.loadData().then(() => {
    console.timeEnd('init');
});
Замер загрузки одного слоя:

javascript
console.time('layer-pmi');
await window.loadLayer('pmi');
console.timeEnd('layer-pmi');
Ожидание: 50–100 мс для fallback.

Замер загрузки всех 75 слоёв:

javascript
console.time('all-layers');
await window.enableAllLayers();
console.timeEnd('all-layers');
Ожидание: 2.5–3 секунды (75 × 30 мс + overhead).

28.3. Узкие места и оптимизация
Узкое место 1: 75 отдельных loadLayer с задержкой 30 мс.

Формула: T = 75 × (t_load + t_delay), где t_delay = 30 мс (захардкожено в setTimeout).

При t_load ≈ 5 мс итог: 75 × 35 = 2625 мс.

Оптимизация:

Сократить t_delay с 30 мс до 10 мс — T = 75 × 15 = 1125 мс.

Использовать Promise.all для параллельной загрузки — но осторожно, может убить API rate limit.

Использовать пакетную обработку: загружать по 10 слоёв параллельно, потом пауза 50 мс.

Узкое место 2: applyChoropleth перебирает 90 стран в каждой итерации.

Для каждого слоя: 90 × find(90) = 8100 операций сравнения. Для 75 слоёв: 607 500 операций.

Оптимизация:

Использовать Map для сопоставления имён стран — O(1) вместо O(n).

Предварительно создавать lookup-таблицу {countryName → layer}.

Узкое место 3: 6 marker-слоёв × 180 маркеров = 1080 маркеров.

Каждый маркер — отдельный L.circleMarker с popup-обработчиком.

Оптимизация:

Использовать L.markerClusterGroup для кластеризации — уже подключён в index.html.

Ограничить отображение 500 маркерами (как в Event Map) — но для метрик достаточно и 1080.

Узкое место 4: logger.js перехватывает console.log.

Каждая строка консоли записывается в window.crucixLogger.logs, обновляет UI-панель, сохраняет в localStorage.

При 75 слоях × ~5 строк = 375 записей лога. Каждая — JSON.stringify + DOM update + localStorage.

Оптимизация:

Отключить перехват console.log в production: if (window.CrucixConfig?.debug). Сейчас логгер работает всегда.

Использовать debounce для обновления панели логов.

Хранить в localStorage не все 375 записей, а только последние 100.

Узкое место 5: copy-data.js при 75 слоях с данными.

Собирает 75 × 90 = 6750 строк данных + конфигурация + легенда + DOM.

Оптимизация:

Сериализовать данные без форматирования (JSON вместо строк с padEnd).

Использовать Blob для сборки больших строк (быстрее чем concat).

28.4. Профилирование через Performance API
javascript
// Замер загрузки одного слоя
performance.mark('layer-start');
await window.loadLayer('pmi');
performance.mark('layer-end');
performance.measure('layer-pmi', 'layer-start', 'layer-end');
console.log(performance.getEntriesByName('layer-pmi'));

// Замер всех загрузок
performance.mark('all-start');
await window.enableAllLayers();
performance.mark('all-end');
performance.measure('all-layers', 'all-start', 'all-end');
console.log(performance.getEntriesByName('all-layers'));
28.5. Мониторинг памяти
javascript
// В Chrome: performance.memory
console.log('Used:', Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), 'МБ');
console.log('Total:', Math.round(performance.memory.totalJSHeapSize / 1024 / 1024), 'МБ');
console.log('Limit:', Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024), 'МБ');
Ожидание после полной загрузки 75 слоёв: ~50–100 МБ.

Если больше 500 МБ — утечка памяти. Проверить:

Не создаются ли новые объекты на каждую итерацию без освобождения.

Не накапливаются ли DOM-элементы в легенде.

28.6. Кеширование
Кеш браузера:

Локальные JS-файлы кешируются браузером по умолчанию.

world.geojson (252 КБ) кешируется на 1 день.

Кеш в памяти:

window.layerCache — хранит данные загруженных слоёв.

При повторной активации слоя данные берутся из кеша, API не вызывается.

Кеш localStorage:

crucix-active-layer — последний активный слой.

crucix-lang — выбранный язык.

crucix-logs — последние 100 записей лога.

28.7. Метрики для мониторинга
javascript
// Полная диагностика производительности
(() => {
    const perf = performance.getEntriesByType('navigation')[0];
    console.log('=== PERFORMANCE ===');
    console.log('DOM ready:', Math.round(perf.domContentLoadedEventEnd - perf.startTime), 'мс');
    console.log('Load:', Math.round(perf.loadEventEnd - perf.startTime), 'мс');
    console.log('Слоёв в кэше:', Object.keys(window.layerCache || {}).length);
    console.log('Маркеров:', (window.markerData || []).length);
    if (performance.memory) {
        console.log('Heap used:', Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), 'МБ');
    }
    console.log('===================');
})();
## 26. БЕЗОПАСНОСТЬ
29.1. Content Security Policy (CSP)
Текущее состояние: CSP не установлен. Это допустимо для локального проекта, но при публикации в интернете потребуется.

Рекомендуемая CSP для Metrics Map:

html
<meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com;
    style-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com;
    img-src 'self' data: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com;
    font-src 'self';
    connect-src 'self' https://unpkg.com https://cdnjs.cloudflare.com;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
">
Что разрешает:

default-src 'self' — все ресурсы по умолчанию только с того же домена.

script-src — локальные скрипты + CDN Leaflet.

style-src — локальные CSS + inline-стили (нужны для динамической легенды) + CDN.

img-src — локальные изображения, data: URIs, тайлы OpenStreetMap.

connect-src — fetch только к тому же домену и CDN.

Что запрещает:

Загрузка скриптов с произвольных доменов.

Вставка через <iframe> (frame-ancestors 'none').

Отправка форм на внешние серверы (form-action 'self').

Применение: вставить <meta> в <head> файла index.html.

29.2. XSS-защита в попапах
Угроза: XSS (Cross-Site Scripting) — внедрение вредоносного JavaScript через пользовательские данные в попапы.

Точки внедрения:

Popup для маркеров. Формируется из feature.properties.label, feature.properties.region, feature.properties.value. Если API вернёт label: '<script>alert(1)</script>' — скрипт выполнится.

Popup для choropleth-стран. Формируется из feature.properties.name.

CII-панель. Формируется из data.countries[].country.

Панель слоёв. Формируется из layer.name, layer.id.

Текущее состояние: данные вставляются через innerHTML без экранирования. Это уязвимость.

Решение — функция escapeHtml:

javascript
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
Применение:

В js/markers.js — popup для маркеров:

javascript
const popup = '<div>' +
    '<strong>' + escapeHtml(item.title || 'Событие') + '</strong><br>' +
    '<span>' + escapeHtml(item.status || '—') + '</span>' +
    '<div>' + escapeHtml(item.countryName || '—') + '</div>' +
    '</div>';
В js/map-controls.js — popup для стран:

javascript
layer.bindPopup('<strong>' + escapeHtml(nameRu) + '</strong><br>' +
                '<span>' + escapeHtml(statusText) + '</span>');
В js/cii.js — CII-панель:

javascript
'<span class="cii-name">' + escapeHtml(c.country) + '</span>' +
'<span class="cii-score">' + escapeHtml(String(c.score)) + '</span>'
В js/layers.js — панель слоёв:

javascript
btn.innerHTML = '<span class="name">' + escapeHtml(layer.name) + '</span>';
Критерий: ни одна пользовательская строка не вставляется в DOM без escapeHtml().

29.3. Защита от prototype pollution
Угроза: если API вернёт JSON с полем __proto__, может произойти загрязнение прототипа.

Решение: использовать Object.create(null) вместо {} для объектов, заполняемых из данных:

javascript
const lookup = Object.create(null);
Применение: в map-controls.js при построении currentChoroplethData, в series-adapter.js при построении features.

29.4. Защита от open redirect
Угроза: если пользователь передаёт параметр ?redirect=..., злоумышленник может перенаправить на другой сайт.

Текущее состояние: навигация между картами использует жёстко зашитые <a href="../event-map/">. Параметры URL не передаются. Уязвимости нет.

Рекомендация: если в будущем появятся query-параметры, валидировать их по whitelist доменов.

29.5. Защита localStorage
Угроза: localStorage доступен для чтения любым скриптом на том же домене. Нельзя хранить токены.

Текущее использование:

crucix-lang — язык ('ru'/'en'). Не секрет.

crucix-active-layer — ID активного слоя. Не секрет.

crucix-refresh-interval — интервал обновления. Не секрет.

crucix-logs — логи (до 100 записей). Могут содержать чувствительные данные (URL, ответы API).

Рекомендация: при публикации в интернете — очищать логи при выходе, не хранить URL с параметрами.

29.6. Защита от CORS-проблем
Текущее состояние: fetch к /api/layers/... — same-origin. CORS не задействован.

При интеграции с внешними API: сервер должен возвращать Access-Control-Allow-Origin для нужного домена.

Рекомендация: не делать fetch напрямую во внешние API из браузера — только через серверный прокси (правило №16 о корзине).

29.7. Безопасность fetch-запросов
Точки fetch:

javascript
// js/map-controls.js
await fetch('data/world.geojson');  // локальный, безопасно

// js/cii.js
await fetch('/api/cii-api');  // same-origin, безопасно

// js/metrics-map.js
await fetch(`/api/layers/${layerId}`);  // same-origin, безопасно
Все fetch — same-origin. Единственное исключение — тайлы OpenStreetMap через Leaflet (загружаются как <img>, CSP не блокирует).

29.8. Валидация входных данных
layerId: проверять, что содержит только [a-z0-9-]:

javascript
if (!/^[a-z0-9-]+$/.test(layerId)) {
    console.warn('Invalid layerId:', layerId);
    return;
}
Координаты: проверять, что lat ∈ [-90, 90], lng ∈ [-180, 180].

Значения индикаторов: проверять, что число, не NaN, в разумных пределах.

29.9. CSP-совместимость динамических стилей
Проблема: legend в map-controls.js устанавливает style.background через JavaScript — это допустимо для CSP.

Не проблема: inline style="..." в HTML — разрешено через 'unsafe-inline' в CSP.

Рекомендация: если ужесточить CSP, убрав 'unsafe-inline', потребуется переделать динамические стили на CSS-классы.

29.10. Чек-лист безопасности
bash
cd "dashboard/public/metrics-map"

# 1. CSP установлен?
grep -n 'Content-Security-Policy' index.html

# 2. escapeHtml используется?
grep -c 'escapeHtml' js/markers.js js/map-controls.js js/cii.js js/layers.js

# 3. Внешние fetch?
grep -rn 'fetch(' js/*.js | grep -v 'data/\|/api/'

# 4. Опасный innerHTML?
grep -rn 'innerHTML' js/*.js | grep -v 'escapeHtml'

# 5. eval / Function?
grep -rn 'eval\|new Function' js/*.js
Критерий: CSP установлен, escapeHtml используется везде, где вставляются данные из API, eval отсутствует.

## 27. ГЛОССАРИЙ
30.1. Основные термины
API (Application Programming Interface) — программный интерфейс, по которому один модуль получает данные от другого. В Metrics Map: /api/layers/<id> возвращает данные конкретного слоя.

Bulkhead Pattern (Паттерн отсеков) — принцип изоляции, при котором сбой в одном компоненте не распространяется на другие. В Crucix: 5 автономных карт, failure domain = 1.

Choropleth (Хороплет) — способ визуализации, при котором регионы (страны) закрашиваются цветом в зависимости от значения индикатора. Основной тип отображения Metrics Map.

Choropleth-легенда — блок UI, показывающий пороги классов, палитру, метод классификации и качество (GVF).

ColorBrewer — система палитр Cindy Brewer, оптимизированных для восприятия. Включает sequential (последовательные) и diverging (дивергентные) схемы.

CII (Country Instability Index) — индекс нестабильности стран. Вычисляется как взвешенная функция статусов стран (critical → 100, normal → 10).

Column-oriented данные — организация данных по столбцам, используется в LAYER_CLASSIFICATION.

Cross-map зависимость — ссылка одного файла карты на файл другой карты через ../other-map/. Запрещена правилом R1.

DAG (Directed Acyclic Graph) — направленный ациклический граф. Используется для описания порядка загрузки скриптов: каждый скрипт зависит от предыдущих, циклов нет.

Diverging (Дивергентная палитра) — цветовая схема, где крайние значения разных знаков (например, −10 и +10) окрашены в контрастные цвета (красный ↔ синий), а середина — в нейтральный. Используется для индикаторов с доменным нулём (PMI 50, спреды).

escapeHtml — функция для экранирования HTML-символов (<, >, &, ", '). Защищает от XSS.

Failure domain (Область отказа) — множество компонентов, затрагиваемых одним сбоем. В Crucix: failure domain = 1 (сбой в одной карте не затрагивает другие).

Fallback (Откат) — резервный механизм при недоступности основного источника данных. В Metrics Map: при 404 API данные генерируются локально.

Fresh-данные — данные, полученные в текущей сессии без кеша.

GVF (Goodness of Variance Fit) — метрика качества классификации Jenks. Формула: GVF = (SDAM − SDCM) / SDAM, где SDAM — сумма квадратов отклонений от среднего, SDCM — сумма квадратов отклонений внутри классов. Домен: 0–1, > 0.7 — хорошо.

Hue (Оттенок) — цветовая координата (красный, синий). В Metrics Map используется только как вспомогательный канал.

Jenks (Метод Дженкса) — алгоритм естественных разрывов для классификации данных. Минимизирует SDCM, сложность O(k·n²). Разработан George Jenks в 1963.

Layer (Слой) — один индикатор в Metrics Map. Пример: pmi, inflation, copper-gold. Всего 75 слоёв.

Leaflet — JavaScript-библиотека для интерактивных карт. Используется в 4 из 5 картах Crucix (кроме Network Map).

Manual breaks (Ручные пороги) — задаваемые экспертом пороги классификации. Пример: PMI [42, 47, 53, 58], где 50 — доменный порог ISM.

MAP_TYPES — конфигурация типов карт в maps-config.js. Определяет, какие категории слоёв относятся к Metrics Map.

Marker (Маркер) — точечный объект на карте. В Metrics Map используется для 6 слоёв (vix-futures, insider-trading и др.).

manifest.json — паспорт карты. Содержит: mapType, версия, количество слоёв, autonomy status.

Munzner 2014 — академическая работа Tamara Munzner «Visualization Analysis and Design». Определяет каналы восприятия и их сепарабельность.

Node.js — среда выполнения JavaScript вне браузера.

Opacity (Прозрачность) — альфа-канал, значение от 0 (полностью прозрачный) до 1 (полностью непрозрачный). Используется в Forecast Map для кодирования уверенности модели.

PWA (Progressive Web App) — веб-приложение с офлайн-режимом. Возможное расширение в будущем.

Quantile (Квантиль) — метод классификации, при котором классы содержат равное количество наблюдений.

R1–R6 — правила автономии карт (см. AUTONOMY-CHARTER.md).

Saturation (Насыщенность) — цветовая координата. В Metrics Map — через палитру ColorBrewer.

SDAM (Sum of Deviations from the Array Mean) — сумма квадратов отклонений от среднего.

SDCM (Sum of Deviations from Class Means) — сумма квадратов отклонений внутри классов.

Sequential (Последовательная палитра) — цветовая схема с постепенным изменением от светлого к тёмному. Используется для индикаторов без доменного нуля (инфляция, безработица).

Series (Серия) — тип слоя, при котором данные приходят как временной ряд одного индикатора (например, PMI США), а не распределение по странам. Конвертируется в choropleth через series-adapter.js.

SeriesAdapter — модуль трансформации series → choropleth. Использует spatial proxy и трансформации.

Spatial proxy (Пространственный прокси) — карта весов, распределяющая глобальный показатель по странам. Пример: для pmi — all_countries (все страны равны), для ovx — oil_producers (веса зависят от добычи нефти).

SSI (Strategic Stress Index) — индекс стратегической напряжённости. В Metrics Map = 42%.

Toggle (Переключатель) — механизм включения/выключения слоя при повторном клике.

VizType (Тип визуализации) — свойство слоя: choropleth, series, marker. Определяет, как слой отображается на карте.

window.CrucixMap — глобальный объект, объявляемый в первом inline-скрипте. Содержит mapType и name.

XSS (Cross-Site Scripting) — атака, при которой злоумышленник внедряет JavaScript через данные, отображаемые на странице.

30.2. Сокращения
API — Application Programming Interface
CII — Country Instability Index
CSP — Content Security Policy
DAG — Directed Acyclic Graph
DP — Dynamic Programming
GVF — Goodness of Variance Fit
HY OAS — High Yield Option-Adjusted Spread
ISM — Institute for Supply Management
OSINT — Open Source Intelligence
PMI — Purchasing Managers' Index
SDAM — Sum of Deviations from Array Mean
SDCM — Sum of Deviations from Class Means
SIGINT — Signals Intelligence
SSI — Strategic Stress Index
UI — User Interface
UX — User Experience
VXX — VIX Short-Term Futures ETN
XSS — Cross-Site Scripting

30.3. Источники данных
ACLED — Armed Conflict Location & Event Data Project
BLS — Bureau of Labor Statistics (США)
CBOE — Chicago Board Options Exchange
CFTC — Commodity Futures Trading Commission
CISA — Cybersecurity and Infrastructure Security Agency
Comtrade — UN Comtrade Database
EIA — US Energy Information Administration
FRED — Federal Reserve Economic Data
GDELT — Global Database of Events, Language, and Tone
IAEA — International Atomic Energy Agency
IRENA — International Renewable Energy Agency
ISM — Institute for Supply Management
ITU — International Telecommunication Union
JHU CSSE — Johns Hopkins University Center for Systems Science and Engineering
NVD — National Vulnerability Database
SEC — Securities and Exchange Commission
SIPRI — Stockholm International Peace Research Institute
UNHCR — UN High Commissioner for Refugees
WHO — World Health Organization

30.4. Академические источники
Brewer 2005 — Cynthia Brewer. «Designing Better Maps: A Guide for GIS Users». ESRI Press.

Cowan 2001 — Nelson Cowan. «The magical number 4 in short-term memory». Behavioral and Brain Sciences.

Cressie 1993 — Noel Cressie. «Statistics for Spatial Data». Wiley.

Dijkstra 1974 — Edsger Dijkstra. «On the role of scientific thought». Из серии EWD.

Gamma et al. 1994 — Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides. «Design Patterns». Addison-Wesley.

Hunt & Thomas 1999 — Andrew Hunt, David Thomas. «The Pragmatic Programmer». Addison-Wesley.

Jenks 1963 — George Jenks, Fred Caspall. «Error on choroplethic maps: definition, measurement, reduction». Annals of the Association of American Geographers.

Martin 2003 — Robert C. Martin. «Agile Software Development: Principles, Patterns, and Practices». Prentice Hall.

Munzner 2014 — Tamara Munzner. «Visualization Analysis and Design». CRC Press.

Nygard 2007 — Michael Nygard. «Release It!». Pragmatic Bookshelf.

Shannon 1948 — Claude Shannon. «A Mathematical Theory of Communication». Bell System Technical Journal.

Tobler 1970 — Waldo Tobler. «A computer movie simulating urban growth in the Detroit region». Economic Geography.

30.5. Термины экосистемы Crucix
Crucix — название проекта. Геополитическая OSINT-платформа из 5 автономных карт.

Crucix_GIT — подготовительная папка для отправки в интернет. Путь: Crucix_GIT.

Event Map — карта событий (маркеры). 84 слоя.

Metrics Map — карта индикаторов (choropleth). 75 слоёв. Текущий документ описывает её.

Network Map — карта графов связей (SVG). 12 слоёв.

Semantic Map — карта семантики текстов. 35 слоёв.

Forecast Map — карта вероятностных прогнозов. 16 слоёв.

Корзина (basket) — единственный источник данных. Путь: data/basket/*.json. Все API-модули читают данные только оттуда.

Сборщик (collector) — скрипт, собирающий данные из внешнего API в корзину. Путь: scripts/collectors/collect-*.mjs.

Центр мониторинга — веб-интерфейс для контроля проекта. URL: http://localhost:3117/monitor.

## 28. ПОЛНАЯ КАРТА ПУТЕЙ И ФАЙЛОВ
31.1. Общая структура проекта Crucix

├── Crucix/                              ← РАБОЧАЯ ПАПКА (разработка и запуск)
│   ├── server.mjs                       ← главный сервер (порт 3117)
│   ├── MANIFEST.md                      ← общий манифест проекта
│   ├── RULES.txt                        ← правила проекта
│   ├── package.json                     ← конфигурация Node.js
│   ├── data/
│   │   └── basket/                      ← ЕДИНСТВЕННЫЙ источник данных
│   │       └── *.json                   ← файлы корзины
│   ├── scripts/
│   │   ├── collectors/                  ← сборщики данных
│   │   │   └── collect-*.mjs
│   │   └── *.mjs                        ← служебные скрипты
│   ├── apis/
│   │   └── sources/                     ← API-модули
│   │       └── *.mjs
│   ├── logs/
│   │   └── collectors/                  ← логи сборщиков
│   │       └── collect-*.log
│   ├── docs/
│   │   ├── help/
│   │   │   ├── ru/                      ← русская документация
│   │   │   │   ├── api/
│   │   │   │   ├── pages/
│   │   │   │   ├── collectors/
│   │   │   │   └── layers/
│   │   │   └── en/                      ← английская документация
│   │   │       ├── api/
│   │   │       ├── pages/
│   │   │       ├── collectors/
│   │   │       └── layers/
│   │   └── page-template.html           ← шаблон новых страниц
│   ├── backups/                         ← резервные копии
│   └── dashboard/
│       └── public/                      ← веб-интерфейс (5 карт)
│           ├── world.geojson            ← общий GeoJSON (копируется в карты)
│           ├── geo-map/                 ← основная (Event Map) — на неё ссылаются
│           ├── event-map/               ← 84 слоя, маркеры
│           ├── metrics-map/             ← 75 слоёв, choropleth (ЭТА КАРТА)
│           ├── semantic-map/            ← 35 слоёв, семантика
│           ├── network-map/             ← 12 слоёв, SVG-граф
│           └── forecast-map/            ← 16 слоёв, вероятность
└── Crucix_GIT/                          ← ПОДГОТОВИТЕЛЬНАЯ ПАПКА
    └── (копии готовых файлов из Crucix/)
31.2. Metrics Map — полная карта путей
Корень карты: dashboard/public/metrics-map/

Файлы в корне карты:

metrics-map/
├── index.html                           ← 5–7 КБ, точка входа
├── manifest.json                        ← 3 КБ, паспорт
├── METRICS-MAP-MANIFEST.md              ← ЭТОТ ФАЙЛ (~70–90 КБ)
├── ARCHITECTURE.md                      ← 15 КБ, DAG загрузки
├── AUTONOMY-CHARTER.md                  ← 6 КБ, устав R1–R6
├── clean-archive.sh                     ← 4 КБ, скрипт вычистки
├── README.md                            ← 3 КБ, краткое описание
├── backups/                             ← автобэкапы правок
│   └── *.$(date +%Y%m%d-%H%M%S)
├── _archive/                            ← устаревшие файлы (после вычистки)
│   ├── _root/                           ← устаревшие файлы в корне
│   ├── js/                              ← устаревшие JS
│   ├── css/                             ← устаревшие CSS
│   ├── js_modules/                      ← устаревший js/modules/
│   ├── js_popup/                        ← устаревший js/popup/
│   ├── blocks/                          ← устаревший blocks/
│   ├── templates/                       ← устаревший templates/
│   ├── _пресеты/                        ← устаревший пресеты/
│   ├── _v1/                             ← архив версии 1
│   ├── _v2/                             ← архив версии 2
│   ├── _v3/                             ← архив версии 3
│   └── other/                           ← скрипты деплоя, дубликаты
│
├── css/                                 ← рабочий CSS
│   └── metrics-map.css                  ← 17 КБ, единственный CSS
│
├── js/                                  ← рабочий JavaScript (15 файлов)
│   ├── core.js                          ← 2.5 КБ
│   ├── countries.js                     ← 10 КБ (копия из geo-map)
│   ├── layers.js                        ← 23 КБ, 75 слоёв
│   ├── maps-config.js                   ← 13 КБ, 66 переопределений
│   ├── series-adapter.js                ← 13 КБ, 14 модулей
│   ├── map-controls.js                  ← 26 КБ, Jenks + ColorBrewer
│   ├── markers.js                       ← 5 КБ
│   ├── metrics-map.js                   ← 12 КБ, оркестратор
│   ├── copy-data.js                     ← 11 КБ, снапшот
│   ├── heat-timeline.js                 ← 4 КБ
│   ├── ssi.js                           ← 3 КБ
│   ├── refresh.js                       ← 3 КБ
│   ├── cii.js                           ← 4 КБ
│   ├── logger.js                        ← 27 КБ
│   └── init.js                          ← 8 КБ
│
├── data/                                ← локальные данные
│   └── world.geojson                    ← 252 КБ, копия из public/
│
└── presets/                             ← пресеты
    └── presets.json                     ← 3.5 КБ, 5 пресетов
31.3. Смежные папки и файлы (не в Metrics Map, но важные)
Geo-Map (эталон):

dashboard/public/geo-map/
├── js/
│   ├── countries.js                     ← 176 стран (копируется в metrics)
│   └── ... (остальные файлы)
└── css/
    ├── core.css                         ← базовые стили
    ├── header.css                       ← топбар, кнопки
    ├── layers-panel.css                 ← панель слоёв
    ├── map.css                          ← карта, легенда, статистика
    ├── responsive.css                   ← адаптивность
    └── cii.css                          ← CII-панель
Общий GeoJSON в корне public:

dashboard/public/world.geojson
Это источник для копирования в data/ каждой карты.

Общие правила:

RULES.txt
MANIFEST.md
Сервер:

server.mjs   ← порт 3117
Скрипт запуска сервера:

bash
cd "Crucix" && node server.mjs
31.4. Служебные URL
Назначение	URL
Metrics Map	http://localhost:3117/metrics-map/
Event Map	http://localhost:3117/event-map/
Semantic Map	http://localhost:3117/semantic-map/
Network Map	http://localhost:3117/network-map/
Forecast Map	http://localhost:3117/forecast-map/
Главная	http://localhost:3117/jarvis
Реестр	http://localhost:3117/registry
Центр мониторинга	http://localhost:3117/monitor
Диагностика	http://localhost:3117/diagnostics
Help	http://localhost:3117/help
CII API	http://localhost:3117/api/cii-api
API слоя	http://localhost:3117/api/layers/<layerId>
API FeatureCollection	http://localhost:3117/api/layers/<layerId>/featurecollection
31.5. API-эндпоинты (полный список)
Choropleth-слои (56):

GET /api/layers/inflation/featurecollection
GET /api/layers/unemployment/featurecollection
GET /api/layers/gdp/featurecollection
GET /api/layers/pmi/featurecollection
... (и так далее для всех choropleth)
Series-слои (14) — особые маршруты:

GET /api/layers/business-optimism
GET /api/layers/consumer-expectations
GET /api/layers/pmi
GET /api/layers/recession
GET /api/layers/copper-gold-ratio
GET /api/layers/hy-spread
GET /api/layers/ovx
GET /api/layers/rublev-dubai
GET /api/layers/sp500-vix
GET /api/layers/vxx
GET /api/layers/yield-curve
GET /api/layers/crypto-fear
GET /api/layers/cyber-threat-index
GET /api/layers/wti-brent-spread
Marker-слои (6):

GET /api/layers/vix-futures
GET /api/layers/cftc-cot
GET /api/layers/insider-trading
GET /api/layers/sec-filings
GET /api/layers/short-interest
GET /api/layers/bankruptcy-filings
CII:

GET /api/cii-api
31.6. Справка HELP (пути)
Русская версия:

docs/help/ru/pages/metrics-map.txt
docs/help/ru/layers/*.txt
Английская версия:

docs/help/en/pages/metrics-map.txt
docs/help/en/layers/*.txt
Справка вызывается:

Кнопкой HELP в шапке: window.open('/help', '_blank')

Маршрутом /help на сервере

31.7. Пресеты (пути)
Metrics Map:

dashboard/public/metrics-map/presets/presets.json
Содержит 5 пресетов:

crucix-metrics-default — все категории

crucix-metrics-economics — экономика

crucix-metrics-finance — финансы + энергия

crucix-metrics-esg — ESG

crucix-metrics-threats — угрозы

31.8. Бэкапы (пути)
Автоматически создаются:

dashboard/public/metrics-map/backups/
Формат имени:

<filename>.$(date +%Y%m%d-%H%M%S)
Пример:

layers.js.20260928-174221
metrics-map.js.20260928-174221
METRICS-MAP-MANIFEST.md.20260928-174221
31.9. Устаревшие файлы — куда переедут (после clean-archive.sh)
Все устаревшие файлы не удаляются, а перемещаются в _archive/:

metrics-map/_archive/
├── _root/                              ← metrics-map-index.html, geo-map.new, README.*.txt
├── js/                                 ← layers60.js, LAYERSCrucix.JS, и др.
├── css/                                ← cii.css, core.css, header.css, и др.
├── js_modules/                         ← бывший js/modules/
├── js_popup/                           ← бывший js/popup/
├── blocks/                             ← бывший blocks/
├── templates/                          ← бывший templates/
├── _пресеты/                           ← бывший пресеты/
├── _v1/                                ← бывший 1/
├── _v2/                                ← бывший 2/
├── _v3/                                ← бывший 3/
└── other/                              ← deploy-all-maps.sh, copy-world-*.sh, world.geojson.root
31.10. Команды для навигации
Открыть корень Metrics Map:

bash
cd "dashboard/public/metrics-map"
Открыть корень проекта Crucix:

bash
cd "Crucix"
Открыть документацию:

bash
cd "docs/help/ru/pages"
Открыть корзину:

bash
cd "data/basket"
Открыть сборщики:

bash
cd "scripts/collectors"
Открыть API-модули:

bash
cd "apis/sources"
Открыть логи сборщиков:

bash
cd "logs/collectors"
Открыть бэкапы проекта:

bash
cd "backups"
Открыть подготовительную папку:

bash
cd "Crucix_GIT"
31.11. Команды для проверки структуры
Показать структуру Metrics Map:

bash
cd "dashboard/public/metrics-map" && \
find . -maxdepth 2 -type f \( -name "*.js" -o -name "*.html" -o -name "*.css" -o -name "*.json" -o -name "*.md" \) | grep -v "_archive\|backups" | sort
Показать структуру всех 5 карт:

bash
cd "dashboard/public" && \
for map in event-map metrics-map semantic-map network-map forecast-map; do
done
Проверить размеры всех критичных файлов Metrics Map:

bash
cd "dashboard/public/metrics-map" && \
      js/*.js css/*.css data/*.geojson presets/*.json 2>/dev/null | sort -n
31.12. Команды для запуска и остановки
Запустить сервер:

bash
cd "Crucix" && node server.mjs
Остановить сервер:

bash
pkill -f "node server.mjs"
Остановить и подождать 2 секунды:

bash
pkill -f "node server.mjs" && sleep 2
Перезапустить сервер:

bash
pkill -f "node server.mjs" && sleep 2 && \
cd "Crucix" && node server.mjs
31.13. Команды для работы с файлами
Создать бэкап файла:

bash
cd "dashboard/public/metrics-map" && \
mkdir -p backups && \
cp js/layers.js "backups/layers.js.$(date +%Y%m%d-%H%M%S)"
Проверить синтаксис JavaScript:

bash
cd "dashboard/public/metrics-map" && \
node --check js/layers.js
Проверить все JS-файлы:

bash
cd "dashboard/public/metrics-map" && \
for f in js/*.js; do
    echo -n "$f: "
done
Найти cross-map зависимости:

bash
cd "dashboard/public/metrics-map" && \
grep -rn '\.\./' index.html js/*.js | grep -v 'AUTONOMY\|manifest'
Посчитать слои:

bash
cd "dashboard/public/metrics-map" && \
grep -c 'id:' js/layers.js
31.14. Команды для отладки
Проверить наличие обязательных файлов:

bash
cd "dashboard/public/metrics-map" && \
for f in index.html manifest.json \
         js/core.js js/countries.js js/layers.js js/maps-config.js \
         js/series-adapter.js js/map-controls.js js/markers.js \
         js/metrics-map.js js/copy-data.js js/heat-timeline.js \
         js/ssi.js js/refresh.js js/cii.js js/logger.js js/init.js \
         css/metrics-map.css data/world.geojson presets/presets.json; do
done
Показать последние изменения:

bash
cd "dashboard/public/metrics-map" && \
ls -lat js/*.js | head -10
Показать все бэкапы:

bash
cd "dashboard/public/metrics-map" && \
ls -la backups/ | tail -20
31.15. Итоговая формула: где что искать
Если нужно найти файл карты:
dashboard/public/<map-name>/

Если нужно найти общие данные:
dashboard/public/world.geojson

Если нужно найти справку:
docs/help/ru/ (или en/)

Если нужно найти корзину:
data/basket/

Если нужно найти сборщик:
scripts/collectors/collect-*.mjs

Если нужно найти API-модуль:
apis/sources/*.mjs

Если нужно найти логи сборщика:
logs/collectors/collect-*.log

Если нужно найти бэкапы:
backups/ (общие) или <map>/backups/ (локальные)

Если нужно найти правила:
RULES.txt

Если нужно найти общий манифест:
MANIFEST.md

Если нужно найти сервер:
server.mjs

Если нужно найти главную страницу:
http://localhost:3117/jarvis

Если нужно найти центр мониторинга:
http://localhost:3117/monitor

grep -c '^## ' METRICS-MAP-MANIFEST.md &&


Дописаны 5 разделов:

| Раздел | Содержание |
|--------|------------|
| **27** | Тестирование — 14 сценариев (базовый запуск, choropleth, series, marker, кнопка «Включить все», КОПИРОВАТЬ, GVF, toggle, легенда, автономность, cross-map навигация, failure domain, чек-лист) |
| **28** | Производительность — 8 целевых метрик, замеры через Performance API, 5 узких мест с оптимизацией, мониторинг памяти, кеширование |
| **29** | Безопасность — CSP, XSS-защита (escapeHtml), prototype pollution, open redirect, localStorage, CORS, валидация данных, чек-лист безопасности |
| **30** | Глоссарий — 60+ терминов (Choropleth, Jenks, GVF, Bulkhead, DAG и др.), 18 сокращений, 19 источников данных, 12 академических источников, 10 терминов экосистемы Crucix |
| **31** | Полная карта путей — структура проекта, полная карта Metrics Map, смежные папки, служебные URL, API-эндпоинты, справка, пресеты, бэкапы, устаревшие файлы, 30+ команд навигации и отладки |

# METRICS MAP — АРХИТЕКТУРНАЯ СПЕЦИФИКАЦИЯ

**Версия карты:** 1.2
**Расположение:** `dashboard/public/metrics-map/`
**Сервер:** `http://localhost:3117/metrics-map/`
**Режим:** FULL ISOLATION, failure domain = 1

---


## 1. НАЗНАЧЕНИЕ И МЕСТО В ЭКОСИСТЕМЕ

### 1.1. Экосистема Crucix — 5 автономных карт

Crucix — геополитическая OSINT-платформа из 5 карт:

1. **Event Map** (`/event-map/`) — 84 слоя, маркеры событий.
2. **Metrics Map** (`/metrics-map/`) — **75 слоёв**, choropleth (эта карта).
3. **Semantic Map** (`/semantic-map/`) — 35 слоёв, семантика текстов.
4. **Forecast Map** (`/forecast-map/`) — 16 слоёв, вероятностные прогнозы.
5. **Network Map** (`/network-map/`) — 12 слоёв, SVG force-directed.

### 1.2. Что делает Metrics Map

Metrics Map визуализирует **числовые индикаторы по 90 странам мира**. Каждый слой — один индикатор:

- **Choropleth (56 слоёв)** — заливка стран цветом по значению индикатора.
- **Series (14 слоёв)** — временные ряды (например, PMI США), конвертируются в choropleth через `SeriesAdapter`.
- **Marker (6 слоёв)** — точечные объекты (VIX фьючерсы, инсайдерская торговля).

**Всего: 75 слоёв в 13 категориях.**

### 1.3. Автономность

- **R1:** ноль `../other-map/` ссылок в скриптах, fetch, link. Только навигационные `<a href>`.
- **R2:** локальный `data/world.geojson` (252 КБ).
- **R3:** ровно 75 слоёв Metrics Map, чужих — 0.
- **R4:** свои `maps-config.js` и `presets.json`.
- **R5:** `manifest.json` → `local_cross_map: 0`, `failure_domain: 1`.
- **R6:** сбой карты не затрагивает 4 остальные.

---

## 2. СТРУКТУРА ПАПКИ

metrics-map/
├── index.html
├── manifest.json
├── METRICS-MAP-MANIFEST.md
├── METRICS-MAP-ARCHITECTURE.md (этот файл)
├── AUTONOMY-CHARTER.md
├── clean-archive.sh
├── backups/
├── _archive/
├── css/
│   └── metrics-map.css
├── js/
│   ├── core.js
│   ├── countries.js
│   ├── layers.js
│   ├── maps-config.js
│   ├── series-adapter.js
│   ├── map-controls.js
│   ├── markers.js
│   ├── metrics-map.js
│   ├── copy-data.js
│   ├── heat-timeline.js
│   ├── ssi.js
│   ├── refresh.js
│   ├── cii.js
│   ├── logger.js
│   └── init.js
├── data/
│   └── world.geojson
└── presets/
    └── presets.json

---

## 3. DAG ЗАГРУЗКИ (16 шагов, порядок критичен)

| # | Файл | Роль | Зависит от |
|---|------|------|-----------|
| S01 | inline `<script>` | `window.CrucixMap = {mapType:'metrics'}` | — |
| S02 | `core.js` | `LANG_DATA`, `showNotification`, `setLanguage`, `markerData = []` | CrucixMap |
| S03 | `countries.js` | `ALL_COUNTRIES[90]` | — |
| S04 | `layers.js` | `allLayers[75]`, `layerCache`, `activeLayerIds`, `enableAllLayers`, `loadLayer` | — |
| S05 | `maps-config.js` | `LAYER_CLASSIFICATION`, `COLOR_SCHEMES`, `getLayerConfig`, `getColorPalette` | allLayers |
| S06 | `series-adapter.js` | `SeriesAdapter.convert()` — 14 модулей | maps-config |
| S07 | `map-controls.js` | `loadCountryBoundaries`, `applyChoropleth`, `jenksBreaks`, `computeGVF`, экспорт `window.currentChoroplethConfig` | Leaflet, countries |
| S08 | `markers.js` | `generateAllMarkers`, `updateMarkers`, `renderLayerPanel` | allLayers, map |
| S09 | `metrics-map.js` | `MetricsMap` оркестратор: `interceptLoad`, `fetchWithTimeout`, `renderFallback`, `renderMarkerFallback` | series-adapter, map-controls |
| S10 | `copy-data.js` | `window.copyAllData` — снапшот состояния | — |
| S11 | `heat-timeline.js` | `toggleHeat`, `toggleTimeline` | map |
| S12 | `ssi.js` | `calculateSSI`, `updateLegend` | countries |
| S13 | `refresh.js` | `startAutoRefresh`, `refreshMapData` | — |
| S14 | `cii.js` | `updateCII` с fallback | countries, map-controls |
| S15 | `logger.js` | `CrucixLogger` (панель логов) | — |
| S16 | `init.js` | `loadData`, `initMap`, запуск карты | все выше |

**Нарушение порядка = карта не работает.**

---

## 4. ФУНКЦИОНАЛЬНАЯ МАТРИЦА

| Файл | Ответственность | НЕ делает |
|------|-----------------|-----------|
| `core.js` | Язык, уведомления, глобальные переменные | Логику карты |
| `countries.js` | 90 стран с координатами и статусами | UI |
| `layers.js` | 75 слоёв, панель, `enableAllLayers`, `loadLayer` | Рендеринг choropleth |
| `maps-config.js` | Конфигурация choropleth: метод, палитра, breaks | Рендеринг |
| `series-adapter.js` | series → choropleth (spatial proxy) | Классификацию |
| `map-controls.js` | Leaflet, Jenks, ColorBrewer, GVF, легенда, `applyChoropleth` | Решение по URL, fallback |
| `markers.js` | Маркеры на карте | Choropleth |
| `metrics-map.js` | Оркестратор: decision tree, `fetchWithTimeout`, fallback-генераторы | UI-панель |
| `copy-data.js` | Снапшот состояния (~600 КБ) | Влияние на карту |
| `heat-timeline.js` | Тепловая карта, временная шкала | — |
| `ssi.js` | Strategic Stress Index | — |
| `refresh.js` | Автообновление | — |
| `cii.js` | Country Instability Index с fallback | — |
| `logger.js` | Логирование с панелью | — |
| `init.js` | `loadData` (страны, слои, маркеры, границы, CII), `initMap` | Логику слоёв |

---

## 5. ПОТОК ДАННЫХ: КЛИК ПО КНОПКЕ СЛОЯ

### 5.1. Последовательность

Пользователь кликает на кнопку «PMI».

1. **`layers.js`** → `btn.onclick = () => loadLayer('pmi')`.
2. **`loadLayer('pmi')`** — проверяет `activeLayerIds.has('pmi')`.
   - Если да → toggle-off: удаляет из набора, снимает класс `.active`, чистит `activeLayers`, обновляет маркеры.
   - Если нет → добавляет в `activeLayerIds`, вызывает `MetricsMap.interceptLoad`.
3. **`MetricsMap.interceptLoad('pmi')`** — ищет слой в `allLayers`, читает `vizType`.
   - `choropleth` → `loadChoroplethLayer`
   - `series` → `loadSeriesLayer`
   - `marker` → `loadMarkerLayer`
4. **`loadChoroplethLayer('pmi')`**:
   - Вызывает `fetchWithTimeout('/api/layers/pmi/featurecollection', 8000)`.
   - Если `resp.ok` и `data.features.length > 0` — передаёт в `applyChoropleth`, записывает в `layerCache['pmi'] = data.features`.
   - Если 404 или timeout (`signal is aborted without reason`) — `renderFallback(layer)`.
5. **`renderFallback('pmi')`**:
   - Берёт `ALL_COUNTRIES[90]`, для каждой страны генерирует значение: `base(status) + noise(seed('pmi'), i)`.
   - Классифицирует: если `config.method === 'manual'` — использует `config.manualBreaks`, иначе `jenksBreaks(values, 5)`.
   - Вызывает `applyChoropleth({features, breaks, palette, method, gvf:0.85}, {...})`.
   - Записывает `layerCache['pmi'] = features` (плоский массив).
6. **`map-controls.js` → `applyChoropleth(data, layer)`**:
   - Читает `window.MetricsMapConfig.getLayerConfig('pmi')` → `{method, palette, manualBreaks, numClasses}`.
   - Извлекает `values` из `data.features`.
   - Классифицирует: `classifyValues(values, method, numClasses, manualBreaks)` → `breaks`.
   - Считает `computeGVF(values, breaks)` → `gvf`.
   - Сохраняет в `currentChoroplethConfig` и `window.currentChoroplethConfig`:
     `{method, palette, numClasses, breaks, gvf, stats: {count, min, max, mean}, layerId, layerName}`.
   - Перебирает `currentGeoJsonLayer.eachLayer`, для каждой страны ищет в `data.features` по имени (русскому или английскому), устанавливает цвет через `getColorForValue(value, breaks, palette)`.
   - Вызывает `renderChoroplethLegend(breaks, config, gvf)`.
7. **`layers.js` → `loadLayer('pmi')`** продолжает:
   - `updateActiveCount()` — счётчик в `#active-layers-count`.
   - `updateLegend()` — легенда SSI.
   - `localStorage.setItem('crucix-active-layer', 'pmi')`.

### 5.2. Ключевые инварианты

- **`window.layerCache[id]` — всегда плоский массив.** Никогда не `{features: [...]}`.
  - Choropleth/series: массив из 90 объектов `{name, value, properties: {name, value, status}}`.
  - Marker: массив из 180 объектов `{id, lat, lng, countryName, title, layer, status, color, date, severity}`.
- **`window.activeLayerIds` — `Set` id слоёв.** Может содержать `'all'` — служебный маркер.
- **`window.currentChoroplethConfig` — объект последней удачной классификации.** Доступен через `window.currentChoroplethConfig` (экспорт из `map-controls.js` v4.1).
- **`window.currentChoroplethData` — текущая FeatureCollection.**
- **`window.markerData` — массив всех маркеров (1080 при полной загрузке).**

---

## 6. ГЛАВНЫЙ ОРКЕСТРАТОР — `metrics-map.js` v1.4

### 6.1. Методы

| Метод | Что делает |
|-------|-----------|
| `init()` | Идемпотентная инициализация, лог распределения по vizType |
| `fetchWithTimeout(url, ms = 8000)` | Fetch с AbortController, таймаут 8 сек |
| `interceptLoad(layerId, markerAccumulator)` | Decision tree по `vizType` |
| `loadSeriesLayer(layer)` | Fetch → `SeriesAdapter.convert` → `applyChoropleth` |
| `loadChoroplethLayer(layer)` | Fetch → `applyChoropleth` |
| `loadMarkerLayer(layer, markerAccumulator)` | Fetch → `renderMarkerFallback` |
| `renderFallback(layer)` | Локальная генерация 90 стран |
| `renderMarkerFallback(layer, markerAccumulator)` | Локальная генерация 180 маркеров |
| `resolveApiUrl(layerId)` | Карта routes для 14 series-слоёв |
| `stats()` | Сводка по vizType |

### 6.2. `fetchWithTimeout` — критический элемент

**Проблема (v1.2 и ранее):** `await fetch(url)` **висит бесконечно**, если сервер молчит. Chrome не бросает ошибку через N секунд. Только если TCP-соединение разорвётся. Из-за этого `enableAllLayers` обрывался на середине.

**Решение (v1.3+):** `AbortController` + `setTimeout(controller.abort, ms)`. Через `ms` миллисекунд fetch выбрасывает `DOMException: signal is aborted without reason`. `catch` в `loadChoroplethLayer`/`loadSeriesLayer`/`loadMarkerLayer` перехватывает и вызывает `renderFallback`/`renderMarkerFallback`.

**Версия v1.4** дополнительно **устраняет дубликат** `fetchWithTimeout` (в v1.3 был определён дважды подряд — артефакт применения патча).

### 6.3. `markerAccumulator` — подготовка к параллелизму

`renderMarkerFallback(layer, markerAccumulator)`:
- Если `markerAccumulator` передан — маркеры пишутся **в него**, `window.markerData` **не трогается**.
- Если не передан — старый путь: `window.markerData = window.markerData.concat(markers)`.

**Зачем:** при параллельной загрузке 5 marker-слоёв (например, `vix-futures`, `cftc-cot`, `insider-trading`, `sec-filings`, `short-interest`) **одновременно** делают `read → concat → write` в `window.markerData`. Это **race condition** (lost update): первый записал 180 маркеров, второй читает устаревший массив, теряет 180 от первого.

**Решение:** координатор `enableAllLayers` (в будущей версии v1.5) создаёт **один** `markerAccumulator`, передаёт его всем 5 параллельным вызовам, после `Promise.all` — merge в `window.markerData` **атомарно**.

Проверка совместимости :
```javascript
const testAccumulator = [];
await window.MetricsMap.interceptLoad('bankruptcy-filings', testAccumulator);
// Результат interceptLoad: true
// Аккумулятор после вызова: 180
// window.markerData: 0            ← не трогался
// layerCache.bankruptcy-filings: 180
## 7. layers.js v1.4 — ЕДИНАЯ enableAllLayers
7.1. Назначение
Загрузить все 75 слоёв в layerCache, отметить как активные, отобразить последний choropleth.

7.2. Архитектурные принципы
Прямой вызов MetricsMap.interceptLoad(layer.id) — не через loadLayer. Причина: loadLayer имеет toggle-логику (проверяет activeLayerIds.has(layerId)). Если слой там есть — выключает. Для пакетной загрузки это неверно.

Блок глушения визуализации. На время цикла:

window.applyChoropleth = no-op

window.updateMarkers = no-op

window.renderLayerPanel = no-op

Причина: без глушения каждый из 75 слоёв перерисовывал бы карту (75 × 200 мс = 15 сек) и панель слоёв (75 × 50 мс = 3.75 сек). Итого — +20 сек.

Критично: глушённый applyChoropleth — полный no-op. Он не пишет в layerCache. Кеш заполняет только renderFallback внутри interceptLoad.

Кеш — плоские массивы. Array.isArray(layerCache[id]) — инвариант.

Финальный рендер — последний choropleth. После цикла ищем с конца allLayers первый choropleth с данными в кеше. Обычно это mobile (последний слой по номеру). Вызываем сохранённый origApplyChoropleth({features: cached}, layer).

7.3. Re-entrancy guard
javascript
if (window._enableAllInProgress) return;
window._enableAllInProgress = true;
// ...
window._enableAllInProgress = false;  // в конце
При попытке параллельного запуска — второй вызов отменяется.

7.4. await Promise.resolve() вместо setTimeout(30)
Было (v1.0–v1.3): await new Promise(r => setTimeout(r, 30)). Проблема: в фоновой вкладке Chrome троттлит setTimeout до 1000 мс. 75 × 1000 = 75 сек, вместо ожидаемых 2.5 сек.

Стало (v1.4): await Promise.resolve(). Microtask не троттлится. Event loop обрабатывает паузу, но цикл не тормозит.

7.5. Метрики из последнего прогона
[enableAllLayers v1.4] Всего: 75, с данными: 75, пусто: 0, ошибок: 0, пропущено: 0, в кеше: 75, объём: ~975 КБ
Время: 9586 мс
Кеш: 75
Активных: 76
Маркеров: 1080
9.5 секунд на 75 слоёв — в основном из-за одного слоя (dxy), который молчит и таймаутит через 8 сек. Остальные 74 отвечают за ~50 мс каждый.

## 8. map-controls.js v4.1 — ЧТО ДОБАВЛЕНО
8.1. Экспорт currentChoroplethData и currentChoroplethConfig в window
Строки 441 и 483:

javascript
currentChoroplethData = data;
window.currentChoroplethData = data;
// ...
currentChoroplethConfig = config;
window.currentChoroplethConfig = config;
Строки 558–559 (в resetChoropleth):

javascript
window.currentChoroplethData = null;
window.currentChoroplethConfig = null;
Зачем: copy-data.js v2.0+ читает window.currentChoroplethConfig для секции «CHOROPLETH-ПАРАМЕТРЫ ТЕКУЩЕГО СЛОЯ». Без экспорта эта секция пустая.

8.2. config.gvf и config.stats
Внутри applyChoropleth, после computeGVF:

javascript
config.gvf = gvf;
config.stats = {
    count: data.features.length,
    min: values.length ? Math.min.apply(null, values) : 0,
    max: values.length ? Math.max.apply(null, values) : 0,
    mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
};
Зачем: снапшот показывает min/max/mean по каждому слою. Без этого — только breaks и GVF.

8.3. Структура currentChoroplethConfig
javascript
{
    method: 'jenks' | 'manual' | 'quantile' | 'equal' | 'std',
    palette: ['#hex1', '#hex2', ...],     // массив цветов
    numClasses: 5,
    breaks: [b0, b1, b2, b3, b4, b5],     // 6 границ = 5 классов
    manualBreaks: null | [42, 47, 53, 58],
    gvf: 0.9199,
    stats: {count: 90, min: 10.4, max: 84.4, mean: 43.2},
    layerId: 'pmi',
    layerName: 'PMI'
}
## 9. copy-data.js v3.0 — СТРУКТУРА СНАПШОТА
9.1. История версий
v1.0–1.3 — базовая, две реализации copyAllData подряд (баг).

v2.0 — убрано дублирование, плоский кеш, точный размер через TextEncoder, choropleth-параметры, разбивка маркеров.

v3.0 — объединённая: добавлены «СТРАНЫ ПО СТАТУСАМ», «CII Top-N» (парсинг DOM), расширенный SSI, DOM-слепок (300 элементов), «АКТИВНЫЕ СЛОИ» (имя, категория, метод, палитра).

9.2. Секции снапшота
Заголовок — дата, URL, окно, карта, UA, версия.

Статистика — стран, слоёв, активных, кеш, маркеров.

Полная конфигурация 75 слоёв.

Матрица слоёв (ID × vizType × method × palette × active × count).

Диагностика по vizType и категориям.

Здоровье слоёв (НЕ ЗАГРУЖЕН / НЕТ ДАННЫХ / НЕПОЛНЫЕ / OK).

Активные слои (имя, категория, vizType, метод, палитра, count).

Choropleth-параметры текущего слоя (из window.currentChoroplethConfig).

Легенда из DOM.

Разбивка маркеров по слоям (6 marker-слоёв × 180).

Данные слоёв (все 90 стран на каждый активный слой).

Страны (90 с координатами).

Страны по статусам (CRITICAL / PRE-WAR / HIGH / MEDIUM / NORMAL).

DOM панели слоёв (категории, кнопки, активные).

CII Top-N (парсинг .cii-country).

SSI (расширенный).

DOM-слепок (до 300 элементов с координатами, цветами, шрифтами).

Карта (центр, zoom, bounds).

Палитры (sequential, diverging).

Панель статуса.

Журнал консоли (последние 200 записей).

9.3. Размер снапшота
0 слоёв — ~96 КБ.

15 слоёв — ~605 КБ.

75 слоёв — ~605 КБ (потолок, дальше растёт незначительно — данные в каждой секции).

## 10. init.js v1.1 — ИЗМЕНЕНИЯ
10.1. Убрано setTimeout(loadLayer(saved), 2000)
Было (v1.0):

javascript
loadData();
const saved = localStorage.getItem('crucix-active-layer');
if (saved && saved !== 'all') {
    setTimeout(() => {
        if (typeof loadLayer === 'function') loadLayer(saved);
    }, 2000);
}
Проблема: через 2 секунды после старта страницы loadLayer(saved) вызывался параллельно с любым ручным enableAllLayers. Два потока писали в layerCache и activeLayerIds → обрыв.

Стало (v1.1): блок удалён. Пользователь сам выберет слой.

10.2. startAutoRefresh не стартует автоматически
Было: startAutoRefresh(parseInt(select.value)) при загрузке. setInterval(refreshMapData, intervalMs) — второй параллельный поток.

Стало: автозапуск отключён. Только по изменению <select> или кнопке.

10.3. setInterval(updateCII, 5min) с проверкой паузы
javascript
setInterval(function() {
    if (window._autoRefreshPaused) return;
    window.updateCII();
}, 5 * 60 * 1000);
_autoRefreshPaused пока нигде не устанавливается, но задел на будущее.

## 11. ДИАГНОСТИКА — КОНТРОЛЬНЫЕ МЕТРИКИ
11.1. Полная проверка (одна команда в консоли)
javascript
(() => {
    const stats = window.MetricsMap?.stats() || {};
    console.log('=== METRICS MAP ДИАГНОСТИКА ===');
    console.log('Слоёв:', window.allLayers?.length);               // 75
    console.log('Стран:', window.ALL_COUNTRIES?.length);           // 90
    console.log('Активных:', window.activeLayerIds?.size);         // 76 (после enableAll)
    console.log('В кеше:', Object.keys(window.layerCache || {}).length); // 75
    console.log('Маркеров:', (window.markerData || []).length);    // 1080
    console.log('Распределение:', stats);
    console.log('Карта:', !!window.map);
    console.log('===  ====================  ===');
})();
11.2. Проверка полноты layerCache
javascript
const missing = window.allLayers.filter(l => !window.layerCache[l.id]);
console.log('Слоёв без данных:', missing.length, missing.map(l => l.id));
Ожидание после enableAllLayers: Слоёв без данных: 0.

11.3. Проверка структуры кеша
javascript
const bad = [];
for (const [id, data] of Object.entries(window.layerCache)) {
    if (!Array.isArray(data)) bad.push(id);
}
console.log('Не-массивы в кеше:', bad.length, bad);
Ожидание: Не-массивы в кеше: 0.

11.4. Размер кеша в КБ
javascript
let total = 0;
for (const data of Object.values(window.layerCache)) {
    if (Array.isArray(data)) total += JSON.stringify(data).length;
}
console.log('Объём кеша:', Math.round(total / 1024), 'КБ');
Ожидание после enableAllLayers: ~975 КБ.

## 12. ИЗВЕСТНЫЕ ГРАБЛИ И РЕШЕНИЯ
12.1. await fetch(url) без таймаута — виснет
Симптом: enableAllLayers обрывается на середине. Логи кончаются на N/75: <id> без финальной строки.

Причина: слой, у которого сервер молчит (не 404, а нет ответа). Chrome не бросает ошибку.

Решение: fetchWithTimeout(url, 8000) через AbortController. Слои с таймаутом уходят в fallback.

История: впервые диагностировано 28.09.2026, применено в metrics-map.js v1.3.

12.2. Дубликат fetchWithTimeout
Симптом: grep -c "fetchWithTimeout:" возвращает 2.

Причина: применение патча к патчу — второе определение вставлялось поверх первого.

Решение: v1.4 — единственное определение.

История: обнаружено 29.09.2026. Функционально не влияло (последнее определение побеждает), но нарушало правило №36.

12.3. Race condition в markerData при параллелизме
Симптом (потенциальный): при параллельной загрузке 5 marker-слоёв теряются маркеры.

Причина: read → concat → write без блокировки.

Решение: markerAccumulator в renderMarkerFallback. Готово в v1.4, будет активировано в v1.5 layers.js.

История: задел заложен 29.09.2026.

12.4. Toggle-логика loadLayer в enableAllLayers
Симптом: enableAllLayers выключает слои вместо загрузки.

Причина: loadLayer при activeLayerIds.has(layerId) уходит в toggle-off. Если в начале цикла все слои уже в наборе — цикл выключает их.

Решение: в v1.4 enableAllLayers вызывает interceptLoad напрямую, минуя loadLayer. Плюс — принудительный activeLayerIds.delete(layerId) перед загрузкой.

История: v1.1 первое исправление, v1.4 окончательное.

12.5. setTimeout(30) в фоновой вкладке
Симптом: enableAllLayers занимает 75 секунд вместо 2.5.

Причина: Chrome троттлит setTimeout до 1000 мс в фоновой вкладке.

Решение: await Promise.resolve() вместо setTimeout. Microtask не троттлится.

История: v1.2.

12.6. Параллельные вызовы loadLayer из init.js
Симптом: после F5 странный состав layerCache — не по порядку allLayers.

Причина: init.js v1.0 через 2 секунды вызывал loadLayer(saved) из localStorage. Второй поток писал в layerCache параллельно.

Решение: init.js v1.1 — блок удалён.

История: 29.09.2026.

12.7. Смещение activeLayerIds при toggle
Симптом: после enableAllLayers все 76 кнопок активны, но при клике на любую — слой выключается, а не включается.

Причина: правильное поведение toggle. Если слой уже активен — повторный клик выключает.

Решение: не баг, а фича. Для перезагрузки одного слоя — сначала выключить, потом включить.

12.8. currentChoroplethConfig недоступен из copy-data.js
Симптом: секция «CHOROPLETH-ПАРАМЕТРЫ» в снапшоте пустая.

Причина: map-controls.js v4.0 хранил currentChoroplethConfig как локальную переменную модуля, не экспортировал в window.

Решение: v4.1 — добавлены window.currentChoroplethConfig = config и window.currentChoroplethData = data.

История: 28.09.2026.

## 13. ЧТО ОСТАЛОСЬ СДЕЛАТЬ
13.1. Параллелизм батчами по 5
Цель: ускорить enableAllLayers с ~9.5 сек до ~2.7 сек.

План:

layers.js v1.5: разбить layers на батчи по 5, Promise.all(layers.map(l => loadOne(l, markerAccumulator))).

loadOne — обёртка над interceptLoad с передачей markerAccumulator.

После всех батчей — merge markerAccumulator в window.markerData атомарно.

Финальный рендер — явный выбор mobile (последний choropleth).

13.2. Кеш localStorage
Цель: ускорить повторные запуски с 9.5 сек до ~0.5 сек.

План:

layers.js v1.5: при завершении enableAllLayers сохранять {version, timestamp, layerCache, markerData} в localStorage['crucix-layer-cache'].

init.js v1.2: при старте читать кеш, если Date.now() - timestamp < 3600000 (1 час) — восстанавливать layerCache, activeLayerIds, markerData.

TTL 1 час. По истечении — очистка, полный пересбор.

13.3. Уменьшить таймаут fetch
Цель: с 8000 мс до 2000–2500 мс.

План: в metrics-map.js v1.4 → v1.4.1 изменить ms = ms || 8000 на ms = ms || 2500.

Условие: замер реального отклика сервера на локальный localhost:3117. Если отклик < 100 мс — 2500 мс с избытком.

14. ПРАВИЛА ПРОЕКТА, ПРИМЕНИМЫЕ К АРХИТЕКТУРЕ


15. КОНТРОЛЬНЫЕ ТОЧКИ СЕССИИ 28–29.09.2026
15.1. Что достигнуто
75/75 слоёв загружаются в layerCache.

1080 маркеров (6 marker-слоёв × 180).

Объём кеша ~975 КБ.

Снапшот ~605 КБ (при 75 слоях).

Время enableAllLayers: ~9.5 сек.

Синтаксис всех критичных файлов проверен (node --check).

15.2. Версии файлов на конец сессии
metrics-map.js — v1.4

layers.js — v1.4

map-controls.js — v4.1

copy-data.js — v3.0

init.js — v1.1

15.3. Изменения сессии
metrics-map.js: v1.1 → v1.2 (удалён мёртвый параметр) → v1.3 (fetchWithTimeout) → v1.4 (устранён дубликат, markerAccumulator).

layers.js: v1.0 → v1.1 (toggle-фикс) → v1.2 (setTimeout → Promise) → v1.3 (override) → v1.4 (единая реализация).

map-controls.js: v4.0 → v4.1 (экспорт config, gvf, stats).

copy-data.js: v2.0 → v3.0 (объединённая).

init.js: v1.0 → v1.1 (убраны автозапуски).

15.4. Следующий этап
По приоритету:

layers.js v1.5 — параллельные батчи 5.

init.js v1.2 — localStorage-кеш.

metrics-map.js v1.4.1 — таймаут 2500 мс.

Доработка справки HELP в docs/help/ru/pages/metrics-map.txt.

Переход к следующей карте (Event Map / Semantic / Forecast / Network).

## 14. ГЛОССАРИЙ АРХИТЕКТУРЫ
allLayers — массив 75 конфигураций слоёв. Создаётся в layers.js из DEMO_LAYERS. Каждый элемент: {id, name, category, vizType, color, icon, number}.

activeLayerIds — Set активных id. Может содержать 'all'.

layerCache — { [id]: Array }. Плоские массивы. Choropleth/series — 90 элементов. Marker — 180 элементов.

markerData — массив всех маркеров на карте. Заполняется renderMarkerFallback (после 6 marker-слоёв — 1080 элементов).

allMarkers — копия markerData для откатов.

currentChoroplethConfig — конфигурация текущего choropleth: {method, palette, numClasses, breaks, manualBreaks, gvf, stats, layerId, layerName}. Экспортируется в window.

currentChoroplethData — текущая FeatureCollection. Экспортируется в window.

geoJsonData — полный GeoJSON границ стран, загруженный из data/world.geojson.

currentGeoJsonLayer — Leaflet-слой границ. Внутри модуля map-controls.js.

window.MetricsMap — оркестратор. Единственный объект с методами decision tree.

window.MetricsMapConfig — API maps-config.js: getLayerConfig(id), getColorPalette(name).

window.SeriesAdapter — API series-adapter.js: convert(layerId, seriesData, countries).

window.CrucixMap — глобальный флаг карты: {mapType, name}.

window._enableAllInProgress — re-entrancy guard для enableAllLayers.

window._autoRefreshPaused — флаг паузы для refreshMapData и setInterval(updateCII). Пока не устанавливается, задел.
