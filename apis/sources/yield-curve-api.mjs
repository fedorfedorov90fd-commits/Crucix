/**
 * apis/sources/yield-curve-api.mjs — API-МОДУЛЬ: КРИВАЯ ДОХОДНОСТИ (10Y-2Y SPREAD)
 *
 * Версия 3.0.1. Принят 23.09.2026.
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/yield-curve.json — v1-схема, series[{date, value, extra:{y10,y2}}],
 *           читается через basket-loader v2.0.0 (правило 14.3).
 * Сборщик: scripts/collectors/collect-yield-curve.mjs.
 *
 * Кривая доходности US Treasury — спред между 10-летними и 2-летними облигациями.
 * Инвертированная кривая (spread < 0) — исторический предвестник рецессии.
 * Нормализация после инверсии — сигнал начала рецессии в течение 6-18 месяцев.
 *
 * Точка: { date, value, extra:{y10, y2} }  (в v1-схеме)
 *       { date, spread, y10?, y2? }        (в legacy)
 *
 * Режимы (по значению spread, %):
 *   inverted     (< 0)     — инвертированная (классический сигнал рецессии)
 *   flat         (0-0.5)   — плоская (выход из инверсии, риск рецессии)
 *   normal       (0.5-1.5) — нормальная
 *   steep        (1.5-2.5) — крутая (рост экономики)
 *   very_steep   (> 2.5)   — очень крутая (агрессивное смягчение)
 *
 * Изменения v3.0.1:
 *  - Перевод с прямого fs.readFile на loadWithFallback.
 *  - extractSeries: поддержка v1-схемы (schema='crucix.basket.v1' → doc.series).
 *  - normalizePoint: spread из p.spread ?? p.value, y10/y2 из p.y10 ?? p.extra?.y10.
 *  - Диагностика source (basket-v1 | basket-legacy | fallback | corrupted | error)
 *    и shape в headers X-Basket-Source, X-Basket-Shape.
 *
 * ФОРМАТЫ: json (FC + series + stats + regimes), csv, series, stats, raw, report, text.
 * ФИЛЬТРЫ: ?since=, ?until=, ?min_value=, ?max_value=, ?regime=, ?limit=, ?top=, ?sort=.
 *
 * ОСНОВНЫЕ ПОДПУТИ:
 *   /                       — сводка (series + stats + regimes)
 *   /stats /status /health  — метрики и состояние
 *   /config /filter-presets — конфигурация и пресеты
 *   /count /series /latest  — базовые данные
 *   /recent /top /bottom    — свежие и топы
 *   /regimes /current-regime — режимы
 *   /inverted /flat /normal /steep /very-steep — по режимам
 *   /inversion-history      — все периоды инверсии
 *   /recession-signal       — сигнал рецессии
 *   /volatility /vol        — волатильность
 *   /distribution           — распределение
 *   /timeline /trends       — динамика
 *   /anomalies /signals     — аномалии и сигналы
 *   /correlations           — автокорреляции
 *   /compare?dates=a,b,c    — сравнение
 *   /search /export         — поиск и отчёт
 *   /featurecollection /render — GeoJSON и рендер
 *   /builtin                — встроенный fallback (30 точек)
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadWithFallback } from './lib/basket-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'yield-curve.json');
const COLLECTOR_HINT = 'run scripts/collectors/collect-yield-curve.mjs';

export const route  = '/api/layers/yield-curve';
export const method = 'GET';

export const meta = {
  category: 'finance',
  icon: '📈',
  color: '#ff44ff',
  vizType: 'series',
  source: 'basket/yield-curve.json',
  collector: 'collect-yield-curve.mjs',
  cache: 300,
  description: 'Кривая доходности US Treasury (10Y-2Y): инверсия, нормализация, сигнал рецессии',
  unit: 'percent',
};

// ============================================================
//  РЕЖИМЫ ПО ЗНАЧЕНИЮ СПРЕДА (10Y-2Y)
// ============================================================

const REGIME_META = {
  inverted:   { min: -Infinity, max: 0,   color: '#dc2626', label: 'Инвертированная', severity: 4, description: 'Классический сигнал рецессии (спред < 0)' },
  flat:       { min: 0,         max: 0.5, color: '#f97316', label: 'Плоская',         severity: 3, description: 'Выход из инверсии — риск рецессии 6-18 мес' },
  normal:     { min: 0.5,       max: 1.5, color: '#22c55e', label: 'Нормальная',      severity: 1, description: 'Здоровая кривая' },
  steep:      { min: 1.5,       max: 2.5, color: '#84cc16', label: 'Крутая',          severity: 1, description: 'Рост экономики, ожидания роста' },
  very_steep: { min: 2.5,       max: Infinity, color: '#0ea5e9', label: 'Очень крутая', severity: 2, description: 'Агрессивное смягчение ДКП' },
  unknown:    { min: -1,        max: -2,  color: '#64748b', label: 'Неизвестно',      severity: 0, description: 'Нет данных' },
};

function regimeOf(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return { key: 'unknown', ...REGIME_META.unknown };
  if (n < 0)   return { key: 'inverted', ...REGIME_META.inverted };
  if (n < 0.5) return { key: 'flat',     ...REGIME_META.flat };
  if (n < 1.5) return { key: 'normal',   ...REGIME_META.normal };
  if (n < 2.5) return { key: 'steep',    ...REGIME_META.steep };
  return { key: 'very_steep', ...REGIME_META.very_steep };
}

const SIZE_BUCKETS = [
  { min: -Infinity, max: 0,   label: '< 0 (inverted)', color: '#dc2626' },
  { min: 0,         max: 0.5, label: '0-0.5 (flat)',   color: '#f97316' },
  { min: 0.5,       max: 1.5, label: '0.5-1.5 (normal)', color: '#22c55e' },
  { min: 1.5,       max: 2.5, label: '1.5-2.5 (steep)', color: '#84cc16' },
  { min: 2.5,       max: Infinity, label: '> 2.5 (very steep)', color: '#0ea5e9' },
];

const FILTER_PRESETS = [
  { id: 'all',       label: 'Весь ряд',              params: {} },
  { id: 'latest',    label: 'Последние 30',          params: { sort: 'date-desc', limit: 30 } },
  { id: 'inverted',  label: 'Инвертированная',       params: { regime: 'inverted' } },
  { id: 'flat',      label: 'Плоская (0-0.5)',       params: { regime: 'flat' } },
  { id: 'normal',    label: 'Нормальная (0.5-1.5)',  params: { regime: 'normal' } },
  { id: 'steep',     label: 'Крутая (>1.5)',         params: { regime: 'steep' } },
  { id: 'recent',    label: 'Последние 30 дней',     params: { since: '30d' } },
];

// ============================================================
//  FALLBACK (30 точек)
// ============================================================

const BUILTIN_SERIES = [
  { date: '2026-07-15', spread: 0.42 }, { date: '2026-07-16', spread: 0.41 },
  { date: '2026-07-17', spread: 0.37 }, { date: '2026-07-20', spread: 0.39 },
  { date: '2026-07-21', spread: 0.37 }, { date: '2026-07-22', spread: 0.36 },
  { date: '2026-07-23', spread: 0.34 }, { date: '2026-07-24', spread: 0.36 },
  { date: '2026-07-27', spread: 0.34 }, { date: '2026-07-28', spread: 0.35 },
  { date: '2026-07-29', spread: 0.45 }, { date: '2026-07-30', spread: 0.45 },
  { date: '2026-07-31', spread: 0.47 }, { date: '2026-08-03', spread: 0.45 },
  { date: '2026-08-04', spread: 0.43 }, { date: '2026-08-05', spread: 0.41 },
  { date: '2026-08-06', spread: 0.39 }, { date: '2026-08-07', spread: 0.38 },
  { date: '2026-08-10', spread: 0.36 }, { date: '2026-08-11', spread: 0.34 },
  { date: '2026-08-12', spread: 0.32 }, { date: '2026-08-13', spread: 0.30 },
  { date: '2026-08-14', spread: 0.28 }, { date: '2026-08-17', spread: 0.27 },
  { date: '2026-08-18', spread: 0.25 }, { date: '2026-08-19', spread: 0.24 },
  { date: '2026-08-20', spread: 0.22 }, { date: '2026-08-21', spread: 0.20 },
  { date: '2026-08-24', spread: 0.18 }, { date: '2026-08-25', spread: 0.15 },
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
//  УТИЛИТЫ
// ============================================================

function parseSince(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (s.endsWith('d')) {
    const n = parseInt(s, 10);
    if (Number.isFinite(n)) return Date.now() - n * 86400000;
  }
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}

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
 * Извлечение серии из документа.
 * Поддерживает v1-схему (schema='crucix.basket.v1' → doc.series),
 * legacy-формы (array/data/series/items).
 */
