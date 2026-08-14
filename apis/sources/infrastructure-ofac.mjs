#!/usr/bin/env node

// ============================================================
// OFAC — САНКЦИИ (тестовая заглушка)
// ============================================================
// Временное решение для тестирования Модуля №8
// ============================================================

export async function handleOFACApi(req, res) {
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
        // --- GET /api/infrastructure/ofac/list ---
        if (path === '/api/infrastructure/ofac/list') {
            const testSanctions = [
                {
                    id: 'ofac-001',
                    name: 'Крымский мост',
                    altNames: ['Kerch Bridge', 'Crimean Bridge'],
                    type: 'infrastructure',
                    programs: ['UKRAINE-EO14065', 'UKRAINE-EO13685'],
                    dateAdded: '2022-02-24',
                    description: 'Строительство моста через Керченский пролив',
                    target_id: 'bridge-001'
                },
                {
                    id: 'ofac-002',
                    name: 'Энергосеть Украины',
                    altNames: ['Ukrenergo'],
                    type: 'infrastructure',
                    programs: ['UKRAINE-EO14065'],
                    dateAdded: '2022-02-24',
                    description: 'Государственная энергетическая компания Украины',
                    target_id: 'grid-001'
                },
                {
                    id: 'ofac-003',
                    name: 'АЭС Бушер',
                    altNames: ['Bushehr NPP'],
                    type: 'nuclear',
                    programs: ['IRAN-EO13876', 'IRAN-EO13902'],
                    dateAdded: '2020-09-21',
                    description: 'Атомная электростанция в Иране',
                    target_id: 'npp-002'
                },
                {
                    id: 'ofac-004',
                    name: 'Запорожская АЭС',
                    altNames: ['Zaporizhzhia NPP'],
                    type: 'nuclear',
                    programs: ['UKRAINE-EO14065'],
                    dateAdded: '2022-02-24',
                    description: 'Крупнейшая АЭС в Европе, временно под контролем РФ',
                    target_id: 'npp-001'
                }
            ];

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: testSanctions.length,
                sanctions: testSanctions,
                source: 'OFAC (test)',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- POST /api/infrastructure/ofac/check ---
        if (path === '/api/infrastructure/ofac/check') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const object = data.object;

                    if (!object) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Объект не передан' }));
                        return;
                    }

                    // Проверяем по ID или по имени
                    const sanctions = {
                        'bridge-001': { sanctioned: true, programs: ['UKRAINE-EO14065', 'UKRAINE-EO13685'], type: 'infrastructure' },
                        'grid-001': { sanctioned: true, programs: ['UKRAINE-EO14065'], type: 'infrastructure' },
                        'npp-001': { sanctioned: true, programs: ['UKRAINE-EO14065'], type: 'nuclear' },
                        'npp-002': { sanctioned: true, programs: ['IRAN-EO13876', 'IRAN-EO13902'], type: 'nuclear' }
                    };

                    const result = sanctions[object.id] || { sanctioned: false };

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        ...result,
                        details: result.sanctioned ? {
                            dateAdded: '2022-02-24',
                            description: 'Объект находится под санкциями'
                        } : null
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

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[OFAC API] Ошибка:', error);
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
    handleOFACApi
};
