#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №30: СЕМАНТИЧЕСКИЙ АНАЛИЗ
// ============================================================
// Глубинный смысловой анализ текстов с помощью LLM
// Извлечение сущностей, тональности, ключевых тем
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'semantic');
const HISTORY_FILE = join(DATA_DIR, 'history.json');
const ANALYSIS_FILE = join(DATA_DIR, 'analysis.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const SENTIMENT_LABELS = {
  positive: { label: 'Позитивная', color: '#22c55e', icon: '😊' },
  negative: { label: 'Негативная', color: '#ef4444', icon: '😠' },
  neutral: { label: 'Нейтральная', color: '#6b7280', icon: '😐' },
  mixed: { label: 'Смешанная', color: '#f59e0b', icon: '🤔' }
};

// ============================================================
// 2. КЛАСС СЕМАНТИЧЕСКОГО АНАЛИЗА
// ============================================================

class SemanticAnalyzer {
  constructor() {
    this.history = [];
    this.analysis = [];
  }

  async init() {
    await this.ensureDirs();
    await this.loadHistory();
    await this.loadAnalysis();
    console.log('[Semantic Analyzer] Инициализирован');
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

  async loadAnalysis() {
    try {
      const data = await fs.readFile(ANALYSIS_FILE, 'utf-8');
      this.analysis = JSON.parse(data);
    } catch (e) {
      this.analysis = [];
    }
  }

  async saveAnalysis() {
    await fs.writeFile(ANALYSIS_FILE, JSON.stringify(this.analysis, null, 2));
  }

  // ============================================================
  // 2.1. АНАЛИЗ ТЕКСТА ЧЕРЕЗ OLLAMA
  // ============================================================

  async analyzeText(text) {
    if (!text || text.length < 10) {
      return {
        error: 'Текст слишком короткий или отсутствует',
        entities: [],
        sentiment: 'neutral',
        topics: [],
        summary: 'Недостаточно данных для анализа'
      };
    }

    try {
      // Формируем запрос к Ollama
      const prompt = `
Проанализируй следующий текст и верни результат в формате JSON.

ТЕКСТ:
${text.slice(0, 2000)}

Ответь в формате JSON:
{
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "confidence": число от 0 до 1,
  "entities": [
    { "type": "person" | "organization" | "location" | "date" | "event", "name": "название" }
  ],
  "topics": ["тема1", "тема2", "тема3"],
  "summary": "краткое резюме (1-2 предложения)",
  "keywords": ["ключевое_слово1", "ключевое_слово2"]
}`;

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'deepseek-r1:1.5b',
          prompt: prompt,
          stream: false,
          options: { temperature: 0.3, num_predict: 600 }
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        return this.fallbackAnalysis(text);
      }

      const data = await response.json();
      const result = data.response || '';

      // Парсим JSON из ответа
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            ...parsed,
            confidence: parsed.confidence || 0.7,
            entities: parsed.entities || [],
            topics: parsed.topics || [],
            keywords: parsed.keywords || []
          };
        }
        return this.fallbackAnalysis(text);
      } catch (e) {
        return this.fallbackAnalysis(text);
      }

    } catch (e) {
      console.error('[Semantic Analyzer] Ошибка AI:', e.message);
      return this.fallbackAnalysis(text);
    }
  }

  fallbackAnalysis(text) {
    // Простой анализ без AI
    const words = text.toLowerCase().split(/\s+/);
    const positive = ['хорош', 'отличн', 'прекрасн', 'успешн', 'позитив', 'рад', 'счастлив'];
    const negative = ['плох', 'ужасн', 'кризис', 'опасн', 'тревожн', 'страшн', 'проблем'];
    
    let posScore = 0, negScore = 0;
    for (const word of words) {
      for (const p of positive) if (word.includes(p)) posScore++;
      for (const n of negative) if (word.includes(n)) negScore++;
    }
    
    let sentiment = 'neutral';
    if (posScore > negScore * 1.5) sentiment = 'positive';
    else if (negScore > posScore * 1.5) sentiment = 'negative';
    else if (posScore > 0 && negScore > 0) sentiment = 'mixed';

    return {
      sentiment: sentiment,
      confidence: 0.5,
      entities: [],
      topics: ['общий'],
      summary: text.slice(0, 100) + '...',
      keywords: words.slice(0, 5)
    };
  }

  // ============================================================
  // 2.2. АНАЛИЗ НЕСКОЛЬКИХ ТЕКСТОВ
  // ============================================================

  async analyzeBatch(texts) {
    const results = [];
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      console.log(`[Semantic Analyzer] Анализ ${i + 1}/${texts.length}`);
      const result = await this.analyzeText(text);
      results.push({
        index: i,
        text: text.slice(0, 200) + (text.length > 200 ? '...' : ''),
        analysis: result
      });
      
      // Задержка между запросами
      if (i < texts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    return results;
  }

  // ============================================================
  // 2.3. АНАЛИЗ КОРЗИНЫ
  // ============================================================

  async analyzeBasket(limit = 20) {
    try {
      const basketDir = join(ROOT, 'data', 'basket');
      const files = await fs.readdir(basketDir);
      const texts = [];
      
      for (const file of files.slice(-limit)) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(join(basketDir, file), 'utf-8');
          const items = JSON.parse(data);
          for (const item of items) {
            const text = (item.title || '') + ' ' + (item.description || '');
            if (text.length > 20) {
              texts.push(text);
            }
          }
        }
      }

      if (texts.length === 0) {
        return { error: 'Нет текстов для анализа', results: [] };
      }

      const results = await this.analyzeBatch(texts.slice(0, limit));
      
      const analysis = {
        timestamp: new Date().toISOString(),
        totalAnalyzed: results.length,
        results: results,
        summary: this.generateSummary(results)
      };

      this.analysis.push(analysis);
      if (this.analysis.length > 100) this.analysis = this.analysis.slice(-100);
      await this.saveAnalysis();

      return analysis;
    } catch (e) {
      console.error('[Semantic Analyzer] Ошибка анализа корзины:', e.message);
      return { error: e.message, results: [] };
    }
  }

  // ============================================================
  // 2.4. ГЕНЕРАЦИЯ РЕЗЮМЕ
  // ============================================================

  generateSummary(results) {
    const sentiments = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
    const entities = {};
    const topics = {};

    for (const r of results) {
      const sentiment = r.analysis.sentiment || 'neutral';
      sentiments[sentiment] = (sentiments[sentiment] || 0) + 1;
      
      for (const entity of r.analysis.entities || []) {
        entities[entity.name] = (entities[entity.name] || 0) + 1;
      }
      
      for (const topic of r.analysis.topics || []) {
        topics[topic] = (topics[topic] || 0) + 1;
      }
    }

    const total = results.length || 1;
    const dominant = Object.entries(sentiments).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';
    const dominantLabel = SENTIMENT_LABELS[dominant]?.label || 'Нейтральная';
    const dominantIcon = SENTIMENT_LABELS[dominant]?.icon || '😐';

    const topEntities = Object.entries(entities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(e => e[0]);

    const topTopics = Object.entries(topics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(t => t[0]);

    return {
      total: total,
      sentiments: sentiments,
      dominantSentiment: dominant,
      dominantLabel: dominantLabel,
      dominantIcon: dominantIcon,
      topEntities: topEntities,
      topTopics: topTopics,
      positivePercent: Math.round((sentiments.positive / total) * 100),
      negativePercent: Math.round((sentiments.negative / total) * 100),
      neutralPercent: Math.round((sentiments.neutral / total) * 100)
    };
  }

  // ============================================================
  // 2.5. СТАТИСТИКА
  // ============================================================

  getStats() {
    return {
      totalAnalyzed: this.analysis.reduce((sum, a) => sum + (a.totalAnalyzed || 0), 0),
      totalSessions: this.analysis.length,
      lastUpdate: this.analysis.length > 0 ? this.analysis[this.analysis.length - 1].timestamp : null
    };
  }

  getLatest() {
    return this.analysis.length > 0 ? this.analysis[this.analysis.length - 1] : null;
  }

  getHistory(limit = 30) {
    return this.analysis.slice(-limit);
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let analyzer = null;

async function getAnalyzer() {
  if (!analyzer) {
    analyzer = new SemanticAnalyzer();
    await analyzer.init();
  }
  return analyzer;
}

export async function handleSemanticAPI(req, res) {
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
    // GET /api/semantic/status
    // ============================================================
    if (path === '/api/semantic/status' && req.method === 'GET') {
      const stats = analyzer.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'semantic-analysis',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // POST /api/semantic/analyze
    // ============================================================
    if (path === '/api/semantic/analyze' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const text = data.text || '';
          
          if (data.batch && Array.isArray(data.batch)) {
            const results = await analyzer.analyzeBatch(data.batch);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, results }));
          } else {
            const result = await analyzer.analyzeText(text);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, result }));
          }
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // ============================================================
    // POST /api/semantic/analyze-basket
    // ============================================================
    if (path === '/api/semantic/analyze-basket' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const limit = data.limit || 20;
          const result = await analyzer.analyzeBasket(limit);
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
    // GET /api/semantic/latest
    // ============================================================
    if (path === '/api/semantic/latest' && req.method === 'GET') {
      const latest = analyzer.getLatest();
      if (latest) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, result: latest }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Анализов пока нет' }));
      }
      return;
    }

    // ============================================================
    // GET /api/semantic/history
    // ============================================================
    if (path === '/api/semantic/history' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 10;
      const history = analyzer.getHistory(limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, history }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Semantic API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleSemanticAPI, SemanticAnalyzer };
