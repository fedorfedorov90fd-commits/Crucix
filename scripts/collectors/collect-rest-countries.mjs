#!/usr/bin/env node
/**
 * Crucix Collector: rest-countries (справочник стран) — реальные данные.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: https://raw.githubusercontent.com/mledoze/countries/master/countries.json
 * Формат: {source, upstream, updated, total, countries:{iso3:{...}}}. Тип — hierarchical.
 * ПРИМЕЧАНИЕ: REST Countries v3.1 deprecated → используется mledoze/countries.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const SOURCE = 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json';
const TIMEOUT_MS = 30000;

export async function collectRestCountries() {
  console.log('[RESTCountries] Загрузка...');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let basketData;
  let ok = false;
  try {
    const r = await fetch(SOURCE, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();

    const countries = {};
    for (const c of d) {
      if (!c.cca3 || !c.latlng || c.latlng.length < 2) continue;
      countries[c.cca3] = {
        name: c.name?.common || c.cca3,
        officialName: c.name?.official || null,
        capital: c.capital?.[0] || null,
        region: c.region || null,
        subregion: c.subregion || null,
        population: c.population ?? null,
        area: c.area || null,
        lat: c.latlng[0],
        lng: c.latlng[1],
        borders: c.borders || [],
        currencies: c.currencies ? Object.keys(c.currencies) : [],
        languages: c.languages ? Object.keys(c.languages) : [],
        flag: c.flag || null,
      };
    }

    basketData = {
      source: 'mledoze/countries (mirror of REST Countries data)',
      upstream: SOURCE,
      updated: new Date().toISOString(),
      total: Object.keys(countries).length,
      countries,
    };
    console.log(`[RESTCountries] ${basketData.total} стран`);
    ok = true;
  } catch (e) {
    clearTimeout(timer);
    console.error('[RESTCountries] ⚠️ Ошибка:', e.message);
    basketData = { source: 'RESTCountries (fallback)', updated: new Date().toISOString(), total: 0, countries: {}, error: e.message };
  }

  const result = await saveRaw('rest-countries', basketData, {
    collector: 'collect-rest-countries.mjs',
    source: 'mledoze/countries',
    source_url: SOURCE,
    license: 'public-domain',
    format_hint: 'hierarchical',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: basketData.total,
    notes: ok ? `Реальные данные, ${basketData.total} стран` : 'Fallback (API недоступен); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[RESTCountries] OK → ${result.raw_file}`);
  return basketData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectRestCountries().catch((e) => { console.error('[RESTCountries] FATAL:', e); process.exit(1); });
}
