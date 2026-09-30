#!/usr/bin/env node
/**
 * scripts/reference/build-countries.mjs
 * Генератор ЕДИНОГО справочника стран v2.0.0.
 *
 * Читает:
 *   data/reference/country-characteristics.json (197 стран, name, nameRu, regime, baseRisk, region, tier, multiplier)
 *   data/geo/country-coords.json                (175 стран, nameRu, lat, lng)
 *   data/reference/country-aliases.json         (152 алиаса)
 *   data/geo/world.geojson                      (177 полигонов для bbox)
 *   scripts/reference/alpha2-table.mjs          (249 alpha-2 ↔ ISO3)
 *   scripts/reference/table-numeric.mjs         (249 numeric)
 *   scripts/reference/table-unregions.mjs       (187 region_un/subregion_un)
 *   scripts/reference/table-special.mjs         (status, former_names, capitals)
 *   scripts/reference/table-languages-currency.mjs (languages, currency)
 *
 * Пишет:
 *   data/reference/countries.json
 *
 * Схема: {schema, generated_at, count, countries: {iso3: {...}}, indexes: {...}}
 * Индексы: by_alpha2, by_numeric, by_alias_lower, by_region_un, by_subregion_un.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ALPHA2_TO_ISO3 } from './alpha2-table.mjs';
import { ISO3_TO_NUMERIC } from './table-numeric.mjs';
import { UN_M49 } from './table-unregions.mjs';
import { STATUS_OVERRIDES, FORMER_NAMES, CAPITALS } from './table-special.mjs';
import { LANGUAGES_CURRENCY } from './table-languages-currency.mjs';
import { TERRITORIES } from './table-territories.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const PATHS = {
  cc: join(ROOT, 'data', 'reference', 'country-characteristics.json'),
  coords: join(ROOT, 'data', 'geo', 'country-coords.json'),
  aliases: join(ROOT, 'data', 'reference', 'country-aliases.json'),
  geojson: join(ROOT, 'data', 'geo', 'world.geojson'),
  out: join(ROOT, 'data', 'reference', 'countries.json')
};

const ISO3_TO_ALPHA2 = (() => {
  const m = {};
  for (const [a2, a3] of Object.entries(ALPHA2_TO_ISO3)) m[a3] = a2;
  return m;
})();

async function loadJSON(path) {
  return JSON.parse(await readFile(path, 'utf-8'));
}

function normalizeKey(s) {
  return String(s).trim().toLowerCase();
}

function bboxFromCoordinates(coords) {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  function walk(c) {
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      const lon = c[0], lat = c[1];
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    } else {
      for (const sub of c) walk(sub);
    }
  }
  walk(coords);
  if (!Number.isFinite(minLat)) return null;
  return { minLat, maxLat, minLon, maxLon };
}

async function main() {
  const t0 = Date.now();
  const cc = await loadJSON(PATHS.cc);
  const coords = await loadJSON(PATHS.coords);
  const aliasesRaw = await loadJSON(PATHS.aliases);
  const aliasesMap = aliasesRaw.aliases || {};
  let geojson = { features: [] };
  try { geojson = await loadJSON(PATHS.geojson); } catch (e) { console.warn('[build-countries] world.geojson не найден'); }

  // bbox by name (латиница из properties.name)
  const bboxByName = new Map();
  for (const f of geojson.features || []) {
    const name = f.properties && f.properties.name;
    if (!name || !f.geometry) continue;
    const coordsArr = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const bbox = bboxFromCoordinates(coordsArr);
    if (bbox) bboxByName.set(normalizeKey(name), bbox);
  }

  // Координаты по nameRu (кириллица)
  const coordsByNameRu = new Map();
  for (const info of Object.values(coords)) {
    if (!info || !info.name) continue;
    if (typeof info.lat !== 'number' || typeof info.lng !== 'number') continue;
    coordsByNameRu.set(normalizeKey(info.name), { lat: info.lat, lon: info.lng });
  }

  const countries = {};
  const by_alpha2 = {};
  const by_numeric = {};
  const by_alias_lower = {};
  const by_region_un = {};
  const by_subregion_un = {};
  const aliasConflicts = new Map();

  let withCoords = 0, withNumeric = 0, withBbox = 0, withCapital = 0;

  const allCountries = { ...(cc.countries || {}), ...TERRITORIES };
  for (const [iso3, info] of Object.entries(allCountries)) {
    if (!info) continue;
    const alpha2 = ISO3_TO_ALPHA2[iso3] || null;
    const numeric = ISO3_TO_NUMERIC[iso3] || (iso3 === 'XKX' ? '983' : null);
    const nameEn = info.name || null;
    const nameRu = info.nameRu || null;

    let centroid = null;
    if (nameRu) {
      const c = coordsByNameRu.get(normalizeKey(nameRu));
      if (c) { centroid = c; withCoords++; }
    }
    // Fallback: если нет в country-coords — берём capital как centroid.
    if (!centroid && CAPITALS[iso3]) {
      centroid = { lat: CAPITALS[iso3].lat, lon: CAPITALS[iso3].lon };
      withCoords++;
    }

    let bbox = null;
    if (nameEn) bbox = bboxByName.get(normalizeKey(nameEn)) || null;
    if (bbox) withBbox++;

    const un = UN_M49[iso3] || {};
    const special = STATUS_OVERRIDES[iso3] || {};
    const former = FORMER_NAMES[iso3] || [];
    const capital = CAPITALS[iso3] || null;
    if (capital) withCapital++;
    const lc = LANGUAGES_CURRENCY[iso3] || {};

    // Aliases массив с типами
    const aliases = [];
    if (nameEn) aliases.push({ value: nameEn, type: 'short' });
    if (nameRu) aliases.push({ value: nameRu, type: 'local' });
    if (alpha2) aliases.push({ value: alpha2, type: 'abbrev' });
    aliases.push({ value: iso3, type: 'abbrev' });
    for (const fn of former) aliases.push({ value: fn.name, type: 'former', valid_until: fn.valid_until || null });

    const entry = {
      iso3,
      alpha2,
      numeric,
      status: special.status || 'sovereign',
      names: { en: nameEn, ru: nameRu, local: nameRu },
      former_names: former,
      centroid,
      bbox,
      capital,
      region_un: un.region_un || null,
      subregion_un: un.subregion_un || null,
      languages: lc.languages || [],
      currency: lc.currency || null,
      regime: info.regime || null,
      baseRisk: info.baseRisk ?? null,
      tier: info.tier ?? null,
      multiplier: info.multiplier ?? null,
      subdivisions_count: null,
      parent_country: special.parent_country || null,
      valid_from: special.valid_from || null,
      valid_until: special.valid_until || null,
      note: special.note || null,
      aliases
    };
    countries[iso3] = entry;

    if (alpha2) by_alpha2[alpha2] = iso3;
    if (numeric) { by_numeric[numeric] = iso3; withNumeric++; }
    if (un.region_un) {
      if (!by_region_un[un.region_un]) by_region_un[un.region_un] = [];
      by_region_un[un.region_un].push(iso3);
    }
    if (un.subregion_un) {
      if (!by_subregion_un[un.subregion_un]) by_subregion_un[un.subregion_un] = [];
      by_subregion_un[un.subregion_un].push(iso3);
    }
  }

  // by_alias_lower: собираем из aliases + country-aliases.json, детект коллизий
  for (const [iso3, entry] of Object.entries(countries)) {
    for (const a of entry.aliases) {
      const key = normalizeKey(a.value);
      if (!key) continue;
      const existing = by_alias_lower[key];
      if (existing && existing !== iso3) {
        if (!aliasConflicts.has(key)) aliasConflicts.set(key, new Set([existing]));
        aliasConflicts.get(key).add(iso3);
      } else {
        by_alias_lower[key] = iso3;
      }
    }
  }
  for (const [alias, iso3] of Object.entries(aliasesMap)) {
    if (!countries[iso3]) continue;
    const key = normalizeKey(alias);
    const existing = by_alias_lower[key];
    if (existing && existing !== iso3) {
      if (!aliasConflicts.has(key)) aliasConflicts.set(key, new Set([existing]));
      aliasConflicts.get(key).add(iso3);
    } else {
      by_alias_lower[key] = iso3;
    }
  }

  // Помечаем коллизии как _ambiguous
  for (const [key, set] of aliasConflicts) {
    by_alias_lower[key] = { _ambiguous: Array.from(set).sort() };
  }

  const output = {
    schema: 'crucix.countries.v1',
    generated_at: new Date().toISOString(),
    source: 'ISO 3166-1 + UN M49 + manual curation',
    count: Object.keys(countries).length,
    countries,
    indexes: { by_alpha2, by_numeric, by_alias_lower, by_region_un, by_subregion_un },
    _meta: {
      total_iso3: Object.keys(countries).length,
      total_with_coords: withCoords,
      total_with_numeric: withNumeric,
      total_with_bbox: withBbox,
      total_with_capital: withCapital,
      total_aliases: Object.keys(by_alias_lower).length,
      total_conflicts: aliasConflicts.size
    }
  };

  await mkdir(dirname(PATHS.out), { recursive: true });
  await writeFile(PATHS.out, JSON.stringify(output, null, 2), 'utf-8');

  const ms = Date.now() - t0;
  console.log(`[build-countries] OK за ${ms}мс`);
  console.log(`  countries: ${output.count}`);
  console.log(`  by_alpha2: ${Object.keys(by_alpha2).length}`);
  console.log(`  by_numeric: ${Object.keys(by_numeric).length}`);
  console.log(`  by_alias_lower: ${Object.keys(by_alias_lower).length}`);
  console.log(`  by_region_un: ${Object.keys(by_region_un).length}`);
  console.log(`  by_subregion_un: ${Object.keys(by_subregion_un).length}`);
  console.log(`  with_coords: ${withCoords}, with_numeric: ${withNumeric}, with_bbox: ${withBbox}, with_capital: ${withCapital}`);
  console.log(`  conflicts: ${aliasConflicts.size}`);
}

main().catch((e) => { console.error('[build-countries] FAIL:', e); process.exit(1); });
