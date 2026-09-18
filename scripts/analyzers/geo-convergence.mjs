#!/usr/bin/env node
// Crucix Analyzer: GeoConvergence v1.0.0
// Читает: acled, earthquakes, fires, cyber
// Пишет: data/analytics/detector/geo-convergence.json

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import GeoConvergence from '../../apis/sources/geo-convergence.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'detector');
const OUT_FILE = join(OUT_DIR, 'geo-convergence.json');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf-8')); }
  catch { return fallback; }
}

async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();

  const acled = await readJson(join(BASKET, 'acled.json'), { events: [] });
  const quakes = await readJson(join(BASKET, 'earthquakes.json'), []);
  const fires = await readJson(join(BASKET, 'firms.json'), []);

  const gc = new GeoConvergence({ gridSizeKm: 300, minEventsPerCell: 2 });

  for (const ev of (acled.events || acled || [])) {
    if (ev.lat && ev.lon) gc.add({ lat: ev.lat, lon: ev.lon, severity: Math.min((ev.fatalities||0)/50, 1), type: 'conflict' });
  }
  for (const eq of (quakes || [])) {
    if (eq.lat && eq.lng) gc.add({ lat: eq.lat, lon: eq.lng, severity: Math.min((eq.magnitude||0)/8, 1), type: 'earthquake' });
  }
  for (const f of (fires || [])) {
    if (f.lat && f.lng) gc.add({ lat: f.lat, lon: f.lng, severity: 0.5, type: 'fire' });
  }

  const hotspots = gc.topHotspots(50);

  const payload = {
    _meta: {
      id: 'geo-convergence',
      category: 'detector',
      version: '1.0.0',
      schema_version: '1.0.0',
      sources: ['acled', 'earthquakes', 'firms'],
      calculator: 'GeoConvergence',
      updated_at: now,
      period: 'latest',
      duration_ms: Date.now() - t0,
      checksum: '',
      stats: { total_events: gc.events.length, hotspots: hotspots.length },
      description: 'Пространственная конвергенция событий: кластеризация координат, поиск горячих точек.',
    },
    data: {
      hotspots,
      total: hotspots.length,
      generated_at: now,
    },
  };

  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log('════════════════════════════════════════════');
  console.log('GeoConvergence v1.0.0 — отчёт');
  console.log('════════════════════════════════════════════');
  console.log('Событий:', gc.events.length);
  console.log('Горячих точек:', hotspots.length);
  console.log('');
  console.log('Топ-5:');
  for (const h of hotspots.slice(0, 5)) {
    console.log(`  ${h.cellId}: lat=${h.lat.toFixed(2)}, lon=${h.lon.toFixed(2)}, events=${h.eventCount}, avgSev=${h.avgSeverity.toFixed(2)}, type=${h.dominantType}`);
  }
  console.log('');
  console.log('Файл записан:', OUT_FILE);
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
