#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';;
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', '..', 'data', 'basket', 'pipelines.json');

const PIPELINE_DATA = [
  { name: "Северный поток", lat1: 60.0, lng1: 28.0, lat2: 54.0, lng2: 13.0, type: "газ", countries: "Россия-Германия" },
  { name: "Турецкий поток", lat1: 42.0, lng1: 37.0, lat2: 41.0, lng2: 28.0, type: "газ", countries: "Россия-Турция" },
  { name: "Дружба", lat1: 55.0, lng1: 37.0, lat2: 52.0, lng2: 21.0, type: "нефть", countries: "Россия-Европа" },
  { name: "Трансальпийский", lat1: 47.0, lng1: 11.0, lat2: 45.0, lng2: 8.0, type: "нефть", countries: "Австрия-Италия" },
  { name: "Ямал-Европа", lat1: 66.0, lng1: 70.0, lat2: 52.0, lng2: 16.0, type: "газ", countries: "Россия-Польша" },
  { name: "Китай-Мьянма", lat1: 22.0, lng1: 96.0, lat2: 28.0, lng2: 98.0, type: "нефть", countries: "Мьянма-Китай" },
];
async function collectPipelines() {
  const now = new Date().toISOString();
  const data = PIPELINE_DATA.map(p => ({ ...p, collected: now }));
  await fs.mkdir(join(__dirname, '..', '..', 'data', 'basket'), { recursive: true });
  await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
  console.log(`[PIPELINES] ✅ ${data.length} трубопроводов`);
  return data;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { collectPipelines().catch(console.error); }
export { collectPipelines };
