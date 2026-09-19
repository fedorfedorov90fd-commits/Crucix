#!/usr/bin/env node
// Crucix Analyzer: ConvergenceEngine v1.0.4
// Читает: все файлы в data/analytics/*/ (8 категорий)
// Пишет: data/analytics/specialist/convergence-engine.json
//
// УНИКАЛЬНОЕ ПРЕИМУЩЕСТВО НАД КОНКУРЕНТАМИ:
//   World Monitor имеет convergence по 435+ RSS — но только по новостям.
//   Crucix имеет 59 анализаторов из 30 наук. Этот движок ищет схождение
//   сигналов МЕЖДУ категориями: detector × forecast × semantic × flow ×
//   market × specialist × index × space.
//
// АКАДЕМИЧЕСКОЕ ОБОСНОВАНИЕ:
//   Истинный сигнал — когда независимые измерения показывают одно
//   направление. Если detector говорит "аномалия", forecast говорит
//   "эскалация", semantic говорит "рост напряжения", a market говорит
//   "рост волатильности" — это 4-канальное схождение. Одно измерение
//   может ошибаться, четыре независимых — нет.
//
// АЛГОРИТМ:
//   1. Читаем все analytics-файлы, извлекаем _meta.stats и данные.
//   2. Для каждого модуля вычисляем "сигнал" (0..1) по его полям.
//   3. Извлекаем регион/страну из модуля (нормализация к ISO3/стандарту).
//   4. Группируем по регионам.
//   5. Для каждого региона считаем схождение: сколько категорий дало сигнал.
//   6. Итоговый балл схождения: sqrt(categories) × weightedSignal × diversityBoost.

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const ANALYTICS = join(ROOT, 'data', 'analytics');
const OUT_FILE = join(ANALYTICS, 'specialist', 'convergence-engine.json');

const CATEGORIES = [
  'detector', 'forecast', 'semantic', 'flow',
  'market', 'specialist', 'index', 'space',
];

// Минимум независимых категорий для фиксации схождения.
const MIN_CATEGORIES = 3;

// Веса категорий (академически: detector и forecast — первичные,
// semantic и market — подтверждающие, остальные — поддерживающие).
const CATEGORY_WEIGHTS = {
  detector:   1.0,
  forecast:   1.0,
  semantic:   0.8,
  market:     0.8,
  flow:       0.7,
  specialist: 0.7,
  index:      0.6,
  space:      0.5,
};

// ============================================================
//  НОРМАЛИЗАЦИЯ РЕГИОНОВ
// ============================================================

const REGION_NORMALIZE = {
  // Страны — ISO2 и русские названия → ISO3
  'US': 'USA', 'США': 'USA', 'UNITED STATES': 'USA',
  'RU': 'RUS', 'РОССИЯ': 'RUS', 'RUSSIA': 'RUS',
  'CN': 'CHN', 'КИТАЙ': 'CHN', 'CHINA': 'CHN',
  'IN': 'IND', 'ИНДИЯ': 'IND', 'INDIA': 'IND',
  'BR': 'BRA', 'БРАЗИЛИЯ': 'BRA', 'BRAZIL': 'BRA',
  'GB': 'GBR', 'UK': 'GBR', 'ВЕЛИКОБРИТАНИЯ': 'GBR', 'UNITED KINGDOM': 'GBR',
  'DE': 'DEU', 'ГЕРМАНИЯ': 'DEU', 'GERMANY': 'DEU',
  'FR': 'FRA', 'ФРАНЦИЯ': 'FRA', 'FRANCE': 'FRA',
  'JP': 'JPN', 'ЯПОНИЯ': 'JPN', 'JAPAN': 'JPN',
  'UA': 'UKR', 'УКРАИНА': 'UKR', 'UKRAINE': 'UKR',
  'IL': 'ISR', 'ИЗРАИЛЬ': 'ISR', 'ISRAEL': 'ISR',
  'IR': 'IRN', 'ИРАН': 'IRN', 'IRAN': 'IRN',
  'SY': 'SYR', 'СИРИЯ': 'SYR', 'SYRIA': 'SYR',
  'YE': 'YEM', 'ЙЕМЕН': 'YEM', 'YEMEN': 'YEM',
  'SD': 'SDN', 'СУДАН': 'SDN', 'SUDAN': 'SDN',
  'GE': 'GEO', 'ГРУЗИЯ': 'GEO', 'GEORGIA': 'GEO',
  'AF': 'AFG', 'АФГАНИСТАН': 'AFG', 'AFGHANISTAN': 'AFG',
  'VE': 'VEN', 'ВЕНЕСУЭЛА': 'VEN', 'VENEZUELA': 'VEN',
  'HT': 'HTI', 'ГАИТИ': 'HTI', 'HAITI': 'HTI',
  'BI': 'BDI', 'БУРУНДИ': 'BDI', 'BURUNDI': 'BDI',
  'MM': 'MMR', 'МЬЯНМА': 'MMR', 'MYANMAR': 'MMR',
  'MG': 'MDG', 'МАДАГАСКАР': 'MDG', 'MADAGASCAR': 'MDG',
  'ML': 'MLI', 'МАЛИ': 'MLI', 'MALI': 'MLI',
  // Регионы
  'АЗИЯ': 'ASIA',
  'ЕВРОПА': 'EUROPE',
  'АФРИКА': 'AFRICA',
  'АМЕРИКА': 'AMERICAS',
  'ВОСТОЧНАЯ ЕВРОПА': 'EASTERN EUROPE',
  'БЛИЖНИЙ ВОСТОК': 'MIDDLE EAST',
  'ЧЕРНОЕ МОРЕ': 'BLACK SEA', 'ЧЁРНОЕ МОРЕ': 'BLACK SEA',
  'ВОСТОЧНАЯ АЗИЯ': 'EAST ASIA',
  'ЮЖНАЯ АЗИЯ': 'SOUTH ASIA',
  'ЗАПАДНАЯ АФРИКА': 'WEST AFRICA',
  'ВОСТОЧНАЯ АФРИКА': 'EAST AFRICA',
};

