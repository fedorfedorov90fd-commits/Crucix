#!/usr/bin/env node
/**
 * scripts/collectors/collect-un-votes.mjs — СБОРЩИК: ГОЛОСОВАНИЯ ООН
 * Версия 1.0.1. Принят 23.09.2026.
 *
 * ИСТОЧНИК: Erik Voeten "United Nations General Assembly Voting Data".
 *   Основной файл: IdealpointestimatesAll_Apr2020.csv (1.16 МБ, 10470 строк).
 *   Справочник: COW country codes.csv (4582 байта).
 *   GitHub raw: https://raw.githubusercontent.com/evoeten/United-Nations-General-Assembly-Votes-and-Ideal-Points/master/Output/IdealpointestimatesAll_Apr2020.csv
 *   Лицензия: CC0 1.0 (public domain).
 *   Автор: Erik Voeten (Georgetown University).
 *
 * СХЕМА CSV (IdealpointestimatesAll_Apr2020.csv):
 *   Row, ccode, session, NVotes, IdealPoint, QO%, Q5%, Q10%, Q50%, Q90%, Q95%, Q100%, iso3c, Countryname
 *   - IdealPoint: координата страны на оси "запад ↔ остальные" (+2...+3 западный блок).
 *   - session: номер сессии ГА ООН (1 = 1946, ~75 = 2020).
 *
 * Роль: скачивает CSV с GitHub raw, парсит, агрегирует по странам (последний
 * ideal point) и по сессиям (средний ideal point), сдаёт на склад через
 * collector-helper. Сборщик НЕ пишет в basket — только raw + накладная.
 *
 * Изменения v1.0.1:
 *   - series[].date: номер сессии → ISO 8601 год (1945 + session).
 *   - granularity: session → yearly (схема basket.v1 не знает session).
 *   - license: cc0-1.0 → cc-zero (по списку допустимых).
 *
 * Контракт v3: saveRaw, backwardCompat: false.
 * Контракт v2 для consumer (последующий api-модуль) — route/handler.
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const GITHUB_BASE = 'https://raw.githubusercontent.com/evoeten/United-Nations-General-Assembly-Votes-and-Ideal-Points/master';
const CSV_URL = `${GITHUB_BASE}/Output/IdealpointestimatesAll_Apr2020.csv`;
const COW_URL = `${GITHUB_BASE}/Data/COW%20country%20codes.csv`;

const USER_AGENT = 'Crucix/1.0 (UN voting data collector)';
const TIMEOUT_MS = 30000;

/**
 * Простой CSV-парсер. Понимает кавычки, экранирование кавычек внутри.
 * Возвращает массив объектов { <header_name>: <value> }.
 */
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];
  const headers = splitCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    if (values.length !== headers.length) continue;
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j];
    }
    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ',') { result.push(cur); cur = ''; }
      else if (ch === '"') { inQuotes = true; }
      else { cur += ch; }
    }
  }
  result.push(cur);
  return result;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/csv, text/plain, */*' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function collectUnVotes() {
  const start = Date.now();
  console.log('[UN-Votes] Запуск. Источник: Erik Voeten UNGA Ideal Points (GitHub)');

  const csvText = await fetchText(CSV_URL);
  console.log(`[UN-Votes] CSV скачан: ${csvText.length} байт`);

  const cowText = await fetchText(COW_URL).catch(() => '');
  console.log(`[UN-Votes] COW справочник: ${cowText.length} байт`);

  const rows = parseCSV(csvText);
  console.log(`[UN-Votes] Парсинг: ${rows.length} строк`);

  if (rows.length === 0) {
    throw new Error('Пустой CSV — не найдены строки');
  }

  // Маппинг ccode → StateAbb (из COW)
  const cowMap = new Map();
  if (cowText) {
    const cowRows = parseCSV(cowText);
    for (const r of cowRows) {
      const ccode = String(r.CCode || '').trim();
      const abb = String(r.StateAbb || '').trim();
      if (ccode && abb && !cowMap.has(ccode)) cowMap.set(ccode, abb);
    }
  }

  // Парсинг записей
  const records = [];
  const byCountry = new Map();
  const bySession = new Map();

  for (const r of rows) {
    const ccode = parseInt(r.ccode);
    const session = parseInt(r.session);
    const nVotes = parseInt(r.NVotes);
    const idealPoint = parseFloat(r.IdealPoint);
    const iso3c = String(r.iso3c || '').trim();
    const countryName = String(r.Countryname || '').trim();
    if (!Number.isFinite(ccode) || !Number.isFinite(session) || !Number.isFinite(idealPoint)) continue;

    const record = {
      ccode,
      session,
      n_votes: nVotes,
      ideal_point: Math.round(idealPoint * 10000) / 10000,
      iso3c,
      country: countryName,
      state_abb: cowMap.get(String(ccode)) || null,
    };
    records.push(record);

    // Последний (по session) ideal point для страны
    const prev = byCountry.get(iso3c);
    if (!prev || session > prev.session) {
      byCountry.set(iso3c, record);
    }

    // Средний ideal point по сессии
    if (!bySession.has(session)) bySession.set(session, { session, sum: 0, count: 0, n_votes_sum: 0 });
    const s = bySession.get(session);
    s.sum += idealPoint;
    s.count += 1;
    if (Number.isFinite(nVotes)) s.n_votes_sum += nVotes;
  }

  // Регионы — по странам (последний ideal point)
  const regions = [...byCountry.values()]
    .sort((a, b) => b.ideal_point - a.ideal_point)
    .map(r => ({
      region: r.iso3c,
      value: r.ideal_point,
      count: 1,
      aggregation: 'last',
      country: r.country,
      session: r.session,
      n_votes: r.n_votes,
      state_abb: r.state_abb,
    }));

  // Серии — по сессиям (средний ideal point)
  const series = [...bySession.values()]
    .sort((a, b) => a.session - b.session)
    .map(s => ({
      date: `${1945 + s.session}-01-01`,
      value: Math.round((s.sum / s.count) * 10000) / 10000,
      session: s.session,
      countries: s.count,
      n_votes_sum: s.n_votes_sum,
    }));

  const latestSession = series.length ? series[series.length - 1].session : null;

  const payload = {
    source: 'Erik Voeten UNGA Ideal Points',
    source_url: CSV_URL,
    lastUpdated: new Date().toISOString(),
    latest_session: latestSession,
    records_count: records.length,
    countries_count: byCountry.size,
    sessions_count: bySession.size,
    series,
    regions,
    records,
  };

  const saveResult = await saveRaw('un-votes', payload, {
    collector: 'collect-un-votes.mjs',
    source: 'Erik Voeten UNGA Voting Data (GitHub)',
    source_url: CSV_URL,
    license: 'cc-zero',
    format_hint: 'regions',
    value_type: 'index',
    value_unit: 'ideal_point',
    granularity: 'yearly',
    period: null,
    record_count: records.length,
    notes: `${rows.length} строк CSV; ${byCountry.size} стран; ${bySession.size} сессий; последняя сессия: ${latestSession}`,
    backwardCompat: false,
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[UN-Votes] OK ${records.length} записей за ${elapsed}с → ${saveResult.raw_file}`);
  console.log(`[UN-Votes] Накладная: ${saveResult.incoming_file}`);
  return payload;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectUnVotes().catch((e) => { console.error('[UN-Votes] FATAL:', e); process.exit(1); });
}
