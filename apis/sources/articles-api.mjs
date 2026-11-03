/**
 * apis/sources/articles-api.mjs — API-МОДУЛЬ: СТАТЬИ ИЗ RSS
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/rsshub.json — { items:[...], meta? } ИЛИ [...].
 * Сборщик: scripts/collectors/collect-rsshub.mjs.
 *
 * Адаптация Fastify-роута articles.mjs из песочницы под наш контракт v2.
 * В песочнице был PostgreSQL (pool.query SELECT), у нас — basket (JSON).
 *
 * Статья:
 *   { id, title, description, link, source, group, published_at }
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?group=, ?source=, ?since=, ?limit=, ?offset=.
 *
 * ПОДПУТИ:
 *   GET /                — список статей
 *   GET /:id             — одна статья
 *   GET /stats           — статистика
 *   GET /status          — health-check
 *   GET /sources         — список уникальных источников
 *   GET /groups          — распределение по группам
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
// Fallback-цепочка: rsshub.json → rss-latest.json → rss-universal.json → rss.json
const BASKET_CANDIDATES = [
  join(PROJECT_ROOT, 'data', 'basket', 'rsshub.json'),
  join(PROJECT_ROOT, 'data', 'basket', 'rss-latest.json'),
  join(PROJECT_ROOT, 'data', 'basket', 'rss-universal.json'),
  join(PROJECT_ROOT, 'data', 'basket', 'rss.json'),
];

export const route  = '/api/layers/articles';
export const method = 'GET';

export const meta = {
  category: 'semantic',
  icon: '📰',
  color: '#5bc0f8',
  vizType: 'marker',
  source: 'basket/rsshub.json',
  collector: 'collect-rsshub.mjs',
  cache: 120,
  description: 'Статьи из RSS (адаптация articles.mjs песочницы на basket)',
  unit: 'articles',
};

// ─── Классификация источников (как в collect-silence.mjs) ───
const RUSSIAN_PATTERNS = ['РИА', 'ТАСС', 'Интерфакс', 'RT', 'Известия', 'Взгляд', 'Lenta', 'Лента', 'Комсомольская', 'Правда', 'Звезда', 'Sputnik', '1Prime', 'Российская газета', 'Коммерсант', 'Ведомости'];
const WESTERN_PATTERNS = ['Guardian', 'BBC', 'NYT', 'SCMP', 'Straits Times', 'France 24', 'Sky News', 'Al Jazeera', 'Reuters', 'AP', 'CNN', 'Fox News', 'Politico', 'DW', 'Economist', 'FT', 'Financial Times', 'Wall Street'];

function classifySource(source) {
  if (!source) return 'neutral';
  const s = String(source);
  for (const p of RUSSIAN_PATTERNS) if (s.includes(p)) return 'russian';
  for (const p of WESTERN_PATTERNS) if (s.includes(p)) return 'western';
  return 'neutral';
}

function asArray(d) {
  if (!d) return [];
  if (Array.isArray(d)) return d;
  if (typeof d !== 'object') return [];
  if (Array.isArray(d.items)) return d.items;
  if (Array.isArray(d.documents)) return d.documents;
  if (Array.isArray(d.articles)) return d.articles;
  if (d.data) return asArray(d.data);
  return [];
}

function stripCdata(s) {
  if (!s) return '';
  return String(s).replace(/<!\[CDATA\[|\]\]>/g, '').trim();
}

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 2 * 60 * 1000;

async function loadBasket() {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < CACHE_TTL_MS) return _cache;

  try {
    // Перебираем кандидатов, пока не найдём непустой
    let parsed = null;
    let usedFile = null;
    for (const file of BASKET_CANDIDATES) {
      try {
        const raw = await fs.readFile(file, 'utf8');
        const p = JSON.parse(raw);
        const arr = asArray(p);
        if (arr.length > 0) {
          parsed = p;
          usedFile = file;
          break;
        }
      } catch { /* пробуем следующий */ }
    }

    if (!parsed) {
      return {
        schema: 'crucix.basket.v1',
        meta: { count: 0 },
        items: [],
        source: 'basket/*.json',
        error: 'not_found',
        hint: 'запустите scripts/collectors/collect-rsshub.mjs',
      };
    }

    const items = asArray(parsed).map((it, idx) => ({
      id: `art-${idx}`,
      title: stripCdata(it.title || ''),
      description: stripCdata(it.description || ''),
      link: it.link || it.url || '',
      source: it.source || (it.extra && it.extra.source) || '',
      group: classifySource(it.source || (it.extra && it.extra.source)),
      published_at: it.pubDate || it.published_at || it.date || null,
    }));

    _cache = {
      schema: parsed.schema || 'crucix.basket.v1',
      meta: parsed.meta || {},
      items,
      source: usedFile.replace(PROJECT_ROOT + '/', ''),
      loaded_at: new Date().toISOString(),
    };
    _cacheTime = now;
    return _cache;
  } catch (e) {
    if (e.code === 'ENOENT') {
      return {
        schema: 'crucix.basket.v1',
        meta: { count: 0 },
        items: [],
        source: 'basket/rsshub.json',
        error: 'not_found',
        hint: 'запустите scripts/collectors/collect-rsshub.mjs',
      };
    }
    throw e;
  }
}

