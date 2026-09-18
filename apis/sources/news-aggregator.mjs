#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №43: УНИВЕРСАЛЬНЫЙ НОВОСТНОЙ АГРЕГАТОР
// ============================================================
// Сбор новостей из ТАСС и других источников
// Расширяемая архитектура — добавление новых источников через конфигурацию
// Единый формат данных для всех источников
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'news-aggregator');
const NEWS_FILE = join(DATA_DIR, 'news.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ ИСТОЧНИКОВ (РАСШИРЯЕМАЯ)
// ============================================================

// Здесь добавляются новые источники
const SOURCES = {
  tass: {
    id: 'tass',
    name: 'ТАСС',
    icon: '📰',
    color: '#3b82f6',
    enabled: true,
    priority: 1,
    description: 'Официальное информационное агентство России'
  },
  ria: {
    id: 'ria',
    name: 'РИА Новости',
    icon: '📡',
    color: '#ef4444',
    enabled: false, // Отключён, но готов к включению
    priority: 2,
    description: 'Российское государственное информационное агентство'
  },
  interfax: {
    id: 'interfax',
    name: 'Интерфакс',
    icon: '📊',
    color: '#f59e0b',
    enabled: false,
    priority: 3,
    description: 'Независимое информационное агентство'
  },
  // ДОБАВЛЯЙ НОВЫЕ ИСТОЧНИКИ СЮДА:
  // my_source: {
  //   id: 'my_source',
  //   name: 'Мой источник',
  //   icon: '📌',
  //   color: '#22c55e',
  //   enabled: true,
  //   priority: 4,
  //   description: 'Описание источника'
  // }
};

const CATEGORIES = [
  'Политика', 'Экономика', 'Бизнес', 'Технологии',
  'Наука', 'Культура', 'Спорт', 'Происшествия',
  'Международные', 'Региональные', 'Оборона'
];

const REGIONS = [
  'Москва', 'Санкт-Петербург', 'Центральный', 'Сибирь',
  'Урал', 'Дальний Восток', 'Кавказ', 'Крым',
  'Международные'
];

// ============================================================
// 2. КЛАСС АГРЕГАТОРА
// ============================================================

class NewsAggregator {
  constructor() {
    this.news = [];
    this.history = [];
    this.sources = SOURCES;
  }

  async init() {
    await this.ensureDirs();
    await this.loadNews();
    await this.loadHistory();
    console.log('[News Aggregator] Инициализирован');
    console.log(`[News Aggregator] Активных источников: ${Object.values(this.sources).filter(s => s.enabled).length}`);
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadNews() {
    try {
      const data = await fs.readFile(NEWS_FILE, 'utf-8');
      this.news = JSON.parse(data);
    } catch (e) {
      this.news = [];
    }
  }

  async saveNews() {
    await fs.writeFile(NEWS_FILE, JSON.stringify(this.news, null, 2));
  }

  async loadHistory() {
    try {
      const data = await fs.readFile(HISTORY_FILE, 'utf-8');
      this.history = JSON.parse(data);
    } catch (e) {
      this.history = [];
    }
  }

  async saveHistory() {
    await fs.writeFile(HISTORY_FILE, JSON.stringify(this.history, null, 2));
  }

  // ============================================================
  // 2.1. СБОР НОВОСТЕЙ ИЗ ВСЕХ ИСТОЧНИКОВ
  // ============================================================

  async collectNews() {
    const allNews = [];
    const enabledSources = Object.values(this.sources).filter(s => s.enabled);

    for (const source of enabledSources) {
      console.log(`[News Aggregator] Сбор из источника: ${source.name}`);
      const news = await this.collectFromSource(source);
      allNews.push(...news);
    }

    // Сортируем по дате
    allNews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    this.news = allNews;
    await this.saveNews();
    return allNews;
  }

  // ============================================================
  // 2.2. СБОР ИЗ КОНКРЕТНОГО ИСТОЧНИКА
  // ============================================================

  async collectFromSource(source) {
    // Демо-данные для ТАСС
    const tassNews = [
      { title: 'Путин провёл совещание по экономике', category: 'Политика', region: 'Москва', importance: 'high' },
      { title: 'ЦБ сохранил ключевую ставку на уровне 16%', category: 'Экономика', region: 'Москва', importance: 'high' },
      { title: 'Россия и Китай подписали соглашение о сотрудничестве', category: 'Международные', region: 'Международные', importance: 'medium' },
      { title: 'Запущен новый спутник системы ГЛОНАСС', category: 'Технологии', region: 'Центральный', importance: 'medium' },
      { title: 'В Госдуме обсуждают закон о цифровых активах', category: 'Политика', region: 'Москва', importance: 'medium' },
      { title: 'Российские учёные разработали новый материал', category: 'Наука', region: 'Центральный', importance: 'low' },
      { title: 'Открылась международная выставка технологий', category: 'Технологии', region: 'Москва', importance: 'low' },
      { title: 'Минфин обновил бюджетный прогноз', category: 'Экономика', region: 'Москва', importance: 'high' },
      { title: 'Россия и Индия расширяют торговое сотрудничество', category: 'Международные', region: 'Международные', importance: 'medium' },
      { title: 'Завершено строительство нового энергоблока', category: 'Экономика', region: 'Сибирь', importance: 'medium' }
    ];

    // Генерируем новости для каждого источника
    const news = [];
    const now = new Date();

    for (let i = 0; i < tassNews.length; i++) {
      const item = tassNews[i];
      const date = new Date(now);
      date.setHours(date.getHours() - i * 2 - Math.floor(Math.random() * 3));

      news.push({
        id: `${source.id}-${Date.now()}-${i}`,
        source: source.id,
        sourceName: source.name,
        sourceIcon: source.icon,
        sourceColor: source.color,
        title: item.title,
        category: item.category,
        region: item.region,
        importance: item.importance,
        timestamp: date.toISOString(),
        url: `https://tass.ru/${i}`,
        summary: `Краткое содержание: ${item.title}`,
        read: false,
        saved: false
      });
    }

    return news;
  }

  // ============================================================
  // 2.3. ДОБАВЛЕНИЕ НОВОГО ИСТОЧНИКА
  // ============================================================

  addSource(sourceConfig) {
    if (this.sources[sourceConfig.id]) {
      throw new Error(`Источник ${sourceConfig.id} уже существует`);
    }
    this.sources[sourceConfig.id] = {
      ...sourceConfig,
      enabled: sourceConfig.enabled !== undefined ? sourceConfig.enabled : true
    };
    return this.sources[sourceConfig.id];
  }

  toggleSource(sourceId) {
    if (!this.sources[sourceId]) {
      throw new Error(`Источник ${sourceId} не найден`);
    }
    this.sources[sourceId].enabled = !this.sources[sourceId].enabled;
    return this.sources[sourceId];
  }

  // ============================================================
  // 2.4. СТАТИСТИКА
  // ============================================================

  getStats() {
    const bySource = {};
    const byCategory = {};
    const byRegion = {};
    const byImportance = { high: 0, medium: 0, low: 0 };
    const activeSources = Object.values(this.sources).filter(s => s.enabled).length;

    for (const item of this.news) {
      bySource[item.sourceName] = (bySource[item.sourceName] || 0) + 1;
      byCategory[item.category] = (byCategory[item.category] || 0) + 1;
      byRegion[item.region] = (byRegion[item.region] || 0) + 1;
      byImportance[item.importance] = (byImportance[item.importance] || 0) + 1;
    }

    return {
      totalNews: this.news.length,
      activeSources: activeSources,
      totalSources: Object.keys(this.sources).length,
      bySource: bySource,
      byCategory: byCategory,
      byRegion: byRegion,
      byImportance: byImportance,
      lastUpdate: new Date().toISOString()
    };
  }

  async updateAll() {
    console.log('[News Aggregator] Сбор новостей...');
    const news = await this.collectNews();

    const result = {
      timestamp: new Date().toISOString(),
      news: news,
      stats: this.getStats(),
      summary: this.generateSummary(news)
    };

    this.history.push(result);
    if (this.history.length > 100) this.history = this.history.slice(-100);
    await this.saveHistory();

    console.log(`[News Aggregator] Готово. Собрано ${news.length} новостей.`);
    return result;
  }

  generateSummary(news) {
    const high = news.filter(n => n.importance === 'high');
    const bySource = {};

    for (const item of news) {
      bySource[item.sourceName] = (bySource[item.sourceName] || 0) + 1;
    }

    let summary = '📰 НОВОСТНОЙ АГРЕГАТОР\n\n';
    summary += `Всего новостей: ${news.length}\n`;
    summary += `Важных: ${high.length}\n\n`;
    
    summary += '--- ПО ИСТОЧНИКАМ ---\n';
    for (const [source, count] of Object.entries(bySource)) {
      summary += `${source}: ${count}\n`;
    }

    if (high.length > 0) {
      summary += '\n--- ВАЖНЫЕ НОВОСТИ ---\n';
      for (const item of high.slice(0, 5)) {
        summary += `🔴 ${item.title} (${item.sourceName})\n`;
      }
    }

    return summary;
  }

  getLatest() {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  getHistory(limit = 30) {
    return this.history.slice(-limit);
  }

  getNews() {
    return this.news;
  }

  getSources() {
    return this.sources;
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let aggregator = null;

async function getAggregator() {
  if (!aggregator) {
    aggregator = new NewsAggregator();
    await aggregator.init();
  }
  return aggregator;
}

export async function handleNewsAggregatorAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    const aggregator = await getAggregator();

    // ============================================================
    // GET /api/news-aggregator/status
    // ============================================================
    if (path === '/api/news-aggregator/status' && req.method === 'GET') {
      const stats = aggregator.getStats();
      const sources = aggregator.getSources();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'news-aggregator',
        status: 'online',
        stats: stats,
        sources: sources,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // POST /api/news-aggregator/update
    // ============================================================
    if (path === '/api/news-aggregator/update' && req.method === 'POST') {
      const result = await aggregator.updateAll();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        result: result,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // GET /api/news-aggregator/latest
    // ============================================================
    if (path === '/api/news-aggregator/latest' && req.method === 'GET') {
      const latest = aggregator.getLatest();
      if (latest) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, result: latest }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Данных пока нет' }));
      }
      return;
    }

    // ============================================================
    // GET /api/news-aggregator/news
    // ============================================================
    if (path === '/api/news-aggregator/news' && req.method === 'GET') {
      const news = aggregator.getNews();
      const limit = parseInt(url.searchParams.get('limit')) || 50;
      const source = url.searchParams.get('source');
      const category = url.searchParams.get('category');
      const importance = url.searchParams.get('importance');

      let filtered = news;
      if (source) filtered = filtered.filter(n => n.source === source);
      if (category) filtered = filtered.filter(n => n.category === category);
      if (importance) filtered = filtered.filter(n => n.importance === importance);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        total: filtered.length,
        news: filtered.slice(0, limit)
      }));
      return;
    }

    // ============================================================
    // GET /api/news-aggregator/sources
    // ============================================================
    if (path === '/api/news-aggregator/sources' && req.method === 'GET') {
      const sources = aggregator.getSources();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, sources }));
      return;
    }

    // ============================================================
    // POST /api/news-aggregator/sources
    // ============================================================
    if (path === '/api/news-aggregator/sources' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const source = aggregator.addSource(data);
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
    // PUT /api/news-aggregator/sources/:id/toggle
    // ============================================================
    if (path.startsWith('/api/news-aggregator/sources/') && path.endsWith('/toggle') && req.method === 'PUT') {
      const id = path.split('/')[4];
      try {
        const source = aggregator.toggleSource(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, source }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[News Aggregator API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleNewsAggregatorAPI, NewsAggregator };
