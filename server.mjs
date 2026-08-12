#!/usr/bin/env node

import { createServer } from 'http';
import { promises as fs } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3117;
const PUBLIC_DIR = join(__dirname, 'dashboard', 'public');

// MIME-типы
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.opml': 'application/xml',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

// ======== ИМПОРТ ВСЕХ API ========
import { handleRSSAPI } from './apis/sources/rss-manager-api.mjs';
import { handleNewsAPI } from './apis/sources/news-api.mjs';
import { handleAIRatingAPI } from './apis/sources/ai-news-rating.mjs';
import { handleAIChatAPI } from './apis/sources/ai-chat-api.mjs';
import { handleStorageAPI } from './apis/sources/storage-api.mjs';
import { handleGeoMarkersAPI } from './apis/sources/geo-markers-api.mjs';

async function serveStatic(req, res, filePath) {
  try {
    const ext = extname(filePath);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=86400',
    });
    res.end(content);
    return true;
  } catch (e) {
    return false;
  }
}

async function findStaticFile(pathname) {
  const cleanPath = pathname.split('?')[0];

  const routes = {
    '/': 'index.html',
    '/jarvis': 'jarvis.html',
    '/rss-feed': 'rss-feed.html',
    '/rss-dashboard': 'rss-dashboard.html',
    '/ai-chat': 'ai-chat.html',
    '/geo-map': 'geo-map.html'
  };

  if (routes[cleanPath]) {
    const file = join(PUBLIC_DIR, routes[cleanPath]);
    try {
      await fs.access(file);
      return file;
    } catch (e) {}
  }

  const direct = join(PUBLIC_DIR, cleanPath);
  try {
    await fs.access(direct);
    return direct;
  } catch (e) {}

  if (!extname(cleanPath) && !cleanPath.endsWith('/')) {
    const withHtml = join(PUBLIC_DIR, cleanPath + '.html');
    try {
      await fs.access(withHtml);
      return withHtml;
    } catch (e) {}
  }

  if (cleanPath === '/' || cleanPath === '') {
    const index = join(PUBLIC_DIR, 'index.html');
    try {
      await fs.access(index);
      return index;
    } catch (e) {}
  }

  if (cleanPath.startsWith('/css/') || cleanPath.startsWith('/js/') || cleanPath.startsWith('/images/')) {
    const file = join(PUBLIC_DIR, cleanPath);
    try {
      await fs.access(file);
      return file;
    } catch (e) {}
  }

  return null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // ======== ВСЕ API ========

  // RSS API
  if (pathname.startsWith('/api/rss/')) {
    await handleRSSAPI(req, res);
    return;
  }

  // News API
  if (pathname.startsWith('/api/news/')) {
    await handleNewsAPI(req, res);
    return;
  }

  // AI Rating API
  if (pathname.startsWith('/api/ai/rate')) {
    await handleAIRatingAPI(req, res);
    return;
  }

  // AI Chat API
  if (pathname.startsWith('/api/ai/chat')) {
    await handleAIChatAPI(req, res);
    return;
  }

  // Storage API
  if (pathname.startsWith('/api/storage/')) {
    await handleStorageAPI(req, res);
    return;
  }

  // Geo Markers API
  if (pathname.startsWith('/api/geo/')) {
    await handleGeoMarkersAPI(req, res);
    return;
  }

  // Другие API
  if (pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'API не найден' }));
    return;
  }

  // Статика
  const filePath = await findStaticFile(pathname);
  if (filePath) {
    const served = await serveStatic(req, res, filePath);
    if (served) return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head><title>404 — Crucix</title></head>
    <body style="background:#0a0a1a;color:#e0e0e0;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
      <div style="text-align:center;">
        <h1 style="font-size:72px;margin:0;color:#2196f3;">404</h1>
        <p style="font-size:20px;color:#888;">Страница не найдена</p>
        <p style="color:#555;margin-top:20px;">
          <a href="/" style="color:#2196f3;text-decoration:none;">← Вернуться на главную</a>
        </p>
      </div>
    </body>
    </html>
  `);
});

server.listen(PORT, () => {
  console.log('========================================');
  console.log('  🚀 Crucix Server запущен');
  console.log('  📡 Порт: ' + PORT);
  console.log('  🌐 URL: http://localhost:' + PORT);
  console.log('  📁 Public: ' + PUBLIC_DIR);
  console.log('========================================');
  console.log('  Доступные страницы:');
  console.log('  - Главная: http://localhost:' + PORT + '/');
  console.log('  - Интерфейс: http://localhost:' + PORT + '/jarvis');
  console.log('  - RSS-лента: http://localhost:' + PORT + '/rss-feed');
  console.log('  - RSS управление: http://localhost:' + PORT + '/rss-dashboard');
  console.log('  - AI Чат: http://localhost:' + PORT + '/ai-chat');
  console.log('========================================');
  console.log('  API:');
  console.log('  - /api/rss/*   — управление RSS');
  console.log('  - /api/news/*  — новости');
  console.log('  - /api/ai/rate — AI оценка новостей');
  console.log('  - /api/ai/chat — AI чат помощник');
  console.log('  - /api/storage/* — управление хранением');
  console.log('  - /api/geo/*   — геополитические маркеры');
  console.log('========================================');
});

process.on('SIGINT', () => {
  console.log('\n🛑 Сервер остановлен');
  process.exit(0);
});

export default server;
