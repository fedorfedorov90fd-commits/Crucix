#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data', 'raw');
const REPORTS_DIR = join(ROOT, 'reports');
const AI_RAW_DIR = join(ROOT, 'data', 'ai_raw', 'geopolitical-reports');

// Убедимся, что папки существуют
await fs.mkdir(REPORTS_DIR, { recursive: true });
await fs.mkdir(AI_RAW_DIR, { recursive: true });

async function getTodayData() {
  const today = new Date().toISOString().slice(0, 10);
  const files = await fs.readdir(DATA_DIR);
  const relevant = files.filter(f => f.includes(today) && f.endsWith('.json'));
  
  let all = [];
  for (const file of relevant) {
    const content = await fs.readFile(join(DATA_DIR, file), 'utf-8');
    const data = JSON.parse(content);
    all = all.concat(data);
  }
  return all;
}

async function generateDigest(data) {
  // Здесь ты можешь использовать локальный Ollama для фильтрации
  // Просто показываем количество собранных новостей
  console.log(`[Daily Report] Собрано ${data.length} новостей за сегодня`);
  
  // Сохраняем в папку для AI
  const today = new Date().toISOString().slice(0, 10);
  const aiFile = join(AI_RAW_DIR, `${today}.json`);
  await fs.writeFile(aiFile, JSON.stringify({
    source: 'daily-collector',
    fetchedAt: new Date().toISOString(),
    totalReports: data.length,
    reports: data.slice(0, 1000) // Ограничиваем для AI
  }, null, 2));
  
  console.log(`[Daily Report] Сохранено в ${aiFile}`);
  
  // Создаём краткий отчёт для человека
  const summary = `=== ЕЖЕДНЕВНЫЙ ОТЧЁТ ===\n` +
    `Дата: ${today}\n` +
    `Всего новостей: ${data.length}\n` +
    `Источники: ${new Set(data.map(d => d.source)).size}\n\n` +
    `Топ-10 заголовков:\n`;
  
  const top = data.slice(0, 10).map((d, i) => `${i+1}. ${d.title}`).join('\n');
  
  const reportFile = join(REPORTS_DIR, `report_${today}.txt`);
  await fs.writeFile(reportFile, summary + top);
  console.log(`[Daily Report] Отчёт сохранён в ${reportFile}`);
}

// Запуск
console.log('[Daily Report] Начинаем сбор данных...');
const data = await getTodayData();
await generateDigest(data);
console.log('[Daily Report] Готово.');
