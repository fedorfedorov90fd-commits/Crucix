#!/usr/bin/env node

// ============================================================
// FIRMS — ПОЖАРЫ (тестовая заглушка)
// ============================================================
// Временное решение для тестирования Модуля №8
// ============================================================

export async function handleFIRMSApi(req, res) {
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
        // --- GET /api/infrastructure/firms/fires ---
        if (path === '/api/infrastructure/firms/fires') {
            const testFires = [
                {
                    id: 'firms-test-001',
                    lat: 47.5122,
                    lng: 34.8347,
                    frp: 85.3,
                    brightness: 320,
                    timestamp: new Date().toISOString(),
                    confidence: 'high',
                    type: 'fire',
                    source: 'FIRMS (test)',
                    distance_to_object: 0.5,
                    object_name: 'Запорожская АЭС'
                },
                {
                    id: 'firms-test-002',
                    lat: 47.4850,
                    lng: 34.8050,
                    frp: 45.6,
                    brightness: 280,
                    timestamp: new Date().toISOString(),
                    confidence: 'medium',
                    type: 'fire',
                    source: 'FIRMS (test)',
                    distance_to_object: 2.3,
                    object_name: 'Запорожская АЭС'
                },
                {
                    id: 'firms-test-003',
                    lat: 47.5320,
                    lng: 34.8620,
                    frp: 12.3,
                    brightness: 240,
                    timestamp: new Date().toISOString(),
                    confidence: 'low',
                    type: 'fire',
                    source: 'FIRMS (test)',
                    distance_to_object: 3.8,
                    object_name: 'Запорожская АЭС'
                },
                {
                    id: 'firms-test-004',
                    lat: 35.038,
                    lng: -85.056,
                    frp: 5.2,
                    brightness: 200,
                    timestamp: new Date().toISOString(),
                    confidence: 'low',
                    type: 'fire',
                    source: 'FIRMS (test)',
                    distance_to_object: 1.2,
                    object_name: 'АЭС Секвойя'
                },
                {
                    id: 'firms-test-005',
                    lat: 36.016,
                    lng: -114.738,
                    frp: 2.1,
                    brightness: 180,
                    timestamp: new Date().toISOString(),
                    confidence: 'low',
                    type: 'fire',
                    source: 'FIRMS (test)',
                    distance_to_object: 0.8,
                    object_name: 'ГЭС Гувер'
                },
                {
                    id: 'firms-test-006',
                    lat: 45.3084,
                    lng: 36.4968,
                    frp: 68.7,
                    brightness: 310,
                    timestamp: new Date().toISOString(),
                    confidence: 'high',
                    type: 'fire',
                    source: 'FIRMS (test)',
                    distance_to_object: 0.2,
                    object_name: 'Крымский мост'
                },
                {
                    id: 'firms-test-007',
                    lat: 46.7750,
                    lng: 33.3669,
                    frp: 92.1,
                    brightness: 340,
                    timestamp: new Date().toISOString(),
                    confidence: 'high',
                    type: 'fire',
                    source: 'FIRMS (test)',
                    distance_to_object: 0.1,
                    object_name: 'Каховская ГЭС'
                },
                {
                    id: 'firms-test-008',
                    lat: 49.5000,
                    lng: 30.5000,
                    frp: 35.4,
                    brightness: 260,
                    timestamp: new Date().toISOString(),
                    confidence: 'medium',
                    type: 'fire',
                    source: 'FIRMS (test)',
                    distance_to_object: 5.0,
                    object_name: 'Энергосеть Украины'
                }
            ];

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: testFires.length,
                fires: testFires,
                source: 'FIRMS (test)',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- POST /api/infrastructure/firms/threat?objectId=... ---
        if (path === '/api/infrastructure/firms/threat') {
            const params = new URLSearchParams(url.search);
            const objectId = params.get('objectId');

            if (!objectId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'objectId обязателен' }));
                return;
            }

            // Тестовые данные угроз
            const threats = {
                'npp-001': { hasThreat: true, count: 3, closestDistance: 0.5, maxFRP: 85.3, threatLevel: 'critical' },
                'npp-002': { hasThreat: false, count: 0, closestDistance: null, maxFRP: 0, threatLevel: 'none' },
                'npp-003': { hasThreat: false, count: 0, closestDistance: null, maxFRP: 0, threatLevel: 'none' },
                'bridge-001': { hasThreat: true, count: 1, closestDistance: 0.2, maxFRP: 68.7, threatLevel: 'critical' },
                'dam-001': { hasThreat: true, count: 1, closestDistance: 0.1, maxFRP: 92.1, threatLevel: 'critical' },
                'grid-001': { hasThreat: true, count: 1, closestDistance: 5.0, maxFRP: 35.4, threatLevel: 'warning' }
            };

            const threat = threats[objectId] || { hasThreat: false, count: 0, closestDistance: null, maxFRP: 0, threatLevel: 'none' };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                objectId: objectId,
                ...threat
            }));
            return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[FIRMS API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

// ============================================================
// 2. ЭКСПОРТ
// ============================================================

export default {
    handleFIRMSApi
};
