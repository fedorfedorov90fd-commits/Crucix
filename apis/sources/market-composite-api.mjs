/**
 * apis/sources/market-composite-api.mjs — API-МОДУЛЬ: РЫНОЧНЫЙ КОМПОЗИТ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/market/market-composite.json.
 * Анализатор: scripts/analyzers/market-composite.mjs.
 *
 * Глобальный композит рынка: VIX + OIL + GOLD + DXY. Сводит в один индекс
 * уровень стресса финансовых рынков.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'market', 'market-composite.json');

export const route  = '/api/layers/market-composite';
export const method = 'GET';

export const meta = {
  category: 'market',
  icon: '📊',
  color: '#ff4400',
  vizType: 'marker',
  source: 'analytics/market/market-composite.json',
  collector: 'analyzer:market-composite',
  cache: 300,
  description: 'Рыночный композит — VIX + OIL + GOLD + DXY в едином индексе',
  unit: 'index',
};

function marketBand(value) {
  if (value >= 80) return { level: 'crisis',     color: '#7f1d1d', label: 'Кризис' };
  if (value >= 60) return { level: 'stress',     color: '#dc2626', label: 'Стресс' };
  if (value >= 40) return { level: 'elevated',   color: '#f97316', label: 'Повышенный' };
  if (value >= 20) return { level: 'moderate',   color: '#eab308', label: 'Средний' };
  return                 { level: 'calm',       color: '#22c55e', label: 'Спокойствие' };
}

const REFERENCE_POINTS = [
  { name: 'NYSE New York',     lat: 40.7069, lng: -74.0113, market: 'US' },
  { name: 'LSE London',        lat: 51.5133, lng:  -0.0890, market: 'UK' },
  { name: 'TSE Tokyo',         lat: 35.6812, lng: 139.7671, market: 'JP' },
  { name: 'SSE Shanghai',      lat: 31.2304, lng: 121.4737, market: 'CN' },
  { name: 'B3 São Paulo',      lat: -23.5505, lng: -46.6333, market: 'BR' },
  { name: 'Deutsche Börse',    lat: 50.1109, lng:   8.6821, market: 'DE' },
];

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/market-composite.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function getGlobalValue(data) {
  if (!data) return null;
  if (data.data && data.data.composite != null) return Number(data.data.composite);
  if (data.data && data.data.value != null)     return Number(data.data.value);
  if (data.composite != null) return Number(data.composite);
  if (data.value != null)     return Number(data.value);
  if (data.data && data.data.global != null)    return Number(data.data.global);
  return null;
}

function toFeatureCollection(data) {
  const value = getGlobalValue(data);
  if (value == null) return { type: 'FeatureCollection', features: [] };
  const b = marketBand(value);
  const features = REFERENCE_POINTS.map(p => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    properties: {
      name: p.name,
      market: p.market,
      composite: value,
      band: b.level, bandLabel: b.label, color: b.color,
      category: 'market', icon: meta.icon,
    },
  }));
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'crisis',   label: 'Кризис (80+)',      color: '#7f1d1d' },
      { level: 'stress',   label: 'Стресс (60+)',      color: '#dc2626' },
      { level: 'elevated', label: 'Повышенный (40+)',  color: '#f97316' },
      { level: 'moderate', label: 'Средний (20+)',     color: '#eab308' },
      { level: 'calm',     label: 'Спокойствие (<20)', color: '#22c55e' },
    ],
    features,
  };
}

function envelopeMeta(data, value) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    composite_value: value,
    band: value != null ? marketBand(value).level : null,
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

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const data = await loadData();
    const value = getGlobalValue(data);
    const extra = { 'X-Module': 'market-composite-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') {
      const csv = `composite\n${value ?? ''}\n`;
      return sendText(res, 200, csv, 'text/csv; charset=utf-8');
    }
    if (format === 'stats' || format === 'raw') {
      return sendJSON(res, 200, { composite: value, band: value != null ? marketBand(value).level : null, meta: envelopeMeta(data, value) }, extra);
    }

    const fc = toFeatureCollection(data);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(data, value),
      bands: fc.bands,
      features: fc.features,
      composite: value,
      band: value != null ? marketBand(value).level : null,
      bandLabel: value != null ? marketBand(value).label : null,
      color: value != null ? marketBand(value).color : null,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
