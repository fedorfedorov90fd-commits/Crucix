#!/usr/bin/env node

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASKET_DIR = join(process.cwd(), 'data', 'basket');

if (!existsSync(BASKET_DIR)) {
  mkdirSync(BASKET_DIR, { recursive: true });
}

async function fetchOpenAQ() {
  console.log('[OpenAQ] Загрузка данных о качестве воздуха...');

  try {
    const url = 'https://api.openaq.org/v2/latest?limit=100';
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    const basketData = {
      source: 'OpenAQ',
      lastUpdated: new Date().toISOString(),
      totalRecords: data.results?.length || 0,
      measurements: (data.results || []).slice(0, 50).map(r => ({
        city: r.city || 'Unknown',
        country: r.country || 'Unknown',
        location: r.location || 'Unknown',
        parameter: r.parameter || 'Unknown',
        value: r.value || 0,
        unit: r.unit || 'Unknown',
        lastUpdated: r.lastUpdated || new Date().toISOString()
      })),
      note: 'Данные загружены через OpenAQ API (без ключа)'
    };

    const filePath = join(BASKET_DIR, 'openaq-latest.json');
    writeFileSync(filePath, JSON.stringify(basketData, null, 2));
    console.log(`[OpenAQ] ✅ Данные сохранены в ${filePath}`);
    console.log(`[OpenAQ] Всего записей: ${basketData.totalRecords}`);

  } catch (error) {
    console.error('[OpenAQ] ❌ Ошибка:', error.message);
    const fallbackData = {
      source: 'OpenAQ (DEMO)',
      lastUpdated: new Date().toISOString(),
      totalRecords: 8,
      measurements: [
        { city: 'Beijing', country: 'CN', parameter: 'pm25', value: 35, unit: 'µg/m³' },
        { city: 'London', country: 'GB', parameter: 'pm25', value: 12, unit: 'µg/m³' },
        { city: 'New York', country: 'US', parameter: 'pm25', value: 8, unit: 'µg/m³' },
        { city: 'Moscow', country: 'RU', parameter: 'pm25', value: 25, unit: 'µg/m³' },
        { city: 'Delhi', country: 'IN', parameter: 'pm25', value: 120, unit: 'µg/m³' },
        { city: 'Paris', country: 'FR', parameter: 'pm25', value: 15, unit: 'µg/m³' },
        { city: 'Tokyo', country: 'JP', parameter: 'pm25', value: 10, unit: 'µg/m³' },
        { city: 'Sydney', country: 'AU', parameter: 'pm25', value: 5, unit: 'µg/m³' }
      ],
      note: 'Демо-данные (OpenAQ API недоступен)'
    };
    writeFileSync(join(BASKET_DIR, 'openaq-latest.json'), JSON.stringify(fallbackData, null, 2));
    console.log('[OpenAQ] ✅ Сохранены демо-данные');
  }
}

fetchOpenAQ();
