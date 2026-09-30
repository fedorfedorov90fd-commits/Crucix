// ============================================================
// TOPBAR.JS — Кнопки топбара Forecast Map (v2.0)
// ============================================================
// Расширенный снапшот до ~500 КБ. Секции:
//   1. Заголовок
//   2. Сводка
//   3. Полная конфигурация 16 слоёв
//   4. Матрица слоёв
//   5. Диагностика по vizType
//   6. Здоровье слоёв
//   7. Активные слои с данными (value, confidence, horizon)
//   8. Choropleth-параметры
//   9. Легенда
//  10. Данные слоёв (все 208 стран × активные слои)
//  11. Страны (208)
//  12. Страны по статусам
//  13. DOM панели слоёв
//  14. КАРТА LEAFLET (новая)
//  15. LEAFLET-СЛОИ (новая, из map._layers)
//  16. ЦВЕТА СТРАН (новая, из SVG paths)
//  17. LEAFLET DOM (новая, структура .leaflet-pane)
//  18. CII
//  19. Панель статуса
//  20. DOM-слепок (до 1500 элементов)
//  21. Палитры
//  22. ОШИБКИ КОНСОЛИ (новая)
//  23. ЖУРНАЛ TOPBAR (новая)
//  24. Финал
// ============================================================

console.log('TOPBAR.JS загружен (forecast-map v2.0)');

// ------------------------------------------------------------
// Перехват ошибок консоли
// ------------------------------------------------------------
window._consoleErrors = window._consoleErrors || [];
(function() {
    if (window._consoleHooked) return;
    window._consoleHooked = true;
    var origError = console.error;
    var origWarn = console.warn;
    console.error = function() {
        try {
            window._consoleErrors.push({
                level: 'error',
                time: new Date().toISOString(),
                message: Array.prototype.slice.call(arguments).map(function(a) {
                    return (typeof a === 'string') ? a : JSON.stringify(a);
                }).join(' ').slice(0, 500)
            });
            if (window._consoleErrors.length > 200) window._consoleErrors.shift();
        } catch (e) {}
        return origError.apply(console, arguments);
    };
    console.warn = function() {
        try {
            window._consoleErrors.push({
                level: 'warn',
                time: new Date().toISOString(),
                message: Array.prototype.slice.call(arguments).map(function(a) {
                    return (typeof a === 'string') ? a : JSON.stringify(a);
                }).join(' ').slice(0, 500)
            });
            if (window._consoleErrors.length > 200) window._consoleErrors.shift();
        } catch (e) {}
        return origWarn.apply(console, arguments);
    };
})();

// ------------------------------------------------------------
// Вспомогательные
// ------------------------------------------------------------
function _fmt(n, d) {
    if (typeof n !== 'number' || isNaN(n)) return String(n);
    return n.toFixed(d === undefined ? 4 : d);
}

function _collectDOMSnapshot(limit) {
    limit = limit || 1500;
    var result = [];
    var index = 0;
    var excludeIds = ['copy-btn', 'notification'];
    var skipTags = ['SCRIPT', 'STYLE', 'HTML', 'BODY', 'HEAD', 'META', 'LINK'];

    document.querySelectorAll('*').forEach(function(el) {
        if (result.length >= limit) return;
        if (el.id && excludeIds.indexOf(el.id) !== -1) return;
        if (skipTags.indexOf(el.tagName) !== -1) return;

        var rect = el.getBoundingClientRect();
        var cs = window.getComputedStyle(el);
        if (rect.width === 0 && rect.height === 0) return;
        if (cs.display === 'none' || cs.visibility === 'hidden') return;

        var text = '';
        for (var i = 0; i < el.childNodes.length; i++) {
            var node = el.childNodes[i];
            if (node.nodeType === 3) text += node.textContent.trim();
        }
        if (!text && el.textContent) text = el.textContent.trim().slice(0, 120);
        if (!text && !el.id && !el.className) return;

        var selector = el.tagName.toLowerCase();
        if (el.id) selector += '#' + el.id;
        if (el.className && typeof el.className === 'string') {
            var cls = el.className.split(' ').filter(function(c) { return c; }).join('.');
            if (cls) selector += '.' + cls;
        }

        result.push({
            index: ++index,
            selector: selector,
            text: text || null,
            coords: {
                x: Math.round(rect.left + window.pageXOffset),
                y: Math.round(rect.top + window.pageYOffset),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            },
            styles: {
                color: cs.color,
                backgroundColor: cs.backgroundColor,
                fontSize: cs.fontSize,
                display: cs.display
            }
        });
    });
    return result;
}

