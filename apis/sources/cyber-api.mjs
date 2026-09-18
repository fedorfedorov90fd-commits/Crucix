/**
 * apis/sources/cyber-api.mjs — API-МОДУЛЬ: КИБЕРАТАКИ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/cyber-attacks.json — плоский массив { name, severity, lat, lng, region, timestamp }.
 * Сборщик: scripts/collectors/collect-cyber-attacks.mjs.
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?region=, ?min_severity=, ?since=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'cyber-attacks.json');

export const route  = '/api/layers/cyber';
export const method = 'GET';

export const meta = {
  category: 'cyber',
  icon: '💻',
  color: '#ff4466',
  vizType: 'marker',
  source: 'basket/cyber-attacks.json',
  collector: 'collect-cyber-attacks.mjs',
  cache: 120,
  description: 'Кибератаки по регионам (Ransomware, DDoS, Data breach и др.)',
  unit: 'attacks',
};

// Классификация по severity (1-5)
function severityLevel(sev) {
  if (sev >= 5) return { level: 'critical', color: '#7f1d1d', label: 'Критический' };
  if (sev >= 4) return { level: 'high',     color: '#dc2626', label: 'Высокий' };
  if (sev >= 3) return { level: 'medium',   color: '#f97316', label: 'Средний' };
  if (sev >= 2) return { level: 'low',      color: '#eab308', label: 'Низкий' };
  return           { level: 'info',     color: '#22c55e', label: 'Информационный' };
}

async function loadAttacks() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-cyber-attacks.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.data))   arr = parsed.data;
  else if (parsed && Array.isArray(parsed.attacks)) arr = parsed.attacks;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => ({
    name: r.name || r.title || 'Unknown',
    severity: Number(r.severity ?? r.level ?? 1),
    lat: Number(r.lat ?? r.latitude),
    lng: Number(r.lng ?? r.lon ?? r.longitude),
    region: r.region || r.country || null,
    type: r.type || r.category || 'cyber',
    timestamp: r.timestamp || r.date || new Date().toISOString(),
    source: r.source || null,
  })).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.region) { const g = String(query.region).toLowerCase(); r = r.filter(x => (x.region || '').toLowerCase().includes(g)); }
  if (query.type)   { const t = String(query.type).toLowerCase();   r = r.filter(x => x.type.toLowerCase().includes(t)); }
  if (query.min_severity != null) { const n = parseFloat(query.min_severity); if (Number.isFinite(n)) r = r.filter(x => x.severity >= n); }
  if (query.max_severity != null) { const n = parseFloat(query.max_severity); if (Number.isFinite(n)) r = r.filter(x => x.severity <= n); }
  if (query.since) { const s = String(query.since); r = r.filter(x => x.timestamp >= s); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byRegion = {}, bySeverity = {}, byType = {};
  let totalSev = 0, maxSev = 0;
  for (const r of rows) {
    const reg = r.region || 'Unknown';
    byRegion[reg] = (byRegion[reg] || 0) + 1;
    const lvl = severityLevel(r.severity).level;
    bySeverity[lvl] = (bySeverity[lvl] || 0) + 1;
    byType[r.type] = (byType[r.type] || 0) + 1;
    totalSev += r.severity;
    if (r.severity > maxSev) maxSev = r.severity;
  }
  const top_regions = Object.entries(byRegion).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  return {
    count: rows.length,
    avg_severity: +(totalSev / rows.length).toFixed(2),
    max_severity: maxSev,
    by_region: byRegion,
    by_severity: bySeverity,
    by_type: byType,
    top_regions,
  };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const s = severityLevel(r.severity);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        name: r.name,
        type: r.type,
        severity: r.severity,
        severityLevel: s.level,
        severityLabel: s.label,
        region: r.region,
        timestamp: r.timestamp,
        source: r.source,
        color: s.color,
        category: 'cyber',
        icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    legend: [
      { level: 'info',     label: 'Информационный', color: '#22c55e' },
      { level: 'low',      label: 'Низкий',         color: '#eab308' },
      { level: 'medium',   label: 'Средний',        color: '#f97316' },
      { level: 'high',     label: 'Высокий',        color: '#dc2626' },
      { level: 'critical', label: 'Критический',    color: '#7f1d1d' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_attacks: full.length, returned_attacks: filtered.length,
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
  const lines = ['name,type,severity,severityLevel,region,lat,lng,timestamp'];
  for (const r of rows) { const s = severityLevel(r.severity); lines.push(`${r.name},${r.type},${r.severity},${s.level},${r.region || ''},${r.lat},${r.lng},${r.timestamp}`); }
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadAttacks();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'cyber-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
