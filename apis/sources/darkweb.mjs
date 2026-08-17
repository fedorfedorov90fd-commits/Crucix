#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №64: DARK WEB MONITOR — МОНИТОРИНГ ДАРКНЕТА
// ============================================================
// Мониторинг скрытых ресурсов (Tor, I2P, Freenet)
// Обнаружение утечек данных и киберугроз
// Анализ даркнет-рынков и форумов
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'darkweb');
const MARKETS_FILE = join(DATA_DIR, 'markets.json');
const LEAKS_FILE = join(DATA_DIR, 'leaks.json');
const THREATS_FILE = join(DATA_DIR, 'threats.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const DARKNET_SOURCES = [
  { id: 'tor', name: 'Tor Network', icon: '🧅', type: 'network', risk: 'high' },
  { id: 'i2p', name: 'I2P Network', icon: '🔒', type: 'network', risk: 'medium' },
  { id: 'freenet', name: 'Freenet', icon: '🌐', type: 'network', risk: 'medium' },
  { id: 'zeroNet', name: 'ZeroNet', icon: '⚡', type: 'network', risk: 'low' }
];

const DEMO_MARKETS = [
  {
    id: 'market-001',
    name: 'Скрытый рынок Alpha',
    url: 'http://alpha.onion',
    type: 'marketplace',
    products: ['данные', 'услуги', 'аккаунты'],
    status: 'active',
    risk: 'high',
    last_seen: null,
    listings: 1247,
    description: 'Крупный даркнет-рынок для продажи данных и услуг'
  },
  {
    id: 'market-002',
    name: 'Форум X',
    url: 'http://forumx.onion',
    type: 'forum',
    products: ['обсуждения', 'инсайды', 'документы'],
    status: 'active',
    risk: 'medium',
    last_seen: null,
    listings: 342,
    description: 'Закрытый форум для обмена информацией'
  },
  {
    id: 'market-003',
    name: 'База данных Z',
    url: 'http://databasez.onion',
    type: 'database',
    products: ['базы данных', 'логины', 'пароли'],
    status: 'active',
    risk: 'critical',
    last_seen: null,
    listings: 89,
    description: 'Крупная база данных с утечками'
  }
];

const DEMO_LEAKS = [
  {
    id: 'leak-001',
    title: 'Утечка данных пользователей',
    source: 'База данных Z',
    type: 'credentials',
    severity: 'critical',
    records: 2500000,
    description: 'Обнаружена утечка 2.5M записей пользователей',
    timestamp: null
  },
  {
    id: 'leak-002',
    title: 'Продажа корпоративных документов',
    source: 'Скрытый рынок Alpha',
    type: 'documents',
    severity: 'high',
    records: 15000,
    description: 'Продажа внутренних документов компании',
    timestamp: null
  },
  {
    id: 'leak-003',
    title: 'Утечка криптовалютных кошельков',
    source: 'Форум X',
    type: 'crypto',
    severity: 'critical',
    records: 5000,
    description: 'Обнаружена утечка 5K криптовалютных кошельков',
    timestamp: null
  }
];

const DEMO_THREATS = [
  {
    id: 'threat-001',
    name: 'Ransomware активизация',
    type: 'ransomware',
    severity: 'high',
    description: 'Новая волна атак вымогателей в даркнете',
    targets: ['business', 'government'],
    status: 'active',
    timestamp: null
  },
  {
    id: 'threat-002',
    name: 'Продажа нулевых уязвимостей',
    type: 'zero_day',
    severity: 'critical',
    description: 'Продажа эксплойтов для популярных систем',
    targets: ['software', 'infrastructure'],
    status: 'active',
    timestamp: null
  },
  {
    id: 'threat-003',
    name: 'Фишинг-кампания',
    type: 'phishing',
    severity: 'medium',
    description: 'Массовая рассылка фишинговых ссылок',
    targets: ['individuals', 'organizations'],
    status: 'active',
    timestamp: null
  }
];

// ============================================================
// 2. КЛАСС МОНИТОРИНГА ДАРКНЕТА
// ============================================================

class DarkWebMonitor {
  constructor() {
    this.sources = DARKNET_SOURCES;
    this.markets = [];
    this.leaks = [];
    this.threats = [];
  }

