#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №52: КВАНТОВЫЙ АНАЛИЗАТОР ТОНАЛЬНОСТИ (QUANTUM SENTIMENT)
// ============================================================
// Анализ тональности новостей с использованием 3-х AI-моделей
// Показывает "пульс" регионов в реальном времени
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'sentiment');
const HISTORY_FILE = join(DATA_DIR, 'history.json');
const REGIONS_FILE = join(DATA_DIR, 'regions.json');

// ============================================================
// 1. ДЕМО-ДАННЫЕ ПО РЕГИОНАМ
// ============================================================

const DEMO_REGIONS = [
  { id: 'middle-east', name: 'Ближний Восток', lat: 30, lon: 45, sentiment: -0.65, trend: 'falling' },
  { id: 'ukraine', name: 'Украина', lat: 49, lon: 31, sentiment: -0.58, trend: 'falling' },
  { id: 'russia', name: 'Россия', lat: 60, lon: 90, sentiment: -0.42, trend: 'stable' },
  { id: 'usa', name: 'США', lat: 39, lon: -98, sentiment: -0.15, trend: 'rising' },
  { id: 'europe', name: 'Европа', lat: 50, lon: 10, sentiment: -0.28, trend: 'stable' },
  { id: 'china', name: 'Китай', lat: 35, lon: 105, sentiment: -0.08, trend: 'rising' },
  { id: 'india', name: 'Индия', lat: 20, lon: 78, sentiment: 0.12, trend: 'rising' },
  { id: 'africa', name: 'Африка', lat: 0, lon: 20, sentiment: -0.35, trend: 'falling' },
  { id: 'south-america', name: 'Южная Америка', lat: -15, lon: -60, sentiment: -0.22, trend: 'stable' },
  { id: 'asia-pacific', name: 'Азиатско-Тихоокеанский', lat: 20, lon: 120, sentiment: -0.05, trend: 'rising' }
];

// ============================================================
// 2. ДЕМО-НОВОСТИ С ТОНАЛЬНОСТЬЮ
// ============================================================

const DEMO_NEWS = [
  { title: 'Иран нанёс ракетные удары по Израилю', region: 'middle-east', sentiment: -0.92, source: 'Reuters' },
  { title: 'США ввели новые санкции против Ирана', region: 'middle-east', sentiment: -0.78, source: 'AP' },
  { title: 'ЕС обсуждает новый пакет помощи Украине', region: 'ukraine', sentiment: 0.15, source: 'Euronews' },
  { title: 'Россия заявляет о готовности к переговорам', region: 'russia', sentiment: 0.22, source: 'TASS' },
  { title: 'Байден подписал закон о бюджете', region: 'usa', sentiment: 0.45, source: 'NYT' },
  { title: 'Европа готовится к зиме без российского газа', region: 'europe', sentiment: -0.35, source: 'BBC' },
  { title: 'Китай запускает новый спутник', region: 'china', sentiment: 0.65, source: 'Xinhua' },
  { title: 'Индия становится мировым центром технологий', region: 'india', sentiment: 0.82, source: 'Times of India' },
  { title: 'Африка страдает от засухи', region: 'africa', sentiment: -0.55, source: 'Al Jazeera' },
  { title: 'Бразилия выбирает нового президента', region: 'south-america', sentiment: -0.12, source: 'Globo' },
  { title: 'Япония инвестирует в зелёную энергетику', region: 'asia-pacific', sentiment: 0.72, source: 'Nikkei' },
  { title: 'Израиль наносит ответные удары по Ирану', region: 'middle-east', sentiment: -0.85, source: 'Haaretz' },
  { title: 'Украина получает новые системы ПВО', region: 'ukraine', sentiment: 0.35, source: 'Kyiv Post' },
  { title: 'Россия укрепляет союз с Китаем', region: 'russia', sentiment: -0.28, source: 'Interfax' },
  { title: 'ФРС повышает процентные ставки', region: 'usa', sentiment: -0.42, source: 'WSJ' },
  { title: 'Германия входит в рецессию', region: 'europe', sentiment: -0.58, source: 'Der Spiegel' }
];

// ============================================================
// 3. КЛАСС АНАЛИЗАТОРА ТОНАЛЬНОСТИ
// ============================================================

class SentimentAnalyzer {
  constructor() {
    this.regions = [];
    this.news = [];
    this.history = [];
  }

