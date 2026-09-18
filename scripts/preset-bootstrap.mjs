#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  CRUCIX PRESET BOOTSTRAP
//  Инициализация data/persist/presets/presets.json.
//  Безопасно: если файл уже есть — не перезаписывает.
//  Запуск: node scripts/preset-bootstrap.mjs
// ═══════════════════════════════════════════════════════════════

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIR = join(ROOT, 'data', 'persist', 'presets');
const FILE = join(DIR, 'presets.json');

const DEFAULT_PRESETS = [
  {
    id: 'global-monitor', name: 'Global Monitor', icon: '🌐',
    description: 'Демонстратор: глобальный мониторинг',
    theme: { name: 'default', bg: '#0f0f1a', surface: '#1a1a2e', accent: '#e94560', accentWarm: '#0f3460', text: '#eee', textDim: '#888', layerOpacity: 0.75, glow: false, scanlines: false },
    layers: ['country-instability','acled-conflicts','gdelt-events','firms-fires','usgs-earthquakes','noaa-weather','viirs-night-lights','migration-flow','food-security'],
    modules: ['country-instability','resilience-index','ai-news-synthesis','focal-point-detection','energy-market-intelligence','political-stability-monitor'],
    panels: ['instability-index','country-ranking','ai-briefing','weather','trends'],
    camera: { center: [0, 20], zoom: 1.5, pitch: 0, bearing: 0 },
    render: { cluster: true, clusterRadius: 40, heatmap: false, terrain3D: false, dayNight: true },
    metadata: { created: new Date().toISOString(), modified: new Date().toISOString(), version: '2.0.0', isBuiltin: true },
  },
  {
    id: 'entity-graph', name: 'Entity Graph', icon: '◆',
    description: 'Демонстратор: граф сущностей',
    theme: { name: 'default', bg: '#0f0f1a', surface: '#1a1a2e', accent: '#e94560', accentWarm: '#0f3460', text: '#eee', textDim: '#888', layerOpacity: 0.75, glow: false, scanlines: false },
    layers: ['entity-graph','diplomatic-relations','sanctions-map','infrastructure-critical','arms-transfers','conflict-escalation','cyber-attacks'],
    modules: ['entity-graph-engine','entity-model-engine','living-dossier','target-workbench','geotime-timeline','gaia-map-linker','multi-source-corroboration','source-credibility','scenario-simulation-engine','strategic-risk-composite'],
    panels: ['entity-graph','dossier','timeline','f2t2ea','risk-composite'],
    camera: { center: [30, 50], zoom: 3, pitch: 30, bearing: 0 },
    render: { cluster: false, clusterRadius: 0, heatmap: false, terrain3D: false, dayNight: false },
    metadata: { created: new Date().toISOString(), modified: new Date().toISOString(), version: '2.0.0', isBuiltin: true },
  },
  {
    id: 'recon', name: 'Recon', icon: '◈',
    description: 'Демонстратор: RECON',
    theme: { name: 'dark', bg: '#050708', surface: '#0a0e10', accent: '#00ff88', accentWarm: '#ff6b35', text: '#c8ffd4', textDim: '#1a5c3a', layerOpacity: 0.65, glow: true, scanlines: true },
    layers: ['recon-results','ofac-sdn','cyber-threats','aviation-opensky','maritime-ais','dark-fleet','satellite-viirs','gps-jamming','notam'],
    modules: ['recon-toolkit','recon-sidecar','intel-feed','telegram-osint-layer','crypto-wallet-trace','ai-analyst-context','cyber-attack-monitor','sanctions-pressure'],
    panels: ['recon','intel-feed','wallet-trace','telegram','port-scan','ssl-inspect'],
    camera: { center: [0, 30], zoom: 2, pitch: 45, bearing: 0 },
    render: { cluster: true, clusterRadius: 50, heatmap: true, terrain3D: true, dayNight: true },
    metadata: { created: new Date().toISOString(), modified: new Date().toISOString(), version: '2.0.0', isBuiltin: true },
  },
  {
    id: 'custom', name: 'Custom', icon: '★',
    description: 'Пустой пользовательский',
    theme: { name: 'default', bg: '#0f0f1a', surface: '#1a1a2e', accent: '#e94560', accentWarm: '#0f3460', text: '#eee', textDim: '#888', layerOpacity: 0.75, glow: false, scanlines: false },
    layers: [], modules: [], panels: [],
    camera: { center: [0, 20], zoom: 1.5, pitch: 0, bearing: 0 },
    render: { cluster: true, clusterRadius: 40, heatmap: false, terrain3D: false, dayNight: false },
    metadata: { created: new Date().toISOString(), modified: new Date().toISOString(), version: '2.0.0', isBuiltin: true },
  },
];

function log(m) { console.log(`[preset-bootstrap] ${m}`); }

function main() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  if (existsSync(FILE)) {
    try {
      const existing = JSON.parse(require('fs').readFileSync(FILE, 'utf-8'));
      log(`Файл уже существует: ${existing.length} пресетов, не перезаписываем`);
      return;
    } catch {
      log('Файл повреждён — перезаписываем дефолтными');
    }
  }
  writeFileSync(FILE, JSON.stringify(DEFAULT_PRESETS, null, 2), 'utf-8');
  log(`Записано ${DEFAULT_PRESETS.length} пресетов в ${FILE}`);
  for (const p of DEFAULT_PRESETS) {
    log(`  - ${p.icon} ${p.name} (id=${p.id}, слоёв ${p.layers.length}, модулей ${p.modules.length})`);
  }
  log('ГОТОВО');
}

main();
