/**
 * apis/sources/events-api.mjs — API-МОДУЛЬ: СОБЫТИЯ (карточки)
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/rsshub.json (fallback) + config/taxonomy.json
 * Сборщик: scripts/collectors/collect-rsshub.mjs.
 *
 * Адаптация Fastify-роута events.mjs из песочницы (PG SELECT FROM events)
 * под наш контракт v2. В песочнице были таблицы events + articles,
 * у нас — basket + taxonomy (группировка статей по сущностям).
 *
 * Событие:
 *   { id, topic, topic_type, title, severity, articles_count, russian_count,
 *     western_count, sample_titles, first_seen, last_seen, gap_type }
 *
 * ПОДПУТИ:
 *   GET /                — список событий (фильтры: topic, severity, group, limit, offset)
 *   GET /:id             — одно событие
 *   GET /stats           — агрегаты (by_severity, by_type, by_group)
 *   GET /status          — health-check
 *   GET /by-topic/:topic — события по теме
 *   GET /high            — только severity=high
 *   GET /top?n=N         — топ-N по articles_count
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
const TAXONOMY_FILE = join(PROJECT_ROOT, 'config', 'taxonomy.json');

export const route  = '/api/layers/events';
export const method = 'GET';

export const meta = {
  category: 'semantic',
  icon: '📅',
  color: '#8b5cf6',
  vizType: 'marker',
  source: 'basket/rsshub.json + config/taxonomy.json',
  collector: 'collect-rsshub.mjs',
  cache: 120,
  description: 'События (карточки): группировка статей по taxonomy-сущностям',
  unit: 'events',
};

// ─── Классификация источников ───
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

async function loadEvents() {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < CACHE_TTL_MS) return _cache;

  // Загружаем RSS
  let parsed = null;
  for (const file of BASKET_CANDIDATES) {
    try {
      const raw = await fs.readFile(file, 'utf8');
      const p = JSON.parse(raw);
      if (asArray(p).length > 0) { parsed = p; break; }
    } catch { }
  }
  if (!parsed) return { events: [], error: 'not_found' };

  // Загружаем taxonomy
  let taxonomy;
  try {
    taxonomy = JSON.parse(await fs.readFile(TAXONOMY_FILE, 'utf8'));
  } catch {
    return { events: [], error: 'taxonomy_not_found' };
  }

  const entities = taxonomy.entities || {};
  const aliasMap = new Map();
  for (const [entityId, entity] of Object.entries(entities)) {
    for (const alias of (entity.aliases || [])) {
      aliasMap.set(alias.toLowerCase(), entityId);
    }
  }

  const items = asArray(parsed);
  const eventMap = new Map(); // entityId → { russian, western, neutral, titles, first_seen, last_seen }

  for (const it of items) {
    const source = it.source || '';
    const group = classifySource(source);
    const text = `${stripCdata(it.title || '')} ${stripCdata(it.description || '')}`.toLowerCase();
    const pubDate = it.pubDate || it.published_at || it.date || null;

    const seenEntities = new Set();
    for (const [alias, entityId] of aliasMap) {
      if (text.includes(alias) && !seenEntities.has(entityId)) {
        seenEntities.add(entityId);
        if (!eventMap.has(entityId)) {
          eventMap.set(entityId, { russian: 0, western: 0, neutral: 0, titles: [], first_seen: null, last_seen: null });
        }
        const e = eventMap.get(entityId);
        e[group]++;
        if (e.titles.length < 5) e.titles.push(stripCdata(it.title || '').slice(0, 100));
        if (pubDate) {
          if (!e.first_seen || pubDate < e.first_seen) e.first_seen = pubDate;
          if (!e.last_seen || pubDate > e.last_seen) e.last_seen = pubDate;
        }
      }
    }
  }

  const events = [];
  let idx = 1;
  for (const [entityId, counts] of eventMap) {
    const entity = entities[entityId] || {};
    const total = counts.russian + counts.western + counts.neutral;
    if (total < 2) continue;

    let severity = 'normal';
    let gap_type = null;
    if (counts.russian >= 3 && counts.western === 0) {
      gap_type = 'western_silence';
      severity = counts.russian >= 10 ? 'high' : 'normal';
    } else if (counts.western >= 3 && counts.russian === 0) {
      gap_type = 'russian_silence';
      severity = counts.western >= 10 ? 'high' : 'normal';
    } else if (counts.russian >= 3 && counts.western >= 1 && counts.russian / counts.western > 5) {
      gap_type = 'western_undercovered';
      severity = counts.russian / counts.western >= 10 ? 'high' : 'normal';
    } else if (counts.western >= 3 && counts.russian >= 1 && counts.western / counts.russian > 5) {
      gap_type = 'russian_undercovered';
      severity = counts.western / counts.russian >= 10 ? 'high' : 'normal';
    }

    events.push({
      id: `event-${idx++}`,
      topic: entityId,
      name: entity.ru || entityId,
      topic_type: entity.type || 'unknown',
      title: `Событие: ${entity.ru || entityId}`,
      severity,
      gap_type,
      articles_count: total,
      russian_count: counts.russian,
      western_count: counts.western,
      neutral_count: counts.neutral,
      sample_titles: counts.titles,
      first_seen: counts.first_seen,
      last_seen: counts.last_seen,
    });
  }

  events.sort((a, b) => b.articles_count - a.articles_count);

  _cache = {
    events,
    total: events.length,
    total_articles: items.length,
    loaded_at: new Date().toISOString(),
  };
  _cacheTime = now;
  return _cache;
}

function applyFilters(events, query) {
  let result = [...events];
  if (query.topic) result = result.filter(e => e.topic === query.topic);
  if (query.severity) result = result.filter(e => e.severity === query.severity);
  if (query.group) {
    if (query.group === 'russian') result = result.filter(e => e.russian_count > 0);
    if (query.group === 'western') result = result.filter(e => e.western_count > 0);
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
    const data = await loadEvents();

    if (path === '/stats') {
      const bySeverity = {};
      const byGapType = {};
      const byTopicType = {};
      let totalRussian = 0, totalWestern = 0;

      for (const e of data.events) {
        bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1;
        byGapType[e.gap_type || 'none'] = (byGapType[e.gap_type || 'none'] || 0) + 1;
        byTopicType[e.topic_type] = (byTopicType[e.topic_type] || 0) + 1;
        totalRussian += e.russian_count;
        totalWestern += e.western_count;
      }

      return res.end(JSON.stringify({
        stats: {
          count: data.events.length,
          total_articles: data.total_articles,
          by_severity: bySeverity,
          by_gap_type: byGapType,
          by_topic_type: byTopicType,
          totals: { russian_count: totalRussian, western_count: totalWestern },
        },
        generated_at: new Date().toISOString(),
      }));
    }

    if (path === '/status') {
      return res.end(JSON.stringify({
        status: data.error ? 'degraded' : 'online',
        count: data.events.length,
        total_articles: data.total_articles,
        hint: data.error || null,
        generated_at: new Date().toISOString(),
      }));
    }

    if (path === '/high') {
      const events = data.events.filter(e => e.severity === 'high');
      return res.end(JSON.stringify({ count: events.length, events }));
    }

    if (path === '/top') {
      const n = parseInt(query.n, 10) || 10;
      return res.end(JSON.stringify({ count: Math.min(n, data.events.length), events: data.events.slice(0, n) }));
    }

    if (path.startsWith('/by-topic/')) {
      const topic = path.replace('/by-topic/', '');
      const events = data.events.filter(e => e.topic === topic);
      return res.end(JSON.stringify({ count: events.length, events }));
    }

    if (path.startsWith('/') && path.length > 1) {
      const id = path.slice(1);
      const event = data.events.find(e => e.id === id);
      if (!event) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'event not found', id }));
      }
      return res.end(JSON.stringify(event));
    }

    const filtered = applyFilters(data.events, query);
    return res.end(JSON.stringify({
      total: filtered.total,
      count: filtered.items.length,
      events: filtered.items,
    }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: e.message }));
  }
}
