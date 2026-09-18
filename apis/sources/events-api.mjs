/**
 * apis/sources/events-api.mjs — API-МОДУЛЬ: ПОТОК СОБЫТИЙ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/events.json — [{ id, timestamp, source, severity, region, title, description, impact, lat?, lng? }] ИЛИ { data:[...] } ИЛИ { events:[...] }.
 * Сборщик: scripts/collectors/collect-events.mjs.
 *
 * Поток событий: инциденты из разных источников (NOTAM, GPS, ACLED, и т.д.).
 * Каждое событие имеет severity, source, region, impact. Если нет lat/lng —
 * координаты берутся по региону из встроенного справочника.
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?source=, ?severity=, ?region=, ?impact=, ?q=, ?since=, ?until=, ?limit=, ?top=, ?sort=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /stats /status /latest /critical /sources /regions /timeline /featurecollection
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'events.json');

export const route  = '/api/layers/events';
export const method = 'GET';

export const meta = {
  category: 'news',
  icon: '📢',
  color: '#ec4899',
  vizType: 'marker',
  source: 'basket/events.json',
  collector: 'collect-events.mjs',
  cache: 60,
  description: 'Поток событий: инциденты из разных источников (NOTAM, GPS, ACLED, и др.)',
  unit: 'events',
};

const SEVERITY_META = {
  critical: { color: '#dc2626', label: 'Критический', weight: 4 },
  high:     { color: '#f97316', label: 'Высокий',      weight: 3 },
  medium:   { color: '#eab308', label: 'Средний',      weight: 2 },
  low:      { color: '#22c55e', label: 'Низкий',       weight: 1 },
  info:     { color: '#64748b', label: 'Информация',   weight: 0 },
  unknown:  { color: '#6b7280', label: 'Неизвестно',   weight: 0 },
};

function severityOf(s) {
  const k = String(s || '').toLowerCase();
  return SEVERITY_META[k] || SEVERITY_META.unknown;
}

// Справочник координат регионов (для событий без lat/lng)
const REGION_COORDS = {
  'Восточная Европа': [50.0, 30.0],
  'Западная Европа': [50.0, 10.0],
  'Ближний Восток': [31.0, 40.0],
  'Северная Африка': [30.0, 15.0],
  'Южная Азия': [20.0, 78.0],
  'Восточная Азия': [35.0, 120.0],
  'Юго-Восточная Азия': [10.0, 110.0],
  'Северная Америка': [45.0, -100.0],
  'Южная Америка': [-20.0, -60.0],
  'Центральная Азия': [45.0, 65.0],
  'Кавказ': [42.0, 44.0],
  'Арктика': [75.0, 0.0],
  'Антарктика': [-80.0, 0.0],
  'Океания': [-25.0, 140.0],
  'Атлантика': [30.0, -30.0],
  'Тихий океан': [0.0, -160.0],
  'Индийский океан': [-10.0, 75.0],
  'Средиземное море': [35.0, 18.0],
  'Чёрное море': [43.0, 34.0],
  'Балтика': [58.0, 20.0],
  'Global': [0.0, 0.0],
  'GLOBAL': [0.0, 0.0],
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-events.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
  else if (parsed && Array.isArray(parsed.events)) arr = parsed.events;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }
  return arr;
}

function normalizeEvent(e, i) {
  let lat = Number(e.lat ?? e.latitude);
  let lng = Number(e.lng ?? e.lon ?? e.longitude);
  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && e.region && REGION_COORDS[e.region]) {
    const coords = REGION_COORDS[e.region];
    lat = coords[0];
    lng = coords[1];
  }
  const sev = severityOf(e.severity);
  return {
    id: String(e.id || `evt-${i}`),
    title: e.title || 'Untitled event',
    description: e.description || '',
    source: e.source || 'unknown',
    severity: String(e.severity || 'unknown').toLowerCase(),
    severityLabel: sev.label,
    color: sev.color,
    weight: sev.weight,
    region: e.region || null,
    impact: e.impact || null,
    timestamp: e.timestamp || e.date || null,
    date: String(e.timestamp || e.date || '').slice(0, 10) || null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    category: 'news',
    icon: meta.icon,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.source)   r = r.filter(x => String(x.source).toLowerCase().includes(String(query.source).toLowerCase()));
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.region)   r = r.filter(x => String(x.region || '').toLowerCase().includes(String(query.region).toLowerCase()));
  if (query.impact)   r = r.filter(x => String(x.impact || '').toLowerCase().includes(String(query.impact).toLowerCase()));
  if (query.q)        r = r.filter(x => (x.title + ' ' + x.description).toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.since)    r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  if (query.until)    r = r.filter(x => !x.date || x.date <= String(query.until).slice(0, 10));
  const sortKey = query.sort;
  if (sortKey === 'timestamp') r.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  else if (sortKey === 'severity') r.sort((a, b) => b.weight - a.weight);
  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0, unknown: 0 };
  const bySource = {};
  const byRegion = {};
  const byImpact = {};
  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    bySource[r.source] = (bySource[r.source] || 0) + 1;
    if (r.region) byRegion[r.region] = (byRegion[r.region] || 0) + 1;
    if (r.impact) byImpact[r.impact] = (byImpact[r.impact] || 0) + 1;
  }
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  const top = (obj, n = 10) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
  return {
    count: rows.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    by_severity: bySeverity,
    top_sources: top(bySource, 10),
    top_regions: top(byRegion, 10),
    by_impact: byImpact,
  };
}

function toFeatureCollection(rows) {
  const features = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, title: r.title, description: r.description,
        source: r.source, severity: r.severity, severityLabel: r.severityLabel,
        region: r.region, impact: r.impact, timestamp: r.timestamp, date: r.date,
        color: r.color, category: r.category, icon: r.icon,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    legend: Object.entries(SEVERITY_META).map(([key, def]) => ({ key, ...def })),
    meta: { total: rows.length, mapped: features.length, unmapped: rows.length - features.length },
  };
}

function toSeries(rows) { return rows.map(r => ({ id: r.id, title: r.title, source: r.source, severity: r.severity, region: r.region, date: r.date })); }

function toCSV(rows) {
  const lines = ['id,timestamp,source,severity,region,title,impact,lat,lng'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const r of rows) lines.push([r.id, r.timestamp, r.source, r.severity, r.region, r.title, r.impact, r.lat, r.lng].map(esc).join(','));
  return lines.join('\n') + '\n';
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

function groupBy(rows, keyFn) {
  const groups = {};
  for (const r of rows) {
    const k = keyFn(r);
    if (!k) continue;
    if (!groups[k]) groups[k] = [];
    groups[k].push({ id: r.id, title: r.title, severity: r.severity, source: r.source, date: r.date });
  }
  return groups;
}

function timeline(rows) {
  const byDate = {};
  for (const r of rows) {
    if (!r.date) continue;
    if (!byDate[r.date]) byDate[r.date] = { date: r.date, count: 0, by_severity: {} };
    byDate[r.date].count++;
    byDate[r.date].by_severity[r.severity] = (byDate[r.date].by_severity[r.severity] || 0) + 1;
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/events/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const rawArr = await loadData();
    const all = rawArr.map(normalizeEvent);
    const extra = {
      'X-Module': 'events-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all) }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, { status: 'online', count: all.length, generated_at: new Date().toISOString() }, extra);
    }
    if (sub === '/latest') {
      const latest = all.slice().sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || ''))).slice(0, 20);
      return sendJSON(res, 200, { latest, total: all.length, returned: latest.length }, extra);
    }
    if (sub === '/critical') {
      const crit = all.filter(r => r.severity === 'critical');
      return sendJSON(res, 200, { critical: crit, total: crit.length }, extra);
    }
    if (sub === '/sources') {
      const g = groupBy(all, r => r.source);
      return sendJSON(res, 200, { sources: g, total: Object.keys(g).length }, extra);
    }
    if (sub === '/regions') {
      const g = groupBy(all, r => r.region);
      return sendJSON(res, 200, { regions: g, total: Object.keys(g).length }, extra);
    }
    if (sub === '/timeline') {
      return sendJSON(res, 200, { timeline: timeline(all), days: timeline(all).length }, extra);
    }
    if (sub === '/featurecollection') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, meta: { total: all.length } }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_events: all.length, returned_events: rows.length,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      legend: fc.legend,
      series: toSeries(rows),
      stats: computeStats(rows),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
