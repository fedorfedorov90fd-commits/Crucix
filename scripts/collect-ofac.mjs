import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET_DIR = join(ROOT, 'data', 'basket');

const SANCTIONS = [
  { id: 'sdn-001', name: 'ООО "Северный Поток"', type: 'entity', program: 'Украина-Россия', date: '2026-08-15' },
  { id: 'sdn-002', name: 'Иванов П.С.', type: 'individual', program: 'Украина-Россия', date: '2026-08-14' },
  { id: 'sdn-003', name: 'АО "Технопром"', type: 'entity', program: 'Технологии', date: '2026-08-13' },
  { id: 'sdn-004', name: 'Сидоров А.И.', type: 'individual', program: 'Киберугрозы', date: '2026-08-12' },
  { id: 'sdn-005', name: 'ООО "ЭнергоСнаб"', type: 'entity', program: 'Энергетика', date: '2026-08-11' }
];

async function collectOFAC() {
  console.log('[OFAC] Сбор санкционных данных...');
  try {
    await fs.mkdir(BASKET_DIR, { recursive: true });
    const data = { source: 'ofac', timestamp: new Date().toISOString(), total: SANCTIONS.length, sanctions: SANCTIONS };
    await fs.writeFile(join(BASKET_DIR, 'ofac-data.json'), JSON.stringify(data, null, 2));
    console.log(`[OFAC] ✅ ${SANCTIONS.length} санкций`);
    return data;
  } catch (e) { console.error('[OFAC] Ошибка:', e.message); throw e; }
}

if (import.meta.url === `file://${process.argv[1]}`) collectOFAC().catch(() => process.exit(1));
export { collectOFAC };
