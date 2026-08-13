#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

const CODEBASE = '/home/ta8_/AI_MEMORY/codebase';
const prompt = process.argv.slice(2).join(' ') || 'Что такое Crucix?';

async function chatWithCodebase() {
  // Загружаем обзор
  let overview = 'Индексация не найдена';
  try {
    overview = await fs.readFile(path.join(CODEBASE, '00_OVERVIEW.md'), 'utf-8');
    overview = overview.slice(0, 2000);
  } catch (e) {}

  // Загружаем чанки (только краткую информацию)
  let chunks = [];
  for (let i = 1; i <= 2; i++) {
    try {
      const chunkFile = path.join(CODEBASE, `chunk_${String(i).padStart(3, '0')}.txt`);
      const content = await fs.readFile(chunkFile, 'utf-8');
      // Берем только заголовки файлов из чанка
      const fileHeaders = content.match(/=== (.+) ===/g) || [];
      chunks.push(fileHeaders.slice(0, 15).join('\n'));
    } catch (e) {}
  }

  // Формируем краткий промпт (без больших блоков кода)
  const fullPrompt = `Ты — эксперт по Crucix.

ОБЗОР: ${overview}

ФАЙЛЫ В ПРОЕКТЕ (из чанков):
${chunks.join('\n')}

ВОПРОС: ${prompt}

ОТВЕТЬ КРАТКО, НО КОНКРЕТНО. УКАЗЫВАЙ ФАЙЛЫ.`;

  // Создаем временный файл с промптом
  const tempFile = path.join(os.tmpdir(), `ollama-prompt-${Date.now()}.txt`);
  await fs.writeFile(tempFile, fullPrompt, 'utf-8');

  try {
    // Используем curl с --data-binary для безопасной передачи
    const result = execSync(
      `curl -s http://localhost:11434/api/generate \
        -H "Content-Type: application/json" \
        --data-binary @<(echo '{"model":"deepseek-r1:1.5b","prompt":"'$(cat ${tempFile} | sed 's/"/\\"/g' | tr '\n' ' ')'","stream":false}')`,
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
  } finally {
    // Удаляем временный файл
    await fs.unlink(tempFile).catch(() => {});
  }
}

chatWithCodebase().catch(console.error);
