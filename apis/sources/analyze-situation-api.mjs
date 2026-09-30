/**
 * analyze-situation-api.mjs — единая точка входа для анализа ситуации
 * Версия 1.0.1. Принят 20.09.2026.
 * Контракт v2 (route + method + meta + handler).
 *
 * Назначение: принимает вопрос/страну/регион, агрегирует сигналы из ВСЕХ
 * доступных анализаторов в data/analytics/ (все категории), нормализует и
 * возвращает единый структурированный ответ с сводным скором схождения.
 *
 * Аналог analyze_situation у World Monitor, но глубже: у Crucix — 44 файла
 * аналитики в 7 категориях, а не только сводка по RSS.
 *
 * ВХОД:
 *   ?q=что в Иране              — вопрос на естественном языке
 *   ?country=IR                 — ISO3/ISO2/EN/RU
 *   ?country=IR&topic=conflict  — страна + тема
 *
 * ВЫХОД:
 *   { query, resolved, signals, byCategory, convergence, alerts, summary }
 *
 * Эндпоинт: /api/layers/analyze-situation
 */

import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const ANALYTICS = join(ROOT, 'data', 'analytics');
const REFERENCE = join(ROOT, 'data', 'reference');

const COUNTRIES_FILE = join(REFERENCE, 'countries.json');

// ─── Категории анализа (порядок для вывода) ───
const CATEGORIES = ['index', 'specialist', 'detector', 'semantic', 'forecast', 'flow', 'market', 'space'];

// ─── Утилиты ───
async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, 'utf-8'));
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

function levelWeight(level) {
  return { critical: 5, high: 4, medium: 3, low: 2, minimal: 1, moderate: 2, unknown: 0 }[level] || 0;
}

// ─── Резолвер страны ───
async function resolveCountry(input, countriesRef) {
  if (!input) return null;
  const countries = countriesRef?.countries || {};
  const byAlpha2 = countriesRef?.indexes?.by_alpha2 || {};
  const byAlias  = countriesRef?.indexes?.by_alias_lower || {};

  const raw = String(input).trim();
  const upper = raw.toUpperCase();
  const lower = raw.toLowerCase();

  let iso3 = null;

  if (/^[A-Z]{3}$/.test(upper) && countries[upper]) iso3 = upper;
  if (!iso3 && /^[A-Z]{2}$/.test(upper) && byAlpha2[upper]) iso3 = byAlpha2[upper];
  if (!iso3 && byAlias[lower]) iso3 = byAlias[lower];

  if (!iso3) {
    for (const [key, c] of Object.entries(countries)) {
      const en = (c?.names?.en || '').toLowerCase();
      const ru = (c?.names?.ru || '').toLowerCase();
      if (en === lower || ru === lower) { iso3 = key; break; }
    }
  }

  if (!iso3) return null;
  const c = countries[iso3];
  if (!c) return null;

  return {
    iso3: c.iso3 || iso3,
    iso2: c.alpha2 || null,
    name: c.names?.en || iso3,
    nameRu: c.names?.ru || null,
    nameUpper: (c.names?.en || iso3).toUpperCase(),
    region: c.region_un || null,
    subregion: c.subregion_un || null,
  };
}

// ─── Извлечение страны из запроса ───
function extractCountryFromQuery(q, countriesRef) {
  if (!q) return null;
  const lower = q.toLowerCase();

  const byAlias = countriesRef?.indexes?.by_alias_lower || {};
  for (const [alias, iso3] of Object.entries(byAlias)) {
    if (alias.length >= 3 && lower.includes(alias)) {
      return iso3;
    }
  }

  const countries = countriesRef?.countries || {};
  for (const [iso3, c] of Object.entries(countries)) {
    const ru = (c?.names?.ru || '').toLowerCase();
    if (ru.length >= 3 && lower.includes(ru)) return iso3;
  }

  return null;
}

// ─── Extractors ───

