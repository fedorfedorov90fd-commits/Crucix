/**
 * apis/sources/wti-brent-spread-api.mjs — API-МОДУЛЬ: СПРЕД WTI-BRENT
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/wti-brent-spread.json — { source, lastUpdated, data:[{ date, value, wti, brent, spread }], meta }.
 * Сборщик: scripts/collectors/collect-wti-brent-spread.mjs.
 *
 * Спред между WTI (американская лёгкая нефть) и Brent (европейская эталонная).
 * Показывает разницу в ценах между рынками. Расширение спреда = геополитический риск
 * или логистические ограничения. Узкий спред = норма.
 *
 * Точка: { date, value, wti, brent, spread }
 *
 * Режимы (по значению спреда, $):
 *   narrow  (< 2)  — норма (узкий спред)
 *   normal  (2-4)  — умеренный
 *   wide    (4-7)  — широкий (напряжение)
 *   extreme (> 7)  — экстремальный (кризис)
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
 *   /wti /brent             — только WTI или Brent
 *   /spread                 — только спред
 *   /regimes /current-regime — режимы
 *   /narrow /wide /extreme  — по режимам
 *   /volatility /vol        — волатильность
 *   /distribution           — распределение по бакетам
 *   /timeline /trends       — динамика
 *   /anomalies /signals     — аномалии и сигналы
 *   /correlations           — корреляции WTI/Brent/Spread
 *   /compare?dates=a,b,c    — сравнение
 *   /search                 — поиск
 *   /export /reset-cache    — сервис
 *   /featurecollection /render — GeoJSON и рендер
 *   /builtin                — встроенный fallback (30 точек)
 *   /helper/latest /helper/history — legacy helper-экспорты через API
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'wti-brent-spread.json');

export const route  = '/api/layers/wti-brent-spread';
export const method = 'GET';

export const meta = {
  category: 'energy',
  icon: '🛢️',
  color: '#0891b2',
  vizType: 'series',
  source: 'basket/wti-brent-spread.json',
  collector: 'collect-wti-brent-spread.mjs',
  cache: 300,
  description: 'Спред между WTI и Brent: индикатор геополитических и логистических напряжений на нефтяном рынке',
  unit: 'usd/barrel',
};

// ============================================================
//  РЕЖИМЫ ПО ЗНАЧЕНИЮ СПРЕДА
// ============================================================

const REGIME_META = {
  narrow:  { min: -Infinity, max: 2,       color: '#22c55e', label: 'Узкий (норма)',    severity: 1, description: 'Узкий спред — рынки сбалансированы' },
  normal:  { min: 2,         max: 4,       color: '#84cc16', label: 'Умеренный',        severity: 2, description: 'Умеренный спред, признаки напряжения' },
  wide:    { min: 4,         max: 7,       color: '#f97316', label: 'Широкий',          severity: 3, description: 'Широкий спред — геополитический риск' },
  extreme: { min: 7,         max: Infinity,color: '#dc2626', label: 'Экстремальный',    severity: 4, description: 'Кризисное расхождение рынков' },
  unknown: { min: -1,        max: -2,      color: '#64748b', label: 'Неизвестно',       severity: 0, description: 'Нет данных' },
};

function regimeOf(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return { key: 'unknown', ...REGIME_META.unknown };
  if (n < 2) return { key: 'narrow',  ...REGIME_META.narrow };
  if (n < 4) return { key: 'normal',  ...REGIME_META.normal };
  if (n < 7) return { key: 'wide',    ...REGIME_META.wide };
  return { key: 'extreme', ...REGIME_META.extreme };
}

const SIZE_BUCKETS = [
  { min: -Infinity, max: 2, label: '< 2$ (narrow)',      color: '#22c55e' },
  { min: 2,         max: 4, label: '2-4$ (normal)',      color: '#84cc16' },
  { min: 4,         max: 7, label: '4-7$ (wide)',        color: '#f97316' },
  { min: 7,         max: Infinity, label: '> 7$ (extreme)', color: '#dc2626' },
];

const FILTER_PRESETS = [
  { id: 'all',     label: 'Весь ряд',              params: {} },
  { id: 'latest',  label: 'Последние 30',          params: { sort: 'date-desc', limit: 30 } },
  { id: 'narrow',  label: 'Узкий (< 2$)',          params: { regime: 'narrow' } },
  { id: 'normal',  label: 'Умеренный (2-4$)',      params: { regime: 'normal' } },
  { id: 'wide',    label: 'Широкий (4-7$)',        params: { regime: 'wide' } },
  { id: 'extreme', label: 'Экстремальный (> 7$)',  params: { regime: 'extreme' } },
  { id: 'recent',  label: 'Последние 30 дней',     params: { since: '30d' } },
];

// ============================================================
//  FALLBACK (30 точек)
// ============================================================

const BUILTIN_SERIES = (() => {
  const data = [];
  const startDate = new Date('2026-07-15');
  const wtiBase = 70, brentBase = 74;
  for (let i = 0; i < 30; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const wti = wtiBase + Math.sin(i / 5) * 5 + (Math.random() - 0.5) * 2;
    const spread = 2.5 + Math.abs(Math.sin(i / 3)) * 3;
    const brent = wti + spread;
    data.push({
      date: date.toISOString().slice(0, 10),
      wti: Number(wti.toFixed(2)),
      brent: Number(brent.toFixed(2)),
      value: Number(spread.toFixed(2)),
      spread: Number(spread.toFixed(2)),
    });
  }
  return data;
})();

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
      err.hint = 'run scripts/collectors/collect-wti-brent-spread.mjs';
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
  const wti = Number(p.wti);
  const brent = Number(p.brent);
  let spread = Number(p.spread ?? p.value);
  if (!Number.isFinite(spread) && Number.isFinite(wti) && Number.isFinite(brent)) {
    spread = brent - wti;
  }
  const regime = regimeOf(spread);

  return {
    date,
    wti: Number.isFinite(wti) ? Number(wti.toFixed(2)) : null,
    brent: Number.isFinite(brent) ? Number(brent.toFixed(2)) : null,
    spread: Number.isFinite(spread) ? Number(spread.toFixed(2)) : null,
    regime: regime.key,
    regimeLabel: regime.label,
    regimeColor: regime.color,
    severity: regime.severity,
    category_: 'energy',
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
  if (query.min_wti != null) { const n = Number(query.min_wti); if (Number.isFinite(n)) r = r.filter(x => x.wti != null && x.wti >= n); }
  if (query.max_wti != null) { const n = Number(query.max_wti); if (Number.isFinite(n)) r = r.filter(x => x.wti != null && x.wti <= n); }

  const sortKey = query.sort || 'date-asc';
  if (sortKey === 'date-asc')        r.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  else if (sortKey === 'date-desc')  r.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  else if (sortKey === 'spread-desc') r.sort((a, b) => (b.spread ?? -1e9) - (a.spread ?? -1e9));
  else if (sortKey === 'spread-asc')  r.sort((a, b) => (a.spread ?? 1e9) - (b.spread ?? 1e9));
  else if (sortKey === 'wti-desc')   r.sort((a, b) => (b.wti ?? -1e9) - (a.wti ?? -1e9));
  else if (sortKey === 'wti-asc')    r.sort((a, b) => (a.wti ?? 1e9) - (b.wti ?? 1e9));

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(-n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(rows) {
  const byRegime = { narrow: 0, normal: 0, wide: 0, extreme: 0, unknown: 0 };
  const spreads = [], wtis = [], brents = [];
  for (const r of rows) {
    byRegime[r.regime] = (byRegime[r.regime] || 0) + 1;
    if (r.spread != null) spreads.push(r.spread);
    if (r.wti != null) wtis.push(r.wti);
    if (r.brent != null) brents.push(r.brent);
  }
  const dates = rows.map(r => r.date).filter(Boolean).sort();

  const statsOf = (arr, label) => {
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
      last: Number(arr[arr.length - 1].toFixed(2)),
    };
  };

  const last = rows.slice(-1)[0] || null;
  const first = rows[0] || null;
  const changeAbs = (last && first && last.spread != null && first.spread != null)
    ? Number((last.spread - first.spread).toFixed(2)) : null;
  const changePct = (last && first && first.spread !== 0)
    ? Number(((last.spread - first.spread) / Math.abs(first.spread) * 100).toFixed(2)) : null;

  return {
    count: rows.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    by_regime: byRegime,
    spread: statsOf(spreads, 'spread'),
    wti: statsOf(wtis, 'wti'),
    brent: statsOf(brents, 'brent'),
    last_spread: last?.spread ?? null,
    last_wti: last?.wti ?? null,
    last_brent: last?.brent ?? null,
    last_date: last?.date ?? null,
    last_regime: last?.regime ?? null,
    last_regimeLabel: last?.regimeLabel ?? null,
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
  const delta = mOld === 0 ? null : ((mNew - mOld) / mOld * 100);
  return {
    last7_mean: Number(mNew.toFixed(2)),
    prev7_mean: Number(mOld.toFixed(2)),
    delta_pct: delta != null ? Number(delta.toFixed(2)) : null,
    direction: delta == null ? 'unknown' : (delta > 10 ? 'widening' : (delta < -10 ? 'narrowing' : 'stable')),
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
    mean: Number(mean.toFixed(2)),
    stddev: Number(stddev.toFixed(2)),
    coefficient_pct: mean !== 0 ? Number((stddev / Math.abs(mean) * 100).toFixed(2)) : null,
    min: Number(Math.min(...values).toFixed(2)),
    max: Number(Math.max(...values).toFixed(2)),
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
      deviation: Number((r.spread - mean).toFixed(2)),
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
    const deltaPct = prev.spread !== 0 ? (delta / Math.abs(prev.spread) * 100) : 0;
    let signal = 'hold';
    if (deltaPct > 10) signal = 'widening';
    else if (deltaPct < -10) signal = 'narrowing';
    signals.push({
      date: cur.date,
      from: prev.spread, to: cur.spread,
      delta: Number(delta.toFixed(2)),
      delta_pct: Number(deltaPct.toFixed(2)),
      signal,
      regime: cur.regime,
    });
    prev = cur;
  }
  return signals;
}

function computeCorrelations(rows) {
  const pairs = rows.filter(r => r.wti != null && r.brent != null && r.spread != null);
  if (pairs.length < 3) return null;
  const corr = (arrA, arrB) => {
    const n = arrA.length;
    const mA = arrA.reduce((a, b) => a + b, 0) / n;
    const mB = arrB.reduce((a, b) => a + b, 0) / n;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) {
      const dA = arrA[i] - mA, dB = arrB[i] - mB;
      num += dA * dB; da += dA * dA; db += dB * dB;
    }
    const den = Math.sqrt(da * db);
    return den === 0 ? 0 : Number((num / den).toFixed(3));
  };
  const wtiArr = pairs.map(p => p.wti);
  const brentArr = pairs.map(p => p.brent);
  const spreadArr = pairs.map(p => p.spread);
  return {
    wti_brent: corr(wtiArr, brentArr),
    wti_spread: corr(wtiArr, spreadArr),
    brent_spread: corr(brentArr, spreadArr),
    samples: pairs.length,
  };
}

function toReport(rows, stats) {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push('  WTI-BRENT SPREAD REPORT — Crucix');
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Точек: ${stats.count}`);
  lines.push(`Период: ${stats.date_from} → ${stats.date_to}`);
  lines.push('');
  lines.push('РЕЖИМЫ:');
  for (const [k, v] of Object.entries(stats.by_regime)) lines.push(`  ${k.padEnd(10)} ${v}`);
  lines.push('');
  if (stats.spread) lines.push(`SPREAD — min: ${stats.spread.min}$  max: ${stats.spread.max}$  mean: ${stats.spread.mean}$  stddev: ${stats.spread.stddev}$`);
  if (stats.wti)    lines.push(`WTI    — min: ${stats.wti.min}$  max: ${stats.wti.max}$  mean: ${stats.wti.mean}$`);
  if (stats.brent)  lines.push(`BRENT  — min: ${stats.brent.min}$  max: ${stats.brent.max}$  mean: ${stats.brent.mean}$`);
  lines.push('');
  if (stats.last_spread != null) {
    lines.push(`ПОСЛЕДНЕЕ (${stats.last_date}):`);
    lines.push(`  WTI: ${stats.last_wti}$  Brent: ${stats.last_brent}$  Spread: ${stats.last_spread}$ — ${stats.last_regimeLabel}`);
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
    meta: { total: rows.length, note: 'WTI-Brent spread — series-only (без координат)' },
  };
}

function toSeries(rows) {
  return rows.map(r => ({
    date: r.date,
    spread: r.spread, wti: r.wti, brent: r.brent,
    regime: r.regime, regimeLabel: r.regimeLabel,
  }));
}

function toCSV(rows) {
  const lines = ['date,wti,brent,spread,regime,regime_label'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const r of rows) lines.push([r.date, r.wti, r.brent, r.spread, r.regime, r.regimeLabel].map(esc).join(','));
  return lines.join('\n') + '\n';
}

function toRenderConfig(rows) {
  const series = rows.map(r => ({ x: r.date, y: r.spread })).filter(p => p.y != null);
  const coloredPoints = rows.map(r => ({ x: r.date, y: r.spread, color: r.regimeColor, regime: r.regime })).filter(p => p.y != null);
  return {
    type: 'series',
    series: [
      { name: 'Spread', color: '#0891b2', data: series },
      { name: 'WTI',    color: '#22c55e', data: rows.map(r => ({ x: r.date, y: r.wti })).filter(p => p.y != null), axis: 'y2' },
      { name: 'Brent',  color: '#f97316', data: rows.map(r => ({ x: r.date, y: r.brent })).filter(p => p.y != null), axis: 'y2' },
    ],
    coloredPoints,
    regimes: Object.entries(REGIME_META).map(([key, def]) => ({ key, ...def })),
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
//  LEGACY HELPER-ЭКСПОРТЫ
// ============================================================

export async function getWtiBrentSpreadLatest() {
  try {
    const doc = await loadData();
    const { series } = extractSeries(doc);
    if (!series.length) return null;
    const normalized = series.map(normalizePoint);
    return normalized.slice(-1)[0] || null;
  } catch (e) {
    const fallback = BUILTIN_SERIES.map(normalizePoint);
    return fallback.slice(-1)[0] || null;
  }
}

export async function getWtiBrentSpreadHistory(limit = 30) {
  try {
    const doc = await loadData();
    const { series } = extractSeries(doc);
    const normalized = (series.length ? series : BUILTIN_SERIES).map(normalizePoint);
    return normalized.slice(-limit);
  } catch (e) {
    return BUILTIN_SERIES.slice(-limit).map(normalizePoint);
  }
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/wti-brent-spread/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const extra = {
      'X-Module': 'wti-brent-spread-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
      'Access-Control-Allow-Origin': '*',
    };

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
        last_spread: st.last_spread, last_regime: st.last_regime,
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
      const rows = all.slice().sort((a, b) => (b.spread ?? -1) - (a.spread ?? -1)).slice(0, n);
      return sendJSON(res, 200, { top: rows, n }, extra);
    }
    if (sub === '/bottom') {
      const n = parseInt(query.n, 10) || 10;
      const rows = all.slice().sort((a, b) => (a.spread ?? 1e9) - (b.spread ?? 1e9)).slice(0, n);
      return sendJSON(res, 200, { bottom: rows, n }, extra);
    }
    if (sub === '/wti') {
      const rows = all.filter(r => r.wti != null).map(r => ({ date: r.date, value: r.wti, regime: r.regime }));
      return sendJSON(res, 200, { series: rows, count: rows.length, field: 'wti' }, extra);
    }
    if (sub === '/brent') {
      const rows = all.filter(r => r.brent != null).map(r => ({ date: r.date, value: r.brent, regime: r.regime }));
      return sendJSON(res, 200, { series: rows, count: rows.length, field: 'brent' }, extra);
    }
    if (sub === '/spread') {
      const rows = all.filter(r => r.spread != null).map(r => ({ date: r.date, value: r.spread, regime: r.regime }));
      return sendJSON(res, 200, { series: rows, count: rows.length, field: 'spread' }, extra);
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
          spread: last.spread, wti: last.wti, brent: last.brent,
          regime: last.regime, regimeLabel: last.regimeLabel, regimeColor: last.regimeColor,
        },
      }, extra);
    }
    if (sub === '/narrow' || sub === '/wide' || sub === '/extreme') {
      const regime = sub.slice(1);
      const rows = all.filter(r => r.regime === regime);
      return sendJSON(res, 200, { [regime]: rows, count: rows.length }, extra);
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
      const timeline = all.map(r => ({ date: r.date, spread: r.spread, wti: r.wti, brent: r.brent, regime: r.regime }));
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
    if (sub === '/helper/latest') {
      const latest = await getWtiBrentSpreadLatest();
      return sendJSON(res, 200, { latest }, extra);
    }
    if (sub === '/helper/history') {
      const limit = parseInt(query.limit, 10) || 30;
      const history = await getWtiBrentSpreadHistory(limit);
      return sendJSON(res, 200, { history, count: history.length, limit }, extra);
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
      current_regime: stats.last_spread != null ? {
        regime: stats.last_regime,
        regimeLabel: stats.last_regimeLabel,
        spread: stats.last_spread,
        wti: stats.last_wti,
        brent: stats.last_brent,
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
