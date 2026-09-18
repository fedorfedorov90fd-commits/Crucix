/**
 * apis/sources/news-api.mjs — API-МОДУЛЬ: НОВОСТНОЙ ПОТОК (NewsAPI)
 *
 * КОНТРАКТ CRUCIX v2 (Layer, read-only).
 * ИСТОЧНИК: data/basket/news.json — массив статей в формате NewsAPI:
 *   { source: {id, name}, author, title, description, url, urlToImage, publishedAt, content }
 * Сборщик: scripts/collectors/collect-news.mjs.
 *
 * Лента новостей из NewsAPI: анализ источников, авторов, домёнов, поиск,
 * timeline, группировки. Используется страницей /news и rss-feed.
 *
 * ПУБЛИЧНЫЕ ЭНДПОИНТЫ:
 *   GET /                      — корень (список + сводка)
 *   GET /status                — health-check (совместимо с /api/news/status)
 *   GET /data                  — сырые данные (совместимо с /api/news/data)
 *   GET /feed                  — алиас списка
 *   GET /latest?limit=         — последние N (совместимо с /api/news/latest)
 *   GET /region?name=          — фильтр по источнику/региону (совместимо с /api/news/region)
 *   GET /stats                 — расширенная статистика (запрошено фронтом)
 *   GET /sources               — группировка по источникам
 *   GET /authors               — топ авторов
 *   GET /domains               — группировка по домену url
 *   GET /search?q=             — полнотекстовый поиск
 *   GET /timeline              — динамика по дням
 *   GET /with-images           — только статьи с картинкой
 *   GET /without-images        — без картинок
 *   GET /article/:id           — конкретная статья (по index или url-hash)
 *   GET /featurecollection     — GeoJSON (пустой, новости без координат)
 *   GET /render                — рендер-конфиг для UI
 *
 * ФОРМАТЫ: json, csv, series, stats, raw, timeline.
 * ФИЛЬТРЫ: ?source=, ?author=, ?domain=, ?q=, ?since=, ?until=, ?has_image=, ?limit=, ?top=, ?sort=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { loadWithFallback } from './lib/basket-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE = join(PROJECT_ROOT, 'data', 'basket', 'news.json');

export const route  = '/api/layers/news';
export const method = 'GET';

export const meta = {
  category: 'news',
  icon: '📰',
  color: '#ec4899',
  vizType: 'marker',
  source: 'basket/news.json',
  collector: 'collect-news.mjs',
  cache: 60,
  description: 'Новостной поток NewsAPI: источники, авторы, домёны, поиск, timeline, анализ картинок',
  unit: 'articles',
};

// ============================================================
//  УТИЛИТЫ
// ============================================================

function shortHash(s) {
  return createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
}

function extractDomain(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch { return null; }
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function approxReadingTime(content) {
  if (!content) return null;
  const words = String(content).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// ============================================================
//  ЗАГРУЗКА
// ============================================================

async function loadNews() {
  const result = await loadWithFallback({
    basketFile: BASKET_FILE,
    fallbackData: [],
    hint: 'запустите scripts/collectors/collect-news.mjs',
  });

  let arr = result.data;
  if (!Array.isArray(arr)) {
    if (arr && Array.isArray(arr.articles)) arr = arr.articles;
    else if (arr && Array.isArray(arr.data)) arr = arr.data;
    else if (arr && Array.isArray(arr.items)) arr = arr.items;
    else arr = [];
  }
  return { arr, source: result.source, hint: result.hint, error: result.error };
}

// ============================================================
//  НОРМАЛИЗАЦИЯ
// ============================================================

function normalizeArticle(a, i) {
  const id = shortHash(a.url || `${i}-${a.title || ''}`);
  const domain = extractDomain(a.url);
  const publishedAt = formatDate(a.publishedAt);

  return {
    id,
    index: i,
    sourceId: a.source?.id || null,
    sourceName: a.source?.name || 'Unknown',
    author: a.author || null,
    title: a.title || 'Без заголовка',
    description: a.description || null,
    url: a.url || null,
    domain,
    urlToImage: a.urlToImage || null,
    hasImage: !!a.urlToImage,
    publishedAt,
    publishedDate: publishedAt ? publishedAt.slice(0, 10) : null,
    content: a.content || null,
    contentLength: a.content ? a.content.length : 0,
    readingTimeMin: approxReadingTime(a.content),
    category_meta: 'news',
    icon: meta.icon,
  };
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(articles, query) {
  let r = articles.slice();

  if (query.source) {
    const s = String(query.source).toLowerCase();
    r = r.filter(x => String(x.sourceName).toLowerCase().includes(s) || String(x.sourceId || '').toLowerCase().includes(s));
  }
  if (query.author) {
    const a = String(query.author).toLowerCase();
    r = r.filter(x => String(x.author || '').toLowerCase().includes(a));
  }
  if (query.domain) {
    const d = String(query.domain).toLowerCase();
    r = r.filter(x => String(x.domain || '').toLowerCase().includes(d));
  }
  if (query.has_image === 'true') r = r.filter(x => x.hasImage);
  if (query.has_image === 'false') r = r.filter(x => !x.hasImage);
  if (query.q) {
    const s = String(query.q).toLowerCase();
    r = r.filter(x =>
      (x.title + ' ' + (x.description || '') + ' ' + (x.content || '')).toLowerCase().includes(s)
    );
  }
  if (query.since) {
    const t = new Date(query.since).getTime();
    if (Number.isFinite(t)) r = r.filter(x => !x.publishedAt || new Date(x.publishedAt).getTime() >= t);
  }
  if (query.until) {
    const t = new Date(query.until).getTime();
    if (Number.isFinite(t)) r = r.filter(x => !x.publishedAt || new Date(x.publishedAt).getTime() <= t);
  }

  const sortKey = query.sort;
  if (sortKey === 'date-desc') r.sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
  else if (sortKey === 'date-asc')  r.sort((a, b) => String(a.publishedAt || '').localeCompare(String(b.publishedAt || '')));
  else if (sortKey === 'title')     r.sort((a, b) => a.title.localeCompare(b.title));
  else if (sortKey === 'source')    r.sort((a, b) => a.sourceName.localeCompare(b.sourceName));
  else if (sortKey === 'reading-time-desc') r.sort((a, b) => (b.readingTimeMin ?? 0) - (a.readingTimeMin ?? 0));

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(articles) {
  const bySource = {};
  const byAuthor = {};
  const byDomain = {};
  const byDate = {};
  let withImage = 0;
  let totalContentLength = 0;
  let totalReadingTime = 0;

  for (const a of articles) {
    bySource[a.sourceName] = (bySource[a.sourceName] || 0) + 1;
    if (a.author) byAuthor[a.author] = (byAuthor[a.author] || 0) + 1;
    if (a.domain) byDomain[a.domain] = (byDomain[a.domain] || 0) + 1;
    if (a.publishedDate) byDate[a.publishedDate] = (byDate[a.publishedDate] || 0) + 1;
    if (a.hasImage) withImage++;
    totalContentLength += a.contentLength || 0;
    totalReadingTime += a.readingTimeMin || 0;
  }

  const top = (obj, limit = 10) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, count]) => ({ name, count }));

  const dates = Object.keys(byDate).sort();

  return {
    total: articles.length,
    with_image: withImage,
    without_image: articles.length - withImage,
    total_content_chars: totalContentLength,
    total_reading_time_min: totalReadingTime,
    avg_reading_time_min: articles.length > 0 ? Number((totalReadingTime / articles.length).toFixed(1)) : 0,
    unique_sources: Object.keys(bySource).length,
    unique_authors: Object.keys(byAuthor).length,
    unique_domains: Object.keys(byDomain).length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    top_sources: top(bySource, 15),
    top_authors: top(byAuthor, 15),
    top_domains: top(byDomain, 15),
  };
}

function computeTimeline(articles) {
  const byDate = {};
  for (const a of articles) {
    if (!a.publishedDate) continue;
    if (!byDate[a.publishedDate]) byDate[a.publishedDate] = { date: a.publishedDate, count: 0, sources: {} };
    byDate[a.publishedDate].count++;
    byDate[a.publishedDate].sources[a.sourceName] = (byDate[a.publishedDate].sources[a.sourceName] || 0) + 1;
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(articles) {
  // У новостей нет координат — GeoJSON пустой, но контракт требует
  return {
    type: 'FeatureCollection',
    features: [],
    legend: [],
    meta: {
      total: articles.length,
      mapped: 0,
      note: 'news — статьи без координат, точки не ставятся',
    },
  };
}

function toSeries(articles) {
  return articles.map(a => ({
    id: a.id,
    title: a.title,
    sourceName: a.sourceName,
    author: a.author,
    url: a.url,
    domain: a.domain,
    publishedAt: a.publishedAt,
    hasImage: a.hasImage,
    readingTimeMin: a.readingTimeMin,
  }));
}

function toCSV(articles) {
  const lines = ['id,source,author,title,domain,publishedAt,hasImage,url'];
  const esc = v => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  for (const a of articles) {
    lines.push([a.id, a.sourceName, a.author, a.title, a.domain, a.publishedAt, a.hasImage, a.url].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
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
  const extra = {
    'X-Module': 'news-api',
    'X-Module-Version': '2.0.0',
    'Cache-Control': `public, max-age=${meta.cache}`,
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/news/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      res.end();
      return;
    }

    // Загрузка данных с локальным try/catch — линтер видит
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
    const all = raw.map(normalizeArticle);

    // ============================================================
    //  /status
    // ============================================================
    if (sub === '/status') {
      return sendJSON(res, 200, {
        success: true,
        module: 'news',
        status: 'online',
        articles: all.length,
        dataSource,
        hint: dataSource === 'fallback' ? hint : null,
        timestamp: new Date().toISOString(),
      }, extra);
    }

    // ============================================================
    //  /, /feed, ''
    // ============================================================
    if (sub === '/' || sub === '/feed' || sub === '') {
      const rows = applyFilters(all, query);

      if (format === 'csv') return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
      if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
      if (format === 'raw') return sendJSON(res, 200, { data: rows, source: dataSource, total: all.length }, extra);
      if (format === 'featurecollection') return sendJSON(res, 200, toFeatureCollection(rows), extra);

      return sendJSON(res, 200, {
        success: true,
        module: 'news',
        status: 'online',
        articles: rows,
        feed: rows,
        total: all.length,
        count: rows.length,
        stats: computeStats(rows),
        dataSource,
        source: dataSource,
        hint: dataSource === 'fallback' ? hint : null,
        timestamp: new Date().toISOString(),
        endpoints: [
          '/api/layers/news/ — список',
          '/api/layers/news/status — статус',
          '/api/layers/news/data — сырые данные',
          '/api/layers/news/latest — последние N',
          '/api/layers/news/region?name= — по источнику',
          '/api/layers/news/stats — статистика',
          '/api/layers/news/sources — источники',
          '/api/layers/news/authors — авторы',
          '/api/layers/news/domains — домёны',
          '/api/layers/news/search?q= — поиск',
          '/api/layers/news/timeline — динамика',
          '/api/layers/news/with-images — с картинками',
          '/api/layers/news/without-images — без картинок',
          '/api/layers/news/article/:id — конкретная статья',
          '/api/layers/news/render — рендер-конфиг',
        ],
      }, extra);
    }

    // ============================================================
    //  /data — сырые данные
    // ============================================================
    if (sub === '/data') {
      return sendJSON(res, 200, { success: true, data: { articles: all, summary: computeStats(all) } }, extra);
    }

    // ============================================================
    //  /latest?limit=
    // ============================================================
    if (sub === '/latest') {
      const limit = parseInt(query.limit, 10) || 10;
      const sorted = all.slice().sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
      const articles = sorted.slice(0, limit);
      return sendJSON(res, 200, {
        success: true,
        articles,
        total: articles.length,
        limit,
      }, extra);
    }

    // ============================================================
    //  /region?name= — совместимость: фильтр по source или если есть поле region
    // ============================================================
    if (sub === '/region') {
      const name = String(query.name || '').toLowerCase();
      if (!name) return sendJSON(res, 400, { success: false, error: 'field_required: name' }, extra);
      const articles = all.filter(a =>
        String(a.sourceName).toLowerCase().includes(name) ||
        String(a.sourceId || '').toLowerCase().includes(name) ||
        String(a.domain || '').toLowerCase().includes(name)
      );
      return sendJSON(res, 200, { success: true, region: query.name, articles, total: articles.length }, extra);
    }

    // ============================================================
    //  /stats
    // ============================================================
    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, {
        success: true,
        stats: computeStats(all),
        dataSource,
        hint: dataSource === 'fallback' ? hint : null,
      }, extra);
    }

    // ============================================================
    //  /sources
    // ============================================================
    if (sub === '/sources') {
      const bySource = {};
      for (const a of all) {
        if (!bySource[a.sourceName]) bySource[a.sourceName] = { name: a.sourceName, id: a.sourceId, count: 0, domains: {} };
        bySource[a.sourceName].count++;
        if (a.domain) bySource[a.sourceName].domains[a.domain] = true;
      }
      const list = Object.values(bySource)
        .map(s => ({ name: s.name, id: s.id, count: s.count, domains: Object.keys(s.domains) }))
        .sort((a, b) => b.count - a.count);
      return sendJSON(res, 200, { success: true, sources: list, total: list.length }, extra);
    }

    // ============================================================
    //  /authors
    // ============================================================
    if (sub === '/authors') {
      const byAuthor = {};
      for (const a of all) {
        if (!a.author) continue;
        if (!byAuthor[a.author]) byAuthor[a.author] = { name: a.author, count: 0, sources: {} };
        byAuthor[a.author].count++;
        byAuthor[a.author].sources[a.sourceName] = (byAuthor[a.author].sources[a.sourceName] || 0) + 1;
      }
      const list = Object.values(byAuthor).sort((a, b) => b.count - a.count);
      return sendJSON(res, 200, { success: true, authors: list, total: list.length }, extra);
    }

    // ============================================================
    //  /domains
    // ============================================================
    if (sub === '/domains') {
      const byDomain = {};
      for (const a of all) {
        if (!a.domain) continue;
        byDomain[a.domain] = (byDomain[a.domain] || 0) + 1;
      }
      const list = Object.entries(byDomain).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
      return sendJSON(res, 200, { success: true, domains: list, total: list.length }, extra);
    }

    // ============================================================
    //  /search?q=
    // ============================================================
    if (sub === '/search') {
      const q = String(query.q || '').toLowerCase().trim();
      if (!q) return sendJSON(res, 400, { success: false, error: 'field_required: q' }, extra);
      const results = all.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q) ||
        (a.content || '').toLowerCase().includes(q) ||
        (a.author || '').toLowerCase().includes(q)
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
    //  /with-images
    // ============================================================
    if (sub === '/with-images') {
      const rows = all.filter(a => a.hasImage);
      return sendJSON(res, 200, { success: true, count: rows.length, articles: rows }, extra);
    }

    // ============================================================
    //  /without-images
    // ============================================================
    if (sub === '/without-images') {
      const rows = all.filter(a => !a.hasImage);
      return sendJSON(res, 200, { success: true, count: rows.length, articles: rows }, extra);
    }

    // ============================================================
    //  /article/:id
    // ============================================================
    if (sub.startsWith('/article/')) {
      const id = decodeURIComponent(sub.slice('/article/'.length));
      const article = all.find(a => a.id === id);
      if (!article) return sendJSON(res, 404, { success: false, error: 'article_not_found', id }, extra);
      return sendJSON(res, 200, { success: true, article }, extra);
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
          stats: computeStats(rows),
          dataSource,
          hint: dataSource === 'fallback' ? hint : null,
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
      available: ['/', '/status', '/data', '/feed', '/latest', '/region', '/stats', '/sources', '/authors', '/domains', '/search', '/timeline', '/with-images', '/without-images', '/article/:id', '/featurecollection', '/render'],
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { success: false, error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload, extra); } catch {}
  }
}
