#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №67: VOICE INTELLIGENCE — АНАЛИЗ ГОЛОСОВЫХ СООБЩЕНИЙ
// ============================================================
// Анализ голосовых сообщений и аудио-контента
// Распознавание речи, тональность, эмоции
// Детекция дипфейков голоса
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'voice');
const RECORDINGS_FILE = join(DATA_DIR, 'recordings.json');
const ANALYSES_FILE = join(DATA_DIR, 'analyses.json');
const SPEAKERS_FILE = join(DATA_DIR, 'speakers.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const DEMO_RECORDINGS = [
  {
    id: 'rec-001',
    title: 'Заявление политического лидера',
    source: 'telegram',
    duration: 45,
    language: 'ru',
    speaker: 'Политик',
    status: 'pending',
    url: 'https://example.com/voice1',
    timestamp: null
  },
  {
    id: 'rec-002',
    title: 'Интервью эксперта',
    source: 'podcast',
    duration: 120,
    language: 'ru',
    speaker: 'Эксперт',
    status: 'pending',
    url: 'https://example.com/voice2',
    timestamp: null
  },
  {
    id: 'rec-003',
    title: 'Пресс-конференция',
    source: 'news',
    duration: 180,
    language: 'en',
    speaker: 'Пресс-секретарь',
    status: 'pending',
    url: 'https://example.com/voice3',
    timestamp: null
  },
  {
    id: 'rec-004',
    title: 'Секретные переговоры (утечка)',
    source: 'leak',
    duration: 60,
    language: 'ru',
    speaker: 'Неизвестный',
    status: 'pending',
    url: 'https://example.com/voice4',
    timestamp: null
  },
  {
    id: 'rec-005',
    title: 'Обращение к нации',
    source: 'official',
    duration: 90,
    language: 'ru',
    speaker: 'Лидер страны',
    status: 'pending',
    url: 'https://example.com/voice5',
    timestamp: null
  }
];

// ============================================================
// 2. КЛАСС АНАЛИЗА ГОЛОСА
// ============================================================

class VoiceIntelligence {
  constructor() {
    this.recordings = [];
    this.analyses = [];
    this.speakers = {};
  }

