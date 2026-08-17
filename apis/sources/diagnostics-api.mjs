#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №46: САМОДИАГНОСТИКА СИСТЕМЫ (РАСШИРЕННАЯ ВЕРСИЯ)
// ============================================================
// Добавлено: проверка API, системные метрики, целостность, AI-анализ
// Версия: 2.0
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
// 1. СПИСОК ВСЕХ API-МОДУЛЕЙ ДЛЯ ПРОВЕРКИ
// ============================================================

const MODULES = [
  { id: 'rss-manager', path: '/api/rss/status' },
  { id: 'basket', path: '/api/basket/stats' },
  { id: 'global-index', path: '/api/geo/index' },
  { id: 'historical-analysis', path: '/api/analysis/history' },
  { id: 'correlation', path: '/api/correlation/status' },
  { id: 'infrastructure', path: '/api/infrastructure/status' },
  { id: 'satellite', path: '/api/satellite/status' },
  { id: 'usgs', path: '/api/usgs/status' },
  { id: 'local', path: '/api/local/status' },
  { id: 'ofac', path: '/api/ofac/status' },
  { id: 'eia', path: '/api/eia/status' },
  { id: 'who', path: '/api/who/status' },
  { id: 'cisa-kev', path: '/api/cisa/status' },
  { id: 'noaa', path: '/api/noaa/status' },
  { id: 'space', path: '/api/space/status' },
  { id: 'comtrade', path: '/api/comtrade/status' },
  { id: 'epa', path: '/api/epa/status' },
  { id: 'gscpi', path: '/api/gscpi/status' },
  { id: 'tass', path: '/api/tass/status' },
  { id: 'opensanctions', path: '/api/opensanctions/status' },
  { id: 'scheduler', path: '/api/scheduler/status' },
  { id: 'trust', path: '/api/trust/status' },
  { id: 'ai-processor', path: '/api/ai-processor/status' },
  { id: 'gateway', path: '/api/gateway/status' },
  { id: 'newsapi', path: '/api/newsapi/ping' },
  { id: 'diagnostics', path: '/api/diagnostics/status' },
  { id: 'ai-gateway', path: '/api/ai-gateway/status' },
  { id: 'hidden-links', path: '/api/hidden-links/status' },
  { id: 'market-predictor', path: '/api/market/status' },
  { id: 'early-warning', path: '/api/early-warning/status' },
  { id: 'scenarios', path: '/api/scenarios/status' },
  { id: 'sentiment', path: '/api/sentiment/status' },
  { id: 'kiwisdr', path: '/api/kiwisdr/status' },
  { id: 'safecast', path: '/api/safecast/status' },
  { id: 'noaa', path: '/api/noaa/status' },
  { id: 'ofac', path: '/api/ofac/status' },
  { id: 'eia', path: '/api/eia/status' },
  { id: 'cisa', path: '/api/cisa/status' },
  { id: 'who', path: '/api/who/status' },
  { id: 'news', path: '/api/news/status' },
];

