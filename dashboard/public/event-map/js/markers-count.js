// ============================================================
//  EVENT MAP — MARKERS COUNT
//  Одна задача: обновлять #marker-count и #countries-count.
//  Слушает crucix:marker-added, crucix:marker-removed.
//  Не рисует маркеры. Не знает про форматы.
// ============================================================

(function() {
  'use strict';

  function logMsg(m) { console.log('[markers-count] ' + m); }

  // --- Общий счётчик маркеров по всем активным слоям ---
  function countAllMarkers() {
    var total = 0;
    var S = window.CrucixState || {};
    var groups = S.markersByLayer || {};
    var active = window.activeLayerIds || new Set();

    Object.keys(groups).forEach(function(layerId) {
      if (!active.has(layerId)) return;
      var g = groups[layerId];
      if (!g || !g.getLayers) return;
      total += g.getLayers().length;
    });
    return total;
  }

  // --- Счётчик задетых стран (уникальных ISO3) ---
  function countCountries() {
    var seen = new Set();
    var S = window.CrucixState || {};
    var cache = S.layerCache || {};
    var active = window.activeLayerIds || new Set();

    Object.keys(cache).forEach(function(layerId) {
      if (!active.has(layerId)) return;
      var data = cache[layerId];
      if (!data) return;

      // GeoJSON FeatureCollection
      var features = data.features;
      if (Array.isArray(features)) {
        features.forEach(function(f) {
          var p = f.properties || {};
          var key = p.country || p.countryCode || p.iso3 || p.iso_a3;
          if (key) seen.add(String(key));
        });
      }

      // Плоский массив
      if (Array.isArray(data)) {
        data.forEach(function(item) {
          var key = item.country || item.countryCode || item.iso3;
          if (key) seen.add(String(key));
        });
      }
    });
    return seen.size;
  }

  // --- Обновить UI ---
  function update() {
    var markers = countAllMarkers();
    var countries = countCountries();

    var mEl = document.getElementById('marker-count');
    if (mEl) mEl.textContent = markers;

    var cEl = document.getElementById('countries-count');
    if (cEl) cEl.textContent = '🌍 ' + countries + ' стран';
  }

  // --- Экспорт ---
  window.CrucixMarkersCount = {
    update: update,
    countAllMarkers: countAllMarkers,
    countCountries: countCountries
  };

  // --- Подписки ---
  document.addEventListener('crucix:marker-added', update);
  document.addEventListener('crucix:marker-removed', update);
  document.addEventListener('crucix:layer-toggled', update);

  logMsg('модуль загружен');
})();
