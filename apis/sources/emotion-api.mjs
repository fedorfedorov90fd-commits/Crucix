/**
 * apis/sources/emotion-api.mjs — API-МОДУЛЬ: АНАЛИЗ ЭМОЦИЙ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/emotion.json (если есть) или data/emotion/analyses.json.
 * Сборщик: scripts/collectors/collect-emotion.mjs (если есть).
 *
 * 8 базовых эмоций: joy, sadness, anger, fear, surprise, disgust, trust, anticipation.
 * Плюс комплексный анализ тональности.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'emotion.json');

export const route  = '/api/layers/emotion';
export const method = 'GET';

export const meta = {
  category: 'semantic',
  icon: '😊',
  color: '#ffd700',
  vizType: 'marker',
  source: 'basket/emotion.json',
  collector: 'collect-emotion.mjs',
  cache: 300,
  description: 'Анализ эмоций в тексте (8 базовых эмоций + тональность)',
  unit: 'score',
};

const EMOTIONS = {
  joy:          { name: 'Радость',       icon: '😊', color: '#ffd700' },
  sadness:      { name: 'Печаль',        icon: '😢', color: '#5b8def' },
  anger:        { name: 'Гнев',          icon: '😡', color: '#ef4444' },
  fear:         { name: 'Страх',         icon: '😨', color: '#a855f7' },
  surprise:     { name: 'Удивление',     icon: '😮', color: '#f97316' },
  disgust:      { name: 'Отвращение',    icon: '🤢', color: '#22c55e' },
  trust:        { name: 'Доверие',       icon: '🤝', color: '#06b6d4' },
  anticipation: { name: 'Ожидание',      icon: '🔮', color: '#8b5cf6' },
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-emotion.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.analyses)) arr = parsed.analyses;
  else if (parsed && Array.isArray(parsed.data))     arr = parsed.data;
  else if (parsed && Array.isArray(parsed.items))    arr = parsed.items;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    const primary = String(r.primaryEmotion || r.primary || r.emotion || 'unknown').toLowerCase();
    return {
      text: r.text || r.title || r.summary || 'No text',
      primaryEmotion: primary,
      score: Number(r.score ?? r.value ?? r.intensity ?? 0),
      joy: Number(r.joy ?? 0), sadness: Number(r.sadness ?? 0), anger: Number(r.anger ?? 0),
      fear: Number(r.fear ?? 0), surprise: Number(r.surprise ?? 0), disgust: Number(r.disgust ?? 0),
      trust: Number(r.trust ?? 0), anticipation: Number(r.anticipation ?? 0),
      sentiment: r.sentiment != null ? Number(r.sentiment) : null,
      lat: Number(r.lat ?? r.latitude ?? 0),
      lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
      region: r.region || r.country || 'Global',
      source: r.source || null,
      timestamp: r.timestamp || null,
    };
  }).filter(r => r.text !== 'No text');

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.emotion) r = r.filter(x => x.primaryEmotion === String(query.emotion).toLowerCase());
  if (query.region) { const g = String(query.region).toLowerCase(); r = r.filter(x => x.region.toLowerCase().includes(g)); }
  if (query.min_score != null) { const n = parseFloat(query.min_score); if (Number.isFinite(n)) r = r.filter(x => x.score >= n); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.text.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byEmotion = {}, byRegion = {};
  for (const r of rows) {
    byEmotion[r.primaryEmotion] = (byEmotion[r.primaryEmotion] || 0) + 1;
    byRegion[r.region] = (byRegion[r.region] || 0) + 1;
  }
  const top_emotions = Object.entries(byEmotion).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([emotion, count]) => ({ emotion, count }));
  return { count: rows.length, by_emotion: byEmotion, by_region: byRegion, top_emotions };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const emo = EMOTIONS[r.primaryEmotion] || { name: r.primaryEmotion, icon: '❓', color: '#64748b' };
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        text: r.text, primaryEmotion: r.primaryEmotion, primaryLabel: emo.name,
        score: r.score, sentiment: r.sentiment,
        joy: r.joy, sadness: r.sadness, anger: r.anger, fear: r.fear,
        surprise: r.surprise, disgust: r.disgust, trust: r.trust, anticipation: r.anticipation,
        region: r.region, source: r.source, timestamp: r.timestamp,
        color: emo.color, icon: emo.icon,
        category: 'semantic',
      },
    };
  });
  return {
    type: 'FeatureCollection',
    emotions: Object.entries(EMOTIONS).map(([k, v]) => ({ emotion: k, ...v })),
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_analyses: full.length, returned_analyses: filtered.length,
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
  const lines = ['text,primaryEmotion,score,sentiment,region,timestamp'];
  for (const r of rows) lines.push(`"${r.text.replace(/"/g, '""')}",${r.primaryEmotion},${r.score},${r.sentiment ?? ''},${r.region},${r.timestamp || ''}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadData();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'emotion-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(full, rows),
      emotions: fc.emotions,
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
