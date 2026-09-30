// apis/predict/sources/geopolitical.mjs
// Источник геополитических данных для прогностического ядра Crucix.
//
// Назначение:
//   34-й источник. Данные о политической стабильности, дипломатических
//   отношениях, санкциях и геополитических рисках по странам.
//
// Источники данных:
//   - World Bank WGI — Political Stability, Rule of Law, Voice & Accountability
//   - Fragile States Index (Fund for Peace)
//   - OFAC Sanctions List (US Treasury)
//   - Council on Foreign Relations — Global Conflict Tracker
//   - GDELT Diplomatic Events
//
// Ключевые сигналы:
//   - Индекс политической стабильности (Political Stability Index)
//   - Санкционное давление (количество активных санкций)
//   - Дипломатические конфликты (послы отозваны, договоры расторгнуты)
//   - Региональные альянсы и разрывы
//
// Экспортирует:
//   - fetchGeopoliticalData() — главная функция
//   - fetchPoliticalStability() — WGI Political Stability
//   - fetchSanctions() — санкционные списки
//   - fetchFragileStates() — Fragile States Index
//   - computeGeopoliticalRisk() — оценка геополитического риска
//   - REGIONS — региональная конфигурация
//
// Версия: 1.0.0

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');
const RUNS_DIR = join(PROJECT_ROOT, 'runs', 'predictions');

// --- РЕГИОНЫ --------------------------------------

export const REGIONS = {
  europe: { name: 'Europe', countries: ['DEU', 'FRA', 'GBR', 'ITA', 'ESP', 'POL', 'NLD', 'SWE', 'NOR', 'FIN'] },
  eastern_europe: { name: 'Eastern Europe', countries: ['RUS', 'UKR', 'BLR', 'MDA', 'GEO', 'ARM', 'AZE'] },
  middle_east: { name: 'Middle East', countries: ['ISR', 'IRN', 'SAU', 'ARE', 'TUR', 'EGY', 'IRQ', 'SYR', 'LBN', 'JOR'] },
  asia_pacific: { name: 'Asia Pacific', countries: ['CHN', 'JPN', 'KOR', 'PRK', 'TWN', 'IND', 'PAK', 'VNM', 'PHL', 'IDN'] },
  central_asia: { name: 'Central Asia', countries: ['KAZ', 'UZB', 'TKM', 'KGZ', 'TJK', 'AFG'] },
  north_america: { name: 'North America', countries: ['USA', 'CAN', 'MEX'] },
  latin_america: { name: 'Latin America', countries: ['BRA', 'ARG', 'CHL', 'COL', 'VEN', 'PER'] },
  africa: { name: 'Africa', countries: ['ZAF', 'NGA', 'EGY', 'ETH', 'KEN', 'DZA', 'MAR', 'TUN', 'LBY'] },
};

// --- КОНФИГУРАЦИЯ ИСТОЧНИКОВ ----------------------

const SOURCES = {
  worldbank_wgi: {
    name: 'World Bank WGI',
    apiUrl: 'https://api.worldbank.org/v2/country',
    freeAccess: true,
    authRequired: false,
  },
  fragile_states: {
    name: 'Fragile States Index',
    apiUrl: 'https://fragilestatesindex.org/wp-content/uploads',
    freeAccess: true,
    authRequired: false,
    note: 'Статический CSV, обновляется ежегодно',
  },
  ofac: {
    name: 'OFAC Sanctions (US Treasury)',
    apiUrl: 'https://api.ofac-api.com/v4',
    freeAccess: false,
    authRequired: true,
    note: 'Требует API-ключ или self-hosted mirror',
  },
};

// --- FETCH-ФУНКЦИИ --------------------------------

/**
 * Получение индекса политической стабильности World Bank.
 * @param {string} country — ISO-код страны
 * @returns {Promise<Object>} значение индекса по годам
 */
export async function fetchPoliticalStability(country = 'RUS') {
  try {
    const url = `${SOURCES.worldbank_wgi.apiUrl}/${country}/indicator/PV.EST?format=json&date=2015:2024`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`WGI API: ${response.status}`);

    const data = await response.json();
    const rows = Array.isArray(data[1]) ? data[1] : [];

    return {
      country,
      indicator: 'Political Stability (PV.EST)',
      values: rows
        .filter(r => r.value !== null)
        .map(r => ({ year: parseInt(r.date, 10), value: parseFloat(r.value) }))
        .sort((a, b) => a.year - b.year),
      latest: rows.find(r => r.value !== null)?.value || null,
    };
  } catch (e) {
    console.error('[geopolitical] WGI Political Stability error:', e.message);
    return { country, values: [], latest: null };
  }
}

/**
 * Получение индекса Rule of Law World Bank.
 * @param {string} country — ISO-код страны
 * @returns {Promise<Object>} значение индекса
 */
export async function fetchRuleOfLaw(country = 'RUS') {
  try {
    const url = `${SOURCES.worldbank_wgi.apiUrl}/${country}/indicator/RL.EST?format=json&date=2015:2024`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`WGI API: ${response.status}`);

    const data = await response.json();
    const rows = Array.isArray(data[1]) ? data[1] : [];

    return {
      country,
      indicator: 'Rule of Law (RL.EST)',
      values: rows
        .filter(r => r.value !== null)
        .map(r => ({ year: parseInt(r.date, 10), value: parseFloat(r.value) }))
        .sort((a, b) => a.year - b.year),
      latest: rows.find(r => r.value !== null)?.value || null,
    };
  } catch (e) {
    console.error('[geopolitical] WGI Rule of Law error:', e.message);
    return { country, values: [], latest: null };
  }
}

/**
 * Получение санкционных данных из OFAC (self-hosted или API).
 * @param {string} country — ISO-код страны
 * @returns {Promise<Object[]>} активные санкции
 */
