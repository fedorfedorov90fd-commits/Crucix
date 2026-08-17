#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №39: МОНИТОРИНГ КОСМОСА (SPACE MONITOR)
// ============================================================
// Мониторинг космических событий (запуски, спутники, солнечная активность)
// Отображение на карте и в таблице
// Отслеживание трендов
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'space-monitor');
const EVENTS_FILE = join(DATA_DIR, 'events.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const SPACE_EVENT_TYPES = {
  launch: { name: 'Запуск', icon: '🚀', color: '#22c55e', severity: 'medium' },
  satellite: { name: 'Спутник', icon: '🛰️', color: '#3b82f6', severity: 'low' },
  solar_flare: { name: 'Солнечная вспышка', icon: '☀️', color: '#f97316', severity: 'high' },
  spacewalk: { name: 'Выход в космос', icon: '👨‍🚀', color: '#8b5cf6', severity: 'medium' },
  asteroid: { name: 'Астероид', icon: '☄️', color: '#ef4444', severity: 'critical' },
  docking: { name: 'Стыковка', icon: '🔗', color: '#06b6d4', severity: 'medium' },
  reentry: { name: 'Вход в атмосферу', icon: '🔥', color: '#f97316', severity: 'high' }
};

const LAUNCH_SITES = [
  { id: 'baikonur', name: 'Байконур', lat: 45.6, lon: 63.3, country: 'Казахстан' },
  { id: 'cape-canaveral', name: 'Мыс Канаверал', lat: 28.5, lon: -80.5, country: 'США' },
  { id: 'kennedy', name: 'Космический центр Кеннеди', lat: 28.6, lon: -80.6, country: 'США' },
  { id: 'guiana', name: 'Куру', lat: 5.2, lon: -52.8, country: 'Французская Гвиана' },
  { id: 'jiuquan', name: 'Цзюцюань', lat: 40.9, lon: 100.2, country: 'Китай' },
  { id: 'xichang', name: 'Сичан', lat: 28.2, lon: 102.0, country: 'Китай' },
  { id: 'tanegashima', name: 'Танэгасима', lat: 30.4, lon: 131.0, country: 'Япония' },
  { id: 'sriharikota', name: 'Шрихарикота', lat: 13.7, lon: 80.2, country: 'Индия' },
  { id: 'vostochny', name: 'Восточный', lat: 51.9, lon: 128.3, country: 'Россия' }
];

// ============================================================
// 2. КЛАСС МОНИТОРИНГА КОСМОСА
// ============================================================

class SpaceMonitor {
  constructor() {
    this.events = [];
    this.history = [];
  }

