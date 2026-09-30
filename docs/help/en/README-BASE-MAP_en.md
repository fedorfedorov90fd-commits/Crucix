README-BASE-MAP_en.md
File: docs/help/en/README-BASE-MAP_en.md
Russian: docs/help/ru/README-BASE-MAP_ru.md
Version: 1.0
Date: September 27, 2026
Status: internal architectural document

Table of Contents
Purpose of Base Map

Role in the 5-Map System

File Structure

CSS Files Description

JavaScript Files Description

Data Description

Script Load Order

Template Method Pattern

What Is Inherited, What Is Specialized

List of Inheriting Maps

Key Functions

How to Add a New Map

Related Documents

1. Purpose of Base Map
Base Map is the shared template for all 5 specialized Crucix maps. It contains the infrastructure common to all maps: Leaflet initialization, data loading, layer panel rendering, marker generation, country boundaries, SSI, legend, language switching, preset system, logging.

Location: /home/ta8_/Рабочий стол/Crucix/dashboard/public/base-map/

2. Role in the 5-Map System
Each of the 5 maps (Event Map, Metrics Map, Semantic Map, Network Map, Forecast Map) inherits from Base Map. The difference between maps is only the value of window.CrucixMap.mapType. Everything else is shared infrastructure from Base Map.

Script load order in each map HTML: Base Map is loaded first, the specialized script layers-[mapType].js adds configuration, [mapType]-map.js sets specifics, init.js launches the map.

3. File Structure
Directory /home/ta8_/Рабочий стол/Crucix/dashboard/public/base-map/ contains:

index.html — 263 lines, template with 5 switcher buttons

index.html.origin — 403 lines, real geo-map.html, reference copy

css/core.css — 159 lines

css/header.css — 257 lines

css/layers-panel.css — 385 lines

css/map.css — 252 lines

css/responsive.css — 191 lines

css/cii.css — 111 lines

js/core.js — 119 lines

js/countries.js — 109 lines

js/layers.js — 785 lines

js/layers-dynamic.js — 203 lines

js/markers.js — 160 lines

js/map-controls.js — 389 lines

js/copy-data.js — 274 lines

js/heat-timeline.js — 101 lines

js/ssi.js — 69 lines

js/refresh.js — 90 lines

js/cii.js — 113 lines

js/init.js — 166 lines

js/logger.mjs — 676 lines

js/preset-multi-map.js — 257 lines

js/popups.mjs — 51 lines

js/news-markers.mjs — 33 lines

data/world.geojson — 252 KB

Total 25 files, 540 KB, 5213 lines.

4. CSS Files Description
css/core.css — base styles: reset, typography, common buttons, badges, scrollbars, common classes for all pages.

css/header.css — topbar styles. Contains styles for the base buttons: ← НА ГЛАВНУЮ, 📋 КОПИРОВАТЬ, 📡 Список страниц, ❓ HELP, 📋 Логи, 📊 CII, 🌡️ Тепловая, 📅 Хронология, 📄 PDF, RU/EN switcher, refresh-inline block. Rule 25 of RULES.txt forbids changing these styles and texts.

css/layers-panel.css — right layer panel styles. Contains styles for dashboard navigation, panel header, layer grid, layer buttons, layer search, layer categories, panel collapse button.

css/map.css — styles for map, legend, stats, SSI panel, timeline, Leaflet popups, country boundaries, country labels.

css/responsive.css — adaptive styles for screens up to 992, 768, 480 pixels.

css/cii.css — styles for the CII (Country Instability Index) panel, updated from js/cii.js.

5. JavaScript Files Description
js/core.js — global variables, translations object window.LANG_DATA (RU/EN), functions setLanguage, updateLanguage, showNotification, openHelp, goToDashboard.

js/countries.js — array of 175 countries window.ALL_COUNTRIES with fields id, name, status, color, lat, lng.

js/layers.js — registry of 195 layers window.allLayers, function getLayersForMap(mapType), functions renderLayerPanel, loadLayer, toggleLayerPanel, enableAllLayers, disableAllLayers, filterLayers, toggleCategory, updateActiveCount, updateMapLayers.

js/layers-dynamic.js — dynamic layer adapter, reads /api/registry/layers and adds missing entries to window.allLayers.

js/markers.js — functions generateMarkersForLayer, generateAllMarkers, updateMarkers. The override of generateAllMarkers uses window.CrucixMap.generateOnly to limit generation to visible layers only.

js/map-controls.js — loading country boundaries from world.geojson, country labels, choropleth, functions loadCountryBoundaries, applyChoropleth, resetChoropleth, object COUNTRY_NAME_MAP.

js/copy-data.js — function copyAllData, collects a full page snapshot.

js/heat-timeline.js — functions toggleHeat, toggleTimeline, buildTimeline.

js/ssi.js — functions calculateSSI, updateLegend, Strategic Stress Index computation and legend update.

js/refresh.js — functions startAutoRefresh, stopAutoRefresh, refreshMapData, updateTimerDisplay, formatInterval.

js/cii.js — functions updateCII, updateCIIPanel, updateCountryColors, updateLegend, getCIIColor.

js/init.js — main launch file. Functions getFilteredLayers via getLayersForMap, loadData, initMap. In loadData, window.allLayers is filtered by mapType via window.getLayersForMap, the layer panel is rendered, markers are generated, SSI is updated, country boundaries are loaded.

js/logger.mjs — logging module window.crucixLogger, log panel, export.

js/preset-multi-map.js — preset system. Preserved by Rule 1070 of RULES.txt as non-working but potentially useful.

js/popups.mjs — popup module for map click, function showRegionPopup.

js/news-markers.mjs — news marker module, function addNewsMarkers.

