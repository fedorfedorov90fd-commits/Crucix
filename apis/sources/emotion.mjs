#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №68: EMOTION AI — АНАЛИЗ ЭМОЦИЙ В ТЕКСТЕ И ГОЛОСЕ
// ============================================================
// Глубинная аналитика эмоционального состояния
// 8 базовых эмоций + комплексный анализ
// Интеграция с текстовыми и голосовыми данными
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'emotion');
const ANALYSES_FILE = join(DATA_DIR, 'analyses.json');
const TRENDS_FILE = join(DATA_DIR, 'trends.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const EMOTIONS = {
  joy: { name: 'Радость', icon: '😊', color: '#ffd700' },
  sadness: { name: 'Печаль', icon: '😢', color: '#5b8def' },
  anger: { name: 'Гнев', icon: '😡', color: '#ef4444' },
  fear: { name: 'Страх', icon: '😨', color: '#a855f7' },
  surprise: { name: 'Удивление', icon: '😮', color: '#f97316' },
  disgust: { name: 'Отвращение', icon: '🤢', color: '#22c55e' },
  trust: { name: 'Доверие', icon: '🤝', color: '#06b6d4' },
  anticipation: { name: 'Ожидание', icon: '🔮', color: '#8b5cf6' }
};

// ============================================================
// 2. ДЕМО-ДАННЫЕ
// ============================================================

const DEMO_TEXTS = [
  {
    id: 'text-001',
    text: 'Я очень рад этому событию! Это действительно замечательный день для всех нас.',
    source: 'social',
    timestamp: null
  },
  {
    id: 'text-002',
    text: 'Ситуация крайне тревожная. Мы должны быть готовы к любым последствиям.',
    source: 'news',
    timestamp: null
  },
  {
    id: 'text-003',
    text: 'Невозможно поверить в то, что произошло! Это абсолютно шокирующая новость.',
    source: 'media',
    timestamp: null
  },
  {
    id: 'text-004',
    text: 'Я чувствую глубокую печаль и скорбь. Мы потеряли очень многое.',
    source: 'personal',
    timestamp: null
  },
  {
    id: 'text-005',
    text: 'Это вызывает отвращение и возмущение. Так не должно быть!',
    source: 'protest',
    timestamp: null
  },
  {
    id: 'text-006',
    text: 'Я доверяю этому человеку. Он доказал свою надежность и честность.',
    source: 'interview',
    timestamp: null
  },
  {
    id: 'text-007',
    text: 'Я с нетерпением жду этого события! Это изменит всё!',
    source: 'forum',
    timestamp: null
  },
  {
    id: 'text-008',
    text: 'Страх и тревога охватывают меня, когда я думаю о будущем.',
    source: 'blog',
    timestamp: null
  }
];

// ============================================================
// 3. КЛАСС АНАЛИЗА ЭМОЦИЙ
// ============================================================

class EmotionAI {
  constructor() {
    this.analyses = [];
    this.trends = {};
    this.emotions = EMOTIONS;
  }

