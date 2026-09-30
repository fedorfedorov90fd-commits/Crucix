README-SEMANTIC-MAP_en.md
File: docs/help/en/README-SEMANTIC-MAP_en.md
Russian: docs/help/ru/README-SEMANTIC-MAP_ru.md
Version: 1.0
Date: September 27, 2026
Status: internal architectural document

Table of Contents
Purpose of Semantic Map

Role in the 5-Map System

Data Dimensions

Visual Channels

Map File Structure

Files Description

mapType Value

Layer List

Semantic Signal Types

Data Flow on Load

Layer Filtering

Sentiment Coloring

Interaction with Base Map

Related Documents

1. Purpose of Semantic Map
Semantic Map is the map of meanings. It displays textual data from news sources and the results of semantic analysis: topics, sentiment, clusters, key entities. Each marker is a separate text source; marker color depends on the sentiment of the text.

Location: /home/ta8_/Рабочий стол/Crucix/dashboard/public/semantic-map/

2. Role in the 5-Map System
Semantic Map handles the semantic dimension of data. It answers the question what is written and how. It uses the visual channel color categorical by text sentiment.

In the Crucix 5-map system, Semantic Map is one of five specialized maps. It inherits from Base Map via the Template Method pattern.

3. Data Dimensions
Semantic Map works with the following dimensions:

Semantic — topics, key entities, text sentiment.

Spatial — coordinates of the news source if provided.

Temporal — publication date.

Quantitative as attribute — sentiment value (number from -1 to 1) or category (positive, negative, neutral, fake).

4. Visual Channels
Semantic Map uses pairwise separable visual channels:

Position — source coordinates on the map.

Color categorical — marker color by sentiment:

positive — green #22c55e

negative — red #ef4444

neutral — yellow #eab308

fake — purple #ff00ff

Label in popup — topics, entities, source, sentiment.

5. Map File Structure
Directory /home/ta8_/Рабочий стол/Crucix/dashboard/public/semantic-map/ contains:

index.html — 170 lines, mapType='meanings'

js/layers-meanings.js — 56 lines

js/semantic-map.js — 70 lines

css/semantic-map.css — 42 lines

Total 4 files, 36 KB, 338 lines.

6. Files Description
index.html — HTML page of Semantic Map. Contains window.CrucixMap = { mapType: 'meanings', name: 'Semantic Map', version: '1.0.0' } before loading scripts. Loads styles and scripts of Base Map and its specialized ones. Contains map-switcher buttons with Semantic Map active. Contains shortened navigation only by news dashboards.

js/layers-meanings.js — specialized layer file. Sets window.CrucixMap.mapConfig with mapType='meanings'. Contains array window.CrucixMap.meaningsCoreIds — core semantic layers (textual news and AI). Contains object window.CrucixMap.semanticTypes with semantic signal types (topic, sentiment, entity, narrative, fake). Contains function window.CrucixMap.meaningsFilter calling window.getLayersForMap('meanings').

js/semantic-map.js — specialized Semantic Map logic. Sets window.CrucixMap.semanticHooks with functions:

getSentimentColor — marker color by sentiment value

buildPopup — specialized popup with topics, entities, source, sentiment

Wraps window.initMap for post-init logging of visible layer count.

css/semantic-map.css — specialized Semantic Map styles. Contains marker styles by sentiment (semantic-marker-positive, semantic-marker-negative, semantic-marker-neutral, semantic-marker-fake), topic legend, text style in popup.

7. mapType Value
Semantic Map uses window.CrucixMap.mapType = 'meanings'.

This value is read in js/layers.js of Base Map inside the function getLayersForMap(mapType). It returns an array of layers where id is in SEMANTIC_IDS or category is ai.

This value is read in js/init.js of Base Map inside the function loadData. Via window.getLayersForMap(mapType) a filtered list of layers is obtained.

This value highlights the active button in the map-switcher in HTML.

8. Layer List
Semantic Map receives about 10 layers from the common registry of 195 Base Map layers.

Core semantic layers in js/layers-meanings.js:

Textual news — bbc, rss, tass, ria, interfax, gdelt-news, hackernews, mediacloud, reddit.

AI — intelligence.

All these layers provide textual data that can be analyzed via NLP: sentiment, topics, clusters, key entities.

9. Semantic Signal Types
Object window.CrucixMap.semanticTypes describes possible semantic signals:

