// Панель управления RSS для Crucix

export const panel = {
  id: 'rss-manager',
  name: 'Управление RSS',
  icon: '📡',
  category: 'Управление',
  priority: 10,
  
  async render() {
    return `
      <div id="rss-manager-panel" class="panel-content">
        <div class="rss-manager-header">
          <h2>📡 Управление RSS-лентами</h2>
          <div class="rss-stats">
            <span class="stat">Всего: <strong id="rss-total">0</strong></span>
            <span class="stat alive">✅ Живые: <strong id="rss-alive">0</strong></span>
            <span class="stat dead">❌ Мёртвые: <strong id="rss-dead">0</strong></span>
            <span class="stat unknown">❓ Неизвестно: <strong id="rss-unknown">0</strong></span>
          </div>
        </div>
        
        <div class="rss-controls">
          <div class="rss-controls-row">
            <button id="rss-update-all" class="btn btn-primary">🔄 Обновить все ленты</button>
            <button id="rss-export-opml" class="btn btn-secondary">📤 Экспорт OPML</button>
            <button id="rss-import-opml" class="btn btn-secondary">📥 Импорт OPML</button>
          </div>
          <div class="rss-controls-row">
            <div class="rss-add-form">
              <input type="text" id="rss-add-name" placeholder="Название ленты" />
              <input type="url" id="rss-add-url" placeholder="URL ленты (RSS/Atom)" />
              <input type="text" id="rss-add-category" placeholder="Категория" value="Пользовательские" />
              <button id="rss-add-btn" class="btn btn-success">➕ Добавить</button>
            </div>
          </div>
        </div>
        
        <div class="rss-list-container">
          <div class="rss-list-header">
            <span class="col-name">Название</span>
            <span class="col-url">URL</span>
            <span class="col-category">Категория</span>
            <span class="col-status">Статус</span>
            <span class="col-actions">Действия</span>
          </div>
          <div id="rss-list" class="rss-list">
            <div class="loading">Загрузка лент...</div>
          </div>
        </div>
      </div>
    `;
  },
  
  async onLoad() {
    await this.loadFeeds();
    this.setupEventListeners();
  },
  
  async loadFeeds() {
    try {
      const response = await fetch('/api/rss/init');
      const data = await response.json();
      
      if (data.success) {
        this.renderStats(data.stats);
        this.renderFeeds(data.feeds);
      }
    } catch (e) {
      console.error('[RSS Manager] Ошибка загрузки:', e);
      document.getElementById('rss-list').innerHTML = '<div class="error">Ошибка загрузки лент</div>';
    }
  },
  
  renderStats(stats) {
    document.getElementById('rss-total').textContent = stats.total || 0;
    document.getElementById('rss-alive').textContent = stats.alive || 0;
    document.getElementById('rss-dead').textContent = stats.dead || 0;
    document.getElementById('rss-unknown').textContent = stats.unknown || 0;
  },
  
  renderFeeds(feeds) {
    const container = document.getElementById('rss-list');
    
    if (!feeds || feeds.length === 0) {
      container.innerHTML = '<div class="empty">Нет RSS-лент. Добавьте первую!</div>';
      return;
    }
    
    let html = '';
    for (const feed of feeds) {
      const status = feed.status || 'unknown';
      const statusClass = status === 'alive' ? 'status-alive' : 
                         status === 'dead' ? 'status-dead' : 'status-unknown';
      const statusText = status === 'alive' ? '✅ Живая' :
                        status === 'dead' ? '❌ Мёртвая' : '❓ Неизвестно';
      
      html += `
        <div class="rss-item" data-id="${feed.id}">
          <span class="col-name" title="${feed.name}">${feed.name}</span>
          <span class="col-url" title="${feed.url}">${this.truncateUrl(feed.url)}</span>
          <span class="col-category">${feed.category || 'Общее'}</span>
          <span class="col-status ${statusClass}">${statusText}</span>
          <span class="col-actions">
            <button class="btn-rss-delete" data-id="${feed.id}" title="Удалить ленту">🗑️</button>
          </span>
        </div>
      `;
    }
    
    container.innerHTML = html;
    
    // Добавляем обработчики для кнопок удаления
    document.querySelectorAll('.btn-rss-delete').forEach(btn => {
      btn.addEventListener('click', () => this.deleteFeed(btn.dataset.id));
    });
  },
  
  truncateUrl(url) {
    if (url.length > 40) {
      return url.slice(0, 37) + '...';
    }
    return url;
  },
  
  setupEventListeners() {
    // Обновить все ленты
    document.getElementById('rss-update-all')?.addEventListener('click', () => {
      this.updateAllFeeds();
    });
    
    // Экспорт OPML
    document.getElementById('rss-export-opml')?.addEventListener('click', () => {
      this.exportOPML();
    });
    
    // Импорт OPML
    document.getElementById('rss-import-opml')?.addEventListener('click', () => {
      this.importOPML();
    });
    
    // Добавить ленту
    document.getElementById('rss-add-btn')?.addEventListener('click', () => {
      this.addFeed();
    });
    
    // Enter в полях ввода
    document.getElementById('rss-add-url')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addFeed();
    });
    document.getElementById('rss-add-name')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addFeed();
    });
  },
  
  async updateAllFeeds() {
    const btn = document.getElementById('rss-update-all');
    btn.textContent = '⏳ Обновление...';
    btn.disabled = true;
    
    try {
      const response = await fetch('/api/rss/update', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        this.renderStats(data.stats);
        await this.loadFeeds();
        alert(`Обновление завершено!\nПроверено ${data.results.length} лент\nЖивых: ${data.stats.alive}\nМёртвых: ${data.stats.dead}`);
      }
    } catch (e) {
      console.error('[RSS Manager] Ошибка обновления:', e);
      alert('Ошибка при обновлении лент');
    } finally {
      btn.textContent = '🔄 Обновить все ленты';
      btn.disabled = false;
    }
  },
  
  async exportOPML() {
    try {
      const response = await fetch('/api/rss/export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'feeds.opml';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('[RSS Manager] Ошибка экспорта:', e);
      alert('Ошибка при экспорте OPML');
    }
  },
  
  async importOPML() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.opml,.xml';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const response = await fetch('/api/rss/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ xml: text })
        });
        const data = await response.json();
        
        if (data.success) {
          this.renderStats(data.stats);
          await this.loadFeeds();
          alert(`Импорт завершён!\nДобавлено ${data.feeds.length} лент`);
        } else {
          alert('Ошибка импорта: ' + data.error);
        }
      } catch (e) {
        console.error('[RSS Manager] Ошибка импорта:', e);
        alert('Ошибка при импорте OPML');
      }
    };
    input.click();
  },
  
  async addFeed() {
    const nameInput = document.getElementById('rss-add-name');
    const urlInput = document.getElementById('rss-add-url');
    const categoryInput = document.getElementById('rss-add-category');
    
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    const category = categoryInput.value.trim() || 'Пользовательские';
    
    if (!name || !url) {
      alert('Введите название и URL ленты');
      return;
    }
    
    try {
      const response = await fetch('/api/rss/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, category })
      });
      const data = await response.json();
      
      if (data.success) {
        nameInput.value = '';
        urlInput.value = '';
        categoryInput.value = 'Пользовательские';
        await this.loadFeeds();
        const stats = await (await fetch('/api/rss/stats')).json();
        this.renderStats(stats.stats);
      } else {
        alert('Ошибка: ' + data.error);
      }
    } catch (e) {
      console.error('[RSS Manager] Ошибка добавления:', e);
      alert('Ошибка при добавлении ленты');
    }
  },
  
  async deleteFeed(id) {
    if (!confirm('Удалить эту ленту?')) return;
    
    try {
      const response = await fetch(`/api/rss/feeds/${id}`, { method: 'DELETE' });
      const data = await response.json();
      
      if (data.success) {
        await this.loadFeeds();
        const stats = await (await fetch('/api/rss/stats')).json();
        this.renderStats(stats.stats);
      } else {
        alert('Ошибка: ' + data.error);
      }
    } catch (e) {
      console.error('[RSS Manager] Ошибка удаления:', e);
      alert('Ошибка при удалении ленты');
    }
  }
};

export default panel;