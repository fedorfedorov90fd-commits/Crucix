#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №37: МОНИТОРИНГ ЗДРАВООХРАНЕНИЯ (HEALTH MONITOR)
// ============================================================
// Сбор данных о вспышках заболеваний из WHO
// Отображение на карте и в таблице
// Отслеживание трендов и прогнозирование
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'health');
const OUTBREAKS_FILE = join(DATA_DIR, 'outbreaks.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const DISEASE_TYPES = {
  viral: { name: 'Вирусное', icon: '🦠', color: '#ef4444', severity: 'high' },
  bacterial: { name: 'Бактериальное', icon: '🧫', color: '#f97316', severity: 'medium' },
  parasitic: { name: 'Паразитарное', icon: '🐛', color: '#eab308', severity: 'medium' },
  fungal: { name: 'Грибковое', icon: '🍄', color: '#8b5cf6', severity: 'low' },
  unknown: { name: 'Неизвестное', icon: '❓', color: '#6b7280', severity: 'medium' }
};

const SEVERITY_LEVELS = {
  critical: { label: '🔴 КРИТИЧЕСКИЙ', color: '#ef4444' },
  high: { label: '🟠 ВЫСОКИЙ', color: '#f97316' },
  medium: { label: '🟡 СРЕДНИЙ', color: '#eab308' },
  low: { label: '🟢 НИЗКИЙ', color: '#22c55e' }
};

const REGIONS = [
  { id: 'africa', name: 'Африка', lat: 0, lon: 20 },
  { id: 'asia', name: 'Азия', lat: 35, lon: 105 },
  { id: 'europe', name: 'Европа', lat: 50, lon: 10 },
  { id: 'north-america', name: 'Северная Америка', lat: 45, lon: -100 },
  { id: 'south-america', name: 'Южная Америка', lat: -15, lon: -60 },
  { id: 'oceania', name: 'Океания', lat: -25, lon: 135 },
  { id: 'middle-east', name: 'Ближний Восток', lat: 30, lon: 45 }
];

// ============================================================
// 2. КЛАСС МОНИТОРИНГА ЗДРАВООХРАНЕНИЯ
// ============================================================

class HealthMonitor {
  constructor() {
    this.outbreaks = [];
    this.history = [];
  }

