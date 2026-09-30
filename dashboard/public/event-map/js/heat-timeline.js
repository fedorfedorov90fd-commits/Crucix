// ============================================================
//  EVENT MAP — HEAT + TIMELINE
//  Одна задача: тепловая карта и хронология по активным точкам.
//  Один файл — потому что данные одни (точки активных слоёв).
//  Читает: window.CrucixState.markersByLayer, window.map.
//  Слушает: crucix:marker-added, crucix:marker-removed.
//  Шлёт: crucix:heat-toggled, crucix:timeline-toggled.
//  Не рисует точки (markers.js), не знает про SSI/CII.
//  v2: использует существующий #timeline-panel из HTML (не создаёт свою)
// ============================================================

(function() {
  'use strict';

  var heatLayer = null;
  var heatVisible = false;

  function logMsg(m) { console.log('[heat-timeline] ' + m); }

  // --- Собрать все активные точки ---
  function collectActivePoints() {
    var points = [];
    var S = window.CrucixState || {};
    var groups = S.markersByLayer || {};
    var active = window.activeLayerIds || new Set();

    Object.keys(groups).forEach(function(layerId) {
      if (!active.has(layerId)) return;
      var g = groups[layerId];
      if (!g || !g.getLayers) return;
      g.getLayers().forEach(function(m) {
        if (!m.getLatLng) return;
        var ll = m.getLatLng();
        points.push({ lat: ll.lat, lng: ll.lng });
      });
    });
    return points;
  }

  // --- Toggle тепловой карты ---
  function toggleHeat() {
    if (heatVisible) {
      if (heatLayer && window.map) window.map.removeLayer(heatLayer);
      heatLayer = null;
      heatVisible = false;
      document.dispatchEvent(new CustomEvent('crucix:heat-toggled', { detail: { visible: false } }));
      logMsg('heat выключен');
      return;
    }

    var points = collectActivePoints();
    if (points.length === 0) {
      if (typeof showNotification === 'function') showNotification('Нет активных точек', 'warn');
      return;
    }

    if (typeof L.heatLayer === 'function') {
      heatLayer = L.heatLayer(points.map(function(p) { return [p.lat, p.lng, 0.6]; }), {
        radius: 25, blur: 15, maxZoom: 10
      }).addTo(window.map);
    } else {
      heatLayer = L.layerGroup();
      points.forEach(function(p) {
        L.circleMarker([p.lat, p.lng], {
          radius: 15, fillColor: '#dc2626', fillOpacity: 0.25,
          color: 'transparent', weight: 0
        }).addTo(heatLayer);
      });
      heatLayer.addTo(window.map);
    }

    heatVisible = true;
    document.dispatchEvent(new CustomEvent('crucix:heat-toggled', { detail: { visible: true, points: points.length } }));
    logMsg('heat включён: ' + points.length + ' точек');
  }

  // --- Toggle хронологии (использует существующий #timeline-panel) ---
  function toggleTimeline() {
    var panel = document.getElementById('timeline-panel');
    if (!panel) {
      logMsg('timeline-panel не найден в HTML');
      return;
    }

    // Toggle видимости через класс active (CSS уже есть в inline style)
    var isActive = panel.classList.contains('active');
    if (isActive) {
      panel.classList.remove('active');
      panel.style.display = 'none';
      document.dispatchEvent(new CustomEvent('crucix:timeline-toggled', { detail: { visible: false } }));
      return;
    }

    // Собрать точки с датами
    var datedPoints = [];
    var S = window.CrucixState || {};
    var active = window.activeLayerIds || new Set();

    Object.keys(S.layerCache || {}).forEach(function(layerId) {
      if (!active.has(layerId)) return;
      var cache = S.layerCache[layerId];
      if (!cache) return;
      var featureList = (cache.features || (Array.isArray(cache) ? cache : []));
      featureList.forEach(function(f) {
        var props = f.properties || f;
        var date = props.date || props.timestamp || props.event_date || null;
        if (date) datedPoints.push({ date: date });
      });
    });

    // Группировка по дню
    var byDay = {};
    datedPoints.forEach(function(p) {
      var day = String(p.date).slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
    });

    var days = Object.keys(byDay).sort();

    // Заполнение #timeline-track
    var track = document.getElementById('timeline-track');
    if (track) {
      track.innerHTML = '';
      var maxCount = 0;
      days.forEach(function(d) { if (byDay[d] > maxCount) maxCount = byDay[d]; });
      days.forEach(function(d) {
        var h = Math.max(4, Math.round(70 * byDay[d] / maxCount));
        var bar = document.createElement('div');
        bar.className = 'timeline-bar';
        bar.style.height = h + 'px';
        bar.style.width = '12px';
        bar.style.background = '#dc2626';
        bar.title = d + ': ' + byDay[d];
        bar.innerHTML = '<span class="tooltip">' + d + ' — ' + byDay[d] + '</span>';
        track.appendChild(bar);
      });
    }

    var dateEl = document.getElementById('timeline-date');
    if (dateEl) dateEl.textContent = days.length ? (days[0] + ' — ' + days[days.length - 1]) : '—';

    var eventsEl = document.getElementById('timeline-events');
    if (eventsEl) eventsEl.textContent = datedPoints.length;

    var daysEl = document.getElementById('timeline-days');
    if (daysEl) daysEl.textContent = days.length;

    panel.classList.add('active');
    panel.style.display = 'block';

    document.dispatchEvent(new CustomEvent('crucix:timeline-toggled', {
      detail: { visible: true, days: days.length, points: datedPoints.length }
    }));
    logMsg('timeline: ' + days.length + ' дней, ' + datedPoints.length + ' точек');
  }

  // --- Экспорт ---
  window.CrucixHeatTimeline = {
    toggleHeat: toggleHeat,
    toggleTimeline: toggleTimeline,
    collectActivePoints: collectActivePoints
  };

  // Алиасы для onclick в HTML
  window.toggleHeat = toggleHeat;
  window.toggleTimeline = toggleTimeline;

  logMsg('модуль загружен v2 (использует #timeline-panel из HTML)');
})();
