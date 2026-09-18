/**
 * schedulerPanel.js — Панель планировщика задач
 * Управление расписанием сборки данных и отчётов
 */
export const schedulerPanel = {
  name: 'scheduler',
  initialized: false,
  container: null,

  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn('schedulerPanel: контейнер не найден');
      return this;
    }
    this.initialized = true;
    this.render();
    return this;
  },

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="panel panel-scheduler">
        <h3>⏰ Планировщик задач</h3>
        <div class="panel-content">
          <div class="schedule-list">
            <div class="schedule-item"><span>Активных задач</span><span class="badge">8</span></div>
            <div class="schedule-item"><span>Выполнено сегодня</span><span class="badge">5</span></div>
            <div class="schedule-item"><span>Следующий запуск</span><span class="badge">через 2ч</span></div>
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

window.schedulerPanel = schedulerPanel;
