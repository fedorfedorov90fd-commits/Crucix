// apis/predict/sources/conflict.mjs
// Источник конфликтных данных для прогностического ядра Crucix.
//
// Назначение:
//   33-й источник. Данные о вооружённых конфликтах, боевых действиях,
//   протестах и насилии для прогнозирования эскалации.
//
// Источники данных:
//   - ACLED — Armed Conflict Location & Event Data
//   - GDELT — Global Database of Events, Language, and Tone
//   - UCDP — Uppsala Conflict Data Program
//   - ReliefWeb — гуманитарные кризисы
//
// Ключевые сигналы:
//   - Интенсивность конфликта (число событий, жертвы)
//   - Географическое распространение
//   - Типы событий (battles, explosions, protests, riots)
//   - Динамика эскалации (тренд за 7/30 дней)
//
// Экспортирует:
//   - fetchConflictData() — главная функция
//   - fetchACLED() — данные ACLED
//   - fetchGDELTConflicts() — конфликтные события GDELT
//   - computeEscalationScore() — оценка эскалации
//   - CONFLICT_TYPES — типы конфликтов
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

// --- ТИПЫ КОНФЛИКТОВ ------------------------------

export const CONFLICT_TYPES = {
  battle: { name: 'Armed Battle', weight: 1.0, escalationFactor: 1.5 },
  explosion: { name: 'Explosion/Remote Violence', weight: 0.9, escalationFactor: 1.3 },
  protest: { name: 'Peaceful Protest', weight: 0.3, escalationFactor: 0.5 },
  riot: { name: 'Violent Demonstration', weight: 0.6, escalationFactor: 0.9 },
  strategic_development: { name: 'Strategic Development', weight: 0.7, escalationFactor: 0.8 },
  violence_civilians: { name: 'Violence against Civilians', weight: 1.2, escalationFactor: 1.8 },
};

// --- КОНФИГУРАЦИЯ ИСТОЧНИКОВ ----------------------

const SOURCES = {
  acled: {
    name: 'ACLED',
    apiUrl: 'https://api.acleddata.com/acled/read',
    freeAccess: true,
    authRequired: true,
    note: 'Требует API-ключ (env ACLED_KEY)',
  },
  gdelt: {
    name: 'GDELT',
    apiUrl: 'https://api.gdeltproject.org/api/v2/doc/doc',
    freeAccess: true,
    authRequired: false,
  },
  ucdp: {
    name: 'UCDP',
    apiUrl: 'https://ucdpapi.pcr.uu.se/api',
    freeAccess: true,
    authRequired: false,
  },
  reliefweb: {
    name: 'ReliefWeb',
    apiUrl: 'https://api.reliefweb.int/v1',
    freeAccess: true,
    authRequired: false,
  },
};

// --- FETCH-ФУНКЦИИ --------------------------------

/**
 * Получение конфликтных событий из GDELT (без ключа).
 * @param {string} query — поисковый запрос (например, 'conflict Ukraine')
 * @param {number} days — глубина в днях
 * @returns {Promise<Object[]>} массив событий
 */
export async function fetchGDELTConflicts(query = 'conflict', days = 7) {
  try {
    const params = new URLSearchParams({
      query: `${query} sourcelang:eng`,
      mode: 'artlist',
      maxrecords: '250',
      format: 'json',
      timespan: `${days}d`,
    });

    const response = await fetch(`${SOURCES.gdelt.apiUrl}?${params}`);
    if (!response.ok) throw new Error(`GDELT API: ${response.status}`);

    const data = await response.json();
    const articles = Array.isArray(data.articles) ? data.articles : [];

    return articles.map(a => ({
      source: 'gdelt',
      title: a.title,
      url: a.url,
      domain: a.domain,
      language: a.language,
      country: a.sourcecountry,
      seenDate: a.seendate,
      socialImage: a.socialimage,
      tone: parseFloat(a.tone || 0),
    }));
  } catch (e) {
    console.error('[conflict] GDELT error:', e.message);
    return [];
  }
}

/**
 * Получение данных ACLED (требует ключ).
 * @param {string} country — ISO-код страны
 * @param {string} startDate — YYYY-MM-DD
 * @param {string} endDate — YYYY-MM-DD
 * @returns {Promise<Object[]>} события
 */
export async function fetchACLED(country = 'UKR', startDate = null, endDate = null) {
  try {
    const apiKey = process.env.ACLED_KEY;
    if (!apiKey) {
      console.warn('[conflict] ACLED: нет ACLED_KEY в env, пропускаем');
      return [];
    }

    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const start = startDate || weekAgo.toISOString().split('T')[0];
    const end = endDate || today.toISOString().split('T')[0];

    const params = new URLSearchParams({
      key: apiKey,
      email: process.env.ACLED_EMAIL || '',
      country,
      event_date: `${start}|${end}`,
      event_date_where: 'BETWEEN',
      limit: '500',
    });

    const response = await fetch(`${SOURCES.acled.apiUrl}?${params}`);
    if (!response.ok) throw new Error(`ACLED API: ${response.status}`);

    const data = await response.json();
    const events = Array.isArray(data.data) ? data.data : [];

    return events.map(e => ({
      source: 'acled',
      eventId: e.event_id_cnty,
      eventDate: e.event_date,
      eventType: e.event_type,
      subEventType: e.sub_event_type,
      country: e.country,
      region: e.admin1,
      latitude: parseFloat(e.latitude),
      longitude: parseFloat(e.longitude),
      fatalities: parseInt(e.fatalities || 0, 10),
      notes: e.notes,
      source: e.source,
    }));
  } catch (e) {
    console.error('[conflict] ACLED error:', e.message);
    return [];
  }
}

