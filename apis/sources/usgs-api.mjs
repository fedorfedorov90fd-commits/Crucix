/**
 * apis/sources/usgs-api.mjs — API-МОДУЛЬ: ЗЕМЛЕТРЯСЕНИЯ USGS
 *
 * КОНТРАКТ CRUCIX v2 (Layer, read-only).
 * ИСТОЧНИК: data/basket/usgs.json — массив объектов:
 *   { place, magnitude, country, lat, lng, severity, timestamp, depth? }
 * Сборщик: scripts/collectors/collect-usgs.mjs.
 *
 * Землетрясения по данным USGS: магнитуда, глубина, координаты, регион.
 * Аналитика по шкале Рихтера, severity, кластеры, timeline.
 *
 * ПУБЛИЧНЫЕ ЭНДПОИНТЫ (20):
 *   GET /                       — корень (FC + series + stats)
 *   GET /status                 — health-check
 *   GET /data                   — совместимо с прототипом (сырые данные)
 *   GET /feed                   — список (фильтры)
 *   GET /latest                 — последние N
 *   GET /featurecollection      — чистый GeoJSON
 *   GET /stats                  — статистика
 *   GET /magnitude              — по шкале Рихтера (tiers)
 *   GET /severity               — по severity (LOW/MEDIUM/HIGH/CRITICAL)
 *   GET /depth                  — по глубине (если есть)
 *   GET /regions                — по регионам (парсинг place)
 *   GET /countries              — по странам
 *   GET /top                    — топ-N по магнитуде
 *   GET /recent?hours=          — за последние N часов
 *   GET /timeline               — динамика по дням
 *   GET /clusters               — кластеры (bbox-группировка)
 *   GET /search?q=              — поиск по place
 *   GET /render                 — рендер-конфиг
 *   GET /markdown               — отчёт (text/markdown)
 *
 * ФОРМАТЫ: json, csv, series, stats, raw, geojson, markdown.
 * ФИЛЬТРЫ: ?min_mag=, ?max_mag=, ?severity=, ?country=, ?region=, ?q=, ?since=, ?until=, ?limit=, ?top=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadWithFallback } from './lib/basket-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE = join(PROJECT_ROOT, 'data', 'basket', 'usgs.json');

export const route  = '/api/layers/usgs';
export const method = 'GET';

export const meta = {
  category: 'ecological',
  icon: '🌋',
  color: '#ff8800',
  vizType: 'marker',
  source: 'basket/usgs.json',
  collector: 'collect-usgs.mjs',
  cache: 300,
  description: 'Землетрясения USGS: магнитуда, глубина, регионы, кластеры, timeline',
  unit: 'earthquakes',
};

// ============================================================
//  СПРАВОЧНИКИ
// ============================================================

/** Шкала Рихтера: классы магнитуды. */
const MAGNITUDE_TIERS = [
  { key: 'great',    min: 8.0,  color: '#7c3aed', label: 'Великое (>=8.0)' },
  { key: 'major',    min: 7.0,  color: '#dc2626', label: 'Крупное (7.0-7.9)' },
  { key: 'strong',   min: 6.0,  color: '#f97316', label: 'Сильное (6.0-6.9)' },
  { key: 'moderate', min: 5.0,  color: '#eab308', label: 'Умеренное (5.0-5.9)' },
  { key: 'light',    min: 4.0,  color: '#84cc16', label: 'Лёгкое (4.0-4.9)' },
  { key: 'minor',    min: 2.0,  color: '#22c55e', label: 'Слабое (2.0-3.9)' },
  { key: 'micro',    min: 0,    color: '#64748b', label: 'Микро (<2.0)' },
];

const SEVERITY_META = {
  critical: { color: '#dc2626', weight: 4, label: 'Критический' },
  high:     { color: '#f97316', weight: 3, label: 'Высокий' },
  medium:   { color: '#eab308', weight: 2, label: 'Средний' },
  low:      { color: '#22c55e', weight: 1, label: 'Низкий' },
  unknown:  { color: '#94a3b8', weight: 0, label: 'Неизвестно' },
};