function extractSeries(doc) {
  if (Array.isArray(doc)) return { series: doc, source: null, meta: null, shape: 'array' };
  if (!doc || typeof doc !== 'object') return { series: [], source: null, meta: null, shape: 'unknown' };

  // v1-схема: series — временной ряд
  if (doc.schema === 'crucix.basket.v1') {
    if (Array.isArray(doc.series) && doc.series.length > 0) return { series: doc.series, source: doc.meta?.source || null, meta: doc.meta || null, shape: 'v1.series' };
    if (Array.isArray(doc.points) && doc.points.length > 0) return { series: doc.points, source: doc.meta?.source || null, meta: doc.meta || null, shape: 'v1.points' };
    if (Array.isArray(doc.regions) && doc.regions.length > 0) return { series: doc.regions, source: doc.meta?.source || null, meta: doc.meta || null, shape: 'v1.regions' };
    return { series: [], source: doc.meta?.source || null, meta: doc.meta || null, shape: 'v1.empty' };
  }

  // Legacy
  if (Array.isArray(doc.data))   return { series: doc.data,   source: doc.source || null, meta: doc.meta || null, shape: 'data' };
  if (Array.isArray(doc.series)) return { series: doc.series, source: doc.source || null, meta: doc.meta || null, shape: 'series' };
  if (Array.isArray(doc.items))  return { series: doc.items,  source: doc.source || null, meta: doc.meta || null, shape: 'items' };
  return { series: [], source: null, meta: null, shape: 'unknown' };
}