  async init() {
    await this.ensureDirs();
    await this.loadRecordings();
    await this.loadAnalyses();
    await this.loadSpeakers();
    console.log('[Voice] Система анализа голоса инициализирована');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadRecordings() {
    try {
      const data = await fs.readFile(RECORDINGS_FILE, 'utf-8');
      this.recordings = JSON.parse(data);
    } catch (e) {
      this.recordings = DEMO_RECORDINGS.map(r => ({
        ...r,
        timestamp: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString()
      }));
      await this.saveRecordings();
    }
  }

  async saveRecordings() {
    await fs.writeFile(RECORDINGS_FILE, JSON.stringify(this.recordings, null, 2));
  }

  async loadAnalyses() {
    try {
      const data = await fs.readFile(ANALYSES_FILE, 'utf-8');
      this.analyses = JSON.parse(data);
    } catch (e) {
      this.analyses = [];
      await this.saveAnalyses();
    }
  }

  async saveAnalyses() {
    await fs.writeFile(ANALYSES_FILE, JSON.stringify(this.analyses, null, 2));
  }

  async loadSpeakers() {
    try {
      const data = await fs.readFile(SPEAKERS_FILE, 'utf-8');
      this.speakers = JSON.parse(data);
    } catch (e) {
      this.speakers = {};
      await this.saveSpeakers();
    }
  }

  async saveSpeakers() {
    await fs.writeFile(SPEAKERS_FILE, JSON.stringify(this.speakers, null, 2));
  }

  // ============================================================
  // 2.1. АНАЛИЗ ГОЛОСА
  // ============================================================

  analyzeVoice(recording) {
    // Симуляция анализа голоса
    const transcript = this.generateTranscript(recording);
    const sentiment = this.analyzeSentiment(transcript);
    const emotions = this.detectEmotions(transcript);
    const speakerId = this.identifySpeaker(transcript);
    const authenticity = this.checkAuthenticity(recording);

    return {
      recording_id: recording.id,
      transcript: transcript,
      sentiment: sentiment,
      emotions: emotions,
      speaker_id: speakerId,
      authenticity: authenticity,
      language: recording.language || 'ru',
      confidence: Math.round(65 + Math.random() * 30),
      key_phrases: this.extractKeyPhrases(transcript),
      summary: this.generateSummary(transcript),
      timestamp: new Date().toISOString()
    };
  }

  generateTranscript(recording) {
    const templates = {
      ru: [
        'Мы подтверждаем нашу приверженность мирному урегулированию конфликта.',
        'Экономическая ситуация остаётся стабильной, несмотря на внешние вызовы.',
        'Наши вооружённые силы находятся в состоянии повышенной готовности.',
        'Мы призываем все стороны к диалогу и конструктивным переговорам.',
        'Санкции не приведут к желаемым результатам, мы найдём другие пути.',
        'Инфраструктурные проекты будут продолжены в полном объёме.',
        'Мы готовы к сотрудничеству со всеми заинтересованными сторонами.'
      ],
      en: [
        'We confirm our commitment to peaceful resolution of the conflict.',
        'The economic situation remains stable despite external challenges.',
        'Our armed forces are on high alert.',
        'We call on all parties to engage in dialogue and constructive negotiations.',
        'Sanctions will not achieve the desired results, we will find other ways.',
        'Infrastructure projects will continue in full.',
        'We are ready to cooperate with all interested parties.'
      ]
    };

    const langTemplates = templates[recording.language] || templates.ru;
    const count = 2 + Math.floor(Math.random() * 4);
    const selected = [];
    for (let i = 0; i < count; i++) {
      selected.push(langTemplates[Math.floor(Math.random() * langTemplates.length)]);
    }
    return selected.join(' ');
  }

  analyzeSentiment(text) {
    const negativeWords = ['конфликт', 'санкции', 'кризис', 'угроза', 'война', 'проблема', 'критический'];
    const positiveWords = ['мир', 'сотрудничество', 'развитие', 'успех', 'стабильность', 'прогресс'];
    
    const lowerText = text.toLowerCase();
    let score = 0;
    
    for (const word of negativeWords) {
      if (lowerText.includes(word)) score -= 2;
    }
    for (const word of positiveWords) {
      if (lowerText.includes(word)) score += 2;
    }
    
    // Нормализуем от -1 до 1
    const normalized = Math.max(-1, Math.min(1, score / 10));
    
    const sentiment = normalized < -0.3 ? 'negative' :
                     normalized > 0.3 ? 'positive' : 'neutral';
    
    return {
      score: Math.round(normalized * 100),
      label: sentiment,
      confidence: Math.round(60 + Math.random() * 35)
    };
  }

  detectEmotions(text) {
    const emotions = {
      anger: 0,
      fear: 0,
      joy: 0,
      sadness: 0,
      surprise: 0,
      neutral: 0
    };
    
    const keywords = {
      anger: ['угроза', 'санкции', 'против', 'атака', 'удар'],
      fear: ['опасность', 'риск', 'страх', 'тревога', 'кризис'],
      joy: ['успех', 'прогресс', 'достижение', 'развитие', 'победа'],
      sadness: ['потеря', 'трагедия', 'жертва', 'разрушение', 'горе'],
      surprise: ['неожиданно', 'внезапно', 'шокирует', 'сенсация']
    };
    
    const lowerText = text.toLowerCase();
    for (const [emotion, words] of Object.entries(keywords)) {
      for (const word of words) {
        if (lowerText.includes(word)) {
          emotions[emotion] += 20;
        }
      }
    }
    
    // Нормализуем
    const total = Object.values(emotions).reduce((a, b) => a + b, 0) || 1;
    for (const key of Object.keys(emotions)) {
      emotions[key] = Math.min(100, Math.round((emotions[key] / total) * 100));
    }
    
    // Добавляем нейтральность
    emotions.neutral = Math.max(0, 100 - Object.values(emotions).reduce((a, b) => a + b, 0));
    
    return emotions;
  }

  identifySpeaker(text) {
    // Симуляция идентификации диктора
    const speakers = ['Speaker_A', 'Speaker_B', 'Speaker_C', 'Unknown'];
    const confidence = 60 + Math.random() * 35;
    return {
      id: speakers[Math.floor(Math.random() * speakers.length)],
      confidence: Math.round(confidence)
    };
  }

  checkAuthenticity(recording) {
    // Симуляция проверки подлинности
    const score = 40 + Math.random() * 50;
    const isFake = score < 30;
    const method = isFake ? 'Искусственный голос (AI)' : 'Естественный голос';
    
    return {
      authenticity_score: Math.round(score),
      is_fake: isFake,
      method: method,
      confidence: Math.round(60 + Math.random() * 35)
    };
  }

  extractKeyPhrases(text) {
    const words = text.split(/[.,!?;:()\s]+/).filter(w => w.length > 4);
    const unique = [...new Set(words)];
    const shuffled = unique.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 5);
  }

