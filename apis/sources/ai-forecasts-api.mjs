/**
 * apis/sources/ai-forecasts-api.mjs — API-МОДУЛЬ: AI-ПРОГНОЗЫ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/forecast/ai-forecasts.json.
 * Анализатор: scripts/analyzers/ai-forecasts.mjs.
 *
 * AI-прогнозы на основе strategic-risk-composite. Локальный AI (Ollama) формирует
 * прогнозы по странам и сценариям.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'forecast', 'ai-forecasts.json');

export const route  = '/api/layers/ai-forecasts';
export const method = 'GET';

export const meta = {
  category: 'forecast',
  icon: '🔮',
  color: '#6600cc',
  vizType: 'marker',
  source: 'analytics/forecast/ai-forecasts.json',
  collector: 'analyzer:ai-forecasts',
  cache: 3600,
  description: 'AI-прогнозы (Ollama) на основе strategic-risk-composite',
  unit: 'forecasts',
};

const CONFIDENCE_COLOR = {
  'very_high': '#0d9488', 'high': '#22c55e', 'medium': '#eab308', 'low': '#f97316', 'very_low': '#dc2626',
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/ai-forecasts.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data.forecasts)) return data.data.forecasts;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (Array.isArray(data.forecasts)) return data.forecasts;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function normalizeItem(r) {
  return {
    id: r.id || r.iso || r.name || 'unknown',
    name: r.name || r.country || r.region || 'Unknown',
    iso: r.iso || r.code || null,
    forecast: r.forecast || r.text || r.prediction || null,
    direction: r.direction || r.trend || 'unknown',
    confidence: Number(r.confidence ?? r.score ?? 0.5),
    horizon: r.horizon || r.period || null,
    severity: String(r.severity || r.level || 'info').toLowerCase(),
    lat: Number(r.lat ?? r.latitude ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
    date: r.date || r.timestamp || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.direction) r = r.filter(x => x.direction === String(query.direction).toLowerCase());
  if (query.horizon) { const h = String(query.horizon).toLowerCase(); r = r.filter(x => (x.horizon || '').toLowerCase().includes(h)); }
  if (query.min_confidence != null) { const n = parseFloat(query.min_confidence); if (Number.isFinite(n)) r = r.filter(x => x.confidence >= n); }
  if (query.iso) r = r.filter(x => (x.iso || '').toLowerCase() === String(query.iso).toLowerCase());
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q) || (x.forecast || '').toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const conf = rows.map(r => r.confidence);
  const byDirection = {}, byConfidence = {};
  for (const r of rows) {
    byDirection[r.direction] = (byDirection[r.direction] || 0) + 1;
    const lvl = r.confidence >= 0.8 ? 'very_high' : r.confidence >= 0.6 ? 'high' : r.confidence >= 0.4 ? 'medium' : r.confidence >= 0.2 ? 'low' : 'very_low';
    byConfidence[lvl] = (byConfidence[lvl] || 0) + 1;
  }
  const top5 = rows.slice().sort((a, b) => b.confidence - a.confidence).slice(0, 5).map(r => ({ name: r.name, confidence: r.confidence }));
  return {
    count: rows.length,
    max_confidence: Math.max(...conf),
    avg_confidence: +(conf.reduce((a, b) => a + b, 0) / conf.length).toFixed(3),
    by_direction: byDirection,
    by_confidence: byConfidence,
    top_5: top5,
  };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => {
    const lvl = r.confidence >= 0.8 ? 'very_high' : r.confidence >= 0.6 ? 'high' : r.confidence >= 0.4 ? 'medium' : r.confidence >= 0.2 ? 'low' : 'very_low';
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, iso: r.iso,
        forecast: r.forecast, direction: r.direction, confidence: r.confidence, horizon: r.horizon,
        severity: r.severity, date: r.date,
        confidenceLevel: lvl, color: CONFIDENCE_COLOR[lvl],
        category: 'forecast', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    levels: Object.entries(CONFIDENCE_COLOR).map(([level, color]) => ({ level, color })),
    features,
  };
}

function envelopeMeta(data, full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    total_forecasts: full.length, returned_forecasts: filtered.length,
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
  const lines = ['id,name,iso,direction,confidence,horizon'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.iso || ''},${r.direction},${r.confidence},${r.horizon || ''}`);
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
    const extra = { 'X-Module': 'ai-forecasts-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(data, full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(data, full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(data, full, rows),
      levels: fc.levels,
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
