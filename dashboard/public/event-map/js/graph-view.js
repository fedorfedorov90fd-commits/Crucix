// ═══════════════════════════════════════════════════════════════
//  CRUCIX GRAPH VIEW v1.0.0
//  Force-directed рендеринг графа сущностей на canvas.
//  Без внешних зависимостей. Собственный физический движок.
//  Используется для карт, где нужен граф узлов-рёбер вместо
//  географической карты.
// ═══════════════════════════════════════════════════════════════

const DEFAULT_COLORS = {
  bg: '#0a0b0f',
  node: {
    country:       '#4a9eff',
    organization:  '#7c3aed',
    person:        '#e94560',
    vessel:        '#16c79a',
    aircraft:      '#ffc857',
    event:         '#ff6b35',
    facility:      '#8b5cf6',
    infrastructure:'#3b82f6',
    sanction:      '#ef4444',
    crypto_wallet: '#f59e0b',
    ip_address:    '#00ff88',
    domain:        '#10b981',
    apt:           '#dc2626',
    cve:           '#f97316',
    malware:       '#ec4899',
    default:       '#94a3b8',
  },
  edge: 'rgba(255,255,255,0.15)',
  edgeHighlight: '#e94560',
  text: '#e2e8f0',
  textDim: '#64748b',
};

export class GraphView {
  constructor(options = {}) {
    this.containerId = options.containerId;
    this.container = null;
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.colors = { ...DEFAULT_COLORS, ...(options.colors || {}) };
    this.nodes = [];
    this.edges = [];
    this.nodeIndex = new Map(); // id → node object
    this.hovered = null;
    this.selected = null;
    this._animFrame = null;
    this._tick = 0;
    this._running = false;
    this._zoom = 1;
    this._offsetX = 0;
    this._offsetY = 0;
    this._dragging = null;
    this._panning = false;
    this._panStart = null;
    this.options = {
      repulsion: options.repulsion || 8000,
      springLength: options.springLength || 90,
      springStrength: options.springStrength || 0.02,
      damping: options.damping || 0.85,
      minRadius: options.minRadius || 4,
      maxRadius: options.maxRadius || 16,
    };
  }

