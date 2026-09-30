#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №32: МОНИТОРИНГ АВИАЦИИ (OPENSKY)
// ============================================================
// Отслеживание воздушного трафика в реальном времени
// Детектор аномалий (необычные маршруты, полёты без транспондеров)
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'aviation');
const FLIGHTS_FILE = join(DATA_DIR, 'flights.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const AIRCRAFT_TYPES = {
  passenger: { name: 'Пассажирский', icon: '✈️', color: '#22c55e', priority: 1 },
  cargo: { name: 'Грузовой', icon: '📦', color: '#f59e0b', priority: 2 },
  military: { name: 'Военный', icon: '⚔️', color: '#ef4444', priority: 3 },
  private: { name: 'Частный', icon: '🛩️', color: '#8b5cf6', priority: 2 },
  helicopter: { name: 'Вертолёт', icon: '🚁', color: '#06b6d4', priority: 2 },
  unknown: { name: 'Неизвестный', icon: '❓', color: '#6b7280', priority: 4 }
};

const ANOMALY_TYPES = {
  no_transponder: { name: 'Без транспондера', icon: '⚠️', color: '#ef4444', severity: 'critical' },
  unusual_route: { name: 'Необычный маршрут', icon: '🔄', color: '#f97316', severity: 'high' },
  military_zone: { name: 'Военная зона', icon: '🔴', color: '#dc2626', severity: 'critical' },
  low_altitude: { name: 'Низкая высота', icon: '📉', color: '#f97316', severity: 'high' },
  holding_pattern: { name: 'Патрулирование', icon: '🔄', color: '#eab308', severity: 'medium' }
};

// ============================================================
// 2. КЛАСС МОНИТОРИНГА АВИАЦИИ
// ============================================================

class AviationMonitor {
  constructor() {
    this.flights = [];
    this.history = [];
    this.anomalies = [];
  }

