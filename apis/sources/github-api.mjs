/**
 * apis/sources/github-api.mjs — API-МОДУЛЬ: СОБЫТИЯ GITHUB
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/github_events.json — массив { repo, event, stars, country, lat, lng, severity, timestamp }.
 * Сборщик: scripts/collectors/collect-github.mjs.
 *
 * События GitHub: релизы, уязвимости, форки. Мониторинг активности вокруг репозиториев.
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?repo=, ?severity=, ?min_stars=, ?country=, ?since=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'github_events.json');

export const route  = '/api/layers/github';
export const method = 'GET';

export const meta = {
  category: 'cyber',
  icon: '🐙',
  color: '#6e5494',
  vizType: 'marker',
  source: 'basket/github_events.json',
  collector: 'collect-github.mjs',
  cache: 300,
  description: 'События GitHub — релизы, уязвимости, форки репозиториев',
  unit: 'events',
};

const SEVERITY_COLOR = { 'INFO': '#22c55e', 'LOW': '#84cc16', 'MEDIUM': '#eab308', 'HIGH': '#f97316', 'CRITICAL': '#dc2626' };

async function loadEvents() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-github.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.events)) arr = parsed.events;
  else if (parsed && Array.isArray(parsed.data))   arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => ({
    repo: r.repo || r.repository || 'Unknown',
    event: r.event || r.type || 'event',
    stars: Number(r.stars ?? r.stargazers ?? 0),
    country: r.country || null,
    lat: Number(r.lat ?? r.latitude),
    lng: Number(r.lng ?? r.lon ?? r.longitude),
    severity: String(r.severity || 'INFO').toUpperCase(),
    timestamp: r.timestamp || r.date || null,
    description: r.description || r.event || null,
  })).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.repo) { const x = String(query.repo).toLowerCase(); r = r.filter(e => e.repo.toLowerCase().includes(x)); }
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toUpperCase());
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => (x.country || '').toLowerCase().includes(c)); }
  if (query.min_stars != null) { const n = parseInt(query.min_stars, 10); if (Number.isFinite(n)) r = r.filter(x => x.stars >= n); }
  if (query.since) r = r.filter(x => (x.timestamp || '') >= String(query.since));
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const stars = rows.map(r => r.stars);
  const totalStars = stars.reduce((a, b) => a + b, 0);
  const bySeverity = {}, byCountry = {};
  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
  }
  const top_repos = rows.slice().sort((a, b) => b.stars - a.stars).slice(0, 5).map(r => ({ repo: r.repo, stars: r.stars }));
  return {
    count: rows.length,
    total_stars: totalStars,
    max_stars: Math.max(...stars),
    avg_stars: +(totalStars / rows.length).toFixed(1),
    by_severity: bySeverity,
    by_country: byCountry,
    top_repos,
  };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      repo: r.repo,
      event: r.event,
      stars: r.stars,
      country: r.country,
      severity: r.severity,
      timestamp: r.timestamp,
      description: r.description,
      color: SEVERITY_COLOR[r.severity] || SEVERITY_COLOR.INFO,
      category: 'cyber',
      icon: meta.icon,
    },
  }));
  return {
    type: 'FeatureCollection',
    legend: Object.entries(SEVERITY_COLOR).map(([severity, color]) => ({ severity, color })),
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
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
  const lines = ['repo,event,stars,country,severity,lat,lng,timestamp'];
  for (const r of rows) lines.push(`${r.repo},${r.event},${r.stars},${r.country || ''},${r.severity},${r.lat},${r.lng},${r.timestamp || ''}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadEvents();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'github-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
