#!/usr/bin/env node
// Crucix Analyzer: DataDiscrepancy v1.1.0
// Читает: worldbank-latest, rest-countries, who, happiness, freedom, fred-real
// Пишет: data/analytics/specialist/data-discrepancy.json
//
// ИСПРАВЛЕНИЕ v1.1.0: реальные структуры источников.
// worldbank-latest — объект countries[ISO3][INDICATOR] = {value, year}
// rest-countries — объект countries[ISO3] = {name, area, population (null)}
// who/happiness — GeoJSON features[].properties{name (рус), value}
// freedom — массив [{country, value, date}]
// fred-real — временной ряд observations[] (без стран)
//
// ТРИ ТИПА ПРОВЕРОК:
// 1. within_source — производные внутри одного источника (GDP/POP vs GDP_PC).
// 2. cross_source — одна метрика в двух источниках (если найдена).
// 3. rank_consistency — согласованность ранжирования между источниками.

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'specialist');
const OUT_FILE = join(OUT_DIR, 'data-discrepancy.json');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf-8')); }
  catch { return fallback; }
}

function pct(a, b) {
  const base = Math.abs(b) > 0 ? Math.abs(b) : 1;
  return Math.abs(a - b) / base * 100;
}

function levelForSpread(pctVal, high = 20, critical = 50) {
  if (pctVal >= critical) return 'critical';
  if (pctVal >= high) return 'high';
  return 'medium';
}

// ============================================================
//  ТИП 1: WITHIN SOURCE — производные внутри worldbank
// ============================================================

function checkWorldbankDerived(worldbank) {
  const results = [];
  const c = worldbank?.countries;
  if (!c || typeof c !== 'object') return results;

  for (const [code, rec] of Object.entries(c)) {
    const gdp = rec?.GDP?.value;
    const pop = rec?.POPULATION?.value;
    const gdpPc = rec?.GDP_PC?.value;
    if (gdp == null || pop == null || gdpPc == null) continue;
    const computed = gdp / pop;
    const diffPct = pct(computed, gdpPc);
    if (diffPct < 5) continue;
    results.push({
      checkType: 'within_source',
      source: 'worldbank',
      country: code,
      indicator: 'GDP_PC vs GDP/POPULATION',
      expected: Math.round(computed * 100) / 100,
      observed: Math.round(gdpPc * 100) / 100,
      spreadPct: Math.round(diffPct * 10) / 10,
      level: levelForSpread(diffPct, 10, 25),
      details: { GDP: gdp, POPULATION: pop, GDP_PC: gdpPc },
    });
  }
  return results;
}

// ============================================================
//  ТИП 2: CROSS SOURCE — одна метрика в двух источниках
// ============================================================

function checkCrossSource(worldbank, restCountries) {
  const results = [];
  const wb = worldbank?.countries;
  const rc = restCountries?.countries;
  if (!wb || !rc) return results;

  for (const [code, wbRec] of Object.entries(wb)) {
    const wbPop = wbRec?.POPULATION?.value;
    if (wbPop == null) continue;
    const rcRec = rc[code];
    if (!rcRec) continue;
    const rcPop = rcRec.population;
    if (rcPop == null) continue;
    const diffPct = pct(wbPop, rcPop);
    if (diffPct < 3) continue;
    results.push({
      checkType: 'cross_source',
      country: code,
      indicator: 'POPULATION',
      sourceA: 'worldbank',
      sourceB: 'rest-countries',
      valueA: wbPop,
      valueB: rcPop,
      spreadPct: Math.round(diffPct * 10) / 10,
      level: levelForSpread(diffPct, 10, 25),
    });
  }
  return results;
}

// ============================================================
//  ТИП 3: RANK CONSISTENCY — согласованность ранжирования who/happiness
// ============================================================

