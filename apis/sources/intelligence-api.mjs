/**
 * apis/sources/intelligence-api.mjs — API-МОДУЛЬ: РАЗВЕДКА
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/intel-feed.json — { items: [{ id, title, summary, source, channel, severity, lat, lon, timestamp }] }.
 * Сборщик: scripts/collectors/collect-intel-feed.mjs.
 *
 * Разведывательные сигналы по каналам: MIL (военные), OSINT, HUMINT, SIGINT.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'intel-feed.json');

export const route  = '/api/layers/intelligence';
export const method = 'GET';

export const meta = {
  category: 'intelligence',
  icon: '🧠',
  color: '#6600cc',
  vizType: 'marker',
  source: 'basket/intel-feed.json',
  collector: 'collect-intel-feed.mjs',
  cache: 120,
  description: 'Разведывательные сигналы по каналам (MIL, OSINT, HUMINT, SIGINT)',
  unit: 'items',
};

const CHANNEL_STYLE = {
  'MIL':     { color: '#dc2626', label: 'Военный' },
  'OSINT':   { color: '#3b82f6', label: 'Открытые источники' },
  'HUMINT':  { color: '#a21caf', label: 'Агентурная' },
  'SIGINT':  { color: '#f97316', label: 'Радиоразведка' },
  'IMINT':   { color: '#eab308', label: 'Видеоразведка' },
  'GEOINT':  { color: '#22c55e', label: 'Геопространственная' },
  'CYBER':   { color: '#8b5cf6', label: 'Кибер' },
  'TEST':    { color: '#64748b', label: 'Тест' },
};

const SEVERITY_COLOR = { 'INFO': '#22c55e', 'LOW': '#84cc16', 'MEDIUM': '#eab308', 'HIGH': '#f97316', 'CRITICAL': '#dc2626' };

async function loadItems() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-intel-feed.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.items)) arr = parsed.items;
  else if (parsed && Array.isArray(parsed.data))  arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => ({
    id: r.id || 'unknown',
    title: r.title || 'Untitled',
    summary: r.summary || r.description || '',
    source: r.source || null,
    sources: Array.isArray(r.sources) ? r.sources : (r.source ? [r.source] : []),
    sourceCount: Number(r.sourceCount ?? 1),
    channel: (r.channel || 'OSINT').toUpperCase(),
    url: r.url || null,
    lat: r.lat != null ? Number(r.lat) : (r.latitude != null ? Number(r.latitude) : null),
    lng: r.lng != null ? Number(r.lng) : (r.lon != null ? Number(r.lon) : (r.longitude != null ? Number(r.longitude) : null)),
    country: r.country || null,
    tags: Array.isArray(r.tags) ? r.tags : [],
    severity: String(r.severity || r.severityScore || 'INFO').toUpperCase(),
    timestamp: r.timestamp || r.createdAt || null,
  }));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.channel) r = r.filter(x => x.channel === String(query.channel).toUpperCase());
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toUpperCase());
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => (x.country || '').toLowerCase().includes(c)); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => (x.title + ' ' + x.summary).toLowerCase().includes(q)); }
  if (query.min_sources != null) { const n = parseInt(query.min_sources, 10); if (Number.isFinite(n)) r = r.filter(x => x.sourceCount >= n); }
  if (query.since) r = r.filter(x => (x.timestamp || '') >= String(query.since));
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byChannel = {}, bySeverity = {}, byCountry = {};
  for (const r of rows) {
    byChannel[r.channel] = (byChannel[r.channel] || 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
  }
  const top_channels = Object.entries(byChannel).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  const top_countries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  return { count: rows.length, by_channel: byChannel, by_severity: bySeverity, top_channels, top_countries };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat != null && r.lng != null).map(r => {
    const ch = CHANNEL_STYLE[r.channel] || { color: '#64748b', label: r.channel };
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, title: r.title, summary: r.summary,
        source: r.source, sourceCount: r.sourceCount,
        channel: r.channel, channelLabel: ch.label,
        severity: r.severity, severityColor: SEVERITY_COLOR[r.severity] || SEVERITY_COLOR.INFO,
        country: r.country, url: r.url, tags: r.tags, timestamp: r.timestamp,
        color: ch.color,
        category: 'intelligence', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    channels: Object.entries(CHANNEL_STYLE).map(([k, v]) => ({ channel: k, ...v })),
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_items: full.length, returned_items: filtered.length,
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
  const lines = ['id,title,channel,severity,country,sources,timestamp'];
  for (const r of rows) lines.push(`${r.id},"${r.title.replace(/"/g, '""')}",${r.channel},${r.severity},${r.country || ''},${r.sourceCount},${r.timestamp || ''}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadItems();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'intelligence-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(full, rows),
      channels: fc.channels,
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
