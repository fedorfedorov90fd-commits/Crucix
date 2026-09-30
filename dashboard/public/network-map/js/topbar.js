// ============================================================
// TOPBAR.JS — Кнопки топбара и снапшот (Network Map v2.0)
// ============================================================
// Снапшот до 500 КБ: сводка, слои, узлы+позиции, связи,
// аналитика, конфиг, UI, DOM-слепок, страны, SVG.
// ============================================================

console.log('🔝 TOPBAR.JS (network-map v2.0) загружен');

// ------------------------------------------------------------
// Вспомогательные
// ------------------------------------------------------------
function _fmt(n, d) {
    if (typeof n !== 'number' || isNaN(n)) return String(n);
    return n.toFixed(d === undefined ? 4 : d);
}

function _safeText(el) {
    if (!el) return '—';
    return (el.textContent || '').trim().slice(0, 200) || '—';
}

function _collectDOMSnapshot(limit) {
    limit = limit || 300;
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
// Основная функция снапшота
// ------------------------------------------------------------
window.copyAllData = function() {
    var out = [];
    var sep = '='.repeat(60);
    var G = window.GraphView;
    var N = window.NetworkMap;
    var C = window.NetworkMapConfig;

    var nodes = (G && G.getNodes) ? G.getNodes() : [];
    var edges = (G && G.getEdges) ? G.getEdges() : [];
    var layer = N ? N.currentLayer : '—';
    var graphData = N ? N.graphData : null;

    // ============ ЗАГОЛОВОК ============
    out.push(sep);
    out.push('=== CRUCIX — NETWORK MAP (snapshot v2.0) ===');
    out.push('Дата: ' + new Date().toLocaleString('ru-RU'));
    out.push('URL: ' + window.location.href);
    out.push('Окно: ' + window.innerWidth + '×' + window.innerHeight);
    out.push('Карта: relations (network)');
    out.push('UA: ' + navigator.userAgent);
    out.push('Версия copy-data: 2.0 (network-map)');
    out.push('');

    // ============ СВОДКА ============
    out.push('--- СВОДКА ---');
    out.push('Текущий слой: ' + layer);
    out.push('Слоёв всего: ' + (window.allLayers ? window.allLayers.length : 0));
    out.push('Узлов: ' + nodes.length);
    out.push('Связей: ' + edges.length);
    out.push('Стран (метаданные): ' + (window.ALL_COUNTRIES ? window.ALL_COUNTRIES.length : 0));
    out.push('');

    // ============ АНАЛИТИКА ============
    if (window.Relations && nodes.length > 0) {
        try {
            var centrality = window.Relations.degreeCentrality({ nodes: nodes, edges: edges });
            var components = window.Relations.findComponents({ nodes: nodes, edges: edges });
            var values = Object.values(centrality);
            var sum = values.reduce(function(a, b) { return a + b; }, 0);
            var avg = values.length ? sum / values.length : 0;
            var max = values.length ? Math.max.apply(null, values) : 0;
            var min = values.length ? Math.min.apply(null, values) : 0;

            out.push('--- АНАЛИТИКА ---');
            out.push('Компонент связности: ' + components.length);
            out.push('Degree centrality:');
            out.push('  средняя:  ' + _fmt(avg));
            out.push('  максимум: ' + _fmt(max));
            out.push('  минимум:  ' + _fmt(min));
            out.push('');

            var sorted = Object.keys(centrality).sort(function(a, b) {
                return centrality[b] - centrality[a];
            });
            out.push('Топ по центральности:');
            for (var ci = 0; ci < Math.min(sorted.length, 30); ci++) {
                var id = sorted[ci];
                var conn = 0;
                for (var ei = 0; ei < edges.length; ei++) {
                    if (edges[ei].source === id || edges[ei].target === id) conn++;
                }
                out.push('  ' + String(ci + 1).padStart(2) + '. ' +
                         String(id).padEnd(20) + ' — ' +
                         _fmt(centrality[id]) + ' (связей: ' + conn + ')');
            }
            out.push('');

            out.push('Компоненты:');
            for (var compI = 0; compI < components.length; compI++) {
                out.push('  [' + (compI + 1) + '] ' + components[compI].length + ' узлов: ' +
                         components[compI].slice(0, 20).join(', ') +
                         (components[compI].length > 20 ? ' ...' : ''));
            }
            out.push('');
        } catch (err) {
            out.push('(аналитика недоступна: ' + err.message + ')');
            out.push('');
        }
    }

    // ============ КОНФИГУРАЦИЯ ============
    if (C) {
        out.push('--- КОНФИГУРАЦИЯ ГРАФА ---');
        out.push('graph:');
        out.push('  force:         ' + (C.graph.force || '—'));
        out.push('  distance:      ' + (C.graph.distance || '—'));
        out.push('  charge:        ' + (C.graph.charge || '—'));
        out.push('  gravity:       ' + (C.graph.gravity || '—'));
        out.push('  velocityDecay: ' + (C.graph.velocityDecay || '—'));
        out.push('  maxIterations: ' + (C.graph.maxIterations || '—'));
        out.push('');

        out.push('nodeTypes (' + Object.keys(C.nodeTypes).length + '):');
        for (var nt in C.nodeTypes) {
            var ntc = C.nodeTypes[nt];
            out.push('  ' + nt.padEnd(14) + ' shape=' + (ntc.shape || 'circle').padEnd(10) +
                     ' color=' + (ntc.color || '—'));
        }
        out.push('');

        out.push('edgeTypes (' + Object.keys(C.edgeTypes).length + '):');
        for (var et in C.edgeTypes) {
            var etc = C.edgeTypes[et];
            out.push('  ' + et.padEnd(14) + ' color=' + (etc.color || '—').padEnd(10) +
                     ' width=' + (etc.width || '—') + ' dashed=' + (etc.dashed ? 'yes' : 'no'));
        }
        out.push('');

        out.push('apiRoutes (' + Object.keys(C.apiRoutes).length + '):');
        for (var ar in C.apiRoutes) {
            out.push('  ' + ar.padEnd(30) + ' → ' + C.apiRoutes[ar]);
        }
        out.push('');
    }

    // ============ СЛОИ ============
    out.push('--- СЛОИ (' + (window.allLayers ? window.allLayers.length : 0) + ') ---');
    if (window.allLayers) {
        for (var i = 0; i < window.allLayers.length; i++) {
            var l = window.allLayers[i];
            var idx = String(i + 1).padStart(2, '0');
            var active = (l.id === layer) ? '★' : ' ';
            out.push('[' + idx + '] ' + active + ' ' + l.id);
            out.push('  Name:     ' + (l.name || '—'));
            out.push('  Category: ' + (l.category || '—'));
            out.push('  vizType:  ' + (l.vizType || 'graph'));
            out.push('  Icon:     ' + (l.icon || '—'));
            out.push('  Color:    ' + (l.color || '—'));
            out.push('  Descr:    ' + (l.description || '—'));
            out.push('');
        }
    }

    // ============ УЗЛЫ С ПОЗИЦИЯМИ ============
    out.push('--- УЗЛЫ (' + nodes.length + ') ---');
    out.push('idx | id                | type         | weight | x        | y        | vx       | vy       | label');
    out.push('----|-------------------|--------------|--------|----------|----------|----------|----------|------');
    for (var ni = 0; ni < nodes.length; ni++) {
        var n = nodes[ni];
        out.push(
            String(ni + 1).padStart(3) + ' | ' +
            String(n.id).padEnd(17) + ' | ' +
            String(n.type || 'country').padEnd(12) + ' | ' +
            String(n.weight || 1).padStart(6) + ' | ' +
            _fmt(n.x, 2).padStart(8) + ' | ' +
            _fmt(n.y, 2).padStart(8) + ' | ' +
            _fmt(n.vx || 0, 3).padStart(8) + ' | ' +
            _fmt(n.vy || 0, 3).padStart(8) + ' | ' +
            (n.label || '—')
        );
    }
    out.push('');

    // ============ СВЯЗИ ============
    out.push('--- СВЯЗИ (' + edges.length + ') ---');
    out.push('idx | source            | target            | weight | type');
    out.push('----|-------------------|-------------------|--------|------');
    for (var ei2 = 0; ei2 < edges.length; ei2++) {
        var e = edges[ei2];
        out.push(
            String(ei2 + 1).padStart(3) + ' | ' +
            String(e.source).padEnd(17) + ' | ' +
            String(e.target).padEnd(17) + ' | ' +
            String(e.weight || 1).padStart(6) + ' | ' +
            (e.type || 'flow')
        );
    }
    out.push('');

    // ============ GRAPH DATA RAW ============
    if (graphData) {
        out.push('--- RAW GRAPH DATA ---');
        out.push(JSON.stringify(graphData, null, 2).slice(0, 50000));
        out.push('');
    }

    // ============ SVG СТАТИСТИКА ============
    var svgEl = document.getElementById('graph-svg');
    if (svgEl) {
        var svgRect = svgEl.getBoundingClientRect();
        out.push('--- SVG СТАТИСТИКА ---');
        out.push('viewBox: ' + (svgEl.getAttribute('viewBox') || '—'));
        out.push('Размеры на экране: ' + Math.round(svgRect.width) + '×' + Math.round(svgRect.height));
        out.push('Элементов <circle>: ' + svgEl.querySelectorAll('circle').length);
        out.push('Элементов <rect>:   ' + svgEl.querySelectorAll('rect').length);
        out.push('Элементов <polygon>: ' + svgEl.querySelectorAll('polygon').length);
        out.push('Элементов <line>:   ' + svgEl.querySelectorAll('line').length);
        out.push('Элементов <text>:   ' + svgEl.querySelectorAll('text').length);
        var g = svgEl.querySelector('g');
        if (g) out.push('transform: ' + (g.getAttribute('transform') || '—'));
        out.push('');
    }

    // ============ UI СОСТОЯНИЕ ============
    out.push('--- UI СОСТОЯНИЕ ---');
    var panel = document.getElementById('layer-panel');
    out.push('Панель слоёв: ' + (panel ? (panel.classList.contains('collapsed') ? 'скрыта' : 'видима') : '—'));
    var controls = document.getElementById('graph-controls');
    out.push('Graph controls: ' + (controls ? 'видимы' : 'скрыты'));
    var forceSlider = document.getElementById('force-slider');
    if (forceSlider) out.push('Force slider: ' + forceSlider.value);
    var distSlider = document.getElementById('distance-slider');
    if (distSlider) out.push('Distance slider: ' + distSlider.value);
    var legend = document.getElementById('legend');
    if (legend) out.push('Legend items: ' + legend.querySelectorAll('.legend-item').length);
    var tooltip = document.getElementById('node-tooltip');
    out.push('Tooltip: ' + (tooltip && tooltip.style.display === 'block' ? 'виден' : 'скрыт'));
    var overlay = document.getElementById('loading-overlay');
    out.push('Overlay: ' + (overlay ? (overlay.style.display === 'none' ? 'скрыт' : 'видим') : '—'));
    out.push('Active layer: ' + layer);
    out.push('Кнопок слоёв: ' + document.querySelectorAll('.layer-item').length);
    out.push('Категорий: ' + document.querySelectorAll('.layer-category').length);
    out.push('');

    // ============ СТРАНЫ ============
    if (window.ALL_COUNTRIES && window.ALL_COUNTRIES.length > 0) {
        out.push('--- СТРАНЫ (метаданные, ' + window.ALL_COUNTRIES.length + ') ---');
        out.push('id                          | code  | status     | lat       | lng       | name');
        out.push('----------------------------|-------|------------|-----------|-----------|------');
        for (var si = 0; si < window.ALL_COUNTRIES.length; si++) {
            var c = window.ALL_COUNTRIES[si];
            out.push(
                String(c.id || '—').padEnd(27) + ' | ' +
                String(c.code || '—').padEnd(5) + ' | ' +
                String(c.status || '—').padEnd(10) + ' | ' +
                _fmt(c.lat, 4).padStart(9) + ' | ' +
                _fmt(c.lng, 4).padStart(9) + ' | ' +
                (c.name || '—')
            );
        }
        out.push('');
    }

    // ============ DOM-СЛЕПОК ============
    var domSnapshot = _collectDOMSnapshot(500);
    if (domSnapshot.length > 0) {
        out.push('--- DOM-СЛЕПОК (' + domSnapshot.length + ' элементов) ---');
        for (var di = 0; di < domSnapshot.length; di++) {
            var d = domSnapshot[di];
            out.push('');
            out.push('[' + d.index + '] ' + d.selector);
            out.push('  Текст: ' + (d.text || '—'));
            out.push('  Координаты: ' + d.coords.x + ',' + d.coords.y +
                     ' (' + d.coords.width + '×' + d.coords.height + ')');
            out.push('  Цвет: ' + d.styles.color + ' | Фон: ' + d.styles.backgroundColor);
            out.push('  Шрифт: ' + d.styles.fontSize);
        }
        out.push('');
    }


    // ============ СООБЩЕСТВА (Louvain) ============
    if (window.Relations && window.Relations.louvain && nodes.length > 0) {
        try {
            var lv = window.Relations.louvain({ nodes: nodes, edges: edges });
            out.push('--- СООБЩЕСТВА (Louvain) ---');
            out.push('Алгоритм: Louvain (Blondel et al. 2008)');
            out.push('Модульность Q: ' + lv.modularity.toFixed(4));
            out.push('Сообществ: ' + lv.numCommunities);
            out.push('Проходов: ' + lv.passes);
            out.push('');
            out.push('Интерпретация модульности:');
            out.push('  Q < 0.30 — слабая структура');
            out.push('  Q 0.30–0.50 — умеренная структура');
            out.push('  Q > 0.50 — сильная структура сообществ');
            out.push('');

            var groups = window.Relations.groupByCommunity({ nodes: nodes, edges: edges }, lv.communities);
            var sortedComm = Object.keys(groups).map(Number).sort(function(a, b) { return a - b; });
            for (var ci = 0; ci < sortedComm.length; ci++) {
                var cid = sortedComm[ci];
                var arr = groups[cid];
                var typesIn = {};
                for (var ui = 0; ui < arr.length; ui++) {
                    var t = arr[ui].type || 'unknown';
                    typesIn[t] = (typesIn[t] || 0) + 1;
                }
                out.push('[' + cid + '] ' + arr.length + ' узлов:');
                for (var ui2 = 0; ui2 < arr.length; ui2++) {
                    out.push('  ' + String(ui2 + 1).padStart(2) + '. ' +
                             String(arr[ui2].id).padEnd(20) + ' | ' +
                             String(arr[ui2].type || '—').padEnd(14) + ' | ' +
                             (arr[ui2].label || '—'));
                }
                var typesList = [];
                for (var tk in typesIn) typesList.push(tk + '=' + typesIn[tk]);
                out.push('  Состав: ' + typesList.join(', '));
                out.push('');
            }

            // Матрица сообществ
            var commIdx = {};
            for (var xi = 0; xi < sortedComm.length; xi++) {
                commIdx[sortedComm[xi]] = xi;
            }
            var nComm = sortedComm.length;
            var commMatrix = [];
            for (var ri = 0; ri < nComm; ri++) commMatrix.push(new Array(nComm).fill(0));

            var idx2 = {};
            for (var ni3 = 0; ni3 < nodes.length; ni3++) idx2[nodes[ni3].id] = ni3;

            for (var ei3 = 0; ei3 < edges.length; ei3++) {
                var ed = edges[ei3];
                var cA = lv.communities[ed.source];
                var cB = lv.communities[ed.target];
                if (cA === undefined || cB === undefined) continue;
                var ia = commIdx[cA], ib = commIdx[cB];
                if (ia === undefined || ib === undefined) continue;
                if (ia === ib) {
                    commMatrix[ia][ia] += (ed.weight || 1);
                } else {
                    commMatrix[ia][ib] += (ed.weight || 1);
                    commMatrix[ib][ia] += (ed.weight || 1);
                }
            }

            out.push('--- МАТРИЦА СООБЩЕСТВ (' + nComm + '×' + nComm + ') ---');
            out.push('Внутренние рёбра — на диагонали. Межсообщностные — вне диагонали.');
            out.push('');
            var commHeader = '        ';
            for (var ch = 0; ch < nComm; ch++) commHeader += 'C' + ch + '   ';
            out.push(commHeader);
            for (var cr = 0; cr < nComm; cr++) {
                var commRow = 'C' + cr + '      ';
                for (var cc = 0; cc < nComm; cc++) {
                    commRow += String(commMatrix[cr][cc]).padStart(4) + ' ';
                }
                out.push(commRow);
            }
            out.push('');

            var cutEdges = 0;
            var internalEdges = 0;
            for (var ci2 = 0; ci2 < nComm; ci2++) {
                for (var cj = 0; cj < nComm; cj++) {
                    if (ci2 === cj) internalEdges += commMatrix[ci2][cj];
                    else cutEdges += commMatrix[ci2][cj];
                }
            }
            out.push('Внутренних рёбер (сумма): ' + internalEdges);
            out.push('Разрезанных рёбер (сумма): ' + cutEdges);
            out.push('Доля разрезанных: ' + (internalEdges + cutEdges > 0 ?
                ((cutEdges / (internalEdges + cutEdges)) * 100).toFixed(2) : 0) + '%');
            out.push('');

            // Метрики сообществ
            var metrics = window.Relations.allMetrics({ nodes: nodes, edges: edges });
            var metricsMap = {};
            for (var mi = 0; mi < metrics.length; mi++) metricsMap[metrics[mi].id] = metrics[mi];

            out.push('--- МЕТРИКИ СООБЩЕСТВ ---');
            for (var ci3 = 0; ci3 < sortedComm.length; ci3++) {
                var cid2 = sortedComm[ci3];
                var arr2 = groups[cid2];
                var size = arr2.length;
                var internalWeight = commMatrix[ci3][ci3];
                var possibleInternal = size * (size - 1);
                var density = possibleInternal > 0 ? (internalWeight / possibleInternal) : 0;

                // Центральный узел — max degree
                var centralId = null;
                var centralDeg = -1;
                var sumDeg = 0, sumBet = 0, sumClo = 0;
                for (var ai = 0; ai < arr2.length; ai++) {
                    var m = metricsMap[arr2[ai].id];
                    if (!m) continue;
                    if (m.degree > centralDeg) {
                        centralDeg = m.degree;
                        centralId = arr2[ai].id;
                    }
                    sumDeg += m.degree;
                    sumBet += m.betweenness;
                    sumClo += m.closeness;
                }

                out.push('[' + cid2 + '] ' + size + ' узлов');
                out.push('  Внутренний вес: ' + internalWeight);
                out.push('  Плотность: ' + (density * 100).toFixed(2) + '%');
                out.push('  Средний degree: ' + (sumDeg / size).toFixed(4));
                out.push('  Средний betweenness: ' + (sumBet / size).toFixed(4));
                out.push('  Средний closeness: ' + (sumClo / size).toFixed(4));
                if (centralId) {
                    out.push('  Центральный узел: ' + centralId +
                             ' (degree=' + centralDeg.toFixed(4) + ')');
                }
                out.push('');
            }
        } catch (err) {
            out.push('(Louvain недоступен: ' + err.message + ')');
            out.push('');
        }
    }


    // ============ ТОП-10 ПО PAGERANK ============
    if (window.Relations && window.Relations.pagerank && nodes.length > 0) {
        try {
            var pr = window.Relations.pagerank({ nodes: nodes, edges: edges });
            var prArr = [];
            for (var prId in pr) {
                if (prId.charAt(0) === '_') continue;
                var nd = null;
                for (var ni = 0; ni < nodes.length; ni++) {
                    if (nodes[ni].id === prId) { nd = nodes[ni]; break; }
                }
                prArr.push({ id: prId, value: pr[prId], label: nd ? nd.label : prId, type: nd ? nd.type : '—' });
            }
            prArr.sort(function(a, b) { return b.value - a.value; });

            out.push('--- ТОП-10 ПО PAGERANK ---');
            out.push('Алгоритм: PageRank (Brin & Page 1998)');
            out.push('Damping: 0.85, итераций: ' + (pr._iterations || '—') +
                     ', сошёлся: ' + (pr._converged ? 'да' : 'нет'));
            out.push('Интерпретация: важность узла по числу и качеству входящих связей.');
            out.push('');
            for (var pi = 0; pi < Math.min(prArr.length, 10); pi++) {
                out.push('  ' + String(pi + 1).padStart(2) + '. ' +
                    String(prArr[pi].id).padEnd(20) + ' — PR=' + _fmt(prArr[pi].value) +
                    ' (' + prArr[pi].label + ', ' + prArr[pi].type + ')');
            }
            out.push('');
        } catch (err) {
            out.push('(PageRank недоступен: ' + err.message + ')');
            out.push('');
        }
    }

    // ============ ТОП-10 ПО EIGENVECTOR ============
    if (window.Relations && window.Relations.eigenvectorCentrality && nodes.length > 0) {
        try {
            var eig = window.Relations.eigenvectorCentrality({ nodes: nodes, edges: edges });
            var eigArr = [];
            for (var eigId in eig) {
                if (eigId.charAt(0) === '_') continue;
                var nd2 = null;
                for (var ni2 = 0; ni2 < nodes.length; ni2++) {
                    if (nodes[ni2].id === eigId) { nd2 = nodes[ni2]; break; }
                }
                eigArr.push({ id: eigId, value: eig[eigId], label: nd2 ? nd2.label : eigId, type: nd2 ? nd2.type : '—' });
            }
            eigArr.sort(function(a, b) { return b.value - a.value; });

            out.push('--- ТОП-10 ПО EIGENVECTOR ---');
            out.push('Алгоритм: Eigenvector Centrality (Bonacich 1972)');
            out.push('Итераций: ' + (eig._iterations || '—') +
                     ', сошёлся: ' + (eig._converged ? 'да' : 'нет'));
            out.push('Интерпретация: важность узла по важности его соседей.');
            out.push('');
            for (var ei2 = 0; ei2 < Math.min(eigArr.length, 10); ei2++) {
                out.push('  ' + String(ei2 + 1).padStart(2) + '. ' +
                    String(eigArr[ei2].id).padEnd(20) + ' — EC=' + _fmt(eigArr[ei2].value) +
                    ' (' + eigArr[ei2].label + ', ' + eigArr[ei2].type + ')');
            }
            out.push('');
        } catch (err2) {
            out.push('(Eigenvector недоступен: ' + err2.message + ')');
            out.push('');
        }
    }

    // ============ СРАВНЕНИЕ МЕТРИК ============
    if (window.Relations && window.Relations.allMetrics && nodes.length > 0) {
        try {
            var allM = window.Relations.allMetrics({ nodes: nodes, edges: edges });
            // Считаем ранги по каждой метрике
            var metricNames = ['degree', 'betweenness', 'closeness', 'pagerank', 'eigenvector'];
            var ranks = {};
            for (var mi = 0; mi < metricNames.length; mi++) {
                var mn = metricNames[mi];
                var sorted = allM.slice().sort(function(a, b) { return b[mn] - a[mn]; });
                ranks[mn] = {};
                for (var ri = 0; ri < sorted.length; ri++) {
                    ranks[mn][sorted[ri].id] = ri + 1;
                }
            }

            out.push('--- СРАВНЕНИЕ МЕТРИК (20 узлов) ---');
            out.push('Показаны ранги (1 = лучший) по каждой из 5 метрик.');
            out.push('Узел                | degree | betw | clos | PR   | Eig');
            out.push('--------------------|--------|------|------|------|-----');
            for (var ui = 0; ui < allM.length; ui++) {
                var u = allM[ui];
                out.push(
                    String(u.id).padEnd(19) + ' | ' +
                    String(ranks.degree[u.id]).padStart(6) + ' | ' +
                    String(ranks.betweenness[u.id]).padStart(4) + ' | ' +
                    String(ranks.closeness[u.id]).padStart(4) + ' | ' +
                    String(ranks.pagerank[u.id]).padStart(4) + ' | ' +
                    String(ranks.eigenvector[u.id]).padStart(4)
                );
            }
            out.push('');

            // Узлы с наибольшим расхождением
            out.push('--- РАСХОЖДЕНИЯ МЕЖДУ МЕТРИКАМИ ---');
            out.push('Узлы, у которых ранг по одной метрике отличается от других на 5+ позиций:');
            out.push('');
            for (var di = 0; di < allM.length; di++) {
                var uid = allM[di].id;
                var rs = [ranks.degree[uid], ranks.betweenness[uid], ranks.closeness[uid],
                          ranks.pagerank[uid], ranks.eigenvector[uid]];
                var maxR = Math.max.apply(null, rs);
                var minR = Math.min.apply(null, rs);
                if (maxR - minR >= 5) {
                    out.push('  ' + String(uid).padEnd(20) +
                        ' degree=' + rs[0] + ' betw=' + rs[1] + ' clos=' + rs[2] +
                        ' PR=' + rs[3] + ' Eig=' + rs[4] +
                        ' (разброс ' + (maxR - minR) + ')');
                }
            }
            out.push('');
        } catch (err3) {
            out.push('(Сравнение метрик недоступно: ' + err3.message + ')');
            out.push('');
        }
    }


    // ============ CLUSTERING COEFFICIENT ============
    if (window.Relations && window.Relations.clusteringCoefficient && nodes.length > 0) {
        try {
            var cc = window.Relations.clusteringCoefficient({ nodes: nodes, edges: edges });
            out.push('--- CLUSTERING COEFFICIENT (Watts & Strogatz 1998) ---');
            out.push('Global clustering: ' + _fmt(cc.global));
            out.push('Transitivity:      ' + _fmt(cc.transitivity));
            out.push('Triangles:         ' + cc.triangles);
            out.push('');
            out.push('Интерпретация:');
            out.push('  < 0.10 — низкая кластеризация (деревья, иерархии)');
            out.push('  0.10–0.30 — умеренная');
            out.push('  > 0.30 — высокая (плотные кланы)');
            out.push('');

            var localArr = [];
            for (var lid in cc.local) {
                var lnd = null;
                for (var lni = 0; lni < nodes.length; lni++) {
                    if (nodes[lni].id === lid) { lnd = nodes[lni]; break; }
                }
                localArr.push({ id: lid, value: cc.local[lid], label: lnd ? lnd.label : lid });
            }
            localArr.sort(function(a, b) { return b.value - a.value; });

            out.push('Топ-10 узлов по локальной кластеризации:');
            for (var li = 0; li < Math.min(localArr.length, 10); li++) {
                out.push('  ' + String(li + 1).padStart(2) + '. ' +
                    String(localArr[li].id).padEnd(20) + ' — C=' + _fmt(localArr[li].value) +
                    ' (' + localArr[li].label + ')');
            }
            out.push('');
        } catch (err) {
            out.push('(Clustering недоступен: ' + err.message + ')');
            out.push('');
        }
    }

    // ============ ДИАМЕТР СЕТИ ============
    if (window.Relations && window.Relations.networkDiameter && nodes.length > 0) {
        try {
            var diam = window.Relations.networkDiameter({ nodes: nodes, edges: edges });
            out.push('--- ДИАМЕТР СЕТИ ---');
            out.push('Диаметр:            ' + diam.diameter);
            out.push('Средняя длина пути: ' + _fmt(diam.avgPathLength));
            out.push('Пар проанализировано: ' + diam.pairs);
            out.push('');
            out.push('Интерпретация:');
            out.push('  Диаметр = макс. кратчайшее расстояние между любыми двумя узлами.');
            out.push('  Avg path = среднее число шагов между случайной парой.');
            out.push('');
            out.push('  Для графа из ' + nodes.length + ' узлов и ' + edges.length + ' связей:');
            out.push('  диаметр ' + diam.diameter + ' и avg ' + _fmt(diam.avgPathLength) +
                     ' — граф ' + (diam.diameter > 8 ? 'разреженный (периферия есть)' : 'компактный'));
            out.push('');

            var eccArr = [];
            for (var eid in diam.eccentricities) {
                eccArr.push({ id: eid, value: diam.eccentricities[eid] });
            }
            eccArr.sort(function(a, b) { return a.value - b.value; });

            out.push('Эксцентриситеты (топ-5 центральных):');
            for (var ei = 0; ei < Math.min(eccArr.length, 5); ei++) {
                out.push('  ' + String(ei + 1).padStart(2) + '. ' +
                    String(eccArr[ei].id).padEnd(20) + ' — ecc=' + eccArr[ei].value);
            }
            out.push('');
            out.push('Эксцентриситеты (топ-5 периферийных):');
            for (var ei2 = eccArr.length - 1; ei2 >= Math.max(0, eccArr.length - 5); ei2--) {
                out.push('  ' + String(eccArr.length - ei2).padStart(2) + '. ' +
                    String(eccArr[ei2].id).padEnd(20) + ' — ecc=' + eccArr[ei2].value);
            }
            out.push('');
        } catch (err) {
            out.push('(Диаметр недоступен: ' + err.message + ')');
            out.push('');
        }
    }

    // ============ АССОРТАТИВНОСТЬ ============
    if (window.Relations && window.Relations.assortativity && nodes.length > 0) {
        try {
            var asrt = window.Relations.assortativity({ nodes: nodes, edges: edges });
            out.push('--- АССОРТАТИВНОСТЬ (Newman 2002) ---');
            out.push('Коэффициент: ' + _fmt(asrt.assortativity));
            out.push('');
            out.push('Интерпретация:');
            out.push('  +1.0 — полная ассортативность (однотипные соединяются)');
            out.push('   0.0 — случайное смешение');
            out.push('  -1.0 — полная диссортативность (разнотипные соединяются)');
            out.push('');

            var interpret = '';
            if (asrt.assortativity > 0.2) interpret = 'ассортативность (кланы)';
            else if (asrt.assortativity < -0.2) interpret = 'диссортативность (иерархия)';
            else interpret = 'случайное смешение';
            out.push('Вывод: ' + interpret);
            out.push('');

            out.push('Матрица смешения типов (' + asrt.types.length + ' типов):');
            out.push('Типы: ' + asrt.types.join(', '));
            out.push('');

            var header = '        ';
            for (var hh = 0; hh < asrt.types.length; hh++) {
                header += String(asrt.types[hh]).slice(0, 12).padEnd(13);
            }
            out.push(header);
            for (var mr = 0; mr < asrt.types.length; mr++) {
                var row = String(asrt.types[mr]).slice(0, 6).padEnd(8);
                for (var mc = 0; mc < asrt.types.length; mc++) {
                    row += String(asrt.typeMatrix[mr][mc]).padStart(12) + ' ';
                }
                out.push(row);
            }
            out.push('');
        } catch (err) {
            out.push('(Ассортативность недоступна: ' + err.message + ')');
            out.push('');
        }
    }

    // ============ ТОПБАР ============
    out.push('--- ТОПБАР ---');
    var brand = document.getElementById('brand-text');
    out.push('Бренд: ' + _safeText(brand));
    var mapButtons = document.querySelectorAll('.map-switch-btn');
    out.push('Кнопок карт: ' + mapButtons.length);
    for (var mb = 0; mb < mapButtons.length; mb++) {
        var mbtn = mapButtons[mb];
        out.push('  ' + _safeText(mbtn) + ' → ' + (mbtn.getAttribute('href') || '—') +
                 (mbtn.classList.contains('active') ? ' [ACTIVE]' : ''));
    }
    var topbarButtons = document.querySelectorAll('.topbar-btn');
    out.push('Кнопок топбара: ' + topbarButtons.length);
    for (var tb = 0; tb < topbarButtons.length; tb++) {
        out.push('  ' + _safeText(topbarButtons[tb]));
    }
    var navButtons = document.querySelectorAll('.nav-btn');
    out.push('Nav-dashboards кнопок: ' + navButtons.length);
    out.push('');


    // ============ УЗЛЫ ПО ТИПАМ ============
    (function() {
        var byType = {};
        for (var i = 0; i < nodes.length; i++) {
            var t = nodes[i].type || 'unknown';
            if (!byType[t]) byType[t] = [];
            byType[t].push(nodes[i]);
        }
        out.push('--- УЗЛЫ ПО ТИПАМ ---');
        var typeKeys = Object.keys(byType).sort();
        for (var ti = 0; ti < typeKeys.length; ti++) {
            var tk = typeKeys[ti];
            out.push('[' + tk + '] ' + byType[tk].length + ' узлов:');
            for (var u = 0; u < byType[tk].length; u++) {
                out.push('  ' + String(u + 1).padStart(2) + '. ' +
                    String(byType[tk][u].id).padEnd(20) + ' | ' +
                    (byType[tk][u].label || '—'));
            }
            out.push('');
        }
    })();

    // ============ СВЯЗИ ПО ТИПАМ ============
    (function() {
        var byType = {};
        for (var i = 0; i < edges.length; i++) {
            var t = edges[i].type || 'unknown';
            if (!byType[t]) byType[t] = [];
            byType[t].push(edges[i]);
        }
        out.push('--- СВЯЗИ ПО ТИПАМ ---');
        var typeKeys = Object.keys(byType).sort();
        for (var ti = 0; ti < typeKeys.length; ti++) {
            var tk = typeKeys[ti];
            out.push('[' + tk + '] ' + byType[tk].length + ' связей:');
            for (var u = 0; u < byType[tk].length; u++) {
                var e = byType[tk][u];
                out.push('  ' + String(u + 1).padStart(2) + '. ' +
                    String(e.source).padEnd(18) + ' → ' +
                    String(e.target).padEnd(18) + ' | w=' + (e.weight || 1));
            }
            out.push('');
        }
    })();

    // ============ МАТРИЦА СМЕЖНОСТИ ============
    (function() {
        var n = nodes.length;
        if (n === 0 || n > 200) {
            out.push('--- МАТРИЦА СМЕЖНОСТИ ---');
            out.push('(пропущена: узлов ' + n + ', лимит 200)');
            out.push('');
            return;
        }

        var index = {};
        for (var i = 0; i < n; i++) index[nodes[i].id] = i;

        var matrix = [];
        for (var r = 0; r < n; r++) {
            matrix.push(new Array(n).fill(0));
        }
        for (var e = 0; e < edges.length; e++) {
            var ei = index[edges[e].source];
            var ej = index[edges[e].target];
            if (ei === undefined || ej === undefined) continue;
            var w = edges[e].weight || 1;
            matrix[ei][ej] = w;
            matrix[ej][ei] = w;
        }

        out.push('--- МАТРИЦА СМЕЖНОСТИ (' + n + '×' + n + ') ---');
        out.push('Порядок: ' + nodes.map(function(x) { return x.id; }).join(', '));
        out.push('');

        var header = '         ';
        for (var h = 0; h < n; h++) {
            header += String(h + 1).padStart(3);
        }
        out.push(header);
        for (var r2 = 0; r2 < n; r2++) {
            var row = String(r2 + 1).padStart(3) + ' ' +
                      String(nodes[r2].id).slice(0, 5).padEnd(5) + ' ';
            for (var c2 = 0; c2 < n; c2++) {
                row += String(matrix[r2][c2]).padStart(3);
            }
            out.push(row);
        }
        out.push('');

        var totalW = 0;
        var density = 0;
        for (var r3 = 0; r3 < n; r3++) {
            for (var c3 = 0; c3 < n; c3++) {
                if (matrix[r3][c3] > 0) {
                    totalW += matrix[r3][c3];
                    density++;
                }
            }
        }
        out.push('Плотность: ' + density + ' направленных пар из ' + (n * (n - 1)) +
                 ' = ' + (n > 1 ? ((density / (n * (n - 1))) * 100).toFixed(2) : 0) + '%');
        out.push('Суммарный вес: ' + totalW);
        out.push('');
    })();

    // ============ ТОП ПО МЕТРИКАМ ============
    if (window.Relations && nodes.length > 0) {
        try {
            var metrics = window.Relations.allMetrics({ nodes: nodes, edges: edges });

            out.push('--- ТОП-10 ПО DEGREE ---');
            var sortedDeg = metrics.slice().sort(function(a, b) { return b.degree - a.degree; });
            for (var d = 0; d < Math.min(sortedDeg.length, 10); d++) {
                out.push('  ' + String(d + 1).padStart(2) + '. ' +
                    String(sortedDeg[d].id).padEnd(20) + ' — degree=' + _fmt(sortedDeg[d].degree) +
                    ' (' + sortedDeg[d].label + ')');
            }
            out.push('');

            out.push('--- ТОП-10 ПО BETWEENNESS ---');
            var sortedBet = metrics.slice().sort(function(a, b) { return b.betweenness - a.betweenness; });
            for (var b2 = 0; b2 < Math.min(sortedBet.length, 10); b2++) {
                out.push('  ' + String(b2 + 1).padStart(2) + '. ' +
                    String(sortedBet[b2].id).padEnd(20) + ' — betweenness=' + _fmt(sortedBet[b2].betweenness) +
                    ' (' + sortedBet[b2].label + ')');
            }
            out.push('');

            out.push('--- ТОП-10 ПО CLOSENESS ---');
            var sortedClo = metrics.slice().sort(function(a, b) { return b.closeness - a.closeness; });
            for (var c4 = 0; c4 < Math.min(sortedClo.length, 10); c4++) {
                out.push('  ' + String(c4 + 1).padStart(2) + '. ' +
                    String(sortedClo[c4].id).padEnd(20) + ' — closeness=' + _fmt(sortedClo[c4].closeness) +
                    ' (' + sortedClo[c4].label + ')');
            }
            out.push('');

            out.push('--- ПОЛНАЯ ТАБЛИЦА МЕТРИК (' + metrics.length + ') ---');
            out.push('id                  | type         | degree   | betweenness | closeness');
            out.push('--------------------|--------------|----------|-------------|----------');
            for (var m = 0; m < metrics.length; m++) {
                out.push(
                    String(metrics[m].id).padEnd(19) + ' | ' +
                    String(metrics[m].type || '—').padEnd(12) + ' | ' +
                    _fmt(metrics[m].degree).padStart(8) + ' | ' +
                    _fmt(metrics[m].betweenness).padStart(11) + ' | ' +
                    _fmt(metrics[m].closeness).padStart(9)
                );
            }
            out.push('');
        } catch (err) {
            out.push('(топ по метрикам недоступен: ' + err.message + ')');
            out.push('');
        }
    }

    // ============ СМЕЖНЫЕ УЗЛЫ ============
    (function() {
        if (nodes.length === 0) return;
        out.push('--- СМЕЖНЫЕ УЗЛЫ (' + nodes.length + ') ---');
        for (var i = 0; i < nodes.length; i++) {
            var nid = nodes[i].id;
            var incoming = [];
            var outgoing = [];
            for (var e = 0; e < edges.length; e++) {
                if (edges[e].target === nid) incoming.push(edges[e].source + '(' + (edges[e].type || 'flow') + ')');
                if (edges[e].source === nid) outgoing.push(edges[e].target + '(' + (edges[e].type || 'flow') + ')');
            }
            out.push('[' + String(i + 1).padStart(2) + '] ' + nid + ' (' + (nodes[i].label || '—') + '):');
            out.push('  Входящие (' + incoming.length + '): ' + (incoming.length ? incoming.join(', ') : '—'));
            out.push('  Исходящие (' + outgoing.length + '): ' + (outgoing.length ? outgoing.join(', ') : '—'));
            out.push('  Степень: ' + (incoming.length + outgoing.length));
        }
        out.push('');
    })();

    // ============ DOT-ФОРМАТ ============
    (function() {
        if (nodes.length === 0) return;
        out.push('--- DOT-ФОРМАТ (Graphviz) ---');
        out.push('digraph NetworkMap {');
        out.push('    rankdir=LR;');
        out.push('    node [shape=box, style=rounded];');
        out.push('');

        var shapeByType = {
            country: 'circle',
            organization: 'box',
            event: 'triangle',
            financial: 'diamond'
        };
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            var shp = shapeByType[n.type] || 'ellipse';
            out.push('    "' + n.id + '" [label="' + (n.label || n.id).replace(/"/g, '\\"') +
                     '", shape=' + shp + '];');
        }
        out.push('');
        for (var e = 0; e < edges.length; e++) {
            var edge = edges[e];
            out.push('    "' + edge.source + '" -> "' + edge.target +
                     '" [label="' + (edge.type || 'flow') + '", weight=' + (edge.weight || 1) + '];');
        }
        out.push('}');
        out.push('');
    })();

    // ============ D3 JSON ============
    (function() {
        if (nodes.length === 0) return;
        out.push('--- D3 JSON ---');
        var d3 = {
            nodes: nodes.map(function(n) {
                return {
                    id: n.id,
                    label: n.label || n.id,
                    type: n.type || 'country',
                    weight: n.weight || 1,
                    x: Math.round(n.x * 100) / 100,
                    y: Math.round(n.y * 100) / 100
                };
            }),
            links: edges.map(function(e) {
                return {
                    source: e.source,
                    target: e.target,
                    type: e.type || 'flow',
                    value: e.weight || 1
                };
            })
        };
        out.push(JSON.stringify(d3, null, 2));
        out.push('');
    })();

    // ============ CSV EXPORT ============
    (function() {
        if (nodes.length === 0) return;

        out.push('--- CSV: УЗЛЫ ---');
        out.push('id,label,type,weight,x,y');
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            out.push(
                '"' + n.id + '",' +
                '"' + (n.label || n.id).replace(/"/g, '""') + '",' +
                '"' + (n.type || 'country') + '",' +
                (n.weight || 1) + ',' +
                (Math.round(n.x * 100) / 100) + ',' +
                (Math.round(n.y * 100) / 100)
            );
        }
        out.push('');

        out.push('--- CSV: СВЯЗИ ---');
        out.push('source,target,type,weight');
        for (var e = 0; e < edges.length; e++) {
            out.push(
                '"' + edges[e].source + '",' +
                '"' + edges[e].target + '",' +
                '"' + (edges[e].type || 'flow') + '",' +
                (edges[e].weight || 1)
            );
        }
        out.push('');
    })();

    // ============ CSS СТИЛИ SVG ============
    (function() {
        var svgEl = document.getElementById('graph-svg');
        if (!svgEl) return;
        out.push('--- CSS СТИЛИ SVG ---');
        out.push('svg:');
        var svgCS = window.getComputedStyle(svgEl);
        out.push('  background: ' + svgCS.backgroundColor);
        out.push('  width: ' + svgCS.width);
        out.push('  height: ' + svgCS.height);
        out.push('');

        var sampleNode = svgEl.querySelector('circle, rect, polygon');
        if (sampleNode) {
            var nCS = window.getComputedStyle(sampleNode);
            out.push('node (' + sampleNode.tagName.toLowerCase() + '):');
            out.push('  fill: ' + nCS.fill);
            out.push('  stroke: ' + nCS.stroke);
            out.push('  stroke-width: ' + nCS.strokeWidth);
            out.push('  opacity: ' + nCS.opacity);
            out.push('');
        }

        var sampleEdge = svgEl.querySelector('line');
        if (sampleEdge) {
            var eCS = window.getComputedStyle(sampleEdge);
            out.push('edge (line):');
            out.push('  stroke: ' + eCS.stroke);
            out.push('  stroke-width: ' + eCS.strokeWidth);
            out.push('  stroke-dasharray: ' + eCS.strokeDasharray);
            out.push('  opacity: ' + eCS.opacity);
            out.push('');
        }

        var sampleText = svgEl.querySelector('text');
        if (sampleText) {
            var tCS = window.getComputedStyle(sampleText);
            out.push('label (text):');
            out.push('  fill: ' + tCS.fill);
            out.push('  font-size: ' + tCS.fontSize);
            out.push('  font-family: ' + tCS.fontFamily);
            out.push('  text-anchor: ' + tCS.textAnchor);
            out.push('');
        }
    })();

    // ============ ФИНАЛ ============
    out.push('--- CRUCIX OSINT TERMINAL ---');
    out.push('🌐 ' + window.location.origin + '/network-map');
    out.push('Карта: relations (network)');
    out.push(sep);

    // ============ СБОРКА ============
    var text = out.join('\n');
    var byteLength;
    try { byteLength = new TextEncoder().encode(text).length; }
    catch (e) { byteLength = text.length * 2; }
    var sizeKB = Math.round(byteLength / 1024);

    console.log('[copyAllData v2.0] Снапшот: ' + text.length + ' символов, ~' + sizeKB + ' КБ');

    function _fallback(txt) {
        var ta = document.createElement('textarea');
        ta.value = txt;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) { /* ignore */ }
        document.body.removeChild(ta);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
            var btn = document.getElementById('copy-btn');
            if (btn) {
                var orig = btn.textContent;
                btn.textContent = '✅ ' + sizeKB + ' KB';
                btn.classList.add('copied');
                setTimeout(function() {
                    btn.textContent = orig;
                    btn.classList.remove('copied');
                }, 3000);
            }
            if (window.showNotification) {
                window.showNotification('📋 Скопировано: ~' + sizeKB + ' КБ (' +
                    nodes.length + ' узлов, ' + edges.length + ' связей)', 'success');
            }
        }).catch(function() {
            _fallback(text);
            if (window.showNotification) {
                window.showNotification('📋 Скопировано (fallback): ~' + sizeKB + ' КБ');
            }
        });
    } else {
        _fallback(text);
        if (window.showNotification) {
            window.showNotification('📋 Скопировано (fallback): ~' + sizeKB + ' КБ');
        }
    }
};

