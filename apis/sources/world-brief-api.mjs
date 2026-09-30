/**
 * world-brief-api.mjs — мировой брифинг Crucix
 * Версия 1.0.1 (20.09.2026). Переименование topCorrelations → newsPairs, фильтр пар.
 * Контракт v2 (route + method + meta + handler).
 *
 * Назначение: агрегирует данные из готовых аналитических источников в единый
 * мировой брифинг. Аналог get_world_brief у World Monitor, но построен
 * над Crucix-аналитикой (66 анализаторов, 8 категорий, 30 наук).
 *
 * РАЗГРАНИЧЕНИЕ ДВУХ ФУНКЦИОНАЛОВ (критично для правильного чтения ответа):
 *
 *   ФУНКЦИОНАЛ 1 — CONVERGENCES (секция "convergences").
 *     Что: схождение сигналов анализаторов из 8 категорий в одном регионе.
 *     Источник: specialist/convergence-engine.json.
 *     Единица: РЕГИОН (GLOBAL, IRN, UKR, JPN, RUS, USA).
 *     Уровень: high/medium/low по convergenceScore.
 *     Аналог: get_signal_convergence у World Monitor (но глубже — 8 категорий × 30 наук).
 *
 *   ФУНКЦИОНАЛ 2 — NEWS PAIRS (секция "newsPairs").
 *     Что: пара конкретных новостей из разных потоков (RSS ↔ GDELT), связанных
 *          по времени/гео/сущностям.
 *     Источник: warehouse/correlations/correlations-*.json.
 *     Единица: ПАРА СОБЫТИЙ (eventA + eventB).
 *     Уровень: high/medium/low по score.
 *     Аналог: у World Monitor в явном виде НЕТ — это расширение Crucix.
 *
 *   ЭТО ДВА РАЗНЫХ ФУНКЦИОНАЛА, НЕ ДУБЛИ. Оба выводятся в брифинге.
 *
 * ИСТОЧНИКИ:
 *   specialist/convergence-engine.json       → convergences
 *   specialist/strategic-risk-composite.json → topRisk
 *   index/country-instability.json           → topInstability
 *   index/resilience-index.json              → topLowResilience
 *   forecast/social-briefing.json            → socialBriefing
 *   warehouse/documents/news-*.json          → topEvents
 *   warehouse/correlations/correlations-*.json → newsPairs
 *
 * Эндпоинт: /api/layers/world-brief
 */

import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const ANALYTICS = join(ROOT, 'data', 'analytics');
const WAREHOUSE = join(ROOT, 'data', 'warehouse');

const FILES = {
  convergence:     join(ANALYTICS, 'specialist', 'convergence-engine.json'),
  strategic:       join(ANALYTICS, 'specialist', 'strategic-risk-composite.json'),
  instability:     join(ANALYTICS, 'index', 'country-instability.json'),
  resilience:      join(ANALYTICS, 'index', 'resilience-index.json'),
  socialBriefing:  join(ANALYTICS, 'forecast', 'social-briefing.json'),
  documentsDir:    join(WAREHOUSE, 'documents'),
  correlationsDir: join(WAREHOUSE, 'correlations'),
};

// ─── Утилиты ───
async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, 'utf-8'));
  } catch {
    return fallback;
  }
}

async function getLatestFile(dir, prefix) {
  try {
    const files = await readdir(dir);
    const matched = files
      .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
      .sort();
    if (matched.length === 0) return null;
    return join(dir, matched[matched.length - 1]);
  } catch {
    return null;
  }
}

function scoreToLevel(score) {
  if (typeof score !== 'number') return 'unknown';
  if (score >= 70) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 30) return 'medium';
  if (score >= 15) return 'low';
  return 'minimal';
}

// ─── Секция 1: CONVERGENCES (схождение сигналов анализаторов) ───
function buildConvergencesSection(convergenceData) {
  const raw = convergenceData?.data?.convergences || [];
  const globalCv = raw.find(c => c.region === 'GLOBAL') || null;
  const regionalCv = raw.filter(c => c.region !== 'GLOBAL');

  return {
    global: globalCv ? {
      region: 'GLOBAL',
      level: globalCv.level,
      categories: globalCv.categories,
      moduleCount: globalCv.moduleCount,
      weightedSignal: globalCv.weightedSignal,
      convergenceScore: globalCv.convergenceScore,
    } : null,
    regions: regionalCv.map(cv => ({
      region: cv.region,
      level: cv.level,
      categories: cv.categories,
      moduleCount: cv.moduleCount,
      convergenceScore: cv.convergenceScore,
    })),
    sourceUpdatedAt: convergenceData?._meta?.updated_at || null,
  };
}