  async init() {
    await this.ensureDirs();
    await this.loadEvents();
    await this.loadHistory();
    console.log('[Space Monitor] Инициализирован');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadEvents() {
    try {
      const data = await fs.readFile(EVENTS_FILE, 'utf-8');
      this.events = JSON.parse(data);
    } catch (e) {
      this.events = [];
    }
  }

  async saveEvents() {
    await fs.writeFile(EVENTS_FILE, JSON.stringify(this.events, null, 2));
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
  // 2.1. СБОР КОСМИЧЕСКИХ СОБЫТИЙ
  // ============================================================

  async collectEvents() {
    const events = [];

    // Демо-данные космических событий
    const demoSites = [
      { site: 'baikonur', mission: 'Soyuz MS-27', type: 'launch', date: '2026-08-18' },
      { site: 'cape-canaveral', mission: 'Falcon 9 Starlink', type: 'launch', date: '2026-08-19' },
      { site: 'kennedy', mission: 'Artemis III', type: 'launch', date: '2026-08-25' },
      { site: 'juiiquan', mission: 'Long March 5', type: 'launch', date: '2026-08-20' },
      { site: 'guiana', mission: 'Ariane 6', type: 'launch', date: '2026-08-22' }
    ];

    for (const item of demoSites) {
      const siteInfo = LAUNCH_SITES.find(s => s.id === item.site) || LAUNCH_SITES[0];
      const typeInfo = SPACE_EVENT_TYPES[item.type] || SPACE_EVENT_TYPES.launch;

      events.push({
        id: `space-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: item.type,
        typeName: typeInfo.name,
        icon: typeInfo.icon,
        color: typeInfo.color,
        severity: typeInfo.severity,
        mission: item.mission,
        site: siteInfo.name,
        country: siteInfo.country,
        lat: siteInfo.lat,
        lon: siteInfo.lon,
        date: item.date,
        status: 'scheduled',
        statusLabel: '🟡 Запланирован',
        source: 'Space Monitor',
        timestamp: new Date().toISOString()
      });
    }

    // Добавляем солнечную активность
    const solarEvents = [
      { type: 'solar_flare', name: 'X-class Flare', severity: 'high' },
      { type: 'solar_flare', name: 'M-class Flare', severity: 'medium' }
    ];

    for (const se of solarEvents) {
      const typeInfo = SPACE_EVENT_TYPES[se.type] || SPACE_EVENT_TYPES.solar_flare;
      events.push({
        id: `space-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: se.type,
        typeName: typeInfo.name,
        icon: typeInfo.icon,
        color: typeInfo.color,
        severity: typeInfo.severity,
        mission: se.name,
        site: 'Солнце',
        country: '-',
        lat: 0,
        lon: 0,
        date: new Date().toISOString().split('T')[0],
        status: 'active',
        statusLabel: '🟡 Активно',
        source: 'NOAA Space Weather',
        timestamp: new Date().toISOString()
      });
    }

    // Добавляем астероид
    const asteroidEvent = {
      type: 'asteroid',
      name: '2024 XR1',
      distance: '2.3 млн км',
      size: '150 м'
    };

    const typeInfo = SPACE_EVENT_TYPES.asteroid;
    events.push({
      id: `space-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'asteroid',
      typeName: typeInfo.name,
      icon: typeInfo.icon,
      color: typeInfo.color,
      severity: typeInfo.severity,
      mission: `${asteroidEvent.name} (${asteroidEvent.size})`,
      site: `${asteroidEvent.distance} от Земли`,
      country: '-',
      lat: 0,
      lon: 0,
      date: new Date().toISOString().split('T')[0],
      status: 'active',
      statusLabel: '🔴 Внимание',
      source: 'NASA NEO',
      timestamp: new Date().toISOString()
    });

    this.events = events;
    await this.saveEvents();
    return events;
  }

  // ============================================================
  // 2.2. СТАТИСТИКА
  // ============================================================

  getStats() {
    const byType = {};
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
    const byStatus = { scheduled: 0, active: 0 };

    for (const event of this.events) {
      byType[event.type] = (byType[event.type] || 0) + 1;
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
      byStatus[event.status] = (byStatus[event.status] || 0) + 1;
    }

    return {
      totalEvents: this.events.length,
      byType: byType,
      bySeverity: bySeverity,
      byStatus: byStatus,
      lastUpdate: new Date().toISOString()
    };
  }

  async updateAll() {
    console.log('[Space Monitor] Сбор космических событий...');
    const events = await this.collectEvents();

    const result = {
      timestamp: new Date().toISOString(),
      events: events,
      stats: this.getStats(),
      summary: this.generateSummary(events)
    };

    this.history.push(result);
    if (this.history.length > 100) this.history = this.history.slice(-100);
    await this.saveHistory();

    console.log(`[Space Monitor] Готово. Собрано ${events.length} событий.`);
    return result;
  }

  generateSummary(events) {
    const launches = events.filter(e => e.type === 'launch');
    const critical = events.filter(e => e.severity === 'critical');
    const solar = events.filter(e => e.type === 'solar_flare');

    let summary = '🚀 МОНИТОРИНГ КОСМОСА\n\n';
    summary += `Всего событий: ${events.length}\n`;
    summary += `Запусков: ${launches.length}, Солнечных вспышек: ${solar.length}\n`;
    summary += `Критических: ${critical.length}\n\n`;
    
    if (launches.length > 0) {
      summary += '--- ЗАПУСКИ ---\n';
      for (const launch of launches) {
        summary += `🚀 ${launch.mission} (${launch.site})\n`;
      }
    }

    if (critical.length > 0) {
      summary += '\n--- КРИТИЧЕСКИЕ СОБЫТИЯ ---\n';
      for (const event of critical) {
        summary += `🔴 ${event.icon} ${event.mission}\n`;
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

  getEvents() {
    return this.events;
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let monitor = null;

async function getMonitor() {
  if (!monitor) {
    monitor = new SpaceMonitor();
    await monitor.init();
  }
  return monitor;
}

export async function handleSpaceMonitorAPI(req, res) {
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
    // GET /api/space-monitor/status
    // ============================================================
    if (path === '/api/space-monitor/status' && req.method === 'GET') {
      const stats = monitor.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'space-monitor',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // POST /api/space-monitor/update
    // ============================================================
    if (path === '/api/space-monitor/update' && req.method === 'POST') {
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
    // GET /api/space-monitor/latest
    // ============================================================
    if (path === '/api/space-monitor/latest' && req.method === 'GET') {
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
    // GET /api/space-monitor/events
    // ============================================================
    if (path === '/api/space-monitor/events' && req.method === 'GET') {
      const events = monitor.getEvents();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, events }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Space Monitor API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleSpaceMonitorAPI, SpaceMonitor };
