#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET_FILE = join(ROOT, 'data', 'basket', 'news.json');

export async function handleNewsAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // Пытаемся прочитать файл с данными
    let basket = { data: { articles: [] }, source: 'demo', date: new Date().toISOString() };
    try {
      const data = await fs.readFile(BASKET_FILE, 'utf-8');
      basket = JSON.parse(data);
    } catch (e) {
      // Если файла нет — используем демо-данные
      console.warn('[News API] Файл с данными не найден, используется демо-режим');
    }

    // === ГЛАВНЫЙ ЭНДПОИНТ /api/news/ или /api/news ===
    if (path === '/api/news/' || path === '/api/news') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'news',
        status: 'online',
        articles: basket.data?.articles || [],
        total: basket.data?.articles?.length || 0,
        source: basket.source || 'demo',
        timestamp: basket.date || new Date().toISOString(),
        endpoints: [
          '/api/news/ — список всех новостей',
          '/api/news/status — статус модуля',
          '/api/news/data — сырые данные',
          '/api/news/region?name=Россия — фильтр по региону',
          '/api/news/latest — последние новости'
        ]
      }));
      return;
    }

    // === СТАТУС ===
    if (path === '/api/news/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'news',
        status: 'online',
        articles: basket.data?.articles?.length || 0,
        source: basket.source || 'demo',
        timestamp: basket.date || new Date().toISOString()
      }));
      return;
    }

    // === ДАННЫЕ ===
    if (path === '/api/news/data' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: basket.data || { articles: [] } }));
      return;
    }

    // === ФИЛЬТР ПО РЕГИОНУ ===
    if (path === '/api/news/region' && req.method === 'GET') {
      const region = url.searchParams.get('name');
      const articles = basket.data?.articles?.filter(a => a.region === region) || [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        region: region,
        articles: articles,
        total: articles.length
      }));
      return;
    }

    // === ПОСЛЕДНИЕ НОВОСТИ ===
    if (path === '/api/news/latest' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 10;
      const articles = (basket.data?.articles || []).slice(0, limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        articles: articles,
        total: articles.length,
        limit: limit
      }));
      return;
    }

    // === ЕСЛИ ПУТЬ НЕ РАСПОЗНАН ===
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: 'Неизвестный путь. Доступные эндпоинты: /api/news/, /api/news/status, /api/news/data, /api/news/region?name=, /api/news/latest'
    }));

  } catch (error) {
    console.error('[News API] Ошибка:', error.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: 'Internal Server Error: ' + error.message
    }));
  }
}

export default { handleNewsAPI };