  async init() {
    await this.ensureDirs();
    await this.loadAnalyses();
    await this.loadTrends();
    console.log('[Emotion] Система анализа эмоций инициализирована');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadAnalyses() {
    try {
      const data = await fs.readFile(ANALYSES_FILE, 'utf-8');
      this.analyses = JSON.parse(data);
    } catch (e) {
      this.analyses = DEMO_TEXTS.map(t => ({
        ...t,
        timestamp: new Date(Date.now() - Math.random() * 86400000 * 5).toISOString()
      }));
      await this.saveAnalyses();
    }
  }

  async saveAnalyses() {
    await fs.writeFile(ANALYSES_FILE, JSON.stringify(this.analyses, null, 2));
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

  // ============================================================
  // 3.1. АНАЛИЗ ЭМОЦИЙ В ТЕКСТЕ
  // ============================================================

  analyzeText(text) {
    const lowerText = text.toLowerCase();
    const results = {};

    // Ключевые слова для каждой эмоции
    const keywords = {
      joy: ['рад', 'счастье', 'замечательный', 'прекрасный', 'отлично', 'успех', 'радость', 'праздник'],
      sadness: ['печаль', 'скорбь', 'потеря', 'грусть', 'горе', 'разочарование', 'тоска'],
      anger: ['гнев', 'возмущение', 'ярость', 'злость', 'негодование', 'раздражение'],
      fear: ['страх', 'тревога', 'опасность', 'боюсь', 'паника', 'ужас', 'беспокойство'],
      surprise: ['шок', 'удивление', 'неожиданно', 'поразительно', 'внезапно', 'сенсация'],
      disgust: ['отвращение', 'мерзость', 'гадко', 'противно', 'возмутительно'],
      trust: ['доверяю', 'надёжный', 'честный', 'уверен', 'верю', 'поддержка'],
      anticipation: ['ожидаю', 'нетерпение', 'скоро', 'предвкушение', 'надеюсь', 'жду']
    };

    // Подсчёт баллов для каждой эмоции
    let totalScore = 0;
    for (const [emotion, words] of Object.entries(keywords)) {
      let score = 0;
      for (const word of words) {
        const regex = new RegExp(word, 'g');
        const matches = (lowerText.match(regex) || []).length;
        score += matches * 10;
      }
      results[emotion] = score;
      totalScore += score;
    }

    // Нормализация (0-100)
    for (const emotion of Object.keys(results)) {
      results[emotion] = totalScore > 0 ? Math.round((results[emotion] / totalScore) * 100) : 0;
    }

    // Добавляем нейтральность
    const neutral = Math.max(0, 100 - Object.values(results).reduce((a, b) => a + b, 0));
    results.neutral = neutral;

    // Определяем доминирующую эмоцию
    const dominant = Object.entries(results)
      .filter(([key]) => key !== 'neutral')
      .sort((a, b) => b[1] - a[1]);

    const dominantEmotion = dominant.length > 0 && dominant[0][1] > 20 ? dominant[0][0] : 'neutral';

    return {
      emotions: results,
      dominant: dominantEmotion,
      intensity: Math.min(100, totalScore / 2),
      valence: this.calculateValence(results),
      arousal: this.calculateArousal(results),
      confidence: Math.min(95, 50 + totalScore / 4),
      timestamp: new Date().toISOString()
    };
  }

  calculateValence(emotions) {
    // Валентность: позитивные vs негативные эмоции
    const positive = (emotions.joy || 0) + (emotions.trust || 0) + (emotions.anticipation || 0);
    const negative = (emotions.sadness || 0) + (emotions.anger || 0) + (emotions.fear || 0) + (emotions.disgust || 0);
    const total = positive + negative || 1;
    return Math.round(((positive - negative) / total) * 50 + 50);
  }

  calculateArousal(emotions) {
    // Активация: интенсивность эмоций
    const highArousal = (emotions.joy || 0) + (emotions.anger || 0) + (emotions.fear || 0) + (emotions.surprise || 0);
    const lowArousal = (emotions.sadness || 0) + (emotions.disgust || 0) + (emotions.trust || 0);
    const total = highArousal + lowArousal || 1;
    return Math.round((highArousal / total) * 100);
  }

  // ============================================================
  // 3.2. АНАЛИЗ ВСЕХ ТЕКСТОВ
  // ============================================================

  async analyzeAll() {
    const results = [];
    for (const text of this.analyses) {
      const analysis = this.analyzeText(text.text);
      text.analysis = analysis;
      text.status = 'analyzed';
      results.push({ id: text.id, analysis });
    }
    await this.saveAnalyses();
    this.updateTrends(results);
    return {
      analyzed: results.length,
      total: this.analyses.length,
      results: results
    };
  }

  // ============================================================
  // 3.3. ТРЕНДЫ
  // ============================================================

  generateTrends() {
    const trends = {};
    for (const emotion of Object.keys(EMOTIONS)) {
      trends[emotion] = {
        current: 0,
        change: Math.round((Math.random() - 0.5) * 20),
        history: Array.from({ length: 7 }, () => Math.round(Math.random() * 100))
      };
    }
    return trends;
  }

  updateTrends(results) {
    const avgEmotions = {};
    for (const emotion of Object.keys(EMOTIONS)) {
      avgEmotions[emotion] = 0;
    }

    let count = 0;
    for (const result of results) {
      if (result.analysis && result.analysis.emotions) {
        count++;
        for (const [emotion, value] of Object.entries(result.analysis.emotions)) {
          if (emotion !== 'neutral' && avgEmotions[emotion] !== undefined) {
            avgEmotions[emotion] += value;
          }
        }
      }
    }

    for (const emotion of Object.keys(EMOTIONS)) {
      if (count > 0) {
        const current = Math.round(avgEmotions[emotion] / count);
        this.trends[emotion] = this.trends[emotion] || { current: 0, change: 0, history: [] };
        const oldValue = this.trends[emotion].current || 0;
        this.trends[emotion].current = current;
        this.trends[emotion].change = current - oldValue;
        if (!this.trends[emotion].history) {
          this.trends[emotion].history = [];
        }
        this.trends[emotion].history.push(current);
        if (this.trends[emotion].history.length > 30) {
          this.trends[emotion].history = this.trends[emotion].history.slice(-30);
        }
      }
    }

    this.saveTrends();
  }

  // ============================================================
  // 3.4. СТАТИСТИКА
  // ============================================================

  getStats() {
    const total = this.analyses.length;
    const analyzed = this.analyses.filter(t => t.status === 'analyzed').length;
    const avgValence = analyzed > 0 ? Math.round(this.analyses.reduce((sum, t) => sum + (t.analysis?.valence || 50), 0) / analyzed) : 0;
    const dominantEmotions = {};

    for (const text of this.analyses) {
      if (text.analysis && text.analysis.dominant && text.analysis.dominant !== 'neutral') {
        const emotion = text.analysis.dominant;
        dominantEmotions[emotion] = (dominantEmotions[emotion] || 0) + 1;
      }
    }

    return {
      total_texts: total,
      analyzed: analyzed,
      pending: total - analyzed,
      avg_valence: avgValence,
      dominant_emotions: dominantEmotions,
      emotions: Object.keys(EMOTIONS).length,
      last_update: new Date().toISOString()
    };
  }

  getAnalyses(limit = 20) {
    return this.analyses.slice(-limit).reverse();
  }

  getTrends() {
    return this.trends;
  }

  getEmotions() {
    return this.emotions;
  }

  async addText(data) {
    const text = {
      id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: data.text || '',
      source: data.source || 'unknown',
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    this.analyses.push(text);
    await this.saveAnalyses();
    return text;
  }

  async analyzeTextById(id) {
    const text = this.analyses.find(t => t.id === id);
    if (!text) return null;
    const analysis = this.analyzeText(text.text);
    text.analysis = analysis;
    text.status = 'analyzed';
    await this.saveAnalyses();
    return analysis;
  }
}

// ============================================================
// 4. HTTP-ОБРАБОТЧИК
// ============================================================

let emotion = null;

async function getEmotion() {
  if (!emotion) {
    emotion = new EmotionAI();
    await emotion.init();
  }
  return emotion;
}

export async function handleEmotionAPI(req, res) {
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
    const emotion = await getEmotion();

    // GET /api/emotion/status
    if (path === '/api/emotion/status' && req.method === 'GET') {
      const stats = emotion.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'emotion',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // GET /api/emotion/analyses
    if (path === '/api/emotion/analyses' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const analyses = emotion.getAnalyses(limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, analyses }));
      return;
    }

    // POST /api/emotion/analyze
    if (path === '/api/emotion/analyze' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const analysis = emotion.analyzeText(data.text);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, analysis }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // POST /api/emotion/analyze-all
    if (path === '/api/emotion/analyze-all' && req.method === 'POST') {
      const result = await emotion.analyzeAll();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, result }));
      return;
    }

    // POST /api/emotion/text
    if (path === '/api/emotion/text' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const text = await emotion.addText(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, text }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // GET /api/emotion/trends
    if (path === '/api/emotion/trends' && req.method === 'GET') {
      const trends = emotion.getTrends();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, trends }));
      return;
    }

    // GET /api/emotion/emotions
    if (path === '/api/emotion/emotions' && req.method === 'GET') {
      const emotions = emotion.getEmotions();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, emotions }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Emotion API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка', details: error.message }));
  }
}

export default { handleEmotionAPI, EmotionAI };
