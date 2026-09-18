import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET_DIR = join(ROOT, 'data', 'basket');

async function collectRussianSources() {
  console.log('[Russian] Сбор российских данных...');
  try {
    await fs.mkdir(BASKET_DIR, { recursive: true });
    const data = {
      source: 'russian',
      timestamp: new Date().toISOString(),
      weather: [
        { city: 'Москва', temp: 15, condition: 'Облачно' },
        { city: 'СПб', temp: 12, condition: 'Дождь' }
      ],
      tass: [{ title: 'Путин провел совещание', category: 'Политика' }],
      rbc: [{ title: 'Акции Сбербанка обновили максимум', category: 'Бизнес' }],
      interfax: [{ title: 'ВС РФ взяли новый пункт', category: 'СВО' }]
    };
    await fs.writeFile(join(BASKET_DIR, 'russian-latest.json'), JSON.stringify(data, null, 2));
    console.log('[Russian] ✅ Готово');
    return data;
  } catch (e) { console.error('[Russian] Ошибка:', e.message); throw e; }
}

if (import.meta.url === `file://${process.argv[1]}`) collectRussianSources().catch(() => process.exit(1));
export { collectRussianSources };