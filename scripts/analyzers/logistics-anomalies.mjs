#!/usr/bin/env node
// Crucix Analyzer: LogisticsAnomalies v1.1.0
// Читает: aviation, dark-ships, ships, infrastructure, military-exercises, notam
// Пишет: data/analytics/specialist/logistics-anomalies.json
//
// ИСПРАВЛЕНИЕ v1.1.0: безопасное чтение источников любой структуры
// (массив / {features:[...]} / {data:{features:[...]}} / {aircraft:[...]} /
// {objects:[...]} / {success,data} / null).

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import LogisticsAnomalies from '../../apis/sources/logistics-anomalies.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'specialist');
const OUT_FILE = join(OUT_DIR, 'logistics-anomalies.json');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf-8')); }
  catch { return fallback; }
}

// Универсальное извлечение массива из любой структуры.
function asArray(d) {
  if (Array.isArray(d)) return d;
  if (!d || typeof d !== 'object') return [];
  if (Array.isArray(d.features)) return d.features;
  if (Array.isArray(d.objects)) return d.objects;
  if (Array.isArray(d.aircraft)) return d.aircraft;
  if (Array.isArray(d.events)) return d.events;
  if (Array.isArray(d.records)) return d.records;
  if (Array.isArray(d.items)) return d.items;
  if (d.data) return asArray(d.data);
  return [];
}

// Извлечение координат из любого формата.
function coords(o) {
  if (!o || typeof o !== 'object') return null;
  if (o.coordinates && typeof o.coordinates === 'object' && !Array.isArray(o.coordinates)) {
    const lat = o.coordinates.lat ?? o.coordinates.latitude;
    const lon = o.coordinates.lng ?? o.coordinates.lon ?? o.coordinates.longitude;
    if (lat != null && lon != null) return { lat: Number(lat), lon: Number(lon) };
  }
  if (o.geometry && Array.isArray(o.geometry.coordinates)) {
    const [lon, lat] = o.geometry.coordinates;
    if (lat != null && lon != null) return { lat: Number(lat), lon: Number(lon) };
  }
  const lat = o.lat ?? o.latitude;
  const lon = o.lon ?? o.lng ?? o.longitude;
  if (lat != null && lon != null) return { lat: Number(lat), lon: Number(lon) };
  return null;
}

function normSev(o, fallback = 0.5) {
  if (!o) return fallback;
  if (typeof o.vulnerability === 'number') return Math.min(Math.max(o.vulnerability / 10, 0), 1);
  if (typeof o.severity === 'number') return Math.min(Math.max(o.severity, 0), 1);
  if (typeof o.intensity === 'number') return Math.min(Math.max(o.intensity / 5, 0), 1);
  if (typeof o.severity === 'string') {
    const map = { critical: 1.0, high: 0.75, medium: 0.5, low: 0.25 };
    return map[o.severity.toLowerCase()] ?? fallback;
  }
  return fallback;
}

async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();

  const la = new LogisticsAnomalies({ windowHours: 168, minAnomalyScore: 1.5, gridSizeKm: 150, clusterRadiusKm: 200 });

  const sources = [
    { file: 'aviation.json',            type: 'aviation',         source: 'aviation',           sev: 0.6 },
    { file: 'dark-ships.json',          type: 'dark-ship',        source: 'dark-ships',         sev: 0.9 },
    { file: 'ships.json',               type: 'ship',             source: 'ships',              sev: 0.4 },
    { file: 'military-exercises.json',  type: 'military-exercise',source: 'military-exercises', sev: 0.85 },
    { file: 'notam.json',               type: 'notam',            source: 'notam',              sev: 0.6 },
    { file: 'infrastructure.json',      type: 'infrastructure',   source: 'infrastructure',     sev: 0.5 },
  ];

  const loaded = {};

  for (const src of sources) {
    const raw = await readJson(join(BASKET, src.file), null);
    const arr = asArray(raw);
    let count = 0;
    for (const o of arr) {
      const c = coords(o);
      if (!c) continue;
      la.add({
        lat: c.lat,
        lon: c.lon,
        type: src.type,
        severity: normSev(o, src.sev),
        source: src.source,
        timestamp: o.timestamp || o.time || now,
      });
      count++;
    }
    loaded[src.source] = count;
  }

  const anomalies = la.detectAnomalies();
  const clusters = la.clusterAnomalies();
  const byType = la.byType();
  const byRegion = la.byRegion();
  const stats = la.stats();
  const totalLoaded = Object.values(loaded).reduce((a, b) => a + b, 0);

  const payload = {
    _meta: {
      id: 'logistics-anomalies',
      category: 'specialist',
      version: '1.1.0',
      schema_version: '1.1.0',
      sources: Object.keys(loaded).filter(k => loaded[k] > 0),
      calculator: 'LogisticsAnomalies',
      updated_at: now,
      period: 'latest',
      duration_ms: Date.now() - t0,
      checksum: '',
      stats: { total_events: la.events.length, total_loaded: totalLoaded, anomalies: anomalies.length, clusters: clusters.length, by_source: loaded },
      description: 'Логистические аномалии: накопление транспорта перед событием. Физические данные не лгут.',
    },
    data: { anomalies, clusters, by_type: byType, by_region: byRegion, stats, generated_at: now },
  };

  const body = JSON.stringify({ ...payload, _meta: { ...payload._meta, checksum: '' } });
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log('════════════════════════════════════════════');
  console.log('LogisticsAnomalies v1.1.0 — отчёт');
  console.log('════════════════════════════════════════════');
  console.log('Загружено событий:', la.events.length);
  console.log('Аномалий:', anomalies.length);
  console.log('Кластеров:', clusters.length);
  console.log('');
  console.log('По источникам:');
  for (const [name, count] of Object.entries(loaded)) {
    console.log(`  ${count > 0 ? '✓' : '·'} ${name.padEnd(22)} ${count}`);
  }
  console.log('');
  for (const a of anomalies.slice(0, 5)) {
    console.log(`  ${a.cellId}: lat=${a.lat.toFixed(2)}, lon=${a.lon.toFixed(2)}, score=${a.score.toFixed(2)}, type=${a.dominantType}, sources=${a.uniqueSources}`);
  }
  console.log('');
  console.log('Файл записан:', OUT_FILE);
}

main().catch(e => { console.error('ERR:', e.message); console.error(e.stack); process.exit(1); });
