// cii.js — Country Instability Index (локальный)
console.log('📊 CII.JS (network-map) загружен');

window.updateCII = function() {
    var nodes = window.GraphView ? window.GraphView.getNodes() : [];
    if (nodes.length === 0) return;
    var components = window.Relations.findComponents({
        nodes: nodes,
        edges: window.GraphView ? window.GraphView.getEdges() : []
    });
    var cii = Math.round((1 / components.length) * 1000) / 10;
    console.log('[CII] Country Instability Index:', cii, 'Компонент:', components.length);
};
