// MAPS-CONFIG.JS — Конфиг Forecast Map (v3.0, 16 слоёв)
console.log('MAPS-CONFIG.JS загружен (v3.0)');

const COLOR_SCHEMES = {
    RdBu5: ['#d7191c', '#fdae61', '#ffffbf', '#abd9e9', '#2c7bb6'],
    RdYlGn5: ['#d7191c', '#fdae61', '#ffffbf', '#a6d96a', '#1a9641'],
    BrBG5: ['#a6611a', '#dfc27d', '#f5f5f5', '#80cdc1', '#018571'],
    YlOrRd5: ['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026'],
    OrRd5: ['#fee8c8', '#fdbb84', '#e34a33', '#b30000', '#7a0177'],
    BuPu5: ['#edf8fb', '#b3cde3', '#8c96c6', '#8856a7', '#810f7c'],
    Blues5: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c']
};

var LAYER_OVERRIDES = {};
var layerIds = ['ssi','predict','war-preparation','crucix-pattern-life','anomalies',
    'crucix-anomalies-geo','cyber-attacks-threat','ddos-threat','malware-threat',
    'phishing-threat','ransomware-threat','cve-threat','ai-forecasts-api',
    'central-bank-predictor-api','social-briefing-api','social-briefing-engine-api'];
var palettes = ['RdYlGn5','RdBu5','RdYlGn5','BuPu5','BuPu5','BuPu5',
    'RdBu5','RdBu5','RdBu5','YlOrRd5','RdBu5','YlOrRd5',
    'RdBu5','RdBu5','YlOrRd5','YlOrRd5'];
layerIds.forEach(function(id, i) {
    LAYER_OVERRIDES[id] = { method: (id === 'crucix-pattern-life') ? 'jenks' : 'manual',
        breaks: [20, 40, 60, 80], palette: palettes[i] };
});

function getLayerConfig(layerId) {
    return LAYER_OVERRIDES[layerId] || { method: 'manual', breaks: [20, 40, 60, 80], palette: 'RdBu5' };
}
function getColorPalette(name) {
    return COLOR_SCHEMES[name] || COLOR_SCHEMES.RdBu5;
}

window.COLOR_SCHEMES = COLOR_SCHEMES;
window.LAYER_OVERRIDES = LAYER_OVERRIDES;
window.getLayerConfig = getLayerConfig;
window.getColorPalette = getColorPalette;
console.log('MAPS-CONFIG.JS готов (7 палитр, 16 переопределений)');
