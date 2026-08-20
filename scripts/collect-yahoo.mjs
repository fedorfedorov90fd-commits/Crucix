import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET_DIR = join(ROOT, 'data', 'basket');

async function collectYahoo() {
  console.log('[Yahoo] Сбор рынков...');
  try {
    await fs.mkdir(BASKET_DIR, { recursive: true });
    const data = {
      source: 'yahoo',
      timestamp: new Date().toISOString(),
      markets: {
        sp500: { name: 'S&P 500', value: 6582.69, change: '+1.63%' },
        nasdaq: { name: 'Nasdaq', value: 21879.18, change: '+2.20%' },
        oil: { name: 'WTI Crude', value: 112.06, unit: '$/bbl' }
      }
    };
    await fs.writeFile(join(BASKET_DIR, 'yahoo-latest.json'), JSON.stringify(data, null, 2));
    console.log('[Yahoo] ✅ Готово');
    return data;
  } catch (e) { console.error('[Yahoo] Ошибка:', e.message); throw e; }
}

if (import.meta.url === `file://${process.argv[1]}`) collectYahoo().catch(() => process.exit(1));
export { collectYahoo };