/**
 * apis/sources/vxx-api.mjs — API-МОДУЛЬ: VXX (ВОЛАТИЛЬНОСТЬ, VIX SHORT-TERM FUTURES)
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/vxx.json — [{ date, value }] ИЛИ [{ date, close }] ИЛИ { data:[...] } ИЛИ { series:[...] }.
 * ДОПОЛНИТЕЛЬНО: data/basket/vix.json — [{ date, close, country, lat, lng }] для сравнения VXX vs VIX.
 * Сборщик: scripts/collectors/collect-vxx.mjs.
 *
 * VXX (iPath Series B S&P 500 VIX Short-Term Futures ETN) — биржевой инструмент,
 * отслеживающий краткосрочные фьючерсы на VIX. Растёт, когда растёт волатильность.
 * Теряет в цене на контанго (типичный decay ~5-10% в месяц).
 *
 * Точка ряда:
 *   { date, value | close }
 *
 * Режимы волатильности:
 *   calm      (< 20)
 *   normal    (20-30)
 *   elevated  (30-45)
 *   stress    (45-60)
 *   panic     (> 60)
 *
 * ФОРМАТЫ: json (FC + series + stats + regimes), csv, series, stats, raw, report.
 * ФИЛЬТРЫ: ?since=, ?until=, ?min_value=, ?max_value=, ?regime=, ?limit=, ?top=, ?sort=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /                       — сводка (series + stats + regime + VIX-сравнение)
 *   GET /stats                  — агрегированная статистика
 *   GET /status                 — health-check
 *   GET /health                 — расширенный health
 *   GET /config                 — конфигурация (пороги режимов, цвета)
 *   GET /count                  — только числа
 *   GET /series                 — временной ряд
 *   GET /latest                 — последнее значение
 *   GET /recent?since=          — свежие точки
 *   GET /top?n=N                — топ по value
 *   GET /bottom?n=N             — антитоп по value
 *   GET /regimes                — группировка по режимам
 *   GET /current-regime         — текущий режим
 *   GET /calm                   — точки calm
 *   GET /stress                 — точки stress + panic
 *   GET /volatility             — волатильность самого VXX
 *   GET /decay                  — decay (roll-cost / contango effect)
 *   GET /contango               — индикатор контанго (VXX vs VIX)
 *   GET /backwardation          — индикатор бэквордации
 *   GET /vix-comparison         — сравнение VXX и VIX (side-by-side)
 *   GET /distribution           — распределение value по бакетам
 *   GET /timeline               — динамика по дням
 *   GET /trends                 — тренды (7 vs 7)
 *   GET /anomalies              — аномалии
 *   GET /signals                — торговые сигналы
 *   GET /compare?dates=a,b,c    — сравнение точек
 *   GET /filter-presets         — готовые фильтры
 *   GET /export                 — текстовый отчёт
 *   GET /reset-cache            — сброс кэша
 *   GET /featurecollection      — GeoJSON (VIX-точки из basket/vix.json)
 *   GET /render                 — рендер-конфиг
 *   GET /builtin                — встроенный fallback (25 точек)
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'vxx.json');
const VIX_FILE     = join(PROJECT_ROOT, 'data', 'basket', 'vix.json');

export const route  = '/api/layers/vxx';
export const method = 'GET';

export const meta = {
  category: 'finance',
  icon: '📉',
  color: '#ff44aa',
  vizType: 'series',
  source: 'basket/vxx.json',
  collector: 'collect-vxx.mjs',
  cache: 300,
  description: 'VXX — волатильность (VIX Short-Term Futures ETN): режимы, контанго, decay',
  unit: 'points',
};

// ============================================================
//  РЕЖИМЫ ВОЛАТИЛЬНОСТИ
// ============================================================

const REGIME_META = {
  calm:     { min: 0,  max: 20,  color: '#22c55e', label: 'Спокойствие',     severity: 1, description: 'Низкая волатильность, риск-он' },
  normal:   { min: 20, max: 30,  color: '#84cc16', label: 'Норма',           severity: 2, description: 'Обычный уровень' },
  elevated: { min: 30, max: 45,  color: '#eab308', label: 'Повышенная',      severity: 3, description: 'Рост напряжения' },
  stress:   { min: 45, max: 60,  color: '#f97316', label: 'Стресс',          severity: 4, description: 'Высокая волатильность' },
  panic:    { min: 60, max: Infinity, color: '#dc2626', label: 'Паника',     severity: 5, description: 'Экстремальная волатильность' },
  unknown:  { min: -1, max: -1,  color: '#64748b', label: 'Неизвестно',      severity: 0, description: 'Нет данных' },
};

function regimeOf(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return { key: 'unknown', ...REGIME_META.unknown };
  for (const [k, def] of Object.entries(REGIME_META)) {
    if (k === 'unknown') continue;
    if (n >= def.min && n < def.max) return { key: k, ...def };
  }
  return { key: 'panic', ...REGIME_META.panic };
}

const SIZE_BUCKETS = [
  { min: 0,  max: 20, label: '< 20 (calm)',      color: '#22c55e' },
  { min: 20, max: 30, label: '20-30 (normal)',   color: '#84cc16' },
  { min: 30, max: 45, label: '30-45 (elevated)', color: '#eab308' },
  { min: 45, max: 60, label: '45-60 (stress)',   color: '#f97316' },
  { min: 60, max: Infinity, label: '> 60 (panic)', color: '#dc2626' },
];

const FILTER_PRESETS = [
  { id: 'all',       label: 'Весь ряд',                params: {} },
  { id: 'latest',    label: 'Последние 30',            params: { sort: 'date-desc', limit: 30 } },
  { id: 'calm',      label: 'Спокойствие (< 20)',      params: { regime: 'calm' } },
  { id: 'normal',    label: 'Норма (20-30)',           params: { regime: 'normal' } },
  { id: 'stress',    label: 'Стресс (45-60)',          params: { regime: 'stress' } },
  { id: 'panic',     label: 'Паника (> 60)',           params: { regime: 'panic' } },
  { id: 'high',      label: 'Значение > 40',           params: { min_value: 40 } },
];

// ============================================================
//  FALLBACK (25 точек)
// ============================================================

const BUILTIN_SERIES = [
  { date: '2026-07-22', value: 25.5 }, { date: '2026-07-23', value: 26.2 },
  { date: '2026-07-24', value: 27.1 }, { date: '2026-07-25', value: 26.8 },
  { date: '2026-07-26', value: 28.3 }, { date: '2026-07-27', value: 29.7 },
  { date: '2026-07-28', value: 30.5 }, { date: '2026-07-29', value: 31.1 },
  { date: '2026-07-30', value: 32.8 }, { date: '2026-07-31', value: 33.3 },
  { date: '2026-08-01', value: 34.1 }, { date: '2026-08-02', value: 35.5 },
  { date: '2026-08-03', value: 36.2 }, { date: '2026-08-04', value: 37.1 },
  { date: '2026-08-05', value: 38.4 }, { date: '2026-08-06', value: 39.2 },
  { date: '2026-08-07', value: 40.0 }, { date: '2026-08-08', value: 40.5 },
  { date: '2026-08-09', value: 41.1 }, { date: '2026-08-10', value: 41.8 },
  { date: '2026-08-11', value: 42.2 }, { date: '2026-08-12', value: 41.9 },
  { date: '2026-08-13', value: 41.5 }, { date: '2026-08-14', value: 40.8 },
  { date: '2026-08-15', value: 39.5 },
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
      err.hint = 'run scripts/collectors/collect-vxx.mjs';
      throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  return parsed;
}

async function loadVix() {
  try {
    const raw = await fs.readFile(VIX_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.data)) return parsed.data;
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
  const value = Number(p.value ?? p.close ?? p.v ?? p.price);
  const regime = regimeOf(value);

  return {
    date,
    value: Number.isFinite(value) ? Number(value.toFixed(2)) : null,
    regime: regime.key,
    regimeLabel: regime.label,
    regimeColor: regime.color,
    severity: regime.severity,
    category_: 'finance',
    icon: meta.icon,
  };
}

function normalizeVix(v, i) {
  return {
    date: String(v.date || '').slice(0, 10) || null,
    close: Number(v.close ?? v.value),
    country: v.country || null,
    lat: Number(v.lat ?? v.latitude),
    lng: Number(v.lng ?? v.lon ?? v.longitude),
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
  if (query.min_value != null) { const n = Number(query.min_value); if (Number.isFinite(n)) r = r.filter(x => x.value != null && x.value >= n); }
  if (query.max_value != null) { const n = Number(query.max_value); if (Number.isFinite(n)) r = r.filter(x => x.value != null && x.value <= n); }

  const sortKey = query.sort || 'date-asc';
  if (sortKey === 'date-asc')       r.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  else if (sortKey === 'date-desc') r.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  else if (sortKey === 'value-desc') r.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  else if (sortKey === 'value-asc')  r.sort((a, b) => (a.value ?? 1e9) - (b.value ?? 1e9));

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(-n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(rows) {
  const byRegime = { calm: 0, normal: 0, elevated: 0, stress: 0, panic: 0, unknown: 0 };
  const values = [];
  for (const r of rows) {
    byRegime[r.regime] = (byRegime[r.regime] || 0) + 1;
    if (r.value != null) values.push(r.value);
  }
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  if (!values.length) return { count: rows.length, by_regime: byRegime };

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  const last = rows.slice(-1)[0] || null;
  const first = rows[0] || null;
  const changeAbs = (last && first && last.value != null && first.value != null)
    ? Number((last.value - first.value).toFixed(2)) : null;
  const changePct = (last && first && last.value != null && first.value !== 0)
    ? Number(((last.value - first.value) / first.value * 100).toFixed(2)) : null;

  return {
    count: rows.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    value: {
      min: Number(Math.min(...values).toFixed(2)),
      max: Number(Math.max(...values).toFixed(2)),
      mean: Number(mean.toFixed(2)),
      median: Number(median.toFixed(2)),
      stddev: Number(stddev.toFixed(2)),
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

function computeDistribution(rows) {
  return SIZE_BUCKETS.map(b => {
    const items = rows.filter(r => r.value != null && r.value >= b.min && r.value < b.max);
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
  const m = a => a.reduce((s, r) => s + (r.value ?? 0), 0) / a.length;
  const mNew = m(tail), mOld = m(prev);
  const delta = mOld === 0 ? null : ((mNew - mOld) / mOld * 100);
  return {
    last7_mean: Number(mNew.toFixed(2)),
    prev7_mean: Number(mOld.toFixed(2)),
    delta_pct: delta != null ? Number(delta.toFixed(2)) : null,
    direction: delta == null ? 'unknown' : (delta > 2 ? 'rising' : (delta < -2 ? 'falling' : 'flat')),
  };
}

function computeVolatility(rows) {
  const values = rows.map(r => r.value).filter(Number.isFinite);
  if (values.length < 3) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  return {
    window: values.length,
    mean: Number(mean.toFixed(2)),
    stddev: Number(stddev.toFixed(2)),
    coefficient_pct: mean ? Number((stddev / mean * 100).toFixed(2)) : null,
    min: Number(Math.min(...values).toFixed(2)),
    max: Number(Math.max(...values).toFixed(2)),
  };
}

function computeDecay(rows) {
  // Decay (roll cost) — насколько VXX потерял бы за период, если бы VIX-фьючерсы были в контанго.
  // Приближение: если VXX падает при flat/rising VIX → decay.
  if (rows.length < 2) return null;
  const first = rows[0], last = rows[rows.length - 1];
  if (first.value == null || last.value == null) return null;
  const days = Math.max(1, Math.round((new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000));
  const totalChange = last.value - first.value;
  const monthlyDecay = (totalChange / days) * 30;
  return {
    period_days: days,
    start_value: first.value,
    end_value: last.value,
    total_change: Number(totalChange.toFixed(2)),
    total_change_pct: first.value ? Number((totalChange / first.value * 100).toFixed(2)) : null,
    monthly_decay_est: Number(monthlyDecay.toFixed(2)),
    note: 'Оценка месячного decay (roll cost) на основе тренда',
  };
}

async function computeVixComparison(vxxRows) {
  const vixRows = await loadVix();
  if (!vixRows.length || !vxxRows.length) return null;
  const vixNorm = vixRows.map(normalizeVix).filter(r => r.date && Number.isFinite(r.close));
  const vxxByDate = {};
  for (const r of vxxRows) if (r.date) vxxByDate[r.date] = r.value;
  const pairs = vixNorm.map(v => ({
    date: v.date,
    vix: v.close,
    vxx: vxxByDate[v.date] ?? null,
  })).filter(p => p.vxx != null);

  if (!pairs.length) {
    return {
      pairs: 0,
      note: 'VXX и VIX не пересекаются по датам',
      vix_count: vixNorm.length,
      vxx_count: vxxRows.length,
    };
  }

  let contango = 0, backwardation = 0, neutral = 0;
  for (const p of pairs) {
    const ratio = p.vxx / p.vix;
    if (ratio > 1.05) contango++;
    else if (ratio < 0.95) backwardation++;
    else neutral++;
  }
  return {
    pairs: pairs.length,
    samples: pairs.slice(0, 20),
    contango_count: contango,
    backwardation_count: backwardation,
    neutral_count: neutral,
    contango_pct: Number((contango / pairs.length * 100).toFixed(1)),
    verdict: contango > backwardation ? 'contango' : (backwardation > contango ? 'backwardation' : 'neutral'),
  };
}

function computeAnomalies(rows) {
  const values = rows.map(r => r.value).filter(Number.isFinite);
  if (values.length < 3) return [];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  const threshold = 2 * stddev;
  return rows
    .filter(r => r.value != null && Math.abs(r.value - mean) > threshold)
    .map(r => ({
      date: r.date,
      value: r.value,
      z_score: Number(((r.value - mean) / (stddev || 1)).toFixed(2)),
      deviation: Number((r.value - mean).toFixed(2)),
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
    if (prev.value == null || cur.value == null) { prev = cur; continue; }
    const delta = cur.value - prev.value;
    const deltaPct = prev.value ? (delta / prev.value * 100) : 0;
    let signal = 'hold';
    if (deltaPct > 3) signal = 'vol-rising';
    else if (deltaPct < -3) signal = 'vol-falling';
    signals.push({
      date: cur.date,
      from: prev.value,
      to: cur.value,
      delta: Number(delta.toFixed(2)),
      delta_pct: Number(deltaPct.toFixed(2)),
      signal,
      regime: cur.regime,
    });
    prev = cur;
  }
  return signals;
}

function toReport(rows, stats, comparison) {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push('  VXX REPORT — VIX Short-Term Futures');
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Точек: ${stats.count}`);
  lines.push(`Период: ${stats.date_from} → ${stats.date_to}`);
  lines.push('');
  lines.push('РЕЖИМЫ:');
  lines.push(`  calm:     ${stats.by_regime.calm}`);
  lines.push(`  normal:   ${stats.by_regime.normal}`);
  lines.push(`  elevated: ${stats.by_regime.elevated}`);
  lines.push(`  stress:   ${stats.by_regime.stress}`);
  lines.push(`  panic:    ${stats.by_regime.panic}`);
  lines.push('');
  if (stats.value) lines.push(`VALUE — min: ${stats.value.min}  max: ${stats.value.max}  mean: ${stats.value.mean}  stddev: ${stats.value.stddev}`);
  lines.push('');
  if (stats.last_value != null) {
    lines.push(`ПОСЛЕДНЕЕ (${stats.last_date}): ${stats.last_value} — режим: ${stats.last_regimeLabel}`);
  }
  lines.push('');
  if (comparison && comparison.pairs) {
    lines.push(`VXX vs VIX — сравнимо точек: ${comparison.pairs}, contango: ${comparison.contango_pct}%, verdict: ${comparison.verdict}`);
  }
  lines.push('');
  lines.push('='.repeat(60));
  return lines.join('\n');
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(vixRows) {
  const features = vixRows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        date: r.date, close: r.close, country: r.country,
        category: 'finance', icon: meta.icon,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    legend: Object.entries(REGIME_META).filter(([k]) => k !== 'unknown').map(([key, def]) => ({
      key, label: def.label, color: def.color, range: [def.min, def.max === Infinity ? 'inf' : def.max],
    })),
    meta: { total: features.length, note: 'VXX — это series-only слой; точки — VIX из basket/vix.json' },
  };
}

function toSeries(rows) {
  return rows.map(r => ({
    date: r.date,
    value: r.value,
    regime: r.regime,
    regimeLabel: r.regimeLabel,
  }));
}

function toCSV(rows) {
  const lines = ['date,value,regime,regime_label'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const r of rows) lines.push([r.date, r.value, r.regime, r.regimeLabel].map(esc).join(','));
  return lines.join('\n') + '\n';
}

function toRenderConfig(rows) {
  const series = rows.map(r => ({ x: r.date, y: r.value })).filter(p => p.y != null);
  const coloredPoints = rows.map(r => ({
    x: r.date, y: r.value, color: r.regimeColor, regime: r.regime,
  })).filter(p => p.y != null);
  return {
    type: 'series',
    series: [{ name: 'VXX', color: '#ff44aa', data: series }],
    coloredPoints,
    regimes: Object.entries(REGIME_META).map(([key, def]) => ({
      key, label: def.label, color: def.color, range: [def.min, def.max === Infinity ? 'inf' : def.max],
    })),
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/vxx/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const extra = {
      'X-Module': 'vxx-api',
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
        last_value: st.last_value,
        last_regime: st.last_regime,
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
      const rows = all.slice().sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, n);
      return sendJSON(res, 200, { top: rows, n }, extra);
    }
    if (sub === '/bottom') {
      const n = parseInt(query.n, 10) || 10;
      const rows = all.slice().sort((a, b) => (a.value ?? 1e9) - (b.value ?? 1e9)).slice(0, n);
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
          value: last.value,
          regime: last.regime,
          regimeLabel: last.regimeLabel,
          regimeColor: last.regimeColor,
        },
      }, extra);
    }
    if (sub === '/calm') {
      const rows = all.filter(r => r.regime === 'calm');
      return sendJSON(res, 200, { calm: rows, count: rows.length }, extra);
    }
    if (sub === '/stress') {
      const rows = all.filter(r => r.regime === 'stress' || r.regime === 'panic');
      return sendJSON(res, 200, { stress: rows, count: rows.length }, extra);
    }
    if (sub === '/volatility') {
      const vol = computeVolatility(all);
      return sendJSON(res, 200, { volatility: vol }, extra);
    }
    if (sub === '/decay') {
      const decay = computeDecay(all);
      return sendJSON(res, 200, { decay }, extra);
    }
    if (sub === '/contango' || sub === '/backwardation' || sub === '/vix-comparison') {
      const cached = cacheGet('vix-comparison');
      let comparison = cached;
      if (!comparison) {
        comparison = await computeVixComparison(all);
        if (comparison) cachePut('vix-comparison', comparison);
      }
      if (sub === '/contango') return sendJSON(res, 200, { verdict: comparison?.verdict || 'unknown', contango_count: comparison?.contango_count ?? 0, pct: comparison?.contango_pct ?? 0, comparison }, extra);
      if (sub === '/backwardation') return sendJSON(res, 200, { verdict: comparison?.verdict || 'unknown', backwardation_count: comparison?.backwardation_count ?? 0, comparison }, extra);
      return sendJSON(res, 200, { comparison }, extra);
    }
    if (sub === '/distribution') {
      const distribution = computeDistribution(all);
      return sendJSON(res, 200, { distribution }, extra);
    }
    if (sub === '/timeline') {
      const timeline = all.map(r => ({ date: r.date, value: r.value, regime: r.regime }));
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
    if (sub === '/compare') {
      const dates = String(query.dates || '').split(',').map(s => s.trim()).filter(Boolean);
      const results = dates.map(d => all.find(r => r.date === d)).filter(Boolean);
      return sendJSON(res, 200, { count: results.length, results }, extra);
    }
    if (sub === '/export' || format === 'report') {
      const stats = computeStats(all);
      const comparison = await computeVixComparison(all);
      const report = toReport(all, stats, comparison);
      return sendText(res, 200, report, 'text/plain; charset=utf-8');
    }
    if (sub === '/reset-cache') {
      const before = _cache.size;
      cacheClear();
      return sendJSON(res, 200, { cleared: before, now: _cache.size }, extra);
    }
    if (sub === '/featurecollection') {
      const vixRows = (await loadVix()).map(normalizeVix);
      return sendJSON(res, 200, toFeatureCollection(vixRows), extra);
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
    const comparison = await computeVixComparison(rows);
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
      decay: computeDecay(rows),
      vix_comparison: comparison,
      current_regime: stats.last_value != null ? {
        regime: stats.last_regime,
        regimeLabel: stats.last_regimeLabel,
        value: stats.last_value,
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
