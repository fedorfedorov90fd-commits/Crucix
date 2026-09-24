/**
 * apis/sources/unemployment-api.mjs — API-МОДУЛЬ: БЕЗРАБОТИЦА ПО СТРАНАМ
 *
 * Версия 3.0.1. Принят 23.09.2026.
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/unemployment.json — читается через basket-loader v2.0.0.
 *
 * Два режима данных:
 *  1. v1-схема (crucix.basket.v1) — глобальный временной ряд: series[{date, value}],
 *     regions[{region:'GLOBAL', value, count, extra}]. Нет данных по странам.
 *  2. Legacy-массив стран: [{name, lat, lng, rate, date, country_code?, region?}].
 *
 * Режим series: глобальный временной ряд безработицы (тренд, волатильность, режимы).
 * Режим countries: массив стран с координатами (FeatureCollection, топы, bbox).
 *
 * Точка страны: { name, lat, lng, rate, date }
 * Точка series: { date, value }
 *
 * Режимы (по ставке безработицы %):
 *   low     (< 3.5) — перегрев рынка труда
 *   normal  (3.5–5.5) — здоровый рынок
 *   elevated (5.5–8) — замедление
 *   high    (8–12) — серьёзные проблемы
 *   severe  (> 12) — кризис рынка труда
 *
 * Изменения v3.0.1:
 *  - Перевод с прямого fs.readFile на loadWithFallback.
 *  - extractData определяет режим: 'series' (v1) или 'countries' (legacy/массив).
 *  - Все подпути адаптированы под оба режима (Series отдают время, Countries — карту).
 *  - Диагностика source/shape в headers X-Basket-Source, X-Basket-Shape.
 *
 * ФОРМАТЫ: json (FC + series + stats + regimes), csv, series, stats, raw, report, text.
 * ФИЛЬТРЫ: ?country=, ?region=, ?regime=, ?q=, ?min_rate=, ?max_rate=, ?since=, ?until=, ?limit=, ?top=, ?sort=.
 *
 * ОСНОВНЫЕ ПОДПУТИ:
 *   /                          — сводка (FC + series + stats + regime)
 *   /stats /status /health     — метрики и состояние
 *   /config /filter-presets    — конфигурация и пресеты
 *   /count /series /latest     — базовые данные
 *   /countries /countries/:name — страны
 *   /top /bottom               — топы по безработице
 *   /regimes /current-regime   — режимы
 *   /low /normal /elevated /high /severe — по режимам
 *   /by-region /by-regime /by-country — группировки
 *   /distribution              — распределение по бакетам
 *   /timeline /trends          — динамика (если есть date)
 *   /anomalies /signals        — аномалии и сигналы
 *   /compare?names=a,b,c       — сравнение стран
 *   /search /bbox              — поиск
 *   /export /reset-cache       — сервис
 *   /featurecollection /render — GeoJSON и рендер
 *   /builtin                   — встроенный fallback (20 стран)
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadWithFallback } from './lib/basket-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'unemployment.json');
const COLLECTOR_HINT = 'run scripts/collectors/collect-unemployment.mjs';

export const route  = '/api/layers/unemployment';
export const method = 'GET';

export const meta = {
  category: 'economics',
  icon: '📊',
  color: '#ff4444',
  vizType: 'choropleth',
  source: 'basket/unemployment.json',
  collector: 'collect-unemployment.mjs',
  cache: 300,
  description: 'Безработица по странам мира: ставки, режимы, региональные сравнения',
  unit: 'percent',
};

// ============================================================
//  РЕЖИМЫ ПО СТАВКЕ БЕЗРАБОТИЦЫ
// ============================================================

const REGIME_META = {
  low:      { min: 0,   max: 3.5,  color: '#dc2626', label: 'Перегрев',       severity: 2, description: 'Перегрев рынка труда, инфляционное давление' },
  normal:   { min: 3.5, max: 5.5,  color: '#22c55e', label: 'Норма',          severity: 1, description: 'Здоровый рынок труда' },
  elevated: { min: 5.5, max: 8,    color: '#eab308', label: 'Повышенная',     severity: 2, description: 'Замедление экономики' },
  high:     { min: 8,   max: 12,   color: '#f97316', label: 'Высокая',        severity: 3, description: 'Серьёзные проблемы' },
  severe:   { min: 12,  max: Infinity, color: '#dc2626', label: 'Критическая', severity: 4, description: 'Кризис рынка труда' },
  unknown:  { min: -1,  max: -2,   color: '#64748b', label: 'Неизвестно',     severity: 0, description: 'Нет данных' },
};

function regimeOf(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return { key: 'unknown', ...REGIME_META.unknown };
  if (n < 3.5) return { key: 'low',      ...REGIME_META.low };
  if (n < 5.5) return { key: 'normal',   ...REGIME_META.normal };
  if (n < 8)   return { key: 'elevated', ...REGIME_META.elevated };
  if (n < 12)  return { key: 'high',     ...REGIME_META.high };
  return { key: 'severe', ...REGIME_META.severe };
}

const SIZE_BUCKETS = [
  { min: 0,     max: 3.5,  label: '< 3.5%',       color: '#dc2626' },
  { min: 3.5,   max: 5.5,  label: '3.5-5.5%',     color: '#22c55e' },
  { min: 5.5,   max: 8,    label: '5.5-8%',       color: '#eab308' },
  { min: 8,     max: 12,   label: '8-12%',        color: '#f97316' },
  { min: 12,    max: Infinity, label: '> 12%',    color: '#dc2626' },
];

const FILTER_PRESETS = [
  { id: 'all',       label: 'Все страны',              params: {} },
  { id: 'low',       label: 'Низкая (< 3.5%)',         params: { regime: 'low' } },
  { id: 'normal',    label: 'Норма (3.5-5.5%)',        params: { regime: 'normal' } },
  { id: 'high',      label: 'Высокая (8-12%)',         params: { regime: 'high' } },
  { id: 'severe',    label: 'Критическая (> 12%)',     params: { regime: 'severe' } },
  { id: 'europe',    label: 'Европа',                  params: { region: 'europe' } },
  { id: 'asia',      label: 'Азия',                    params: { region: 'asia' } },
];

// ============================================================
//  FALLBACK (20 стран)
// ============================================================

const BUILTIN_COUNTRIES = [
  { name: 'США',              lat: 38.0,  lng: -97.0,  rate: 3.8,  date: '2026-07', region: 'america' },
  { name: 'Еврозона',         lat: 50.0,  lng: 10.0,   rate: 6.5,  date: '2026-07', region: 'europe' },
  { name: 'Япония',           lat: 36.0,  lng: 138.0,  rate: 2.5,  date: '2026-07', region: 'asia' },
  { name: 'Россия',           lat: 60.0,  lng: 90.0,   rate: 3.2,  date: '2026-07', region: 'cis' },
  { name: 'Китай',            lat: 35.0,  lng: 105.0,  rate: 5.1,  date: '2026-07', region: 'asia' },
  { name: 'Великобритания',   lat: 54.0,  lng: -2.0,   rate: 4.2,  date: '2026-07', region: 'europe' },
  { name: 'Германия',         lat: 51.0,  lng: 10.0,   rate: 6.0,  date: '2026-07', region: 'europe' },
  { name: 'Франция',          lat: 46.0,  lng: 2.0,    rate: 7.4,  date: '2026-07', region: 'europe' },
  { name: 'Италия',           lat: 42.0,  lng: 12.0,   rate: 7.8,  date: '2026-07', region: 'europe' },
  { name: 'Испания',          lat: 40.0,  lng: -4.0,   rate: 11.5, date: '2026-07', region: 'europe' },
  { name: 'Канада',           lat: 56.0,  lng: -106.0, rate: 5.4,  date: '2026-07', region: 'america' },
  { name: 'Бразилия',         lat: -10.0, lng: -55.0,  rate: 7.9,  date: '2026-07', region: 'america' },
  { name: 'Индия',            lat: 20.0,  lng: 78.0,   rate: 7.8,  date: '2026-07', region: 'asia' },
  { name: 'Южная Корея',      lat: 36.0,  lng: 128.0,  rate: 3.2,  date: '2026-07', region: 'asia' },
  { name: 'Австралия',        lat: -25.0, lng: 134.0,  rate: 4.1,  date: '2026-07', region: 'oceania' },
  { name: 'Мексика',          lat: 23.0,  lng: -102.0, rate: 3.0,  date: '2026-07', region: 'america' },
  { name: 'ЮАР',              lat: -29.0, lng: 24.0,   rate: 33.5, date: '2026-07', region: 'africa' },
  { name: 'Турция',           lat: 39.0,  lng: 35.0,   rate: 9.5,  date: '2026-07', region: 'europe' },
  { name: 'Греция',           lat: 39.0,  lng: 22.0,   rate: 9.7,  date: '2026-07', region: 'europe' },
  { name: 'Аргентина',        lat: -34.0, lng: -64.0,  rate: 6.6,  date: '2026-07', region: 'america' },
];

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
//  ЗАГРУЗКА BASKET (через basket-loader)
// ============================================================

async function loadData() {
  const loaded = await loadWithFallback({
    basketFile: BASKET_FILE,
    fallbackData: null,
    hint: COLLECTOR_HINT,
  });

  if (loaded.source === 'fallback') {
    const err = new Error('no_data');
    err.statusCode = 503;
    err.hint = COLLECTOR_HINT;
    throw err;
  }
  if (loaded.source === 'corrupted') {
    const err = new Error('invalid_json_in_basket: ' + (loaded.error || 'CORRUPTED_JSON'));
    err.statusCode = 500;
    throw err;
  }
  if (loaded.source === 'error') {
    const err = new Error('basket_read_error: ' + (loaded.error || 'UNKNOWN'));
    err.statusCode = 500;
    throw err;
  }

  return {
    doc: loaded.legacy || loaded.data,
    source: loaded.source,
    shape: loaded.shape || 'unknown',
    mtime: loaded.mtime,
  };
}

/**
 * Определяет режим данных и извлекает соответствующий массив.
 * Возвращает { mode: 'series'|'countries', rows, source, meta }.
 *
 * Режимы:
 *   'series'   — v1-схема с series[{date, value}] (глобальный временной ряд)
 *   'countries'— legacy-массив или doc.countries/doc.data со странами
 */
