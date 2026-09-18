/**
 * apis/sources/live-api.mjs — API-МОДУЛЬ: ЛЕНТА ЖИВЫХ НОВОСТНЫХ ПОТОКОВ
 *
 * КОНТРАКТ CRUCIX v2 (Layer, read-only).
 * ИСТОЧНИК:
 *   - data/basket/live.json — корзина (основной источник).
 *   - DEMO_NEWS (встроенный, 12 записей) — fallback.
 * Сборщик: scripts/collectors/collect-live.mjs.
 *
 * Лента живых новостных потоков: геополитика, экономика, военные,
 * технологии, экология, здоровье, кибербезопасность.
 * Фильтрация по категории, региону, важности, поиск по тексту.
 *
 * CQRS-РАЗДЕЛЕНИЕ:
 *   Этот модуль — READ-модель (только GET).
 *   WRITE-модель (избранное, toggle) — в /api/services/favorites.
 *   Фронтенд ходит в два места, независимо.
 *
 * ПУБЛИЧНЫЕ ЭНДПОИНТЫ:
 *   GET /                      — сводка (feed + stats)
 *   GET /status                — health-check
 *   GET /feed                  — лента новостей
 *   GET /latest                — последние N записей
 *   GET /categories            — список категорий
 *   GET /regions               — список регионов
 *   GET /sources               — список источников
 *   GET /importance            — группировка по важности
 *   GET /sentiment             — группировка по тональности
 *   GET /stats                 — расширенная статистика
 *   GET /search?q=             — полнотекстовый поиск
 *   GET /timeline              — динамика по часам
 *   GET /featurecollection     — GeoJSON
 *   GET /render                — рендер-конфиг для UI
 *
 * ФОРМАТЫ: json (feed + stats), csv, series, stats, raw, timeline, featurecollection.
 * ФИЛЬТРЫ: ?category=, ?region=, ?importance=, ?sentiment=, ?source=, ?q=, ?since=, ?limit=, ?top=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadWithFallback } from './lib/basket-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE = join(PROJECT_ROOT, 'data', 'basket', 'live.json');

export const route  = '/api/layers/live';
export const method = 'GET';

export const meta = {
  category: 'news',
  icon: '📡',
  color: '#5bc0f8',
  vizType: 'marker',
  source: 'basket/live.json',
  collector: 'collect-live.mjs',
  cache: 30,
  description: 'Лента живых новостных потоков: геополитика, экономика, военные, технологии, экология, здоровье, кибер',
  unit: 'news',
};

// ============================================================
//  ВСТРОЕННЫЙ FALLBACK
// ============================================================

const DEMO_NEWS = [
  { id: 'live-001', title: 'Иран нанёс ракетные удары по военным объектам Израиля', category: 'geopolitics', region: 'Ближний Восток', importance: 'critical', sentiment: -0.85, source: 'Reuters', time: '5 мин назад' },
  { id: 'live-002', title: 'США ввели новые санкции против Ирана', category: 'geopolitics', region: 'США', importance: 'high', sentiment: -0.65, source: 'AP', time: '15 мин назад' },
  { id: 'live-003', title: 'ЕС одобрил новый пакет помощи Украине на 50 млрд евро', category: 'politics', region: 'Европа', importance: 'high', sentiment: 0.45, source: 'Euronews', time: '32 мин назад' },
  { id: 'live-004', title: 'Нефть Brent превысила $110 за баррель', category: 'economy', region: 'Мир', importance: 'high', sentiment: -0.55, source: 'Bloomberg', time: '47 мин назад' },
  { id: 'live-005', title: 'Золото обновило исторический максимум — $2150 за унцию', category: 'economy', region: 'Мир', importance: 'medium', sentiment: 0.35, source: 'CNBC', time: '1 час назад' },
  { id: 'live-006', title: 'Байден подписал закон о бюджете на 2026 год', category: 'politics', region: 'США', importance: 'medium', sentiment: 0.25, source: 'NYT', time: '1.5 часа назад' },
  { id: 'live-007', title: 'Китай запустил новый спутник для мониторинга океана', category: 'technology', region: 'Китай', importance: 'low', sentiment: 0.65, source: 'Xinhua', time: '2 часа назад' },
  { id: 'live-008', title: 'Россия заявила о готовности к переговорам по Украине', category: 'diplomacy', region: 'Россия', importance: 'high', sentiment: 0.15, source: 'TASS', time: '2.5 часа назад' },
  { id: 'live-009', title: 'Землетрясение магнитудой 6.2 в Индонезии', category: 'disaster', region: 'Азия', importance: 'high', sentiment: -0.75, source: 'USGS', time: '3 часа назад' },
  { id: 'live-010', title: 'Индия стала третьей экономикой мира', category: 'economy', region: 'Индия', importance: 'medium', sentiment: 0.75, source: 'Times of India', time: '4 часа назад' },
  { id: 'live-011', title: 'ФРС сохранила ключевую ставку на уровне 5.5%', category: 'economy', region: 'США', importance: 'critical', sentiment: -0.35, source: 'WSJ', time: '5 часов назад' },
  { id: 'live-012', title: 'Европа готовится к зиме без российского газа', category: 'energy', region: 'Европа', importance: 'high', sentiment: -0.45, source: 'BBC', time: '6 часов назад' },
];

// ============================================================
//  СПРАВОЧНИКИ
// ============================================================

const IMPORTANCE_META = {
  critical: { color: '#f44336', weight: 4, label: 'Критический' },
  high:     { color: '#f26522', weight: 3, label: 'Высокий' },
  medium:   { color: '#ffd700', weight: 2, label: 'Средний' },
  low:      { color: '#4caf50', weight: 1, label: 'Низкий' },
  unknown:  { color: '#64748b', weight: 0, label: 'Неизвестно' },
};

const CATEGORY_META = {
  geopolitics: { color: '#dc2626', label: 'Геополитика', icon: '🌍' },
  politics:    { color: '#8b5cf6', label: 'Политика', icon: '🏛️' },
  economy:     { color: '#eab308', label: 'Экономика', icon: '💰' },
  military:    { color: '#7c2d12', label: 'Военные', icon: '⚔️' },
  technology:  { color: '#0ea5e9', label: 'Технологии', icon: '💻' },
  environment: { color: '#16a34a', label: 'Экология', icon: '🌿' },
  health:      { color: '#ec4899', label: 'Здоровье', icon: '🏥' },
  cyber:       { color: '#0891b2', label: 'Кибер', icon: '🛡️' },
  energy:      { color: '#f97316', label: 'Энергия', icon: '⚡' },
  diplomacy:   { color: '#22c55e', label: 'Дипломатия', icon: '🤝' },
  disaster:    { color: '#7f1d1d', label: 'Катастрофы', icon: '🚨' },
  other:       { color: '#64748b', label: 'Прочее', icon: '📰' },
};

function importanceOf(v) {
  const k = String(v || '').toLowerCase();
  return IMPORTANCE_META[k] || IMPORTANCE_META.unknown;
}

function categoryOf(v) {
  const k = String(v || '').toLowerCase();
  return CATEGORY_META[k] || CATEGORY_META.other;
}

function sentimentLabel(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return { label: 'neutral', emoji: '😐', color: '#64748b' };
  if (n >= 0.3) return { label: 'positive', emoji: '😊', color: '#22c55e' };
  if (n <= -0.3) return { label: 'negative', emoji: '😟', color: '#dc2626' };
  return { label: 'neutral', emoji: '😐', color: '#94a3b8' };
}

// ============================================================
//  ЗАГРУЗКА
// ============================================================

async function loadNews() {
  const result = await loadWithFallback({
    basketFile: BASKET_FILE,
    fallbackData: DEMO_NEWS,
    hint: 'запустите scripts/collectors/collect-live.mjs',
  });

  let arr = result.data;
  if (!Array.isArray(arr)) {
    if (arr && Array.isArray(arr.news)) arr = arr.news;
    else if (arr && Array.isArray(arr.items)) arr = arr.items;
    else if (arr && Array.isArray(arr.data)) arr = arr.data;
    else arr = [];
  }
  return { arr, source: result.source, hint: result.hint, error: result.error };
}

// ============================================================
//  НОРМАЛИЗАЦИЯ
// ============================================================

function normalizeItem(n, i) {
  const importance = importanceOf(n.importance);
  const category = categoryOf(n.category);
  const sentiment = sentimentLabel(n.sentiment);

  let timestamp = n.timestamp || n.published || n.date || null;
  let iso = null;
  if (timestamp) {
    const t = new Date(timestamp);
    if (!Number.isNaN(t.getTime())) iso = t.toISOString();
  } else if (n.time) {
    const m = String(n.time).match(/(\d+)\s*(мин|час|дн)/);
    if (m) {
      const num = parseInt(m[1], 10);
      const unit = m[2];
      const ms = unit === 'мин' ? num * 60_000 : unit === 'час' ? num * 3_600_000 : num * 86_400_000;
      iso = new Date(Date.now() - ms).toISOString();
    }
  }

  return {
    id: String(n.id || `live-${String(i).padStart(3, '0')}`),
    title: n.title || 'Без заголовка',
    summary: n.summary || n.description || null,
    url: n.url || n.link || null,
    category: String(n.category || 'other').toLowerCase(),
    categoryLabel: category.label,
    categoryColor: category.color,
    categoryIcon: category.icon,
    region: n.region || null,
    source: n.source || 'Unknown',
    importance: String(n.importance || 'unknown').toLowerCase(),
    importanceLabel: importance.label,
    importanceColor: importance.color,
    importanceWeight: importance.weight,
    sentiment: sentiment.label,
    sentimentScore: Number.isFinite(Number(n.sentiment)) ? Number(n.sentiment) : null,
    sentimentEmoji: sentiment.emoji,
    sentimentColor: sentiment.color,
    timestamp: iso,
    time: n.time || null,
    lat: Number.isFinite(Number(n.lat)) ? Number(n.lat) : null,
    lng: Number.isFinite(Number(n.lng ?? n.lon)) ? Number(n.lng ?? n.lon) : null,
    category_meta: 'news',
    icon: meta.icon,
  };
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(items, query) {
  let r = items.slice();
  if (query.category && query.category !== 'all') {
    const c = String(query.category).toLowerCase();
    r = r.filter(x => x.category === c);
  }
  if (query.region && query.region !== 'all') {
    const rg = String(query.region).toLowerCase();
    r = r.filter(x => String(x.region || '').toLowerCase().includes(rg));
  }
  if (query.importance && query.importance !== 'all') {
    r = r.filter(x => x.importance === String(query.importance).toLowerCase());
  }
  if (query.sentiment) r = r.filter(x => x.sentiment === String(query.sentiment).toLowerCase());
  if (query.source)    r = r.filter(x => String(x.source).toLowerCase().includes(String(query.source).toLowerCase()));
  if (query.q) {
    const s = String(query.q).toLowerCase();
    r = r.filter(x => (x.title + ' ' + (x.summary || '')).toLowerCase().includes(s));
  }
  if (query.since) {
    const t = new Date(query.since).getTime();
    if (Number.isFinite(t)) r = r.filter(x => !x.timestamp || new Date(x.timestamp).getTime() >= t);
  }
  if (query.until) {
    const t = new Date(query.until).getTime();
    if (Number.isFinite(t)) r = r.filter(x => !x.timestamp || new Date(x.timestamp).getTime() <= t);
  }

  const sortKey = query.sort;
  if (sortKey === 'importance') r.sort((a, b) => b.importanceWeight - a.importanceWeight);
  else if (sortKey === 'time-desc') r.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  else if (sortKey === 'time-asc')  r.sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));
  else if (sortKey === 'sentiment-desc') r.sort((a, b) => (b.sentimentScore ?? 0) - (a.sentimentScore ?? 0));
  else if (sortKey === 'sentiment-asc')  r.sort((a, b) => (a.sentimentScore ?? 0) - (b.sentimentScore ?? 0));

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(items) {
  const byImportance = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  const byCategory = {};
  const byRegion = {};
  const bySource = {};
  const bySentiment = { positive: 0, neutral: 0, negative: 0 };

  for (const n of items) {
    byImportance[n.importance] = (byImportance[n.importance] || 0) + 1;
    byCategory[n.category] = (byCategory[n.category] || 0) + 1;
    if (n.region) byRegion[n.region] = (byRegion[n.region] || 0) + 1;
    if (n.source) bySource[n.source] = (bySource[n.source] || 0) + 1;
    bySentiment[n.sentiment] = (bySentiment[n.sentiment] || 0) + 1;
  }

  const top = (obj, limit = 10) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, count]) => ({ name, count }));

  return {
    total: items.length,
    byImportance,
    byCategory,
    bySentiment,
    byRegion,
    topSources: top(bySource, 15),
    topRegions: top(byRegion, 10),
  };
}

function computeTimeline(items) {
  const byHour = {};
  for (const n of items) {
    if (!n.timestamp) continue;
    const d = new Date(n.timestamp);
    const hour = d.toISOString().slice(0, 13) + ':00';
    if (!byHour[hour]) byHour[hour] = { hour, count: 0, byImportance: {} };
    byHour[hour].count++;
    byHour[hour].byImportance[n.importance] = (byHour[hour].byImportance[n.importance] || 0) + 1;
  }
  return Object.values(byHour).sort((a, b) => a.hour.localeCompare(b.hour));
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(items) {
  const features = items
    .filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lng))
    .map(x => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [x.lng, x.lat] },
      properties: {
        id: x.id, title: x.title, category: x.category, region: x.region,
        source: x.source, importance: x.importance, sentiment: x.sentiment,
        timestamp: x.timestamp, url: x.url,
        color: x.importanceColor, icon: x.categoryIcon,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    legend: {
      importance: Object.entries(IMPORTANCE_META).map(([key, def]) => ({ key, ...def })),
      categories: Object.entries(CATEGORY_META).map(([key, def]) => ({ key, ...def })),
    },
    meta: { total: items.length, mapped: features.length },
  };
}

function toSeries(items) {
  return items.map(x => ({
    id: x.id, title: x.title, category: x.category, region: x.region,
    source: x.source, importance: x.importance, sentiment: x.sentiment,
    timestamp: x.timestamp,
  }));
}

function toCSV(items) {
  const lines = ['id,title,category,region,source,importance,sentiment,timestamp,url'];
  const esc = v => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  for (const n of items) {
    lines.push([n.id, n.title, n.category, n.region, n.source, n.importance, n.sentiment, n.timestamp, n.url].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
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
  const extra = {
    'X-Module': 'live-api',
    'X-Module-Version': '2.0.0',
    'Cache-Control': `public, max-age=${meta.cache}`,
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/live/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      res.end();
      return;
    }

    // Загрузка данных внутри try — линтер видит try/catch рядом
    let newsData;
    try {
      newsData = await loadNews();
    } catch (e) {
      const status = e.statusCode || 500;
      return sendJSON(res, status, {
        success: false,
        error: status === 503 ? 'no_data' : 'data_load_error',
        message: e.message,
        hint: e.hint || null,
      }, extra);
    }

    const { arr: raw, source: dataSource, hint } = newsData;
    const all = raw.map(normalizeItem);

    // ============================================================
    //  /status
    // ============================================================
    if (sub === '/status') {
      return sendJSON(res, 200, {
        success: true,
        module: 'live',
        status: 'online',
        newsCount: all.length,
        dataSource,
        hint: dataSource === 'fallback' ? hint : null,
        timestamp: new Date().toISOString(),
      }, extra);
    }

    // ============================================================
    //  /feed, /, ''
    // ============================================================
    if (sub === '/feed' || sub === '/' || sub === '') {
      const rows = applyFilters(all, query);

      if (format === 'csv') return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
      if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
      if (format === 'raw') return sendJSON(res, 200, { data: rows, source: dataSource, total: all.length }, extra);
      if (format === 'featurecollection') return sendJSON(res, 200, toFeatureCollection(rows), extra);

      return sendJSON(res, 200, {
        success: true,
        news: rows,
        feed: rows,
        count: rows.length,
        total: all.length,
        stats: computeStats(rows),
        source: dataSource,
        hint: dataSource === 'fallback' ? hint : null,
      }, extra);
    }

    // ============================================================
    //  /latest
    // ============================================================
    if (sub === '/latest') {
      const n = parseInt(query.n, 10) || 20;
      const sorted = all.slice().sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
      return sendJSON(res, 200, { latest: sorted.slice(0, n), count: Math.min(n, all.length) }, extra);
    }

    // ============================================================
    //  /categories
    // ============================================================
    if (sub === '/categories') {
      const set = new Set(all.map(n => n.category));
      const list = [...set].map(c => ({
        id: c,
        label: (CATEGORY_META[c] || CATEGORY_META.other).label,
        icon: (CATEGORY_META[c] || CATEGORY_META.other).icon,
        color: (CATEGORY_META[c] || CATEGORY_META.other).color,
        count: all.filter(n => n.category === c).length,
      })).sort((a, b) => b.count - a.count);
      return sendJSON(res, 200, { success: true, categories: [...set], detailed: list, total: list.length }, extra);
    }

    // ============================================================
    //  /regions
    // ============================================================
    if (sub === '/regions') {
      const set = new Set(all.map(n => n.region).filter(Boolean));
      return sendJSON(res, 200, { success: true, regions: [...set], total: set.size }, extra);
    }

    // ============================================================
    //  /sources
    // ============================================================
    if (sub === '/sources') {
      const bySource = {};
      for (const n of all) bySource[n.source] = (bySource[n.source] || 0) + 1;
      const list = Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
      return sendJSON(res, 200, { success: true, sources: list, total: list.length }, extra);
    }

    // ============================================================
    //  /importance
    // ============================================================
    if (sub === '/importance') {
      const byImportance = {};
      for (const n of all) {
        if (!byImportance[n.importance]) byImportance[n.importance] = { key: n.importance, label: n.importanceLabel, color: n.importanceColor, count: 0 };
        byImportance[n.importance].count++;
      }
      return sendJSON(res, 200, { success: true, importance: Object.values(byImportance) }, extra);
    }

    // ============================================================
    //  /sentiment
    // ============================================================
    if (sub === '/sentiment') {
      const bySentiment = { positive: 0, neutral: 0, negative: 0 };
      for (const n of all) bySentiment[n.sentiment] = (bySentiment[n.sentiment] || 0) + 1;
      return sendJSON(res, 200, { success: true, sentiment: bySentiment }, extra);
    }

    // ============================================================
    //  /stats
    // ============================================================
    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, {
        success: true,
        stats: computeStats(all),
        source: dataSource,
        hint: dataSource === 'fallback' ? hint : null,
      }, extra);
    }

    // ============================================================
    //  /search
    // ============================================================
    if (sub === '/search') {
      const q = String(query.q || '').toLowerCase().trim();
      if (!q) return sendJSON(res, 400, { success: false, error: 'field_required: q' }, extra);
      const results = all.filter(n =>
        n.title.toLowerCase().includes(q) || (n.summary || '').toLowerCase().includes(q)
      );
      return sendJSON(res, 200, { success: true, query: q, count: results.length, results }, extra);
    }

    // ============================================================
    //  /timeline
    // ============================================================
    if (sub === '/timeline') {
      return sendJSON(res, 200, { success: true, timeline: computeTimeline(all), count: all.length }, extra);
    }

    // ============================================================
    //  /featurecollection
    // ============================================================
    if (sub === '/featurecollection') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }

    // ============================================================
    //  /render
    // ============================================================
    if (sub === '/render') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, {
        render: {
          type: 'feed',
          items: rows,
          legend: {
            importance: Object.entries(IMPORTANCE_META).map(([key, def]) => ({ key, ...def })),
            categories: Object.entries(CATEGORY_META).map(([key, def]) => ({ key, ...def })),
          },
          stats: computeStats(rows),
          source: dataSource,
        },
      }, extra);
    }

    // ============================================================
    //  Не найдено
    // ============================================================
    return sendJSON(res, 404, {
      success: false,
      error: 'endpoint_not_found',
      path: sub,
      available: ['/', '/status', '/feed', '/latest', '/categories', '/regions', '/sources', '/importance', '/sentiment', '/stats', '/search', '/timeline', '/featurecollection', '/render'],
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { success: false, error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload, extra); } catch {}
  }
}
