// ═══════════════════════════════════════════════════════════════
//  CRUCIX GRAPH PANEL v1.0.0
//  Боковая панель: досье выбранного узла графа.
//  Работает с API /api/layers/entity-graph.
// ═══════════════════════════════════════════════════════════════

const DEFAULT_API_BASE = '/api/layers/entity-graph';

export class GraphPanel {
  constructor(options = {}) {
    this.containerId = options.containerId || 'side-panel';
    this.apiBase = options.apiBase || DEFAULT_API_BASE;
    this.container = null;
    this.currentNodeId = null;
    this.onClose = options.onClose || null;
  }

  init() {
    this.container = document.getElementById(this.containerId);
    return !!this.container;
  }

  show() {
    if (this.container) this.container.classList.add('open');
  }

  hide() {
    if (this.container) this.container.classList.remove('open');
    this.currentNodeId = null;
    if (typeof this.onClose === 'function') this.onClose();
  }

  // ── Открыть досье по id узла ─────────────────────────────
  async openNode(nodeId) {
    if (!nodeId) return;
    if (!this.container) this.init();
    if (!this.container) return;

    this.currentNodeId = nodeId;
    this.show();
    this._renderLoading(nodeId);

    try {
      const resp = await fetch(`${this.apiBase}/node/${encodeURIComponent(nodeId)}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      this._renderDossier(data);
    } catch (e) {
      this._renderError(e.message);
    }
  }

  _renderLoading(nodeId) {
    this.container.innerHTML = `
      <div class="panel-header">
        <h3>Досье</h3>
        <div class="panel-close" data-action="close">✕</div>
      </div>
      <div class="panel-content">
        <p style="color:#64748b;font-size:13px;">Загрузка: ${this._esc(nodeId)}...</p>
      </div>
    `;
    this._bindClose();
  }

  _renderError(msg) {
    this.container.innerHTML = `
      <div class="panel-header">
        <h3>Досье</h3>
        <div class="panel-close" data-action="close">✕</div>
      </div>
      <div class="panel-content">
        <p style="color:#ef4444;font-size:13px;">Ошибка: ${this._esc(msg)}</p>
      </div>
    `;
    this._bindClose();
  }

  _renderDossier(data) {
    const node = data.node || {};
    const edges = data.edges || [];
    const props = node.properties || {};

    const riskClass = (node.riskScore || 0) >= 75 ? 'critical'
                    : (node.riskScore || 0) >= 50 ? 'high'
                    : (node.riskScore || 0) >= 25 ? 'elevated' : 'low';

    const html = `
      <div class="panel-header">
        <h3>${this._esc(node.label || node.id || 'Досье')}</h3>
        <div class="panel-close" data-action="close">✕</div>
      </div>
      <div class="panel-content">
        <div class="dossier-section">
          <h4>Идентификация</h4>
          <div class="kv">
            <div class="k">ID:</div><div class="v">${this._esc(node.id || '—')}</div>
            <div class="k">Тип:</div><div class="v">${this._esc(node.type || '—')}</div>
            <div class="k">Страна:</div><div class="v">${this._esc(node.country || '—')}</div>
            <div class="k">Достоверность:</div><div class="v">${node.credibility ?? '—'}/100</div>
          </div>
        </div>

        <div class="dossier-section">
          <h4>Оценка</h4>
          <div class="kv">
            <div class="k">Риск:</div><div class="v risk-${riskClass}">${node.riskScore ?? 0}/100</div>
            <div class="k">Связей:</div><div class="v">${edges.length}</div>
          </div>
        </div>

        ${node.description ? `
        <div class="dossier-section">
          <h4>Описание</h4>
          <p>${this._esc(node.description)}</p>
        </div>` : ''}

        ${Object.keys(props).length ? `
        <div class="dossier-section">
          <h4>Свойства</h4>
          <div class="kv">
            ${Object.entries(props).slice(0, 12).map(([k, v]) => `
              <div class="k">${this._esc(k)}:</div>
              <div class="v">${this._esc(String(v).slice(0, 60))}</div>
            `).join('')}
          </div>
        </div>` : ''}

        ${edges.length ? `
        <div class="dossier-section">
          <h4>Связи (${edges.length})</h4>
          ${edges.slice(0, 15).map(e => `
            <div style="padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:11px;">
              <span style="color:#64748b;">${this._esc(e.type)}</span>
              <span style="color:#e2e8f0;">${this._esc(e.from === node.id ? '→ ' + e.to : e.from + ' →')}</span>
            </div>
          `).join('')}
        </div>` : ''}

        ${node.lat != null && node.lon != null ? `
        <div class="dossier-section">
          <h4>Координаты</h4>
          <div class="kv">
            <div class="k">Широта:</div><div class="v">${node.lat.toFixed(4)}</div>
            <div class="k">Долгота:</div><div class="v">${node.lon.toFixed(4)}</div>
          </div>
        </div>` : ''}

        <div class="dossier-section" style="border-top:1px solid rgba(255,255,255,0.08);padding-top:10px;margin-top:10px;">
          <button data-action="open-map" data-lat="${node.lat ?? ''}" data-lon="${node.lon ?? ''}" style="padding:6px 12px;font-size:11px;background:#1c1f28;color:#e2e8f0;border:1px solid rgba(255,255,255,0.15);border-radius:4px;cursor:pointer;">Открыть на карте</button>
        </div>
      </div>

      <style>
        #side-panel { position: fixed; top: 44px; bottom: 32px; right: 0; width: 360px; background: #14161d; border-left: 1px solid rgba(255,255,255,0.08); z-index: 90; transform: translateX(100%); transition: transform 0.3s ease; overflow-y: auto; }
        #side-panel.open { transform: translateX(0); }
        #side-panel .panel-header { padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; }
        #side-panel .panel-header h3 { font-size: 13px; font-weight: 600; color: #e2e8f0; }
        #side-panel .panel-close { cursor: pointer; color: #64748b; font-size: 16px; padding: 2px 6px; }
        #side-panel .panel-close:hover { color: #e94560; }
        #side-panel .panel-content { padding: 14px 16px; }
        #side-panel .dossier-section { margin-bottom: 14px; }
        #side-panel .dossier-section h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 6px; }
        #side-panel .dossier-section p { font-size: 12px; line-height: 1.5; color: #e2e8f0; }
        #side-panel .dossier-section .kv { display: grid; grid-template-columns: 100px 1fr; gap: 3px 8px; font-size: 11px; }
        #side-panel .dossier-section .kv .k { color: #64748b; }
        #side-panel .dossier-section .kv .v { color: #e2e8f0; }
        #side-panel .risk-critical { color: #ff0040; font-weight: 700; }
        #side-panel .risk-high { color: #ff6b35; font-weight: 700; }
        #side-panel .risk-elevated { color: #ffaa00; font-weight: 700; }
        #side-panel .risk-low { color: #22c55e; font-weight: 700; }
      </style>
    `;

    this.container.innerHTML = html;
    this._bindClose();
    this._bindActions(node);
  }

  _bindClose() {
    const closeBtn = this.container.querySelector('[data-action="close"]');
    if (closeBtn) closeBtn.addEventListener('click', () => this.hide());
  }

  _bindActions(node) {
    const openMapBtn = this.container.querySelector('[data-action="open-map"]');
    if (openMapBtn && node.lat != null && node.lon != null) {
      openMapBtn.addEventListener('click', () => {
        if (typeof this.onOpenOnMap === 'function') {
          this.onOpenOnMap(node.lat, node.lon, node.id);
        }
      });
    }
  }

  _esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }
}

let _instance = null;
export function getGraphPanel(options) {
  if (!_instance) _instance = new GraphPanel(options);
  return _instance;
}
export function resetGraphPanel() { _instance = null; }
