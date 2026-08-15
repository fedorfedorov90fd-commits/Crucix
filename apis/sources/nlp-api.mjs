#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №15: МНОГОЯЗЫЧНЫЙ СМЫСЛОВОЙ АНАЛИЗ
// ============================================================

// ============================================================
// 1. ВСПОМОГАТЕЛЬНЫЕ ДАННЫЕ
// ============================================================

const LANGUAGES = {
    ru: { name: 'Русский', flag: '🇷🇺', native: 'Русский' },
    en: { name: 'English', flag: '🇬🇧', native: 'English' },
    zh: { name: '中文', flag: '🇨🇳', native: '中文' },
    hi: { name: 'हिन्दी', flag: '🇮🇳', native: 'हिन्दी' }
};

const SENTIMENT_KEYWORDS = {
    positive: {
        ru: ['хорошо', 'отлично', 'прекрасно', 'замечательно', 'успех', 'победа', 'лучший'],
        en: ['good', 'great', 'excellent', 'wonderful', 'success', 'victory', 'best'],
        zh: ['好', '优秀', '精彩', '成功', '胜利', '最好'],
        hi: ['अच्छा', 'उत्कृष्ट', 'शानदार', 'सफलता', 'विजय', 'सर्वश्रेष्ठ']
    },
    negative: {
        ru: ['плохо', 'ужасно', 'провал', 'кризис', 'война', 'атака', 'смерть'],
        en: ['bad', 'terrible', 'failure', 'crisis', 'war', 'attack', 'death'],
        zh: ['坏', '糟糕', '失败', '危机', '战争', '攻击', '死亡'],
        hi: ['बुरा', 'भयानक', 'असफलता', 'संकट', 'युद्ध', 'हमला', 'मृत्यु']
    }
};

const CATEGORIES = ['политика', 'экономика', 'военный', 'технологии', 'экология', 'здравоохранение', 'культура', 'спорт'];

// ============================================================
// 2. ОСНОВНЫЕ ФУНКЦИИ
// ============================================================

function detectLanguage(text) {
    if (!text || text.trim().length === 0) return { lang: 'unknown', confidence: 0 };

    const samples = {
        ru: /[а-яА-ЯёЁ]/,
        zh: /[\u4e00-\u9fff]/,
        hi: /[\u0900-\u097f]/,
        en: /[a-zA-Z]/
    };

    let detected = { lang: 'en', confidence: 0 };
    let totalChars = 0;

    for (const char of text) {
        const code = char.charCodeAt(0);
        if ((code >= 0x0400 && code <= 0x04FF) || (code >= 0x0500 && code <= 0x052F)) {
            // Cyrillic
            return { lang: 'ru', confidence: 95 };
        }
        if (code >= 0x4E00 && code <= 0x9FFF) {
            // Chinese
            return { lang: 'zh', confidence: 95 };
        }
        if (code >= 0x0900 && code <= 0x097F) {
            // Devanagari (Hindi)
            return { lang: 'hi', confidence: 95 };
        }
        if (code >= 0x0041 && code <= 0x007A) {
            // Latin
            totalChars++;
        }
    }

    if (totalChars > text.length * 0.5) {
        return { lang: 'en', confidence: 70 };
    }

    return { lang: 'unknown', confidence: 30 };
}

function translateText(text, targetLang) {
    // Демо-перевод (в реальности используем API)
    const translations = {
        ru: {
            'hello': 'привет',
            'world': 'мир',
            'security': 'безопасность',
            'war': 'война',
            'peace': 'мир',
            'economy': 'экономика',
            'technology': 'технологии',
            'crisis': 'кризис',
            'attack': 'атака',
            'defense': 'оборона'
        },
        en: {
            'привет': 'hello',
            'мир': 'world',
            'безопасность': 'security',
            'война': 'war',
            'экономика': 'economy',
            'технологии': 'technology',
            'кризис': 'crisis',
            'атака': 'attack',
            'оборона': 'defense'
        }
    };

    let translated = text;
    const dict = translations[targetLang] || {};
    for (const [key, value] of Object.entries(dict)) {
        translated = translated.replace(new RegExp(key, 'gi'), value);
    }

    return {
        original: text,
        targetLang: targetLang,
        translated: translated,
        confidence: 70
    };
}

