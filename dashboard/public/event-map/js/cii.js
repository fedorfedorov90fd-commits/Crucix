// ============================================================
//  EVENT MAP — CII (Conflict Intensity Index)
//  Одна задача: считать CII по конфликтным слоям.
//  Читает: window.CrucixState, window.activeLayerIds, window.allLayers.
//  Слушает: crucix:layer-toggled, crucix:marker-added, crucix:marker-removed.
//  Шлёт: crucix:cii-updated.
//  Не fetch (в отличие от SSI). Не знает про SSI/heat/timeline.
// ============================================================

(function() {
  'use strict';

  // Категории, которые считаются "конфликтными" для CII
  var CONFLICT_CATEGORIES = ['military', 'geopolitical', 'threats', 'cyber'];

  var ciiVisible = false;
  var currentCII = 0;

  function logMsg(m) { console.log('[cii] ' + m); }

  // --- Показать/скрыть панель CII ---
  function toggleCII() {
    var panel = document.getElementById('cii-panel');
    if (panel) {
      panel.remove();
      ciiVisible = false;
      return;
    }

    ciiVisible = true;
    panel = document.createElement('div');
    panel.id = 'cii-panel';
    panel.className = 'cii-panel';
    panel.innerHTML =
      '<div class="cii-title">CII</div>' +
      '<div class="cii-value" id="cii-value">0</div>' +
      '<div class="cii-desc">Conflict Intensity Index — по конфликтным слоям</div>';
    document.body.appendChild(panel);
    updateCII();
  }

  // --- Подсчёт маркеров в конфликтных слоях ---
  function countConflictMarkers() {
    var total = 0;
    var S = window.CrucixState || {};
    var groups = S.markersByLayer || {};
    var active = window.activeLayerIds || new Set();
    var all = window.allLayers || [];

    // Карта: layerId → категория
    var catById = {};
    for (var i = 0; i < all.length; i++) catById[all[i].id] = all[i].category;

    Object.keys(groups).forEach(function(layerId) {
      if (!active.has(layerId)) return;
      var cat = catById[layerId] || 'other';
      if (CONFLICT_CATEGORIES.indexOf(cat) === -1) return;
      var g = groups[layerId];
      if (!g || !g.getLayers) return;
      total += g.getLayers().length;
    });
    return total;
  }

  // --- Подсчёт конфликтных слоёв ---
  function countConflictLayers() {
    var count = 0;
    var active = window.activeLayerIds || new Set();
    var all = window.allLayers || [];
    for (var i = 0; i < all.length; i++) {
      var l = all[i];
      if (!active.has(l.id)) continue;
      if (CONFLICT_CATEGORIES.indexOf(l.category) !== -1) count++;
    }
    return count;
  }

  // --- Расчёт CII ---
  function updateCII() {
    var conflictLayers = countConflictLayers();
    var conflictMarkers = countConflictMarkers();

    // Формула: 40% от слоёв (макс 10) + 60% от маркеров (макс 200)
    var layerScore   = Math.min(40, conflictLayers * 4);
    var markerScore  = Math.min(60, conflictMarkers / 3.5);
    var cii = Math.round(layerScore + markerScore);

    currentCII = cii;

    var valueEl = document.getElementById('cii-value');
    if (valueEl) valueEl.textContent = cii;

    document.dispatchEvent(new CustomEvent('crucix:cii-updated', {
      detail: { cii: cii, conflictLayers: conflictLayers, conflictMarkers: conflictMarkers }
    }));

    return cii;
  }

  // --- Экспорт ---
  window.CrucixCII = {
    toggleCII: toggleCII,
    updateCII: updateCII,
    getCII: function() { return currentCII; }
  };

  // --- Подписки ---
  document.addEventListener('crucix:layer-toggled', function() {
    if (ciiVisible) updateCII();
  });
  document.addEventListener('crucix:marker-added', function() {
    if (ciiVisible) updateCII();
  });
  document.addEventListener('crucix:marker-removed', function() {
    if (ciiVisible) updateCII();
  });

  logMsg('модуль загружен, панель скрыта');
})();
