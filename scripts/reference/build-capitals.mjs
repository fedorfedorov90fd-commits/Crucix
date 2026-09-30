#!/usr/bin/env node
/**
 * Crucix Capitals Builder.
 * Версия 2.0.3. Принят 19.09.2026.
 *
 * Роль: собирает справочник координат столиц data/reference/capitals-coords.json
 * из открытых источников (без ключей). Все данные проверяемы, воспроизводимы.
 *
 * АКАДЕМИЧЕСКИЙ СТЕК v2.0.0 (5 источников, приоритет сверху вниз):
 *   1. Wikidata SPARQL — основной источник координат (245+ столиц).
 *      Свойства: wdt:P298 (iso3), wdt:P36 (capital), wdt:P625 (coordinate).
 *   2. countries.json.capital — если есть координаты (HKG, MAC).
 *   3. Wikipedia prop=coordinates — fallback для XKX, ESH и др.
 *   4. Natural Earth ne_10m — дополнительный fallback.
 *   5. Центроид countries.json — последний fallback (UMI и т.п.).
 *
 * Метаданные (name_ru, timezone) — из dr5hn/countries.
 * tz подбирается по координатам столицы (gmtOffset ≈ lon/15), а не по первому элементу.
 *
 * Итог: 250 записей {iso3, alpha2, name_en, name_ru, name_local, lat, lon,
 * timezone, is_capital, note, source_coords}.
 *
 * Контракт: node scripts/reference/build-capitals.mjs
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const RAW_DIR = join(ROOT, 'data', 'raw', 'reference');
const OUT_FILE = join(ROOT, 'data', 'reference', 'capitals-coords.json');
const COUNTRIES_FILE = join(ROOT, 'data', 'reference', 'countries.json');

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const NE_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson';
const DR5HN_URL = 'https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/countries.json';

const FETCH_TIMEOUT_MS = 60000;
const FETCH_RETRIES = 3;

async function log(msg) {
  console.log(`[build-capitals] ${msg}`);
}

async function fetchWithRetry(url, options = {}, retries = FETCH_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // v2.0.2: User-Agent и опции не конфликтуют. Раньше ...options перезаписывал headers,
      // теряя User-Agent → Wikidata возвращал 403 (блокировка ботов без UA).
      const fetchOptions = {
        method: options.method || 'GET',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Crucix-OSINT/1.0)',
          ...(options.headers || {})
        }
      };
      if (options.body !== undefined) fetchOptions.body = options.body;
      const r = await fetch(url, fetchOptions);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r;
    } catch (e) {
      if (attempt === retries) throw e;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

async function fetchJson(url, options) {
  const r = await fetchWithRetry(url, options);
  return r.json();
}

async function fetchText(url) {
  const r = await fetchWithRetry(url);
  return r.text();
}

async function ensureRaw(url, filename, ext = '.json') {
  const date = new Date().toISOString().slice(0, 10);
  const path = join(RAW_DIR, `${filename}-${date}${ext}`);
  if (existsSync(path)) {
    return JSON.parse(await readFile(path, 'utf-8'));
  }
  await mkdir(RAW_DIR, { recursive: true });
  const text = await fetchText(url);
  await writeFile(path, text, 'utf-8');
  return JSON.parse(text);
}

// === 1. Wikidata SPARQL: все столицы мира ===
async function loadWikidata() {
  log('Wikidata SPARQL: загрузка столиц (POST)...');
  const cachePath = join(RAW_DIR, `wikidata-capitals-${new Date().toISOString().slice(0, 10)}.json`);
  let j;
  if (existsSync(cachePath)) {
    j = JSON.parse(await readFile(cachePath, 'utf-8'));
    log('Wikidata SPARQL: из кэша');
  } else {
    const query = `SELECT ?iso3 ?alpha2 ?capitalLabel ?lat ?lon WHERE {
      ?country wdt:P298 ?iso3 .
      ?country wdt:P36 ?capital .
      ?capital wdt:P625 ?coord .
      OPTIONAL { ?country wdt:P297 ?alpha2 . }
      BIND(geof:latitude(?coord) AS ?lat)
      BIND(geof:longitude(?coord) AS ?lon)
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } ORDER BY ?iso3`;
    // v2.0.1: POST вместо GET (рекомендация Wikidata, обходит 403 при длинных URL)
    const body = 'query=' + encodeURIComponent(query);
    const r = await fetchWithRetry(WIKIDATA_SPARQL, {
      method: 'POST',
      headers: {
        'Accept': 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });
    j = await r.json();
    await mkdir(RAW_DIR, { recursive: true });
    await writeFile(cachePath, JSON.stringify(j, null, 2), 'utf-8');
  }
  const rows = j.results?.bindings || [];
  const map = new Map();
  for (const r of rows) {
    const iso3 = r.iso3.value;
    if (map.has(iso3)) continue; // первая запись на iso3
    map.set(iso3, {
      iso3,
      alpha2: r.alpha2?.value || null,
      capital: r.capitalLabel?.value || null,
      lat: parseFloat(r.lat.value),
      lon: parseFloat(r.lon.value),
      source_coords: 'wikidata'
    });
  }
  log(`Wikidata: ${map.size} столиц`);
  return map;
}

// === 1b. Wikidata P625 для территорий без столиц (UMI, BES, SJM, BVT, HMD, TKL, ATA) ===
async function loadWikidataTerritories(iso3List) {
  if (!iso3List || iso3List.length === 0) return new Map();
  log(`Wikidata territories: запрос для ${iso3List.length} территорий...`);
  const cachePath = join(RAW_DIR, `wikidata-territories-${new Date().toISOString().slice(0, 10)}.json`);
  let j;
  if (existsSync(cachePath)) {
    j = JSON.parse(await readFile(cachePath, 'utf-8'));
    log('Wikidata territories: из кэша');
  } else {
    const valuesStr = iso3List.map(s => `"${s}"`).join(' ');
    const query = `SELECT ?iso3 ?coord ?lat ?lon WHERE {
      VALUES ?iso3 { ${valuesStr} }
      ?country wdt:P298 ?iso3 .
      ?country wdt:P625 ?coord .
      BIND(geof:latitude(?coord) AS ?lat)
      BIND(geof:longitude(?coord) AS ?lon)
    }`;
    const body = 'query=' + encodeURIComponent(query);
    const r = await fetchWithRetry(WIKIDATA_SPARQL, {
      method: 'POST',
      headers: {
        'Accept': 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });
    j = await r.json();
    await mkdir(RAW_DIR, { recursive: true });
    await writeFile(cachePath, JSON.stringify(j, null, 2), 'utf-8');
  }
  const rows = j.results?.bindings || [];
  const map = new Map();
  for (const r of rows) {
    const iso3 = r.iso3.value;
    if (map.has(iso3)) continue;
    map.set(iso3, {
      lat: parseFloat(r.lat.value),
      lon: parseFloat(r.lon.value),
      source_coords: 'wikidata-territory'
    });
  }
  log(`Wikidata territories: ${map.size} записей`);
  return map;
}

// === 2. Natural Earth (fallback) ===
async function loadNaturalEarth() {
  log('Natural Earth: загрузка...');
  const j = await ensureRaw(NE_URL, 'ne_10m_populated_places', '.geojson');
  const capitals = j.features.filter(f => f.properties.featurecla && f.properties.featurecla.includes('Admin-0 capital'));
  const map = new Map();
  const ISO_MAP = { KOS: 'XKX', SAH: 'ESH' }; // NE → наши коды
  for (const f of capitals) {
    const p = f.properties;
    let iso3 = p.adm0_a3;
    if (!iso3) continue;
    if (ISO_MAP[iso3]) iso3 = ISO_MAP[iso3];
    if (map.has(iso3)) continue;
    map.set(iso3, {
      iso3,
      alpha2: p.iso_a2 || null,
      name_en: p.nameascii || p.name,
      lat: p.latitude,
      lon: p.longitude,
      source_coords: 'natural-earth'
    });
  }
  log(`Natural Earth: ${map.size} столиц`);
  return map;
}

// === 3. dr5hn/countries: name_ru, timezones ===
async function loadDr5hn() {
  log('dr5hn/countries: загрузка...');
  const a = await ensureRaw(DR5HN_URL, 'dr5hn-countries');
  const map = new Map();
  for (const c of a) {
    if (!c.iso3) continue;
    map.set(c.iso3, {
      iso3: c.iso3,
      name_ru: c.translations?.ru || null,
      native: c.native || null,
      timezones: Array.isArray(c.timezones) ? c.timezones : []
    });
  }
  log(`dr5hn: ${map.size} стран`);
  return map;
}

// === 4. Wikipedia prop=coordinates (последний fallback) ===
async function fetchWikipediaCoords(title) {
  if (!title) return null;
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=coordinates&format=json`;
    const j = await fetchJson(url);
    const pages = j.query?.pages || {};
    for (const k of Object.keys(pages)) {
      const p = pages[k];
      if (p.coordinates && p.coordinates[0]) {
        return { lat: p.coordinates[0].lat, lon: p.coordinates[0].lon };
      }
    }
    return null;
  } catch (e) {
    log(`Wikipedia '${title}' ошибка: ${e.message}`);
    return null;
  }
}

// === Подбор tz по координатам (gmtOffset ≈ lon/15) ===
function pickTimezone(timezones, lat, lon) {
  if (!Array.isArray(timezones) || timezones.length === 0) return null;
  if (timezones.length === 1) return timezones[0].zoneName || null;
  const expectedOffsetHours = Math.round(lon / 15);
  let best = null;
  let bestDiff = Infinity;
  for (const tz of timezones) {
    const tzOffsetHours = (tz.gmtOffset || 0) / 3600;
    const diff = Math.abs(tzOffsetHours - expectedOffsetHours);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = tz;
    }
  }
  return best?.zoneName || null;
}

// === Основная сборка ===
async function build() {
  log('=== Начало сборки v2.0.3 ===');

  const wikidata = await loadWikidata();
  const ne = await loadNaturalEarth();
  const dr5hn = await loadDr5hn();
  const countriesLocal = JSON.parse(await readFile(COUNTRIES_FILE, 'utf-8'));
  const localCountries = countriesLocal.countries || {};
  log(`Локальный countries.json: ${Object.keys(localCountries).length} стран`);

  const allIso3 = Object.keys(localCountries);

  // v2.0.3: заранее определяем список iso3, которых нет в Wikidata-капиталах.
  // Для них пробуем загрузить P625 (coordinate location) территории одним запросом.
  const missingFromWikidata = allIso3.filter(iso3 => !wikidata.has(iso3));
  const wikidataTerritories = await loadWikidataTerritories(missingFromWikidata);

  const capitals = {};
  const stats = { wikidata: 0, crucix_local: 0, wikipedia: 0, natural_earth: 0, wikidata_territory: 0, centroid: 0, missing: 0 };
  const problems = [];

  for (const iso3 of allIso3) {
    const local = localCountries[iso3];
    const dr = dr5hn.get(iso3);
    let lat = null, lon = null, source_coords = null;

    // 1. Wikidata (основной)
    if (wikidata.has(iso3)) {
      const w = wikidata.get(iso3);
      lat = w.lat; lon = w.lon;
      source_coords = 'wikidata';
      stats.wikidata++;
    }
    // 2. countries.json.capital (уже с координатами — HKG, MAC)
    else if (local?.capital?.lat != null && local?.capital?.lon != null) {
      lat = local.capital.lat; lon = local.capital.lon;
      source_coords = 'crucix-local';
      stats.crucix_local++;
    }
    // 3. Natural Earth (fallback)
    else if (ne.has(iso3)) {
      const n = ne.get(iso3);
      lat = n.lat; lon = n.lon;
      source_coords = 'natural-earth';
      stats.natural_earth++;
    }
    // 4. Wikipedia (для XKX, ESH — есть названия в dr5hn)
    else {
      const capName = dr?.native && dr?.name_ru ? null : null; // пропускаем, идём через Wikipedia по названию столицы из dr5hn
      const wikiTitle = dr?.capital_name || null;
      let wiki = null;
      if (wikiTitle) wiki = await fetchWikipediaCoords(wikiTitle);
      if (wiki) {
        lat = wiki.lat; lon = wiki.lon;
        source_coords = 'wikipedia';
        stats.wikipedia++;
      }
      // 5. Wikidata территории (P625 у самой территории, не столицы)
      else if (wikidataTerritories.has(iso3)) {
        const t = wikidataTerritories.get(iso3);
        lat = t.lat; lon = t.lon;
        source_coords = 'wikidata-territory';
        stats.wikidata_territory++;
      }
      // 6. Центроид
      else if (local?.centroid?.lat != null && local?.centroid?.lon != null) {
        lat = local.centroid.lat; lon = local.centroid.lon;
        source_coords = 'centroid-fallback';
        stats.centroid++;
        problems.push(`${iso3} (${local?.names?.en}): центроид вместо столицы`);
      } else {
        stats.missing++;
        problems.push(`${iso3}: НЕТ координат`);
      }
    }

    const tz = pickTimezone(dr?.timezones, lat, lon);

    capitals[iso3] = {
      iso3,
      alpha2: local?.alpha2 || wikidata.get(iso3)?.alpha2 || null,
      name_en: local?.names?.en || wikidata.get(iso3)?.capital || null,
      name_ru: local?.names?.ru || dr?.name_ru || null,
      name_local: local?.names?.local || dr?.native || null,
      lat, lon,
      timezone: tz,
      is_capital: true,
      note: null,
      source_coords
    };
  }

  // Индексы
  const by_alpha2 = {};
  const by_name_lower = {};
  for (const iso3 of Object.keys(capitals)) {
    const c = capitals[iso3];
    if (c.alpha2) by_alpha2[c.alpha2] = iso3;
    for (const key of ['name_en', 'name_ru', 'name_local']) {
      const v = c[key];
      if (typeof v === 'string' && v.length > 0) by_name_lower[v.toLowerCase().trim()] = iso3;
    }
  }

  const output = {
    schema: 'crucix.capitals.v1',
    generated_at: new Date().toISOString(),
    source: 'Wikidata SPARQL + countries.json + Natural Earth + dr5hn',
    count: Object.keys(capitals).length,
    stats,
    capitals,
    indexes: { by_alpha2, by_name_lower }
  };

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(output, null, 2), 'utf-8');

  log('=== Готово ===');
  log(`Всего: ${output.count}`);
  log(`Wikidata: ${stats.wikidata}`);
  log(`Crucix-local: ${stats.crucix_local}`);
  log(`Natural Earth: ${stats.natural_earth}`);
  log(`Wikidata-territory: ${stats.wikidata_territory}`);
  log(`Wikipedia: ${stats.wikipedia}`);
  log(`Centroid: ${stats.centroid}`);
  log(`Missing: ${stats.missing}`);
  if (problems.length > 0) {
    log(`Проблемы (${problems.length}):`);
    for (const p of problems) log(`  - ${p}`);
  }
  log(`Файл: ${OUT_FILE}`);
  return output;
}

build().catch(e => {
  console.error('[build-capitals] FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
