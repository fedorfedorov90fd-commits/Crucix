#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №31: АВТОМАТИЧЕСКИЕ ОТЧЁТЫ
// ============================================================
// Ежедневные дайджесты с AI-анализом
// Генерация отчётов в форматах JSON, HTML
// Автоматическое обновление по расписанию
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'reports');
const REPORTS_FILE = join(DATA_DIR, 'reports.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const REPORT_TYPES = {
  daily: { name: 'Ежедневный', icon: '📅', interval: 86400000 },
  weekly: { name: 'Еженедельный', icon: '📊', interval: 604800000 },
  monthly: { name: 'Ежемесячный', icon: '📈', interval: 2592000000 }
};

// ============================================================
// 2. КЛАСС АВТОМАТИЧЕСКИХ ОТЧЁТОВ
// ============================================================

class AutomatedReports {
  constructor() {
    this.reports = [];
    this.history = [];
    this.timer = null;
  }

  async init() {
    await this.ensureDirs();
    await this.loadReports();
    await this.loadHistory();
    console.log('[Automated Reports] Инициализирован');
    
    // Запускаем автоматическое обновление
    this.startAutoUpdate();
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadReports() {
    try {
      const data = await fs.readFile(REPORTS_FILE, 'utf-8');
      this.reports = JSON.parse(data);
    } catch (e) {
      this.reports = [];
    }
  }

  async saveReports() {
    await fs.writeFile(REPORTS_FILE, JSON.stringify(this.reports, null, 2));
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
  // 2.1. СБОР ДАННЫХ ДЛЯ ОТЧЁТА
  // ============================================================

  async collectData() {
    const data = {
      timestamp: new Date().toISOString(),
      sources: {},
      summary: {},
      topEvents: [],
      sentiment: { positive: 0, negative: 0, neutral: 0 }
    };

    // 1. Собираем новости из корзины
    try {
      const basketDir = join(ROOT, 'data', 'basket');
      const files = await fs.readdir(basketDir);
      const events = [];
      
      for (const file of files.slice(-10)) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(join(basketDir, file), 'utf-8');
          const items = JSON.parse(content);
          for (const item of items.slice(0, 10)) {
            events.push({
              title: item.title || 'Без названия',
              description: item.description || '',
              date: item.date || item.addedAt || new Date().toISOString()
            });
          }
        }
      }
      
      data.topEvents = events.slice(0, 20);
      data.sources.basket = events.length;
    } catch (e) {}

    // 2. Получаем глобальный индекс
    try {
      const indexFile = join(ROOT, 'data', 'geo', 'index-history.json');
      const content = await fs.readFile(indexFile, 'utf-8');
      const history = JSON.parse(content);
      if (history.length > 0) {
        const last = history[history.length - 1];
        data.summary.globalIndex = last.value || 0;
        data.summary.indexTrend = history.length > 1 ? 
          last.value - history[history.length - 2].value : 0;
      }
    } catch (e) {}

    // 3. Получаем конфликтный риск
    try {
      const conflictFile = join(ROOT, 'data', 'conflict-predictor', 'history.json');
      const content = await fs.readFile(conflictFile, 'utf-8');
      const history = JSON.parse(content);
      if (history.length > 0) {
        const last = history[history.length - 1];
        const predictions = last.predictions || [];
        const highRisk = predictions.filter(p => p.risk > 50);
        data.summary.highRiskRegions = highRisk.map(p => p.region);
        data.summary.conflictRisk = highRisk.length;
      }
    } catch (e) {}

    // 4. Получаем киберугрозы
    try {
      const cyberFile = join(ROOT, 'data', 'cyber-threats', 'history.json');
      const content = await fs.readFile(cyberFile, 'utf-8');
      const history = JSON.parse(content);
      if (history.length > 0) {
        const last = history[history.length - 1];
        data.summary.cyberThreats = last.stats?.total || 0;
        data.summary.criticalThreats = last.stats?.bySeverity?.critical || 0;
      }
    } catch (e) {}

    // 5. Получаем тёмные суда
    try {
      const shipsFile = join(ROOT, 'data', 'dark-ships', 'history.json');
      const content = await fs.readFile(shipsFile, 'utf-8');
      const history = JSON.parse(content);
      if (history.length > 0) {
        const last = history[history.length - 1];
        data.summary.darkShips = last.stats?.byStatus?.dark || 0;
        data.summary.suspiciousShips = last.stats?.byStatus?.suspicious || 0;
      }
    } catch (e) {}

    // 6. Получаем спутниковый интернет
    try {
      const satFile = join(ROOT, 'data', 'satellite-internet', 'history.json');
      const content = await fs.readFile(satFile, 'utf-8');
      const history = JSON.parse(content);
      if (history.length > 0) {
        const last = history[history.length - 1];
        data.summary.totalSatellites = last.stats?.totalSatellites || 0;
        data.summary.operationalSatellites = last.stats?.operationalSatellites || 0;
      }
    } catch (e) {}

    return data;
  }

