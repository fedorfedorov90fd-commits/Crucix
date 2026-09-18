import { readFile, writeFile } from 'fs/promises';

const path = '/home/ta8_/Рабочий стол/Crucix/server/routes-pages.json';
const data = JSON.parse(await readFile(path, 'utf-8'));

if (!data['/map-layer-vix']) {
  data['/map-layer-vix'] = 'map-layer-vix';
  await writeFile(path, JSON.stringify(data, null, 2));
  console.log('✅ routes-pages.json обновлён');
} else {
  console.log('⏩ уже есть');
}
