// ============================================================
// GRAPH-VIEW.JS — Force-directed graph на чистом SVG (Barabasi 2016)
// ============================================================
// Coulomb repulsion: F = k / r²
// Hooke attraction:  F = (d − L) × 0.1
// Gravity:           F = (center − pos) × 0.05
// Verlet integration с velocity decay.
// 4 формы узлов по Munzner 2014: circle, square, triangle, diamond.
// ============================================================

console.log('📊 GRAPH-VIEW.JS загружен');

window.GraphView = (function() {
    var svg, width, height;
    var nodes = [], edges = [];
    var nodeMap = {};
    var transform = { x: 0, y: 0, k: 1 };
    var config = {
        force: 80,
        distance: 100,
        charge: -300,
        gravity: 0.05,
        velocityDecay: 0.8
    };
    var running = false;
    var animFrame = null;
    var _saveTimer = null;

    var LOUVAIN_PALETTE = [
        '#58a6ff', // 0 — синий
        '#3fb950', // 1 — зелёный
        '#f0883e', // 2 — оранжевый
        '#a371f7', // 3 — фиолетовый
        '#f85149', // 4 — красный
        '#e3b341', // 5 — жёлтый
        '#56d4dd', // 6 — бирюзовый
        '#db61a2', // 7 — розовый
        '#7ee787', // 8 — салатовый
        '#ffa657'  // 9 — персиковый
    ];

    var showCommunities = false;
    var cachedCommunities = null;


    // ------------------------------------------------------------
    // Инициализация
    // ------------------------------------------------------------
    function init(svgEl) {
        svg = svgEl;
        var rect = svg.getBoundingClientRect();
        width = rect.width || 800;
        height = rect.height || 600;
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        _setupZoom();

        // Пересчёт при изменении размера окна
        window.addEventListener('resize', function() {
            var r = svg.getBoundingClientRect();
            width = r.width || width;
            height = r.height || height;
            svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
            render();
        });
    }

    // ------------------------------------------------------------
    // Установка данных
    // ------------------------------------------------------------
    function setData(graphData, layerId) {
        if (!graphData) graphData = { nodes: [], edges: [] };

        var cx = width / 2;
        var cy = height / 2;

        // Попытка восстановить позиции из localStorage
        var savedPositions = null;
        var cacheKey = 'crucix-network-positions-' + (layerId || 'default');
        try {
            var raw = localStorage.getItem(cacheKey);
            if (raw) savedPositions = JSON.parse(raw);
        } catch (e) { savedPositions = null; }

        nodes = (graphData.nodes || []).map(function(n, i) {
            var saved = savedPositions && savedPositions[n.id];
            var pos = saved || {};
            return {
                id: n.id,
                label: n.label || n.id,
                type: n.type || 'country',
                weight: n.weight || 1,
                x: (typeof pos.x === 'number') ? pos.x : cx + (Math.random() - 0.5) * 200,
                y: (typeof pos.y === 'number') ? pos.y : cy + (Math.random() - 0.5) * 200,
                vx: 0, vy: 0
            };
        });

        nodeMap = {};
        for (var i = 0; i < nodes.length; i++) {
            nodeMap[nodes[i].id] = nodes[i];
        }

        edges = (graphData.edges || []).map(function(e) {
            return {
                source: e.source,
                target: e.target,
                weight: e.weight || 1,
                type: e.type || 'flow'
            };
        });

        _simulate();
        render();
        bindNodeClicks();

        // Сохранить позиции после симуляции
        _scheduleSavePositions(layerId);
    }

    // ------------------------------------------------------------
    // Сохранение позиций в localStorage
    // ------------------------------------------------------------
    function _scheduleSavePositions(layerId) {
        if (_saveTimer) clearTimeout(_saveTimer);
        _saveTimer = setTimeout(function() {
            try {
                var positions = {};
                for (var i = 0; i < nodes.length; i++) {
                    positions[nodes[i].id] = {
                        x: Math.round(nodes[i].x * 10) / 10,
                        y: Math.round(nodes[i].y * 10) / 10
                    };
                }
                var key = 'crucix-network-positions-' + (layerId || 'default');
                localStorage.setItem(key, JSON.stringify(positions));
            } catch (e) { /* ignore */ }
        }, 500);
    }

    function clearSavedPositions(layerId) {
        try {
            var key = 'crucix-network-positions-' + (layerId || 'default');
            localStorage.removeItem(key);
        } catch (e) { /* ignore */ }
    }

    // ------------------------------------------------------------
    // Симуляция (force-directed)
    // ------------------------------------------------------------
    function _simulate() {
        if (running) return;
        running = true;
        var iter = 0;
        var maxIter = 300;

        function step() {
            if (iter >= maxIter || nodes.length === 0) {
                running = false;
                return;
            }
            iter++;

            // Coulomb repulsion
            for (var i = 0; i < nodes.length; i++) {
                for (var j = i + 1; j < nodes.length; j++) {
                    var dx = nodes[i].x - nodes[j].x;
                    var dy = nodes[i].y - nodes[j].y;
                    var dist2 = dx * dx + dy * dy;
                    if (dist2 < 1) dist2 = 1;
                    var dist = Math.sqrt(dist2);
                    var force = config.charge / dist2;
                    var fx = (dx / dist) * force * 0.01;
                    var fy = (dy / dist) * force * 0.01;
                    nodes[i].vx += fx;
                    nodes[i].vy += fy;
                    nodes[j].vx -= fx;
                    nodes[j].vy -= fy;
                }
            }

            // Hooke attraction
            for (var ei = 0; ei < edges.length; ei++) {
                var e = edges[ei];
                var s = nodeMap[e.source];
                var t = nodeMap[e.target];
                if (!s || !t) continue;
                var edx = t.x - s.x;
                var edy = t.y - s.y;
                var edist = Math.sqrt(edx * edx + edy * edy) || 1;
                var diff = edist - config.distance;
                var efx = (edx / edist) * diff * 0.01 * e.weight;
                var efy = (edy / edist) * diff * 0.01 * e.weight;
                s.vx += efx;
                s.vy += efy;
                t.vx -= efx;
                t.vy -= efy;
            }

            // Gravity to center
            for (var ni = 0; ni < nodes.length; ni++) {
                var nn = nodes[ni];
                nn.vx += (width / 2 - nn.x) * config.gravity * 0.01;
                nn.vy += (height / 2 - nn.y) * config.gravity * 0.01;
            }

            // Verlet integration
            for (var mi = 0; mi < nodes.length; mi++) {
                var n = nodes[mi];
                n.vx *= config.velocityDecay;
                n.vy *= config.velocityDecay;
                n.x += n.vx;
                n.y += n.vy;
            }

            render();
            animFrame = requestAnimationFrame(step);
        }
        step();
    }

    // ------------------------------------------------------------
    // Отрисовка SVG
    // ------------------------------------------------------------
    function render() {
        if (!svg) return;
        var t = 'translate(' + transform.x + ',' + transform.y + ') scale(' + transform.k + ')';

        var html = '';

        // Маркеры стрелок для направленных рёбер
        html += '<defs>';
        var edgeTypes = (window.NetworkMapConfig || {}).edgeTypes || {};
        for (var etk in edgeTypes) {
            var etc = edgeTypes[etk];
            var ecolor = etc.color || '#30363d';
            html += '<marker id="arrow-' + etk + '" viewBox="0 0 10 10" refX="10" refY="5" ';
            html += 'markerWidth="6" markerHeight="6" orient="auto-start-reverse">';
            html += '<path d="M 0 0 L 10 5 L 0 10 z" fill="' + ecolor + '" />';
            html += '</marker>';
        }
        html += '<marker id="arrow-default" viewBox="0 0 10 10" refX="10" refY="5" ';
        html += 'markerWidth="6" markerHeight="6" orient="auto-start-reverse">';
        html += '<path d="M 0 0 L 10 5 L 0 10 z" fill="#30363d" />';
        html += '</marker>';
        html += '</defs>';

        html += '<g transform="' + t + '">';

        // Рёбра
        for (var ei = 0; ei < edges.length; ei++) {
            var e = edges[ei];
            var s = nodeMap[e.source];
            var t2 = nodeMap[e.target];
            if (!s || !t2) continue;
            var strokeW = Math.max(1, Math.min(e.weight * 0.8, 6));
            var etype = e.type || 'flow';
            var edgeCfg = (window.NetworkMapConfig || {}).edgeTypes || {};
            var ecfg = edgeCfg[etype] || {};
            var ecolor = ecfg.color || '#30363d';
            var dashed = ecfg.dashed ? ' stroke-dasharray="4,3"' : '';
            var markerUrl = 'url(#arrow-' + (edgeCfg[etype] ? etype : 'default') + ')';

            // Укорачиваем линию, чтобы стрелка не уходила под узел
            var dx = t2.x - s.x;
            var dy = t2.y - s.y;
            var len = Math.sqrt(dx * dx + dy * dy) || 1;
            var shrink = 14;
            var sx = s.x + (dx / len) * shrink;
            var sy = s.y + (dy / len) * shrink;
            var tx = t2.x - (dx / len) * shrink;
            var ty = t2.y - (dy / len) * shrink;

            html += '<line class="edge edge-' + etype + '" ';
            html += 'x1="' + sx.toFixed(1) + '" y1="' + sy.toFixed(1) + '" ';
            html += 'x2="' + tx.toFixed(1) + '" y2="' + ty.toFixed(1) + '" ';
            html += 'stroke="' + ecolor + '" ';
            html += 'stroke-width="' + strokeW + '"' + dashed + ' ';
            html += 'marker-end="' + markerUrl + '" />';
        }

        // Узлы
        var typeConfig = (window.NetworkMapConfig || {}).nodeTypes || {};
        for (var ni = 0; ni < nodes.length; ni++) {
            var n = nodes[ni];
            var tc = typeConfig[n.type] || typeConfig.country || { color: '#58a6ff' };
            var r = 8 + Math.min(n.weight * 2, 15);
            var color = tc.color || '#58a6ff';

            if (tc.shape === 'square') {
                var sz = r * 1.6;
                html += '<rect class="node" x="' + (n.x - sz / 2).toFixed(1) + '" y="' + (n.y - sz / 2).toFixed(1) +
                        '" width="' + sz.toFixed(1) + '" height="' + sz.toFixed(1) +
                        '" fill="' + color + '" rx="2" data-id="' + n.id + '" />';
            } else if (tc.shape === 'triangle') {
                var ts = r * 1.5;
                html += '<polygon class="node" points="' +
                        n.x.toFixed(1) + ',' + (n.y - ts).toFixed(1) + ' ' +
                        (n.x - ts).toFixed(1) + ',' + (n.y + ts).toFixed(1) + ' ' +
                        (n.x + ts).toFixed(1) + ',' + (n.y + ts).toFixed(1) +
                        '" fill="' + color + '" data-id="' + n.id + '" />';
            } else if (tc.shape === 'diamond') {
                var ds = r * 1.4;
                html += '<polygon class="node" points="' +
                        n.x.toFixed(1) + ',' + (n.y - ds).toFixed(1) + ' ' +
                        (n.x + ds).toFixed(1) + ',' + n.y.toFixed(1) + ' ' +
                        n.x.toFixed(1) + ',' + (n.y + ds).toFixed(1) + ' ' +
                        (n.x - ds).toFixed(1) + ',' + n.y.toFixed(1) +
                        '" fill="' + color + '" data-id="' + n.id + '" />';
            } else {
                html += '<circle class="node" cx="' + n.x.toFixed(1) + '" cy="' + n.y.toFixed(1) +
                        '" r="' + r.toFixed(1) + '" fill="' + color + '" data-id="' + n.id + '" />';
            }

            html += '<text class="node-label" x="' + n.x.toFixed(1) + '" y="' + (n.y + r + 12).toFixed(1) +
                    '" text-anchor="middle">' + _escape(n.label) + '</text>';
        }

        html += '</g>';
        svg.innerHTML = html;
        _attachNodeEvents();
    }

    function _escape(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // ------------------------------------------------------------
    // События на узлах (hover-tooltip)
    // ------------------------------------------------------------
    function _attachNodeEvents() {
        var tooltip = document.getElementById('node-tooltip');
        if (!tooltip) return;

        svg.querySelectorAll('.node').forEach(function(el) {
            el.addEventListener('mouseenter', function() {
                var id = el.getAttribute('data-id');
                var n = nodeMap[id];
                if (!n) return;
                var connections = 0;
                for (var ei = 0; ei < edges.length; ei++) {
                    if (edges[ei].source === id || edges[ei].target === id) connections++;
                }
                tooltip.innerHTML =
                    '<div class="tt-title">' + _escape(n.label) + '</div>' +
                    '<div class="tt-meta">' +
                        'Тип: <strong>' + n.type + '</strong><br>' +
                        'Связей: <strong>' + connections + '</strong><br>' +
                        'Вес: <strong>' + n.weight + '</strong>' +
                    '</div>';
                tooltip.style.display = 'block';
            });
            el.addEventListener('mousemove', function(ev) {
                tooltip.style.left = (ev.clientX + 12) + 'px';
                tooltip.style.top = (ev.clientY + 12) + 'px';
            });
            el.addEventListener('mouseleave', function() {
                tooltip.style.display = 'none';
            });
        });
    }

    // ------------------------------------------------------------
    // Зум и пан
    // ------------------------------------------------------------
    function _setupZoom() {
        var container = svg.parentElement;
        if (!container) return;

        container.addEventListener('wheel', function(ev) {
            ev.preventDefault();
            var delta = ev.deltaY > 0 ? 0.9 : 1.1;
            transform.k = Math.max(0.2, Math.min(5, transform.k * delta));
            render();
        }, { passive: false });

        var isDragging = false, startX, startY;
        container.addEventListener('mousedown', function(ev) {
            if (ev.target.classList && ev.target.classList.contains('node')) return;
            isDragging = true;
            startX = ev.clientX - transform.x;
            startY = ev.clientY - transform.y;
        });
        container.addEventListener('mousemove', function(ev) {
            if (!isDragging) return;
            transform.x = ev.clientX - startX;
            transform.y = ev.clientY - startY;
            render();
        });
        container.addEventListener('mouseup', function() { isDragging = false; });
        container.addEventListener('mouseleave', function() { isDragging = false; });
    }

    // ------------------------------------------------------------
    // Публичные методы
    // ------------------------------------------------------------
    function reset() {
        transform = { x: 0, y: 0, k: 1 };
        var cx = width / 2;
        var cy = height / 2;
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].x = cx + (Math.random() - 0.5) * 200;
            nodes[i].y = cy + (Math.random() - 0.5) * 200;
            nodes[i].vx = 0;
            nodes[i].vy = 0;
        }
        _simulate();
        render();
        bindNodeClicks();
    }

    function zoom(factor) {
        transform.k = Math.max(0.2, Math.min(5, transform.k * factor));
        render();
    }

    function setConfig(key, val) {
        config[key] = val;
    }


    // ------------------------------------------------------------
    // Поиск узла по подстроке
    // ------------------------------------------------------------
    function searchNode(query) {
        if (!svg) return 0;
        var q = String(query || '').toLowerCase().trim();

        if (!q) {
            // Сброс подсветки
            svg.querySelectorAll('.node').forEach(function(el) {
                el.classList.remove('dimmed', 'highlighted');
            });
            svg.querySelectorAll('.node-label').forEach(function(el) {
                el.classList.remove('hidden');
            });
            return 0;
        }

        var matched = [];
        svg.querySelectorAll('.node').forEach(function(el) {
            var id = el.getAttribute('data-id');
            var n = nodeMap[id];
            if (!n) return;
            var hay = (n.id + ' ' + n.label + ' ' + n.type).toLowerCase();
            if (hay.indexOf(q) !== -1) {
                el.classList.remove('dimmed');
                el.classList.add('highlighted');
                matched.push(n);
            } else {
                el.classList.remove('highlighted');
                el.classList.add('dimmed');
            }
        });

        return matched.length;
    }

    // ------------------------------------------------------------
    // Подсветка пути A → B (BFS)
    // ------------------------------------------------------------
    function highlightPath(fromId, toId) {
        if (!window.Relations || !window.Relations.findPath) return null;
        var graph = { nodes: nodes, edges: edges };
        var path = window.Relations.findPath(graph, fromId, toId);
        if (!path || path.length < 2) return null;

        var pathSet = {};
        for (var i = 0; i < path.length; i++) pathSet[path[i]] = true;

        svg.querySelectorAll('.node').forEach(function(el) {
            var id = el.getAttribute('data-id');
            if (pathSet[id]) {
                el.classList.remove('dimmed');
                el.classList.add('highlighted');
            } else {
                el.classList.remove('highlighted');
                el.classList.add('dimmed');
            }
        });

        svg.querySelectorAll('.edge').forEach(function(el) {
            el.classList.remove('highlighted');
            el.classList.add('dimmed');
        });

        // Подсветка рёбер пути
        for (var j = 0; j < path.length - 1; j++) {
            var a = path[j], b = path[j + 1];
            svg.querySelectorAll('.edge').forEach(function(el) {
                var x1 = parseFloat(el.getAttribute('x1'));
                var y1 = parseFloat(el.getAttribute('y1'));
                var x2 = parseFloat(el.getAttribute('x2'));
                var y2 = parseFloat(el.getAttribute('y2'));
                var na = nodeMap[a], nb = nodeMap[b];
                if (!na || !nb) return;
                var dx1 = Math.abs(x1 - na.x) + Math.abs(y1 - na.y);
                var dx2 = Math.abs(x2 - nb.x) + Math.abs(y2 - nb.y);
                var dx3 = Math.abs(x1 - nb.x) + Math.abs(y1 - nb.y);
                var dx4 = Math.abs(x2 - na.x) + Math.abs(y2 - na.y);
                if ((dx1 < 20 && dx2 < 20) || (dx3 < 20 && dx4 < 20)) {
                    el.classList.remove('dimmed');
                    el.classList.add('highlighted');
                }
            });
        }

        return path;
    }

    function clearHighlight() {
        if (!svg) return;
        svg.querySelectorAll('.node').forEach(function(el) {
            el.classList.remove('dimmed', 'highlighted');
        });
        svg.querySelectorAll('.edge').forEach(function(el) {
            el.classList.remove('dimmed', 'highlighted');
        });
    }

    function getNodeById(id) { return nodeMap[id] || null; }


    // ------------------------------------------------------------
    // Экспорт SVG
    // ------------------------------------------------------------
    function exportSVG() {
        if (!svg) return null;
        var clone = svg.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        // Убираем пустые группы и dimmed
        clone.querySelectorAll('.node.dimmed').forEach(function(el) { el.classList.remove('dimmed'); });
        clone.querySelectorAll('.edge.dimmed').forEach(function(el) { el.classList.remove('dimmed'); });
        var xml = new XMLSerializer().serializeToString(clone);
        var blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'network-' + (window.NetworkMap && window.NetworkMap.currentLayer || 'graph') + '-' + Date.now() + '.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
        return xml.length;
    }

    // ------------------------------------------------------------
    // Экспорт PNG
    // ------------------------------------------------------------
    function exportPNG() {
        if (!svg) return null;
        var clone = svg.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        var w = width, h = height;
        clone.setAttribute('width', w);
        clone.setAttribute('height', h);

        // Инлайн-стили для узлов и рёбер
        clone.querySelectorAll('.node').forEach(function(el) {
            el.setAttribute('style', '');
        });

        var xml = new XMLSerializer().serializeToString(clone);
        var svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
        var url = URL.createObjectURL(svgBlob);

        var img = new Image();
        img.onload = function() {
            var canvas = document.createElement('canvas');
            canvas.width = w * 2;
            canvas.height = h * 2;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#0a0a0f';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);

            canvas.toBlob(function(blob) {
                var pngUrl = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = pngUrl;
                a.download = 'network-' + (window.NetworkMap && window.NetworkMap.currentLayer || 'graph') + '-' + Date.now() + '.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(function() { URL.revokeObjectURL(pngUrl); }, 1000);
                if (window.showNotification) window.showNotification('✅ PNG экспортирован');
            }, 'image/png');
        };
        img.onerror = function() {
            URL.revokeObjectURL(url);
            if (window.showNotification) window.showNotification('❌ Ошибка экспорта PNG');
        };
        img.src = url;
        return true;
    }


    // ------------------------------------------------------------
    // Применение цветов сообществ (Louvain)
    // ------------------------------------------------------------
    function applyCommunityColors(communities) {
        if (!svg || !communities) return;

        svg.querySelectorAll('.node').forEach(function(el) {
            var id = el.getAttribute('data-id');
            var c = communities[id];
            if (c === undefined) return;
            var color = LOUVAIN_PALETTE[c % LOUVAIN_PALETTE.length];

            // Меняем fill у фигуры внутри группы
            var shape = el.querySelector('circle, rect, polygon, ellipse');
            if (shape) {
                shape.setAttribute('data-original-fill',
                    shape.getAttribute('fill') || '');
                shape.setAttribute('fill', color);
            }
        });

        // Также обновляем метки
        svg.querySelectorAll('.node-label').forEach(function(el) {
            el.setAttribute('data-community-color', 'true');
        });

        cachedCommunities = communities;
        showCommunities = true;
    }

    // ------------------------------------------------------------
    // Возврат к цветам по типу узла
    // ------------------------------------------------------------
    function clearCommunityColors() {
        if (!svg) return;

        svg.querySelectorAll('.node').forEach(function(el) {
            var shape = el.querySelector('circle, rect, polygon, ellipse');
            if (!shape) return;
            var original = shape.getAttribute('data-original-fill');
            if (original) {
                shape.setAttribute('fill', original);
                shape.removeAttribute('data-original-fill');
            }
        });

        showCommunities = false;
    }

    // ------------------------------------------------------------
    // Переключение визуализации сообществ
    // ------------------------------------------------------------
    function toggleCommunities(forceState) {
        var targetState = (forceState === undefined) ? !showCommunities : forceState;

        if (targetState) {
            // Пересчитать сообщества
            var graph = { nodes: nodes, edges: edges };
            if (window.Relations && window.Relations.louvain) {
                var result = window.Relations.louvain(graph);
                applyCommunityColors(result.communities);
                return result;
            }
            return null;
        } else {
            clearCommunityColors();
            return null;
        }
    }

    function getCommunities() { return cachedCommunities; }
    function isShowingCommunities() { return showCommunities; }


    // ------------------------------------------------------------
    // Получить номер сообщества узла
    // ------------------------------------------------------------
    function getNodeCommunity(nodeId) {
        if (!cachedCommunities) return -1;
        var c = cachedCommunities[nodeId];
        return (c === undefined) ? -1 : c;
    }


    // ------------------------------------------------------------
    // ВИЗУАЛИЗАЦИЯ МЕТРИК — размер узла по выбранной метрике
    // ------------------------------------------------------------
    var currentMetric = null;  // null | 'degree' | 'betweenness' | 'closeness' | 'pagerank' | 'eigenvector'

    function applyMetricSize(metricName) {
        if (!svg || !window.Relations || !window.Relations.allMetrics) return null;

        var graph = { nodes: nodes, edges: edges };
        var metrics = window.Relations.allMetrics(graph);

        // Собираем значения метрики
        var values = {};
        var maxV = 0;
        var minV = 1;
        for (var i = 0; i < metrics.length; i++) {
            var m = metrics[i];
            var v = m[metricName] || 0;
            values[m.id] = v;
            if (v > maxV) maxV = v;
            if (v < minV) minV = v;
        }

        // Базовые размеры (диаметр узла для каждого типа)
        var baseSizes = {
            country: 18,
            organization: 14,
            event: 26,
            financial: 16
        };

        // Масштабирование: размер = base + 12 * (v / maxV)
        var minSize = 8;
        var maxSize = 32;

        svg.querySelectorAll('.node').forEach(function(el) {
            var id = el.getAttribute('data-id');
            var v = values[id];
            if (v === undefined) return;

            var size = minSize + (maxSize - minSize) * (maxV > 0 ? (v / maxV) : 0);
            var radius = size / 2;

            // Ищем фигуру внутри группы
            var shape = el.querySelector('circle, rect, polygon, ellipse');
            if (!shape) return;

            var tag = shape.tagName.toLowerCase();
            if (tag === 'circle') {
                shape.setAttribute('r', radius.toFixed(2));
            } else if (tag === 'rect') {
                shape.setAttribute('width', size.toFixed(2));
                shape.setAttribute('height', size.toFixed(2));
                shape.setAttribute('x', (parseFloat(shape.getAttribute('x') || 0) - radius * 0.3).toFixed(2));
                shape.setAttribute('y', (parseFloat(shape.getAttribute('y') || 0) - radius * 0.3).toFixed(2));
            } else if (tag === 'polygon') {
                // Для треугольника пересчитываем вершины
                var pts = shape.getAttribute('points') || '';
                var arr = pts.split(' ');
                var cx = 0, cy = 0;
                for (var p = 0; p < arr.length; p++) {
                    var xy = arr[p].split(',');
                    cx += parseFloat(xy[0]);
                    cy += parseFloat(xy[1]);
                }
                cx /= arr.length;
                cy /= arr.length;
                // Создаём новый треугольник
                var newPts = [];
                for (var k = 0; k < 3; k++) {
                    var angle = -Math.PI / 2 + k * (2 * Math.PI / 3);
                    var x = cx + radius * Math.cos(angle);
                    var y = cy + radius * Math.sin(angle);
                    newPts.push(x.toFixed(2) + ',' + y.toFixed(2));
                }
                shape.setAttribute('points', newPts.join(' '));
            } else if (tag === 'ellipse') {
                shape.setAttribute('rx', radius.toFixed(2));
                shape.setAttribute('ry', radius.toFixed(2));
            }
        });

        currentMetric = metricName;
        return { metric: metricName, minV: minV, maxV: maxV, nodes: metrics.length };
    }

    function clearMetricSize() {
        if (!svg) return;
        // Восстанавливаем размеры по типам
        var baseSizes = {
            country: 18,
            organization: 14,
            event: 26,
            financial: 16
        };

        svg.querySelectorAll('.node').forEach(function(el) {
            var type = el.getAttribute('data-type') || 'country';
            var size = baseSizes[type] || 18;
            var radius = size / 2;
            var shape = el.querySelector('circle, rect, polygon, ellipse');
            if (!shape) return;

            var tag = shape.tagName.toLowerCase();
            if (tag === 'circle') {
                shape.setAttribute('r', radius.toFixed(2));
            } else if (tag === 'rect') {
                shape.setAttribute('width', size.toFixed(2));
                shape.setAttribute('height', size.toFixed(2));
            }
            // Треугольники и эллипсы можно оставить как есть или тоже сбросить
        });
        currentMetric = null;
    }

    function getCurrentMetric() { return currentMetric; }

    function getMetricValue(nodeId, metricName) {
        if (!window.Relations || !window.Relations.allMetrics) return 0;
        var metrics = window.Relations.allMetrics({ nodes: nodes, edges: edges });
        for (var i = 0; i < metrics.length; i++) {
            if (metrics[i].id === nodeId) return metrics[i][metricName] || 0;
        }
        return 0;
    }

    function cycleMetric() {
        var order = ['degree', 'betweenness', 'closeness', 'pagerank', 'eigenvector'];
        var idx = order.indexOf(currentMetric);
        if (idx === -1 || idx === order.length - 1) {
            if (currentMetric !== null) {
                clearMetricSize();
                return null;
            }
            return applyMetricSize(order[0]);
        }
        return applyMetricSize(order[idx + 1]);
    }


    // ------------------------------------------------------------
    // ПОПАП УЗЛА — карточка с 7 метриками
    // ------------------------------------------------------------
    function showNodePopup(nodeId) {
        if (!window.Relations || !window.Relations.allMetrics) return;

        var graph = { nodes: nodes, edges: edges };
        var metrics = window.Relations.allMetrics(graph);
        var lv = window.Relations.louvain ? window.Relations.louvain(graph) : null;

        var m = null;
        for (var i = 0; i < metrics.length; i++) {
            if (metrics[i].id === nodeId) { m = metrics[i]; break; }
        }
        if (!m) return;

        // Соседи
        var incoming = [];
        var outgoing = [];
        for (var j = 0; j < edges.length; j++) {
            if (edges[j].target === nodeId) incoming.push(edges[j].source);
            if (edges[j].source === nodeId) outgoing.push(edges[j].target);
        }

        // Community
        var community = -1;
        if (lv && lv.communities && lv.communities[nodeId] !== undefined) {
            community = lv.communities[nodeId];
        }

        // Создаём/обновляем DOM-элемент
        var popup = document.getElementById('node-popup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'node-popup';
            popup.className = 'node-popup';
            document.body.appendChild(popup);
        }

        var typeNames = {
            country: 'Страна',
            organization: 'Организация',
            event: 'Событие',
            financial: 'Финансы'
        };

        var palette = LOUVAIN_PALETTE || ['#58a6ff', '#3fb950', '#f0883e'];
        var commColor = community >= 0 ? palette[community % palette.length] : '#8b949e';

        var lines = [];
        lines.push('<div class="node-popup-header">');
        lines.push('  <span class="node-popup-title">' + escapeHtml(m.label || nodeId) + '</span>');
        lines.push('  <button class="node-popup-close" id="node-popup-close">✕</button>');
        lines.push('</div>');
        lines.push('<div class="node-popup-id">' + escapeHtml(nodeId) + '</div>');
        lines.push('<div class="node-popup-meta">');
        lines.push('  <span>Тип: ' + (typeNames[m.type] || m.type) + '</span>');
        if (community >= 0) {
            lines.push('  <span><span class="comm-dot" style="background:' + commColor + '"></span>Сообщество ' + community + '</span>');
        }
        lines.push('</div>');
        lines.push('<table class="node-popup-metrics">');
        lines.push('  <tr><td>Degree</td><td>' + m.degree.toFixed(4) + '</td></tr>');
        lines.push('  <tr><td>Betweenness</td><td>' + m.betweenness.toFixed(4) + '</td></tr>');
        lines.push('  <tr><td>Closeness</td><td>' + m.closeness.toFixed(4) + '</td></tr>');
        lines.push('  <tr><td>PageRank</td><td>' + m.pagerank.toFixed(4) + '</td></tr>');
        lines.push('  <tr><td>Eigenvector</td><td>' + m.eigenvector.toFixed(4) + '</td></tr>');
        lines.push('</table>');
        if (incoming.length > 0 || outgoing.length > 0) {
            lines.push('<div class="node-popup-neighbors">');
            lines.push('  <div>Входящие (' + incoming.length + '): ' + (incoming.length ? escapeHtml(incoming.join(', ')) : '—') + '</div>');
            lines.push('  <div>Исходящие (' + outgoing.length + '): ' + (outgoing.length ? escapeHtml(outgoing.join(', ')) : '—') + '</div>');
            lines.push('</div>');
        }
        lines.push('<div class="node-popup-footer">');
        lines.push('  <button class="btn btn-sm" id="node-popup-copy">📋 Копировать</button>');
        lines.push('</div>');

        popup.innerHTML = lines.join('');
        popup.style.display = 'block';

        // Привязка кнопок
        document.getElementById('node-popup-close').onclick = function() {
            popup.style.display = 'none';
        };
        document.getElementById('node-popup-copy').onclick = function() {
            var text = [
                '=== УЗЕЛ: ' + (m.label || nodeId) + ' ===',
                'ID: ' + nodeId,
                'Тип: ' + (typeNames[m.type] || m.type),
                'Сообщество: ' + (community >= 0 ? community : '—'),
                '',
                'Метрики:',
                '  Degree:      ' + m.degree.toFixed(4),
                '  Betweenness: ' + m.betweenness.toFixed(4),
                '  Closeness:   ' + m.closeness.toFixed(4),
                '  PageRank:    ' + m.pagerank.toFixed(4),
                '  Eigenvector: ' + m.eigenvector.toFixed(4),
                '',
                'Входящие: ' + (incoming.length ? incoming.join(', ') : '—'),
                'Исходящие: ' + (outgoing.length ? outgoing.join(', ') : '—')
            ].join('\n');
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text);
            } else {
                var ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            if (window.showNotification) window.showNotification('📋 Метрики узла скопированы');
        };
    }

    function hideNodePopup() {
        var popup = document.getElementById('node-popup');
        if (popup) popup.style.display = 'none';
    }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Привязка клика на узлы — вызывается из render()
    function bindNodeClicks() {
        if (!svg) return;
        svg.querySelectorAll('.node').forEach(function(el) {
            if (el._popupBound) return;
            el._popupBound = true;
            el.style.cursor = 'pointer';
            el.addEventListener('click', function(ev) {
                ev.stopPropagation();
                var id = el.getAttribute('data-id');
                if (id) showNodePopup(id);
            });
        });

        // Клик на пустом месте — закрыть
        if (!svg._popupBgBound) {
            svg._popupBgBound = true;
            svg.addEventListener('click', function() {
                hideNodePopup();
            });
        }
    }


    // ------------------------------------------------------------
    // HEATMAP ПО МЕТРИКЕ
    // ------------------------------------------------------------
    var heatmapActive = false;
    var HEATMAP_COLORS = ['#1f77b4', '#4ec4ff', '#7ee787', '#f0c33c', '#f85149'];

    var METRIC_RU_NAMES = {
        degree: 'Degree',
        betweenness: 'Betweenness',
        closeness: 'Closeness',
        pagerank: 'PageRank',
        eigenvector: 'Eigenvector'
    };

    function applyHeatmap(metricName) {
        if (!svg || !window.Relations || !window.Relations.allMetrics) return null;
        if (!metricName) metricName = 'pagerank';

        var graph = { nodes: nodes, edges: edges };
        var metrics = window.Relations.allMetrics(graph);

        // Собираем значения метрики
        var values = {};
        var minV = Infinity;
        var maxV = -Infinity;
        for (var i = 0; i < metrics.length; i++) {
            var m = metrics[i];
            var v = m[metricName] || 0;
            values[m.id] = v;
            if (v < minV) minV = v;
            if (v > maxV) maxV = v;
        }
        if (maxV === minV) maxV = minV + 0.001;

        // Функция: значение → цвет из палитры 5 классов
        function heatColor(v) {
            var ratio = (v - minV) / (maxV - minV);
            var idx = Math.min(4, Math.floor(ratio * 5));
            return HEATMAP_COLORS[idx];
        }

        // Применяем к узлам
        svg.querySelectorAll('.node').forEach(function(el) {
            var id = el.getAttribute('data-id');
            if (values[id] === undefined) return;
            var shape = el.querySelector('circle, rect, polygon, ellipse');
            if (!shape) return;
            if (!shape.getAttribute('data-original-fill')) {
                shape.setAttribute('data-original-fill',
                    shape.getAttribute('fill') || '');
            }
            shape.setAttribute('fill', heatColor(values[id]));
        });

        heatmapActive = true;
        return {
            metric: metricName,
            metricName: METRIC_RU_NAMES[metricName] || metricName,
            min: minV,
            max: maxV,
            colors: HEATMAP_COLORS,
            nodes: metrics.length
        };
    }

    function clearHeatmap() {
        if (!svg) return;
        svg.querySelectorAll('.node').forEach(function(el) {
            var shape = el.querySelector('circle, rect, polygon, ellipse');
            if (!shape) return;
            var original = shape.getAttribute('data-original-fill');
            if (original) {
                shape.setAttribute('fill', original);
                shape.removeAttribute('data-original-fill');
            }
        });
        heatmapActive = false;
    }

    function toggleHeatmap(metricName) {
        if (heatmapActive) {
            clearHeatmap();
            return null;
        }
        return applyHeatmap(metricName);
    }

    function isShowingHeatmap() { return heatmapActive; }

    return {
        init: init,
        setData: setData,
        render: render,
        reset: reset,
        zoom: zoom,
        setConfig: setConfig,
        getNodes: function() { return nodes; },
        getEdges: function() { return edges; },
        searchNode: searchNode,
        highlightPath: highlightPath,
        clearHighlight: clearHighlight,
        getNodeById: getNodeById,
        clearSavedPositions: clearSavedPositions,
        exportSVG: exportSVG,
        exportPNG: exportPNG,
        toggleCommunities: toggleCommunities,
        applyCommunityColors: applyCommunityColors,
        clearCommunityColors: clearCommunityColors,
        getCommunities: getCommunities,
        isShowingCommunities: isShowingCommunities,
        getNodeCommunity: getNodeCommunity,
        applyMetricSize: applyMetricSize,
        clearMetricSize: clearMetricSize,
        getCurrentMetric: getCurrentMetric,
        getMetricValue: getMetricValue,
        cycleMetric: cycleMetric,
        showNodePopup: showNodePopup,
        hideNodePopup: hideNodePopup,
        bindNodeClicks: bindNodeClicks,
        toggleHeatmap: toggleHeatmap,
        applyHeatmap: applyHeatmap,
        clearHeatmap: clearHeatmap,
        isShowingHeatmap: isShowingHeatmap,
        HEATMAP_COLORS: HEATMAP_COLORS,
        LOUVAIN_PALETTE: LOUVAIN_PALETTE
    };
})();

console.log('✅ GRAPH-VIEW.JS готов');
