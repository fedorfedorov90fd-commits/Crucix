#!/usr/bin/env node

// ============================================================
// TRUST-API.MJS — Оценка качества и доверия к источникам
// ============================================================
// Модуль №25: Система рейтинга источников данных
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const TRUST_FILE = join(ROOT, 'data', 'trust', 'sources.json');
const HISTORY_FILE = join(ROOT, 'data', 'trust', 'history.json');

// ============================================================
// 1. ПРЕДУСТАНОВЛЕННЫЕ ИСТОЧНИКИ
// ============================================================

const DEFAULT_SOURCES = [
  // 🔵 МЕЖДУНАРОДНЫЕ АГЕНТСТВА (высокое доверие)
  { id: 'reuters', name: 'Reuters', category: 'Международные', trust: 95, credibility: 95, speed: 90, objectivity: 92, authority: 98, accuracy: 95, notes: 'Золотой стандарт новостей', enabled: true },
  { id: 'ap', name: 'Associated Press', category: 'Международные', trust: 92, credibility: 93, speed: 88, objectivity: 90, authority: 96, accuracy: 93, notes: 'Крупнейшее мировое агентство', enabled: true },
  { id: 'bbc', name: 'BBC News', category: 'Международные', trust: 90, credibility: 91, speed: 85, objectivity: 88, authority: 94, accuracy: 90, notes: 'Государственная, но независимая', enabled: true },
  { id: 'aljazeera', name: 'Al Jazeera', category: 'Международные', trust: 85, credibility: 86, speed: 82, objectivity: 84, authority: 88, accuracy: 85, notes: 'Катарский медиагигант', enabled: true },
  { id: 'france24', name: 'France 24', category: 'Международные', trust: 82, credibility: 83, speed: 80, objectivity: 82, authority: 86, accuracy: 82, notes: 'Французский государственный', enabled: true },
  { id: 'dw', name: 'Deutsche Welle', category: 'Международные', trust: 80, credibility: 81, speed: 78, objectivity: 80, authority: 84, accuracy: 80, notes: 'Немецкий государственный', enabled: true },

  // 🟢 РОССИЙСКИЕ ИСТОЧНИКИ (среднее доверие)
  { id: 'tass', name: 'ТАСС', category: 'Российские', trust: 75, credibility: 76, speed: 70, objectivity: 72, authority: 80, accuracy: 76, notes: 'Государственное агентство', enabled: true },
  { id: 'ria', name: 'РИА Новости', category: 'Российские', trust: 70, credibility: 71, speed: 68, objectivity: 68, authority: 76, accuracy: 70, notes: 'Государственное СМИ', enabled: true },
  { id: 'interfax', name: 'Интерфакс', category: 'Российские', trust: 72, credibility: 73, speed: 66, objectivity: 70, authority: 74, accuracy: 72, notes: 'Независимое агентство', enabled: true },
  { id: 'kommersant', name: 'Коммерсантъ', category: 'Российские', trust: 68, credibility: 69, speed: 64, objectivity: 66, authority: 72, accuracy: 68, notes: 'Деловая газета', enabled: true },
  { id: 'lenta', name: 'Lenta.ru', category: 'Российские', trust: 65, credibility: 66, speed: 62, objectivity: 64, authority: 70, accuracy: 65, notes: 'Интернет-издание', enabled: true },

  // 🟡 АНАЛИТИЧЕСКИЕ ЦЕНТРЫ (высокое доверие)
  { id: 'carnegie', name: 'Carnegie Endowment', category: 'Аналитические', trust: 88, credibility: 89, speed: 75, objectivity: 86, authority: 92, accuracy: 88, notes: 'Ведущий аналитический центр', enabled: true },
  { id: 'cfr', name: 'Council on Foreign Relations', category: 'Аналитические', trust: 87, credibility: 88, speed: 74, objectivity: 85, authority: 90, accuracy: 87, notes: 'Влиятельный совет по международным отношениям', enabled: true },
  { id: 'chatham', name: 'Chatham House', category: 'Аналитические', trust: 86, credibility: 87, speed: 73, objectivity: 84, authority: 88, accuracy: 86, notes: 'Королевский институт', enabled: true },
  { id: 'isw', name: 'ISW', category: 'Аналитические', trust: 84, credibility: 85, speed: 78, objectivity: 82, authority: 86, accuracy: 84, notes: 'Институт изучения войны', enabled: true },

  // 🟠 ЭНЕРГЕТИКА И ЭКОНОМИКА
  { id: 'bloomberg', name: 'Bloomberg', category: 'Экономика', trust: 88, credibility: 89, speed: 86, objectivity: 84, authority: 90, accuracy: 88, notes: 'Финансовый гигант', enabled: true },
  { id: 'ft', name: 'Financial Times', category: 'Экономика', trust: 87, credibility: 88, speed: 84, objectivity: 86, authority: 88, accuracy: 87, notes: 'Британская деловая газета', enabled: true },
  { id: 'wsj', name: 'Wall Street Journal', category: 'Экономика', trust: 86, credibility: 87, speed: 84, objectivity: 82, authority: 88, accuracy: 86, notes: 'Американская деловая газета', enabled: true },

  // 🟣 СПЕЦИАЛИЗИРОВАННЫЕ
  { id: 'noaa', name: 'NOAA', category: 'Погода', trust: 90, credibility: 92, speed: 80, objectivity: 90, authority: 94, accuracy: 92, notes: 'Погодное агентство США', enabled: true },
  { id: 'usgs', name: 'USGS', category: 'Наука', trust: 92, credibility: 94, speed: 78, objectivity: 92, authority: 96, accuracy: 94, notes: 'Геологическая служба США', enabled: true },
  { id: 'who', name: 'WHO', category: 'Здравоохранение', trust: 88, credibility: 90, speed: 76, objectivity: 88, authority: 92, accuracy: 90, notes: 'Всемирная организация здравоохранения', enabled: true },
  { id: 'eia', name: 'EIA', category: 'Энергетика', trust: 85, credibility: 87, speed: 74, objectivity: 86, authority: 90, accuracy: 87, notes: 'Энергетическая информация США', enabled: true },

  // 🔴 НИЗКОЕ ДОВЕРИЕ
  { id: 'rt', name: 'RT', category: 'Пропаганда', trust: 45, credibility: 46, speed: 40, objectivity: 30, authority: 60, accuracy: 45, notes: 'Официальный пропагандистский канал', enabled: true },
  { id: 'sputnik', name: 'Sputnik', category: 'Пропаганда', trust: 40, credibility: 41, speed: 38, objectivity: 28, authority: 55, accuracy: 40, notes: 'Пропагандистский ресурс', enabled: true }
];

