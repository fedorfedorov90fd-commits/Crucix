/**
 * Регистрация модуля map-layer-vix в системе Crucix
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REGISTRY_PATH = join(__dirname, '../data/registry/modules.json');

const MODULE = {
  id: 'map-layer-vix',
  name: 'VIX на карте',
  category: 'map-layer',
  description: 'Визуализация индекса VIX на интерактивной карте',
  version: '1.0.0',
  api: '/api/map-layer-vix/',
  page: '/map-layer-vix',
  collector: 'collect-map-layer-vix',
  status: 'active',
  created: new Date().toISOString(),
  requiresAuth: false,
  dataSource: 'basket/vix.json',
  tags: ['vix', 'market', 'map', 'layer']
};

async function register() {
  try {
    let registry = { modules: [] };
    try {
      const content = await readFile(REGISTRY_PATH, 'utf-8');
      registry = JSON.parse(content);
    } catch (err) {
      // Файл не существует — создаём новый
    }

    // Проверяем, есть ли уже такой модуль
    const existing = registry.modules.findIndex(m => m.id === MODULE.id);
    if (existing >= 0) {
      registry.modules[existing] = { ...registry.modules[existing], ...MODULE, updated: new Date().toISOString() };
      console.log(`✅ Модуль ${MODULE.id} обновлён`);
    } else {
      registry.modules.push(MODULE);
      console.log(`✅ Модуль ${MODULE.id} зарегистрирован`);
    }

    await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');
    console.log(`📁 Реестр сохранён: ${REGISTRY_PATH}`);

  } catch (err) {
    console.error('❌ Ошибка регистрации:', err);
  }
}

register();
