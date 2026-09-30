================================================================================
SEMANTIC MAP — АРХИТЕКТУРНАЯ СПЕЦИФИКАЦИЯ
================================================================================

Дата: 2026-09-29
Версия карты: 1.1
Расположение: /home/ta8_/Рабочий стол/Crucix/dashboard/public/semantic-map/
Сервер: http://localhost:3117/semantic-map/
Режим: FULL ISOLATION, failure domain = 1

================================================================================
1. НАЗНАЧЕНИЕ И МЕСТО В ЭКОСИСТЕМЕ
================================================================================

1.1. Экосистема Crucix — 5 автономных карт

Crucix — геополитическая OSINT-платформа из 5 карт:

1. Event Map (/event-map/) — 84 слоя, маркеры событий.
2. Metrics Map (/metrics-map/) — 75 слоёв, choropleth.
3. Semantic Map (/semantic-map/) — 35 слоёв, семантика (ЭТА КАРТА).
4. Forecast Map (/forecast-map/) — 16 слоёв, вероятностные прогнозы.
5. Network Map (/network-map/) — 12 слоёв, SVG force-directed.

1.2. Что делает Semantic Map

Semantic Map визуализирует результаты семантического анализа
текстов. Каждый слой — один метод анализа:

- Marker (22 слоя) — точечные объекты на карте.
- Sentiment (6 слоёв) — тональность текстов, шкала [-1, +1].
- Cluster (4 слоя) — категориальная кластеризация.
- Credibility (3 слоя) — уровень доверия к источникам.

Всего: 35 слоёв в 4 категориях.

1.3. Автономность

- R1: ноль ../other-map/ ссылок в скриптах, fetch, link. Только
  навигационные <a href>.
- R2: локальный data/world.geojson (252 КБ).
- R3: ровно 35 слоёв Semantic Map, чужих — 0.
- R4: свой maps-config.js и presets.json.
- R5: manifest.json → local_cross_map: 0, failure_domain: 1.
- R6: сбой карты не затрагивает 4 остальные.

1.4. Отличия от Metrics Map

Semantic Map и Metrics Map различаются классом данных:

- Metrics Map: числовые индикаторы. vizType = choropleth / series /
  marker. Методы классификации Jenks, Quantile, Equal Interval,
  Standard Deviation, Manual. Палитры ColorBrewer. GVF-контроль.

- Semantic Map: семантические сущности. vizType = marker / sentiment /
  cluster / credibility. Палитры в window.LAYER_OVERRIDES. Методы
  классификации пока не реализованы. Fallback через маркеры.

Числа по странам (metrics) и точки смысловых сущностей (semantic)
не сводятся друг к другу без потери смысла.

================================================================================
2. СТРУКТУРА ПАПКИ
================================================================================

semantic-map/
├── index.html
├── manifest.json
├── SEMANTIC-MAP-MANIFEST.md
├── SEMANTIC-MAP-ARCHITECTURE.md (этот файл)
├── AUTONOMY-CHARTER.md
├── clean-archive.sh
├── backups/
├── _archive/
├── css/
│   └── semantic-map.css
├── js/
│   ├── logger.js
│   ├── core.js
│   ├── countries.js
│   ├── layers.js
│   ├── maps-config.js
│   ├── sentiment-adapter.js
│   ├── map-controls.js
│   ├── markers.js
│   ├── semantic-map.js
│   ├── copy-data.js
│   ├── show-notification.js
│   ├── ssi.js
│   ├── cii.js
│   ├── heat-timeline.js
│   ├── refresh.js
│   └── init.js
├── blocks/
│   ├── topbar.js
│   ├── dashboards-nav.js
│   └── layer-panel.js
├── data/
│   └── world.geojson
└── presets/
    └── presets.json

2.1. Смежные каталоги

- backups/ — автоматически создаваемые бэкапы правок.
  Формат имени: <filename>.<YYYYMMDD-HHMMSS>.
- _archive/ — устаревшие файлы. По правилу №19 не удаляются,
  только перемещаются.

================================================================================
3. DAG ЗАГРУЗКИ (19 ШАГОВ, ПОРЯДОК КРИТИЧЕН)
================================================================================

S01  inline <script>          window.CrucixMap = {mapType:'meanings'}
S02  js/logger.js             CrucixLogger
S03  js/core.js               LANG_DATA, showNotification, setLanguage
S04  js/countries.js          ALL_COUNTRIES[90]
S05  js/layers.js             allLayers[35], LAYER_OVERRIDES
S06  js/maps-config.js        getLayersForMap (заглушка)
S07  js/sentiment-adapter.js  sentimentAdapter.analyze (заглушка)
S08  js/map-controls.js       loadCountryBoundaries, translateCountryName
S09  js/markers.js            generateAllMarkers, updateMarkers
S10  js/semantic-map.js       SemanticMap.init (заглушка)
S11  js/copy-data.js          window.copyAllData
S12  js/show-notification.js  window.showNotification (перекрывает core.js)
S13  js/ssi.js                calculateSSI, window.SSI_VALUE
S14  js/cii.js                updateCII, window.CII_VALUE (no-op)
S15  js/heat-timeline.js      initHeatTimeline
S16  js/refresh.js            startAutoRefresh, refreshMapData
S17  blocks/topbar.js         Кнопки топбара
S18  blocks/dashboards-nav.js Навигация между картами
S19  blocks/layer-panel.js    renderLayerPanel, loadLayer
                              (ПЕРЕКРЫВАЕТ версии из js/layers.js)
