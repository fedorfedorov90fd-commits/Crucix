#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №49: ДЕТЕКТОР СКРЫТЫХ СВЯЗЕЙ
// MODULE №49: HIDDEN LINK DETECTOR
// ============================================================
// Анализирует все новости и события, находит неочевидные связи
// Строит граф связей между событиями
// Визуализация в виде интерактивного графа
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'links');
const LINKS_FILE = join(DATA_DIR, 'links.json');
const GRAPH_FILE = join(DATA_DIR, 'graph.json');
const CACHE_FILE = join(DATA_DIR, 'cache.json');

// ============================================================
// 1. КЛАСС ДЕТЕКТОРА СВЯЗЕЙ
// ============================================================

class HiddenLinkDetector {
  constructor() {
    this.events = [];
    this.links = [];
    this.graph = { nodes: [], edges: [] };
    this.cache = {};
  }

  async init() {
    await this.ensureDirs();
    await this.loadCache();
    await this.loadGraph();
    console.log('[Hidden Links] Инициализирован');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadCache() {
    try {
      const data = await fs.readFile(CACHE_FILE, 'utf-8');
      this.cache = JSON.parse(data);
    } catch (e) {
      this.cache = {};
    }
  }

  async saveCache() {
    await fs.writeFile(CACHE_FILE, JSON.stringify(this.cache, null, 2));
  }

  async loadGraph() {
    try {
      const data = await fs.readFile(GRAPH_FILE, 'utf-8');
      this.graph = JSON.parse(data);
    } catch (e) {
      this.graph = { nodes: [], edges: [] };
    }
  }

  async saveGraph() {
    await fs.writeFile(GRAPH_FILE, JSON.stringify(this.graph, null, 2));
  }

  // ============================================================
  // 1.1. СБОР СОБЫТИЙ ИЗ РАЗНЫХ ИСТОЧНИКОВ
  // ============================================================

  async collectEvents() {
    const events = [];

    // 1. Из корзины данных (basket)
    try {
      const basketDir = join(ROOT, 'data', 'basket');
      const files = await fs.readdir(basketDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(join(basketDir, file), 'utf-8');
          const items = JSON.parse(data);
          for (const item of items) {
            events.push({
              id: item.id || `basket-${Date.now()}-${Math.random()}`,
              title: item.title || '',
              description: item.description || '',
              source: item.source || 'basket',
              date: item.date || item.addedAt || new Date().toISOString(),
              category: item.ai?.categories?.[0] || item.category || 'general',
              type: 'news'
            });
          }
        }
      }
    } catch (e) {}

    // 2. Из RSS (сырые данные)
    try {
      const rawDir = join(ROOT, 'data', 'raw');
      const files = await fs.readdir(rawDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(join(rawDir, file), 'utf-8');
          const items = JSON.parse(data);
          for (const item of items) {
            events.push({
              id: item.id || `raw-${Date.now()}-${Math.random()}`,
              title: item.title || '',
              description: item.description || '',
              source: item.source || 'rss',
              date: item.date || new Date().toISOString(),
              category: item.category || 'general',
              type: 'rss'
            });
          }
        }
      }
    } catch (e) {}

    // 3. Из истории индекса
    try {
      const historyFile = join(ROOT, 'data', 'geo', 'index-history.json');
      const data = await fs.readFile(historyFile, 'utf-8');
      const history = JSON.parse(data);
      for (const item of history) {
        events.push({
          id: `index-${item.date}`,
          title: `Индекс напряжённости: ${item.value}`,
          description: `Значение индекса: ${item.value}, изменение: ${item.change || 0}`,
          source: 'global-index',
          date: item.date,
          category: 'geopolitics',
          type: 'index',
          value: item.value
        });
      }
    } catch (e) {}

