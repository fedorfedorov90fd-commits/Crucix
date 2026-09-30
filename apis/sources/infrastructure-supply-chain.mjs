// infrastructure-supply-chain.mjs
// Crucix Infrastructure — Layer 3: Supply Chain Analysis

import { InfrastructureGraph, haversine } from './infrastructure-graph-core.mjs';

export class SupplyChainAnalysis {
  constructor(graph) {
    this.graph = graph;
  }

  analyze() {
    const hhi = this.computeHHI();
    const dependencies = this.analyzeDependencies();
    const bottlenecks = this.findBottlenecks();
    const criticalLinks = this.findCriticalLinks();
    const concentration = this.computeConcentration();
    return {
      hhi, concentration, dependencies, bottlenecks, criticalLinks,
      summary: {
        totalNodes: this.graph.size().nodes,
        totalEdges: this.graph.size().edges,
        hhiLevel: this._hhiLevel(hhi),
        topBottleneck: bottlenecks[0] || null,
        mostConcentrated: concentration[0] || null,
      },
    };
  }

  computeHHI() {
    const nodes = this.graph.getAllNodes();
    const suppliers = nodes.filter((n) => n.type === 'supplier' || n.type === 'port' || n.type === 'refinery' || n.type === 'seaport');
    if (suppliers.length === 0) return 0;
    const capacities = suppliers.map((s) => s.capacity || 1);
    const total = capacities.reduce((a, b) => a + b, 0);
    const shares = capacities.map((c) => (c / total) * 100);
    return shares.reduce((sum, share) => sum + share * share, 0);
  }

  _hhiLevel(hhi) {
    if (hhi >= 2500) return 'highly_concentrated';
    if (hhi >= 1500) return 'moderately_concentrated';
    if (hhi >= 1000) return 'slightly_concentrated';
    return 'diversified';
  }

  analyzeDependencies() {
    const nodes = this.graph.getAllNodes();
    return nodes.map((node) => {
      const incoming = [];
      this.graph.edges.forEach((edge) => {
        if (edge.target === node.id) {
          incoming.push({
            source: edge.source,
            sourceNode: this.graph.getNode(edge.source),
            weight: edge.weight,
          });
        }
      });
      return {
        node: node.id, name: node.name, type: node.type,
        incomingDependencies: incoming.length,
        dependencies: incoming,
        dependencyScore: Math.min(incoming.length / 5, 1),
        isSinglePointOfFailure: incoming.length === 1,
      };
    }).sort((a, b) => b.incomingDependencies - a.incomingDependencies);
  }

  findBottlenecks() {
    const nodes = this.graph.getAllNodes();
    return nodes.map((node) => {
      const inDeg = this.graph.getInDegree(node.id);
      const outDeg = this.graph.getOutDegree(node.id);
      const totalFlow = inDeg + outDeg;
      const bottleneckFactor = inDeg > 0 ? inDeg / (totalFlow || 1) : 0;
      return {
        node: node.id, name: node.name, type: node.type,
        inDegree: inDeg, outDegree: outDeg, bottleneckFactor,
        isBottleneck: inDeg >= 3 && outDeg >= 2,
        severity: bottleneckFactor > 0.6 ? 'high' : bottleneckFactor > 0.4 ? 'moderate' : 'low',
      };
    }).filter((n) => n.isBottleneck).sort((a, b) => b.bottleneckFactor - a.bottleneckFactor);
  }

  findCriticalLinks() {
    const edges = this.graph.getAllEdges();
    const critical = [];
    for (const edge of edges) {
      const sourceDeg = this.graph.getOutDegree(edge.source);
      const targetDeg = this.graph.getInDegree(edge.target);
      if (sourceDeg === 1 && targetDeg === 1) {
        critical.push({ source: edge.source, target: edge.target, weight: edge.weight, reason: 'single_connection' });
      } else if (sourceDeg <= 2 && targetDeg <= 2) {
        const sourceNode = this.graph.getNode(edge.source);
        const targetNode = this.graph.getNode(edge.target);
        if (sourceNode && targetNode && (sourceNode.criticality === 'high' || targetNode.criticality === 'high')) {
          critical.push({ source: edge.source, target: edge.target, weight: edge.weight, reason: 'critical_nodes' });
        }
      }
    }
    return critical;
  }

  computeConcentration() {
    const nodes = this.graph.getAllNodes();
    const byType = {};
    nodes.forEach((node) => {
      if (!byType[node.type]) byType[node.type] = [];
      byType[node.type].push(node);
    });
    return Object.entries(byType).map(([type, typeNodes]) => {
      const totalCapacity = typeNodes.reduce((sum, n) => sum + (n.capacity || 0), 0);
      const hhi = this._typeHHI(typeNodes, totalCapacity);
      return {
        type, count: typeNodes.length, totalCapacity, hhi,
        concentration: this._hhiLevel(hhi),
        topNodes: typeNodes.sort((a, b) => (b.capacity || 0) - (a.capacity || 0)).slice(0, 3)
          .map((n) => ({ id: n.id, name: n.name, capacity: n.capacity })),
      };
    }).sort((a, b) => b.hhi - a.hhi);
  }

  _typeHHI(nodes, total) {
    if (total === 0) return 0;
    const shares = nodes.map((n) => ((n.capacity || 1) / total) * 100);
    return shares.reduce((sum, s) => sum + s * s, 0);
  }

  computeResilience() {
    const hhi = this.computeHHI();
    const bottlenecks = this.findBottlenecks();
    const criticalLinks = this.findCriticalLinks();
    const hhiScore = Math.max(0, 1 - hhi / 5000);
    const bottleneckPenalty = Math.min(bottlenecks.length * 0.1, 0.5);
    const criticalPenalty = Math.min(criticalLinks.length * 0.05, 0.3);
    const resilience = Math.max(0, hhiScore - bottleneckPenalty - criticalPenalty);
    return {
      score: resilience,
      level: resilience >= 0.7 ? 'high' : resilience >= 0.4 ? 'moderate' : 'low',
      hhiScore, bottleneckPenalty, criticalPenalty,
      factors: { hhi, bottleneckCount: bottlenecks.length, criticalLinkCount: criticalLinks.length },
    };
  }
}
