// ============================================================
//  EVENT MAP — AUTO REFRESH
//  Одна задача: периодическое обновление активных слоёв.
//  Читает: window.activeLayerIds, CrucixState, CrucixMarkers.
//  Не fetch сам — использует CrucixMarkers.fetchLayerData/drawPoints.
//  Не знает про SSI/CII/heat.
// ============================================================

(function() {
  'use strict';

  var refreshInterval = null;
  var countdown = 0;
  var intervalSec = 0;

  function logMsg(m) { console.log('[refresh] ' + m); }

  // --- Обратный отсчёт + триггер ---
  function tick() {
    countdown--;
    var el = document.getElementById('refresh-timer');
    if (el) el.textContent = countdown > 0 ? (countdown + 's') : '-';

    if (countdown <= 0) {
      countdown = intervalSec;
      refreshAll();
    }
  }

  // --- Запуск автообновления ---
  function startAutoRefresh(seconds) {
    stopAutoRefresh();
    seconds = parseInt(seconds, 10) || 0;
    intervalSec = seconds;

    if (seconds <= 0) {
      var el = document.getElementById('refresh-timer');
      if (el) el.textContent = 'Выкл';
      logMsg('автообновление выключено');
      return;
    }

    countdown = seconds;
    refreshInterval = setInterval(tick, 1000);

    var timerEl = document.getElementById('refresh-timer');
    if (timerEl) timerEl.textContent = countdown + 's';

    logMsg('автообновление: каждые ' + seconds + ' сек');
  }

  // --- Остановка ---
  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    countdown = 0;
  }

  // --- Обновить все активные слои ---
  async function refreshAll() {
    var active = window.activeLayerIds || new Set();
    var all = window.allLayers || [];
    var M = window.CrucixMarkers;
    var S = window.CrucixState || {};

    if (!M || typeof M.fetchLayerData !== 'function') {
      logMsg('CrucixMarkers не загружен');
      return;
    }

    logMsg('обновление ' + active.size + ' слоёв');
    var updated = 0;

    for (var i = 0; i < all.length; i++) {
      var layer = all[i];
      if (!active.has(layer.id)) continue;

      // Инвалидировать кэш
      if (S.layerCache) delete S.layerCache[layer.id];

      // Загрузить заново
      var data = await M.fetchLayerData(layer);
      if (!data) continue;

      // Перерисовать через renderer
      if (window.CrucixRenderer && typeof window.CrucixRenderer.renderLayerResponse === 'function') {
        var result = window.CrucixRenderer.renderLayerResponse(layer.id, data);
        if (result.dimension === 'S' && result.points && result.points.length > 0) {
          M.drawPoints(layer.id, result.points, layer);
          updated++;
        }
      }
    }

    if (typeof showNotification === 'function') {
      showNotification('Обновлено слоёв: ' + updated, 'info');
    }
    logMsg('обновлено ' + updated + ' слоёв');
  }

  // --- Обновить данные конкретного слоя ---
  async function refreshLayer(layerId) {
    var all = window.allLayers || [];
    var M = window.CrucixMarkers;
    var S = window.CrucixState || {};

    var layer = null;
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === layerId) { layer = all[i]; break; }
    }
    if (!layer || !M) return;

    if (S.layerCache) delete S.layerCache[layerId];
    var data = await M.fetchLayerData(layer);
    if (!data) return;

    if (window.CrucixRenderer && typeof window.CrucixRenderer.renderLayerResponse === 'function') {
      var result = window.CrucixRenderer.renderLayerResponse(layerId, data);
      if (result.dimension === 'S' && result.points && result.points.length > 0) {
        M.drawPoints(layerId, result.points, layer);
      }
    }
  }

  // --- Экспорт ---
  window.CrucixRefresh = {
    startAutoRefresh: startAutoRefresh,
    stopAutoRefresh: stopAutoRefresh,
    refreshAll: refreshAll,
    refreshLayer: refreshLayer,
    getInterval: function() { return intervalSec; }
  };

  // Алиасы для onclick в HTML
  window.startAutoRefresh = startAutoRefresh;
  window.stopAutoRefresh = stopAutoRefresh;
  window.refreshAll = refreshAll;

  logMsg('модуль загружен');
})();
