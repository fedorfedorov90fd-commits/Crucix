/**
 * country-brief-api.mjs — страновой брифинг Crucix
 * Версия 1.0.1 (20.09.2026). Исправлен резолвер под реальную структуру countries.json.
 * Контракт v2 (route + method + meta + handler).
 *
 * Назначение: агрегирует данные из 5 готовых аналитических источников
 * в единый брифинг по стране. Аналог get_country_brief у World Monitor,
 * но построен над Crucix-аналитикой (66 анализаторов, 8 категорий).
 *
 * ИСТОЧНИКИ (data/analytics/):
 *   index/country-instability.json      → score, components, regime, atWar
 *   specialist/strategic-risk-composite → score, tier, components
 *   index/resilience-index.json         → score, pillars, delta
 *   specialist/convergence-engine.json  → convergences по регионам
 *   forecast/social-briefing.json       → текст брифа
 *
 * ВХОД: ?country=XXX (ISO3 | ISO2 | название EN/RU)
 * Эндпоинт: /api/layers/country-brief
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const ANALYTICS = join(ROOT, 'data', 'analytics');
const REFERENCE = join(ROOT, 'data', 'reference');

const FILES = {
  instability:    join(ANALYTICS, 'index', 'country-instability.json'),
  strategic:      join(ANALYTICS, 'specialist', 'strategic-risk-composite.json'),
  resilience:     join(ANALYTICS, 'index', 'resilience-index.json'),
  convergence:    join(ANALYTICS, 'specialist', 'convergence-engine.json'),
  socialBriefing: join(ANALYTICS, 'forecast', 'social-briefing.json'),
  countries:      join(REFERENCE, 'countries.json'),
};

// ─── Утилиты ───
async function readJson(path, fallback = null) {
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
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

// ─── Резолвер страны ───
// Реальная структура countries.json:
//   countries: { "IRN": {iso3, alpha2, numeric, names:{en,ru,local}, centroid, ...}, ... }
//   indexes.by_alpha2: { "IR": "IRN", ... } — маппинг ISO2 → ISO3
//   indexes.by_alias_lower: { "iran": "IRN", ... } — маппинг alias → ISO3
async function resolveCountry(input, countriesRef) {
  if (!input) return null;

  const countries = countriesRef?.countries || {};
  const byAlpha2 = countriesRef?.indexes?.by_alpha2 || {};
  const byAlias  = countriesRef?.indexes?.by_alias_lower || {};

  const raw = String(input).trim();
  const upper = raw.toUpperCase();
  const lower = raw.toLowerCase();

  let iso3 = null;

  // 1. Прямой ISO3 (3 заглавные буквы) — если такая страна есть в объекте countries.
  if (/^[A-Z]{3}$/.test(upper) && countries[upper]) {
    iso3 = upper;
  }

  // 2. ISO2 (2 заглавные буквы) → by_alpha2 → ISO3.
  if (!iso3 && /^[A-Z]{2}$/.test(upper) && byAlpha2[upper]) {
    iso3 = byAlpha2[upper];
  }

  // 3. Поиск по alias (lower) → by_alias_lower → ISO3.
  if (!iso3 && byAlias[lower]) {
    iso3 = byAlias[lower];
  }

  // 4. Поиск по names.en / names.ru вручную (на случай, если alias не сработал).
  if (!iso3) {
    for (const [key, c] of Object.entries(countries)) {
      const en = (c?.names?.en || '').toLowerCase();
      const ru = (c?.names?.ru || '').toLowerCase();
      const local = (c?.names?.local || '').toLowerCase();
      if (en === lower || ru === lower || local === lower) {
        iso3 = key;
        break;
      }
    }
  }

  if (!iso3) return null;

  const c = countries[iso3];
  if (!c) return null;

  return {
    iso3: c.iso3 || iso3,
    iso2: c.alpha2 || null,
    name: c.names?.en || c.names?.ru || iso3,
    nameRu: c.names?.ru || null,
    region: c.region_un || null,
    subregion: c.subregion_un || null,
    capital: c.capital || null,
    centroid: c.centroid || null,
  };
}

// ─── Сборка брифинга ───
async function buildCountryBrief(resolved) {
  const [instability, strategic, resilience, convergence, social] =
    await Promise.all([
      readJson(FILES.instability),
      readJson(FILES.strategic),
      readJson(FILES.resilience),
      readJson(FILES.convergence),
      readJson(FILES.socialBriefing),
    ]);

  const { iso3, iso2, name } = resolved;
  const signals = {};

  // 1. Нестабильность (CII)
  const cii = instability?.data?.countries?.[iso3];
  if (cii) {
    signals.instability = {
      score: cii.score,
      level: scoreToLevel(cii.score),
      components: cii.components,
      regime: cii.regime,
      atWar: cii.atWar,
      source: 'country-instability',
      updatedAt: instability?._meta?.updated_at || null,
    };
  }

  // 2. Стратегический риск
  const strat = strategic?.data?.countries?.[iso3];
  if (strat) {
    signals.strategicRisk = {
      score: strat.score,
      level: scoreToLevel(strat.score),
      tier: strat.tier,
      components: strat.components,
      source: 'strategic-risk-composite',
      updatedAt: strategic?._meta?.updated_at || null,
    };
  }

  // 3. Устойчивость
  const resil = resilience?.data?.countries?.[iso3];
  if (resil) {
    signals.resilience = {
      score: resil.score,
      level: scoreToLevel(resil.score),
      pillars: resil.pillars,
      delta: resil.delta,
      source: 'resilience-index',
      updatedAt: resilience?._meta?.updated_at || null,
    };
  }

  // 4. Схождения по региону (ISO3 или ISO2)
  const convergences = [];
  if (Array.isArray(convergence?.data?.convergences)) {
    for (const cv of convergence.data.convergences) {
      const region = String(cv.region || '').toUpperCase();
      if (region === iso3 || region === iso2 || region === name.toUpperCase()) {
        convergences.push({
          region: cv.region,
          level: cv.level,
          categories: cv.categories,
          moduleCount: cv.moduleCount,
          weightedSignal: cv.weightedSignal,
          convergenceScore: cv.convergenceScore,
          categorySignals: cv.categorySignals,
        });
      }
    }
  }

  // 5. Контекст из social-briefing (общий)
  let briefingContext = null;
  const bText = social?.data?.brief?.text || '';
  if (bText && (bText.includes(name) || bText.includes(iso3) || (iso2 && bText.includes(iso2)))) {
    briefingContext = {
      text: bText,
      provider: social?.data?.brief?.provider || 'unknown',
      metadata: social?.data?.brief?.metadata || null,
    };
  }

  // 6. Сводный уровень риска — максимальный из компонентов
  const order = { critical: 5, high: 4, medium: 3, low: 2, minimal: 1, unknown: 0 };
  const levels = [signals.instability?.level, signals.strategicRisk?.level, signals.resilience?.level].filter(Boolean);
  const topLevel = levels.sort((a, b) => (order[b] || 0) - (order[a] || 0))[0] || 'unknown';

  return {
    country: {
      iso3: resolved.iso3,
      iso2: resolved.iso2,
      name: resolved.name,
      nameRu: resolved.nameRu,
      region: resolved.region,
      subregion: resolved.subregion,
      capital: resolved.capital,
      centroid: resolved.centroid,
    },
    brief: {
      summaryLevel: topLevel,
      hasAlerts: convergences.length > 0 || signals.instability?.atWar === true,
      context: briefingContext,
    },
    signals,
    convergences,
    meta: {
      generatedAt: new Date().toISOString(),
      sources: Object.keys(signals),
      convergencesFound: convergences.length,
    },
  };
}

// ─── HTTP-обработчик (контракт v2) ───
export const route = '/api/layers/country-brief';
export const method = 'GET';
export const meta = {
  category: 'geopolitical',
  icon: '📄',
  color: '#3b82f6',
  vizType: 'marker',
  source: 'Crucix Analytics',
  collector: null,
  cache: 60,
  description: 'Страновой брифинг: нестабильность + стратегический риск + устойчивость + схождения сигналов',
  unit: 'index',
};

export async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const countryInput =
      url.searchParams.get('country') ||
      url.searchParams.get('iso3') ||
      url.searchParams.get('iso2') ||
      url.searchParams.get('q');

    if (!countryInput) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        error: 'missing_country',
        message: 'Укажите ?country=ISO3 | ISO2 | название',
        examples: ['?country=IR', '?country=IRN', '?country=Iran', '?country=Иран'],
      }));
      return;
    }

    const countriesRef = await readJson(FILES.countries, { countries: {}, indexes: {} });
    const resolved = await resolveCountry(countryInput, countriesRef);

    if (!resolved) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        error: 'country_not_found',
        input: countryInput,
        message: 'Страна не найдена. Проверьте ISO3 / ISO2 / название (en или ru).',
      }));
      return;
    }

    const brief = await buildCountryBrief(resolved);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(brief, null, 2));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'internal_error', message: err.message }));
  }
}

export default { route, method, meta, handler };
