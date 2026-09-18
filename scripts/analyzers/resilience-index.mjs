#!/usr/bin/env node
// Crucix Analyzer: ResilienceIndex v1.2.0
// Читает: data/basket/ и data/reference/
// Пишет: data/analytics/index/resilience-index.json
// Класс-вычислитель импортируется из apis/sources/resilience-index.mjs
//
// ОБНОВЛЕНО 12.09.2026 (v1.2.0):
// - gdpPerCapita ← data/basket/worldbank-latest.json → countries[ISO].GDP_PC.value
// - giniIndex ← data/reference/gini-index.json → gini[ISO].value
// - economicVolatility ← worldbank-latest.json → INFLATION.value (fallback: inflation.json)
// - Все три поля теперь имеют реальные источники для ~194 стран.
// - Если поле отсутствует — остаётся дефолт, помечено в imputed_fields.

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import ResilienceIndex from '../../apis/sources/resilience-index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const REFERENCE = join(ROOT, 'data', 'reference');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'index');
const OUT_FILE = join(OUT_DIR, 'resilience-index.json');

const DEFAULT_GDP_PER_CAPITA = 10000;
const DEFAULT_GINI = 50;
const INFLATION_VOLATILITY_MULTIPLIER_WB = 3;      // WB: инфляция 33% → 100 баллов
const INFLATION_VOLATILITY_MULTIPLIER_FALLBACK = 5; // fallback: inflation.json

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf-8')); }
  catch { return fallback; }
}

// regime -> governanceScore
function regimeToGovernance(regime) {
  if (regime === 'democracy') return 80;
  if (regime === 'hybrid') return 50;
  if (regime === 'authoritarian') return 20;
  return 50;
}
// regime -> institutionalCapacity
function regimeToInstitutional(regime) {
  if (regime === 'democracy') return 70;
  if (regime === 'hybrid') return 50;
  if (regime === 'authoritarian') return 30;
  return 50;
}
// Магнитуда -> вклад в disaster exposure
function magnitudeToScore(mag) {
  if (mag >= 6) return 100;
  if (mag >= 5) return 60;
  if (mag >= 4) return 30;
  if (mag >= 3) return 10;
  return 0;
}

async function loadInputs() {
  // Источники
  const chars = await readJson(join(REFERENCE, 'country-characteristics.json'), { countries: {} });
  const aliases = await readJson(join(REFERENCE, 'country-aliases.json'), { aliases: {} });
  const acled = await readJson(join(BASKET, 'acled.json'), { events: [] });
  const earthquakes = await readJson(join(BASKET, 'earthquakes.json'), []);
  const inflation = await readJson(join(BASKET, 'inflation.json'), { features: [] });
  const worldbank = await readJson(join(BASKET, 'worldbank-latest.json'), { countries: {} });
  const giniData = await readJson(join(REFERENCE, 'gini-index.json'), { gini: {} });

  // Обратный справочник name/nameRu/alias -> ISO-код
  const nameToCode = {};
  for (const [code, c] of Object.entries(chars.countries || {})) {
    if (c.name) nameToCode[c.name.toLowerCase()] = code;
    if (c.nameRu) nameToCode[c.nameRu.toLowerCase()] = code;
  }
  for (const [key, code] of Object.entries(aliases.aliases || {})) {
    nameToCode[String(key).toLowerCase()] = code;
  }

  // --- conflictIntensity из acled ---
  const conflictByCode = {};
  for (const ev of acled.events || []) {
    if (!ev.country) continue;
    const code = nameToCode[String(ev.country).toLowerCase()] || ev.country;
    if (!chars.countries[code]) continue;
    conflictByCode[code] = (conflictByCode[code] || 0) + (ev.fatalities || 0);
  }
  for (const code in conflictByCode) {
    conflictByCode[code] = Math.min(conflictByCode[code] / 10, 100);
  }

  // --- disasterExposure из earthquakes ---
  const disasterByCode = {};
  for (const eq of earthquakes || []) {
    const nameRaw = String(eq.name || eq.place || '').split('(')[0].trim();
    const code = nameToCode[nameRaw.toLowerCase()];
    if (!code || !chars.countries[code]) continue;
    const magScore = magnitudeToScore(eq.magnitude || 0);
    disasterByCode[code] = Math.min((disasterByCode[code] || 0) + magScore, 100);
  }

  // --- economicVolatility из inflation.json (fallback) ---
  const inflationByCode = {};
  for (const f of inflation.features || []) {
    const nameRaw = String(f.properties?.name || '').trim();
    const code = nameToCode[nameRaw.toLowerCase()];
    if (!code || !chars.countries[code]) continue;
    const pct = Number(f.properties?.value) || 0;
    inflationByCode[code] = Math.min(Math.abs(pct) * INFLATION_VOLATILITY_MULTIPLIER_FALLBACK, 100);
  }

  const byCountry = {};
  const stats = {
    gdp_from_wb: 0,
    gini_from_reference: 0,
    volatility_from_wb: 0,
    volatility_from_fallback: 0
  };

  for (const [code, c] of Object.entries(chars.countries || {})) {
    // gdpPerCapita — из WB
    let gdpPerCapita = DEFAULT_GDP_PER_CAPITA;
    const wbEntry = worldbank.countries?.[code];
    if (wbEntry?.GDP_PC?.value && Number.isFinite(wbEntry.GDP_PC.value) && wbEntry.GDP_PC.value > 0) {
      gdpPerCapita = wbEntry.GDP_PC.value;
      stats.gdp_from_wb++;
    }

    // giniIndex — из справочника
    let giniIndex = DEFAULT_GINI;
    const giniEntry = giniData.gini?.[code];
    if (giniEntry?.value && Number.isFinite(giniEntry.value) && !giniEntry.imputed) {
      giniIndex = giniEntry.value;
      stats.gini_from_reference++;
    }

    // economicVolatility — WB приоритет, fallback inflation.json
    let economicVolatility = 0;
    if (wbEntry?.INFLATION?.value && Number.isFinite(wbEntry.INFLATION.value)) {
      economicVolatility = Math.min(Math.abs(wbEntry.INFLATION.value) * INFLATION_VOLATILITY_MULTIPLIER_WB, 100);
      stats.volatility_from_wb++;
    } else if (inflationByCode[code] !== undefined) {
      economicVolatility = inflationByCode[code];
      stats.volatility_from_fallback++;
    }

    byCountry[code] = {
      countryCode: code,
      countryName: c.name,
      governanceScore: regimeToGovernance(c.regime),
      institutionalCapacity: regimeToInstitutional(c.regime),
      resourceAdequacy: 100 - (c.baseRisk || 50),
      conflictIntensity: conflictByCode[code] || 0,
      disasterExposure: disasterByCode[code] || 0,
      economicVolatility,
      gdpPerCapita,
      giniIndex
    };
  }

  const imputedFields = {
    from_real_source: [
      'baseRisk (country-characteristics.json)',
      'regime (country-characteristics.json)',
      'conflictIntensity (acled.json)',
      'disasterExposure (earthquakes.json)',
      'gdpPerCapita (worldbank-latest.json)',
      'giniIndex (gini-index.json)',
      'economicVolatility (worldbank-latest.json, fallback inflation.json)'
    ],
    from_regime: ['governanceScore', 'institutionalCapacity'],
    from_formula: ['resourceAdequacy (100 - baseRisk)'],
    default_used_when_missing: {
      gdpPerCapita: `default ${DEFAULT_GDP_PER_CAPITA} (${stats.gdp_from_wb} стран из WB)`,
      giniIndex: `default ${DEFAULT_GINI} (${stats.gini_from_reference} стран с реальным Gini)`,
      economicVolatility: `0 (${stats.volatility_from_wb} из WB, ${stats.volatility_from_fallback} из inflation.json)`
    }
  };

  return { byCountry, imputedFields, stats };
}

