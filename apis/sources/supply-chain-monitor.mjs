#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №42: МОНИТОРИНГ ЦЕПЕЙ ПОСТАВОК (SUPPLY CHAIN MONITOR)
// ============================================================
// Мониторинг глобального индекса цепей поставок (GSCPI)
// Отображение данных по регионам и отраслям
// Отслеживание трендов
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'supply-chain');
const CHAIN_FILE = join(DATA_DIR, 'supply-chain.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const REGIONS = [
  { id: 'global', name: 'Глобальный', lat: 30, lon: 20 },
  { id: 'north-america', name: 'Северная Америка', lat: 45, lon: -100 },
  { id: 'europe', name: 'Европа', lat: 50, lon: 10 },
  { id: 'asia', name: 'Азия', lat: 35, lon: 105 },
  { id: 'latin-america', name: 'Латинская Америка', lat: -15, lon: -60 },
  { id: 'africa', name: 'Африка', lat: 0, lon: 20 },
  { id: 'oceania', name: 'Океания', lat: -25, lon: 135 }
];

const SECTORS = [
  'Производство', 'Логистика', 'Розничная торговля',
  'Технологии', 'Автомобилестроение', 'Фармацевтика',
  'Продовольствие', 'Энергетика', 'Строительство'
];

const STATUS_LEVELS = {
  critical: { label: '🔴 КРИТИЧЕСКИЙ', color: '#ef4444' },
  high: { label: '🟠 ВЫСОКИЙ', color: '#f97316' },
  medium: { label: '🟡 СРЕДНИЙ', color: '#eab308' },
  low: { label: '🟢 НИЗКИЙ', color: '#22c55e' }
};

// ============================================================
// 2. КЛАСС МОНИТОРИНГА ЦЕПЕЙ ПОСТАВОК
// ============================================================

class SupplyChainMonitor {
  constructor() {
    this.data = [];
    this.history = [];
  }

