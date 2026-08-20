import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET_DIR = join(ROOT, 'data', 'basket');

const CITIES = [
  { name: 'Москва', lat: 55.75, lng: 37.62 },
  { name: 'Санкт-Петербург', lat: 59.93, lng: 30.31 },
  { name: 'Лондон', lat: 51.51, lng: -0.13 },
  { name: 'Париж', lat: 48.86, lng: 2.35 },
  { name: 'Берлин', lat: 52.52, lng: 13.40 },
  { name: 'Нью-Йорк', lat: 40.71, lng: -74.01 },
  { name: 'Токио', lat: 35.68, lng: 139.69 },
  { name: 'Пекин', lat: 39.90, lng: 116.40 },
  { name: 'Киев', lat: 50.45, lng: 30.52 },
  { name: 'Минск', lat: 53.90, lng: 27.56 }
];

async function collectOpenMeteo() {
  console.log('[Open-Meteo] Сбор погоды...');
  try {
    await fs.mkdir(BASKET_DIR, { recursive: true });
    const results = [];
    for (const city of CITIES) {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lng}&current_weather=true&timezone=auto`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          results.push({
            city: city.name,
            temperature: data.current_weather?.temperature || '—',
            wind_speed: data.current_weather?.windspeed || '—',
            time: data.current_weather?.time || new Date().toISOString()
          });
        }
        await new Promise(r => setTimeout(r, 100));
      } catch (e) {}
    }
    const data = { source: 'open-meteo', timestamp: new Date().toISOString(), total: results.length, cities: results };
    await fs.writeFile(join(BASKET_DIR, 'openmeteo-latest.json'), JSON.stringify(data, null, 2));
    console.log(`[Open-Meteo] ✅ ${results.length} городов`);
    return data;
  } catch (e) { console.error('[Open-Meteo] Ошибка:', e.message); throw e; }
}

if (import.meta.url === `file://${process.argv[1]}`) collectOpenMeteo().catch(() => process.exit(1));
export { collectOpenMeteo };