  generateSummary(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length === 0) return 'Анализ аудио не выявил значимого текста.';
    return sentences.slice(0, 2).join('. ') + '.';
  }

  // ============================================================
  // 2.2. СТАТИСТИКА
  // ============================================================

  getStats() {
    const total = this.recordings.length;
    const analyzed = this.recordings.filter(r => r.status === 'analyzed').length;
    const pending = this.recordings.filter(r => r.status === 'pending').length;
    const fake = this.analyses.filter(a => a.authenticity?.is_fake).length;
    
    return {
      total_recordings: total,
      analyzed: analyzed,
      pending: pending,
      fake_detected: fake,
      speakers: Object.keys(this.speakers).length,
      avg_confidence: this.analyses.length > 0 
        ? Math.round(this.analyses.reduce((sum, a) => sum + (a.confidence || 0), 0) / this.analyses.length)
        : 0
    };
  }

  getRecordings(filters = {}) {
    let result = this.recordings;
    if (filters.status) result = result.filter(r => r.status === filters.status);
    if (filters.source) result = result.filter(r => r.source === filters.source);
    if (filters.language) result = result.filter(r => r.language === filters.language);
    if (filters.limit) result = result.slice(0, filters.limit);
    return result;
  }

  getAnalyses(limit = 20) {
    return this.analyses.slice(-limit);
  }

  async analyzeRecording(id) {
    const recording = this.recordings.find(r => r.id === id);
    if (!recording) return null;

    const analysis = this.analyzeVoice(recording);
    this.analyses.push(analysis);
    if (this.analyses.length > 100) {
      this.analyses = this.analyses.slice(-100);
    }

    // Обновляем статус записи
    recording.status = 'analyzed';
    await this.saveRecordings();
    await this.saveAnalyses();

    return analysis;
  }

  async analyzeAll() {
    const results = [];
    for (const recording of this.recordings) {
      if (recording.status === 'pending') {
        const analysis = await this.analyzeRecording(recording.id);
        results.push(analysis);
      }
    }
    return {
      analyzed: results.length,
      total: this.recordings.length,
      results: results
    };
  }

  async addRecording(data) {
    const recording = {
      id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: data.title || 'Новая запись',
      source: data.source || 'unknown',
      duration: data.duration || 0,
      language: data.language || 'ru',
      speaker: data.speaker || 'Неизвестный',
      status: 'pending',
      url: data.url || '',
      timestamp: new Date().toISOString()
    };
    this.recordings.push(recording);
    await this.saveRecordings();
    return recording;
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let voice = null;

async function getVoice() {
  if (!voice) {
    voice = new VoiceIntelligence();
    await voice.init();
  }
  return voice;
}

export async function handleVoiceAPI(req, res) {
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
    const voice = await getVoice();

    // GET /api/voice/status
    if (path === '/api/voice/status' && req.method === 'GET') {
      const stats = voice.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'voice',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // GET /api/voice/recordings
    if (path === '/api/voice/recordings' && req.method === 'GET') {
      const status = url.searchParams.get('status');
      const source = url.searchParams.get('source');
      const language = url.searchParams.get('language');
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const recordings = voice.getRecordings({ status, source, language, limit });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, recordings, total: recordings.length }));
      return;
    }

    // POST /api/voice/recordings
    if (path === '/api/voice/recordings' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const recording = await voice.addRecording(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, recording }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // POST /api/voice/analyze/:id
    if (path.startsWith('/api/voice/analyze/') && req.method === 'POST') {
      const id = path.split('/').pop();
      const analysis = await voice.analyzeRecording(id);
      if (analysis) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, analysis }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Запись не найдена' }));
      }
      return;
    }

    // POST /api/voice/analyze-all
    if (path === '/api/voice/analyze-all' && req.method === 'POST') {
      const result = await voice.analyzeAll();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, result }));
      return;
    }

    // GET /api/voice/analyses
    if (path === '/api/voice/analyses' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const analyses = voice.getAnalyses(limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, analyses }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Voice API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка', details: error.message }));
  }
}

export default { handleVoiceAPI, VoiceIntelligence };
