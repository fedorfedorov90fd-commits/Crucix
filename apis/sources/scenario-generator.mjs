#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №45: ГЕНЕРАТОР СИНТЕТИЧЕСКИХ СЦЕНАРИЕВ
// ============================================================
// AI-генерация сценариев "что-если" на основе текущих данных
// Оценка вероятности каждого сценария
// Визуализация цепочек последствий
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'scenario-generator');
const SCENARIOS_FILE = join(DATA_DIR, 'scenarios.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const SCENARIO_CATEGORIES = {
  geopolitical: { name: 'Геополитический', icon: '🌍', color: '#3b82f6' },
  economic: { name: 'Экономический', icon: '📊', color: '#22c55e' },
  military: { name: 'Военный', icon: '⚔️', color: '#ef4444' },
  environmental: { name: 'Экологический', icon: '🌿', color: '#f59e0b' },
  technological: { name: 'Технологический', icon: '💻', color: '#8b5cf6' },
  social: { name: 'Социальный', icon: '👥', color: '#ec4899' }
};

const TRIGGERS = [
  'Экономический кризис',
  'Военный конфликт',
  'Природная катастрофа',
  'Технологический прорыв',
  'Политическая нестабильность',
  'Кибератака',
  'Пандемия',
  'Энергетический кризис',
  'Торговая война',
  'Финансовый крах'
];

const EFFECTS = [
  'Рост цен на энергоносители',
  'Падение фондового рынка',
  'Усиление военного присутствия',
  'Введение санкций',
  'Массовые протесты',
  'Технологическое отставание',
  'Потеря суверенитета',
  'Экономический рост',
  'Научный прорыв',
  'Международная изоляция'
];

// ============================================================
// 2. КЛАСС ГЕНЕРАТОРА СЦЕНАРИЕВ
// ============================================================

class ScenarioGenerator {
  constructor() {
    this.scenarios = [];
    this.history = [];
  }

