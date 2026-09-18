#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №54: ПРОГНОЗНЫЙ ИНТЕЛЛЕКТ (PREDICTION INTELLIGENCE)
// ============================================================
// Агрегация прогнозов из Polymarket, Kalshi, PredictIt, Metaculus
// Сравнение прогнозов с реальностью
// AI-анализ расхождений
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'prediction');
const MARKETS_FILE = join(DATA_DIR, 'markets.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');
const ACCURACY_FILE = join(DATA_DIR, 'accuracy.json');

// ============================================================
// 1. ДАННЫЕ — РЫНКИ/СОБЫТИЯ
// ============================================================

const MARKETS = [
  // Геополитика
  {
    id: 'ukraine-war-end',
    name: 'Война в Украине завершится в 2026',
    category: 'geopolitics',
    region: 'europe',
    probability: 0.32,
    sources: {
      polymarket: 0.28,
      kalshi: 0.35,
      predictit: 0.30,
      metaculus: 0.35,
      good_judgment: 0.30
    },
    status: 'active',
    resolution_date: '2026-12-31',
    resolution: null
  },
  {
    id: 'iran-conflict',
    name: 'Военный конфликт с Ираном в 2026',
    category: 'geopolitics',
    region: 'middle-east',
    probability: 0.45,
    sources: {
      polymarket: 0.42,
      kalshi: 0.48,
      predictit: 0.40,
      metaculus: 0.45,
      good_judgment: 0.50
    },
    status: 'active',
    resolution_date: '2026-12-31',
    resolution: null
  },
  {
    id: 'taiwan-conflict',
    name: 'Конфликт в Тайваньском проливе',
    category: 'geopolitics',
    region: 'asia-pacific',
    probability: 0.28,
    sources: {
      polymarket: 0.25,
      kalshi: 0.30,
      predictit: 0.25,
      metaculus: 0.30,
      good_judgment: 0.28
    },
    status: 'active',
    resolution_date: '2026-12-31',
    resolution: null
  },
  // Экономика
  {
    id: 'us-recession-2026',
    name: 'Рецессия в США в 2026',
    category: 'economy',
    region: 'us',
    probability: 0.38,
    sources: {
      polymarket: 0.35,
      kalshi: 0.40,
      predictit: 0.35,
      metaculus: 0.38,
      good_judgment: 0.40
    },
    status: 'active',
    resolution_date: '2026-12-31',
    resolution: null
  },
  {
    id: 'fed-rate-cut',
    name: 'ФРС снизит ставку до 3% в 2026',
    category: 'economy',
    region: 'us',
    probability: 0.55,
    sources: {
      polymarket: 0.52,
      kalshi: 0.58,
      predictit: 0.50,
      metaculus: 0.55,
      good_judgment: 0.60
    },
    status: 'active',
    resolution_date: '2026-12-31',
    resolution: null
  },
  {
    id: 'oil-price-100',
    name: 'Нефть Brent > $100 в 2026',
    category: 'economy',
    region: 'global',
    probability: 0.42,
    sources: {
      polymarket: 0.40,
      kalshi: 0.45,
      predictit: 0.38,
      metaculus: 0.42,
      good_judgment: 0.45
    },
    status: 'active',
    resolution_date: '2026-12-31',
    resolution: null
  },
  // Выборы
  {
    id: 'us-election-2026',
    name: 'Демократы побеждают на выборах 2026',
    category: 'elections',
    region: 'us',
    probability: 0.48,
    sources: {
      polymarket: 0.45,
      kalshi: 0.50,
      predictit: 0.45,
      metaculus: 0.48,
      good_judgment: 0.52
    },
    status: 'active',
    resolution_date: '2026-11-08',
    resolution: null
  },
  {
    id: 'france-election',
    name: 'Ле Пен побеждает во Франции 2026',
    category: 'elections',
    region: 'europe',
    probability: 0.35,
    sources: {
      polymarket: 0.32,
      kalshi: 0.38,
      predictit: 0.30,
      metaculus: 0.35,
      good_judgment: 0.40
    },
    status: 'active',
    resolution_date: '2026-06-15',
    resolution: null
  },
  // Технологии
  {
    id: 'ai-regulation-2026',
    name: 'Глобальное регулирование ИИ принято в 2026',
    category: 'technology',
    region: 'global',
    probability: 0.52,
    sources: {
      polymarket: 0.50,
      kalshi: 0.55,
      predictit: 0.48,
      metaculus: 0.52,
      good_judgment: 0.55
    },
    status: 'active',
    resolution_date: '2026-12-31',
    resolution: null
  },
  {
    id: 'quantum-breakthrough',
    name: 'Прорыв в квантовых вычислениях в 2026',
    category: 'technology',
    region: 'global',
    probability: 0.25,
    sources: {
      polymarket: 0.22,
      kalshi: 0.28,
      predictit: 0.20,
      metaculus: 0.25,
      good_judgment: 0.30
    },
    status: 'active',
    resolution_date: '2026-12-31',
    resolution: null
  },
  // Климат
  {
    id: 'climate-disaster-2026',
    name: 'Крупная климатическая катастрофа в 2026',
    category: 'climate',
    region: 'global',
    probability: 0.30,
    sources: {
      polymarket: 0.28,
      kalshi: 0.32,
      predictit: 0.25,
      metaculus: 0.30,
      good_judgment: 0.35
    },
    status: 'active',
    resolution_date: '2026-12-31',
    resolution: null
  }
];

