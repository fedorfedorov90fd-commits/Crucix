/**
 * apis/sources/unique-indicators-api.mjs — API-МОДУЛЬ: УНИКАЛЬНЫЕ КОСВЕННЫЕ ИНДИКАТОРЫ
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/pentagon-pizza.json + data/basket/langley-taxis.json —
 *           [{ date, value, trend?, timestamp? }] ИЛИ { data:[...] } ИЛИ { series:[...] }.
 * Сборщик: scripts/collectors/collect-unique-indicators.mjs.
 *
 * Уникальные косвенные индикаторы разведактивности:
 *   - «Пицца Пентагона»: резкий рост заказов пиццы в районе Пентагона
 *     → признак подготовки операции / экстренного совещания.
 *   - «Такси в Лэнгли»: резкий рост вызовов такси у штаб-квартиры ЦРУ
 *     → признак экстренного совещания / ночной активности.
 *
 * Индикатор:
 *   { date, value, trend?, timestamp? }
 *
 * Режимы (по значению):
 *   normal   (< warning)
 *   warning  (warning ≤ value < critical)
 *   critical (≥ critical)
 *
 * Пороги:
 *   pentagon-pizza: warning 50, critical 100
 *   langley-taxis:  warning 20, critical 50
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw, report, text.
 * ФИЛЬТРЫ: ?indicator=, ?regime=, ?since=, ?until=, ?min_value=, ?max_value=, ?limit=, ?top=, ?sort=.
 *
 * ОСНОВНЫЕ ПОДПУТИ:
 *   /                              — сводка (оба индикатора)
 *   /stats /status /health         — метрики и состояние
 *   /config /filter-presets        — конфигурация и пресеты
 *   /indicators                    — оба индикатора с описанием
 *   /indicator/:id                 — конкретный индикатор
 *   /pentagon-pizza                — только Пицца Пентагона
 *   /langley-taxis                 — только Такси Лэнгли
 *   /series /latest                — данные и свежее
 *   /top /bottom                   — топы
 *   /regimes /current-regime       — режимы
 *   /normal /warning /critical     — по режимам
 *   /trends /timeline              — динамика
 *   /anomalies /signals            — аномалии и сигналы
 *   /compare                       — сравнение индикаторов
 *   /search /export                — поиск и отчёт
 *   /featurecollection /render     — GeoJSON и рендер
 *   /builtin                       — встроенный fallback
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR   = join(PROJECT_ROOT, 'data', 'basket');

export const route  = '/api/layers/unique-indicators';
export const method = 'GET';

export const meta = {
  category: 'intelligence',
  icon: '🍕',
  color: '#f97316',
  vizType: 'marker',
  source: 'basket/pentagon-pizza.json + basket/langley-taxis.json',
  collector: 'collect-unique-indicators.mjs',
  cache: 300,
  description: 'Косвенные индикаторы разведактивности: Пицца Пентагона, Такси в Лэнгли',
  unit: 'index',
};

// ============================================================
//  МЕТАДАННЫЕ ИНДИКАТОРОВ
// ============================================================

const INDICATORS = {
  'pentagon-pizza': {
    id: 'pentagon-pizza',
    file: 'pentagon-pizza.json',
    name: 'Индекс "Пицца Пентагона"',
    shortName: 'Пицца Пентагона',
    description: 'Резкий рост заказов пиццы в районе Пентагона — признак подготовки к операции',
    source: 'Google Maps / Yelp',
    icon: '🍕',
    color: '#f97316',
    location: {
      name: 'Пентагон, Арлингтон, Вирджиния',
      lat: 38.8719,
      lng: -77.0563,
      radius_km: 5,
    },
    thresholds: { warning: 50, critical: 100 },
  },
  'langley-taxis': {
    id: 'langley-taxis',
    file: 'langley-taxis.json',
    name: 'Индекс "Такси в Лэнгли"',
    shortName: 'Такси Лэнгли',
    description: 'Резкий рост заказов такси в районе штаб-квартиры ЦРУ — признак экстренного совещания',
    source: 'Uber / Lyft / Google Maps',
    icon: '🚕',
    color: '#8b5cf6',
    location: {
      name: 'Лэнгли, Вирджиния (штаб-квартира ЦРУ)',
      lat: 38.9519,
      lng: -77.1467,
      radius_km: 5,
    },
    thresholds: { warning: 20, critical: 50 },
  },
};

function regimeOf(value, thresholds) {
  const n = Number(value);
  if (!Number.isFinite(n)) return { key: 'unknown', label: 'Неизвестно', color: '#64748b', severity: 0 };
  if (n >= thresholds.critical) return { key: 'critical', label: 'Критический', color: '#dc2626', severity: 3 };
  if (n >= thresholds.warning)  return { key: 'warning',  label: 'Предупреждение', color: '#f97316', severity: 2 };
  return { key: 'normal', label: 'Норма', color: '#22c55e', severity: 1 };
}

// ============================================================
//  FALLBACK (2 индикатора × 15 точек)
// ============================================================

const BUILTIN_DATA = {
  'pentagon-pizza': [
    { date: '2026-08-01', value: 32, trend: 'stable' },
    { date: '2026-08-02', value: 35, trend: 'stable' },
    { date: '2026-08-03', value: 28, trend: 'stable' },
    { date: '2026-08-04', value: 41, trend: 'rising' },
    { date: '2026-08-05', value: 38, trend: 'stable' },
    { date: '2026-08-06', value: 44, trend: 'rising' },
    { date: '2026-08-07', value: 52, trend: 'rising' },
    { date: '2026-08-08', value: 61, trend: 'rising' },
    { date: '2026-08-09', value: 78, trend: 'rising' },
    { date: '2026-08-10', value: 105, trend: 'critical' },
    { date: '2026-08-11', value: 128, trend: 'critical' },
    { date: '2026-08-12', value: 142, trend: 'critical' },
    { date: '2026-08-13', value: 118, trend: 'critical' },
    { date: '2026-08-14', value: 84, trend: 'rising' },
    { date: '2026-08-15', value: 52, trend: 'rising' },
  ],
  'langley-taxis': [
    { date: '2026-08-01', value: 12, trend: 'stable' },
    { date: '2026-08-02', value: 14, trend: 'stable' },
    { date: '2026-08-03', value: 11, trend: 'stable' },
    { date: '2026-08-04', value: 15, trend: 'stable' },
    { date: '2026-08-05', value: 18, trend: 'stable' },
    { date: '2026-08-06', value: 22, trend: 'rising' },
    { date: '2026-08-07', value: 28, trend: 'rising' },
    { date: '2026-08-08', value: 35, trend: 'rising' },
    { date: '2026-08-09', value: 47, trend: 'rising' },
    { date: '2026-08-10', value: 62, trend: 'critical' },
    { date: '2026-08-11', value: 74, trend: 'critical' },
    { date: '2026-08-12', value: 81, trend: 'critical' },
    { date: '2026-08-13', value: 68, trend: 'critical' },
    { date: '2026-08-14', value: 45, trend: 'rising' },
    { date: '2026-08-15', value: 22, trend: 'stable' },
  ],
};

// ============================================================
//  IN-MEMORY КЭШ
// ============================================================

const _cache = new Map();
const CACHE_TTL = 60_000;
function cacheGet(key) {
  const item = _cache.get(key);
  if (!item) return null;
  if (item.expires < Date.now()) { _cache.delete(key); return null; }
  return item.value;
}
function cachePut(key, value) { _cache.set(key, { value, expires: Date.now() + CACHE_TTL }); }
function cacheClear() { _cache.clear(); return _cache.size; }

// ============================================================
//  ЗАГРУЗКА
// ============================================================

async function loadIndicatorFile(filename) {
  const filePath = join(BASKET_DIR, filename);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.data)) return parsed.data;
    if (parsed && Array.isArray(parsed.series)) return parsed.series;
    return [];
  } catch (e) {
    return null;
  }
}

function extractPoints(doc) {
  if (Array.isArray(doc)) return doc;
  if (doc && Array.isArray(doc.data)) return doc.data;
  if (doc && Array.isArray(doc.series)) return doc.series;
  return [];
}

async function loadAll() {
  const out = {};
  for (const [id, meta_] of Object.entries(INDICATORS)) {
    const raw = await loadIndicatorFile(meta_.file);
    const source = raw ? 'basket' : 'builtin';
    const points = (raw || BUILTIN_DATA[id] || []).map(p => normalizePoint(p, id));
    out[id] = { id, meta: meta_, points, source };
  }
  return out;
}

// ============================================================
//  НОРМАЛИЗАЦИЯ
// ============================================================

function normalizePoint(p, indicatorId) {
  const ind = INDICATORS[indicatorId];
  const date = String(p.date || p.timestamp || '').slice(0, 10) || null;
  const value = Number(p.value ?? p.count ?? p.index);
  const regime = regimeOf(value, ind.thresholds);
  return {
    date,
    value: Number.isFinite(value) ? Number(value.toFixed(2)) : null,
    trend: p.trend || null,
    regime: regime.key,
    regimeLabel: regime.label,
    regimeColor: regime.color,
    severity: regime.severity,
    indicator: indicatorId,
    indicatorName: ind.shortName,
    indicatorColor: ind.color,
    indicatorIcon: ind.icon,
    lat: ind.location.lat,
    lng: ind.location.lng,
    category_: 'intelligence',
    icon: ind.icon,
  };
}

function currentOf(points) {
  const sorted = points.filter(p => p.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return sorted.length ? sorted[sorted.length - 1] : (points[points.length - 1] || null);
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.indicator) r = r.filter(x => x.indicator === String(query.indicator));
  if (query.regime)    r = r.filter(x => x.regime === String(query.regime).toLowerCase());
  if (query.since)     r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  if (query.until)     r = r.filter(x => !x.date || x.date <= String(query.until).slice(0, 10));
  if (query.min_value != null) { const n = Number(query.min_value); if (Number.isFinite(n)) r = r.filter(x => x.value != null && x.value >= n); }
  if (query.max_value != null) { const n = Number(query.max_value); if (Number.isFinite(n)) r = r.filter(x => x.value != null && x.value <= n); }

  const sortKey = query.sort || 'date-asc';
  if (sortKey === 'date-asc')        r.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  else if (sortKey === 'date-desc')  r.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  else if (sortKey === 'value-desc') r.sort((a, b) => (b.value ?? -1e9) - (a.value ?? -1e9));
  else if (sortKey === 'value-asc')  r.sort((a, b) => (a.value ?? 1e9) - (b.value ?? 1e9));
  else if (sortKey === 'severity')   r.sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0));

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(-n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(points) {
  const byRegime = { normal: 0, warning: 0, critical: 0, unknown: 0 };
  const values = [];
  for (const p of points) {
    byRegime[p.regime] = (byRegime[p.regime] || 0) + 1;
    if (p.value != null) values.push(p.value);
  }
  const dates = points.map(p => p.date).filter(Boolean).sort();
  if (!values.length) return { count: points.length, by_regime: byRegime };

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  const last = currentOf(points);
  const first = points[0] || null;
  const changeAbs = (last && first && last.value != null && first.value != null)
    ? Number((last.value - first.value).toFixed(2)) : null;
  const changePct = (last && first && last.value != null && first.value !== 0)
    ? Number(((last.value - first.value) / first.value * 100).toFixed(2)) : null;

  return {
    count: points.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    value: {
      min: Number(Math.min(...values).toFixed(2)),
      max: Number(Math.max(...values).toFixed(2)),
      mean: Number(mean.toFixed(2)),
      median: Number(median.toFixed(2)),
      stddev: Number(Math.sqrt(variance).toFixed(2)),
    },
    by_regime: byRegime,
    last_value: last?.value ?? null,
    last_date: last?.date ?? null,
    last_regime: last?.regime ?? null,
    last_regimeLabel: last?.regimeLabel ?? null,
    first_value: first?.value ?? null,
    change_abs: changeAbs,
    change_pct: changePct,
  };
}

function computeTrends(points) {
  const tail = points.slice(-7);
  const prev = points.slice(-14, -7);
  if (!tail.length || !prev.length) return null;
  const m = a => a.reduce((s, r) => s + (r.value ?? 0), 0) / a.length;
  const mNew = m(tail), mOld = m(prev);
  const delta = mOld === 0 ? null : ((mNew - mOld) / mOld * 100);
  return {
    last7_mean: Number(mNew.toFixed(2)),
    prev7_mean: Number(mOld.toFixed(2)),
    delta_pct: delta != null ? Number(delta.toFixed(2)) : null,
    direction: delta == null ? 'unknown' : (delta > 10 ? 'rising' : (delta < -10 ? 'falling' : 'flat')),
  };
}

function computeAnomalies(points) {
  const values = points.map(p => p.value).filter(Number.isFinite);
  if (values.length < 3) return [];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  const threshold = 2 * stddev;
  return points
    .filter(p => p.value != null && Math.abs(p.value - mean) > threshold)
    .map(p => ({
      date: p.date,
      indicator: p.indicator,
      value: p.value,
      z_score: Number(((p.value - mean) / (stddev || 1)).toFixed(2)),
      deviation: Number((p.value - mean).toFixed(2)),
      regime: p.regime,
    }))
    .sort((a, b) => Math.abs(b.z_score) - Math.abs(a.z_score));
}

function toReport(data) {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push('  UNIQUE INDICATORS REPORT — Crucix');
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push('='.repeat(60));
  lines.push('');
  for (const [id, item] of Object.entries(data)) {
    const stats = computeStats(item.points);
    lines.push(`[${item.meta.icon} ${item.meta.name}]`);
    lines.push(`  Источник: ${item.source}`);
    lines.push(`  Точек: ${stats.count}`);
    if (stats.value) lines.push(`  Value — min: ${stats.value.min}  max: ${stats.value.max}  mean: ${stats.value.mean}`);
    if (stats.last_value != null) lines.push(`  Последнее (${stats.last_date}): ${stats.last_value} — ${stats.last_regimeLabel}`);
    if (stats.change_pct != null) lines.push(`  Изменение: ${stats.change_pct}%`);
    lines.push('');
  }
  lines.push('='.repeat(60));
  return lines.join('\n');
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(rows) {
  // каждая точка — маркер в Пентагоне/Лэнгли (сгруппированные по локации)
  const features = [];
  for (const ind of Object.values(INDICATORS)) {
    const indPoints = rows.filter(r => r.indicator === ind.id);
    if (!indPoints.length) continue;
    const cur = currentOf(indPoints);
    if (!cur) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [ind.location.lng, ind.location.lat] },
      properties: {
        id: ind.id, name: ind.name, kind: 'indicator',
        icon: ind.icon, color: ind.color,
        current_value: cur.value,
        current_date: cur.date,
        current_regime: cur.regime,
        current_regimeLabel: cur.regimeLabel,
        regimeColor: cur.regimeColor,
        thresholds: ind.thresholds,
        location: ind.location.name,
        radius_km: ind.location.radius_km,
        points_count: indPoints.length,
        description: ind.description,
      },
    });
  }
  return {
    type: 'FeatureCollection',
    features,
    legend: [
      { key: 'normal',   label: 'Норма',          color: '#22c55e' },
      { key: 'warning',  label: 'Предупреждение', color: '#f97316' },
      { key: 'critical', label: 'Критический',    color: '#dc2626' },
    ],
    meta: { total: rows.length, features: features.length },
  };
}

function toSeries(rows) {
  return rows.map(r => ({
    date: r.date, value: r.value,
    indicator: r.indicator, indicatorName: r.indicatorName,
    regime: r.regime, regimeLabel: r.regimeLabel,
    trend: r.trend,
  }));
}

function toCSV(rows) {
  const lines = ['date,indicator,value,regime,regime_label,trend'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const r of rows) lines.push([r.date, r.indicator, r.value, r.regime, r.regimeLabel, r.trend].map(esc).join(','));
  return lines.join('\n') + '\n';
}

function toRenderConfig(rows) {
  const markers = [];
  for (const ind of Object.values(INDICATORS)) {
    const indPoints = rows.filter(r => r.indicator === ind.id);
    if (!indPoints.length) continue;
    const cur = currentOf(indPoints);
    if (!cur) continue;
    markers.push({
      id: ind.id,
      lat: ind.location.lat,
      lng: ind.location.lng,
      color: cur.regimeColor,
      icon: ind.icon,
      radius: cur.regime === 'critical' ? 15 : (cur.regime === 'warning' ? 11 : 7),
      properties: {
        name: ind.name, value: cur.value, regime: cur.regime,
        regimeLabel: cur.regimeLabel, thresholds: ind.thresholds,
        location: ind.location.name, description: ind.description,
      },
    });
  }
  return {
    markers,
    legend: [
      { key: 'normal',   label: 'Норма',          color: '#22c55e' },
      { key: 'warning',  label: 'Предупреждение', color: '#f97316' },
      { key: 'critical', label: 'Критический',    color: '#dc2626' },
    ],
    filterable: ['indicator', 'regime', 'since', 'until', 'min_value', 'max_value', 'sort'],
    totals: { markers: markers.length },
  };
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
    ...extra,
  });
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/unique-indicators/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const extra = {
      'X-Module': 'unique-indicators-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
      'Access-Control-Allow-Origin': '*',
    };

    const data = await loadAll();
    const allPoints = Object.values(data).flatMap(d => d.points);
    const usedFallback = Object.values(data).some(d => d.source === 'builtin');

    if (sub === '/health') {
      return sendJSON(res, 200, {
        status: 'online',
        fallback: usedFallback,
        indicators: Object.keys(INDICATORS).length,
        total_points: allPoints.length,
        cache_size: _cache.size,
        generated_at: new Date().toISOString(),
      }, extra);
    }
    if (sub === '/config') {
      return sendJSON(res, 200, {
        indicators: Object.values(INDICATORS),
        thresholds: { pentagon_pizza: INDICATORS['pentagon-pizza'].thresholds, langley_taxis: INDICATORS['langley-taxis'].thresholds },
        cache_ttl_ms: CACHE_TTL,
      }, extra);
    }
    if (sub === '/filter-presets') {
      const presets = [
        { id: 'all',           label: 'Все точки',              params: {} },
        { id: 'pentagon',      label: 'Пицца Пентагона',         params: { indicator: 'pentagon-pizza' } },
        { id: 'langley',       label: 'Такси Лэнгли',            params: { indicator: 'langley-taxis' } },
        { id: 'critical',      label: 'Критические',             params: { regime: 'critical' } },
        { id: 'warning',       label: 'Предупреждения',          params: { regime: 'warning' } },
      ];
      return sendJSON(res, 200, { presets, count: presets.length }, extra);
    }
    if (sub === '/builtin') {
      const builtinPoints = [];
      for (const [id, arr] of Object.entries(BUILTIN_DATA)) {
        for (const p of arr) builtinPoints.push(normalizePoint(p, id));
      }
      const fc = toFeatureCollection(builtinPoints);
      return sendJSON(res, 200, {
        type: 'FeatureCollection',
        features: fc.features,
        legend: fc.legend,
        series: toSeries(builtinPoints),
        stats: computeStats(builtinPoints),
        indicators: Object.values(INDICATORS),
        meta: { source: 'builtin', count: builtinPoints.length, generated_at: new Date().toISOString() },
      }, extra);
    }

    if (sub === '/stats' || format === 'stats') {
      const statMap = {};
      for (const [id, item] of Object.entries(data)) {
        statMap[id] = { stats: computeStats(item.points), source: item.source };
      }
      return sendJSON(res, 200, {
        indicators: statMap,
        combined: computeStats(allPoints),
        fallback: usedFallback,
      }, extra);
    }
    if (sub === '/status') {
      const summary = {};
      for (const [id, item] of Object.entries(data)) {
        const cur = currentOf(item.points);
        summary[id] = {
          current_value: cur?.value ?? null,
          current_date: cur?.date ?? null,
          current_regime: cur?.regime ?? null,
          points: item.points.length,
          source: item.source,
        };
      }
      return sendJSON(res, 200, {
        status: 'online',
        indicators: summary,
        generated_at: new Date().toISOString(),
      }, extra);
    }
    if (sub === '/indicators') {
      return sendJSON(res, 200, {
        indicators: Object.values(INDICATORS).map(ind => ({
          ...ind,
          points: data[ind.id]?.points.length ?? 0,
          source: data[ind.id]?.source ?? 'unknown',
          current: currentOf(data[ind.id]?.points ?? []),
        })),
        count: Object.keys(INDICATORS).length,
      }, extra);
    }
    if (sub.startsWith('/indicator/')) {
      const id = decodeURIComponent(sub.slice('/indicator/'.length));
      const ind = INDICATORS[id];
      if (!ind) return sendJSON(res, 404, { error: 'indicator_not_found', id }, extra);
      const points = data[id]?.points ?? [];
      return sendJSON(res, 200, {
        indicator: ind,
        points,
        stats: computeStats(points),
        source: data[id]?.source ?? 'unknown',
        current: currentOf(points),
      }, extra);
    }
    if (sub === '/pentagon-pizza') {
      const points = data['pentagon-pizza']?.points ?? [];
      return sendJSON(res, 200, {
        indicator: INDICATORS['pentagon-pizza'],
        points,
        stats: computeStats(points),
        source: data['pentagon-pizza']?.source ?? 'unknown',
        current: currentOf(points),
      }, extra);
    }
    if (sub === '/langley-taxis') {
      const points = data['langley-taxis']?.points ?? [];
      return sendJSON(res, 200, {
        indicator: INDICATORS['langley-taxis'],
        points,
        stats: computeStats(points),
        source: data['langley-taxis']?.source ?? 'unknown',
        current: currentOf(points),
      }, extra);
    }
    if (sub === '/series') {
      const rows = applyFilters(allPoints, query);
      return sendJSON(res, 200, { series: toSeries(rows), count: rows.length, total: allPoints.length }, extra);
    }
    if (sub === '/latest') {
      const latest = {};
      for (const [id, item] of Object.entries(data)) {
        latest[id] = currentOf(item.points);
      }
      return sendJSON(res, 200, { latest, generated_at: new Date().toISOString() }, extra);
    }
    if (sub === '/top') {
      const n = parseInt(query.n || query.top, 10) || 10;
      const rows = allPoints.slice().sort((a, b) => (b.value ?? -1) - (a.value ?? -1)).slice(0, n);
      return sendJSON(res, 200, { top: rows, n }, extra);
    }
    if (sub === '/bottom') {
      const n = parseInt(query.n, 10) || 10;
      const rows = allPoints.slice().sort((a, b) => (a.value ?? 1e9) - (b.value ?? 1e9)).slice(0, n);
      return sendJSON(res, 200, { bottom: rows, n }, extra);
    }
    if (sub === '/regimes') {
      const byRegime = {};
      for (const p of allPoints) {
        if (!byRegime[p.regime]) byRegime[p.regime] = { key: p.regime, label: p.regimeLabel, color: p.regimeColor, count: 0, points: [] };
        byRegime[p.regime].count++;
        byRegime[p.regime].points.push({ date: p.date, indicator: p.indicator, value: p.value });
      }
      return sendJSON(res, 200, { regimes: Object.values(byRegime), total: Object.keys(byRegime).length }, extra);
    }
    if (sub === '/current-regime') {
      const summary = {};
      for (const [id, item] of Object.entries(data)) {
        const cur = currentOf(item.points);
        summary[id] = { regime: cur?.regime ?? null, label: cur?.regimeLabel ?? null, value: cur?.value ?? null, date: cur?.date ?? null };
      }
      return sendJSON(res, 200, { current: summary, generated_at: new Date().toISOString() }, extra);
    }
    if (sub === '/normal' || sub === '/warning' || sub === '/critical') {
      const regime = sub.slice(1);
      const rows = allPoints.filter(p => p.regime === regime);
      return sendJSON(res, 200, { [regime]: rows, count: rows.length }, extra);
    }
    if (sub === '/trends') {
      const cached = cacheGet('trends');
      if (cached) return sendJSON(res, 200, { trends: cached, cached: true }, extra);
      const trends = {};
      for (const [id, item] of Object.entries(data)) trends[id] = computeTrends(item.points);
      cachePut('trends', trends);
      return sendJSON(res, 200, { trends }, extra);
    }
    if (sub === '/timeline') {
      const byDate = {};
      for (const p of allPoints) {
        if (!p.date) continue;
        if (!byDate[p.date]) byDate[p.date] = { date: p.date, points: [], by_indicator: {} };
        byDate[p.date].points.push({ indicator: p.indicator, value: p.value, regime: p.regime });
        byDate[p.date].by_indicator[p.indicator] = p.value;
      }
      const timeline = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
      return sendJSON(res, 200, { timeline, days: timeline.length }, extra);
    }
    if (sub === '/anomalies') {
      const anomalies = computeAnomalies(allPoints);
      return sendJSON(res, 200, { anomalies, count: anomalies.length }, extra);
    }
    if (sub === '/signals') {
      const signals = [];
      for (const [id, item] of Object.entries(data)) {
        const cur = currentOf(item.points);
        const trend = computeTrends(item.points);
        if (cur && cur.regime === 'critical') {
          signals.push({ indicator: id, type: 'critical-activity', value: cur.value, date: cur.date, severity: 4, message: `Критическая активность в ${item.meta.shortName}: ${cur.value}` });
        }
        if (trend && trend.direction === 'rising' && trend.delta_pct != null && trend.delta_pct > 50) {
          signals.push({ indicator: id, type: 'rapid-rise', delta_pct: trend.delta_pct, severity: 3, message: `Быстрый рост ${item.meta.shortName}: +${trend.delta_pct}%` });
        }
      }
      return sendJSON(res, 200, { signals, count: signals.length }, extra);
    }
    if (sub === '/compare') {
      const indicators = String(query.indicators || 'pentagon-pizza,langley-taxis').split(',').map(s => s.trim()).filter(Boolean);
      const result = {};
      for (const id of indicators) {
        if (data[id]) result[id] = { stats: computeStats(data[id].points), current: currentOf(data[id].points) };
      }
      return sendJSON(res, 200, { count: Object.keys(result).length, comparisons: result }, extra);
    }
    if (sub === '/search') {
      const q = String(query.q || '').toLowerCase();
      if (!q) return sendJSON(res, 400, { error: 'field_required: q' }, extra);
      const rows = allPoints.filter(p => (p.indicator + ' ' + (p.indicatorName || '') + ' ' + (p.date || '')).toLowerCase().includes(q));
      return sendJSON(res, 200, { query: q, results: rows, count: rows.length }, extra);
    }
    if (sub === '/export' || format === 'report') {
      const report = toReport(data);
      return sendText(res, 200, report, 'text/plain; charset=utf-8');
    }
    if (sub === '/reset-cache') {
      const before = _cache.size;
      cacheClear();
      return sendJSON(res, 200, { cleared: before, now: _cache.size }, extra);
    }
    if (sub === '/featurecollection') {
      const rows = applyFilters(allPoints, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }
    if (sub === '/render') {
      const rows = applyFilters(allPoints, query);
      return sendJSON(res, 200, { render: toRenderConfig(rows) }, extra);
    }

    // ---- Корневая сводка ----
    if (format === 'csv')    return sendText(res, 200, toCSV(allPoints), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(allPoints), meta: { count: allPoints.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data, fallback: usedFallback }, extra);

    const fc = toFeatureCollection(allPoints);
    const summary = {};
    for (const [id, item] of Object.entries(data)) {
      const cur = currentOf(item.points);
      summary[id] = {
        name: item.meta.name,
        description: item.meta.description,
        source: item.source,
        icon: item.meta.icon,
        color: item.meta.color,
        location: item.meta.location,
        thresholds: item.meta.thresholds,
        points: item.points.length,
        current: cur,
        stats: computeStats(item.points),
      };
    }
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        fallback: usedFallback,
        indicators_count: Object.keys(INDICATORS).length,
        total_points: allPoints.length,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      legend: fc.legend,
      indicators: summary,
      series: toSeries(allPoints),
      stats: computeStats(allPoints),
      signals: (function() {
        const sigs = [];
        for (const [id, item] of Object.entries(data)) {
          const cur = currentOf(item.points);
          if (cur && cur.regime === 'critical') sigs.push({ indicator: id, type: 'critical-activity', value: cur.value, date: cur.date, severity: 4 });
        }
        return sigs;
      })(),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch (e2) {}
  }
}
