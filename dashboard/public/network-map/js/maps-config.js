// maps-config.js — Конфигурация Network Map
console.log('⚙️ MAPS-CONFIG.JS (network-map) загружен');

window.MAP_TYPES = window.MAP_TYPES || {};
window.MAP_TYPES.relations = ['flow', 'social'];

window.NetworkMapConfig = {
    graph: {
        force: 80,
        distance: 100,
        charge: -300,
        gravity: 0.05,
        velocityDecay: 0.8,
        maxIterations: 300
    },
    nodeTypes: {
        country: { shape: 'circle', color: '#58a6ff', radius: 18 },
        organization: { shape: 'square', color: '#f0883e', size: 28 },
        event: { shape: 'triangle', color: '#f85149', size: 20 },
        financial: { shape: 'diamond', color: '#3fb950', size: 22 }
    },
    edgeTypes: {
        flow: { color: '#30363d', width: 1.5, dashed: false },
        transaction: { color: '#3fb950', width: 2, dashed: false },
        control: { color: '#f0883e', width: 1.5, dashed: true },
        influence: { color: '#a371f7', width: 1.5, dashed: true }
    },
    apiRoutes: {
        'cyber-network': '/api/layers/cyber-network',
        'trade-routes': '/api/layers/trade-routes',
        'financial-flows': '/api/layers/financial-flows',
        'crypto-trace': '/api/layers/crypto-trace',
        'banking-network': '/api/layers/banking-network',
        'supply-chain': '/api/layers/supply-chain',
        'shell-companies': '/api/layers/shell-companies',
        'refugee-flows': '/api/layers/refugee-flows',
        'migration-network': '/api/layers/migration-network',
        'social-unrest': '/api/layers/social-unrest',
        'phone-network': '/api/layers/phone-network',
        'social-media-network': '/api/layers/social-media-network'
    }
};

window.getLayerConfig = function(layerId) {
    return window.NetworkMapConfig.apiRoutes[layerId] || null;
};
