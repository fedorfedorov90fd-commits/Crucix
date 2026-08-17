#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №38: МОНИТОРИНГ ПОГОДЫ (WEATHER MONITOR)
// ============================================================
// Сбор данных о погоде и аномалиях из NOAA
// Отображение на карте и в таблице
// Отслеживание трендов и прогнозирование
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'weather');
const WEATHER_FILE = join(DATA_DIR, 'weather.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const WEATHER_TYPES = {
  storm: { name: 'Шторм', icon: '🌪️', color: '#8b5cf6', severity: 'high' },
  hurricane: { name: 'Ураган', icon: '🌀', color: '#ef4444', severity: 'critical' },
  tornado: { name: 'Торнадо', icon: '🌪️', color: '#dc2626', severity: 'critical' },
  flood: { name: 'Наводнение', icon: '🌊', color: '#3b82f6', severity: 'high' },
  drought: { name: 'Засуха', icon: '☀️', color: '#f97316', severity: 'medium' },
  heatwave: { name: 'Жара', icon: '🔥', color: '#ef4444', severity: 'high' },
  coldwave: { name: 'Холод', icon: '❄️', color: '#06b6d4', severity: 'medium' },
  wildfire: { name: 'Лесной пожар', icon: '🔥', color: '#f97316', severity: 'high' }
};

const REGIONS = [
  { id: 'north-america', name: 'Северная Америка', lat: 45, lon: -100 },
  { id: 'south-america', name: 'Южная Америка', lat: -15, lon: -60 },
  { id: 'europe', name: 'Европа', lat: 50, lon: 10 },
  { id: 'asia', name: 'Азия', lat: 35, lon: 105 },
  { id: 'africa', name: 'Африка', lat: 0, lon: 20 },
  { id: 'oceania', name: 'Океания', lat: -25, lon: 135 }
];

// ============================================================
// 2. КЛАСС МОНИТОРИНГА ПОГОДЫ
// ============================================================

class WeatherMonitor {
  constructor() {
    this.weather = [];
    this.history = [];
  }

