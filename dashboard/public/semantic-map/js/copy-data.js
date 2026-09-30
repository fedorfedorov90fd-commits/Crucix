// ============================================================
// COPY-DATA.JS — Снапшот Semantic Map (v1.0)
// ============================================================
// Собирает то, что РЕАЛЬНО есть в semantic-map:
//   - 35 слоёв (marker/sentiment/cluster/credibility)
//   - window.activeLayerIds (массив, часто пустой)
//   - window.layerCache (объект, обычно пустой)
//   - window.markerData (рандомные маркеры из markers.js)
//   - window.ALL_COUNTRIES (176 стран, 5 статусов)
//   - window.LAYER_OVERRIDES (палитры/методы)
//   - window.SSI_VALUE, #ssi-value, #ssi-fill
//   - DOM-панель слоёв (кнопки [data-layer-id])
//   - Leaflet-карта
//   - DOM-слепок
//
// НЕ ищет: COLOR_SCHEMES, currentChoroplethConfig, #cii-panel,
//          .cii-country, .layer-category, .legend-item
//          (их в semantic-map нет)
// ============================================================

console.log('📋 COPY-DATA.JS загружен (Semantic Map, snapshot v1.0)');

(function () {

    function safeNotify(msg, type) {
        try {
            if (typeof window.showNotification === 'function') {
                window.showNotification(msg, type || 'success');
            }
        } catch (e) { /* ignore */ }
    }

    function getValue(obj) {
        if (obj == null) return null;
        if (obj.value !== undefined) return obj.value;
        if (obj.properties && obj.properties.value !== undefined) return obj.properties.value;
        return null;
    }

    function getName(obj) {
        if (obj == null) return '—';
        if (obj.name) return obj.name;
        if (obj.properties && obj.properties.name) return obj.properties.name;
        if (obj.title) return obj.title;
        if (obj.country) return obj.country;
        return '—';
    }

    // ------------------------------------------------------------
    // DOM-слепок
    // ------------------------------------------------------------
    function collectDOMSnapshot(limit) {
        limit = limit || 300;
        const result = [];
        let index = 0;
        const excludeIds = ['copy-btn', 'notification'];

        document.querySelectorAll('*').forEach(function (el) {
            if (result.length >= limit) return;
            if (excludeIds.indexOf(el.id) !== -1) return;
            if (['SCRIPT', 'STYLE', 'HTML', 'BODY', 'HEAD', 'META', 'LINK'].indexOf(el.tagName) !== -1) return;

            const rect = el.getBoundingClientRect();
            const computed = window.getComputedStyle(el);
            if (rect.width === 0 && rect.height === 0) return;
            if (computed.display === 'none' || computed.visibility === 'hidden') return;

            let text = '';
            for (const node of el.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) text += node.textContent.trim();
            }
            if (!text && el.textContent) text = el.textContent.trim().slice(0, 120);
            if (!text && !el.id && !el.className) return;

            let selector = el.tagName.toLowerCase();
            if (el.id) selector += '#' + el.id;
            if (el.className && typeof el.className === 'string') {
                const cls = el.className.split(' ').filter(function (c) { return c; }).join('.');
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
                    color: computed.color,
                    backgroundColor: computed.backgroundColor,
                    fontSize: computed.fontSize,
                    display: computed.display
                }
            });
        });
        return result;
    }

    // ------------------------------------------------------------
    // Основная функция
    // ------------------------------------------------------------
    window.copyAllData = function () {
        const out = [];
        const sep = '='.repeat(60);

        // === ЗАГОЛОВОК ===
        out.push(sep);
        out.push('=== CRUCIX — SEMANTIC MAP (snapshot v1.0) ===');
        out.push('Дата: ' + new Date().toLocaleString('ru-RU'));
        out.push('URL: ' + window.location.href);
        out.push('Окно: ' + window.innerWidth + '×' + window.innerHeight);
        out.push('Карта: meanings (semantic)');
        out.push('UA: ' + navigator.userAgent);
        out.push('Версия copy-data: 1.0 (semantic-map)');
        out.push('');

        // === СБОР ДАННЫХ ===
        const allLayers = window.allLayers || [];
        const activeIdsRaw = window.activeLayerIds || [];
        const activeIds = new Set();
        // activeLayerIds в semantic-map — массив (не Set)
        if (typeof activeIdsRaw.forEach === 'function') {
            activeIdsRaw.forEach(function (id) { if (id !== 'all') activeIds.add(id); });
        }
        const cache = window.layerCache || {};
        const cacheKeys = Object.keys(cache);
        const markerData = window.markerData || [];
        const countries = window.ALL_COUNTRIES || [];
        const mapObj = window.leafletMap;
        const overrides = window.LAYER_OVERRIDES || {};

        // ============================================================
        // 1. СВОДКА
        // ============================================================
        out.push('--- СВОДКА ---');
        out.push('Стран: ' + countries.length);
        out.push('Слоёв всего: ' + allLayers.length);
        out.push('Активных слоёв (activeLayerIds): ' + activeIds.size);
        out.push('Кэшированных слоёв (layerCache): ' + cacheKeys.length);
        out.push('Маркеров (markerData): ' + markerData.length);
        out.push('Текущий слой (currentLayer): ' + (window.currentLayer || '—'));
        out.push('SSI: ' + (window.SSI_VALUE !== undefined ? window.SSI_VALUE : '—'));
        out.push('CII: ' + (window.CII_VALUE !== undefined ? window.CII_VALUE : '—'));
        out.push('');
        out.push('⚠️ ПРИМЕЧАНИЯ:');
        out.push('  • markerData генерируется случайно в markers.js (Math.random)');
        out.push('    — это НЕ реальные данные, а заглушка для демонстрации.');
        out.push('  • layerCache в semantic-map обычно пуст:');
        out.push('    layer-panel.js::loadLayer не делает fetch и не пишет в кэш.');
        out.push('  • activeLayerIds — массив, но layer-panel.js его не заполняет,');
        out.push('    поэтому «активных слоёв» обычно 0.');
        out.push('  • CII: cii.js пишет в #cii-value, которого нет в HTML — no-op.');
        out.push('  • Choropleth, легенда, COLOR_SCHEMES — в semantic-map отсутствуют.');
        out.push('');

        // ============================================================
        // 2. ПОЛНАЯ КОНФИГУРАЦИЯ СЛОЁВ
        // ============================================================
        out.push('--- СЛОИ (' + allLayers.length + ') ---');
        out.push('');
        for (let i = 0; i < allLayers.length; i++) {
            const l = allLayers[i];
            const idx = String(i + 1).padStart(2, '0');
            const cached = cache[l.id];
            const objCount = (cached && cached.length) ? cached.length : 0;
            const icon = objCount > 0 ? '✅' : (cached ? '⚠️' : '❌');
            const ov = overrides[l.id] || {};

            out.push('[' + idx + '] ' + icon + ' ' + l.id);
            out.push('  Name:     ' + (l.name || '—'));
            out.push('  Category: ' + (l.category || '—'));
            out.push('  vizType:  ' + (l.vizType || 'marker'));
            out.push('  Icon:     ' + (l.icon || '—'));
            out.push('  Color:    ' + (l.color || '—'));
            out.push('  Route:    ' + (l.route || '—'));
            out.push('  Crucix:   ' + (l.crucix ? 'yes' : 'no'));
            if (ov.palette) out.push('  Palette:  ' + ov.palette);
            if (ov.method) out.push('  Method:   ' + ov.method);
            if (ov.classes) out.push('  Classes:  ' + ov.classes);
            if (ov.breaks) out.push('  Breaks:   [' + ov.breaks.join(', ') + ']');
            if (ov.description) out.push('  Descr:    ' + ov.description);
            out.push('  Data:     ' + objCount + ' объектов (в layerCache)');
            out.push('');
        }

        // ============================================================
        // 3. МАТРИЦА СЛОЁВ
        // ============================================================
        out.push('--- МАТРИЦА СЛОЁВ ---');
        out.push('№  | ID                          | vizType     | Category     | Icon | Route | Active | Data');
        out.push('---|-----------------------------|-------------|--------------|------|-------|--------|-----');
        for (let i = 0; i < allLayers.length; i++) {
            const l = allLayers[i];
            const idx = String(i + 1).padStart(2, '0');
            const isActive = activeIds.has(l.id) ? '✅' : '—';
            const cached = cache[l.id];
            const dataCount = (cached && cached.length) ? cached.length : 0;
            const iconClean = (l.icon || '—').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim() || '—';
            out.push(
                idx + ' | ' +
                (l.id || '').padEnd(27) + ' | ' +
                (l.vizType || 'marker').padEnd(11) + ' | ' +
                (l.category || 'other').padEnd(12) + ' | ' +
                iconClean.padEnd(4) + ' | ' +
                (l.route ? 'yes' : '—').padEnd(5) + ' | ' +
                isActive + '      | ' + dataCount
            );
        }
        out.push('');

        // ============================================================
        // 4. ДИАГНОСТИКА ПО vizType И КАТЕГОРИЯМ
        // ============================================================
        out.push('--- ДИАГНОСТИКА ПО vizType ---');
        const vizTypes = {};
        for (let i = 0; i < allLayers.length; i++) {
            const vt = allLayers[i].vizType || 'marker';
            if (!vizTypes[vt]) vizTypes[vt] = { total: 0, active: 0, withData: 0, withRoute: 0 };
            vizTypes[vt].total++;
            if (activeIds.has(allLayers[i].id)) vizTypes[vt].active++;
            const c = cache[allLayers[i].id];
            if (c && c.length > 0) vizTypes[vt].withData++;
            if (allLayers[i].route) vizTypes[vt].withRoute++;
        }
        for (const vt in vizTypes) {
            const v = vizTypes[vt];
            out.push(vt.padEnd(12) + ': всего ' + String(v.total).padStart(2) +
                     ', активных ' + String(v.active).padStart(2) +
                     ', с route ' + String(v.withRoute).padStart(2) +
                     ', с данными ' + String(v.withData).padStart(2));
        }
        out.push('');

        out.push('--- ДИАГНОСТИКА ПО КАТЕГОРИЯМ ---');
        const cats = {};
        for (let i = 0; i < allLayers.length; i++) {
            const cat = allLayers[i].category || 'other';
            if (!cats[cat]) cats[cat] = { total: 0, active: 0, withData: 0, withRoute: 0 };
            cats[cat].total++;
            if (activeIds.has(allLayers[i].id)) cats[cat].active++;
            const c = cache[allLayers[i].id];
            if (c && c.length > 0) cats[cat].withData++;
            if (allLayers[i].route) cats[cat].withRoute++;
        }
        for (const cat in cats) {
            const cc = cats[cat];
            out.push(cat.padEnd(14) + ': всего ' + String(cc.total).padStart(2) +
                     ', активных ' + String(cc.active).padStart(2) +
                     ', с route ' + String(cc.withRoute).padStart(2) +
                     ', с данными ' + String(cc.withData).padStart(2));
        }
        out.push('');

        // ============================================================
        // 5. ЗДОРОВЬЕ СЛОЁВ
        // ============================================================
        out.push('--- ЗДОРОВЬЕ СЛОЁВ ---');
        out.push('№  | ID                          | Статус            | Route | Data');
        out.push('---|-----------------------------|-------------------|-------|-----');
        for (let i = 0; i < allLayers.length; i++) {
            const l = allLayers[i];
            const idx = String(i + 1).padStart(2, '0');
            const cached = cache[l.id];
            let status, objCount;

            if (l.route && (!cached || cached.length === 0)) {
                status = 'API, НЕ ЗАГРУЖЕН';
                objCount = 0;
            } else if (!cached) {
                status = 'НЕ В КЭШЕ (демо)';
                objCount = 0;
            } else if (cached.length === 0) {
                status = 'ПУСТО';
                objCount = 0;
            } else {
                status = 'OK';
                objCount = cached.length;
            }

            out.push(
                idx + ' | ' +
                (l.id || '').padEnd(27) + ' | ' +
                status.padEnd(17) + ' | ' +
                (l.route ? 'yes' : '—').padEnd(5) + ' | ' + objCount
            );
        }
        out.push('');

        // ============================================================
        // 6. АКТИВНЫЕ СЛОИ ПОДРОБНО
        // ============================================================
        if (activeIds.size > 0) {
            out.push('--- АКТИВНЫЕ СЛОИ (' + activeIds.size + ') ---');
            const activeArr = Array.from(activeIds);
            for (let ai = 0; ai < activeArr.length; ai++) {
                const id = activeArr[ai];
                const layer = allLayers.find(function (x) { return x.id === id; });
                if (!layer) continue;
                const ov = overrides[id] || {};
                const data = cache[id] || [];

                out.push('');
                out.push('● ' + (layer.name || '—') + ' (' + id + ')');
                out.push('  Категория: ' + (layer.category || '—'));
                out.push('  vizType:   ' + (layer.vizType || 'marker'));
                out.push('  Route:     ' + (layer.route || '—'));
                if (ov.palette) out.push('  Палитра:   ' + ov.palette);
                if (ov.method) out.push('  Метод:     ' + ov.method);
                out.push('  Объектов данных: ' + data.length);
            }
            out.push('');
        }

        // ============================================================
        // 7. МАРКЕРЫ
        // ============================================================
        out.push('--- МАРКЕРЫ ---');
        out.push('Всего: ' + markerData.length);
        out.push('⚠️ Источник: window.markerData, сгенерировано markers.js');
        out.push('   через Math.random() — это заглушка, не реальные данные.');
        out.push('');

        const markerLayers = allLayers.filter(function (l) { return l.vizType === 'marker'; });
        out.push('Marker-слоёв: ' + markerLayers.length);
        out.push('');

        const markersByLayer = {};
        for (let mi = 0; mi < markerData.length; mi++) {
            const m = markerData[mi];
            const lid = m.layer || 'unknown';
            if (!markersByLayer[lid]) markersByLayer[lid] = [];
            markersByLayer[lid].push(m);
        }

        for (let i = 0; i < markerLayers.length; i++) {
            const l = markerLayers[i];
            const idx = String(i + 1).padStart(2, '0');
            const arr = markersByLayer[l.id] || [];

            out.push('[' + idx + '] ' + l.id + ' (' + (l.name || '—') + ')');
            out.push('  Маркеров: ' + arr.length);

            const show = Math.min(arr.length, 20);
            for (let s = 0; s < show; s++) {
                const m = arr[s];
                out.push('  ' + (s + 1) + '. ' + (m.title || '—') +
                         ' | lat=' + (m.lat || 0).toFixed(2) +
                         ' lng=' + (m.lng || 0).toFixed(2) +
                         ' | layer=' + (m.layer || '—'));
            }
            if (arr.length > show) {
                out.push('  ... и ещё ' + (arr.length - show) + ' маркеров');
            }
            out.push('');
        }

        // ============================================================
        // 8. СТРАНЫ ПО СТАТУСАМ
        // ============================================================
        const groups = {};
        for (let i = 0; i < countries.length; i++) {
            const status = countries[i].status || 'unknown';
            if (!groups[status]) groups[status] = [];
            groups[status].push(countries[i].name || '—');
        }
        out.push('--- СТРАНЫ ПО СТАТУСАМ ---');
        const emojis = {
            critical: '🔴', 'pre-war': '🟠', high: '🟠',
            medium: '🟡', normal: '🟢', low: '🟢'
        };
        const statusOrder = ['critical', 'pre-war', 'high', 'medium', 'normal', 'low', 'unknown'];
        for (const status of statusOrder) {
            if (!groups[status]) continue;
            out.push((emojis[status] || '⚪') + ' ' + status.toUpperCase() +
                     ' (' + groups[status].length + '): ' + groups[status].join(', '));
        }
        out.push('');

        // ============================================================
        // 9. ПОЛНЫЙ СПИСОК СТРАН
        // ============================================================
        out.push('--- СТРАНЫ (' + countries.length + ') ---');
        out.push('name                           | status     | lat       | lng');
        out.push('-------------------------------|------------|-----------|----------');
        for (let i = 0; i < countries.length; i++) {
            const c = countries[i];
            out.push(
                (c.name || '—').padEnd(30) + ' | ' +
                (c.status || '—').padEnd(10) + ' | ' +
                String((c.lat || 0).toFixed(4)).padStart(9) + ' | ' +
                String((c.lng || 0).toFixed(4)).padStart(8)
            );
        }
        out.push('');

        // ============================================================
        // 10. SSI
        // ============================================================
        out.push('--- SSI ---');
        out.push('SSI_VALUE (window): ' + (window.SSI_VALUE !== undefined ? window.SSI_VALUE : '—'));
        const ssiVal = document.getElementById('ssi-value');
        out.push('#ssi-value:        ' + (ssiVal ? ssiVal.textContent.trim() : '—'));
        const ssiFill = document.getElementById('ssi-fill');
        if (ssiFill) {
            out.push('#ssi-fill width:   ' + (ssiFill.style.width || '—'));
        }
        out.push('');

        // ============================================================
        // 11. CII (если вдруг появится)
        // ============================================================
        const ciiPanel = document.getElementById('cii-panel');
        if (ciiPanel) {
            out.push('--- CII ---');
            const ciiVal = document.getElementById('cii-value');
            out.push('#cii-value: ' + (ciiVal ? ciiVal.textContent.trim() : '—'));
            const globalEl = ciiPanel.querySelector('.cii-global');
            if (globalEl) out.push('Global: ' + globalEl.textContent.trim());
            const tsEl = ciiPanel.querySelector('.cii-timestamp');
            if (tsEl) out.push('Source: ' + tsEl.textContent.trim());
            const ciiCountries = ciiPanel.querySelectorAll('.cii-country');
            for (let ci = 0; ci < ciiCountries.length; ci++) {
                const el = ciiCountries[ci];
                const nm = el.querySelector('.cii-name');
                const sc = el.querySelector('.cii-score');
                out.push('  ' + (nm ? nm.textContent.trim() : '—') + ': ' + (sc ? sc.textContent.trim() : '—'));
            }
            out.push('');
        } else {
            out.push('--- CII ---');
            out.push('CII-панель отсутствует в DOM (#cii-panel не найден).');
            out.push('CII_VALUE (window): ' + (window.CII_VALUE !== undefined ? window.CII_VALUE : '—'));
            out.push('');
        }

        // ============================================================
        // 12. DOM ПАНЕЛИ СЛОЁВ
        // ============================================================
        out.push('--- DOM ПАНЕЛИ СЛОЁВ ---');
        const layerButtons = document.querySelectorAll('[data-layer-id]');
        out.push('Всего кнопок:    ' + layerButtons.length);

        // Группировка по data-category (layer-panel.js пишет его на кнопки)
        const btnCats = {};
        let activeButtons = 0;
        for (let b = 0; b < layerButtons.length; b++) {
            const btn = layerButtons[b];
            const cat = btn.dataset.category || 'other';
            if (!btnCats[cat]) btnCats[cat] = [];
            btnCats[cat].push(btn);
            if (btn.classList.contains('active')) activeButtons++;
        }
        out.push('Активных кнопок: ' + activeButtons);
        out.push('');

        const catKeys = Object.keys(btnCats).sort();
        for (let ci = 0; ci < catKeys.length; ci++) {
            const cat = catKeys[ci];
            const btns = btnCats[cat];
            let catActive = 0;
            for (let cb = 0; cb < btns.length; cb++) {
                if (btns[cb].classList.contains('active')) catActive++;
            }
            out.push('[' + cat + '] кнопок: ' + btns.length + ', активных: ' + catActive);
            for (let cb = 0; cb < btns.length; cb++) {
                const lid = btns[cb].dataset.layerId;
                const isActive = btns[cb].classList.contains('active');
                out.push('  ' + (isActive ? '✅' : '❌') + ' ' + lid);
            }
        }
        out.push('');

        // ============================================================
        // 13. КАРТА
        // ============================================================
        if (mapObj && typeof mapObj.getCenter === 'function') {
            try {
                out.push('--- КАРТА ---');
                const center = mapObj.getCenter();
                const zoom = mapObj.getZoom();
                const bounds = mapObj.getBounds();
                out.push('Центр:  ' + center.lat.toFixed(4) + ', ' + center.lng.toFixed(4));
                out.push('Zoom:   ' + zoom);
                out.push('Bounds: SW(' + bounds.getSouthWest().lat.toFixed(4) + ', ' + bounds.getSouthWest().lng.toFixed(4) +
                         ') NE(' + bounds.getNorthEast().lat.toFixed(4) + ', ' + bounds.getNorthEast().lng.toFixed(4) + ')');
                const layersCount = mapObj._layers ? Object.keys(mapObj._layers).length : '—';
                out.push('Layers: ' + layersCount);
                out.push('');
            } catch (e) { /* ignore */ }
        }

        // ============================================================
        // 14. ЛЕГЕНДА (если вдруг появится)
        // ============================================================
        const legend = document.getElementById('choropleth-legend');
        if (legend && window.getComputedStyle(legend).display !== 'none') {
            out.push('--- ЛЕГЕНДА (DOM) ---');
            const titleEl = legend.querySelector('.legend-title');
            if (titleEl) out.push('Title: ' + titleEl.textContent.trim());
            const items = legend.querySelectorAll('.legend-item, .legend-row');
            for (let li = 0; li < items.length; li++) {
                const it = items[li];
                const sw = it.querySelector('.legend-swatch');
                const lb = it.querySelector('.legend-label');
                if (sw && lb) {
                    const bg = sw.style.background || sw.style.backgroundColor || '—';
                    out.push('  ' + bg + ' : ' + lb.textContent.trim());
                } else {
                    out.push('  ' + it.textContent.trim());
                }
            }
            const gvfEl = legend.querySelector('.legend-gvf');
            if (gvfEl) out.push('GVF: ' + gvfEl.textContent.trim());
            const methodEl = legend.querySelector('.legend-method');
            if (methodEl) out.push('Method: ' + methodEl.textContent.trim());
            out.push('');
        } else {
            out.push('--- ЛЕГЕНДА (DOM) ---');
            out.push('#choropleth-legend отсутствует или скрыта (semantic-map её не заполняет).');
            out.push('');
        }

        // ============================================================
        // 15. ПАЛИТРЫ ИЗ LAYER_OVERRIDES
        // ============================================================
        out.push('--- ПАЛИТРЫ (из LAYER_OVERRIDES) ---');
        const paletteGroups = {};
        for (const lid in overrides) {
            const ov = overrides[lid];
            if (!ov.palette) continue;
            const key = ov.palette + ' / ' + (ov.method || '—') + ' / ' + (ov.classes || '—');
            if (!paletteGroups[key]) paletteGroups[key] = [];
            paletteGroups[key].push(lid);
        }
        for (const key in paletteGroups) {
            out.push(key + ':');
            for (let pi = 0; pi < paletteGroups[key].length; pi++) {
                out.push('  ' + paletteGroups[key][pi]);
            }
        }
        if (Object.keys(paletteGroups).length === 0) {
            out.push('(нет палитр в LAYER_OVERRIDES)');
        }
        out.push('');

        // ============================================================
        // 16. DOM-СЛЕПОК
        // ============================================================
        const domSnapshot = collectDOMSnapshot(300);
        if (domSnapshot.length > 0) {
            out.push('--- DOM-СЛЕПОК (' + domSnapshot.length + ' элементов) ---');
            for (let di = 0; di < domSnapshot.length; di++) {
                const el = domSnapshot[di];
                out.push('');
                out.push('[' + el.index + '] ' + el.selector);
                out.push('  Текст: ' + (el.text || '—'));
                out.push('  Координаты: ' + el.coords.x + ',' + el.coords.y +
                         ' (' + el.coords.width + '×' + el.coords.height + ')');
                out.push('  Цвет: ' + el.styles.color + ' | Фон: ' + el.styles.backgroundColor);
                out.push('  Шрифт: ' + el.styles.fontSize);
            }
            out.push('');
        }

        // ============================================================
        // 17. ЖУРНАЛ КОНСОЛИ
        // ============================================================
        const logs = (window.CrucixLogger && window.CrucixLogger.logs) ? window.CrucixLogger.logs : null;
        if (logs && logs.length > 0) {
            out.push('--- ЖУРНАЛ КОНСОЛИ (последние ' + Math.min(logs.length, 200) + ') ---');
            const start = Math.max(0, logs.length - 200);
            for (let li = start; li < logs.length; li++) {
                const entry = logs[li];
                const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('ru-RU') : '—';
                const level = (entry.level || 'info').toUpperCase().padEnd(7, ' ');
                const msg = (entry.message || '').slice(0, 200);
                out.push('[' + time + '] [' + level + '] ' + msg);
            }
            out.push('');
        } else {
            out.push('--- ЖУРНАЛ КОНСОЛИ ---');
            out.push('Буфер логов отсутствует (в semantic-map CrucixLogger без .logs).');
            out.push('');
        }

        // ============================================================
        // 18. ФИНАЛ
        // ============================================================
        out.push('--- CRUCIX OSINT TERMINAL ---');
        out.push('🌐 ' + window.location.origin + '/semantic-map');
        out.push('Карта: meanings (semantic)');
        out.push(sep);

        // ============================================================
        // СБОРКА И КОПИРОВАНИЕ
        // ============================================================
        const text = out.join('\n');
        let byteLength;
        try {
            byteLength = new TextEncoder().encode(text).length;
        } catch (e) {
            byteLength = text.length * 2;
        }
        const sizeKB = Math.round(byteLength / 1024);

        console.log('[copyAllData v1.0 semantic] Снапшот: ' + text.length + ' символов, ' + byteLength + ' байт, ~' + sizeKB + ' КБ');
        console.log('[copyAllData v1.0 semantic] Слоёв: ' + allLayers.length + ', в кэше: ' + cacheKeys.length + ', активных: ' + activeIds.size);

        function fallbackCopy(txt) {
            const ta = document.createElement('textarea');
            ta.value = txt;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                console.log('[copyAllData v1.0 semantic] ✅ Скопировано (fallback): ~' + sizeKB + ' КБ');
            } catch (e) {
                console.error('[copyAllData v1.0 semantic] Fallback тоже не сработал:', e);
            }
            document.body.removeChild(ta);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
                console.log('[copyAllData v1.0 semantic] ✅ Скопировано в буфер обмена (~' + sizeKB + ' КБ)');
                const btn = document.getElementById('copy-btn');
                if (btn) {
                    const original = btn.textContent;
                    btn.textContent = '✅ ' + sizeKB + ' KB';
                    btn.classList.add('copied');
                    setTimeout(function () {
                        btn.textContent = original || 'КОПИРОВАТЬ';
                        btn.classList.remove('copied');
                    }, 3000);
                }
                safeNotify('Скопировано: ~' + sizeKB + ' КБ (' + allLayers.length + ' слоёв, ' + markerData.length + ' маркеров)', 'success');
            }).catch(function (e) {
                console.error('[copyAllData v1.0 semantic] Ошибка clipboard API:', e);
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    };

    console.log('[copyAllData v1.0 semantic] Override установлен');

})();
