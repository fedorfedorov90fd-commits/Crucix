// ═══════════════════════════════════════════════════════════════
//  CRUCIX PRESET ENGINE v2.0.0
//  Пресеты — заготовки-демонстраторы. Никакого жёсткого ядра.
//  Любой слой можно включить/выключить на любой карте.
//  Пользователь полностью переопределяет карту под свою задачу.
//  Никаких имён конкурентов. Никакой синхронизации.
// ═══════════════════════════════════════════════════════════════

import { EventEmitter } from 'node:events';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// ─── Идентификаторы дефолтных пресетов ────────────────────────
export const PRESET_IDS = Object.freeze({
  GLOBAL_MONITOR: 'global-monitor',
  ENTITY_GRAPH:   'entity-graph',
  RECON:          'recon',
  CUSTOM:         'custom',
});

// ─── Тема оформления (нейтральная, без брендинга) ─────────────
export const THEMES = Object.freeze({
  default: {
    name: 'default',
    bg: '#0f0f1a', surface: '#1a1a2e', accent: '#e94560',
    accentWarm: '#0f3460', text: '#eee', textDim: '#888',
    layerOpacity: 0.75, glow: false, scanlines: false,
  },
  dark: {
    name: 'dark',
    bg: '#050708', surface: '#0a0e10', accent: '#00ff88',
    accentWarm: '#ff6b35', text: '#c8ffd4', textDim: '#1a5c3a',
    layerOpacity: 0.65, glow: true, scanlines: true,
  },
  light: {
    name: 'light',
    bg: '#f5f5f7', surface: '#ffffff', accent: '#1a1a2e',
    accentWarm: '#e94560', text: '#1a1a1a', textDim: '#666',
    layerOpacity: 0.85, glow: false, scanlines: false,
  },
});

// ─── Дефолтные пресеты (заготовки-демонстраторы) ──────────────
// Каждый — просто рекомендация: слои по умолчанию, тема, набор модулей.
// Все слои можно выключить. Все модули можно отключить. Тему можно сменить.
function buildDefaultPresets() {
  return [
    {
      id: PRESET_IDS.GLOBAL_MONITOR,
      name: 'Global Monitor',
      description: 'Демонстратор: глобальный мониторинг — страны, события, индексы нестабильности',
      icon: '🌐',
      theme: THEMES.default,
      layers: [
        'country-instability', 'acled-conflicts', 'gdelt-events',
        'firms-fires', 'usgs-earthquakes', 'noaa-weather',
        'viirs-night-lights', 'migration-flow', 'food-security',
      ],
      modules: [
        'country-instability', 'resilience-index',
        'ai-news-synthesis', 'focal-point-detection',
        'energy-market-intelligence', 'political-stability-monitor',
      ],
      panels: ['instability-index', 'country-ranking', 'ai-briefing', 'weather', 'trends'],
      camera: { center: [0, 20], zoom: 1.5, pitch: 0, bearing: 0 },
      render: {
        cluster: true, clusterRadius: 40, heatmap: false,
        terrain3D: false, dayNight: true,
      },
    },
    {
      id: PRESET_IDS.ENTITY_GRAPH,
      name: 'Entity Graph',
      description: 'Демонстратор: граф сущностей — узлы, рёбра, досье, F2T2EA',
      icon: '◆',
      theme: THEMES.default,
      layers: [
        'entity-graph', 'diplomatic-relations', 'sanctions-map',
        'infrastructure-critical', 'arms-transfers',
        'conflict-escalation', 'cyber-attacks',
      ],
      modules: [
        'entity-graph-engine', 'entity-model-engine',
        'living-dossier', 'target-workbench',
        'geotime-timeline', 'gaia-map-linker',
        'multi-source-corroboration', 'source-credibility',
        'scenario-simulation-engine', 'strategic-risk-composite',
      ],
      panels: ['entity-graph', 'dossier', 'timeline', 'f2t2ea', 'risk-composite'],
      camera: { center: [30, 50], zoom: 3, pitch: 30, bearing: 0 },
      render: {
        cluster: false, clusterRadius: 0, heatmap: false,
        terrain3D: false, dayNight: false,
      },
    },
    {
      id: PRESET_IDS.RECON,
      name: 'Recon',
      description: 'Демонстратор: RECON — санкции, кошельки, кибер, тёмный флот',
      icon: '◈',
      theme: THEMES.dark,
      layers: [
        'recon-results', 'ofac-sdn', 'cyber-threats',
        'aviation-opensky', 'maritime-ais', 'dark-fleet',
        'satellite-viirs', 'gps-jamming', 'notam',
      ],
      modules: [
        'recon-toolkit', 'recon-sidecar',
        'intel-feed', 'telegram-osint-layer',
        'crypto-wallet-trace', 'ai-analyst-context',
        'cyber-attack-monitor', 'sanctions-pressure',
      ],
      panels: ['recon', 'intel-feed', 'wallet-trace', 'telegram', 'port-scan', 'ssl-inspect'],
      camera: { center: [0, 30], zoom: 2, pitch: 45, bearing: 0 },
      render: {
        cluster: true, clusterRadius: 50, heatmap: true,
        terrain3D: true, dayNight: true,
      },
    },
    {
      id: PRESET_IDS.CUSTOM,
      name: 'Custom',
      description: 'Пустой пользовательский — полная свобода. Пользователь сам всё включит',
      icon: '★',
      theme: THEMES.default,
      layers: [],
      modules: [],
      panels: [],
      camera: { center: [0, 20], zoom: 1.5, pitch: 0, bearing: 0 },
      render: {
        cluster: true, clusterRadius: 40, heatmap: false,
        terrain3D: false, dayNight: false,
      },
    },
  ];
}

