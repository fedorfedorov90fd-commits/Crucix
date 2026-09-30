// ============================================================
//  EVENT MAP — MAP CONTROLS
//  Одна задача: Leaflet init, границы стран, подписи, choropleth.
//  Читает: window.CrucixMap (config), window.CRUCIX_COUNTRIES.
//  Слушает: crucix:choropleth-request.
//  Шлёт: crucix:map-ready, crucix:boundaries-loaded.
//  Не рисует точки (markers.js), не читает форматы (renderer.js).
// ============================================================

(function() {
  'use strict';

  var countryLayer = null;
  var geoJsonCache = null;

  function logMsg(m) { console.log('[map-controls] ' + m); }

  // --- Инициализация карты ---
  function initMap() {
    if (window.map && typeof window.map.addLayer === "function" && typeof window.map.setView === "function") {
      logMsg('карта уже создана');
      return window.map;
    }

    var cfg = window.CrucixMap || {};

    window.map = L.map('map', {
      center: cfg.defaultCenter || [30, 30],
      zoom: cfg.defaultZoom || 3,
      minZoom: cfg.minZoom || 2,
      maxZoom: cfg.maxZoom || 18,
      worldCopyJump: cfg.worldCopyJump !== false,
      zoomControl: true
    });

    L.tileLayer(cfg.tileUrl || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: cfg.tileAttribution || '© OpenStreetMap, © CARTO',
      maxZoom: 18
    }).addTo(window.map);

    logMsg('карта инициализирована');
    document.dispatchEvent(new CustomEvent('crucix:map-ready'));
    return window.map;
  }

  // --- Загрузка границ стран ---
  async function loadBoundaries() {
    if (!window.map) { logMsg('карта не готова'); return null; }

    var urls = [
      '/dashboard/public/world.geojson',
      '/world.geojson',
      'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'
    ];

    for (var i = 0; i < urls.length; i++) {
      try {
        var res = await fetch(urls[i]);
        if (!res.ok) continue;
        geoJsonCache = await res.json();
        logMsg('границы загружены из ' + urls[i] + ', фич: ' + (geoJsonCache.features || []).length);
        break;
      } catch (e) { /* try next */ }
    }

    if (!geoJsonCache) { logMsg('границы НЕ загружены'); return null; }

    countryLayer = L.geoJSON(geoJsonCache, {
      style: {
        fillColor: 'transparent',
        fillOpacity: 0,
        color: 'rgba(255,255,255,0.25)',
        weight: 0.8
      },
      onEachFeature: function(feature, layer) {
        var p = feature.properties || {};
        var name = p.name || p.NAME || p.ADMIN || '';
        var iso3 = p.ISO_A3 || p.iso_a3 || p.ADM0_A3 || null;

        // Локализованное имя из личного справочника
        if (iso3 && window.CRUCIX_COUNTRIES && window.CRUCIX_COUNTRIES.countries && window.CRUCIX_COUNTRIES.countries[iso3]) {
          var c = window.CRUCIX_COUNTRIES.countries[iso3];
          var lang = window.currentLang || 'ru';
          name = (lang === 'ru' ? c.name_ru : c.name_en) || name;
        }
        if (name) {
          try { layer.bindTooltip(name, { sticky: true }); }
          catch (e) { /* фича без валидной геометрии — пропускаем */ }
        }
      }
    });

    countryLayer.addTo(window.map);
    document.dispatchEvent(new CustomEvent('crucix:boundaries-loaded', {
      detail: { count: (geoJsonCache.features || []).length }
    }));
    return countryLayer;
  }

  // --- Choropleth: покрасить страны по значению ---
  function applyChoropleth(regions, colorBase) {
    if (!countryLayer || !Array.isArray(regions)) {
      logMsg('choropleth: нет countryLayer или regions');
      return 0;
    }

    // Собрать map: iso3 → value
    var valueByIso3 = {};
    for (var i = 0; i < regions.length; i++) {
      var r = regions[i];
      var key = r.country || r.iso3 || r.code;
      if (!key) continue;
      var iso3 = resolveToIso3(key);
      if (iso3) valueByIso3[iso3] = r.value || 0;
    }

    // Нормализация
    var values = Object.values(valueByIso3).filter(function(v) { return typeof v === 'number'; });
    var maxVal = values.length ? Math.max.apply(null, values) : 1;

    var painted = 0;
    countryLayer.eachLayer(function(layer) {
      var p = layer.feature && layer.feature.properties || {};
      var iso3 = p.ISO_A3 || p.iso_a3 || p.ADM0_A3 || null;
      if (!iso3) return;
      var val = valueByIso3[iso3];
      if (val === undefined) {
        layer.setStyle({ fillOpacity: 0, fillColor: 'transparent' });
        return;
      }
      var opacity = Math.min(0.85, 0.15 + 0.7 * (val / maxVal));
      layer.setStyle({ fillColor: colorBase || '#dc2626', fillOpacity: opacity });
      painted++;
    });

    logMsg('choropleth: покрашено ' + painted + ' стран');
    return painted;
  }

  // --- Нормализация кода страны к ISO3 ---
  function resolveToIso3(key) {
    if (!key || !window.CRUCIX_COUNTRIES) return null;
    var C = window.CRUCIX_COUNTRIES;

    // Уже ISO3?
    if (C.countries && C.countries[key]) return key;

    // ISO2?
    if (C.by_alpha2 && C.by_alpha2[key]) return C.by_alpha2[key];

    // Алиас (по нижнему регистру)?
    if (C.by_alias_lower && C.by_alias_lower[String(key).toLowerCase()]) {
      return C.by_alias_lower[String(key).toLowerCase()];
    }
    return null;
  }

  // --- Экспорт ---
  window.CrucixMapBase = {
    initMap: initMap,
    loadBoundaries: loadBoundaries,
    applyChoropleth: applyChoropleth,
    resolveToIso3: resolveToIso3
  };

  // --- Слушаем запрос на choropleth ---
  document.addEventListener('crucix:choropleth-request', function(evt) {
    var d = evt.detail || {};
    applyChoropleth(d.regions, d.color);
  });

  logMsg('модуль загружен');
})();
