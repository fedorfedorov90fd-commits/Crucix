================================================================================
GEO-MAP — CRUCIX GEOPOLITICAL MAP STRUCTURE
================================================================================
Version: 1.0
Date: 2026-08-26
================================================================================

1. OVERVIEW
================================================================================
The geo-map.html file is split into logical blocks for easy editing.
Each block is located in a separate folder and handles its own functionality.

2. FOLDER STRUCTURE
================================================================================
dashboard/public/geo-map/
├── css/
│   └── geo-map.css          # All styles for the map
├── js/
│   ├── geo-map-core.js      # Map core (Leaflet initialization)
│   ├── country-boundaries.js # Country borders and colors
│   └── markers.js           # Event markers on the map
├── blocks/
│   ├── topbar.js            # Block 1: Buttons (home, copy, registry, help, ru/en)
│   ├── dashboards-nav.js    # Block 2: 17 dashboards
│   └── layer-panel.js       # Block 3: 121 layers
├── templates/               # Templates for future elements
├── README.ru.txt            # Structure description (Russian)
└── README.en.txt            # Structure description (English)

3. BLOCK DESCRIPTIONS
================================================================================

3.1. geo-map-core.js (Map Core)
- Leaflet map initialization
- Global data storage (countries, markers, layers)
- Export functions for data access

3.2. country-boundaries.js (Borders and Colors)
- Loading GeoJSON country borders
- Coloring countries by status (critical, pre-war, high, medium, low, inactive)
- Adding country labels on the map
- Color scheme:
  🔴 critical  — #ef4444 (Critical)
  🟠 pre-war   — #f97316 (Pre-war)
  🟠 high      — #f59e0b (High)
  🟡 medium    — #eab308 (Medium)
  🟢 low       — #22c55e (Normal)
  ⚪ inactive  — #3a3a4a (No data)

3.3. markers.js (Markers)
- Displaying event markers on the map
- Heat map (on/off)
- Event timeline
- Marker counter

3.4. topbar.js (Block 1)
- ← HOME button — navigate to /jarvis
- 📋 COPY button — copy full map snapshot
- 📡 Registry button — navigate to /registry
- ❓ HELP button — show help
- 🌡️ Heat button — toggle heat map
- 📅 Timeline button — toggle timeline
- 📄 PDF button — export map to PDF
- RU/EN switch — change interface language

3.5. dashboards-nav.js (Block 2)
- 17 buttons for dashboard navigation:
  Analytics Center, Economy, Finance, Military, Geopolitics,
  Ecology, Cyber, Space, News, AI, Science, ESG, Threats,
  Health, Energy, Transport, Regions

3.6. layer-panel.js (Block 3)
- Right-side layer panel (like Crucix)
- 121 layers grouped by categories
- Layer search
- Active layer highlight
- State saved in localStorage

4. HOW TO EDIT
================================================================================
1. Styles → geo-map/css/geo-map.css
2. Map logic → geo-map/js/geo-map-core.js
3. Country colors → geo-map/js/country-boundaries.js
4. Markers → geo-map/js/markers.js
5. Buttons → geo-map/blocks/topbar.js
6. Dashboards → geo-map/blocks/dashboards-nav.js
7. Layers → geo-map/blocks/layer-panel.js

5. HOW IT WORKS
================================================================================
1. geo-map.html loads CSS and imports JS modules
2. geo-map-core.js initializes the map
3. Data is loaded from APIs (/api/geo/markers, /api/geo/status, /api/layers)
4. country-boundaries.js colors the countries
5. markers.js displays markers
6. layer-panel.js creates the layer panel

6. KEY FUNCTIONS
================================================================================
- initMap() — creates the map
- loadCountryBoundaries() — loads borders and colors countries
- loadMarkers() — loads markers
- loadLayer(layerId) — loads a specific layer
- copyAllData() — copies full snapshot
- toggleHeat() — heat map toggle
- toggleTimeline() — timeline toggle
- calculateSSI() — calculates stress index

7. NOTES
================================================================================
- All blocks are independent — changing one doesn't break others
- When adding a new layer, update layer-manager.mjs on the server
- Country colors are managed via STATUS_COLORS in country-boundaries.js
- Active layer is saved in localStorage

================================================================================
END OF FILE
================================================================================
