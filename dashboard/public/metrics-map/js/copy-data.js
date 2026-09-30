// ============================================================
// COPY-DATA.JS — Снапшот Metrics Map (v3.0 — объединённая)
// ============================================================
// Базируется на v2.0 (плоский кеш, точный размер в байтах,
// корректная обработка value=0, статистика min/max/mean,
// здоровье слоёв, разбивка маркеров, choropleth-параметры).
//
// Из «128копии» добавлено:
//   - СТРАНЫ ПО СТАТУСАМ (группировка + эмодзи)
//   - CII Top-N (парсинг DOM .cii-country)
//   - SSI (расширенный парсинг)
//   - DOM-СЛЕПОК (до 300 элементов: селектор, координаты, цвета)
//   - Легенда через .legend-row/.legend-swatch (fallback)
//   - Подробный блок «АКТИВНЫЕ СЛОИ» (имя, категория, метод, палитра)
//
// Исправления:
//   - Единая обёртка IIFE + window.copyAllData
//   - Безопасный доступ к window.map?.getCenter
//   - Безопасный showNotification
//   - Убран дубликат window.copyAllData
// ============================================================

console.log('📋 COPY-DATA.JS загружен (Metrics Map, снапшот v3.0 — объединённый)');

(function () {

    // ------------------------------------------------------------
    // Вспомогательные функции
    // ------------------------------------------------------------

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
        if (obj.country) return obj.country;
        return '—';
    }

    function getStatus(obj) {
        if (obj == null) return '';
        return obj.status || (obj.properties && obj.properties.status) || '';
    }

    function fmtNum(v, digits) {
        if (typeof v !== 'number' || isNaN(v)) return String(v);
        return v.toFixed(digits === undefined ? 4 : digits);
    }

    // ------------------------------------------------------------
    // DOM-слепок (из «128копии»)
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
        out.push('=== CRUCIX — METRICS MAP (объединённый снапшот v3.0) ===');
        out.push('Дата: ' + new Date().toLocaleString('ru-RU'));
        out.push('URL: ' + window.location.href);
        out.push('Окно: ' + window.innerWidth + '×' + window.innerHeight);
        out.push('Карта: ' + (window.CrucixMap ? window.CrucixMap.mapType : 'metrics'));
        out.push('UA: ' + navigator.userAgent);
        out.push('Версия copy-data: 3.0 (объединённая)');
        out.push('');

        // === СБОР ДАННЫХ ===
        const allLayers = window.allLayers || [];
        const activeIdsRaw = window.activeLayerIds || new Set();
        const activeIds = new Set();
        activeIdsRaw.forEach(function (id) { if (id !== 'all') activeIds.add(id); });
        const cache = window.layerCache || {};
        const cacheKeys = Object.keys(cache);
        const markerData = window.markerData || [];
        const countries = window.ALL_COUNTRIES || [];
        const mapObj = window.map;

        // ============================================================
        // 1. СВОДНАЯ СТАТИСТИКА
        // ============================================================
        out.push('--- СТАТИСТИКА ---');
        out.push('Стран: ' + countries.length);
        out.push('Слоёв всего: ' + allLayers.length);
        out.push('Активных слоёв: ' + activeIds.size);
        out.push('Кэшированных слоёв: ' + cacheKeys.length);
        out.push('Маркеров: ' + markerData.length);
        out.push('');

        // ============================================================
        // 2. ПОЛНАЯ КОНФИГУРАЦИЯ СЛОЁВ
        // ============================================================
        out.push('--- ПОЛНАЯ КОНФИГУРАЦИЯ СЛОЁВ (' + allLayers.length + ') ---');
        out.push('');
        for (let i = 0; i < allLayers.length; i++) {
            const l = allLayers[i];
            const idx = String(i + 1).padStart(2, '0');
            const cached = cache[l.id];
            const objCount = cached ? cached.length : 0;
            const icon = objCount > 0 ? '✅' : (cached ? '⚠️' : '❌');
            const config = (window.getLayerConfig ? window.getLayerConfig(l.id) : {}) || {};

            out.push('[' + idx + '] ' + icon + ' ' + l.id);
            out.push('  Name:     ' + (l.name || '—'));
            out.push('  Category: ' + (l.category || '—'));
            out.push('  vizType:  ' + (l.vizType || 'choropleth'));
            out.push('  Icon:     ' + (l.icon || '—'));
            out.push('  Color:    ' + (l.color || '—'));
            out.push('  Method:   ' + (config.method || l.method || 'jenks'));
            out.push('  Palette:  ' + (config.palette || l.palette || 'default'));
            if (config.manualBreaks) out.push('  ManualBreaks: [' + config.manualBreaks.join(', ') + ']');
            if (l.breaks) out.push('  Breaks:   [' + l.breaks.join(', ') + ']');
            if (l.rationale) out.push('  Rationale:' + l.rationale);
            if (l.crucix) out.push('  Crucix:   yes');
            out.push('  Data:     ' + objCount + ' объектов');
            out.push('');
        }

        // ============================================================
        // 3. МАТРИЦА СЛОЁВ
        // ============================================================
        out.push('--- МАТРИЦА СЛОЁВ ---');
        out.push('№  | ID                          | vizType    | Метод    | Палитра     | Активен | Данных');
        out.push('---|-----------------------------|------------|----------|-------------|---------|-------');
        for (let i = 0; i < allLayers.length; i++) {
            const l = allLayers[i];
            const idx = String(i + 1).padStart(2, '0');
            const isActive = activeIds.has(l.id) ? '✅' : '—';
            const cached = cache[l.id];
            const dataCount = cached ? cached.length : 0;
            const config = (window.getLayerConfig ? window.getLayerConfig(l.id) : {}) || {};

            out.push(
                idx + ' | ' +
                (l.id || '').padEnd(27) + ' | ' +
                (l.vizType || 'choropleth').padEnd(10) + ' | ' +
                (config.method || l.method || 'jenks').padEnd(8) + ' | ' +
                (config.palette || l.palette || 'default').padEnd(11) + ' | ' +
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
            const vt = allLayers[i].vizType || 'choropleth';
            if (!vizTypes[vt]) vizTypes[vt] = { total: 0, active: 0, withData: 0 };
            vizTypes[vt].total++;
            if (activeIds.has(allLayers[i].id)) vizTypes[vt].active++;
            const c = cache[allLayers[i].id];
            if (c && c.length > 0) vizTypes[vt].withData++;
        }
        for (const vt in vizTypes) {
            const v = vizTypes[vt];
            out.push(vt.padEnd(12) + ': всего ' + v.total + ', активных ' + v.active + ', с данными ' + v.withData);
        }
        out.push('');

        out.push('--- ДИАГНОСТИКА ПО КАТЕГОРИЯМ ---');
        const cats = {};
        for (let i = 0; i < allLayers.length; i++) {
            const cat = allLayers[i].category || 'other';
            if (!cats[cat]) cats[cat] = { total: 0, active: 0, withData: 0 };
            cats[cat].total++;
            if (activeIds.has(allLayers[i].id)) cats[cat].active++;
            const c = cache[allLayers[i].id];
            if (c && c.length > 0) cats[cat].withData++;
        }
        for (const cat in cats) {
            const cc = cats[cat];
            out.push(cat.padEnd(14) + ': всего ' + String(cc.total).padStart(2) +
                     ', активных ' + String(cc.active).padStart(2) +
                     ', с данными ' + String(cc.withData).padStart(2));
        }
        out.push('');

        // ============================================================
        // 5. ЗДОРОВЬЕ СЛОЁВ
        // ============================================================
        out.push('--- ЗДОРОВЬЕ СЛОЁВ ---');
        out.push('№  | ID                          | Статус         | Объектов | Примечание');
        out.push('---|-----------------------------|----------------|----------|----------');
        for (let i = 0; i < allLayers.length; i++) {
            const l = allLayers[i];
            const idx = String(i + 1).padStart(2, '0');
            const cached = cache[l.id];
            let status, note, objCount;

            if (!cached) {
                status = 'НЕ ЗАГРУЖЕН';
                note = 'Слой не в кеше';
                objCount = 0;
            } else if (cached.length === 0) {
                status = 'НЕТ ДАННЫХ';
                note = 'Кеш есть, массив пустой';
                objCount = 0;
            } else if (cached.length < countries.length) {
                status = 'НЕПОЛНЫЕ';
                note = 'Данных: ' + cached.length + ' из ' + countries.length;
                objCount = cached.length;
            } else {
                status = 'OK';
                note = 'Полный набор';
                objCount = cached.length;
            }

            out.push(
                idx + ' | ' +
                (l.id || '').padEnd(27) + ' | ' +
                status.padEnd(14) + ' | ' +
                String(objCount).padStart(8) + ' | ' +
                note
            );
        }
        out.push('');

        // ============================================================
        // 6. АКТИВНЫЕ СЛОИ ПОДРОБНО (из «128копии»)
        // ============================================================
        if (activeIds.size > 0) {
            out.push('--- АКТИВНЫЕ СЛОИ (' + activeIds.size + ') ---');
            const activeArr = Array.from(activeIds);
            for (let ai = 0; ai < activeArr.length; ai++) {
                const id = activeArr[ai];
                const layer = allLayers.find(function (x) { return x.id === id; });
                if (!layer) continue;
                const config = (window.getLayerConfig ? window.getLayerConfig(id) : {}) || {};
                const data = cache[id] || [];

                out.push('');
                out.push('● ' + (layer.name || '—') + ' (' + id + ')');
                out.push('  Категория: ' + (layer.category || '—'));
                out.push('  vizType:   ' + (layer.vizType || 'choropleth'));
                out.push('  Метод:     ' + (config.method || 'jenks'));
                out.push('  Палитра:   ' + (config.palette || 'Blues'));
                if (config.manualBreaks) out.push('  Manual breaks: [' + config.manualBreaks.join(', ') + ']');
                out.push('  Объектов данных: ' + data.length);
                if (data.length > 0 && data.length <= 10) {
                    out.push('  Данные:');
                    for (let di = 0; di < data.length; di++) {
                        out.push('    ' + getName(data[di]) + ': ' + (getValue(data[di]) !== null ? getValue(data[di]) : '—'));
                    }
                }
            }
            out.push('');
        }

        // ============================================================
        // 7. CHOROPLETH-ПАРАМЕТРЫ ТЕКУЩЕГО СЛОЯ
        // ============================================================
        if (window.currentChoroplethConfig) {
            const cfg = window.currentChoroplethConfig;
            out.push('--- CHOROPLETH-ПАРАМЕТРЫ ТЕКУЩЕГО СЛОЯ ---');
            out.push('LayerId:   ' + (cfg.layerId || '—'));
            out.push('LayerName: ' + (cfg.layerName || '—'));
            out.push('Method:    ' + (cfg.method || 'jenks'));
            out.push('Palette:   ' + (Array.isArray(cfg.palette) ? cfg.palette.join(', ') : (cfg.palette || '—')));
            out.push('NumClasses: ' + (cfg.numClasses || 5));
            if (cfg.manualBreaks) out.push('ManualBreaks: [' + cfg.manualBreaks.join(', ') + ']');
            if (cfg.breaks) out.push('Breaks:    [' + cfg.breaks.map(function (b) {
                return (typeof b === 'number') ? b.toFixed(4) : b;
            }).join(', ') + ']');
            if (cfg.gvf !== undefined) out.push('GVF:       ' + cfg.gvf.toFixed(4));
            if (cfg.stats) {
                out.push('Stats:     count=' + cfg.stats.count +
                         ' min=' + fmtNum(cfg.stats.min) +
                         ' max=' + fmtNum(cfg.stats.max) +
                         ' mean=' + fmtNum(cfg.stats.mean));
            }
            out.push('');
        }

        // ============================================================
        // 8. ЛЕГЕНДА (DOM) — расширенный парсинг
        // ============================================================
        const legend = document.getElementById('choropleth-legend');
        if (legend && legend.style.display !== 'none') {
            out.push('--- ЛЕГЕНДА (DOM) ---');
            const titleEl = legend.querySelector('.legend-title');
            if (titleEl) out.push('Title: ' + titleEl.textContent.trim());

            // v2.0: .legend-item
            let items = legend.querySelectorAll('.legend-item');
            // fallback «128копия»: .legend-row
            if (items.length === 0) items = legend.querySelectorAll('.legend-row');

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
        }

        // ============================================================
        // 9. РАЗБИВКА МАРКЕРОВ ПО СЛОЯМ
        // ============================================================
        out.push('--- РАЗБИВКА МАРКЕРОВ ПО СЛОЯМ ---');
        const markerLayers = allLayers.filter(function (l) { return l.vizType === 'marker'; });
        out.push('Marker-слоёв: ' + markerLayers.length);
        out.push('Всего маркеров в window.markerData: ' + markerData.length);
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
            const cached = cache[l.id];
            const cacheCount = (cached && Array.isArray(cached)) ? cached.length : 0;

            out.push('[' + idx + '] ' + l.id + ' (' + (l.name || '—') + ')');
            out.push('  В кеше:  ' + cacheCount);
            out.push('  В markerData: ' + arr.length);

            const show = Math.min(arr.length, 20);
            for (let s = 0; s < show; s++) {
                const m = arr[s];
                out.push('  ' + (s + 1) + '. ' + (m.title || '—') +
                         ' | ' + (m.countryName || '—') +
                         ' | lat=' + (m.lat || 0).toFixed(2) +
                         ' lng=' + (m.lng || 0).toFixed(2) +
                         ' | ' + (m.status || '—'));
            }
            if (arr.length > show) {
                out.push('  ... и ещё ' + (arr.length - show) + ' маркеров');
            }
            out.push('');
        }

        // ============================================================
        // 10. ДАННЫЕ СЛОЁВ
        // ============================================================
        const dataIds = new Set();
        activeIds.forEach(function (id) { dataIds.add(id); });
        cacheKeys.forEach(function (id) { dataIds.add(id); });

        out.push('--- ДАННЫЕ СЛОЁВ (' + dataIds.size + ') ---');

        const sortedIds = Array.from(dataIds).sort();

        for (let i = 0; i < sortedIds.length; i++) {
            const layerId = sortedIds[i];
            const layer = allLayers.find(function (x) { return x.id === layerId; });
            if (!layer) continue;

            const cached = cache[layerId];
            const hasData = cached && cached.length > 0;
            const config = (window.getLayerConfig ? window.getLayerConfig(layerId) : {}) || {};

            out.push('');
            out.push('[' + String(i + 1).padStart(2, '0') + '] ' + layerId + ' ' + (hasData ? '✅' : '❌'));
            out.push('Name:     ' + (layer.name || '—'));
            out.push('Category: ' + (layer.category || '—'));
            out.push('vizType:  ' + (layer.vizType || 'choropleth'));
            out.push('Method:   ' + (config.method || 'jenks'));
            out.push('Palette:  ' + (config.palette || 'default'));
            if (config.manualBreaks) out.push('Breaks:   [' + config.manualBreaks.join(', ') + ']');
            out.push('Objects:  ' + (hasData ? cached.length : 0));

            if (hasData) {
                const values = [];
                for (let j = 0; j < cached.length; j++) {
                    const v = getValue(cached[j]);
                    if (typeof v === 'number' && !isNaN(v)) values.push(v);
                }
                if (values.length > 0) {
                    const min = Math.min.apply(null, values);
                    const max = Math.max.apply(null, values);
                    let sum = 0;
                    for (let vi = 0; vi < values.length; vi++) sum += values[vi];
                    const mean = sum / values.length;
                    out.push('Stats:    min=' + min.toFixed(4) + ' max=' + max.toFixed(4) + ' mean=' + mean.toFixed(4));
                }

                out.push('');
                out.push('Data (все ' + cached.length + ' объектов):');
                out.push('name                                | value      | status');
                out.push('------------------------------------|------------|--------');

                for (let j = 0; j < cached.length; j++) {
                    const f = cached[j];
                    const name = getName(f);
                    const value = getValue(f);
                    const status = getStatus(f);

                    let valueStr;
                    if (typeof value === 'number') {
                        valueStr = value.toFixed(4).padStart(10, ' ');
                    } else if (value === null || value === undefined) {
                        valueStr = String('—').padStart(10, ' ');
                    } else {
                        valueStr = String(value).padStart(10, ' ');
                    }

                    out.push(name.padEnd(35) + ' | ' + valueStr + ' | ' + status);
                }
            }
        }
        out.push('');

        // ============================================================
        // 11. СТРАНЫ (полный список)
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
        // 12. СТРАНЫ ПО СТАТУСАМ (из «128копии»)
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
        for (const status in groups) {
            out.push((emojis[status] || '⚪') + ' ' + status.toUpperCase() +
                     ' (' + groups[status].length + '): ' + groups[status].join(', '));
        }
        out.push('');

        // ============================================================
        // 13. DOM ПАНЕЛИ СЛОЁВ
        // ============================================================
        out.push('--- DOM ПАНЕЛИ СЛОЁВ ---');
        const layerButtons = document.querySelectorAll('[data-layer-id]');
        out.push('Всего кнопок:      ' + layerButtons.length);
        let activeButtons = 0;
        for (let b = 0; b < layerButtons.length; b++) {
            if (layerButtons[b].classList.contains('active')) activeButtons++;
        }
        out.push('Активных кнопок:   ' + activeButtons);
        out.push('');

        const categories = document.querySelectorAll('.layer-category');
        out.push('Всего категорий:   ' + categories.length);
        for (let cat = 0; cat < categories.length; cat++) {
            const catEl = categories[cat];
            const catName = catEl.getAttribute('data-category') ||
                (catEl.querySelector('.category-title') ? catEl.querySelector('.category-title').textContent : '—');
            const catBtns = catEl.querySelectorAll('[data-layer-id]');
            let catActive = 0;
            for (let cb = 0; cb < catBtns.length; cb++) {
                if (catBtns[cb].classList.contains('active')) catActive++;
            }
            out.push('[' + catName + '] кнопок: ' + catBtns.length + ', активных: ' + catActive);
            for (let cb = 0; cb < catBtns.length; cb++) {
                const lid = catBtns[cb].getAttribute('data-layer-id');
                const isActive = catBtns[cb].classList.contains('active');
                out.push('  ' + (isActive ? '✅' : '❌') + ' ' + lid);
            }
        }
        out.push('');

        // ============================================================
        // 14. КАРТА
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
        // 15. CII (из «128копии»)
        // ============================================================
        const ciiPanel = document.getElementById('cii-panel');
        if (ciiPanel) {
            out.push('--- CII (Индекс нестабильности) ---');
            const globalEl = ciiPanel.querySelector('.cii-global');
            const tsEl = ciiPanel.querySelector('.cii-timestamp');
            out.push('Global:  ' + (globalEl ? globalEl.textContent.trim() : '—'));
            out.push('Source:  ' + (tsEl ? tsEl.textContent.trim() : '—'));
            const ciiCountries = ciiPanel.querySelectorAll('.cii-country');
            for (let ci = 0; ci < ciiCountries.length; ci++) {
                const el = ciiCountries[ci];
                const nm = el.querySelector('.cii-name');
                const sc = el.querySelector('.cii-score');
                out.push('  ' + (nm ? nm.textContent.trim() : '—') + ': ' + (sc ? sc.textContent.trim() : '—'));
            }
            out.push('');
        }

        // ============================================================
        // 16. ПАНЕЛЬ СТАТУСА (SSI и др.)
        // ============================================================
        out.push('--- ПАНЕЛЬ СТАТУСА ---');
        const acEl = document.getElementById('active-layers-count');
        out.push('Active count: ' + (acEl ? acEl.textContent.trim() : '—'));
        const lcEl = document.getElementById('layer-count');
        out.push('Layer count:  ' + (lcEl ? lcEl.textContent.trim() : '—'));
        const ccEl = document.getElementById('countries-count');
        out.push('Countries:    ' + (ccEl ? ccEl.textContent.trim() : '—'));
        const mcEl = document.getElementById('marker-count');
        out.push('Markers:      ' + (mcEl ? mcEl.textContent.trim() : '—'));

        const ssiEl = document.getElementById('ssi-label') || document.getElementById('ssi-value');
        out.push('SSI:          ' + (ssiEl ? ssiEl.textContent.trim() : '—'));

        out.push('CurrentLayer: ' + (window.currentLayer || '—'));
        out.push('Map type:     ' + (window.CrucixMap ? window.CrucixMap.mapType : 'metrics'));
        out.push('');

        // ============================================================
        // 17. DOM-СЛЕПОК (из «128копии»)
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
        // 18. ДОСТУПНЫЕ ПАЛИТРЫ
        // ============================================================
        out.push('--- ДОСТУПНЫЕ ПАЛИТРЫ ---');
        if (window.COLOR_SCHEMES) {
            if (window.COLOR_SCHEMES.sequential) {
                out.push('Sequential: ' + Object.keys(window.COLOR_SCHEMES.sequential).join(', '));
            }
            if (window.COLOR_SCHEMES.diverging) {
                out.push('Diverging:  ' + Object.keys(window.COLOR_SCHEMES.diverging).join(', '));
            }
        } else {
            out.push('Sequential: Blues, YlOrRd, Greens, Oranges, Purples, BuPu, OrRd');
            out.push('Diverging:  RdYlGn5, RdBu5, BrBG5, PiYG5');
        }
        out.push('');

        // ============================================================
        // 19. ЖУРНАЛ КОНСОЛИ
        // ============================================================
        const logs = (window.crucixLogger && window.crucixLogger.logs) ? window.crucixLogger.logs : [];
        if (logs.length > 0) {
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
        }

        // ============================================================
        // 20. ФИНАЛ
        // ============================================================
        out.push('--- CRUCIX OSINT TERMINAL ---');
        out.push('🌐 ' + window.location.origin + '/metrics-map');
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

        console.log('[copyAllData v3.0] Снапшот: ' + text.length + ' символов, ' + byteLength + ' байт, ~' + sizeKB + ' КБ');
        console.log('[copyAllData v3.0] Слоёв: ' + allLayers.length + ', в кеше: ' + cacheKeys.length + ', активных: ' + activeIds.size);

        function fallbackCopy(txt) {
            const ta = document.createElement('textarea');
            ta.value = txt;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                console.log('[copyAllData v3.0] ✅ Скопировано (fallback): ~' + sizeKB + ' КБ');
            } catch (e) {
                console.error('[copyAllData v3.0] Fallback тоже не сработал:', e);
            }
            document.body.removeChild(ta);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
                console.log('[copyAllData v3.0] ✅ Скопировано в буфер обмена (~' + sizeKB + ' КБ)');
                const btn = document.getElementById('copy-btn');
                if (btn) {
                    const original = btn.textContent;
                    btn.textContent = '✅ ' + sizeKB + ' KB';
                    btn.classList.add('copied');
                    setTimeout(function () {
                        btn.textContent = original || '📋 КОПИРОВАТЬ';
                        btn.classList.remove('copied');
                    }, 3000);
                }
                safeNotify('Скопировано: ~' + sizeKB + ' КБ (' + allLayers.length + ' слоёв, ' + cacheKeys.length + ' в кеше)', 'success');
            }).catch(function (e) {
                console.error('[copyAllData v3.0] Ошибка clipboard API:', e);
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    };

    console.log('[copyAllData v3.0] Override установлен (объединённая версия)');

})();