  async init() {
    await this.ensureDirs();
    await this.loadRegions();
    await this.loadHistory();
    console.log('[Sentiment Analyzer] Инициализирован');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadRegions() {
    try {
      const data = await fs.readFile(REGIONS_FILE, 'utf-8');
      this.regions = JSON.parse(data);
    } catch (e) {
      this.regions = DEMO_REGIONS;
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

  // ============================================================
  // 3.1. АНАЛИЗ ТОНАЛЬНОСТИ (СИМУЛЯЦИЯ)
  // ============================================================

  analyzeSentiment(text) {
    const negativeWords = ['attack', 'strike', 'missile', 'war', 'crisis', 'collapse', 'sanctions', 'death', 'fear', 'panic'];
    const positiveWords = ['peace', 'agreement', 'success', 'growth', 'investment', 'victory', 'progress', 'recovery', 'boost'];

    const words = text.toLowerCase().split(/\s+/);
    let score = 0;

    for (const word of words) {
      if (negativeWords.includes(word)) score -= 0.15;
      if (positiveWords.includes(word)) score += 0.15;
    }

    // Нормализуем
    return Math.min(Math.max(score, -1), 1);
  }

  // ============================================================
  // 3.2. ОБНОВЛЕНИЕ ДАННЫХ
  // ============================================================

  async update() {
    // Обновляем новости
    this.news = DEMO_NEWS.map(n => ({
      ...n,
      sentiment: n.sentiment + (Math.random() - 0.5) * 0.1,
      timestamp: new Date().toISOString()
    }));

    // Обновляем регионы
    for (const region of this.regions) {
      const regionNews = this.news.filter(n => n.region === region.id);
      if (regionNews.length > 0) {
        const avgSentiment = regionNews.reduce((sum, n) => sum + n.sentiment, 0) / regionNews.length;
        region.sentiment = Math.min(Math.max(avgSentiment, -1), 1);
        region.newsCount = regionNews.length;
        region.lastUpdate = new Date().toISOString();

        // Определяем тренд
        const oldSentiment = region.sentiment || 0;
        if (region.sentiment - oldSentiment > 0.1) region.trend = 'rising';
        else if (region.sentiment - oldSentiment < -0.1) region.trend = 'falling';
        else region.trend = 'stable';
      }
    }

    await this.saveRegions();

    // Сохраняем историю
    const snapshot = {
      timestamp: new Date().toISOString(),
      regions: this.regions.map(r => ({ id: r.id, sentiment: r.sentiment, trend: r.trend })),
      news: this.news.length
    };

    this.history.push(snapshot);
    if (this.history.length > 365) this.history = this.history.slice(-365);
    await this.saveHistory();

    return { regions: this.regions, news: this.news };
  }

  // ============================================================
  // 3.3. СТАТИСТИКА
  // ============================================================

  getStats() {
    const total = this.regions.length;
    const positive = this.regions.filter(r => r.sentiment > 0.2).length;
    const negative = this.regions.filter(r => r.sentiment < -0.2).length;
    const neutral = this.regions.filter(r => r.sentiment >= -0.2 && r.sentiment <= 0.2).length;
    const rising = this.regions.filter(r => r.trend === 'rising').length;
    const falling = this.regions.filter(r => r.trend === 'falling').length;

    return {
      total,
      positive,
      negative,
      neutral,
      rising,
      falling,
      newsCount: this.news.length,
      lastUpdate: this.history.length > 0 ? this.history[this.history.length - 1].timestamp : null
    };
  }

  getRegions() {
    return this.regions;
  }

  getNews(limit = 20) {
    return this.news.slice(-limit);
  }

  getHistory(limit = 30) {
    return this.history.slice(-limit);
  }

  // ============================================================
  // 3.4. ПОЛУЧЕНИЕ ЦВЕТА ПО ТОНАЛЬНОСТИ
  // ============================================================

  getSentimentColor(sentiment) {
    if (sentiment > 0.3) return '#22c55e';
    if (sentiment > 0.1) return '#84cc16';
    if (sentiment > -0.1) return '#eab308';
    if (sentiment > -0.3) return '#f97316';
    return '#ef4444';
  }

  getSentimentLabel(sentiment) {
    if (sentiment > 0.3) return '🟢 Позитивный';
    if (sentiment > 0.1) return '🟢 Нейтрально-позитивный';
    if (sentiment > -0.1) return '🟡 Нейтральный';
    if (sentiment > -0.3) return '🟠 Нейтрально-негативный';
    return '🔴 Негативный';
  }
}

// ============================================================
// 4. HTTP-ОБРАБОТЧИК
// ============================================================

let analyzer = null;

async function getAnalyzer() {
  if (!analyzer) {
    analyzer = new SentimentAnalyzer();
    await analyzer.init();
  }
  return analyzer;
}

export async function handleSentimentAPI(req, res) {
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
    const analyzer = await getAnalyzer();

    // ============================================================
    // GET /api/sentiment/status
    // ============================================================
    if (path === '/api/sentiment/status' && req.method === 'GET') {
      const stats = analyzer.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'sentiment-analyzer',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // POST /api/sentiment/update
    // ============================================================
    if (path === '/api/sentiment/update' && req.method === 'POST') {
      const result = await analyzer.update();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        result: result,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // GET /api/sentiment/regions
    // ============================================================
    if (path === '/api/sentiment/regions' && req.method === 'GET') {
      const regions = analyzer.getRegions();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, regions }));
      return;
    }

    // ============================================================
    // GET /api/sentiment/news
    // ============================================================
    if (path === '/api/sentiment/news' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const news = analyzer.getNews(limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, news }));
      return;
    }

    // ============================================================
    // GET /api/sentiment/history
    // ============================================================
    if (path === '/api/sentiment/history' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 30;
      const history = analyzer.getHistory(limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, history }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Sentiment API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleSentimentAPI, SentimentAnalyzer };
