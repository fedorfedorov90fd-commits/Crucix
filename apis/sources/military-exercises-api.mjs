/**
 * apis/sources/military-exercises-api.mjs — API-МОДУЛЬ: ВОЕННЫЕ УЧЕНИЯ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/military-exercises.json — массив { id, name, lat, lng, severity, timestamp }.
 * Резервный: data/basket/exercises.json — массив { name, lat, lng, troops, date }.
 * Сборщик: scripts/collectors/collect-military-exercises.mjs.
 *
 * Военные учения по регионам мира.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');

export const route  = '/api/layers/military-exercises';
export const method = 'GET';

export const meta = {
  category: 'military',
  icon: '⚔️',
  color: '#ff8800',
  vizType: 'marker',
  source: 'basket/military-exercises.json',
  collector: 'collect-military-exercises.mjs',
  cache: 600,
  description: 'Военные учения по регионам мира',
  unit: 'exercises',
};

const SEVERITY_COLOR = { 'info': '#22c55e', 'low': '#84cc16', 'medium': '#eab308', 'high': '#f97316', 'critical': '#dc2626' };

function troopsBand(n) {
  if (n >= 30000) return { level: 'massive',  color: '#7f1d1d', label: 'Массовые (30K+)' };
  if (n >= 15000) return { level: 'very_big', color: '#dc2626', label: 'Очень крупные' };
  if (n >= 5000)  return { level: 'big',      color: '#f97316', label: 'Крупные' };
  if (n >= 1000)  return { level: 'medium',   color: '#eab308', label: 'Средние' };
  return                 { level: 'small',   color: '#22c55e', label: 'Малые' };
}

async function loadExercises() {
  let raw = null, fileUsed = null, parsed = null;
  for (const f of ['military-exercises.json', 'exercises.json']) {
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
    err.hint = 'run scripts/collectors/collect-military-exercises.mjs'; throw err;
  }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) arr = parsed.features;
  else if (parsed && Array.isArray(parsed.exercises)) arr = parsed.exercises;
  else if (parsed && Array.isArray(parsed.data))      arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    if (r && r.type === 'Feature') {
      const coords = r.geometry?.coordinates || [0, 0];
      const p = r.properties || {};
      return {
        id: p.id || r.id || 'unknown',
        name: p.name || 'Unknown',
        lat: Number(coords[1]), lng: Number(coords[0]),
        troops: p.troops != null ? Number(p.troops) : null,
        severity: String(p.severity || 'medium').toLowerCase(),
        region: p.region || null,
        country: p.country || null,
        date: p.date || null,
        startDate: p.startDate || null,
        endDate: p.endDate || null,
        participants: Array.isArray(p.participants) ? p.participants : null,
        timestamp: p.timestamp || null,
      };
    }
    return {
      id: r.id || 'unknown',
      name: r.name || 'Unknown',
      lat: Number(r.lat ?? r.latitude),
      lng: Number(r.lng ?? r.lon ?? r.longitude),
      troops: r.troops != null ? Number(r.troops) : null,
      severity: String(r.severity || 'medium').toLowerCase(),
      region: r.region || null,
      country: r.country || null,
      date: r.date || null,
      startDate: r.startDate || null,
      endDate: r.endDate || null,
      participants: Array.isArray(r.participants) ? r.participants : null,
      timestamp: r.timestamp || null,
    };
  }).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => (b.troops || 0) - (a.troops || 0));
  return { exercises: clean, fileUsed };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.region) { const g = String(query.region).toLowerCase(); r = r.filter(x => (x.region || '').toLowerCase().includes(g)); }
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => (x.country || '').toLowerCase().includes(c)); }
  if (query.min_troops != null) { const n = parseInt(query.min_troops, 10); if (Number.isFinite(n)) r = r.filter(x => (x.troops || 0) >= n); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const withTroops = rows.filter(r => r.troops != null);
  const totalTroops = withTroops.reduce((a, b) => a + b.troops, 0);
  const bySeverity = {}, byRegion = {};
  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    if (r.region) byRegion[r.region] = (byRegion[r.region] || 0) + 1;
  }
  const top = rows.slice(0, 5).map(r => ({ name: r.name, troops: r.troops }));
  return {
    count: rows.length,
    total_troops: totalTroops,
    max_troops: withTroops.length > 0 ? Math.max(...withTroops.map(r => r.troops)) : 0,
    avg_troops: withTroops.length > 0 ? +(totalTroops / withTroops.length).toFixed(0) : 0,
    by_severity: bySeverity,
    by_region: byRegion,
    top_exercises: top,
  };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const band = r.troops != null ? troopsBand(r.troops) : { level: 'unknown', color: SEVERITY_COLOR[r.severity] || SEVERITY_COLOR.medium, label: 'Не указано' };
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, troops: r.troops, severity: r.severity,
        region: r.region, country: r.country, date: r.date,
        startDate: r.startDate, endDate: r.endDate, participants: r.participants,
        band: band.level, bandLabel: band.label,
        color: band.color,
        category: 'military', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'massive',  label: 'Массовые (30K+)', color: '#7f1d1d' },
      { level: 'very_big', label: 'Очень крупные (15K+)', color: '#dc2626' },
      { level: 'big',      label: 'Крупные (5K+)', color: '#f97316' },
      { level: 'medium',   label: 'Средние (1K+)', color: '#eab308' },
      { level: 'small',    label: 'Малые (<1K)',   color: '#22c55e' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered, fileUsed) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    basket_file: fileUsed,
    total_exercises: full.length, returned_exercises: filtered.length,
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
  const lines = ['id,name,severity,region,country,troops,lat,lng,date'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.severity},${r.region || ''},${r.country || ''},${r.troops ?? ''},${r.lat},${r.lng},${r.date || ''}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const loaded = await loadExercises();
    const rows = applyFilters(loaded.exercises, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'military-exercises-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(loaded.exercises, rows, loaded.fileUsed) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(loaded.exercises, rows, loaded.fileUsed) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(loaded.exercises, rows, loaded.fileUsed),
      bands: fc.bands,
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
