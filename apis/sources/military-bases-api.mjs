/**
 * apis/sources/military-bases-api.mjs — API-МОДУЛЬ: ВОЕННЫЕ БАЗЫ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/military-bases.json — { success, data: { features: [...] } } или массив.
 * Сборщик: scripts/collectors/collect-military-bases.mjs.
 *
 * Военные базы мира: США, Россия, Китай, НАТО. Тип базы: штаб, авиабаза, морская база, гарнизон.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'military-bases.json');

export const route  = '/api/layers/military-bases';
export const method = 'GET';

export const meta = {
  category: 'military',
  icon: '🏰',
  color: '#ff4444',
  vizType: 'marker',
  source: 'basket/military-bases.json',
  collector: 'collect-military-bases.mjs',
  cache: 3600,
  description: 'Военные базы мира (США, Россия, Китай, НАТО)',
  unit: 'bases',
};

const TYPE_STYLE = {
  'штаб':         { color: '#7f1d1d', icon: '⭐', label: 'Штаб' },
  'hq':           { color: '#7f1d1d', icon: '⭐', label: 'Штаб' },
  'airbase':      { color: '#3b82f6', icon: '✈️', label: 'Авиабаза' },
  'naval':        { color: '#0066ff', icon: '⚓', label: 'Морская база' },
  'garrison':     { color: '#f97316', icon: '🛡️', label: 'Гарнизон' },
  'radar':        { color: '#a21caf', icon: '📡', label: 'РЛС' },
  'missile':      { color: '#dc2626', icon: '🚀', label: 'Ракетная' },
  'logistics':    { color: '#eab308', icon: '🚛', label: 'Логистика' },
  'training':     { color: '#22c55e', icon: '🎯', label: 'Учебный центр' },
  'unknown':      { color: '#64748b', icon: '❓', label: 'Неизвестно' },
};

const SEVERITY_COLOR = { 'info': '#22c55e', 'low': '#84cc16', 'medium': '#eab308', 'high': '#f97316', 'critical': '#dc2626' };

async function loadBases() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-military-bases.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && parsed.data && parsed.data.type === 'FeatureCollection' && Array.isArray(parsed.data.features)) arr = parsed.data.features;
  else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) arr = parsed.features;
  else if (parsed && parsed.data && Array.isArray(parsed.data.bases)) arr = parsed.data.bases;
  else if (parsed && Array.isArray(parsed.bases)) arr = parsed.bases;
  else if (parsed && Array.isArray(parsed.data))  arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    if (r && r.type === 'Feature') {
      const coords = r.geometry?.coordinates || [0, 0];
      const p = r.properties || {};
      return {
        name: p.name || 'Unknown',
        country: p.country || null,
        operator: p.operator || p.owner || null,
        type: String(p.type || 'unknown').toLowerCase(),
        severity: String(p.severity || 'info').toLowerCase(),
        lat: Number(coords[1]), lng: Number(coords[0]),
        personnel: p.personnel != null ? Number(p.personnel) : null,
        established: p.established || null,
      };
    }
    return {
      name: r.name || 'Unknown',
      country: r.country || null,
      operator: r.operator || r.owner || null,
      type: String(r.type || 'unknown').toLowerCase(),
      severity: String(r.severity || 'info').toLowerCase(),
      lat: Number(r.lat ?? r.latitude),
      lng: Number(r.lng ?? r.lon ?? r.longitude),
      personnel: r.personnel != null ? Number(r.personnel) : null,
      established: r.established || null,
    };
  }).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.type) r = r.filter(x => x.type === String(query.type).toLowerCase());
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => (x.country || '').toLowerCase().includes(c)); }
  if (query.operator) { const o = String(query.operator).toLowerCase(); r = r.filter(x => (x.operator || '').toLowerCase().includes(o)); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byType = {}, byCountry = {}, byOperator = {};
  for (const r of rows) {
    byType[r.type] = (byType[r.type] || 0) + 1;
    if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
    if (r.operator) byOperator[r.operator] = (byOperator[r.operator] || 0) + 1;
  }
  const top_countries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  const top_operators = Object.entries(byOperator).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  return { count: rows.length, by_type: byType, by_country: byCountry, top_countries, top_operators };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const style = TYPE_STYLE[r.type] || TYPE_STYLE.unknown;
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        name: r.name, country: r.country, operator: r.operator,
        type: r.type, typeLabel: style.label,
        severity: r.severity, severityColor: SEVERITY_COLOR[r.severity] || SEVERITY_COLOR.info,
        personnel: r.personnel, established: r.established,
        color: style.color, icon: style.icon,
        category: 'military',
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
    total_bases: full.length, returned_bases: filtered.length,
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
  const lines = ['name,country,operator,type,severity,personnel,lat,lng'];
  for (const r of rows) lines.push(`"${r.name.replace(/"/g, '""')}",${r.country || ''},${r.operator || ''},${r.type},${r.severity},${r.personnel ?? ''},${r.lat},${r.lng}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadBases();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'military-bases-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
