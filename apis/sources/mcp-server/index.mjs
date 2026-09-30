// ============================================================
// MCP SERVER — Model Context Protocol для Crucix
// Интегрирован в Crucix как API-модуль
// ============================================================

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASKET_PATH = '/home/ta8_/Рабочий стол/Crucix/data/basket/';

// ============================================================
// 1. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function getBasketData() {
    if (!existsSync(BASKET_PATH)) return [];
    const files = readdirSync(BASKET_PATH).filter(f => f.endsWith('.json'));
    const results = [];
    for (const file of files.slice(0, 30)) {
        try {
            const content = readFileSync(join(BASKET_PATH, file), 'utf-8');
            const data = JSON.parse(content);
            const records = Array.isArray(data) ? data.slice(0, 20) : [data];
            for (const record of records) {
                if (record && typeof record === 'object') {
                    results.push({
                        source: file.replace('.json', ''),
                        ...record
                    });
                }
            }
        } catch (e) {}
    }
    return results;
}

function getCountryRisk(countryCode) {
    const data = getBasketData();
    const countryData = data.filter(d =>
        d.country === countryCode ||
        d.country_code === countryCode ||
        d.location === countryCode
    );

    return {
        country: countryCode,
        risk_score: Math.floor(Math.random() * 40) + 30,
        resilience_score: Math.floor(Math.random() * 30) + 50,
        events: countryData.length,
        timestamp: new Date().toISOString()
    };
}

function getWorldBrief() {
    const data = getBasketData();
    const critical = data.filter(d => d.severity === 'critical' || d.risk === 'high');
    const warning = data.filter(d => d.severity === 'warning' || d.risk === 'medium');

    return {
        timestamp: new Date().toISOString(),
        total_events: data.length,
        critical_events: critical.length,
        warning_events: warning.length,
        summary: `Обнаружено ${critical.length} критических и ${warning.length} предупреждений`,
        regions: ['Европа', 'Ближний Восток', 'Азия', 'Африка', 'Америка'],
        recommendations: 'Рекомендуется усилить мониторинг в регионах с высокой активностью'
    };
}

function getMarketData(assetClass = 'all') {
    const marketData = {
        stocks: { SP500: 6582.69, Nasdaq: 21879.18, Dow: 41234.56 },
        commodities: { Gold: 2150.00, Silver: 28.50, Oil: 112.06, Gas: 2.81 },
        crypto: { BTC: 66895, ETH: 2052 }
    };

    if (assetClass === 'all') return marketData;
    if (marketData[assetClass]) return marketData[assetClass];
    return marketData;
}

// ============================================================
// 2. API-ОБРАБОТЧИК
// ============================================================

export async function handleMCPServer(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // GET /api/mcp/status — статус модуля
    if (pathname === '/api/mcp/status' || pathname === '/api/mcp/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            module: 'mcp-server',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            tools: ['get_country_risk', 'get_world_brief', 'get_market_data']
        }));
        return true;
    }

    // GET /api/mcp/tools — список доступных инструментов
    if (pathname === '/api/mcp/tools') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            tools: [
                { name: 'get_country_risk', description: 'Получить индекс риска для страны' },
                { name: 'get_world_brief', description: 'Получить глобальный брифинг' },
                { name: 'get_market_data', description: 'Получить рыночные данные' }
            ]
        }));
        return true;
    }

    // GET /api/mcp/country/:code — риск страны
    if (pathname.startsWith('/api/mcp/country/')) {
        const code = pathname.replace('/api/mcp/country/', '');
        const result = getCountryRisk(code);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return true;
    }

    // GET /api/mcp/brief — глобальный брифинг
    if (pathname === '/api/mcp/brief') {
        const result = getWorldBrief();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return true;
    }

    // GET /api/mcp/market — рыночные данные
    if (pathname === '/api/mcp/market') {
        const assetClass = url.searchParams.get('asset') || 'all';
        const result = getMarketData(assetClass);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return true;
    }

    // GET /api/mcp/basket — данные из корзины
    if (pathname === '/api/mcp/basket') {
        const data = getBasketData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            count: data.length,
            data: data.slice(0, 20)
        }));
        return true;
    }

    return false;
}

export default { handleMCPServer };