const EXTERNAL_SOURCES = [
  { id: 'ollama', url: 'http://localhost:11434/api/tags', timeout: 3000 },
  { id: 'newsapi', url: 'https://newsapi.org/v2/top-headlines?country=us&apiKey=demo', timeout: 5000 },
  { id: 'usgs', url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', timeout: 5000 },
];

// ============================================================
// 2. КЛАСС ДИАГНОСТИКИ
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
      aiLogAnalysis: null,
      pages: [] // Сохраняем существующие страницы
    };
  }

  async runFullDiagnostics() {
    console.log('[Diagnostics] Запуск расширенной диагностики...');

    this.results.modules = await this.checkModules();
    this.results.external = await this.checkExternalSources();
    this.results.system = this.getSystemMetrics();
    this.results.dataIntegrity = await this.checkDataIntegrity();
    this.results.aiLogAnalysis = await this.analyzeLogsWithAI();
    this.results.pages = await this.getPagesStatus();
    this.results.overallStatus = this.calculateOverallStatus();
    this.results.pages = await this.getPagesStatus();

    await this.saveReport();
    return this.results;
  }

  // ============================================================
  // 2.1. ПРОВЕРКА ВСЕХ API-МОДУЛЕЙ
  // ============================================================

  async checkModules() {
    const results = [];
    const baseUrl = `http://localhost:3117`;

    for (const module of MODULES) {
      const start = Date.now();
      try {
        const response = await fetch(`${baseUrl}${module.path}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000)
        });

        const end = Date.now();
        const responseTime = end - start;

        let data = null;
        try { data = await response.json(); } catch (e) { data = { raw: 'non-json' }; }

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
          error: e.message || 'Неизвестная ошибка'
        });
      }
    }

    return results;
  }

  // ============================================================
  // 2.2. ПРОВЕРКА ВНЕШНИХ ИСТОЧНИКОВ
  // ============================================================

  async checkExternalSources() {
    const results = [];

    for (const source of EXTERNAL_SOURCES) {
      try {
        const start = Date.now();
        const response = await fetch(source.url, { signal: AbortSignal.timeout(source.timeout || 5000) });
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
          error: e.message || 'Неизвестная ошибка'
        });
      }
    }

    return results;
  }

  // ============================================================
  // 2.3. СИСТЕМНЫЕ МЕТРИКИ
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
  // 2.4. ЦЕЛОСТНОСТЬ ДАННЫХ
  // ============================================================

  async checkDataIntegrity() {
    const results = {};

    try {
      const files = await fs.readdir(BASKET_DIR);
      const basketFiles = files.filter(f => f.startsWith('basket-'));
      results.basket = { status: 'OK', files: basketFiles.length };
    } catch (e) {
      results.basket = { status: 'ERROR', error: e.message };
    }

    try {
      await fs.access(FEEDS_FILE);
      const content = await fs.readFile(FEEDS_FILE, 'utf-8');
      results.opml = { status: content.includes('<opml') ? 'OK' : 'CORRUPTED', size: content.length };
    } catch (e) {
      results.opml = { status: 'MISSING', error: e.message };
    }

    try {
      const content = await fs.readFile(HISTORY_FILE, 'utf-8');
      const data = JSON.parse(content);
      results.history = { status: 'OK', entries: data.length };
    } catch (e) {
      results.history = { status: 'ERROR', error: e.message };
    }

    try {
      const entries = await fs.readdir(LOGS_DIR);
      results.logs = { status: 'OK', files: entries.filter(f => f.endsWith('.log')).length };
    } catch (e) {
      results.logs = { status: 'WARNING', error: e.message };
    }

    return results;
  }

  // ============================================================
  // 2.5. AI-АНАЛИЗ ЛОГОВ
  // ============================================================

  async analyzeLogsWithAI() {
    try {
      const logEntries = [];
      try {
        const files = await fs.readdir(LOGS_DIR);
        const logFiles = files.filter(f => f.endsWith('.log')).slice(-3);
        for (const file of logFiles) {
          const content = await fs.readFile(join(LOGS_DIR, file), 'utf-8');
          const lines = content.split('\n').filter(l => l.trim()).slice(-20);
          if (lines.length > 0) {
            logEntries.push(`=== ${file} ===\n${lines.join('\n')}`);
          }
        }
      } catch (e) {}

      if (logEntries.length === 0) {
        return { status: 'NO_LOGS', message: 'Логи не найдены' };
      }

      const logText = logEntries.join('\n\n').slice(0, 3000);

      const prompt = `Ты — AI-аналитик. Проанализируй логи работы системы Crucix.
ЛОГИ:\n${logText}
Ответь в формате JSON: { "status": "STABLE"|"WARNING"|"CRITICAL", "summary": "краткое резюме", "issues": ["проблемы"], "recommendations": ["рекомендации"] }`;

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
        return { status: 'AI_UNAVAILABLE', message: 'Ollama не отвечает' };
      }

      const data = await response.json();
      const result = data.response || '';
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { status: 'PARSING_ERROR', raw: result.slice(0, 500) };

    } catch (e) {
      return { status: 'ERROR', message: e.message || 'Ошибка AI-анализа' };
    }
  }

  // ============================================================
  // 2.6. ОБЩИЙ СТАТУС
  // ============================================================

  calculateOverallStatus() {
    const modules = this.results.modules || [];
    const online = modules.filter(m => m.status === 'ONLINE').length;
    const total = modules.length;
    if (total === 0) return 'UNKNOWN';
    if (online === total) return 'ONLINE';
    const offline = modules.filter(m => m.status === 'OFFLINE').length;
    if (offline > total * 0.3) return 'CRITICAL';
    return 'DEGRADED';
  }

  // ============================================================
  // 2.7. СТАТУС СТРАНИЦ (СОХРАНЯЕМ СУЩЕСТВУЮЩИЙ СПИСОК)
  // ============================================================

  async getPagesStatus() {
    const pages = [
      '/jarvis', '/rss-feed', '/rss-dashboard', '/ai-chat', '/geo-map',
      '/basket', '/global-index', '/historical-analysis', '/correlation',
      '/infrastructure', '/diagnostics', '/scheduler', '/kartochki',
      '/grid-tool', '/profile', '/silence', '/live', '/lenses',
      '/usgs', '/local', '/trust', '/ai-gateway', '/hidden-links',
      '/market-predictor', '/early-warning', '/scenarios', '/sentiment',
      '/kiwisdr', '/safecast', '/noaa', '/ofac', '/eia', '/cisa', '/who', '/news'
    ];

    const results = [];
    const baseUrl = `http://localhost:3117`;

    for (const page of pages) {
      try {
        const start = Date.now();
        const response = await fetch(`${baseUrl}${page}`, { signal: AbortSignal.timeout(3000) });
        const end = Date.now();
        results.push({
          path: page,
          status: response.ok ? 'ONLINE' : 'ERROR',
          statusCode: response.status,
          responseTime: end - start
        });
      } catch (e) {
        results.push({ path: page, status: 'OFFLINE', statusCode: null, responseTime: null, error: e.message });
      }
    }

    return results;
  }

  // ============================================================
  // 2.8. СОХРАНЕНИЕ ОТЧЁТА
  // ============================================================

  async saveReport() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const file = join(DATA_DIR, `diagnostic-${new Date().toISOString().slice(0, 10)}.json`);
      await fs.writeFile(file, JSON.stringify(this.results, null, 2));
      const latest = join(DATA_DIR, 'latest.json');
      await fs.writeFile(latest, JSON.stringify(this.results, null, 2));
      console.log(`[Diagnostics] Отчёт сохранён: ${file}`);
    } catch (e) {
      console.error('[Diagnostics] Ошибка сохранения:', e.message);
    }
  }

  async getPagesStatus() {

    const pages = [

      "/jarvis", "/rss-feed", "/rss-dashboard", "/ai-chat", "/geo-map",

      "/basket", "/global-index", "/historical-analysis", "/correlation",

      "/infrastructure", "/diagnostics", "/scheduler", "/kartochki",

      "/grid-tool", "/profile", "/silence", "/live", "/lenses",

      "/usgs", "/local", "/trust", "/ai-gateway", "/hidden-links",

      "/market-predictor", "/early-warning", "/scenarios", "/sentiment",

      "/kiwisdr", "/safecast", "/noaa", "/ofac", "/eia", "/cisa", "/who", "/news"

    ];

    const results = [];

    const baseUrl = `http://localhost:3117`;

    for (const page of pages) {

      try {

        const start = Date.now();

        const response = await fetch(`${baseUrl}${page}`, { signal: AbortSignal.timeout(3000) });

        const end = Date.now();

        results.push({ path: page, status: response.ok ? "ONLINE" : "ERROR", statusCode: response.status, responseTime: end - start });

      } catch (e) {

        results.push({ path: page, status: "OFFLINE", statusCode: null, responseTime: null, error: e.message });

      }

    }

    return results;

  }

  async getLatestReport() {
    try {
      const latest = join(DATA_DIR, 'latest.json');
      const content = await fs.readFile(latest, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      return null;
    }
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
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

    if (path === '/api/diagnostics/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, module: 'diagnostics', status: 'online', version: '2.0' }));
      return;
    }

    if (path === '/api/diagnostics/run' && req.method === 'GET') {
      const result = await manager.runFullDiagnostics();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, result }));
      return;
    }

    if (path === '/api/diagnostics/latest' && req.method === 'GET') {
      const report = await manager.getLatestReport();
      if (report) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, report }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Отчёт не найден' }));
      }
      return;
    }

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
            totalModules: total,
            online, offline, error,
            timestamp: report.timestamp,
            system: report.system
          }
        }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Отчёт не найден' }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Diagnostics API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка', details: error.message }));
  }
}

export default { handleDiagnosticsAPI, DiagnosticsManager };
