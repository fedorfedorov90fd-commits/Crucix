/**
 * apis/sources/tips-api.mjs — API-МОДУЛЬ: TIPS (РЕАЛЬНЫЕ СТАВКИ ФРС)
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/tips.json — [{ date, value }] ИЛИ [{ date, close, tenor }] ИЛИ { data:[...] } ИЛИ { series:[...] }.
 * Сборщик: scripts/collectors/collect-tips.mjs.
 *
 * TIPS (Treasury Inflation-Protected Securities) — защищённые от инфляции
 * гособлигации США. Реальная ставка = nominal − inflation expectations.
 * Отрицательный TIPS = инфляционные ожидания выше номинальной ставки (риск-сигнал).
 * Индикатор ожиданий ФРС, настроений рынка, риск-он/офф.
 *
 * Точка ряда: { date, value }
 *
 * Режимы (по значению реальной ставки):
 *   negative  (< 0)
 *   low       (0–1)
 *   normal    (1–2)
 *   elevated  (2–3)
 *   high      (> 3)
 *
 * ФОРМАТЫ: json (FC + series + stats + trends), csv, series, stats, raw, report, text.
 * ФИЛЬТРЫ: ?since=, ?until=, ?min_value=, ?max_value=, ?regime=, ?limit=, ?top=, ?sort=.
 *
 * ОСНОВНЫЕ ПОДПУТИ:
 *   /                       — сводка (series + stats + trend + regime)
 *   /stats /status /health  — метрики и состояние
 *   /config /filter-presets — конфигурация и пресеты
 *   /count /series /latest  — базовые данные
 *   /recent /top /bottom    — свежие и топы
 *   /regimes /current-regime — режимы
 *   /negative /elevated     — точки по режимам
 *   /volatility /vol        — волатильность
 *   /distribution           — распределение по бакетам
 *   /timeline /trends       — динамика
 *   /anomalies /signals     — аномалии и сигналы
 *   /correlations           — автокорреляции
 *   /compare?dates=a,b,c    — сравнение точек
 *   /search /bbox           — поиск
 *   /export /reset-cache    — сервис
 *   /featurecollection /render — GeoJSON и рендер
 *   /builtin                — встроенный fallback (20 точек)
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'tips.json');

export const route  = '/api/layers/tips';
export const method = 'GET';

export const meta = {
  category: 'finance',
  icon: '📈',
  color: '#ff66aa',
  vizType: 'choropleth',
  source: 'basket/tips.json',
  collector: 'collect-tips.mjs',
  cache: 300,
  description: 'TIPS — реальные ставки ФРС (защищённые от инфляции облигации США)',
  unit: 'percent',
};

// ============================================================
//  РЕЖИМЫ ПО ЗНАЧЕНИЮ РЕАЛЬНОЙ СТАВКИ
// ============================================================

const REGIME_META = {
  negative: { min: -Infinity, max: 0, color: '#dc2626', label: 'Отрицательная',  severity: 4, description: 'Инфляционные ожидания выше номинальной ставки' },
  low:      { min: 0,  max: 1, color: '#f97316', label: 'Низкая',            severity: 3, description: 'Низкая реальная доходность, риск-он' },
  normal:   { min: 1,  max: 2, color: '#22c55e', label: 'Норма',              severity: 2, description: 'Умеренная реальная доходность' },
  elevated: { min: 2,  max: 3, color: '#eab308', label: 'Повышенная',        severity: 2, description: 'Высокая реальная доходность, риск-офф' },
  high:     { min: 3,  max: Infinity, color: '#dc2626', label: 'Высокая',   severity: 3, description: 'Экстремально высокая доходность' },
  unknown:  { min: -1, max: -2, color: '#64748b', label: 'Неизвестно',       severity: 0, description: 'Нет данных' },
};

function regimeOf(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return { key: 'unknown', ...REGIME_META.unknown };
  if (n < 0) return { key: 'negative', ...REGIME_META.negative };
  if (n < 1) return { key: 'low',      ...REGIME_META.low };
  if (n < 2) return { key: 'normal',   ...REGIME_META.normal };
  if (n < 3) return { key: 'elevated', ...REGIME_META.elevated };
  return { key: 'high', ...REGIME_META.high };
}

const SIZE_BUCKETS = [
  { min: -Infinity, max: 0, label: '< 0 (negative)',       color: '#dc2626' },
  { min: 0,         max: 1, label: '0-1 (low)',            color: '#f97316' },
  { min: 1,         max: 2, label: '1-2 (normal)',         color: '#22c55e' },
  { min: 2,         max: 3, label: '2-3 (elevated)',       color: '#eab308' },
  { min: 3,         max: Infinity, label: '> 3 (high)',    color: '#dc2626' },
];

const FILTER_PRESETS = [
  { id: 'all',       label: 'Весь ряд',              params: {} },
  { id: 'latest',    label: 'Последние 30',           params: { sort: 'date-desc', limit: 30 } },
  { id: 'negative',  label: 'Отрицательные',          params: { regime: 'negative' } },
  { id: 'normal',    label: 'Норма (1-2%)',           params: { regime: 'normal' } },
  { id: 'elevated',  label: 'Повышенные (2-3%)',      params: { regime: 'elevated' } },
  { id: 'high',      label: 'Высокие (> 3%)',         params: { regime: 'high' } },
  { id: 'recent',    label: 'Последние 30 дней',      params: { since: '30d' } },
];

// ============================================================
//  FALLBACK (20 точек — продолжение тренда)
// ============================================================

const BUILTIN_SERIES = [
  { date: '2026-07-25', value: 1.50 },
  { date: '2026-07-27', value: 1.60 },
  { date: '2026-07-29', value: 1.70 },
  { date: '2026-07-31', value: 1.80 },
  { date: '2026-08-02', value: 1.80 },
  { date: '2026-08-04', value: 1.80 },
  { date: '2026-08-06', value: 1.80 },
  { date: '2026-08-08', value: 1.80 },
  { date: '2026-08-10', value: 1.80 },
  { date: '2026-08-12', value: 1.80 },
  { date: '2026-08-14', value: 1.80 },
  { date: '2026-08-16', value: 1.80 },
  { date: '2026-08-18', value: 1.80 },
  { date: '2026-08-20', value: 1.80 },
  { date: '2026-08-22', value: 1.80 },
  { date: '2026-08-23', value: 1.80 },
  { date: '2026-08-25', value: 1.82 },
  { date: '2026-08-27', value: 1.85 },
  { date: '2026-08-29', value: 1.88 },
  { date: '2026-08-31', value: 1.90 },
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
//  ЗАГРУЗКА BASKET
// ============================================================

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-tips.mjs';
      throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  return parsed;
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
  const value = Number(p.value ?? p.close ?? p.rate ?? p.tips);
  const regime = regimeOf(value);

  return {
    date,
    value: Number.isFinite(value) ? Number(value.toFixed(3)) : null,
    regime: regime.key,
    regimeLabel: regime.label,
    regimeColor: regime.color,
    severity: regime.severity,
    tenor: p.tenor || null,
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
  if (query.min_value != null) { const n = Number(query.min_value); if (Number.isFinite(n)) r = r.filter(x => x.value != null && x.value >= n); }
  if (query.max_value != null) { const n = Number(query.max_value); if (Number.isFinite(n)) r = r.filter(x => x.value != null && x.value <= n); }

  const sortKey = query.sort || 'date-asc';
  if (sortKey === 'date-asc')        r.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  else if (sortKey === 'date-desc')  r.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  else if (sortKey === 'value-desc') r.sort((a, b) => (b.value ?? -1e9) - (a.value ?? -1e9));
  else if (sortKey === 'value-asc')  r.sort((a, b) => (a.value ?? 1e9) - (b.value ?? 1e9));

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(-n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(rows) {
  const byRegime = { negative: 0, low: 0, normal: 0, elevated: 0, high: 0, unknown: 0 };
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
    ? Number((last.value - first.value).toFixed(3)) : null;
  const changePct = (last && first && last.value != null && first.value !== 0)
    ? Number(((last.value - first.value) / Math.abs(first.value) * 100).toFixed(2)) : null;

  return {
    count: rows.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    value: {
      min: Number(Math.min(...values).toFixed(3)),
      max: Number(Math.max(...values).toFixed(3)),
      mean: Number(mean.toFixed(3)),
      median: Number(median.toFixed(3)),
      stddev: Number(stddev.toFixed(3)),
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
    return { label: b.label, range: [b.min === -Infinity ? '-inf' : b.min, b.max === Infinity ? 'inf' : b.max], color: b.color, count: items.length, dates: items.map(x => x.date) };
  }).filter(b => b.count > 0);
}

function computeTrends(rows) {
  const tail = rows.slice(-7);
  const prev = rows.slice(-14, -7);
  if (!tail.length || !prev.length) return null;
  const m = a => a.reduce((s, r) => s + (r.value ?? 0), 0) / a.length;
  const mNew = m(tail), mOld = m(prev);
  const delta = mOld === 0 ? null : ((mNew - mOld) / Math.abs(mOld) * 100);
  return {
    last7_mean: Number(mNew.toFixed(3)),
    prev7_mean: Number(mOld.toFixed(3)),
    delta_pct: delta != null ? Number(delta.toFixed(2)) : null,
    direction: delta == null ? 'unknown' : (delta > 0.5 ? 'rising' : (delta < -0.5 ? 'falling' : 'flat')),
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
    mean: Number(mean.toFixed(3)),
    stddev: Number(stddev.toFixed(3)),
    coefficient_pct: mean !== 0 ? Number((stddev / Math.abs(mean) * 100).toFixed(2)) : null,
    min: Number(Math.min(...values).toFixed(3)),
    max: Number(Math.max(...values).toFixed(3)),
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
      deviation: Number((r.value - mean).toFixed(3)),
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
    const deltaPct = prev.value !== 0 ? (delta / Math.abs(prev.value) * 100) : 0;
    let signal = 'hold';
    if (deltaPct > 1) signal = 'yield-rising';
    else if (deltaPct < -1) signal = 'yield-falling';
    signals.push({
      date: cur.date,
      from: prev.value, to: cur.value,
      delta: Number(delta.toFixed(3)),
      delta_pct: Number(deltaPct.toFixed(2)),
      signal,
      regime: cur.regime,
    });
    prev = cur;
  }
  return signals;
}

function computeCorrelations(rows) {
  // Автокорреляции первого и второго порядка (по значениям)
  const values = rows.map(r => r.value).filter(Number.isFinite);
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

function toReport(rows, stats) {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push('  TIPS REPORT — Treasury Inflation-Protected Securities');
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Точек: ${stats.count}`);
  lines.push(`Период: ${stats.date_from} → ${stats.date_to}`);
  lines.push('');
  lines.push('РЕЖИМЫ:');
  for (const [k, v] of Object.entries(stats.by_regime)) lines.push(`  ${k.padEnd(10)} ${v}`);
  lines.push('');
  if (stats.value) lines.push(`VALUE — min: ${stats.value.min}  max: ${stats.value.max}  mean: ${stats.value.mean}  stddev: ${stats.value.stddev}`);
  lines.push('');
  if (stats.last_value != null) {
    lines.push(`ПОСЛЕДНЕЕ (${stats.last_date}): ${stats.last_value}% — режим: ${stats.last_regimeLabel}`);
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
      key, label: def.label, color: def.color, range: [def.min === -Infinity ? '-inf' : def.min, def.max === Infinity ? 'inf' : def.max],
    })),
    meta: { total: rows.length, note: 'series-only layer (TIPS — ставка, не координата)' },
  };
}

function toSeries(rows) {
  return rows.map(r => ({
    date: r.date,
    value: r.value,
    regime: r.regime,
    regimeLabel: r.regimeLabel,
    tenor: r.tenor,
  }));
}

function toCSV(rows) {
  const lines = ['date,value,regime,regime_label,tenor'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const r of rows) lines.push([r.date, r.value, r.regime, r.regimeLabel, r.tenor].map(esc).join(','));
  return lines.join('\n') + '\n';
}

function toRenderConfig(rows) {
  const series = rows.map(r => ({ x: r.date, y: r.value })).filter(p => p.y != null);
  const coloredPoints = rows.map(r => ({ x: r.date, y: r.value, color: r.regimeColor, regime: r.regime })).filter(p => p.y != null);
  return {
    type: 'series',
    series: [{ name: 'TIPS', color: '#ff66aa', data: series }],
    coloredPoints,
    regimes: Object.entries(REGIME_META).map(([key, def]) => ({
      key, label: def.label, color: def.color, range: [def.min === -Infinity ? '-inf' : def.min, def.max === Infinity ? 'inf' : def.max],
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/tips/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const extra = {
      'X-Module': 'tips-api',
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
        status: 'online', basket_available: true, points: all.length,
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
      return sendJSON(res, 200, { stats: computeStats(all), source, src_meta: srcMeta }, extra);
    }
    if (sub === '/status') {
      const st = computeStats(all);
      return sendJSON(res, 200, {
        status: 'online', points: all.length,
        last_value: st.last_value, last_regime: st.last_regime,
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
      const since = query.since || '30d';
      const t = parseSince(since);
      const sinceDate = t ? new Date(t).toISOString().slice(0, 10) : String(since).slice(0, 10);
      const rows = all.filter(r => r.date && r.date >= sinceDate);
      return sendJSON(res, 200, { recent: rows, count: rows.length, since: sinceDate }, extra);
    }
    if (sub === '/top') {
      const n = parseInt(query.n || query.top, 10) || 10;
      const rows = all.slice().sort((a, b) => (b.value ?? -1e9) - (a.value ?? -1e9)).slice(0, n);
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
          date: last.date, value: last.value, regime: last.regime,
          regimeLabel: last.regimeLabel, regimeColor: last.regimeColor,
        },
      }, extra);
    }
    if (sub === '/negative') {
      const rows = all.filter(r => r.regime === 'negative');
      return sendJSON(res, 200, { negative: rows, count: rows.length }, extra);
    }
    if (sub === '/elevated') {
      const rows = all.filter(r => r.regime === 'elevated' || r.regime === 'high');
      return sendJSON(res, 200, { elevated: rows, count: rows.length }, extra);
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
      const rows = all.filter(r => (String(r.date || '') + ' ' + String(r.value ?? '')).toLowerCase().includes(q));
      return sendJSON(res, 200, { query: q, results: rows, count: rows.length }, extra);
    }
    if (sub === '/bbox') {
      return sendJSON(res, 200, {
        error: 'not_applicable',
        message: 'TIPS — временной ряд ставки, координаты не применимы',
      }, extra);
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
