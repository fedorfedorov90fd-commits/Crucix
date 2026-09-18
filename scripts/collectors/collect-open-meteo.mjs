#!/usr/bin/env node
// collect-open-meteo.mjs — погода без ключа (open-meteo.com)
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET = join(__dirname, '..', '..', 'data', 'basket');
const CITIES = [
  { name: 'Kyiv', lat: 50.45, lng: 30.52, code: 'UKR' },
  { name: 'Moscow', lat: 55.75, lng: 37.62, code: 'RUS' },
  { name: 'Beijing', lat: 39.90, lng: 116.40, code: 'CHN' },
  { name: 'Washington', lat: 38.90, lng: -77.03, code: 'USA' },
  { name: 'London', lat: 51.50, lng: -0.12, code: 'GBR' },
  { name: 'Tokyo', lat: 35.68, lng: 139.69, code: 'JPN' },
  { name: 'Tehran', lat: 35.69, lng: 51.39, code: 'IRN' },
  { name: 'Jerusalem', lat: 31.77, lng: 35.21, code: 'ISR' },
  { name: 'Taipei', lat: 25.03, lng: 121.57, code: 'TWN' },
  { name: 'New Delhi', lat: 28.61, lng: 77.21, code: 'IND' },
];
async function main() {
  const out = [];
  for (const c of CITIES) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}&current=temperature_2m,wind_speed_10m,precipitation&timezone=UTC`;
      const r = await fetch(url);
      const d = await r.json();
      out.push({
        city: c.name, countryCode: c.code, lat: c.lat, lng: c.lng,
        temperature: d.current?.temperature_2m,
        windSpeed: d.current?.wind_speed_10m,
        precipitation: d.current?.precipitation,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      out.push({ city: c.name, error: e.message });
    }
  }
  await fs.mkdir(BASKET, { recursive: true });
  await fs.writeFile(join(BASKET, 'open-meteo.json'), JSON.stringify({ source: 'OpenMeteo', updated: new Date().toISOString(), cities: out }, null, 2));
  console.log(`[OpenMeteo] ${out.length} городов`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
