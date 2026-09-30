console.log('maps-config.js загружен');
function getLayersForMap(mapType) {
    return window.allLayers || [];
}
window.getLayersForMap = getLayersForMap;
console.log('maps-config.js готов');
