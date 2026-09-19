#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';;
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', '..', 'data', 'basket', 'risk-heatmap.json');

const RISK_DATA = [
  { lat: 48.3794, lng: 31.1656, intensity: 0.9, region: "Украина" },
  { lat: 32.4279, lng: 53.6880, intensity: 0.85, region: "Иран" },
  { lat: 31.0461, lng: 34.8516, intensity: 0.8, region: "Израиль" },
  { lat: 33.9391, lng: 67.7100, intensity: 0.92, region: "Афганистан" },
  { lat: 34.8021, lng: 38.9968, intensity: 0.88, region: "Сирия" },
  { lat: 15.5527, lng: 48.5164, intensity: 0.86, region: "Йемен" },
  { lat: 5.1521, lng: 46.1996, intensity: 0.9, region: "Сомали" },
  { lat: 12.8628, lng: 30.2176, intensity: 0.84, region: "Судан" },
  { lat: 9.1450, lng: 40.4897, intensity: 0.8, region: "Эфиопия" },
  { lat: 61.5240, lng: 105.3188, intensity: 0.72, region: "Россия" },
  { lat: 30.3753, lng: 69.3451, intensity: 0.68, region: "Пакистан" },
];
async function collectRiskHeatmap() {
  const now = new Date().toISOString();
  const data = RISK_DATA.map(r => ({ ...r, collected: now }));
  await fs.mkdir(join(__dirname, '..', '..', 'data', 'basket'), { recursive: true });
  await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
  console.log(`[RISK-HEATMAP] ✅ ${data.length} точек риска`);
  return data;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { collectRiskHeatmap().catch(console.error); }
export { collectRiskHeatmap };