// ------------------------------------------------------------
// НОВОЕ: Снимок Leaflet-карты
// ------------------------------------------------------------
function _collectLeafletSnapshot() {
    var map = window.map;
    if (!map || typeof map.getCenter !== 'function') {
        return { available: false, reason: 'window.map не Leaflet-объект' };
    }
    var snap = {
        available: true,
        center: map.getCenter ? { lat: map.getCenter().lat, lng: map.getCenter().lng } : null,
        zoom: map.getZoom ? map.getZoom() : null,
        bounds: map.getBounds ? {
            sw: { lat: map.getBounds().getSouthWest().lat, lng: map.getBounds().getSouthWest().lng },
            ne: { lat: map.getBounds().getNorthEast().lat, lng: map.getBounds().getNorthEast().lng }
        } : null,
        minZoom: map.options ? map.options.minZoom : null,
        maxZoom: map.options ? map.options.maxZoom : null,
        zoomSnap: map.options ? map.options.zoomSnap : null,
        containerSize: map.getSize ? { x: map.getSize().x, y: map.getSize().y } : null,
        layerCount: 0,
        tileLayerCount: 0,
        geoJSONLayerCount: 0,
        markerCount: 0,
        layers: []
    };
    if (map._layers) {
        var keys = Object.keys(map._layers);
        snap.layerCount = keys.length;
        for (var i = 0; i < keys.length; i++) {
            var l = map._layers[keys[i]];
            var ltype = 'unknown';
            if (l instanceof L.TileLayer) { ltype = 'tile'; snap.tileLayerCount++; }
            else if (l instanceof L.GeoJSON) { ltype = 'geojson'; snap.geoJSONLayerCount++; }
            else if (l instanceof L.Marker) { ltype = 'marker'; snap.markerCount++; }
            else if (l instanceof L.LayerGroup) { ltype = 'layerGroup'; }
            else if (l instanceof L.FeatureGroup) { ltype = 'featureGroup'; }
            var entry = { id: keys[i], type: ltype };
            if (ltype === 'tile') {
                entry.url = l._url || '';
                entry.opacity = l.options ? l.options.opacity : null;
            }
            if (ltype === 'geojson' && l.getLayers) {
                entry.featureCount = l.getLayers().length;
            }
            if (l.getBounds) {
                try {
                    var b = l.getBounds();
                    entry.bounds = { sw: { lat: b.getSouthWest().lat, lng: b.getSouthWest().lng }, ne: { lat: b.getNorthEast().lat, lng: b.getNorthEast().lng } };
                } catch (e) {}
            }
            snap.layers.push(entry);
        }
    }
    return snap;
}

// ------------------------------------------------------------
// НОВОЕ: Снимок SVG-путей стран
// ------------------------------------------------------------
function _collectSVGPaths() {
    var paths = document.querySelectorAll('.leaflet-overlay-pane svg path');
    var result = [];
    var limit = 500;
    var counter = 0;
    paths.forEach(function(p) {
        if (counter >= limit) return;
        counter++;
        var cs = window.getComputedStyle(p);
        var bbox = null;
        try { var b = p.getBBox(); bbox = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; } catch (e) {}
        result.push({
            idx: counter,
            fill: cs.fill,
            fillOpacity: cs.fillOpacity,
            stroke: cs.stroke,
            strokeWidth: cs.strokeWidth,
            bbox: bbox,
            classes: p.getAttribute('class') || null,
            title: p.querySelector('title') ? p.querySelector('title').textContent : null
        });
    });
    return result;
}

// ------------------------------------------------------------
// НОВОЕ: Снимок Leaflet DOM (панели)
// ------------------------------------------------------------
function _collectLeafletDOM() {
    var panes = document.querySelectorAll('.leaflet-pane');
    var result = [];
    panes.forEach(function(pane) {
        var children = pane.children.length;
        var cs = window.getComputedStyle(pane);
        result.push({
            className: pane.className,
            childrenCount: children,
            zIndex: cs.zIndex,
            display: cs.display,
            opacity: cs.opacity
        });
    });
    return result;
}