const REGION_SKIP = new Set(['UNKNOWN', 'GLOBAL', 'ГЛОБАЛЬНО', 'NONE', 'NULL', 'UNDEFINED']);

function normalizeRegion(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().toUpperCase();
  if (s.length === 0) return null;
  if (REGION_SKIP.has(s)) return null;
  if (REGION_NORMALIZE[s]) return REGION_NORMALIZE[s];
  if (/^[A-Z]{3}$/.test(s)) return s;
  if (/^[A-Z][A-Z _-]{2,}$/.test(s)) return s;
  return s;
}

// ============================================================
//  ЗАГРУЗКА И ИЗВЛЕЧЕНИЕ
// ============================================================

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf-8')); }
  catch { return fallback; }
}

// Вычисляем нормализованный сигнал из модуля. Возвращает 0..1.
function extractSignal(mod, data) {
  if (data === null || data === undefined) return 0;
  const meta = data._meta || {};
  const stats = meta.stats || {};
  const d = data.data || {};

  let raw = 0;

  // УНИВЕРСАЛЬНЫЕ ПОЛЯ (по разведке 73 полей в 59 анализаторах):
  const arrayFields = [
    'checks', 'drifts', 'anomalies', 'clusters', 'silences', 'discrepancies',
    'events', 'hotspots', 'signals', 'items', 'top', 'alerts', 'baselines',
    'focalPoints', 'snapshots', 'detections', 'classifications', 'conflicts',
    'claims', 'ports', 'chokepoints', 'sources', 'entities', 'regions',
    'convergence_events', 'countries', 'topRiskCountries', 'bottom',
    'timeline', 'currentValues',
    'commands', 'indicators', 'tools', 'resources', 'results',
  ];

  for (const field of arrayFields) {
    if (Array.isArray(d[field])) {
      raw += d[field].length;
    } else if (Array.isArray(stats[field])) {
      raw += stats[field].length;
    } else if (typeof stats[field] === 'number') {
      raw += stats[field];
    }
  }

  const scalarFields = [
    'score', 'compositeScore', 'convergenceScore', 'total', 'total_signals',
    'total_regions', 'newsCount',
  ];
  for (const field of scalarFields) {
    if (typeof d[field] === 'number') raw += d[field];
    else if (typeof stats[field] === 'number') raw += stats[field];
  }

  const countObjectFields = [
    'by_type', 'by_region', 'byType', 'byLevel', 'byVerdict',
  ];
  for (const field of countObjectFields) {
    const obj = d[field];
    if (obj && typeof obj === 'object' && Array.isArray(obj) === false) {
      raw += Object.keys(obj).length;
    }
  }

  if (d.extra && typeof d.extra === 'object') {
    const extra = d.extra;
    if (typeof extra.total === 'number') raw += extra.total;
    if (typeof extra.count === 'number') raw += extra.count;
    if (Array.isArray(extra.items)) raw += extra.items.length;
  }

  if (typeof stats.total === 'number' && raw === 0) raw += stats.total;

  // Одиночные объекты с данными (v1.0.1).
  if (d.brief && typeof d.brief === 'object') {
    if (typeof d.brief.length === 'number') raw += d.brief.length;
    else if (typeof d.brief.size === 'number') raw += d.brief.size;
    else if (typeof d.brief.wordCount === 'number') raw += Math.min(d.brief.wordCount / 100, 10);
    else raw += 1;
  }
  if (d.composite && typeof d.composite === 'object') {
    if (typeof d.composite.score === 'number') raw += Math.abs(d.composite.score) * 10;
    else if (Array.isArray(d.composite.sources)) raw += d.composite.sources.length;
    else raw += 1;
  }
  if (d.executionResult && typeof d.executionResult === 'object') {
    if (typeof d.executionResult.nodes === 'number') raw += d.executionResult.nodes;
    if (typeof d.executionResult.edges === 'number') raw += d.executionResult.edges;
    if (Array.isArray(d.executionResult.steps)) raw += d.executionResult.steps.length;
  }
  if (d.dashboard && typeof d.dashboard === 'object') {
    const dk = Object.keys(d.dashboard).length;
    if (dk > 0) raw += dk;
  }

  // Расширенные stats (v1.0.1).
  if (typeof stats.commands === 'number') raw += stats.commands;
  if (typeof stats.indicators === 'number') raw += stats.indicators;
  if (typeof stats.tools === 'number') raw += stats.tools;
  if (typeof stats.resources === 'number') raw += stats.resources;
  if (typeof stats.sessions === 'number') raw += stats.sessions;
  if (typeof stats.nodes === 'number') raw += stats.nodes;
  if (typeof stats.edges === 'number') raw += stats.edges;
  if (typeof stats.scenarios === 'number') raw += stats.scenarios;

  if (raw <= 0) return 0;
  return Math.min(Math.log(1 + raw) / Math.log(1 + 100), 1);
}

