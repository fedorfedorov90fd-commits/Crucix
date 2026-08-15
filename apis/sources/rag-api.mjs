#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №21: ВЕКТОРНАЯ ПАМЯТЬ И RAG-ПОИСК
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'rag');
const DOCS_FILE = join(DATA_DIR, 'documents.json');

// ============================================================
// 1. ДЕМО-ДАННЫЕ
// ============================================================

const DEMO_DOCUMENTS = [
    {
        id: 'doc-001',
        title: 'Глобальный индекс напряжённости 2026',
        content: 'Глобальный индекс напряжённости достиг 37 пунктов из 100. Основные факторы: военный конфликт в Украине, экономическая нестабильность, кибератаки.',
        category: 'analytics',
        source: 'Crucix Global Index',
        date: '2026-08-14',
        tags: ['индекс', 'напряжённость', 'глобальный']
    },
    {
        id: 'doc-002',
        title: 'Анализ киберугроз 2026',
        content: 'Зафиксировано 6 активных киберугроз: LockBit, APT28, BlackCat, ProxyLogon, QakBot, Log4j. Критический уровень угроз требует немедленного реагирования.',
        category: 'cyber',
        source: 'Crucix Cyber Intel',
        date: '2026-08-14',
        tags: ['киберугрозы', 'lockbit', 'apt28', 'безопасность']
    },
    {
        id: 'doc-003',
        title: 'Экономический обзор 2026',
        content: 'Инфляция в США составляет 0.47% в месячном исчислении. Уровень безработицы 4.3%. Ставка ФРС 3.64%. Индекс доллара 120.9.',
        category: 'economy',
        source: 'Crucix Economy',
        date: '2026-08-14',
        tags: ['экономика', 'инфляция', 'безработица', 'фрс']
    },
    {
        id: 'doc-004',
        title: 'Спутниковый мониторинг объектов',
        content: 'Спутниковые снимки показывают изменения у Запорожской АЭС, Крымского моста и Каховской ГЭС. Обнаружены новые строительства и повреждения.',
        category: 'satellite',
        source: 'Crucix Satellite',
        date: '2026-08-14',
        tags: ['спутники', 'аэс', 'инфраструктура', 'изменения']
    },
    {
        id: 'doc-005',
        title: 'Военная авиация: анализ активности',
        content: 'Обнаружено 12 рейсов, из них 7 военных. Аномалии: отсутствие транспондера у 3 рейсов, низкая высота у 1 рейса, высокая скорость у 1 рейса.',
        category: 'aviation',
        source: 'Crucix Aviation',
        date: '2026-08-14',
        tags: ['авиация', 'военные', 'аномалии']
    },
    {
        id: 'doc-006',
        title: 'Сценарии глобальной безопасности',
        content: 'Военная эскалация: +25 пунктов к индексу. Дипломатическое урегулирование: -15 пунктов. Экономический кризис: +35 пунктов. Кибератака: +20 пунктов.',
        category: 'scenarios',
        source: 'Crucix Scenarios',
        date: '2026-08-14',
        tags: ['сценарии', 'прогнозы', 'безопасность']
    },
    {
        id: 'doc-007',
        title: 'Морской трекинг: тёмные суда',
        content: 'Обнаружено 5 тёмных судов в акватории Чёрного моря. 2 подозрительных судна с санкционным грузом. Активизированы зоны скопления.',
        category: 'shipping',
        source: 'Crucix Shipping',
        date: '2026-08-14',
        tags: ['морской', 'тёмные суда', 'ais']
    },
    {
        id: 'doc-008',
        title: 'Аналитические центры: прогнозы 2026',
        content: 'ISW: затяжной конфликт в Украине. RAND: риск эскалации на Ближнем Востоке. IISS: рост военных бюджетов. CFR: напряжённость в Южно-Китайском море.',
        category: 'thinktanks',
        source: 'Crucix ThinkTanks',
        date: '2026-08-14',
        tags: ['аналитика', 'прогнозы', 'isw', 'rand']
    }
];

// ============================================================
// 2. РАБОТА С ДАННЫМИ
// ============================================================

async function ensureDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (e) {}
}

