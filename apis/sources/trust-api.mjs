/**
 * apis/sources/trust-api.mjs — SERVICE-МОДУЛЬ: ДОВЕРИЕ К ИСТОЧНИКАМ
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE, мультиметодный).
 * ИСТОЧНИК:
 *   - data/trust/sources.json — база источников (МАССИВ, id внутри).
 *   - data/trust/history.json — история изменений (30 дней).
 *
 * ФОРМАТ ФАЙЛА:
 *   [
 *     {
 *       id: "reuters", name: "Reuters", category: "Международные",
 *       trust: 95, credibility: 95, speed: 90, objectivity: 92,
 *       authority: 98, accuracy: 95, notes: "...", enabled: true
 *     }, ...
 *   ]
 *
 * Управление доверием к медиа-источникам: рейтинги по 6 критериям
 * (trust, credibility, authority, objectivity, accuracy, speed),
 * уровни, история, аналитика топ/анти-топ, группировки.
 *
 * КРИТЕРИИ И ВЕСА:
 *   - trust         0.25
 *   - credibility   0.20
 *   - authority     0.15
 *   - objectivity   0.15
 *   - accuracy      0.15
 *   - speed         0.10
 *
 * УРОВНИ (после нормализации 0-10):
 *   - HIGH     (>=8.0) — #22c55e
 *   - MEDIUM   (>=6.0) — #eab308
 *   - LOW      (>=4.0) — #f97316
 *   - VERY_LOW (<4.0)  — #ef4444
 *
 * ПУБЛИЧНЫЕ ЭНДПОИНТЫ (21):
 *   GET    /                     — корень
 *   GET    /status               — health-check
 *   GET    /sources              — список источников
 *   GET    /sources/:id          — конкретный
 *   GET    /sources/:id/history  — история источника
 *   GET    /stats                — статистика
 *   GET    /levels               — уровни
 *   GET    /weights              — веса критериев
 *   GET    /by-type              — по типу
 *   GET    /by-category          — по русской категории
 *   GET    /by-country           — по стране
 *   GET    /by-status            — по статусу
 *   GET    /top?n=               — топ-N
 *   GET    /bottom?n=            — анти-топ
 *   GET    /history              — вся история
 *   GET    /render               — рендер-конфиг
 *   POST   /sources              — добавить
 *   POST   /update               — принудительное обновление
 *   POST   /bulk-import          — массовый импорт
 *   PUT    /sources/:id          — обновить рейтинги
 *   DELETE /sources/:id          — удалить (confirm:true)
 *
 * ФОРМАТЫ: json, csv, series, stats, raw.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadPersist, savePersist } from './lib/basket-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const TRUST_DIR = join(PROJECT_ROOT, 'data', 'trust');
const SOURCES_FILE = join(TRUST_DIR, 'sources.json');
const HISTORY_FILE = join(TRUST_DIR, 'history.json');

export const route = '/api/services/trust';
export const methods = ['GET', 'POST', 'PUT', 'DELETE'];

export const meta = {
  service: true,
  description: 'Доверие к источникам: рейтинги по 6 критериям, уровни, история, аналитика, группировки по типу/категории/стране/статусу',
  cache: 0,
  version: '3.0.0',
};

// ============================================================
//  КОНСТАНТЫ И СПРАВОЧНИКИ
// ============================================================

const MAX_BODY_BYTES = 200_000;
const MAX_SOURCES = 1000;
const HISTORY_KEEP_DAYS = 30;

const CRITERIA_WEIGHTS = {
  trust:       0.25,
  credibility: 0.20,
  authority:   0.15,
  objectivity: 0.15,
  accuracy:    0.15,
  speed:       0.10,
};

const TRUST_LEVELS = {
  HIGH:     { min: 8, color: '#22c55e', label: 'Высокое доверие' },
  MEDIUM:   { min: 6, color: '#eab308', label: 'Среднее доверие' },
  LOW:      { min: 4, color: '#f97316', label: 'Низкое доверие' },
  VERY_LOW: { min: 0, color: '#ef4444', label: 'Очень низкое доверие' },
};

const CATEGORY_META = {
  'Международные':        { type: 'international', color: '#0ea5e9', label: 'Международные' },
  'Американские':         { type: 'national',      color: '#8b5cf6', label: 'Американские' },
  'Британские':           { type: 'national',      color: '#a855f7', label: 'Британские' },
  'Европейские':          { type: 'national',      color: '#c026d3', label: 'Европейские' },
  'Российские':           { type: 'national',      color: '#dc2626', label: 'Российские' },
  'Китайские':            { type: 'national',      color: '#eab308', label: 'Китайские' },
  'Ближний Восток':       { type: 'regional',      color: '#f97316', label: 'Ближний Восток' },
  'Аналитические центры': { type: 'thinktank',     color: '#22c55e', label: 'Аналитические центры' },
};

const SOURCE_TYPES = {
  international: { color: '#0ea5e9', label: 'Международное' },
  national:      { color: '#8b5cf6', label: 'Национальное' },
  thinktank:     { color: '#22c55e', label: 'Аналитический центр' },
  regional:      { color: '#f97316', label: 'Региональное' },
  blog:          { color: '#64748b', label: 'Блог' },
  unknown:       { color: '#94a3b8', label: 'Неизвестно' },
};

// ============================================================
//  НОРМАЛИЗАЦИЯ ИСТОЧНИКА
// ============================================================

/**
 * Приводит запись источника к единой форме.
 * Источники рейтингов — приоритет:
 *   1. input.ratings (вложенный объект)
 *   2. input.initialRatings (вложенный объект)
 *   3. Плоские поля input.trust / credibility / authority / objectivity / accuracy / speed
 *
 * Поддержка двух шкал:
 *   - 0-100 (реальный формат файла)
 *   - 0-10  (мой исходный формат)
 * Значения из диапазона 0-10 умножаются на 10.
 */
