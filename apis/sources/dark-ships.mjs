#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №28: ТЁМНЫЕ СУДА (DARK SHIPS)
// ============================================================
// Мониторинг судов с выключенными транспондерами (AIS)
// Отслеживание подозрительной активности в стратегических зонах
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'dark-ships');
const SHIPS_FILE = join(DATA_DIR, 'ships.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const STRATEGIC_ZONES = [
  { id: 'strait-of-hormuz', name: 'Ормузский пролив', lat: 26.5, lon: 56.0, radius: 2 },
  { id: 'bab-el-mandeb', name: 'Баб-эль-Мандеб', lat: 13.0, lon: 43.5, radius: 2 },
  { id: 'suez-canal', name: 'Суэцкий канал', lat: 30.0, lon: 32.5, radius: 1.5 },
  { id: 'panama-canal', name: 'Панамский канал', lat: 9.0, lon: -79.5, radius: 1.5 },
  { id: 'malacca-strait', name: 'Малаккский пролив', lat: 1.5, lon: 102.5, radius: 2 },
  { id: 'bosphorus', name: 'Босфор', lat: 41.1, lon: 29.0, radius: 1 },
  { id: 'baltic-sea', name: 'Балтийское море', lat: 55.0, lon: 18.0, radius: 3 },
  { id: 'south-china-sea', name: 'Южно-Китайское море', lat: 15.0, lon: 115.0, radius: 4 },
  { id: 'black-sea', name: 'Чёрное море', lat: 43.0, lon: 31.0, radius: 3 },
  { id: 'gulf-of-aden', name: 'Аденский залив', lat: 12.0, lon: 48.0, radius: 3 }
];

const SHIP_TYPES = {
  cargo: { name: 'Грузовое судно', icon: '🚢', color: '#3b82f6' },
  tanker: { name: 'Танкер', icon: '🛢️', color: '#f97316' },
  fishing: { name: 'Рыболовное', icon: '🎣', color: '#22c55e' },
  military: { name: 'Военное судно', icon: '⚓', color: '#ef4444' },
  passenger: { name: 'Пассажирское', icon: '⛴️', color: '#8b5cf6' },
  unknown: { name: 'Неизвестно', icon: '❓', color: '#6b7280' }
};

// ============================================================
// 2. КЛАСС МОНИТОРИНГА ТЁМНЫХ СУДОВ
// ============================================================

class DarkShipsMonitor {
  constructor() {
    this.ships = [];
    this.history = [];
  }

