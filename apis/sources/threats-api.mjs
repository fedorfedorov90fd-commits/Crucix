/**
 * apis/sources/threats-api.mjs — API-МОДУЛЬ: УГРОЗЫ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/threats.json — массив { id, name, type, severity, description, source, timestamp }.
 * Сборщик: scripts/collectors/collect-cyber-threats.mjs.
 *
 * Комплексный мониторинг угроз: кибер + военные + гибридные.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'threats.json');

export const route  = '/api/layers/threats';
export const method = 'GET';

export const meta = {
  category: 'threats',
  icon: '⚡',
  color: '#ef4444',
  vizType: 'marker',
  source: 'basket/threats.json',
  collector: 'collect-cyber-threats.mjs',
  cache: 300,
  description: 'Комплексный мониторинг угроз (кибер + военные + гибридные)',
  unit: 'threats',
};

const TYPE_STYLE = {
  'cyber':         { color: '#8b5cf6', icon: '💻', label: 'Кибер' },
  'military':      { color: '#dc2626', icon: '⚔️', label: 'Военная' },
  'hybrid':        { color: '#f97316', icon: '⚡', label: 'Гибридная' },
  'terrorism':     { color: '#7f1d1d', icon: '💥', label: 'Терроризм' },
  'espionage':     { color: '#a21caf', icon: '🕵️', label: 'Шпионаж' },
  'information':   { color: '#3b82f6', icon: '📰', label: 'Информационная' },
  'unknown':       { color: '#64748b', icon: '❓', label: 'Неизвестно' },
};

const SEVERITY_COLOR = {
  'info':     '#22c55e',
  'low':      '#84cc16',
  'medium':   '#eab308',
  'high':     '#f97316',
  'critical': '#dc2626',
};

async function loadThreats() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-cyber-threats.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.threats)) arr = parsed.threats;
  else if (parsed && Array.isArray(parsed.data))    arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => ({
    id: r.id || 'unknown',
    name: r.name || r.title || 'Unknown',
    type: String(r.type || 'unknown').toLowerCase(),
    severity: String(r.severity || 'info').toLowerCase(),
    description: r.description || r.summary || '',
    source: r.source || null,
    lat: r.lat != null ? Number(r.lat) : (r.latitude != null ? Number(r.latitude) : null),
    lng: r.lng != null ? Number(r.lng) : (r.lon != null ? Number(r.lon) : (r.longitude != null ? Number(r.longitude) : null)),
    country: r.country || null,
    timestamp: r.timestamp || null,
  }));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.type) r = r.filter(x => x.type === String(query.type).toLowerCase());
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => (x.country || '').toLowerCase().includes(c)); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => (x.name + ' ' + x.description).toLowerCase().includes(q)); }
  if (query.since) r = r.filter(x => (x.timestamp || '') >= String(query.since));
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byType = {}, bySeverity = {}, byCountry = {};
  for (const r of rows) {
    byType[r.type] = (byType[r.type] || 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
  }
  const top_countries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  return { count: rows.length, by_type: byType, by_severity: bySeverity, top_countries };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat != null && r.lng != null).map(r => {
    const style = TYPE_STYLE[r.type] || TYPE_STYLE.unknown;
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, type: r.type, typeLabel: style.label,
        severity: r.severity, severityColor: SEVERITY_COLOR[r.severity] || '#64748b',
        description: r.description, source: r.source, country: r.country, timestamp: r.timestamp,
        color: style.color, icon: style.icon,
        category: 'threats',
      },
    };
  });
  return {
    type: 'FeatureCollection',
    types: Object.entries(TYPE_STYLE).map(([k, v]) => ({ type: k, ...v })),
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_threats: full.length, returned_threats: filtered.length,
    with_coords: filtered.filter(r => r.lat != null && r.lng != null).length,
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
  const lines = ['id,name,type,severity,country,source,timestamp'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.type},${r.severity},${r.country || ''},${r.source || ''},${r.timestamp || ''}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadThreats();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'threats-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(full, rows),
      types: fc.types,
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