async function loadDocuments() {
    await ensureDir();
    try {
        const data = await fs.readFile(DOCS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return [...DEMO_DOCUMENTS];
    }
}

async function saveDocuments(docs) {
    await ensureDir();
    await fs.writeFile(DOCS_FILE, JSON.stringify(docs, null, 2));
}

function generateId() {
    return `doc-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function getEmbedding(text) {
    // Простая симуляция эмбеддингов (в реальности использовалась бы модель)
    const words = text.toLowerCase().split(/\s+/);
    const vector = [];
    const vocab = ['угроза', 'безопасность', 'экономика', 'война', 'мир', 'кризис', 'атака', 'спутник', 'индекс', 'анализ'];
    const wordSet = new Set(words);
    for (const v of vocab) {
        vector.push(wordSet.has(v) ? 1 : 0);
    }
    // Добавляем случайные значения для разнообразия
    while (vector.length < 64) {
        vector.push(Math.random() * 0.3);
    }
    return vector;
}

function cosineSimilarity(vec1, vec2) {
    let dot = 0, norm1 = 0, norm2 = 0;
    for (let i = 0; i < vec1.length; i++) {
        dot += vec1[i] * vec2[i];
        norm1 += vec1[i] * vec1[i];
        norm2 += vec2[i] * vec2[i];
    }
    return dot / (Math.sqrt(norm1) * Math.sqrt(norm2) || 1);
}

function searchDocuments(query, documents, limit = 5) {
    const queryVec = getEmbedding(query);
    const results = documents.map(doc => ({
        ...doc,
        similarity: cosineSimilarity(queryVec, getEmbedding(doc.content)),
        score: 0
    }));
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit).map(r => ({
        id: r.id,
        title: r.title,
        content: r.content,
        category: r.category,
        source: r.source,
        date: r.date,
        tags: r.tags,
        similarity: Math.round(r.similarity * 100)
    }));
}

function getContext(query, documents) {
    const results = searchDocuments(query, documents, 3);
    if (!results.length) return 'Нет релевантных документов.';
    let context = '';
    for (const r of results) {
        context += `[${r.title}] ${r.content}\n`;
    }
    return context;
}

function generateRAGResponse(query, context) {
    // Симуляция RAG-ответа (в реальности использовалась бы LLM)
    const responses = [
        `На основе анализа документов: ${context.substring(0, 100)}...`,
        `По вашему запросу найдена следующая информация: ${context.substring(0, 80)}...`,
        `Согласно данным из базы знаний: ${context.substring(0, 120)}...`
    ];
    return {
        query,
        context: context.substring(0, 200),
        response: responses[Math.floor(Math.random() * responses.length)],
        sources: results.map(r => r.title),
        confidence: Math.round(70 + Math.random() * 20)
    };
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleRAGAPI(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        const documents = await loadDocuments();

        // --- GET /api/rag/documents ---
        if (path === '/api/rag/documents' && req.method === 'GET') {
            const params = new URLSearchParams(url.search);
            const category = params.get('category');
            let filtered = documents;
            if (category && category !== 'all') {
                filtered = filtered.filter(d => d.category === category);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                documents: filtered,
                total: filtered.length,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- POST /api/rag/index ---
        if (path === '/api/rag/index' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const doc = {
                        id: generateId(),
                        title: data.title || 'Без названия',
                        content: data.content || '',
                        category: data.category || 'general',
                        source: data.source || 'user',
                        date: new Date().toISOString().slice(0,10),
                        tags: data.tags || [],
                        embedding: getEmbedding(data.content || '')
                    };
                    documents.push(doc);
                    await saveDocuments(documents);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        document: doc,
                        message: 'Документ добавлен в базу знаний'
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // --- POST /api/rag/search ---
        if (path === '/api/rag/search' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const query = data.query || '';
                    const limit = data.limit || 5;
                    const results = searchDocuments(query, documents, limit);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        query: query,
                        results: results,
                        count: results.length,
                        timestamp: new Date().toISOString()
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // --- POST /api/rag/query ---
        if (path === '/api/rag/query' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const query = data.query || '';
                    const context = getContext(query, documents);
                    const result = generateRAGResponse(query, context);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        ...result,
                        timestamp: new Date().toISOString()
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // --- DELETE /api/rag/document/:id ---
        if (path.startsWith('/api/rag/document/') && req.method === 'DELETE') {
            const id = path.split('/').pop();
            const index = documents.findIndex(d => d.id === id);
            if (index === -1) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Документ не найден' }));
                return;
            }
            const removed = documents.splice(index, 1);
            await saveDocuments(documents);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                document: removed[0],
                message: 'Документ удалён'
            }));
            return;
        }

        // --- GET /api/rag/stats ---
        if (path === '/api/rag/stats' && req.method === 'GET') {
            const categories = {};
            for (const d of documents) {
                if (!categories[d.category]) categories[d.category] = 0;
                categories[d.category]++;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                total: documents.length,
                categories: categories,
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
        console.error('[RAG API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

export default { handleRAGAPI };