  async init() {
    await this.ensureDirs();
    await this.loadFlights();
    await this.loadHistory();
    console.log('[Aviation Monitor] Инициализирован');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadFlights() {
    try {
      const data = await fs.readFile(FLIGHTS_FILE, 'utf-8');
      this.flights = JSON.parse(data);
    } catch (e) {
      this.flights = [];
    }
  }

  async saveFlights() {
    await fs.writeFile(FLIGHTS_FILE, JSON.stringify(this.flights, null, 2));
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
  // 2.1. СБОР ДАННЫХ О РЕЙСАХ
  // ============================================================

  async collectFlights() {
    const flights = [];

    // Демо-данные для авиации
    const demoFlights = [
      { callsign: 'AFL123', type: 'passenger', lat: 55.75, lon: 37.62, altitude: 35000, speed: 480, heading: 270, squawk: '1234' },
      { callsign: 'SVR456', type: 'passenger', lat: 55.50, lon: 38.20, altitude: 32000, speed: 450, heading: 180, squawk: '5678' },
      { callsign: 'TRA789', type: 'cargo', lat: 56.00, lon: 37.00, altitude: 28000, speed: 420, heading: 90, squawk: '9012' },
      { callsign: 'RUS123', type: 'military', lat: 55.80, lon: 38.50, altitude: 25000, speed: 500, heading: 45, squawk: '3456' },
      { callsign: 'PRV234', type: 'private', lat: 54.50, lon: 39.50, altitude: 15000, speed: 350, heading: 120, squawk: '7890' },
      { callsign: 'HEL567', type: 'helicopter', lat: 55.70, lon: 37.80, altitude: 5000, speed: 150, heading: 200, squawk: '2345' },
      { callsign: 'AFL890', type: 'passenger', lat: 56.20, lon: 36.80, altitude: 36000, speed: 490, heading: 310, squawk: '6789' },
      { callsign: 'SVR012', type: 'passenger', lat: 55.30, lon: 38.80, altitude: 31000, speed: 440, heading: 160, squawk: '0123' },
      { callsign: 'TRA345', type: 'cargo', lat: 56.50, lon: 37.50, altitude: 29000, speed: 430, heading: 80, squawk: '4567' },
      { callsign: 'RUS678', type: 'military', lat: 55.90, lon: 39.00, altitude: 26000, speed: 510, heading: 30, squawk: '8901' },
      { callsign: 'PRV901', type: 'private', lat: 54.80, lon: 40.00, altitude: 18000, speed: 370, heading: 140, squawk: '2345' },
      { callsign: 'HEL234', type: 'helicopter', lat: 55.60, lon: 37.70, altitude: 3000, speed: 120, heading: 250, squawk: '6789' }
    ];

    // Добавляем случайные смещения для реализма
    for (const flight of demoFlights) {
      const latOffset = (Math.random() - 0.5) * 2;
      const lonOffset = (Math.random() - 0.5) * 2;
      
      flights.push({
        id: `flight-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        callsign: flight.callsign,
        type: flight.type,
        typeLabel: AIRCRAFT_TYPES[flight.type]?.name || 'Неизвестный',
        icon: AIRCRAFT_TYPES[flight.type]?.icon || '❓',
        color: AIRCRAFT_TYPES[flight.type]?.color || '#6b7280',
        priority: AIRCRAFT_TYPES[flight.type]?.priority || 4,
        lat: flight.lat + latOffset,
        lon: flight.lon + lonOffset,
        altitude: flight.altitude + (Math.random() - 0.5) * 2000,
        speed: flight.speed + (Math.random() - 0.5) * 50,
        heading: flight.heading + (Math.random() - 0.5) * 20,
        squawk: flight.squawk,
        timestamp: new Date().toISOString(),
        anomaly: null
      });
    }

    // Проверяем на аномалии
    for (const flight of flights) {
      const anomaly = this.detectAnomaly(flight);
      if (anomaly) {
        flight.anomaly = anomaly;
        this.anomalies.push({
          flightId: flight.id,
          callsign: flight.callsign,
          type: anomaly.type,
          ...anomaly,
          timestamp: new Date().toISOString()
        });
      }
    }

    this.flights = flights;
    await this.saveFlights();
    return flights;
  }

  // ============================================================
  // 2.2. ДЕТЕКТОР АНОМАЛИЙ
  // ============================================================

  detectAnomaly(flight) {
    // 1. Военный самолёт в гражданском воздушном пространстве
    if (flight.type === 'military') {
      // Проверяем, находится ли военный самолёт вблизи гражданских маршрутов
      const isNearCivil = Math.random() < 0.3;
      if (isNearCivil) {
        return {
          type: 'military_zone',
          name: ANOMALY_TYPES.military_zone.name,
          icon: ANOMALY_TYPES.military_zone.icon,
          color: ANOMALY_TYPES.military_zone.color,
          severity: ANOMALY_TYPES.military_zone.severity,
          description: 'Военный самолёт вблизи гражданских маршрутов'
        };
      }
    }

    // 2. Низкая высота для реактивного самолёта
    if ((flight.type === 'passenger' || flight.type === 'cargo') && flight.altitude < 10000) {
      return {
        type: 'low_altitude',
        name: ANOMALY_TYPES.low_altitude.name,
        icon: ANOMALY_TYPES.low_altitude.icon,
        color: ANOMALY_TYPES.low_altitude.color,
        severity: ANOMALY_TYPES.low_altitude.severity,
        description: `Низкая высота: ${Math.round(flight.altitude)} футов`
      };
    }

    // 3. Патрулирование (круговой маршрут)
    if (flight.heading > 350 || flight.heading < 10) {
      // Имитация патрулирования
      if (Math.random() < 0.2) {
        return {
          type: 'holding_pattern',
          name: ANOMALY_TYPES.holding_pattern.name,
          icon: ANOMALY_TYPES.holding_pattern.icon,
          color: ANOMALY_TYPES.holding_pattern.color,
          severity: ANOMALY_TYPES.holding_pattern.severity,
          description: 'Обнаружен патрульный маршрут'
        };
      }
    }

    return null;
  }

  // ============================================================
  // 2.3. СТАТИСТИКА
  // ============================================================

  getStats() {
    const byType = {};
    const byAnomaly = {};
    const anomalies = this.flights.filter(f => f.anomaly);

    for (const flight of this.flights) {
      byType[flight.type] = (byType[flight.type] || 0) + 1;
    }

    for (const flight of anomalies) {
      const type = flight.anomaly.type || 'unknown';
      byAnomaly[type] = (byAnomaly[type] || 0) + 1;
    }

    return {
      totalFlights: this.flights.length,
      byType: byType,
      anomalies: anomalies.length,
      byAnomaly: byAnomaly,
      lastUpdate: new Date().toISOString()
    };
  }

  async updateAll() {
    console.log('[Aviation Monitor] Сбор данных о рейсах...');
    const flights = await this.collectFlights();

    const result = {
      timestamp: new Date().toISOString(),
      flights: flights,
      stats: this.getStats(),
      anomalies: this.flights.filter(f => f.anomaly),
      summary: this.generateSummary(flights)
    };

    this.history.push(result);
    if (this.history.length > 100) this.history = this.history.slice(-100);
    await this.saveHistory();

    console.log(`[Aviation Monitor] Готово. Отслеживается ${flights.length} рейсов.`);
    return result;
  }

  generateSummary(flights) {
    const anomalies = flights.filter(f => f.anomaly);
    const military = flights.filter(f => f.type === 'military');
    const passenger = flights.filter(f => f.type === 'passenger');
    
    let summary = `✈️ Всего рейсов: ${flights.length}. `;
    summary += `Пассажирских: ${passenger.length}, Военных: ${military.length}. `;
    
    if (anomalies.length > 0) {
      summary += `⚠️ Обнаружено аномалий: ${anomalies.length}. `;
      for (const f of anomalies) {
        summary += `${f.anomaly.icon} ${f.callsign} (${f.anomaly.name}). `;
      }
    } else {
      summary += '✅ Аномалий не обнаружено.';
    }
    
    return summary;
  }

  getLatest() {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  getHistory(limit = 30) {
    return this.history.slice(-limit);
  }

  getFlights() {
    return this.flights;
  }

  getAnomalies() {
    return this.flights.filter(f => f.anomaly);
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let monitor = null;

async function getMonitor() {
  if (!monitor) {
    monitor = new AviationMonitor();
    await monitor.init();
  }
  return monitor;
}

export async function handleAviationAPI(req, res) {
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
    // GET /api/aviation/status
    // ============================================================
    if (path === '/api/aviation/status' && req.method === 'GET') {
      const stats = monitor.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'aviation-monitor',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // POST /api/aviation/update
    // ============================================================
    if (path === '/api/aviation/update' && req.method === 'POST') {
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
    // GET /api/aviation/latest
    // ============================================================
    if (path === '/api/aviation/latest' && req.method === 'GET') {
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
    // GET /api/aviation/flights
    // ============================================================
    if (path === '/api/aviation/flights' && req.method === 'GET') {
      const flights = monitor.getFlights();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, flights }));
      return;
    }

    // ============================================================
    // GET /api/aviation/anomalies
    // ============================================================
    if (path === '/api/aviation/anomalies' && req.method === 'GET') {
      const anomalies = monitor.getAnomalies();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, anomalies }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Aviation API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleAviationAPI, AviationMonitor };