// ─── Пресет ────────────────────────────────────────────────────
class Preset extends EventEmitter {
  constructor(cfg) {
    super();
    this.id = cfg.id;
    this.name = cfg.name || cfg.id;
    this.description = cfg.description || '';
    this.icon = cfg.icon || '★';
    this.theme = { ...(cfg.theme || THEMES.default) };
    this.layers = new Set(cfg.layers || []);
    this.modules = new Set(cfg.modules || []);
    this.panels = new Set(cfg.panels || []);
    this.camera = { ...(cfg.camera || { center: [0, 20], zoom: 1.5, pitch: 0, bearing: 0 }) };
    this.render = {
      cluster: true, clusterRadius: 40, heatmap: false,
      terrain3D: false, dayNight: false,
      ...(cfg.render || {}),
    };
    this.metadata = {
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      version: '2.0.0',
      isBuiltin: cfg.isBuiltin === true,
    };
  }

  // ── Слои ───────────────────────────────────────────────────
  enableLayer(id) {
    if (this.layers.has(id)) return false;
    this.layers.add(id);
    this._touch('layer:enable', { id });
    return true;
  }
  disableLayer(id) {
    if (!this.layers.has(id)) return false;
    this.layers.delete(id);
    this._touch('layer:disable', { id });
    return true;
  }
  toggleLayer(id) {
    return this.layers.has(id) ? this.disableLayer(id) : this.enableLayer(id);
  }
  hasLayer(id) { return this.layers.has(id); }
  setLayers(ids) {
    this.layers = new Set(ids || []);
    this._touch('layers:set', { count: this.layers.size });
    return true;
  }

  // ── Модули ─────────────────────────────────────────────────
  enableModule(id) {
    if (this.modules.has(id)) return false;
    this.modules.add(id);
    this._touch('module:enable', { id });
    return true;
  }
  disableModule(id) {
    if (!this.modules.has(id)) return false;
    this.modules.delete(id);
    this._touch('module:disable', { id });
    return true;
  }
  toggleModule(id) {
    return this.modules.has(id) ? this.disableModule(id) : this.enableModule(id);
  }
  hasModule(id) { return this.modules.has(id); }

  // ── Панели ─────────────────────────────────────────────────
  enablePanel(id) {
    if (this.panels.has(id)) return false;
    this.panels.add(id);
    this._touch('panel:enable', { id });
    return true;
  }
  disablePanel(id) {
    if (!this.panels.has(id)) return false;
    this.panels.delete(id);
    this._touch('panel:disable', { id });
    return true;
  }
  hasPanel(id) { return this.panels.has(id); }

  // ── Тема ───────────────────────────────────────────────────
  setTheme(themeNameOrObject) {
    if (typeof themeNameOrObject === 'string') {
      const t = THEMES[themeNameOrObject];
      if (!t) return false;
      this.theme = { ...t };
    } else if (typeof themeNameOrObject === 'object') {
      this.theme = { ...this.theme, ...themeNameOrObject };
    } else {
      return false;
    }
    this._touch('theme:set', { name: this.theme.name });
    return true;
  }

