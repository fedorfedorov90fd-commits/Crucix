README-NETWORK-MAP_en.md
File: docs/help/en/README-NETWORK-MAP_en.md
Russian: docs/help/ru/README-NETWORK-MAP_ru.md
Version: 1.0
Date: September 27, 2026
Status: internal architectural document

Table of Contents
Purpose of Network Map

Role in the 5-Map System

Difference from the Other Four Maps

Data Dimensions

Visual Channels

Map File Structure

Files Description

mapType Value

Demo Graph Data

GraphView Module

GraphPanel Module

relations Module

Data Flow on Load

Related Documents

1. Purpose of Network Map
Network Map is the map of connections. It displays a graph of entities: nodes and edges. Nodes are entities (countries, organizations, persons, events, cyber attacks, sanctions). Edges are connections between entities (controls, attacks, attributed to, part of, near). Each connection has a type and weight.

Location: /home/ta8_/Рабочий стол/Crucix/dashboard/public/network-map/

2. Role in the 5-Map System
Network Map handles the relational dimension of data. It answers the question who is connected and how. It uses the visual channel position on the force-directed graph plane and shape for node type.

In the Crucix 5-map system, Network Map is one of five specialized maps.

3. Difference from the Other Four Maps
Network Map is the only map that does not use Leaflet. Instead of a geographic map it uses a Canvas graph with force-directed layout.

In HTML, instead of <div id="map"></div> it uses <canvas id="graph-canvas"></canvas>.

In JavaScript the following are not loaded: ../base-map/js/layers-dynamic.js, ../base-map/js/markers.js, ../base-map/js/map-controls.js, ../base-map/js/copy-data.js, ../base-map/js/heat-timeline.js, ../base-map/js/cii.js, ../base-map/js/init.js.

Instead of init.js, its own js/network-map.js is used, loaded as an ES module.

map.css styles are not used because there is no Leaflet map. core.css, header.css, layers-panel.css, responsive.css and its own network-map.css are used.

4. Data Dimensions
Network Map works with the following dimensions:

Relational — connections between entities, connection types, weights.

Temporal as attribute — timestamps of connections and events.

Semantic as attribute — node type (country, organization, person, vessel, aircraft, event, facility, infrastructure, sanction, crypto_wallet, ip_address, domain, apt, cve, malware).

Quantitative as attribute — node riskScore, node credibility.

5. Visual Channels
Network Map uses pairwise separable visual channels:

Position — node coordinates on the Canvas plane, determined by the force algorithm.

Shape — node shape (circle of a certain radius).

Size — node radius by riskScore (minRadius plus normalized riskScore).

Color — node color by entity type. 15 colors total in DEFAULT_COLORS.node.

Highlight — white outline on hover or selected.

Label — text label when zoom is greater than 1.4 or on hover.

6. Map File Structure
Directory /home/ta8_/Рабочий стол/Crucix/dashboard/public/network-map/ contains:

index.html — 213 lines, mapType='relations'

js/network-map.js — 165 lines

js/layers-relations.js — 44 lines

js/graph-view.js — 414 lines

js/graph-panel.js — 208 lines

js/relations.js — 383 lines

css/network-map.css — 102 lines

Total 7 files, 84 KB, 1529 lines.

7. Files Description
index.html — HTML page of Network Map. Sets window.CrucixMap = { mapType: 'relations', name: 'Network Map', version: '1.0.0' }. Loads Base Map styles: core.css, header.css, layers-panel.css, responsive.css. Loads its own network-map.css. Does not load Leaflet or most Base Map scripts. Loads only core.js, countries.js, layers.js, ssi.js, refresh.js. Loads its own layers-relations.js. Loads network-map.js as an ES module. Contains map-switcher buttons with Network Map active. Contains its own buttons: Rebuild graph, Labels, Center. Contains <canvas id="graph-canvas"> instead of <div id="map">. Contains side panel #side-panel for dossier.

