/**
 * apis/sources/risk-heatmap-api.mjs — API-МОДУЛЬ: ТЕПЛОВАЯ КАРТА РИСКОВ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/risk-heatmap.json — [{ region, risk, lat?, lng?, sources?, drivers?, date? }] ИЛИ { data:[...] } ИЛИ { grid:[{ lat, lng, value }] }.
 * Сборщик: scripts/collectors/collect-risk-heatmap.mjs.
 *
 * Тепловая карта глобальных рисков. Агрегирует риск-показатели по регионам,
 * строит сетку (grid) для визуализации через Leaflet.heat, поддерживает
 * несколько режимов: точки (markers), сетка (grid), регионы (choropleth),
 * кластеры (cluster), аномалии (anomaly).
 *
 * ФОРМАТЫ: json (FC + grid + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?region=, ?tier=, ?min=, ?max=, ?q=, ?since=, ?limit=, ?top=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /                    — корень (список эндпоинтов + версия)
 *   GET /stats               — агрегированная статистика
 *   GET /status              — health-check
 *   GET /latest              — топ-N по риску
 *   GET /regions             — группировка по регионам
 *   GET /tiers               — группировка по tier (low/medium/high/critical)
 *   GET /grid                — 2D-сетка для heatmap (?step=15)
 *   GET /clusters            — кластеры точек (?radius=25)
 *   GET /anomalies           — выбросы (риск > mean + 2*stddev)
 *   GET /trend               — динамика за 7 vs 7
 *   GET /sources             — источники рисков (агрегация)
 *   GET /drivers             — драйверы рисков (агрегация)
 *   GET /choropleth          — данные для заливки регионов
 *   GET /featurecollection   — чистый GeoJSON
 *   GET /render              — готовый рендер-конфиг для Leaflet (heat + markers + choropleth)
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'risk-heatmap.json');

export const route  = '/api/layers/risk-heatmap';
export const method = 'GET';

export const meta = {
  category: 'index',
  icon: '🔥',
  color: '#dc2626',
  vizType: 'heatmap',
  source: 'basket/risk-heatmap.json',
  collector: 'collect-risk-heatmap.mjs',
  cache: 120,
  description: 'Тепловая карта глобальных рисков: регионы, сетка, кластеры, аномалии',
  unit: 'risk',
};

// ============================================================
//  КОНСТАНТЫ
// ============================================================

const TIERS = {
  critical: { min: 80, max: 101, color: '#dc2626', label: 'Критический' },
  high:     { min: 60, max: 80,  color: '#f97316', label: 'Высокий' },
  medium:   { min: 40, max: 60,  color: '#eab308', label: 'Средний' },
  low:      { min: 20, max: 40,  color: '#84cc16', label: 'Низкий' },
  minimal:  { min: 0,  max: 20,  color: '#22c55e', label: 'Минимальный' },
};

// Справочник координат регионов (для нормализации входных данных)
const REGION_COORDS = {
  'Europe':          [50.0, 15.0],
  'Западная Европа': [50.0, 10.0],
  'Восточная Европа':[50.0, 30.0],
  'Middle East':     [31.0, 40.0],
  'Ближний Восток':  [31.0, 40.0],
  'Asia':            [35.0, 100.0],
  'Азия':            [35.0, 100.0],
  'Asia-Pacific':    [10.0, 110.0],
  'Africa':          [0.0, 20.0],
  'Африка':          [0.0, 20.0],
  'North America':   [45.0, -100.0],
  'Северная Америка':[45.0, -100.0],
  'South America':   [-20.0, -60.0],
  'Latin America':   [-15.0, -60.0],
  'Латинская Америка':[-15.0, -60.0],
  'Arctic':          [75.0, 0.0],
  'Antarctica':      [-80.0, 0.0],
  'Central Asia':    [45.0, 65.0],
  'Центральная Азия':[45.0, 65.0],
  'South Asia':      [20.0, 78.0],
  'Южная Азия':      [20.0, 78.0],
  'Southeast Asia':  [10.0, 110.0],
  'Юго-Восточная Азия':[10.0, 110.0],
  'Caucasus':        [42.0, 44.0],
  'Кавказ':          [42.0, 44.0],
  'Global':          [0.0, 0.0],
  'GLOBAL':          [0.0, 0.0],
};

// ============================================================
//  ЗАГРУЗКА И НОРМАЛИЗАЦИЯ
// ============================================================

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-risk-heatmap.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  return parsed;
}

function tierOf(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return { key: 'unknown', color: '#64748b', label: 'Нет данных' };
  for (const [k, def] of Object.entries(TIERS)) if (n >= def.min && n < def.max) return { key: k, color: def.color, label: def.label };
  return { key: 'minimal', ...TIERS.minimal };
}

/**
 * Универсальный экстрактор: массив / {data} / {grid} / {regions}.
 * Возвращает { rows:[...], grid:[...] }.
 */
