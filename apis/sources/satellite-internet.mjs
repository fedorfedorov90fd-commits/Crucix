#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №29: СПУТНИКОВЫЙ ИНТЕРНЕТ (SATELLITE INTERNET)
// ============================================================
// Мониторинг орбитальных группировок: Starlink, OneWeb, GPS, GEO
// Отображение количества спутников, статуса и покрытия
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'satellite-internet');
const CONSTELLATIONS_FILE = join(DATA_DIR, 'constellations.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ ОРБИТАЛЬНЫХ ГРУППИРОВОК
// ============================================================

const CONSTELLATIONS = [
  {
    id: 'starlink',
    name: 'Starlink',
    provider: 'SpaceX',
    type: 'LEO',
    altitude: 550,
    inclination: 53,
    total: 10119,
    active: 9500,
    operational: 9200,
    color: '#8b5cf6',
    description: 'Крупнейшая спутниковая группировка для широкополосного интернета'
  },
  {
    id: 'oneweb',
    name: 'OneWeb',
    provider: 'Eutelsat',
    type: 'LEO',
    altitude: 1200,
    inclination: 87.9,
    total: 651,
    active: 634,
    operational: 600,
    color: '#3b82f6',
    description: 'Глобальная спутниковая сеть для широкополосного доступа'
  },
  {
    id: 'gps',
    name: 'GPS',
    provider: 'US Space Force',
    type: 'MEO',
    altitude: 20200,
    inclination: 55,
    total: 31,
    active: 31,
    operational: 29,
    color: '#22c55e',
    description: 'Глобальная система позиционирования (США)'
  },
  {
    id: 'glonass',
    name: 'GLONASS',
    provider: 'Роскосмос',
    type: 'MEO',
    altitude: 19100,
    inclination: 64.8,
    total: 26,
    active: 24,
    operational: 22,
    color: '#ef4444',
    description: 'Глобальная навигационная спутниковая система (Россия)'
  },
  {
    id: 'galileo',
    name: 'Galileo',
    provider: 'ESA',
    type: 'MEO',
    altitude: 23222,
    inclination: 56,
    total: 28,
    active: 28,
    operational: 26,
    color: '#f59e0b',
    description: 'Европейская глобальная навигационная система'
  },
  {
    id: 'geo',
    name: 'GEO Satellites',
    provider: 'Various',
    type: 'GEO',
    altitude: 35786,
    inclination: 0,
    total: 542,
    active: 520,
    operational: 490,
    color: '#ec4899',
    description: 'Геостационарные спутники связи и наблюдения'
  },
  {
    id: 'iridium',
    name: 'Iridium',
    provider: 'Iridium Communications',
    type: 'LEO',
    altitude: 780,
    inclination: 86.4,
    total: 75,
    active: 75,
    operational: 72,
    color: '#06b6d4',
    description: 'Глобальная спутниковая система связи (66 активных)'
  },
  {
    id: 'telesat',
    name: 'Telesat LEO',
    provider: 'Telesat',
    type: 'LEO',
    altitude: 1000,
    inclination: 98.2,
    total: 298,
    active: 150,
    operational: 120,
    color: '#8b5cf6',
    description: 'Канадская спутниковая группировка в разработке'
  }
];

// ============================================================
// 2. КЛАСС МОНИТОРИНГА СПУТНИКОВОГО ИНТЕРНЕТА
// ============================================================

class SatelliteInternetMonitor {
  constructor() {
    this.constellations = [];
    this.history = [];
  }

  async init() {
    await this.ensureDirs();
    await this.loadConstellations();
    await this.loadHistory();
    console.log('[Satellite Internet] Инициализирован');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadConstellations() {
    try {
      const data = await fs.readFile(CONSTELLATIONS_FILE, 'utf-8');
      this.constellations = JSON.parse(data);
    } catch (e) {
      this.constellations = CONSTELLATIONS.map(c => ({
        ...c,
        lastUpdate: null,
        status: 'operational'
      }));
      await this.saveConstellations();
    }
  }

  async saveConstellations() {
    await fs.writeFile(CONSTELLATIONS_FILE, JSON.stringify(this.constellations, null, 2));
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
  // 2.1. СБОР ДАННЫХ
  // ============================================================

  async collectData() {
    const now = new Date().toISOString();
    
    // Обновляем статусы (симуляция)
    const updated = this.constellations.map(c => {
      // Добавляем небольшие случайные изменения
      const variation = (Math.random() - 0.5) * 10;
      const operational = Math.max(0, Math.min(c.total, c.operational + variation));
      
      return {
        ...c,
        operational: Math.round(operational),
        active: Math.round(Math.min(c.total, operational * 0.95 + Math.random() * 10)),
        lastUpdate: now,
        status: operational > c.total * 0.7 ? 'operational' : 
                operational > c.total * 0.4 ? 'degraded' : 'critical'
      };
    });

    this.constellations = updated;
    await this.saveConstellations();
    return updated;
  }

  // ============================================================
  // 2.2. СТАТИСТИКА
  // ============================================================

  getStats() {
    const total = this.constellations.reduce((sum, c) => sum + c.total, 0);
    const active = this.constellations.reduce((sum, c) => sum + (c.active || 0), 0);
    const operational = this.constellations.reduce((sum, c) => sum + (c.operational || 0), 0);
    
    const byType = {};
    const byStatus = { operational: 0, degraded: 0, critical: 0 };
    
    for (const c of this.constellations) {
      byType[c.type] = (byType[c.type] || 0) + c.total;
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    }

    return {
      totalSatellites: total,
      activeSatellites: active,
      operationalSatellites: operational,
      constellations: this.constellations.length,
      byType: byType,
      byStatus: byStatus,
      lastUpdate: new Date().toISOString()
    };
  }

  async updateAll() {
    console.log('[Satellite Internet] Сбор данных о спутниковых группировках...');
    const data = await this.collectData();

    const result = {
      timestamp: new Date().toISOString(),
      constellations: data,
      stats: this.getStats(),
      summary: this.generateSummary(data)
    };

    this.history.push(result);
    if (this.history.length > 100) this.history = this.history.slice(-100);
    await this.saveHistory();

    console.log(`[Satellite Internet] Готово. Отслеживается ${data.length} группировок.`);
    return result;
  }

  generateSummary(constellations) {
    const total = constellations.reduce((sum, c) => sum + c.total, 0);
    const operational = constellations.reduce((sum, c) => sum + (c.operational || 0), 0);
    const degraded = constellations.filter(c => c.status === 'degraded');
    const critical = constellations.filter(c => c.status === 'critical');
    
    let summary = `🛰️ Всего спутников: ${total}. Активных: ${operational} (${Math.round(operational/total*100)}%). `;
    if (critical.length > 0) {
      summary += `🔴 Критическое состояние: ${critical.map(c => c.name).join(', ')}. `;
    }
    if (degraded.length > 0) {
      summary += `🟡 Снижена работоспособность: ${degraded.map(c => c.name).join(', ')}. `;
    }
    if (critical.length === 0 && degraded.length === 0) {
      summary += '✅ Все группировки работают штатно.';
    }
    return summary;
  }

  getLatest() {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  getHistory(limit = 30) {
    return this.history.slice(-limit);
  }

  getConstellations() {
    return this.constellations;
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let monitor = null;

async function getMonitor() {
  if (!monitor) {
    monitor = new SatelliteInternetMonitor();
    await monitor.init();
  }
  return monitor;
}

export async function handleSatelliteInternetAPI(req, res) {
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
    // GET /api/satellite-internet/status
    // ============================================================
    if (path === '/api/satellite-internet/status' && req.method === 'GET') {
      const stats = monitor.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'satellite-internet',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // POST /api/satellite-internet/update
    // ============================================================
    if (path === '/api/satellite-internet/update' && req.method === 'POST') {
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
    // GET /api/satellite-internet/latest
    // ============================================================
    if (path === '/api/satellite-internet/latest' && req.method === 'GET') {
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
    // GET /api/satellite-internet/constellations
    // ============================================================
    if (path === '/api/satellite-internet/constellations' && req.method === 'GET') {
      const constellations = monitor.getConstellations();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, constellations }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Satellite Internet API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleSatelliteInternetAPI, SatelliteInternetMonitor };