// ------------------------------------------------------------
// ОСНОВНАЯ ФУНКЦИЯ: СНАПШОТ v2.0
// ------------------------------------------------------------
window.copyAllData = function() {
    var out = [];
    var sep = '='.repeat(60);

    var allLayers = window.allLayers || [];
    var activeIds = window.activeLayerIds || new Set();
    var cache = window.layerCache || {};
    var cacheKeys = Object.keys(cache);
    var countries = window.ALL_COUNTRIES || [];
    var mapObj = window.map;

    // ============ 1. ЗАГОЛОВОК ============
    out.push(sep);
    out.push('=== CRUCIX — FORECAST MAP (snapshot v2.0) ===');
    out.push('Дата: ' + new Date().toLocaleString('ru-RU'));
    out.push('URL: ' + window.location.href);
    out.push('Окно: ' + window.innerWidth + '×' + window.innerHeight);
    out.push('Карта: forecasts');
    out.push('UA: ' + navigator.userAgent);
    out.push('Версия copy-data: 2.0 (forecast-map, расширенный)');
    out.push('');

    // ============ 2. СВОДКА ============
    out.push('--- СВОДКА ---');
    out.push('Текущий слой: ' + (window.currentLayer || '—'));
    out.push('Слоёв всего: ' + allLayers.length);
    out.push('Активных: ' + activeIds.size);
    out.push('Кэшированных: ' + cacheKeys.length);
    out.push('Стран: ' + countries.length);
    out.push('');

    // ============ 14. КАРТА LEAFLET (поднято в начало) ============
    var lsnap = _collectLeafletSnapshot();
    out.push('--- КАРТА LEAFLET ---');
    if (!lsnap.available) {
        out.push('Статус: НЕ ДОСТУПНА (' + lsnap.reason + ')');
    } else {
        out.push('Доступна: ДА');
        out.push('Центр: ' + _fmt(lsnap.center.lat) + ', ' + _fmt(lsnap.center.lng));
        out.push('Zoom: ' + lsnap.zoom);
        out.push('Bounds SW: ' + _fmt(lsnap.bounds.sw.lat) + ', ' + _fmt(lsnap.bounds.sw.lng));
        out.push('Bounds NE: ' + _fmt(lsnap.bounds.ne.lat) + ', ' + _fmt(lsnap.bounds.ne.lng));
        out.push('MinZoom: ' + lsnap.minZoom + ', MaxZoom: ' + lsnap.maxZoom);
        out.push('ZoomSnap: ' + lsnap.zoomSnap);
        out.push('Размер контейнера: ' + lsnap.containerSize.x + '×' + lsnap.containerSize.y);
        out.push('Всего слоёв в карте: ' + lsnap.layerCount);
        out.push('  tile: ' + lsnap.tileLayerCount);
        out.push('  geojson: ' + lsnap.geoJSONLayerCount);
        out.push('  marker: ' + lsnap.markerCount);
    }
    out.push('');

    // ============ 15. LEAFLET-СЛОИ (из map._layers) ============
    out.push('--- LEAFLET-СЛОИ (map._layers, ' + (lsnap.layers ? lsnap.layers.length : 0) + ') ---');
    if (lsnap.layers) {
        for (var li = 0; li < lsnap.layers.length; li++) {
            var entry = lsnap.layers[li];
            out.push('[' + (li + 1) + '] id=' + entry.id + ' type=' + entry.type);
            if (entry.url) out.push('     url=' + entry.url.slice(0, 100));
            if (entry.opacity !== undefined && entry.opacity !== null) out.push('     opacity=' + entry.opacity);
            if (entry.featureCount !== undefined) out.push('     features=' + entry.featureCount);
            if (entry.bounds) out.push('     bounds SW(' + _fmt(entry.bounds.sw.lat, 2) + ', ' + _fmt(entry.bounds.sw.lng, 2) + ') NE(' + _fmt(entry.bounds.ne.lat, 2) + ', ' + _fmt(entry.bounds.ne.lng, 2) + ')');
        }
    }
    out.push('');

    // ============ 16. ЦВЕТА СТРАН (SVG paths) ============
    var svgPaths = _collectSVGPaths();
    out.push('--- ЦВЕТА СТРАН (SVG, ' + svgPaths.length + ') ---');
    out.push('idx | fill            | opacity | stroke         | sw    | title');
    out.push('----|-----------------|---------|----------------|-------|------');
    for (var spi = 0; spi < svgPaths.length; spi++) {
        var sp = svgPaths[spi];
        out.push(
            String(sp.idx).padStart(3) + ' | ' +
            String(sp.fill).padEnd(15) + ' | ' +
            String(sp.fillOpacity).padStart(7) + ' | ' +
            String(sp.stroke).padEnd(14) + ' | ' +
            String(sp.strokeWidth).padStart(5) + ' | ' +
            (sp.title || '—')
        );
    }
    out.push('');

    // ============ 17. LEAFLET DOM (панели) ============
    var leafletDOM = _collectLeafletDOM();
    out.push('--- LEAFLET DOM (' + leafletDOM.length + ' panes) ---');
    for (var ldi = 0; ldi < leafletDOM.length; ldi++) {
        var pane = leafletDOM[ldi];
        out.push(pane.className + ' | children=' + pane.childrenCount + ' z=' + pane.zIndex + ' display=' + pane.display + ' opacity=' + pane.opacity);
    }
    out.push('');

    // ============ 3. ПОЛНАЯ КОНФИГУРАЦИЯ СЛОЁВ ============
    out.push('--- ПОЛНАЯ КОНФИГУРАЦИЯ СЛОЁВ (' + allLayers.length + ') ---');
    for (var i = 0; i < allLayers.length; i++) {
        var l = allLayers[i];
        var idx = String(i + 1).padStart(2, '0');
        var cached = cache[l.id];
        var objCount = cached ? cached.length : 0;
        var icon = objCount > 0 ? 'OK' : 'NO';
        var config = (window.getLayerConfig ? window.getLayerConfig(l.id) : {}) || {};
        out.push('[' + idx + '] ' + icon + ' ' + l.id);
        out.push('  Name:     ' + (l.name || '—'));
        out.push('  Category: ' + (l.category || '—'));
        out.push('  vizType:  ' + (l.vizType || 'choropleth'));
        out.push('  Method:   ' + (config.method || 'manual'));
        out.push('  Palette:  ' + (config.palette || 'RdBu5'));
        if (config.breaks) out.push('  Breaks:   [' + config.breaks.join(', ') + ']');
        if (l.horizon_default) out.push('  Horizon:  ' + l.horizon_default + ' дней');
        out.push('  Data:     ' + objCount + ' объектов');
        out.push('');
    }

    // ============ 4. МАТРИЦА СЛОЁВ ============
    out.push('--- МАТРИЦА СЛОЁВ ---');
    out.push('№  | ID                        | vizType      | Метод    | Палитра     | Актив | Данных');
    out.push('---|---------------------------|--------------|----------|-------------|-------|-------');
    for (var mi = 0; mi < allLayers.length; mi++) {
        var ml = allLayers[mi];
        var mActive = activeIds.has(ml.id) ? 'YES' : '—';
        var mCache = cache[ml.id];
        var mCount = mCache ? mCache.length : 0;
        var mConf = (window.getLayerConfig ? window.getLayerConfig(ml.id) : {}) || {};
        out.push(
            String(mi + 1).padStart(2, '0') + ' | ' +
            (ml.id || '').padEnd(25) + ' | ' +
            (ml.vizType || 'choropleth').padEnd(12) + ' | ' +
            (mConf.method || 'manual').padEnd(8) + ' | ' +
            (mConf.palette || 'RdBu5').padEnd(11) + ' | ' +
            mActive.padEnd(5) + ' | ' + mCount
        );
    }
    out.push('');

    // ============ 5. ДИАГНОСТИКА ============
    out.push('--- ДИАГНОСТИКА ПО vizType ---');
    var vizTypes = {};
    for (var vi = 0; vi < allLayers.length; vi++) {
        var vt = allLayers[vi].vizType || 'choropleth';
        if (!vizTypes[vt]) vizTypes[vt] = { total: 0, active: 0, withData: 0 };
        vizTypes[vt].total++;
        if (activeIds.has(allLayers[vi].id)) vizTypes[vt].active++;
        var vc = cache[allLayers[vi].id];
        if (vc && vc.length > 0) vizTypes[vt].withData++;
    }
    for (var vtk in vizTypes) {
        var vv = vizTypes[vtk];
        out.push(vtk.padEnd(12) + ': всего ' + vv.total + ', активных ' + vv.active + ', с данными ' + vv.withData);
    }
    out.push('');

    // ============ 6. ЗДОРОВЬЕ СЛОЁВ ============
    out.push('--- ЗДОРОВЬЕ СЛОЁВ ---');
    for (var hi = 0; hi < allLayers.length; hi++) {
        var hl = allLayers[hi];
        var hc = cache[hl.id];
        var hStatus, hNote;
        if (!hc) { hStatus = 'НЕ ЗАГРУЖЕН'; hNote = 'Слой не в кеше'; }
        else if (hc.length === 0) { hStatus = 'НЕТ ДАННЫХ'; hNote = 'Пустой массив'; }
        else { hStatus = 'OK'; hNote = 'Объектов: ' + hc.length; }
        out.push(String(hi + 1).padStart(2, '0') + ' | ' + (hl.id || '').padEnd(25) + ' | ' + hStatus.padEnd(14) + ' | ' + hNote);
    }
    out.push('');

    // ============ 7. АКТИВНЫЕ СЛОИ С ДАННЫМИ ============
    out.push('--- АКТИВНЫЕ СЛОИ (' + activeIds.size + ') ---');
    var activeArr = Array.from(activeIds);
    for (var ai = 0; ai < activeArr.length; ai++) {
        var aid = activeArr[ai];
        if (aid === 'all') continue;
        var alayer = allLayers.find(function(x) { return x.id === aid; });
        var acached = cache[aid] || [];
        if (!alayer) continue;
        var aconf = (window.getLayerConfig ? window.getLayerConfig(aid) : {}) || {};
        out.push('');
        out.push('● ' + (alayer.name || '—') + ' (' + aid + ')');
        out.push('  vizType:  ' + (alayer.vizType || 'choropleth'));
        out.push('  Method:   ' + (aconf.method || 'manual'));
        out.push('  Palette:  ' + (aconf.palette || 'RdBu5'));
        out.push('  Objects:  ' + acached.length);
    }
    out.push('');

    // ============ 8. CHOROPLETH-ПАРАМЕТРЫ ============
    if (window.currentChoroplethConfig) {
        var cfg = window.currentChoroplethConfig;
        out.push('--- CHOROPLETH-ПАРАМЕТРЫ ТЕКУЩЕГО СЛОЯ ---');
        out.push('LayerId:    ' + (cfg.layerId || '—'));
        out.push('LayerName:  ' + (cfg.layerName || '—'));
        out.push('Method:     ' + (cfg.method || 'manual'));
        out.push('Palette:    ' + (Array.isArray(cfg.palette) ? cfg.palette.join(', ') : (cfg.palette || '—')));
        out.push('NumClasses: ' + (cfg.numClasses || 5));
        if (cfg.breaks) out.push('Breaks:     [' + cfg.breaks.map(function(b) { return (typeof b === 'number') ? b.toFixed(4) : b; }).join(', ') + ']');
        if (cfg.gvf !== undefined) out.push('GVF:        ' + cfg.gvf.toFixed(4));
        if (cfg.stats) {
            out.push('Stats:      count=' + cfg.stats.count + ' min=' + _fmt(cfg.stats.min) + ' max=' + _fmt(cfg.stats.max) + ' mean=' + _fmt(cfg.stats.mean));
        }
        out.push('');
    }

    // ============ 9. ЛЕГЕНДА ============
    var legend = document.getElementById('choropleth-legend');
    if (legend && legend.innerHTML.trim()) {
        out.push('--- ЛЕГЕНДА (DOM) ---');
        out.push(legend.textContent.trim().slice(0, 3000));
        out.push('');
    }

    // ============ 10. ДАННЫЕ СЛОЁВ ============
    out.push('--- ДАННЫЕ СЛОЁВ ---');
    var dataIds = new Set();
    activeIds.forEach(function(id) { if (id !== 'all') dataIds.add(id); });
    cacheKeys.forEach(function(id) { dataIds.add(id); });
    var sortedIds = Array.from(dataIds).sort();

    for (var di = 0; di < sortedIds.length; di++) {
        var lid = sortedIds[di];
        var dl = allLayers.find(function(x) { return x.id === lid; });
        if (!dl) continue;
        var dc = cache[lid];
        var dHas = dc && dc.length > 0;
        var dConf = (window.getLayerConfig ? window.getLayerConfig(lid) : {}) || {};

        out.push('');
        out.push('[' + String(di + 1).padStart(2, '0') + '] ' + lid + ' ' + (dHas ? 'OK' : 'NO'));
        out.push('Name:     ' + (dl.name || '—'));
        out.push('vizType:  ' + (dl.vizType || 'choropleth'));
        out.push('Method:   ' + (dConf.method || 'manual'));
        out.push('Palette:  ' + (dConf.palette || 'RdBu5'));
        out.push('Objects:  ' + (dHas ? dc.length : 0));

        if (dHas && dc.length > 0) {
            out.push('');
            out.push('Data (все ' + dc.length + ' объектов):');
            out.push('name                                | probability | confidence | horizon | class');
            out.push('------------------------------------|-------------|------------|---------|------');
            for (var dj = 0; dj < dc.length; dj++) {
                var f = dc[dj];
                var fname = f.name || (f.properties && f.properties.name) || '—';
                var fprob = f.value !== undefined ? f.value : (f.properties && f.properties.value);
                var fconf = f.confidence !== undefined ? f.confidence : (f.properties && f.properties.confidence);
                var fhoriz = f.horizon_days !== undefined ? f.horizon_days : (f.properties && f.properties.horizon);
                var fcls = f.properties && f.properties.class;
                var probStr = (typeof fprob === 'number') ? fprob.toFixed(2).padStart(11) : String('—').padStart(11);
                var confStr = (typeof fconf === 'number') ? fconf.toFixed(3).padStart(10) : String('—').padStart(10);
                var horizStr = (typeof fhoriz === 'number') ? String(fhoriz).padStart(7) : '—'.padStart(7);
                var clsStr = (typeof fcls === 'number') ? String(fcls).padStart(5) : '—'.padStart(5);
                out.push(fname.padEnd(35) + ' | ' + probStr + ' | ' + confStr + ' | ' + horizStr + ' | ' + clsStr);
            }
        }
    }
    out.push('');

    // ============ 11. СТРАНЫ ============
    out.push('--- СТРАНЫ (' + countries.length + ') ---');
    out.push('name                           | status     | lat       | lng');
    out.push('-------------------------------|------------|-----------|----------');
    for (var ci = 0; ci < countries.length; ci++) {
        var c = countries[ci];
        out.push(
            (c.name || '—').padEnd(30) + ' | ' +
            (c.status || '—').padEnd(10) + ' | ' +
            String((c.lat || 0).toFixed(4)).padStart(9) + ' | ' +
            String((c.lng || 0).toFixed(4)).padStart(8)
        );
    }
    out.push('');

    // ============ 12. СТРАНЫ ПО СТАТУСАМ ============
    var groups = {};
    for (var gi = 0; gi < countries.length; gi++) {
        var gs = countries[gi].status || 'unknown';
        if (!groups[gs]) groups[gs] = [];
        groups[gs].push(countries[gi].name || '—');
    }
    out.push('--- СТРАНЫ ПО СТАТУСАМ ---');
    for (var gk in groups) {
        out.push(gk.toUpperCase() + ' (' + groups[gk].length + '): ' + groups[gk].join(', '));
    }
    out.push('');

    // ============ 13. DOM ПАНЕЛИ СЛОЁВ ============
    out.push('--- DOM ПАНЕЛИ СЛОЁВ ---');
    var layerButtons = document.querySelectorAll('[data-layer-id]');
    out.push('Всего кнопок:    ' + layerButtons.length);
    var activeButtons = 0;
    for (var bi = 0; bi < layerButtons.length; bi++) {
        if (layerButtons[bi].classList.contains('active')) activeButtons++;
    }
    out.push('Активных кнопок: ' + activeButtons);
    out.push('');

    // ============ 18. CII ============
    var ciiPanel = document.getElementById('cii-panel');
    if (ciiPanel) {
        out.push('--- CII (Индекс нестабильности) ---');
        var ciiGlobal = ciiPanel.querySelector('.cii-global');
        out.push('Global: ' + (ciiGlobal ? ciiGlobal.textContent.trim() : '—'));
        var ciiCountries = ciiPanel.querySelectorAll('.cii-country');
        for (var cii = 0; cii < ciiCountries.length; cii++) {
            var el = ciiCountries[cii];
            var nm = el.querySelector('.cii-name');
            var sc = el.querySelector('.cii-score');
            out.push('  ' + (nm ? nm.textContent.trim() : '—') + ': ' + (sc ? sc.textContent.trim() : '—'));
        }
        out.push('');
    }

    // ============ 19. ПАНЕЛЬ СТАТУСА ============
    out.push('--- ПАНЕЛЬ СТАТУСА ---');
    var acEl = document.getElementById('active-layers-count');
    out.push('Active count:  ' + (acEl ? acEl.textContent.trim() : '—'));
    var lcEl = document.getElementById('layer-count');
    out.push('Layer count:   ' + (lcEl ? lcEl.textContent.trim() : '—'));
    var ccEl = document.getElementById('countries-count');
    out.push('Countries:     ' + (ccEl ? ccEl.textContent.trim() : '—'));
    var ssiEl = document.getElementById('ssi-label') || document.getElementById('ssi-value');
    out.push('SSI:           ' + (ssiEl ? ssiEl.textContent.trim() : '—'));
    out.push('CurrentLayer:  ' + (window.currentLayer || '—'));
    out.push('');

    // ============ 20. DOM-СЛЕПОК ============
    var domSnapshot = _collectDOMSnapshot(1500);
    if (domSnapshot.length > 0) {
        out.push('--- DOM-СЛЕПОК (' + domSnapshot.length + ' элементов) ---');
        for (var dni = 0; dni < domSnapshot.length; dni++) {
            var d = domSnapshot[dni];
            out.push('[' + d.index + '] ' + d.selector);
            out.push('  Текст: ' + (d.text || '—'));
            out.push('  Координаты: ' + d.coords.x + ',' + d.coords.y + ' (' + d.coords.width + '×' + d.coords.height + ')');
            out.push('  Цвет: ' + d.styles.color + ' | Фон: ' + d.styles.backgroundColor + ' | Шрифт: ' + d.styles.fontSize);
        }
        out.push('');
    }

    // ============ 21. ПАЛИТРЫ ============
    out.push('--- ДОСТУПНЫЕ ПАЛИТРЫ ---');
    if (window.COLOR_SCHEMES) {
        for (var pname in window.COLOR_SCHEMES) {
            out.push(pname + ': [' + window.COLOR_SCHEMES[pname].join(', ') + ']');
        }
    }
    out.push('');

    // ============ 22. ОШИБКИ КОНСОЛИ ============
    var errs = window._consoleErrors || [];
    out.push('--- ОШИБКИ КОНСОЛИ (' + errs.length + ') ---');
    for (var ei = 0; ei < errs.length; ei++) {
        var e = errs[ei];
        out.push('[' + e.time + '] [' + e.level.toUpperCase() + '] ' + e.message);
    }
    out.push('');

    // ============ 23. ЖУРНАЛ TOPBAR ============
    out.push('--- ЖУРНАЛ TOPBAR ---');
    out.push('Снапшот собран: ' + new Date().toLocaleString('ru-RU'));
    out.push('Секций: 24');
    out.push('Элементов DOM: ' + domSnapshot.length);
    out.push('SVG paths: ' + svgPaths.length);
    out.push('Leaflet layers: ' + (lsnap.layers ? lsnap.layers.length : 0));
    out.push('Ошибок консоли: ' + errs.length);
    out.push('');

    // ============ 24. ФИНАЛ ============
    out.push('--- CRUCIX OSINT TERMINAL ---');
    out.push('🌐 ' + window.location.origin + '/forecast-map');
    out.push(sep);

    // ============ СБОРКА ============
    var text = out.join('\n');
    var byteLength;
    try {
        byteLength = new TextEncoder().encode(text).length;
    } catch (e) {
        byteLength = text.length * 2;
    }
    var sizeKB = Math.round(byteLength / 1024);

    console.log('[copyAllData v2.0] Снапшот: ' + text.length + ' символов, ' + byteLength + ' байт, ~' + sizeKB + ' КБ');

    function fallbackCopy(txt) {
        var ta = document.createElement('textarea');
        ta.value = txt;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            console.log('[copyAllData v2.0] OK (fallback): ~' + sizeKB + ' КБ');
        } catch (e) {
            console.error('[copyAllData v2.0] Fallback не сработал:', e);
        }
        document.body.removeChild(ta);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
            console.log('[copyAllData v2.0] OK: ~' + sizeKB + ' КБ');
            var btn = document.getElementById('copy-btn');
            if (btn) {
                var original = btn.textContent;
                btn.textContent = 'OK ' + sizeKB + ' KB';
                setTimeout(function() { btn.textContent = original || '📋 КОПИРОВАТЬ'; }, 3000);
            }
            if (window.showNotification) window.showNotification('Скопировано: ~' + sizeKB + ' КБ', 'success');
        }).catch(function (e) {
            console.error('[copyAllData v2.0] Ошибка clipboard:', e);
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
};

// ------------------------------------------------------------
// HELP
// ------------------------------------------------------------
window.openHelp = function() {
    window.open('/help', '_blank');
};

// ------------------------------------------------------------
// ЯЗЫК
// ------------------------------------------------------------
window.setLanguage = function(lang) {
    if (!window.LANG_DATA || !window.LANG_DATA[lang]) return;
    localStorage.setItem('crucix-lang', lang);
    var data = window.LANG_DATA[lang];
    var brand = document.getElementById('brand-text');
    if (brand) brand.textContent = data.brand;
    document.querySelectorAll('.lang-btn').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });
    console.log('[setLanguage] ' + lang);
};

