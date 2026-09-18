/**
 * apis/sources/hackernews-api.mjs — API-МОДУЛЬ: HACKER NEWS
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/hackernews-top.json — { source, updated, count, items: [...] }.
 * Резервный: data/basket/hackernews.json — плоский массив.
 * Сборщик: scripts/collectors/collect-hackernews.mjs.
 *
 * Hacker News — технологические новости и обсуждения. Показатель активности IT-сообщества.
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?min_score=, ?q=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');

export const route  = '/api/layers/hackernews';
export const method = 'GET';

export const meta = {
  category: 'news',
  icon: '💬',
  color: '#ff6600',
  vizType: 'marker',
  source: 'basket/hackernews-top.json',
  collector: 'collect-hackernews.mjs',
  cache: 300,
  description: 'Hacker News — технологические новости и обсуждения',
  unit: 'posts',
};

// HN глобальный сервис, точки условные по ЦОД
const GLOBAL_NODES = [
  { name: 'US East (Ashburn)',  lat: 39.0438, lng:  -77.4874 },
  { name: 'US West (SF)',        lat: 37.7749, lng: -122.4194 },
  { name: 'EU Central (Frank)',  lat: 50.1109, lng:    8.6821 },
  { name: 'Asia (Singapore)',    lat:  1.3521, lng:  103.8198 },
];

async function loadPosts() {
  let raw = null, fileUsed = null, parsed = null;
  for (const f of ['hackernews-top.json', 'hackernews.json']) {
    try {
      const content = await fs.readFile(join(BASKET_DIR, f), 'utf8');
      const p = JSON.parse(content);
      const arr = Array.isArray(p) ? p : Array.isArray(p.items) ? p.items : Array.isArray(p.data) ? p.data : null;
      if (arr && arr.length > 0) { raw = arr; fileUsed = f; parsed = p; break; }
    } catch {}
  }
  if (!raw) {
    const err = new Error('no_data'); err.statusCode = 503;
    err.hint = 'run scripts/collectors/collect-hackernews.mjs'; throw err;
  }

  const clean = raw.map(r => ({
    id: String(r.id || ''),
    title: r.title || 'Untitled',
    url: r.url || null,
    score: Number(r.score ?? r.points ?? 0),
    author: r.by || r.author || 'unknown',
    comments: Number(r.descendants ?? r.comments ?? 0),
    time: r.time ? new Date(r.time * 1000).toISOString() : (r.timestamp || null),
    text: r.text || null,
  })).filter(r => r.title);

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => b.score - a.score);
  return { items: clean, fileUsed, parsedMeta: { source: parsed.source || null, updated: parsed.updated || null } };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.min_score != null) { const n = parseInt(query.min_score, 10); if (Number.isFinite(n)) r = r.filter(x => x.score >= n); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.title.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const scores = rows.map(r => r.score);
  const comments = rows.map(r => r.comments);
  const totalScore = scores.reduce((a, b) => a + b, 0);
  const totalComments = comments.reduce((a, b) => a + b, 0);
  const top10 = rows.slice(0, 10).map(r => ({ title: r.title, score: r.score, author: r.author }));
  const byAuthor = {};
  for (const r of rows) byAuthor[r.author] = (byAuthor[r.author] || 0) + 1;
  const top_authors = Object.entries(byAuthor).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([author, count]) => ({ author, count }));
  return {
    count: rows.length,
    total_score: totalScore,
    max_score: Math.max(...scores),
    avg_score: +(totalScore / rows.length).toFixed(1),
    total_comments: totalComments,
    top_10: top10,
    top_authors,
  };
}

function toFeatureCollection(rows) {
  // Для карты — распределяем общее число постов и score по 4 узлам (условное представление)
  const totalScore = rows.reduce((s, r) => s + r.score, 0);
  const features = GLOBAL_NODES.map(n => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [n.lng, n.lat] },
    properties: {
      name: n.name,
      totalPosts: rows.length,
      totalScore,
      avgScore: rows.length > 0 ? +(totalScore / rows.length).toFixed(1) : 0,
      category: 'news',
      icon: meta.icon,
      color: meta.color,
    },
  }));
  return { type: 'FeatureCollection', features };
}

function envelopeMeta(full, filtered, parsedMeta) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    basket_source: parsedMeta.source,
    basket_updated: parsedMeta.updated,
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
  const lines = ['id,title,score,author,comments,url'];
  for (const r of rows) lines.push(`${r.id},"${r.title.replace(/"/g, '""')}",${r.score},${r.author},${r.comments},${r.url || ''}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const loaded = await loadPosts();
    const rows = applyFilters(loaded.items, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'hackernews-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(loaded.items, rows, loaded.parsedMeta) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(loaded.items, rows, loaded.parsedMeta) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(loaded.items, rows, loaded.parsedMeta),
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
