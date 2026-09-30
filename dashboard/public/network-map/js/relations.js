// relations.js — Управление связями между узлами (Network Map v2.1)
// Алгоритмы: degree, betweenness, closeness, louvain, pagerank, eigenvector
console.log('🔗 RELATIONS.JS загружен');

window.Relations = {
    // Поиск кратчайшего пути (BFS)
    findPath: function(graph, startId, endId) {
        if (!graph || !graph.nodes || !graph.edges) return null;
        var adj = {};
        graph.edges.forEach(function(e) {
            if (!adj[e.source]) adj[e.source] = [];
            if (!adj[e.target]) adj[e.target] = [];
            adj[e.source].push(e.target);
            adj[e.target].push(e.source);
        });
        var queue = [[startId]];
        var visited = {};
        visited[startId] = true;
        while (queue.length > 0) {
            var path = queue.shift();
            var node = path[path.length - 1];
            if (node === endId) return path;
            var neighbors = adj[node] || [];
            for (var i = 0; i < neighbors.length; i++) {
                if (!visited[neighbors[i]]) {
                    visited[neighbors[i]] = true;
                    queue.push(path.concat([neighbors[i]]));
                }
            }
        }
        return null;
    },

    // Поиск соседей N-го порядка
    getNeighbors: function(graph, nodeId, depth) {
        depth = depth || 1;
        var adj = {};
        graph.edges.forEach(function(e) {
            if (!adj[e.source]) adj[e.source] = [];
            if (!adj[e.target]) adj[e.target] = [];
            adj[e.source].push(e.target);
            adj[e.target].push(e.source);
        });
        var result = {};
        var current = [nodeId];
        for (var d = 0; d < depth; d++) {
            var next = [];
            current.forEach(function(n) {
                (adj[n] || []).forEach(function(nb) {
                    if (!result[nb] && nb !== nodeId) {
                        result[nb] = d + 1;
                        next.push(nb);
                    }
                });
            });
            current = next;
        }
        return result;
    },

    // Degree centrality
    degreeCentrality: function(graph) {
        var degree = {};
        graph.nodes.forEach(function(n) { degree[n.id] = 0; });
        graph.edges.forEach(function(e) {
            if (degree[e.source] !== undefined) degree[e.source]++;
            if (degree[e.target] !== undefined) degree[e.target]++;
        });
        var max = Math.max.apply(null, Object.values(degree)) || 1;
        var result = {};
        for (var id in degree) {
            result[id] = degree[id] / max;
        }
        return result;
    },

    // Выделение компонент связности
    findComponents: function(graph) {
        var adj = {};
        graph.edges.forEach(function(e) {
            if (!adj[e.source]) adj[e.source] = [];
            if (!adj[e.target]) adj[e.target] = [];
            adj[e.source].push(e.target);
            adj[e.target].push(e.source);
        });
        var visited = {};
        var components = [];
        graph.nodes.forEach(function(n) {
            if (visited[n.id]) return;
            var comp = [];
            var stack = [n.id];
            while (stack.length > 0) {
                var node = stack.pop();
                if (visited[node]) continue;
                visited[node] = true;
                comp.push(node);
                (adj[node] || []).forEach(function(nb) {
                    if (!visited[nb]) stack.push(nb);
                });
            }
            components.push(comp);
        });
        return components;
    },

    // Построение списка смежности
    _adjacency: function(graph) {
        var adj = {};
        var i;
        for (i = 0; i < graph.nodes.length; i++) adj[graph.nodes[i].id] = [];
        for (i = 0; i < graph.edges.length; i++) {
            var e = graph.edges[i];
            if (!adj[e.source]) adj[e.source] = [];
            if (!adj[e.target]) adj[e.target] = [];
            adj[e.source].push(e.target);
            adj[e.target].push(e.source);
        }
        return adj;
    },

    // Betweenness centrality (Brandes 2001)
    betweennessCentrality: function(graph) {
        var adj = this._adjacency(graph);
        var ids = Object.keys(adj);
        var cb = {};
        var i, k;
        for (i = 0; i < ids.length; i++) cb[ids[i]] = 0;

        for (i = 0; i < ids.length; i++) {
            var s = ids[i];
            var S = [];
            var P = {};
            var sigma = {};
            var d = {};
            for (k = 0; k < ids.length; k++) {
                P[ids[k]] = [];
                sigma[ids[k]] = 0;
                d[ids[k]] = -1;
            }
            sigma[s] = 1;
            d[s] = 0;
            var Q = [s];
            while (Q.length > 0) {
                var v = Q.shift();
                S.push(v);
                var neigh = adj[v] || [];
                for (k = 0; k < neigh.length; k++) {
                    var w = neigh[k];
                    if (d[w] < 0) {
                        d[w] = d[v] + 1;
                        Q.push(w);
                    }
                    if (d[w] === d[v] + 1) {
                        sigma[w] += sigma[v];
                        P[w].push(v);
                    }
                }
            }
            var delta = {};
            for (k = 0; k < ids.length; k++) delta[ids[k]] = 0;
            while (S.length > 0) {
                var w2 = S.pop();
                var preds = P[w2] || [];
                for (k = 0; k < preds.length; k++) {
                    var v2 = preds[k];
                    if (sigma[w2] > 0) {
                        delta[v2] += (sigma[v2] / sigma[w2]) * (1 + delta[w2]);
                    }
                }
                if (w2 !== s) cb[w2] += delta[w2];
            }
        }

        var n = ids.length;
        var norm = (n > 2) ? (2 / ((n - 1) * (n - 2))) : 1;
        var max = 0;
        for (i = 0; i < ids.length; i++) {
            cb[ids[i]] *= norm;
            if (cb[ids[i]] > max) max = cb[ids[i]];
        }
        if (max > 0) {
            for (i = 0; i < ids.length; i++) cb[ids[i]] = cb[ids[i]] / max;
        }
        return cb;
    },

    // Closeness centrality (BFS)
    closenessCentrality: function(graph) {
        var adj = this._adjacency(graph);
        var ids = Object.keys(adj);
        var cc = {};
        var i, j, k;

        for (i = 0; i < ids.length; i++) {
            var s = ids[i];
            var dist = {};
            var Q = [s];
            for (j = 0; j < ids.length; j++) dist[ids[j]] = -1;
            dist[s] = 0;
            while (Q.length > 0) {
                var v = Q.shift();
                var neigh = adj[v] || [];
                for (k = 0; k < neigh.length; k++) {
                    var w = neigh[k];
                    if (dist[w] < 0) {
                        dist[w] = dist[v] + 1;
                        Q.push(w);
                    }
                }
            }
            var sum = 0;
            var reachable = 0;
            for (j = 0; j < ids.length; j++) {
                if (ids[j] !== s && dist[ids[j]] > 0) {
                    sum += dist[ids[j]];
                    reachable++;
                }
            }
            cc[s] = (sum > 0) ? (reachable / sum) : 0;
        }

        var max = 0;
        for (i = 0; i < ids.length; i++) if (cc[ids[i]] > max) max = cc[ids[i]];
        if (max > 0) {
            for (i = 0; i < ids.length; i++) cc[ids[i]] = cc[ids[i]] / max;
        }
        return cc;
    },

    // Сводные метрики всех узлов
    allMetrics: function(graph) {
        var deg = this.degreeCentrality(graph);
        var bet = this.betweennessCentrality(graph);
        var clo = this.closenessCentrality(graph);
        var pr = this.pagerank(graph);
        var eig = this.eigenvectorCentrality(graph);
        var result = [];
        for (var i = 0; i < graph.nodes.length; i++) {
            var id = graph.nodes[i].id;
            result.push({
                id: id,
                label: graph.nodes[i].label,
                type: graph.nodes[i].type,
                degree: deg[id] || 0,
                betweenness: bet[id] || 0,
                closeness: clo[id] || 0,
                pagerank: pr[id] || 0,
                eigenvector: eig[id] || 0
            });
        }
        result.sort(function(a, b) { return b.pagerank - a.pagerank; });
        return result;
    },

    // ============================================================
    // LOUVAIN COMMUNITY DETECTION (Blondel et al. 2008)
    // ============================================================
    louvain: function(graph, options) {
        options = options || {};
        var resolution = options.resolution || 1.0;
        var maxPasses = options.maxPasses || 10;

        if (!graph || !graph.nodes || graph.nodes.length === 0) {
            return { communities: {}, modularity: 0, numCommunities: 0 };
        }

        var n = graph.nodes.length;
        var i, k;

        var idx = {};
        for (i = 0; i < n; i++) idx[graph.nodes[i].id] = i;

        var adj = [];
        for (i = 0; i < n; i++) adj.push({});
        var degrees = new Array(n).fill(0);
        var totalWeight = 0;

        for (k = 0; k < graph.edges.length; k++) {
            var e = graph.edges[k];
            var u = idx[e.source];
            var v = idx[e.target];
            if (u === undefined || v === undefined) continue;
            if (u === v) continue;
            var w = e.weight || 1;
            adj[u][v] = (adj[u][v] || 0) + w;
            adj[v][u] = (adj[v][u] || 0) + w;
            degrees[u] += w;
            degrees[v] += w;
            totalWeight += w;
        }

        if (totalWeight === 0) {
            var emptyComm = {};
            for (i = 0; i < n; i++) emptyComm[graph.nodes[i].id] = 0;
            return { communities: emptyComm, modularity: 0, numCommunities: 1 };
        }

        var twoM = 2 * totalWeight;
        var invTwoM = 1 / twoM;

        var community = new Array(n);
        for (i = 0; i < n; i++) community[i] = i;
        var communityTotal = degrees.slice();

        var changed = true;
        var passes = 0;

        while (changed && passes < maxPasses) {
            changed = false;
            passes++;

            for (i = 0; i < n; i++) {
                var ci = community[i];
                var ki = degrees[i];

                var weightToComm = {};
                var neigh = adj[i];
                for (var vk in neigh) {
                    var vIdx = parseInt(vk, 10);
                    var cv = community[vIdx];
                    weightToComm[cv] = (weightToComm[cv] || 0) + neigh[vk];
                }

                communityTotal[ci] -= ki;

                var bestComm = ci;
                var bestGain = 0;
                var baseGain = (weightToComm[ci] || 0) -
                               resolution * communityTotal[ci] * ki * invTwoM;

                for (var ck in weightToComm) {
                    var cIdx = parseInt(ck, 10);
                    if (cIdx === ci) continue;
                    var gain = weightToComm[ck] -
                               resolution * communityTotal[cIdx] * ki * invTwoM;
                    if (gain - baseGain > bestGain) {
                        bestGain = gain - baseGain;
                        bestComm = cIdx;
                    }
                }

                communityTotal[bestComm] += ki;
                community[i] = bestComm;

                if (bestComm !== ci) changed = true;
            }
        }

        var commInternal = {};
        for (i = 0; i < n; i++) {
            var neigh2 = adj[i];
            for (var vk2 in neigh2) {
                var j2 = parseInt(vk2, 10);
                if (i < j2 && community[i] === community[j2]) {
                    var c2 = community[i];
                    commInternal[c2] = (commInternal[c2] || 0) + neigh2[vk2];
                }
            }
        }
        var sumCommTot = {};
        for (i = 0; i < n; i++) {
            var cc2 = community[i];
            sumCommTot[cc2] = (sumCommTot[cc2] || 0) + degrees[i];
        }
        var modularity = 0;
        for (var ck2 in sumCommTot) {
            var internal = commInternal[ck2] || 0;
            var tot = sumCommTot[ck2];
            modularity += (internal / totalWeight) -
                          resolution * Math.pow(tot / twoM, 2);
        }

        var uniqueComms = {};
        for (i = 0; i < n; i++) uniqueComms[community[i]] = true;
        var sortedComms = Object.keys(uniqueComms).map(Number).sort(function(a, b) { return a - b; });
        var remap = {};
        for (i = 0; i < sortedComms.length; i++) remap[sortedComms[i]] = i;

        var result = {};
        for (i = 0; i < n; i++) {
            result[graph.nodes[i].id] = remap[community[i]];
        }

        return {
            communities: result,
            modularity: modularity,
            numCommunities: sortedComms.length,
            passes: passes
        };
    },

    // Группировка узлов по сообществам
    groupByCommunity: function(graph, communitiesMap) {
        var groups = {};
        for (var i = 0; i < graph.nodes.length; i++) {
            var nid = graph.nodes[i].id;
            var c = communitiesMap[nid];
            if (c === undefined) c = -1;
            if (!groups[c]) groups[c] = [];
            groups[c].push({
                id: nid,
                label: graph.nodes[i].label || nid,
                type: graph.nodes[i].type || 'country'
            });
        }
        return groups;
    },

    // ============================================================
    // PAGERANK (Brin & Page 1998)
    // Итеративная формула: PR(v) = (1-d)/N + d * Σ PR(u)/L(u)
    // Сложность: O(E * iterations). Damping d=0.85, до 100 итераций.
    // ============================================================
    pagerank: function(graph, options) {
        options = options || {};
        var d = options.damping || 0.85;
        var maxIter = options.maxIter || 100;
        var tol = options.tolerance || 1e-6;

        if (!graph || !graph.nodes || graph.nodes.length === 0) {
            return {};
        }

        var n = graph.nodes.length;
        var i, k;

        // Индекс
        var idx = {};
        for (i = 0; i < n; i++) idx[graph.nodes[i].id] = i;

        // Исходящие веса (out-links)
        var outWeight = new Array(n).fill(0);
        var outLinks = [];
        for (i = 0; i < n; i++) outLinks.push({});

        var totalWeight = 0;
        for (k = 0; k < graph.edges.length; k++) {
            var e = graph.edges[k];
            var u = idx[e.source];
            var v = idx[e.target];
            if (u === undefined || v === undefined) continue;
            if (u === v) continue;
            var w = e.weight || 1;
            outLinks[u][v] = (outLinks[u][v] || 0) + w;
            outWeight[u] += w;
            totalWeight += w;
        }

        // Инициализация: равномерное распределение
        var invN = 1 / n;
        var pr = new Array(n).fill(invN);
        var prNew = new Array(n).fill(0);

        // Итерации
        var iter = 0;
        var diff = 1;
        while (iter < maxIter && diff > tol) {
            // Телепортация: (1-d)/N для всех
            for (i = 0; i < n; i++) prNew[i] = (1 - d) * invN;

            // Распределение PR по исходящим ссылкам
            for (u = 0; u < n; u++) {
                if (outWeight[u] === 0) {
                    // Dangling node — распределяем равномерно
                    var share = d * pr[u] * invN;
                    for (i = 0; i < n; i++) prNew[i] += share;
                    continue;
                }
                var links = outLinks[u];
                for (var v in links) {
                    var vIdx = parseInt(v, 10);
                    prNew[vIdx] += d * pr[u] * (links[v] / outWeight[u]);
                }
            }

            // Проверка сходимости
            diff = 0;
            for (i = 0; i < n; i++) {
                diff += Math.abs(prNew[i] - pr[i]);
                pr[i] = prNew[i];
            }
            iter++;
        }

        // Нормализация к [0, 1] относительно максимума
        var max = 0;
        for (i = 0; i < n; i++) if (pr[i] > max) max = pr[i];
        if (max > 0) {
            for (i = 0; i < n; i++) pr[i] = pr[i] / max;
        }

        var result = {};
        for (i = 0; i < n; i++) {
            result[graph.nodes[i].id] = pr[i];
        }
        result._iterations = iter;
        result._converged = (diff <= tol);
        return result;
    },

    // ============================================================
    // EIGENVECTOR CENTRALITY (Bonacich 1972) — POWER ITERATION
    // x_new = A * x, нормализация по L2.
    // В двудольных графах строгая сходимость невозможна (собственные
    // значения ±λ осциллируют). Значения стабилизируются за ~100
    // итераций, этого достаточно для ранжирования.
    // Параметры: maxIter=500, tol=1e-6.
    // ============================================================
    eigenvectorCentrality: function(graph, options) {
        options = options || {};
        var maxIter = options.maxIter || 500;
        var tol = options.tolerance || 1e-6;

        if (!graph || !graph.nodes || graph.nodes.length === 0) {
            return {};
        }

        var n = graph.nodes.length;
        var i, k;

        var idx = {};
        for (i = 0; i < n; i++) idx[graph.nodes[i].id] = i;

        // Матрица смежности (разреженная, симметричная)
        var adj = [];
        for (i = 0; i < n; i++) adj.push({});

        for (k = 0; k < graph.edges.length; k++) {
            var e = graph.edges[k];
            var u = idx[e.source];
            var v = idx[e.target];
            if (u === undefined || v === undefined) continue;
            if (u === v) continue;
            var w = e.weight || 1;
            adj[u][v] = (adj[u][v] || 0) + w;
            adj[v][u] = (adj[v][u] || 0) + w;
        }

        // Начальный вектор: равномерный
        var invSqrtN = 1 / Math.sqrt(n);
        var x = new Array(n).fill(invSqrtN);
        var xNew = new Array(n).fill(0);

        var iter = 0;
        var diff = 1;

        while (iter < maxIter && diff > tol) {
            // xNew = A * x
            for (i = 0; i < n; i++) xNew[i] = 0;
            for (var u2 = 0; u2 < n; u2++) {
                var neigh = adj[u2];
                for (var vv in neigh) {
                    var vIdx = parseInt(vv, 10);
                    xNew[vIdx] += neigh[vv] * x[u2];
                }
            }

            // Нормализация по L2
            var norm = 0;
            for (i = 0; i < n; i++) norm += xNew[i] * xNew[i];
            norm = Math.sqrt(norm);
            if (norm === 0) break;
            for (i = 0; i < n; i++) xNew[i] /= norm;

            // Проверка сходимости
            diff = 0;
            for (i = 0; i < n; i++) {
                diff += Math.abs(xNew[i] - x[i]);
                x[i] = xNew[i];
            }
            iter++;
        }

        // Нормализация к [0, 1] по максимуму модуля
        var max = 0;
        for (i = 0; i < n; i++) {
            var v3 = Math.abs(x[i]);
            if (v3 > max) max = v3;
        }
        if (max > 0) {
            for (i = 0; i < n; i++) x[i] = Math.abs(x[i]) / max;
        }

        var result = {};
        for (i = 0; i < n; i++) {
            result[graph.nodes[i].id] = x[i];
        }
        result._iterations = iter;
        result._converged = (diff <= tol);
        return result;
    }

};

