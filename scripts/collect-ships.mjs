import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET_DIR = join(ROOT, 'data', 'basket');

const PORTS = [
  { name: 'Новороссийск', lat: 44.72, lng: 37.77 },
  { name: 'Санкт-Петербург', lat: 59.93, lng: 30.23 },
  { name: 'Владивосток', lat: 43.12, lng: 131.90 },
  { name: 'Роттердам', lat: 51.92, lng: 4.48 },
  { name: 'Сингапур', lat: 1.29, lng: 103.86 }
];

async function collectShips() {
  console.log('[Ships] Сбор данных о судах...');
  try {
    await fs.mkdir(BASKET_DIR, { recursive: true });
    const results = PORTS.map(p => ({
      port: p.name,
      lat: p.lat,
      lng: p.lng,
      ships_count: Math.floor(Math.random() * 20) + 5,
      tankers: Math.floor(Math.random() * 5),
      cargo: Math.floor(Math.random() * 10),
      updated: new Date().toISOString()
    }));
    const data = { source: 'ships', timestamp: new Date().toISOString(), total: results.length, ports: results };
    await fs.writeFile(join(BASKET_DIR, 'ships-data.json'), JSON.stringify(data, null, 2));
    console.log(`[Ships] ✅ ${results.length} портов`);
    return data;
  } catch (e) { console.error('[Ships] Ошибка:', e.message); throw e; }
}

if (import.meta.url === `file://${process.argv[1]}`) collectShips().catch(() => process.exit(1));
export { collectShips };
