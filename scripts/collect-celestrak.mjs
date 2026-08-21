#!/usr/bin/env node

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASKET_DIR = join(process.cwd(), 'data', 'basket');

if (!existsSync(BASKET_DIR)) {
  mkdirSync(BASKET_DIR, { recursive: true });
}

async function fetchCelestrak() {
  console.log('[Celestrak] Загрузка данных о спутниках...');

  try {
    // Основные группировки спутников (без ключа)
    const groups = [
      'stations',      // МКС и другие станции
      'visual',        // Яркие спутники
      'iridium',       // Iridium
      'starlink',      // Starlink
      'oneweb',        // OneWeb
      'gps-ops',       // GPS
      'glo-ops',       // ГЛОНАСС
      'galileo',       // Galileo
      'beidou',        // BeiDou
      'intelsat',      // Intelsat
      'active',        // Активные спутники
    ];

    const results = {};

    for (const group of groups) {
      const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=json`;
      console.log(`[Celestrak] Загрузка группы: ${group}...`);

      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.log(`[Celestrak] ⚠️ Группа ${group} недоступна (${response.status})`);
          continue;
        }

        const data = await response.json();
        if (data && data.length > 0) {
          results[group] = data.slice(0, 50); // Ограничиваем до 50 для экономии места
          console.log(`[Celestrak] ✅ Группа ${group}: ${data.length} спутников`);
        }
      } catch (e) {
        console.log(`[Celestrak] ⚠️ Ошибка загрузки группы ${group}: ${e.message}`);
      }
    }

    // Формируем данные для корзины
    const basketData = {
      source: 'Celestrak',
      lastUpdated: new Date().toISOString(),
      groups: Object.keys(results),
      totalSatellites: Object.values(results).reduce((sum, arr) => sum + arr.length, 0),
      satellites: results,
      note: 'Данные загружены через Celestrak API (без ключа)'
    };

    const filePath = join(BASKET_DIR, 'celestrak-latest.json');
    writeFileSync(filePath, JSON.stringify(basketData, null, 2));
    console.log(`[Celestrak] ✅ Данные сохранены в ${filePath}`);
    console.log(`[Celestrak] Всего спутников: ${basketData.totalSatellites}`);
    console.log(`[Celestrak] Группы: ${basketData.groups.join(', ')}`);

  } catch (error) {
    console.error('[Celestrak] ❌ Ошибка:', error.message);
    // Сохраняем демо-данные
    const fallbackData = {
      source: 'Celestrak',
      lastUpdated: new Date().toISOString(),
      groups: ['stations', 'starlink', 'gps-ops'],
      totalSatellites: 3,
      satellites: {
        stations: [{ name: 'ISS', id: '25544', group: 'stations' }],
        starlink: [{ name: 'Starlink-1000', id: '50000', group: 'starlink' }],
        'gps-ops': [{ name: 'GPS IIR-1', id: '24876', group: 'gps-ops' }],
      },
      note: 'Демо-данные (Celestrak API недоступен)'
    };
    writeFileSync(join(BASKET_DIR, 'celestrak-latest.json'), JSON.stringify(fallbackData, null, 2));
    console.log('[Celestrak] ✅ Сохранены демо-данные');
  }
}

fetchCelestrak();