function checkRankConsistency(who, happiness) {
  const results = [];
  const whoMap = {};
  const hapMap = {};
  for (const f of (who?.features || [])) {
    const p = f.properties || {};
    if (p.name && typeof p.value === 'number') whoMap[p.name] = p.value;
  }
  for (const f of (happiness?.features || [])) {
    const p = f.properties || {};
    if (p.name && typeof p.value === 'number') hapMap[p.name] = p.value;
  }
  const common = Object.keys(whoMap).filter(n => hapMap[n] != null);
  if (common.length < 5) return results;

  // Ранжирование: сортируем по значению, присваиваем ранг.
  const whoSorted = [...common].sort((a, b) => whoMap[b] - whoMap[a]);
  const hapSorted = [...common].sort((a, b) => hapMap[b] - hapMap[a]);
  const whoRank = {};
  const hapRank = {};
  whoSorted.forEach((n, i) => whoRank[n] = i + 1);
  hapSorted.forEach((n, i) => hapRank[n] = i + 1);

  for (const name of common) {
    const rankDiff = Math.abs(whoRank[name] - hapRank[name]);
    const rankDiffPct = rankDiff / common.length * 100;
    if (rankDiffPct < 25) continue;
    results.push({
      checkType: 'rank_consistency',
      country: name,
      indicator: 'who.alerts vs happiness.score',
      rankA: whoRank[name],
      rankB: hapRank[name],
      rankDiff,
      rankDiffPct: Math.round(rankDiffPct * 10) / 10,
      valueA: whoMap[name],
      valueB: hapMap[name],
      level: rankDiffPct >= 50 ? 'high' : 'medium',
    });
  }
  return results;
}

// ============================================================
//  ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();

  const worldbank = await readJson(join(BASKET, 'worldbank-latest.json'), null);
  const restCountries = await readJson(join(BASKET, 'rest-countries.json'), null);
  const who = await readJson(join(BASKET, 'who.json'), null);
  const happiness = await readJson(join(BASKET, 'happiness.json'), null);
  const freedom = await readJson(join(BASKET, 'freedom.json'), null);
  const fred = await readJson(join(BASKET, 'fred-real.json'), null);

  const checks = [];
  checks.push(...checkWorldbankDerived(worldbank));
  checks.push(...checkCrossSource(worldbank, restCountries));
  // rank_consistency отключён в v1.1.1: who.alerts и happiness.score измеряют разные величины, сравнение некорректно без семантической связи.
  // checks.push(...checkRankConsistency(who, happiness));

  // Сортировка по spreadPct убыванию.
  checks.sort((a, b) => {
    const sa = a.spreadPct != null ? a.spreadPct : (a.rankDiffPct || 0);
    const sb = b.spreadPct != null ? b.spreadPct : (b.rankDiffPct || 0);
    return sb - sa;
  });

  const byType = {};
  for (const ch of checks) {
    byType[ch.checkType] = (byType[ch.checkType] || 0) + 1;
  }

  const payload = {
    _meta: {
      id: 'data-discrepancy',
      category: 'specialist',
      version: '1.1.1',
      schema_version: '1.1.1',
      sources: ['worldbank-latest', 'rest-countries', 'who', 'happiness', 'freedom', 'fred-real'],
      calculator: 'DataDiscrepancy',
      updated_at: now,
      period: 'latest',
      duration_ms: Date.now() - t0,
      checksum: '',
      stats: {
        checks: checks.length,
        by_type: byType,
        countries_worldbank: worldbank?.countries ? Object.keys(worldbank.countries).length : 0,
        countries_rest: restCountries?.countries ? Object.keys(restCountries.countries).length : 0,
        who_features: who?.features?.length || 0,
        happiness_features: happiness?.features?.length || 0,
        freedom_records: Array.isArray(freedom) ? freedom.length : 0,
        fred_observations: fred?.observations?.length || 0,
      },
      description: 'Расхождение данных: 3 типа проверок (within_source, cross_source, rank_consistency).',
    },
    data: {
      checks,
      total: checks.length,
      by_type: byType,
      generated_at: now,
    },
  };

  const body = JSON.stringify({ ...payload, _meta: { ...payload._meta, checksum: '' } });
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log('════════════════════════════════════════════');
  console.log('DataDiscrepancy v1.1.0 — отчёт');
  console.log('════════════════════════════════════════════');
  console.log('Проверок:', checks.length);
  console.log('По типам:', JSON.stringify(byType));
  console.log('');
  console.log('Топ-10:');
  for (const ch of checks.slice(0, 10)) {
    if (ch.checkType === 'rank_consistency') {
      console.log(`  [rank] ${ch.country}: rankA=${ch.rankA} rankB=${ch.rankB} (diffPct=${ch.rankDiffPct}%, ${ch.level})`);
    } else {
      console.log(`  [${ch.checkType}] ${ch.country} ${ch.indicator}: ${ch.spreadPct}% (${ch.level})`);
    }
  }
  console.log('');
  console.log('Файл записан:', OUT_FILE);
}

main().catch(e => { console.error('ERR:', e.message); console.error(e.stack); process.exit(1); });
