// API для работы с Единой корзиной данных

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(ROOT, 'data', 'basket');

// Убедимся, что папка существует
await fs.mkdir(BASKET_DIR, { recursive: true });

class BasketAPI {
  constructor() {
    this.items = [];
    this.cache = null;
    this.cacheTime = 0;
    this.cacheTTL = 60000; // 1 минута
  }

  // Получить все новости
  async getAll() {
    if (this.cache && (Date.now() - this.cacheTime) < this.cacheTTL) {
      return this.cache;
    }

    try {
      const files = await fs.readdir(BASKET_DIR);
      const items = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(join(BASKET_DIR, file), 'utf-8');
          try {
            const data = JSON.parse(content);
            items.push(data);
          } catch (e) {
            console.error(`[Basket] Ошибка парсинга ${file}:`, e.message);
          }
        }
      }

      items.sort((a, b) => new Date(b.collectedAt) - new Date(a.collectedAt));
      this.cache = items;
      this.cacheTime = Date.now();
      return items;
    } catch (e) {
      console.error('[Basket] Ошибка загрузки:', e.message);
      return [];
    }
  }

  // Добавить новость
  async add(item) {
    if (!item.id) {
      item.id = `news_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    if (!item.collectedAt) {
      item.collectedAt = new Date().toISOString();
    }

    const filepath = join(BASKET_DIR, `${item.id}.json`);
    await fs.writeFile(filepath, JSON.stringify(item, null, 2));
    this.cache = null;

    console.log(`[Basket] Добавлена новость: ${item.id} — ${item.title?.slice(0, 50)}...`);
    return item;
  }

  // Добавить несколько новостей
  async addMany(items) {
    const results = [];
    for (const item of items) {
      try {
        const result = await this.add(item);
        results.push({ success: true, item: result });
      } catch (e) {
        results.push({ success: false, error: e.message });
      }
    }
    return results;
  }

  // Получить новость по ID
  async get(id) {
    const filepath = join(BASKET_DIR, `${id}.json`);
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      return null;
    }
  }

  // Удалить новость
  async delete(id) {
    const filepath = join(BASKET_DIR, `${id}.json`);
    try {
      await fs.unlink(filepath);
      this.cache = null;
      return true;
    } catch (e) {
      return false;
    }
  }

  // Очистить старые новости
  async cleanOld(days = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const items = await this.getAll();
    let deleted = 0;

    for (const item of items) {
      const date = new Date(item.collectedAt);
      if (date < cutoff) {
        const success = await this.delete(item.id);
        if (success) deleted++;
      }
    }
    return deleted;
  }

  // Получить статистику
  async getStats() {
    const items = await this.getAll();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const todayCount = items.filter(i => i.collectedAt?.startsWith(today)).length;

    const sources = {};
    for (const item of items) {
      const source = item.source || 'unknown';
      sources[source] = (sources[source] || 0) + 1;
    }

    return {
      total: items.length,
      today: todayCount,
      sources: sources,
      oldest: items.length > 0 ? items[items.length - 1]?.collectedAt : null,
      newest: items.length > 0 ? items[0]?.collectedAt : null,
    };
  }
}

const basket = new BasketAPI();

// HTTP-обработчик
export async function handleBasketAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // GET /api/basket
  if (path === '/api/basket' && req.method === 'GET') {
    const limit = parseInt(url.searchParams.get('limit')) || 100;
    const items = await basket.getAll();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, items: items.slice(0, limit), total: items.length }));
    return;
  }

  // GET /api/basket/stats
  if (path === '/api/basket/stats' && req.method === 'GET') {
    const stats = await basket.getStats();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, stats }));
    return;
  }

  // POST /api/basket
  if (path === '/api/basket' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const item = await basket.add(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, item }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // DELETE /api/basket/:id
  if (path.startsWith('/api/basket/') && req.method === 'DELETE') {
    const id = path.split('/').pop();
    const success = await basket.delete(id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success }));
    return;
  }

  // POST /api/basket/clean
  if (path === '/api/basket/clean' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const days = data.days || 30;
        const deleted = await basket.cleanOld(days);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, deleted, days }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));
}

export default basket;
