#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const CONFIG = {
  PROJECT_DIR: join(ROOT, 'PROJECT'),
  LOGS_DIR: join(ROOT, 'LOGS'),
  OLLAMA_URL: 'http://localhost:11434/api/generate',
  OLLAMA_MODEL: 'deepseek-r1:1.5b',
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function loadState() {
  console.log('[Interactive] 📂 Загрузка состояния проекта...');
  
  let state = '';
  try {
    state += await fs.readFile(join(CONFIG.PROJECT_DIR, 'STATE.txt'), 'utf-8');
  } catch { state += '=== СОСТОЯНИЕ НЕ НАЙДЕНО ===\n'; }
  
  try {
    const decisions = await fs.readFile(join(CONFIG.PROJECT_DIR, 'DECISIONS.txt'), 'utf-8');
    state += '\n=== ПОСЛЕДНИЕ РЕШЕНИЯ ===\n' + decisions.slice(-500);
  } catch {}
  
  return state;
}

async function queryAI(prompt) {
  console.log('[Interactive] 🤔 Анализирую...');
  const response = await fetch(CONFIG.OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CONFIG.OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      options: { temperature: 0.4, num_predict: 1500 },
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return data.response || 'Нет ответа';
}

async function run() {
  console.log('='.repeat(60));
  console.log('  🗣️ ИНТЕРАКТИВНЫЙ КООРДИНАТОР CRUCIX');
  console.log('='.repeat(60));
  
  const state = await loadState();
  
  console.log('\n📋 ТЕКУЩЕЕ СОСТОЯНИЕ ПРОЕКТА:');
  console.log(state.slice(0, 600) + '...\n');
  
  const analysisPrompt = `
Ты — координатор проекта Crucix.

На основе этого состояния:
${state}

Сформулируй 3 вопроса к разработчику, чтобы уточнить ситуацию и понять, как двигаться дальше.

Вопросы должны быть:
- Конкретными
- Относиться к текущему модулю (№01)
- Помогать принять решение

Формат ответа: просто список вопросов, без пояснений.
`;

  const questions = await queryAI(analysisPrompt);
  
  console.log('\n❓ ВОПРОСЫ КООРДИНАТОРА:');
  console.log('─'.repeat(40));
  console.log(questions);
  console.log('─'.repeat(40));
  
  console.log('\n📝 Отвечай на вопросы по порядку:');
  const answers = [];
  const lines = questions.split('\n').filter(l => l.trim().match(/^\d/));
  
  for (const line of lines) {
    const answer = await question(`\n${line}\n> `);
    answers.push({ question: line, answer: answer.trim() });
  }
  
  const planPrompt = `
На основе этих ответов разработчика:

${answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}

Составь план действий на сегодня для модуля №01 (Многоуровневый сборщик).

План должен быть:
- Конкретным (какие файлы создавать/менять)
- Пошаговым
- С приоритетами

Ответь кратко, структурированно.
`;

  console.log('\n⏳ Формирую план действий...');
  const plan = await queryAI(planPrompt);
  
  console.log('\n' + '='.repeat(60));
  console.log('  📋 ПЛАН ДЕЙСТВИЙ НА СЕГОДНЯ');
  console.log('='.repeat(60));
  console.log(plan);
  console.log('='.repeat(60));
  
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = join(CONFIG.LOGS_DIR, `interactive-${ts}.log`);
  await fs.mkdir(CONFIG.LOGS_DIR, { recursive: true });
  await fs.writeFile(logFile, 
    `=== ДИАЛОГ С КООРДИНАТОРОМ ===\n\n` +
    `ВОПРОСЫ:\n${questions}\n\n` +
    `ОТВЕТЫ:\n${answers.map(a => `${a.question}\n${a.answer}`).join('\n\n')}\n\n` +
    `ПЛАН:\n${plan}`
  );
  
  console.log(`\n[Interactive] ✅ Лог сохранён: ${logFile}`);
  console.log('[Interactive] ✅ Готово! Можешь начинать работать по плану.');
  
  rl.close();
}

run().catch(console.error);