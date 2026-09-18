#!/usr/bin/env node
// collect-ecb.mjs — данные ЕЦБ (без ключа)
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET = join(__dirname, '..', '..', 'data', 'basket');
async function main() {
  // Курсы валют ЕЦБ
  const r = await fetch('https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?lastNObservations=10&format=jsondata');
  const d = await r.json();
  const obs = d.dataSets?.[0]?.series?.['0:0:0:0:0']?.observations || {};
  const values = Object.entries(obs).map(([k, v]) => ({ period: k, value: v[0] }));
  await fs.mkdir(BASKET, { recursive: true });
  await fs.writeFile(join(BASKET, 'ecb-usd-eur.json'), JSON.stringify({ source: 'ECB', updated: new Date().toISOString(), pairs: 'USD/EUR', values }, null, 2));
  console.log(`[ECB] USD/EUR: ${values.length} точек`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