S20  js/init.js               loadData, initMap, запуск

Нарушение порядка = window.CrucixMap undefined = карта падает.

3.1. Критические зависимости

- loadLayer определён и в js/layers.js, и в blocks/layer-panel.js.
  blocks/layer-panel.js подключён позже → он перекрывает версию
  из js/layers.js.

- window.showNotification определён и в js/core.js, и в
  js/show-notification.js. Последний перекрывает первый.

- renderLayerPanel определён и в js/layers.js, и в
  blocks/layer-panel.js. Побеждает blocks/layer-panel.js.

3.2. Что загружается в каком порядке в index.html

<script src="js/logger.js"></script>
<script src="js/core.js"></script>
<script src="js/countries.js"></script>
<script src="js/layers.js"></script>
<script src="js/maps-config.js"></script>
<script src="js/sentiment-adapter.js"></script>
<script src="js/map-controls.js"></script>
<script src="js/markers.js"></script>
<script src="js/semantic-map.js"></script>
<script src="js/copy-data.js"></script>
<script src="js/show-notification.js"></script>
<script src="js/ssi.js"></script>
<script src="js/cii.js"></script>
<script src="js/heat-timeline.js"></script>
<script src="js/refresh.js"></script>
<script src="blocks/topbar.js"></script>
<script src="blocks/dashboards-nav.js"></script>
<script src="blocks/layer-panel.js"></script>
<script src="js/init.js"></script>

Итого 19 скриптов + 1 inline в head.

================================================================================
4. ФУНКЦИОНАЛЬНАЯ МАТРИЦА
================================================================================

logger.js — CrucixLogger.log/warn/error. Не хранит массив logs.
core.js — LANG_DATA, showNotification, setLanguage. Логику карты не делает.
countries.js — массив 90 стран с координатами. UI не делает.
layers.js — 35 слоёв, LAYER_OVERRIDES, версия renderLayerPanel/
  loadLayer. Загрузку данных не делает (перекрыто blocks/).
maps-config.js — getLayersForMap (заглушка). Конфигурацию choropleth
  не делает.
sentiment-adapter.js — sentimentAdapter.analyze (заглушка). Реальный
  анализ не делает.
map-controls.js — Leaflet init, границы, translateCountryName.
  Choropleth не реализован.
markers.js — generateAllMarkers (рандом), updateMarkers. Привязку
  к слоям не делает.
semantic-map.js — SemanticMap.init (заглушка). Логику слоёв не делает.
copy-data.js — window.copyAllData — снапшот. На карту не влияет.
show-notification.js — window.showNotification (перекрывает core.js).
ssi.js — calculateSSI = (markers/100)*50. Стратегический расчёт
  не делает.
cii.js — updateCII (no-op).
heat-timeline.js — initHeatTimeline (30 рандомных баров). Реальную
  тепловую карту не делает.
refresh.js — startAutoRefresh, refreshMapData.
blocks/topbar.js — кнопки топбара.
blocks/dashboards-nav.js — навигация между 5 картами.
blocks/layer-panel.js — панель слоёв (главная версия).
init.js — loadData, initMap, точка входа. Логику слоёв не делает.

================================================================================
5. ПОТОК ДАННЫХ: КЛИК ПО КНОПКЕ СЛОЯ
================================================================================

5.1. Последовательность

Пользователь кликает на кнопку «Радиолокационная разведка».

1. В blocks/layer-panel.js btn.onclick = () => loadLayer('crucix-radar').

2. loadLayer('crucix-radar') — из blocks/layer-panel.js:
   - Обходит все .layer-btn, устанавливает style.background для
     активной.
   - localStorage.setItem('crucix-active-layer', 'crucix-radar').
   - Берёт all = window.markerData || [].
   - Фильтрует: filtered = all.filter(m => m.layer === 'crucix-radar').
   - Вызывает updateMarkers(filtered).
   - Вызывает showNotification(filtered.length + ' маркеров').

3. updateMarkers(filtered) — из js/markers.js:
   - Если window.markerCluster существует — clearLayers.
   - Иначе — создаёт L.markerClusterGroup.
   - Обходит filtered, для каждого создаёт L.marker с popup.
   - Добавляет в markerCluster.
   - Сохраняет в window.allMarkers.

4. На карте отображаются маркеры только этого слоя.

5.2. Что НЕ происходит

- НЕ делается fetch к layer.route (даже если route есть).
- НЕ пишется в window.layerCache.
- НЕ пишется в window.activeLayerIds.
- НЕ вызывается window.SemanticMap.loadLayer.
- НЕ вызывается applyChoropleth.
- НЕ обновляется легенда.

Это ключевое отличие от Metrics Map. В Semantic Map версия
loadLayer из blocks/layer-panel.js — упрощённая: только фильтр
маркеров.

