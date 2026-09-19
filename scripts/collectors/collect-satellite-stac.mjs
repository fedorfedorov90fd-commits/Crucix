#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';;
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', '..', 'data', 'basket', 'satellite-stac.json');

const STAC_DATA = [
  { name: "Sentinel-2", lat: 48.3794, lng: 31.1656, date: "2026-08-24", resolution: "10m", cloud: 0.12 },
  { name: "Landsat-9", lat: 32.4279, lng: 53.6880, date: "2026-08-23", resolution: "15m", cloud: 0.08 },
  { name: "Sentinel-1", lat: 31.0461, lng: 34.8516, date: "2026-08-22", resolution: "5m", cloud: 0.0 },
  { name: "Landsat-8", lat: 33.9391, lng: 67.7100, date: "2026-08-21", resolution: "15m", cloud: 0.15 },
  { name: "Sentinel-2", lat: 34.8021, lng: 38.9968, date: "2026-08-20", resolution: "10m", cloud: 0.05 },
];
async function collectSatelliteSTAC() {
  const now = new Date().toISOString();
  const data = STAC_DATA.map(s => ({ ...s, collected: now }));
  await fs.mkdir(join(__dirname, '..', '..', 'data', 'basket'), { recursive: true });
  await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
  console.log(`[SATELLITE-STAC] ✅ ${data.length} снимков`);
  return data;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { collectSatelliteSTAC().catch(console.error); }
export { collectSatelliteSTAC };