// ============================================================
// 2. КЛАСС УПРАВЛЕНИЯ ДОВЕРИЕМ
// ============================================================

class TrustManager {
  constructor() {
    this.sources = [];
    this.history = [];
  }

  async loadSources() {
    try {
      const data = await fs.readFile(TRUST_FILE, 'utf-8');
      this.sources = JSON.parse(data);
      return this.sources;
    } catch (e) {
      this.sources = JSON.parse(JSON.stringify(DEFAULT_SOURCES));
      await this.saveSources();
      return this.sources;
    }
  }

  async saveSources() {
    const dir = join(ROOT, 'data', 'trust');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(TRUST_FILE, JSON.stringify(this.sources, null, 2));
  }

  async loadHistory() {
    try {
      const data = await fs.readFile(HISTORY_FILE, 'utf-8');
      this.history = JSON.parse(data);
      return this.history;
    } catch (e) {
      this.history = [];
      await this.saveHistory();
      return this.history;
    }
  }

  async saveHistory() {
    const dir = join(ROOT, 'data', 'trust');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(HISTORY_FILE, JSON.stringify(this.history, null, 2));
  }

  getSource(id) {
    return this.sources.find(s => s.id === id);
  }

  async updateSource(id, updates) {
    const source = this.getSource(id);
    if (!source) throw new Error(`Источник "${id}" не найден`);
    
    // Сохраняем историю изменений
    const oldTrust = source.trust;
    Object.assign(source, updates);
    
    // Если изменился рейтинг — записываем в историю
    if (updates.trust !== undefined && updates.trust !== oldTrust) {
      await this.addHistory(id, oldTrust, updates.trust);
    }
    
    await this.saveSources();
    return source;
  }

