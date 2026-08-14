#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const CODEBASE = '/home/ta8_/AI_MEMORY/codebase';
const prompt = process.argv[2] || 'Что такое Crucix?';

async function chatWithCodebase() {
  // Загружаем обзор
  let overview = 'Индексация не найдена';
  try {
    overview = await fs.readFile(path.join(CODEBASE, '00_OVERVIEW.md'), 'utf-8');
  } catch (e) {}
  
  // Загружаем первые 3 чанка (самые важные)
  let chunks = [];
  for (let i = 1; i <= 3; i++) {
    try {
      const chunkFile = path.join(CODEBASE, `chunk_${String(i).padStart(3, '0')}.txt`);
      const content = await fs.readFile(chunkFile, 'utf-8');
      chunks.push(content.slice(0, 10000)); // Ограничиваем
    } catch (e) {}
  }
  
  const fullPrompt = `Ты — эксперт по кодовой базе Crucix.

ОБЗОР ПРОЕКТА:
${overview.slice(0, 5000)}

КОД ИЗ ВАЖНЫХ ФАЙЛОВ:
${chunks.join('\n---\n').slice(0, 15000)}

ВОПРОС ПОЛЬЗОВАТЕЛЯ:
${prompt}

ОТВЕТЬ КРАТКО, НО КОНКРЕТНО, ССЫЛАЯСЬ НА КОНКРЕТНЫЕ ФАЙЛЫ.`;

  // Отправляем в Ollama
  const result = execSync(
    `curl -s http://localhost:11434/api/generate -d '{"model":"deepseek-r1:1.5b","prompt":"${fullPrompt.replace(/"/g, '\\"')}","stream":false}'`,
    { encoding: 'utf-8' }
  );
  
  try {
    const json = JSON.parse(result);
    console.log(json.response || result);
  } catch (e) {
    console.log(result);
  }
}

chatWithCodebase().catch(console.error);
