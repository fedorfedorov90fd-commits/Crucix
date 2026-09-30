#!/usr/bin/env node
// Crucix Analyzer: GeoConvergence v2.0.0
//
// Читает: 15 гео-источников из data/basket/
// Пишет: data/analytics/detector/geo-convergence.json
//
// АКАДЕМИЧЕСКОЕ ОБОСНОВАНИЕ v2.0.0 (расширение анализатора):
//   v1.0.0 читал 3 источника (acled, earthquakes, firms), при этом
//   firms НЕ имеет координат — поэтому пожары фактически не попадали
//   в hotspots. Обнаружено при аудите 18.09.2026.
//   v2.0.0 читает 15 источников, применяет универсальный маппер
//   полей (lat/lon vs lat/lng, severity строковый vs числовой,
//   GeoJSON FeatureCollection vs плоский массив).
//
// 15 ИСТОЧНИКОВ (по группам):
//   A. Прямые lat/lon + числовая метрика: acled, floods, gps-jamming, notam
//   B. Прямые lat/lng + строковый severity: hurricanes, volcanoes,
//      wildfires, military-exercises, pipelines, undersea-cables,
//      earthquakes, conflict-zones
//   C. GeoJSON FeatureCollection: military-bases, ships, dark-ships

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

// ============================================================
//  УНИВЕРСАЛЬНЫЙ МАППЕР
// ============================================================

// Строковый severity → числовая серьёзность.
// Обоснование: единая шкала для класса GeoConvergence.
const SEVERITY_STRING_MAP = {
  critical: 1.0,
  extreme:  1.0,
  high:     0.75,
  medium:   0.5,
  moderate: 0.5,
  low:      0.25,
  info:     0.1,
  unknown:  0.3,
};

// Числовая метрика 1-5 → нормализованная серьёзность.
// Используется для gps-jamming (intensity) и notam (severity 1-5).
function numericSeverity(v, max = 5) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.3;
  return Math.min(Math.max(n / max, 0), 1);
}

// Извлечение severity из произвольного поля события.
function extractSeverity(ev, opts = {}) {
  // Строковый severity (самый частый).
  if (typeof ev.severity === 'string') {
    return SEVERITY_STRING_MAP[ev.severity.toLowerCase()] ?? 0.3;
  }
  // Числовой severity (notam).
  if (typeof ev.severity === 'number') {
    return numericSeverity(ev.severity, opts.severityMax ?? 5);
  }
  // intensity (gps-jamming).
  if (typeof ev.intensity === 'number') {
    return numericSeverity(ev.intensity, 5);
  }
  // magnitude (earthquakes) — ранговая нормализация 4-8.
  if (typeof ev.magnitude === 'number') {
    return Math.min(Math.max((ev.magnitude - 4) / 4, 0), 1);
  }
  // fatalities (acled) — логарифмическая.
  if (typeof ev.fatalities === 'number' && ev.fatalities > 0) {
    return Math.min(Math.log(1 + ev.fatalities) / Math.log(101), 1);
  }
  // deaths (floods) — логарифмическая.
  if (typeof ev.deaths === 'number' && ev.deaths > 0) {
    return Math.min(Math.log(1 + ev.deaths) / Math.log(1001), 1);
  }
  return 0.3;
}

// Извлечение timestamp.
function extractTimestamp(ev, fallback) {
  return ev.timestamp || ev.time || ev.event_date || ev.date || fallback;
}

// ============================================================
//  ОБРАБОТЧИКИ ПО ТИПАМ СТРУКТУР
// ============================================================

// Группа A/B: плоский массив с lat/lng или lat/lon.
function loadFlatArray(gc, data, opts) {
  if (!Array.isArray(data)) return 0;
  let count = 0;
  for (const ev of data) {
    const lat = ev.lat ?? ev.latitude;
    const lon = ev.lon ?? ev.lng ?? ev.longitude;
    if (lat == null || lon == null) continue;

    const severity = extractSeverity(ev);
    gc.add({
      lat: Number(lat),
      lon: Number(lon),
      severity,
      type: opts.type,
      source: opts.source,
      timestamp: extractTimestamp(ev, opts.now),
      meta: { id: ev.id, name: ev.name, region: ev.region, country: ev.country },
    });
    count++;
  }
  return count;
}

// Специальный обработчик для acled (вложенная { events: [...] }).
function loadAcled(gc, data, now) {
  const events = data?.events;
  if (!Array.isArray(events)) return 0;
  let count = 0;
  for (const ev of events) {
    if (ev.lat == null || ev.lon == null) continue;
    gc.add({
      lat: Number(ev.lat),
      lon: Number(ev.lon),
      severity: extractSeverity(ev),
      type: 'conflict',
      source: 'acled',
      timestamp: extractTimestamp(ev, now),
      meta: { id: ev.id, country: ev.country, actors: [ev.actor1, ev.actor2] },
    });
    count++;
  }
  return count;
}

// Группа C: GeoJSON FeatureCollection.
// Поддерживает два варианта: { type: 'FeatureCollection', features } и
// { data: { features } } (military-bases.json).
function loadFeatureCollection(gc, data, opts) {
  const features = data?.features || data?.data?.features;
  if (!Array.isArray(features)) return 0;
  let count = 0;
  for (const f of features) {
    const coords = f?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const [lon, lat] = coords; // GeoJSON порядок: [lon, lat]
    if (lat == null || lon == null) continue;

    const props = f.properties || {};
    const severity = extractSeverity(props, opts);
    gc.add({
      lat: Number(lat),
      lon: Number(lon),
      severity,
      type: opts.type,
      source: opts.source,
      timestamp: opts.now,
      meta: { name: props.name, country: props.country, status: props.status, shipType: props.type },
    });
    count++;
  }
  return count;
}