5.3. Версия loadLayer из js/layers.js (перекрытая)

В js/layers.js есть более сложная версия:
- Проверяет window.SemanticMap.loadLayer — делегирует.
- Обновляет активную кнопку через classList.toggle('active').
- Устанавливает window.currentLayer.
- Для 'all' — generateAllMarkers + updateMarkers.
- Для route-слоёв — fetch с fallback.
- Для без-route — generateAllMarkers + фильтр.

Эта версия НЕ работает, потому что blocks/layer-panel.js подключён
позже и перекрывает window.loadLayer.

5.4. Ключевые инварианты

- window.layerCache — всегда {} в текущей версии.
- window.activeLayerIds — всегда [] в текущей версии.
- window.markerData — 106 маркеров (2-4 на каждый из 35 слоёв).
- window.currentLayer — 'all' (не меняется).
- window.allMarkers — пересоздаётся при каждом updateMarkers.

5.5. Фрагмент кода loadLayer (blocks/layer-panel.js)

function loadLayer(layerId) {
    var btns = document.querySelectorAll('.layer-btn');
    for (var i = 0; i < btns.length; i++) {
        var active = btns[i].dataset.layerId === layerId;
        btns[i].style.background = active ? 'rgba(91,192,248,0.15)' : 'transparent';
        btns[i].style.borderColor = active ? 'rgba(91,192,248,0.3)' : 'transparent';
    }
    localStorage.setItem('crucix-active-layer', layerId);

    var all = window.markerData || [];
    if (layerId === 'all') {
        if (typeof updateMarkers === 'function') updateMarkers(all);
        showNotification('Все слои: ' + all.length + ' маркеров');
        return;
    }
    var filtered = [];
    for (var i = 0; i < all.length; i++) {
        if (all[i].layer === layerId) filtered.push(all[i]);
    }
    if (typeof updateMarkers === 'function') updateMarkers(filtered);
    showNotification(filtered.length + ' маркеров');
}

ВАЖНО: этот loadLayer не делает fetch, не пишет в layerCache, не
вызывает window.SemanticMap. Он только фильтрует маркеры. Это
принципиально отличается от loadLayer в Metrics Map.

5.6. Сравнение с Metrics Map

В Metrics Map поток данных сложнее:
1. loadLayer(layerId) → MetricsMap.interceptLoad(layerId).
2. interceptLoad определяет vizType.
3. Для choropleth: fetchWithTimeout → applyChoropleth.
4. Для series: fetchWithTimeout → SeriesAdapter.convert → applyChoropleth.
5. Для marker: fetchWithTimeout → updateMarkers.
6. При ошибке fetch — renderFallback (локальная генерация 90 стран).
7. Результат сохраняется в window.layerCache[layerId].

В Semantic Map всё проще: один шаг — фильтрация маркеров.
Оркестратор SemanticMap — заглушка. Это задача v1.2.

================================================================================
6. ГЛАВНЫЙ ОРКЕСТРАТОР — js/semantic-map.js
================================================================================

6.1. Текущая версия (заглушка)

console.log('semantic-map.js загружен');
var SemanticMap = {
    init: function() {
        console.log('[SemanticMap] init');
        var layers = window.allLayers || [];
        console.log('[SemanticMap] слоёв: ' + layers.length);
    }
};
window.SemanticMap = SemanticMap;
console.log('semantic-map.js готов');

Это заглушка. Функции loadLayer, interceptLoad, renderFallback,
fetchWithTimeout отсутствуют. В этом принципиальное отличие от
Metrics Map, где MetricsMap — полноценный оркестратор.

6.2. Что должно быть в v1.2

Метод init() — идемпотентная инициализация.
Метод fetchWithTimeout(url, ms) — fetch с AbortController.
Метод interceptLoad(layerId, markerAccumulator) — decision tree.
Метод loadMarkerLayer(layer, markerAccumulator) — fetch → marker fallback.
Метод loadSentimentLayer(layer) — fetch → sentiment choropleth.
Метод loadClusterLayer(layer) — fetch → категориальная визуализация.
Метод loadCredibilityLayer(layer) — fetch → credibility choropleth.
Метод renderMarkerFallback(layer, markerAccumulator) — генерация маркеров.
Метод renderSentimentFallback(layer) — генерация sentiment.
Метод renderCredibilityFallback(layer) — генерация credibility.
Метод resolveApiUrl(layerId) — карта routes.
Метод stats() — сводка по vizType.

6.3. Аналог из Metrics Map

В Metrics Map есть metrics-map.js v1.4 — полноценный оркестратор:
- fetchWithTimeout(url, ms = 8000) через AbortController.
- interceptLoad(layerId, markerAccumulator) — decision tree по vizType.
- renderFallback(layer) — 90 стран, Jenks/manual.
- renderMarkerFallback(layer, markerAccumulator) — 180 маркеров.
- markerAccumulator — задел для параллелизма.

В Semantic Map всё это нужно написать с нуля в v1.2.

6.4. Разница в оркестраторах

Metrics Map оркестратор MetricsMap знает про:
- Choropleth (56 слоёв).
- Series (14 слоёв).
- Marker (6 слоёв).
- Классификацию (Jenks, Quantile и т.д.).
- GVF.
- Fallback через детерминированный генератор.

