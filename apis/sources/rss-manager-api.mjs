#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const FEEDS_FILE = join(ROOT, 'data', 'feeds', 'feeds.opml');
const FEEDS_BACKUP = join(ROOT, 'data', 'feeds', 'feeds.opml.bak');
const STATUS_FILE = join(ROOT, 'data', 'feeds', 'feeds-status.json');

class RSSManager {
  constructor() {
    this.feeds = [];
    this.status = {};
  }

  async loadOPML() {
    try {
      const xml = await fs.readFile(FEEDS_FILE, 'utf-8');
      this.parseOPML(xml);
      await this.loadStatus();
      return this.feeds;
    } catch (e) {
      console.error('[RSS API] Ошибка загрузки OPML:', e.message);
      return [];
    }
  }

  parseOPML(xml) {
    const feeds = [];
    const feedRegex = /<outline[^>]*type="rss"[^>]*text="([^"]*)"[^>]*xmlUrl="([^"]*)"/g;
    let match;
    let currentCategory = 'Общее';
    const lines = xml.split('\n');
    for (const line of lines) {
      const categoryMatch = line.match(/<outline[^>]*text="([^"]*)"[^>]*>/);
      if (categoryMatch && !line.includes('type="rss"')) {
        currentCategory = categoryMatch[1];
      }
      const feedMatch = line.match(/<outline[^>]*type="rss"[^>]*text="([^"]*)"[^>]*xmlUrl="([^"]*)"/);
      if (feedMatch) {
        feeds.push({
          id: createHash('md5').update(feedMatch[2]).digest('hex').slice(0, 8),
          name: feedMatch[1],
          url: feedMatch[2],
          category: currentCategory,
          status: 'unknown',
          lastCheck: null,
          lastUpdate: null,
          errorCount: 0
        });
      }
    }
    this.feeds = feeds;
    return feeds;
  }

  async loadStatus() {
    try {
      const data = await fs.readFile(STATUS_FILE, 'utf-8');
      this.status = JSON.parse(data);
    } catch (e) {
      this.status = {};
    }
  }

  async saveStatus() {
    await fs.writeFile(STATUS_FILE, JSON.stringify(this.status, null, 2));
  }

  async checkFeed(url) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Crucix-RSS-Manager/1.0' },
        signal: AbortSignal.timeout(5000)
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  async addFeed(name, url, category = 'Пользовательские') {
    const exists = this.feeds.some(f => f.url === url);
    if (exists) throw new Error('Лента с таким URL уже существует');
    const newFeed = {
      id: createHash('md5').update(url).digest('hex').slice(0, 8),
      name: name.trim(),
      url: url.trim(),
      category: category.trim(),
      status: 'checking',
      lastCheck: null,
      lastUpdate: null,
      errorCount: 0
    };
    this.feeds.push(newFeed);
    await this.saveOPML();
    return newFeed;
  }

  async removeFeed(id) {
    const index = this.feeds.findIndex(f => f.id === id);
    if (index === -1) throw new Error('Лента не найдена');
    this.feeds.splice(index, 1);
    await this.saveOPML();
    delete this.status[id];
    await this.saveStatus();
    return true;
  }

  async saveOPML() {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<opml version="1.0">\n';
    xml += '  <head>\n';
    xml += '    <title>Geopolitical Reports Feeds</title>\n';
    xml += '  </head>\n';
    xml += '  <body>\n';
    const categories = {};
    for (const feed of this.feeds) {
      if (!categories[feed.category]) categories[feed.category] = [];
      categories[feed.category].push(feed);
    }
    for (const [category, feeds] of Object.entries(categories)) {
      xml += `    <outline text="${category}">\n`;
      for (const feed of feeds) {
        xml += `      <outline type="rss" text="${feed.name}" xmlUrl="${feed.url}"/>\n`;
      }
      xml += '    </outline>\n';
    }
    xml += '  </body>\n';
    xml += '</opml>\n';
    try { await fs.copyFile(FEEDS_FILE, FEEDS_BACKUP); } catch (e) {}
    await fs.writeFile(FEEDS_FILE, xml);
    return true;
  }

  async exportOPML() {
    return await fs.readFile(FEEDS_FILE, 'utf-8');
  }

  async importOPML(xml) {
    const parsed = this.parseOPML(xml);
    if (parsed.length === 0) throw new Error('Не найдено RSS-лент в файле');
    try { await fs.copyFile(FEEDS_FILE, FEEDS_BACKUP); } catch (e) {}
    await fs.writeFile(FEEDS_FILE, xml);
    this.feeds = parsed;
    await this.saveStatus();
    return parsed;
  }

  async getStats() {
    await this.loadStatus();
    let alive = 0, dead = 0;
    for (const feed of this.feeds) {
      const status = this.status[feed.id];
      if (status && status.alive) alive++;
      else if (status && !status.alive) dead++;
    }
    return { total: this.feeds.length, alive, dead, unknown: this.feeds.length - alive - dead };
  }

  async updateAllFeeds() {
    const results = [];
    let checked = 0;
    for (const feed of this.feeds) {
      checked++;
      if (checked % 10 === 0) console.log(`[RSS API] Проверено ${checked}/${this.feeds.length}`);
      const alive = await this.checkFeed(feed.url);
      this.status[feed.id] = {
        alive: alive,
        lastCheck: new Date().toISOString(),
        errorCount: alive ? 0 : (this.status[feed.id]?.errorCount || 0) + 1
      };
      results.push({ id: feed.id, name: feed.name, url: feed.url, alive });
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await this.saveStatus();
    return results;
  }
}

const rssManager = new RSSManager();

export async function handleRSSAPI(req, res) {
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

  try {
    // ============================================================
    // GET /api/rss/status — статус модуля (ДЛЯ ДИАГНОСТИКИ)
    // ============================================================
    if (path === '/api/rss/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, module: 'rss-manager', status: 'online', timestamp: new Date().toISOString() }));
      return;
    }

    if (path === '/api/rss/init') {
      await rssManager.loadOPML();
      const stats = await rssManager.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, stats, feeds: rssManager.feeds }));
      return;
    }

    if (path === '/api/rss/feeds' && req.method === 'GET') {
      await rssManager.loadOPML();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, feeds: rssManager.feeds }));
      return;
    }

    if (path === '/api/rss/feeds' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          await rssManager.loadOPML();
          const feed = await rssManager.addFeed(data.name, data.url, data.category);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, feed }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (path.startsWith('/api/rss/feeds/') && req.method === 'DELETE') {
      const id = path.split('/').pop();
      await rssManager.loadOPML();
      try {
        await rssManager.removeFeed(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
      return;
    }

    if (path === '/api/rss/update' && req.method === 'POST') {
      await rssManager.loadOPML();
      const results = await rssManager.updateAllFeeds();
      const stats = await rssManager.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, results, stats }));
      return;
    }

    if (path === '/api/rss/export' && req.method === 'GET') {
      try {
        const xml = await rssManager.exportOPML();
        res.writeHead(200, { 'Content-Type': 'application/xml', 'Content-Disposition': 'attachment; filename="feeds.opml"' });
        res.end(xml);
      } catch (e) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
      return;
    }

    if (path === '/api/rss/import' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const feeds = await rssManager.importOPML(data.xml);
          const stats = await rssManager.getStats();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, feeds, stats }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (path === '/api/rss/stats' && req.method === 'GET') {
      await rssManager.loadOPML();
      const stats = await rssManager.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, stats }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));
  } catch (error) {
    console.error('[RSS API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка', details: error.message }));
  }
}

export default rssManager;