    this.events = events;
    return events;
  }

  // ============================================================
  // 1.2. ПОИСК СВЯЗЕЙ МЕЖДУ СОБЫТИЯМИ
  // ============================================================

  async findLinks() {
    const links = [];
    const events = this.events;

    // Ограничиваем количество для производительности
    const maxEvents = Math.min(events.length, 200);
    const recentEvents = events.slice(-maxEvents);

    for (let i = 0; i < recentEvents.length; i++) {
      for (let j = i + 1; j < recentEvents.length; j++) {
        const a = recentEvents[i];
        const b = recentEvents[j];

        // Пропускаем если слишком далеко по времени (> 7 дней)
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        const daysDiff = Math.abs((dateA - dateB) / (1000 * 60 * 60 * 24));
        if (daysDiff > 7) continue;

        const strength = this.calculateLinkStrength(a, b);
        if (strength > 0.3) {
          links.push({
            source: a.id,
            target: b.id,
            strength: strength,
            type: this.getLinkType(a, b),
            date: new Date().toISOString()
          });
        }
      }
    }

    this.links = links;
    return links;
  }

  // ============================================================
  // 1.3. РАСЧЁТ СИЛЫ СВЯЗИ
  // ============================================================

  calculateLinkStrength(a, b) {
    let score = 0;

    // 1. Общие ключевые слова
    const wordsA = (a.title + ' ' + a.description).toLowerCase().split(/\s+/);
    const wordsB = (b.title + ' ' + b.description).toLowerCase().split(/\s+/);
    const common = wordsA.filter(w => w.length > 3 && wordsB.includes(w));
    score += common.length * 0.05;

    // 2. Одинаковая категория
    if (a.category === b.category) score += 0.15;

    // 3. Одинаковый источник
    if (a.source === b.source) score += 0.05;

    // 4. Близость во времени (чем ближе, тем выше)
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    const hoursDiff = Math.abs((dateA - dateB) / (1000 * 60 * 60));
    if (hoursDiff < 24) score += 0.2;
    else if (hoursDiff < 48) score += 0.1;
    else if (hoursDiff < 72) score += 0.05;

    // 5. Общие теги (если есть)
    const tagsA = a.tags || [];
    const tagsB = b.tags || [];
    const commonTags = tagsA.filter(t => tagsB.includes(t));
    score += commonTags.length * 0.1;

    return Math.min(score, 1);
  }

  getLinkType(a, b) {
    if (a.category === b.category) return 'same-category';
    if (a.source === b.source) return 'same-source';
    if (a.type === b.type) return 'same-type';
    return 'cross';
  }

  // ============================================================
  // 1.4. ПОСТРОЕНИЕ ГРАФА
  // ============================================================

  buildGraph() {
    const nodes = [];
    const edges = [];
    const nodeMap = {};

    // Узлы = события
    for (const event of this.events) {
      if (!nodeMap[event.id]) {
        const size = event.value ? Math.min(Math.abs(event.value) * 2 + 3, 20) : 8;
        nodeMap[event.id] = {
          id: event.id,
          label: event.title.slice(0, 30) + (event.title.length > 30 ? '...' : ''),
          category: event.category || 'general',
          source: event.source || 'unknown',
          date: event.date,
          size: size,
          color: this.getCategoryColor(event.category)
        };
        nodes.push(nodeMap[event.id]);
      }
    }

    // Рёбра = связи
    for (const link of this.links) {
      if (nodeMap[link.source] && nodeMap[link.target]) {
        edges.push({
          source: link.source,
          target: link.target,
          strength: link.strength,
          type: link.type
        });
      }
    }

    this.graph = { nodes, edges };
    this.saveGraph();
    return this.graph;
  }

  // ============================================================
  // 1.5. ЦВЕТА ПО КАТЕГОРИЯМ
  // ============================================================

  getCategoryColor(category) {
    const colors = {
      'geopolitics': '#ef4444',
      'economy': '#f97316',
      'energy': '#eab308',
      'military': '#dc2626',
      'technology': '#3b82f6',
      'health': '#22c55e',
      'environment': '#14b8a6',
      'general': '#6b7280',
      'conflict': '#ef4444',
      'diplomacy': '#8b5cf6',
      'finance': '#f59e0b'
    };
    return colors[category] || '#6b7280';
  }

  // ============================================================
  // 1.6. СТАТИСТИКА
  // ============================================================

  getStats() {
    return {
      totalEvents: this.events.length,
      totalLinks: this.links.length,
      nodes: this.graph.nodes.length,
      edges: this.graph.edges.length,
      categories: this.getCategoryStats()
    };
  }

  getCategoryStats() {
    const stats = {};
    for (const node of this.graph.nodes) {
      stats[node.category] = (stats[node.category] || 0) + 1;
    }
    return stats;
  }

  // ============================================================
  // 1.7. ПОИСК АНОМАЛИЙ (самые сильные связи)
  // ============================================================

  getTopLinks(limit = 10) {
    return this.links
      .sort((a, b) => b.strength - a.strength)
      .slice(0, limit)
      .map(link => {
        const source = this.events.find(e => e.id === link.source);
        const target = this.events.find(e => e.id === link.target);
        return {
          source: source?.title || link.source,
          target: target?.title || link.target,
          strength: link.strength,
          type: link.type
        };
      });
  }

  // ============================================================
  // 1.8. ОБНОВЛЕНИЕ ВСЕХ ДАННЫХ
  // ============================================================

  async update() {
    console.log('[Hidden Links] Сбор событий...');
    await this.collectEvents();

    console.log('[Hidden Links] Поиск связей...');
    await this.findLinks();

    console.log('[Hidden Links] Построение графа...');
    this.buildGraph();

    console.log('[Hidden Links] Готово!');
    return this.getStats();
  }
}

// ============================================================
// 2. HTTP-ОБРАБОТЧИК
// ============================================================

let detector = null;

async function getDetector() {
  if (!detector) {
    detector = new HiddenLinkDetector();
    await detector.init();
  }
  return detector;
}

export async function handleHiddenLinksAPI(req, res) {
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
    const detector = await getDetector();

    // ============================================================
    // GET /api/hidden-links/status — статус модуля (для диагностики)
    // ============================================================
    if (path === '/api/hidden-links/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'hidden-links',
        status: 'online',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // POST /api/hidden-links/update — обновить данные
    // ============================================================
    if (path === '/api/hidden-links/update' && req.method === 'POST') {
      const stats = await detector.update();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, stats }));
      return;
    }

    // ============================================================
    // GET /api/hidden-links/graph — получить граф
    // ============================================================
    if (path === '/api/hidden-links/graph' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        graph: detector.graph,
        stats: detector.getStats()
      }));
      return;
    }

    // ============================================================
    // GET /api/hidden-links/top — топ связей
    // ============================================================
    if (path === '/api/hidden-links/top' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 10;
      const top = detector.getTopLinks(limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, links: top }));
      return;
    }

    // ============================================================
    // GET /api/hidden-links/events — список событий
    // ============================================================
    if (path === '/api/hidden-links/events' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 50;
      const events = detector.events.slice(-limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, events }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Hidden Links API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleHiddenLinksAPI, HiddenLinkDetector };
