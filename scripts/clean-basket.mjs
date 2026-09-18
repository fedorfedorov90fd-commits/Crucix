#!/usr/bin/env node

// ============================================================
// ОЧИСТКА КОРЗИНЫ ОТ СТАРЫХ ДАННЫХ
// ============================================================
// Удаляет файлы старше N дней
// Контролирует общий объём корзины (не более 1.5 ГБ)
// Запуск: node scripts/clean-basket.mjs
// Cron: 0 2 * * * cd /path && node scripts/clean-basket.mjs
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET_DIR = join(ROOT, 'data', 'basket');

const MAX_AGE_DAYS = 7;        // Храним 7 дней
const MAX_SIZE_GB = 1.5;       // Максимальный размер корзины 1.5 ГБ
const MAX_SIZE_BYTES = MAX_SIZE_GB * 1024 * 1024 * 1024;

// ============================================================
// 1. ОПРЕДЕЛЕНИЕ ВОЗРАСТА ФАЙЛА
// ============================================================

function getFileAgeDays(filePath) {
  const stats = fs.statSync(filePath);
  const ageMs = Date.now() - stats.mtimeMs;
  return ageMs / (1000 * 60 * 60 * 24);
}

// ============================================================
// 2. ОПРЕДЕЛЕНИЕ РАЗМЕРА ПАПКИ
// ============================================================

async function getFolderSize(folderPath) {
  let totalSize = 0;
  const files = await fs.readdir(folderPath, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = join(folderPath, file.name);
    if (file.isDirectory()) {
      totalSize += await getFolderSize(filePath);
    } else {
      const stats = await fs.stat(filePath);
      totalSize += stats.size;
    }
  }
  return totalSize;
}

// ============================================================
// 3. ОЧИСТКА
// ============================================================

async function cleanBasket() {
  console.log('[Clean Basket] Запуск очистки...');
  console.log(`  Максимальный возраст: ${MAX_AGE_DAYS} дней`);
  console.log(`  Максимальный размер: ${MAX_SIZE_GB} ГБ`);

  try {
    // Проверяем, существует ли папка корзины
    try {
      await fs.access(BASKET_DIR);
    } catch (e) {
      console.log('[Clean Basket] Папка корзины не существует, создаём...');
      await fs.mkdir(BASKET_DIR, { recursive: true });
      return;
    }

    // Получаем список файлов
    const files = await fs.readdir(BASKET_DIR);
    
    // Фильтруем файлы, которые нужно удалить
    let deletedCount = 0;
    let deletedSize = 0;
    const keepFiles = [];

    for (const fileName of files) {
      const filePath = join(BASKET_DIR, fileName);
      const stats = await fs.stat(filePath);
      
      // Пропускаем папки
      if (stats.isDirectory()) {
        keepFiles.push(fileName);
        continue;
      }

      const ageDays = getFileAgeDays(filePath);
      
      // Защищаем важные файлы (гео-данные, конфиги)
      const protectedFiles = [
        'geo-data.json',
        'geo-countries.json',
        'geo-markers.json',
        'geo-layers.json',
        'feeds-status.json'
      ];
      
      if (protectedFiles.includes(fileName)) {
        keepFiles.push(fileName);
        continue;
      }

      // Если файл старше MAX_AGE_DAYS — удаляем
      if (ageDays > MAX_AGE_DAYS) {
        await fs.unlink(filePath);
        deletedCount++;
        deletedSize += stats.size;
        console.log(`  🗑️ Удалён: ${fileName} (${(stats.size / 1024).toFixed(1)} KB, возраст: ${ageDays.toFixed(1)} дн.)`);
      } else {
        keepFiles.push(fileName);
      }
    }

    // Проверяем общий размер корзины
    const totalSize = await getFolderSize(BASKET_DIR);
    
    if (totalSize > MAX_SIZE_BYTES) {
      console.log(`  ⚠️ Размер корзины превышает лимит: ${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} ГБ`);
      
      // Если превышает — удаляем самые старые файлы, пока не войдём в лимит
      const allFiles = await fs.readdir(BASKET_DIR);
      const filesWithAge = [];
      
      for (const fileName of allFiles) {
        const filePath = join(BASKET_DIR, fileName);
        const stats = await fs.stat(filePath);
        if (!stats.isDirectory()) {
          const protectedFiles = [
            'geo-data.json',
            'geo-countries.json',
            'geo-markers.json',
            'geo-layers.json',
            'feeds-status.json'
          ];
          if (!protectedFiles.includes(fileName)) {
            filesWithAge.push({
              name: fileName,
              path: filePath,
              age: getFileAgeDays(filePath),
              size: stats.size
            });
          }
        }
      }
      
      // Сортируем по возрасту (старые первыми)
      filesWithAge.sort((a, b) => b.age - a.age);
      
      let currentSize = await getFolderSize(BASKET_DIR);
      
      for (const file of filesWithAge) {
        if (currentSize <= MAX_SIZE_BYTES) break;
        
        await fs.unlink(file.path);
        currentSize -= file.size;
        deletedCount++;
        deletedSize += file.size;
        console.log(`  🗑️ Удалён (превышение лимита): ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
      }
    }

    console.log(`[Clean Basket] Очистка завершена:`);
    console.log(`  🗑️ Удалено файлов: ${deletedCount}`);
    console.log(`  💾 Освобождено: ${(deletedSize / (1024 * 1024)).toFixed(2)} МБ`);
    console.log(`  📁 Текущий размер корзины: ${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} ГБ`);
    console.log(`  📄 Файлов осталось: ${files.length - deletedCount}`);

  } catch (e) {
    console.error('[Clean Basket] Ошибка:', e.message);
  }
}

// Автозапуск
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanBasket();
}

export { cleanBasket };
