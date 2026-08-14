#!/usr/bin/env node

// ============================================================
// AI-ПРОГНОЗ — Модуль №8
// ============================================================
// Прогнозирование рисков для объектов с интеграцией Ollama
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OBJECTS_FILE = join(ROOT, 'data', 'infrastructure', 'objects.json');

// ============================================================
// 1. ЗАГРУЗКА ДАННЫХ
// ============================================================

async function loadObjects() {
    try {
        const data = await fs.readFile(OBJECTS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return { objects: [] };
    }
}

// ============================================================
// 2. РАСЧЁТ ПРОГНОЗА (БЫСТРЫЙ, БЕЗ AI)
// ============================================================

function calculateRiskScore(object) {
    let score = 3;

    const vuln = object.vulnerability || 5;
    score += vuln * 0.5;

    if (object.status === 'critical') score += 3;
    else if (object.status === 'warning') score += 1.5;

    if (!object.operational) score += 2;
    if (object.sanctions) score += 1;

    if (object.risks) {
        if (object.risks.includes('military_attack')) score += 2;
        if (object.risks.includes('fire')) score += 1.5;
        if (object.risks.includes('cyber_attack')) score += 1;
        if (object.risks.includes('earthquake')) score += 1.5;
        if (object.risks.includes('flood')) score += 1;
    }

    if (object.cascade && object.cascade.length > 0) {
        score += object.cascade.length * 0.3;
    }

    return Math.min(10, Math.round(score * 10) / 10);
}

function getRiskLevel(score) {
    if (score > 7) return '🔴 КРИТИЧЕСКИЙ';
    if (score > 5) return '🟡 ВЫСОКИЙ';
    if (score > 3) return '🟢 СРЕДНИЙ';
    return '🟢 НИЗКИЙ';
}

function getRecommendation(score) {
    if (score > 7) {
        return 'НЕМЕДЛЕННЫЕ ДЕЙСТВИЯ: Усилить охрану, эвакуировать персонал, связаться с МЧС';
    }
    if (score > 5) {
        return 'Усилить наблюдение, проверить системы защиты, подготовить план эвакуации';
    }
    if (score > 3) {
        return 'Плановый мониторинг, регулярная проверка систем';
    }
    return 'Штатный режим, стандартное наблюдение';
}

function getPrediction(score, days = 7) {
    const predictions = [];
    for (let i = 1; i <= days; i++) {
        const decay = Math.max(0.5, 1 - (i * 0.04));
        const dayScore = Math.min(10, Math.round((score * decay) * 10) / 10);
        predictions.push({
            day: i,
            score: dayScore,
            riskLevel: getRiskLevel(dayScore)
        });
    }
    return predictions;
}

// ============================================================
// 3. ЗАПРОС К OLLAMA (БЕЗ ТАЙМАУТА!)
// ============================================================

async function getAIAnalysis(object) {
    try {
        const prompt = `
Ты — AI-аналитик по критической инфраструктуре. Проанализируй объект:

Название: ${object.name}
Тип: ${object.type}
Страна: ${object.country}
Статус: ${object.status}
Уязвимость: ${object.vulnerability}/10
Риски: ${object.risks?.join(', ') || 'нет'}
Работает: ${object.operational ? 'да' : 'нет'}
Санкции: ${object.sanctions ? 'да' : 'нет'}

Дай краткий анализ (2-3 предложения) о вероятности атаки или отказа в ближайшие 7 дней.
Ответь ТОЛЬКО текстом, без форматирования.
`;

        console.log(`[Predict] Запрос к Ollama для ${object.name}...`);

        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'deepseek-r1:1.5b',
                prompt: prompt,
                stream: false,
                temperature: 0.1,
                options: {
                    num_predict: 200
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama ошибка: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[Predict] Ответ от Ollama получен для ${object.name}`);
        return data.response || 'Анализ временно недоступен';
    } catch (error) {
        console.error('[Predict] Ollama ошибка:', error.message);
        return 'AI-анализ временно недоступен. Используются базовые расчёты.';
    }
}

// ============================================================
// 4. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handlePredictApi(req, res) {
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
        const data = await loadObjects();
        const objects = data.objects || [];

        // --- GET /api/infrastructure/predict/:id (БЫСТРЫЙ, БЕЗ AI) ---
        if (path.startsWith('/api/infrastructure/predict/') && !path.includes('/ai/')) {
            const id = path.split('/').pop();
            const object = objects.find(o => o.id === id);

            if (!object) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Объект не найден' }));
                return;
            }

            const riskScore = calculateRiskScore(object);
            const riskLevel = getRiskLevel(riskScore);
            const recommendation = getRecommendation(riskScore);
            const predictions = getPrediction(riskScore, 7);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                objectId: object.id,
                objectName: object.name,
                currentRisk: riskScore,
                riskLevel: riskLevel,
                recommendation: recommendation,
                predictions: predictions,
                aiAnalysis: 'Для AI-анализа используйте /api/infrastructure/predict/ai/' + object.id + ' (ожидание 3-5 минут)',
                factors: {
                    vulnerability: object.vulnerability || 5,
                    status: object.status,
                    operational: object.operational,
                    sanctions: object.sanctions,
                    risks: object.risks || [],
                    cascadeCount: object.cascade?.length || 0
                },
                confidence: riskScore > 7 ? 85 : riskScore > 5 ? 70 : 50,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/infrastructure/predict/ai/:id (ДОЛГИЙ, БЕЗ ТАЙМАУТА) ---
        if (path.startsWith('/api/infrastructure/predict/ai/')) {
            const id = path.split('/').pop();
            const object = objects.find(o => o.id === id);

            if (!object) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Объект не найден' }));
                return;
            }

            // НЕТ ТАЙМАУТА! Ждём сколько нужно
            console.log(`[Predict] Начат AI-анализ для ${object.name} (${object.id})`);
            const aiAnalysis = await getAIAnalysis(object);
            const riskScore = calculateRiskScore(object);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                objectId: object.id,
                objectName: object.name,
                currentRisk: riskScore,
                aiAnalysis: aiAnalysis,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- POST /api/infrastructure/predict/all (БЫСТРЫЙ) ---
        if (path === '/api/infrastructure/predict/all') {
            const results = [];
            for (const obj of objects) {
                const riskScore = calculateRiskScore(obj);
                results.push({
                    id: obj.id,
                    name: obj.name,
                    risk: riskScore,
                    level: getRiskLevel(riskScore),
                    status: obj.status
                });
            }

            results.sort((a, b) => b.risk - a.risk);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: results.length,
                predictions: results,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[Predict API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

export default { handlePredictApi };