function applyFilters(items, query) {
  let result = [...items];
  if (query.group) result = result.filter(a => a.group === query.group);
  if (query.source) result = result.filter(a => a.source.includes(query.source));
  if (query.since) {
    const since = new Date(query.since).getTime();
    result = result.filter(a => a.published_at && new Date(a.published_at).getTime() >= since);
  }
  const offset = parseInt(query.offset, 10) || 0;
  const limit = parseInt(query.limit, 10) || 50;
  return { total: result.length, items: result.slice(offset, offset + limit) };
}

export async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(route, '') || '/';
  const query = Object.fromEntries(url.searchParams);

  try {
    const data = await loadBasket();

    if (path === '/stats') {
      const byGroup = {};
      const bySource = {};
      for (const a of data.items) {
        byGroup[a.group] = (byGroup[a.group] || 0) + 1;
        bySource[a.source] = (bySource[a.source] || 0) + 1;
      }
      return res.end(JSON.stringify({
        stats: {
          count: data.items.length,
          by_group: byGroup,
          by_source: bySource,
          unique_sources: Object.keys(bySource).length,
        },
        source: data.source,
      }));
    }

    if (path === '/status') {
      return res.end(JSON.stringify({
        status: data.error ? 'degraded' : 'online',
        count: data.items.length,
        source: data.error ? null : data.source,
        hint: data.hint || null,
        generated_at: new Date().toISOString(),
      }));
    }

    if (path === '/sources') {
      const sources = new Set(data.items.map(a => a.source).filter(Boolean));
      return res.end(JSON.stringify({ count: sources.size, sources: [...sources].sort() }));
    }

    if (path === '/groups') {
      const byGroup = {};
      for (const a of data.items) {
        byGroup[a.group] = (byGroup[a.group] || 0) + 1;
      }
      return res.end(JSON.stringify({ groups: Object.entries(byGroup).map(([name, count]) => ({ name, count })) }));
    }

    if (path === '/raw') {
      return res.end(JSON.stringify({ count: data.items.length, items: data.items.slice(0, 50) }));
    }

    if (path.startsWith('/') && path.length > 1) {
      const id = path.slice(1);
      const item = data.items.find(a => a.id === id);
      if (!item) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'article not found', id }));
      }
      return res.end(JSON.stringify(item));
    }

    const filtered = applyFilters(data.items, query);
    return res.end(JSON.stringify({
      _meta: data.meta,
      total: filtered.total,
      count: filtered.items.length,
      items: filtered.items,
    }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: e.message }));
  }
}
