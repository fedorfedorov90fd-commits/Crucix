#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №61: АНАЛИЗ СОЦИАЛЬНЫХ СЕТЕЙ (SOCIAL MEDIA INTELLIGENCE)
// ============================================================
// Мониторинг социальных сетей (Twitter/X, Telegram, Reddit)
// Анализ тональности и трендов
// Детекция информационных кампаний
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'social');
const POSTS_FILE = join(DATA_DIR, 'posts.json');
const TRENDS_FILE = join(DATA_DIR, 'trends.json');
const CAMPAIGNS_FILE = join(DATA_DIR, 'campaigns.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ ИСТОЧНИКОВ
// ============================================================

const SOURCES = {
  twitter: { name: 'Twitter/X', icon: '🐦', enabled: true, weight: 1.0 },
  telegram: { name: 'Telegram', icon: '📱', enabled: true, weight: 0.9 },
  reddit: { name: 'Reddit', icon: '🤖', enabled: true, weight: 0.8 },
  discord: { name: 'Discord', icon: '🎮', enabled: false, weight: 0.6 },
  facebook: { name: 'Facebook', icon: '📘', enabled: false, weight: 0.5 }
};

// ============================================================
// 2. ДЕМО-ДАННЫЕ ПОСТОВ
// ============================================================

const DEMO_POSTS = [
  {
    id: 'post-001',
    source: 'twitter',
    author: '@geopolitical_analyst',
    content: 'Новые спутниковые снимки показывают перемещение военной техники на границе. Это может указывать на подготовку к крупным учениям.',
    timestamp: null,
    sentiment: 'negative',
    sentiment_score: 0.75,
    keywords: ['военная техника', 'граница', 'учения'],
    region: 'europe',
    relevance: 0.9,
    engagement: 3420
  },
  {
    id: 'post-002',
    source: 'telegram',
    author: 'Военный обозреватель',
    content: 'Эксперты отмечают рост напряжённости в регионе. Ожидается, что ситуация может обостриться в ближайшие дни.',
    timestamp: null,
    sentiment: 'negative',
    sentiment_score: 0.65,
    keywords: ['напряжённость', 'регион', 'обострение'],
    region: 'middle-east',
    relevance: 0.85,
    engagement: 1200
  },
  {
    id: 'post-003',
    source: 'reddit',
    author: 'r/geopolitics',
    content: 'Анализ последних заявлений лидеров стран G20 показывает изменение политического курса. Возможны новые санкции.',
    timestamp: null,
    sentiment: 'neutral',
    sentiment_score: 0.40,
    keywords: ['G20', 'санкции', 'политический курс'],
    region: 'global',
    relevance: 0.7,
    engagement: 890
  },
  {
    id: 'post-004',
    source: 'twitter',
    author: '@economic_forecast',
    content: 'Инфляция в США достигла новых максимумов. Рынки ожидают жёстких решений от ФРС. Это может привести к рецессии.',
    timestamp: null,
    sentiment: 'negative',
    sentiment_score: 0.80,
    keywords: ['инфляция', 'ФРС', 'рецессия'],
    region: 'us',
    relevance: 0.85,
    engagement: 5600
  },
  {
    id: 'post-005',
    source: 'telegram',
    author: 'Финансовый аналитик',
    content: 'Курс нефти продолжает рост на фоне геополитической нестабильности. Ожидается, что цены превысят $100 за баррель.',
    timestamp: null,
    sentiment: 'neutral',
    sentiment_score: 0.30,
    keywords: ['нефть', 'цены', 'нестабильность'],
    region: 'global',
    relevance: 0.75,
    engagement: 980
  },
  {
    id: 'post-006',
    source: 'reddit',
    author: 'r/worldnews',
    content: 'Сообщается о кибератаке на правительственные сети. Эксперты связывают это с активизацией хакерских групп.',
    timestamp: null,
    sentiment: 'negative',
    sentiment_score: 0.70,
    keywords: ['кибератака', 'правительство', 'хакеры'],
    region: 'global',
    relevance: 0.8,
    engagement: 2100
  },
  {
    id: 'post-007',
    source: 'twitter',
    author: '@climate_alert',
    content: 'Новые данные показывают ускорение таяния ледников в Арктике. Темпы превышают все предыдущие прогнозы.',
    timestamp: null,
    sentiment: 'negative',
    sentiment_score: 0.85,
    keywords: ['арктика', 'ледники', 'таяние'],
    region: 'global',
    relevance: 0.7,
    engagement: 3400
  },
  {
    id: 'post-008',
    source: 'telegram',
    author: 'Политический обозреватель',
    content: 'В Европе обсуждают новый пакет санкций. Ожидается, что он будет включать ограничения на импорт энергоносителей.',
    timestamp: null,
    sentiment: 'negative',
    sentiment_score: 0.60,
    keywords: ['санкции', 'европа', 'энергоносители'],
    region: 'europe',
    relevance: 0.8,
    engagement: 750
  },
  {
    id: 'post-009',
    source: 'reddit',
    author: 'r/technology',
    content: 'Прорыв в квантовых вычислениях: учёные создали первый стабильный кубит. Это открывает новые возможности для криптографии.',
    timestamp: null,
    sentiment: 'positive',
    sentiment_score: 0.15,
    keywords: ['квантовые вычисления', 'кубит', 'криптография'],
    region: 'global',
    relevance: 0.5,
    engagement: 4500
  },
  {
    id: 'post-010',
    source: 'twitter',
    author: '@military_update',
    content: 'В Тихом океане начались масштабные военно-морские учения. Участвуют корабли из 6 стран, включая США и Японию.',
    timestamp: null,
    sentiment: 'negative',
    sentiment_score: 0.55,
    keywords: ['учения', 'тихий океан', 'военно-морские'],
    region: 'asia-pacific',
    relevance: 0.85,
    engagement: 1800
  }
];

// ============================================================
// 3. КЛАСС АНАЛИЗА СОЦСЕТЕЙ
// ============================================================

class SocialIntelligence {
  constructor() {
    this.posts = [];
    this.trends = [];
    this.campaigns = [];
    this.sources = SOURCES;
  }

  async init() {
    await this.ensureDirs();
    await this.loadPosts();
    await this.loadTrends();
    await this.loadCampaigns();
    console.log('[Social] Система анализа соцсетей инициализирована');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadPosts() {
    try {
      const data = await fs.readFile(POSTS_FILE, 'utf-8');
      this.posts = JSON.parse(data);
    } catch (e) {
      this.posts = DEMO_POSTS.map(p => ({
        ...p,
        timestamp: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString()
      }));
      await this.savePosts();
    }
  }

  async savePosts() {
    await fs.writeFile(POSTS_FILE, JSON.stringify(this.posts, null, 2));
  }

  async loadTrends() {
    try {
      const data = await fs.readFile(TRENDS_FILE, 'utf-8');
      this.trends = JSON.parse(data);
    } catch (e) {
      this.trends = this.generateTrends();
      await this.saveTrends();
    }
  }

  async saveTrends() {
    await fs.writeFile(TRENDS_FILE, JSON.stringify(this.trends, null, 2));
  }

  async loadCampaigns() {
    try {
      const data = await fs.readFile(CAMPAIGNS_FILE, 'utf-8');
      this.campaigns = JSON.parse(data);
    } catch (e) {
      this.campaigns = this.detectCampaigns();
      await this.saveCampaigns();
    }
  }

  async saveCampaigns() {
    await fs.writeFile(CAMPAIGNS_FILE, JSON.stringify(this.campaigns, null, 2));
  }

  // ============================================================
  // 3.1. ГЕНЕРАЦИЯ ТРЕНДОВ
  // ============================================================

  generateTrends() {
    const topics = [
      'Военная активность', 'Экономический кризис', 'Политические изменения',
      'Климатические изменения', 'Технологический прорыв', 'Кибератаки',
      'Санкции', 'Энергетический кризис', 'Международные отношения',
      'Инфляция', 'Выборы', 'Протесты'
    ];
    
    const trends = [];
    for (let i = 0; i < 6; i++) {
      const topic = topics[Math.floor(Math.random() * topics.length)];
      const volume = 50 + Math.floor(Math.random() * 450);
      const sentiment = 0.2 + Math.random() * 0.6;
      trends.push({
        id: `trend-${i+1}`,
        topic: topic,
        volume: volume,
        sentiment: Math.round(sentiment * 100),
        direction: Math.random() > 0.5 ? 'up' : 'down',
        change: Math.round((Math.random() - 0.3) * 50),
        sources: Object.keys(SOURCES).slice(0, 2 + Math.floor(Math.random() * 2)),
        timestamp: new Date().toISOString()
      });
    }
    return trends;
  }

  // ============================================================
  // 3.2. ДЕТЕКЦИЯ ИНФОРМАЦИОННЫХ КАМПАНИЙ
  // ============================================================

  detectCampaigns() {
    const campaigns = [];
    const patterns = [
      { name: 'Энергетический кризис', keywords: ['энергия', 'нефть', 'газ', 'цена'], severity: 'high' },
      { name: 'Военная угроза', keywords: ['военный', 'армия', 'удар', 'конфликт'], severity: 'critical' },
      { name: 'Экономический спад', keywords: ['кризис', 'инфляция', 'рецессия', 'безработица'], severity: 'high' },
      { name: 'Климатическая катастрофа', keywords: ['климат', 'катастрофа', 'таяние', 'засуха'], severity: 'medium' }
    ];

    for (const pattern of patterns) {
      const posts = this.posts.filter(p => 
        pattern.keywords.some(k => p.content.toLowerCase().includes(k))
      );
      if (posts.length > 2) {
        campaigns.push({
          id: `campaign-${campaigns.length + 1}`,
          name: pattern.name,
          severity: pattern.severity,
          posts: posts.length,
          sources: [...new Set(posts.map(p => p.source))],
          avg_sentiment: Math.round(posts.reduce((sum, p) => sum + p.sentiment_score, 0) / posts.length * 100),
          timestamp: new Date().toISOString()
        });
      }
    }
    return campaigns;
  }

  // ============================================================
  // 3.3. АНАЛИЗ ПО РЕГИОНАМ
  // ============================================================

  getRegionalAnalysis() {
    const regions = {};
    for (const post of this.posts) {
      if (!regions[post.region]) {
        regions[post.region] = { posts: 0, sentiment: 0, relevance: 0, engagement: 0 };
      }
      regions[post.region].posts += 1;
      regions[post.region].sentiment += post.sentiment_score;
      regions[post.region].relevance += post.relevance;
      regions[post.region].engagement += post.engagement;
    }
    for (const region of Object.keys(regions)) {
      const r = regions[region];
      r.sentiment = Math.round(r.sentiment / r.posts * 100);
      r.relevance = Math.round(r.relevance / r.posts * 100);
      r.avg_engagement = Math.round(r.engagement / r.posts);
    }
    return regions;
  }

  // ============================================================
  // 3.4. СТАТИСТИКА
  // ============================================================

  getStats() {
    const bySource = {};
    const bySentiment = { positive: 0, neutral: 0, negative: 0 };
    
    for (const post of this.posts) {
      if (!bySource[post.source]) bySource[post.source] = 0;
      bySource[post.source] += 1;
      if (post.sentiment) bySentiment[post.sentiment] = (bySentiment[post.sentiment] || 0) + 1;
    }

    return {
      total_posts: this.posts.length,
      sources: this.sources,
      by_source: bySource,
      by_sentiment: bySentiment,
      trends: this.trends.length,
      campaigns: this.campaigns.length,
      regions: Object.keys(this.getRegionalAnalysis()).length,
      avg_sentiment: Math.round(this.posts.reduce((sum, p) => sum + p.sentiment_score, 0) / this.posts.length * 100)
    };
  }

  getPosts(filters = {}) {
    let result = this.posts;
    if (filters.source) result = result.filter(p => p.source === filters.source);
    if (filters.region) result = result.filter(p => p.region === filters.region);
    if (filters.sentiment) result = result.filter(p => p.sentiment === filters.sentiment);
    if (filters.keyword) {
      result = result.filter(p => p.content.toLowerCase().includes(filters.keyword.toLowerCase()));
    }
    if (filters.limit) result = result.slice(0, filters.limit);
    return result;
  }

  getTrends() {
    return this.trends;
  }

  getCampaigns() {
    return this.campaigns;
  }

  getSources() {
    return this.sources;
  }

  async addPost(post) {
    const newPost = {
      id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      source: post.source || 'twitter',
      author: post.author || 'anonymous',
      content: post.content || '',
      timestamp: new Date().toISOString(),
      sentiment: post.sentiment || 'neutral',
      sentiment_score: post.sentiment_score || 0.5,
      keywords: post.keywords || [],
      region: post.region || 'global',
      relevance: post.relevance || 0.5,
      engagement: post.engagement || 0
    };
    this.posts.push(newPost);
    if (this.posts.length > 200) this.posts = this.posts.slice(-200);
    await this.savePosts();
    return newPost;
  }
}

// ============================================================
// 4. HTTP-ОБРАБОТЧИК
// ============================================================

let social = null;

async function getSocial() {
  if (!social) {
    social = new SocialIntelligence();
    await social.init();
  }
  return social;
}

export async function handleSocialAPI(req, res) {
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
    const social = await getSocial();

    // GET /api/social/status
    if (path === '/api/social/status' && req.method === 'GET') {
      const stats = social.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'social',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // GET /api/social/posts
    if (path === '/api/social/posts' && req.method === 'GET') {
      const source = url.searchParams.get('source');
      const region = url.searchParams.get('region');
      const sentiment = url.searchParams.get('sentiment');
      const keyword = url.searchParams.get('keyword');
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const posts = social.getPosts({ source, region, sentiment, keyword, limit });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, posts, total: posts.length }));
      return;
    }

    // POST /api/social/posts
    if (path === '/api/social/posts' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const post = await social.addPost(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, post }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // GET /api/social/trends
    if (path === '/api/social/trends' && req.method === 'GET') {
      const trends = social.getTrends();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, trends }));
      return;
    }

    // GET /api/social/campaigns
    if (path === '/api/social/campaigns' && req.method === 'GET') {
      const campaigns = social.getCampaigns();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, campaigns }));
      return;
    }

    // GET /api/social/regions
    if (path === '/api/social/regions' && req.method === 'GET') {
      const regions = social.getRegionalAnalysis();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, regions }));
      return;
    }

    // GET /api/social/sources
    if (path === '/api/social/sources' && req.method === 'GET') {
      const sources = social.getSources();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, sources }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Social API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка', details: error.message }));
  }
}

export default { handleSocialAPI, SocialIntelligence };
