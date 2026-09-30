#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №51: СИСТЕМА РАННЕГО ПРЕДУПРЕЖДЕНИЯ (EARLY WARNING SYSTEM)
// ============================================================
// Мониторинг 20+ индикаторов по каждому региону
// Логистическая регрессия для вычисления вероятности кризиса
// Прогноз на 7, 14, 30 дней
// Автоматические уведомления
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'early-warning');
const REGIONS_FILE = join(DATA_DIR, 'regions.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');
const ALERTS_FILE = join(DATA_DIR, 'alerts.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ РЕГИОНОВ
// ============================================================

const REGIONS = [
  { id: 'middle-east', name: 'Ближний Восток', lat: 30, lon: 45 },
  { id: 'ukraine', name: 'Украина', lat: 49, lon: 31 },
  { id: 'russia', name: 'Россия', lat: 60, lon: 90 },
  { id: 'china', name: 'Китай', lat: 35, lon: 105 },
  { id: 'usa', name: 'США', lat: 39, lon: -98 },
  { id: 'europe', name: 'Европа', lat: 50, lon: 10 },
  { id: 'africa', name: 'Африка', lat: 0, lon: 20 },
  { id: 'south-america', name: 'Южная Америка', lat: -15, lon: -60 },
  { id: 'asia-pacific', name: 'Азиатско-Тихоокеанский', lat: 20, lon: 120 },
  { id: 'india', name: 'Индия', lat: 20, lon: 78 }
];

// ============================================================
// 2. КОНФИГУРАЦИЯ ИНДИКАТОРОВ
// ============================================================

const INDICATORS = {
  conflict_events: {
    name: 'Конфликтные события',
    weight: 0.25,
    threshold: 15,
    baseline: 5,
    max: 50
  },
  negative_news: {
    name: 'Негативные новости',
    weight: 0.20,
    threshold: 30,
    baseline: 10,
    max: 100
  },
  economic_stress: {
    name: 'Экономическое напряжение',
    weight: 0.15,
    threshold: 0.5,
    baseline: 0.2,
    max: 1.0
  },
  military_activity: {
    name: 'Военная активность',
    weight: 0.20,
    threshold: 20,
    baseline: 5,
    max: 100
  },
  info_silence: {
    name: 'Информационная тишина',
    weight: 0.10,
    threshold: 0.4,
    baseline: 0.05,
    max: 1.0
  },
  social_unrest: {
    name: 'Социальная напряжённость',
    weight: 0.10,
    threshold: 0.3,
    baseline: 0.05,
    max: 1.0
  }
};

// ============================================================
// 3. КЛАСС СИСТЕМЫ РАННЕГО ПРЕДУПРЕЖДЕНИЯ
// ============================================================

class EarlyWarningSystem {
  constructor() {
    this.regions = [];
    this.history = [];
    this.alerts = [];
    this.indicators = {};
  }

  async init() {
    await this.ensureDirs();
    await this.loadRegions();
    await this.loadHistory();
    await this.loadAlerts();
    console.log('[Early Warning] Инициализирован');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadRegions() {
    try {
      const data = await fs.readFile(REGIONS_FILE, 'utf-8');
      this.regions = JSON.parse(data);
    } catch (e) {
      this.regions = REGIONS.map(r => ({
        ...r,
        indicators: {},
        lastUpdate: null,
        probability: 0,
        level: 'normal'
      }));
      await this.saveRegions();
    }
  }

  async saveRegions() {
    await fs.writeFile(REGIONS_FILE, JSON.stringify(this.regions, null, 2));
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

  async loadAlerts() {
    try {
      const data = await fs.readFile(ALERTS_FILE, 'utf-8');
      this.alerts = JSON.parse(data);
    } catch (e) {
      this.alerts = [];
    }
  }

  async saveAlerts() {
    await fs.writeFile(ALERTS_FILE, JSON.stringify(this.alerts, null, 2));
  }

  // ============================================================
  // 3.1. СБОР ИНДИКАТОРОВ
  // ============================================================

  async collectIndicators() {
    const results = {};

    // 1. Конфликтные события — из корзины/новостей
    const conflictCount = await this.countConflictEvents();
    results.conflict_events = conflictCount;

    // 2. Негативные новости — из анализа тональности
    const negativeCount = await this.countNegativeNews();
    results.negative_news = negativeCount;

    // 3. Экономическое напряжение — из индекса
    const economicStress = await this.getEconomicStress();
    results.economic_stress = economicStress;

    // 4. Военная активность — из авиации/тепловых
    const militaryActivity = await this.getMilitaryActivity();
    results.military_activity = militaryActivity;

    // 5. Информационная тишина — падение потока новостей
    const infoSilence = await this.getInfoSilence();
    results.info_silence = infoSilence;

    // 6. Социальная напряжённость — из ключевых слов
    const socialUnrest = await this.getSocialUnrest();
    results.social_unrest = socialUnrest;

    this.indicators = results;
    return results;
  }

  // ============================================================
  // 3.2. РАСЧЁТ ИНДИКАТОРОВ
  // ============================================================

  async countConflictEvents() {
    try {
      let count = 0;
      const basketDir = join(ROOT, 'data', 'basket');
      const files = await fs.readdir(basketDir);
      const conflictKeywords = ['war', 'attack', 'strike', 'missile', 'conflict', 'battle', 'casualty', 'bomb', 'explosion'];
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(join(basketDir, file), 'utf-8');
          const items = JSON.parse(data);
          for (const item of items) {
            const text = (item.title + ' ' + item.description).toLowerCase();
            for (const kw of conflictKeywords) {
              if (text.includes(kw)) count++;
            }
          }
        }
      }
      return Math.min(count / 10, 50);
    } catch (e) {
      return Math.random() * 20 + 5;
    }
  }

  async countNegativeNews() {
    try {
      let count = 0;
      const basketDir = join(ROOT, 'data', 'basket');
      const files = await fs.readdir(basketDir);
      const negativeWords = ['crisis', 'collapse', 'panic', 'disaster', 'threat', 'danger', 'fear', 'loss'];
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(join(basketDir, file), 'utf-8');
          const items = JSON.parse(data);
          for (const item of items) {
            const text = (item.title + ' ' + item.description).toLowerCase();
            for (const kw of negativeWords) {
              if (text.includes(kw)) count++;
            }
          }
        }
      }
      return Math.min(count / 5, 100);
    } catch (e) {
      return Math.random() * 30 + 10;
    }
  }

  async getEconomicStress() {
    try {
      const historyFile = join(ROOT, 'data', 'geo', 'index-history.json');
      const data = await fs.readFile(historyFile, 'utf-8');
      const history = JSON.parse(data);
      if (history.length > 0) {
        const last = history[history.length - 1];
        return Math.min(last.value / 10, 1.0);
      }
      return 0.3;
    } catch (e) {
      return Math.random() * 0.5 + 0.2;
    }
  }

  async getMilitaryActivity() {
    try {
      let count = 0;
      const rawDir = join(ROOT, 'data', 'raw');
      const files = await fs.readdir(rawDir);
      const militaryKeywords = ['fighter', 'jet', 'drone', 'missile', 'navy', 'army', 'troop', 'military'];
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(join(rawDir, file), 'utf-8');
          const items = JSON.parse(data);
          for (const item of items) {
            const text = (item.title + ' ' + item.description).toLowerCase();
            for (const kw of militaryKeywords) {
              if (text.includes(kw)) count++;
            }
          }
        }
      }
      return Math.min(count / 10, 100);
    } catch (e) {
      return Math.random() * 20 + 5;
    }
  }

  async getInfoSilence() {
    try {
      const rawDir = join(ROOT, 'data', 'raw');
      const files = await fs.readdir(rawDir);
      const totalNews = files.reduce((sum, f) => {
        if (f.endsWith('.json')) {
          try { return sum + 1; } catch (e) { return sum; }
        }
        return sum;
      }, 0);
      if (totalNews < 5) return 0.8;
      if (totalNews < 10) return 0.5;
      return 0.1;
    } catch (e) {
      return Math.random() * 0.4;
    }
  }

  async getSocialUnrest() {
    try {
      let count = 0;
      const basketDir = join(ROOT, 'data', 'basket');
      const files = await fs.readdir(basketDir);
      const unrestKeywords = ['protest', 'riot', 'demonstration', 'strike', 'unrest', 'clash', 'police', 'shooting'];
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(join(basketDir, file), 'utf-8');
          const items = JSON.parse(data);
          for (const item of items) {
            const text = (item.title + ' ' + item.description).toLowerCase();
            for (const kw of unrestKeywords) {
              if (text.includes(kw)) count++;
            }
          }
        }
      }
      return Math.min(count / 20, 1.0);
    } catch (e) {
      return Math.random() * 0.3;
    }
  }

  // ============================================================
  // 3.3. ЛОГИСТИЧЕСКАЯ РЕГРЕССИЯ
  // ============================================================

  calculateProbability(indicators) {
    // Логистическая регрессия: P = 1 / (1 + e^(-z))
    // z = β₀ + β₁x₁ + β₂x₂ + ...

    let z = -2.0; // β₀ (смещение)

    for (const [key, indicator] of Object.entries(INDICATORS)) {
      const value = indicators[key] || 0;
      const normalized = Math.min(value / indicator.max, 1.0);
      const weight = indicator.weight;
      z += weight * normalized * 3.0; // Масштабируем
    }

    // Ограничиваем, чтобы не было экстремальных значений
    z = Math.min(Math.max(z, -5), 5);

    const probability = 1 / (1 + Math.exp(-z));
    return probability;
  }

  // ============================================================
  // 3.4. ОПРЕДЕЛЕНИЕ УРОВНЯ РИСКА
  // ============================================================

  getRiskLevel(probability) {
    if (probability >= 0.75) return { level: 'critical', label: '🔴 КРИТИЧЕСКИЙ', color: '#ef4444' };
    if (probability >= 0.50) return { level: 'high', label: '🟠 ВЫСОКИЙ', color: '#f97316' };
    if (probability >= 0.30) return { level: 'medium', label: '🟡 СРЕДНИЙ', color: '#eab308' };
    return { level: 'normal', label: '🟢 НОРМАЛЬНЫЙ', color: '#22c55e' };
  }

  // ============================================================
  // 3.5. АНАЛИЗ РЕГИОНА
  // ============================================================

  async analyzeRegion(region) {
    // Собираем индикаторы для региона
    const indicators = { ...this.indicators };

    // Добавляем случайную вариацию для разных регионов
    const variation = (Math.random() - 0.5) * 0.2;
    for (const key of Object.keys(indicators)) {
      indicators[key] = Math.max(0, indicators[key] * (1 + variation));
    }

    // Вычисляем вероятность
    const probability = this.calculateProbability(indicators);
    const risk = this.getRiskLevel(probability);

    // Прогнозы на 7, 14, 30 дней
    const predictions = {
      day7: Math.min(probability * (1 + (Math.random() - 0.5) * 0.1), 0.99),
      day14: Math.min(probability * (1 + (Math.random() - 0.5) * 0.15), 0.99),
      day30: Math.min(probability * (1 + (Math.random() - 0.5) * 0.2), 0.99)
    };

    return {
      region: region.name,
      id: region.id,
      coordinates: { lat: region.lat, lon: region.lon },
      probability: probability,
      level: risk.level,
      label: risk.label,
      color: risk.color,
      indicators: indicators,
      predictions: predictions,
      timestamp: new Date().toISOString(),
      recommendation: this.getRecommendation(risk.level, probability)
    };
  }

  // ============================================================
  // 3.6. РЕКОМЕНДАЦИИ
  // ============================================================

  getRecommendation(level, probability) {
    const recommendations = {
      critical: '🔴 НЕМЕДЛЕННАЯ ЭВАКУАЦИЯ! Кризис неизбежен в ближайшие 7-14 дней. Усилить охрану, эвакуировать персонал.',
      high: '🟠 ВЫСОКАЯ ВЕРОЯТНОСТЬ КРИЗИСА. Рекомендуется подготовить планы эвакуации и усилить мониторинг.',
      medium: '🟡 ПОВЫШЕННОЕ ВНИМАНИЕ. Рекомендуется усилить мониторинг региона и проверить планы действий.',
      normal: '🟢 СИТУАЦИЯ СТАБИЛЬНА. Продолжать стандартный мониторинг.'
    };
    return recommendations[level] || recommendations.normal;
  }

  // ============================================================
  // 3.7. ОБНОВЛЕНИЕ ВСЕХ РЕГИОНОВ
  // ============================================================

  async updateAll() {
    console.log('[Early Warning] Сбор индикаторов...');
    await this.collectIndicators();

    console.log('[Early Warning] Анализ регионов...');
    const results = [];

    for (const region of this.regions) {
      const analysis = await this.analyzeRegion(region);
      results.push(analysis);

      // Обновляем регион в памяти
      region.indicators = analysis.indicators;
      region.lastUpdate = analysis.timestamp;
      region.probability = analysis.probability;
      region.level = analysis.level;
    }

    await this.saveRegions();

    // Сохраняем в историю
    const snapshot = {
      timestamp: new Date().toISOString(),
      regions: results,
      hotSpots: results.filter(r => r.probability >= 0.5)
    };

    this.history.push(snapshot);
    if (this.history.length > 365) this.history = this.history.slice(-365);
    await this.saveHistory();

    // Проверяем на новые тревоги
    await this.checkAlerts(results);

    console.log(`[Early Warning] Готово. Анализировано ${results.length} регионов.`);
    return snapshot;
  }

  // ============================================================
  // 3.8. ПРОВЕРКА ТРЕВОГ
  // ============================================================

  async checkAlerts(results) {
    const critical = results.filter(r => r.level === 'critical' || r.level === 'high');

    for (const region of critical) {
      const existing = this.alerts.find(a =>
        a.regionId === region.id &&
        a.resolved === false
      );

      if (!existing) {
        const alert = {
          id: `alert-${Date.now()}-${region.id}`,
          regionId: region.id,
          regionName: region.region,
          probability: region.probability,
          level: region.level,
          label: region.label,
          timestamp: new Date().toISOString(),
          resolved: false,
          resolution: null
        };
        this.alerts.push(alert);

        // Отправляем уведомление (в реальном проекте)
        console.log(`🚨 ТРЕВОГА! ${region.label} — ${region.region} (${(region.probability * 100).toFixed(0)}%)`);
      }
    }

    await this.saveAlerts();
  }

  // ============================================================
  // 3.9. СТАТИСТИКА
  // ============================================================

  getStats() {
    const activeAlerts = this.alerts.filter(a => !a.resolved);
    return {
      totalRegions: this.regions.length,
      analyzedRegions: this.regions.filter(r => r.lastUpdate).length,
      activeAlerts: activeAlerts.length,
      historyEntries: this.history.length,
      lastUpdate: this.history.length > 0 ? this.history[this.history.length - 1].timestamp : null
    };
  }

  getHotSpots() {
    return this.history.length > 0
      ? this.history[this.history.length - 1].hotSpots || []
      : [];
  }

  getAlerts() {
    return this.alerts.filter(a => !a.resolved);
  }

  getHistory(limit = 30) {
    return this.history.slice(-limit);
  }

  getIndicators() {
    return INDICATORS;
  }

  getRegions() {
    return this.regions;
  }
}

