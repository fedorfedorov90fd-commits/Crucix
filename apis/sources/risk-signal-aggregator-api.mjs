/**
 * apis/sources/risk-signal-aggregator-api.mjs — API-МОДУЛЬ: АГРЕГАТОР РИСК-СИГНАЛОВ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/flow/risk-signal-aggregator.json — { _meta: { stats:{signals,regions} }, data: { top:[], entities:[], chains:[], signals:[], regions:[] } }.
 * Анализатор: scripts/analyzers/risk-signal-aggregator.mjs.
 *
 * Агрегатор риск-сигналов: топ сущностей, регионов, цепочек, отдельных сигналов.
 *
 * ФОРМАТЫ: json (FC + top + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?region=, ?q=, ?min_score=, ?limit=, ?top=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'flow', 'risk-signal-aggregator.json');

export const route  = '/api/layers/risk-signal-aggregator';
export const method = 'GET';

export const meta = {
  category: 'flow',
  icon: '⚡',
  color: '#f43f5e',
  vizType: 'marker',
  source: 'analytics/flow/risk-signal-aggregator.json',
  collector: 'scripts/analyzers/risk-signal-aggregator.mjs',
  cache: 60,
  description: 'Агрегатор риск-сигналов: топ сущностей, регионов, цепочек',
  unit: 'signals',
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/risk-signal-aggregator.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json: ' + e.message); err.statusCode = 500; throw err; }
  if (!parsed || typeof parsed !== 'object') { const err = new Error('invalid_shape'); err.statusCode = 500; throw err; }
  return parsed;
}

// Универсально извлекаем "сущности риска" из любого из возможных полей.
function extractEntities(doc) {
  const d = doc.data || {};
  const candidates = [d.top, d.entities, d.chains, d.signals, d.regions];
  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.map((it, i) => {
        const lat = Number(it.lat ?? it.latitude);
        const lng = Number(it.lng ?? it.lon ?? it.longitude);
        return {
          id: it.id || it.code || it.key || `entity-${i}`,
          name: it.name || it.label || it.title || it.code || `Entity ${i}`,
          region: it.region || it.country || null,
          score: Number(it.score ?? it.value ?? it.risk ?? 0),
          severity: it.severity || null,
          lat: Number.isFinite(lat) ? lat : null,
          lng: Number.isFinite(lng) ? lng : null,
        };
      });
    }
  }
  return [];
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.region) r = r.filter(x => String(x.region || '').toLowerCase().includes(String(query.region).toLowerCase()));
  if (query.q)      r = r.filter(x => (x.name + ' ' + (x.id || '')).toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.min_score != null) {
    const n = Number(query.min_score);
    if (Number.isFinite(n)) r = r.filter(x => x.score >= n);
  }
  if (query.top)    { const n = parseInt(query.top, 10);    if (n > 0) r = r.slice(0, n); }
  if (query.limit)  { const n = parseInt(query.limit, 10);  if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows, doc) {
  const values = rows.map(r => r.score).filter(Number.isFinite);
  const byRegion = {};
  for (const r of rows) if (r.region) byRegion[r.region] = (byRegion[r.region] || 0) + 1;
  return {
    count: rows.length,
    mean_score: values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : null,
    max_score: values.length ? Math.max(...values) : null,
    min_score: values.length ? Math.min(...values) : null,
    by_region: byRegion,
    meta_signals: doc._meta?.stats?.signals ?? null,
    meta_regions: doc._meta?.stats?.regions ?? null,
    generated_at: doc._meta?.updated_at || null,
    duration_ms: doc._meta?.duration_ms ?? null,
  };
}

function toFeatureCollection(rows) {
  const features = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, region: r.region, score: r.score, severity: r.severity,
        category: meta.category, icon: meta.icon, color: meta.color,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    meta: { total: rows.length, mapped: features.length, unmapped: rows.length - features.length },
  };
}

function toSeries(rows) {
  return rows.map(r => ({ id: r.id, name: r.name, region: r.region, score: r.score }));
}

function toCSV(rows) {
  const lines = ['id,name,region,score,severity,lat,lng'];
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const r of rows) lines.push([r.id, r.name, r.region, r.score, r.severity, r.lat, r.lng].map(esc).join(','));
  return lines.join('\n') + '\n';
}

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

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/risk-signal-aggregator/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const all = extractEntities(doc);
    const extra = {
      'X-Module': 'risk-signal-aggregator-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all, doc), meta: doc._meta || null }, extra);
    }
    if (sub === '/top') {
      const n = parseInt(query.n, 10) || parseInt(query.top, 10) || 10;
      return sendJSON(res, 200, { top: all.slice(0, n), total: all.length, n }, extra);
    }
    if (sub === '/regions') {
      const byRegion = {};
      for (const e of all) if (e.region) (byRegion[e.region] = byRegion[e.region] || []).push(e);
      return sendJSON(res, 200, { regions: byRegion, total: Object.keys(byRegion).length }, extra);
    }
    if (sub === '/featurecollection') {
      return sendJSON(res, 200, toFeatureCollection(all), extra);
    }

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: doc, meta: { entities_returned: rows.length } }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source,
        category: meta.category,
        unit: meta.unit,
        total_entities: all.length,
        returned_entities: rows.length,
        generated_at: new Date().toISOString(),
        source_updated_at: doc._meta?.updated_at || null,
      },
      features: fc.features,
      top: rows.slice(0, 10),
      series: toSeries(rows),
      stats: computeStats(rows, doc),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
