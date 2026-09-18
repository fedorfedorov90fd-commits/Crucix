/**
 * apis/sources/global-index-api.mjs — API-МОДУЛЬ: ГЛОБАЛЬНЫЙ ИНДЕКС
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК:
 *   - data/geo/index-history.json — история по дням: { entries: [ { date, value, components:{news,thermal,aviation,geopolitical,economy}, level } ] }.
 *   - data/basket/global-index.json — свежий снимок (опционально, если есть).
 * Сборщик: scripts/collectors/collect-global-index.mjs.
 *
 * Глобальный сводный индекс — агрегат состояния мира по 5 компонентам
 * (news, thermal, aviation, geopolitical, economy). Значения 0..100,
 * выше — хуже. Уровни: Нормальный / Средний / Высокий / Критический.
 *
 * ПУБЛИЧНЫЕ ЭНДПОИНТЫ:
 *   GET /                    — сводка (series + stats + FC)
 *   GET /stats               — детальная статистика
 *   GET /status              — health-check
 *   GET /latest              — последняя запись
 *   GET /history             — вся история (фильтры: since, until, level, limit, sort)
 *   GET /history/:date       — конкретный день
 *   GET /components          — среднее по компонентам
 *   GET /components/:name    — история по конкретному компоненту
 *   GET /levels              — группировка по уровням
 *   GET /trend               — тренд 7/30 vs 7/30
 *   GET /compare             — сравнение периодов
 *   GET /timeline            — динамика по дням (готово для графика)
 *   GET /anomalies           — дни с аномальными значениями (z-score)
 *   GET /summary             — человекочитаемое описание текущего состояния
 *   GET /featurecollection   — GeoJSON (глобальный индикатор, без точки)
 *   GET /render              — рендер-конфиг для UI (график + карточки)
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw, timeline.
 * ФИЛЬТРЫ: ?since=, ?until=, ?level=, ?component=, ?min=, ?max=, ?limit=, ?sort=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const HISTORY_FILE = join(PROJECT_ROOT, 'data', 'geo', 'index-history.json');
const SNAPSHOT_FILE = join(PROJECT_ROOT, 'data', 'basket', 'global-index.json');

export const route = '/api/layers/global-index';
export const method = 'GET';

export const meta = {
  category: 'index',
  icon: '🌍',
  color: '#f97316',
  vizType: 'marker',
  source: 'geo/index-history.json',
  collector: 'collect-global-index.mjs',
  cache: 300,
  description: 'Глобальный сводный индекс состояния мира (5 компонентов: news, thermal, aviation, geopolitical, economy)',
  unit: 'index',
};

// ============================================================
//  СПРАВОЧНИКИ
// ============================================================

const COMPONENT_META = {
  news:          { color: '#3b82f6', label: 'Новости' },
  thermal:       { color: '#dc2626', label: 'Тепловые аномалии' },
  aviation:      { color: '#f97316', label: 'Авиация' },
  geopolitical:  { color: '#8b5cf6', label: 'Геополитика' },
  economy:       { color: '#eab308', label: 'Экономика' },
};

const LEVEL_META = {
  'Нормальный':   { key: 'normal',   color: '#22c55e', min: 0,  max: 20 },
  'Средний':      { key: 'medium',   color: '#eab308', min: 20, max: 45 },
  'Высокий':      { key: 'high',     color: '#f97316', min: 45, max: 70 },
  'Критический':  { key: 'critical', color: '#dc2626', min: 70, max: 101 },
};

const LEVEL_LOOKUP = new Map(Object.entries(LEVEL_META));

function levelFromValue(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return { key: 'unknown', color: '#64748b', label: 'Нет данных' };
  for (const [label, def] of Object.entries(LEVEL_META)) {
    if (n >= def.min && n < def.max) return { key: def.key, color: def.color, label };
  }
  return { key: 'critical', color: '#dc2626', label: 'Критический' };
}

function levelMetaByLabel(label) {
  const m = LEVEL_LOOKUP.get(label);
  if (!m) return { key: 'unknown', color: '#64748b', label: label || 'Неизвестно' };
  return { key: m.key, color: m.color, label };
}

// ============================================================
//  ЗАГРУЗКА
// ============================================================

async function loadHistory() {
  let raw;
  try { raw = await fs.readFile(HISTORY_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-global-index.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json: ' + e.message); err.statusCode = 500; throw err; }

  let entries = [];
  if (Array.isArray(parsed)) entries = parsed;
  else if (parsed && Array.isArray(parsed.entries)) entries = parsed.entries;
  else if (parsed && Array.isArray(parsed.history)) entries = parsed.history;
  else { const err = new Error('unrecognized_history_format'); err.statusCode = 500; throw err; }

  return entries;
}

async function loadSnapshot() {
  try {
    const raw = await fs.readFile(SNAPSHOT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
}

// ============================================================
//  НОРМАЛИЗАЦИЯ
// ============================================================

function normalizeEntry(e, i) {
  const date = String(e.date || e.timestamp || '').slice(0, 10) || null;
  const value = Number(e.value ?? e.index ?? e.score);
  const rawComponents = (e.components && typeof e.components === 'object') ? e.components : {};
  const components = {};
  for (const [k, v] of Object.entries(rawComponents)) {
    const n = Number(v);
    if (Number.isFinite(n)) components[k] = n;
  }

  const declaredLevel = e.level || null;
  const level = declaredLevel ? levelMetaByLabel(declaredLevel) : levelFromValue(value);

  const compValues = Object.values(components);
  const compMean = compValues.length ? compValues.reduce((a, b) => a + b, 0) / compValues.length : null;
  const compMax = compValues.length ? Math.max(...compValues) : null;
  const compMin = compValues.length ? Math.min(...compValues) : null;

  return {
    id: `gi-${date || i}`,
    date,
    value: Number.isFinite(value) ? Number(value.toFixed(2)) : null,
    level: level.key,
    levelLabel: level.label,
    levelColor: level.color,
    components,
    component_count: Object.keys(components).length,
    component_mean: compMean != null ? Number(compMean.toFixed(2)) : null,
    component_max: compMax,
    component_min: compMin,
  };
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.since) r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  if (query.until) r = r.filter(x => !x.date || x.date <= String(query.until).slice(0, 10));
  if (query.level) r = r.filter(x => x.level === String(query.level).toLowerCase());
  if (query.component) {
    const c = String(query.component).toLowerCase();
    r = r.filter(x => x.components[c] !== undefined);
  }
  if (query.min != null) { const n = Number(query.min); if (Number.isFinite(n)) r = r.filter(x => x.value != null && x.value >= n); }
  if (query.max != null) { const n = Number(query.max); if (Number.isFinite(n)) r = r.filter(x => x.value != null && x.value <= n); }

  const sortKey = query.sort;
  if (sortKey === 'date-desc') r.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  else if (sortKey === 'date-asc') r.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  else if (sortKey === 'value-desc') r.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  else if (sortKey === 'value-asc') r.sort((a, b) => (a.value ?? Infinity) - (b.value ?? Infinity));
  else r.sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))); // по умолчанию — по дате

  if (query.top) { const n = parseInt(query.top, 10); if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(-n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(rows) {
  const values = rows.map(r => r.value).filter(Number.isFinite);
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  const byLevel = {};
  const componentSeries = {};

  for (const r of rows) {
    byLevel[r.level] = (byLevel[r.level] || 0) + 1;
    for (const [k, v] of Object.entries(r.components)) {
      if (!componentSeries[k]) componentSeries[k] = [];
      componentSeries[k].push(v);
    }
  }

  const componentMeans = {};
  for (const [k, arr] of Object.entries(componentSeries)) {
    componentMeans[k] = Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2));
  }

  if (values.length === 0) {
    return { count: rows.length, date_from: dates[0] || null, date_to: dates[dates.length - 1] || null, by_level: byLevel, component_means: componentMeans };
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  const last = rows.slice(-1)[0] || null;
  const first = rows[0] || null;
  const changeAbs = (last && first && last.value != null && first.value != null) ? Number((last.value - first.value).toFixed(2)) : null;
  const changePct = (last && first && first.value !== 0) ? Number(((last.value - first.value) / first.value * 100).toFixed(2)) : null;

  return {
    count: rows.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    stddev: Number(stddev.toFixed(2)),
    min: Number(Math.min(...values).toFixed(2)),
    max: Number(Math.max(...values).toFixed(2)),
    last_value: last?.value ?? null,
    last_date: last?.date ?? null,
    last_level: last?.level ?? null,
    last_levelLabel: last?.levelLabel ?? null,
    first_value: first?.value ?? null,
    change_abs: changeAbs,
    change_pct: changePct,
    by_level: byLevel,
    component_means: componentMeans,
  };
}

// ============================================================
//  АНАЛИТИКА
// ============================================================

function computeTrend(rows, window = 7) {
  if (rows.length < window * 2) return null;
  const tail = rows.slice(-window);
  const prev = rows.slice(-window * 2, -window);
  const mean = arr => arr.reduce((s, r) => s + (r.value ?? 0), 0) / arr.length;
  const mNew = mean(tail);
  const mOld = mean(prev);
  const delta = mOld !== 0 ? ((mNew - mOld) / mOld * 100) : null;
  return {
    window,
    samples_new: tail.length,
    samples_old: prev.length,
    mean_new: Number(mNew.toFixed(2)),
    mean_old: Number(mOld.toFixed(2)),
    delta_pct: delta != null ? Number(delta.toFixed(2)) : null,
    direction: delta == null ? 'unknown' : (delta > 5 ? 'worsening' : (delta < -5 ? 'improving' : 'stable')),
  };
}

function computeComponentsSummary(rows) {
  const acc = {};
  for (const r of rows) {
    for (const [k, v] of Object.entries(r.components)) {
      if (!acc[k]) acc[k] = { name: k, label: COMPONENT_META[k]?.label || k, color: COMPONENT_META[k]?.color || '#64748b', values: [], dates: [] };
      acc[k].values.push(v);
      acc[k].dates.push(r.date);
    }
  }
  const out = {};
  for (const [k, x] of Object.entries(acc)) {
    const mean = x.values.reduce((a, b) => a + b, 0) / x.values.length;
    const max = Math.max(...x.values);
    const min = Math.min(...x.values);
    out[k] = {
      name: k,
      label: x.label,
      color: x.color,
      count: x.values.length,
      mean: Number(mean.toFixed(2)),
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      last: x.values[x.values.length - 1],
      first: x.values[0],
    };
  }
  return out;
}

function computeAnomalies(rows, zThreshold = 2) {
  const values = rows.map(r => r.value).filter(Number.isFinite);
  if (values.length < 5) return [];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  if (stddev === 0) return [];
  return rows
    .filter(r => r.value != null)
    .map(r => ({ ...r, z: Number(((r.value - mean) / stddev).toFixed(2)) }))
    .filter(r => Math.abs(r.z) >= zThreshold)
    .map(r => ({ date: r.date, value: r.value, z: r.z, level: r.level, direction: r.z > 0 ? 'above' : 'below' }));
}

function comparePeriods(rows, daysA = 7, daysB = 30) {
  if (rows.length === 0) return null;
  const tailA = rows.slice(-daysA);
  const tailB = rows.slice(-daysB);
  const meanA = tailA.length ? tailA.reduce((s, r) => s + (r.value ?? 0), 0) / tailA.length : null;
  const meanB = tailB.length ? tailB.reduce((s, r) => s + (r.value ?? 0), 0) / tailB.length : null;
  return {
    period_a: { days: daysA, samples: tailA.length, mean: meanA != null ? Number(meanA.toFixed(2)) : null },
    period_b: { days: daysB, samples: tailB.length, mean: meanB != null ? Number(meanB.toFixed(2)) : null },
    delta: (meanA != null && meanB != null) ? Number((meanA - meanB).toFixed(2)) : null,
    delta_pct: (meanA != null && meanB != null && meanB !== 0) ? Number(((meanA - meanB) / meanB * 100).toFixed(2)) : null,
  };
}

function humanSummary(last, trend, components, stats) {
  if (!last) return { text: 'Нет данных', severity: 'unknown' };
  const t = trend?.delta_pct ?? null;
  const tText = t == null ? 'нет данных о тренде'
    : (t > 5 ? `растёт на ${t}% (ухудшение)` : (t < -5 ? `снижается на ${Math.abs(t)}% (улучшение)` : 'стабилен'));

  const comps = Object.values(components || {}).sort((a, b) => b.mean - a.mean);
  const topComp = comps.slice(0, 2).map(c => `${c.label} (${c.mean})`).join(', ');
  const lowComp = comps.slice(-1).map(c => `${c.label} (${c.mean})`).join('');

  const text = `Глобальный индекс: ${last.value} (${last.levelLabel}) на ${last.date}. `
    + `Тренд: ${tText}. `
    + (topComp ? `Ведущие компоненты: ${topComp}. ` : '')
    + (lowComp ? `Самый спокойный: ${lowComp}.` : '');

  return {
    text: text.trim(),
    severity: last.level,
    last_value: last.value,
    last_level: last.levelLabel,
    trend_pct: t,
    components_ranked: comps.map(c => ({ name: c.name, label: c.label, mean: c.mean })),
  };
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(last) {
  // Глобальный индикатор — точка на карте не нужна, но контракт требует FC.
  // Отдаём одну точку в центре мира с текущим значением.
  const features = last && last.value != null ? [{
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: {
      id: 'global-index',
      name: 'Global Index',
      date: last.date,
      value: last.value,
      level: last.level,
      levelLabel: last.levelLabel,
      color: last.levelColor,
      category: 'index',
      icon: meta.icon,
    },
  }] : [];
  return {
    type: 'FeatureCollection',
    features,
    legend: Object.entries(LEVEL_META).map(([label, def]) => ({ key: def.key, label, color: def.color, min: def.min, max: def.max })),
    meta: { total: features.length, note: 'global-index — глобальный индикатор (точка в центре мира)' },
  };
}

function toSeries(rows) {
  return rows.map(r => ({
    date: r.date,
    value: r.value,
    level: r.level,
    levelLabel: r.levelLabel,
    components: r.components,
  }));
}

function toCSV(rows) {
  const componentKeys = new Set();
  for (const r of rows) for (const k of Object.keys(r.components)) componentKeys.add(k);
  const compCols = [...componentKeys].sort();
  const header = ['date', 'value', 'level', ...compCols];
  const lines = [header.join(',')];
  const esc = v => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  for (const r of rows) {
    const row = [r.date, r.value, r.level, ...compCols.map(c => r.components[c] ?? '')];
    lines.push(row.map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function toTimeline(rows) {
  return rows.map(r => ({
    x: r.date,
    y: r.value,
    level: r.level,
    color: r.levelColor,
  }));
}

function toRenderConfig(rows) {
  const stats = computeStats(rows);
  const components = computeComponentsSummary(rows);
  return {
    type: 'composite',
    headline: stats.last_value,
    headline_label: stats.last_levelLabel,
    headline_color: rows.slice(-1)[0]?.levelColor || '#64748b',
    chart: { type: 'line', data: toTimeline(rows), x_key: 'x', y_key: 'y', color_by: 'color' },
    components: Object.values(components),
    legend: Object.entries(LEVEL_META).map(([label, def]) => ({ key: def.key, label, color: def.color })),
    stats,
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/global-index/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    // Загрузка
    let rawEntries;
    try { rawEntries = await loadHistory(); }
    catch (e) {
      const status = e.statusCode || 500;
      const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
      if (e.hint) payload.hint = e.hint;
      return sendJSON(res, status, payload);
    }

    const snapshot = await loadSnapshot();

    let all = rawEntries.map(normalizeEntry);
    // Если есть свежий снимок — добавляем его как точку, если её ещё нет
    if (snapshot && snapshot.date) {
      const snapNorm = normalizeEntry(snapshot, -1);
      if (!all.some(x => x.date === snapNorm.date)) {
        all.push(snapNorm);
      }
    }
    all.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

    const extra = {
      'X-Module': 'global-index-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    // --- Подпути ---
    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all), components: computeComponentsSummary(all) }, extra);
    }
    if (sub === '/status') {
      const last = all.slice(-1)[0] || null;
      return sendJSON(res, 200, {
        status: 'online',
        count: all.length,
        last_value: last?.value ?? null,
        last_level: last?.levelLabel ?? null,
        last_date: last?.date ?? null,
        snapshot: snapshot ? 'available' : 'missing',
        generated_at: new Date().toISOString(),
      }, extra);
    }
    if (sub === '/latest') {
      return sendJSON(res, 200, { latest: all.slice(-1)[0] || null, count: all.length }, extra);
    }
    if (sub === '/history') {
      const rows = applyFilters(all, query);
      if (format === 'csv') return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
      return sendJSON(res, 200, { history: rows, count: rows.length, total: all.length }, extra);
    }
    if (sub.startsWith('/history/')) {
      const date = decodeURIComponent(sub.slice('/history/'.length)).slice(0, 10);
      const entry = all.find(x => x.date === date);
      if (!entry) return sendJSON(res, 404, { error: 'entry_not_found', date }, extra);
      return sendJSON(res, 200, { entry }, extra);
    }
    if (sub === '/components') {
      const summary = computeComponentsSummary(all);
      return sendJSON(res, 200, { components: summary, total: Object.keys(summary).length }, extra);
    }
    if (sub.startsWith('/components/')) {
      const name = decodeURIComponent(sub.slice('/components/'.length));
      const series = all
        .filter(r => r.components[name] !== undefined)
        .map(r => ({ date: r.date, value: r.components[name], global: r.value, level: r.level }));
      if (series.length === 0) return sendJSON(res, 404, { error: 'component_not_found', name });
      const values = series.map(s => s.value);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      return sendJSON(res, 200, {
        component: name,
        meta: COMPONENT_META[name] || { label: name, color: '#64748b' },
        series,
        count: series.length,
        stats: {
          mean: Number(mean.toFixed(2)),
          min: Number(Math.min(...values).toFixed(2)),
          max: Number(Math.max(...values).toFixed(2)),
          last: values[values.length - 1],
        },
      }, extra);
    }
    if (sub === '/levels') {
      const byLevel = {};
      for (const r of all) {
        if (!byLevel[r.level]) byLevel[r.level] = { key: r.level, label: r.levelLabel, color: r.levelColor, count: 0, dates: [] };
        byLevel[r.level].count++;
        byLevel[r.level].dates.push(r.date);
      }
      return sendJSON(res, 200, { levels: Object.values(byLevel), total: Object.keys(byLevel).length }, extra);
    }
    if (sub === '/trend') {
      const window = parseInt(query.window, 10) || 7;
      const trend7 = computeTrend(all, window);
      const trend30 = computeTrend(all, 30);
      return sendJSON(res, 200, { window_7: trend7, window_30: trend30 }, extra);
    }
    if (sub === '/compare') {
      const a = parseInt(query.a, 10) || 7;
      const b = parseInt(query.b, 10) || 30;
      return sendJSON(res, 200, { compare: comparePeriods(all, a, b) }, extra);
    }
    if (sub === '/timeline') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, { timeline: toTimeline(rows), count: rows.length }, extra);
    }
    if (sub === '/anomalies') {
      const z = Number(query.z) || 2;
      const anomalies = computeAnomalies(all, z);
      return sendJSON(res, 200, { anomalies, count: anomalies.length, z_threshold: z }, extra);
    }
    if (sub === '/summary') {
      const last = all.slice(-1)[0] || null;
      const trend = computeTrend(all, 7);
      const components = computeComponentsSummary(all);
      return sendJSON(res, 200, { summary: humanSummary(last, trend, components, computeStats(all)) }, extra);
    }
    if (sub === '/featurecollection') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, toFeatureCollection(rows.slice(-1)[0]), extra);
    }
    if (sub === '/render') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, { render: toRenderConfig(rows) }, extra);
    }

    // --- Корень / сводка ---
    const rows = applyFilters(all, query);

    if (format === 'csv')      return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series')   return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'timeline') return sendJSON(res, 200, { timeline: toTimeline(rows), count: rows.length }, extra);
    if (format === 'raw')      return sendJSON(res, 200, { data: rows, total: all.length, snapshot_available: !!snapshot }, extra);

    const fc = toFeatureCollection(rows.slice(-1)[0]);
    const last = rows.slice(-1)[0] || null;
    const trend = computeTrend(rows, 7);
    const components = computeComponentsSummary(rows);

    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_records: all.length, returned_records: rows.length,
        snapshot_available: !!snapshot,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      legend: fc.legend,
      series: toSeries(rows),
      stats: computeStats(rows),
      components,
      trend,
      summary: humanSummary(last, trend, components, computeStats(rows)),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