topic — topic — color #5bc0f8

sentiment — sentiment — color #f59e0b

entity — entity — color #aa44ff

narrative — narrative — color #22c55e

fake — fake — color #ef4444

These types are used in future Semantic Map extensions for advanced NLP analysis.

10. Data Flow on Load
Step 1. User opens semantic-map/index.html.

Step 2. HTML executes: <script>window.CrucixMap = { mapType: 'meanings', name: 'Semantic Map', version: '1.0.0' }</script>.

Step 3. ../base-map/js/core.js loads — global variables.

Step 4. ../base-map/js/countries.js loads — 175 countries.

Step 5. ../base-map/js/layers.js loads — 195 layers, IIFE applies filter and gets about 10 semantic layers.

Step 6. js/layers-meanings.js loads — sets mapConfig with meaningsCoreIds and semanticTypes.

Step 7. ../base-map/js/layers-dynamic.js loads.

Step 8. ../base-map/js/markers.js loads — override generateAllMarkers.

Step 9. ../base-map/js/map-controls.js loads.

Step 10. ../base-map/js/copy-data.js?v=3 loads.

Step 11. ../base-map/js/ssi.js loads.

Step 12. ../base-map/js/refresh.js loads.

Step 13. ../base-map/js/logger.mjs (module) loads.

Step 14. js/semantic-map.js loads — sets semanticHooks.

Step 15. ../base-map/js/init.js loads — launches map.

Step 16. In loadData:

getFilteredLayers returns about 10 semantic layers

renderLayerPanel(10) draws layer panel

generateAllMarkers generates markers for visible layers

updateMarkers draws markers with sentiment coloring

loadCountryBoundaries loads country boundaries and labels

Step 17. Map is ready.

11. Layer Filtering
Function getLayersForMap('meanings') in js/layers.js of Base Map filters window.allLayers by rule:

SEMANTIC_IDS.includes(l.id) || l.category === 'ai'

SEMANTIC_IDS is defined as an array of 9 news sources: bbc, rss, tass, ria, interfax, gdelt-news, hackernews, mediacloud, reddit.

If a layer id is in SEMANTIC_IDS or category='ai', the layer falls into Semantic Map.

Other news layers (for example, google-trends with vizType='choropleth') do not fall into Semantic Map.

12. Sentiment Coloring
Function window.CrucixMap.semanticHooks.getSentimentColor(sentiment) determines marker color:

If sentiment is a number:

greater than 0.3 — green #22c55e (positive)

less than -0.3 — red #ef4444 (negative)

in the range -0.3 to 0.3 — yellow #eab308 (neutral)

If sentiment is a string, a dictionary object is used:

positive — green

negative — red

neutral — yellow

fake — purple

The function is used when rendering markers to visualize text sentiment.

13. Interaction with Base Map
Semantic Map uses the following Base Map components:

../base-map/js/core.js — LANG_DATA, setLanguage, showNotification, openHelp

../base-map/js/countries.js — ALL_COUNTRIES

../base-map/js/layers.js — allLayers, getLayersForMap, renderLayerPanel, loadLayer, toggleLayerPanel

../base-map/js/layers-dynamic.js

../base-map/js/markers.js — generateMarkersForLayer, generateAllMarkers, updateMarkers

../base-map/js/map-controls.js — loadCountryBoundaries

../base-map/js/copy-data.js — copyAllData

../base-map/js/ssi.js — calculateSSI, updateLegend

../base-map/js/refresh.js

../base-map/js/init.js — initMap, loadData

Base Map styles: core.css, header.css, layers-panel.css, map.css, responsive.css.

Not used: heat-timeline.js, cii.js — because Semantic Map does not use heat map or CII index.

14. Related Documents
General overview of the 5-map system: docs/help/en/README-5-MAPS_en.md.

Base Map README: docs/help/en/README-BASE-MAP_en.md.

Other map READMEs:

docs/help/en/README-EVENT-MAP_en.md

docs/help/en/README-METRICS-MAP_en.md

docs/help/en/README-NETWORK-MAP_en.md

docs/help/en/README-FORECAST-MAP_en.md

Russian versions: docs/help/ru/README-SEMANTIC-MAP_ru.md.

General help index: docs/help/INDEX.md.

Page registry: docs/help/pages.json.

Project rules: RULES.txt.
