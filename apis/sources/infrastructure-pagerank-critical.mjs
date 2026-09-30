// infrastructure-pagerank-critical.mjs
// Crucix Infrastructure — Layer 1: PageRank + Critical Paths

export class PageRankAnalyzer {
  constructor(graph) {
    this.graph = graph;
    this.dampingFactor = 0.85;
    this.maxIterations = 100;
    this.tolerance = 1e-6;
  }

  compute(options = {}) {
    const damping = options.damping ?? this.dampingFactor;
    const maxIter = options.maxIterations ?? this.maxIterations;
    const tol = options.tolerance ?? this.tolerance;
    const nodeIds = this.graph.getAllNodes().map((n) => n.id);
    const N = nodeIds.length;
    if (N === 0) return { scores: {}, ranked: [] };

    let scores = {};
    nodeIds.forEach((id) => (scores[id] = 1 / N));

    const outDegrees = {};
    nodeIds.forEach((id) => {
      outDegrees[id] = this.graph.getOutDegree(id);
    });

    for (let iter = 0; iter < maxIter; iter++) {
      const newScores = {};
      let danglingSum = 0;

      nodeIds.forEach((id) => {
        if (outDegrees[id] === 0) danglingSum += scores[id];
      });

      nodeIds.forEach((id) => {
        let sum = 0;
        this.graph.edges.forEach((edge) => {
          if (edge.target === id) {
            const srcOutDeg = outDegrees[edge.source];
            if (srcOutDeg > 0) {
              sum += (scores[edge.source] / srcOutDeg) * edge.weight;
            }
          }
        });
        newScores[id] = (1 - damping) / N + damping * (sum + danglingSum / N);
      });

      let diff = 0;
      nodeIds.forEach((id) => {
        diff += Math.abs(newScores[id] - scores[id]);
      });
      scores = newScores;

      if (diff < tol) break;
    }

    const ranked = nodeIds
      .map((id) => ({ id, score: scores[id], node: this.graph.getNode(id) }))
      .sort((a, b) => b.score - a.score);

    return { scores, ranked, iterations: maxIter };
  }

  betweennessCentrality() {
    const nodeIds = this.graph.getAllNodes().map((n) => n.id);
    const betweenness = {};
    nodeIds.forEach((id) => (betweenness[id] = 0));

    for (const source of nodeIds) {
      const { distances, predecessors } = this._dijkstra(source);
      const stack = [];
      const delta = {};
      nodeIds.forEach((id) => (delta[id] = 0));

      const sorted = nodeIds
        .filter((id) => distances[id] < Infinity)
        .sort((a, b) => distances[b] - distances[a]);
      stack.push(...sorted);

      while (stack.length > 0) {
        const w = stack.pop();
        for (const v of predecessors[w] || []) {
          delta[v] += (1 + delta[w]);
        }
        if (w !== source) {
          betweenness[w] += delta[w];
        }
      }
    }

    const N = nodeIds.length;
    const norm = N > 2 ? 2 / ((N - 1) * (N - 2)) : 1;
    nodeIds.forEach((id) => (betweenness[id] *= norm));

    const ranked = nodeIds
      .map((id) => ({ id, score: betweenness[id], node: this.graph.getNode(id) }))
      .sort((a, b) => b.score - a.score);

    return { scores: betweenness, ranked };
  }

  criticalPaths(vulnerabilityScores = {}, topN = 5) {
    const pr = this.compute();
    const topNodes = pr.ranked.slice(0, topN).map((r) => r.id);
    const paths = [];

    for (let i = 0; i < topNodes.length; i++) {
      for (let j = i + 1; j < topNodes.length; j++) {
        const path = this._shortestPath(topNodes[i], topNodes[j]);
        if (path) {
          const pathVuln = path.reduce((sum, id) => sum + (vulnerabilityScores[id] || 0), 0) / path.length;
          paths.push({
            from: topNodes[i],
            to: topNodes[j],
            path,
            length: path.length,
            avgVulnerability: pathVuln,
          });
        }
      }
    }

    return paths.sort((a, b) => a.avgVulnerability - b.avgVulnerability);
  }

  identifyCriticalNodes(vulnerabilityScores = {}, options = {}) {
    const topN = options.topN ?? 10;
    const pr = this.compute();
    const bc = this.betweennessCentrality();

    const combined = this.graph.getAllNodes().map((node) => {
      const prScore = pr.scores[node.id] || 0;
      const bcScore = bc.scores[node.id] || 0;
      const vulnScore = vulnerabilityScores[node.id] || 0;
      const criticality = (prScore * 0.4 + bcScore * 0.3 + vulnScore * 0.3);
      return {
        id: node.id,
        node,
        pageRank: prScore,
        betweenness: bcScore,
        vulnerability: vulnScore,
        criticality,
      };
    });

    combined.sort((a, b) => b.criticality - a.criticality);
    return combined.slice(0, topN);
  }

  _dijkstra(source) {
    const nodeIds = this.graph.getAllNodes().map((n) => n.id);
    const distances = {};
    const visited = new Set();
    const predecessors = {};

    nodeIds.forEach((id) => {
      distances[id] = Infinity;
      predecessors[id] = [];
    });
    distances[source] = 0;

    while (visited.size < nodeIds.length) {
      let minDist = Infinity;
      let current = null;
      nodeIds.forEach((id) => {
        if (!visited.has(id) && distances[id] < minDist) {
          minDist = distances[id];
          current = id;
        }
      });
      if (current === null) break;
      visited.add(current);

      const neighbors = this.graph.getNeighbors(current);
      for (const { node, weight } of neighbors) {
        if (visited.has(node.id)) continue;
        const newDist = distances[current] + (1 / weight);
        if (newDist < distances[node.id]) {
          distances[node.id] = newDist;
          predecessors[node.id] = [current];
        } else if (newDist === distances[node.id]) {
          predecessors[node.id].push(current);
        }
      }
    }

    return { distances, predecessors };
  }

  _shortestPath(source, target) {
    const { distances, predecessors } = this._dijkstra(source);
    if (distances[target] === Infinity) return null;

    const path = [];
    let current = target;
    const visited = new Set();
    while (current !== source && !visited.has(current)) {
      visited.add(current);
      path.unshift(current);
      const preds = predecessors[current];
      if (!preds || preds.length === 0) break;
      current = preds[0];
    }
    path.unshift(source);
    return path.length > 1 ? path : null;
  }
}
