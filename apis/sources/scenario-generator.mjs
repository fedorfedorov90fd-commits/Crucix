#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №48: ГЕНЕРАТОР СИНТЕТИЧЕСКИХ СЦЕНАРИЕВ
// MODULE №48: SYNTHETIC SCENARIO GENERATOR
// ============================================================
// Версия: 1.1 (с демо-данными)
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'scenarios');
const SCENARIOS_FILE = join(DATA_DIR, 'scenarios.json');
const TREE_FILE = join(DATA_DIR, 'tree.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

// ============================================================
// 1. ДЕМО-СЦЕНАРИИ (для немедленного отображения)
// ============================================================

const DEMO_SCENARIOS = [
  {
    id: 'demo-1',
    name: 'Эскалация на Ближнем Востоке',
    description: 'Конфликт между Ираном и Израилем перерастает в прямые военные столкновения с участием США.',
    category: 'geopolitics',
    icon: '⚔️',
    probability: 0.73,
    confidence: 85,
    impacts: [
      { type: 'economic', severity: 80, description: 'Рост цен на нефть (+25%)' },
      { type: 'political', severity: 70, description: 'Смена внешнеполитического курса' },
      { type: 'military', severity: 90, description: 'Введение военного положения в регионе' }
    ],
    triggerEvent: 'Иран нанёс ракетные удары по Израилю'
  },
  {
    id: 'demo-2',
    name: 'Экономический кризис в Европе',
    description: 'Рост инфляции и энергетический кризис приводят к рецессии в еврозоне.',
    category: 'economy',
    icon: '📉',
    probability: 0.61,
    confidence: 78,
    impacts: [
      { type: 'economic', severity: 85, description: 'Падение ВВП на 3.2%' },
      { type: 'social', severity: 75, description: 'Рост безработицы до 12%' },
      { type: 'political', severity: 60, description: 'Смена правительств в 3 странах' }
    ],
    triggerEvent: 'ЕЦБ повысил ставку до 5.5%'
  },
  {
    id: 'demo-3',
    name: 'Кибератака на энергосистему США',
    description: 'Массированная кибератака выводит из строя энергосистему восточного побережья.',
    category: 'cyber',
    icon: '💻',
    probability: 0.58,
    confidence: 72,
    impacts: [
      { type: 'economic', severity: 90, description: 'Ущерб $200 млрд' },
      { type: 'political', severity: 80, description: 'Ужесточение киберзаконодательства' },
      { type: 'social', severity: 70, description: 'Массовые протесты из-за блэкаута' }
    ],
    triggerEvent: 'Обнаружена уязвимость в SCADA-системах'
  },
  {
    id: 'demo-4',
    name: 'Прорыв в мирных переговорах',
    description: 'Украина и Россия достигают соглашения о прекращении огня и начале переговоров.',
    category: 'diplomacy',
    icon: '🤝',
    probability: 0.42,
    confidence: 65,
    impacts: [
      { type: 'political', severity: 85, description: 'Изменение международного порядка' },
      { type: 'economic', severity: 70, description: 'Снижение цен на энергоносители' },
      { type: 'social', severity: 60, description: 'Возвращение беженцев' }
    ],
    triggerEvent: 'Встреча лидеров в Стамбуле'
  },
  {
    id: 'demo-5',
    name: 'Землетрясение в Калифорнии',
    description: 'Мощное землетрясение магнитудой 7.8 разрушает Лос-Анджелес и Сан-Франциско.',
    category: 'environment',
    icon: '🌋',
    probability: 0.35,
    confidence: 60,
    impacts: [
      { type: 'economic', severity: 95, description: 'Ущерб $500 млрд' },
      { type: 'social', severity: 90, description: 'Десятки тысяч жертв' },
      { type: 'political', severity: 70, description: 'Реакция федерального правительства' }
    ],
    triggerEvent: 'Активность разлома Сан-Андреас'
  },
  {
    id: 'demo-6',
    name: 'Новая пандемия',
    description: 'Вспышка нового вируса с высоким уровнем смертности и быстрым распространением.',
    category: 'health',
    icon: '🦠',
    probability: 0.28,
    confidence: 55,
    impacts: [
      { type: 'health', severity: 95, description: 'Миллионы заболевших' },
      { type: 'economic', severity: 85, description: 'Глобальная рецессия' },
      { type: 'social', severity: 80, description: 'Карантинные ограничения' }
    ],
    triggerEvent: 'Выявлены первые случаи в Китае'
  },
  {
    id: 'demo-7',
    name: 'Смена политического курса в США',
    description: 'Новая администрация кардинально меняет внешнеполитический курс.',
    category: 'politics',
    icon: '🏛️',
    probability: 0.45,
    confidence: 70,
    impacts: [
      { type: 'political', severity: 90, description: 'Пересмотр международных союзов' },
      { type: 'economic', severity: 75, description: 'Изменение торговой политики' },
      { type: 'social', severity: 65, description: 'Поляризация общества' }
    ],
    triggerEvent: 'Результаты президентских выборов'
  },
  {
    id: 'demo-8',
    name: 'Энергетический коллапс в Европе',
    description: 'Полное прекращение поставок газа из России приводит к коллапсу экономики ЕС.',
    category: 'energy',
    icon: '⚡',
    probability: 0.52,
    confidence: 75,
    impacts: [
      { type: 'economic', severity: 95, description: 'Деиндустриализация Европы' },
      { type: 'social', severity: 85, description: 'Массовые протесты' },
      { type: 'political', severity: 80, description: 'Раскол ЕС' }
    ],
    triggerEvent: 'Россия прекратила транзит газа'
  }
];

// ============================================================
// 2. КЛАСС ГЕНЕРАТОРА СЦЕНАРИЕВ
// ============================================================

class ScenarioGenerator {
  constructor() {
    this.scenarios = [];
    this.tree = { nodes: [], edges: [] };
    this.history = [];
  }

  async init() {
    await this.ensureDirs();
    await this.loadScenarios();
    await this.loadTree();
    await this.loadHistory();

    // Если нет сценариев — загружаем демо
    if (this.scenarios.length === 0) {
      this.scenarios = DEMO_SCENARIOS;
      await this.saveScenarios();
      this.buildDecisionTree();
      await this.saveTree();
      console.log('[Scenario Generator] Загружены демо-сценарии');
    }

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

  async loadTree() {
    try {
      const data = await fs.readFile(TREE_FILE, 'utf-8');
      this.tree = JSON.parse(data);
    } catch (e) {
      this.tree = { nodes: [], edges: [] };
    }
  }

  async saveTree() {
    await fs.writeFile(TREE_FILE, JSON.stringify(this.tree, null, 2));
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
  // 2.1. ГЕНЕРАЦИЯ НОВЫХ СЦЕНАРИЕВ
  // ============================================================

  async generateScenarios() {
    // Используем демо-сценарии с обновлёнными вероятностями
    const scenarios = DEMO_SCENARIOS.map(s => ({
      ...s,
      probability: Math.min(0.95, Math.max(0.05, s.probability + (Math.random() - 0.5) * 0.2)),
      timestamp: new Date().toISOString()
    }));

    // Сортируем по вероятности
    scenarios.sort((a, b) => b.probability - a.probability);

    this.scenarios = scenarios;
    await this.saveScenarios();

    // Строим дерево
    this.buildDecisionTree();
    await this.saveTree();

    // Сохраняем историю
    this.history.push({
      timestamp: new Date().toISOString(),
      scenarios: scenarios.length
    });
    await this.saveHistory();

    return scenarios;
  }

  // ============================================================
  // 2.2. ПОСТРОЕНИЕ ДЕРЕВА РЕШЕНИЙ
  // ============================================================

  buildDecisionTree() {
    const nodes = [];
    const edges = [];
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

    // Корневой узел
    nodes.push({
      id: 'root',
      label: 'Текущая ситуация',
      color: '#5bc0f8',
      level: 0
    });

    for (let i = 0; i < Math.min(this.scenarios.length, 8); i++) {
      const s = this.scenarios[i];
      const color = colors[i % colors.length];

      nodes.push({
        id: s.id,
        label: s.name.slice(0, 25) + (s.name.length > 25 ? '...' : ''),
        color: color,
        level: 1,
        probability: s.probability,
        icon: s.icon
      });

      edges.push({
        from: 'root',
        to: s.id,
        value: s.probability,
        label: `${(s.probability * 100).toFixed(0)}%`
      });
    }

    this.tree = { nodes, edges };
    return this.tree;
  }

  // ============================================================
  // 2.3. РЕКОМЕНДАЦИИ
  // ============================================================

  getRecommendations() {
    const recommendations = [];
    const topScenarios = this.scenarios.filter(s => s.probability > 0.4).slice(0, 5);

    const actions = {
      'geopolitics': 'Усилить меры безопасности, мониторинг ситуации',
      'economy': 'Диверсифицировать активы, создать резервы',
      'cyber': 'Усилить киберзащиту, провести аудит систем',
      'diplomacy': 'Начать подготовку к переговорам',
      'environment': 'Создать штаб по ликвидации последствий',
      'health': 'Подготовить систему здравоохранения',
      'politics': 'Адаптировать стратегию под изменения',
      'energy': 'Разработать план энергосбережения'
    };

    for (const s of topScenarios) {
      recommendations.push({
        scenario: s.name,
        probability: s.probability,
        action: actions[s.category] || 'Разработать план действий',
        priority: s.probability > 0.6 ? 'high' : 'medium'
      });
    }

    return recommendations;
  }

  // ============================================================
  // 2.4. СТАТИСТИКА
  // ============================================================

  getStats() {
    const categories = new Set(this.scenarios.map(s => s.category));
    return {
      totalScenarios: this.scenarios.length,
      categories: categories.size,
      historyEntries: this.history.length,
      lastUpdate: this.history.length > 0 ? this.history[this.history.length - 1].timestamp : null
    };
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

export async function handleScenarioAPI(req, res) {
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
    // GET /api/scenarios/status
    // ============================================================
    if (path === '/api/scenarios/status' && req.method === 'GET') {
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
    // POST /api/scenarios/generate
    // ============================================================
    if (path === '/api/scenarios/generate' && req.method === 'POST') {
      const scenarios = await generator.generateScenarios();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        scenarios: scenarios,
        count: scenarios.length,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // GET /api/scenarios/list
    // ============================================================
    if (path === '/api/scenarios/list' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const scenarios = generator.scenarios.slice(0, limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, scenarios }));
      return;
    }

    // ============================================================
    // GET /api/scenarios/tree
    // ============================================================
    if (path === '/api/scenarios/tree' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, tree: generator.tree }));
      return;
    }

    // ============================================================
    // GET /api/scenarios/recommendations
    // ============================================================
    if (path === '/api/scenarios/recommendations' && req.method === 'GET') {
      const recommendations = generator.getRecommendations();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, recommendations }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Scenario API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleScenarioAPI, ScenarioGenerator };