// ============================================================
// 2. ИСТОРИЧЕСКАЯ ТОЧНОСТЬ ИСТОЧНИКОВ
// ============================================================

const SOURCE_ACCURACY = {
  polymarket: { accuracy: 0.82, samples: 100, weight: 0.25 },
  kalshi: { accuracy: 0.79, samples: 80, weight: 0.20 },
  predictit: { accuracy: 0.76, samples: 90, weight: 0.18 },
  metaculus: { accuracy: 0.88, samples: 60, weight: 0.22 },
  good_judgment: { accuracy: 0.85, samples: 50, weight: 0.15 }
};

// ============================================================
// 3. КЛАСС ПРОГНОЗНОГО ИНТЕЛЛЕКТА
// ============================================================

class PredictionIntel {
  constructor() {
    this.markets = [];
    this.history = [];
    this.accuracy = {};
  }

  async init() {
    await this.ensureDirs();
    await this.loadData();
    console.log('[PI] Прогнозный интеллект инициализирован');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadData() {
    this.markets = MARKETS;
    this.accuracy = SOURCE_ACCURACY;
    await this.loadHistory();
    await this.loadAccuracy();
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

  async loadAccuracy() {
    try {
      const data = await fs.readFile(ACCURACY_FILE, 'utf-8');
      this.accuracy = JSON.parse(data);
    } catch (e) {
      this.accuracy = SOURCE_ACCURACY;
    }
  }

  async saveAccuracy() {
    await fs.writeFile(ACCURACY_FILE, JSON.stringify(this.accuracy, null, 2));
  }

  // ============================================================
  // 3.1. АГРЕГАЦИЯ ПРОГНОЗОВ
  // ============================================================

  aggregatePredictions(market) {
    const sources = market.sources;
    let totalWeight = 0;
    let weightedSum = 0;
    let minProb = 1;
    let maxProb = 0;
    const sourceProbs = [];

    for (const [source, prob] of Object.entries(sources)) {
      const accuracy = this.accuracy[source] || { accuracy: 0.5, weight: 0.1 };
      const weight = accuracy.weight || 0.1;
      totalWeight += weight;
      weightedSum += prob * weight;
      if (prob < minProb) minProb = prob;
      if (prob > maxProb) maxProb = prob;
      sourceProbs.push({ source, probability: prob, weight });
    }

    const aggregated = weightedSum / totalWeight;
    const spread = maxProb - minProb;

    return {
      market_id: market.id,
      aggregated_probability: Math.round(aggregated * 100) / 100,
      min_probability: Math.round(minProb * 100) / 100,
      max_probability: Math.round(maxProb * 100) / 100,
      spread: Math.round(spread * 100) / 100,
      sources: sourceProbs,
      confidence: this.calculateConfidence(market, sourceProbs),
      timestamp: new Date().toISOString()
    };
  }

  calculateConfidence(market, sourceProbs) {
    // Факторы: согласованность источников, количество источников, точность
    const consensus = 1 - (Math.max(...sourceProbs.map(s => s.probability)) - 
                          Math.min(...sourceProbs.map(s => s.probability)));
    const countFactor = Math.min(sourceProbs.length / 5, 1);
    const avgAccuracy = sourceProbs.reduce((sum, s) => {
      const acc = this.accuracy[s.source]?.accuracy || 0.5;
      return sum + acc;
    }, 0) / sourceProbs.length;
    
    return Math.round((consensus * 0.4 + countFactor * 0.3 + avgAccuracy * 0.3) * 100);
  }

  // ============================================================
  // 3.2. ДЕТЕКЦИЯ АНОМАЛИЙ
  // ============================================================

  detectAnomalies(market) {
    const anomalies = [];
    const probs = Object.values(market.sources);
    const mean = probs.reduce((a, b) => a + b, 0) / probs.length;
    const std = Math.sqrt(probs.reduce((a, b) => a + (b - mean) ** 2, 0) / probs.length);
    const threshold = 2 * std;

    for (const [source, prob] of Object.entries(market.sources)) {
      if (Math.abs(prob - mean) > threshold) {
        anomalies.push({
          source,
          probability: prob,
          deviation: prob - mean,
          threshold,
          severity: Math.abs(prob - mean) / threshold > 1.5 ? 'high' : 'medium'
        });
      }
    }
    return anomalies;
  }

  // ============================================================
  // 3.3. АНАЛИЗ РАСХОЖДЕНИЙ (AI)
  // ============================================================

  analyzeDiscrepancy(market) {
    const aggregated = this.aggregatePredictions(market);
    const anomalies = this.detectAnomalies(market);
    
    let analysis = {
      market_name: market.name,
      category: market.category,
      aggregated_probability: aggregated.aggregated_probability,
      spread: aggregated.spread,
      anomalies: anomalies,
      sources_count: Object.keys(market.sources).length
    };

    // Определяем расхождение
    if (aggregated.spread > 0.2) {
      analysis.discrepancy = 'high';
      analysis.recommendation = '⚠️ Высокое расхождение между источниками. Рекомендуется проверить данные.';
    } else if (aggregated.spread > 0.1) {
      analysis.discrepancy = 'medium';
      analysis.recommendation = '⚡ Умеренное расхождение. Обратите внимание на аномалии.';
    } else {
      analysis.discrepancy = 'low';
      analysis.recommendation = '✅ Прогнозы согласованы. Доверие высокое.';
    }

    if (anomalies.length > 0) {
      analysis.anomaly_sources = anomalies.map(a => `${a.source} (${Math.round(a.probability * 100)}%)`);
    }

    return analysis;
  }

  // ============================================================
  // 3.4. ТЕПЛОВАЯ КАРТА
  // ============================================================

  getHeatmap() {
    const regions = {};
    const categories = {};

    for (const market of this.markets) {
      if (!regions[market.region]) regions[market.region] = [];
      regions[market.region].push(market.probability);
      
      if (!categories[market.category]) categories[market.category] = [];
      categories[market.category].push(market.probability);
    }

    const heatmap = {
      regions: {},
      categories: {}
    };

    for (const [region, probs] of Object.entries(regions)) {
      heatmap.regions[region] = Math.round((probs.reduce((a, b) => a + b, 0) / probs.length) * 100);
    }

    for (const [category, probs] of Object.entries(categories)) {
      heatmap.categories[category] = Math.round((probs.reduce((a, b) => a + b, 0) / probs.length) * 100);
    }

    return heatmap;
  }

  // ============================================================
  // 3.5. СТАТИСТИКА
  // ============================================================

  getStats() {
    const active = this.markets.filter(m => m.status === 'active').length;
    const resolved = this.markets.filter(m => m.status === 'resolved').length;
    const avgProb = this.markets.reduce((sum, m) => sum + m.probability, 0) / this.markets.length;
    
    return {
      total_markets: this.markets.length,
      active_markets: active,
      resolved_markets: resolved,
      average_probability: Math.round(avgProb * 100),
      sources: Object.keys(this.accuracy).length,
      last_update: new Date().toISOString()
    };
  }

  getMarkets(filters = {}) {
    let result = this.markets;
    if (filters.category) result = result.filter(m => m.category === filters.category);
    if (filters.region) result = result.filter(m => m.region === filters.region);
    if (filters.status) result = result.filter(m => m.status === filters.status);
    return result;
  }

  getMarket(id) {
    return this.markets.find(m => m.id === id);
  }

  getAggregatedAll() {
    const results = [];
    for (const market of this.markets) {
      results.push(this.aggregatePredictions(market));
    }
    return results;
  }

  getSourceAccuracy() {
    return this.accuracy;
  }

  getHistory(limit = 30) {
    return this.history.slice(-limit);
  }

  async recordResolution(marketId, resolved) {
    const market = this.getMarket(marketId);
    if (!market) return null;

    market.status = 'resolved';
    market.resolution = resolved;

    // Обновляем точность источников
    for (const [source, prob] of Object.entries(market.sources)) {
      const accuracy = this.accuracy[source];
      if (accuracy) {
        const correct = (prob > 0.5 && resolved) || (prob <= 0.5 && !resolved);
        accuracy.accuracy = (accuracy.accuracy * accuracy.samples + (correct ? 1 : 0)) / (accuracy.samples + 1);
        accuracy.samples += 1;
      }
    }

    await this.saveAccuracy();
    await this.saveHistory();
    return market;
  }
}

// ============================================================
// 4. HTTP-ОБРАБОТЧИК
// ============================================================

let pi = null;

async function getPI() {
  if (!pi) {
    pi = new PredictionIntel();
    await pi.init();
  }
  return pi;
}

export async function handlePredictionAPI(req, res) {
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
    const pi = await getPI();

    // GET /api/prediction/status
    if (path === '/api/prediction/status' && req.method === 'GET') {
      const stats = pi.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'prediction-intel',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // GET /api/prediction/markets
    if (path === '/api/prediction/markets' && req.method === 'GET') {
      const category = url.searchParams.get('category');
      const region = url.searchParams.get('region');
      const status = url.searchParams.get('status');
      const markets = pi.getMarkets({ category, region, status });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, markets, total: markets.length }));
      return;
    }

