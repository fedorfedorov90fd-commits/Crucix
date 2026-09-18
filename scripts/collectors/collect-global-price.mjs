#!/usr/bin/env node

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASKET_DIR = join(process.cwd(), 'data', 'basket');

if (!existsSync(BASKET_DIR)) {
  mkdirSync(BASKET_DIR, { recursive: true });
}

async function fetchGlobalPrice() {
  console.log('[GlobalPrice] Загрузка цен на сырьё...');

  try {
    // Бесплатный API для цен на сырьё (без ключа)
    const url = 'https://api.globalprice.info/v1/commodities';
    
    const response = await fetch(url);
    if (!response.ok) {
      console.log('[GlobalPrice] ⚠️ API недоступен, используем демо-данные');
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    const basketData = {
      source: 'GlobalPrice',
      lastUpdated: new Date().toISOString(),
      commodities: data || [],
      note: 'Данные загружены через GlobalPrice API (без ключа)'
    };

    const filePath = join(BASKET_DIR, 'global-price-latest.json');
    writeFileSync(filePath, JSON.stringify(basketData, null, 2));
    console.log(`[GlobalPrice] ✅ Данные сохранены в ${filePath}`);

  } catch (error) {
    console.error('[GlobalPrice] ❌ Ошибка:', error.message);
    const fallbackData = {
      source: 'GlobalPrice (DEMO)',
      lastUpdated: new Date().toISOString(),
      commodities: [
        { name: 'Gold', price: 1920, unit: 'USD/oz', change: '+1.2%' },
        { name: 'Silver', price: 23.5, unit: 'USD/oz', change: '+0.8%' },
        { name: 'Crude Oil (WTI)', price: 78.5, unit: 'USD/bbl', change: '+2.1%' },
        { name: 'Brent Oil', price: 82.3, unit: 'USD/bbl', change: '+1.9%' },
        { name: 'Natural Gas', price: 3.2, unit: 'USD/MMBtu', change: '-0.5%' },
        { name: 'Copper', price: 4.2, unit: 'USD/lb', change: '+0.3%' },
        { name: 'Wheat', price: 6.8, unit: 'USD/bu', change: '-1.2%' },
        { name: 'Corn', price: 5.5, unit: 'USD/bu', change: '-0.8%' }
      ],
      note: 'Демо-данные (GlobalPrice API недоступен)'
    };
    writeFileSync(join(BASKET_DIR, 'global-price-latest.json'), JSON.stringify(fallbackData, null, 2));
    console.log('[GlobalPrice] ✅ Сохранены демо-данные');
  }
}

fetchGlobalPrice();