Semantic Map оркестратор SemanticMap должен знать про:
- Marker (22 слоя).
- Sentiment (6 слоёв).
- Cluster (4 слоя).
- Credibility (3 слоя).
- Sentiment-adapter (реальный анализ текстов).
- Fallback через маркеры (для marker) или через choropleth.

================================================================================
7. blocks/layer-panel.js — ГЛАВНАЯ ВЕРСИЯ ПАНЕЛИ
================================================================================

7.1. Назначение

Определяет window.renderLayerPanel, window.loadLayer,
window.toggleLayerPanel, window.toggleCategory. Перекрывает версии
из js/layers.js, потому что подключён позже (S19 после S05).

7.2. renderLayerPanel

Вход: layers (обычно window.allLayers).
Выход: заполненный #layer-list в DOM.

Структура:
1. Кнопка «Все слои (35)» в allDiv.
2. Группировка по category: intelligence (15), semantic (14),
   specialist (3), other (3).
3. Для каждой категории:
   - header с иконкой и названием.
   - grid с кнопками слоёв.
   - btn.dataset.layerId = layer.id.
   - btn.dataset.category = cat.
   - btn.innerHTML = '<span class="dot">' + layer.name.

7.3. loadLayer

Вход: layerId ('all' или ID слоя).
Действия:
1. Обход .layer-btn, style.background для активной.
2. localStorage.setItem('crucix-active-layer', layerId).
3. Если layerId === 'all':
   - updateMarkers(all) с window.markerData.
   - showNotification('Все слои: ' + all.length + ' маркеров').
   - return.
4. Иначе:
   - filtered = all.filter(m => m.layer === layerId).
   - updateMarkers(filtered).
   - showNotification(filtered.length + ' маркеров').

7.4. toggleLayerPanel

Переключает видимость панели. panelVisible — локальная переменная.
Работает с #layer-panel, #sidebar.

7.5. toggleCategory

Переключает видимость grid категории. categoryStates — локальный
объект.

7.6. Что НЕ делает loadLayer

- Не делает fetch.
- Не пишет в layerCache.
- Не пишет в activeLayerIds.
- Не делегирует SemanticMap.
- Не обновляет легенду.
- Не устанавливает window.currentLayer.

7.7. Что нужно исправить в v1.2

1. Добавить fetch с timeout для route-слоёв.
2. Добавить запись в layerCache.
3. Добавить запись в activeLayerIds.
4. Использовать classList.toggle('active') вместо style.background.
5. Делегировать в SemanticMap.interceptLoad для decision tree.

================================================================================
8. js/layers.js — 35 СЛОЁВ И LAYER_OVERRIDES
================================================================================

8.1. DEMO_LAYERS

Массив 35 объектов. Каждый:
{ id, name, color, icon, category, vizType, crucix?, route? }

Примеры:
- timeline: {id: 'timeline', name: 'Временная шкала',
  color: '#44aaff', icon: '...', category: 'intelligence',
  vizType: 'marker'}
- crucix-radar: {..., crucix: true}
- narrative-drift-api: {..., route: '/api/layers/narrative-drift',
  category: 'specialist', vizType: 'sentiment'}

8.2. LAYER_OVERRIDES

Объект с 12 конфигурациями:

'crucix-pattern-life': {
    vizType: 'sentiment',
    palette: 'RdYlGn5',
    method: 'jenks',
    classes: 5,
    description: 'Шаблоны поведения: отклонение от нормы'
},
'sentiment-analysis': {
    vizType: 'sentiment',
    palette: 'RdYlGn5',
    method: 'manual',
    breaks: [-0.6, -0.2, 0.2, 0.6]
},
...
'adaptive-news-clustering-api': {
    vizType: 'cluster',
    palette: 'Set1',
    method: 'categorical'
},
...

8.3. renderLayerPanel (версия из js/layers.js)

Отличается от версии в blocks/. Использует list.innerHTML = ''.
Группирует по категориям, добавляет catIcons, catNames.
НЕ активна (перекрыта).

8.4. loadLayer (версия из js/layers.js)

Более сложная: делегирует SemanticMap.loadLayer, fetch для route,
updateActiveCount, updateLegend. НЕ активна.

8.5. toggleLayer, updateMapLayers

toggleLayer управляет activeLayerIds (массив). updateMapLayers
собирает маркеры из кеша. Не вызываются из UI.

8.6. Экспорты

window.renderLayerPanel = renderLayerPanel;
window.toggleLayer = toggleLayer;
window.loadLayer = loadLayer;
window.updateMapLayers = updateMapLayers;
window.allLayers = DEMO_LAYERS;
window.LAYER_OVERRIDES = LAYER_OVERRIDES;
window.activeLayerIds = [];
window.layerCache = {};
window.currentLayer = 'all';

================================================================================
9. js/markers.js — МАРКЕРЫ
================================================================================

9.1. generateAllMarkers

Генерирует window.markerData. Для каждого слоя:
count = 2 + floor(random * 3) → 2-4 маркера.
Координаты: lat = (random - 0.5) * 120, lng = (random - 0.5) * 340.

