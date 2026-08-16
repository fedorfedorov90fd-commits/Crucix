#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №46: САМОДИАГНОСТИКА СИСТЕМЫ
// MODULE №46: SYSTEM HEALTH & DIAGNOSTICS
// ============================================================
// Анализирует состояние всех модулей Crucix:
//   - Статус модулей (онлайн/офлайн)
//   - Производительность (время ответа)
//   - Целостность данных
//   - AI-анализ логов
// Analyzes the state of all Crucix modules:
//   - Module status (online/offline)
//   - Performance (response time)
//   - Data integrity
//   - AI log analysis
// Версия / Version: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'diagnostics');
const LOGS_DIR = join(ROOT, 'logs');
const BASKET_DIR = join(ROOT, 'data', 'basket');
const FEEDS_FILE = join(ROOT, 'data', 'feeds', 'feeds.opml');
const HISTORY_FILE = join(ROOT, 'data', 'geo', 'index-history.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ МОДУЛЕЙ ДЛЯ ПРОВЕРКИ
// Module configuration for checks
// ============================================================

const MODULES_TO_CHECK = [
  { id: 'rss-manager', path: '/api/rss/status', method: 'GET' },
  { id: 'basket', path: '/api/basket/stats', method: 'GET' },
  { id: 'global-index', path: '/api/geo/index', method: 'GET' },
  { id: 'historical-analysis', path: '/api/analysis/history', method: 'GET' },
  { id: 'correlation', path: '/api/correlation/status', method: 'GET' },
  { id: 'infrastructure', path: '/api/infrastructure/status', method: 'GET' },
  { id: 'satellite', path: '/api/satellite/status', method: 'GET' },
  { id: 'usgs', path: '/api/usgs/status', method: 'GET' },
  { id: 'local', path: '/api/local/status', method: 'GET' },
  { id: 'ofac', path: '/api/ofac/status', method: 'GET' },
  { id: 'eia', path: '/api/eia/status', method: 'GET' },
  { id: 'who', path: '/api/who/status', method: 'GET' },
  { id: 'cisa-kev', path: '/api/cisa/status', method: 'GET' },
  { id: 'noaa', path: '/api/noaa/status', method: 'GET' },
  { id: 'space', path: '/api/space/status', method: 'GET' },
  { id: 'comtrade', path: '/api/comtrade/status', method: 'GET' },
  { id: 'epa', path: '/api/epa/status', method: 'GET' },
  { id: 'gscpi', path: '/api/gscpi/status', method: 'GET' },
  { id: 'tass', path: '/api/tass/status', method: 'GET' },
  { id: 'opensanctions', path: '/api/opensanctions/status', method: 'GET' },
  { id: 'scheduler', path: '/api/scheduler/status', method: 'GET' },
  { id: 'trust', path: '/api/trust/status', method: 'GET' },
  { id: 'ai-processor', path: '/api/ai-processor/status', method: 'GET' },
  { id: 'gateway', path: '/api/gateway/status', method: 'GET' },
  { id: 'newsapi', path: '/api/newsapi/ping', method: 'GET' },
  { id: 'diagnostics', path: '/api/diagnostics/status', method: 'GET' },
];

const EXTERNAL_SOURCES = [
  { id: 'ollama', url: 'http://localhost:11434/api/tags', timeout: 3000 },
  { id: 'newsapi', url: 'https://newsapi.org/v2/top-headlines?country=us&apiKey=demo', timeout: 5000 },
  { id: 'usgs', url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', timeout: 5000 },
];

// ============================================================
// 2. ОСНОВНОЙ КЛАСС ДИАГНОСТИКИ
// Main Diagnostics Class
// ============================================================

class DiagnosticsManager {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      overallStatus: 'UNKNOWN',
      modules: [],
      external: [],
      system: {},
      dataIntegrity: {},
      aiLogAnalysis: null
    };
  }

  // ============================================================
  // 2.1. ЗАПУСК ВСЕХ ПРОВЕРОК
  // Run all diagnostics
  // ============================================================

  async runFullDiagnostics() {
    console.log('[Diagnostics] Запуск полной диагностики / Running full diagnostics...');

    this.results.modules = await this.checkModules();
    this.results.external = await this.checkExternalSources();
    this.results.system = this.getSystemMetrics();
    this.results.dataIntegrity = await this.checkDataIntegrity();
    this.results.aiLogAnalysis = await this.analyzeLogsWithAI();
    this.results.overallStatus = this.calculateOverallStatus();

    await this.saveReport();
    return this.results;
  }

  // ============================================================
  // 2.2. ПРОВЕРКА ВНУТРЕННИХ МОДУЛЕЙ
  // Check internal modules
  // ============================================================

  async checkModules() {
    const results = [];
    const baseUrl = `http://localhost:3117`;

    for (const module of MODULES_TO_CHECK) {
      const start = Date.now();
      try {
        const response = await fetch(`${baseUrl}${module.path}`, {
          method: module.method || 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000)
        });

        const end = Date.now();
        const responseTime = end - start;

        let data = null;
        try {
          data = await response.json();
        } catch (e) {
          data = { raw: 'non-json response' };
        }

        results.push({
          id: module.id,
          status: response.ok ? 'ONLINE' : 'ERROR',
          statusCode: response.status,
          responseTime: responseTime,
          data: data,
          error: null
        });

      } catch (e) {
        results.push({
          id: module.id,
          status: 'OFFLINE',
          statusCode: null,
          responseTime: null,
          data: null,
          error: e.message || 'Неизвестная ошибка / Unknown error'
        });
      }
    }

    return results;
  }

  // ============================================================
  // 2.3. ПРОВЕРКА ВНЕШНИХ ИСТОЧНИКОВ
  // Check external sources
  // ============================================================

  async checkExternalSources() {
    const results = [];

    for (const source of EXTERNAL_SOURCES) {
      try {
        const start = Date.now();
        const response = await fetch(source.url, {
          signal: AbortSignal.timeout(source.timeout || 5000)
        });
        const end = Date.now();

        results.push({
          id: source.id,
          status: response.ok ? 'ONLINE' : 'ERROR',
          statusCode: response.status,
          responseTime: end - start,
          error: null
        });

      } catch (e) {
        results.push({
          id: source.id,
          status: 'OFFLINE',
          statusCode: null,
          responseTime: null,
          error: e.message || 'Неизвестная ошибка / Unknown error'
        });
      }
    }

    return results;
  }

  // ============================================================
  // 2.4. СИСТЕМНЫЕ МЕТРИКИ
  // System metrics
  // ============================================================

  getSystemMetrics() {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    return {
      memory: {
        used: Math.round(mem.heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(mem.heapTotal / 1024 / 1024) + ' MB',
        rss: Math.round(mem.rss / 1024 / 1024) + ' MB',
        systemUsedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100) + '%'
      },
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'Unknown',
        loadAverage: os.loadavg().map(v => v.toFixed(2))
      },
      uptime: {
        system: Math.floor(os.uptime() / 3600) + 'ч ' + Math.floor((os.uptime() % 3600) / 60) + 'м',
        process: Math.floor(process.uptime() / 3600) + 'ч ' + Math.floor((process.uptime() % 3600) / 60) + 'м'
      },
      platform: os.platform() + ' ' + os.release(),
      hostname: os.hostname()
    };
  }

  // ============================================================
  // 2.5. ПРОВЕРКА ЦЕЛОСТНОСТИ ДАННЫХ
  // Data integrity check
  // ============================================================

  async checkDataIntegrity() {
    const results = {};

    try {
      const files = await fs.readdir(BASKET_DIR);
      const basketFiles = files.filter(f => f.startsWith('basket-'));
      results.basket = {
        status: 'OK',
        files: basketFiles.length,
        latest: basketFiles.length > 0 ? basketFiles[basketFiles.length - 1] : null
      };
    } catch (e) {
      results.basket = { status: 'ERROR', error: e.message };
    }

    try {
      await fs.access(FEEDS_FILE);
      const content = await fs.readFile(FEEDS_FILE, 'utf-8');
      if (content.includes('<opml') && content.includes('xmlUrl')) {
        results.opml = { status: 'OK', size: content.length + ' bytes' };
      } else {
        results.opml = { status: 'CORRUPTED', error: 'Невалидный OPML / Invalid OPML' };
      }
    } catch (e) {
      results.opml = { status: 'MISSING', error: e.message };
    }

    try {
      const content = await fs.readFile(HISTORY_FILE, 'utf-8');
      const data = JSON.parse(content);
      results.history = {
        status: 'OK',
        entries: Array.isArray(data) ? data.length : 'unknown',
        latest: Array.isArray(data) && data.length > 0 ? data[data.length - 1]?.date || null : null
      };
    } catch (e) {
      results.history = { status: 'ERROR', error: e.message };
    }

    try {
      const entries = await fs.readdir(LOGS_DIR);
      const logFiles = entries.filter(f => f.endsWith('.log'));
      results.logs = {
        status: 'OK',
        files: logFiles.length,
        latest: logFiles.length > 0 ? logFiles[logFiles.length - 1] : null
      };
    } catch (e) {
      results.logs = { status: 'WARNING', error: e.message };
    }

    return results;
  }

  // ============================================================
  // 2.6. AI-АНАЛИЗ ЛОГОВ
  // AI log analysis
  // ============================================================

  async analyzeLogsWithAI() {
    try {
      const logEntries = [];
      try {
        const files = await fs.readdir(LOGS_DIR);
        const logFiles = files.filter(f => f.endsWith('.log')).slice(-5);

        for (const file of logFiles) {
          const content = await fs.readFile(join(LOGS_DIR, file), 'utf-8');
          const lines = content.split('\n').filter(l => l.trim()).slice(-30);
          if (lines.length > 0) {
            logEntries.push(`=== ${file} ===\n${lines.join('\n')}`);
          }
        }
      } catch (e) {}

      if (logEntries.length === 0) {
        return { status: 'NO_LOGS', message: 'Логи для анализа не найдены / No logs found' };
      }

      const logText = logEntries.join('\n\n').slice(0, 3000);

      const prompt = `
Ты — AI-аналитик системы мониторинга Crucix. Проанализируй следующие логи работы системы.
You are an AI analyst of the Crucix monitoring system. Analyze the following system logs.

ЛОГИ / LOGS:
${logText}

Задачи / Tasks:
1. Определи, есть ли в логах ошибки или предупреждения. / Identify errors or warnings in the logs.
2. Оцени общее состояние системы по логам (стабильно/есть проблемы/критично). / Assess the overall system state (stable/warnings/critical).
3. Дай краткие рекомендации по устранению проблем (если они есть). / Provide brief recommendations for fixing issues.

Ответь в формате JSON / Answer in JSON format:
{
  "status": "STABLE" | "WARNING" | "CRITICAL",
  "summary": "краткое резюме состояния (1-2 предложения) / brief state summary (1-2 sentences)",
  "issues": ["список обнаруженных проблем (если есть) / list of issues (if any)"],
  "recommendations": ["список рекомендаций (если есть) / list of recommendations (if any)"]
}`;

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'deepseek-r1:1.5b',
          prompt: prompt,
          stream: false,
          options: { temperature: 0.3, num_predict: 400 }
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        return { status: 'AI_UNAVAILABLE', message: 'Ollama не отвечает / Ollama is not responding' };
      }

      const data = await response.json();
      const result = data.response || '';

      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        return { status: 'PARSING_ERROR', raw: result.slice(0, 500) };
      } catch (e) {
        return { status: 'PARSING_ERROR', raw: result.slice(0, 500) };
      }

    } catch (e) {
      return { status: 'ERROR', message: e.message || 'Ошибка AI-анализа / AI analysis error' };
    }
  }

  // ============================================================
  // 2.7. ОБЩИЙ СТАТУС
  // Overall status
  // ============================================================

  calculateOverallStatus() {
    const modules = this.results.modules || [];
    const online = modules.filter(m => m.status === 'ONLINE').length;
    const total = modules.length;

    if (total === 0) return 'UNKNOWN';
    if (online === total) return 'ONLINE';

    const critical = modules.filter(m => m.status === 'OFFLINE').length;
    if (critical > total * 0.3) return 'CRITICAL';

    return 'DEGRADED';
  }

  // ============================================================
  // 2.8. СОХРАНЕНИЕ ОТЧЁТА
  // Save report
  // ============================================================

  async saveReport() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const file = join(DATA_DIR, `diagnostic-${new Date().toISOString().slice(0, 10)}.json`);
      await fs.writeFile(file, JSON.stringify(this.results, null, 2));

      const latest = join(DATA_DIR, 'latest.json');
      await fs.writeFile(latest, JSON.stringify(this.results, null, 2));

      console.log(`[Diagnostics] Отчёт сохранён / Report saved: ${file}`);
    } catch (e) {
      console.error('[Diagnostics] Ошибка сохранения отчёта / Error saving report:', e.message);
    }
  }

  // ============================================================
  // 2.9. ПОЛУЧЕНИЕ ПОСЛЕДНЕГО ОТЧЁТА
  // Get latest report
  // ============================================================

  async getLatestReport() {
    try {
      const latest = join(DATA_DIR, 'latest.json');
      const content = await fs.readFile(latest, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      return null;
    }
  }

  // ============================================================
  // 2.10. СТАТУС В ВИДЕ ТЕКСТА
  // Status as text
  // ============================================================

  getStatusText() {
    const status = this.results.overallStatus;
    const statusMap = {
      'ONLINE': '🟢 СИСТЕМА РАБОТАЕТ НОРМАЛЬНО / SYSTEM IS OPERATIONAL',
      'DEGRADED': '🟡 СИСТЕМА РАБОТАЕТ С ОГРАНИЧЕНИЯМИ / SYSTEM IS DEGRADED',
      'CRITICAL': '🔴 КРИТИЧЕСКОЕ СОСТОЯНИЕ! / CRITICAL STATE!',
      'UNKNOWN': '⚪ СОСТОЯНИЕ НЕ ОПРЕДЕЛЕНО / STATE UNKNOWN'
    };
    return statusMap[status] || '⚪ НЕИЗВЕСТНО / UNKNOWN';
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// HTTP Handler
// ============================================================

let diagnostics = null;

async function getDiagnostics() {
  if (!diagnostics) {
    diagnostics = new DiagnosticsManager();
  }
  return diagnostics;
}

export async function handleDiagnosticsAPI(req, res) {
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
    const manager = await getDiagnostics();

    // ============================================================
    // GET /api/diagnostics/status — статус модуля
    // Module status
    // ============================================================
    if (path === '/api/diagnostics/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'diagnostics',
        status: 'online',
        version: '1.0',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // GET /api/diagnostics/run — запустить диагностику
    // Run diagnostics
    // ============================================================
    if (path === '/api/diagnostics/run' && req.method === 'GET') {
      const result = await manager.runFullDiagnostics();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        result: result,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // GET /api/diagnostics/latest — последний отчёт
    // Latest report
    // ============================================================
    if (path === '/api/diagnostics/latest' && req.method === 'GET') {
      const report = await manager.getLatestReport();
      if (report) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          report: report,
          timestamp: new Date().toISOString()
        }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Отчёт не найден. Запустите диагностику. / Report not found. Run diagnostics.'
        }));
      }
      return;
    }

    // ============================================================
    // GET /api/diagnostics/summary — краткая сводка
    // Brief summary
    // ============================================================
    if (path === '/api/diagnostics/summary' && req.method === 'GET') {
      const report = await manager.getLatestReport();
      if (report) {
        const modules = report.modules || [];
        const total = modules.length;
        const online = modules.filter(m => m.status === 'ONLINE').length;
        const offline = modules.filter(m => m.status === 'OFFLINE').length;
        const error = modules.filter(m => m.status === 'ERROR').length;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          summary: {
            overallStatus: report.overallStatus,
            statusText: manager.getStatusText(),
            totalModules: total,
            online: online,
            offline: offline,
            error: error,
            timestamp: report.timestamp
          }
        }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Отчёт не найден / Report not found'
        }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: 'Неизвестный путь / Unknown path'
    }));

  } catch (error) {
    console.error('[Diagnostics API] Ошибка / Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: 'Внутренняя ошибка сервера / Internal server error',
      details: error.message
    }));
  }
}

export default { handleDiagnosticsAPI, DiagnosticsManager };
