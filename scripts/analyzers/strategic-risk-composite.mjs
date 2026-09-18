#!/usr/bin/env node
// Crucix Analyzer: StrategicRiskComposite v1.0.0
// Читает: data/reference/country-characteristics.json
//         data/analytics/index/resilience-index.json
//         data/analytics/index/country-instability.json
//         data/infrastructure/objects.json
// Пишет: data/analytics/specialist/strategic-risk-composite.json

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import StrategicRiskComposite from '../../apis/sources/strategic-risk-composite.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const REFERENCE = join(ROOT, 'data', 'reference');
const ANALYTICS = join(ROOT, 'data', 'analytics');
const INFRA_DIR = join(ROOT, 'data', 'infrastructure');
const OUT_DIR = join(ANALYTICS, 'specialist');
const OUT_FILE = join(OUT_DIR, 'strategic-risk-composite.json');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf-8')); }
  catch { return fallback; }
}

/**
 * Агрегирует инфраструктурный риск по стране:
 * сколько critical/warning объектов на территории + средняя vulnerability.
 */
function aggregateInfrastructureByCountry(objectsList) {
  const byCountry = {};
  let normalizedCount = 0;
  let skippedCount = 0;
  for (const obj of objectsList || []) {
    if (!obj.country) continue;
    // НОРМАЛИЗАЦИЯ: 'Ukraine' → 'UKR', 'Russia (Crimea)' → 'RUS'
    const code = normalizeCountryCode(obj.country);
    if (!code) {
      skippedCount++;
      continue;
    }
    normalizedCount++;
    if (!byCountry[code]) {
      byCountry[code] = { count: 0, sumVuln: 0, critical: 0, warning: 0, highRisk: 0 };
    }
    byCountry[code].count++;
    const v = typeof obj.vulnerability === 'number' ? obj.vulnerability : 5;
    byCountry[code].sumVuln += v;
    if (obj.status === 'critical') byCountry[code].critical++;
    else if (obj.status === 'warning') byCountry[code].warning++;
    if (v >= 7) byCountry[code].highRisk++;
  }
  // Логируем для диагностики
  console.log('[aggregateInfrastructure] Нормализовано:', normalizedCount, ', пропущено:', skippedCount, ', стран в индексе:', Object.keys(byCountry).length);
  // Нормализация в 0-100
  const result = {};
  for (const [code, agg] of Object.entries(byCountry)) {
    const avgVuln = agg.count > 0 ? agg.sumVuln / agg.count : 5;
    // Нормализация: avgVuln 0-10 → 0-100, плюс бонус за critical/warning
    const riskScore = Math.min(
      avgVuln * 8 + agg.critical * 10 + agg.warning * 4 + agg.highRisk * 3,
      100
    );
    result[code] = {
      riskScore: Math.round(riskScore * 100) / 100,
      objectsCount: agg.count,
      criticalCount: agg.critical,
      warningCount: agg.warning,
      highRiskCount: agg.highRisk,
      avgVulnerability: Math.round(avgVuln * 100) / 100,
    };
  }
  return result;
}

/**
 * Определяет ISO-код страны по нестандартному названию.
 * Пример: 'Russia (Crimea)' → 'RUS', 'USA (Guam)' → 'USA'.
 */
let _aliasesCache = null;
function loadAliases() {
  if (_aliasesCache !== null) return _aliasesCache;
  try {
    const fs = require('fs');
    const path = require('path');
    const p = path.join(__dirname, '..', '..', 'data', 'reference', 'country-aliases.json');
    const d = JSON.parse(fs.readFileSync(p, 'utf-8'));
    _aliasesCache = d.aliases || {};
  } catch {
    _aliasesCache = {};
  }
  return _aliasesCache;
}