  // ============================================================
  // 2.2. ГЕНЕРАЦИЯ ОТЧЁТА
  // ============================================================

  async generateReport(type = 'daily') {
    console.log(`[Reports] Генерация ${type} отчёта...`);
    
    const data = await this.collectData();
    const now = new Date();
    
    const report = {
      id: `report-${Date.now()}`,
      type: type,
      timestamp: now.toISOString(),
      date: now.toLocaleDateString('ru-RU'),
      time: now.toLocaleTimeString('ru-RU'),
      data: data,
      summary: this.formatSummary(data),
      html: this.generateHTML(data)
    };

    this.reports.push(report);
    if (this.reports.length > 100) this.reports = this.reports.slice(-100);
    await this.saveReports();

    // Сохраняем в историю
    this.history.push({
      id: report.id,
      type: report.type,
      timestamp: report.timestamp,
      summary: report.summary
    });
    if (this.history.length > 365) this.history = this.history.slice(-365);
    await this.saveHistory();

    console.log(`[Reports] Отчёт ${report.id} создан`);
    return report;
  }

  // ============================================================
  // 2.3. ФОРМАТИРОВАНИЕ РЕЗЮМЕ
  // ============================================================

  formatSummary(data) {
    const s = data.summary || {};
    const events = data.topEvents || [];
    
    let summary = `📊 ДАЙДЖЕСТ НА ${new Date().toLocaleDateString('ru-RU')}\n\n`;
    
    // Глобальный индекс
    if (s.globalIndex !== undefined) {
      const trend = s.indexTrend > 0 ? '📈 растёт' : s.indexTrend < 0 ? '📉 падает' : '➡️ стабилен';
      summary += `🌍 ГЛОБАЛЬНЫЙ ИНДЕКС: ${s.globalIndex} (${trend})\n`;
    }
    
    // Конфликты
    if (s.conflictRisk !== undefined) {
      summary += `⚔️ КОНФЛИКТНЫЙ РИСК: ${s.conflictRisk} регионов с высоким риском`;
      if (s.highRiskRegions && s.highRiskRegions.length > 0) {
        summary += ` (${s.highRiskRegions.join(', ')})`;
      }
      summary += `\n`;
    }
    
    // Киберугрозы
    if (s.cyberThreats !== undefined) {
      summary += `🛡️ КИБЕРУГРОЗЫ: ${s.cyberThreats} активных`;
      if (s.criticalThreats > 0) {
        summary += `, ${s.criticalThreats} критических`;
      }
      summary += `\n`;
    }
    
    // Тёмные суда
    if (s.darkShips !== undefined) {
      summary += `🚢 ТЁМНЫЕ СУДА: ${s.darkShips} без AIS`;
      if (s.suspiciousShips > 0) {
        summary += `, ${s.suspiciousShips} подозрительных`;
      }
      summary += `\n`;
    }
    
    // Спутники
    if (s.totalSatellites !== undefined) {
      summary += `🛰️ СПУТНИКИ: ${s.operationalSatellites}/${s.totalSatellites} активных\n`;
    }
    
    // Топ событий
    if (events.length > 0) {
      summary += `\n📰 ТОП СОБЫТИЙ:\n`;
      for (const event of events.slice(0, 5)) {
        summary += `  • ${event.title}\n`;
      }
    }
    
    return summary;
  }

  // ============================================================
  // 2.4. ГЕНЕРАЦИЯ HTML
  // ============================================================