  async init() {
    await this.ensureDirs();
    await this.loadMarkets();
    await this.loadLeaks();
    await this.loadThreats();
    console.log('[DarkWeb] Мониторинг даркнета инициализирован');
    console.log(`[DarkWeb] Рынков: ${this.markets.length}, Утечек: ${this.leaks.length}, Угроз: ${this.threats.length}`);
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadMarkets() {
    try {
      const data = await fs.readFile(MARKETS_FILE, 'utf-8');
      this.markets = JSON.parse(data);
    } catch (e) {
      this.markets = DEMO_MARKETS.map(m => ({
        ...m,
        last_seen: new Date(Date.now() - Math.random() * 86400000).toISOString()
      }));
      await this.saveMarkets();
    }
  }

  async saveMarkets() {
    await fs.writeFile(MARKETS_FILE, JSON.stringify(this.markets, null, 2));
  }

  async loadLeaks() {
    try {
      const data = await fs.readFile(LEAKS_FILE, 'utf-8');
      this.leaks = JSON.parse(data);
    } catch (e) {
      this.leaks = DEMO_LEAKS.map(l => ({
        ...l,
        timestamp: new Date(Date.now() - Math.random() * 86400000 * 2).toISOString()
      }));
      await this.saveLeaks();
    }
  }

  async saveLeaks() {
    await fs.writeFile(LEAKS_FILE, JSON.stringify(this.leaks, null, 2));
  }

  async loadThreats() {
    try {
      const data = await fs.readFile(THREATS_FILE, 'utf-8');
      this.threats = JSON.parse(data);
    } catch (e) {
      this.threats = DEMO_THREATS.map(t => ({
        ...t,
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString()
      }));
      await this.saveThreats();
    }
  }

  async saveThreats() {
    await fs.writeFile(THREATS_FILE, JSON.stringify(this.threats, null, 2));
  }

  // ============================================================
  // 2.1. АНАЛИЗ РЫНКОВ
  // ============================================================

  analyzeMarkets() {
    const analysis = {
      total: this.markets.length,
      active: this.markets.filter(m => m.status === 'active').length,
      by_type: {},
      by_risk: {},
      listings: 0
    };

    for (const market of this.markets) {
      if (!analysis.by_type[market.type]) analysis.by_type[market.type] = 0;
      analysis.by_type[market.type] += 1;
      
      if (!analysis.by_risk[market.risk]) analysis.by_risk[market.risk] = 0;
      analysis.by_risk[market.risk] += 1;
      
      analysis.listings += market.listings || 0;
    }

    return analysis;
  }

  // ============================================================
  // 2.2. ДЕТЕКЦИЯ УГРОЗ
  // ============================================================

  detectThreats() {
    const threats = this.threats;
    const critical = threats.filter(t => t.severity === 'critical').length;
    const high = threats.filter(t => t.severity === 'high').length;
    const medium = threats.filter(t => t.severity === 'medium').length;

    return {
      total: threats.length,
      critical: critical,
      high: high,
      medium: medium,
      active: threats.filter(t => t.status === 'active').length,
      top_threats: threats.slice(0, 3)
    };
  }

  // ============================================================
  // 2.3. ОБНАРУЖЕНИЕ УТЕЧЕК
  // ============================================================

  detectLeaks() {
    const leaks = this.leaks;
    const critical = leaks.filter(l => l.severity === 'critical').length;
    const high = leaks.filter(l => l.severity === 'high').length;
    const totalRecords = leaks.reduce((sum, l) => sum + (l.records || 0), 0);

    return {
      total: leaks.length,
      critical: critical,
      high: high,
      total_records: totalRecords,
      recent: leaks.slice(0, 3)
    };
  }

  // ============================================================
  // 2.4. СТАТИСТИКА
  // ============================================================

  getStats() {
    const markets = this.analyzeMarkets();
    const threats = this.detectThreats();
    const leaks = this.detectLeaks();

    return {
      sources: this.sources.length,
      markets: markets,
      threats: threats,
      leaks: leaks,
      risk_level: this.calculateRiskLevel(),
      last_update: new Date().toISOString()
    };
  }

  calculateRiskLevel() {
    const criticalThreats = this.threats.filter(t => t.severity === 'critical').length;
    const criticalLeaks = this.leaks.filter(l => l.severity === 'critical').length;
    const highRiskMarkets = this.markets.filter(m => m.risk === 'critical' || m.risk === 'high').length;

    let score = 0;
    score += criticalThreats * 20;
    score += criticalLeaks * 15;
    score += highRiskMarkets * 5;

    if (score > 50) return 'critical';
    if (score > 30) return 'high';
    if (score > 15) return 'medium';
    return 'low';
  }

  // ============================================================
  // 2.5. ПОЛУЧЕНИЕ ДАННЫХ
  // ============================================================

  getMarkets(filters = {}) {
    let result = this.markets;
    if (filters.type) result = result.filter(m => m.type === filters.type);
    if (filters.risk) result = result.filter(m => m.risk === filters.risk);
    if (filters.status) result = result.filter(m => m.status === filters.status);
    if (filters.limit) result = result.slice(0, filters.limit);
    return result;
  }

  getLeaks(filters = {}) {
    let result = this.leaks;
    if (filters.severity) result = result.filter(l => l.severity === filters.severity);
    if (filters.type) result = result.filter(l => l.type === filters.type);
    if (filters.limit) result = result.slice(0, filters.limit);
    return result;
  }

  getThreats(filters = {}) {
    let result = this.threats;
    if (filters.severity) result = result.filter(t => t.severity === filters.severity);
    if (filters.type) result = result.filter(t => t.type === filters.type);
    if (filters.status) result = result.filter(t => t.status === filters.status);
    if (filters.limit) result = result.slice(0, filters.limit);
    return result;
  }

  getSources() {
    return this.sources;
  }

  // ============================================================
  // 2.6. ДОБАВЛЕНИЕ ДАННЫХ
  // ============================================================

  async addMarket(data) {
    const market = {
      id: `market-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: data.name || 'Новый рынок',
      url: data.url || '',
      type: data.type || 'marketplace',
      products: data.products || [],
      status: data.status || 'active',
      risk: data.risk || 'medium',
      last_seen: new Date().toISOString(),
      listings: data.listings || 0,
      description: data.description || ''
    };
    this.markets.push(market);
    await this.saveMarkets();
    return market;
  }

  async addLeak(data) {
    const leak = {
      id: `leak-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: data.title || 'Новая утечка',
      source: data.source || 'Неизвестно',
      type: data.type || 'unknown',
      severity: data.severity || 'medium',
      records: data.records || 0,
      description: data.description || '',
      timestamp: new Date().toISOString()
    };
    this.leaks.push(leak);
    await this.saveLeaks();
    return leak;
  }

  async addThreat(data) {
    const threat = {
      id: `threat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: data.name || 'Новая угроза',
      type: data.type || 'unknown',
      severity: data.severity || 'medium',
      description: data.description || '',
      targets: data.targets || [],
      status: data.status || 'active',
      timestamp: new Date().toISOString()
    };
    this.threats.push(threat);
    await this.saveThreats();
    return threat;
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let darkweb = null;

async function getDarkWeb() {
  if (!darkweb) {
    darkweb = new DarkWebMonitor();
    await darkweb.init();
  }
  return darkweb;
}

export async function handleDarkWebAPI(req, res) {
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
    const darkweb = await getDarkWeb();

    // GET /api/darkweb/status
    if (path === '/api/darkweb/status' && req.method === 'GET') {
      const stats = darkweb.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'darkweb',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // GET /api/darkweb/markets
    if (path === '/api/darkweb/markets' && req.method === 'GET') {
      const type = url.searchParams.get('type');
      const risk = url.searchParams.get('risk');
      const status = url.searchParams.get('status');
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const markets = darkweb.getMarkets({ type, risk, status, limit });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, markets, total: markets.length }));
      return;
    }

    // POST /api/darkweb/markets
    if (path === '/api/darkweb/markets' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const market = await darkweb.addMarket(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, market }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // GET /api/darkweb/leaks
    if (path === '/api/darkweb/leaks' && req.method === 'GET') {
      const severity = url.searchParams.get('severity');
      const type = url.searchParams.get('type');
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const leaks = darkweb.getLeaks({ severity, type, limit });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, leaks, total: leaks.length }));
      return;
    }

    // POST /api/darkweb/leaks
    if (path === '/api/darkweb/leaks' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const leak = await darkweb.addLeak(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, leak }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // GET /api/darkweb/threats
    if (path === '/api/darkweb/threats' && req.method === 'GET') {
      const severity = url.searchParams.get('severity');
      const type = url.searchParams.get('type');
      const status = url.searchParams.get('status');
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const threats = darkweb.getThreats({ severity, type, status, limit });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, threats, total: threats.length }));
      return;
    }

    // POST /api/darkweb/threats
    if (path === '/api/darkweb/threats' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const threat = await darkweb.addThreat(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, threat }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // GET /api/darkweb/sources
    if (path === '/api/darkweb/sources' && req.method === 'GET') {
      const sources = darkweb.getSources();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, sources }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[DarkWeb API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка', details: error.message }));
  }
}

export default { handleDarkWebAPI, DarkWebMonitor };
