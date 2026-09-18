/**
 * apis/sources/safecast-api.mjs — API-МОДУЛЬ: РАДИАЦИОННЫЙ МОНИТОРИНГ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/safecast.json — FeatureCollection с sites (АЭС) { name, reading, level, severity }.
 * Сборщик: scripts/collectors/collect-safecast.mjs.
 *
 * Safecast + радиационный мониторинг АЭС. Единица — CPM (counts per minute).
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?min_reading=, ?level=, ?severity=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'safecast.json');

export const route  = '/api/layers/safecast';
export const method = 'GET';

export const meta = {
  category: 'ecological',
  icon: '☢️',
  color: '#ff00ff',
  vizType: 'marker',
  source: 'basket/safecast.json',
  collector: 'collect-safecast.mjs',
  cache: 300,
  description: 'Радиационный мониторинг АЭС (Safecast, CPM)',
  unit: 'CPM',
};

const LEVEL_STYLE = {
  'normal':    { color: '#22c55e', label: 'Норма' },
  'elevated':  { color: '#eab308', label: 'Повышенный' },
  'high':      { color: '#f97316', label: 'Высокий' },
  'danger':    { color: '#dc2626', label: 'Опасный' },
  'critical':  { color: '#7f1d1d', label: 'Критический' },
};

function levelFromReading(cpm) {
  if (cpm >= 300) return { level: 'critical',  color: '#7f1d1d', label: 'Критический' };
  if (cpm >= 200) return { level: 'danger',    color: '#dc2626', label: 'Опасный' };
  if (cpm >= 100) return { level: 'high',      color: '#f97316', label: 'Высокий' };
  if (cpm >= 50)  return { level: 'elevated',  color: '#eab308', label: 'Повышенный' };
  return                { level: 'normal',    color: '#22c55e', label: 'Норма' };
}

async function loadSites() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-safecast.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) arr = parsed.features;
  else if (parsed && parsed.data && Array.isArray(parsed.data.sites)) arr = parsed.data.sites;
  else if (parsed && Array.isArray(parsed.sites)) arr = parsed.sites;
  else if (parsed && Array.isArray(parsed.data))  arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    if (r && r.type === 'Feature') {
      const coords = r.geometry?.coordinates || [0, 0];
      const p = r.properties || {};
      const reading = Number(p.reading ?? p.cpm ?? p.value ?? 0);
      return {
        name: p.name || 'Unknown',
        lat: Number(coords[1]), lng: Number(coords[0]),
        reading,
        level: p.level || levelFromReading(reading).level,
        severity: String(p.severity || 'INFO').toUpperCase(),
      };
    }
    const reading = Number(r.reading ?? r.cpm ?? r.value ?? 0);
    return {
      name: r.name || r.site || 'Unknown',
      lat: Number(r.lat ?? r.latitude),
      lng: Number(r.lng ?? r.lon ?? r.longitude),
      reading,
      level: r.level || levelFromReading(reading).level,
      severity: String(r.severity || 'INFO').toUpperCase(),
    };
  }).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.min_reading != null) { const n = parseFloat(query.min_reading); if (Number.isFinite(n)) r = r.filter(x => x.reading >= n); }
  if (query.level) r = r.filter(x => x.level === String(query.level).toLowerCase());
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toUpperCase());
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const readings = rows.map(r => r.reading);
  const min = Math.min(...readings), max = Math.max(...readings);
  const avg = readings.reduce((a, b) => a + b, 0) / readings.length;
  const byLevel = {}, bySeverity = {};
  for (const r of rows) {
    byLevel[r.level] = (byLevel[r.level] || 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
  }
  const top5 = rows.slice().sort((a, b) => b.reading - a.reading).slice(0, 5).map(r => ({ name: r.name, reading: r.reading, level: r.level }));
  return { count: rows.length, min, max, avg: +avg.toFixed(1), by_level: byLevel, by_severity: bySeverity, top_5: top5 };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const style = LEVEL_STYLE[r.level] || levelFromReading(r.reading);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        name: r.name, reading: r.reading, level: r.level, levelLabel: style.label,
        severity: r.severity, color: style.color,
        category: 'ecological', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    legend: [
      { level: 'normal',   label: 'Норма (<50 CPM)',      color: '#22c55e' },
      { level: 'elevated', label: 'Повышенный (50+)',     color: '#eab308' },
      { level: 'high',     label: 'Высокий (100+)',       color: '#f97316' },
      { level: 'danger',   label: 'Опасный (200+)',       color: '#dc2626' },
      { level: 'critical', label: 'Критический (300+)',   color: '#7f1d1d' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_sites: full.length, returned_sites: filtered.length,
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
  const lines = ['name,reading,level,severity,lat,lng'];
  for (const r of rows) lines.push(`"${r.name.replace(/"/g, '""')}",${r.reading},${r.level},${r.severity},${r.lat},${r.lng}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadSites();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'safecast-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(full, rows),
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
