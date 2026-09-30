console.log('semantic-map.js загружен');
var SemanticMap = {
    init: function() {
        console.log('[SemanticMap] init');
        var layers = window.allLayers || [];
        console.log('[SemanticMap] слоёв: ' + layers.length);
    }
};
window.SemanticMap = SemanticMap;
console.log('semantic-map.js готов');
