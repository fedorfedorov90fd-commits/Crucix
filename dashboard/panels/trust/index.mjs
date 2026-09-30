// Панель доверия к источникам для Crucix (Модуль №25)

export const panel = {
  id: 'trust',
  name: 'Доверие к источникам',
  icon: '🛡️',
  category: 'Аналитика',
  priority: 8,

  async render() {
    return `
      <div id="trust-panel" class="panel-content" style="padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
          <h3 style="color:#fff;margin:0;">🛡️ Доверие к источникам</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button onclick="window.location.href='/trust'" style="padding:4px 12px;background:#2196f3;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;">
              Открыть полную страницу
            </button>
          </div>
        </div>
        <div id="trust-panel-stats" style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;font-size:13px;color:#888;">
          <span>Загрузка...</span>
        </div>
        <div id="trust-panel-sources" style="font-size:12px;max-height:300px;overflow-y:auto;">
          <div style="color:#666;text-align:center;padding:20px;">Загрузка источников...</div>
        </div>
      </div>
    `;
  },

  async onLoad() {
    await this.loadPanelData();
    this.interval = setInterval(() => this.loadPanelData(), 60000);
  },

  onUnload() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  },

  async loadPanelData() {
    try {
      const response = await fetch('/api/trust/sources');
      const data = await response.json();

      if (data.success) {
        this.renderPanelStats(data.stats);
        this.renderPanelSources(data.sources);
      }
    } catch (e) {
      console.error('[Trust Panel] Ошибка:', e);
    }
  },

  renderPanelStats(stats) {
    const el = document.getElementById('trust-panel-stats');
    if (!el) return;
    el.innerHTML = `
      <span>📊 Всего: <strong style="color:#e8f0f8;">${stats.total || 0}</strong></span>
      <span>✅ Активных: <strong style="color:#4caf50;">${stats.enabled || 0}</strong></span>
      <span>📈 Средний рейтинг: <strong style="color:#ffd700;">${stats.avgTrust || 0}</strong></span>
      <span>🟢 Высокий (80+): <strong style="color:#4caf50;">${stats.high || 0}</strong></span>
      <span>🟡 Средний (60-79): <strong style="color:#ffd700;">${stats.medium || 0}</strong></span>
      <span>🔴 Низкий (&lt;60): <strong style="color:#f44336;">${stats.low || 0}</strong></span>
    `;
  },

  renderPanelSources(sources) {
    const el = document.getElementById('trust-panel-sources');
    if (!el) return;

    if (!sources || sources.length === 0) {
      el.innerHTML = '<div style="color:#666;text-align:center;padding:20px;">Нет источников</div>';
      return;
    }

    // Показываем топ-10 по рейтингу
    const sorted = [...sources].sort((a, b) => b.trust - a.trust).slice(0, 10);

    let html = '';
    for (const s of sorted) {
      const trustClass = s.trust >= 80 ? '#4caf50' : s.trust >= 60 ? '#ffd700' : '#f44336';
      const statusIcon = s.enabled ? '🟢' : '🔴';

      html += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.03);">
          <span style="display:flex;align-items:center;gap:8px;flex:1;">
            <span>${statusIcon}</span>
            <span style="color:#e8f0f8;">${s.name}</span>
            <span style="color:#555;font-size:11px;">${s.category || '—'}</span>
          </span>
          <span style="color:${trustClass};font-weight:600;font-size:14px;">${s.trust}</span>
          <span style="color:#555;font-size:11px;width:50px;text-align:right;">
            ${s.credibility}/${s.speed}/${s.objectivity}
          </span>
          <button onclick="window.location.href='/trust'" style="padding:2px 8px;background:rgba(255,255,255,0.06);color:#888;border:none;border-radius:3px;cursor:pointer;font-size:11px;">
            →
          </button>
        </div>
      `;
    }

    el.innerHTML = html;
  }
};

export default panel;