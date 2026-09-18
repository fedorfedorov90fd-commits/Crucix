/**
 * rssManagerPanel.js — Панель управления RSS-лентами
 * Управление подписками, чтение и фильтрация RSS
 */
export const rssManagerPanel = {
  name: 'rssManager',
  initialized: false,
  container: null,

  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn('rssManagerPanel: контейнер не найден');
      return this;
    }
    this.initialized = true;
    this.render();
    return this;
  },

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="panel panel-rss">
        <h3>📡 RSS-ленты</h3>
        <div class="panel-content">
          <div class="rss-list">
            <div class="rss-item"><span>Активных источников</span><span class="badge">14</span></div>
            <div class="rss-item"><span>Новых записей</span><span class="badge">42</span></div>
            <div class="rss-item"><span>Обновлено</span><span class="badge">сегодня</span></div>
          </div>
        </div>
      </div>
    `;
  },

  getState() {
    return {
      name: this.name,
      initialized: this.initialized,
      container: this.container ? true : false
    };
  }
};

window.rssManagerPanel = rssManagerPanel;