// ============================================================
//  ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();

  const gc = new GeoConvergence({
    gridSizeKm: 300,
    minEventsPerCell: 2,
    timeWindowHours: 168, // 7 дней
    multiTypeThreshold: 3,
  });

  const loaded = {};

  // --- Группа A + B: 13 плоских источников ---
  const flatSources = [
    { file: 'earthquakes.json',       type: 'earthquake',       severityMax: null },
    { file: 'floods.json',            type: 'flood',            severityMax: null },
    { file: 'hurricanes.json',        type: 'hurricane',        severityMax: null },
    { file: 'volcanoes.json',         type: 'volcano',          severityMax: null },
    { file: 'wildfires.json',         type: 'fire',             severityMax: null },
    { file: 'military-exercises.json',type: 'military',         severityMax: null },
    { file: 'conflict-zones.json',    type: 'conflict',         severityMax: null },
    { file: 'gps-jamming.json',       type: 'gps-jamming',      severityMax: 5 },
    { file: 'notam.json',             type: 'no-fly',           severityMax: 5 },
    { file: 'pipelines.json',         type: 'pipeline',         severityMax: null },
    { file: 'undersea-cables.json',   type: 'undersea-cable',   severityMax: null },
  ];

  for (const src of flatSources) {
    const data = await readJson(join(BASKET, src.file), null);
    const sourceName = src.file.replace('.json', '');
    const count = loadFlatArray(gc, data, {
      type: src.type,
      source: sourceName,
      now,
      severityMax: src.severityMax,
    });
    loaded[sourceName] = count;
  }

  // --- acled (вложенная структура { events: [...] }) ---
  const acled = await readJson(join(BASKET, 'acled.json'), null);
  loaded['acled'] = loadAcled(gc, acled, now);

  // --- Группа C: 3 GeoJSON источника ---
  const geoJsonSources = [
    { file: 'military-bases.json', type: 'military-base' },
    { file: 'ships.json',          type: 'ship' },
    { file: 'dark-ships.json',     type: 'dark-ship' },
  ];

  for (const src of geoJsonSources) {
    const data = await readJson(join(BASKET, src.file), null);
    const sourceName = src.file.replace('.json', '');
    const count = loadFeatureCollection(gc, data, {
      type: src.type,
      source: sourceName,
      now,
    });
    loaded[sourceName] = count;
  }

  // ============================================================
  //  РАСЧЁТЫ
  // ============================================================

  const hotspots = gc.topHotspots(50);
  const convergenceEvents = gc.convergenceEvents();
  const timeline = gc.timeline(24);
  const byType = gc.byType();
  const byRegion = gc.byRegion();
  const stats = gc.stats();

  const totalLoaded = Object.values(loaded).reduce((a, b) => a + b, 0);

  // ============================================================
  //  ФОРМИРОВАНИЕ PAYLOAD
  // ============================================================

  const payload = {
    _meta: {
      id: 'geo-convergence',
      category: 'detector',
      version: '2.0.0',
      schema_version: '2.0.0',
      sources: Object.keys(loaded).filter(k => loaded[k] > 0),
      calculator: 'GeoConvergence',
      updated_at: now,
      period: 'latest',
      duration_ms: Date.now() - t0,
      checksum: '',
      stats: {
        total_events: gc.events.length,
        total_loaded: totalLoaded,
        hotspots: hotspots.length,
        convergence_events: convergenceEvents.length,
        by_source: loaded,
      },
      description: 'Пространственная конвергенция событий: 15 источников, кластеризация координат, поиск горячих точек, типовая и временная конвергенция.',
    },
    data: {
      // Совместимость с v1.0.0 — поля hotspots и total сохранены.
      hotspots,
      total: hotspots.length,
      // Новые поля v2.0.0.
      convergence_events: convergenceEvents,
      timeline,
      by_type: byType,
      by_region: byRegion,
      stats,
      generated_at: now,
    },
  };

  // Контрольная сумма.
  const bodyForHash = JSON.stringify({ ...payload, _meta: { ...payload._meta, checksum: '' } });
  payload._meta.checksum = createHash('sha256').update(bodyForHash).digest('hex').slice(0, 16);

  // Запись.
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  // ============================================================
  //  ОТЧЁТ В КОНСОЛЬ
  // ============================================================

  console.log('════════════════════════════════════════════');
  console.log('GeoConvergence v2.0.0 — отчёт');
  console.log('════════════════════════════════════════════');
  console.log('Загружено событий:', gc.events.length);
  console.log('Горячих точек:', hotspots.length);
  console.log('Мультиконвергенций:', convergenceEvents.length);
  console.log('');
  console.log('По источникам:');
  for (const [name, count] of Object.entries(loaded)) {
    const mark = count > 0 ? '✓' : '·';
    console.log(`  ${mark} ${name.padEnd(22)} ${count}`);
  }
  console.log('');
  console.log('Топ-5 hotspots:');
  for (const h of hotspots.slice(0, 5)) {
    console.log(`  ${h.cellId}: lat=${h.lat.toFixed(2)}, lon=${h.lon.toFixed(2)}, events=${h.eventCount}, types=${h.typeDiversity}, score=${h.convergenceScore}, dominant=${h.dominantType}`);
  }
  if (convergenceEvents.length > 0) {
    console.log('');
    console.log('Топ-3 мультиконвергенции:');
    for (const c of convergenceEvents.slice(0, 3)) {
      const typesList = Object.keys(c.types).join('+');
      console.log(`  ${c.cellId}: ${typesList} (score=${c.convergenceScore})`);
    }
  }
  console.log('');
  console.log('Файл записан:', OUT_FILE);
}

main().catch(e => { console.error('ERR:', e.message); console.error(e.stack); process.exit(1); });