/**
 * Получение гуманитарных кризисов из ReliefWeb.
 * @param {string} country — ISO-код страны
 * @returns {Promise<Object[]>} кризисы
 */
export async function fetchReliefWebDisasters(country = 'UKR') {
  try {
    const params = new URLSearchParams({
      'filter[field]': 'country',
      'filter[value]': country,
      limit: '50',
      sort: 'date:desc',
    });

    const response = await fetch(`${SOURCES.reliefweb.apiUrl}/disasters?${params}`);
    if (!response.ok) throw new Error(`ReliefWeb API: ${response.status}`);

    const data = await response.json();
    const items = Array.isArray(data.data) ? data.data : [];

    return items.map(d => ({
      source: 'reliefweb',
      id: d.id,
      name: d.fields?.name,
      status: d.fields?.status,
      date: d.fields?.date?.created,
      country: country,
      url: d.fields?.url,
      description: d.fields?.description,
    }));
  } catch (e) {
    console.error('[conflict] ReliefWeb error:', e.message);
    return [];
  }
}

// --- АНАЛИЗ ---------------------------------------

/**
 * Оценка эскалации конфликта по историческим данным.
 * @param {Object[]} events — события за период
 * @param {Object[]} history — прошлые агрегаты (для тренда)
 * @returns {Object} оценка эскалации
 */
export function computeEscalationScore(events, history = []) {
  if (!Array.isArray(events) || events.length === 0) {
    return { score: 0, trend: 'stable', risk: 'low' };
  }

  // Взвешенная сумма по типам событий
  let weightedSum = 0;
  let totalFatalities = 0;
  const byType = {};

  for (const e of events) {
    const type = e.eventType || 'unknown';
    const config = CONFLICT_TYPES[type] || { weight: 0.5, escalationFactor: 1.0 };
    weightedSum += config.weight;
    totalFatalities += e.fatalities || 0;
    byType[type] = (byType[type] || 0) + 1;
  }

  // Нормализация
  const score = Math.min(1.0, weightedSum / 100 + totalFatalities / 1000);

  // Тренд
  let trend = 'stable';
  if (history.length >= 2) {
    const recent = history[history.length - 1].score || 0;
    const prev = history[history.length - 2].score || 0;
    if (recent > prev * 1.2) trend = 'escalating';
    else if (recent < prev * 0.8) trend = 'de-escalating';
  }

  // Риск
  let risk = 'low';
  if (score > 0.7) risk = 'critical';
  else if (score > 0.5) risk = 'high';
  else if (score > 0.3) risk = 'medium';

  return {
    score,
    trend,
    risk,
    totalEvents: events.length,
    totalFatalities,
    byType,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Главная функция — получить конфликтные данные и сохранить.
 * @param {Object} options — { country, days, query }
 * @returns {Promise<Object>} агрегированный результат
 */
export async function fetchConflictData(options = {}) {
  const { country = 'UKR', days = 7, query = 'conflict' } = options;

  const result = {
    timestamp: new Date().toISOString(),
    source: 'conflict',
    version: '1.0.0',
    country,
    gdelt: [],
    acled: [],
    reliefweb: [],
    escalation: null,
    alerts: [],
  };

  try {
    // Параллельно запрашиваем все источники
    const [gdelt, acled, reliefweb] = await Promise.all([
      fetchGDELTConflicts(query, days),
      fetchACLED(country),
      fetchReliefWebDisasters(country),
    ]);

    result.gdelt = gdelt;
    result.acled = acled;
    result.reliefweb = reliefweb;

    // Оценка эскалации
    result.escalation = computeEscalationScore(acled, []);

    // Алерты
    if (result.escalation.score > 0.5) {
      result.alerts.push({
        severity: result.escalation.score > 0.7 ? 'high' : 'medium',
        message: `Эскалация конфликта в ${country}: ${result.escalation.score.toFixed(2)}`,
      });
    }

    // Сохраняем
    mkdirSync(RUNS_DIR, { recursive: true });
    writeFileSync(
      join(RUNS_DIR, 'conflict_latest.json'),
      JSON.stringify(result, null, 2)
    );
  } catch (e) {
    result.error = e.message;
    console.error('[conflict] fetchConflictData error:', e.message);
  }

  return result;
}

export { SOURCES };

export default fetchConflictData;