Результат: 35 слоёв × ~3 = ~106 маркеров.

Пример маркера:
{
    lat: 4.73, lng: 48.67,
    layer: 'timeline',
    name: 'Временная шкала',
    color: '#44aaff',
    icon: '...',
    title: 'Временная шкала #1'
}

9.2. updateMarkers

Вход: массив маркеров.
Действия:
1. Если window.markerCluster — clearLayers.
2. Иначе — создаёт L.markerClusterGroup({maxClusterRadius: 50}).
3. Для каждого маркера создаёт L.marker([lat, lng]).
4. Popup: '<b>' + title + '</b><br>' + '<span style="color:color">●</span> <small>' + layer + '</small>'.
5. Добавляет в markerCluster.

9.3. Что важно

- Маркеры рандомные. Это заглушка для демонстрации.
- В Metrics Map маркеры генерируются детерминированно из координат
  стран. В Semantic Map — рандомные координаты.
- При переключении слоя updateMarkers вызывается заново, cluster
  очищается.
- Попап не экранирует title — потенциальная XSS-уязвимость.

9.4. Что нужно исправить в v1.2

1. Заменить рандомные координаты на координаты стран из
   ALL_COUNTRIES.
2. Добавить escapeHtml для title, layer, countryName.
3. Добавить группировку по типу маркера (4 формы узлов из Network Map
   как референс).
4. Оптимизировать: использовать markerCluster.addLayers() вместо
   addLayer() в цикле.

================================================================================
10. js/map-controls.js — ГРАНИЦЫ И ПЕРЕВОД
================================================================================

10.1. loadCountryBoundaries

Fetch 'data/world.geojson', добавляет L.geoJson на карту со стилем:
- fillColor: '#1a2a3a'
- weight: 0.5
- color: '#3a5a7a'
- fillOpacity: 0.3

Для каждой страны:
- translateCountryName из EN_TO_RU.
- bindPopup с русским именем.
- mouseover: fillOpacity 0.5, weight 1.5, color '#5bc0f8'.
- mouseout: возврат к исходному.

10.2. EN_TO_RU

Объект с 150+ переводами. Примеры:
'Afghanistan': 'Афганистан'
'United Arab Emirates': 'ОАЭ'
'United Kingdom': 'Великобритания'
'United States': 'США'
'Russia': 'Россия'

10.3. applyChoropleth (заглушка)

function applyChoropleth(data) { ... }
В текущей версии — заглушка. Не вызывается. В Metrics Map эта
функция выполняет заливку стран по значениям.

10.4. resetChoropleth (заглушка)

Возвращает все страны к базовому стилю. Не вызывается.

10.5. getChoroplethColor

Простые цвета по порогам:
if (value > 0.7) return '#ef4444';
if (value > 0.4) return '#f59e0b';
if (value > 0.2) return '#22c55e';
return '#1a2a3a';

Это заглушка. В v1.2 должно быть:
1. classifyValues(values, method, numClasses, manualBreaks).
2. getColorForValue(value, breaks, palette).
3. renderChoroplethLegend(breaks, config, gvf).

10.6. Что важно

- world.geojson загружается корректно, границы отображаются.
- translateCountryName работает.
- Choropleth не реализован.
- getChoroplethColor — заглушка.

10.7. Что нужно исправить в v1.2

1. Реализовать applySentimentChoropleth (по образцу applyChoropleth
   из Metrics Map).
2. Реализовать applyCredibilityChoropleth.
3. Реализовать classifyValues (manual, jenks, quantile).
4. Реализовать getColorForValue.
5. Реализовать renderSentimentLegend, renderCredibilityLegend.
6. Экспортировать currentChoroplethConfig и currentChoroplethData
   в window.

================================================================================
11. ДИАГНОСТИКА — КОНТРОЛЬНЫЕ МЕТРИКИ
================================================================================

11.1. Полная проверка (одна команда в консоли)

(() => {
    console.log('=== SEMANTIC MAP ДИАГНОСТИКА ===');
    console.log('Слоёв:', window.allLayers?.length);          // 35
    console.log('Стран:', window.ALL_COUNTRIES?.length);      // 90
    console.log('Активных:', window.activeLayerIds?.length);  // 0
    console.log('В кеше:', Object.keys(window.layerCache || {}).length); // 0
    console.log('Маркеров:', (window.markerData || []).length); // 106
    console.log('Карта:', !!window.leafletMap);
    console.log('CII:', window.CII_VALUE);                    // 45
    console.log('SSI:', window.SSI_VALUE);                    // 53
    console.log('================================');
})();

11.2. Проверка распределения по vizType

const byVizType = {};
for (const l of window.allLayers || []) {
    const vt = l.vizType || 'marker';
    byVizType[vt] = (byVizType[vt] || 0) + 1;
}
console.log('По vizType:', byVizType);
// Ожидание: { marker: 22, sentiment: 6, cluster: 4, credibility: 3 }

11.3. Проверка распределения по категориям

