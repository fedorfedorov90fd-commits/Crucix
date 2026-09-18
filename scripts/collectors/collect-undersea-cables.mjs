#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', 'data', 'basket', 'undersea-cables.json');

const CABLE_DATA = [
  { name: "MAREA", lat1: 36.5, lng1: -76.0, lat2: 40.5, lng2: -9.0, countries: "США-Испания", length: 6600 },
  { name: "Dunant", lat1: 38.0, lng1: -75.0, lat2: 48.0, lng2: -4.0, countries: "США-Франция", length: 6400 },
  { name: "Grace Hopper", lat1: 39.0, lng1: -74.0, lat2: 49.0, lng2: -3.0, countries: "США-Великобритания", length: 6200 },
  { name: "SEA-ME-WE 3", lat1: 1.0, lng1: 103.0, lat2: 36.0, lng2: -5.0, countries: "ЮВА-Европа", length: 39000 },
  { name: "Asia America Gateway", lat1: 1.0, lng1: 103.0, lat2: 35.0, lng2: -120.0, countries: "ЮВА-США", length: 20000 },
  { name: "TAT-14", lat1: 42.0, lng1: -70.0, lat2: 48.0, lng2: -5.0, countries: "США-Европа", length: 15000 },
  { name: "Hibernia Atlantic", lat1: 44.0, lng1: -63.0, lat2: 53.0, lng2: -6.0, countries: "Канада-Ирландия", length: 5900 },
  { name: "APCN-2", lat1: 35.0, lng1: 140.0, lat2: 1.0, lng2: 103.0, countries: "Япония-ЮВА", length: 19000 },
];
async function collectUnderseaCables() {
  const now = new Date().toISOString();
  const data = CABLE_DATA.map(c => ({ ...c, collected: now }));
  await fs.mkdir(join(__dirname, '..', 'data', 'basket'), { recursive: true });
  await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
  console.log(`[UNDERSEA-CABLES] ✅ ${data.length} кабелей`);
  return data;
}
if (import.meta.url === `file://${process.argv[1]}`) { collectUnderseaCables().catch(console.error); }
export { collectUnderseaCables };