  async init() {
    await this.ensureDirs();
    await this.loadShips();
    await this.loadHistory();
    console.log('[Dark Ships] Инициализирован');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadShips() {
    try {
      const data = await fs.readFile(SHIPS_FILE, 'utf-8');
      this.ships = JSON.parse(data);
    } catch (e) {
      this.ships = [];
    }
  }

  async saveShips() {
    await fs.writeFile(SHIPS_FILE, JSON.stringify(this.ships, null, 2));
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
  // 2.1. СБОР ДАННЫХ О СУДАХ
  // ============================================================

  async collectShips() {
    const ships = [];

    // Демо-данные для тёмных судов
    const darkShips = [
      { name: 'Beluga-1', type: 'tanker', lat: 26.8, lon: 56.2, status: 'suspicious', speed: 8, course: 45 },
      { name: 'Shadow-2', type: 'cargo', lat: 13.2, lon: 43.8, status: 'dark', speed: 12, course: 120 },
      { name: 'Ghost-3', type: 'military', lat: 30.5, lon: 32.8, status: 'suspicious', speed: 5, course: 270 },
      { name: 'Phantom-4', type: 'tanker', lat: 9.2, lon: -79.3, status: 'dark', speed: 15, course: 180 },
      { name: 'Shadow-5', type: 'cargo', lat: 1.8, lon: 102.2, status: 'suspicious', speed: 10, course: 90 },
      { name: 'Ghost-6', type: 'military', lat: 41.5, lon: 29.2, status: 'dark', speed: 6, course: 350 },
      { name: 'Beluga-7', type: 'tanker', lat: 55.2, lon: 18.5, status: 'suspicious', speed: 9, course: 210 },
      { name: 'Shadow-8', type: 'cargo', lat: 15.5, lon: 115.2, status: 'dark', speed: 14, course: 60 },
      { name: 'Phantom-9', type: 'military', lat: 43.2, lon: 31.5, status: 'suspicious', speed: 7, course: 150 },
      { name: 'Ghost-10', type: 'tanker', lat: 12.5, lon: 48.3, status: 'dark', speed: 11, course: 320 },
      { name: 'Shadow-11', type: 'fishing', lat: 26.0, lon: 55.5, status: 'suspicious', speed: 3, course: 40 },
      { name: 'Beluga-12', type: 'cargo', lat: 30.2, lon: 32.0, status: 'dark', speed: 13, course: 95 }
    ];

    for (const ship of darkShips) {
      // Добавляем случайные координаты в пределах зоны
      const latOffset = (Math.random() - 0.5) * 0.5;
      const lonOffset = (Math.random() - 0.5) * 0.5;
      
      // Определяем зону
      let zone = 'unknown';
      let zoneName = 'Неизвестно';
      for (const z of STRATEGIC_ZONES) {
        const dist = Math.sqrt(
          Math.pow(ship.lat + latOffset - z.lat, 2) +
          Math.pow(ship.lon + lonOffset - z.lon, 2)
        );
        if (dist < z.radius) {
          zone = z.id;
          zoneName = z.name;
          break;
        }
      }

      ships.push({
        id: `ship-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: ship.name,
        type: ship.type,
        typeLabel: SHIP_TYPES[ship.type]?.name || 'Неизвестно',
        icon: SHIP_TYPES[ship.type]?.icon || '❓',
        color: SHIP_TYPES[ship.type]?.color || '#6b7280',
        lat: ship.lat + latOffset,
        lon: ship.lon + lonOffset,
        status: ship.status,
        statusLabel: ship.status === 'dark' ? '🔴 Тёмное судно' : ship.status === 'suspicious' ? '🟡 Подозрительное' : '🟢 Нормальное',
        speed: ship.speed,
        course: ship.course,
        zone: zone,
        zoneName: zoneName,
        timestamp: new Date().toISOString(),
        risk: ship.status === 'dark' ? 85 : ship.status === 'suspicious' ? 55 : 20
      });
    }

    this.ships = ships;
    await this.saveShips();
    return ships;
  }

  // ============================================================
  // 2.2. СТАТИСТИКА
  // ============================================================

  getStats() {
    const byType = {};
    const byStatus = { dark: 0, suspicious: 0, normal: 0 };
    const byZone = {};

    for (const ship of this.ships) {
      byType[ship.type] = (byType[ship.type] || 0) + 1;
      byStatus[ship.status] = (byStatus[ship.status] || 0) + 1;
      if (ship.zone && ship.zone !== 'unknown') {
        byZone[ship.zoneName] = (byZone[ship.zoneName] || 0) + 1;
      }
    }

    return {
      total: this.ships.length,
      byType: byType,
      byStatus: byStatus,
      byZone: byZone,
      lastUpdate: new Date().toISOString()
    };
  }

  async updateAll() {
    console.log('[Dark Ships] Сбор данных о судах...');
    const ships = await this.collectShips();

    const result = {
      timestamp: new Date().toISOString(),
      ships: ships,
      stats: this.getStats(),
      summary: this.generateSummary(ships)
    };

    this.history.push(result);
    if (this.history.length > 100) this.history = this.history.slice(-100);
    await this.saveHistory();

    console.log(`[Dark Ships] Готово. Отслеживается ${ships.length} судов.`);
    return result;
  }

  generateSummary(ships) {
    const dark = ships.filter(s => s.status === 'dark');
    const suspicious = ships.filter(s => s.status === 'suspicious');
    
    let summary = '';
    if (dark.length > 0) {
      summary += `🔴 Тёмные суда (выключен AIS): ${dark.map(s => s.name).join(', ')}. `;
    }
    if (suspicious.length > 0) {
      summary += `🟡 Подозрительные суда: ${suspicious.map(s => s.name).join(', ')}. `;
    }
    if (dark.length === 0 && suspicious.length === 0) {
      summary = '🟢 Подозрительных судов не обнаружено.';
    }
    return summary;
  }

  getLatest() {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  getHistory(limit = 30) {
    return this.history.slice(-limit);
  }

  getShips() {
    return this.ships;
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let monitor = null;

async function getMonitor() {
  if (!monitor) {
    monitor = new DarkShipsMonitor();
    await monitor.init();
  }
  return monitor;
}

export async function handleDarkShipsAPI(req, res) {
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
    // GET /api/dark-ships/status
    // ============================================================
    if (path === '/api/dark-ships/status' && req.method === 'GET') {
      const stats = monitor.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'dark-ships',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // POST /api/dark-ships/update
    // ============================================================
    if (path === '/api/dark-ships/update' && req.method === 'POST') {
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
    // GET /api/dark-ships/latest
    // ============================================================
    if (path === '/api/dark-ships/latest' && req.method === 'GET') {
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
    // GET /api/dark-ships/ships
    // ============================================================
    if (path === '/api/dark-ships/ships' && req.method === 'GET') {
      const ships = monitor.getShips();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ships }));
      return;
    }

    // ============================================================
    // GET /api/dark-ships/zones
    // ============================================================
    if (path === '/api/dark-ships/zones' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, zones: STRATEGIC_ZONES }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Dark Ships API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleDarkShipsAPI, DarkShipsMonitor };
