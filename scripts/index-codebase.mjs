#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const ROOT = '/home/ta8_/Рабочий стол/Crucix';
const OUTPUT = '/home/ta8_/AI_MEMORY/codebase';
const CHUNK_SIZE = 50 * 1024; // 50KB

// Важные файлы для индексации (приоритет)
const IMPORTANT_FILES = [
  'server.mjs',
  'apis/sources/global-index-api.mjs',
  'apis/sources/gdelt.mjs',
  'apis/sources/acled.mjs',
  'apis/sources/opensky.mjs',
  'apis/sources/ships.mjs',
  'apis/sources/fred.mjs',
  'apis/sources/geo-markers-api.mjs',
  'apis/sources/rss-manager-api.mjs',
  'apis/sources/basket-api.mjs',
  'apis/sources/ai-chat-api.mjs',
  'apis/sources/ai-news-rating.mjs',
  'apis/sources/ai-news-analyzer.mjs',
  'dashboard/public/jarvis.html',
  'dashboard/public/global-index.html',
  'dashboard/public/geo-map.html',
  'dashboard/public/rss-feed.html'
];

async function indexCodebase() {
  console.log('🔍 Начинаю индексацию кодовой базы Crucix...');
  
  // Создаём папку
  await fs.mkdir(OUTPUT, { recursive: true });
  
  // Получаем все .mjs, .js, .html, .css файлы
  const { stdout } = await execAsync(
    `find "${ROOT}" -type f \\( -name "*.mjs" -o -name "*.js" -o -name "*.html" -o -name "*.css" -o -name "*.json" \\) | grep -v node_modules | grep -v PROJECT | grep -v AI_MEMORY | grep -v data | grep -v backups | grep -v logs | grep -v reports`
  );
  
  const allFiles = stdout.trim().split('\n').filter(f => f);
  
  // Сортируем: сначала важные файлы
  const sortedFiles = allFiles.sort((a, b) => {
    const aImportant = IMPORTANT_FILES.some(f => a.includes(f));
    const bImportant = IMPORTANT_FILES.some(f => b.includes(f));
    if (aImportant && !bImportant) return -1;
    if (!aImportant && bImportant) return 1;
    return a.localeCompare(b);
  });
  
  console.log(`📁 Найдено ${sortedFiles.length} файлов`);
  
  let chunkNumber = 1;
  let currentChunk = [];
  let currentSize = 0;
  const manifest = {
    timestamp: new Date().toISOString(),
    totalFiles: sortedFiles.length,
    chunks: {},
    importantFiles: IMPORTANT_FILES
  };
  
  for (const filePath of sortedFiles) {
    const relPath = path.relative(ROOT, filePath);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Извлекаем метаданные
      const exports = (content.match(/export\s+(default\s+)?(\w+)/g) || []).slice(0, 5);
      const classes = (content.match(/class\s+(\w+)/g) || []).slice(0, 5);
      const functions = (content.match(/function\s+(\w+)/g) || []).slice(0, 5);
      const routes = (content.match(/app\.(get|post|put|delete)\s*\(\s*['"]([^'"]+)['"]/g) || []).slice(0, 5);
      
      // Создаём компактную запись
      const entry = `
=== ${relPath} ===
📦 Экспорты: ${exports.join(', ') || 'нет'}
🏗️ Классы: ${classes.join(', ') || 'нет'}
🔧 Функции: ${functions.join(', ') || 'нет'}
🛣️ Маршруты: ${routes.join(', ') || 'нет'}

${content.slice(0, 2000)}${content.length > 2000 ? '\n... (обрезано до 2000 символов)' : ''}
`;
      
      const entrySize = Buffer.byteLength(entry, 'utf-8');
      
      if (currentSize + entrySize > CHUNK_SIZE && currentChunk.length > 0) {
        const chunkContent = currentChunk.join('\n');
        const chunkFile = path.join(OUTPUT, `chunk_${String(chunkNumber).padStart(3, '0')}.txt`);
        await fs.writeFile(chunkFile, chunkContent);
        console.log(`💾 Сохранён чанк ${chunkNumber}: ${chunkFile} (${currentChunk.length} файлов)`);
        
        manifest.chunks[chunkNumber] = {
          files: currentChunk.map(e => e.match(/=== (.+) ===/)?.[1] || 'unknown').filter(Boolean),
          size: currentSize
        };
        
        chunkNumber++;
        currentChunk = [];
        currentSize = 0;
      }
      
      currentChunk.push(entry);
      currentSize += entrySize;
    } catch (e) {
      console.error(`⚠️ Ошибка чтения ${relPath}:`, e.message);
    }
  }
  
  // Сохраняем последний чанк
  if (currentChunk.length > 0) {
    const chunkContent = currentChunk.join('\n');
    const chunkFile = path.join(OUTPUT, `chunk_${String(chunkNumber).padStart(3, '0')}.txt`);
    await fs.writeFile(chunkFile, chunkContent);
    console.log(`💾 Сохранён чанк ${chunkNumber}: ${chunkFile} (${currentChunk.length} файлов)`);
    
    manifest.chunks[chunkNumber] = {
      files: currentChunk.map(e => e.match(/=== (.+) ===/)?.[1] || 'unknown').filter(Boolean),
      size: currentSize
    };
  }
  
  // Сохраняем манифест
  await fs.writeFile(
    path.join(OUTPUT, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  // Сохраняем обзор
  const overview = `# КОДОВАЯ БАЗА CRUCIX

## 📊 Статистика
- Всего файлов: ${manifest.totalFiles}
- Чанков: ${chunkNumber}
- Дата индексации: ${manifest.timestamp}

## 📁 Структура чанков
${Object.entries(manifest.chunks).map(([num, data]) => 
  `- Чанк ${num}: ${data.files.length} файлов, ${Math.round(data.size/1024)}KB`
).join('\n')}

## ⭐ Важные файлы
${IMPORTANT_FILES.map(f => `- ${f}`).join('\n')}

## 🔍 Как использовать
При обращении к AI, указывайте путь к файлу.
AI найдёт его в соответствующем чанке.
`;
  
  await fs.writeFile(
    path.join(OUTPUT, '00_OVERVIEW.md'),
    overview
  );
  
  console.log(`\n✅ Индексация завершена!`);
  console.log(`📁 Папка: ${OUTPUT}`);
  console.log(`📄 Чанков: ${chunkNumber}`);
  console.log(`📊 Всего файлов: ${manifest.totalFiles}`);
}

// Запуск
indexCodebase().catch(console.error);
