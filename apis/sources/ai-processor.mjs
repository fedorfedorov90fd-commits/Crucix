#!/usr/bin/env node

// ============================================================
// AI-PROCESSOR.MJS — Универсальный AI-обработчик для Crucix
// ============================================================
// Поддерживает 3 режима:
//   1. LOCAL — локальный AI (Ollama, Qwen/DeepSeek)
//   2. API — бесплатные AI-API (Hugging Face)
//   3. BASIC — базовые алгоритмы (без AI)
// ============================================================
// Интеграция: автоматически обрабатывает новости из корзины
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// ============================================================
// 1. КОНСТАНТЫ И НАСТРОЙКИ
// ============================================================

const CONFIG = {
    // Локальный AI (Ollama)
    ollama: {
        url: 'http://localhost:11434/api/generate',
        models: {
            primary: 'qwen3.5:7b',      // Лучшая для Crucix
            fallback: 'deepseek-r1:1.5b' // Если 7B не доступна
        },
        timeout: 30000 // 30 секунд
    },
    // API AI (Hugging Face)
    huggingface: {
        url: 'https://api-inference.huggingface.co/models/',
        models: {
            sentiment: 'distilbert-base-uncased-finetuned-sst-2-english',
            classification: 'facebook/bart-large-mnli',
            ner: 'dslim/bert-base-NER'
        },
        maxRequestsPerMonth: 30000 // Бесплатный лимит
    },
    // Базовые алгоритмы
    basic: {
        positiveWords: [
            'good', 'great', 'excellent', 'positive', 'growth', 'success',
            'peace', 'agreement', 'deal', 'victory', 'progress', 'recovery',
            'boost', 'surge', 'rally', 'upgrade', 'improve', 'strength'
        ],
        negativeWords: [
            'bad', 'war', 'crisis', 'collapse', 'danger', 'attack',
            'strike', 'missile', 'sanction', 'conflict', 'disaster',
            'crash', 'plunge', 'fall', 'decline', 'threat', 'risk'
        ],
        categories: {
            geopolitics: ['war', 'peace', 'sanctions', 'alliance', 'conflict', 'treaty'],
            economy: ['market', 'stock', 'oil', 'gold', 'dollar', 'inflation', 'trade'],
            technology: ['AI', 'tech', 'software', 'cyber', 'data', 'chip'],
            energy: ['oil', 'gas', 'nuclear', 'renewable', 'solar', 'wind'],
            health: ['virus', 'vaccine', 'disease', 'pandemic', 'hospital'],
            environment: ['climate', 'flood', 'fire', 'earthquake', 'storm']
        }
    }
};

// ============================================================
// 2. ОСНОВНОЙ КЛАСС AI-PROCESSOR
// ============================================================

class AIProcessor {
    constructor() {
        this.mode = null; // 'local' | 'api' | 'basic'
        this.model = null;
        this.stats = {
            processed: 0,
            local: 0,
            api: 0,
            basic: 0,
            errors: 0
        };
        this.cache = new Map(); // Кэш для повторяющихся запросов
    }

    // ============================================================
    // 2.1. ИНИЦИАЛИЗАЦИЯ И ОПРЕДЕЛЕНИЕ РЕЖИМА
    // ============================================================

    async init() {
        console.log('[AI-Processor] Инициализация...');

        // Проверяем локальный AI
        const localAvailable = await this.checkLocalAI();
        if (localAvailable) {
            this.mode = 'local';
            this.model = await this.getBestLocalModel();
            console.log(`[AI-Processor] Режим: LOCAL (модель: ${this.model})`);
            return;
        }

        // Проверяем API AI
        const apiAvailable = await this.checkAPI();
        if (apiAvailable) {
            this.mode = 'api';
            console.log('[AI-Processor] Режим: API (Hugging Face)');
            return;
        }

        // Базовый режим (без AI)
        this.mode = 'basic';
        console.log('[AI-Processor] Режим: BASIC (без AI)');
    }

    // ============================================================
    // 2.2. ПРОВЕРКА ДОСТУПНОСТИ РЕЖИМОВ
    // ============================================================

    async checkLocalAI() {
        try {
            const response = await fetch('http://localhost:11434/api/tags', {
                signal: AbortSignal.timeout(5000)
            });
            if (!response.ok) return false;
            const data = await response.json();
            return data.models && data.models.length > 0;
        } catch (e) {
            return false;
        }
    }

