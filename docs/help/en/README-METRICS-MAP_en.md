README-METRICS-MAP_en.md
File: docs/help/en/README-METRICS-MAP_en.md
Russian: docs/help/ru/README-METRICS-MAP_ru.md
Version: 1.0
Date: September 27, 2026
Status: internal architectural document

Table of Contents
Purpose of Metrics Map

Role in the 5-Map System

Data Dimensions

Visual Channels

Map File Structure

Files Description

mapType Value

Layer List

Layer Categories

Data Flow on Load

Layer Filtering

applyChoropleth Function

Interaction with Base Map

Related Documents

1. Purpose of Metrics Map
Metrics Map is the map of metrics. It displays quantitative country-level slices via polygon fill (choropleth). Metric values are bound to countries and regions; the fill color depends on the value.

Location: /home/ta8_/Рабочий стол/Crucix/dashboard/public/metrics-map/

2. Role in the 5-Map System
Metrics Map handles the quantitative dimension of data. It answers the question how much. It uses the visual channels position and size or color intensity for choropleth.

In the Crucix 5-map system, Metrics Map is one of five specialized maps. It inherits from Base Map via the Template Method pattern.

3. Data Dimensions
Metrics Map works with the following dimensions:

Quantitative — metric values (inflation, GDP, unemployment, ESG indices, demographics).

Spatial — binding metrics to countries via country name.

Temporal as attribute — metric period.

4. Visual Channels
Metrics Map uses pairwise separable visual channels:

Position — geographic position of the country on the map.

Color intensity — fill saturation by metric value. Formula: normalized = (value - min) / (max - min). Color is interpolated between green (low) and red (high).

Fill channel (choropleth) — the main channel in Metrics Map.

5. Map File Structure
Directory /home/ta8_/Рабочий стол/Crucix/dashboard/public/metrics-map/ contains:

index.html — 179 lines, mapType='metrics'

js/layers-metrics.js — 85 lines

js/metrics-map.js — 69 lines

css/metrics-map.css — 39 lines

Total 4 files, 36 KB, 372 lines.

6. Files Description
index.html — HTML page of Metrics Map. Contains window.CrucixMap = { mapType: 'metrics', name: 'Metrics Map', version: '1.0.0' } before loading scripts. Loads styles and scripts of Base Map and its specialized ones. Contains map-switcher buttons with Metrics Map active. Does not load heat-timeline.js and cii.js, because for metrics choropleth is more important than heat map or CII.

js/layers-metrics.js — specialized layer file. Sets window.CrucixMap.mapConfig with mapType='metrics', vizType='choropleth'. Contains array window.CrucixMap.metricsCoreIds — core metric layers. Contains function window.CrucixMap.metricsFilter calling window.getLayersForMap('metrics') from Base Map.

js/metrics-map.js — specialized Metrics Map logic. Sets window.CrucixMap.metricsHooks with afterLayerLoad function. Wraps window.loadLayer so that after loading a layer with vizType='choropleth' it calls window.applyChoropleth from map-controls.js of Base Map. Wraps window.initMap so that after initialization it automatically loads the first choropleth layer.

css/metrics-map.css — specialized Metrics Map styles. Smooth fill for choropleth (transition fill 0.5s), vertical metrics-scale, style for metric value in popup.

7. mapType Value
Metrics Map uses window.CrucixMap.mapType = 'metrics'.

This value is read in js/layers.js of Base Map inside the function getLayersForMap(mapType). It returns an array of layers where vizType === 'choropleth'.

This value is read in js/init.js of Base Map inside the function loadData. Via window.getLayersForMap(mapType) a filtered list of layers is obtained.

This value highlights the active button in the map-switcher in HTML.

8. Layer List
Metrics Map receives about 46 layers from the common registry of 195 Base Map layers. All layers with vizType='choropleth'.

Core metric layers in js/layers-metrics.js:

Economy — inflation, unemployment, gdp, pmi, recession, trade-balance, fred, bls, comtrade, debt-gdp, consumer-confidence.

Finance choropleth — dxy, tips, hy-spread, copper-gold, gold-oil, gold-silver, yield-curve, big-mac, big-mac-alt, big-mac-main, uranium.

ESG — esg, happiness, happiness-alt, population, refugees, urbanization, who, covid, healthcare, education, freedom, hdi, inequality, poverty, press-freedom.

Geopolitical choropleth — social-unrest, corruption, democracy, country-instability, resilience-index.

Threats choropleth — cve-threat.

Health choropleth — who-health, covid-health, healthcare-health.

Energy choropleth — eia, nuclear, renewable, oil-gas.

Cyber choropleth — cve-cyber.

Military choropleth — military-spending, war-preparation.

Other choropleth — internet, mobile.

News choropleth — google-trends.

Crucix choropleth — crucix-pattern-life, crucix-banking, crucix-population-flow, crucix-refugees, crucix-phone-activity.

Composite — strategic-risk-composite.