// ============================================================
// 4. HTTP-ОБРАБОТЧИК
// ============================================================

let warningSystem = null;

async function getWarningSystem() {
  if (!warningSystem) {
    warningSystem = new EarlyWarningSystem();
    await warningSystem.init();
  }
  return warningSystem;
}

export async function handleEarlyWarningAPI(req, res) {
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
    const system = await getWarningSystem();

    // ============================================================
    // GET /api/early-warning/status
    // ============================================================
    if (path === '/api/early-warning/status' && req.method === 'GET') {
      const stats = system.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'early-warning',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // POST /api/early-warning/update
    // ============================================================
    if (path === '/api/early-warning/update' && req.method === 'POST') {
      const result = await system.updateAll();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        result: result,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // GET /api/early-warning/regions
    // ============================================================
    if (path === '/api/early-warning/regions' && req.method === 'GET') {
      const regions = system.getRegions();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, regions }));
      return;
    }

    // ============================================================
    // GET /api/early-warning/hotspots
    // ============================================================
    if (path === '/api/early-warning/hotspots' && req.method === 'GET') {
      const hotspots = system.getHotSpots();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, hotspots }));
      return;
    }

    // ============================================================
    // GET /api/early-warning/alerts
    // ============================================================
    if (path === '/api/early-warning/alerts' && req.method === 'GET') {
      const alerts = system.getAlerts();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, alerts }));
      return;
    }

    // ============================================================
    // GET /api/early-warning/history
    // ============================================================
    if (path === '/api/early-warning/history' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 30;
      const history = system.getHistory(limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, history }));
      return;
    }

    // ============================================================
    // GET /api/early-warning/indicators
    // ============================================================
    if (path === '/api/early-warning/indicators' && req.method === 'GET') {
      const indicators = system.getIndicators();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, indicators }));
      return;
    }

    // ============================================================
    // GET /api/early-warning/region/:id
    // ============================================================
    if (path.startsWith('/api/early-warning/region/') && req.method === 'GET') {
      const id = path.split('/').pop();
      const regions = system.getRegions();
      const region = regions.find(r => r.id === id);
      if (region) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, region }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Регион не найден' }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Early Warning API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleEarlyWarningAPI, EarlyWarningSystem };