// ─── Секция 2: topRisk (топ стран по стратегическому риску) ───
function buildTopRiskSection(strategicData, limit = 10) {
  const countries = strategicData?.data?.countries || {};
  const arr = Object.entries(countries)
    .map(([iso3, v]) => ({
      iso3,
      name: v.countryName,
      score: v.score,
      tier: v.tier,
      regime: v.regime,
      level: scoreToLevel(v.score),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return {
    countries: arr,
    sourceUpdatedAt: strategicData?._meta?.updated_at || null,
  };
}

// ─── Секция 3: topInstability (топ стран по CII) ───
function buildTopInstabilitySection(instabilityData, limit = 10) {
  const countries = instabilityData?.data?.countries || {};
  const arr = Object.entries(countries)
    .map(([iso3, v]) => ({
      iso3,
      name: v.countryName,
      score: v.score,
      regime: v.regime,
      atWar: v.atWar,
      level: scoreToLevel(v.score),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return {
    countries: arr,
    sourceUpdatedAt: instabilityData?._meta?.updated_at || null,
  };
}

// ─── Секция 4: topLowResilience (дефицит устойчивости) ───
function buildTopLowResilienceSection(resilienceData, limit = 10) {
  const countries = resilienceData?.data?.countries || {};
  const arr = Object.entries(countries)
    .map(([iso3, v]) => ({
      iso3,
      name: v.countryName,
      score: v.score,
      deficit: 100 - v.score,
      level: scoreToLevel(100 - v.score),
    }))
    .sort((a, b) => b.deficit - a.deficit)
    .slice(0, limit);
  return {
    countries: arr,
    sourceUpdatedAt: resilienceData?._meta?.updated_at || null,
  };
}

// ─── Секция 5: topEvents (топ свежих событий) ───
async function buildTopEventsSection(limit = 10) {
  const latest = await getLatestFile(FILES.documentsDir, 'news-');
  if (!latest) return { events: [], sourceFile: null };

  const docs = await readJson(latest, []);
  if (!Array.isArray(docs)) return { events: [], sourceFile: null };

  const weight = { critical: 5, high: 4, medium: 3, low: 2, none: 1, unknown: 0 };
  const sorted = docs
    .map(d => ({
      id: d.id || d.guid || '',
      title: d.title || '',
      stream: d.stream || 'unknown',
      source: d.source || 'unknown',
      pubDate: d.pubDate || '',
      threatLevel: d.threat?.level || 'none',
      threatScore: d.threat?.score || 0,
      hasGeo: !!(d.geo && typeof d.geo.lat === 'number'),
      lat: d.geo?.lat ?? null,
      lon: d.geo?.lon ?? null,
      region: d.geo?.countryCode || null,
      matchType: d.geo?.matchType || null,
    }))
    .sort((a, b) => {
      const wa = weight[a.threatLevel] || 0;
      const wb = weight[b.threatLevel] || 0;
      if (wa !== wb) return wb - wa;
      return (b.threatScore || 0) - (a.threatScore || 0);
    })
    .slice(0, limit);

  return {
    events: sorted,
    sourceFile: latest.split('/').slice(-1)[0],
    totalDocuments: docs.length,
  };
}

// ─── Секция 6: newsPairs (пары новостей RSS ↔ GDELT) ───
// ВАЖНО: это НЕ convergences. Здесь пары конкретных событий из разных потоков.
// Фильтр: оставляем только пары, где минимум ДВА из трёх компонентов
// (time, geo, entity) строго больше нуля. Это отсекает ложные geo-only пары
// ("обе статьи про Китай" → components={time:0, geo:1, entity:0}).
// Если components отсутствует или повреждён → nz=0 → пара отбрасывается.
async function buildNewsPairsSection(limit = 10) {
  const latest = await getLatestFile(FILES.correlationsDir, 'correlations-');
  if (!latest) return { pairs: [], sourceFile: null, totalPairs: 0, filteredOut: 0 };

  const data = await readJson(latest, null);
  if (!data || !Array.isArray(data.correlations)) {
    return { pairs: [], sourceFile: latest.split('/').slice(-1)[0], totalPairs: 0, filteredOut: 0 };
  }

  const all = data.correlations;
  const meaningful = all.filter(c => {
    // Основной путь: есть явное поле nonzeroComponents (v3.0.0+ cross-stream API).
    if (typeof c.nonzeroComponents === 'number') return c.nonzeroComponents >= 2;
    // Fallback: считаем сами по components. Если components нет → nz=0 → отброшено.
    const nz = [
      (c.components?.time || 0) > 0,
      (c.components?.geo || 0) > 0,
      (c.components?.entity || 0) > 0,
    ].filter(Boolean).length;
    return nz >= 2;
  });

  const top = meaningful.slice(0, limit).map(c => ({
    score: c.score,
    level: c.level,
    components: c.components,
    nonzeroComponents: c.nonzeroComponents ?? null,
    eventA: {
      stream: c.eventA?.stream,
      title: c.eventA?.title?.slice(0, 120) || '',
    },
    eventB: {
      stream: c.eventB?.stream,
      title: c.eventB?.title?.slice(0, 120) || '',
    },
  }));

  return {
    pairs: top,
    totalPairs: all.length,
    filteredOut: all.length - meaningful.length,
    stats: data.stats || null,
    sourceFile: latest.split('/').slice(-1)[0],
  };
}

// ─── Сборка брифинга ───
async function buildWorldBrief() {
  const [convergence, strategic, instability, resilience, social] =
    await Promise.all([
      readJson(FILES.convergence),
      readJson(FILES.strategic),
      readJson(FILES.instability),
      readJson(FILES.resilience),
      readJson(FILES.socialBriefing),
    ]);

  const [topEvents, newsPairs] = await Promise.all([
    buildTopEventsSection(10),
    buildNewsPairsSection(10),
  ]);

  const convergences = buildConvergencesSection(convergence);
  const topRisk = buildTopRiskSection(strategic, 10);
  const topInstability = buildTopInstabilitySection(instability, 10);
  const topLowResilience = buildTopLowResilienceSection(resilience, 10);

  const socialBrief = social?.data?.brief || null;
  const socialSection = socialBrief ? {
    text: socialBrief.text || null,
    provider: socialBrief.provider || 'unknown',
    format: socialBrief.format || 'daily',
    metadata: socialBrief.metadata || null,
    error: socialBrief.error || null,
    generatedAt: social?.data?.generated_at || null,
  } : null;

  const globalLevel = convergences.global?.level || 'unknown';
  const worldSummary = {
    globalConvergenceLevel: globalLevel,
    globalConvergenceScore: convergences.global?.convergenceScore || null,
    regionsWithConvergence: convergences.regions.length,
    topRiskCountry: topRisk.countries[0]?.iso3 || null,
    topInstabilityCountry: topInstability.countries[0]?.iso3 || null,
    alertsCount: topEvents.events.filter(e => e.threatLevel === 'high' || e.threatLevel === 'critical').length,
    newsPairsTotal: newsPairs.totalPairs,
    newsPairsMeaningful: newsPairs.pairs.length,
    briefProvider: socialSection?.provider || 'unknown',
  };

  return {
    brief: worldSummary,
    socialBriefing: socialSection,
    convergences,
    topRisk,
    topInstability,
    topLowResilience,
    topEvents,
    newsPairs,
    meta: {
      generatedAt: new Date().toISOString(),
      sources: {
        convergence: convergence?._meta?.updated_at || null,
        strategic: strategic?._meta?.updated_at || null,
        instability: instability?._meta?.updated_at || null,
        resilience: resilience?._meta?.updated_at || null,
        socialBriefing: social?.data?.generated_at || null,
      },
    },
  };
}

// ─── HTTP-обработчик (контракт v2) ───
export const route = '/api/layers/world-brief';
export const method = 'GET';
export const meta = {
  category: 'geopolitical',
  icon: '🌍',
  color: '#8b5cf6',
  vizType: 'marker',
  source: 'Crucix Analytics',
  collector: null,
  cache: 60,
  description: 'Мировой брифинг: convergences (схождение анализаторов) + topRisk + topInstability + topEvents + newsPairs (пары новостей RSS↔GDELT)',
  unit: 'index',
};

export async function handler(req, res) {
  try {
    const brief = await buildWorldBrief();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(brief, null, 2));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'internal_error', message: err.message }));
  }
}

export default { route, method, meta, handler };