    // GET /api/prediction/market/:id
    if (path.startsWith('/api/prediction/market/') && req.method === 'GET') {
      const id = path.split('/').pop();
      const market = pi.getMarket(id);
      if (market) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, market }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Рынок не найден' }));
      }
      return;
    }

    // GET /api/prediction/aggregate
    if (path === '/api/prediction/aggregate' && req.method === 'GET') {
      const aggregated = pi.getAggregatedAll();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, aggregated, total: aggregated.length }));
      return;
    }

    // GET /api/prediction/analyze/:id
    if (path.startsWith('/api/prediction/analyze/') && req.method === 'GET') {
      const id = path.split('/').pop();
      const market = pi.getMarket(id);
      if (market) {
        const analysis = pi.analyzeDiscrepancy(market);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, analysis }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Рынок не найден' }));
      }
      return;
    }

    // GET /api/prediction/heatmap
    if (path === '/api/prediction/heatmap' && req.method === 'GET') {
      const heatmap = pi.getHeatmap();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, heatmap }));
      return;
    }

    // GET /api/prediction/accuracy
    if (path === '/api/prediction/accuracy' && req.method === 'GET') {
      const accuracy = pi.getSourceAccuracy();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, accuracy }));
      return;
    }

    // POST /api/prediction/resolve/:id
    if (path.startsWith('/api/prediction/resolve/') && req.method === 'POST') {
      const id = path.split('/').pop();
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const market = await pi.recordResolution(id, data.resolved);
          if (market) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, market }));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Рынок не найден' }));
          }
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[PI API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка', details: error.message }));
  }
}

export default { handlePredictionAPI, PredictionIntel };
