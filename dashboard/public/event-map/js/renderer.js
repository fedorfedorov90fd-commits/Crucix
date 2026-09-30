// ============================================================
//  EVENT MAP — RENDERER
//  Одна задача: применить правила formats-* к ответу сервера.
//  Не fetch. Не рисует. Не знает про Leaflet.
//  Читает: window.FORMATS_REGISTRY, FORMATS_DISPATCH, FORMATS_SPATIAL,
//          FORMATS_TIMESERIES, FORMATS_CATEGORICAL, FORMATS_RELATIONAL, FORMATS_TEXTUAL.
//  Отдаёт: {points: [], series: [], regions: [], documents: [], meta: {}}
// ============================================================

(function() {
  'use strict';

  var R = window.FORMATS_REGISTRY || {};
  var D = window.FORMATS_DISPATCH || {};

  // --- Определение формата ответа ---
  function detectFormat(data) {
    if (!data) return null;
    if (typeof data !== 'object') return null;

    // GeoJSON FeatureCollection
    if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
      return 'geojson-featurecollection';
    }
    // Basket v1
    if (data.schema === 'crucix.basket.v1') {
      var shape = (data.meta && data.meta.basket_shape) || null;
      if (shape === 'v1.points')    return 'crucix-basket-v1-points';
      if (shape === 'v1.series')    return 'crucix-basket-v1-series';
      if (shape === 'v1.regions')   return 'crucix-basket-v1-regions';
      if (shape === 'v1.graph')     return 'crucix-basket-v1-graph';
      if (shape === 'v1.documents') return 'crucix-basket-v1-documents';
      return 'crucix-basket-v1';
    }
    // Массив
    if (Array.isArray(data)) return 'flat-array';

    // Вложенный
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) {
      if (Array.isArray(data[keys[i]])) return 'wrapped-array';
    }
    return 'single-object';
  }

  // --- Достать значение по пути (например, 'geometry.coordinates[0]') ---
  function getByPath(obj, path) {
    if (!obj || !path) return undefined;
    // Преобразуем 'geometry.coordinates[0]' в ['geometry', 'coordinates', '0']
    var parts = String(path).split('.').reduce(function(acc, p) {
      var m = p.match(/^(\w+)\[(\d+)\]$/);
      if (m) { acc.push(m[1], m[2]); } else { acc.push(p); }
      return acc;
    }, []);
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  // --- Достать первое непустое из списка путей ---
  function firstOf(obj, paths) {
    if (!Array.isArray(paths)) return undefined;
    for (var i = 0; i < paths.length; i++) {
      var v = getByPath(obj, paths[i]);
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return undefined;
  }

  // --- Парсер S: точки (GeoJSON FeatureCollection) ---
  function parseSpatial(data, format) {
    var fmt = window.FORMATS_SPATIAL || {};
    var rules = fmt._default || {};

    if (format === 'flat-array') {
      rules = fmt._array || rules;
    }

    var features = data.features || (Array.isArray(data) ? data : []);
    var points = [];
    var maxMarkers = 500;

    for (var i = 0; i < features.length; i++) {
      var feat = features[i];
      var lng = firstOf(feat, [rules.lng || 'geometry.coordinates[0]']);
      var lat = firstOf(feat, [rules.lat || 'geometry.coordinates[1]']);

      if (typeof lng === 'string') lng = parseFloat(lng);
      if (typeof lat === 'string') lat = parseFloat(lat);
      if (typeof lng !== 'number' || typeof lat !== 'number') continue;
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) continue;
      if (points.length >= maxMarkers) break;

      var props = feat.properties || feat;
      var point = {
        lat: lat,
        lng: lng,
        title:    firstOf(feat, rules.title) || '',
        time:     firstOf(feat, rules.time) || null,
        color:    firstOf(feat, rules.color) || null,
        icon:     firstOf(feat, rules.icon) || null,
        severity: firstOf(feat, rules.severity) || null,
        category: firstOf(feat, rules.category) || null,
        country:  firstOf(feat, rules.country) || null,
        extra:    props || {}
      };
      points.push(point);
    }

    return {
      points: points,
      meta: data.meta || {},
      legend: data.legend || data.bands || []
    };
  }

  // --- Парсер T: временные ряды ---
  function parseTimeseries(data, format) {
    var fmt = window.FORMATS_TIMESERIES || {};
    var rules = fmt._default || {};

    var series = [];
    if (data && Array.isArray(data.series)) {
      series = data.series;
    } else if (data && data.series && Array.isArray(data.series.values)) {
      var dates = data.dates || [];
      for (var i = 0; i < data.series.values.length; i++) {
        series.push({ date: dates[i], value: data.series.values[i] });
      }
    } else if (Array.isArray(data)) {
      series = data;
    }

    var normalized = series.map(function(item) {
      return {
        date:  firstOf(item, rules.dateField) || null,
        value: firstOf(item, rules.valueField) || null,
        extra: item
      };
    });

    return { series: normalized, meta: (data && data.meta) || {} };
  }

  // --- Парсер C: регионы ---
  function parseCategorical(data, format) {
    var fmt = window.FORMATS_CATEGORICAL || {};
    var rules = fmt._default || {};

    var regions = [];
    if (data && Array.isArray(data.regions)) {
      regions = data.regions;
    } else if (Array.isArray(data)) {
      regions = data;
    }

    var normalized = regions.map(function(item) {
      return {
        country: firstOf(item, rules.countryField) || null,
        value:   firstOf(item, rules.valueField) || null,
        label:   firstOf(item, rules.labelField) || null,
        extra: item
      };
    });

    return { regions: normalized, meta: (data && data.meta) || {} };
  }

  // --- Диспетчер: определить и применить ---
  function renderLayerResponse(layerId, data) {
    if (!data) return { points: [], series: [], regions: [], documents: [], meta: {} };

    var format = detectFormat(data);
    var shape = (data && data.meta && data.meta.basket_shape) || null;

    // Определение измерения
    var dimension = null;
    if (format === 'geojson-featurecollection') dimension = 'S';
    else if (format === 'flat-array')           dimension = 'unknown';
    else if (shape === 'v1.points')             dimension = 'S';
    else if (shape === 'v1.series')             dimension = 'T';
    else if (shape === 'v1.regions')            dimension = 'C';
    else if (shape === 'v1.graph')              dimension = 'R';
    else if (shape === 'v1.documents')          dimension = 'X';
    else if (format === 'wrapped-array')        dimension = 'dispatcher';

    var result = { points: [], series: [], regions: [], documents: [], meta: {}, dimension: dimension, format: format };

    if (dimension === 'S') {
      var s = parseSpatial(data, format);
      result.points = s.points;
      result.meta = s.meta;
      result.legend = s.legend;
    } else if (dimension === 'T') {
      var t = parseTimeseries(data, format);
      result.series = t.series;
      result.meta = t.meta;
    } else if (dimension === 'C') {
      var c = parseCategorical(data, format);
      result.regions = c.regions;
      result.meta = c.meta;
    }

    return result;
  }

  // --- Экспорт ---
  window.CrucixRenderer = {
    detectFormat: detectFormat,
    renderLayerResponse: renderLayerResponse,
    getByPath: getByPath,
    firstOf: firstOf
  };

  console.log('[renderer] загружен, форматов в реестре: ' + Object.keys((R && R.serverResponseFormats) || {}).length);
})();
