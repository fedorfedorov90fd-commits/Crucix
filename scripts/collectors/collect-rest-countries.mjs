#!/usr/bin/env node
// collect-rest-countries.mjs — справочник стран из mledoze/countries (без ключа)
// ИСПРАВЛЕНО 12.09.2026: REST Countries v3.1 deprecated → используем mledoze/countries на GitHub.

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET = join(__dirname, '..', '..', 'data', 'basket');
const SOURCE = 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json';

async function main() {
  const r = await fetch(SOURCE);
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

  const out = {
    source: 'mledoze/countries (mirror of REST Countries data)',
    upstream: SOURCE,
    updated: new Date().toISOString(),
    total: Object.keys(countries).length,
    countries,
  };

  await fs.mkdir(BASKET, { recursive: true });
  await fs.writeFile(join(BASKET, 'rest-countries.json'), JSON.stringify(out, null, 2));
  console.log(`[RESTCountries] ${out.total} стран сохранено`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