function normalizeSource(input, fallbackKey) {
  const id = String(input.id || fallbackKey || '').trim();
  if (!id) return null;

  let type = input.type || 'unknown';
  if (input.category && CATEGORY_META[input.category]) {
    type = CATEGORY_META[input.category].type;
  }

  // Определяем источник рейтингов
  let rawRatings;
  if (input.ratings && typeof input.ratings === 'object') {
    rawRatings = input.ratings;
  } else if (input.initialRatings && typeof input.initialRatings === 'object') {
    rawRatings = input.initialRatings;
  } else {
    rawRatings = {
      trust:       input.trust,
      credibility: input.credibility,
      objectivity: input.objectivity,
      authority:   input.authority,
      accuracy:    input.accuracy,
      speed:       input.speed,
    };
  }

  // Нормализуем каждое поле: 0-10 → 0-100, клипуем в 0-100
  const normalizeValue = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 50;
    const scaled = n <= 10 ? n * 10 : n;
    return Math.max(0, Math.min(100, scaled));
  };

  const ratings = {
    trust:       normalizeValue(rawRatings.trust),
    credibility: normalizeValue(rawRatings.credibility),
    objectivity: normalizeValue(rawRatings.objectivity),
    authority:   normalizeValue(rawRatings.authority),
    accuracy:    normalizeValue(rawRatings.accuracy),
    speed:       normalizeValue(rawRatings.speed),
  };

  return {
    id,
    name: String(input.name || id),
    url: input.url || '',
    type,
    category: input.category || null,
    status: input.status || (input.enabled === false ? 'disabled' : 'unknown'),
    country: input.country || 'Unknown',
    language: input.language || 'en',
    notes: input.notes || null,
    enabled: input.enabled !== false,
    ratings,
    addedAt: input.addedAt || null,
    updatedAt: input.updatedAt || null,
  };
}

// ============================================================
//  УТИЛИТЫ
// ============================================================

function readBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', c => {
      total += c.length;
      if (total > maxBytes) { req.destroy(); reject(new Error('body_too_large')); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8');
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('invalid_json_body: ' + e.message)); }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(body)), ...extra });
  res.end(body);
}

function sendText(res, status, text, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text, 'utf8')) });
  res.end(text);
}

/**
 * Общая оценка в шкале 0-10 (для уровней HIGH/MEDIUM/LOW/VERY_LOW).
 * Принимает ratings со значениями 0-100.
 */
function calculateOverall(ratings) {
  if (!ratings) return 0;
  let weighted = 0;
  for (const [key, weight] of Object.entries(CRITERIA_WEIGHTS)) {
    const v = Number(ratings[key]);
    weighted += (Number.isFinite(v) ? v : 50) * weight;
  }
  return Math.round(weighted) / 10;
}