    async getBestLocalModel() {
        try {
            const response = await fetch('http://localhost:11434/api/tags');
            const data = await response.json();
            const models = data.models || [];
            // Ищем Qwen 7B
            const qwen = models.find(m => m.name.includes('qwen') && m.name.includes('7b'));
            if (qwen) return qwen.name;
            // Ищем DeepSeek 7B
            const deepseek = models.find(m => m.name.includes('deepseek') && m.name.includes('7b'));
            if (deepseek) return deepseek.name;
            // Используем любую доступную
            if (models.length > 0) return models[0].name;
            return 'deepseek-r1:1.5b'; // Fallback
        } catch (e) {
            return 'deepseek-r1:1.5b';
        }
    }

    async checkAPI() {
        const token = process.env.HF_TOKEN;
        if (!token) return false;
        // Проверяем, что токен валидный
        try {
            const response = await fetch('https://api-inference.huggingface.co/models', {
                headers: { Authorization: `Bearer ${token}` },
                signal: AbortSignal.timeout(5000)
            });
            return response.status === 200;
        } catch (e) {
            return false;
        }
    }

    // ============================================================
    // 2.3. ОСНОВНОЙ МЕТОД ОБРАБОТКИ (ВЫЗЫВАЕТСЯ ИЗ КОРЗИНЫ)
    // ============================================================

    async processItem(item) {
        this.stats.processed++;

        // Генерируем ключ кэша
        const cacheKey = this.generateCacheKey(item);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        let result;

        try {
            switch (this.mode) {
                case 'local':
                    result = await this.processLocal(item);
                    this.stats.local++;
                    break;
                case 'api':
                    result = await this.processAPI(item);
                    this.stats.api++;
                    break;
                case 'basic':
                default:
                    result = this.processBasic(item);
                    this.stats.basic++;
                    break;
            }

            // Добавляем метаданные об обработке
            result.processedBy = this.mode;
            result.processedAt = new Date().toISOString();
            result.processedModel = this.model || 'basic';

            // Кэшируем результат
            this.cache.set(cacheKey, result);

            return result;
        } catch (e) {
            this.stats.errors++;
            console.error(`[AI-Processor] Ошибка обработки:`, e.message);
            // В случае ошибки — базовый анализ
            return this.processBasic(item);
        }
    }

    // ============================================================
    // 2.4. РЕЖИМ 1: LOCAL AI (Ollama)
    // ============================================================

