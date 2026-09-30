/**
 * formats-relational.js — справочник правил парсинга R (Relation).
 * Личный арсенал event-map. Только данные. Не код.
 * Логика применения — в renderer.js.
 *
 * ВНИМАНИЕ: серверный адаптер R (relational.mjs) НЕ РЕАЛИЗОВАН.
 * Данные в формате графа на текущий момент в /api/layers/* не отдаются.
 * Справочник — заготовка под будущие слои (sanctions, cascade, arms-transfer).
 *
 * Возможные форматы ответа (будущее):
 *   1) {schema: 'crucix.basket.v1', nodes: [...], edges: [{source, target, weight}]}
 *   2) [{from, to, label, weight}, ...]  — плоский список рёбер
 */

window.FORMATS_RELATIONAL = {

  formatId: 'relational',
  dimension: 'R',
  description: 'Граф связей узлов и рёбер',
  status: 'NOT_IMPLEMENTED_SERVER_SIDE',

  '_default': {
    parser: 'basket-v1-graph',
    nodesPath: 'nodes',
    edgesPath: 'edges',
    nodeIdField:    ['id', 'nodeId', 'key'],
    nodeLabelField: ['label', 'name', 'title'],
    edgeSourceField: ['source', 'from', 'src'],
    edgeTargetField: ['target', 'to', 'dst'],
    edgeWeightField: ['weight', 'value', 'count'],
    extraFrom: null
  },

  '_array': {
    parser: 'flat-array-edges',
    edgeSourceField: ['from', 'source', 'src'],
    edgeTargetField: ['to', 'target', 'dst'],
    edgeWeightField: ['weight', 'value', 'count'],
    extraFrom: null
  },

  byLayer: {}

};

console.log('[formats-relational] загружен, dimension=R (NOT IMPLEMENTED server-side)');
