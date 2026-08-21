#!/usr/bin/env node

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASKET_DIR = join(process.cwd(), 'data', 'basket');

if (!existsSync(BASKET_DIR)) {
  mkdirSync(BASKET_DIR, { recursive: true });
}

async function fetchTradingEconomics() {
  console.log('[TradingEconomics] Загрузка экономических данных...');

  // Для Trading Economics нужен API-ключ
  // Если ключ не задан — используем демо-данные
  const apiKey = process.env.TRADING_ECONOMICS_KEY || 'demo';

  if (apiKey === 'demo') {
    console.log('[TradingEconomics] ⚠️ Режим демо-данных (ключ не задан)');

    const demoData = {
      source: 'TradingEconomics',
      lastUpdated: new Date().toISOString(),
      indicators: {
        us_inflation: { value: 3.2, year: 2024, note: 'Демо-данные' },
        us_unemployment: { value: 3.9, year: 2024, note: 'Демо-данные' },
        fed_rate: { value: 5.5, year: 2024, note: 'Демо-данные' },
        eu_inflation: { value: 2.6, year: 2024, note: 'Демо-данные' },
        china_gdp: { value: 4.8, year: 2024, note: 'Демо-данные' },
      },
      note: 'Для получения реальных данных установите TRADING_ECONOMICS_KEY в .env'
    };

    const filePath = join(BASKET_DIR, 'trading-economics-latest.json');
    writeFileSync(filePath, JSON.stringify(demoData, null, 2));
    console.log(`[TradingEconomics] ✅ Демо-данные сохранены в ${filePath}`);
    return;
  }

  // TODO: Реальная интеграция с Trading Economics API
  console.log('[TradingEconomics] 🔄 Реальная интеграция будет добавлена позже');
}

fetchTradingEconomics();