function getTrustLevel(overall0to10) {
  if (overall0to10 >= 8) return 'HIGH';
  if (overall0to10 >= 6) return 'MEDIUM';
  if (overall0to10 >= 4) return 'LOW';
  return 'VERY_LOW';
}

/**
 * Обогащает источник вычисляемыми полями.
 * ИСПРАВЛЕНИЕ v3: fallback на initialRatings.
 */
function enrichSource(source) {
  const ratings = source.ratings || source.initialRatings || {};
  const overall = calculateOverall(ratings);
  const level = getTrustLevel(overall);
  const levelMeta = TRUST_LEVELS[level];
  const typeMeta = SOURCE_TYPES[source.type] || SOURCE_TYPES.unknown;
  return {
    ...source,
    trust:       ratings.trust       ?? null,
    credibility: ratings.credibility ?? null,
    speed:       ratings.speed       ?? null,
    objectivity: ratings.objectivity ?? null,
    authority:   ratings.authority   ?? null,
    accuracy:    ratings.accuracy    ?? null,
    overall,
    level,
    levelLabel: levelMeta.label,
    levelColor: levelMeta.color,
    typeLabel: typeMeta.label,
    typeColor: typeMeta.color,
  };
}

// ============================================================
//  ЗАГРУЗКА / СОХРАНЕНИЕ
// ============================================================

async function ensureDir() {
  try { await fs.mkdir(TRUST_DIR, { recursive: true }); } catch {}
}

