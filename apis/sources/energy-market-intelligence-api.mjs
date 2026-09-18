/**
 * apis/sources/energy-market-intelligence-api.mjs — API-МОДУЛЬ: ЭНЕРГОРЫНОЧНАЯ РАЗВЕДКА
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/market/energy-market-intelligence.json.
 * Анализатор: scripts/analyzers/energy-market-intelligence.mjs.
 *
 * Разведка энергетического рынка: цены, потоки, напряжения в поставках.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'market', 'energy-market-intelligence.json');

export const route  = '/api/layers/energy-market-intelligence';
export const method = 'GET';

export const meta = {
  category: 'market',
  icon: '⛽',
  color: '#ff8800',
  vizType: 'marker',
  source: 'analytics/market/energy-market-intelligence.json',
  collector: 'analyzer:energy-market-intelligence',
  cache: 300,
  description: 'Разведка энергетического рынка (цены, потоки, напряжения поставок)',
  unit: 'signals',
};

const ENERGY_LOCATIONS = {
  'oil':     { lat: 29.7604, lng:  -95.3698, name: 'Нефть (Хьюстон)' },
  'gas':     { lat: 51.5074, lng:   -0.1278, name: 'Газ (London)' },
  'lng':     { lat: 25.2048, lng:   55.2708, name: 'СПГ (Dubai)' },
  'coal':    { lat: 39.9042, lng:  116.4074, name: 'Уголь (China)' },
  'uranium': { lat: 43.6532, lng:  -79.3832, name: 'Уран (Toronto)' },
  'power':   { lat: 50.1109, lng:    8.6821, name: 'Электроэнергия (EU)' },
};

function signalColor(sev) {
  const m = { 'info': '#22c55e', 'low': '#84cc16', 'medium': '#eab308', 'high': '#f97316', 'critical': '#dc2626' };
  return m[String(sev || 'info').toLowerCase()] || m.info;
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/energy-market-intelligence.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data.signals)) return data.data.signals;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (data.data && Array.isArray(data.data.prices)) return data.data.prices;
  if (Array.isArray(data.signals)) return data.signals;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.prices)) return data.prices;
  if (data.data && typeof data.data === 'object') {
    return Object.entries(data.data).map(([key, val]) => {
      if (val && typeof val === 'object') return { name: key, ...val };
      return { name: key, value: val };
    });
  }
  return [];
}

function normalizeItem(r) {
  const key = String(r.name || r.indicator || r.type || 'unknown').toLowerCase();
  const loc = ENERGY_LOCATIONS[key] || null;
  return {
    id: r.id || key,
    name: r.name || loc?.name || key,
    value: Number(r.value ?? r.price ?? r.current ?? 0),
    unit: r.unit || null,
    previous: r.previous != null ? Number(r.previous) : null,
    change: r.change != null ? Number(r.change) : null,
    severity: String(r.severity || r.level || 'info').toLowerCase(),
    lat: Number(r.lat ?? loc?.lat ?? 0),
    lng: Number(r.lng ?? r.lon ?? loc?.lng ?? 0),
    date: r.date || r.timestamp || null,
    message: r.message || r.description || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.indicator) { const i = String(query.indicator).toLowerCase(); r = r.filter(x => x.id.toLowerCase().includes(i) || x.name.toLowerCase().includes(i)); }
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.min_value != null) { const n = parseFloat(query.min_value); if (Number.isFinite(n)) r = r.filter(x => x.value >= n); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const bySeverity = {};
  for (const r of rows) bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
  return { count: rows.length, by_severity: bySeverity };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id, name: r.name, value: r.value, unit: r.unit,
      previous: r.previous, change: r.change, severity: r.severity,
      message: r.message, date: r.date,
      color: signalColor(r.severity),
      category: 'market', icon: meta.icon,
    },
  }));
  return { type: 'FeatureCollection', features };
}

function envelopeMeta(data, full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    total_signals: full.length, returned_signals: filtered.length,
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
  const lines = ['id,name,value,unit,severity,message'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.value},${r.unit || ''},${r.severity},"${(r.message || '').replace(/"/g, '""')}"`);
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
    const extra = { 'X-Module': 'energy-market-intelligence-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(data, full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(data, full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(data, full, rows),
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
