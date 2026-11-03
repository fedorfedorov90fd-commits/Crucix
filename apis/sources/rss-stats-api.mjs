/**
 * apis/sources/rss-stats-api.mjs — API-МОДУЛЬ: АГРЕГАТЫ RSS
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/rss-latest.json (fallback).
 * Сборщик: scripts/collectors/collect-rsshub.mjs.
 *
 * Адаптация Fastify-роута stats.mjs (GET /stats) из песочницы.
 *
 * ПОДПУТИ:
 *   GET /                — полные агрегаты
 *   GET /stats           — то же
 *   GET /status          — health-check
 *   GET /by-hour         — распределение по часам
 *   GET /by-day          — распределение по дням
 *   GET /by-group        — распределение по группам
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

export const route  = '/api/layers/rss-stats';
export const method = 'GET';

export const meta = {
  category: 'semantic',
  icon: '📊',
  color: '#10b981',
  vizType: 'series',
  source: 'basket/rss-*.json',
  collector: 'collect-rsshub.mjs',
  cache: 120,
  description: 'Агрегаты RSS (адаптация stats.mjs песочницы)',
  unit: 'stats',
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

async function loadBasket() {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < 60 * 1000) return _cache;

  let parsed = null;
  for (const file of BASKET_CANDIDATES) {
    try {
      const raw = await fs.readFile(file, 'utf8');
      const p = JSON.parse(raw);
      if (asArray(p).length > 0) { parsed = p; break; }
    } catch { }
  }

  if (!parsed) return { items: [], error: 'not_found' };

  _cache = { items: asArray(parsed), loaded_at: new Date().toISOString() };
  _cacheTime = now;
  return _cache;
}

function extractHour(d) {
  if (!d) return null;
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 13); // YYYY-MM-DDTHH
  } catch { return null; }
}

function extractDay(d) {
  if (!d) return null;
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  } catch { return null; }
}

export async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(route, '') || '/';
  const query = Object.fromEntries(url.searchParams);

  try {
    const data = await loadBasket();

    if (path === '/status') {
      return res.end(JSON.stringify({
        status: data.error ? 'degraded' : 'online',
        count: data.items.length,
        generated_at: new Date().toISOString(),
      }));
    }

    if (path === '/by-hour' || path === '/by-day' || path === '/by-group' || path === '/stats' || path === '/') {
      const byGroup = {};
      const byHour = {};
      const byDay = {};
      let withDate = 0;

      for (const it of data.items) {
        const g = classifySource(it.source);
        byGroup[g] = (byGroup[g] || 0) + 1;
        const h = extractHour(it.pubDate || it.published_at || it.date);
        if (h) { byHour[h] = (byHour[h] || 0) + 1; withDate++; }
        const d = extractDay(it.pubDate || it.published_at || it.date);
        if (d) { byDay[d] = (byDay[d] || 0) + 1; }
      }

      const payload = {
        stats: {
          total: data.items.length,
          with_date: withDate,
          by_group: byGroup,
          by_hour: Object.entries(byHour).sort().map(([hour, count]) => ({ hour, count })),
          by_day: Object.entries(byDay).sort().map(([day, count]) => ({ day, count })),
        },
        generated_at: new Date().toISOString(),
      };

      if (path === '/by-hour') return res.end(JSON.stringify({ series: payload.stats.by_hour }));
      if (path === '/by-day') return res.end(JSON.stringify({ series: payload.stats.by_day }));
      if (path === '/by-group') return res.end(JSON.stringify({ groups: Object.entries(byGroup).map(([name, count]) => ({ name, count })) }));

      return res.end(JSON.stringify(payload));
    }

    if (path === '/top-sources') {
      const n = parseInt(query.n, 10) || 10;
      const bySource = {};
      for (const it of data.items) {
        const s = it.source || '';
        if (!s) continue;
        bySource[s] = (bySource[s] || 0) + 1;
      }
      const top = Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
      return res.end(JSON.stringify({ count: top.length, sources: top }));
    }

    res.statusCode = 404;
    return res.end(JSON.stringify({ error: 'not_found', path }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: e.message }));
  }
}
