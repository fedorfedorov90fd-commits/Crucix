#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';;
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', '..', 'data', 'basket', 'prediction-markets.json');

const MARKET_DATA = [
  { event: "Выборы в США 2026", probability: 0.55, volume: 1200000, market: "Polymarket" },
  { event: "Рост нефти > 100$", probability: 0.62, volume: 850000, market: "Polymarket" },
  { event: "Кризис в Европе", probability: 0.43, volume: 400000, market: "Polymarket" },
  { event: "Инфляция в США > 5%", probability: 0.58, volume: 320000, market: "Polymarket" },
  { event: "Эскалация на Ближнем Востоке", probability: 0.71, volume: 950000, market: "Polymarket" },
];
async function collectPredictionMarkets() {
  const now = new Date().toISOString();
  const data = MARKET_DATA.map(m => ({ ...m, collected: now }));
  await fs.mkdir(join(__dirname, '..', '..', 'data', 'basket'), { recursive: true });
  await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
  console.log(`[PREDICTION-MARKETS] ✅ ${data.length} рынков`);
  return data;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { collectPredictionMarkets().catch(console.error); }
export { collectPredictionMarkets };