function extractData(doc) {
  if (Array.isArray(doc)) return { mode: 'countries', rows: doc, source: null, meta: null };

  if (!doc || typeof doc !== 'object') return { mode: 'countries', rows: [], source: null, meta: null };

  // v1-схема — определяем по schema
  if (doc.schema === 'crucix.basket.v1') {
    // Приоритет: если есть series — это временной ряд
    if (Array.isArray(doc.series) && doc.series.length > 0) {
      return { mode: 'series', rows: doc.series, source: doc.meta?.source || null, meta: doc.meta || null };
    }
    if (Array.isArray(doc.points) && doc.points.length > 0) {
      return { mode: 'countries', rows: doc.points, source: doc.meta?.source || null, meta: doc.meta || null };
    }
    return { mode: 'countries', rows: [], source: doc.meta?.source || null, meta: doc.meta || null };
  }

  // Legacy
  if (Array.isArray(doc.countries)) return { mode: 'countries', rows: doc.countries, source: doc.source || null, meta: doc.meta || null };
  if (Array.isArray(doc.data))      return { mode: 'countries', rows: doc.data,      source: doc.source || null, meta: doc.meta || null };
  if (Array.isArray(doc.items))     return { mode: 'countries', rows: doc.items,     source: doc.source || null, meta: doc.meta || null };
  if (Array.isArray(doc.series))    return { mode: 'series',    rows: doc.series,    source: doc.source || null, meta: doc.meta || null };

  return { mode: 'countries', rows: [], source: null, meta: null };
}

