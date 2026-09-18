/**
 * apis/sources/multi-source-corroboration-api.mjs — API-МОДУЛЬ: КРОСС-ПОДТВЕРЖДЕНИЕ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/semantic/multi-source-corroboration.json.
 * Анализатор: scripts/analyzers/multi-source-corroboration.mjs.
 *
 * Кросс-подтверждение событий: если одно и то же событие подтверждено
 * из нескольких источников — его достоверность выше.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'semantic', 'multi-source-corroboration.json');

export const route  = '/api/layers/multi-source-corroboration';
export const method = 'GET';

export const meta = {
  category: 'semantic',
  icon: '✅',
  color: '#00cc66',
  vizType: 'marker',
  source: 'analytics/semantic/multi-source-corroboration.json',
  collector: 'analyzer:multi-source-corroboration',
  cache: 600,
  description: 'Кросс-подтверждение событий из нескольких источников',
  unit: 'events',
};

function confirmationLevel(count) {
  if (count >= 5) return { level: 'confirmed',    color: '#0d9488', label: 'Высокая достоверность (5+)' };
  if (count >= 3) return { level: 'well_sourced', color: '#22c55e', label: 'Хорошо подтверждено (3+)' };
  if (count >= 2) return { level: 'corroborated', color: '#eab308', label: 'Подтверждено (2+)' };
  return                { level: 'single',      color: '#f97316', label: 'Единственный источник' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/multi-source-corroboration.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data.events)) return data.data.events;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (Array.isArray(data.events)) return data.events;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function normalizeItem(r) {
  return {
    id: r.id || 'unknown',
    name: r.name || r.title || r.event || 'Event',
    sourceCount: Number(r.sourceCount ?? r.sources?.length ?? r.count ?? 1),
    sources: Array.isArray(r.sources) ? r.sources : (r.source ? [r.source] : []),
    confidence: Number(r.confidence ?? r.score ?? 0.5),
    description: r.description || r.summary || null,
    severity: String(r.severity || r.level || 'info').toLowerCase(),
    lat: Number(r.lat ?? r.latitude ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
    region: r.region || r.country || null,
    date: r.date || r.timestamp || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.min_sources != null) { const n = parseInt(query.min_sources, 10); if (Number.isFinite(n)) r = r.filter(x => x.sourceCount >= n); }
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.source) { const s = String(query.source).toLowerCase(); r = r.filter(x => x.sources.some(src => String(src).toLowerCase().includes(s))); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const counts = rows.map(r => r.sourceCount);
  const byLevel = {};
  let totalSources = 0;
  for (const r of rows) {
    const lvl = confirmationLevel(r.sourceCount).level;
    byLevel[lvl] = (byLevel[lvl] || 0) + 1;
    totalSources += r.sourceCount;
  }
  const top5 = rows.slice().sort((a, b) => b.sourceCount - a.sourceCount).slice(0, 5)
    .map(r => ({ name: r.name, sourceCount: r.sourceCount }));
  return {
    count: rows.length,
    max_sources: Math.max(...counts),
    avg_sources: +(totalSources / rows.length).toFixed(2),
    by_level: byLevel,
    top_5: top5,
  };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => {
    const lvl = confirmationLevel(r.sourceCount);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, sourceCount: r.sourceCount, sources: r.sources,
        confidence: r.confidence, description: r.description, severity: r.severity,
        region: r.region, date: r.date,
        level: lvl.level, levelLabel: lvl.label, color: lvl.color,
        category: 'semantic', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    levels: [
      { level: 'confirmed',    label: 'Высокая достоверность (5+)', color: '#0d9488' },
      { level: 'well_sourced', label: 'Хорошо подтверждено (3+)',   color: '#22c55e' },
      { level: 'corroborated', label: 'Подтверждено (2+)',          color: '#eab308' },
      { level: 'single',       label: 'Единственный источник',      color: '#f97316' },
    ],
    features,
  };
}

function envelopeMeta(data, full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    total_events: full.length, returned_events: filtered.length,
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
  const lines = ['id,name,sourceCount,confidence,severity,sources'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.sourceCount},${r.confidence},${r.severity},"${r.sources.join(';')}"`);
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
    const extra = { 'X-Module': 'multi-source-corroboration-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