    async processLocal(item) {
        const text = this.prepareText(item);
        const prompt = this.buildPrompt(text);

        try {
            const response = await fetch(CONFIG.ollama.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.3,
                        num_predict: 500,
                        top_p: 0.9
                    }
                }),
                signal: AbortSignal.timeout(CONFIG.ollama.timeout)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return this.parseAIResponse(data.response);
        } catch (e) {
            console.error('[AI-Processor] Ошибка локального AI:', e.message);
            // Fallback на базовый режим
            return this.processBasic(item);
        }
    }

    buildPrompt(text) {
        return `
Ты — AI-аналитик OSINT-платформы Crucix. Проанализируй новость:

"${text}"

Ответь строго в формате JSON без пояснений:
{
  "sentiment": число от -1.0 (очень негативно) до 1.0 (очень позитивно),
  "importance": число от 0 до 10 (важность новости),
  "urgency": число от 0 до 10 (срочность),
  "credibility": число от 0 до 10 (достоверность источника),
  "categories": [массив строк, максимум 3 категории],
  "regions": [массив стран, максимум 3],
  "summary": "краткое резюме на русском (до 20 слов)",
  "tags": [массив ключевых тегов, максимум 5]
}`;
    }

    parseAIResponse(response) {
        try {
            // Пробуем найти JSON в ответе
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            // Если не удалось — используем базовый анализ
            return null;
        } catch (e) {
            return null;
        }
    }

    // ============================================================
    // 2.5. РЕЖИМ 2: API AI (Hugging Face)
    // ============================================================

    async processAPI(item) {
        const text = this.prepareText(item);
        const token = process.env.HF_TOKEN;

        try {
            // Запрос к модели для анализа тональности
            const sentimentResult = await this.callHFApi(
                CONFIG.huggingface.models.sentiment,
                text,
                token
            );

            // Запрос к модели для классификации
            const classificationResult = await this.callHFApi(
                CONFIG.huggingface.models.classification,
                text,
                token
            );

            return {
                sentiment: this.parseSentiment(sentimentResult),
                importance: this.parseImportance(classificationResult),
                urgency: this.parseUrgency(text),
                credibility: 7, // Базовое значение для API
                categories: this.parseCategories(classificationResult),
                regions: this.extractRegionsBasic(text),
                summary: this.generateSummary(text),
                tags: this.extractTagsBasic(text)
            };
        } catch (e) {
            console.error('[AI-Processor] Ошибка API:', e.message);
            return this.processBasic(item);
        }
    }

    async callHFApi(model, text, token) {
        const url = CONFIG.huggingface.url + model;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: text }),
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error(`HF API: ${response.status}`);
        }

        return response.json();
    }

    parseSentiment(result) {
        if (!result || !result[0]) return 0;
        const item = result[0];
        if (item.label === 'POSITIVE') return item.score;
        if (item.label === 'NEGATIVE') return -item.score;
        return 0;
    }

    parseImportance(result) {
        // Упрощённая интерпретация
        if (!result || !result[0]) return 5;
        const scores = result[0].map(r => r.score);
        const maxScore = Math.max(...scores);
        return Math.round(maxScore * 10);
    }

    // ============================================================
    // 2.6. РЕЖИМ 3: BASIC (БЕЗ AI)
    // ============================================================

    processBasic(item) {
        const text = this.prepareText(item);
        const words = text.toLowerCase().split(/\s+/);

        // Анализ тональности
        let sentiment = 0;
        for (const word of words) {
            if (CONFIG.basic.positiveWords.includes(word)) sentiment += 0.05;
            if (CONFIG.basic.negativeWords.includes(word)) sentiment -= 0.05;
        }
        sentiment = Math.min(Math.max(sentiment, -1), 1);

        // Определение важности (по длине и ключевым словам)
        let importance = Math.min(text.length / 100, 5);
        for (const word of words) {
            if (CONFIG.basic.negativeWords.includes(word)) importance += 0.3;
        }
        importance = Math.min(importance, 10);

        // Категории
        const categories = this.extractCategoriesBasic(text);

        // Регионы
        const regions = this.extractRegionsBasic(text);

        // Теги
        const tags = this.extractTagsBasic(text);

        return {
            sentiment,
            importance: Math.round(importance * 10) / 10,
            urgency: Math.round((importance / 10) * 5) / 10,
            credibility: 5, // Базовое значение для BASIC
            categories,
            regions,
            summary: this.generateSummary(text),
            tags
        };
    }

    // ============================================================
    // 2.7. ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ============================================================

    prepareText(item) {
        const parts = [];
        if (item.title) parts.push(item.title);
        if (item.description) parts.push(item.description);
        if (item.summary) parts.push(item.summary);
        if (item.content) parts.push(item.content);
        const text = parts.join(' ').replace(/\s+/g, ' ');
        return text.slice(0, 2000); // Ограничиваем длину
    }

    generateCacheKey(item) {
        const text = this.prepareText(item);
        return text.slice(0, 100); // Простой кэш по первым 100 символам
    }

    // --- Извлечение категорий ---
    extractCategoriesBasic(text) {
        const categories = [];
        const lowerText = text.toLowerCase();
        for (const [category, keywords] of Object.entries(CONFIG.basic.categories)) {
            let score = 0;
            for (const keyword of keywords) {
                if (lowerText.includes(keyword)) score++;
            }
            if (score > 0) categories.push(category);
        }
        return categories.slice(0, 3);
    }

    // --- Извлечение регионов (по списку стран) ---
    extractRegionsBasic(text) {
        const countries = [
            'Россия', 'Украина', 'США', 'Китай', 'Иран', 'Израиль',
            'Сирия', 'Турция', 'Саудовская Аравия', 'ОАЭ', 'Катар',
            'Великобритания', 'Франция', 'Германия', 'Индия', 'Пакистан'
        ];
        const found = [];
        const lowerText = text.toLowerCase();
        for (const country of countries) {
            if (lowerText.includes(country.toLowerCase())) {
                found.push(country);
            }
        }
        return found.slice(0, 3);
    }

    // --- Извлечение тегов ---
    extractTagsBasic(text) {
        const tags = [];
        const lowerText = text.toLowerCase();
        const importantWords = [
            'война', 'мир', 'санкции', 'нефть', 'газ', 'экономика',
            'рынок', 'акции', 'кризис', 'эскалация', 'переговоры'
        ];
        for (const word of importantWords) {
            if (lowerText.includes(word)) tags.push(word);
        }
        return tags.slice(0, 5);
    }

    // --- Генерация краткого резюме ---
    generateSummary(text) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
        if (sentences.length === 0) return text.slice(0, 100);
        return sentences[0].trim().slice(0, 100);
    }

    // ============================================================
    // 2.8. СТАТИСТИКА И УПРАВЛЕНИЕ
    // ============================================================

    getStats() {
        return {
            ...this.stats,
            mode: this.mode,
            model: this.model,
            cacheSize: this.cache.size,
            uptime: process.uptime()
        };
    }

    async clearCache() {
        this.cache.clear();
        console.log('[AI-Processor] Кэш очищен');
    }

    async saveStats() {
        const statsDir = join(ROOT, 'data', 'ai');
        await fs.mkdir(statsDir, { recursive: true });
        const statsFile = join(statsDir, 'stats.json');
        await fs.writeFile(statsFile, JSON.stringify(this.getStats(), null, 2));
    }
}