  // ── Камера ─────────────────────────────────────────────────
  setCamera(c) {
    if (c.center) this.camera.center = c.center;
    if (c.zoom !== undefined) this.camera.zoom = c.zoom;
    if (c.pitch !== undefined) this.camera.pitch = c.pitch;
    if (c.bearing !== undefined) this.camera.bearing = c.bearing;
    this._touch('camera:set');
    return true;
  }

  // ── Рендер ─────────────────────────────────────────────────
  setRender(opts) {
    this.render = { ...this.render, ...opts };
    this._touch('render:set');
    return true;
  }

  // ── Переименование ────────────────────────────────────────
  rename(newName) {
    if (!newName || typeof newName !== 'string') return false;
    this.name = newName;
    this._touch('renamed', { name: newName });
    return true;
  }

  _touch(action, payload = {}) {
    this.metadata.modified = new Date().toISOString();
    this.emit('changed', { id: this.id, action, ...payload });
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      icon: this.icon,
      theme: this.theme,
      layers: [...this.layers],
      modules: [...this.modules],
      panels: [...this.panels],
      camera: { ...this.camera },
      render: { ...this.render },
      metadata: { ...this.metadata },
    };
  }

  static fromJSON(j) {
    const p = new Preset(j);
    p.metadata = { ...j.metadata } || p.metadata;
    return p;
  }
}

// ─── Движок пресетов ───────────────────────────────────────────
export class PresetEngine extends EventEmitter {
  constructor(persistDir) {
    super();
    this.presets = new Map();
    this.persistDir = persistDir || join(process.cwd(), 'data', 'persist', 'presets');
    this._loadDefaults();
    this._loadCustom();
  }

  _loadDefaults() {
    for (const cfg of buildDefaultPresets()) {
      cfg.isBuiltin = true;
      const p = new Preset(cfg);
      p.on('changed', (e) => this.emit('preset:changed', e));
      this.presets.set(p.id, p);
    }
  }

  _loadCustom() {
    const file = join(this.persistDir, 'presets.json');
    if (!existsSync(file)) return;
    try {
      const raw = readFileSync(file, 'utf-8');
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return;
      for (const json of list) {
        if (this.presets.has(json.id)) {
          // пользовательская версия заменяет дефолтный
          const p = Preset.fromJSON({ ...json, isBuiltin: false });
          p.on('changed', (e) => this.emit('preset:changed', e));
          this.presets.set(p.id, p);
        } else {
          const p = Preset.fromJSON(json);
          p.on('changed', (e) => this.emit('preset:changed', e));
          this.presets.set(p.id, p);
        }
      }
    } catch (e) {
      this.emit('error', { type: 'load', error: e.message });
    }
  }

  _saveAll() {
    try {
      if (!existsSync(this.persistDir)) mkdirSync(this.persistDir, { recursive: true });
      const list = [...this.presets.values()].map(p => p.toJSON());
      writeFileSync(join(this.persistDir, 'presets.json'), JSON.stringify(list, null, 2));
    } catch (e) {
      this.emit('error', { type: 'save', error: e.message });
    }
  }

  // ── CRUD ────────────────────────────────────────────────────
  get(id) { return this.presets.get(id) || null; }
  getAll() { return [...this.presets.values()]; }
  list() {
    return this.getAll().map(p => ({
      id: p.id, name: p.name, description: p.description, icon: p.icon,
      layersCount: p.layers.size, modulesCount: p.modules.size, panelsCount: p.panels.size,
      isBuiltin: p.metadata.isBuiltin,
    }));
  }
  exists(id) { return this.presets.has(id); }

  // ── Применение пресета к карте ─────────────────────────────
  // Копирует слои/тему/камеру/рендер в состояние карты.
  applyToMap(mapId, presetId) {
    const preset = this.presets.get(presetId);
    if (!preset) return null;
    const snapshot = {
      mapId,
      presetId,
      appliedAt: new Date().toISOString(),
      state: {
        preset: presetId,
        name: preset.name,
        theme: { ...preset.theme },
        layers: [...preset.layers],
        modules: [...preset.modules],
        panels: [...preset.panels],
        camera: { ...preset.camera },
        render: { ...preset.render },
      },
    };
    this.emit('map:apply', snapshot);
    return snapshot;
  }

