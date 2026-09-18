/**
 * apis/sources/resilience-index-api.mjs — API-МОДУЛЬ: RESILIENCE INDEX
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/index/resilience-index.json — результат анализатора v1.2.0.
 * Анализатор: scripts/analyzers/resilience-index.mjs.
 *
 * Индекс устойчивости стран (131 страна, 28 уникальных баллов). v1.2.0 — читает 6 источников.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'index', 'resilience-index.json');

export const route  = '/api/layers/resilience-index';
export const method = 'GET';

export const meta = {
  category: 'index',
  icon: '🛡️',
  color: '#00cc66',
  vizType: 'choropleth',
  source: 'analytics/index/resilience-index.json',
  collector: 'analyzer:resilience-index',
  cache: 600,
  description: 'Индекс устойчивости стран — v1.2.0',
  unit: 'index',
};

function resilienceBand(value) {
  if (value >= 80) return { level: 'very_high', color: '#0d9488', label: 'Очень высокая' };
  if (value >= 60) return { level: 'high',      color: '#22c55e', label: 'Высокая' };
  if (value >= 40) return { level: 'medium',    color: '#eab308', label: 'Средняя' };
  if (value >= 20) return { level: 'low',       color: '#f97316', label: 'Низкая' };
  return                 { level: 'very_low',  color: '#dc2626', label: 'Очень низкая' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/resilience-index.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (data.data && Array.isArray(data.data.countries)) return data.data.countries;
  if (Array.isArray(data.countries)) return data.countries;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function normalizeItem(r) {
  const imputed = r.imputedFields || r.imputed_fields || null;
  return {
    id: r.id || r.iso || r.code || 'unknown',
    name: r.name || r.country || 'Unknown',
    iso: r.iso || r.code || null,
    score: Number(r.score ?? r.resilience ?? r.value ?? r.index ?? 0),
    regime: r.regime || null,
    region: r.region || null,
    imputedFields: imputed,
    lat: Number(r.lat ?? r.latitude ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
    date: r.date || r.timestamp || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.regime) { const g = String(query.regime).toLowerCase(); r = r.filter(x => (x.regime || '').toLowerCase().includes(g)); }
  if (query.region) { const g = String(query.region).toLowerCase(); r = r.filter(x => (x.region || '').toLowerCase().includes(g)); }
  if (query.iso) r = r.filter(x => (x.iso || '').toUpperCase() === String(query.iso).toUpperCase());
  if (query.min_score != null) { const n = parseFloat(query.min_score); if (Number.isFinite(n)) r = r.filter(x => x.score >= n); }
  if (query.max_score != null) { const n = parseFloat(query.max_score); if (Number.isFinite(n)) r = r.filter(x => x.score <= n); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const v = rows.map(r => r.score);
  const min = Math.min(...v), max = Math.max(...v);
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  const byBand = {};
  const uniqueScores = new Set(v);
  for (const r of rows) { const b = resilienceBand(r.score).level; byBand[b] = (byBand[b] || 0) + 1; }
  const top5 = rows.slice().sort((a, b) => b.score - a.score).slice(0, 5).map(r => ({ name: r.name, iso: r.iso, score: r.score }));
  const bottom5 = rows.slice().sort((a, b) => a.score - b.score).slice(0, 5).map(r => ({ name: r.name, iso: r.iso, score: r.score }));
  return {
    count: rows.length,
    min: +min.toFixed(2), max: +max.toFixed(2), avg: +avg.toFixed(2),
    unique_scores: uniqueScores.size,
    by_band: byBand,
    top_5: top5,
    bottom_5: bottom5,
  };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => {
    const b = resilienceBand(r.score);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, iso: r.iso,
        score: r.score, regime: r.regime, region: r.region,
        imputedFields: r.imputedFields, date: r.date,
        band: b.level, bandLabel: b.label, color: b.color,
        category: 'index', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'very_high', label: 'Очень высокая (80+)', color: '#0d9488' },
      { level: 'high',      label: 'Высокая (60+)',        color: '#22c55e' },
      { level: 'medium',    label: 'Средняя (40+)',        color: '#eab308' },
      { level: 'low',       label: 'Низкая (20+)',         color: '#f97316' },
      { level: 'very_low',  label: 'Очень низкая (<20)',   color: '#dc2626' },
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
  const lines = ['iso,name,score,band,regime,region'];
  for (const r of rows) { const b = resilienceBand(r.score); lines.push(`${r.iso || ''},"${r.name.replace(/"/g, '""')}",${r.score},${b.level},${r.regime || ''},${r.region || ''}`); }
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
    const extra = { 'X-Module': 'resilience-index-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