function normalizeCountryCode(raw) {
  if (!raw) return null;
  // Если уже 3-буквенный код
  if (/^[A-Z]{3}$/.test(raw)) return raw;
  // Полная карта стран мира
  const map = {
    'USA': 'USA', 'UNITED STATES': 'USA',
    'RUSSIA': 'RUS', 'RUSSIAN FEDERATION': 'RUS',
    'CHINA': 'CHN', 'GERMANY': 'DEU', 'FRANCE': 'FRA',
    'ITALY': 'ITA', 'TURKEY': 'TUR', 'JAPAN': 'JPN',
    'SYRIA': 'SYR', 'IRAN': 'IRN', 'IRAQ': 'IRQ', 'INDIA': 'IND',
    'UKRAINE': 'UKR', 'BELARUS': 'BLR', 'POLAND': 'POL', 'QATAR': 'QAT',
    'BAHRAIN': 'BHR', 'OMAN': 'OMN', 'UAE': 'ARE', 'YEMEN': 'YEM',
    'UNITED ARAB EMIRATES': 'ARE', 'SAUDI ARABIA': 'SAU',
    'EGYPT': 'EGY', 'PANAMA': 'PAN', 'BRAZIL': 'BRA', 'CANADA': 'CAN',
    'SINGAPORE': 'SGP', 'MALAYSIA': 'MYS', 'INDONESIA': 'IDN',
    'SOUTH KOREA': 'KOR', 'KOREA': 'KOR', 'NORTH KOREA': 'PRK',
    'TAIWAN': 'TWN', 'UK': 'GBR', 'UNITED KINGDOM': 'GBR',
    'CUBA': 'CUB', 'SOUTH AFRICA': 'ZAF', 'SPAIN': 'ESP',
    'NORWAY': 'NOR', 'NETHERLANDS': 'NLD', 'DENMARK': 'DNK',
    'SWEDEN': 'SWE', 'FINLAND': 'FIN', 'GREECE': 'GRC',
    'ISRAEL': 'ISR', 'PALESTINE': 'PSE', 'LEBANON': 'LBN',
    'JORDAN': 'JOR', 'KUWAIT': 'KWT', 'AZERBAIJAN': 'AZE',
    'ARMENIA': 'ARM', 'GEORGIA': 'GEO', 'KAZAKHSTAN': 'KAZ',
    'UZBEKISTAN': 'UZB', 'TURKMENISTAN': 'TKM', 'TAJIKISTAN': 'TJK',
    'KYRGYZSTAN': 'KGZ', 'MONGOLIA': 'MNG',
    'THAILAND': 'THA', 'VIETNAM': 'VNM', 'PHILIPPINES': 'PHL',
    'MYANMAR': 'MMR', 'CAMBODIA': 'KHM', 'LAOS': 'LAO',
    'BANGLADESH': 'BGD', 'PAKISTAN': 'PAK', 'SRI LANKA': 'LKA',
    'NEPAL': 'NPL', 'BHUTAN': 'BTN', 'AFGHANISTAN': 'AFG',
    'AUSTRALIA': 'AUS', 'NEW ZEALAND': 'NZL', 'FIJI': 'FJI',
    'MEXICO': 'MEX', 'GUATEMALA': 'GTM', 'HONDURAS': 'HND',
    'EL SALVADOR': 'SLV', 'NICARAGUA': 'NIC', 'COSTA RICA': 'CRI',
    'PANAMA': 'PAN', 'COLOMBIA': 'COL', 'VENEZUELA': 'VEN',
    'ECUADOR': 'ECU', 'PERU': 'PER', 'BOLIVIA': 'BOL',
    'CHILE': 'CHL', 'ARGENTINA': 'ARG', 'URUGUAY': 'URY',
    'PARAGUAY': 'PRY', 'GUYANA': 'GUY', 'SURINAME': 'SUR',
    'HAITI': 'HTI', 'DOMINICAN REPUBLIC': 'DOM', 'JAMAICA': 'JAM',
    'CUBA': 'CUB', 'TRINIDAD': 'TTO', 'BAHAMAS': 'BHS',
    'NIGERIA': 'NGA', 'GHANA': 'GHA', 'IVORY COAST': 'CIV',
    'SENEGAL': 'SEN', 'MALI': 'MLI', 'BURKINA FASO': 'BFA',
    'NIGER': 'NER', 'CHAD': 'TCD', 'SUDAN': 'SDN', 'SOUTH SUDAN': 'SSD',
    'ETHIOPIA': 'ETH', 'ERITREA': 'ERI', 'SOMALIA': 'SOM',
    'DJIBOUTI': 'DJI', 'KENYA': 'KEN', 'TANZANIA': 'TZA',
    'UGANDA': 'UGA', 'RWANDA': 'RWA', 'BURUNDI': 'BDI',
    'DR CONGO': 'COD', 'CONGO': 'COG', 'ANGOLA': 'AGO',
    'ZAMBIA': 'ZMB', 'ZIMBABWE': 'ZWE', 'MOZAMBIQUE': 'MOZ',
    'MADAGASCAR': 'MDG', 'MALAWI': 'MWI', 'NAMIBIA': 'NAM',
    'BOTSWANA': 'BWA', 'ZIMBABWE': 'ZWE',
    'LIBYA': 'LBY', 'TUNISIA': 'TUN', 'ALGERIA': 'DZA',
    'MOROCCO': 'MAR', 'MAURITANIA': 'MRT',
    'MALTA': 'MLT', 'CYPRUS': 'CYP', 'ICELAND': 'ISL',
    'IRELAND': 'IRL', 'PORTUGAL': 'PRT', 'BELGIUM': 'BEL',
    'LUXEMBOURG': 'LUX', 'SWITZERLAND': 'CHE', 'AUSTRIA': 'AUT',
    'CZECHIA': 'CZE', 'SLOVAKIA': 'SVK', 'HUNGARY': 'HUN',
    'ROMANIA': 'ROU', 'BULGARIA': 'BGR', 'SERBIA': 'SRB',
    'CROATIA': 'HRV', 'SLOVENIA': 'SVN', 'BOSNIA': 'BIH',
    'MONTENEGRO': 'MNE', 'ALBANIA': 'ALB', 'MACEDONIA': 'MKD',
    'KOSOVO': 'XKX',
    'ESTONIA': 'EST', 'LATVIA': 'LVA', 'LITHUANIA': 'LTU',
    'MOLDOVA': 'MDA',
  };
  // Точное совпадение
  const upper = raw.toUpperCase();
  if (map[upper]) return map[upper];
  // До первого пробела/скобки
  const first = upper.split(/[\s(\/]/)[0];
  if (map[first]) return map[first];
  // Специальные случаи: "Russia (Crimea)" → RUS, "USA (Guam)" → USA
  if (first === 'RUSSIA') return 'RUS';
  if (first === 'USA') return 'USA';
  if (first === 'CHINA') return 'CHN';
  // Через справочник алиасов
  const aliases = loadAliases();
  if (aliases[raw]) return aliases[raw];
  if (aliases[upper]) return aliases[upper];
  return null;
}

async function main() {
  const now = new Date().toISOString();
  const chars = await readJson(join(REFERENCE, 'country-characteristics.json'), { countries: {} });
  const resilience = await readJson(join(ANALYTICS, 'index', 'resilience-index.json'), { data: { countries: {} } });
  const cii = await readJson(join(ANALYTICS, 'index', 'country-instability.json'), { data: { countries: {} } });
  const infraData = await readJson(join(INFRA_DIR, 'objects.json'), { objects: [] });

  const infraByCountry = aggregateInfrastructureByCountry(infraData.objects);

  const resilienceCountries = resilience.data?.countries || {};
  const ciiCountries = cii.data?.countries || {};

  const src = new StrategicRiskComposite();
  const results = {};
  const stats = {
    from_cii: 0,
    from_resilience: 0,
    from_infra: 0,
    from_baseRisk_fallback: 0,
    from_defaults: 0,
  };

  for (const [code, c] of Object.entries(chars.countries || {})) {
    const ciiRec = ciiCountries[code];
    const resRec = resilienceCountries[code];
    const infraRec = infraByCountry[code];

    const instabilityScore = ciiRec?.score ?? 50;
    const resilienceScore = resRec?.score ?? 50;
    // InfrastructureRisk: если нет объектов — используем baseRisk как прокси.
    // Логика: страна без известных объектов, но с высоким baseRisk — 
    // косвенно получает инфраструктурный риск через общий уровень риска.
    const infrastructureRisk = infraRec?.riskScore ?? (c.baseRisk ?? 50);

    if (ciiRec) stats.from_cii++;
    if (resRec) stats.from_resilience++;
    if (infraRec) stats.from_infra++;
    else if (c.baseRisk) stats.from_baseRisk_fallback++;
    if (!ciiRec && !resRec && !infraRec) stats.from_defaults++;

    const input = {
      countryCode: code,
      countryName: c.name,
      instabilityScore,
      resilienceScore,
      infrastructureRisk,
      baseRisk: c.baseRisk || 50,
      tier: c.tier || 2,
      regime: c.regime || 'hybrid',
    };

    try {
      results[code] = src.compute(input);
    } catch (e) {
      results[code] = { countryCode: code, error: e.message };
    }
  }

  const payload = {
    _meta: {
      id: 'strategic-risk-composite',
      category: 'specialist',
      version: '1.0.0',
      schema_version: '1.0.0',
      sources: ['country-characteristics', 'resilience-index', 'country-instability', 'infrastructure/objects'],
      calculator: 'StrategicRiskComposite',
      updated_at: now,
      period: 'manual',
      checksum: '',
      stats,
      description: 'Композитный стратегический риск: инстабильность (CII) + дефицит устойчивости (Resilience) + инфраструктурный риск + геополитика (baseRisk/regime). Взвешенная сумма с tier-множителем.',
    },
    data: {
      countries: results,
      total: Object.keys(results).length,
      generated_at: now,
    },
  };

  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  const vals = Object.values(results).filter(r => typeof r.score === 'number');
  const top = src.topN(5);
  const bottom = src.bottomN(5);
  const uniqueScores = new Set(vals.map(v => Math.round(v.score * 100) / 100)).size;

  console.log('════════════════════════════════════════════');
  console.log('StrategicRiskComposite v1.0.0 — отчёт');
  console.log('════════════════════════════════════════════');
  console.log('Стран:', vals.length);
  console.log('Уникальных баллов:', uniqueScores);
  console.log('');
  console.log('Источники:');
  console.log('  CII:', stats.from_cii);
  console.log('  ResilienceIndex:', stats.from_resilience);
  console.log('  Infrastructure:', stats.from_infra);
  console.log('  Только дефолты:', stats.from_defaults);
  console.log('');
  console.log('Топ-5 (наибольший риск):');
  for (const r of top) console.log(`  ${r.countryCode} ${r.countryName}: ${r.score}`);
  console.log('');
  console.log('Дно-5 (наименьший риск):');
  for (const r of bottom) console.log(`  ${r.countryCode} ${r.countryName}: ${r.score}`);
  console.log('');
  console.log('Файл записан:', OUT_FILE);
}

main().catch(e => { console.error('ERR:', e.message); console.error(e.stack); process.exit(1); });
