#!/usr/bin/env node

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASKET_DIR = join(process.cwd(), 'data', 'basket');

if (!existsSync(BASKET_DIR)) {
  mkdirSync(BASKET_DIR, { recursive: true });
}

const INDICATORS = {
  'GDP': 'NY.GDP.MKTP.CD',           // ВВП
  'GDP_PC': 'NY.GDP.PCAP.CD',        // ВВП на душу
  'INFLATION': 'FP.CPI.TOTL.ZG',     // Инфляция
  'UNEMPLOYMENT': 'SL.UEM.TOTL.ZS',  // Безработица
  'DEBT': 'DT.DOD.DECT.CD',          // Внешний долг
  'POPULATION': 'SP.POP.TOTL'        // Население
};

async function fetchWorldBank() {
  console.log('[WorldBank] Загрузка экономических данных...');

  try {
    const results = {};

    for (const [key, code] of Object.entries(INDICATORS)) {
      const url = `https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&per_page=1`;
      console.log(`[WorldBank] Загрузка ${key}...`);

      const response = await fetch(url);
      if (!response.ok) continue;

      const data = await response.json();
      if (data && data[1] && data[1].length > 0) {
        const latest = data[1][0];
        results[key] = {
          value: latest.value,
          year: latest.date,
          country: latest.country?.value || 'World'
        };
      }
    }

    const basketData = {
      source: 'WorldBank',
      lastUpdated: new Date().toISOString(),
      indicators: results,
      note: 'Данные загружены через World Bank API (без ключа)'
    };

    const filePath = join(BASKET_DIR, 'worldbank-latest.json');
    writeFileSync(filePath, JSON.stringify(basketData, null, 2));
    console.log(`[WorldBank] ✅ Данные сохранены в ${filePath}`);

    // Показываем, что загружено
    console.log('[WorldBank] Загруженные показатели:');
    for (const [key, val] of Object.entries(results)) {
      console.log(`  ${key}: ${val.value} (${val.year})`);
    }

  } catch (error) {
    console.error('[WorldBank] ❌ Ошибка:', error.message);
  }
}

fetchWorldBank();
