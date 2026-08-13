// dashboard/public/js/panels-loader.js
// Загрузчик панелей для Crucix

(async function loadPanels() {
  console.log('[Panels Loader] Загрузка панелей...');
  
  try {
    // Загружаем список панелей с сервера
    const response = await fetch('/api/panels');
    const data = await response.json();
    
    if (data.success && data.panels) {
      renderPanels(data.panels);
      console.log('[Panels Loader] Загружено панелей:', data.panels.length);
    } else {
      // Если API нет — используем встроенные панели
      loadBuiltinPanels();
    }
  } catch (e) {
    console.warn('[Panels Loader] API панелей не доступен, использую встроенные');
    loadBuiltinPanels();
  }
})();

function renderPanels(panels) {
  const container = document.querySelector('.panels-container') || document.body;
  
  for (const panel of panels) {
    const wrapper = document.createElement('div');
    wrapper.className = 'panel-wrapper';
    wrapper.dataset.panelId = panel.id;
    
    wrapper.innerHTML = `
      <div class="panel-header" data-panel-id="${panel.id}">
        <span class="panel-icon">${panel.icon || '📄'}</span>
        <span class="panel-name">${panel.name || panel.id}</span>
        <span class="panel-toggle">▼</span>
      </div>
      <div class="panel-body" data-panel-id="${panel.id}">
        ${panel.content || 'Загрузка...'}
      </div>
    `;
    
    container.appendChild(wrapper);
  }
}

function loadBuiltinPanels() {
  // Встроенные панели, если API недоступен
  const panels = [
    {
      id: 'rss-manager',
      name: '📡 Управление RSS',
      icon: '📡',
      content: `
        <div style="padding:16px;">
          <p style="color:#888;">Панель управления RSS</p>
          <button onclick="window.location.href='/rss-feed'" style="padding:8px 16px;background:#2196f3;color:#fff;border:none;border-radius:4px;cursor:pointer;">
            Открыть ленту новостей
          </button>
          <button onclick="loadRSSPanel()" style="padding:8px 16px;background:#4caf50;color:#fff;border:none;border-radius:4px;cursor:pointer;margin-left:8px;">
            Загрузить управление
          </button>
          <div id="rss-panel-container" style="margin-top:12px;"></div>
        </div>
      `
    }
  ];
  
  renderPanels(panels);
}

// Функция загрузки панели RSS
async function loadRSSPanel() {
  const container = document.getElementById('rss-panel-container');
  container.innerHTML = 'Загрузка...';
  
  try {
    // Загружаем HTML панели с сервера
    const response = await fetch('/api/rss/panel');
    if (response.ok) {
      const html = await response.text();
      container.innerHTML = html;
      
      // Загружаем стили
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/css/rss-manager.css';
      document.head.appendChild(link);
      
      // Инициализируем панель
      if (window.initRSSPanel) {
        window.initRSSPanel();
      }
    } else {
      container.innerHTML = 'Ошибка загрузки панели';
    }
  } catch (e) {
    container.innerHTML = 'Ошибка: ' + e.message;
  }
}