  generateHTML(data) {
    const s = data.summary || {};
    const events = data.topEvents || [];
    
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Отчёт Crucix ${new Date().toLocaleDateString('ru-RU')}</title>
  <style>
    body { font-family: -apple-system, monospace; background: #0a0a0f; color: #c8d0d8; padding: 40px; max-width: 900px; margin: 0 auto; }
    h1 { color: #5bc0f8; font-size: 24px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 16px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; }
    .card { background: rgba(255,255,255,0.04); padding: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); }
    .card .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .card .value { font-size: 24px; font-weight: 700; color: #e8f0f8; margin: 4px 0; }
    .card .sub { font-size: 13px; color: #888; }
    .event { padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .event .title { color: #c8d0d8; }
    .event .date { font-size: 11px; color: #555; }
    .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); color: #444; font-size: 12px; text-align: center; }
    .status-online { color: #22c55e; }
    .status-warning { color: #f97316; }
    .status-critical { color: #ef4444; }
    @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>⚡ CRUCIX — АВТОМАТИЧЕСКИЙ ОТЧЁТ</h1>
  <p style="color:#666;">${new Date().toLocaleString('ru-RU')}</p>
  
  <div class="grid">
    <div class="card">
      <div class="label">🌍 Глобальный индекс</div>
      <div class="value">${s.globalIndex || '—'}</div>
      <div class="sub">${s.indexTrend > 0 ? '📈 Рост' : s.indexTrend < 0 ? '📉 Падение' : '➡️ Стабилен'}</div>
    </div>
    <div class="card">
      <div class="label">⚔️ Конфликтный риск</div>
      <div class="value">${s.conflictRisk || 0}</div>
      <div class="sub">${s.highRiskRegions?.join(', ') || 'Нет'}</div>
    </div>
    <div class="card">
      <div class="label">🛡️ Киберугрозы</div>
      <div class="value">${s.cyberThreats || 0}</div>
      <div class="sub">${s.criticalThreats || 0} критических</div>
    </div>
    <div class="card">
      <div class="label">🚢 Тёмные суда</div>
      <div class="value">${s.darkShips || 0}</div>
      <div class="sub">${s.suspiciousShips || 0} подозрительных</div>
    </div>
    <div class="card" style="grid-column: span 2;">
      <div class="label">🛰️ Спутниковый интернет</div>
      <div class="value">${s.operationalSatellites || 0}/${s.totalSatellites || 0}</div>
      <div class="sub">активных спутников</div>
    </div>
  </div>
  
  <h2 style="color:#888;font-size:14px;margin:20px 0 12px;">📰 Топ событий</h2>
  ${events.slice(0, 10).map(e => `
    <div class="event">
      <div class="title">${e.title}</div>
      <div class="date">${new Date(e.date).toLocaleString()}</div>
    </div>
  `).join('')}
  
  <div class="footer">
    CRUCIX OSINT TERMINAL · Автоматический отчёт · ${new Date().toLocaleDateString('ru-RU')}
  </div>
</body>
</html>`;

    return html;
  }

  // ============================================================
  // 2.5. АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ
  // ============================================================

  startAutoUpdate() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    
    // Проверяем каждые 5 минут, нужно ли создать отчёт
    this.timer = setInterval(async () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      // Создаём отчёт каждый день в 8:00
      if (hour === 8 && minute === 0) {
        console.log('[Reports] Автоматическая генерация ежедневного отчёта');
        await this.generateReport('daily');
      }
    }, 60000); // Каждую минуту
    
    console.log('[Reports] Автообновление запущено (проверка каждую минуту)');
  }

  stopAutoUpdate() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[Reports] Автообновление остановлено');
    }
  }

  // ============================================================
  // 2.6. СТАТИСТИКА
  // ============================================================

  getStats() {
    return {
      totalReports: this.reports.length,
      historyEntries: this.history.length,
      lastUpdate: this.reports.length > 0 ? this.reports[this.reports.length - 1].timestamp : null
    };
  }

  getLatest() {
    return this.reports.length > 0 ? this.reports[this.reports.length - 1] : null;
  }

  getHistory(limit = 30) {
    return this.history.slice(-limit);
  }

  getReport(id) {
    return this.reports.find(r => r.id === id);
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let reports = null;

async function getReports() {
  if (!reports) {
    reports = new AutomatedReports();
    await reports.init();
  }
  return reports;
}

export async function handleReportsAPI(req, res) {
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
    const reports = await getReports();

    // ============================================================
    // GET /api/reports/status
    // ============================================================
    if (path === '/api/reports/status' && req.method === 'GET') {
      const stats = reports.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'automated-reports',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // POST /api/reports/generate
    // ============================================================
    if (path === '/api/reports/generate' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const type = data.type || 'daily';
          const report = await reports.generateReport(type);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, report }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // ============================================================
    // GET /api/reports/latest
    // ============================================================
    if (path === '/api/reports/latest' && req.method === 'GET') {
      const latest = reports.getLatest();
      if (latest) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, report: latest }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Отчётов пока нет' }));
      }
      return;
    }

    // ============================================================
    // GET /api/reports/history
    // ============================================================
    if (path === '/api/reports/history' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 10;
      const history = reports.getHistory(limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, history }));
      return;
    }

    // ============================================================
    // GET /api/reports/:id
    // ============================================================
    if (path.startsWith('/api/reports/') && req.method === 'GET') {
      const id = path.split('/').pop();
      const report = reports.getReport(id);
      if (report) {
        // Если запрошен HTML
        const accept = req.headers.accept || '';
        if (accept.includes('text/html')) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(report.html);
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, report }));
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Отчёт не найден' }));
      }
      return;
    }

    // ============================================================
    // POST /api/reports/start-auto
    // ============================================================
    if (path === '/api/reports/start-auto' && req.method === 'POST') {
      reports.startAutoUpdate();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Автообновление запущено' }));
      return;
    }

    // ============================================================
    // POST /api/reports/stop-auto
    // ============================================================
    if (path === '/api/reports/stop-auto' && req.method === 'POST') {
      reports.stopAutoUpdate();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Автообновление остановлено' }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Reports API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleReportsAPI, AutomatedReports };
