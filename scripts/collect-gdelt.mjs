#!/usr/bin/env node

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASKET_DIR = join(process.cwd(), 'data', 'basket');

if (!existsSync(BASKET_DIR)) {
  mkdirSync(BASKET_DIR, { recursive: true });
}

async function fetchGDELT() {
  console.log('[GDELT] Загрузка глобальных событий...');

  try {
    // Публичный API GDELT (без ключа)
    const url = 'https://api.gdeltproject.org/api/v2/events/events?format=json&query=(%22war%22%20OR%20%22conflict%22%20OR%20%22protest%22)&timespan=7d&mode=artlist&maxrows=100';

    console.log(`[GDELT] Запрос к API...`);

    // Используем fetch (Node.js 18+)
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Форматируем для корзины
    const basketData = {
      source: 'GDELT',
      lastUpdated: new Date().toISOString(),
      totalEvents: data.events ? data.events.length : 0,
      events: data.events || [],
      note: 'Данные загружены через GDELT API'
    };

    const filePath = join(BASKET_DIR, 'gdelt-latest.json');
    writeFileSync(filePath, JSON.stringify(basketData, null, 2));
    console.log(`[GDELT] ✅ Данные сохранены в ${filePath}`);
    console.log(`[GDELT] Всего событий: ${basketData.totalEvents}`);

  } catch (error) {
    console.error('[GDELT] ❌ Ошибка:', error.message);
    // Сохраняем демо-данные, если API не отвечает
    const fallbackData = {
      source: 'GDELT',
      lastUpdated: new Date().toISOString(),
      totalEvents: 5,
      events: [
        { title: 'Военный конфликт на Ближнем Востоке', date: new Date().toISOString(), region: 'Middle East' },
        { title: 'Протесты в Европе', date: new Date().toISOString(), region: 'Europe' },
        { title: 'Экономический кризис в Азии', date: new Date().toISOString(), region: 'Asia' },
      ],
      note: 'Данные загружены из демо-режима (API недоступен)'
    };
    writeFileSync(join(BASKET_DIR, 'gdelt-latest.json'), JSON.stringify(fallbackData, null, 2));
    console.log('[GDELT] ✅ Сохранены демо-данные');
  }
}

fetchGDELT();
