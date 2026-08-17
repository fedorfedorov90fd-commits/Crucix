#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №33: МОНИТОРИНГ МОРСКОГО ТРАФИКА (MARITIME MONITOR)
// ============================================================
// Отслеживание судов через AIS
// Детектор тёмных судов (выключенные транспондеры)
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'maritime');
const VESSELS_FILE = join(DATA_DIR, 'vessels.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const VESSEL_TYPES = {
  cargo: { name: 'Грузовое', icon: '🚢', color: '#3b82f6', priority: 2 },
  tanker: { name: 'Танкер', icon: '🛢️', color: '#f59e0b', priority: 2 },
  fishing: { name: 'Рыболовное', icon: '🎣', color: '#22c55e', priority: 3 },
  passenger: { name: 'Пассажирское', icon: '⛴️', color: '#8b5cf6', priority: 2 },
  military: { name: 'Военное', icon: '⚓', color: '#ef4444', priority: 1 },
  unknown: { name: 'Неизвестное', icon: '❓', color: '#6b7280', priority: 4 }
};

const STRATEGIC_ZONES = [
  { id: 'strait-of-hormuz', name: 'Ормузский пролив', lat: 26.5, lon: 56.0, radius: 2 },
  { id: 'bab-el-mandeb', name: 'Баб-эль-Мандеб', lat: 13.0, lon: 43.5, radius: 2 },
  { id: 'suez-canal', name: 'Суэцкий канал', lat: 30.0, lon: 32.5, radius: 1.5 },
  { id: 'panama-canal', name: 'Панамский канал', lat: 9.0, lon: -79.5, radius: 1.5 },
  { id: 'malacca-strait', name: 'Малаккский пролив', lat: 1.5, lon: 102.5, radius: 2 },
  { id: 'bosphorus', name: 'Босфор', lat: 41.1, lon: 29.0, radius: 1 },
  { id: 'baltic-sea', name: 'Балтийское море', lat: 55.0, lon: 18.0, radius: 3 },
  { id: 'south-china-sea', name: 'Южно-Китайское море', lat: 15.0, lon: 115.0, radius: 4 },
  { id: 'black-sea', name: 'Чёрное море', lat: 43.0, lon: 31.0, radius: 3 }
];

// ============================================================
// 2. КЛАСС МОНИТОРИНГА МОРСКОГО ТРАФИКА
// ============================================================

class MaritimeMonitor {
  constructor() {
    this.vessels = [];
    this.history = [];
  }

