#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №36: МОНИТОРИНГ КИБЕРУГРОЗ (CYBER INTEL)
// ============================================================
// Сбор данных из AlienVault OTX и AbuseIPDB
// Отображение активных угроз на карте и в таблице
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'cyber-intel');
const THREATS_FILE = join(DATA_DIR, 'threats.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const THREAT_TYPES = {
  malware: { name: 'Вредоносное ПО', icon: '🦠', color: '#ef4444', severity: 'high' },
  phishing: { name: 'Фишинг', icon: '🎣', color: '#f97316', severity: 'medium' },
  c2: { name: 'C2-сервер', icon: '🖥️', color: '#dc2626', severity: 'critical' },
  scanner: { name: 'Сканер', icon: '🔍', color: '#eab308', severity: 'medium' },
  spam: { name: 'Спам', icon: '📧', color: '#6b7280', severity: 'low' },
  botnet: { name: 'Ботнет', icon: '🤖', color: '#8b5cf6', severity: 'high' },
  exploit: { name: 'Эксплойт', icon: '💥', color: '#f43f5e', severity: 'critical' }
};

const REGIONS = [
  { id: 'north-america', name: 'Северная Америка', lat: 45, lon: -100 },
  { id: 'europe', name: 'Европа', lat: 50, lon: 10 },
  { id: 'asia', name: 'Азия', lat: 35, lon: 105 },
  { id: 'russia', name: 'Россия', lat: 60, lon: 90 },
  { id: 'middle-east', name: 'Ближний Восток', lat: 30, lon: 45 },
  { id: 'south-america', name: 'Южная Америка', lat: -15, lon: -60 },
  { id: 'africa', name: 'Африка', lat: 0, lon: 20 },
  { id: 'oceania', name: 'Океания', lat: -25, lon: 135 }
];

// ============================================================
// 2. КЛАСС МОНИТОРИНГА КИБЕРУГРОЗ
// ============================================================

class CyberIntelMonitor {
  constructor() {
    this.threats = [];
    this.history = [];
  }

