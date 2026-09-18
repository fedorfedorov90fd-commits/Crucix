#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №59: ДАШБОРД РЕШЕНИЙ (DECISION DASHBOARD)
// ============================================================
// Единый центр принятия решений
// Агрегация всех 58 модулей в единую картину
// Рекомендации и приоритеты действий
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'decision');
const CACHE_FILE = join(DATA_DIR, 'cache.json');
const DECISIONS_FILE = join(DATA_DIR, 'decisions.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ МОДУЛЕЙ ДЛЯ АГРЕГАЦИИ
// ============================================================

const MODULES = {
  'global-index': { id: 'module-5', name: 'Глобальный индекс', endpoint: '/api/geo/index', priority: 5 },
  'strategic': { id: 'module-53', name: 'Стратегический слой', endpoint: '/api/strategic/ssi', priority: 4 },
  'prediction': { id: 'module-54', name: 'Прогнозный интеллект', endpoint: '/api/prediction/markets', priority: 4 },
  'masa': { id: 'module-55', name: 'Мульти-агентный анализ', endpoint: '/api/masa/latest', priority: 3 },
  'p2p': { id: 'module-56', name: 'P2P-обмен', endpoint: '/api/p2p/status', priority: 3 },
  'predictive': { id: 'module-58', name: 'Прогнозная модель', endpoint: '/api/predictive/latest', priority: 5 },
  'early-warning': { id: 'module-51', name: 'Раннее предупреждение', endpoint: '/api/early-warning/alerts', priority: 5 },
  'conflict': { id: 'module-26', name: 'Прогнозирование конфликтов', endpoint: '/api/conflict/status', priority: 4 },
  'market': { id: 'module-50', name: 'Рыночный прогноз', endpoint: '/api/market/latest', priority: 3 },
  'bases': { id: 'module-53', name: 'Военные базы', endpoint: '/api/strategic/bases', priority: 3 }
};

// ============================================================
// 2. КЛАСС ДАШБОРДА РЕШЕНИЙ
// ============================================================

class DecisionDashboard {
  constructor() {
    this.cache = null;
    this.decisions = [];
    this.lastUpdate = null;
  }

  async init() {
    await this.ensureDirs();
    await this.loadCache();
    await this.loadDecisions();
    console.log('[Decision] Дашборд решений инициализирован');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadCache() {
    try {
      const data = await fs.readFile(CACHE_FILE, 'utf-8');
      this.cache = JSON.parse(data);
    } catch (e) {
      this.cache = { timestamp: null, data: {} };
    }
  }

  async saveCache() {
    await fs.writeFile(CACHE_FILE, JSON.stringify(this.cache, null, 2));
  }

  async loadDecisions() {
    try {
      const data = await fs.readFile(DECISIONS_FILE, 'utf-8');
      this.decisions = JSON.parse(data);
    } catch (e) {
      this.decisions = [];
    }
  }

  async saveDecisions() {
    await fs.writeFile(DECISIONS_FILE, JSON.stringify(this.decisions, null, 2));
  }

  // ============================================================
  // 2.1. СБОР ДАННЫХ ИЗ ВСЕХ МОДУЛЕЙ
  // ============================================================

  async collectAllData() {
    const data = {
      timestamp: new Date().toISOString(),
      modules: {},
      summary: {}
    };

    for (const [key, module] of Object.entries(MODULES)) {
      try {
        const res = await fetch(`http://localhost:3117${module.endpoint}`);
        if (res.ok) {
          const result = await res.json();
          data.modules[key] = {
            name: module.name,
            data: result,
            status: 'online'
          };
        } else {
          data.modules[key] = {
            name: module.name,
            status: 'offline',
            error: `HTTP ${res.status}`
          };
        }
      } catch (e) {
        data.modules[key] = {
          name: module.name,
          status: 'offline',
          error: e.message
        };
      }
    }

    // Формируем сводку
    data.summary = this.generateSummary(data.modules);
    
    this.cache = {
      timestamp: data.timestamp,
      data: data
    };
    await this.saveCache();

    return data;
  }

  // ============================================================
  // 2.2. ГЕНЕРАЦИЯ СВОДКИ
  // ============================================================

  generateSummary(modules) {
    const summary = {
      total: Object.keys(modules).length,
      online: 0,
      offline: 0,
      critical: 0,
      warnings: 0,
      recommendations: []
    };

    for (const [key, module] of Object.entries(modules)) {
      if (module.status === 'online') {
        summary.online++;
        // Анализируем данные модуля
        if (module.data) {
          const critical = this.detectCritical(module.data, key);
          if (critical) {
            summary.critical++;
            summary.recommendations.push({
              module: key,
              message: critical,
              priority: 'critical'
            });
          }
          const warning = this.detectWarning(module.data, key);
          if (warning) {
            summary.warnings++;
            summary.recommendations.push({
              module: key,
              message: warning,
              priority: 'warning'
            });
          }
        }
      } else {
        summary.offline++;
        summary.recommendations.push({
          module: key,
          message: `Модуль ${module.name} не отвечает`,
          priority: 'critical'
        });
      }
    }

    // Сортируем рекомендации по приоритету
    summary.recommendations.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.priority] - order[b.priority];
    });

    return summary;
  }

  detectCritical(data, moduleKey) {
    // Анализируем данные модуля на критические сигналы
    if (moduleKey === 'strategic' && data.ssi > 80) {
      return `Критический уровень стратегической напряжённости: ${data.ssi}%`;
    }
    if (moduleKey === 'global-index' && data.value > 70) {
      return `Критический глобальный индекс: ${data.value}`;
    }
    if (moduleKey === 'early-warning' && data.alerts?.length > 5) {
      return `Обнаружено ${data.alerts.length} критических предупреждений`;
    }
    if (moduleKey === 'predictive' && data.prediction) {
      const criticalTargets = Object.entries(data.prediction)
        .filter(([k, v]) => v > 80)
        .map(([k, v]) => `${k}: ${v}%`);
      if (criticalTargets.length > 0) {
        return `Критические прогнозы: ${criticalTargets.join(', ')}`;
      }
    }
    if (moduleKey === 'prediction' && data.markets) {
      const highProb = data.markets.filter(m => m.probability > 0.8);
      if (highProb.length > 0) {
        return `Высокая вероятность событий: ${highProb.map(m => m.name).join(', ')}`;
      }
    }
    return null;
  }

  detectWarning(data, moduleKey) {
    if (moduleKey === 'strategic' && data.ssi > 60) {
      return `Повышенная стратегическая напряжённость: ${data.ssi}%`;
    }
    if (moduleKey === 'global-index' && data.value > 50) {
      return `Повышенный глобальный индекс: ${data.value}`;
    }
    if (moduleKey === 'p2p' && data.stats?.online_peers < 3) {
      return `Мало активных пиров в P2P-сети (${data.stats.online_peers}/5)`;
    }
    if (moduleKey === 'prediction' && data.markets) {
      const mediumProb = data.markets.filter(m => m.probability > 0.6 && m.probability <= 0.8);
      if (mediumProb.length > 0) {
        return `Средняя вероятность событий: ${mediumProb.map(m => m.name).join(', ')}`;
      }
    }
    return null;
  }

  // ============================================================
  // 2.3. ГЕНЕРАЦИЯ РЕШЕНИЙ
  // ============================================================

  async generateDecisions() {
    // Собираем свежие данные
    const data = await this.collectAllData();
    const summary = data.summary;

    // Формируем решения
    const decisions = [];

    // 1. Критические решения
    for (const rec of summary.recommendations) {
      if (rec.priority === 'critical') {
        decisions.push({
          id: `decision-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          type: 'critical',
          title: `🚨 КРИТИЧЕСКОЕ: ${rec.module}`,
          description: rec.message,
          actions: this.getActions(rec.module, 'critical'),
          priority: 1
        });
      }
    }

    // 2. Предупреждения
    for (const rec of summary.recommendations) {
      if (rec.priority === 'warning') {
        decisions.push({
          id: `decision-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          type: 'warning',
          title: `⚠️ ПРЕДУПРЕЖДЕНИЕ: ${rec.module}`,
          description: rec.message,
          actions: this.getActions(rec.module, 'warning'),
          priority: 2
        });
      }
    }

    // 3. Информационные решения
    if (summary.online > 0) {
      decisions.push({
        id: `decision-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        type: 'info',
        title: '📊 Статус системы',
        description: `${summary.online}/${summary.total} модулей онлайн`,
        actions: ['Проверить отключённые модули', 'Запустить диагностику'],
        priority: 3
      });
    }

    // Сохраняем решения
    this.decisions = decisions;
    await this.saveDecisions();

    return {
      timestamp: new Date().toISOString(),
      summary: summary,
      decisions: decisions
    };
  }

  getActions(moduleKey, priority) {
    const actions = {
      'strategic': {
        critical: ['Усилить мониторинг', 'Проверить военные базы', 'Активировать раннее предупреждение'],
        warning: ['Увеличить частоту мониторинга', 'Проверить стратегические объекты']
      },
      'global-index': {
        critical: ['Провести анализ причин роста', 'Уведомить всех пользователей'],
        warning: ['Мониторить динамику', 'Проверить корреляцию с другими модулями']
      },
      'early-warning': {
        critical: ['Активировать протоколы', 'Провести эвакуационные мероприятия'],
        warning: ['Усилить наблюдение', 'Проверить источники данных']
      },
      'predictive': {
        critical: ['Подготовить планы действий', 'Провести брифинг'],
        warning: ['Обновить модель', 'Проверить качество данных']
      },
      'p2p': {
        critical: ['Проверить подключение', 'Активировать резервные узлы'],
        warning: ['Пригласить новых пиров', 'Проверить статус узлов']
      }
    };

    const moduleActions = actions[moduleKey] || actions['global-index'];
    return moduleActions[priority] || ['Проверить модуль', 'Запустить диагностику'];
  }

  // ============================================================
  // 2.4. СТАТИСТИКА
  // ============================================================

  getStats() {
    return {
      last_update: this.cache?.timestamp || null,
      total_decisions: this.decisions.length,
      critical_decisions: this.decisions.filter(d => d.type === 'critical').length,
      warning_decisions: this.decisions.filter(d => d.type === 'warning').length,
      info_decisions: this.decisions.filter(d => d.type === 'info').length,
      modules: Object.keys(MODULES).length,
      modules_online: this.cache?.data?.summary?.online || 0
    };
  }

  getDecisions(limit = 20) {
    return this.decisions.slice(0, limit);
  }

  getLatestDecisions() {
    return this.decisions.filter(d => d.priority <= 2);
  }

  async getModuleStatus() {
    const data = await this.collectAllData();
    return data.modules;
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let dashboard = null;

async function getDashboard() {
  if (!dashboard) {
    dashboard = new DecisionDashboard();
    await dashboard.init();
  }
  return dashboard;
}

export async function handleDecisionAPI(req, res) {
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
    const dashboard = await getDashboard();

    // ============================================================
    // GET /api/decision/status — статус дашборда
    // ============================================================
    if (path === '/api/decision/status' && req.method === 'GET') {
      const stats = dashboard.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'decision',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // POST /api/decision/update — обновить дашборд
    // ============================================================
    if (path === '/api/decision/update' && req.method === 'POST') {
      const result = await dashboard.generateDecisions();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, result }));
      return;
    }

    // ============================================================
    // GET /api/decision/decisions — список решений
    // ============================================================
    if (path === '/api/decision/decisions' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const decisions = dashboard.getDecisions(limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, decisions, total: decisions.length }));
      return;
    }

    // ============================================================
    // GET /api/decision/latest — последние критические решения
    // ============================================================
    if (path === '/api/decision/latest' && req.method === 'GET') {
      const decisions = dashboard.getLatestDecisions();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, decisions }));
      return;
    }

    // ============================================================
    // GET /api/decision/modules — статус всех модулей
    // ============================================================
    if (path === '/api/decision/modules' && req.method === 'GET') {
      const modules = await dashboard.getModuleStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, modules }));
      return;
    }

    // ============================================================
    // GET /api/decision/summary — сводка
    // ============================================================
    if (path === '/api/decision/summary' && req.method === 'GET') {
      const stats = dashboard.getStats();
      const latest = dashboard.getLatestDecisions();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        stats: stats,
        decisions: latest,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Decision API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка', details: error.message }));
  }
}

export default { handleDecisionAPI, DecisionDashboard };