// ------------------------------------------------------------
// ТЕПЛОВАЯ / ХРОНОЛОГИЯ
// ------------------------------------------------------------
window.toggleHeat = function() {
    if (typeof window.toggleHeatTimeline === 'function') {
        window.toggleHeatTimeline();
    } else {
        console.log('[toggleHeat] не реализовано');
    }
};

window.toggleTimeline = function() {
    var panel = document.getElementById('timeline-panel');
    if (panel) {
        panel.style.display = (panel.style.display === 'none' || !panel.style.display) ? 'block' : 'none';
    }
};

// ------------------------------------------------------------
// ПАНЕЛЬ СЛОЁВ
// ------------------------------------------------------------
window.toggleLayerPanel = function() {
    var panel = document.getElementById('layer-panel');
    if (panel) panel.classList.toggle('collapsed');
};

// ------------------------------------------------------------
// ВКЛЮЧИТЬ ВСЕ / ВЫКЛЮЧИТЬ ВСЕ
// ------------------------------------------------------------
window.enableAllLayers = function() {
    var layers = window.allLayers || [];
    if (layers.length === 0) return;
    if (!window.activeLayerIds) window.activeLayerIds = new Set();
    console.log('[enableAllLayers] Старт, слоёв: ' + layers.length);

    var i = 0;
    function next() {
        if (i >= layers.length) {
            console.log('[enableAllLayers] Всего: ' + layers.length);
            return;
        }
        var layer = layers[i++];
        if (!window.activeLayerIds.has(layer.id)) {
            window.activeLayerIds.add(layer.id);
            try {
                if (window.ForecastMap && window.ForecastMap.loadLayerData) {
                    window.ForecastMap.loadLayerData(layer.id);
                }
            } catch (e) {
                console.warn('[enableAllLayers] ' + layer.id + ': ' + e.message);
            }
        }
        setTimeout(next, 30);
    }
    next();
};

window.disableAllLayers = function() {
    window.activeLayerIds = new Set();
    if (window.resetChoropleth) window.resetChoropleth();
    var legend = document.getElementById('choropleth-legend');
    if (legend) legend.innerHTML = '';
    console.log('[disableAllLayers] Все слои выключены');
};

// ------------------------------------------------------------
// ОБНОВЛЕНИЕ ВРЕМЕНИ
// ------------------------------------------------------------
window.updateLastRefresh = function() {
    var el = document.getElementById('update-text');
    if (el) el.textContent = new Date().toLocaleTimeString('ru-RU');
};

console.log('TOPBAR.JS готов (forecast-map v2.0, расширенный снапшот)');
