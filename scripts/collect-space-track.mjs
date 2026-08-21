#!/usr/bin/env node

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASKET_DIR = join(process.cwd(), 'data', 'basket');

if (!existsSync(BASKET_DIR)) {
  mkdirSync(BASKET_DIR, { recursive: true });
}

async function fetchSpaceTrack() {
  console.log('[SpaceTrack] Загрузка данных о космических объектах...');

  try {
    // Публичный API для космического мусора (без ключа)
    const url = 'https://api.space-track.org/basicspacetrack/query/class/decay/format/json/limit/100';
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    const basketData = {
      source: 'SpaceTrack',
      lastUpdated: new Date().toISOString(),
      totalObjects: data.length,
      objects: data.slice(0, 50).map(o => ({
        name: o.OBJECT_NAME || 'Unknown',
        id: o.OBJECT_ID || 'N/A',
        decayDate: o.DECAY_DATE || 'N/A',
        country: o.COUNTRY_CODE || 'Unknown'
      })),
      note: 'Данные о космическом мусоре и сгоревших объектах'
    };

    const filePath = join(BASKET_DIR, 'space-track-latest.json');
    writeFileSync(filePath, JSON.stringify(basketData, null, 2));
    console.log(`[SpaceTrack] ✅ Данные сохранены в ${filePath}`);
    console.log(`[SpaceTrack] Всего объектов: ${basketData.totalObjects}`);

  } catch (error) {
    console.error('[SpaceTrack] ❌ Ошибка:', error.message);
    // Сохраняем демо-данные
    const fallbackData = {
      source: 'SpaceTrack',
      lastUpdated: new Date().toISOString(),
      totalObjects: 5,
      objects: [
        { name: 'Object A', id: '2024-001A', country: 'USA' },
        { name: 'Object B', id: '2024-002B', country: 'RUS' },
        { name: 'Object C', id: '2024-003C', country: 'CHN' },
        { name: 'Object D', id: '2024-004D', country: 'EU' },
        { name: 'Object E', id: '2024-005E', country: 'IND' },
      ],
      note: 'Демо-данные (SpaceTrack API требует регистрации)'
    };
    writeFileSync(join(BASKET_DIR, 'space-track-latest.json'), JSON.stringify(fallbackData, null, 2));
    console.log('[SpaceTrack] ✅ Сохранены демо-данные');
  }
}

fetchSpaceTrack();
