/**
 * apis/sources/darkweb-api.mjs — API-МОДУЛЬ: ТЁМНАЯ ПАУТИНА
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/darkweb.json — массив { id, name, lat, lng, severity, timestamp }.
 * Резервный: data/basket/darkweb-data.json.
 * Сборщик: scripts/collectors/collect-darkweb.mjs.
 *
 * Мониторинг активности в тёмной сети: маркетплейсы, утечки, продажи доступов.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');

export const route  = '/api/layers/darkweb';
export const method = 'GET';

export const meta = {
  category: 'cyber',
  icon: '🌐',
  color: '#6600ff',
  vizType: 'marker',
  source: 'basket/darkweb.json',
  collector: 'collect-darkweb.mjs',
  cache: 300,
  description: 'Мониторинг тёмной сети: маркетплейсы, утечки, продажи доступов',
  unit: 'events',
};

const SEVERITY_COLOR = { 'info': '#22c55e', 'low': '#84cc16', 'medium': '#eab308', 'high': '#f97316', 'critical': '#dc2626' };

async function loadEvents() {
  let raw = null, fileUsed = null;
  for (const f of ['darkweb.json', 'darkweb-data.json']) {
    try { raw = await fs.readFile(join(BASKET_DIR, f), 'utf8'); fileUsed = f; break; } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  if (!raw) {
    const err = new Error('no_data'); err.statusCode = 503;
    err.hint = 'run scripts/collectors/collect-darkweb.mjs'; throw err;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) arr = parsed.features;
  else if (parsed && Array.isArray(parsed.events)) arr = parsed.events;
  else if (parsed && Array.isArray(parsed.data))   arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    if (r && r.type === 'Feature') {
      const coords = r.geometry?.coordinates || [0, 0];
      const p = r.properties || {};
      return {
        id: p.id || r.id || 'unknown',
        name: p.name || p.title || 'Unknown',
        severity: String(p.severity || 'medium').toLowerCase(),
        lat: Number(coords[1]), lng: Number(coords[0]),
        type: p.type || 'marketplace',
        category: p.category || null,
        source: p.source || null,
        timestamp: p.timestamp || null,
      };
    }
    return {
      id: r.id || 'unknown',
      name: r.name || r.title || 'Unknown',
      severity: String(r.severity || 'medium').toLowerCase(),
      lat: Number(r.lat ?? r.latitude),
      lng: Number(r.lng ?? r.lon ?? r.longitude),
      type: r.type || 'marketplace',
      category: r.category || null,
      source: r.source || null,
      timestamp: r.timestamp || null,
    };
  }).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return { events: clean, fileUsed };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.type) r = r.filter(x => x.type.toLowerCase() === String(query.type).toLowerCase());
  if (query.category) { const c = String(query.category).toLowerCase(); r = r.filter(x => (x.category || '').toLowerCase().includes(c)); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const bySeverity = {}, byType = {}, byCategory = {};
  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    byType[r.type] = (byType[r.type] || 0) + 1;
    if (r.category) byCategory[r.category] = (byCategory[r.category] || 0) + 1;
  }
  return { count: rows.length, by_severity: bySeverity, by_type: byType, by_category: byCategory };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id, name: r.name, severity: r.severity, type: r.type,
      category: r.category, source: r.source, timestamp: r.timestamp,
      color: SEVERITY_COLOR[r.severity] || SEVERITY_COLOR.medium,
      category_layer: 'cyber', icon: meta.icon,
    },
  }));
  return {
    type: 'FeatureCollection',
    legend: Object.entries(SEVERITY_COLOR).map(([severity, color]) => ({ severity, color })),
    features,
  };
}

function envelopeMeta(full, filtered, fileUsed) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    basket_file: fileUsed,
    total_events: full.length, returned_events: filtered.length,
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
  const lines = ['id,name,type,severity,category,lat,lng,timestamp'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.type},${r.severity},${r.category || ''},${r.lat},${r.lng},${r.timestamp || ''}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const loaded = await loadEvents();
    const rows = applyFilters(loaded.events, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'darkweb-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(loaded.events, rows, loaded.fileUsed) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(loaded.events, rows, loaded.fileUsed) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(loaded.events, rows, loaded.fileUsed),
      legend: fc.legend,
      features: fc.features,
      stats,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
