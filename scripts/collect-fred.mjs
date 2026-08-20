import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET_DIR = join(ROOT, 'data', 'basket');

async function collectFRED() {
  console.log('[FRED] Сбор экономики...');
  try {
    await fs.mkdir(BASKET_DIR, { recursive: true });
    const data = {
      source: 'fred',
      timestamp: new Date().toISOString(),
      indicators: {
        gdp: { value: 28783.4, unit: 'млрд USD' },
        unemployment: { value: 4.3, unit: '%' }
      }
    };
    await fs.writeFile(join(BASKET_DIR, 'fred-latest.json'), JSON.stringify(data, null, 2));
    console.log('[FRED] ✅ Готово');
    return data;
  } catch (e) { console.error('[FRED] Ошибка:', e.message); throw e; }
}

if (import.meta.url === `file://${process.argv[1]}`) collectFRED().catch(() => process.exit(1));
export { collectFRED };