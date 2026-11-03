/**
 * apis/sources/sources-api.mjs — API-МОДУЛЬ: ИСТОЧНИКИ RSS
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/rss-latest.json (fallback: rsshub.json → rss-universal.json).
 * Сборщик: scripts/collectors/collect-rsshub.mjs.
 *
 * Адаптация Fastify-роута feeds.mjs (GET /sources, GET /feed-status)
 * из песочницы под наш контракт v2.
 *
 * Источник:
 *   { source, sourceUrl, group, count, first_seen, last_seen, articles_count }
 *
 * ПОДПУТИ:
 *   GET /                — список источников
 *   GET /stats           — агрегаты по группам
 *   GET /status          — health-check
 *   GET /feed-status     — статусы (ok/error/last_seen)
 *   GET /top?n=N         — топ-N по количеству
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

const BASKET_CANDIDATES = [
  join(PROJECT_ROOT, 'data', 'basket', 'rsshub.json'),
  join(PROJECT_ROOT, 'data', 'basket', 'rss-latest.json'),
  join(PROJECT_ROOT, 'data', 'basket', 'rss-universal.json'),
  join(PROJECT_ROOT, 'data', 'basket', 'rss.json'),
];

export const route  = '/api/layers/sources';
export const method = 'GET';

export const meta = {
  category: 'semantic',
  icon: '📡',
  color: '#f26522',
  vizType: 'marker',
  source: 'basket/rss-*.json',
  collector: 'collect-rsshub.mjs',
  cache: 120,
  description: 'Источники RSS (адаптация feeds.mjs песочницы)',
  unit: 'sources',
};

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

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 2 * 60 * 1000;

async function loadBasket() {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < CACHE_TTL_MS) return _cache;

  let parsed = null;
  for (const file of BASKET_CANDIDATES) {
    try {
      const raw = await fs.readFile(file, 'utf8');
      const p = JSON.parse(raw);
      if (asArray(p).length > 0) { parsed = p; break; }
    } catch { }
  }

  if (!parsed) {
    return { sources: [], error: 'not_found', source: 'basket/*.json' };
  }

  const items = asArray(parsed);
  const map = new Map(); // source → { source, sourceUrl, group, count, first_seen, last_seen }

  for (const it of items) {
    const src = it.source || '';
    if (!src) continue;
    const srcUrl = it.sourceUrl || '';
    const pubDate = it.pubDate || it.published_at || it.date || null;

    if (!map.has(src)) {
      map.set(src, {
        source: src,
        sourceUrl: srcUrl,
        group: classifySource(src),
        count: 0,
        first_seen: pubDate,
        last_seen: pubDate,
      });
    }
    const s = map.get(src);
    s.count++;
    if (pubDate) {
      if (!s.first_seen || pubDate < s.first_seen) s.first_seen = pubDate;
      if (!s.last_seen || pubDate > s.last_seen) s.last_seen = pubDate;
    }
  }

  _cache = {
    sources: [...map.values()].sort((a, b) => b.count - a.count),
    total: map.size,
    loaded_at: new Date().toISOString(),
  };
  _cacheTime = now;
  return _cache;
}

export async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(route, '') || '/';
  const query = Object.fromEntries(url.searchParams);

  try {
    const data = await loadBasket();

    if (path === '/stats') {
      const byGroup = {};
      let totalArticles = 0;
      for (const s of data.sources) {
        byGroup[s.group] = (byGroup[s.group] || 0) + 1;
        totalArticles += s.count;
      }
      return res.end(JSON.stringify({
        stats: {
          count: data.sources.length,
          total_articles: totalArticles,
          by_group: byGroup,
        },
        source: data.source || 'basket/rss-*.json',
      }));
    }

    if (path === '/status') {
      return res.end(JSON.stringify({
        status: data.error ? 'degraded' : 'online',
        count: data.sources.length,
        source: data.error ? null : (data.source || 'basket/rss-*.json'),
        generated_at: new Date().toISOString(),
      }));
    }

    if (path === '/feed-status') {
      const feeds = data.sources.map(s => ({
        source: s.source,
        group: s.group,
        status: s.count > 0 ? 'ok' : 'error',
        count: s.count,
        last_seen: s.last_seen,
      }));
      return res.end(JSON.stringify({ feeds }));
    }

    if (path === '/by-group') {
      const byGroup = {};
      for (const s of data.sources) {
        if (!byGroup[s.group]) byGroup[s.group] = { count: 0, articles: 0, sources: [] };
        byGroup[s.group].count++;
        byGroup[s.group].articles += s.count;
        byGroup[s.group].sources.push(s.source);
      }
      return res.end(JSON.stringify({ groups: byGroup }));
    }

    if (path === '/top') {
      const n = parseInt(query.n, 10) || 10;
      return res.end(JSON.stringify({ count: Math.min(n, data.sources.length), sources: data.sources.slice(0, n) }));
    }

    return res.end(JSON.stringify({
      count: data.sources.length,
      sources: data.sources,
    }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: e.message }));
  }
}