const byCat = {};
for (const l of window.allLayers || []) {
    const c = l.category || 'other';
    byCat[c] = (byCat[c] || 0) + 1;
}
console.log('По категориям:', byCat);
// Ожидание: { intelligence: 15, semantic: 14, specialist: 3, other: 3 }

11.4. Проверка route-слоёв

const withRoute = (window.allLayers || []).filter(l => l.route);
console.log('С route:', withRoute.length);
// Ожидание: 13
console.log(withRoute.map(l => l.id));

11.5. Проверка DOM панели слоёв

const buttons = document.querySelectorAll('[data-layer-id]');
console.log('Кнопок:', buttons.length);
// Ожидание: 36

const activeBtns = document.querySelectorAll('.layer-btn.active');
console.log('Активных:', activeBtns.length);
// Ожидание: 1

11.6. Проверка LAYER_OVERRIDES

const palettes = {};
for (const [id, ov] of Object.entries(window.LAYER_OVERRIDES || {})) {
    if (ov.palette) {
        palettes[ov.palette] = (palettes[ov.palette] || 0) + 1;
    }
}
console.log('Палитры:', palettes);
// Ожидание: { RdYlGn5: 6, OrRd5: 2, YlOrRd5: 1, Set1: 1, Pastel1: 3 }

11.7. Проверка карты

if (window.leafletMap) {
    console.log('Центр:', window.leafletMap.getCenter());
    console.log('Zoom:', window.leafletMap.getZoom());
    console.log('Layers:', Object.keys(window.leafletMap._layers || {}).length);
}

11.8. Проверка границ

console.log('Границы загружены:', window.boundariesLoaded);
console.log('GeoJSON layer:', !!window.currentGeoJsonLayer);

11.9. Проверка маркеров

console.log('Маркерный кластер:', !!window.markerCluster);
console.log('Слой маркеров:', !!window.allMarkers);
console.log('Количество маркеров:', (window.allMarkers || []).length);

11.10. Проверка определения loadLayer (какая версия активна)

const loadLayerSource = window.loadLayer.toString().slice(0, 200);
console.log('loadLayer:', loadLayerSource);
// Если содержит "SemanticMap.loadLayer" — версия из js/layers.js.
// Если содержит "localStorage.setItem" напрямую — версия из blocks/.

11.11. Проверка переменных окружения

console.log('CrucixMap:', window.CrucixMap);
// Ожидание: {mapType: 'meanings', name: 'Crucix Semantic Map'}

console.log('CrucixLogger:', !!window.CrucixLogger);
console.log('Логи:', window.CrucixLogger?.logs);
// Ожидание: undefined — в semantic-map нет массива logs

11.12. Принудительная перезагрузка

// Пересоздать маркеры
if (typeof window.generateAllMarkers === 'function') {
    window.generateAllMarkers();
    window.updateMarkers(window.markerData);
    console.log('Маркеры пересозданы:', window.markerData.length);
}

// Перерисовать панель слоёв
if (typeof window.renderLayerPanel === 'function') {
    window.renderLayerPanel(window.allLayers);
    console.log('Панель перерисована');
}

================================================================================
12. ИЗВЕСТНЫЕ ГРАБЛИ И РЕШЕНИЯ
================================================================================

12.1. Дубликат loadLayer и renderLayerPanel

Симптом: window.loadLayer.toString() не совпадает с версией
из js/layers.js.

Причина: js/layers.js и blocks/layer-panel.js определяют
одноимённые функции. blocks/ подключён позже — он побеждает.

Решение (v1.2): удалить версии из js/layers.js, оставить только
версию в blocks/layer-panel.js. Или наоборот — перенести всю
логику в js/layers.js, а из blocks/ убрать.

История: обнаружено 29.09.2026.

12.2. layerCache всегда пуст

Симптом: Object.keys(window.layerCache).length = 0 после загрузки.

Причина: loadLayer в blocks/layer-panel.js не пишет в layerCache.

Решение (v1.2): добавить запись window.layerCache[layerId] = filtered
после успешной загрузки.

История: известно с момента создания карты.

12.3. activeLayerIds всегда пуст

Симптом: window.activeLayerIds.length = 0 после кликов.

Причина: loadLayer в blocks/layer-panel.js не пишет в activeLayerIds.

Решение (v1.2): добавить window.activeLayerIds.push(layerId) или
использовать Set.

История: известно с момента создания карты.

12.4. Choropleth не реализован

Симптом: sentiment, cluster, credibility-слои не закрашивают страны.

Причина: map-controls.js::applyChoropleth — заглушка.
sentiment-adapter возвращает {score: 0, label: 'neutral'}.

Решение (v1.2):
1. Реализовать sentiment-adapter.analyze — реальный анализ.
2. Реализовать applySentimentChoropleth, applyCredibilityChoropleth.
3. Реализовать classifyValues (manual, jenks, quantile).
4. Реализовать renderSentimentLegend, renderCredibilityLegend.

История: известно с момента создания карты.

12.5. CII no-op

Симптом: window.CII_VALUE = 45, но в DOM нет #cii-value.

Причина: cii.js пишет в #cii-value, которого нет в index.html.

Решение (v1.2):
Вариант А: добавить <div id="cii-value"></div> в index.html.
Вариант Б: перенаправить updateCII в существующий #ssi-value.
Вариант В: удалить cii.js (правило №19 запрещает).