function extractRecords(doc) {
  let rows = [];
  let grid = [];

  if (Array.isArray(doc)) {
    rows = doc;
  } else if (doc && Array.isArray(doc.data)) {
    rows = doc.data;
  } else if (doc && Array.isArray(doc.regions)) {
    rows = doc.regions;
  } else if (doc && Array.isArray(doc.records)) {
    rows = doc.records;
  } else if (doc && Array.isArray(doc.grid)) {
    grid = doc.grid;
  } else if (doc && doc.data && Array.isArray(doc.data.rows)) {
    rows = doc.data.rows;
    if (Array.isArray(doc.data.grid)) grid = doc.data.grid;
  }

  return { rows, grid };
}

function normalizeRow(r, i) {
  const region = r.region || r.name || r.id || 'Unknown';
  const risk = Number(r.risk ?? r.value ?? r.score);
  let lat = Number(r.lat ?? r.latitude);
  let lng = Number(r.lng ?? r.lon ?? r.longitude);
  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && REGION_COORDS[region]) {
    [lat, lng] = REGION_COORDS[region];
  }
  const t = tierOf(risk);
  return {
    id: String(r.id || `risk-${i}`),
    region,
    name: r.name || region,
    risk: Number.isFinite(risk) ? Number(risk.toFixed(2)) : null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    tier: r.tier || t.key,
    tierLabel: t.label,
    color: t.color,
    sources: Array.isArray(r.sources) ? r.sources : (r.source ? [r.source] : []),
    drivers: Array.isArray(r.drivers) ? r.drivers : (r.driver ? [r.driver] : []),
    date: String(r.date || r.timestamp || '').slice(0, 10) || null,
    category: 'index',
    icon: meta.icon,
  };
}

function normalizeGrid(grid) {
  return grid.map((g, i) => ({
    id: String(g.id || `cell-${i}`),
    lat: Number(g.lat),
    lng: Number(g.lng),
    value: Number(g.value ?? g.risk ?? g.intensity ?? 0),
    count: Number(g.count || 1),
  })).filter(g => Number.isFinite(g.lat) && Number.isFinite(g.lng) && Number.isFinite(g.value));
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.region) r = r.filter(x => String(x.region).toLowerCase().includes(String(query.region).toLowerCase()));
  if (query.tier)   r = r.filter(x => x.tier === String(query.tier));
  if (query.q)      r = r.filter(x => String(x.name + ' ' + x.region).toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.min != null) { const n = Number(query.min); if (Number.isFinite(n)) r = r.filter(x => x.risk != null && x.risk >= n); }
  if (query.max != null) { const n = Number(query.max); if (Number.isFinite(n)) r = r.filter(x => x.risk != null && x.risk <= n); }
  if (query.since) r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  const sortKey = query.sort || 'risk-desc';
  if (sortKey === 'risk-desc')      r.sort((a, b) => (b.risk ?? 0) - (a.risk ?? 0));
  else if (sortKey === 'risk-asc')  r.sort((a, b) => (a.risk ?? 0) - (b.risk ?? 0));
  else if (sortKey === 'name')      r.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortKey === 'region')    r.sort((a, b) => a.region.localeCompare(b.region));
  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(rows) {
  const values = rows.map(r => r.risk).filter(Number.isFinite);
  const byTier = {};
  const byRegion = {};
  for (const r of rows) {
    byTier[r.tier] = (byTier[r.tier] || 0) + 1;
    if (r.region) byRegion[r.region] = (byRegion[r.region] || 0) + 1;
  }
  const top = (obj, n = 10) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
  if (values.length === 0) return { count: rows.length, by_tier: byTier, top_regions: top(byRegion) };

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length/2-1] + sorted[sorted.length/2]) / 2
    : sorted[Math.floor(sorted.length/2)];
  const highest = rows.slice().sort((a, b) => (b.risk ?? 0) - (a.risk ?? 0))[0] || null;
  const lowest = rows.slice().sort((a, b) => (a.risk ?? 0) - (b.risk ?? 0))[0] || null;
  return {
    count: rows.length,
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    stddev: Number(stddev.toFixed(2)),
    min: Number(Math.min(...values).toFixed(2)),
    max: Number(Math.max(...values).toFixed(2)),
    by_tier: byTier,
    top_regions: top(byRegion, 10),
    highest: highest ? { name: highest.name, region: highest.region, risk: highest.risk, tier: highest.tier } : null,
    lowest: lowest ? { name: lowest.name, region: lowest.region, risk: lowest.risk, tier: lowest.tier } : null,
  };
}

