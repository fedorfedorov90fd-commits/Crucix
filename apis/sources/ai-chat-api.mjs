#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const KNOWLEDGE_FILE = join(ROOT, 'data', 'ai_knowledge', 'knowledge.json');

async function getSystemPrompt() {
  try {
    const content = await fs.readFile(KNOWLEDGE_FILE, 'utf-8');
    const knowledge = JSON.parse(content);

    let prompt = 'Ты — AI-помощник проекта Crucix. Отвечай кратко и по делу на русском языке.\n\n';
    prompt += '=== О ПРОЕКТЕ ===\n';
    prompt += 'Crucix — OSINT-платформа для сбора и анализа данных из открытых источников.\n';
    prompt += 'Версия: 2.1.0\n\n';

    if (knowledge.modules) {
      prompt += '=== МОДУЛИ ===\n';
      for (const [key, mod] of Object.entries(knowledge.modules)) {
        prompt += `- ${mod.name}: ${mod.description}\n`;
      }
      prompt += '\n';
    }

    if (knowledge.how_to) {
      prompt += '=== ИНСТРУКЦИИ ===\n';
      for (const [key, value] of Object.entries(knowledge.how_to)) {
        prompt += `${key}: ${value}\n`;
      }
      prompt += '\n';
    }

    prompt += '=== ПРАВИЛА ===\n';
    prompt += '1. Отвечай на русском языке кратко и по делу\n';
    prompt += '2. Если не знаешь — скажи честно\n';
    prompt += '3. Используй знания о проекте\n';

    return prompt;
  } catch (e) {
    return 'Ты — AI-помощник проекта Crucix. Отвечай кратко на русском языке.';
  }
}

export async function handleAIChatAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (pathname === '/api/ai/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const message = data.message || '';
        const model = data.model || 'deepseek-r1:1.5b';

        if (!message) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Нет сообщения' }));
          return;
        }

        const systemPrompt = await getSystemPrompt();
        const fullPrompt = `${systemPrompt}\n\nВопрос пользователя: ${message}\n\nОтвет AI:`;

        console.log('📤 Отправка запроса в Ollama...');

        const ollamaRes = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model,
            prompt: fullPrompt,
            stream: false,
            options: {
              temperature: 0.7,
              num_predict: 500
            }
          })
        });

        if (!ollamaRes.ok) {
          const errText = await ollamaRes.text();
          console.error('❌ Ollama ошибка:', ollamaRes.status, errText);
          throw new Error(`Ollama: ${ollamaRes.status}`);
        }

        const ollamaData = await ollamaRes.json();
        console.log('✅ Ответ от Ollama получен');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          response: ollamaData.response || 'Извините, не удалось получить ответ.'
        }));
      } catch (e) {
        console.error('❌ Ошибка AI:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Ошибка AI: ' + e.message
        }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));
}
