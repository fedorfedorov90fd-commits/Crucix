/**
 * geopoliticalPanel.js — Панель геополитических индикаторов
 * Отображает геополитическую напряжённость по регионам
 */
export const geopoliticalPanel = {
  name: 'geopolitical',
  initialized: false,
  container: null,

  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn('geopoliticalPanel: контейнер не найден');
      return this;
    }
    this.initialized = true;
    this.render();
    return this;
  },

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="panel panel-geopolitical">
        <h3>🌍 Геополитические индикаторы</h3>
        <div class="panel-content">
          <div class="geo-list">
            <div class="geo-item"><span>Активные конфликты</span><span class="badge">3</span></div>
            <div class="geo-item"><span>Зоны напряжённости</span><span class="badge">7</span></div>
            <div class="geo-item"><span>Индекс стабильности</span><span class="badge">64%</span></div>
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

window.geopoliticalPanel = geopoliticalPanel;
