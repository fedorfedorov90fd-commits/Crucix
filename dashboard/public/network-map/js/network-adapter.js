// ============================================================
// NETWORK-ADAPTER.JS — Адаптер API → граф (Network Map)
// ============================================================
// 3 формата входа:
//   1. { nodes: [...], edges: [...] }
//   2. [{ source, target, weight, type }, ...]
//   3. GeoJSON FeatureCollection
// Если API недоступен — generateDemo(layerId) даёт demo-граф.
// ============================================================

console.log('🔗 NETWORK-ADAPTER.JS загружен');

window.NetworkAdapter = {

    convert: function(apiData, layerId) {
        if (!apiData) return { nodes: [], edges: [] };

        if (apiData.nodes && apiData.edges) {
            return this.normalizeGraph(apiData);
        }

        if (Array.isArray(apiData) && apiData.length > 0 && apiData[0].source) {
            return this.fromEdgeList(apiData, layerId);
        }

        if (apiData.features) {
            return this.fromGeoJSON(apiData, layerId);
        }

        console.warn('[NetworkAdapter] Неизвестный формат данных для слоя:', layerId);
        return { nodes: [], edges: [] };
    },

    normalizeGraph: function(graph) {
        var nodes = graph.nodes.map(function(n) {
            return {
                id: n.id || n.name,
                label: n.name || n.label || n.id,
                type: n.type || 'country',
                weight: n.weight || 1,
                data: n.data || {}
            };
        });
        var edges = graph.edges.map(function(e) {
            return {
                source: e.source || e.from,
                target: e.target || e.to,
                weight: e.weight || 1,
                type: e.type || 'flow'
            };
        });
        return { nodes: nodes, edges: edges };
    },

    fromEdgeList: function(edges, layerId) {
        var nodeMap = {};
        edges.forEach(function(e) {
            if (!nodeMap[e.source]) nodeMap[e.source] = { id: e.source, label: e.source, type: 'country', weight: 0 };
            if (!nodeMap[e.target]) nodeMap[e.target] = { id: e.target, label: e.target, type: 'country', weight: 0 };
            nodeMap[e.source].weight++;
            nodeMap[e.target].weight++;
        });
        return {
            nodes: Object.values(nodeMap),
            edges: edges.map(function(e) {
                return { source: e.source, target: e.target, weight: e.weight || 1, type: e.type || 'flow' };
            })
        };
    },

    fromGeoJSON: function(geojson, layerId) {
        var nodes = geojson.features.map(function(f) {
            var coords = f.geometry && f.geometry.coordinates;
            var lat = Array.isArray(coords) ? coords[1] : 0;
            var lng = Array.isArray(coords) ? coords[0] : 0;
            return {
                id: f.properties && (f.properties.id || f.properties.name) || 'node_' + Math.random(),
                label: f.properties && (f.properties.name || f.properties.title) || 'Unknown',
                type: f.properties && f.properties.type || 'country',
                weight: f.properties && f.properties.weight || 1,
                lat: lat,
                lng: lng,
                data: f.properties || {}
            };
        });
        return { nodes: nodes, edges: [] };
    },

    // ============================================================
    // DEMO-ДАННЫЕ для всех 12 слоёв
    // ============================================================
    generateDemo: function(layerId) {
        var demos = {

            'cyber-network': {
                nodes: [
                    { id: 'RU', label: 'Россия', type: 'country' },
                    { id: 'US', label: 'США', type: 'country' },
                    { id: 'CN', label: 'Китай', type: 'country' },
                    { id: 'KP', label: 'КНДР', type: 'country' },
                    { id: 'IR', label: 'Иран', type: 'country' },
                    { id: 'UA', label: 'Украина', type: 'country' },
                    { id: 'BY', label: 'Беларусь', type: 'country' },
                    { id: 'C2-1', label: 'C2 Server #1', type: 'organization' },
                    { id: 'C2-2', label: 'C2 Server #2', type: 'organization' },
                    { id: 'C2-3', label: 'C2 Server #3', type: 'organization' },
                    { id: 'BOT-1', label: 'Ботнет A', type: 'organization' },
                    { id: 'BOT-2', label: 'Ботнет B', type: 'organization' },
                    { id: 'BOT-3', label: 'Ботнет C', type: 'organization' },
                    { id: 'APT-28', label: 'APT-28', type: 'organization' },
                    { id: 'APT-29', label: 'APT-29', type: 'organization' },
                    { id: 'Lazarus', label: 'Lazarus', type: 'organization' },
                    { id: 'Victim-EU', label: 'Цель: ЕС', type: 'event' },
                    { id: 'Victim-US', label: 'Цель: США', type: 'event' },
                    { id: 'Victim-UA', label: 'Цель: Украина', type: 'event' },
                    { id: 'Phish-1', label: 'Фишинг-кампания', type: 'event' }
                ],
                edges: [
                    { source: 'RU', target: 'C2-1', type: 'control', weight: 3 },
                    { source: 'CN', target: 'C2-1', type: 'flow', weight: 2 },
                    { source: 'KP', target: 'C2-1', type: 'control', weight: 4 },
                    { source: 'IR', target: 'C2-1', type: 'flow', weight: 1 },
                    { source: 'C2-1', target: 'BOT-1', type: 'control', weight: 5 },
                    { source: 'C2-2', target: 'BOT-2', type: 'control', weight: 4 },
                    { source: 'C2-3', target: 'BOT-3', type: 'control', weight: 3 },
                    { source: 'RU', target: 'APT-28', type: 'control', weight: 5 },
                    { source: 'CN', target: 'APT-29', type: 'control', weight: 5 },
                    { source: 'KP', target: 'Lazarus', type: 'control', weight: 5 },
                    { source: 'APT-28', target: 'C2-2', type: 'control', weight: 3 },
                    { source: 'APT-29', target: 'C2-3', type: 'control', weight: 3 },
                    { source: 'Lazarus', target: 'C2-1', type: 'control', weight: 3 },
                    { source: 'BOT-1', target: 'Victim-EU', type: 'flow', weight: 5 },
                    { source: 'BOT-1', target: 'Victim-US', type: 'flow', weight: 4 },
                    { source: 'BOT-2', target: 'Victim-EU', type: 'flow', weight: 3 },
                    { source: 'BOT-3', target: 'Victim-UA', type: 'flow', weight: 4 },
                    { source: 'APT-28', target: 'Phish-1', type: 'influence', weight: 3 },
                    { source: 'Phish-1', target: 'Victim-EU', type: 'flow', weight: 2 },
                    { source: 'UA', target: 'Victim-UA', type: 'flow', weight: 4 },
                    { source: 'BY', target: 'APT-28', type: 'flow', weight: 2 },
                    { source: 'US', target: 'Victim-US', type: 'flow', weight: 3 }
                ]
            },

            'trade-routes': {
                nodes: [
                    { id: 'CN', label: 'Китай', type: 'country' },
                    { id: 'US', label: 'США', type: 'country' },
                    { id: 'DE', label: 'Германия', type: 'country' },
                    { id: 'RU', label: 'Россия', type: 'country' },
                    { id: 'IN', label: 'Индия', type: 'country' },
                    { id: 'JP', label: 'Япония', type: 'country' },
                    { id: 'BR', label: 'Бразилия', type: 'country' },
                    { id: 'SA', label: 'Саудовская Аравия', type: 'country' },
                    { id: 'GB', label: 'Великобритания', type: 'country' },
                    { id: 'FR', label: 'Франция', type: 'country' },
                    { id: 'IT', label: 'Италия', type: 'country' },
                    { id: 'KR', label: 'Южная Корея', type: 'country' },
                    { id: 'MX', label: 'Мексика', type: 'country' },
                    { id: 'CA', label: 'Канада', type: 'country' },
                    { id: 'AU', label: 'Австралия', type: 'country' },
                    { id: 'Port-Shanghai', label: 'Порт Шанхай', type: 'organization' },
                    { id: 'Port-Rotterdam', label: 'Порт Роттердам', type: 'organization' },
                    { id: 'Port-Singapore', label: 'Порт Сингапур', type: 'organization' },
                    { id: 'Port-LA', label: 'Порт Лос-Анджелес', type: 'organization' },
                    { id: 'Suez', label: 'Суэцкий канал', type: 'event' },
                    { id: 'Panama', label: 'Панамский канал', type: 'event' }
                ],
                edges: [
                    { source: 'CN', target: 'Port-Shanghai', type: 'flow', weight: 5 },
                    { source: 'Port-Shanghai', target: 'Suez', type: 'flow', weight: 5 },
                    { source: 'Suez', target: 'Port-Rotterdam', type: 'flow', weight: 5 },
                    { source: 'Port-Rotterdam', target: 'DE', type: 'flow', weight: 5 },
                    { source: 'Port-Shanghai', target: 'Port-Singapore', type: 'flow', weight: 4 },
                    { source: 'Port-Shanghai', target: 'Port-LA', type: 'flow', weight: 3 },
                    { source: 'Port-LA', target: 'US', type: 'flow', weight: 5 },
                    { source: 'CN', target: 'US', type: 'transaction', weight: 5 },
                    { source: 'CN', target: 'DE', type: 'transaction', weight: 4 },
                    { source: 'CN', target: 'JP', type: 'transaction', weight: 4 },
                    { source: 'CN', target: 'KR', type: 'transaction', weight: 4 },
                    { source: 'US', target: 'DE', type: 'transaction', weight: 3 },
                    { source: 'US', target: 'MX', type: 'transaction', weight: 4 },
                    { source: 'US', target: 'CA', type: 'transaction', weight: 5 },
                    { source: 'RU', target: 'CN', type: 'transaction', weight: 3 },
                    { source: 'RU', target: 'IN', type: 'transaction', weight: 2 },
                    { source: 'IN', target: 'CN', type: 'transaction', weight: 3 },
                    { source: 'BR', target: 'CN', type: 'transaction', weight: 3 },
                    { source: 'SA', target: 'CN', type: 'transaction', weight: 5 },
                    { source: 'GB', target: 'US', type: 'transaction', weight: 4 },
                    { source: 'FR', target: 'DE', type: 'transaction', weight: 3 },
                    { source: 'IT', target: 'DE', type: 'transaction', weight: 3 },
                    { source: 'AU', target: 'CN', type: 'transaction', weight: 3 },
                    { source: 'Port-Singapore', target: 'Panama', type: 'flow', weight: 3 },
                    { source: 'Panama', target: 'US', type: 'flow', weight: 3 }
                ]
            },

            'financial-flows': {
                nodes: [
                    { id: 'US', label: 'США', type: 'country' },
                    { id: 'GB', label: 'Великобритания', type: 'country' },
                    { id: 'CH', label: 'Швейцария', type: 'country' },
                    { id: 'SG', label: 'Сингапур', type: 'country' },
                    { id: 'DE', label: 'Германия', type: 'country' },
                    { id: 'JP', label: 'Япония', type: 'country' },
                    { id: 'CN', label: 'Китай', type: 'country' },
                    { id: 'AE', label: 'ОАЭ', type: 'country' },
                    { id: 'LU', label: 'Люксембург', type: 'country' },
                    { id: 'IE', label: 'Ирландия', type: 'country' },
                    { id: 'HK', label: 'Гонконг', type: 'financial' },
                    { id: 'KY', label: 'Каймановы о-ва', type: 'financial' },
                    { id: 'BVI', label: 'Британские Виргинские о-ва', type: 'financial' },
                    { id: 'PA', label: 'Панама', type: 'financial' },
                    { id: 'JPM', label: 'JPMorgan', type: 'financial' },
                    { id: 'GS', label: 'Goldman Sachs', type: 'financial' },
                    { id: 'HSBC', label: 'HSBC', type: 'financial' },
                    { id: 'Citi', label: 'Citibank', type: 'financial' },
                    { id: 'SWIFT', label: 'SWIFT', type: 'organization' }
                ],
                edges: [
                    { source: 'JPM', target: 'GS', type: 'transaction', weight: 4 },
                    { source: 'JPM', target: 'Citi', type: 'transaction', weight: 3 },
                    { source: 'GS', target: 'HSBC', type: 'transaction', weight: 3 },
                    { source: 'HSBC', target: 'SWIFT', type: 'control', weight: 5 },
                    { source: 'Citi', target: 'SWIFT', type: 'control', weight: 5 },
                    { source: 'JPM', target: 'SWIFT', type: 'control', weight: 5 },
                    { source: 'US', target: 'KY', type: 'transaction', weight: 5 },
                    { source: 'US', target: 'BVI', type: 'transaction', weight: 5 },
                    { source: 'GB', target: 'BVI', type: 'transaction', weight: 5 },
                    { source: 'CH', target: 'LU', type: 'transaction', weight: 5 },
                    { source: 'SG', target: 'HK', type: 'transaction', weight: 4 },
                    { source: 'CN', target: 'HK', type: 'transaction', weight: 4 },
                    { source: 'AE', target: 'CH', type: 'transaction', weight: 3 },
                    { source: 'LU', target: 'IE', type: 'transaction', weight: 4 },
                    { source: 'IE', target: 'US', type: 'transaction', weight: 3 },
                    { source: 'KY', target: 'PA', type: 'transaction', weight: 4 },
                    { source: 'BVI', target: 'PA', type: 'transaction', weight: 4 },
                    { source: 'US', target: 'GB', type: 'transaction', weight: 5 },
                    { source: 'DE', target: 'CH', type: 'transaction', weight: 3 },
                    { source: 'JP', target: 'US', type: 'transaction', weight: 4 },
                    { source: 'CN', target: 'US', type: 'transaction', weight: 4 },
                    { source: 'SWIFT', target: 'US', type: 'control', weight: 5 }
                ]
            },

            'crypto-trace': {
                nodes: [
                    { id: 'BTC-1', label: 'BTC Wallet #1', type: 'financial' },
                    { id: 'BTC-2', label: 'BTC Wallet #2', type: 'financial' },
                    { id: 'ETH-1', label: 'ETH Wallet', type: 'financial' },
                    { id: 'XMR-1', label: 'Monero Wallet', type: 'financial' },
                    { id: 'USDT-1', label: 'USDT Wallet', type: 'financial' },
                    { id: 'Mix-1', label: 'Миксер A', type: 'organization' },
                    { id: 'Mix-2', label: 'Миксер B', type: 'organization' },
                    { id: 'Ex-1', label: 'Garantex', type: 'organization' },
                    { id: 'Ex-2', label: 'Binance', type: 'organization' },
                    { id: 'Ex-3', label: 'Huobi', type: 'organization' },
                    { id: 'Ex-4', label: 'OKX', type: 'organization' },
                    { id: 'Ex-5', label: 'DEX Uniswap', type: 'organization' },
                    { id: 'Tornado', label: 'Tornado Cash', type: 'organization' },
                    { id: 'Dark-1', label: 'Darknet Market', type: 'event' },
                    { id: 'Ransom-1', label: 'Ransomware Group', type: 'event' },
                    { id: 'Sanction-1', label: 'Под санкциями', type: 'event' }
                ],
                edges: [
                    { source: 'Ex-1', target: 'BTC-1', type: 'transaction', weight: 4 },
                    { source: 'Ex-1', target: 'USDT-1', type: 'transaction', weight: 5 },
                    { source: 'Ex-2', target: 'BTC-2', type: 'transaction', weight: 5 },
                    { source: 'Ex-3', target: 'ETH-1', type: 'transaction', weight: 4 },
                    { source: 'Ex-4', target: 'USDT-1', type: 'transaction', weight: 3 },
                    { source: 'Ex-5', target: 'ETH-1', type: 'transaction', weight: 4 },
                    { source: 'BTC-1', target: 'Mix-1', type: 'transaction', weight: 5 },
                    { source: 'BTC-2', target: 'Mix-2', type: 'transaction', weight: 5 },
                    { source: 'Mix-1', target: 'Tornado', type: 'transaction', weight: 5 },
                    { source: 'Mix-2', target: 'Tornado', type: 'transaction', weight: 4 },
                    { source: 'Tornado', target: 'ETH-1', type: 'transaction', weight: 4 },
                    { source: 'Tornado', target: 'XMR-1', type: 'transaction', weight: 3 },
                    { source: 'USDT-1', target: 'XMR-1', type: 'transaction', weight: 3 },
                    { source: 'Dark-1', target: 'BTC-1', type: 'transaction', weight: 4 },
                    { source: 'Ransom-1', target: 'XMR-1', type: 'transaction', weight: 5 },
                    { source: 'Sanction-1', target: 'Ex-1', type: 'influence', weight: 5 }
                ]
            },

            'banking-network': {
                nodes: [
                    { id: 'SWIFT', label: 'SWIFT', type: 'organization' },
                    { id: 'FED', label: 'Federal Reserve', type: 'financial' },
                    { id: 'ECB', label: 'ECB', type: 'financial' },
                    { id: 'BOE', label: 'Bank of England', type: 'financial' },
                    { id: 'BOJ', label: 'Bank of Japan', type: 'financial' },
                    { id: 'CBR', label: 'ЦБ РФ', type: 'financial' },
                    { id: 'PBoC', label: 'Народный банк Китая', type: 'financial' },
                    { id: 'RBI', label: 'Reserve Bank of India', type: 'financial' },
                    { id: 'VTB', label: 'ВТБ', type: 'organization' },
                    { id: 'Sber', label: 'Сбербанк', type: 'organization' },
                    { id: 'JPM', label: 'JPMorgan', type: 'organization' },
                    { id: 'HSBC', label: 'HSBC', type: 'organization' },
                    { id: 'ICBC', label: 'ICBC', type: 'organization' },
                    { id: 'BofA', label: 'Bank of America', type: 'organization' },
                    { id: 'Barclays', label: 'Barclays', type: 'organization' },
                    { id: 'Deutsche', label: 'Deutsche Bank', type: 'organization' },
                    { id: 'Sanctions', label: 'Санкции', type: 'event' }
                ],
                edges: [
                    { source: 'FED', target: 'SWIFT', type: 'control', weight: 5 },
                    { source: 'ECB', target: 'SWIFT', type: 'control', weight: 5 },
                    { source: 'BOE', target: 'SWIFT', type: 'control', weight: 5 },
                    { source: 'BOJ', target: 'SWIFT', type: 'control', weight: 4 },
                    { source: 'SWIFT', target: 'CBR', type: 'transaction', weight: 2 },
                    { source: 'SWIFT', target: 'PBoC', type: 'transaction', weight: 3 },
                    { source: 'SWIFT', target: 'RBI', type: 'transaction', weight: 3 },
                    { source: 'JPM', target: 'SWIFT', type: 'transaction', weight: 5 },
                    { source: 'HSBC', target: 'SWIFT', type: 'transaction', weight: 5 },
                    { source: 'ICBC', target: 'SWIFT', type: 'transaction', weight: 4 },
                    { source: 'BofA', target: 'SWIFT', type: 'transaction', weight: 5 },
                    { source: 'Barclays', target: 'SWIFT', type: 'transaction', weight: 4 },
                    { source: 'Deutsche', target: 'SWIFT', type: 'transaction', weight: 4 },
                    { source: 'VTB', target: 'CBR', type: 'transaction', weight: 5 },
                    { source: 'Sber', target: 'CBR', type: 'transaction', weight: 5 },
                    { source: 'VTB', target: 'Sanctions', type: 'influence', weight: 5 },
                    { source: 'CBR', target: 'PBoC', type: 'transaction', weight: 3 },
                    { source: 'PBoC', target: 'ICBC', type: 'transaction', weight: 4 }
                ]
            },

            'supply-chain': {
                nodes: [
                    { id: 'CN', label: 'Китай', type: 'country' },
                    { id: 'VN', label: 'Вьетнам', type: 'country' },
                    { id: 'DE', label: 'Германия', type: 'country' },
                    { id: 'US', label: 'США', type: 'country' },
                    { id: 'MX', label: 'Мексика', type: 'country' },
                    { id: 'JP', label: 'Япония', type: 'country' },
                    { id: 'KR', label: 'Южная Корея', type: 'country' },
                    { id: 'TW', label: 'Тайвань', type: 'country' },
                    { id: 'IN', label: 'Индия', type: 'country' },
                    { id: 'Port-Shanghai', label: 'Порт Шанхай', type: 'organization' },
                    { id: 'Port-Shenzhen', label: 'Порт Шэньчжэнь', type: 'organization' },
                    { id: 'Port-Rotterdam', label: 'Порт Роттердам', type: 'organization' },
                    { id: 'Port-LA', label: 'Порт Лос-Анджелес', type: 'organization' },
                    { id: 'Port-Busan', label: 'Порт Пусан', type: 'organization' },
                    { id: 'Suez', label: 'Суэцкий канал', type: 'event' },
                    { id: 'Taiwan-Strait', label: 'Тайваньский пролив', type: 'event' },
                    { id: 'Red-Sea', label: 'Красное море', type: 'event' }
                ],
                edges: [
                    { source: 'CN', target: 'Port-Shanghai', type: 'flow', weight: 5 },
                    { source: 'CN', target: 'Port-Shenzhen', type: 'flow', weight: 4 },
                    { source: 'Port-Shanghai', target: 'Suez', type: 'flow', weight: 5 },
                    { source: 'Suez', target: 'Port-Rotterdam', type: 'flow', weight: 5 },
                    { source: 'Port-Rotterdam', target: 'DE', type: 'flow', weight: 5 },
                    { source: 'Port-Shenzhen', target: 'Port-LA', type: 'flow', weight: 4 },
                    { source: 'Port-LA', target: 'US', type: 'flow', weight: 5 },
                    { source: 'Port-Shenzhen', target: 'Taiwan-Strait', type: 'flow', weight: 4 },
                    { source: 'Taiwan-Strait', target: 'Port-Busan', type: 'flow', weight: 4 },
                    { source: 'Port-Busan', target: 'KR', type: 'flow', weight: 4 },
                    { source: 'Taiwan-Strait', target: 'TW', type: 'flow', weight: 5 },
                    { source: 'Port-Shanghai', target: 'Red-Sea', type: 'flow', weight: 3 },
                    { source: 'Red-Sea', target: 'Port-Rotterdam', type: 'flow', weight: 3 },
                    { source: 'VN', target: 'CN', type: 'flow', weight: 3 },
                    { source: 'IN', target: 'Suez', type: 'flow', weight: 3 },
                    { source: 'MX', target: 'US', type: 'flow', weight: 4 },
                    { source: 'JP', target: 'Port-LA', type: 'flow', weight: 4 }
                ]
            },

            'shell-companies': {
                nodes: [
                    { id: 'BVI-1', label: 'BVI Holding #1', type: 'financial' },
                    { id: 'BVI-2', label: 'BVI Holding #2', type: 'financial' },
                    { id: 'CY-1', label: 'Cyprus Shell #1', type: 'financial' },
                    { id: 'CY-2', label: 'Cyprus Shell #2', type: 'financial' },
                    { id: 'PA-1', label: 'Panama Corp #1', type: 'financial' },
                    { id: 'PA-2', label: 'Panama Corp #2', type: 'financial' },
                    { id: 'SEY-1', label: 'Seychelles Ltd', type: 'financial' },
                    { id: 'LU-1', label: 'Luxembourg S.A.', type: 'financial' },
                    { id: 'HK-1', label: 'HK Holding', type: 'financial' },
                    { id: 'Ben-1', label: 'Бенефициар A', type: 'organization' },
                    { id: 'Ben-2', label: 'Бенефициар B', type: 'organization' },
                    { id: 'Ben-3', label: 'Бенефициар C', type: 'organization' },
                    { id: 'Bank-1', label: 'Банк-корреспондент', type: 'financial' },
                    { id: 'Bank-2', label: 'Офшорный банк', type: 'financial' },
                    { id: 'Lawyer-1', label: 'Юрфирма', type: 'organization' }
                ],
                edges: [
                    { source: 'Ben-1', target: 'BVI-1', type: 'control', weight: 5 },
                    { source: 'Ben-1', target: 'PA-1', type: 'control', weight: 4 },
                    { source: 'Ben-1', target: 'CY-1', type: 'control', weight: 4 },
                    { source: 'Ben-2', target: 'BVI-2', type: 'control', weight: 5 },
                    { source: 'Ben-2', target: 'CY-2', type: 'control', weight: 4 },
                    { source: 'Ben-3', target: 'LU-1', type: 'control', weight: 5 },
                    { source: 'Ben-3', target: 'HK-1', type: 'control', weight: 4 },
                    { source: 'BVI-1', target: 'CY-1', type: 'control', weight: 3 },
                    { source: 'BVI-2', target: 'CY-2', type: 'control', weight: 3 },
                    { source: 'CY-1', target: 'SEY-1', type: 'control', weight: 3 },
                    { source: 'CY-2', target: 'PA-2', type: 'control', weight: 3 },
                    { source: 'PA-1', target: 'Bank-1', type: 'transaction', weight: 4 },
                    { source: 'SEY-1', target: 'Bank-1', type: 'transaction', weight: 3 },
                    { source: 'PA-2', target: 'Bank-2', type: 'transaction', weight: 4 },
                    { source: 'LU-1', target: 'Bank-2', type: 'transaction', weight: 4 },
                    { source: 'HK-1', target: 'Bank-1', type: 'transaction', weight: 3 },
                    { source: 'Lawyer-1', target: 'BVI-1', type: 'influence', weight: 3 },
                    { source: 'Lawyer-1', target: 'PA-1', type: 'influence', weight: 3 }
                ]
            },

            'refugee-flows': {
                nodes: [
                    { id: 'UA', label: 'Украина', type: 'country' },
                    { id: 'PL', label: 'Польша', type: 'country' },
                    { id: 'DE', label: 'Германия', type: 'country' },
                    { id: 'CZ', label: 'Чехия', type: 'country' },
                    { id: 'RO', label: 'Румыния', type: 'country' },
                    { id: 'SY', label: 'Сирия', type: 'country' },
                    { id: 'TR', label: 'Турция', type: 'country' },
                    { id: 'LB', label: 'Ливан', type: 'country' },
                    { id: 'JO', label: 'Иордания', type: 'country' },
                    { id: 'AF', label: 'Афганистан', type: 'country' },
                    { id: 'PK', label: 'Пакистан', type: 'country' },
                    { id: 'IR', label: 'Иран', type: 'country' },
                    { id: 'SD', label: 'Судан', type: 'country' },
                    { id: 'EG', label: 'Египет', type: 'country' },
                    { id: 'LY', label: 'Ливия', type: 'country' },
                    { id: 'IT', label: 'Италия', type: 'country' },
                    { id: 'GR', label: 'Греция', type: 'country' },
                    { id: 'Camp-PL', label: 'Лагерь: Польша', type: 'event' },
                    { id: 'Camp-TR', label: 'Лагерь: Турция', type: 'event' },
                    { id: 'Camp-EG', label: 'Лагерь: Египет', type: 'event' }
                ],
                edges: [
                    { source: 'UA', target: 'PL', type: 'flow', weight: 5 },
                    { source: 'UA', target: 'RO', type: 'flow', weight: 4 },
                    { source: 'PL', target: 'DE', type: 'flow', weight: 5 },
                    { source: 'PL', target: 'CZ', type: 'flow', weight: 4 },
                    { source: 'RO', target: 'DE', type: 'flow', weight: 3 },
                    { source: 'SY', target: 'TR', type: 'flow', weight: 5 },
                    { source: 'SY', target: 'LB', type: 'flow', weight: 4 },
                    { source: 'SY', target: 'JO', type: 'flow', weight: 3 },
                    { source: 'AF', target: 'PK', type: 'flow', weight: 5 },
                    { source: 'AF', target: 'IR', type: 'flow', weight: 4 },
                    { source: 'SD', target: 'EG', type: 'flow', weight: 4 },
                    { source: 'SD', target: 'LY', type: 'flow', weight: 3 },
                    { source: 'EG', target: 'IT', type: 'flow', weight: 3 },
                    { source: 'LY', target: 'IT', type: 'flow', weight: 4 },
                    { source: 'TR', target: 'GR', type: 'flow', weight: 4 },
                    { source: 'TR', target: 'DE', type: 'flow', weight: 3 },
                    { source: 'PL', target: 'Camp-PL', type: 'flow', weight: 4 },
                    { source: 'TR', target: 'Camp-TR', type: 'flow', weight: 4 },
                    { source: 'EG', target: 'Camp-EG', type: 'flow', weight: 3 }
                ]
            },

            'migration-network': {
                nodes: [
                    { id: 'MX', label: 'Мексика', type: 'country' },
                    { id: 'US', label: 'США', type: 'country' },
                    { id: 'GT', label: 'Гватемала', type: 'country' },
                    { id: 'HN', label: 'Гондурас', type: 'country' },
                    { id: 'SV', label: 'Сальвадор', type: 'country' },
                    { id: 'IN', label: 'Индия', type: 'country' },
                    { id: 'AE', label: 'ОАЭ', type: 'country' },
                    { id: 'PH', label: 'Филиппины', type: 'country' },
                    { id: 'SA', label: 'Саудовская Аравия', type: 'country' },
                    { id: 'MA', label: 'Марокко', type: 'country' },
                    { id: 'FR', label: 'Франция', type: 'country' },
                    { id: 'DZ', label: 'Алжир', type: 'country' },
                    { id: 'TR', label: 'Турция', type: 'country' },
                    { id: 'PK', label: 'Пакистан', type: 'country' },
                    { id: 'BD', label: 'Бангладеш', type: 'country' },
                    { id: 'NP', label: 'Непал', type: 'country' },
                    { id: 'Corridor-1', label: 'Коридор: Мексика→США', type: 'event' },
                    { id: 'Corridor-2', label: 'Коридор: Залив', type: 'event' }
                ],
                edges: [
                    { source: 'MX', target: 'US', type: 'flow', weight: 5 },
                    { source: 'GT', target: 'MX', type: 'flow', weight: 4 },
                    { source: 'HN', target: 'GT', type: 'flow', weight: 4 },
                    { source: 'SV', target: 'GT', type: 'flow', weight: 3 },
                    { source: 'IN', target: 'AE', type: 'flow', weight: 5 },
                    { source: 'IN', target: 'US', type: 'flow', weight: 4 },
                    { source: 'IN', target: 'GB', type: 'flow', weight: 3 },
                    { source: 'PH', target: 'SA', type: 'flow', weight: 5 },
                    { source: 'PH', target: 'AE', type: 'flow', weight: 4 },
                    { source: 'PK', target: 'SA', type: 'flow', weight: 4 },
                    { source: 'BD', target: 'SA', type: 'flow', weight: 4 },
                    { source: 'NP', target: 'IN', type: 'flow', weight: 3 },
                    { source: 'MA', target: 'FR', type: 'flow', weight: 4 },
                    { source: 'DZ', target: 'FR', type: 'flow', weight: 3 },
                    { source: 'DZ', target: 'TR', type: 'flow', weight: 2 },
                    { source: 'MX', target: 'Corridor-1', type: 'flow', weight: 5 },
                    { source: 'Corridor-1', target: 'US', type: 'flow', weight: 5 },
                    { source: 'IN', target: 'Corridor-2', type: 'flow', weight: 4 },
                    { source: 'Corridor-2', target: 'AE', type: 'flow', weight: 4 }
                ]
            },

            'social-unrest': {
                nodes: [
                    { id: 'FR', label: 'Франция', type: 'country' },
                    { id: 'US', label: 'США', type: 'country' },
                    { id: 'IR', label: 'Иран', type: 'country' },
                    { id: 'BR', label: 'Бразилия', type: 'country' },
                    { id: 'IN', label: 'Индия', type: 'country' },
                    { id: 'GB', label: 'Великобритания', type: 'country' },
                    { id: 'DE', label: 'Германия', type: 'country' },
                    { id: 'ES', label: 'Испания', type: 'country' },
                    { id: 'IT', label: 'Италия', type: 'country' },
                    { id: 'Protest-Paris', label: 'Протест: Париж', type: 'event' },
                    { id: 'Protest-Teheran', label: 'Протест: Тегеран', type: 'event' },
                    { id: 'Protest-SaoPaulo', label: 'Протест: Сан-Паулу', type: 'event' },
                    { id: 'Protest-London', label: 'Протест: Лондон', type: 'event' },
                    { id: 'Protest-Berlin', label: 'Протест: Берлин', type: 'event' },
                    { id: 'Protest-Madrid', label: 'Протест: Мадрид', type: 'event' },
                    { id: 'Protest-Rome', label: 'Протест: Рим', type: 'event' },
                    { id: 'Strike-1', label: 'Забастовка', type: 'event' },
                    { id: 'Riot-1', label: 'Беспорядки', type: 'event' }
                ],
                edges: [
                    { source: 'FR', target: 'Protest-Paris', type: 'influence', weight: 5 },
                    { source: 'IR', target: 'Protest-Teheran', type: 'influence', weight: 5 },
                    { source: 'BR', target: 'Protest-SaoPaulo', type: 'influence', weight: 4 },
                    { source: 'GB', target: 'Protest-London', type: 'influence', weight: 5 },
                    { source: 'DE', target: 'Protest-Berlin', type: 'influence', weight: 4 },
                    { source: 'ES', target: 'Protest-Madrid', type: 'influence', weight: 4 },
                    { source: 'IT', target: 'Protest-Rome', type: 'influence', weight: 3 },
                    { source: 'Protest-Paris', target: 'Protest-Berlin', type: 'influence', weight: 3 },
                    { source: 'Protest-Paris', target: 'Protest-London', type: 'influence', weight: 4 },
                    { source: 'Protest-Berlin', target: 'Protest-Madrid', type: 'influence', weight: 3 },
                    { source: 'Protest-Madrid', target: 'Protest-Rome', type: 'influence', weight: 3 },
                    { source: 'US', target: 'Strike-1', type: 'influence', weight: 3 },
                    { source: 'IN', target: 'Riot-1', type: 'influence', weight: 4 },
                    { source: 'Protest-Paris', target: 'Strike-1', type: 'influence', weight: 2 }
                ]
            },

            'phone-network': {
                nodes: [
                    { id: 'UA-Kyiv', label: 'Киев', type: 'country' },
                    { id: 'UA-Lviv', label: 'Львов', type: 'country' },
                    { id: 'UA-Kharkiv', label: 'Харьков', type: 'country' },
                    { id: 'RU-Moscow', label: 'Москва', type: 'country' },
                    { id: 'RU-SPb', label: 'Санкт-Петербург', type: 'country' },
                    { id: 'BY-Minsk', label: 'Минск', type: 'country' },
                    { id: 'PL-Warsaw', label: 'Варшава', type: 'country' },
                    { id: 'DE-Berlin', label: 'Берлин', type: 'country' },
                    { id: 'TR-Istanbul', label: 'Стамбул', type: 'country' },
                    { id: 'IL-TelAviv', label: 'Тель-Авив', type: 'country' },
                    { id: 'US-NY', label: 'Нью-Йорк', type: 'country' },
                    { id: 'GB-London', label: 'Лондон', type: 'country' },
                    { id: 'Operator-1', label: 'Оператор A', type: 'organization' },
                    { id: 'Operator-2', label: 'Оператор B', type: 'organization' },
                    { id: 'Sat-1', label: 'Спутник связи', type: 'organization' }
                ],
                edges: [
                    { source: 'UA-Kyiv', target: 'UA-Lviv', type: 'flow', weight: 5 },
                    { source: 'UA-Kyiv', target: 'UA-Kharkiv', type: 'flow', weight: 5 },
                    { source: 'UA-Lviv', target: 'PL-Warsaw', type: 'flow', weight: 4 },
                    { source: 'UA-Kyiv', target: 'PL-Warsaw', type: 'flow', weight: 4 },
                    { source: 'UA-Kyiv', target: 'DE-Berlin', type: 'flow', weight: 3 },
                    { source: 'PL-Warsaw', target: 'DE-Berlin', type: 'flow', weight: 4 },
                    { source: 'RU-Moscow', target: 'RU-SPb', type: 'flow', weight: 5 },
                    { source: 'RU-Moscow', target: 'BY-Minsk', type: 'flow', weight: 5 },
                    { source: 'RU-Moscow', target: 'TR-Istanbul', type: 'flow', weight: 4 },
                    { source: 'RU-Moscow', target: 'IL-TelAviv', type: 'flow', weight: 3 },
                    { source: 'TR-Istanbul', target: 'IL-TelAviv', type: 'flow', weight: 3 },
                    { source: 'US-NY', target: 'GB-London', type: 'flow', weight: 5 },
                    { source: 'GB-London', target: 'DE-Berlin', type: 'flow', weight: 4 },
                    { source: 'US-NY', target: 'DE-Berlin', type: 'flow', weight: 3 },
                    { source: 'Operator-1', target: 'UA-Kyiv', type: 'control', weight: 4 },
                    { source: 'Operator-1', target: 'PL-Warsaw', type: 'control', weight: 3 },
                    { source: 'Operator-2', target: 'RU-Moscow', type: 'control', weight: 4 },
                    { source: 'Operator-2', target: 'BY-Minsk', type: 'control', weight: 3 },
                    { source: 'Sat-1', target: 'US-NY', type: 'control', weight: 5 },
                    { source: 'Sat-1', target: 'GB-London', type: 'control', weight: 4 }
                ]
            },

            'social-media-network': {
                nodes: [
                    { id: 'Twitter', label: 'Twitter/X', type: 'organization' },
                    { id: 'Telegram', label: 'Telegram', type: 'organization' },
                    { id: 'VK', label: 'VK', type: 'organization' },
                    { id: 'Weibo', label: 'Weibo', type: 'organization' },
                    { id: 'Facebook', label: 'Facebook', type: 'organization' },
                    { id: 'TikTok', label: 'TikTok', type: 'organization' },
                    { id: 'YouTube', label: 'YouTube', type: 'organization' },
                    { id: 'RU', label: 'Россия', type: 'country' },
                    { id: 'CN', label: 'Китай', type: 'country' },
                    { id: 'US', label: 'США', type: 'country' },
                    { id: 'IR', label: 'Иран', type: 'country' },
                    { id: 'UA', label: 'Украина', type: 'country' },
                    { id: 'Inf-1', label: 'Аккаунт A (1M)', type: 'event' },
                    { id: 'Inf-2', label: 'Аккаунт B (500k)', type: 'event' },
                    { id: 'Inf-3', label: 'Аккаунт C (2M)', type: 'event' },
                    { id: 'Botfarm-1', label: 'Ботоферма A', type: 'organization' },
                    { id: 'Botfarm-2', label: 'Ботоферма B', type: 'organization' },
                    { id: 'Narrative-1', label: 'Нарратив: конфликт', type: 'event' },
                    { id: 'Narrative-2', label: 'Нарратив: санкции', type: 'event' }
                ],
                edges: [
                    { source: 'Inf-1', target: 'Telegram', type: 'influence', weight: 5 },
                    { source: 'Inf-2', target: 'Twitter', type: 'influence', weight: 4 },
                    { source: 'Inf-3', target: 'TikTok', type: 'influence', weight: 5 },
                    { source: 'Telegram', target: 'RU', type: 'influence', weight: 4 },
                    { source: 'Twitter', target: 'US', type: 'influence', weight: 4 },
                    { source: 'Weibo', target: 'CN', type: 'influence', weight: 5 },
                    { source: 'VK', target: 'RU', type: 'influence', weight: 4 },
                    { source: 'Facebook', target: 'US', type: 'influence', weight: 4 },
                    { source: 'YouTube', target: 'US', type: 'influence', weight: 4 },
                    { source: 'TikTok', target: 'CN', type: 'influence', weight: 4 },
                    { source: 'Telegram', target: 'IR', type: 'influence', weight: 3 },
                    { source: 'Telegram', target: 'UA', type: 'influence', weight: 4 },
                    { source: 'Botfarm-1', target: 'Inf-1', type: 'influence', weight: 4 },
                    { source: 'Botfarm-1', target: 'Inf-2', type: 'influence', weight: 3 },
                    { source: 'Botfarm-2', target: 'Inf-3', type: 'influence', weight: 4 },
                    { source: 'Inf-1', target: 'Narrative-1', type: 'influence', weight: 5 },
                    { source: 'Inf-2', target: 'Narrative-2', type: 'influence', weight: 4 },
                    { source: 'Inf-3', target: 'Narrative-1', type: 'influence', weight: 4 }
                ]
            }
        };

        return demos[layerId] || { nodes: [], edges: [] };
    }
};

console.log('✅ NETWORK-ADAPTER.JS готов (12 demo-слоёв)');
