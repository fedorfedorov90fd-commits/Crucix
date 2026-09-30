// ============================================================
//  EVENT MAP — SSI (Strategic Severity Index)
//  Одна задача: считать SSI по активным слоям и маркерам.
//  Читает: window.CrucixState, window.activeLayerIds.
//  Слушает: crucix:layer-toggled, crucix:marker-added, crucix:marker-removed.
//  Шлёт: crucix:ssi-updated.
//  Не fetch, не рисует маркеры, не знает про CII/heat/timeline.
// ============================================================

(function() {
  'use strict';

  // Веса по категориям слоёв (вклад в SSI)
  var CATEGORY_WEIGHT = {
    military:       1.5,
    geopolitical:   1.4,
    cyber:          1.3,
    threats:        1.3,
    intelligence:   1.2,
    space:          1.0,
    health:         1.0,
    energy:         1.0,
    ecological:     1.1,
    transport:      0.8,
    infrastructure: 0.9,
    news:           0.7,
    social:         0.9,
    default:        0.5
  };

  // Множитель по severity маркера (если в данных есть)
  var SEVERITY_MULT = {
    critical: 3,
    high:     2,
    medium:   1,
    low:      0.5,
    info:     0.3
  };

  var currentSSI = 0;

  function logMsg(m) { console.log('[ssi] ' + m); }

  // --- Вес категории слоя ---
  function categoryWeight(category) {
    return CATEGORY_WEIGHT[category] || CATEGORY_WEIGHT.default;
  }

  // --- Подсчёт маркеров с весами ---
  function countWeightedMarkers() {
    var total = 0;
    var S = window.CrucixState || {};
    var groups = S.markersByLayer || {};
    var active = window.activeLayerIds || new Set();

    Object.keys(groups).forEach(function(layerId) {
      if (!active.has(layerId)) return;
      var group = groups[layerId];
      if (!group || !group.getLayers) return;
      var layers = group.getLayers();
      total += layers.length;
    });
    return total;
  }

  // --- Подсчёт весов активных слоёв ---
  function countWeightedLayers() {
    var total = 0;
    var active = window.activeLayerIds || new Set();
    var all = window.allLayers || [];
    for (var i = 0; i < all.length; i++) {
      var l = all[i];
      if (active.has(l.id)) total += categoryWeight(l.category);
    }
    return total;
  }

  // --- Расчёт SSI ---
  function calculateSSI() {
    var layerScore = countWeightedLayers();       // 0-∞, но обычно 0-50
    var markerScore = countWeightedMarkers();      // 0-∞

    // Нормирование: 100% = много активных слоёв + много маркеров
    var baseSSI     = Math.min(50, layerScore * 2);    // до 50 от слоёв
    var intensitySSI= Math.min(50, markerScore / 20);  // до 50 от маркеров
    var ssi = Math.round(baseSSI + intensitySSI);

    currentSSI = ssi;

    // Обновление UI
    var panel = document.getElementById('ssi-panel');
    if (panel) panel.style.display = ssi > 0 ? '' : 'none';

    var valueEl = document.getElementById('ssi-value');
    if (valueEl) valueEl.textContent = ssi + '%';

    var fillEl = document.getElementById('ssi-fill');
    if (fillEl) {
      fillEl.style.width = ssi + '%';
      fillEl.style.background = ssi > 70 ? '#dc2626' : ssi > 40 ? '#f59e0b' : '#22c55e';
    }

    document.dispatchEvent(new CustomEvent('crucix:ssi-updated', {
      detail: { ssi: ssi, layerScore: layerScore, markerScore: markerScore }
    }));

    return ssi;
  }

  // --- Экспорт ---
  window.CrucixSSI = {
    calculateSSI: calculateSSI,
    getSSI: function() { return currentSSI; }
  };

  // --- Подписки на события ---
  document.addEventListener('crucix:layer-toggled', calculateSSI);
  document.addEventListener('crucix:marker-added', calculateSSI);
  document.addEventListener('crucix:marker-removed', calculateSSI);

  logMsg('модуль загружен, ждёт события');
})();
