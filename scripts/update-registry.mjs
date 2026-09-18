import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const REGISTRY_PATH = join(process.env.HOME, 'Рабочий стол/Crucix/ai-memory-sync/.crucix-master-registry.json');

async function countFiles(dir, pattern) {
  try {
    const { stdout } = await execAsync(`find "${dir}" -name "${pattern}" 2>/dev/null | wc -l`);
    return parseInt(stdout.trim()) || 0;
  } catch { return 0; }
}

async function updateRegistry() {
  const base = process.env.HOME + '/Рабочий стол/Crucix';
  
  const stats = {
    api_modules: await countFiles(join(base, 'apis/sources'), '*.mjs'),
    pages: await countFiles(join(base, 'dashboard/public'), '*.html'),
    collectors: await countFiles(join(base, 'scripts/collectors'), '*.mjs'),
    basket: await countFiles(join(base, 'data/basket'), '*.json'),
  };

  console.log('📊 Текущая статистика:', stats);

  // Читаем существующий реестр
  let registry;
  try {
    const content = await readFile(REGISTRY_PATH, 'utf-8');
    registry = JSON.parse(content);
  } catch {
    registry = { meta: { version: '1.0' }, statistics: {}, registry: {} };
  }

  // Обновляем статистику
  registry.statistics = {
    ...registry.statistics,
    api_modules: { total: stats.api_modules },
    pages: { total: stats.pages },
    collectors: { total: stats.collectors },
    basket_files: { total: stats.basket },
    last_updated: new Date().toISOString()
  };

  registry.meta.last_updated = new Date().toISOString();

  await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');
  console.log('✅ Реестр обновлён:', REGISTRY_PATH);
}

updateRegistry().catch(console.error);
