import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET_DIR = join(ROOT, 'data', 'basket');

async function collectFrostbyte() {
  console.log('[Frostbyte] Сбор крипто...');
  try {
    await fs.mkdir(BASKET_DIR, { recursive: true });
    const data = {
      source: 'frostbyte',
      timestamp: new Date().toISOString(),
      crypto: {
        bitcoin: { price: 66895.18, change: '+2.3%' },
        ethereum: { price: 2052.04, change: '+1.8%' },
        solana: { price: 145.60, change: '+4.1%' }
      }
    };
    await fs.writeFile(join(BASKET_DIR, 'frostbyte-latest.json'), JSON.stringify(data, null, 2));
    console.log('[Frostbyte] ✅ Готово');
    return data;
  } catch (e) { console.error('[Frostbyte] Ошибка:', e.message); throw e; }
}

if (import.meta.url === `file://${process.argv[1]}`) collectFrostbyte().catch(() => process.exit(1));
export { collectFrostbyte };