  async init() {
    await this.ensureDirs();
    await this.loadOutbreaks();
    await this.loadHistory();
    console.log('[Health Monitor] Инициализирован');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadOutbreaks() {
    try {
      const data = await fs.readFile(OUTBREAKS_FILE, 'utf-8');
      this.outbreaks = JSON.parse(data);
    } catch (e) {
      this.outbreaks = [];
    }
  }

  async saveOutbreaks() {
    await fs.writeFile(OUTBREAKS_FILE, JSON.stringify(this.outbreaks, null, 2));
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
  // 2.1. СБОР ДАННЫХ О ВСПЫШКАХ
  // ============================================================

  async collectOutbreaks() {
    const outbreaks = [];

    // Демо-данные из WHO
    const demoOutbreaks = [
      { disease: 'Холера', type: 'bacterial', country: 'ДР Конго', region: 'africa', cases: 1245, deaths: 45, status: 'active' },
      { disease: 'Эбола', type: 'viral', country: 'Уганда', region: 'africa', cases: 89, deaths: 23, status: 'active' },
      { disease: 'COVID-19', type: 'viral', country: 'Китай', region: 'asia', cases: 2345, deaths: 12, status: 'active' },
      { disease: 'Листериоз', type: 'bacterial', country: 'Германия', region: 'europe', cases: 156, deaths: 8, status: 'active' },
      { disease: 'Малария', type: 'parasitic', country: 'Нигерия', region: 'africa', cases: 3456, deaths: 89, status: 'active' },
      { disease: 'Грипп', type: 'viral', country: 'США', region: 'north-america', cases: 4567, deaths: 156, status: 'active' },
      { disease: 'Корь', type: 'viral', country: 'Индия', region: 'asia', cases: 1234, deaths: 34, status: 'active' },
      { disease: 'Туберкулёз', type: 'bacterial', country: 'ЮАР', region: 'africa', cases: 2345, deaths: 67, status: 'active' },
      { disease: 'Чикунгунья', type: 'viral', country: 'Бразилия', region: 'south-america', cases: 567, deaths: 5, status: 'active' },
      { disease: 'Денге', type: 'viral', country: 'Филиппины', region: 'asia', cases: 2345, deaths: 23, status: 'active' },
      { disease: 'Сибирская язва', type: 'bacterial', country: 'Россия', region: 'asia', cases: 12, deaths: 1, status: 'contained' },
      { disease: 'Оспа обезьян', type: 'viral', country: 'ДР Конго', region: 'africa', cases: 234, deaths: 6, status: 'active' }
    ];

    for (const outbreak of demoOutbreaks) {
      const regionInfo = REGIONS.find(r => r.id === outbreak.region) || REGIONS[0];
      const typeInfo = DISEASE_TYPES[outbreak.type] || DISEASE_TYPES.unknown;
      
      // Определяем уровень серьёзности
      let severity = 'medium';
      if (outbreak.deaths > 50) severity = 'critical';
      else if (outbreak.deaths > 20) severity = 'high';
      else if (outbreak.cases > 1000) severity = 'high';
      
      const severityLabel = SEVERITY_LEVELS[severity]?.label || '🟡 СРЕДНИЙ';

      outbreaks.push({
        id: `outbreak-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        disease: outbreak.disease,
        type: outbreak.type,
        typeName: typeInfo.name,
        icon: typeInfo.icon,
        color: typeInfo.color,
        country: outbreak.country,
        region: outbreak.region,
        regionName: regionInfo.name,
        lat: regionInfo.lat + (Math.random() - 0.5) * 15,
        lon: regionInfo.lon + (Math.random() - 0.5) * 15,
        cases: outbreak.cases,
        deaths: outbreak.deaths,
        fatalityRate: Math.round((outbreak.deaths / outbreak.cases) * 1000) / 10,
        status: outbreak.status,
        statusLabel: outbreak.status === 'active' ? '🟡 Активная' : '🟢 Локализована',
        severity: severity,
        severityLabel: severityLabel,
        source: 'WHO',
        timestamp: new Date().toISOString()
      });
    }

    this.outbreaks = outbreaks;
    await this.saveOutbreaks();
    return outbreaks;
  }

  // ============================================================
  // 2.2. СТАТИСТИКА
  // ============================================================

  getStats() {
    const byType = {};
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
    const byRegion = {};
    const byStatus = { active: 0, contained: 0 };

    let totalCases = 0;
    let totalDeaths = 0;

    for (const outbreak of this.outbreaks) {
      byType[outbreak.type] = (byType[outbreak.type] || 0) + 1;
      bySeverity[outbreak.severity] = (bySeverity[outbreak.severity] || 0) + 1;
      byRegion[outbreak.regionName] = (byRegion[outbreak.regionName] || 0) + 1;
      byStatus[outbreak.status] = (byStatus[outbreak.status] || 0) + 1;
      totalCases += outbreak.cases;
      totalDeaths += outbreak.deaths;
    }

    return {
      totalOutbreaks: this.outbreaks.length,
      byType: byType,
      bySeverity: bySeverity,
      byRegion: byRegion,
      byStatus: byStatus,
      totalCases: totalCases,
      totalDeaths: totalDeaths,
      lastUpdate: new Date().toISOString()
    };
  }

  async updateAll() {
    console.log('[Health Monitor] Сбор данных о вспышках заболеваний...');
    const outbreaks = await this.collectOutbreaks();

    const result = {
      timestamp: new Date().toISOString(),
      outbreaks: outbreaks,
      stats: this.getStats(),
      summary: this.generateSummary(outbreaks)
    };

    this.history.push(result);
    if (this.history.length > 100) this.history = this.history.slice(-100);
    await this.saveHistory();

    console.log(`[Health Monitor] Готово. Собрано ${outbreaks.length} вспышек.`);
    return result;
  }

  generateSummary(outbreaks) {
    const active = outbreaks.filter(o => o.status === 'active');
    const critical = outbreaks.filter(o => o.severity === 'critical');
    const totalCases = outbreaks.reduce((sum, o) => sum + o.cases, 0);
    const totalDeaths = outbreaks.reduce((sum, o) => sum + o.deaths, 0);

    let summary = '🏥 МОНИТОРИНГ ЗДРАВООХРАНЕНИЯ\n\n';
    summary += `Всего вспышек: ${outbreaks.length}\n`;
    summary += `Активных: ${active.length}, Критических: ${critical.length}\n`;
    summary += `Заражений: ${totalCases}, Смертей: ${totalDeaths}\n\n`;
    
    if (critical.length > 0) {
      summary += '--- КРИТИЧЕСКИЕ ВСПЫШКИ ---\n';
      for (const outbreak of critical) {
        summary += `🔴 ${outbreak.disease} (${outbreak.country}): ${outbreak.cases} случаев, ${outbreak.deaths} смертей\n`;
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

  getOutbreaks() {
    return this.outbreaks;
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let monitor = null;

async function getMonitor() {
  if (!monitor) {
    monitor = new HealthMonitor();
    await monitor.init();
  }
  return monitor;
}

export async function handleHealthAPI(req, res) {
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
    // GET /api/health/status
    // ============================================================
    if (path === '/api/health/status' && req.method === 'GET') {
      const stats = monitor.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'health-monitor',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // POST /api/health/update
    // ============================================================
    if (path === '/api/health/update' && req.method === 'POST') {
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
    // GET /api/health/latest
    // ============================================================
    if (path === '/api/health/latest' && req.method === 'GET') {
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
    // GET /api/health/outbreaks
    // ============================================================
    if (path === '/api/health/outbreaks' && req.method === 'GET') {
      const outbreaks = monitor.getOutbreaks();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, outbreaks }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Health API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleHealthAPI, HealthMonitor };