// ============================================================
//  АНАЛИТИКА
// ============================================================

function buildGrid(rows, step = 15) {
  const cells = new Map();
  for (const r of rows) {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng) || r.risk == null) continue;
    const gridLat = Math.round(r.lat / step) * step;
    const gridLng = Math.round(r.lng / step) * step;
    const key = `${gridLat}|${gridLng}`;
    if (!cells.has(key)) cells.set(key, { lat: gridLat, lng: gridLng, total: 0, count: 0, max: 0 });
    const c = cells.get(key);
    c.total += r.risk;
    c.count++;
    c.max = Math.max(c.max, r.risk);
  }
  return [...cells.values()].map(c => ({
    lat: c.lat,
    lng: c.lng,
    value: Number((c.total / c.count).toFixed(2)),
    count: c.count,
    max: Number(c.max.toFixed(2)),
  })).sort((a, b) => b.value - a.value);
}

function buildClusters(rows, radius = 25) {
  const clusters = [];
  const used = new Set();
  for (let i = 0; i < rows.length; i++) {
    if (used.has(i)) continue;
    const r = rows[i];
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue;
    const cluster = { lat: r.lat, lng: r.lng, members: [r], risks: [r.risk].filter(Number.isFinite) };
    used.add(i);
    for (let j = i + 1; j < rows.length; j++) {
      if (used.has(j)) continue;
      const r2 = rows[j];
      if (!Number.isFinite(r2.lat) || !Number.isFinite(r2.lng)) continue;
      const d = Math.sqrt((r.lat - r2.lat) ** 2 + (r.lng - r2.lng) ** 2);
      if (d <= radius) { cluster.members.push(r2); if (Number.isFinite(r2.risk)) cluster.risks.push(r2.risk); used.add(j); }
    }
    clusters.push({
      lat: cluster.lat,
      lng: cluster.lng,
      size: cluster.members.length,
      mean_risk: cluster.risks.length ? Number((cluster.risks.reduce((a,b)=>a+b,0)/cluster.risks.length).toFixed(2)) : null,
      max_risk: cluster.risks.length ? Math.max(...cluster.risks) : null,
      members: cluster.members.map(m => m.id),
    });
  }
  return clusters.sort((a, b) => (b.mean_risk ?? 0) - (a.mean_risk ?? 0));
}

function detectAnomalies(rows) {
  const values = rows.map(r => r.risk).filter(Number.isFinite);
  if (values.length < 3) return [];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  const threshold = mean + 2 * stddev;
  return rows.filter(r => Number.isFinite(r.risk) && r.risk > threshold)
    .map(r => ({ ...r, deviation: Number((r.risk - mean).toFixed(2)), threshold: Number(threshold.toFixed(2)) }))
    .sort((a, b) => b.risk - a.risk);
}