// ------------------------------------------------------------
// Справка
// ------------------------------------------------------------
window.openHelp = function() {
    var lang = localStorage.getItem('crucix-lang') || 'ru';
    var url = '/data/help/' + lang + '/network-map.txt';
    fetch(url)
        .then(function(r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
        })
        .then(function(text) { alert(text || 'Справка не найдена'); })
        .catch(function() {
            alert('Справка для Network Map пока не создана.\n\n' +
                  'Карта визуализирует графы связей:\n' +
                  '• 12 слоёв (7 flow + 5 social)\n' +
                  '• Force-directed graph на чистом SVG\n' +
                  '• 4 формы узлов: страна, организация, событие, финансы\n' +
                  '• Degree centrality, компоненты связности\n' +
                  '• Кнопки: сброс, зум, слайдеры force/distance\n\n' +
                  'Документация в разработке.');
        });
};

// ------------------------------------------------------------
// Язык
// ------------------------------------------------------------
window.setLanguage = function(lang) {
    localStorage.setItem('crucix-lang', lang);
    document.querySelectorAll('.lang-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    if (window.showNotification) window.showNotification('🌐 Язык: ' + lang.toUpperCase());
};

// ------------------------------------------------------------
// Заглушки
// ------------------------------------------------------------
window.toggleHeat = function() {
    if (!window.GraphView) {
        if (window.showNotification) window.showNotification('⚠️ GraphView не загружен');
        return;
    }
    if (typeof window.GraphView.toggleHeatmap !== 'function') {
        if (window.showNotification) window.showNotification('🌡️ Heatmap недоступна');
        return;
    }

    // Определяем метрику: если выбрана в 📊 Метрики — используем; иначе PageRank
    var currentMetric = window.GraphView.getCurrentMetric ?
        window.GraphView.getCurrentMetric() : null;
    var metric = currentMetric || 'pagerank';

    var result = window.GraphView.toggleHeatmap(metric);

    var btn = document.getElementById('btn-heat');
    var showing = window.GraphView.isShowingHeatmap ?
        window.GraphView.isShowingHeatmap() : false;

    if (btn) {
        btn.style.background = showing ? 'rgba(239, 68, 68, 0.2)' : '';
        btn.style.borderColor = showing ? 'rgba(239, 68, 68, 0.5)' : '';
    }

    if (result) {
        if (window.renderHeatmapLegend) {
            window.renderHeatmapLegend(result);
        }
        if (window.showNotification) {
            window.showNotification('🌡️ Heatmap: ' + result.metricName +
                ' (' + result.min.toFixed(2) + '–' + result.max.toFixed(2) + ')');
        }
    } else {
        if (window.clearHeatmapLegend) {
            window.clearHeatmapLegend();
        }
        if (window.showNotification) {
            window.showNotification('🌡️ Heatmap выключена');
        }
    }
};

window.toggleTimeline = function() {
    if (window.showNotification) window.showNotification('📅 Хронология в разработке');
};

// ------------------------------------------------------------
// Панель слоёв
// ------------------------------------------------------------
window.toggleLayerPanel = function() {
    var panel = document.getElementById('layer-panel');
    var mapContainer = document.getElementById('map-container');
    var toggleBtn = document.getElementById('panel-toggle-btn');
    if (!panel) return;
    var collapsed = panel.classList.toggle('collapsed');
    if (mapContainer) mapContainer.classList.toggle('full', collapsed);
    if (toggleBtn) toggleBtn.classList.toggle('visible', collapsed);
};

// ------------------------------------------------------------
// Все слои
// ------------------------------------------------------------
window.enableAllLayers = function() {
    if (!window.allLayers || !window.NetworkMap) return;
    for (var i = 0; i < window.allLayers.length; i++) {
        window.NetworkMap.loadLayer(window.allLayers[i].id);
        break;
    }
    if (window.showNotification) window.showNotification('✅ Включены все слои');
};

window.disableAllLayers = function() {
    if (window.GraphView && window.GraphView.setData) {
        window.GraphView.setData({ nodes: [], edges: [] });
    }
    if (window.showNotification) window.showNotification('⏹️ Все слои выключены');
};

// ------------------------------------------------------------
// Обновление времени
// ------------------------------------------------------------
window.updateLastRefresh = function() {
    var el = document.getElementById('update-text');
    if (el) el.textContent = new Date().toLocaleTimeString('ru-RU');
};

console.log('✅ TOPBAR.JS (network-map v2.0) готов');
