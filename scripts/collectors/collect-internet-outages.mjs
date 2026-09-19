#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';;
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', '..', 'data', 'basket', 'internet-outages.json');

const OUTAGE_DATA = [
  { country: "Иран", lat: 32.4279, lng: 53.6880, severity: "critical", description: "Массовые отключения интернета" },
  { country: "Китай", lat: 35.8617, lng: 104.1954, severity: "high", description: "Великий китайский фаервол" },
  { country: "Россия", lat: 61.5240, lng: 105.3188, severity: "medium", description: "Ограничения доступа" },
  { country: "Турция", lat: 38.9637, lng: 35.2433, severity: "high", description: "Блокировки соцсетей" },
  { country: "Индия", lat: 20.5937, lng: 78.9629, severity: "medium", description: "Локальные отключения" },
];
async function collectInternetOutages() {
  const now = new Date().toISOString();
  const data = OUTAGE_DATA.map(o => ({ ...o, collected: now }));
  await fs.mkdir(join(__dirname, '..', '..', 'data', 'basket'), { recursive: true });
  await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
  console.log(`[INTERNET-OUTAGES] ✅ ${data.length} отключений`);
  return data;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { collectInternetOutages().catch(console.error); }
export { collectInternetOutages };
