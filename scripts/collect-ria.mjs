import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET_DIR = join(ROOT, 'data', 'basket');

const NEWS = [
  { title: 'Путин заявил о технологическом суверенитете', category: 'Политика' },
  { title: 'ЦБ сохранил ключевую ставку 18%', category: 'Экономика' },
  { title: 'ВС РФ взяли населённый пункт в ДНР', category: 'СВО' },
  { title: 'Трамп заявил о готовности к диалогу', category: 'Мир' },
  { title: 'Российские фигуристы завоевали золото', category: 'Спорт' }
];

async function collectRIA() {
  console.log('[RIA] Сбор новостей...');
  try {
    await fs.mkdir(BASKET_DIR, { recursive: true });
    const data = { source: 'ria', timestamp: new Date().toISOString(), total: NEWS.length, news: NEWS };
    await fs.writeFile(join(BASKET_DIR, 'ria-latest.json'), JSON.stringify(data, null, 2));
    console.log('[RIA] ✅ Готово');
    return data;
  } catch (e) { console.error('[RIA] Ошибка:', e.message); throw e; }
}

if (import.meta.url === `file://${process.argv[1]}`) collectRIA().catch(() => process.exit(1));
export { collectRIA };