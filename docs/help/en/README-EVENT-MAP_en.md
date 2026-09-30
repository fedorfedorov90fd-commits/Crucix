README-EVENT-MAP_en.md
File: docs/help/en/README-EVENT-MAP_en.md
Russian: docs/help/ru/README-EVENT-MAP_ru.md
Version: 1.0
Date: September 27, 2026
Status: internal architectural document

Table of Contents
Purpose of Event Map

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

Interaction with Base Map

Related Documents

1. Purpose of Event Map
Event Map is the map of events. It displays point events with coordinates and time. Each event is a separate marker on the map with a popup on click.

Location: /home/ta8_/Рабочий стол/Crucix/dashboard/public/event-map/

2. Role in the 5-Map System
Event Map handles the spatial and temporal dimensions of data. It answers the question where and when an event occurred. It uses only the marker visual channel (circles on the map).

In the Crucix 5-map system, Event Map is one of five specialized maps. It inherits from Base Map via the Template Method pattern.

3. Data Dimensions
Event Map works with the following dimensions:

Spatial — event coordinates, geographic reference.

Temporal — date and time of the event, chronology.

Quantitative as attribute — event value, affects marker color and size.

Semantic as attribute — event name (label), region.

4. Visual Channels
Event Map uses pairwise separable visual channels:

Position — marker coordinates on the map.

Color hue — marker color by value or status.

Marker size — by value: up to radius 18 for critical, up to 12 for normal.

5. Map File Structure
Directory /home/ta8_/Рабочий стол/Crucix/dashboard/public/event-map/ contains:

index.html — 209 lines, mapType='events'

js/layers-events.js — 131 lines

js/event-map.js — 33 lines

css/event-map.css — 21 lines

Total 4 files, 44 KB, 394 lines.

6. Files Description
index.html — HTML page of Event Map. Contains window.CrucixMap = { mapType: 'events', name: 'Event Map', version: '1.0.0' } before loading scripts. Loads styles and scripts of Base Map and its specialized ones. Contains map-switcher buttons with Event Map active. Contains markup elements: header topbar, nav nav-dashboards, layer-panel, map-container, legend, stats, ssi-panel, timeline-panel.

js/layers-events.js — specialized layer file. Sets window.CrucixMap.mapConfig with mapType='events', category list, and vizType='marker'. Contains array window.CrucixMap.eventsCoreIds — the core of event layers. Contains function window.CrucixMap.eventsFilter calling window.getLayersForMap('events') from Base Map.

js/event-map.js — specialized Event Map logic. Sets window.CrucixMap.eventMapHooks with afterInit function. Wraps window.initMap so that after map initialization the number of visible layers is logged to console.

css/event-map.css — specialized Event Map styles. Minimal, because the main visualization uses standard Base Map markers. Contains animation event-marker-pulse and style event-map-legend-accent.

7. mapType Value
Event Map uses window.CrucixMap.mapType = 'events'.

This value is read in js/layers.js of Base Map inside the function getLayersForMap(mapType). It returns an array of layers where vizType === 'marker' and the category is in EVENT_CATEGORIES.

This value is read in js/init.js of Base Map inside the function loadData. Via window.getLayersForMap(mapType) a filtered list of layers is obtained, which is then rendered in the layer panel.

This value highlights the active button in the map-switcher in HTML.

8. Layer List
Event Map receives about 103 layers from the common registry of 195 Base Map layers.

Core event layers in js/layers-events.js:

Military — military, conflict-zones, exercises, military-bases, military-exercises, notam, nuclear-monitor, gps-jamming.

Geopolitical — geopolitical, acled, gdelt-geo, map-layer-social, map-layer-sanctions.

Cyber — cisa, shodan, github, cve, cyber-attacks, darkweb, ddos, malware, phishing, ransomware, botnets, cisa-cyber, map-layer-cyber.

Space — space, aurora, oneweb, satellites, space-data, space-debris, starlink, spaceports.

Health — health, who-health, covid-health, epidemics.

Energy — energy, energy-grid, pipelines, power-grid, oil-energy, map-layer-energy.

Transport — opensky, aviation, opensky-transport, ships, shipping-lanes, shipping-route, ports, ports-maritime, railways, highways, maritime.

Ecology — usgs, weather, air-quality, climate, earthquakes, fires, firms, floods, forests, noaa, ocean, safecast, thermal, usgs-eco, viirs, agriculture, drought, volcanoes, wildfires.

News — hackernews, mediacloud, reddit, gdelt.

Infrastructure — crucix-power-grid, crucix-pipelines, crucix-datacenters, crucix-undersea-cables, crucix-telecom, crucix-transport-hub, crucix-ports-infra, crucix-airports, crucix-water-systems, crucix-nuclear-facilities.

Intelligence — crucix-radar, crucix-satellite-recon, crucix-sigint, crucix-humint, crucix-osint, crucix-imint, crucix-masint, crucix-geoint, crucix-electronic-warfare, crucix-drone-recon, crucix-communication-intercept.

Military crucix — crucix-units, crucix-equipment, crucix-personnel, crucix-bases, crucix-movements, crucix-supply-lines, crucix-air-defense, crucix-naval, crucix-aviation-mil, crucix-missile, crucix-target-list.

