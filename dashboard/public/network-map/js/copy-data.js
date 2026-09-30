// copy-data.js — Копирование данных графа (локальный)
console.log('📋 COPY-DATA.JS (network-map) загружен');

window.copyGraphData = function() {
    if (!window.NetworkMap || !window.NetworkMap.graphData) {
        showNotification('⚠️ Нет данных для копирования');
        return;
    }
    var text = JSON.stringify(window.NetworkMap.graphData, null, 2);
    navigator.clipboard.writeText(text).then(function() {
        showNotification('✅ Данные графа скопированы');
    }).catch(function() {
        showNotification('❌ Ошибка копирования');
    });
};