// ============================================================
//  НОРМАЛИЗАЦИЯ
// ============================================================

function normalizeCountry(c, i) {
  const name = c.name || c.country || `Country ${i}`;
  const lat = Number(c.lat ?? c.latitude);
  const lng = Number(c.lng ?? c.lon ?? c.longitude);
  const rate = Number(c.rate ?? c.value ?? c.unemployment);
  const date = String(c.date || c.timestamp || '').slice(0, 10) || null;
  const regime = regimeOf(rate);

  return {
    id: String(c.id || c.code || name),
    name,
    country_code: c.country_code || c.code || null,
    region: c.region || null,
    lat: Number.isFinite(lat) ? Number(lat.toFixed(4)) : null,
    lng: Number.isFinite(lng) ? Number(lng.toFixed(4)) : null,
    rate: Number.isFinite(rate) ? Number(rate.toFixed(2)) : null,
    date,
    regime: regime.key,
    regimeLabel: regime.label,
    regimeColor: regime.color,
    severity: regime.severity,
    category_: 'economics',
    icon: meta.icon,
  };
}

/**
 * Нормализация точки временного ряда.
 * v1: {date, value} → {date, rate, regime, regimeLabel, regimeColor, severity}
 */
function normalizeSeriesPoint(p, i) {
  const date = String(p.date || p.timestamp || '').slice(0, 10) || null;
  const rate = Number(p.value ?? p.rate ?? p.unemployment);
  const regime = regimeOf(rate);
  return {
    id: `series-${i}`,
    name: 'GLOBAL',
    date,
    rate: Number.isFinite(rate) ? Number(rate.toFixed(2)) : null,
    regime: regime.key,
    regimeLabel: regime.label,
    regimeColor: regime.color,
    severity: regime.severity,
    category_: 'economics',
    icon: meta.icon,
  };
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function inBbox(c, w, s, e, n) {
  return c.lat != null && c.lng != null && c.lat >= s && c.lat <= n && c.lng >= w && c.lng <= e;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.country) r = r.filter(x => String(x.name).toLowerCase().includes(String(query.country).toLowerCase()));
  if (query.region)  r = r.filter(x => x.region === String(query.region).toLowerCase());
  if (query.regime)  r = r.filter(x => x.regime === String(query.regime).toLowerCase());
  if (query.q) {
    const q = String(query.q).toLowerCase();
    r = r.filter(x => (x.name + ' ' + (x.region || '')).toLowerCase().includes(q));
  }
  if (query.min_rate != null) { const n = Number(query.min_rate); if (Number.isFinite(n)) r = r.filter(x => x.rate != null && x.rate >= n); }
  if (query.max_rate != null) { const n = Number(query.max_rate); if (Number.isFinite(n)) r = r.filter(x => x.rate != null && x.rate <= n); }
  if (query.since) r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  if (query.until) r = r.filter(x => !x.date || x.date <= String(query.until).slice(0, 10));
  if (query.bbox) {
    const [w, s, e, n] = String(query.bbox).split(',').map(Number);
    if ([w, s, e, n].every(Number.isFinite)) r = r.filter(x => inBbox(x, w, s, e, n));
  }

  const sortKey = query.sort || 'rate-desc';
  if (sortKey === 'rate-desc')  r.sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
  else if (sortKey === 'rate-asc')   r.sort((a, b) => (a.rate ?? 1e9) - (b.rate ?? 1e9));
  else if (sortKey === 'name')       r.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  else if (sortKey === 'region')     r.sort((a, b) => String(a.region || '').localeCompare(String(b.region || '')));
  else if (sortKey === 'date-asc')   r.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  else if (sortKey === 'date-desc')  r.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  else if (sortKey === 'severity')   r.sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0));

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(-n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(rows) {
  const byRegime = { low: 0, normal: 0, elevated: 0, high: 0, severe: 0, unknown: 0 };
  const byRegion = {};
  const rates = [];
  for (const r of rows) {
    byRegime[r.regime] = (byRegime[r.regime] || 0) + 1;
    if (r.region) byRegion[r.region] = (byRegion[r.region] || 0) + 1;
    if (r.rate != null) rates.push(r.rate);
  }
  const dates = rows.map(r => r.date).filter(Boolean).sort();

  const top = (obj, n = 15) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));

  if (!rates.length) {
    return {
      count: rows.length,
      by_regime: byRegime,
      by_region: byRegion,
      top_regions: top(byRegion, 10),
      rate: null,
    };
  }
  const sorted = [...rates].sort((a, b) => a - b);
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const variance = rates.reduce((a, v) => a + (v - mean) ** 2, 0) / rates.length;

  return {
    count: rows.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    by_regime: byRegime,
    by_region: byRegion,
    top_regions: top(byRegion, 10),
    rate: {
      min: Number(Math.min(...rates).toFixed(2)),
      max: Number(Math.max(...rates).toFixed(2)),
      mean: Number(mean.toFixed(2)),
      median: Number(median.toFixed(2)),
      stddev: Number(Math.sqrt(variance).toFixed(2)),
    },
    highest: rows.slice().sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))[0] || null,
    lowest:  rows.slice().sort((a, b) => (a.rate ?? 1e9) - (b.rate ?? 1e9))[0] || null,
  };
}