  // ── Сохранить текущее состояние карты как пресет ──────────
  saveAsPreset(mapState, name) {
    if (!mapState || !name) return null;
    const id = `custom_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const cfg = {
      id,
      name,
      description: `Пользовательский пресет, создан ${new Date().toISOString()}`,
      icon: '★',
      theme: mapState.theme || THEMES.default,
      layers: mapState.layers || [],
      modules: mapState.modules || [],
      panels: mapState.panels || [],
      camera: mapState.camera || { center: [0, 20], zoom: 1.5, pitch: 0, bearing: 0 },
      render: mapState.render || {},
      isBuiltin: false,
    };
    const preset = new Preset(cfg);
    preset.on('changed', (e) => this.emit('preset:changed', e));
    this.presets.set(preset.id, preset);
    this._saveAll();
    this.emit('preset:created', { id: preset.id, name });
    return preset.toJSON();
  }

  // ── Полный сброс карты в пустое состояние ─────────────────
  clearMap(mapId) {
    const snapshot = {
      mapId,
      appliedAt: new Date().toISOString(),
      state: {
        preset: null,
        name: 'Empty',
        theme: { ...THEMES.default },
        layers: [],
        modules: [],
        panels: [],
        camera: { center: [0, 20], zoom: 1.5, pitch: 0, bearing: 0 },
        render: { cluster: false, clusterRadius: 0, heatmap: false, terrain3D: false, dayNight: false },
      },
    };
    this.emit('map:clear', snapshot);
    return snapshot;
  }

  // ── Клонирование ────────────────────────────────────────────
  clone(sourceId, newName) {
    const src = this.presets.get(sourceId);
    if (!src) return null;
    const cfg = src.toJSON();
    cfg.id = `custom_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    cfg.name = newName || `${src.name} (Copy)`;
    cfg.metadata = {
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      version: '2.0.0',
      isBuiltin: false,
    };
    const clone = new Preset(cfg);
    clone.on('changed', (e) => this.emit('preset:changed', e));
    this.presets.set(clone.id, clone);
    this._saveAll();
    return clone.toJSON();
  }

  // ── Удаление (builtin тоже можно удалить — пользователь решает) ──
  delete(id) {
    if (!this.presets.has(id)) return false;
    this.presets.delete(id);
    this._saveAll();
    this.emit('preset:deleted', { id });
    return true;
  }

  // ── Переименование ─────────────────────────────────────────
  rename(id, newName) {
    const p = this.presets.get(id);
    if (!p) return false;
    const ok = p.rename(newName);
    if (ok) this._saveAll();
    return ok;
  }

  // ── Сброс к дефолту (для builtin) ──────────────────────────
  reset(id) {
    const defaults = buildDefaultPresets();
    const cfg = defaults.find(d => d.id === id);
    if (!cfg) return false;
    cfg.isBuiltin = true;
    const p = new Preset(cfg);
    p.on('changed', (e) => this.emit('preset:changed', e));
    this.presets.set(id, p);
    this._saveAll();
    return true;
  }

  // ── Полный рендер-конфиг для UI ────────────────────────────
  getRenderConfig(id) {
    const p = this.presets.get(id);
    if (!p) return null;
    return p.toJSON();
  }

  // ── Статистика ─────────────────────────────────────────────
  getStats() {
    let layers = 0, modules = 0, panels = 0;
    for (const p of this.presets.values()) {
      layers += p.layers.size;
      modules += p.modules.size;
      panels += p.panels.size;
    }
    const builtin = [...this.presets.values()].filter(p => p.metadata.isBuiltin).length;
    return {
      total: this.presets.size,
      builtin,
      custom: this.presets.size - builtin,
      totalLayers: layers,
      totalModules: modules,
      totalPanels: panels,
      themes: Object.keys(THEMES).length,
    };
  }
}

// ─── Singleton ─────────────────────────────────────────────────
let _instance = null;
export function getPresetEngine(persistDir) {
  if (!_instance) _instance = new PresetEngine(persistDir);
  return _instance;
}
export function resetPresetEngine() {
  _instance = null;
}
