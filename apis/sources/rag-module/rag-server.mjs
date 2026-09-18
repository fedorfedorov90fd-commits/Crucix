#!/usr/bin/env node

// ============================================================
// RAG-СЕРВЕР — Crucix RAG-модуль
// Версия: 1.0.0
// Порт: 3120
// ============================================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const PORT = process.env.PORT || 3120;
const BASKET_PATH = process.env.CRUCIX_BASKET_PATH || '/home/ta8_/Рабочий стол/Crucix/data/basket/';
const DATA_PATH = join(__dirname, 'rag_data');

if (!existsSync(DATA_PATH)) mkdirSync(DATA_PATH, { recursive: true });

import { searchInBasket, getBasketStats, getRelevantData } from './rag-indexer.mjs';
import {
    queryOllama,
    queryDeepSeekLocal,
    queryDeepSeekAPI,
    getAvailableEngines,
    queryFallback
} from './rag-ai-router.mjs';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

console.log(chalk.cyan('\n╔══════════════════════════════════════════╗'));
console.log(chalk.cyan('║   🧠 CRUCIX RAG-МОДУЛЬ v1.0.0       ║'));
console.log(chalk.cyan('╚══════════════════════════════════════════╝\n'));

console.log(chalk.gray(`📂 Корзина: ${BASKET_PATH}`));
console.log(chalk.gray(`📂 Данные: ${DATA_PATH}`));

const engines = await getAvailableEngines();
console.log(chalk.gray('\n🔍 Доступные AI-движки:'));
for (const [name, available] of Object.entries(engines)) {
    console.log(chalk.gray(`   ${available ? '✅' : '❌'} ${name}`));
}

// ============================================================
// API ЭНДПОИНТЫ
// ============================================================

app.get('/api/rag/status', (req, res) => {
    res.json({
        status: 'online',
        version: '1.0.0',
        basket: BASKET_PATH,
        engines: engines,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/rag/stats', async (req, res) => {
    try {
        const stats = await getBasketStats(BASKET_PATH);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/rag/search', async (req, res) => {
    try {
        const { query, limit = 20 } = req.body;
        if (!query) return res.status(400).json({ error: 'Не указан запрос' });
        const results = await searchInBasket(BASKET_PATH, query, limit);
        res.json({ query, count: results.length, results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/rag/query', async (req, res) => {
    try {
        const { query, context, useEngine, limit = 30 } = req.body;
        if (!query) return res.status(400).json({ error: 'Не указан запрос' });

        const relevantData = await getRelevantData(BASKET_PATH, query, limit);
        const aiContext = context || formatContext(relevantData);

        let answer = null;
        let usedEngine = 'fallback';
        let confidence = 0.5;

        const aiResult = await queryAI(query, aiContext, useEngine);
        if (aiResult && aiResult.answer) {
            answer = aiResult.answer;
            usedEngine = aiResult.engine;
            confidence = aiResult.confidence || 0.7;
        }

        if (!answer) {
            answer = await queryFallback(query, relevantData);
            usedEngine = 'fallback';
            confidence = 0.3;
        }

        res.json({
            query,
            answer,
            usedEngine,
            confidence,
            sources: relevantData.map(d => d.source).filter(Boolean),
            sourceCount: relevantData.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(chalk.red('[ERROR]'), error);
        res.status(500).json({
            error: error.message,
            answer: 'Извините, произошла ошибка при обработке запроса.'
        });
    }
});

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function formatContext(data) {
    if (!data || data.length === 0) {
        return 'Нет доступных данных по этому запросу.';
    }
    return data.map(d => {
        const title = d.title || d.name || 'Без названия';
        // БЕЗОПАСНОЕ ИЗВЛЕЧЕНИЕ КОНТЕНТА
        let content = d.content || d.description || d.text || '';
        if (typeof content !== 'string') {
            try {
                content = JSON.stringify(content);
            } catch (e) {
                content = String(content);
            }
        }
        const source = d.source || 'unknown';
        const snippet = content.length > 500 ? content.substring(0, 500) + '...' : content;
        return `[${source}] ${title}: ${snippet}`;
    }).join('\n\n');
}

async function queryAI(query, context, engine) {
    const available = await getAvailableEngines();
    const priority = engine === 'auto'
        ? ['ollama', 'deepseek-local', 'deepseek-api']
        : [engine];

    for (const eng of priority) {
        if (!available[eng]) continue;
        try {
            let result;
            switch (eng) {
                case 'ollama':
                    result = await queryOllama(query, context);
                    break;
                case 'deepseek-local':
                    result = await queryDeepSeekLocal(query, context);
                    break;
                case 'deepseek-api':
                    result = await queryDeepSeekAPI(query, context);
                    break;
                default:
                    continue;
            }
            if (result && result.answer) {
                return { ...result, engine: eng };
            }
        } catch (error) {
            console.warn(chalk.yellow(`[WARN] ${eng} failed:`, error.message));
        }
    }
    return null;
}

app.listen(PORT, () => {
    console.log(chalk.green(`\n✅ RAG-сервер запущен на порту ${PORT}`));
    console.log(chalk.gray(`   http://localhost:${PORT}/api/rag/status`));
    console.log(chalk.gray(`   http://localhost:${PORT}/api/rag/stats`));
    console.log(chalk.gray(`   POST http://localhost:${PORT}/api/rag/query`));
    console.log(chalk.gray(`   POST http://localhost:${PORT}/api/rag/search\n`));
});