function computeDistribution(rows) {
  return SIZE_BUCKETS.map(b => {
    const items = rows.filter(r => r.rate != null && r.rate >= b.min && r.rate < b.max);
    return { label: b.label, range: [b.min, b.max === Infinity ? 'inf' : b.max], color: b.color, count: items.length, countries: items.map(x => x.name) };
  }).filter(b => b.count > 0);
}

function computeAnomalies(rows) {
  const rates = rows.map(r => r.rate).filter(Number.isFinite);
  if (rates.length < 3) return [];
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((a, v) => a + (v - mean) ** 2, 0) / rates.length;
  const stddev = Math.sqrt(variance);
  const threshold = 2 * stddev;
  return rows
    .filter(r => r.rate != null && Math.abs(r.rate - mean) > threshold)
    .map(r => ({
      name: r.name,
      rate: r.rate,
      z_score: Number(((r.rate - mean) / (stddev || 1)).toFixed(2)),
      deviation: Number((r.rate - mean).toFixed(2)),
      regime: r.regime,
    }))
    .sort((a, b) => Math.abs(b.z_score) - Math.abs(a.z_score));
}

function computeTrends(rows) {
  const tail = rows.slice(-7);
  const prev = rows.slice(-14, -7);
  if (!tail.length || !prev.length) return null;
  const m = a => a.reduce((s, r) => s + (r.rate ?? 0), 0) / a.length;
  const mNew = m(tail), mOld = m(prev);
  const delta = mOld === 0 ? null : ((mNew - mOld) / Math.abs(mOld) * 100);
  return {
    last7_mean: Number(mNew.toFixed(2)),
    prev7_mean: Number(mOld.toFixed(2)),
    delta_pct: delta != null ? Number(delta.toFixed(2)) : null,
    direction: delta == null ? 'unknown' : (delta > 2 ? 'rising' : (delta < -2 ? 'falling' : 'stable')),
  };
}

