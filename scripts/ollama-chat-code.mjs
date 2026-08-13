#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const CODEBASE = '/home/ta8_/AI_MEMORY/codebase';
const prompt = process.argv.slice(2).join(' ') || 'Что такое Crucix?';

async function chatWithCodebase() {
  // Загружаем обзор
  let overview = 'Индексация не найдена';
  try {
    overview = await fs.readFile(path.join(CODEBASE, '00_OVERVIEW.md'), 'utf-8');
  } catch (e) {}
  
  // Загружаем первые 3 чанка
  let chunks = [];
  for (let i = 1; i <= 3; i++) {
    try {
      const chunkFile = path.join(CODEBASE, `chunk_${String(i).padStart(3, '0')}.txt`);
      const content = await fs.readFile(chunkFile, 'utf-8');
      chunks.push(content.slice(0, 8000));
    } catch (e) {}
  }
  
  // Формируем промпт - экранируем для JSON
  const fullPrompt = `Ты — эксперт по кодовой базе Crucix.

ОБЗОР ПРОЕКТА:
${overview.slice(0, 3000)}

КОД ИЗ ВАЖНЫХ ФАЙЛОВ:
${chunks.join('\n---\n').slice(0, 12000)}

ВОПРОС: ${prompt}

ОТВЕТЬ КРАТКО, НО КОНКРЕТНО. УКАЗЫВАЙ КОНКРЕТНЫЕ ФАЙЛЫ.`;

  // Экранируем для передачи в JSON
  const escapedPrompt = fullPrompt
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');

  const payload = `{"model":"deepseek-r1:1.5b","prompt":"${escapedPrompt}","stream":false}`;
  
  try {
    const result = execSync(
      `curl -s http://localhost:11434/api/generate -d '${payload}'`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    
    try {
      const json = JSON.parse(result);
      console.log(json.response || json.error || result);
    } catch (e) {
      console.log(result);
    }
  } catch (error) {
    console.error('Ошибка:', error.message);
    if (error.stderr) console.error('stderr:', error.stderr);
    if (error.stdout) console.log('stdout:', error.stdout);
  }
}

chatWithCodebase().catch(console.error);
