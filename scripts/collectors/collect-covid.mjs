#!/usr/bin/env node

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASKET_DIR = join(process.cwd(), 'data', 'basket');

if (!existsSync(BASKET_DIR)) {
  mkdirSync(BASKET_DIR, { recursive: true });
}

async function fetchCovid() {
  console.log('[COVID] Загрузка статистики...');

  try {
    const url = 'https://disease.sh/v3/covid-19/countries';
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    const basketData = {
      source: 'COVID-19 API',
      lastUpdated: new Date().toISOString(),
      totalRecords: data.length,
      countries: data.slice(0, 50).map(c => ({
        country: c.country || 'Unknown',
        cases: c.cases || 0,
        deaths: c.deaths || 0,
        recovered: c.recovered || 0,
        active: c.active || 0,
        critical: c.critical || 0,
        todayCases: c.todayCases || 0,
        todayDeaths: c.todayDeaths || 0,
        population: c.population || 0
      })),
      note: 'Данные загружены через disease.sh API (без ключа)'
    };

    const filePath = join(BASKET_DIR, 'covid-latest.json');
    writeFileSync(filePath, JSON.stringify(basketData, null, 2));
    console.log(`[COVID] ✅ Данные сохранены в ${filePath}`);
    console.log(`[COVID] Всего стран: ${basketData.totalRecords}`);

  } catch (error) {
    console.error('[COVID] ❌ Ошибка:', error.message);
  }
}

fetchCovid();
