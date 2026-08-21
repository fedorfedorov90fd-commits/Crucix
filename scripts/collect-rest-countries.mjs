#!/usr/bin/env node

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASKET_DIR = join(process.cwd(), 'data', 'basket');

if (!existsSync(BASKET_DIR)) {
  mkdirSync(BASKET_DIR, { recursive: true });
}

async function fetchRestCountries() {
  console.log('[RestCountries] Загрузка данных о странах...');

  try {
    // Используем другой endpoint, который точно возвращает массив
    const url = 'https://restcountries.com/v3.1/all';
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    
    // Проверяем, что data — это массив
    if (!Array.isArray(data)) {
      console.log('[RestCountries] ⚠️ API вернул не массив, пробуем другой endpoint...');
      // Пробуем альтернативный endpoint
      const altUrl = 'https://restcountries.com/v2/all?fields=name,capital,region,subregion,population,area,currencies,languages,borders,flag';
      const altResponse = await fetch(altUrl);
      if (!altResponse.ok) throw new Error(`HTTP ${altResponse.status}`);
      const altData = await altResponse.json();
      if (!Array.isArray(altData)) throw new Error('Альтернативный API тоже вернул не массив');
      
      // Форматируем данные из v2
      const basketData = {
        source: 'RestCountries (v2)',
        lastUpdated: new Date().toISOString(),
        totalCountries: altData.length,
        countries: altData.slice(0, 200).map(c => ({
          name: c.name || 'Unknown',
          capital: c.capital || 'N/A',
          region: c.region || 'Unknown',
          subregion: c.subregion || 'Unknown',
          population: c.population || 0,
          area: c.area || 0,
          currencies: c.currencies ? Object.values(c.currencies).map(cu => cu.name || '') : [],
          languages: c.languages || [],
          borders: c.borders || [],
          flag: c.flag || '',
          timezones: c.timezones || [],
          continent: c.region || 'Unknown'
        })),
        note: 'Данные загружены через RestCountries API v2 (без ключа)'
      };

      const filePath = join(BASKET_DIR, 'rest-countries-latest.json');
      writeFileSync(filePath, JSON.stringify(basketData, null, 2));
      console.log(`[RestCountries] ✅ Данные сохранены в ${filePath}`);
      console.log(`[RestCountries] Всего стран: ${basketData.totalCountries}`);
      return;
    }

    // Форматируем данные из v3.1
    const basketData = {
      source: 'RestCountries (v3.1)',
      lastUpdated: new Date().toISOString(),
      totalCountries: data.length,
      countries: data.slice(0, 200).map(c => ({
        name: c.name?.common || 'Unknown',
        official: c.name?.official || 'Unknown',
        capital: c.capital ? c.capital[0] : 'N/A',
        region: c.region || 'Unknown',
        subregion: c.subregion || 'Unknown',
        population: c.population || 0,
        area: c.area || 0,
        currencies: c.currencies ? Object.keys(c.currencies) : [],
        languages: c.languages ? Object.values(c.languages) : [],
        borders: c.borders || [],
        flag: c.flags?.png || '',
        timezones: c.timezones || [],
        continent: c.continents ? c.continents[0] : 'Unknown'
      })),
      note: 'Данные загружены через RestCountries API v3.1 (без ключа)'
    };

    const filePath = join(BASKET_DIR, 'rest-countries-latest.json');
    writeFileSync(filePath, JSON.stringify(basketData, null, 2));
    console.log(`[RestCountries] ✅ Данные сохранены в ${filePath}`);
    console.log(`[RestCountries] Всего стран: ${basketData.totalCountries}`);

  } catch (error) {
    console.error('[RestCountries] ❌ Ошибка:', error.message);
    
    // Сохраняем демо-данные
    const fallbackData = {
      source: 'RestCountries (DEMO)',
      lastUpdated: new Date().toISOString(),
      totalCountries: 10,
      countries: [
        { name: 'Russia', capital: 'Moscow', region: 'Europe', population: 144000000, flag: '🇷🇺' },
        { name: 'United States', capital: 'Washington', region: 'Americas', population: 331000000, flag: '🇺🇸' },
        { name: 'China', capital: 'Beijing', region: 'Asia', population: 1412000000, flag: '🇨🇳' },
        { name: 'Germany', capital: 'Berlin', region: 'Europe', population: 83000000, flag: '🇩🇪' },
        { name: 'India', capital: 'New Delhi', region: 'Asia', population: 1380000000, flag: '🇮🇳' },
        { name: 'United Kingdom', capital: 'London', region: 'Europe', population: 67000000, flag: '🇬🇧' },
        { name: 'France', capital: 'Paris', region: 'Europe', population: 67000000, flag: '🇫🇷' },
        { name: 'Japan', capital: 'Tokyo', region: 'Asia', population: 126000000, flag: '🇯🇵' },
        { name: 'Brazil', capital: 'Brasilia', region: 'Americas', population: 213000000, flag: '🇧🇷' },
        { name: 'Australia', capital: 'Canberra', region: 'Oceania', population: 26000000, flag: '🇦🇺' }
      ],
      note: 'Демо-данные (RestCountries API недоступен)'
    };
    writeFileSync(join(BASKET_DIR, 'rest-countries-latest.json'), JSON.stringify(fallbackData, null, 2));
    console.log('[RestCountries] ✅ Сохранены демо-данные (10 стран)');
  }
}

fetchRestCountries();
