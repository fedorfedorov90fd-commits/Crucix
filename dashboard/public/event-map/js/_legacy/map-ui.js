// ═══════════════════════════════════════════════════════════════
//  CRUCIX MAP UI v2.0.0
//  Универсальный рендерер для одной карты.
//  Два режима: 'geo' (MapLibre GL) и 'graph' (GraphView на canvas).
//  Пользователь сам выбирает режим. Каждая карта независима.
//  Применение темы, слоёв, камеры — всё через публичные методы.
// ═══════════════════════════════════════════════════════════════

import { GraphView } from './graph-view.js';

const THEMES = {
  default: {
    name: 'default',
    bg: '#0f0f1a', surface: '#1a1a2e', accent: '#e94560',
    text: '#eee', textDim: '#888', layerOpacity: 0.75,
  },
  dark: {
    name: 'dark',
    bg: '#050708', surface: '#0a0e10', accent: '#00ff88',
    text: '#c8ffd4', textDim: '#1a5c3a', layerOpacity: 0.65,
  },
  light: {
    name: 'light',
    bg: '#f5f5f7', surface: '#ffffff', accent: '#1a1a2e',
    text: '#1a1a1a', textDim: '#666', layerOpacity: 0.85,
  },
};

export class MapUI {
  constructor(options = {}) {
    this.containerId = options.containerId || 'map';
    this.viewMode = options.viewMode || 'geo'; // 'geo' | 'graph'
    this.theme = { ...THEMES.default };
    this.camera = { center: [0, 20], zoom: 1.5, pitch: 0, bearing: 0 };
    this.map = null;
    this.graphView = null;
    this.activeLayers = new Map();
    this.ready = false;
    this._initPromise = null;
  }

  async init() {
    if (this.ready) return true;
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._initInternal();
    return this._initPromise;
  }

  async _initInternal() {
    if (this.viewMode === 'graph') {
      return await this._initGraphView();
    }
    return await this._initGeoMap();
  }