Cyber crucix — crucix-cyber-nodes, crucix-cyber-links, crucix-cyber-attacks, crucix-cyber-infrastructure, crucix-cyber-anomalies, crucix-cyber-attribution, crucix-cyber-scan, crucix-cyber-darkweb.

Space crucix — crucix-satellites, crucix-orbits, crucix-space-debris, crucix-space-launch, crucix-gps-jamming, crucix-space-weather.

Social crucix — crucix-social-unrest, crucix-border-crossings, crucix-media-narrative, crucix-earthquakes, crucix-fires, crucix-floods, crucix-anomalies-geo, crucix-weather.

9. Layer Categories
Categories that fall into Event Map (EVENT_CATEGORIES in js/layers.js of Base Map):

military

geopolitical

cyber

space

health

energy

transport

ecological

news

infrastructure

intelligence

threats

social

Layers with these categories and vizType='marker' fall into Event Map.

10. Data Flow on Load
Step 1. User opens event-map/index.html.

Step 2. HTML executes: <script>window.CrucixMap = { mapType: 'events', name: 'Event Map', version: '1.0.0' }</script>.

Step 3. ../base-map/js/core.js loads — global variables, LANG_DATA, setLanguage, showNotification, openHelp.

Step 4. ../base-map/js/countries.js loads — 175 countries.

Step 5. ../base-map/js/layers.js loads — 195 layers in window.allLayers, getLayersForMap definition, IIFE applies filter by window.CrucixMap.mapType and gets 103 layers.

Step 6. js/layers-events.js loads — sets mapConfig with categories and eventsCoreIds.

Step 7. ../base-map/js/layers-dynamic.js loads — adds layers from /api/registry/layers.

Step 8. ../base-map/js/markers.js loads — override generateAllMarkers by window.CrucixMap.generateOnly.

Step 9. ../base-map/js/map-controls.js loads — country boundaries, choropleth, applyChoropleth.

Step 10. ../base-map/js/copy-data.js?v=3 loads — data copy.

Step 11. ../base-map/js/heat-timeline.js loads — heat map and timeline.

Step 12. ../base-map/js/ssi.js loads — SSI and legend.

Step 13. ../base-map/js/refresh.js loads — auto refresh.

Step 14. ../base-map/js/logger.mjs (type=module) loads — logging.

Step 15. ../base-map/js/cii.js loads — CII index.

Step 16. js/event-map.js loads — post-init hook.

Step 17. ../base-map/js/init.js loads — last, launches map via DOMContentLoaded, calls initMap and loadData.

Step 18. In loadData:

getFilteredLayers via getLayersForMap('events') returns 103 layers

renderLayerPanel(103) draws layer panel

window.CrucixMap.generateOnly = list of 103 ids

generateAllMarkers generates markers only for visible layers

updateMarkers draws markers on the map

calculateSSI computes the stress index

loadCountryBoundaries loads country boundaries and labels

Step 19. Map is ready.

11. Layer Filtering
Function getLayersForMap('events') in js/layers.js of Base Map filters window.allLayers by rule:

l.vizType === 'marker' && EVENT_CATEGORIES.includes(l.category)

EVENT_CATEGORIES is defined as an array of 13 categories: military, geopolitical, cyber, space, health, energy, transport, ecological, news, infrastructure, intelligence, threats, social.

If a layer has vizType 'marker' and its category is in this array, the layer falls into Event Map.

Layers with vizType 'choropleth' do not fall into Event Map even if their category is in EVENT_CATEGORIES. They fall into Metrics Map.

12. Interaction with Base Map
Event Map uses the following Base Map components:

../base-map/js/core.js — LANG_DATA, setLanguage, showNotification, openHelp, goToDashboard

../base-map/js/countries.js — ALL_COUNTRIES

../base-map/js/layers.js — allLayers, getLayersForMap, renderLayerPanel, loadLayer, toggleLayerPanel, enableAllLayers, disableAllLayers, filterLayers, toggleCategory, updateActiveCount, updateMapLayers

../base-map/js/layers-dynamic.js — dynamic adapter

../base-map/js/markers.js — generateMarkersForLayer, generateAllMarkers, updateMarkers

../base-map/js/map-controls.js — loadCountryBoundaries, applyChoropleth, COUNTRY_NAME_MAP

../base-map/js/copy-data.js — copyAllData

../base-map/js/heat-timeline.js — toggleHeat, toggleTimeline

../base-map/js/ssi.js — calculateSSI, updateLegend

../base-map/js/refresh.js — startAutoRefresh, stopAutoRefresh

../base-map/js/cii.js — updateCII

../base-map/js/init.js — initMap, loadData

Base Map styles: core.css, header.css, layers-panel.css, map.css, responsive.css.

cii.css is loaded in Event Map HTML for the CII panel.

13. Related Documents
General overview of the 5-map system: docs/help/en/README-5-MAPS_en.md.

Base Map README: docs/help/en/README-BASE-MAP_en.md.

Other map READMEs:

docs/help/en/README-METRICS-MAP_en.md

docs/help/en/README-SEMANTIC-MAP_en.md

docs/help/en/README-NETWORK-MAP_en.md

docs/help/en/README-FORECAST-MAP_en.md

Russian versions: docs/help/ru/README-EVENT-MAP_ru.md.

General help index: docs/help/INDEX.md.

Page registry: docs/help/pages.json.

Project rules: RULES.txt.
