#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data', 'raw');
const REPORTS_DIR = join(ROOT, 'reports');
const AI_RAW_DIR = join(ROOT, 'data', 'ai_raw', 'geopolitical-reports');

const DAYS = 7; // Хранить 7 дней

async function cleanDir(dir) {
  try {
    const files = await fs.readdir(dir);
    const now = Date.now();
    let deleted = 0;
    for (const file of files) {
      const path = join(dir, file);
      const stat = await fs.stat(path);
      const age = (now - stat.mtimeMs) / (1000 * 60 * 60 * 24);
      if (age > DAYS) {
        await fs.unlink(path);
        deleted++;
      }
    }
    if (deleted > 0) {
      console.log(`[Clean] Удалено ${deleted} файлов из ${dir}`);
    }
  } catch (e) {
    // Папка может не существовать
  }
}

await cleanDir(DATA_DIR);
await cleanDir(REPORTS_DIR);
await cleanDir(AI_RAW_DIR);
console.log('[Clean] Готово.');
