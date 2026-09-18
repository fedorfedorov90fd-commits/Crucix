/**
 * apis/sources/conflict-zone-api.mjs — API-МОДУЛЬ: ЗОНЫ КОНФЛИКТОВ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/conflict-zone.json — массив { label, value, country, lat, lng }.
 * Резервный: data/basket/conflict-zones.json — массив { type, severity, lat, lng, region, timestamp }.
 * Сборщик: scripts/collectors/collect-conflict-zones.mjs.
 *
 * Активные зоны конфликтов. Value 1-5.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');

export const route  = '/api/layers/conflict-zone';
export const method = 'GET';

export const meta = {
  category: 'geopolitical',
  icon: '🔥',
  color: '#dc2626',
  vizType: 'marker',
  source: 'basket/conflict-zone.json',
  collector: 'collect-conflict-zones.mjs',
  cache: 300,
  description: 'Активные зоны конфликтов (войны, восстания)',
  unit: 'zones',
};

const SEVERITY_COLOR = {
  'critical': '#7f1d1d', 'high': '#dc2626', 'medium': '#f97316',
  'low': '#eab308', 'info': '#22c55e', 'war': '#7f1d1d', 'conflict': '#dc2626',
};

async function loadZones() {
  let raw = null, fileUsed = null, parsed = null;
  for (const f of ['conflict-zone.json', 'conflict-zones.json']) {
    try {
      raw = await fs.readFile(join(BASKET_DIR, f), 'utf8');
      parsed = JSON.parse(raw);
      fileUsed = f;
      break;
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  if (!raw) {
    const err = new Error('no_data'); err.statusCode = 503;
    err.hint = 'run scripts/collectors/collect-conflict-zones.mjs'; throw err;
  }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) arr = parsed.features;
  else if (parsed && Array.isArray(parsed.zones)) arr = parsed.zones;
  else if (parsed && Array.isArray(parsed.data))  arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    if (r && r.type === 'Feature') {
      const coords = r.geometry?.coordinates || [0, 0];
      const p = r.properties || {};
      const lvl = p.severity ? String(p.severity).toLowerCase() : (p.value ? (p.value >= 5 ? 'critical' : p.value >= 4 ? 'high' : p.value >= 3 ? 'medium' : 'low') : 'medium');
      return {
        label: p.label || p.name || p.region || 'Unknown',
        value: Number(p.value ?? p.intensity ?? 3),
        country: p.country || p.region || null,
        severity: lvl,
        type: p.type || 'conflict',
        lat: Number(coords[1]), lng: Number(coords[0]),
        timestamp: p.timestamp || null,
      };
    }
    const lvl = r.severity ? String(r.severity).toLowerCase() : (r.value ? (r.value >= 5 ? 'critical' : r.value >= 4 ? 'high' : r.value >= 3 ? 'medium' : 'low') : 'medium');
    return {
      label: r.label || r.name || r.region || 'Unknown',
      value: Number(r.value ?? r.intensity ?? 3),
      country: r.country || r.region || null,
      severity: lvl,
      type: r.type || 'conflict',
      lat: Number(r.lat ?? r.latitude),
      lng: Number(r.lng ?? r.lon ?? r.longitude),
      timestamp: r.timestamp || null,
    };
  }).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => b.value - a.value);
  return { zones: clean, fileUsed };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.type) r = r.filter(x => x.type.toLowerCase() === String(query.type).toLowerCase());
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => (x.country || '').toLowerCase().includes(c)); }
  if (query.min_value != null) { const n = parseFloat(query.min_value); if (Number.isFinite(n)) r = r.filter(x => x.value >= n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const bySeverity = {}, byType = {}, byCountry = {};
  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    byType[r.type] = (byType[r.type] || 0) + 1;
    if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
  }
  const top_zones = rows.slice(0, 5).map(r => ({ label: r.label, value: r.value, severity: r.severity }));
  return { count: rows.length, by_severity: bySeverity, by_type: byType, by_country: byCountry, top_zones };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      label: r.label, country: r.country, value: r.value, severity: r.severity, type: r.type, timestamp: r.timestamp,
      color: SEVERITY_COLOR[r.severity] || SEVERITY_COLOR[r.type] || '#dc2626',
      category: 'geopolitical', icon: meta.icon,
    },
  }));
  return {
    type: 'FeatureCollection',
    legend: [
      { severity: 'critical', color: '#7f1d1d' },
      { severity: 'high',     color: '#dc2626' },
      { severity: 'medium',   color: '#f97316' },
      { severity: 'low',      color: '#eab308' },
      { severity: 'info',     color: '#22c55e' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered, fileUsed) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    basket_file: fileUsed,
    total_zones: full.length, returned_zones: filtered.length,
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
  const lines = ['label,country,value,severity,type,lat,lng'];
  for (const r of rows) lines.push(`"${r.label.replace(/"/g, '""')}",${r.country || ''},${r.value},${r.severity},${r.type},${r.lat},${r.lng}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const loaded = await loadZones();
    const rows = applyFilters(loaded.zones, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'conflict-zone-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(loaded.zones, rows, loaded.fileUsed) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(loaded.zones, rows, loaded.fileUsed) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(loaded.zones, rows, loaded.fileUsed),
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