// Strategy A: ISO3-ключ в data.countries
function extractByIso3Key(json, iso3) {
  const c = json?.data?.countries?.[iso3];
  if (!c || typeof c.score !== 'number') return null;
  return {
    value: c.score,
    level: scoreToLevel(c.score),
    components: c.components || null,
    extra: {
      regime: c.regime || null,
      atWar: c.atWar ?? null,
      tier: c.tier ?? null,
      pillars: c.pillars || null,
    },
  };
}

// Strategy B: массив data.countries[] с полем country (UPPERCASE строка)
function extractByCountryString(json, resolved) {
  const arr = json?.data?.countries;
  if (!Array.isArray(arr)) return null;
  const target = resolved.nameUpper;
  const found = arr.find(c => (c.country || '').toUpperCase() === target);
  if (!found) return null;
  const val = found.deceptionIndex ?? found.score ?? found.index ?? null;
  if (typeof val !== 'number') return null;
  return {
    value: val,
    level: found.level || scoreToLevel(val),
    components: found.components || null,
    extra: { componentsPresent: found.componentsPresent ?? null },
  };
}

// Strategy C: массив data.drifts[] с полем country
function extractByDrifts(json, resolved) {
  const arr = json?.data?.drifts;
  if (!Array.isArray(arr)) return null;
  const target = resolved.nameUpper;
  const found = arr.find(c => (c.country || '').toUpperCase() === target);
  if (!found) return null;
  const val = found.driftScore ?? null;
  if (typeof val !== 'number') return null;
  return {
    value: val,
    level: found.level || scoreToLevel(val * 25),
    components: null,
    extra: { statements: found.statements, actions: found.actions, imbalance: found.imbalance, themes: found.themes },
  };
}

// Strategy D: массив data.classifications[] с полем region
function extractByRegion(json, resolved) {
  const arr = json?.data?.classifications;
  if (!Array.isArray(arr)) return null;
  const target = resolved.name.toLowerCase();
  const found = arr.find(c => (c.region || '').toLowerCase() === target);
  if (!found) return null;
  const val = found.weightedSeverity ?? null;
  return {
    value: val,
    level: found.level || scoreToLevel(val),
    components: null,
    extra: { types: found.types, severity: found.severity, labels: found.labels },
  };
}

// Strategy E: политическая стабильность (русские коды)
function extractPoliticalStability(json, resolved) {
  const arr = json?.data?.items;
  if (!Array.isArray(arr)) return null;
  const ruName = (resolved.nameRu || '').toLowerCase();
  const found = arr.find(c => (c.code || '').toLowerCase() === ruName);
  if (!found) return null;
  const val = found.score;
  return {
    value: val,
    level: found.level || scoreToLevel(val),
    components: null,
    extra: {},
  };
}

// Strategy F: convergence-engine
function extractConvergence(json, resolved) {
  const arr = json?.data?.convergences;
  if (!Array.isArray(arr)) return null;
  const found = arr.find(c => c.region === resolved.iso3 || c.region === resolved.iso2);
  if (!found) return null;
  return {
    value: found.convergenceScore,
    level: found.level || scoreToLevel(found.convergenceScore * 30),
    components: found.categorySignals || null,
    extra: { categories: found.categories, moduleCount: found.moduleCount, weightedSignal: found.weightedSignal },
  };
}

// Strategy G: эскалация конфликтов
function extractEscalation(json, resolved) {
  const arr = json?.data?.conflicts;
  if (!Array.isArray(arr)) return null;
  const nameLower = resolved.name.toLowerCase();
  const isoLower = resolved.iso3.toLowerCase();
  const found = arr.find(c =>
    (c.region || '').toLowerCase().includes(nameLower) ||
    (c.conflictId || '').toLowerCase() === isoLower ||
    (c.conflictId || '').toLowerCase() === nameLower
  );
  if (!found) return null;
  const val = found.intensity;
  return {
    value: val,
    level: scoreToLevel(val * 5),
    components: null,
    extra: {
      currentLevel: found.currentLevelName,
      trajectory: found.trajectory,
      nextLevel: found.nextLevelName,
      nextLevelRisk: found.nextLevelRisk,
    },
  };
}

