/**
 * apis/sources/fx-reserves-monitor-api.mjs — API-МОДУЛЬ: МОНИТОР ВАЛЮТНЫХ РЕЗЕРВОВ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/market/fx-reserves-monitor.json.
 * Анализатор: scripts/analyzers/fx-reserves-monitor.mjs.
 *
 * Мониторинг валютных резервов центральных банков. Показывает изменения резервов.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'market', 'fx-reserves-monitor.json');

export const route  = '/api/layers/fx-reserves-monitor';
export const method = 'GET';

export const meta = {
  category: 'market',
  icon: '💰',
  color: '#0088ff',
  vizType: 'marker',
  source: 'analytics/market/fx-reserves-monitor.json',
  collector: 'analyzer:fx-reserves-monitor',
  cache: 3600,
  description: 'Монитор валютных резервов центральных банков',
  unit: 'USD',
};

const COUNTRY_COORDS = {
  'China':         { lat: 39.9042, lng: 116.4074 }, 'Japan':     { lat: 35.6762, lng: 139.6503 },
  'Switzerland':   { lat: 46.9481, lng:   7.4474 }, 'Russia':    { lat: 55.7558, lng:  37.6173 },
  'India':         { lat: 28.6139, lng:  77.2090 }, 'Taiwan':    { lat: 25.0330, lng: 121.5654 },
  'Saudi Arabia':  { lat: 24.7136, lng:  46.6753 }, 'South Korea':{ lat: 37.5665, lng: 126.9780 },
  'Brazil':        { lat: -15.7975, lng: -47.8919 }, 'Singapore': { lat:  1.3521, lng: 103.8198 },
  'Germany':       { lat: 52.5200, lng:  13.4050 }, 'France':    { lat: 48.8566, lng:   2.3522 },
  'United States': { lat: 38.9072, lng: -77.0369 }, 'United Kingdom': { lat: 51.5074, lng: -0.1278 },
};

function reservesBand(value) {
  if (value >= 1000) return { level: 'mega',     color: '#0d9488', label: 'Мега (1000+)' };
  if (value >= 500)  return { level: 'huge',     color: '#22c55e', label: 'Очень крупные (500+)' };
  if (value >= 200)  return { level: 'large',    color: '#84cc16', label: 'Крупные (200+)' };
  if (value >= 100)  return { level: 'medium',   color: '#eab308', label: 'Средние (100+)' };
  if (value >= 50)   return { level: 'small',    color: '#f97316', label: 'Небольшие (50+)' };
  return                    { level: 'minimal',  color: '#dc2626', label: 'Минимальные' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/fx-reserves-monitor.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data.countries)) return data.data.countries;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (Array.isArray(data.countries)) return data.countries;
  if (Array.isArray(data.items)) return data.items;
  if (data.data && typeof data.data === 'object') {
    return Object.entries(data.data).map(([key, val]) => {
      if (val && typeof val === 'object') return { name: key, ...val };
      return { name: key, value: val };
    });
  }
  return [];
}

function normalizeItem(r) {
  const name = r.name || r.country || 'Unknown';
  const coords = COUNTRY_COORDS[name] || null;
  return {
    id: r.id || r.iso || name,
    name,
    iso: r.iso || null,
    value: Number(r.value ?? r.reserves ?? r.total ?? 0),
    unit: r.unit || 'млрд USD',
    change: r.change != null ? Number(r.change) : null,
    changePct: r.changePct != null ? Number(r.changePct) : null,
    severity: String(r.severity || 'info').toLowerCase(),
    lat: Number(r.lat ?? coords?.lat ?? 0),
    lng: Number(r.lng ?? r.lon ?? coords?.lng ?? 0),
    date: r.date || r.timestamp || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.min_value != null) { const n = parseFloat(query.min_value); if (Number.isFinite(n)) r = r.filter(x => x.value >= n); }
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(c)); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const v = rows.map(r => r.value);
  const total = v.reduce((a, b) => a + b, 0);
  const byBand = {};
  for (const r of rows) { const b = reservesBand(r.value).level; byBand[b] = (byBand[b] || 0) + 1; }
  const top5 = rows.slice().sort((a, b) => b.value - a.value).slice(0, 5).map(r => ({ name: r.name, value: r.value }));
  return {
    count: rows.length,
    total_reserves: +total.toFixed(2),
    max: Math.max(...v),
    min: Math.min(...v),
    avg: +(total / v.length).toFixed(2),
    by_band: byBand,
    top_5: top5,
  };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => {
    const b = reservesBand(r.value);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, iso: r.iso, value: r.value, unit: r.unit,
        change: r.change, changePct: r.changePct, severity: r.severity, date: r.date,
        band: b.level, bandLabel: b.label, color: b.color,
        category: 'market', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'mega',    label: 'Мега (1000+)',         color: '#0d9488' },
      { level: 'huge',    label: 'Очень крупные (500+)', color: '#22c55e' },
      { level: 'large',   label: 'Крупные (200+)',       color: '#84cc16' },
      { level: 'medium',  label: 'Средние (100+)',       color: '#eab308' },
      { level: 'small',   label: 'Небольшие (50+)',      color: '#f97316' },
      { level: 'minimal', label: 'Минимальные (<50)',    color: '#dc2626' },
    ],
    features,
  };
}

function envelopeMeta(data, full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    total_countries: full.length, returned_countries: filtered.length,
    with_coords: filtered.filter(r => r.lat !== 0 || r.lng !== 0).length,
  };
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
function toCSVBody(rows) {
  const lines = ['id,name,iso,value,unit,band'];
  for (const r of rows) { const b = reservesBand(r.value); lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.iso || ''},${r.value},${r.unit},${b.level}`); }
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const data = await loadData();
    const rawItems = extractItems(data);
    const full = rawItems.map(normalizeItem);
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'fx-reserves-monitor-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(data, full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(data, full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(data, full, rows),
      bands: fc.bands,
      features: fc.features,
      items: rows,
      stats,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