// ============================================================
//  НОРМАЛИЗАЦИЯ
// ============================================================

/**
 * Нормализация точки.
 * В v1-схеме поле spread называется value, а y10/y2 лежат в extra.
 * Поддерживаем оба варианта.
 */
function normalizePoint(p, i) {
  const date = String(p.date || p.timestamp || '').slice(0, 10) || null;
  const spread = Number(p.spread ?? p.value ?? p.diff);
  const y10 = Number(p.y10 ?? p.ten_year ?? p.extra?.y10);
  const y2 = Number(p.y2 ?? p.two_year ?? p.extra?.y2);
  const regime = regimeOf(spread);

  return {
    date,
    spread: Number.isFinite(spread) ? Number(spread.toFixed(3)) : null,
    y10: Number.isFinite(y10) ? Number(y10.toFixed(3)) : null,
    y2: Number.isFinite(y2) ? Number(y2.toFixed(3)) : null,
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
  if (query.since) {
    const t = parseSince(query.since);
    if (t) {
      const sinceDate = new Date(t).toISOString().slice(0, 10);
      r = r.filter(x => !x.date || x.date >= sinceDate);
    } else {
      r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
    }
  }
  if (query.until) r = r.filter(x => !x.date || x.date <= String(query.until).slice(0, 10));
  if (query.min_value != null) { const n = Number(query.min_value); if (Number.isFinite(n)) r = r.filter(x => x.spread != null && x.spread >= n); }
  if (query.max_value != null) { const n = Number(query.max_value); if (Number.isFinite(n)) r = r.filter(x => x.spread != null && x.spread <= n); }

  const sortKey = query.sort || 'date-asc';
  if (sortKey === 'date-asc')         r.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  else if (sortKey === 'date-desc')   r.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  else if (sortKey === 'spread-desc') r.sort((a, b) => (b.spread ?? -1e9) - (a.spread ?? -1e9));
  else if (sortKey === 'spread-asc')  r.sort((a, b) => (a.spread ?? 1e9) - (b.spread ?? 1e9));
  else if (sortKey === 'severity')    r.sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0));

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(-n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(rows) {
  const byRegime = { inverted: 0, flat: 0, normal: 0, steep: 0, very_steep: 0, unknown: 0 };
  const spreads = [];
  for (const r of rows) {
    byRegime[r.regime] = (byRegime[r.regime] || 0) + 1;
    if (r.spread != null) spreads.push(r.spread);
  }
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  if (!spreads.length) return { count: rows.length, by_regime: byRegime };

  const sorted = [...spreads].sort((a, b) => a - b);
  const mean = spreads.reduce((a, b) => a + b, 0) / spreads.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const variance = spreads.reduce((a, v) => a + (v - mean) ** 2, 0) / spreads.length;
  const last = rows.slice(-1)[0] || null;
  const first = rows[0] || null;
  const changeAbs = (last && first && last.spread != null && first.spread != null)
    ? Number((last.spread - first.spread).toFixed(3)) : null;
  const changePct = (last && first && first.spread !== 0)
    ? Number(((last.spread - first.spread) / Math.abs(first.spread) * 100).toFixed(2)) : null;

  return {
    count: rows.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    spread: {
      min: Number(Math.min(...spreads).toFixed(3)),
      max: Number(Math.max(...spreads).toFixed(3)),
      mean: Number(mean.toFixed(3)),
      median: Number(median.toFixed(3)),
      stddev: Number(Math.sqrt(variance).toFixed(3)),
    },
    by_regime: byRegime,
    last_spread: last?.spread ?? null,
    last_date: last?.date ?? null,
    last_regime: last?.regime ?? null,
    last_regimeLabel: last?.regimeLabel ?? null,
    first_spread: first?.spread ?? null,
    change_abs: changeAbs,
    change_pct: changePct,
  };
}

function computeDistribution(rows) {
  return SIZE_BUCKETS.map(b => {
    const items = rows.filter(r => r.spread != null && r.spread >= b.min && r.spread < b.max);
    return { label: b.label, range: [b.min === -Infinity ? '-inf' : b.min, b.max === Infinity ? 'inf' : b.max], color: b.color, count: items.length, dates: items.map(x => x.date) };
  }).filter(b => b.count > 0);
}

function computeTrends(rows) {
  const tail = rows.slice(-7);
  const prev = rows.slice(-14, -7);
  if (!tail.length || !prev.length) return null;
  const m = a => a.reduce((s, r) => s + (r.spread ?? 0), 0) / a.length;
  const mNew = m(tail), mOld = m(prev);
  const delta = mOld === 0 ? null : ((mNew - mOld) / Math.abs(mOld) * 100);
  return {
    last7_mean: Number(mNew.toFixed(3)),
    prev7_mean: Number(mOld.toFixed(3)),
    delta_pct: delta != null ? Number(delta.toFixed(2)) : null,
    direction: delta == null ? 'unknown' : (delta > 5 ? 'steepening' : (delta < -5 ? 'flattening' : 'stable')),
  };
}

function computeVolatility(rows) {
  const values = rows.map(r => r.spread).filter(Number.isFinite);
  if (values.length < 3) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  return {
    window: values.length,
    mean: Number(mean.toFixed(3)),
    stddev: Number(stddev.toFixed(3)),
    coefficient_pct: mean !== 0 ? Number((stddev / Math.abs(mean) * 100).toFixed(2)) : null,
    min: Number(Math.min(...values).toFixed(3)),
    max: Number(Math.max(...values).toFixed(3)),
  };
}

function computeAnomalies(rows) {
  const values = rows.map(r => r.spread).filter(Number.isFinite);
  if (values.length < 3) return [];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  const threshold = 2 * stddev;
  return rows
    .filter(r => r.spread != null && Math.abs(r.spread - mean) > threshold)
    .map(r => ({
      date: r.date,
      spread: r.spread,
      z_score: Number(((r.spread - mean) / (stddev || 1)).toFixed(2)),
      deviation: Number((r.spread - mean).toFixed(3)),
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
    if (prev.spread == null || cur.spread == null) { prev = cur; continue; }
    const delta = cur.spread - prev.spread;
    let signal = 'hold';
    if (prev.regime === 'inverted' && cur.regime !== 'inverted') signal = 'recession-approaching';
    else if (prev.regime !== 'inverted' && cur.regime === 'inverted') signal = 'inversion-start';
    else if (delta > 0.05) signal = 'steepening';
    else if (delta < -0.05) signal = 'flattening';
    signals.push({
      date: cur.date,
      from: prev.spread, to: cur.spread,
      delta: Number(delta.toFixed(3)),
      signal,
      regime: cur.regime,
    });
    prev = cur;
  }
  return signals;
}

function computeInversionHistory(rows) {
  const periods = [];
  let current = null;
  for (const r of rows) {
    if (r.spread == null) continue;
    if (r.spread < 0) {
      if (!current) current = { start: r.date, end: null, min_spread: r.spread, days: 1 };
      else { current.end = r.date; current.days++; if (r.spread < current.min_spread) current.min_spread = r.spread; }
    } else if (current) {
      periods.push({ ...current, end: current.end || r.date });
      current = null;
    }
  }
  if (current) periods.push({ ...current, end: null, ongoing: true });
  return periods;
}

function computeCorrelations(rows) {
  const values = rows.map(r => r.spread).filter(Number.isFinite);
  if (values.length < 5) return null;
  const corr = (lag) => {
    const x = values.slice(0, -lag);
    const y = values.slice(lag);
    const mx = x.reduce((a, b) => a + b, 0) / x.length;
    const my = y.reduce((a, b) => a + b, 0) / y.length;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < x.length; i++) {
      const dxi = x[i] - mx, dyi = y[i] - my;
      num += dxi * dyi; dx += dxi * dxi; dy += dyi * dyi;
    }
    const den = Math.sqrt(dx * dy);
    return den === 0 ? 0 : Number((num / den).toFixed(3));
  };
  return { lag1: corr(1), lag2: corr(2), lag3: corr(3), samples: values.length };
}

function computeRecessionSignal(rows) {
  const inversionPeriods = computeInversionHistory(rows);
  const now = new Date();
  if (inversionPeriods.length === 0) {
    return { active: false, reason: 'no_inversion_in_period', periods: 0 };
  }
  const lastPeriod = inversionPeriods[inversionPeriods.length - 1];
  if (lastPeriod.ongoing) {
    return { active: false, reason: 'inversion_ongoing', note: 'Инверсия сейчас — сигнал ещё не активирован', period: lastPeriod };
  }
  const endDate = new Date(lastPeriod.end);
  const monthsSince = (now - endDate) / (30.44 * 86400000);
  if (monthsSince >= 6 && monthsSince <= 18) {
    return {
      active: true,
      reason: 'post_inversion_window',
      months_since_end: Number(monthsSince.toFixed(1)),
      note: '6-18 месяцев после окончания инверсии — исторически окно рецессии',
      period: lastPeriod,
    };
  }
  return {
    active: false,
    reason: 'outside_window',
    months_since_end: Number(monthsSince.toFixed(1)),
    period: lastPeriod,
  };
}

function toReport(rows, stats, inversionPeriods, recessionSignal) {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push('  YIELD CURVE REPORT — Crucix');
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Точек: ${stats.count}`);
  lines.push(`Период: ${stats.date_from} → ${stats.date_to}`);
  lines.push('');
  lines.push('РЕЖИМЫ:');
  for (const [k, v] of Object.entries(stats.by_regime)) lines.push(`  ${k.padEnd(12)} ${v}`);
  lines.push('');
  if (stats.spread) lines.push(`SPREAD — min: ${stats.spread.min}  max: ${stats.spread.max}  mean: ${stats.spread.mean}  stddev: ${stats.spread.stddev}`);
  lines.push('');
  if (stats.last_spread != null) {
    lines.push(`ПОСЛЕДНЕЕ (${stats.last_date}): ${stats.last_spread} — режим: ${stats.last_regimeLabel}`);
  }
  lines.push('');
  lines.push(`ПЕРИОДОВ ИНВЕРСИИ: ${inversionPeriods.length}`);
  for (const p of inversionPeriods.slice(-5)) {
    lines.push(`  ${p.start} → ${p.end || 'ongoing'}  (${p.days} дн, min ${p.min_spread})`);
  }
  lines.push('');
  lines.push(`СИГНАЛ РЕЦЕССИИ: ${recessionSignal.active ? 'АКТИВЕН' : 'не активен'} (${recessionSignal.reason})`);
  if (recessionSignal.note) lines.push(`  ${recessionSignal.note}`);
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
      key, label: def.label, color: def.color, range: [def.min === -Infinity ? '-inf' : def.min, def.max === Infinity ? 'inf' : def.max],
    })),
    meta: { total: rows.length, note: 'yield-curve — series-only (спред 10Y-2Y, без координат)' },
  };
}

function toSeries(rows) {
  return rows.map(r => ({
    date: r.date, spread: r.spread,
    y10: r.y10, y2: r.y2,
    regime: r.regime, regimeLabel: r.regimeLabel,
  }));
}

function toCSV(rows) {
  const lines = ['date,spread,y10,y2,regime,regime_label'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const r of rows) lines.push([r.date, r.spread, r.y10, r.y2, r.regime, r.regimeLabel].map(esc).join(','));
  return lines.join('\n') + '\n';
}

function toRenderConfig(rows) {
  const series = rows.map(r => ({ x: r.date, y: r.spread })).filter(p => p.y != null);
  const coloredPoints = rows.map(r => ({ x: r.date, y: r.spread, color: r.regimeColor, regime: r.regime })).filter(p => p.y != null);
  return {
    type: 'series',
    series: [{ name: '10Y-2Y Spread', color: '#ff44ff', data: series }],
    coloredPoints,
    regimes: Object.entries(REGIME_META).map(([key, def]) => ({
      key, label: def.label, color: def.color, range: [def.min === -Infinity ? '-inf' : def.min, def.max === Infinity ? 'inf' : def.max],
    })),
    zeroLine: 0,
    filterable: ['since', 'until', 'regime', 'min_value', 'max_value', 'sort'],
    totals: { points: series.length },
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/yield-curve/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const extra = {
      'X-Module': 'yield-curve-api',
      'X-Module-Version': '3.0.1',
      'Cache-Control': `public, max-age=${meta.cache}`,
      'Access-Control-Allow-Origin': '*',
    };

    if (sub === '/builtin') {
      const rows = BUILTIN_SERIES.map(normalizePoint);
      const inversionPeriods = computeInversionHistory(rows);
      return sendJSON(res, 200, {
        type: 'FeatureCollection',
        features: [],
        legend: toFeatureCollection([]).legend,
        series: toSeries(rows),
        stats: computeStats(rows),
        trends: computeTrends(rows),
        inversion_history: inversionPeriods,
        recession_signal: computeRecessionSignal(rows),
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

    const { series: rawArr, source, meta: srcMeta } = extractSeries(doc);
    const all = rawArr.map(normalizePoint);

    if (sub === '/health') {
      return sendJSON(res, 200, {
        status: 'online', basket_available: true, points: all.length,
        basket_source: basketSource, basket_shape: basketShape, basket_mtime: basketMtime,
        cache_size: _cache.size, generated_at: new Date().toISOString(),
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
      return sendJSON(res, 200, { stats: computeStats(all), source, src_meta: srcMeta, basket_source: basketSource, basket_shape: basketShape }, extra);
    }
    if (sub === '/status') {
      const st = computeStats(all);
      return sendJSON(res, 200, {
        status: 'online', points: all.length,
        last_spread: st.last_spread, last_regime: st.last_regime,
        source, basket_source: basketSource, basket_shape: basketShape,
        generated_at: new Date().toISOString(),
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
      const since = query.since || '30d';
      const t = parseSince(since);
      const sinceDate = t ? new Date(t).toISOString().slice(0, 10) : String(since).slice(0, 10);
      const rows = all.filter(r => r.date && r.date >= sinceDate);
      return sendJSON(res, 200, { recent: rows, count: rows.length, since: sinceDate }, extra);
    }
    if (sub === '/top') {
      const n = parseInt(query.n || query.top, 10) || 10;
      const rows = all.slice().sort((a, b) => (b.spread ?? -1) - (a.spread ?? -1)).slice(0, n);
      return sendJSON(res, 200, { top: rows, n }, extra);
    }
    if (sub === '/bottom') {
      const n = parseInt(query.n, 10) || 10;
      const rows = all.slice().sort((a, b) => (a.spread ?? 1e9) - (b.spread ?? 1e9)).slice(0, n);
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
          date: last.date, spread: last.spread,
          regime: last.regime, regimeLabel: last.regimeLabel, regimeColor: last.regimeColor,
        },
      }, extra);
    }
    if (sub === '/inverted' || sub === '/flat' || sub === '/normal' || sub === '/steep' || sub === '/very-steep') {
      const regime = sub === '/very-steep' ? 'very_steep' : sub.slice(1);
      const rows = all.filter(r => r.regime === regime);
      return sendJSON(res, 200, { [regime]: rows, count: rows.length }, extra);
    }
    if (sub === '/inversion-history') {
      const periods = computeInversionHistory(all);
      return sendJSON(res, 200, { periods, count: periods.length }, extra);
    }
    if (sub === '/recession-signal') {
      const cached = cacheGet('recession-signal');
      if (cached) return sendJSON(res, 200, { recession_signal: cached, cached: true }, extra);
      const signal = computeRecessionSignal(all);
      cachePut('recession-signal', signal);
      return sendJSON(res, 200, { recession_signal: signal }, extra);
    }
    if (sub === '/volatility' || sub === '/vol') {
      const vol = computeVolatility(all);
      return sendJSON(res, 200, { volatility: vol }, extra);
    }
    if (sub === '/distribution') {
      const distribution = computeDistribution(all);
      return sendJSON(res, 200, { distribution }, extra);
    }
    if (sub === '/timeline') {
      const timeline = all.map(r => ({ date: r.date, spread: r.spread, regime: r.regime }));
      return sendJSON(res, 200, { timeline, days: timeline.length }, extra);
    }
    if (sub === '/trends') {
      return sendJSON(res, 200, { trends: computeTrends(all) }, extra);
    }
    if (sub === '/anomalies') {
      const anomalies = computeAnomalies(all);
      return sendJSON(res, 200, { anomalies, count: anomalies.length }, extra);
    }
    if (sub === '/signals') {
      const signals = computeSignals(all);
      return sendJSON(res, 200, { signals, count: signals.length }, extra);
    }
    if (sub === '/correlations') {
      const cached = cacheGet('correlations');
      if (cached) return sendJSON(res, 200, { correlations: cached, cached: true }, extra);
      const corr = computeCorrelations(all);
      cachePut('correlations', corr);
      return sendJSON(res, 200, { correlations: corr }, extra);
    }
    if (sub === '/compare') {
      const dates = String(query.dates || '').split(',').map(s => s.trim()).filter(Boolean);
      const results = dates.map(d => all.find(r => r.date === d)).filter(Boolean);
      return sendJSON(res, 200, { count: results.length, results }, extra);
    }
    if (sub === '/search') {
      const q = String(query.q || '').toLowerCase();
      if (!q) return sendJSON(res, 400, { error: 'field_required: q' }, extra);
      const rows = all.filter(r => (String(r.date || '') + ' ' + String(r.spread ?? '')).toLowerCase().includes(q));
      return sendJSON(res, 200, { query: q, results: rows, count: rows.length }, extra);
    }
    if (sub === '/export' || format === 'report') {
      const stats = computeStats(all);
      const invPeriods = computeInversionHistory(all);
      const recSig = computeRecessionSignal(all);
      const report = toReport(all, stats, invPeriods, recSig);
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
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, source, src_meta: srcMeta, basket_source: basketSource, basket_shape: basketShape }, extra);

    const stats = computeStats(rows);
    const inversionPeriods = computeInversionHistory(rows);
    const recessionSignal = computeRecessionSignal(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      features: [],
      legend: toFeatureCollection([]).legend,
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_points: all.length, returned_points: rows.length,
        upstream_source: source, upstream_meta: srcMeta,
        basket_source: basketSource, basket_shape: basketShape, basket_mtime: basketMtime,
        generated_at: new Date().toISOString(),
      },
      series: toSeries(rows),
      stats,
      trends: computeTrends(rows),
      volatility: computeVolatility(rows),
      inversion_history: inversionPeriods,
      recession_signal: recessionSignal,
      current_regime: stats.last_spread != null ? {
        regime: stats.last_regime,
        regimeLabel: stats.last_regimeLabel,
        spread: stats.last_spread,
        date: stats.last_date,
      } : null,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch (e2) {}
  }
}
