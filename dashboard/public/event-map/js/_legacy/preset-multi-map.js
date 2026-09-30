// ═══════════════════════════════════════════════════════════════
//  CRUCIX MULTI MAP CONTROLLER v2.2.0
//  4 независимые карты. Режимы geo/graph. Панель досье.
//  Никакой синхронизации между картами.
// ═══════════════════════════════════════════════════════════════

import { MapUI } from './map-ui.js';
import { GraphPanel } from './graph-panel.js';

const LAYOUTS = ['grid-2x2', 'row-1x4', 'focus-3', 'tab'];
const PRESET_KEYS = { q: 'global-monitor', w: 'entity-graph', e: 'recon', r: 'custom' };
const DEFAULT_VIEW_MODES = ['geo', 'graph', 'geo', 'geo'];

export class MultiMapController {
  constructor(options = {}) {
    this.options = options;
    this.maps = [];
    this.activeMap = 0;
    this.layout = 'grid-2x2';
    this.apiBase = options.apiBase || '/api/layers/preset';
    this.graphApiBase = options.graphApiBase || '/api/layers/entity-graph';
    this.panel = null;
    this._initialized = false;
  }

  async init() {
    if (this._initialized) return;
    this.initGrid();
    this.initPanel();
    await this.initMaps();
    this.initHotkeys();
    this.initUI();
    this.applyLayout();
    this._initialized = true;
  }

  initGrid() {
    const grid = document.getElementById(this.options.mapGridId || 'map-grid');
    if (!grid) return;
    grid.style.display = 'grid';
    grid.style.gap = '2px';
  }

  initPanel() {
    this.panel = new GraphPanel({
      containerId: this.options.sidePanelId || 'side-panel',
      apiBase: this.graphApiBase,
      onOpenOnMap: (lat, lon, nodeId) => {
        // Найти первую geo-карту и перелететь на координаты
        const geoMap = this.maps.find(ui => ui.viewMode === 'geo');
        if (geoMap) geoMap.flyTo({ center: [lon, lat], zoom: 10 });
      },
    });
    this.panel.init();
  }

  async initMaps() {
    for (let i = 0; i < 4; i++) {
      const viewMode = DEFAULT_VIEW_MODES[i] || 'geo';
      const ui = new MapUI({ containerId: `map-${i}`, viewMode });
      const ok = await ui.init();
      if (ok) {
        this.maps.push(ui);
        // Подписка на выбор узла графа → открыть панель
        if (viewMode === 'graph' && ui.graphView) {
          ui.graphView.on('node:selected', (node) => {
            if (this.panel) this.panel.openNode(node.id);
          });
        }
        const cell = document.querySelector(`.map-cell[data-map="${i}"]`);
        if (cell) cell.dataset.view = viewMode;
      }
    }
    await this.applyPresetToMap(0, 'global-monitor');
    await this.applyPresetToMap(1, 'entity-graph');
    await this.applyPresetToMap(2, 'recon');
    await this.applyPresetToMap(3, 'custom');
    await this.loadGraphData(1);
  }

  async loadGraphData(mapId) {
    const ui = this.maps[mapId];
    if (!ui || ui.viewMode !== 'graph') return null;
    try {
      const resp = await fetch(`${this.graphApiBase}/nodes?limit=200`);
      if (!resp.ok) return null;
      const data = await resp.json();
      let edges = [];
      const respEdges = await fetch(`${this.graphApiBase}/edges?limit=500`);
      if (respEdges.ok) {
        const eData = await respEdges.json();
        edges = eData.edges || [];
      }
      ui.setGraphData({ nodes: data.nodes || [], edges });
      return { nodes: data.nodes?.length || 0, edges: edges.length };
    } catch (e) {
      console.warn('[MultiMap] loadGraphData error:', e.message);
      return null;
    }
  }

