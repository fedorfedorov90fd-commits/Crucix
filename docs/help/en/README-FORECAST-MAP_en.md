README-FORECAST-MAP_en.md
File: docs/help/en/README-FORECAST-MAP_en.md
Russian: docs/help/ru/README-FORECAST-MAP_ru.md
Version: 1.0
Date: September 27, 2026
Status: internal architectural document

Table of Contents
Purpose of Forecast Map

Role in the 5-Map System

Data Dimensions

Visual Channels

Map File Structure

Files Description

mapType Value

Layer List

Probability Levels

Data Flow on Load

Layer Filtering

Forecast Hooks

Interaction with Base Map

Related Documents

1. Purpose of Forecast Map
Forecast Map is the map of forecasts. It displays probabilistic forecasts and scenarios: threats, anomalies, stress index, cyberattack predictions, composite strategic risks. Each forecast event is a marker with color reflecting the probability level.

Location: /home/ta8_/Рабочий стол/Crucix/dashboard/public/forecast-map/

2. Role in the 5-Map System
Forecast Map handles the predictive dimension of data. It answers the question what will happen. It uses the visual channel color divergent by probability level.

In the Crucix 5-map system, Forecast Map is one of five specialized maps. It inherits from Base Map via the Template Method pattern.

3. Data Dimensions
Forecast Map works with the following dimensions:

Predictive — probabilities, scenarios, predictions.

Spatial — coordinates of the forecast event.

Temporal as attribute — forecast date, target horizon.

Quantitative as attribute — probability value from 0 to 100.

4. Visual Channels
Forecast Map uses pairwise separable visual channels:

Position — coordinates of the forecast marker.

Color divergent — marker color by probability level:

critical — up to 100 percent — #ff0040

high — from 60 to 80 — #ff4400

elevated — from 40 to 60 — #ff8800

medium — from 20 to 40 — #ffcc00

low — up to 20 — #22c55e

Marker pulse — animation by probability level via getPulseRadius.

Label in popup — probability, scenario, region, time.

5. Map File Structure
Directory /home/ta8_/Рабочий стол/Crucix/dashboard/public/forecast-map/ contains:

index.html — 179 lines, mapType='forecasts'

js/layers-forecasts.js — 72 lines

js/forecast-map.js — 77 lines

css/forecast-map.css — 76 lines

Total 4 files, 36 KB, 404 lines.

6. Files Description
index.html — HTML page of Forecast Map. Contains window.CrucixMap = { mapType: 'forecasts', name: 'Forecast Map', version: '1.0.0' } before loading scripts. Loads styles and scripts of Base Map and its specialized ones. Contains map-switcher buttons with Forecast Map active. Contains shortened navigation across dashboards Threats, AI, Center. Loads heat-timeline.js because the heat map is important for forecast visualization. Does not load cii.js.

js/layers-forecasts.js — specialized layer file. Sets window.CrucixMap.mapConfig with mapType='forecasts'. Contains array window.CrucixMap.forecastsCoreIds — core forecast layers. Contains object window.CrucixMap.probabilityLevels with 5 probability levels (critical, high, elevated, medium, low). Contains function window.CrucixMap.forecastsFilter calling window.getLayersForMap('forecasts').

js/forecast-map.js — specialized Forecast Map logic. Sets window.CrucixMap.forecastHooks with functions:

getProbabilityLevel(value) — probability level by value

getPulseRadius(value) — marker pulse radius

buildPopup(props) — specialized popup with probability and scenario

Wraps window.initMap for post-init check and optional auto-enable of heat map.

css/forecast-map.css — specialized Forecast Map styles. Contains forecast-pulse animation for marker pulsing by probability, styles of 5 probability levels, probability legend, probability style in popup, radial zone style.

7. mapType Value
Forecast Map uses window.CrucixMap.mapType = 'forecasts'.

This value is read in js/layers.js of Base Map inside the function getLayersForMap(mapType). It returns an array of layers where id is in FORECAST_IDS, or category is 'threats', or id contains 'forecast'.

This value is read in js/init.js of Base Map inside the function loadData. Via window.getLayersForMap(mapType) a filtered list of layers is obtained.

This value highlights the active button in the map-switcher in HTML.

8. Layer List
Forecast Map receives about 12 layers from the common registry of 195 Base Map layers.

Core forecast layers in js/layers-forecasts.js:

Forecast core — predict (attack forecast), anomalies (anomalies), ssi (stress index), intelligence (intelligence as a forecast factor).

Threats — cyber-attacks-threat, ddos-threat, malware-threat, phishing-threat, ransomware-threat, cve-threat, botnets-threat.

Composite — strategic-risk-composite.

9. Probability Levels
Object window.CrucixMap.probabilityLevels describes 5 probability levels:

critical — from 80 to 100 — color #ff0040 — label Critical

high — from 60 to 80 — color #ff4400 — label High

elevated — from 40 to 60 — color #ff8800 — label Elevated

medium — from 20 to 40 — color #ffcc00 — label Medium

low — from 0 to 20 — color #22c55e — label Low

Function getProbabilityLevel(value) returns the level object by value. Function getPulseRadius(value) returns the pulse radius: 40 for critical, 30 for high, 22 for elevated, 15 for medium, 10 for low.

10. Data Flow on Load
Step 1. User opens forecast-map/index.html.