function analyzeSentiment(text, lang = 'en') {
    let positiveScore = 0;
    let negativeScore = 0;
    const words = text.toLowerCase().split(/\s+/);

    const posKeywords = SENTIMENT_KEYWORDS.positive[lang] || SENTIMENT_KEYWORDS.positive.en;
    const negKeywords = SENTIMENT_KEYWORDS.negative[lang] || SENTIMENT_KEYWORDS.negative.en;

    for (const word of words) {
        if (posKeywords.some(k => word.includes(k))) positiveScore++;
        if (negKeywords.some(k => word.includes(k))) negativeScore++;
    }

    const total = positiveScore + negativeScore || 1;
    const score = (positiveScore - negativeScore) / total;

    let sentiment = 'neutral';
    let label = 'Нейтральный';
    let emoji = '😐';

    if (score > 0.3) {
        sentiment = 'positive';
        label = 'Позитивный';
        emoji = '😊';
    } else if (score < -0.3) {
        sentiment = 'negative';
        label = 'Негативный';
        emoji = '😟';
    }

    return {
        sentiment: sentiment,
        label: label,
        emoji: emoji,
        score: score,
        positiveScore: positiveScore,
        negativeScore: negativeScore,
        confidence: Math.min(90, 60 + Math.abs(score) * 30)
    };
}

function extractEntities(text) {
    const entities = [];
    const patterns = {
        person: /[А-Я][а-я]+\s[А-Я][а-я]+/g,
        location: /[А-Я][а-я]+(?:ская|ский|ское|ия|ов|ев)/g,
        organization: /[А-Я][А-Я]+\s[А-Я][а-я]+/g,
        date: /\d{4}-\d{2}-\d{2}/g,
        number: /\d+(?:\.\d+)?/g
    };

    for (const [type, pattern] of Object.entries(patterns)) {
        const matches = text.match(pattern);
        if (matches) {
            for (const match of matches) {
                entities.push({ type: type, value: match, confidence: 70 });
            }
        }
    }

    return entities;
}

function classifyText(text) {
    const categories = {
        'политика': ['президент', 'правительство', 'выборы', 'парламент', 'санкции', 'переговоры'],
        'экономика': ['рынок', 'цена', 'инфляция', 'валюта', 'акции', 'нефть', 'кризис'],
        'военный': ['война', 'армия', 'атака', 'оборона', 'ракета', 'солдаты', 'конфликт'],
        'технологии': ['AI', 'искусственный интеллект', 'технологии', 'цифровой', 'инновации'],
        'экология': ['климат', 'природа', 'загрязнение', 'экология', 'погода'],
        'здравоохранение': ['здоровье', 'болезнь', 'лечение', 'вирус', 'вакцина']
    };

    const scores = {};
    for (const [category, keywords] of Object.entries(categories)) {
        let score = 0;
        for (const keyword of keywords) {
            if (text.toLowerCase().includes(keyword)) score += 2;
        }
        scores[category] = score;
    }

    const bestCategory = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    const totalScore = Object.values(scores).reduce((s, v) => s + v, 0);

    return {
        category: bestCategory ? bestCategory[0] : 'unknown',
        confidence: bestCategory ? Math.min(90, (bestCategory[1] / (totalScore || 1)) * 100) : 0,
        scores: scores
    };
}

function fullAnalysis(text, lang = null) {
    if (!lang) {
        const detection = detectLanguage(text);
        lang = detection.lang;
    }

    const sentiment = analyzeSentiment(text, lang);
    const entities = extractEntities(text);
    const classification = classifyText(text);
    const wordCount = text.split(/\s+/).length;
    const charCount = text.length;

    return {
        text: text,
        lang: lang,
        wordCount: wordCount,
        charCount: charCount,
        sentiment: sentiment,
        entities: entities.slice(0, 10),
        classification: classification,
        timestamp: new Date().toISOString()
    };
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleNLPAPI(req, res) {
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
        // --- POST /api/nlp/detect ---
        if (path === '/api/nlp/detect' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const text = data.text || '';
                    const result = detectLanguage(text);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        ...result,
                        languageInfo: LANGUAGES[result.lang] || null
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // --- POST /api/nlp/translate ---
        if (path === '/api/nlp/translate' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const text = data.text || '';
                    const targetLang = data.targetLang || 'en';
                    const result = translateText(text, targetLang);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        ...result,
                        availableLanguages: Object.keys(LANGUAGES)
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // --- POST /api/nlp/sentiment ---
        if (path === '/api/nlp/sentiment' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const text = data.text || '';
                    const lang = data.lang || 'en';
                    const result = analyzeSentiment(text, lang);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        ...result,
                        text: text
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // --- POST /api/nlp/entities ---
        if (path === '/api/nlp/entities' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const text = data.text || '';
                    const entities = extractEntities(text);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        entities: entities,
                        count: entities.length
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // --- POST /api/nlp/classify ---
        if (path === '/api/nlp/classify' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const text = data.text || '';
                    const result = classifyText(text);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        ...result
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // --- POST /api/nlp/analyze ---
        if (path === '/api/nlp/analyze' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const text = data.text || '';
                    const lang = data.lang || null;
                    const result = fullAnalysis(text, lang);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        ...result
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // --- GET /api/nlp/languages ---
        if (path === '/api/nlp/languages' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                languages: LANGUAGES,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Неизвестный путь'
        }));

    } catch (error) {
        console.error('[NLP API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

export default { handleNLPAPI };
