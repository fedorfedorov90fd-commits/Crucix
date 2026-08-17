#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №50: ПРОГНОЗИРОВАНИЕ РЫНОЧНЫХ РЕАКЦИЙ (MARKET PREDICTOR)
// ============================================================
// Сопоставляет геополитические события с рыночными данными
// Прогнозирует реакцию рынка на события
// Версия: 1.1 (с автосбором событий)
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'market');
const HISTORY_FILE = join(DATA_DIR, 'history.json');
const PREDICTIONS_FILE = join(DATA_DIR, 'predictions.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ АКТИВОВ
// ============================================================

const ASSETS = {
  oil_wti: { name: 'WTI Crude', symbol: 'CL=F', type: 'commodity', color: '#f97316' },
  oil_brent: { name: 'Brent Crude', symbol: 'BZ=F', type: 'commodity', color: '#ef4444' },
  gold: { name: 'Gold', symbol: 'GC=F', type: 'commodity', color: '#eab308' },
  silver: { name: 'Silver', symbol: 'SI=F', type: 'commodity', color: '#94a3b8' },
  sp500: { name: 'S&P 500', symbol: '^GSPC', type: 'index', color: '#22c55e' },
  nasdaq: { name: 'Nasdaq', symbol: '^IXIC', type: 'index', color: '#3b82f6' },
  bitcoin: { name: 'Bitcoin', symbol: 'BTC-USD', type: 'crypto', color: '#f59e0b' },
  eth: { name: 'Ethereum', symbol: 'ETH-USD', type: 'crypto', color: '#8b5cf6' }
};

// ============================================================
// 2. ИСТОРИЧЕСКИЕ ПАТТЕРНЫ
// ============================================================

const HISTORICAL_PATTERNS = [
  {
    id: 'middle-east-escalation',
    name: 'Эскалация на Ближнем Востоке',
    triggers: ['iran', 'israel', 'strike', 'missile', 'gaza', 'hezbollah', 'tehran', 'tel aviv'],
    effects: {
      oil_wti: { change: 5.2, confidence: 85, direction: 'up' },
      oil_brent: { change: 4.8, confidence: 83, direction: 'up' },
      gold: { change: 2.1, confidence: 72, direction: 'up' },
      sp500: { change: -1.8, confidence: 68, direction: 'down' },
      bitcoin: { change: 3.5, confidence: 60, direction: 'up' }
    }
  },
  {
    id: 'ukraine-conflict',
    name: 'Эскалация в Украине',
    triggers: ['ukraine', 'russia', 'kyiv', 'donbas', 'zaporizhzhia', 'kherson', 'crimea'],
    effects: {
      oil_wti: { change: 3.8, confidence: 78, direction: 'up' },
      oil_brent: { change: 3.5, confidence: 76, direction: 'up' },
      gold: { change: 1.5, confidence: 65, direction: 'up' },
      sp500: { change: -1.2, confidence: 62, direction: 'down' },
      bitcoin: { change: 2.8, confidence: 55, direction: 'up' }
    }
  },
  {
    id: 'us-sanctions',
    name: 'Введение санкций США',
    triggers: ['sanctions', 'treasury', 'ofac', 'block', 'ban', 'export control'],
    effects: {
      oil_wti: { change: 2.5, confidence: 70, direction: 'up' },
      gold: { change: 1.8, confidence: 68, direction: 'up' },
      sp500: { change: -0.8, confidence: 60, direction: 'down' },
      bitcoin: { change: 4.2, confidence: 75, direction: 'up' }
    }
  },
  {
    id: 'interest-rate-hike',
    name: 'Повышение ставок ФРС',
    triggers: ['fed', 'interest', 'rate', 'hike', 'powell', 'inflation', 'fomc'],
    effects: {
      sp500: { change: -2.5, confidence: 82, direction: 'down' },
      nasdaq: { change: -3.2, confidence: 80, direction: 'down' },
      gold: { change: -1.5, confidence: 70, direction: 'down' },
      bitcoin: { change: -4.8, confidence: 75, direction: 'down' }
    }
  },
  {
    id: 'earthquake-disaster',
    name: 'Крупное землетрясение',
    triggers: ['earthquake', 'magnitude', 'tsunami', 'destroy', 'damage', 'aftershock'],
    effects: {
      oil_wti: { change: 4.5, confidence: 65, direction: 'up' },
      gold: { change: 3.2, confidence: 72, direction: 'up' },
      sp500: { change: -2.1, confidence: 60, direction: 'down' }
    }
  },
  {
    id: 'peace-talks',
    name: 'Мирные переговоры',
    triggers: ['peace', 'ceasefire', 'negotiation', 'talks', 'agreement', 'truce'],
    effects: {
      oil_wti: { change: -3.5, confidence: 70, direction: 'down' },
      gold: { change: -1.8, confidence: 65, direction: 'down' },
      sp500: { change: 2.2, confidence: 72, direction: 'up' }
    }
  },
  {
    id: 'energy-crisis',
    name: 'Энергетический кризис',
    triggers: ['energy', 'oil', 'gas', 'shortage', 'blackout', 'power', 'grid'],
    effects: {
      oil_wti: { change: 6.8, confidence: 80, direction: 'up' },
      oil_brent: { change: 6.2, confidence: 78, direction: 'up' },
      gold: { change: 3.5, confidence: 70, direction: 'up' },
      sp500: { change: -2.8, confidence: 65, direction: 'down' }
    }
  }
];

// ============================================================
// 3. КЛАСС ПРОГНОЗИРОВАНИЯ
// ============================================================

class MarketPredictor {
  constructor() {
    this.history = [];
    this.predictions = [];
  }

  async init() {
    await this.ensureDirs();
    await this.loadHistory();
    await this.loadPredictions();
    console.log('[Market Predictor] Инициализирован');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
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

  async loadPredictions() {
    try {
      const data = await fs.readFile(PREDICTIONS_FILE, 'utf-8');
      this.predictions = JSON.parse(data);
    } catch (e) {
      this.predictions = [];
    }
  }

  async savePredictions() {
    await fs.writeFile(PREDICTIONS_FILE, JSON.stringify(this.predictions, null, 2));
  }

  // ============================================================
  // 3.1. СБОР СОБЫТИЙ ИЗ РАЗНЫХ ИСТОЧНИКОВ
  // ============================================================

  async collectEvents() {
    const events = [];

    // 1. Из корзины данных (basket)
    try {
      const basketDir = join(ROOT, 'data', 'basket');
      const files = await fs.readdir(basketDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(join(basketDir, file), 'utf-8');
          const items = JSON.parse(data);
          for (const item of items) {
            events.push({
              title: item.title || '',
              description: item.description || '',
              date: item.date || item.addedAt || new Date().toISOString()
            });
          }
        }
      }
    } catch (e) {}

    // 2. Из RSS (сырые данные)
    try {
      const rawDir = join(ROOT, 'data', 'raw');
      const files = await fs.readdir(rawDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(join(rawDir, file), 'utf-8');
          const items = JSON.parse(data);
          for (const item of items) {
            events.push({
              title: item.title || '',
              description: item.description || '',
              date: item.date || new Date().toISOString()
            });
          }
        }
      }
    } catch (e) {}

    // 3. Из истории индекса
    try {
      const historyFile = join(ROOT, 'data', 'geo', 'index-history.json');
      const data = await fs.readFile(historyFile, 'utf-8');
      const history = JSON.parse(data);
      for (const item of history) {
        events.push({
          title: `Индекс напряжённости: ${item.value}`,
          description: `Значение индекса: ${item.value}`,
          date: item.date || new Date().toISOString()
        });
      }
    } catch (e) {}

    return events;
  }

  // ============================================================
  // 3.2. АНАЛИЗ СОБЫТИЙ
  // ============================================================

  analyzeEvents(events) {
    const triggeredPatterns = [];

    for (const pattern of HISTORICAL_PATTERNS) {
      let score = 0;
      let matchedTriggers = [];

      for (const trigger of pattern.triggers) {
        for (const event of events) {
          const text = (event.title + ' ' + event.description).toLowerCase();
          if (text.includes(trigger)) {
            score++;
            if (!matchedTriggers.includes(trigger)) {
              matchedTriggers.push(trigger);
            }
            break;
          }
        }
      }

      if (score > 0) {
        triggeredPatterns.push({
          pattern: pattern,
          score: score,
          matchedTriggers: matchedTriggers,
          confidence: Math.min(Math.round((score / pattern.triggers.length) * 100), 95)
        });
      }
    }

    return triggeredPatterns;
  }

  // ============================================================
  // 3.3. ГЕНЕРАЦИЯ ПРОГНОЗОВ
  // ============================================================

  generatePredictions(triggeredPatterns) {
    const predictions = {};
    const assetEffects = {};

    for (const asset of Object.keys(ASSETS)) {
      assetEffects[asset] = { changes: [], confidences: [], directions: [] };
    }

    for (const item of triggeredPatterns) {
      const pattern = item.pattern;
      const confidence = item.confidence;

      for (const [asset, effect] of Object.entries(pattern.effects)) {
        if (assetEffects[asset]) {
          const weightedChange = effect.change * (confidence / 100);
          assetEffects[asset].changes.push(weightedChange);
          assetEffects[asset].confidences.push(confidence);
          assetEffects[asset].directions.push(effect.direction);
        }
      }
    }

    for (const [asset, data] of Object.entries(assetEffects)) {
      if (data.changes.length > 0) {
        const avgChange = data.changes.reduce((a, b) => a + b, 0) / data.changes.length;
        const avgConfidence = data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length;
        const direction = data.directions.filter(d => d === 'up').length > data.directions.filter(d => d === 'down').length ? 'up' : 'down';

        predictions[asset] = {
          asset: asset,
          name: ASSETS[asset]?.name || asset,
          symbol: ASSETS[asset]?.symbol || asset,
          type: ASSETS[asset]?.type || 'unknown',
          change: avgChange,
          direction: direction,
          confidence: Math.round(avgConfidence),
          color: ASSETS[asset]?.color || '#6b7280'
        };
      }
    }

    return predictions;
  }

  // ============================================================
  // 3.4. ДЕМО-ЦЕНЫ
  // ============================================================

  getCurrentPrices() {
    return {
      oil_wti: 112.06,
      oil_brent: 109.05,
      gold: 2150.00,
      silver: 28.50,
      sp500: 6582.69,
      nasdaq: 21879.18,
      bitcoin: 66895.18,
      eth: 2052.04
    };
  }

  // ============================================================
  // 3.5. ГЕНЕРАЦИЯ ПРОГНОЗА
  // ============================================================

  async predict(events = null) {
    // Если события не переданы — собираем сами
    if (!events || events.length === 0) {
      console.log('[Market Predictor] Сбор событий...');
      events = await this.collectEvents();
    }

    console.log(`[Market Predictor] Анализ ${events.length} событий...`);

    // Анализируем события
    const triggered = this.analyzeEvents(events);

    // Генерируем прогнозы
    const predictions = this.generatePredictions(triggered);

    // Получаем текущие цены
    const prices = this.getCurrentPrices();

    // Формируем результат
    const result = {
      timestamp: new Date().toISOString(),
      eventsAnalyzed: events.length,
      patternsTriggered: triggered.length,
      triggeredPatterns: triggered.map(t => ({
        name: t.pattern.name,
        score: t.score,
        confidence: t.confidence,
        triggers: t.matchedTriggers.slice(0, 5)
      })),
      predictions: predictions,
      currentPrices: prices,
      summary: this.generateSummary(predictions)
    };

    // Сохраняем в историю
    this.history.push(result);
    if (this.history.length > 100) this.history = this.history.slice(-100);
    await this.saveHistory();

    return result;
  }

  // ============================================================
  // 3.6. ГЕНЕРАЦИЯ РЕЗЮМЕ
  // ============================================================

  generateSummary(predictions) {
    const up = [];
    const down = [];

    for (const [key, pred] of Object.entries(predictions)) {
      if (pred.direction === 'up') {
        up.push(`${pred.name} +${pred.change.toFixed(1)}%`);
      } else {
        down.push(`${pred.name} ${pred.change.toFixed(1)}%`);
      }
    }

    let summary = '';
    if (up.length > 0) {
      summary += `📈 Рост: ${up.join(', ')}. `;
    }
    if (down.length > 0) {
      summary += `📉 Падение: ${down.join(', ')}. `;
    }
    if (up.length === 0 && down.length === 0) {
      summary = '📊 Значительных рыночных сигналов не обнаружено.';
    }

    return summary;
  }

  // ============================================================
  // 3.7. СТАТИСТИКА
  // ============================================================

  getStats() {
    return {
      totalPredictions: this.history.length,
      lastUpdate: this.history.length > 0 ? this.history[this.history.length - 1].timestamp : null,
      assets: Object.keys(ASSETS).length
    };
  }

  getLatest() {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }
}

