#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const CONFIG = {
  PROJECT_DIR: join(ROOT, 'PROJECT'),
  OLLAMA_URL: 'http://localhost:11434/api/generate',
  OLLAMA_MODEL: 'deepseek-r1:1.5b',
};

// Получаем имя файла с чатом из аргументов командной строки
const chatFile = process.argv[2];
if (!chatFile) {
  console.error('❌ Укажи файл с чатом: node scripts/parse-chat.mjs ~/chat.txt');
  process.exit(1);
}

async function parseChat() {
  console.log('[ParseChat] 📖 Читаю чат из:', chatFile);
  const chatContent = await fs.readFile(chatFile, 'utf-8');
  
  // Берём только первую часть (чтобы не перегружать модель)
  const chatSnippet = chatContent.slice(0, 8000);
  
  const prompt = `Проанализируй этот чат разработки проекта Crucix.

Извлеки из него следующую информацию и оформи в виде текста:

1. РЕШЕНИЯ: какие архитектурные и технические решения были приняты
2. КОД: какие файлы были созданы или изменены, какой функционал добавлен
3. СТАТУС: в каком состоянии находится проект
4. МОДУЛИ: какое описание модулей обсуждалось

Чат:
${chatSnippet}

Ответь строго в формате:
=== РЕШЕНИЯ ===
...
=== КОД ===
...
=== СТАТУС ===
...
=== МОДУЛИ ===
...`;

  console.log('[ParseChat] 🤔 Отправляю запрос в Ollama...');
  
  const response = await fetch(CONFIG.OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CONFIG.OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      options: { temperature: 0.3, num_predict: 2000 },
    }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const analysis = data.response;

  // Сохраняем результат
  const outputFile = join(CONFIG.PROJECT_DIR, 'CHAT_ANALYSIS.txt');
  await fs.writeFile(outputFile, analysis);
  console.log(`[ParseChat] ✅ Анализ сохранён в: ${outputFile}`);
  
  // Показываем результат
  console.log('\n' + '='.repeat(60));
  console.log('  📊 АНАЛИЗ ЧАТА');
  console.log('='.repeat(60));
  console.log(analysis);
  console.log('='.repeat(60));
  console.log('[ParseChat] ✅ Готово!');
}

parseChat().catch(console.error);
