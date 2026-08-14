#!/usr/bin/env node

// ============================================================
// КАСКАДНЫЕ ЭФФЕКТЫ — Модуль №8
// ============================================================
// Расчёт влияния одного объекта на другие в реальном времени
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

async function saveObjects(data) {
    await fs.writeFile(OBJECTS_FILE, JSON.stringify(data, null, 2));
}

// ============================================================
// 2. РАСЧЁТ КАСКАДНЫХ ЭФФЕКТОВ
// ============================================================

function calculateCascade(object, allObjects) {
    if (!object.cascade || object.cascade.length === 0) {
        return { affected: [], totalImpact: 0, riskLevel: 'low' };
    }

    const affected = [];
    let totalImpact = 0;

    for (const id of object.cascade) {
        const target = allObjects.find(o => o.id === id);
        if (target) {
            // Расчёт влияния: статус объекта влияет на связанные
            let impact = target.vulnerability || 5;
            
            // Если объект критический — влияние усиливается
            if (object.status === 'critical') impact *= 1.5;
            else if (object.status === 'warning') impact *= 1.2;
            
            // Если объект не работает — влияние максимальное
            if (!object.operational) impact *= 1.3;

            affected.push({
                id: target.id,
                name: target.name,
                type: target.type,
                layer: target.layer,
                status: target.status,
                impact: Math.min(10, Math.round(impact * 10) / 10),
                statusChange: object.status === 'critical' ? 'warning' : 'normal'
            });
            totalImpact += impact;
        }
    }

    return {
        affected: affected,
        totalImpact: Math.min(10, Math.round(totalImpact * 10) / 10),
        riskLevel: totalImpact > 20 ? 'high' : totalImpact > 10 ? 'medium' : 'low'
    };
}

// ============================================================
// 3. ОБНОВЛЕНИЕ СТАТУСОВ СВЯЗАННЫХ ОБЪЕКТОВ
// ============================================================

function updateCascadeStatus(objectId, newStatus, allObjects) {
    const object = allObjects.find(o => o.id === objectId);
    if (!object) return { updated: [], message: 'Объект не найден' };

    const oldStatus = object.status;
    object.status = newStatus;
    object.lastUpdate = new Date().toISOString();

    // Находим объекты, которые зависят от этого
    const dependents = allObjects.filter(o => 
        o.cascade && o.cascade.includes(objectId)
    );

    const updated = [];
    for (const dep of dependents) {
        const cascadeResult = calculateCascade(dep, allObjects);
        
        // Если есть критические зависимости — меняем статус
        if (cascadeResult.totalImpact > 7 && dep.status !== 'critical') {
            dep.status = 'critical';
            dep.statusReason = `Каскадный эффект от ${object.name}`;
            updated.push({
                id: dep.id,
                name: dep.name,
                oldStatus: dep.status,
                newStatus: 'critical',
                reason: `Зависит от ${object.name} (${objectId})`
            });
        } else if (cascadeResult.totalImpact > 4 && dep.status === 'normal') {
            dep.status = 'warning';
            dep.statusReason = `Влияние от ${object.name}`;
            updated.push({
                id: dep.id,
                name: dep.name,
                oldStatus: dep.status,
                newStatus: 'warning',
                reason: `Влияние от ${object.name} (${objectId})`
            });
        }
    }

    return {
        updated: updated,
        message: `Статус ${object.name} обновлён: ${oldStatus} → ${newStatus}`,
        affectedCount: updated.length
    };
}

// ============================================================
// 4. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleCascadeApi(req, res) {
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

        // --- GET /api/infrastructure/cascade/:id ---
        if (path.startsWith('/api/infrastructure/cascade/')) {
            const id = path.split('/').pop();
            const object = objects.find(o => o.id === id);

            if (!object) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Объект не найден' }));
                return;
            }

            const cascade = calculateCascade(object, objects);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                objectId: id,
                objectName: object.name,
                ...cascade
            }));
            return;
        }

        // --- POST /api/infrastructure/cascade/update ---
        if (path === '/api/infrastructure/cascade/update') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const { objectId, status } = data;

                    if (!objectId || !status) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            success: false, 
                            error: 'objectId и status обязательны' 
                        }));
                        return;
                    }

                    const result = updateCascadeStatus(objectId, status, objects);
                    await saveObjects({ objects, lastUpdated: new Date().toISOString() });

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        ...result
                    }));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: e.message
                    }));
                }
            });
            return;
        }

        // --- GET /api/infrastructure/cascade/map ---
        if (path === '/api/infrastructure/cascade/map') {
            const cascadeMap = {};
            for (const obj of objects) {
                if (obj.cascade && obj.cascade.length > 0) {
                    cascadeMap[obj.id] = {
                        name: obj.name,
                        dependsOn: obj.cascade,
                        vulnerability: obj.vulnerability
                    };
                }
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                cascadeMap: cascadeMap,
                totalDependencies: Object.keys(cascadeMap).length
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[Cascade API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

export default { handleCascadeApi };