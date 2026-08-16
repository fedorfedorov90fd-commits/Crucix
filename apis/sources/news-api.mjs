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
    const data = await fs.readFile(BASKET_FILE, 'utf-8');
    const basket = JSON.parse(data);

    if (path === '/api/news/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'news',
        status: 'online',
        articles: basket.data.articles?.length || 0,
        source: basket.source || 'demo',
        timestamp: basket.date || new Date().toISOString()
      }));
      return;
    }

    if (path === '/api/news/data' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: basket.data }));
      return;
    }

    // Фильтр по региону
    if (path === '/api/news/region' && req.method === 'GET') {
      const region = url.searchParams.get('name');
      const articles = basket.data.articles?.filter(a => a.region === region) || [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, articles }));
      return;
    }

  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: 'Нет данных. Запустите: node scripts/collect-news.mjs'
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));
}

export default { handleNewsAPI };
