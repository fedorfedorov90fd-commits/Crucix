#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №8: СЛОИ КРИТИЧЕСКОЙ ИНФРАСТРУКТУРЫ — API
// ============================================================
// Стратегическая цель: превзойти WorldMonitor
// Качество > скорость
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// Пути к данным
const OBJECTS_FILE = join(ROOT, 'data', 'infrastructure', 'objects.json');
const HISTORY_FILE = join(ROOT, 'data', 'infrastructure', 'history.json');
const RISK_FILE = join(ROOT, 'data', 'infrastructure', 'risks.json');

// Убеждаемся, что папка существует
async function ensureDir(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (e) {
        // Игнорируем, если папка уже есть
    }
}

// ============================================================
// 1. ЗАГРУЗКА И СОХРАНЕНИЕ ДАННЫХ
// ============================================================

async function loadObjects() {
    try {
        const data = await fs.readFile(OBJECTS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error('[Infrastructure] Ошибка загрузки объектов:', e.message);
        return { objects: [], lastUpdated: null };
    }
}

async function saveObjects(data) {
    await ensureDir(join(ROOT, 'data', 'infrastructure'));
    await fs.writeFile(OBJECTS_FILE, JSON.stringify(data, null, 2));
}

async function loadHistory() {
    try {
        const data = await fs.readFile(HISTORY_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return { history: [] };
    }
}

async function saveHistory(data) {
    await ensureDir(join(ROOT, 'data', 'infrastructure'));
    await fs.writeFile(HISTORY_FILE, JSON.stringify(data, null, 2));
}

// ============================================================
// 2. РАСЧЁТ ИНДЕКСА УЯЗВИМОСТИ
// ============================================================

function calculateVulnerability(object, externalData = {}) {
    let score = 0;
    let factors = [];

    // 1. Военные угрозы (0-3)
    let militaryRisk = 0;
    if (object.risks?.includes('military_attack')) militaryRisk += 2;
    if (object.risks?.includes('sabotage')) militaryRisk += 1.5;
    if (externalData.conflictNearby) militaryRisk += externalData.conflictNearby;
    militaryRisk = Math.min(militaryRisk, 3);
    factors.push({ name: 'Военные угрозы', value: militaryRisk, weight: 0.25 });

    // 2. Погодные риски (0-2)
    let weatherRisk = 0;
    if (object.risks?.includes('earthquake')) weatherRisk += 1.5;
    if (object.risks?.includes('typhoon')) weatherRisk += 1.5;
    if (object.risks?.includes('flood')) weatherRisk += 1;
    if (externalData.stormNearby) weatherRisk += externalData.stormNearby;
    weatherRisk = Math.min(weatherRisk, 2);
    factors.push({ name: 'Погодные риски', value: weatherRisk, weight: 0.2 });

    // 3. Санкции (0-2)
    let sanctionsRisk = 0;
    if (object.sanctions) sanctionsRisk += 1.5;
    if (externalData.sanctionsIntensity) sanctionsRisk += externalData.sanctionsIntensity;
    sanctionsRisk = Math.min(sanctionsRisk, 2);
    factors.push({ name: 'Санкции', value: sanctionsRisk, weight: 0.15 });

    // 4. Износ и состояние (0-1.5)
    let degradationRisk = 0;
    if (object.status === 'critical') degradationRisk += 1;
    if (object.status === 'warning') degradationRisk += 0.5;
    if (!object.operational) degradationRisk += 0.5;
    degradationRisk = Math.min(degradationRisk, 1.5);
    factors.push({ name: 'Износ/состояние', value: degradationRisk, weight: 0.15 });

    // 5. Каскадные эффекты (0-1.5)
    let cascadeRisk = 0;
    if (object.cascade && object.cascade.length > 0) {
        cascadeRisk = Math.min(object.cascade.length * 0.15, 1.5);
    }
    factors.push({ name: 'Каскадные эффекты', value: cascadeRisk, weight: 0.15 });

    // 6. Пожары рядом (0-1)
    let fireRisk = 0;
    if (externalData.fireNearby) {
        fireRisk = Math.min(externalData.fireNearby * 0.5, 1);
    }
    factors.push({ name: 'Пожары рядом', value: fireRisk, weight: 0.1 });

    // Расчёт общего индекса (0-10)
    const maxScore = 3 + 2 + 2 + 1.5 + 1.5 + 1; // = 11
    let total = 0;
    for (const f of factors) {
        total += f.value * f.weight * 10;
    }

    return {
        score: Math.min(10, Math.round(total * 10) / 10),
        factors: factors,
        details: {
            military: militaryRisk,
            weather: weatherRisk,
            sanctions: sanctionsRisk,
            degradation: degradationRisk,
            cascade: cascadeRisk,
            fire: fireRisk
        }
    };
}

// ============================================================
// 3. РАСЧЁТ КАСКАДНЫХ ЭФФЕКТОВ
// ============================================================

function getCascadeEffects(object, allObjects) {
    if (!object.cascade || object.cascade.length === 0) {
        return { affected: [], totalImpact: 0 };
    }

    const affected = [];
    let totalImpact = 0;

    for (const id of object.cascade) {
        const target = allObjects.find(o => o.id === id);
        if (target) {
            const impact = target.vulnerability || 5;
            affected.push({
                id: target.id,
                name: target.name,
                type: target.type,
                layer: target.layer,
                status: target.status,
                impact: Math.round(impact * 10) / 10
            });
            totalImpact += impact;
        }
    }

    return {
        affected: affected,
        totalImpact: Math.round(totalImpact * 10) / 10,
        riskLevel: totalImpact > 20 ? 'high' : totalImpact > 10 ? 'medium' : 'low'
    };
}

// ============================================================
// 4. AI-ПРОГНОЗ (ПРОСТАЯ ВЕРСИЯ, ИНТЕГРАЦИЯ С OLLAMA БУДЕТ ПОТОМ)
// ============================================================

function predictRisk(object, externalData = {}) {
    const vulnerability = calculateVulnerability(object, externalData);
    const baseRisk = vulnerability.score / 10;

    // Факторы, повышающие риск в ближайшие 48 часов
    let factor = 1;
    if (object.status === 'critical') factor += 0.3;
    if (externalData.conflictNearby > 1) factor += 0.15;
    if (externalData.fireNearby > 2) factor += 0.15;
    if (externalData.stormNearby > 1) factor += 0.1;

    const probability = Math.min(95, Math.round(baseRisk * factor * 100));

    let recommendation = 'Наблюдение';
    if (probability > 70) {
        recommendation = '🔴 НЕМЕДЛЕННЫЕ ДЕЙСТВИЯ: Усилить охрану, эвакуировать персонал';
    } else if (probability > 40) {
        recommendation = '🟡 ПОВЫШЕННОЕ ВНИМАНИЕ: Проверить системы защиты';
    } else {
        recommendation = '🟢 ШТАТНЫЙ РЕЖИМ: Плановый мониторинг';
    }

    return {
        objectId: object.id,
        probability: probability,
        timeframe: '48 часов',
        recommendation: recommendation,
        riskFactors: vulnerability.factors.filter(f => f.value > 1).map(f => f.name),
        confidence: Math.round((1 - (probability / 100)) * 70 + 20)
    };
}

// ============================================================
// 5. СТАТИСТИКА ПО ОБЪЕКТАМ
// ============================================================

function getStatistics(objects) {
    const stats = {
        total: objects.length,
        byLayer: {},
        byStatus: {
            normal: 0,
            warning: 0,
            critical: 0
        },
        byType: {},
        sanctions: 0,
        averageVulnerability: 0,
        criticalVulnerability: 0,
        highRiskObjects: []
    };

    let totalVuln = 0;
    let criticalVulnCount = 0;

    for (const obj of objects) {
        // По слоям
        if (!stats.byLayer[obj.layer]) stats.byLayer[obj.layer] = 0;
        stats.byLayer[obj.layer]++;

        // По статусам
        if (obj.status === 'normal') stats.byStatus.normal++;
        else if (obj.status === 'warning') stats.byStatus.warning++;
        else if (obj.status === 'critical') stats.byStatus.critical++;

        // По типам
        if (!stats.byType[obj.type]) stats.byType[obj.type] = 0;
        stats.byType[obj.type]++;

        // Санкции
        if (obj.sanctions) stats.sanctions++;

        // Уязвимость
        const vuln = obj.vulnerability || 0;
        totalVuln += vuln;
        if (vuln > 7) {
            criticalVulnCount++;
            stats.highRiskObjects.push({
                id: obj.id,
                name: obj.name,
                vulnerability: vuln,
                status: obj.status
            });
        }
    }

    stats.averageVulnerability = objects.length > 0 ? Math.round((totalVuln / objects.length) * 10) / 10 : 0;
    stats.criticalVulnerability = criticalVulnCount;

    // Сортировка по уязвимости
    stats.highRiskObjects.sort((a, b) => b.vulnerability - a.vulnerability);

    return stats;
}

// ============================================================
// 6. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleInfrastructureAPI(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        // Загружаем данные
        const data = await loadObjects();
        const objects = data.objects || [];

        // --- GET /api/infrastructure/objects ---
        if (path === '/api/infrastructure/objects' && req.method === 'GET') {
            const layer = url.searchParams.get('layer');
            const status = url.searchParams.get('status');
            let filtered = objects;

            if (layer) {
                filtered = filtered.filter(o => o.layer === layer);
            }
            if (status) {
                filtered = filtered.filter(o => o.status === status);
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: filtered.length,
                objects: filtered,
                lastUpdated: data.lastUpdated || null
            }));
            return;
        }

        // --- GET /api/infrastructure/object/:id ---
        if (path.startsWith('/api/infrastructure/object/') && req.method === 'GET') {
            const id = path.split('/').pop();
            const object = objects.find(o => o.id === id);

            if (!object) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Объект не найден' }));
                return;
            }

            // Добавляем каскадные эффекты
            const cascade = getCascadeEffects(object, objects);

            // Добавляем прогноз
            const predict = predictRisk(object, {
                conflictNearby: 0.5,
                fireNearby: 0
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                object: {
                    ...object,
                    cascade: cascade,
                    predict: predict
                }
            }));
            return;
        }

        // --- GET /api/infrastructure/layers ---
        if (path === '/api/infrastructure/layers' && req.method === 'GET') {
            const layers = {};
            for (const obj of objects) {
                if (!layers[obj.layer]) {
                    layers[obj.layer] = {
                        name: obj.layer,
                        count: 0,
                        objects: []
                    };
                }
                layers[obj.layer].count++;
                layers[obj.layer].objects.push({
                    id: obj.id,
                    name: obj.name,
                    status: obj.status
                });
            }

            const result = Object.values(layers);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                layers: result
            }));
            return;
        }

        // --- GET /api/infrastructure/status ---
        if (path === '/api/infrastructure/status' && req.method === 'GET') {
            const stats = getStatistics(objects);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                ...stats,
                lastUpdated: data.lastUpdated || null
            }));
            return;
        }

        // --- GET /api/infrastructure/risks ---
        if (path === '/api/infrastructure/risks' && req.method === 'GET') {
            const riskData = objects.map(obj => {
                const vuln = calculateVulnerability(obj);
                return {
                    id: obj.id,
                    name: obj.name,
                    layer: obj.layer,
                    status: obj.status,
                    coordinates: obj.coordinates,
                    vulnerability: vuln,
                    riskLevel: vuln.score > 7 ? 'critical' :
                               vuln.score > 5 ? 'high' :
                               vuln.score > 3 ? 'medium' : 'low'
                };
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                risks: riskData
            }));
            return;
        }

        // --- GET /api/infrastructure/cascade/:id ---
        if (path.startsWith('/api/infrastructure/cascade/') && req.method === 'GET') {
            const id = path.split('/').pop();
            const object = objects.find(o => o.id === id);

            if (!object) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Объект не найден' }));
                return;
            }

            const cascade = getCascadeEffects(object, objects);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                objectId: id,
                objectName: object.name,
                ...cascade
            }));
            return;
        }

        // --- GET /api/infrastructure/predict/:id ---
        if (path.startsWith('/api/infrastructure/predict/') && req.method === 'GET') {
            const id = path.split('/').pop();
            const object = objects.find(o => o.id === id);

            if (!object) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Объект не найден' }));
                return;
            }

            const predict = predictRisk(object);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                ...predict
            }));
            return;
        }

        // --- POST /api/infrastructure/update (принудительное обновление) ---
        if (path === '/api/infrastructure/update' && req.method === 'POST') {
            // Здесь будет обновление из внешних источников
            // Пока просто отмечаем время обновления
            data.lastUpdated = new Date().toISOString();
            await saveObjects(data);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Данные обновлены',
                lastUpdated: data.lastUpdated
            }));
            return;
        }

        // --- GET /api/infrastructure/export ---
        if (path === '/api/infrastructure/export' && req.method === 'GET') {
            const format = url.searchParams.get('format') || 'json';

            if (format === 'json') {
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="infrastructure_${new Date().toISOString().slice(0,10)}.json"`
                });
                res.end(JSON.stringify(data, null, 2));
                return;
            }

            if (format === 'csv') {
                let csv = 'id,name,type,layer,country,lat,lng,status,operational,vulnerability,sanctions\n';
                for (const obj of objects) {
                    csv += `${obj.id},"${obj.name}",${obj.type},${obj.layer},${obj.country},${obj.coordinates.lat},${obj.coordinates.lng},${obj.status},${obj.operational},${obj.vulnerability || 0},${obj.sanctions}\n`;
                }
                res.writeHead(200, {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="infrastructure_${new Date().toISOString().slice(0,10)}.csv"`
                });
                res.end(csv);
                return;
            }

            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Неизвестный формат' }));
            return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[Infrastructure] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

// ============================================================
// 7. ЭКСПОРТ
// ============================================================

export default {
    handleInfrastructureAPI,
    loadObjects,
    saveObjects,
    calculateVulnerability,
    getCascadeEffects,
    predictRisk,
    getStatistics
};