#!/usr/bin/env node

// ============================================================
// SHIPS — МОРСКИЕ ПОРТЫ (тестовая заглушка)
// ============================================================
// Временное решение для тестирования Модуля №8
// ============================================================

export async function handleShipsApi(req, res) {
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
        // --- GET /api/infrastructure/ships/ports ---
        if (path === '/api/infrastructure/ships/ports') {
            const testPorts = [
                {
                    id: 'ships-port-001',
                    name: 'Порт Шанхай',
                    type: 'seaport',
                    layer: 'transport',
                    country: 'Китай',
                    coordinates: { lat: 30.6189, lng: 121.9874 },
                    status: 'normal',
                    statusReason: 'Работает в штатном режиме',
                    capacity: 47.3,
                    unit: 'million TEU',
                    owner: 'Shanghai Port Group',
                    operational: true,
                    vulnerability: 4.2,
                    risks: ['typhoon', 'cyber_attack'],
                    cascade: ['logistics-001', 'industry-012'],
                    sanctions: false,
                    source: 'Ships (test)',
                    lastUpdate: new Date().toISOString()
                },
                {
                    id: 'ships-port-002',
                    name: 'Порт Сингапур',
                    type: 'seaport',
                    layer: 'transport',
                    country: 'Сингапур',
                    coordinates: { lat: 1.264, lng: 103.823 },
                    status: 'normal',
                    statusReason: 'Работает в штатном режиме',
                    capacity: 37.5,
                    unit: 'million TEU',
                    owner: 'PSA International',
                    operational: true,
                    vulnerability: 3.8,
                    risks: ['cyber_attack', 'piracy'],
                    cascade: ['logistics-002', 'industry-008'],
                    sanctions: false,
                    source: 'Ships (test)',
                    lastUpdate: new Date().toISOString()
                },
                {
                    id: 'ships-port-003',
                    name: 'Порт Роттердам',
                    type: 'seaport',
                    layer: 'transport',
                    country: 'Нидерланды',
                    coordinates: { lat: 51.9225, lng: 4.4792 },
                    status: 'warning',
                    statusReason: 'Снижение грузооборота, кибератаки',
                    capacity: 14.5,
                    unit: 'million TEU',
                    owner: 'Port of Rotterdam Authority',
                    operational: true,
                    vulnerability: 5.6,
                    risks: ['cyber_attack', 'flood', 'labor_strike'],
                    cascade: ['logistics-003', 'energy-eu'],
                    sanctions: false,
                    source: 'Ships (test)',
                    lastUpdate: new Date().toISOString()
                },
                {
                    id: 'ships-port-004',
                    name: 'Порт Хьюстон',
                    type: 'seaport',
                    layer: 'transport',
                    country: 'США',
                    coordinates: { lat: 29.7604, lng: -95.3698 },
                    status: 'normal',
                    statusReason: 'Работает в штатном режиме',
                    capacity: 3.1,
                    unit: 'million TEU',
                    owner: 'Port Houston Authority',
                    operational: true,
                    vulnerability: 4.5,
                    risks: ['hurricane', 'oil_spill'],
                    cascade: ['energy-texas', 'industry-005'],
                    sanctions: false,
                    source: 'Ships (test)',
                    lastUpdate: new Date().toISOString()
                },
                {
                    id: 'ships-port-005',
                    name: 'Порт Одесса',
                    type: 'seaport',
                    layer: 'transport',
                    country: 'Украина',
                    coordinates: { lat: 46.4825, lng: 30.7233 },
                    status: 'critical',
                    statusReason: 'Блокада, постоянные обстрелы, повреждения',
                    capacity: 0.5,
                    unit: 'million TEU',
                    owner: 'Украинское Дунайское пароходство',
                    operational: false,
                    vulnerability: 9.2,
                    risks: ['military_attack', 'blockade', 'mine_risk'],
                    cascade: ['logistics-ukraine', 'agriculture-001'],
                    sanctions: false,
                    source: 'Ships (test)',
                    lastUpdate: new Date().toISOString()
                },
                {
                    id: 'ships-port-006',
                    name: 'Порт Мариуполь',
                    type: 'seaport',
                    layer: 'transport',
                    country: 'Украина',
                    coordinates: { lat: 47.0975, lng: 37.5433 },
                    status: 'critical',
                    statusReason: 'Разрушен, под контролем РФ',
                    capacity: 0,
                    unit: 'million TEU',
                    owner: 'Неизвестно',
                    operational: false,
                    vulnerability: 9.5,
                    risks: ['military_attack', 'destruction', 'occupation'],
                    cascade: ['logistics-ukraine', 'steel-001'],
                    sanctions: true,
                    source: 'Ships (test)',
                    lastUpdate: new Date().toISOString()
                }
            ];

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: testPorts.length,
                ports: testPorts,
                source: 'Ships (test)',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/infrastructure/ships/status ---
        if (path === '/api/infrastructure/ships/status') {
            const testPorts = [
                { status: 'normal' },
                { status: 'normal' },
                { status: 'warning' },
                { status: 'normal' },
                { status: 'critical' },
                { status: 'critical' }
            ];

            const stats = {
                total: testPorts.length,
                critical: testPorts.filter(p => p.status === 'critical').length,
                warning: testPorts.filter(p => p.status === 'warning').length,
                normal: testPorts.filter(p => p.status === 'normal').length
            };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                ...stats,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[Ships API] Ошибка:', error);
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
    handleShipsApi
};
