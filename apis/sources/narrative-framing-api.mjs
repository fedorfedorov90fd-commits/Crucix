/**
 * apis/sources/narrative-framing-api.mjs — API-МОДУЛЬ: ПОЛЯРИЗАЦИЯ ФРЕЙМИНГОВ
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 * ИСТОЧНИК: data/basket/narrative-framing.json — { topics:[...], meta? } ИЛИ [...].
 * Сборщик: scripts/collectors/collect-narrative-framing.mjs.
 *
 * Поляризация фреймингов: сравнивает тональность освещения темы
 * российскими и западными источниками. Также — латентность реакции
 * (насколько быстро западные СМИ подхватывают новость после российских
 * или наоборот).
 *
 * Тема:
 *   { topic, name, topic_type, polarity_russian, polarity_western,
 *     polarity_delta, russian_count, western_count, neutral_count,
 *     latency_hours, gap_type, severity, sample_titles }
 *
 * Классификация gap_type:
 *   - framing_gap  — обе стороны пишут, но с разной тональностью (|delta| >= 0.3)
 *   - reaction_gap — обе стороны пишут, но с большой задержкой (latency >= 6h)
 *   - silence_gap  — одна сторона пишет, другая молчит
 *
 * Severity: high (|delta| >= 0.7 или latency >= 12h), normal (|delta| >= 0.3 или latency >= 6h).
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?severity=, ?gap_type=, ?topic_type=, ?min_delta=, ?limit=, ?top=, ?sort=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /                    — корень (список тем с фрейминг-разрывами)
 *   GET /stats               — агрегированная статистика
 *   GET /status              — health-check
 *   GET /topics              — все темы
 *   GET /topics/:topic       — конкретная тема
 *   GET /framing             — только framing_gap
 *   GET /reaction            — только reaction_gap
 *   GET /high                — только severity=high
 *   GET /top?n=N             — топ-N по |polarity_delta|
 *   GET /categories          — группировка по topic_type
 *   GET /severity            — группировка по severity
 *   GET /gap-types           — группировка по gap_type
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'narrative-framing.json');

export const route  = '/api/layers/narrative-framing';
export const method = 'GET';

export const meta = {
  category: 'semantic',
  icon: '⚖️',
  color: '#f59e0b',
  vizType: 'marker',
  source: 'basket/narrative-framing.json',
  collector: 'collect-narrative-framing.mjs',
  cache: 300,
  description: 'Поляризация фреймингов: сравнение тональности российских и западных источников по темам',
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

    const enriched = topics.map(t => {
      const delta = t.polarity_delta || 0;
      const absDelta = Math.abs(delta);
      return {
        ...t,
        abs_delta: Math.round(absDelta * 100) / 100,
        severityColor: t.severity === 'high' ? '#ef4444' : '#22c55e',
        gapTypeLabel: {
          framing_gap: 'Разрыв фрейминга',
          reaction_gap: 'Разрыв реакции',
          silence_gap: 'Разрыв молчания',
        }[t.gap_type] || t.gap_type,
      };
    });

    _cache = {
      schema: parsed.schema || 'crucix.basket.v1',
      meta: parsed.meta || {},
      topics: enriched,
      source: 'basket/narrative-framing.json',
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
        source: 'basket/narrative-framing.json',
        error: 'not_found',
        hint: 'запустите scripts/collectors/collect-narrative-framing.mjs',
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
  if (query.min_delta) {
    const min = parseFloat(query.min_delta);
    result = result.filter(t => (t.abs_delta || 0) >= min);
  }
  if (query.q) {
    const q = query.q.toLowerCase();
    result = result.filter(t => (t.topic || '').toLowerCase().includes(q));
  }
  if (query.sort === 'russian') result.sort((a, b) => (b.polarity_russian || 0) - (a.polarity_russian || 0));
  else if (query.sort === 'western') result.sort((a, b) => (b.polarity_western || 0) - (a.polarity_western || 0));
  else if (query.sort === 'latency') result.sort((a, b) => (b.latency_hours || 0) - (a.latency_hours || 0));
  else result.sort((a, b) => (b.abs_delta || 0) - (a.abs_delta || 0));

  const limit = parseInt(query.limit, 10) || 100;
  return result.slice(0, limit);
}

export async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(route, '') || '/';
  const query = Object.fromEntries(url.searchParams);

  try {
    const data = await loadBasket();

    if (path === '/stats') {
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

      return res.end(JSON.stringify({
        stats: {
          count: topics.length,
          by_severity: bySeverity,
          by_gap_type: byGapType,
          by_topic_type: byTopicType,
          totals: {
            russian_count: totalRussian,
            western_count: totalWestern,
            neutral_count: totalNeutral,
          },
        },
        source: data.source,
        meta: data.meta,
      }));
    }

    if (path === '/status') {
      const high = data.topics.filter(t => t.severity === 'high').length;
      return res.end(JSON.stringify({
        status: data.error ? 'degraded' : 'online',
        count: data.topics.length,
        high,
        source: data.error ? null : data.source,
        hint: data.hint || null,
        generated_at: new Date().toISOString(),
      }));
    }

    if (path === '/topics') {
      const topics = applyFilters(data.topics, query);
      return res.end(JSON.stringify({ count: topics.length, topics }));
    }

    if (path.startsWith('/topics/')) {
      const topicId = path.replace('/topics/', '');
      const t = data.topics.find(x => x.topic === topicId);
      if (!t) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'topic not found', topic: topicId }));
      }
      return res.end(JSON.stringify(t));
    }

    if (path === '/framing') {
      const topics = data.topics.filter(t => t.gap_type === 'framing_gap');
      return res.end(JSON.stringify({ count: topics.length, topics }));
    }

    if (path === '/reaction') {
      const topics = data.topics.filter(t => t.gap_type === 'reaction_gap');
      return res.end(JSON.stringify({ count: topics.length, topics }));
    }

    if (path === '/high') {
      const topics = data.topics.filter(t => t.severity === 'high');
      return res.end(JSON.stringify({ count: topics.length, topics }));
    }

    if (path === '/top') {
      const n = parseInt(query.n, 10) || 10;
      const topics = [...data.topics].sort((a, b) => (b.abs_delta || 0) - (a.abs_delta || 0)).slice(0, n);
      return res.end(JSON.stringify({ count: topics.length, topics }));
    }

    if (path === '/categories') {
      const byType = {};
      for (const t of data.topics) {
        const k = t.topic_type || 'unknown';
        byType[k] = (byType[k] || 0) + 1;
      }
      return res.end(JSON.stringify({ categories: Object.entries(byType).map(([name, count]) => ({ name, count })) }));
    }

    if (path === '/severity') {
      const bySev = {};
      for (const t of data.topics) {
        bySev[t.severity] = (bySev[t.severity] || 0) + 1;
      }
      return res.end(JSON.stringify({ severity: Object.entries(bySev).map(([name, count]) => ({ name, count })) }));
    }

    if (path === '/gap-types') {
      const byType = {};
      for (const t of data.topics) {
        byType[t.gap_type] = (byType[t.gap_type] || 0) + 1;
      }
      return res.end(JSON.stringify({ gap_types: Object.entries(byType).map(([name, count]) => ({ name, count })) }));
    }

    // По умолчанию — корень
    const topics = applyFilters(data.topics, query);
    return res.end(JSON.stringify({
      _meta: data.meta,
      count: topics.length,
      total: data.topics.length,
      topics,
    }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: e.message }));
  }
}