export async function fetchSanctions(country = null) {
  try {
    // Проверяем наличие локального зеркала OFAC
    const localFile = join(BASKET_DIR, 'ofac.json');
    if (existsSync(localFile)) {
      const data = JSON.parse(readFileSync(localFile, 'utf-8'));
      const sanctions = Array.isArray(data.sanctions) ? data.sanctions : (Array.isArray(data) ? data : []);
      if (country) {
        return sanctions.filter(s => s.country === country || (s.countries && s.countries.includes(country)));
      }
      return sanctions;
    }
    return [];
  } catch (e) {
    console.error('[geopolitical] OFAC local error:', e.message);
    return [];
  }
}

/**
 * Получение данных Fragile States Index (локально).
 * @returns {Promise<Object[]>} индексы хрупкости
 */
export async function fetchFragileStates() {
  try {
    const localFile = join(BASKET_DIR, 'fragile-states.json');
    if (existsSync(localFile)) {
      const data = JSON.parse(readFileSync(localFile, 'utf-8'));
      return Array.isArray(data) ? data : (data.countries || []);
    }
    return [];
  } catch (e) {
    console.error('[geopolitical] Fragile States error:', e.message);
    return [];
  }
}

// --- АНАЛИЗ ---------------------------------------

/**
 * Оценка геополитического риска для страны.
 * @param {string} country — ISO-код
 * @param {Object} data — агрегированные данные
 * @returns {Object} оценка с разбивкой по компонентам
 */
export function computeGeopoliticalRisk(country, data = {}) {
  const components = {
    politicalStability: 0,
    ruleOfLaw: 0,
    sanctionsPressure: 0,
    fragileState: 0,
  };

  // Political Stability — от -2.5 (нестабильно) до 2.5 (стабильно)
  if (data.politicalStability?.latest !== null && data.politicalStability?.latest !== undefined) {
    components.politicalStability = Math.max(0, (2.5 - data.politicalStability.latest) / 5);
  }

  // Rule of Law — та же шкала
  if (data.ruleOfLaw?.latest !== null && data.ruleOfLaw?.latest !== undefined) {
    components.ruleOfLaw = Math.max(0, (2.5 - data.ruleOfLaw.latest) / 5);
  }

  // Sanctions — нормализация по числу санкций
  if (Array.isArray(data.sanctions) && data.sanctions.length > 0) {
    components.sanctionsPressure = Math.min(1.0, data.sanctions.length / 100);
  }

  // Fragile State — нормализация по шкале 0-120
  if (data.fragileState?.score) {
    components.fragileState = Math.min(1.0, data.fragileState.score / 120);
  }

  // Взвешенная сумма
  const weights = {
    politicalStability: 0.35,
    ruleOfLaw: 0.20,
    sanctionsPressure: 0.25,
    fragileState: 0.20,
  };

  let totalScore = 0;
  let totalWeight = 0;
  for (const [key, value] of Object.entries(components)) {
    if (value > 0) {
      totalScore += value * weights[key];
      totalWeight += weights[key];
    }
  }

  const score = totalWeight > 0 ? totalScore / totalWeight : 0;
  let level = 'low';
  if (score > 0.7) level = 'critical';
  else if (score > 0.5) level = 'high';
  else if (score > 0.3) level = 'medium';

  return {
    country,
    score: Math.min(1.0, score),
    level,
    components,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Главная функция — получить геополитические данные.
 * @param {Object} options — { countries, regions }
 * @returns {Promise<Object>} агрегированный результат
 */
export async function fetchGeopoliticalData(options = {}) {
  const { countries = ['RUS', 'UKR', 'CHN', 'USA', 'IRN', 'ISR'] } = options;

  const result = {
    timestamp: new Date().toISOString(),
    source: 'geopolitical',
    version: '1.0.0',
    countries: [],
    byRegion: {},
    alerts: [],
  };

  try {
    for (const country of countries) {
      const [politicalStability, ruleOfLaw, sanctions, fragileStates] = await Promise.all([
        fetchPoliticalStability(country),
        fetchRuleOfLaw(country),
        fetchSanctions(country),
        fetchFragileStates(),
      ]);

      const fragileState = fragileStates.find(f => f.country === country);

      const risk = computeGeopoliticalRisk(country, {
        politicalStability,
        ruleOfLaw,
        sanctions,
        fragileState,
      });

      result.countries.push({
        country,
        politicalStability,
        ruleOfLaw,
        sanctionsCount: sanctions.length,
        fragileStateScore: fragileState?.score || null,
        risk,
      });

      if (risk.level === 'high' || risk.level === 'critical') {
        result.alerts.push({
          severity: risk.level,
          country,
          message: `Геополитический риск ${country}: ${risk.score.toFixed(2)} (${risk.level})`,
        });
      }
    }

    // Группировка по регионам
    for (const [regionKey, regionConfig] of Object.entries(REGIONS)) {
      const regionCountries = result.countries.filter(c => regionConfig.countries.includes(c.country));
      if (regionCountries.length > 0) {
        result.byRegion[regionKey] = {
          name: regionConfig.name,
          countries: regionCountries.map(c => c.country),
          avgRisk: regionCountries.reduce((sum, c) => sum + c.risk.score, 0) / regionCountries.length,
        };
      }
    }

    // Сохраняем
    mkdirSync(RUNS_DIR, { recursive: true });
    writeFileSync(
      join(RUNS_DIR, 'geopolitical_latest.json'),
      JSON.stringify(result, null, 2)
    );
  } catch (e) {
    result.error = e.message;
    console.error('[geopolitical] fetchGeopoliticalData error:', e.message);
  }

  return result;
}

export { SOURCES };

export default fetchGeopoliticalData;
