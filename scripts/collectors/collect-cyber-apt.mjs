#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', 'data', 'basket', 'cyber-apt.json');

const APT_DATA = [
  { name: "APT28 (Fancy Bear)", country: "Россия", lat: 55.7558, lng: 37.6173, type: "кибершпионаж", active: true },
  { name: "APT29 (Cozy Bear)", country: "Россия", lat: 55.7558, lng: 37.6173, type: "кибершпионаж", active: true },
  { name: "Lazarus Group", country: "Северная Корея", lat: 39.019, lng: 125.755, type: "хакерская", active: true },
  { name: "Sandworm", country: "Россия", lat: 55.7558, lng: 37.6173, type: "деструктивная", active: true },
  { name: "Turla", country: "Россия", lat: 55.7558, lng: 37.6173, type: "кибершпионаж", active: true },
  { name: "Equation Group", country: "США", lat: 38.9072, lng: -77.0369, type: "кибершпионаж", active: true },
  { name: "DarkSide", country: "Россия", lat: 55.7558, lng: 37.6173, type: "вымогатели", active: true },
  { name: "REvil", country: "Россия", lat: 55.7558, lng: 37.6173, type: "вымогатели", active: false },
];
async function collectCyberAPT() {
  const now = new Date().toISOString();
  const data = APT_DATA.map(a => ({ ...a, collected: now }));
  await fs.mkdir(join(__dirname, '..', 'data', 'basket'), { recursive: true });
  await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
  console.log(`[CYBER-APT] ✅ ${data.length} группировок`);
  return data;
}
if (import.meta.url === `file://${process.argv[1]}`) { collectCyberAPT().catch(console.error); }
export { collectCyberAPT };
