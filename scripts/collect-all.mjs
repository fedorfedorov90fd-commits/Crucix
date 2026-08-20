#!/usr/bin/env node

import { collectACLED } from './collect-acled.mjs';
import { collectFRED } from './collect-fred.mjs';
import { collectYahoo } from './collect-yahoo.mjs';
import { collectRussianSources } from './collect-russian-sources.mjs';
import { collectRIA } from './collect-ria.mjs';
import { collectOpenMeteo } from './collect-openmeteo.mjs';
import { collectFrostbyte } from './collect-frostbyte.mjs';
import { collectRSSExtra } from './collect-rss-extra.mjs';
import { collectSafecast } from './collect-safecast.mjs';
import { collectOpensky } from './collect-opensky.mjs';
import { collectShips } from './collect-ships.mjs';
import { collectOFAC } from './collect-ofac.mjs';
import { collectFIRMS } from './collect-firms.mjs';

async function collectAll() {
  console.log('[Collect All] ========================================');
  console.log('[Collect All] ЗАПУСК ВСЕХ СБОРЩИКОВ');
  console.log(`[Collect All] Время: ${new Date().toISOString()}`);
  console.log('[Collect All] ========================================');

  const sources = [
    { name: 'ACLED', fn: collectACLED },
    { name: 'FRED', fn: collectFRED },
    { name: 'Yahoo', fn: collectYahoo },
    { name: 'Russian', fn: collectRussianSources },
    { name: 'RIA', fn: collectRIA },
    { name: 'Open-Meteo', fn: collectOpenMeteo },
    { name: 'Frostbyte', fn: collectFrostbyte },
    { name: 'RSS Extra', fn: collectRSSExtra },
    { name: 'Safecast', fn: collectSafecast },
    { name: 'OpenSky', fn: collectOpensky },
    { name: 'Ships', fn: collectShips },
    { name: 'OFAC', fn: collectOFAC },
    { name: 'FIRMS', fn: collectFIRMS }
  ];

  for (const source of sources) {
    try {
      console.log(`[Collect All] ➜ ${source.name}...`);
      await source.fn();
    } catch (e) {
      console.error(`[Collect All] ❌ ${source.name} ошибка:`, e.message);
    }
  }

  console.log('[Collect All] ========================================');
  console.log('[Collect All] ГОТОВО');
}

if (import.meta.url === `file://${process.argv[1]}`) collectAll().catch(() => process.exit(1));
export { collectAll };