// ─── Реестр extractors по id анализатора ───
const EXTRACTORS = {
  'country-instability':          { category: 'index',      fn: 'iso3key',       label: 'Нестабильность (CII)',       unit: 'score 0-100' },
  'resilience-index':             { category: 'index',      fn: 'iso3key',       label: 'Устойчивость',                unit: 'score 0-100' },
  'strategic-risk-composite':     { category: 'specialist', fn: 'iso3key',       label: 'Стратегический риск',         unit: 'score 0-100' },
  'deception-index':              { category: 'specialist', fn: 'country',       label: 'Индекс обмана',               unit: 'index 0-1' },
  'narrative-drift':              { category: 'specialist', fn: 'drifts',        label: 'Дрейф нарративов',            unit: 'driftScore' },
  'political-stability-monitor':  { category: 'specialist', fn: 'polstability',  label: 'Политическая стабильность',   unit: 'score 0-100' },
  'threat-classification':        { category: 'detector',   fn: 'region',        label: 'Классификация угроз',         unit: 'weightedSeverity' },
  'conflict-escalation-tracker':  { category: 'forecast',   fn: 'escalation',    label: 'Эскалация конфликтов',        unit: 'intensity' },
  'convergence-engine':           { category: 'specialist', fn: 'convergence',   label: 'Схождение сигналов (регион)', unit: 'convergenceScore' },
};

function runExtractor(strategy, json, resolved) {
  switch (strategy) {
    case 'iso3key':      return extractByIso3Key(json, resolved.iso3);
    case 'country':      return extractByCountryString(json, resolved);
    case 'drifts':       return extractByDrifts(json, resolved);
    case 'region':       return extractByRegion(json, resolved);
    case 'polstability': return extractPoliticalStability(json, resolved);
    case 'convergence':  return extractConvergence(json, resolved);
    case 'escalation':   return extractEscalation(json, resolved);
    default:             return null;
  }
}

// ─── Сканирование всех файлов аналитики ───
async function scanAnalytics(resolved) {
  const signals = [];
  const byCategory = {};

  for (const category of CATEGORIES) {
    const dir = join(ANALYTICS, category);
    let files;
    try {
      files = await readdir(dir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith('.json') || file.startsWith('_')) continue;
      const id = file.replace('.json', '');
      const extractor = EXTRACTORS[id];

      const json = await readJson(join(dir, file));

      let signal = null;
      let label = id;
      let unit = null;

      if (extractor) {
        label = extractor.label;
        unit = extractor.unit;
        signal = runExtractor(extractor.fn, json, resolved);
      }

      if (signal) {
        const entry = {
          source: id,
          category,
          label,
          unit,
          value: signal.value,
          level: signal.level,
          components: signal.components,
          extra: signal.extra || null,
          sourceUpdatedAt: json?._meta?.updated_at || null,
        };
        signals.push(entry);
        if (!byCategory[category]) byCategory[category] = [];
        byCategory[category].push(entry);
      }
    }
  }

  return { signals, byCategory };
}

// ─── Сводная агрегация ───
function computeConvergence(signals) {
  if (signals.length === 0) {
    return { categories: 0, signals: 0, weightedSignal: 0, convergenceScore: 0, level: 'unknown' };
  }

  const categories = new Set(signals.map(s => s.category));
  const levelToValue = { critical: 1, high: 0.8, medium: 0.5, low: 0.3, minimal: 0.1, moderate: 0.5, unknown: 0 };

  const catValues = {};
  for (const cat of categories) {
    const inCat = signals.filter(s => s.category === cat);
    const avgLevel = inCat.reduce((sum, s) => sum + (levelToValue[s.level] || 0), 0) / inCat.length;
    catValues[cat] = Math.round(avgLevel * 1000) / 1000;
  }

  const weightedSignal = Object.values(catValues).reduce((a, b) => a + b, 0) / categories.size;
  const convergenceScore = Math.round(Math.sqrt(categories.size) * weightedSignal * 100) / 100;

  let level = 'minimal';
  if (convergenceScore >= 1.5) level = 'critical';
  else if (convergenceScore >= 1.0) level = 'high';
  else if (convergenceScore >= 0.6) level = 'medium';
  else if (convergenceScore >= 0.3) level = 'low';

  return {
    categories: categories.size,
    signals: signals.length,
    categoryValues: catValues,
    weightedSignal: Math.round(weightedSignal * 1000) / 1000,
    convergenceScore,
    level,
  };
}

