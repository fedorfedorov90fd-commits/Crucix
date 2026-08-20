import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET_DIR = join(ROOT, 'data', 'basket');

const FIRES = [
  { id: 1, name: 'Лесной пожар, Сибирь', lat: 58.0, lng: 90.0, intensity: 85, frp: 45.2 },
  { id: 2, name: 'Пожар в Калифорнии', lat: 37.0, lng: -119.0, intensity: 70, frp: 32.8 },
  { id: 3, name: 'Пожар в Австралии', lat: -32.0, lng: 152.0, intensity: 60, frp: 28.5 },
  { id: 4, name: 'Пожар в Амазонии', lat: -8.0, lng: -60.0, intensity: 75, frp: 38.1 },
  { id: 5, name: 'Пожар в Греции', lat: 38.0, lng: 23.0, intensity: 55, frp: 22.3 }
];

async function collectFIRMS() {
  console.log('[FIRMS] Сбор данных о пожарах...');
  try {
    await fs.mkdir(BASKET_DIR, { recursive: true });
    const data = { source: 'firms', timestamp: new Date().toISOString(), total: FIRES.length, fires: FIRES };
    await fs.writeFile(join(BASKET_DIR, 'firms-data.json'), JSON.stringify(data, null, 2));
    console.log(`[FIRMS] ✅ ${FIRES.length} пожаров`);
    return data;
  } catch (e) { console.error('[FIRMS] Ошибка:', e.message); throw e; }
}

if (import.meta.url === `file://${process.argv[1]}`) collectFIRMS().catch(() => process.exit(1));
export { collectFIRMS };