function computeTrend(rows) {
  const withDates = rows.filter(r => r.date).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (withDates.length < 4) return null;
  const half = Math.floor(withDates.length / 2);
  const older = withDates.slice(0, half);
  const newer = withDates.slice(half);
  const mean = arr => arr.length ? arr.reduce((s, r) => s + (r.risk ?? 0), 0) / arr.length : null;
  const mOld = mean(older);
  const mNew = mean(newer);
  const delta = (mOld != null && mNew != null && mOld !== 0) ? ((mNew - mOld) / mOld * 100) : null;
  return {
    older_count: older.length,
    newer_count: newer.length,
    older_mean: mOld != null ? Number(mOld.toFixed(2)) : null,
    newer_mean: mNew != null ? Number(mNew.toFixed(2)) : null,
    delta_pct: delta != null ? Number(delta.toFixed(2)) : null,
    direction: delta == null ? 'unknown' : delta > 5 ? 'up' : delta < -5 ? 'down' : 'flat',
  };
}

function aggregateByField(rows, field) {
  const map = {};
  for (const r of rows) {
    const arr = Array.isArray(r[field]) ? r[field] : [];
    for (const item of arr) {
      const k = String(item);
      if (!map[k]) map[k] = { name: k, count: 0, total_risk: 0, regions: new Set() };
      map[k].count++;
      map[k].total_risk += (r.risk ?? 0);
      map[k].regions.add(r.region);
    }
  }
  return Object.values(map).map(x => ({
    name: x.name,
    count: x.count,
    mean_risk: Number((x.total_risk / x.count).toFixed(2)),
    regions: [...x.regions],
  })).sort((a, b) => b.count - a.count);
}

// ============================================================
//  ФОРМАТЫ ОТВЕТА
// ============================================================

function toFeatureCollection(rows) {
  const features = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, region: r.region, risk: r.risk,
        tier: r.tier, tierLabel: r.tierLabel, color: r.color,
        sources: r.sources, drivers: r.drivers, date: r.date,
        category: r.category, icon: r.icon,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    legend: Object.entries(TIERS).map(([key, def]) => ({ key, ...def })),
    meta: { total: rows.length, mapped: features.length, unmapped: rows.length - features.length },
  };
}

function toSeries(rows) { return rows.map(r => ({ id: r.id, name: r.name, region: r.region, risk: r.risk, tier: r.tier, date: r.date })); }

function toCSV(rows) {
  const lines = ['id,name,region,risk,tier,lat,lng,date'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const r of rows) lines.push([r.id, r.name, r.region, r.risk, r.tier, r.lat, r.lng, r.date].map(esc).join(','));
  return lines.join('\n') + '\n';
}

