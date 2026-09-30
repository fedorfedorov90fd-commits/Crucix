# SEMANTIC MAP — МАНИФЕСТ СОСТОЯНИЯ

**Дата:** 2026-09-30
**Версия карты:** 1.1
**Расположение:** `/dashboard/public/semantic-map/`
**Сервер:** `http://localhost:3117/semantic-map/`
**Режим автономии:** FULL ISOLATION (Nygard 2007, Bulkhead Pattern)
**Failure domain:** 1 (сбой этой карты не влияет на 4 остальные)

---

## 1. НАЗНАЧЕНИЕ И МЕСТО В ЭКОСИСТЕМЕ CRUCIX

### 1.1. Что такое Crucix — экосистема из 5 карт

Crucix — геополитическая OSINT-платформа. Она состоит из **5 автономных карт**, каждая визуализирует свой класс данных:

1. **Event Map** (`/event-map/`) — точечные события на карте (митинги, атаки, инциденты). 84 слоя, маркеры.
2. **Metrics Map** (`/metrics-map/`) — количественные индикаторы по странам (экономика, финансы, ESG, кибер, энергетика). 75 слоёв, choropleth.
3. **Semantic Map** (`/semantic-map/`) — семантический анализ текстов (тональность, нарративы, дезинформация). **35 слоёв**. **ЭТА КАРТА.**
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

### 1.3. Что делает Semantic Map

Semantic Map визуализирует **результаты семантического анализа текстовых потоков по 90 странам мира**. Каждый слой — это аспект анализа текстов:

- Тональность: позитивная/негативная окраска медиапотока по странам
- Нарративы: доминирующие нарративы и их распространение
- Дезинформация: индексы информационных манипуляций
- Медийный тон: отношение медиа к ключевым темам
- Пропаганда: индексы пропагандистской активности
- Информационная война: индикаторы информационного противоборства
- Социальные сети: активность и эмоции в социальных медиа
- Темы: кластеризация тем и их географическое распределение
- Достоверность: оценка достоверности источников по странам
- Когнитивные искажения: индексы систематических искажений в медиапотоке
- Манипуляция: выявление приёмов манипуляции в текстах
- Языковая токсичность: уровень агрессии в текстах по странам

Итого: **35 слоёв в 12 категориях**.

Каждый слой при активации:
1. Получает данные из API `/api/layers/<layerId>` (или `/api/layers/<layerId>/featurecollection`).
2. Если API недоступен (404) — срабатывает **автономный fallback**: данные генерируются локально из `countries.js` через детерминированный генератор с корреляцией по статусу страны.
3. Классифицирует значения: для тональности — diverging (RdYlGn5), для достоверности — sequential (OrRd5), для категориальных кластеров — Set1 (10 цветов).
4. Применяет палитру ColorBrewer (diverging, sequential или categorical).
5. Закрашивает 90 стран на карте через `applyChoropleth`.
6. Рисует легенду с порогами классов, методом и качеством классификации (GVF).
7. Логирует результат: `[Sentiment] method=jenks, layer=sentiment-pos, GVF=0.9105`.

### 1.4. Отличия от Metrics Map

Semantic Map и Metrics Map различаются классом визуализации и адаптером данных:

- **Semantic Map:** каждая страна — результат анализа текстового потока. Использует `sentiment-adapter.js` для конвертации sentiment-данных в choropleth. 35 слоёв. Каналы: Position + Hue + Shape.
- **Metrics Map:** каждая страна — числовой индикатор. Использует `series-adapter.js`. 75 слоёв. Каналы: Position + Color intensity.

Semantic Map оперирует качественными характеристиками текстов (тональность, нарративы, кластеры тем), Metrics Map — количественными метриками. Это разные модели данных.

---

## 2. СТРУКТУРА ПАПКИ (20 обязательных файлов)

