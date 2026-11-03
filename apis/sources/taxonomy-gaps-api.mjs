/**
 * apis/sources/taxonomy-gaps-api.mjs — API-МОДУЛЬ: ТЕМАТИЧЕСКИЕ GAPS
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/taxonomy-gaps.json — { topics:[...], meta? } ИЛИ [...].
 * Сборщик: scripts/collectors/collect-taxonomy-gaps.mjs.
 *
 * Тематические gaps: темы (страны, персоны, регионы), которые активно
 * освещаются одной группой источников и полностью отсутствуют у другой.
 * Это «информационные лакуны» — сигнал о замалчивании.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'taxonomy-gaps.json');

export const route  = '/api/layers/taxonomy-gaps';
export const method = 'GET';

export const meta = {
  category: 'semantic',
  icon: '🔍',
  color: '#a78bfa',
  vizType: 'marker',
  source: 'basket/taxonomy-gaps.json',
  collector: 'collect-taxonomy-gaps.mjs',
  cache: 300,
  description: 'Тематические gaps: темы, которые активно освещаются одной группой и отсутствуют у другой',
  unit: 'topics',
};

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadBasket() {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < CACHE_TTL_MS) return _cache;

  try {
    const raw = await fs.readFile(BASKET_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    let topics = [];
    if (Array.isArray(parsed)) topics = parsed;
    else if (Array.isArray(parsed.topics)) topics = parsed.topics;
    else if (Array.isArray(parsed.regions)) topics = parsed.regions;

    const enriched = topics.map(t => {
      const ratio = t.western_count > 0 ? t.russian_count / t.western_count : (t.russian_count > 0 ? 999 : 1);
      return {
        ...t,
        ratio: Math.round(ratio * 10) / 10,
        severityColor: t.severity === 'high' ? '#ef4444' : '#22c55e',
        gapTypeLabel: {
          western_silence: 'Западное молчание',
          russian_silence: 'Российское молчание',
          western_undercovered: 'Запад недопокрывает',
          russian_undercovered: 'Россия недопокрывает',
        }[t.gap_type] || t.gap_type,
      };
    });

    _cache = {
      schema: parsed.schema || 'crucix.basket.v1',
      meta: parsed.meta || {},
      topics: enriched,
      source: 'basket/taxonomy-gaps.json',
      loaded_at: new Date().toISOString(),
    };
    _cacheTime = now;
    return _cache;
  } catch (e) {
    if (e.code === 'ENOENT') {
      return {
        schema: 'crucix.basket.v1',
        meta: { count: 0, total_items: 0 },
        topics: [],
        source: 'basket/taxonomy-gaps.json',
        error: 'not_found',
        hint: 'запустите scripts/collectors/collect-taxonomy-gaps.mjs',
      };
    }
    throw e;
  }
}

function applyFilters(topics, query) {
  let result = [...topics];
  if (query.severity) result = result.filter(t => t.severity === query.severity);
  if (query.gap_type) result = result.filter(t => t.gap_type === query.gap_type);
  if (query.topic_type) result = result.filter(t => t.topic_type === query.topic_type);
  if (query.min_count) {
    const min = parseInt(query.min_count, 10);
    result = result.filter(t => (t.total_events || 0) >= min);
  }
  if (query.q) {
    const q = query.q.toLowerCase();
    result = result.filter(t => (t.topic || '').toLowerCase().includes(q));
  }
  if (query.sort === 'russian') result.sort((a, b) => b.russian_count - a.russian_count);
  else if (query.sort === 'western') result.sort((a, b) => b.western_count - a.western_count);
  else if (query.sort === 'ratio') result.sort((a, b) => b.ratio - a.ratio);
  else result.sort((a, b) => b.total_events - a.total_events);

  const limit = parseInt(query.limit, 10) || 100;
  return result.slice(0, limit);
}

// ═══════════════════════════════════════════════════════════
//  HANDLER — контракт Crucix v2: handler(req, res)
//  Использует res.writeHead/res.end, как silence-api.mjs
// ═══════════════════════════════════════════════════════════

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const query = Object.fromEntries(url.searchParams);

  try {
    const data = await loadBasket();

    // /api/layers/taxonomy-gaps/stats
    if (pathname.endsWith('/stats')) {
      const topics = data.topics;
      const bySeverity = {};
      const byGapType = {};
      const byTopicType = {};
      let totalRussian = 0, totalWestern = 0, totalNeutral = 0;

      for (const t of topics) {
        bySeverity[t.severity] = (bySeverity[t.severity] || 0) + 1;
        byGapType[t.gap_type] = (byGapType[t.gap_type] || 0) + 1;
        byTopicType[t.topic_type || 'unknown'] = (byTopicType[t.topic_type || 'unknown'] || 0) + 1;
        totalRussian += t.russian_count || 0;
        totalWestern += t.western_count || 0;
        totalNeutral += t.neutral_count || 0;
      }

      return sendJSON(res, 200, {
        stats: {
          count: topics.length,
          by_severity: bySeverity,
          by_gap_type: byGapType,
          by_topic_type: byTopicType,
          totals: {
            russian_count: totalRussian,
            western_count: totalWestern,
            neutral_count: totalNeutral,
            ratio: totalWestern > 0 ? Math.round(totalRussian / totalWestern * 10) / 10 : null,
          },
        },
        source: data.source,
        meta: data.meta,
      });
    }

    // /api/layers/taxonomy-gaps/status
    if (pathname.endsWith('/status')) {
      const high = data.topics.filter(t => t.severity === 'high').length;
      return sendJSON(res, 200, {
        status: data.error ? 'degraded' : 'online',
        count: data.topics.length,
        high,
        source: data.error ? null : data.source,
        hint: data.hint || null,
        generated_at: new Date().toISOString(),
      });
    }

    // /api/layers/taxonomy-gaps/topics
    if (pathname.endsWith('/topics')) {
      const topics = applyFilters(data.topics, query);
      return sendJSON(res, 200, { count: topics.length, topics });
    }

    // /api/layers/taxonomy-gaps/silence
    if (pathname.endsWith('/silence')) {
      const topics = data.topics.filter(t => t.gap_type === 'western_silence' || t.gap_type === 'russian_silence');
      return sendJSON(res, 200, { count: topics.length, topics });
    }

    // /api/layers/taxonomy-gaps/undercovered
    if (pathname.endsWith('/undercovered')) {
      const topics = data.topics.filter(t => t.gap_type.includes('undercovered'));
      return sendJSON(res, 200, { count: topics.length, topics });
    }

    // /api/layers/taxonomy-gaps/high
    if (pathname.endsWith('/high')) {
      const topics = data.topics.filter(t => t.severity === 'high');
      return sendJSON(res, 200, { count: topics.length, topics });
    }

    // /api/layers/taxonomy-gaps/top?n=10
    if (pathname.endsWith('/top')) {
      const n = parseInt(query.n, 10) || 10;
      const topics = [...data.topics].sort((a, b) => (b.total_events || 0) - (a.total_events || 0)).slice(0, n);
      return sendJSON(res, 200, { count: topics.length, topics });
    }

    // /api/layers/taxonomy-gaps/categories
    if (pathname.endsWith('/categories')) {
      const byType = {};
      for (const t of data.topics) {
        const k = t.topic_type || 'unknown';
        byType[k] = (byType[k] || 0) + 1;
      }
      return sendJSON(res, 200, { categories: Object.entries(byType).map(([name, count]) => ({ name, count })) });
    }

    // /api/layers/taxonomy-gaps/gap-types
    if (pathname.endsWith('/gap-types')) {
      const byType = {};
      for (const t of data.topics) {
        byType[t.gap_type] = (byType[t.gap_type] || 0) + 1;
      }
      return sendJSON(res, 200, { gap_types: Object.entries(byType).map(([name, count]) => ({ name, count })) });
    }

    // /api/layers/taxonomy-gaps/featurecollection
    if (pathname.endsWith('/featurecollection')) {
      return sendJSON(res, 200, { type: 'FeatureCollection', features: [] });
    }

    // /api/layers/taxonomy-gaps — корень
    const topics = applyFilters(data.topics, query);
    return sendJSON(res, 200, {
      _meta: data.meta,
      count: topics.length,
      total: data.topics.length,
      topics,
    });

  } catch (e) {
    console.error('[taxonomy-gaps] error:', e.message);
    return sendJSON(res, 500, { error: e.message });
  }
}