js/layers-relations.js — specialized layer file. Sets window.CrucixMap.mapConfig with mapType='relations', flags isGraph: true and usesCanvas: true. Contains array window.CrucixMap.relationsCoreIds — core connection layers (country-instability, resilience-index, strategic-risk-composite). Contains function window.CrucixMap.relationsFilter.

js/network-map.js — main initialization module. Exports async function initNetworkMap. Inside:

Imports GraphView from './graph-view.js'

Imports GraphPanel from './graph-panel.js'

Imports relationsModule from './relations.js'

Creates a GraphView instance with settings (repulsion 10000, springLength 110, springStrength 0.025, damping 0.85, minRadius 5, maxRadius 20)

Creates a GraphPanel instance with containerId 'side-panel'

Subscribes to node:selected event

Loads data via loadGraphData (first tries API /api/layers/entity-graph/nodes, falls back to DEMO_GRAPH)

Sets data via graphView.setData

Starts animation graphView.start

Hides loading overlay

Exports object window.networkMap with methods refit, reload, rebuildGraph, clearGraph, toggleLabels

js/graph-view.js — class GraphView. Force-directed graph rendering on Canvas. No external dependencies. Own physics engine. Main methods: init, setData, clear, start, stop, highlight, resetView, refit, getStats. Handles mouse events: hover, drag, pan, zoom, dblclick. Contains DEFAULT_COLORS object with colors of 15 node types.

js/graph-panel.js — class GraphPanel. Side dossier panel of the selected node. Works with API /api/layers/entity-graph/node/{id}. Methods: init, show, hide, openNode. Renders dossier with sections: Identification, Assessment, Description, Properties, Connections, Coordinates. Contains Open on map button.

js/relations.js — connections and graph module. Builds connections between objects by geo rules. Main constants: OBJECT_TYPES with 40 object types, LINK_TYPES with 10 connection types. Functions: addNode, addLink, haversine, buildGraphFromLayers, showNodeLinks, loadLayerIntoGraph, rebuildGraph, setupGraphInteractions. Exported to window.relations.

css/network-map.css — specialized Network Map styles. Styles graph-container, graph-canvas, dossier side panel, loading overlay.

8. mapType Value
Network Map uses window.CrucixMap.mapType = 'relations'.

This value is read in js/layers.js of Base Map inside the function getLayersForMap(mapType). It returns an array of layers where id is in NETWORK_IDS.

This value is used in map-switcher to highlight the active button.

The value 'relations' differs from the others: Network Map is the only map whose mapConfig has flags isGraph: true and usesCanvas: true.

9. Demo Graph Data
In js/network-map.js the DEMO_GRAPH object is defined, used as fallback if the API /api/layers/entity-graph/nodes is unavailable.

DEMO_GRAPH.nodes (10 nodes):

usa — United States — type country — riskScore 45

rus — Russia — type country — riskScore 78

chn — China — type country — riskScore 52

eu — EU — type organization — riskScore 38

nato — NATO — type organization — riskScore 42

un — UN — type organization — riskScore 25

sanctions_ofac — OFAC Sanctions — type sanction — riskScore 65

conflict_ua — Conflict in Ukraine — type event — riskScore 88

apt28 — APT28 — type apt — riskScore 82

cve_2024_1234 — CVE-2024-1234 — type cve — riskScore 60

DEMO_GRAPH.edges (12 edges):

usa → nato — type controls — weight 3

usa → eu — type linked_to — weight 2

rus → chn — type linked_to — weight 2

eu → nato — type part_of — weight 3

un → usa — type linked_to — weight 1

un → rus — type linked_to — weight 1

sanctions_ofac → rus — type controls — weight 4

conflict_ua → rus — type attacked_by — weight 5

conflict_ua → nato — type linked_to — weight 3

apt28 → rus — type attributed_to — weight 4

apt28 → usa — type attacked_by — weight 3

cve_2024_1234 → apt28 — type linked_to — weight 2

Demo data allows verifying the graph behavior before the real API is available.