6. Data Description
data/world.geojson — country boundaries file, 252 KB, used by the loadCountryBoundaries function in js/map-controls.js.

Additionally, the directory dashboard/public/ contains world.geojson — 252 KB, because the loadCountryBoundaries function makes a request to fetch('/world.geojson') and the path must point to the static server root.

7. Script Load Order
Scripts are loaded in each map HTML in this order:

<script>window.CrucixMap = { mapType: '...' }</script> — set map type before all other scripts

../base-map/js/core.js

../base-map/js/countries.js

../base-map/js/layers.js

js/layers-[mapType].js — specialized map file

../base-map/js/layers-dynamic.js

../base-map/js/markers.js

../base-map/js/map-controls.js

../base-map/js/copy-data.js?v=3

../base-map/js/heat-timeline.js

../base-map/js/ssi.js

../base-map/js/refresh.js

../base-map/js/logger.mjs — module

../base-map/js/cii.js

js/[mapType]-map.js — specialized map logic

../base-map/js/init.js — last, launches the map

The order must not be changed because window.CrucixMap must be set before layers.js, and init.js must run after all modules.

8. Template Method Pattern
Base Map implements the Template Method pattern from the Design Patterns book (Gamma et al., 1994). The algorithm skeleton (map initialization, data loading, layer panel rendering, marker generation) is defined in Base Map. Steps that must differ for each map (which layers to show, marker rendering, which widgets) are defined in specialized files.

The function window.getLayersForMap(mapType) is an extension point. It is defined in js/layers.js of Base Map but is applied based on the value of window.CrucixMap.mapType set by the specialized map.

9. What Is Inherited, What Is Specialized
Inherited from Base Map:

Map projection, zoom mechanism, tile layer

Layer filtering mechanism getLayersForMap

Layer panel rendering, toggle logic, layer search

Marker generation, generateOnly restriction

Country boundaries, choropleth, country labels

SSI, CII, legend

Data copy

Heat map, timeline

Auto refresh

Logging

RU/EN language switcher

Map switcher

All CSS styles

Specialized in each map:

Value of window.CrucixMap.mapType

List of coreIds in js/layers-[mapType].js

Additional hooks in js/[mapType]-map.js

Specialized CSS in css/[mapType].css

Additional HTML elements if needed

10. List of Inheriting Maps
Event Map — /home/ta8_/Рабочий стол/Crucix/dashboard/public/event-map/ — mapType 'events'

Metrics Map — /home/ta8_/Рабочий стол/Crucix/dashboard/public/metrics-map/ — mapType 'metrics'

Semantic Map — /home/ta8_/Рабочий стол/Crucix/dashboard/public/semantic-map/ — mapType 'meanings'

Network Map — /home/ta8_/Рабочий стол/Crucix/dashboard/public/network-map/ — mapType 'relations', no Leaflet

Forecast Map — /home/ta8_/Рабочий стол/Crucix/dashboard/public/forecast-map/ — mapType 'forecasts'

Each map contains:

index.html — sets window.CrucixMap.mapType, loads scripts

js/layers-[mapType].js — sets window.CrucixMap.mapConfig and coreIds array

js/[mapType]-map.js — specific hooks

css/[mapType].css — specific styles

11. Key Functions
window.getLayersForMap(mapType) — returns an array of layers for the given map type. Filtering rules:

events — vizType='marker' plus EVENT_CATEGORIES, about 103 layers

metrics — vizType='choropleth', about 46 layers

meanings — SEMANTIC_IDS plus category='ai', about 10 layers

relations — NETWORK_IDS, about 3 layers

forecasts — FORECAST_IDS plus category='threats', about 12 layers

window.renderLayerPanel(layers) — renders the layer panel. Groups by category, sorts categories by count, creates layer buttons.

window.loadLayer(layerId) — toggle logic. If the layer is active, disables it and removes it from the map. If inactive, enables it. Loads data via fetch('/api/layers/${layerId}') in GeoJSON format and adds it via L.geoJSON.

window.generateAllMarkers() — override, uses window.CrucixMap.generateOnly to limit to visible layers only.

window.applyChoropleth(data) — fills countries by metric values.

window.calculateSSI() — computes the Strategic Stress Index.

window.updateLegend() — updates the legend, including active layers.

12. How to Add a New Map
Step 1. Create a new map directory at /home/ta8_/Рабочий стол/Crucix/dashboard/public/{new-map}/.

Step 2. Create index.html based on an existing map template. Change title, set window.CrucixMap = { mapType: '{new-type}' }, change the active button in map-switcher.

Step 3. Create js/layers-{new-type}.js with window.CrucixMap.mapConfig and coreIds list.

Step 4. Create js/{new-map}.js with specific hooks.

Step 5. Create css/{new-map}.css with specific styles.

Step 6. In js/layers.js of Base Map, add a filtering rule for the new mapType in the getLayersForMap function.

Step 7. In the HTML of all 5 existing maps, add a link to the new map in map-switcher.

Step 8. Register the new map in docs/help/pages.json.

Step 9. Create help files docs/help/ru/README-{NEW-MAP}_ru.md and docs/help/en/README-{NEW-MAP}_en.md.

13. Related Documents
General overview of the 5-map system: docs/help/ru/README-5-MAPS_ru.md and docs/help/en/README-5-MAPS_en.md.

READMEs of specialized maps:

docs/help/en/README-EVENT-MAP_en.md

docs/help/en/README-METRICS-MAP_en.md

docs/help/en/README-SEMANTIC-MAP_en.md

docs/help/en/README-NETWORK-MAP_en.md

docs/help/en/README-FORECAST-MAP_en.md

Russian versions: docs/help/ru/README-*-MAP_ru.md.

General help index: docs/help/INDEX.md.

Page registry: docs/help/pages.json.

Project rules: RULES.txt.