  async applyPresetToMap(mapId, presetId) {
    const ui = this.maps[mapId];
    if (!ui) return null;
    try {
      const resp = await fetch(`${this.apiBase}/${encodeURIComponent(presetId)}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapId }),
      });
      if (!resp.ok) return null;
      const snapshot = await resp.json();
      this._applySnapshotToMap(mapId, snapshot.state);
      return snapshot;
    } catch (e) {
      console.warn('[MultiMap] applyPresetToMap error:', e.message);
      return null;
    }
  }

  _applySnapshotToMap(mapId, state) {
    const ui = this.maps[mapId];
    if (!ui || !state) return;
    if (state.theme) ui.applyTheme(state.theme);
    if (state.camera && ui.viewMode === 'geo') ui.flyTo(state.camera);
    if (ui.viewMode === 'geo') ui.clearLayers();
    const cellLabel = document.querySelector(`.map-cell[data-map="${mapId}"] .map-label span:first-child`);
    if (cellLabel) cellLabel.textContent = state.name || presetNameFallback(state.preset);
  }

  async clearMap(mapId) {
    const ui = this.maps[mapId];
    if (!ui) return null;
    try {
      const resp = await fetch(`${this.apiBase}/clear-map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapId }),
      });
      if (!resp.ok) return null;
      const snapshot = await resp.json();
      this._applySnapshotToMap(mapId, snapshot.state);
      return snapshot;
    } catch (e) {
      console.warn('[MultiMap] clearMap error:', e.message);
      return null;
    }
  }

  async saveCurrentAsPreset(mapId, name) {
    const ui = this.maps[mapId];
    if (!ui) return null;
    const state = ui.getState();
    try {
      const resp = await fetch(`${this.apiBase}/save-as`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          layers: state.activeLayers || [],
          camera: { center: state.center, zoom: state.zoom, pitch: state.pitch, bearing: state.bearing },
          theme: state.theme,
        }),
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch (e) {
      console.warn('[MultiMap] saveCurrentAsPreset error:', e.message);
      return null;
    }
  }

  async listPresets() {
    try {
      const resp = await fetch(`${this.apiBase}/list`);
      if (!resp.ok) return [];
      const data = await resp.json();
      return data.presets || [];
    } catch { return []; }
  }

  focusMap(id) {
    if (id < 0 || id >= this.maps.length) return;
    this.activeMap = id;
    document.querySelectorAll('.map-cell').forEach((el, i) => el.classList.toggle('focused', i === id));
  }

  cycleLayout() {
    const i = LAYOUTS.indexOf(this.layout);
    this.layout = LAYOUTS[(i + 1) % LAYOUTS.length];
    this.applyLayout();
  }

  applyLayout() {
    const grid = document.getElementById(this.options.mapGridId || 'map-grid');
    if (!grid) return;
    if (this.layout === 'grid-2x2') { grid.style.gridTemplateColumns = 'repeat(2, 1fr)'; grid.style.gridTemplateRows = 'repeat(2, 1fr)'; }
    else if (this.layout === 'row-1x4') { grid.style.gridTemplateColumns = 'repeat(4, 1fr)'; grid.style.gridTemplateRows = '1fr'; }
    else if (this.layout === 'focus-3') { grid.style.gridTemplateColumns = '2fr 1fr'; grid.style.gridTemplateRows = '1fr 1fr'; }
    else { grid.style.gridTemplateColumns = '1fr'; grid.style.gridTemplateRows = '1fr'; }
    const el = document.getElementById('stat-layout');
    if (el) el.textContent = this.layout;
  }

  initHotkeys() {
    document.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const key = e.key;
      if (key >= '1' && key <= '4') { this.focusMap(parseInt(key, 10) - 1); return; }
      const lower = key.toLowerCase();
      if (PRESET_KEYS[lower]) { this.applyPresetToMap(this.activeMap, PRESET_KEYS[lower]); return; }
      if (lower === 'l') { this.cycleLayout(); return; }
      if (lower === 's') {
        const name = prompt('Имя нового пресета:');
        if (name) this.saveCurrentAsPreset(this.activeMap, name);
        return;
      }
      if (key === 'Escape') { this.closePanel(); return; }
    });
  }

  closePanel() {
    if (this.panel) this.panel.hide();
  }

  initUI() {
    document.querySelectorAll('.map-cell').forEach((cell, i) => {
      cell.addEventListener('mousedown', () => this.focusMap(i));
    });
  }

  exportState() {
    return {
      layout: this.layout,
      activeMap: this.activeMap,
      maps: this.maps.map(ui => ui.getState()),
    };
  }
}

function presetNameFallback(id) {
  const map = {
    'global-monitor': 'Global Monitor',
    'entity-graph': 'Entity Graph',
    'recon': 'Recon',
    'custom': 'Custom',
  };
  return map[id] || id || 'Empty';
}

let _instance = null;
export function getMultiMapController(options) {
  if (!_instance) _instance = new MultiMapController(options);
  return _instance;
}
export function resetMultiMapController() { _instance = null; }
