#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №41: МОНИТОРИНГ ЭКОЛОГИИ (ENVIRONMENT MONITOR)
// ============================================================
// Мониторинг экологических данных из EPA
// Отображение данных по загрязнению, качеству воды и воздуха
// Отслеживание трендов
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'environment');
const ENV_FILE = join(DATA_DIR, 'environment.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const ENV_TYPES = {
  air: { name: 'Качество воздуха', icon: '🌬️', color: '#3b82f6', severity: 'medium' },
  water: { name: 'Качество воды', icon: '💧', color: '#06b6d4', severity: 'high' },
  soil: { name: 'Загрязнение почвы', icon: '🌱', color: '#f97316', severity: 'high' },
  waste: { name: 'Отходы', icon: '🗑️', color: '#6b7280', severity: 'medium' },
  radiation: { name: 'Радиация', icon: '☢️', color: '#ef4444', severity: 'critical' },
  emissions: { name: 'Выбросы', icon: '🏭', color: '#dc2626', severity: 'high' }
};

const REGIONS = [
  { id: 'north-america', name: 'Северная Америка', lat: 45, lon: -100 },
  { id: 'europe', name: 'Европа', lat: 50, lon: 10 },
  { id: 'asia', name: 'Азия', lat: 35, lon: 105 },
  { id: 'africa', name: 'Африка', lat: 0, lon: 20 },
  { id: 'south-america', name: 'Южная Америка', lat: -15, lon: -60 },
  { id: 'oceania', name: 'Океания', lat: -25, lon: 135 }
];

// ============================================================
// 2. КЛАСС МОНИТОРИНГА ЭКОЛОГИИ
// ============================================================

class EnvironmentMonitor {
  constructor() {
    this.data = [];
    this.history = [];
  }

