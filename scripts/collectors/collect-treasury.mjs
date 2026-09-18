#!/usr/bin/env node
// collect-treasury.mjs — данные минфина США (без ключа)
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET = join(__dirname, '..', '..', 'data', 'basket');
async function main() {
  // Национальный долг США
  const r = await fetch('https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=10');
  const d = await r.json();
  const records = (d.data || []).map(x => ({ date: x.record_date, totalDebt: parseFloat(x.tot_pub_debt_out_amt) }));
  await fs.mkdir(BASKET, { recursive: true });
  await fs.writeFile(join(BASKET, 'treasury-debt.json'), JSON.stringify({ source: 'US Treasury', updated: new Date().toISOString(), latest: records[0], history: records }, null, 2));
  console.log(`[Treasury] последняя запись: ${records[0]?.date}, долг: $${(records[0]?.totalDebt / 1e12).toFixed(2)}T`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