// Извлекаем регион/страну из модуля.
function extractRegion(mod, data) {
  if (data === null || data === undefined) return ['GLOBAL'];
  const d = data.data || {};
  const found = new Set();

  if (d.by_country && typeof d.by_country === 'object' && Array.isArray(d.by_country) === false) {
    for (const k of Object.keys(d.by_country)) {
      const nr = normalizeRegion(k);
      if (nr !== null) found.add(nr);
    }
  }
  if (d.by_region && typeof d.by_region === 'object' && Array.isArray(d.by_region) === false) {
    for (const k of Object.keys(d.by_region)) {
      const nr = normalizeRegion(k);
      if (nr !== null) found.add(nr);
    }
  }

  const regionArrays = ['countries', 'drifts', 'items', 'top', 'hotspots', 'anomalies', 'clusters', 'alerts', 'regions', 'convergence_events', 'bottom', 'topRiskCountries', 'detections', 'classifications', 'conflicts', 'ports', 'chokepoints'];
  for (const field of regionArrays) {
    const arr = d[field];
    if (Array.isArray(arr) === false) continue;
    for (const item of arr.slice(0, 30)) {
      if (item === null || typeof item !== 'object') continue;
      const r = item.country || item.region || item.code || item.iso3 || item.countryCode;
      if (r) {
        const nr = normalizeRegion(r);
        if (nr !== null) found.add(nr);
      }
    }
  }

  const stats = (data._meta && data._meta.stats) ? data._meta.stats : {};
  if (stats.by_country && typeof stats.by_country === 'object') {
    for (const k of Object.keys(stats.by_country)) {
      const nr = normalizeRegion(k);
      if (nr !== null) found.add(nr);
    }
  }
  if (stats.by_region && typeof stats.by_region === 'object') {
    for (const k of Object.keys(stats.by_region)) {
      const nr = normalizeRegion(k);
      if (nr !== null) found.add(nr);
    }
  }

  if (found.size === 0) return ['GLOBAL'];
  return Array.from(found);
}

// ============================================================
//  ГЛАВНАЯ ЛОГИКА
// ============================================================