  async init() {
    await this.ensureDirs();
    await this.loadData();
    await this.loadHistory();
    console.log('[Environment Monitor] Инициализирован');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadData() {
    try {
      const data = await fs.readFile(ENV_FILE, 'utf-8');
      this.data = JSON.parse(data);
    } catch (e) {
      this.data = [];
    }
  }

  async saveData() {
    await fs.writeFile(ENV_FILE, JSON.stringify(this.data, null, 2));
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
  // 2.1. СБОР ЭКОЛОГИЧЕСКИХ ДАННЫХ
  // ============================================================

  async collectData() {
    const data = [];

    // Демо-данные из EPA
    const demoData = [
      { type: 'air', location: 'Лос-Анджелес', region: 'north-america', value: 156, unit: 'AQI', status: 'moderate' },
      { type: 'air', location: 'Пекин', region: 'asia', value: 189, unit: 'AQI', status: 'unhealthy' },
      { type: 'air', location: 'Лондон', region: 'europe', value: 89, unit: 'AQI', status: 'moderate' },
      { type: 'water', location: 'Миссисипи', region: 'north-america', value: 45, unit: '% загрязнения', status: 'poor' },
      { type: 'water', location: 'Рейн', region: 'europe', value: 28, unit: '% загрязнения', status: 'good' },
      { type: 'water', location: 'Янцзы', region: 'asia', value: 67, unit: '% загрязнения', status: 'poor' },
      { type: 'soil', location: 'Чернобыль', region: 'europe', value: 35, unit: 'µSv/ч', status: 'elevated' },
      { type: 'soil', location: 'Фукусима', region: 'asia', value: 42, unit: 'µSv/ч', status: 'elevated' },
      { type: 'soil', location: 'Бхопал', region: 'asia', value: 78, unit: '% загрязнения', status: 'critical' },
      { type: 'waste', location: 'Тихий океан', region: 'oceania', value: 89, unit: 'тыс. тонн', status: 'critical' },
      { type: 'waste', location: 'Атлантика', region: 'north-america', value: 56, unit: 'тыс. тонн', status: 'moderate' },
      { type: 'radiation', location: 'Припять', region: 'europe', value: 2.5, unit: 'µSv/ч', status: 'elevated' },
      { type: 'radiation', location: 'Фукусима', region: 'asia', value: 5.2, unit: 'µSv/ч', status: 'critical' },
      { type: 'emissions', location: 'Рур', region: 'europe', value: 234, unit: 'тыс. тонн CO2', status: 'high' },
      { type: 'emissions', location: 'Питтсбург', region: 'north-america', value: 178, unit: 'тыс. тонн CO2', status: 'high' }
    ];

    for (const item of demoData) {
      const typeInfo = ENV_TYPES[item.type] || ENV_TYPES.air;
      const regionInfo = REGIONS.find(r => r.id === item.region) || REGIONS[0];

      data.push({
        id: `env-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: item.type,
        typeName: typeInfo.name,
        icon: typeInfo.icon,
        color: typeInfo.color,
        severity: typeInfo.severity,
        location: item.location,
        region: item.region,
        regionName: regionInfo.name,
        lat: regionInfo.lat + (Math.random() - 0.5) * 15,
        lon: regionInfo.lon + (Math.random() - 0.5) * 15,
        value: item.value,
        unit: item.unit,
        status: item.status,
        statusLabel: this.getStatusLabel(item.status),
        timestamp: new Date().toISOString()
      });
    }

    this.data = data;
    await this.saveData();
    return data;
  }

  getStatusLabel(status) {
    const labels = {
      'good': '🟢 Хорошее',
      'moderate': '🟡 Умеренное',
      'unhealthy': '🟠 Неблагоприятное',
      'poor': '🟠 Плохое',
      'elevated': '🟡 Повышенное',
      'high': '🔴 Высокое',
      'critical': '🔴 Критическое'
    };
    return labels[status] || '🟡 Неизвестно';
  }

  // ============================================================
  // 2.2. СТАТИСТИКА
  // ============================================================

  getStats() {
    const byType = {};
    const byStatus = {};
    const byRegion = {};
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };

    for (const item of this.data) {
      byType[item.type] = (byType[item.type] || 0) + 1;
      byStatus[item.status] = (byStatus[item.status] || 0) + 1;
      byRegion[item.regionName] = (byRegion[item.regionName] || 0) + 1;
      bySeverity[item.severity] = (bySeverity[item.severity] || 0) + 1;
    }

    return {
      totalRecords: this.data.length,
      byType: byType,
      byStatus: byStatus,
      byRegion: byRegion,
      bySeverity: bySeverity,
      lastUpdate: new Date().toISOString()
    };
  }

  async updateAll() {
    console.log('[Environment Monitor] Сбор экологических данных...');
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

    console.log(`[Environment Monitor] Готово. Собрано ${data.length} записей.`);
    return result;
  }

  generateSummary(data) {
    const critical = data.filter(d => d.status === 'critical');
    const high = data.filter(d => d.status === 'high' || d.status === 'unhealthy' || d.status === 'poor');
    const byType = {};

    for (const item of data) {
      byType[item.typeName] = (byType[item.typeName] || 0) + 1;
    }

    let summary = '🌍 МОНИТОРИНГ ЭКОЛОГИИ\n\n';
    summary += `Всего записей: ${data.length}\n`;
    summary += `Критических: ${critical.length}, Высоких: ${high.length}\n\n`;
    
    summary += '--- ПО ТИПАМ ---\n';
    for (const [type, count] of Object.entries(byType)) {
      const icon = Object.values(ENV_TYPES).find(t => t.name === type)?.icon || '🌍';
      summary += `${icon} ${type}: ${count}\n`;
    }

    if (critical.length > 0) {
      summary += '\n--- КРИТИЧЕСКИЕ ЗОНЫ ---\n';
      for (const item of critical) {
        summary += `🔴 ${item.icon} ${item.location}: ${item.value} ${item.unit}\n`;
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
    monitor = new EnvironmentMonitor();
    await monitor.init();
  }
  return monitor;
}

export async function handleEnvironmentAPI(req, res) {
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
    // GET /api/environment/status
    // ============================================================
    if (path === '/api/environment/status' && req.method === 'GET') {
      const stats = monitor.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'environment-monitor',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // POST /api/environment/update
    // ============================================================
    if (path === '/api/environment/update' && req.method === 'POST') {
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
    // GET /api/environment/latest
    // ============================================================
    if (path === '/api/environment/latest' && req.method === 'GET') {
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
    // GET /api/environment/data
    // ============================================================
    if (path === '/api/environment/data' && req.method === 'GET') {
      const data = monitor.getData();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Environment API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleEnvironmentAPI, EnvironmentMonitor };
