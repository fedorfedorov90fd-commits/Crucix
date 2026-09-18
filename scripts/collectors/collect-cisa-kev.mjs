#!/usr/bin/env node
// collect-cisa-kev.mjs — известные эксплуатируемые уязвимости (без ключа)
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET = join(__dirname, '..', '..', 'data', 'basket');
async function main() {
  const r = await fetch('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
  const d = await r.json();
  const recent = (d.vulnerabilities || []).slice(-50).reverse();
  await fs.mkdir(BASKET, { recursive: true });
  await fs.writeFile(join(BASKET, 'cisa-kev.json'), JSON.stringify({ source: 'CISA KEV', updated: new Date().toISOString(), total: d.count, recent }, null, 2));
  console.log(`[CISA] ${d.count} уязвимостей, последние ${recent.length} сохранены`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