async function loadSources() {
  await ensureDir();

  let raw;
  try { raw = await fs.readFile(SOURCES_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') return { sources: {}, source: 'missing' };
    throw e;
  }

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { throw new Error('invalid_sources_json: ' + e.message); }

  // МАССИВ → объект по id
  const asObject = {};
  if (Array.isArray(parsed)) {
    for (let i = 0; i < parsed.length; i++) {
      const norm = normalizeSource(parsed[i], `auto-${i}`);
      if (norm) asObject[norm.id] = norm;
    }
  } else if (parsed && typeof parsed === 'object') {
    for (const [key, val] of Object.entries(parsed)) {
      const norm = normalizeSource(val, key);
      if (norm) asObject[norm.id] = norm;
    }
  }

  return { sources: asObject, source: 'file' };
}

async function saveSources(sources) {
  // Обратно сохраняем как МАССИВ (для совместимости с файлом)
  const arr = Object.values(sources).map(s => ({
    id: s.id,
    name: s.name,
    category: s.category || null,
    trust: s.ratings?.trust ?? null,
    credibility: s.ratings?.credibility ?? null,
    speed: s.ratings?.speed ?? null,
    objectivity: s.ratings?.objectivity ?? null,
    authority: s.ratings?.authority ?? null,
    accuracy: s.ratings?.accuracy ?? null,
    notes: s.notes || null,
    enabled: s.enabled !== false,
    url: s.url || '',
    type: s.type || 'unknown',
    status: s.status || 'unknown',
    country: s.country || 'Unknown',
    language: s.language || 'en',
  }));
  return savePersist({ persistFile: SOURCES_FILE, data: arr });
}

async function loadHistory() {
  await ensureDir();
  const result = await loadPersist({ persistFile: HISTORY_FILE, defaults: { history: [] } });
  const data = result.data || {};
  return Array.isArray(data.history) ? data.history : [];
}

async function saveHistory(history) {
  const cutoff = Date.now() - HISTORY_KEEP_DAYS * 86400000;
  const filtered = history.filter(h => {
    const t = new Date(h.date).getTime();
    return Number.isFinite(t) && t > cutoff;
  });
  return savePersist({ persistFile: HISTORY_FILE, data: { history: filtered, updated_at: new Date().toISOString() } });
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(sources) {
  const byLevel = { HIGH: 0, MEDIUM: 0, LOW: 0, VERY_LOW: 0 };
  const byType = {};
  const byCategory = {};
  const byCountry = {};
  let totalScore = 0;
  let count = 0;

  for (const s of Object.values(sources)) {
    const enriched = enrichSource(s);
    byLevel[enriched.level] = (byLevel[enriched.level] || 0) + 1;
    byType[enriched.type] = (byType[enriched.type] || 0) + 1;
    if (enriched.category) byCategory[enriched.category] = (byCategory[enriched.category] || 0) + 1;
    byCountry[enriched.country] = (byCountry[enriched.country] || 0) + 1;
    totalScore += enriched.overall;
    count++;
  }

  const top = (obj, n = 15) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));

  return {
    total: count,
    avgTrust: count > 0 ? Math.round((totalScore / count) * 10) / 10 : 0,
    byLevel,
    byType,
    byCategory,
    topCountries: top(byCountry, 15),
    topTypes: top(byType, 10),
    topCategories: top(byCategory, 10),
    lastUpdate: new Date().toISOString(),
  };
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toCSV(sources) {
  const lines = ['id,name,category,type,trust,credibility,speed,objectivity,authority,accuracy,overall,level'];
  const esc = v => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  for (const s of sources) {
    lines.push([s.id, s.name, s.category, s.type, s.trust, s.credibility, s.speed, s.objectivity, s.authority, s.accuracy, s.overall, s.level].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function toSeries(sources) {
  return sources.map(s => ({
    id: s.id, name: s.name, category: s.category, type: s.type,
    overall: s.overall, level: s.level,
    trust: s.trust, credibility: s.credibility,
  }));
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  const extra = {
    'X-Service': 'trust',
    'X-Service-Version': meta.version,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/services\/trust/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      res.end();
      return;
    }

    let loaded;
    try { loaded = await loadSources(); }
    catch (e) { return sendJSON(res, 500, { success: false, error: 'load_error', message: e.message }, extra); }
    const { sources, source: dataSource } = loaded;

    // ============================================================
    //  GET
    // ============================================================
    if (req.method === 'GET') {

      if (sub === '/status') {
        const stats = computeStats(sources);
        return sendJSON(res, 200, {
          success: true, service: 'trust', status: 'online',
          totalSources: stats.total, avgTrust: stats.avgTrust,
          distribution: stats.byLevel, dataSource,
          timestamp: new Date().toISOString(),
        }, extra);
      }

      if (sub === '/' || sub === '') {
        const stats = computeStats(sources);
        return sendJSON(res, 200, {
          service: 'trust', version: meta.version, description: meta.description,
          total_sources: stats.total, avg_trust: stats.avgTrust,
          distribution: stats.byLevel,
          criteria_weights: CRITERIA_WEIGHTS, levels: TRUST_LEVELS,
          endpoints: {
            'GET /status': 'health-check',
            'GET /sources': 'список источников',
            'GET /sources/:id': 'конкретный',
            'GET /sources/:id/history': 'история',
            'GET /stats': 'статистика',
            'GET /levels': 'уровни',
            'GET /weights': 'веса критериев',
            'GET /by-type': 'по типу',
            'GET /by-category': 'по категории (RU)',
            'GET /by-country': 'по стране',
            'GET /by-status': 'по статусу',
            'GET /top?n=': 'топ-N',
            'GET /bottom?n=': 'анти-топ',
            'GET /history': 'вся история',
            'GET /render': 'рендер-конфиг',
            'POST /sources': 'добавить',
            'POST /update': 'обновить все',
            'POST /bulk-import': 'массовый импорт',
            'PUT /sources/:id': 'обновить рейтинги',
            'DELETE /sources/:id': 'удалить (confirm:true)',
          },
        }, extra);
      }

      if (sub === '/sources') {
        let list = Object.values(sources).map(enrichSource);
        if (query.type)     list = list.filter(s => s.type === query.type);
        if (query.category) list = list.filter(s => s.category === query.category);
        if (query.country)  list = list.filter(s => String(s.country).toLowerCase() === String(query.country).toLowerCase());
        if (query.status)   list = list.filter(s => s.status === query.status);
        if (query.level)    list = list.filter(s => s.level === query.level);
        if (query.q) { const q = String(query.q).toLowerCase(); list = list.filter(s => (s.name + ' ' + s.id).toLowerCase().includes(q)); }

        const sortKey = query.sort || 'overall-desc';
        if (sortKey === 'overall-desc') list.sort((a, b) => b.overall - a.overall);
        else if (sortKey === 'overall-asc') list.sort((a, b) => a.overall - b.overall);
        else if (sortKey === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
        else if (sortKey === 'trust') list.sort((a, b) => (b.trust ?? 0) - (a.trust ?? 0));

        if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) list = list.slice(0, n); }

        if (format === 'csv') return sendText(res, 200, toCSV(list), 'text/csv; charset=utf-8');
        if (format === 'series') return sendJSON(res, 200, { series: toSeries(list), count: list.length }, extra);
        if (format === 'raw') return sendJSON(res, 200, { data: list, total: list.length }, extra);

        return sendJSON(res, 200, {
          success: true, sources: list, total: list.length,
          total_all: Object.keys(sources).length, dataSource,
          timestamp: new Date().toISOString(),
        }, extra);
      }

      // /sources/:id/history — проверяем ДО /sources/:id
      if (sub.startsWith('/sources/') && sub.endsWith('/history')) {
        const id = decodeURIComponent(sub.slice('/sources/'.length, -'/history'.length));
        const history = await loadHistory();
        const filtered = history.filter(h => h.sourceId === id).sort((a, b) => String(a.date).localeCompare(String(b.date)));
        return sendJSON(res, 200, { success: true, sourceId: id, count: filtered.length, history: filtered }, extra);
      }

      if (sub.startsWith('/sources/')) {
        const id = decodeURIComponent(sub.slice('/sources/'.length));
        const source = sources[id];
        if (!source) return sendJSON(res, 404, { success: false, error: 'source_not_found', id, available_ids: Object.keys(sources).slice(0, 10) }, extra);
        return sendJSON(res, 200, { success: true, source: enrichSource(source) }, extra);
      }

      if (sub === '/stats' || format === 'stats') {
        return sendJSON(res, 200, { success: true, stats: computeStats(sources) }, extra);
      }

      if (sub === '/levels') {
        return sendJSON(res, 200, {
          success: true,
          levels: Object.entries(TRUST_LEVELS).map(([key, meta]) => ({ key, ...meta })),
          total: Object.keys(TRUST_LEVELS).length,
        }, extra);
      }

      if (sub === '/weights') {
        return sendJSON(res, 200, { success: true, weights: CRITERIA_WEIGHTS }, extra);
      }

      if (sub === '/by-type') {
        const byType = {};
        for (const s of Object.values(sources)) {
          const enriched = enrichSource(s);
          const t = enriched.type || 'unknown';
          if (!byType[t]) byType[t] = { type: t, label: SOURCE_TYPES[t]?.label || t, color: SOURCE_TYPES[t]?.color || '#64748b', count: 0, sources: [] };
          byType[t].count++;
          byType[t].sources.push({ id: enriched.id, name: enriched.name, overall: enriched.overall, level: enriched.level });
        }
        return sendJSON(res, 200, { success: true, types: Object.values(byType), total: Object.keys(byType).length }, extra);
      }

      if (sub === '/by-category') {
        const byCat = {};
        for (const s of Object.values(sources)) {
          const enriched = enrichSource(s);
          const c = enriched.category || 'Uncategorized';
          if (!byCat[c]) byCat[c] = { category: c, count: 0, sources: [] };
          byCat[c].count++;
          byCat[c].sources.push({ id: enriched.id, name: enriched.name, overall: enriched.overall, level: enriched.level });
        }
        return sendJSON(res, 200, { success: true, categories: Object.values(byCat), total: Object.keys(byCat).length }, extra);
      }

      if (sub === '/by-country') {
        const byCountry = {};
        for (const s of Object.values(sources)) {
          const enriched = enrichSource(s);
          const c = enriched.country || 'Unknown';
          if (!byCountry[c]) byCountry[c] = { country: c, count: 0, avgTrust: 0, totalScore: 0, sources: [] };
          byCountry[c].count++;
          byCountry[c].totalScore += enriched.overall;
          byCountry[c].sources.push({ id: enriched.id, name: enriched.name, overall: enriched.overall, level: enriched.level });
        }
        for (const c of Object.values(byCountry)) {
          c.avgTrust = c.count > 0 ? Math.round((c.totalScore / c.count) * 10) / 10 : 0;
          delete c.totalScore;
        }
        const list = Object.values(byCountry).sort((a, b) => b.count - a.count);
        return sendJSON(res, 200, { success: true, countries: list, total: list.length }, extra);
      }

      if (sub === '/by-status') {
        const byStatus = {};
        for (const s of Object.values(sources)) {
          const enriched = enrichSource(s);
          const st = enriched.status || 'unknown';
          if (!byStatus[st]) byStatus[st] = { status: st, count: 0, sources: [] };
          byStatus[st].count++;
          byStatus[st].sources.push({ id: enriched.id, name: enriched.name, overall: enriched.overall, level: enriched.level });
        }
        return sendJSON(res, 200, { success: true, statuses: Object.values(byStatus), total: Object.keys(byStatus).length }, extra);
      }

      if (sub === '/top') {
        const n = Math.min(parseInt(query.n, 10) || 10, 50);
        const list = Object.values(sources).map(enrichSource).sort((a, b) => b.overall - a.overall).slice(0, n);
        return sendJSON(res, 200, { success: true, top: list, n, count: list.length }, extra);
      }

      if (sub === '/bottom') {
        const n = Math.min(parseInt(query.n, 10) || 10, 50);
        const list = Object.values(sources).map(enrichSource).sort((a, b) => a.overall - b.overall).slice(0, n);
        return sendJSON(res, 200, { success: true, bottom: list, n, count: list.length }, extra);
      }

      if (sub === '/history') {
        const history = await loadHistory();
        const filtered = history.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 100);
        return sendJSON(res, 200, { success: true, count: filtered.length, total: history.length, history: filtered }, extra);
      }

      if (sub === '/render') {
        const list = Object.values(sources).map(enrichSource);
        return sendJSON(res, 200, {
          render: {
            type: 'table',
            columns: ['name', 'category', 'type', 'overall', 'level'],
            sources: list,
            stats: computeStats(sources),
            levels: TRUST_LEVELS,
          },
        }, extra);
      }

      return sendJSON(res, 404, {
        success: false, error: 'endpoint_not_found', path: sub,
        available: ['/', '/status', '/sources', '/sources/:id', '/sources/:id/history', '/stats', '/levels', '/weights', '/by-type', '/by-category', '/by-country', '/by-status', '/top', '/bottom', '/history', '/render'],
      }, extra);
    }

    // ============================================================
    //  POST
    // ============================================================
    if (req.method === 'POST') {
      let body;
      try { body = await readBody(req); }
      catch (e) { return sendJSON(res, 400, { success: false, error: 'invalid_body', message: e.message }, extra); }

      if (sub === '/sources') {
        const id = String(body.id || '').trim();
        if (!id) return sendJSON(res, 400, { success: false, error: 'field_required: id' }, extra);
        if (!body.name) return sendJSON(res, 400, { success: false, error: 'field_required: name' }, extra);
        if (sources[id]) return sendJSON(res, 409, { success: false, error: 'source_exists', id }, extra);
        if (Object.keys(sources).length >= MAX_SOURCES) return sendJSON(res, 409, { success: false, error: 'limit_reached', max: MAX_SOURCES }, extra);

        const norm = normalizeSource({
          id, name: body.name, category: body.category, type: body.type,
          trust: body.trust, credibility: body.credibility, speed: body.speed,
          objectivity: body.objectivity, authority: body.authority, accuracy: body.accuracy,
          notes: body.notes, enabled: body.enabled, url: body.url,
          country: body.country, language: body.language,
          addedAt: new Date().toISOString(),
        });

        sources[id] = norm;
        const saved = await saveSources(sources);
        if (!saved.ok) return sendJSON(res, 500, { success: false, error: 'save_failed', detail: saved.error }, extra);

        return sendJSON(res, 200, { success: true, source: enrichSource(norm), total: Object.keys(sources).length }, extra);
      }

      if (sub === '/update') {
        const history = await loadHistory();
        let updated = 0;
        for (const [id, s] of Object.entries(sources)) {
          history.push({
            sourceId: id,
            date: new Date().toISOString(),
            ratings: { ...(s.ratings || {}) },
            overall: calculateOverall(s.ratings),
          });
          updated++;
        }
        const savedS = await saveSources(sources);
        const savedH = await saveHistory(history);
        if (!savedS.ok || !savedH.ok) return sendJSON(res, 500, { success: false, error: 'save_failed' }, extra);
        return sendJSON(res, 200, { success: true, updated, timestamp: new Date().toISOString() }, extra);
      }

      if (sub === '/bulk-import') {
        const items = Array.isArray(body.sources) ? body.sources : [];
        if (items.length === 0) return sendJSON(res, 400, { success: false, error: 'field_required: sources[]' }, extra);
        const added = [], skipped = [];
        for (const item of items) {
          if (Object.keys(sources).length >= MAX_SOURCES) break;
          const id = String(item.id || '').trim();
          if (!id || !item.name) { skipped.push({ id, reason: 'invalid' }); continue; }
          if (sources[id]) { skipped.push({ id, reason: 'exists' }); continue; }
          const norm = normalizeSource({ ...item, addedAt: new Date().toISOString() });
          if (norm) { sources[norm.id] = norm; added.push(norm.id); }
        }
        const saved = await saveSources(sources);
        if (!saved.ok) return sendJSON(res, 500, { success: false, error: 'save_failed' }, extra);
        return sendJSON(res, 200, { success: true, added: added.length, skipped: skipped.length, added_ids: added, skipped_items: skipped, total: Object.keys(sources).length }, extra);
      }

      return sendJSON(res, 404, { success: false, error: 'post_endpoint_not_found', path: sub, available: ['/sources', '/update', '/bulk-import'] }, extra);
    }

    // ============================================================
    //  PUT
    // ============================================================
    if (req.method === 'PUT') {
      if (sub.startsWith('/sources/')) {
        const id = decodeURIComponent(sub.slice('/sources/'.length));
        const source = sources[id];
        if (!source) return sendJSON(res, 404, { success: false, error: 'source_not_found', id }, extra);

        let body;
        try { body = await readBody(req); }
        catch (e) { return sendJSON(res, 400, { success: false, error: 'invalid_body', message: e.message }, extra); }

        const ratingsInput = body.ratings || body;
        if (!ratingsInput || typeof ratingsInput !== 'object') {
          return sendJSON(res, 400, { success: false, error: 'field_required: ratings' }, extra);
        }

        const history = await loadHistory();
        history.push({
          sourceId: id, date: new Date().toISOString(),
          ratings: { ...(source.ratings || {}) },
          overall: calculateOverall(source.ratings),
        });

        const normalizeValue = (v, fallback) => {
          const n = Number(v);
          if (!Number.isFinite(n)) return fallback;
          const scaled = n <= 10 ? n * 10 : n;
          return Math.max(0, Math.min(100, scaled));
        };

        const merged = {
          trust:       normalizeValue(ratingsInput.trust,       source.ratings.trust       ?? 50),
          credibility: normalizeValue(ratingsInput.credibility, source.ratings.credibility ?? 50),
          objectivity: normalizeValue(ratingsInput.objectivity, source.ratings.objectivity ?? 50),
          authority:   normalizeValue(ratingsInput.authority,   source.ratings.authority   ?? 50),
          accuracy:    normalizeValue(ratingsInput.accuracy,    source.ratings.accuracy    ?? 50),
          speed:       normalizeValue(ratingsInput.speed,       source.ratings.speed       ?? 50),
        };

        source.ratings = merged;
        source.updatedAt = new Date().toISOString();

        const savedS = await saveSources(sources);
        const savedH = await saveHistory(history);
        if (!savedS.ok || !savedH.ok) return sendJSON(res, 500, { success: false, error: 'save_failed' }, extra);

        return sendJSON(res, 200, { success: true, source: enrichSource(source) }, extra);
      }

      return sendJSON(res, 404, { success: false, error: 'put_endpoint_not_found', path: sub, available: ['/sources/:id'] }, extra);
    }

    // ============================================================
    //  DELETE
    // ============================================================
    if (req.method === 'DELETE') {
      if (sub.startsWith('/sources/')) {
        let body;
        try { body = await readBody(req); } catch { body = {}; }
        if (body.confirm !== true) {
          return sendJSON(res, 400, {
            success: false, error: 'confirmation_required',
            hint: 'send DELETE /api/services/trust/sources/:id with body {"confirm": true}',
          }, extra);
        }
        const id = decodeURIComponent(sub.slice('/sources/'.length));
        if (!sources[id]) return sendJSON(res, 404, { success: false, error: 'source_not_found', id }, extra);
        const removed = sources[id];
        delete sources[id];
        const saved = await saveSources(sources);
        if (!saved.ok) return sendJSON(res, 500, { success: false, error: 'save_failed' }, extra);
        return sendJSON(res, 200, { success: true, removed: { id: removed.id, name: removed.name }, total: Object.keys(sources).length }, extra);
      }

      return sendJSON(res, 404, { success: false, error: 'delete_endpoint_not_found', path: sub, available: ['/sources/:id'] }, extra);
    }

    return sendJSON(res, 405, { success: false, error: 'method_not_allowed', allowed: methods }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { success: false, error: status === 400 ? 'bad_request' : 'handler_error', message: e.message };
    try { sendJSON(res, status, payload, extra); } catch {}
  }
}