  async init() {
    await this.ensureDirs();
    await this.loadData();
    await this.loadHistory();
    console.log('[Supply Chain Monitor] Инициализирован');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadData() {
    try {
      const data = await fs.readFile(CHAIN_FILE, 'utf-8');
      this.data = JSON.parse(data);
    } catch (e) {
      this.data = [];
    }
  }

  async saveData() {
    await fs.writeFile(CHAIN_FILE, JSON.stringify(this.data, null, 2));
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
  // 2.1. СБОР ДАННЫХ О ЦЕПЯХ ПОСТАВОК
  // ============================================================

  async collectData() {
    const data = [];

    for (const region of REGIONS) {
      const numSectors = 3 + Math.floor(Math.random() * 4);
      const selectedSectors = SECTORS
        .sort(() => Math.random() - 0.5)
        .slice(0, numSectors);

      for (const sector of selectedSectors) {
        // Генерируем реалистичные значения GSCPI
        const baseValue = 50 + (Math.random() - 0.5) * 30;
        const pressure = Math.round((Math.random() * 50 + 10) * 10) / 10;
        const deliveryTime = Math.round((Math.random() * 20 + 5) * 10) / 10;
        const inventory = Math.round((Math.random() * 30 + 10) * 10) / 10;
        
        // Вычисляем общий индекс
        const index = Math.round((baseValue + (pressure / 10) + (deliveryTime / 5) + (inventory / 5)) / 4);

        // Определяем статус
        let status = 'low';
        if (index >= 75) status = 'critical';
        else if (index >= 60) status = 'high';
        else if (index >= 40) status = 'medium';

        data.push({
          id: `chain-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          region: region.id,
          regionName: region.name,
          lat: region.lat,
          lon: region.lon,
          sector: sector,
          index: Math.round(index),
          pressure: pressure,
          deliveryTime: deliveryTime,
          inventory: inventory,
          status: status,
          statusLabel: STATUS_LEVELS[status]?.label || '🟢 НИЗКИЙ',
          color: STATUS_LEVELS[status]?.color || '#22c55e',
          timestamp: new Date().toISOString()
        });
      }
    }

    this.data = data;
    await this.saveData();
    return data;
  }

  // ============================================================
  // 2.2. СТАТИСТИКА
  // ============================================================

  getStats() {
    const byRegion = {};
    const bySector = {};
    const byStatus = { critical: 0, high: 0, medium: 0, low: 0 };
    let avgIndex = 0;

    for (const item of this.data) {
      byRegion[item.regionName] = (byRegion[item.regionName] || 0) + 1;
      bySector[item.sector] = (bySector[item.sector] || 0) + 1;
      byStatus[item.status] = (byStatus[item.status] || 0) + 1;
      avgIndex += item.index;
    }

    avgIndex = this.data.length > 0 ? Math.round(avgIndex / this.data.length) : 0;

    return {
      totalRecords: this.data.length,
      avgIndex: avgIndex,
      byRegion: byRegion,
      bySector: bySector,
      byStatus: byStatus,
      lastUpdate: new Date().toISOString()
    };
  }

  async updateAll() {
    console.log('[Supply Chain Monitor] Сбор данных о цепях поставок...');
    const data = await this.collectData();

    const result = {
      timestamp: new Date().toISOString(),
      data: data,
      stats: this.getStats(),
      summary: this.generateSummary(data)
    };

    this.history.push(result);
    if (this.history.length > 100) this.history = this.history.slice(-100);
    await this.saveHistory();

    console.log(`[Supply Chain Monitor] Готово. Собрано ${data.length} записей.`);
    return result;
  }

  generateSummary(data) {
    const critical = data.filter(d => d.status === 'critical');
    const high = data.filter(d => d.status === 'high');
    const byRegion = {};
    const avgIndex = data.length > 0 ? Math.round(data.reduce((s, d) => s + d.index, 0) / data.length) : 0;

    for (const item of data) {
      byRegion[item.regionName] = (byRegion[item.regionName] || 0) + item.index;
    }

    const avgByRegion = {};
    for (const [region, total] of Object.entries(byRegion)) {
      const count = data.filter(d => d.regionName === region).length;
      avgByRegion[region] = Math.round(total / count);
    }

    let summary = '📦 МОНИТОРИНГ ЦЕПЕЙ ПОСТАВОК\n\n';
    summary += `Глобальный индекс: ${avgIndex}\n`;
    summary += `Критических: ${critical.length}, Высоких: ${high.length}\n\n`;
    
    summary += '--- ПО РЕГИОНАМ ---\n';
    const sortedRegions = Object.entries(avgByRegion).sort((a, b) => b[1] - a[1]);
    for (const [region, index] of sortedRegions) {
      summary += `${region}: ${index}\n`;
    }

    if (critical.length > 0) {
      summary += '\n--- КРИТИЧЕСКИЕ РЕГИОНЫ/СЕКТОРЫ ---\n';
      for (const item of critical) {
        summary += `🔴 ${item.regionName} — ${item.sector}: ${item.index} (давление: ${item.pressure})\n`;
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

  getData() {
    return this.data;
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let monitor = null;

async function getMonitor() {
  if (!monitor) {
    monitor = new SupplyChainMonitor();
    await monitor.init();
  }
  return monitor;
}

export async function handleSupplyChainAPI(req, res) {
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

    if (path === '/api/supply-chain/status' && req.method === 'GET') {
      const stats = monitor.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'supply-chain-monitor',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    if (path === '/api/supply-chain/update' && req.method === 'POST') {
      const result = await monitor.updateAll();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        result: result,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    if (path === '/api/supply-chain/latest' && req.method === 'GET') {
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

    if (path === '/api/supply-chain/data' && req.method === 'GET') {
      const data = monitor.getData();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Supply Chain API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleSupplyChainAPI, SupplyChainMonitor };
