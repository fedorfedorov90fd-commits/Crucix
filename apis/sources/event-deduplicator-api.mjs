/**
 * apis/sources/event-deduplicator-api.mjs — API-МОДУЛЬ: ДЕДУПЛИКАТОР СОБЫТИЙ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/specialist/event-deduplicator.json — { _meta: { stats:{unique,duplicates} }, data: { items:[], extra:{}, generated_at } }.
 * Анализатор: scripts/analyzers/event-deduplicator.mjs.
 *
 * Дедупликатор событий: схлопывает одинаковые события из разных источников.
 * Отдаёт уникальные события и статистику по дублям.
 *
 * ФОРМАТЫ: json (FeatureCollection + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?type=, ?source=, ?since=, ?limit=, ?search=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'event-deduplicator.json');

export const route  = '/api/layers/event-deduplicator';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '🧹',
  color: '#0ea5e9',
  vizType: 'marker',
  source: 'analytics/specialist/event-deduplicator.json',
  collector: 'scripts/analyzers/event-deduplicator.mjs',
  cache: 60,
  description: 'Дедупликатор событий: уникальные события, дубли, статистика',
  unit: 'events',
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/event-deduplicator.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json: ' + e.message); err.statusCode = 500; throw err; }
  if (!parsed || typeof parsed !== 'object') { const err = new Error('invalid_shape'); err.statusCode = 500; throw err; }
  return parsed;
}

function normalizeItems(doc) {
  const arr = doc.data?.items || [];
  return arr.map((it, i) => {
    const lat = Number(it.lat ?? it.latitude);
    const lng = Number(it.lng ?? it.lon ?? it.longitude);
    return {
      id: it.id || `event-${i}`,
      type: it.type || it.event_type || 'unknown',
      source: it.source || null,
      sources: Array.isArray(it.sources) ? it.sources : (it.source ? [it.source] : []),
      title: it.title || it.name || null,
      date: String(it.date || it.event_date || '').slice(0, 10) || null,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      duplicates: Number(it.duplicates ?? it.merged_count ?? 0),
      category: meta.category,
      icon: meta.icon,
      color: meta.color,
    };
  });
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.type)   r = r.filter(x => x.type.toLowerCase().includes(String(query.type).toLowerCase()));
  if (query.source) r = r.filter(x => x.sources.some(s => String(s).toLowerCase().includes(String(query.source).toLowerCase())));
  if (query.since)  r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  if (query.search) r = r.filter(x => JSON.stringify(x).toLowerCase().includes(String(query.search).toLowerCase()));
  if (query.limit)  { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows, doc) {
  const byType = {};
  const bySource = {};
  let totalDuplicates = 0;
  for (const r of rows) {
    byType[r.type] = (byType[r.type] || 0) + 1;
    for (const s of r.sources) bySource[s] = (bySource[s] || 0) + 1;
    totalDuplicates += r.duplicates;
  }
  return {
    count: rows.length,
    total_duplicates: totalDuplicates,
    unique: doc._meta?.stats?.unique ?? null,
    duplicates_in_meta: doc._meta?.stats?.duplicates ?? null,
    by_type: byType,
    by_source: bySource,
    generated_at: doc.data?.generated_at || doc._meta?.updated_at || null,
    duration_ms: doc._meta?.duration_ms || null,
  };
}

function toSeries(rows) {
  return rows.map(r => ({ id: r.id, type: r.type, sources: r.sources, date: r.date, duplicates: r.duplicates }));
}

function toFeatureCollection(rows) {
  const features = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, type: r.type, source: r.source, sources: r.sources,
        title: r.title, date: r.date, duplicates: r.duplicates,
        category: r.category, icon: r.icon, color: r.color,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    meta: { total: rows.length, mapped: features.length, unmapped: rows.length - features.length },
  };
}

function toCSV(rows) {
  const lines = ['id,type,source,date,duplicates,lat,lng'];
  const esc = (v) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const r of rows) lines.push([r.id, r.type, r.source, r.date, r.duplicates, r.lat, r.lng].map(esc).join(','));
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/event-deduplicator/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const all = normalizeItems(doc);
    const extra = {
      'X-Module': 'event-deduplicator-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all, doc), meta: doc._meta || null }, extra);
    }
    if (sub === '/items') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, { items: rows, extra: doc.data?.extra || {}, total: rows.length }, extra);
    }
    if (sub === '/featurecollection') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: doc, meta: { items_returned: rows.length } }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source,
        category: meta.category,
        unit: meta.unit,
        total_items: all.length,
        returned_items: rows.length,
        generated_at: new Date().toISOString(),
        source_updated_at: doc._meta?.updated_at || null,
      },
      features: fc.features,
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