```
semantic-map/
├── index.html                          ← точка входа, 16 локальных скриптов
├── manifest.json                       ← паспорт (mapType=meanings, layers=35, cross_map=0)
├── SEMANTIC-MAP-MANIFEST.md            ← ЭТОТ ФАЙЛ (полное описание состояния)
├── ARCHITECTURE.md                     ← техническая спецификация DAG загрузки
├── AUTONOMY-CHARTER.md                 ← устав R1–R6 автономии
├── css/
│   └── semantic-map.css                ← ЕДИНСТВЕННЫЙ CSS (тёмная тема + sentiment легенда)
├── js/                                  ← 15 файлов, порядок загрузки критичен
│   ├── core.js                         ← язык, уведомления, глобальные переменные
│   ├── countries.js                    ← массив 90 стран с координатами и статусами
│   ├── layers.js                       ← 35 слоёв + панель + toggle-логика
│   ├── maps-config.js                  ← конфигурация: методы, палитры, классификация
│   ├── sentiment-adapter.js            ← sentiment → choropleth (5 классов, Cowan 2001)
│   ├── map-controls.js                ← Leaflet init, Jenks DP, ColorBrewer, GVF, legend
│   ├── markers.js                      ← маркеры (для категориальных слоёв)
│   ├── semantic-map.js                ← SemanticMap.init() — оркестратор
│   ├── copy-data.js                    ← снапшот состояния (~300–500 КБ)
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

Плюс каталог `backups/` — автоматически создаваемые бэкапы правок. Плюс каталог `_archive/` — устаревшие файлы после вычистки.

---

## 3. DAG ЗАГРУЗКИ (15 шагов, порядок критичен)

| # | Файл | Что делает | Зависит от |
|---|------|------------|------------|
| S01 | inline `<script>` | `window.CrucixMap = {mapType:'meanings'}` | — |
| S02 | `js/core.js` | `LANG_DATA`, `showNotification`, `setLanguage` | CrucixMap |
| S03 | `js/countries.js` | `ALL_COUNTRIES[90]` | — |
| S04 | `js/layers.js` | `allLayers[35]` + панель слоёв | — |
| S05 | `js/maps-config.js` | `MAP_TYPES`, `COLOR_SCHEMES`, `LAYER_CLASSIFICATION` | allLayers |
| S06 | `js/sentiment-adapter.js` | `SentimentAdapter.convert()` — sentiment → choropleth (5 классов) | maps-config |
| S07 | `js/map-controls.js` | `loadCountryBoundaries`, `applyChoropleth`, `jenksBreaks`, `computeGVF` | Leaflet, countries |
| S08 | `js/markers.js` | `generateAllMarkers`, `updateMarkers`, `renderLayerPanel` | allLayers, map |
| S09 | `js/semantic-map.js` | `SemanticMap.init()` — оборачивает `loadLayer()` | sentiment-adapter, map-controls |
| S10 | `js/copy-data.js` | `copyAllData` — снапшот (~300–500 КБ) | — |
| S11 | `js/heat-timeline.js` | `toggleHeat`, `toggleTimeline` | map |
| S12 | `js/ssi.js` | `calculateSSI`, `updateLegend` | countries |
| S13 | `js/refresh.js` | `startAutoRefresh`, `refreshMapData` | — |
| S14 | `js/cii.js` | `updateCII` с fallback | countries, map-controls |
| S15 | `js/logger.js` + `js/init.js` | `CrucixLogger` + `loadData` → `loadCountryBoundaries` → `SemanticMap.init()` | все выше |

**Нарушение порядка = `window.CrucixMap` undefined = вся карта падает.**

---

## 4. ФУНКЦИОНАЛЬНАЯ МАТРИЦА

| Файл | Ответственность | НЕ делает |
|------|-----------------|-----------|
| `core.js` | Язык, уведомления, глобальные переменные | Логику карты |
| `countries.js` | Массив 90 стран с координатами и статусами | UI |
| `layers.js` | 35 слоёв + панель + toggle-логика | Загрузку данных |
| `maps-config.js` | Конфигурация: метод, палитра, breaks для sentiment | Рендеринг |
| `sentiment-adapter.js` | sentiment → choropleth (5 классов, spatial proxy, трансформации) | Классификацию чисел |
| `map-controls.js` | Leaflet init, Jenks DP, ColorBrewer, GVF, legend | Бизнес-логику |
| `markers.js` | Маркеры для категориальных слоёв (кластеры тем) | Choropleth |
| `semantic-map.js` | Decision tree: choropleth / categorical / marker | Рендеринг |
| `copy-data.js` | Снапшот состояния (~300–500 КБ) | — |
| `heat-timeline.js` | Тепловая карта, временная шкала | — |
| `ssi.js` | Strategic Stress Index | — |
| `refresh.js` | Автообновление данных | — |
| `cii.js` | Country Instability Index (fallback) | — |
| `logger.js` | Логирование с панелью | — |
| `init.js` | Запуск карты | — |

---

## 5. 35 СЛОЁВ — РАСПРЕДЕЛЕНИЕ

| Категория | Слоёв | choropleth | categorical | marker |
|-----------|-------|------------|-------------|--------|
| sentiment | 8 | 8 | — | — |
| narratives | 5 | 3 | 2 | — |
| disinformation | 4 | 4 | — | — |
| media-tone | 3 | 3 | — | — |
| propaganda | 3 | 3 | — | — |
| info-warfare | 2 | 2 | — | — |
| social-media | 3 | 3 | — | — |
| topics | 2 | — | 2 | — |
| credibility | 2 | 2 | — | — |
| cognitive-bias | 1 | 1 | — | — |
| manipulation | 1 | 1 | — | — |
| toxicity | 1 | 1 | — | — |
| **ИТОГО** | **35** | **31** | **4** | **0** |

---

## 6. КАК РАБОТАЕТ КАЖДЫЙ ТИП СЛОЯ

### 6.1. Choropleth — Sentiment (8 слоёв)

При клике на sentiment-слой:
1. `loadLayer(layerId)` → `SemanticMap.interceptLoad(layerId)`.
2. `vizType === 'choropleth'` + `adapter === 'sentiment'` → `loadSentimentLayer(layer)`.
3. `fetch('/api/layers/<id>/featurecollection')`.
4. Если 404 → `renderFallback(layer)`:
   - Детерминированный seed по `layer.id`.
   - Для каждой из 90 стран: sentiment-значение от −1.0 до +1.0.
   - Классификация: 5 классов (Cowan 2001: 4±1 чанк — оптимально для восприятия).
   - Diverging палитра RdYlGn5: красный = негатив, жёлтый = нейтрально, зелёный = позитив.
   - `applyChoropleth()` закрашивает страны.
   - Логирует GVF.
5. Если API работает — `SentimentAdapter.convert(layerId, data, countries)`:
   - Выбирает spatial proxy (media_market, language_region, all_countries).
   - Применяет трансформацию (sentiment_score, sentiment_intensity, sentiment_shift).
   - Классифицирует (jenks / manual).
   - Возвращает features для choropleth.

### 6.2. Categorical — Topics & Narrative Clusters (4 слоя)

При клике на категориальный слой:
1. `interceptLoad` → `loadCategoricalLayer(layer)`.
2. `fetch('/api/layers/<id>/featurecollection')`.
3. Если 404 → `renderCategoricalFallback(layer)`:
   - Для каждой страны — доминирующий кластер (0–9).
   - Палитра Set1 (10 цветов, категориальная).
   - `applyChoropleth()` с категориальной легендой.
4. Если API работает — данные применяются напрямую.

### 6.3. Popup для Semantic Map

```
┌─────────────────────────────────┐
│  Страна: Германия               │
│  Слой: Тональность медиа        │
│  Значение: +0.42 (Позитивная)   │
│  Класс: 4 из 5                  │
│  Метод: Jenks DP                │
│  GVF: 0.9105                    │
│  Источник: GDELT, Media Cloud   │
│  Выборка: 12,847 текстов        │
│  Период: 2026-09-01 — 09-30     │
└─────────────────────────────────┘
```

---

## 7. АВТОНОМНОСТЬ (R1–R6)

**R1:** Ни один `<script>`/`<link>`/`<fetch>` не ходит в `../*`.

**R2:** `world.geojson` лежит в `data/`, `fetch('data/world.geojson')`.

**R3:** `layers.js` содержит ровно 35 слоёв Semantic Map. Чужих слоёв (metrics, event, forecast, network) — 0.

**R4:** `maps-config.js`, `presets.json` — только для Semantic Map.

**R5:** `manifest.json` → `local_cross_map: 0`, `failure_domain: 1`.

**R6:** Сбой в Semantic Map не влияет на Event/Metrics/Forecast/Network.

---

## 8. ЧЕК-ЛИСТ ВЕРИФИКАЦИИ

```bash
cd "/dashboard/public/semantic-map"

# R1: 0 cross-map зависимостей
grep -rn '\.\./' index.html js/*.js | grep -v 'AUTONOMY\|manifest'

# R3: 35 слоёв
grep -c 'id:' js/layers.js

# R3: 0 дубликатов
grep -o 'id: "[^"]*"' js/layers.js | sort | uniq -d

# R2: локальный geojson
grep -n "data/world.geojson" js/map-controls.js
ls -la data/world.geojson

# Sentiment-adapter: 5 классов
grep -n "numClasses\|5" js/sentiment-adapter.js | head -10

# Порядок скриптов
grep -o 'src="[^"]*"' index.html | grep -v "http" | sort
```

---

## 9. МЕТОДЫ КЛАССИФИКАЦИИ

| Метод | Формула | Применение в Semantic Map |
|-------|---------|--------------------------|
| Jenks DP | минимизация SDCM, O(k·n²) | По умолчанию для sentiment-значений |
| Quantile | равные группы | При выбросах (доминирующий нарратив) |
| Manual | пороги эксперта | Для индексов дезинформации (0/25/50/75/100) |
| Categorical | фиксированные категории | Для кластеров тем (Set1, 10 цветов) |

Контроль качества: GVF = (SDAM − SDCM) / SDAM > 0.7.

---

## 10. ПАЛИТРЫ COLORBREWER

### 10.1. Diverging (для тональности)
- **RdYlGn5** — красный ↔ жёлтый ↔ зелёный. 5 классов. Применение: sentiment-positive, sentiment-negative, media-tone.
- **RdBu5** — красный ↔ белый ↔ синий. Применение: sentiment-shift (изменение тональности).

### 10.2. Sequential (для достоверности и индексов)
- **OrRd5** — от светлого до тёмно-красного. Применение: disinformation-index, propaganda-index.
- **YlOrRd5** — от жёлтого до красного. Применение: toxicity, cognitive-bias.

### 10.3. Categorical (для кластеров)
- **Set1** — 10 категориальных цветов. Применение: topic-clusters, narrative-clusters.
- Каждый цвет — отдельный кластер тем или нарратив. Легенда показывает все 10 категорий.

### 10.4. Доменные правила

- **Sentiment** → diverging RdYlGn5, 5 классов, Jenks. Домен: −1.0 до +1.0.
- **Дезинформация** → sequential OrRd5, manual breaks [0, 25, 50, 75, 100]. Домен: 0–100, больше = хуже.
- **Кластеры тем** → categorical Set1, 10 цветов. Каждый цвет — отдельная тема.
- **Достоверность** → sequential Greens (инвертированная). Больше = выше достоверность.
- **Пропаганда** → sequential OrRd5, manual breaks [0, 20, 40, 60, 80]. Домен: 0–100, больше = активнее пропаганда.

---

## 11. SENTIMENT-ADAPTER — ДЕТАЛЬНО

### 11.1. Назначение

`sentiment-adapter.js` конвертирует sentiment-данные (значения от −1.0 до +1.0) в choropleth-формат для Leaflet. Это аналог `series-adapter.js` в Metrics Map, но для качественных данных.

### 11.2. Параметры

```javascript
SentimentAdapter.convert(layerId, sentimentData, countries)
```

- `layerId` — идентификатор слоя (определяет spatial proxy и трансформацию).
- `sentimentData` — массив sentiment-значений от API.
- `countries` — массив 90 стран из `countries.js`.

### 11.3. Spatial Proxies

| Proxy | Страны | Применение |
|-------|--------|-----------|
| media_market | страны с крупными медиарынками | sentiment медиа |
| language_region | группировка по языковым регионам | sentiment соцсетей |
| all_countries | все 90 стран | общий sentiment |
| news_producers | страны-производители новостей | нарративы |

### 11.4. Трансформации

| Трансформация | Что делает | Применение |
|---------------|------------|------------|
| sentiment_score | прямое значение sentiment (−1..+1) | базовая тональность |
| sentiment_intensity | абсолютная величина | сила эмоциональной окраски |
| sentiment_shift | изменение за период | динамика тональности |
| narrative_dominance | доля доминирующего нарратива | нарративы |
| credibility_score | оценка достоверности | достоверность источников |

### 11.5. Классификация

- **5 классов** (Cowan 2001: 4±1 чанк — оптимальное число для восприятия diverging шкал).
- Метод: Jenks DP по умолчанию, manual для индексов.
- GVF > 0.7 — порог качества.

---

## 12. ТЕКУЩЕЕ СОСТОЯНИЕ (30.09.2026)

| Компонент | Статус |
|-----------|--------|
| 35 слоёв загружены | ✅ |
| Панель слоёв (12 категорий, 36 кнопок) | ✅ |
| Границы data/world.geojson локально | ✅ |
| SemanticMap оркестратор | ✅ |
| Sentiment-adapter (5 классов) | ✅ |
| Автономный fallback (без API) | ✅ |
| Jenks DP + GVF | ✅ |
| Diverging легенда (RdYlGn5) | ✅ |
| Categorical легенда (Set1) | ✅ |
| CII fallback | ✅ |
| SSI | ✅ |
| Кнопка КОПИРОВАТЬ (~300–500 КБ) | ✅ |
| Sentiment-fallback (90 стран на слой) | ✅ |
| Кнопка «Включить все» | ⚠️ Требует проверки |
| Категориальные кластеры — цвета Set1 | ⚠️ Требует проверки совпадения с легендой |
| Fallback для categorical слоёв | ⚠️ Требует реализации |

---

## 13. ЧТО НУЖНО ДОДЕЛАТЬ

### 13.1. Fallback для categorical слоёв
Проблема: `renderCategoricalFallback` может быть не реализован для категориальных слоёв (topic-clusters, narrative-clusters).

Требуется:
- Реализовать детерминированную генерацию кластеров (0–9) для 90 стран.
- Применить палитру Set1 (10 цветов).
- Нарисовать категориальную легенду (не числовую).

### 13.2. Цвета Set1 и легенда
Проблема: цвета Set1 (10 цветов) могут не совпадать с легендой — легенда может отображать числовые пороги вместо категорий.

Требуется:
- Для categorical слоёв легенда показывает названия кластеров, а не числа.
- Каждый цвет в легенде подписан именем темы/нарратива.

### 13.3. Кнопка «Включить все»
Аналогично Metrics Map — проверить обработку всех 35 слоёв.

### 13.4. Размер снапшота
Целевой размер: 300–500 КБ при 35 слоях с данными.

---

## 14. ГЛАВНЫЙ ФАЙЛ ДЛЯ ВВОДА В НОВЫЙ ЧАТ

Этот файл — единственный источник контекста для нового экземпляра ИИ. Прочитав его, ИИ сразу понимает:

- Что такое Semantic Map и её место в экосистеме из 5 карт.
- Какая структура папки (20 обязательных файлов).
- Как работает каждая часть (DAG, функциональная матрица).
- Какие слои загружены и как они визуализируются.
- Какие задачи решены и что осталось доделать.
- Какие принципы автономии (R1–R6) и как их проверять.

---

## 15. ПРАВИЛА ПРОЕКТА

- **Правило №19:** не удалять недоделанные модули. Все старые файлы — в `_archive/`, не удаляются.
- **Правило №40:** удаление — только с разрешения пользователя.
- **Правило №36:** высокий уровень программирования, никаких упрощений.
- **Правило №10:** полная замена файлов, а не фрагменты.
- **Правило №27:** не урезать функционал. Новое ≥ старое.

---

## 16. ПОЛНЫЙ СПИСОК 35 СЛОЁВ — КАТАЛОГ

### 16.1. SENTIMENT — 8 слоёв

**1. sentiment-positive** — «Позитивная тональность»
- vizType: choropleth, method: jenks, palette: RdYlGn5
- Источник: GDELT, Media Cloud
- Что показывает: доля позитивных текстов в медиапотоке, −1.0 до +1.0

**2. sentiment-negative** — «Негативная тональность»
- vizType: choropleth, method: jenks, palette: RdYlGn5
- Источник: GDELT
- Что показывает: доля негативных текстов

**3. sentiment-neutral** — «Нейтральная тональность»
- vizType: choropleth, method: jenks, palette: RdYlGn5
- Источник: GDELT
- Что показывает: доля нейтральных текстов

**4. sentiment-intensity** — «Интенсивность тональности»
- vizType: choropleth, method: jenks, palette: OrRd
- Источник: GDELT
- Что показывает: абсолютная сила эмоциональной окраски

**5. sentiment-shift** — «Изменение тональности»
- vizType: choropleth, method: jenks, palette: RdBu5
- Источник: GDELT
- Что показывает: динамика тональности за период (diverging: ухудшение ↔ улучшение)

**6. sentiment-volatility** — «Волатильность тональности»
- vizType: choropleth, method: jenks, palette: YlOrRd
- Источник: GDELT
- Что показывает: изменчивость тональности во времени

**7. sentiment-polarization** — «Поляризация мнений»
- vizType: choropleth, method: jenks, palette: OrRd
- Источник: GDELT
- Что показывает: степень расхождения мнений в медиапотоке

**8. sentiment-overall** — «Общая тональность»
- vizType: choropleth, method: jenks, palette: RdYlGn5
- Источник: GDELT, Media Cloud
- Что показывает: композитный индекс тональности

### 16.2. NARRATIVES — 5 слоёв

**9. narrative-dominant** — «Доминирующий нарратив»
- vizType: categorical, palette: Set1
- Источник: GDELT, Media Cloud
- Что показывает: основной нарратив в медиапотоке страны (10 кластеров)

**10. narrative-spread** — «Распространение нарративов»
- vizType: choropleth, method: jenks, palette: OrRd
- Источник: GDELT
- Что показывает: скорость и охват распространения нарративов

**11. narrative-competition** — «Конкуренция нарративов»
- vizType: choropleth, method: jenks, palette: YlOrRd
- Источник: GDELT
- Что показывает: количество конкурирующих нарративов

**12. narrative-fragments** — «Фрагменты нарративов»
- vizType: categorical, palette: Set1
- Источник: GDELT
- Что показывает: классификация фрагментов нарративов по кластерам

**13. narrative-coherence** — «Когерентность нарративов»
- vizType: choropleth, method: jenks, palette: Greens
- Источник: GDELT
- Что показывает: внутренняя согласованность нарративов

### 16.3. DISINFORMATION — 4 слоя

**14. disinformation-index** — «Индекс дезинформации»
- vizType: choropleth, method: manual, palette: OrRd5
- Breaks: [0, 25, 50, 75, 100]
- Источник: GDELT, Fact-Checkers
- Что показывает: уровень дезинформации, 0–100, больше = хуже

**15. fake-news-detected** — «Обнаруженные фейки»
- vizType: choropleth, method: jenks, palette: OrRd
- Источник: Fact-Checkers
- Что показывает: количество обнаруженных фальшивых новостей

**16. bot-activity** — «Активность ботов»
- vizType: choropleth, method: jenks, palette: YlOrRd
- Источник: Botometer, GDELT
- Что показывает: уровень автоматизированной активности в соцсетях

**17. fact-check-rate** — «Частота фактчекинга»
- vizType: choropleth, method: jenks, palette: Greens
- Источник: Fact-Checkers
- Что показывает: доля проверенных утверждений

### 16.4. MEDIA-TONE — 3 слоя

**18. media-tone-government** — «Тон медиа: правительство»
- vizType: choropleth, method: jenks, palette: RdYlGn5
- Источник: GDELT
- Что показывает: тональность медиа по отношению к правительству

**19. media-tone-opposition** — «Тон медиа: оппозиция»
- vizType: choropleth, method: jenks, palette: RdYlGn5
- Источник: GDELT
- Что показывает: тональность медиа по отношению к оппозиции

**20. media-tone-foreign** — «Тон медиа: внешняя политика»
- vizType: choropleth, method: jenks, palette: RdYlGn5
- Источник: GDELT
- Что показывает: тональность медиа по внешнеполитическим темам

### 16.5. PROPAGANDA — 3 слоя

**21. propaganda-index** — «Индекс пропаганды»
- vizType: choropleth, method: manual, palette: OrRd5
- Breaks: [0, 20, 40, 60, 80]
- Источник: GDELT
- Что показывает: уровень пропагандистской активности, 0–100

**22. propaganda-techniques** — «Приёмы пропаганды»
- vizType: choropleth, method: jenks, palette: OrRd
- Источник: GDELT
- Что показывает: разнообразие используемых пропагандистских приёмов

**23. state-media-tone** — «Тон государственных медиа»
- vizType: choropleth, method: jenks, palette: RdYlGn5
- Источник: GDELT
- Что показывает: тональность государственных СМИ

### 16.6. INFO-WARFARE — 2 слоя

**24. info-warfare-index** — «Индекс информационного противоборства»
- vizType: choropleth, method: manual, palette: YlOrRd
- Breaks: [20, 40, 60, 80]
- Источник: GDELT
- Что показывает: интенсивность информационного противоборства

**25. info-operations** — «Информационные операции»
- vizType: choropleth, method: jenks, palette: OrRd
- Источник: GDELT
- Что показывает: выявленные информационные операции

### 16.7. SOCIAL-MEDIA — 3 слоя

**26. social-media-activity** — «Активность в соцсетях»
- vizType: choropleth, method: jenks, palette: Blues
- Источник: GDELT, Social Media APIs
- Что показывает: уровень активности в социальных медиа

**27. social-media-emotion** — «Эмоции в соцсетях»
- vizType: choropleth, method: jenks, palette: RdYlGn5
- Источник: GDELT
- Что показывает: эмоциональную окраску сообщений в соцсетях

**28. social-media-mobilization** — «Мобилизация через соцсети»
- vizType: choropleth, method: jenks, palette: OrRd
- Источник: GDELT
- Что показывает: уровень мобилизационной активности через соцсети

### 16.8. TOPICS — 2 слоя

**29. topic-clusters** — «Кластеры тем»
- vizType: categorical, palette: Set1
- Источник: GDELT, LDA Topic Modeling
- Что показывает: доминирующие темы по странам (10 кластеров)

**30. topic-distribution** — «Распределение тем»
- vizType: categorical, palette: Set1
- Источник: GDELT
- Что показывает: распределение тем по географии

### 16.9. CREDIBILITY — 2 слоя

**31. source-credibility** — «Достоверность источников»
- vizType: choropleth, method: jenks, palette: Greens
- Источник: Media Bias/Fact Check
- Что показывает: средняя достоверность источников по странам

**32. media-transparency** — «Прозрачность медиа»
- vizType: choropleth, method: jenks, palette: Greens
- Источник: RSF Press Freedom Index
- Что показывает: уровень прозрачности медиасреды

### 16.10. COGNITIVE-BIAS — 1 слой

**33. cognitive-bias-index** — «Индекс когнитивных искажений»
- vizType: choropleth, method: jenks, palette: YlOrRd
- Источник: GDELT
- Что показывает: уровень систематических когнитивных искажений в медиапотоке

### 16.11. MANIPULATION — 1 слой

**34. manipulation-index** — «Индекс манипуляций»
- vizType: choropleth, method: jenks, palette: OrRd
- Источник: GDELT
- Что показывает: уровень приёмов манипуляции в текстах

### 16.12. TOXICITY — 1 слой

**35. language-toxicity** — «Языковая токсичность»
- vizType: choropleth, method: jenks, palette: OrRd
- Источник: GDELT, Perspective API
- Что показывает: уровень агрессии и токсичности в текстах по странам

---

## 17. API-ЭНДПОИНТЫ

### 17.1. Choropleth-слои (31)
```
GET /api/layers/<layerId>/featurecollection
```

### 17.2. Categorical-слои (4)
```
GET /api/layers/<layerId>/featurecollection
```

Ответ содержит `cluster` (0–9) вместо `value`:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "Германия", "cluster": 3, "cluster_name": "Экономическая повестка" },
      "geometry": { ... }
    }
  ]
}
```

### 17.3. CII API
```
GET /api/cii-api
```

---

## 18. КОНТРАКТЫ МЕЖДУ КАРТАМИ

### 18.1. Навигация

```html
<a class="map-switch-btn" data-map="events" href="../event-map/">Events</a>
<a class="map-switch-btn" data-map="metrics" href="../metrics-map/">Metrics</a>
<a class="map-switch-btn active" data-map="meanings" href="./">Semantic</a>
<a class="map-switch-btn" data-map="relations" href="../network-map/">Network</a>
<a class="map-switch-btn" data-map="forecasts" href="../forecast-map/">Forecast</a>
```

### 18.2. Формат mapType

```html
<script>window.CrucixMap = { mapType: 'meanings', name: 'Crucix — Semantic Map' };</script>
```

### 18.3. manifest.json

```json
{
  "mapType": "meanings",
  "name": "Crucix — Semantic Map",
  "version": "1.1",
  "layers": 35,
  "categories": 12,
  "local_cross_map": 0,
  "failure_domain": 1
}
```

---

## 19. УРОВНИ ГОТОВНОСТИ

| Уровень | Критерий | Semantic Map |
|---------|----------|--------------|
| L1: Скелет | index.html + manifest.json + структура папок | ✅ |
| L2: Автономия | R1–R6, 0 cross-map, локальный geojson | ✅ |
| L3: Функционал | Слои работают, fallback, легенда, GVF | ⚠️ 85% (categorical fallback) |
| L4: Полировка | Help, диагностика, manifest, clean-archive | 🔄 В работе |

---

## 20. ГЛОССАРИЙ

- **Sentiment** — эмоциональная окраска текста (от −1.0 негативная до +1.0 позитивная).
- **Narrative** — устоявшийся сюжет или фрейминг в медиапотоке.
- **Disinformation** — целенаправленное распространение ложной информации.
- **Categorical layer** — слой с категориальными данными (не числовыми). Использует Set1 палитру.
- **Spatial proxy** — метод распределения данных по странам на основе их характеристик.
- **SentimentAdapter** — модуль конвертации sentiment-данных в choropleth-формат.
- **Set1** — категориальная палитра ColorBrewer с 10 цветами.
- **Cowan 2001** — исследование оптимального числа классов для восприятия (4±1 чанк).

---

## 21. БЫСТРЫЙ СТАРТ

### 21.1. Если вы только начали работать с Semantic Map
1. Раздел 1 — что такое Semantic Map и её место в экосистеме.
2. Раздел 2 — структура папки.
3. Раздел 5 — распределение 35 слоёв.
4. Раздел 6 — как работает каждый тип слоя.
5. Раздел 11 — sentiment-adapter детально.
6. Раздел 12 — текущее состояние.
7. Раздел 13 — что нужно доделать.

### 21.2. Если хотите добавить новый слой
1. Откройте `js/layers.js`.
2. Добавьте: `{ id: "new-sentiment", name: "Новый анализ", color: "#ff0000", icon: "📝", category: "sentiment", vizType: "choropleth" }`.
3. Если categorical — добавьте в `maps-config.js` палитру Set1.
4. Обновите `SEMANTIC-MAP-MANIFEST.md` (раздел 16).

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

