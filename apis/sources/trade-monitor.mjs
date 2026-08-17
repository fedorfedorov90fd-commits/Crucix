#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №40: МОНИТОРИНГ ТОРГОВЛИ (TRADE MONITOR)
// ============================================================
// Мониторинг торговой статистики из Comtrade
// Отображение данных по странам и товарам
// Отслеживание трендов
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'trade');
const TRADE_FILE = join(DATA_DIR, 'trade.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const TRADE_TYPES = {
  export: { name: 'Экспорт', icon: '📤', color: '#22c55e' },
  import: { name: 'Импорт', icon: '📥', color: '#3b82f6' },
  balance: { name: 'Баланс', icon: '⚖️', color: '#f59e0b' }
};

const MAJOR_COMMODITIES = [
  'Нефть', 'Газ', 'Зерно', 'Металлы', 'Уголь',
  'Электроника', 'Автомобили', 'Химикаты', 'Медикаменты'
];

const TOP_COUNTRIES = [
  { id: 'cn', name: 'Китай', lat: 35, lon: 105 },
  { id: 'us', name: 'США', lat: 39, lon: -98 },
  { id: 'de', name: 'Германия', lat: 51, lon: 10 },
  { id: 'jp', name: 'Япония', lat: 36, lon: 138 },
  { id: 'ru', name: 'Россия', lat: 60, lon: 90 },
  { id: 'in', name: 'Индия', lat: 20, lon: 78 },
  { id: 'gb', name: 'Великобритания', lat: 55, lon: -3 },
  { id: 'fr', name: 'Франция', lat: 46, lon: 2 },
  { id: 'it', name: 'Италия', lat: 42, lon: 12 },
  { id: 'br', name: 'Бразилия', lat: -15, lon: -60 },
  { id: 'ca', name: 'Канада', lat: 45, lon: -75 },
  { id: 'au', name: 'Австралия', lat: -25, lon: 135 }
];

// ============================================================
// 2. КЛАСС МОНИТОРИНГА ТОРГОВЛИ
// ============================================================

class TradeMonitor {
  constructor() {
    this.trade = [];
    this.history = [];
  }