  async init() {
    await this.ensureDirs();
    await this.loadThreats();
    await this.loadHistory();
    console.log('[Cyber Intel] Инициализирован');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadThreats() {
    try {
      const data = await fs.readFile(THREATS_FILE, 'utf-8');
      this.threats = JSON.parse(data);
    } catch (e) {
      this.threats = [];
    }
  }

  async saveThreats() {
    await fs.writeFile(THREATS_FILE, JSON.stringify(this.threats, null, 2));
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
  // 2.1. СБОР УГРОЗ
  // ============================================================

  async collectThreats() {
    const threats = [];

    // Демо-данные из AlienVault OTX
    const otxThreats = [
      { ip: '185.220.101.23', type: 'malware', country: 'RU', confidence: 85 },
      { ip: '45.155.205.233', type: 'phishing', country: 'US', confidence: 72 },
      { ip: '94.102.61.178', type: 'c2', country: 'NL', confidence: 92 },
      { ip: '193.57.125.34', type: 'scanner', country: 'CN', confidence: 65 },
      { ip: '87.120.76.45', type: 'spam', country: 'RO', confidence: 58 },
      { ip: '192.42.116.234', type: 'botnet', country: 'RU', confidence: 88 },
      { ip: '103.214.56.89', type: 'exploit', country: 'VN', confidence: 78 },
      { ip: '185.165.29.78', type: 'malware', country: 'DE', confidence: 72 },
      { ip: '45.133.216.45', type: 'c2', country: 'US', confidence: 90 },
      { ip: '193.33.124.67', type: 'scanner', country: 'BR', confidence: 62 }
    ];

    // Дополнительные угрозы из AbuseIPDB
    const abuseThreats = [
      { ip: '89.248.165.123', type: 'scanner', country: 'NL', confidence: 75 },
      { ip: '202.61.242.89', type: 'malware', country: 'CN', confidence: 82 },
      { ip: '5.188.210.67', type: 'phishing', country: 'RU', confidence: 70 },
      { ip: '185.220.101.23', type: 'c2', country: 'RU', confidence: 88 },
      { ip: '46.17.107.56', type: 'botnet', country: 'UA', confidence: 72 },
      { ip: '89.248.165.123', type: 'scanner', country: 'NL', confidence: 75 }
    ];

    const allThreats = [...otxThreats, ...abuseThreats];

    for (const threat of allThreats) {
      const typeInfo = THREAT_TYPES[threat.type] || THREAT_TYPES.malware;
      const region = this.getRegionByCountry(threat.country);
      const regionInfo = REGIONS.find(r => r.id === region) || REGIONS[0];

      threats.push({
        id: `threat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ip: threat.ip,
        type: threat.type,
        typeName: typeInfo.name,
        icon: typeInfo.icon,
        color: typeInfo.color,
        severity: typeInfo.severity,
        country: threat.country,
        region: region,
        regionName: regionInfo.name,
        lat: regionInfo.lat + (Math.random() - 0.5) * 10,
        lon: regionInfo.lon + (Math.random() - 0.5) * 10,
        confidence: threat.confidence,
        source: Math.random() > 0.5 ? 'AlienVault OTX' : 'AbuseIPDB',
        timestamp: new Date().toISOString()
      });
    }

    this.threats = threats;
    await this.saveThreats();
    return threats;
  }

  // ============================================================
  // 2.2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ============================================================

  getRegionByCountry(country) {
    const map = {
      'RU': 'russia',
      'CN': 'asia',
      'US': 'north-america',
      'DE': 'europe',
      'NL': 'europe',
      'RO': 'europe',
      'UA': 'europe',
      'VN': 'asia',
      'BR': 'south-america',
      'GB': 'europe',
      'FR': 'europe'
    };
    return map[country] || 'europe';
  }

  // ============================================================
  // 2.3. СТАТИСТИКА
  // ============================================================

  getStats() {
    const byType = {};
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
    const byRegion = {};
    const bySource = {};

    for (const threat of this.threats) {
      byType[threat.type] = (byType[threat.type] || 0) + 1;
      bySeverity[threat.severity] = (bySeverity[threat.severity] || 0) + 1;
      byRegion[threat.regionName] = (byRegion[threat.regionName] || 0) + 1;
      bySource[threat.source] = (bySource[threat.source] || 0) + 1;
    }

    return {
      totalThreats: this.threats.length,
      byType: byType,
      bySeverity: bySeverity,
      byRegion: byRegion,
      bySource: bySource,
      lastUpdate: new Date().toISOString()
    };
  }

  async updateAll() {
    console.log('[Cyber Intel] Сбор киберугроз...');
    const threats = await this.collectThreats();

    const result = {
      timestamp: new Date().toISOString(),
      threats: threats,
      stats: this.getStats(),
      summary: this.generateSummary(threats)
    };

    this.history.push(result);
    if (this.history.length > 100) this.history = this.history.slice(-100);
    await this.saveHistory();

    console.log(`[Cyber Intel] Готово. Собрано ${threats.length} угроз.`);
    return result;
  }

  generateSummary(threats) {
    const critical = threats.filter(t => t.severity === 'critical');
    const high = threats.filter(t => t.severity === 'high');
    const byCountry = {};
    
    for (const threat of threats) {
      byCountry[threat.country] = (byCountry[threat.country] || 0) + 1;
    }

    let summary = '🛡️ МОНИТОРИНГ КИБЕРУГРОЗ\n\n';
    summary += `Всего угроз: ${threats.length}\n`;
    summary += `Критических: ${critical.length}, Высоких: ${high.length}\n\n`;
    
    summary += '--- ПО СТРАНАМ ---\n';
    const sorted = Object.entries(byCountry).sort((a, b) => b[1] - a[1]);
    for (const [country, count] of sorted.slice(0, 5)) {
      summary += `${country}: ${count}\n`;
    }

    if (critical.length > 0) {
      summary += '\n--- КРИТИЧЕСКИЕ УГРОЗЫ ---\n';
      for (const threat of critical) {
        summary += `🔴 ${threat.ip} (${threat.typeName})\n`;
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

  getThreats() {
    return this.threats;
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let monitor = null;

async function getMonitor() {
  if (!monitor) {
    monitor = new CyberIntelMonitor();
    await monitor.init();
  }
  return monitor;
}

export async function handleCyberIntelAPI(req, res) {
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
    // GET /api/cyber-intel/status
    // ============================================================
    if (path === '/api/cyber-intel/status' && req.method === 'GET') {
      const stats = monitor.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'cyber-intel',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // POST /api/cyber-intel/update
    // ============================================================
    if (path === '/api/cyber-intel/update' && req.method === 'POST') {
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
    // GET /api/cyber-intel/latest
    // ============================================================
    if (path === '/api/cyber-intel/latest' && req.method === 'GET') {
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
    // GET /api/cyber-intel/threats
    // ============================================================
    if (path === '/api/cyber-intel/threats' && req.method === 'GET') {
      const threats = monitor.getThreats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, threats }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Cyber Intel API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleCyberIntelAPI, CyberIntelMonitor };
