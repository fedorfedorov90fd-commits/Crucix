/**
 * apis/sources/silence-api.mjs — API-МОДУЛЬ: ДЕТЕКТОР ИНФОРМАЦИОННОЙ ТИШИНЫ
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/silence.json — { regions:[...], meta? } ИЛИ [...] .
 * Сборщик: scripts/collectors/collect-silence.mjs.
 *
 * Детектор информационной тишины: отслеживает аномальные падения новостного
 * потока по регионам (drop = (baseline - current) / baseline * 100).
 * Резкое падение = сигнал о подавлении/перекрытии информации, о скрытых событиях.
 *
 * Регион:
 *   { id, name, lat, lng, status, drop, baseline, current, category?, region?, since?, notes?, source? }
 *
 * Классификация (по drop %):
 *   - silence  (>= 70%): критическая информационная тишина
 *   - warning  (>= 40%): подозрительное снижение потока
 *   - normal   (< 40%): норма
 *
 * ФОРМАТЫ: json (FC + series + stats + trend + anomalies), csv, series, stats, raw, alerts, report.
 * ФИЛЬТРЫ: ?status=, ?min_drop=, ?max_drop=, ?category=, ?region=, ?q=, ?since=, ?until=, ?limit=, ?top=, ?sort=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /                       — сводка
 *   GET /stats                  — агрегированная статистика
 *   GET /status                 — health-check
 *   GET /health                 — расширенный health с проверкой basket
 *   GET /config                 — конфигурация (пороги, категории, цвета)
 *   GET /weights                — веса статусов для скоринга
 *   GET /count                  — только числа (по статусам, категориям)
 *   GET /regions                — все регионы
 *   GET /regions/:id            — конкретный регион
 *   GET /regions/:id/history    — история региона (если есть snapshots)
 *   GET /silent                 — только silence
 *   GET /warnings               — только warning
 *   GET /normal                 — только normal
 *   GET /alerts                 — silence + warning
 *   GET /critical               — самый высокий drop
 *   GET /top?n=N                — топ-N по drop
 *   GET /bottom?n=N             — антитоп-N по drop
 *   GET /search?q=              — текстовый поиск
 *   GET /anomalies              — аномалии (drop > средний + 2*stddev)
 *   GET /recent?since=          — свежие (после даты)
 *   GET /categories             — группировка по категориям
 *   GET /severity               — группировка по статусам
 *   GET /timeline               — динамика по since
 *   GET /trends                 — динамика baseline vs current
 *   GET /drop-distribution      — распределение drop по бакетам
 *   GET /snapshots              — снимки состояний (если есть)
 *   GET /filter-presets         — готовые фильтры для UI
 *   GET /compare?ids=a,b,c      — сравнение регионов
 *   GET /bulk-compare?ids=...   — пакетное сравнение (>5)
 *   GET /sources                — источники
 *   GET /latest                 — последние обновления
 *   GET /export                 — экспорт-отчёт (text)
 *   GET /featurecollection      — чистый GeoJSON
 *   GET /render                 — рендер-конфиг
 *   GET /builtin                — встроенный fallback (11 регионов)
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'silence.json');

export const route  = '/api/layers/silence';
export const method = 'GET';

export const meta = {
  category: 'intelligence',
  icon: '🤫',
  color: '#6366f1',
  vizType: 'marker',
  source: 'basket/silence.json',
  collector: 'collect-silence.mjs',
  cache: 300,
  description: 'Детектор информационной тишины: аномальные падения новостного потока по регионам',
  unit: 'regions',
};

// ============================================================
//  КЛАССИФИКАЦИЯ СТАТУСОВ
// ============================================================

const STATUS_META = {
  silence:  { min: 70, max: 101, color: '#dc2626', label: 'Информационная тишина', severity: 3 },
  warning:  { min: 40, max: 70,  color: '#f97316', label: 'Подозрительное снижение', severity: 2 },
  normal:   { min: 0,  max: 40,  color: '#22c55e', label: 'Норма', severity: 1 },
  unknown:  { min: -1, max: -1,  color: '#64748b', label: 'Нет данных', severity: 0 },
};

function statusOf(drop) {
  const n = Number(drop);
  if (!Number.isFinite(n)) return { key: 'unknown', ...STATUS_META.unknown };
  if (n >= 70) return { key: 'silence', ...STATUS_META.silence };
  if (n >= 40) return { key: 'warning', ...STATUS_META.warning };
  return { key: 'normal', ...STATUS_META.normal };
}

const CATEGORY_COLORS = {
  'blizhny-vostok':    '#dc2626',
  'vostochnaya-evropa':'#f97316',
  'afrika':            '#eab308',
  'aziya':             '#0891b2',
  'amerika':           '#8b5cf6',
  'evropa':            '#22c55e',
  'arktika':           '#06b6d4',
  'okean':             '#0ea5e9',
  'unknown':           '#64748b',
};

const WEIGHTS = {
  silence:  1.0,
  warning:  0.6,
  normal:   0.2,
  unknown:  0.0,
};

const FILTER_PRESETS = [
  { id: 'all',       label: 'Все регионы',           params: {} },
  { id: 'silent',    label: 'Только тишина',         params: { status: 'silence' } },
  { id: 'warnings',  label: 'Подозрительные',        params: { status: 'warning' } },
  { id: 'alerts',    label: 'Все тревоги',           params: { min_drop: 40 } },
  { id: 'critical',  label: 'Критические (>=80%)',   params: { min_drop: 80 } },
  { id: 'fresh',     label: 'Свежие (30 дней)',      params: { since: '2026-08-15' } },
  { id: 'blizhny',   label: 'Ближний Восток',        params: { category: 'blizhny-vostok' } },
  { id: 'afrika',    label: 'Африка',                params: { category: 'afrika' } },
];

// ============================================================
//  СПРАВОЧНИК КООРДИНАТ
// ============================================================

const REGION_COORDS = {
  'middle-east':        [31.0, 40.0],
  'ближний восток':     [31.0, 40.0],
  'ukraine':            [48.4, 31.2],
  'украина':            [48.4, 31.2],
  'russia':             [61.5, 105.0],
  'россия':             [61.5, 105.0],
  'usa':                [39.7, -98.8],
  'сша':                [39.7, -98.8],
  'europe':             [50.0, 10.0],
  'европа':             [50.0, 10.0],
  'africa':             [0.0, 20.0],
  'африка':             [0.0, 20.0],
  'asia':               [34.9, 105.2],
  'азия':               [34.9, 105.2],
  'latin-america':      [-15.0, -60.0],
  'латинская америка':  [-15.0, -60.0],
  'china':              [34.9, 105.2],
  'китай':              [34.9, 105.2],
  'india':              [20.8, 78.5],
  'индия':              [20.8, 78.5],
  'arctic':             [75.0, 0.0],
  'арктика':            [75.0, 0.0],
  'pacific':            [0.0, -160.0],
  'тихий океан':        [0.0, -160.0],
  'sahel':              [15.0, 0.0],
  'сахель':             [15.0, 0.0],
  'taiwan':             [23.5, 121.0],
  'тайвань':            [23.5, 121.0],
};

// ============================================================
//  ВСТРОЕННЫЙ FALLBACK (11 регионов)
// ============================================================

const BUILTIN_REGIONS = [
  { id: 'middle-east',   name: 'Ближний Восток',    category: 'blizhny-vostok',    region: 'middle-east',   status: 'silence', drop: 87, baseline: 470,  current: 61,   since: '2026-08-28', notes: 'Резкое перекрытие потоков' },
  { id: 'ukraine',       name: 'Украина',           category: 'vostochnaya-evropa', region: 'ukraine',     status: 'normal',  drop: 12, baseline: 520,  current: 458,  since: null,         notes: null },
  { id: 'russia',        name: 'Россия',            category: 'vostochnaya-evropa', region: 'russia',      status: 'normal',  drop: 8,  baseline: 890,  current: 819,  since: null,         notes: null },
  { id: 'usa',           name: 'США',               category: 'amerika',           region: 'usa',         status: 'normal',  drop: 5,  baseline: 2340, current: 2223, since: null,         notes: null },
  { id: 'europe',        name: 'Европа',            category: 'evropa',            region: 'europe',      status: 'warning', drop: 45, baseline: 1560, current: 858,  since: '2026-09-01', notes: 'Регуляторное давление' },
  { id: 'africa',        name: 'Африка',            category: 'afrika',            region: 'africa',      status: 'silence', drop: 72, baseline: 430,  current: 120,  since: '2026-08-25', notes: 'Гуманитарный кризис без освещения' },
  { id: 'asia',          name: 'Азия',              category: 'aziya',             region: 'asia',        status: 'normal',  drop: 15, baseline: 1780, current: 1513, since: null,         notes: null },
  { id: 'china',         name: 'Китай',             category: 'aziya',             region: 'china',       status: 'warning', drop: 52, baseline: 1200, current: 576,  since: '2026-09-03', notes: 'Цензура внутреннего потока' },
  { id: 'latin-america', name: 'Латинская Америка', category: 'amerika',           region: 'latin-america', status: 'normal', drop: 18, baseline: 620, current: 508, since: null,         notes: null },
  { id: 'sahel',         name: 'Сахель',            category: 'afrika',            region: 'sahel',       status: 'silence', drop: 78, baseline: 340,  current: 75,   since: '2026-08-30', notes: 'Военный переворот, закрытие СМИ' },
  { id: 'arctic',        name: 'Арктика',           category: 'arktika',           region: 'arctic',      status: 'normal',  drop: 22, baseline: 180,  current: 140,  since: null,         notes: null },
];

// ============================================================
//  IN-MEMORY КЭШ АНАЛИТИКИ
// ============================================================

const _cache = new Map();
const CACHE_TTL = 60_000;

function cacheGet(key) {
  const item = _cache.get(key);
  if (!item) return null;
  if (item.expires < Date.now()) { _cache.delete(key); return null; }
  return item.value;
}
function cachePut(key, value) {
  _cache.set(key, { value, expires: Date.now() + CACHE_TTL });
}
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
      err.hint = 'run scripts/collectors/collect-silence.mjs';
      throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  return parsed;
}

function extractRegions(doc) {
  if (Array.isArray(doc)) return { regions: doc, source: null, meta: null, snapshots: [] };
  if (!doc || typeof doc !== 'object') return { regions: [], source: null, meta: null, snapshots: [] };
  const snapshots = Array.isArray(doc.snapshots) ? doc.snapshots : [];
  if (Array.isArray(doc.regions)) return { regions: doc.regions, source: doc.source || null, meta: doc.meta || null, snapshots };
  if (Array.isArray(doc.data))    return { regions: doc.data,    source: doc.source || null, meta: doc.meta || null, snapshots };
  if (Array.isArray(doc.items))   return { regions: doc.items,   source: doc.source || null, meta: doc.meta || null, snapshots };
  return { regions: [], source: null, meta: null, snapshots };
}

// ============================================================
//  НОРМАЛИЗАЦИЯ
// ============================================================

function normalizeRegion(r, i) {
  const id = String(r.id || r.slug || `region-${i}`);
  const name = r.name || r.title || id;
  const baseline = Number(r.baseline ?? r.base);
  const current = Number(r.current ?? r.value);
  let drop = Number(r.drop);
  if (!Number.isFinite(drop) && Number.isFinite(baseline) && Number.isFinite(current) && baseline > 0) {
    drop = Number((((baseline - current) / baseline) * 100).toFixed(1));
  }

  let lat = Number(r.lat ?? r.latitude);
  let lng = Number(r.lng ?? r.lon ?? r.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const key = String(r.region || id || name).toLowerCase();
    const coords = REGION_COORDS[key];
    if (coords) { lat = coords[0]; lng = coords[1]; }
  }

  const st = statusOf(drop);
  const statusExplicit = r.status && STATUS_META[String(r.status).toLowerCase()];
  const finalStatus = statusExplicit ? String(r.status).toLowerCase() : st.key;
  const finalMeta = STATUS_META[finalStatus] || STATUS_META.unknown;

  const category = String(r.category || r.region || 'unknown').toLowerCase();
  const catColor = CATEGORY_COLORS[category] || CATEGORY_COLORS.unknown;
  const score = Number(((finalMeta.severity || 0) * (drop ?? 0) / 100).toFixed(2));

  return {
    id,
    name,
    category,
    categoryColor: catColor,
    region: r.region || null,
    status: finalStatus,
    statusLabel: finalMeta.label,
    statusColor: finalMeta.color,
    severity: finalMeta.severity,
    weight: WEIGHTS[finalStatus] || 0,
    score,
    drop: Number.isFinite(drop) ? Number(drop.toFixed(1)) : null,
    baseline: Number.isFinite(baseline) ? Math.round(baseline) : null,
    current: Number.isFinite(current) ? Math.round(current) : null,
    delta: (Number.isFinite(baseline) && Number.isFinite(current)) ? Math.round(baseline - current) : null,
    since: r.since || null,
    notes: r.notes || r.description || null,
    source: r.source || null,
    lat: Number.isFinite(lat) ? Number(lat.toFixed(4)) : null,
    lng: Number.isFinite(lng) ? Number(lng.toFixed(4)) : null,
    category_: 'intelligence',
    icon: meta.icon,
  };
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.status)   r = r.filter(x => x.status === String(query.status).toLowerCase());
  if (query.category) r = r.filter(x => x.category === String(query.category).toLowerCase());
  if (query.region)   r = r.filter(x => String(x.region || '').toLowerCase().includes(String(query.region).toLowerCase()));
  if (query.q) {
    const s = String(query.q).toLowerCase();
    r = r.filter(x => (x.name + ' ' + (x.notes || '') + ' ' + (x.region || '')).toLowerCase().includes(s));
  }
  if (query.min_drop != null) { const n = Number(query.min_drop); if (Number.isFinite(n)) r = r.filter(x => x.drop != null && x.drop >= n); }
  if (query.max_drop != null) { const n = Number(query.max_drop); if (Number.isFinite(n)) r = r.filter(x => x.drop != null && x.drop <= n); }
  if (query.min_baseline != null) { const n = Number(query.min_baseline); if (Number.isFinite(n)) r = r.filter(x => x.baseline != null && x.baseline >= n); }
  if (query.since) r = r.filter(x => !x.since || x.since >= String(query.since).slice(0, 10));
  if (query.until) r = r.filter(x => !x.since || x.since <= String(query.until).slice(0, 10));

  const sortKey = query.sort || 'drop-desc';
  if (sortKey === 'drop-desc')           r.sort((a, b) => (b.drop ?? -1) - (a.drop ?? -1));
  else if (sortKey === 'drop-asc')       r.sort((a, b) => (a.drop ?? 101) - (b.drop ?? 101));
  else if (sortKey === 'name')           r.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortKey === 'baseline-desc')  r.sort((a, b) => (b.baseline ?? 0) - (a.baseline ?? 0));
  else if (sortKey === 'current-desc')   r.sort((a, b) => (b.current ?? 0) - (a.current ?? 0));
  else if (sortKey === 'score-desc')     r.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  else if (sortKey === 'delta-desc')     r.sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(rows) {
  const byStatus = { silence: 0, warning: 0, normal: 0, unknown: 0 };
  const byCategory = {};
  const drops = [];
  let totalBaseline = 0, totalCurrent = 0;

  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    if (r.drop != null) drops.push(r.drop);
    if (r.baseline != null) totalBaseline += r.baseline;
    if (r.current != null) totalCurrent += r.current;
  }

  const top = (obj, n = 10) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));

  if (!drops.length) {
    return {
      count: rows.length,
      by_status: byStatus,
      by_category: byCategory,
      top_categories: top(byCategory),
      drop: null,
      totals: { baseline: totalBaseline, current: totalCurrent, delta: totalBaseline - totalCurrent },
    };
  }

  const mean = drops.reduce((a, b) => a + b, 0) / drops.length;
  const sorted = [...drops].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const variance = drops.reduce((a, v) => a + (v - mean) ** 2, 0) / drops.length;
  const stddev = Math.sqrt(variance);

  return {
    count: rows.length,
    by_status: byStatus,
    by_category: byCategory,
    top_categories: top(byCategory, 10),
    drop: {
      min: Number(Math.min(...drops).toFixed(1)),
      max: Number(Math.max(...drops).toFixed(1)),
      mean: Number(mean.toFixed(1)),
      median: Number(median.toFixed(1)),
      stddev: Number(stddev.toFixed(1)),
    },
    totals: {
      baseline: totalBaseline,
      current: totalCurrent,
      delta: totalBaseline - totalCurrent,
      delta_pct: totalBaseline > 0 ? Number((((totalBaseline - totalCurrent) / totalBaseline) * 100).toFixed(1)) : null,
    },
  };
}

function computeDropDistribution(rows, step = 20) {
  const buckets = [];
  for (let i = 0; i < 100; i += step) {
    const max = Math.min(100, i + step);
    const items = rows.filter(r => r.drop != null && r.drop >= i && r.drop < max);
    const st = statusOf(i + step / 2);
    buckets.push({
      range: [i, max],
      count: items.length,
      status: st.key,
      color: st.color,
      regions: items.map(r => r.id),
    });
  }
  const over = rows.filter(r => r.drop != null && r.drop >= 100);
  if (over.length) buckets.push({ range: [100, 'inf'], count: over.length, status: 'silence', color: '#dc2626', regions: over.map(r => r.id) });
  return buckets;
}

function computeTimeline(rows) {
  const byDate = {};
  for (const r of rows) {
    if (!r.since) continue;
    if (!byDate[r.since]) byDate[r.since] = { date: r.since, count: 0, by_status: {}, regions: [] };
    byDate[r.since].count++;
    byDate[r.since].by_status[r.status] = (byDate[r.since].by_status[r.status] || 0) + 1;
    byDate[r.since].regions.push(r.id);
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function computeTrends(rows) {
  return rows
    .filter(r => r.baseline != null && r.current != null)
    .map(r => ({
      id: r.id,
      name: r.name,
      baseline: r.baseline,
      current: r.current,
      delta: r.baseline - r.current,
      drop_pct: r.drop,
      direction: r.drop >= 40 ? 'falling' : (r.drop > 0 ? 'softening' : 'growing'),
      status: r.status,
    }))
    .sort((a, b) => (b.drop_pct ?? 0) - (a.drop_pct ?? 0));
}

function computeAnomalies(rows) {
  if (rows.length < 3) return [];
  const drops = rows.map(r => r.drop).filter(Number.isFinite);
  if (drops.length < 3) return [];
  const mean = drops.reduce((a, b) => a + b, 0) / drops.length;
  const variance = drops.reduce((a, v) => a + (v - mean) ** 2, 0) / drops.length;
  const stddev = Math.sqrt(variance);
  const threshold = mean + 2 * stddev;
  return rows
    .filter(r => r.drop != null && r.drop > threshold)
    .map(r => ({
      id: r.id,
      name: r.name,
      drop: r.drop,
      mean: Number(mean.toFixed(1)),
      stddev: Number(stddev.toFixed(1)),
      threshold: Number(threshold.toFixed(1)),
      z_score: Number(((r.drop - mean) / (stddev || 1)).toFixed(2)),
      status: r.status,
      notes: r.notes,
    }))
    .sort((a, b) => b.z_score - a.z_score);
}

function computeCounts(rows) {
  const byStatus = { silence: 0, warning: 0, normal: 0, unknown: 0 };
  const byCategory = {};
  const bySource = {};
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    if (r.source) bySource[r.source] = (bySource[r.source] || 0) + 1;
  }
  return {
    total: rows.length,
    by_status: byStatus,
    by_category: byCategory,
    by_source: bySource,
    alerts: (byStatus.silence || 0) + (byStatus.warning || 0),
  };
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
        id: r.id, name: r.name,
        category: r.category, categoryColor: r.categoryColor,
        region: r.region,
        status: r.status, statusLabel: r.statusLabel, statusColor: r.statusColor,
        severity: r.severity, weight: r.weight, score: r.score,
        drop: r.drop, baseline: r.baseline, current: r.current, delta: r.delta,
        since: r.since, notes: r.notes,
        category_: r.category_, icon: r.icon,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    legend: Object.entries(STATUS_META).filter(([k]) => k !== 'unknown').map(([key, def]) => ({
      key, min: def.min, max: def.max, color: def.color, label: def.label,
    })),
    meta: { total: rows.length, mapped: features.length, unmapped: rows.length - features.length },
  };
}

function toSeries(rows) {
  return rows.map(r => ({
    id: r.id, name: r.name, status: r.status,
    drop: r.drop, baseline: r.baseline, current: r.current,
    delta: r.delta, score: r.score, since: r.since, category: r.category,
  }));
}

function toCSV(rows) {
  const lines = ['id,name,category,region,status,severity,weight,score,drop,baseline,current,delta,since,notes,lat,lng'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const r of rows) {
    lines.push([r.id, r.name, r.category, r.region, r.status, r.severity, r.weight, r.score, r.drop, r.baseline, r.current, r.delta, r.since, r.notes, r.lat, r.lng].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function alertsToCSV(rows) {
  const lines = ['id,name,status,drop,severity,score,since,notes'];
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const r of rows) {
    lines.push([r.id, r.name, r.status, r.drop, r.severity, r.score, r.since, r.notes].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function toReport(rows, stats) {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push('  SILENCE REPORT — Crucix');
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Всего регионов: ${rows.length}`);
  lines.push(`Silence: ${stats.by_status.silence}  Warning: ${stats.by_status.warning}  Normal: ${stats.by_status.normal}`);
  lines.push('');
  if (stats.drop) {
    lines.push(`Drop — min: ${stats.drop.min}%  max: ${stats.drop.max}%  mean: ${stats.drop.mean}%  median: ${stats.drop.median}%  stddev: ${stats.drop.stddev}%`);
  }
  lines.push('');
  lines.push(`Baseline total: ${stats.totals.baseline}  Current total: ${stats.totals.current}  Delta: ${stats.totals.delta} (${stats.totals.delta_pct}%)`);
  lines.push('');
  lines.push('TOP-10 по drop:');
  for (const r of rows.slice().sort((a, b) => (b.drop ?? 0) - (a.drop ?? 0)).slice(0, 10)) {
    lines.push(`  ${String(r.drop).padStart(5)}%  ${r.status.padEnd(8)}  ${r.name}`);
  }
  lines.push('');
  lines.push('='.repeat(60));
  return lines.join('\n');
}

function toRenderConfig(rows) {
  const markers = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      id: r.id, lat: r.lat, lng: r.lng,
      color: r.statusColor,
      radius: r.status === 'silence' ? 14 : (r.status === 'warning' ? 10 : 6),
      icon: r.icon,
      properties: {
        name: r.name, status: r.status, statusLabel: r.statusLabel,
        drop: r.drop, baseline: r.baseline, current: r.current, score: r.score,
        since: r.since, notes: r.notes,
      },
    }));
  return {
    markers,
    legend: Object.entries(STATUS_META).filter(([k]) => k !== 'unknown').map(([key, def]) => ({
      key, color: def.color, label: def.label, min: def.min, max: def.max,
    })),
    filterable: ['status', 'category', 'min_drop', 'max_drop', 'min_baseline', 'since', 'until', 'sort'],
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/silence/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const extra = {
      'X-Module': 'silence-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
      'Access-Control-Allow-Origin': '*',
    };

    // ---- Не-basket эндпоинты ----

    if (sub === '/builtin') {
      const rows = BUILTIN_REGIONS.map(normalizeRegion);
      const fc = toFeatureCollection(rows);
      return sendJSON(res, 200, {
        type: 'FeatureCollection',
        features: fc.features,
        legend: fc.legend,
        series: toSeries(rows),
        stats: computeStats(rows),
        meta: { source: 'builtin', count: rows.length, generated_at: new Date().toISOString() },
      }, extra);
    }

    if (sub === '/config') {
      return sendJSON(res, 200, {
        statuses: Object.entries(STATUS_META).map(([k, v]) => ({ key: k, ...v })),
        categories: Object.entries(CATEGORY_COLORS).map(([k, color]) => ({ key: k, color })),
        weights: WEIGHTS,
        filter_presets: FILTER_PRESETS,
        cache_ttl_ms: CACHE_TTL,
      }, extra);
    }

    if (sub === '/weights') {
      return sendJSON(res, 200, { weights: WEIGHTS }, extra);
    }

    if (sub === '/filter-presets') {
      return sendJSON(res, 200, { presets: FILTER_PRESETS, count: FILTER_PRESETS.length }, extra);
    }

    // ---- Basket-зависимые эндпоинты ----

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

    const { regions: rawArr, source, meta: srcMeta, snapshots } = extractRegions(doc);
    const all = rawArr.map(normalizeRegion);

    if (sub === '/health') {
      return sendJSON(res, 200, {
        status: 'online',
        basket_available: true,
        regions: all.length,
        snapshots: snapshots.length,
        cache_size: _cache.size,
        generated_at: new Date().toISOString(),
      }, extra);
    }

    if (sub === '/count') {
      return sendJSON(res, 200, { counts: computeCounts(all) }, extra);
    }

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all), source, src_meta: srcMeta }, extra);
    }
    if (sub === '/status') {
      const silent = all.filter(r => r.status === 'silence').length;
      const warnings = all.filter(r => r.status === 'warning').length;
      return sendJSON(res, 200, {
        status: 'online', count: all.length, silence: silent, warnings,
        source, generated_at: new Date().toISOString(),
      }, extra);
    }
    if (sub === '/regions') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, { regions: rows, count: rows.length, total: all.length }, extra);
    }
    if (sub.startsWith('/regions/') && sub.endsWith('/history')) {
      const id = decodeURIComponent(sub.slice('/regions/'.length, -'/history'.length));
      const region = all.find(r => r.id === id);
      if (!region) return sendJSON(res, 404, { error: 'region_not_found', id }, extra);
      const history = snapshots
        .filter(s => s && s.region_id === id)
        .sort((a, b) => String(a.taken_at || '').localeCompare(String(b.taken_at || '')));
      return sendJSON(res, 200, { id, history, count: history.length }, extra);
    }
    if (sub.startsWith('/regions/')) {
      const id = decodeURIComponent(sub.slice('/regions/'.length));
      const region = all.find(r => r.id === id);
      if (!region) return sendJSON(res, 404, { error: 'region_not_found', id }, extra);
      return sendJSON(res, 200, { region }, extra);
    }
    if (sub === '/silent') {
      const rows = all.filter(r => r.status === 'silence');
      return sendJSON(res, 200, { silence: rows, count: rows.length }, extra);
    }
    if (sub === '/warnings') {
      const rows = all.filter(r => r.status === 'warning');
      return sendJSON(res, 200, { warnings: rows, count: rows.length }, extra);
    }
    if (sub === '/normal') {
      const rows = all.filter(r => r.status === 'normal');
      return sendJSON(res, 200, { normal: rows, count: rows.length }, extra);
    }
    if (sub === '/alerts') {
      const rows = all.filter(r => r.status === 'silence' || r.status === 'warning')
        .sort((a, b) => (b.severity || 0) - (a.severity || 0) || (b.drop ?? 0) - (a.drop ?? 0));
      if (format === 'csv') return sendText(res, 200, alertsToCSV(rows), 'text/csv; charset=utf-8');
      return sendJSON(res, 200, { alerts: rows, count: rows.length }, extra);
    }
    if (sub === '/critical') {
      const crit = all.filter(r => r.status === 'silence').sort((a, b) => (b.drop ?? 0) - (a.drop ?? 0));
      return sendJSON(res, 200, { critical: crit, count: crit.length }, extra);
    }
    if (sub === '/top') {
      const n = parseInt(query.n || query.top, 10) || 10;
      const rows = all.slice().sort((a, b) => (b.drop ?? 0) - (a.drop ?? 0)).slice(0, n);
      return sendJSON(res, 200, { top: rows, n }, extra);
    }
    if (sub === '/bottom') {
      const n = parseInt(query.n, 10) || 10;
      const rows = all.slice().sort((a, b) => (a.drop ?? 0) - (b.drop ?? 0)).slice(0, n);
      return sendJSON(res, 200, { bottom: rows, n }, extra);
    }
    if (sub === '/search') {
      const q = String(query.q || '').toLowerCase();
      if (!q) return sendJSON(res, 400, { error: 'field_required: q' }, extra);
      const rows = all.filter(r => (r.name + ' ' + (r.notes || '') + ' ' + (r.region || '') + ' ' + r.category).toLowerCase().includes(q));
      return sendJSON(res, 200, { query: q, results: rows, count: rows.length }, extra);
    }
    if (sub === '/anomalies') {
      const cached = cacheGet('anomalies');
      if (cached) return sendJSON(res, 200, { anomalies: cached, cached: true }, extra);
      const anomalies = computeAnomalies(all);
      cachePut('anomalies', anomalies);
      return sendJSON(res, 200, { anomalies, count: anomalies.length }, extra);
    }
    if (sub === '/recent') {
      const since = query.since || '2026-08-15';
      const rows = all.filter(r => r.since && r.since >= String(since).slice(0, 10))
        .sort((a, b) => String(b.since).localeCompare(String(a.since)));
      return sendJSON(res, 200, { recent: rows, count: rows.length, since }, extra);
    }
    if (sub === '/categories') {
      const byCategory = {};
      for (const r of all) {
        if (!byCategory[r.category]) byCategory[r.category] = { name: r.category, color: r.categoryColor, count: 0, regions: [] };
        byCategory[r.category].count++;
        byCategory[r.category].regions.push(r.id);
      }
      return sendJSON(res, 200, { categories: Object.values(byCategory), total: Object.keys(byCategory).length }, extra);
    }
    if (sub === '/severity') {
      const bySeverity = {};
      for (const r of all) {
        const key = r.status;
        if (!bySeverity[key]) bySeverity[key] = { name: key, label: r.statusLabel, color: r.statusColor, count: 0, severity: r.severity };
        bySeverity[key].count++;
      }
      return sendJSON(res, 200, { severities: Object.values(bySeverity), total: Object.keys(bySeverity).length }, extra);
    }
    if (sub === '/timeline') {
      const timeline = computeTimeline(all);
      return sendJSON(res, 200, { timeline, days: timeline.length }, extra);
    }
    if (sub === '/trends') {
      const trends = computeTrends(all);
      return sendJSON(res, 200, { trends, count: trends.length }, extra);
    }
    if (sub === '/drop-distribution') {
      const step = parseInt(query.step, 10) || 20;
      const dist = computeDropDistribution(all, step);
      return sendJSON(res, 200, { distribution: dist, step }, extra);
    }
    if (sub === '/snapshots') {
      const limited = snapshots.slice().sort((a, b) => String(b.taken_at || '').localeCompare(String(a.taken_at || ''))).slice(0, 200);
      return sendJSON(res, 200, { snapshots: limited, count: limited.length, total: snapshots.length }, extra);
    }
    if (sub === '/compare') {
      const ids = String(query.ids || '').split(',').map(s => s.trim()).filter(Boolean);
      const results = ids.map(id => all.find(r => r.id === id)).filter(Boolean);
      const diffs = [];
      for (let i = 1; i < results.length; i++) {
        const a = results[i - 1], b = results[i];
        diffs.push({
          from: a.id, to: b.id,
          drop_diff: (b.drop ?? 0) - (a.drop ?? 0),
          baseline_diff: (b.baseline ?? 0) - (a.baseline ?? 0),
          current_diff: (b.current ?? 0) - (a.current ?? 0),
        });
      }
      return sendJSON(res, 200, { count: results.length, results, diffs }, extra);
    }
    if (sub === '/bulk-compare') {
      const ids = String(query.ids || '').split(',').map(s => s.trim()).filter(Boolean);
      const results = ids.map(id => all.find(r => r.id === id)).filter(Boolean);
      const summary = {
        total: results.length,
        silence: results.filter(r => r.status === 'silence').length,
        warning: results.filter(r => r.status === 'warning').length,
        normal: results.filter(r => r.status === 'normal').length,
        avg_drop: results.length ? Number((results.reduce((s, r) => s + (r.drop ?? 0), 0) / results.length).toFixed(1)) : 0,
      };
      return sendJSON(res, 200, { results, summary }, extra);
    }
    if (sub === '/sources') {
      const bySource = {};
      for (const r of all) {
        const key = r.source || 'unknown';
        bySource[key] = (bySource[key] || 0) + 1;
      }
      const sources = Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
      return sendJSON(res, 200, { sources, total: sources.length }, extra);
    }
    if (sub === '/latest') {
      const latest = all.slice().filter(r => r.since).sort((a, b) => String(b.since).localeCompare(String(a.since))).slice(0, 20);
      return sendJSON(res, 200, { latest, count: latest.length }, extra);
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
    if (format === 'alerts') return sendText(res, 200, alertsToCSV(rows.filter(r => r.status !== 'normal')), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, source, src_meta: srcMeta }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source,
        category: meta.category,
        unit: meta.unit,
        total_regions: all.length,
        returned_regions: rows.length,
        upstream_source: source,
        upstream_meta: srcMeta,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      legend: fc.legend,
      series: toSeries(rows),
      stats: computeStats(rows),
      trends: computeTrends(rows).slice(0, 10),
      alerts: rows.filter(r => r.status !== 'normal').slice(0, 10),
      anomalies: computeAnomalies(rows).slice(0, 5),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