const DEPTH_TIERS = [
  { key: 'deep',     min: 300, color: '#7c3aed', label: 'Глубокое (>300 км)' },
  { key: 'inter',    min: 70,  color: '#0ea5e9', label: 'Промежуточное (70-300)' },
  { key: 'shallow',  min: 0,   color: '#22c55e', label: 'Мелкое (<70 км)' },
];

// ============================================================
//  УТИЛИТЫ
// ============================================================

function tierOf(value, tiers) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  for (const t of tiers) if (n >= t.min) return t;
  return tiers[tiers.length - 1];
}

function severityOf(s) {
  const k = String(s || '').toLowerCase();
  return SEVERITY_META[k] || SEVERITY_META.unknown;
}

/**
 * Извлекает регион из place.
 * Пример: "48 km SSE of Nelchina, Alaska" → "Alaska"
 *         "21 km SSE of Pāhala, Hawaii" → "Hawaii"
 *         "243 km E of Levuka, Fiji" → "Fiji"
 */
function extractRegion(place) {
  if (!place || typeof place !== 'string') return null;
  const parts = place.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1];
  return parts[0] || null;
}

function parseTimestamp(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatBytes(n) {
  if (!Number.isFinite(n)) return '0';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// ============================================================
//  ЗАГРУЗКА
// ============================================================

async function loadEarthquakes() {
  const result = await loadWithFallback({
    basketFile: BASKET_FILE,
    fallbackData: [],
    hint: 'запустите scripts/collectors/collect-usgs.mjs',
  });

  let arr = result.data;
  if (!Array.isArray(arr)) {
    if (arr && Array.isArray(arr.earthquakes)) arr = arr.earthquakes;
    else if (arr && Array.isArray(arr.data)) arr = arr.data;
    else if (arr && arr.type === 'FeatureCollection' && Array.isArray(arr.features)) arr = arr.features;
    else arr = [];
  }
  return { arr, source: result.source, hint: result.hint, error: result.error };
}

// ============================================================
//  НОРМАЛИЗАЦИЯ
// ============================================================

function normalizeQuake(e, i) {
  // GeoJSON Feature
  if (e && e.type === 'Feature') {
    const coords = e.geometry?.coordinates || [0, 0];
    const p = e.properties || {};
    return buildQuake({
      id: p.id || e.id,
      place: p.place || p.name,
      magnitude: p.magnitude ?? p.mag,
      country: p.country,
      lat: Number(coords[1]),
      lng: Number(coords[0]),
      severity: p.severity,
      timestamp: p.timestamp || p.time,
      depth: p.depth,
    }, i);
  }
  return buildQuake({
    id: e.id,
    place: e.place || e.name,
    magnitude: e.magnitude ?? e.mag,
    country: e.country,
    lat: e.lat ?? e.latitude,
    lng: e.lng ?? e.lon ?? e.longitude,
    severity: e.severity,
    timestamp: e.timestamp || e.time || e.date,
    depth: e.depth,
  }, i);
}

function buildQuake(input, i) {
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  const mag = Number(input.magnitude);
  const depth = input.depth != null ? Number(input.depth) : null;
  const magTier = Number.isFinite(mag) ? tierOf(mag, MAGNITUDE_TIERS) : null;
  const sevMeta = severityOf(input.severity);
  const depthTier = depth != null && Number.isFinite(depth) ? tierOf(depth, DEPTH_TIERS) : null;

  return {
    id: String(input.id || `eq-${i}`),
    place: input.place || 'Unknown',
    region: extractRegion(input.place),
    country: input.country || 'Global',
    magnitude: Number.isFinite(mag) ? Number(mag.toFixed(2)) : null,
    magnitudeTier: magTier ? magTier.key : null,
    magnitudeLabel: magTier ? magTier.label : null,
    magnitudeColor: magTier ? magTier.color : '#64748b',
    lat: Number.isFinite(lat) ? Number(lat.toFixed(4)) : null,
    lng: Number.isFinite(lng) ? Number(lng.toFixed(4)) : null,
    depth: depth != null && Number.isFinite(depth) ? Number(depth.toFixed(1)) : null,
    depthTier: depthTier ? depthTier.key : null,
    depthLabel: depthTier ? depthTier.label : null,
    depthColor: depthTier ? depthTier.color : '#64748b',
    severity: String(input.severity || 'unknown').toLowerCase(),
    severityLabel: sevMeta.label,
    severityColor: sevMeta.color,
    severityWeight: sevMeta.weight,
    timestamp: parseTimestamp(input.timestamp),
    date: parseTimestamp(input.timestamp)?.slice(0, 10) || null,
    category: 'ecological',
    icon: meta.icon,
  };
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(quakes, query) {
  let r = quakes.slice();

  if (query.min_mag != null) { const n = Number(query.min_mag); if (Number.isFinite(n)) r = r.filter(x => x.magnitude != null && x.magnitude >= n); }
  if (query.max_mag != null) { const n = Number(query.max_mag); if (Number.isFinite(n)) r = r.filter(x => x.magnitude != null && x.magnitude <= n); }
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.country)  r = r.filter(x => String(x.country).toLowerCase().includes(String(query.country).toLowerCase()));
  if (query.region)   r = r.filter(x => String(x.region || '').toLowerCase().includes(String(query.region).toLowerCase()));
  if (query.magnitude_tier) r = r.filter(x => x.magnitudeTier === String(query.magnitude_tier));
  if (query.depth_tier) r = r.filter(x => x.depthTier === String(query.depth_tier));
  if (query.q) {
    const s = String(query.q).toLowerCase();
    r = r.filter(x => (x.place + ' ' + x.country + ' ' + (x.region || '')).toLowerCase().includes(s));
  }
  if (query.since) {
    const t = new Date(query.since).getTime();
    if (Number.isFinite(t)) r = r.filter(x => !x.timestamp || new Date(x.timestamp).getTime() >= t);
  }
  if (query.until) {
    const t = new Date(query.until).getTime();
    if (Number.isFinite(t)) r = r.filter(x => !x.timestamp || new Date(x.timestamp).getTime() <= t);
  }
  if (query.hours) {
    const hours = Number(query.hours);
    if (Number.isFinite(hours) && hours > 0) {
      const cutoff = Date.now() - hours * 3600000;
      r = r.filter(x => !x.timestamp || new Date(x.timestamp).getTime() >= cutoff);
    }
  }

  const sortKey = query.sort;
  if (sortKey === 'magnitude-desc') r.sort((a, b) => (b.magnitude ?? -1) - (a.magnitude ?? -1));
  else if (sortKey === 'magnitude-asc') r.sort((a, b) => (a.magnitude ?? Infinity) - (b.magnitude ?? Infinity));
  else if (sortKey === 'time-desc') r.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  else if (sortKey === 'time-asc')  r.sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));
  else if (sortKey === 'depth-desc') r.sort((a, b) => (b.depth ?? -1) - (a.depth ?? -1));
  else if (sortKey === 'severity')   r.sort((a, b) => b.severityWeight - a.severityWeight);
  else if (!sortKey) r.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(quakes) {
  const byMagnitude = {};
  const bySeverity = {};
  const byCountry = {};
  const byRegion = {};
  const magnitudes = [];
  const depths = [];

  for (const q of quakes) {
    if (q.magnitudeTier) byMagnitude[q.magnitudeTier] = (byMagnitude[q.magnitudeTier] || 0) + 1;
    bySeverity[q.severity] = (bySeverity[q.severity] || 0) + 1;
    byCountry[q.country] = (byCountry[q.country] || 0) + 1;
    if (q.region) byRegion[q.region] = (byRegion[q.region] || 0) + 1;
    if (q.magnitude != null) magnitudes.push(q.magnitude);
    if (q.depth != null) depths.push(q.depth);
  }

  const top = (obj, n = 10) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
  const sum = a => a.reduce((x, y) => x + y, 0);
  const mean = a => a.length ? sum(a) / a.length : null;

  const dates = quakes.map(q => q.timestamp).filter(Boolean).sort();
  const last = quakes.slice(-1)[0] || null;

  return {
    total: quakes.length,
    with_magnitude: magnitudes.length,
    with_depth: depths.length,
    with_coords: quakes.filter(q => q.lat != null && q.lng != null).length,
    magnitude: magnitudes.length ? {
      max: Math.max(...magnitudes),
      min: Math.min(...magnitudes),
      mean: Number(mean(magnitudes).toFixed(2)),
      sum: Number(sum(magnitudes).toFixed(2)),
    } : null,
    depth: depths.length ? {
      max: Math.max(...depths),
      min: Math.min(...depths),
      mean: Number(mean(depths).toFixed(1)),
    } : null,
    strongest: quakes.slice().sort((a, b) => (b.magnitude ?? -1) - (a.magnitude ?? -1))[0] || null,
    latest: last,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    by_magnitude_tier: byMagnitude,
    by_severity: bySeverity,
    top_countries: top(byCountry, 15),
    top_regions: top(byRegion, 15),
  };
}

// ============================================================
//  АНАЛИТИКА
// ============================================================

function computeTimeline(quakes) {
  const byDay = {};
  for (const q of quakes) {
    if (!q.date) continue;
    if (!byDay[q.date]) byDay[q.date] = { date: q.date, count: 0, max_magnitude: 0, by_severity: {} };
    byDay[q.date].count++;
    if (q.magnitude != null && q.magnitude > byDay[q.date].max_magnitude) byDay[q.date].max_magnitude = q.magnitude;
    byDay[q.date].by_severity[q.severity] = (byDay[q.date].by_severity[q.severity] || 0) + 1;
  }
  return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Кластеры: группировка по bbox-grid.
 * Каждая ячейка gridSize×gridSize градусов.
 */
function computeClusters(quakes, gridSize = 5) {
  const cells = {};
  for (const q of quakes) {
    if (q.lat == null || q.lng == null) continue;
    const gx = Math.floor(q.lng / gridSize);
    const gy = Math.floor(q.lat / gridSize);
    const key = `${gx},${gy}`;
    if (!cells[key]) cells[key] = { key, grid: [gx, gy], gridSize, count: 0, earthquakes: [], max_magnitude: 0, lat: 0, lng: 0 };
    cells[key].count++;
    cells[key].earthquakes.push({ id: q.id, place: q.place, magnitude: q.magnitude, lat: q.lat, lng: q.lng, severity: q.severity });
    if (q.magnitude != null && q.magnitude > cells[key].max_magnitude) cells[key].max_magnitude = q.magnitude;
  }
  // Центроид каждой ячейки
  const result = [];
  for (const c of Object.values(cells)) {
    const avgLat = c.earthquakes.reduce((s, e) => s + e.lat, 0) / c.count;
    const avgLng = c.earthquakes.reduce((s, e) => s + e.lng, 0) / c.count;
    result.push({
      key: c.key,
      grid: c.grid,
      gridSize: c.gridSize,
      count: c.count,
      max_magnitude: c.max_magnitude,
      center: { lat: Number(avgLat.toFixed(4)), lng: Number(avgLng.toFixed(4)) },
      earthquakes: c.earthquakes.slice(0, 50),
    });
  }
  return result.sort((a, b) => b.count - a.count);
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(quakes) {
  const features = quakes
    .filter(q => Number.isFinite(q.lat) && Number.isFinite(q.lng))
    .map(q => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [q.lng, q.lat, q.depth || 0] },
      properties: {
        id: q.id, place: q.place, region: q.region, country: q.country,
        magnitude: q.magnitude, magnitudeTier: q.magnitudeTier, magnitudeLabel: q.magnitudeLabel,
        depth: q.depth, depthTier: q.depthTier,
        severity: q.severity, severityLabel: q.severityLabel,
        timestamp: q.timestamp, date: q.date,
        color: q.magnitudeColor, icon: q.icon, category: q.category,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    legend: {
      magnitudes: MAGNITUDE_TIERS.map(t => ({ key: t.key, min: t.min, color: t.color, label: t.label })),
      severities: Object.entries(SEVERITY_META).map(([key, def]) => ({ key, ...def })),
      depths: DEPTH_TIERS.map(t => ({ key: t.key, min: t.min, color: t.color, label: t.label })),
    },
    meta: { total: quakes.length, mapped: features.length, unmapped: quakes.length - features.length },
  };
}

function toSeries(quakes) {
  return quakes.map(q => ({
    id: q.id, place: q.place, region: q.region, magnitude: q.magnitude,
    depth: q.depth, severity: q.severity, timestamp: q.timestamp,
  }));
}

function toCSV(quakes) {
  const lines = ['id,place,region,country,magnitude,depth,severity,lat,lng,timestamp'];
  const esc = v => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  for (const q of quakes) {
    lines.push([q.id, q.place, q.region, q.country, q.magnitude, q.depth, q.severity, q.lat, q.lng, q.timestamp].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function toMarkdown(quakes, title = 'Землетрясения USGS') {
  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`_Сгенерировано: ${new Date().toISOString()}_`);
  lines.push('');
  lines.push(`**Всего записей:** ${quakes.length}`);
  lines.push('');
  const strongest = quakes.slice().sort((a, b) => (b.magnitude ?? -1) - (a.magnitude ?? -1)).slice(0, 10);
  if (strongest.length > 0) {
    lines.push('## Топ-10 по магнитуде');
    lines.push('');
    lines.push('| Магнитуда | Место | Глубина | Severity | Дата |');
    lines.push('|-----------|-------|---------|----------|------|');
    for (const q of strongest) {
      lines.push(`| ${q.magnitude ?? '—'} | ${q.place} | ${q.depth ?? '—'} | ${q.severityLabel} | ${q.date || '—'} |`);
    }
  }
  return lines.join('\n') + '\n';
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(body)), ...extra });
  res.end(body);
}

function sendText(res, status, text, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text, 'utf8')) });
  res.end(text);
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  const extra = {
    'X-Module': 'usgs-api',
    'X-Module-Version': '2.0.0',
    'Cache-Control': `public, max-age=${meta.cache}`,
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/usgs/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      res.end();
      return;
    }

    // Загрузка с локальным try/catch
    let loaded;
    try { loaded = await loadEarthquakes(); }
    catch (e) {
      return sendJSON(res, 500, {
        success: false,
        error: 'load_error',
        message: e.message,
        hint: e.hint || null,
      }, extra);
    }

    const { arr: raw, source: dataSource, hint } = loaded;
    const all = raw.map(normalizeQuake);

    // ============================================================
    //  /status
    // ============================================================
    if (sub === '/status') {
      return sendJSON(res, 200, {
        success: true,
        module: 'usgs',
        status: 'online',
        count: all.length,
        max_magnitude: all.reduce((m, q) => Math.max(m, q.magnitude ?? 0), 0),
        source: dataSource,
        hint: dataSource === 'fallback' ? hint : null,
        timestamp: new Date().toISOString(),
      }, extra);
    }

    // ============================================================
    //  /data — совместимо с прототипом
    // ============================================================
    if (sub === '/data') {
      return sendJSON(res, 200, { success: true, data: all, count: all.length, source: dataSource }, extra);
    }

    // ============================================================
    //  /feed, /, ''
    // ============================================================
    if (sub === '/feed' || sub === '/' || sub === '') {
      const rows = applyFilters(all, query);

      if (format === 'csv') return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
      if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), count: rows.length }, extra);
      if (format === 'raw') return sendJSON(res, 200, { data: rows, total: all.length, source: dataSource }, extra);
      if (format === 'geojson') return sendJSON(res, 200, toFeatureCollection(rows), extra);
      if (format === 'markdown') return sendText(res, 200, toMarkdown(rows), 'text/markdown; charset=utf-8');

      const fc = toFeatureCollection(rows);
      return sendJSON(res, 200, {
        success: true,
        type: 'FeatureCollection',
        meta: {
          source: meta.source, category: meta.category, unit: meta.unit,
          total_records: all.length, returned_records: rows.length,
          data_source: dataSource,
          hint: dataSource === 'fallback' ? hint : null,
          generated_at: new Date().toISOString(),
        },
        features: fc.features,
        legend: fc.legend,
        series: toSeries(rows),
        stats: computeStats(rows),
      }, extra);
    }

    // ============================================================
    //  /latest
    // ============================================================
    if (sub === '/latest') {
      const n = parseInt(query.n, 10) || 20;
      const sorted = all.slice().sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
      return sendJSON(res, 200, { latest: sorted.slice(0, n), count: Math.min(n, all.length) }, extra);
    }

    // ============================================================
    //  /featurecollection
    // ============================================================
    if (sub === '/featurecollection') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }

    // ============================================================
    //  /stats
    // ============================================================
    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, {
        success: true,
        stats: computeStats(all),
        source: dataSource,
        hint: dataSource === 'fallback' ? hint : null,
      }, extra);
    }

    // ============================================================
    //  /magnitude
    // ============================================================
    if (sub === '/magnitude') {
      const byTier = {};
      for (const q of all) {
        if (!q.magnitudeTier) continue;
        if (!byTier[q.magnitudeTier]) byTier[q.magnitudeTier] = { tier: q.magnitudeTier, label: q.magnitudeLabel, color: q.magnitudeColor, count: 0, earthquakes: [] };
        byTier[q.magnitudeTier].count++;
        if (byTier[q.magnitudeTier].earthquakes.length < 30) {
          byTier[q.magnitudeTier].earthquakes.push({ id: q.id, place: q.place, magnitude: q.magnitude, date: q.date });
        }
      }
      return sendJSON(res, 200, {
        success: true,
        tiers: Object.values(byTier),
        tiers_meta: MAGNITUDE_TIERS,
        total_tiers: Object.keys(byTier).length,
      }, extra);
    }

    // ============================================================
    //  /severity
    // ============================================================
    if (sub === '/severity') {
      const bySeverity = {};
      for (const q of all) {
        if (!bySeverity[q.severity]) bySeverity[q.severity] = { severity: q.severity, label: q.severityLabel, color: q.severityColor, weight: q.severityWeight, count: 0 };
        bySeverity[q.severity].count++;
      }
      const list = Object.values(bySeverity).sort((a, b) => b.weight - a.weight);
      return sendJSON(res, 200, { success: true, severities: list, total: list.length }, extra);
    }

    // ============================================================
    //  /depth
    // ============================================================
    if (sub === '/depth') {
      const withDepth = all.filter(q => q.depth != null);
      const byTier = {};
      for (const q of withDepth) {
        if (!q.depthTier) continue;
        if (!byTier[q.depthTier]) byTier[q.depthTier] = { tier: q.depthTier, label: q.depthLabel, color: q.depthColor, count: 0 };
        byTier[q.depthTier].count++;
      }
      const sorted = withDepth.slice().sort((a, b) => b.depth - a.depth).slice(0, 20);
      return sendJSON(res, 200, {
        success: true,
        with_depth: withDepth.length,
        tiers: Object.values(byTier),
        tiers_meta: DEPTH_TIERS,
        deepest: sorted.map(q => ({ id: q.id, place: q.place, depth: q.depth, magnitude: q.magnitude })),
      }, extra);
    }

    // ============================================================
    //  /regions
    // ============================================================
    if (sub === '/regions') {
      const byRegion = {};
      for (const q of all) {
        if (!q.region) continue;
        if (!byRegion[q.region]) byRegion[q.region] = { region: q.region, count: 0, max_magnitude: 0 };
        byRegion[q.region].count++;
        if (q.magnitude != null && q.magnitude > byRegion[q.region].max_magnitude) byRegion[q.region].max_magnitude = q.magnitude;
      }
      const list = Object.values(byRegion).sort((a, b) => b.count - a.count);
      return sendJSON(res, 200, { success: true, regions: list, total: list.length }, extra);
    }

    // ============================================================
    //  /countries
    // ============================================================
    if (sub === '/countries') {
      const byCountry = {};
      for (const q of all) {
        if (!byCountry[q.country]) byCountry[q.country] = { country: q.country, count: 0, max_magnitude: 0 };
        byCountry[q.country].count++;
        if (q.magnitude != null && q.magnitude > byCountry[q.country].max_magnitude) byCountry[q.country].max_magnitude = q.magnitude;
      }
      const list = Object.values(byCountry).sort((a, b) => b.count - a.count);
      return sendJSON(res, 200, { success: true, countries: list, total: list.length }, extra);
    }

    // ============================================================
    //  /top
    // ============================================================
    if (sub === '/top') {
      const n = Math.min(parseInt(query.n, 10) || 10, 100);
      const list = all.slice().sort((a, b) => (b.magnitude ?? -1) - (a.magnitude ?? -1)).slice(0, n);
      return sendJSON(res, 200, { success: true, top: list, n, count: list.length }, extra);
    }

    // ============================================================
    //  /recent
    // ============================================================
    if (sub === '/recent') {
      const hours = parseInt(query.hours, 10) || 24;
      const cutoff = Date.now() - hours * 3600000;
      const recent = all.filter(q => q.timestamp && new Date(q.timestamp).getTime() >= cutoff);
      return sendJSON(res, 200, { success: true, hours, count: recent.length, earthquakes: recent.slice(0, 100) }, extra);
    }

    // ============================================================
    //  /timeline
    // ============================================================
    if (sub === '/timeline') {
      const timeline = computeTimeline(all);
      return sendJSON(res, 200, { success: true, timeline, days: timeline.length }, extra);
    }

    // ============================================================
    //  /clusters
    // ============================================================
    if (sub === '/clusters') {
      const gridSize = Number(query.grid) || 5;
      const clusters = computeClusters(all, gridSize);
      return sendJSON(res, 200, {
        success: true,
        grid_size: gridSize,
        clusters,
        total: clusters.length,
      }, extra);
    }

    // ============================================================
    //  /search
    // ============================================================
    if (sub === '/search') {
      const q = String(query.q || '').toLowerCase().trim();
      if (!q) return sendJSON(res, 400, { success: false, error: 'field_required: q' }, extra);
      const results = all.filter(x => (x.place + ' ' + x.country + ' ' + (x.region || '')).toLowerCase().includes(q));
      return sendJSON(res, 200, { success: true, query: q, count: results.length, results }, extra);
    }

    // ============================================================
    //  /render
    // ============================================================
    if (sub === '/render') {
      const rows = applyFilters(all, query);
      const fc = toFeatureCollection(rows);
      return sendJSON(res, 200, {
        render: {
          type: 'map',
          markers: fc.features,
          legend: fc.legend,
          stats: computeStats(rows),
          clusters: computeClusters(rows, 5).slice(0, 50),
          source: dataSource,
        },
      }, extra);
    }

    // ============================================================
    //  /markdown
    // ============================================================
    if (sub === '/markdown') {
      const rows = applyFilters(all, query);
      return sendText(res, 200, toMarkdown(rows), 'text/markdown; charset=utf-8');
    }

    // ============================================================
    //  Не найдено
    // ============================================================
    return sendJSON(res, 404, {
      success: false,
      error: 'endpoint_not_found',
      path: sub,
      available: ['/', '/status', '/data', '/feed', '/latest', '/featurecollection', '/stats', '/magnitude', '/severity', '/depth', '/regions', '/countries', '/top', '/recent', '/timeline', '/clusters', '/search', '/render', '/markdown'],
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { success: false, error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload, extra); } catch {}
  }
}
