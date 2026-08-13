#!/usr/bin/env node

// Скрипт обновления всех RSS-лент

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import RSSManager from '../apis/sources/rss-manager-api.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

async function updateRSS() {
  console.log('[RSS Updater] Начинаю обновление лент...');
  
  const manager = new RSSManager();
  await manager.loadOPML();
  
  console.log(`[RSS Updater] Найдено ${manager.feeds.length} лент`);
  
  const results = await manager.updateAllFeeds();
  
  const alive = results.filter(r => r.alive).length;
  const dead = results.filter(r => !r.alive).length;
  
  console.log(`[RSS Updater] Обновление завершено:`);
  console.log(`  ✅ Живых: ${alive}`);
  console.log(`  ❌ Мёртвых: ${dead}`);
  console.log(`  📊 Всего: ${results.length}`);
  
  // Сохраняем отчёт
  const report = {
    date: new Date().toISOString(),
    total: results.length,
    alive,
    dead,
    results
  };
  
  const reportDir = join(ROOT, 'reports');
  await fs.mkdir(reportDir, { recursive: true });
  const reportFile = join(reportDir, `rss-update-${new Date().toISOString().slice(0,10)}.json`);
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
  
  console.log(`[RSS Updater] Отчёт сохранён: ${reportFile}`);
}

updateRSS().catch(console.error);