console.log('✅ RELATIONS.JS готов (degree, betweenness, closeness, louvain, pagerank, eigenvector)');


// ============================================================
// CLUSTERING COEFFICIENT (Watts & Strogatz 1998)
// Локальный коэффициент: 2*E_i / (k_i * (k_i - 1))
// Глобальный = среднее локальных.
// ============================================================
window.Relations.clusteringCoefficient = function(graph, options) {
    options = options || {};
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
        return { local: {}, global: 0, transitivity: 0, triangles: 0 };
    }

    var n = graph.nodes.length;
    var i;

    var idx = {};
    for (i = 0; i < n; i++) idx[graph.nodes[i].id] = i;

    // Списки смежности (без весов, как множества)
    var adj = [];
    for (i = 0; i < n; i++) adj.push({});

    for (var k = 0; k < graph.edges.length; k++) {
        var e = graph.edges[k];
        var u = idx[e.source];
        var v = idx[e.target];
        if (u === undefined || v === undefined) continue;
        if (u === v) continue;
        adj[u][v] = true;
        adj[v][u] = true;
    }

    var local = {};
    var sumLocal = 0;
    var triangleCount = 0;

    for (i = 0; i < n; i++) {
        var neighbors = Object.keys(adj[i]).map(Number);
        var k_i = neighbors.length;

        if (k_i < 2) {
            local[graph.nodes[i].id] = 0;
            continue;
        }

        // Считаем рёбра между соседями
        var linksBetween = 0;
        for (var a = 0; a < k_i; a++) {
            for (var b = a + 1; b < k_i; b++) {
                if (adj[neighbors[a]][neighbors[b]]) {
                    linksBetween++;
                }
            }
        }

        var c_i = (2 * linksBetween) / (k_i * (k_i - 1));
        local[graph.nodes[i].id] = c_i;
        sumLocal += c_i;
        triangleCount += linksBetween;
    }

    // Транзитивность (глобальный кластерный коэффициент, Watts-Strogatz):
    // 3 * triangles / closed_triples
    var closedTriples = 0;
    for (i = 0; i < n; i++) {
        var k_i2 = Object.keys(adj[i]).length;
        if (k_i2 >= 2) {
            closedTriples += k_i2 * (k_i2 - 1) / 2;
        }
    }
    var transitivity = closedTriples > 0 ? (triangleCount / closedTriples) : 0;

    return {
        local: local,
        global: n > 0 ? (sumLocal / n) : 0,
        transitivity: transitivity,
        triangles: triangleCount
    };
};

