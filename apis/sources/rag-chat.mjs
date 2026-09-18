/**
 * rag-chat.mjs — Чат-интерфейс для RAG-движка
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const DOCS_DIR = '/home/ta8_/Рабочий стол/Crucix/data/help';
const BASKET_DIR = '/home/ta8_/Рабочий стол/Crucix/data/basket';

const chatSessions = {};

export function searchDocs(query) {
  const results = [];
  const docs = [];

  if (existsSync(DOCS_DIR)) {
    const ruDir = join(DOCS_DIR, 'ru');
    if (existsSync(ruDir)) {
      const files = readdirSync(ruDir).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
      for (const file of files.slice(0, 50)) {
        try {
          const content = readFileSync(join(ruDir, file), 'utf8');
          if (content.toLowerCase().includes(query.toLowerCase())) {
            docs.push({ file, content: content.slice(0, 500) + '...', source: 'help/ru' });
          }
        } catch (e) {}
      }
    }
  }

  if (existsSync(BASKET_DIR)) {
    const files = readdirSync(BASKET_DIR).filter(f => f.endsWith('.json'));
    for (const file of files.slice(0, 20)) {
      try {
        const content = readFileSync(join(BASKET_DIR, file), 'utf8');
        const data = JSON.parse(content);
        const dataStr = JSON.stringify(data).toLowerCase();
        if (dataStr.includes(query.toLowerCase())) {
          docs.push({ file, content: JSON.stringify(data).slice(0, 500) + '...', source: 'basket' });
        }
      } catch (e) {}
    }
  }

  return { success: true, query, results: docs, count: docs.length };
}

export function analyzeQuery(query) {
  const keywords = {
    api: ['api', 'endpoint', 'module', 'сервер'],
    data: ['data', 'данные', 'basket', 'collector'],
    map: ['map', 'карта', 'layer', 'слой'],
    analytics: ['analysis', 'анализ', 'predict', 'прогноз'],
    cyber: ['cyber', 'кибер', 'security', 'безопасность'],
    economy: ['economy', 'экономика', 'finance', 'финансы']
  };

  const detected = [];
  for (const [category, words] of Object.entries(keywords)) {
    if (words.some(w => query.toLowerCase().includes(w))) detected.push(category);
  }

  return { query, categories: detected, confidence: detected.length > 0 ? 0.7 : 0.2 };
}

export function generateResponse(query) {
  const analysis = analyzeQuery(query);
  const search = searchDocs(query);

  let response = '';
  let sources = [];

  if (search.count > 0) {
    response = `Найдено ${search.count} результатов по запросу "${query}":\n\n`;
    for (const doc of search.results.slice(0, 5)) {
      response += `📄 ${doc.file} (${doc.source})\n`;
      response += `   ${doc.content.slice(0, 200)}...\n\n`;
      sources.push(doc.file);
    }
    if (search.count > 5) response += `... и ещё ${search.count - 5} результатов\n`;
  } else {
    response = `По запросу "${query}" ничего не найдено.\n\nПопробуйте:\n- другие ключевые слова\n- проверить документацию в /data/help/ru/\n- посмотреть данные в /data/basket/`;
  }

  if (analysis.categories.length > 0) {
    response += `\n\nКатегории: ${analysis.categories.join(', ')}`;
  }

  return { success: true, query, response, sources, categories: analysis.categories };
}

export function chat(sessionId, message) {
  if (!chatSessions[sessionId]) {
    chatSessions[sessionId] = { history: [], created: new Date().toISOString() };
  }

  const session = chatSessions[sessionId];
  session.history.push({ role: 'user', content: message, timestamp: new Date().toISOString() });

  const result = generateResponse(message);
  session.history.push({ role: 'assistant', content: result.response, timestamp: new Date().toISOString() });

  return { success: true, sessionId, response: result.response, sources: result.sources, history: session.history };
}

export function getChatHistory(sessionId) {
  if (!chatSessions[sessionId]) return { success: false, error: 'Сессия не найдена' };
  return { success: true, sessionId, history: chatSessions[sessionId].history };
}

export function clearChatSession(sessionId) {
  if (chatSessions[sessionId]) { delete chatSessions[sessionId]; return { success: true }; }
  return { success: false, error: 'Сессия не найдена' };
}

export async function handleRagChat(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    if ((pathname === '/api/rag/chat' || pathname === '/api/rag/chat/') && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const result = chat(data.sessionId || 'default', data.message || '');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    if (pathname.startsWith('/api/rag/search')) {
      const query = url.searchParams.get('q') || '';
      const result = searchDocs(query);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname.startsWith('/api/rag/analyze')) {
      const query = url.searchParams.get('q') || '';
      const result = analyzeQuery(query);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname.startsWith('/api/rag/history/')) {
      const sessionId = pathname.replace('/api/rag/history/', '');
      const result = getChatHistory(sessionId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname.startsWith('/api/rag/clear/')) {
      const sessionId = pathname.replace('/api/rag/clear/', '');
      const result = clearChatSession(sessionId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'RAG endpoint not found' }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

// ===== ЭКСПОРТ ПО УМОЛЧАНИЮ ДЛЯ SERVER.MJS =====
export default {
  searchDocs,
  analyzeQuery,
  generateResponse,
  chat,
  getChatHistory,
  clearChatSession,
  handleRagChat
};