9. Layer Categories
Metrics Map includes layers of all categories where vizType='choropleth':

economics

finance

esg

geopolitical

threats

health

energy

cyber

military

other

news

intelligence

social

The main condition is vizType='choropleth'. Category is secondary.

10. Data Flow on Load
Step 1. User opens metrics-map/index.html.

Step 2. HTML executes: <script>window.CrucixMap = { mapType: 'metrics', name: 'Metrics Map', version: '1.0.0' }</script>.

Step 3. ../base-map/js/core.js loads — global variables.

Step 4. ../base-map/js/countries.js loads — 175 countries.

Step 5. ../base-map/js/layers.js loads — 195 layers, IIFE applies filter by window.CrucixMap.mapType and gets 46 choropleth layers.

Step 6. js/layers-metrics.js loads — sets mapConfig with vizType='choropleth' and metricsCoreIds.

Step 7. ../base-map/js/layers-dynamic.js loads — adds layers from API.

Step 8. ../base-map/js/markers.js loads — override generateAllMarkers.

Step 9. ../base-map/js/map-controls.js loads — country boundaries, applyChoropleth.

Step 10. ../base-map/js/copy-data.js?v=3 loads.

Step 11. ../base-map/js/ssi.js loads — SSI and legend.

Step 12. ../base-map/js/refresh.js loads.

Step 13. ../base-map/js/logger.mjs (module) loads.

Step 14. js/metrics-map.js loads — override loadLayer for applyChoropleth.

Step 15. ../base-map/js/init.js loads — launches map.

Step 16. In loadData:

getFilteredLayers via getLayersForMap('metrics') returns 46 layers

renderLayerPanel(46) draws layer panel

generateAllMarkers generates markers (usually no markers for choropleth layers)

loadCountryBoundaries loads country boundaries and labels

applyChoropleth is called on layer click or automatically on switch

Step 17. Map is ready.

11. Layer Filtering
Function getLayersForMap('metrics') in js/layers.js of Base Map filters window.allLayers by rule:

l.vizType === 'choropleth'

If a layer has vizType='choropleth', the layer falls into Metrics Map. Category is unimportant, so layers of all categories with fill-based primary display fall into Metrics Map.

Layers with vizType='marker' do not fall into Metrics Map even if their category is economics or finance. They fall into Event Map.

12. applyChoropleth Function
Function window.applyChoropleth(data) is defined in ../base-map/js/map-controls.js of Base Map.

Input data: FeatureCollection object or array of features, where each record contains a country name and a metric value.

Fill logic:

Step 1. For each country in the GeoJSON boundary layer, the matching record is found by name.

Step 2. The minimum and maximum values across all countries are computed.

Step 3. Value normalization: normalized = (value - min) / (max - min).

Step 4. Color interpolation:

r = 34 + (255 - 34) * normalized

g = 205 - 180 * normalized

b = 80 - 70 * normalized

Step 5. Style application: fillColor = rgb(r, g, b), fillOpacity = 0.75, color = '#ffffff', weight = 1.2.

Countries without data receive gray color '#3a3a4a' with fillOpacity = 0.4.

After application, window.updateLegend() is called to update the legend.

13. Interaction with Base Map
Metrics Map uses the following Base Map components:

../base-map/js/core.js — LANG_DATA, setLanguage, showNotification, openHelp

../base-map/js/countries.js — ALL_COUNTRIES

../base-map/js/layers.js — allLayers, getLayersForMap, renderLayerPanel, loadLayer, toggleLayerPanel, enableAllLayers, disableAllLayers, filterLayers, toggleCategory, updateActiveCount

../base-map/js/layers-dynamic.js — dynamic adapter

../base-map/js/markers.js — generateMarkersForLayer, generateAllMarkers, updateMarkers

../base-map/js/map-controls.js — loadCountryBoundaries, applyChoropleth, resetChoropleth, COUNTRY_NAME_MAP

../base-map/js/copy-data.js — copyAllData

../base-map/js/ssi.js — calculateSSI, updateLegend

../base-map/js/refresh.js — startAutoRefresh, stopAutoRefresh

../base-map/js/init.js — initMap, loadData

Base Map styles: core.css, header.css, layers-panel.css, map.css, responsive.css.

Not used in Metrics Map: heat-timeline.js (no heat map), cii.js (no CII panel).

14. Related Documents
General overview of the 5-map system: docs/help/en/README-5-MAPS_en.md.

Base Map README: docs/help/en/README-BASE-MAP_en.md.

Other map READMEs:

docs/help/en/README-EVENT-MAP_en.md

docs/help/en/README-SEMANTIC-MAP_en.md

docs/help/en/README-NETWORK-MAP_en.md

docs/help/en/README-FORECAST-MAP_en.md

Russian versions: docs/help/ru/README-METRICS-MAP_ru.md.

General help index: docs/help/INDEX.md.

Page registry: docs/help/pages.json.

Project rules: RULES.txt.