История: известно с момента создания карты.

12.6. countries.js — 90 из 176

Симптом: window.ALL_COUNTRIES.length = 90, комментарий говорит
«176 СТРАН».

Причина: массив неполный.

Решение (v1.2): дополнить до 176 стран из geo-map/js/countries.js.

История: известно с момента создания карты.

12.7. Кнопки слоёв не получают класс active

Симптом: btn.classList.contains('active') === false после клика.

Причина: loadLayer в blocks/layer-panel.js устанавливает
style.background напрямую, а не через classList.

Решение (v1.2): использовать classList.toggle('active', isActive)
вместо style.background.

История: обнаружено 29.09.2026.

12.8. SSI — простая формула

Симптом: window.SSI_VALUE = 53 при 106 маркерах.

Причина: calculateSSI = Math.round((markers.length / 100) * 50).

Решение (v1.2): реализовать взвешенную формулу по sentiment,
credibility, cluster.

История: известно с момента создания карты.

12.9. Тепловая карта — 30 баров рандом

Симптом: heat-timeline.js генерирует 30 баров случайной высоты.

Причина: Math.random() в цикле.

Решение (v1.2): связать с реальными данными о событиях.

История: известно с момента создания карты.

12.10. XSS-уязвимость в попапах

Симптом: popup формируется через innerHTML с m.title без
экранирования.

Причина: markers.js не использует escapeHtml.

Решение (v1.2): добавить escapeHtml и применять во всех местах,
где вставляются данные.

История: известно с момента создания карты.

12.11. loadLayer в blocks/layer-panel.js не делает fetch для route

Симптом: 13 route-слоёв не запрашивают данные с API.

Причина: loadLayer в blocks/layer-panel.js — упрощённая версия,
только фильтр маркеров.

Решение (v1.2): добавить fetch для route-слоёв, делегировать в
SemanticMap.interceptLoad.

История: известно с момента создания карты.

================================================================================
13. ЧТО ОСТАЛОСЬ СДЕЛАТЬ
================================================================================

13.1. Дополнить countries.js до 176

Файл: js/countries.js.
Действие: заменить массив 90 стран на массив 176 стран из
geo-map/js/countries.js.
Время: 30 мин.
Приоритет: высокий.

13.2. Проверить и исправить R1

Файлы: blocks/topbar.js, blocks/dashboards-nav.js.
Действие: grep -rn '\.\./' — найти cross-map.
Заменить на абсолютные пути /dashboard/<map>/.
Время: 20 мин.
Приоритет: высокий.

13.3. Дописать manifest.json

Файл: manifest.json.
Действие: добавить поля autonomous, principle, categories,
failure_domain, scripts, data.
Время: 15 мин.
Приоритет: средний.

13.4. Реализовать fetch с timeout + кеш + activeLayerIds

Файлы: blocks/layer-panel.js, js/layers.js.
Действие:
1. Добавить fetchWithTimeout(url, ms).
2. В loadLayer: fetch для route, запись в layerCache и
   activeLayerIds.
3. Использовать classList.toggle('active') для кнопок.
Время: 1.5 часа.
Приоритет: высокий.

13.5. Удалить дубликаты loadLayer и renderLayerPanel

Файлы: js/layers.js и blocks/layer-panel.js.
Действие: оставить одну версию (предпочтительно в blocks/),
удалить дубликаты.
Время: 1 час.
Приоритет: средний.

13.6. Реализовать choropleth по sentiment

Файлы: js/sentiment-adapter.js, js/map-controls.js.
Действие:
1. sentiment-adapter.analyze — реальный анализ.
2. applySentimentChoropleth — по образцу Metrics Map.
3. renderSentimentLegend.
Время: 2 часа.
Приоритет: высокий.

13.7. Реализовать choropleth по credibility

Файлы: js/map-controls.js.
Действие: applyCredibilityChoropleth, renderCredibilityLegend.
Время: 1.5 часа.
Приоритет: средний.

13.8. Реализовать категориальную визуализацию cluster

Файлы: js/map-controls.js.
Действие: группировка маркеров по цвету кластера.
Время: 1 час.
Приоритет: средний.

13.9. Реализовать Choropleth-легенду

Файл: js/map-controls.js.
Действие: renderLegend — по образцу Metrics Map.
Время: 1 час.
Приоритет: средний.

13.10. Реализовать SSI

Файл: js/ssi.js.
Действие: взвешенная формула по sentiment/credibility/cluster.
Время: 30 мин.
Приоритет: низкий.

13.11. Реализовать CII

Файлы: js/cii.js, index.html.
Действие: добавить #cii-value в HTML или перенаправить вывод.
Время: 30 мин.
Приоритет: низкий.

13.12. Порядок работ

1. countries.js до 176.
2. R1 cross-map.
3. manifest.json.
4. fetch + кеш + activeLayerIds.
5. Дубликаты.
6. Choropleth sentiment.
7. Choropleth credibility.
8. Категориальный cluster.
9. Choropleth-легенда.
10. SSI.
11. CII.

Оценка времени: 8-12 часов.