10. GraphView Module
Class GraphView is exported from js/graph-view.js.

Key features:

Force-directed physics (repulsion, spring length, spring strength, damping)

Canvas 2D rendering

Automatic scaling to device pixel ratio

Mouse control: hover, drag nodes, pan, wheel zoom, dblclick for centering

Node labels when zoom is greater than 1.4

Highlight of the selected node with white outline

refit — auto-fit to all nodes

getStats — graph statistics

Export:

export class GraphView

export function getGraphView(options)

export function resetGraphView()

Events:

node:selected — called on node click

node:hovered — called on hover

11. GraphPanel Module
Class GraphPanel is exported from js/graph-panel.js.

Key features:

Side dossier panel of the node

Method openNode loads data via API /api/layers/entity-graph/node/{id}

Renders sections: Identification, Assessment, Description, Properties, Connections, Coordinates

Open on map button

Risk class by riskScore: critical (greater than 75), high (greater than 50), elevated (greater than 25), low

Export:

export class GraphPanel

export function getGraphPanel(options)

export function resetGraphPanel()

12. relations Module
Module js/relations.js builds the connection graph between objects based on geo rules.

Constants:

OBJECT_TYPES — 40 object types with fields type and label

LINK_TYPES — 10 connection types with fields label, color, directed

Functions:

addNode(feature, layerId) — add node to graph

addLink(sourceId, targetId, linkType, props) — add connection

haversine(lat1, lon1, lat2, lon2) — distance between points in kilometers

buildGraphFromLayers() — build graph from active layers by 4 rules:

object near satellite/radar/drone within 500 km — monitored_by

data center/infra near cyber attack within 200 km — attacked_by

base near pipeline/route within 100 km — supplied_by

any different objects within 50 km — near (top 5 closest)

showNodeLinks(nodeId) — draw connection lines on the map and return HTML for popup

loadLayerIntoGraph(layerId) — load layer into graph

rebuildGraph() — rebuild graph from window.activeLayerIds

setupGraphInteractions() — intercept click on object

Export to window.relations.

13. Data Flow on Load
Step 1. User opens network-map/index.html.

Step 2. HTML sets window.CrucixMap = { mapType: 'relations', ... }.

Step 3. ../base-map/js/core.js loads.

Step 4. ../base-map/js/countries.js loads.

Step 5. ../base-map/js/layers.js loads — 195 layers, IIFE applies filter by mapType='relations' and gets about 3 layers (composite).

Step 6. js/layers-relations.js loads — sets mapConfig with isGraph: true, usesCanvas: true, relationsCoreIds.

Step 7. ../base-map/js/ssi.js loads.

Step 8. ../base-map/js/refresh.js loads.

Step 9. HTML executes <script type="module">import { initNetworkMap } from './js/network-map.js'; window.addEventListener('load', () => initNetworkMap());</script>.

Step 10. Inside initNetworkMap:

GraphView is created with containerId 'graph-canvas', await graphView.init() is called

GraphPanel is created with containerId 'side-panel'

Subscription to node:selected event

loadGraphData: tries /api/layers/entity-graph/nodes?limit=200, falls back to DEMO_GRAPH

graphView.setData(data)

graphView.start()

updateStats(nodes, edges)

hide loading overlay

export window.networkMap

Step 11. Map is ready. The user can drag nodes, zoom in and out, click to open dossier.

14. Related Documents
General overview of the 5-map system: docs/help/en/README-5-MAPS_en.md.

Base Map README: docs/help/en/README-BASE-MAP_en.md.

Other map READMEs:

docs/help/en/README-EVENT-MAP_en.md

docs/help/en/README-METRICS-MAP_en.md

docs/help/en/README-SEMANTIC-MAP_en.md

docs/help/en/README-FORECAST-MAP_en.md

Russian versions: docs/help/ru/README-NETWORK-MAP_ru.md.

General help index: docs/help/INDEX.md.

Page registry: docs/help/pages.json.

Project rules: RULES.txt.