// ============================================================
// 3. API-ОБРАБОТЧИК ДЛЯ CRUCIX
// ============================================================

let processor = null;

export async function handleAIProcessorAPI(req, res) {
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

    // Инициализация процессора
    if (!processor) {
        processor = new AIProcessor();
        await processor.init();
    }

    // ============================================================
    // GET /api/ai-processor/status — статус
    // ============================================================
    if (path === '/api/ai-processor/status' && req.method === 'GET') {
        const stats = processor.getStats();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            mode: stats.mode,
            model: stats.model,
            stats: {
                processed: stats.processed,
                local: stats.local,
                api: stats.api,
                basic: stats.basic,
                errors: stats.errors,
                cacheSize: stats.cacheSize
            },
            uptime: stats.uptime
        }));
        return;
    }

    // ============================================================
    // POST /api/ai-processor/process — обработать новость
    // ============================================================
    if (path === '/api/ai-processor/process' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                if (!data.item) {
                    throw new Error('Поле "item" обязательно');
                }
                const result = await processor.processItem(data.item);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    result,
                    mode: processor.mode
                }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: e.message
                }));
            }
        });
        return;
    }

    // ============================================================
    // POST /api/ai-processor/batch — обработать несколько новостей
    // ============================================================
    if (path === '/api/ai-processor/batch' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                if (!data.items || !Array.isArray(data.items)) {
                    throw new Error('Поле "items" должно быть массивом');
                }
                const results = [];
                for (const item of data.items) {
                    const result = await processor.processItem(item);
                    results.push({ item, result });
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    results,
                    mode: processor.mode
                }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: e.message
                }));
            }
        });
        return;
    }

    // ============================================================
    // POST /api/ai-processor/clear-cache — очистить кэш
    // ============================================================
    if (path === '/api/ai-processor/clear-cache' && req.method === 'POST') {
        await processor.clearCache();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            message: 'Кэш очищен'
        }));
        return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        success: false,
        error: 'Неизвестный путь'
    }));
}

// ============================================================
// 4. ЭКСПОРТ ДЛЯ ИНТЕГРАЦИИ С КОРЗИНОЙ
// ============================================================

// Синглтон для использования в basket-api.mjs
let singletonProcessor = null;

export async function getProcessor() {
    if (!singletonProcessor) {
        singletonProcessor = new AIProcessor();
        await singletonProcessor.init();
    }
    return singletonProcessor;
}

// Обработчик для автоматической обработки новостей из корзины
export async function processBasketItems(items) {
    const processor = await getProcessor();
    const results = [];
    for (const item of items) {
        const result = await processor.processItem(item);
        results.push({ ...item, ...result });
    }
    return results;
}

// ============================================================
// 5. АВТОНОМНЫЙ ЗАПУСК (для тестирования)
// ============================================================

if (import.meta.url === `file://${process.argv[1]}`) {
    // Запуск при прямом вызове: node apis/sources/ai-processor.mjs
    const test = async () => {
        const p = new AIProcessor();
        await p.init();
        console.log('Режим:', p.mode);
        console.log('Модель:', p.model);

        const testItem = {
            id: 'test_001',
            title: 'Эскалация конфликта на Ближнем Востоке: удары по энергетической инфраструктуре',
            description: 'За последние 24 часа зафиксированы массированные удары по нефтяным объектам в регионе. Цены на нефть выросли на 5%...',
            source: 'Reuters',
            date: new Date().toISOString()
        };

        console.log('Обработка тестовой новости...');
        const result = await p.processItem(testItem);
        console.log('Результат:', JSON.stringify(result, null, 2));
        console.log('Статистика:', p.getStats());
    };

    test().catch(console.error);
}

export default AIProcessor;