// ============================================================
// 4. HTTP-ОБРАБОТЧИК
// ============================================================

let predictor = null;

async function getPredictor() {
  if (!predictor) {
    predictor = new MarketPredictor();
    await predictor.init();
  }
  return predictor;
}

export async function handleMarketPredictorAPI(req, res) {
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
    const predictor = await getPredictor();

    // ============================================================
    // GET /api/market/status
    // ============================================================
    if (path === '/api/market/status' && req.method === 'GET') {
      const stats = predictor.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'market-predictor',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // POST /api/market/predict
    // ============================================================
    if (path === '/api/market/predict' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const events = data.events || null;

          const result = await predictor.predict(events);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, result }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // ============================================================
    // GET /api/market/latest
    // ============================================================
    if (path === '/api/market/latest' && req.method === 'GET') {
      const latest = predictor.getLatest();
      if (latest) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, result: latest }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Прогнозов пока нет' }));
      }
      return;
    }

    // ============================================================
    // GET /api/market/history
    // ============================================================
    if (path === '/api/market/history' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 10;
      const history = predictor.history.slice(-limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, history }));
      return;
    }

    // ============================================================
    // GET /api/market/assets
    // ============================================================
    if (path === '/api/market/assets' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, assets: ASSETS }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Market Predictor API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleMarketPredictorAPI, MarketPredictor };