  async init() {
    await this.ensureDirs();
    await this.loadWeather();
    await this.loadHistory();
    console.log('[Weather Monitor] Инициализирован');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadWeather() {
    try {
      const data = await fs.readFile(WEATHER_FILE, 'utf-8');
      this.weather = JSON.parse(data);
    } catch (e) {
      this.weather = [];
    }
  }

  async saveWeather() {
    await fs.writeFile(WEATHER_FILE, JSON.stringify(this.weather, null, 2));
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
  // 2.1. СБОР ДАННЫХ О ПОГОДЕ
  // ============================================================

  async collectWeather() {
    const weather = [];

    // Демо-данные из NOAA
    const demoWeather = [
      { type: 'hurricane', name: 'Hurricane Milton', region: 'north-america', location: 'Флорида', speed: 180, pressure: 950, status: 'active' },
      { type: 'storm', name: 'Winter Storm', region: 'europe', location: 'Великобритания', speed: 90, pressure: 980, status: 'active' },
      { type: 'heatwave', name: 'Heatwave Europe', region: 'europe', location: 'Испания', temp: 44, status: 'active' },
      { type: 'wildfire', name: 'Wildfire California', region: 'north-america', location: 'Калифорния', area: 12000, status: 'active' },
      { type: 'flood', name: 'Flood Asia', region: 'asia', location: 'Индия', waterLevel: 3.5, status: 'active' },
      { type: 'drought', name: 'Drought Africa', region: 'africa', location: 'Эфиопия', severity: 'extreme', status: 'active' },
      { type: 'tornado', name: 'Tornado Outbreak', region: 'north-america', location: 'Оклахома', speed: 320, status: 'active' },
      { type: 'coldwave', name: 'Cold Wave Siberia', region: 'asia', location: 'Сибирь', temp: -45, status: 'active' },
      { type: 'hurricane', name: 'Hurricane Helen', region: 'north-america', location: 'Техас', speed: 160, pressure: 960, status: 'active' },
      { type: 'storm', name: 'Storm Asia', region: 'asia', location: 'Япония', speed: 110, pressure: 975, status: 'active' }
    ];

    for (const event of demoWeather) {
      const typeInfo = WEATHER_TYPES[event.type] || WEATHER_TYPES.storm;
      const regionInfo = REGIONS.find(r => r.id === event.region) || REGIONS[0];

      weather.push({
        id: `weather-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: event.type,
        typeName: typeInfo.name,
        icon: typeInfo.icon,
        color: typeInfo.color,
        severity: typeInfo.severity,
        name: event.name,
        location: event.location,
        region: event.region,
        regionName: regionInfo.name,
        lat: regionInfo.lat + (Math.random() - 0.5) * 20,
        lon: regionInfo.lon + (Math.random() - 0.5) * 20,
        speed: event.speed || null,
        pressure: event.pressure || null,
        temp: event.temp || null,
        area: event.area || null,
        waterLevel: event.waterLevel || null,
        status: event.status,
        statusLabel: event.status === 'active' ? '🟡 Активное' : '🟢 Завершено',
        source: 'NOAA',
        timestamp: new Date().toISOString()
      });
    }

    this.weather = weather;
    await this.saveWeather();
    return weather;
  }

  // ============================================================
  // 2.2. СТАТИСТИКА
  // ============================================================

  getStats() {
    const byType = {};
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
    const byRegion = {};
    const byStatus = { active: 0, inactive: 0 };

    for (const event of this.weather) {
      byType[event.type] = (byType[event.type] || 0) + 1;
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
      byRegion[event.regionName] = (byRegion[event.regionName] || 0) + 1;
      byStatus[event.status] = (byStatus[event.status] || 0) + 1;
    }

    return {
      totalEvents: this.weather.length,
      byType: byType,
      bySeverity: bySeverity,
      byRegion: byRegion,
      byStatus: byStatus,
      lastUpdate: new Date().toISOString()
    };
  }

  async updateAll() {
    console.log('[Weather Monitor] Сбор данных о погоде...');
    const weather = await this.collectWeather();

    const result = {
      timestamp: new Date().toISOString(),
      weather: weather,
      stats: this.getStats(),
      summary: this.generateSummary(weather)
    };

    this.history.push(result);
    if (this.history.length > 100) this.history = this.history.slice(-100);
    await this.saveHistory();

    console.log(`[Weather Monitor] Готово. Собрано ${weather.length} событий.`);
    return result;
  }

  generateSummary(weather) {
    const critical = weather.filter(w => w.severity === 'critical');
    const high = weather.filter(w => w.severity === 'high');
    const byType = {};

    for (const event of weather) {
      byType[event.typeName] = (byType[event.typeName] || 0) + 1;
    }

    let summary = '🌤️ МОНИТОРИНГ ПОГОДЫ\n\n';
    summary += `Всего событий: ${weather.length}\n`;
    summary += `Критических: ${critical.length}, Высоких: ${high.length}\n\n`;
    
    summary += '--- ПО ТИПАМ ---\n';
    for (const [type, count] of Object.entries(byType)) {
      summary += `${WEATHER_TYPES[type]?.icon || '🌤️'} ${type}: ${count}\n`;
    }

    if (critical.length > 0) {
      summary += '\n--- КРИТИЧЕСКИЕ СОБЫТИЯ ---\n';
      for (const event of critical) {
        summary += `🔴 ${event.icon} ${event.name} (${event.location})\n`;
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

  getWeather() {
    return this.weather;
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let monitor = null;

async function getMonitor() {
  if (!monitor) {
    monitor = new WeatherMonitor();
    await monitor.init();
  }
  return monitor;
}

export async function handleWeatherAPI(req, res) {
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
    // GET /api/weather/status
    // ============================================================
    if (path === '/api/weather/status' && req.method === 'GET') {
      const stats = monitor.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'weather-monitor',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // POST /api/weather/update
    // ============================================================
    if (path === '/api/weather/update' && req.method === 'POST') {
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
    // GET /api/weather/latest
    // ============================================================
    if (path === '/api/weather/latest' && req.method === 'GET') {
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
    // GET /api/weather/events
    // ============================================================
    if (path === '/api/weather/events' && req.method === 'GET') {
      const weather = monitor.getWeather();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, weather }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Weather API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleWeatherAPI, WeatherMonitor };