// ============================================================
// NETWORK DIAMETER + AVERAGE PATH LENGTH (BFS по всем парам)
// Diameter = max кратчайших путей.
// Average Path Length = среднее по всем парам.
// ============================================================
window.Relations.networkDiameter = function(graph, options) {
    options = options || {};
    var maxNodes = options.maxNodes || 500;

    if (!graph || !graph.nodes || graph.nodes.length === 0) {
        return { diameter: 0, avgPathLength: 0, pairs: 0, eccentricities: {} };
    }

    var n = graph.nodes.length;
    if (n > maxNodes) {
        return { diameter: -1, avgPathLength: -1, pairs: 0,
                 error: 'Слишком много узлов (' + n + ' > ' + maxNodes + ')' };
    }

    // Построение adjacency
    var adj = window.Relations._adjacency(graph);
    var ids = Object.keys(adj);
    var N = ids.length;

    if (N === 0) {
        return { diameter: 0, avgPathLength: 0, pairs: 0, eccentricities: {} };
    }

    var ecc = {};
    var i, j;
    for (i = 0; i < N; i++) ecc[ids[i]] = 0;

    var totalDistance = 0;
    var pairsCount = 0;
    var maxDist = 0;

    // BFS от каждого узла
    for (i = 0; i < N; i++) {
        var s = ids[i];
        var dist = {};
        for (j = 0; j < N; j++) dist[ids[j]] = -1;
        dist[s] = 0;

        var Q = [s];
        var localMax = 0;
        while (Q.length > 0) {
            var v = Q.shift();
            var neigh = adj[v] || [];
            for (var m = 0; m < neigh.length; m++) {
                var w = neigh[m];
                if (dist[w] < 0) {
                    dist[w] = dist[v] + 1;
                    Q.push(w);
                    if (dist[w] > localMax) localMax = dist[w];
                }
            }
        }

        ecc[s] = localMax;
        if (localMax > maxDist) maxDist = localMax;

        for (j = 0; j < N; j++) {
            if (ids[j] !== s && dist[ids[j]] > 0) {
                totalDistance += dist[ids[j]];
                pairsCount++;
            }
        }
    }

    return {
        diameter: maxDist,
        avgPathLength: pairsCount > 0 ? (totalDistance / pairsCount) : 0,
        pairs: pairsCount,
        eccentricities: ecc
    };
};

