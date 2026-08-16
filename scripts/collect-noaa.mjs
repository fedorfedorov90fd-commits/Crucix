#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET_FILE = join(ROOT, 'data', 'basket', 'noaa.json');

const DEMO_DATA = {
  stations: [
    { id: 'USW00013739', name: 'Нью-Йорк', lat: 40.7, lng: -74.0, temp: 22.5, condition: 'Облачно', wind: 5.2 },
    { id: 'USW00013994', name: 'Лос-Анджелес', lat: 34.0, lng: -118.2, temp: 28.3, condition: 'Солнечно', wind: 3.1 },
    { id: 'USW00014826', name: 'Чикаго', lat: 41.9, lng: -87.6, temp: 18.0, condition: 'Дождь', wind: 7.8 },
    { id: 'USW00012960', name: 'Хьюстон', lat: 29.9, lng: -95.4, temp: 31.2, condition: 'Солнечно', wind: 4.5 },
    { id: 'USW00023174', name: 'Лондон', lat: 51.5, lng: -0.1, temp: 16.5, condition: 'Облачно', wind: 6.1 },
    { id: 'USW00010490', name: 'Москва', lat: 55.7, lng: 37.6, temp: 19.8, condition: 'Переменная облачность', wind: 3.8 },
    { id: 'USW00010853', name: 'Пекин', lat: 39.9, lng: 116.4, temp: 25.0, condition: 'Солнечно', wind: 2.5 },
    { id: 'USW00094956', name: 'Сидней', lat: -33.9, lng: 151.2, temp: 14.2, condition: 'Дождь', wind: 8.0 },
    { id: 'USW00003712', name: 'Кейптаун', lat: -33.9, lng: 18.4, temp: 12.0, condition: 'Ветрено', wind: 10.2 },
    { id: 'USW00000000', name: 'Токио', lat: 35.7, lng: 139.7, temp: 26.8, condition: 'Солнечно', wind: 3.3 }
  ],
  summary: {
    total: 10,
    avgTemp: 21.4,
    maxTemp: 31.2,
    minTemp: 12.0,
    conditions: { 'Солнечно': 4, 'Облачно': 2, 'Дождь': 2, 'Переменная облачность': 1, 'Ветрено': 1 }
  }
};

async function collect() {
  try {
    const entry = {
      id: `noaa-${new Date().toISOString().slice(0, 10)}`,
      type: 'noaa',
      date: new Date().toISOString(),
      data: DEMO_DATA,
      source: 'demo'
    };
    await fs.mkdir(join(ROOT, 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_FILE, JSON.stringify(entry, null, 2));
    console.log('✅ NOAA сохранён в корзину');
  } catch (e) {
    console.error('❌ Ошибка сбора NOAA:', e.message);
  }
}
collect();