Step 2. HTML executes: <script>window.CrucixMap = { mapType: 'forecasts', name: 'Forecast Map', version: '1.0.0' }</script>.

Step 3. ../base-map/js/core.js loads — global variables.

Step 4. ../base-map/js/countries.js loads — 175 countries.

Step 5. ../base-map/js/layers.js loads — 195 layers, IIFE applies filter by window.CrucixMap.mapType='forecasts' and gets about 12 layers.

Step 6. js/layers-forecasts.js loads — sets mapConfig with forecastsCoreIds and probabilityLevels.

Step 7. ../base-map/js/layers-dynamic.js loads.

Step 8. ../base-map/js/markers.js loads — override generateAllMarkers.

Step 9. ../base-map/js/map-controls.js loads — country boundaries.

Step 10. ../base-map/js/copy-data.js?v=3 loads.

Step 11. ../base-map/js/heat-timeline.js loads — heat map, important for forecast visualization.

Step 12. ../base-map/js/ssi.js loads.

Step 13. ../base-map/js/refresh.js loads.

Step 14. ../base-map/js/logger.mjs (module) loads.

Step 15. js/forecast-map.js loads — sets forecastHooks and wraps initMap.

Step 16. ../base-map/js/init.js loads — launches map.

Step 17. In loadData:

getFilteredLayers via getLayersForMap('forecasts') returns about 12 layers

renderLayerPanel(12) draws layer panel

generateAllMarkers generates markers only for visible layers

updateMarkers draws markers with probability coloring

calculateSSI computes the stress index

loadCountryBoundaries loads country boundaries and labels

Step 18. Map is ready.

11. Layer Filtering
Function getLayersForMap('forecasts') in js/layers.js of Base Map filters window.allLayers by rule:

FORECAST_IDS.includes(l.id) || l.category === 'threats' || (l.id && l.id.includes('forecast'))

FORECAST_IDS is defined as an array of 4 core layers: predict, anomalies, ssi, intelligence.

If a layer id is in FORECAST_IDS, or category is 'threats', or id contains the substring 'forecast', the layer falls into Forecast Map.

Other threats in other maps (for example, cyber-attacks-threat with vizType='marker') also fall into Forecast Map because their category is 'threats'.

12. Forecast Hooks
Function window.CrucixMap.forecastHooks.getProbabilityLevel(value) returns the probability level by numeric value:

Step 1. Iterate over all levels from probabilityLevels.

Step 2. If value is in the range [lvl.min, lvl.max) — return that level with the key.

Step 3. If no level matches — return low.

Function getPulseRadius(value) returns the pulse radius for CSS animation:

greater than or equal to 80 — 40

greater than or equal to 60 — 30

greater than or equal to 40 — 22

greater than or equal to 20 — 15

less than 20 — 10

Function buildPopup(props) forms HTML for the popup with fields:

label — forecast name

value or probability — probability in percent

probability level with color

region — region

timestamp — time

scenario — development scenario

13. Interaction with Base Map
Forecast Map uses the following Base Map components:

../base-map/js/core.js — LANG_DATA, setLanguage, showNotification, openHelp

../base-map/js/countries.js — ALL_COUNTRIES

../base-map/js/layers.js — allLayers, getLayersForMap, renderLayerPanel, loadLayer, toggleLayerPanel

../base-map/js/layers-dynamic.js

../base-map/js/markers.js — generateMarkersForLayer, generateAllMarkers, updateMarkers

../base-map/js/map-controls.js — loadCountryBoundaries

../base-map/js/copy-data.js — copyAllData

../base-map/js/heat-timeline.js — toggleHeat, toggleTimeline

../base-map/js/ssi.js — calculateSSI, updateLegend

../base-map/js/refresh.js

../base-map/js/init.js — initMap, loadData

Base Map styles: core.css, header.css, layers-panel.css, map.css, responsive.css.

Not used: cii.js — because the forecast map focuses on probabilities, not on a country instability index.

14. Related Documents
General overview of the 5-map system: docs/help/en/README-5-MAPS_en.md.

Base Map README: docs/help/en/README-BASE-MAP_en.md.

Other map READMEs:

docs/help/en/README-EVENT-MAP_en.md

docs/help/en/README-METRICS-MAP_en.md

docs/help/en/README-SEMANTIC-MAP_en.md

docs/help/en/README-NETWORK-MAP_en.md

Russian versions: docs/help/ru/README-FORECAST-MAP_ru.md.

General help index: docs/help/INDEX.md.

Page registry: docs/help/pages.json.

Project rules: RULES.txt.

Document prepared as an internal architectural description of Forecast Map of the Crucix project. All map names are functional and do not refer to competitor products.

End of README-FORECAST-MAP_en.md.

All 12 files of READMEs for the 5-map system are complete:

Russian (docs/help/ru/):

README-5-MAPS_ru.md

README-BASE-MAP_ru.md

README-EVENT-MAP_ru.md

README-METRICS-MAP_ru.md

README-SEMANTIC-MAP_ru.md

README-NETWORK-MAP_ru.md

README-FORECAST-MAP_ru.md

English (docs/help/en/):

README-5-MAPS_en.md

README-BASE-MAP_en.md

README-EVENT-MAP_en.md

README-METRICS-MAP_en.md

README-SEMANTIC-MAP_en.md

README-NETWORK-MAP_en.md

README-FORECAST-MAP_en.md
