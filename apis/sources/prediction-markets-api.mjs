/**
 * apis/sources/prediction-markets-api.mjs — API-МОДУЛЬ: РЫНКИ ПРЕДСКАЗАНИЙ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/market/prediction-markets.json.
 * Анализатор: scripts/analyzers/prediction-markets.mjs.
 *
 * Прогнозы с рынков предсказаний (Polymarket, Metaculus, Kalshi).
 * Показывают коллективную оценку вероятностей будущих событий.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'market', 'prediction-markets.json');

export const route  = '/api/layers/prediction-markets';
export const method = 'GET';

export const meta = {
  category: 'market',
  icon: '🎲',
  color: '#8b5cf6',
  vizType: 'marker',
  source: 'analytics/market/prediction-markets.json',
  collector: 'analyzer:prediction-markets',
  cache: 300,
  description: 'Прогнозы с рынков предсказаний (Polymarket, Metaculus, Kalshi)',
  unit: 'probability',
};

function probabilityBand(prob) {
  if (prob >= 0.9) return { level: 'almost_certain', color: '#0d9488', label: 'Почти наверняка' };
  if (prob >= 0.7) return { level: 'likely',         color: '#22c55e', label: 'Вероятно' };
  if (prob >= 0.5) return { level: 'more_likely',    color: '#84cc16', label: 'Скорее да' };
  if (prob >= 0.3) return { level: 'less_likely',    color: '#eab308', label: 'Скорее нет' };
  if (prob >= 0.1) return { level: 'unlikely',       color: '#f97316', label: 'Маловероятно' };
  return                  { level: 'very_unlikely', color: '#dc2626', label: 'Очень маловероятно' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/prediction-markets.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data.markets)) return data.data.markets;
  if (data.data && Array.isArray(data.data.predictions)) return data.data.predictions;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (Array.isArray(data.markets)) return data.markets;
  if (Array.isArray(data.predictions)) return data.predictions;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function normalizeItem(r) {
  const prob = Number(r.probability ?? r.prob ?? r.value ?? r.odds ?? 0);
  return {
    id: r.id || r.market_id || 'unknown',
    name: r.name || r.title || r.question || 'Prediction',
    probability: prob,
    category: r.category || r.type || null,
    source: r.source || r.platform || null,
    volume: r.volume != null ? Number(r.volume) : null,
    change: r.change != null ? Number(r.change) : null,
    severity: String(r.severity || r.level || 'info').toLowerCase(),
    lat: Number(r.lat ?? r.latitude ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
    region: r.region || r.country || null,
    resolveDate: r.resolveDate || r.deadline || null,
    date: r.date || r.timestamp || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.category) { const c = String(query.category).toLowerCase(); r = r.filter(x => (x.category || '').toLowerCase().includes(c)); }
  if (query.source) { const s = String(query.source).toLowerCase(); r = r.filter(x => (x.source || '').toLowerCase().includes(s)); }
  if (query.min_prob != null) { const n = parseFloat(query.min_prob); if (Number.isFinite(n)) r = r.filter(x => x.probability >= n); }
  if (query.max_prob != null) { const n = parseFloat(query.max_prob); if (Number.isFinite(n)) r = r.filter(x => x.probability <= n); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const probs = rows.map(r => r.probability);
  const byBand = {}, byCategory = {};
  for (const r of rows) {
    const b = probabilityBand(r.probability).level;
    byBand[b] = (byBand[b] || 0) + 1;
    if (r.category) byCategory[r.category] = (byCategory[r.category] || 0) + 1;
  }
  const top5 = rows.slice().sort((a, b) => Math.abs(b.probability - 0.5) - Math.abs(a.probability - 0.5))
    .slice(0, 5).map(r => ({ name: r.name, probability: r.probability }));
  return {
    count: rows.length,
    max_prob: Math.max(...probs),
    min_prob: Math.min(...probs),
    avg_prob: +(probs.reduce((a, b) => a + b, 0) / probs.length).toFixed(3),
    by_band: byBand,
    by_category: byCategory,
    top_5: top5,
  };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => {
    const b = probabilityBand(r.probability);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, probability: r.probability,
        category: r.category, source: r.source, volume: r.volume, change: r.change,
        severity: r.severity, region: r.region, resolveDate: r.resolveDate, date: r.date,
        band: b.level, bandLabel: b.label, color: b.color,
        category_layer: 'market', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'almost_certain', label: 'Почти наверняка (90%+)',  color: '#0d9488' },
      { level: 'likely',         label: 'Вероятно (70%+)',         color: '#22c55e' },
      { level: 'more_likely',    label: 'Скорее да (50%+)',        color: '#84cc16' },
      { level: 'less_likely',    label: 'Скорее нет (30%+)',       color: '#eab308' },
      { level: 'unlikely',       label: 'Маловероятно (10%+)',     color: '#f97316' },
      { level: 'very_unlikely',  label: 'Очень маловероятно (<10%)',color: '#dc2626' },
    ],
    features,
  };
}

function envelopeMeta(data, full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    total_markets: full.length, returned_markets: filtered.length,
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
  const lines = ['id,name,category,probability,source,volume,resolveDate'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.category || ''},${r.probability},${r.source || ''},${r.volume ?? ''},${r.resolveDate || ''}`);
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
    const extra = { 'X-Module': 'prediction-markets-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