function collectAlerts(signals) {
  return signals
    .filter(s => s.level === 'high' || s.level === 'critical')
    .map(s => ({
      source: s.source,
      label: s.label,
      value: s.value,
      level: s.level,
      category: s.category,
    }))
    .sort((a, b) => levelWeight(b.level) - levelWeight(a.level));
}

function buildRecommendations(convergence, alerts, resolved) {
  const recs = [];
  if (convergence.level === 'critical' || convergence.level === 'high') {
    recs.push('Высокое схождение сигналов по ' + (resolved.nameRu || resolved.name) + ': ' + convergence.categories + ' категорий, score ' + convergence.convergenceScore + '. Требуется детальный разбор.');
  }
  if (alerts.length > 0) {
    recs.push('Алертов: ' + alerts.length + '. Главный источник: ' + alerts[0].source + ' (' + alerts[0].label + ', ' + alerts[0].level + ').');
  }
  if (convergence.categories <= 1) {
    recs.push('Мало категорий с сигналом — интерпретировать с осторожностью.');
  }
  return recs;
}

// ─── Сборка ответа ───
async function buildSituation(query) {
  const countriesRef = await readJson(COUNTRIES_FILE, { countries: {}, indexes: {} });

  let iso3OrName = query.country || extractCountryFromQuery(query.q, countriesRef);
  if (!iso3OrName) {
    return {
      error: 'country_not_recognized',
      input: query,
      message: 'Не удалось определить страну из запроса.',
    };
  }

  const resolved = await resolveCountry(iso3OrName, countriesRef);
  if (!resolved) {
    return {
      error: 'country_not_found',
      input: iso3OrName,
      message: 'Страна не найдена в справочнике.',
    };
  }

  const { signals, byCategory } = await scanAnalytics(resolved);
  const convergence = computeConvergence(signals);
  const alerts = collectAlerts(signals);
  const recommendations = buildRecommendations(convergence, alerts, resolved);

  return {
    query,
    resolved: {
      iso3: resolved.iso3,
      iso2: resolved.iso2,
      name: resolved.name,
      nameRu: resolved.nameRu,
      region: resolved.region,
      subregion: resolved.subregion,
    },
    convergence,
    signals,
    byCategory,
    alerts,
    recommendations,
    meta: {
      generatedAt: new Date().toISOString(),
      categoriesScanned: Object.keys(byCategory).length,
      signalsFound: signals.length,
    },
  };
}

// ─── HTTP-обработчик (контракт v2) ───
export const route = '/api/layers/analyze-situation';
export const method = 'GET';
export const meta = {
  category: 'geopolitical',
  icon: '🔎',
  color: '#10b981',
  vizType: 'marker',
  source: 'Crucix Analytics',
  collector: null,
  cache: 60,
  description: 'Единая точка входа: вопрос → сводный ответ из 44 файлов аналитики (8 категорий, 30 наук)',
  unit: 'index',
};

export async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const query = {
      q: url.searchParams.get('q') || null,
      country: url.searchParams.get('country') || null,
      topic: url.searchParams.get('topic') || null,
    };

    if (!query.q && !query.country) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        error: 'missing_query',
        message: 'Укажите ?q=вопрос или ?country=ISO3|ISO2|EN|RU',
        examples: ['?country=IR', '?q=что в Иране', '?country=UKR&topic=conflict'],
      }));
      return;
    }

    const result = await buildSituation(query);

    if (result.error) {
      res.writeHead(result.error === 'country_not_found' ? 404 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result, null, 2));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result, null, 2));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'internal_error', message: err.message }));
  }
}

export default { route, method, meta, handler };