================================================================================
14. ПРАВИЛА ПРОЕКТА, ПРИМЕНИМЫЕ К АРХИТЕКТУРЕ
================================================================================

Правило №10: полная замена файлов, не фрагменты.

Правило №11: запрет sed. Только cat > ... << 'EOF'.

Правило №19: не удалять недоделанные модули. Только в _archive/.

Правило №27: не урезать функционал. Новое ≥ старое.

Правило №36: высокий уровень программирования. Никаких упрощений.

Правило №40: удаление — только с разрешения пользователя.

Правило №44: приоритет RULES.txt над любой другой памятью.

================================================================================
15. КОНТРОЛЬНЫЕ ТОЧКИ СЕССИИ 29.09.2026
================================================================================

15.1. Что достигнуто

- 35 слоёв загружены в window.allLayers.
- Панель слоёв с 4 категориями и 36 кнопками.
- world.geojson 252 КБ загружается.
- 106 маркеров (рандом) на карте.
- Кнопка КОПИРОВАТЬ — снапшот v1.0 semantic.
- Навигация между 5 картами.
- Создан SEMANTIC-MAP-MANIFEST.md (31 раздел).
- Создан SEMANTIC-MAP-ARCHITECTURE.md (16 разделов).
- Создан copy-data.js v1.0 semantic.

15.2. Версии файлов на конец сессии

copy-data.js — v1.0 semantic.
layers.js — v1.0 (35 слоёв).
init.js — v1.0.
map-controls.js — v1.0 (заглушка choropleth).
markers.js — v1.0 (рандом).
ssi.js — v1.0 (простая формула).
cii.js — v1.0 (no-op).
manifest.json — v1.0 (неполный).

15.3. Изменения сессии

- Создан SEMANTIC-MAP-MANIFEST.md (31 раздел).
- Создан SEMANTIC-MAP-ARCHITECTURE.md (16 разделов).
- Создан copy-data.js v1.0 semantic (в предыдущей сессии).
- Выявлены 11 грабель (раздел 12).
- Составлен план работ (раздел 13).

15.4. Следующий этап

По приоритету:
1. Дополнить countries.js до 176.
2. Проверить R1 cross-map.
3. Дописать manifest.json.
4. Реализовать fetch + кеш.
5. Удалить дубликаты.
6. Реализовать choropleth sentiment.
7. Реализовать choropleth credibility.
8. Реализовать категориальный cluster.
9. Реализовать Choropleth-легенду.
10. Реализовать SSI и CII.

15.5. Сравнение с Metrics Map по готовности

Metrics Map — эталон. Версия 1.1. L3 90%.
Semantic Map — заготовка. Версия 1.1. L3 63%.

Разрыв: Semantic Map отстаёт на ~1-2 сессии работы.

================================================================================
16. ГЛОССАРИЙ АРХИТЕКТУРЫ
================================================================================

allLayers — массив 35 конфигураций слоёв. Создаётся в js/layers.js
из DEMO_LAYERS. Каждый элемент: {id, name, category, vizType, color,
icon, route?, crucix?}.

activeLayerIds — массив активных id. Всегда пуст в v1.1.

layerCache — {[id]: Array}. Всегда пуст в v1.1.

markerData — массив всех маркеров (106 в v1.1). Заполняется
generateAllMarkers.

allMarkers — копия markerData для откатов. Пересоздаётся при
каждом updateMarkers.

LAYER_OVERRIDES — объект с конфигурациями палитр и методов для
12 слоёв. Определён в js/layers.js.

markerCluster — L.markerClusterGroup. Создаётся при первом
updateMarkers.

geoJsonData — полный GeoJSON границ, загруженный из
data/world.geojson.

currentGeoJsonLayer — Leaflet-слой границ.

window.SemanticMap — оркестратор. В v1.1 — заглушка.

window.CrucixMap — глобальный флаг карты: {mapType, name}.

EN_TO_RU — объект переводов названий стран.

sentimentAdapter — объект с методом analyze (заглушка).

window.SSI_VALUE — числовое значение SSI.

window.CII_VALUE — числовое значение CII.

DEMO_LAYERS — массив 35 слоёв в js/layers.js.

loadLayer (blocks/) — упрощённая версия, только фильтр маркеров.
Активна в v1.1.

loadLayer (js/layers.js) — полная версия с fetch. Перекрыта.

renderLayerPanel (blocks/) — версия с container.innerHTML.
Активна в v1.1.

renderLayerPanel (js/layers.js) — версия с list.innerHTML. Перекрыта.

showNotification (show-notification.js) — перекрывает версию из
core.js.

fetchWithTimeout — функция для fetch с AbortController. Отсутствует
в v1.1, нужна в v1.2.

interceptLoad — метод оркестратора для decision tree по vizType.
Отсутствует в v1.1, нужен в v1.2.

renderFallback — метод для локальной генерации данных. Отсутствует
в v1.1, нужен в v1.2.

renderMarkerFallback — метод для генерации маркеров. Отсутствует
в v1.1, нужен в v1.2.

КОНЕЦ АРХИТЕКТУРНОЙ СПЕЦИФИКАЦИИ
