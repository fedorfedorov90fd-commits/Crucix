#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';;
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', '..', 'data', 'basket', 'instability-index.json');

const COUNTRIES = [
  { name: "Украина", lat: 48.3794, lng: 31.1656, index: 85 },
  { name: "Россия", lat: 61.5240, lng: 105.3188, index: 72 },
  { name: "США", lat: 37.0902, lng: -95.7129, index: 28 },
  { name: "Китай", lat: 35.8617, lng: 104.1954, index: 45 },
  { name: "Индия", lat: 20.5937, lng: 78.9629, index: 52 },
  { name: "Израиль", lat: 31.0461, lng: 34.8516, index: 78 },
  { name: "Иран", lat: 32.4279, lng: 53.6880, index: 82 },
  { name: "Турция", lat: 38.9637, lng: 35.2433, index: 55 },
  { name: "Пакистан", lat: 30.3753, lng: 69.3451, index: 68 },
  { name: "Афганистан", lat: 33.9391, lng: 67.7100, index: 92 },
  { name: "Сирия", lat: 34.8021, lng: 38.9968, index: 88 },
  { name: "Йемен", lat: 15.5527, lng: 48.5164, index: 86 },
  { name: "Сомали", lat: 5.1521, lng: 46.1996, index: 90 },
  { name: "Судан", lat: 12.8628, lng: 30.2176, index: 84 },
  { name: "Эфиопия", lat: 9.1450, lng: 40.4897, index: 80 },
];
async function collectInstabilityIndex() {
  const now = new Date().toISOString();
  const data = COUNTRIES.map(c => ({ ...c, collected: now }));
  await fs.mkdir(join(__dirname, '..', '..', 'data', 'basket'), { recursive: true });
  await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
  console.log(`[INSTABILITY-INDEX] ✅ ${data.length} стран`);
  return data;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { collectInstabilityIndex().catch(console.error); }
export { collectInstabilityIndex };
