/**
 * apis/sources/instability-index-api.mjs — API-МОДУЛЬ: ИНДЕКС НЕСТАБИЛЬНОСТИ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/instability-index.json — [{ id, name, region, index, change?, tier?, lat, lng, drivers[], date }] ИЛИ { data:[...] } ИЛИ { index:number, regions:[...] }.
 * Сборщик: scripts/collectors/collect-instability-index.mjs.
 *
 * Сводный индекс нестабильности по регионам и странам (0-100).
 * Компоненты: конфликт, экономика, соц. напряжённость, экология.
 * Геокоординаты — из файла или из встроенного справочника регионов.
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?region=, ?tier=, ?min=, ?max=, ?q=, ?since=, ?limit=, ?top=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /stats /status /top /critical /regions /tiers /featurecollection /builtin
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'instability-index.json');

export const route  = '/api/layers/instability-index';
export const method = 'GET';

export const meta = {
  category: 'geopolitical',
  icon: '⚠️',
  color: '#dc2626',
  vizType: 'choropleth',
  source: 'basket/instability-index.json',
  collector: 'collect-instability-index.mjs',
  cache: 300,
  description: 'Сводный индекс нестабильности по регионам и странам (0–100)',
  unit: 'index',
};

const REGION_COORDS = {
  'Middle East': [31.0, 40.0], 'Ближний Восток': [31.0, 40.0],
  'Eastern Europe': [50.0, 30.0], 'Восточная Европа': [50.0, 30.0],
  'South China Sea': [12.0, 115.0], 'Южно-Китайское море': [12.0, 115.0],
  'Sahel': [15.0, 0.0], 'Сахель': [15.0, 0.0],
  'Horn of Africa': [8.0, 45.0], 'Африканский Рог': [8.0, 45.0],
  'Central Asia': [45.0, 65.0], 'Центральная Азия': [45.0, 65.0],
  'South Asia': [20.0, 78.0], 'Южная Азия': [20.0, 78.0],
  'Latin America': [-15.0, -60.0], 'Латинская Америка': [-15.0, -60.0],
  'North Africa': [30.0, 15.0], 'Северная Африка': [30.0, 15.0],
  'West Africa': [10.0, -5.0], 'Западная Африка': [10.0, -5.0],
  'Caucasus': [42.0, 44.0], 'Кавказ': [42.0, 44.0],
  'Balkans': [43.0, 21.0], 'Балканы': [43.0, 21.0],
  'Southeast Asia': [10.0, 110.0], 'Юго-Восточная Азия': [10.0, 110.0],
  'Arctic': [75.0, 0.0], 'Арктика': [75.0, 0.0],
  'Global': [0.0, 0.0], 'GLOBAL': [0.0, 0.0],
};

const TIERS = {
  critical: { min: 80, color: '#dc2626', label: 'Критический' },
  high:     { min: 60, color: '#f97316', label: 'Высокий' },
  elevated: { min: 40, color: '#eab308', label: 'Повышенный' },
  moderate: { min: 20, color: '#84cc16', label: 'Умеренный' },
  low:      { min: 0,  color: '#22c55e', label: 'Низкий' },
};

function tierOf(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return { key: 'unknown', color: '#64748b', label: 'Нет данных' };
  for (const [k, def] of Object.entries(TIERS)) if (n >= def.min) return { key: k, ...def };
  return { key: 'low', ...TIERS.low };
}

// Встроенный fallback (используется только в /builtin, не подменяет данные)
const BUILTIN_REGIONS = [
  { id: 'middle-east', name: 'Middle East', region: 'Middle East', index: 72, tier: 'high', drivers: ['conflict', 'energy'] },
  { id: 'eastern-europe', name: 'Eastern Europe', region: 'Eastern Europe', index: 68, tier: 'high', drivers: ['conflict', 'sanctions'] },
  { id: 'south-china-sea', name: 'South China Sea', region: 'South China Sea', index: 55, tier: 'elevated', drivers: ['territorial', 'military'] },
  { id: 'sahel', name: 'Sahel', region: 'Sahel', index: 78, tier: 'high', drivers: ['conflict', 'terrorism'] },
  { id: 'horn-of-africa', name: 'Horn of Africa', region: 'Horn of Africa', index: 65, tier: 'high', drivers: ['conflict', 'drought'] },
];

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-instability-index.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  return parsed;
}

function extractRows(doc) {
  // Варианты: массив / {data:[]} / {regions:[]} / {index, regions:[string]} / {items:[]}
  if (Array.isArray(doc)) return doc;
  if (doc && Array.isArray(doc.data)) return doc.data;
  if (doc && Array.isArray(doc.items)) return doc.items;
  if (doc && Array.isArray(doc.regions)) {
    // Если regions — массив строк, конвертируем в объекты с общим index
    if (typeof doc.regions[0] === 'string') {
      const baseIndex = Number(doc.index) || 50;
      return doc.regions.map((r, i) => ({ id: `r-${i}`, name: r, region: r, index: baseIndex }));
    }
    return doc.regions;
  }
  return [];
}

function normalizeRow(r, i) {
  const region = r.region || r.name || r.id || 'Unknown';
  const index = Number(r.index ?? r.value ?? r.score);
  const coords = (Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng)))
    ? [Number(r.lat), Number(r.lng)]
    : (REGION_COORDS[region] || REGION_COORDS['Global']);
  const t = tierOf(index);
  return {
    id: String(r.id || `reg-${i}`),
    name: r.name || region,
    region,
    index: Number.isFinite(index) ? index : null,
    change: r.change != null ? Number(r.change) : null,
    tier: r.tier || t.key,
    tierLabel: t.label,
    color: t.color,
    drivers: Array.isArray(r.drivers) ? r.drivers : [],
    date: String(r.date || r.timestamp || '').slice(0, 10) || null,
    lat: coords[0],
    lng: coords[1],
    category: 'geopolitical',
    icon: meta.icon,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.region) r = r.filter(x => String(x.region).toLowerCase().includes(String(query.region).toLowerCase()));
  if (query.tier)   r = r.filter(x => x.tier === String(query.tier));
  if (query.q)      r = r.filter(x => String(x.name + ' ' + x.region).toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.min != null) { const n = Number(query.min); if (Number.isFinite(n)) r = r.filter(x => x.index != null && x.index >= n); }
  if (query.max != null) { const n = Number(query.max); if (Number.isFinite(n)) r = r.filter(x => x.index != null && x.index <= n); }
  if (query.since) r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  const sortKey = query.sort || 'index-desc';
  if (sortKey === 'index-desc') r.sort((a, b) => (b.index ?? 0) - (a.index ?? 0));
  else if (sortKey === 'index-asc') r.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  else if (sortKey === 'name') r.sort((a, b) => a.name.localeCompare(b.name));
  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  const values = rows.map(r => r.index).filter(Number.isFinite);
  const byTier = {};
  const byRegion = {};
  for (const r of rows) {
    byTier[r.tier] = (byTier[r.tier] || 0) + 1;
    if (r.region) byRegion[r.region] = (byRegion[r.region] || 0) + 1;
  }
  const top = (obj, n = 10) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
  if (values.length === 0) return { count: rows.length, by_tier: byTier, by_region: byRegion };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return {
    count: rows.length,
    mean: Number(mean.toFixed(2)),
    median: Number(sorted[Math.floor(sorted.length/2)].toFixed(2)),
    min: Number(Math.min(...values).toFixed(2)),
    max: Number(Math.max(...values).toFixed(2)),
    by_tier: byTier,
    top_regions: top(byRegion, 10),
    highest: rows.slice().sort((a, b) => (b.index ?? 0) - (a.index ?? 0))[0] || null,
    lowest: rows.slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0] || null,
  };
}

function toFeatureCollection(rows) {
  const features = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, region: r.region, index: r.index, change: r.change,
        tier: r.tier, tierLabel: r.tierLabel, color: r.color,
        drivers: r.drivers, date: r.date,
        category: r.category, icon: r.icon,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    legend: Object.entries(TIERS).map(([key, def]) => ({ key, ...def })),
    meta: { total: rows.length, mapped: features.length },
  };
}

function toSeries(rows) { return rows.map(r => ({ id: r.id, name: r.name, region: r.region, index: r.index, tier: r.tier, date: r.date })); }

function toCSV(rows) {
  const lines = ['id,name,region,index,tier,change,lat,lng,date'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const r of rows) lines.push([r.id, r.name, r.region, r.index, r.tier, r.change, r.lat, r.lng, r.date].map(esc).join(','));
  return lines.join('\n') + '\n';
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(body)), ...extra });
  res.end(body);
}

function sendText(res, status, text, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text)) });
  res.end(text);
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/instability-index/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const extra = {
      'X-Module': 'instability-index-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    // /builtin — не требует basket (встроенный fallback)
    if (sub === '/builtin') {
      const rows = BUILTIN_REGIONS.map(normalizeRow);
      return sendJSON(res, 200, {
        type: 'FeatureCollection',
        features: toFeatureCollection(rows).features,
        meta: { source: 'builtin', count: rows.length },
        series: toSeries(rows),
        stats: computeStats(rows),
      }, extra);
    }

    const doc = await loadData();
    const rawArr = extractRows(doc);
    const all = rawArr.map(normalizeRow);

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all) }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, { status: 'online', count: all.length, generated_at: new Date().toISOString() }, extra);
    }
    if (sub === '/top') {
      const top = all.slice().sort((a, b) => (b.index ?? 0) - (a.index ?? 0)).slice(0, 10);
      return sendJSON(res, 200, { top, count: top.length }, extra);
    }
    if (sub === '/critical') {
      const crit = all.filter(r => r.tier === 'critical' || r.tier === 'high');
      return sendJSON(res, 200, { critical: crit, total: crit.length }, extra);
    }
    if (sub === '/regions') {
      const byRegion = {};
      for (const r of all) {
        if (!byRegion[r.region]) byRegion[r.region] = [];
        byRegion[r.region].push({ id: r.id, name: r.name, index: r.index, tier: r.tier });
      }
      return sendJSON(res, 200, { regions: byRegion, total: Object.keys(byRegion).length }, extra);
    }
    if (sub === '/tiers') {
      const byTier = {};
      for (const r of all) {
        if (!byTier[r.tier]) byTier[r.tier] = [];
        byTier[r.tier].push({ id: r.id, name: r.name, index: r.index });
      }
      return sendJSON(res, 200, { tiers: byTier, total: Object.keys(byTier).length }, extra);
    }
    if (sub === '/featurecollection') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, meta: { total: all.length } }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_records: all.length, returned_records: rows.length,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      legend: fc.legend,
      series: toSeries(rows),
      stats: computeStats(rows),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
