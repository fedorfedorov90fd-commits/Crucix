/**
 * apis/sources/sp500-vix-api.mjs — API-МОДУЛЬ: SP500/VIX RATIO (RISK APPETITE)
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/sp500-vix.json — [{ date, sp500, vix, ratio }] ИЛИ { data:[...] } ИЛИ { series:[...] }.
 * Сборщик: scripts/collectors/collect-sp500-vix.mjs.
 *
 * Индикатор склонности к риску (Risk Appetite / Risk-On vs Risk-Off).
 * Соотношение S&P 500 (индекс акций) к VIX (индекс волатильности).
 *   - Ratio растёт → risk-on (инвесторы уверены)
 *   - Ratio падает → risk-off (страх, бегство в защиту)
 *
 * Точка ряда:
 *   { date, sp500, vix, ratio }
 *
 * Режимы:
 *   risk-on (ratio > 250, vix < 20)
 *   neutral (200-250, vix 20-25)
 *   risk-off (ratio < 200, vix > 25)
 *   panic (ratio < 150, vix > 35)
 *
 * ФОРМАТЫ: json (FC + series + stats + regimes), csv, series, stats, raw, report.
 * ФИЛЬТРЫ: ?since=, ?until=, ?min_ratio=, ?max_ratio=, ?min_vix=, ?max_vix=,
 *          ?min_sp500=, ?max_sp500=, ?regime=, ?limit=, ?top=, ?sort=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /                       — сводка (FC + series + stats + regime)
 *   GET /stats                  — агрегированная статистика
 *   GET /status                 — health-check
 *   GET /health                 — расширенный health
 *   GET /config                 — конфигурация (пороги режимов, цвета)
 *   GET /count                  — только числа
 *   GET /series                 — временной ряд
 *   GET /latest                 — последнее значение
 *   GET /recent?since=          — свежие точки
 *   GET /top?n=N                — топ по ratio
 *   GET /bottom?n=N             — антитоп по ratio
 *   GET /regimes                — группировка по режимам
 *   GET /current-regime         — текущий режим
 *   GET /risk-on                — точки risk-on
 *   GET /risk-off               — точки risk-off
 *   GET /panic                  — точки panic
 *   GET /volatility             — волатильность ratio
 *   GET /correlations           — корреляции sp500/vix/ratio
 *   GET /distribution           — распределение ratio по бакетам
 *   GET /timeline               — динамика по дням
 *   GET /trends                 — тренды (7 vs 7)
 *   GET /anomalies              — аномалии
 *   GET /signals                — торговые сигналы (buy/sell/hold)
 *   GET /companies              — компании S&P 500 из basket/sp500.json
 *   GET /compare?dates=a,b,c    — сравнение точек
 *   GET /filter-presets         — готовые фильтры
 *   GET /export                 — текстовый отчёт
 *   GET /reset-cache            — сброс кэша
 *   GET /featurecollection      — GeoJSON (S&P-компании + индекс)
 *   GET /render                 — рендер-конфиг
 *   GET /builtin                — встроенный fallback (20 точек)
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'sp500-vix.json');
const COMPANIES_FILE = join(PROJECT_ROOT, 'data', 'basket', 'sp500.json');

export const route  = '/api/layers/sp500-vix';
export const method = 'GET';

export const meta = {
  category: 'finance',
  icon: '📈',
  color: '#44aaff',
  vizType: 'series',
  source: 'basket/sp500-vix.json',
  collector: 'collect-sp500-vix.mjs',
  cache: 300,
  description: 'S&P 500 / VIX Ratio — индикатор склонности к риску (risk-on/risk-off)',
  unit: 'ratio',
};

// ============================================================
//  КЛАССИФИКАЦИЯ РЕЖИМОВ
// ============================================================

const REGIME_META = {
  risk_on:  { color: '#22c55e', label: 'Risk-On',  severity: 1, description: 'Уверенность, рост акций, низкая волатильность' },
  neutral:  { color: '#eab308', label: 'Neutral',  severity: 2, description: 'Неопределённость, диапазон' },
  risk_off: { color: '#f97316', label: 'Risk-Off', severity: 3, description: 'Страх, падение акций, рост волатильности' },
  panic:    { color: '#dc2626', label: 'Panic',    severity: 4, description: 'Паника, обвал, экстремальная волатильность' },
  unknown:  { color: '#64748b', label: 'Неизвестно', severity: 0, description: 'Нет данных' },
};

function regimeOf(ratio, vix) {
  const r = Number(ratio);
  const v = Number(vix);
  if (!Number.isFinite(r)) return { key: 'unknown', ...REGIME_META.unknown };
  if (r < 150 || v > 35) return { key: 'panic',    ...REGIME_META.panic };
  if (r < 200 || v > 25) return { key: 'risk_off', ...REGIME_META.risk_off };
  if (r >= 250 && v < 20) return { key: 'risk_on', ...REGIME_META.risk_on };
  return { key: 'neutral', ...REGIME_META.neutral };
}

const SIZE_BUCKETS = [
  { min: 0,   max: 150,  label: '< 150 (panic)',     color: '#dc2626' },
  { min: 150, max: 200,  label: '150-200 (risk-off)', color: '#f97316' },
  { min: 200, max: 250,  label: '200-250 (neutral)',  color: '#eab308' },
  { min: 250, max: 300,  label: '250-300 (risk-on)',  color: '#84cc16' },
  { min: 300, max: Infinity, label: '> 300 (strong risk-on)', color: '#22c55e' },
];

const FILTER_PRESETS = [
  { id: 'all',       label: 'Весь ряд',                  params: {} },
  { id: 'latest',    label: 'Последние 30',              params: { sort: 'date-desc', limit: 30 } },
  { id: 'risk-on',   label: 'Risk-On',                   params: { regime: 'risk_on' } },
  { id: 'risk-off',  label: 'Risk-Off',                  params: { regime: 'risk_off' } },
  { id: 'panic',     label: 'Паника',                    params: { regime: 'panic' } },
  { id: 'high-ratio',label: 'Ratio > 250',               params: { min_ratio: 250 } },
  { id: 'low-ratio', label: 'Ratio < 200',               params: { max_ratio: 200 } },
];

// ============================================================
//  FALLBACK (20 точек)
// ============================================================

const BUILTIN_SERIES = [
  { date: '2026-07-23', sp500: 4500, vix: 18.5, ratio: 243.2 },
  { date: '2026-07-24', sp500: 4520, vix: 17.8, ratio: 254.0 },
  { date: '2026-07-25', sp500: 4480, vix: 19.2, ratio: 233.3 },
  { date: '2026-07-26', sp500: 4510, vix: 18.0, ratio: 250.6 },
  { date: '2026-07-27', sp500: 4490, vix: 19.5, ratio: 230.3 },
  { date: '2026-07-28', sp500: 4530, vix: 17.2, ratio: 263.4 },
  { date: '2026-07-29', sp500: 4550, vix: 16.8, ratio: 270.8 },
  { date: '2026-07-30', sp500: 4515, vix: 18.6, ratio: 242.7 },
  { date: '2026-07-31', sp500: 4480, vix: 20.4, ratio: 219.6 },
  { date: '2026-08-01', sp500: 4450, vix: 21.8, ratio: 204.1 },
  { date: '2026-08-02', sp500: 4420, vix: 23.5, ratio: 188.1 },
  { date: '2026-08-03', sp500: 4380, vix: 26.2, ratio: 167.2 },
  { date: '2026-08-04', sp500: 4350, vix: 28.9, ratio: 150.5 },
  { date: '2026-08-05', sp500: 4310, vix: 32.1, ratio: 134.3 },
  { date: '2026-08-06', sp500: 4280, vix: 36.5, ratio: 117.3 },
  { date: '2026-08-07', sp500: 4320, vix: 33.2, ratio: 130.1 },
  { date: '2026-08-08', sp500: 4360, vix: 30.5, ratio: 143.0 },
  { date: '2026-08-09', sp500: 4400, vix: 27.8, ratio: 158.3 },
  { date: '2026-08-10', sp500: 4440, vix: 24.5, ratio: 181.2 },
  { date: '2026-08-11', sp500: 4480, vix: 21.2, ratio: 211.3 },
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
//  ЗАГРУЗКА BASKET
// ============================================================

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-sp500-vix.mjs';
      throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  return parsed;
}

async function loadCompanies() {
  try {
    const raw = await fs.readFile(COMPANIES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.companies)) return parsed.companies;
    return [];
  } catch (e) { return []; }
}

function extractSeries(doc) {
  if (Array.isArray(doc)) return { series: doc, source: null, meta: null };
  if (!doc || typeof doc !== 'object') return { series: [], source: null, meta: null };
  if (Array.isArray(doc.data))   return { series: doc.data,   source: doc.source || null, meta: doc.meta || null };
  if (Array.isArray(doc.series)) return { series: doc.series, source: doc.source || null, meta: doc.meta || null };
  if (Array.isArray(doc.items))  return { series: doc.items,  source: doc.source || null, meta: doc.meta || null };
  return { series: [], source: null, meta: null };
}

// ============================================================
//  НОРМАЛИЗАЦИЯ
// ============================================================

function normalizePoint(p, i) {
  const date = String(p.date || p.timestamp || '').slice(0, 10) || null;
  const sp500 = Number(p.sp500 ?? p.sp);
  const vix = Number(p.vix ?? p.v);
  let ratio = Number(p.ratio);
  if (!Number.isFinite(ratio) && Number.isFinite(sp500) && Number.isFinite(vix) && vix > 0) {
    ratio = Number((sp500 / vix).toFixed(2));
  }
  const regime = regimeOf(ratio, vix);

  return {
    date,
    sp500: Number.isFinite(sp500) ? Number(sp500.toFixed(2)) : null,
    vix: Number.isFinite(vix) ? Number(vix.toFixed(2)) : null,
    ratio: Number.isFinite(ratio) ? Number(ratio.toFixed(2)) : null,
    regime: regime.key,
    regimeLabel: regime.label,
    regimeColor: regime.color,
    severity: regime.severity,
    category_: 'finance',
    icon: meta.icon,
  };
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.regime) r = r.filter(x => x.regime === String(query.regime).toLowerCase());
  if (query.since)  r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  if (query.until)  r = r.filter(x => !x.date || x.date <= String(query.until).slice(0, 10));
  if (query.min_ratio != null) { const n = Number(query.min_ratio); if (Number.isFinite(n)) r = r.filter(x => x.ratio != null && x.ratio >= n); }
  if (query.max_ratio != null) { const n = Number(query.max_ratio); if (Number.isFinite(n)) r = r.filter(x => x.ratio != null && x.ratio <= n); }
  if (query.min_vix != null)   { const n = Number(query.min_vix);   if (Number.isFinite(n)) r = r.filter(x => x.vix != null && x.vix >= n); }
  if (query.max_vix != null)   { const n = Number(query.max_vix);   if (Number.isFinite(n)) r = r.filter(x => x.vix != null && x.vix <= n); }
  if (query.min_sp500 != null) { const n = Number(query.min_sp500); if (Number.isFinite(n)) r = r.filter(x => x.sp500 != null && x.sp500 >= n); }
  if (query.max_sp500 != null) { const n = Number(query.max_sp500); if (Number.isFinite(n)) r = r.filter(x => x.sp500 != null && x.sp500 <= n); }

  const sortKey = query.sort || 'date-asc';
  if (sortKey === 'date-asc')     r.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  else if (sortKey === 'date-desc')  r.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  else if (sortKey === 'ratio-desc') r.sort((a, b) => (b.ratio ?? -1) - (a.ratio ?? -1));
  else if (sortKey === 'ratio-asc')  r.sort((a, b) => (a.ratio ?? 1e9) - (b.ratio ?? 1e9));
  else if (sortKey === 'vix-desc')   r.sort((a, b) => (b.vix ?? -1) - (a.vix ?? -1));
  else if (sortKey === 'vix-asc')    r.sort((a, b) => (a.vix ?? 1e9) - (b.vix ?? 1e9));

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(-n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(rows) {
  const byRegime = { risk_on: 0, neutral: 0, risk_off: 0, panic: 0, unknown: 0 };
  const ratios = [], vixes = [], sps = [];
  for (const r of rows) {
    byRegime[r.regime] = (byRegime[r.regime] || 0) + 1;
    if (r.ratio != null) ratios.push(r.ratio);
    if (r.vix != null) vixes.push(r.vix);
    if (r.sp500 != null) sps.push(r.sp500);
  }
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  const stats = (arr) => {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    const variance = arr.reduce((a, v) => a + (v - mean) ** 2, 0) / arr.length;
    return {
      count: arr.length,
      min: Number(Math.min(...arr).toFixed(2)),
      max: Number(Math.max(...arr).toFixed(2)),
      mean: Number(mean.toFixed(2)),
      median: Number(median.toFixed(2)),
      stddev: Number(Math.sqrt(variance).toFixed(2)),
    };
  };

  return {
    count: rows.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    by_regime: byRegime,
    ratio: stats(ratios),
    vix: stats(vixes),
    sp500: stats(sps),
    last: rows.slice(-1)[0] || null,
  };
}

function computeCorrelations(rows) {
  const pairs = rows.filter(r => r.sp500 != null && r.vix != null && r.ratio != null);
  if (pairs.length < 3) return null;

  const corr = (arrA, arrB) => {
    const n = arrA.length;
    const mA = arrA.reduce((a, b) => a + b, 0) / n;
    const mB = arrB.reduce((a, b) => a + b, 0) / n;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) {
      const da_ = arrA[i] - mA, db_ = arrB[i] - mB;
      num += da_ * db_; da += da_ * da_; db += db_ * db_;
    }
    const den = Math.sqrt(da * db);
    return den === 0 ? 0 : Number((num / den).toFixed(3));
  };

  const sp = pairs.map(p => p.sp500);
  const vx = pairs.map(p => p.vix);
  const rt = pairs.map(p => p.ratio);

  return {
    sp500_vix: corr(sp, vx),
    sp500_ratio: corr(sp, rt),
    vix_ratio: corr(vx, rt),
    samples: pairs.length,
  };
}

function computeDistribution(rows) {
  return SIZE_BUCKETS.map(b => {
    const items = rows.filter(r => r.ratio != null && r.ratio >= b.min && r.ratio < b.max);
    return {
      label: b.label,
      range: [b.min, b.max === Infinity ? 'inf' : b.max],
      color: b.color,
      count: items.length,
      dates: items.map(x => x.date),
    };
  }).filter(b => b.count > 0);
}

function computeTrends(rows) {
  const tail = rows.slice(-7);
  const prev = rows.slice(-14, -7);
  if (!tail.length || !prev.length) return null;
  const mRatio = a => a.reduce((s, r) => s + (r.ratio ?? 0), 0) / a.length;
  const mVix = a => a.reduce((s, r) => s + (r.vix ?? 0), 0) / a.length;
  const mSp = a => a.reduce((s, r) => s + (r.sp500 ?? 0), 0) / a.length;
  const trendPct = (a, b) => b === 0 ? null : Number(((a - b) / b * 100).toFixed(2));
  return {
    ratio_7v7: trendPct(mRatio(tail), mRatio(prev)),
    vix_7v7:   trendPct(mVix(tail),   mVix(prev)),
    sp500_7v7: trendPct(mSp(tail),    mSp(prev)),
    direction: mRatio(tail) > mRatio(prev) ? 'rising' : mRatio(tail) < mRatio(prev) ? 'falling' : 'flat',
  };
}

function computeVolatility(rows) {
  if (rows.length < 3) return null;
  const ratios = rows.map(r => r.ratio).filter(Number.isFinite);
  if (ratios.length < 3) return null;
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const variance = ratios.reduce((a, v) => a + (v - mean) ** 2, 0) / ratios.length;
  return {
    window: rows.length,
    mean: Number(mean.toFixed(2)),
    stddev: Number(Math.sqrt(variance).toFixed(2)),
    coefficient_pct: mean ? Number((Math.sqrt(variance) / mean * 100).toFixed(2)) : null,
    min: Number(Math.min(...ratios).toFixed(2)),
    max: Number(Math.max(...ratios).toFixed(2)),
  };
}

function computeAnomalies(rows) {
  if (rows.length < 3) return [];
  const ratios = rows.map(r => r.ratio).filter(Number.isFinite);
  if (ratios.length < 3) return [];
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const variance = ratios.reduce((a, v) => a + (v - mean) ** 2, 0) / ratios.length;
  const stddev = Math.sqrt(variance);
  const threshold = 2 * stddev;
  return rows.filter(r => r.ratio != null && Math.abs(r.ratio - mean) > threshold)
    .map(r => ({
      date: r.date,
      ratio: r.ratio,
      z_score: Number(((r.ratio - mean) / (stddev || 1)).toFixed(2)),
      deviation: Number((r.ratio - mean).toFixed(2)),
      regime: r.regime,
    }))
    .sort((a, b) => Math.abs(b.z_score) - Math.abs(a.z_score));
}

function computeSignals(rows) {
  if (rows.length < 2) return [];
  const signals = [];
  let prev = rows[0];
  for (let i = 1; i < rows.length; i++) {
    const cur = rows[i];
    if (prev.ratio == null || cur.ratio == null) { prev = cur; continue; }
    const delta = cur.ratio - prev.ratio;
    const deltaPct = prev.ratio ? (delta / prev.ratio * 100) : 0;
    let signal = 'hold';
    if (deltaPct > 3) signal = 'buy';
    else if (deltaPct < -3) signal = 'sell';
    signals.push({
      date: cur.date,
      from: prev.ratio,
      to: cur.ratio,
      delta: Number(delta.toFixed(2)),
      delta_pct: Number(deltaPct.toFixed(2)),
      signal,
      regime: cur.regime,
    });
    prev = cur;
  }
  return signals;
}

function toReport(rows, stats) {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push('  S&P 500 / VIX RATIO REPORT');
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Точек: ${stats.count}`);
  lines.push(`Период: ${stats.date_from} → ${stats.date_to}`);
  lines.push('');
  lines.push('РЕЖИМЫ:');
  lines.push(`  Risk-On:  ${stats.by_regime.risk_on}`);
  lines.push(`  Neutral:  ${stats.by_regime.neutral}`);
  lines.push(`  Risk-Off: ${stats.by_regime.risk_off}`);
  lines.push(`  Panic:    ${stats.by_regime.panic}`);
  lines.push('');
  if (stats.ratio) lines.push(`RATIO — min: ${stats.ratio.min}  max: ${stats.ratio.max}  mean: ${stats.ratio.mean}  stddev: ${stats.ratio.stddev}`);
  if (stats.vix)   lines.push(`VIX   — min: ${stats.vix.min}  max: ${stats.vix.max}  mean: ${stats.vix.mean}`);
  if (stats.sp500) lines.push(`SP500 — min: ${stats.sp500.min}  max: ${stats.sp500.max}  mean: ${stats.sp500.mean}`);
  lines.push('');
  if (stats.last) {
    lines.push(`ПОСЛЕДНЕЕ ЗНАЧЕНИЕ (${stats.last.date}):`);
    lines.push(`  SP500: ${stats.last.sp500}  VIX: ${stats.last.vix}  Ratio: ${stats.last.ratio}  Режим: ${stats.last.regimeLabel}`);
  }
  lines.push('');
  lines.push('='.repeat(60));
  return lines.join('\n');
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(rows) {
  return {
    type: 'FeatureCollection',
    features: [],
    legend: Object.entries(REGIME_META).filter(([k]) => k !== 'unknown').map(([key, def]) => ({
      key, label: def.label, color: def.color, description: def.description,
    })),
    meta: { total: rows.length, note: 'series-only layer; see /companies for S&P point markers' },
  };
}

function toSeries(rows) {
  return rows.map(r => ({
    date: r.date,
    sp500: r.sp500,
    vix: r.vix,
    ratio: r.ratio,
    regime: r.regime,
    regimeLabel: r.regimeLabel,
  }));
}

function toCSV(rows) {
  const lines = ['date,sp500,vix,ratio,regime,regime_label'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const r of rows) lines.push([r.date, r.sp500, r.vix, r.ratio, r.regime, r.regimeLabel].map(esc).join(','));
  return lines.join('\n') + '\n';
}

function toRenderConfig(rows) {
  return {
    type: 'series',
    series: [
      { name: 'Ratio (SP500/VIX)', color: '#44aaff', data: rows.map(r => ({ x: r.date, y: r.ratio })).filter(p => p.y != null) },
      { name: 'SP500', color: '#22c55e', data: rows.map(r => ({ x: r.date, y: r.sp500 })).filter(p => p.y != null), axis: 'y2' },
      { name: 'VIX', color: '#dc2626', data: rows.map(r => ({ x: r.date, y: r.vix })).filter(p => p.y != null), axis: 'y2' },
    ],
    regimes: Object.entries(REGIME_META).map(([key, def]) => ({ key, ...def })),
    filterable: ['since', 'until', 'regime', 'min_ratio', 'max_ratio', 'min_vix', 'max_vix', 'sort'],
    totals: { points: rows.length },
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/sp500-vix/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const extra = {
      'X-Module': 'sp500-vix-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
      'Access-Control-Allow-Origin': '*',
    };

    // ---- Не-basket эндпоинты ----

    if (sub === '/builtin') {
      const rows = BUILTIN_SERIES.map(normalizePoint);
      return sendJSON(res, 200, {
        type: 'FeatureCollection',
        features: [],
        legend: toFeatureCollection([]).legend,
        series: toSeries(rows),
        stats: computeStats(rows),
        trends: computeTrends(rows),
        meta: { source: 'builtin', count: rows.length, generated_at: new Date().toISOString() },
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

    // ---- Basket-зависимые ----

    let doc;
    try { doc = await loadData(); }
    catch (e) {
      if (e.statusCode === 503 && (sub === '/health' || sub === '/status')) {
        return sendJSON(res, 200, {
          status: 'degraded', basket_available: false, hint: e.hint,
          generated_at: new Date().toISOString(),
        }, extra);
      }
      throw e;
    }

    const { series: rawArr, source, meta: srcMeta } = extractSeries(doc);
    const all = rawArr.map(normalizePoint);

    if (sub === '/health') {
      return sendJSON(res, 200, {
        status: 'online',
        basket_available: true,
        points: all.length,
        cache_size: _cache.size,
        generated_at: new Date().toISOString(),
      }, extra);
    }

    if (sub === '/count') {
      const stats = computeStats(all);
      return sendJSON(res, 200, {
        total: stats.count,
        date_from: stats.date_from,
        date_to: stats.date_to,
        by_regime: stats.by_regime,
      }, extra);
    }

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all), source, src_meta: srcMeta }, extra);
    }
    if (sub === '/status') {
      const st = computeStats(all);
      return sendJSON(res, 200, {
        status: 'online',
        points: all.length,
        last: st.last,
        source, generated_at: new Date().toISOString(),
      }, extra);
    }
    if (sub === '/series') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, { series: toSeries(rows), count: rows.length, total: all.length }, extra);
    }
    if (sub === '/latest') {
      const last = all.slice(-1)[0] || null;
      return sendJSON(res, 200, { latest: last }, extra);
    }
    if (sub === '/recent') {
      const since = query.since || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const rows = all.filter(r => r.date && r.date >= since.slice(0, 10));
      return sendJSON(res, 200, { recent: rows, count: rows.length, since }, extra);
    }
    if (sub === '/top') {
      const n = parseInt(query.n || query.top, 10) || 10;
      const rows = all.slice().sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0)).slice(0, n);
      return sendJSON(res, 200, { top: rows, n }, extra);
    }
    if (sub === '/bottom') {
      const n = parseInt(query.n, 10) || 10;
      const rows = all.slice().sort((a, b) => (a.ratio ?? 1e9) - (b.ratio ?? 1e9)).slice(0, n);
      return sendJSON(res, 200, { bottom: rows, n }, extra);
    }
    if (sub === '/regimes') {
      const byRegime = {};
      for (const r of all) {
        if (!byRegime[r.regime]) byRegime[r.regime] = { key: r.regime, label: r.regimeLabel, color: r.regimeColor, count: 0, dates: [] };
        byRegime[r.regime].count++;
        byRegime[r.regime].dates.push(r.date);
      }
      return sendJSON(res, 200, { regimes: Object.values(byRegime), total: Object.keys(byRegime).length }, extra);
    }
    if (sub === '/current-regime') {
      const last = all.slice(-1)[0];
      if (!last) return sendJSON(res, 200, { current: null }, extra);
      return sendJSON(res, 200, {
        current: {
          date: last.date,
          regime: last.regime,
          regimeLabel: last.regimeLabel,
          regimeColor: last.regimeColor,
          ratio: last.ratio,
          vix: last.vix,
          sp500: last.sp500,
        },
      }, extra);
    }
    if (sub === '/risk-on') {
      const rows = all.filter(r => r.regime === 'risk_on');
      return sendJSON(res, 200, { risk_on: rows, count: rows.length }, extra);
    }
    if (sub === '/risk-off') {
      const rows = all.filter(r => r.regime === 'risk_off');
      return sendJSON(res, 200, { risk_off: rows, count: rows.length }, extra);
    }
    if (sub === '/panic') {
      const rows = all.filter(r => r.regime === 'panic');
      return sendJSON(res, 200, { panic: rows, count: rows.length }, extra);
    }
    if (sub === '/volatility') {
      const vol = computeVolatility(all);
      return sendJSON(res, 200, { volatility: vol }, extra);
    }
    if (sub === '/correlations') {
      const cached = cacheGet('correlations');
      if (cached) return sendJSON(res, 200, { correlations: cached, cached: true }, extra);
      const corr = computeCorrelations(all);
      cachePut('correlations', corr);
      return sendJSON(res, 200, { correlations: corr }, extra);
    }
    if (sub === '/distribution') {
      const distribution = computeDistribution(all);
      return sendJSON(res, 200, { distribution }, extra);
    }
    if (sub === '/timeline') {
      const timeline = all.map(r => ({ date: r.date, ratio: r.ratio, vix: r.vix, sp500: r.sp500, regime: r.regime }));
      return sendJSON(res, 200, { timeline, days: timeline.length }, extra);
    }
    if (sub === '/trends') {
      const trends = computeTrends(all);
      return sendJSON(res, 200, { trends }, extra);
    }
    if (sub === '/anomalies') {
      const anomalies = computeAnomalies(all);
      return sendJSON(res, 200, { anomalies, count: anomalies.length }, extra);
    }
    if (sub === '/signals') {
      const signals = computeSignals(all);
      return sendJSON(res, 200, { signals, count: signals.length }, extra);
    }
    if (sub === '/companies') {
      const companies = await loadCompanies();
      const enriched = companies.map(c => ({
        ...c,
        category_: 'finance',
        icon: meta.icon,
      }));
      return sendJSON(res, 200, { companies: enriched, count: enriched.length }, extra);
    }
    if (sub === '/compare') {
      const dates = String(query.dates || '').split(',').map(s => s.trim()).filter(Boolean);
      const results = dates.map(d => all.find(r => r.date === d)).filter(Boolean);
      return sendJSON(res, 200, { count: results.length, results }, extra);
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
      const companies = await loadCompanies();
      const features = companies
        .filter(c => Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng)))
        .map(c => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [Number(c.lng), Number(c.lat)] },
          properties: {
            name: c.name, symbol: c.symbol, price: c.price, change: c.change,
            category: 'finance', icon: meta.icon,
          },
        }));
      return sendJSON(res, 200, {
        type: 'FeatureCollection',
        features,
        legend: toFeatureCollection([]).legend,
        meta: { total: features.length },
      }, extra);
    }
    if (sub === '/render') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, { render: toRenderConfig(rows) }, extra);
    }

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, source, src_meta: srcMeta }, extra);

    const stats = computeStats(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      features: [],
      legend: toFeatureCollection([]).legend,
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_points: all.length, returned_points: rows.length,
        upstream_source: source, upstream_meta: srcMeta,
        generated_at: new Date().toISOString(),
      },
      series: toSeries(rows),
      stats,
      trends: computeTrends(rows),
      volatility: computeVolatility(rows),
      current_regime: stats.last ? {
        regime: stats.last.regime,
        regimeLabel: stats.last.regimeLabel,
        ratio: stats.last.ratio,
        vix: stats.last.vix,
      } : null,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch (e) {}
  }
}
