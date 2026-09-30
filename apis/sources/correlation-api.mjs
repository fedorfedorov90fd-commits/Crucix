/**
 * apis/sources/correlation-api.mjs — SERVICE-МОДУЛЬ: КРОСС-КОРРЕЛЯЦИОННЫЙ АНАЛИЗ
 *
 * КОНТРАКТ CRUCIX v2 (Service, мультиметодный).
 * ИСТОЧНИК: 8 временных рядов из корзины и служебных папок:
 *   index      → data/geo/index-history.json
 *   news       → data/raw/*.json (ежедневные снимки RSS)
 *   basket     → data/basket/*.json (агрегированные новости)
 *   events     → data/analysis/events-cache.json
 *   thermal    → data/thermal/history.json
 *   economy    → data/economy/history.json
 *   aviation   → data/aviation/history.json
 *   conflicts  → data/conflicts/history.json
 *
 * Кросс-корреляционный анализатор между источниками времени (Пирсон + лаги):
 *   - Pearson r между любой парой источников.
 *   - Оптимальный лаг (-14..+14 дней) — кто кого опережает.
 *   - Полная матрица корреляций (8×8).
 *   - Поиск аномальных корреляций (порог |r| >= threshold).
 *   - In-memory кэш матрицы (TTL 5 мин).
 *
 * МУЛЬТИМЕТОДНЫЙ SERVICE:
 *   - GET  /                    — корень (список эндпоинтов + версия)
 *   - GET  /status              — health-check + статус 8 источников
 *   - GET  /health              — расширенный health (проверка всех файлов)
 *   - GET  /config              — конфиг (источники, лимиты, TTL)
 *   - GET  /sources             — список источников
 *   - GET  /sources/:id         — детали конкретного источника
 *   - GET  /calculate           — корреляция двух источников (?source1=&source2=&days=)
 *   - GET  /matrix              — матрица 8×8 (?days=)
 *   - GET  /anomalies           — аномальные корреляции (?threshold=0.7&days=30)
 *   - GET  /summary             — топ-5 сильнейших корреляций
 *   - GET  /export              — экспорт матрицы (json/csv/text)
 *   - GET  /history             — история пересчётов (до 50)
 *   - GET  /stats               — статистика сервиса
 *   - POST /recompute           — принудительный пересчёт матрицы (сохраняет в кэш)
 *   - POST /reset-cache         — сброс кэша
 *   - POST /reset-stats         — сброс статистики
 *
 * ФОРМАТЫ: json, csv, text, raw.
 * ФИЛЬТРЫ: ?days=, ?threshold=, ?source1=, ?source2=, ?since=, ?until=, ?format=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

export const route   = '/api/services/correlation';
export const methods = ['GET', 'POST'];

export const meta = {
  service: true,
  description: 'Кросс-корреляционный анализатор 8 временных рядов: Pearson r, лаги, матрица 8×8, аномалии',
  cache: 0,
  version: '2.0.0',
};

// ============================================================
//  КОНФИГ
// ============================================================

const CONFIG = {
  defaultDays: 30,
  minCommonDates: 3,
  maxLag: 14,             // диапазон лага -14..+14 (было -7..+7)
  defaultThreshold: 0.7,
  cacheTTL: 5 * 60 * 1000, // 5 минут
  maxHistoryEntries: 50,
  maxSourceFiles: 500,    // защита от больших папок
};

// ============================================================
//  СПРАВОЧНИК 8 ИСТОЧНИКОВ
// ============================================================

const SOURCES = {
  index: {
    id: 'index',
    name: 'Глобальный индекс',
    icon: '📊',
    description: 'Глобальный индекс напряжённости',
    files: [join(PROJECT_ROOT, 'data', 'geo', 'index-history.json')],
    parse: (data) => {
      if (!Array.isArray(data)) return [];
      return data.map(item => ({
        date: item.date || String(item.timestamp || '').slice(0, 10) || '',
        value: parseFloat(item.value ?? item.index ?? 0),
      })).filter(x => x.date && Number.isFinite(x.value));
    },
  },

  news: {
    id: 'news',
    name: 'Новости (RSS)',
    icon: '📰',
    description: 'Новости из RSS-лент (ежедневные снимки в data/raw/)',
    files: () => join(PROJECT_ROOT, 'data', 'raw'),
    parse: (data) => {
      let items = Array.isArray(data) ? data : [];
      if (!Array.isArray(items) && typeof items === 'object') {
        for (const key of ['items', 'news', 'feeds', 'articles', 'data']) {
          if (Array.isArray(items[key])) { items = items[key]; break; }
        }
      }
      if (!Array.isArray(items)) return [];
      const daily = {};
      for (const item of items) {
        let date = '';
        for (const f of ['pubDate', 'date', 'collectedAt']) {
          if (!item[f]) continue;
          const d = new Date(item[f]);
          if (!isNaN(d.getTime())) { date = d.toISOString().slice(0, 10); break; }
        }
        if (date) daily[date] = (daily[date] || 0) + 1;
      }
      return Object.entries(daily).map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
  },

  basket: {
    id: 'basket',
    name: 'Новости (корзина)',
    icon: '📦',
    description: 'Новости из корзины данных',
    files: () => join(PROJECT_ROOT, 'data', 'basket'),
    parse: (data) => {
      let items = Array.isArray(data) ? data : [];
      if (!Array.isArray(items) && typeof items === 'object') {
        for (const key of ['items', 'news', 'data']) {
          if (Array.isArray(items[key])) { items = items[key]; break; }
        }
      }
      if (!Array.isArray(items)) return [];
      const daily = {};
      for (const item of items) {
        let date = '';
        for (const f of ['date', 'collectedAt', 'timestamp']) {
          if (!item[f]) continue;
          const d = new Date(item[f]);
          if (!isNaN(d.getTime())) { date = d.toISOString().slice(0, 10); break; }
        }
        if (date) daily[date] = (daily[date] || 0) + 1;
      }
      return Object.entries(daily).map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
  },

  events: {
    id: 'events',
    name: 'События',
    icon: '📌',
    description: 'События с корреляцией (data/analysis/events-cache.json)',
    files: [join(PROJECT_ROOT, 'data', 'analysis', 'events-cache.json')],
    parse: (data) => {
      let events = [];
      if (Array.isArray(data)) events = data;
      else if (data && Array.isArray(data.events)) events = data.events;
      else if (data && Array.isArray(data.data)) events = data.data;
      const daily = {};
      for (const ev of events) {
        if (!ev || !ev.date) continue;
        const d = new Date(ev.date);
        if (isNaN(d.getTime())) continue;
        const date = d.toISOString().slice(0, 10);
        const value = parseFloat(ev.correlation ?? ev.impact ?? 1) || 1;
        daily[date] = (daily[date] || 0) + value;
      }
      return Object.entries(daily).map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
  },

  thermal: {
    id: 'thermal',
    name: 'Термальные (FIRMS)',
    icon: '🔥',
    description: 'Термальные аномалии из FIRMS',
    files: [join(PROJECT_ROOT, 'data', 'thermal', 'history.json')],
    parse: (data) => {
      if (!Array.isArray(data)) return [];
      return data.map(item => ({
        date: item.date || String(item.timestamp || '').slice(0, 10) || '',
        value: parseFloat(item.value ?? item.detections ?? 0),
      })).filter(x => x.date && Number.isFinite(x.value));
    },
  },

  economy: {
    id: 'economy',
    name: 'Экономика (FRED)',
    icon: '💰',
    description: 'Экономические показатели из FRED',
    files: [join(PROJECT_ROOT, 'data', 'economy', 'history.json')],
    parse: (data) => {
      if (!Array.isArray(data)) return [];
      return data.map(item => ({
        date: item.date || String(item.timestamp || '').slice(0, 10) || '',
        value: parseFloat(item.value ?? item.index ?? 0),
      })).filter(x => x.date && Number.isFinite(x.value));
    },
  },

  aviation: {
    id: 'aviation',
    name: 'Авиация (OpenSky)',
    icon: '✈️',
    description: 'Данные авиационного трафика',
    files: [join(PROJECT_ROOT, 'data', 'aviation', 'history.json')],
    parse: (data) => {
      if (!Array.isArray(data)) return [];
      return data.map(item => ({
        date: item.date || String(item.timestamp || '').slice(0, 10) || '',
        value: parseFloat(item.value ?? item.flights ?? 0),
      })).filter(x => x.date && Number.isFinite(x.value));
    },
  },

  conflicts: {
    id: 'conflicts',
    name: 'Конфликты (ACLED)',
    icon: '⚔️',
    description: 'Данные о конфликтах из ACLED',
    files: [join(PROJECT_ROOT, 'data', 'conflicts', 'history.json')],
    parse: (data) => {
      if (!Array.isArray(data)) return [];
      return data.map(item => ({
        date: item.date || String(item.timestamp || '').slice(0, 10) || '',
        value: parseFloat(item.value ?? item.events ?? 0),
      })).filter(x => x.date && Number.isFinite(x.value));
    },
  },
};

// ============================================================
//  IN-MEMORY КЭШ И СТАТИСТИКА
// ============================================================

let _matrixCache = null;      // { data, computedAt, days }
let _history = [];            // последние 50 пересчётов
let _stats = {
  startedAt: Date.now(),
  calculateRequests: 0,
  matrixRequests: 0,
  anomaliesRequests: 0,
  recomputes: 0,
  cacheHits: 0,
  cacheMisses: 0,
  totalMatrixMs: 0,
};

// ============================================================
//  ЗАГРУЗКА ИСТОЧНИКОВ
// ============================================================

async function loadSourceData(sourceId) {
  const source = SOURCES[sourceId];
  if (!source) return [];

  let fileList = [];
  const filesConfig = source.files;

  if (typeof filesConfig === 'function') {
    const dir = filesConfig();
    if (typeof dir === 'string') {
      try {
        const entries = await fs.readdir(dir);
        fileList = entries
          .filter(f => f.endsWith('.json'))
          .sort()
          .slice(0, CONFIG.maxSourceFiles)
          .map(f => join(dir, f));
      } catch (e) {
        if (e.code !== 'ENOENT') console.warn(`[correlation] ${sourceId} dir error:`, e.message);
        return [];
      }
    } else if (Array.isArray(dir)) {
      fileList = dir;
    }
  } else if (Array.isArray(filesConfig)) {
    fileList = filesConfig;
  }

  const allData = [];
  for (const file of fileList) {
    try {
      const stat = await fs.stat(file);
      if (stat.isDirectory()) continue;
      const content = await fs.readFile(file, 'utf-8');
      const data = JSON.parse(content);
      let parsed = source.parse(data);
      if (!Array.isArray(parsed) && parsed && typeof parsed === 'object') {
        for (const key of ['items', 'news', 'events', 'data', 'feeds', 'results']) {
          if (Array.isArray(parsed[key])) { parsed = parsed[key]; break; }
        }
      }
      if (Array.isArray(parsed) && parsed.length > 0) {
        allData.push(...parsed.filter(x => x.date));
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.warn(`[correlation] ${sourceId} load ${file} error:`, e.message);
      }
    }
  }

  const aggregated = {};
  for (const item of allData) {
    if (!item.date) continue;
    aggregated[item.date] = (aggregated[item.date] || 0) + (item.value || 0);
  }

  return Object.entries(aggregated)
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================
//  МАТЕМАТИКА — ПИРСОН, ЛАГИ, МАТРИЦА
// ============================================================

function calculateCorrelation(x, y) {
  const n = x.length;
  if (n !== y.length || n === 0) return 0;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return 0;
  return num / Math.sqrt(denX * denY);
}

function findOptimalLag(x, y, maxLag = CONFIG.maxLag) {
  const results = [];
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let xShifted, yShifted;
    if (lag >= 0) {
      xShifted = x.slice(lag);
      yShifted = y.slice(0, y.length - lag);
    } else {
      xShifted = x.slice(0, x.length + lag);
      yShifted = y.slice(-lag);
    }
    if (xShifted.length < 3) continue;
    const corr = calculateCorrelation(xShifted, yShifted);
    results.push({ lag, correlation: Math.round(corr * 10000) / 10000 });
  }
  if (!results.length) return { bestLag: 0, bestCorrelation: 0, all: [] };
  const best = results.reduce((a, b) => Math.abs(a.correlation) > Math.abs(b.correlation) ? a : b);
  return {
    bestLag: best.lag,
    bestCorrelation: Math.round(best.correlation * 10000) / 10000,
    all: results,
  };
}

function interpretCorrelation(corr, lag) {
  const strength = Math.abs(corr);
  let label = 'Очень слабая';
  if (strength >= 0.8) label = 'Очень сильная';
  else if (strength >= 0.6) label = 'Сильная';
  else if (strength >= 0.4) label = 'Средняя';
  else if (strength >= 0.2) label = 'Слабая';
  const direction = corr > 0 ? 'прямая' : 'обратная';
  let lagText = '(без задержки)';
  if (lag > 0) lagText = `(${lag} дн. назад)`;
  else if (lag < 0) lagText = `(на ${Math.abs(lag)} дн. вперёд)`;
  return `${label} ${direction} корреляция ${lagText}`;
}

function roundCorr(v) {
  return Math.round(v * 10000) / 10000;
}

// ============================================================
//  АНАЛИЗ ПАРЫ
// ============================================================

async function analyzeCorrelation(source1, source2, days = CONFIG.defaultDays, opts = {}) {
  const data1 = await loadSourceData(source1);
  const data2 = await loadSourceData(source2);

  if (!data1.length) return { error: `Нет данных для источника: ${source1}` };
  if (!data2.length) return { error: `Нет данных для источника: ${source2}` };

  const map1 = Object.fromEntries(data1.map(d => [d.date, d.value]));
  const map2 = Object.fromEntries(data2.map(d => [d.date, d.value]));

  let commonDates = data1.map(d => d.date).filter(d => map2[d] !== undefined);
  if (opts.since) commonDates = commonDates.filter(d => d >= String(opts.since).slice(0, 10));
  if (opts.until) commonDates = commonDates.filter(d => d <= String(opts.until).slice(0, 10));
  commonDates = commonDates.slice(-days);

  if (commonDates.length < CONFIG.minCommonDates) {
    return { error: `Недостаточно общих точек (${commonDates.length}, нужно ${CONFIG.minCommonDates})` };
  }

  const values1 = commonDates.map(d => map1[d] || 0);
  const values2 = commonDates.map(d => map2[d] || 0);
  const corr = calculateCorrelation(values1, values2);
  const lagResult = findOptimalLag(values1, values2);

  return {
    source1, source2,
    source1Name: SOURCES[source1]?.name || source1,
    source2Name: SOURCES[source2]?.name || source2,
    days: commonDates.length,
    dates: commonDates,
    values1: values1.map(v => Math.round(v * 100) / 100),
    values2: values2.map(v => Math.round(v * 100) / 100),
    correlation: roundCorr(corr),
    optimalLag: lagResult.bestLag,
    optimalCorrelation: lagResult.bestCorrelation,
    allLags: lagResult.all,
    interpretation: interpretCorrelation(corr, lagResult.bestLag),
    dataPoints: commonDates.length,
  };
}

// ============================================================
//  МАТРИЦА 8×8
// ============================================================

async function getCorrelationMatrix(days = CONFIG.defaultDays, opts = {}) {
  const ids = Object.keys(SOURCES);
  const matrix = {};
  const results = [];

  // Сначала загружаем все данные по одному разу
  const dataById = {};
  for (const id of ids) {
    dataById[id] = await loadSourceData(id);
  }

  // Для каждой пары строим свои commonDates
  for (let i = 0; i < ids.length; i++) {
    const s1 = ids[i];
    matrix[s1] = {};
    for (let j = 0; j < ids.length; j++) {
      const s2 = ids[j];
      if (i === j) { matrix[s1][s2] = 1; continue; }
      if (matrix[s2] && matrix[s2][s1] !== undefined) { matrix[s1][s2] = matrix[s2][s1]; continue; }

      const d1 = dataById[s1];
      const d2 = dataById[s2];
      if (!d1.length || !d2.length) { matrix[s1][s2] = 0; continue; }

      const m1 = Object.fromEntries(d1.map(x => [x.date, x.value]));
      const m2 = Object.fromEntries(d2.map(x => [x.date, x.value]));
      let common = d1.map(x => x.date).filter(d => m2[d] !== undefined);
      if (opts.since) common = common.filter(d => d >= String(opts.since).slice(0, 10));
      if (opts.until) common = common.filter(d => d <= String(opts.until).slice(0, 10));
      common = common.slice(-days);

      if (common.length < CONFIG.minCommonDates) { matrix[s1][s2] = 0; continue; }

      const v1 = common.map(d => m1[d] || 0);
      const v2 = common.map(d => m2[d] || 0);
      const c = calculateCorrelation(v1, v2);
      matrix[s1][s2] = roundCorr(c);
      results.push({
        source1: s1, source2: s2,
        source1Name: SOURCES[s1].name, source2Name: SOURCES[s2].name,
        correlation: roundCorr(c),
        interpretation: interpretCorrelation(c, 0),
        dataPoints: common.length,
      });
    }
  }

  results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  return { matrix, results, sources: ids };
}

// ============================================================
//  АНОМАЛЬНЫЕ КОРРЕЛЯЦИИ
// ============================================================

async function findAnomalousCorrelations(threshold = CONFIG.defaultThreshold, days = CONFIG.defaultDays, opts = {}) {
  const { results } = await getCorrelationMatrix(days, opts);
  return results.filter(r => Math.abs(r.correlation) >= threshold && r.correlation !== 0);
}

// ============================================================
//  КЭШ МАТРИЦЫ
// ============================================================

async function getCachedMatrix(days, opts, force = false) {
  const now = Date.now();
  const sameCache = _matrixCache &&
    _matrixCache.days === days &&
    (now - _matrixCache.computedAt) < CONFIG.cacheTTL &&
    !opts.since && !opts.until;

  if (!force && sameCache) {
    _stats.cacheHits++;
    return { ..._matrixCache.data, cached: true, cachedAt: _matrixCache.computedAt };
  }

  _stats.cacheMisses++;
  const started = Date.now();
  const data = await getCorrelationMatrix(days, opts);
  const durationMs = Date.now() - started;
  _stats.totalMatrixMs += durationMs;

  if (!opts.since && !opts.until) {
    _matrixCache = { data, computedAt: now, days };
  }

  return { ...data, cached: false, computedAt: now, durationMs };
}

// ============================================================
//  ОТВЕТЫ
// ============================================================

function sendJSON(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
    ...extraHeaders,
  });
  res.end(body);
}

function sendText(res, status, text, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text)) });
  res.end(text);
}

function matrixToCSV(matrix, sourceIds) {
  const esc = (v) => (v == null ? '' : String(v).replace(/"/g, '""'));
  const header = ['source', ...sourceIds].map(esc).join(',');
  const lines = [header];
  for (const s1 of sourceIds) {
    const row = [s1];
    for (const s2 of sourceIds) row.push(matrix[s1][s2]);
    lines.push(row.map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function matrixToText(matrix, sourceIds, results) {
  const lines = [];
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('  CORRELATION MATRIX');
  lines.push(`  ${new Date().toISOString()}`);
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`Источников: ${sourceIds.length}`);
  lines.push('');
  lines.push('Матрица:');
  const head = ['source', ...sourceIds.map(s => s.slice(0, 6).padStart(7))].join(' ');
  lines.push(head);
  for (const s1 of sourceIds) {
    const row = [s1.padEnd(6), ...sourceIds.map(s => String(matrix[s1][s] ?? 0).padStart(7))].join(' ');
    lines.push(row);
  }
  lines.push('');
  lines.push(`ТОП-10 корреляций (|r|):`);
  for (const r of results.slice(0, 10)) {
    lines.push(`  ${String(r.correlation).padStart(7)}  ${r.source1Name} ↔ ${r.source2Name}`);
  }
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');
  return lines.join('\n');
}

function historyEntry(kind, payload) {
  const entry = { kind, at: new Date().toISOString(), ...payload };
  _history.unshift(entry);
  if (_history.length > CONFIG.maxHistoryEntries) _history = _history.slice(0, CONFIG.maxHistoryEntries);
  return entry;
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const sub = urlObj.pathname.replace(/^\/api\/services\/correlation/, '') || '/';
  const query = Object.fromEntries(urlObj.searchParams.entries());
  const format = (query.format || 'json').toLowerCase();

  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const extra = {
    'X-Service': 'correlation',
    'X-Service-Version': meta.version,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  };

  try {
    // ============================================================
    //  GET
    // ============================================================

    if (req.method === 'GET') {
      if (sub === '/' || sub === '') {
        return sendJSON(res, 200, { service: 'correlation', endpoint: '/', data: {
          version: meta.version,
          endpoints: ['/', '/status', '/health', '/config', '/sources', '/sources/:id',
                      '/calculate', '/matrix', '/anomalies', '/summary', '/export', '/history', '/stats'],
          methods,
        }}, extra);
      }
      if (sub === '/status') {
        const status = {};
        for (const [id, src] of Object.entries(SOURCES)) {
          const data = await loadSourceData(id);
          status[id] = {
            name: src.name, icon: src.icon,
            count: data.length,
            firstDate: data.length ? data[0].date : null,
            lastDate: data.length ? data[data.length - 1].date : null,
          };
        }
        return sendJSON(res, 200, { service: 'correlation', endpoint: '/status', data: { status, sources: Object.keys(SOURCES).length }}, extra);
      }
      if (sub === '/health') {
        const status = {};
        let totalFiles = 0;
        for (const id of Object.keys(SOURCES)) {
          const data = await loadSourceData(id);
          status[id] = { count: data.length, ok: data.length > 0 };
          totalFiles += data.length;
        }
        const ok = Object.values(status).some(s => s.ok);
        return sendJSON(res, ok ? 200 : 503, { service: 'correlation', endpoint: '/health', data: {
          ok, sources: status, total_points: totalFiles, cache_age_ms: _matrixCache ? Date.now() - _matrixCache.computedAt : null,
        }}, extra);
      }
      if (sub === '/config') {
        return sendJSON(res, 200, { service: 'correlation', endpoint: '/config', data: {
          default_days: CONFIG.defaultDays,
          min_common_dates: CONFIG.minCommonDates,
          max_lag: CONFIG.maxLag,
          default_threshold: CONFIG.defaultThreshold,
          cache_ttl_ms: CONFIG.cacheTTL,
          sources: Object.values(SOURCES).map(s => ({ id: s.id, name: s.name, icon: s.icon, description: s.description })),
        }}, extra);
      }
      if (sub === '/sources') {
        const sources = Object.values(SOURCES).map(s => ({ id: s.id, name: s.name, icon: s.icon, description: s.description }));
        return sendJSON(res, 200, { service: 'correlation', endpoint: '/sources', data: { sources, total: sources.length }}, extra);
      }
      if (sub.startsWith('/sources/')) {
        const id = decodeURIComponent(sub.slice('/sources/'.length));
        const src = SOURCES[id];
        if (!src) return sendJSON(res, 404, { error: 'source_not_found', id }, extra);
        const data = await loadSourceData(id);
        return sendJSON(res, 200, { service: 'correlation', endpoint: sub, data: {
          id, name: src.name, icon: src.icon, description: src.description,
          points: data.length, first: data[0] || null, last: data[data.length - 1] || null, series: data,
        }}, extra);
      }
      if (sub === '/calculate') {
        _stats.calculateRequests++;
        const source1 = query.source1 || 'index';
        const source2 = query.source2 || 'news';
        const days = parseInt(query.days, 10) || CONFIG.defaultDays;
        const opts = { since: query.since, until: query.until };
        const result = await analyzeCorrelation(source1, source2, days, opts);
        if (result.error) return sendJSON(res, 400, { error: result.error }, extra);
        if (format === 'csv') {
          const csv = ['date,value1,value2',
            ...result.dates.map((d, i) => `${d},${result.values1[i]},${result.values2[i]}`)
          ].join('\n') + '\n';
          return sendText(res, 200, csv, 'text/csv; charset=utf-8');
        }
        return sendJSON(res, 200, { success: true, ...result }, extra);
      }
      if (sub === '/matrix') {
        _stats.matrixRequests++;
        const days = parseInt(query.days, 10) || CONFIG.defaultDays;
        const opts = { since: query.since, until: query.until };
        const result = await getCachedMatrix(days, opts);
        historyEntry('matrix', { days, cached: result.cached });
        if (format === 'csv') return sendText(res, 200, matrixToCSV(result.matrix, result.sources), 'text/csv; charset=utf-8');
        if (format === 'text') return sendText(res, 200, matrixToText(result.matrix, result.sources, result.results));
        return sendJSON(res, 200, { success: true, days, ...result }, extra);
      }
      if (sub === '/anomalies') {
        _stats.anomaliesRequests++;
        const threshold = parseFloat(query.threshold) || CONFIG.defaultThreshold;
        const days = parseInt(query.days, 10) || CONFIG.defaultDays;
        const anomalies = await findAnomalousCorrelations(threshold, days, { since: query.since, until: query.until });
        return sendJSON(res, 200, { success: true, threshold, days, count: anomalies.length, anomalies }, extra);
      }
      if (sub === '/summary') {
        const days = parseInt(query.days, 10) || CONFIG.defaultDays;
        const { results } = await getCachedMatrix(days, {});
        const top = results.slice(0, 5);
        const bottom = results.slice(-5).reverse();
        return sendJSON(res, 200, { success: true, days, top, bottom, total_pairs: results.length }, extra);
      }
      if (sub === '/export') {
        const days = parseInt(query.days, 10) || CONFIG.defaultDays;
        const { matrix, results, sources } = await getCachedMatrix(days, {});
        if (format === 'csv') return sendText(res, 200, matrixToCSV(matrix, sources), 'text/csv; charset=utf-8');
        if (format === 'text') return sendText(res, 200, matrixToText(matrix, sources, results));
        return sendJSON(res, 200, { success: true, days, matrix, results, sources }, extra);
      }
      if (sub === '/history') {
        return sendJSON(res, 200, { service: 'correlation', endpoint: '/history', data: { count: _history.length, history: _history }}, extra);
      }
      if (sub === '/stats') {
        const avgMs = _stats.matrixRequests > 0 ? Math.round(_stats.totalMatrixMs / _stats.matrixRequests) : 0;
        return sendJSON(res, 200, { service: 'correlation', endpoint: '/stats', data: {
          started_at: new Date(_stats.startedAt).toISOString(),
          uptime_s: Math.floor((Date.now() - _stats.startedAt) / 1000),
          calculate_requests: _stats.calculateRequests,
          matrix_requests: _stats.matrixRequests,
          anomalies_requests: _stats.anomaliesRequests,
          recomputes: _stats.recomputes,
          cache_hits: _stats.cacheHits,
          cache_misses: _stats.cacheMisses,
          avg_matrix_ms: avgMs,
          cache_present: !!_matrixCache,
          cache_age_ms: _matrixCache ? Date.now() - _matrixCache.computedAt : null,
        }}, extra);
      }
      return sendJSON(res, 404, { error: 'get_endpoint_not_found', path: sub }, extra);
    }

    // ============================================================
    //  POST
    // ============================================================

    if (req.method === 'POST') {
      if (sub === '/recompute') {
        const days = parseInt(query.days, 10) || CONFIG.defaultDays;
        _stats.recomputes++;
        const result = await getCachedMatrix(days, {}, true);
        historyEntry('recompute', { days, durationMs: result.durationMs });
        return sendJSON(res, 200, { success: true, days, ...result }, extra);
      }
      if (sub === '/reset-cache') {
        _matrixCache = null;
        return sendJSON(res, 200, { success: true }, extra);
      }
      if (sub === '/reset-stats') {
        _stats = { startedAt: Date.now(), calculateRequests: 0, matrixRequests: 0, anomaliesRequests: 0, recomputes: 0, cacheHits: 0, cacheMisses: 0, totalMatrixMs: 0 };
        _history = [];
        return sendJSON(res, 200, { success: true }, extra);
      }
      return sendJSON(res, 404, { error: 'post_endpoint_not_found', path: sub }, extra);
    }

    return sendJSON(res, 405, { error: 'method_not_allowed', method: req.method }, extra);

  } catch (e) {
    return sendJSON(res, 500, { error: 'service_error', message: e.message }, extra);
  }
}