function toRenderConfig(rows, grid) {
  // Готовый конфиг для Leaflet: heatmap points + markers + choropleth
  const heatPoints = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng) && r.risk != null)
    .map(r => [r.lat, r.lng, Number((r.risk / 100).toFixed(3))]);
  const markers = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng) && (r.risk ?? 0) >= 50)
    .map(r => ({
      lat: r.lat, lng: r.lng,
      properties: { id: r.id, name: r.name, region: r.region, risk: r.risk, tier: r.tier, color: r.color },
    }));
  const gridPoints = grid.map(g => [g.lat, g.lng, Number((g.value / 100).toFixed(3))]);

  return {
    heat: { points: heatPoints, max: 1, radius: 25, blur: 15 },
    grid: { points: gridPoints, max: 1, radius: 30, blur: 20 },
    markers,
    totals: { heat: heatPoints.length, grid: gridPoints.length, markers: markers.length },
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

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/risk-heatmap/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const { rows: rawRows, grid: rawGrid } = extractRecords(doc);
    const all = rawRows.map(normalizeRow);
    const gridSource = normalizeGrid(rawGrid);

    const extra = {
      'X-Module': 'risk-heatmap-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    // Специализированные подпути
    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all) }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, { status: 'online', count: all.length, grid: gridSource.length, generated_at: new Date().toISOString() }, extra);
    }
    if (sub === '/latest') {
      const top = all.slice().sort((a, b) => (b.risk ?? 0) - (a.risk ?? 0)).slice(0, 20);
      return sendJSON(res, 200, { latest: top, count: top.length }, extra);
    }
    if (sub === '/regions') {
      const byRegion = {};
      for (const r of all) {
        if (!byRegion[r.region]) byRegion[r.region] = { count: 0, total: 0, max: 0, ids: [] };
        const x = byRegion[r.region];
        x.count++;
        x.total += (r.risk ?? 0);
        x.max = Math.max(x.max, r.risk ?? 0);
        x.ids.push(r.id);
      }
      for (const k of Object.keys(byRegion)) byRegion[k].mean_risk = Number((byRegion[k].total / byRegion[k].count).toFixed(2));
      return sendJSON(res, 200, { regions: byRegion, total: Object.keys(byRegion).length }, extra);
    }
    if (sub === '/tiers') {
      const byTier = {};
      for (const r of all) {
        if (!byTier[r.tier]) byTier[r.tier] = [];
        byTier[r.tier].push({ id: r.id, name: r.name, risk: r.risk });
      }
      return sendJSON(res, 200, { tiers: byTier, total: Object.keys(byTier).length }, extra);
    }
    if (sub === '/grid') {
      const step = parseInt(query.step, 10) || 15;
      const grid = gridSource.length > 0 ? gridSource : buildGrid(all, step);
      return sendJSON(res, 200, { step, grid, total: grid.length }, extra);
    }
    if (sub === '/clusters') {
      const radius = parseInt(query.radius, 10) || 25;
      const clusters = buildClusters(all, radius);
      return sendJSON(res, 200, { radius, clusters, total: clusters.length }, extra);
    }
    if (sub === '/anomalies') {
      const anomalies = detectAnomalies(all);
      return sendJSON(res, 200, { anomalies, count: anomalies.length }, extra);
    }
    if (sub === '/trend') {
      return sendJSON(res, 200, { trend: computeTrend(all) }, extra);
    }
    if (sub === '/sources') {
      const sources = aggregateByField(all, 'sources');
      return sendJSON(res, 200, { sources, total: sources.length }, extra);
    }
    if (sub === '/drivers') {
      const drivers = aggregateByField(all, 'drivers');
      return sendJSON(res, 200, { drivers, total: drivers.length }, extra);
    }
    if (sub === '/choropleth') {
      const byRegion = {};
      for (const r of all) {
        if (!byRegion[r.region]) byRegion[r.region] = { region: r.region, total: 0, count: 0, max: 0 };
        const x = byRegion[r.region];
        x.total += (r.risk ?? 0);
        x.count++;
        x.max = Math.max(x.max, r.risk ?? 0);
      }
      const result = Object.values(byRegion).map(x => ({
        region: x.region,
        mean_risk: Number((x.total / x.count).toFixed(2)),
        max_risk: x.max,
        count: x.count,
        tier: tierOf(x.total / x.count).key,
        color: tierOf(x.total / x.count).color,
      })).sort((a, b) => b.mean_risk - a.mean_risk);
      return sendJSON(res, 200, { choropleth: result, total: result.length }, extra);
    }
    if (sub === '/featurecollection') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }
    if (sub === '/render') {
      const step = parseInt(query.step, 10) || 15;
      const grid = gridSource.length > 0 ? gridSource : buildGrid(all, step);
      return sendJSON(res, 200, { render: toRenderConfig(all, grid) }, extra);
    }

    // Основной ответ
    const rows = applyFilters(all, query);
    const grid = gridSource.length > 0 ? gridSource : buildGrid(rows);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, grid, meta: { total: all.length } }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_records: all.length, returned_records: rows.length,
        grid_cells: grid.length,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      legend: fc.legend,
      grid,
      series: toSeries(rows),
      stats: computeStats(rows),
      trend: computeTrend(rows),
      anomalies: detectAnomalies(rows).slice(0, 10),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
