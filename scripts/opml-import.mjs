#!/usr/bin/env node

// Скрипт импорта OPML-файла

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const FEEDS_FILE = join(ROOT, 'data', 'feeds', 'feeds.opml');

async function importOPML(filePath) {
  console.log(`[OPML Import] Импорт из: ${filePath}`);
  
  try {
    const xml = await fs.readFile(filePath, 'utf-8');
    
    // Простая проверка, что это OPML
    if (!xml.includes('<opml') || !xml.includes('xmlUrl')) {
      throw new Error('Неверный формат OPML: не найдены теги <opml> или xmlUrl');
    }
    
    // Создаём резервную копию
    const backupFile = join(ROOT, 'data', 'feeds', `feeds.backup.${Date.now()}.opml`);
    try {
      await fs.copyFile(FEEDS_FILE, backupFile);
      console.log(`[OPML Import] Резервная копия: ${backupFile}`);
    } catch (e) {
      // Если исходного файла нет — игнорируем
    }
    
    // Сохраняем новый файл
    await fs.writeFile(FEEDS_FILE, xml);
    
    console.log('[OPML Import] Импорт завершён успешно');
    
    // Подсчёт лент
    const feeds = xml.match(/xmlUrl="[^"]*"/g) || [];
    console.log(`[OPML Import] Найдено ${feeds.length} RSS-лент`);
    
  } catch (e) {
    console.error('[OPML Import] Ошибка:', e.message);
    process.exit(1);
  }
}

// Запуск
const filePath = process.argv[2];
if (!filePath) {
  console.error('Использование: node scripts/opml-import.mjs <путь_к_opml_файлу>');
  process.exit(1);
}

importOPML(filePath);