  async init() {
    await this.ensureDirs();
    await this.loadVessels();
    await this.loadHistory();
    console.log('[Maritime Monitor] Инициализирован');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadVessels() {
    try {
      const data = await fs.readFile(VESSELS_FILE, 'utf-8');
      this.vessels = JSON.parse(data);
    } catch (e) {
      this.vessels = [];
    }
  }

  async saveVessels() {
    await fs.writeFile(VESSELS_FILE, JSON.stringify(this.vessels, null, 2));
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

  async collectVessels() {
    const vessels = [];

    // Демо-данные для судов
    const demoVessels = [
      { name: 'Ever Given', type: 'cargo', lat: 30.0, lon: 32.5, speed: 8, heading: 45, status: 'normal' },
      { name: 'MSC Oscar', type: 'cargo', lat: 1.5, lon: 102.5, speed: 15, heading: 120, status: 'normal' },
      { name: 'Tanker-1', type: 'tanker', lat: 26.5, lon: 56.0, speed: 5, heading: 270, status: 'suspicious' },
      { name: 'Costa Smeralda', type: 'passenger', lat: 41.1, lon: 29.0, speed: 10, heading: 350, status: 'normal' },
      { name: 'Fishing-1', type: 'fishing', lat: 55.0, lon: 18.0, speed: 3, heading: 90, status: 'normal' },
      { name: 'Warship-1', type: 'military', lat: 43.0, lon: 31.0, speed: 12, heading: 180, status: 'dark' },
      { name: 'Tanker-2', type: 'tanker', lat: 13.0, lon: 43.5, speed: 6, heading: 150, status: 'dark' },
      { name: 'Ever Fortune', type: 'cargo', lat: 9.0, lon: -79.5, speed: 14, heading: 80, status: 'normal' },
      { name: 'Warship-2', type: 'military', lat: 15.0, lon: 115.0, speed: 18, heading: 60, status: 'suspicious' },
      { name: 'Tanker-3', type: 'tanker', lat: 26.8, lon: 55.5, speed: 4, heading: 45, status: 'dark' },
      { name: 'Cargo-1', type: 'cargo', lat: 30.5, lon: 32.0, speed: 9, heading: 270, status: 'normal' },
      { name: 'Fishing-2', type: 'fishing', lat: 55.5, lon: 18.5, speed: 2, heading: 200, status: 'normal' }
    ];

    for (const vessel of demoVessels) {
      const latOffset = (Math.random() - 0.5) * 0.3;
      const lonOffset = (Math.random() - 0.5) * 0.3;
      
      // Определяем зону
      let zone = 'unknown';
      let zoneName = 'Открытое море';
      for (const z of STRATEGIC_ZONES) {
        const dist = Math.sqrt(
          Math.pow(vessel.lat + latOffset - z.lat, 2) +
          Math.pow(vessel.lon + lonOffset - z.lon, 2)
        );
        if (dist < z.radius) {
          zone = z.id;
          zoneName = z.name;
          break;
        }
      }

      // Статус
      let statusLabel = '🟢 Нормальное';
      let risk = 0;
      if (vessel.status === 'dark') {
        statusLabel = '🔴 Тёмное судно';
        risk = 85;
      } else if (vessel.status === 'suspicious') {
        statusLabel = '🟡 Подозрительное';
        risk = 55;
      }

      vessels.push({
        id: `vessel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: vessel.name,
        type: vessel.type,
        typeLabel: VESSEL_TYPES[vessel.type]?.name || 'Неизвестное',
        icon: VESSEL_TYPES[vessel.type]?.icon || '❓',
        color: VESSEL_TYPES[vessel.type]?.color || '#6b7280',
        priority: VESSEL_TYPES[vessel.type]?.priority || 4,
        lat: vessel.lat + latOffset,
        lon: vessel.lon + lonOffset,
        speed: vessel.speed + (Math.random() - 0.5) * 2,
        heading: vessel.heading + (Math.random() - 0.5) * 10,
        status: vessel.status,
        statusLabel: statusLabel,
        risk: risk,
        zone: zone,
        zoneName: zoneName,
        timestamp: new Date().toISOString()
      });
    }

    this.vessels = vessels;
    await this.saveVessels();
    return vessels;
  }

  // ============================================================
  // 2.2. СТАТИСТИКА
  // ============================================================

  getStats() {
    const byType = {};
    const byStatus = { normal: 0, suspicious: 0, dark: 0 };
    const byZone = {};

    for (const v of this.vessels) {
      byType[v.type] = (byType[v.type] || 0) + 1;
      byStatus[v.status] = (byStatus[v.status] || 0) + 1;
      if (v.zone && v.zone !== 'unknown') {
        byZone[v.zoneName] = (byZone[v.zoneName] || 0) + 1;
      }
    }

    return {
      totalVessels: this.vessels.length,
      byType: byType,
      byStatus: byStatus,
      byZone: byZone,
      lastUpdate: new Date().toISOString()
    };
  }

  async updateAll() {
    console.log('[Maritime Monitor] Сбор данных о судах...');
    const vessels = await this.collectVessels();

    const result = {
      timestamp: new Date().toISOString(),
      vessels: vessels,
      stats: this.getStats(),
      summary: this.generateSummary(vessels)
    };

    this.history.push(result);
    if (this.history.length > 100) this.history = this.history.slice(-100);
    await this.saveHistory();

    console.log(`[Maritime Monitor] Готово. Отслеживается ${vessels.length} судов.`);
    return result;
  }

  generateSummary(vessels) {
    const dark = vessels.filter(v => v.status === 'dark');
    const suspicious = vessels.filter(v => v.status === 'suspicious');
    const military = vessels.filter(v => v.type === 'military');
    
    let summary = `🚢 Всего судов: ${vessels.length}. `;
    summary += `Грузовых: ${vessels.filter(v => v.type === 'cargo').length}, Танкеров: ${vessels.filter(v => v.type === 'tanker').length}. `;
    
    if (dark.length > 0) {
      summary += `🔴 Тёмные суда: ${dark.map(v => v.name).join(', ')}. `;
    }
    if (suspicious.length > 0) {
      summary += `🟡 Подозрительные: ${suspicious.map(v => v.name).join(', ')}. `;
    }
    if (military.length > 0) {
      summary += `⚓ Военные: ${military.map(v => v.name).join(', ')}. `;
    }
    if (dark.length === 0 && suspicious.length === 0) {
      summary += '✅ Подозрительных судов не обнаружено.';
    }
    
    return summary;
  }

  getLatest() {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  getHistory(limit = 30) {
    return this.history.slice(-limit);
  }

  getVessels() {
    return this.vessels;
  }

  getZones() {
    return STRATEGIC_ZONES;
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let monitor = null;

async function getMonitor() {
  if (!monitor) {
    monitor = new MaritimeMonitor();
    await monitor.init();
  }
  return monitor;
}

export async function handleMaritimeAPI(req, res) {
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
    // GET /api/maritime/status
    // ============================================================
    if (path === '/api/maritime/status' && req.method === 'GET') {
      const stats = monitor.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'maritime-monitor',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // POST /api/maritime/update
    // ============================================================
    if (path === '/api/maritime/update' && req.method === 'POST') {
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
    // GET /api/maritime/latest
    // ============================================================
    if (path === '/api/maritime/latest' && req.method === 'GET') {
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
    // GET /api/maritime/vessels
    // ============================================================
    if (path === '/api/maritime/vessels' && req.method === 'GET') {
      const vessels = monitor.getVessels();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, vessels }));
      return;
    }

    // ============================================================
    // GET /api/maritime/zones
    // ============================================================
    if (path === '/api/maritime/zones' && req.method === 'GET') {
      const zones = monitor.getZones();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, zones }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Maritime API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleMaritimeAPI, MaritimeMonitor };
