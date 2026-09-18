/**
 * apis/sources/satellite-api.mjs — API-МОДУЛЬ: КОСМИЧЕСКИЕ СПУТНИКИ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/satellite.json — [{ id, name, norad_id, type, orbit, lat, lng, alt_km, velocity, operator, country, launch_date, status, purpose, period_min, inclination }] ИЛИ { satellites:[...] } ИЛИ { data:[...] }.
 * Сборщик: scripts/collectors/collect-satellite.mjs.
 *
 * Реестр спутников: позиции на орбите, типы, операторы, страны, назначение.
 * Классифицирует по орбитам (LEO/MEO/GEO/HEO) и назначению (коммуникации,
 * разведка, навигация, наука, военные, наблюдение за Землёй).
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw, tle.
 * ФИЛЬТРЫ: ?type=, ?orbit=, ?country=, ?operator=, ?purpose=, ?status=, ?q=, ?since=, ?limit=, ?top=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /                    — корень (список эндпоинтов)
 *   GET /stats               — агрегированная статистика
 *   GET /status              — health-check
 *   GET /latest              — последние запуски (top-N по дате)
 *   GET /orbits              — группировка по орбитам (LEO/MEO/GEO/HEO)
 *   GET /countries           — группировка по странам
 *   GET /operators           — топ операторов
 *   GET /purposes            — группировка по назначению
 *   GET /constellations      — группировка по группировкам (Starlink, OneWeb, GPS)
 *   GET /military            — только военные/разведывательные
 *   GET /commercial          — только коммерческие
 *   GET /launches            — хронология запусков
 *   GET /altitude            — распределение по высоте
 *   GET /featurecollection   — GeoJSON
 *   GET /render              — рендер-конфиг (orbit trails, ground track)
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'satellite.json');

export const route  = '/api/layers/satellite';
export const method = 'GET';

export const meta = {
  category: 'space',
  icon: '🛰️',
  color: '#0ea5e9',
  vizType: 'marker',
  source: 'basket/satellite.json',
  collector: 'collect-satellite.mjs',
  cache: 300,
  description: 'Реестр спутников: орбиты, операторы, назначение, статус',
  unit: 'satellites',
};

// ============================================================
//  СПРАВОЧНИКИ
// ============================================================

const ORBIT_TYPES = {
  LEO:  { min: 160,  max: 2000,   color: '#22c55e', label: 'Низкая (LEO)' },
  MEO:  { min: 2000, max: 35786,  color: '#eab308', label: 'Средняя (MEO)' },
  GEO:  { min: 35786, max: 35800, color: '#0891b2', label: 'Геостационарная (GEO)' },
  HEO:  { min: 35800, max: 500000, color: '#a855f7', label: 'Высокая (HEO)' },
  UNKNOWN: { min: 0, max: 0, color: '#64748b', label: 'Неизвестно' },
};

function orbitByAltitude(alt) {
  const n = Number(alt);
  if (!Number.isFinite(n)) return 'UNKNOWN';
  if (n >= 160 && n < 2000) return 'LEO';
  if (n >= 2000 && n < 35786) return 'MEO';
  if (n >= 35786 && n <= 35800) return 'GEO';
  if (n > 35800) return 'HEO';
  return 'UNKNOWN';
}

const PURPOSE_CATEGORIES = {
  communication: { color: '#0ea5e9', label: 'Коммуникации' },
  navigation:    { color: '#22c55e', label: 'Навигация' },
  reconnaissance:{ color: '#dc2626', label: 'Разведка' },
  military:      { color: '#7c2d12', label: 'Военный' },
  science:       { color: '#a855f7', label: 'Наука' },
  earth_observation: { color: '#16a34a', label: 'Наблюдение за Землёй' },
  weather:       { color: '#06b6d4', label: 'Метеорология' },
  early_warning: { color: '#f97316', label: 'Раннее предупреждение' },
  sigint:        { color: '#e11d48', label: 'SIGINT' },
  elint:         { color: '#be123c', label: 'ELINT' },
  imaging:       { color: '#ea580c', label: 'Спутниковая съёмка' },
  other:         { color: '#64748b', label: 'Прочее' },
};

function normalizePurpose(raw) {
  const p = String(raw || '').toLowerCase();
  if (p.includes('comm')) return 'communication';
  if (p.includes('nav') || p.includes('gps') || p.includes('glonass') || p.includes('galileo')) return 'navigation';
  if (p.includes('recon')) return 'reconnaissance';
  if (p.includes('milit') || p.includes('defense')) return 'military';
  if (p.includes('sci') || p.includes('research')) return 'science';
  if (p.includes('earth') || p.includes('land')) return 'earth_observation';
  if (p.includes('weather') || p.includes('meteo')) return 'weather';
  if (p.includes('early') || p.includes('warning')) return 'early_warning';
  if (p.includes('sigint')) return 'sigint';
  if (p.includes('elint')) return 'elint';
  if (p.includes('imag') || p.includes('photo')) return 'imaging';
  return 'other';
}

const STATUS_COLORS = {
  active:   '#22c55e',
  inactive: '#64748b',
  decayed:  '#dc2626',
  lost:     '#7f1d1d',
  standby:  '#eab308',
  unknown:  '#94a3b8',
};

// ============================================================
//  ЗАГРУЗКА
// ============================================================

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-satellite.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  return parsed;
}

function extractSatellites(doc) {
  let arr = null;
  let source = null;
  let metaObj = null;

  if (Array.isArray(doc)) arr = doc;
  else if (doc && Array.isArray(doc.satellites)) { arr = doc.satellites; source = doc.source || null; metaObj = doc.meta || null; }
  else if (doc && Array.isArray(doc.data)) { arr = doc.data; source = doc.source || null; metaObj = doc.meta || null; }
  else if (doc && Array.isArray(doc.items)) arr = doc.items;
  else if (doc && Array.isArray(doc.records)) arr = doc.records;

  if (!arr) return { satellites: [], source, meta: metaObj };
  return { satellites: arr, source, meta: metaObj };
}

function normalizeSat(s, i) {
  const lat = Number(s.lat ?? s.latitude);
  const lng = Number(s.lng ?? s.lon ?? s.longitude);
  const alt = Number(s.alt_km ?? s.altitude ?? s.alt);
  const orbit = String(s.orbit || orbitByAltitude(alt)).toUpperCase();
  const purpose = normalizePurpose(s.purpose || s.type || s.mission);
  const purposeMeta = PURPOSE_CATEGORIES[purpose] || PURPOSE_CATEGORIES.other;
  const status = String(s.status || 'unknown').toLowerCase();

  return {
    id: String(s.id || s.norad_id || s.catalog_number || `sat-${i}`),
    name: s.name || s.label || `Satellite ${i}`,
    norad_id: s.norad_id || s.catalogNumber || s.catalog_number || null,
    type: s.type || null,
    orbit,
    orbitLabel: (ORBIT_TYPES[orbit] || ORBIT_TYPES.UNKNOWN).label,
    orbitColor: (ORBIT_TYPES[orbit] || ORBIT_TYPES.UNKNOWN).color,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    alt_km: Number.isFinite(alt) ? Number(alt.toFixed(2)) : null,
    velocity_kms: s.velocity != null ? Number(s.velocity) : (s.velocity_kms != null ? Number(s.velocity_kms) : null),
    period_min: s.period_min != null ? Number(s.period_min) : (s.period != null ? Number(s.period) : null),
    inclination: s.inclination != null ? Number(s.inclination) : null,
    operator: s.operator || s.owner || null,
    country: s.country || s.origin || null,
    constellation: s.constellation || s.group || null,
    launch_date: String(s.launch_date || s.launched || '').slice(0, 10) || null,
    status,
    statusColor: STATUS_COLORS[status] || STATUS_COLORS.unknown,
    purpose,
    purposeLabel: purposeMeta.label,
    purposeColor: purposeMeta.color,
    mass_kg: s.mass_kg != null ? Number(s.mass_kg) : (s.mass != null ? Number(s.mass) : null),
    description: s.description || null,
    category: 'space',
    icon: meta.icon,
  };
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.orbit)       r = r.filter(x => x.orbit === String(query.orbit).toUpperCase());
  if (query.type)        r = r.filter(x => String(x.type || '').toLowerCase().includes(String(query.type).toLowerCase()));
  if (query.country)     r = r.filter(x => String(x.country || '').toLowerCase().includes(String(query.country).toLowerCase()));
  if (query.operator)    r = r.filter(x => String(x.operator || '').toLowerCase().includes(String(query.operator).toLowerCase()));
  if (query.purpose)     r = r.filter(x => x.purpose === normalizePurpose(query.purpose));
  if (query.status)      r = r.filter(x => x.status === String(query.status).toLowerCase());
  if (query.constellation) r = r.filter(x => String(x.constellation || '').toLowerCase().includes(String(query.constellation).toLowerCase()));
  if (query.q) {
    const s = String(query.q).toLowerCase();
    r = r.filter(x => (x.name + ' ' + (x.operator || '') + ' ' + (x.country || '')).toLowerCase().includes(s));
  }
  if (query.since) r = r.filter(x => !x.launch_date || x.launch_date >= String(query.since).slice(0, 10));
  if (query.min_alt != null) { const n = Number(query.min_alt); if (Number.isFinite(n)) r = r.filter(x => x.alt_km != null && x.alt_km >= n); }
  if (query.max_alt != null) { const n = Number(query.max_alt); if (Number.isFinite(n)) r = r.filter(x => x.alt_km != null && x.alt_km <= n); }

  const sortKey = query.sort;
  if (sortKey === 'alt-desc')    r.sort((a, b) => (b.alt_km ?? 0) - (a.alt_km ?? 0));
  else if (sortKey === 'alt-asc') r.sort((a, b) => (a.alt_km ?? 0) - (b.alt_km ?? 0));
  else if (sortKey === 'name')    r.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortKey === 'launch-desc') r.sort((a, b) => String(b.launch_date || '').localeCompare(String(a.launch_date || '')));
  else if (sortKey === 'launch-asc')  r.sort((a, b) => String(a.launch_date || '').localeCompare(String(b.launch_date || '')));

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(rows) {
  const byOrbit = {};
  const byCountry = {};
  const byOperator = {};
  const byPurpose = {};
  const byStatus = {};
  const byConstellation = {};
  const altitudes = [];
  const launches = [];

  for (const r of rows) {
    byOrbit[r.orbit] = (byOrbit[r.orbit] || 0) + 1;
    if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
    if (r.operator) byOperator[r.operator] = (byOperator[r.operator] || 0) + 1;
    byPurpose[r.purpose] = (byPurpose[r.purpose] || 0) + 1;
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    if (r.constellation) byConstellation[r.constellation] = (byConstellation[r.constellation] || 0) + 1;
    if (r.alt_km != null) altitudes.push(r.alt_km);
    if (r.launch_date) launches.push(r.launch_date);
  }

  const top = (obj, n = 15) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));

  return {
    count: rows.length,
    with_position: rows.filter(r => r.lat != null && r.lng != null).length,
    by_orbit: byOrbit,
    by_purpose: byPurpose,
    by_status: byStatus,
    top_countries: top(byCountry, 15),
    top_operators: top(byOperator, 15),
    top_constellations: top(byConstellation, 15),
    altitude: altitudes.length ? {
      min: Number(Math.min(...altitudes).toFixed(2)),
      max: Number(Math.max(...altitudes).toFixed(2)),
      mean: Number((altitudes.reduce((a, b) => a + b, 0) / altitudes.length).toFixed(2)),
    } : null,
    launches_first: launches.sort()[0] || null,
    launches_last: launches.sort().slice(-1)[0] || null,
  };
}

// ============================================================
//  АНАЛИТИКА
// ============================================================

function computeAltitudeDistribution(rows, buckets = [160, 500, 1000, 2000, 20000, 35786, 35800, 100000]) {
  const dist = {};
  for (let i = 0; i < buckets.length - 1; i++) {
    const key = `${buckets[i]}-${buckets[i + 1]}`;
    dist[key] = { range: [buckets[i], buckets[i + 1]], count: 0, orbit: orbitByAltitude(buckets[i] + 1) };
  }
  dist['other'] = { range: ['<160 или >100000'], count: 0, orbit: 'UNKNOWN' };

  for (const r of rows) {
    if (r.alt_km == null) continue;
    let placed = false;
    for (let i = 0; i < buckets.length - 1; i++) {
      if (r.alt_km >= buckets[i] && r.alt_km < buckets[i + 1]) {
        dist[`${buckets[i]}-${buckets[i + 1]}`].count++;
        placed = true;
        break;
      }
    }
    if (!placed) dist['other'].count++;
  }
  return Object.values(dist).filter(d => d.count > 0);
}

function computeLaunchTimeline(rows) {
  const byDate = {};
  for (const r of rows) {
    if (!r.launch_date) continue;
    if (!byDate[r.launch_date]) byDate[r.launch_date] = { date: r.launch_date, count: 0, satellites: [] };
    byDate[r.launch_date].count++;
    if (byDate[r.launch_date].satellites.length < 20) byDate[r.launch_date].satellites.push(r.name);
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function groupByField(rows, field) {
  const map = {};
  for (const r of rows) {
    const key = r[field];
    if (!key) continue;
    if (!map[key]) map[key] = { name: key, count: 0, orbits: {}, purposes: {}, satellites: [] };
    map[key].count++;
    map[key].orbits[r.orbit] = (map[key].orbits[r.orbit] || 0) + 1;
    map[key].purposes[r.purpose] = (map[key].purposes[r.purpose] || 0) + 1;
    if (map[key].satellites.length < 50) map[key].satellites.push(r.name);
  }
  return Object.values(map).sort((a, b) => b.count - a.count);
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(rows) {
  const features = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat, r.alt_km || 0] },
      properties: {
        id: r.id, name: r.name, norad_id: r.norad_id,
        orbit: r.orbit, orbitLabel: r.orbitLabel, orbitColor: r.orbitColor,
        purpose: r.purpose, purposeLabel: r.purposeLabel, purposeColor: r.purposeColor,
        operator: r.operator, country: r.country, constellation: r.constellation,
        launch_date: r.launch_date, status: r.status, statusColor: r.statusColor,
        alt_km: r.alt_km, velocity_kms: r.velocity_kms, inclination: r.inclination,
        period_min: r.period_min, mass_kg: r.mass_kg,
        category: r.category, icon: r.icon,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    legend: {
      orbits: Object.entries(ORBIT_TYPES).map(([key, def]) => ({ key, ...def })),
      purposes: Object.entries(PURPOSE_CATEGORIES).map(([key, def]) => ({ key, ...def })),
      statuses: Object.entries(STATUS_COLORS).map(([key, color]) => ({ key, color })),
    },
    meta: { total: rows.length, mapped: features.length, unmapped: rows.length - features.length },
  };
}

function toSeries(rows) {
  return rows.map(r => ({
    id: r.id, name: r.name, norad_id: r.norad_id,
    orbit: r.orbit, purpose: r.purpose, country: r.country,
    operator: r.operator, constellation: r.constellation,
    alt_km: r.alt_km, velocity_kms: r.velocity_kms, inclination: r.inclination,
    launch_date: r.launch_date, status: r.status,
  }));
}

function toCSV(rows) {
  const lines = ['id,name,norad_id,orbit,purpose,country,operator,constellation,alt_km,velocity_kms,launch_date,status,lat,lng'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  for (const r of rows) {
    lines.push([r.id, r.name, r.norad_id, r.orbit, r.purpose, r.country, r.operator, r.constellation, r.alt_km, r.velocity_kms, r.launch_date, r.status, r.lat, r.lng].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function toTLE(rows) {
  // Упрощённая форма: name + 2 строки TLE (в реальности — из raw данных)
  const lines = [];
  for (const r of rows) {
    lines.push(r.name);
    lines.push(`1 ${r.norad_id || '00000'}U ${String(r.launch_date || '000101').replace(/-/g, '').slice(2, 8)}   00000.00000000  .00000000  00000-0  00000-0 0  0000`);
    lines.push(`2 ${r.norad_id || '00000'} ${(r.inclination || 0).toFixed(4).padStart(8)} 000.0000 0000000  00000-0  00000-0 0  0000`);
  }
  return lines.join('\n') + '\n';
}

function toRenderConfig(rows) {
  const markers = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      lat: r.lat, lng: r.lng, alt_km: r.alt_km,
      properties: {
        id: r.id, name: r.name, orbit: r.orbit, purpose: r.purpose,
        color: r.orbitColor, status: r.status, country: r.country,
      },
    }));
  return {
    markers,
    orbits: Object.entries(ORBIT_TYPES).map(([key, def]) => ({ key, ...def })),
    filterable: ['orbit', 'purpose', 'country', 'operator', 'status', 'constellation'],
    totals: { markers: markers.length },
  };
}

// ============================================================
//  ОТВЕТЫ
// ============================================================

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
    ...extra,
  });
  res.end(body);
}

function sendText(res, status, text, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text)) });
  res.end(text);
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/satellite/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const { satellites: rawArr, source, meta: srcMeta } = extractSatellites(doc);
    const all = rawArr.map(normalizeSat);

    const extra = {
      'X-Module': 'satellite-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all), source, src_meta: srcMeta }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, {
        status: 'online',
        count: all.length,
        source,
        generated_at: new Date().toISOString(),
      }, extra);
    }
    if (sub === '/latest') {
      const latest = all.slice()
        .filter(r => r.launch_date)
        .sort((a, b) => String(b.launch_date).localeCompare(String(a.launch_date)))
        .slice(0, 20);
      return sendJSON(res, 200, { latest, count: latest.length }, extra);
    }
    if (sub === '/orbits') {
      const byOrbit = {};
      for (const r of all) {
        if (!byOrbit[r.orbit]) byOrbit[r.orbit] = { label: r.orbitLabel, color: r.orbitColor, count: 0, satellites: [] };
        byOrbit[r.orbit].count++;
        if (byOrbit[r.orbit].satellites.length < 50) byOrbit[r.orbit].satellites.push(r.name);
      }
      return sendJSON(res, 200, { orbits: byOrbit, total: Object.keys(byOrbit).length }, extra);
    }
    if (sub === '/countries') {
      const countries = groupByField(all, 'country');
      return sendJSON(res, 200, { countries, total: countries.length }, extra);
    }
    if (sub === '/operators') {
      const operators = groupByField(all, 'operator');
      return sendJSON(res, 200, { operators, total: operators.length }, extra);
    }
    if (sub === '/purposes') {
      const byPurpose = {};
      for (const r of all) {
        if (!byPurpose[r.purpose]) byPurpose[r.purpose] = { label: r.purposeLabel, color: r.purposeColor, count: 0 };
        byPurpose[r.purpose].count++;
      }
      return sendJSON(res, 200, { purposes: byPurpose, total: Object.keys(byPurpose).length }, extra);
    }
    if (sub === '/constellations') {
      const constellations = groupByField(all, 'constellation');
      return sendJSON(res, 200, { constellations, total: constellations.length }, extra);
    }
    if (sub === '/military') {
      const military = all.filter(r => r.purpose === 'military' || r.purpose === 'reconnaissance' || r.purpose === 'sigint' || r.purpose === 'elint');
      return sendJSON(res, 200, { military, total: military.length }, extra);
    }
    if (sub === '/commercial') {
      const commercial = all.filter(r => r.purpose === 'communication' || r.purpose === 'navigation' || r.purpose === 'earth_observation');
      return sendJSON(res, 200, { commercial, total: commercial.length }, extra);
    }
    if (sub === '/launches') {
      const timeline = computeLaunchTimeline(all);
      return sendJSON(res, 200, { timeline, days: timeline.length }, extra);
    }
    if (sub === '/altitude') {
      const dist = computeAltitudeDistribution(all);
      return sendJSON(res, 200, { distribution: dist, total: dist.reduce((s, d) => s + d.count, 0) }, extra);
    }
    if (sub === '/featurecollection') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }
    if (sub === '/render') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, { render: toRenderConfig(rows) }, extra);
    }

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'tle')    return sendText(res, 200, toTLE(rows), 'text/plain; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, source, src_meta: srcMeta }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source,
        category: meta.category,
        unit: meta.unit,
        upstream_source: source,
        upstream_meta: srcMeta,
        total_satellites: all.length,
        returned_satellites: rows.length,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      legend: fc.legend,
      series: toSeries(rows),
      stats: computeStats(rows),
      altitude_distribution: computeAltitudeDistribution(rows),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
