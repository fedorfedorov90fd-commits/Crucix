/**
 * apis/sources/reddit-api.mjs — API-МОДУЛЬ: REDDIT ОБСУЖДЕНИЯ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/reddit.json — массив { title, text, score, country, lat, lng, severity, timestamp }.
 * Сборщик: scripts/collectors/collect-reddit.mjs.
 *
 * Reddit — обсуждения, утечки, критические дискуссии. OSINT-сигналы.
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?severity=, ?country=, ?min_score=, ?q=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'reddit.json');

export const route  = '/api/layers/reddit';
export const method = 'GET';

export const meta = {
  category: 'news',
  icon: '🤖',
  color: '#ff4500',
  vizType: 'marker',
  source: 'basket/reddit.json',
  collector: 'collect-reddit.mjs',
  cache: 300,
  description: 'Reddit — обсуждения, утечки, критические дискуссии',
  unit: 'posts',
};

const SEVERITY_COLOR = { 'INFO': '#22c55e', 'LOW': '#84cc16', 'MEDIUM': '#eab308', 'HIGH': '#f97316', 'CRITICAL': '#dc2626' };

async function loadPosts() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-reddit.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.posts)) arr = parsed.posts;
  else if (parsed && Array.isArray(parsed.data))  arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => ({
    title: r.title || 'Untitled',
    text: r.text || r.body || r.description || null,
    score: Number(r.score ?? r.ups ?? 0),
    country: r.country || null,
    lat: Number(r.lat ?? r.latitude),
    lng: Number(r.lng ?? r.lon ?? r.longitude),
    severity: String(r.severity || 'INFO').toUpperCase(),
    timestamp: r.timestamp || null,
  })).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => b.score - a.score);
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toUpperCase());
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => (x.country || '').toLowerCase().includes(c)); }
  if (query.min_score != null) { const n = parseInt(query.min_score, 10); if (Number.isFinite(n)) r = r.filter(x => x.score >= n); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => (x.title + ' ' + (x.text || '')).toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const scores = rows.map(r => r.score);
  const totalScore = scores.reduce((a, b) => a + b, 0);
  const bySeverity = {}, byCountry = {};
  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
  }
  const top_posts = rows.slice(0, 5).map(r => ({ title: r.title, score: r.score, severity: r.severity }));
  const top_countries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  return { count: rows.length, total_score: totalScore, max_score: Math.max(...scores), avg_score: +(totalScore / rows.length).toFixed(1), by_severity: bySeverity, top_posts, top_countries };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      title: r.title, country: r.country, score: r.score, severity: r.severity,
      description: r.text, timestamp: r.timestamp,
      color: SEVERITY_COLOR[r.severity] || SEVERITY_COLOR.INFO,
      category: 'news', icon: meta.icon,
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
    total_posts: full.length, returned_posts: filtered.length,
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
  const lines = ['title,country,score,severity,lat,lng,timestamp'];
  for (const r of rows) lines.push(`"${r.title.replace(/"/g, '""')}",${r.country || ''},${r.score},${r.severity},${r.lat},${r.lng},${r.timestamp || ''}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadPosts();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'reddit-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