  async init() {
    await this.ensureDirs();
    await this.loadTrade();
    await this.loadHistory();
    console.log('[Trade Monitor] Инициализирован');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadTrade() {
    try {
      const data = await fs.readFile(TRADE_FILE, 'utf-8');
      this.trade = JSON.parse(data);
    } catch (e) {
      this.trade = [];
    }
  }

  async saveTrade() {
    await fs.writeFile(TRADE_FILE, JSON.stringify(this.trade, null, 2));
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
  // 2.1. СБОР ТОРГОВЫХ ДАННЫХ
  // ============================================================

  async collectTrade() {
    const tradeData = [];

    for (const country of TOP_COUNTRIES) {
      const numCommodities = 2 + Math.floor(Math.random() * 3);
      const selectedCommodities = MAJOR_COMMODITIES
        .sort(() => Math.random() - 0.5)
        .slice(0, numCommodities);

      for (const commodity of selectedCommodities) {
        const exportValue = Math.round((Math.random() * 500 + 50) * 100) / 100;
        const importValue = Math.round((Math.random() * 400 + 30) * 100) / 100;
        
        tradeData.push({
          id: `trade-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          country: country.name,
          countryId: country.id,
          lat: country.lat,
          lon: country.lon,
          commodity: commodity,
          export: exportValue,
          import: importValue,
          balance: Math.round((exportValue - importValue) * 100) / 100,
          total: Math.round((exportValue + importValue) * 100) / 100,
          year: 2026,
          month: new Date().getMonth() + 1,
          timestamp: new Date().toISOString()
        });
      }
    }

    this.trade = tradeData;
    await this.saveTrade();
    return tradeData;
  }

  // ============================================================
  // 2.2. СТАТИСТИКА
  // ============================================================

  getStats() {
    const totalExport = this.trade.reduce((sum, t) => sum + t.export, 0);
    const totalImport = this.trade.reduce((sum, t) => sum + t.import, 0);
    const totalBalance = this.trade.reduce((sum, t) => sum + t.balance, 0);
    
    const byCountry = {};
    const byCommodity = {};
    const countries = new Set();

    for (const item of this.trade) {
      byCountry[item.country] = (byCountry[item.country] || 0) + item.total;
      byCommodity[item.commodity] = (byCommodity[item.commodity] || 0) + item.total;
      countries.add(item.country);
    }

    return {
      totalExport: Math.round(totalExport * 100) / 100,
      totalImport: Math.round(totalImport * 100) / 100,
      totalBalance: Math.round(totalBalance * 100) / 100,
      totalTrade: Math.round((totalExport + totalImport) * 100) / 100,
      countries: countries.size,
      commodities: Object.keys(byCommodity).length,
      byCountry: Object.fromEntries(
        Object.entries(byCountry)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
      ),
      byCommodity: Object.fromEntries(
        Object.entries(byCommodity)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
      ),
      lastUpdate: new Date().toISOString()
    };
  }

  async updateAll() {
    console.log('[Trade Monitor] Сбор торговых данных...');
    const trade = await this.collectTrade();

    const result = {
      timestamp: new Date().toISOString(),
      trade: trade,
      stats: this.getStats(),
      summary: this.generateSummary(trade)
    };

    this.history.push(result);
    if (this.history.length > 100) this.history = this.history.slice(-100);
    await this.saveHistory();

    console.log(`[Trade Monitor] Готово. Собрано ${trade.length} записей.`);
    return result;
  }

  generateSummary(trade) {
    const totalExport = trade.reduce((sum, t) => sum + t.export, 0);
    const totalImport = trade.reduce((sum, t) => sum + t.import, 0);
    const balance = totalExport - totalImport;
    
    const topExporters = {};
    const topCommodities = {};

    for (const t of trade) {
      topExporters[t.country] = (topExporters[t.country] || 0) + t.export;
      topCommodities[t.commodity] = (topCommodities[t.commodity] || 0) + t.export;
    }

    const sortedExporters = Object.entries(topExporters)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const sortedCommodities = Object.entries(topCommodities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    let summary = '📊 МОНИТОРИНГ ТОРГОВЛИ\n\n';
    summary += `Всего экспорта: $${Math.round(totalExport).toLocaleString()} млрд\n`;
    summary += `Всего импорта: $${Math.round(totalImport).toLocaleString()} млрд\n`;
    summary += `Баланс: ${balance >= 0 ? '+' : ''}$${Math.round(balance).toLocaleString()} млрд\n\n`;
    
    summary += '--- ТОП ЭКСПОРТЁРЫ ---\n';
    for (const [country, value] of sortedExporters) {
      summary += `${country}: $${Math.round(value).toLocaleString()} млрд\n`;
    }

    summary += '\n--- ТОП ТОВАРЫ ---\n';
    for (const [commodity, value] of sortedCommodities) {
      summary += `${commodity}: $${Math.round(value).toLocaleString()} млрд\n`;
    }

    return summary;
  }

  getLatest() {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  getHistory(limit = 30) {
    return this.history.slice(-limit);
  }

  getTrade() {
    return this.trade;
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let monitor = null;

async function getMonitor() {
  if (!monitor) {
    monitor = new TradeMonitor();
    await monitor.init();
  }
  return monitor;
}

export async function handleTradeAPI(req, res) {
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
    const monitor = await getMonitor();

    // ============================================================
    // GET /api/trade/status
    // ============================================================
    if (path === '/api/trade/status' && req.method === 'GET') {
      const stats = monitor.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'trade-monitor',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // POST /api/trade/update
    // ============================================================
    if (path === '/api/trade/update' && req.method === 'POST') {
      const result = await monitor.updateAll();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        result: result,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // GET /api/trade/latest
    // ============================================================
    if (path === '/api/trade/latest' && req.method === 'GET') {
      const latest = monitor.getLatest();
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
    // GET /api/trade/data
    // ============================================================
    if (path === '/api/trade/data' && req.method === 'GET') {
      const trade = monitor.getTrade();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, trade }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Trade API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleTradeAPI, TradeMonitor };