  async addHistory(sourceId, oldValue, newValue) {
    await this.loadHistory();
    this.history.push({
      sourceId,
      oldValue,
      newValue,
      date: new Date().toISOString()
    });
    // Оставляем только последние 100 записей
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }
    await this.saveHistory();
  }

  getStats() {
    const total = this.sources.length;
    const enabled = this.sources.filter(s => s.enabled).length;
    const high = this.sources.filter(s => s.trust >= 80).length;
    const medium = this.sources.filter(s => s.trust >= 60 && s.trust < 80).length;
    const low = this.sources.filter(s => s.trust < 60).length;
    const avgTrust = Math.round(this.sources.reduce((sum, s) => sum + s.trust, 0) / total);

    return { total, enabled, high, medium, low, avgTrust };
  }

  // Получить источники по категории
  getByCategory(category) {
    return this.sources.filter(s => s.category === category);
  }

  // Получить все категории
  getCategories() {
    const cats = new Set();
    for (const s of this.sources) {
      if (s.category) cats.add(s.category);
    }
    return Array.from(cats).sort();
  }

  // Получить рейтинг источника по ID
  getTrust(id) {
    const source = this.getSource(id);
    return source ? source.trust : 50; // По умолчанию 50
  }

  // Получить несколько источников по списку ID
  getTrusts(ids) {
    const result = {};
    for (const id of ids) {
      result[id] = this.getTrust(id);
    }
    return result;
  }

  // Рассчитать средний рейтинг для группы источников
  getAverageTrust(ids) {
    let total = 0;
    let count = 0;
    for (const id of ids) {
      const t = this.getTrust(id);
      if (t) { total += t; count++; }
    }
    return count > 0 ? Math.round(total / count) : 50;
  }

  // Только надёжные источники (trust >= 70)
  getReliable() {
    return this.sources.filter(s => s.trust >= 70 && s.enabled);
  }

  // Только очень надёжные (trust >= 85)
  getVeryReliable() {
    return this.sources.filter(s => s.trust >= 85 && s.enabled);
  }
}

const trustManager = new TrustManager();

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleTrustAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  await trustManager.loadSources();

  // ============================================================
  // GET /api/trust/sources — все источники
  // ============================================================
  if (path === '/api/trust/sources' && req.method === 'GET') {
    const category = url.searchParams.get('category');
    let sources = trustManager.sources;
    if (category) {
      sources = sources.filter(s => s.category === category);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      sources,
      stats: trustManager.getStats(),
      categories: trustManager.getCategories()
    }));
    return;
  }

  // ============================================================
  // GET /api/trust/source/:id — получить источник
  // ============================================================
  if (path.startsWith('/api/trust/source/') && req.method === 'GET') {
    const id = path.split('/').pop();
    const source = trustManager.getSource(id);
    if (!source) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Источник не найден' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, source }));
    return;
  }

  // ============================================================
  // PUT /api/trust/source/:id — обновить источник
  // ============================================================
  if (path.startsWith('/api/trust/source/') && req.method === 'PUT') {
    const id = path.split('/').pop();
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const updates = JSON.parse(body);
        const source = await trustManager.updateSource(id, updates);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, source }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // ============================================================
  // POST /api/trust/toggle/:id — включить/выключить источник
  // ============================================================
  if (path.startsWith('/api/trust/toggle/') && req.method === 'POST') {
    const id = path.split('/').pop();
    try {
      const source = trustManager.getSource(id);
      if (!source) throw new Error('Источник не найден');
      source.enabled = !source.enabled;
      await trustManager.saveSources();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, source }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // ============================================================
  // GET /api/trust/stats — статистика
  // ============================================================
  if (path === '/api/trust/stats' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      stats: trustManager.getStats(),
      categories: trustManager.getCategories()
    }));
    return;
  }

  // ============================================================
  // GET /api/trust/trust/:id — получить рейтинг источника
  // ============================================================
  if (path.startsWith('/api/trust/trust/') && req.method === 'GET') {
    const id = path.split('/').pop();
    const trust = trustManager.getTrust(id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, trust }));
    return;
  }

  // ============================================================
  // POST /api/trust/trusts — получить рейтинг нескольких источников
  // ============================================================
  if (path === '/api/trust/trusts' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { ids } = JSON.parse(body);
        const trusts = trustManager.getTrusts(ids);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, trusts }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // ============================================================
  // GET /api/trust/reliable — только надёжные источники
  // ============================================================
  if (path === '/api/trust/reliable' && req.method === 'GET') {
    const reliable = trustManager.getReliable();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, sources: reliable }));
    return;
  }

  // ============================================================
  // GET /api/trust/very-reliable — только очень надёжные
  // ============================================================
  if (path === '/api/trust/very-reliable' && req.method === 'GET') {
    const reliable = trustManager.getVeryReliable();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, sources: reliable }));
    return;
  }

  // ============================================================
  // GET /api/trust/categories — все категории
  // ============================================================
  if (path === '/api/trust/categories' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      categories: trustManager.getCategories()
    }));
    return;
  }

  // ============================================================
  // GET /api/trust/history — история изменений
  // ============================================================
  if (path === '/api/trust/history' && req.method === 'GET') {
    await trustManager.loadHistory();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      history: trustManager.history
    }));
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));
}

export default trustManager;