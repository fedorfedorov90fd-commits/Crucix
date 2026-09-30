// ============================================================
//  EVENT MAP — COPY BUTTON v2.0.0-FULL
//  Одна задача: кнопка "Копировать" в топбаре.
//  НЕ ТРОГАТЬ copy-data.js. НЕ затирать window.copyAllData.
//  Кнопка #copy-btn — привязка здесь.
//  v2.0.0: 23 блока дампа + перехват fetch + crucix-события.
// ============================================================

(function() {
  'use strict';

  function logMsg(m) { console.log('[copy-button] ' + m); }

  // ============================================================
  //  ПЕРЕХВАТ FETCH (для блока 9-10)
  // ============================================================
  if (!window.__crucixFetchLog) {
    window.__crucixFetchLog = [];
    var _origFetch = window.fetch;
    window.fetch = function(input, init) {
      var url = (typeof input === 'string') ? input : (input && input.url) || '?';
      var method = (init && init.method) || 'GET';
      var t0 = performance.now();
      var entry = { t: Date.now(), url: url, method: method, status: null, ok: null, size: null, ms: null, error: null };
      window.__crucixFetchLog.push(entry);
      if (window.__crucixFetchLog.length > 500) window.__crucixFetchLog.shift();

      return _origFetch.apply(this, arguments).then(function(res) {
        entry.status = res.status;
        entry.ok = res.ok;
        entry.ms = Math.round(performance.now() - t0);
        try {
          var cl = res.headers.get('content-length');
          if (cl) entry.size = parseInt(cl, 10);
        } catch (e) {}
        return res;
      }).catch(function(err) {
        entry.error = err.message || String(err);
        entry.ms = Math.round(performance.now() - t0);
        throw err;
      });
    };
    logMsg('fetch перехвачен, лог в window.__crucixFetchLog');
  }

  // ============================================================
  //  ПЕРЕХВАТ CRUCIX-СОБЫТИЙ (для блока 13)
  // ============================================================
  if (!window.__crucixEventLog) {
    window.__crucixEventLog = [];
    var _origDispatch = document.dispatchEvent.bind(document);
    document.dispatchEvent = function(evt) {
      if (evt && typeof evt.type === 'string' && evt.type.indexOf('crucix:') === 0) {
        var entry = { t: Date.now(), type: evt.type };
        try { entry.detail = JSON.parse(JSON.stringify(evt.detail || {})); } catch (e) { entry.detail = '?'; }
        window.__crucixEventLog.push(entry);
        if (window.__crucixEventLog.length > 200) window.__crucixEventLog.shift();
      }
      return _origDispatch(evt);
    };
    logMsg('crucix-события перехвачены, лог в window.__crucixEventLog');
  }

  // ============================================================
  //  СБОРКА ДАМПА
  // ============================================================

  async function buildText() {
    var lines = [];
    var now = new Date().toISOString();
    var all = window.allLayers || [];
    var active = window.activeLayerIds || new Set();
    var S = window.CrucixState || {};
    var groups = S.markersByLayer || {};
    var cache = S.layerCache || {};

    // ===== 1. HEADER =====
    lines.push('=== CRUCIX Event Map — FULL DUMP v2.0.0 ===');
    lines.push('Time: ' + now);
    lines.push('URL: ' + window.location.href);
    lines.push('Window: ' + window.innerWidth + 'x' + window.innerHeight);
    lines.push('Всего слоёв: ' + all.length);
    lines.push('Активных: ' + active.size);
    lines.push('');

    // ===== 2. SSI / CII =====
    if (window.CrucixSSI && typeof window.CrucixSSI.getSSI === 'function') {
      lines.push('SSI: ' + window.CrucixSSI.getSSI() + '%');
    } else {
      lines.push('SSI: (модуль не загружен)');
    }
    if (window.CrucixCII && typeof window.CrucixCII.getCII === 'function') {
      lines.push('CII: ' + window.CrucixCII.getCII());
    } else {
      lines.push('CII: (модуль не загружен)');
    }
    lines.push('');

    // ===== 3. СОСТОЯНИЕ СЛОЁВ =====
    var cacheLayers = [];
    var pendingLayers = [];
    for (var li = 0; li < all.length; li++) {
      var lay = all[li];
      var isAct = active.has(lay.id);
      var inCache = cache[lay.id] !== undefined;
      if (inCache) cacheLayers.push(lay.id);
      else if (isAct) pendingLayers.push(lay.id);
    }
    lines.push('--- СОСТОЯНИЕ СЛОЁВ ---');
    lines.push('Всего: ' + all.length);
    lines.push('Активных: ' + active.size);
    lines.push('В кэше: ' + cacheLayers.length);
    lines.push('Ждут: ' + pendingLayers.length);
    if (pendingLayers.length > 0) lines.push('  Ждут: ' + pendingLayers.join(', '));
    lines.push('');

    // ===== 4. КЭШ: ТИПЫ ДАННЫХ =====
    if (cacheLayers.length > 0) {
      lines.push('--- КЭШ: ТИПЫ ДАННЫХ ---');
      for (var ci = 0; ci < cacheLayers.length; ci++) {
        var cid = cacheLayers[ci];
        var cdat = cache[cid];
        var shape = (cdat && cdat.meta && cdat.meta.basket_shape) || '?';
        var features = (cdat && cdat.features) ? cdat.features.length : ((Array.isArray(cdat)) ? cdat.length : 0);
        var series = (cdat && cdat.series) ? cdat.series.length : 0;
        var regions = (cdat && cdat.regions) ? cdat.regions.length : 0;
        lines.push('  [' + cid + '] shape=' + shape + ' features=' + features + ' series=' + series + ' regions=' + regions);
      }
      lines.push('');
    }

    // ===== 5. MAP COORDS =====
    if (window.map) {
      try {
        var c = window.map.getCenter();
        var z = window.map.getZoom();
        var b = window.map.getBounds();
        lines.push('--- MAP ---');
        lines.push('Center: ' + c.lat.toFixed(4) + ', ' + c.lng.toFixed(4));
        lines.push('Zoom: ' + z);
        lines.push('Bounds: ' + b.getSouthWest().lat.toFixed(4) + ',' + b.getSouthWest().lng.toFixed(4) + ' - ' + b.getNorthEast().lat.toFixed(4) + ',' + b.getNorthEast().lng.toFixed(4));
        lines.push('');
      } catch (e) {}
    }

    // ===== 6. LEAFLET LAYERS =====
    lines.push('--- LEAFLET LAYERS ---');
    if (window.map && window.map._layers) {
      var layerTypes = { TileLayer: 0, GeoJSON: 0, LayerGroup: 0, HeatLayer: 0, Marker: 0, CircleMarker: 0, Other: 0 };
      var layerDetails = [];
      Object.keys(window.map._layers).forEach(function(k) {
        var l = window.map._layers[k];
        var type = 'Other';
        if (l instanceof L.TileLayer) type = 'TileLayer';
        else if (l instanceof L.GeoJSON) type = 'GeoJSON';
        else if (l instanceof L.LayerGroup) type = 'LayerGroup';
        else if (l instanceof L.HeatLayer) type = 'HeatLayer';
        else if (l instanceof L.Marker) type = 'Marker';
        else if (l instanceof L.CircleMarker) type = 'CircleMarker';
        layerTypes[type] = (layerTypes[type] || 0) + 1;
        if (type === 'TileLayer') {
          layerDetails.push('  TileLayer: ' + (l._url || '?') + ' opacity=' + l.options.opacity);
        }
      });
      lines.push('Всего в map._layers: ' + Object.keys(window.map._layers).length);
      Object.keys(layerTypes).forEach(function(t) {
        if (layerTypes[t] > 0) lines.push('  ' + t + ': ' + layerTypes[t]);
      });
      layerDetails.forEach(function(d) { lines.push(d); });
    } else {
      lines.push('window.map._layers недоступен');
    }
    lines.push('Тайлов загружено: ' + document.querySelectorAll('.leaflet-tile-loaded').length);
    lines.push('Тайлов ждёт: ' + document.querySelectorAll('.leaflet-tile:not(.leaflet-tile-loaded)').length);
    lines.push('');

    // ===== 7. SSI BREAKDOWN =====
    lines.push('--- SSI BREAKDOWN ---');
    var ssiLayerScore = 0;
    var ssiMarkerScore = 0;
    var ssiByLayer = [];
    var CATEGORY_WEIGHT = { military: 1.5, geopolitical: 1.4, cyber: 1.3, threats: 1.3, intelligence: 1.2, space: 1.0, health: 1.0, energy: 1.0, ecological: 1.1, transport: 0.8, infrastructure: 0.9, news: 0.7, social: 0.9, default: 0.5 };
    for (var si = 0; si < all.length; si++) {
      var sl = all[si];
      if (!active.has(sl.id)) continue;
      var w = CATEGORY_WEIGHT[sl.category] || CATEGORY_WEIGHT.default;
      var g = groups[sl.id];
      var mk = (g && g.getLayers) ? g.getLayers().length : 0;
      ssiLayerScore += w;
      ssiMarkerScore += mk;
      ssiByLayer.push('  ' + sl.id + ' | ' + sl.category + ' | w=' + w + ' | markers=' + mk);
    }
    lines.push('layerScore: ' + ssiLayerScore.toFixed(2));
    lines.push('markerScore: ' + ssiMarkerScore);
    lines.push('baseSSI (≤50): ' + Math.min(50, ssiLayerScore * 2).toFixed(1));
    lines.push('intensitySSI (≤50): ' + Math.min(50, ssiMarkerScore / 20).toFixed(1));
    lines.push('SSI: ' + Math.round(Math.min(50, ssiLayerScore * 2) + Math.min(50, ssiMarkerScore / 20)) + '%');
    lines.push('Разбивка по активным слоям:');
    if (ssiByLayer.length === 0) lines.push('  (нет активных)');
    else ssiByLayer.forEach(function(l) { lines.push(l); });
    lines.push('');

    // ===== 8. ПАНЕЛЬ СЛОЁВ =====
    lines.push('--- ПАНЕЛЬ СЛОЁВ ---');
    var allBtns = document.querySelectorAll('.layer-btn');
    var visibleBtns = 0;
    var hiddenBtns = 0;
    allBtns.forEach(function(b) {
      if (b.style.display === 'none') hiddenBtns++;
      else visibleBtns++;
    });
    var activeBtns = document.querySelectorAll('.layer-btn.active').length;
    var cats = document.querySelectorAll('.layer-category-header').length;
    lines.push('Всего кнопок: ' + allBtns.length);
    lines.push('Видимых: ' + visibleBtns);
    lines.push('Скрыто поиском: ' + hiddenBtns);
    lines.push('Активных (класс .active): ' + activeBtns);
    lines.push('Категорий в панели: ' + cats);
    lines.push('#layer-count: ' + (document.getElementById('layer-count')?.textContent || '—'));
    lines.push('#active-count: ' + (document.getElementById('active-count')?.textContent || '—'));
    lines.push('#active-layers-count: ' + (document.getElementById('active-layers-count')?.textContent || '—'));
    lines.push('');

    // ===== 9. УПАВШИЕ СЛОИ =====
    lines.push('--- УПАВШИЕ СЛОИ ---');
    var failed = window.__crucixFetchLog.filter(function(e) { return e.status && e.status >= 400; });
    if (failed.length === 0) lines.push('(нет)');
    else failed.forEach(function(e) { lines.push('  HTTP ' + e.status + ' ' + e.url); });
    lines.push('');

    // ===== 10. FETCH LOG =====
    lines.push('--- FETCH LOG (' + window.__crucixFetchLog.length + ') ---');
    var recent = window.__crucixFetchLog.slice(-50);
    recent.forEach(function(e) {
      var status = e.status || (e.error ? 'ERR' : '?');
      lines.push('  [' + status + '] ' + e.method + ' ' + e.url + (e.ms != null ? ' (' + e.ms + 'ms)' : ''));
    });
    lines.push('');

    // ===== 11. CRUCIX MAP CONFIG =====
    lines.push('--- CRUCIX MAP CONFIG ---');
    try {
      lines.push(JSON.stringify(window.CrucixMap || {}, null, 2));
    } catch (e) { lines.push('(ошибка сериализации)'); }
    lines.push('');

    // ===== 12. CRUCIX STATE =====
    lines.push('--- CRUCIX STATE ---');
    lines.push('markersByLayer keys: ' + Object.keys(groups).length);
    Object.keys(groups).forEach(function(k) {
      var g = groups[k];
      var cnt = (g && g.getLayers) ? g.getLayers().length : '?';
      lines.push('  ' + k + ': ' + cnt + ' маркеров');
    });
    lines.push('layerCache keys: ' + Object.keys(cache).length);
    Object.keys(cache).forEach(function(k) {
      var d = cache[k];
      var info = d && d.meta ? 'shape=' + (d.meta.basket_shape || '?') : (Array.isArray(d) ? 'array[' + d.length + ']' : typeof d);
      lines.push('  ' + k + ': ' + info);
    });
    lines.push('stats: ' + JSON.stringify(S.stats || {}));
    lines.push('');

    // ===== 13. CRUCIX EVENTS =====
    lines.push('--- CRUCIX EVENTS (' + window.__crucixEventLog.length + ') ---');
    window.__crucixEventLog.slice(-30).forEach(function(e) {
      lines.push('  [' + new Date(e.t).toLocaleTimeString() + '] ' + e.type + ' ' + (e.detail ? JSON.stringify(e.detail).slice(0, 100) : ''));
    });
    lines.push('');

    // ===== 14. СЛОИ =====
    lines.push('========== СЛОИ (' + all.length + ') ==========');
    for (var ii = 0; ii < all.length; ii++) {
      var l = all[ii];
      var isActive = active.has(l.id);
      var mc = 0;
      if (groups[l.id] && groups[l.id].getLayers) mc = groups[l.id].getLayers().length;
      lines.push('');
      lines.push('[' + (ii + 1) + '] ' + l.id + (isActive ? ' ★ ACTIVE' : ''));
      lines.push('    name:     ' + l.name);
      lines.push('    category: ' + l.category);
      lines.push('    route:    ' + l.route);
      lines.push('    color:    ' + l.color);
      lines.push('    icon:     ' + l.icon);
      lines.push('    vizType:  ' + l.vizType);
      lines.push('    markers:  ' + mc);
    }
    lines.push('');

    // ===== 15. МАРКЕРЫ =====
    lines.push('========== МАРКЕРЫ ==========');
    var totalM = 0;
    Object.keys(groups).forEach(function(layerId) {
      if (!active.has(layerId)) return;
      var g = groups[layerId];
      if (!g || !g.getLayers) return;
      var layers = g.getLayers();
      lines.push('');
      lines.push('--- ' + layerId + ' (' + layers.length + ') ---');
      for (var mi2 = 0; mi2 < layers.length; mi2++) {
        var m = layers[mi2];
        if (!m.getLatLng) continue;
        var ll = m.getLatLng();
        var popup = '';
        try {
          if (m.getPopup) {
            var p = m.getPopup();
            if (p) {
              var cc = p.getContent();
              if (typeof cc === 'string') popup = cc.replace(/<[^>]+>/g, ' | ').replace(/\s+/g, ' ').trim();
            }
          }
        } catch (e) {}
        lines.push('  ' + mi2 + ': ' + ll.lat.toFixed(4) + ',' + ll.lng.toFixed(4) + (popup ? ' — ' + popup : ''));
        totalM++;
      }
    });
    lines.push('');
    lines.push('Всего маркеров: ' + totalM);
    lines.push('');

    // ===== 16. СЫРЫЕ ДАННЫЕ АКТИВНЫХ СЛОЁВ =====
    lines.push('========== СЫРЫЕ ДАННЫЕ АКТИВНЫХ СЛОЁВ (JSON) ==========');
    Object.keys(cache).forEach(function(layerId) {
      if (!active.has(layerId)) return;
      lines.push('');
      lines.push('### ' + layerId + ' ###');
      try {
        var json = JSON.stringify(cache[layerId], null, 1);
        if (json.length > 500000) {
          lines.push(json.slice(0, 500000));
          lines.push('... [обрезано, всего ' + json.length + ' симв]');
        } else {
          lines.push(json);
        }
      } catch (e) {
        lines.push('[ошибка сериализации: ' + e.message + ']');
      }
    });

    // ===== 17. STORAGE =====
    try {
      if (localStorage.length > 0) {
        lines.push('');
        lines.push('--- LOCALSTORAGE (' + localStorage.length + ') ---');
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          var v = localStorage.getItem(k);
          lines.push('  ' + k + '=' + (v && v.length > 500 ? v.slice(0, 500) + '...' : v));
        }
      }
      if (sessionStorage.length > 0) {
        lines.push('');
        lines.push('--- SESSIONSTORAGE (' + sessionStorage.length + ') ---');
        for (var j = 0; j < sessionStorage.length; j++) {
          var kj = sessionStorage.key(j);
          lines.push('  ' + kj + '=' + sessionStorage.getItem(kj));
        }
      }
    } catch (e) {}

    // ===== 18. COOKIES =====
    try {
      if (document.cookie) {
        lines.push('');
        lines.push('--- COOKIES ---');
        lines.push(document.cookie);
      }
    } catch (e) {}

    // ===== 19. META =====
    try {
      var metas = document.querySelectorAll('meta');
      if (metas.length > 0) {
        lines.push('');
        lines.push('--- META (' + metas.length + ') ---');
        for (var mi = 0; mi < metas.length; mi++) {
          var nm = metas[mi].getAttribute('name') || metas[mi].getAttribute('property') || metas[mi].getAttribute('http-equiv') || '?';
          var cn = metas[mi].getAttribute('content') || '';
          if (cn) lines.push('  ' + nm + ': ' + cn);
        }
      }
    } catch (e) {}

    // ===== 20. RESOURCES =====
    try {
      var links = document.querySelectorAll('link[href]');
      var scripts = document.querySelectorAll('script[src]');
      var imgs = document.querySelectorAll('img[src]');
      lines.push('');
      lines.push('--- RESOURCES ---');
      lines.push('CSS links: ' + links.length);
      lines.push('JS scripts: ' + scripts.length);
      lines.push('Images: ' + imgs.length);
      for (var li2 = 0; li2 < links.length; li2++) lines.push('  [CSS] ' + links[li2].getAttribute('href'));
      for (var si2 = 0; si2 < scripts.length; si2++) lines.push('  [JS]  ' + scripts[si2].getAttribute('src'));
    } catch (e) {}

    // ===== 21. DOM SNAPSHOT =====
    lines.push('');
    lines.push('========== DOM SNAPSHOT ==========');
    try {
      var domAll = document.querySelectorAll('*');
      lines.push('Всего элементов в DOM: ' + domAll.length);
      var shown = 0;
      for (var di = 0; di < domAll.length && shown < 1000; di++) {
        var el = domAll[di];
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
        var rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        var sel = el.tagName.toLowerCase();
        if (el.id) sel += '#' + el.id;
        if (el.className && typeof el.className === 'string') {
          var cls = el.className.split(' ').filter(function(x){return x;}).join('.');
          if (cls) sel += '.' + cls;
        }
        var cs = window.getComputedStyle(el);
        var txt = '';
        for (var ti = 0; ti < el.childNodes.length; ti++) {
          if (el.childNodes[ti].nodeType === 3) txt += el.childNodes[ti].textContent.trim();
        }
        lines.push('');
        lines.push('[' + (shown + 1) + '] ' + sel);
        lines.push('  text: ' + (txt.slice(0, 300) || '—'));
        lines.push('  rect: x=' + Math.round(rect.left) + ' y=' + Math.round(rect.top) + ' w=' + Math.round(rect.width) + ' h=' + Math.round(rect.height));
        lines.push('  color: ' + cs.color);
        lines.push('  bg: ' + cs.backgroundColor);
        lines.push('  font: ' + cs.fontFamily + ' ' + cs.fontSize + ' ' + cs.fontWeight);
        lines.push('  display: ' + cs.display);
        lines.push('  position: ' + cs.position);
        lines.push('  padding: ' + cs.padding);
        lines.push('  border: ' + cs.border);
        lines.push('  radius: ' + cs.borderRadius);
        lines.push('  shadow: ' + cs.boxShadow);
        lines.push('  z-index: ' + cs.zIndex);
        shown++;
      }
      lines.push('');
      lines.push('Показано элементов: ' + shown);
    } catch (e) {}

    // ===== 22. РЕЕСТР =====
    try {
      var mapType = (window.CrucixMap && window.CrucixMap.mapType) || 'events';
      lines.push('');
      lines.push('========== РЕЕСТР /api/registry/layers?mapType=' + mapType + ' ==========');
      var regRes = await fetch('/api/registry/layers?mapType=' + mapType);
      if (regRes.ok) {
        var regData = await regRes.json();
        lines.push('Слоёв в реестре: ' + (regData.layers ? regData.layers.length : '?'));
        lines.push(JSON.stringify(regData, null, 1).slice(0, 100000));
      } else {
        lines.push('HTTP ' + regRes.status);
      }
    } catch (e) {
      lines.push('Ошибка реестра: ' + e.message);
    }

    // ===== 23. PERFORMANCE =====
    lines.push('');
    lines.push('--- PERFORMANCE ---');
    if (performance.timing) {
      var t = performance.timing;
      lines.push('DOM loaded: ' + (t.domContentLoadedEventEnd - t.navigationStart) + 'ms');
      lines.push('Page loaded: ' + (t.loadEventEnd - t.navigationStart) + 'ms');
    }
    lines.push('Сейчас uptime: ' + Math.round(performance.now()) + 'ms');
    lines.push('document.hidden: ' + document.hidden);
    lines.push('');

    lines.push('=========== END v2.0.0 ===========');
    return lines.join('\n');
  }

  // --- Копирование ---
  async function copy() {
    var text = await buildText();
    try {
      await navigator.clipboard.writeText(text);
      if (typeof showNotification === 'function') showNotification('Скопировано (' + Math.round(text.length / 1024) + ' КБ)', 'success');
      logMsg('clipboard OK, ' + text.length + ' симв');
    } catch (e) {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (typeof showNotification === 'function') showNotification('Скопировано (fallback, ' + Math.round(text.length / 1024) + ' КБ)', 'success');
    } catch (e) {
      if (typeof showNotification === 'function') showNotification('Ошибка копирования', 'error');
    }
    document.body.removeChild(ta);
  }

  // --- Скачать .txt ---
  async function download() {
    var text = await buildText();
    var blob = new Blob([text], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'crucix-event-map-' + Date.now() + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (typeof showNotification === 'function') showNotification('Файл скачан', 'success');
  }

  // --- Привязка ---
  function bind() {
    var btn = document.getElementById('copy-btn');
    if (!btn) {
      logMsg('кнопка #copy-btn не найдена — повтор через 500мс');
      setTimeout(bind, 500);
      return;
    }
    if (btn.__crucixBound) return;

    if (typeof window.copyAllData === 'function') {
      // Прямая ссылка — как в geo-map. copyAllData из copy-data.js
      // использует this (кнопку) для анимации: зелёный цвет, текст с KB.
      btn.onclick = window.copyAllData;
      btn.__crucixBound = true;
      logMsg('кнопка привязана → onclick = copyAllData (прямая ссылка)');
    } else {
      logMsg('copyAllData не найден, retry 200ms');
      setTimeout(bind, 200);
    }
  }

  // --- Экспорт (БЕЗ затирания window.copyAllData!) ---
  window.CrucixCopyButton = {
    copy: copy,
    download: download,
    buildText: buildText,
    bind: bind,
    fetchLog: function() { return window.__crucixFetchLog; },
    eventLog: function() { return window.__crucixEventLog; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  logMsg('модуль v2.0.0-full загружен, copyAllData не затирается');
})();
