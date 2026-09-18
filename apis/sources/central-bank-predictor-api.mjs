/**
 * apis/sources/central-bank-predictor-api.mjs — API-МОДУЛЬ: ПРЕДСКАЗАТЕЛЬ ЦБ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/forecast/central-bank-predictor.json.
 * Анализатор: scripts/analyzers/central-bank-predictor.mjs.
 *
 * Прогноз решений центральных банков (ставки, QE, комментарии) на основе fred.json.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'forecast', 'central-bank-predictor.json');

export const route  = '/api/layers/central-bank-predictor';
export const method = 'GET';

export const meta = {
  category: 'forecast',
  icon: '🏦',
  color: '#0088ff',
  vizType: 'marker',
  source: 'analytics/forecast/central-bank-predictor.json',
  collector: 'analyzer:central-bank-predictor',
  cache: 3600,
  description: 'Прогноз решений центральных банков (ставки, QE)',
  unit: 'predictions',
};

const BANK_COORDS = {
  'FED':  { lat: 38.8925, lng:  -77.0457, country: 'USA', name: 'Federal Reserve' },
  'ECB':  { lat: 50.1109, lng:    8.6821, country: 'Germany', name: 'ECB' },
  'BOE':  { lat: 51.5074, lng:   -0.1278, country: 'UK', name: 'Bank of England' },
  'BOJ':  { lat: 35.6762, lng:  139.6503, country: 'Japan', name: 'Bank of Japan' },
  'CBR':  { lat: 55.7558, lng:   37.6173, country: 'Russia', name: 'Bank of Russia' },
  'PBOC': { lat: 39.9042, lng:  116.4074, country: 'China', name: 'People\'s Bank of China' },
};

function directionColor(direction) {
  const d = String(direction || '').toLowerCase();
  if (d.includes('hike') || d.includes('повышение')) return '#dc2626';
  if (d.includes('cut') || d.includes('снижение'))  return '#22c55e';
  return '#eab308';
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/central-bank-predictor.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data.predictions)) return data.data.predictions;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (Array.isArray(data.predictions)) return data.predictions;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function normalizeItem(r) {
  const bankKey = String(r.bank || r.central_bank || r.name || '').toUpperCase();
  const loc = BANK_COORDS[bankKey] || null;
  return {
    id: r.id || bankKey || 'unknown',
    name: r.name || loc?.name || bankKey || 'Central bank',
    bank: bankKey,
    currentRate: Number(r.currentRate ?? r.rate ?? 0),
    predictedRate: Number(r.predictedRate ?? r.prediction ?? 0),
    direction: r.direction || 'hold',
    confidence: Number(r.confidence ?? r.score ?? 0.5),
    meetingDate: r.meetingDate || r.nextMeeting || null,
    severity: String(r.severity || r.level || 'info').toLowerCase(),
    lat: Number(r.lat ?? loc?.lat ?? 0),
    lng: Number(r.lng ?? loc?.lng ?? 0),
    country: r.country || loc?.country || null,
    date: r.date || r.timestamp || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.bank) r = r.filter(x => x.bank === String(query.bank).toUpperCase());
  if (query.direction) r = r.filter(x => String(x.direction).toLowerCase() === String(query.direction).toLowerCase());
  if (query.min_confidence != null) { const n = parseFloat(query.min_confidence); if (Number.isFinite(n)) r = r.filter(x => x.confidence >= n); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byDirection = {}, byBank = {};
  for (const r of rows) {
    byDirection[r.direction] = (byDirection[r.direction] || 0) + 1;
    byBank[r.bank] = (byBank[r.bank] || 0) + 1;
  }
  const conf = rows.map(r => r.confidence);
  return {
    count: rows.length,
    avg_confidence: +(conf.reduce((a, b) => a + b, 0) / conf.length).toFixed(3),
    by_direction: byDirection,
    by_bank: byBank,
  };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id, name: r.name, bank: r.bank,
      currentRate: r.currentRate, predictedRate: r.predictedRate,
      direction: r.direction, confidence: r.confidence, meetingDate: r.meetingDate,
      severity: r.severity, country: r.country, date: r.date,
      color: directionColor(r.direction),
      category: 'forecast', icon: meta.icon,
    },
  }));
  return {
    type: 'FeatureCollection',
    directions: [
      { direction: 'hike', label: 'Повышение', color: '#dc2626' },
      { direction: 'hold', label: 'Без изменений', color: '#eab308' },
      { direction: 'cut',  label: 'Снижение', color: '#22c55e' },
    ],
    features,
  };
}

function envelopeMeta(data, full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    total_predictions: full.length, returned_predictions: filtered.length,
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
  const lines = ['id,name,bank,currentRate,predictedRate,direction,confidence,meetingDate'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.bank},${r.currentRate},${r.predictedRate},${r.direction},${r.confidence},${r.meetingDate || ''}`);
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
    const extra = { 'X-Module': 'central-bank-predictor-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(data, full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(data, full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(data, full, rows),
      directions: fc.directions,
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
