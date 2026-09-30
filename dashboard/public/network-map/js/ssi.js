// ssi.js — Strategic Stress Index (локальный)
console.log('📊 SSI.JS (network-map) загружен');

window.calculateSSI = function() {
    var nodes = window.GraphView ? window.GraphView.getNodes() : [];
    var edges = window.GraphView ? window.GraphView.getEdges() : [];
    if (nodes.length === 0) return 0;
    var centrality = window.Relations.degreeCentrality({ nodes: nodes, edges: edges });
    var values = Object.values(centrality);
    var sum = values.reduce(function(a, b) { return a + b; }, 0);
    var ssi = Math.round((sum / values.length) * 100);
    console.log('[SSI] Strategic Stress Index:', ssi);
    return ssi;
};