  async _initGeoMap() {
    if (typeof maplibregl === 'undefined') {
      console.warn('[MapUI] maplibre-gl не подключён, переключаюсь на graph');
      this.viewMode = 'graph';
      return await this._initGraphView();
    }
    const container = document.getElementById(this.containerId);
    if (!container) return false;

    this.map = new maplibregl.Map({
      container: this.containerId,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap',
          },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': this.theme.bg } },
          { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.35 } },
        ],
      },
      center: this.camera.center,
      zoom: this.camera.zoom,
      pitch: this.camera.pitch,
      bearing: this.camera.bearing,
      attributionControl: false,
    });
    this.ready = true;
    return true;
  }

  async _initGraphView() {
    this.graphView = new GraphView({
      containerId: this.containerId,
      colors: {
        bg: this.theme.bg,
        text: this.theme.text,
        textDim: this.theme.textDim,
      },
    });
    const ok = await this.graphView.init();
    if (!ok) return false;
    this.graphView.start();
    this.ready = true;
    return true;
  }

  // ── Тема ──────────────────────────────────────────────────
  applyTheme(theme) {
    if (typeof theme === 'string') {
      const t = THEMES[theme];
      if (!t) return false;
      this.theme = { ...t };
    } else if (typeof theme === 'object') {
      this.theme = { ...this.theme, ...theme };
    } else {
      return false;
    }
    // Применяем к geo
    if (this.viewMode === 'geo' && this.map) {
      try {
        if (this.map.getLayer('bg')) this.map.setPaintProperty('bg', 'background-color', this.theme.bg);
      } catch {}
    }
    // Применяем к графу
    if (this.viewMode === 'graph' && this.graphView) {
      this.graphView.colors.bg = this.theme.bg;
      this.graphView.colors.text = this.theme.text;
      this.graphView.colors.textDim = this.theme.textDim;
    }
    return true;
  }

  // ── Слои (только для geo) ─────────────────────────────────
  addLayer(id, { data, vizType = 'marker', paint = {} } = {}) {
    if (this.viewMode !== 'geo' || !this.map || !data) return false;
    const sourceId = `src-${id}`;
    try {
      if (this.map.getSource(sourceId)) {
        this.map.getSource(sourceId).setData(data);
        return true;
      }
      this.map.addSource(sourceId, { type: 'geojson', data });
      const layerIds = [];
      if (vizType === 'choropleth') {
        this.map.addLayer({ id: `fill-${id}`, type: 'fill', source: sourceId, paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.6, ...paint } });
        this.map.addLayer({ id: `outline-${id}`, type: 'line', source: sourceId, paint: { 'line-color': '#ffffff', 'line-width': 0.5 } });
        layerIds.push(`fill-${id}`, `outline-${id}`);
      } else if (vizType === 'heatmap') {
        this.map.addLayer({ id: `heat-${id}`, type: 'heatmap', source: sourceId, paint: { 'heatmap-weight': 1, 'heatmap-intensity': 0.8, ...paint } });
        layerIds.push(`heat-${id}`);
      } else if (vizType === 'line') {
        this.map.addLayer({ id: `line-${id}`, type: 'line', source: sourceId, paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, ...paint } });
        layerIds.push(`line-${id}`);
      } else {
        this.map.addLayer({ id: `circle-${id}`, type: 'circle', source: sourceId, paint: { 'circle-radius': 4, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 0.5, ...paint } });
        layerIds.push(`circle-${id}`);
      }
      this.activeLayers.set(id, { sourceId, layerIds, vizType });
      return true;
    } catch (e) {
      console.warn(`[MapUI] Ошибка addLayer ${id}:`, e.message);
      return false;
    }
  }

  removeLayer(id) {
    if (this.viewMode !== 'geo' || !this.map) return false;
    const entry = this.activeLayers.get(id);
    if (!entry) return false;
    for (const lid of entry.layerIds) {
      try { if (this.map.getLayer(lid)) this.map.removeLayer(lid); } catch {}
    }
    try { if (this.map.getSource(entry.sourceId)) this.map.removeSource(entry.sourceId); } catch {}
    this.activeLayers.delete(id);
    return true;
  }

  clearLayers() {
    for (const id of [...this.activeLayers.keys()]) this.removeLayer(id);
  }

  // ── Граф (только для graph) ──────────────────────────────
  setGraphData(data) {
    if (this.viewMode !== 'graph' || !this.graphView) return null;
    return this.graphView.setData(data);
  }

  highlightGraphNode(nodeId) {
    if (this.viewMode !== 'graph' || !this.graphView) return false;
    this.graphView.highlight(nodeId);
    return true;
  }

  // ── Камера ────────────────────────────────────────────────
  flyTo({ center, zoom, pitch = 0, bearing = 0 }) {
    this.camera = { center, zoom, pitch, bearing };
    if (this.viewMode === 'geo' && this.map) {
      this.map.flyTo({ center, zoom, pitch, bearing });
    }
    if (this.viewMode === 'graph' && this.graphView) {
      this.graphView.resetView();
    }
  }

  // ── Состояние ────────────────────────────────────────────
  getState() {
    if (this.viewMode === 'geo' && this.map) {
      const c = this.map.getCenter();
      return {
        viewMode: 'geo',
        center: [c.lng, c.lat],
        zoom: this.map.getZoom(),
        pitch: this.map.getPitch(),
        bearing: this.map.getBearing(),
        theme: this.theme.name || 'custom',
        activeLayers: [...this.activeLayers.keys()],
      };
    }
    if (this.viewMode === 'graph' && this.graphView) {
      const stats = this.graphView.getStats();
      return {
        viewMode: 'graph',
        center: [0, 0],
        zoom: stats.zoom,
        pitch: 0,
        bearing: 0,
        theme: this.theme.name || 'custom',
        activeLayers: [],
        graphNodes: stats.nodes,
        graphEdges: stats.edges,
      };
    }
    return {
      viewMode: this.viewMode,
      center: [0, 0],
      zoom: 1,
      pitch: 0,
      bearing: 0,
      theme: this.theme.name,
      activeLayers: [],
    };
  }

  getStats() {
    return {
      ready: this.ready,
      viewMode: this.viewMode,
      theme: this.theme.name,
      activeLayers: this.activeLayers.size,
      themes: Object.keys(THEMES).length,
    };
  }

  // ── Переключение режима (пересоздаёт) ───────────────────
  async switchMode(newMode) {
    if (newMode === this.viewMode) return true;
    this.destroy();
    this.viewMode = newMode;
    this.ready = false;
    this._initPromise = null;
    return await this.init();
  }

  destroy() {
    if (this.map) {
      try { this.map.remove(); } catch {}
      this.map = null;
    }
    if (this.graphView) {
      try { this.graphView.stop(); } catch {}
      const c = document.getElementById(this.containerId);
      if (c) c.innerHTML = '';
      this.graphView = null;
    }
    this.activeLayers.clear();
    this.ready = false;
  }
}

let _instance = null;
export function getMapUI(options) {
  if (!_instance) _instance = new MapUI(options);
  return _instance;
}
export function resetMapUI() { _instance = null; }
