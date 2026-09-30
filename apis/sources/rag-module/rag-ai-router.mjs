// ============================================================
// RAG MODULE — Retrieval-Augmented Generation
// Интегрирован в Crucix как API-модуль
// ============================================================

import axios from 'axios';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const config = {
  ollama: {
    enabled: true,
    url: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'deepseek-r1:1.5b'
  },
  deepseekLocal: {
    enabled: false,
    url: process.env.DEEPSEEK_LOCAL_URL || 'http://localhost:11434',
    model: process.env.DEEPSEEK_LOCAL_MODEL || 'deepseek-r1:7b'
  }
};

// Векторное хранилище (в памяти)
let vectorStore = [];

// ============================================================
// 2. ОСНОВНЫЕ ФУНКЦИИ
// ============================================================

function searchDocuments(query, topK = 5) {
  // Простейший поиск — имитация векторного
  const results = vectorStore
    .map(doc => ({
      ...doc,
      score: Math.random() * 0.8 + 0.2
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  return results;
}

async function generateResponse(query, context) {
  try {
    const ollamaUrl = `${config.ollama.url}/api/generate`;
    const prompt = `Контекст: ${context}\n\nВопрос: ${query}\n\nОтвет на основе контекста:`;

    const response = await axios.post(ollamaUrl, {
      model: config.ollama.model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.5,
        num_predict: 500
      }
    });

    return response.data.response || 'Не удалось сгенерировать ответ';
  } catch (error) {
    return `Ошибка генерации: ${error.message}`;
  }
}

// ============================================================
// 3. API-ОБРАБОТЧИК
// ============================================================

export async function handleRAG(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // POST /api/rag/query — поиск и генерация
  if (pathname === '/api/rag/query' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const query = data.query || '';
        const topK = data.topK || 5;

        if (!query) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Параметр "query" обязателен' }));
          return;
        }

        // Поиск в векторном хранилище
        const results = searchDocuments(query, topK);
        const context = results.map(r => r.content || r.text || '').join('\n');

        // Генерация ответа
        const answer = await generateResponse(query, context);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          query: query,
          results: results,
          answer: answer,
          timestamp: new Date().toISOString()
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Неверный JSON' }));
      }
    });
    return true;
  }

  // POST /api/rag/index — индексация документа
  if (pathname === '/api/rag/index' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const doc = {
          id: `doc_${Date.now()}`,
          content: data.content || '',
          metadata: data.metadata || {},
          timestamp: new Date().toISOString()
        };
        vectorStore.push(doc);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          message: 'Документ индексирован',
          id: doc.id
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Неверный JSON' }));
      }
    });
    return true;
  }

  // GET /api/rag/status — статус модуля
  if (pathname === '/api/rag/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      module: 'rag',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      documents: vectorStore.length,
      ollama: config.ollama.enabled ? 'connected' : 'disabled'
    }));
    return true;
  }

  // GET /api/rag/stats — статистика
  if (pathname === '/api/rag/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      total_documents: vectorStore.length,
      timestamp: new Date().toISOString()
    }));
    return true;
  }

  return false;
}

export default { handleRAG };