  async init() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) return false;
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.cursor = 'grab';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._bindEvents();
    return true;
  }

  _resize() {
    if (!this.canvas || !this.container) return;
    const dpr = window.devicePixelRatio || 1;
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ── Данные ─────────────────────────────────────────────────
  setData({ nodes = [], edges = [] }) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    this.nodes = nodes.map((n, i) => ({
      id: n.id,
      label: n.label || n.id,
      type: n.type || 'default',
      riskScore: n.riskScore || 0,
      credibility: n.credibility || 50,
      country: n.country || null,
      x: cx + (Math.random() - 0.5) * this.width * 0.6,
      y: cy + (Math.random() - 0.5) * this.height * 0.6,
      vx: 0,
      vy: 0,
      fixed: false,
    }));
    this.nodeIndex = new Map(this.nodes.map(n => [n.id, n]));
    this.edges = edges
      .map(e => ({ from: e.from, to: e.to, type: e.type, weight: e.weight || 1 }))
      .filter(e => this.nodeIndex.has(e.from) && this.nodeIndex.has(e.to));
    return { nodes: this.nodes.length, edges: this.edges.length };
  }

  clear() {
    this.nodes = [];
    this.edges = [];
    this.nodeIndex.clear();
    this.hovered = null;
    this.selected = null;
  }

  // ── Физика ─────────────────────────────────────────────────
  _step() {
    const nodes = this.nodes;
    const edges = this.edges;
    const repulsion = this.options.repulsion;
    const springLength = this.options.springLength;
    const springStrength = this.options.springStrength;
    const damping = this.options.damping;

    // Отталкивание между всеми парами (упрощённый O(n²), для 500+ узлов нужен Quadtree)
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy + 0.01;
        if (d2 > 22500) continue; // 150 px cutoff
        const f = repulsion / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Притяжение по рёбрам
    for (const edge of edges) {
      const a = this.nodeIndex.get(edge.from);
      const b = this.nodeIndex.get(edge.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
      const delta = (d - springLength) * springStrength;
      const fx = (dx / d) * delta;
      const fy = (dy / d) * delta;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Центростремительная сила к центру
    const cx = this.width / 2;
    const cy = this.height / 2;
    for (const n of nodes) {
      n.vx += (cx - n.x) * 0.0005;
      n.vy += (cy - n.y) * 0.0005;
    }

    // Демпфирование и интеграция
    for (const n of nodes) {
      if (n.fixed) continue;
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx;
      n.y += n.vy;
      // Ограничение
      n.x = Math.max(20, Math.min(this.width - 20, n.x));
      n.y = Math.max(20, Math.min(this.height - 20, n.y));
    }
  }

  // ── Отрисовка ──────────────────────────────────────────────
  _draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.translate(this._offsetX, this._offsetY);
    ctx.scale(this._zoom, this._zoom);

    // Рёбра
    ctx.lineWidth = 1;
    for (const e of this.edges) {
      const a = this.nodeIndex.get(e.from);
      const b = this.nodeIndex.get(e.to);
      if (!a || !b) continue;
      const isHi = (this.hovered && (this.hovered.id === a.id || this.hovered.id === b.id))
                || (this.selected && (this.selected.id === a.id || this.selected.id === b.id));
      ctx.strokeStyle = isHi ? this.colors.edgeHighlight : this.colors.edge;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Узлы
    for (const n of this.nodes) {
      const r = this._nodeRadius(n);
      const color = this.colors.node[n.type] || this.colors.node.default;
      const isHi = this.hovered?.id === n.id || this.selected?.id === n.id;

      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      if (isHi) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Метка при увеличении или наведении
      if (this._zoom > 1.4 || isHi) {
        ctx.fillStyle = isHi ? '#ffffff' : this.colors.textDim;
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(n.label.slice(0, 20), n.x, n.y - r - 4);
      }
    }

    ctx.restore();
  }

  _nodeRadius(n) {
    const base = this.options.minRadius + Math.min(this.options.maxRadius - this.options.minRadius, (n.riskScore || 0) / 10);
    return base;
  }

  _loop() {
    if (!this._running) return;
    this._tick++;
    if (this._tick < 400) this._step();
    this._draw();
    this._animFrame = requestAnimationFrame(() => this._loop());
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._loop();
  }

  stop() {
    this._running = false;
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
    this._animFrame = null;
  }

  // ── События мыши ──────────────────────────────────────────
  _bindEvents() {
    const c = this.canvas;
    c.addEventListener('mousemove', (e) => {
      const p = this._toGraphCoords(e);
      if (this._dragging) {
        this._dragging.x = p.x;
        this._dragging.y = p.y;
        this._dragging.vx = 0;
        this._dragging.vy = 0;
        return;
      }
      if (this._panning && this._panStart) {
        this._offsetX += e.clientX - this._panStart.x;
        this._offsetY += e.clientY - this._panStart.y;
        this._panStart = { x: e.clientX, y: e.clientY };
        return;
      }
      this.hovered = this._pickNode(p.x, p.y);
      c.style.cursor = this.hovered ? 'pointer' : (this._panning ? 'grabbing' : 'grab');
    });

    c.addEventListener('mousedown', (e) => {
      const p = this._toGraphCoords(e);
      const n = this._pickNode(p.x, p.y);
      if (n) {
        this._dragging = n;
        n.fixed = true;
        this.selected = n;
        this.emit('node:selected', n);
      } else {
        this._panning = true;
        this._panStart = { x: e.clientX, y: e.clientY };
        c.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mouseup', () => {
      if (this._dragging) {
        this._dragging.fixed = false;
        this._dragging = null;
      }
      this._panning = false;
      this._panStart = null;
      c.style.cursor = 'grab';
    });

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this._zoom = Math.max(0.2, Math.min(5, this._zoom * delta));
    }, { passive: false });

    c.addEventListener('dblclick', (e) => {
      const p = this._toGraphCoords(e);
      const n = this._pickNode(p.x, p.y);
      if (n) {
        this._zoom = 2;
        this._offsetX = this.width / 2 - n.x * this._zoom;
        this._offsetY = this.height / 2 - n.y * this._zoom;
      }
    });
  }

  _toGraphCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - this._offsetX) / this._zoom,
      y: (e.clientY - rect.top - this._offsetY) / this._zoom,
    };
  }

  _pickNode(x, y) {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      const r = this._nodeRadius(n);
      const dx = n.x - x;
      const dy = n.y - y;
      if (dx * dx + dy * dy <= r * r) return n;
    }
    return null;
  }

  // ── Публичные методы ──────────────────────────────────────
  highlight(nodeId) {
    const n = this.nodeIndex.get(nodeId);
    if (n) { this.selected = n; this.emit('node:selected', n); }
  }

  resetView() {
    this._zoom = 1;
    this._offsetX = 0;
    this._offsetY = 0;
  }

  refit() {
    if (this.nodes.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of this.nodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }
    const w = maxX - minX + 100;
    const h = maxY - minY + 100;
    const zoomX = this.width / w;
    const zoomY = this.height / h;
    this._zoom = Math.max(0.2, Math.min(3, Math.min(zoomX, zoomY)));
    const cxm = (minX + maxX) / 2;
    const cym = (minY + maxY) / 2;
    this._offsetX = this.width / 2 - cxm * this._zoom;
    this._offsetY = this.height / 2 - cym * this._zoom;
  }

  getStats() {
    return {
      nodes: this.nodes.length,
      edges: this.edges.length,
      zoom: this._zoom,
      tick: this._tick,
      running: this._running,
    };
  }
}

// Простейший EventEmitter для браузера
GraphView.prototype.emit = function (event, data) {
  if (!this._listeners) this._listeners = {};
  const arr = this._listeners[event] || [];
  for (const fn of arr) { try { fn(data); } catch {} }
};
GraphView.prototype.on = function (event, fn) {
  if (!this._listeners) this._listeners = {};
  if (!this._listeners[event]) this._listeners[event] = [];
  this._listeners[event].push(fn);
};

let _instance = null;
export function getGraphView(options) {
  if (!_instance) _instance = new GraphView(options);
  return _instance;
}
export function resetGraphView() { _instance = null; }
