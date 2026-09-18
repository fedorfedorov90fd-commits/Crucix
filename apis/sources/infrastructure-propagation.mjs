// infrastructure-propagation.mjs
// Crucix Infrastructure — Layer 1: Cascade Propagation

export class CascadePropagation {
  constructor(graph) {
    this.graph = graph;
    this.maxIterations = 50;
    this.defaultDecayFactor = 0.7;
  }

  propagate(initialNodeId, vulnerabilityScores = {}, options = {}) {
    const decay = options.decayFactor ?? this.defaultDecayFactor;
    const maxIter = options.maxIterations ?? this.maxIterations;
    const threshold = options.threshold ?? 0.15;

    const failed = new Set([initialNodeId]);
    const timeline = [{ step: 0, failed: [initialNodeId], newlyFailed: [initialNodeId] }];
    let frontier = [initialNodeId];

    for (let step = 1; step <= maxIter && frontier.length > 0; step++) {
      const newlyFailed = [];

      for (const sourceId of frontier) {
        const neighbors = this.graph.getNeighbors(sourceId);

        for (const { node, weight } of neighbors) {
          if (failed.has(node.id)) continue;

          const baseVuln = vulnerabilityScores[node.id] ?? 0.3;
          const sourceVuln = vulnerabilityScores[sourceId] ?? 0.5;
          const propagationProb = baseVuln * sourceVuln * weight * decay;

          if (propagationProb >= threshold) {
            failed.add(node.id);
            newlyFailed.push(node.id);
          }
        }
      }

      if (newlyFailed.length > 0) {
        timeline.push({ step, failed: Array.from(failed), newlyFailed });
        frontier = newlyFailed;
      } else {
        break;
      }
    }

    const totalNodes = this.graph.size().nodes;
    const failedArray = Array.from(failed);

    return {
      initialNode: initialNodeId,
      totalFailed: failedArray.length,
      failureRate: totalNodes > 0 ? failedArray.length / totalNodes : 0,
      steps: timeline.length - 1,
      timeline,
      failedNodes: failedArray,
      cascaded: failedArray.length > 1,
    };
  }

  propagateMultiple(initialNodeIds, vulnerabilityScores = {}, options = {}) {
    const results = initialNodeIds.map((id) => this.propagate(id, vulnerabilityScores, options));
    const uniqueFailed = new Set();
    results.forEach((r) => r.failedNodes.forEach((n) => uniqueFailed.add(n)));

    return {
      initialNodes: initialNodeIds,
      totalFailed: uniqueFailed.size,
      failureRate: this.graph.size().nodes > 0 ? uniqueFailed.size / this.graph.size().nodes : 0,
      perNode: results,
      allFailedNodes: Array.from(uniqueFailed),
    };
  }

  assessImpact(nodeId, vulnerabilityScores = {}, options = {}) {
    const result = this.propagate(nodeId, vulnerabilityScores, options);
    const affectedTypes = {};

    result.failedNodes.forEach((id) => {
      const node = this.graph.getNode(id);
      if (node) {
        affectedTypes[node.type] = (affectedTypes[node.type] || 0) + 1;
      }
    });

    return {
      ...result,
      affectedByType: affectedTypes,
      severity: this._classifySeverity(result.failureRate),
    };
  }

  _classifySeverity(rate) {
    if (rate >= 0.5) return 'critical';
    if (rate >= 0.25) return 'high';
    if (rate >= 0.1) return 'moderate';
    if (rate > 0) return 'low';
    return 'none';
  }
}