function computeVolatility(rows) {
  const values = rows.map(r => r.rate).filter(Number.isFinite);
  if (values.length < 3) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  return {
    window: values.length,
    mean: Number(mean.toFixed(2)),
    stddev: Number(stddev.toFixed(2)),
    coefficient_pct: mean !== 0 ? Number((stddev / Math.abs(mean) * 100).toFixed(2)) : null,
    min: Number(Math.min(...values).toFixed(2)),
    max: Number(Math.max(...values).toFixed(2)),
  };
}

function toReport(rows, stats) {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push('  UNEMPLOYMENT REPORT — Crucix');
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Всего записей: ${stats.count}`);
  lines.push('');
  lines.push('РЕЖИМЫ:');
  for (const [k, v] of Object.entries(stats.by_regime)) lines.push(`  ${k.padEnd(10)} ${v}`);
  lines.push('');
  if (stats.rate) lines.push(`RATE — min: ${stats.rate.min}%  max: ${stats.rate.max}%  mean: ${stats.rate.mean}%  stddev: ${stats.rate.stddev}%`);
  lines.push('');
  if (stats.highest) lines.push(`Наибольшая: ${stats.highest.name} — ${stats.highest.rate}%`);
  if (stats.lowest)  lines.push(`Наименьшая: ${stats.lowest.name} — ${stats.lowest.rate}%`);
  lines.push('');
  lines.push('='.repeat(60));
  return lines.join('\n');
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(rows) {
  const features = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, country_code: r.country_code, region: r.region,
        rate: r.rate, date: r.date,
        regime: r.regime, regimeLabel: r.regimeLabel, regimeColor: r.regimeColor,
        severity: r.severity,
        category_: r.category_, icon: r.icon,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    legend: Object.entries(REGIME_META).filter(([k]) => k !== 'unknown').map(([key, def]) => ({
      key, label: def.label, color: def.color, range: [def.min, def.max === Infinity ? 'inf' : def.max],
    })),
    meta: { total: rows.length, mapped: features.length, unmapped: rows.length - features.length },
  };
}

function toSeries(rows) {
  return rows.map(r => ({
    id: r.id, name: r.name, region: r.region,
    rate: r.rate, date: r.date,
    regime: r.regime, regimeLabel: r.regimeLabel,
  }));
}

function toCSV(rows) {
  const lines = ['id,name,region,rate,date,regime,lat,lng'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const r of rows) lines.push([r.id, r.name, r.region, r.rate, r.date, r.regime, r.lat, r.lng].map(esc).join(','));
  return lines.join('\n') + '\n';
}

function toRenderConfig(rows) {
  const markers = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      id: r.id, lat: r.lat, lng: r.lng,
      color: r.regimeColor, icon: meta.icon,
      radius: r.regime === 'severe' ? 14 : (r.regime === 'high' ? 10 : (r.regime === 'low' ? 10 : 6)),
      properties: { name: r.name, rate: r.rate, regime: r.regime, region: r.region },
    }));
  return {
    markers,
    legend: Object.entries(REGIME_META).filter(([k]) => k !== 'unknown').map(([key, def]) => ({
      key, label: def.label, color: def.color, range: [def.min, def.max === Infinity ? 'inf' : def.max],
    })),
    filterable: ['country', 'region', 'regime', 'min_rate', 'max_rate', 'since', 'bbox', 'sort'],
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/unemployment/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const extra = {
      'X-Module': 'unemployment-api',
      'X-Module-Version': '3.0.1',
      'Cache-Control': `public, max-age=${meta.cache}`,
      'Access-Control-Allow-Origin': '*',
    };

    if (sub === '/builtin') {
      const rows = BUILTIN_COUNTRIES.map(normalizeCountry);
      const fc = toFeatureCollection(rows);
      return sendJSON(res, 200, {
        type: 'FeatureCollection',
        features: fc.features,
        legend: fc.legend,
        series: toSeries(rows),
        stats: computeStats(rows),
        meta: { source: 'builtin', count: rows.length, mode: 'countries', generated_at: new Date().toISOString() },
      }, extra);
    }

    if (sub === '/config') {
      return sendJSON(res, 200, {
        regimes: Object.entries(REGIME_META).map(([k, v]) => ({ key: k, ...v })),
        size_buckets: SIZE_BUCKETS,
        filter_presets: FILTER_PRESETS,
        cache_ttl_ms: CACHE_TTL,
      }, extra);
    }

    if (sub === '/filter-presets') {
      return sendJSON(res, 200, { presets: FILTER_PRESETS, count: FILTER_PRESETS.length }, extra);
    }

    let loaded;
    try { loaded = await loadData(); }
    catch (e) {
      if (e.statusCode === 503 && (sub === '/health' || sub === '/status')) {
        return sendJSON(res, 200, {
          status: 'degraded', basket_available: false, hint: e.hint,
          generated_at: new Date().toISOString(),
        }, extra);
      }
      throw e;
    }

    const { doc, source: basketSource, shape: basketShape, mtime: basketMtime } = loaded;
    extra['X-Basket-Source'] = basketSource;
    extra['X-Basket-Shape'] = basketShape;

    const { mode, rows: rawArr, source, meta: srcMeta } = extractData(doc);

    // Нормализация в зависимости от режима
    const all = mode === 'series'
      ? rawArr.map(normalizeSeriesPoint)
      : rawArr.map(normalizeCountry);

    if (sub === '/health') {
      return sendJSON(res, 200, {
        status: 'online', basket_available: true, mode, entries: all.length,
        basket_source: basketSource, basket_shape: basketShape, basket_mtime: basketMtime,
        cache_size: _cache.size, generated_at: new Date().toISOString(),
      }, extra);
    }
    if (sub === '/count') {
      const stats = computeStats(all);
      return sendJSON(res, 200, {
        total: stats.count,
        mode,
        date_from: stats.date_from,
        date_to: stats.date_to,
        by_regime: stats.by_regime,
      }, extra);
    }
    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, {
        stats: computeStats(all),
        mode, source, src_meta: srcMeta,
        basket_source: basketSource, basket_shape: basketShape,
      }, extra);
    }
    if (sub === '/status') {
      const st = computeStats(all);
      return sendJSON(res, 200, {
        status: 'online', mode, entries: all.length,
        highest: st.highest, lowest: st.lowest,
        source, basket_source: basketSource, basket_shape: basketShape,
        generated_at: new Date().toISOString(),
      }, extra);
    }
    if (sub === '/series') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, { series: toSeries(rows), count: rows.length, total: all.length, mode }, extra);
    }
    if (sub === '/countries') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, { countries: rows, count: rows.length, total: all.length, mode }, extra);
    }
    if (sub.startsWith('/countries/')) {
      const name = decodeURIComponent(sub.slice('/countries/'.length));
      const country = all.find(c => String(c.name).toLowerCase() === name.toLowerCase());
      if (!country) return sendJSON(res, 404, { error: 'country_not_found', name }, extra);
      return sendJSON(res, 200, { country }, extra);
    }
    if (sub === '/latest') {
      const latest = all.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 20);
      return sendJSON(res, 200, { latest, count: latest.length, mode }, extra);
    }
    if (sub === '/top') {
      const n = parseInt(query.n || query.top, 10) || 10;
      const rows = all.slice().sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1)).slice(0, n);
      return sendJSON(res, 200, { top: rows, n }, extra);
    }
    if (sub === '/bottom') {
      const n = parseInt(query.n, 10) || 10;
      const rows = all.slice().sort((a, b) => (a.rate ?? 1e9) - (b.rate ?? 1e9)).slice(0, n);
      return sendJSON(res, 200, { bottom: rows, n }, extra);
    }
    if (sub === '/regimes') {
      const byRegime = {};
      for (const r of all) {
        if (!byRegime[r.regime]) byRegime[r.regime] = { key: r.regime, label: r.regimeLabel, color: r.regimeColor, count: 0, countries: [] };
        byRegime[r.regime].count++;
        byRegime[r.regime].countries.push(r.name);
      }
      return sendJSON(res, 200, { regimes: Object.values(byRegime), total: Object.keys(byRegime).length }, extra);
    }
    if (sub === '/current-regime') {
      const st = computeStats(all);
      return sendJSON(res, 200, {
        mode,
        global_mean: st.rate?.mean ?? null,
        distribution: st.by_regime,
        highest: st.highest,
        lowest: st.lowest,
      }, extra);
    }
    if (sub === '/low') {
      const rows = all.filter(r => r.regime === 'low');
      return sendJSON(res, 200, { low: rows, count: rows.length }, extra);
    }
    if (sub === '/normal') {
      const rows = all.filter(r => r.regime === 'normal');
      return sendJSON(res, 200, { normal: rows, count: rows.length }, extra);
    }
    if (sub === '/elevated') {
      const rows = all.filter(r => r.regime === 'elevated');
      return sendJSON(res, 200, { elevated: rows, count: rows.length }, extra);
    }
    if (sub === '/high') {
      const rows = all.filter(r => r.regime === 'high');
      return sendJSON(res, 200, { high: rows, count: rows.length }, extra);
    }
    if (sub === '/severe') {
      const rows = all.filter(r => r.regime === 'severe');
      return sendJSON(res, 200, { severe: rows, count: rows.length }, extra);
    }
    if (sub === '/by-region') {
      const byRegion = {};
      for (const r of all) {
        const reg = r.region || 'unknown';
        if (!byRegion[reg]) byRegion[reg] = { region: reg, count: 0, rates: [], countries: [] };
        byRegion[reg].count++;
        if (r.rate != null) byRegion[reg].rates.push(r.rate);
        byRegion[reg].countries.push(r.name);
      }
      const result = Object.values(byRegion).map(x => ({
        region: x.region,
        count: x.count,
        avg_rate: x.rates.length ? Number((x.rates.reduce((a, b) => a + b, 0) / x.rates.length).toFixed(2)) : null,
        countries: x.countries,
      }));
      return sendJSON(res, 200, { regions: result, total: result.length }, extra);
    }
    if (sub === '/by-regime') {
      const byRegime = {};
      for (const r of all) {
        if (!byRegime[r.regime]) byRegime[r.regime] = { name: r.regime, label: r.regimeLabel, color: r.regimeColor, severity: r.severity, count: 0, countries: [] };
        byRegime[r.regime].count++;
        byRegime[r.regime].countries.push(r.name);
      }
      return sendJSON(res, 200, { regimes: Object.values(byRegime), total: Object.keys(byRegime).length }, extra);
    }
    if (sub === '/by-country') {
      const byCountry = {};
      for (const r of all) {
        const key = r.name || 'unknown';
        if (!byCountry[key]) byCountry[key] = { country: key, count: 0, rates: [], dates: [] };
        byCountry[key].count++;
        if (r.rate != null) byCountry[key].rates.push(r.rate);
        if (r.date) byCountry[key].dates.push(r.date);
      }
      const result = Object.values(byCountry).map(x => ({
        country: x.country,
        count: x.count,
        avg_rate: x.rates.length ? Number((x.rates.reduce((a, b) => a + b, 0) / x.rates.length).toFixed(2)) : null,
        date_from: x.dates.sort()[0] || null,
        date_to: x.dates.sort().slice(-1)[0] || null,
      }));
      return sendJSON(res, 200, { countries: result, total: result.length }, extra);
    }
    if (sub === '/distribution') {
      const distribution = computeDistribution(all);
      return sendJSON(res, 200, { distribution }, extra);
    }
    if (sub === '/anomalies') {
      const anomalies = computeAnomalies(all);
      return sendJSON(res, 200, { anomalies, count: anomalies.length }, extra);
    }
    if (sub === '/signals') {
      const st = computeStats(all);
      const signals = [];
      if (st.highest && st.highest.rate >= 12) signals.push({ type: 'severe-unemployment', country: st.highest.name, rate: st.highest.rate, severity: 4 });
      if (st.lowest && st.lowest.rate < 3)   signals.push({ type: 'labor-shortage',   country: st.lowest.name,  rate: st.lowest.rate,  severity: 2 });
      if (st.rate && st.rate.stddev > 3)     signals.push({ type: 'high-divergence',   stddev: st.rate.stddev, severity: 2 });
      return sendJSON(res, 200, { signals, count: signals.length }, extra);
    }
    if (sub === '/compare') {
      const names = String(query.names || '').split(',').map(s => s.trim()).filter(Boolean);
      const results = names.map(n => all.find(c => String(c.name).toLowerCase() === n.toLowerCase())).filter(Boolean);
      return sendJSON(res, 200, { count: results.length, results }, extra);
    }
    if (sub === '/search') {
      const q = String(query.q || '').toLowerCase();
      if (!q) return sendJSON(res, 400, { error: 'field_required: q' }, extra);
      const rows = all.filter(c => (String(c.name) + ' ' + (c.region || '')).toLowerCase().includes(q));
      return sendJSON(res, 200, { query: q, results: rows, count: rows.length }, extra);
    }
    if (sub === '/bbox') {
      const w = Number(query.w), s = Number(query.s), e = Number(query.e), n = Number(query.n);
      if (![w, s, e, n].every(Number.isFinite)) return sendJSON(res, 400, { error: 'field_required: w,s,e,n' }, extra);
      const rows = all.filter(c => inBbox(c, w, s, e, n));
      return sendJSON(res, 200, { bbox: [w, s, e, n], countries: rows, count: rows.length }, extra);
    }
    if (sub === '/timeline') {
      const byDate = {};
      for (const c of all) {
        if (!c.date) continue;
        if (!byDate[c.date]) byDate[c.date] = { date: c.date, count: 0, countries: [] };
        byDate[c.date].count++;
        byDate[c.date].countries.push(c.name);
      }
      const timeline = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
      return sendJSON(res, 200, { timeline, days: timeline.length, mode }, extra);
    }
    if (sub === '/trends') {
      const cached = cacheGet('trends');
      if (cached) return sendJSON(res, 200, { trends: cached, cached: true }, extra);
      const stats = computeStats(all);
      const trends = {
        mode,
        top_regions: stats.top_regions,
        by_regime: stats.by_regime,
        rate_stats: stats.rate,
        rolling: computeTrends(all),
        volatility: computeVolatility(all),
      };
      cachePut('trends', trends);
      return sendJSON(res, 200, { trends }, extra);
    }
    if (sub === '/volatility' || sub === '/vol') {
      const vol = computeVolatility(all);
      return sendJSON(res, 200, { volatility: vol }, extra);
    }
    if (sub === '/export' || format === 'report') {
      const stats = computeStats(all);
      const report = toReport(all, stats);
      return sendText(res, 200, report, 'text/plain; charset=utf-8');
    }
    if (sub === '/reset-cache') {
      const before = _cache.size;
      cacheClear();
      return sendJSON(res, 200, { cleared: before, now: _cache.size }, extra);
    }
    if (sub === '/featurecollection') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }
    if (sub === '/render') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, { render: toRenderConfig(rows) }, extra);
    }

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length, mode } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, mode, source, src_meta: srcMeta, basket_source: basketSource, basket_shape: basketShape }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        mode, total_entries: all.length, returned_entries: rows.length,
        upstream_source: source, upstream_meta: srcMeta,
        basket_source: basketSource, basket_shape: basketShape, basket_mtime: basketMtime,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      legend: fc.legend,
      series: toSeries(rows),
      stats: computeStats(rows),
      highest: computeStats(rows).highest,
      lowest:  computeStats(rows).lowest,
      anomalies: computeAnomalies(rows).slice(0, 5),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch (e2) {}
  }
}