  async init() {
    await this.ensureDirs();
    await this.loadScenarios();
    await this.loadHistory();
    console.log('[Scenario Generator] Инициализирован');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadScenarios() {
    try {
      const data = await fs.readFile(SCENARIOS_FILE, 'utf-8');
      this.scenarios = JSON.parse(data);
    } catch (e) {
      this.scenarios = [];
    }
  }

  async saveScenarios() {
    await fs.writeFile(SCENARIOS_FILE, JSON.stringify(this.scenarios, null, 2));
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
  // 2.1. ГЕНЕРАЦИЯ СЦЕНАРИЕВ
  // ============================================================

  async generateScenarios(count = 10) {
    const scenarios = [];
    const usedCombinations = new Set();

    // Получаем текущие данные из других модулей
    const context = await this.getContext();

    for (let i = 0; i < count * 2; i++) {
      if (scenarios.length >= count) break;

      // Выбираем случайную категорию
      const categories = Object.keys(SCENARIO_CATEGORIES);
      const categoryId = categories[Math.floor(Math.random() * categories.length)];
      const category = SCENARIO_CATEGORIES[categoryId];

      // Выбираем триггер и эффект
      const trigger = TRIGGERS[Math.floor(Math.random() * TRIGGERS.length)];
      const effect = EFFECTS[Math.floor(Math.random() * EFFECTS.length)];

      // Генерируем уникальный ID для сценария
      const combo = `${categoryId}-${trigger}-${effect}`;
      if (usedCombinations.has(combo)) continue;
      usedCombinations.add(combo);

      // Оценка вероятности (0-100)
      const probability = Math.round(20 + Math.random() * 60);
      
      // Оценка влияния (0-100)
      const impact = Math.round(30 + Math.random() * 60);
      
      // Временной горизонт
      const horizons = ['7 дней', '14 дней', '30 дней', '3 месяца', '6 месяцев'];
      const horizon = horizons[Math.floor(Math.random() * horizons.length)];

      // Генерируем описание
      const description = this.generateDescription(categoryId, trigger, effect, context);

      // Определяем статус
      let status = 'active';
      if (probability > 70) status = 'likely';
      else if (probability < 30) status = 'unlikely';

      scenarios.push({
        id: `scenario-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category: categoryId,
        categoryName: category.name,
        icon: category.icon,
        color: category.color,
        title: `${trigger} → ${effect}`,
        trigger: trigger,
        effect: effect,
        description: description,
        probability: probability,
        impact: impact,
        horizon: horizon,
        status: status,
        statusLabel: status === 'likely' ? '🟠 Вероятен' : 
                     status === 'active' ? '🟡 Актуален' : '🟢 Маловероятен',
        timestamp: new Date().toISOString(),
        context: context
      });
    }

    // Сортируем по вероятности
    scenarios.sort((a, b) => b.probability - a.probability);

    this.scenarios = scenarios;
    await this.saveScenarios();
    return scenarios;
  }

  // ============================================================
  // 2.2. ПОЛУЧЕНИЕ КОНТЕКСТА
  // ============================================================

  async getContext() {
    const context = {
      globalIndex: 0,
      conflictRisk: 0,
      cyberThreats: 0,
      economicStress: 0,
      timestamp: new Date().toISOString()
    };

    try {
      // Получаем глобальный индекс
      const indexFile = join(ROOT, 'data', 'geo', 'index-history.json');
      const indexData = await fs.readFile(indexFile, 'utf-8');
      const indexHistory = JSON.parse(indexData);
      if (indexHistory.length > 0) {
        context.globalIndex = indexHistory[indexHistory.length - 1].value || 0;
      }
    } catch (e) {}

    try {
      // Получаем конфликтный риск
      const conflictFile = join(ROOT, 'data', 'conflict-predictor', 'history.json');
      const conflictData = await fs.readFile(conflictFile, 'utf-8');
      const conflictHistory = JSON.parse(conflictData);
      if (conflictHistory.length > 0) {
        const last = conflictHistory[conflictHistory.length - 1];
        context.conflictRisk = last.stats?.avgRisk || 0;
      }
    } catch (e) {}

    try {
      // Получаем киберугрозы
      const cyberFile = join(ROOT, 'data', 'cyber-intel', 'history.json');
      const cyberData = await fs.readFile(cyberFile, 'utf-8');
      const cyberHistory = JSON.parse(cyberData);
      if (cyberHistory.length > 0) {
        context.cyberThreats = cyberHistory[cyberHistory.length - 1].stats?.totalThreats || 0;
      }
    } catch (e) {}

    return context;
  }

  // ============================================================
  // 2.3. ГЕНЕРАЦИЯ ОПИСАНИЯ
  // ============================================================

  generateDescription(category, trigger, effect, context) {
    const templates = [
      `В случае ${trigger.toLowerCase()} в текущих геополитических условиях, это приведёт к ${effect.toLowerCase()}.`,
      `Развитие событий по сценарию "${trigger}" с высокой вероятностью вызовет ${effect.toLowerCase()}.`,
      `Анализ текущей ситуации показывает, что ${trigger.toLowerCase()} может спровоцировать ${effect.toLowerCase()}.`,
      `При реализации сценария "${trigger}" ключевым последствием станет ${effect.toLowerCase()}.`
    ];

    let description = templates[Math.floor(Math.random() * templates.length)];

    // Добавляем контекстные данные
    if (context.globalIndex > 60) {
      description += ` Учитывая повышенный глобальный индекс (${context.globalIndex}), риск значительно выше.`;
    }
    if (context.conflictRisk > 50) {
      description += ` Конфликтный риск (${context.conflictRisk}%) усиливает вероятность этого сценария.`;
    }

    return description;
  }

  // ============================================================
  // 2.4. СТАТИСТИКА
  // ============================================================

  getStats() {
    const byCategory = {};
    const byStatus = { likely: 0, active: 0, unlikely: 0 };
    let avgProbability = 0;
    let avgImpact = 0;

    for (const scenario of this.scenarios) {
      byCategory[scenario.categoryName] = (byCategory[scenario.categoryName] || 0) + 1;
      byStatus[scenario.status] = (byStatus[scenario.status] || 0) + 1;
      avgProbability += scenario.probability;
      avgImpact += scenario.impact;
    }

    avgProbability = this.scenarios.length > 0 ? Math.round(avgProbability / this.scenarios.length) : 0;
    avgImpact = this.scenarios.length > 0 ? Math.round(avgImpact / this.scenarios.length) : 0;

    return {
      totalScenarios: this.scenarios.length,
      avgProbability: avgProbability,
      avgImpact: avgImpact,
      byCategory: byCategory,
      byStatus: byStatus,
      lastUpdate: new Date().toISOString()
    };
  }

  async updateAll() {
    console.log('[Scenario Generator] Генерация сценариев...');
    const scenarios = await this.generateScenarios(10);

    const result = {
      timestamp: new Date().toISOString(),
      scenarios: scenarios,
      stats: this.getStats(),
      summary: this.generateSummary(scenarios)
    };

    this.history.push(result);
    if (this.history.length > 100) this.history = this.history.slice(-100);
    await this.saveHistory();

    console.log(`[Scenario Generator] Готово. Сгенерировано ${scenarios.length} сценариев.`);
    return result;
  }

  generateSummary(scenarios) {
    const likely = scenarios.filter(s => s.status === 'likely');
    const highImpact = scenarios.filter(s => s.impact > 70);

    let summary = '🎯 ГЕНЕРАТОР СЦЕНАРИЕВ\n\n';
    summary += `Всего сценариев: ${scenarios.length}\n`;
    summary += `Вероятных: ${likely.length}, Высокое влияние: ${highImpact.length}\n\n`;

    if (likely.length > 0) {
      summary += '--- ВЕРОЯТНЫЕ СЦЕНАРИИ ---\n';
      for (const scenario of likely.slice(0, 3)) {
        summary += `🟠 ${scenario.title} (${scenario.probability}%)\n`;
      }
    }

    if (highImpact.length > 0 && likely.length === 0) {
      summary += '--- СЦЕНАРИИ С ВЫСОКИМ ВЛИЯНИЕМ ---\n';
      for (const scenario of highImpact.slice(0, 3)) {
        summary += `🔴 ${scenario.title} (влияние: ${scenario.impact}%)\n`;
      }
    }

    if (scenarios.length === 0) {
      summary += '📭 Сценарии не сгенерированы. Запустите генерацию.';
    }

    return summary;
  }

  getLatest() {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  getHistory(limit = 30) {
    return this.history.slice(-limit);
  }

  getScenarios() {
    return this.scenarios;
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let generator = null;

async function getGenerator() {
  if (!generator) {
    generator = new ScenarioGenerator();
    await generator.init();
  }
  return generator;
}

export async function handleScenarioGeneratorAPI(req, res) {
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
    const generator = await getGenerator();

    // ============================================================
    // GET /api/scenario-generator/status
    // ============================================================
    if (path === '/api/scenario-generator/status' && req.method === 'GET') {
      const stats = generator.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'scenario-generator',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // POST /api/scenario-generator/generate
    // ============================================================
    if (path === '/api/scenario-generator/generate' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const count = data.count || 10;
          const scenarios = await generator.generateScenarios(count);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, scenarios }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // ============================================================
    // POST /api/scenario-generator/update
    // ============================================================
    if (path === '/api/scenario-generator/update' && req.method === 'POST') {
      const result = await generator.updateAll();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        result: result,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // GET /api/scenario-generator/latest
    // ============================================================
    if (path === '/api/scenario-generator/latest' && req.method === 'GET') {
      const latest = generator.getLatest();
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
    // GET /api/scenario-generator/scenarios
    // ============================================================
    if (path === '/api/scenario-generator/scenarios' && req.method === 'GET') {
      const scenarios = generator.getScenarios();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, scenarios }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Scenario Generator API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleScenarioGeneratorAPI, ScenarioGenerator };
