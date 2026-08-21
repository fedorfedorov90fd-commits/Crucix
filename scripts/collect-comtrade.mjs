#!/usr/bin/env node

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASKET_DIR = join(process.cwd(), 'data', 'basket');

if (!existsSync(BASKET_DIR)) {
  mkdirSync(BASKET_DIR, { recursive: true });
}

async function fetchComtrade() {
  console.log('[Comtrade] Загрузка торговых данных...');

  try {
    // Бесплатный API Comtrade (без ключа)
    const url = 'https://comtradeapi.un.org/api/v1/GetData?type=C&freq=A&px=HS&ps=2023&p=0&rg=2&cc=AG2&fmt=json';
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    // Проверяем структуру ответа
    const records = data?.data || [];
    
    const basketData = {
      source: 'UN Comtrade',
      lastUpdated: new Date().toISOString(),
      totalRecords: records.length,
      trades: records.slice(0, 50).map(t => ({
        year: t.period,
        reporter: t.reporterDesc || 'Unknown',
        partner: t.partnerDesc || 'Unknown',
        tradeValue: t.tradeValue || 0,
        commodity: t.cmdDesc || 'Unknown'
      })),
      note: 'Данные загружены через UN Comtrade API (без ключа)'
    };

    const filePath = join(BASKET_DIR, 'comtrade-latest.json');
    writeFileSync(filePath, JSON.stringify(basketData, null, 2));
    console.log(`[Comtrade] ✅ Данные сохранены в ${filePath}`);
    console.log(`[Comtrade] Всего записей: ${basketData.totalRecords}`);

  } catch (error) {
    console.error('[Comtrade] ❌ Ошибка:', error.message);
    const fallbackData = {
      source: 'UN Comtrade (DEMO)',
      lastUpdated: new Date().toISOString(),
      totalRecords: 10,
      trades: [
        { year: 2023, reporter: 'USA', partner: 'China', tradeValue: 536000000000, commodity: 'All commodities' },
        { year: 2023, reporter: 'Germany', partner: 'France', tradeValue: 180000000000, commodity: 'All commodities' },
        { year: 2023, reporter: 'Russia', partner: 'India', tradeValue: 35000000000, commodity: 'Oil' },
        { year: 2023, reporter: 'China', partner: 'USA', tradeValue: 409000000000, commodity: 'All commodities' },
        { year: 2023, reporter: 'UK', partner: 'EU', tradeValue: 320000000000, commodity: 'All commodities' },
        { year: 2023, reporter: 'Japan', partner: 'China', tradeValue: 200000000000, commodity: 'All commodities' },
        { year: 2023, reporter: 'South Korea', partner: 'China', tradeValue: 170000000000, commodity: 'All commodities' },
        { year: 2023, reporter: 'Netherlands', partner: 'Germany', tradeValue: 120000000000, commodity: 'All commodities' },
        { year: 2023, reporter: 'Italy', partner: 'France', tradeValue: 90000000000, commodity: 'All commodities' },
        { year: 2023, reporter: 'Canada', partner: 'USA', tradeValue: 400000000000, commodity: 'All commodities' }
      ],
      note: 'Демо-данные (Comtrade API недоступен)'
    };
    writeFileSync(join(BASKET_DIR, 'comtrade-latest.json'), JSON.stringify(fallbackData, null, 2));
    console.log('[Comtrade] ✅ Сохранены демо-данные');
  }
}

fetchComtrade();