// ============================================================
// ASSORTATIVITY (Newman 2002) — по типам узлов
// Смешиваются ли узлы одного типа между собой?
// Диапазон [-1, +1]:
//   +1 — полная ассортативность (однотипные соединяются)
//   -1 — полная диссортативность (разнотипные соединяются)
//    0 — случайное смешение
// ============================================================
window.Relations.assortativity = function(graph) {
    if (!graph || !graph.nodes || graph.nodes.length < 2) {
        return { assortativity: 0, typeMatrix: {} };
    }

    var types = {};
    for (var i = 0; i < graph.nodes.length; i++) {
        types[graph.nodes[i].id] = graph.nodes[i].type || 'unknown';
    }

    var typeList = [];
    for (var k in types) typeList.push(types[k]);
    var uniqueTypes = {};
    for (var t = 0; t < typeList.length; t++) uniqueTypes[typeList[t]] = true;
    var typeNames = Object.keys(uniqueTypes);

    var typeIndex = {};
    for (var ti = 0; ti < typeNames.length; ti++) typeIndex[typeNames[ti]] = ti;

    var M = typeNames.length;
    var typeMatrix = [];
    for (var m = 0; m < M; m++) {
        typeMatrix.push(new Array(M).fill(0));
    }

    // Матрица смешения типов
    var E = 0;
    for (var ei = 0; ei < graph.edges.length; ei++) {
        var e = graph.edges[ei];
        var ta = types[e.source];
        var tb = types[e.target];
        if (ta === undefined || tb === undefined) continue;
        var w = e.weight || 1;
        var ia = typeIndex[ta];
        var ib = typeIndex[tb];
        typeMatrix[ia][ib] += w;
        if (ia !== ib) typeMatrix[ib][ia] += w;
        E += (ia === ib ? w : 2 * w);
    }

    // Стандартная формула Newman для категориальной ассортативности
    // r = (Σ e_ii - Σ a_i²) / (1 - Σ a_i²)
    // где e_ii — доля рёбер внутри типа i, a_i — доля концов рёбер типа i
    var totalEdges = 0;
    for (var m1 = 0; m1 < M; m1++) {
        for (var m2 = 0; m2 < M; m2++) {
            totalEdges += typeMatrix[m1][m2];
        }
    }
    if (totalEdges === 0) {
        return { assortativity: 0, typeMatrix: typeMatrix, types: typeNames };
    }

    var traceE = 0;
    for (var m3 = 0; m3 < M; m3++) traceE += typeMatrix[m3][m3] / totalEdges;

    var a = new Array(M).fill(0);
    for (var m4 = 0; m4 < M; m4++) {
        for (var m5 = 0; m5 < M; m5++) {
            a[m4] += typeMatrix[m4][m5] / totalEdges;
        }
    }

    var sumA2 = 0;
    for (var m6 = 0; m6 < M; m6++) sumA2 += a[m6] * a[m6];

    var r = 0;
    if (sumA2 < 1) {
        r = (traceE - sumA2) / (1 - sumA2);
    }

    return {
        assortativity: r,
        typeMatrix: typeMatrix,
        types: typeNames
    };
};

// Обновляем финальный лог
console.log('✅ RELATIONS.JS готов (degree, betweenness, closeness, louvain, pagerank, eigenvector, clustering, diameter, assortativity)');