async function main() {
  const t0 = Date.now();
  const { byCountry, imputedFields, stats } = await loadInputs();
  const now = new Date().toISOString();
  const idx = new ResilienceIndex();
  const results = {};

  for (const [code, input] of Object.entries(byCountry)) {
    try {
      const r = idx.compute(input);
      results[code] = r;
    } catch (e) {
      results[code] = { countryCode: code, error: e.message };
    }
  }

  const payload = {
    _meta: {
      id: 'resilience-index',
      category: 'index',
      version: '1.2.0',
      schema_version: '1.0.0',
      sources: [
        'country-characteristics',
        'country-aliases',
        'acled',
        'earthquakes',
        'inflation',
        'worldbank-latest',
        'gini-index'
      ],
      calculator: 'ResilienceIndex',
      updated_at: now,
      period: 'manual',
      duration_ms: Date.now() - t0,
      checksum: '',
      imputed_fields: imputedFields,
      stats
    },
    data: {
      countries: results,
      total: Object.keys(results).length,
      generated_at: now
    }
  };

  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  // === ОТЧЁТ ===
  const vals = Object.values(results).filter(r => typeof r.score === 'number');
  const top = [...vals].sort((a, b) => b.score - a.score).slice(0, 8);
  const bottom = [...vals].sort((a, b) => a.score - b.score).slice(0, 8);
  const uniqueScores = new Set(vals.map(v => Math.round(v.score * 100) / 100)).size;
  const minScore = Math.min(...vals.map(v => v.score));
  const maxScore = Math.max(...vals.map(v => v.score));

  console.log('════════════════════════════════════════════');
  console.log('ResilienceIndex v1.2.0 — отчёт');
  console.log('════════════════════════════════════════════');
  console.log('Стран обработано:', vals.length);
  console.log('Уникальных баллов:', uniqueScores);
  console.log('Диапазон баллов:', minScore.toFixed(2), '—', maxScore.toFixed(2));
  console.log('Длительность:', (Date.now() - t0), 'мс');
  console.log('');
  console.log('Источники данных:');
  console.log('  gdpPerCapita из WB:', stats.gdp_from_wb, 'стран');
  console.log('  giniIndex реальный:', stats.gini_from_reference, 'стран');
  console.log('  economicVolatility из WB:', stats.volatility_from_wb, 'стран');
  console.log('  economicVolatility fallback:', stats.volatility_from_fallback, 'стран');
  console.log('');
  console.log('Топ-8 (наиболее устойчивые):');
  for (const t of top) {
    console.log(`  ${t.countryCode} ${t.countryName}: ${t.score.toFixed(2)}`);
  }
  console.log('');
  console.log('Дно-8 (наименее устойчивые):');
  for (const t of bottom) {
    console.log(`  ${t.countryCode} ${t.countryName}: ${t.score.toFixed(2)}`);
  }
  console.log('');
  console.log('Файл записан:', OUT_FILE);
}

main().catch(e => { console.error('ERR:', e.message); console.error(e.stack); process.exit(1); });
