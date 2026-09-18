/**
 * apis/sources/nlp-api.mjs — SERVICE-МОДУЛЬ: МНОГОЯЗЫЧНЫЙ NLP-АНАЛИЗ
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE).
 * ИСТОЧНИК: встроенные словари (RU/EN/ZH/HI), статистические алгоритмы.
 *
 * NLP-движок по запросу: определение языка, тональность, извлечение сущностей,
 * классификация по категориям, полный анализ текста.
 *
 * ЭНДПОИНТЫ:
 *   GET  /                   — корень (список эндпоинтов + версия)
 *   GET  /status             — health-check
 *   GET  /languages          — доступные языки
 *   GET  /categories         — доступные категории
 *   POST /detect             — определить язык (body: {text})
 *   POST /sentiment          — тональность (body: {text, lang?})
 *   POST /entities           — сущности (body: {text})
 *   POST /classify           — категория (body: {text})
 *   POST /analyze            — полный анализ (body: {text, lang?})
 *   POST /batch              — пакетный анализ (body: {texts:[...]})
 *
 * ФОРМАТ: JSON.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

export const route  = '/api/services/nlp';
export const methods = ['GET', 'POST'];

export const meta = {
  service: true,
  description: 'Multilingual NLP service: language detection, sentiment, entity extraction, text classification (RU/EN/ZH/HI).',
  cache: 0,
  version: '2.0.0',
};

const LANGUAGES = {
  ru: { name: 'Русский', flag: '🇷🇺', native: 'Русский' },
  en: { name: 'English', flag: '🇬🇧', native: 'English' },
  zh: { name: '中文',    flag: '🇨🇳', native: '中文' },
  hi: { name: 'हिन्दी',  flag: '🇮🇳', native: 'हिन्दी' },
};

const SENTIMENT_KEYWORDS = {
  positive: {
    ru: ['хорошо', 'отлично', 'прекрасно', 'замечательно', 'успех', 'победа', 'лучший', 'рост', 'развитие'],
    en: ['good', 'great', 'excellent', 'wonderful', 'success', 'victory', 'best', 'growth', 'progress'],
    zh: ['好', '优秀', '精彩', '成功', '胜利', '最好', '增长'],
    hi: ['अच्छा', 'उत्कृष्ट', 'शानदार', 'सफलता', 'विजय', 'सर्वश्रेष्ठ'],
  },
  negative: {
    ru: ['плохо', 'ужасно', 'провал', 'кризис', 'война', 'атака', 'смерть', 'падение', 'угроза'],
    en: ['bad', 'terrible', 'failure', 'crisis', 'war', 'attack', 'death', 'decline', 'threat'],
    zh: ['坏', '糟糕', '失败', '危机', '战争', '攻击', '死亡'],
    hi: ['बुरा', 'भयानक', 'असफलता', 'संकट', 'युद्ध', 'हमला', 'मृत्यु'],
  },
};

const CATEGORIES = {
  'политика':        ['президент', 'правительство', 'выборы', 'парламент', 'санкции', 'переговоры', 'политик', 'министр'],
  'экономика':       ['рынок', 'цена', 'инфляция', 'валюта', 'акции', 'нефть', 'кризис', 'ввп', 'ставка', 'экономик'],
  'военный':         ['война', 'армия', 'атака', 'оборона', 'ракета', 'солдаты', 'конфликт', 'военн', 'удар'],
  'технологии':      ['ai', 'искусственный интеллект', 'технологии', 'цифровой', 'инновации', 'кибер', 'данные', 'it'],
  'экология':        ['климат', 'природа', 'загрязнение', 'экология', 'погода', 'выбросы', 'carbon', 'co2'],
  'здравоохранение': ['здоровье', 'болезнь', 'лечение', 'вирус', 'вакцина', 'медицин', 'эпидемия', 'пандем'],
  'финансы':         ['банк', 'кредит', 'долг', 'облигации', 'биржа', 'фонд', 'доллар', 'евро', 'финанс'],
  'кибербезопасность':['хакер', 'уязвимость', 'малварь', 'фишинг', 'ddos', 'cve', 'взлом', 'кибератак'],
};

// ============================================================
//  ЛИНГВИСТИЧЕСКИЕ ФУНКЦИИ
// ============================================================

function detectLanguage(text) {
  if (!text || text.trim().length === 0) return { lang: 'unknown', confidence: 0 };
  let cyrillic = 0, latin = 0, cjk = 0, devanagari = 0, total = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (ch.match(/\s/)) continue;
    total++;
    if ((code >= 0x0400 && code <= 0x04FF) || (code >= 0x0500 && code <= 0x052F)) cyrillic++;
    else if (code >= 0x4E00 && code <= 0x9FFF) cjk++;
    else if (code >= 0x0900 && code <= 0x097F) devanagari++;
    else if ((code >= 0x0041 && code <= 0x007A)) latin++;
  }
  if (total === 0) return { lang: 'unknown', confidence: 0 };
  const pct = (n) => Number(((n / total) * 100).toFixed(1));
  if (cyrillic / total > 0.3) return { lang: 'ru', confidence: pct(cyrillic) };
  if (cjk / total > 0.3)      return { lang: 'zh', confidence: pct(cjk) };
  if (devanagari / total > 0.3) return { lang: 'hi', confidence: pct(devanagari) };
  if (latin / total > 0.5)    return { lang: 'en', confidence: pct(latin) };
  return { lang: 'unknown', confidence: 50 };
}

function analyzeSentiment(text, lang = 'en') {
  const words = text.toLowerCase().split(/\s+/);
  const posKeywords = SENTIMENT_KEYWORDS.positive[lang] || SENTIMENT_KEYWORDS.positive.en;
  const negKeywords = SENTIMENT_KEYWORDS.negative[lang] || SENTIMENT_KEYWORDS.negative.en;
  let positiveScore = 0, negativeScore = 0;
  const matched = { positive: [], negative: [] };
  for (const word of words) {
    const w = word.replace(/[^\p{L}\p{N}]/gu, '');
    if (!w) continue;
    if (posKeywords.some(k => w.includes(k))) { positiveScore++; matched.positive.push(w); }
    if (negKeywords.some(k => w.includes(k))) { negativeScore++; matched.negative.push(w); }
  }
  const total = positiveScore + negativeScore || 1;
  const score = Number(((positiveScore - negativeScore) / total).toFixed(4));
  let sentiment = 'neutral', label = 'Нейтральный', emoji = '😐';
  if (score > 0.3) { sentiment = 'positive'; label = 'Позитивный'; emoji = '😊'; }
  else if (score < -0.3) { sentiment = 'negative'; label = 'Негативный'; emoji = '😟'; }
  return {
    sentiment, label, emoji, score,
    positive_score: positiveScore,
    negative_score: negativeScore,
    matched,
    confidence: Math.min(95, 50 + Math.abs(score) * 45),
  };
}

function extractEntities(text) {
  const entities = [];
  const patterns = {
    date:         /\b\d{4}-\d{2}-\d{2}\b/g,
    time:         /\b\d{1,2}:\d{2}(?::\d{2})?\b/g,
    number:       /\b\d+(?:\.\d+)?\b/g,
    email:        /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,
    url:          /https?:\/\/[^\s]+/g,
    money:        /\b\d+(?:\.\d+)?\s*(?:USD|EUR|RUB|руб|долл|евро|\$|€|₽)\b/gi,
    percent:      /\b\d+(?:\.\d+)?\s*%/g,
    hashnode:     /#[A-Za-zА-Яа-яЁё0-9_]+/g,
    ipAddress:    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    cve:          /\bCVE-\d{4}-\d{4,}\b/gi,
    ticker:       /\b[A-Z]{2,5}\b/g,
    orgLatin:     /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b/g,
    orgCyrillic:  /\b[А-ЯЁ][а-яё]+(?:\s[А-ЯЁ][а-яё]+)?\b/g,
  };
  const seen = new Set();
  for (const [type, pattern] of Object.entries(patterns)) {
    const matches = text.match(pattern);
    if (!matches) continue;
    for (const value of matches.slice(0, 20)) {
      const key = `${type}::${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entities.push({ type, value, confidence: 70 });
    }
  }
  return entities;
}

function classifyText(text) {
  const lower = text.toLowerCase();
  const scores = {};
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score += 2;
    }
    scores[category] = score;
  }
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const total = Object.values(scores).reduce((s, v) => s + v, 0);
  const best = sorted[0];
  return {
    category: best && best[1] > 0 ? best[0] : 'unknown',
    confidence: best && total > 0 ? Math.min(95, (best[1] / total) * 100) : 0,
    scores,
  };
}

function fullAnalysis(text, langOverride = null) {
  const detection = langOverride ? { lang: langOverride, confidence: 100 } : detectLanguage(text);
  const lang = detection.lang === 'unknown' ? 'en' : detection.lang;
  const sentiment = analyzeSentiment(text, lang);
  const entities = extractEntities(text);
  const classification = classifyText(text);
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).filter(Boolean);
  return {
    text_preview: text.slice(0, 200),
    lang: detection.lang,
    lang_confidence: detection.confidence,
    lang_used_for_sentiment: lang,
    word_count: words.length,
    char_count: text.length,
    sentence_count: sentences.length,
    avg_word_length: words.length ? Number((text.replace(/\s+/g, '').length / words.length).toFixed(2)) : 0,
    sentiment,
    entities: entities.slice(0, 20),
    entities_count: entities.length,
    classification,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
//  BODY / ОТВЕТЫ
// ============================================================

function readBody(req, maxBytes = 500_000) {
  return new Promise((resolve, reject) => {
    let buf = ''; let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) { req.destroy(); reject(new Error('body_too_large')); return; }
      buf += c;
    });
    req.on('end', () => {
      if (!buf) return resolve({});
      try { resolve(JSON.parse(buf)); } catch (e) { reject(new Error('invalid_json_body: ' + e.message)); }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(body)), ...extra });
  res.end(body);
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const subPath = url.pathname.replace(/^\/api\/services\/nlp/, '') || '/';

  if (req.method === 'OPTIONS') {
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  const extra = {
    'X-Service': 'nlp',
    'X-Service-Version': meta.version,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    if (req.method === 'GET') {
      if (subPath === '/' || subPath === '') {
        return sendJSON(res, 200, { service: 'nlp', endpoint: '/', data: {
          version: meta.version,
          endpoints: ['/status', '/languages', '/categories', '/detect', '/sentiment', '/entities', '/classify', '/analyze', '/batch'],
          languages: Object.keys(LANGUAGES),
        }}, extra);
      }
      if (subPath === '/status') {
        return sendJSON(res, 200, { service: 'nlp', endpoint: '/status', data: { status: 'online', languages: Object.keys(LANGUAGES).length, categories: Object.keys(CATEGORIES).length } }, extra);
      }
      if (subPath === '/languages') {
        return sendJSON(res, 200, { service: 'nlp', endpoint: '/languages', data: { languages: LANGUAGES, total: Object.keys(LANGUAGES).length } }, extra);
      }
      if (subPath === '/categories') {
        return sendJSON(res, 200, { service: 'nlp', endpoint: '/categories', data: { categories: Object.keys(CATEGORIES), total: Object.keys(CATEGORIES).length } }, extra);
      }
      return sendJSON(res, 404, { error: 'endpoint_not_found', method: 'GET', path: subPath }, extra);
    }

    if (req.method !== 'POST') {
      return sendJSON(res, 405, { error: 'method_not_allowed', allowed: ['GET', 'POST', 'OPTIONS'] }, extra);
    }

    let body;
    try { body = await readBody(req); }
    catch (e) { return sendJSON(res, 400, { error: 'invalid_body', message: e.message }, extra); }

    if (subPath === '/detect') {
      if (!body.text) return sendJSON(res, 400, { error: 'field_required: text' }, extra);
      const result = detectLanguage(String(body.text));
      return sendJSON(res, 200, { service: 'nlp', endpoint: '/detect', data: { ...result, languageInfo: LANGUAGES[result.lang] || null } }, extra);
    }
    if (subPath === '/sentiment') {
      if (!body.text) return sendJSON(res, 400, { error: 'field_required: text' }, extra);
      const lang = body.lang || detectLanguage(String(body.text)).lang || 'en';
      return sendJSON(res, 200, { service: 'nlp', endpoint: '/sentiment', data: { ...analyzeSentiment(String(body.text), lang), lang } }, extra);
    }
    if (subPath === '/entities') {
      if (!body.text) return sendJSON(res, 400, { error: 'field_required: text' }, extra);
      const entities = extractEntities(String(body.text));
      return sendJSON(res, 200, { service: 'nlp', endpoint: '/entities', data: { entities, count: entities.length } }, extra);
    }
    if (subPath === '/classify') {
      if (!body.text) return sendJSON(res, 400, { error: 'field_required: text' }, extra);
      return sendJSON(res, 200, { service: 'nlp', endpoint: '/classify', data: classifyText(String(body.text)) }, extra);
    }
    if (subPath === '/analyze') {
      if (!body.text) return sendJSON(res, 400, { error: 'field_required: text' }, extra);
      return sendJSON(res, 200, { service: 'nlp', endpoint: '/analyze', data: fullAnalysis(String(body.text), body.lang || null) }, extra);
    }
    if (subPath === '/batch') {
      if (!Array.isArray(body.texts)) return sendJSON(res, 400, { error: 'field_required: texts[]' }, extra);
      const results = body.texts.slice(0, 100).map(t => fullAnalysis(String(t), body.lang || null));
      return sendJSON(res, 200, { service: 'nlp', endpoint: '/batch', data: { results, count: results.length } }, extra);
    }

    return sendJSON(res, 404, { error: 'endpoint_not_found', method: 'POST', path: subPath, available: ['/detect','/sentiment','/entities','/classify','/analyze','/batch'] }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    try { sendJSON(res, status, { error: 'service_error', message: e.message }, extra); } catch {}
  }
}
