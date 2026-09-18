#!/usr/bin/env node
// collect-frankfurter.mjs — курсы валют ЕЦБ (без ключа)
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET = join(__dirname, '..', '..', 'data', 'basket');
async function main() {
  const r = await fetch('https://api.frankfurter.app/latest?from=USD');
  const d = await r.json();
  const out = {
    source: 'Frankfurter (ECB)',
    updated: new Date().toISOString(),
    base: d.base,
    date: d.date,
    rates: d.rates,
  };
  await fs.mkdir(BASKET, { recursive: true });
  await fs.writeFile(join(BASKET, 'fx-rates.json'), JSON.stringify(out, null, 2));
  console.log(`[FX] ${Object.keys(d.rates).length} валют на ${d.date}`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