async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();

  const modules = [];
  for (const cat of CATEGORIES) {
    const dir = join(ANALYTICS, cat);
    let files;
    try { files = await readdir(dir); }
    catch { continue; }
    for (const f of files) {
      if (f.endsWith('.json') === false) continue;
      if (f.startsWith('_')) continue;
      const path = join(dir, f);
      const data = await readJson(path, null);
      if (data === null || data._meta === undefined) continue;
      const id = f.replace('.json', '');
      const signal = extractSignal(id, data);
      if (signal <= 0) continue;
      const regions = extractRegion(id, data);
      modules.push({
        id,
        category: cat,
        signal,
        regions,
        version: data._meta.version,
        updatedAt: data._meta.updated_at,
        description: data._meta.description,
      });
    }
  }

  const byRegion = new Map();
  for (const m of modules) {
    for (const r of m.regions) {
      const key = String(r).toUpperCase();
      if (byRegion.has(key) === false) byRegion.set(key, []);
      byRegion.get(key).push({ id: m.id, category: m.category, signal: m.signal });
    }
  }

  const convergences = [];
  for (const [region, entries] of byRegion) {
    const catMap = new Map();
    for (const e of entries) {
      if (catMap.has(e.category) === false) catMap.set(e.category, []);
      catMap.get(e.category).push(e.signal);
    }
    const uniqueCategories = catMap.size;
    if (uniqueCategories < MIN_CATEGORIES) continue;

    let weightedSum = 0, weightSum = 0;
    const categorySignals = {};
    for (const [cat, signals] of catMap) {
      const avg = signals.reduce((a, b) => a + b, 0) / signals.length;
      categorySignals[cat] = Math.round(avg * 1000) / 1000;
      const w = CATEGORY_WEIGHTS[cat] !== undefined ? CATEGORY_WEIGHTS[cat] : 0.5;
      weightedSum += avg * w;
      weightSum += w;
    }
    const weightedSignal = weightSum > 0 ? weightedSum / weightSum : 0;

    const categoryBoost = Math.sqrt(uniqueCategories);
    const diversityBoost = 1 + (uniqueCategories - MIN_CATEGORIES) * 0.15;
    const convergenceScore = Math.round(categoryBoost * weightedSignal * diversityBoost * 100) / 100;

    const level = convergenceScore >= 2.5 ? 'critical'
                : convergenceScore >= 1.5 ? 'high'
                : convergenceScore >= 0.8 ? 'medium'
                : 'low';

    convergences.push({
      region,
      categories: uniqueCategories,
      moduleCount: entries.length,
      weightedSignal: Math.round(weightedSignal * 1000) / 1000,
      convergenceScore,
      level,
      categorySignals,
      modules: entries.map(e => ({ id: e.id, category: e.category, signal: Math.round(e.signal * 1000) / 1000 })),
    });
  }

  convergences.sort((a, b) => b.convergenceScore - a.convergenceScore);

  const byCategory = {};
  for (const m of modules) byCategory[m.category] = (byCategory[m.category] || 0) + 1;

  const payload = {
    _meta: {
      id: 'convergence-engine',
      category: 'specialist',
      version: '1.0.4',
      schema_version: '1.0.4',
      sources: CATEGORIES,
      calculator: 'ConvergenceEngine',
      updated_at: now,
      period: 'latest',
      duration_ms: Date.now() - t0,
      checksum: '',
      stats: {
        modules_read: modules.length,
        by_category: byCategory,
        regions: byRegion.size,
        convergences: convergences.length,
        min_categories: MIN_CATEGORIES,
      },
      description: 'Универсальный движок схождения сигналов: пересечение сигналов из 8 категорий анализаторов (59 модулей × 30 наук). Уникальное преимущество над World Monitor (только RSS). Нормализация регионов к ISO3.',
    },
    data: {
      convergences,
      total: convergences.length,
      modules_summary: modules.map(m => ({ id: m.id, category: m.category, signal: Math.round(m.signal * 1000) / 1000 })),
      generated_at: now,
    },
  };

  const body = JSON.stringify({ ...payload, _meta: { ...payload._meta, checksum: '' } });
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log('════════════════════════════════════════════');
  console.log('ConvergenceEngine v1.0.4 — отчёт');
  console.log('════════════════════════════════════════════');
  console.log('Модулей прочитано:', modules.length);
  console.log('Категорий с сигналами:', Object.keys(byCategory).length);
  console.log('Регионов:', byRegion.size);
  console.log('Схождений (>= ' + MIN_CATEGORIES + ' категорий):', convergences.length);
  console.log('');
  console.log('Модули по категориям:');
  for (const [cat, count] of Object.entries(byCategory)) {
    console.log(`  ${cat.padEnd(12)} ${count}`);
  }
  console.log('');
  console.log('Топ-10 схождений:');
  for (const c of convergences.slice(0, 10)) {
    console.log(`  ${c.region.padEnd(20)} cats=${c.categories}, score=${c.convergenceScore}, level=${c.level}, modules=${c.moduleCount}`);
  }
  console.log('');
  console.log('Файл записан:', OUT_FILE);
}

main().catch(e => { console.error('ERR:', e.message); console.error(e.stack); process.exit(1); });
