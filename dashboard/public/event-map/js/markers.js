// ============================================================
//  EVENT MAP — MARKERS
//  Одна задача: рисовать точки Leaflet по данным слоя.
//  Читает: window.allLayers, window.CrucixState, window.CrucixRenderer.
//  Слушает: crucix:layer-enabled, crucix:layer-disabled.
//  Шлёт: crucix:marker-added, crucix:marker-removed.
//  Не определяет формат сам — это в renderer.js.
// ============================================================

(function() {
  'use strict';

  if (!window.CrucixState) window.CrucixState = {};
  if (!window.CrucixState.markersByLayer) window.CrucixState.markersByLayer = {};
  if (!window.CrucixState.layerCache) window.CrucixState.layerCache = {};

  var ERROR_RULES = (window.FORMATS_REGISTRY && window.FORMATS_REGISTRY.errorFormats) || {};

  function logMsg(msg) { console.log('[markers] ' + msg); }

  // --- Получить действие при ошибке по HTTP-коду ---
  function errorAction(httpStatus) {
    // 404 → skip_silent, 500 → skip_warn, 503 → skip_silent
    if (httpStatus === 404) return { action: 'skip_silent', notify: false };
    if (httpStatus === 500) return { action: 'skip_warn',   notify: true  };
    if (httpStatus === 503) return { action: 'skip_silent', notify: false };
    if (httpStatus >= 500)  return { action: 'skip_warn',   notify: true  };
    if (httpStatus >= 400)  return { action: 'skip_warn',   notify: true  };
    return { action: 'skip_warn', notify: true };
  }

  // --- Fetch данных слоя (по route!) ---
  async function fetchLayerData(layer) {
    if (window.CrucixState.layerCache[layer.id]) {
      return window.CrucixState.layerCache[layer.id];
    }

    // Используем layer.route — '/api/layers/acled', а не '/api/layers/acled-api'
    var url = layer.route || ('/api/layers/' + layer.id.replace(/-api$/, ''));

    var res;
    try {
      res = await fetch(url);
    } catch (e) {
      logMsg('сеть: ' + layer.id + ' → ' + e.message);
      if (typeof showNotification === 'function') showNotification('Слой ' + layer.name + ': нет сети', 'error');
      return null;
    }

    if (!res.ok) {
      var rule = errorAction(res.status);
      logMsg('HTTP ' + res.status + ' для ' + layer.id + ' → ' + rule.action);
      if (rule.notify && typeof showNotification === 'function') {
        showNotification('Слой ' + layer.name + ': HTTP ' + res.status, 'warn');
      }
      return null;
    }

    var data;
    try {
      data = await res.json();
    } catch (e) {
      logMsg('JSON error: ' + layer.id + ' → ' + e.message);
      if (typeof showNotification === 'function') showNotification('Слой ' + layer.name + ': битый ответ', 'error');
      return null;
    }

    window.CrucixState.layerCache[layer.id] = data;
    return data;
  }

  // --- Найти слой по id ---
  function getLayer(layerId) {
    if (!Array.isArray(window.allLayers)) return null;
    for (var i = 0; i < window.allLayers.length; i++) {
      if (window.allLayers[i].id === layerId) return window.allLayers[i];
    }
    return null;
  }

  // --- Отрисовать точки на Leaflet ---
  function drawPoints(layerId, points, layer) {
    if (!window.map) { logMsg('карта не готова'); return 0; }

    // Убрать старую группу
    removeLayer(layerId);

    var group = L.layerGroup();
    var color = (layer && layer.color) || '#4a5a6a';
    var maxMarkers = 500;
    var added = 0;

    for (var i = 0; i < points.length; i++) {
      if (added >= maxMarkers) break;
      var p = points[i];
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;

      var marker = L.circleMarker([p.lat, p.lng], {
        radius: 5,
        fillColor: p.color || color,
        color: p.color || color,
        fillOpacity: 0.75,
        weight: 1
      });

      var popup = '<b>' + (p.title || layer.name || layerId) + '</b>';
      if (p.category) popup += '<br>' + p.category;
      if (p.country)  popup += '<br>' + p.country;
      if (p.time)     popup += '<br>' + p.time;
      if (p.severity) popup += '<br>Severity: ' + p.severity;
      marker.bindPopup(popup);

      group.addLayer(marker);
      added++;
    }

    group.addTo(window.map);
    window.CrucixState.markersByLayer[layerId] = group;

    document.dispatchEvent(new CustomEvent('crucix:marker-added', {
      detail: { layerId: layerId, count: added }
    }));

    logMsg(layerId + ' → ' + added + ' точек');
    return added;
  }

  // --- Убрать группу слоя ---
  function removeLayer(layerId) {
    var g = window.CrucixState.markersByLayer[layerId];
    if (g && window.map) {
      window.map.removeLayer(g);
    }
    delete window.CrucixState.markersByLayer[layerId];
    document.dispatchEvent(new CustomEvent('crucix:marker-removed', {
      detail: { layerId: layerId }
    }));
  }

  // --- Обработчики событий ---
  async function onLayerEnabled(evt) {
    var layerId = evt && evt.detail && evt.detail.id;
    if (!layerId) return;

    var layer = getLayer(layerId);
    if (!layer) { logMsg('слой ' + layerId + ' не найден в allLayers'); return; }

    var data = await fetchLayerData(layer);
    if (!data) return;

    if (!window.CrucixRenderer || typeof window.CrucixRenderer.renderLayerResponse !== 'function') {
      logMsg('renderer не загружен'); return;
    }

    var result = window.CrucixRenderer.renderLayerResponse(layerId, data);
    if (result.dimension !== 'S' || !result.points || result.points.length === 0) {
      logMsg(layerId + ' → не S или пусто (' + (result.dimension || 'unknown') + ')');
      return;
    }

    drawPoints(layerId, result.points, layer);
  }

  function onLayerDisabled(evt) {
    var layerId = evt && evt.detail && evt.detail.id;
    if (layerId) removeLayer(layerId);
  }

  // --- Экспорт ---
  window.CrucixMarkers = {
    drawPoints: drawPoints,
    removeLayer: removeLayer,
    fetchLayerData: fetchLayerData
  };

  // --- Подписка на события ---
  document.addEventListener('crucix:layer-enabled', onLayerEnabled);
  document.addEventListener('crucix:layer-disabled', onLayerDisabled);

  logMsg('модуль загружен, ждёт crucix:layer-enabled');
})();
